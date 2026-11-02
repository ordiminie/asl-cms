---
validated: yes
---

# Plan — Story s48-connexion-a-la-place

Branch: `feature/s48-connexion-a-la-place`

Sources : `docs/research/s48-connexion-a-la-place.md` (lue sur `f63eb200`, symboles revérifiés sur
`8207f7e0`), design `docs/designs/s48-connexion-a-la-place.md` (+ `.html`, remis le 02/11),
ADR 041 et ADR 042 (écrites avec ce plan).

## Target story

**En tant que** SuperAdmin Zourite Studio **je veux** me connecter à la place de n'importe quel compte
d'une association, sans son mot de passe **afin de** réaliser en son nom une action qu'il ne peut pas
ou plus faire lui-même. Complexité 3. Dépendances : s03, s03c, s12d, s14, s46b, s47, toutes livrées.

Critères d'acceptation :

1. Depuis l'écran SuperAdmin des membres d'une association, un SuperAdmin choisit un compte et ouvre
   une session à sa place, sur le domaine de cette association, sans mot de passe ni lien magique ; il
   voit et fait exactement ce que ce compte voit et fait.
2. Une bannière permanente, sur toutes les pages, dit à la place de qui il agit et permet d'en
   sortir ; la sortie rend la session SuperAdmin d'origine.
3. Seul `super_admin` peut ouvrir une telle session, côté interface et côté serveur ; un compte
   `user` reçoit un refus, prouvé par un test, y compris par un appel direct à la route HTTP du plugin.
4. Pas d'imitation d'un autre SuperAdmin, pas d'enchaînement de deux sessions à la place.
5. Chaque ouverture et chaque sortie sont tracées (SuperAdmin, compte visé, association, horodatage) ;
   table scopée `organization_id`, RLS forcée, test d'accès croisé entre deux tenants.
6. Une écriture faite pendant la session est attribuée au SuperAdmin dans les traces existantes (au
   minimum `member_role_event` et `incident_report_event`), et la trace dit pour le compte de qui.
7. La session expire d'elle-même (durée paramétrée) et ne permet pas de changer le mot de passe,
   l'adresse email ni la double authentification du compte visé.
8. La table de trace entre dans l'inventaire des tables scopées (`docs/architecture.md`,
   `src/db/rls-inventory.test.ts`).

## Décisions de plan (questions de la recherche)

- **D1 — Chemin unique (Q2, piège 9)** : routes HTTP du plugin fermées, service + Server Action, trace
  écrite par le service. Le critère 3 se prouve par un 404 sur la route HTTP **et** par un refus du
  service pour un `user` (ADR 041).
- **D2 — Durée (Q1, Q10)** : variable `@/env` `IMPERSONATION_SESSION_DURATION_SECONDS`, défaut 1800
  (ADR 042). La bannière lit `session.expiresAt`.
- **D3 — Refus des écritures sensibles (Q3)** : plugin local `impersonationGuard()` (hook `before`)
  plus sections verrouillées de `/account`. Pas de refus de `/update-user` (nom, image) : seul
  l'email, le mot de passe et la 2FA sont visés par le critère.
- **D4 — `impersonatedBy` dans le cookie cache (Q4)** : prouvé en tâche 1 par le test Better Auth réel
  en mémoire, **avant** que la bannière en dépende. Si le cache ne le porte pas, le lecteur
  `getActingContext` lit la session avec `disableCookieCache`.
- **D5 — Déconnexion et expiration (Q5, pièges 7-8)** : non tracées, limites déclarées dans l'ADR 041.
  À l'expiration, la bannière (onglet ouvert) redirige par navigation pleine vers
  `/login/prestataire?session=terminee`. Écart au design : l'alerte 4c/4d ne cite **pas** le nom (pas de
  donnée personnelle dans une URL) : « La session à la place d'un compte s'est terminée. »
- **D6 — Forme de la table (Q7)** : `impersonation_event`, une ligne par événement, `kind`
  `opened | closed`, `session_id` copié pour relier les deux.
- **D7 — Colonnes de trace (Q6)** : `on_behalf_of_user_id` (`SET NULL`) + `on_behalf_of_name` sur
  `member_role_event` et `incident_report_event`. Les colonnes `updated_by` / `authorId` restent en
  l'état (dette déclarée, ADR 041).
- **D8 — Qui est listé (Q9)** : seules les lignes `member` avec compte du tableau actuel. Pas d'entrée
  depuis la fiche d'un membre.
