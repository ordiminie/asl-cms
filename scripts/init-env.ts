#!/usr/bin/env tsx

import * as p from '@clack/prompts'
import {randomBytes} from 'crypto'
import {existsSync} from 'fs'
import {readFile, writeFile} from 'fs/promises'

let ENV_FILE = '.env.development'
const CONFIG_FILE = 'scripts/.init-env-config.json'

const TEST_VALUES: Record<string, string> = {
  DATABASE_URL: 'postgres://test:test@localhost:5432/test_db',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_anon_key',
  SUPABASE_BUCKET: 'test-bucket',
  NEXT_PUBLIC_MAX_FILE_SIZE: '1048576',
  ALLOWED_MIME_TYPES: 'image/jpeg,image/png',
  BETTER_AUTH_SECRET: 'test_secret_key_for_testing_purposes_only',
  BETTER_AUTH_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'test_google_client_id',
  GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
  NEXT_PUBLIC_BETTER_AUTH_CHANGE_PASSWORD: 'false',
  NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL: 'false',
  NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
  NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE: 'false',
  NEXT_PUBLIC_BETTER_AUTH_2FA_SKIP_VERIFICATION_ON_ENABLE: 'true',
  NEXT_PUBLIC_BETTER_AUTH_TOKEN_MANAGEMENT: 'false',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_stripe_key',
  STRIPE_SECRET_KEY: 'sk_test_mock_stripe_secret',
  STRIPE_WEBHOOK_SECRET: 'whsec_mock_webhook_secret',
  NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE: 'EmbededForm',
  RESEND_API_KEY: 're_mock_resend_key',
  EMAIL_FROM: 'test@example.com',
  EMAIL_TO: 'test@example.com',
  LOG_LEVEL: 'debug',
  NEXT_PUBLIC_BILLING_MODE: 'organization',
  NEXT_PUBLIC_ENABLED_PAGES: 'blog,docs,apikey',
  NEXT_PUBLIC_AUTH_METHODS: 'credential',
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: 'GA_TEST',
}

function getPageHint(page: string): string {
  const hints: Record<string, string> = {
    blog: 'Articles et contenu',
    docs: 'Documentation',
    apikey: 'Gestion des clés API',
    organization: 'Gestion des organisations',
    invitation: 'Invitations utilisateurs',
    account: 'Paramètres du compte',
    settings: 'Paramètres généraux',
    subscription: 'Abonnements Stripe',
    notifications: 'Centre de notifications',
    admin: 'Panel administrateur',
  }
  return hints[page] || ''
}

type EnvVariable = {
  description: string
  required: boolean
  example?: string
  generate?: boolean
  choices?: string[]
}

type CategoryConfig = Record<string, EnvVariable>
type EnvConfig = Record<string, CategoryConfig>
type SavedConfig = Record<string, string>

