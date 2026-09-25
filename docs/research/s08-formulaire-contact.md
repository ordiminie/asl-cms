# Research — Story s08-formulaire-contact

## Target story

**En tant que** visiteur **je veux** envoyer un message au bureau depuis le site **afin de** poser une
question sans avoir de compte.

Complexité 2. Dépend de **s02** (mergée : registre des paramètres, `contact.email`) et **s04** (mergée :
`94b4906`, PR #21, site public et `RESERVED_PAGE_SLUGS`). Réf. `V5 §4.1, §4.6`, `CDCT §4.1`, PRD lignes
« Pages publiques + formulaire de contact archivé en BO » (complexité 2 : « Formulaire, persistance,
liste consultable, notification paramétrable ») et « Limitation de débit des formulaires publics »
(complexité 1 : « Compteur sur empreinte d'IP hachée, purgé sous 24 h »).

### Acceptance criteria (docs/stories.md l. 815-823)

1. Un envoi valide enregistre le message, affiche une confirmation et notifie par email l'adresse
   paramétrée du tenant.
2. Un envoi invalide (email mal formé, message vide) affiche les erreurs **par champ**, n'enregistre
   rien et n'envoie aucun email.
3. Le bureau consulte en back-office la liste des messages reçus, triée par date, avec le détail de
   chaque message.
4. Changer l'adresse de notification dans les paramètres (s02) redirige le message suivant vers la
   nouvelle adresse.
5. Au-delà d'un nombre d'envois **par heure et par visiteur** fixé en paramètre de tenant, une
   soumission supplémentaire est refusée avec un message explicite ; en deçà, elle passe.
6. Le compteur repose sur une empreinte d'adresse IP hachée : **aucune adresse IP en clair** n'est
   écrite en base.
7. Une opération de purge supprime toute empreinte de **plus de 24 h** et n'en touche aucune autre ;
   elle s'exécute à chaque soumission **et** peut être appelée seule — vérifié par un test sur des
   empreintes de part et d'autre des 24 h.

### Notes de la story à tenir

- « **L'email ne suffit pas**, le message doit être persisté et consultable en BO. »
- Adresse par défaut = celle de la présidente, **lue dans les paramètres du tenant (s02), jamais en dur**.
- Distinct du formulaire « Questions au bureau » de l'espace membre (**s22**) : ne pas fusionner les
  deux modèles.
- La purge : s08 livre l'**opération** (appelable seule + à chaque soumission) ; **s12b** en planifie
  l'appel quotidien (critère 6 de s12b, l. 1167 : « la purge des empreintes des formulaires publics
  (s08) est appelée au moins une fois par jour ») ; s26 peut la reprendre dans `scheduled_job`.
- **s10** (l. 915, 926) réutilisera « le limiteur livré par s08 (empreinte d'IP hachée, purge sous
  24 h), ne pas en écrire un second » : le limiteur doit être générique par usage, pas propre au contact.
- « Le boilerplate a `src/db/models/user-submission-model.ts` — vérifier s'il convient avant d'en créer
  un nouveau. » Server Action : `rule-safe-server-action` et `rule-form-front-and-back`.
- Règles transverses (`docs/stories.md` l. 25-70) : rien en dur, couches, Cache Components, RLS +
  test d'accès croisé, **registre d'actions**.
- `docs/reviews/stories.md` : `Stories ready: yes`.

---

## Current state of the code

Vérifié le 22 septembre 2026 dans l'arbre de travail (branche courante `feature/s05-actualites`, HEAD
`0b328a2` = `main`, s03c ; seuls des fichiers de docs s05 non suivis s'y ajoutent — aucun code s05
n'est écrit). s01 → s04b, s12a et s03c sont mergées.

**Une chaîne « contact » complète existe déjà, héritée du boilerplate et partiellement reprise par
s01** (scope de tenant ajouté). Elle couvre la persistance et une liste d'administration, mais **aucun
critère de s08 n'est tenu tel quel**.

### Le formulaire public — `src/app/[locale]/(public)/contact/`

| Fichier                      | Ce qu'il fait aujourd'hui                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.tsx`                   | `'use cache'` + `cacheLife('max')`, `generateStaticParams` sur `routing.locales` ; rend `<ContactForm />` seul. Aucune donnée de tenant dans la page (le cadre public est porté par `(public)/layout.tsx`, qui résout le tenant).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `contact-form.tsx`           | Client, RHF + `zodResolver(createContactFormSchema(t))`, champs `email`, `subject`, `content`. Appelle `submitContactAction({success:false,message:''}, formData)` en direct (pas de `useActionState`). Succès : carte **verte** (`border-green-200 bg-green-50/50`, `CheckCircle2 text-green-600`). Échec serveur : `Alert variant="destructive"` avec **un seul message** global.                                                                                                                                                                                                                                                                       |
| `contact-form-validation.ts` | `contactFormSchema` (messages en anglais en dur) + `createContactFormSchema(t)` par `extend` (patron `rule-zod-client-server-internationalization`). Sujet 3-255, message 10-5000.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `actions.ts`                 | `submitContactAction(_prevState: ContactFormState, formData): Promise<ContactFormState>` avec `ContactFormState = {success, message}`. **`RateLimiterMemory({points: 3, duration: 300})` sur l'IP en clair** (`x-forwarded-for` \|\| `x-real-ip` \|\| `'unknown'`). Validation **manuelle** (regex, longueurs), pas par le schéma Zod. Puis `getCurrentTenantDal()` → `withCurrentTenant(() => createUserSubmissionService({email, organizationId, type: 'contact', subject, message: content, metadata: {source: 'contact-page', ip}}))`. **L'IP est écrite en clair dans `metadata`** (viole le critère 6). `getTranslations('ContactPage')` implicite. |
| `actions.test.ts`            | 3 tests (rattachement au tenant, écriture sous scope, rien hors tenant), en-têtes mockés `x-forwarded-for: 10.0.0.N`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Messages : `messages/fr.json` l. 1658-1707, namespace `ContactPage` (`metadata`, `card`, `success`,
`fields`, `submit`, `validation`, `errors` dont `errors.rateLimit` « Trop de requêtes. Réessayez dans
{seconds} secondes. »). `en.json` et `es.json` existent encore.

`contact` figure déjà dans `RESERVED_PAGE_SLUGS` (`src/services/types/domain/page-block-types.ts:98`) :
aucune page CMS ne peut prendre `/contact`. La route n'est pas dans `AUTHENTICATED_SEGMENTS`
(`src/proxy.ts:13-19`) : elle est publique.

### La persistance — `user_submissions`

| Couche         | Fichier                                                                                           | Ce qu'il fait                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modèle         | `src/db/models/user-submission-model.ts`                                                          | `user_submissions` : `user_id` (FK `user`, cascade, nullable), `organization_id` (FK `organization`, **`onDelete: 'set null'`, nullable**), `email` (nullable), `type` (`submission_type` = `contact \| feedback \| support`), `subject` **NOT NULL**, `message`, `metadata` jsonb, `read`, `archived`, `created_at`/`updated_at` avec fuseau. Enregistré dans `db.ts` (`...userSubmission`). |
| RLS            | `drizzle/migrations/0004_rls_tenant_isolation.sql:28-34`                                          | `ENABLE` + `FORCE`, policy `tenant_isolation` (`organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid` ou `app.bypass_rls = 'on'`).                                                                                                                                                                                                                                |
| Repository     | `src/db/repositories/user-submission-repository.ts`                                               | `getDb()` partout. `createUserSubmissionDao`, `getUserSubmissionByIdDao` (avec `user`), `getAllUserSubmissionsWithPaginationDao(pagination, filters?)` — tri `desc(createdAt)`, filtres `type`/`read`/`archived` (non archivés par défaut)/`search` (`ilike` sujet ou message), `getUnreadSubmissionsCountDao`, `markUserSubmissionAsReadDao`, `archiveUserSubmissionDao`.                    |
| Types domaine  | `src/services/types/domain/user-submission-types.ts`                                              | ⚠️ **Importe `@/db/models/user-submission-model`** (`UserSubmission = UserSubmissionModel`, `CreateUserSubmission` = `Omit<AddUserSubmissionModel,…>`) : la présentation qui les utilise dépend donc du modèle, à l'encontre de `rule-architecture`. `UserSubmissionDTO`, `UserSubmissionFilters`, `SubmissionTypeConst`.                                                                     |
| Validation     | `src/services/validation/user-submission-validation.ts`                                           | `createUserSubmissionServiceSchema` (messages français en dur, `metadata: z.record(...)`), `markAsRead…`, `archive…`.                                                                                                                                                                                                                                                                         |
| Service        | `src/services/user-submission-service.ts`                                                         | Voir ci-dessous : **écarts multiples à la convention**.                                                                                                                                                                                                                                                                                                                                       |
| Autorisation   | `src/services/authorization/user-submission-authorization.ts`                                     | `canCreateUserSubmission` (= connecté), `canReadUserSubmissions` / `canManageUserSubmissions` = **`isUserAdmin`** (rôle **global** `admin` ou `super_admin`). Aucun rôle d'association, aucune action au registre.                                                                                                                                                                            |
| Façade         | `src/services/facades/user-submission-service-facade.ts`                                          | Réexporte les 6 méthodes via `interceptors/user-submission-service-logger-interceptor.ts`.                                                                                                                                                                                                                                                                                                    |
| DAL            | `src/app/dal/user-submission-dal.ts`                                                              | `getAllUserSubmissionsWithPaginationDal`, `getUserSubmissionByIdDal`, `getUnreadSubmissionsCountDal` — `cache()` + `withCurrentTenant`, **sans `'use cache'`** (donnée d'administration, derrière `<Suspense>`). `getUserSubmissionPermissionsDal` (sur `canManageUserSubmissions`).                                                                                                          |
| BO SuperAdmin  | `src/app/[locale]/admin/submissions/` + `src/components/features/admin/submissions/` (718 lignes) | Page `withAuthAdmin`, liste paginée filtrable, dialogue de détail, actions `markAsReadAction` / `archiveSubmissionAction` (`requireActionAuth({roles: [ADMIN, SUPER_ADMIN]})`, `revalidatePath`). Hors `(bureau)`, rôle global : **le bureau n'y a pas accès**.                                                                                                                               |
| Autre écrivain | `src/components/features/quick-feedback-action.ts`                                                | `createQuickFeedbackAction` (bouton `QuickFeedbackButton` monté dans `(app)/layout.tsx:55`) écrit des lignes `type: 'feedback'` dans la même table, même tenant.                                                                                                                                                                                                                              |
| Seed           | `src/db/scripts/seed.ts:515-540`                                                                  | Insère des `user_submissions` par slug d'organisation.                                                                                                                                                                                                                                                                                                                                        |
| e2e            | `e2e/tenant-isolation.spec.ts:160-260`                                                            | **La preuve d'isolation RLS de s01 repose sur cette table** : `/en/admin/submissions` sur A, SQL direct (`select … from user_submissions`, insertion forgée hors tenant refusée).                                                                                                                                                                                                             |

`createUserSubmissionService` (l. 35-78), tel qu'il est :

- `safeParse` puis contrôle `canCreateUserSubmission` **seulement si ni `userId` ni `email`** — un
  visiteur anonyme avec email passe (c'est le chemin du contact) ;
- `createUserSubmissionDao(parsed.data)` ;
- puis, dans un `try/catch` qui **avale** l'erreur (`console.error`), `sendInternalEmailService({title,
data})` importé **depuis la façade** `./facades/email-service-facade` (un service qui importe une
  façade : interdit par `rule-architecture`, « Dépendances à éviter ») ; il appelle aussi `getAuthUser()`
  pour nommer l'expéditeur.
- `sendInternalEmailService` (`src/services/email-service.ts:643-667`) envoie à
  **`env.EMAIL_TO ?? env.EMAIL_FROM ?? 'onboarding@resend.dev'`** — une adresse de plateforme, pas le
  paramètre `contact.email` du tenant : **le critère 4 et l'ADR 010 sont violés aujourd'hui**. Gabarit
  `InternalEmail` (`src/lib/emails/internal-email.tsx`) : Tailwind, `#eaeaea`, `text-gray-500`, sans
  `theme.ts` — non conforme au design system §5.

### La limitation de débit en base (s03) — `rate_limit_event`

| Couche     | Fichier                                                                                                  | Ce qu'il fait                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modèle     | `src/db/models/rate-limit-model.ts`                                                                      | `rate_limit_event` : `organization_id` NOT NULL (FK cascade), `fingerprint` text, **`day` `date` (`YYYY-MM-DD`)**, `count` ; unique `(organization_id, fingerprint, day)`. **Aucune colonne horaire ni horodatage.** Non enregistré dans `db.ts` (requêtes par query builder uniquement).                                                                                                                                                                                                                                                                                                    |
| RLS        | `drizzle/migrations/0009_rate_limit_event_rls.sql`                                                       | policy `tenant_isolation` forcée (patron standard).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Repository | `src/db/repositories/rate-limit-repository.ts`                                                           | `incrementRateLimitCounterDao({organizationId, fingerprint, day}): Promise<number>` — `insert … onConflictDoUpdate … set count = count + 1 returning count`, atomique. `purgeRateLimitCountersDao(organizationId, today)` — supprime `day < today` **pour une seule association**.                                                                                                                                                                                                                                                                                                           |
| Service    | `src/services/rate-limit-service.ts`                                                                     | `import 'server-only'`. `consumeMagicLinkRequestQuotaService({organizationId, email}): Promise<{allowed}>` : lit le seuil (`getMagicLinkDailyRequestLimit(await getAssociationSettingsService(orgId))`), `counterDayOf(new Date())` (Europe/Paris), puis `withTenant(orgId, purge + increment)`. **Sans contrôle d'autorisation, délibéré** (visiteur anonyme). Empreinte privée `fingerprintOf(orgId, value)` = `HMAC-SHA256(env.BETTER_AUTH_SECRET, "${orgId}\n${PURPOSE}\n${value}")`, `PURPOSE = 'magic_link.address'` — la constante d'usage est **codée pour s03 seul**, non exportée. |
| Façade     | `src/services/facades/rate-limit-service-facade.ts`                                                      | `consumeMagicLinkRequestQuotaService` seul.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Tests      | `src/services/__tests__/rate-limit-service.test.ts`, `src/db/repositories/rate-limit-repository.test.ts` | À ne pas casser si la table ou le service sont généralisés.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

`docs/architecture.md` l. 369-373 : « Le boilerplate utilise aujourd'hui `RateLimiterMemory` avec l'IP en
clair (`…/contact/actions.ts`) : c'est à corriger […]. Un compteur journalier en base existe depuis s03
(`rate_limit_event`, `rate-limit-service.ts`, empreinte HMAC liée à l'usage) : s08 peut s'y appuyer pour
son propre usage. »

### Les paramètres d'association (s02, ADR 016)

`src/services/types/domain/association-settings-types.ts` :

- `CONTACT_EMAIL_SETTING_KEY = 'contact.email'` (l. 120), type `email`, **`required: true`**, page
  `settings` — saisi au provisioning (`organization-service.ts:724`), ne peut pas être vidé. C'est
  l'adresse que la story appelle « adresse paramétrée du tenant ».
- `FORAGE_EMAIL_SETTING_KEY` (défaut `{fromKey: 'contact.email'}`) — pour s10, pas s08.
- `MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY` : **le précédent exact d'un seuil de limitation** (type
  `number`, défaut `'3'`, `min 1`, `max 20`, `integer`, `unitKey: 'units.requestsPerDay'`, page
  `settings`) + getter `getMagicLinkDailyRequestLimit(settings)` via `numberSettingOf` privé.
- **Aucun getter d'adresse** n'existe : on lit `settings['contact.email'].value` (typé
  `AssociationSettingValue | null`).
- La page « Réglages » est **générée** depuis le registre : déclarer une clé `number` page `settings`
  l'affiche sans écran nouveau (design system §3.1).

Lecture : `getAssociationSettingsService(organizationId)` (`src/services/association-settings-service.ts:39`,
**sans autorisation, délibéré — le commentaire nomme s08 et s10**, ouvre son propre `withTenant`) ;
`getAssociationSettingsDal(organizationId)` (`src/app/dal/association-settings-dal.ts:26`, `'use cache'`,
`cacheLife('hours')`, tag `association-settings:<id>`, invalidé par `updateTag` dans
`bureau/reglages/actions.ts`) ; `getCurrentAssociationSettingsDal()`.

### L'envoi d'email (s03, ADR 005 / 017)

- Contrat `src/lib/emails/transport/email-transport.ts` : `EmailMessage = {from, to, subject, html?,
text}` — **pas de `replyTo`**, pas de `cc`. `EmailTransport = {send(message): Promise<void>}`.
  `EmailTransportError` / `isEmailTransportError`. Brevo (`brevo-transport.ts`, corps `sender, to,
subject, htmlContent, textContent`), Resend, `file` (JSON par message dans `EMAIL_OUTBOX_DIR`, défaut
  hors production, lu par `e2e/magic-link.spec.ts:63-82`), `memory` (tests).
- `sendEmailService(payload: SendEmailPayload, options?: {recipientType?})` (`email-service.ts:126`) :
  `recipientType` par défaut **`'client'`** ; `shouldSendEmail` lit `app_settings` (`email.enabled`,
  `email.enabled_for_admins`, `email.enabled_for_clients`) et **`getBooleanSettingService` rend `false`
  si la ligne est absente** — seul `'system'` court-circuite. Les trois clés sont seedées à `true`
  (`seed.ts:503-505`), mais une base sans ces lignes n'envoie rien, **sans erreur**. Expéditeur :
  `getEmailFrom()` = `app_settings.email.communication_email`, sinon `env.EMAIL_FROM`, sinon
  `'onboarding@resend.dev'` — **plateforme**, pas association.
- Seul gabarit conforme au design system : `MagicLinkMail` (`src/lib/emails/magic-link-email.tsx`, `theme.ts`
  : `EMAIL_COLORS`, `EMAIL_FONTS`, `getEmailAccent`, type `MagicLinkEmailAssociation`). Patron de service :
  `sendMagicLinkEmailService` (locale **explicite**, texte complet, `{recipientType: 'system'}`).
- **Budget quotidien d'envoi : n'existe pas.** `grep daily_send_budget|send_budget` dans `src/`,
  `drizzle/` : rien. C'est **s26** (critère : « décompté dans l'adaptateur d'envoi par tout email
  sortant ») ; ADR 005 l. 21 : « Le quota est une propriété du transport, pas de l'appelant ». s08 n'a
  rien à décompter lui-même, à condition de passer par `sendEmailService`.

