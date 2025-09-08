# Workflow de Développement avec Drizzle

Ce document explique le workflow complet de développement avec Drizzle ORM, de l'initialisation d'une base de données à la mise en production.

## Vue d'Ensemble

Le projet utilise **Drizzle ORM** avec **PostgreSQL** pour une architecture robuste et type-safe. Le workflow couvre le développement local, les environnements de preview et la production avec des migrations automatisées.

## 1. Initialisation de la Base de Données

### Choix du Provider PostgreSQL

Le projet supporte plusieurs providers PostgreSQL :

#### Vercel Postgres (Recommandé pour Vercel)

```bash
# Dashboard Vercel → Storage → Create Database
DATABASE_URL="postgres://default:password@host-pooler.vercel-storage.vercel.app:5432/verceldb?sslmode=require"
```

#### Neon (Gratuit avec plan généreux)

```bash
# Console Neon → Create Project
DATABASE_URL="postgresql://user:password@host.neon.tech/database?sslmode=require"
```

#### Supabase (Full-stack alternative)

```bash
# Dashboard Supabase → SQL Editor
DATABASE_URL="postgresql://postgres:password@host.supabase.co:5432/postgres?sslmode=require"
```

#### Railway (Simple et rapide)

```bash
# Railway → New Project → PostgreSQL
DATABASE_URL="postgresql://postgres:password@host.railway.app:5432/railway"
```

### Configuration des Variables d'Environnement

Créer les fichiers d'environnement :

```bash
# .env.development (développement local)
DATABASE_URL="postgresql://postgres:password@localhost:5432/myapp_dev"

# .env.preview (environnement de preview)
DATABASE_URL="postgresql://user:pass@preview-host/db"

# .env.production (production)
DATABASE_URL="postgresql://user:pass@prod-host/db"
```

## 2. Architecture des Modèles

### Structure des Fichiers

```
src/db/
├── models/
│   ├── auth-model.ts          # Better Auth (user, session, organization)
│   ├── user-model.ts          # Paramètres utilisateur
│   ├── organization-model.ts  # Relations organisations
│   ├── subscription-model.ts  # Plans et abonnements Stripe
│   ├── project-model.ts       # Projets et tâches
│   ├── post-model.ts          # Blog multilingue
│   ├── notification-model.ts  # Système de notifications
│   └── db.ts                  # Configuration principale
├── scripts/
│   ├── check.ts              # Test de connexion
│   ├── clear.ts              # Vider la base
│   ├── migrate.ts            # Appliquer migrations
│   ├── seed.ts               # Données de test
│   └── env.ts                # Gestion environnements
└── repositories/             # Couche d'accès aux données
```

### Conventions de Modélisation

#### Utilisation des Enums PostgreSQL

```typescript
// Définir des enums stricts
export const themeEnum = pgEnum('theme_type', ['light', 'dark', 'system'])
export const roleEnum = pgEnum('role_type', ['public', 'user', 'admin'])

// Utiliser dans les tables
export const user = pgTable('user', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  role: roleEnum('role').notNull().default('user'),
  theme: themeEnum('theme').default('system'),
  // ...
})
```

#### Relations Explicites

```typescript
// Définir les relations
export const userRelations = relations(user, ({one, many}) => ({
  settings: one(userSettings, {
    fields: [user.id],
    references: [userSettings.userId],
  }),
  organizations: many(member),
  projects: many(project),
}))
```

#### Types TypeScript Automatiques

```typescript
// Types générés automatiquement par Drizzle
export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert
```

## 3. Commandes de Développement

### Commandes Principales

```bash
# Vérification et diagnostic
pnpm db:check          # Tester la connexion à la base

# Workflow de développement
pnpm db:generate       # Générer les fichiers de migration
pnpm db:migrate        # Appliquer les migrations
pnpm db:seed           # Insérer les données de test

# Commandes avancées
pnpm db:push           # Forcer le schéma (développement uniquement)
pnpm db:studio         # Interface graphique Drizzle Studio
pnpm db:pull           # Importer un schéma existant

# Reset complet (développement uniquement)
pnpm db:reset-seed     # Clear + Push + Seed
```

