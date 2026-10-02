---
validated: yes
---

# Plan — Story s12-membres-parcelles

Branch: `feature/s12-membres-parcelles`, à créer depuis `main` **à jour** (s10 et s11 génèrent aussi
des migrations : voir tâche 1).

> **Sources** :
>
> - recherche : `docs/research/s12-membres-parcelles.md` ;
> - design : `docs/designs/s12-membres-parcelles.md` (écrans 0 à 5 ; l'écran 6 et les états de compte
>   `2f`, `3f`, `3g`, `3h` sont à **s12d**), maquette `docs/designs/s12-membres-parcelles.html` ;
> - design system : `docs/design-system.md` §3.1, §3.2, §3.4, §3.5, §3.9 ;
> - décisions : ADR 002 (RLS forcée), ADR 014 (`member` Better Auth = plan identité, exempté) ; **ADR 029**
>   (`docs/decisions/029-propriete-datee-des-parcelles.md`, écrit avec ce plan) ;
> - règles : `rule-architecture`, `rule-service`, `rule-services-tests`, `rule-persistence`,
>   `rule-transaction-dao`, `rule-safe-server-action`, `rule-form-front-and-back`,
>   `rule-zod-client-server-internationalization`, `rule-table-pagination`, `rule-react-cache-next-cache`,
>   `tdd-skill` (le test de la parcelle vendue d'abord).

## Target story

**En tant que** membre du bureau **je veux** gérer les propriétaires et leurs parcelles avec les
périodes de propriété **afin que** l'historique reste attaché au bon propriétaire après une vente.
Complexité 4, dépend de s01, s03, s03b (livrées).

1. Le bureau crée un membre (identifiant autogénéré, indépendant du numéro de parcelle et de l'email)
   et lui rattache une ou plusieurs parcelles avec une date de début de propriété.
2. Enregistrer une vente clôture la période du vendeur et ouvre celle de l'acquéreur, sans supprimer
   ni modifier la période close.
3. Le propriétaire d'une parcelle se lit à une date donnée : avant la vente → l'ancien, après → le
   nouveau — vérifié sur une parcelle vendue.
4. Une parcelle ne peut pas avoir deux propriétaires sur des périodes qui se chevauchent ; refus
   avec un message explicite.
5. Un membre possédant plusieurs parcelles est une seule fiche, avec la liste de ses parcelles.
6. Le bureau saisit et met à jour adresse postale, téléphone et email d'un membre depuis sa fiche.
7. Une fiche **sans email** existe, aucun compte n'est créé, elle est marquée « joignable par
   courrier uniquement ».
8. Une fiche « courrier uniquement » sans adresse postale est signalée **incomplète** dans la liste.

### Décisions rendues par l'utilisatrice (30/09/2026)

- **Story scindée** : les ex-critères 9 (email → compte, retrait → accès fermé) et 10 (« Mes
  parcelles », fiche d'un autre refusée) sont partis dans **s12d-comptes-membres** (`docs/stories.md`).
  s12 **n'ouvre ni ne ferme aucun compte** et ne touche ni `user` ni `member` (Better Auth). Au
  critère 5, « un seul compte » se lit donc ici « une seule fiche » ; le compte arrive avec s12d.
- **Libellé « Propriétaires »** pour l'entrée de barre latérale, le titre de la liste et le fil
  d'Ariane (gap 2 du design) : « Membres » côtoyait « Membres du bureau ». Les boutons suivent :
  « Ajouter un propriétaire », « Enregistrer le propriétaire ». Route `/bureau/proprietaires`.

### Décisions tranchées par ce plan

**A. Modèle — ADR 029.** Trois tables scopées par RLS forcée :

- `member_profile` — `id` uuid autogénéré (**la seule identité**, critère 1), `name` (un seul champ :
  « Jean et Odile Dubois », « SCI Les Pins »), `email`, `phone`, `address_line`,
  `address_complement`, `postal_code`, `city` — tous nullables sauf le nom —, et
  **`mail_only` colonne générée `GENERATED ALWAYS AS (email IS NULL) STORED`** : c'est un attribut
  du modèle que s25 et s28 liront, et il ne peut pas diverger de l'email. `''` n'est jamais stocké
  (normalisé en `NULL` à la validation), ni aucune adresse fictive. Index unique partiel
  `(organization_id, lower(email)) WHERE email IS NOT NULL` (design `2e`).
- `parcel` — `id`, `number` (texte, tel que l'ASL le note), unique `(organization_id, number)`. Une
  parcelle inconnue est **créée au rattachement** (`4d`), sans écran « Parcelles ».
- `parcel_ownership` — `parcel_id` et `member_profile_id` (`ON DELETE RESTRICT`), `starts_on`,
  `ends_on` nullable, **`CHECK (ends_on IS NULL OR ends_on > starts_on)`**. **Aucune colonne
  « propriétaire actuel » nulle part** : le propriétaire se lit toujours par date.

**B. Bornes : période demi-ouverte `[starts_on, ends_on)`.** `ends_on` est le **jour de la vente**,
premier jour de l'acquéreur ; le dernier jour du vendeur est la veille, comme l'écrit l'écran 5
(« Le dernier jour de propriété des vendeurs est la veille de cette date »). Le jour de la vente
appartient à l'acquéreur. Ainsi une vente ne produit jamais un jour de chevauchement ni un jour sans
propriétaire.

**C. Non-chevauchement sans extension Postgres.** La contrainte d'exclusion (`btree_gist`) demanderait
d'installer une extension que le rôle applicatif ne peut pas créer, en CI comme sur le VPS (s12b).
Retenu : **contrôle applicatif sous verrou de ligne**, dans la transaction du scope de tenant —
`SELECT … FROM parcel WHERE id = $1 FOR UPDATE`, lecture des périodes de la parcelle, contrôle par
la fonction pure de la tâche 2, puis écriture. Deux rattachements ou deux ventes simultanés sur la
même parcelle sont sérialisés. Considéré et écarté dans l'ADR 029.

**D. « Sans modifier la période close » (critère 2)** : une vente ne fait **qu'une** écriture sur la
période du vendeur — poser `ends_on`, une fois, sur une période **ouverte**. Une période close
(`ends_on` renseigné) n'est plus jamais mise à jour ni supprimée : le repository n'expose **aucune**
fonction qui le permettrait, et l'écran l'annonce (« Les périodes closes ne se modifient pas. »).

**E. Vente = une transaction** : verrou de la parcelle → période ouverte du vendeur → contrôles →
`ends_on = date` → nouvelle période de l'acquéreur à partir de `date`. Refus explicites : date
antérieure ou égale au début de la période du vendeur (`5e`), acquéreur = vendeur (`5f`),
chevauchement avec une période postérieure (`5g`). Tout ou rien.

**F. La lecture datée est un service public du domaine** : `getParcelOwnerAtService(organizationId,
parcelId, date)` → la fiche propriétaire à cette date, ou `undefined`. s18, s19, s28 et s32 l'appelleront.
Sa logique est la fonction pure `ownerAt(periods, date)`, testée **en premier** (TDD, test de la
parcelle vendue), et sa requête réelle est prouvée en e2e.

**G. « Fiche incomplète »** = `mail_only` et aucune adresse postale exploitable (adresse, code postal
et commune tous absents). Calculée à la lecture (fonction pure + `WHERE` du compte de la ligne
`meta`), pas stockée : elle dépend de quatre colonnes qui changent ensemble.

**H. Adresse structurée** (Adresse / Complément / Code postal / Commune) pour le publipostage de s28.
Code postal : 5 chiffres. Téléphone : même règle que s10 (30 caractères, chiffres, espaces,
`+ . - ( )`). Aucun champ n'est obligatoire hormis le nom : une fiche sans adresse s'enregistre et
devient « incomplète » (l'encart de l'écran 2 ne bloque pas).

**I. Liste** : tri par **nom tel que saisi** (donc par prénom pour « Jean et Odile Dubois » — un « nom
de tri » serait un champ de plus, non demandé) ; recherche par nom ou par numéro de parcelle
**actuelle** (proposition du design, gardée : 400 fiches sans recherche ne se parcourent pas) ;
pagination 25 lignes, 25 cartes en mobile (arbitrage de s08).

**J. Ce que s12 ne fait pas, dit pour que la revue ne le compte pas comme un manque** : **aucune purge,
aucune coupure automatique d'accès** (arbitrage RGPD en attente, `V5 §5.1`) ; aucun compte (s12d) ;
pas d'agrégation de factures (Pennylane, s19/s20) ; indivision (une parcelle a un seul propriétaire
par période — le critère 4 le suppose) ; suppression ou fusion de fiches ; écran « Parcelles » ;
import (s13) ; rattachement des fiches du bureau à leurs comptes (s12d) ; `association.member_count`
**laissé tel quel** (aucun critère ne le remplace ; le brancher sur le vrai décompte est une petite
story à part, à décider).

## Tasks (ordered)

1. [x] **Modèle, migrations, RLS, registre d'actions, types de domaine** (ADR 029).
   - `src/db/models/member-profile-model.ts`, `parcel-model.ts` (parcelle + période), enregistrés dans
     `src/db/models/db.ts`. Colonne générée `mail_only`, `CHECK` des bornes, index uniques de la
     décision A, index `(parcel_id, starts_on)` et `(member_profile_id)` sur les périodes.
   - Migration du modèle par `pnpm db:generate` ; si drizzle-kit ne rend pas la colonne générée ou le
     `CHECK`, les compléter par `drizzle-kit generate --custom` — jamais de SQL ni de journal à la
     main. Policies `tenant_isolation` forcées sur les trois tables par `--custom` (patron
     `0025_water_analysis_rls.sql`).
   - ⚠️ **Rebaser sur `main` à jour avant de générer** : s10 et s11 génèrent leurs propres migrations ;
     régénérer après rebase, jamais recoudre le journal.
   - `ActionIdConst.MEMBER_PROFILE_MANAGE = 'member.profile.manage'`, rôles `['owner', 'board']`.
   - `src/services/types/domain/member-profile-types.ts` et `parcel-ownership-types.ts` : DTO (fiche,
     parcelle actuelle, ancienne parcelle avec « vendue à »), constantes (`MEMBER_PROFILES_PAGE_SIZE
     = 25`, format du code postal). **Sans importer de modèle Drizzle.**
   - **Tests** : `member.profile.manage` autorise `owner` et `board`, refuse `member` et hors
     association ; `rls-inventory.test.ts` vert avec les trois tables « scopées » ; `pnpm db:generate`
     sans diff.

2. [x] **Règles de propriété datée : fonctions pures, écrites en premier** (critères 2, 3, 4 ;
   décisions B, D, E, F). `src/services/rules/parcel-ownership-rules.ts` (ou l'emplacement des règles
   pures existant), sans base ni mock :
   - `ownerAt(periods, date)` — **premier test écrit** : parcelle 47, Dubois du 03/02/1998, vendue à
     Roy le 15/06/2026 → le 14/06/2026 rend Dubois, le 15/06/2026 et après rendent Roy, le 02/02/1998
     rend `undefined`.
   - `findOverlap(periods, candidate)` en demi-ouvert : deux périodes contiguës (`ends_on` =
     `starts_on`) ne se chevauchent pas ; une période ouverte chevauche tout ce qui la suit.
   - `planSale({periods, sellerId, buyerId, date})` → `{close: {periodId, endsOn}, open: {…}}` ou un
     refus typé (`date_not_after_start`, `buyer_is_seller`, `no_open_period`, `overlap`).
   - `isIncomplete(profile)` (décision G).
   - **Tests** : ces cas, plus dates limites (vente le lendemain du début, vente le jour du début →
     refus), période close jamais présente dans `close`.

3. [x] **Fiches : validation, repository, service** (critères 1, 6, 7, 8 ; décisions A, G, H, I).
   - `src/services/validation/member-profile-validation.ts` : nom `trim` non vide ≤ 200, email
     facultatif (`''`/espaces → `undefined`, sinon valide), téléphone, adresse (≤ 200), complément,
     code postal `^\d{5}$`, commune ≤ 100 ; schéma client traduit partagé
     (`rule-zod-client-server-internationalization`).
   - `src/db/repositories/member-profile-repository.ts`, **toujours `getDb()`** : création, mise à
     jour des coordonnées, lecture par id, page triée par nom avec recherche (nom **ou** numéro de
     parcelle actuelle, `ILIKE` échappé), comptes (total, incomplètes).
   - `src/services/member-profile-service.ts` (+ façade, intercepteur **`shouldLogDetails: () =>
     false`** : coordonnées personnelles) : `create`, `updateContact`, `get`, `getPage`, chacun
     `canPerformAction(..., MEMBER_PROFILE_MANAGE)` avant tout accès. Email déjà porté par une autre
     fiche de l'association → résultat `email_taken` avec l'id de cette fiche (lien du `2e`), jamais
     une exception brute. **Aucun appel** à `user`, `member`, ni à un service de compte.
   - **Tests** (`rule-services-tests`, DAO mockés) : rôles (`[ORGANIZATION OWNER]`, `[ORGANIZATION
     ADMIN]` passent ; `[ORGANIZATION MEMBER]`, `[USER NOT IN ORGANIZATION]`, `[PUBLIC]` refusés
     **sans DAO appelé**) ; identifiant rendu par la base, jamais dérivé de l'email ou d'une parcelle ;
     sans email → `mailOnly` vrai, aucun DAO de compte appelé (critère 7) ; `''` → absent ; email pris
     → `email_taken` ; incomplète calculée comme la règle G.

4. [x] **Parcelles et ventes : repository transactionnel, service, lecture datée** (critères 1 à 5 ;
   décisions C, D, E, F).
   - `src/db/repositories/parcel-ownership-repository.ts`, **toujours `getDb()`** (la transaction du
     scope de tenant, jamais `db.transaction()` qui en sortirait) : `findOrCreateParcelTxnDao`
     (`INSERT … ON CONFLICT DO NOTHING` puis lecture), `lockParcelTxnDao` (`FOR UPDATE`), périodes
     d'une parcelle, **`closeOpenPeriodTxnDao` qui ne met à jour que `WHERE ends_on IS NULL`**,
     `openPeriodTxnDao`, parcelles actuelles et anciennes d'une fiche (avec l'acquéreur), propriétaire
     à une date. **Aucune fonction de mise à jour ni de suppression d'une période close.**
   - `src/services/parcel-ownership-service.ts` (+ façade) : `attachParcelService({memberProfileId,
     parcelNumber, startsOn})`, `recordSaleService({parcelId, sellerId, buyerId, date})`,
     `getParcelOwnerAtService`, `getMemberParcelsService` ; autorisation `MEMBER_PROFILE_MANAGE`
     (la lecture datée aussi : aucun lecteur public n'existe encore) ; règles de la tâche 2 appliquées
     **après** le verrou ; refus rendus comme résultats typés, traduits par l'action.
   - **Tests** : le service applique `planSale` et n'écrit rien sur un refus ; la clôture ne vise que la
     période ouverte du vendeur ; rattachement d'une parcelle inconnue la crée ; chevauchement → refus
     avec le propriétaire en place et sa date dans le résultat (message explicite, critère 4) ; deux
     parcelles rattachées à la même fiche → une fiche, deux parcelles actuelles (critère 5) ; rôles
     comme en tâche 3.

5. [x] **Back-office : liste des propriétaires** (design écrans 0 et 1 ; critères 5, 7, 8).
   - `src/app/dal/member-profile-dal.ts` : `cache()` + `withCurrentTenant`, sans `'use cache'`
     (données personnelles d'administration, derrière `<Suspense>`), `canManageCurrentMemberProfilesDal`.
   - `src/app/[locale]/(bureau)/bureau/proprietaires/page.tsx` : `h1` « Propriétaires », `meta`
     « N propriétaires · N fiche(s) incomplète(s) », bouton « Ajouter un propriétaire », recherche
     (champ écrit, sans loupe — gap 5, paramètre d'URL), tableau Propriétaire · Parcelles (numéros
     actuels en `data` ou « Aucune parcelle actuelle ») · Contact (email ou badge neutre « Courrier
     uniquement ») · État (badge `warning` « Fiche incomplète » seulement) · « Ouvrir la fiche ».
     Pagination écrite ; cartes sous 640 px (Contact = email, sinon adresse, sinon « Aucune
     adresse »). États vide, chargement (`skeleton`), recherche sans résultat.
   - Barre latérale : « Propriétaires » **en tête** du groupe « L'association », sans icône (gap 1).
   - Libellés `BureauMemberProfilesPage`, `BureauIdentityPage.nav.memberProfiles`.
   - **Tests** (jsdom, DAL mockée) : badge « Courrier uniquement » pour une fiche sans email ; badge
     « Fiche incomplète » pour la seule fiche sans email ni adresse, cellule vide sinon ; plusieurs
     parcelles actuelles sur une ligne ; recherche et pagination conservent les paramètres ; membre
     simple → `<BureauAccessDenied />`.

6. [x] **Back-office : ajouter un propriétaire et fiche** (design écrans 2, 3, 4 ; critères 1, 5, 6,
   7, 8).
   - `proprietaires/nouveau/page.tsx` : trois `card` (Identité, Coordonnées avec l'encart « Sans
     adresse email… » visible **tant que l'email est vide**, Parcelles avec la phrase de renvoi à la
     fiche) ; erreurs aux trois signaux avec résumé « N champs à corriger. Rien n'a été enregistré. » ;
     `2e` (email pris, lien vers l'autre fiche) ; après succès, redirection vers la fiche avec `alert`
     neutre « Propriétaire enregistré. ».
   - `proprietaires/[id]/page.tsx` : `h1` = nom, badges ; `card` **Coordonnées** en paires (« Non
     renseignée » / « Non renseigné » accordés) avec modification **en place** ; si incomplète,
     `alert` `warning` en tête avec « Ajouter une adresse postale » (`3d`) ; `card` **Parcelles** :
     actuelles (Parcelle · Propriétaire depuis · « Enregistrer une vente ») et anciennes (période
     « du … au … » où le « au » est **la veille** de `ends_on`, « Vendue à » en lien, « Les périodes
     closes ne se modifient pas. », aucune action). La `card` « Accès à l'espace membre » n'est **pas**
     livrée ici (s12d) ; le marquage courrier uniquement se lit dans les badges.
   - `dialog` « Rattacher une parcelle à … » : numéro (`data`), date « Propriétaire depuis le »
     pré-remplie à aujourd'hui (Europe/Paris), « Annuler » écrit ; erreurs `4b` (« Cette date n'existe
     pas. »), `4c` (chevauchement, message qui nomme le propriétaire en place et sa date), `4d`
     (parcelle créée, dit dans le succès). Mobile : ancré en bas, pleine largeur, boutons 56 px
     empilés (gap 4, retenu).
   - `actions.ts` : `requireActionAuth()` → façade → `revalidatePath` de la fiche et de la liste.
   - **Tests** (jsdom + actions) : encart visible puis masqué à la saisie d'un email ; enregistrer sans
     adresse passe ; affichage « au 14/06/2026 » pour `ends_on` = 15/06/2026 ; aucune action sur une
     ancienne parcelle ; dialog : refus de chevauchement rendu avec le nom ; actions refusées sans
     rôle, revalidation après succès seulement.

7. [x] **Back-office : enregistrer une vente** (design écran 5 ; critères 2, 3, 4).
   - `proprietaires/[id]/vente/[parcelId]/page.tsx` : `breadcrumb`, `h1` « Enregistrer la vente de la
     parcelle N », **Date de la vente** avec l'aide sur la veille, **Acquéreur** en `command` dans un
     `popover` (`sheet` bas d'écran en mobile) alimenté par une action de recherche (nom + parcelles
     actuelles en `meta`), lien « L'acquéreur n'a pas encore de fiche ? Ajoutez-le d'abord » qui
     revient ensuite avec l'acquéreur présélectionné et la date conservée (proposition du design,
     gardée) ; encart **« Ce qui va changer »** calculé par `planSale` côté client, puis
     `alert-dialog` qui le reprend **mot pour mot** avant l'envoi.
   - Refus `5e`, `5f`, `5g` rendus par champ ou en `alert` ancré ; succès → retour sur la fiche du
     vendeur, la parcelle passée dans « Anciennes parcelles ».
   - **Tests** (jsdom + action) : l'encart et l'`alert-dialog` rendent le même texte ; la clôture
     affichée est la veille ; chaque refus s'affiche et **aucune** écriture n'est tentée côté action
     quand le service refuse ; l'acquéreur présélectionné au retour.

8. [x] **Seed, documentation, ADR.**
   - `src/db/scripts/tenant-member-profiles-seed.ts` (+ test), branché dans `seed.ts` : sur TechCorp,
     une fiche avec deux parcelles, une fiche courrier uniquement avec adresse, une **incomplète**, et
     **la parcelle 47 vendue** (Dubois 03/02/1998 → Roy 15/06/2026) ; sur Marketing Pro, ses propres
     fiches, dont une parcelle **de même numéro** que chez TechCorp (le numéro n'est unique que dans
     une association). Valeurs fictives.
   - `docs/decisions/029-propriete-datee-des-parcelles.md` (écrit avec ce plan, voyage avec la
     branche).
   - `docs/architecture.md` : les trois tables au classement RLS (**recompter**, la garde le vérifie),
     le modèle daté, la lecture `getParcelOwnerAtService` comme point d'entrée des stories suivantes,
     et la distinction `member` (Better Auth, identité) / `member_profile` (fiche métier).
   - `docs/design-system.md` : gaps retenus — historique daté d'une parcelle (gap 3), `dialog` mobile
     ancré en bas (gap 4).
   - **Tests** : seed déterministe ; `pnpm check:rules`.

9. [x] **Preuve e2e : `e2e/member-profiles.spec.ts`** (tenants A et B, SQL direct).
   - **Critère 1** : créer un propriétaire puis lui rattacher deux parcelles ; l'identifiant en base est
     un UUID sans rapport avec l'email ni les numéros.
   - **Critères 2, 3** : sur la parcelle 47 seedée puis sur une vente faite à l'écran — la période du
     vendeur garde son début et son membre, reçoit sa fin, et **c'est la seule écriture sur sa ligne**
     (instantané SQL avant / après) ; `getParcelOwnerAtService` est prouvée par la requête réelle :
     veille → vendeur, jour de la vente et après → acquéreur (appel via une page de contrôle ou SQL
     équivalent au DAO, selon le patron des specs existantes).
   - **Critère 4** : rattacher la 47 à un troisième propriétaire depuis une date où Roy la possède →
     refus avec le message ; aucune ligne ajoutée.
   - **Critère 5** : une fiche, deux parcelles, une ligne dans la liste.
   - **Critères 6, 7, 8** : créer sans email → badge « Courrier uniquement », **aucune ligne `user` ni
     `member` créée** (SQL) ; sans adresse → « Fiche incomplète » dans la liste ; ajouter une adresse
     depuis la fiche → le badge disparaît ; modifier téléphone et email → relus.
   - **Isolation** : les fiches et parcelles de A sont absentes chez B ; la RLS refuse de les lire
     depuis le scope de B ; la parcelle de même numéro chez B n'est pas celle de A ; ouvrir
     `/bureau/proprietaires/{id de A}` sur le domaine de B ne rend rien.

## Files touched

**Créés**

- persistance : `src/db/models/member-profile-model.ts`, `parcel-model.ts`,
  `src/db/repositories/member-profile-repository.ts`, `parcel-ownership-repository.ts`, migrations
  `drizzle/migrations/00NN_*.sql` (modèle, compléments `--custom`, policies) et instantanés ;
- domaine et services : `src/services/types/domain/member-profile-types.ts`,
  `parcel-ownership-types.ts`, les règles pures (+ tests),
  `src/services/validation/member-profile-validation.ts`, `src/services/member-profile-service.ts`,
  `parcel-ownership-service.ts`, façades et intercepteurs, tests sous `src/services/__tests__/` ;
- DAL et écrans : `src/app/dal/member-profile-dal.ts`,
  `src/app/[locale]/(bureau)/bureau/proprietaires/*` (liste, `nouveau`, `[id]`,
  `[id]/vente/[parcelId]`, `actions.ts`), `src/components/features/member-profile/*` (+ tests) ;
- seed : `src/db/scripts/tenant-member-profiles-seed.ts` (+ test) ; e2e :
  `e2e/member-profiles.spec.ts` ;
- ADR 029 ; documents de la story : `docs/research/s12-membres-parcelles.md`,
  `docs/designs/s12-membres-parcelles*` (brief, md, html, zip), ce plan.

**Modifiés**

- `src/db/models/db.ts`, `src/services/types/domain/action-registry-types.ts`,
  `src/components/features/association/bureau-sidebar.tsx`, `messages/fr.json`,
  `src/db/scripts/seed.ts`, `docs/architecture.md`, `docs/design-system.md`.

## Test strategy

- **TDD d'abord sur les règles pures** (tâche 2) : le test de la parcelle vendue est le premier écrit,
  il échoue, puis la règle le fait passer. C'est lui qui attrape la clé étrangère « propriétaire
  actuel » que la story redoute.
- **Unitaires (Vitest, `pnpm test --run`)** : règles pures, services par rôle (DAO mockés),
  validation, écrans en jsdom, actions. ⚠️ Montage 9p lent : un timeout de worker se relance sur une
  copie en disque local, il ne compte pas comme vert.
- **E2E (build de prod, base éphémère)** : `e2e/member-profiles.spec.ts` prouve la requête datée
  réelle, l'immuabilité de la période close, l'absence de compte créé et l'isolation entre deux
  associations — la RLS ne se teste pas en unitaire.
- Laissé à la revue : la sérialisation sous vraie concurrence (le `FOR UPDATE` est lisible dans le
  repository).

## Definition of Done

- Les huit critères couverts par des tests verts, unitaires et `e2e/member-profiles.spec.ts`,
  isolation comprise ; le test de la parcelle vendue écrit en premier.
- **Aucune colonne « propriétaire actuel »**, aucune fonction de modification d'une période close.
- Trois tables à RLS forcée, classées ; `rls-inventory.test.ts` vert ; aucun `withRlsBypass()`
  nouveau hors e2e.
- L'identité d'un propriétaire est son UUID, jamais l'email ni un numéro de parcelle ; aucune chaîne
  vide ni adresse fictive stockée ; `mail_only` généré.
- s12 ne crée, ne modifie ni ne supprime aucune ligne `user` ou `member`.
- Rien en dur : libellés dans `messages/fr.json`, plafonds en constantes de domaine, seed fictif.
- Aucune purge ni coupure automatique (décision J), écrit dans le PR.
- Lint et types propres ; `pnpm db:generate` sans diff ; un seul commit de story (plus un pour les
  migrations si utile), PR unique ; `/ks-review` : `Ship allowed: yes`.

## Points à arbitrer avant validation

1. **Contrôle sous verrou plutôt que contrainte d'exclusion** (décision C) : la garantie reste
   applicative. La contrainte `EXCLUDE … gist` serait plus forte, mais exige d'installer `btree_gist`
   par un rôle privilégié en CI et sur le VPS (s12b) ; on pourra y passer plus tard par une migration,
   sans changer le modèle.
2. **Recherche dans la liste** (décision I) : hors critères, gardée parce que 400 fiches ne se
   parcourent pas sans elle.
3. **Route `/bureau/proprietaires`** plutôt que `/bureau/membres` du design, pour suivre le libellé
   retenu.
