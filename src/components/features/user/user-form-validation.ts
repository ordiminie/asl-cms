import {z} from 'zod'

// Schéma pour le changement de mot de passe
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
    newPassword: z
      .string()
      .min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
      ),
    confirmPassword: z
      .string()
      .min(1, 'La confirmation du mot de passe est requise'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

export type ChangePasswordFormSchemaType = z.infer<
  typeof changePasswordFormSchema
>

// Schéma pour le changement d'email
export const changeEmailFormSchema = z.object({
  newEmail: z
    .string()
    .min(1, "L'email est requis")
    .email("Format d'email invalide"),
})

export type ChangeEmailFormSchemaType = z.infer<typeof changeEmailFormSchema>

// Schéma pour l'authentification à deux facteurs
export const twoFactorFormSchema = z.object({
  action: z.enum(['enable', 'disable'], {
    message: 'Veuillez sélectionner une action',
  }),
  password: z.string().min(1, 'Le mot de passe est requis'),
})

export type TwoFactorFormSchemaType = z.infer<typeof twoFactorFormSchema>

export const twoFactorSetupSchema = z.object({
  secret: z.string().min(1, 'Le secret est requis'),
  backupCodes: z
    .array(z.string())
    .min(8, 'Au moins 8 codes de sauvegarde sont requis'),
})

export type TwoFactorSetupSchemaType = z.infer<typeof twoFactorSetupSchema>