### Détail des Commandes

#### `db:generate` - Génération des Migrations

```bash
# Génère les fichiers de migration dans drizzle/migrations/
pnpm db:generate

# Exemple de sortie :
# ✓ Generated migration 0001_cool_spider_man.sql
# ✓ Generated snapshot meta/0001_snapshot.json
```

⚠️ **Quand utiliser** : Après modification des modèles, quand le schéma est stable (avant livraison en production).

#### `db:migrate` - Application des Migrations

```bash
# Applique toutes les migrations non appliquées
pnpm db:migrate

# Installe automatiquement l'extension UUID
# Suit l'ordre chronologique des migrations
```

#### `db:reset-seed` - Reset Complet

```bash
# Détruit tout, reconstruit le schéma et insère les données
pnpm db:reset-seed

# Équivalent à :
pnpm db:clear && pnpm db:push && pnpm db:seed
```

⚠️ **Attention** : Cette commande détruit toutes les données ! À utiliser uniquement en développement.

## 4. Workflow de Développement

### Développement Local

#### Étape 1 : Initialisation

```bash
# 1. Créer la base de données sur votre provider
# 2. Configurer DATABASE_URL dans .env.development
# 3. Tester la connexion
pnpm db:check

# 4. Générer et appliquer les migrations initiales
pnpm db:generate
pnpm db:migrate

# 5. Insérer les données de test
pnpm db:seed
```

#### Étape 2 : Modification des Modèles

```bash
# 1. Modifier les fichiers dans src/db/models/
# Exemple : Ajouter une nouvelle colonne

# 2. Générer la migration
pnpm db:generate
# → Crée : drizzle/migrations/0002_new_column.sql

# 3. Appliquer la migration
pnpm db:migrate

# 4. Tester avec des données fraîches si nécessaire
pnpm db:reset-seed
```

#### Étape 3 : Cas d'Urgence (État Instable)

```bash
# Si la base est dans un état incohérent
pnpm db:reset-seed

# Cela va :
# 1. Vider complètement la base (db:clear)
# 2. Reconstruire le schéma directement (db:push)
# 3. Insérer les données de test (db:seed)
```

### Bonnes Pratiques de Développement

#### Quand Générer des Migrations

- ✅ **Avant chaque livraison** en production
- ✅ **Après finalisation** d'une fonctionnalité
- ✅ **Quand le modèle est stable** et testé
- ❌ **Pas à chaque petit changement** en développement

#### Workflow Recommandé

```bash
# Développement itératif rapide
pnpm db:push           # Synchronisation directe sans migration
# ... développement et tests ...

# Quand la fonctionnalité est prête
pnpm db:generate       # Créer la migration officielle
pnpm db:migrate        # Appliquer proprement
# ... commit et livraison ...
```

## 5. Intégration CI/CD

### GitHub Actions - Preview (Branche `dev`)

```yaml
# .github/workflows/preview.yml
- name: Run database migrations
  run: pnpm db:migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

#### Configuration des Secrets GitHub

```bash
# Repository Settings → Secrets → Actions
DATABASE_URL=postgresql://user:pass@preview-host/db
BETTER_AUTH_SECRET=your-preview-secret
STRIPE_SECRET_KEY=sk_test_...
```

### GitHub Actions - Production (Branche `main`)

```yaml
# .github/workflows/production.yml
- name: Run database migrations
  run: pnpm db:migrate
  env:
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

⚠️ **Important** : Les migrations en production sont automatiques via GitHub Actions. Assurez-vous que vos migrations sont testées !

### Variables d'Environnement Requises

#### Développement

```bash
DATABASE_URL="postgresql://localhost:5432/myapp_dev"
BETTER_AUTH_SECRET="dev-secret-key"
STRIPE_SECRET_KEY="sk_test_..."
```

#### Production

