import type {ImportReportDTO} from '@/services/types/domain/member-import-types'

export type MemberImportError =
  | 'forbidden'
  | 'invalid_data'
  | 'file_type'
  | 'file_too_large'
  | 'file_unreadable'
  | 'organization_missing'
  | 'failed'

/**
 * Resultat de l'import (s13). Le rapport voyage avec lui et n'est conserve
 * nulle part (ADR 047) : quitter la page le perd.
 */
export type MemberImportFormState = {
  success: boolean
  error?: MemberImportError
  /** En cas d'erreur : le titre de l'alerte. */
  title?: string
  /** Ce qui s'est passe. */
  message?: string
  /** La cause, quand elle est connue (colonne manquante, fichier vide…). */
  detail?: string
  /** L'action suivante. */
  nextStep?: string
  report?: ImportReportDTO
  fileName?: string
  organizationId?: string
  /** Fin de l'import, ISO 8601 : l'en-tete du rapport. */
  importedAt?: string
}

/** Une association proposee au choix : son identifiant et son nom. */
export type MemberImportOrganizationChoice = {id: string; name: string}
