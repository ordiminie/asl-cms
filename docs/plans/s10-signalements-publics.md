---
validated: yes
---

# Plan — Story s10-signalements-publics

Branch: `feature/s10-signalements-publics`, à créer depuis `main` **à jour** (voir la note de
numérotation des migrations, tâche 1).

> **Sources** :
>
> - recherche : `docs/research/s10-signalements-publics.md` ;
> - design : `docs/designs/s10-signalements-publics.md`, maquette
>   `docs/designs/s10-signalements-publics.html`, brief `docs/designs/s10-signalements-publics-brief.md` ;
> - design system : `docs/design-system.md` §1.7, §3.1, §3.2, §3.5, §3.9, §5.1 à §5.6 ;
> - décision structurante : **ADR 028** (`docs/decisions/028-categories-generiques-et-signalements.md`) ;
> - précédents : s08 (`docs/plans/s08-formulaire-contact.md`) et s08b
>   (`docs/plans/s08b-limitation-debit-formulaires.md`) — même forme de flux, même limiteur ;
> - règles : `rule-architecture`, `rule-safe-server-action`, `rule-form-front-and-back`,
>   `rule-zod-client-server-internationalization`, `rule-service`, `rule-services-tests`,
>   `rule-persistence`, `rule-transaction-dao`, `rule-email-service`,
>   `rule-service-emails-internationalization`, `rule-react-cache-next-cache`, `rule-logger`,
>   `rule-table-pagination`.

## Target story

**En tant que** visiteur **je veux** signaler une fuite ou un incident sans compte **afin que** le
bureau intervienne vite. Complexité 3, dépend de s02, s04, s08b (livrées).

1. Un signalement valide (catégorie, localisation, description, coordonnées facultatives) est
   enregistré, confirmé à l'écran et notifié par email aux adresses paramétrées du tenant.
2. Il apparaît dans une file de suivi en back-office avec le statut initial `signalé`.
3. Le bureau le fait passer de `signalé` à `en cours` puis à `résolu` ; chaque changement est
   horodaté et attribué à son auteur.
4. Les catégories sont administrables par le bureau, dans la limite de 10 ; la 11ᵉ est refusée avec
   un message explicite.
5. Supprimer une catégorie ne supprime pas les signalements déjà reçus dans cette catégorie.
6. L'adresse de routage d'une catégorie, renseignée puis relue, revient inchangée ; vide, elle se lit
   comme absente.
7. Modifier les adresses de notification dans les Réglages (s02) change les destinataires du
   signalement suivant.
8. Un signalement public est enregistré sans lien vers un membre, même si les coordonnées
   correspondent à celles d'un membre (aucun rapprochement).
9. Même limitation de débit que `/contact` (s08b).

### Décisions rendues par l'utilisatrice (30/09/2026)

- **L'adresse de routage de la catégorie sert aux signalements** : un signalement part à l'adresse
  de contact des Réglages **et** à l'adresse de sa catégorie si elle en porte une. Cela remplace la
  note agentique de la story (« `email_destination` n'est pas utilisé par les signalements ») et la
  phrase d'aide de la maquette (« Pour l'instant, cette adresse n'est pas utilisée… »). ADR 028.
- **Le réglage « Adresse du responsable forage » est conservé**, sans effet ; sa phrase d'aide dit
  qu'il n'est pas utilisé par l'application (tâche 8).

### Décisions tranchées par ce plan

**A. Modèle — ADR 028.** Trois tables scopées par RLS forcée :

- `association_category` — générique : `domain` (`'report'`), `name`, `routing_email` nullable,
  `deleted_at` nullable (suppression logique), index unique partiel sur
  `(organization_id, domain, lower(name)) where deleted_at is null`.
- `incident_report` — `category_id` **nullable** (`ON DELETE RESTRICT`), `location`, `description`,
  `reporter_name`, `reporter_email`, `reporter_phone` (tous trois nullables), `status`,
  `member_id` nullable **sans clé étrangère**, `notification_failed`, `created_at`. **Ni jsonb, ni
  colonne d'adresse** (même discipline que `contact_message`, ADR 025 : l'IP n'a nulle part où
  s'écrire).
- `incident_report_event` — l'historique : `report_id` (`cascade`), `status`, `author_user_id`
  nullable (`ON DELETE SET NULL`, `NULL` = « depuis le site »), `author_name` (copie du nom au moment
  du changement, pour que l'attribution survive à la suppression d'un compte), `created_at`.

**B. `member_id` nullable sans clé étrangère.** La note de la story veut le lien vers un membre
« nullable dès maintenant » pour s22 ; la fiche membre (s12) n'existe pas encore. La colonne est
posée, **aucun code ne l'écrit**, et s22 ajoutera la contrainte vers la table de s12 (une migration
de contrainte seule, sans réécriture de données). Le critère 8 prouve qu'elle reste `NULL`.