### Registre d'actions (s03b, ADR 018)

`src/services/types/domain/action-registry-types.ts` : `ActionIdConst` (l. 43-60) =
`ASSOCIATION_IDENTITY_UPDATE`, `ASSOCIATION_SETTINGS_UPDATE`, `PAGE_MANAGE`, `SITE_NAVIGATION_MANAGE`,
toutes `['owner', 'board']` dans `ACTION_REGISTRY`. `canPerformAction(user, organizationId, actionId)`
(`src/services/authorization/action-registry-authorization.ts:18`) : SuperAdmin passe, action absente
refusée. **Aucune entrée pour lire les messages reçus.**

### Back-office du bureau

Routes `src/app/[locale]/(bureau)/bureau/{identite,navigation,pages,reglages}`. Patron de liste :
`bureau/pages/page.tsx` — `<Suspense>` → section qui `Promise.all([requireCurrentTenantDal(),
canManageCurrentPagesDal()])`, `<BureauAccessDenied />` si refus, puis DAL de liste. Barre latérale :
`src/components/features/association/bureau-sidebar.tsx:21-36`, `NAV_GROUPS` — « Le site » (`pages`,
`navigation`), « L'association » (`identite`, `reglages`), libellés `BureauIdentityPage.nav`.

### Site public (s04, s04b)

