# Research — Story s51-polices-hebergees

## Target story

Servir les trois polices avec le site (`next/font/local`) au lieu de les télécharger chez Google au
build (`next/font/google`). Story hors périmètre PRD, complexité 1, dépend de s12b. Déclenchée par
deux échecs de build le 5 novembre 2026 (déploiement VPS, e2e CI de la PR #54).

Critères d'acceptation (docs/stories.md l. 3642-3690) :

1. Plus aucun import de `next/font/google` ; les trois familles viennent de fichiers du dépôt
   (`next/font/local`), aux mêmes graisses qu'aujourd'hui ; **un test échoue si `next/font/google`
   réapparaît**.
2. Le build de production n'accède plus à `fonts.googleapis.com` / `fonts.gstatic.com` — vérifié en CI.
3. Aucune page servie ne charge de ressource Google Fonts (HTML et feuilles de style) — e2e sur une
   page publique et une page du back-office.
4. Rendu inchangé : mêmes familles, mêmes variables CSS (`--font-public-sans`, …), design system intact.
5. Fichiers de polices livrés avec leur licence (SIL OFL).

Notes de la story : `woff2`, sous-ensemble latin, seulement les graisses utilisées ; ne pas changer de
police ni ajouter de graisse.

Revue des stories : `docs/reviews/stories.md` finit par `Stories ready: yes`.

## Current state of the code

Un seul fichier charge les polices : `src/app/[locale]/base-layout.tsx` (grep sur `next/font` dans
`src/` : ce fichier et son test, rien d'autre).

- L. 2 : `import {JetBrains_Mono, Public_Sans, Source_Serif_4} from 'next/font/google'`
- L. 17-37, trois appels, tous `subsets: ['latin']`, `display: 'swap'` :

  | Famille          | `weight`                   | `variable`              |
  | ---------------- | -------------------------- | ----------------------- |
  | Public Sans      | `['400','500','600','700']` | `--font-public-sans`    |
  | Source Serif 4   | `['400','600','700']`      | `--font-source-serif`   |
  | JetBrains Mono   | `['400','500']`            | `--font-jetbrains-mono` |

  Aucun `style` : normal seulement. Donc l'italique que le CMS permet (`restricted-markdown-editor.tsx`
  l. 27/34, bouton `italic`) est aujourd'hui **synthétisé par le navigateur** ; « rendu inchangé » =
  ne pas livrer d'italique.
- L. 80 : les trois `.variable` sont posées en classe sur `<body>`, avec `font-sans`.
- `src/app/globals.css` l. 251-253 consomme les variables :
  `--font-sans: var(--font-public-sans), ui-sans-serif, …` (idem serif et mono). Aucun changement requis
  tant que les noms de variables sont conservés.
- 59 fichiers de `src` utilisent `font-serif`/`font-mono` ; pas de `font-light`/`thin` dans les
  composants (seuls `font-medium`, `font-semibold`, `font-bold` apparaissent) : cohérent avec les
  graisses actuelles.
- `public/` ne contient aucune police ; pas de `@fontsource*` dans `node_modules`, aucun fichier
  `PublicSans*` sur la machine. **Les fichiers sont à obtenir** (voir questions ouvertes).
- `.next/static/media/` contient 15 `woff2` issus des builds précédents (les polices téléchargées par
  `next/font/google`) : source possible mais non versionnée et sans licence jointe — à ne pas
  considérer comme la source de vérité.

## Anchor points

- `src/app/[locale]/base-layout.tsx` : seul fichier de code à modifier (imports + trois déclarations).
- `src/app/[locale]/base-layout.test.tsx` l. 10-13 : `vi.mock('next/font/google', …)` renvoyant
  `{variable: 'font'}` pour les trois fabriques. Le test final (l. ~130) fige
  `class="font font font bg-background …"`.
- Nouveau dossier de polices : l'emplacement est libre ; la doc Next (`font.md` l. 108-110) résout
  `src` **relativement au fichier qui appelle** le loader. Le dépôt n'a pas encore de dossier `fonts/`.
- Patron de test « scan du source » existant : `src/app/globals-tokens.test.ts` (lit `globals.css` avec
  `readFileSync` + `import.meta.dirname`), et `src/db/file-key-inventory.test.ts`,
  `src/db/rls-inventory.test.ts`. Le test « `next/font/google` ne réapparaît pas » peut suivre ce modèle.
- Patron e2e : `e2e/styles.spec.ts` (routes `/` et `/login/prestataire`, charge la feuille de styles).
  Une page back-office authentifiée s'appuie sur les specs existantes (`smoke-authenticated.spec.ts`).
- CI : `.github/workflows/ci.yml`, job `e2e` (l. 71), exécute `pnpm test:e2e --project=chromium` ; avec
  `CI=true`, `playwright.config.ts` lance `pnpm build && pnpm start`.

## Verified APIs / functions

- `next` **16.3.0** (`package.json` l. 102). Doc locale lue : `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`.
- `next/font/local` : option `src` (chemin relatif au fichier appelant, ou tableau
  `{path, weight, style}`), `variable`, `display`, `weight` (chaîne ou plage `'100 900'` pour une
  police variable), `declarations`, `fallback`, `adjustFontFallback` (`'Arial' | 'Times New Roman' | false`,
  défaut `'Arial'`). Les options `subsets` et `axes` sont propres à `font/google` (tableau de la doc
  l. 84-96) : `subsets` disparaît donc, le sous-ensemble latin est porté par le fichier lui-même.
- Différence de comportement à noter : avec `font/google`, `adjustFontFallback` est calculé
  automatiquement pour chaque famille ; avec `font/local`, le défaut est `Arial` pour **toutes**,
  y compris la serif et la mono — à trancher au plan pour garder « rendu inchangé » (pas de saut de
  mise en page).
- `variable` identique en local : conserve les noms consommés par `globals.css`.
- Mock de test actuel : `vi.mock('next/font/google', …)` ; il devra devenir `vi.mock('next/font/local', …)`
  avec une seule fabrique par défaut (`localFont`), et l'assertion `class="font font font …"` reste vraie
  si le mock renvoie toujours `{variable: 'font'}`.
- Accès réseau de cette machine vers `fonts.googleapis.com` : disponible au moment de la recherche
  (`curl` → réponse HTTP), donc les fichiers peuvent être récupérés ici ; la panne qui motive la story
  est intermittente côté Google.

## Traps & constraints

- **Test du layout** : si le mock reste sur `next/font/google` alors que le code importe
  `next/font/local`, le test charge le vrai loader et échoue (le loader local lit le disque au build
  via le compilateur SWC, pas à l'exécution Vitest).
- **Vérifier le chargement réel** : un test unitaire mocké ne prouve rien sur les fichiers. Le chemin
  `src` mal écrit n'échoue qu'au build (`next build`), et le projet interdit de lancer `pnpm build`
  automatiquement ; la preuve passe par la CI (e2e = build de production). Mémoire du dépôt : e2e et
  build sont à valider sur GitHub, pas en local.
- **Critères 2 et 3 en CI** : « sans accès réseau vers Google » n'est pas démontré par un build qui
  réussit (Google répond la plupart du temps). L'e2e du critère 3 (aucune adresse Google dans le HTML ni
  les feuilles de style, et idéalement aucune requête sortante interceptée par Playwright via
  `page.route`/`request` events) est la seule preuve mécanique ; le critère 2 demande probablement de
  bloquer ces domaines pendant le build ou de s'appuyer sur le test de source du critère 1.
- **Pas de CSP** dans `next.config.*` ni `proxy.ts` (aucun `font-src` / `Content-Security-Policy`
  trouvé) : rien à adapter côté en-têtes.
- **Hors de `GoogleAnalytics`** : `@next/third-parties/google` (base-layout l. 1) est sans rapport —
  c'est Analytics, pas les polices. Le test « pas de `next/font/google` » doit viser exactement
  `next/font/google` et pas `@next/third-parties/google`, sinon faux positif.
- **Docs qui citent l'ancien mécanisme** : `docs/design-system.md` l. 211-229 (extrait de code avec
  `next/font/google`) et l. 1199 (« Trois polices à installer via `next/font/google` ») ; aussi
  `docs/adaptation-socle-design-system.md`, `docs/decisions/036-deploiement-systemd-nginx-certbot.md`,
  `README.md` et `docs/designs/*.html` mentionnent `fonts.g…`/`next/font`. La story dit « ne pas toucher
  au design system » : ces mentions de **mécanisme** (pas de tokens) deviennent périmées — à décider
  au plan si on les met à jour ou si on les laisse (voir questions).
