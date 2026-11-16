# Revue — s53-un-acces-plusieurs-terrains

Branche `feature/s53-un-acces-plusieurs-terrains`, un commit (`742aa8b8`), diff `git diff main...feature/s53-un-acces-plusieurs-terrains` : 90 fichiers. Revue en lecture seule, sans contexte antérieur.

Verdict : aucun défaut critique ni majeur. Il reste quatre points mineurs, à traiter au prochain cycle. Les e2e n'ont jamais tourné : ils seront vérifiés en CI GitHub.

## Vérifications exécutées

Tout a tourné sur une copie en disque local (HEAD `742aa8b8`), avec les `node_modules` de la copie de l'implémenteur.

| Commande | Résultat exact |
| --- | --- |
| `pnpm test --run` | `Test Files  365 passed (365)` / `Tests  4629 passed \| 1 skipped (4630)`. Aucun timeout dans le journal (0 occurrence). |
| `pnpm exec tsc --noEmit -p .` | exit 0, 0 `error TS` |
| `pnpm exec eslint <fichiers .ts/.tsx du diff>` | exit 0, aucun message |
| `pnpm check:rules` | `✅ Règles et documentation alignées sur le code.` |
| `pnpm exec drizzle-kit generate` | `No schema changes, nothing to migrate` : aucun fichier créé (58 avant, 58 après) |

Ni `pnpm build` ni Playwright n'ont été lancés. Les e2e de s53 n'ont donc jamais tourné : leur exécution en CI GitHub reste la preuve attendue des critères 1 à 8 et de la RLS.

## Contrôles effectués

### Migrations

- **0054** (générée) : crée `member_profile_account` avec FK `CASCADE` et l'index unique `member_profile_account_profile_idx (member_profile_id)`. Elle ajoute l'index `(organization_id, user_id)` et rend l'index email non unique (DROP puis CREATE INDEX).
- **0055** (`--custom`) :
  - RLS `ENABLE` + `FORCE`, et une policy `tenant_isolation`, mot pour mot celle de `0053` ;
  - copie des liens dans une boucle par association, qui pose `app.organization_id` comme dans `0047` : la RLS n'est jamais contournée ;
  - `ON CONFLICT ("member_profile_id") DO NOTHING` rend la copie idempotente.
- **0056** (générée) : retire la FK, l'index `member_profile_organization_user_idx` puis la colonne `user_id`. La copie (0055) précède donc bien le retrait.
- **Journal et snapshots** :
  - idx 54, 55 et 56 se suivent, et la chaîne `prevId` est cohérente (0053 → 0054 → 0055 → 0056) ;
  - le snapshot 0055 est identique à 0054, hors `id`/`prevId`, comme il se doit pour une migration custom ;
  - 0056 n'a plus `user_id` dans `member_profile`.
- `generate` ne produit plus aucun écart.

### Multi-tenant

- Le modèle `src/db/models/member-profile-account-model.ts` porte `organization_id` et est déclaré dans `db.ts`.
- Tous les nouveaux DAO passent par `getDb()` :
  - `linkMemberProfileAccountDao`, `unlinkMemberProfileAccountDao`, `countLinkedProfilesDao`, `getMemberProfilesByUserIdDao`, `getMemberProfilesByEmailDao` ;
  - `getAddressProfilesDao`, `getMemberProfileIdsSharingEmailDao`.
- Leurs appelants sont tous sous `withTenant`.
- Aucun nouveau `withRlsBypass` dans le diff.
- **E2e d'accès croisé** (`e2e/member-accounts.spec.ts`) :
  - les liens sont invisibles depuis l'association B et sans scope (`select … from member_profile_account` → 0 ligne) ;
  - une fiche d'un autre membre de A et une fiche de B, forgées dans l'URL, sont refusées.
- Les nouvelles tables héritent des droits d'`asl_app` par `ALTER DEFAULT PRIVILEGES` (`docker/db-init/03-app-role.sql:30`). La sauvegarde est couverte par `pg_read_all_data`.

### Règles du compte

Vérifiées dans `src/services/member-account-service.ts`.

