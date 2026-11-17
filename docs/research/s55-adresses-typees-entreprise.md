# Research — Story s55-adresses-typees-entreprise

## Target story

**En tant que** membre du bureau **je veux** distinguer l'adresse du terrain de vacances et le domicile du
propriétaire, et nommer l'entreprise qui y est domiciliée **afin que** le courrier de l'association arrive
chez le bon destinataire. Complexité 2. Dépendances : s12, s13, s16 (toutes livrées).

Critères d'acceptation :

1. Une fiche porte deux adresses de types distincts, toutes deux facultatives : « terrain » et « domicile ».
2. Le domicile est l'adresse postale de la fiche : là où le site affiche ou fournit une adresse postale
   aujourd'hui (fiche du bureau, coordonnées de s16), c'est elle. s28 l'utilisera (critère porté par s28).
3. Une fiche sans adresse email et sans domicile est signalée incomplète dans la liste (règle de s12,
   déplacée sur le domicile).
4. Libellé facultatif « nom de l'entreprise » : imprimé dans le bloc adresse du courrier, affiché dans la
   fiche ; ne change rien d'autre (rôle, facture, droit de vote).
5. Le bureau saisit les deux adresses et le libellé depuis la fiche ; le membre corrige son domicile depuis
   son espace (s16).
6. L'import de s13 renseigne les deux types depuis les colonnes du fichier ; l'import annuel (s56) porte le
   même critère.

Notes agentiques : l'adresse postale de s12 devient le domicile, **par migration de données, sans perte** ;
ne pas inventer de règle de reconnaissance des entreprises sans vérification sur le fichier ; déclarer les
colonnes à l'inventaire de s12c et à l'export de s38.

## Current state of the code

### Persistance

- `src/db/models/member-profile-model.ts` — `member_profile` porte **un seul jeu** d'adresse postale :
  `address_line`, `address_complement`, `postal_code`, `city` (+ `phone`, `name`, `pennylane_customer_id`).
  Le commentaire de tête dit « Aucune colonne d'adresse : les adresses d'une fiche vivent dans
  `member_profile_email` » — il parle des adresses **email** (s54) ; il faudra le réécrire pour ne pas
  confondre avec les adresses postales typées.
- `src/db/repositories/member-profile-repository.ts` :
  - type de ligne l. 51-54 (`addressLine`, `addressComplement`, `postalCode`, `city`) ;
  - compte `incomplete` de la page l. 361-370 : SQL brut
    `mailOnly and address_line is null and postal_code is null and city is null` — **seconde copie** de la
    règle d'incomplétude, à garder alignée avec `isIncomplete` ;
  - `MemberPostalContactWrite` l. 504-509 et `updateMyMemberProfilesContactDao` (l. 513-531) : met à jour
    téléphone + adresse postale de **toutes** les fiches du compte (s16, s53).
- `parcel` (`src/db/models/parcel-model.ts`) : `number`, `meter_number` — **aucune colonne de lieu**
  (rue, commune). La propriété est datée dans `parcel_ownership`.

### Services et règles

- `src/services/rules/parcel-ownership-rules.ts` l. 105-120 : `isIncomplete(profile)` =
  `mailOnly && addressLine === null && postalCode === null && city === null`.
- `src/services/rules/member-profile-rules.ts` : `toMemberProfileDto` recopie les champs d'adresse et
  calcule `incomplete`.
- `src/services/validation/member-profile-validation.ts` l. 37-53 : `postalContactShape` (adresse, complément,
  code postal à cinq chiffres `MEMBER_PROFILE_POSTAL_CODE_PATTERN`, commune), réutilisé l. 58, 77, 104
  (création, mise à jour bureau, mise à jour membre).
- `src/services/member-space-service.ts` l. 106-260 : `postalContactOf`, `contactGroupsOf` (groupes de
  coordonnées divergentes entre terrains, s53 écran 2b), `getMyContactService`, `updateMyContactService`.
- `src/services/member-import-service.ts` l. 100-130 : `createProfile` passe `addressLine`, `postalCode`,
  `city` à `createMemberProfileService` ; un client déjà présent (même `pennylane_customer_id`) donne
  `already_present` — **l'import ne met pas à jour une fiche existante** (voie « mise à jour » = s56).
  `FIELD_REJECTIONS` mappe `postalCode` → `invalid_postal_code`.

### Import (mappage Pennylane)

