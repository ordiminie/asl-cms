# Revue — Story s06-presentation-bureau

> **Deux passes.** La passe 1 ci-dessous a jugé le commit de story ; la passe 2, en fin de fichier, a
> jugé le commit de correctif `a5e5463` écrit en réponse. **C'est la passe 2 qui porte le verdict** —
> les deux lignes du gate, en dernière ligne du fichier, sont les siennes.

## Passe 1 — le commit de story (avant correctif)

> Revue en contexte neuf (subagent `reviewer`), le 2026-09-24.
> Diff jugé : `git diff main...feature/s06-presentation-bureau` (un seul commit, `3ad1c73`).
> Vérifications faites par le relecteur lui-même : suite de tests, ESLint, `tsc`, `check:rules`,
> lecture de chaque import/appel du diff contre sa cible, expérimentations `sharp` sur la vraie
> dépendance du dépôt.

## Ce qui a été exécuté

- `pnpm test --run` → **`Test Files 115 passed | 2 skipped`, `Tests 1271 passed | 8 skipped`**, code
  de sortie 0. Le verdict vient bien de la ligne `Tests N passed`.
- `pnpm lint` → 0 erreur (2 avertissements, tous deux dans des fichiers non suivis d'autres
  sessions : `.remember/tmp/last-ndc.ts`, `.scratch/check-migration.mjs` — hors de ce diff).
- `pnpm exec tsc --noEmit` → une seule erreur, dans `.next/types/validator.ts` (`routes.js` absent).
  Conformément à la mémoire projet, `.next` a été retiré du champ : `src/**`, `e2e/**` et
  `next.config.ts` type-vérifiés avec une configuration jetable hors dépôt (aucun fichier du projet
  modifié) → **aucune erreur**. Il n'y a donc pas de vraie erreur masquée.
- `pnpm check:rules` → « Règles et documentation alignées sur le code. »
- **e2e non exécutables ici** (Chromium ne démarre pas dans le conteneur).
  `e2e/board-members.spec.ts` a été lu ligne à ligne : il prouve bien les trois choses que seul
  l'e2e peut prouver — rangs contigus lus en SQL direct après suppression (`[0,1,2,3]`), dimensions
  réelles des octets servis par `/api/files/…` (512×512, `image/webp`), et accès croisé RLS sous le
  rôle applicatif. Le motif `set_config('app.bypass_rls', …)` dans les helpers a son précédent
  (`e2e/news.spec.ts`, `e2e/tenant-isolation.spec.ts`) et reste cantonné à l'e2e comme l'exige
  AGENTS.md. **Réserve honnête : aucune de ces preuves n'a été rejouée, seulement relue.**

## Plan compliance

- [x] Les huit tâches du plan sont faites et cochées ; le code ne fait pas beaucoup plus. Deux
      dérives seulement : `src/components/ui/sortable-list.tsx` est **modifié** alors que le plan
      écrit « `<SortableList />` repris tel quel » et ne le liste pas dans « Files touched »
      (voir F6) ; et trois exigences de la tâche 5 ne sont pas livrées (mention de délai dans la
      bande d'annulation, résumé d'erreurs avec liens d'ancrage, zone de dépôt masquée sous
      `pointer: coarse`) — voir F9.