- **Fermeture** (`closeMemberAccount`) : retire le lien, puis la ligne `member` (rôle `member` seulement) uniquement si `countLinkedProfilesDao` = 0.
- **Refus « bureau »** : seulement si `otherLinkedProfiles === 0` (`src/services/rules/member-account-rules.ts`).
- **Remplacement** (`replaceMemberAccount`) :
  - le verrou des rôles est pris d'abord, puis le rôle est relu sous ce verrou ;
  - `lastProfile` est calculé après le nouveau lien ;
  - le rôle ne se déplace, avec trace et retrait de l'ancien, que si la fiche était la dernière ; sinon la nouvelle adresse ouvre un accès de simple membre.
- **Confirmation** (`findEmailHolder` et `confirmedHolder`, `member-profile-service.ts`) :
  - le détenteur est relu dans le `withTenant` de l'écriture ;
  - un `confirmedAccountUserId` qui n'est pas celui du détenteur fait redemander la confirmation ;
  - sans détenteur, l'identifiant est ignoré et `nextEmailAccountUserId` vaut `null`, donc aucun lien arbitraire n'est possible ;
  - Zod exige un uuid.
- Chaque règle a ses tests unitaires (`member-account-service.test.ts:668-840`, `member-profile-service.test.ts:1112-1447`).

### Ordre ADR 054 §7

- `orderMyProfiles` trie par premier numéro actuel (`localeCompare('fr', {numeric: true})`), met les fiches sans parcelle actuelle en dernier, puis départage par identifiant.
- Les neuf anciens lecteurs singuliers sont migrés : `git grep getMemberProfileByUserIdDao|memberProfile.userId|setMemberProfileUserIdDao|updateMyMemberProfileContactDao` ne rend rien.
- Cela couvre incident-report, member-question, member-role (deux usages), organization-service, member-space, member-account et le DAL.
- Aucun SQL brut ne lit encore `member_profile.user_id`, ni dans `src`, ni dans `scripts`, ni dans `e2e`.

### Campagnes (ADR 055)

- `computeCampaignTarget` groupe par `trim().toLowerCase()`. Le porteur est le premier de l'ordre ADR 054, et une fiche désinscrite désinscrit tout le groupe.
- À la livraison, `getPendingPartRecipientsDao` relit l'adresse entière : désinscription, parcelles de toutes les fiches et nom du compte.
- `addressValuesOf` donne `{nom}` = nom du compte si l'adresse a plus d'une fiche, et `{parcelle}` = toutes les parcelles en ordre numérique.
- `confirmUnsubscribeService` pose une ligne sur chaque fiche de la même adresse.
- Le `countsInDatabase` de l'e2e compte lui aussi des adresses.

### Import

- Sur `email_shared`, l'import refait l'appel avec `confirmedAccountUserId` = le détenteur, que le service revérifie.
- Les remarques `shared_email` (avec `relatedLine`) et `shared_email_existing` remplacent le rejet `email_taken`.
- La fixture contient 25 lignes et 10 adresses partagées, par paires. On attend donc 15 comptes et 10 remarques, ce que l'e2e vérifie.

### Présentation, libellés et design

- Tous les libellés sont dans `messages/fr.json`, et chaque clé ajoutée est utilisée.
- Les tokens `warning`, `warning-border`, `warning-foreground` existent (`src/app/globals.css:75-77`, design system §1).
- `Droplet` fait partie du vocabulaire figé (§1.7) et `Info` est prévu par le design (`docs/designs/…md:77,156`).
- `joinParcelNumbers` existe (`campaign-rules.ts:75`). D'autres composants importaient déjà `services/rules` depuis le client.

### Inventaire et hygiène

- `docs/architecture.md` est à jour : description du lien (l. 309), compteur à 47 tables (l. 358), ligne de la table avec la mention de s38 (l. 398).
- Aucun fichier de `docs/inputs/` ni de `docs/logs/` dans le diff.

### Plan et diff

Les 10 tâches sont cochées et retrouvées dans le diff. Rien n'a été ajouté hors du plan, à part `getMemberAccountDao`, qui renvoie maintenant `name`, nécessaire au nom du compte.

Deux écarts au plan, sans incidence :

