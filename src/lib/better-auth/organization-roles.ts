import {createAccessControl} from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access'

/**
 * Roles d'association declares au plugin `organization` de Better Auth (s03b).
 *
 * Les permissions sont celles de la bibliotheque, reprises telles quelles sous
 * la cle du produit : le Bureau (`board`) herite du role `admin` de Better
 * Auth, sans rapport avec le role **global** `admin` de la plateforme.
 *
 * Module partage par le serveur (`auth.ts`) et le client (`auth-client.ts`) :
 * un dephasage entre les deux casserait silencieusement les permissions lues
 * cote navigateur. La presidence garde la cle `owner`, qui est aussi le
 * `creatorRole` par defaut du plugin.
 *
 * Le controle d'acces est reconstruit a partir des enonces par defaut du
 * plugin plutot que d'en reutiliser l'instance `defaultAc` : cette instance,
 * typee sur des tuples figes, n'est pas assignable a l'option `ac`.
 */
export const organizationAccessControl = createAccessControl({
  ...defaultStatements,
})

export const organizationRoles = {
  board: adminAc,
  owner: ownerAc,
  member: memberAc,
} as const
