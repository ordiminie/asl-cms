# Revue — Story s08b-limitation-debit-formulaires

> Revue faite avec un regard neuf (subagent `reviewer`) sur le diff
> `git diff main...feature/s08b-limitation-debit-formulaires` (un commit, `ca976c3`). Chaque problème
> est classé critique, majeur ou mineur.

**Verdict : aucun problème bloquant, six points mineurs. Le ship est autorisé, à condition que les
tests e2e passent en CI avant le merge** : ils n'ont pas pu être lancés en local.

## Conformité au plan

- [x] **Le code fait ce que le plan demande. Deux ajouts mineurs hors plan** (constats 3 et 6).
  - **Tâche 1** : faite.
    - `day` est remplacée par `window_start timestamptz`, avec deux migrations : `0022`, une
      troncature générée par `--custom`, puis `0023`, générée. Les instantanés s'enchaînent bien
      (0021 → 0022 → 0023) et `pnpm db:generate` répond « No schema changes ».
    - L'usage entre dans l'empreinte : `RateLimitPurposeConst`, avec `magic_link.address` repris au
      caractère près.
    - Les fenêtres `dayWindowStartOf` et `hourWindowStartOf` existent.
    - `consumeContactMessageQuotaService` est en place. Sans IP, l'envoi passe sans être compté et un
      `logger.warn` est émis.
    - Le réglage `contact.messages_per_visitor_per_hour` (défaut 3, de 1 à 20, entier) et son getter
      sont ajoutés.
  - **Tâche 2** : faite.
    - `getAllOrganizationIdsDao` passe par `getDb()`.
    - `purgeExpiredRateLimitFingerprintsService` boucle sur les associations avec un `withTenant` pour
      chacune.
    - Le script `purge-rate-limit-fingerprints.ts` existe. Ni route, ni cron, ni `scheduled_job`.
  - **Tâche 3** : faite.
    - Le quota est consommé entre la validation et l'écriture.
    - L'IP vient de la dernière entrée de `x-forwarded-for`, sinon de `x-real-ip`.
    - L'état `rate_limited` et son `limit` sont ajoutés, avec le cinquième état du formulaire.
    - `e2e/rate-limit.spec.ts` est créé. `contact.spec` prend une adresse neuve à chaque envoi, ce que
      le plan autorise. `magic-link.spec` suit la nouvelle colonne.
    - `docs/architecture.md` est réécrit.
  - Le plan prévoyait de modifier `tenant-settings-seed.ts`. Seul son test a changé : la valeur par
    défaut du registre suffit, c'est acceptable.

## Anti-hallucination

- [x] **Aucune API, fonction ou import inventé.** Chaque cible a été ouverte :
  - `headers` de `next/headers` ;
  - `getDb` et `withTenant` de `@/db/tenant-scope` ;
  - `numberSettingOf` ;
  - `createServiceInterceptor` et son option `shouldLogDetails` ;
  - `logger.warn` ;
  - `initDotEnv`, qui est synchrone jusqu'à `dotenv.config` ;
  - `registerHooks` de `node:module`, présent en Node 22.23 ; la CI est en Node 22 ;
  - `tsx`, bien déclaré dans les dépendances.
- [x] **Aucune valeur plausible mais fausse**, à l'exception du constat 1 (changement d'heure) :
  - minuit à Paris est vérifié en été, en hiver et aux changements d'heure ; le décalage calculé à
    00:00 UTC est bien celui de minuit à Paris ;
  - couper l'heure en UTC donne la même heure qu'à Paris ;
  - Next ne pose `x-forwarded-for` (`base-server.js:612`, `??=`) que si l'en-tête est absent. Sans
    proxy, l'adresse réelle du client est donc lue, et le cas « sans IP » reste marginal.
- [x] **Le code fait ce qu'il annonce.** Le script de purge a été exécuté (voir Tests) : les modules
  se chargent, les associations sont listées, la requête SQL est atteinte, et un échec rend un code de
  sortie 1.

