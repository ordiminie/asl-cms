---
validated: yes
---

# Plan — Story s46-comptes-herites-minimum

Branch: `feature/s46-comptes-herites-minimum`, **créée depuis le `main` local** (`038546d` ou plus
récent), qui porte la scission s46 / s46b, la revue du découpage et l'en-tête de l'espace membre du
design system (§3.12). `origin/main` est en retard de ces commits de cadrage : les pousser, ou créer
la branche depuis le `main` local.

Entrées : recherche `docs/research/s46-comptes-herites-minimum.md` (2026-10-13, écrite **avant** la
scission : seule sa partie « compte » concerne cette story), design
`docs/designs/s46-comptes-herites-minimum.md` + `.html`, design system §1.6, §2.1, §2.7, §3.12.

## Target story

Un membre du bureau ne voit plus, dans son compte, que sa sécurité. `/dashboard` devient l'espace
membre vide que s12d remplira. **La connexion ne change pas** : destination `/dashboard` pour tous,
`/register` conservé, aucun contrôle de domaine — tout cela est s46b.

Critères d'acceptation (condensés, voir `docs/stories.md`) :

1. `/account` ne propose que la sécurité (email, mot de passe, double authentification, sessions) ;
   `/account/settings`, `/account/api-keys`, `/account/notifications`, `/account/organizations/…`,
   `/account/invitations/…`, `/account/billing/…` et `/team/…` répondent 404 ; aucun menu n'y renvoie.
2. `/dashboard` = espace membre : le nom de l'association et un lien vers `/account`, rien du tableau
   de bord du boilerplate ; sans session, redirection vers la connexion.
3. Sur le domaine d'une association, le menu de `/admin` propose au SuperAdmin un lien vers `/bureau`,
   qui s'ouvre sans nouvelle connexion.
4. `apikey`, `organization`, `invitation`, `subscription`, `notifications` et `settings` quittent
   `NEXT_PUBLIC_ENABLED_PAGES` (schéma, `.env.development`, CI).
5. `DEFAULT_LOCALE` de `src/lib/helper/date-helper.ts` vaut `fr`, vérifié par un test.
6. Aucune règle (ni copie `.cursor`) ni note de story ne cite un écran ou un fichier retiré ; notes de
   s16 rebranchées ; `pnpm check:rules` passe.

