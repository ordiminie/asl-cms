---
validated: yes
---

# Plan — Story s53-un-acces-plusieurs-terrains

Branch: `feature/s53-un-acces-plusieurs-terrains`

Sources : `docs/research/s53-un-acces-plusieurs-terrains.md`, `docs/designs/s53-un-acces-plusieurs-terrains.md`
(+ `.html`), [ADR 054](../decisions/054-lien-fiche-compte-par-table-de-liaison.md) (remplace 037),
[ADR 055](../decisions/055-desinscription-par-adresse-et-un-envoi-par-adresse.md) (remplace ADR 051 sur la
désinscription).

## Target story

Un propriétaire de plusieurs terrains se connecte une seule fois et retrouve tous ses terrains.

1. Une même adresse sur plusieurs fiches d'une association = une personne = un compte relié à chacune.
2. Après connexion, « Mes terrains » liste ses terrains (fiche, parcelle, compteur), sans changer de compte.
3. Le bureau saisit une adresse déjà portée : le site nomme le détenteur du compte et demande confirmation ;
   confirmé → fiche reliée, refusé → rien d'enregistré. Aucun compte fusionné.
4. Un membre ne voit que les fiches reliées à son compte : accès croisé testé (identifiant forgé, même
   association et autre association).
5. L'import ne rejette plus une adresse partagée : fixture anonymisée (25 lignes, 10 adresses partagées), une
   fiche par client Pennylane, même compte, chaque regroupement signalé au rapport.
6. Retirer l'adresse d'une fiche ne ferme pas l'accès aux autres fiches du compte.
7. Une campagne n'envoie qu'un message par adresse (dédoublonnage au calcul de la cible).
8. Le bureau voit dans la liste le nombre de terrains que porte chaque compte.

**Arbitrages du 16/11/2026** (AskUserQuestion, tous sur la recommandation) :

- **Coordonnées (s16)** : le membre corrige **toutes** ses fiches d'un coup (écran 2 du design, état 2b si
  elles divergent).
- **Désinscription** : elle couvre l'adresse ; `{nom}` = nom du compte, `{parcelle}` = toutes ses parcelles
  actuelles (ADR 055).
- **Signalement (s22) et question (s23)** : rattachés à la **première fiche** du compte (ordre ADR 054 §7),
  formulaires inchangés ; « Mes signalements » liste ceux de toutes ses fiches.
- **Liste du bureau** : « Compte de {n} terrains » **seulement à partir de 2**.

Décidé au plan (techniques, ADR 054) : table de liaison ; ligne `member` retirée seulement sans fiche restante ;
refus « bureau » seulement pour la dernière fiche ; rôle déplacé à un remplacement d'adresse seulement si la
fiche était la dernière du compte ; confirmation revérifiée au serveur par l'identifiant du compte attendu.

## Tasks (ordered)

