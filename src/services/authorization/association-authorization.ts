import {
  RoleConst,
  UserOrganizationRoleConst,
} from '@/services/types/domain/auth-types'
import {User} from '@/services/types/domain/user-types'

const BOARD_ROLES: string[] = [
  UserOrganizationRoleConst.OWNER,
  UserOrganizationRoleConst.ADMIN,
]

/**
 * Gerer une association — son identite (s01b, critere 8) et ses parametres
 * (s02, critere 7) : le SuperAdmin, ou le bureau de **cette** association —
 * Bureau (`admin`) et President(e) (`owner`). Point d'accroche unique pour le
 * registre des permissions de s03.
 *
 * Volontairement hors CASL : l'`admin` global y gere toutes les organisations,
 * et la story l'exclut.
 */
export const canManageAssociation = (
  user: User | undefined,
  organizationId: string
): boolean => {
  if (!user) return false
  if (user.role === RoleConst.SUPER_ADMIN) return true

  return (user.organizations ?? []).some(
    (membership) =>
      membership.organizationId === organizationId &&
      BOARD_ROLES.includes(membership.role)
  )
}

/**
 * Les pages d'arrivee apres connexion. Chacune est une **page finale** : ni
 * Route Handler, ni source d'une redirection de `next.config.ts`. Une Server
 * Action qui redirige vers une adresse qui redirige encore laisse la barre
 * d'adresse sur cette adresse (revue M1 de s46b ; garde :
 * `post-login-paths.test.ts`). D'ou `/bureau/pages`, pas `/bureau`.
 */
export const POST_LOGIN_PATHS = [
  '/admin',
  '/bureau/pages',
  '/dashboard',
] as const

export type PostLoginPath = (typeof POST_LOGIN_PATHS)[number]

/**
 * Ou arrive un compte apres sa connexion (s46b) : le SuperAdmin au back-office
 * de la plateforme, meme avec un role dans l'association ; le bureau et la
 * Presidence de l'association du domaine au back-office de l'association ;
 * tout autre compte a l'espace membre. Le role global `admin` n'est pas
 * SuperAdmin : il suit son role dans l'association.
 */
export const postLoginPathOf = (
  user: User,
  organizationId: string | undefined
): PostLoginPath => {
  if (user.role === RoleConst.SUPER_ADMIN) return '/admin'
  if (organizationId && canManageAssociation(user, organizationId)) {
    return '/bureau/pages'
  }
  return '/dashboard'
}
