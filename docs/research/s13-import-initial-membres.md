# Research — Story s13-import-initial-membres

Lue sur la branche locale `main` (retard de 3 commits sur `origin/main` : s51 et docs, sans effet sur ce périmètre).

## Target story

Le SuperAdmin importe, depuis le back-office et par téléversement, la liste des propriétaires fournie par
l'association (nom, adresse postale, email, parcelle) pour ouvrir le service sans saisie manuelle. Complexité 3.
Dépend de s12, s12d, s12c (toutes livrées). Pose le **motif d'import du produit** que s17 réutilisera.

Critères (docs/stories.md l. 1466-1490) :

1. Parcours complet à l'écran (choisir l'association, déposer le fichier, lire le rapport), sans ligne de commande ni accès à la base.
2. Un fichier valide crée membres, coordonnées et rattachements de parcelle dans le tenant visé.
3. Ligne sans adresse postale ni email : rejetée et signalée (aucun canal de contact).
4. Plusieurs lignes du même propriétaire : **un seul** compte, plusieurs parcelles.
5. Ligne sans email : fiche et parcelle créées, sans compte de connexion, « courrier uniquement ».
6. Lignes invalides rejetées une à une, listées dans un rapport, sans bloquer les valides.
7. Relancer le même import ne duplique ni membre ni parcelle.

Notes de la story : la clé de regroupement des lignes **n'est pas tranchée** et est à trancher « sur le
fichier réel » ; en cas d'ambiguïté, remonter au rapport, jamais fusionner d'office. Volumétrie : 400 fiches,
300 comptes. Prérequis d'exploitation (hors story) : sauvegarde opérationnelle (s12c). `Stories ready: yes`.

## Current state of the code

**Ce qui existe déjà et que l'import réutilisera** (tout livré par s12 / s12d) :

- `src/db/models/member-profile-model.ts` : table `member_profile` — `id` uuid généré, `organization_id`, `name`
  (un seul champ), `email` nullable (unique par association, insensible à la casse, index partiel
  `member_profile_organization_email_idx`), `phone`, `address_line`, `address_complement`, `postal_code`, `city`,
  `user_id` nullable, `mail_only` **colonne générée** (`email IS NULL`). **Aucune colonne de clé d'import.**
- `src/db/models/parcel-model.ts` : `parcel` (`number` texte, unique par association) et `parcel_ownership`
  (période demi-ouverte `[starts_on, ends_on)`, `starts_on` NOT NULL). Aucune colonne « propriétaire actuel ».
- `src/services/member-profile-service.ts` : `createMemberProfileService` (l. 213) — valide, exige
  `member.profile.manage`, dans `withTenant` crée la fiche **et ouvre le compte** si l'email est présent
  (`applyMemberAccountDecision`). Rend `email_taken` si l'email existe déjà.
- `src/services/parcel-ownership-service.ts` : `attachParcelService` (l. 113) — crée la parcelle inconnue, verrouille,
  refuse le chevauchement (`overlap`), refuse une date future (`future_date`).
- `src/services/member-account-service.ts` : `openMemberAccount`, et `openMemberAccountsForOrganization`
  (l. 294) — reprise en lot **idempotente**, documentée « pour le seed et l'import de s13 ». `src/db/scripts/seed.ts`
  l. 661 l'appelle déjà (« celle que s13 rejouera à l'import »).
- Autorisation : `canPerformAction` laisse **passer le SuperAdmin** pour toute action (`action-registry-authorization.ts`) ;
  `member.profile.manage` est réservée par défaut à `owner` et `board`.
- Plafond d'envoi : l'ouverture d'un compte « n'envoie rien » (ADR 037) — l'import ne consomme pas le budget Brevo.

**Ce qui n'existe pas :**

- Aucun import de fichier dans le produit : aucune bibliothèque CSV/XLSX dans `package.json`, aucun `csv`/`.xlsx`
  dans `src/`. Le « motif d'import » est à créer.
- Aucun écran SuperAdmin d'import : `src/app/[locale]/admin/organizations/` ne contient que la liste, `new`, `[id]/edit`.
- **Le fichier réel de l'association n'est pas dans git** (documents client hors dépôt, le dépôt est public) : il est en local dans
  `docs/inputs/` (ignoré). Sa structure est décrite plus bas, section « Le fichier réel » et « Le CSV de référence ».