## Décisions de plan

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Pourquoi / voie de retour                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Retrait par suppression**, pas par masquage : routes, composants, hooks, DAL et tests qui ne servent qu'aux écrans retirés. **Conservés** : `features/organization/*`, `organization-dal`, `subscription-dal`, `organization-helper`, `AppBreadcrumb`, `date-helper`, `notification-service`, `updateUserSettingsAction` et `user_settings.twoFactorType` (la double authentification s'en sert).                                                                                                                                                                                                                                                                                      | Inventaire vérifié par la recherche (« Ce qui ne doit pas partir »). Aucune migration : tables `apikey`, `user_settings`, `notifications`, `invitation` intactes. Voie de retour : `git revert`, ou `upstream/main` (ADR 009).                                                                                                     |
| B   | **Coquille de l'espace membre neuve** (§3.12) : `(app)/layout.tsx` ne monte plus `AuthProvider`, `OrganizationProvider`, `OrganizationSync`, `SidebarProvider`, `AppSidebar`, `AppBreadcrumb`, `QuickFeedbackButton`. Il rend l'en-tête (`<AssociationMark size="public" />` + « Se déconnecter »), le lien d'évitement et `<main id="contenu">` dans `max-w-[1000px]`.                                                                                                                                                                                                                                                                                                                  | Le design system interdit la barre latérale côté membre ; aucun écran conservé de `(app)` ne lit `useAuth` ni `useOrganization` (vérifié : les formulaires de sécurité n'en dépendent pas). Le layout reste sans `await` de session (règle `rule-safe-route`) : le tenant est déjà résolu, en bloquant, par `[locale]/layout.tsx`. |
| C   | **`OrganizationProvider` et `OrganizationSync` supprimés** (sans consommateur après le retrait) avec leur test ; `rule-safe-route.md` et `rule-react-cache-next-cache.md` prennent `AuthProvider` (encore monté par `admin/layout.tsx`) comme exemple de « un provider ne suspend jamais ».                                                                                                                                                                                                                                                                                                                                                                                              | Un exemple de règle qui pointe un fichier absent échoue à `check:rules`. `activeOrganization` de `getCurrentUserDal` reste, inoffensif.                                                                                                                                                                                            |
| D   | **« Se déconnecter » réutilise `LogoutButton`** (`logoutAction` + rechargement complet), qui reçoit la variante `outline` et l'icône `LogOut` + libellé. Les autres appelants gardent leur rendu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Le rechargement complet est déjà justifié dans le composant (Cache Components). Pas de deuxième chemin de déconnexion.                                                                                                                                                                                                             |
| E   | **`QuickFeedbackButton` supprimé** avec son action et son test. `/admin/submissions` reste et lit les retours déjà enregistrés.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Seul importeur : la coquille `(app)`, que le design ne garde pas (§3.12 : rien d'autre que l'identité et la déconnexion).                                                                                                                                                                                                          |
| F   | **`/team` quitte `AUTHENTICATED_SEGMENTS`** : plus aucune route ne le sert. `/team/x` répond donc 404 avec ou sans session ; `robots.txt` cesse de l'interdire.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Liste unique proxy + `robots.txt` (s11, décision D) : un segment mort ne s'y déclare pas. `/account` et `/dashboard` restent protégés.                                                                                                                                                                                             |
| G   | **Lien `/admin` → `/bureau/pages`** : `admin/layout.tsx` (déjà bloquant) lit `getCurrentTenantDal()` et passe `{name}` à `AdminSidebar`. L'entrée « Back-office de l'association » (`Landmark`, nom en `meta`, `tooltip` + `aria-label` replié) **remplace** « Application (front office) » et son menu déroulant de `nav-application.tsx`, qui listait cinq écrans retirés. Sans tenant, l'entrée n'est pas rendue. L'entrée vise `/bureau/pages`, première entrée de `BureauSidebar` : `/bureau` n'a pas de page (le segment n'a que des sous-dossiers et tombe sur la route CMS `(public)/[slug]`, « Page non trouvée ») ; la destination de `/bureau` lui-même est décidée par s46b. | Dans les faits, tout domaine qui sert l'application est provisionné (`[locale]/layout.tsx`, ADR 003) : le cas « sans tenant » du design (3c) n'est pas atteignable, mais la prop optionnelle le couvre sans coût et se teste. Même hôte, même cookie : aucune reconnexion.                                                         |
| H   | **Plugin `apiKey()` retiré** (serveur `auth.ts` et client `auth-client.ts`), **`bearer()` gardé**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Sans écran ni consommateur, `apiKey()` expose encore `/api/auth/api-key/*` à tout compte connecté. La table reste. `bearer()` touche la session de toutes les requêtes : son sort relève de l'authentification (s46b), pas d'ici.                                                                                                  |
| I   | **Invitation d'organisation de Better Auth laissée en l'état** : `sendInvitationEmail` (`auth.ts:164`) et `notification-service.ts:239` pointent vers `/account/invitations`, désormais 404.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Plus aucun écran ne crée d'invitation (le seul formulaire qui l'envoyait vivait sous `/account/organizations` ; `/admin` ajoute les membres directement). **Dette notée** pour s46b/s47 : le point d'entrée Better Auth `organization/invite-member` reste ouvert par l'API.                                                       |
| J   | **Le lien Stripe `callbackURL '/account/billing/subscription'`** (`stripe-events.ts:342`) n'est pas touché ici : la branche « achat invité » qui le porte est retirée par s46b (critère 3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Éviter de toucher deux fois le webhook.                                                                                                                                                                                                                                                                                            |
| K   | **Aucun ADR** : aucune décision structurelle nouvelle. L'en-tête de l'espace membre est déjà acté au design system (§3.12, `038546d`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                                                                                                                                                                  |

## Tasks (ordered)

Les e2e ne tournent qu'en CI (consigne du dépôt) : la tâche 1 les écrit d'abord, leur « rouge » est
établi par lecture ; l'exécuteur les valide par `tsc`, ESLint et Prettier, la CI par exécution. Les
tests unitaires, eux, s'exécutent rouges puis verts (`pnpm test --run <fichier>`, sur copie en disque
local si le montage `/workspace` provoque des délais de workers).

