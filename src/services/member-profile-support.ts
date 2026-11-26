import 'server-only'

import {getInvitationStatesByUserIdsDao} from '@/db/repositories/member-invitation-state-repository'
import {
  deleteMemberProfileEmailDao,
  getMemberProfileEmailsDao,
  MemberProfileEmailRow,
  updateMemberProfileEmailDao,
} from '@/db/repositories/member-profile-email-repository'
import {
  countLinkedProfilesDao,
  getLinkedAccountsDao,
  getMemberProfilesByEmailDao,
  LinkedAccountRow,
  MemberProfileReadRow,
  MyMemberProfileRow,
} from '@/db/repositories/member-profile-repository'
import {getMemberAccountDao} from '@/db/repositories/organization-repository'

import {getActingContext, getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {canReadMemberAccount} from './authorization/member-account-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {
  applyMemberAccountDecision,
  getMyMemberProfiles,
  replaceMemberAccount,
} from './member-account-service'
import {readProfileAccess} from './member-profile-access-service'
import {sameEmail} from './rules/member-account-rules'
import {
  planReplacementConfirmation,
  visibleEmails,
} from './rules/member-email-rules'
import {invitationStateOf} from './rules/member-invitation-rules'
import {accessWindowOf} from './rules/member-profile-access-rules'
import {toMemberProfileDto} from './rules/member-profile-rules'
import {roleCardFor} from './rules/member-role-rules'
import {orderMyProfiles} from './rules/my-profiles-order-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {RoleConst} from './types/domain/auth-types'
import {effectiveAuthor} from './types/domain/impersonation-types'
import {
  MemberAccountAuthor,
  MemberAccountRole,
} from './types/domain/member-account-types'
import {
  MemberEmailRecord,
  MemberEmailStatusConst,
} from './types/domain/member-email-types'
import {
  MemberAccountHolderDTO,
  MemberAccountProfileDTO,
  MemberInvitationStateDTO,
  MemberProfileAccountDTO,
  MemberProfileDTO,
  MemberProfileEmailDTO,
} from './types/domain/member-profile-types'
import {User} from './types/domain/user-types'

/**
 * Lectures et gardes partagees par les services du bureau sur les fiches
 * (s12) et sur leurs adresses (s54, ADR 056). Module interne : ni facade ni
 * intercepteur, appele par `member-profile-service` et
 * `member-profile-email-service` seulement, sous leurs gardes.
 */

export const MANAGE_DENIED =
  "Seul le bureau de l'association peut gérer les fiches des propriétaires"

export const requireMemberProfileManager = async (
  organizationId: string
): Promise<User | undefined> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(
      authUser,
      organizationId,
      ActionIdConst.MEMBER_PROFILE_MANAGE
    )
  ) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  return authUser
}

export const sortParcelNumbers = (numbers: string[]): string[] =>
  [...numbers].sort((a, b) => a.localeCompare(b, 'fr', {numeric: true}))

/** Une fiche d'un compte, telle que le bureau la lit (s53). */
export const toAccountProfile = (
  profile: MyMemberProfileRow
): MemberAccountProfileDTO => ({
  id: profile.id,
  name: profile.name,
  parcelNumbers: sortParcelNumbers(profile.currentParcelNumbers),
})

/**
 * Auteur d'un changement de compte, copie dans la trace des roles (D5) : le
 * SuperAdmin s'il agit a la place du compte vu (s48, ADR 041). A lire avant
 * `withTenant` : la session passe par le pool, que le scope retient.
 */
export const authorOf = async (
  authUser: User | undefined
): Promise<MemberAccountAuthor> => {
  if (!authUser) return {userId: null, name: null}
  const author = effectiveAuthor(
    authUser,
    (await getActingContext())?.impersonator
  )
  return {
    userId: author.authorUserId,
    name: author.authorName,
    onBehalfOfUserId: author.onBehalfOfUserId,
    onBehalfOfName: author.onBehalfOfName,
  }
}

/**
 * Le compte de l'association qui porte deja cette adresse par une autre fiche
 * (s53, ADR 054 §4), lu dans la transaction de l'ecriture ; rien si aucune
 * autre fiche reliee ne la porte, ou si c'est deja un compte de la fiche.
 */
export const findEmailHolder = async (
  organizationId: string,
  email: string | null,
  current: {memberProfileId: string | null; userIds: string[]}
): Promise<MemberAccountHolderDTO | undefined> => {
  if (email === null) return undefined

  const holders = orderMyProfiles(
    (await getMemberProfilesByEmailDao(organizationId, email)).filter(
      (profile) =>
        profile.id !== current.memberProfileId && profile.userId !== null
    )
  )
  const userId = holders[0]?.userId
  if (!userId || current.userIds.includes(userId)) return undefined

  const account = await getMemberAccountDao(userId, organizationId)
  const profiles = await getMyMemberProfiles(organizationId, userId)
  return {
    userId,
    name: account?.name ?? holders[0].name,
    profiles: profiles.map(toAccountProfile),
  }
}

