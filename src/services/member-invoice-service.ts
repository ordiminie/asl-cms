import 'server-only'

import {getBillingSyncStateDao} from '@/db/repositories/billing-sync-state-repository'
import {
  claimStatusAlertDao,
  countInvoicesByStatusDao,
  createInvoiceDao,
  getInvoiceByIdDao,
  releaseStatusAlertDao,
  updateSiteInvoiceDao,
} from '@/db/repositories/member-invoice-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {pngLogoUrlOf} from '@/lib/emails/logo-url'
import {PRODUCT_LOCALE} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {toMemberInvoice} from './billing/manual-member-billing-provider'
import type {MemberBillingProvider} from './billing/member-billing-provider'
import {resolveMemberBillingProvider} from './billing/resolve-member-billing-provider'
import {sendInvoiceStatusAlertEmailService} from './email-service'
import {AuthorizationError} from './errors/authorization-error'
import {ReadOnlyInvoiceError} from './errors/member-invoice-errors'
import {ValidationParsedZodError} from './errors/validation-error'
import {getParcelOwnerAtService} from './parcel-ownership-service'
import {
  classifyInvoiceStatus,
  composeInvoiceSubject,
  getInvoiceStatusClassification,
  getInvoiceSubjectTemplate,
  selectableInvoiceStatuses,
} from './rules/member-invoice-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  BILLING_ALERT_EMAIL_SETTING_KEY,
  BILLING_PROVIDER_PENNYLANE,
  getAccentHue,
  ResolvedAssociationSettings,
} from './types/domain/association-settings-types'
import {
  BoardInvoiceDTO,
  BoardMemberInvoicesDTO,
  CreateMemberInvoiceInput,
  CreateMemberInvoiceResult,
  MemberInvoice,
  MemberInvoiceFields,
  MemberInvoiceSourceConst,
  MemberInvoiceWriteRefusal,
  UpdateMemberInvoiceInput,
  UpdateMemberInvoiceResult,
} from './types/domain/member-invoice-types'
import {
  createMemberInvoiceServiceSchema,
  memberInvoiceOrganizationIdSchema,
  memberInvoiceServiceSchema,
  memberInvoicesServiceSchema,
  updateMemberInvoiceServiceSchema,
} from './validation/member-invoice-validation'

/**
 * Factures des membres dans le back-office (s19, ADR 059). Ordre de chaque
 * ecriture : Zod -> `member.invoice.manage` -> fournisseur qui permet la saisie
 * -> statut dans la configuration -> parcelle possedee a la date d'emission ->
 * ecriture sous le scope du tenant. Une facture `pennylane` n'est jamais
 * modifiee ici, quel que soit l'appelant (critere 9).
 */

const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les factures des membres"
const PROVIDER_READ_ONLY =
  'Les factures de cette association ne se saisissent pas sur le site : elles viennent de leur source'
const PARCEL_CHECK_DENIED =
  'La parcelle facturée ne peut pas être vérifiée : il faut aussi le droit de gérer les fiches des propriétaires'

const requireInvoiceManager = async (organizationId: string): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(authUser, organizationId, ActionIdConst.INVOICE_MANAGE)
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
}

type BillingContext = {
  settings: ResolvedAssociationSettings
  provider: MemberBillingProvider
}

const readBillingContext = async (
  organizationId: string
): Promise<BillingContext> => {
  const settings = await getAssociationSettingsService(organizationId)
  return {settings, provider: resolveMemberBillingProvider(settings)}
}

const requireWritableProvider = (context: BillingContext): void => {
  if (!context.provider.canWrite) {
    throw new AuthorizationError(PROVIDER_READ_ONLY)
  }
}

/**
 * La fiche facturee possede-t-elle la parcelle a la date d'emission ? Lecture
 * datee de s12 (ADR 059 §3). Elle exige aussi `member.profile.manage` : un
 * refus y est rendu explicite, jamais confondu avec une parcelle d'autrui.
 */
const ownsParcelAt = async (
  organizationId: string,
  memberProfileId: string,
  parcelId: string,
  issuedOn: string
): Promise<boolean> => {
  try {
    const owner = await getParcelOwnerAtService(
      organizationId,
      parcelId,
      issuedOn
    )
    return owner?.id === memberProfileId
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new AuthorizationError(PARCEL_CHECK_DENIED)
    }
    throw error
  }
}

