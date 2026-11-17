---
validated: yes
---

# Plan — Story s55-adresses-typees-entreprise

Branch: `feature/s55-adresses-typees-entreprise`

## Target story

Distinguer l'adresse du **terrain** et celle du **domicile** d'une fiche, et nommer l'**entreprise** qui y est
domiciliée, pour que le courrier arrive chez le bon destinataire. Complexité 2. Contexte :
`docs/research/s55-adresses-typees-entreprise.md` ; écran : `docs/designs/s55-adresses-typees-entreprise.md` ;
décision : [ADR 058](../decisions/058-adresses-domicile-et-terrain-colonnes-typees.md).

Critères d'acceptation :

1. Deux adresses de types distincts, facultatives : « terrain » et « domicile ».
2. Le domicile est l'adresse postale de la fiche (fiche du bureau, coordonnées de s16) ; s28 l'utilisera.
3. Sans email et sans domicile → fiche incomplète dans la liste (un terrain seul ne suffit pas).
4. Libellé facultatif « nom de l'entreprise », affiché dans la fiche ; ne change rien d'autre.
5. Le bureau saisit les deux adresses et le libellé depuis la fiche ; le membre corrige son domicile (s16).
6. L'import de s13 renseigne les deux types depuis les colonnes du fichier (s56 portera le même critère).

**Arbitrages du 17/11/2026** (questions ouvertes de la recherche) :

- **Import, adresses** : `Adresse` → domicile, **sauf** si `Adresse de Livraison` est renseignée : la
  livraison devient alors le domicile et l'`Adresse` le terrain. Une fiche créée sans adresse de terrain
  reçoit le **code postal et la commune du terrain par défaut** de l'association, sans rue. Ce défaut est un
  **paramètre d'association** (ADR 010, ADR 058), pas une constante : « 34450 / Vias » est saisi pour La
  Fourche dans « Réglages » avant l'import.
- **Import, entreprises** : `Type de Client = Entreprise` → libellé « nom de l'entreprise » = `Dénomination`
  (le nom de la fiche reçoit aussi la dénomination ; le bureau le corrige s'il connaît le gérant).
- **Import pas encore joué** sur l'association réelle : aucun rattrapage de fiches existantes.
- **Forme du stockage** : colonnes typées sur `member_profile`, domicile par renommage (ADR 058).

## Tasks (ordered)

1. [x] **Modèle et migration (sans perte)** — `member-profile-model.ts` : renommer les quatre colonnes en
   `home_address_line`, `home_address_complement`, `home_postal_code`, `home_city` ; ajouter
   `land_address_line`, `land_address_complement`, `land_postal_code`, `land_city`, `company_name`
   (texte, nullables) ; réécrire le commentaire de tête (adresses postales ≠ adresses email). `pnpm
   db:generate` ; **relire le SQL** : il doit contenir `RENAME COLUMN` (jamais DROP + ADD) — sinon répondre
   « rename » aux invites de drizzle-kit ou réparer le snapshot, jamais éditer le SQL à la main. Test :
   `src/db/member-profile-model.test.ts` vérifie les neuf colonnes et l'absence d'`address_line`.
2. [x] **Types, règles, validation (domaine)** — `member-profile-types.ts` : `MemberProfileContact` porte
   `homeAddressLine…homeCity`, `landAddressLine…landCity`, `companyName` ; constante
   `MEMBER_PROFILE_COMPANY_NAME_MAX_LENGTH` (200) ; mêmes champs dans `MemberProfileContactInput`.
   `isIncomplete` (`parcel-ownership-rules.ts`) et `toMemberProfileDto` passent sur le domicile.
   `member-profile-validation.ts` : un `postalAddressShape(prefix)` réutilisé pour domicile et terrain
   (code postal à cinq chiffres dans les deux) + `companyName`. Tests d'abord :
   `parcel-ownership-rules.test.ts` (terrain seul → toujours incomplète ; domicile → complète),
   `member-profile-validation.test.ts` (code postal du terrain refusé ; libellé trop long refusé).
3. [x] **Repository** — `member-profile-repository.ts` : type de ligne, lectures et écritures des nouveaux
   champs ; **le SQL du compteur `incomplete`** (l. 370) sur `home_*` ; `MemberPostalContactWrite` et
   `updateMyMemberProfilesContactDao` n'écrivent **que** téléphone + domicile (jamais le terrain ni le
   libellé). Tests : `member-profile-repository.test.ts` (forme des écritures, l'écriture du membre ne
   contient aucune colonne `land_*` ni `company_name`).
