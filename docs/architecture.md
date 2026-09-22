# Architecture — ASL-CMS (Lp)

> Le **quoi** et le **pourquoi** sont dans `docs/prd.md`. Ce document fixe le **comment** et les
> conventions. Les décisions structurantes sont chacune motivée dans un ADR (`docs/decisions/`) ;
> ce document en donne la vue d'ensemble et renvoie au détail.
>
> Base : boilerplate **ship-saas** (ADR 001). Les conventions ci-dessous sont celles du boilerplate,
> **relevées dans le code**, complétées des écarts qu'ASL-CMS impose. Un écart non listé ici est un
> écart non décidé.

## Stack

| Couche                 | Technologie                                                                                                     | Note                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Framework              | Next.js **16.3** (App Router, Turbopack), React **19.2**                                                        | `cacheComponents: true` — rien n'est caché par défaut |
| Langage                | TypeScript strict                                                                                               | `pnpm` imposé, jamais `npm`                           |
| UI                     | Tailwind **4**, shadcn/ui, Radix UI, `lucide-react` / `@tabler/icons-react`                                     | `components.json` présent                             |
| Édition                | **Milkdown** (WYSIWYG) + **@dnd-kit** (ordre des blocs)                                                         | ADR 007 — déjà dans les dépendances                   |
| Base de données        | PostgreSQL **17**, Drizzle ORM                                                                                  | RLS forcée, ADR 002                                   |
| Authentification       | **Better Auth 1.7.1** — plugins `magicLink`, `organization`, `admin`, `twoFactor`, `apiKey`, `bearer`, `stripe` | Lien magique natif (s03)                              |
| Autorisation           | **CASL** (`@casl/ability`)                                                                                      | Rôles globaux + rôles d'organisation                  |
| Validation             | **Zod 4**                                                                                                       | Client (RHF) _et_ serveur, schémas partagés           |
| i18n                   | **next-intl**, locale unique `fr` sans préfixe                                                                  | ADR 008                                               |
| Email                  | **Brevo**, derrière le contrat `EmailTransport` ; gabarits `react-email`                                        | ADR 005, ADR 017 — Resend en secours                  |
| Fichiers               | Disque du **VPS**, seul adaptateur du factory de stockage                                                       | ADR 004 — Supabase retiré en s12a                     |
| Tâches planifiées      | Table `scheduled_job` + cron système                                                                            | ADR 006 — remplace Inngest                            |
| Facturation plateforme | **Stripe** (Zourite Studio ↔ association)                                                                       | Conservé du boilerplate                               |
| Facturation membres    | **Pennylane**, derrière un contrat interchangeable                                                              | ADR 011 — sans rapport avec Stripe                    |
| Vote                   | **ASL Community**, derrière un contrat interchangeable                                                          | ADR 011 — module activable                            |
| Observabilité          | Sentry, Winston (`@/lib/logger`)                                                                                | Logger **serveur uniquement**                         |
| Tests                  | Vitest (unitaire, `jsdom` + `node`), Playwright (e2e)                                                           | Pas de couche intermédiaire, pas de TestContainers    |
| Hébergement            | VPS LWS France, 2 vCore / 4 Go / 100 Go SSD, infogéré                                                           | Un seul runtime, une seule base                       |

`docker-compose.yml` et le `Dockerfile` du dépôt servent **l'environnement de développement agentique**
(conteneur + Postgres jetable), pas la production.

## Repo structure

```
src/
  app/
    [locale]/            Routes. Le segment reste, le préfixe est masqué (ADR 008)
      (public)/          Site public — visiteur anonyme
      (app)/             Espace membre et back-office bureau — session requise
      admin/             SuperAdmin Zourite Studio — bloquant, rend un vrai 403
    api/                 Routes API (auth, webhooks, tick du planificateur)
    dal/                 Data Access Layer : cache + transformation en DTO
  components/
    ui/                  shadcn/ui — primitives, non métier
    features/<domaine>/  Composants métier, un dossier par domaine
    context/, hooks/
  db/
    models/              Schémas Drizzle + types `*Model`
    repositories/        Requêtes SQL — suffixe `Dao`
    scripts/             migrate, seed, clear, check
  services/
    <domaine>-service.ts Logique métier : validation puis autorisation puis repository
    facades/             Interface exposée à la présentation (+ interceptors de log)
    authorization/       `can*` par domaine, adossés à CASL
    validation/          Schémas Zod de service
    types/domain/        Types de domaine — les seuls que la présentation connaît
  lib/                   Adaptateurs techniques (emails, files, stripe, better-auth, helper)
  i18n/, proxy.ts, env.ts
drizzle/migrations/      Générées, jamais écrites à la main
e2e/                     Playwright — seul endroit où la RLS est réellement testée
docs/                    PRD, stories, architecture, decisions/, research/, plans/, reviews/
.claude/rules/           Règles canoniques (.cursor/rules/ en est une copie générée)
```

