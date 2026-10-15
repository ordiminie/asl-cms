---
validated: yes
---

# Plan — Story s46b-connexion-limitee-association

Branch: `feature/s46b-connexion-limitee-association`

Sources : `docs/stories.md:3306-3392`, `docs/research/s46b-connexion-limitee-association.md` (relevée
sur `main` à `e73a880`), ADR 003, 013, 014, 022, et **ADR 034** (nouvelle, écrite pour ce plan). Pas
de design : la story ne crée ni ne modifie aucun écran (`/ks-design` du 14/10).

## Target story

En tant que membre du bureau, je veux que seuls les membres de mon association puissent se connecter
sur son site, et arriver directement là où je travaille.

1. Après connexion, quel que soit le mode : bureau ou Présidence de l'association du domaine →
   `/bureau` ; SuperAdmin → `/admin` (même avec un rôle dans l'association) ; membre propriétaire →
   `/dashboard`.
2. Un compte ne se connecte que sur le domaine d'une association dont il est membre, pour les quatre
   modes. Refus = aucune session et même message qu'un compte inconnu. SuperAdmin exempté. Preuves :
   e2e d'accès croisé (mot de passe, lien magique dont un jeton émis sur A et ouvert sur B) ; test
   unitaire du point de contrôle unique (membre de A refusé sur B, accepté sur A, SuperAdmin partout,
   hôte sans association refusé sauf au SuperAdmin).
3. Inscription fermée : `/register` introuvable ; création de compte par mot de passe adressée au
   serveur refusée (aucun utilisateur créé) ; le webhook Stripe ne crée plus de compte (test unitaire
   de `onStripeEvent` sur `custom_checkout`).
4. Lien magique pour une adresse inconnue : aucun compte (déjà fait par s03, gardé par un test).
5. Google sur aucun écran ; configuration serveur gardée avec `disableSignUp` ; un compte Google
   inconnu ne crée aucun utilisateur. Apple ni proposé ni configuré ; GitHub retiré ; aucune trace
   des deux dans les écrans, les actions, le schéma d'environnement et la CI.

## Décisions

Ce sont les réponses du plan aux douze questions ouvertes de la recherche. Elles sont à valider avec
le plan.

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                                                       | Pourquoi                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Point de contrôle unique : un plugin Better Auth local, en tête du tableau `plugins`**, avec un seul hook `session.create.before` (ADR 034).                                                                                                                                                                                                                                                                                  | Les hooks des plugins passent avant ceux de la configuration (`context/helpers.mjs:15-45`). Le plugin `admin()` lève `BANNED_USER` dans son propre hook : placé après lui, notre contrôle laisserait un compte banni de A recevoir sur B le message « banni ».                                  |
| B   | **Une seule règle**, `canOpenSessionOn(user, organization)` : vrai pour `super_admin`, ou pour une ligne `member` dans cette association. Elle remplace `isMemberOf` dans `sendMagicLink`. Elle vit dans un module partagé avec la lecture de l'association de la requête (`organizationOfRequest`, aujourd'hui privée).                                                                                                          | « La même règle que le lien magique » (note de la story), et l'exemption du SuperAdmin vaut pour tous les modes (critère 2). Le SuperAdmin reçoit donc désormais un lien sur tout domaine.                                                                                                       |
| C   | **Fermé par défaut, sans exemption par chemin.** `context` nul, en-têtes absents, domaine sans association : refus, sauf au SuperAdmin. L'imitation, la vérification d'email et l'activation de la 2FA suivent la même règle.                                                                                                                                                                                                   | Aucun de ces chemins n'a besoin d'ouvrir une session pour un non-membre (ADR 034). L'imitation n'a aucun écran.                                                                                                                                                                                 |
| D   | **Refus par `false`**, pas par `APIError`.                                                                                                                                                                                                                                                                                                                                                                                     | Chaque mode rend alors son erreur générique ; l'action de connexion la traduit en message de compte inconnu. Une `APIError` porterait son propre message.                                                                                                                                       |
| E   | **Un seul message pour le mot de passe** : compte inconnu, mauvais mot de passe et refus d'association donnent tous `invalidCredentials` (« Identifiants invalides »). La consultation préalable `getUserByEmailService` (`action.ts:115-122`) et la clé `userNotFound` partent. Le bannissement est détecté **après** `signInEmail` (réponse 403 `BANNED_USER`), puis le message traduit est construit comme aujourd'hui. `signInEmail` reçoit les `headers`. | Aujourd'hui l'action révèle l'existence du compte avant tout contrôle (deux messages, et le bannissement affiché sans mot de passe). Better Auth vérifie le mot de passe avant d'ouvrir la session : le bannissement n'est plus révélé qu'au titulaire du bon mot de passe, et seulement sur son domaine. |
| F   | **Route de passage `/login/destination`, en Route Handler** (`src/app/[locale]/(auth)/login/destination/route.ts`, `GET`). Elle lit la session et l'association du domaine, puis rend un **307** vers la destination ; sans session, vers `/login`. Les six destinations de `action.ts`, `otp.tsx`, `totp.tsx` et `auth.ts:413` visent cette route. | Le lien magique et Google fixent leur `callbackURL` avant de savoir qui se connecte. Un Route Handler rend un vrai statut sans shell streamé (ADR 013) ; une page qui appelle `redirect()` partirait après un 200. Sous `/login` : déjà dans `SIGN_IN_SEGMENTS` (robots), et hors du proxy.         |
| G   | **Règle de destination**, fonction pure `postLoginPathOf(user, organizationId)` à côté de `canManageAssociation` : `super_admin` → `/admin` ; `owner`/`board` de cette association → `/bureau` ; sinon `/dashboard`. Le rôle global `admin` n'est pas SuperAdmin : il suit son rôle dans l'association. | `canManageAssociation` vaut vrai pour le SuperAdmin : il faut le tester avant. `isAdmin` accepte le rôle global `admin` et ne sert pas. Le rôle `admin` disparaît en s47.                                                                                                                         |
| H   | **`/bureau` → `/bureau/pages`** par une redirection de `next.config.ts` (`redirects()`, précédent de l'ADR 031), non permanente.                                                                                                                                                                                                                                                                                                | `/bureau` n'a pas de page et tombe sur la route CMS « Page non trouvée » (décision G de s46). Une redirection de configuration rend un vrai 307, avant tout rendu.                                                                                                                                |
| I   | **Inscription fermée sur trois canaux** : `emailAndPassword.disableSignUp: true` ; `socialProviders.google.disableSignUp: true` ; lien magique déjà fermé. Retrait de `/register` (page, `register-form.tsx`, `register-magic-link-form.tsx`), des actions `registerCredentialAction`, `registerMagicLinkAction`, `registerProviderAction` **et `loginProviderAction`** (son seul appelant part), de la branche `/sign-up/email` du middleware et de leurs messages. | Critère 3 et 5. Sans écran ni appelant, `loginProviderAction` est une Server Action exportée qui reste appelable : la V2 la récupérera par `git revert` ou `upstream/main` (ADR 009). La configuration serveur de Google reste, comme l'exige le critère 5.                                      |
| J   | **`/register` répond « Page non trouvée », avec un statut 200** : le « 404 » du critère 3 se lit selon l'ADR 013, comme pour s45. `/register` reste dans `SIGN_IN_SEGMENTS` (robots.txt).                                                                                                                                                                                                                                      | Une adresse à un segment sans page tombe sur `(public)/[slug]`, qui streame (ADR 013) : un vrai 404 est impossible sans route. Le critère de s45 a été reformulé dans ce sens le 13/10 (`02dbbc4`). Garder `Disallow: /register` est sans danger et évite de toucher trois tests.                  |
| K   | **Le webhook Stripe ne crée plus aucun compte** : retrait de `handleGuestCheckoutSessionCompleted` et de ses fonctions (`detectGuestCheckoutMode`, `validateGuestCheckoutData`, `createGuestUser`, `ensureStripeCustomer`, `ensureDatabaseUser`, `updateSubscriptionWithUser`, `warnOnDuplicateSubscription`, `sendGuestAccessEmail`), de `handleFullCheckoutSessionCompleted`, d'`isCriticalStripeEvent`, de `createUserFromStripeService` (service, façade, schéma, type) et de leurs dépendances devenues orphelines. **Le paiement en plusieurs fois perd son mode invité** : il passe toujours par `getAuthenticatedUser`. | Critère 3 (« le webhook ne crée plus de compte ») : le mode invité du paiement en plusieurs fois créait des comptes par le même `createGuestUser`. Le reste de ce paiement ne change pas, comme le veut la note de la story. Plus aucun code ne crée de session de paiement.                 |
| L   | **Traces Apple, GitHub et Google par défaut** : `apple` et `github` sortent d'`AuthMethodSchema` ; le défaut de `NEXT_PUBLIC_AUTH_METHODS` devient `credential,magiclink` (schéma, `init-env.ts`, `env.example`) ; la surcharge du job e2e (`ci.yml:71-77`) part ; clés de messages et `docs/authentication-system.md` alignés ; motif ajouté à `STALE_PATTERNS`. | Critère 5. Sans `/register`, la surcharge de la CI n'a plus de justification (son commentaire le dit). `google` reste une valeur valide de l'enum, pour la V2.                                                                                                                                   |
| M   | **Hors périmètre, noté dans la PR** : le second webhook `@deprecated` (`src/app/api/webhooks/stripe/route.ts`, il ne crée aucun compte), `createUserService` (code mort), le paquet `@better-auth/api-key`, l'invitation d'organisation par l'API (dette I de s46), le lien OTP sur `NEXT_PUBLIC_APP_URL` (ADR 034, pour s12b), le hook `user.create.after` (organisation personnelle, Inngest). | Aucun ne crée de compte ni n'ouvre de session hors du contrôle. Les traiter ici élargirait une story d'authentification déjà à trois changements.                                                                                                                                             |

## Tasks (ordered)

1. [x] **Règle d'appartenance partagée.** Créer `src/lib/better-auth/association-membership.ts` :
       `organizationOfRequest` (déplacée depuis `magic-link-integration.ts`, façade toujours chargée par
       `import()`), `isMemberOf` (déplacée) et `canOpenSessionOn(user, organization | undefined)`
       (décision B). `sendMagicLink` l'utilise à la place de `isMemberOf`. Tests unitaires
       (`association-membership.test.ts`) : membre de A accepté sur A, refusé sur B ; SuperAdmin
       accepté sur A, sur B et sans association ; compte sans association refusé ; association
       absente refusée. `magic-link-integration.real-i18n.test.ts` : le SuperAdmin sans appartenance
       reçoit désormais un lien ; les tests « non-membre = inconnu » (l. 448, 465) restent verts.
       `magic-link-integration-imports.test.ts` reste vert (aucun cycle).
2. [x] **Le point de contrôle à l'ouverture de session** (décisions A, C, D, ADR 034). Plugin local
       `associationSessionGuard()` (même module ou voisin), placé **en premier** dans `plugins`
       (`auth.ts:132`). Son hook lit `context?.headers ?? context?.request?.headers`, résout
       l'association, relit le compte (`getUserByIdDao`) et renvoie `false` si
       `canOpenSessionOn` refuse. Tests unitaires du hook, appelé avec le `context` de chaque mode :
       `{headers}` (mot de passe, 2FA), `{request: {headers}}` (ouverture d'un lien magique, callback
       Google), `null`. Cas : membre de A sur A accepté ; membre de A sur B refusé ; SuperAdmin sur A,
       sur B et sur un hôte sans association accepté ; hôte sans association refusé ; `context` nul
       refusé. Un test épingle la position du plugin **avant** `admin()`.
3. [x] **Connexion par mot de passe** (décision E). `loginCredentialAction` passe `headers` à
       `signInEmail` et vise `/login/destination` ; elle ne consulte plus le compte avant ; elle rend
       `invalidCredentials` pour tout refus ; elle détecte le bannissement sur la réponse et redirige
       vers `/auth-error` avec le message traduit ; elle lit `twoFactorType` après une réponse
       réussie. Clé `AuthActions.login.userNotFound` retirée. Tests unitaires dans `action.test.ts`
       (aujourd'hui aucun pour cette action) : compte inconnu, mauvais mot de passe et refus
       d'association rendent le même message ; `headers` transmis ; bannissement → `/auth-error` ;
       2FA → `/verify-request/otp` ou `/totp` ; succès → `/login/destination`.
4. [x] **Destination par rôle** (décisions F, G, H). `postLoginPathOf` (pure, à côté de
       `canManageAssociation`) ; une fonction de DAL qui lit l'utilisateur courant (rôle et
       appartenances) et l'association du domaine, puis rend le chemin ; le Route Handler
       `login/destination/route.ts` (307 ; sans session → `/login`). Les destinations
       `/dashboard` de `requestMagicLinkAction`, `verifyBackupCodeAction`, `verifyOTPAction`,
       `otp.tsx:99`, `totp.tsx:72` et `auth.ts:413` visent `/login/destination`. Redirection
       `/bureau` → `/bureau/pages` dans `next.config.ts`. Tests unitaires : `postLoginPathOf` (SuperAdmin
       membre ou non → `/admin` ; `owner` et `board` de cette association → `/bureau` ; `board`
       d'une autre association → `/dashboard` ; membre → `/dashboard` ; rôle global `admin` membre
       → `/dashboard`) ; le Route Handler (307 et `Location` pour chaque cas, `/login` sans session) ;
       la redirection de configuration ; les tests existants qui épinglaient `/dashboard`
       (`action.test.ts`, `magic-link-integration.real-i18n.test.ts`, `association-origin.test.ts`)
       mis à jour.
5. [x] **Inscription fermée** (décisions I, J). `disableSignUp` sur `emailAndPassword` et sur
       `socialProviders.google` ; retrait de `register/` (page), `register-form.tsx`,
       `register-magic-link-form.tsx`, `register-form.test.tsx`, des quatre actions et de leurs tests
       (`action.test.ts:45-85`), de la branche `/sign-up/email` du middleware (`auth.ts:399-402`), des
       namespaces `Auth.RegisterPage`, `Auth.RegisterForm`, `Auth.RegisterMagicLinkForm`,
       `Auth.messages`, `AuthActions.register`, `AuthActions.registerMagicLink`,
       `AuthActions.registerProvider`, `AuthActions.loginProvider`. Tests unitaires : la configuration
       de Better Auth porte `disableSignUp` sur les deux canaux, et `magicLinkOptions.disableSignUp`
       reste vrai (critère 4, test existant l. 507 et 641 conservés). `pnpm check:rules` vert :
       `rule-form-back.md:30, 169, 188` et `rule-presentation.md:27` ne citent plus l'inscription ;
       copies `.cursor` régénérées.
6. [x] **Webhook Stripe** (décision K). Retraits listés en K, plus l'import `auth` de
       `user-service.ts` et `hasPasswordCredentialDao` s'ils n'ont plus d'appelant (vérifier les
       tests). Nouveau `src/lib/stripe/stripe-events.test.ts` : un `checkout.session.completed` portant
       `metadata.source = 'custom_checkout'` (avec et sans `referenceId = 'guest'`) ne crée aucun
       utilisateur (ni `createUserDao`, ni `auth.api.createUser`, ni client Stripe) et ne lève pas ;
       un paiement en plusieurs fois invité pour une adresse inconnue lève « non trouvé » sans créer
       de compte ; pour un compte existant, il crée l'abonnement comme avant.