```bash
DATABASE_URL="postgresql://prod-host/db?sslmode=require"
BETTER_AUTH_SECRET="prod-secret-key"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## 6. Gestion des Données

### Script de Seed Complet

Le script `seed.ts` insère des données complètes pour le développement :

#### Données Générées

- **4 plans d'abonnement** : Free, Pro, Enterprise, Lifetime
- **14 utilisateurs** avec rôles variés (user, admin, etc.)
- **4 organisations** avec structures de membres
- **Projets et tâches** dans différents états
- **Articles de blog** multilingues (fr/en/es)
- **22 notifications** avec métadonnées typées

#### Protection Production

```typescript
// Le seed refuse de s'exécuter en production
if (process.env.NODE_ENV === 'production') {
  throw new Error('Le seed ne peut pas être exécuté en production')
}
```

### Gestion Multi-Environnement

Le système charge automatiquement le bon fichier d'environnement :

```typescript
// src/db/scripts/env.ts
const envFile = `.env.${process.env.NODE_ENV || 'development'}`
// → .env.development, .env.test, .env.production
```

## 7. Monitoring et Diagnostic

### Vérification de Santé

```bash
# Test de connexion avec métriques
pnpm db:check

# Sortie :
# ✓ Connexion réussie à PostgreSQL
# ✓ Version : PostgreSQL 15.4
# ✓ Temps de réponse : 45ms
```

### Interface Graphique

```bash
# Lancer Drizzle Studio
pnpm db:studio

# Ouvre https://local.drizzle.studio
# Interface pour visualiser et modifier les données
```

### Configuration du Pool de Connexions

```typescript
// src/db/models/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum 20 connexions
  idleTimeoutMillis: 30_000, // 30s timeout
  connectionTimeoutMillis: 10_000, // 10s connection timeout
})
```

## 8. Sécurité et Bonnes Pratiques

### Protection des Environnements

```typescript
// Protection contre l'exécution en test
if (process.env.NODE_ENV === 'test') {
  throw new Error('Database connections are not allowed during tests.')
}
```

### Validation des Variables

```typescript
// Utilisation de Zod pour valider les variables d'environnement
import {z} from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
})

const env = envSchema.parse(process.env)
```

### Migrations Irréversibles

⚠️ **Attention** : Les migrations Drizzle sont unidirectionnelles. Toujours :

- Tester les migrations sur un environnement de preview
- Faire un backup avant les migrations critiques
- Avoir un plan de rollback manuel si nécessaire

## 9. Dépannage Courant

### Erreurs de Connexion

```bash
# Vérifier la connexion
pnpm db:check

# Erreurs communes :
# - URL malformée
# - Certificats SSL (ajouter ?sslmode=require)
# - Firewall/VPN
# - Mauvaises credentials
```

### État Incohérent de la Base

```bash
# Solution rapide (développement)
pnpm db:reset-seed

# Solution progressive (production)
pnpm db:pull          # Importer l'état actuel
pnpm db:generate      # Générer les corrections
pnpm db:migrate       # Appliquer les corrections
```

### Migrations Bloquées

```bash
# Vérifier l'état des migrations
SELECT * FROM __drizzle_migrations;

# En cas de blocage, reset en développement
pnpm db:clear
pnpm db:push
```

## 10. Extension et Personnalisation

### Ajouter un Nouveau Modèle

1. **Créer le fichier** : `src/db/models/mon-model.ts`

```typescript
export const monModel = pgTable('mon_model', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const monModelRelations = relations(monModel, ({one}) => ({
  user: one(user, {fields: [monModel.userId], references: [user.id]}),
}))
```

2. **Exporter dans db.ts**

```typescript
export {monModel} from './mon-model'
```

3. **Générer et migrer**

```bash
pnpm db:generate
pnpm db:migrate
```

### Personnaliser le Seed

```typescript
// src/db/scripts/seed.ts
// Ajouter vos propres données de test
await db.insert(monModel).values([{name: 'Test 1'}, {name: 'Test 2'}])
```

Ce workflow Drizzle offre une expérience de développement moderne et type-safe, avec une intégration fluide entre développement local, preview et production.