- **Taille du dépôt** : `.gitattributes` n'a que `* text=auto eol=lf` et `*.pdf binary`. Les `woff2`
  doivent être marqués binaires (sinon risque de normalisation de fins de ligne : `text=auto` détecte
  normalement le binaire, mais ajouter `*.woff2 binary` est prudent).
- **Dépôt public** (mémoire) : les licences OFL sont publiques, rien de sensible ; aucun document client
  concerné.
- Conventions : pas de commentaires superflus ; nouveaux fichiers en kebab-case ; ajouter du code en fin
  de fichier ; Prettier sans point-virgule.
- Une story = une branche `feature/s51-polices-hebergees` depuis `main`. La branche courante est
  `docs/recette-s12b-criteres-3-4` (non `main`) : créer la branche de story depuis `main`.
- Fichiers non suivis dans l'arbre (`docs/logs/`, `docs/research/s42-lancement-invitations.md`) : ne
  pas les embarquer dans le commit de la story.

## Open questions

1. **Source des fichiers `woff2`** : télécharger depuis Google Fonts (CSS2 API, récupérer les `woff2`
   `latin`) ou depuis les dépôts officiels / paquets `@fontsource`. Les fichiers doivent correspondre aux
   versions servies aujourd'hui. À trancher, et à consigner (origine + version) à côté des licences.
