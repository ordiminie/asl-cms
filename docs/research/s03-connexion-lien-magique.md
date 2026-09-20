# Recherche — Story s03-connexion-lien-magique

> Recherche du 2026-09-19, sur `main` à `40a5e78` — **story scindée le même jour en s03, s03b et s03c (PR 15)** (s02 mergée, PR 13 et 14). Tout ce qui suit a été vérifié en
> ouvrant les fichiers, y compris le code de Better Auth 1.7.1 dans `node_modules` ; les numéros de ligne valent
> pour ce commit. Revue du découpage : `docs/reviews/stories.md` → `Max severity: minor`, `Stories ready: yes`.

## Story cible

**En tant que** membre propriétaire **je veux** recevoir un lien de connexion par email **afin de** consulter mon
espace sans avoir de mot de passe à retenir. Complexité 4. Dépend de s01, s01b, s02.

Critères d'acceptation (verbatim, `docs/stories.md` §s03) :

1. Saisir une adresse email connue envoie un lien de connexion à usage unique et affiche un écran d'attente explicite.
2. Le lien ouvre une session valide ; réutilisé une seconde fois, il est refusé avec un message compréhensible et un bouton pour en redemander un.
3. Un lien de plus de 4 heures est refusé avec le même message et le même bouton.
4. Une adresse email inconnue ne révèle pas si le compte existe (même écran, aucun email envoyé).
5. Les quatre rôles Membre, Bureau, Président(e) et SuperAdmin existent et sont attribuables à un utilisateur.
6. Un Membre reçoit un refus sur toute page de back-office, un Bureau y accède, et le refus vaut aussi bien en interface que sur l'appel serveur direct.
7. Une action déclarée au registre avec ses rôles par défaut est refusée à tout rôle absent de cette liste, et autorisée aux autres — vérifié sur une action de test.
8. Les actions posées avant cette story — téléverser le logo et le favicon (s01b), modifier les paramètres de l'association (s02) — sont déclarées au registre avec pour rôles par défaut Bureau et Président(e) : un Membre y reçoit un refus et un Bureau y est autorisé, en interface comme sur l'appel serveur direct.
9. L'email de connexion porte en en-tête le logo de l'association du domaine appelé (s01b), ou son nom quand elle n'a pas de logo.
10. La session est scopée à l'association du membre : elle ne donne accès à aucune donnée d'un autre tenant.
11. Le lien de connexion pointe vers le domaine de l'association à laquelle il donne accès, jamais vers une adresse de configuration unique : demandé sur le domaine de l'association A, il mène au domaine de A et y ouvre la session ; demandé sur celui de B, il mène à B — vérifié sur deux domaines.

> **Après la scission du 2026-09-19 (PR 15)** — ces critères sont ceux d'avant. s03 garde les critères 1, 2, 4 et 9,
> le critère 3 devient « un lien de plus de **20 minutes** », le 4 ajoute « aucun compte créé », et un critère
> exige l'envoi par l'adaptateur de l'ADR 005 (transport de test en vérification). Les critères 5 à 8 passent à
> **s03b-roles-registre-actions**, les critères 10 et 11 à **s03c-session-multi-domaine**. La version à jour est
> dans `docs/stories.md`.

Notes de la story à retenir : Better Auth gère le lien magique — **configurer, ne pas réécrire** ; 4 h est
contractuel (« un paramètre, pas la valeur par défaut de la lib ») ; première story qui envoie un email → passer
par l'adaptateur d'envoi de l'ADR 005 (Brevo), pas par Resend en dur ; renommer le rôle d'association `admin` en
**`board`** ; créer le **registre d'actions** (déclaration + rôles par défaut, sans écran ; s37 en fera une
matrice) ; domaine du lien **lu en base** depuis l'association, pas depuis l'en-tête (s15 et s42 génèrent aussi ces
liens, s42 hors requête) ; **seuil de scission** : plan > 10 tâches → sortir d'abord la session multi-domaine, puis
le renommage des rôles, chacun en story propre, **avant `/ks-plan`**.