- **D9 — Autre domaine (Q12)** : l'écran sait si l'hôte courant est celui de l'association visée
  (`requireCurrentTenantDal`). Si non, la boîte propose un lien vers
  `https://<domaine de l'association>/admin/organizations/<id>/edit`. Le service refuse en plus tout
  appel dont l'hôte n'est pas celui de l'association du compte visé (`wrong_domain`).
- **D10 — Atterrissage (Q13)** : à l'ouverture, `postLoginPathOf` du compte visé
  (`association-authorization.ts:57`) ; à la sortie, `/admin/organizations/<id>/edit?retour=1`
  (alerte 4a/4b). Ouverture et sortie rechargent la page entière (`window.location.assign`), jamais
  de navigation douce (piège 6).
- **D11 — Motif (Q14)** : champ facultatif, 200 caractères, stocké dans la ligne `opened`.
- **D12 — Notification du compte visé (Q8) et sort de s41 (Q15)** : hors périmètre ; s41 se réexamine à
  sa propre recherche.
- **D13 — Magenta de la bannière** : le design system n'a pas de token (gap n° 3 du design). Les deux
  valeurs maquettées sont posées **dans le composant**, pas dans `globals.css`, et le gap est inscrit
  au §9 du design system. Le contraste du texte blanc est mesuré à la tâche 6 et noté dans le design.

## Tasks (ordered)

