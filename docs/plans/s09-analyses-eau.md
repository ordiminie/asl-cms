---
validated: yes
---

# Plan — Story s09-analyses-eau

Branch: `feature/s09-analyses-eau`, à créer depuis un `main` à jour (au moment de l'écriture :
`03277fe`).

> **Sources** :
>
> - story : `docs/stories.md` (s09, l. 860-893) ;
> - recherche : `docs/research/s09-analyses-eau.md` ;
> - design validé : `docs/designs/s09-analyses-eau.md`, maquette `docs/designs/s09-analyses-eau.html` ;
> - design system : `docs/design-system.md` §1.9 (token `--overlay`), §3.9 (champ date, compteur de
>   caractères, image de contenu), §4 (rendu public), §9 (gap « analyses d'eau » clos) ;
> - architecture : `docs/architecture.md` (chaîne de fichiers de contenu, **enveloppe de requête à
>   16 Mo**, classement RLS) ;
> - décisions : **ADR 023** (chaîne de fichiers de contenu partagée), ADR 002/003 (RLS), ADR 007
>   (modèles à champs fixes), ADR 010/016 (rien en dur), ADR 018 (registre d'actions), ADR 020
>   (segments racines réservés), et **ADR 026** écrit par ce plan.

**État du code vérifié le 2026-09-24** : s05 est livrée et mergée. `content-file-types.ts`,
`content-file-service.ts`, `/api/files/[...key]` et `createContentFileGET(scopes)` **existent** —
s09 déclare sa portée et ses colonnes de clé, elle **n'écrit ni validation de clé, ni route de
lecture** (ADR 023). Dernière migration : `0017_news_rls.sql`. Le modèle `news`
(`src/db/models/news-model.ts`), son repository, son service, sa façade, son DAL et ses écrans sont
le gabarit de référence de ce plan.

## Target story

**En tant que** membre du bureau **je veux** publier rapidement un résultat d'analyse d'eau **afin
que** tout visiteur puisse le consulter sans compte. Complexité 2, dépend de s04 (livrée).

1. Publier une analyse (date, affiche, texte facultatif, PDF) la fait apparaître en tête de la page
   publique des analyses.
2. Le PDF se télécharge depuis la page publique sans authentification.
3. Le texte est facultatif : une publication sans texte affiche la date, l'affiche et le lien du PDF,
   sans bloc vide ni libellé orphelin.
4. Le formulaire ne demande que les quatre champs et publie en **une seule soumission**, sans étape
   intermédiaire.
5. Les analyses sont listées par date décroissante et une analyse ne fuit pas vers une autre
   association.

## Décisions tranchées pour ce plan

**Déjà rendues avant le plan** (design validé, à ne pas rouvrir) : publication directe sans
brouillon, correction possible, suppression avec confirmation ; quatre champs stricts ; texte
alternatif **dérivé de la date** ; date de prélèvement pré-remplie à aujourd'hui, date future
refusée, texte brut de 500 caractères au plus ; page publique `/analyses-eau`, 10 analyses par page,
PDF en **téléchargement**, libellé dérivé de la date, poids annoncé ; champ date au clavier seul,
sans calendrier déroulant (§3.9) ; tâches de code héritées du design system (`--overlay`, filet de la
boîte en sombre).

Ce que **ce plan** tranche, avec sa raison :

- **Modèle `water_analysis`**, table métier à champs fixes (`docs/architecture.md` l. 200, ADR 007) :
  `organization_id`, `sampled_on` (`date`, sans heure ni fuseau), `poster_key`, `report_key`,
  `report_bytes`, `content`, `created_at`, `updated_at`. **Pas de colonne `status`** : la publication
  est directe (critère 4), un statut serait un état que rien ne fait changer. **Pas de colonne
  `image_alt`** : l'`alt` est dérivé de `sampled_on` au rendu, donc corriger la date corrige l'`alt`
  du même coup. Voir **ADR 026**.
- **Poids stocké : `report_bytes` seulement.** C'est le seul poids affiché (tableau du bureau et lien
  public). Le poids de l'affiche n'apparaît que pour un fichier **choisi dans le navigateur**, où le
  `File` le porte déjà : une colonne de plus serait morte.
- **Tri** : `sampled_on desc, created_at desc, id desc` — départage stable, comme `news` (ADR 023),
  pour qu'une pagination ne saute ni ne répète une ligne. Deux prélèvements du même jour restent
  possibles.
- **Une seule soumission, deux fichiers et une ligne** (ADR 026) : les fichiers voyagent **dans la
  même requête** que les champs, l'identifiant de la ligne est **généré par le serveur avant
  l'insertion** (il entre dans la clé de stockage), les deux fichiers sont écrits **puis** la ligne
  est insérée ; si l'insertion échoue, les fichiers tout juste écrits sont supprimés (patron
  `association-identity-service.ts`, s01b). C'est l'écart assumé au dépôt immédiat de s04 et s05,
  que le critère 4 interdit.
