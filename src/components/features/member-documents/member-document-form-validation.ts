import {z} from 'zod'

import {frenchDateToIso} from '@/components/ui/date-field-format'
import {CONTENT_FILE_MAX_BYTES} from '@/services/types/domain/content-file-types'
import {
  MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
  MemberDocumentBatchLineResult,
  MemberDocumentIssue,
  MemberDocumentIssueConst,
} from '@/services/types/domain/member-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

/**
 * Formulaire « Deposer un document » d'une fiche (s32, ecran 3). Controles du
 * navigateur avant l'envoi — le serveur revalide tout, signature binaire
 * comprise, et c'est lui qui decide (`MemberDocumentIssueConst`).
 */

export const MEMBER_DOCUMENT_PDF_TYPE = 'application/pdf'
export const MEMBER_DOCUMENT_MAX_BYTES = CONTENT_FILE_MAX_BYTES.document
/** Le plafond ecrit sous le champ est celui reellement applique. */
export const MEMBER_DOCUMENT_MAX_MEGABYTES =
  MEMBER_DOCUMENT_MAX_BYTES / (1024 * 1024)

export const MEMBER_DOCUMENT_FORM_FIELDS = [
  'title',
  'categoryId',
  'documentDate',
  'file',
] as const

export type MemberDocumentFormField =
  (typeof MEMBER_DOCUMENT_FORM_FIELDS)[number]

/** Le champ du formulaire que chaque refus du serveur designe. */
export const ISSUE_FIELD: Record<MemberDocumentIssue, MemberDocumentFormField> =
  {
    [MemberDocumentIssueConst.TITLE_MISSING]: 'title',
    [MemberDocumentIssueConst.TITLE_TOO_LONG]: 'title',
    [MemberDocumentIssueConst.CATEGORY_MISSING]: 'categoryId',
    [MemberDocumentIssueConst.CATEGORY_UNAVAILABLE]: 'categoryId',
    [MemberDocumentIssueConst.DATE_INVALID]: 'documentDate',
    [MemberDocumentIssueConst.FILE_MISSING]: 'file',
    [MemberDocumentIssueConst.FILE_FORMAT]: 'file',
    [MemberDocumentIssueConst.FILE_SIZE]: 'file',
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
  issue: MemberDocumentIssue,
  fileWeight?: string
): string =>
  t(`issues.${issue}`, {
    max: MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
    maxSize: MEMBER_DOCUMENT_MAX_MEGABYTES,
    weight: fileWeight ?? '',
  })

/** Le refus du navigateur pour un fichier choisi, ou rien. */
export const fileIssueOf = (
  file: File | undefined
): MemberDocumentIssue | undefined => {
  if (!(file instanceof File) || file.size === 0) {
    return MemberDocumentIssueConst.FILE_MISSING
  }
  if (file.type !== MEMBER_DOCUMENT_PDF_TYPE) {
    return MemberDocumentIssueConst.FILE_FORMAT
  }
  if (file.size > MEMBER_DOCUMENT_MAX_BYTES) {
    return MemberDocumentIssueConst.FILE_SIZE
  }
  return undefined
}

/** Les champs communs au depot unitaire et au lot : titre, categorie, date. */
export const memberDocumentCommonFieldsOf = (
  t: Translate,
  offeredCategoryIds: readonly string[]
) => ({
  title: z
    .string()
    .refine((value) => value.trim().length > 0, {
      message: issueMessageOf(t, MemberDocumentIssueConst.TITLE_MISSING),
    })
    .refine(
      (value) => value.trim().length <= MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
      {message: issueMessageOf(t, MemberDocumentIssueConst.TITLE_TOO_LONG)}
    ),
  categoryId: z.string().refine((value) => offeredCategoryIds.includes(value), {
    message: issueMessageOf(t, MemberDocumentIssueConst.CATEGORY_MISSING),
  }),
  documentDate: z
    .string()
    .refine((value) => frenchDateToIso(value) !== undefined, {
      message: issueMessageOf(t, MemberDocumentIssueConst.DATE_INVALID),
    }),
})

export const createMemberDocumentFormSchema = (
  t: Translate,
  offeredCategoryIds: readonly string[]
) =>
  z.object({
    ...memberDocumentCommonFieldsOf(t, offeredCategoryIds),
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

export type MemberDocumentFormValues = z.infer<
  ReturnType<typeof createMemberDocumentFormSchema>
>

/**
 * Etats de l'envoi. Le succes n'a pas d'etat : l'action renvoie a la fiche
 * (`?documents=depose`).
 */
export type MemberDocumentFormState =
  | {status: 'idle'}
  | {status: 'rejected'; issues: MemberDocumentIssue[]}
  | {status: 'error'; message: string}

/** Le resultat d'une ligne de lot rendu par l'action, ou l'echec de son envoi. */
export type MemberDocumentBatchLineActionResult =
  | MemberDocumentBatchLineResult
  | {status: 'error'; fileName: string; message: string}
