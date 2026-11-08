---
validated: yes
---

# Plan — Story s13-import-initial-membres

Branch: `feature/s13-import-initial-membres` (à créer depuis `origin/main`, pas depuis la `main` locale : elle a un commit en trop et trois en retard). Ne pas embarquer `docs/logs/` ni `docs/research/s42-lancement-invitations.md`.

Entrées : `docs/research/s13-import-initial-membres.md`, `docs/designs/s13-import-initial-membres.md` (+ `.html`), ADR 047 et 048 (écrits au plan, voyagent avec la branche).

## Target story

En tant que **SuperAdmin**, importer depuis le back-office, par téléversement, la liste des propriétaires fournie par l'association, pour ouvrir le service sans saisie manuelle. Complexité 3 ; dépend de s12, s12d, s12c (livrées).

Critères (docs/stories.md) :

1. Parcours complet à l'écran (choisir l'association, déposer le fichier, lire le rapport), sans ligne de commande ni accès à la base.
2. Un fichier valide crée membres, coordonnées et rattachements de parcelle dans le tenant visé.
3. Ligne sans adresse postale ni email : rejetée et signalée.
4. Plusieurs lignes du même propriétaire : **un seul** membre, plusieurs parcelles.
5. Ligne sans email : fiche et parcelle créées, sans compte, « courrier uniquement ».
6. Lignes invalides rejetées une à une, listées au rapport, sans bloquer les valides.
7. Relancer le même import ne duplique ni membre ni parcelle.

### Décisions du plan (arbitrages du 8 novembre 2026)

- **Format** : CSV de l'export clients Pennylane de La Fourche. Colonnes retenues par titre normalisé : `Identifiant Client`, `Dénomination`, `Référence Client`, `Liste d’e-mails`, adresse, complément, code postal, ville, pays, téléphone. Les titres exacts de adresse, téléphone et pays se relèvent sur le fichier local `docs/inputs/Base-adherents-utf8.csv` (hors git) à l'exécution ; la table de correspondance vit dans le module de mappage, pas dans le service. Les colonnes bancaires sont ignorées.
- **Identité d'un membre** : `Identifiant Client` Pennylane, stocké sur la fiche (ADR 048). **Critère 4 amendé** : plusieurs lignes portant le même identifiant donnent **un seul** membre. Deux identifiants différents donnent deux fiches, même nom et même adresse ; c'est la règle de l'utilisatrice (« référence différente = membres séparés »). Aucune fusion d'office. Les couples nom + adresse identiques sont signalés au rapport comme **remarque** (« même nom et même adresse que la ligne N »).
- **Parcelle et compteur** : `Référence Client` découpée sur le **dernier** ` - ` ; avant = parcelle (`AE 215-352` reste entier), après = compteur stocké sur `parcel.meter_number`. Sans ` - ` : parcelle = valeur entière, compteur vide, remarque.
- **Sans `Référence Client`** : ligne rejetée au rapport (réversible en relançant après réponse de La Fourche).
- **Sans adresse postale ni email** : rejetée (critère 3).
- **Email** : la première adresse seule ; les suivantes en remarque. Un email déjà porté par une autre fiche → ligne **rejetée** (« email déjà utilisé par un autre membre », motif déjà maquetté) : l'index unique de s12 est conservé, aucun ADR de rupture.
- **Code postal** : 4 chiffres et pays `FR` → préfixe `0`, remarque ; tout autre cas suit la validation habituelle.
- **Début de propriété** : date sentinelle fixe `1900-01-01`, constante du domaine (`OWNERSHIP_BEFORE_IMPORT_DATE`), pour qu'une vente récente saisie après l'import ne soit jamais refusée. Affichée « avant l'import » à la place d'une date (tâche 7).
- **Rapport** : éphémère, rendu avec le résultat de l'action, ni stocké ni téléchargeable (ADR 047). Le journal ne reçoit que des comptages.
- **Autorisation** : SuperAdmin seul (le bureau d'une association ne voit pas l'écran) ; chaque appel de service rappelle ses propres gardes. Aucun `withRlsBypass()`.

## Tasks (ordered)

