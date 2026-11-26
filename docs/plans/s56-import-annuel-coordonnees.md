---
validated: yes
---

# Plan — Story s56-import-annuel-coordonnees

Branch: `feature/s56-import-annuel-coordonnees`

Sources : `docs/research/s56-import-annuel-coordonnees.md`, `docs/designs/s56-import-annuel-coordonnees.md`
(+ `.html`, référence visuelle seulement), [ADR 076](../decisions/076-adresse-desactivee-par-l-import-etat-conserve-et-reactivable.md)
(complète l'ADR 056), [ADR 077](../decisions/077-mise-a-jour-annuelle-instantane-importe-sur-la-fiche-le-site-l-emporte.md)
(complète les ADR 047 et 048). Reprend le lecteur et le mappage de s13 (ADR 047, 048, 058).

## Target story

La présidente dépose chaque année le fichier clients de Pennylane ; les coordonnées des fiches existantes se
mettent à jour sans ressaisie.

1. Dépôt depuis le back-office de l'association, sans SuperAdmin ; action déclarée au registre, Président(e)
   par défaut.
2. Rapprochement par l'identifiant client Pennylane (ADR 048) ; adresses postales, téléphone, adresses email
   mis à jour, sauf une valeur modifiée sur le site après le dernier import, gardée et signalée au rapport.
3. Titulaire remplacée par le fichier : la nouvelle (la première de la cellule) devient titulaire, l'ancienne
   n'est plus active ; le rapport le signale.
4. Titulaire absente sans remplaçante : plus active ; le site désigne arbitrairement une autre adresse active ;
   chaque désignation est signalée **au rapport** (amendé, décision A). Sans autre adresse active : courrier.
5. Supplémentaire venue d'un fichier précédent, absente du nouveau fichier : plus active.
6. Toutes les adresses d'une cellule (s54) ; domicile et terrain depuis leurs colonnes (s55).
7. Identifiant inconnu : pas de création, ligne « membre à créer à la main ».
8. La propriété des parcelles ne change jamais.
9. Une adresse ajoutée sur le site n'est pas supprimée par un fichier qui ne la porte pas.
10. Lignes invalides rejetées une à une, rapport éphémère (ADR 047) ; réimporter le même fichier ne change
    rien.

## Décisions

**Arbitrages de l'utilisatrice du 26/11/2026** (non rouverts) :

- **A. Notifications : rapport seul.** Le critère 4 est **amendé** : « Le bureau est notifié de chaque
  désignation (fiche, ancienne et nouvelle adresse titulaire) **au rapport** », la mention « et dans les
  notifications du back-office, sans email » est retirée. Aucun support de notification n'est créé en s56
  (ni table, ni écran, ni appel à `createNotificationService`). La ligne de `docs/stories.md` (document de
  cadrage, sur `main`) sera amendée à `/ks-ship`, sur `main`, avec renvoi à ce plan. s58 (adresse votante)
  lira la même section du rapport.
- **B. Fiche dont l'adresse titulaire porte un rôle** (compte lié de rôle `board` ou `owner` dans
  l'association, `getLinkedAccountRole`) : **l'import ne touche aucune adresse email de cette fiche** (ni
  ajout, ni désactivation, ni remplacement, ni désignation) ; la fiche est listée au rapport, section
  « Adresses à corriger à la main », quand le fichier aurait changé ses adresses. Domicile, terrain et
  téléphone suivent la règle normale : aucune raison de les exclure (ils ne portent ni compte ni rôle, et la
  règle « le site l'emporte » protège déjà une correction faite par la personne). Par cohérence, une adresse
  **supplémentaire** dont le compte porte un rôle n'est jamais désactivée par l'import : elle est listée dans
  la même section. Conséquence : le refus `board_email_required` ne peut pas être atteint par l'import ; s'il
  l'était (défense), la fiche est rapportée dans cette section, jamais levée.
- **C. Terrain à la mise à jour** : gardé quand la ligne n'a pas d'`Adresse de Livraison` ; mis à jour
  seulement quand le fichier en porte une. `member.default_land_*` ne s'appliquent qu'à la création (ADR 058),
  jamais à une mise à jour.
- **D. Adresse désactivée par un import** : nouvel état conservé `disabled_by_import` (ADR 076), réactivée si
  elle réapparaît dans un fichier suivant, avec sa désinscription, sans devenir titulaire d'office.

**Déjà tranché par la story et les sources** (pas des questions) : la règle fichier / site est confirmée par La
Fourche (réponse 6 : « le fichier n'écrase que les données jamais modifiées sur le site depuis le dernier
import ») — le « à confirmer » des critères 2 et 5 tombe ; le défaut du critère 5 est retenu ; une adresse
ajoutée sur le site n'est jamais désactivée par le fichier (9) ; un identifiant inconnu ne crée jamais de fiche
(7) ; champs mis à jour = adresses postales, téléphone, adresses email — **ni `Dénomination` ni
`company_name`** ; parcelles jamais touchées : la voie annuelle ignore les colonnes de parcelle,
`Référence Client` n'est pas requise (8).

**Décidé au plan** :

1. **« Modifié sur le site après le dernier import »** (ADR 077) : instantané des valeurs lues dans le fichier,
   sur la fiche (`member_profile.pennylane_import_snapshot` jsonb + `pennylane_imported_at`), **par groupe**
   (domicile, terrain, téléphone, adresses email). Règle : `F = C` inchangé ; `C = S` → `F` écrit ; sinon gardé,
   signalé si `F ≠ S`. Sans instantané (fiches de s13 et fiches créées à la main) : écrit si la fiche n'a jamais
   été modifiée depuis sa création (`updated_at = created_at`), sinon gardé et signalé. Un groupe vide dans le
   fichier n'efface rien. Les compléments d'adresse (absents du fichier) ne sont jamais écrits. s13 écrit
   l'instantané à la création, sans bumper `updated_at`. Justification : comparaison pure, idempotente, sans
   modifier les écrivains du bureau ni du membre ; prudente pour les fiches anciennes (rien n'est écrasé à
   tort, tout écart est au rapport).
2. **Plan des adresses d'une fiche** (règle pure, ordre) : (a) fiche sous la décision B → aucune opération ;
   (b) une adresse de la cellule déjà sur la fiche `active`/`pending` → inchangée ; `disabled_by_import` →
   réactivée ; absente de la fiche → ajoutée `origin = file`, sauf si elle est dans `S.emails` (retirée sur le
   site : gardée hors de la fiche, signalée) ; (c) supplémentaire active « venue du fichier » (ADR 077 §4)
   absente de la cellule → `disabled_by_import` ; une adresse du site ou en attente n'est jamais touchée ;
   (d) titulaire présente dans la cellule → reste titulaire (l'ordre de la cellule ne déplace pas le titre,
   s54) ; titulaire « venue du fichier » absente : s'il existe une adresse **nouvelle** (ajoutée ou réactivée
   en (b)), la première dans l'ordre de la cellule la **remplace** (critère 3, chemin `replaceMemberAccount`) ;
   sinon elle est désactivée et le site **désigne** la première adresse active selon l'ordre déterministe :
   adresses présentes dans la cellule (ordre de la cellule), puis les autres par `created_at`, puis `id`
   (critère 4) ; aucune → courrier ; titulaire du site absente du fichier → **gardée** (critère 9 + règle de La
   Fourche), les adresses nouvelles s'ajoutent en supplémentaires, signalée en « valeur conservée » si la
   cellule diffère de `S.emails` ; fiche sans adresse active → la première adresse nouvelle devient titulaire
   (`roleForNewActiveEmail`, pas une désignation). Rétrograder avant de promouvoir (index unique partiel).
   C'est l'unique exception à « aucune promotion d'office » (s54).
3. **Rapprochement sans casse**, aligné sur s20 : `listMemberProfilesByPennylaneIdIgnoringCaseDao` ; plus d'une
   fiche (impossible depuis s20, défense) → ligne rejetée `ambiguous_customer_id`. Plusieurs lignes du même
   identifiant : coordonnées de la première ligne (`groupByCustomer` de s13).
4. **Route** : `/bureau/proprietaires/mise-a-jour` (design), page + `actions.ts` sous
   `src/app/[locale]/(bureau)/bureau/proprietaires/mise-a-jour/`. Pas d'entrée de barre ; l'item
   « Propriétaires » passe à `matchesSubroutes: true` (reste actif sur la sous-route, et sur `[id]`,
   `nouveau`). L'écran SuperAdmin de s13 reste la seule voie de création, inchangé.
5. **Autorisation** : action du registre `member.contact.import` (`MEMBER_CONTACT_IMPORT`),
   `defaultRoles: ['owner']` — la première action réservée à la présidence. Garde `canPerformAction` **en tête
   du service** (avant toute lecture du fichier), `AuthorizationError` sinon ; les services appelés rejouent
   `member.profile.manage` (la présidente l'a). Le SuperAdmin passe (règle du registre). DAL
   `canImportCurrentMemberContactsDal` pour la page (bouton d'entrée masqué, état 1f) ; la Server Action
   rejoue `requireActionAuth()` et le service refuse un Bureau à l'appel direct.
6. **Tenant** : `requireCurrentTenantDal()` dans la page et la Server Action ; jamais d'`organizationId` lu du
   formulaire (ADR 003).
7. **Transactions** : une transaction de tenant **par fiche** (ADR 047), composée des services existants
   (`updateMemberProfileContactService` avec les valeurs fusionnées, `addMemberProfileEmailService`,
   `designateMemberProfileHolderService`) et de deux fonctions nouvelles du service des adresses
   (désactiver, réactiver) ; une `MemberRejected` ou une erreur annule toute la fiche, qui passe en ligne
   rejetée, les suivantes continuent.
8. **Rapport** (éphémère, ADR 047) : bilan + sections du design (mises à jour par groupe, valeurs conservées,
   titulaires remplacées, titulaires désignées, adresses plus actives, membres à créer à la main, lignes
   rejetées) **+ « Adresses à corriger à la main »** (décision B ; même forme de carte de section que les
   autres, colonnes Fiche · Adresse titulaire · Dans le fichier — composition, gap noté). Journal : comptages
   seulement.
9. **Badge** « Désactivée par l'import » sur la fiche du bureau : `badge` `outline` + `meta` (forme proposée au
   §9 du design system, désormais utilisée) ; action « Retirer » seule sur cette ligne. Le suivi des
   invitations (s42b) écarte ces adresses (pas d'affichage nouveau dans s42b).
10. **Refus d'accès 1f** : `BureauAccessDenied` reçoit des props facultatives (clé de texte, lien de retour)
    pour rendre le texte de 1f avec la barre latérale (le composant est déjà rendu dans une page sous le
    layout, ex. `bureau/actualites/page.tsx`) ; aucun composant nouveau.

## Tasks (ordered)

1. [x] **Modèle et migration (ADR 076, 077)** — `member-profile-email-model.ts` : valeur
       `disabled_by_import` de `memberProfileEmailStatusEnum` ; `member-profile-model.ts` :
       `pennylaneImportSnapshot` (`jsonb`, type `PennylaneImportSnapshot` du domaine) et
       `pennylaneImportedAt` (`timestamptz`), nullables. `pnpm db:generate` uniquement (aucune policy
       nouvelle : RLS forcée de `member_profile` et `member_profile_email` déjà en place). **Vérif** :
       `pnpm db:generate` sans diff ensuite ; migration rejouée sur la base locale de secours (skill
       `postgres-local-dev`) : ligne existante intacte, insertion d'une adresse `disabled_by_import` acceptée,
       index unique partiel de la titulaire inchangé ; sortie collée au rapport d'exécution. **Non fait** :
       le rejeu sur une base locale n'a pas eu lieu (pas de serveur Postgres sur la machine) ; il est couvert
       par `pnpm db:migrate`, exécuté en CI avant les e2e (revue m3).
2. [x] **Registre et garde** — `action-registry-types.ts` : `MEMBER_CONTACT_IMPORT: 'member.contact.import'`,
       entrée `defaultRoles: ['owner']` (JSDoc : première action de la présidence seule) ;
       `src/services/authorization/member-contact-import-authorization.ts` :
       `canImportMemberContacts(organizationId)` sur `canPerformAction` ; DAL
       `canImportCurrentMemberContactsDal` (patron `canManageCurrentMemberProfilesDal`). **Vérif** :
       `action-registry-types.test.ts` (owner oui, board non, member non), `action-registry-authorization.test.ts`
       (SuperAdmin oui), test du DAL.
3. [x] **Mappage annuel** — `pennylane-clients-mapper.ts` : option `{mode: 'annual'}` : `Référence Client`
       non requise, aucune parcelle ni compteur calculés, `missing_reference` et `no_meter` jamais émis ;
       `groupByCustomer`, `cellEmails`, `homeAndLandOf` (terrain `undefined` sans livraison), remplissage du code
       postal inchangés. Le mode par défaut (s13) ne bouge pas. **Vérif** : `pennylane-clients-mapper.test.ts`
       — fichier sans colonne `Référence Client` accepté en annuel et refusé en initial ; deux lignes du même
       identifiant aux références divergentes → un candidat sans parcelle ; 25 cas existants verts.
4. [x] **Règle pure des coordonnées (ADR 077 §2-3)** — `src/services/rules/member-annual-import-rules.ts` (+
       types `src/services/types/domain/member-annual-import-types.ts`) : `planAnnualContactUpdate(current,
    fileGroups, snapshot | null, touchedSinceCreation)` → par groupe `unchanged | updated | kept(reported)`,
       contact fusionné (compléments, `companyName`, nom repris de la fiche) et nouvel instantané. **Vérif** :
       un test par branche — `F = C` ; `C = S` → écrit ; `C ≠ S`, `F ≠ S` → gardé signalé ; `C ≠ S`, `F = S` →
       gardé non signalé ; sans instantané, fiche intacte → écrit, fiche touchée → gardé ; terrain sans
       livraison → gardé (C) ; téléphone vide dans le fichier → rien effacé ; compléments jamais touchés ;
       rejouer le résultat → tout `unchanged`.
5. [x] **Règle pure des adresses (décision 2, B, D)** — même fichier : `planAnnualEmailUpdate({rows, cell,
    snapshotEmails, roleBoundEmailIds, holderRoleBound})` → opérations ordonnées (`add`, `reactivate`,
       `disable`, `demote`, `promote`) et constats du rapport (`replaced`, `designated`, `disabled`, `kept`,
       `manual`). Types `'active' | 'pending'` élargis à `disabled_by_import` dans `member-email-rules.ts`
       (`planEmailRemoval` : une ligne désactivée se retire sans remplaçante). **Vérif** : un test par critère
       — 3 (nouvelle adresse première de la cellule devient titulaire, l'ancienne désactivée) ; 4 (désignation
       déterministe : cellule d'abord, puis `created_at`, puis `id` ; aucune → courrier) ; 5 ; 9 (adresse `site`
       et titulaire `site` gardées) ; `file` modifiée sur le site (hors `S.emails`) gardée ; adresse retirée sur
       le site non rajoutée ; adresse désactivée réapparue → réactivée en supplémentaire (D) ; B (aucune
       opération, constat `manual`) ; supplémentaire à rôle jamais désactivée ; en attente intacte ; rejouer le
       plan appliqué → aucune opération.
6. [x] **État `disabled_by_import` dans les écrivains et lecteurs (ADR 076)** —
       `member-profile-email-repository.ts` : `setMemberProfileEmailStatusDao` ; `getInvitationAddressesDao`
       écarte les désactivées ; `member-profile-email-service.ts` : `disableImportedEmail` (statut, rôle
       `additional`, `closeMemberAccount` du compte de la ligne) et `reactivateImportedEmail` (rôle par
       `roleForNewActiveEmail`, compte ouvert/relié, `unsubscribed_at` gardé), non exposées par la façade ;
       `addMemberProfileEmailService` sur une adresse désactivée de la fiche → réactivée origine `site` ;
       ajout par le membre (`my-email-service.ts`) sur une adresse désactivée → la ligne passe `pending` ;
       `my-email-service` et `member-invitation-campaign-rules.ts` excluent l'état ; `member-profile-emails-card.tsx`
       : badge `outline` « Désactivée par l'import » + `meta`, seule action « Retirer ». **Vérif** : tests de
       service (connexion coupée sur cette fiche seulement, autre fiche du même compte intacte ; désinscription
       conservée à la réactivation ; ajout bureau / membre d'une adresse désactivée ; retrait), test des règles
       d'invitation, test du composant (badge, pas de bouton « Désigner ») ; suites `member-profile-email-service`,
       `my-email-service`, `campaign` vertes (ciblage inchangé : filtre `active` déjà en place).
7. [x] **Service d'import annuel** — `src/services/member-annual-import-service.ts` :
       `importAnnualMemberContactsService({organizationId, content})` : schéma Zod
       (`member-import-validation.ts`), **garde de la tâche 2 en tête**, `readCsv` + plafond de lignes +
       mappage annuel (refus du fichier entier avant toute écriture), puis par candidat, sous `withTenant` :
       recherche sans casse (décision 3, inconnue → « à créer à la main »), lecture fiche + adresses + rôles
       des comptes liés, règles des tâches 4 et 5, écritures uniquement s'il y a un changement, instantané et
       `pennylane_imported_at` écrits sans bumper `updated_at` (`setMemberProfileImportSnapshotDao`,
       `member-profile-repository.ts`) ; erreurs de validation traduites en motifs (`rejectionOfValidation` de
       s13, extrait si nécessaire) ; `buildAnnualReport` ; journal en comptages. Façade
       `member-annual-import-service-facade.ts` + intercepteur. s13 : `createProfile` écrit l'instantané de la
       fiche créée (même DAO). Types du rapport et `ImportRejectionConst.AMBIGUOUS_CUSTOMER_ID` dans les types
       du domaine. **Vérif** : `src/services/__tests__/member-annual-import-service.test.ts` — Bureau refusé à
       l'appel direct (`AuthorizationError`, aucun DAO appelé), présidente et SuperAdmin acceptés ; chaque
       critère 2 à 10 ; identifiant dans une autre casse retrouvé ; aucun appel à `attachParcelService` ni
       `recordSaleService` (8) ; `default_land_*` jamais lus (C) ; nom et entreprise inchangés ; une fiche
       rejetée n'empêche pas la suivante ; rejouer le même fichier → aucune écriture hors instantané, rapport
       « rien n'a changé » ; `withTenant` appelé avec l'association passée ; `board_email_required` éventuel
       rapporté, pas levé. `member-import-service.test.ts` (s13) vert + instantané écrit à la création.
8. [x] **Écran (design s56)** — `src/app/[locale]/(bureau)/bureau/proprietaires/mise-a-jour/` : `page.tsx`
       (tenant du domaine, `canImportCurrentMemberContactsDal`, 1f sinon), `loading.tsx`, `error.tsx`,
       `actions.ts` (`importAnnualMemberContactsAction(_prev?, formData?)` : `requireActionAuth()`, tenant par
       `requireCurrentTenantDal`, contrôle `.csv` et poids de s13, façade, `revalidatePath` des fiches comme
       s13, messages `getTranslations`) ; composants `src/components/features/member-profile/annual-import/`
       (écran, formulaire de dépôt sans carte Association, rapport : bilan `dl` §3.13, huit sections, liens vers
       les fiches, pagination 25 / 10, cartes sous 640 px), réutilisant ce que s13 exporte ; bouton d'entrée
       `outline` « Mettre à jour les coordonnées » sur `bureau/proprietaires/page.tsx` pour la présidence
       seule ; `bureau-sidebar.tsx` (`matchesSubroutes`) ; `BureauAccessDenied` (props facultatives) ;
       libellés `BureauMemberAnnualImport.*` dans `messages/fr.json` (motifs repris de
       `AdminMemberImport.report.reasons`). **Vérif** : `actions.test.ts` (tenant du domaine, jamais du
       formulaire ; refus non `.csv` / trop lourd ; Bureau refusé), tests de composants (1a désactivé, 1c
       chargement, 1d/1e erreurs, 2a sections, 2b « rien n'a changé », 2c aucune ligne utile, section vide
       « (0) »), test de page (bouton absent pour le Bureau, 1f).
9. [x] **e2e et isolation** — `e2e/member-annual-import.spec.ts` (série) + fixtures **fictives**
       `e2e/fixtures/member-annual-import-annee-1.csv` / `-annee-2.csv` (préfixe d'identifiant et domaine
       dédiés, nettoyés en `afterAll` par `cleanUpPrefix` sous `app.bypass_rls`) ; fiches de départ posées par
       l'import initial (SuperAdmin) puis modifiées sur le site pour les cas « gardé ». La présidente de
       TechCorp (`user-owner@gmail.com`, `localhost`) importe : preuves SQL sous
       `set_config('app.organization_id', …)` des critères 2 à 9 (adresses, statuts, titulaire, parcelles
       inchangées) ; connexion par lien magique avec la nouvelle titulaire, échec avec l'ancienne (3) ;
       réimport → état identique (10) ; année 2 → adresse réactivée (D). Un membre du Bureau ne voit pas le
       bouton et reçoit 1f. **Accès croisé** : le même fichier déposé sur Marketing Pro (`127.0.0.1`) ne
       touche aucune fiche de TechCorp (toutes « à créer à la main ») ; la présidente de TechCorp n'a pas
       l'écran sur Marketing Pro. **Vérif** : e2e en CI GitHub (jamais en local) ; `member-import.spec.ts`,
       `member-accounts.spec.ts`, `member-invitations` verts.
10. [x] **Docs et contrôles** — `docs/architecture.md` (colonnes d'instantané sur `member_profile`, état
        `disabled_by_import`, première action `['owner']`, compteur de tables inchangé ; s38 devra déclarer
        l'instantané) ; `docs/design-system.md` §9 (badge « Désactivée par l'import » utilisé ; refus d'accès
        d'une page avec barre latérale ; section « Adresses à corriger à la main ») ; note dans le rapport
        d'exécution : amendement du critère 4 de `docs/stories.md` à faire sur `main` au ship. **Vérif** :
        `pnpm lint`, typecheck, `pnpm check:rules`, `pnpm test --run` verts (copie sur disque local si le
        montage 9p fait expirer les workers ; un timeout ne compte jamais comme vert).

## Files touched

- Modèles et migration : `src/db/models/member-profile-email-model.ts`, `src/db/models/member-profile-model.ts`,
  `drizzle/migrations/*` (générés).
- Persistance : `src/db/repositories/member-profile-repository.ts` (instantané),
  `src/db/repositories/member-profile-email-repository.ts` (statut, invitations).
- Règles et types : `src/services/rules/member-annual-import-rules.ts` (nouveau),
  `src/services/rules/member-email-rules.ts`, `src/services/rules/member-invitation-campaign-rules.ts`,
  `src/services/types/domain/member-annual-import-types.ts` (nouveau), `member-import-types.ts`,
  `action-registry-types.ts`, `member-email-types.ts` / `member-profile-types.ts` (statut élargi).
- Mappage : `src/lib/import/pennylane-clients-mapper.ts`.
- Services : `src/services/member-annual-import-service.ts` (nouveau), façade + intercepteur (nouveaux),
  `src/services/authorization/member-contact-import-authorization.ts` (nouveau),
  `src/services/validation/member-import-validation.ts`, `member-profile-email-service.ts`,
  `my-email-service.ts`, `member-import-service.ts` (instantané à la création).
- Présentation : `src/app/[locale]/(bureau)/bureau/proprietaires/mise-a-jour/{page,loading,error,actions}.tsx|ts`,
  `bureau/proprietaires/page.tsx`, `src/app/dal/member-profile-dal.ts` (ou DAL dédié),
  `src/components/features/member-profile/annual-import/*` (nouveaux),
  `member-profile-emails-card.tsx`, `bureau-sidebar.tsx`, `bureau-access-denied.tsx`, `messages/fr.json`.
- Tests : unitaires colocalisés et `src/services/__tests__/*` ; `e2e/member-annual-import.spec.ts` + deux
  fixtures fictives.
- Docs : ADR 076, ADR 077, `docs/architecture.md`, `docs/design-system.md`, recherche, design, plan.

## Test strategy

- **Unitaires (Vitest, `pnpm test --run <chemin>`)** : règles pures d'abord (tâches 4, 5 : une branche par
  test, rejouer le plan appliqué → rien) ; mappage annuel ; service avec DAO et services simulés (garde en
  tête, critères 2 à 10, casse, parcelles jamais écrites, idempotence, rejets ligne à ligne) ; état
  `disabled_by_import` dans chaque écrivain et lecteur ; action (tenant du domaine) et composants (états du
  design).
- **Autorisation** : appel direct du service et de l'action par un membre du Bureau → refusé ; aucune
  confiance dans le masquage du bouton.
- **e2e (Playwright, CI)** : vraie base seedée, deux fichiers fictifs successifs, preuves SQL, connexion avec la
  nouvelle titulaire, réimport sans effet, accès croisé TechCorp / Marketing Pro. La RLS ne se teste pas en
  unitaire.

## Definition of Done

- Une PR, branche `feature/s56-import-annuel-coordonnees` ; un commit de story, plus un commit séparé pour la
  migration si elle doit pouvoir être annulée seule.
- Les dix critères (4 amendé, décision A) couverts par un test nommé ; idempotence prouvée en unitaire et en
  e2e.
- Aucune valeur en dur : terrain par défaut jamais appliqué à une mise à jour, libellés dans
  `messages/fr.json`, rôle par défaut dans le registre.
- Aucune parcelle écrite, aucune fiche créée, aucun email envoyé, aucune notification persistée ; rapport jamais
  stocké ni journalisé.
- `withTenant` / `getDb()` partout ; tenant du domaine ; accès croisé testé en e2e.
- `/ks-review` passée sans critique ; e2e verts en CI ; amendement du critère 4 porté sur `main` au ship.

## Correctifs de revue (tour 1, arbitrage du 2026-11-26)

La revue du tour 1 (`docs/reviews/s56-import-annuel-coordonnees.md`) autorise le ship avec deux majeurs ;
l'utilisatrice a choisi de les corriger avant la PR, avec deux mineurs de texte.

- [x] **M1** — `updateMemberProfileEmailService` refuse une cible `disabled_by_import` (refus `not_found` ou
      dédié, sans ouvrir ni relier de compte), test d'abord. Tout autre écrivain du bureau qui accepterait la même
      cible est couvert de la même façon.
- [x] **M2** — typographie du rapport et du formulaire de l'import annuel (`annual-import-report.tsx`,
      `annual-import-form.tsx`) ramenée sur l'échelle du design system (`meta` 15 px, `data` 17 px, `h2`/`h3`
      selon §3) ; l'écran de s13 n'est pas touché.
- [x] **m3** — tâche 1 : la case porte la mention que le rejeu de la migration sur une base locale n'a pas été
      fait (pas de serveur Postgres sur la machine) et qu'il est couvert par `db:migrate` en CI.
- [x] **m5** — ADR 077 §1 : l'instantané écrit par s13 contient le terrain effectivement écrit, terrain par
      défaut compris.
