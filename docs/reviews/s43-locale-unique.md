# Revue — Story s43-locale-unique (2e passage)

> Revue du 2026-10-07 par le subagent `reviewer` (contexte neuf, lecture seule), après l'échec du
> build constaté au `/ks-ship`. Diff revu : `git diff main...feature/s43-locale-unique`, 3 commits :
> `64f714d` (la story), `a3fc576` (la revue précédente), `f49293d` (le correctif du build). Les
> modifications non commitées de `docs/designs/s10-*`, `s11-*`, `s12-*` et les fichiers non suivis
> `docs/research/s12b-*`, `s12d-*` ne font pas partie de la story : ignorés. Les constats m1 à m7 de
> la première revue ont été rejugés.

Verdict : le correctif remplit son rôle. Le build passe, la documentation s'affiche réellement sous
`fr`, aucun constat critique ni majeur. Il reste des mineurs.

## Vérifications exécutées

Toutes sur une copie locale de l'arbre commité (`git archive` puis `node_modules`, hors du montage 9p).

- **`pnpm vitest run`** : 200 fichiers passés, 2 ignorés (202) ; 2467 tests passés, 8 ignorés
  (2475). Code de sortie 0, aucun timeout de worker.
- **`pnpm exec tsc --noEmit --incremental false`** : code de sortie 0.
- **`pnpm lint`** : code de sortie 0.
- **`pnpm build`** : code de sortie 0, 267 pages générées. La route `/[locale]/docs/[...slug]`
  produit bien `/fr/docs/introduction` et les autres slugs. C'est la vérification qui avait échoué
  au `/ks-ship`.
- **Serveur de production réel** (`pnpm start`, port 3123), requêtes `curl` :
  - `/docs/introduction` → 200, `<html lang="fr">`, H1 « Introduction », liens de la barre latérale
    en `/docs/…` sans préfixe ;
  - `/docs/getting-started` → 200 ;
  - `/fr/docs/introduction` et `/en/docs/introduction` → 308 vers `/docs/introduction` ;
  - `/docs` → 200 qui émet dans le flux une redirection `NEXT_REDIRECT` (307) vers
    `/fr/docs/introduction`, laquelle repart en 308 : deux rebonds (voir m9) ;
  - `robots.txt` : interdictions sans préfixe et préfixées présentes.
- **Le nouveau test pinne-t-il le défaut ?** Les 4 fichiers source d'avant le correctif (`64f714d`)
  remis sous `docs-locale.test.ts` : 3 tests sur 5 échouent (params, métadonnées, page). Les 2 autres
  passent aussi sur le code cassé (voir m8).
- **E2E non exécutés** (ils tournent en CI). Specs lues, dont `e2e/locale-unique.spec.ts`. Aucune
  spec e2e ne couvre `/docs`.

## Checklist

### Conformité au plan

- [x] Tâches 1 à 10 présentes et conformes ; cochées dans le plan.
- [x] Le correctif est consigné dans « Files touched / Modifiés hors plan ». La liste est exacte :
      les 5 fichiers source et le test du commit `f49293d`.
- [x] Le plan est revu sur un point : « la documentation héritée répond 404 » devient « la
      documentation est servie en anglais ». Acceptable : le 404 était une conséquence tolérée de la
      décision « minimum sur les écrans hérités », pas un critère de la story. Le correctif rétablit
      le comportement de `main` (docs en ligne), sans préfixe désormais. La suppression de ces pages
      reste confiée à la story de nettoyage.

### Anti-hallucination

- [x] Les imports et appels du correctif existent avec ces signatures exactes :
      `DOCS_CONTENT_LOCALE` (exporté par `src/lib/files/docs-file-helper.ts`), `getDocsStructure`,
      `findDocBySlug`, `getDocFilePath`, `getDocsNavigation`, `searchDocs(query, locale)`
      (`src/lib/files/search.ts`), `routing.locales`.
- [x] `DOCS_CONTENT_LOCALE` est utilisé de façon cohérente : dans `page.tsx` (`generateStaticParams`,
      métadonnées, page, pagination), dans `actions.ts` et dans les valeurs par défaut du helper ;
      le seul appelant de `searchDocsAction` (`search-modal.tsx`) est à jour ; `layout.tsx`
      n'utilise plus `params`. Seul écart : `search.ts` (m10).
- [x] Les `href` de la documentation sont construits en `/docs/…` : aucun lien préfixé, ce que
      confirme le HTML servi.

