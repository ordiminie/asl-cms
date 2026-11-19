import 'server-only'

import {getBillingSyncStateDao} from '@/db/repositories/billing-sync-state-repository'
import {getInvoiceByIdDao} from '@/db/repositories/member-invoice-repository'
import {
  MyMemberProfileRow,
  updateMyMemberProfilesContactDao,
} from '@/db/repositories/member-profile-repository'
import {
  getCurrentParcelsByMemberDao,
  getMemberFormerParcelsDao,
  listOwnershipPeriodsByProfilesDao,
} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'
import {PennylaneError} from '@/lib/pennylane/pennylane-client'
import {getPennylaneClient} from '@/lib/pennylane/pennylane-client.server'
import {isHttpsUrl} from '@/lib/pennylane/pennylane-schemas'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {resolveMemberBillingProvider} from './billing/resolve-member-billing-provider'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {getMyMemberProfiles} from './member-account-service'
import {
  classifyInvoiceStatus,
  composeInvoiceSubject,
  getInvoiceStatusClassification,
  getInvoiceStatusLabels,
  getInvoiceSubjectTemplate,
  statusLabelOf,
} from './rules/member-invoice-rules'
import {
  type OwnershipPeriod,
  parcelsOwnedOn,
} from './rules/pennylane-invoice-mapping'
import {BILLING_PROVIDER_PENNYLANE} from './types/domain/association-settings-types'
import {UserOrganizationRoleConst} from './types/domain/auth-types'
import {
  type MemberInvoice,
  MemberInvoiceSourceConst,
} from './types/domain/member-invoice-types'
import {
  MyContactDTO,
  MyContactGroupDTO,
  MyInvoiceDTO,
  MyInvoicePdfResult,
  MyInvoicesDTO,
  MyLandDTO,
  MyLandsDTO,
  MyPostalContactDTO,
  UpdateMyContactInput,
  UpdateMyContactResult,
} from './types/domain/member-space-types'
import {
  memberProfileOrganizationIdSchema,
  myInvoicePdfServiceSchema,
  updateMyContactServiceSchema,
} from './validation/member-profile-validation'

/**
 * Espace membre (s12d, ecran C, critere 4 ; s53). Lecture **cote membre** :
 * aucun identifiant de fiche en entree. Les fiches se resolvent par
 * l'association du domaine appele et le compte de la session, par la table
 * de liaison (ADR 054), sous `withTenant` : un membre ne peut demander que
 * les siennes.
 */

const byNumber = (a: {number: string}, b: {number: string}): number =>
  a.number.localeCompare(b.number, 'fr', {numeric: true})

/** Un terrain : les parcelles actuelles et anciennes d'une fiche. */
const readLand = async (profile: MyMemberProfileRow): Promise<MyLandDTO> => {
  const current = await getCurrentParcelsByMemberDao(profile.id)
  const former = await getMemberFormerParcelsDao(profile.id)
  return {
    name: profile.name,
    current: current
      .map(({number, startsOn, meterNumber}) => ({
        number,
        startsOn,
        meterNumber,
      }))
      .sort(byNumber),
    former: former
      .map(({number, startsOn, endsOn}) => ({number, startsOn, endsOn}))
      .sort((a, b) => b.endsOn.localeCompare(a.endsOn)),
  }
}

/**
 * « Mes terrains » du proprietaire connecte (s53, critere 2) : une entree par
 * fiche reliee a son compte, dans l'ordre de l'ADR 054 §7, sans l'acquereur ;
 * rien pour un compte sans fiche dans l'association.
 */
export const getMyLandsService = async (
  organizationId: string
): Promise<MyLandsDTO | undefined> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour voir vos terrains')
  }

  return withTenant(parsed.data, async () => {
    const profiles = await getMyMemberProfiles(parsed.data, authUser.id)
    if (profiles.length === 0) return undefined

    const lands: MyLandDTO[] = []
    for (const profile of profiles) lands.push(await readLand(profile))
    return {accountName: authUser.name, lands}
  })
}