## Anchor points

- Écran : `src/app/[locale]/admin/organizations/[id]/…` (le SuperAdmin choisit l'association par son id ; la
  redirection `[id]/page.tsx` renvoie vers `/edit`). Garde de route : `withAuthAdmin`
  (`@/components/features/auth/with-auth`). Aucun hôte de tenant n'est résolu côté `/admin` : le tenant se passe
  **explicitement** (`withTenant(organizationId, …)`), comme le font déjà les services ci-dessus.
- Téléversement : patron existant de Server Action avec `File` — `src/app/[locale]/(bureau)/bureau/identite/actions.ts`
  (aussi `actualites/[id]/actions.ts`, `pages/[id]/actions.ts`). `next.config` fixe `serverActions.bodySizeLimit: '16mb'`
  et `src/proxy.ts` tronque les corps au-delà : un fichier de 400 lignes est très en deçà.
- Services : un nouveau service d'import qui **appelle** `createMemberProfileService` / `attachParcelService` (ADR 029 l. 72 :
  « tout futur chemin d'écriture (import s13) doit passer par le même service, jamais par un DAO direct. À vérifier en
  revue de s13 »), avec une façade dans `src/services/facades/` pour la présentation.
- E2E : isolement inter-tenants à prouver en Playwright (AGENTS.md ; la RLS n'est pas testable en unitaire).

## Verified APIs / functions

| Nom | Signature / comportement vérifié | Fichier |
| --- | --- | --- |
| `createMemberProfileService` | `(input: CreateMemberProfileInput) => Promise<MemberProfileWriteResult>` ; `throw ValidationParsedZodError` si invalide ; `AuthorizationError` sans droit ; statut `email_taken` | `src/services/member-profile-service.ts:213` |
| `attachParcelService` | `(input: AttachParcelInput) => Promise<AttachParcelResult>` ; statuts `future_date`, `member_not_found`, `overlap`, `attached` (avec `parcelCreated`) | `src/services/parcel-ownership-service.ts:113` |
| `openMemberAccountsForOrganization` | `(organizationId) => Promise<{opened: number}>` ; idempotente | `src/services/member-account-service.ts:294` |
| `createMemberProfileTxnDao` | rend `{status:'created'}` ou `{status:'email_taken'}` (point de sauvegarde, la transaction du tenant survit) | `src/db/repositories/member-profile-repository.ts:81` |
| `getMemberProfileByEmailDao` | recherche par email | idem :128 |
| `findOrCreateParcelTxnDao` | `ON CONFLICT DO NOTHING` puis lecture : deux rattachements simultanés n'en créent qu'une | `src/db/repositories/parcel-ownership-repository.ts:60` |
| `canPerformAction` | SuperAdmin → `true` | `src/services/authorization/action-registry-authorization.ts` |
| `withTenant` | `@/db/tenant-scope` ; rouvre un scope déjà ouvert en réutilisant la transaction | utilisé par les services ci-dessus |

Non vérifié et à ne pas supposer : le type exact de `CreateMemberProfileInput` / `AttachParcelInput` (champs, schémas
Zod dans `src/services/validation/member-profile-validation.ts` et `parcel-ownership-validation.ts` — l'email passe par
`z.string().email()`, le code postal par un motif, le téléphone par un motif ; à relire en détail au plan).

## Traps & constraints

- **Clé de dédoublonnage (risque majeur, de la story).** `member_profile` n'a ni clé d'import ni contrainte d'unicité sur
  nom/adresse ; seule l'**email** est unique, et il est absent chez 100 propriétaires sur 400 et partageable dans un foyer
  (AGENTS.md : jamais l'email ni la parcelle comme identité). Fusionner deux propriétaires distincts leur ouvrirait les
  documents et factures l'un de l'autre. L'idempotence (critère 7) et le regroupement (critère 4) reposent donc sur une
  clé d'import **qui n'est stockée nulle part aujourd'hui**.
- **Idempotence sans clé stockée.** Relancer l'import doit retrouver la fiche déjà créée. Pour les 300 avec email, l'email
  suffit (index unique) ; pour les 100 sans, aucun champ de la table ne permet de la retrouver de façon sûre : il faudra
  soit une colonne/table de clé d'import (migration, via `pnpm db:generate`, jamais à la main), soit une règle de
  rapprochement sur des champs existants (nom + adresse), soit une autre approche — à trancher.
- **Date de début de propriété.** `parcel_ownership.starts_on` est NOT NULL et la propriété est datée ; `attachParcelService`
  refuse une date future. Le fichier ne porte pas de date de vente : la valeur d'`startsOn` des rattachements importés
  n'est définie nulle part (voir questions).
- **Un même fichier peut créer des comptes.** `createMemberProfileService` ouvre le compte dès qu'il y a un email : 300 comptes
  `member` sont créés en un coup. Conséquence connue de s12d (`docs/research/s12d-comptes-membres.md` l. 296 et 392) :
  les pages héritées qui listent les membres de l'organisation (`/team/[slug]`, `/account/organizations/…`) deviendraient
  lisibles par ces 300 comptes — question laissée ouverte par s12d « avant s13 ». À vérifier si s45/s46 les ont retirées.
- **Autorisation par appel.** Chaque service rappelle `getAuthUser()` + `canPerformAction` : l'import doit s'exécuter avec la
  session du SuperAdmin ; pas de chemin système sans utilisateur, sauf `withRlsBypass()` qui est interdit sans arbitrage
  (« point d'arrêt de revue », AGENTS.md).
- **Atomicité et durée.** Un appel de service par ligne rouvre `withTenant` : 400 lignes × plusieurs transactions. La transaction
  est-elle unique pour tout l'import (tout ou rien) ou par ligne (critère 6 : « n'empêchent pas l'import des lignes valides ») ?
  Le critère 6 impose le par-ligne ; un `email_taken` au milieu ne doit pas condamner les lignes suivantes (le DAO utilise un
  point de sauvegarde pour cette raison).
- **Rien en dur (ADR 010).** Aucune valeur de colonne, seuil ou libellé du fichier codée en dur ; les libellés vont dans
  `messages/fr.json` (next-intl conservé, `fr` seule).
- **Cache.** Après import, les listes de fiches (`member-profile` DAL) doivent être invalidées par `updateTag` depuis la Server Action.
- **Données personnelles.** Le rapport d'erreurs liste des lignes de personnes réelles : ne pas le journaliser en clair ni le
  stocker sans durée de vie ; le dépôt est public (mémoire : aucun document ni donnée client dans git, jamais de vrai
  fichier de test commité — les fixtures de test sont fictives).
- **Tests.** Le test d'accès croisé entre deux tenants est un e2e Playwright ; l'e2e tourne **en CI**, pas en local. Les tests
  unitaires du dépôt s'exécutent par `pnpm test --run` (jamais le mode watch) et sont lents sur le montage 9p.
- **Branche** : créer `feature/s13-import-initial-membres` depuis `origin/main` (la `main` locale a un commit en trop,
  `21faa194`, et trois en retard) ; ne pas embarquer `docs/logs/` ni `docs/research/s42-lancement-invitations.md`.
- **Migration** : si une clé d'import est stockée, migration générée par `pnpm db:generate` (dernière : `0038_impersonation_event_rls.sql`),
  table métier avec `organization_id` et RLS forcée + test d'accès croisé (ADR 002).

## Le fichier réel (`docs/inputs/Base-adherents.xlsx`, hors git)

Analysé le 6 novembre 2026, **en agrégats seulement** (aucune ligne nominative lue ni consignée). Le dossier
`docs/inputs/` et `/docs/**/*.xlsx` sont dans `.gitignore`.

- **Nature** : un **export clients Pennylane**, pas une liste « nom, adresse, email, parcelle ». Feuille `Clients`
  (40 colonnes) + feuille `Valeurs disponibles` (listes de choix, à ignorer). 413 lignes de données.
- **Il n'y a aucune colonne « parcelle »**. Le candidat probable est `Référence Client` (385 renseignées, 385 valeurs
  distinctes), dont la forme est `AA 999 - 99AA999999` (une partie avant « - » qui ressemble à un numéro de parcelle,
  une partie après qui ressemble à une référence de contrat ou de facture). **Non confirmé** : seule la forme a été vue.
- **Une ligne = un client Pennylane**, `Identifiant Client` (UUID) unique sur les 413 lignes. Un propriétaire de deux
  parcelles apparaît donc probablement comme **deux clients** : le regroupement (critère 4) reste à faire sur d'autres champs.
- Particuliers 396, entreprises 17 (`Type de Client`) ; 413 lignes, soit un peu plus que les « 400 » du CDC.
- **Noms** : `Prénom` + `Nom` remplis pour 396 lignes ; `Dénomination` pour les 413 (nom de la fiche courrier ; entreprises incluses).
- **Email** (`Liste d’e-mails`) : 307 lignes renseignées, 106 vides (le CDC disait 300 / 100). 23 cellules contiennent
  **plusieurs adresses**. Sur la première adresse, 10 adresses sont partagées par 25 lignes (foyers) : or `member_profile` a un
  **index unique sur l'email** par association, donc ces lignes se heurteraient à `email_taken`.
- **Adresse postale** : 394 renseignées, 19 vides. Ces 19 lignes n'ont **ni adresse ni email** : le critère 3 en rejette
  exactement 19 sur ce fichier. 16 lignes ont en plus une adresse de livraison distincte.
- **Doublons potentiels** (candidats de regroupement) : `Dénomination` 11 groupes (27 lignes) ; `Nom`+`Prénom` 11 groupes
  (27 lignes) ; `Adresse`+`Code postal` 16 groupes (36 lignes). Aucun n'est une clé sûre : homonymes possibles.
- **Données bancaires** : les colonnes IBAN, BIC, mandats sont présentes mais **toutes vides** dans ce fichier. L'import doit
  de toute façon les ignorer (« aucune donnée bancaire ne transite par le produit », AGENTS.md).
- Colonnes sans usage pour s13 : `Rôle`, `Siren`, `Numéro de Compte`, `Pays`, `Sexe`, `Axe analytique`, `Catégorie/Tag`,
  `Langue`, `Conditions de Paiement`, `Taux de TVA`, `Nombre de factures`, `Chiffre d’affaires`.

Conséquence structurante : `Identifiant Client` est une **clé stable fournie par Pennylane**, utilisable pour
l'idempotence (critère 7) si l'on accepte de la stocker — mais elle identifie un *client Pennylane*, pas un propriétaire,
et s20 (factures Pennylane) aura besoin de ce même rapprochement (ADR 011). À instruire au plan.

## Arbitrages de l'utilisatrice (6 novembre 2026)

Les colonnes du fichier n'ont pas été confirmées par l'association : le format est à adapter, pas à imposer. Cela dit :

- C'est la **liste officielle** de l'association La Fourche (le fichier Pennylane est donc bien l'entrée de s13).
- `Référence Client` = `numero_parcelle - numero_compteur`, **normalement unique** (385 valeurs distinctes sur 385 renseignées).
- `Dénomination` = `Prénom NOM`.
- **L'identifiant Pennylane est conservé** : il servira à rapprocher le client Pennylane du membre dans le produit (s20, ADR 011).
- Les lignes **sans adresse postale ni email sont ignorées** « pour l'instant » (19 lignes sur ce fichier) ; elles apparaissent au rapport.

Conséquences vérifiées ou à vérifier :

- La clé d'idempotence (critère 7) devient l'`Identifiant Client` Pennylane **à stocker** : `member_profile` n'a aucune colonne pour
  cela aujourd'hui (migration à générer par `pnpm db:generate`, colonne sur la fiche ou table de rapprochement ; table métier →
  `organization_id` + RLS forcée si nouvelle table). Le rapprochement reste *client Pennylane → fiche*, pas *propriétaire*.
- Le numéro de **compteur** (partie après le « - ») n'a aucune colonne d'accueil dans le modèle actuel (`parcel` ne porte que `number`) ;
  s17/s18 (relevés d'eau) en auront besoin. À trancher : le stocker en s13 ou le laisser à s17.
- Dans `Référence Client`, la partie parcelle a plusieurs formes : `AA 999`, `AA 99`, mais aussi `AA 999-999`, `AA 99-99`, `AA 9-99`
  (au moins 25 lignes, avec un tiret *dans* la parcelle ; 14 autres lignes ont des formes que je n'ai pas relevées, seules les 5 formes
  les plus fréquentes — 371 lignes sur 385 — ayant été comptées). Sans voir les valeurs, impossible de dire si c'est un numéro composé ou **deux
  parcelles** sur un seul client. Un séparateur « - » ambigu : le découpage doit se faire sur le **dernier** « espace-tiret-espace »
  (` - `), pas sur le premier tiret.
- 28 lignes n'ont pas de `Référence Client` : pas de parcelle. Fiche sans parcelle ? Rejet ? (voir questions)

### Réponses de l'utilisatrice, même jour (à confirmer auprès de La Fourche)

- Lignes sans `Référence Client` : peut-être d'anciens membres qui ont vendu ; **à vérifier** auprès de l'association.
- `AE 215-352 - 21VA002357` : très probablement **deux terrains jumelés qui partagent un compteur**, à traiter comme **un seul
  terrain** ; **à confirmer**. (Si confirmé, le numéro de parcelle composé `AE 215-352` est stocké tel quel, un seul `parcel`.)
- Plusieurs emails dans une cellule : prendre la **première** ; les autres sont d'autres membres de la famille. Besoin exprimé :
  **plusieurs adresses par membre, une principale** (vote, factures…) **et des secondaires** (autres communications). Cela sort de
  s13 : `member_profile` n'a qu'un `email` unique ; c'est un changement de modèle (s12/s12d) à instruire comme story à part.
  **À confirmer** avec l'association.
- Format d'entrée : **CSV**, converti par l'utilisatrice.
- **Arbitrages définitifs pour s13** (même jour) : (a) le numéro de compteur est **importé et stocké en s13**, même si seule
  s17 l'utilise ; (b) `Référence Client` est importée **telle que notée**, sans découpage, tant que l'association n'a pas
  confirmé (le découpage parcelle / compteur viendra ensuite) — ce qui rend le stockage du compteur (a) dépendant de ce
  découpage : à concilier au plan ; (c) **première adresse seulement** ; les suivantes au rapport ; (d) « membre » = la personne
  représentant un foyer propriétaire ; « par parcelle » dans sa demande se lisait « par membre ».
- Récap des points à valider avec l'association : `docs/Admin-MEL/questions-import-membres-la-fourche.md` (hors git).

### Le CSV de référence : `docs/inputs/Base-adherents-utf8.csv` (hors git) — contrôlé le 6 novembre 2026

**Version UTF-8 fournie par l'utilisatrice, à utiliser.** UTF-8 valide, sans BOM, CRLF, **séparateur point-virgule**, tous les champs entre
guillemets, 40 champs sur les 414 lignes ; en-têtes identiques à l'export précédent, **contenu identique cellule par cellule** (0 différence),
accents lisibles. Les 23 cellules à plusieurs emails ont toujours une **virgule** comme séparateur *à l'intérieur* du champ.

Constat de portée : les deux exports du même fichier diffèrent par le dialecte (virgule + Windows-1252, puis point-virgule + UTF-8). Le
lecteur ne doit donc pas coder un format en dur : **détecter le séparateur et l'encodage** (ou, au minimum, refuser clairement un fichier
mal lu). Ce qui suit décrit la première version (virgule, Windows-1252), valable pour le contenu des données.

- **Contenu identique au `.xlsx`** : mêmes 40 colonnes, mêmes 413 lignes, dans le même ordre (identifiants Pennylane concordants), aucun
  identifiant abîmé en notation scientifique.
- **Encodage Windows-1252, pas UTF-8** (l'apostrophe `’` y est l'octet `0x92`, `ô` l'octet `0xF4`) ; pas de BOM. Lu en UTF-8, le fichier
  est illisible. Le lecteur doit détecter l'encodage (ou le refuser avec un message clair plutôt que d'écrire des caractères corrompus
  dans les noms). Enregistrer en UTF-8 à l'export règlerait le cas du fichier, pas celui du produit.
- **Séparateur virgule**, fins de ligne CRLF, 40 champs sur chaque ligne. Les 23 cellules à plusieurs emails contiennent une **virgule**
  dans un champ entre guillemets : le lecteur doit gérer les guillemets (un simple `split(',')` casse ces lignes).
- Les en-têtes contiennent des espaces insécables (`Prélèvement : …`) et l'apostrophe `’` : correspondance par titre à normaliser.
- **Piège avec la validation existante** : `MEMBER_PROFILE_POSTAL_CODE_PATTERN = /^\d{5}$/`
  (`src/services/types/domain/member-profile-types.ts:25`). Dans le CSV, **12 codes postaux n'ont que 4 chiffres** (zéro initial perdu
  par le tableur, p. ex. département à 2 chiffres commençant par 0) : la validation de `createMemberProfileService` les rejetterait
  → 12 lignes rejetées à tort (critère 6). **Décidé (6 novembre) : remettre le zéro initial.** Vérifié sur le fichier : les 12 sont
  des adresses `FR` dont le premier chiffre est 1, 2, 3, 5, 6, 7 ou 9 (soit les départements 01, 02, 03, 05, 06, 07, 09 : cohérent avec un
  zéro perdu). Règle à porter dans l'import : 4 chiffres seulement **et** pays `FR` → préfixer `0` ; tout autre cas reste tel quel et
  suit la validation habituelle. Deux autres codes ne rentrent pas dans le motif et seront rejetés au rapport : un code de forme
  `A99999` et une valeur qui est un nom de ville saisi dans la colonne Code Postal (erreurs de saisie de la source).
  Téléphones : 136 commencent par 0, 75 par `+`, 2 ont 9 chiffres sans zéro initial ; le motif existant `/^[0-9 +.\-()]+$/` les accepte.
- `Référence Client` : 381 des 385 valeurs contiennent ` - ` ; 4 non ; 1 a des espaces en bordure (à `trim`).

### Regroupement et email partagé — analyse du 6 novembre 2026 (décisions **non prises**)

**Constat sur le fichier** : l'identifiant Pennylane n'est jamais partagé (413 distincts) ; dans tous les groupes proches (même nom,
même adresse + CP, même email) les `Référence Client` sont toutes différentes. Pennylane crée donc **un client par parcelle ou par compte de
facturation**, pas un client par personne. Sur 11 groupes de même nom, 7 ont aussi la même adresse (probables propriétaires de plusieurs
parcelles) ; les 4 autres n'ont pas la même adresse (homonymes possibles). Sur 10 groupes de même email, 5 ont la même adresse.

**Règle proposée par l'utilisatrice** : « référence différente = membres séparés ». Elle tient sans exception sur ce fichier et revient à
*un membre = une ligne = un identifiant Pennylane* (clé d'import et d'idempotence naturelle, aucun regroupement à deviner). Conséquences :

1. **Critère 4 à amender** : « plusieurs lignes du même propriétaire → un seul compte avec plusieurs parcelles » ne s'exerce pas sur ce
   fichier. Reformulation à valider : « plusieurs lignes portant le **même identifiant Pennylane** donnent un seul membre ».
2. **Un propriétaire de plusieurs parcelles aurait plusieurs fiches** à l'import, alors que le modèle permet plusieurs parcelles par fiche
   (`parcel_ownership`). *À ma lecture du code, non essayé* : `attachParcelService` refuse (chevauchement) de rattacher à la fiche A une
   parcelle déjà possédée par la fiche B, et `recordSaleService` ne permettrait la reprise qu'en simulant une vente. Il n'existe pas
   d'outil de fusion de deux fiches. Trois options, **aucune retenue** : **A** une fiche par ligne ; **B** fusion si nom *et* adresse sont
   identiques (7 groupes ; risque : homonymes fusionnés, donc accès croisés aux documents) ; **C** comme A, avec un rapport listant les
   groupes probables. Recommandation de l'assistant : A ou C, pas B (un doublon se corrige, une fusion à tort expose des données).
3. **Email partagé** (10 adresses / 25 lignes) : `member_profile_organization_email_idx` (unique par association, insensible à la casse,
   migration `0029`) rejetterait la seconde fiche (`email_taken`, utilisé dans `member-profile-service.ts`, `actions.ts` des propriétaires,
   `member-profile-form.tsx`, `member-profile-detail.tsx`). Rendre l'email non unique est possible : migration supprimant l'index (ADR
   à écrire, supersède la contrainte de s12) et adaptation de `email_taken` en avertissement. **Verrou à ne pas lever** : `user.email` est
   unique sur la plateforme et l'index `(organization_id, user_id)` limite à **une fiche par compte et par association** (ADR 037) ;
   deux fiches de même email ne peuvent donc pas avoir chacune un compte. Règle envisagée : la première fiche reçoit le compte, la
   suivante garde son email sans compte, et le rapport les liste. Effet à vérifier : `mail_only` (`email IS NULL`) resterait faux pour ces
   fiches, ce qui est cohérent (joignables par email).

**Hypothèses de l'assistant, non vérifiées** (à ne pas tenir pour acquises) : que les 7 groupes « même nom + même adresse » soient bien
des propriétaires de plusieurs parcelles ; que `recordSaleService`/`attachParcelService` se comportent comme décrit ci-dessus (lu, pas
exécuté) ; que la partie avant ` - ` de `Référence Client` soit le numéro de parcelle (forme seule vue) ; que les parcelles jumelées
(`AE 215-352`) soient un seul terrain (hypothèse de l'utilisatrice, à confirmer) ; que les lignes sans référence soient d'anciens
membres (hypothèse de l'utilisatrice).

## Open questions

**Tranchées depuis la première rédaction** (voir les sections ci-dessus) : format d'entrée = CSV UTF-8 fourni par l'utilisatrice, plus de
dépendance Excel ; clé d'idempotence = identifiant Pennylane, stocké ; première adresse email seule ; compteur importé et stocké en s13 ;
`Référence Client` importée telle que notée ; codes postaux à 4 chiffres (`FR`) complétés d'un zéro ; lignes sans adresse ni email ignorées
et listées au rapport.

**Encore ouvertes, à résoudre au plan (ou à confirmer par La Fourche, voir `docs/Admin-MEL/questions-import-membres-la-fourche.md`) :**

1. **Lignes sans `Référence Client`** (28) : fiche sans parcelle, ou rejet ? (anciens membres ayant vendu ? — La Fourche)
2. **Parcelles jumelées** (`AE 215-352 - …`, au moins 25 lignes) : un seul terrain ? Tant que ce n'est pas confirmé, la référence reste entière.
   Conséquence à concilier au plan : le compteur est « stocké » alors que la référence n'est pas découpée — où et sous quelle forme ?
3. **Regroupement (critère 4)** : une ligne = un client Pennylane. Quand un même propriétaire a plusieurs clients (11 groupes de
   `Dénomination` identique, 16 d'`Adresse`+`CP`), faut-il les regrouper en une fiche à plusieurs parcelles, ou importer une fiche par
   client et signaler les doublons probables au rapport ? Fusionner d'office est interdit (story).
4. **Email déjà pris** (10 adresses partagées par 25 lignes) : l'index unique de `member_profile` rejette la seconde fiche. Rapport,
   fiche courrier seule (sans email), ou rattachement à la même fiche ? Dépend aussi du point 3.
5. **`starts_on` des parcelles importées** : date d'import, date fixe de l'association, autre ? Doit être ≤ aujourd'hui.
6. **Lecteur CSV** : écrit à la main ou bibliothèque ? Il doit gérer guillemets, séparateur et encodage détectés, BOM éventuel. Un ajout
   de dépendance est un choix structurant (ADR).
7. **Pages héritées listant les membres** (piège s12d) : encore présentes ? À vérifier avant d'ouvrir ~300 comptes.
8. **Rapport** : affichage seul, ou téléchargeable (CSV des rejets) ? Conservé ou jetable (données personnelles) ?
9. **Volumétrie / durée** : 413 lignes en une Server Action suffit-il, ou faut-il un traitement par lots ? Non mesuré.
10. **Plusieurs adresses par membre** (principale + secondaires) : hors s13, à instruire comme story séparée après l'avis de La Fourche.
11. **Écran** : brief de design écrit (`docs/designs/s13-import-initial-membres-brief.md`), canevas `/design` à ouvrir par l'utilisatrice.
