# Système d'Authentification

Ce boilerplate Next.js SaaS utilise **Better Auth** pour fournir un système d'authentification complet, sécurisé et flexible avec support de multiples méthodes de connexion.

## Vue d'ensemble

Le système d'authentification prend en charge :

- **Authentification par credentials** (email/mot de passe)
- **Magic Links** (liens de connexion par email)
- **OAuth Social** (Google, Apple, GitHub)
- **Authentification à deux facteurs (2FA)**
- **Gestion des organisations**
- **Intégration Stripe** pour les abonnements

## Configuration des Variables d'Environnement

### Variables Serveur (Obligatoires)

```env
# Authentification Better Auth
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"

# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/database"

# Email (pour magic links et notifications)
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_TO="admin@yourdomain.com"

# OAuth Providers (optionnel)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Stripe (optionnel)
STRIPE_SECRET_KEY="sk_test_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
```

### Variables Client (Configuration UI)

```env
# URL de l'application
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Méthodes d'authentification activées
NEXT_PUBLIC_AUTH_METHODS="credential,magiclink,google,apple,github"

# Configuration Better Auth
NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION="true"
NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE="false"
NEXT_PUBLIC_BETTER_AUTH_2FA_SKIP_VERIFICATION_ON_ENABLE="true"
NEXT_PUBLIC_BETTER_AUTH_TOKEN_MANAGEMENT="true"
NEXT_PUBLIC_BETTER_AUTH_CHANGE_PASSWORD="true"
NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL="true"

# Mode de facturation
NEXT_PUBLIC_BILLING_MODE="user" # ou "organization"
```

## Méthodes d'Authentification

### 1. Authentification par Credentials

**Configuration** : Ajoutez `credential` dans `NEXT_PUBLIC_AUTH_METHODS`

**Fonctionnalités** :

- Inscription avec email/mot de passe
- Connexion sécurisée
- Réinitialisation de mot de passe
- Vérification d'email obligatoire (configurable)

**Exemple d'utilisation** :

```typescript
// Dans un composant client
import {authClient} from '@/lib/better-auth/auth-client'

const handleLogin = async (email: string, password: string) => {
  const result = await authClient.signIn.email({
    email,
    password,
  })

  if (result.error) {
    console.error('Erreur de connexion:', result.error.message)
  }
}
```

### 2. Magic Links

**Configuration** : Ajoutez `magiclink` dans `NEXT_PUBLIC_AUTH_METHODS`

**Fonctionnalités** :

- Connexion sans mot de passe
- Création automatique de compte si inexistant
- Liens sécurisés avec expiration

**Flow** :

1. L'utilisateur saisit son email
2. Un lien magique est envoyé par email
3. L'utilisateur clique sur le lien
4. Connexion automatique

### 3. OAuth Social

**Providers supportés** :

- **Google** : `google`
- **Apple** : `apple`
- **GitHub** : `github`

**Configuration Google** :