/**
 * Le compte connecte est-il un simple membre de cette association ? Pour le
 * back-office : un proprietaire y voit l'ecran C4, qui le renvoie a son
 * espace, au lieu du refus generique. Le SuperAdmin n'en est pas un.
 */
export const isPlainMemberOfService = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  return (authUser?.organizations ?? []).some(
    (membership) =>
      membership.organizationId === organizationId &&
      membership.role === UserOrganizationRoleConst.MEMBER
  )
}

/**
 * Telephone et domicile d'une fiche, rien d'autre : le terrain n'entre ni dans
 * « Mes coordonnees » ni dans la cle des groupes divergents (s55).
 */
const postalContactOf = (profile: MyPostalContactDTO): MyPostalContactDTO => ({
  phone: profile.phone,
  homeAddressLine: profile.homeAddressLine,
  homeAddressComplement: profile.homeAddressComplement,
  homePostalCode: profile.homePostalCode,
  homeCity: profile.homeCity,
})

/** Une fiche telle que « Mes coordonnees » la lit : sans email (s54). */
type ContactProfile = MyPostalContactDTO & {
  name: string
  currentParcelNumbers: string[]
}

const postalKeyOf = (profile: MyPostalContactDTO): string =>
  JSON.stringify(postalContactOf(profile))

/**
 * Un groupe par jeu de coordonnees, dans l'ordre des terrains (s53, 2b) ;
 * aucun quand toutes les fiches ont les memes. Un groupe ne nomme que les
 * fiches dont le nom n'est pas celui du compte.
 */
const contactGroupsOf = (
  profiles: ContactProfile[],
  accountName: string
): MyContactGroupDTO[] => {
  const groups = new Map<string, MyContactGroupDTO>()
  for (const profile of profiles) {
    const key = postalKeyOf(profile)
    const group = groups.get(key) ?? {
      ...postalContactOf(profile),
      parcelNumbers: [],
      names: [],
    }
    groups.set(key, {
      ...group,
      parcelNumbers: [...group.parcelNumbers, ...profile.currentParcelNumbers]
        .map((number) => ({number}))
        .sort(byNumber)
        .map(({number}) => number),
      names:
        profile.name === accountName || group.names.includes(profile.name)
          ? group.names
          : [...group.names, profile.name],
    })
  }
  return groups.size > 1 ? [...groups.values()] : []
}

/**
 * Les coordonnees de la personne (s16, s53) : celles du premier terrain,
 * sans identifiant de fiche ni de compte, avec le nombre de terrains et les
 * groupes quand elles divergent.
 */
const toMyContact = (
  profiles: ContactProfile[],
  accountName: string
): MyContactDTO => {
  const [first] = profiles
  const groups = contactGroupsOf(profiles, accountName)
  return {
    ...postalContactOf(first),
    landCount: profiles.length,
    divergent: groups.length > 0,
    groups,
  }
}

/**
 * Les coordonnees du proprietaire connecte (s16, s53, ecran 2) ; rien pour
 * un compte sans fiche dans l'association.
 */
export const getMyContactService = async (
  organizationId: string
): Promise<MyContactDTO | undefined> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour voir vos coordonnees')
  }

  return withTenant(parsed.data, async () => {
    const profiles = await getMyMemberProfiles(parsed.data, authUser.id)
    return profiles.length > 0
      ? toMyContact(profiles, authUser.name)
      : undefined
  })
}

/**
 * Le proprietaire connecte corrige son telephone et son domicile
 * (s16, ADR 040, s55), pour **toutes** ses fiches d'un coup (s53, arbitrage du
 * 16/11). Les fiches se resolvent par la session et le domaine appele : un
 * identifiant ou un email glisse dans l'entree est retire par Zod.
 */