### Règles du dépôt et ADR

- [x] Aucune migration. Aucun `withRlsBypass`.
- [x] Aucun ADR contredit : ADR 008 appliqué ; ADR 031 respecté (module des préfixes sans import
      `@/`, 308 vérifiés à l'exécution) ; ADR 020 respecté (`fr`, `en`, `es` réservés).
- [x] Pas de design pour cette story : aucun composant ni token ajouté, seul `LangToggle` est retiré.

### Tests

- [x] Suite lancée par le reviewer : elle passe.
- [~] Les assertions pinnent les critères de la story. Pour le correctif, 3 tests sur 5 pinnent le
      défaut ; les 2 autres non (m8).

### Régressions

- [x] Build de production vert.
- [x] Les routes docs répondent sous `fr` à l'exécution.
- [x] Les adresses préfixées redirigent en 308.

## Constats

Tous mineurs.

- **m8 (minor)** — `src/app/[locale]/docs/docs-locale.test.ts` : « fournit la navigation latérale »
  et « trouve des résultats de recherche » passent aussi sur le code d'avant le correctif (les deux
  actions avaient déjà `'en'` par défaut). Le défaut réel du layout, qui passait `params.locale`
  (donc `'fr'`), n'est pas testé. Ce sont des garde-fous, pas des tests de régression.
  `expect(metadata.title).not.toBe('Page not found')` reste aussi une assertion faible.
- **m9 (minor, hérité, rendu visible par le correctif)** — Les métadonnées de
  `docs/[...slug]/page.tsx` construisent encore `pageUrl` avec `/${locale}/docs/…`. Le HTML servi
  annonce donc une `canonical` `/fr/docs/introduction`, qui est une redirection 308, et des
  `hreflang` `fr`, `en`, `es` vers trois adresses qui redirigent toutes, avec `robots: index: true`.
  Cela contredit l'intention de la story (« les moteurs ne voient pas trois fois la même page ») pour
  la documentation ShipSaaS héritée. En prime, `docs/page.tsx` redirige vers
  `/${locale}/docs/introduction` (deux rebonds), et `<html lang="fr">` habille un contenu anglais.
  Acceptable au titre de la décision « minimum » ; à inscrire dans la story de nettoyage des écrans
  hérités.
- **m10 (minor)** — `src/lib/files/search.ts` l. 196 : `locale: string = 'en'` en littéral, alors
  que le correctif introduit `DOCS_CONTENT_LOCALE` comme source unique.
- **m1 à m4, m6, m7 (minor, repris de la revue précédente)** — Toujours valables :
  - m1 : `legacy-locale-prefixes.test.ts`, test des segments voisins fondé sur une regex maison
    plutôt que sur la sémantique path-to-regexp de Next ;
  - m2 : `user-preferences-sync.test.tsx`, cas « aucune navigation » faible ;
  - m3 : `page-i18n.test.ts`, espace de noms du test ContactPage (`t('title')` passe par
    coïncidence) ;
  - m4 : `languageSchema` recopié en dur, tenu égal à `languageEnum` par
    `locale-defaults.test.ts` (écarts au plan désormais consignés) ;
  - m6 : `DEFAULT_LOCALE = 'en'` dans `src/lib/helper/date-helper.ts`, hors diff ;
  - m7 : commentaires anglais dans `e2e/auth.spec.ts` et `docs/authentication-system.md` qui liste
    encore `messages/en.json` et `messages/es.json`.
- **m5 (retiré)** — Classé à tort dans la revue précédente : le diff met bien à jour le commentaire
  de `src/app/sitemap.ts` (« ADR 008 applique en s43, ADR 031 »).

## Fichiers pertinents

- `src/app/[locale]/docs/[...slug]/page.tsx`
- `src/app/[locale]/docs/actions.ts`
- `src/app/[locale]/docs/layout.tsx`
- `src/app/[locale]/docs/page.tsx`
- `src/app/[locale]/docs/docs-locale.test.ts`
- `src/lib/files/docs-file-helper.ts`
- `src/lib/files/search.ts`
- `src/components/features/docs/search-modal.tsx`
- `next.config.ts`, `src/lib/routing/legacy-locale-prefixes.ts` (+ test)
- `src/proxy.ts`, `src/i18n/routing.ts`, `src/i18n/request.ts`
- `docs/plans/s43-locale-unique.md`
- `docs/decisions/031-redirection-des-prefixes-de-langue-dans-next-config.md`

Max severity: minor
Ship allowed: yes
