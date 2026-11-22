# Review — Story s31-documents-partages

> Revue en contexte neuf (sous-agent `reviewer`), premier tour, 2026-11-22. Chaque point classé
> critical / major / minor.
> Diff revu : `git diff main...feature/s31-documents-partages` (un commit, 7332883f, 65 fichiers).

Aucun point critique ni majeur. Les exigences de sécurité tiennent dans le code et sont couvertes par les
specs e2e. Quatre mineurs, en fin de rapport.

## Plan compliance

- [x] The code does what the plan specifies, nothing more

Les 10 tâches du plan sont faites et cochées.

- **T1 — types et registre** : `shared-document-types.ts`, actions `SHARED_DOCUMENT_MANAGE` (owner, board) et
  `SHARED_DOCUMENT_READ` (owner, board, member), domaine `CategoryDomainConst.DOCUMENT`. Garde dans
  `content-file-types.test.ts` : `shared-documents` absent de `CONTENT_FILE_SCOPES`, clé refusée par
  `isContentFileKeyAllowed`.
- **T2 — modèle, migrations, inventaires** : `0075` générée ; `0076_shared_document_rls.sql` issue de
  `--custom`, RLS activée puis forcée, policy `tenant_isolation`. Journal et chaîne de snapshots cohérents
  (prevIds 0074 → 0075 → 0076 vérifiés). `FILE_KEY_COLUMNS` contient `shared_document.file_key`.
  `architecture.md` : 55 tables dont 36 scopées, ligne justifiée.
- **T3 — repository et domaine de catégorie** : `getDb()` seul ; domaine `document` branché dans
  `MANAGE_ACTION_OF_DOMAIN` et `USAGE_COUNTS_OF_DOMAIN`.
- **T4 — service, validation, façade** : présents, avec l'intercepteur de log (`shouldLogDetails: () => false`).
- **T5 — route** `GET /api/documents/[id]` : présente.
- **T6 — DAL et écrans du bureau** : trois pages, deux fichiers d'actions, paramètre `showRoutingEmail` de
  `ReportCategoriesManager`, entrée de la barre, libellés.
- **T7 — carte membre** : rendue dans les trois états de l'espace membre, derrière son `<Suspense>`.
- **T8 — seed** : trois catégories `document` pour TechCorp Solutions, une pour Marketing Pro.
- **T9 — e2e** : `shared-documents.spec.ts`, bloc RLS `shared_document` dans `tenant-isolation.spec.ts`, une
  ligne et un fichier par association dans la fixture de `backup-restore.spec.ts`.
- **T10 — documentation** : `design-system.md` §3.18 et ligne du manque 2 au §9. `docs/exploitation/README.md`
  n'énumère pas les colonnes de clé : rien à y changer.

Les fichiers en plus (`shared-document-paths.ts`, `shared-document-format.ts`,
`remove-shared-document-button.tsx`) sont dans le dossier `shared-document/**` prévu. Pas de dérive de
périmètre.

**Écarts déclarés par l'implémenteur — appréciation :**

- **`UnauthenticatedError`** : le plan autorisait « `UnauthenticatedError` ou équivalent existant » ;
  `src/services/errors/` n'en avait aucun, et aucune route existante ne rendait 401. Justifié.
- **Utilisateur e2e `admin@gmail.com` pour le critère 4** : membre de TechCorp et du bureau de Marketing Pro
  (seed vérifié). Meilleur choix : un simple membre de TechCorp sur le domaine de Marketing Pro serait arrêté
  en 403 par `canPerformAction` sans atteindre la lecture sous tenant ; avec ce compte, le 404 prouve bien le
  chemin `withTenant` + RLS. Justifié.
- **Deux assertions s46/s12 ajustées** : le test C5 du tableau de bord compte « un seul lien » hors de la carte
  des documents (le design la montre dans les trois états) ; la liste des libellés de la barre gagne
  « Documents ». Aucune n'affaiblit ce que le test d'origine protégeait. Justifié.
- **Actions de catégorie sans adresse de routage** : `routingEmail: ''` forcé après lecture du formulaire, à
  la création comme à la modification ; le service écrit `NULL` pour une adresse vide. Correct.

## Anti-hallucination

- [x] No invented API/function/import (each one opened and verified)
- [x] No plausible-but-wrong value or logic
- [x] The code matches what it claims to do

Imports et appels ouverts à leur cible :

- **Réponses PDF** (`src/app/api/campaigns/letter-pdf-response.ts`) : `emptyResponse`, `pdfAttachment`,
  `refusalResponseOf` existent ; en-têtes de base `Cache-Control: no-store` et `X-Content-Type-Options:
  nosniff` ; `AuthorizationError` → 403, `ValidationParsedZodError` → 404, le reste relancé.
- **Stockage** : `getContentFileStorage()` ; `StorageOperations` a `upload(file, path)`, `download(path)`,
  `delete(path)`.
- **Validation de fichier** : `validateContentFile` réexporte `validatePageBlockFile(kind, content)` ; nature
  `document` = PDF seul par signature binaire, 10 Mio ; ses `reason` (`'size'`, `'format'`) correspondent à ce
  que le service traduit.