- Les quatre écarts au design annoncés dans le plan (token `body-strong-public` appliqué en valeur,
  photo transmise avec le formulaire, pas d'icône `UsersRound`, règle complète du compteur) sont
  bien ceux qu'on trouve dans le code : dérives **pré-déclarées et validées**, non comptées comme
  défauts.

## Anti-hallucination

- [x] **Aucune API inventée.** Chaque cible a été ouverte : `validateContentFile` /
      `buildContentFileKey` / `CONTENT_FILE_CONTENT_TYPES` / `isContentFileKeyAllowed`
      (`content-file-types.ts`, réexports de `page-block-types.ts`), `getContentFileStorage()` et le
      contrat `StorageOperations` (`upload(file, path)`, `delete(path)`), `canPerformAction(user,
      orgId, actionId)`, `canManageAssociation`, `withTenant` / `getDb`, `NotFoundError`,
      `ValidationParsedZodError`, `logger.warn`, `FileUpload` (la prop `maxSize` existe bien),
      `Progress`, `requireActionAuth`, `requireCurrentTenantDal`,
      `getAssociationSettingsDal(organizationId)`. Signatures et emplacements conformes.
- [x] L'affirmation de l'ADR 024 — « `sharp` est déjà dans l'arbre en 0.35.3, le passer en direct ne
      change pas ce qui est installé » — est **vérifiée** : le diff de `pnpm-lock.yaml` ne fait que
      retirer `optional: true`, aucune version ne bouge.
- [ ] **Une logique plausible mais fausse** : le redimensionnement ignore l'orientation EXIF (F1).
      Et **une valeur plausible mais fausse** : le commentaire de `next.config.ts` (F4).

## Rules compliance

- [x] **ADR 002** : `board_member` porte `organization_id`, policy `tenant_isolation` **forcée**
      (`0019`, calquée mot pour mot sur `0017_news_rls.sql`), repository toujours en `getDb()`, tout
      chemin serveur sous `withTenant(...)`, aucun `withRlsBypass` nouveau hors e2e, test d'accès
      croisé présent.
- [x] **ADR 007** (champs fixes, pas de page libre), **ADR 016** (paramètre au registre typé, sans
      défaut, résolu en `null` et non en `0` — testé), **ADR 018** (`board.member.manage`,
      `['owner','board']`, une entrée pour quatre verbes), **ADR 020** (`le-bureau` dans
      `RESERVED_PAGE_SLUGS`, même commit), **ADR 023** (portée `board` déclarée, aucune route ni
      validation de clé nouvelle), **ADR 024** (validation par signature **puis** redimensionnement
      **puis** écriture — l'ordre est prouvé par un test qui journalise la séquence).
- [x] **ADR 010** : aucune valeur métier en dur ; le nombre de membres est un paramètre, les
      libellés sont dans `messages/fr.json`.
- [x] Architecture en couches respectée (présentation → DAL → façade → service → repository), façade
      + intercepteur `shouldLogDetails: () => false` comme les actualités, DAL calqué sur
      `news-dal.ts` (fonction interne cachée, `cacheLife('hours')`, un seul `cacheTag`, aucune
      horloge dans le scope caché), Server Actions avec `requireActionAuth()` et `updateTag`
      **après** le succès seulement.
- [ ] **Design system** : conforme dans l'ensemble (initiales Source Serif 600 à 0,375 × le côté,
      128/96/56/128 px, `object-cover`, aucun composant ni couleur hors système, aucun token
      inventé), mais quelques écarts de détail : rayon 12 px au lieu de 8 sur le portrait public
      (F10), variante `destructive` absente du bouton de confirmation de suppression, `disabled`
      HTML sur « Enregistrer » là où l'écart 3 du design exige `aria-disabled` (F7).

## Tests

- [x] Suite lancée par le relecteur, verte.
- [x] Les assertions **épinglent les critères** dans l'ensemble : ordre des rangs, initiales **et
      absence de balise `img`**, phrase du nombre de membres omise quand le paramètre est absent,
      mention RGPD unique, `aria-disabled` **et** `not.toBeDisabled()`, refus des trois rôles non
      autorisés avec « aucun DAO appelé, aucun fichier écrit », effacement de l'ancienne photo
      **après** la mise à jour, garde mécanique sur `bodySizeLimit`. Le test de `resize-image` tourne
      sur de **vrais octets**, `sharp` n'est pas doublé — c'est ce qui donne sa valeur au critère 2.
- Deux angles morts : aucun test ne couvre le remplacement d'une photo depuis l'écran de
  modification (F2), et le test d'échec de réordonnancement utilise un message maison, ce qui masque
  la contradiction de F3. Le test de la liste passerait sur l'implémentation telle qu'elle est comme
  sur une implémentation qui révoque l'état optimiste.

## Regressions

- `src/components/ui/sortable-list.tsx` est le seul point de contact avec le déjà livré : il est
  rendu par `page-editor.tsx` (s04) et `site-navigation-manager.tsx` (s04b). Aucun de leurs tests
  n'assertait sur l'état désactivé des boutons, donc la suite verte ne prouve rien pour eux. L'effet
  réel est un changement de comportement sur deux écrans livrés (F6), pas une casse : `applyMove`
  refuse les cibles hors bornes, la garde a été vérifiée.
- La portée `board` et le passage de l'enveloppe à 6 Mo ne changent rien pour s04/s05 : leurs suites
  (`page-*`, `news-*`, `content-file`) restent vertes **sans modification de leurs attentes**, seuls
  deux tests d'inventaire ont été étendus (liste des portées, slug réservé), ce qui est exactement ce
  que le plan annonçait.

## Findings

- **F1 — major — `src/lib/files/resize-image.ts`** — `resizeToSquareWebp` n'appelle ni `.rotate()`
  ni `autoOrient` : `sharp` n'applique **pas** l'orientation EXIF par défaut, et la sortie WebP perd
  le marqueur d'orientation. Une photo prise au téléphone en portrait (orientation 6 ou 8, le cas le
  plus courant, et précisément celui que l'ADR 024 met en avant) est donc stockée **et servie couchée
  à 90°**. Vérifié expérimentalement avec le `sharp` 0.35.3 du dépôt : à source identique marquée
  `orientation: 6`, la sortie sans `.rotate()` et la sortie avec `.rotate()` ont des pixels
  différents (empreintes `545e935a23a6` vs `b7fa1499a90c`), et aucune des deux ne porte de marqueur
  d'orientation. Correctif : un `.rotate()` avant `.resize()`. Aucun test ne couvre l'orientation.
- **F2 — major — `src/components/features/board/board-member-form.tsx:258-262`** — le bouton
  « Remplacer la photo » est **sans effet** sur une fiche qui a déjà une photo. Dans cette branche
  l'état est déjà `photo === undefined` et `photoRemoved === false` ; le gestionnaire écrit
  exactement ces deux valeurs, donc rien ne change et la zone `FileUpload` (rendue seulement quand
  `photo || previewSrc` est faux) n'apparaît jamais. Le seul chemin pour changer un portrait passe
  par « Retirer la photo » puis un nouveau dépôt — un chemin que rien n'annonce et que le design ne
  décrit pas. Non couvert par les tests.
- **F3 — major — `src/components/features/board/board-member-list.tsx:91-101`** — en cas d'échec,
  l'état optimiste n'est pas révoqué **et** la bande de succès n'est pas effacée. Après une
  suppression refusée, l'écran affiche simultanément « Fiche supprimée. Les N fiches restantes ont
  été renumérotées de 1 à N. » et « La fiche n'a pas pu être supprimée. **Elle est toujours en
  ligne.** », la ligne ayant disparu de la liste. Même contradiction au réordonnancement : « Les
  fiches sont restées dans leur ordre précédent » s'affiche au-dessus du **nouvel** ordre. Le motif
  optimiste vient de s04b, mais s04b se contente d'un message générique ; ici les phrases affirment
  un état que l'écran dément.
- **F4 — major — `next.config.ts:41-49` + `docs/architecture.md:210-219`** — le commentaire affirme
  que la limite « doit rester **au-dessus** du plus grand fichier que le produit accepte », alors que
  6 Mo est **au-dessous** de `CONTENT_FILE_MAX_BYTES.document` (10 Mo), plafond bien actif : le bloc
  PDF de s04 (`page-editor.tsx:208`, `kind: 'document'`) téléverse par Server Action. Le test de
  garde ne compare qu'à `.image` tout en annonçant « Ce test protège aussi s04 et s05 » — il ne
  protège pas le chemin PDF. Et `docs/architecture.md` continue d'écrire que `next.config.ts` fixe
  `'2mb'` et que « l'enveloppe passe donc à **16 Mo** » : après ce commit, le document contredit le
  code sur les deux valeurs. Ce n'est **pas une régression** (2 Mo était pire), mais c'est une fausse
  assurance doublée d'une doc périmée sur une décision qui engage s09.
- **F5 — minor — `board-member-form.tsx:81-86`** — après un enregistrement réussi avec nouvelle
  photo sur l'écran de modification, `photo` est remis à `undefined` et l'aperçu retombe sur
  `member.photoKey`, la clé **précédente**, que le service vient d'effacer : l'aperçu montre une
  image cassée jusqu'au rechargement.
- **F6 — minor — `src/components/ui/sortable-list.tsx`** — composant partagé modifié hors du
  périmètre déclaré du plan (« repris tel quel », absent de « Files touched »). Le passage de
  `disabled` à `aria-disabled` + `pointer-events-none`/`opacity-45` change le comportement des écrans
  de s04 et s04b, qu'aucun test ne couvre sur ce point ; au clavier, l'activation devient un
  non-événement silencieux. Le changement est défendable (§2.4 : « désactivé **et annoncé** ») et la
  garde de bornes existe dans `applyMove` — d'où le classement mineur, mais il aurait dû être
  annoncé.
- **F7 — minor — `board-member-form.tsx:352`** — « Enregistrer la fiche » porte l'attribut `disabled`
  alors que l'écart 3 du design vise explicitement « « Monter » / « Descendre » **et
  « Enregistrer »** … jamais avec l'attribut `disabled` … À reproduire tel quel ». Le test
  `board-member-form.test.tsx:95` épingle le comportement contraire (`expect(submit).toBeDisabled()`).
- **F8 — minor — `messages/en.json`, `messages/es.json`** — les namespaces `BureauBoardPage` et
  `PublicBoardPage` n'y sont pas, alors que les clés `AssociationSettings` de la même story y ont été
  ajoutées et que s04b comme s05 avaient traduit les leurs. `routing.locales` sert toujours
  `['en','fr','es']` : `/en/le-bureau` rendra les clés brutes.
- **F9 — minor — écrans** — détails du design/plan non livrés, tous conséquence du « repris tel
  quel » : pas de mention « Possible pendant 10 secondes » dans la bande d'annulation (tâche 5), pas
  de liens d'ancrage dans le résumé d'erreurs (tâche 5), pas de `<dl>` Rôle/Rang en mobile (écart 5
  du design), `progress` sans `value` rendu en barre vide plutôt qu'indéterminée, zone de dépôt non
  masquée sous `pointer: coarse` (§2 `file-upload`), bouton de confirmation de suppression dans la
  variante par défaut là où le design réserve `destructive` à cet acte.
- **F10 — minor — `(public)/le-bureau/page.tsx:122,136`** — portrait public en `rounded-lg`, soit
  `--radius + 4px` = 12 px, là où §3.9 fixe **8 px** ; la liste du back-office utilise correctement
  `rounded-md`.
- **F11 — minor — `messages/fr.json`** — pluriels non gérés en ICU : `memberCount` rend « 1 membres
  propriétaires », `list.removedNotice` rend « Les 1 fiches restantes ont été renumérotées de 1 à
  1 ».

## Ce qu'il n'y a rien à redire

Isolation multi-tenant, ordre validation → autorisation → écriture, refus sans effet de bord,
lecture publique délibérément sans autorisation (avec son précédent), transaction unique pour
suppression + renumérotation (et le refus argumenté d'une contrainte d'unicité sur le rang),
migrations générées par l'outil avec journal cohérent, inventaire RLS re-certifié (26 → 27, 7 → 8),
un seul commit de story portant recherche, design, plan, ADR 024 et code, `.zip` du canevas non
commité comme prévu.

## Verdict

Aucune critique : rien dans ce diff ne fuit entre associations, ne casse une story livrée ni
n'invente une API. Les quatre points majeurs sont réels et corrigibles en une passe courte — un
`.rotate()`, un bouton mort, une révocation d'état optimiste, une valeur et deux phrases de
documentation.

**Verdict de la passe 1** : gravité maximale *major*, ship autorisé. Verdict **remplacé** par celui
de la passe 2 ci-dessous, écrite après correction de huit des onze findings.

---

# Passe 2 — le commit de correctif `a5e5463`

> Revue en contexte neuf (subagent `reviewer`), le 2026-09-24.
> Diff jugé : `git diff main...feature/s06-presentation-bureau` (deux commits, `3ad1c73` puis le
> correctif `a5e5463`), effort concentré sur `git diff 3ad1c73..HEAD`.
> Périmètre du correctif, décidé par Marie-Ève : F1, F2, F3, F4, F5, F7, F10, F11. F6, F8 et F9
> laissés en l'état délibérément.

## Ce qui a été exécuté, et ce qui n'a été que relu

**Exécuté par le relecteur :**

- `pnpm test --run` → **`Test Files 115 passed | 2 skipped (117)`, `Tests 1279 passed | 8 skipped (1287)`**,
  code de sortie 0. Verdict pris sur la ligne `Tests N passed`, comme l'exige AGENTS.md. Soit +8 tests
  par rapport à la passe 1, ce qui correspond exactement aux huit tests ajoutés par le correctif.
- `pnpm lint` → 0 erreur, 2 avertissements, tous deux hors de ce diff, dans des fichiers non suivis
  d'autres sessions (`.remember/tmp/last-ndc.ts`, `.scratch/check-migration.mjs`).
- `pnpm exec tsc --noEmit` → après suppression de `.next/types/routes.d.ts` (mémoire projet), une
  seule erreur, dans `.next/types/validator.ts`. Hors `.next/` : **aucune erreur**. Rien de masqué
  dans `src/**`, `e2e/**`, `next.config.ts`.
- `pnpm check:rules` → « Règles et documentation alignées sur le code. »
- **Expérience indépendante sur le `sharp` 0.35.3 du dépôt** pour arbitrer F1 (script jetable hors
  dépôt, aucun fichier du projet touché).
- Lecture de chaque import, appel et clé de configuration du correctif contre sa cible :
  `createTranslator` (présent dans `next-intl`, vérifié à l'exécution), `#file-upload-handle`
  (`file-upload.tsx:128`), `CONTENT_FILE_MAX_BYTES` (réexport de `PAGE_FILE_MAX_BYTES`,
  `page-block-types.ts:215-218` : image 5 Mo, document 10 Mo), `--radius` / `--radius-md`
  (`globals.css:35,242`).

**Relu seulement, jamais rejoué :** `e2e/board-members.spec.ts`. **Les e2e ne sont pas exécutables
dans ce conteneur** (Chromium ne démarre pas) : aucune des preuves e2e — rangs contigus lus en SQL,
512 px des octets servis, accès croisé RLS — n'a été rejouée.

## Les huit findings corrigés — verdict un par un

### F1 — orientation EXIF — corrigé, et le test discrimine vraiment

`src/lib/files/resize-image.ts:32` porte désormais `.rotate()` **avant** `.resize()` : bon ordre. Le
relecteur a rejoué les deux implémentations sur le `sharp` du dépôt :

```
rotate=false left={"red":254,"blue":0}   right={"red":0,"blue":255}   TEST_PASSES=false
rotate=true  left={"red":0,"blue":255}   right={"red":254,"blue":0}   TEST_PASSES=true
```

Le test « redresse l'orientation EXIF d'un portrait pris au téléphone » **échoue bien sur l'ancien
code**. Ce n'est pas un test de complaisance : il échantillonne deux vrais pixels d'une image
réellement pivotée, pas une empreinte ni un appel doublé. Les quatre tests préexistants du fichier
restent verts — `.rotate()` est un non-événement sans marqueur EXIF.

### F2 — « Remplacer la photo » sans effet — corrigé

Le défaut était réel : l'ancien gestionnaire réécrivait `photo=undefined` / `photoRemoved=false`,
soit exactement l'état courant d'une fiche qui a déjà une photo. Le correctif introduit un état
dédié `isChoosingPhoto` (`board-member-form.tsx:73`), la branche devient
`(photo || previewSrc) && !isChoosingPhoto` (l. 251), et le dépôt d'un fichier le referme (l. 303).
Le test prouve la bascule par la présence puis l'absence de `#file-upload-handle` — il échouerait sur
l'ancien code, l'input restant `null` — et vérifie que le `FormData` porte bien le nouveau `File`
**sans** `removePhoto`.

Réserve de forme : une fois `isChoosingPhoto` à `true`, rien ne permet de **renoncer** au
remplacement, ni bouton « Annuler », ni retour à l'aperçu. Rien n'est perdu (sans nouveau fichier le
service conserve la photo en place), donc ce n'est pas un défaut, mais l'écran ment un instant en ne
montrant plus la photo courante.

### F3 — état optimiste non révoqué — corrigé

`apply()` prend maintenant `previousItems`, et `revert()` fait les trois choses qu'il fallait :
`setItems(previousItems)`, `setNotice(undefined)`, `setError(message)`
(`board-member-list.tsx:74-93`). `previousItems` est capturé **avant** le `setItems` optimiste, dans
`reorder` (l. 96) comme dans `remove` (l. 108). La révocation est bien visible : `SortableList` est
**entièrement contrôlé** par sa prop `items` (`sortable-list.tsx:140-155`, aucun état interne de
liste), donc `setItems` suffit. Les deux nouveaux tests échoueraient sur l'ancien code, et celui du
réordonnancement utilise désormais **le vrai message de l'action** (`BureauBoardPage.errors.failed`)
au lieu d'une phrase maison — c'est exactement ce qui manquait à la passe 1.

### F4 — `bodySizeLimit` et documentation — corrigé, les quatre sources concordent

| Source                                        | Ce qu'elle dit                                             |
| --------------------------------------------- | ---------------------------------------------------------- |
| `next.config.ts:54-55`                        | `bodySizeLimit: '16mb'`                                    |
| commentaire, `next.config.ts:41-52`           | 5 Mo image **et 10 Mo document**, 16 Mo = somme + marge    |
| `docs/architecture.md:210-222`                | « L'enveloppe est donc à **16 Mo** », garde citée          |
| garde, `board-member-service.test.ts:461-476` | `Math.max(...Object.values(CONTENT_FILE_MAX_BYTES))`       |

La garde compare bien **au plus grand plafond** (10 Mo, celui du document) et non plus à `.image`
(5 Mo) : c'était le cœur du reproche. La justification avancée est exacte — `git show
main:docs/architecture.md` écrivait déjà « L'enveloppe passe donc à 16 Mo » avant cette branche.
C'était le code qui était en retard, pas la doc.

**Sur le risque d'élargir l'enveloppe à 16 Mo** : les trois chaînes de dépôt du produit ont été
ouvertes, **aucune n'est sans plafond par fichier** — blocs de page, actualités et fiches du bureau
passent par `validatePageBlockFile` (`page-block-types.ts:259-262`, refus avant décodage),
l'identité d'association par `IDENTITY_MAX_BYTES` (`association-identity-types.ts:37,108-110`). Le
plafond réellement appliqué reste 5 ou 10 Mo selon le cas ; l'enveloppe ne fait que laisser la
requête atteindre la validation. Ce qui change quand même : **Next tamponne le corps avant
d'exécuter l'action**, donc un appelant non authentifié peut faire absorber 16 Mo au lieu de 2 Mo par
requête de Server Action. Rien d'autre que Next ne le borne aujourd'hui : la limitation de débit est
une story à venir (s08b) et la limite du reverse proxy est renvoyée à s12b par `architecture.md`. Ce
n'est **pas un blocage pour s06** — la décision est écrite, tracée, et s09 l'exige — mais c'est la
seule contrepartie réelle du passage à 16 Mo, et elle doit rester au tableau jusqu'à s08b/s12b.

### F5 — aperçu cassé après enregistrement — le défaut est parti, mais remplacé par « plus d'aperçu du tout » (N1)

### F7 — `disabled` sur « Enregistrer » — corrigé

`aria-disabled={isPending || created || undefined}` + `aria-disabled:pointer-events-none`
(l. 365-366), et le clic devient un non-événement par la garde `if (isPending || created) return`
**placée avant** le `setNotice(undefined)` (l. 99) — subtilité importante : sans ce placement, un
second clic effacerait le message de succès. Le test l'épingle exactement
(`toHaveAttribute('aria-disabled','true')`, `not.toBeDisabled()`, action appelée une seule fois,
« Fiche enregistrée » toujours visible). Les trois assertions échouent sur l'ancien code. Cohérent
avec le même choix déjà fait dans `sortable-list.tsx`.

### F10 — rayon du portrait public — corrigé, et la valeur est la bonne

`rounded-lg` → `rounded-md` sur les deux branches (`(public)/le-bureau/page.tsx:122,136`). La
conversion a été vérifiée plutôt que crue : `--radius: 0.5rem` (`globals.css:35`) et
`--radius-md: var(--radius)` (`globals.css:242`) ⇒ `rounded-md` = **8 px exactement**, ce que §3.9
exige. `rounded-lg` valait bien 12 px.

### F11 — pluriels ICU — corrigé sur les trois messages

`BureauBoardPage.memberCount`, `BureauBoardPage.list.removedNotice` et `PublicBoardPage.memberCount`
passent en `{count, plural, one {…} other {…}}` avec `#`. Apostrophes typographiques partout, donc
aucun piège d'échappement ICU. Règle CLDR française vérifiée : `one` couvre 0 **et** 1, donc un
compte à 0 rendrait « 0 membre affiché » — français correct, et sans régression sur la promesse
« jamais 0 membres » (la phrase reste omise quand le paramètre est absent, testé). Deux tests neufs
épinglent le singulier, côté liste et côté page publique ; tous deux échouent sur l'ancien code.

**Les trois findings laissés délibérément (F6, F8, F9) : rien de neuf.** `sortable-list.tsx` n'est
pas retouché ; `messages/en.json` et `es.json` sont inchangés, les nouveaux messages ICU n'y sont pas
non plus, ce qui ne change pas l'analyse suspendue ; aucun détail de F9 n'a été livré ni dégradé.

## Les trois points soumis à un avis indépendant

**1. `bodySizeLimit` à 16 Mo.** Concordance code / commentaire / doc / garde vérifiée, les quatre
disent la même chose, et la garde compare au plus grand plafond. Risque non borné : non, chaque
chaîne a son plafond par fichier ; la seule contrepartie est l'amplification du tampon avant
exécution, à garder en tête pour s08b et s12b. Une réserve de procédure subsiste : voir **N5**.

**2. `e2e/board-members.spec.ts:407`, `/renumérotées/` → `/renumérot/`.** Ce n'est **pas** une
assertion affaiblie pour faire passer la suite, mais la justification donnée est trop forte. Le fait
ICU est réel : la branche `one` rend « renumérot**ée** en 1 », la branche `other` « renumérot**ées** »,
seul `renumérot` couvre les deux. En revanche « le nombre de fiches restantes n'est pas
déterministe » ne tient pas dans **ce** spec : `test.describe.configure({mode: 'serial'})` (l. 223),
cinq fiches créées (l. 230), une supprimée au critère 3 (l. 348) → quatre, une supprimée ici →
**trois restantes**, donc toujours la branche plurielle. Le motif élargi reste discriminant : aucun
autre message de l'écran ne contient « renumérot », et `/aucune fiche/` en minuscules ne matche pas
l'état vide « **A**ucune fiche pour l'instant ». Verdict : robustesse défendable, argumentaire
surévalué, pas un filet troué.

**3. Le double `createTranslator` dans `page.test.tsx`.** Le remplacement est un vrai progrès et ne
rend pas les huit tests existants plus complaisants. L'ancien double faisait un
`replaceAll('{count}', …)` : sur un message ICU il aurait rendu la chaîne brute, et le test du
singulier n'aurait rien prouvé. `createTranslator` existe bien, formate `#` via `Intl.NumberFormat`
en `fr`, et sur clé manquante rend le chemin `Namespace.clé` — donc **plus** visible qu'un
`undefined` silencieux. Les assertions existantes (« 412 membres propriétaires », mention RGPD
unique, état vide) restent aussi exigeantes. Le double cast est cantonné au test, nécessaire
(next-intl type le namespace sur `IntlMessages`) et honnêtement commenté, mais il fige une signature
à un seul argument : voir **N2**.

## Liste de contrôle

- **Plan compliance** — les huit tâches restent cochées et livrées. Deux écarts de plan subsistent
  après le correctif : `bodySizeLimit` à `'16mb'` là où le plan écrit `'6mb'` (N5), et
  `requireCurrentTenantDal()` appelé avant `requireActionAuth()` alors que le plan écrit
  « `requireActionAuth()` en premier » (N3). F6 et F9 restent, par décision assumée.
- **Anti-hallucination** — aucune API inventée dans le correctif. `createTranslator`,
  `#file-upload-handle`, `CONTENT_FILE_MAX_BYTES`, `--radius-md`, `sharp().rotate()` : tous ouverts,
  nom, signature et emplacement conformes. Les deux affirmations factuelles testables du correctif —
  `.rotate()` change réellement les pixels, `architecture.md` disait déjà 16 Mo sur `main` — sont
  **vraies**.
- **Rules compliance** — inchangée et bonne : ADR 002 (RLS forcée, `getDb()`, `withTenant`, aucun
  `withRlsBypass` hors e2e), ADR 010, ADR 016/018/020/023/024, architecture en couches.
  `pnpm check:rules` vert. Le correctif ne touche aucun de ces points.
- **Design system** — la conformité s'améliore : rayon du portrait public repassé à 8 px (§3.9),
  « Enregistrer » ne porte plus `disabled` (écart 3 du design). Aucun composant, token ou couleur
  hors système ; `aria-disabled:opacity-45` est un utilitaire Tailwind, pas un token maison. Reste
  l'aperçu 128 px demandé par le design et jamais rendu pour un fichier fraîchement choisi (N1).
- **Tests** — verts, lancés par le relecteur. Les huit nouveaux tests épinglent chacun leur finding
  et **échoueraient tous sur l'ancien code** : vérifié par lecture pour sept, **expérimentalement**
  pour celui de l'orientation EXIF. Une seule assertion faible : N1.
- **Regressions** — le correctif ne touche aucun chemin de s04, s04b ou s05 : `sortable-list.tsx`
  n'est pas retouché, `fr.json` ne change que les namespaces de s06, `resize-image.ts` n'est appelé
  que par le service des fiches, et `bodySizeLimit` ne fait que monter — aucun dépôt jusqu'ici
  accepté ne devient refusé. Les suites `page-*`, `news-*`, `content-file` restent vertes sans
  modification de leurs attentes.

## Findings nouveaux — tous mineurs

- **N1 — minor — `board-member-form.tsx:89-93, 251-262`** — F5 est réglé, mais par disparition :
  `previewSrc = photo ? undefined : …`, donc **dès qu'un fichier est choisi il n'existe plus aucun
  aperçu**, ni avant, ni pendant, ni après l'enregistrement — seulement le nom du fichier. Le design
  demande « aperçu carré 128 px » une fois la photo présente
  (`docs/designs/s06-presentation-bureau.md:72`) et « aperçu précédent conservé » pendant
  l'enregistrement (l. 165) ; ni l'un ni l'autre n'est tenu. Aucun `URL.createObjectURL` dans le
  fichier. Le test censé couvrir le point ne peut pas voir la différence :
  `expect(preview?.getAttribute('src') ?? '').not.toContain('photo-1.webp')` **passe trivialement
  quand `preview` est `null`** — ce qui est précisément le cas réel.
- **N2 — minor — `(public)/le-bureau/page.test.tsx:23-24`** — le double n'accepte qu'un namespace en
  chaîne, alors que le fichier testé appelle `getTranslations({locale, namespace: 'PublicBoardPage'})`
  dans `generateMetadata` (`page.tsx:27`). Sans conséquence aujourd'hui (`generateMetadata` n'est pas
  exercé), mais le jour où il le sera, `createTranslator` recevra un objet en guise de namespace et
  rendra silencieusement des clés brutes au lieu d'échouer franchement.
- **N3 — minor — `(bureau)/bureau/le-bureau/actions.ts:48, 79, 110, 129`** — les quatre actions
  appellent `requireCurrentTenantDal()` **avant** `requireActionAuth()`, et **hors du `try`**, là où
  le plan écrit « Chacune appelle `requireActionAuth()` en premier ». Aucune fuite : le tenant vient
  du domaine appelé, pas de l'utilisateur, et le service revérifie l'autorisation. Mais l'ordre
  annoncé n'est pas celui du code, et un échec de résolution du tenant échappe au `failure()`
  traduit.
- **N4 — minor — `sortable-list.tsx:120-125` + `board-member-list.tsx:95-105`** — après un
  réordonnancement **refusé**, la liste revient bien à l'ordre précédent (F3), mais la bande
  d'annulation de 10 s reste affichée : son « Annuler » ré-émettrait un `onReorder(previousItems)`,
  soit une seconde écriture de l'ordre **déjà courant**. Inoffensif, mais c'est une affordance
  orpheline à côté du message d'échec.
- **N5 — minor — `docs/plans/s06-presentation-bureau.md:62, 189`** — le plan, `validated: yes`, écrit
  `bodySizeLimit` à `'6mb'` ; le code livré dit `'16mb'`. La valeur livrée est la bonne — c'est
  `architecture.md` qui faisait foi, et la garde de test la protège — mais le plan validé décrit
  désormais autre chose que ce qui part.

## Ce qu'il n'y a rien à redire

Les six correctifs de fond — EXIF, bouton mort, révocation optimiste, enveloppe + garde + doc, rayon,
pluriels ICU — sont réels, ciblés, et chacun est adossé à un test qui **échoue sur l'ancien code**, y
compris le plus difficile à prouver, l'orientation EXIF, rejoué par le relecteur sur le `sharp` du
dépôt. Le correctif n'introduit ni API inventée, ni composant hors design system, ni régression sur
les stories livrées, et n'a pas profité de la passe pour élargir son périmètre. Le remplacement du
double de `getTranslations` par le vrai formateur est le bon réflexe : sans lui, les deux tests de
pluriel n'auraient rien prouvé.

## Verdict

Les quatre majeurs de la passe 1 sont éteints, sans nouveau défaut de gravité équivalente. Les cinq
findings neufs sont tous mineurs, aucun ne fuit entre associations, ne casse une story livrée ni
n'invente d'API.

Max severity: minor
Ship allowed: yes
