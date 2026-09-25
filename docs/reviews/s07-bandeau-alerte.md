# Revue : story s07-bandeau-alerte

> Revue faite avec un contexte neuf (sous-agent `reviewer`). Chaque problème est classé critique,
> majeur ou mineur.
> Diff jugé : `git diff main` (modifications suivies) plus les fichiers non suivis de s07 (rien n'est
> encore commité sur `feature/s07-bandeau-alerte`). Les éléments de s08, s08b et s09, ainsi que les
> ADR 025 et 026, sont exclus. Dans `docs/stories.md`, toutes les modifications concernent s08, s08b
> et s10/s12 : aucune ne touche s07.
> Le relecteur n'a rien modifié, rien indexé, rien commité. Il a lancé puis arrêté un serveur
> `pnpm start` sur le build existant ; il n'a pas lancé `pnpm build`.

## Conformité au plan

- [x] Le code fait ce que le plan demande, rien de plus. Les tâches 1 à 10 sont présentes et
      vérifiées une à une :
  - types et validation ;
  - service, façade, intercepteur (`shouldLogDetails: () => false`) et entrée `site.alert.manage`
    (`owner`, `board`) ;
  - DAL : tag par association, lecture publique en `'use cache'` avec `cacheLife('hours')` et
    `cacheTag`, lecture du bureau non cachée ;
  - `<AlertBanner />` : `role="region"` avec `aria-label`, ni `aria-live` ni `role="alert"`,
    `print:hidden`, texte rendu en nœud texte, aucun `z-index` ;
  - `--warning-border` clair corrigé en `oklch(0.6 0.13 65)`, sombre inchangé ;
  - `sidebar.tsx` passe de `fixed` à `sticky top-0 h-svh`, le bloc d'espacement est supprimé, le
    repli se fait par `-ml-(--sidebar-width)` ;
  - `docs/layout.tsx` passe de `overflow-x-hidden` à `overflow-x-clip` (deux occurrences) ;
  - `LocaleLayout` fait un `Promise.all`, et `BaseLayout` rend le bandeau en premier enfant de
    `<body>` ;
  - actions avec `updateTag` appelé seulement après un succès ;
  - écran `/bureau/alerte` et entrée en dernière position du groupe « Le site » ;
  - e2e ;
  - documentation : DS §2.3 et note s38 dans `site-alert-types.ts`, ce que le plan autorise.
- Petits écarts utiles, non demandés par le plan : les tests `page.test.tsx`, `sidebar.test.tsx` et
  `layout-site-alert.test.ts`, et le support d'une icône optionnelle par entrée dans
  `bureau-sidebar.tsx` (nécessaire pour `AlertTriangle`). Rien de problématique.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé. Chaque cible a été ouverte :
      `saveOrganizationSettingsTxnDao({organizationId, upserts, deletions, updatedBy})`,
      `getOrganizationSettingsDao`, `withTenant`, `canPerformAction`, `requireActionAuth`,
      `requireCurrentTenantDal`, `isValidationParsedZodError` / `zodErrorFields`,
      `createServiceInterceptor(…, {shouldLogDetails})`, `updateTag`, `cacheLife`, `cacheTag`. Les
      tokens `bg-warning`, `text-warning-foreground`, `border-warning-border` et
      `text-destructive-ink` existent bien dans `@theme`.
- [x] Aucune valeur plausible mais fausse qui bloque. Les écarts relevés sont mineurs, voir plus bas.
- [x] Le code fait ce qu'il annonce, et l'e2e sur build de production le prouve.

## Conformité aux règles

- [x] Conventions du dépôt (AGENTS.md) respectées :
  - aucune occurrence de `withRlsBypass`, de `dangerouslySetInnerHTML` ni de `process.env` dans
    `src` ;
  - aucune migration ;
  - libellés présents dans fr, en et es ;
  - plafond de 280 en constante nommée ;
  - repository appelé via `getDb()` sous `withTenant`.
- [x] Aucun ADR accepté n'est contredit. ADR 027 est appliqué à la lettre ; ADR 021 (clés hors
      registre) aussi : l'écran Réglages ne supprime que les clés du registre, donc ni `site.alert_*`.
- [x] Design system respecté : seulement des composants existants (`Card`, `Alert`, `Textarea`,
      `Label`, `Button`) et des tokens du système. `destructive-ink` tient lieu de
      `--destructive-text`, qui n'entre qu'avec s08 ; le design demandait seulement de ne pas coder
      la couleur en dur. L'intention de l'écran est respectée : deux boutons, pas de toast, compteur
      et message écrit au dépassement, aperçu avec le vrai bandeau. Les arbitrages du 25/09 (barre
      latérale en `sticky` à `100svh`, route `/bureau/alerte`) sont bien appliqués.

## Tests

