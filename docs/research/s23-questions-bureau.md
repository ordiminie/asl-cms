# Research — Story s23-questions-bureau

Recherche faite le 14/11/2026 sur `main` à `dc534c72` (s52 et PR 68 mergées). Découpage revu : `Stories ready: yes`.

## Target story

**En tant que** membre propriétaire **je veux** poser une question identifiée dans une catégorie **afin qu'**elle arrive
directement à la bonne personne du bureau. Complexité 2. Dépend de s02, s10, s12, s12d (toutes livrées).

Critères d'acceptation :

1. Un membre connecté choisit une catégorie dans une liste et envoie sa question ; elle est enregistrée et notifiée par email.
2. La question part vers l'adresse de routage de la catégorie choisie ; si la catégorie n'en a pas, vers l'adresse de contact
   générale du tenant.
3. Le bureau administre les catégories (libellé + email de routage facultatif) en back-office, maximum 10 ; la 11ᵉ est refusée
   avec un message explicite.
4. Le bureau consulte les questions reçues avec l'identité du membre et sa catégorie.
5. Supprimer une catégorie ne supprime pas les questions déjà reçues dans cette catégorie.

Notes agentiques : formulaire **distinct** du contact public (s08) — identifié, catégorisé, routé. Le modèle de catégories est
celui de s10 : **le réutiliser** avec un nouveau domaine, ne pas en écrire un second. C'est ici que `routing_email` est prouvé.

## Current state of the code

**Catégories génériques (s10, ADR 028)** — tout ce dont s23 a besoin existe :

- `src/db/models/association-category-model.ts` : table `association_category` (`domain` texte fermé par le code,
  `routing_email` nullable, suppression logique `deleted_at`, index unique partiel sur le nom actif, RLS forcée).
- `src/services/types/domain/association-category-types.ts` : `CategoryDomainConst = {REPORT: 'report'}`,
  `CATEGORY_DOMAINS`, `MAX_CATEGORIES_PER_DOMAIN = 10`, `CATEGORY_NAME_MAX_LENGTH = 40`, DTO `ManagedCategoryDTO` avec
  `usageCount`. Le commentaire annonce : « s23 et s35 ajouteront la leur ici, sans migration ».
- `src/services/association-category-service.ts` : deux tables de correspondance par domaine à compléter —
  `MANAGE_ACTION_OF_DOMAIN` (`report` → `report.manage`) et `USAGE_COUNTS_OF_DOMAIN` (`report` →
  `countIncidentReportsByCategoryDao`). Services `list/create/update/deleteAssociationCategoryService(…, domain)` déjà
  génériques ; `listActiveReportCategoriesPublicService` est propre au domaine `report` (lecteur anonyme).
- `src/db/repositories/association-category-repository.ts` : `listActiveCategoriesDao(orgId, domain)`,
  `getCategoryByIdDao` (active ou supprimée), `createCategoryWithinLimitTxnDao` (verrou consultatif + compte + insertion,
  atomique), `updateCategoryTxnDao`, `softDeleteCategoryDao`. Tous génériques.
- `src/services/errors/category-errors.ts` : `CategoryLimitReachedError`, `DuplicateCategoryNameError`.
- Écran bureau des catégories de signalement : `src/app/[locale]/(bureau)/bureau/signalements/categories/` (`page.tsx`,
  `actions.ts`) + composant `src/components/features/incident-report/report-categories-manager.tsx`, DAL
  `src/app/dal/association-category-dal.ts` (`getActiveReportCategoriesDal`, `getReportCategoriesForBureauDal`).
  Le message explicite de la 11ᵉ catégorie existe déjà pour les signalements (critère 4 de s10).

**Formulaire identifié d'un membre (s22, ADR 049)** — précédent direct :

- `createMyIncidentReportService` (`src/services/incident-report-service.ts:472`) : session requise, fiche résolue par
  `getMemberProfileByUserIdDao(organizationId, authUser.id)` sous `withTenant`, **aucune identité lue de l'entrée** ; sans
  fiche → `{status: 'not_found'}`. Catégorie vérifiée dans le scope du tenant (`resolveReportCategory`). L'identité est copiée
  de la fiche (`reporter_*`) et `member_id` posé.
- Page `src/app/[locale]/(app)/dashboard/signaler/page.tsx` (`withAuth`, `requireCurrentTenantDal`, `notFound()` sans fiche)
  + `actions.ts` + `my-report-form-validation.ts` ; composant `src/components/features/member-space/my-report-form.tsx`.
