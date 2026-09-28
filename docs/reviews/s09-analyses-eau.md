# Revue — Story s09-analyses-eau

> Revue en contexte neuf (subagent `reviewer`). Chaque point est classé critical / major / minor.
> Diff jugé : `git diff main...feature/s09-analyses-eau` (un seul commit, `61f4df5`, sur `main` à
> `78f7fb5`).

## Comment j'ai vérifié

- **Vitest, suite complète** : lancée sur une copie propre de la branche, sur le disque Linux local,
  hors du montage 9p.
  - Copie obtenue par `git archive feature/s09-analyses-eau`, plus `.env.test`, dans le scratchpad de
    la session.
  - `node_modules` : copie de celui du dépôt. Le `pnpm-lock.yaml` est identique (même md5) et la
    branche ne touche ni `package.json` ni le lockfile.
  - Commande : `pnpm test --run`.
  - **Résultat : `Test Files 148 passed | 2 skipped (150)`, `Tests 1690 passed | 8 skipped (1698)`**,
    en 62 s.
  - Les 8 tests ignorés sont hérités et sans lien avec s09 : `theme.test.tsx`, `home.test.tsx`, un
    test Stripe de `subscription-service.test.ts`.
  - Une passe en mode verbeux confirme que les tests s09 ont bien tourné (service par rôle, page
    publique, formulaire, actions, DAL, champ date, voile, registre, portées, slugs réservés, garde de
    `next.config.ts`).
  - Premier essai écarté : il donnait 237 échecs `Invalid Chai property: toBeInTheDocument`. La cause
    était le répertoire de travail du relecteur, qui contenait déjà une copie d'une session précédente
    (`node_modules/node_modules` imbriqué). Ce n'est pas la branche : sur l'arbre propre, tout passe.
- **Typecheck** : `pnpm exec tsc --noEmit` → code 0.
- **Lint** : `eslint` sur les 50 fichiers `.ts` et `.tsx` ajoutés ou modifiés → 0 erreur. Les 6
  avertissements disent seulement que `src/components/ui/` est exclu par la configuration.
- **`pnpm check:rules`** → « Règles et documentation alignées sur le code. »
- **`pnpm db:generate`** (sur la copie) → « No schema changes, nothing to migrate ». Le journal et les
  instantanés 0024/0025 sont cohérents.
- **e2e Playwright : non exécuté par le relecteur.** Il exige un build de production et une base
  Postgres seedée, et AGENTS.md interdit de lancer `pnpm build` comme vérification finale. La spec
  (`e2e/water-analysis.spec.ts`) a été relue comme du code de production ; son exécution reste à la
  charge de la CI.

## Conformité au plan

- [x] Le code fait ce que le plan spécifie, rien de plus.

Les tâches 1 à 9 sont toutes présentes dans le diff :

- modèle et migrations `0024` (générée) puis `0025` (custom, `ENABLE` + `FORCE` + `tenant_isolation`) ;
- portée `water-analysis`, `WATER_ANALYSIS_MANAGE` (`owner`, `board`), `analyses-eau` ajouté aux slugs
  réservés, `proxyClientMaxBodySize: '16mb'` ;
- types de domaine et fonctions pures ;
- validation, repository (toujours par `getDb()`), service, façade et intercepteur
  (`shouldLogDetails: () => false`) ;
- DAL : cache et tag pour la lecture publique, rien pour le bureau ;
- `DateField` ;
- trois routes du bureau, avec actions et `redirect()` hors du `try` ;
- page publique `/analyses-eau` ;
- e2e, avec la preuve RLS en SQL direct ;
- documentation : architecture en 29 tables dont 10 scopées (le plan écrivait 27 et 8 avant le merge
  de s08 et s08b, le chiffre suit la réalité et `rls-inventory.test.ts` passe sans modification),
  design-system §1.9, ADR 026.

