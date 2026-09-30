# Research — Story s10-signalements-publics

## Target story

**Signaler une fuite ou un incident** — un visiteur sans compte signale une fuite ou un incident ;
le bureau le suit en back-office. Complexité 3. Dépendances : s02, s04, s08b (toutes livrées).

Critères d'acceptation (docs/stories.md) :

1. Un signalement valide (catégorie, localisation, description, coordonnées facultatives) est
   enregistré, confirmé à l'écran et notifié par email aux adresses paramétrées du tenant.
2. Il apparaît dans une file de suivi en back-office avec le statut initial `signalé`.
3. Le bureau le fait passer de `signalé` à `en cours` puis à `résolu` ; chaque changement est
   horodaté et attribué à son auteur.
4. Les catégories (fuite, voirie, éclairage, nuisance…) sont administrables par le bureau, pas
   figées dans le code, dans la limite de 10 ; la 11e est refusée avec un message explicite.
5. Supprimer une catégorie ne supprime pas les signalements déjà reçus dans cette catégorie.
6. Une catégorie peut porter une adresse de routage optionnelle : renseignée puis relue, elle
   revient inchangée ; laissée vide, elle se lit comme **absente**, pas comme une chaîne vide.
7. Modifier les adresses de notification dans les paramètres (s02) change les destinataires du
   signalement suivant.
8. Un signalement public est enregistré **sans lien vers un membre**, même si les coordonnées
   correspondent exactement à celles d'un membre (aucun rapprochement automatique).
9. Le formulaire est soumis à la même limitation de débit que le contact (s08b).

Notes agentiques structurantes :

- **Cette story possède le modèle de catégories du produit** : générique
  `{nom, email_destination?}`, plafond 10, administrable, avec un **discriminant de domaine**.
  s23 (questions au bureau) et s35 (petites annonces) le réutilisent avec leur propre domaine.
- `email_destination` n'est **pas** utilisé par les signalements (destinataires = paramètres du
  tenant) ; il est porté maintenant pour s23, et sa persistance se prouve ici (critère 6).
- Le lien vers un membre est **nullable dès maintenant**, pour que s22 (signalement membre) n'ait
  pas de migration à faire. s12 (table des membres) n'est **pas** livrée : voir Open questions.
- Réutiliser le limiteur de s08b, ne pas en écrire un second.

## Current state of the code

Rien n'existe pour les signalements ni pour les catégories métier : aucune table `report`, aucun
modèle de catégorie, aucune route. `grep -ri "report\|signalement" src/db src/services` ne renvoie
que du code sans rapport.

Ce qui existe et que la story réemploie — le **formulaire de contact** de s08/s08b, qui est la même
forme de flux (visiteur anonyme → enregistrement → email au bureau → liste en back-office) :