- **Autorisation** : `canPerformAction(user, organizationId, actionId)` — SuperAdmin vrai, sinon appartenance
  + registre.
- **Catégories** : `listActiveCategoriesDao(organizationId, domain)` filtre sur l'association et
  `activeInDomain` ; `PublicCategoryDTO`, `AssociationCategoryListDTO` existent.
- **Tenant** : `getCurrentTenantDal` (en-tête `Host`) et `requireCurrentTenantDal` existent.
- **Log** : `createServiceInterceptor` accepte `shouldLogDetails`.
- **Interface** : `formatFileWeight`, `calendarDayOf`, `isoToFrenchDate`, `BureauAccessDenied`, props de
  `FileUpload` (`maxSize`, `isUploading`, `onChange(files)`), `Progress`, token `destructive-text` de
  `globals.css`.
- **Taille d'envoi** : `serverActions.bodySizeLimit: '16mb'` et `proxyClientMaxBodySize: '16mb'` — un PDF de
  10 Mo atteint l'action serveur.
- **Traductions** : les clés de `BureauDocumentCategoriesPage` reprennent celles de
  `BureauQuestionCategoriesPage`, moins `intro` et `introWithoutContact`, lues seulement par la page des sujets.
  `MemberSpacePage.documents` et le libellé `sharedDocuments` de la barre existent.
- **Compte du seed** : appartenances de `admin@gmail.com` vérifiées dans `seed.ts`.

**Points d'attention :**

- **Aucune URL publique ni devinable** : tous les liens sont `/api/documents/{id}`
  (`sharedDocumentDownloadPathOf`) ; ni `SharedDocumentDTO` ni `BureauSharedDocumentDTO` ne porte `fileKey` ;
  `shared-documents` n'est pas une portée, `/api/files` refuse la clé (garde unitaire et e2e) ; toutes les
  réponses de la route portent `no-store` et `nosniff`.
- **La route** : tenant du domaine appelé, 404 sans tenant ; le service valide les deux identifiants (uuid),
  exige une session (`UnauthenticatedError` → 401), puis `shared.document.read` dans cette association (403),
  puis lit la ligne sous `withTenant` (`NotFoundError` → 404). La clé vient de la base, jamais de la requête.
  Un document retiré n'a plus de ligne : 404, rien en cache.
- **RLS** : migration activée et forcée, même forme que `0025` ; `getDb()` seul ; aucun accès direct à `db.`,
  aucun nouveau `withRlsBypass()`. L'e2e croisé a trois cas : rien hors scope, seules les lignes de A dans le
  scope de A, écriture pour B refusée.
- **Ordre des écritures (ADR 004, ADR 069 §7)** : dépôt = safeParse → autorisation → titre, catégorie et PDF
  contrôlés avant toute écriture → id serveur → fichier écrit → ligne insérée, fichier effacé si l'insertion
  échoue. Retrait = ligne puis fichier, orphelin journalisé en cas d'échec disque. Les deux ordres sont
  épinglés par des tests unitaires.
- **Catégorie** : active, du domaine `document` et de cette association, lue sous `withTenant` ; sinon
  `CATEGORY_UNAVAILABLE`.
- **Rien en dur (ADR 010)** : les trois catégories sont des lignes de `TEST_TENANT_CATEGORIES`, pas des
  constantes.

## Rules compliance

- [x] Repo conventions followed (AGENTS.md)
- [x] No accepted ADR contradicted (docs/decisions/)
- [x] Design system respected — components/tokens from docs/design-system.md, screen matches the intent of docs/designs/s31-documents-partages.md (UI stories)

**Conventions et ADR** : couches respectées (page → DAL → façade → service → repository) ; mutations par
actions serveur avec `requireActionAuth` et `getTranslations`, `redirect` hors du `try` ; pas de
`'use cache'` dans la DAL (données sous session) ; carte membre derrière son `<Suspense>`, promesse jamais
attendue dans la page. Cohérent avec les ADR 002, 003, 004, 010, 018, 023, 028, 034, 045 et 069. Lint des
fichiers modifiés : sortie 0. `tsc --noEmit` : seul `.next/types/validator.ts` (absence de `./routes.js` après
suppression de `routes.d.ts`) ; aucune erreur dans les sources.

**Design system** : composants du système seuls (card, table et cartes empilées sous 640 px, boutons
outline / default / destructive, `alert-dialog`, `alert`, `select`, `input`, `file-upload`, `progress`
indéterminée, `skeleton`, fil d'Ariane, icônes du vocabulaire figé). Tailles (17/15/14/34 px,
`font-mono tabular-nums`) et largeur `sm:min-w-65` déjà présentes ailleurs. Aucune couleur ni token hors
système. Intention de l'écran tenue : carte membre groupée par catégorie, ordre alphabétique, plus récents
d'abord, une action de téléchargement par ligne, lien Contact en pied, présente dans les trois états ; liste
du bureau plus récente d'abord, titre en lien de téléchargement, seule action « Retirer » confirmée par
`alert-dialog` ; page de dépôt avec résumé d'erreurs, état « aucune catégorie » et état « dépôt en cours » ;
écran des catégories sans adresse de routage (manque 1, résolu par paramètre, sans nouveau composant).

