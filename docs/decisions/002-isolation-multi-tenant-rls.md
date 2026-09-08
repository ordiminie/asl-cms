# ADR 002 — Isolation multi-tenant : RLS Postgres forcée + rôle applicatif dédié

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

Le PRD et l'ADR 001 posent le modèle : base partagée, données scopées par `organization_id`, Row-Level Security Postgres. Le _quoi_ est donc tranché ; le _comment_ ne l'est pas, et s01 le renvoie explicitement à `/ks-architect`.

L'analyse du boilerplate montre qu'il n'y a **aucune RLS** : `grep -rn "ROW LEVEL SECURITY\|pgPolicy\|enableRLS" src drizzle` ne retourne rien. Les tables métier portent bien `organization_id` (voir `src/db/models/project-model.ts`), mais l'isolation repose entièrement sur la couche applicative — les fonctions `canRead*` de `src/services/authorization/`. C'est un scoping par convention, pas une garantie.

Or s01 exige davantage, et l'écrit noir sur blanc : « La policy RLS refuse la lecture inter-tenant **même lorsque la couche applicative est court-circuitée** ». Un scoping applicatif ne peut pas satisfaire ce critère par construction.

Trois contraintes pèsent sur le mécanisme :

- `src/db/models/db.ts` expose un `Pool` node-postgres partagé et un `db` Drizzle unique, importé directement par les 12 repositories. Une variable de session Postgres ne vaut que pour la connexion sur laquelle elle est posée — un `SET` naïf sur un pool fuiterait d'un tenant à l'autre.
- Le rôle de `DATABASE_URL` est aujourd'hui le **propriétaire** des tables. Postgres ne applique pas la RLS au propriétaire d'une table sauf `FORCE ROW LEVEL SECURITY`.
- Le SuperAdmin Zourite Studio doit légitimement traverser les tenants (provisioning s01, simulation de rôle s41).

## Decision

L'isolation repose sur **trois couches indépendantes**, dont la RLS est la dernière et la seule non contournable :

1. **Un rôle applicatif non propriétaire.** L'application se connecte avec `asl_app`, qui n'est ni propriétaire des tables ni porteur de `BYPASSRLS`. Les migrations, le seed et les scripts `db:*` gardent le rôle propriétaire via une seconde variable `DATABASE_MIGRATION_URL`.

2. **RLS activée _et forcée_ sur toute table portant `organization_id`**, avec une policy fail-closed :

   ```sql
   ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE <table> FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON <table>
     USING (
       organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
       OR current_setting('app.bypass_rls', true) = 'on'
     );
   ```

   Le `true` de `current_setting` rend l'absence de réglage non fatale : la variable vaut alors `NULL`, la comparaison vaut `NULL`, et **aucune ligne ne sort**. Oublier de poser le tenant ne donne pas un accès large, il donne zéro ligne — l'erreur est bruyante et sûre. Le `NULLIF` couvre le cas de la chaîne vide, qui ferait échouer le cast.

3. **Un scope de tenant explicite côté application.** Un helper `withTenant(organizationId, callback)` ouvre une transaction, y pose `SET LOCAL app.organization_id`, et publie la transaction dans un `AsyncLocalStorage`. Les repositories n'appellent plus `db` directement mais `getDb()`, qui retourne la transaction du scope courant si elle existe, et le `db` du pool sinon. `SET LOCAL` meurt avec la transaction : aucune fuite possible vers la requête suivante du pool.

Le bypass SuperAdmin passe par `withRlsBypass()`, qui pose `SET LOCAL app.bypass_rls = 'on'`. Il est réservé au provisioning (s01) et à la simulation de rôle (s41), et **toute écriture qui s'y produit est tracée au compte SuperAdmin**.

Les policies sont écrites via `drizzle-kit generate --custom`, jamais à la main dans `drizzle/migrations/` — conformément à la section « Database Migration Safety » d'AGENTS.md, qui protège la cohérence du journal et des snapshots.

## Considered options

- **Scoping applicatif seul, sans RLS** — rejeté : ne satisfait pas le critère d'acceptation de s01, qui demande une garantie tenant même couche applicative court-circuitée. C'est aussi le scénario exact que le PRD veut exclure pour les documents nominatifs (« exclure tout accès croisé même en cas de bug d'autorisation »).
- **Une base de données par tenant** — rejeté, et déjà écarté par le cimetière du PRD. Six bases à migrer, sauvegarder et superviser sur un VPS 2 vCore / 4 Go, pour un gain d'isolation que la RLS forcée apporte déjà.
- **Un schéma Postgres par tenant** — rejeté : déplace le problème dans le `search_path`, qui souffre exactement de la même fragilité de pooling que la variable de session, sans le filet de la policy. Et `drizzle-kit` gère mal la multiplication de schémas identiques.
- **RLS avec un rôle Postgres par tenant** — rejeté : alourdit le provisioning (s01 devrait créer un rôle et le pool devrait multiplier les connexions par tenant), pour une garantie équivalente à `SET LOCAL` sur un rôle unique.
- **`SET` de session sans transaction, réinitialisé au retour au pool** — rejeté : correct seulement si _aucun_ chemin de code ne relâche la connexion sans réinitialiser. Une exception non capturée suffit à empoisonner la connexion pour le tenant suivant. `SET LOCAL` obtient la même chose avec une garantie donnée par Postgres, pas par notre discipline.

## Consequences

**Ce qui devient plus simple**

- L'isolation cesse d'être une propriété du code de chaque story pour devenir une propriété du schéma. Une story qui oublie un `WHERE organization_id` ne fuite pas : elle ne voit rien.
- Le critère « test d'accès croisé » de s01 et de toutes les stories suivantes se teste réellement, au lieu de tester notre propre filtre applicatif contre lui-même.
- Le cloisonnement renforcé exigé pour les documents nominatifs (s32) et les notes internes (s24) est obtenu par le même mécanisme que le reste, sans dispositif ad hoc.

**Ce qui devient plus difficile**

- Les 12 repositories existants doivent passer de `import db` à `getDb()`. C'est mécanique mais non nul, et c'est du travail de s01.
- Tout chemin serveur qui touche une table métier doit s'exécuter dans un `withTenant(...)`. Un oubli se manifeste par « zéro résultat » — sûr, mais déroutant à déboguer si on n'a pas la règle en tête. D'où sa présence dans AGENTS.md.
- Deux URL de base de données à gérer en configuration et en déploiement.

**À surveiller**

- **La RLS n'est pas testable en test unitaire** : `src/db/models/db.ts` refuse toute connexion quand `NEXT_PUBLIC_NODE_ENV === 'test'`, et la convention du projet mocke les repositories. Le test d'isolation exigé par s01 est donc un **test e2e Playwright** contre le Postgres éphémère, seul endroit où une vraie policy s'exécute. C'est cohérent avec `rule-ci-cd-devops.md` (« pas de couche de test d'intégration : le comportement des repositories est couvert par la suite e2e »), mais contre-intuitif à la lecture de s01 qui dit « test au niveau repository ».
- `withRlsBypass()` est la seule porte dérobée du système. Toute nouvelle occurrence dans le diff doit être un point d'arrêt de revue.
- Les tables sans `organization_id` (`user`, `session`, `app_settings`, tables Better Auth) ne reçoivent pas de policy. La liste des exemptions est tenue dans `docs/architecture.md` et toute addition doit être justifiée en revue.
