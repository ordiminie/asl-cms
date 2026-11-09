# Research — Story s22-signalement-membre

Recherche du 9 novembre 2026, sur `origin/main` à `eb32f209`, branche `feature/s22-signalement-membre`.
`docs/reviews/stories.md` : `Stories ready: yes`. Dépendances s10, s12, s12d : livrées (revues `Ship allowed: yes`).

## Target story

**Suivre son signalement depuis son espace** — complexité 2, story avec écran (pas encore de `docs/designs/s22-*`).
Un membre propriétaire déclare une fuite depuis son espace, sans ressaisir son identité, et suit le statut de ses
déclarations.

Critères d'acceptation :

1. Un membre connecté déclare un incident sans ressaisir son identité ; le bureau voit le déclarant dans la file de suivi.
2. Le membre voit la liste de **ses propres** déclarations avec leur statut à jour.
3. Un membre ne voit aucune déclaration d'un autre (test d'autorisation croisée).
4. Le changement de statut par le bureau est visible par le membre déclarant.
5. La notification email part vers **les mêmes adresses paramétrées** que le signalement public.

Notes agentiques qui contraignent : « même modèle et même workflow que s10 », le signalement porte un **lien nullable
vers un membre**, « si s10 a bien été conçue, cette story n'ajoute pas de table » ; **étendre la file du back-office
existante, ne pas en créer une seconde**. V5 §5.6 et CDCT §5.6 : « même formulaire/workflow que §4.3 », identité
transmise automatiquement, statut visible dans l'espace du déclarant, « liée au membre, pas anonyme ».

## Current state of the code

**Le modèle est déjà prêt à moitié, et ce n'est pas tout à fait ce que la story suppose.**

