# Revue : story s03-connexion-lien-magique (quatrième passe, après `f988987` et `a83ac77`)

> Revue faite à contexte neuf. Chaque problème est classé critique, majeur ou mineur.
>
> **Diff relu** : `git diff main...feature/s03-connexion-lien-magique`, soit 8 commits et 89 fichiers. L'examen porte surtout sur `f988987` (migration 0010) et `a83ac77` (code, tests et docs de la tâche 11).
>
> **Références** :
>
> - `docs/plans/s03-connexion-lien-magique.md` (validated: yes, amendement du 2026-09-19, tâches 9 à 11) ;
> - AGENTS.md et ADR 001 à 017 ;
> - `docs/design-system.md` et `docs/designs/s03-connexion-lien-magique.md` ;
> - la troisième passe (commit `a83ac77`).
>
> **Historique** : première passe (`5cb5157`) ship autorisé, puis build de production en échec en CI (cycle d'import) ; deuxième passe (`3fd6b36`) ship bloqué (`check:rules`) ; troisième passe ship autorisé avec trois majeurs sur la limitation ; le product owner a alors retenu une règle simplifiée (3 demandes par adresse et par jour), tâche 11.
>
> **État de l'arbre** : le relecteur n'a rien modifié. `git status` est propre à la fin, y compris sous `drizzle/migrations/meta`.
>
> **Compromis acceptés par le product owner, non comptés comme constats** :
>
> - un tiers peut épuiser les 3 demandes du jour d'un membre ;
> - il n'y a ni plafond global ni plafond par réseau (budget quotidien et transport de secours : s26).

## Conformité au plan

- [x] **Tâches 1 à 10** : faites, comme l'ont établi les passes précédentes. Il n'y a pas de régression depuis.
- [x] **Tâche 11 : faite, point par point.**
  - Migration **générée** 0010. 0008 et 0009 sont intactes : aucune différence depuis `3fd6b36`.
  - Compteur `(organization_id, fingerprint, day, count)` avec un index unique sur les trois premières colonnes.
  - Incrément atomique et purge des jours passés.
  - Le jour est celui d'Europe/Paris, et le seuil est lu dans le réglage.
  - La clé `login.link_requests_per_address_per_day` vaut 3 par défaut, entre 1 et 20. Elle remplace les deux clés horaires.
  - `requestIpOf` est supprimé.
  - Docs mises à jour : `docs/architecture.md` et l'état « Seuil atteint » du design s03.
  - Tests écrits pour le service, le repository, l'intégration, le registre et en e2e.
- [x] **Le plan porte désormais le périmètre ajouté** (constat de processus de la troisième passe). Il reste quelques phrases périmées dans le plan : voir le constat mineur n° 1.
- [x] **Rien dans le diff de la tâche 11 que le plan ne demande pas.**

## Anti-hallucination

- [x] **Aucune API inventée.** Les cibles ont été ouvertes :
  - Drizzle : `onConflictDoUpdate({target: [...], set})`, `.returning({count})`, `date(…, {mode: 'string'})` et `uniqueIndex`. Le SQL réel est capturé par le test `pg-proxy` : `on conflict ("organization_id","fingerprint","day") do update set "count" = "rate_limit_event"."count" + 1 … returning "count"`.
  - Code du projet : `getDb` et `withTenant` (`src/db/tenant-scope.ts`), `getAssociationSettingsService`, `findDefinition`, `parseNumber` (il rend bien un `number`, donc la branche `typeof value === 'number'` de `numberSettingOf` est prise quand le bureau a réglé une valeur), et `createServiceInterceptor(…, {shouldLogDetails})`.
- [x] **Le calcul du jour à Paris est exact.** Vérifié à la main avec `Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris'})` sous Node 22.23 :
  - le format rendu est bien `YYYY-MM-DD` ;
  - été : `2026-03-29T21:59:59Z` donne le 29, et `22:00:00Z` donne le 30 ;
  - changement d'heure d'octobre : `2026-10-24T22:00:00Z` donne le 25 ;
  - hiver : `2026-10-25T23:00:00Z` donne le 26.
  - Les minuits de Paris tombent juste des deux côtés des changements d'heure.
- [x] **Le comptage est réellement atomique.** C'est un seul `INSERT … ON CONFLICT DO UPDATE … RETURNING`.
  - En READ COMMITTED, deux insertions simultanées sur une clé absente se sérialisent sur l'index unique : la seconde attend, puis passe par la branche UPDATE et lit la valeur à jour.
  - Il n'y a ni lecture préalable ni verrou applicatif.
  - La purge (`DELETE … day < today`) s'exécute dans la même transaction `withTenant`. Deux purges concurrentes se contentent d'attendre l'une l'autre, sans erreur.
- [x] **La base de développement correspond à ce que dit le code.** Inspection en lecture seule avec le rôle `asl_app` (non superutilisateur, sans `BYPASSRLS`) :
  - 0010 est appliquée, avec les colonnes `id, organization_id, fingerprint, day, count` ;
  - l'index `rate_limit_event_counter_idx` est UNIQUE sur `(organization_id, fingerprint, day)` ;
  - `relrowsecurity` et `relforcerowsecurity` valent `true`, et la policy `tenant_isolation` est intacte après l'ALTER ;
  - hors scope, `count(*)` rend 0.
- [x] **Les messages de commit correspondent au code.**

## Conformité aux règles

- [x] **Multi-tenant (ADR 002 et 003) : conforme.**
  - Le repository passe uniquement par `getDb()`, et le service par `withTenant(organizationId, …)`.
  - Aucun `withRlsBypass` n'a été ajouté.
  - Le seul `db` direct du diff est dans `auth.ts` : c'est l'adaptateur Better Auth, qui existe déjà sur `main`.
  - L'e2e croisé est adapté au nouveau schéma (`insert … (organization_id, fingerprint, day)`). Une ligne de A est invisible depuis B, et une écriture de A depuis B est refusée par la RLS.
- [x] **Plus aucune lecture d'IP.** `x-forwarded-for` et `x-real-ip` n'apparaissent plus dans le code de la story, seulement dans un test qui prouve qu'ils sont ignorés. Les autres occurrences, dans `contact/actions.ts` et `user/action.ts`, sont hors du diff et existent déjà sur `main`.
- [x] **Pas d'énumération des comptes.**
  - Ordre des opérations : association du domaine → quota → recherche du compte. Une adresse inconnue est donc comptée aussi.
  - Au-delà du seuil, le code s'arrête avant la recherche du compte.
  - La même action et le même écran B s'appliquent dans tous les cas, avec le plancher de 1,5 s.
  - Une erreur de base lève avant la recherche du compte. Le `catch` générique de `requestMagicLinkAction` rend alors `unavailable`, quelle que soit l'adresse.
- [x] **Migrations (AGENTS.md) : conformes.**
  - 0010 est générée. `drizzle-kit check` répond « Everything's fine ».
  - La chaîne des snapshots est cohérente (le `prevId` de 0010 est l'`id` de 0009).
  - Le journal compte 3 entrées, dans l'ordre.
  - Le commit est séparé, ce qui permet de revenir sur la migration seule.
- [x] **ADR 010 et 016 : conformes.**
  - Le seuil est un réglage du registre, entier, entre 1 et 20, avec 3 par défaut, sur la page `settings`.
  - « Par jour » est l'unité du réglage. Le fuseau Europe/Paris est une constante du service, cohérente avec l'ADR 008 (produit `fr` seul).
  - Les anciennes clés ont disparu du code, des messages (fr, en, es) et de l'e2e. Un test garde leur absence.
- [x] **Design system : conforme.**
  - La page Réglages du bureau rend le nouveau champ avec le `NumberControl` existant (`association-settings-form.tsx:450`, unité `units.requestsPerDay` à droite). Aucun composant ni jeton nouveau.
  - L'écran B est inchangé.
  - L'état « Seuil atteint » est documenté dans le design.
- [x] **Aucun `process.env` hors de `env.ts`.** La direction des couches est respectée.

## Tests et vérifications, lancés par le relecteur

- [x] `pnpm test --run` : **69 fichiers passent, 2 sont ignorés ; 784 tests passent, 8 sont ignorés.** Code 0.
- [x] `pnpm build` : exit 0, et `/sitemap.xml` est prérendu (○). Le seul avertissement Turbopack (`blog.server.ts`) existait déjà.
- [x] `pnpm exec tsc --noEmit`, après le build : 0 erreur.
- [x] `pnpm lint` : 0 erreur. Le seul avertissement vient de `.remember/tmp/last-ndc.ts`, hors du diff.
- [x] `pnpm check:rules` : « Règles et documentation alignées sur le code ».
- [x] `drizzle-kit check` : OK.
- [ ] `prettier --check` : **ce sont les mêmes 8 fichiers `src` qu'en troisième passe**, et aucun ne vient de la tâche 11. Les 4 fichiers `meta` générés sont à laisser tels quels.
- **E2E non exécutés** : le conteneur n'a pas Chromium, la CI les lancera.
  - Le `beforeEach` remet les compteurs à zéro.
  - Le test de la 4ᵉ demande exige un email pour **chacune** des 3 premières (`expect.poll … toBe(1)`), puis aucun pour la 4ᵉ. Il ne peut donc pas passer par un compteur déjà épuisé.
  - Aucune autre spec ne demande de lien.
- **Assertions.** Les tests fixent les critères de la tâche 11 :
  - les 3 premières demandes passent et la 4ᵉ est refusée ;
  - le seuil réglé à 1 est appliqué ;
  - le passage à minuit à Paris (heure d'été) remet le compteur à zéro ;
  - la purge est appelée avec le jour courant ;
  - l'empreinte est stable à la casse et aux espaces près, et distincte selon l'adresse et l'association ;
  - l'adresse n'est jamais transmise en clair ;
  - un UUID invalide ne touche pas la base ;
  - le repository envoie exactement une requête, dont le SQL est vérifié ;
  - l'intégration ne lit aucune IP, compte une adresse inconnue, et au-delà du seuil n'envoie ni email ni révocation.

## Régressions

- [x] La page Réglages accueille un champ numérique de plus, déjà pris en charge. `association-settings.spec.ts` ne compte pas les champs.
- [x] L'action, la révocation, la fermeture HTTP et la garde sur le graphe d'imports ne changent pas. Le build est vert.

## Constats

### Constats de la troisième passe

- **majeur** — Compte et insertion non atomiques : **corrigé.** Le comptage passe par un upsert unique sur un index unique.
- **majeur** — IP lue dans `x-forwarded-for`, fournie par le client : **corrigé.** La limite par réseau et toute lecture d'IP sont supprimées, par décision du product owner.
- **majeur (processus)** — Plan non amendé : **corrigé.** Amendement et tâches 9 à 11 sont au plan, qui a été revalidé. Il reste des phrases périmées : constat mineur n° 1.
- **mineur** (ouvert) — Deux demandes concurrentes pour la même adresse peuvent se révoquer l'une l'autre (`magic-link-integration.ts`, `revokeEarlierMagicLinks`).
- **mineur** (ouvert, reformulé) — **La purge ne s'exécute qu'à une demande ultérieure de la même association.** Les empreintes d'un jour survivent jusqu'à la première demande d'un jour suivant, ce qui ne tient pas strictement le « purgé sous 24 h » du PRD. Correctif possible plus tard : `scheduled_job` (ADR 006).
- **mineur** (ouvert) — **Le registre n'a pas de `whenEmptyKey` pour `login.link_requests_per_address_per_day`.** Un champ vidé n'indique pas qu'il revient à 3.
- **mineur** (ouvert) — **Formatage : 8 fichiers `src` du diff ne passent pas `prettier --check`**, dont `magic-link-login.tsx`, `magic-link-email.tsx` et `get-email-transport.ts`.

### Constats des passes antérieures, toujours ouverts (mineurs)

- **mineur** — Le cadre de `(auth)/layout.tsx` dégrade `register`, `auth-error`, `verify-request/recovery` et `loading`.
- **mineur** — **`registerMagicLinkAction` est une impasse silencieuse avec `disableSignUp`.** Elle existe encore et est testée dans `action.test.ts:52`. Elle consomme en plus le quota journalier de l'adresse.
- **mineur** — `requestMagicLinkAction` ne vérifie pas `NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')`.
- **mineur** — Écart au plan dans `e2e/auth.spec.ts` : le test « login pages do not offer sign-up » en remplace un autre.
- **mineur** — Test tautologique « même résultat, adresse connue ou non » dans `action.test.ts:134`.
- **mineur** — Expéditeur par défaut `onboarding@resend.dev`.
- **mineur** — Code mort `magic_link` dans `notification-service.ts:200` et `:346`.
- **mineur** — Au renvoi, un résultat `invalid` affiche l'alerte « service en panne ».

### Nouveaux (`f988987`, `a83ac77`)

- **mineur** — **n° 1 : phrases périmées dans `docs/plans/s03-connexion-lien-magique.md`**, en contradiction avec la tâche 11 cochée :
  - l. 35 : « limitation des demandes de lien (par adresse et par accès internet) » ;
  - l. 110-111 : « La tâche 11 reste à faire. » ;
  - l. 228 : « (deux réglages) » ;
  - la liste « Files touched » omet `0010_long_baron_zemo.sql` (+ snapshot) et `rate-limit-repository.test.ts`.

  Le premier paragraphe de l'amendement (l. 86-91) est historique et peut rester. Correctif : une passe de relecture sur le plan.

- **mineur** — **n° 2 : `drizzle/migrations/0010_long_baron_zemo.sql:2` ajoute `day date NOT NULL` sans valeur par défaut.** La migration échoue (« column "day" … contains null values ») sur toute base qui aurait appliqué 0008 et contiendrait déjà des lignes.
  - **Risque réel faible** :
    - la table n'existe que sur cette branche non fusionnée ;
    - production et CI (Postgres éphémère) appliquent 0008 à 0010 d'affilée sur une table vide ;
    - la base de développement est déjà migrée (vérifié).
  - Seule une base de preview ou de développement qui aurait fait tourner la branche entre `2c8ea4d` et `f988987` serait touchée.
  - Remède ponctuel : vider `rate_limit_event` avant de migrer. Il ne faut **pas** réécrire 0010.
- **mineur** — **n° 3 : deux trous dans les tests.**
  - Aucun test ne couvre le passage de minuit en heure d'hiver (UTC+1) ni le jour du changement d'heure. Seul l'été est testé. Le relecteur a vérifié le comportement à la main (voir Anti-hallucination), et un cas en `2026-10-25T23:00:00Z` le figerait.
  - Le test du service vérifie que l'incrément s'exécute sous le scope du tenant, pas la purge. Il vérifie seulement ses arguments.
- **mineur** — **n° 4 : l'aide du réglage ne dit ni la valeur par défaut (3) ni le compromis accepté** (un tiers peut épuiser les demandes du jour d'un membre). Le texte actuel « protège la boîte de vos membres » décrit l'avantage sans la contrepartie.

**Pour mémoire, sans constat.** Quand la 4ᵉ demande part du bouton « Renvoyer un lien », l'alerte « Le précédent ne fonctionne plus » s'affiche alors que le lien précédent reste valable. C'est la conséquence voulue du « même écran B » (design s03, état « Seuil atteint ») : le libellé commence par « si l'adresse est enregistrée », et la contradiction est acceptée au design.

## Verdict

La règle simplifiée est implémentée comme le plan amendé la décrit, et vérifiée dans le code comme dans la base :

- le compteur journalier par adresse est atomique (un seul upsert sur un index unique) ;
- le jour est celui de Paris et reste exact aux changements d'heure ;
- les jours passés sont purgés ;
- les adresses inconnues sont comptées, et plus aucune IP n'est lue ;
- l'isolation par tenant est intacte après l'ALTER (RLS forcée, policy conservée, `getDb`/`withTenant`, e2e croisé adapté) ;
- la migration est générée et cohérente (`drizzle-kit check` OK) ;
- les anciennes clés ont disparu partout.

Les trois majeurs de la troisième passe sont corrigés. Tests, build, `tsc`, lint et `check:rules` sont verts chez le relecteur. Il ne reste que des mineurs : phrases périmées du plan, migration 0010 fragile uniquement sur une base intermédiaire, deux trous de test et le reliquat des passes précédentes.

Max severity: minor
Ship allowed: yes
