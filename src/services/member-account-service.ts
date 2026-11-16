import 'server-only'

import {deletePendingEmailsAddedByDao} from '@/db/repositories/member-profile-email-repository'
import {
  countLinkedProfilesDao,
  getMemberProfilesByUserIdDao,
  getUnlinkedMemberProfilesWithEmailDao,
  linkMemberProfileAccountDao,
  MyMemberProfileRow,
  unlinkMemberProfileAccountDao,
} from '@/db/repositories/member-profile-repository'
import {insertMemberRoleEventDao} from '@/db/repositories/member-role-event-repository'
import {
  createMemberIfAbsentTxnDao,
  deleteMemberWithRoleDao,
  getUserOrganizationDao,
  lockOrganizationRolesDao,
  updateMemberRoleFromDao,
} from '@/db/repositories/organization-repository'
import {
  createUserIfAbsentTxnDao,
  getUserByEmailDao,
} from '@/db/repositories/user-repository'
import {withTenant} from '@/db/tenant-scope'

import {orderMyProfiles} from './rules/my-profiles-order-rules'
import {
  MemberAccountAuthor,
  MemberAccountDecision,
  MemberAccountRole,
  MemberAccountRoleConst,
} from './types/domain/member-account-types'
import {MemberAccountChange} from './types/domain/member-profile-types'

/**
 * Ouverture et fermeture du compte d'une fiche (s12d). Capacite creee une
 * fois, reutilisee par s13 (import), s15 (invitation) et s42 (lancement).
 * Depuis s53 (ADR 054, remplace l'ADR 037), le lien vit dans
 * `member_profile_account` : un compte peut porter plusieurs fiches, et sa
 * ligne `member` ne part qu'avec la derniere.
 *
 * Sans facade : appele par d'autres services, dans leur `withTenant` et
 * apres leur controle d'autorisation, jamais par la presentation. Chaque
 * fonction rouvre `withTenant` : dans un scope deja ouvert, la transaction
 * est reutilisee, l'ecriture du compte tient avec celle de la fiche.
 *
 * N'envoie rien, ne supprime jamais un `user`, ne retire jamais une ligne
 * `board` / `owner` a la fermeture. Le compte n'est jamais cree par Better
 * Auth (hook d'inscription, client Stripe) ni par le service des membres
 * d'organisation (plafond du plan).
 */

type OpenMemberAccountInput = {
  organizationId: string
  memberProfileId: string
  email: string
  name: string
}

const normalizedEmail = (email: string): string => email.trim().toLowerCase()

/** Le compte d'une adresse : celui qui existe, sinon un nouveau. */
const findOrCreateUserId = async (
  email: string,
  name: string
): Promise<string> => {
  const known = await getUserByEmailDao(email)
  if (known) return known.id
  const created = await createUserIfAbsentTxnDao({email, name})
  return created.id
}

/**
 * Pose la ligne `member` du compte avec le role voulu. Un compte deja
 * simple membre recoit le role reporte ; un role du bureau en place n'est
 * jamais abaisse. Rend le role du compte avant et apres, pour la trace.
 */
const ensureMembership = async (
  organizationId: string,
  userId: string,
  role: MemberAccountRole
): Promise<{
  before: MemberAccountRole | null
  after: MemberAccountRole
}> => {
  const existing = await getUserOrganizationDao(userId, organizationId)
  const membership = await createMemberIfAbsentTxnDao({
    organizationId,
    userId,
    role,
    createdAt: new Date(),
  })
  if (
    membership.role === MemberAccountRoleConst.MEMBER &&
    role !== MemberAccountRoleConst.MEMBER
  ) {
    await updateMemberRoleFromDao(
      userId,
      organizationId,
      MemberAccountRoleConst.MEMBER,
      role
    )
    return {before: existing?.role ?? null, after: role}
  }
  return {before: existing?.role ?? null, after: membership.role}
}

type EmailChangeTrace = {
  organizationId: string
  memberProfileId: string
  name: string
  author: MemberAccountAuthor
}

/** Une ligne de trace `email_change` (D5, ADR 039). */
const traceEmailChange = async (
  trace: EmailChangeTrace,
  change: {
    userId: string
    from: MemberAccountRole | null
    to: MemberAccountRole | null
  }
): Promise<void> =>
  insertMemberRoleEventDao({
    organizationId: trace.organizationId,
    memberProfileId: trace.memberProfileId,
    targetUserId: change.userId,
    targetName: trace.name,
    authorUserId: trace.author.userId,
    authorName: trace.author.name,
    onBehalfOfUserId: trace.author.onBehalfOfUserId ?? null,
    onBehalfOfName: trace.author.onBehalfOfName ?? null,
    fromRole: change.from,
    toRole: change.to,
    reason: 'email_change',
  })

/**
 * Ouvre le compte d'une fiche : trouve ou cree le `user` par l'adresse en
 * minuscules (nom de la fiche a la creation seulement), pose la ligne
 * `member` si absente (role existant intact), puis lie la fiche.
 */
