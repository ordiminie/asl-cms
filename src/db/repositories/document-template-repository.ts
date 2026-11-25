import {asc, eq, sql} from 'drizzle-orm'

import {
  documentTemplate,
  DocumentTemplateModel,
} from '@/db/models/document-template-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Modeles de documents (s36, ADR 074 §1). Sous RLS forcee : hors
 * `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

export type DocumentTemplateFieldsModel = {
  name: string
  subject: string
  bodyMarkdown: string
}

/** Les modeles de l'association, par nom sans casse puis par identifiant. */
export const listDocumentTemplatesDao = async (
  organizationId: string
): Promise<DocumentTemplateModel[]> =>
  getDb()
    .select()
    .from(documentTemplate)
    .where(eq(documentTemplate.organizationId, organizationId))
    .orderBy(
      asc(sql`lower(${documentTemplate.name})`),
      asc(documentTemplate.id)
    )

/** Un modele par son identifiant ; celui d'une autre association est absent. */
export const getDocumentTemplateByIdDao = async (
  templateId: string
): Promise<DocumentTemplateModel | undefined> => {
  const [row] = await getDb()
    .select()
    .from(documentTemplate)
    .where(eq(documentTemplate.id, templateId))
  return row
}

export const createDocumentTemplateDao = async (
  input: DocumentTemplateFieldsModel & {organizationId: string}
): Promise<DocumentTemplateModel> => {
  const [row] = await getDb().insert(documentTemplate).values(input).returning()
  return row
}

/** Met a jour un modele ; absent (ou d'une autre association) → `undefined`. */
export const updateDocumentTemplateDao = async (
  templateId: string,
  fields: DocumentTemplateFieldsModel
): Promise<DocumentTemplateModel | undefined> => {
  const [row] = await getDb()
    .update(documentTemplate)
    .set({...fields, updatedAt: sql`now()`})
    .where(eq(documentTemplate.id, templateId))
    .returning()
  return row
}

/** Supprime un modele ; absent (ou d'une autre association) → `undefined`. */
export const deleteDocumentTemplateDao = async (
  templateId: string
): Promise<DocumentTemplateModel | undefined> => {
  const [row] = await getDb()
    .delete(documentTemplate)
    .where(eq(documentTemplate.id, templateId))
    .returning()
  return row
}
