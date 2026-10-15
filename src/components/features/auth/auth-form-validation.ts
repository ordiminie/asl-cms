import z from 'zod'

export const authLoginFormSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

/**
 * Demande d'un lien de connexion (s03) : l'adresse seule, sans espaces ni
 * majuscules. Messages traduits (namespace `Auth.MagicLinkLogin`), partages
 * par le formulaire et l'action.
 */
export const createMagicLinkRequestSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().trim().toLowerCase().email(t('email.invalid')),
  })