## Tests

- [x] Test suite run by the reviewer, passing (after isolating timeouts, see below)
- [x] Assertions pin the acceptance criteria (no assertion-free tests)

**Suite complète sur `/workspace`** (`pnpm test --run`) : 439 fichiers dont 433 verts ; 5971 tests verts,
12 en échec, 1 ignoré. **Les 12 échecs sont des timeouts de worker** (11 à 5000 ms, 1 à 15000 ms), aucune
assertion. Fichiers : `fonts.test.ts`, `association-settings-form.test.tsx`, `campaign-composer.test.tsx`,
`shared-document-form.test.tsx` (3d), `impersonation.real-auth.test.ts`,
`magic-link-integration-imports.test.ts`.

**Relance sur une copie de HEAD en disque local** (`node_modules` en lien symbolique) : `fonts.test.ts`,
`shared-document-form.test.tsx` et `magic-link-integration-imports.test.ts` passent au délai par défaut. Les
trois autres échouent encore sous la charge combinée, sur un ensemble de tests différent à chaque fois ;
lancés un par un avec `--testTimeout=30000`, tous passent : 39/39, 46/46, 17/17. Aucun de ces trois fichiers
n'est touché par le diff.

Pas de régression : le seul échec dans un fichier de la story était un timeout du montage 9p, vert en disque
local.

**e2e** : `pnpm exec playwright test --list` charge les 6 tests de `shared-documents.spec.ts` et les 3 tests
s31 de `tenant-isolation.spec.ts`, pour chromium, firefox et webkit. Non exécutés (CI seulement).

**Qualité des assertions** : tests du service par rôle (super_admin, owner, board, member, owner d'une autre
association, sans session) et pour chaque refus (titre vide ou trop long, catégorie absente ou indisponible,
fichier absent ou vide, non-PDF, plus de 10 Mo), chacun sans envoi ni insertion ; ordre des écritures par un
tableau `order` qui inclut le scope de tenant ; effacement du fichier si l'insertion échoue, pas d'insertion si
l'envoi échoue ; ordre du retrait et journal de l'orphelin ; absence de la clé dans le résultat. Tests de route :
chaque statut, corps vide, en-têtes, paramètres `?key=…&org=…` ignorés. Tests de composants : aucun `href`
contenant `shared-documents/` ou `/api/files`. e2e : téléchargement à l'octet près, 401 sans session, 404 d'un
domaine à l'autre, 404 pour la clé sous `/api/files`, 404 après retrait.

## Regressions

- [x] No impact on existing code paths

- `ReportCategoriesManager` : `showRoutingEmail` vaut `true` par défaut, écrans des signalements et des sujets
  inchangés ; le cas masqué est testé.
- Service des catégories : un domaine ajouté à `CATEGORY_DOMAINS` ne change aucun domaine existant.
- Espace membre : une prop nouvelle ; tests existants adaptés, pas assouplis.
- Barre du bureau : une entrée nouvelle.
- `/api/files` : inchangée, refuse toujours les clés hors portées enregistrées.

## Findings

- minor — `e2e/tenant-isolation.spec.ts` (bloc s31) — insère des lignes `shared_document` dont la `file_key`
  (`{org}/shared-documents/rls/file.pdf`) ne désigne aucun fichier sur disque, premier bloc de la spec à le
  faire. `backup-restore.spec.ts` vérifie que toute clé inventoriée a son fichier restauré : avec
  `fullyParallel: true` et plusieurs workers en local, les deux specs peuvent se chevaucher et ce contrôle
  échouer par intermittence. La CI tourne avec `workers: 1` : non affectée. Écrire un vrai fichier, ou utiliser
  une famille de clés que la restauration ignore.
- minor — `messages/fr.json` (`BureauSharedDocumentsPage.tableTitle`, « Documents partagés ») — clé lue par
  aucun code.
- minor — `src/components/features/shared-document/shared-document-form-validation.ts` (`fileIssueOf`) — le
  contrôle côté navigateur refuse tout fichier dont `file.type` n'est pas exactement `application/pdf` : un vrai
  PDF annoncé par le navigateur avec un type vide ou différent est bloqué avant le contrôle par signature du
  serveur, qui est celui qui tranche. Ergonomie seulement, pas sécurité.
- minor — `src/app/api/documents/[id]/route.ts` importe ses helpers de réponse de
  `../../campaigns/letter-pdf-response`, module dont le commentaire est propre à s28. Le plan autorisait le
  réemploi « ou déplacement neutre » ; le réemploi fonctionne, mais un module des campagnes définit désormais
  les réponses d'un second domaine. À déplacer vers un emplacement neutre quand s32 ou s34 reprendront la forme
  de la route.

## Verdict

Max severity: minor
Ship allowed: yes