`(public)/layout.tsx` résout le tenant (`requireCurrentTenantDal`) et le menu
(`getCurrentPublicSiteNavigationDal`). Le menu ne pointe **que vers des pages CMS**
(`menu_item.page_id` NOT NULL, lien `/${entry.slug}`). Le pied de page est un markdown libre
(`SITE_FOOTER_SETTING_KEY = 'site.footer_content'`, rendu par `renderPageBlock`) : un lien `/contact`
peut y être écrit à la main. Le seul lien codé vers `/contact` est dans `src/app/[locale]/page.tsx:70`.

---

## Anchor points

- **Formulaire public** : `src/app/[locale]/(public)/contact/` (page, formulaire, schéma, action) — à
  reprendre, pas à recréer. La page est `'use cache'` : tout ce qui dépend du tenant (nom de
  l'association dans l'intro, par exemple) doit rester hors de ce scope ou passer par le layout.
- **Persistance des messages** : `user_submissions` (réemploi) ou nouvelle table (voir Trap 1). Si
  nouvelle table : modèle dans `src/db/models/`, enregistrement dans `src/db/models/db.ts` (l. 32-44),
  policy par `drizzle-kit generate --custom` sur le patron `0009` / `0013` / `0015`. Dernière migration
  sur `main` : `0015_menu_item_rls.sql`.