## Patterns & conventions

### Architecture en couches — la règle centrale

```
Présentation → Façade → Service (validation + autorisation) → Repository → Drizzle
     ↘ lecture : DAL (cache, DTO) ↗
```

- La présentation **n'importe jamais** `src/db/models` ni `src/db/repositories`. Un type nécessaire à
  l'interface appartient à `src/services/types/domain/`.
- **Lectures** : par le DAL, qui porte le cache et transforme en DTO. **Mutations** : par Server Action.
- Un service **n'importe jamais sa façade** ni celle d'un autre service.
- Tout service applique, dans cet ordre : `safeParse` Zod → `AuthorizationError` si le `can*` refuse →
  appel du repository. Le modèle canonique est **`provisionOrganizationService` dans
  `src/services/organization-service.ts`** (désigné par s01 en remplacement de `createProjectService`,
  parti avec l'ADR 009). ⚠️ Les fonctions **plus anciennes** du même fichier, `createOrganizationService`
  en tête, font l'inverse — autorisation puis validation. C'est l'écart du boilerplate, pas la
  convention : ne pas les recopier.
- Détail complet : `.claude/rules/00-generals/rule-architecture.md`.

### Multi-tenant — la convention qui engage 42 stories

- Toute table métier porte `organization_id`, est couverte par une policy RLS **forcée**, et sa story
  prouve l'isolation par un test d'accès croisé entre deux tenants (ADR 002).
- **Une seule exception, et elle est bornée** : `member` et `invitation` portent `organization_id`
  sans être des données métier — c'est le **plan identité**, exempté par l'ADR 014 parce que sa
  lecture principale précède la résolution du tenant. Aucune table métier future n'hérite de cette
  exemption. Le classement complet des 21 tables est plus bas, section « Data model ».
- Les repositories appellent `getDb()`, **jamais `db` directement** : `getDb()` retourne la transaction
  du scope de tenant courant s'il y en a un.
- Tout chemin serveur touchant une table métier s'exécute dans `withTenant(organizationId, ...)`.
  **Un oubli ne fuite pas : il ne retourne rien.** Symptôme sûr, mais déroutant — c'est la première
  hypothèse à tester devant un « zéro résultat » inexpliqué.
- Le tenant vient du **domaine appelé** (ADR 003), résolu côté serveur et non dans le middleware.
- Le bypass SuperAdmin (`withRlsBypass()`) est la seule porte dérobée : toute nouvelle occurrence dans
  un diff est un point d'arrêt de revue.
- **La RLS n'est pas testable en test unitaire** — `src/db/models/db.ts` refuse toute connexion en test
  et les repositories sont mockés. Le test d'isolation est un **test e2e Playwright**.

### Rien en dur

Adresses de notification, catégories, seuils, textes par défaut, activation des relances : tout va en
paramètre d'association (ADR 010). Les valeurs du CDCT §4.6 sont des **valeurs de seed du premier
tenant**, pas des constantes. Une valeur codée en dur est un échec de review.

**Forme retenue par s02 (ADR 016, [`docs/decisions/016-registre-des-parametres-en-code.md`](decisions/016-registre-des-parametres-en-code.md))** :
la définition d'un paramètre (type, obligatoire, défaut constant ou référence à une autre clé,
libellés, page) vit dans un **registre typé dans le code**
(`src/services/types/domain/association-settings-types.ts`) ; `organization_setting` ne stocke que
les valeurs. Absence de ligne = défaut du registre. Lecture cachée par association
(`getAssociationSettingsDal`, tag `association-settings:<id>`), invalidée par `updateTag`.

