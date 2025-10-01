import {z} from 'zod'

import {
  StripeCheckoutType,
  StripeCheckoutTypeSchema,
} from './lib/stripe/stripe-types'
import {BillingModes} from './services/types/domain/subscription-types'

// Schémas redéfinis ici pour éviter la dépendance circulaire
export const AuthMethodSchema = z.enum([
  'credential',
  'magiclink',
  'google',
  'apple',
  'github',
])
export type AuthMethod = z.infer<typeof AuthMethodSchema>

export const EnabledPageSchema = z.enum([
  'none',
  'blog',
  'docs',
  'apikey',
  'organization',
  'invitation',
  'account',
  'settings',
  'subscription',
  'notifications',
  'admin',
])
export type EnabledPage = z.infer<typeof EnabledPageSchema>

export const EnabledPagesSchema = z
  .string()
  .optional()
  .transform((val) =>
    val ? val.split(',').map((page) => page.trim() as EnabledPage) : []
  )
  .pipe(z.array(EnabledPageSchema))

export const TrustedOriginsSchema = z
  .string()
  .optional()
  .transform((val) =>
    val && val.trim() !== ''
      ? val
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : ['http://localhost:3000']
  )
  .pipe(z.array(z.string().url()))

// Schémas des variables serveur (accessibles côté serveur seulement)
export const serverSchema = {
  // Base de données
  DATABASE_URL: z.string().url(),

  // Authentification
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_TRUSTED_ORIGINS: TrustedOriginsSchema,

  // Email
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email().default('onboarding@resend.dev'),
  EMAIL_TO: z.string().email().default('onboarding@resend.dev'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Supabase (serveur)
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_BUCKET: z.string().min(1),

  // Upload de fichiers
  ALLOWED_MIME_TYPES: z.string().min(1),
  STORAGE_TYPE: z.string().optional(),

  // Stripe (serveur)
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // OAuth (optionnel)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Chat AI (serveur seulement - sécurisé)
  CHAT_PROVIDER: z.enum(['ollama', 'openai', 'anthropic']).default('ollama'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Environnement
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
}

// Schémas des variables client (exposées au client)
export const clientSchema = {
  // URL de l'application
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Tailwind
  NEXT_PUBLIC_MAX_FILE_SIZE: z
    .string()
    .default('5242880')
    .transform((val) => Number(val)),

  // Stripe (client)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE: StripeCheckoutTypeSchema.default(
    'EmbededForm' as StripeCheckoutType
  ),

  // Better Auth (client)
  NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  NEXT_PUBLIC_BETTER_AUTH_2FA_SKIP_VERIFICATION_ON_ENABLE: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  NEXT_PUBLIC_BETTER_AUTH_TOKEN_MANAGEMENT: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  NEXT_PUBLIC_BETTER_AUTH_CHANGE_PASSWORD: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),

  // API URL (optionnel)
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_BILLING_MODE: z
    .enum([BillingModes.USER, BillingModes.ORGANIZATION])
    .default(BillingModes.ORGANIZATION),

  // Méthodes d'authentification
  NEXT_PUBLIC_AUTH_METHODS: z
    .string()
    .default('credential,magiclink,google')
    .transform((val) =>
      val.split(',').map((method) => method.trim() as AuthMethod)
    ),

  // Pages optionnelles activées
  NEXT_PUBLIC_ENABLED_PAGES: EnabledPagesSchema,

  // Google Analytics
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: z.string().optional(),
}