- **Limiteur** : `src/services/rate-limit-service.ts` + `src/db/repositories/rate-limit-repository.ts` +
  `rate_limit_event` — à généraliser par **usage** et par **fenêtre** (voir Trap 3), pour que s10 le
  réemploie sans en écrire un second.
- **Seuil** : nouvelle clé `number` dans `ASSOCIATION_SETTINGS_REGISTRY` sur le patron de
  `MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY`, + getter à côté de `getMagicLinkDailyRequestLimit`, +
  libellés dans le namespace `AssociationSettings` de `messages/fr.json`. Seed :
  `src/db/scripts/tenant-settings-seed.ts` (testé par `tenant-settings-seed.test.ts`).
- **Notification** : `src/services/email-service.ts` (nouveau `send…EmailService` appelant
  `sendEmailService`), gabarit dans `src/lib/emails/` sur le patron `MagicLinkMail` + `theme.ts`,
  libellés sous `email.…` dans `messages/fr.json`. Façade `email-service-facade.ts`.
- **Registre d'actions** : nouvelle entrée dans `ActionIdConst` / `ACTION_REGISTRY` pour la lecture des
  messages par le bureau.
- **Back-office** : nouvelle route sous `src/app/[locale]/(bureau)/bureau/` (liste + détail), entrée
  dans `NAV_GROUPS` (`bureau-sidebar.tsx`), DAL sans `'use cache'` (donnée d'administration) derrière
  `<Suspense>`.
- **Opération de purge « appelable seule »** : aucun point d'entrée planifiable n'existe (pas de route
  de tick, `src/app/api/` = `auth`, `identity`, `inngest`, `pages`, `webhooks` ; scripts dans
  `src/db/scripts/` lancés par `tsx`). s08 livre la fonction ; s12b choisit le déclencheur.
- **e2e** : nouveau spec sur le patron de `e2e/page-cms.spec.ts` / `e2e/magic-link.spec.ts` (tenants
  A = `http://localhost:PORT`, B = `http://127.0.0.1:PORT`, boîte de sortie `file`, SQL direct pour la
  preuve RLS et « aucune IP en clair »).

## Verified APIs / functions

| Nom                                                    | Fichier                                                          | Signature vérifiée                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `submitContactAction`                                  | `src/app/[locale]/(public)/contact/actions.ts:29`                | `(_prevState: ContactFormState, formData: FormData) => Promise<ContactFormState>` ; `ContactFormState = {success; message}`   |
| `createContactFormSchema`                              | `…/contact/contact-form-validation.ts:18`                        | `(t: (key: string) => string) => ZodObject` (extend de `contactFormSchema`)                                                   |
| `getCurrentTenantDal`                                  | `src/app/dal/tenant-dal.ts:71`                                   | `cache(async () => Promise<TenantDTO \| undefined>)` — `x-forwarded-host` puis `host`                                         |
| `requireCurrentTenantDal`                              | `src/app/dal/tenant-dal.ts:93`                                   | `() => Promise<TenantDTO>` (`notFound()` sinon)                                                                               |
| `withCurrentTenant`                                    | `src/app/dal/tenant-dal.ts:112`                                  | `<T>(callback: () => Promise<T>) => Promise<T>` — sans tenant, exécute **sans** scope                                         |
| `getDb` / `withTenant` / `withRlsBypass`               | `src/db/tenant-scope.ts:122/128/144`                             | `getDb(): ScopedDb` ; `withTenant(organizationId, callback)` (UUID exigé) ; `withRlsBypass(callback)`                         |
| `createUserSubmissionService`                          | `src/services/user-submission-service.ts:35`                     | `(data: CreateUserSubmission) => Promise<UserSubmissionModel>` — envoie `sendInternalEmailService` et avale son échec         |
| `getAllUserSubmissionsWithPaginationDao`               | `src/db/repositories/user-submission-repository.ts:41`           | `(pagination: Pagination, filters?: UserSubmissionFilters) => Promise<PaginatedResponse<UserSubmissionWithUser>>`             |
| `getUserSubmissionByIdDao`                             | idem `:22`                                                       | `(id: string) => Promise<UserSubmissionWithUser \| undefined>`                                                                |
| `canManageUserSubmissions`                             | `src/services/authorization/user-submission-authorization.ts:15` | `() => Promise<boolean>` = `isUserAdmin(getAuthUser())` (rôle global)                                                         |
| `incrementRateLimitCounterDao`                         | `src/db/repositories/rate-limit-repository.ts:19`                | `({organizationId, fingerprint, day}: RateLimitCounterKey) => Promise<number>`                                                |
| `purgeRateLimitCountersDao`                            | idem `:40`                                                       | `(organizationId: string, today: string) => Promise<void>` — `day < today`, une association                                   |
| `consumeMagicLinkRequestQuotaService`                  | `src/services/rate-limit-service.ts:59`                          | `(quota: {organizationId; email}) => Promise<{allowed: boolean}>`                                                             |
| `getAssociationSettingsService`                        | `src/services/association-settings-service.ts:39`                | `(organizationId: string) => Promise<ResolvedAssociationSettings>` — sans autorisation                                        |
| `getAssociationSettingsDal` / `associationSettingsTag` | `src/app/dal/association-settings-dal.ts:26/14`                  | `(organizationId) => Promise<ResolvedAssociationSettings>` (`'use cache'`) ; `(id) => 'association-settings:<id>'`            |
| `CONTACT_EMAIL_SETTING_KEY`                            | `association-settings-types.ts:120`                              | `'contact.email'`                                                                                                             |
| `getMagicLinkDailyRequestLimit`                        | idem `:434`                                                      | `(settings: ResolvedAssociationSettings) => number` (patron de getter numérique)                                              |
| `sendEmailService`                                     | `src/services/email-service.ts:126`                              | `(payload: {to; subject; text; from?; react?}, options?: {recipientType?: 'admin' \| 'client' \| 'system'}) => Promise<void>` |
| `sendInternalEmailService`                             | idem `:643`                                                      | `({title, data}) => Promise<void>` → `env.EMAIL_TO ?? env.EMAIL_FROM ?? …` (à ne pas réutiliser pour s08)                     |
| `EmailMessage` / `EmailTransport`                      | `src/lib/emails/transport/email-transport.ts:8/18`               | `{from; to; subject; html?; text}` — **sans `replyTo`**                                                                       |
| `isEmailTransportError`                                | idem `:46`                                                       | `(error: unknown) => error is EmailTransportError`                                                                            |
| `getEmailAccent`, `EMAIL_COLORS`, `EMAIL_FONTS`        | `src/lib/emails/theme.ts:56/13/31`                               | couleurs hex des gabarits                                                                                                     |
| `resolveSupportedLocale`                               | `src/lib/helper/locale-helper.ts:39`                             | `(value: unknown) => SupportedLocale` (locale explicite d'une Server Action)                                                  |
| `requestMagicLinkAction`                               | `src/app/[locale]/(auth)/action.ts:208`                          | précédent d'action **publique** : locale du formulaire, `errors: [{field, message}]`, statut `invalid \| sent \| unavailable` |
| `canPerformAction`                                     | `src/services/authorization/action-registry-authorization.ts:18` | `(user, organizationId, actionId) => boolean`                                                                                 |
| `RESERVED_PAGE_SLUGS`                                  | `src/services/types/domain/page-block-types.ts:89`               | contient déjà `'contact'`                                                                                                     |
| `getOrganizationsDao`                                  | `src/db/repositories/organization-repository.ts:103`             | `(pagination: Pagination) => Promise<PaginatedResponse<OrganizationModel>>` — `organization` est exemptée de RLS              |

## Traps & constraints

1. **`user_submissions` : réemployer ou non — le code tire dans les deux sens.**
   Pour : table déjà scopée (RLS forcée, `0004`), repository sur `getDb()`, tri `desc(createdAt)`,
   pagination, `read`/`archived`, liste et détail déjà codés côté SuperAdmin. Contre :
   - elle mélange trois natures (`contact`, `feedback` du bouton `QuickFeedbackButton` de l'espace
     `(app)`, `support`) : la liste du bureau doit filtrer `type = 'contact'`, sinon le bureau lit les
     retours produit du boilerplate ;
   - `organization_id` **nullable, `onDelete: 'set null'`** : une ligne orpheline devient invisible
     sous RLS au lieu d'être supprimée avec l'association ;
   - `metadata` jsonb libre : c'est précisément là que l'IP en clair est écrite aujourd'hui ;
   - les types domaine importent le modèle Drizzle ;
   - **`e2e/tenant-isolation.spec.ts` (preuve RLS de s01) repose sur cette table et sur
     `/en/admin/submissions`** : toute modification de schéma, de policy ou du BO SuperAdmin doit garder
     ce spec vert.
     Une table dédiée laisserait en outre le classement RLS de `docs/architecture.md` (l. 218-261) à
     compléter. Ce n'est pas s22 : s22 a son propre modèle (catégorie, membre identifié) — ne pas
     anticiper une table commune.
2. **Rien de la notification actuelle n'est gardable.** `sendInternalEmailService` vise `env.EMAIL_TO`
   (plateforme) ; il est appelé **depuis le service** par la **façade** (import interdit) ; son échec
   est **avalé** ; le gabarit `InternalEmail` ignore `theme.ts`. La destination doit être
   `settings['contact.email']` du tenant, lue **à l'envoi** (critère 4 : « le message suivant »). Si la
   lecture passe par `getAssociationSettingsDal` (`'use cache'`), l'invalidation par
   `updateTag(associationSettingsTag(id))` déjà posée dans `bureau/reglages/actions.ts` suffit ;
   `getAssociationSettingsService` lit sans cache.
3. **`rate_limit_event` ne sait compter ni « par heure » ni « plus de 24 h ».** Sa granularité est le
   **jour calendaire** (`day date`), sa purge est « jours antérieurs à aujourd'hui, pour une
   association ». Les critères 5 et 7 demandent une fenêtre d'**une heure** et une purge à **24 h
   glissantes**, vérifiée « de part et d'autre des 24 h » — ce qui exige un horodatage. Options : étendre
   la table (colonne de fenêtre/horodatage — sans casser l'unicité, l'incrément atomique ni les tests de
   s03), ou une table sœur. Dans les deux cas l'usage (`magic_link.address` vs `contact.ip`) doit entrer
   dans l'empreinte, et la constante d'usage de s03 est aujourd'hui privée. Si la table est partagée, la
   purge « 24 h » s'appliquera aussi aux lignes de s03 : sans effet réel (s03 purge déjà les jours
   passés), mais le critère 7 « n'en touche aucune autre » se teste alors sur les deux usages.
4. **Purge « appelable seule » = hors requête, hors domaine, donc hors tenant.** Sous RLS forcée, une
   suppression sans scope ne supprime **rien** (et ne lève rien). Deux voies : boucler sur les
   associations (`organization` est exemptée, lisible sans scope) en ouvrant `withTenant` pour chacune,
   ou `withRlsBypass()` — **toute nouvelle occurrence est un point d'arrêt de revue** (AGENTS.md). À
   trancher au plan ; le piège classique est un test unitaire vert (repositories mockés) et une purge qui
   ne fait rien en vrai. La preuve réelle est e2e/SQL.
5. **L'IP du visiteur : `x-forwarded-for` est fourni par le client.** L'action actuelle prend l'en-tête
   entier (`a, b, c` si plusieurs proxys) : un spammeur qui fait varier `x-forwarded-for` change
   d'empreinte à chaque envoi et contourne la limite. `docs/architecture.md` l. 313-314 le dit pour s03
   (« aucune IP n'est lue ici (la première entrée de `x-forwarded-for` est fournie par le client) ») et
   renvoie à **s12b** la vérification des en-têtes derrière le reverse proxy du VPS. `'unknown'` en repli
   ferait partager un seul compteur à tous les visiteurs sans en-tête. En e2e, tous les tests sortent de
   `127.0.0.1` : les tests de seuil se polluent entre eux si le compteur n'est pas isolé (tenant dédié,
   purge, ou en-tête contrôlé).
6. **Empreinte « hachée » ≠ hash nu.** L'espace IPv4 (2³²) se renverse par force brute : un SHA-256 sans
   secret n'est pas une pseudonymisation. Le patron s03 — HMAC-SHA256 par `env.BETTER_AUTH_SECRET`, lié
   à l'association et à l'usage — est le bon ; `fingerprintOf` est privé à `rate-limit-service.ts`. Le
   critère 6 (« aucune IP en clair en base ») couvre aussi `user_submissions.metadata.ip` et les **logs**
   (l'intercepteur de façade logge les appels ; ne pas passer l'IP en argument d'une méthode de service
   exposée si ses arguments sont journalisés en debug).
7. **Budget quotidien d'emails (s26) : rien à brancher, un invariant à tenir.** Le budget n'existe pas
   encore ; il sera décompté **dans l'adaptateur** par tout email qui le traverse. s08 doit donc
   envoyer **exclusivement** par `sendEmailService` → `getEmailTransport()`, jamais par un transport
   instancié à la main. Conséquence à connaître : la limitation par IP est aussi, jusqu'à s26, la seule
   borne sur le nombre de notifications qu'un formulaire public peut déclencher (seuil × nombre d'IP) —
   un réseau de proxys peut consommer le quota Brevo de 300/jour du compte **partagé** entre
   associations (ADR 005). Pas un critère de s08, mais à dire.