Les **secrets** ne sont pas des paramètres : ils vivent dans `@/env` (validation Zod, `@t3-oss/env-nextjs`).
`process.env` en accès direct est interdit par ESLint.

### Cache Components

- Lecture publique → `'use cache'` + `cacheLife` + `cacheTag` **dans la fonction du DAL**.
- Donnée par utilisateur → **pas de cache**, `<Suspense>` et streaming. Ne jamais `await` la session au
  niveau supérieur d'un layout.
- Interdits dans un scope `'use cache'` : `new Date()`, `Math.random()`, `headers()`, `cookies()`, et
  **le `logger`** — l'intercepteur de services horodate à chaque appel. Devant une erreur de prerender
  sur une page sans rapport, **suspecter le logger avant la page**.
- Une modification que l'utilisateur doit voir tout de suite s'invalide par `updateTag`, pas `revalidateTag`.
- Détail : `.claude/rules/01-presentation/rule-react-cache-next-cache.md`.

### Nommage

| Élément                   | Convention        | Exemple                       |
| ------------------------- | ----------------- | ----------------------------- |
| Fichier                   | kebab-case        | `member-parcel-service.ts`    |
| Composant React           | PascalCase        | `WaterAnalysisForm`           |
| Fonction de repository    | suffixe `Dao`     | `getMemberByIdDao`            |
| Fonction transactionnelle | suffixe `TxnDao`  | `createMemberAndParcelTxnDao` |
| Fonction de service       | suffixe `Service` | `getMemberByIdService`        |
| Fonction du DAL           | suffixe `Dal`     | `getMemberByIdDal`            |
| Fonction d'autorisation   | préfixe `can`     | `canReadMember`               |
| Server Action             | suffixe `Action`  | `updateMemberAction`          |

Style : Prettier — 2 espaces, **guillemets simples, pas de point-virgule**, 80 colonnes, classes Tailwind triées.
Programmation **fonctionnelle** privilégiée ; un SDK tiers à classes se WRAPPE dans un adaptateur fonctionnel.
Le code nouveau s'ajoute **en fin de fichier**.

### Tests

- **`pnpm test --run`** — jamais `pnpm test`, qui reste en watch et ne rend jamais la main. Le verdict
  est la ligne `Tests N passed`, pas celle de pnpm.
- Unitaire (Vitest) : services, fonctions, composants. Base et authentification **mockées** (`vi.mock`).
  Tester les trois rôles globaux — ADMIN, USER, PUBLIC — et les rôles d'organisation quand ils s'appliquent.
- e2e (Playwright) : parcours complets, **contre le build de production** (`pnpm build && pnpm start`),
  sur un Postgres éphémère seedé. C'est là que vivent les tests de RLS et d'accès croisé.
- Migrations : `pnpm db:generate`, ou `drizzle-kit generate --custom` pour du SQL sur mesure (policies RLS).
  **Jamais de SQL écrit à la main** dans `drizzle/migrations/`, jamais d'édition de `meta/_journal.json`.

## Data model

Le boilerplate fournit `user`, `session`, `account`, `organization`, `member`, `invitation`,
`verification` (Better Auth), `app_settings`, `notifications`, `posts`, plus les tables Stripe
(`subscription`, `subscription_plan`).

⚠️ **Il n'y a pas de table `files`.** Ce document la listait ; `src/db/repositories/files-repository.ts`
est en réalité un adaptateur de stockage objet, pas un repository Drizzle. Aucune policy RLS n'a donc
à la couvrir. L'ADR 004 remplace ce stockage par le disque du VPS, derrière le même factory.

**État depuis s12a** : l'adaptateur `local` (`src/lib/files/storage/local-storage.ts`) est le **seul
stockage du produit**, confiné sous `LOCAL_STORAGE_ROOT` (`@/env`), écriture par fichier temporaire puis
renommage. `createStorage` n'accepte plus que `'local'`, `STORAGE_TYPE` absente vaut `local`, les paquets
et les variables Supabase ont quitté le dépôt, et un test de garde interdit tout import d'un SDK Supabase
dans `src/`. Deux chaînes l'utilisent : le **logo et le favicon** des associations (s01b) et les fichiers
d'article du blog d'administration hérité. Les clés d'identité sont générées par le serveur
(`{organizationId}/identity/{logo|favicon}-{uuid}.{png|webp|ico}`), jamais tirées d'un nom fourni, et
référencées sur `organization`. Lecture par `GET /api/identity/{logo|favicon}` : type énuméré, tenant
du domaine appelé, clé lue en base — aucun chemin ne vient de la requête ; `?v=` (version tirée de la
clé) autorise un cache long ; sans favicon, la route sert le monogramme de l'association.