| Fichier | Rôle aujourd'hui |
| --- | --- |
| `src/app/[locale]/(public)/contact/actions.ts` | `submitContactAction(prevState, formData)` : locale du formulaire → tenant du domaine (`getCurrentTenantDal`) → validation Zod partagée → `consumeContactMessageQuotaService({organizationId, ip})` → `createContactMessageService`. Action **publique, sans `requireActionAuth()`**, délibérément. `readVisitorIp()` (dernière entrée de `x-forwarded-for`, sinon `x-real-ip`) est une **fonction locale non exportée** de ce fichier. |
| `src/app/[locale]/(public)/contact/contact-form-validation.ts` | `createContactFormSchema(t)` — patron du schéma traduit partagé client/serveur. |
| `src/services/contact-message-service.ts` | `createContactMessageService` : validation → écriture dans `withTenant` → `notifyBoard` ; un échec de notification **ne fait pas échouer** la soumission (colonne `notification_failed` posée, erreur journalisée). Lecture de l'adresse **à l'envoi** dans les paramètres (`CONTACT_EMAIL_SETTING_KEY`). Liste paginée du bureau (`getContactMessagesPageService`) gardée par `canPerformAction(..., CONTACT_MESSAGE_READ)`. |
| `src/db/models/contact-message-model.ts` | Table `contact_message` : `organization_id NOT NULL` en `cascade`, **aucune colonne d'adresse ni jsonb** (aucune IP ne peut y être écrite), index `(organization_id, created_at desc)`. |
| `src/db/repositories/contact-message-repository.ts` | DAO sur `getDb()` ; tri stable `created_at desc, id desc` pour la pagination. |
| `src/app/[locale]/(bureau)/bureau/messages/` | Back-office « Messages reçus » : `page.tsx`, `[id]/`, `actions.ts` (+ tests). |
| `src/components/features/contact/` | `contact-message-list.tsx`, `contact-message-detail.tsx` — composants de liste et de détail du bureau. |
| `src/lib/emails/contact-message-email.tsx` | Gabarit `react-email` de la notification au bureau (+ test `real-i18n`). |
| `src/components/features/association/bureau-sidebar.tsx` | Navigation du back-office : tableau `NAV_GROUPS` codé en dur (groupe `siteGroup` : pages, actualités, analyses d'eau, navigation, messages, le bureau, alerte ; groupe `group` : identité, réglages). |

## Anchor points

- **Route publique** : un nouveau segment sous `src/app/[locale]/(public)/` (le nom — `signaler`,
  `signalement`… — relève du design). ⚠️ Il doit être ajouté à `RESERVED_PAGE_SLUGS`
  (`src/services/types/domain/page-block-types.ts:94`) **dans le même commit** (commentaire du
  fichier, ADR 020) ; la liste ne contient aujourd'hui aucun segment de signalement.
- **Back-office** : un segment sous `src/app/[locale]/(bureau)/bureau/` pour la file de suivi, un
  autre (ou une section) pour l'administration des catégories ; entrée(s) à ajouter à `NAV_GROUPS`
  dans `bureau-sidebar.tsx` (+ libellés dans `messages/fr.json`).
- **Registre d'actions** : nouvelles entrées dans `ActionIdConst` / `ACTION_REGISTRY`
  (`src/services/types/domain/action-registry-types.ts`), rôles par défaut `['owner', 'board']`
  comme toutes les actions existantes.
- **Modèles** : nouveaux fichiers dans `src/db/models/` (signalement, catégorie, historique des
  statuts selon le plan) + migration de policy RLS forcée par `drizzle-kit generate --custom`.
- **Inventaire RLS** : `docs/architecture.md` (section « Classement RLS », décompte « 29 tables » et
  « Scopée … — 10 tables ») et `src/db/rls-inventory.test.ts`, qui échoue si une table du schéma
  n'est pas classée ou si un décompte diverge.
- **Seed** : catégories par défaut du premier tenant (règle « rien en dur » : ce sont des valeurs
  de seed, pas des constantes) — `src/db/scripts/seed.ts`, sur le modèle de
  `src/db/scripts/tenant-settings-seed.ts` (valeurs fictives par tenant de test).

## Verified APIs / functions

| Nom | Signature | Emplacement |
| --- | --- | --- |
| `consumeContactMessageQuotaService` | `(quota: {organizationId: string; ip?: string}) => Promise<{allowed: boolean; limit: number}>` | `src/services/rate-limit-service.ts`, exportée par `src/services/facades/rate-limit-service-facade.ts` |
| `RateLimitPurposeConst` | `{MAGIC_LINK_ADDRESS: 'magic_link.address', CONTACT_IP: 'contact.ip'}` | `src/services/rate-limit-service.ts` |
| `fingerprintOf` | `(organizationId, purpose: RateLimitPurpose, value) => string` (HMAC-SHA256 par `BETTER_AUTH_SECRET`) | idem |
| `getContactMessagesPerHourLimit` | lit `contact.messages_per_visitor_per_hour` (défaut 3, 1–20) | `src/services/types/domain/association-settings-types.ts:479` |
| `CONTACT_EMAIL_SETTING_KEY` | `'contact.email'`, `required: true` | `association-settings-types.ts:120` |
| `FORAGE_EMAIL_SETTING_KEY` | `'forage.responsable.email'`, `required: false`, **défaut `{fromKey: CONTACT_EMAIL_SETTING_KEY}`** | `association-settings-types.ts:121` — **aucun consommateur dans `src/` aujourd'hui** : s10 serait le premier |
| `getAssociationSettingsService` | `(organizationId) => Promise<settings>` ; `settings[KEY]?.value` | `src/services/association-settings-service.ts` |
| `canPerformAction` | `(user: User \| undefined, organizationId: string, actionId: string) => boolean` ; SUPER_ADMIN toujours vrai ; action absente du registre = refus | `src/services/authorization/action-registry-authorization.ts:18` |
| `getAuthUser` | `() => Promise<User \| undefined>` | `src/services/authentication/auth-service` |
| `withTenant` | `<T>(organizationId: string, callback: () => Promise<T>) => Promise<T>` (UUID vérifié) | `src/db/tenant-scope.ts:128` |
| `getDb` | `() => ScopedDb` — transaction du scope courant, sinon `db` | `src/db/tenant-scope.ts:122` |
| `getCurrentTenantDal` / `requireCurrentTenantDal` / `withCurrentTenant` | tenant du domaine appelé | `src/app/dal/tenant-dal.ts:71/93/112` |
| `resolveSupportedLocale` | `(value: unknown) => SupportedLocale` | `src/lib/helper/locale-helper.ts` |
| `sendEmailService` | `(payload: {to: string; subject; text; from?; react?}, options?: {recipientType?}) => Promise<void>` | `src/services/email-service.ts:133` |
| `sendContactMessageNotificationEmailService` | `({to, locale, association, message, messageUrl})` — patron à suivre pour la notification | `src/services/email-service.ts:711` |
| `associationOriginOf` | `(domain) => string \| undefined` — origine de l'association pour les liens de l'email | `src/lib/better-auth/association-origin.ts` |
| `getIdentityVersionFromKey`, `getAccentHue` | logo et teinte de l'email (voir `pngLogoUrlOf` dans `contact-message-service.ts`) | domain types |
| `isPageSlugReserved`, `RESERVED_PAGE_SLUGS` | cf. ci-dessus | `src/services/types/domain/page-block-types.ts:94` |

## Traps & constraints

- **Collision de nom : la table `categories` existe déjà.** `src/db/models/post-model.ts:15` déclare
  `pgTable('categories', …)` pour le blog hérité — une table **exemptée** de RLS et lue hors scope
  (architecture, « Contenu du socle »). Le modèle générique de s10 ne peut pas s'appeler
  `categories`, et l'export Drizzle `categories` est déjà pris dans le schéma.
- **Un seul destinataire par email.** `EmailMessage.to` et `SendEmailPayload.to` sont des `string`
  uniques (`src/lib/emails/transport/email-transport.ts`). « Les adresses paramétrées » (contact +
  responsable forage) veulent donc soit deux envois, soit une évolution du contrat de transport —
  qui toucherait les quatre adaptateurs (brevo, resend, file, memory) et leurs tests.
- **Le défaut de `forage.responsable.email` est l'adresse de contact** : non renseignée, les deux
  clés résolvent vers la même adresse. Sans déduplication, le bureau reçoit deux fois le même email.
- **`readVisitorIp` n'est pas partagée** : fonction locale de `contact/actions.ts`. Le critère 9
  exige le même comportement (dernière entrée de `x-forwarded-for`, jamais la première). La
  recopier dupliquerait une règle de sécurité ; l'extraire modifie le fichier de s08.
- **Le limiteur est « un seul seuil pour tous les formulaires publics »** (architecture, s08b) :
  `contact.messages_per_visitor_per_hour` est réemployé tel quel, décision déjà prise. Reste la
  question de l'usage (`contact.ip` partagé ou un usage distinct) — voir Open questions.
- **Ordre de l'action publique (s08 décision C, s08b décision F)** : tenant → validation → quota →
  écriture → notification. Une soumission invalide ne coûte ni quota, ni écriture, ni email.
  L'IP ne doit traverser que le service de quota (l'intercepteur de ce service ne journalise pas
  ses arguments) et **aucune colonne** du signalement ne doit pouvoir la recevoir (ADR 025 : ni
  jsonb ni colonne d'adresse sur `contact_message`, même discipline attendue ici).
- **Notification non bloquante** : dans s08, un échec d'envoi n'annule pas l'enregistrement et se
  voit dans la liste (`notification_failed`). Le critère 1 dit « enregistré, confirmé et notifié » ;
  le patron existant est le précédent.
- **Suppression de catégorie (critère 5)** : une FK `ON DELETE CASCADE` supprimerait les
  signalements ; `ON DELETE SET NULL` perdrait le libellé de la catégorie d'un signalement déjà
  reçu. Choix de modèle à trancher au plan (suppression logique, copie du libellé, FK nullable…).
- **Email vide = absent (critère 6)** : le formulaire envoie `''` ; il faut le normaliser en `NULL`
  avant l'écriture, et le relire comme absent. Même discipline que la note de s12 sur l'email.
- **Plafond de 10 (critère 4)** : compter puis insérer dans deux requêtes laisse passer une 11e
  catégorie en cas de double soumission. Précédent d'atomicité : l'incrément
  `insert … on conflict … do update` du limiteur. Le plafond est « par domaine » (s23, s35 auront
  chacun les leurs — architecture : « max 10 par usage »).
- **Horodatage et auteur (critère 3)** : il n'existe **aucune table de journal d'actions** dans le
  dépôt — le « registre d'actions » de s03b est un module d'**autorisation**, pas un journal.
  L'historique des changements de statut est donc à modéliser ici.
- **Rapprochement interdit (critère 8)** : aucun code ne doit chercher un membre ou un `user` à
  partir de l'email saisi. La table `member` de Better Auth est le pivot identité (ADR 014), pas
  la fiche membre (s12, non livrée).
- **RLS** : nouvelle(s) table(s) métier ⇒ `organization_id`, policy `tenant_isolation` **forcée**
  par migration `--custom` (patron `drizzle/migrations/0025_water_analysis_rls.sql`), classement
  dans `docs/architecture.md` et passage de `src/db/rls-inventory.test.ts`, test d'accès croisé
  entre deux tenants **en e2e** (`e2e/tenant-isolation.spec.ts` est le fichier des accès croisés).
  Dernière migration : `0025` — la suivante sera `0026`.
- **e2e du limiteur** : `e2e/rate-limit.spec.ts` et `e2e/contact.spec.ts` existent ; le critère 9
  se prouve de la même façon sur le nouveau formulaire.
- **Tests unitaires** : `/workspace` est sur un montage 9p lent — des timeouts de workers Vitest
  ne sont pas des échecs de code, mais ne comptent pas non plus comme verts.
- **Session et cache** : la file de suivi est une donnée par association, lue par le bureau
  authentifié ; le précédent `contact-message-dal.ts` ne met pas de `'use cache'` sur la liste.

## Open questions

1. **Lien vers un membre (nullable) sans table membre.** s12 n'est pas livrée : il n'existe ni
   `member_profile` ni autre fiche membre à référencer. Colonne nullable sans FK (ajoutée par s12
   ou s22), FK vers `user`, ou rien du tout en attendant s22 ? La note « éviter une migration en
   s22 » n'est tenable que si la cible existe déjà.
2. **Quels destinataires pour un signalement ?** Partiellement tranché par l'écran « Réglages » livré
   en s02 (`messages/fr.json`, `AssociationSettings.fields`) : l'adresse de contact « reçoit les
   messages du formulaire de contact du site **et les signalements** » ; l'adresse du responsable
   forage « reçoit les signalements **de fuite**, en plus de l'adresse de contact. Laissée vide, ils
   ne partent que vers l'adresse de contact ». Reste ouvert : les catégories étant administrables,
   **comment le code sait-il qu'une catégorie est « fuite »** (libellé, marqueur sur la catégorie,
   catégorie système non supprimable) ? Et « laissée vide » contredit le défaut
   `{fromKey: CONTACT_EMAIL_SETTING_KEY}` : vide, la clé résout vers l'adresse de contact, d'où la
   déduplication nécessaire.
3. **Deux envois ou un envoi à plusieurs destinataires ?** (voir Traps : `to: string`).
4. **Compteur du limiteur partagé ou distinct ?** Même seuil, c'est acquis. Même usage
   `contact.ip` (un visiteur qui a envoyé 3 messages ne peut plus signaler) ou usage
   `report.ip` distinct (3 + 3 par heure) ? Le critère dit « la même limitation », sans trancher.
5. **Coordonnées facultatives** : quels champs (nom, email, téléphone) ? Le critère ne les liste pas.
6. **Retour en arrière de statut** : `résolu → en cours` (réouverture) est-il permis ? Le critère
   décrit un sens unique, sans l'interdire explicitement.
7. **Suppression de catégorie** : réellement supprimée (et le signalement garde un libellé) ou
   archivée (et elle compte encore dans le plafond de 10) ?
8. **Module activable ?** Les signalements ne sont pas dans `organizationModuleValues` ; la
   fonctionnalité est-elle toujours active, comme le contact ?
9. **Pièce jointe (photo de la fuite)** : absente des critères — hors périmètre sauf avis contraire.
