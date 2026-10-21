import 'server-only'

import {
  getUnlinkedMemberProfilesWithEmailDao,
  setMemberProfileUserIdDao,
} from '@/db/repositories/member-profile-repository'
import {
  createMemberIfAbsentTxnDao,
  deleteMemberWithRoleDao,
  getUserOrganizationDao,
  updateMemberRoleFromDao,
} from '@/db/repositories/organization-repository'
import {
  createUserIfAbsentTxnDao,
  getUserByEmailDao,
} from '@/db/repositories/user-repository'
import {withTenant} from '@/db/tenant-scope'

import {
  MemberAccountDecision,
  MemberAccountRole,
  MemberAccountRoleConst,
} from './types/domain/member-account-types'
import {MemberAccountChange} from './types/domain/member-profile-types'

/**
 * Ouverture et fermeture du compte d'une fiche (s12d, ADR 037). Capacite
 * creee une fois, reutilisee par s13 (import), s15 (invitation) et s42
 * (lancement).
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
 * jamais abaisse.
 */
const ensureMembership = async (
  organizationId: string,
  userId: string,
  role: MemberAccountRole
): Promise<void> => {
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
  }
}

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
    await createMemberIfAbsentTxnDao({
      organizationId,
      userId,
      role: MemberAccountRoleConst.MEMBER,
      createdAt: new Date(),
    })
    await setMemberProfileUserIdDao(memberProfileId, userId)
    return {userId}
  })

/**
 * Ferme le compte d'une fiche : retire la ligne `member` de cette
 * association seulement si son role est `member`, puis vide le lien.
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
    await deleteMemberWithRoleDao(
      userId,
      organizationId,
      MemberAccountRoleConst.MEMBER
    )
    await setMemberProfileUserIdDao(memberProfileId, null)
  })

/**
 * L'adresse d'une fiche change : l'ancien acces se ferme, un acces s'ouvre
 * sur la nouvelle adresse. Pour le bureau et la presidence, le role suit la
 * nouvelle adresse.
 */
export const replaceMemberAccount = async ({
  organizationId,
  memberProfileId,
  previousUserId,
  email,
  name,
  role,
}: OpenMemberAccountInput & {
  previousUserId: string
  role: MemberAccountRole
}): Promise<{userId: string}> =>
  withTenant(organizationId, async () => {
    const userId = await findOrCreateUserId(normalizedEmail(email), name)
    await ensureMembership(organizationId, userId, role)
    if (userId !== previousUserId) {
      await deleteMemberWithRoleDao(previousUserId, organizationId, role)
    }
    await setMemberProfileUserIdDao(memberProfileId, userId)
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
  profile,
  decision,
}: {
  organizationId: string
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
  if (decision.kind === 'close' && profile.userId !== null) {
    await closeMemberAccount({...base, userId: profile.userId})
    return {change: 'closed', userId: null}
  }
  if (decision.kind === 'unlink' && profile.userId !== null) {
    await unlinkMemberAccount({organizationId, memberProfileId: profile.id})
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
      role: decision.role,
    })
    return {change: 'replaced', userId}
  }
  return {change: null, userId: profile.userId}
}

/**
 * Reprise en lot (critere 2) : ouvre le compte de chaque fiche a adresse qui
 * n'en a pas encore. Idempotente : une fiche liee n'est plus relue, relancer
 * ne cree rien de plus. Pour le seed et l'import de s13.
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
 * Delie une fiche dont le compte n'a plus de ligne `member` ici : vide le
 * lien seulement, aucune ligne `member` n'est retiree.
 */
export const unlinkMemberAccount = async ({
  organizationId,
  memberProfileId,
}: {
  organizationId: string
  memberProfileId: string
}): Promise<void> =>
  withTenant(organizationId, async () => {
    await setMemberProfileUserIdDao(memberProfileId, null)
  })