`src/lib/import/pennylane-clients-mapper.ts` — `PENNYLANE_COLUMNS` lit aujourd'hui `Adresse`, `Code Postal`,
`Ville` (obligatoires comme colonnes), `Pays` (facultatif) vers l'**unique** adresse postale. Les colonnes
`Adresse de Livraison`, `Code Postal de Livraison`, `Ville de Livraison`, `Pays de Livraison` et
`Type de Client` **ne sont pas lues**. `rejectionOf` rejette une ligne `NO_CONTACT` quand ni `Adresse` ni
email. `padPostalCode` complète un code à quatre chiffres en France (remarque `postal_code_padded`).
`sameNameAndAddressRemarks` compare nom + `addressLine` + `postalCode`.

### Types de domaine

- `src/services/types/domain/member-profile-types.ts` : `MemberProfileContact` (email, phone, addressLine,
  addressComplement, postalCode, city), `MemberProfileFieldsDTO` (+ `mailOnly`, `incomplete`),
  `MemberProfileContactInput`, `CreateMemberProfileInput`, `UpdateMemberProfileContactInput`, constantes
  `MEMBER_PROFILE_ADDRESS_MAX_LENGTH` (200), `MEMBER_PROFILE_CITY_MAX_LENGTH` (100).
- `src/services/types/domain/member-space-types.ts` l. 47-90 : `MyPostalContactDTO`, `MyContactGroupDTO`,
  `MyContactDTO`, `UpdateMyContactInput`.
- `src/services/types/domain/member-import-types.ts` l. 105-111 : `ImportMemberCandidate` (addressLine,
  postalCode, city).

### Présentation

- `src/components/features/member-profile/member-contact-fields.tsx` (champs du formulaire, l. 151-156…),
  `member-profile-form.tsx`, `member-profile-form-validation.ts`, `member-profile-detail.tsx` (bannière
  « incomplète » l. 191-217, carte « Coordonnées » l. 225, `dt` « Adresse postale » l. 472, bouton
  « Ajouter une adresse postale » l. 204), `member-profile-format.ts` (`postalAddressLineOf`).
- `src/components/features/member-space/my-contact-card.tsx` (s16).
- Libellés : `messages/fr.json`, namespace `BureauMemberProfilesPage` (l. 3185 compteur, 3201 badge,
  3459-3465 `detail.incomplete`, `detail.addPostalAddress`, `detail.contact.postalAddress`). Le texte de la
  bannière dit « ni adresse email ni adresse postale » : à reformuler sur le domicile.

### Seeds

`src/db/scripts/seed.ts` l. 599-621 (INSERT `member_profile` avec les quatre colonnes) et
`src/db/scripts/tenant-member-profiles-seed.ts` (fiches fictives, communes Lacanau / Biscarrosse).

## Anchor points

- **Modèle** : `member-profile-model.ts` (ou une table nouvelle, voir « Open questions » §4) + migration
  générée (`pnpm db:generate`) + migration de données `--custom` « adresse postale → domicile » si les
  colonnes sont renommées ou déplacées.
- **Règle d'incomplétude** : `isIncomplete` (rules) **et** le SQL du compteur
  (`getMemberProfilePageDao`, l. 370) — les deux à déplacer sur le domicile.
- **Bureau** : formulaire et détail de la fiche (`member-contact-fields.tsx`, `member-profile-detail.tsx`),
  validation partagée `postalContactShape`, action `bureau/proprietaires/actions.ts` (+ tests).
- **Espace membre** : `member-space-service.ts` (coordonnées = domicile ; le terrain n'y est pas
  modifiable), `my-contact-card.tsx`, `updateMyMemberProfilesContactDao`.
- **Import** : `PENNYLANE_COLUMNS` + `parseLine` + `rejectionOf` + `ImportMemberCandidate` +
  `createProfile`.
- **Inventaire s12c** : `docs/architecture.md`, tableau des tables, ligne `member_profile` (l. 394) ; si une
  table nouvelle, le classement RLS « des 47 tables » (l. 368) et `src/db/rls-inventory.test.ts`.
- **Export s38** : non livrée ; même mention que s54 (« s38 devra la déclarer »).

## Verified APIs / functions

