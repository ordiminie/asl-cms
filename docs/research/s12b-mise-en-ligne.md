# Research — Story s12b-mise-en-ligne

> Exploration faite le 2026-10-02, sur `main` (`be960b9`, arbre propre). Tous les faits ci-dessous ont
> été relevés **en ouvrant les fichiers** — code, configuration, `node_modules/next/dist/docs/` et
> `dist/` de Better Auth 1.7.1 et de Drizzle 0.45.2 — jamais de mémoire. **Rien n'a été exécuté** :
> ni `pnpm build`, ni la suite e2e, ni `pnpm test`, aucune base touchée, aucun service externe
> contacté, aucun serveur réel inspecté. Ce qui en découle sans avoir pu être mesuré est marqué
> **non vérifié**.
>
> C'est une story de déploiement : le « code » inventorié est surtout de la configuration et de
> l'exploitation. Le dépôt est public : aucune valeur de `.env*` n'est reprise ici (noms de variables
> seulement), et le domaine du premier tenant est écrit `asl-exemple.test`.

## Target story

**En tant que** prestataire (SuperAdmin) **je veux** déployer l'application sur un VPS **afin que**
chaque association soit servie en HTTPS sur son propre domaine. Complexité 3. Hors tableau de
périmètre du PRD, exigée par le critère de succès « mise en production effective sur le VPS avant fin
mai 2027 ». Dépend de s01, s01b, s03, s03c, s08b, s12a — toutes livrées sur `main`.

Critères d'acceptation :

1. Sur le serveur déployé, le domaine d'une association provisionnée répond en HTTPS avec un
   certificat valide et sert le site de cette association ; un domaine inconnu répond 404 — test de
   fumée lancé contre l'URL déployée, sur **deux** domaines d'associations distinctes.
2. Une requête HTTP vers le domaine d'une association est redirigée vers HTTPS.
3. Déployer une nouvelle version applique les migrations en attente **avant** que la nouvelle version
   ne serve des requêtes ; une migration en échec interrompt le déploiement et laisse la version
   précédente en service.
4. Un redéploiement conserve les fichiers déjà téléversés (un logo envoyé avant est servi après).
5. Après l'ajout du domaine d'une nouvelle association dans la configuration du serveur, ce domaine
   répond en HTTPS avec un certificat valide et sert cette association — même test de fumée.
6. La purge des empreintes des formulaires publics (s08) est appelée au moins une fois par jour sans
   intervention humaine : une empreinte de plus de 24 h ne survit pas à l'appel planifié suivant.

À vérifier en revue et non en test (notes de la story) : ajouter un domaine ne demande aucune
modification du code ; la procédure d'ajout d'un domaine et de déploiement est écrite dans la
documentation d'exploitation ; aucun workflow restant ne prétend déployer ce qu'il ne déploie pas.

Déjà tranché par la story ou un ADR — **ne pas rouvrir** :

- VPS unique infogéré par le prestataire (ADR 001) ; premier déploiement sur le VPS personnel du
  prestataire, cible LWS : la story est écrite « pour un VPS », pas d'ADR d'hébergement.
- Pas encore de domaine client : le test de fumée tourne sur des **sous-domaines d'un domaine du
  prestataire** (ADR 003 le prévoit).
- Le `Dockerfile` et le `docker-compose.yml` du dépôt ne se réutilisent pas tels quels.
- Hors story : la sauvegarde (s12c), la supervision applicative (Sentry reste tel quel), la montée de
  version du système.
- Un **ADR de déploiement** (mode de déploiement, reverse proxy, certificats) est attendu de cette
  étape. Prochain numéro libre à l'heure de l'écriture : `031` (`docs/decisions/` s'arrête à `030` ;
  la recherche de s12d tourne en parallèle et peut en prendre un). Ses options sont cadrées plus bas,
  le choix revient à l'utilisatrice.

Ce que les stories suivantes attendent de celle-ci :

- **s12c-sauvegarde** : que `LOCAL_STORAGE_ROOT` et le répertoire des sauvegardes locales vivent hors
  du répertoire de l'application déployée ; que l'endroit des planifications soit choisi **et
  documenté** (elle y ajoute la sauvegarde) ; une documentation d'exploitation où consigner
  l'exercice de restauration.
- **s26-envoi-echelonne** : le même endroit de planification, où elle installera le déclencheur du
  planificateur de l'ADR 006 — un appel périodique à une **route interne authentifiée par secret
  partagé**. L'endroit choisi doit donc savoir lancer un script **et** émettre une requête HTTP avec
  un secret.

## Current state of the code

### 1. Build et exécution

