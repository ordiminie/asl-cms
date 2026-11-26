import 'server-only'

import {
  deleteMemberProfileEmailDao,
  getActiveEmailCarriersDao,
  getMemberProfileEmailByIdDao,
  getMemberProfileEmailsByTokenHashDao,
  getMemberProfileEmailsDao,
  insertMemberProfileEmailDao,
  MemberProfileEmailRow,
  purgeExpiredPendingEmailsDao,
  updateMemberProfileEmailDao,
} from '@/db/repositories/member-profile-email-repository'
import {MyMemberProfileRow} from '@/db/repositories/member-profile-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {withTenant} from '@/db/tenant-scope'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import {pngLogoUrlOf} from '@/lib/emails/logo-url'
import type {MagicLinkEmailAssociation} from '@/lib/emails/magic-link-email'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {sendMemberEmailConfirmationEmailService} from './email-service'
import {AuthorizationError} from './errors/authorization-error'
import {NotFoundError} from './errors/not-found-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {hashConfirmationToken, newConfirmationToken} from './member-email-token'
import {getMyAccessibleProfiles} from './member-profile-access-service'
import {sameEmail} from './rules/member-account-rules'
import {
  canMemberManagePending,
  canMemberReplaceEmail,
  confirmationExpiryOf,
  decideMemberEmailAddition,
  visibleEmails,
} from './rules/member-email-rules'
import {
  getAccentHue,
  getMemberEmailConfirmationDays,
} from './types/domain/association-settings-types'
import {
  AddMyEmailInput,
  CancelMyPendingEmailInput,
  CancelMyPendingEmailResult,
  CorrectMyPendingEmailInput,
  MemberEmailOriginConst,
  MemberEmailRoleConst,
  MemberEmailStatusConst,
  MyEmailDTO,
  MyEmailsDTO,
  MyEmailWriteResult,
  UpdateMyEmailInput,
} from './types/domain/member-email-types'
import {User} from './types/domain/user-types'
import {
  addMyEmailServiceSchema,
  cancelMyPendingEmailServiceSchema,
  memberProfileOrganizationIdSchema,
  myEmailTargetServiceSchema,
} from './validation/member-profile-validation'

/**
 * « Mes adresses email » (s54, ecran 1, ADR 056 §4). Cote membre : aucun
 * identifiant de fiche en entree ; les fiches se resolvent par la session et
 * le domaine appele, sous `withTenant`. Le membre **ajoute** des adresses sur
 * toutes ses fiches (arbitrage du 16/11), **modifie sa propre adresse** (celle
 * egale a `user.email`), **corrige ou annule** les attentes dont il est
 * l'auteur ; il ne retire rien. Une adresse ajoutee ou modifiee n'est active
 * qu'apres confirmation par le lien envoye a cette adresse. Une adresse portee
 * par une fiche non reliee a son compte est refusee sans nommer personne
 * (critere 7).
 */

const MY_EMAILS_DENIED = 'Connectez-vous pour gérer vos adresses'
const NOT_YOURS = 'Cette adresse ne vous appartient pas'
const CONFIRMATION_PATH = '/confirmer-adresse'

const requireMember = async (): Promise<User> => {
  const authUser = await getAuthUser()
  if (!authUser) throw new AuthorizationError(MY_EMAILS_DENIED)
  return authUser
}

const parseOrThrow = <T>(
  schema: {
    safeParse: (input: unknown) =>
      | {success: true; data: T}
      | {
          success: false
          error: ConstructorParameters<typeof ValidationParsedZodError>[0]
        }
  },
  input: unknown
): T => {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  return parsed.data
}

type ConfirmationAssociation = {
  association: MagicLinkEmailAssociation
  origin: string
  confirmationDays: number
}

/** Ce que le lien et l'email montrent de l'association, lu hors du scope. */
const readAssociation = async (
  organizationId: string
): Promise<ConfirmationAssociation> => {
  const [settings, organization] = await Promise.all([
    getAssociationSettingsService(organizationId),
    getOrganizationByIdDao(organizationId),
  ])
  const origin = associationOriginOf(organization?.domain)
  if (!organization || !origin) {
    throw new NotFoundError("Domaine de l'association absent")
  }
  const logoUrl = pngLogoUrlOf(organization.identityLogoKey, origin)
  return {
    association: {
      name: organization.name,
      hue: getAccentHue(settings),
      ...(logoUrl ? {logoUrl} : {}),
    },
    origin,
    confirmationDays: getMemberEmailConfirmationDays(settings),
  }
}

