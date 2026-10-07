# Revue — Story s43-locale-unique

> Revue du 2026-10-07 par le subagent `reviewer` (contexte neuf, lecture seule). Diff revu :
> `git diff main...feature/s43-locale-unique` (1 commit, `b8c409e`, 63 fichiers). Les modifications
> non commitées de `docs/designs/s10-*`, `s11-*`, `s12-*` et les fichiers non suivis
> `docs/research/s12b-*`, `s12d-*` ne font pas partie de la story : ignorés.

Verdict : rien ne bloque. Aucun constat critique ni majeur, sept mineurs.

## Vérifications exécutées

Toutes lancées sur une copie locale de l'arbre commité (`git archive`, `node_modules` en lien
symbolique), hors du montage 9p.

- **`pnpm test --run`** : 199 fichiers passés, 2 ignorés (201) ; 2461 tests passés, 8 ignorés
  (2469). Code de sortie 0. Aucun timeout de worker, aucun fichier non exécuté. Le diff n'ajoute aucun
  `.skip`, `.only` ni `.todo`.
- **`pnpm exec tsc --noEmit --incremental false`** : code de sortie 0, aucune erreur, `.next/`
  compris.
- **`eslint`** sur les fichiers touchés : aucune erreur. **`pnpm check:rules`** : « Règles et
  documentation alignées » — la copie `.cursor` de `rule-translation` est régénérée.
- **Chargement réel de `next.config.ts`** par `loadConfig` de Next 16.3.0 : `redirects()` rend les
  6 règles, toutes `permanent: true` ; l'import relatif de
  `./src/lib/routing/legacy-locale-prefixes` se résout.
- **Appariement réel des règles** par le moteur de Next (`getPathMatch`) :
  - `/en`, `/es`, `/en/actualites`, `/fr/bureau/membres` → redirigés vers l'adresse sans préfixe ;
  - `/EN/bureau` → redirigé aussi (appariement insensible à la casse) ;
  - `/english`, `/french-page`, `/esprit`, `/`, `/actualites` → **non** capturés ;
  - query string conservée : comportement documenté (`redirects.md` l. 43) ; 308 = statut de
    `permanent: true` (l. 30) ; les `redirects` passent avant le proxy (`proxy.md` l. 204-215).
- **Playwright e2e et `pnpm build` : non exécutés** (ils tournent en CI). Specs lues seulement.
- **Clés présentes en en/es mais absentes de fr sur `main`** : exactement les 13 clés `ContactPage.*`
  annoncées par la recherche ; aucune n'est appelée. Le formulaire utilise
  `validation.emailInvalid` et `validation.subjectRange`, qui existent en français.

## Checklist

### Conformité au plan

- [x] Tâches 1 à 10 présentes et conformes. Trois écarts hors plan, justifiés et restés dans le
      « minimum sur les écrans hérités » (voir m4) : `user-validation.ts`, `post-form-validation.ts`,
      nouveau test `locale-defaults.test.ts`.

### Anti-hallucination

- [x] Aucune API, fonction ou import inventé ; chaque cible ouverte et vérifiée : `redirects` /
      `permanent`, `getSessionCookie`, `hasLocale`, `localePrefix: 'never'`,
      `LEGACY_LOCALE_PREFIXES`, `routing.locales`, `NextRequest`.
- [x] Aucune valeur plausible mais fausse : statut 308, query conservée, slash séparateur exigé,
      préfixe exact.
- [x] Le code fait ce qu'il annonce :
  - le proxy compare le chemin brut à `AUTHENTICATED_SEGMENTS` (`/account`, `/admin`, `/bureau`,
    `/dashboard`, `/team`) et redirige vers `/login` ;
  - `request.ts` retombe sur `defaultLocale` quand le cookie porte une locale non servie ;
  - la branche langue de `UserPreferencesSync` est retirée, le thème conservé.

### Règles du dépôt

- [x] Conventions d'AGENTS.md respectées. Aucune migration (enum `language_type` gardé,
      décision C). Aucun `withRlsBypass`.
- [x] Aucun ADR accepté contredit : ADR 008 désormais appliqué ; ADR 031 respecté (module sans import
      `@/` ni `@/env`) ; ADR 020 : `fr`, `en`, `es` ajoutés à `RESERVED_PAGE_SLUGS`, test couvrant
      aussi `FR` et ` En `.
- [x] Aucun écran nouveau ; seul `LangToggle` est retiré, rien d'inventé côté design system.

### Tests