const ENV_CATEGORIES: EnvConfig = {
  'Base de données': {
    DATABASE_URL: {
      description: 'URL de connexion PostgreSQL',
      required: true,
      example: 'postgres://user:password@host:5432/dbname',
    },
  },
  Storage: {
    SUPABASE_URL: {
      description: 'URL Supabase',
      required: false,
      example: 'https://yourproject.supabase.co',
    },
    SUPABASE_ANON_KEY: {
      description: 'Clé anonyme Supabase',
      required: false,
      example: 'eyJ...',
    },
    SUPABASE_BUCKET: {
      description: 'Nom du bucket Supabase',
      required: false,
      example: 'NEXT-BLOG-BUCKET',
    },
    NEXT_PUBLIC_MAX_FILE_SIZE: {
      description: 'Taille maximale des fichiers (bytes)',
      required: false,
      example: '5242880',
    },
    ALLOWED_MIME_TYPES: {
      description: 'Types MIME autorisés (séparés par des virgules)',
      required: false,
      example: 'image/jpeg,image/png,image/gif,application/pdf',
    },
  },
  Authentification: {
    BETTER_AUTH_SECRET: {
      description: 'Secret pour Better Auth (généré automatiquement si vide)',
      required: true,
      generate: true,
    },
    BETTER_AUTH_URL: {
      description: "URL de base de l'application",
      required: true,
      example: 'http://localhost:3000',
    },
    NEXT_PUBLIC_APP_URL: {
      description: "URL publique de l'application",
      required: true,
      example: 'http://localhost:3000',
    },
    BETTER_AUTH_TRUSTED_ORIGINS: {
      description: 'Origines de confiance (séparées par des virgules)',
      required: false,
      example: 'http://localhost:3000,http://192.168.1.129:3000',
    },
    GOOGLE_CLIENT_ID: {
      description: 'ID client Google OAuth',
      required: false,
      example: '757918412264-xxx.apps.googleusercontent.com',
    },
    GOOGLE_CLIENT_SECRET: {
      description: 'Secret client Google OAuth',
      required: false,
      example: 'GOCSPX-xxx',
    },
    NEXT_PUBLIC_BETTER_AUTH_CHANGE_PASSWORD: {
      description: 'Permettre le changement de mot de passe',
      required: false,
      example: 'true',
    },
    NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL: {
      description: "Permettre le changement d'email",
      required: false,
      example: 'true',
    },
    NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION: {
      description: 'Vérification email obligatoire',
      required: false,
      example: 'true',
    },
    NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE: {
      description: 'Activer la 2FA',
      required: false,
      example: 'true',
    },
    NEXT_PUBLIC_BETTER_AUTH_2FA_SKIP_VERIFICATION_ON_ENABLE: {
      description: "Ignorer la vérification lors de l'activation 2FA",
      required: false,
      example: 'true',
    },
    NEXT_PUBLIC_BETTER_AUTH_TOKEN_MANAGEMENT: {
      description: 'Gestion des tokens',
      required: false,
      example: 'true',
    },
  },
  Stripe: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: {
      description: 'Clé publique Stripe',
      required: false,
      example: 'pk_test_xxx',
    },
    STRIPE_SECRET_KEY: {
      description: 'Clé secrète Stripe',
      required: false,
      example: 'sk_test_xxx',
    },
    STRIPE_WEBHOOK_SECRET: {
      description: 'Secret webhook Stripe',
      required: false,
      example: 'whsec_xxx',
    },
    NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE: {
      description: 'Type de checkout Stripe',
      required: false,
      example: 'EmbededForm',
      choices: [
        'EmbededForm',
        'ExternalForm',
        'ReactStripeForm',
        'PaymentLink',
      ],
    },
  },
  'Email & Logs': {
    RESEND_API_KEY: {
      description: "Clé API Resend pour l'envoi d'emails",
      required: false,
      example: 're_xxx',
    },
    EMAIL_FROM: {
      description: 'Adresse email expéditeur',
      required: false,
      example: 'admin@monsite.com',
    },
    EMAIL_TO: {
      description: 'Adresse email destinataire par défaut',
      required: false,
      example: 'admin@monsite.com',
    },
    LOG_LEVEL: {
      description: 'Niveau de log',
      required: false,
      example: 'info',
      choices: ['error', 'warn', 'info', 'debug'],
    },
  },
  'Pages & Features': {
    NEXT_PUBLIC_BILLING_MODE: {
      description: 'Mode de facturation (recommandé: organization)',
      required: false,
      example: 'organization',
      choices: ['organization', 'user'],
    },
    NEXT_PUBLIC_ENABLED_PAGES: {
      description: 'Pages activées (séparées par des virgules)',
      required: false,
      example: 'blog,docs,apikey,organization',
      choices: [
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
      ],
    },
    NEXT_PUBLIC_AUTH_METHODS: {
      description: "Méthodes d'authentification disponibles",
      required: false,
      example: 'credential,magiclink,google',
    },
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: {
      description: 'ID Google Analytics',
      required: false,
      example: 'GA_XXXXX',
    },
  },
}

class EnvManager {
  private config: SavedConfig = {}
  private existingEnv: SavedConfig = {}

  async loadConfig(): Promise<void> {
    if (existsSync(CONFIG_FILE)) {
      try {
        const configData = await readFile(CONFIG_FILE, 'utf-8')
        this.config = JSON.parse(configData)
      } catch {
        p.log.warn('Erreur lors du chargement de la configuration précédente')
      }
    }
  }

