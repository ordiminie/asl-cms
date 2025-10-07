# ShipSaaS a Next.js SaaS Boilerplate

Un boilerplate moderne pour les applications SaaS utilisant Next.js 15, React 19, et ShadCN UI.

> **Documentation complète:** [https://ship-saas.now/fr/docs](https://ship-saas.now/fr/docs)

> **Feuille de route:** Pour consulter les fonctionnalités planifiées, voir [ROADMAP.md](ROADMAP.md)

## Technologies

- **Next.js 15** avec App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **ShadCN UI** (basée sur Radix UI)
- **Vitest** pour les tests
- **Husky** & **lint-staged** pour le CI/CD local

## Installation

```bash
# Installer les dépendances
pnpm install

# Démarrer le serveur de développement
pnpm dev
```

## Scripts disponibles

- `pnpm dev` - Démarre le serveur de développement
- `pnpm build` - Construit l'application pour la production
- `pnpm start` - Démarre l'application en mode production
- `pnpm lint` - Vérifie le code avec ESLint
- `pnpm format` - Vérifie le formatage avec Prettier
- `pnpm format:fix` - Corrige les problèmes de formatage
- `pnpm test` - Exécute les tests avec Vitest

## CI/CD local

Ce projet utilise Husky et lint-staged pour maintenir une qualité de code élevée :

- **Husky** : Configure des hooks Git pour exécuter des scripts avant les commits
- **lint-staged** : Exécute des linters sur les fichiers modifiés avant de les committer

À chaque commit, les vérifications suivantes sont effectuées automatiquement :

1. ESLint vérifie et corrige les problèmes de code dans les fichiers JS/TS
2. Prettier formate correctement tous les fichiers modifiés
3. Vitest exécute les tests liés aux fichiers modifiés

## Structure du projet

```
src/
 ┣ app/
 ┃ ┣ dashboard/         # Espace utilisateur protégé après connexion
 ┃ ┣ (auth)/            # Pages d'authentification (Login, Register)
 ┃ ┣ api/               # API Routes pour les actions côté serveur
 ┃ ┣ layout.tsx         # Layout global
 ┃ ┗ page.tsx           # Page d'accueil
 ┣ components/          # Composants réutilisables (ShadCN UI)
 ┣ lib/                 # Fonctions utilitaires et helpers
```

## Licence

MIT

## Quick Start

- Installer les dépendances

```bash
   pnpm install
```

- Initialisation de la base de données

Pour configurer et initialiser Drizzle dans ce projet, suivez ces étapes :

1. Récupérez une variable `DATABASE_URL` (une base de données Postgres - NeonDB ou autre) et placez-la dans votre fichier `.env` ou executer `pnpm init:env`

2. Exécutez la commande suivante initialiser la database avec des données :

```bash
 pnpm db:reset-seed
```

Note : L'extention uuid doit etre activée : `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; `

3. Lancer le server :

   ```bash
   pnpm dev
   ```

## BDD mode développement

Pour faciliter le développement avec la base de données, voici les commandes utiles :

1. Réinitialisez complètement la base de données avec les données initiales :

   ```bash
   pnpm db:reset-seed
   ```

2. Modifiez les données de seed en éditant le fichier :

   ```
   src/db/scripts/seed.ts
   ```

3. Utilisez l'interface Drizzle Studio pour explorer et modifier la base de données :

   ```bash
   pnpm db:studio
   ```

4. Supprimez un script de migration spécifique :
   ```bash
   pnpm db:drop
   ```

## Génération de AUTH_SECRET

Pour sécuriser l'authentification, vous devez générer un AUTH_SECRET unique. Vous pouvez utiliser la commande suivante :

```bash
openssl rand -base64 32
```

Ou avec Node.js :

```bash
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

Copiez la valeur générée dans votre fichier `.env` :

```
AUTH_SECRET=votre_secret_généré
```

## Configuration de Resend pour les emails

Pour permettre l'envoi d'emails via Resend, vous devez configurer votre clé API :

1. Créez un compte sur [Resend](https://resend.com/) et obtenez votre clé API

2. Ajoutez cette clé dans votre fichier `.env` :
   ```
   RESEND_API_KEY=votre_clé_api_resend
   ```

First, run the development server:

```bash
pnpm dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Playwright

```bash
pnpm exec playwright install
sudo pnpm exec playwright install-deps
pnpm exec playwright install-deps
sudo apt-get install libasound2t64
```
