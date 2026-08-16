---
name: postgres-local-dev
description: Base Postgres locale de secours quand la base distante (Supabase, Neon) est injoignable en développement. Utiliser dès qu'une commande échoue sur la base — connexion refusée, « tenant not found », « password authentication failed », db:seed/db:push/build/e2e qui plantent — ou qu'il faut une base jetable pour lancer les tests. Toujours arrêter le serveur à la fin.
---

# Base Postgres locale de secours

La base distante tombe, est supprimée, ou ses identifiants expirent. Plutôt que
de rester bloqué, on monte une base locale, on l'utilise, **et on l'arrête**.

## Avant de démarrer quoi que ce soit : diagnostiquer

Ne pas installer un serveur pour un problème de réseau passager. Vérifier
d'abord que la base distante est réellement morte :

```bash
pnpm db:check
```

Les signatures typiques d'une base définitivement perdue :

| Message                                             | Cause                                       |
| --------------------------------------------------- | ------------------------------------------- |
| `password authentication failed for user 'default'` | ancien Vercel Postgres, service discontinué |
| `tenant or user not found`                          | projet Supabase supprimé ou en pause        |
| `ENOTFOUND` / `ECONNREFUSED`                        | hôte disparu, ou simple coupure réseau      |

⚠️ **Un `pnpm build` vert ne prouve pas que la base répond.** Les lectures
échouent en silence et la sortie est amputée. C'est pour ça que `pnpm build`
lance `db:check` en préflight (`scripts/preflight-build.ts`). Si tu vois passer
`Failed to resolve plans for seat pricing validation` en boucle dans des logs,
c'est ce symptôme.

## 1. Installer et démarrer

```bash
brew install postgresql@17          # une seule fois
brew services start postgresql@17
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"   # psql d'Homebrew est masqué par celui de libpq
pg_isready -h localhost -p 5432
```

L'installation Homebrew crée un superutilisateur au nom de la session (`whoami`),
sans mot de passe. Pas de rôle à créer.

## 2. Créer la base — et les extensions AVANT le push

```bash
createdb shipsaas
psql -h localhost -d shipsaas -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
psql -h localhost -d shipsaas -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
```

⚠️ **Le piège principal.** Le schéma utilise `uuid_generate_v4()`. Neon et
Supabase activent `uuid-ossp` par défaut, un Postgres neuf non : sans elle,
`db:push` déroule tout son DDL puis échoue en fin de course sur
`function uuid_generate_v4() does not exist`, en laissant la base à moitié
construite.

## 3. Pointer l'environnement

`DATABASE_URL` vaut `postgres://<whoami>@localhost:5432/shipsaas`.

Les scripts de base lisent le fichier correspondant à `NODE_ENV`
(`src/db/scripts/env.ts`) : `.env.development` par défaut, `.env.test` en test,
`.env.production` en production. Tous sont gitignorés.

- `.env.development` → `pnpm dev`, `db:push`, `db:seed`, `db:reset-seed`
- `.env.test` → vitest, et le serveur lancé par `playwright.config.ts`
- `.env.production.local` → le build de production (`pnpm build && pnpm start`)

⚠️ Dans un **worktree neuf**, ces fichiers sont absents : les copier depuis le
dépôt principal avant de commencer.

⚠️ Les variables `NEXT_PUBLIC_*` et `BETTER_AUTH_URL` sont **figées au build**.
Changer de port impose un rebuild, sinon Better Auth pose ses cookies sur le
mauvais port et le login échoue sans message clair.

## 4. Remplir la base

```bash
pnpm db:reset-seed          # clear + push + seed
```

Sur une base **vide**, `db:clear` peut échouer et interrompre la chaîne : faire
alors `pnpm db:push && pnpm db:seed` pour le premier remplissage.

Le seed donne 12 utilisateurs et 4 organisations, tous avec le mot de passe
`Azerty123` — voir `.claude/rules/02-services/rule-seed-usersroles-and-organization.md`
pour la matrice des rôles. Les plus utiles : `admin@gmail.com` (admin) et
`user@gmail.com` (utilisateur simple, membre de trois organisations).

`seed.ts` refuse de s'exécuter si `NODE_ENV=production`. C'est un garde-fou,
ne pas le contourner.

## 5. Arrêter le serveur — ne pas l'oublier

```bash
brew services stop postgresql@17
```

Le service Homebrew redémarre **à chaque ouverture de session** tant qu'il n'est
pas arrêté. Le laisser tourner consomme de la mémoire en continu et laisse une
base de test accessible en permanence.

À l'arrêt, `pnpm build`, `pnpm test:e2e` et `pnpm dev` échoueront tant que
`DATABASE_URL` pointe le local. C'est voulu : un échec franc vaut mieux qu'un
build vert qui ne prouve rien. Pour builder délibérément sans base :

```bash
SKIP_DB_CHECK=1 pnpm build
```

## Pièges rencontrés, à ne pas redécouvrir

**Le serveur Next ne libère pas son port.** `pnpm start` échoue en silence sur
`EADDRINUSE` (l'erreur part dans le log, pas dans la console) et **l'ancien
processus continue de servir un build périmé**. On teste alors autre chose que ce
qu'on croit. Toujours tuer explicitement avant de relancer :

```bash
PIDS=$(lsof -t -nP -iTCP:3000 -sTCP:LISTEN); [ -n "$PIDS" ] && kill $PIDS
```

**Les e2e écrivent en base.** Deux specs créent un compte, une autre lit le seed,
une autre change l'organisation active. Ne jamais les pointer sur une base
réelle. `playwright.config.ts` impose la `DATABASE_URL` de `.env.test` au serveur
sous test, sauf si l'environnement en fournit déjà une (le cas en CI, où le job a
son Postgres éphémère).

**Le nombre d'utilisateurs augmente après chaque run e2e.** Normal : les specs
d'inscription créent des comptes. Un `db:reset-seed` remet à plat.

**`psql` d'Homebrew est masqué** par celui de `libpq` s'il est installé. D'où le
`export PATH` de l'étape 1, sinon les versions client et serveur divergent.

## Vérifier que tout est en place

```bash
psql -h localhost -d shipsaas -tAc "select count(*) from \"user\""          # 12 après un seed
psql -h localhost -d shipsaas -tAc "select extname from pg_extension"       # doit lister uuid-ossp
pnpm db:check                                                               # connexion OK
```