/** Refus metier d'une saisie, ou rien si elle peut s'ecrire. */
const writeRefusalOf = async (
  organizationId: string,
  memberProfileId: string,
  fields: MemberInvoiceFields,
  context: BillingContext
): Promise<MemberInvoiceWriteRefusal | undefined> => {
  const statuses = selectableInvoiceStatuses(
    getInvoiceStatusClassification(context.settings)
  )
  if (!statuses.includes(fields.status)) return {status: 'unknown_status'}
  if (
    !(await ownsParcelAt(
      organizationId,
      memberProfileId,
      fields.parcelId,
      fields.issuedOn
    ))
  ) {
    return {status: 'parcel_not_owned'}
  }
  return undefined
}

const fieldsOf = (input: MemberInvoiceFields): MemberInvoiceFields => ({
  parcelId: input.parcelId,
  year: input.year,
  issuedOn: input.issuedOn,
  dueOn: input.dueOn,
  amountCents: input.amountCents,
  status: input.status,
})

/** Le bureau saisit une facture pour une fiche (critere 9). */
export const createMemberInvoiceService = async (
  input: CreateMemberInvoiceInput
): Promise<CreateMemberInvoiceResult> => {
  const parsed = createMemberInvoiceServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const {organizationId, memberProfileId} = parsed.data
  await requireInvoiceManager(organizationId)

  const context = await readBillingContext(organizationId)
  requireWritableProvider(context)

  const fields = fieldsOf(parsed.data)
  const refusal = await writeRefusalOf(
    organizationId,
    memberProfileId,
    fields,
    context
  )
  if (refusal) return refusal

  const row = await withTenant(organizationId, () =>
    createInvoiceDao({
      organizationId,
      memberProfileId,
      source: MemberInvoiceSourceConst.SITE,
      ...fields,
    })
  )
  await signalUnknownInvoiceStatuses(organizationId, [fields.status])
  return {status: 'saved', invoiceId: row.id}
}

/**
 * Le bureau corrige une facture **saisie sur le site** (critere 9). La fiche
 * facturee ne change pas ; une facture Pennylane est refusee, ici et dans
 * l'`UPDATE` lui-meme. Aucun historique des corrections en V1.
 */
export const updateMemberInvoiceService = async (
  input: UpdateMemberInvoiceInput
): Promise<UpdateMemberInvoiceResult> => {
  const parsed = updateMemberInvoiceServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  const {organizationId, invoiceId} = parsed.data
  await requireInvoiceManager(organizationId)

  const context = await readBillingContext(organizationId)
  requireWritableProvider(context)

  const invoice = await withTenant(organizationId, () =>
    getInvoiceByIdDao(invoiceId)
  )
  if (!invoice) return {status: 'not_found'}
  if (invoice.source !== MemberInvoiceSourceConst.SITE) {
    throw new ReadOnlyInvoiceError()
  }

  const fields = fieldsOf(parsed.data)
  const refusal = await writeRefusalOf(
    organizationId,
    invoice.memberProfileId,
    fields,
    context
  )
  if (refusal) return refusal

  const updated = await withTenant(organizationId, () =>
    updateSiteInvoiceDao(invoiceId, fields)
  )
  if (updated === 0) throw new ReadOnlyInvoiceError()
  await signalUnknownInvoiceStatuses(organizationId, [fields.status])
  return {status: 'saved'}
}

const toBoardInvoice = (
  invoice: MemberInvoice,
  settings: ResolvedAssociationSettings
): BoardInvoiceDTO => ({
  ...invoice,
  subject: composeInvoiceSubject(
    getInvoiceSubjectTemplate(settings),
    invoice.year
  ),
  statusClass: classifyInvoiceStatus(
    invoice.status,
    getInvoiceStatusClassification(settings)
  ),
})

/**
 * Les factures d'une fiche, pour la carte « Factures » du bureau : lues par le
 * fournisseur de l'association, emission decroissante, avec leur source.
 */