1. [x] **Modèle et migration.** `member_profile.pennylane_customer_id` (texte nullable) avec index unique partiel `(organization_id, pennylane_customer_id)`, et `parcel.meter_number` (texte nullable) dans `src/db/models/`. Migration par `pnpm db:generate` (jamais à la main ; dernière : `0038`). DAO : `getMemberProfileByPennylaneIdDao`, écriture des deux colonnes à la création / à la création de parcelle. Étendre `createMemberProfileServiceSchema` et `attachParcelServiceSchema` d'un champ optionnel (`pennylaneCustomerId`, `meterNumber`), vide = `null`. Test : schémas Zod (champ absent, vide, rempli) ; `pnpm db:generate` ne produit plus de diff ; `pnpm tsc`.
2. [x] **Lecteur CSV** (`src/lib/import/csv-reader.ts`, ADR 047). Décodage UTF-8 strict avec repli Windows-1252, BOM ignoré, séparateur détecté sur l'en-tête, guillemets et guillemets doublés, CRLF/LF, en-têtes normalisés (insécables, apostrophes, casse), fichier vide ou sans en-têtes refusé avec une cause. Fonctions pures. Tests sur fichiers **fictifs** : virgule + Windows-1252, point-virgule + UTF-8, cellule à virgules entre guillemets, ligne de longueur fausse, fichier binaire.
3. [x] **Mappage Pennylane → ligne d'import** (`src/lib/import/pennylane-clients-mapper.ts`, pure) et types du rapport dans `src/services/types/domain/member-import-types.ts` (`ImportReportDTO`, motifs et remarques en codes, jamais en phrases). Règles : nom (`Dénomination`), première adresse email (remarque si plusieurs), découpage de la référence, zéro initial du code postal, colonnes obligatoires absentes → fichier refusé, rejets (nom manquant, ni adresse ni email, pas d'identifiant, pas de référence). Regroupement par identifiant Pennylane (même identifiant → un membre, plusieurs parcelles). Détection des couples nom + adresse identiques (remarque). Tests de chaque règle, dont les cas de critère 3, 4 et 5.
4. [x] **Service d'import** (`src/services/member-import-service.ts` + façade `src/services/facades/member-import-service-facade.ts`). SuperAdmin seul. Pour chaque membre regroupé, dans un `withTenant(organizationId)` : fiche existante par identifiant Pennylane, sinon `createMemberProfileService` (ouvre le compte si email) ; puis `attachParcelService` avec la date sentinelle pour chaque parcelle ; tout statut autre que `attached` ou « déjà à ce membre » annule la ligne entière (retour sentinelle) et la rejette avec son motif (`email_taken`, `overlap` avec un autre membre, validation Zod). Association inconnue → statut dédié. Plafond de lignes (constante technique) refusé avant tout traitement. Aucune donnée de ligne dans le journal. Tests unitaires (services mockés) : critères 2 à 7, dont « relancer deux fois = zéro création », « une ligne rejetée n'arrête pas les suivantes », « rejet = rien d'écrit pour cette ligne », « un non-SuperAdmin est refusé ».
5. [x] **Server Action** `src/app/[locale]/admin/membres-import/actions.ts` : `requireActionAuth()` SuperAdmin, lit `File` (extension `.csv`, taille ≤ 16 Mo, patron de `bureau/identite/actions.ts`), appelle la façade, `updateTag` des listes de fiches de l'association, renvoie `FormState` + rapport. Messages de `messages/fr.json` (`getTranslations`). Même signature `(prevState?, formData?)`. Tests dans le style de `organizations/actions.test.ts` (vraie garde, session doublée) : refus hors SuperAdmin, fichier absent, trop gros, mauvais type, fichier illisible → « Rien n'a été importé. », succès.
6. [x] **Écrans 1 et 2** (design `docs/designs/s13-import-initial-membres.md`) : `src/app/[locale]/admin/membres-import/page.tsx` (`withAuthAdmin`, association passée en paramètre depuis la fiche), formulaire client (`select`, `label`, `file-upload`, `progress` indéterminée, bouton « Importer les membres » désactivé tant qu'il manque l'association ou le fichier, états 1a–1f), rapport (six cartes de bilan, « Déjà présents », tables **Lignes rejetées** et **Remarques** à 25 par page, cartes empilées à 10 par page sous 640 px, mention de confidentialité, états 2a–2d). Aucun composant hors design system ; libellés dans `messages/fr.json`. Tests de composants : états du formulaire, bouton désactivé, rendu du rapport (avec/sans rejets, tout rejeté, relance).
7. [x] **Date sentinelle lisible.** Constante `OWNERSHIP_BEFORE_IMPORT_DATE` dans `src/services/types/domain/` ; `member-profile-detail.tsx` et `member-space.tsx` affichent « avant l'import » (libellé dans `messages/fr.json`) quand `startsOn` vaut la sentinelle, la date sinon. Test : le composant affiche le libellé pour la sentinelle et la date pour toute autre valeur.
8. [x] **Points d'entrée.** Carte « Membres » sur la fiche de l'association (`admin/organizations/[id]/edit/page.tsx`) avec le bouton « Importer des membres » (icône `Upload`) qui ouvre l'écran 1 avec l'association choisie ; entrée « Importer des membres » dans `admin-sidebar.tsx` (libellé en dur comme ses voisines). Test : la carte rend le lien avec l'identifiant, l'entrée de menu pointe `/admin/membres-import` (patron de `admin-sidebar.test.tsx`).
9. [x] **E2E Playwright** `e2e/member-import.spec.ts` (fichier fictif versionné `e2e/fixtures/`, jamais de donnée réelle) : le SuperAdmin importe sur l'association A depuis la fiche et lit le rapport (critère 1) ; création de membres, comptes et parcelles (2, 4, 5), rejets listés (3, 6) ; relance du même fichier : zéro création (7) ; **accès croisé** : le bureau de l'association B ne voit aucun membre importé dans A, et le même fichier importé dans B crée ses propres fiches. Exécuté **en CI**, pas en local (mémoire du projet).