7. [x] **Traces Apple, GitHub et Google par défaut** (décision L). `env-schemas.ts:15-16, 180-185`,
       `scripts/init-env.ts:157, 256-257`, `env.example:65-66`, `ci.yml:71-77` (surcharge e2e
       retirée), unions de type d'`action.ts` (parties avec les actions), `messages/fr.json`
       (`Auth.LoginForm.providers` et `loading`, après vérification qu'aucune clé n'est lue
       dynamiquement), `docs/authentication-system.md` (fournisseurs, `/register`, `/dashboard`).
       `STALE_PATTERNS` reçoit un motif « retiré par s46b » (`register-form`, `/register` comme écran,
       connexion Apple ou GitHub) ; `pnpm check:rules` vert. Test : `env-schemas` refuse `apple` et
       `github` ; un `grep` de contrôle (dans le plan d'exécution, pas en test) ne trouve plus aucune
       trace d'authentification Apple ou GitHub hors de l'assertion négative `login.test.tsx:25`.
8. [x] **Specs e2e** (critères 1 à 4, preuves).
   - `e2e/auth.spec.ts` réécrit en français (m7 ; m6 déjà soldé par s46) :
     - retrait des tests d'inscription (l. 20, 52, 223, 247) ;
     - `/register` affiche « Page non trouvée » (statut 200 asserté strictement, ADR 013) et aucun
       formulaire ;
     - `POST /api/auth/sign-up/email` (avec l'en-tête `Origin` du domaine, pour que le refus vienne
       bien de `disableSignUp`) répond 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`, et le nombre
       d'utilisateurs de l'adresse reste 0 ;
     - accès croisé par mot de passe : `user@` (membre de A seulement) sur B obtient « Identifiants
       invalides », le même message qu'une adresse inconnue, et aucun cookie de session.
   - Destination par rôle, par mot de passe : `user-owner@` sur A → `/bureau/pages` ; `user-admin@`
     sur B → `/bureau/pages` ; `user@` sur A → `/dashboard` ; `superadmin@` sur A → `/admin`.
   - `e2e/magic-link.spec.ts` : `expectSessionOn` et les tests l. 326, 431, 549, 563 et 573 attendent
     `callbackURL = ${origin}/login/destination` et la destination du rôle. Nouveau test : un lien
     demandé sur A pour `user@`, puis ouvert sur B (hôte **et** `callbackURL` réécrits vers B, pour
     que le refus vienne bien du contrôle et non de l'origine), mène à `/login/lien-invalide`, sans
     cookie de session sur B.
   - Le test « adresse inconnue » (l. 391) reste vert (critère 4).
   - Les specs qui connectent le SuperAdmin (`account-legacy-routes`, `association-settings`,
     `association-identity`, `locale-unique`) restent vertes : il est exempté, et leurs `login`
     n'attendent que de quitter `/login`.
9. [x] **Documentation et revue de cohérence.**
   - `docs/architecture.md` : la section « Le lien et la session sur le domaine de l'association »
     décrit le contrôle à l'ouverture de session et la route de passage ; « Reste connu » est mis à
     jour.
   - `docs/research/s46b-connexion-limitee-association.md`, ce plan et l'ADR 034 partent dans le
     commit de la story.
   - Suite unitaire complète (`pnpm test --run`, sur une copie en disque local), `tsc --noEmit`,
     `pnpm lint`, `pnpm check:rules`.
   - Les e2e tournent en CI.

## Files touched

- **Authentification** :
  - `src/lib/better-auth/auth.ts` (plugin en tête, `disableSignUp` ×2, middleware) ;
  - `src/lib/better-auth/association-membership.ts` (nouveau) et son test ;
  - `src/lib/better-auth/magic-link-integration.ts` et ses tests.
- **Actions et écrans** :
  - `src/app/[locale]/(auth)/action.ts`, `action.test.ts` ;
  - `src/app/[locale]/(auth)/login/destination/route.ts` (nouveau) et son test ;
  - `verify-request/otp/otp.tsx`, `verify-request/totp/totp.tsx` ;
  - suppression de `src/app/[locale]/(auth)/register/` et de
    `src/components/features/auth/forms/register-form.tsx`, `register-form.test.tsx`,
    `register-magic-link-form.tsx`.
- **Rôle et DAL** :
  - `src/services/authorization/association-authorization.ts` (+ test) ;
  - une fonction dans `src/app/dal/` (user ou tenant) ;
  - `next.config.ts` (redirection `/bureau`).
- **Stripe** :
  - `src/lib/stripe/stripe-events.ts`, `stripe-events.test.ts` (nouveau) ;
  - `src/services/user-service.ts`, `src/services/facades/user-service-facade.ts`,
    `src/services/validation/user-validation.ts`, `src/services/types/domain/user-types.ts` ;
  - éventuellement `src/db/repositories/user-repository.ts`.
- **Environnement** : `src/env-schemas.ts`, `scripts/init-env.ts`, `env.example`,
  `.github/workflows/ci.yml`.
- **Messages et règles** :
  - `messages/fr.json` ;
  - `.claude/rules/01-presentation/rule-form-back.md`, `rule-presentation.md` et leurs copies
    `.cursor` ;
  - `scripts/check-rules.ts`.
- **Specs e2e** : `e2e/auth.spec.ts`, `e2e/magic-link.spec.ts`.
- **Documentation** :
  - `docs/architecture.md`, `docs/authentication-system.md` ;
  - `docs/decisions/034-connexion-limitee-a-l-association-du-domaine.md`, ce plan, la recherche.
- **Aucune migration, aucun changement de schéma de base.**

## Test strategy

- **Unitaires (Vitest)** : ce sont les preuves du « point de contrôle unique » du critère 2 et du
  webhook du critère 3. Elles couvrent :
  - la règle pure `canOpenSessionOn` ;
  - le hook du plugin, appelé avec le `context` de chaque mode, et sa position avant `admin()` ;
  - `postLoginPathOf` et le Route Handler ;
  - `loginCredentialAction`, avec un message identique pour les trois refus ;
  - la configuration `disableSignUp` ;
  - `onStripeEvent`, dont le harnais est entièrement nouveau.

  La base et Better Auth sont simulés (`vi.mock`). La RLS n'entre pas en jeu : `member` et
  `organization` sont lus hors RLS (ADR 014).
- **E2e (Playwright, en CI sur le build de production)** : preuves d'accès croisé pour le mot de
  passe et le lien magique (jeton émis sur A et ouvert sur B), inscription refusée par le serveur
  (aucun utilisateur créé), destination par rôle, `/register` introuvable. Comptes du seed : `user@`
  (membre de A), `user-owner@` (Présidence de A), `user-admin@` (bureau de B), `superadmin@` (aucune
  appartenance). Domaines : A = `localhost`, B = `127.0.0.1`.
- **Ce qui n'a pas d'e2e, comme l'accepte le critère 2** : la double authentification (aucun compte
  du seed ne l'a active) et Google (aucun écran, aucun simulacre OAuth). Leurs `context` sont
  reproduits dans le test unitaire du hook.
- **Exécution locale** : unitaires sur une copie en disque local (montage 9p trop lent) ; e2e et
  build en CI seulement.

## Definition of Done

- Une seule PR depuis `feature/s46b-connexion-limitee-association`, un seul commit de story. Elle
  porte la recherche, ce plan, l'ADR 034, puis la revue.
- Les cinq critères sont couverts par des tests qui échoueraient sans le changement :
  - le hook refuse un membre de A sur B ;
  - le même message est rendu pour un compte inconnu et pour un compte refusé ;
  - l'inscription par le serveur crée 0 utilisateur ;
  - `onStripeEvent` ne crée aucun compte ;
  - `disableSignUp` est posé sur les canaux mot de passe et Google.
- Les vérifications sont vertes : suite unitaire complète, `tsc --noEmit`, `pnpm lint`,
  `pnpm check:rules`, et la CI de la PR (e2e compris).
- Aucune régression :
  - le SuperAdmin se connecte toujours partout ;
  - les specs existantes qui ne testent pas la destination restent vertes ;
  - le paiement en plusieurs fois d'un compte existant ne change pas.
- Revue `/ks-review` passée (`Ship allowed: yes`), puis PR ouverte par `/ks-ship`, avec les points
  hors périmètre (décision M) listés.
- Voie de retour : `git revert` du commit de la story, ou récupération depuis `main` /
  `upstream/main` (ADR 009). Aucune migration à défaire.