- Espace membre `src/app/[locale]/(app)/dashboard/page.tsx` → `MemberSpace`
  (`src/components/features/member-space/member-space.tsx`) : cartes parcelles, coordonnées, « Mes signalements »
  (`my-reports-card.tsx`), retour `?signalement=envoye`.

**Notification au bureau et budget d'envoi (s08, s10, s52)** :

- `sendContactMessageNotificationEmailService` et `sendIncidentReportNotificationEmailService`
  (`src/services/email-service.ts:972` et suivantes) : `recipientType: 'system'`, contexte
  `{scope: 'tenant', organizationId, nature: 'board_notification', reference: {type, id}}` (ADR 053). Gabarits React Email
  + texte, objet raccourci par `fitSubjectToLength`, libellés dans `messages/fr.json` (`email.contact.notification`,
  `email.report.notification`).
- Témoin d'échec : colonne `notification_failed` sur la table source ; posé à l'envoi direct par le service métier
  (`flagNotificationFailed`, `incident-report-service.ts:238`) et au rejeu raté par `flagSourceNotificationFailed`
  (`email-service.ts:1163`), qui choisit le DAO selon `referenceType`.
- Adresse de contact générale : réglage `CONTACT_EMAIL_SETTING_KEY` lu à l'envoi via `getAssociationSettingsService`
  (`association-settings-types.ts`).

**Consultation par le bureau (s08)** : `src/app/[locale]/(bureau)/bureau/messages/` (liste paginée, détail `[id]`,
`canManageCurrentContactMessagesDal`, `BureauAccessDenied`), composant `contact-message-list.tsx`. Barre latérale :
`src/components/features/association/bureau-sidebar.tsx` (`NAV_GROUPS`, groupe « Le site » : messages, signalements…).

## Anchor points

- **Nouveau domaine de catégorie** `question` : `CategoryDomainConst`, `CATEGORY_DOMAINS`, puis une ligne dans
  `MANAGE_ACTION_OF_DOMAIN` et `USAGE_COUNTS_OF_DOMAIN`. Pas de migration pour la catégorie elle-même (ADR 028).
- **Nouvelle table** pour les questions (le nom reste à fixer au plan, par ex. `member_question`) : `organization_id`
  `NOT NULL` + RLS forcée (`tenant_isolation`), `category_id` → `association_category` en `RESTRICT` (ADR 028 §2), lien à
  la fiche `member_profile`, contenu, `notification_failed`, `created_at`. Migration par `pnpm db:generate` + migration
  custom pour la policy (précédent : migrations de `incident_report` / `member_note`).
- **Nouvelle action au registre** (`action-registry-types.ts`, règle transverse) pour la consultation et l'administration des
  catégories par le bureau, rôles par défaut `owner`, `board`.
- **Espace membre** : une page `/dashboard/<route>` sur le modèle de `/dashboard/signaler` + une entrée dans `MemberSpace`.
- **Bureau** : une route `/bureau/<route>` (liste, détail éventuel, catégories) + entrée dans `bureau-sidebar.tsx`.
- **Email** : nouveau service `send…NotificationEmailService` + gabarit + libellés, `nature: 'board_notification'`,
  nouvelle référence d'envoi.
- **Budget s52** : ajouter le type de référence à `EmailSendReferenceType` (`email-send-types.ts:35`), à `REFERENCE_TYPES`
  (`rules/email-budget-rules.ts:48`), à `flagSourceNotificationFailed` (`email-service.ts:1163`) et à l'affichage de
  `/bureau/envois` (`email-sending-overview.tsx:205-240`, libellés `EmailSendingBureau` dans `messages/fr.json:3872-3885`).
  `deferred_email.reference_type` est un `text` sans contrainte (`0049`) : pas de migration.

## Verified APIs / functions

| Fonction | Emplacement | Signature / comportement |
| --- | --- | --- |
| `listActiveCategoriesDao` | `association-category-repository.ts` | `(organizationId, domain) → AssociationCategoryModel[]`, tri par nom |
| `createCategoryWithinLimitTxnDao` | idem | `(input & {organizationId, domain}, max) → {status: 'created'\|'limit_reached'\|'duplicate_name'}` |
| `listAssociationCategoriesService` | `association-category-service.ts` | `(organizationId, domain) → {items, max}`, autorisation par `MANAGE_ACTION_OF_DOMAIN[domain]` |
| `create/update/deleteAssociationCategoryService` | idem | entrée portant `domain`, mêmes erreurs métier |
| `getMemberProfileByUserIdDao` | `member-profile-repository.ts` | `(organizationId, userId) → profil \| undefined` (id, name, email, phone) |
| `canPerformAction` | `authorization/action-registry-authorization.ts` | `(authUser, organizationId, actionId) → boolean` |
| `sendEmailService` | `email-service.ts` | `(payload, {scope, organizationId, nature, reference}, options)` — ADR 053 |
| `associationOriginOf` | `lib/better-auth/association-origin.ts` | `(domain) → origine https \| undefined` |
| `requireCurrentTenantDal`, `withAuth` | `app/dal/tenant-dal.ts`, `components/features/auth/with-auth` | tenant du domaine appelé, garde de session |

