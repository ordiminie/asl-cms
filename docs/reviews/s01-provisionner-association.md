# Review — Story s01-provisionner-association

> **Re-revue** en contexte neuf (subagent `reviewer`), le 2026-09-14, après un cycle de correction.
> Commit jugé : `70789e5` — `git diff main...feature/s01-provisionner-association`, 224 fichiers,
> +12789 / −17940.
> Le cycle précédent avait conclu `Max severity: critical` / `Ship allowed: no` ; ses 2 criticals et
> 5 majors ont été **vérifiés un par un**, pas crus sur parole.
> Tout ce qui suit a été vérifié contre le code et la base vivante, non contre le journal du plan.

## Ce qui a été exécuté

| Vérification               | Résultat                                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test --run`          | **407 passed / 8 skipped**, 27 fichiers + 2 skipped — conforme au journal                                                                                                                       |
| `npx tsc --noEmit`         | propre, sortie 0                                                                                                                                                                                |
| `pnpm lint`                | propre (seul l'avertissement préexistant sur `.remember/tmp/last-ndc.ts`)                                                                                                                       |
| `pnpm check:rules`         | ✅ passe                                                                                                                                                                                        |
| `pnpm knip`                | 91 / 173 / 52 / 7 — **aucun fichier ni export de s01 n'y apparaît**                                                                                                                             |
| Base vivante               | 20 tables, **1** policy (`user_submissions`), `member` / `invitation` en `rowsecurity=f`, `asl_app` en `rolsuper=f rolbypassrls=f`                                                              |
| Base vivante, en `asl_app` | `select count(*) from member` → **11** ; `insert into member` → **OK** ; `user_submissions` hors scope → **0**, dans le scope de A → **1** ; écriture pour B depuis le scope de A → **refusée** |
| `pnpm test:e2e`            | **non exécuté** — les 6 tests navigateur exigent des bibliothèques système absentes ici (confirmé indépendamment). Les 5 assertions au niveau base ont été revérifiées en rejouant leur SQL     |

## Constats du cycle précédent — vérifiés, non crus

- **critical 1 (RLS sur `member`, aucun scope posé)** — **corrigé, les deux moitiés.** La migration
  `0004` ne couvre plus que `user_submissions`, l'exemption ADR 014 étant écrite dans l'en-tête du
  fichier. `member` mesuré lisible (11 lignes) et insérable en `asl_app` : inscription, session et
  adhésions sont rétablies. `withTenant` / `withRlsBypass` ont de vrais appelants —
  `user-submission-dal.ts` (3 lectures), `admin/submissions/actions.ts` (2 mutations),
  `contact/actions.ts`, `quick-feedback-action.ts`, et **exactement un** `withRlsBypass`, à
  `admin/organizations/actions.ts:214`.
- **critical 2 (7 critères sur 10 non atteints)** — **corrigé.** Tâches 7 à 11 livrées ; les dix
  critères ont une implémentation et un test ou une mesure vivante.
- **major 3 (`withTenant` imbriqué fuyant le tenant interne)** — **corrigé, et le test mord
  désormais.** `src/db/tenant-scope.ts:71-89` réutilise la transaction ouverte et restaure la valeur
  externe dans un `finally`. `tenant-scope.test.ts:135-179` asserte **la séquence de `set_config`
  réellement émise** (A → B → A), non l'identité d'un objet de mock. Retirer le `finally` fait
  échouer ce test.
- **major 4 (`provisionOrganizationService` inventé dans architecture.md)** — **corrigé.** La
  fonction existe (`src/services/organization-service.ts:629`), suit
  `safeParse → can* → repository`, et architecture.md avertit désormais que les fonctions plus
  anciennes du même fichier font l'inverse.
- **major 5 (12 tables non classées)** — **corrigé et exact.** architecture.md classe
  1 + 9 + 4 + 6 = 20 tables ; le schéma vivant a été listé et donne les mêmes 20, nom pour nom.
  Seules `member`, `invitation` et `user_submissions` portent `organization_id`. **Le critère 9 ne
  laisse rien de non classé.**
- **major 6 (l'ADR 013 promettait un garde-fou e2e inexistant)** — **corrigé.**
  `e2e/tenant-isolation.spec.ts:113` asserte `toBe(200)` sur la page introuvable et `:124`
  `toBe(404)` sur une route inexistante. L'ADR 013 a par ailleurs été honnêtement amendé là où les
  specs `/api/projects` supprimées le soutenaient.
- **major 7 (rien ne garantissait le rôle applicatif en environnement déployé)** — **corrigé.**
  `src/db/scripts/role-privileges.ts` + `check.ts` assertent `rolsuper` / `rolbypassrls`, et les deux
  workflows exécutent `pnpm db:check` sur le `DATABASE_URL` déployé après les migrations. Le trou
  trouvé au passage dans `.env.development` était réel et est refermé.
- **minors 8 et 12** — corrigés (clés d'environnement mortes chat/Mailchimp retirées ; `src/proxy.ts`
  n'est plus une entrée knip).
- **minors 9, 10 et 11 écartés** — les motifs tiennent. Le 9 est sûr sur le schéma actuel (tous les
  chemins d'insertion génèrent un slug, et `slug` est bien `NOT NULL` en base). Le 10 consigne son
  motif dans la DoD. Le 11 est bien une question de convention de dépôt.

## Conformité au plan

- [x] Le code fait ce que le plan spécifie — 11 tâches sur 11 présentes et vérifiées fichier par
      fichier ; les quatre « décisions à prendre en cours de plan » sont toutes consignées avec leur
      arbitrage.
- [x] Rien dans le diff que le plan n'ait demandé, hormis `role-privileges.ts` / `check.ts`, qui
      répondent au major 7 de la revue — légitime pour un cycle de correction.

## Anti-hallucination

- [x] **Aucune API inventée.** Chaque référence nouvelle a été ouverte : `getDb`, `withTenant`,
      `withRlsBypass`, `getOrganizationByDomainDao`, `updateOrganizationModulesDao`,
      `organizationModuleEnum`, `organizationModuleValues`, `ORGANIZATION_MODULES`,
      `normalizeTenantHost`, `isModuleEnabled`, `requireEnabledModuleDal`,
      `assertApplicationRolePrivileges`, `resolveMigrationUrl`, `withAuth(Component, role)`,
      `requireActionAuth({roles})`, `RoleConst.SUPER_ADMIN`, `ValidationParsedZodError`, et
      `updateTag` / `cacheTag` / `cacheLife` de `next/cache` (les trois existent dans cette version
      de Next). Chaque token de design employé existe dans `src/app/globals.css`. Les trois locales
      portent toutes les nouvelles clés.
- [ ] **Le code correspond à ce qu'il affirme** — une affirmation fausse, constat 4 :
      `tenant-dal.ts:34-36` écrit « Aucun appel a `logger` ici non plus » alors que le corps caché
      passe par la façade, donc par l'intercepteur de logging.
- [x] `set_config(..., true)` au lieu du `SET LOCAL` littéral de l'ADR 002 reste correct et
      correctement justifié.

## Conformité aux règles

- [x] Couches respectées ; `getDb()` partout (`git grep models/db -- src/db/repositories/` → vide) ;
      un seul site d'appel de `withRlsBypass` ; aucune valeur en dur (les modules sont un énuméré
      Postgres, ADR 010) ; `requireActionAuth` en premier dans les deux actions nouvelles ;
      re-validation côté serveur présente.
- [x] **L'ADR 003 est honoré à la lettre, layout racine bloquant compris.** L'affirmation de
      l'implémenteur a été vérifiée : l'ADR 003 dit « Un host inconnu fait appeler `notFound()` par
      le layout racine » et, en Consequences, « Toute page dépend de l'en-tête `Host` … aucune page
      n'est prerendue par tenant au build ». `export const instant = false` sur
      `src/app/[locale]/layout.tsx`, avec la raison écrite dans le fichier, est l'échappatoire
      sanctionnée par `rule-react-cache-next-cache.md`. L'affirmation est vraie et la conséquence est
      celle de l'ADR lui-même.
- [x] **L'ADR 014 est honnête et correctement propagé.** Il nomme explicitement le risque résiduel
      (« un bug applicatif peut énumérer des adhésions inter-tenant ; seuls les `can*` l'en
      empêchent »), le borne (« pas un document nominatif, une facture »), précise qu'il ne supersède
      pas l'ADR 002, et dit quand le rouvrir. Il est reflété dans l'en-tête de la migration `0004`,
      dans la liste d'architecture.md et dans le schéma vivant. **Et l'isolation applicative sur
      laquelle il s'appuie existe réellement** : `getOrganizationMembersService` et
      `getInvitationMembersService` passent par `canReadOrganizationMember`,
      `getUserOrganizationsService` / `getOrganizationsByUserIdService` filtrent sur l'id de
      l'appelant, et `getMembersAndInvitationsService` délègue aux deux premiers.
- [ ] Trois fichiers de règles laissés périmés — constats 2 et 3.
- [x] **Design system** : aucun composant, token ni couleur inventé. L'écran A est une page à trois
      `card`, `checkbox`, un bouton `default` + annulation en `outline`, encart `warning`, monogramme
      44 px en `font-serif` sur `accent-solid`, `alert` jamais un toast. L'écran B est `switch` +
      **libellé d'état écrit** + `badge`, cible 44 px, et le libellé ne bouge qu'après confirmation
      de l'enregistrement — exactement l'intention. L'encre du monogramme relève du manque déclaré
      n° 5, pas d'une dérive.

## Tests

- [x] Suite exécutée par le relecteur : 407 passed / 8 skipped.
- [x] **Les assertions épinglent les critères.** `organization-provisioning-service.test.ts` couvre
      les trois rôles globaux plus SUPER_ADMIN, la création de l'admin par email **et** sa
      réutilisation, le rattachement OWNER à ce tenant seul, le conflit de domaine nommé, et les clés
      de module inconnues — chacun assertant aussi que le repository n'a **pas** été appelé.
      `tenant-dal.test.ts` épingle le critère 2 (host, `x-forwarded-host`, retrait du port, domaine
      inconnu → `notFound`) et le critère 4 (module inactif, clé inconnue, domaine inconnu).
      `actions.test.ts` épingle la garde SUPER_ADMIN, les cinq champs, `withRlsBypass` et
      `updateTag('tenant')`. Aucun ne passerait sur une implémentation cassée.
- [ ] 6 tests navigateur non exécutés — constat 7.

## Régressions

- [x] Adhésions, inscription et invitations vérifiées de nouveau fonctionnelles au niveau SQL. Les
      suppressions sont des retombées propres, les assertions e2e `/api/projects` supprimées sont
      assumées dans l'ADR 013, et l'assertion du sélecteur d'organisation de
      `e2e/authorization.spec.ts` fonctionne de nouveau puisque `member` n'est plus sous policy.
- [ ] Une régression sur l'environnement déployé — constat 1.

## Constats

### major 1 — Premier déploiement : toutes les pages répondent « introuvable », sans issue depuis le produit

`src/app/[locale]/layout.tsx:40` et `drizzle/migrations/0003_huge_misty_knight.sql`. Toute page
`[locale]` — `/login` et le back-office du prestataire compris — exige désormais que
`organization.domain` corresponde au `Host` de la requête. Or `0003` ajoute `domain` **nullable, sans
reprise de données** (vérifié : la migration ne contient qu'un `ADD COLUMN` et la contrainte
d'unicité), et aucune étape de workflow, migration ou note d'exploitation n'enregistre le host
servant. Sur la base déployée, où toutes les organisations existantes ont `domain = NULL`, le premier
déploiement après fusion sert « introuvable » sur **toutes** les pages — et il n'existe aucun chemin
dans le produit pour provisionner la première association, l'écran de provisioning étant lui-même
derrière la garde. Conséquence relevée dans le journal du plan, non résolue.

### major 2 — `rule-persistence.md` enseigne encore le `db` direct qu'AGENTS.md interdit désormais

`.claude/rules/03-persistance/rule-persistence.md:112` donne `import db from '@/db/models/db'` et
`:133` `await db.query.users.findFirst(...)` comme **patron canonique du repository**, alors
qu'AGENTS.md:134 impose maintenant « les repositories appellent **`getDb()`, jamais `db`
directement** ». C'est la règle que 41 stories recopieront en ajoutant leur table métier. C'est
**exactement le mode de défaillance** que la story devait corriger pour les règles citant `projects`
— le critère 10 traitait les liens morts, pas les patrons périmés.

### major 3 — Deux fichiers de règles affirment des faits que ce diff invalide

- `rule-react-cache-next-cache.md` : « Il en reste quatre dans tout `src/app` » — il y en a
  désormais cinq, le cinquième couvrant tout le segment `[locale]` ; et « Les 21 routes `(app)` sont
  en `◐` » — aucune ne peut plus l'être.
- `rule-safe-route.md:41` et `:155` : « c'est vérifié dans `e2e/authorization.spec.ts` » — ce diff a
  supprimé cette spec 401/403.

`pnpm check:rules` passe parce qu'il valide les **chemins** cités, pas les **faits** cités.

### minor 4 — `tenant-dal.ts` affirme ne pas logger dans un scope caché, et le fait

`src/app/dal/tenant-dal.ts:38-56` : le corps en `'use cache'` appelle
`getOrganizationByDomainService` **via la façade**, donc via l'intercepteur de logging, donc via le
`new Date()` de Winston — que architecture.md (ligne 123, mise à jour dans ce même diff) et
`rule-react-cache-next-cache.md` listent comme interdit en scope caché, et que la tâche 8 du plan
signalait nommément. Le commentaire « Aucun appel a `logger` ici non plus » est donc faux. Dormant
aujourd'hui seulement parce qu'`instant = false` fait qu'aucune page sous `[locale]` ne se prerende ;
il resurgit dès que cet opt-out bouge. La chaîne d'appel a par ailleurs été vérifiée exempte de
`cookies()` / `headers()`, ce qui est le bon choix puisque la résolution doit précéder toute session.

### minor 5 — Un ADMIN qui bascule un module n'obtient aucun retour

`[id]/edit/page.tsx` est gardée par `withAuthAdmin` (ADMIN) tandis que
`updateOrganizationModulesAction` exige SUPER_ADMIN, et `requireActionAuth` est **hors** du `try` :
le refus s'échappe de l'action. Or `onToggle`
(`organization-modules-card.tsx:47`) n'a pas de `catch`. L'ADMIN n'obtient donc **aucun retour** — ni
l'`alert` que le design spécifie. Le comportement serveur est délibéré et testé
(`actions.test.ts:143`) ; c'est le `catch` client qui manque.

### minor 6 — L'état d'erreur de l'écran A est partiel face au design

Pas de liens d'ancrage vers les champs fautifs, pas de bordure `destructive` 2 px, et
`ProvisionFormState.errors` est déclaré mais jamais peuplé : un échec de validation serveur remonte
en `Path: domain | Message: …` dans l'alerte de synthèse plutôt qu'en messages par champ. L'alerte de
succès affichée en place (au lieu de « à l'arrivée sur la fiche ») est, elle, un écart consciemment
consigné et acceptable.

### minor 7 — Les 6 tests navigateur n'ont jamais tourné

Les critères 2, 4 et 6 restent bien étayés : les 5 assertions au niveau base ont été rejouées par le
relecteur, et des tests unitaires épinglent la résolution et la garde de module. Ce qui ne repose que
sur les mesures `curl` manuelles de l'implémenteur, c'est le câblage **à travers** le layout et la
lecture inter-tenant authentifiée. La CI exécute la suite complète : **ne pas fusionner avant qu'elle
soit verte.**

### minor 8 — `provisionOrganizationService` n'est atomique que par son appelant

Elle ne l'est que parce que l'action l'enveloppe dans `withRlsBypass`, qui ouvre la transaction que
chaque `getDb()` rejoint ensuite. Rien dans le service ni dans ses 20 tests ne l'impose : appelée
directement, un échec entre `createOrganizationDao` et `createOrganizationMemberDao` laisse une
organisation occupant un domaine sans administrateur, et la reprise échoue alors sur « ce domaine sert
déjà… ». Un `TxnDao` ou une note explicite refermerait le point.

### minor 9 — Reports assumés

Un seul commit là où la DoD en demandait deux ; ADR 009 amendé sur place malgré la règle
d'immuabilité d'AGENTS.md ; `slug SET NOT NULL` sans reprise (même famille de risque au déploiement
que le constat 1).

### minor 10 — Clés de traduction mortes

`AdminOrganizations.provision.breadcrumbHome` / `breadcrumbOrganizations` dans les trois locales ; le
fil d'Ariane vient de `admin/layout.tsx`.

## Ce qui mérite d'être salué

Le cycle de correction a fait le travail difficile correctement. La correction du scope imbriqué est
exemplaire : elle ne corrige pas seulement le code, elle **remplace un test qui certifiait le mock par
un test qui certifie le SQL réellement émis**, et le dit. L'ADR 014 nomme son propre coût au lieu de
le dissimuler, et l'en-tête de la migration porte l'exemption pour que le prochain lecteur ne puisse
pas la manquer. La classification des 20 tables est exacte — le schéma vivant a été listé pour le
vérifier. `db:check` assertant `rolsuper` / `rolbypassrls` referme l'échec silencieux que le plan
redoutait, et a trouvé au passage un vrai trou dans `.env.development`.

## Avant déploiement — ce n'est pas une correction de code

**Renseigner `organization.domain` sur chaque host servant l'application — back-office du prestataire
et host de connexion compris — avant le premier déploiement de cette branche.** Sans quoi
l'application déployée répond « introuvable » partout, et cela ne peut pas être réparé depuis
l'intérieur du produit (constat 1).

---

Max severity: major
Ship allowed: yes
