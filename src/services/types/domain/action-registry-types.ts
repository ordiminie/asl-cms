import {OrganizationRole} from './organization-types'

/**
 * Registre des actions soumises a autorisation (ADR 018, s03b).
 *
 * Module de code isomorphe, sans table ni ecran : declarer une action, c'est
 * ajouter une entree ici avec les roles d'association qui l'executent par
 * defaut. La table de surcharge par tenant reste le probleme de s37 — ce
 * registre en restera le defaut le jour ou elle existe.
 *
 * `isActionAllowedForRole` est parametree par le registre (meme patron que
 * `resolveSettings` pour `ASSOCIATION_SETTINGS_REGISTRY`) : un test lui passe
 * un registre ad hoc sans toucher au registre de production.
 */
export type ActionDefinition = {
  id: string
  defaultRoles: readonly OrganizationRole[]
}

export type ActionRegistry = readonly ActionDefinition[]

/**
 * Un `actionId` absent du registre est refuse — defaut ferme, jamais un acces
 * implicite.
 */
export const isActionAllowedForRole = (
  registry: ActionRegistry,
  actionId: string,
  role: OrganizationRole
): boolean => {
  const definition = registry.find((action) => action.id === actionId)
  if (!definition) return false

  return definition.defaultRoles.includes(role)
}

/**
 * Actions declarees par les stories anterieures a s03b (critere 4) : le logo
 * et le favicon de l'association (s01b), ses parametres (s02). Les deux
 * partagent les memes roles par defaut — Bureau et Presidente — donc une
 * seule entree pour l'identite visuelle, sans distinguer logo et favicon.
 */
export const ActionIdConst = {
  ASSOCIATION_IDENTITY_UPDATE: 'association.identity.update',
  ASSOCIATION_SETTINGS_UPDATE: 'association.settings.update',
  /**
   * Gerer une page du site (s04) : creer, modifier, publier, depublier. Une
   * seule entree pour les quatre verbes, comme `ASSOCIATION_IDENTITY_UPDATE`
   * couvre logo et favicon — rien dans les criteres de s04 ne distingue les
   * roles entre ces verbes.
   */
  PAGE_MANAGE: 'page.manage',
  /**
   * Gerer la navigation du site (s04b, ADR 021) : composer le menu — ajouter,
   * retirer, reordonner, basculer la visibilite d'une entree — et modifier le
   * pied de page. Une seule entree pour les deux : rien dans les criteres de
   * s04b ne distingue les roles entre le menu et le pied de page.
   */
  SITE_NAVIGATION_MANAGE: 'site.navigation.manage',
  /**
   * Gerer les actualites (s05, ADR 023) : creer, modifier, publier, depublier,
   * deposer l'image. Une seule entree pour tous les verbes, sur le precedent de
   * `PAGE_MANAGE`.
   */
  NEWS_MANAGE: 'news.manage',
  /**
   * Gerer les fiches du bureau (s06) : creer, modifier, reordonner, supprimer.
   * Une seule entree pour les quatre verbes, sur le precedent de `PAGE_MANAGE`.
   * A ne pas confondre avec le role d'organisation `board` : cette action dit
   * **qui** peut editer les fiches, pas ce qu'une fiche represente.
   */
  BOARD_MEMBER_MANAGE: 'board.member.manage',
  /**
   * Gerer le bandeau d'alerte (s07) : l'afficher, modifier son message, le
   * retirer. Une seule entree pour les trois verbes : le critere 4 dit
   * « n'importe quel membre du bureau, sans restriction supplementaire ».
   */
  SITE_ALERT_MANAGE: 'site.alert.manage',
  /**
   * Consulter les messages recus depuis la page Contact (s08, ADR 025) et
   * basculer leur temoin lu / non lu. Le nom dit ce qu'il accorde : le bureau
   * ne cree, ne modifie ni ne supprime aucun message.
   */
  CONTACT_MESSAGE_READ: 'contact.message.read',
} as const

export const ACTION_REGISTRY: ActionRegistry = [
  {
    id: ActionIdConst.ASSOCIATION_IDENTITY_UPDATE,
    defaultRoles: ['owner', 'board'],
  },
  {
    id: ActionIdConst.ASSOCIATION_SETTINGS_UPDATE,
    defaultRoles: ['owner', 'board'],
  },
  {
    id: ActionIdConst.PAGE_MANAGE,
    defaultRoles: ['owner', 'board'],
  },
  {
    id: ActionIdConst.SITE_NAVIGATION_MANAGE,
    defaultRoles: ['owner', 'board'],
  },
  {
    id: ActionIdConst.NEWS_MANAGE,
    defaultRoles: ['owner', 'board'],
  },
  {
    id: ActionIdConst.BOARD_MEMBER_MANAGE,
    defaultRoles: ['owner', 'board'],
  },
  {
    id: ActionIdConst.SITE_ALERT_MANAGE,
    defaultRoles: ['owner', 'board'],
  },
  {
    id: ActionIdConst.CONTACT_MESSAGE_READ,
    defaultRoles: ['owner', 'board'],
  },
]