| Élément                | État relevé                                                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` l. 8-10 | `dev: next dev --turbopack` · `build: tsx scripts/preflight-build.ts && next build` · `start: next start`                                                                                                                                                   |
| `package.json` l. 174  | `packageManager: pnpm@10.13.1+sha512…` (lu par corepack et par `pnpm/action-setup` en CI). **Aucun champ `engines`.**                                                                                                                                       |
| Node                   | 22 partout : `Dockerfile` l. 1 (`node:22-bookworm`), `ci.yml` l. 60 et 97 (`node-version: 22`), conteneur de dev `v22.23.3`. Next 16.3.0 exige `>=20.9.0`.                                                                                                  |
| `next.config.ts`       | **Pas de clé `output`** (donc ni `standalone` ni `export`) ; `cacheComponents: true` (l. 36) ; `images.remotePatterns` = deux hôtes de démonstration (l. 19-32) ; `serverActions.bodySizeLimit: '16mb'` (l. 53) ; `proxyClientMaxBodySize: '16mb'` (l. 60). |
| Sentry dans la config  | `withSentryConfig` n'est appliqué que si `NEXT_PUBLIC_SENTRY_DSN` est défini **au build** (l. 82-94), avec `tunnelRoute: '/monitoring'`.                                                                                                                    |
| `pnpm-workspace.yaml`  | `onlyBuiltDependencies: protobufjs, sharp` — `sharp@0.35.3` est une dépendance native (binaire par plateforme).                                                                                                                                             |
| `prepare` (l. 32)      | `husky` — s'exécute à chaque `pnpm install`.                                                                                                                                                                                                                |
| `.next/` local         | Un build du 1ᵉʳ octobre est présent : sous-dossier `turbopack/` (le build passe par Turbopack), 270 entrées dans `prerender-manifest.json`.                                                                                                                 |

**Conteneurs — dev seulement, vérifié.** `Dockerfile` : image de l'environnement agentique (git, gh,
`postgresql-client`, `npm install -g @anthropic-ai/claude-code`, utilisateur `dev`, `CMD ["bash"]`) ;
aucune étape de build ni de démarrage de l'application. `docker-compose.yml` : service `dev` (bind
mount du dépôt, port 3000) + service `db` `postgres:17` avec `docker/db-init/` monté dans
`docker-entrypoint-initdb.d`. Il n'y a pas de `.devcontainer/`, ni `.nvmrc`, ni `.npmrc`. Rien de
tout cela n'est utilisable en production en l'état, comme le dit `docs/architecture.md` l. 34-35.

**Ce que `pnpm build` exige aujourd'hui :**

- **La base, deux fois.** `scripts/preflight-build.ts` lance `pnpm db:check` et arrête le build si la
  base ne répond pas (échappatoire `SKIP_DB_CHECK=1`, l. 20-23). Et le prerender **lit la base** :
  `generateStaticParams` de `(public)/blog/category/[category]/page.tsx` l. 18-32 appelle
  `getAllBlogCategoriesDal`, celui de `(public)/blog/[slug]/page.tsx` l. 17-25 appelle
  `getAllUnifiedBlogSlugsDal` (blog hérité). Sans base, le script de garde documente des lectures
  « qui échouent en silence » ; le comportement exact d'un `SKIP_DB_CHECK=1 pnpm build` sans base
  est **non vérifié**.
- **Tout l'environnement validé.** `src/env.ts` valide à l'import (`createEnv`, l. 43-119) ; seul
  `SKIP_ENV_VALIDATION` (l. 111) le neutralise. Les variables **requises sans défaut** sont au § 2.
- **Les `NEXT_PUBLIC_*` au moment du build.** `environment-variables.md` l. 164-166 (docs Next
  embarquées) : toute référence à `process.env.NEXT_PUBLIC_X` est remplacée par la valeur de
  l'environnement **où tourne `next build`**, « in the Node.js environment » compris, et l'application
  « will no longer respond to changes to these environment variables ». `src/env.ts` les lit par
  `process.env.NEXT_PUBLIC_…` littéral (l. 75-104) : elles sont donc **figées au build**, y compris
  `NEXT_PUBLIC_NODE_ENV`, `NEXT_PUBLIC_ENABLED_PAGES`, `NEXT_PUBLIC_AUTH_METHODS` et
  `NEXT_PUBLIC_SENTRY_DSN`. Les variables serveur sans préfixe sont lues à l'exécution.
- **Le réseau, pour les polices.** `src/app/[locale]/base-layout.tsx` l. 2 importe `Public_Sans`,
  `Source_Serif_4` et `JetBrains_Mono` de `next/font/google` (l. 17-36). `font.md` l. 13 : « CSS and
  font files are downloaded at build time ». Le chargeur JS
  (`next/dist/compiled/@next/font/dist/google/loader.js` l. 86-120) réessaie puis **lève**
  `Failed to fetch … from Google Fonts` hors développement ; seul le mode dev retombe sur une police
  de repli (l. 149-156). C'est l'échec vu une fois en CI puis passé à la relance. Le build passe par
  Turbopack, dont l'implémentation de ce chargeur n'a pas été lue : même comportement **non vérifié**
  dans le détail, mais constaté en CI. Aucune police d'interface n'est versée au dépôt :
  `src/assets/fonts/` ne contient que `SourceSerif4-SemiBold.ttf` (image de partage, s11).

**Ce que l'exécution exige :** `next start` écoute par défaut sur `0.0.0.0:3000` (`-H`, `-p`/`PORT`,
relevé dans `next/dist/bin/next`). Plusieurs chemins lisent le disque **relativement à
`process.cwd()`** : `src/assets/fonts/SourceSerif4-SemiBold.ttf` (`api/identity/share-image/route.tsx`
l. 44-47), `content/blog`, `docs/`, `.cursor/rules` (blog et docs hérités), `./drizzle/migrations`
(`migrate.ts` l. 26). Un déploiement qui ne copie que `.next/` les perd.

### 2. Variables d'environnement

Source de vérité : `src/env-schemas.ts` (schémas) et `src/env.ts` (`runtimeEnv`). « Build » = figée au
build (préfixe `NEXT_PUBLIC_`).

| Variable                                     | Requise ?                                         | Lue       | Remarque pour la production                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | **oui**                                           | exécution | Rôle applicatif `asl_app`, ni propriétaire ni `BYPASSRLS` (ADR 002) — `db:check` le vérifie.                                                                                 |
| `DATABASE_MIGRATION_URL`                     | non (retombe sur `DATABASE_URL`)                  | scripts   | Rôle **propriétaire**. La retombée ferait migrer sous `asl_app`, qui ne possède rien.                                                                                        |
| `DATABASE_POOL_MAX`                          | non, **défaut 1**                                 | exécution | Défaut pensé pour le serverless ; `docs/database-pool.md` § 6 recommande 10 à 20 sur un serveur long-running.                                                                |
| `BETTER_AUTH_SECRET`                         | **oui**                                           | exécution | Sert aussi de clé HMAC aux empreintes de limitation de débit (s03, s08b).                                                                                                    |
| `BETTER_AUTH_URL`                            | **oui**                                           | exécution | Depuis l'ADR 022 : **protocole et port de la plateforme**. Doit être en `https://` sans port en production.                                                                  |
| `BETTER_AUTH_TRUSTED_ORIGINS`                | non, **défaut `http://localhost:3000`**           | exécution | Absente, la production fait confiance à `http://localhost:3000` (`TrustedOriginsSchema`, l. 43-54).                                                                          |
| `EMAIL_TRANSPORT`                            | non au schéma, **exigée en production à l'envoi** | exécution | `brevo` attendu. L'erreur part au **premier envoi**, pas au démarrage (`get-email-transport.ts` l. 36-44).                                                                   |
| `BREVO_API_KEY` / `RESEND_API_KEY`           | selon le transport                                | exécution | Exigée seulement pour son transport.                                                                                                                                         |
| `EMAIL_OUTBOX_DIR`                           | non                                               | exécution | Transport `file` uniquement.                                                                                                                                                 |
| `EMAIL_FROM`, `EMAIL_TO`                     | non, **défaut `onboarding@resend.dev`**           | exécution | Expéditeur unique de la plateforme, toutes associations confondues ; `EMAIL_TO` reçoit les emails internes.                                                                  |
| `LOG_LEVEL`                                  | non, défaut `info`                                | exécution | —                                                                                                                                                                            |
| `STORAGE_TYPE`                               | non                                               | exécution | Absente = `local` (s12a).                                                                                                                                                    |
| `LOCAL_STORAGE_ROOT`                         | **oui**                                           | exécution | Voir § 6.                                                                                                                                                                    |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **oui**                                           | exécution | Exigées même si aucun abonnement plateforme n'est encore vendu.                                                                                                              |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`   | non                                               | exécution | OAuth hérité.                                                                                                                                                                |
| `SENTRY_AUTH_TOKEN`                          | non                                               | build     | Secret ; envoi des sourcemaps. Avec `SENTRY_ORG` et `SENTRY_PROJECT` (lus par `next.config.ts`, hors schéma).                                                                |
| `NEXT_PUBLIC_NODE_ENV`                       | non, **défaut `development`**                     | **build** | **À poser à `production`** : voir pièges.                                                                                                                                    |
| `NEXT_PUBLIC_APP_URL`                        | non, défaut `http://localhost:3000`               | **build** | Mono-valeur. Encore lue par les liens OTP et d'invitation (`auth.ts` l. 143, 164), `email-registry.ts` l. 33, `notification-service.ts` l. 239, le blog et les docs hérités. |
| `NEXT_PUBLIC_ALLOWED_MIME_TYPES`             | **oui**                                           | **build** | —                                                                                                                                                                            |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`         | **oui**                                           | **build** | —                                                                                                                                                                            |
| `NEXT_PUBLIC_ENABLED_PAGES`                  | non, défaut liste vide                            | **build** | Sans `admin`, `/admin` est introuvable (`admin/page.tsx` l. 14) : le back-office SuperAdmin en dépend. `blog`, `docs`, `account`… ouvrent les pages héritées.                |
| `NEXT_PUBLIC_AUTH_METHODS`                   | non, défaut `credential,magiclink,google`         | **build** | Décide des moyens de connexion offerts (`(auth)/action.ts` l. 85, 262, 425).                                                                                                 |
| `NEXT_PUBLIC_SENTRY_DSN`                     | non                                               | **build** | Sans elle, Sentry n'est ni compilé ni initialisé.                                                                                                                            |
| Autres `NEXT_PUBLIC_*` (liste ci-dessous)    | non (défauts)                                     | **build** | Héritage du boilerplate, défauts acceptables.                                                                                                                                |

Les « autres `NEXT_PUBLIC_*` » : `NEXT_PUBLIC_MAX_FILE_SIZE`, `NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE`,
`NEXT_PUBLIC_BILLING_MODE`, `NEXT_PUBLIC_GUEST_CHECKOUT_ENABLED`, `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`, et les six `NEXT_PUBLIC_BETTER_AUTH_*`
(`REQUIRE_EMAIL_VERIFICATION`, `2FA_ENABLE`, `2FA_SKIP_VERIFICATION_ON_ENABLE`, `TOKEN_MANAGEMENT`,
`CHANGE_PASSWORD`, `CHANGE_EMAIL`).

Hors schéma, lues directement : `NODE_ENV` (posée par `next build`/`next start`, lue par
`src/db/scripts/env.ts` l. 6, `seed.ts` l. 27, les deux `sentry.*.config.ts`),
`SKIP_ENV_VALIDATION`, `SKIP_DB_CHECK`, `NEXT_PHASE` (logger), `NEXT_RUNTIME`, `PORT`.

**Briques remplacées ou retirées :**

- **Supabase** : plus aucune variable (s12a). `STORAGE_TYPE=supabase` hérité est toléré et ramené à
  `local` (`src/lib/files/storage/env.ts` l. 19-22).
- **Resend** : `RESEND_API_KEY` reste, facultative — transport de secours assumé (ADR 017).
- **Inngest** : aucune variable déclarée, mais le paquet (`package.json` l. 98), la route
  `/api/inngest` et un appel applicatif restent (§ 8).
- **Mailchimp** : `@mailchimp/mailchimp_marketing` (l. 48) et ses types restent dans `package.json` ;
  **aucun import dans `src/`** (grep vide). Dépendance orpheline, aucune variable.
- **Chat IA, crédits, affiliation** : aucune variable au schéma.

**Cohérence des gabarits :**

- `env.example` porte deux noms **absents du schéma** : `AUTH_SECRET` (l. 7) et `MAX_FILE_SIZE`
  (l. 23, le schéma lit `NEXT_PUBLIC_MAX_FILE_SIZE`), plus un commentaire sur l'affiliation retirée
  (l. 59-64). Il **omet** `NEXT_PUBLIC_NODE_ENV`, `NEXT_PUBLIC_ENABLED_PAGES`,
  `BETTER_AUTH_TRUSTED_ORIGINS`, `DATABASE_POOL_MAX`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.
  Qui prépare la production à partir de ce fichier obtient `NEXT_PUBLIC_NODE_ENV=development`.
- `.env.test` (local, non versionné) : noms cohérents avec le schéma, plus `AUTH_SECRET` orphelin.
- `.env.development` porte en plus `NEXT_PUBLIC_AFFILIATE_TRACKING`, orphelin (ADR 009).
- **Il n'existe aucun `.env.production`** dans l'arbre, alors que trois chemins le cherchent :
  `next start` (convention Next), `src/db/scripts/env.ts` (l. 14-16, quand `NODE_ENV=production`) et
  `db_backup.sh` l. 20. `.gitignore` l. 34 ignore `.env*`.
- `scripts/init-env.ts` génère un fichier à partir des schémas ; ses exemples sont ceux du
  développement (`NEXT_PUBLIC_NODE_ENV: 'development'` l. 180).

### 3. CI/CD et hooks

- **`.github/workflows/` ne contient plus que `ci.yml`.** `production.yml` et `preview.yml` ont été
  retirés par `2d6b7d2` (PR 17). `ci.yml` se déclenche sur les PR vers `main` et en manuel (l. 5-9),
  `permissions: contents: read`, et son en-tête dit « Ne déploie rien et ne lit aucun secret ».
  **Aucun workflow ne prétend déployer** : la propriété que la revue de s12b doit vérifier est vraie
  au départ.
- Job `qualite` : `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm check:rules`,
  `pnpm test --run`. Job `e2e` : service `postgres:17`, création du rôle `asl_app` et des extensions
  (l. 105-126), `pnpm db:migrate && pnpm db:seed` (l. 130), `pnpm db:check` (l. 133), puis
  `pnpm test:e2e --project=chromium`, qui lance `pnpm build && pnpm start` (`playwright.config.ts`
  l. 75-78). La CI construit donc déjà le build de production, avec `NEXT_PUBLIC_NODE_ENV: production`
  (l. 47), `EMAIL_TRANSPORT: file`, des clés factices, et **sans `DATABASE_POOL_MAX`** (défaut 1).
- **Husky** : `pre-commit` = `pnpm lint-staged` ; `pre-push` = `pnpm lint`, `pnpm test --run`,
  `pnpm build`. Le `pre-push` lance donc un build complet (base et réseau requis) à chaque `git push`.
- `playwright.config.ts` fixe `baseURL` à `http://localhost:${PORT}` (l. 9-10) et toutes les specs
  s'appuient sur le seed : **aucun test de fumée visant une URL arbitraire n'existe**.