Le renommage de `formatNewsDate` en `formatContentDate` est complet : plus aucune référence à l'ancien
nom. Aucune dérive hors plan. La garde ajoutée dans `board-member-service.test.ts` découle directement
de la tâche sur l'enveloppe de requête.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé. Chaque cible a été ouverte :
  - `getContentFileStorage`, `buildContentFileKey(org, scope, owner, slot, format)`,
    `validateContentFile` (= `validatePageBlockFile(kind, Uint8Array)`), `CONTENT_FILE_MAX_BYTES`
    (5 Mo et 10 Mo), `contentFileUrl` ;
  - `getDb` et `withTenant` (`src/db/tenant-scope.ts`), `canPerformAction(user, org, actionId)`,
    `ValidationParsedZodError`, `NotFoundError`, `requireCurrentTenantDal`, `newsDateSchema` ;
  - `FileUpload` (props `onlyimage`, `maxSize`, `isUploading`, `onChange`), `Progress`, et le
    `role="alert"` d'`Alert` ;
  - les tokens `--destructive-text` (déjà dans `globals.css`) et `--overlay`, dont les valeurs sont
    identiques à §1.9 ;
  - `proxyClientMaxBodySize` existe bien dans `node_modules/next/dist/server/config-shared.d.ts`
    (Next 16.3.0).
- [x] Aucune valeur ni logique plausible mais fausse qui compte.
  - Tri `sampled_on desc, created_at desc, id desc`.
  - Date future jugée par comparaison de chaînes ISO, avec `today` injecté.
  - Jour calendaire de Paris obtenu par `Intl` `en-CA`, qui rend bien `YYYY-MM-DD`.
  - Ordre de compensation vérifié : fichiers → ligne ; ligne → anciens fichiers à la correction ;
    ligne → fichiers à la suppression.
  - Les deux fichiers sont validés par signature binaire avant toute écriture.
- [x] Le code fait ce qu'il annonce. Les 74 clés i18n utilisées par le formulaire, la liste et la page
  publique existent en fr, en et es.

## Conformité aux règles

- [x] Conventions du dépôt (AGENTS.md) respectées.
  - Aucun `withRlsBypass` ni `db` importé directement dans `src`.
  - Tout accès à `water_analysis` passe par `withTenant`.
  - Les libellés sont dans `messages/*.json`.
  - Un seul commit de story.
  - Migrations générées, pas écrites à la main.
  - Les constantes de pagination sont des constantes d'affichage justifiées par ADR 023 §4.
- [x] Aucun ADR accepté contredit : ADR 002/003 (RLS forcée plus e2e croisé), 007, 010, 018, 020,
  023, et 026 cohérent avec le code.
- [x] Design system respecté pour l'essentiel. `--overlay` remplace `bg-black/50` dans `dialog` et
  `alert-dialog`. Composants utilisés : `card`, `table`, `alert`, `alert-dialog`, `separator`,
  `progress`, `file-upload`, `button`. Aucune couleur écrite en dur. Une dérive mineure sur le lien de
  téléchargement public (voir constats).

## Tests

- [x] Suite lancée par le relecteur : verte (chiffres ci-dessus).
- [x] Les assertions épinglent les critères :
  - C1 et C4 : publication en une opération, ordre des écritures vérifié par `invocationCallOrder` ;
    formulaire limité à quatre champs sans champ de texte alternatif.
  - C2 : `download` et nom de fichier vérifiés ; e2e anonyme avec `Content-Type`.
  - C3 : aucun `data-slot` de texte et un seul lien quand le texte est vide.
  - C5 : isolation par rôle ; e2e sur deux domaines ; RLS en SQL direct (lecture croisée, lecture sans
    scope, écriture hors tenant).
  - Chaque refus d'autorisation vérifie qu'aucun DAO n'est appelé et qu'aucun fichier n'est écrit.

## Régressions