1. [x] **Modèle et migrations (ADR 054)** — `src/db/models/member-profile-account-model.ts` (table,
       `UNIQUE (member_profile_id)`, index `(organization_id, user_id)`), ajoutée à `db.ts` ; index email de
       `member_profile` rendu non unique. Ordre des migrations : (a) `pnpm db:generate` pour la table et l'index ;
       (b) `drizzle-kit generate --custom` : RLS activée **et** forcée + policy `tenant_isolation` (patron `0053`)
       et copie `INSERT … SELECT id, organization_id, user_id FROM member_profile WHERE user_id IS NOT NULL` ;
       (c) retrait de `user_id` du modèle puis `pnpm db:generate`. `docs/architecture.md` : ligne de la table,
       description de `member_profile` et du lien (l. 306-312, 381), compteur des tables (l. 355), « s38 devra la
       déclarer ». **Vérif** : `pnpm db:generate` ne produit plus de diff ; `pnpm check:rules` et le typecheck
       passent une fois les tâches 2-3 branchées (les erreurs de type sur `userId` guident l'inventaire).
2. [x] **Repository du lien + lectures ordonnées** — dans `member-profile-repository.ts` : remplacer
       `setMemberProfileUserIdDao` / `getMemberProfileByUserIdDao` / `getUnlinkedMemberProfilesWithEmailDao` /
       `updateMyMemberProfileContactDao` par des DAO sur la table (`linkMemberProfileAccountDao`,
       `unlinkMemberProfileAccountDao`, `getMemberProfilesByUserIdDao` → toutes les fiches du compte avec leurs
       parcelles actuelles, `countLinkedProfilesDao`, `getMemberProfilesByEmailDao` → **toutes** les fiches d'une
       adresse avec leur compte) ; retirer `isEmailTakenViolation`. Règle pure `orderMyProfiles` (premier numéro
       de parcelle actuelle, `localeCompare('fr', {numeric: true})`, puis id) dans `src/services/rules/`.
       **Tests** : `orderMyProfiles` (fiches sans parcelle actuelle en dernier, départage stable).
3. [x] **Compte d'une fiche (`member-account-service.ts`, `rules/member-account-rules.ts`)** —
       `decideMemberAccount` reçoit le nombre d'autres fiches reliées au compte : `refuse_board_removal` seulement
       pour la dernière ; nouvelle décision `link_shared` quand l'adresse est celle d'un compte de l'association.
       `openMemberAccount` pose le lien ; `closeMemberAccount` retire le lien, puis la ligne `member` (rôle
       `member`) **seulement si** `countLinkedProfilesDao` = 0 ; `replaceMemberAccount` ne déplace le rôle que si
       la fiche était la dernière de l'ancien compte. **Tests** (`member-account-service.test.ts`,
       règles) : fermer une fiche d'un compte à deux fiches garde la ligne `member` (critère 6) ; fermer la
       dernière la retire ; bureau à deux fiches peut vider l'une, pas la dernière ; remplacement avec et sans
       autres fiches (rôle déplacé ou non, traces ADR 039).
4. [x] **Écritures du bureau (`member-profile-service.ts`)** — création et modification : si l'adresse est
       portée par une autre fiche de l'association, rendre `{status: 'email_shared', holder: {userId, name,