### 4. Base de données en production

- **Migrations** : 31 fichiers, `0000_calm_maddog.sql` à `0030_member_profile_parcel_rls.sql`.
  `pnpm db:migrate` = `tsx src/db/scripts/migrate.ts` : se connecte avec
  `resolveMigrationUrl(process.env)` (`db-url.ts` l. 25-33), exécute
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` (l. 25) puis `migrate(db, {migrationsFolder:
'./drizzle/migrations'})` (l. 26), sort en `0` ou en `1` (l. 32, 40).
- **Atomicité, vérifiée dans `drizzle-orm/pg-core/dialect.js` l. 60-71** : toutes les migrations en
  attente s'exécutent dans **une seule transaction** ; un échec les annule toutes. Aucune migration du
  dépôt ne contient `CONCURRENTLY` ni `COMMIT` ; `0011` fait un `ALTER TYPE … RENAME VALUE`,
  `0022` un `TRUNCATE`.
- **Extensions** : le schéma utilise `uuid_generate_v4()` (26 occurrences dans `0000`, puis `0008`,
  `0012`…), donc `uuid-ossp`. `docker/db-init/01-extensions.sql` et `ci.yml` l. 108-109 créent aussi
  `pgcrypto`, mais **aucune migration ni aucun fichier de `src/db` n'appelle une fonction de
  `pgcrypto`** (grep vide).
- **Rôle `asl_app`** : il n'est créé **par aucune migration**. Il existe à deux endroits, tous deux
  hors production : `docker/db-init/03-app-role.sql` (dev) et `ci.yml` l. 105-126 (CI) —
  `CREATE ROLE asl_app LOGIN … NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
NOBYPASSRLS`, `GRANT CONNECT`, `GRANT USAGE ON SCHEMA public`, `SELECT, INSERT, UPDATE, DELETE`
  sur les tables, `USAGE, SELECT` sur les séquences, et surtout
  `ALTER DEFAULT PRIVILEGES FOR ROLE <propriétaire>` pour les tables **futures**. Le commentaire de
  `ci.yml` l. 102-104 précise qu'il faut le poser **avant** les migrations.
- **Garde-fou** : `pnpm db:check` (`check.ts` l. 13-52) se connecte avec `DATABASE_URL` et échoue si
  le rôle courant porte `SUPERUSER` ou `BYPASSRLS` (`assertApplicationRolePrivileges`,
  `role-privileges.ts` l. 17-42). Il est appelé par le build (préflight).
- **Seed** : `src/db/scripts/seed.ts` (734 lignes) est **entièrement un jeu de test** — douze comptes
  `@gmail.com` au mot de passe connu, quatre organisations dont deux servies sur `localhost` et
  `127.0.0.1` (l. 277-283), identifiants de prix Stripe, blog, notifications, paramètres et fiches de
  test. Garde l. 27-29 : `if (process.env.NODE_ENV === 'production') throw`. Il insère aussi les
  seules lignes `app_settings` et `subscription_plan` existantes (aucune migration n'en insère).
- **Scripts destructifs sans garde** : `db:clear` (`clear.ts`, supprime toutes les tables et le
  schéma `drizzle`), `db:reset-seed`, `db:push --force`, `db:drop`. `db:baseline` contient des
  vérifications d'objets du boilerplate d'avant le squash (`0000_minor_kylun`…, tags absents du
  dépôt) : sans objet sur une base neuve.
- **Provisioning du premier tenant** : il n'existe qu'**un** chemin, l'écran
  `/admin/organizations/new` → `provisionOrganizationAction` (`admin/organizations/actions.ts`
  l. 195-244) → `provisionOrganizationService` (`organization-service.ts` l. 669-735), qui exige une
  session de rôle `super_admin` (`canProvisionOrganization`, `organization-authorization.ts`
  l. 477-481). Or `[locale]/layout.tsx` l. 52 appelle `requireCurrentTenantDal()` pour **toute**
  page : « tout domaine servant l'application doit être provisionné, back-office du prestataire
  compris » (l. 49-51). Sur une base neuve, sans organisation ni compte `super_admin`, **aucune page
  ne s'affiche et l'écran de provisioning est inatteignable**. La revue de s01 l'a consigné (majeur 1
  et section « Avant déploiement — ce n'est pas une correction de code ») ; rien ne l'a résolu
  depuis : aucun script d'amorçage n'existe dans `src/db/scripts/` ni dans `scripts/`.

### 5. Multi-domaine

- **Résolution du tenant** : `getCurrentTenantDal` (`src/app/dal/tenant-dal.ts` l. 71-84) lit
  `x-forwarded-host` **puis** `host`, normalise (`normalizeTenantHost`, `tenant-helper.ts` l. 11-28 :
  minuscules, port et point final retirés) et délègue à `getTenantByDomainDal` (l. 42-63,
  `'use cache'`, `cacheLife('hours')`, `cacheTag('tenant')`). Correspondance **exacte** avec
  `organization.domain` (`text`, contrainte `organization_domain_unique`, migration `0003`).
- **`src/proxy.ts`** ne résout aucun tenant : redirection de `/api/auth/error`, contrôle optimiste du
  cookie de session sur `AUTHENTICATED_SEGMENTS`, middleware next-intl, en-tête `x-theme`. Ses
  redirections sont construites sur `request.url` (l. 36, 54) et le cookie `theme` est `secure` selon
  `request.nextUrl.protocol` (l. 90). Le matcher exclut `/api` (sauf `/api/auth/error`).
  **Fait nouveau par rapport à l'ADR 003** : en Next 16 le proxy tourne sur le runtime Node.js
  (`proxy.md` l. 223) — déjà noté par l'ADR 013.
- **Ce que Next fait des en-têtes** (`next/dist/server/base-server.js` l. 609-612) : il **complète
  sans écraser** — `x-forwarded-host ??= host`, `x-forwarded-proto ??= https|http` selon la socket,
  `x-forwarded-port`, `x-forwarded-for ??= adresse distante de la socket`. Un en-tête `x-forwarded-*`
  reçu est donc conservé tel quel.
- **Server Actions** : Next compare l'en-tête `Origin` à `x-forwarded-host`, sinon `host`
  (`data-security.md` l. 550 ; `action-handler.js` l. 353, 438) et abandonne l'action s'ils
  diffèrent. `serverActions.allowedOrigins` n'est pas configuré.
- **Better Auth (s03c, ADR 022)** — `src/lib/better-auth/auth.ts` :
  - pas d'option `baseURL` : Better Auth lit `BETTER_AUTH_URL` (`dist/utils/url.mjs` l. 68-72) et la
    fixe (`create-context.mjs` l. 63, 85) ;
  - `trustedOrigins: trustedOriginsOf` (l. 271) : liste d'environnement + origine de l'association
    servie par l'hôte de la requête, lue en base à chaque requête (`association-origin.ts` l. 76-88),
    l'hôte venant de `requestHostOf` (l. 8-11 : `x-forwarded-host` d'abord) ;
  - `advanced` ne contient que `database.generateId` (l. 106-110) : **ni `trustedProxyHeaders`, ni
    `useSecureCookies`, ni `ipAddress`, ni `crossSubDomainCookies`** ;
  - le préfixe `__Secure-` du cookie est décidé par `baseURL.startsWith('https://')`
    (`dist/cookies/index.mjs` l. 23), donc par `BETTER_AUTH_URL`, **pas** par un en-tête ;
    `getSessionCookie` du proxy lit les deux noms (l. 266) ;
  - l'origine d'une association = `BETTER_AUTH_URL` dont le nom d'hôte devient
    `organization.domain` (`associationOriginOf`, l. 25-35) : le lien de connexion, le logo de
    l'email, `metadataBase` et le sitemap de s11 en héritent le **protocole et le port** ;
  - le lien magique n'est envoyé qu'à un **membre de l'association du domaine appelé**
    (`magic-link-integration.ts` l. 190).
- **Locale** : `src/i18n/routing.ts` déclare encore `['en', 'fr', 'es']`, défaut `en` — l'ADR 008
  n'est pas appliqué (story s43, non livrée). Une requête sur `/` est redirigée par le middleware
  next-intl vers une adresse préfixée ; l'ADR 013 a mesuré un `307` sur une locale inconnue.
- **Statut d'un domaine inconnu, mesuré par l'ADR 013 et tenu par
  `e2e/tenant-isolation.spec.ts` l. 104-117** : une **page** appelée sur un domaine sans association
  rend l'écran introuvable avec un statut **200**. Seuls les Route Handlers rendent un vrai 404 :
  `GET /api/identity/favicon` rend `404` sans tenant (`api/identity/[kind]/route.ts` l. 67-70) et
  `200` avec le monogramme de l'association sinon (l. 87-94).

### 6. Fichiers sur le disque

- Factory : `createStorage(type, config)` (`storage-factory.ts` l. 8-20), seul adaptateur
  `createLocalStorage(config, env.LOCAL_STORAGE_ROOT)`.
- **Racine réelle = `LOCAL_STORAGE_ROOT/<basePath>`**, où `basePath` vaut `prod` si
  `NEXT_PUBLIC_NODE_ENV === 'production'` et `dev` sinon (`storage/env.ts` l. 42-45 ;
  `local-storage.ts` l. 52 : `path.resolve(rootDir, config.basePath)`). Un chemin relatif se résout
  contre le répertoire de travail du processus (`env.example` l. 29 propose `.storage`).
- Écriture par fichier temporaire **dans le répertoire cible** puis `rename` (l. 54-64) : la racine
  doit être inscriptible par l'utilisateur du processus, sur un seul système de fichiers.
- `files-repository.ts` l. 6-7 construit le stockage **au chargement du module**.
- Service : jamais de fichier statique. `GET /api/identity/{logo|favicon}` (clé lue en base),
  `GET /api/files/[...key]` et `GET /api/pages/files/[...key]` (`content-file-route.ts`), tenant du
  domaine appelé, `Cache-Control: public, max-age=31536000, immutable` sur les clés versionnées.
- **À faire persister entre deux déploiements** : `LOCAL_STORAGE_ROOT` (critère 4) et, pour s12c, le
  répertoire des sauvegardes locales. `.next/cache` (cache d'images et de données de Next) peut être
  perdu sans dommage. `/.storage/` est le répertoire de dev, ignoré par git.

### 7. Email

- Contrat : `EmailTransport = {send(message: EmailMessage): Promise<void>}`
  (`src/lib/emails/transport/email-transport.ts` l. 18-20) ; quatre implémentations — `brevo`
  (`fetch` vers `https://api.brevo.com/v3/smtp/email`, en-tête `api-key`), `resend`, `file`,
  `memory` — choisies par `EMAIL_TRANSPORT` (`get-email-transport.ts` l. 50-71), résolues **une
  fois** par processus (l. 76-79).