1. Créez un projet dans [Google Cloud Console](https://console.cloud.google.com/)
2. Activez l'API Google+
3. Configurez l'écran de consentement OAuth
4. Créez des identifiants OAuth 2.0
5. Ajoutez les variables d'environnement :

```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**Configuration dans l'interface** :

```env
NEXT_PUBLIC_AUTH_METHODS="credential,google"
```

## Authentification à Deux Facteurs (2FA)

### Configuration

Activez le 2FA via la variable d'environnement :

```env
NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE="true"
```

### Types de 2FA Supportés

#### 1. OTP (One-Time Password)

- Codes à 6 chiffres envoyés par email
- Durée de validité : 5 minutes
- Lien direct pour faciliter la saisie

#### 2. TOTP (Time-based OTP)

- Compatible avec Google Authenticator, Authy, etc.
- QR Code pour configuration
- Codes à 6 chiffres renouvelés toutes les 30 secondes

#### 3. Codes de Récupération

- 10 codes de sauvegarde générés
- Utilisables une seule fois
- Pour récupérer l'accès en cas de perte du device

### Activation du 2FA

```typescript
// Activation TOTP
const result = await authClient.twoFactor.enable({
  type: 'totp',
  password: 'user-password',
})

// Activation OTP
const result = await authClient.twoFactor.enable({
  type: 'otp',
})
```

## Système d'Organisations

### Configuration

```env
NEXT_PUBLIC_BILLING_MODE="organization"
```

### Fonctionnalités

- **Création d'organisations** (contrôlée par admin)
- **Invitations de membres** (jusqu'à 10 par défaut)
- **Gestion des rôles** : `owner`, `admin`, `member`
- **Facturation au niveau organisation**

### Utilisation

```typescript
// Créer une organisation
const org = await authClient.organization.create({
  name: 'Mon Organisation',
  slug: 'mon-org',
})

// Inviter un membre
await authClient.organization.inviteMember({
  email: 'user@example.com',
  role: 'member',
  organizationId: org.id,
})
```

## Intégration Stripe

### Configuration

```env
STRIPE_SECRET_KEY="sk_test_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxx"
```

### Fonctionnalités

- **Création automatique de clients Stripe** à l'inscription
- **Gestion d'abonnements** intégrée
- **Webhooks Stripe** pour synchronisation
- **Support facturation utilisateur ou organisation**

## Architecture du Code

### Structure des Fichiers

```
src/
├── lib/better-auth/
│   ├── auth.ts              # Configuration serveur Better Auth
│   └── auth-client.ts       # Configuration client Better Auth
├── app/[locale]/(auth)/
│   ├── action.ts            # Server Actions d'authentification
│   ├── login/page.tsx       # Page de connexion
│   ├── register/page.tsx    # Page d'inscription
│   ├── reset-password/      # Réinitialisation mot de passe
│   └── verify-request/      # Vérifications (email, 2FA)
├── components/features/auth/forms/
│   ├── login.tsx            # Formulaire de connexion
│   ├── register-form.tsx    # Formulaire d'inscription
│   ├── credential-form.tsx  # Formulaire email/password
│   └── magic-link-form.tsx  # Formulaire magic link
└── services/authentication/
    └── auth-service.ts      # Services d'authentification
```

### Configuration Better Auth (Serveur)

```typescript
// src/lib/better-auth/auth.ts
export const auth = betterAuth({
  appName: APP_ISSUER,
  database: drizzleAdapter(db, {provider: 'pg'}),

  // Configuration email/password
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  // Providers OAuth
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  // Plugins
  plugins: [
    twoFactor({issuer: APP_ISSUER}),
    magicLink(),
    organization(),
    stripe({stripeClient, createCustomerOnSignUp: true}),
  ],
})
```

### Configuration Client

```typescript
// src/lib/better-auth/auth-client.ts
export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  plugins: [
    organizationClient(),
    magicLinkClient(),
    twoFactorClient(),
    stripeClient({subscription: true}),
  ],
})
```

## Server Actions

Les actions d'authentification sont gérées via Next.js Server Actions :

```typescript
// Connexion par credentials
export async function loginCredentialAction(
  prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState>

// Connexion par magic link
export async function loginMagicLinkAction(
  prevState: MagicLinkFormState,
  formData: FormData
): Promise<MagicLinkFormState>

// Connexion OAuth
export async function loginProviderAction(
  provider: 'google' | 'apple' | 'github'
): Promise<LoginFormState>
```

## Gestion des Sessions

### Récupération de l'utilisateur connecté

```typescript
import { getAuthUser } from '@/services/authentication/auth-service'

// Dans un Server Component
const user = await getAuthUser()
if (!user) {
  redirect('/login')
}

// Dans un Client Component avec hook
import { useAuth } from '@/lib/better-auth/auth-client'

function MyComponent() {
  const { data: session, isPending } = useAuth()

  if (isPending) return <div>Chargement...</div>
  if (!session?.user) return <div>Non connecté</div>

  return <div>Bonjour {session.user.name}</div>
}
```

### Middleware de protection

```typescript
// Dans vos pages protégées
export default async function ProtectedPage() {
  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }

  return <div>Contenu protégé</div>
}
```

## Personnalisation de l'Interface

### Configuration des méthodes visibles

L'interface s'adapte automatiquement selon `NEXT_PUBLIC_AUTH_METHODS` :

```typescript
// Dans LoginForm
const authMethods = env.NEXT_PUBLIC_AUTH_METHODS
const hasCredential = authMethods.includes('credential')
const hasMagicLink = authMethods.includes('magiclink')
const hasGoogle = authMethods.includes('google')