export const updateMyContactService = async (
  input: UpdateMyContactInput
): Promise<UpdateMyContactResult> => {
  const parsed = updateMyContactServiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour modifier vos coordonnees')
  }

  const {organizationId, ...contact} = parsed.data
  return withTenant(organizationId, async () => {
    const rows = await updateMyMemberProfilesContactDao(
      organizationId,
      authUser.id,
      contact
    )
    if (rows.length === 0) return {status: 'not_found'}
    // Toutes les fiches portent desormais les memes coordonnees : ni ordre ni
    // groupe a calculer.
    const written = rows.map((row) => ({...row, currentParcelNumbers: []}))
    return {status: 'saved', contact: toMyContact(written, authUser.name)}
  })
}

type MyInvoiceContext = {
  subjectTemplate: string
  classification: ReturnType<typeof getInvoiceStatusClassification>
  statusLabels: ReadonlyMap<string, string>
  profileNames: ReadonlyMap<string, string>
  accountName: string
  /** Periodes de propriete des fiches, pour le terrain des factures Pennylane. */
  periods: readonly OwnershipPeriod[]
}

/**
 * Le terrain d'une facture : la parcelle saisie (`site`), ou les parcelles
 * de la fiche a la date d'emission et leur compteur (`pennylane`, ADR 062 §4).
 */
const terrainOf = (
  invoice: MemberInvoice,
  periods: readonly OwnershipPeriod[]
): {parcelNumbers: string[]; meterNumber: string | null} => {
  if (invoice.source !== MemberInvoiceSourceConst.PENNYLANE) {
    return {
      parcelNumbers: invoice.parcelNumber ? [invoice.parcelNumber] : [],
      meterNumber: invoice.meterNumber,
    }
  }
  const parcels = parcelsOwnedOn(
    periods,
    invoice.memberProfileId,
    invoice.issuedOn
  )
  return {
    parcelNumbers: parcels.map(({number}) => number),
    meterNumber:
      parcels.find(({meterNumber}) => meterNumber)?.meterNumber ?? null,
  }
}

/**
 * Une facture vue par le membre (s19, s20) : objet compose, terrain facture,
 * nom de la fiche s'il n'est pas celui du compte, statut brut, son libelle et
 * sa classe, et la reference du PDF quand la source en fournit un.
 */
const toMyInvoice = (
  invoice: MemberInvoice,
  context: MyInvoiceContext
): MyInvoiceDTO => {
  const name = context.profileNames.get(invoice.memberProfileId)
  const withPdf =
    invoice.hasPdf && invoice.source === MemberInvoiceSourceConst.PENNYLANE
  return {
    issuedOn: invoice.issuedOn,
    subject: composeInvoiceSubject(context.subjectTemplate, invoice.year),
    ...terrainOf(invoice, context.periods),
    holderName: name && name !== context.accountName ? name : null,
    amountCents: invoice.amountCents,
    dueOn: invoice.dueOn,
    status: invoice.status,
    statusLabel: statusLabelOf(invoice.status, context.statusLabels),
    statusClass: classifyInvoiceStatus(invoice.status, context.classification),
    hasPdf: withPdf,
    pdfRef: withPdf ? invoice.id : null,
  }
}

type MyInvoicesSyncState = Pick<
  MyInvoicesDTO,
  'syncedFromPennylane' | 'syncedAt' | 'lastSyncFailed' | 'unlinked'
>

const NOT_SYNCED: MyInvoicesSyncState = {
  syncedFromPennylane: false,
  syncedAt: null,
  lastSyncFailed: false,
  unlinked: false,
}

/** L'etat de la synchronisation, lu en base : jamais Pennylane (critere 9). */
const readSyncState = async (
  organizationId: string,
  profiles: readonly MyMemberProfileRow[]
): Promise<MyInvoicesSyncState> => {
  const state = await getBillingSyncStateDao(organizationId)
  return {
    syncedFromPennylane: true,
    syncedAt: state?.lastSuccessAt?.toISOString() ?? null,
    lastSyncFailed: Boolean(state?.lastError),
    unlinked: profiles.every((profile) => !profile.pennylaneCustomerId),
  }
}