- [x] Suite lancée par le relecteur : elle passe.
- [x] Les assertions pinnent les critères : forme des redirections, gating du proxy
      (`src/proxy.test.ts`, nouveau), cookie `en` → français, robots.txt, slugs réservés, absence de
      sélecteur, emails en français, contenu de `messages/` en unitaire. Critères 1 à 3 et constat
      déclencheur couverts par `e2e/locale-unique.spec.ts`, **non exécuté**.

### Régressions

- [x] `/${locale}/…` restant dans `src` hors tests : seulement le blog hérité
      (`(public)/blog/**`), `docs/page.tsx` et `admin/blog/actions.ts`, ce que la décision de
      l'utilisatrice accepte.
- [x] Plus aucune référence à `en.json`, `es.json`, `LangToggle` ni `stripLocalePrefix` dans le code.
- [x] `callbackURL` sans préfixe.
- [x] Les chaînes françaises attendues par les e2e réécrits existent dans `fr.json` (« Créer un
      compte avec email », « Accès non autorisé », « Ajouter une équipe », « Se connecter à votre
      espace »).

## Constats

Tous mineurs.

- **m1 (minor)** — `src/lib/routing/legacy-locale-prefixes.test.ts` : le test des segments voisins
  (`/english`, `/french-page`) s'appuie sur un appariement maison (`matchesSource`, une regex), pas
  sur la sémantique path-to-regexp de Next. Le résultat est juste (vérifié avec `getPathMatch`), mais
  le test ne le prouverait plus si la forme des règles changeait ; seul l'e2e couvre l'effet réel.
- **m2 (minor)** — `src/components/context/__tests__/user-preferences-sync.test.tsx` : le cas
  « aucune navigation » est faible. `waitFor(() => expect(setThemeMock).not.toHaveBeenCalled())` se
  résout immédiatement, et `replaceMock` ne peut plus être appelé puisque le composant n'importe plus
  de routeur. Garde-fou seulement si quelqu'un réintroduit le routeur mocké ; le cas du thème est réel.
- **m3 (minor)** — `src/services/__tests__/page-i18n.test.ts` (test ContactPage) : les appels
  `t('…')` littéraux de `contact/page.tsx`, qui utilise l'espace de noms `ContactPage.metadata`, sont
  confrontés à la racine `ContactPage`. `t('title')` passe parce que `ContactPage.title` existe
  aussi : coïncidence. La preuve sur les 13 clés mortes reste valable.
- **m4 (minor)** — Trois écarts au plan, justifiés mais absents de « Files touched » :
  - `src/services/validation/user-validation.ts` : `languageSchema` reprend en dur
    `['fr','en','es']`, copie de `languageEnum` (`src/db/models/user-model.ts`) qui peut dériver. Bon
    choix fonctionnel (sinon `/account/settings` refuserait un profil en `en`), mais dériver de l'enum
    aurait été préférable ;
  - `src/components/features/admin/blog/post-form-validation.ts` (`LANGUAGE_OPTIONS`) : retombée de
    typage ;
  - `src/lib/__tests__/locale-defaults.test.ts` : nouveau test.
- **m5 (minor)** — `src/app/sitemap.ts` l. 24-25 : le commentaire parle encore de « contournement de
  l'ADR 008 jusqu'a s43 », désormais périmé.
- **m6 (minor)** — Hors diff, hérité, rendu faux par la story : `src/lib/helper/date-helper.ts` garde
  `DEFAULT_LOCALE = 'en'` avec une docstring « comme `routing.defaultLocale` » ; utilisé par
  `formatDate` dans `account/invitations`. À prendre dans la story de nettoyage des écrans hérités.
- **m7 (minor)** — Restes en anglais et références périmées : commentaires « Create account with
  email » dans `e2e/auth.spec.ts` l. 27/55/228/252 ; `docs/authentication-system.md` l. 392-393 (doc
  héritée) liste encore `messages/en.json` et `messages/es.json`.

## Fichiers pertinents

- `next.config.ts`
- `src/lib/routing/legacy-locale-prefixes.ts` (+ test)
- `src/proxy.ts`, `src/proxy.test.ts`
- `src/i18n/routing.ts`, `src/i18n/request.ts`
- `src/components/context/user-preferences-sync.tsx`
- `src/services/validation/user-validation.ts`
- `src/services/__tests__/page-i18n.test.ts`
- `e2e/locale-unique.spec.ts`
- `docs/decisions/031-redirection-des-prefixes-de-langue-dans-next-config.md`

Max severity: minor
Ship allowed: yes
