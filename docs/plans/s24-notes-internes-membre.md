---
validated: yes
---

# Plan — Story s24-notes-internes-membre

Branch: `feature/s24-notes-internes-membre`

## Target story

**Tenir les notes internes sur un membre** (complexité 2, avec écran). Le bureau consigne des notes et
l'historique des échanges sur un membre, pour que le suivi survive au renouvellement du bureau.

Critères d'acceptation :

1. Le bureau ajoute une note datée et signée sur la fiche d'un membre, et la retrouve à la consultation suivante.
2. Le bureau consigne un échange : date, canal (téléphone, courrier, en personne, email), résumé libre.
3. La fiche affiche notes et échanges dans un fil chronologique unique ; chaque entrée porte auteur, date et type.
4. Un membre n'a **aucun** accès à ses notes internes ni à celles d'un autre, ni par une page ni par un appel serveur côté membre (test d'autorisation explicite). Leur présence dans sa copie relève de s40.
5. Une note peut être modifiée ou supprimée par le bureau ; l'auteur et la date de dernière modification restent visibles.

Entrées : `docs/research/s24-notes-internes-membre.md`, `docs/designs/s24-notes-internes-membre.md` (maquette validée le 09/11/2026, états a à l). Un échange est une **saisie manuelle** : aucune alimentation automatique du fil.

### Décisions prises au plan (ADR 050)

- **Une table `member_note`** : `kind` (`note` | `exchange`), `channel` nullable, `CHECK` canal ⇔ échange. Tri `entry_date desc, created_at desc, id desc` (`entry_date` = jour choisi pour un échange, jour de saisie pour une note).
- FK → `member_profile.id` **`ON DELETE RESTRICT`** ; auteur copié (`author_*`, `on_behalf_of_*` via `effectiveAuthor`) ; **`updated_at` seul** (« Modifiée le … », sans nom) ; **suppression physique** ; note et échange traités pareil, **type immuable**.
- Action propre **`member.note.manage`** (`owner`, `board`). Un compte du bureau lit les notes qui le concernent ; un `member` n'a aucun accès.
- Canaux = liste fermée de code ; plafond **2 000** caractères et page de **10** = constantes nommées.
- Choix de design tranchés ici : sur mobile, « Garder … » **en premier** et **focus initial sur « Garder »** dans la boîte de suppression ; modifier un échange rouvre les trois champs de l'état e, pré-remplis ; phrases de succès « Note enregistrée. », « Échange enregistré. », « Note modifiée. », « Échange modifié. », « Note supprimée. », « Échange supprimé. » (l'`alert` reste jusqu'à la prochaine action) ; échec de suppression « La note n'a pas pu être supprimée. Elle est toujours sur la fiche. Réessayez dans un instant. » (et son pendant « échange »).
- Pagination par lien : paramètre d'URL `notes` (`?notes=2`), comme `?page=` ailleurs.
- Pas de seed : chaque spec e2e crée ses données (comme `member-profiles.spec.ts`).

## Tasks (ordered)

De bas en haut, chacune avec le test qui peut échouer. Vitest : `pnpm test --run`. La RLS ne se prouve qu'en e2e, **exécuté sur GitHub, jamais en local**.

1. [x] **Modèle + migrations.** `src/db/models/member-note-model.ts` : enums `member_note_kind` et `member_note_channel`, table `member_note` (`id`, `organization_id` cascade, `member_profile_id` → `member_profile.id` **RESTRICT**, `kind`, `channel` nullable, `entry_date` `date` mode string, `body`, `author_user_id` SET NULL, `author_name`, `on_behalf_of_user_id` SET NULL, `on_behalf_of_name`, `created_at`, `updated_at` nullable), `CHECK ((kind = 'exchange') = (channel IS NOT NULL))`, index `(organization_id, member_profile_id, entry_date desc, created_at desc)`. Export dans l'index des modèles. Schéma par `pnpm db:generate` (→ `0041_*`), puis RLS par `drizzle-kit generate --custom` (`ENABLE` + `FORCE` + policy `tenant_isolation`, calquée sur `0036_member_role_event_rls.sql`). **Jamais de SQL ni de journal à la main.** _Échec attendu avant : typecheck (modèle absent) et diff de schéma de `db:generate`._
2. [x] **Types, règles pures, validation.** `src/services/types/domain/member-note-types.ts` : canaux (liste fermée), `MEMBER_NOTE_BODY_MAX = 2000`, `MEMBER_NOTES_PAGE_SIZE = 10`, `MemberNoteDTO` (`id`, `kind`, `channel`, `entryDate`, `body`, `authorName`, `createdAt`, `updatedAt`), page, entrées de création/modification, résultats. `src/services/rules/member-note-rules.ts` : `toMemberNoteDto` (liste blanche, **sans** `author_user_id`, `organization_id` ni `on_behalf_of_*`). `src/services/validation/member-note-validation.ts` : schémas service pour note et échange (texte non vide après trim, ≤ plafond ; échange : canal de la liste, date `jj` ISO valide **non future** via `calendarDayOf`, hors entrée : `memberProfileId`/`organizationId` validés en uuid). _Tests : DTO sans champ interne ; note sans canal ni date acceptée ; échange sans canal, avec date future, texte vide ou trop long refusés ; canal inconnu refusé._
3. [x] **Repository.** `src/db/repositories/member-note-repository.ts`, `getDb()` jamais `db` : `getMemberNotesPageDao(memberProfileId, page)` (lignes + total, ordre ADR 050), `createMemberNoteTxnDao`, `updateMemberNoteTxnDao(id, memberProfileId, kind, patch)` (`where id and member_profile_id and kind` : le type ne change pas ; pose `updated_at`), `deleteMemberNoteTxnDao(id, memberProfileId)` ; chaque écriture renvoie la ligne ou `undefined`. _Tests (mocks, sur le modèle de `incident-report-repository.test.ts`) : ordre et pagination demandés, mise à jour qui ne cible ni l'auteur ni le type, ligne absente → `undefined`._
4. [x] **Autorisation, service, façade, intercepteur.** `ActionIdConst.MEMBER_NOTE_MANAGE = 'member.note.manage'` + entrée `ACTION_REGISTRY` `['owner','board']`, avec les tests d'entrée de registre sur le modèle de `action-registry-authorization.test.ts`. `src/services/member-note-service.ts` : `listMemberNotesService`, `addMemberNoteService`, `addMemberExchangeService`, `updateMemberNoteService`, `updateMemberExchangeService`, `deleteMemberNoteService`. Ordre de chaque fonction : `safeParse` → `getAuthUser()` + `canPerformAction(MEMBER_NOTE_MANAGE)` sinon `AuthorizationError` → auteur par `effectiveAuthor` + `getActingContext` **lus avant** `withTenant` → `withTenant` → fiche par `getMemberProfileByIdDao` (`not_found` sinon, aucune écriture) → DAO. `entry_date` d'une note = `calendarDayOf(now)` ; texte revérifié côté service. Façade `member-note-service-facade.ts` ; intercepteur `member-note-service-logger-interceptor.ts` avec `shouldLogDetails: () => false` (précédent `member-space-service-logger-interceptor.ts`). _Tests d'autorisation explicites (critère 4) : anonyme, `member`, `board` d'**une autre association**, SuperAdmin **à la place d'un membre simple** (session imitée) refusés **sans appel au DAO** ; `board` lisant sa propre fiche autorisé ; auteur copié par `effectiveAuthor`, jamais saisi ; `authorUserId`/`kind`/`organizationId` glissés dans l'entrée ignorés ; modifier un échange avec l'id d'une note → `not_found` ; fiche d'une autre association → `not_found`._
5. [x] **DAL + Server Actions.** `src/app/dal/member-note-dal.ts` : `getMemberNotesForBureauDal(tenantId, memberProfileId, page)`, `cache()` seul, **jamais `'use cache'`** (donnée personnelle, ADR 038). `src/app/[locale]/(bureau)/bureau/proprietaires/notes-actions.ts` (fichier voisin de `actions.ts`, déjà à 393 lignes) : quatre actions (note, échange, modification, suppression) sur le patron de `actions.ts` : `requireCurrentTenantDal` → `getTranslations` → `requireActionAuth()` → schéma Zod de formulaire → façade → `revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')` **après** succès ; erreurs rendues en résultats (`AuthorizationError` → `errors.forbidden`, saisie conservée). Messages dans `messages/fr.json` sous `BureauMemberProfilesPage`. _Tests : DAL passe le tenant courant, rien d'autre ; action sans session refusée ; saisie invalide = aucune écriture ; succès revalide ; texte jamais dans un `logger`._
6. [x] **Écran — carte « Notes et échanges » et fil** (états a, b, c, l). `src/components/features/member-profile/member-notes-card.tsx` dans `DetailCard`, montée **après « Parcelles »** : en-tête `h2`, phrase `meta` « Visible du bureau seulement. Le propriétaire ne les voit pas. » (sans icône), deux boutons `outline`, fil `ol` du plus récent au plus ancien (badge « Note » `outline` / « Échange » `secondary` + canal écrit, date `jj/mm/aaaa hh:mm` pour une note et `jj/mm/aaaa` pour un échange, texte `pre-wrap`, « Écrit par … », « · Modifiée le … à … » si `updatedAt`), état vide, `pagination` « Précédent / Suivant » écrits. `page.tsx` crée `notesPromise` **sans l'attendre** et la passe à `MemberProfileDetail` ; la carte la déroule avec `use()` derrière `<Suspense>` (trois `skeleton`, titre et boutons déjà là) ; lit `?notes=` (borné ≥ 1). Aucun composant ni token inventé : un besoin non couvert est un « design system gap », pas une improvisation. _Tests de composant : fil rempli (a), vide (b), chargement (c), fil long et pagination (l) ; ordre et libellés de type ; « Modifiée le » seulement si modifiée ; `member-profile-detail.test.tsx` et `page.test.tsx` mis à jour._
7. [x] **Écran — formulaires, modification, suppression, retours** (états d à k). Même fichier ou voisins (`member-note-form.tsx`, `member-note-delete-dialog.tsx`) : formulaire d'**ajout en place**, un seul ouvert à la fois (les deux boutons s'effacent), React Hook Form + Zod ; note = `textarea` + compteur « 0 / 2 000 » ; échange = `DateField` pré-rempli à aujourd'hui (`today` fourni par la page), `select` canal, `textarea`. Erreurs : résumé ancré « N champs à corriger. Rien n'a été enregistré. », compteur dépassé (« N caractères de trop. »). **Modifier** : bloc pré-rempli en place (échange : trois champs). **Supprimer** : `alert-dialog` (« Supprimer cette note ? » / « Supprimer cet échange ? », « Garder … » en premier, focus initial sur « Garder », `destructive` nomme l'acte). `alert` de succès (`CircleCheck`) et d'échec `destructive` (`role="alert"`) ; la saisie est conservée sur échec. Libellés dans `messages/fr.json`. _Tests de composant : d, e, f, g, h, i, j, k ; un seul formulaire à la fois ; saisie conservée sur échec ; focus initial de la boîte ; aucun jeu sombre._
8. [x] **e2e (CI seulement).** `e2e/member-notes.spec.ts`, sur le modèle de `member-profiles.spec.ts` et `tenant-isolation.spec.ts` : (a) le bureau ajoute une note, recharge, la retrouve signée ; (b) échange : date future refusée, puis consigné, classé au jour choisi dans le fil mêlé ; (c) modification → « Modifiée le … », auteur inchangé ; suppression → disparue ; (d) **un compte `member` (Moreau)** n'accède ni à la fiche côté bureau ni à aucun texte de note dans son espace ; (e) **accès croisé entre deux tenants**, sous le rôle applicatif (lecture et insertion directes) : zéro ligne lue, insertion refusée par la RLS ; (f) le bureau de A ne peut pas ouvrir la fiche d'une association B (introuvable). _Échec attendu avant : tout._
9. [x] **Vérifications et cohérence.** `pnpm lint`, typecheck, `pnpm check:rules`, `pnpm format`, `pnpm test --run` complet. Contrôle qu'aucun fichier de présentation n'importe `src/db/*`, que le texte d'une note ne passe dans aucun `logger` ni message d'erreur, qu'aucun `'use cache'` n'enveloppe la lecture. Pas de `pnpm build` automatique. _Échec attendu : tout oubli de couche ou de lint._

## Files touched

- `src/db/models/member-note-model.ts` (+ index des modèles) ; migrations `drizzle/migrations/0041_*` et `0042_*` (RLS) générées, journal/snapshots par drizzle-kit ; `src/db/repositories/member-note-repository.ts`
- `src/services/member-note-service.ts` ; `src/services/rules/member-note-rules.ts` ; `src/services/validation/member-note-validation.ts` ; `src/services/types/domain/{member-note-types.ts, action-registry-types.ts}` ; `src/services/facades/member-note-service-facade.ts` ; `src/services/facades/interceptors/member-note-service-logger-interceptor.ts`
- `src/app/dal/member-note-dal.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/notes-actions.ts` ; `.../proprietaires/[id]/page.tsx`
- `src/components/features/member-profile/{member-notes-card.tsx, member-note-form.tsx, member-note-delete-dialog.tsx, member-profile-detail.tsx (montage seul)}`
- `messages/fr.json` (`BureauMemberProfilesPage`) ; `e2e/member-notes.spec.ts`
- Tests colocalisés : règles, validation, repository, service, registre, DAL, actions, composants, `page.test.tsx`
- `docs/decisions/050-notes-internes-une-table-a-fil-unique.md` (ADR, voyage avec la branche)

Ne sont **pas** touchés : `member_profile` et `toMemberProfileDto` (les notes ne s'y ajoutent **jamais** : DTO, service et DAL séparés), tout écran ou DAL côté espace membre, `src/proxy.ts`, `src/app/api/*`, `seed.ts`. Les fichiers non suivis étrangers (`docs/designs/*.zip`, dont `s22.zip`) ne sont pas commités.

## Test strategy

- **Unitaire (Vitest, DAO mockés)** : règles et validation pures, repository, service (dont le **test d'autorisation explicite du critère 4** : anonyme, `member`, `board` d'une autre association, imitation d'un membre simple), registre, DAL, actions, composants des états a à l. `pnpm test --run`.
- **e2e (Playwright, build de production, Postgres éphémère, sur GitHub)** : parcours complet, étanchéité côté membre, et **accès croisé entre deux tenants** (TechCorp `localhost`, Marketing Pro `127.0.0.1`). Un « zéro résultat » inexpliqué = premier soupçon d'un oubli de scope (`withTenant`).
- Non vérifié par la recherche, à **prouver** par un test à la tâche 4 : le comportement de `getAuthUser()` / `effectiveAuthor` sous une session « à la place d'un compte » (s48).
- Pièges à relire : `action-registry-authorization.test.ts` (épingle le registre), `member-role-authorization.test.ts` (modèle d'accès croisé), `member-profile-detail.test.tsx`.

## Risks / traps carried from research

- **Fuite par DTO élargi** : jamais de notes dans `MemberProfileDTO` ni dans une réponse partagée avec la présentation membre.
- Texte libre sur des personnes physiques : borné deux fois, rendu en texte, **jamais dans les journaux** (les intercepteurs loggent les arguments en debug : détails coupés).
- `author_*` copiés, jamais jointure ; `effectiveAuthor` lu **avant** `withTenant`.
- Aucun `'use cache'` sur cette lecture ; `<Suspense>` + stream ; rien au niveau supérieur d'un layout.
- La suppression d'une fiche portant des notes sera refusée (RESTRICT) ; aucune suppression de fiche n'existe aujourd'hui.
- **Suivi hors périmètre** : s38 et s39 déclarent `member_note` (export, complétude), s40 l'inclut dans la copie du membre ; les quatre écarts du design à verser à `docs/design-system.md` (marqueur « interne au bureau », ordre du plus récent au plus ancien contre §3.10, deux actions par entrée, `gap` de carte de 20 px) relèvent de `/ks-design-system`, **pas** de cette story.
- Jamais de `pnpm test` sans `--run` ; e2e jamais en local ; stager chemin par chemin (arbre partagé).

## Definition of Done

- Une PR, un commit de story (recherche, design, plan, ADR et revue inclus), description structurée, diff lisible.
- Les cinq critères couverts par un test, dont l'étanchéité côté membre (unitaire **et** e2e) et l'accès croisé entre deux tenants.
- `pnpm lint`, typecheck, `pnpm check:rules`, `pnpm test --run` verts ; e2e vert sur GitHub.
- Aucune valeur en dur hors constantes nommées ; libellés dans `messages/fr.json`.
- Revue passée (`Ship allowed: yes`), aucune alerte critique ouverte.