2. **Police variable ou statique** : Public Sans et Source Serif 4 existent en variable (un fichier par
   famille, `weight: '400 700'`) ; JetBrains Mono aussi. La story demande « mêmes graisses » ; un fichier
   variable couvre 400-700 mais embarque des graisses non utilisées (ex. 300 ou 800 selon la plage) et
   peut peser plus que quatre statiques. Choix de taille/fidélité à arbitrer au plan.
3. **Sous-ensemble « latin »** : le français exige les accents et ligatures (œ, é, à, ç, « », ’). Le
   sous-ensemble `latin` de Google couvre ces caractères ; `latin-ext` n'est pas servi aujourd'hui. À
   vérifier sur les fichiers retenus (présence de `œ`, `Œ`, `’`, `«`, `»`, `€`).
4. **`adjustFontFallback`** pour Source Serif 4 (serif → `Times New Roman`) et JetBrains Mono (aucune
   option adaptée) afin de ne pas introduire de décalage de mise en page ; valeur à fixer et à vérifier
   visuellement (le rendu de `next/font/google` calcule ces métriques automatiquement).
5. **Où mettre le dossier** (`src/app/[locale]/fonts/`, `src/assets/fonts/`, …) et où ranger les licences
   (`OFL.txt` par famille, ou un `LICENSES.md`) : aucune convention existante dans le dépôt.
6. **Critère 2 (« build sans accès réseau »)** : quel contrôle mécanique exact ? Test de source seul,
   ou étape CI qui coupe/redirige les domaines Google pendant `pnpm build` ? Non réglé par le code
   actuel ; dépend de ce que le workflow GitHub permet.
7. **Mettre à jour les docs** qui décrivent l'ancien mécanisme (`docs/design-system.md` l. 211-229 et
   l. 1199, README) : une mention de mécanisme, sans changement de token, entre-t-elle dans « ne pas
   toucher au design system » ? À valider avec l'utilisatrice au plan.
8. **Page du back-office pour le critère 3** : quelle route authentifiée utiliser dans l'e2e et quel
   helper de connexion (voir `e2e/smoke-authenticated.spec.ts`) ; non ouvert en détail ici.
