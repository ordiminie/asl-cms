import {z} from 'zod'

/**
 * Validation des modeles de documents (s36, ADR 074). Les champs ne sont ici
 * que debarrasses de leurs espaces : vide, trop long et variables inconnues
 * sont des refus de champ rendus au formulaire, pas des erreurs de schema.
 */

const uuid = z.string().uuid()

export const documentTemplateOrganizationIdSchema = uuid

export const documentTemplateScopeServiceSchema = z.object({
  organizationId: uuid,
  templateId: uuid,
})

const fieldsShape = {
  name: z.string().trim(),
  subject: z.string().trim(),
  bodyMarkdown: z.string().trim(),
}

export const createDocumentTemplateServiceSchema = z.object({
  organizationId: uuid,
  ...fieldsShape,
})

export const updateDocumentTemplateServiceSchema =
  documentTemplateScopeServiceSchema.extend(fieldsShape)

/** La generation d'un document : la date est verifiee par le service. */
export const renderTemplateDocumentServiceSchema =
  documentTemplateScopeServiceSchema.extend({
    memberProfileId: uuid,
    documentDate: z.string().trim(),
  })

/** Le depot : categorie et titre sont verifies par s32. */
export const depositTemplateDocumentServiceSchema =
  renderTemplateDocumentServiceSchema.extend({
    categoryId: z.string().trim(),
    title: z.string().trim(),
  })

export const documentRecipientServiceSchema = z.object({
  organizationId: uuid,
  memberProfileId: uuid,
})
