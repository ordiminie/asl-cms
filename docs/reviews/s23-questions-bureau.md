# Revue — Story s23-questions-bureau

> Revue à contexte neuf, premier tour. Chaque point est classé critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s23-questions-bureau` (un seul commit, `3dc3db72`, 73 fichiers).

## Vérifications faites par le relecteur

- **Tests unitaires** : `pnpm test --run` sur une copie en disque local (`git archive` de la branche, `node_modules` en lien
  symbolique, `.env.test` copié). Résultat : **363 fichiers, 4541 tests passés, 4 ignorés, aucun timeout de worker**. Le
  test d'inventaire RLS (`src/db/rls-inventory.test.ts`) passe avec la nouvelle table.
- **Typage** : `tsc --noEmit` sur la copie, code de sortie 0, aucune erreur hors `.next/`.
- **Lint** : `eslint` sur les fichiers ajoutés ou modifiés (src et e2e), code de sortie 0.
- **Ni build ni e2e** n'ont été lancés, comme le veut la règle du dépôt. La spec e2e a été relue à la main (voir plus bas).

## Conformité au plan

- [x] Le code fait ce que le plan demande, rien de plus (quelques écarts mineurs plus bas)

Tâches vérifiées une par une :

1. **Domaine et registre.** `CategoryDomainConst.QUESTION`, `CATEGORY_DOMAINS`, `ActionIdConst.QUESTION_MANAGE` (`owner`,
   `board`), `MANAGE_ACTION_OF_DOMAIN` et `USAGE_COUNTS_OF_DOMAIN` sont en place. Les tests couvrent : membre refusé, le
   bureau qui crée, modifie et supprime dans le seul domaine `question`, le plafond compté par domaine, et le formulaire
   public des signalements qui ne lit jamais le domaine `question`.
2. **Modèle et migrations.** Colonnes, FK (`cascade` / `RESTRICT` / `RESTRICT`) et index `(organization_id, created_at
desc)` conformes. `0052` est générée, `0053` est faite avec `--custom` ; les deux sont au journal et ont leur snapshot.
   `0053` reprend à l'identique le patron de `0042` (ENABLE + FORCE + policy `tenant_isolation` sur `organization_id`).
   Table classée dans `docs/architecture.md` (décomptes 46 et 27). Aucun chemin applicatif ne supprime une
   `member_profile`, donc le `RESTRICT` sur `member_id` ne casse rien.
3. **Repository.** Tout passe par `getDb()`. Les jointures sur la catégorie et la fiche n'ont **pas** de filtre `deleted_at`.
   Les tests du SQL généré le vérifient (`not.toContain('"association_category"."deleted_at" is null')`), plus le tri, la
   pagination et l'absence de nom ou d'email dans l'INSERT.
4. **Routage.** `resolveQuestionRecipient` est une fonction pure et exclusive : `routing ?? contact`, une adresse vide ou
   blanche compte comme absente. `resolveReportRecipients` et `incident-report-service.ts` ne sont pas touchés : le routage
   « contact plus catégorie » des signalements (ADR 028 §5) est inchangé.
5. **Email et budget s52.** Contexte `{scope:'tenant', nature:'board_notification', reference:{type:'member_question'}}`,
   `recipientType:'system'`, `replyTo` quand la fiche a une adresse. `member_question` ajouté à `EmailSendReferenceType`, à
   `REFERENCE_TYPES` (contrôlé par `satisfies`), à la table `MARK_SOURCE_NOTIFICATION_FAILED` (contrôlée par `satisfies