1. [x] **Épreuves e2e d'abord.** Nouveau `e2e/account-legacy-routes.spec.ts`, sur `TENANT_A`
       (`http://localhost`) et `TENANT_B` (`http://127.0.0.1`), comptes du seed connectés par mot de
       passe (`user@gmail.com` membre de A ; `superadmin@gmail.com`) — **pas `admin@gmail.com`**, que
       s47 retire :
       (a) connecté, chaque adresse retirée répond **404** : `/account/settings`, `/account/api-keys`,
       `/account/notifications`, `/account/notifications/x`, `/account/organizations`,
       `/account/organizations/x`, `/account/invitations`, `/account/invitations/x`,
       `/account/billing/subscription`, `/team/x` ; sans session, `/team/x` répond aussi 404 ;
       (b) `/account` : `h1` « Sécurité du compte », lien « Revenir à mon espace » vers `/dashboard`,
       aucune barre latérale (`[data-sidebar]` absent) ;
       (c) `/dashboard` : `h1` « Votre espace membre », nom de l'association de A dans l'en-tête, lien
       « Gérer la sécurité du compte » vers `/account`, aucun texte du tableau de bord hérité
       (« Total Revenue », « Subscriptions », etc.), aucune barre latérale ; même écran pour le
       SuperAdmin ; sans session, redirection vers `/login` ;
       (d) « Se déconnecter » sur `/dashboard` : retour à `/login`, puis `/dashboard` redirige vers
       `/login` ;
       (e) aucun lien de `/dashboard`, `/account` ni de la barre de `/admin` ne vise une adresse
       retirée (motif `^/(account/(settings|api-keys|notifications|organizations|invitations|billing)|team)(/|$)`) ;
       (f) SuperAdmin sur `/admin` de A : l'entrée « Back-office de l'association » porte le nom de A,
       mène à `/bureau/pages` (titre « Pages » et barre du bureau visibles, pas de « Page non trouvée ») **sans passer par `/login`**, et « Application (front office) » a disparu.
       **Mises à jour** : `e2e/smoke-authenticated.spec.ts` (`USER_ROUTES` réduit à `/dashboard` et
       `/account`, `TEAM_ROUTES` retiré), `e2e/authorization.spec.ts` (bloc « Changement
       d'organisation », qui pilote la barre latérale et le `TeamSwitcher`, retiré ; « atteint son
       espace » l. 66-71 conservé), `e2e/seo.spec.ts` (l. 252-256 : `/team` n'est plus interdit par
       `robots.txt`).

2. [x] **Retirer les écrans du compte hérité et leur code orphelin.** Supprimer sous
       `src/app/[locale]/(app)/` : `account/settings`, `account/api-keys`, `account/notifications/*`,
       `account/organizations/*`, `account/invitations/*`, `account/billing/*`, `team/[slug]`. Supprimer
       ensuite ce qui n'a plus d'importeur (vérifier chaque fichier par `grep` avant de le supprimer) :
       `features/api-key/`, `features/notifications/*`, `app/dal/notification-dal.ts`,
       `hooks/use-unread-notifications.ts`, `team-switcher.tsx`, `features/team/`,
       `hooks/use-subscription.ts`, `features/subscription/limit-reached.tsx`,
       `features/user/edit-user-settings.tsx` (et son test), avec leurs tests et ceux qui les mockent.
       Retirer le plugin `apiKey()` de `auth.ts` et son pendant client (décision H). Retirer de
       `messages/fr.json` les espaces de noms qui n'ont plus de lecteur (`ApiKeysPage`,
       `AccountSettingsPage`, `Invitations`, `AcceptInvitation`, `Notifications`, `NotificationsPage`,
       `Subscription`, `TeamPage`, `TeamSwitcher`, `LimitReached`), **après grep de chaque clé** ;
       `Organizations` et `Organization` restent (partagés avec `/admin`).
       Vérification : `tsc --noEmit` propre, `pnpm lint` propre, `pnpm test --run` vert.

