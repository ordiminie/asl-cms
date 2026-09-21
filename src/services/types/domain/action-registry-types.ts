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
]