/**
 * « Mes factures » du proprietaire connecte (s19, criteres 1 a 7 et 10) :
 * les factures de **toutes** les fiches reliees a son compte, lues par le
 * fournisseur de l'association, quel qu'il soit, emission decroissante.
 * Aucun identifiant en entree ; rien pour un compte sans fiche.
 */
export const getMyInvoicesService = async (
  organizationId: string
): Promise<MyInvoicesDTO | undefined> => {
  const parsed = memberProfileOrganizationIdSchema.safeParse(organizationId)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour voir vos factures')
  }

  return withTenant(parsed.data, async () => {
    const profiles = await getMyMemberProfiles(parsed.data, authUser.id)
    if (profiles.length === 0) return undefined

    const settings = await getAssociationSettingsService(parsed.data)
    const provider = resolveMemberBillingProvider(settings)
    const profileIds = profiles.map((profile) => profile.id)
    const invoices = await provider.listInvoicesOf(parsed.data, profileIds)
    const fromPennylane = provider.id === BILLING_PROVIDER_PENNYLANE
    const periods = invoices.some(
      (invoice) => invoice.source === MemberInvoiceSourceConst.PENNYLANE
    )
      ? await listOwnershipPeriodsByProfilesDao(profileIds)
      : []
    const context: MyInvoiceContext = {
      subjectTemplate: getInvoiceSubjectTemplate(settings),
      classification: getInvoiceStatusClassification(settings),
      statusLabels: getInvoiceStatusLabels(settings),
      profileNames: new Map(profiles.map(({id, name}) => [id, name])),
      accountName: authUser.name,
      periods,
    }
    return {
      landCount: profiles.length,
      invoices: invoices
        .toSorted((a, b) => b.issuedOn.localeCompare(a.issuedOn))
        .map((invoice) => toMyInvoice(invoice, context)),
      ...(fromPennylane
        ? await readSyncState(parsed.data, profiles)
        : NOT_SYNCED),
    }
  })
}

/**
 * Le PDF d'une facture du membre connecte (s20, ADR 062 §6), relu chez
 * Pennylane **au clic** : la facture doit appartenir a l'une des fiches du
 * compte et venir de Pennylane. L'adresse rendue expire ; elle n'est ni
 * stockee, ni mise en cache, ni journalisee (l'intercepteur ne journalise
 * aucun resultat).
 */
export const getMyInvoicePdfUrlService = async (
  organizationId: string,
  invoiceId: string
): Promise<MyInvoicePdfResult> => {
  const parsed = myInvoicePdfServiceSchema.safeParse({
    organizationId,
    invoiceId,
  })
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const authUser = await getAuthUser()
  if (!authUser) {
    throw new AuthorizationError('Connectez-vous pour ouvrir vos factures')
  }

  const externalId = await withTenant(parsed.data.organizationId, async () => {
    const profiles = await getMyMemberProfiles(
      parsed.data.organizationId,
      authUser.id
    )
    const invoice = await getInvoiceByIdDao(parsed.data.invoiceId)
    const owned =
      invoice !== undefined &&
      profiles.some((profile) => profile.id === invoice.memberProfileId)
    return owned &&
      invoice.source === MemberInvoiceSourceConst.PENNYLANE &&
      invoice.externalId
      ? invoice.externalId
      : undefined
  })
  if (!externalId) return {status: 'not_found'}

  try {
    const url = await getPennylaneClient().getCustomerInvoiceFileUrl(externalId)
    return url && isHttpsUrl(url)
      ? {status: 'ready', url}
      : {status: 'unavailable'}
  } catch (error) {
    if (error instanceof PennylaneError) return {status: 'unavailable'}
    throw error
  }
}
