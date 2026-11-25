import {z} from 'zod'

import {newsDateSchema} from './news-validation'

/**
 * Validation des documents nominatifs (s32, ADR 073). Le titre vide ou trop
 * long, la categorie indisponible, la date illisible et le fichier refuse ne
 * sont **pas** refuses ici : ce sont des refus rendus au bureau comme un
 * resultat (`MemberDocumentIssueConst`), pas des erreurs de requete.
 */

export const memberDocumentOrganizationIdSchema = z.string().uuid()
export const memberDocumentIdSchema = z.string().uuid()
export const memberDocumentProfileIdSchema = z.string().uuid()

/** La date ecrite sur le document, `aaaa-mm-jj`, jour reel du calendrier. */
export const memberDocumentDateSchema = newsDateSchema

const documentFieldsSchema = {
  organizationId: memberDocumentOrganizationIdSchema,
  title: z.string().trim(),
  categoryId: z.string().trim(),
  documentDate: z.string().trim().default(''),
}

export const depositMemberDocumentServiceSchema = z.object({
  ...documentFieldsSchema,
  memberProfileId: memberDocumentProfileIdSchema,
})

export const depositMemberDocumentBatchLineServiceSchema = z.object({
  ...documentFieldsSchema,
  fileName: z.string(),
})

export const memberDocumentReferenceServiceSchema = z.object({
  organizationId: memberDocumentOrganizationIdSchema,
  documentId: memberDocumentIdSchema,
})

export const memberDocumentsOfProfileServiceSchema = z.object({
  organizationId: memberDocumentOrganizationIdSchema,
  memberProfileId: memberDocumentProfileIdSchema,
})

export const MEMBER_DOCUMENT_SEARCH_MAX_LENGTH = 100

export const bureauMemberDocumentsServiceSchema = z.object({
  organizationId: memberDocumentOrganizationIdSchema,
  search: z
    .string()
    .trim()
    .max(MEMBER_DOCUMENT_SEARCH_MAX_LENGTH)
    .optional()
    .transform((value) => (value ? value : undefined)),
  categoryId: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .transform((value) => (value ? value : undefined)),
  page: z.number().int().min(1).default(1),
})