- `src/db/models/incident-report-model.ts` : table `incident_report` avec `member_id uuid` **nullable, sans clé
  étrangère**. Le commentaire du modèle dit : « `member_id` est posé sans clé étrangère et aucun code ne l'écrit : la fiche
  membre n'existe pas encore (s12) ; **s22 ajoutera la contrainte** ». La colonne existe depuis `0026_aspiring_retro_girl.sql`
  (ligne 21, `"member_id" uuid`). Aucune migration n'a ajouté de contrainte depuis.
  Vérifié : `grep memberId|member_id` sur `incident|report` ne trouve que le modèle, un commentaire du service
  (« `member_id` n'est jamais écrit (critère 8) ») et le test du service (`expect(input).not.toHaveProperty('memberId')`).
- Table `incident_report_event` : une ligne par changement de statut (`status`, `author_user_id`, `author_name`,
  `on_behalf_of_user_id`, `on_behalf_of_name`, `created_at`). Le premier événement est `reported` **sans auteur**
  (« depuis le site »).
- **Service** `src/services/incident-report-service.ts` : `createIncidentReportService` (public, **sans contrôle
  d'autorisation, délibéré**), `getIncidentReportsPageService` et `getIncidentReportService` (bureau, sous
  `ActionIdConst.REPORT_MANAGE`), `changeIncidentReportStatusService` (bureau), `canManageIncidentReportsService`.
  `notifyBoard` et `flagNotificationFailed` sont **non exportées**.
- **Repository** `src/db/repositories/incident-report-repository.ts` : `createIncidentReportTxnDao`
  (insère le signalement **et** son premier événement, `Pick` de 7 colonnes sans `memberId`),
  `getIncidentReportsPageDao`, `getIncidentReportByIdDao`, `listIncidentReportEventsDao`,
  `changeIncidentReportStatusTxnDao`, `markIncidentReportNotificationFailedDao`, deux comptages. **Aucune lecture filtrée
  par membre.**
- **DAL** `src/app/dal/incident-report-dal.ts` : trois fonctions, toutes pour le bureau, sans `'use cache'`.
- **Public** : `src/app/[locale]/(public)/signaler/{page.tsx, actions.ts, report-form.tsx, report-form-validation.ts}`.
  L'action `submitReportAction` enchaîne tenant → validation Zod (catégories offertes) → **quota de débit du visiteur** →
  `createIncidentReportService`. Le formulaire porte les champs `categoryId`, `location`, `description`, `name`, `email`, `phone`.
- **Bureau** : `src/app/[locale]/(bureau)/bureau/signalements/` (file, détail, catégories) et
  `src/components/features/incident-report/` (`incident-report-list.tsx`, `incident-report-detail.tsx`,
  `report-status-badges.tsx`). La file et le détail **lisent `reporterName`, `reporterEmail`, `reporterPhone`**
  (`incident-report-detail.tsx:177-199`, `incident-report-list.tsx:182-184`) : c'est le « déclarant » que voit le bureau.
- **Espace membre** : `src/app/[locale]/(app)/dashboard/page.tsx` → `<MemberSpace>` (cartes « Mes parcelles »,
  « Mes coordonnées »), service `src/services/member-space-service.ts`, DAL `src/app/dal/member-space-dal.ts` (sans cache).
- **Notification** : `sendIncidentReportNotificationEmailService` (`src/services/email-service.ts:812`), gabarit
  `src/lib/emails/incident-report-email.tsx` (lignes « Déclarant », « Email », « Téléphone » alimentées par
  `reporterName/Email/Phone`).

## Anchor points

| Besoin                                      | Où s'accroche s22                                                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lien déclarant → fiche                      | contrainte sur `incident_report.member_id` (migration par `pnpm db:generate`) ; cible à trancher, voir piège 1                                                  |
| Création côté membre                        | nouvelle fonction de service (ou paramètre) à côté de `createIncidentReportService`, qui résout la fiche **par la session et le domaine** comme `getMyParcelsService` |
| Lecture « mes déclarations »                | nouveau DAO filtré par `member_id` + service dans `member-space-service.ts` (ou `incident-report-service.ts`) → façade → `member-space-dal.ts` (sans `'use cache'`) |
| Écran du membre                             | carte sur `/dashboard` (`MemberSpace`) ou sous-route `/dashboard/…` ; formulaire de déclaration dans l'espace                                                  |
| File du bureau                              | `incident-report-list.tsx` / `-detail.tsx` : le déclarant y est déjà affiché via `reporter*`                                                                    |
| Notification                                | `notifyBoard` (non exportée) : à réutiliser, pas à dupliquer                                                                                                    |
| Seed et e2e                                 | `src/db/scripts/seed.ts` (étape 14 catégories de signalement), `tenant-member-profiles-seed.ts` (fiches avec compte : Moreau, Pommier), `e2e/incident-report.spec.ts` |

## Verified APIs / functions

- `getMemberProfileByUserIdDao(organizationId, userId): Promise<MemberProfileModel | undefined>` —
  `src/db/repositories/member-profile-repository.ts:297`. Nom, email, téléphone et adresse de la fiche s'y lisent ; le
  compte connecté a toujours un email (une fiche sans email n'a pas de compte, ADR 037).
- `getMyParcelsService(organizationId)` — `src/services/member-space-service.ts` : patron d'une lecture côté membre
  (`safeParse` → `getAuthUser()` → `AuthorizationError` sans session → `withTenant` → fiche par `userId`, **aucun
  identifiant de fiche en entrée**).
- `createIncidentReportTxnDao(input)` — accepte `organizationId, categoryId, location, description, reporterName,
  reporterEmail, reporterPhone` ; **n'écrit pas `memberId`** aujourd'hui.
- `createIncidentReportServiceSchema` (`src/services/validation/incident-report-validation.ts`) : `name`/`email`/`phone`
  facultatifs, `optionalContact` ; `location` ≤ 200, `description` ≤ 2000. Le schéma n'a **aucun champ `memberId`**.
- `changeIncidentReportStatusService({organizationId, reportId, to})` — transitions `reported → in_progress →
  resolved`, `stale` sur course perdue ; écrit l'événement avec `effectiveAuthor(viewer, impersonator)`.
- `resolveReportRecipients(contactEmail, routingEmail)` — `src/services/types/domain/incident-report-types.ts` : destinataires
  = `contact.email` **+** `routing_email` de la catégorie, dédupliqués. C'est « les mêmes adresses paramétrées » du critère 5.
- `ReportStatus` / `REPORT_STATUSES = ['reported','in_progress','resolved']`, `ReportStatusBadge`
  (`report-status-badges.tsx`, libellés dans `BureauReportsPage.status`).
- `consumeContactMessageQuotaService({organizationId, ip})` — `src/services/rate-limit-service.ts:182`, usage `contact.ip`.
- `effectiveAuthor`, `getActingContext()` — `impersonation-types.ts:27`, `auth-service.ts` : l'auteur d'une trace est le
  SuperAdmin quand il agit à la place d'un compte.
- Seed : `TEST_MEMBER_PROFILES` (`tenant-member-profiles-seed.ts`) donne des fiches avec compte (Moreau, Pommier — Pommier
  existe dans les **deux** tenants) ; les comptes sont posés par le seed (s12d).

## Traps & constraints

1. **La contrainte promise par le modèle vise `member_profile`, pas `member`.** Le commentaire date d'avant s12. Il existe
   deux « membres » : `member` (pivot Better Auth, plan identité, **exempté de RLS**) et `member_profile` (fiche métier,
   RLS forcée, ADR 029/037). Le lien doit pointer vers **`member_profile.id`**, la clé d'identité du produit
   (`AGENTS.md` : « Identité d'un membre : clé primaire arbitraire »). Pointer vers `member` ou vers `user.id` serait
   une erreur de modèle. Le modèle `member-profile-model.ts` est déjà importé par `parcel-model.ts` ; je n'ai pas vérifié qu'un import depuis `incident-report-model.ts` ne crée pas de cycle.
2. **Aucune ligne existante n'a de `member_id`** (le code ne l'a jamais écrit) : une contrainte de clé étrangère ne
   peut donc pas échouer sur des données existantes. Le comportement de suppression (`ON DELETE`) reste à choisir ; les
   précédents sont `RESTRICT` (`parcel_ownership`, pour qu'un historique ne disparaisse pas) et `SET NULL` (`user_id`).
   Aucune fonction de suppression de fiche n'existe aujourd'hui (`grep deleteMemberProfile` : rien).
3. **Le critère 8 de s10 reste vrai pour le public.** « Aucun rapprochement automatique » : le signalement public n'écrit
   jamais `member_id`, même si les coordonnées correspondent exactement à une fiche. Le test existant
   (`incident-report-service.test.ts:233`, `e2e/incident-report.spec.ts:788`) doit continuer de passer. Un membre connecté
   n'est donc pas un « rapprochement » : le lien vient de la **session**, jamais des coordonnées saisies.
4. **Le membre ne choisit jamais son identité ni son `member_id`.** La fiche se résout par `(organisation du domaine, compte
   de la session)`. Un `memberId` glissé dans l'entrée doit être retiré par Zod (c'est le patron d'`updateMyContactService`).
   Ce point porte aussi le test d'autorisation croisée du critère 3.
5. **Le déclarant affiché au bureau repose aujourd'hui sur `reporter_name/email/phone`.** Pour un signalement de membre,
   deux voies : recopier nom, email et téléphone de la fiche dans ces colonnes à la déclaration (instantané, comme
   `author_name` copie le nom « au moment du changement »), ou lire la fiche à l'affichage (jointure). Les deux ont un
   coût : la copie se périme si la fiche change (s16 permet au membre de changer son téléphone) ; la jointure change le
   DAO de la file et l'e-mail. Voir Open questions n° 3.
6. **Le DTO du bureau n'est pas celui du membre.** `IncidentReportListItemDTO` porte `reporterName/Email/Phone`,
   `notificationFailed`, `organizationId` ; `IncidentReportEventDTO` porte `authorName` (le nom du membre du bureau qui a
   fait avancer le dossier). Le membre n'a pas à voir `notificationFailed` (état interne de l'envoi au bureau) ; et les
   colonnes `on_behalf_of_*` (imitation, ADR 041) ne doivent **jamais** lui être servies. Un DTO propre au membre est à
   définir, dans `src/services/types/domain/` (la présentation n'importe rien de `src/db/models`).
7. **Notification : réutiliser `notifyBoard`, ne pas dupliquer.** Elle est privée au service ; elle lit le contact dans les
   réglages **à l'envoi** et la catégorie. Le critère 5 est tenu si le chemin membre passe par elle. Le gabarit d'email
   affiche « Déclarant / Email / Téléphone » à partir des champs `reporter*` : pour un membre, ce sont ceux de la fiche,
   sinon l'email dira « non renseigné » alors que l'identité est connue. Les textes de l'email sont dans l'espace
   `email.report.notification` de `messages/fr.json`.
8. **Les destinataires ne viennent pas du réglage « responsable forage ».** ADR 028 §6 : `forage.responsable.email`
   n'est lu par aucun code ; le routage d'une fuite vers le responsable passe par `routing_email` de la **catégorie**. Le
   critère 5 (« mêmes adresses paramétrées ») est donc la catégorie choisie + `contact.email`. CDCT §4.6 parlait encore du
   réglage : c'est l'ADR 028 qui prévaut.
9. **Catégories** : le membre doit choisir dans les catégories actives du domaine `report` (`getActiveReportCategoriesDal`),
   pas dans une liste en dur ; une catégorie d'une autre association est refusée (patron `resolveReportCategory`, lue dans le
   scope du tenant). Sans catégorie active, le signalement part sans (décision D de s10) ; avec, elle est obligatoire.
10. **Limiteur de débit** : le formulaire public consomme le quota du **visiteur** (IP hachée, usage `contact.ip`,
    compteur partagé avec `/contact`). Un membre connecté n'a pas d'IP exigée ni d'usage propre ; réutiliser ce compteur
    ferait compter un membre dans le seau des visiteurs. Voir Open questions n° 4.
11. **Cache Components** : donnée par utilisateur = **aucun `'use cache'`**, streamée derrière un `<Suspense>`
    (`member-space-dal.ts`, ADR 038). Le critère 4 (« statut à jour ») ne demande pas d'invalidation : sans cache, la
    lecture suivante voit le statut changé par le bureau. `changeReportStatusAction` revalide `REPORTS_ROUTE_PATTERN`
    (les pages du bureau) ; rien à ajouter côté membre tant que la lecture n'est pas cachée.
12. **Imitation (s48)** : un SuperAdmin qui agit à la place d'un membre et déclare un incident : la fiche liée serait celle
    du compte vu, mais l'auteur effectif de la trace est le SuperAdmin (`effectiveAuthor`). Le premier événement du
    signalement public est « sans auteur » ; celui d'un signalement de membre n'a pas de précédent. Voir Open questions n° 5.
13. **RLS et migration** : `incident_report` est déjà sous RLS forcée (`0027_incident_report_rls.sql`, policy sur
    `organization_id`) ; ajouter une contrainte de clé étrangère ne change pas la policy. `pnpm db:generate` produit la
    migration (jamais de SQL à la main, jamais d'édition du journal ni des snapshots). Dernière migration en place :
    `0039_burly_frank_castle.sql`.
14. **Isolation à prouver en e2e**, pas en unitaire (`db.ts` refuse la connexion en test) : `e2e/incident-report.spec.ts`
    a déjà un bloc « isolation entre associations » (lignes 896-1000) qu'il faut étendre à une déclaration de membre ;
    Pommier existe dans les deux tenants avec un seul compte, ce qui permet de prouver qu'une déclaration faite chez l'un
    n'apparaît pas chez l'autre.
15. **Tests existants à relire** : `incident-report-service.test.ts` (le test `not.toHaveProperty('memberId')` ne doit pas
    être cassé pour le chemin public), `incident-report-recipients.test.ts`, `incident-report-email-service.real-i18n.test.tsx`,
    `incident-report-list.test.tsx`, `incident-report-detail.test.tsx`, `member-space.test.tsx`.
16. **Route** : `/signaler` est un segment réservé aux pages publiques (ADR 020) et reste **public** ; le formulaire du
    membre vit dans l'espace connecté (`/dashboard`, protégé par le proxy via `AUTHENTICATED_SEGMENTS`). Ne pas protéger
    `/signaler` ni y brancher la session : le visiteur sans compte doit continuer à pouvoir signaler.
17. **Sans fiche, pas de déclaration de membre.** Un compte connecté sans fiche dans l'association (page de s46, état C5)
    ne peut pas être lié ; le comportement de ce compte n'est défini nulle part.
18. **Conventions de code** : français dans `messages/fr.json` (nouvel espace de noms à créer), fonctions de service
    validées par Zod puis autorisées, intercepteur `shouldLogDetails: () => false` pour tout service qui nomme un membre
    (précédent `member-space-service-logger-interceptor.ts`). Pas de `logger` dans un scope `'use cache'`.

## Open questions

À trancher au `/ks-plan`, ou à porter au `/ks-design` pour ce qui touche l'écran.

**Arbitrage du 9 novembre 2026 (V1, validé par Marie-Ève)** — les questions 4, 5, 6, 7 et 9 sont tranchées
pour la V1 par l'option la plus simple : pas de quota pour un membre connecté ; le membre voit le statut
courant et deux dates, sans historique ni nom du membre du bureau ; il ne peut ni modifier ni retirer un
signalement ; le bureau n'a qu'une mention textuelle « Membre » ; pas de notification du membre au changement
de statut ; un compte sans fiche n'a pas la carte. Les questions 1, 2, 3 et 8 restent à trancher au plan.

1. **Vers quoi pointe la clé étrangère de `member_id`, et avec quel `ON DELETE` ?** Recommandation de lecture, pas de
   décision : `member_profile.id` (voir piège 1). `ON DELETE` : `RESTRICT` (l'historique d'un signalement ne disparaît pas) ou
   `SET NULL` (le signalement redevient anonyme) ; aucune suppression de fiche n'existe encore, le choix engage une
   décision future.
2. **« Si s10 a bien été conçue, cette story n'ajoute pas de table. »** Vérifié : c'est vrai pour les **tables**, mais s22
   ajoute **une migration** (contrainte) et probablement un index sur `(organization_id, member_id)` pour la lecture « mes
   déclarations ». À confirmer au plan.
3. **Le déclarant est-il copié ou lu ?** Copier nom/email/téléphone de la fiche dans `reporter_*` (instantané, aucun
   changement de la file, du détail ni de l'email) ou lire la fiche (jointure, à jour). Le choix dit aussi ce que voit le
   bureau si le membre change son téléphone après coup (s16).
4. **Quota de débit pour un membre connecté ?** Aucun, le même compteur que les visiteurs, ou un compteur par compte ?
   Le critère ne le dit pas ; s08b ne couvre que « les formulaires publics ».
5. **Auteur du premier événement et imitation.** Le premier événement d'un signalement public est sans auteur. Pour un
   membre : sans auteur, ou le compte du membre (`author_name` = son nom) ? Et sous imitation, le SuperAdmin ou le compte vu ?
6. **Que voit le membre de l'historique ?** Seulement le statut courant et sa date, ou la chronologie complète
   (`reported` → `in_progress` → `resolved`) ? Faut-il afficher **le nom** du membre du bureau qui a changé le statut
   (`authorName`) ? Question de vie privée et d'écran.
7. **Un membre peut-il retirer ou compléter sa déclaration ?** Les critères disent « déclarer » et « suivre » : rien sur
   l'édition ni l'annulation. À ne pas inventer.
8. **Une déclaration de membre reste-t-elle rattachée au membre après la vente de sa parcelle ?** Le lien est à la fiche,
   pas à la parcelle (pas de colonne de parcelle sur `incident_report`) ; le signalement est donc rattaché au
   propriétaire déclarant, pas à une parcelle. À confirmer que la « localisation » libre suffit et qu'aucun lien parcelle
   n'est attendu.
9. **Le bureau distingue-t-il visuellement un signalement de membre d'un signalement public ?** « Le bureau voit le
   déclarant dans la file » : le nom suffit-il, ou un repère « membre » est-il attendu ? Gap de design possible
   (gap à reporter plutôt qu'à inventer, `AGENTS.md`).
10. **Où le membre déclare-t-il ?** Carte sur `/dashboard`, ou sous-page ? Le design de s22 n'existe pas ; le design de s10
    (`docs/designs/s10-signalements-publics.*`) fournit le formulaire et les badges de statut à composer, sans en inventer
    de nouveaux.
11. **Compte sans fiche** (piège 17) : message, redirection ou formulaire public ? À décider avec le design.
