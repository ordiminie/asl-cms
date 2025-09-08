/* eslint-disable no-restricted-properties */
import {createEnv} from '@t3-oss/env-nextjs'
import {z} from 'zod'

import {
  StripeCheckoutType,
  StripeCheckoutTypeSchema,
} from './lib/stripe/stripe-types'
import {BillingModes} from './services/types/domain/subscription-types'

// Méthodes d'authentification disponibles
export const AuthMethodSchema = z.enum([
  'credential',
  'magiclink',
  'google',
  'apple',
  'github',
])
export type AuthMethod = z.infer<typeof AuthMethodSchema>

export const AuthMethodsSchema = z
  .array(AuthMethodSchema)
  .min(1)
  .default(['credential', 'magiclink'])

// Pages optionnelles disponibles
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

export const PagesConst = {
  BLOG: 'blog' satisfies EnabledPage,
  DOCS: 'docs' satisfies EnabledPage,
  APIKEY: 'apikey' satisfies EnabledPage,
  ORGANIZATION: 'organization' satisfies EnabledPage,
  INVITATION: 'invitation' satisfies EnabledPage,
  ACCOUNT: 'account' satisfies EnabledPage,
  SETTINGS: 'settings' satisfies EnabledPage,
  SUBSCRIPTION: 'subscription' satisfies EnabledPage,
  NOTIFICATIONS: 'notifications' satisfies EnabledPage,
  ADMIN: 'admin' satisfies EnabledPage,
} as const

export const EnabledPagesSchema = z
  .string()
  .optional()
  .transform((val) =>
    val
      ? val
          .split(',')
          .map((page) => page.trim())
          .filter(Boolean)
      : [
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
        ]
  )
  .pipe(z.array(EnabledPageSchema))

// Trusted Origins Schema
export const TrustedOriginsSchema = z
  .string()
  .optional()
  .transform((val) =>
    val
      ? val
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : ['http://localhost:3000']
  )
  .pipe(z.array(z.string().url()))

// Types de checkout Stripe disponibles

export const env = createEnv({
  /*
   * Variables serveur. Celles-ci ne sont accessibles que du côté serveur.
   * Ne commencent pas par NEXT_PUBLIC_.
   */
  server: {
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
  },

  /*
   * Variables client. Celles-ci sont exposées au client.
   * Doivent commencer par NEXT_PUBLIC_.
   */
  client: {
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
  },

  /*
   * Vous ne pouvez pas détruire `process.env` en mode développement de Vercel,
   * vous devez donc vous en contenter :
   */
  runtimeEnv: {
    // Variables serveur
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_TO: process.env.EMAIL_TO,
    LOG_LEVEL: process.env.LOG_LEVEL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_BUCKET: process.env.SUPABASE_BUCKET,
    ALLOWED_MIME_TYPES: process.env.ALLOWED_MIME_TYPES,
    STORAGE_TYPE: process.env.STORAGE_TYPE,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CHAT_PROVIDER: process.env.CHAT_PROVIDER,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NODE_ENV: process.env.NODE_ENV,

    // Variables client
    NEXT_PUBLIC_MAX_FILE_SIZE: process.env.NEXT_PUBLIC_MAX_FILE_SIZE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE:
      process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE,
    NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION:
      process.env.NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION,
    NEXT_PUBLIC_BETTER_AUTH_2FA_SKIP_VERIFICATION_ON_ENABLE:
      process.env.NEXT_PUBLIC_BETTER_AUTH_2FA_SKIP_VERIFICATION_ON_ENABLE,
    NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE:
      process.env.NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE,
    NEXT_PUBLIC_BETTER_AUTH_TOKEN_MANAGEMENT:
      process.env.NEXT_PUBLIC_BETTER_AUTH_TOKEN_MANAGEMENT,
    NEXT_PUBLIC_BETTER_AUTH_CHANGE_PASSWORD:
      process.env.NEXT_PUBLIC_BETTER_AUTH_CHANGE_PASSWORD,
    NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL:
      process.env.NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_BILLING_MODE: process.env.NEXT_PUBLIC_BILLING_MODE,
    NEXT_PUBLIC_AUTH_METHODS: process.env.NEXT_PUBLIC_AUTH_METHODS,
    NEXT_PUBLIC_ENABLED_PAGES: process.env.NEXT_PUBLIC_ENABLED_PAGES,
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID:
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
  },

  /*
   * Run `build` ou `dev` avec SKIP_ENV_VALIDATION pour ignorer la validation de l'environnement.
   * Cela est particulièrement utile pour Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /*
   * Rend le type des variables d'environnement vides comme chaîne au lieu de undefined.
   */
  emptyStringAsUndefined: true,

  isServer: process.env.NODE_ENV === 'test' || typeof window === 'undefined',
})
