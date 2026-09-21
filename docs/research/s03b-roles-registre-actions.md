# Research — Story s03b-roles-registre-actions

## Target story

**En tant que** présidente d'une association **je veux** que chacun n'accède qu'à ce que son rôle
permet **afin que** le back-office reste réservé au bureau sans réglage de ma part.

Réf. `V5 §2, §3.2`, `CDCT §2`. Scindée de s03 le 19 septembre 2026 (voir
`docs/research/s03-connexion-lien-magique.md`, section « Rôles » et « Autorisation », qui couvrait
encore s03b et s03c avant la scission — une bonne partie de cette recherche en hérite, revérifiée sur
l'état du code au 21 septembre 2026, après le merge de s03 et s12a).

### Acceptance criteria (docs/stories.md)

- [ ] Les quatre rôles Membre, Bureau, Président(e) et SuperAdmin existent et sont attribuables à un utilisateur.
- [ ] Un Membre reçoit un refus sur toute page de back-office, un Bureau y accède, et le refus vaut aussi bien en interface que sur l'appel serveur direct.
- [ ] Une action déclarée au registre avec ses rôles par défaut est refusée à tout rôle absent de cette liste, et autorisée aux autres — vérifié sur une action de test.
- [ ] Les actions posées avant cette story — téléverser le logo et le favicon (s01b), modifier les paramètres de l'association (s02) — sont déclarées au registre avec pour rôles par défaut Bureau et Président(e) : un Membre y reçoit un refus et un Bureau y est autorisé, en interface comme sur l'appel serveur direct.

### Dependencies

`s01, s01b, s02` — toutes livrées (vérifié : `docs/reviews/s01-*.md`, `s01b-*.md`, `s02-*.md` portent
`Ship allowed: yes`, et les trois sont mergées sur `main`, commits `0685cb0`, `fbc80b0`, `7d03868`).
**Aucune dépendance non levée.**

---

## Current state of the code

Vérifié le 21 septembre 2026, sur `main` (dernier commit `25c8667`, s12a mergée). s03 est livrée mais
a **explicitement exclu** rôles et registre de son périmètre : `docs/plans/s03-connexion-lien-magique.md`
ligne 37 — « Hors périmètre : rôles et registre (s03b), lien et session sur le domaine de chaque
association (s03c). » Rien de s03b n'a donc été anticipé par s03.

### Rôles d'association aujourd'hui

- **Énuméré Postgres** `organization_role` = `['admin', 'member', 'owner']`
  (`src/db/models/auth-model.ts:207-211`), colonne `member.role` (`organizationRoleEnum('role').default('member').notNull()`).
  `member` est **exemptée de RLS** (ADR 014, plan identité) — le renommage de la valeur d'énuméré n'a
  donc aucune interaction avec une policy RLS, seulement avec les données existantes de la colonne.
- **Deux constantes distinctes pointent vers la même valeur `'admin'`**, à maintenir synchronisées :
  - `UserOrganizationRoleConst` (`src/services/types/domain/auth-types.ts:38-42`) :
    `{OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member'}`.
  - `OrganizationRoleConst` (`src/services/types/domain/organization-types.ts:28-32`) :
    `{admin: 'admin', member: 'member', owner: 'owner'}`.
- **~30 usages** de ces deux constantes dans `src/` (hors tests), tous **via la constante**, sauf
  **deux exceptions en chaîne littérale `'admin'`**, vérifiées ligne à ligne :
  - `src/lib/better-auth/auth.ts:364` — `member?.role === 'owner' //|| member?.role === 'admin'`
    (la branche `admin` est **déjà commentée**, dans `authorizeReference` pour la gestion Stripe en
    mode `BillingModes.ORGANIZATION`).
  - `src/services/subscription-service.ts:458` — `userOrg?.role === 'owner' || userOrg?.role === 'admin'`,
    **active**, même fonctionnalité (qui peut gérer un abonnement Stripe en mode organisation).
  - `NEXT_PUBLIC_BILLING_MODE=organization` est la valeur par défaut de `env.example` **et** de
    `.env.test` : ce chemin est actif, pas mort. Un renommage qui ne toucherait que la constante
    laisserait ce contrôle cassé silencieusement (plus aucun membre `board` ne pourrait gérer
    l'abonnement plateforme).
- **`src/db/scripts/seed.ts` porte le même littéral `'admin'` pour DEUX colonnes différentes** —
  exactement le piège que la story anticipe. Vérifié précisément (`grep -n "'admin'"`) :
  - Lignes **144** et **158** : `INSERT INTO "user" (..., role) VALUES (..., 'admin')` — le rôle
    **global** des comptes `admin@gmail.com` et `admin-owner@gmail.com`. **À ne pas toucher.**
  - Lignes **290, 296, 301** : dans le `CASE` qui alimente `INSERT INTO "member" (..., role, ...)`,
    castées `::organization_role` — le rôle **d'association** de `admin@gmail.com` (chez
    `marketing-pro`), `user@gmail.com` (chez `acme-corp`) et `user-admin@gmail.com` (chez
    `marketing-pro` — le compte cité par la recherche de s01b comme cas « Bureau » testé). **À
    renommer en `'board'`.**
    Ce fichier n'est pas typé Drizzle (SQL brut) : un renommage d'énuméré n'y est pas rattrapé par le
    compilateur, il doit être fait à la main, ligne par ligne, sans confondre les deux colonnes qui
    partagent la même chaîne.
- **Rôle global homonyme, à ne pas toucher** : `RoleConst.ADMIN = 'admin'` (rôle **système**,
  `src/services/types/domain/auth-types.ts:50`, distinct de l'énuméré `organization_role`). Un
  rechercher-remplacer aveugle sur la chaîne `'admin'` casserait `admin@gmail.com`,
  `withAuthAdmin`, `RoleConst.ADMIN`, etc. — c'est le piège nommé explicitement par la story.

### Better Auth — plugin `organization`, config actuelle vérifiée

`src/lib/better-auth/auth.ts:152-181` (`organization({...})`, lu en entier) : **aucune des options
`ac`, `roles`, `creatorRole` n'est passée**. Better Auth 1.7.1 utilise alors ses rôles par défaut, lus
dans le paquet lui-même :

- `node_modules/better-auth/dist/plugins/organization/access/statement.mjs` exporte
  `defaultStatements`, `defaultAc = createAccessControl(defaultStatements)`, et trois rôles
  pré-construits `adminAc`, `ownerAc`, `memberAc`, assemblés en
  `defaultRoles = {admin: adminAc, owner: ownerAc, member: memberAc}`.
- Le sous-chemin `better-auth/plugins/organization/access` est bien exposé dans les exports du
  package (`node_modules/better-auth/package.json:269`), donc importable directement — pas besoin de
  redéfinir les permissions par défaut, seulement de les **réassigner sous une autre clé**.
- Le type `OrganizationOptions` (`node_modules/better-auth/dist/plugins/organization/types.d.mts:45,58,62`)
  accepte `ac?: AccessControl`, `roles?: {[key: string]?: Role<any>}`, `creatorRole?: string`.
- Côté client, `organizationClient(options)` (`node_modules/better-auth/dist/plugins/organization/client.d.mts:22-24,59`)
  accepte le **même** couple `ac`/`roles` — `src/lib/better-auth/auth-client.ts:28` appelle
  aujourd'hui `organizationClient()` sans argument.

### Autorisation « bureau » aujourd'hui

- `canManageAssociation(user, organizationId)` (`src/services/authorization/association-authorization.ts`) :
  vrai si `super_admin` **ou** rôle d'association `owner`/`admin` **de cette organisation précise**.
  Volontairement hors CASL (son propre commentaire le dit) pour exclure l'`admin` global.
- **Trois appels au total dans tout `src/`, hors tests** :
  `src/services/association-identity-service.ts:131` (mutation : remplacer logo/favicon),
  `src/services/association-identity-service.ts:220` (lecture : `canManageAssociationIdentityService`,
  utilisé par le layout `(bureau)` pour décider d'afficher le contenu ou `BureauAccessDenied`),
  `src/services/association-settings-service.ts:72` (mutation : modifier les réglages). Ce sont
  précisément les deux stories citées par le critère 4 (s01b : logo + favicon ; s02 : réglages).
- Chaque appel est **écrit à la main dans le service**, aucun ne passe par un mécanisme déclaratif
  commun — exactement ce que la note de la story appelle « contrôle à la main en doublon du
  registre », à corriger sans changer le comportement observable (les tests existants de ces deux
  services doivent continuer à passer tels quels).
- Gabarit de Server Action déjà en place : `src/app/[locale]/(bureau)/bureau/reglages/actions.ts`
  appelle `requireActionAuth()` **sans rôle** (vérifie seulement qu'une session existe) puis laisse le
  service trancher — le contrôle de rôle métier vit **exclusivement côté service**, jamais dans la
  Server Action ni dans la page. C'est le niveau où le registre doit s'intégrer.
- `src/proxy.ts:13-19` : `/bureau` est déjà dans `AUTHENTICATED_SEGMENTS` (niveau 0, garde-fou de
  routage — session présente ou redirection `/login`, aucune vérification de rôle). Le refus de rôle
  (niveau 1) est backend/service, rendu aujourd'hui par `BureauAccessDenied` dans
  `src/app/[locale]/(bureau)/layout.tsx` (toujours un `200`, cf. `rule-safe-route.md` / ADR 013).

### Registre d'actions

- **N'existe nulle part** (`grep -rn "action_registry|actionRegistry" src` → vide, reconfirmé).
- **Tension documentaire non résolue** entre deux sources : `docs/architecture.md` (section « Data
  model », « Entités ajoutées par ASL-CMS ») le liste **nommément `action_registry`** aux côtés
  d'entités qui sont des tables Drizzle réelles (`page`, `content_block`, `member_profile`…) — ce qui
  suggère une table. La story, elle, est explicite : « Le registre est ici une **simple déclaration
  avec rôles par défaut, sans écran** ; s37 le transforme en matrice configurable par tenant » — ce
  qui décrit un module de code, pas une table, à l'image du registre des paramètres posé par s02
  (`ASSOCIATION_SETTINGS_REGISTRY`, ADR 016). Confirmation indirecte : `action_registry` **n'apparaît
  dans aucune des 21 tables classées** de `docs/architecture.md` (section « Classement RLS des 21
  tables du schéma ») — la table n'existe donc pas aujourd'hui, quelle que soit la lecture retenue à
  terme. Voir « Open questions ».
- **Gabarit directement réutilisable** : `src/services/types/domain/association-settings-types.ts`
  (ADR 016) — un tableau `readonly` de définitions typées, des fonctions pures de résolution/validation,
  **aucune dépendance serveur** (module isomorphe : sert au service, au DAL et au formulaire). C'est
  la forme la plus proche de ce que la story décrit pour le registre d'actions, et le seul précédent
  de « registre en code » du projet.

## Anchor points

- **Énuméré et données** : `organizationRoleEnum` (`src/db/models/auth-model.ts:207`), `member.role`.
  Renommage par migration **custom** (`drizzle-kit generate --custom`), probablement
  `ALTER TYPE organization_role RENAME VALUE 'admin' TO 'board'` (Postgres ≥ 10 le permet nativement,
  sans réécriture de table ; à vérifier que Drizzle génère bien ce SQL ou si un SQL manuscrit dans le
  fichier custom est nécessaire — pas de précédent de renommage de valeur d'énuméré dans
  `drizzle/migrations/` à ce jour, seulement des créations/modifications de policies).
- **Constantes** : `UserOrganizationRoleConst.ADMIN` et `OrganizationRoleConst.admin` — renommer la
  **clé et la valeur** dans les deux fichiers.
- **Config Better Auth serveur** : `organization({...})` dans `src/lib/better-auth/auth.ts:152`,
  ajouter `ac`, `roles: {board: adminAc, owner: ownerAc, member: memberAc}` (import depuis
  `better-auth/plugins/organization/access`), et vérifier `creatorRole` (le créateur d'association est
  aujourd'hui implicitement `owner` par défaut de la lib — à confirmer que ça reste vrai avec des
  rôles personnalisés déclarés).
- **Config Better Auth client** : `organizationClient({ac, roles})` dans
  `src/lib/better-auth/auth-client.ts:28`, mêmes rôles que le serveur.
- **Les ~28 sites d'usage** de `UserOrganizationRoleConst`/`OrganizationRoleConst` recensés par le
  `grep` ci-dessus continuent de fonctionner sans modification **tant qu'ils passent par la
  constante** — seul le nom `.ADMIN`/`.admin` doit rester cohérent avec sa nouvelle valeur `'board'`
  (renommer la clé est optionnel pour la compilation, mais nécessaire pour la lisibilité — à trancher
  en plan : garder la clé `ADMIN`/`admin` avec une valeur `'board'`, ou renommer aussi la clé en
  `BOARD`/`board` partout, ce qui touche plus de fichiers mais évite la confusion permanente entre nom
  de clé et valeur réelle).
- **Les deux littéraux à corriger explicitement**, non couverts par un renommage de constante :
  `src/lib/better-auth/auth.ts:364` et `src/services/subscription-service.ts:458`.
- **`src/db/scripts/seed.ts`** : remplacer le littéral SQL `'admin'` par `'board'` pour les rôles
  d'association concernés, sans toucher aux adresses email ni au rôle global.
- **Nouveau module du registre** : à créer dans `src/services/types/domain/` (ex.
  `action-registry-types.ts`), sur le gabarit de `association-settings-types.ts`. Doit exposer un
  registre `readonly` de définitions `{id, defaultRoles}` et une fonction pure
  `isActionAllowedForRole(registry, actionId, role)` ou équivalent, testable avec un registre de test
  (comme le critère 2 de s02 exigeait un registre de paramètres de test).
- **Nouvelle fonction d'autorisation générique**, probablement dans
  `src/services/authorization/` (ex. `action-registry-authorization.ts`), qui combine
  `getAuthUser()` + rôle d'organisation + `SUPER_ADMIN` bypass + lookup dans le registre — pour que
  `canManageAssociation` (ou son successeur) devienne un appel à cette fonction générique avec un
  `actionId` donné, plutôt qu'un test de rôle écrit à la main. **Sans changer le résultat observable**
  pour `association-identity-service.ts` et `association-settings-service.ts` (critère 4 : « sans
  changer leur comportement »).
- **e2e à réutiliser** : `e2e/association-settings.spec.ts` et `e2e/tenant-isolation.spec.ts` donnent
  le patron pour une preuve « Membre refusé / Bureau autorisé » sur une action de test et sur les
  deux actions reprises.

## Verified APIs / functions

| Symbole                                          | Signature / valeur vérifiée                                                                       | Emplacement                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `organizationRoleEnum`                           | `pgEnum('organization_role', ['admin', 'member', 'owner'])`                                       | `src/db/models/auth-model.ts:207`                                                                                     |
| `member.role`                                    | `organizationRoleEnum('role').default('member').notNull()`                                        | `src/db/models/auth-model.ts:226`                                                                                     |
| `UserOrganizationRoleConst`                      | `{OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member'}`                                              | `src/services/types/domain/auth-types.ts:38`                                                                          |
| `OrganizationRoleConst`                          | `{admin: 'admin', member: 'member', owner: 'owner'}`                                              | `src/services/types/domain/organization-types.ts:28`                                                                  |
| `canManageAssociation`                           | `(user: User \| undefined, organizationId: string) => boolean`                                    | `src/services/authorization/association-authorization.ts:21`                                                          |
| `organization()` plugin options                  | `ac?: AccessControl`, `roles?: {[key]: Role<any>}`, `creatorRole?: string`                        | `node_modules/better-auth/dist/plugins/organization/types.d.mts:45,58,62`                                             |
| `defaultRoles`, `adminAc`, `ownerAc`, `memberAc` | rôles par défaut de Better Auth, réutilisables tels quels sous une nouvelle clé                   | `better-auth/plugins/organization/access` (`node_modules/better-auth/dist/plugins/organization/access/statement.mjs`) |
| `organizationClient(options)`                    | `{ac?, roles?}` — même forme que le serveur                                                       | `node_modules/better-auth/dist/plugins/organization/client.d.mts:22-24,59`                                            |
| `requireActionAuth()`                            | `(options?: {roles?: Roles[]}) => Promise<User>` — vérifie la session, pas le rôle d'organisation | `src/app/dal/user-dal.ts` (usage vérifié dans `bureau/reglages/actions.ts:57`)                                        |
| `AUTHENTICATED_SEGMENTS`                         | inclut `/bureau`                                                                                  | `src/proxy.ts:13-19`                                                                                                  |
| `ASSOCIATION_SETTINGS_REGISTRY`                  | gabarit de registre en code, isomorphe, à imiter                                                  | `src/services/types/domain/association-settings-types.ts`                                                             |

## Traps & constraints

1. **Deux constantes dupliquent la même valeur d'énuméré** (`UserOrganizationRoleConst.ADMIN` et
   `OrganizationRoleConst.admin`) : un renommage doit toucher les deux fichiers, sans en oublier un —
   et vérifier qu'aucun troisième endroit ne redéfinit encore une copie (recherche exhaustive faite,
   aucune autre trouvée à ce jour, mais à refaire après tout ajout de code par une story intermédiaire).
2. **Deux littéraux `'admin'` échappent à toute recherche par nom de constante** :
   `src/lib/better-auth/auth.ts:364` et `src/services/subscription-service.ts:458`, tous deux dans la
   logique d'autorisation Stripe en mode `BillingModes.ORGANIZATION` (actif par défaut,
   `NEXT_PUBLIC_BILLING_MODE=organization` dans `env.example` et `.env.test`). Un `grep` sur le nom de
   la constante ne les trouve pas ; il faut un `grep` séparé sur la chaîne littérale `'admin'`
   restreint aux fichiers de rôle d'organisation (en excluant `admin@gmail.com`, `RoleConst.ADMIN`,
   `withAuthAdmin`, etc.).
