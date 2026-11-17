'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {
  createMemberInvoiceFormSchema,
  MEMBER_INVOICE_FORM_FIELDS,
  type MemberInvoiceActionResult,
  type MemberInvoiceFormField,
  toMemberInvoiceFields,
} from '@/components/features/member-invoice/member-invoice-form-validation'
import {
  createMemberEmailFormSchema,
  MEMBER_EMAIL_FORM_FIELDS,
  type MemberProfileEmailActionResult,
} from '@/components/features/member-profile/member-profile-email-validation'
import {CONFIRMED_ACCOUNT_FIELD} from '@/components/features/member-profile/member-profile-form-validation'
import {MEMBER_PROFILES_ROUTE_PATTERN} from '@/components/features/member-profile/member-profile-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ReadOnlyInvoiceError} from '@/services/errors/member-invoice-errors'
import {
  createMemberInvoiceService,
  updateMemberInvoiceService,
} from '@/services/facades/member-invoice-service-facade'
import {
  addMemberProfileEmailService,
  designateMemberProfileHolderService,
  removeMemberProfileEmailService,
  updateMemberProfileEmailService,
} from '@/services/facades/member-profile-email-service-facade'
import type {MemberEmailRole} from '@/services/types/domain/member-email-types'
import type {
  CreateMemberInvoiceResult,
  UpdateMemberInvoiceResult,
} from '@/services/types/domain/member-invoice-types'
import type {MemberProfileEmailWriteResult} from '@/services/types/domain/member-profile-types'

/**
 * Server Actions de la carte « Adresses email » d'une fiche (s54, ecran 4).
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant d'appeler
 * la facade — le service reverifie `member.profile.manage` — avec le tenant du
 * domaine appele, jamais un identifiant d'association venu du formulaire ;
 * puis revalide le segment **apres** le succes seulement. L'origine d'une
 * adresse n'est jamais lue du formulaire : une saisie du bureau est
 * toujours « saisie sur le site ».
 */

type Translator = Awaited<ReturnType<typeof getTranslations>>

const readField = (formData: FormData, key: string): string =>
  formData.get(key)?.toString() ?? ''

const optionalField = (formData: FormData, key: string): string | undefined =>
  readField(formData, key).trim() || undefined

const revalidateMemberProfileScreens = () => {
  revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')
}

const toFailure = (
  error: unknown,
  t: Translator
): MemberProfileEmailActionResult => ({
  status: 'error',
  message:
    error instanceof AuthorizationError
      ? t('errors.forbidden')
      : t('errors.failed'),
})

/** Traduit le resultat du service ; seul un enregistrement revalide. */
const toActionResult = (
  result: MemberProfileEmailWriteResult,
  t: Translator
): MemberProfileEmailActionResult => {
  if (result.status === 'not_found') {
    return {status: 'error', message: t('errors.notFound')}
  }
  if (result.status !== 'saved') return result

  revalidateMemberProfileScreens()
  return {status: 'saved', change: result.change, email: result.email}
}

const roleOf = (formData: FormData): MemberEmailRole | undefined => {
  const role = readField(formData, MEMBER_EMAIL_FORM_FIELDS.role)
  return role === 'holder' || role === 'additional' ? role : undefined
}

type EmailWrite = (input: {
  organizationId: string
  memberProfileId: string
  email: string
  formData: FormData
}) => Promise<MemberProfileEmailWriteResult>

/** Une ecriture qui porte une adresse saisie, validee avant la facade. */
const runEmailWrite = async (
  formData: FormData,
  write: EmailWrite
): Promise<MemberProfileEmailActionResult> => {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')

  try {
    await requireActionAuth()

    const validation = createMemberEmailFormSchema(t).safeParse({
      email: readField(formData, MEMBER_EMAIL_FORM_FIELDS.email),
    })
    if (!validation.success) {
      return {
        status: 'invalid',
        message: validation.error.issues[0]?.message ?? '',
      }
    }

    const result = await write({
      organizationId: tenant.id,
      memberProfileId: readField(
        formData,
        MEMBER_EMAIL_FORM_FIELDS.memberProfileId
      ),
      email: validation.data.email.trim(),
      formData,
    })
    return toActionResult(result, t)
  } catch (error) {
    return toFailure(error, t)
  }
}

/** « Ajouter une adresse » (4b), puis « Oui, ajouter a cette fiche » (4c). */
export async function addMemberProfileEmailAction(
  _prevState: MemberProfileEmailActionResult | undefined,
  formData: FormData
): Promise<MemberProfileEmailActionResult> {
  return runEmailWrite(formData, ({formData: data, ...input}) =>
    addMemberProfileEmailService({
      ...input,
      role: roleOf(data),
      confirmedAccountUserId: optionalField(data, CONFIRMED_ACCOUNT_FIELD),
    })
  )
}

/** « Modifier l'adresse », depuis « Gerer » (ecran 4). */
export async function updateMemberProfileEmailAction(
  _prevState: MemberProfileEmailActionResult | undefined,
  formData: FormData
): Promise<MemberProfileEmailActionResult> {
  return runEmailWrite(formData, ({formData: data, ...input}) =>
    updateMemberProfileEmailService({
      ...input,
      emailId: readField(data, MEMBER_EMAIL_FORM_FIELDS.emailId),
      confirmedAccountUserId: optionalField(data, CONFIRMED_ACCOUNT_FIELD),
    })
  )
}