**C. Statuts** : texte fermé par le code, `reported` → `in_progress` → `resolved`, **dans cet ordre
seulement** (un bouton par statut, pas de réouverture, pas de saut direct à « résolu » — le design
ne les dessine pas). Le changement est un `UPDATE … WHERE status = <attendu> RETURNING` suivi de
l'insertion de l'événement, **dans la même transaction** : deux membres du bureau qui cliquent en
même temps ne produisent pas deux événements. Le perdant reçoit un état `stale` et la page se
recharge sur le statut réel.

**D. Formulaire sans catégorie (`1.H` de la maquette, retenu)** : si l'association n'a aucune
catégorie active, le champ disparaît et le signalement s'enregistre avec `category_id NULL`,
affiché « Sans catégorie ». Une fuite doit toujours pouvoir être signalée. S'il existe au moins une
catégorie, elle est obligatoire et **doit appartenir à l'association** (lue dans le scope du tenant :
un identifiant forgé d'une autre association n'est pas visible, donc refusé).

**E. Limiteur (critère 9)** : `consumeContactMessageQuotaService` **tel quel**, même usage
`contact.ip`, même seuil `contact.messages_per_visitor_per_hour` — c'est la décision G de s08b
(« un seul seuil pour tous les formulaires publics »), confirmée à la validation de s08b. Un visiteur
qui a écrit trois messages ne peut plus signaler dans l'heure, et inversement. `readVisitorIp`,
aujourd'hui fonction locale de `contact/actions.ts`, est **extraite** dans
`src/lib/helper/visitor-ip.ts` (`server-only`) et réemployée par les deux actions : recopier une
règle de sécurité (dernière entrée de `x-forwarded-for`, jamais la première) serait la dupliquer.