3. **`src/db/scripts/seed.ts` est du SQL brut**, pas du Drizzle typé : le renommage n'y est pas
   rattrapé par le compilateur TypeScript, doit être fait à la main, et un test de garde ou une
   relecture attentive est nécessaire pour ne pas confondre le littéral `'admin'` (rôle d'organisation,
   à renommer) avec l'email `admin@gmail.com` (compte, à ne pas toucher) ou tout `role: 'admin'` du
   rôle **global** dans la table `user` (à ne pas toucher non plus).
4. **Le rôle global homonyme `RoleConst.ADMIN = 'admin'`** ne doit jamais être touché — c'est déjà
   nommé explicitement par la story, confirmé par le code : il gouverne `withAuthAdmin`,
   `/admin` (back-office plateforme), et n'a aucun rapport avec `organization_role`.
5. **Better Auth doit recevoir les mêmes rôles des deux côtés** (serveur `auth.ts` et client
   `auth-client.ts`) : un déphasage entre les deux casserait silencieusement l'autocomplétion/typage
   des rôles côté client sans forcément faire échouer un test, puisque le contrôle réel d'accès vit
   côté serveur (`canManageAssociation` ou son successeur), pas dans le plugin client.
6. **Le registre, tel que décrit par la story, est un mécanisme de code sans écran** — pas de CRUD, pas
   de page d'administration. `docs/architecture.md` le nomme comme s'il s'agissait déjà d'une table,
   ce qui n'est le cas dans aucune lecture cohérente du périmètre actuel de s03b (voir « Open
   questions » n°1). Un plan qui créerait une table `action_registry` maintenant irait au-delà de ce
   que critère 3 et critère 4 demandent, et empièterait sur le périmètre annoncé de s37.