## État actuel du code

### Configuration Better Auth (`src/lib/better-auth/auth.ts`, 408 lignes, `better-auth` **1.7.1** épinglé)

- **Aucun `baseURL`** dans les options (lignes 51-263) : Better Auth lit `BETTER_AUTH_URL` (`src/env-schemas.ts:78`,
  une URL unique). `trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS` (ligne 262), liste statique d'environnement.
- `magicLink({sendMagicLink})` (lignes 146-148) : **ni `expiresIn`, ni `disableSignUp`**.
- `emailAndPassword.enabled: true` (ligne 65), `socialProviders.google`, `twoFactor`, `admin()`, `organization({…})`
  **sans `ac`, `roles` ni `creatorRole`** (lignes 150-190), `stripe(…)`.
- `session.cookieCache` 5 min (lignes 59-64) ; **pas de `session.expiresIn`** (défaut de la lib).
- **Aucun `rateLimit`** configuré.
- `customSession` (ligne 273) enrichit la session avec les organisations de l'utilisateur.
- Client `src/lib/better-auth/auth-client.ts:24-29` : `createAuthClient({baseURL: env.NEXT_PUBLIC_APP_URL, plugins:
[adminClient(), organizationClient(), magicLinkClient(), …]})` — **adresse unique** là aussi.

### Plugin lien magique de Better Auth 1.7.1 (lu dans `node_modules/…/better-auth/dist/plugins/magic-link/index.mjs`)

- Durée : `expiresAt = now + (opts.expiresIn || 300) s` (ligne 83) → **5 minutes par défaut**.
- Usage unique : `allowedAttempts: 1` imposé ; le jeton est consommé atomiquement (`consumeVerificationValue`,
  ligne 156). Jeton **inconnu, déjà consommé ou expiré** → même redirection `errorCallbackURL?error=INVALID_TOKEN`
  (ligne 157) : les critères 2 et 3 peuvent partager un seul écran.
- Stockage : `storeToken: "plain"` par défaut (ligne 28) ; option `"hashed"` disponible.
- **URL du lien** : `new URL(`${basePath}/magic-link/verify`, new URL(ctx.context.baseURL).origin)` (lignes 85-88),
  puis `callbackURL`, `errorCallbackURL` en paramètres. `sendMagicLink({email, url, token, metadata}, ctx)` reçoit
  **le jeton** et le contexte de requête : l'URL peut être reconstruite sur un autre domaine.
- Vérification : `callbackURL` et `errorCallbackURL` sont résolus contre `ctx.context.baseURL` (lignes 147-148) ; la
  redirection finale part donc vers le domaine de base si les URL de rappel sont relatives.
- **Adresse inconnue** : sans `disableSignUp`, la vérification **crée le compte** (lignes 161-176) ; avec, elle
  redirige vers `?error=new_user_signup_disabled`.

### Multi-domaine dans Better Auth 1.7.1 (`@better-auth/core/dist/types/init-options.d.mts:97-140, 455-470`)

- `baseURL` accepte `{allowedHosts: string[], fallback?: string, protocol?: 'http' | 'https' | 'auto'}` : l'adresse
  de base est **déduite de l'hôte de la requête**, validé contre `allowedHosts` (motifs à joker, même moteur que
  `trustedOrigins`). `x-forwarded-host` n'est lu que si `advanced.trustedProxyHeaders` est activé.
- `allowedHosts` est une **liste statique**, fixée au démarrage ; `trustedOrigins` accepte en revanche
  `(request?) => Awaitable<string[]>` (ligne 1217), donc une lecture en base.
- Les cookies de session n'ont pas d'attribut `domain` par défaut : ils sont **propres à l'hôte**, une session ouverte
  sur A n'est pas envoyée à B (rien de configuré à l'encontre dans `advanced`).

### Envoi du lien aujourd'hui