  async saveConfig(): Promise<void> {
    try {
      await writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2))
    } catch {
      p.log.warn('Erreur lors de la sauvegarde de la configuration')
    }
  }

  async loadExistingEnv(): Promise<void> {
    if (existsSync(ENV_FILE)) {
      try {
        const envContent = await readFile(ENV_FILE, 'utf-8')
        const lines = envContent.split('\n')

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=')
            if (key && valueParts.length > 0) {
              let value = valueParts.join('=')
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.slice(1, -1)
              }
              this.existingEnv[key] = value
            }
          }
        }
      } catch {
        p.log.warn(`Erreur lors de la lecture du fichier ${ENV_FILE} existant`)
      }
    }
  }

  generateSecret(): string {
    return randomBytes(32).toString('base64')
  }

  async promptForValue(key: string, envVar: EnvVariable): Promise<string> {
    const currentValue = this.existingEnv[key] || this.config[key] || ''
    const hasCurrentValue = currentValue !== ''

    let message = envVar.description
    if (envVar.required) {
      message += ' (requis)'
    }

    const placeholder = envVar.example || 'Valeur...'
    const initialValue = hasCurrentValue ? currentValue : ''

    // Gestion spéciale pour NEXT_PUBLIC_ENABLED_PAGES (sélection multiple)
    if (key === 'NEXT_PUBLIC_ENABLED_PAGES' && envVar.choices) {
      const currentPages = hasCurrentValue
        ? currentValue.split(',').map((p) => p.trim())
        : []

      const selectedPages = await p.multiselect({
        message,
        options: envVar.choices.map((choice) => ({
          value: choice,
          label: choice,
          hint: getPageHint(choice),
        })),
        initialValues: currentPages,
        required: false,
      })

      if (p.isCancel(selectedPages)) {
        p.cancel('Opération annulée')
        process.exit(0)
      }

      return (selectedPages as string[]).join(',')
    }

    if (envVar.choices) {
      const value = await p.select({
        message,
        options: [
          ...(hasCurrentValue
            ? [
                {
                  value: currentValue,
                  label: `Garder: ${currentValue}`,
                  hint: 'valeur actuelle',
                },
              ]
            : []),
          ...envVar.choices.map((choice) => ({
            value: choice,
            label: choice,
          })),
          ...(envVar.required
            ? []
            : [{value: '', label: 'Ignorer', hint: 'laisser vide'}]),
        ],
      })

      if (p.isCancel(value)) {
        p.cancel('Opération annulée')
        process.exit(0)
      }

      return value as string
    }

    const value = await p.text({
      message,
      placeholder,
      initialValue,
      validate: (input) => {
        if (envVar.required && !input.trim()) {
          if (envVar.generate) {
            return // OK, on générera automatiquement
          }
          return 'Cette valeur est requise'
        }
      },
    })

    if (p.isCancel(value)) {
      p.cancel('Opération annulée')
      process.exit(0)
    }

    if (!value && envVar.required && envVar.generate) {
      p.log.info("Génération automatique d'un secret...")
      return this.generateSecret()
    }

    return value || ''
  }

  async generateTestEnv(): Promise<void> {
    const envLines: string[] = [
      '# Configuration de test générée automatiquement',
    ]

    for (const [categoryName, variables] of Object.entries(ENV_CATEGORIES)) {
      envLines.push(`\n# ${categoryName}`)

      for (const [key] of Object.entries(variables)) {
        const testValue = TEST_VALUES[key] || ''
        if (testValue) {
          const needsQuotes =
            /[\s"'$`\\]/.test(testValue) || testValue.includes('=')
          envLines.push(`${key}=${needsQuotes ? `"${testValue}"` : testValue}`)
        } else {
          envLines.push(`#${key}=`)
        }
      }
    }

    await writeFile(ENV_FILE, envLines.join('\n'))
  }

  async generateEnvContent(): Promise<string> {
    const envLines: string[] = []

    for (const [categoryName, variables] of Object.entries(ENV_CATEGORIES)) {
      envLines.push(`\n# ${categoryName}`)

      for (const [key] of Object.entries(variables)) {
        const value = this.config[key] || ''
        if (value) {
          const needsQuotes = /[\s"'$`\\]/.test(value) || value.includes('=')
          envLines.push(`${key}=${needsQuotes ? `"${value}"` : value}`)
        } else {
          envLines.push(`#${key}=`)
        }
      }
    }

    return envLines.join('\n')
  }

  async run(): Promise<void> {
    p.intro('🚀 Initialisation du boilerplate Next.js SaaS')

    // Sélection de l'environnement
    const environment = await p.select({
      message: 'Quel environnement souhaitez-vous configurer ?',
      options: [
        {
          value: 'development',
          label: 'Development',
          hint: 'Pour le développement local',
        },
        {
          value: 'production',
          label: 'Production',
          hint: 'Pour le build de production',
        },
        {
          value: 'test',
          label: 'Test',
          hint: 'Pour les tests automatisés',
        },
      ],
    })

    if (p.isCancel(environment)) {
      p.cancel('Opération annulée')
      process.exit(0)
    }

    ENV_FILE = `.env.${environment}`
    p.log.info(`Configuration de l'environnement: ${environment}`)

    // Si c'est l'environnement de test, proposer de générer automatiquement
    if (environment === 'test') {
      const autoGenerate = await p.confirm({
        message:
          'Générer automatiquement un fichier .env.test avec des valeurs de test ?',
        initialValue: true,
      })

      if (p.isCancel(autoGenerate)) {
        p.cancel('Opération annulée')
        process.exit(0)
      }

      if (autoGenerate) {
        await this.generateTestEnv()
        p.outro('✅ Fichier .env.test généré avec des valeurs de test!')
        return
      }
    }

    await this.loadConfig()
    await this.loadExistingEnv()

    for (const [categoryName, variables] of Object.entries(ENV_CATEGORIES)) {
      p.log.step(`Configuration: ${categoryName}`)

      for (const [key, envVar] of Object.entries(variables)) {
        const value = await this.promptForValue(key, envVar)
        if (value) {
          this.config[key] = value
        }
      }
    }

    const s = p.spinner()
    s.start(`Génération du fichier ${ENV_FILE}...`)

    const envContent = await this.generateEnvContent()
    await writeFile(ENV_FILE, envContent)
    await this.saveConfig()

    s.stop(`Fichier ${ENV_FILE} créé!`)

    p.outro(
      '✅ Configuration terminée! Vous pouvez relancer ce script à tout moment.'
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const envManager = new EnvManager()
  envManager.run().catch((err) => {
    p.log.error(`Erreur: ${err.message}`)
    process.exit(1)
  })
}

export default EnvManager
