# ADR 035 — Deux rôles globaux seulement, et les migrations éprouvées sur une base au seed de `main`

- Status: accepted
- Date: 2026-10-16
- Scope: story s47-roles-globaux-reduits

Suit le modèle de retrait de l'[ADR 009](009-sous-systemes-boilerplate-ecartes.md) et prolonge
l'[ADR 034](034-connexion-limitee-a-l-association-du-domaine.md), qui fait déjà du seul
`super_admin` l'exception à la connexion limitée à l'association.

## Context

Le boilerplate définit six rôles **globaux** (`user.role`, énuméré Postgres `role_type`) : `public`,
`user`, `redactor`, `moderator`, `admin` et `super_admin`. ASL-CMS n'en utilise que deux. Les rôles
qui comptent pour une association (Membre, Bureau, Présidence) sont des rôles **d'association**
(`member.role`), posés par s03b. Le SuperAdmin Zourite Studio est `super_admin`. Les quatre autres
ouvrent encore des droits, dont `admin` qui ouvre l'accès à `/admin`, sans équivalent dans le modèle
d'ASL-CMS. L'arbitrage du 7 octobre 2026 les retire avant s12b, tant qu'aucune base de production
n'existe.

Postgres ne sait pas retirer une valeur d'un énuméré. drizzle-kit 0.31 génère donc un
`DROP TYPE` / `CREATE TYPE` suivi d'un recast de la colonne, qui échoue s'il reste une ligne portant
une valeur retirée. Une migration de ce genre peut passer en CI, qui migre une base **vide** avant
le seed, puis échouer sur une base qui a des données. Rien dans la CI actuelle ne joue les migrations
d'une branche sur une base déjà peuplée.

## Decision

1. **Deux rôles globaux** : `user` (tout compte) et `super_admin`. Les comptes `admin`,
   `moderator`, `redactor` et `public` passent à `user` et gardent leurs lignes `member`. Le
   visiteur sans compte n'a pas de rôle : « aucun rôle » vaut droits d'invité, comme `public`
   aujourd'hui. `/admin` et ses actions serveur sont réservés à `super_admin`. Le plugin Better
   Auth `admin()` déclare `super_admin` comme rôle administrateur.
2. **Migration en deux temps** : une migration de données `drizzle-kit generate --custom`
   (conversion des comptes), puis la migration générée par `pnpm db:generate` après la
   modification de `roleEnum`. Cette dernière n'est pas retouchée à la main.
3. **Un job CI « migrations sur la base de `main` »** : il monte le Postgres éphémère au schéma et
   au seed de `origin/main` (worktree), applique les migrations de la branche, puis lance les
   contrôles de la story. Il est générique : il reste utile après s47 pour toute migration qui
   touche des données existantes.

## Considered options

- **Garder `admin` comme alias de `super_admin`** : rejeté. Deux noms pour un même droit, c'est
  l'homonymie que s03b a déjà dû défaire côté association (`admin` → `board`).
- **Garder les valeurs dans l'énuméré, les retirer seulement du code** : rejeté. La base
  accepterait encore un rôle que le code ne connaît pas, et un compte remis à `admin` en base
  retrouverait silencieusement des droits si le code les réintroduisait.
- **Réécrire à la main le SQL généré (précédent 0011 de s03b)** : rejeté. AGENTS.md l'interdit,
  et l'ordre « données d'abord » rend le SQL généré correct tel quel.
- **Prouver la migration par un test qui injecte lui-même des comptes `admin` dans une base
  migrée jusqu'à 0030** : rejeté. Ce test ne joue pas le seed de `main`, que le critère exige, et
  devrait être maintenu à la main à chaque migration.

## Consequences

- Les gardes de `/admin` deviennent `[RoleConst.SUPER_ADMIN]`. `withAuthAdmin` et `isUserAdmin`
  gardent leur nom mais ne reconnaissent plus que `super_admin`.
- Le SuperAdmin peut enfin bannir et débannir via le plugin. Avant, `super_admin` n'était pas
  connu de `defaultRoles` et `hasPermission` le refusait.
- Retour arrière : `git revert` du commit de code, puis une nouvelle migration qui rajoute les
  valeurs à l'énuméré. Les comptes convertis ne retrouvent pas leur ancien rôle, mais il n'en
  existe aucun en production.
- Le job « migrations sur la base de `main` » allonge la CI d'un build de base supplémentaire,
  sans build Next. Une fois s47 mergée, ses contrôles propres à s47 passent sans rien prouver de
  nouveau (le seed de `main` ne contient plus de rôle retiré). Le job, lui, reste utile pour les
  migrations suivantes.
- `src/lib/api-auth.ts`, code mort que l'ADR 013 cite en illustration, est supprimé. Il reste
  récupérable par `git show 97a18a8b:src/lib/api-auth.ts`.