type Mine = {
  profiles: MyMemberProfileRow[]
  emails: MemberProfileEmailRow[]
}

/**
 * Mes fiches accessibles (une fiche fermee apres la vente en sort, s57), dans
 * l'ordre de l'ADR 054 §7, et leurs adresses visibles.
 */
const loadMine = async (
  organizationId: string,
  userId: string,
  now: Date
): Promise<Mine> => {
  const profiles = await getMyAccessibleProfiles(organizationId, userId)
  const emails = visibleEmails(
    await getMemberProfileEmailsDao(profiles.map((profile) => profile.id)),
    now
  )
  return {profiles, emails}
}

const sortNumbers = (numbers: string[]): string[] =>
  [...new Set(numbers)].sort((a, b) =>
    a.localeCompare(b, 'fr', {numeric: true})
  )

/** Les adresses de mes fiches, regroupees sans casse, pour l'ecran 1. */
const toMyEmails = (mine: Mine, authUser: User): MyEmailDTO[] => {
  const groups = new Map<string, MemberProfileEmailRow[]>()
  for (const row of mine.emails) {
    const key = row.email.trim().toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const ownIds = new Set(
    mine.emails
      .filter((row) => canMemberReplaceEmail(row, authUser.email))
      .map((row) => row.id)
  )

  const emails = [...groups.values()].map((rows): MyEmailDTO => {
    const [first] = rows
    const active = rows.some(
      (row) => row.status === MemberEmailStatusConst.ACTIVE
    )
    const profileIds = new Set(rows.map((row) => row.memberProfileId))
    const partial = profileIds.size < mine.profiles.length
    return {
      email: first.email,
      status: active
        ? MemberEmailStatusConst.ACTIVE
        : MemberEmailStatusConst.PENDING,
      own: active && sameEmail(first.email, authUser.email),
      holder: rows.some(
        (row) =>
          row.status === MemberEmailStatusConst.ACTIVE &&
          row.role === MemberEmailRoleConst.HOLDER
      ),
      pendingId:
        !active && first.addedByUserId === authUser.id ? first.id : null,
      ownEmailId:
        active && sameEmail(first.email, authUser.email)
          ? (rows.find((row) => ownIds.has(row.id))?.id ?? null)
          : null,
      replacesOwn:
        !active &&
        rows.some(
          (row) =>
            row.replacesEmailId !== null && ownIds.has(row.replacesEmailId)
        ),
      sentAt: active ? null : first.updatedAt.toISOString(),
      expiresAt: active ? null : (first.expiresAt?.toISOString() ?? null),
      onlyParcelNumbers: partial
        ? sortNumbers(
            mine.profiles
              .filter((profile) => profileIds.has(profile.id))
              .flatMap((profile) => profile.currentParcelNumbers)
          )
        : null,
    }
  })
  return [
    ...emails.filter((email) => email.status === 'active'),
    ...emails.filter((email) => email.status === 'pending'),
  ]
}

/** « Mes adresses email » de la personne connectee ; rien sans fiche. */
export const getMyEmailsService = async (
  organizationId: string
): Promise<MyEmailsDTO | undefined> => {
  const parsedOrganizationId = parseOrThrow(
    memberProfileOrganizationIdSchema,
    organizationId
  )
  const authUser = await requireMember()
  const settings = await getAssociationSettingsService(parsedOrganizationId)
  const now = new Date()

  return withTenant(parsedOrganizationId, async () => {
    const mine = await loadMine(parsedOrganizationId, authUser.id, now)
    if (mine.profiles.length === 0) return undefined
    return {
      emails: toMyEmails(mine, authUser),
      landCount: mine.profiles.length,
      confirmationDays: getMemberEmailConfirmationDays(settings),
    }
  })
}

type PendingLink = {token: string; tokenHash: string; expiresAt: Date}

const newPendingLink = (now: Date, days: number): PendingLink => {
  const token = newConfirmationToken()
  return {
    token,
    tokenHash: hashConfirmationToken(token),
    expiresAt: confirmationExpiryOf(now, days),
  }
}

/** Refus du critere 7 ou adresse deja listee, a l'egard de mes fiches. */
const additionRefusalOf = async (
  organizationId: string,
  email: string,
  mine: Mine,
  ignoredIds: readonly string[],
  now: Date
): Promise<'already_listed' | 'taken' | undefined> => {
  const carriers = await getActiveEmailCarriersDao(organizationId, email)
  const decision = decideMemberEmailAddition({
    email,
    myEmails: mine.emails.filter((row) => !ignoredIds.includes(row.id)),
    carrierProfileIds: carriers.map((carrier) => carrier.memberProfileId),
    myProfileIds: mine.profiles.map((profile) => profile.id),
    now,
  })
  return decision === 'ok' ? undefined : decision
}

/**
 * Envoie le lien a l'adresse a confirmer (nature `member_email_confirmation`,
 * budget de s52) : le jeton en clair ne part que dans l'URL de l'email.
 */
const sendLink = async ({
  organizationId,
  context,
  authUser,
  profiles,
  email,
  link,
  locale,
}: {
  organizationId: string
  context: ConfirmationAssociation
  authUser: User
  profiles: MyMemberProfileRow[]
  email: string
  link: PendingLink
  locale?: string
}): Promise<MyEmailWriteResult> => {
  const result = await sendMemberEmailConfirmationEmailService({
    organizationId,
    email,
    url: `${context.origin}${CONFIRMATION_PATH}/${link.token}`,
    token: link.token,
    tokenHash: link.tokenHash,
    association: context.association,
    authorName: authUser.name,
    profileName: profiles[0]?.name ?? '',
    parcelNumbers: sortNumbers(
      profiles.flatMap((profile) => profile.currentParcelNumbers)
    ),
    expiresAt: link.expiresAt,
    locale: resolveSupportedLocale(locale),
  })
  return {
    status: result.status === 'deferred' ? 'deferred' : 'sent',
    email,
    expiresAt: link.expiresAt.toISOString(),
  }
}

/**
 * Ajoute une adresse supplementaire, en attente, sur **toutes** les fiches
 * du compte, sous un seul lien ; puis envoie le lien (1b, 1c, 1f).
 */
export const addMyEmailService = async (
  input: AddMyEmailInput
): Promise<MyEmailWriteResult> => {
  const {organizationId, email, locale} = parseOrThrow(
    addMyEmailServiceSchema,
    input
  )
  const authUser = await requireMember()
  const context = await readAssociation(organizationId)
  const now = new Date()
  const link = newPendingLink(now, context.confirmationDays)

  const written = await withTenant(organizationId, async () => {
    await purgeExpiredPendingEmailsDao(organizationId, now)
    const mine = await loadMine(organizationId, authUser.id, now)
    if (mine.profiles.length === 0) return {status: 'not_found'} as const
    const refusal = await additionRefusalOf(
      organizationId,
      email,
      mine,
      [],
      now
    )
    if (refusal) return {status: refusal} as const

    for (const profile of mine.profiles) {
      await insertMemberProfileEmailDao({
        organizationId,
        memberProfileId: profile.id,
        email,
        role: MemberEmailRoleConst.ADDITIONAL,
        status: MemberEmailStatusConst.PENDING,
        origin: MemberEmailOriginConst.SITE,
        addedByUserId: authUser.id,
        confirmationTokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
      })
    }
    return {status: 'written', profiles: mine.profiles} as const
  })
  if (written.status !== 'written') return written

  return sendLink({
    organizationId,
    context,
    authUser,
    profiles: written.profiles,
    email,
    link,
    locale,
  })
}

/**
 * La ligne designee, si elle est sur une fiche de la personne connectee et
 * que la regle l'autorise ; sinon un refus, qui ne dit pas si l'adresse
 * existe ailleurs (une autre association est invisible sous la RLS).
 */
const requireMine = async (
  emailId: string,
  mine: Mine,
  allowed: (row: MemberProfileEmailRow) => boolean
): Promise<MemberProfileEmailRow> => {
  const row = await getMemberProfileEmailByIdDao(emailId)
  const visible = mine.emails.find((candidate) => candidate.id === row?.id)
  if (
    !row ||
    !visible ||
    !mine.profiles.some((profile) => profile.id === row.memberProfileId) ||
    !allowed(visible)
  ) {
    throw new AuthorizationError(NOT_YOURS)
  }
  return visible
}

/**
 * Modifie **sa propre adresse**, sur toutes ses fiches : une attente qui la
 * remplacera a la confirmation, l'adresse actuelle restant active d'ici la
 * (1e, critere 5). Toute autre adresse est refusee (critere 4).
 */
export const updateMyEmailService = async (
  input: UpdateMyEmailInput
): Promise<MyEmailWriteResult> => {
  const {organizationId, email, emailId, locale} = parseOrThrow(
    myEmailTargetServiceSchema,
    input
  )
  const authUser = await requireMember()
  const context = await readAssociation(organizationId)
  const now = new Date()
  const link = newPendingLink(now, context.confirmationDays)

  const written = await withTenant(organizationId, async () => {
    await purgeExpiredPendingEmailsDao(organizationId, now)
    const mine = await loadMine(organizationId, authUser.id, now)
    await requireMine(emailId, mine, (row) =>
      canMemberReplaceEmail(row, authUser.email)
    )
    const refusal = await additionRefusalOf(
      organizationId,
      email,
      mine,
      [],
      now
    )
    if (refusal) return {status: refusal} as const

    const own = mine.emails.filter((row) =>
      canMemberReplaceEmail(row, authUser.email)
    )
    for (const replaced of own) {
      await insertMemberProfileEmailDao({
        organizationId,
        memberProfileId: replaced.memberProfileId,
        email,
        role: replaced.role,
        status: MemberEmailStatusConst.PENDING,
        origin: MemberEmailOriginConst.SITE,
        addedByUserId: authUser.id,
        replacesEmailId: replaced.id,
        confirmationTokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
      })
    }
    return {status: 'written', profiles: mine.profiles} as const
  })
  if (written.status !== 'written') return written

  return sendLink({
    organizationId,
    context,
    authUser,
    profiles: written.profiles,
    email,
    link,
    locale,
  })
}

/** Les attentes du meme lien, ajoutees par la personne connectee. */
const sameLinkRows = async (
  target: MemberProfileEmailRow,
  userId: string
): Promise<MemberProfileEmailRow[]> => {
  if (!target.confirmationTokenHash) return [target]
  const rows = await getMemberProfileEmailsByTokenHashDao(
    target.confirmationTokenHash
  )
  const mine = rows.filter((row) => row.addedByUserId === userId)
  return mine.length > 0 ? (mine as MemberProfileEmailRow[]) : [target]
}

/**
 * Corrige une attente dont la personne connectee est l'autrice : nouvelle
 * adresse, nouveau jeton (l'ancien lien ne sert plus), nouveau lien. Les
 * attentes echues sont purgees d'abord : une adresse echue sur la fiche ne
 * bute plus sur l'index unique (revue m4).
 */
export const correctMyPendingEmailService = async (
  input: CorrectMyPendingEmailInput
): Promise<MyEmailWriteResult> => {
  const {organizationId, email, emailId, locale} = parseOrThrow(
    myEmailTargetServiceSchema,
    input
  )
  const authUser = await requireMember()
  const context = await readAssociation(organizationId)
  const now = new Date()
  const link = newPendingLink(now, context.confirmationDays)

  const written = await withTenant(organizationId, async () => {
    await purgeExpiredPendingEmailsDao(organizationId, now)
    const mine = await loadMine(organizationId, authUser.id, now)
    const target = await requireMine(emailId, mine, (row) =>
      canMemberManagePending(row, authUser.id, now)
    )
    const rows = await sameLinkRows(target, authUser.id)
    const refusal = await additionRefusalOf(
      organizationId,
      email,
      mine,
      rows.map((row) => row.id),
      now
    )
    if (refusal) return {status: refusal} as const

    for (const row of rows) {
      await updateMemberProfileEmailDao(row.id, {
        email,
        confirmationTokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
      })
    }
    return {status: 'written', profiles: mine.profiles} as const
  })
  if (written.status !== 'written') return written

  return sendLink({
    organizationId,
    context,
    authUser,
    profiles: written.profiles,
    email,
    link,
    locale,
  })
}

/** Annule une attente dont la personne connectee est l'autrice. */
export const cancelMyPendingEmailService = async (
  input: CancelMyPendingEmailInput
): Promise<CancelMyPendingEmailResult> => {
  const {organizationId, emailId} = parseOrThrow(
    cancelMyPendingEmailServiceSchema,
    input
  )
  const authUser = await requireMember()
  const now = new Date()

  return withTenant(organizationId, async () => {
    const mine = await loadMine(organizationId, authUser.id, now)
    const target = await requireMine(emailId, mine, (row) =>
      canMemberManagePending(row, authUser.id, now)
    )
    for (const row of await sameLinkRows(target, authUser.id)) {
      await deleteMemberProfileEmailDao(row.id)
    }
    return {status: 'cancelled'}
  })
}