- le plan cite `member-import-report.tsx` et `campaign-types.ts`, que le diff ne touche pas : les libellés passent par la clé de remarque, et les types vivent dans `campaign-rules.ts` ;
- il n'existe pas de fichier d'actions `[id]` séparé.

## Constats

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

1. **L'ADR 037 n'est pas marqué remplacé.**
   - **Où :** `docs/decisions/037-lien-fiche-compte-par-colonne-user-id.md:3`
   - **Défaut :** il porte toujours `Status: accepted` alors que l'ADR 054 le remplace. Le dépôt annote pourtant le remplacé, par exemple `docs/decisions/012-mode-sombre-conserve.md:3` : `Status: superseded by ADR 033`. L'ADR 051, remplacé en partie par l'ADR 055 pour la désinscription, n'a pas non plus de renvoi.
   - **Scénario d'échec :** un futur agent lit l'ADR 037 comme décision en vigueur et réintroduit la colonne `user_id`.
   - **Correctif attendu :** passer le statut de l'ADR 037 à `superseded by ADR 054`, et ajouter à l'ADR 051 une mention « désinscription remplacée par ADR 055 ».

2. **Le cas « identifiant de fiche injecté dans l'action serveur → sans effet » n'est prouvé qu'en unitaire.**
   - **Où :** `e2e/member-accounts.spec.ts`, test « critère 4 — « Mes coordonnées » n'écrit que les fiches du compte connecté »
   - **Défaut :** le plan (tâche 10) demandait aussi ce cas en e2e. Le test e2e vérifie seulement qu'une fiche d'un autre compte (Dubois) reste intacte, sans rien injecter. La preuve n'existe qu'en unitaire, par le retrait Zod (`src/services/__tests__/member-space-service.test.ts:306`). Par ailleurs, les deux identifiants forgés dans l'URL sont arrêtés par le contrôle de rôle de la route bureau, pas par la RLS. La RLS de la nouvelle table est prouvée à part, par la requête SQL du test suivant, ce qui suffit pour le critère.
   - **Scénario d'échec :** une régression qui ferait lire un `memberProfileId` du `FormData` dans `updateMyContactAction` ne serait pas détectée bout en bout.
   - **Correctif attendu :** dans le test e2e, poster l'action avec un champ `memberProfileId` d'une fiche de Dubois, puis vérifier que cette fiche n'a pas bougé.

3. **Séparateur et sentinelle en dur dans le titre d'un groupe de coordonnées.**
   - **Où :** `src/components/features/member-space/my-contact-card.tsx:242`
   - **Défaut :** le code envoie `group.names.join(', ')`, avec `'none'` pour une liste vide, au `select` ICU `groupTitle`. La virgule est en dur, alors que le composant utilise `format.list` deux lignes plus haut pour les numéros. Et une fiche nommée littéralement « none » serait avalée par la branche vide du `select`.
   - **Scénario d'échec :** trois noms donnent « A, B, C » au lieu de « A, B et C ». Cas marginal : un nom égal à `none` disparaît du titre.
   - **Correctif attendu :** passer `format.list(group.names, {type: 'conjunction'})`, et piloter la branche vide par un compteur ICU (`{nameCount, plural, =0 {} other {…}}`) plutôt que par une chaîne sentinelle.

4. **Séparateurs « · » composés en JSX autour des libellés traduits.**
   - **Où :** `src/components/features/member-space/member-space.tsx:222`
   - **Défaut :** le marqueur `· {n} terrains · Parcelles …` est assemblé en template string autour de deux clés traduites. C'est la suite d'un patron existant (`· {t(...)}` avant s53), d'où la sévérité mineure.
   - **Correctif attendu :** une seule clé ICU qui porte toute la phrase du marqueur, par exemple `markerLandsAndParcels`.

## Risque résiduel

Toute la preuve de bout en bout (critères 1 à 8, RLS de `member_profile_account`, seed Lefèvre à trois fiches, mises à jour des specs s12d, s13 et s25) repose sur des specs e2e qui n'ont jamais tourné. Ce n'est pas un constat en soi : c'est la stratégie du dépôt (e2e en CI GitHub). Mais une CI rouge sur ces specs doit renvoyer la story en correction avant le merge.

Max severity: minor
Ship allowed: yes