## Traps & constraints

- **Routage différent de celui des signalements.** ADR 028 §5 (signalements) : contact **plus** adresse de la catégorie.
  s23, critère 2 : adresse de la catégorie **ou, à défaut**, contact. Ne pas réutiliser `resolveReportRecipients` tel quel ;
  le critère tranche, pas d'arbitrage nécessaire. L'ADR 028 est limité aux signalements : pas de contradiction, mais le plan
  doit dire que le routage exclusif est voulu.
- **Catégorie obligatoire.** Le critère 1 dit « choisit une catégorie dans une liste ». Pour les signalements, une
  association sans catégorie laisse partir sans catégorie (`resolveReportCategory`). Pour s23, le comportement quand
  l'association n'a encore aucune catégorie de question n'est pas écrit (voir questions ouvertes).
- **Plafond « 10 »** : constante `MAX_CATEGORIES_PER_DOMAIN`, posée par ADR 028 et acceptée en revue de s10 ; elle vaut pour
  chaque domaine. Pas de nouveau réglage.
- **Catégorie supprimée** : la question garde son lien (`RESTRICT`) et le bureau lit le nom suivi de « catégorie supprimée »,
  comme pour les signalements (`categoryDeleted`). Le compteur `usageCount` de l'écran des catégories dit combien de questions
  seront conservées.
- **Identité** : jamais lue de l'entrée ; copiée ou jointe depuis la fiche résolue par la session (ADR 049). Clé = id de la
  fiche, jamais l'email (AGENTS.md).
- **Connexion à la place (s48)** : `getActingContext` / `effectiveAuthor` existent (`impersonation-types`). s22 ne les utilise
  pas pour la création ; à aligner sur s22 sauf raison contraire.
- **Budget d'envoi (s52)** : la notification décompte le budget du tenant et peut être **reportée** ; un report n'est pas un
  échec (pas de témoin). Le rejeu raté doit pouvoir poser le témoin de la question : sinon `flagSourceNotificationFailed`
  l'ignore silencieusement.
- **Classement des tables** : `docs/architecture.md:355` dit que les 45 tables sont toutes classées, et un test de s01
  vérifie qu'aucune table portant `organization_id` n'est sans policy RLS. La nouvelle table doit y entrer.
- **Export (s38/s39)** : pas encore livré ; rien à faire ici, mais la table devra être couverte par l'export plus tard.
- **e2e** : `incident-report.spec.ts` et `member-notes.spec.ts` sont les modèles (accès croisé entre deux tenants via
  `inTenantScope`, comptes du seed). `email-budget.spec.ts` touche les compteurs de TechCorp : ne pas en dépendre.
- **Seed** (`src/db/scripts/seed.ts:565`) : les catégories de signalement du premier tenant y sont posées sous la porte RLS ;
  ajouter des catégories de question au seed si l'e2e en a besoin (seed déterministe).
- **Tests unitaires** : `pnpm test --run` ; le montage 9p fait expirer des workers — valider sur une copie locale.

## Open questions

1. **Aucune catégorie de question définie** : le formulaire est-il fermé (message « le bureau n'a pas encore ouvert les
   questions ») ou la question part-elle sans catégorie vers le contact ? Le critère 1 suppose une liste ; la suite logique
   est de refuser l'envoi sans catégorie — à confirmer au design et au plan.
2. **Où vit l'écran du bureau** : nouvelle entrée « Questions des membres » dans la barre latérale, avec ses catégories en
   sous-page (sur le modèle `/bureau/signalements/categories`). À fixer au design.
3. **Action du registre** : une seule entrée (`question.manage`, consulter + administrer les catégories) sur le précédent
   de `report.manage`, sauf besoin de séparer.
4. **Le membre revoit-il ses questions** dans son espace ? Aucun critère ne le demande : hors périmètre par défaut.
5. **Témoin lu / non lu** et réponse du bureau : aucun critère ; hors périmètre par défaut (la réponse se fait par email).
