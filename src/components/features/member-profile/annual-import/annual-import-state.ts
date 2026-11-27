import type {AnnualImportReportDTO} from '@/services/types/domain/member-annual-import-types'

export type MemberAnnualImportError =
  | 'forbidden'
  | 'invalid_data'
  | 'file_type'
  | 'file_too_large'
  | 'file_unreadable'
  | 'failed'

/**
 * Resultat de la mise a jour annuelle (s56). Le rapport voyage avec lui et
 * n'est conserve nulle part (ADR 047) : quitter la page le perd.
 */
export type MemberAnnualImportFormState = {
  success: boolean
  error?: MemberAnnualImportError
  /** En cas d'erreur : le titre de l'alerte. */
  title?: string
  /** Ce qui s'est passe. */
  message?: string
  /** La cause, quand elle est connue (colonne manquante, fichier vide…). */
  detail?: string
  /** L'action suivante. */
  nextStep?: string
  report?: AnnualImportReportDTO
  fileName?: string
  /** Fin de la mise a jour, ISO 8601 : l'en-tete du rapport. */
  importedAt?: string
}