export const openMemberAccount = async ({
  organizationId,
  memberProfileId,
  email,
  name,
}: OpenMemberAccountInput): Promise<{userId: string}> =>
  withTenant(organizationId, async () => {
    const userId = await findOrCreateUserId(normalizedEmail(email), name)
    await linkToAccount(organizationId, memberProfileId, userId)
    return {userId}
  })

/**
 * Relie une fiche a un compte deja ouvert dans l'association (s53, ADR 054
 * §4) : la ligne `member` est posee si absente (role existant intact), aucun
 * compte n'est cherche ni cree par l'adresse.
 */
const linkToAccount = async (
  organizationId: string,
  memberProfileId: string,
  userId: string
): Promise<void> => {
  await createMemberIfAbsentTxnDao({
    organizationId,
    userId,
    role: MemberAccountRoleConst.MEMBER,
    createdAt: new Date(),
  })
  await linkMemberProfileAccountDao({organizationId, memberProfileId, userId})
}

/**
 * Ferme l'acces d'une adresse a une fiche : retire le lien de **ce** compte a
 * **cette** fiche (s54, critere 10), puis la ligne `member` de cette
 * association **seulement si** plus aucune fiche n'est reliee au compte et
 * que son role est `member` (s53, critere 6).
 */
export const closeMemberAccount = async ({
  organizationId,
  memberProfileId,
  userId,
}: {
  organizationId: string
  memberProfileId: string
  userId: string
}): Promise<void> =>
  withTenant(organizationId, async () => {
    await unlinkProfileAccount(memberProfileId, userId)
    if ((await countLinkedProfilesDao(organizationId, userId)) > 0) return
    await deleteMemberWithRoleDao(
      userId,
      organizationId,
      MemberAccountRoleConst.MEMBER
    )
  })

/**
 * Une adresse d'une fiche change (s54 : par adresse, les autres comptes de la
 * fiche ne bougent pas) : la fiche quitte l'ancien compte et rejoint
 * celui de la nouvelle adresse (`targetUserId` quand le bureau a confirme un
 * compte deja ouvert, s53). Si la fiche etait la **derniere** de l'ancien
 * compte, son acces se ferme et, pour le bureau et la presidence, le role
 * suit la nouvelle adresse, deplacement trace (D5, ADR 039) ; sinon l'ancien
 * compte garde son role et ses autres fiches, la nouvelle adresse ouvre un
 * acces de simple membre (ADR 054 §6). Le verrou des roles est pris d'abord,
 * comme pour tout changement de role, puis le role de l'ancien compte est
 * relu sous ce verrou : un role lu avant par l'appelant pourrait annuler une
 * retrogradation concurrente. Un ancien compte sans ligne ici ne deplace
 * rien. Le depart de l'ancien compte n'est trace que si sa ligne a bien ete
 * retiree.
 */
export const replaceMemberAccount = async ({
  organizationId,
  memberProfileId,
  previousUserId,
  email,
  name,
  author,
  targetUserId,
}: OpenMemberAccountInput & {
  previousUserId: string
  author: MemberAccountAuthor
  targetUserId?: string
}): Promise<{userId: string}> =>
  withTenant(organizationId, async () => {
    await lockOrganizationRolesDao(organizationId)
    const previous = await getUserOrganizationDao(
      previousUserId,
      organizationId
    )
    const userId =
      targetUserId ?? (await findOrCreateUserId(normalizedEmail(email), name))
    await linkMemberProfileAccountDao({organizationId, memberProfileId, userId})
    if (userId !== previousUserId) {
      await unlinkProfileAccount(memberProfileId, previousUserId)
    }
    const lastProfile =
      userId === previousUserId ||
      (await countLinkedProfilesDao(organizationId, previousUserId)) === 0
    const role =
      lastProfile && previous ? previous.role : MemberAccountRoleConst.MEMBER
    const {before, after} = await ensureMembership(organizationId, userId, role)
    const removed =
      previous && lastProfile && userId !== previousUserId
        ? await deleteMemberWithRoleDao(previousUserId, organizationId, role)
        : 0

    if (role !== MemberAccountRoleConst.MEMBER) {
      const trace = {organizationId, memberProfileId, name, author}
      if (before !== after) {
        await traceEmailChange(trace, {userId, from: before, to: after})
      }
      if (removed === 1) {
        await traceEmailChange(trace, {
          userId: previousUserId,
          from: role,
          to: null,
        })
      }
    }
    return {userId}
  })

/** Role, dans l'association, du compte lie a une fiche ; `null` sans compte. */
export const getLinkedAccountRole = async (
  organizationId: string,
  userId: string | null
): Promise<MemberAccountRole | null> => {
  if (userId === null) return null
  const membership = await getUserOrganizationDao(userId, organizationId)
  return membership?.role ?? null
}

/**
 * Applique la decision de `decideMemberAccount` a une fiche deja ecrite. Rend
 * le changement d'acces, pour les messages de l'ecran, et le compte desormais
 * lie a la fiche.
 */