Record<EmailSendReferenceType,…>`, donc exhaustive au typage) et à `/bureau/envois`. `sendEmailService` **lève** en cas
   d'échec et **renvoie** `{status:'deferred'}` en cas de report : la branche `try/catch` de `notifyBoardOfNewQuestion`
   traite donc un report comme un succès, et un échec comme le témoin plus une soumission réussie (test « should not flag a
   deferred notification »). Le rejeu raté pose le témoin (test ajouté dans `deferred-email-delivery.test.ts`, scope du
   tenant vérifié).
6. **Services et façade.** Fiche résolue par la session sous `withTenant`, catégorie active du domaine lue dans le scope, et
   Zod retire tout `memberId` glissé dans l'entrée (testé). Lecture du bureau protégée par `question.manage`, avec une
   seconde garde `row.organizationId !== organizationId`. Intercepteur en `shouldLogDetails: () => false`. Les deux
   `logger.error` ne portent que `questionId` et `error.name` : aucune donnée personnelle dans les journaux.
7. **Espace membre.** Carte sous « Mes signalements » dans les deux variantes avec fiche, absente sans fiche. Retour
   `?question=envoyee`, page (`withAuth`, `notFound()`), formulaire RHF + Zod, action serveur (`requireActionAuth`, ne lit
   que `categoryId` et `body`, messages traduits, `redirect` après succès selon le patron de s22), état B4 qui renvoie vers
   `/contact`.
8. **File et détail du bureau.** Contrôle d'accès répété dans chaque section, sous `<Suspense>`. Entrée de la barre
   latérale sans icône. État vide C3 géré, avec ou sans sujet ouvert.
9. **Sujets.** `ReportCategoriesManager` est paramétré par un contexte d'espace de libellés plus `backHref`, `intro` et
   `showUsageCount`, sans copie de l'écran. L'espace `BureauQuestionCategoriesPage` contient toutes les clés de
   `BureauReportCategoriesPage` (il n'y a que des ajouts). L'écran des signalements garde ses valeurs par défaut.
10. **Seed et e2e.** Deux sujets TechCorp, l'un avec adresse, l'autre sans. La cible de conflit `(organization_id, domain,
lower(name)) WHERE deleted_at IS NULL` correspond à l'index unique. La spec couvre les critères 1 à 5 et l'accès croisé.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé (chacun ouvert et vérifié)
- [x] Aucune valeur ni logique plausible mais fausse
- [x] Le code fait ce qu'il dit faire

Cibles ouvertes et vérifiées (nom, signature, emplacement) : `listActiveCategoriesDao(orgId, domain)`,
`getMemberProfileByUserIdDao(orgId, userId)`, `getAssociationSettingsService` (ouvre lui-même `withTenant`),
`getOrganizationByIdDao`, `associationOriginOf`, `resolveSupportedLocale`, `getAccentHue`, `CONTACT_EMAIL_SETTING_KEY`,
`pngLogoUrlOf` (`src/lib/emails/logo-url.ts`, déjà sur `main`), `receivedAtPartsOf(createdAt, locale)`,
`memberProfilePathOf`, le token `text-link` (`--color-link` dans `globals.css`), l'option `shouldLogDetails` de
`createServiceInterceptor`, `react?: ReactNode | Promise<ReactNode>` dans `SendEmailPayload`, `fitToLength` /
`fitSubjectToLength`.

- Le refactor de `incidentReportSubjectOf` vers `categorySubjectOf` donne le même résultat : même calcul de dépassement,
  même minimum de 12, même repli sur le nom de l'association.
- Pas d'`alias()` Drizzle, pas de `withRlsBypass`, pas de `process.env` dans `src`, pas de `db` utilisé directement.

## Conformité aux règles

- [x] Conventions du dépôt respectées (AGENTS.md)
- [x] Aucun ADR accepté contredit
- [x] Design system respecté (voir l'écart de pagination mobile, mineur)

- **ADR 002 et 003** : RLS forcée, `organization_id` sur la table, tenant résolu par le domaine (`requireCurrentTenantDal`).
- **ADR 010** : aucune valeur propre à La Fourche en dur. Adresses du sujet ou des Réglages, libellés dans `fr.json`. Les
  2 000 caractères et les 25 par page sont des limites de saisie et de présentation déclarées comme telles.
- **ADR 028** : domaine générique, aucune nouvelle table de catégories, suppression logique.
- **ADR 049** : identité lue sur la fiche résolue par la session, jamais dans l'entrée ; le bureau la lit par jointure.
- **ADR 053** : l'email est décompté et peut être reporté ; un report n'est pas un échec.

Design system : seuls des composants existants (`card`, `select`, `textarea`, `alert`, `badge destructive`, `table` en
cartes sous 640 px, `skeleton`, `breadcrumb`, `dialog`, `alert-dialog`). Aucune icône nouvelle, aucune couleur hors tokens.
Les écrans A à D suivent l'intention du design.

## Tests

- [x] Suite lancée par le relecteur, verte (4541 passés)
- [x] Les assertions vérifient bien les critères :
  - **Critère 2** : `toHaveBeenCalledTimes(1)` plus l'adresse `to` exacte, dans les deux branches.
  - **Identité** : un `memberId` étranger est injecté et ignoré.
  - **Critère 5** : SQL sans filtre, DTO `categoryDeleted`, texte de l'`alert-dialog`.
  - **Critère 3** : refus côté client et côté serveur.
  - **Rôles** : invité, membre, bureau et SuperAdmin.

### Relecture de la spec e2e (jamais exécutée)

- **Comptes et données** : `user-owner@gmail.com` (TechCorp), `user-admin@gmail.com` (Marketing Pro), Lucie Moreau
  `a1200000-…-006`, tous dans le seed et déjà utilisés par `incident-report.spec.ts` et `member-notes.spec.ts`. Les specs
  qui passent avant elle (`member-accounts`, `member-import`, `member-notes`, `member-profiles`) ne laissent pas la fiche
  modifiée.
- **Sélecteurs** confrontés aux composants réels et à `fr.json` (région « Une question pour le bureau ? », combobox « Sujet
  de votre question », `Lire`, `Répondre par email`, « 10 sur 10 », texte de `limitReached`, pluriel `one` du
  `deleteDialog`, notice « Sujet « … » supprimé. », « — catégorie supprimée ») : cohérents.
- **Nettoyage** : questions supprimées avant les sujets (`RESTRICT`), sujets de remplissage supprimés dans un `finally`,
  marqueurs portant `RUN`.
- **Accès croisé** : lecture, UPDATE sous le scope de B et lecture sans scope renvoient 0 ligne ; détail inaccessible
  depuis B.
- **Budget** : la spec ne lit aucun compteur. Elle suppose que TechCorp ait encore de la marge ce jour-là (sinon l'email
  serait reporté). `email-budget.spec.ts` remet son budget et ses réglages en `afterAll`, et `incident-report.spec.ts`
  dépend déjà de la même hypothèse. Risque assumé, pas un défaut.

## Régressions

- [x] Aucun impact sur les chemins existants
  - **Catégories de signalement** : seule modification, le renommage de la clé `breadcrumb.reports` en `breadcrumb.parent` ;
    plus aucune référence à l'ancienne clé dans `src` ni `e2e`.
  - **Routage et objet des signalements** : inchangés.
  - **`flagSourceNotificationFailed`** : passe d'un ternaire à une table, comportement identique pour `contact_message` et
    `incident_report` ; un type inconnu ne fait toujours rien.
  - **`/bureau/envois`** : une branche ajoutée, le reste intact.

## Constats

1. **mineur** — `member-question-types.ts` (`MEMBER_QUESTIONS_BUREAU_PAGE_SIZE = 25`) et `member-question-list.tsx` : la vue
   en cartes sous 640 px affiche 25 cartes par page, alors que le design system (§3.5) et le design de la story demandent 10.
   Écart reconnu ; aucune liste du bureau existante ne le fait (`CONTACT_MESSAGES_BUREAU_PAGE_SIZE`,
   `INCIDENT_REPORTS_BUREAU_PAGE_SIZE` à 25). À traiter dans une story transverse.
2. **mineur** — `bureau/questions/sujets/actions.ts` : `saveCategory`, `toFailure` et `revalidateCategoryScreens` recopient
   presque ligne pour ligne `signalements/categories/actions.ts` (seuls changent domaine, libellés et chemins). Le plan ne
   demandait de paramétrer que le composant. Une fabrique d'actions par domaine éviterait une troisième copie avec s35.
3. **mineur** — `MemberQuestionListPageDTO.hasOpenCategories` : ajout non listé au plan, justifié par l'état C3 du design et
   testé. Petite dérive acceptée.
4. **mineur** — `member-question-detail.tsx` : le lien vers la fiche (`memberProfilePathOf`) suppose que quiconque a
   `question.manage` peut ouvrir les fiches. Vrai avec les rôles par défaut ; pourra diverger quand s37 rendra les rôles
   ajustables. Pas d'effet aujourd'hui.
5. **mineur (processus)** — tests du gabarit email et du composant de détail écrits en même temps que le code (écart TDD
   reconnu). Présents, assertions réelles, verts. Migration dans le commit unique, ce qu'AGENTS.md permet.

Écarts déclarés par l'implémenteur : renommage `breadcrumb.parent` accepté ; actions dupliquées → constat 2 ; 25 cartes par
page → constat 1 ; migration dans le commit unique conforme ; `hasOpenCategories` → constat 3 ; service email qui renvoie le
résultat, correct et nécessaire ; helper d'objet partagé, équivalence vérifiée ; tests écrits avec le code → constat 5.

Aucun point critique ni majeur : routage exclusif correct, identité jamais lue de l'entrée, RLS forcée et table classée,
branchement s52 complet, pas de piège `alias()`, journaux sans donnée personnelle.

Max severity: minor
Ship allowed: yes
