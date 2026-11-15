---
validated: yes
---

# Plan — Story s23-questions-bureau

Branch: `feature/s23-questions-bureau`

Sources : `docs/research/s23-questions-bureau.md`, `docs/designs/s23-questions-bureau.md` (+ `.html`), ADR 028 (catégories
génériques), ADR 049 (identité d'un membre résolue par la session), ADR 053 (budget d'envoi), AGENTS.md.

## Target story

**En tant que** membre propriétaire **je veux** poser une question identifiée dans une catégorie **afin qu'**elle arrive
directement à la bonne personne du bureau. Complexité 2.

1. Un membre connecté choisit une catégorie dans une liste et envoie sa question ; elle est enregistrée et notifiée par email.
2. La question part vers l'adresse de routage de la catégorie choisie ; si la catégorie n'en a pas, vers l'adresse de contact
   générale du tenant.
3. Le bureau administre les catégories (libellé + email de routage facultatif), maximum 10, la 11ᵉ refusée avec un message
   explicite.
4. Le bureau consulte les questions reçues avec l'identité du membre et sa catégorie.
5. Supprimer une catégorie ne supprime pas les questions déjà reçues dans cette catégorie.

## Décisions de conception (pas d'ADR nouveau)

Aucun choix structurel nouveau : s23 applique l'ADR 028 (nouveau domaine, pas de table de catégories) et l'ADR 049 (fiche
résolue par la session). Ce qui est propre à s23 :

- **D1 — Routage exclusif.** Destinataire = `routing_email` de la catégorie s'il existe, sinon `contact.email` des Réglages,
  lu à l'envoi. **Un seul envoi.** C'est le critère 2 ; l'ADR 028 §5 (contact **plus** catégorie) ne vaut que pour les
  signalements. Fonction pure dédiée, pas `resolveReportRecipients`.
- **D2 — Catégorie obligatoire.** Une question sans catégorie active du domaine `question` est refusée (`ValidationError`).
  Sans aucune catégorie ouverte, la page n'affiche pas de formulaire mais renvoie vers la page Contact (design B4) —
  arbitrage de Marie-Ève du 14/11/2026.
