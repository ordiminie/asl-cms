import * as z from 'zod'

import {SUPPORTED_LANGUAGES} from '@/services/types/common-type'
import {SupportedLanguage} from '@/services/types/domain/post-types'

// Constante pour l'interface utilisateur (ordre spécifique pour le formulaire)
export const LANGUAGE_OPTIONS: {value: SupportedLanguage; label: string}[] = [
  {value: 'fr', label: 'Français'},
  {value: 'en', label: 'English'},
  {value: 'es', label: 'Español'},
]

// Schéma pour une traduction
export const translationSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  title: z.string().min(1, 'Le titre est requis'),
  slug: z.string().min(1, 'Le slug est requis'),
  description: z
    .string()
    .min(10, 'La description doit contenir au moins 10 caractères')
    .max(500, 'La description ne peut pas dépasser 500 caractères'),
  content: z
    .string()
    .min(50, 'Le contenu doit contenir au moins 50 caractères')
    .max(10000, 'Le contenu ne peut pas dépasser 10000 caractères'),
  metaTitle: z
    .string()
    .max(60, 'Le meta titre ne peut pas dépasser 60 caractères')
    .optional()
    .or(z.literal('')),
  metaDescription: z
    .string()
    .max(160, 'La meta description ne peut pas dépasser 160 caractères')
    .optional()
    .or(z.literal('')),
  metaKeywords: z
    .string()
    .max(200, 'Les mots-clés ne peuvent pas dépasser 200 caractères')
    .optional()
    .or(z.literal('')),
})

// Schéma principal du formulaire de post
export const postFormSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  categoryId: z.string().optional(),
  translations: z
    .array(translationSchema)
    .min(1, 'Au moins une traduction est requise'),
  hashtags: z.array(z.string()).optional(),
  newHashtags: z.array(z.string()).optional(),
})

// Types exportés
export type TranslationFormData = z.infer<typeof translationSchema>
export type PostFormData = z.infer<typeof postFormSchema>

// Type pour les erreurs de validation (générique pour supporter différents schémas)
export type ValidationError<T = PostFormData> = {
  field: keyof T
  message: string
}

// Type pour l'état du formulaire (Server Actions)
export type FormState<T = PostFormData> = {
  success: boolean
  message: string
  fieldErrors?: Record<string, string[]>
  errors?: ValidationError<T>[]
}