3. [x] **`/team` hors des segments authentifiés** (décision F). `authenticated-segments.ts` ; tests
       `src/proxy.test.ts` (l'`it.each` prend `/account` au lieu de `/account/settings` comme exemple
       protégé, et `/team/x` n'est plus redirigé) et `src/app/robots.test.ts` (l. 4, 39, 71, 112).
       Test d'abord : les deux fichiers rouges, puis verts.

4. [x] **Familles de `NEXT_PUBLIC_ENABLED_PAGES`.** Retirer `apikey`, `organization`, `invitation`,
       `subscription`, `notifications`, `settings` de `EnabledPageSchema` (`src/env-schemas.ts`) et de
       `PagesConst` (`src/env.ts`), puis de `.env.development`, `.github/workflows/ci.yml` (l. 44) et
       `scripts/init-env.ts` (l. 138-147, 268-270). Restent `none`, `account`, `admin`. Test d'abord :
       `src/env-schemas.test.ts` (l. 93-115) épingle les trois familles restantes et refuse une famille
       retirée. Les derniers appels `isPageEnabled(PagesConst.SETTINGS…)` (menus) partent en tâches 5
       et 8. `.env.test` et `.env.local` ne sont pas suivis par git : les signaler dans le résumé
       d'exécution pour mise à jour locale.

5. [x] **Coquille de l'espace membre** (décisions B, C, D, E ; design écran 0, design system §3.12).
       Réécrire `src/app/[locale]/(app)/layout.tsx` : lien « Aller au contenu » en premier, en-tête
       (`<AssociationMark size="public" />` lien vers `/`, `LogoutButton` en `outline` avec `LogOut` +
       « Se déconnecter », 48 px / 56 px mobile), filet `border`, `<main id="contenu">` dans
       `max-w-[1000px]`, marges 16 px sous 1 024 px ; nom de l'association en deux lignes au plus sur
       mobile, bouton jamais réduit. Titre de métadonnées « Espace membre », `noindex` conservé.
       Supprimer `app-sidebar.tsx`, `nav-user.tsx` (et son test), `sidebar-skeleton.tsx` s'il n'a plus
       d'importeur, `quick-feedback-button.tsx`, `quick-feedback-action.ts` (et son test),
       `context/organization-provider.tsx`, `context/organization-sync.tsx`,
       `context/__tests__/organization.test.tsx`. Mettre à jour `noindex-layouts.test.ts` (mocks).
       Test d'abord (`(app)/layout.test.tsx`, nouveau) : le lien d'évitement vise `#contenu`, le nom de
       l'association est rendu, le bouton « Se déconnecter » est présent, aucun élément de barre latérale.

6. [x] **Espace membre `/dashboard`** (design écran 1). `dashboard/page.tsx` garde `withAuth` et rend
       `h1` « Votre espace membre », puis une `card` « Sécurité du compte » : « Votre adresse email,
       votre mot de passe et les appareils connectés à votre compte. » et le lien souligné « Gérer la
       sécurité du compte » vers `/account` (cible 48 px / 56 px mobile). **Aucune phrase sous le
       titre**, aucune lecture de donnée du membre. Libellés dans `messages/fr.json` (espace de noms
       `MemberSpacePage`), l'ancien `Dashboard` retiré. Supprimer `features/dashboard/`. Test d'abord
       (`dashboard/page.test.tsx`) : titre, carte, lien vers `/account`, aucun texte hérité.

7. [x] **Sécurité du compte `/account`** (design écran 2). `account/page.tsx` : lien « Revenir à mon
       espace » (`ArrowLeft` + libellé) vers `/dashboard`, `h1` unique « Sécurité du compte », chapeau
       « Votre adresse email, votre mot de passe et les appareils connectés à votre compte. » ; le `h2`
       « Sécurité » et l'ancienne description partent. Titres de carte dans `messages/fr.json` :
       `changeEmail.title` « Adresse email », `changePassword.title` « Mot de passe »,
       `twoFactor.title` « Vérification en deux étapes », `listTokens.title` « Appareils connectés ».
       Les formulaires ne changent pas. Test d'abord : `account/page.test.tsx` mis à jour (titre, lien
       retour, absence de « Mon Compte »).