7. **Retrait du contrôle à la main sans régression de comportement** : les tests existants de
   `association-identity-service.test.ts` et `association-settings-service.test.ts` couvrent déjà les
   scénarios Bureau/Président(e)/Membre/SuperAdmin pour ces deux services — ils doivent continuer à
   passer **sans modification de leurs assertions** si le refactor vers le registre est fidèle. Une
   modification de ces tests serait un signal que le comportement a changé, contraire au critère 4.
8. **`pnpm test` reste en mode watch** — utiliser `pnpm test --run` pour toute exécution non interactive.
9. **Migrations** : `pnpm db:generate` ou `drizzle-kit generate --custom` pour le renommage de valeur
   d'énuméré ; jamais de SQL manuscrit hors de ce mécanisme, jamais d'édition manuelle de
   `meta/_journal.json`.
10. **Tests à ne pas casser** (recensés dans l'ancienne recherche de s03, revérifiés pertinents) :
    `association-authorization.test.ts`, les tests de service d'organisation et de CASL
    (`casl-abilities` a un `case UserOrganizationRoleConst.ADMIN:` à conserver fonctionnellement
    identique), et les specs e2e `tenant-isolation`, `association-identity`, `association-settings`
    (qui utilisent des comptes de rôle d'organisation `admin`/`owner` du seed).

## Open questions

1. **Le registre d'actions est-il un module de code (comme le registre des paramètres, ADR 016) ou une
   table `action_registry` ?** La story dit clairement « simple déclaration, sans écran » ; l'
   architecture documente une entité nommée `action_registry` aux côtés de vraies tables. Aucune des
   deux sources ne se corrige explicitement l'une l'autre. Recommandation à trancher en `/ks-plan` (ou
   à vérifier avec l'utilisatrice avant) : un registre en code, cohérent avec « sans écran » et avec le
   seul précédent du projet (ADR 016) — ce qui laisserait `docs/architecture.md` à corriger (retirer
   `action_registry` de la liste des tables, ou préciser qu'il s'agit d'un module de code que s37
   fera persister).
2. **Renommer aussi les clés des constantes (`.ADMIN`/`.admin` → `.BOARD`/`.board`), ou garder les clés
   et ne changer que la valeur `'admin'` → `'board'` ?** Renommer les clés est plus cohérent à long
   terme mais touche davantage de fichiers (tous les ~28 sites d'usage recensés, contre seulement les
   deux définitions de constantes + les deux littéraux si on ne touche que la valeur). Impact sur
   l'étendue du diff à chiffrer en plan.
3. **Le `creatorRole` de Better Auth** — non explicitement configuré aujourd'hui (défaut probable
   `owner`, comportement actuel du provisioning s01 à revérifier) : la déclaration de rôles
   personnalisés (`roles: {...}`) change-t-elle ce défaut ? À vérifier en plan, potentiellement par un
   test d'intégration sur la création d'organisation.
4. **La fonction générique du registre remplace-t-elle `canManageAssociation`, ou s'ajoute-t-elle à
   côté ?** Le critère 4 exige que le comportement des deux actions existantes ne change pas ; la note
   « à vérifier en review, pas en test » (pages ne dupliquant pas le contrôle) suggère que
   `canManageAssociation` doit devenir une implémentation du mécanisme générique plutôt qu'un chemin
   parallèle — mais ce n'est pas explicitement tranché par la story.
5. **Faut-il un test de garde pour interdire un futur littéral `'admin'` non constant** (sur le modèle
   du test de garde des imports de SDK de stockage posé par s12a), pour éviter que la classe de bug
   trouvée en traps 2 ne se reproduise silencieusement dans une story future ? Hors du périmètre
   strict des critères, mais cohérent avec la discipline du projet — à évaluer en plan.