export const applyMemberAccountDecision = async ({
  organizationId,
  author,
  profile,
  decision,
}: {
  organizationId: string
  author: MemberAccountAuthor
  profile: {
    id: string
    name: string
    email: string | null
    userId: string | null
  }
  decision: MemberAccountDecision
}): Promise<{change: MemberAccountChange; userId: string | null}> => {
  const base = {organizationId, memberProfileId: profile.id, name: profile.name}

  if (decision.kind === 'open' && profile.email !== null) {
    const {userId} = await openMemberAccount({...base, email: profile.email})
    return {change: 'opened', userId}
  }
  if (decision.kind === 'link_shared' && profile.email !== null) {
    const userId = await joinSharedAccount({
      ...base,
      email: profile.email,
      previousUserId: profile.userId,
      targetUserId: decision.userId,
      author,
    })
    return {change: 'linked', userId}
  }
  if (decision.kind === 'close' && profile.userId !== null) {
    await closeMemberAccount({...base, userId: profile.userId})
    return {change: 'closed', userId: null}
  }
  if (decision.kind === 'unlink' && profile.userId !== null) {
    await unlinkMemberAccount({
      organizationId,
      memberProfileId: profile.id,
      userId: profile.userId,
    })
    return {change: null, userId: null}
  }
  if (
    decision.kind === 'replace' &&
    profile.email !== null &&
    profile.userId !== null
  ) {
    const {userId} = await replaceMemberAccount({
      ...base,
      email: profile.email,
      previousUserId: profile.userId,
      author,
    })
    return {change: 'replaced', userId}
  }
  return {change: null, userId: profile.userId}
}

/**
 * Reprise en lot (critere 2) : ouvre le compte de chaque adresse active dont
 * le compte n'est pas encore relie a sa fiche (s54, ADR 056 §3).
 * Idempotente : une adresse liee n'est plus relue, relancer ne cree rien de
 * plus. Pour le seed et l'import de s13.
 */
export const openMemberAccountsForOrganization = async (
  organizationId: string
): Promise<{opened: number}> =>
  withTenant(organizationId, async () => {
    const profiles = await getUnlinkedMemberProfilesWithEmailDao(organizationId)
    for (const profile of profiles) {
      await openMemberAccount({
        organizationId,
        memberProfileId: profile.id,
        email: profile.email,
        name: profile.name,
      })
    }
    return {opened: profiles.length}
  })

/**
 * Delie d'une fiche un compte qui n'a plus de ligne `member` ici : retire ce
 * lien seulement, aucune ligne `member` n'est retiree.
 */
export const unlinkMemberAccount = async ({
  organizationId,
  memberProfileId,
  userId,
}: {
  organizationId: string
  memberProfileId: string
  userId: string
}): Promise<void> =>
  withTenant(organizationId, async () => {
    await unlinkProfileAccount(memberProfileId, userId)
  })

/**
 * La fiche rejoint le compte qui porte deja son adresse (s53, ADR 054 §4) :
 * simple lien pour une fiche sans compte, remplacement sinon.
 */
const joinSharedAccount = async ({
  previousUserId,
  targetUserId,
  ...input
}: OpenMemberAccountInput & {
  previousUserId: string | null
  targetUserId: string
  author: MemberAccountAuthor
}): Promise<string> => {
  if (previousUserId === null) {
    await withTenant(input.organizationId, () =>
      linkToAccount(input.organizationId, input.memberProfileId, targetUserId)
    )
    return targetUserId
  }
  const {userId} = await replaceMemberAccount({
    ...input,
    previousUserId,
    targetUserId,
  })
  return userId
}

/**
 * Les fiches de l'association reliees a ce compte, dans l'ordre de l'ADR 054
 * §7 : « mes fiches », resolues depuis la session, jamais depuis un
 * identifiant venu du navigateur. Sous le scope du tenant ; pour les services
 * de l'espace membre, apres leur controle d'autorisation.
 */
export const getMyMemberProfiles = async (
  organizationId: string,
  userId: string
): Promise<MyMemberProfileRow[]> =>
  withTenant(organizationId, async () =>
    orderMyProfiles(await getMemberProfilesByUserIdDao(organizationId, userId))
  )

/** La premiere fiche du compte dans l'ordre de l'ADR 054 §7, ou rien. */
export const getFirstMemberProfile = async (
  organizationId: string,
  userId: string
): Promise<MyMemberProfileRow | undefined> =>
  (await getMyMemberProfiles(organizationId, userId))[0]

/**
 * Delie un compte d'une fiche. Les adresses en attente que ce compte y avait
 * ajoutees partent avec le lien : un auteur qui n'a plus acces a la fiche ne
 * peut plus y faire activer d'adresse (revue s54, C1 ; ADR 056 §5).
 */
const unlinkProfileAccount = async (
  memberProfileId: string,
  userId: string
): Promise<void> => {
  await unlinkMemberProfileAccountDao(memberProfileId, userId)
  await deletePendingEmailsAddedByDao(memberProfileId, userId)
}