8. **`recipientType` et `app_settings`.** Par défaut `'client'` ; `'admin'` et `'client'` sont coupés
   si `email.enabled*` manque en base (`getBooleanSettingService` → `false`), **sans erreur**. Le critère
   1 serait alors silencieusement faux en production. `'system'` n'est jamais coupé mais désigne les
   emails de connexion.
9. **Échec d'envoi après persistance.** Critère 1 : « enregistre, confirme et notifie ». Si le transport
   échoue (`EmailTransportError`), le message est déjà en base et consultable (l'exigence « l'email ne
   suffit pas » est tenue) ; que dit l'écran au visiteur ? Le précédent s03 rend un état
   `unavailable` ; ici l'échec de notification ne devrait pas faire croire au visiteur que son message
   est perdu. Aucune file de réessai n'existe (s26/ADR 006).
10. **Critère 2 : erreurs par champ, côté serveur aussi.** L'action rend aujourd'hui un seul `message`
    global et valide à la main (regex) : il faut valider avec le schéma partagé (`createContactFormSchema`
    côté serveur, `rule-form-front-and-back`) et rendre `errors: [{field, message}]` (précédent
    `requestMagicLinkAction`). « Message vide » : l'actuel `min(10)` refuse aussi un message court non
    vide — à garder ou non (Open question 6). Le champ `subject` est obligatoire aujourd'hui alors que la
    story ne nomme que « email » et « message ».