- `src/lib/better-auth/magic-link-integration.ts` : utilisateur inconnu → **`sendMagicLinkEmailService` quand même**
  (email envoyé, contraire au critère 4) ; utilisateur connu → `createTypedNotificationService({type:
'magic_link'})`, qui appelle `sendMagicLinkEmailService` (`src/services/notification-service.ts:231-237`).
- `src/services/email-service.ts` : **Resend en dur** (`new Resend(env.RESEND_API_KEY)`, ligne 37 ; `from` par défaut
  `onboarding@resend.dev`, ligne 39) ; `sendMagicLinkEmailService` ligne 176.
- **Aucun `EmailTransport` ni adaptateur Brevo** dans `src/` (grep `EmailTransport|brevo`) : l'ADR 005 n'est pas
  encore appliqué. L'architecture et les stories s26, s29, s42 renvoient explicitement à « l'adaptateur de s03 » ; le
  **budget quotidien** relève de **s26**.
- Gabarit `src/lib/emails/magic-link-email.tsx` : `MagicLinkMail({url})`, `getTranslations('email.user.verify')`,
  **aucun logo**.

### Écrans de connexion

- Groupe `src/app/[locale]/(auth)/` : `login`, `register`, `reset-password`, `verify-request` (+ `otp`, `totp`,
  `recovery`), `auth-error`, `logout`.
- `src/components/features/auth/forms/login.tsx` : connexion **par mot de passe** par défaut, le lien magique est un
  mode secondaire (`isMagicLink`, lignes 30-166) ; `MagicLinkForm` à côté.
- `src/app/[locale]/(auth)/action.ts` : `loginMagicLinkAction` (ligne 181) appelle `auth.api.signInMagicLink` avec
  `callbackURL: '/dashboard'` (ligne 230), puis `redirect('/verify-request')` (ligne 241).