**F. Notification** : destinataires = `contact.email` (lu **à l'envoi**, critère 7) + `routing_email`
de la catégorie, dédupliqués sans tenir compte de la casse. **Un envoi par destinataire**, le contrat
`EmailTransport` n'est pas touché (précédent s08, décision B). `recipientType: 'system'`. Un échec
vers l'un des destinataires pose `notification_failed` et ne fait pas échouer la soumission : le
visiteur voit le même succès, le bureau voit le badge.

**G. Plafonds de longueur** : nom de catégorie 40 (compteur, comme la maquette) ; où 200 ;
description non vide après `trim`, 2 000 ; nom 120 ; email valide ; téléphone 30 caractères parmi
chiffres, espaces, `+ . - ( )`. Obligatoires : catégorie (si l'association en propose), où,
description. Les trois coordonnées sont facultatives, séparément.

**H. Pagination de la file** : 25 lignes, **25 cartes aussi en mobile** — même arbitrage que s08
(25/09) : pagination serveur, qui ignore la largeur d'écran. La maquette dessinait 10 cartes.

**I. Hors périmètre, dit et non comblé** : photo jointe, géolocalisation, suivi par le visiteur,
accusé de réception, commentaires, assignation, réouverture, suppression d'un signalement, recherche,
filtre « à traiter », export ; module activable (les signalements sont toujours actifs, comme le
contact) ; lien vers `/signaler` ailleurs que dans une page ou le pied de page écrits par le bureau
(le menu de s04b ne pointe que vers des pages CMS) ; retrait du réglage forage (story à part si un
jour on le veut).

## Tasks (ordered)

1. [x] **Modèle, migrations, RLS, registre d'actions, types de domaine** (ADR 028).
   - `src/db/models/association-category-model.ts`, `incident-report-model.ts` (les deux tables du
     signalement), enregistrés dans `src/db/models/db.ts`. Index `(organization_id, created_at desc)`
     sur `incident_report`, `(report_id, created_at)` sur l'événement, unique partiel sur la catégorie.
   - Migration du modèle par `pnpm db:generate`, **puis** policies par `drizzle-kit generate --custom`
     sur le patron `0025_water_analysis_rls.sql` : `ENABLE` + `FORCE` + `tenant_isolation` sur les
     trois tables. Jamais de SQL ni de journal écrits à la main.
   - ⚠️ **Rebaser sur `main` à jour avant de générer.** La dernière migration est `0025` ; s11 et s12
     peuvent en générer en parallèle. Si une autre branche a mergé avant, **régénérer** après rebase,
     jamais recoudre le journal.
   - `ActionIdConst.REPORT_MANAGE = 'report.manage'` (file, détail, statuts, catégories du domaine
     `report`), rôles `['owner', 'board']`.
   - `src/services/types/domain/incident-report-types.ts` et `association-category-types.ts` : DTO,
     constantes (`REPORT_STATUSES`, `CATEGORY_DOMAINS = ['report']`, `MAX_CATEGORIES_PER_DOMAIN = 10`,
     plafonds de la décision G, `INCIDENT_REPORTS_BUREAU_PAGE_SIZE = 25`). **Sans importer de modèle
     Drizzle.**
   - **Tests** : `report.manage` autorise `owner` et `board`, refuse `member` et un utilisateur hors
     association ; `src/db/rls-inventory.test.ts` passe avec les trois tables classées « scopées » ;
     `pnpm db:generate` ne produit plus de diff.

2. [x] **Catégories : validation, repository, service** (critères 4, 5, 6).
   - `src/services/validation/association-category-validation.ts` : nom `trim` non vide ≤ 40, adresse
     facultative — `''` ou espaces → `undefined`, sinon email valide.
   - `src/db/repositories/association-category-repository.ts`, **toujours `getDb()`** : liste des
     actives d'un domaine (tri par nom), lecture par id (actives ou non), création **sous
     `pg_advisory_xact_lock`** (compte puis insertion, ADR 028 §3), modification, suppression logique.
     L'adresse est écrite `NULL` quand elle est absente.
   - `src/services/association-category-service.ts` (+ façade et intercepteur) : `list`, `create`,
     `update`, `delete`, chacun `canPerformAction(..., REPORT_MANAGE)` avant tout accès ; la 11ᵉ lève
     une erreur métier dédiée (`CategoryLimitReachedError`) que l'action traduit ; le doublon de nom
     (violation de l'index unique) lève `DuplicateCategoryNameError`. Lecture publique des catégories
     actives (`listActiveReportCategoriesPublicService(organizationId)`) **sans autorisation**, pour
     le formulaire — le commentaire le dit.
   - **Tests** (`src/services/__tests__/association-category-service.test.ts`, DAO mockés) : rôles
     (`[ORGANIZATION OWNER]`, `[ORGANIZATION ADMIN]` passent ; `[ORGANIZATION MEMBER]`,
     `[USER NOT IN ORGANIZATION]`, `[PUBLIC]` → `AuthorizationError` **sans DAO appelé**) ; la 11ᵉ
     refusée ; `''` et `'   '` arrivent au DAO comme absents, une adresse renseignée arrive inchangée ;
     la suppression appelle la suppression logique, jamais un `delete`.

3. [x] **Signalements : repository et service** (critères 1, 2, 3, 5, 8).
   - `src/services/validation/incident-report-validation.ts` : schéma de service (décision G),
     transitions permises.
   - `src/db/repositories/incident-report-repository.ts`, **toujours `getDb()`** : création **avec
     son événement `reported` (auteur `NULL`) dans la même transaction** ; liste paginée
     `created_at desc, id desc` avec le nom de la catégorie (jointure, catégories supprimées
     comprises) et le drapeau `category_deleted` ; détail + historique ; changement de statut
     conditionnel + événement (décision C) ; marquage `notification_failed` ; comptes par statut pour
     la ligne `meta` de la file.
   - `src/services/incident-report-service.ts` (+ façade et intercepteur **`shouldLogDetails: () =>
     false`** : description et coordonnées sont des données personnelles) :
     - `createIncidentReportService({organizationId, locale, categoryId?, location, description,
       name?, email?, phone?})` — **sans autorisation, délibérément** (visiteur anonyme), sans IP, et
       **sans aucune recherche de membre ou de `user`** à partir des coordonnées (critère 8 : la
       signature n'a pas de paramètre membre, `member_id` n'est jamais écrit). Décision D pour la
       catégorie. Écriture → notification (tâche 4) → en cas d'échec, `notification_failed` +
       `logger.error`, soumission réussie.
     - `getIncidentReportsPageService`, `getIncidentReportService`,
       `changeIncidentReportStatusService(id, to)` — `REPORT_MANAGE` ; l'auteur est l'utilisateur
       authentifié (id + nom copié) ; transition non permise → `ValidationError` ; perdue sur une
       course → résultat `stale`.
   - **Tests** : rôles comme en tâche 2, `[PUBLIC]` **peut créer** mais ne lit rien ; statut initial
     `reported` et un événement ; `reported → in_progress → resolved` passent, `resolved → *`,
     `reported → resolved` et `in_progress → reported` refusés **sans écriture** ; l'événement porte
     l'auteur ; catégorie absente de l'association → rejet sans écriture ; aucune catégorie active →
     accepté sans catégorie ; un échec d'envoi laisse le signalement écrit et marque
     `notification_failed` ; le service de création **n'appelle aucun DAO de membre ni de `user`**
     (critère 8) ; validation invalide → ni écriture ni email.

4. [x] **Notification au bureau** (critères 1, 7 ; design écran 5 ; décision F).
   - Résolution des destinataires dans le service : `contact.email` lu par
     `getAssociationSettingsService` **à l'envoi**, + `routing_email` de la catégorie ; fonction pure
     `resolveReportRecipients(contactEmail, routingEmail)` qui déduplique sans casse et ignore
     l'absent.
   - `src/lib/emails/incident-report-email.tsx`, sur le patron de `contact-message-email.tsx` : en-tête
     teinté, titre « Nouveau signalement depuis le site », table Catégorie · Où · Reçu le · Signalé
     par · Email (`mailto:`) · Téléphone (`tel:`) — « non renseigné » pour une coordonnée absente —,
     description en encart avec retours à la ligne, bouton en table **doublé de l'URL en clair** vers
     `/bureau/signalements/{id}`, pied qui dit pourquoi l'email arrive. Couleurs **uniquement** depuis
     `src/lib/emails/theme.ts`, bloc sombre `prefers-color-scheme` + `[data-ogsc]`, `<Html
     lang={locale}>`.
   - `sendIncidentReportNotificationEmailService` dans `src/services/email-service.ts` : objet
     « {association} — Signalement : {catégorie} » (« … — Nouveau signalement » sans catégorie),
     **≤ 60 caractères** (catégorie tronquée au besoin), pré-en-tête ≤ 90, version texte complète,
     `recipientType: 'system'`. Libellés sous `email.report.notification`.
   - **Tests** : dédoublonnage (`Contact@x` / `contact@x` → un envoi ; adresse de catégorie absente →
     un envoi ; différente → deux) ; destinataire lu dans les paramètres, jamais `env.EMAIL_TO` ;
     rendu : `mailto:`, `tel:`, « non renseigné », URL en clair, aucune couleur hors `theme.ts`, bloc
     sombre ; objet ≤ 60 commençant par le nom de l'association ; un envoi en échec sur deux →
     `notification_failed`.

5. [x] **Formulaire public `/signaler`** (design écran 1 ; critères 1, 9).
   - `src/lib/helper/visitor-ip.ts` (`server-only`) : `readVisitorIp()` extraite de
     `contact/actions.ts`, qui l'importe désormais (décision E). Test unitaire de la règle (dernière
     entrée non vide de `x-forwarded-for`, sinon `x-real-ip`, sinon `undefined`) ; les tests
     existants de l'action de contact restent verts sans modification de leurs assertions.
   - `src/app/[locale]/(public)/signaler/` : `page.tsx` (catégories actives lues par la DAL publique
     `getActiveReportCategoriesDal`, **sans `'use cache'`** : la liste dépend du tenant du domaine et
     doit refléter une catégorie supprimée à la requête suivante), `report-form.tsx`,
     `report-form-validation.ts` (`createReportFormSchema(t)` partagé client/serveur), `actions.ts`.
   - Action publique, **sans `requireActionAuth()`** (commentaire, précédent `submitContactAction`),
     même ordre : locale → tenant → validation → **quota** (`consumeContactMessageQuotaService` +
     `readVisitorIp`) → façade. États `idle | invalid | sent | rate_limited` ; `sent` renvoie de quoi
     afficher la phrase de rappel (« Il pourra vous recontacter au … » / « Vous n'avez pas laissé de
     coordonnées… », `1.C` / `1.F`), jamais l'état de la notification.
   - Écran : bandeau 112 (`alert` neutre), `card`, champs dans l'ordre du design, `select` (règle §3.1 ;
     le `radio-group` suggéré par la maquette n'est pas retenu), « Vos coordonnées » facultatives
     (`autocomplete`, `inputmode`), bouton 56 px pleine largeur en mobile, erreurs aux trois signaux
     (résumé focalisé à liens d'ancrage, bordure 2 px, message sous le champ), chargement à largeur
     conservée, succès `alert` neutre `CircleCheck`, refus au seuil `alert` `destructive` avec le seuil
     interpolé et **texte saisi conservé** (`1.G`), formulaire sans catégorie (`1.H`, décision D).
   - `'signaler'` ajouté à `RESERVED_PAGE_SLUGS` **dans le même commit** (ADR 020) ; le test de
     `page-block-types` le couvre.
   - Libellés `ReportPage` dans `messages/fr.json`.
   - **Tests** (jsdom + action, façades mockées) : erreurs rendues sous le bon champ et liées par le
     résumé qui prend le focus ; succès neutre, deux variantes de phrase ; `rate_limited` conserve la
     saisie ; sans catégorie, le champ est absent ; l'action n'appelle ni le quota ni la façade sur
     une saisie invalide, et n'appelle pas la façade si le quota refuse ; l'IP n'est passée qu'au
     quota.

6. [x] **Back-office : file de suivi et détail** (design écrans 2 et 3 ; critères 2, 3, 5).
   - `src/app/dal/incident-report-dal.ts` : `cache()` + `withCurrentTenant`, sans `'use cache'`
     (donnée d'administration), `canManageCurrentReportsDal`.
   - `src/app/[locale]/(bureau)/bureau/signalements/page.tsx` et `[id]/page.tsx`, derrière
     `<Suspense>`, contrôle d'accès répété → `<BureauAccessDenied />` (patron `bureau/messages`).
   - File : `h1`, ligne `meta` des comptes (« 1 signalement à traiter · 1 en cours »), lien `outline`
     « Gérer les catégories », `table` dans une `card` : Catégorie (nom ; catégorie supprimée → nom +
     `meta` « catégorie supprimée » ; aucune → « Sans catégorie ») · Où (tronqué) · Signalé par (nom,
     sinon email, sinon téléphone, sinon « Anonyme ») · Reçu le (`data`) · Statut (badge + badge
     `destructive` « Notification non envoyée » sur la même ligne) · Action « Ouvrir le
     signalement ». Cartes empilées sous 640 px (décision H), état vide avec lien vers `/signaler`,
     `skeleton` au chargement.
   - Badges de statut (gap 1 du design, retenu) : **variantes existantes du composant `badge`** —
     « Signalé » `outline`, « En cours » `secondary`, « Résolu » `outline` en `muted-foreground` ;
     le mot porte l'information, aucune couleur nouvelle.
   - Détail : colonne `max-w-[68ch]`, retour, `h1` = catégorie + badge, `meta` de la date, sections Où,
     Ce qui a été signalé (retours à la ligne), Coordonnées (`mailto:`, `tel:`, ou « Aucune coordonnée
     laissée »), Suivi : **un seul bouton `default` selon le statut**, historique en liste ordonnée
     (date en `data` + phrase : « Signalé depuis le site », « Passé en cours par … », « Marqué comme
     résolu par … »). `alert` `destructive` si `notification_failed`, avec lien vers les Réglages.
   - `actions.ts` : `changeReportStatusAction` — `requireActionAuth()` → façade → `updateTag`/
     `revalidatePath` de la file et du détail ; `stale` → message « Ce signalement avait déjà changé de
     statut. » et rechargement.
   - Libellés `BureauReportsPage`.
   - **Tests** (jsdom, DAL mockée) : ordre rendu = ordre reçu ; « Signalé par » dans ses quatre cas ;
     catégorie supprimée affiche nom + mention ; deux badges sur une ligne ; un seul bouton selon le
     statut, aucun pour « résolu » ; historique dans l'ordre avec auteurs ; membre simple →
     `<BureauAccessDenied />` ; l'action refuse sans rôle et ne revalide qu'après succès.

7. [x] **Back-office : catégories** (design écran 4 ; critères 4, 5, 6).
   - `src/app/[locale]/(bureau)/bureau/signalements/categories/page.tsx` + `actions.ts` +
     composants dans `src/components/features/incident-report/`.
   - `breadcrumb`, `h1`, `meta` « N catégories sur 10 possibles. », bouton `default` « Ajouter une
     catégorie » **toujours actif** ; `table` Nom · Adresse de routage (ou « Aucune » en
     `muted-foreground`, jamais vide) · « Modifier ». `dialog` à deux champs (compteur 40 ; adresse
     « Facultatif » avec **la nouvelle aide** : « Les signalements de cette catégorie sont aussi
     envoyés à cette adresse, en plus de l'adresse de contact des Réglages. »), suppression par
     bouton `destructive` dans le `dialog` de modification puis `alert-dialog` qui dit que les
     signalements reçus sont conservés (avec leur nombre). Plafond : `alert` `destructive` ancré sous
     le titre (`4.E`). Doublon : message sous le champ nom (« Une catégorie porte déjà ce nom. »).
     Vide (`4.F`), mobile en cartes, `dialog` plein écran.
   - Actions `requireActionAuth()` → façade → revalidation de l'écran, de la file et de `/signaler`.
   - Libellés `BureauReportCategoriesPage`.
   - **Tests** (jsdom + actions) : « Aucune » pour une adresse absente, l'adresse telle quelle sinon ;
     la 11ᵉ rend l'`alert` du plafond ; le bouton d'ajout n'est jamais `disabled` ; l'`alert-dialog`
     annonce le nombre de signalements conservés ; erreurs du `dialog` (nom vide, email mal formé,
     doublon).

8. [x] **Barre latérale, seed, phrase du réglage forage, documentation.**
   - `bureau-sidebar.tsx` : « Signalements » dans le groupe « Le site », **après « Messages reçus »**,
     sans icône (gap 3). Libellé `BureauIdentityPage.nav.reports`.
   - `messages/fr.json`, `BureauSettingsPage.fields.forageEmail` (arbitrage du 30/09) : `help` →
     « Adresse non utilisée dans l'application. » ; `whenEmpty` → phrase neutre qui ne promet aucun
     envoi. `contactEmail.help` reste vrai (« … et les signalements »). Ajuster les tests de s02 **qui
     comparent ces deux textes**, et eux seuls.
   - Seed : `src/db/scripts/tenant-categories-seed.ts` (+ test, patron `tenant-settings-seed`) —
     TechCorp : « Fuite d'eau » (adresse `forage@techcorp-solutions.test`), « Voirie et chemins »,
     « Éclairage », « Nuisance » ; Marketing Pro : une catégorie propre, pour l'isolation. Valeurs
     fictives, jamais celles d'un client. Branché dans `src/db/scripts/seed.ts`.
   - `docs/architecture.md` : les trois tables dans le classement RLS (**recompter**, la garde
     `rls-inventory.test.ts` vérifie), le modèle de catégories générique (ADR 028), le formulaire
     `/signaler` dans le paragraphe des formulaires publics limités (même usage `contact.ip`).
   - `docs/design-system.md` : versement des gaps retenus — badges de statut d'un workflow (gap 1),
     historique d'un objet (gap 2), action refusée pour limite atteinte (gap 5).
   - **Tests** : le seed de catégories est déterministe et chaque tenant de test a les siennes ;
     `pnpm check:rules` passe.

9. [x] **Preuve e2e : `e2e/incident-report.spec.ts`** (patron `contact.spec.ts` / `rate-limit.spec.ts`,
   tenants A et B, boîte de sortie `file`, SQL direct, `extraHTTPHeaders` avec une IP par cas).
   - **Critères 1, 2** : un signalement « Fuite d'eau » sur A → succès à l'écran, ligne en tête de
     `/bureau/signalements` avec « Signalé », **deux emails** déposés (contact de A et adresse de la
     catégorie) ; une catégorie sans adresse → **un** email.
   - **Critère 3** : « Passer en cours » puis « Marquer comme résolu » → historique à trois lignes,
     auteur = le compte du bureau connecté, horodatage en SQL.
   - **Critères 4, 6** : ajout d'une catégorie avec adresse → relue identique à l'écran et en SQL ;
     sans adresse → « Aucune » et `routing_email IS NULL` en SQL ; à 10 catégories, la 11ᵉ est
     refusée avec le message.
   - **Critère 5** : supprimer une catégorie utilisée → le signalement reste dans la file avec son nom
     et « catégorie supprimée », la catégorie n'est plus proposée sur `/signaler`.
   - **Critère 7** : changer `contact.email` dans les Réglages → le signalement suivant part vers la
     nouvelle adresse.
   - **Critère 8** : signalement avec l'email exact d'un membre seedé de A → `member_id IS NULL` en
     SQL.
   - **Critère 9** : seuil réglé à 1 → le second signalement de la même IP est refusé, saisie
     conservée ; une autre IP passe ; et le compteur est **partagé** avec `/contact` (un message puis
     un signalement de la même IP → refus).
   - **Isolation** : le signalement et les catégories de A sont absents chez B, et la RLS refuse de
     les lire depuis le scope de B en SQL direct sous le rôle applicatif ; un `categoryId` de B soumis
     sur A est refusé.

## Files touched

**Créés**

- persistance : `src/db/models/association-category-model.ts`, `incident-report-model.ts`,
  `src/db/repositories/association-category-repository.ts`, `incident-report-repository.ts`,
  migrations `drizzle/migrations/00NN_*.sql` (modèle généré, policies en `--custom`) et instantanés ;
- domaine et services : `src/services/types/domain/association-category-types.ts`,
  `incident-report-types.ts`, `src/services/validation/association-category-validation.ts`,
  `incident-report-validation.ts`, `src/services/association-category-service.ts`,
  `incident-report-service.ts`, leurs façades et intercepteurs, erreurs métier dédiées, tests sous
  `src/services/__tests__/` ;
- email : `src/lib/emails/incident-report-email.tsx` (+ test) ;
- helper : `src/lib/helper/visitor-ip.ts` (+ test) ;
- DAL et écrans : `src/app/dal/incident-report-dal.ts`, `association-category-dal.ts`,
  `src/app/[locale]/(public)/signaler/*`, `src/app/[locale]/(bureau)/bureau/signalements/*`
  (liste, `[id]`, `categories`), `src/components/features/incident-report/*` (+ tests) ;
- seed : `src/db/scripts/tenant-categories-seed.ts` (+ test) ;
- e2e : `e2e/incident-report.spec.ts` ;
- documents de la story : `docs/research/s10-signalements-publics.md`,
  `docs/designs/s10-signalements-publics*` (brief, md, html, zip), ce plan, ADR 028.

**Modifiés**

- `src/db/models/db.ts`, `src/db/rls-inventory.test.ts` (si le décompte y est écrit),
  `src/services/types/domain/action-registry-types.ts`,
  `src/services/types/domain/page-block-types.ts` (`RESERVED_PAGE_SLUGS`),
  `src/services/email-service.ts`, `src/app/[locale]/(public)/contact/actions.ts` (import de
  `readVisitorIp`), `src/components/features/association/bureau-sidebar.tsx`, `messages/fr.json`,
  `src/db/scripts/seed.ts`, les tests de s02 qui comparent les textes du réglage forage,
  `docs/architecture.md`, `docs/design-system.md`.

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`)** : services par rôle (`rule-services-tests`, DAO mockés),
  validation, dédoublonnage des destinataires, transitions de statut, rendu de l'email, écrans en
  jsdom (DAL et façades mockées), actions (ordre validation → quota → façade), helper d'IP, seed.
  ⚠️ `/workspace` est sur un montage 9p lent : un timeout de worker n'est ni un échec ni un succès —
  relancer sur une copie en disque local.
- **E2E (Playwright, build de prod, base éphémère)** : `e2e/incident-report.spec.ts` couvre les neuf
  critères et l'isolation entre deux tenants — **la RLS n'est pas testable en unitaire**. Les specs
  `contact.spec.ts` et `rate-limit.spec.ts` restent verts (non-régression du limiteur et de l'IP
  extraite).
- Non testable automatiquement et laissé à la revue : l'atomicité du plafond sous vraie concurrence
  (le verrou est lisible dans le repository).

## Definition of Done

- Les neuf critères couverts par des tests verts, unitaires et `e2e/incident-report.spec.ts`,
  isolation entre deux tenants comprise.
- Trois tables à RLS **forcée**, classées dans `docs/architecture.md`, `rls-inventory.test.ts` vert ;
  aucun `withRlsBypass()` nouveau hors e2e.
- **Aucune adresse IP** en base ni dans un argument de service journalisé ; aucun rapprochement avec
  un membre ; `member_id` jamais écrit.
- Rien en dur : destinataires lus dans les Réglages et sur la catégorie, catégories en base (seed de
  test fictif), seuil du limiteur en paramètre, libellés dans `messages/fr.json`.
- Un seul limiteur, une seule règle de lecture d'IP (`visitor-ip.ts`), réemployés.
- `'signaler'` réservé dans `RESERVED_PAGE_SLUGS`.
- Aucune régression sur `/contact`, `/bureau/messages`, les Réglages de s02. Lint et types propres ;
  `pnpm db:generate` sans diff.
- Un seul commit de story sur `feature/s10-signalements-publics` (plus un pour les migrations si
  utile), PR unique ; revue `/ks-review` : `Ship allowed: yes`.

## Points à arbitrer avant validation

1. **Compteur du limiteur partagé avec `/contact`** (décision E) : c'est la conséquence directe de
   la décision G de s08b, validée. À renverser maintenant si on veut « 3 messages + 3 signalements »
   par heure : il faudrait un usage `report.ip` distinct (même seuil, compteur séparé).
2. **Formulaire sans catégorie** (décision D) : retenu comme la maquette le propose ; l'alternative
   était « formulaire indisponible tant qu'aucune catégorie n'existe ».
3. **`select` plutôt que `radio-group`** pour la catégorie : la règle §3.1 du design system est
   suivie ; le `radio-group` (gap 4 de la maquette) demanderait de modifier la règle.