- ⚠️ Écart avec l'ADR 005 : le contrat livré n'expose **que l'envoi unitaire** — ni campagne, ni
  statistiques, ni budget. C'est le périmètre de s25, s26 et s30, pas un défaut de s12b.
- Expéditeur : `getEmailFrom()` (`email-service.ts` l. 54-66) = paramètre plateforme
  `email.communication_email` de `app_settings` s'il existe, sinon `EMAIL_FROM`, sinon
  `onboarding@resend.dev`. Un seul expéditeur pour toutes les associations.
- Interrupteurs : `shouldSendEmail` (l. 70-98) laisse toujours passer `recipientType: 'system'`
  (lien de connexion, message de contact, signalement) ; pour `admin` et `client` il lit
  `app_settings`, où **une ligne absente vaut `false`** (`getBooleanSettingService`,
  `app-settings-service.ts` l. 120-126). Ces lignes ne sont créées que par le seed.
- Production : `EMAIL_TRANSPORT=brevo` + `BREVO_API_KEY`, un `EMAIL_FROM` dont le domaine est
  authentifié chez Brevo (SPF/DKIM — exigence du fournisseur, **non vérifiée ici**), et un accès
  sortant HTTPS vers `api.brevo.com`.

### 8. Tâches planifiées

- **`scheduled_job` n'existe pas** : aucune occurrence dans `src/` ni dans `drizzle/` (grep vide). La
  table, la route interne à secret partagé et le déclencheur sont l'affaire de **s26** (ADR 006).
- **Aucun point d'entrée cron HTTP n'existe.** Le seul point d'entrée « appelable seul » est le
  script de s08b : `pnpm tsx src/db/scripts/purge-rate-limit-fingerprints.ts`. Il enregistre un hook
  de résolution pour `server-only` (`registerHooks` de `node:module`, l. 11-23), charge
  l'environnement par `initDotEnv()`, importe la façade, affiche
  `Empreintes purgees : N (associations : M)` et sort en `0` ou `1`.
  `e2e/rate-limit.spec.ts` l. 324-344 l'exécute exactement ainsi et vérifie son effet en base.
- **Reste d'Inngest** : `src/lib/inngest/{inngest,events,functions}.ts`, la route
  `src/app/api/inngest/route.ts` (sert `helloWorld` et `sendWelcomeFollowUpEmail`), et un appel
  vivant — `triggerInngestWelcomeFollowUpEmail` dans `src/services/user-service.ts` l. 230, sous
  `try/catch`, à l'initialisation d'un compte créé par Better Auth. Le client passe en mode non-dev
  dès que `NEXT_PUBLIC_NODE_ENV === 'production'` (`inngest.ts` l. 7-10). L'ADR 006 prévoit son
  retrait ; aucune story ne le porte nommément.

### 9. Stripe

- Le webhook actif est celui du plugin Better Auth : `POST /api/auth/stripe/webhook` (script
  `stripe:listen`, `package.json` l. 34 ; plugin `stripe({stripeClient, stripeWebhookSecret:
env.STRIPE_WEBHOOK_SECRET, createCustomerOnSignUp: true, …})`, `auth.ts` l. 191-269).
- `src/app/api/webhooks/stripe/route.ts` est marqué `@deprecated` et neutralisé
  (`disableWebhook = true`, l. 76).
- `stripeClient` est instancié **à l'import** (`stripe-client.ts` l. 7-9). Les plans
  (`subscription_plan`) ne sont insérés que par le seed, avec des identifiants de prix de test.
- En production : une clé secrète et un secret de webhook réels, un point de terminaison déclaré chez
  Stripe sur **un** domaine servi en HTTPS, et le chemin `/api/auth/*` non filtré par le reverse proxy.

### 10. Journalisation et supervision

- `src/lib/logger.ts` : Winston, **un seul transport `Console`** (les transports fichier sont
  commentés, l. 52-67), neutralisé pendant `NEXT_PHASE=phase-production-build` (l. 97, 108-112). Les
  journaux partent sur la sortie standard : leur conservation dépend du gestionnaire de processus.
  Plusieurs chemins hérités utilisent `console.log` (`auth.ts` l. 396-414).
- Sentry : entièrement conditionné à `NEXT_PUBLIC_SENTRY_DSN` (`next.config.ts` l. 82,
  `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`).
  `src/instrumentation.ts` exporte `onRequestError = Sentry.captureRequestError`.
- **Aucune route de santé** : `grep -ril health src/app` ne trouve que des pages MDX de la
  documentation héritée.