/**
 * Le compte detenteur que l'ecriture peut rejoindre : celui que le bureau a
 * confirme, s'il est encore le detenteur ; sinon il faut redemander.
 */
export const confirmedHolder = (
  holder: MemberAccountHolderDTO | undefined,
  confirmedAccountUserId: string | undefined
): {kind: 'none'} | {kind: 'confirmed'; userId: string} | {kind: 'ask'} => {
  if (!holder) return {kind: 'none'}
  if (holder.userId === confirmedAccountUserId) {
    return {kind: 'confirmed', userId: holder.userId}
  }
  return {kind: 'ask'}
}

/** Nombre d'autres fiches reliees a ce compte (ADR 054 §5). */
export const otherLinkedProfilesOf = async (
  organizationId: string,
  userId: string | null
): Promise<number> =>
  userId === null
    ? 0
    : Math.max(0, (await countLinkedProfilesDao(organizationId, userId)) - 1)

/** Le compte relie a la fiche pour cette adresse, ou rien. */
export const accountOfEmail = (
  accounts: readonly LinkedAccountRow[],
  email: string
): LinkedAccountRow | undefined =>
  accounts.find((account) => sameEmail(account.email, email))

/** Une ligne d'adresse, lue par les regles pures. */
export const toEmailRecord = (
  row: MemberProfileEmailRow
): MemberEmailRecord => ({
  id: row.id,
  email: row.email,
  role: row.role,
  status: row.status,
  addedByUserId: row.addedByUserId,
  replacesEmailId: row.replacesEmailId,
  expiresAt: row.expiresAt,
})

/** Les adresses visibles d'une fiche : une attente echue est ignoree. */
export const readProfileEmails = async (
  memberProfileId: string,
  now: Date
): Promise<MemberProfileEmailRow[]> =>
  visibleEmails(await getMemberProfileEmailsDao([memberProfileId]), now)

type AccountView = {
  boardRole: 'board' | 'owner' | null
  role: MemberAccountRole | null
  loginEmail: string
  accountName: string
  otherProfiles: MemberAccountProfileDTO[]
}

/** Le compte d'une adresse active : role au bureau et autres fiches. */
const readAccountView = async (
  organizationId: string,
  memberProfileId: string,
  account: LinkedAccountRow | undefined
): Promise<AccountView | undefined> => {
  if (!account) return undefined
  const membership = await getMemberAccountDao(account.userId, organizationId)
  if (!membership) return undefined
  const profiles = await getMyMemberProfiles(organizationId, account.userId)
  return {
    boardRole: membership.role === 'member' ? null : membership.role,
    role: membership.role,
    loginEmail: membership.email,
    accountName: membership.name,
    otherProfiles: profiles
      .filter((profile) => profile.id !== memberProfileId)
      .map(toAccountProfile),
  }
}

const toEmailDto = (
  row: MemberProfileEmailRow,
  view: AccountView | undefined,
  invitation: MemberInvitationStateDTO | null
): MemberProfileEmailDTO => ({
  id: row.id,
  email: row.email,
  role: row.role,
  status: row.status,
  origin: row.origin,
  addedByName: row.addedByName,
  expiresAt: row.expiresAt?.toISOString() ?? null,
  replacesEmailId: row.replacesEmailId,
  boardRole: view?.boardRole ?? null,
  otherProfiles: view?.otherProfiles ?? [],
  invitation,
})

const toAccountDto = (
  view: AccountView | undefined
): MemberProfileAccountDTO =>
  view
    ? {
        status: 'open',
        loginEmail: view.loginEmail,
        boardRole: view.boardRole,
        accountName: view.accountName,
        otherProfiles: view.otherProfiles,
      }
    : {status: 'mail_only'}

/**
 * L'etat de l'invitation de chaque adresse **active** (s42a), par le compte
 * qui la porte et sur cette association : une adresse portee par deux fiches
 * a le meme etat sur chacune. Une adresse en attente n'en a pas.
 */
const readInvitationStates = async (
  organizationId: string,
  emails: readonly MemberProfileEmailRow[],
  accounts: readonly LinkedAccountRow[]
): Promise<Map<string, MemberInvitationStateDTO>> => {
  const active = emails
    .filter((email) => email.status === 'active')
    .map((email) => ({
      emailId: email.id,
      userId: accountOfEmail(accounts, email.email)?.userId,
    }))
  const userIds = active.flatMap(({userId}) => (userId ? [userId] : []))
  const traces = new Map(
    (await getInvitationStatesByUserIdsDao(organizationId, userIds)).map(
      (row) => [row.userId, row]
    )
  )
  return new Map(
    active.map(({emailId, userId}) => [
      emailId,
      invitationStateOf(userId ? traces.get(userId) : undefined),
    ])
  )
}

