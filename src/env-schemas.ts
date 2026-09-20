import {z} from 'zod'

import {EMAIL_TRANSPORT_NAMES} from './lib/emails/transport/email-transport'
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
  // Connexion des migrations et du seed : le rôle PROPRIÉTAIRE des objets.
  // `DATABASE_URL` pointe, lui, sur le rôle applicatif `asl_app` — ni
  // propriétaire ni `BYPASSRLS`, donc réellement soumis aux policies (ADR 002).
  // Optionnelle pour ne pas casser un environnement à un seul rôle : le
  // résolveur (`src/db/scripts/db-url.ts`) retombe alors sur `DATABASE_URL`.
  DATABASE_MIGRATION_URL: z.string().url().optional(),
  // Connexions Postgres ouvertes PAR INSTANCE. Le défaut 1 vise le serverless
  // (Vercel), où chaque instance ouvre son propre pool : le total vaut
  // `max × instances` et doit rester sous la limite du pooler. Sur un serveur
  // long-running (VM, conteneur), ce défaut est au contraire trop bas — lire
  // docs/database-pool.md, qui traite les deux cas.
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(1),

  // Upload des sourcemaps vers Sentry au build. Absent = build normal, mais
  // stacks minifiées côté Sentry. Contrairement au DSN, c'est un secret.
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Authentification
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_TRUSTED_ORIGINS: TrustedOriginsSchema,

  // Email (ADR 005, ADR 017) : tout envoi passe par le contrat
  // `EmailTransport`. `brevo` en production ; `resend` en secours ; `file`
  // (boite de sortie JSON, developpement et e2e) par defaut hors production ;
  // `memory` pour les tests unitaires. La cle d'un fournisseur n'est exigee
  // que pour son propre transport (controle dans `get-email-transport.ts`).
  EMAIL_TRANSPORT: z.enum(EMAIL_TRANSPORT_NAMES).optional(),
  BREVO_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  // Repertoire de la boite de sortie du transport `file` ; repertoire
  // temporaire du systeme s'il est absent.
  EMAIL_OUTBOX_DIR: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().default('onboarding@resend.dev'),
  EMAIL_TO: z.string().email().default('onboarding@resend.dev'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Stockage des fichiers (ADR 004) : le disque du serveur est le seul
  // adaptateur du produit ; `STORAGE_TYPE` absente vaut `local`.
  STORAGE_TYPE: z.enum(['local']).optional(),

  // Racine du stockage sur le disque du serveur (ADR 004, ADR 015) : logo et
  // favicon des associations. Hors de `public/` : ces fichiers ne sont servis
  // que par une route de l'application. Doit exister et etre accessible en
  // ecriture ; sa sauvegarde releve de la mise en ligne.
  LOCAL_STORAGE_ROOT: z.string().min(1),

  // Stripe (serveur)
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // OAuth (optionnel)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
}

// Schémas des variables client (exposées au client)
export const clientSchema = {
  // URL de l'application
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Suivi des erreurs (Sentry). Entièrement optionnel : sans DSN, le SDK n'est
  // jamais initialisé et le boilerplate se comporte comme s'il n'était pas
  // installé — voir docs/sentry.md.
  // Le DSN n'est pas un secret : il part dans le bundle navigateur par
  // conception, et n'autorise que l'envoi d'événements.
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Tailwind
  NEXT_PUBLIC_MAX_FILE_SIZE: z
    .string()
    .default('5242880')
    .transform((val) => Number(val)),

  // Upload de fichiers
  NEXT_PUBLIC_ALLOWED_MIME_TYPES: z.string().min(1),

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

  /**
   * Achat sans compte. Mode BONUS, désactivé par défaut : à `false` le produit
   * se comporte exactement comme sans lui, un visiteur non connecté étant
   * envoyé s'inscrire. Un seul endroit du code le lit — le CTA de la vitrine
   * tarifaire — donc le remettre à `false` suffit à le retirer entièrement.
   */
  NEXT_PUBLIC_GUEST_CHECKOUT_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

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
  // Environnement
  NEXT_PUBLIC_NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
}
