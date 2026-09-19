# Revue : story s03-connexion-lien-magique (sixième passe, après `3c4ef7a`)

> Revue faite à contexte neuf. Chaque problème est classé critique, majeur ou mineur.
>
> **Diff relu** : `git diff main...feature/s03-connexion-lien-magique`, 11 commits. L'examen porte sur `3c4ef7a` (15 fichiers, +403/−273), qui répond au constat critique de la cinquième passe.
>
> **Références** : `docs/plans/s03-connexion-lien-magique.md` (`validated: yes`), AGENTS.md, ADR 001 à 017 (dont 005, 008, 010, 016, 017), `docs/design-system.md`, `docs/designs/s03-connexion-lien-magique.md`.
>
> **Historique des passes** : 1ʳᵉ ship autorisé puis CI en échec (cycle d'import) ; 2ᵉ bloquée (`check:rules`) ; 3ᵉ autorisée avec trois majeurs sur la limitation ; 4ᵉ autorisée après simplification (3 demandes par adresse et par jour) puis CI en échec (email en anglais) ; 5ᵉ bloquée (le correctif de locale était sans effet).
>
> **État de l'arbre** : le relecteur n'a modifié aucun fichier suivi. `git status` est **propre** à la fin, et **rien n'a changé sous `drizzle/migrations/meta`**. La sonde décrite plus bas vit uniquement dans le scratchpad, hors du dépôt.

## Conformité au plan

- [x] Tâches 1 à 11 cochées et faites (établi aux passes précédentes, inchangé ici).
- [x] **Le plan dit maintenant le correctif de locale.** L'amendement « Correctif de locale de l'email de connexion (après la cinquième revue) » décrit la chaîne complète, la lecture de `params.locale` dans `request.ts` et la preuve sur la vraie chaîne. Le mineur de la cinquième passe est levé.
- [x] Les phrases périmées sont corrigées : « limitation (par adresse et par accès internet) » → « 3 par adresse et par jour, tâche 11 » ; « la tâche 11 reste à faire » → « faite (`f988987`, `a83ac77`) » ; « deux réglages » → le réglage unique.
- [x] « Files touched » complété (tâche 11 + correctif de locale : `setup-real-i18n.ts`, `request.real-i18n.test.ts`, `magic-link-email-service.real-i18n.test.tsx`, renommages, `vitest.config.ts`, `request.ts`, `locale-helper.ts`).
- [ ] Reliquat minime : la **suppression** de `src/__tests__/translations-without-locale-cookie.ts` et la modification de `src/services/__tests__/email-service.test.tsx` ne figurent pas dans « Files touched » (la suppression est dite dans la prose de l'amendement). Sans conséquence.
- [x] Aucune dérive : `3c4ef7a` ne touche que la locale, ses tests, la règle et le plan. Les deux seules retouches de `magic-link-login.tsx` sont du repli de lignes, sans changement de rendu.

## Anti-hallucination

- [x] **La prémisse sur next-intl est cette fois exacte, vérifiée dans le code de la lib** (`next-intl@4.13.5`, `dist/esm/development/server/react-server/getConfig.js`) :

  ```js
  const params = {
    locale: localeOverride,
    get requestLocale() { return localeOverride ? … : getRequestLocale() }
  }
  let result = getConfig(params)   // puis next-intl utilise result.locale / result.messages
  ```

  `locale` est une **propriété simple**, `requestLocale` un **accesseur**. Déstructurer `{locale}` ne déclenche donc aucune lecture de la requête : la garde du commentaire de `request.ts` est respectée à la lettre.

- [x] **Le nouveau `src/i18n/request.ts` est correct et minimal** : branche explicite d'abord (`hasLocale(routing.locales, locale)`), puis la chaîne inchangée root-params → cookie `NEXT_LOCALE` → `defaultLocale` → `notFound()`. Aucune valeur non vérifiée n'atteint `import(\`../../messages/${locale}.json\`)`.
- [x] **L'alias de test pointe sur des fichiers réels**, et sur ceux-là mêmes que la production utilise :
  - `next-intl/server` → `node_modules/next-intl/dist/esm/development/server.react-server.js` (fichier présent, c'est bien l'entrée `react-server` déclarée par `exports` du paquet) ;
  - `next-intl/config` → `src/i18n/request.ts`, exactement ce que fait le plugin en production (`dist/esm/development/plugin/getNextConfig.js` l. 39-52 : `./src/i18n/request.ts`, et l. 114 `'next-intl/config': resolveI18nPath(...)`). `next.config.ts` appelle bien `createNextIntlPlugin()` sans chemin.
- [x] **Les tests ne peuvent pas passer « quoi qu'il arrive » — sonde exécutée.** Copie de `request.ts` dans le scratchpad, **privée de la branche explicite**, aliasée sur `next-intl/config`, même fichier de test, même setup :

  ```
  × traduit dans la locale explicite, depuis une Server Action sans cookie
  × préfère la locale explicite au cookie NEXT_LOCALE
  ✓ les 3 autres (cookie, locale non servie, root-params)
  Tests  2 failed | 3 passed (5)
  ```

  Les deux cas qui fixent le critère tombent dès que `request.ts` ignore `params.locale` ; les cas de non-régression restent verts. Le filet est réel, pas un double.

- [x] Le double halluciné `src/__tests__/translations-without-locale-cookie.ts` est **supprimé**, et plus aucune référence n'en subsiste dans `src/` (seule la revue précédente le cite, à titre d'historique).
- [x] Le setup `src/__tests__/setup-real-i18n.ts` simule honnêtement le contexte du bug : `next/root-params` **jette** (« can only be called in the context of a route »), `cookies()` rend une boîte vide. C'est bien l'état d'un navigateur neuf en Server Action.
- [x] Le message de commit décrit fidèlement ce que fait le diff, y compris la limite « le tableau des routes est identique ».

## Conformité aux règles et aux ADR

- [x] **ADR 008** : `resolveSupportedLocale` n'accepte qu'une `string` présente dans `routing.locales`, sinon `PRODUCT_LOCALE = 'fr'`. Validée par l'action **et** revalidée dans `sendMagicLink`. Rien d'imposé par le client n'atteint un chemin de fichier.
- [x] **Pas de régression d'énumération ni de timing** : la locale est résolue avant toute branche, identiquement pour une adresse connue ou inconnue ; `metadata` n'ouvre aucune branche dans `sendMagicLink` (domaine → quota → compte) ; plancher de 1,5 s inchangé (`action.test.ts` le fixe toujours, horloge simulée). La route HTTP `/sign-in/magic-link` reste fermée (`disabledPaths`, `auth.ts:59`), donc `metadata` ne vient que de la server action.
- [x] **Révocation, quota, disabledPaths intacts** : `revokeEarlierMagicLinks` (suppression des `verification` de l'adresse, `identifier != token`) et `consumeMagicLinkRequestQuotaService` (3/adresse/jour, réglage `login.link_requests_per_address_per_day`, défaut `3`, bornes 1–20) sont inchangés et couverts par le contrat Better Auth réel (adaptateur mémoire) dans `magic-link-integration.real-i18n.test.ts`.
- [x] **Garde sur les imports paresseux** verte (`magic-link-integration-imports.test.ts`, incluse dans la suite complète).
- [x] **Règle corrigée** : `rule-service-emails-internationalization.md` dit désormais que `getTranslations({locale, namespace})` ne fonctionne **que parce que** `request.ts` honore `params.locale`, interdit d'y toucher et renvoie aux tests `*.real-i18n.test.*`. `pnpm check:rules` : « Règles et documentation alignées sur le code » ; la copie `.cursor` ne diffère que par l'en-tête généré.
- [x] **Design system / design s03** : `3c4ef7a` ne change aucun rendu. Aucune couleur brute, aucun `oklch`, aucun `style={{}}` ajouté dans le diff UI de la branche ; l'email garde ses hexadécimaux de `theme.ts` (exigés par §5).
- Observation hors périmètre : `src/i18n/routing.ts` reste `['en','fr','es']` / `defaultLocale: 'en'`, alors que l'ADR 008 vise `['fr']` + `localePrefix: 'never'`. Le fichier **n'est pas dans le diff** (état hérité du boilerplate, application prévue ailleurs). Le code ajouté ici est cohérent avec l'ADR et deviendra simplement inerte le jour de son application.

## Tests et vérifications, lancés par le relecteur

- [x] `pnpm test --run` : **71 fichiers passent, 2 ignorés ; 800 tests passent, 8 ignorés.** Code 0. (795 → 800 : les 5 cas de `request.real-i18n.test.ts`.)
- [x] `pnpm vitest --run --project i18n` : **4 fichiers, 38 tests**, verts — vraie entrée react-server de next-intl sur le vrai `request.ts`.
- [x] Sonde de falsification (scratchpad) : 2 échecs ciblés avec un `request.ts` altéré (voir ci-dessus).
- [x] `pnpm build` : exit 0. Tableau des routes **2 ○ / 44 ◐ / 188 ƒ** ; `/sitemap.xml` et `/robots.txt` prérendus (○), les pages `(app)`, `modules/[module]`, `team/[slug]` toujours en ◐. Aucun prerender perdu : si `request.ts` était devenu dépendant de la requête, aucune route localisée ne resterait ◐. Seul avertissement Turbopack : « Dynamic filesystem access », préexistant.
- [x] `pnpm exec tsc --noEmit` : 0 erreur.
- [x] `pnpm lint` : 0 erreur (1 avertissement dans `.remember/tmp/last-ndc.ts`, hors diff).
- [x] `pnpm check:rules` : aligné.
- [ ] `prettier . --check` : **9 fichiers en écart** — 5 sous `src` (`invalid-magic-link.test.tsx`, `magic-link-login.test.tsx`, `magic-link-email.tsx`, `brevo-transport.test.ts`, `get-email-transport.ts`) et 4 métadonnées Drizzle générées (`_journal.json`, `0008/0009/0010_snapshot.json`). Ces 9 fichiers appartiennent tous à la branche ; sur `main` le dépôt est propre. `pnpm format` n'est pas dans la CI ni dans la DoD du plan : reste mineur, mais le compte `src` est passé de 8 à 5 depuis la cinquième passe (`magic-link-login.tsx` réparé).
- [x] **Les assertions fixent bien le critère.** `magic-link-email-service.real-i18n.test.tsx` vérifie objet, texte et `lang="fr"` **sans cookie de locale** en passant par le vrai `request.ts` ; `magic-link-integration.real-i18n.test.ts` couvre `metadata.locale = 'es'` → objet espagnol et `lang="es"`, et le repli `fr` pour `de`, absence de locale, ou objet muni de `toString`.
- [x] **L'assertion de contrat de `action.test.ts` est significative** : `getTranslations.mock.calls` doit valoir exactement `[[{locale:'es', namespace:'Auth.MagicLinkLogin'}], [{locale:'fr', …}]]` — elle fixe à la fois le passage de la locale de la page et le repli ADR 008 sur `de`, et échouerait si l'action revenait à un `getTranslations('…')` implicite. Le reste du double de ce fichier (`${namespace}.${key}`) n'affirme plus rien sur la locale.
- [x] **Aucun test restant ne s'appuie sur un double contredisant le réel** : les `vi.mock('next-intl/server')` de `magic-link-integration` et `magic-link-email` sont retirés par le renommage ; ceux qui subsistent ailleurs (métadonnées de layout, actions bureau/contact) se contentent d'échos de clés et ne prétendent rien sur la résolution de locale.
- **E2E non exécutés** : pas de Chromium dans le conteneur (`~/.cache/ms-playwright` absent). L'analyse converge cette fois vers un succès : `e2e/magic-link.spec.ts` ouvre tous ses contextes en `fr-FR` (`test.use({locale:'fr-FR'})` et `freshPage`), la page se rend donc en `fr`, `useLocale()` alimente le champ caché, et la chaîne réelle rend le français — c'est exactement ce que prouve `magic-link-email-service.real-i18n.test.tsx`. Preuve définitive : la CI de la PR.

## Régressions

- [x] **Les autres appels `getTranslations({locale, …})` ne changent pas de résultat.** Ils sont tous dans des `generateMetadata` qui passent la locale du segment de route : la branche explicite rend la même locale que root-params rendait. Une locale de route invalide continue de finir en `notFound()` (elle échoue `hasLocale`, puis root-params la rend et la garde existante la rejette).
- [x] Aucune lecture de requête ajoutée : dans la branche explicite, ni `rootParams.locale()` ni `cookies()` ne sont appelés — strictement moins de contexte de requête qu'avant, donc rien à craindre pour `'use cache'`.
- [x] Déplacement de trois fichiers de test du projet `client`/`server` vers `i18n` : les `exclude` des deux premiers projets écartent bien `src/**/*.real-i18n.test.{ts,tsx}`, aucun test n'est exécuté deux fois ni perdu (73 fichiers collectés, suite verte).
- [x] Le seul appelant de `sendMagicLinkEmailService` reste `magic-link-integration.ts`, qui fournit `locale` ; `tsc` vert.
- Pour mémoire, hors constat s03 : les autres emails du boilerplate (`getLocale()` implicite dans `email-service.ts` et `user-service.ts`) partent toujours dans la locale du cookie, sinon `en`. Le diff ne les aggrave pas et la règle le dit.

## Constats

### Nouveaux (`3c4ef7a`)

- **mineur** — `vitest.config.ts` : l'alias `next-intl/server` vise un chemin **interne** au paquet (`dist/esm/development/server.react-server.js`), contournant les conditions d'export. C'est le seul moyen d'obtenir l'entrée react-server sous Vitest, et une rupture future se verrait tout de suite (module introuvable, pas de faux vert) ; à surveiller à chaque montée de version de next-intl. À noter aussi que la preuve porte sur la build _development_ de la lib, la production n'utilisant pas le même fichier — la résolution de locale y est identique.
- **mineur** — « Files touched » du plan omet la suppression de `src/__tests__/translations-without-locale-cookie.ts` et la modification de `src/services/__tests__/email-service.test.tsx`.

### Constat critique de la cinquième passe — **levé**

- `src/i18n/request.ts` honore désormais `params.locale`, vérifiée par `hasLocale`, avant la chaîne inchangée ; le comportement est prouvé sur la vraie chaîne next-intl et la sonde montre que les tests tombent si on retire cette lecture. Les quatre actions demandées (lire `params.locale`, tester le chemin réel sans double, corriger la recette de la règle, amender le plan) sont faites.

### Constats des passes antérieures, toujours ouverts (mineurs)

- **mineur** — Deux demandes concurrentes pour la même adresse peuvent se révoquer l'une l'autre (`revokeEarlierMagicLinks`).
- **mineur** — La purge des compteurs ne s'exécute qu'à une demande ultérieure de la même association : le « purgé sous 24 h » n'est pas strictement tenu (piste : `scheduled_job`, ADR 006).
- **mineur** — Le registre n'a pas de `whenEmptyKey` pour `login.link_requests_per_address_per_day` (vérifié : `default {value:'3'}`, bornes 1–20, pas de `whenEmptyKey`).
- **mineur** — 9 fichiers de la branche ne passent pas `prettier --check` (5 sous `src`, 4 métadonnées Drizzle générées).
- **mineur** — Le cadre de `(auth)/layout.tsx` dégrade `register`, `auth-error`, `verify-request/recovery` et `loading`.
- **mineur** — `registerMagicLinkAction` reste une impasse silencieuse avec `disableSignUp`, et elle consomme le quota.
- **mineur** — `requestMagicLinkAction` ne vérifie pas `env.NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')`, là où `registerMagicLinkAction` le fait (`action.ts:425`).
- **mineur** — Écart au plan dans `e2e/auth.spec.ts` : le test « login pages do not offer sign-up » en remplace un autre.
- **mineur** — Test tautologique « même résultat, adresse connue ou non » (`action.test.ts`).
- **mineur** — Expéditeur par défaut `onboarding@resend.dev`.
- **mineur** — Code mort `magic_link` dans `notification-service.ts`.
- **mineur** — Au renvoi, un résultat `invalid` affiche l'alerte « service en panne ».
- **mineur** — `0010_long_baron_zemo.sql` ajoute `day date NOT NULL` sans valeur par défaut : ne gêne qu'une base intermédiaire déjà peuplée.
- **mineur** — Trous de test : minuit en heure d'hiver et au changement d'heure ; scope tenant de la purge.
- **mineur** — L'aide du réglage n'indique ni la valeur par défaut (3) ni le compromis accepté.

## Verdict

Le défaut critique de la cinquième passe est réellement corrigé, et il est prouvé là où il fallait : par la vraie entrée react-server de next-intl branchée sur le vrai `src/i18n/request.ts`, dans le contexte exact qui a fait échouer la CI (Server Action, pas de root-params, pas de cookie). La sonde de falsification confirme que ces tests échouent dès que la lecture de `params.locale` disparaît — ce n'est plus un filet halluciné. Le double qui affirmait un comportement inexistant est supprimé, la règle dit maintenant la condition qui rend la recette vraie, et le plan porte l'amendement.

Le prerender ne régresse pas : la lecture de `params.locale` ne touche pas l'accesseur `requestLocale` (vérifié dans le code de next-intl), et le build rend toujours 44 routes en ◐, 2 en ○.

Sécurité et comportement inchangés : locale validée des deux côtés contre `routing.locales` avec repli `fr`, même écran et même plancher pour une adresse connue ou inconnue, endpoint HTTP fermé, révocation et quota journalier intacts.

Il ne reste que des mineurs, dont l'essentiel vient des passes précédentes : formatage Prettier, deux trous de test connus, fragilité assumée de l'alias Vitest. Le dernier point qui ne peut pas être tranché ici est l'e2e, faute de Chromium dans le conteneur : la CI de la PR doit rester le juge de paix.

Max severity: minor
Ship allowed: yes