- `verify-request/page.tsx` : une carte titre + description, générique.
- Design system **§7 « La connexion — lien magique seul »** : six écrans (saisie, « consultez votre boîte mail »,
  lien expiré ou déjà utilisé, adresse inconnue identique à l'écran 2, déjà connecté, déconnexion), aucun mot de
  passe, pas d'inscription libre, 3 demandes / 15 min / adresse côté serveur, « Renvoyer » désactivé 60 s, session de
  **30 jours**, téléphone du bureau en secours.

### Rôles

- Énuméré Postgres `organization_role` = `admin`, `member`, `owner` (`src/db/models/auth-model.ts`) ; `member.role`.
- Constantes : `UserOrganizationRoleConst` (`src/services/types/domain/auth-types.ts:38-42`, `ADMIN: 'admin'`) et
  `OrganizationRoleConst` (`src/services/types/domain/organization-types.ts:28-32`, `admin: 'admin'`).
- **Usages du rôle Bureau `admin`** hors tests : `auth-util.ts:59`, `casl-abilities.ts:229`,
  `authorization-service.ts:236`, `organization-authorization.ts:278`, `association-authorization.ts:9`,
  `organization-validation.ts:55`, `organization-helper.ts:16`, `organization-provider.tsx:124`,
  `account/organizations/page.tsx:160`, `edit-member-role-dialog.tsx:43,143`, formulaires d'ajout de membre
  (`organization-add-member-form.tsx:231`, `organization-admin-add-member-form.tsx:226`),
  `subscription-service.ts:458` (`'admin'` littéral) ; seed `seed.ts:290,296,301`. 26 fichiers au total avec les tests.
- Rôle **global** homonyme `RoleConst.ADMIN = 'admin'` (`auth-types.ts:50`) et `super_admin` : **à ne pas toucher**.
- Better Auth expose les rôles personnalisés : `organization({ac, roles, creatorRole})`
  (`plugins/organization/types.d.mts:45,58,62`), exports `better-auth/plugins/access` et
  `better-auth/plugins/organization/access` (`package.json:199,269`). Le client (`organizationClient()`) doit
  recevoir les mêmes rôles.

### Autorisation et back-office

- Registre d'actions : **inexistant** (grep `action_registry|actionRegistry` vide). `docs/architecture.md` le décrit
  comme `action_registry` (« le registre des actions soumises à autorisation, que chaque story alimente et que s37
  transforme en matrice configurable ») ; la story dit « simple déclaration avec rôles par défaut, sans écran ».
- `canManageAssociation(user, organizationId)` (`src/services/authorization/association-authorization.ts`, s02) :
  `super_admin` ou `owner`/`admin` de **cette** organisation — utilisé par l'identité (s01b) et les réglages (s02).
- Back-office de l'association = groupe `(bureau)` (s01b, s02) ; `/admin` = back-office **de la plateforme**
  (rôle global). `src/proxy.ts:13-19` : `AUTHENTICATED_SEGMENTS` = `/account`, `/admin`, `/bureau`, `/dashboard`,
  `/team`.

### Tenant

- `getTenantByDomainDal`, `getCurrentTenantDal`, `requireCurrentTenantDal` (`src/app/dal/tenant-dal.ts`) ;
  `TenantDTO` porte `domain`, `logoKey`, `faviconKey`. `organization.domain` en base (unique).
- Logo servi par `GET /api/identity/logo?v=<version>` sur le domaine de l'association (ADR 015) ; formats **PNG ou
  WebP** (s01b).

## Points d'ancrage

| Besoin                           | Où ça se branche                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Durée 4 h, pas d'inscription     | `magicLink({expiresIn, disableSignUp: true, sendMagicLink})`, `auth.ts:146`                               |
| Domaine du lien                  | `sendMagicLink` (reçoit `token` et `ctx`) → reconstruire l'URL sur `organization.domain`                  |
| Session et rappels multi-domaine | `baseURL` dynamique ou `trustedOrigins` fonction (`auth.ts:262`) ; client `auth-client.ts:24`             |
| Adresse inconnue                 | `magic-link-integration.ts` : ne rien envoyer ; `disableSignUp`                                           |
| Adaptateur d'envoi               | nouveau contrat `EmailTransport` + Brevo (ADR 005), `email-service.ts` n'en dépend plus que de lui        |
| Email avec logo                  | `magic-link-email.tsx` + URL absolue du logo sur le domaine de l'association                              |
| Rôle `board`                     | énuméré `organization_role` (migration custom), constantes, plugin `organization`, client, seed, messages |
| Registre d'actions               | nouveau module (ou table, voir questions) ; `canManageAssociation` → contrôle par action                  |
| Écrans                           | `(auth)/login`, `verify-request`, écran d'erreur du lien ; design system §7                               |
| Preuve                           | e2e sur `localhost` / `127.0.0.1` (patrons `tenant-isolation`, `association-settings`)                    |

## APIs / fonctions vérifiées

| Symbole                     | Signature / valeur vérifiée                                                                                                   | Emplacement                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `magicLink` options         | `expiresIn` (s, défaut 300), `disableSignUp`, `sendMagicLink({email,url,token,metadata}, ctx)`, `storeToken`, `generateToken` | `better-auth/dist/plugins/magic-link/index.mjs:28-93`        |
| `baseURL` dynamique         | `{allowedHosts: string[]; fallback?: string; protocol?: 'http'\|'https'\|'auto'}`                                             | `@better-auth/core/dist/types/init-options.d.mts:101-136`    |
| `trustedOrigins`            | `string[] \| ((request?) => Awaitable<(string\|undefined\|null)[]>)`                                                          | idem, ligne 1217                                             |
| `organization` rôles        | `ac?: AccessControl`, `roles?: {[key]: Role}`, `creatorRole?: string`                                                         | `better-auth/dist/plugins/organization/types.d.mts:45,58,62` |
| `sendMagicLink`             | `({email, url}) => Promise<void>` (ignore `token`, `ctx`)                                                                     | `src/lib/better-auth/magic-link-integration.ts:11`           |
| `loginMagicLinkAction`      | Server Action, `auth.api.signInMagicLink({body: {email, callbackURL: '/dashboard'}})`                                         | `src/app/[locale]/(auth)/action.ts:181,226`                  |
| `sendMagicLinkEmailService` | `({email, url}) => Promise<…>` via Resend                                                                                     | `src/services/email-service.ts:176`                          |
| `MagicLinkMail`             | `({url}) => JSX`, sans logo                                                                                                   | `src/lib/emails/magic-link-email.tsx:23`                     |
| `UserOrganizationRoleConst` | `{OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member'}`                                                                          | `src/services/types/domain/auth-types.ts:38`                 |
| `OrganizationRoleConst`     | `{admin, member, owner}`                                                                                                      | `src/services/types/domain/organization-types.ts:28`         |
| `canManageAssociation`      | `(user: User \| undefined, organizationId: string): boolean`                                                                  | `src/services/authorization/association-authorization.ts`    |
| `authClient`                | `createAuthClient({baseURL: env.NEXT_PUBLIC_APP_URL, …})`                                                                     | `src/lib/better-auth/auth-client.ts:24`                      |

## Pièges et contraintes

- **Création de compte au clic** : sans `disableSignUp: true`, une adresse inconnue qui reçoit un lien crée un
  compte en le cliquant. Combiné à l'envoi actuel vers les inconnus, c'est une **inscription libre**, interdite par
  §7.
- **Égalité de temps de réponse (critère 4, §7)** : l'écran « adresse inconnue » doit être indiscernable de l'écran 2
  « en temps de réponse serveur ». Ne rien envoyer pour un inconnu raccourcit la réponse : un envoi asynchrone ou un
  délai égalisé est à prévoir, sinon la durée trahit l'adhésion.
- **« Connue » de quelle association ?** Sur le domaine B, une adresse qui n'est membre que de A doit-elle recevoir
  un lien ? Si oui, le lien mène à B où la session n'ouvre rien ; si non, c'est le cas « inconnue » (voir questions).
- **URL unique partout** : `BETTER_AUTH_URL` (base du lien et résolution des URL de rappel), `NEXT_PUBLIC_APP_URL`
  (client, lien d'OTP ligne 136, lien d'invitation ligne 155), `trustedOrigins` d'environnement. Chacune renvoie
  toutes les associations vers un domaine. Le client construit sur `NEXT_PUBLIC_APP_URL` enverrait les appels du
  domaine B vers A, avec les cookies posés sur A.
- **`allowedHosts` est statique** alors que les domaines vivent en base : un joker large (`*`) déplace la défense vers
  la résolution du tenant (qui répond « introuvable » à un domaine inconnu, ADR 003, ADR 013) ; une liste
  d'environnement oblige à redéployer pour chaque association, contraire au critère « une deuxième association sans
  une ligne de code ». Ce choix mérite un ADR.
- **Proxy du VPS** : `x-forwarded-host` n'est lu par Better Auth que si `advanced.trustedProxyHeaders` est activé ;
  `getCurrentTenantDal` le lit déjà. À vérifier avec s12b.
- **Logo dans l'email** : il faut une **URL absolue** vers le domaine de l'association ; §1.8 impose du **PNG** en
  messagerie (« SVG non fiable ») mais s01b accepte aussi le **WebP**, mal rendu par plusieurs clients (Outlook
  notamment). Et l'email ne connaît pas les tokens CSS (§5).
- **Tests e2e existants** : toutes les specs se connectent **par mot de passe** (`/{locale}/login`, `Azerty123`,
  `e2e/auth.spec.ts:124-131` et les helpers `newSession` de `association-identity` / `association-settings`).
  Supprimer la connexion par mot de passe les casse toutes ; le lien magique en e2e suppose de récupérer le lien
  (jeton lisible en base tant que `storeToken` est `plain`, ou transport de test).
- **Renommage `admin` → `board`** : valeur d'énuméré Postgres (`ALTER TYPE … RENAME VALUE`, migration **custom**),
  données existantes de `member` et d'`invitation` (colonne `role`, à vérifier), constantes, plugin `organization` et
  client, seed, libellés `messages/`, tests. Le rôle **global** `admin` reste tel quel : un rechercher-remplacer
  aveugle casserait la plateforme.
- **Adaptateur d'envoi** : s03 le crée (ADR 005) ; il faut une implémentation de développement et de test qui
  n'envoie rien (CI sans clé Brevo) et une variable d'environnement serveur pour la clé ; Resend n'est retiré qu'avec
  le nettoyage de l'ADR 009. Le **budget quotidien** appartient à s26 : ne pas l'anticiper.
- **Contrôles à la main en doublon du registre** : point d'arrêt de revue (notes de la story). s01b et s02 appellent
  `canManageAssociation` directement dans leurs services et pages.
- **Seuil de scission** : les notes imposent de scinder **avant `/ks-plan`** si le plan dépasse dix tâches. Avec
  l'adaptateur Brevo en plus des quatre sujets annoncés, le dépassement est probable (voir question 1).
- **Tests à ne pas casser** : `magic-link-integration.test.ts`, `association-authorization.test.ts`, tests de
  services d'organisation et de CASL, specs e2e `auth`, `authorization`, `association-identity`,
  `association-settings`, `tenant-isolation`.

## Questions ouvertes

1. ~~**Scinder avant de planifier ?**~~ **Tranché par Marie-Ève le 2026-09-19** : s03 est scindée (PR 15). Elle
   garde le lien magique et l'**adaptateur d'envoi** (critères 1 à 4, 9 et un critère « adaptateur ») ;
   **s03b-roles-registre-actions** prend les critères 5 à 8, **s03c-session-multi-domaine** les critères 10 et 11.
   Cette recherche couvre les trois : les sections « Rôles », « Autorisation » et « Multi-domaine » servent s03b et
   s03c.
2. ~~**Connexion par mot de passe**~~ **Tranché le 2026-09-19** : conservée, au moins pour le SuperAdmin ; la
   masquer aux autres rôles est souhaité **si c'est simple** (à trancher en `/ks-design`). Les e2e existants
   restent sur le mot de passe.
3. **Écrans** : les six écrans de §7 relèvent de `/ks-design`. Deux dépendent d'une donnée absente : le **téléphone
   du bureau** (aucun réglage ne le porte ; nouvelle clé du registre de s02 ?) et le texte « vos documents vous sont
   envoyés par courrier ».
4. **Durée : 20 minutes** (arbitrage du 2026-09-19, au lieu de 4 h ; CDCT et brief produit non modifiés).
   **« Un paramètre »** : constante de configuration, variable d'environnement, ou réglage par
   association (`organization_setting`, s02) ? Même question pour la session de 30 jours et la limite de 3 demandes
   par quart d'heure de §7, hors critères.
5. **Adresse « connue »** : connue de la plateforme, ou membre de l'association du domaine appelé ? Et le SuperAdmin,
   sur quel domaine se connecte-t-il ?
6. **Registre d'actions : code ou table ?** `docs/architecture.md` parle d'une table `action_registry`, la story d'une
   « simple déclaration » sans écran, et s37 en fera une matrice par tenant. Une déclaration en code (comme le
   registre de s02, ADR 016) suffit-elle, s37 ajoutant la table des surcharges ?
7. **Multi-domaine** : `baseURL` dynamique avec `allowedHosts` large et défense par la résolution du tenant, ou
   `baseURL` fixe et URL reconstruite dans `sendMagicLink` + `trustedOrigins` en fonction lisant les domaines en
   base ? Le choix fixe aussi le sort du client (`auth-client.ts`, sans `baseURL` = origine courante). Mérite un ADR.
   À vérifier sur deux domaines locaux, sans Chromium ici : **en e2e seulement**.
8. **Logo WebP dans l'email** : refuser le WebP au téléversement (retouche de s01b), convertir en PNG pour l'email,
   ou afficher le nom de l'association quand le logo n'est pas un PNG ?
9. **Égalité de temps de réponse** pour l'adresse inconnue : envoi hors requête, ou délai égalisé ?

<< IP Mike: exploration method, what a good research always verifies. >>