## Conformité aux règles

- [x] **Conventions d'AGENTS.md respectées** :
  - aucun `withRlsBypass()` nouveau dans `src/` (seulement un mock de test, plus le bypass SQL de
    maintenance propre aux e2e) ;
  - les repositories passent par `getDb()` ;
  - le seuil est un paramètre d'association (ADR 010 et 016) ;
  - les libellés sont dans `messages/fr.json` ;
  - aucune IP en base ni dans les journaux : l'intercepteur a `shouldLogDetails: () => false`, et même
    en cas d'erreur seul le nom de la méthode est journalisé.
- [x] **Aucun ADR accepté contredit** : ADR 002, 006, 008, 010 et 025 relus.
- [x] **Design system respecté.** `RateLimitAlert` reprend exactement les classes de `ErrorSummary` :
  - `alert` `destructive`, `border-destructive border-2`, `[&>svg]:size-5` ;
  - icône `AlertTriangle`, `tabIndex={-1}`, focus au rendu ;
  - « Votre texte est conservé. » en `<strong>`, bouton désactivé, seuil interpolé avec l'accord au
    pluriel.

  C'est conforme à l'intention de l'écran 1, état 5 (`docs/designs/s08-formulaire-contact.md`), et à
  la bordure 2 px du §3.9. Aucun token ni composant nouveau.

## Tests

