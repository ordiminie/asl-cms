import {z} from 'zod'

import {CONTENT_FILE_MAX_BYTES} from '@/services/types/domain/content-file-types'
import {
  SHARED_DOCUMENT_TITLE_MAX_LENGTH,
  SharedDocumentIssue,
  SharedDocumentIssueConst,
} from '@/services/types/domain/shared-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

/**
 * Formulaire « Deposer un document » (s31, ecran 3). Controles du navigateur
 * avant l'envoi — le serveur revalide tout, signature binaire comprise, et
 * c'est lui qui decide (`SharedDocumentIssueConst`).
 */

export const SHARED_DOCUMENT_PDF_TYPE = 'application/pdf'
export const SHARED_DOCUMENT_MAX_BYTES = CONTENT_FILE_MAX_BYTES.document
/** Le plafond ecrit sous le champ est celui reellement applique. */
export const SHARED_DOCUMENT_MAX_MEGABYTES =
  SHARED_DOCUMENT_MAX_BYTES / (1024 * 1024)

export const SHARED_DOCUMENT_FORM_FIELDS = [
  'title',
  'categoryId',
  'file',
] as const

export type SharedDocumentFormField =
  (typeof SHARED_DOCUMENT_FORM_FIELDS)[number]

/** Le champ du formulaire que chaque refus du serveur designe. */
export const ISSUE_FIELD: Record<SharedDocumentIssue, SharedDocumentFormField> =
  {
    [SharedDocumentIssueConst.TITLE_MISSING]: 'title',
    [SharedDocumentIssueConst.TITLE_TOO_LONG]: 'title',
    [SharedDocumentIssueConst.CATEGORY_MISSING]: 'categoryId',
    [SharedDocumentIssueConst.CATEGORY_UNAVAILABLE]: 'categoryId',
    [SharedDocumentIssueConst.FILE_MISSING]: 'file',
    [SharedDocumentIssueConst.FILE_FORMAT]: 'file',
    [SharedDocumentIssueConst.FILE_SIZE]: 'file',
  }

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

/**
 * Le message d'un refus. Le poids du fichier vient du navigateur : le
 * message du plafond dit combien pese le fichier choisi.
 */
export const issueMessageOf = (
  t: Translate,
  issue: SharedDocumentIssue,
  fileWeight?: string
): string =>
  t(`issues.${issue}`, {
    max: SHARED_DOCUMENT_TITLE_MAX_LENGTH,
    maxSize: SHARED_DOCUMENT_MAX_MEGABYTES,
    weight: fileWeight ?? '',
  })

export const createSharedDocumentFormSchema = (
  t: Translate,
  offeredCategoryIds: readonly string[]
) =>
  z.object({
    title: z
      .string()
      .refine((value) => value.trim().length > 0, {
        message: issueMessageOf(t, SharedDocumentIssueConst.TITLE_MISSING),
      })
      .refine(
        (value) => value.trim().length <= SHARED_DOCUMENT_TITLE_MAX_LENGTH,
        {message: issueMessageOf(t, SharedDocumentIssueConst.TITLE_TOO_LONG)}
      ),
    categoryId: z
      .string()
      .refine((value) => offeredCategoryIds.includes(value), {
        message: issueMessageOf(t, SharedDocumentIssueConst.CATEGORY_MISSING),
      }),
    file: z.custom<File | undefined>().superRefine((file, context) => {
      const issue = fileIssueOf(file)
      if (issue) {
        context.addIssue({
          code: 'custom',
          message: issueMessageOf(
            t,
            issue,
            file && formatFileWeight(file.size)
          ),
        })
      }
    }),
  })

/** Le refus du navigateur pour le fichier choisi, ou rien. */
const fileIssueOf = (
  file: File | undefined
): SharedDocumentIssue | undefined => {
  if (!(file instanceof File) || file.size === 0) {
    return SharedDocumentIssueConst.FILE_MISSING
  }
  if (file.type !== SHARED_DOCUMENT_PDF_TYPE) {
    return SharedDocumentIssueConst.FILE_FORMAT
  }
  if (file.size > SHARED_DOCUMENT_MAX_BYTES) {
    return SharedDocumentIssueConst.FILE_SIZE
  }
  return undefined
}

export type SharedDocumentFormValues = z.infer<
  ReturnType<typeof createSharedDocumentFormSchema>
>

/**
 * Etats de l'envoi. Le succes n'a pas d'etat : l'action renvoie a la liste
 * (`/bureau/documents?statut=depose`).
 */
export type SharedDocumentFormState =
  | {status: 'idle'}
  | {status: 'rejected'; issues: SharedDocumentIssue[]}
  | {status: 'error'; message: string}