Entités ajoutées par ASL-CMS, par domaine :

- **Tenancy** — `organization` étendue d'un **domaine unique indexé** (ADR 003), de **drapeaux de
  modules** typés (ADR 010) et des **clés de stockage du logo et du favicon** (`identity_logo_key`,
  `identity_favicon_key`, nullables, ADR 015) ; `organization_setting` en clé composite
  `(organization_id, key)`, valeurs seules, définitions au registre du code (ADR 016).
- **Membres et parcelles** — `member_profile` (fiche membre, **existe sans compte** : 100 des 400
  propriétaires de La Fourche n'ont pas d'email), `parcel`, et surtout `parcel_ownership`, la relation
  **datée** membre ↔ parcelle. C'est le cœur du modèle : l'historique est attaché à la parcelle **au
  moment des faits**. Une vente ne transfère ni les factures, ni les documents, ni les relevés antérieurs.
  Ce n'est pas une clé étrangère `parcel → membre_courant`, et c'est l'erreur de conception à ne pas commettre.
- **Identité** — la clé de rattachement d'un membre est **sa clé primaire arbitraire**. Jamais l'email
  (absent, changeant, partagé dans un foyer), jamais le numéro de parcelle (non unique, transmis à la vente).
  Vrai pour le stockage nominatif, le rapprochement Pennylane, le dédoublonnage d'import et l'export.
- **Contenu** — `page` et `content_block` (ADR 007) ; `news`, `board_member`, `water_analysis`,
  `alert_banner` comme modèles à champs fixes ; `category` **réutilisable** entre questions au bureau et
  petites annonces (max 10 par usage, avec email de routage optionnel).
- **Eau** — `water_reading` (relevé annuel importé), rattaché à la parcelle et daté.
- **Signalements** — `report`, workflow `signalé → en cours → résolu`, en variante publique anonyme et
  variante membre identifiée.
- **Communication** — `email_template`, `campaign`, `recipient_group`, `unsubscribe`, `daily_send_budget`,
  et `scheduled_job` (ADR 006). Chaque modèle porte une **nature** : un désinscrit sort des envois
  facultatifs, reste dans les envois statutaires. La classification est une **donnée de configuration**,
  à confirmer par le conseil RGPD — pas une constante.
- **Documents** — `document` (partagé ou nominatif), le stockage nominatif étant **physiquement séparé
  par membre** (ADR 004).
- **Autorisation** — ⚠️ pas une table : `action_registry` est un **module de code isomorphe**
  (`src/services/types/domain/action-registry-types.ts`, ADR 018), sans écran ni migration. Chaque
  story y déclare ses actions avec leurs rôles d'association par défaut ; `canPerformAction`
  (`src/services/authorization/action-registry-authorization.ts`) le lit pour trancher. s37
  ajoutera la table de surcharge par tenant, qui composera avec ce registre sans le remplacer.

### Classement RLS des 24 tables du schéma

Le critère 9 de s01 exige que l'ensemble des tables **exemptées** soit exactement celui listé ici.
Les 24 tables du schéma (20 après le retrait ADR 009, plus `organization_setting` de s02, plus `page` et `content_block` de s04, plus `menu_item` de s04b) sont donc toutes classées, sans reste. Toute
addition à cette liste se justifie en revue, et chaque ligne ci-dessous porte sa justification.

**Scopée par une policy RLS forcée** — 5 tables