### 11. Limitation de débit et adresse IP derrière un proxy

- **Formulaires publics (s08b, s10)** : `readVisitorIp()` (`src/lib/helper/visitor-ip.ts` l. 15-23)
  prend la **dernière** entrée non vide de `x-forwarded-for`, sinon `x-real-ip`. Sans IP, l'envoi
  passe sans être compté.
- **Better Auth** : sa limitation de débit est **activée par défaut en production**
  (`create-context.mjs` l. 171 : `enabled: options.rateLimit?.enabled ?? isProduction`), 100 requêtes
  par 10 s, stockage en mémoire. Son IP vient de `getIP` (`@better-auth/core/dist/utils/ip.mjs`) :
  en-tête `x-forwarded-for` par défaut ; **sans `advanced.ipAddress.trustedProxies`, seul un en-tête
  à valeur unique est accepté** (`if (forwardedIps.length !== 1) return null`). Sans IP, toutes les
  requêtes d'un même chemin partagent le seau `no-trusted-ip` (`rate-limiter/index.mjs` l. 232-246).
  La règle du lien magique (30 ouvertures par minute, s03) suit la même résolution.
- Le blog hérité garde un `RateLimiterMemory` (`rate-limiter-flexible`), hors périmètre.
- `src/components/features/user/action.ts` l. 467-468 lit aussi `x-forwarded-for` / `x-real-ip`
  (écran hérité).

### 12. Documentation de déploiement et d'exploitation existante

| Document                                                                                     | Nature                                                                                                                                              |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                                                  | **Hérité** (« ShipSaaS a Next.js SaaS Boilerplate »), retouché pour l'email (l. 174-187) et le préflight (l. 40-55). Aucune section de déploiement. |
| `docs/database-pool.md`                                                                      | Hérité. Écrit pour le serverless ; le § 6 traite le serveur long-running.                                                                           |
| `docs/drizzle-development-workflow.md`                                                       | Hérité. Cite encore `.github/workflows/production.yml` (l. 275-285), **retiré**.                                                                    |
| `docs/sentry.md`, `docs/e2e-testing.md`, `docs/inngest.md`, `docs/authentication-system.md`… | Hérités (sous-systèmes du boilerplate).                                                                                                             |
| `src/app/[locale]/docs/_files/*/10-deployment/`                                              | Hérité : déploiement Vercel et GitHub Actions du boilerplate, servi par l'application si `docs` est activé.                                         |
| `db_backup.sh`, `db_restore.sh`                                                              | Hérités ; interactifs, lisent `.env.production` (s12c).                                                                                             |
| `docs/architecture.md`, ADR 001 à 030                                                        | **Projet.** Posent le cadre (VPS, disque, Brevo, cron) sans procédure.                                                                              |
| `docs/reviews/s01-provisionner-association.md`, « Avant déploiement »                        | **Projet.** La seule consigne d'exploitation écrite à ce jour (domaines à renseigner).                                                              |

**Il n'existe aucune documentation d'exploitation propre au projet** : ni procédure de déploiement,
ni procédure d'ajout de domaine, ni emplacement convenu pour l'écrire.

## Anchor points

Où la story se branche. La plupart des points sont de la configuration **nouvelle** ; ceux qui
existent déjà sont marqués.

- **Déclencheur quotidien (critère 6)** — existant :
  `src/db/scripts/purge-rate-limit-fingerprints.ts` →
  `purgeExpiredRateLimitFingerprintsService` (`src/services/rate-limit-service.ts` l. 231-243,
  exposé par `src/services/facades/rate-limit-service-facade.ts` l. 9-10). Reste à poser la
  planification système qui l'appelle, à l'endroit que s12c et s26 réutiliseront.
- **Migrations au déploiement (critère 3)** — existant : `pnpm db:migrate`
  (`src/db/scripts/migrate.ts`), code de sortie exploitable, une seule transaction. `pnpm db:check`
  comme garde du rôle applicatif.
- **Amorçage du serveur de base** — à écrire, sur le modèle de `docker/db-init/01-extensions.sql` et
  `03-app-role.sql` (ou de `ci.yml` l. 105-126) : extensions, rôle propriétaire, rôle `asl_app`,
  privilèges par défaut.
- **Premier tenant et premier SuperAdmin** — aucun point d'ancrage existant. Les briques réutilisables
  sont `createOrganizationDao`, `createUserDao`, `createOrganizationMemberDao` et
  `upsertOrganizationSettingsDao` (appelés par `provisionOrganizationService` l. 694-728) ; le service
  lui-même exige une session.
- **Fichiers (critère 4)** — existant : la seule variable `LOCAL_STORAGE_ROOT` ; aucun code à
  toucher si elle pointe hors du répertoire déployé.
- **Reverse proxy et certificats (critères 1, 2, 5)** — configuration nouvelle, hors de `src/`. Côté
  application, trois lecteurs d'en-têtes fixent le contrat : `getCurrentTenantDal`
  (`tenant-dal.ts` l. 73-76), `requestHostOf` (`association-origin.ts` l. 8-11), `readVisitorIp`
  (`visitor-ip.ts` l. 15-23) ; plus Next lui-même (origine des Server Actions, protocole de
  `request.url`) et Better Auth (`getIP`).
- **Options Better Auth, si le plan en active** : objet `advanced` de `auth.ts` l. 106-110.
- **Test de fumée (critères 1, 2, 5)** — rien d'existant ne vise une URL déployée. Sondes disponibles
  sans ajouter de route : la page d'accueil (titre = nom de l'association, s11 —
  `e2e/homepage.spec.ts` l. 8) et `GET /api/identity/favicon` (vrai `404` sur domaine inconnu, `200`
  sur domaine provisionné).
- **Build et polices** : `src/app/[locale]/base-layout.tsx` l. 2-36 si le plan veut un build sans
  réseau ; `next.config.ts` si l'ADR retient un mode de sortie.
- **CI** : `.github/workflows/ci.yml` (seul workflow). Tout workflow de déploiement serait nouveau.
- **Gabarit d'environnement** : `env.example`, `scripts/init-env.ts`.
- **Documentation d'exploitation** : emplacement à créer sous `docs/` (aucun n'existe) ;
  `docs/architecture.md` (ligne « Hébergement » du tableau Stack, l. 32, et l. 34-35) à tenir à jour.

## Verified APIs / functions