- [x] Suite lancée par le relecteur :
  - `pnpm test --run` : **124 fichiers passent, 2 sont ignorés ; 1361 tests passent, 8 sont
    ignorés**, code de sortie 0.
  - `pnpm lint` : 0 erreur, 2 avertissements dans des fichiers hors dépôt applicatif (`.remember/`,
    `.scratch/`).
  - `pnpm exec tsc --noEmit` : 0 erreur.
  - **e2e** sur la base `asl_cms_test` et le build de production existant (aucun fichier de `src/`,
    `e2e/` ou `messages/` n'est plus récent que `.next/BUILD_ID`, et les journaux du serveur
    montrent bien `SITE-ALERT-SERVICE`, donc ce build contient s07), lancé avec
    `pnpm start --port 3000` :
    - `e2e/site-alert.spec.ts` : **2 sur 2 passent** ;
    - **suite e2e complète en série (`--workers=1`, comme en CI) : 112 sur 112 passent**, dont
      `mobile`, `smoke-authenticated`, `authorization`, `site-navigation`, `news`, `auth`,
      `board-members`, `page-cms` et `association-settings`.
  - Deux échecs rencontrés avant ne viennent pas de s07 :
    - sur le port 3100, Better Auth refusait l'origine (« Invalid origin »), d'où les 403 et 429
      dans `authorization` et `smoke-authenticated` ; les deux passent sur le port 3000 ;
    - un seul échec d'`association-settings`, dû à un délai dépassé en exécution parallèle, repasse
      en série.
- [x] Les assertions fixent bien les critères :
  - rôles `owner`, `board`, `member`, non-membre, admin global, SuperAdmin et public, avec « DAO
    non appelé » vérifié en cas de refus ;
  - `updateTag` absent en cas de refus ou d'échec ;
  - texte hostile rendu inerte ;
  - l'e2e couvre les critères 1 à 4 et l'isolation entre les deux associations, avec nettoyage en
    `finally`.

## Régressions

- [x] Aucune régression vue sur les chemins touchés. Avec `sticky`, la colonne reste dans un
      conteneur flex qui étire ses enfants (`flex min-h-svh`), donc l'épinglage fonctionne. Aucun
      autre ancêtre en `overflow-x-hidden` au-dessus d'un `SidebarProvider`. Aucun consommateur
      n'utilise `side="right"`, `floating` ou `inset`. La suite e2e passe entièrement.

## Constats

- **mineur** — `src/app/dal/site-alert-dal.test.ts` (test « scope caché — interdits ») : il ne lit
  que le fichier du DAL. Or la fonction en `'use cache'` appelle la façade, dont l'intercepteur
  appelle `logger.info`, donc l'horloge, **dans** le scope caché. Le test passerait donc alors que
  l'interdit du plan est enfreint. C'est le même schéma que `association-settings-dal` et
  `site-navigation-dal`, déjà livrés, et l'e2e en production passe. Pas de défaut propre à s07, mais
  le filet de sécurité est trompeur.
- **mineur** — `src/components/features/association/site-alert-form.tsx` : le compteur et le
  blocage à plus de 280 portent sur la longueur brute, alors que le serveur juge la longueur après
  `trim()`. Un message de 280 caractères suivi d'un retour à la ligne est refusé côté client alors
  que le serveur l'accepterait.
- **mineur** — `src/app/[locale]/(bureau)/bureau/alerte/actions.ts` (`removeSiteAlertAction`) :
  l'action relit le message enregistré puis le réécrit, sans verrou. Si un autre membre du bureau
  enregistre entre les deux, son message peut être écrasé par l'ancien. De plus, si le champ a été
  modifié sans être enregistré, « Retirer » garde le message enregistré alors que le champ affiche le
  texte modifié.
- **mineur** — `site-alert-form.tsx` : sur `/bureau/alerte`, quand le bandeau est actif, deux
  `region` portent le même nom accessible, « Alerte de l'association » (le vrai bandeau et celui de
  l'aperçu). L'e2e le contourne avec `body > section`. On pourrait sortir l'aperçu de l'arbre
  accessible ou lui donner une autre étiquette.
- **mineur** — `docs/design-system.md` (l. 78 : bloc de tokens ; l. 835 : jumelles hexadécimales) et
  `src/lib/emails/theme.ts:27` (`warningBorder: '#C9922F'`) portent encore l'ancienne valeur
  `oklch(0.72 0.12 70)`. La remarque « ces valeurs ne sont pas encore dans globals.css » (§1.9) est
  devenue fausse pour `--warning-border`. C'est une divergence de documentation et de jumelle email,
  hors du périmètre explicite du plan.
- **mineur** — `src/app/global-error.tsx` n'affiche pas le bandeau. C'est connu, le plan l'annonce
  hors critère ; noté pour mémoire.

## Verdict

Aucun problème critique ni majeur : la story peut partir. Les six points mineurs peuvent attendre le
prochain cycle.

Max severity: minor
Ship allowed: yes