| Nom                                     | Emplacement                                                | Rôle aujourd'hui                                          |
| --------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| `memberProfile` (pgTable)               | `src/db/models/member-profile-model.ts`                    | une seule adresse postale, 4 colonnes                     |
| `isIncomplete(profile)`                 | `src/services/rules/parcel-ownership-rules.ts` l. 112-120  | `mailOnly` et les 3 champs postaux nuls                   |
| `toMemberProfileDto(row)`               | `src/services/rules/member-profile-rules.ts`               | DTO + `incomplete`                                        |
| `postalContactShape`                    | `src/services/validation/member-profile-validation.ts` l. 37 | Zod partagé création / bureau / membre                  |
| `updateMyMemberProfilesContactDao(...)` | `src/db/repositories/member-profile-repository.ts` l. 513  | coordonnées de toutes les fiches du compte                |
| `getMyContactService`, `updateMyContactService` | `src/services/member-space-service.ts`             | « Mes coordonnées » (s16, s53)                           |
| `mapPennylaneClients(table)`            | `src/lib/import/pennylane-clients-mapper.ts`               | mappage pur, `PENNYLANE_COLUMNS`                          |
| `normalizeHeader`                       | `src/lib/import/csv-reader.ts`                             | comparaison des titres de colonnes                        |
| `postalAddressLineOf(contact)`          | `src/components/features/member-profile/member-profile-format.ts` | adresse sur une ligne                              |

## Le fichier réel (`docs/inputs/Base-adherents-utf8.csv`, hors git)

Constats agrégés uniquement (aucune valeur nominative reprise) — 413 lignes, une ligne par identifiant client
(aucun client sur plusieurs lignes).

- **Entreprises — question (3) tranchée** : la colonne **`Type de Client`** vaut `Entreprise` sur **17**
  lignes et `Particulier` sur 396 : c'est exactement les « 17 entreprises » de la réponse de La Fourche.
  Sur ces 17 lignes, `Prénom` et `Nom` sont **toujours vides** ; `Dénomination` porte le nom de l'entreprise
  (1 à 7 mots). Pour les particuliers, `Dénomination` = « Prénom Nom » sur les 396 lignes. `Siren` est rempli
  sur 14 lignes (dont 4 particuliers), `Numéro de TVA` sur 10 : ni l'un ni l'autre n'est un marqueur fiable,
  `Type de Client` l'est. `Destinataire` est vide partout.
- **Livraison — question (1) non tranchée** : `Adresse de Livraison` remplie sur **16** lignes, toujours avec
  une `Adresse` principale ; 2 identiques à l'adresse principale ; **11** à Vias (34450) et **5** hors de
  Vias. Quand la livraison est à Vias, l'adresse principale ne l'est pas (sauf 1 cas). La livraison
  ressemble donc au terrain dans 11 cas sur 16, pas dans les 5 autres.
- **L'adresse principale est parfois le terrain** : 81 lignes ont leur `Adresse` à Vias (dont 66 avec un
  email) — des chemins du lotissement. Pour celles-ci, l'adresse « principale » de Pennylane est très
  probablement le terrain, pas un domicile ailleurs (ou bien le propriétaire y vit) : le fichier ne permet
  pas de le savoir.
- **Terrain déductible ? — question (2) : non, pas depuis les données** : la `Référence Client` porte
  « <section> <numéro> - <compteur> » (cadastre + compteur), sans rue ; la table `parcel` n'a aucune colonne
  de lieu. Aucune table de correspondance parcelle → rue n'existe dans le dépôt ni dans le fichier. Le
  terrain doit être **stocké** s'il doit être affiché ; seule la commune est commune à tous (et une commune
  codée en dur serait un échec de revue, ADR 010).
- **19 lignes sans adresse ni email** (dont 6 entreprises) : rejetées `no_contact` par s13 aujourd'hui, et
  aucune n'a d'adresse de livraison — s55 ne change rien pour elles.
- `Pays` : FR 392, DE 2, vide 19 ; `Pays de Livraison` : FR sur les 16.
- 8 groupes « même dénomination + même adresse » sous des identifiants distincts (remarque existante de s13).

## Traps & constraints

- **Deux copies de la règle d'incomplétude** (TS `isIncomplete` et SQL du compteur) : les déplacer ensemble,
  sinon le badge et le compteur divergent. Tests concernés : `member-profile-list.test.tsx`,
  `member-profile-detail.test.tsx` (l. 238, 257), `member-profile-service.test.ts`,
  `member-profile-repository.test.ts`, `parcel-ownership-rules.test.ts`.