| Nom exact                                     | Signature / clé                                                                                      | Emplacement                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| script `build`                                | `tsx scripts/preflight-build.ts && next build`                                                       | `package.json` l. 9                                                |
| script `start`                                | `next start` (`-p`/`PORT`, `-H`, défaut `0.0.0.0:3000`)                                              | `package.json` l. 10 ; `next/dist/bin/next`                        |
| script `db:migrate`                           | `tsx src/db/scripts/migrate.ts`                                                                      | `package.json` l. 23                                               |
| script `db:check`                             | `tsx src/db/scripts/check.ts`                                                                        | `package.json` l. 21                                               |
| `resolveMigrationUrl`                         | `(env: DatabaseUrlEnv) => string` — `DATABASE_MIGRATION_URL` sinon `DATABASE_URL`, sinon lève        | `src/db/scripts/db-url.ts` l. 25-33                                |
| `initDotEnv`                                  | `(environment = process.env.NODE_ENV \|\| 'development') => Promise<void>` — charge `.env.<env>`     | `src/db/scripts/env.ts` l. 5-45                                    |
| `assertApplicationRolePrivileges`             | `(role: RolePrivileges \| undefined) => void` — lève sur `SUPERUSER` / `BYPASSRLS`                   | `src/db/scripts/role-privileges.ts` l. 17-42                       |
| `purgeExpiredRateLimitFingerprintsService`    | `() => Promise<RateLimitPurgeResult>` (`{organizations, deleted}`), sans contrôle d'autorisation     | `src/services/rate-limit-service.ts` l. 231-243                    |
| script de purge                               | `pnpm tsx src/db/scripts/purge-rate-limit-fingerprints.ts` — sortie `0` / `1`                        | fichier homonyme                                                   |
| `getCurrentTenantDal`                         | `() => Promise<TenantDTO \| undefined>` — `x-forwarded-host ?? host`                                 | `src/app/dal/tenant-dal.ts` l. 71-84                               |
| `getTenantByDomainDal`                        | `(domain: string) => Promise<TenantDTO \| undefined>`, `'use cache'`, tag `TENANT_CACHE_TAG`         | `src/app/dal/tenant-dal.ts` l. 42-63                               |
| `requireCurrentTenantDal`                     | `() => Promise<TenantDTO>` — `notFound()` sinon                                                      | `src/app/dal/tenant-dal.ts` l. 93-100                              |
| `normalizeTenantHost`                         | `(host: string \| null \| undefined) => string \| undefined`                                         | `src/lib/helper/tenant-helper.ts` l. 11-28                         |
| `requestHostOf`                               | `(headers: Headers \| undefined) => string \| undefined`                                             | `src/lib/better-auth/association-origin.ts` l. 8-11                |
| `associationOriginOf`                         | `(domain, platformUrl = env.BETTER_AUTH_URL) => string \| undefined`                                 | `src/lib/better-auth/association-origin.ts` l. 25-35               |
| `trustedOriginsOf`                            | `(request?: Request) => Promise<string[]>`                                                           | `src/lib/better-auth/association-origin.ts` l. 76-88               |
| `readVisitorIp`                               | `() => Promise<string \| undefined>` — dernière entrée de `x-forwarded-for`, sinon `x-real-ip`       | `src/lib/helper/visitor-ip.ts` l. 15-23                            |
| `AUTHENTICATED_SEGMENTS`                      | `readonly string[]` : `/account`, `/admin`, `/bureau`, `/dashboard`, `/team`                         | `src/lib/routing/authenticated-segments.ts` l. 9-15                |
| `provisionOrganizationService`                | `(params: ProvisionOrganization) => Promise<ProvisionedOrganization>` — session `super_admin` exigée | `src/services/organization-service.ts` l. 669-735                  |
| `provisionOrganizationAction`                 | `(prevState?, formData?) => Promise<ProvisionFormState>` — `withRlsBypass` + `updateTag('tenant')`   | `src/app/[locale]/admin/organizations/actions.ts` l. 195-244       |
| `getAllOrganizationIdsDao`                    | `() => Promise<string[]>`                                                                            | `src/db/repositories/organization-repository.ts` l. 448            |
| `createStorage`                               | `(type: StorageType, config: StorageConfig) => StorageOperations`                                    | `src/lib/files/storage/storage-factory.ts` l. 8-20                 |
| `getStorageConfig`                            | `() => {type, config}` — `basePath` = `prod` \| `dev` selon `NEXT_PUBLIC_NODE_ENV`                   | `src/lib/files/storage/env.ts` l. 42-55                            |
| `EmailTransport`                              | `{send: (message: EmailMessage) => Promise<void>}`                                                   | `src/lib/emails/transport/email-transport.ts` l. 18-20             |
| `EMAIL_TRANSPORT_NAMES`                       | `['brevo', 'resend', 'file', 'memory']`                                                              | `src/lib/emails/transport/email-transport.ts` l. 22-27             |
| `resolveEmailTransport` / `getEmailTransport` | `(config: EmailTransportConfig) => EmailTransport` / `() => EmailTransport` (mémoïsé)                | `src/lib/emails/transport/get-email-transport.ts` l. 50-71 / 76-79 |
| `BREVO_SEND_URL`                              | `'https://api.brevo.com/v3/smtp/email'`                                                              | `src/lib/emails/transport/brevo-transport.ts` l. 8                 |
| `withTenant` / `withRlsBypass` / `getDb`      | `(organizationId, callback)` / `(callback)` / `() => ScopedDb`                                       | `src/db/tenant-scope.ts` l. 128-137 / 144-146 / 122                |
| `GET /api/identity/[kind]`                    | `kind ∈ {logo, favicon}` ; `404` sans tenant                                                         | `src/app/api/identity/[kind]/route.ts` l. 58-97                    |
| `GET /api/files/[...key]`                     | `createContentFileGET(scopes?)`                                                                      | `src/app/api/files/content-file-route.ts` l. 41-69                 |
| `POST /api/auth/stripe/webhook`               | route du plugin `@better-auth/stripe`, servie par `toNextJsHandler(auth)`                            | `src/app/api/auth/[...all]/route.ts` ; `auth.ts` l. 191-269        |
| Migrateur Drizzle                             | `migrate(db, {migrationsFolder})` — une transaction pour toutes les migrations en attente            | `drizzle-orm/pg-core/dialect.js` l. 44-72                          |
| En-têtes complétés par Next                   | `x-forwarded-host`, `-port`, `-proto`, `-for` posés par `??=`                                        | `next/dist/server/base-server.js` l. 609-612                       |
| Better Auth `getBaseURL`                      | option `baseURL`, sinon `BETTER_AUTH_URL` ; en-têtes de proxy seulement avec `trustedProxyHeaders`   | `better-auth/dist/utils/url.mjs` l. 68-86                          |
| Better Auth `getIP`                           | `x-forwarded-for` ; valeur unique exigée sans `advanced.ipAddress.trustedProxies`                    | `@better-auth/core/dist/utils/ip.mjs` (`getIPFromHeader`, `getIP`) |

**N'existent pas** (vérifié par recherche) : table ou modèle `scheduled_job` ; route de santé ; route
interne de planification ; script d'amorçage du premier tenant ou du premier SuperAdmin ; test de
fumée paramétrable par URL ; `Dockerfile` de production ; configuration de reverse proxy ; unité de
service ou crontab ; `.env.production` ; documentation d'exploitation ; clé `output` dans
`next.config.ts` ; champ `engines` dans `package.json`.

## Traps & constraints

Les quatre pièges des notes de la story restent entiers ; ils sont précisés ici par ce que le code
montre, puis complétés par ceux que la story ne nomme pas.

### Pièges de la story, précisés

**P1 — L'en-tête `Host`.** Un proxy qui réécrit `Host` sans poser `X-Forwarded-Host` rend toutes
les associations introuvables **et** fait rejeter toutes les Server Actions (comparaison `Origin` /
hôte). Deux formes fonctionnent : conserver `Host`, ou poser `X-Forwarded-Host`. Mais comme Next
**n'écrase pas** un `x-forwarded-*` reçu, et que `getCurrentTenantDal` lit `x-forwarded-host` en
premier, **un visiteur qui envoie lui-même `X-Forwarded-Host: <domaine de B>` au domaine de A est
servi comme B** si le proxy laisse passer cet en-tête. Le proxy doit donc **écraser**
`X-Forwarded-Host`, `X-Forwarded-Proto` et `X-Forwarded-For`, jamais les transmettre. Même raison
pour ne pas exposer le port de l'application : `next start` écoute sur `0.0.0.0` par défaut.

**P2 — Retour arrière d'une migration.** Le migrateur est transactionnel : une migration en échec ne
laisse rien d'appliqué (vérifié dans Drizzle). Ce qui n'est pas couvert : (a) une migration
**réussie** suivie d'un build ou d'un démarrage en échec laisse l'ancienne version tourner sur un
schéma déjà migré — aucune migration descendante n'existe ; (b) entre la migration et la bascule,
l'ancienne version sert sur le nouveau schéma. La story dit de ne pas promettre davantage.

**P3 — Certificats.** `organization.domain` est comparé **exactement** : `www.asl-exemple.test` et
`asl-exemple.test` sont deux domaines, et un seul peut servir l'association (contrainte d'unicité).
Sans redirection au niveau du proxy, la variante non provisionnée affiche la page introuvable — avec
un certificat à obtenir pour elle aussi. Pour le test de fumée, un « domaine inconnu » qui doit
répondre en HTTPS a lui aussi besoin d'un certificat valide.