| Table                  | Pourquoi                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `user_submissions`     | Donnée métier de l'association (contact, retours). Porte `organization_id`, policy `tenant_isolation` forcée. C'est sur elle que s01 prouve l'accès croisé.                                                                                            |
| `organization_setting` | Paramètres de l'association (adresses, teinte : ADR 010, ADR 016). Porte `organization_id`, policy `tenant_isolation` forcée (`0007`). Absence de ligne = valeur par défaut du registre.                                                               |
| `page`                 | Pages du site public (ADR 007, ADR 020, s04). Porte `organization_id`, policy `tenant_isolation` forcée (`0013`). Slug unique **par association**, jamais globalement.                                                                                 |
| `content_block`        | Blocs typés d'une page (ADR 019, s04). **Sans `organization_id`** : le tenant est celui de la page, et la policy `tenant_isolation` forcée (`0013`) joint `page` pour le retrouver — donc aucune colonne de tenant dupliquée à tenir cohérente.        |
| `menu_item`            | Entrées du menu du site public (ADR 021, s04b). Porte `organization_id` **directement**, comme `page` : la policy `tenant_isolation` forcée (`0015`) n'a pas de jointure à faire, la lecture réelle étant « toutes les entrées de cette association ». |

**Plan identité — exemptées** (ADR 014) : ces tables ne portent aucune donnée de l'association et
répondent à « qui est cet utilisateur, et où a-t-il le droit d'aller ». Elles sont lues **avant**
qu'un tenant soit connu. — 9 tables

| Table                                        | Pourquoi                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `session`, `account`, `verification` | Tables Better Auth, sans `organization_id`. Une identité n'appartient pas à un tenant.                                                                                                                                                                                                                                                                                                       |
| `apikey`, `two_factor`, `user_settings`      | Rattachées à `user_id`, jamais à une association. Scopées par utilisateur, pas par tenant.                                                                                                                                                                                                                                                                                                   |
| `member`, `invitation`                       | **Le pivot identité ↔ tenant** (ADR 014). Elles portent `organization_id` mais leur lecture principale est inter-tenant par construction : le `customSession` de Better Auth charge toutes les organisations d'un utilisateur à chaque requête. Sous policy, l'inscription et la session ne fonctionnent plus — mesuré. Isolation applicative (CASL) ; risque résiduel nommé dans l'ADR 014. |

**Plan plateforme — exemptées** : ce sont les données de Zourite Studio sur ses clients, pas les
données d'un client. — 4 tables

| Table                               | Pourquoi                                                                                                                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_settings`                      | Réglages de la plateforme. Les réglages **par association** vivent dans `organization_setting` (ADR 010, ADR 016), scopée ci-dessus.                                                                                                                                        |
| `organization`                      | **C'est le tenant.** Elle ne porte pas `organization_id` par nature, et sa lecture par domaine précède toute résolution de tenant (ADR 003). Ses colonnes `identity_logo_key` et `identity_favicon_key` (ADR 015) voyagent avec cette lecture et restent donc exemptées.    |
| `subscription`, `subscription_plan` | Abonnement **plateforme** Stripe. `subscription` se rattache au tenant par `reference_id` (`text`, polymorphe Better Auth) : une policy sur `organization_id` ne la verrait pas. À ne jamais confondre avec la facturation des membres (Pennylane, ADR 011, lecture seule). |

**Contenu du socle, pas encore rattaché à un tenant — exemptées en attendant leur story** : elles ne
portent aujourd'hui **aucune** colonne de rattachement, et aucun contenu d'association n'y est écrit.
La story qui les met en service leur ajoute `organization_id` **et** sa policy, comme toute table
métier. — 6 tables

| Table                                                                   | Story qui les scope                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `posts`, `posts_translation`, `categories`, `hashtags`, `post_hashtags` | Base des actualités : c'est la story « actualités » qui les rattache au tenant.                     |
| `notifications`                                                         | Rattachée à `user_id`. Une notification d'association demandera `organization_id`, donc une policy. |

Enfin, les tables de migration Drizzle (`drizzle.__drizzle_migrations`) sont hors périmètre : elles
n'appartiennent à aucun tenant et ne sont écrites que par le rôle propriétaire.

## Integration points

| Intégration        | Rôle                                            | Forme                                     | Réserve                                           |
| ------------------ | ----------------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| **Better Auth**    | Lien magique 20 min, sessions, organisations    | Natif boilerplate                         | —                                                 |
| **Brevo**          | Email transactionnel et campagnes, statistiques | Contrat `EmailTransport` (ADR 005)        | Contenu des 4 modèles à rédiger                   |
| **Pennylane**      | Factures membres, lecture seule                 | Contrat `MemberBillingProvider` (ADR 011) | **Bloque s20** — accès API + clé de rapprochement |
| **ASL Community**  | Vote en ligne                                   | Contrat `VoteProvider` (ADR 011)          | **Bloque s33** — accès + validation statutaire    |
| **Stripe**         | Abonnement plateforme Zourite ↔ association     | Natif boilerplate                         | Ne jamais confondre avec Pennylane                |
| **Sentry**         | Erreurs serveur et client                       | Natif boilerplate                         | —                                                 |
| **Search Console** | SEO (s11)                                       | Par tenant                                | —                                                 |

**Le contrat d'envoi `EmailTransport`** (s03, ADR 005, ADR 017) — `src/lib/emails/transport/`. Tout email
part par `sendEmailService` (`src/services/email-service.ts`), qui rend le gabarit `react-email` en HTML,
fournit toujours la version texte et confie le message au transport actif. **Aucun code métier n'importe
un SDK de fournisseur** : `resend` n'est importé que par son adaptateur (un test le vérifie). Un échec
d'envoi est une `EmailTransportError`, quel que soit le fournisseur.

| `EMAIL_TRANSPORT` | Implémentation                                                 | Usage                                  | Variable exigée  |
| ----------------- | -------------------------------------------------------------- | -------------------------------------- | ---------------- |
| `brevo`           | `POST https://api.brevo.com/v3/smtp/email` par `fetch`         | **production** (doit y être déclaré)   | `BREVO_API_KEY`  |
| `resend`          | SDK `resend`, isolé dans son adaptateur                        | secours, activable sans code (ADR 017) | `RESEND_API_KEY` |
| `file`            | un JSON par message dans `EMAIL_OUTBOX_DIR` (temporaire sinon) | **défaut hors production**, CI, e2e    | —                |
| `memory`          | messages gardés en mémoire                                     | tests unitaires                        | —                |

