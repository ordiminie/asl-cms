import {z} from 'zod'

/**
 * Validation des documents partages (s31, ADR 069). Le titre vide ou trop
 * long, la categorie indisponible et le fichier refuse ne sont **pas**
 * refuses ici : ce sont des refus rendus au bureau comme un resultat
 * (`SharedDocumentIssueConst`), pas des erreurs de requete.
 */

export const sharedDocumentOrganizationIdSchema = z.string().uuid()
export const sharedDocumentIdSchema = z.string().uuid()

export const publishSharedDocumentServiceSchema = z.object({
  organizationId: sharedDocumentOrganizationIdSchema,
  title: z.string().trim(),
  categoryId: z.string().trim(),
})

export const sharedDocumentReferenceServiceSchema = z.object({
  organizationId: sharedDocumentOrganizationIdSchema,
  documentId: sharedDocumentIdSchema,
})