profiles: [{id, name, parcelNumbers}]}}` sans rien écrire, sauf si l'entrée porte
       `confirmedAccountUserId` égal au compte détenteur **relu dans la transaction** (sinon redemander) ;
       confirmé → fiche écrite + lien vers ce compte, `accountChange: 'linked'`. Adresse connue seulement dans
       une autre association : inchangé (ouverture silencieuse). DTO : carte « Accès » avec les autres fiches du
       compte (3c) ; liste : `accountProfileCount` (critère 8). Validation Zod de `confirmedAccountUserId` (uuid,
       facultatif) ; aucune nouvelle action au registre (même action « gérer les fiches »). **Tests** : refus sans
       confirmation (aucun DAO d'écriture appelé), confirmation acceptée, confirmation périmée (autre détenteur)
       → `email_shared`, appel direct avec un `confirmedAccountUserId` arbitraire refusé, rôles guest / membre /
       bureau / SuperAdmin.
5. [x] **Écrans du bureau** — actions `bureau/proprietaires/actions.ts` et `[id]` (`toActionResult` traduit
       `email_shared`) ; `member-profile-form.tsx` et `member-profile-detail.tsx` : état 3a (encart `warning` sous
       l'email, « Oui, relier à son compte » renvoie avec la confirmation, « Non, corriger l'adresse » rend le
       focus au champ), 3b, 3d, remplacement ; `member-profile-detail-card` / carte « Accès » 3c ;
       `member-profile-list.tsx` : « Compte de {n} terrains » sous l'adresse si n ≥ 2, tableau et carte mobile
       (4a). `EmailHolder` retiré. Libellés dans `messages/fr.json`, **sans pronom** (manque du design). **Tests**
       composants : 3a → clic « Oui » renvoie la confirmation, « Non » n'appelle rien ; liste avec n = 1 et n = 3.
6. [x] **Import (s13)** — `member-import-service.ts` : sur `email_shared`, réappeler la création avec le
       compte détenteur et produire la remarque `shared_email` (`relatedLine` = première ligne du fichier à cette
       adresse, sinon remarque « déjà portée par une fiche existante ») ; plus de rejet `email_taken` pour ce cas.
       Libellés `remarks.shared_email*`. Fixture **construite à la main**, anonymisée :
       `e2e/fixtures/member-import-adresses-partagees.csv` (25 lignes, 10 adresses partagées, en-têtes Pennylane
       de `member-import-fictif.csv`) — rien dérivé du fichier réel hors git. **Tests** : service (deux lignes,
       même adresse → deux fiches, un compte, une remarque), rapport (`buildReport`), relance idempotente.
7. [x] **Espace membre, services** — `member-space-service.ts` : `getMyLandsService` (remplace
       `getMyParcelsService`) → `{accountName, lands: [{name, current: [{number, startsOn, meterNumber}],
former}]}` dans l'ordre ADR 054 (ajouter `meterNumber` à `getCurrentParcelsByMemberDao`) ;
       `getMyContactService` → coordonnées de la personne + `divergent` et groupes (2b) ;
       `updateMyContactService` écrit toutes les fiches du compte, rend leur nombre. Lecteurs singuliers passés au
       pluriel : `incident-report-service.ts` (création sur la première fiche ; « Mes signalements » sur toutes,
       `getMyIncidentReportsDao` reçoit une liste d'ids), `member-question-service.ts` (première fiche),
       `member-role-service.ts` et `organization-service.ts` (trace sur la première fiche). DAL
       `member-space-dal.ts` et types `member-space-types.ts` à jour. **Tests** : compte à 3 fiches (ordre,
       compteur, anciennes parcelles par fiche) ; un seul terrain inchangé ; compte sans fiche → `undefined` ;
       coordonnées écrites sur toutes les fiches ; un identifiant de fiche glissé dans l'entrée est retiré par Zod
       (critère 4, unitaire) ; signalement d'un compte à 2 fiches rattaché à la première, liste des deux.
8. [x] **Espace membre, écran** — `member-space.tsx` : carte « Mes terrains » (1a, 1b, 1c), marqueur « · {n}
       terrains · Parcelles … », `h1` au nom du compte si plusieurs terrains ; `my-contact-card.tsx` : 2a, 2b, 2c.
       Aucun composant nouveau (icône `Droplet` du vocabulaire figé). Libellés `messages/fr.json`. **Tests**
       composants (`member-space.test.tsx`, `my-contact-card.test.tsx`) : un et trois terrains, compteur absent,
       coordonnées divergentes, chargement.
9. [x] **Campagnes (ADR 055)** — `computeCampaignTarget` groupe par `lower(email)` (premier de l'ordre ADR 054
       porte la ligne ; groupe désinscrit si une fiche l'est) ; `getCampaignTargetRowsDao` ajoute le nom du compte
       et les parcelles ; à la livraison (`getPendingPartRecipientsDao`), `{nom}` / `{parcelle}` et la
       désinscription lus sur toutes les fiches de l'adresse ; `confirmUnsubscribeService` désinscrit chaque fiche
       de la même adresse. **Tests** : règle pure (3 fiches, même adresse → 1 destinataire ; une désinscrite → 0 ;
       décomptes), variables d'une adresse partagée, désinscription étendue.
10. [x] **Seed, e2e et non-régression** — `seed.ts` : un compte à trois fiches dans l'association A
        (déterministe). e2e (`member-accounts.spec.ts`, `member-import.spec.ts`, `campaigns.spec.ts`,
        `member-profiles.spec.ts`) : critère 1-2 (connexion, « Mes terrains » des trois fiches) ; critère 3
        (confirmation : refus n'écrit rien, oui relie) ; critère 4 (le membre ouvre `/bureau/proprietaires/{id}`
        d'un autre membre de A → C4, une fiche de B forgée → rien ; action serveur avec un identifiant de fiche
        injecté → sans effet) ; critère 5 (fixture, rapport) ; critère 6 (vider une adresse, rechargement :
        l'accès reste, la fiche disparaît de « Mes terrains ») ; critère 7 (une campagne, un destinataire pour
        l'adresse) ; critère 8 (liste). Mettre à jour les specs s12d / s13 qui supposaient l'unicité. Puis
        `pnpm lint`, typecheck, `pnpm test --run` (sur copie disque local, mémoire 9p). e2e en CI GitHub.

## Files touched

- Modèle / migrations : `src/db/models/member-profile-account-model.ts` (nouveau), `member-profile-model.ts`,
  `db.ts`, `drizzle/migrations/00xx_*` (trois, dont un `--custom`) + `meta/`.
- Repositories : `member-profile-repository.ts`, `parcel-ownership-repository.ts`, `campaign-repository.ts`,
  `incident-report-repository.ts` (liste d'ids).
- Services : `member-account-service.ts`, `member-profile-service.ts`, `member-space-service.ts`,
  `member-import-service.ts`, `incident-report-service.ts`, `member-question-service.ts`,
  `member-role-service.ts`, `organization-service.ts`, `campaign-service.ts`, `unsubscribe-service.ts` ;
  règles `member-account-rules.ts`, `campaign-rules.ts`, nouvelle règle d'ordre ; types `member-profile-types.ts`,
  `member-account-types.ts`, `member-space-types.ts`, `member-import-types.ts`, `campaign-types.ts` ;
  validation `member-profile-validation.ts` ; façades concernées.
- Présentation : `src/app/dal/member-space-dal.ts`, `dashboard/page.tsx`, `bureau/proprietaires/actions.ts`
  (+ `[id]`), `member-profile-form.tsx`, `member-profile-detail.tsx`, `member-profile-detail-card.tsx`,
  `member-profile-list.tsx`, `member-profile-form-validation.ts`, `member-space.tsx`, `my-contact-card.tsx`,
  `admin/member-import/member-import-report.tsx` (libellé seul) ; `messages/fr.json`.
- Seed et tests : `src/db/scripts/seed.ts`, specs unitaires colocalisées et `src/services/__tests__/*`,
  `e2e/*.spec.ts`, `e2e/fixtures/member-import-adresses-partagees.csv`.
- Docs : ADR 054, ADR 055, `docs/architecture.md`.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : règles pures (ordre des fiches, décision de compte, cible de
  campagne) sans mock ; services avec DAO mockés, par rôle (guest, membre, bureau, SuperAdmin) ; composants
  (états 1a-1c, 2a-2c, 3a-3d, 4a). Chaque critère a au moins un test unitaire, sauf l'isolation RLS.
- **e2e (Playwright, CI GitHub, build de production)** : critères 1 à 8 bout en bout, dont l'accès croisé
  (même association et autre association) — la RLS de la nouvelle table ne se prouve qu'ici.
- **Non-régression** : un compte à une fiche voit l'écran de s12d (plus le compteur) ; specs s12d, s13, s16,
  s22, s23, s25 vertes.

## Definition of Done

- Une PR `feature/s53-un-acces-plusieurs-terrains`, un commit (plus un commit séparé pour les migrations si
  on veut pouvoir les annuler seules), avec recherche, design, plan, ADR 054/055 et revue.
- Critères 1 à 8 couverts par des tests verts ; RLS forcée sur `member_profile_account`, accès croisé e2e.
- Aucune valeur en dur (libellés dans `messages/fr.json`) ; aucun composant ni token hors design system.
- Table déclarée à l'inventaire (`docs/architecture.md`) ; mention s38.
- Revue `/ks-review` passée (`Ship allowed: yes`), aucun critique ouvert.
- **Taille** : complexité 4, dix tâches — à la limite. Si l'exécution déborde, la tâche 9 (campagnes) est
  la scission naturelle (story « un envoi par adresse »), à proposer plutôt qu'à forcer.