8. [x] **Menu de `/admin`** (décision G ; design repère 3). `admin/layout.tsx` passe
       `association={tenant ? {name: tenant.name} : undefined}` à `AdminSidebar` ; `appNavMain` et
       `nav-application.tsx` deviennent l'entrée « Back-office de l'association » (`Landmark`, nom en
       sous-libellé `meta` tronqué, lien `/bureau/pages` (`/bureau` n'a pas de page ; s46b décide de sa destination), `tooltip` et `aria-label` « Back-office de
       l'association {nom} » en barre repliée), groupe absent sans association. `nav-user-admin.tsx`
       perd l'entrée `/account/settings` (garde « Mon compte » → `/account` et la déconnexion). Test
       d'abord (`admin-sidebar.test.tsx`) : entrée et nom présents avec association, groupe absent
       sans, aucun lien vers une adresse retirée.

9. [x] **Dates en français.** `src/lib/helper/date-helper.ts` : `DEFAULT_LOCALE = 'fr'`, repli de la
       table sur `fr` au lieu d'`enUS`, docstring corrigée (ADR 008, locale unique). Test d'abord
       (`date-helper.test.ts`, nouveau) : `formatDate` et `formatDistanceToNowLocalized` **appelés
       sans locale** rendent du français (nom de mois français, « il y a »).

10. [x] **Règles, notes et contrôle.** Remplacer dans `.claude/rules/` les exemples retirés :
        `rule-form-front.md:51` et `rule-form-front-and-back.md:56` (`edit-user-settings.tsx` →
        `src/components/features/member-profile/member-profile-form.tsx`, formulaire RHF + Zod + Server
        Action conservé) ; `rule-translation.md:112, 138` et `rules-ux-pagelayout.md:87, 212`
        (exemples `account/settings` et `edit-user-settings` → mêmes fichiers de remplacement ou
        `account/page.tsx`) ; `rule-safe-route.md:62-70, 85` et `rule-react-cache-next-cache.md:138-140`
        (exemple `AuthProvider`, décision C). Ajouter à `STALE_PATTERNS` de `scripts/check-rules.ts` un
        motif « retiré par s46 » (`edit-user-settings`, `account/(settings|api-keys|notifications|organizations|invitations|billing)`,
        `team-switcher`, `TeamSwitcher`, `OrganizationSync`, `OrganizationProvider`, `features/api-key`,
        `features/dashboard`, `use-subscription`, `quick-feedback`). Régénérer `.cursor/rules/` par
        `pnpm check:rules:fix`. Rebrancher la note de **s16** (`docs/stories.md`, l. 1669-1671) sur
        `member-profile-form.tsx` / `member-contact-fields.tsx` (même modèle, saisi par le bureau en s12).
        Vérification : `pnpm check:rules` passe, et `grep` des motifs ci-dessus ne trouve rien dans `src/`,
        `.claude/rules/`, `.cursor/rules/`.

## Files touched

**Supprimés** — `src/app/[locale]/(app)/` : `account/settings/`, `account/api-keys/`,
`account/notifications/`, `account/organizations/`, `account/invitations/`, `account/billing/`,
`team/` · `src/components/` : `features/api-key/`, `features/dashboard/`, `features/notifications/`,
`features/team/`, `features/subscription/limit-reached.tsx`, `features/user/edit-user-settings.tsx`
(+ test), `features/quick-feedback-button.tsx`, `features/quick-feedback-action.ts` (+ test),
`features/layouts/sidebar/app-sidebar.tsx`, `nav-user.tsx` (+ test), `sidebar-skeleton.tsx` (si
orphelin), `team-switcher.tsx`, `context/organization-provider.tsx`, `context/organization-sync.tsx`,
`context/__tests__/organization.test.tsx`, `hooks/use-subscription.ts`,
`hooks/use-unread-notifications.ts` · `src/app/dal/notification-dal.ts`.

**Modifiés** — `src/app/[locale]/(app)/layout.tsx`, `dashboard/page.tsx`, `account/page.tsx` (+
`page.test.tsx`) · `src/app/[locale]/admin/layout.tsx` ·
`src/components/features/layouts/sidebar/admin-sidebar.tsx`, `nav-application.tsx`,
`nav-user-admin.tsx` · `src/components/features/auth/forms/logout-button.tsx` ·
`src/lib/better-auth/auth.ts`, `auth-client.ts` · `src/lib/routing/authenticated-segments.ts` ·
`src/proxy.test.ts`, `src/app/robots.test.ts`, `src/app/[locale]/noindex-layouts.test.ts` ·
`src/env-schemas.ts`, `src/env.ts`, `src/env-schemas.test.ts` · `src/lib/helper/date-helper.ts` ·
`messages/fr.json` · `.env.development`, `.github/workflows/ci.yml`, `scripts/init-env.ts` ·
`scripts/check-rules.ts` · `.claude/rules/01-presentation/` (`rule-form-front`,
`rule-form-front-and-back`, `rule-translation`, `rules-ux-pagelayout`, `rule-safe-route`,
`rule-react-cache-next-cache`) et leurs copies `.cursor/rules/` · `docs/stories.md` (note de s16) ·
`e2e/smoke-authenticated.spec.ts`, `e2e/authorization.spec.ts`, `e2e/seo.spec.ts`.

**Créés** — `e2e/account-legacy-routes.spec.ts`, `src/app/[locale]/(app)/layout.test.tsx`,
`src/app/[locale]/(app)/dashboard/page.test.tsx`,
`src/components/features/layouts/sidebar/admin-sidebar.test.tsx`,
`src/lib/helper/date-helper.test.ts`.

**Documents de la story** (dans le commit) — `docs/research/s46-comptes-herites-minimum.md`,
`docs/designs/s46-comptes-herites-minimum-brief.md`, `.md`, `.html`, ce plan.

## Test strategy

- **e2e (CI, Postgres éphémère, build de production)** : la preuve des 404 (le statut se décide au
  routage pour ces adresses à plusieurs segments, comme les adresses imbriquées de s45 — ADR 013),
  de la redirection sans session, de la déconnexion, de l'absence de liens morts et du passage
  `/admin` → `/bureau` sans reconnexion (cookie propre à l'hôte). Aucune donnée de tenant n'est
  lue par les nouveaux écrans : pas de test d'accès croisé supplémentaire, mais les deux domaines
  sont parcourus pour l'identité affichée.
- **Unitaires (Vitest, jsdom)** : coquille, `/dashboard`, `/account`, barre de `/admin` (avec et sans
  association), `date-helper` sans locale, schéma d'environnement, proxy et `robots.txt`. Écrits
  rouges avant le code.
- **Statique** : `tsc --noEmit`, `pnpm lint`, `pnpm check:rules`, `grep` des motifs retirés.
- **Pas de `pnpm build` local** (consigne du dépôt) : la CI le fait.

## Definition of Done

- Un seul commit sur `feature/s46-comptes-herites-minimum` (aucune migration), une PR décrite (UI,
  configuration d'environnement : familles retirées, `.env.test` et `.env.local` à mettre à jour
  localement).
- Tests unitaires verts (`pnpm test --run`), `tsc` et ESLint propres, `pnpm check:rules` vert ; e2e
  verts en CI, y compris les specs existantes non modifiées (`magic-link.spec.ts` épingle toujours
  `/dashboard` après connexion : c'est attendu jusqu'à s46b).
- Les six critères d'acceptation cochés, chacun par le test nommé en tâche 1 à 10.
- Revue `/ks-review` passée (`Ship allowed: yes`), sans critique ouvert ; puis PR et fusion
  manuelle.
- Dettes notées dans la PR : invitation d'organisation par l'API (décision I, pour s46b/s47),
  libellés internes « authentification à deux facteurs » du formulaire (design, manques).
