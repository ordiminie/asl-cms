---
validated: yes
---

# Plan — Story s22-signalement-membre

Branch: `feature/s22-signalement-membre`

## Target story

**Suivre son signalement depuis son espace** (complexité 2, avec écran). Un membre propriétaire déclare une
fuite depuis son espace sans ressaisir son identité, et suit le statut de ses déclarations.

Critères d'acceptation :

1. Un membre connecté déclare un incident sans ressaisir son identité ; le bureau voit le déclarant dans la file.
2. Le membre voit la liste de **ses propres** déclarations avec leur statut à jour.
3. Un membre ne voit aucune déclaration d'un autre membre (test d'autorisation croisée).
4. Le changement de statut par le bureau est visible par le membre déclarant.
5. La notification email part vers **les mêmes adresses paramétrées** que le signalement public.

Entrées : `docs/research/s22-signalement-membre.md`, `docs/designs/s22-signalement-membre.md` (maquette validée
le 09/11/2026), arbitrages V1 du 09/11/2026 (pas de quota, pas d'historique ni de nom du bureau côté membre,
pas de modification ni retrait, pas de notification du membre, compte sans fiche = pas de carte).

### Décisions prises au plan (ADR 049)

- `member_id` → FK vers **`member_profile.id`**, `ON DELETE RESTRICT`, plus un index `(organization_id, member_id, created_at desc)`. Une migration, **pas de table**.
- Déclarant **copié** dans `reporter_*` à la déclaration : la file, le détail et l'email du bureau gardent leur source.
- Aucun lien parcelle : le signalement est rattaché au propriétaire déclarant, la « localisation » libre suffit.
- Le public reste inchangé : `/signaler` n'écrit jamais `member_id` (critère 8 de s10).
- Design system gap B3 (bouton désactivé) : on réutilise l'état `disabled` du composant `button`, sans nouveau token.

## Tasks (ordered)

Étapes de bas en haut, chacune avec le test qui peut échouer. Tests unitaires Vitest (`pnpm test --run`) ; l'isolation est prouvée en e2e (la RLS n'est pas testable en unitaire).