export const listMemberInvoicesService = async (
  organizationId: string,
  memberProfileId: string
): Promise<BoardMemberInvoicesDTO> => {
  const parsed = memberInvoicesServiceSchema.safeParse({
    organizationId,
    memberProfileId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  await requireInvoiceManager(parsed.data.organizationId)

  const context = await readBillingContext(parsed.data.organizationId)
  const invoices = await context.provider.listInvoicesOf(
    parsed.data.organizationId,
    [parsed.data.memberProfileId]
  )
  const syncedFromPennylane = context.provider.id === BILLING_PROVIDER_PENNYLANE
  const syncState = syncedFromPennylane
    ? await withTenant(parsed.data.organizationId, () =>
        getBillingSyncStateDao(parsed.data.organizationId)
      )
    : undefined
  return {
    canWrite: context.provider.canWrite,
    syncedFromPennylane,
    syncedAt: syncState?.lastSuccessAt?.toISOString() ?? null,
    invoices: invoices
      .toSorted((a, b) => b.issuedOn.localeCompare(a.issuedOn))
      .map((invoice) => toBoardInvoice(invoice, context.settings)),
  }
}

/**
 * Une facture de la fiche, pour l'ecran de correction ; rien si elle n'existe
 * pas dans l'association ou appartient a une autre fiche (identifiant forge).
 */
export const getMemberInvoiceService = async (
  organizationId: string,
  memberProfileId: string,
  invoiceId: string
): Promise<BoardInvoiceDTO | undefined> => {
  const parsed = memberInvoiceServiceSchema.safeParse({
    organizationId,
    memberProfileId,
    invoiceId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }
  await requireInvoiceManager(parsed.data.organizationId)

  const row = await withTenant(parsed.data.organizationId, () =>
    getInvoiceByIdDao(parsed.data.invoiceId)
  )
  if (!row || row.memberProfileId !== parsed.data.memberProfileId) {
    return undefined
  }
  const settings = await getAssociationSettingsService(
    parsed.data.organizationId
  )
  return toBoardInvoice(toMemberInvoice(row), settings)
}

/**
 * Envoie le signalement d'un statut reclame. Leve si l'email ne peut pas
 * partir : l'appelant libere alors le signalement.
 */
const sendStatusAlert = async (
  organizationId: string,
  alertId: string,
  status: string,
  settings: ResolvedAssociationSettings
): Promise<void> => {
  const [organization, invoiceCount] = await Promise.all([
    getOrganizationByIdDao(organizationId),
    withTenant(organizationId, () =>
      countInvoicesByStatusDao(organizationId, status)
    ),
  ])
  const to = settings[BILLING_ALERT_EMAIL_SETTING_KEY]?.value
  const origin = associationOriginOf(organization?.domain)
  if (typeof to !== 'string' || !organization || !origin) {
    throw new Error("Destinataire ou domaine de l'association absent")
  }
  const logoUrl = pngLogoUrlOf(organization.identityLogoKey, origin)
  await sendInvoiceStatusAlertEmailService({
    organizationId,
    alertId,
    to,
    locale: PRODUCT_LOCALE,
    association: {
      name: organization.name,
      hue: getAccentHue(settings),
      ...(logoUrl ? {logoUrl} : {}),
    },
    status,
    invoiceCount,
    settingsUrl: `${origin}/bureau/reglages`,
  })
}

/** Reclame puis signale un statut ; un echec libere la reclamation. */
const signalStatus = async (
  organizationId: string,
  status: string,
  settings: ResolvedAssociationSettings
): Promise<void> => {
  const claim = await withTenant(organizationId, () =>
    claimStatusAlertDao(organizationId, status)
  )
  if (!claim) return
  try {
    await sendStatusAlert(organizationId, claim.id, status, settings)
  } catch (error) {
    logger.error('[MEMBER-INVOICE] Signalement de statut non envoye', {
      alertId: claim.id,
      error: error instanceof Error ? error.name : 'unknown',
    })
    await withTenant(organizationId, () =>
      releaseStatusAlertDao(organizationId, status)
    )
  }
}

/**
 * Signale au bureau, **une fois par statut**, chaque statut « a classer »
 * parmi ceux qu'une ecriture vient de poser (critere 6, ADR 059 §5). Toute
 * implementation qui ecrit des factures y passe (s20 la reutilise). Ne leve
 * jamais : un signalement manque ne fait pas echouer l'ecriture, il sera
 * retente a la prochaine. Sans controle d'acces : appelee apres celui de
 * l'ecriture, jamais depuis la presentation.
 */
export const signalUnknownInvoiceStatuses = async (
  organizationId: string,
  statuses: readonly string[]
): Promise<void> => {
  try {
    const settings = await getAssociationSettingsService(organizationId)
    const classification = getInvoiceStatusClassification(settings)
    const unknown = [
      ...new Set(statuses.map((status) => status.trim())),
    ].filter(
      (status) =>
        classifyInvoiceStatus(status, classification) === 'unclassified'
    )
    for (const status of unknown) {
      await signalStatus(organizationId, status, settings)
    }
  } catch (error) {
    logger.error('[MEMBER-INVOICE] Signalement des statuts impossible', {
      error: error instanceof Error ? error.name : 'unknown',
    })
  }
}

/**
 * Le compte connecte gere-t-il les factures de cette association ? La carte
 * « Factures » d'une fiche n'est rendue que pour lui (s19, ecran 2).
 */
export const canManageMemberInvoicesService = async (
  organizationId: string
): Promise<boolean> => {
  const parsed = memberInvoiceOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) return false

  const authUser = await getAuthUser()
  return canPerformAction(authUser, parsed.data, ActionIdConst.INVOICE_MANAGE)
}
