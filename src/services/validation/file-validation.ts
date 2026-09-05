import {z} from 'zod'

import {
  EntityType,
  EntityTypeConst,
  FileCategory,
  FileCategoryConst,
} from '../types/domain/file-types'

/**
 * Schéma pour valider un UUID
 */
export const uuidSchema = z.string().uuid({
  message: "L'identifiant doit être un UUID valide.",
})

/**
 * Schéma pour valider le type d'entité
 */
export const entityTypeSchema = z.enum(
  [
    EntityTypeConst.USER,
    EntityTypeConst.ORGANIZATION,
    EntityTypeConst.PRODUCT,
    EntityTypeConst.GENERIC,
    EntityTypeConst.POST,
  ] satisfies [EntityType, ...EntityType[]],
  {
    message: "Type d'entité non supporté.",
  }
)

/**
 * Schéma pour valider la catégorie de fichier
 */
export const fileCategorySchema = z.enum(
  [
    FileCategoryConst.PROFILE,
    FileCategoryConst.LOGO,
    FileCategoryConst.BANNER,
    FileCategoryConst.DOCUMENT,
    FileCategoryConst.IMAGE,
  ] satisfies [FileCategory, ...FileCategory[]],
  {
    message: 'Catégorie de fichier non supportée.',
  }
)

/**
 * Schéma pour valider un chemin de fichier
 */
export const filePathSchema = z
  .string()
  .min(1, {message: 'Le chemin du fichier ne peut pas être vide.'})
  .regex(/^[a-zA-Z0-9/\-_.]+$/, {
    message:
      'Le chemin du fichier contient des caractères non autorisés. Seuls les lettres, chiffres, tirets, underscores, points et slashes sont autorisés.',
  })

/**
 * Schéma pour valider une opération d'upload pour une entité
 */
export const uploadFileForEntitySchema = z.object({
  entityType: entityTypeSchema,
  entityId: uuidSchema,
  category: fileCategorySchema.optional(),
})

/**
 * Schéma pour valider une opération d'upload générique
 */
export const uploadFileSchema = z.object({
  path: filePathSchema,
})

/**
 * Schéma pour valider une opération de suppression
 */
export const deleteFileSchema = z.object({
  path: filePathSchema,
})

/**
 * Schéma pour valider une opération de récupération
 */
export const getFileSchema = z.object({
  path: filePathSchema,
})

/**
 * Schéma pour valider une opération de listage
 */
export const listFilesSchema = z.object({
  path: filePathSchema,
})