## Files touched

- Modèles et migration : `src/db/models/member-profile-model.ts`, `src/db/models/parcel-model.ts`, `drizzle/migrations/0039_*.sql` (+ `meta/`, générés), `src/db/repositories/member-profile-repository.ts`, `src/db/repositories/parcel-ownership-repository.ts`.
- Lib : `src/lib/import/csv-reader.ts`, `src/lib/import/pennylane-clients-mapper.ts` (+ tests).
- Services : `src/services/member-import-service.ts`, `src/services/facades/member-import-service-facade.ts`, `src/services/types/domain/member-import-types.ts`, `src/services/validation/member-profile-validation.ts`, `src/services/validation/parcel-ownership-validation.ts` (+ tests).
- Présentation : `src/app/[locale]/admin/membres-import/{page.tsx,actions.ts,loading.tsx,error.tsx}`, `src/components/features/admin/member-import/*`, `src/app/[locale]/admin/organizations/[id]/edit/page.tsx`, `src/components/features/layouts/sidebar/admin-sidebar.tsx`, `src/components/features/member-profile/member-profile-detail.tsx`, `src/components/features/member-space/member-space.tsx`, `messages/fr.json`.
- Tests : `e2e/member-import.spec.ts`, `e2e/fixtures/`.
- Docs : `docs/decisions/048-*.md`, `docs/decisions/047-*.md`, `docs/research/s13-*.md`, `docs/designs/s13-*`, ce plan, `docs/reviews/s13-*.md` (au ship).

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`, jamais le mode watch)** : lecteur CSV, mappage, règles de rejet et de remarque, service d'import (services mockés), action (vraie garde, session doublée), composants du formulaire et du rapport. Fixtures fictives uniquement.
- **E2E Playwright, en CI** : parcours complet à l'écran et isolement entre deux tenants. C'est le seul niveau qui prouve la RLS ; elle ne se teste pas en unitaire (`db.ts` refuse la connexion en test).
- **À vérifier en review, pas en test** : qu'aucune étape ne demande d'écrire du code ; qu'aucun DAO n'est appelé directement par le service d'import (ADR 029) ; qu'aucune donnée de ligne n'est journalisée ; qu'aucun `withRlsBypass()` n'apparaît ; **durée** d'un import de ~413 lignes (une action, un appel de service par ligne : mesurer en CI ; si elle approche le délai du proxy, scinder en lots est une story, pas un correctif de cette branche).
- **Rapport de design à tenir** : l'état 2e (chargement du rapport) n'a pas de cause dans cette architecture, le rapport arrivant avec le résultat de l'action : le `progress` du 1c en tient lieu ; 2f est porté par `error.tsx`. À confirmer en revue du design.

## Risks & design gaps

- **Début de propriété à 1900** : seul remède connu aux ventes refusées après import ; la sentinelle ne doit jamais s'afficher en date (tâche 7).
- **Plusieurs fiches pour un propriétaire de plusieurs parcelles** (7 groupes probables sur le fichier réel) : voulu, signalé en remarque ; aucun outil de fusion n'existe, à instruire en story à part si La Fourche le demande.
- **~300 comptes `member` créés d'un coup** : vérifié, les pages héritées qui listaient les membres sont retirées (`(app)/account` ne garde que la sécurité, s46). Rien d'autre à faire.
- **Hors périmètre** : plusieurs adresses email par membre (principale et secondaires) ; à instruire séparément après l'avis de La Fourche.
- **Design system** : le texte de la carte « Membres » quand l'association a déjà des membres n'est pas dessiné (« N membres. » en `text-muted-foreground`), à signaler comme écart au design.

## Definition of Done

- Une seule PR, un seul commit de story (squash), description structurée, diff lisible.
- Tests de logique métier verts (`pnpm test --run`), e2e vert en CI, lint et typecheck propres ; pas de `pnpm build` local.
- Migration générée par `pnpm db:generate` et rejouée en CI ; aucune édition manuelle de `_journal.json` ni des snapshots.
- Isolement prouvé par l'accès croisé entre deux tenants.
- Aucune donnée client dans git : fixtures fictives, `docs/inputs/` ignoré.
- Revue passée (`docs/reviews/s13-import-initial-membres.md` : `Ship allowed: yes`), aucun point critique ouvert.
- Prérequis d'exploitation avant l'import des données réelles : sauvegarde opérationnelle (s12c, livrée) ; confirmation par La Fourche du découpage de la référence et des lignes sans référence.
- Déployé en production : suit la règle du projet (pas de mise en production avant les stories prévues).