- **Enveloppe de requête : 16 Mo**, appliquant la décision du 23/09/2026 de `docs/architecture.md`.
  `experimental.serverActions.bodySizeLimit: '16mb'` **et** `experimental.proxyClientMaxBodySize:
'16mb'` — la seconde est indispensable : le proxy tamponne le corps en mémoire et, au-delà de
  **10 Mo par défaut**, le **tronque** avec un simple avertissement
  (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md`),
  ce qui donnerait un fichier corrompu plutôt qu'un refus. Les routes `/bureau` passent par
  `src/proxy.ts`.
- **Plafonds affichés : « PNG, JPEG ou WebP, 5 Mo au plus. » et « PDF, 10 Mo au plus. »** Ce sont
  `CONTENT_FILE_MAX_BYTES` (image 5 Mo, document 10 Mo), c'est-à-dire les plafonds **réellement
  appliqués** — la règle de `docs/architecture.md` : « le plafond écrit sous un champ de dépôt est
  toujours celui réellement appliqué, jamais l'enveloppe ». Le « 2 Mo au plus » de la maquette était
  provisoire et disparaît. Un plafond propre à s09, plus bas, est écarté : il divergerait en silence
  de la chaîne partagée.
- **L'`alt` est fabriqué par la date enregistrée**, jamais par la date saisie : il est calculé au
  rendu à partir de `sampled_on` (donc d'une valeur déjà validée). La ligne « Description pour les
  lecteurs d'écran » du formulaire suit la date saisie — c'est un aperçu, il n'est pas persisté.
- **Un fichier remplacé disparaît après le succès de l'enregistrement**, jamais avant : nouvelle
  clé écrite → ligne mise à jour → ancien fichier supprimé, un échec de suppression ne laissant
  qu'un orphelin journalisé (`deletePreviousIdentityFile`, s01b). À la suppression d'une analyse :
  la ligne d'abord, les deux fichiers ensuite, même tolérance. Système de fichiers et base ne
  partagent pas de transaction : la compensation est la seule garantie possible, et elle est
  ordonnée pour ne **jamais** laisser une ligne pointer vers un fichier absent.
- **Ordre des éléments de la page publique : un seul DOM, réordonné en CSS.** L'ordre du document est
  celui du bureau de lecture (titre → affiche → texte → lien), et sous 640 px `order` remonte le lien
  au-dessus de l'affiche. Raison : deux rendus dupliqueraient le lien de téléchargement pour un
  lecteur d'écran (ou demanderaient un `aria-hidden` sur l'un des deux) ; chaque élément de liste ne
  contient **qu'un seul élément focalisable**, donc le réordonnancement ne désordonne aucun parcours
  au clavier, et il reste confiné à l'intérieur du `<li>` (chacun est son propre conteneur flex).
- **`analyses-eau` entre dans `RESERVED_PAGE_SLUGS`** (`page-block-types.ts:89`) **dans le même
  commit** que la route (ADR 020). Vérifié : aucune page du seed ni des e2e ne porte ce slug.
- **Registre d'actions** : une entrée unique `WATER_ANALYSIS_MANAGE = 'water.analysis.manage'`,
  `defaultRoles: ['owner', 'board']`, sur le précédent de `PAGE_MANAGE` et `NEWS_MANAGE` — publier,
  corriger et supprimer ne se distinguent dans aucun critère.
- **Portée de fichier `water-analysis`** ajoutée à `ContentFileScopeConst` et
  `CONTENT_FILE_SCOPES` ; emplacements (`slotId`) `poster` et `report`. Clé
  `{org}/water-analysis/{analysisId}/{poster|report}-{uuid}.{ext}`. `/api/files` la sert du seul fait
  de l'enregistrement ; `/api/pages/files` reste borné à `pages` et **n'est pas touché**.
- **Date future refusée côté serveur**, par une fonction pure qui reçoit le jour courant : la Server
  Action lit l'horloge (jour calendaire **Europe/Paris**, patron `counterDayOf` de
  `rate-limit-service.ts`) et le passe au service, qui reste sans horloge donc testable. Le
  formulaire refuse aussi côté client, mais c'est le serveur qui décide. Message : « La date du
  prélèvement ne peut pas être dans le futur. »
- **Pagination** : constantes d'affichage (ADR 023 §4), `WATER_ANALYSIS_PUBLIC_PAGE_SIZE = 10` et
  `WATER_ANALYSIS_BUREAU_PAGE_SIZE = 25`, pas des paramètres d'association. Les « 10 cartes en
  mobile » annoncées par la maquette ne sont pas implémentables côté serveur (le viewport est inconnu
  au rendu) : comme s05, une seule taille de page, la bascule tableau → cartes reste purement CSS.
- **Sidebar : « Analyses d'eau » entre « Actualités » et « Navigation », sans icône.** La barre
  n'affiche aucune icône aujourd'hui et s05 n'en a pas posé ; en poser une sur la seule entrée de s09
  créerait une incohérence visible. Le gap 8 du design reste ouvert, à combler par une story qui
  traite les sept entrées d'un coup.
- **Le texte facultatif est du texte brut**, pas du markdown : aucun passage par la chaîne sanitisée,
  aucun rendu HTML, `whitespace-pre-line` pour garder les retours à la ligne. Le bloc est **omis**
  quand le texte est vide (critère 3).
- **`formatNewsDate` est renommé** en `src/lib/cms/format-content-date.ts` /
  `formatContentDate` (fonction pure, UTC, utilisable dans un scope `'use cache'`), et ses **deux**
  appelants de s05 sont mis à jour. Raison : la date en clair est désormais partagée par deux modèles
  de contenu ; en dupliquer une seconde copie serait la première divergence de formatage. Si une
  branche parallèle l'a déjà déplacée, adopter la sienne.
- **L'affiche est stockée telle qu'elle est déposée**, sans redimensionnement. Le design system §3.9
  exige le ratio d'origine et une affiche « lisible entière », et l'ADR 024 (s06, **non mergé**)
  n'est pas une dépendance de cette story. Voir « Points à surveiller » — c'est le seul compromis de
  performance du plan.
- **`--overlay` entre dans `globals.css` avec s09** (§1.9), et remplace le `bg-black/50` écrit en dur
  dans `alert-dialog.tsx` **et** `dialog.tsx` : c'est le même voile, en une ligne chacun, et laisser
  deux voiles différents dans le produit serait le vrai défaut. La boîte garde son filet
  `border` en sombre (`--card` et `--background` sombres sont identiques).
- **Hors périmètre** : page dédiée par analyse, brouillon, aperçu, dépublication, historique,
  filtres, recherche, plusieurs points de prélèvement, pastille conforme/non conforme, entrée de
  menu vers `/analyses-eau` (le menu de s04b ne pointe que vers des pages CMS), feuille d'impression,
  email (s25), SEO (s11), bandeau d'alerte (s07).

## Tasks (ordered)

1. [x] **Socle : modèle, RLS, portée de fichier, action, slug réservé, enveloppe de requête.**
   - `src/db/models/water-analysis-model.ts` : table `water_analysis` avec les colonnes ci-dessus,
     `organization_id` en `references(() => organization.id, {onDelete: 'cascade'})`, index
     `(organization_id, sampled_on)`. Enregistrée dans le `schema` de `src/db/models/db.ts`.
   - Migration par `pnpm db:generate`, **puis** policy par `drizzle-kit generate --custom` sur le
     patron `0017_news_rls.sql` : `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `tenant_isolation`
     portant directement sur `organization_id`. Jamais de SQL ni de journal écrits à la main.
   - `ContentFileScopeConst.WATER_ANALYSIS = 'water-analysis'` et son entrée dans
     `CONTENT_FILE_SCOPES` (`src/services/types/domain/content-file-types.ts`).
   - `ActionIdConst.WATER_ANALYSIS_MANAGE` et son entrée dans `ACTION_REGISTRY`.
   - `'analyses-eau'` ajouté à `RESERVED_PAGE_SLUGS`.
   - `next.config.ts` : `serverActions.bodySizeLimit: '16mb'` et `proxyClientMaxBodySize: '16mb'`,
     avec le commentaire qui dit **pourquoi** (affiche 5 Mo + PDF 10 Mo dans la même soumission, et
     troncature silencieuse du proxy au-delà de 10 Mo).
   - **Tests** : `water.analysis.manage` autorise `owner` et `board`, refuse `member` et un rôle
     inconnu ; `isPageSlugReserved('analyses-eau')` est vrai ; une clé de portée `water-analysis`
     est construite puis acceptée par `isContentFileKeyAllowed`, et refusée si elle vient d'une autre
     association, remonte (`..`), porte un segment vide ou une extension inconnue ; les clés `pages`
     et `news` existantes restent acceptées ; `pnpm db:generate` ne produit plus de diff.

2. [x] **Types de domaine et fonctions pures** — `src/services/types/domain/water-analysis-types.ts`.
   - `WaterAnalysisDTO`, `WaterAnalysisListPageDTO`, résultats de mutation
     (`{status:'published'|'saved'|'deleted', …}` / `{status:'rejected', issues}`), codes de refus
     (`future_date`, `content_too_long`, `poster_format`, `poster_size`, `report_format`,
     `report_size`, `missing_poster`, `missing_report`).
   - `WATER_ANALYSIS_PUBLIC_PAGE_SIZE = 10`, `WATER_ANALYSIS_BUREAU_PAGE_SIZE = 25`,
     `countWaterAnalysisPages(total, size)` (une liste vide a quand même sa page 1).
   - `isWaterAnalysisFileKeyAllowed(organizationId, analysisId, key)` sur le patron de
     `isNewsImageKeyAllowed`, borné à la portée `water-analysis`.
   - `formatFileWeight(bytes)` → « 320 Ko », « 4,2 Mo » (`Intl.NumberFormat('fr-FR')`, sans horloge).
   - `waterAnalysisDownloadName(sampledOn)` → `analyse-eau-2026-09-02.pdf`.
   - `isSampledOnInFuture(sampledOn, today)` — **fonction pure**, le jour courant est un argument.
   - `src/lib/cms/format-content-date.ts` : `formatContentDate` (ancien `formatNewsDate`), avec la
     mise à jour des deux appelants de s05.
   - **Tests** (purs, jsdom non requis) : poids aux bornes (999 octets, 1 023 Ko, 1 Mo pile, 4,25 Mo),
     nom de téléchargement, date future / date du jour acceptée / date passée, clé d'une autre
     analyse refusée, comptes de pages (0, 10, 11).

3. [x] **Validation, repository, service, façade** (la couche qui porte le critère 5).
   - `src/services/validation/water-analysis-validation.ts` : `sampledOn` en ISO `YYYY-MM-DD`
     **existant** (patron `newsDateSchema`), `content` ≤ 500 après `trim`, identifiants UUID, numéro
     de page entier ≥ 1.
   - `src/db/repositories/water-analysis-repository.ts`, toujours par `getDb()` : `createDao` (avec
     `id` fourni), `getByIdDao`, `updateDao`, `deleteDao`, `getPageByOrganizationDao` (bureau),
     `getPublishedPageDao` — ici identique, toutes les analyses étant en ligne —, `countDao`, dans
     l'ordre `sampled_on desc, created_at desc, id desc`.
   - `src/services/water-analysis-service.ts`, toujours dans l'ordre `safeParse` →
     `canPerformAction(WATER_ANALYSIS_MANAGE)` → `withTenant` :
     - `publishWaterAnalysisService({organizationId, sampledOn, content, poster, report, today})` :
       refus de date future ; validation des **deux** fichiers par signature binaire
       (`validateContentFile('image' | 'document', …)`) **avant toute écriture** ; `id` généré par le
       serveur ; écriture affiche, écriture PDF, insertion ; **suppression des deux fichiers si
       l'insertion échoue** ;
     - `updateWaterAnalysisService(…)` : mêmes contrôles ; un fichier absent de la soumission laisse
       la clé en place ; un fichier remplacé est écrit, la ligne mise à jour, **puis** l'ancien
       supprimé, un échec de suppression étant seulement journalisé ;
     - `deleteWaterAnalysisService({organizationId, analysisId})` : ligne d'abord, fichiers ensuite ;
     - `getWaterAnalysesForBureauService`, `getWaterAnalysisForBureauService`,
       `getPublicWaterAnalysesPageService` et `getPublicWaterAnalysisPageCountService` — ces deux
       dernières **sans contrôle d'autorisation, et c'est délibéré** (commentaire explicite, comme
       `getPublishedNewsPageService`) ;
     - `canManageWaterAnalysisService` pour l'affichage.
   - Façade `src/services/facades/water-analysis-service-facade.ts` + intercepteur de journalisation
     (`shouldLogDetails: () => false`), sur le patron des actualités.
   - **Tests** `src/services/__tests__/water-analysis-service.test.ts`, repository et stockage
     mockés :
     - `[ORGANIZATION OWNER]` et `[ORGANIZATION ADMIN]` (board) publient, corrigent et suppriment ;
       `[ORGANIZATION MEMBER]`, `[USER NOT IN ORGANIZATION]` et `[PUBLIC]` reçoivent une
       `AuthorizationError` **sans qu'aucun DAO ni aucune écriture de fichier ne soit appelé** ;
     - un fichier refusé (signature, poids) **n'écrit rien du tout**, pas même l'autre fichier ;
     - insertion en échec → `storage.delete` appelé pour **les deux** clés, erreur propagée ;
     - remplacement réussi → ancien fichier supprimé, et la suppression en échec ne fait pas échouer
       l'enregistrement ;
     - date future refusée, date du jour acceptée (`today` injecté, aucun appel d'horloge dans le
       service) ;
     - texte à 501 caractères refusé, à 500 accepté, vide accepté ;
     - les listes appellent bien `withTenant` avec l'identifiant de l'association.

4. [x] **DAL** — `src/app/dal/water-analysis-dal.ts`.
   - `waterAnalysisListTag(organizationId)` = `water-analysis:{org}`.
   - Lectures publiques **internes** en `'use cache'` + `cacheLife('hours')` + `cacheTag` : la page
     de liste par `(org, page)` et le **nombre de pages** par `(org)` — le compte borne le numéro
     demandé avant de toucher la lecture cachée par page (patron `news-dal.ts`). Aucun `logger`,
     aucune horloge, aucune lecture de requête dans ces scopes.
   - Lectures du bureau non cachées, `canManageCurrentWaterAnalysisDal`, `waterAnalysisFileUrl(key)`
     = `contentFileUrl(key)`.
   - **Tests** : le DAL public rend bien ce que le service rend (façade mockée) ; le nombre de pages
     vaut 1 sur une liste vide ; le tag est celui attendu.

5. [x] **Champ date masqué** — `src/components/ui/date-field.tsx`, première mise en œuvre de §3.9.
   - `input` texte, `inputmode="numeric"`, masque `jj/mm/aaaa` **inséré à la frappe**, JetBrains Mono
     500 (17 px, 18 px sous 1 024 px), hauteur 48 px (56 px sous 1 024 px), icône `Calendar` 20 px
     **décorative** (`aria-hidden`, jamais un bouton), quatre états (vide avec placeholder,
     pré-rempli, en saisie `--ring` + halo 2 px, erreur bordure 2 px + message). **Aucun calendrier
     déroulant.**
   - Conversion `jj/mm/aaaa` ↔ ISO `YYYY-MM-DD` par des fonctions pures exportées.
   - **Tests** (jsdom) : les barres s'insèrent à la frappe et ne se doublent pas au collage ; une
     saisie partielle ne rend pas de valeur ISO ; `31/02/2026` est refusé ; la suppression arrière
     retraverse une barre ; l'icône n'est pas focalisable ; l'erreur est reliée au champ
     (`aria-describedby`, `aria-invalid`).
   - Note : s05 a livré un `input type="date"` natif ; **rien n'y est rouvert** (§3.9, gap 2 du design
     de s05). Si la branche de s07 ou s08 introduit le même composant, le premier mergé fait foi.