1. [x] **Schéma + DAO.** Dans `incident-report-model.ts` : FK `member_id` → `member_profile.id` `ON DELETE RESTRICT` + index `(organization_id, member_id, created_at desc)`, commentaire du modèle mis à jour (vérifier d'abord l'absence de cycle d'import avec `member-profile-model`). Migration générée par `pnpm db:generate` uniquement. Dans le repository : `createIncidentReportTxnDao` accepte `memberId` optionnel (le `Pick` s'étend) ; nouveau `getMyIncidentReportsDao(memberId)` (catégorie jointe, plus récent d'abord, tous, sans pagination). _Échec attendu avant : typecheck et `pnpm db:generate` (diff de schéma)._
2. [x] **Types de domaine.** Dans `incident-report-types.ts` : `MyIncidentReportDTO` (`id`, `categoryName|null`, `location`, `status`, `createdAt`, `updatedAt|null`) — **sans** `notificationFailed`, `organizationId`, `authorName`, `on_behalf_of_*`, ni description ; `CreateMyIncidentReportInput`/résultat. `IncidentReportListItemDTO` gagne `reportedByMember: boolean`. « Mis à jour le » = date du dernier événement **si** le statut a changé (statut ≠ `reported`) : lire l'événement le plus récent via un DAO dédié ou un agrégat `max(created_at)` dans `getMyIncidentReportsDao`.
3. [x] **Validation + service de création.** `createMyIncidentReportServiceSchema` (`organizationId`, `locale`, `categoryId?`, `location`, `description` — **aucun** champ identité ni `memberId` : Zod les retire). `createMyIncidentReportService` dans `incident-report-service.ts` : `safeParse` → `getAuthUser()` (`AuthorizationError` sans session) → `withTenant` → fiche par `getMemberProfileByUserIdDao(organizationId, authUser.id)` → `not_found` sans fiche → `resolveReportCategory` → `createIncidentReportTxnDao` avec `memberId` et `reporter*` copiés de la fiche → `notifyBoard` **réutilisée** (échec = témoin posé, soumission non échouée). Premier événement **sans auteur**, comme le public. _Tests : invité refusé ; sans fiche → `not_found` sans écriture ; `memberId`/`name`/`email` glissés dans l'entrée ignorés ; coordonnées copiées de la fiche ; catégorie d'une autre association refusée ; échec d'envoi → `notificationFailed: true` sans levée ; destinataires = `resolveReportRecipients` (critère 5). Le test existant `not.toHaveProperty('memberId')` du chemin public reste vert._
4. [x] **Service de lecture.** `getMyIncidentReportsService(organizationId)` : session + fiche par domaine, **aucun identifiant de fiche en entrée**, lecture par `memberId` de la fiche résolue ; `undefined` sans fiche. Plus un petit service `getMyReportIdentityService` (nom, email, téléphone de la fiche) pour le bloc « Ce que le bureau reçoit ». `toListItemDto` renseigne `reportedByMember`. _Tests : invité refusé ; sans fiche → `undefined` ; ne passe que le `memberId` de la session au DAO ; DTO sans champs internes._
5. [x] **Façade, intercepteur, DAL.** Exports dans `incident-report-service-facade.ts` ; intercepteur avec `shouldLogDetails: () => false` pour ces fonctions (précédent `member-space-service-logger-interceptor.ts`). `member-space-dal.ts` : `getMyIncidentReportsDal` et `getMyReportIdentityDal`, `cache()` seul, **jamais `'use cache'`** (donnée par utilisateur, ADR 038). _Test : DAL passe l'id du tenant courant, rien d'autre._
6. [x] **Server Action de déclaration.** `src/app/[locale]/(app)/dashboard/signaler/actions.ts` : `requireActionAuth()` en premier → tenant du domaine → validation du formulaire (schéma de `report-form-validation.ts` **sans** nom/email/téléphone, messages repris mot pour mot de s10, catégories offertes) → `createMyIncidentReportService` via la façade → `redirect('/dashboard?signalement=envoye')`. **Aucun quota** (arbitrage V1). États : `invalid` (valeurs conservées), `failed` (échec technique, texte conservé), sans fiche → même `failed` générique. _Tests : sans session refusé ; invalide = aucune écriture ; succès redirige ; pas d'appel au limiteur._
7. [x] **Écran B — page et formulaire.** `dashboard/signaler/page.tsx` (RSC, `withAuth`, colonne `max-w-[68ch]`, lien « Revenir à mon espace », `h1`, alerte neutre du 112 reprise de s10) + `components/features/member-space/my-report-form.tsx` (client, React Hook Form + Zod, composants `form`/`select`/`input`/`textarea`/`button` existants). Pas de champ identité ; bloc « Ce que le bureau reçoit » entre champs et boutons ; B5 (sans catégorie : champ absent) ; B6 (téléphone absent : phrase adaptée + « Ajouter mon téléphone » → `#mes-coordonnees`, **ancre à créer sur la carte « Mes coordonnées »**, introuvable aujourd'hui) ; un seul bouton `default`, « Annuler » `outline` ; état d'envoi = `disabled` du composant, libellés superposés pour tenir la largeur. Libellés dans un nouvel espace de noms de `messages/fr.json`. _Tests de composant : B1, B2, B3, B4, B5, B6 ; aucun champ nom/email/téléphone ; un seul bouton `default`._
8. [x] **Écran A — carte « Mes signalements ».** `my-reports-card.tsx` dans `components/features/member-space/`, intercalée **entre « Mes coordonnées » et « Sécurité du compte »** dans `MemberSpace` ; liste (catégorie / « Sans catégorie », lieu tronqué, « Envoyé le », « Mis à jour le » conditionnel, `ReportStatusBadge` existant), vide (A2), chargement `skeleton` (A3, bouton visible), `alert` de succès au retour (A5, via `?signalement=envoye`, lue dans `page.tsx` comme `?role=retire`). `reportsPromise` ajoutée à `MemberSpace` et `page.tsx`. Aucune carte pour un compte sans fiche (C5 inchangé). _Tests : A1, A2, A3, A5 ; le bouton « Signaler… » est `outline` ; `member-space.test.tsx` et `page.test.tsx` mis à jour._
9. [x] **Bureau — mention « Membre ».** `incident-report-list.tsx` : « Membre · » + email (ou téléphone) sous le nom, **texte seul** ; `incident-report-detail.tsx` : « Membre de l'association » sous le nom dans Coordonnées ; textes dans `BureauReportsPage`. Email : aucun changement de gabarit (les `reporter*` copiés l'alimentent) — un test le fige. _Tests : file et détail pour un signalement de membre et pour un public (inchangé, « Aucune coordonnée laissée »)._
10. [x] **Seed + e2e.** Seed : si besoin, un signalement de membre déterministe (`src/db/scripts/seed.ts`, comptes Moreau/Pommier de `tenant-member-profiles-seed.ts`). `e2e/incident-report.spec.ts` : (a) Moreau déclare sans ressaisie → la file du bureau la montre avec « Membre » (critères 1) ; (b) la carte de Moreau n'affiche que les siennes, **pas celles de Pommier** (critère 3) ; (c) Pommier chez l'autre tenant : aucune fuite entre associations ; (d) le bureau passe en cours → le membre voit « En cours » au rechargement (critères 2 et 4) ; (e) un signalement public avec les mêmes coordonnées exactes **n'est pas lié** (critère 8 de s10) ; (f) un compte sans fiche n'a pas la carte.

## Files touched

- `src/db/models/incident-report-model.ts` ; migration générée dans `drizzle/migrations/` (+ journal/snapshot par drizzle-kit) ; `src/db/repositories/incident-report-repository.ts`
- `src/services/incident-report-service.ts` ; `src/services/validation/incident-report-validation.ts` ; `src/services/types/domain/incident-report-types.ts` ; `src/services/facades/incident-report-service-facade.ts` ; `src/services/facades/interceptors/incident-report-service-logger-interceptor.ts`
- `src/app/dal/member-space-dal.ts`
- `src/app/[locale]/(app)/dashboard/{page.tsx, signaler/page.tsx, signaler/actions.ts, signaler/*-validation.ts}`
- `src/components/features/member-space/{member-space.tsx, my-reports-card.tsx, my-report-form.tsx, my-contact-card.tsx (ancre)}`
- `src/components/features/incident-report/{incident-report-list.tsx, incident-report-detail.tsx}`
- `messages/fr.json` ; `src/db/scripts/seed.ts` (si besoin) ; `e2e/incident-report.spec.ts`
- Tests colocalisés : service, DAL, action, composants, `member-space.test.tsx`, `page.test.tsx`, listes et détail du bureau
- `docs/decisions/049-signalement-de-membre-lie-a-la-fiche.md` (ADR, voyage avec la branche)

Ne sont **pas** touchés : `/signaler` (public), `src/proxy.ts` (`/dashboard/*` est déjà couvert par `AUTHENTICATED_SEGMENTS`), le gabarit d'email, `notifyBoard` (réutilisée telle quelle), `rate-limit-service`.

## Test strategy

- **Unitaire (Vitest, DAO mockés)** : services (création, lecture, autorisation invité, compte sans fiche, entrée sanitisée, notification réutilisée), action, DAL, composants des trois écrans et leurs états. `pnpm test --run`.
- **e2e (Playwright, build de production, Postgres éphémère)** : l'isolation par RLS et le test d'accès croisé entre deux membres et entre deux tenants, le parcours complet déclarer → bureau → statut visible, et la non-régression du public (critère 8 de s10). Un « zéro résultat » inexpliqué = premier soupçon d'un oubli de scope.
- Vérifications : `pnpm lint`, typecheck, `pnpm check:rules`. Pas de `pnpm build` automatique.
- Pièges à relire : `incident-report-service.test.ts`, `incident-report-recipients.test.ts`, `incident-report-email-service.real-i18n.test.tsx`, `incident-report-list/detail.test.tsx`, `member-space.test.tsx`.

## Risks / traps carried from research

- Aucun `'use cache'` sur la lecture du membre ; pas de `logger` dans un scope caché.
- Le membre ne doit jamais recevoir `notificationFailed`, `organization_id`, `author_name` ni `on_behalf_of_*`.
- Ne pas protéger ni brancher la session sur `/signaler`.
- Imitation (s48) hors périmètre : sous imitation, l'auteur de la trace reste le comportement existant ; non traité ici.
- Aucune ligne existante n'a de `member_id` : la contrainte ne peut pas échouer sur les données actuelles.

## Definition of Done

- Une PR, un commit de story (recherche, design, plan, ADR et revue inclus), description structurée, diff lisible.
- Les cinq critères d'acceptation couverts par un test (unitaire ou e2e), dont l'accès croisé en e2e.
- Aucune régression : tests existants du signalement public verts.
- Aucune valeur en dur (catégories et adresses lues en paramètres), libellés dans `messages/fr.json`.
- Migration produite par `pnpm db:generate` ; migration, `.env` : aucune variable nouvelle.
- `/ks-review` passée (`Ship allowed: yes`) ; déploiement par `/ks-ship`.
- Le zip `docs/designs/s22.zip` reste non versionné.