La clé d'un fournisseur n'est exigée que pour son propre transport (`get-email-transport.ts`) ; en
production, l'absence de `EMAIL_TRANSPORT` est une erreur plutôt qu'un défaut silencieux. Les couleurs
des emails vivent dans `src/lib/emails/theme.ts` (jumelles hexadécimales, design system §5.3).

**La demande de lien de connexion** (s03) — `src/lib/better-auth/magic-link-integration.ts`. Elle ne
passe que par `requestMagicLinkAction` (plancher de 1,5 s, même écran B quoi qu'il arrive) :

- **`POST /api/auth/sign-in/magic-link` est fermé** (`disabledPaths` de Better Auth, qui n'agit que sur le
  routeur HTTP). `auth.api.signInMagicLink`, appelé par l'action, et `GET /api/auth/magic-link/verify`,
  ouvert par l'email, restent en service.
- **Seul le dernier lien fonctionne** : avant l'envoi, les jetons en attente de la même adresse sont
  supprimés de la table `verification`, par l'adaptateur de Better Auth reçu dans le contexte de l'appel
  (la table et son format appartiennent à la bibliothèque).
- **Limitation de débit : 3 demandes par adresse et par jour**, en base : table `rate_limit_event`
  (`organization_id`, RLS forcée), une ligne par association, **empreinte HMAC-SHA256** de l'adresse en
  minuscules (jamais en clair) et jour (Europe/Paris), avec le nombre de demandes du jour ; unicité sur les
  trois. Le comptage est **atomique en une requête** (`insert … on conflict … do update set count = count + 1
returning count`, sans verrou applicatif) ; le changement de jour remet le compteur à zéro sans tâche
  planifiée, et les lignes des jours passés sont purgées à chaque demande. Une adresse inconnue est comptée
  aussi. Le seuil est un **réglage de l'association** (registre, ADR 010 et 016 :
  `login.link_requests_per_address_per_day`, défaut 3, de 1 à 20), modifiable dans « Réglages ». Au-delà :
  aucun email, le lien précédent reste valable, et l'écran reste l'écran B. **Aucune limite de demande par
  accès internet** : aucune IP n'est lue ici (la première entrée de `x-forwarded-for` est fournie par le
  client) — l'ouverture du lien, elle, est limitée par IP côté Better Auth (point suivant).
  Compromis accepté : un tiers peut épuiser les demandes du jour d'un membre, que l'écran B renvoie vers le
  bureau. Le budget quotidien Brevo (et le transport de secours au-delà) reste l'affaire de s26.