/**
 * La fiche, ses adresses avec le compte de chacune, l'etat du compte de la
 * titulaire, la fin d'acces apres la vente (s57) et sa carte de role, pour
 * l'ecran du bureau. Lecture de
 * l'appartenance de tiers, sous son `can*` (ADR 014). `isSelf` vaut pour
 * **tous** les comptes de la fiche (s54).
 */
export const readProfileView = async (
  authUser: User | undefined,
  organizationId: string,
  row: MemberProfileReadRow,
  now: Date
): Promise<MemberProfileDTO> => {
  if (!canReadMemberAccount(authUser, organizationId)) {
    throw new AuthorizationError(MANAGE_DENIED)
  }
  const emails = await readProfileEmails(row.id, now)
  const accounts = await getLinkedAccountsDao(row.id)
  const views = new Map<string, AccountView | undefined>()
  for (const email of emails) {
    if (email.status !== 'active') continue
    views.set(
      email.id,
      await readAccountView(
        organizationId,
        row.id,
        accountOfEmail(accounts, email.email)
      )
    )
  }
  const invitations = await readInvitationStates(
    organizationId,
    emails,
    accounts
  )
  const holder = emails.find(
    (email) => email.status === 'active' && email.role === 'holder'
  )
  const holderView = holder ? views.get(holder.id) : undefined
  const access = await readProfileAccess(organizationId, row.id, now)
  return {
    ...toMemberProfileDto(row),
    pennylaneCustomerId: row.pennylaneCustomerId,
    emails: emails.map((email) =>
      toEmailDto(email, views.get(email.id), invitations.get(email.id) ?? null)
    ),
    account: toAccountDto(holderView),
    accessWindow: accessWindowOf(access),
    roleCard: roleCardFor(
      {
        role:
          authUser?.organizations?.find(
            (membership) => membership.organizationId === organizationId
          )?.role ?? null,
        isSuperAdmin: authUser?.role === RoleConst.SUPER_ADMIN,
        isSelf:
          authUser !== undefined &&
          accounts.some((account) => account.userId === authUser.id),
      },
      {role: holderView?.role ?? null}
    ),
  }
}

/**
 * Active une adresse en attente d'une fiche (s54, ADR 056 §5) : confirmation
 * par lien, ou modification par le bureau qui l'active d'office. Une
 * modification prend le role de l'adresse qu'elle remplace (titre transmis),
 * retire celle-ci et deplace son compte (chemin `replaceMemberAccount`, role
 * du bureau selon l'ADR 054 §6) ; un ajout suit la regle d'une nouvelle
 * adresse active. Sous le `withTenant` de l'appelant, apres ses gardes.
 *
 * Une valeur changee a l'activation n'herite pas d'un refus des envois
 * (ADR 057).
 *
 * Le lien de l'adresse remplacee est **d'abord** retire de l'attente : sa FK
 * `replaces_email_id` est en `CASCADE`, supprimer l'adresse remplacee
 * emporterait l'attente avec elle.
 */
export const activatePendingEmail = async ({
  organizationId,
  profile,
  pendingId,
  email,
  author,
  confirmedHolderUserId,
  now,
}: {
  organizationId: string
  profile: {id: string; name: string}
  pendingId: string
  email: string
  author: MemberAccountAuthor
  confirmedHolderUserId?: string
  now: Date
}): Promise<void> => {
  const emails = await readProfileEmails(profile.id, now)
  const pending = emails.find((row) => row.id === pendingId)
  const plan = planReplacementConfirmation(emails, pendingId)
  const replaced = emails.find((row) => row.id === plan.removeEmailId)
  const accounts = await getLinkedAccountsDao(profile.id)
  const previous = replaced
    ? accountOfEmail(accounts, replaced.email)
    : undefined

  await updateMemberProfileEmailDao(pendingId, {replacesEmailId: null})
  if (replaced) await deleteMemberProfileEmailDao(replaced.id)
  await updateMemberProfileEmailDao(pendingId, {
    email,
    role: plan.role,
    status: MemberEmailStatusConst.ACTIVE,
    confirmationTokenHash: null,
    expiresAt: null,
    ...(pending && !sameEmail(pending.email, email)
      ? {unsubscribedAt: null}
      : {}),
  })

  const base = {organizationId, memberProfileId: profile.id, name: profile.name}
  if (previous) {
    await replaceMemberAccount({
      ...base,
      email,
      previousUserId: previous.userId,
      author,
      targetUserId: confirmedHolderUserId,
    })
    return
  }
  await applyMemberAccountDecision({
    organizationId,
    author,
    profile: {id: profile.id, name: profile.name, email, userId: null},
    decision: confirmedHolderUserId
      ? {kind: 'link_shared', userId: confirmedHolderUserId}
      : {kind: 'open'},
  })
}