6. [x] **Bureau : liste, publication, correction, suppression.**
   - Routes `src/app/[locale]/(bureau)/bureau/analyses-eau/page.tsx`, `…/nouvelle/page.tsx`,
     `…/[id]/page.tsx`, derrière `<Suspense>`, contrôle d'accès **répété** sur chacune
     (`BureauAccessDenied`), `generateMetadata`.
   - `…/analyses-eau/actions.ts` (actions partagées par le groupe de routes) :
     `publishWaterAnalysisAction`, `updateWaterAnalysisAction`, `deleteWaterAnalysisAction`, chacune
     `requireActionAuth()` puis `updateTag(waterAnalysisListTag(tenant.id))` **après** le succès, et
     `redirect()` **hors du `try`** (un `redirect()` lève `NEXT_REDIRECT`, qu'un `catch` avalerait).
     Les fichiers arrivent dans le **même** `FormData` que les champs.
   - Composants `src/components/features/water-analysis/` :
     - `water-analysis-list.tsx` : `card` + `table` (Date du prélèvement en `font-mono`
       `tabular-nums`, vignette 44 px, **poids du PDF seul, jamais le nom du fichier**, un seul lien
       « Modifier »), bascule en cartes sous 640 px, pagination « Précédent / Suivant » écrite et
       **désactivée annoncée**, état vide « Aucune analyse publiée pour l'instant. → Publier la
       première », `alert` de succès ancré `role="status"` après une publication, une correction ou
       une suppression ;
     - `water-analysis-form.tsx` : les **quatre** champs et rien d'autre, `DateField` pré-rempli à
       aujourd'hui, deux zones de dépôt (`file-upload` + bouton `accept`, consignes de format et de
       poids **écrites avant tout échec**), compteur « 0 / 500 » selon §3.9 (neutre jusqu'à 500
       inclus, puis `--destructive-text`, 600, bordure 2 px **et** message écrit), ligne
       « Description pour les lecteurs d'écran : … » sous l'affiche, `progress` indéterminée portant
       les noms de fichier pendant la soumission, bouton unique dont le libellé change et **la
       largeur est conservée**, résumé d'erreurs ancré `role="alert"` avec **une ancre par champ
       fautif** (l'écart 6 de la maquette n'est pas reproduit) ;
     - sur l'écran de correction : `alert` « Cette analyse est en ligne… », « Remplacer … » et
       **jamais « Retirer »**, puis « Supprimer l'analyse » isolé par un `separator` et 48 px, avec
       son `alert-dialog` (« Cette action est définitive. », bouton `destructive` qui nomme l'acte).
   - État de soumission par `useActionState` et état React local, **comme l'éditeur d'actualités
     livré** — pas React Hook Form : c'est le patron réellement en place pour ces écrans à fichiers.
     Le client revalide format, poids, date et longueur avant l'envoi ; le serveur revalide tout.
   - `--overlay` posé dans `:root` et `.dark` de `src/app/globals.css`, mappé en `--color-overlay`
     dans `@theme inline`, consommé par `alert-dialog.tsx` et `dialog.tsx` à la place de
     `bg-black/50` ; le filet `border` de la boîte est conservé.
   - « Analyses d'eau » dans `NAV_GROUPS` (`bureau-sidebar.tsx`), groupe `siteGroup`, entre
     « Actualités » et « Navigation », **sans icône**.
   - Libellés : `BureauWaterAnalysisPage` et `BureauIdentityPage.nav.waterAnalysis` dans
     `messages/fr.json`, `en.json` **et** `es.json` ; les deux espaces de noms ajoutés aux listes de
     `src/services/__tests__/page-i18n.test.ts`.
   - **Tests** (jsdom) : la liste rend l'état vide avec son lien, le poids et jamais le nom du
     fichier, un seul lien « Modifier » par ligne, la pagination désactivée **annoncée** ; le
     formulaire n'affiche **que quatre champs** (assertion explicite du critère 4) et **aucun champ de
     texte alternatif** ; le compteur ne vire au rouge qu'au-delà de 500 et affiche alors son message ;
     l'erreur de date future s'affiche sous le champ **et** dans le résumé ancré ; le dialogue de
     suppression nomme la date ; actions : `updateTag` appelé après succès, **pas** après un refus
     (façade mockée, patron `bureau/navigation/actions.test.ts`).

7. [x] **Site public : `/analyses-eau`.**
   - `src/app/[locale]/(public)/analyses-eau/page.tsx` : sous `(public)/`, donc **jamais derrière
     l'authentification** ; tenant du domaine appelé ; `h1` « Analyses d'eau » sans chapeau ; liste
     `max-w-[68ch]`, éléments séparés par un filet et 48 px.
   - Par analyse : `h2` « Prélèvement du 2 septembre 2026 » ; `<figure>` sans `figcaption`, largeur
     de la colonne, **ratio d'origine, hauteur plafonnée à 520 px, contenue et centrée sur un bandeau
     `muted` au-delà, jamais rognée** (§3.9), `loading="lazy"`, `alt` dérivé de la date ; texte brut
     **seulement s'il existe** (critère 3) ; lien `outline` avec `FileText`, attribut `download`
     valant `analyse-eau-AAAA-MM-JJ.pdf`, libellé « Résultat complet du 2 septembre 2026 (PDF,
     320 Ko) » et mention « Télécharger » en `sr-only`. **Aucun bouton `default` sur la page.**
   - Un seul DOM, réordonné en CSS sous 640 px (lien au-dessus de l'affiche), gouttière 18 px,
     affiche pleine largeur sans marge en mobile.
   - Pagination bornée par le compte **avant** la lecture de liste, `notFound()` hors bornes sauf la
     page 1 d'une liste vide, qui rend « Aucune analyse d'eau publiée pour l'instant. » sans action.
   - `generateMetadata` donne le titre ; libellés sous `PublicWaterAnalysisPage` (fr, en, es).
   - **Tests** (jsdom, DAL mocké) : l'ordre rendu est l'ordre reçu ; **aucun bloc ni libellé orphelin
     quand le texte est vide** (critère 3) ; le lien porte `download`, le poids et le nom de fichier
     attendus ; l'`alt` vient de la date enregistrée ; `notFound()` hors bornes ; la page 1 vide
     rend l'état vide.

8. [x] **Preuve e2e** — `e2e/water-analysis.spec.ts`, sur le patron de `e2e/news.spec.ts` (tenant A =
       `localhost` / TechCorp, tenant B = `127.0.0.1` / Marketing Pro, comptes `user-owner@gmail.com`,
       `user@gmail.com`, `user-admin@gmail.com`).
   - La Présidente A publie une analyse (date, affiche PNG, texte, PDF) **en une seule soumission** :
     elle paraît **en tête** de `/analyses-eau` (critères 1 et 4).
   - Le PDF se télécharge **sans session** depuis un contexte anonyme, avec le bon `Content-Type`
     (critère 2).
   - Une analyse **sans texte** n'affiche ni bloc vide ni libellé orphelin (critère 3).
   - Deux analyses de dates différentes paraissent par date décroissante (critère 5).
   - **Une affiche de plus de 2 Mo est acceptée** : la preuve de l'enveloppe à 16 Mo, et du défaut
     latent de s04 corrigé ici.
   - Une date future est refusée avec son message écrit ; un fichier au mauvais format est refusé
     **sans rien écrire**.
   - La correction change la date et remplace le PDF ; la suppression retire l'analyse du site.
   - Un membre simple n'atteint pas l'écran de gestion.
   - L'analyse de A est absente de `/analyses-eau` sur B, **et** la RLS refuse, en SQL direct sous le
     rôle applicatif, de lire la ligne de A depuis le scope de B (critère 5).

9. [x] **Documentation.**
   - `docs/architecture.md` : ligne `water_analysis` dans « Scopée par une policy RLS forcée »,
     décompte **27 tables / 8 scopées**, et mention de la portée `water-analysis` dans la section des
     fichiers de contenu ; l'enveloppe de requête passe de « décision » à « appliquée ».
   - `docs/design-system.md` §1.9 : `--overlay` noté comme **entré dans le code** avec s09.
   - ADR 026 committé sur la branche.
   - `src/db/rls-inventory.test.ts` re-certifie le classement (il lit les `pgTable` et les
     migrations) : il doit passer **sans modification de sa logique**.

## Files touched

**Créés** : `src/db/models/water-analysis-model.ts` ;
`src/db/repositories/water-analysis-repository.ts` ; `src/services/water-analysis-service.ts` ;
`src/services/facades/water-analysis-service-facade.ts` ;
`src/services/facades/interceptors/water-analysis-service-logger-interceptor.ts` ;
`src/services/validation/water-analysis-validation.ts` ;
`src/services/types/domain/water-analysis-types.ts` (+ test) ; `src/app/dal/water-analysis-dal.ts`
(+ test) ; `src/lib/cms/format-content-date.ts` ; `src/components/ui/date-field.tsx` (+ test) ;
`src/components/features/water-analysis/water-analysis-list.tsx` et `water-analysis-form.tsx`
(+ tests) ; `src/app/[locale]/(bureau)/bureau/analyses-eau/{page.tsx, nouvelle/page.tsx, [id]/page.tsx,
actions.ts}` (+ test d'actions) ; `src/app/[locale]/(public)/analyses-eau/page.tsx` (+ test) ;
`src/services/__tests__/water-analysis-service.test.ts` ; `e2e/water-analysis.spec.ts` ; deux
migrations (`0024_*` générée, `0025_water_analysis_rls.sql` custom) ;
`docs/decisions/026-analyses-eau-une-soumission-deux-fichiers.md`.

**Modifiés** : `src/db/models/db.ts` ; `src/services/types/domain/content-file-types.ts` (+ test) ;
`src/services/types/domain/action-registry-types.ts` (+ test) ;
`src/services/types/domain/page-block-types.ts` (`RESERVED_PAGE_SLUGS`, + test) ; `next.config.ts` ;
`src/app/globals.css` ; `src/components/ui/alert-dialog.tsx` ; `src/components/ui/dialog.tsx` ;
`src/components/features/association/bureau-sidebar.tsx` ; `messages/{fr,en,es}.json` ;
`src/services/__tests__/page-i18n.test.ts` ; `src/lib/cms/format-news-date.ts` (supprimé au profit de
`format-content-date.ts`) et ses deux appelants de s05 ; `docs/architecture.md` ;
`docs/design-system.md`.

**Conflits probables avec les branches parallèles** (s06, s07, s08) : `action-registry-types.ts`,
`content-file-types.ts`, `db.ts`, `bureau-sidebar.tsx`, `RESERVED_PAGE_SLUGS`, `messages/*.json`,
`globals.css`, `docs/architecture.md`, et surtout **le journal et les instantanés Drizzle**
(`drizzle/migrations/meta/`) : deux branches qui génèrent chacune une `0018` ne se fusionnent pas à la
main (AGENTS.md interdit d'éditer le journal). Brancher depuis un `main` à jour, ou **régénérer** la
migration après un rebase.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** — jamais de base, repositories et stockage mockés par
  `vi.mock` : fonctions pures (poids, nom de téléchargement, date future, clés, comptes de pages),
  service par rôle (`[ORGANIZATION OWNER]` / `[ORGANIZATION ADMIN]` / `[ORGANIZATION MEMBER]` /
  `[USER NOT IN ORGANIZATION]` / `[PUBLIC]`), compensation des fichiers sur échec, DAL, composants
  (jsdom), actions (façade mockée, `updateTag` après succès seulement), catalogues de messages.
- **e2e (Playwright, contre le build de production, base éphémère seedée)** — tout ce que seuls un
  navigateur, deux domaines et une vraie base prouvent : soumission unique avec deux fichiers,
  téléchargement anonyme, ordre par date, dépôt de plus de 2 Mo, isolation entre associations et
  **preuve RLS en SQL direct**.
- **Pas de couche intermédiaire** (rule-ci-cd-devops) : la RLS n'est pas testable en unitaire,
  `db.ts` refuse toute connexion en test.
- ⚠️ `pnpm test` seul lance Vitest en **mode watch** : toute exécution non interactive utilise
  `pnpm test --run`. Le verdict est la ligne `Tests N passed`, pas celle de pnpm.
- Ne pas lancer `pnpm build` comme vérification finale (AGENTS.md).

## Points à surveiller

- **Poids de la page publique** : 10 affiches de 5 Mo au plus sur une page. `loading="lazy"` limite
  le coût réel, mais le plafond théorique est élevé. Le remède est le redimensionnement à l'écriture
  **borné en largeur** (ADR 024, s06, non mergé) appliqué aux affiches par une story ultérieure —
  pas un recadrage carré, qui détruirait une affiche.
- **`--destructive-text`** (compteur en dépassement, message sous un champ) est prévu par le design
  system pour entrer avec **s08**. Si s08 n'est pas mergée quand s09 s'exécute, s09 pose le token
  elle-même, aux valeurs de §1.9 — jamais une couleur inventée.
- **Fichiers lisibles par clé** : la route publique sert toute clé valide du tenant. Compromis déjà
  accepté par s04 et l'ADR 023 (clé non devinable, UUID aléatoire). Ici sans brouillon, la question
  ne se pose que pendant le court instant entre l'écriture d'un fichier et l'insertion de la ligne.
- **Orphelins de stockage** : un échec de suppression laisse un fichier sans référence, journalisé.
  L'inventaire de s12c les verra.

## Definition of Done

- Une seule PR, description structurée, diff lisible ; **un seul commit de story** (la migration
  custom peut en faire un second, parce qu'on voudrait pouvoir la révoquer seule).
- Les cinq critères d'acceptation sont couverts par un test qui peut échouer.
- `pnpm lint`, `pnpm test --run` et `pnpm test:e2e --project=chromium` passent ; `pnpm db:generate`
  ne produit plus de diff.
- Aucune valeur métier en dur (ADR 010) ; aucun `withRlsBypass` ; aucun `db` importé directement ;
  tout chemin serveur touchant `water_analysis` passe par `withTenant`.
- La recherche, le design, ce plan et l'ADR 026 voyagent dans le commit de la story ; la revue
  (`docs/reviews/s09-analyses-eau.md`) est committée par `/ks-ship`.
- Revue passée, aucun point critique ouvert.