1. [x] **Configuration Better Auth et preuves du plugin** : variable `IMPERSONATION_SESSION_DURATION_SECONDS`
       dans `src/env-schemas.ts` (+ `env.example`, README si la liste y figure) ; dans `auth.ts`,
       `impersonationSessionDuration` passé à `admin()` et les deux routes d'imitation ajoutées à
       `disabledPaths` (constante exportée à côté de `MAGIC_LINK_DISABLED_HTTP_PATHS`) ;
       `impersonationGuard()` (nouveau fichier `src/lib/better-auth/impersonation-guard.ts`, monté après
       `associationSessionGuard`). Tests, sur le harnais réel en mémoire de
       `email-verification-link.real-auth.test.ts` : un `user` reçoit 403 de `auth.api.impersonateUser` ;
       viser un `super_admin` donne 403 ; enchaîner une seconde imitation donne 403 ; le guard de
       domaine s'applique à la session imitée ; `stopImpersonating` rend la session d'origine ;
       `impersonatedBy` figure dans `getSession` et dans le cookie cache (D4) ; les routes HTTP rendent
       404 ; les chemins sensibles de D3 sont refusés pendant l'imitation et passent hors imitation.
       `auth.test.ts` (ordre des plugins, options d'`admin`) mis à jour.
2. [x] **Persistance** : `src/db/models/impersonation-event-model.ts` (patron
       `member-role-event-model.ts` : `organization_id` cascade, `kind`, `admin_user_id` / `admin_name`,
       `target_user_id` / `target_name`, `session_id`, `reason`, `created_at`, index
       organization + date) ; deux colonnes nullables « pour le compte de » sur
       `member-role-event-model.ts` et `incident-report-model.ts` (`incident_report_event`) ; export dans
       `src/db/models/db.ts` ; migrations par `pnpm db:generate`, puis la policy `tenant_isolation`
       par `drizzle-kit generate --custom` (patron `0036_member_role_event_rls.sql`) ; nouvelle ligne
       au classement de `docs/architecture.md` (37 tables, 18 scopées) et décomptes de
       `src/db/rls-inventory.test.ts`. Aucun SQL écrit à la main. DAO `insertImpersonationEventDao`
       dans `src/db/repositories/impersonation-event-repository.ts` ; DAO des deux traces existantes
       étendus aux nouvelles colonnes. Vérification : `rls-inventory.test.ts` vert.
3. [x] **Qui agit, et l'auteur effectif d'une trace** : `getActingContext()` dans
       `src/services/authentication/auth-service.ts` (à côté de `getAuthUser`, signature de celle-ci
       inchangée) rend `{user, impersonator?}` depuis `getSessionAuth().session.impersonatedBy` ;
       helper pur `effectiveAuthor(viewer, impersonator)` → `{authorUserId, authorName,
    onBehalfOfUserId, onBehalfOfName}` (colonnes « pour le compte de » nulles hors imitation).
       Branché dans `member-role-service.ts` (`applyDecision`, `presidentsToDemote` garde l'id du
       compte visé), `member-profile-service.ts` (`authorOf`), `organization-service.ts`
       (`traceMemberRemoval`) et `incident-report-service.ts` (`changeIncidentReportStatusService`).
       Tests : par écrivain, auteur = SuperAdmin et « pour le compte de » = compte visé en imitation ;
       hors imitation, colonnes nulles et auteur inchangé ; une passation de présidence en imitation
       rétrograde bien le compte visé. Les tests existants de ces quatre services restent verts.
4. [x] **Service d'ouverture et de sortie** : `src/services/impersonation-service.ts` + façade
       `impersonation-service-facade.ts` (avec intercepteur, patron des autres façades) + garde
       `canImpersonateAccount` dans `src/services/authorization/` (rôle global `super_admin` seul).
       `openImpersonationService({organizationId, userId, reason?})` : autorisation, Zod, hôte =
       association visée (`wrong_domain`), cible membre de l'association, ni `super_admin`, ni banni ;
       dans `withTenant(organizationId)`, appel de `auth.api.impersonateUser` puis ligne `opened`.
       `stopImpersonationService()` : lit `getActingContext`, appelle `auth.api.stopImpersonating`,
       ligne `closed`. Retours typés (`opened`, `forbidden`, `wrong_domain`, `target_not_found`,
       `target_is_admin`, `suspended`, `already_impersonating`, `not_impersonating`) ; aucun jargon.
       Tests unitaires avec Better Auth et DAO mockés : chaque refus, la trace écrite une seule fois,
       aucune trace si la session n'a pas pu s'ouvrir.
5. [x] **Point d'entrée dans le tableau des membres** : `MemberOrInvitationDTO` reçoit `hasAccount` et
       `isSuperAdmin` (lecture seule, pour l'affichage ; le serveur re-contrôle) ; Server Actions
       `openImpersonationAction` / `stopImpersonationAction` dans
       `src/app/[locale]/admin/organizations/actions.ts` (patron existant, `requireActionAuth` rôle
       `SUPER_ADMIN`, retour `{url}` pour que le client recharge en pleine page) ;
       `organization-members-table.tsx` (`adminView`) : bouton « Agir à sa place » (icône
       `UserRoundCog` + libellé), repli « Compte SuperAdmin : impossible » / « Pas encore de compte »,
       cartes empilées sous 640 px ; composant client `ImpersonationDialog` (`dialog`, ≤ 2 champs,
       variante autre domaine en lien, erreurs de D4 et du service) ; libellés dans `messages/fr.json`.
       Tests : `organization-members-table.test.tsx`, `actions.test.ts` (refus d'un non-SuperAdmin),
       test du dialogue (états défaut, envoi, erreur, autre domaine).
6. [x] **Bannière** : `src/components/features/impersonation/impersonation-bar.tsx` (client, compte à
       rebours des deux dernières minutes, `aria-live` poli puis assertif à l'entrée) et son
       emplacement serveur `ImpersonationBarSlot` derrière `<Suspense fallback={null}>`, placé dans
       `base-layout.tsx` **avant** `AlertBanner` ; il ne lit la session que si le cookie
       `*.admin_session` est présent (pas de lecture de session par page publique sinon). Contenu :
       compte visé, rôle, association, heure de fin (JetBrains Mono), bouton « Revenir à mon compte »
       (`stopImpersonationAction` puis `window.location.assign`), redirection à l'expiration (D5).
       Magenta en D13 ; contraste blanc/magenta mesuré et inscrit dans le design. Tests de composant :
       rendu, compte à rebours, sortie, absence de rendu hors imitation ; `base-layout` : ordre
       barre → bandeau d'alerte, aucune lecture de session sans cookie.
7. [x] **Verrouillage de `/account` et alertes de retour** : pendant l'imitation, les sections
       Mot de passe, Adresse email, Double vérification de `UserSecurityFactorSection` sont remplacées
       par la note `Lock` + « Revenir à mon compte » (écran 5) ; les actions de
       `src/components/features/user/action.ts` (`changePasswordAction`, `changeEmailAction`,
       `update2FAAction`, `verifyTotpAction`) refusent d'elles-mêmes en imitation (défense en
       profondeur, en plus du plugin) ; alerte « Vous êtes revenu à votre compte SuperAdmin. » sur
       l'écran des membres (`?retour=1`) ; alerte d'expiration sur `/login/prestataire`
       (`?session=terminee`). Tests : chaque action refuse en imitation et passe sinon ; rendu des
       sections verrouillées ; les deux alertes.
8. [x] **e2e Playwright** (`e2e/impersonation.spec.ts`, suite à un seul worker, jamais en local) :
       parcours SuperAdmin (`/login/prestataire`, domaine `localhost`) ouvre une session à la place d'un
       membre du seed, voit la bannière sur le site public, l'espace membre et le bureau, sort et
       retrouve l'écran des membres ; **accès croisé** : une ligne `impersonation_event` de B est
       invisible sous le tenant A ; un compte `user` (Bureau comprise) est refusé par la Server Action
       et par l'appel direct à `POST /api/auth/admin/impersonate-user` (404) ; **attribution** : une
       passation ou un changement de statut fait en imitation donne dans la base un auteur
       SuperAdmin et un « pour le compte de » égal au compte visé ; section mot de passe verrouillée.
9. [x] **Documentation** : ADR 041 et 042 relues et listées ; `docs/design-system.md` : gaps du design
       inscrits (§9 : deux actions par ligne → §3.5, variante `alert` muted, magenta, bannière mobile,
       compte à rebours, bouton-lien) et §2.6 complété (la barre sert aussi à s48) ;
       `docs/architecture.md` (classement RLS, mention du chemin unique) ; `docs/stories.md` : note de
       s48 sur l'écart de l'alerte d'expiration (sans nom). Vérification : `pnpm check:rules`.

## Files touched

- Config : `src/env-schemas.ts`, `env.example`, `src/lib/better-auth/auth.ts`,
  `src/lib/better-auth/impersonation-guard.ts` (+ test), `auth.test.ts`,
  `src/lib/better-auth/impersonation.real-auth.test.ts`.
- Persistance : `src/db/models/impersonation-event-model.ts`, `member-role-event-model.ts`,
  `incident-report-model.ts`, `db.ts`, `drizzle/migrations/*` (générées), `src/db/repositories/`
  (nouveau DAO + deux existants), `src/db/rls-inventory.test.ts`.
- Services : `src/services/authentication/auth-service.ts`, `impersonation-service.ts`,
  `facades/impersonation-service-facade.ts` (+ intercepteur), `authorization/`,
  `member-role-service.ts`, `member-profile-service.ts`, `organization-service.ts`,
  `incident-report-service.ts`, `types/domain/organization-types.ts`, `types/domain/impersonation-types.ts`.
- Présentation : `src/app/[locale]/admin/organizations/actions.ts`,
  `src/components/features/organization/organization-members-table.tsx`,
  `src/components/features/impersonation/*`, `src/app/[locale]/base-layout.tsx`,
  `src/components/features/user/action.ts` et `user-security-factor-section`,
  `src/app/[locale]/(auth)/login/prestataire`, `messages/fr.json`.
- Tests : unitaires colocalisés, `e2e/impersonation.spec.ts`.
- Docs : `docs/architecture.md`, `docs/design-system.md`, `docs/stories.md`, ADR 041 et 042.

## Test strategy

- **Unitaire (Vitest)** : le contrat Better Auth se prouve sur le **harnais réel en mémoire**
  (tâche 1), pas sur des mocks : c'est lui qui dit ce que la version 1.7.1 fait vraiment. Les services
  se testent avec Better Auth et les DAO mockés (tâches 3, 4). Les composants de la tâche 5, 6 et 7 en
  jsdom. Chaque refus a son test ; un test nominal sans test de refus ne compte pas.
- **RLS** : non testable en unitaire (`db.ts` refuse la connexion en test) ; l'isolation de
  `impersonation_event` est un e2e d'accès croisé (tâche 8), l'inventaire un test unitaire.
- **e2e** : en CI sur GitHub uniquement (machine trop juste en local), contre le build de production.
- **Preuves exigées par les critères** : 3 (403 `user`, 404 route HTTP), 4 (403 SuperAdmin visé, 403
  enchaînement), 5 (accès croisé), 6 (auteur SuperAdmin en base), 7 (refus explicite des quatre
  écritures sensibles + expiration par `expiresAt`).
- `pnpm test --run` pour toute exécution non interactive.

## Definition of Done

- Une seule PR, un seul commit de story (plus un commit séparé pour la migration si on veut pouvoir
  la revenir seule), description structurée, diff lisible.
- Tests verts sur la logique métier ; aucun test existant cassé (`auth.test.ts`,
  `association-session-guard.test.ts`, `organization-members-table.test.tsx`, `actions.test.ts`,
  `rls-inventory.test.ts`).
- Migrations générées par `pnpm db:generate` (jamais écrites à la main), job « migrations sur la base
  de `main` » (ADR 035) vert ; `.env` : nouvelle variable annoncée dans la PR.
- `withRlsBypass` : aucune nouvelle occurrence.
- Revue passée (`Ship allowed: yes`), aucun point critique ouvert ; déploiement en production après
  fusion, selon la stratégie de ship (manuelle).

## Alertes de découpage

Neuf tâches, complexité 3 : sous le seuil, pas de découpage. Si la tâche 3 (quatre écrivains de
trace) s'avère plus large que prévu à l'exécution, la scinder en « lecteur + helper » puis « branchement
des écrivains », mais ne pas répartir sur deux PR.
