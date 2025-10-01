/* eslint-disable no-restricted-properties */
import {createEnv} from '@t3-oss/env-nextjs'

// Types importés depuis env-schemas.ts pour éviter les doublons
import {
  AuthMethodSchema,
  clientSchema,
  EnabledPage,
  serverSchema,
} from './env-schemas'

// Réexporter les types et schémas pour compatibilité
export type {AuthMethod, EnabledPage} from './env-schemas'
export {
  AuthMethodSchema,
  EnabledPageSchema,
  EnabledPagesSchema,
  TrustedOriginsSchema,
} from './env-schemas'

// Pages optionnelles disponibles
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

export const AuthMethodsSchema = AuthMethodSchema.array()
  .min(1)
  .default(['credential', 'magiclink'])

// Réexporter les schémas pour compatibilité
export {clientSchema, serverSchema}

// Configuration de l'environnement
export const env = createEnv({
  onValidationError: (error) => {
    console.error('❌ Environment validation failed:', error)
    throw new Error('Invalid environment variables')
  },
  server: serverSchema,
  client: clientSchema,
  /*
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