11. **Locale explicite.** L'email part d'une Server Action : `rule-service-emails-internationalization`
    impose `resolveSupportedLocale(formData.get('locale'))` et `getTranslations({locale, namespace})` dans
    le service **et** le gabarit (le cookie `NEXT_LOCALE` est absent d'un navigateur neuf → email en
    anglais, bogue attrapé en s03). L'action actuelle utilise `getTranslations('ContactPage')` implicite.
12. **Server Action publique vs `rule-safe-server-action`.** La règle impose `requireActionAuth()` et ne
    prévoit pas d'exception anonyme ; `requestMagicLinkAction` est le précédent d'action publique. Le
    service de création doit rester **délibérément sans autorisation** pour un visiteur (comme
    `consumeMagicLinkRequestQuotaService`), avec le commentaire qui le dit ; la lecture BO, elle, passe par
    `canPerformAction` et une action déclarée au registre (sinon défaut de revue).
13. **Autorisation de lecture : rôle global aujourd'hui.** `canManageUserSubmissions` = `isUserAdmin`
    (admin/super_admin **globaux**) : un membre du bureau (`owner`/`board`) n'y passe pas. Ne pas élargir
    ce contrôle en place — il garde aussi la page SuperAdmin et le spec d'isolation — mais ajouter le
    contrôle par action pour le bureau.
