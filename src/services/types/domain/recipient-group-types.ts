import type {CampaignTargetCountsDTO} from './campaign-types'

/**
 * Groupes de destinataires des campagnes (s27, ADR 060 §4). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`).
 */

/**
 * Longueur maximale d'un nom de groupe : un garde-fou de saisie, pas un
 * parametre (sur le precedent de `MEMBER_INVOICE_STATUS_MAX_LENGTH`).
 */
export const RECIPIENT_GROUP_NAME_MAX_LENGTH = 80

/** Un groupe, tel que le bureau le liste. */
export type RecipientGroupDTO = {
  id: string
  name: string
  /** Nombre de fiches du groupe. */
  profileCount: number
}

/** Un groupe ouvert : sa composition, comptee comme la cible (critere 5). */
export type RecipientGroupDetailDTO = RecipientGroupDTO & {
  counts: CampaignTargetCountsDTO
}

export type RecipientGroupScopeInput = {
  organizationId: string
  groupId: string
}

export type CreateRecipientGroupInput = {
  organizationId: string
  name: string
}

export type RenameRecipientGroupInput = RecipientGroupScopeInput & {
  name: string
}

export type RecipientGroupMembersInput = RecipientGroupScopeInput & {
  memberProfileIds: string[]
}

/** Le resultat d'un ajout ou d'un retrait : le groupe tel qu'il est apres. */
export type RecipientGroupMembersResult = {
  group: RecipientGroupDTO
  /** Fiches reellement ajoutees ou retirees (un ajout est idempotent). */
  changed: number
}

/** Ce que la barre de selection de la liste des proprietaires recoit (s27). */
export type RecipientGroupSelectionActionResult =
  | {
      status: 'saved'
      groupId: string
      groupName: string
      changed: number
      profileCount: number
    }
  | {status: 'error'; message: string}

/** Ce que le dialogue « Nom du groupe » recoit (creer, renommer). */
export type RecipientGroupNameActionResult =
  | {status: 'saved'; group: RecipientGroupDTO}
  | {status: 'invalid'; message: string}
  | {status: 'error'; message: string}

/** Ce que la confirmation « Supprimer le groupe » recoit. */
export type DeleteRecipientGroupActionResult =
  {status: 'deleted'} | {status: 'error'; message: string}