**P4 — Le build.** Il a besoin de la base (préflight + prerender du blog hérité), de toutes les
variables requises, des `NEXT_PUBLIC_*` définitives, et du réseau vers Google Fonts. Un build fait
ailleurs que sur le serveur doit donc recevoir une base migrée et les valeurs publiques de
production ; un build fait sur le serveur consomme ses 2 vCore / 4 Go (le `.next/` local pèse 3,1 Go,
caches et dossier `dev` compris — coût mémoire d'un build **non mesuré**).

### Pièges que la story ne nomme pas

**T1 — L'amorçage : aucune page ne s'affiche sur une base neuve.** Pas d'organisation, pas de
SuperAdmin, pas d'écran atteignable (§ 4). Le seed est la seule chose qui crée un `super_admin`, et
c'est un jeu de test. Le premier tenant et le premier compte SuperAdmin doivent donc être créés
**hors du produit**, par un chemin à concevoir. Deux conséquences à ne pas découvrir en production :
(a) le lien magique n'est envoyé qu'à un membre de l'association du domaine appelé — un SuperAdmin
sans appartenance ne peut pas en recevoir, il lui faut une appartenance ou la connexion par mot de
passe (`credential`) ; (b) `getTenantByDomainDal` met en cache son résultat pour des heures, **y
compris l'absence** (inféré du code, non mesuré) : une ligne insérée en SQL ne sera vue qu'après
redémarrage ou expiration, puisque seul `provisionOrganizationAction` appelle `updateTag('tenant')`.

**T2 — Le garde du seed tient à `NODE_ENV`, pas à la base visée.** `pnpm db:seed` lancé dans un
shell du serveur où `NODE_ENV` n'est pas exporté passe le garde (l. 27), `initDotEnv` cherche
`.env.development`, ne le trouve pas, **avertit et continue** avec l'environnement du processus : si
`DATABASE_URL` / `DATABASE_MIGRATION_URL` y pointent la production, douze comptes au mot de passe
connu y sont créés. `db:clear`, `db:reset-seed` et `db:push --force` n'ont aucun garde.

**T3 — `NEXT_PUBLIC_NODE_ENV` vaut `development` par défaut et se fige au build.** Oubliée au build
de production : transport d'email `file` silencieux (rien ne part, aucune erreur), fichiers écrits
sous `<racine>/dev`, client Inngest en mode dev. Changée entre deux builds, elle déplace la racine
des fichiers de `dev` à `prod` : les logos déjà envoyés deviennent introuvables — exactement ce que
le critère 4 détecte, mais pour une autre cause que celle attendue.

**T4 — `LOCAL_STORAGE_ROOT` relatif.** La valeur de `env.example` (`.storage`) se résout contre le
répertoire de travail : dans un répertoire de version ou un conteneur, elle est effacée à chaque
déploiement. Chemin **absolu**, hors de l'application, inscriptible par l'utilisateur du service — et
le même pour le processus web et pour tout script.

**T5 — Les scripts ont besoin de `tsx`, des sources et de tout l'environnement.** `db:migrate`,
`db:check`, la purge et le préflight passent par `tsx` (**devDependency**, `package.json` l. 169) et
lisent `src/` et `drizzle/`. Un mode de déploiement qui n'embarque que la sortie du build (`output:
'standalone'`, `pnpm install --prod`) les rend inexécutables. Le script de purge importe la façade,
donc `@/env` : **toutes** les variables requises doivent être présentes dans l'environnement du cron,
sinon il sort en `1` sur `Invalid environment variables`. `initDotEnv` charge `.env.production` du
répertoire courant seulement si `NODE_ENV=production`. `registerHooks` (`node:module`) demande un
Node 22 récent (22.23.3 en dev ; version minimale **non vérifiée** dans la documentation de Node).

**T6 — `X-Forwarded-For` : deux lecteurs, deux règles.** `readVisitorIp` prend la **dernière**
entrée ; Better Auth n'accepte qu'un en-tête **à valeur unique** tant que `trustedProxies` n'est pas
configuré. Un proxy qui **ajoute** à l'en-tête du client satisfait le premier et prive le second
d'IP : toutes les ouvertures de lien magique de toutes les associations partagent alors un seul seau
de 30 par minute, et le reste de `/api/auth/*` un seau de 100 par 10 s. Un proxy qui **écrase**
l'en-tête par la seule adresse du client satisfait les deux, sans toucher au code.

**T7 — `X-Forwarded-Proto` et `BETTER_AUTH_URL`.** Le cookie `__Secure-` et l'origine de chaque
association dépendent de `BETTER_AUTH_URL` (`https://`, sans port), pas des en-têtes. En revanche les
redirections de `src/proxy.ts` sont construites sur `request.url`, dont le protocole vient de
`x-forwarded-proto` : sans cet en-tête, une redirection vers `/login` repart en `http://` (un aller
et retour de plus par le proxy ; **non vérifié sur serveur réel**). `BETTER_AUTH_URL` porte aussi un
nom d'hôte : celui de « la plateforme », à choisir — et, comme tout domaine servant l'application,
à provisionner s'il doit afficher une page.

**T8 — Limite de corps du proxy.** L'enveloppe applicative est de 16 Mo (`next.config.ts` l. 53, 60) ; `docs/architecture.md` et l'ADR 026 renvoient explicitement à s12b la limite du serveur web,
qui « tronque au-delà ». Au-dessous de 16 Mo côté proxy, un dépôt d'affiche + PDF est refusé sans le
message de l'application.

**T9 — Streaming.** Toutes les pages `[locale]` streament (`instant = false`, `layout.tsx` l. 153).
`self-hosting.md` l. 239-259 : un proxy qui met les réponses en tampon doit être réglé pour ne pas
le faire.

**T10 — Pool de connexions.** Défaut `DATABASE_POOL_MAX=1`. Chaque `withTenant` tient **une
transaction ouverte, donc une connexion**, pendant tout son callback (`tenant-scope.ts` l. 106-115).
À 1, toutes les requêtes se sérialisent ; et tout code qui appelle `db` directement pendant un scope
(Better Auth passe par `drizzleAdapter(db)`, `auth.ts` l. 65) attend une connexion que le scope
retient — risque de blocage jusqu'au délai de 30 s, **inféré, non mesuré**. La CI tourne à 1, avec
un seul worker.

**T11 — Statut « 404 » du critère 1.** Une page sur un domaine inconnu rend **200** (ADR 013,
assertion e2e stricte). Un test de fumée qui attend `404` sur la page d'accueil d'un domaine inconnu
échouera sur un déploiement correct. Un vrai `404` s'obtient soit d'un Route Handler
(`/api/identity/favicon`), soit du proxy lui-même pour un domaine qu'il ne connaît pas — deux
situations différentes, à ne pas confondre dans le test.

**T12 — Ce que la mise en ligne expose du socle hérité.** La page d'accueil de chaque association est
encore celle du boilerplate (`[locale]/page.tsx` ; `e2e/homepage.spec.ts` l. 12 attend « Modern SaaS
platform to boost »), `APP_NAME` vaut `'ShipSaaS boilerplate'` (`src/lib/constants.ts`), les
adresses `/en/…` et `/es/…` sont servies (s43 non livrée), `/pricing`, `/blog`, `/docs`, `/register`
existent. `emailAndPassword.enabled: true` (`auth.ts` l. 74-76) et seul `/sign-in/magic-link` est
fermé (`MAGIC_LINK_DISABLED_HTTP_PATHS`) : l'inscription par `POST /api/auth/sign-up/email` reste
ouverte quelle que soit `NEXT_PUBLIC_AUTH_METHODS` (lu dans la configuration, **non vérifié par
exécution**), et chaque compte créé déclenche un client Stripe (`createCustomerOnSignUp`), un email
interne vers `EMAIL_TO` et l'appel Inngest. `docs/stories.md` l. 415 note déjà l'inscription libre
« à fermer ». Ce n'est pas le périmètre de s12b, mais c'est ce que la première URL publique montre.

**T13 — Inngest en production.** La route `/api/inngest` est publique et le client passe en mode
non-dev ; sans clé de signature ni clé d'événement (aucune n'est déclarée), son comportement exact
est **non vérifié** — l'appel applicatif est sous `try/catch` et journalise l'erreur.

**T14 — `app_settings` vide.** Sans seed, les interrupteurs d'email valent `false` : les emails
`system` (connexion, contact, signalement) partent, tout envoi `client` ou `admin` est
silencieusement ignoré. Sans effet sur les critères de s12b ; à connaître avant s15 et s25.

**T15 — Le `pre-push` et la CI.** `.husky/pre-push` lance un build complet : tout `git push`
(déploiement par push compris) dépend de la base locale et de Google Fonts. La CI a déjà échoué une
fois sur le téléchargement d'une police. Un pipeline de déploiement qui reconstruit hérite de cette
fragilité tant que les polices viennent de `next/font/google`.

**T16 — `sharp`.** Binaire natif par plateforme (ADR 024 : « à vérifier explicitement en s12b ») :
`node_modules` ne se copie pas d'une architecture à une autre, et l'ADR 030 demande de revérifier
l'interaction `next/image` ↔ `next/og` à chaque montée de version. `self-hosting.md` l. 25 signale
un réglage d'allocateur mémoire possible sous glibc.

**T17 — Ne pas construire dans le répertoire servi.** `next build` réécrit `.next/` ; l'ancienne
version qui tourne depuis ce même dossier ne peut pas « rester en service » (critère 3) si le build
s'y fait en place. Chaque build engendre aussi une nouvelle clé de chiffrement des Server Actions et
un nouvel identifiant de build (`self-hosting.md` l. 170-201) : une page ouverte avant la bascule
peut échouer sur sa première action après — à tolérer ou à traiter par `deploymentId`.

**T18 — La purge s'arrête à la première association en échec** (mineur 5 de la revue de s08b,
explicitement renvoyé à s12b) : les suivantes ne sont pas purgées lors de ce passage, mais le script
sort en `1`. Et le critère 6 demande une preuve **sur le serveur déployé** : il faut pouvoir y poser
une empreinte de plus de 24 h et constater sa disparition après l'appel planifié — ce que
`e2e/rate-limit.spec.ts` fait en écrivant directement en base, chose à ne pas reproduire telle quelle
en production.

**T19 — Cron silencieux.** L'ADR 006 le dit pour ses propres tâches : une planification qui ne
tourne plus ne produit aucune erreur. s12c porte l'alerte de sauvegarde ; rien n'est prévu pour la
purge.

### Tests et garde-fous existants à ne pas casser

- `src/db/rls-inventory.test.ts` (classement des 35 tables), `src/env-schemas.test.ts`,
  `src/lib/files/storage/{env,storage-factory,provider-imports}.test.ts`,
  `src/lib/emails/transport/{get-email-transport,provider-imports}.test.ts`,
  `src/db/scripts/{db-url,role-privileges}.test.ts`, `src/lib/helper/{tenant-helper,visitor-ip}.test.ts`,
  `src/lib/better-auth/association-origin.test.ts`, `src/app/[locale]/base-layout.test.tsx` (touché
  si les polices changent), et la garde d'enveloppe dans
  `src/services/__tests__/board-member-service.test.ts`.
- e2e : `tenant-isolation.spec.ts` (statut 200 du domaine inconnu), `magic-link.spec.ts`,
  `rate-limit.spec.ts` (script de purge), `association-identity.spec.ts`, `seo.spec.ts`.
- `pnpm check:rules` : toute règle de `.claude/rules/` modifiée doit rester alignée avec sa copie
  `.cursor/rules/` ; `rule-ci-cd-devops.md` décrit un déploiement « automated » par GitHub Actions
  qui n'existe pas.
- `pnpm knip` : une dépendance ou un fichier ajouté sans usage y remonte.
- Ne jamais écrire de SQL à la main dans `drizzle/migrations/` (AGENTS.md) : la création du rôle
  `asl_app` est de l'**amorçage de serveur**, pas une migration — elle a besoin d'un rôle habilité à
  créer des rôles, que le propriétaire des tables n'a pas à être.

## Open questions

### À trancher par l'utilisatrice

1. **Mode de déploiement** (objet de l'ADR de déploiement). Les contraintes relevées, pas un choix :
   processus Node sous un gestionnaire de services, ou image de conteneur ; build sur le serveur
   (base et valeurs publiques sur place, mais 2 vCore / 4 Go) ou en CI (GitHub Actions, avec une base
   migrée, les `NEXT_PUBLIC_*` de production, puis transfert du résultat). Quel que soit le mode :
   `tsx`, `src/db/scripts/`, `drizzle/`, `content/` et `src/assets/fonts/` doivent rester
   disponibles (T5), le build ne doit pas se faire dans le répertoire servi (T17), et aucun `.env` ne
   se committe. **Voie de retour** : garder la version précédente (répertoire ou image) prête à être
   relancée ; une migration appliquée, elle, ne se défait que par la restauration de s12c.
2. **Reverse proxy et certificats** (même ADR). Exigences du code : en-têtes `Host` /
   `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Forwarded-For` **écrasés** ; corps ≥ 16 Mo ; pas de
   mise en tampon ; redirection HTTP → HTTPS ; un certificat **par domaine**, obtenu et renouvelé sans
   intervention. Le choix de l'outil et du mode d'émission (à l'ajout d'un domaine dans la
   configuration, ce que dit le critère 5) revient à l'utilisatrice.
3. **Où est PostgreSQL** : sur le VPS, installé à côté ou en conteneur, et en quelle version (17 en
   dev et en CI). Qui est le rôle propriétaire (un rôle non superuser suffit-il à
   `CREATE EXTENSION "uuid-ossp"` ? **non vérifié**), et comment le mot de passe d'`asl_app` est
   généré et conservé.
4. **Domaines** : le domaine du prestataire sous lequel créer les sous-domaines de recette, les deux
   (au moins) associations de test à provisionner, et le nom d'hôte de `BETTER_AUTH_URL`
   (« la plateforme »). Faut-il une organisation « plateforme » dédiée au back-office SuperAdmin, ou
   le SuperAdmin passe-t-il par le domaine d'une association ?
5. **`www` ou domaine nu** : lequel est canonique, et l'autre redirige-t-il ? (P3)
6. **Comptes et secrets à fournir** : Brevo (clé, domaine d'expédition authentifié, adresse
   `EMAIL_FROM`), Stripe (clés réelles ou de test pour l'environnement temporaire, point de
   terminaison du webhook), Sentry (DSN ou non — la story le laisse « tel quel »), accès SSH et DNS.
   L'environnement temporaire envoie-t-il de vrais emails ?
7. **Valeurs de production des variables figées au build** : `NEXT_PUBLIC_ENABLED_PAGES` (au minimum
   `admin` ; `blog` et `docs` hérités oui ou non), `NEXT_PUBLIC_AUTH_METHODS` (garder `credential`
   pour le SuperAdmin ?), `NEXT_PUBLIC_APP_URL`.
8. **Ce que la première URL publique montre** (T12) : mise en ligne avec la page d'accueil et les
   pages héritées du boilerplate, ou stories de nettoyage à inscrire avant d'ouvrir le domaine du
   client ? Idem pour l'inscription libre. Ce n'est pas dans les critères de s12b : c'est un arbitrage
   de périmètre, à porter dans `docs/stories.md` s'il est retenu.
9. **Déploiement déclenché comment** : à la main depuis le poste du prestataire, ou par un workflow
   GitHub (qui devrait alors détenir un accès au serveur — secret de dépôt sur un dépôt public). La
   stratégie de ship du projet est `manual`.

### À résoudre au plan

10. **Amorçage du premier tenant et du premier SuperAdmin** (T1) : script dédié réutilisant les DAO,
    ou procédure SQL documentée ; comment le SuperAdmin se connecte la première fois ; redémarrage ou
    invalidation du cache de résolution après l'insertion.
11. **Lecture du « 404 » du critère 1** (T11) : l'ADR 013 fixe déjà qu'une page rend 200 avec l'écran
    introuvable. Reste à choisir la sonde du test de fumée (contenu de la page, `GET
/api/identity/favicon`, ou réponse du proxy sur un domaine qu'il ne connaît pas) et la forme du
    test : spec Playwright paramétrée par URL, ou script indépendant du seed.
12. **Forme et emplacement de la planification** (critère 6, puis s12c et s26) : crontab de
    l'utilisateur du service, minuterie du gestionnaire de services, ou planificateur du conteneur ;
    comment l'environnement lui est fourni (T5) ; comment prouver le critère sur le serveur sans
    écrire à la main en base de production (T18) ; faut-il un signal de vie dès maintenant (T19) ou
    le laisser à s12c.
13. **Fournir l'environnement au processus et aux scripts** : fichier hors dépôt lu par le
    gestionnaire de services, `.env.production` dans le répertoire déployé, ou variables du
    conteneur — et un gabarit de production à jour (`env.example` est incomplet, § 2).
14. **Polices** : garder `next/font/google` (build dépendant du réseau, T15) ou verser les fichiers au
    dépôt avec `next/font/local`. Changement de code hors critères ; à décider selon le lieu du build.
15. **Options Better Auth** : `advanced.ipAddress.trustedProxies` et `advanced.trustedProxyHeaders`
    sont-elles nécessaires, ou la configuration du proxy (T6, T7) suffit-elle ? À vérifier sur le
    serveur réel pour les deux domaines du test de fumée, comme le demandent les notes de la story et
    l'ADR 022.
16. **`DATABASE_POOL_MAX`** : valeur de production (T10) et limite `max_connections` du serveur.
17. **Garde des scripts destructifs** (T2) : les laisser tels quels et l'écrire dans la procédure, ou
    les durcir (changement de code).
18. **Emplacement de la documentation d'exploitation** : aucun n'existe ; s12c doit y consigner son
    exercice de restauration. Et mise à jour de `docs/architecture.md` (hébergement, déploiement).
19. **Restes à ne pas embarquer par mégarde** : Inngest (T13), `@mailchimp/mailchimp_marketing`
    orphelin, route Stripe dépréciée, `db:baseline`. Les retirer n'est pas un critère de s12b ; à
    laisser ou à inscrire ailleurs.
20. **Regroupement IPv6 par /64** du limiteur (mineur 2 de la revue de s08b, renvoyé à « s10 ou
    s12b ») : non traité par s10 ; aucun critère de s12b ne le porte.

### Non vérifié — faute d'exécution ou d'accès

- Comportement de `SKIP_DB_CHECK=1 pnpm build` sans base, et mémoire consommée par un build.
- Échec dur de `next/font/google` sous Turbopack (lu dans le chargeur JS, constaté une fois en CI).
- Tout ce qui concerne le serveur réel : en-têtes effectivement reçus, nom du cookie, redirections
  du proxy applicatif, émission et renouvellement des certificats.
- Mise en cache d'un résultat `undefined` par `'use cache'` (T1), blocage du pool à 1 (T10),
  comportement de la route Inngest sans clés (T13), ouverture effective de `/api/auth/sign-up/email`
  (T12).
- Caractère « trusted » de l'extension `uuid-ossp` pour un rôle non superuser, exigences
  SPF/DKIM de Brevo, version minimale de Node pour `registerHooks`.
- Les caractéristiques du VPS personnel du prestataire et de l'offre LWS (système, accès root,
  conteneurs autorisés ou non) : aucune information dans le dépôt.