14. **Anti-spam au-delà du débit.** Le design system (§7, l. 862) pose « **aucun captcha visible**,
    limitation par débit côté serveur » pour la connexion ; le PRD ne demande que le débit. Un champ
    piège (honeypot) ou un délai minimal de saisie n'est ni exigé ni couvert par le design system.
    Ne pas l'ajouter sans décision (Open question 7).
15. **Design system — écarts de l'écran actuel.** Carte de succès **verte** : interdit (§3.2 : « `alert`
    **neutre** avec `CircleCheck` en `primary` — il n'y a pas de token « succès », pas de vert ») ; erreur
    globale seule alors que §3.1 veut bordure 2 px + message sous le champ + résumé en tête avec ancres ;
    icônes `Mail`/`Send` hors du vocabulaire figé §1.7 (qui n'en prévoit aucune pour « message ») ;
    libellés « Contactez-nous… Nous sommes là pour vous » génériques. Côté email : §5.6 — objet préfixé
    du nom de l'association, 60 caractères, pré-en-tête, « réponse dirigée vers une boîte réellement lue »
    ; §5 version texte obligatoire, couleurs de `theme.ts`. Aucun écran « messages reçus » ni email de
    notification de message n'est maquetté : **`/ks-design s08` est requis** (story UI) et doit
    composer avec la table/cartes empilées (§3.5, 25 lignes / 10 cartes) et l'état vide (§3.2).
16. **Répondre au visiteur : le contrat ne porte pas `replyTo`.** Le bureau qui reçoit la notification
    répondra naturellement par « Répondre » — qui vise l'expéditeur plateforme (`getEmailFrom()`), pas le
    visiteur. Ajouter `replyTo` touche le contrat `EmailTransport` (ADR 005/017) et ses quatre
    adaptateurs (Brevo : `replyTo: {email}` ; Resend : `replyTo`) ; ne pas l'ajouter oblige à mettre
    l'adresse du visiteur en clair dans le corps. Décision de contrat, pas de détail.
17. **Cache Components.** `contact/page.tsx` est `'use cache'` : n'y lire ni tenant, ni `headers()`, ni
    horloge. Le DAL de la liste du bureau ne se cache pas (donnée d'administration, `<Suspense>`, comme
    `user-submission-dal.ts`). Aucun `new Date()` ni `logger` dans un scope caché — le calcul de fenêtre
    horaire vit dans le service, hors cache.
18. **Recouvrements avec les stories voisines.**
    - **s04** : `/contact` déjà réservé (`RESERVED_PAGE_SLUGS`) ; le cadre public vient du layout. Rien à
      modifier.
    - **s04b** : le menu ne peut pas pointer vers `/contact` (`menu_item.page_id` NOT NULL) — même
      limite que la liste des actualités de s05. Seuls le pied de page (markdown) ou un lien dans une page
      y mènent. Hors critères de s08 ; à signaler, pas à combler en silence.
    - **s05** (en cours sur la branche courante, plan non commité) : ajoute sa route BO, son entrée
      `NAV_GROUPS`, son action au registre, sa migration et ses clés `messages/fr.json`. s06, s07, s09 en
      font autant en parallèle. **Fichiers chauds** : `action-registry-types.ts`, `bureau-sidebar.tsx`,
      `messages/fr.json`, `db.ts`, numérotation des migrations `0016+` (collision de journal Drizzle entre
      branches), tableau de classement RLS de `docs/architecture.md`. Rebaser sur `main` à jour avant de
      générer une migration.
    - **s10** réemploiera le limiteur (même empreinte, même purge) : le rendre générique par usage dès
      maintenant.
    - **s12b** planifie la purge : l'opération doit être invocable sans requête HTTP ni domaine.
    - **s22** : modèle distinct, ne pas fusionner.
19. **Dérive de documentation.** `rate_limit_event` (s03) n'apparaît pas dans le classement RLS de
    `docs/architecture.md` (5 tables scopées listées, « 24 tables ») alors qu'elle est scopée par `0009`.
    Aucun test ne vérifie ce classement : si s08 ajoute ou modifie une table, le tableau est à corriger à
    la main (et l'oubli de s03 avec, ou à signaler).
20. **Tests existants à garder verts** : `contact/actions.test.ts` (3 tests), `user-submission-service.test.ts`
    (≈ 20 tests, dont le mock de `sendInternalEmailService`), `user-submission-dal.test.ts`,
    `rate-limit-service.test.ts`, `rate-limit-repository.test.ts`, `association-settings-form.test.tsx`
    et `tenant-settings-seed.test.ts` (registre), `e2e/tenant-isolation.spec.ts`,
    `e2e/association-settings.spec.ts`. Process : `pnpm test --run` ; migrations par `pnpm db:generate`
    ou `drizzle-kit generate --custom` ; branche `feature/s08-formulaire-contact` depuis `main`.

## Open questions

1. **Table des messages** : réemployer `user_submissions` (filtrée `type = 'contact'`, avec
   `organization_id` rendu obligatoire ?) ou créer une table dédiée aux messages du site ? Et que devient
   le BO SuperAdmin `/admin/submissions` et le bouton de feedback du boilerplate ? Le spec
   `tenant-isolation` en dépend (Trap 1). Décision structurante → ADR probable.
2. **Forme du limiteur** : étendre `rate_limit_event` (horodatage / fenêtre, usage dans l'empreinte) ou
   table sœur ? Fenêtre « par heure » fixe (heure calendaire) ou glissante (60 dernières minutes) ? Le
   critère 5 ne tranche pas.
3. **Purge hors requête** : boucle par association sous `withTenant`, ou `withRlsBypass()` (point
   d'arrêt de revue) ? Et sous quelle forme l'exposer à s12b (fonction de service, script `tsx`, route
   protégée) — s08 livre l'opération, s12b le déclencheur ; où s'arrête s08 ?
4. **Source de l'IP** : quel en-tête, quelle entrée de la chaîne, et que faire sans IP ? À coordonner
   avec s12b (reverse proxy du VPS). En attendant, accepter le contournement par `x-forwarded-for` forgé ?
5. **Seuil** : nom de la clé, valeur par défaut, bornes min/max, unité (« envois par heure ») — sur le
   patron de `login.link_requests_per_address_per_day`. Défaut du boilerplate : 3 par 5 minutes ; la
   story ne donne aucun chiffre (CDCT §4.6 à consulter pour La Fourche : valeur de seed, pas constante).
6. **Champs du formulaire** : garder `subject` (obligatoire aujourd'hui, NOT NULL en base) ? Nom du
   visiteur ? Longueur minimale du message (10 caractères aujourd'hui vs « message vide » dans le
   critère) ? Consentement / mention RGPD sur la conservation du message (aucune durée de rétention
   n'est fixée pour les messages eux-mêmes, seulement pour les empreintes) ?
7. **Anti-spam complémentaire** : un champ piège invisible est-il voulu, ou le débit seul suffit-il
   (design system : « aucun captcha visible ») ?
8. **Réponse au visiteur** : ajouter `replyTo` au contrat `EmailTransport` (ADR 005/017, quatre
   adaptateurs) ou écrire l'adresse du visiteur dans le corps de la notification ? Expéditeur : adresse
   de plateforme (`getEmailFrom()`) avec nom de l'association (`Nom <adresse>`) ?
9. **Échec de notification** : que voit le visiteur quand le message est enregistré mais l'email n'est
   pas parti (Trap 9) ? Le bureau voit-il dans le BO qu'une notification a échoué ?
10. **`recipientType`** de la notification (`'admin'`, `'client'` ou `'system'`), vu la coupure silencieuse
    par `app_settings` (Trap 8).
11. **Back-office** : lecture seule (critère 3) ou aussi « lu / non lu » et archivage, déjà présents dans
    le repository ? Une entrée de registre « lire les messages » pour `['owner', 'board']` suffit-elle ?
    Place dans la barre latérale (« Le site » ou « L'association ») et libellé — à fixer en `/ks-design`.
12. **Accès depuis le site** : faut-il un lien vers `/contact` ailleurs que dans le pied de page écrit à
    la main (Trap 18, s04b) ? Hors critères, à signaler.