- **D3 — Identité jointe, pas copiée.** La question porte `member_id` (clé de la fiche, jamais l'email) ; le bureau lit nom et
  email **par jointure** sur `member_profile` (une seule source, critère 4). Aucune identité n'est lue de l'entrée.
- **D4 — Une seule action au registre** : `question.manage` (consulter les questions, administrer les sujets), rôles par
  défaut `owner`, `board` — précédent `report.manage`.
- **D5 — Notification `board_notification`**, `recipientType: 'system'`, référence `member_question` : décomptée et reportable
  par le budget de s52 ; un report n'est pas un échec. Échec d'envoi (direct ou rejeu raté) → témoin `notification_failed`,
  la soumission réussit quand même (précédent s08/s10).
- **D6 — Longueur de la question** : 2 000 caractères, comme la description d'un signalement
  (`REPORT_DESCRIPTION_MAX_LENGTH`) — limite de saisie, pas un seuil métier.
- **Hors périmètre** : liste « mes questions » côté membre, réponse dans l'outil, statut lu / non lu, pièce jointe,
  connexion à la place (s48) au-delà de ce que fait s22.

## Tasks (ordered)

1. [x] **Domaine `question` et action du registre.** `CategoryDomainConst.QUESTION = 'question'` + `CATEGORY_DOMAINS` ;
   `ActionIdConst.QUESTION_MANAGE = 'question.manage'` déclarée dans `ACTION_REGISTRY` (`owner`, `board`) ;
   `MANAGE_ACTION_OF_DOMAIN` reçoit `question` ; `USAGE_COUNTS_OF_DOMAIN` reçoit le compteur de la tâche 3.
   Tests : un membre du bureau gère les catégories `question`, un membre simple est refusé ; les catégories `report` ne sont
   pas visibles depuis le domaine `question` (et inversement) ; le plafond de 10 vaut par domaine.
2. [x] **Modèle `member_question` et migrations.** `src/db/models/member-question-model.ts` : `id`, `organization_id`
   (`NOT NULL`, cascade), `member_id` → `member_profile` (`NOT NULL`, `RESTRICT`), `category_id` → `association_category`
   (`NOT NULL`, `RESTRICT`), `body` (text), `notification_failed` (bool, défaut faux), `created_at` ; index
   `(organization_id, created_at desc)`. `pnpm db:generate`, puis `drizzle-kit generate --custom` pour la RLS forcée +
   policy `tenant_isolation` (patron `0042_member_note_rls.sql`). Table ajoutée à `docs/architecture.md` (liste des tables
   classées et tableau). Test : le test de classement des tables RLS de s01 passe avec la nouvelle table.
3. [x] **Repository.** `src/db/repositories/member-question-repository.ts`, tout via `getDb()` : `createMemberQuestionDao`,
   `getMemberQuestionsPageDao(organizationId, page, pageSize)` et `getMemberQuestionByIdDao(id)` (jointures catégorie — nom,
   `deleted_at` — et fiche — nom, email), `countMemberQuestionsByCategoryDao(organizationId)`,
   `markMemberQuestionNotificationFailedDao(id)`. Tests unitaires du SQL généré (précédent `campaign-repository.test.ts`) :
   jointure sur la catégorie **sans** filtre `deleted_at` (critère 5), tri, pagination.
4. [x] **Règle de routage.** Fonction pure `resolveQuestionRecipient(routingEmail, contactEmail)` (dans
   `src/services/types/domain/member-question-types.ts` ou `rules/`). Tests : adresse de catégorie seule retenue ; sans elle,
   contact ; ni l'une ni l'autre → `undefined` (l'appelant lève) ; espaces et chaîne vide traités comme absents.
5. [x] **Email au bureau et budget s52.** `sendMemberQuestionNotificationEmailService` dans `email-service.ts` + gabarit React
   Email `MemberQuestionMail` (patron `ContactMessageMail`, pied de page de notification du §5.4) + libellés
   `email.question.notification` dans `messages/fr.json` : association, sujet, membre (nom, email), date, texte, lien vers
   `/bureau/questions/<id>`, « répondez directement au membre ». Contexte `{scope: 'tenant', organizationId, nature:
   'board_notification', reference: {type: 'member_question', id}}`, `recipientType: 'system'`, `replyTo` = email du membre
   s'il en a un. Ajouter `member_question` à `EmailSendReferenceType`, à `REFERENCE_TYPES` (`email-budget-rules.ts`), à
   `flagSourceNotificationFailed` et à `/bureau/envois` (titre « Question d'un membre », action « Voir la question »).
   Tests : objet et texte, contexte d'envoi, rejeu raté → témoin posé sur la question, ligne de `/bureau/envois`.
6. [x] **Services et façade.** `src/services/member-question-service.ts` + façade + intercepteur de journalisation :
   - `createMyQuestionService({organizationId, locale, categoryId, body})` : session requise ; fiche par
     `getMemberProfileByUserIdDao` sous `withTenant` (sans fiche → `{status: 'not_found'}`) ; catégorie active du domaine
     `question` lue dans le scope du tenant (absente ou d'un autre tenant → `ValidationError`) ; écriture ; destinataire
     (D1) ; envoi ; échec → témoin + journal sans contenu, soumission réussie (`notificationFailed: true`).
   - `listMyQuestionCategoriesService(organizationId)` (membre connecté avec fiche ; id + nom, jamais l'adresse) et
     `getMyQuestionIdentityService` (nom, email de la fiche).
   - `getMemberQuestionsPageService(organizationId, page)` et `getMemberQuestionService(organizationId, id)` sous
     `question.manage` ; `canManageMemberQuestionsService`.
   Tests par rôle (invité, membre, bureau, SuperAdmin) : routage vers la catégorie / vers le contact (critères 1, 2),
   catégorie supprimée ou d'un autre tenant refusée, identité jamais lue de l'entrée, échec de notification non bloquant,
   lecture refusée à un membre simple, nom de catégorie supprimée lu avec son marqueur (critère 5).
7. [x] **Espace membre.** DAL (`member-space-dal.ts` ou `member-question-dal.ts`, sans cache : données par utilisateur) ;
   carte « Une question pour le bureau ? » dans `MemberSpace` sous « Mes signalements » + retour `?question=envoyee`
   (A1, A2) ; page `src/app/[locale]/(app)/dashboard/question/page.tsx` (`withAuth`, `notFound()` sans fiche), formulaire
   client RHF + Zod (`select` + `textarea` + compteur, bloc « Ce que le bureau reçoit »), Server Action
   (`requireActionAuth`, validation serveur, messages traduits), états B1 à B4. Libellés dans `messages/fr.json`.
   Tests de composants et d'action : erreurs de saisie, échec technique (texte conservé), aucun sujet → renvoi vers Contact.
8. [x] **Bureau : questions reçues.** `src/app/[locale]/(bureau)/bureau/questions/page.tsx` (liste paginée, cartes sous
   640 px) et `[id]/page.tsx` (détail, `mailto:`, lien vers la fiche), DAL, entrée « Questions des membres » dans
   `bureau-sidebar.tsx` (groupe « L'association », sans icône), `BureauAccessDenied` sans `question.manage`. États C1 à C3.
   Tests : identité et catégorie affichées (critère 4), « catégorie supprimée », badge d'échec, vide, refus d'accès.
9. [x] **Bureau : sujets des questions.** `/bureau/questions/sujets` (page + actions sur le domaine `question`).
   `ReportCategoriesManager` est **paramétré** (espace de libellés, lien de retour) plutôt que dupliqué ; l'écran des
   signalements reste identique (ses tests passent sans changement de comportement). Libellés « sujet » dans
   `messages/fr.json`. Tests : 11ᵉ sujet refusé avec le message explicite (critère 3), suppression avec le nombre de
   questions conservées, adresse vide → « Adresse de contact ».
10. [x] **Seed et e2e.** Seed déterministe : deux sujets de question pour le premier tenant (un avec adresse, un sans).
    `e2e/member-questions.spec.ts` : un membre envoie une question dans chaque sujet → la boîte de sortie reçoit un email à
    l'adresse du sujet, puis un à l'adresse de contact (critères 1, 2) ; le bureau la lit avec nom, email et sujet
    (critère 4) ; 11ᵉ sujet refusé (critère 3) ; sujet supprimé → la question reste lisible avec « catégorie supprimée »
    (critère 5) ; **accès croisé** : depuis B, aucune question ni catégorie `question` de A n'est lisible ou modifiable
    (`inTenantScope`), et le bureau de B ne voit pas la question de A. Nettoyage de ce que la spec crée. Ne pas dépendre des
    compteurs du budget (`email-budget.spec.ts`).

## Files touched

- Modèles / migrations : `src/db/models/member-question-model.ts`, `src/db/models/db.ts` (export du schéma si requis),
  `drizzle/migrations/0052_*.sql` + `0053_member_question_rls.sql` (+ journal et snapshot générés).
- Persistance : `src/db/repositories/member-question-repository.ts` (+ test).
- Services : `member-question-service.ts`, `facades/member-question-service-facade.ts`,
  `facades/interceptors/member-question-service-logger-interceptor.ts`, `validation/member-question-validation.ts`,
  `types/domain/member-question-types.ts`, `association-category-service.ts`, `types/domain/association-category-types.ts`,
  `types/domain/action-registry-types.ts`, `email-service.ts`, `rules/email-budget-rules.ts`,
  `types/domain/email-send-types.ts`.
- Email : `src/components/emails/member-question-mail.tsx` (emplacement réel des gabarits à suivre).
- Présentation : `src/app/dal/member-question-dal.ts` (ou `member-space-dal.ts`), `(app)/dashboard/page.tsx`,
  `(app)/dashboard/question/{page,actions,question-form-validation}.ts(x)`, `components/features/member-space/*`,
  `(bureau)/bureau/questions/{page,[id]/page,sujets/page,sujets/actions}.tsx`, `components/features/member-question/*`,
  `components/features/incident-report/report-categories-manager.tsx`, `components/features/association/bureau-sidebar.tsx`,
  `components/features/email-sending/email-sending-overview.tsx`.
- Données et docs : `messages/fr.json`, `src/db/scripts/seed.ts`, `docs/architecture.md`, `e2e/member-questions.spec.ts`.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`, sur une copie locale si le montage 9p fait expirer des workers)** : règle de routage
  (pure), services par rôle avec DAO mockés, SQL généré du repository, gabarit et texte de l'email, ligne de
  `/bureau/envois`, composants (formulaire, file, détail, carte), actions serveur.
- **e2e (Playwright, en CI seulement)** : parcours membre → email routé → lecture par le bureau ; plafond ; suppression ;
  **test d'accès croisé entre deux tenants** (la RLS n'est pas testable en unitaire).
- Pas de `pnpm build` local.

## Definition of Done

- Une PR, une story : un commit de story (plus un commit à part pour la migration si on veut pouvoir la reverter seule).
- Les cinq critères couverts par au moins un test, l'isolation par l'e2e croisé.
- Aucune régression : écran des catégories de signalement et routage des signalements inchangés, `/bureau/envois` intact.
- Nouvelle table sous RLS forcée et classée dans `docs/architecture.md` ; action déclarée au registre ; aucune valeur propre
  à La Fourche en dur ; aucune donnée personnelle dans les journaux.
- Revue passée (`Ship allowed: yes`), CI verte ; déploiement à faire avec le prochain passage en production.