- [~] **Tests lancés par le reviewer. Tout ce qui a pu tourner est vert, mais la machine en a empêché
  une partie** :
  - **`pnpm test --run` complet** : 61 fichiers et 1007 tests passent, 1 test est ignoré. En revanche,
    79 fichiers n'ont jamais démarré : `Failed to start forks worker … Timeout waiting for worker to
    respond`. Ce ne sont pas des échecs de test. Le processus de test reste bloqué en attente de
    lecture disque (`p9_client_rpc`, le système de fichiers de WSL) au-delà du délai fixe de 60 s de
    Vitest. Des fichiers sans rapport avec la story (`theme.test.ts`, `association-mark.test.tsx`)
    échouent de la même façon.
  - **Projet `server` complet** (`--project=server --maxWorkers=2`) : 35 fichiers, 808 tests passent,
    1 ignoré. Cela inclut `rate-limit-service.test.ts` (31), `association-settings-rules`,
    `association-settings-service` et `contact-message-service`.
  - **`contact/actions.test.ts` et `contact/contact-form.test.tsx`** : 23 tests passent.
  - **`rate-limit-repository.test.ts` et `tenant-settings-seed.test.ts`** : 7 tests passent, lancés
    avec `--environment=node` car ils ne touchent pas au DOM et le démarrage en jsdom échouait.
  - **`association-settings-form.test.tsx`** : vert lors d'une exécution ciblée (8 fichiers, 211
    tests).
  - **`magic-link-integration.real-i18n.test.ts`** : n'a pas pu démarrer. Il mocke la façade et le
    diff ne le touche pas.
  - **`tsc --noEmit`** : OK. **eslint sur les fichiers touchés** : OK. **`pnpm check:rules`** : OK.
  - **Script de purge** : exécuté contre la base de dev, qui n'a pas encore la migration. Il liste les
    associations puis échoue en SQL sur `column window_start does not exist`, dans une transaction
    annulée, donc sans aucune écriture.
  - **e2e non exécutés.** Les bases `asl_cms_test` et `asl_cms` sont partagées avec `main` et le
    worktree s09, et n'ont pas les migrations 0022/0023 (colonne `day`). Les migrer casserait les
    autres worktrees. S'y ajoute un build de production trop lourd pour ce CPU.
  - **Ce qui n'est donc prouvé nulle part en local** : l'efficacité réelle de la purge sous RLS
    forcée, sur deux associations (critère 3). `e2e/rate-limit.spec.ts` et `e2e/magic-link.spec.ts`
    doivent être verts en CI avant le merge.
- [x] **Les assertions fixent bien les critères** :
  - **Critère 1** : seuil lu dans les réglages et pas en dur, refus au-delà, autre IP qui passe, seuil
    relu à chaque envoi (e2e), ordre validation → quota → écriture vérifié par `invocationCallOrder`.
  - **Critère 2** : HMAC de 64 caractères hexadécimaux qui ne contient pas l'IP, empreintes
    différentes par association et par usage, IP jamais transmise au service des messages, contrôle
    SQL `::text like` sur les deux tables.
  - **Critère 3** : purge unitaire avec seuil à maintenant − 24 h, un scope par association,
    `withRlsBypass` jamais appelé. En e2e : empreintes de 25 h et de 1 h, sur les associations A et B,
    purgées par le script puis par une soumission.
  - **Non-régression de s03** : l'empreinte est recalculée à la main avec la chaîne d'usage
    d'origine.

## Régressions

- [x] **Aucun impact bloquant sur les chemins existants.**
  - Le quota de lien de connexion garde sa signature et son comportement : fenêtre à minuit à Paris,
    purge sous minuit.
  - `ContactFormState` n'a qu'un seul consommateur.
  - La clé `rateLimit` n'est utilisée qu'à un seul endroit.
  - La nouvelle clé du registre s'affiche dans « Réglages », ce qui est testé.
  - Seule réserve : le constat 1, un cas limite annuel.

## Constats

1. **minor** — `src/services/rate-limit-service.ts` et `docs/architecture.md`. L'invariant documenté
   (« chaque purge n'efface que des fenêtres déjà closes pour tous les usages ») est faux pendant la
   dernière heure du jour du passage à l'heure d'hiver, un jour de 25 h (le 25/10/2026 par exemple, de
   23:00 à 24:00 heure de Paris).
   - Pendant cette heure, maintenant − 24 h dépasse minuit du jour courant. Une soumission sur
     `/contact`, ou le script de purge, efface alors le compteur du jour du lien de connexion.
   - Effet : permissif, une heure par an, un lot de N demandes de plus.
   - Correction : prendre `min(now − 24 h, dayWindowStartOf(now))` comme seuil, ou corriger le texte
     de l'invariant.
2. **minor** — `src/app/[locale]/(public)/contact/actions.ts` et le service. Chaque adresse IPv6
   complète est un visiteur distinct : quelqu'un qui dispose d'un /64 contourne le seuil sans effort.
   - Le plan ne le traite pas.
   - À regrouper par préfixe /64 dans une story future (s10 ou s12b), pas à combler ici.
3. **minor** — `messages/en.json` et `messages/es.json` sont modifiés alors que le plan ne cite que
   `fr.json` (ADR 008 : français seul).
   - Petit écart de périmètre, inoffensif : il remplace l'ancienne clé `{seconds}` qui n'était plus
     utilisée.
4. **minor** — `docs/architecture.md` n'est pas au format Prettier : seul l'alignement du tableau des
   tables diffère.
   - La CI ne lance pas `pnpm format`, donc rien ne bloque.
5. **minor** — `purgeExpiredRateLimitFingerprintsService` s'arrête à la première association en
   échec, et les suivantes ne sont pas purgées lors de ce passage.
   - À garder en tête quand s12b branchera le déclencheur quotidien.
6. **minor** — `rate-limit-service.ts` exporte des éléments internes (`fingerprintOf`,
   `dayWindowStartOf`, `hourWindowStartOf`) pour les tests.
   - L'intercepteur les enveloppe en fonctions asynchrones, ce qui ment sur le type si un jour ils
     sont appelés par la façade. Ce n'est pas le cas aujourd'hui.

**Remarque, pas un défaut** : la purge de s03, dont le seuil est minuit, efface aussi des empreintes
`contact.ip` de moins de 24 h dont la fenêtre horaire est close. Le plan l'a validé (décision A), et
cela va dans le sens de la vie privée.

## Verdict

Max severity: minor
Ship allowed: yes