- [x] Aucun impact constaté sur les chemins existants.
  - Le voile de `dialog` et `alert-dialog` change de couleur partout, ce qui est voulu par §1.9 et
    testé par `dialog-overlay.test.tsx`.
  - Les appelants de s05 sont mis à jour.
  - `/api/pages/files` n'est pas touché.
  - La sidebar est testée.

## Constats

1. **minor** — `src/app/[locale]/(public)/analyses-eau/page.tsx` : le lien de téléchargement est un
   `<a>` stylé à la main (`border-border hover:bg-muted …`) au lieu de
   `buttonVariants({variant: 'outline'})`. Le design (écran 4) demande un lien `outline` : l'intention
   est tenue, mais le style du composant du système n'est pas repris.
2. **minor** — `src/components/features/water-analysis/water-analysis-form.tsx`, `checkForm` : le
   client mesure `content.length` avant `trim` alors que le serveur juge après `trim`. Un texte de 500
   caractères suivi d'espaces est refusé par le navigateur alors que le serveur l'accepterait. De même,
   un fichier sans type MIME déclaré est refusé côté client alors que la signature binaire l'accepterait.
3. **minor** — `src/services/water-analysis-service.ts`, `updateWaterAnalysisService` : si la ligne
   disparaît entre `requireWaterAnalysis` et `updateWaterAnalysisDao` (suppression concurrente), le DAO
   rend `undefined` sans lever d'erreur. `toWaterAnalysisDto(undefined)` lève alors hors du `try`, et le
   nouveau fichier reste orphelin. La course est rare, et l'échec est rendu au bureau comme une erreur
   générique. La compensation « mise à jour en échec → nouveaux fichiers supprimés » n'a pas non plus de
   test unitaire.
4. **minor** — `src/services/types/domain/water-analysis-types.ts` : `isWaterAnalysisFileKeyAllowed`
   n'est utilisé que par son test (code mort en production, pourtant demandé par le plan). Autres points
   dans ce fichier :
   - `formatFileWeight` écrit « octets », « Ko » et « Mo » dans le code plutôt que dans
     `messages/*.json` ;
   - la constante `'Europe/Paris'` est dupliquée une troisième fois (déjà présente dans
     `rate-limit-service.ts` et `contact-message-types.ts`).
5. **minor** — `src/app/[locale]/(bureau)/bureau/analyses-eau/page.tsx` : une page du bureau au-delà
   de la dernière (`?page=99`) affiche « Aucune analyse publiée pour l'instant. » alors que des analyses
   existent. Le message est trompeur.
6. **minor** — `src/app/[locale]/(bureau)/bureau/analyses-eau/actions.ts` : une date invalide ou vide
   qui échappe au contrôle client finit en `ValidationParsedZodError`, rendue comme l'erreur générique
   `failed` et non sous le champ date. Le client la bloque en amont, donc l'impact reste faible.

Points hérités, notés sans les imputer à s09 :

- `<Progress>` sans `value` affiche une piste vide plutôt qu'une barre indéterminée animée : même
  patron dans `news-editor.tsx` et `board-member-form.tsx`.
- Squelette sur les écrans de formulaire, alors que §2 dit « jamais un formulaire » : même patron dans
  `actualites/[id]` et `le-bureau/*`.
- L'intercepteur journalise dans les lectures en `'use cache'` : même patron dans `news-dal.ts`.
- `process.env` dans l'e2e : même patron dans toutes les autres specs.

## Verdict

Aucun défaut critique ni majeur. Les six constats sont mineurs et peuvent être traités au prochain
cycle. Réserve : l'e2e n'a pas été exécuté par le relecteur ; il doit passer en CI avant le merge.
L'implémenteur l'avait exécuté contre un build de production (9 passés sur `water-analysis.spec.ts`,
130 sur la suite chromium), mais c'est un résultat rapporté, pas mesuré par cette revue.

Max severity: minor
Ship allowed: yes