4. [x] **Services du bureau et du membre** — `member-profile-service.ts` (création, mise à jour des
   coordonnées : les neuf champs), `member-space-service.ts` (`MyPostalContactDTO` = téléphone + domicile ;
   `postalKeyOf` / groupes divergents de s53 sur le domicile seul), `member-space-types.ts`. Tests :
   `member-profile-service.test.ts` (le bureau écrit terrain et libellé), `member-space-service.test.ts`
   (un terrain différent ne crée pas de groupe divergent ; le membre ne peut pas écrire le terrain : champ
   retiré par Zod).
5. [x] **Paramètres du terrain par défaut** — deux entrées texte dans `ASSOCIATION_SETTINGS_REGISTRY`
   (`member.default_land_postal_code`, `member.default_land_city`), facultatives, **sans défaut**, page
   `settings`, modifiables par le bureau ; libellés et aides dans `messages/fr.json`
   (`AssociationSettings.fields…`) ; code postal contrôlé à cinq chiffres (message propre). Seeds de test
   (`tenant-settings-seed.ts`) : valeurs fictives pour un tenant. Tests :
   `association-settings-rules.test.ts` (valeur vide acceptée ; code postal invalide refusé).
6. [x] **Mappage d'import** — `pennylane-clients-mapper.ts` : colonnes **facultatives** `Adresse de
   Livraison`, `Code Postal de Livraison`, `Ville de Livraison`, `Pays de Livraison`, `Type de Client` ;
   règle de l'arbitrage (livraison renseignée → domicile = livraison, terrain = `Adresse` ; sinon domicile =
   `Adresse`) ; `padPostalCode` appliqué aux deux ; `Type de Client = Entreprise` → `companyName` =
   dénomination ; `rejectionOf` (`NO_CONTACT`) et `sameNameAndAddressRemarks` lisent le **domicile** ;
   `ImportMemberCandidate` étendu. Fonction pure, aucun paramètre lu ici. Tests d'abord
   (`pennylane-clients-mapper.test.ts`) : ligne sans livraison, ligne avec livraison (inversion), livraison
   identique à l'adresse, entreprise, particulier avec SIREN (pas d'entreprise), export sans les colonnes
   facultatives (toujours accepté).
7. [x] **Service d'import** — `member-import-service.ts` : `createProfile` passe domicile, terrain et
   libellé ; une fiche **créée** sans aucune partie de terrain reçoit le code postal et la commune des
   paramètres de l'association (lus une fois par import via `getAssociationSettingsService`), rien quand
   ils sont vides ; une fiche `already_present` n'est pas touchée. `FIELD_REJECTIONS` mappe aussi le code
   postal du terrain. Tests (`member-import-service.test.ts`) : défaut appliqué, défaut absent, terrain du
   fichier prioritaire, fiche déjà présente inchangée.
8. [x] **Écran du bureau** — `member-contact-fields.tsx` (deux `fieldset` + `legend` « Adresse de
   domicile » / « Adresse du terrain », champ « Nom de l'entreprise » ; partagé avec `/nouveau`),
   `member-profile-form-validation.ts`, `member-profile-detail.tsx` (`ContactView` : quatre paires dans
   l'ordre du design, mention « Adresse postale : le courrier de l'association part ici. », bannière
   « ni adresse email ni adresse de domicile », bouton « Ajouter l'adresse de domicile » qui vise
   `homeAddressLine`), `member-profile-format.ts` (sur le domicile), action
   `bureau/proprietaires/actions.ts` (lecture des neuf champs du `FormData`). Libellés dans
   `messages/fr.json` (`BureauMemberProfilesPage`). Tests : `member-profile-form.test.tsx`,
   `member-profile-detail.test.tsx`, `actions.test.ts`, pages `[id]` (message d'erreur qui nomme le
   groupe ; libellé affiché ; terrain absent « Non renseignée »).
9. [x] **Espace membre, seeds et documentation** — `my-contact-card.tsx` et ses libellés (« Adresse de
   domicile », description de la carte) ; `seed.ts` (INSERT sur les colonnes `home_*`, un terrain et un
   libellé fictifs) et `tenant-member-profiles-seed.ts` (+ son test) ; e2e `member-profiles.spec.ts` (le
   bureau saisit domicile, terrain et libellé, les relit) et `member-accounts.spec.ts` (sélecteurs
   renommés) ; `docs/architecture.md` (ligne `member_profile` du tableau : domicile, terrain, libellé —
   « s38 devra les déclarer ») ; `docs/stories.md` : note sous s56 et s28 renvoyant à l'ADR 058 (règle
   d'import et paramètres). Tests : `my-contact-card.test.tsx`, `member-space.test.tsx`,
   `tenant-member-profiles-seed.test.ts`.

## Files touched

- `src/db/models/member-profile-model.ts`, `drizzle/migrations/*` (générés), `src/db/member-profile-model.test.ts`
- `src/db/repositories/member-profile-repository.ts` (+ test)
- `src/services/types/domain/member-profile-types.ts`, `member-space-types.ts`, `member-import-types.ts`,
  `association-settings-types.ts`
- `src/services/rules/parcel-ownership-rules.ts`, `member-profile-rules.ts` (+ tests)
- `src/services/validation/member-profile-validation.ts` (+ test)
- `src/services/member-profile-service.ts`, `member-space-service.ts`, `member-import-service.ts` (+ tests)
- `src/lib/import/pennylane-clients-mapper.ts` (+ test)
- `src/components/features/member-profile/*` (contact-fields, form, form-validation, detail, format + tests)
- `src/components/features/member-space/my-contact-card.tsx` (+ tests)
- `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts` et pages `[id]` (+ tests)
- `src/app/[locale]/(app)/dashboard/actions.ts` (+ test) si l'action du membre lit les champs par nom
- `messages/fr.json`
- `src/db/scripts/seed.ts`, `tenant-member-profiles-seed.ts`, `tenant-settings-seed.ts` (+ tests)
- `e2e/member-profiles.spec.ts`, `e2e/member-accounts.spec.ts`
- `docs/architecture.md`, `docs/stories.md`, `docs/decisions/058-…`

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)**, en TDD, tâche par tâche : règle d'incomplétude (terrain seul),
  validation (deux codes postaux, libellé), mappage pur de l'import (inversion livraison, entreprise,
  colonnes facultatives absentes), service d'import (défaut paramétré, fiche déjà présente), service du
  membre (le terrain n'entre ni dans l'écriture ni dans les groupes divergents), composants (paires, ordre,
  bannière, message d'erreur nommant le groupe).
- **Aucune table nouvelle** : pas de test d'isolation nouveau ; l'isolation de `member_profile` est déjà
  couverte par l'e2e existant (la RLS n'est pas testable en unitaire).
- **e2e (CI uniquement)** : saisie et relecture des deux adresses et du libellé par le bureau ; parcours
  existants du membre et des comptes, sélecteurs mis à jour.
- Montage 9p lent : un timeout de worker n'est jamais compté vert ; valider sur une copie en disque local
  au besoin.

## Definition of Done

- Une PR, une migration de **renommage** relue (aucune perte de l'adresse postale de s12), tests verts.
- Les six critères démontrés ; arbitrages du 17/11 appliqués ; aucune valeur propre à La Fourche dans le
  code (la valeur « 34450 / Vias » vit dans les réglages).
- Revue `/ks-review` passée (aucun critique).
- Rappel au déploiement : sauvegarde s12c avant `db:migrate` ; saisir dans « Réglages » de La Fourche le
  code postal et la commune du terrain par défaut **avant** le premier import.
