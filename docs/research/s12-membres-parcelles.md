# Research — Story s12-membres-parcelles

## Target story

**Rattacher un membre à ses parcelles** — le bureau gère les propriétaires et leurs parcelles avec
des périodes de propriété, pour que l'historique reste attaché au bon propriétaire après une vente.
Complexité 4. Dépendances : s01, s03, s03b (toutes livrées). **Cœur du modèle de données : tout le
bloc B en dépend.**

Critères d'acceptation (docs/stories.md) :

1. Le bureau crée un membre (identifiant autogénéré, indépendant du numéro de parcelle **et** de
   l'email) et lui rattache une ou plusieurs parcelles avec une date de début de propriété.
2. Enregistrer une vente clôture la période du vendeur et ouvre celle de l'acquéreur, sans
   supprimer ni modifier la période close.
3. Le propriétaire d'une parcelle se lit à une date donnée : avant la vente → l'ancien, après → le
   nouveau — vérifié par un test sur une parcelle vendue. (Les rattachements des relevés, documents
   et factures se vérifient dans s18, s32, s19.)
4. Une parcelle ne peut pas avoir deux propriétaires sur des périodes qui se chevauchent ; la
   tentative est refusée avec un message explicite.
5. Un membre possédant plusieurs parcelles est un seul compte, avec la liste de ses parcelles.
6. Le bureau saisit et met à jour les coordonnées d'un membre depuis sa fiche : adresse postale,
   téléphone, email — y compris pour un membre sans compte.
7. Le bureau crée une fiche **sans email** : la fiche existe, aucun compte n'est créé, elle est
   marquée « joignable par courrier uniquement ».
8. Une fiche « courrier uniquement » sans adresse postale est signalée **incomplète** dans la liste.
9. Renseigner un email sur une fiche « courrier uniquement » lui ouvre un compte connectable ; le
   retirer referme l'accès sans supprimer la fiche ni son historique.
10. Un membre ne voit que ses propres parcelles ; l'accès à la fiche d'un autre membre est refusé.

Notes agentiques structurantes : relation **datée** (jamais une FK `parcel → membre_courant`) ;
écrire **en premier** le test de la parcelle vendue ; fonction « propriétaire d'une parcelle à une
date » appelée plus tard par s18, s19, s28, s32 ; **l'adresse postale est produite ici et nulle
part ailleurs** ; frontière s16 (même modèle, deux points d'entrée) ; **frontière s03 : s12
« appelle » la capacité d'ouverture/fermeture de compte de s03, sans la réimplémenter** ; « courrier
uniquement » est un attribut du modèle membre ; ne jamais déduire l'absence d'email d'une chaîne
vide ni la contourner par une adresse fictive ; **aucune purge, aucune coupure automatique
d'accès** (arbitrage RGPD en attente — à noter dans le plan) ; pas d'agrégation de factures.

## Current state of the code

**Rien du domaine membre/parcelle n'existe.** Aucune table `member_profile`, `parcel`,
`parcel_ownership` (noms annoncés par `docs/architecture.md`, section « Data model ») ; aucun
service, DAL, route ni composant. L'inventaire RLS compte **29 tables**, dont 10 scopées.

Ce qui existe autour :

| Élément | État | Emplacement |
| --- | --- | --- |
| `user` (Better Auth) | `email text NOT NULL UNIQUE` — **unique sur toute la plateforme**, pas par association ; `role` global | `src/db/models/auth-model.ts:27-41` |
| `member` (Better Auth) | pivot `user ↔ organization`, `role` d'organisation (`member` par défaut), `unique(organization_id, user_id)` ; **exemptée de RLS** (ADR 014, plan identité) | `auth-model.ts:213-230` |
| `invitation` (Better Auth) | `organization_id`, `email`, `role` — l'invitation est s15 | `auth-model.ts:234` |
| Rôles d'association | `owner` (Présidente), `board` (Bureau), `member` (Membre) | `src/lib/better-auth/organization-roles.ts` |
| Registre d'actions | 9 actions, toutes `['owner', 'board']` ; aucune pour les membres | `src/services/types/domain/action-registry-types.ts` |
| Paramètre `association.member_count` | saisi à la main « **en attendant la base des membres de s12** » (commentaire du registre) ; lu par `/le-bureau` public et bureau | `association-settings-types.ts:130`, `(public)/le-bureau/page.tsx:58`, `(bureau)/bureau/le-bureau/page.tsx:65` |
| Espace membre `(app)` | `dashboard` = composant du boilerplate (`DashboardPage` sous `withAuth`), `account`, `team` — rien d'association | `src/app/[locale]/(app)/` |
| Back-office `(bureau)` | pages, actualités, analyses d'eau, navigation, messages, le bureau, alerte, identité, réglages — pas de « Membres » | `src/app/[locale]/(bureau)/bureau/`, `bureau-sidebar.tsx` |

**Création / fermeture de compte aujourd'hui** — il n'existe **pas** de capacité « ouvrir /
fermer un compte de membre » livrée par s03 : les critères de s03 (voir `docs/stories.md:376`)
couvrent le lien magique, l'adaptateur d'envoi et `disableSignUp` (un lien ne crée jamais de
compte). Les seuls chemins de création existants :

- `provisionOrganizationService` (`src/services/organization-service.ts:669`) : réutilise un `user`
  existant par email (`getUserByEmailDao`) sinon `createUserDao({email, name: email})`, puis
  `createOrganizationMemberDao({userId, organizationId, role: OWNER, createdAt})`. C'est **le
  modèle canonique** de la couche service (validation → autorisation → repository).
- `createOrganizationMemberService` (`organization-service.ts:239`) et
  `removeUserFromOrganizationService` (`:269`, refuse de retirer un `OWNER`) : fonctions **anciennes**
  du fichier, qui font autorisation puis validation — l'architecture dit de ne pas les recopier.
- `createUserService`, `createUserFromStripeService` (`src/services/user-service.ts:54/337`) :
  boilerplate.

**Connexion** : depuis s03c, un compte **sans appartenance** (`member`) à l'association du domaine
appelé ne reçoit pas de lien (« non-membre = inconnu », `docs/architecture.md`). C'est donc la
ligne `member` qui rend un compte « connectable » sur une association donnée.

## Anchor points

- **Modèles** : nouveaux fichiers `src/db/models/` (fiche membre, parcelle, période de propriété),
  migration générée (`pnpm db:generate`) + migration `--custom` pour les policies RLS forcées
  (patron `drizzle/migrations/0025_water_analysis_rls.sql`, prochaine migration `0026`).
- **Inventaire RLS** : `docs/architecture.md` (décomptes « 29 tables », « 10 tables ») et
  `src/db/rls-inventory.test.ts`.
- **Registre d'actions** : nouvelles entrées dans `ActionIdConst` / `ACTION_REGISTRY` pour la
  gestion des membres par le bureau ; le critère 10 (un membre lit **ses** parcelles) n'est pas une
  action de registre — c'est une règle de propriété (`canPerformAction` ne connaît que les rôles).
- **Back-office** : un segment `src/app/[locale]/(bureau)/bureau/<membres>/` + entrée dans
  `NAV_GROUPS` (`src/components/features/association/bureau-sidebar.tsx`).
- **Espace membre** : `src/app/[locale]/(app)/` pour « mes parcelles » (critère 10).
- **Ouverture / fermeture de compte** : `createUserDao`, `getUserByEmailDao`,
  `createOrganizationMemberDao`, `deleteUserOrganizationDao` (utilisés par
  `provisionOrganizationService` et `removeUserFromOrganizationService`).
- **Seed** : `src/db/scripts/seed.ts` — des membres et parcelles de test, dont une parcelle vendue,
  sur deux tenants pour l'e2e d'accès croisé.

## Verified APIs / functions

| Nom | Signature / comportement | Emplacement |
| --- | --- | --- |
| `withTenant` | `<T>(organizationId: string, callback: () => Promise<T>) => Promise<T>` | `src/db/tenant-scope.ts:128` |
| `getDb` | `() => ScopedDb` — **la transaction du scope courant** : un `…TxnDao` appelé dans `withTenant` doit utiliser `getDb()`, pas `db.transaction` | `tenant-scope.ts:122` |
| `withRlsBypass` | porte dérobée SuperAdmin — **à ne pas utiliser** ici | `tenant-scope.ts:144` |
| `canPerformAction` | `(user \| undefined, organizationId, actionId) => boolean` ; SUPER_ADMIN toujours vrai | `src/services/authorization/action-registry-authorization.ts:18` |
| `getAuthUser` | utilisateur courant avec `organizations[]` (`organizationId`, `role`) | `src/services/authentication/auth-service` |
| `provisionOrganizationService` | patron « réutiliser le `user` par email, sinon le créer, puis poser `member` » | `src/services/organization-service.ts:669` |
| `createOrganizationMemberDao`, `getUserOrganizationDao`, `deleteUserOrganizationDao` | écriture / lecture / suppression d'une ligne `member` | `src/db/repositories/organization-repository.ts:178/185/212` |
| `createUserDao`, `getUserByEmailDao` | création / recherche d'un `user` | `src/db/repositories/user-repository.ts:31/74` |
| `UserOrganizationRoleConst` | constantes des rôles d'organisation | `src/services/types/domain/auth-types.ts:43` |
| `requireCurrentTenantDal`, `withCurrentTenant` | tenant du domaine appelé | `src/app/dal/tenant-dal.ts:93/112` |
| Précédent de date « métier » | `date('published_on', {mode: 'string'})` | `src/db/models/news-model.ts:49` |

## Traps & constraints

- **Le piège annoncé** : une FK `parcel.current_member_id` passe tous les tests naïfs. Le test de
  la parcelle vendue (critère 3) s'écrit **en premier**.
- **Chevauchement (critère 4)** : un contrôle applicatif « lire puis écrire » laisse passer deux
  ventes concurrentes. La garantie en base serait une contrainte d'exclusion sur une plage de
  dates (`EXCLUDE USING gist (parcel_id WITH =, daterange(...) WITH &&)`), qui demande
  l'extension **`btree_gist`** — **absente** : seule `uuid-ossp` est créée
  (`src/db/scripts/migrate.ts`). drizzle-kit ne génère pas de contrainte d'exclusion ⇒ migration
  `--custom`. Et le rôle applicatif n'est ni SUPERUSER ni BYPASSRLS (`role-privileges.ts`) : qui
  crée l'extension, en CI et sur le VPS (s12b) ?
- **Bornes des périodes** : date de fin **incluse ou exclue** ? Si la vente est « le 15 », le 15
  appartient-il au vendeur ou à l'acquéreur ? Une plage demi-ouverte `[début, fin)` évite
  qu'une vente produise un chevauchement d'un jour ; le critère 3 teste « avant / après » sans
  dire « le jour même ».
- **Vente (critère 2) = deux écritures atomiques** (clôture + ouverture) : transaction —
  convention `…TxnDao`, mais **sous `withTenant`** la transaction est déjà ouverte : `getDb()` la
  rend ; un `db.transaction()` direct sortirait du scope de tenant (et de la RLS).
- **« Sans modifier la période close »** : poser la date de fin sur la période du vendeur **est**
  une modification de sa ligne. Le critère vise à interdire de réécrire son début / son membre ;
  à formuler précisément au plan (ex. une période close devient immuable).
- **`user.email` est unique sur toute la plateforme.** Un propriétaire de deux ASL a **un** `user`
  et deux lignes `member`. Ouvrir un compte à partir d'un email déjà connu doit **réutiliser**
  le `user` (précédent : `provisionOrganizationService`), jamais en créer un second (violation
  d'unicité). Symétrique : **fermer** l'accès = retirer la ligne `member` de **cette** association,
  jamais supprimer le `user`.
- **Deux « membres » homonymes** : la table Better Auth `member` (pivot identité, exemptée de
  RLS, ADR 014) et la future fiche membre (donnée métier, **RLS forcée**, clé arbitraire). Ne pas
  étendre `member` : l'ADR 014 dit qu'« aucune table métier future n'hérite de cette exemption ».
  Le nom de la nouvelle table doit éviter la confusion (l'architecture annonce `member_profile`).
- **Lien fiche ↔ compte** : la fiche membre référence (optionnellement) un `user` — lien nullable.
  Le critère 9 exige que retirer l'email « referme l'accès sans supprimer la fiche ni son
  historique » : la fiche ne doit pas dépendre du `user` en `cascade`.
- **Changement d'email sur une fiche qui a un compte** : non couvert par les critères (le compte
  suit-il ? un autre `user` porte-t-il déjà cet email ?).
- **Email vide ≠ absent** : normaliser `''` en `NULL`, et « courrier uniquement » ne doit **pas**
  être dérivé d'une chaîne vide (note de la story). Décider si c'est une colonne stockée ou une
  dérivée de `email IS NULL` — la note dit « attribut du modèle membre », que s25/s28 consomment.
- **Frontière s03 non tenable telle qu'écrite** : la story demande d'« appeler la capacité de
  s03 », qui n'existe pas (voir Current state). Il faudra la **créer** ici, une seule fois, pour que
  s15 (invitation) et s42 (lancement) l'appellent — au lieu d'en faire une seconde plus tard.
- **Sessions ouvertes** : retirer la ligne `member` empêche un nouveau lien (s03c), mais une
  session déjà ouverte reste valide jusqu'à expiration — le `customSession` recharge les
  organisations à chaque requête, à vérifier au plan.
- **Critère 10 et l'espace membre** : `(app)/dashboard` est encore le tableau de bord du
  boilerplate ; les pages héritées de `(app)` (`account/organizations`, `team/[slug]`) « ne sont
  pas scopées au domaine » (architecture, « Reste connu »). La lecture « mes parcelles » doit
  partir du `user` de la session **et** de l'association du domaine appelé.
- **Accès croisé** : RLS non testable en unitaire (`db.ts` refuse la connexion en test) ⇒ e2e
  Playwright sur deux tenants, dans `e2e/tenant-isolation.spec.ts` ou une spec dédiée. Les
  repositories sont mockés en unitaire : le test de la parcelle vendue (critère 3) prouve donc la
  **logique** de résolution datée en unitaire, et la requête réelle seulement en e2e.
- **`association.member_count`** : saisi à la main « en attendant s12 ». s12 ne le remplace pas
  (aucun critère), mais le laisser coexister avec un vrai décompte crée deux vérités.
- **Aucune purge, aucune coupure automatique** (note RGPD) : ne rien coder de tel ; le consigner
  dans le plan pour que la review ne le compte pas comme manque.
- **Complexité 4** et 10 critères : volume comparable à s01/s04 ; le seuil de scission a déjà été
  appliqué à s03 pour cinq sujets à risque. À réévaluer au plan (modèle daté / coordonnées /
  ouverture-fermeture de compte / espace membre).
- **Tests unitaires** : montage 9p lent — un timeout de worker Vitest n'est ni un échec ni un vert.

## Open questions

1. **Capacité d'ouverture / fermeture de compte** : s03 ne l'a pas livrée. s12 la crée-t-elle
   (en service réutilisable par s15 et s42), ou faut-il rouvrir le découpage ?
2. **Ouvrir un compte envoie-t-il quelque chose ?** Le critère 9 dit « connectable » ; l'invitation
   est s15 et le lancement s42. Hypothèse : aucune notification, le membre demande un lien lui-même.
3. **Convention de bornes** des périodes (fin incluse / exclue, jour de la vente).
4. **Garantie de non-chevauchement** : contrainte d'exclusion (`btree_gist`, à installer par qui ?)
   ou contrôle applicatif sous verrou (`SELECT … FOR UPDATE` sur la parcelle) ?
5. **Identifiant de parcelle** : format du numéro (cadastral ? interne à l'ASL ?), unicité par
   association ? La note dit « non unique » pour l'identité, pas forcément pour la saisie.
6. **Achat à plusieurs** (indivision, couple) : une parcelle a-t-elle un seul propriétaire par
   période ? Le critère 4 le suppose ; la note « partagé dans un foyer » évoque l'email, pas la
   propriété.
7. **Vendeur sans autre parcelle après la vente** : sa fiche reste (historique), son accès aussi ?
   La règle de coupure attend l'arbitrage RGPD — donc l'accès reste, a priori.
8. **Structure de l'adresse postale** : un bloc de texte ou des champs (ligne, code postal,
   commune) ? s28 (publipostage) imprimera ces adresses.
9. **Changement de l'email d'une fiche qui a déjà un compte** (non couvert).
10. **Le bureau et la Présidente ont-ils aussi une fiche membre ?** Ils sont propriétaires : leur
    compte existe déjà (ligne `member` en `board`/`owner`) — la fiche s'y rattache-t-elle ?
11. **Remplacer `association.member_count`** par le décompte réel, ou le laisser tel quel ?