- **L'ouverture du lien est limitée par Better Auth, par IP : 30 par minute** (`rateLimit` passé à
  `magicLink()`, `MAGIC_LINK_VERIFY_RATE_LIMIT` dans `magic-link-constants.ts`). Le plugin pose lui-même une
  règle de débit sur ses deux routes, et son défaut — 5 par minute — ne garde en pratique que
  `GET /api/auth/magic-link/verify`, la seule ouverte : au-delà, la page affiche le 429 de Better Auth au
  lieu de l'écran attendu. Or cette règle compte **par adresse IP** : un foyer, le bureau de l'association
  ou un accès partagé sortent tous par la même, et 5 par minute les bloquerait mutuellement. Le jeton fait
  32 caractères tirés au hasard (~190 bits) : la force brute n'est pas la menace, le compteur ne garde que
  du martèlement, d'où 30. C'est une **garde d'infrastructure**, pas un réglage d'association (l'ADR 010
  vise les valeurs métier) ; le stockage est celui de Better Auth, en mémoire du processus, donc remis à
  zéro à chaque redémarrage et propre à chaque instance.
- **Aucun import statique de la couche service** dans l'intégration : `auth.ts` l'importe, et chaque façade
  remonte à `auth.ts` par `auth-service`. Les façades sont chargées par `import()` à l'appel ;
  `magic-link-integration-imports.test.ts` parcourt le graphe d'imports et échoue au premier cycle.

**Contraintes structurantes**

- **300 emails/jour, par compte Brevo.** Ce n'est pas une limite d'affichage : le budget quotidien
  d'envoi par association est décompté par **tout** email sortant — invitations, campagnes, relances,
  lancement — avec report au lendemain plutôt que perte. Il vit en base, pas en mémoire.
- **Aucune donnée bancaire ne transite** par le produit. Le paiement est une redirection (s21). Hors
  périmètre DSP2/PCI, et cela doit le rester.
- Les statuts de facture Pennylane sont **transportés tels quels**, jamais réduits à un booléen.
- Les formulaires publics sont limités en débit sur **empreinte d'IP hachée, purgée sous 24 h**. Le
  boilerplate utilise aujourd'hui `RateLimiterMemory` avec l'**IP en clair** (`src/app/[locale]/(public)/contact/actions.ts`) :
  c'est à corriger, et le stockage en mémoire ne survit pas au redémarrage. Un compteur journalier en base
  existe depuis s03 (`rate_limit_event`, `rate-limit-service.ts`, empreinte HMAC liée à l'usage) : s08 peut
  s'y appuyer pour son propre usage.

## Design / UX

Le design system global est capté dans `docs/design-system.md` (`/ks-design-system`), l'écran de chaque
story dans `docs/designs/<id>.md`. Inventer un composant ou un token hors du système est interdit : on
compose avec l'existant, et un manque est un **« design system gap » à remonter**, jamais à combler
en freestyle.

Trois exigences pèsent plus lourd que les autres :

1. **Le back-office est le risque produit n°1.** L'ADR 001 l'a écrit en écartant WordPress : si le bureau
   ne s'approprie pas le BO, la promesse tombe, quel que soit le reste. La référence d'ergonomie visée est
   celle d'un éditeur de pages type WordPress. Le critère de recette est sans échappatoire — un
   membre du bureau, seul devant l'écran, crée et publie une page, une actualité et une analyse d'eau.
2. **Le public visé est âgé et peu à l'aise avec l'informatique**, et se connecte rarement, pour une
   raison précise. Cibles larges, contrastes francs, libellés explicites, aucun jargon, aucun parcours
   à plusieurs étapes là où une seule suffit.
3. **La saisie d'une analyse d'eau est fréquente** (au moins mensuelle) : elle demande une UI de saisie
   rapide, pas un formulaire lourd.

Le site public est une **vitrine référencée**, pas un intranet : alertes, actualités, analyses d'eau et
signalement de fuite sont consultables **sans compte** — c'est l'angle n°3 du PRD.