// Affichage conditionnel des boutons
{hasGoogle && (
  <Button onClick={() => handleProviderLogin('google')}>
    Se connecter avec Google
  </Button>
)}
```

### Traductions

Le système est entièrement traduit avec `next-intl`. Messages disponibles dans :

- `messages/fr.json`
- `messages/en.json`
- `messages/es.json`

## Sécurité

### Mesures de Sécurité Intégrées

- **Validation Zod stricte** côté serveur
- **Protection CSRF** automatique
- **Sessions sécurisées** avec cookies HttpOnly
- **Chiffrement des mots de passe** avec bcrypt
- **Rate limiting** (configurable)
- **Gestion des utilisateurs bannis**

### Variables d'Environnement Sécurisées

- Les secrets sont validés avec `@t3-oss/env-nextjs`
- Séparation stricte variables serveur/client
- Validation TypeScript des types

## Notifications et Emails

### Système de Notifications Intégré

```typescript
// Notifications automatiques pour :
- Vérification d'email
- Réinitialisation mot de passe
- Codes 2FA (OTP)
- Magic links
- Invitations organisations
- Événements abonnements Stripe
```

### Templates d'Emails

Templates React avec `@react-email/components` pour des emails modernes et responsives.

## Déploiement

### Variables d'Environnement de Production

```env
# Authentification
BETTER_AUTH_SECRET="production-secret-key"
BETTER_AUTH_URL="https://yourdomain.com"

# Base de données
DATABASE_URL="postgresql://user:password@production-db:5432/database"

# Email
RESEND_API_KEY="re_production_key"
EMAIL_FROM="noreply@yourdomain.com"

# OAuth (si utilisé)
GOOGLE_CLIENT_ID="production-google-client-id"
GOOGLE_CLIENT_SECRET="production-google-client-secret"

# URLs
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
```

### Configuration OAuth en Production

1. **Google** : Ajoutez votre domaine de production dans les origines autorisées
2. **Apple** : Configurez les domaines et URLs de retour
3. **GitHub** : Mettez à jour l'URL de callback

## Exemples d'Utilisation

### Connexion Simple

```typescript
'use client'
import { authClient } from '@/lib/better-auth/auth-client'

export function LoginButton() {
  const handleLogin = async () => {
    const result = await authClient.signIn.email({
      email: 'user@example.com',
      password: 'password123',
    })

    if (result.data) {
      // Connexion réussie
      window.location.href = '/dashboard'
    }
  }

  return <button onClick={handleLogin}>Se connecter</button>
}
```

### Déconnexion

```typescript
const handleLogout = async () => {
  await authClient.signOut()
  window.location.href = '/login'
}
```

### Vérification des Permissions

```typescript
import { getAuthUser } from '@/services/authentication/auth-service'

export async function AdminOnlyComponent() {
  const user = await getAuthUser()

  if (user?.role !== 'admin') {
    return <div>Accès refusé</div>
  }

  return <div>Contenu admin</div>
}
```

## Dépannage

### Problèmes Courants

1. **Erreur de redirection OAuth** : Vérifiez les URLs de callback
2. **Emails non reçus** : Vérifiez la configuration Resend
3. **Session non persistante** : Vérifiez `BETTER_AUTH_SECRET`
4. **2FA non fonctionnel** : Vérifiez l'horloge du serveur

### Logs de Débogage

Activez les logs de développement :

```env
LOG_LEVEL="debug"
```

### Support

Pour plus d'informations, consultez :

- [Documentation Better Auth](https://www.better-auth.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Stripe Documentation](https://stripe.com/docs)