/** Une ecriture sur une adresse designee, sans adresse saisie. */
const runDesignatedWrite = async (
  write: (tenantId: string) => Promise<MemberProfileEmailWriteResult>
): Promise<MemberProfileEmailActionResult> => {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberProfilesPage')

  try {
    await requireActionAuth()
    return toActionResult(await write(tenant.id), t)
  } catch (error) {
    return toFailure(error, t)
  }
}

/** « Retirer l'adresse » (4f), « Retirer et remplacer » (4e). */
export async function removeMemberProfileEmailAction(
  _prevState: MemberProfileEmailActionResult | undefined,
  formData: FormData
): Promise<MemberProfileEmailActionResult> {
  return runDesignatedWrite((organizationId) =>
    removeMemberProfileEmailService({
      organizationId,
      memberProfileId: readField(
        formData,
        MEMBER_EMAIL_FORM_FIELDS.memberProfileId
      ),
      emailId: readField(formData, MEMBER_EMAIL_FORM_FIELDS.emailId),
      replacementEmailId: optionalField(
        formData,
        MEMBER_EMAIL_FORM_FIELDS.replacementEmailId
      ),
      replacementEmail: optionalField(
        formData,
        MEMBER_EMAIL_FORM_FIELDS.replacementEmail
      ),
    })
  )
}

/** « Designer titulaire » (4d). */
export async function designateMemberProfileHolderAction(
  _prevState: MemberProfileEmailActionResult | undefined,
  formData: FormData
): Promise<MemberProfileEmailActionResult> {
  return runDesignatedWrite((organizationId) =>
    designateMemberProfileHolderService({
      organizationId,
      memberProfileId: readField(
        formData,
        MEMBER_EMAIL_FORM_FIELDS.memberProfileId
      ),
      emailId: readField(formData, MEMBER_EMAIL_FORM_FIELDS.emailId),
    })
  )
}

type InvoiceFormRead =
  | {valid: true; fields: ReturnType<typeof toMemberInvoiceFields>}
  | {valid: false; result: MemberInvoiceActionResult}

/** Les champs de la facture, valides par le schema partage avec l'ecran. */
const readInvoiceForm = (
  formData: FormData,
  t: Translator
): InvoiceFormRead => {
  const validation = createMemberInvoiceFormSchema(t).safeParse(
    Object.fromEntries(
      MEMBER_INVOICE_FORM_FIELDS.map((field) => [
        field,
        readField(formData, field),
      ])
    )
  )
  if (validation.success) {
    return {valid: true, fields: toMemberInvoiceFields(validation.data)}
  }
  return {
    valid: false,
    result: {
      status: 'invalid',
      errors: validation.error.issues.map((issue) => ({
        field: issue.path[0] as MemberInvoiceFormField,
        message: issue.message,
      })),
    },
  }
}

/** Traduit le resultat du service ; seul un enregistrement revalide. */
const toInvoiceActionResult = (
  result: CreateMemberInvoiceResult | UpdateMemberInvoiceResult,
  t: Translator
): MemberInvoiceActionResult => {
  switch (result.status) {
    case 'saved':
      revalidateMemberProfileScreens()
      return {status: 'saved'}
    case 'parcel_not_owned':
      return {
        status: 'invalid',
        errors: [{field: 'parcelId', message: t('refusals.parcelNotOwned')}],
      }
    case 'unknown_status':
      return {
        status: 'invalid',
        errors: [{field: 'status', message: t('refusals.unknownStatus')}],
      }
    case 'not_found':
      return {status: 'error', message: t('errors.notFound')}
  }
}

const toInvoiceFailure = (
  error: unknown,
  t: Translator
): MemberInvoiceActionResult => {
  if (error instanceof ReadOnlyInvoiceError) return {status: 'read_only'}
  return {
    status: 'error',
    message:
      error instanceof AuthorizationError
        ? t('errors.forbidden')
        : t('errors.failed'),
  }
}

/**
 * « Enregistrer la facture » (s19, ecran 3) : une facture saisie sur le site,
 * pour la fiche designee, au tenant du domaine appele. La source n'est jamais
 * lue du formulaire.
 */
export async function createMemberInvoiceAction(
  _prevState: MemberInvoiceActionResult | undefined,
  formData: FormData
): Promise<MemberInvoiceActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberInvoices')

  try {
    await requireActionAuth()

    const read = readInvoiceForm(formData, t)
    if (!read.valid) return read.result

    const result = await createMemberInvoiceService({
      organizationId: tenant.id,
      memberProfileId: readField(formData, 'memberProfileId'),
      ...read.fields,
    })
    return toInvoiceActionResult(result, t)
  } catch (error) {
    return toInvoiceFailure(error, t)
  }
}

/**
 * Corriger une facture saisie sur le site (s19, ecran 3). Une facture
 * Pennylane est refusee par le service, meme sur un envoi direct (critere 9).
 */
export async function updateMemberInvoiceAction(
  _prevState: MemberInvoiceActionResult | undefined,
  formData: FormData
): Promise<MemberInvoiceActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauMemberInvoices')

  try {
    await requireActionAuth()

    const read = readInvoiceForm(formData, t)
    if (!read.valid) return read.result

    const result = await updateMemberInvoiceService({
      organizationId: tenant.id,
      invoiceId: readField(formData, 'invoiceId'),
      ...read.fields,
    })
    return toInvoiceActionResult(result, t)
  } catch (error) {
    return toInvoiceFailure(error, t)
  }
}