- **s16 / s53 écrit sur toutes les fiches du compte d'un coup** (`updateMyMemberProfilesContactDao`) :
  acceptable pour le domicile (une personne, un domicile), **pas** pour le terrain, propre à chaque fiche.
  Le terrain ne doit pas entrer dans `MyPostalContactDTO` ni dans `postalKeyOf` (sinon des groupes
  « divergents » apparaîtraient pour chaque terrain distinct, écran 2b de s53).
- **Migration sans perte** : si les colonnes existantes sont renommées (`address_line` → domicile), la
  migration générée par drizzle-kit peut proposer DROP + ADD : vérifier qu'elle renomme, ou passer par une
  migration de données `--custom` (règle « Database Migration Safety »). Sauvegarde s12c avant `db:migrate`
  en production.
- **Import déjà joué ?** Si l'import s13 a déjà tourné sur le tenant réel, réimporter donne `already_present`
  et ne renseigne pas le terrain des fiches existantes (la voie « mise à jour » est s56). À vérifier avant de
  promettre le terrain aux fiches existantes.
- **Colonnes facultatives à l'import** : un export sans colonnes de livraison / type de client ne doit pas
  être refusé (`required: false`), sinon s13 casse sur des fichiers aujourd'hui acceptés.
- **`sameNameAndAddressRemarks`** compare sur l'adresse principale : garder la même base (domicile) pour ne
  pas changer les remarques existantes ; s28 (critère « même nom et même adresse de domicile ») en dépend.
- **Libellé entreprise et nom de fiche** : pour une entreprise, le fichier n'a **que** la dénomination. Si
  le libellé reçoit la dénomination, le nom de fiche n'a pas d'autre source (doublon nom = libellé).
- **Seeds** : `seed.ts` (INSERT SQL brut l. 599-621) et `tenant-member-profiles-seed.ts` à mettre à jour avec
  le modèle ; `tenant-member-profiles-seed.test.ts` existe.
- **Rien en dur** (ADR 010) : ni « Vias » ni un code postal comme valeur par défaut du terrain.
- **Design** : story avec UI (fiche du bureau, carte « Mes coordonnées ») → `/ks-design` ; le design system
  existe (`docs/design-system.md`, §3.1 formulaires).
- **Inventaire** : architecture.md parle de « 47 tables » ; une table nouvelle oblige à mettre à jour ce
  compte, le classement RLS et `rls-inventory.test.ts` ; des colonnes nouvelles sur `member_profile`
  n'obligent qu'à mettre à jour la ligne du tableau.
- **Tests unitaires** : montage 9p lent, `pnpm test --run` ; e2e en CI seulement (`e2e/member-profiles.spec.ts`,
  `e2e/member-accounts.spec.ts` lisent l'adresse postale).

## Open questions

1. **Que fait l'import de l'`Adresse` principale et de l'`Adresse de Livraison` ?** Le fichier ne dit pas
   laquelle est le domicile. Lecture la plus simple : `Adresse` → domicile (c'est ce que s13 fait déjà, et
   la facturation Pennylane y écrit), `Adresse de Livraison` → terrain. Mais 5 livraisons sur 16 sont hors
   de Vias (alors pas un terrain), et 81 adresses principales sont à Vias (alors probablement le terrain,
   pas un domicile). Variante : livraison → terrain seulement si elle diffère de l'adresse principale.
   À arbitrer (produit), sans règle géographique codée en dur.
2. **Libellé entreprise à l'import** : `Type de Client = Entreprise` est le marqueur vérifié. Mais quel texte
   reçoit le libellé, puisque la dénomination est le seul nom disponible ? Options : libellé = dénomination
   et nom de fiche = dénomination (doublon, corrigé à la main par le bureau) ; ou ne rien remplir et laisser
   le bureau saisir le libellé sur les 17 fiches.
3. **Fiches déjà importées** : l'import s13 a-t-il déjà été joué sur le tenant de La Fourche ? Sinon, aucun
   rattrapage n'est nécessaire ; si oui, le terrain des fiches existantes attend s56 ou une saisie manuelle.
4. **Forme du stockage** (décision d'architecture, ADR au plan) : colonnes typées sur `member_profile`
   (`home_*`, `land_*`, `company_name`) vs table `member_profile_address` (type `home` | `land`, unicité par
   fiche et type, RLS forcée). La story fixe exactement deux types et aucune liste : les colonnes sont plus
   simples ; la table ouvre une 48e table à inventorier.
5. **Le terrain doit-il être affiché à côté des parcelles** (le terrain = l'ensemble des parcelles de la
   fiche) ou dans la carte « Coordonnées » ? Question de design, pour `/ks-design`.
