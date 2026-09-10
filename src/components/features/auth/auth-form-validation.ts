import z from 'zod'

export const authLoginFormSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

export const authMagicLinkFormSchema = z.object({
  email: z.string().email('Adresse email invalide'),
})

// Fonction qui génère le schéma avec les traductions
export const createAuthRegisterFormSchema = (t: (key: string) => string) => {
  return authLoginFormSchema
    .extend({
      name: z.string().min(2, t('validation.nameMin')),
      password: z.string().min(8, t('validation.passwordMin')),
      confirmPassword: z.string().min(8, t('validation.confirmPasswordMin')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    })
}

// Schema par défaut pour la rétrocompatibilité (sans traductions)
export const authRegisterFormSchema = authLoginFormSchema
  .extend({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })
