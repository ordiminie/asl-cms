# Revue : story s03-connexion-lien-magique (troisième passe, après `2c8ea4d` et `8b1346f`)

> Revue faite à contexte neuf. Chaque problème est classé critique, majeur ou mineur.
>
> **Diff relu** : `git diff main...feature/s03-connexion-lien-magique`. Il compte 6 commits et 86 fichiers. L'examen porte surtout sur `2c8ea4d` (migration) et `8b1346f` (correctifs de revue).
>
> **Références** :
>
> - `docs/plans/s03-connexion-lien-magique.md` (validated: yes) ;
> - AGENTS.md ;
> - ADR 001 à 017 ;
> - `docs/design-system.md` et `docs/designs/s03-connexion-lien-magique.md` ;
> - la deuxième passe (`3fd6b36`, qui bloquait le ship).
>
> **État de l'arbre** : aucune modification pendant la revue. `git status` est propre à la fin.
>
> **Historique** : la première passe (`5cb5157`) autorisait le ship ; la CI a ensuite échoué au build de production (cycle d'import). La deuxième passe (`3fd6b36`) bloquait le ship (`check:rules` en échec). Les décisions du product owner du 2026-09-19 : révoquer l'ancien lien, ajouter une limitation simple dans s03, tout corriger dans ce tour.

## Conformité au plan

- [x] Les huit tâches du plan sont faites, comme l'ont établi les passes précédentes.
- [ ] **Le diff dépasse le plan, et le plan n'a pas été amendé.** Voici ce qui manque au plan :
  - la limitation de débit : table `rate_limit_event`, migrations 0008 et 0009, service, repository, façade, intercepteur, validation ;
  - deux nouveaux réglages affichés dans la page « Réglages » du bureau ;
  - la révocation des liens précédents.

  Le plan validé écrit au contraire « Budget quotidien : s26, pas ici ». Sa liste de fichiers ne contient aucune migration ni la page Réglages. Ni la recherche ni le plan n'ont été mis à jour : seuls `docs/architecture.md` et le design s03 l'ont été. La décision vient du product owner, mais le plan est le contrat de la story et il ne la porte pas. C'est le constat majeur n° 3.

## Vérification des cinq correctifs annoncés

### 1. `pnpm check:rules` (critique en deuxième passe) : **corrigé**

`pnpm check:rules` lancé par le relecteur répond « Règles et documentation alignées sur le code », avec le code 0. Les deux copies `.mdc` ont été régénérées.

### 2. Cycle d'import (majeur en deuxième passe) : **corrigé**

- `magic-link-integration.ts` charge les quatre façades par `import()` à l'appel, dans `loadServices`. Il n'y a plus d'import statique vers la couche service.
- **Le parcours du graphe fait par le relecteur** confirme la correction. C'est un script jetable par expressions régulières, donc une méthode différente de l'arbre syntaxique du test :
  - la fermeture statique de l'intégration compte 28 modules (modèles, `tenant-scope`, `env`, `logger`, types de domaine) ;
  - elle **n'atteint ni `auth.ts` ni l'intégration elle-même**.
- **Le test de garde a du sens.** `magic-link-integration-imports.test.ts` parcourt l'arbre syntaxique avec le compilateur TypeScript. Il écarte les imports de type et les `import()`, et suit les `export … from`. Un premier test vérifie que le parcours fonctionne : `auth.ts` atteint bien l'intégration. Casser la correction, en remettant un import statique de façade, le ferait échouer.
- **Hors du diff** : le parcours montre un cycle qui existe déjà sur `main` (`auth.ts`, `user-service-facade`, `user-service`, `auth.ts`). Il n'est pas imputable à s03 : signalé sans être compté.
- `pnpm build` passe (exit 0) et `/sitemap.xml` est prérendu (○). Le seul avertissement Turbopack (`blog.server.ts`) existait déjà.

### 3. `POST /api/auth/sign-in/magic-link` en direct (majeur en deuxième passe) : **corrigé**

Points vérifiés dans Better Auth 1.7.1 :

- **`disabledPaths` ne joue que dans le routeur HTTP.** Il est lu dans `onRequest` du routeur (`better-auth/dist/api/index.mjs:164-166`), qui répond 404. Un appel `auth.api.signInMagicLink` ne passe pas par ce routeur : l'action serveur fonctionne donc toujours.
- **Le contournement par barre oblique finale est fermé.** `normalizePathname` retire les barres obliques finales (`@better-auth/core/dist/utils/url.mjs:21`).
- **La vérification du lien reste ouverte.** `/magic-link/verify` n'est pas dans la liste.
- **Les tests couvrent le correctif.** Un test de contrat avec un vrai `betterAuth` et `memoryAdapter` vérifie la fermeture HTTP, et que l'appel serveur comme la vérification HTTP restent ouverts. Un e2e attend 404 et aucun message dans la boîte de sortie.

### 4. « Le précédent ne fonctionne plus » (majeur en deuxième passe) : **corrigé, le texte est désormais vrai**

- **Format réel des lignes.** Le plugin écrit `value: JSON.stringify({email, name: ctx.body.name})` (`plugins/magic-link/index.mjs`). `name` n'est jamais fourni par nos actions : `JSON.stringify` l'omet et donne `{"email":"…"}`, ce qui correspond exactement à ce que le code supprime.
- **La casse de l'adresse ne pose pas problème.** `createMagicLinkRequestSchema` fait `trim().toLowerCase()` avant l'appel : l'adresse stockée et l'adresse de révocation sont les mêmes.
- **L'opérateur `ne` existe.** L'adaptateur Drizzle le traduit en `ne(...)` (`@better-auth/drizzle-adapter/dist/index.mjs:152`). `ctx.context.adapter` est bien un `DBAdapter` (`core/dist/types/context.d.mts:265`).
- **Aucun autre type de vérification n'est touché.** La réinitialisation de mot de passe stocke `identifier = reset-password:<jeton>` et `value = <userId>`. La vérification d'email utilise un JWT, sans ligne. Rien d'autre ne peut avoir la valeur exacte `{"email":"…"}`.
- **La révocation ne s'exécute qu'au bon moment** : seuil non atteint, adresse connue, et juste avant l'envoi.
- **Les tests couvrent le correctif** : contrat réel (le premier lien est refusé, le second ouvre la session ; les liens d'une autre adresse ne sont pas touchés) et e2e.

### 5. Limitation de débit côté serveur (majeur en deuxième passe) : **en place, mais contournable** (voir les constats majeurs n° 1 et 2)

**Locataires et RLS : conforme.**

- La table porte `organization_id` (clé étrangère avec suppression en cascade).
- La migration 0009 active la RLS, la force (`ENABLE` et `FORCE ROW LEVEL SECURITY`) et crée la policy `tenant_isolation`, sur le modèle de 0007.
- Le repository passe uniquement par `getDb()`, et le service ouvre `withTenant(organizationId, …)`. Aucun `withRlsBypass` ni `db` direct n'apparaît dans le diff.
- Les droits du rôle `asl_app` en CI couvrent la nouvelle table grâce aux `ALTER DEFAULT PRIVILEGES`.
- Un e2e croisé prouve l'isolation : une ligne de A est invisible depuis B, et une écriture de A depuis B est refusée par la RLS.

**Migration : conforme à « Database Migration Safety ».**

- `drizzle-kit check` répond « Everything's fine ».
- La chaîne des snapshots est cohérente : 0007 → 0008 → 0009 (`prevId`).
- 0009 est identique à 0008 à l'ordre des clés près (migration `--custom`). Le journal compte deux entrées.
- `pnpm db:check` ne vérifie que la connexion et le rôle. Il n'apporte rien ici et n'a pas été lancé sur la base locale.

**Énumération des comptes : protégée.**

- La demande est comptée **avant** la recherche du compte, et une adresse inconnue est comptée aussi.
- Au-delà du seuil, le code s'arrête avant la recherche du compte : l'écran B reste le même, avec le plancher de 1,5 s de l'action.
- Une erreur de base lève une exception avant la recherche du compte. L'action rend alors `unavailable` : même réponse que l'adresse soit connue ou non.
- Sur un domaine inconnu, rien n'est compté ni envoyé.

**Valeurs en dur (ADR 010) : conforme.**

- Les seuils (5 et 30) sont des réglages du registre (ADR 016), bornés et entiers.
- La fenêtre d'une heure est l'unité du réglage (« par heure »), et les 24 h de rétention viennent du PRD.
- Les empreintes sont des HMAC-SHA256 calculés avec `BETTER_AUTH_SECRET`, salés par l'association et le seau. Ni l'adresse ni l'IP ne sont stockées en clair, et l'intercepteur ne journalise pas les arguments.

**Réglages du bureau et design system : conforme.**

- Les deux seuils s'affichent par le registre, avec le `NumberControl` existant : `font-mono tabular-nums`, unité écrite à droite. C'est la ligne « Nombre » du design system (§ tableau des champs, `docs/design-system.md:541`). Aucun composant ni jeton nouveau.
- Les libellés existent dans les trois langues, et un test le vérifie.
- Le design s03 documente l'état « Seuil atteint » : même écran B.

## Anti-hallucination

- [x] Aucune API inventée. Chaque cible a été ouverte :
  - Better Auth : `disabledPaths` (type et routeur), `ctx.context.adapter.deleteMany`, l'opérateur `ne`, le format `value` du plugin ;
  - `createServiceInterceptor(…, {shouldLogDetails})` ;
  - `ValidationParsedZodError`, `getAssociationSettingsService`, `findDefinition` ;
  - `withTenant` et `getDb` ;
  - `NumberSettingDefinition` (`min`, `max`, `integer`, `unitKey`, qui existaient déjà).
- [ ] **Une affirmation plausible mais inexacte** : « IP du visiteur : première entrée de `x-forwarded-for` ». Cette entrée est fournie par le client (constat majeur n° 2).
- [x] Les messages de commit correspondent au code pour les quatre premiers correctifs.

## Conformité aux règles

- [x] ADR 002 et 003 (RLS forcée, `getDb`/`withTenant`, test croisé), ADR 005 et 017, ADR 010 et 016 : respectés.
- [x] Aucun `process.env` hors de `env.ts`.
- [x] Couches respectées : intégration → façades (import paresseux) ; service → service ; service → repository.
- [x] Design system respecté. Les écrans A, B et C n'ont pas changé depuis la première passe, et les réglages utilisent un contrôle existant.
- [ ] Plan non amendé (constat majeur n° 3).

## Tests et vérifications, lancés par le relecteur

- [x] `pnpm test --run` : **68 fichiers passent, 2 sont ignorés ; 781 tests passent, 8 sont ignorés.** Code 0.
- [x] `pnpm build` : exit 0, et `/sitemap.xml` est prérendu.
- [x] `pnpm exec tsc --noEmit`, après le build : 0 erreur.
- [x] `pnpm lint` : 0 erreur. Le seul avertissement vient de `.remember/tmp/last-ndc.ts`, hors du diff.
- [x] `pnpm check:rules` : vert.
- [x] `drizzle-kit check` : OK.
- [ ] `prettier --check` sur les fichiers du diff : 11 fichiers ne sont pas formatés.
  - 3 sont des fichiers `drizzle/migrations/meta` générés. Il ne faut **pas** les reformater à la main.
  - 8 sont des fichiers de `src`. `magic-link-integration.test.ts` est désormais conforme.
- Les e2e n'ont pas été exécutés : le conteneur n'a pas Chromium. La CI les lancera.
- **Assertions.** Les tests du service de limitation couvrent : seuils par défaut et réglés, heure glissante, purge, empreinte stable à la casse près, empreintes différentes selon l'association, refus sans rien compter, identifiant invalide sans toucher la base. Les tests de l'intégration couvrent : adresse inconnue comptée, seuil atteint sans email ni révocation, contrat réel de Better Auth. Aucun test ne porte sur la concurrence (constat majeur n° 1).

## Régressions

- [x] Le build de production est vert, le cycle est rompu, et l'action serveur `auth.api.signInMagicLink` fonctionne toujours.
- [x] L'e2e `association-settings.spec.ts` ne compte pas les champs de la page Réglages : les deux nouveaux champs ne le cassent pas.

## Constats

### Nouveaux (`2c8ea4d`, `8b1346f`)

- **majeur** — `src/services/rate-limit-service.ts:93-110` : **le compte et l'insertion ne sont pas atomiques.**
  - `withTenant` ouvre une transaction en READ COMMITTED sans verrou. N demandes parallèles pour la même adresse lisent toutes `used < limit`, puis insèrent toutes.
  - Les actions serveur sont des points d'entrée publics qu'on peut appeler en parallèle, et le plancher de 1,5 s n'empêche pas le parallélisme.
  - Le seuil par adresse et le seuil par accès internet se contournent donc en rafale : bombardement d'une boîte, consommation du plafond Brevo.
  - Correctif : `select pg_advisory_xact_lock(hashtext(<association> || <seau> || <empreinte>))` dans la transaction, avant le compte, ou bien insérer d'abord puis compter, et annuler au-delà du seuil. Ajouter un test.
- **majeur** — `src/lib/better-auth/magic-link-integration.ts:107` (`requestIpOf`) : **le seuil par accès internet repose sur la première entrée de `x-forwarded-for`, que le client fournit.**
  - Next ne pose `x-forwarded-for` que s'il est absent (`next/dist/server/base-server.js:612`, `??=`).
  - Un proxy qui ajoute sa propre entrée, comme le `$proxy_add_x_forwarded_for` classique de nginx, laisse passer en tête la valeur forgée.
  - Aucune configuration du proxy inverse dans le dépôt ni dans `docs/architecture.md` ne garantit l'écrasement.
  - Conséquences : un attaquant change d'« IP » à chaque demande et le seuil par accès tombe. Il reste le seuil par adresse, 5 par heure, soit environ 2 000 envois par heure sur les quelque 400 adresses connues : très au-delà des 300 envois par jour.
  - À l'inverse, forger l'IP d'une salle bloque tout un réseau.
  - Correctif : lire l'entrée posée par le proxy de confiance (la plus à droite, ou un nombre de sauts de confiance dans `@/env`), et documenter l'hypothèse sur le proxy.
- **majeur (processus)** — `docs/plans/s03-connexion-lien-magique.md` : **la limitation de débit et la révocation ne figurent pas dans le plan validé.**
  - Ce qui manque : migration, table métier, service, deux réglages visibles du bureau.
  - Le plan dit même le contraire (« Budget quotidien : s26, pas ici »). La recherche n'a pas été mise à jour non plus.
  - Correctif : amender le plan (tâches 9 et 10, fichiers, stratégie de test) et le faire revalider au point de contrôle humain.
- **mineur** — `magic-link-integration.ts:149` : **deux demandes concurrentes pour la même adresse peuvent se révoquer l'une l'autre.** Chacune supprime les lignes différentes de la sienne : deux emails partent, et aucun lien ne fonctionne. Le cas est peu probable, et le délai de renvoi de 60 s côté interface l'atténue.
- **mineur** — `rate-limit-service.ts:94` : **la purge ne s'exécute qu'à la prochaine demande de la même association.** Si l'association ne reçoit plus de demande, ses empreintes survivent au-delà de 24 h. La règle « purgée sous 24 h » du PRD n'est donc pas strictement tenue. Correctif possible plus tard : une tâche `scheduled_job` (ADR 006).
- **mineur** — Registre, les deux seuils : **pas de `whenEmptyKey`.** Un champ vidé n'indique pas qu'il revient à 5 ou à 30.
  - L'aide ne dit pas non plus que le seuil par adresse permet à un tiers de bloquer une adresse pendant une heure.
  - Ce compromis est inhérent au seuil par adresse. Il mérite d'être écrit.
- **mineur** — Formatage : 8 fichiers de `src` du diff ne passent pas `prettier --check` (`magic-link-login.tsx`, `magic-link-email.tsx`, `get-email-transport.ts` et des tests). Les fichiers `drizzle/migrations/meta` générés sont à laisser tels quels.

### Constats de la deuxième passe

- **critique** — `check:rules` en échec : **corrigé.**
- **majeur** — Cycle d'import déplacé et non rompu : **corrigé**, avec une vraie garde sur le graphe d'imports.
- **mineur** — `magic-link-integration.test.ts` non formaté : **corrigé.**
- **mineur** — Fixtures `tenant(...)` castées `as never` : **corrigé.** Les fixtures sont désormais de type `Organization`. `getUserByEmailDao` reste casté `as never`, ce qui est sans conséquence.

### Constats de la première passe

- **majeur** — Endpoint HTTP direct : **corrigé.**
- **majeur** — Pas de limitation côté serveur : **corrigé, avec réserves** (voir les deux nouveaux constats majeurs).
- **majeur** — Texte « Le précédent ne fonctionne plus » faux : **corrigé** (révocation réelle).
- **mineur** (ouvert) — Le cadre de `(auth)/layout.tsx` dégrade `register`, `auth-error`, `verify-request/recovery` et `loading`.
- **mineur** (ouvert) — `registerMagicLinkAction` est une impasse silencieuse avec `disableSignUp`. Elle consomme en plus le quota désormais.
- **mineur** (ouvert) — `requestMagicLinkAction` ne vérifie pas `NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')`.
- **mineur** (ouvert) — Écart au plan dans `e2e/auth.spec.ts` : le test « login pages do not offer sign-up » en remplace un autre.
- **mineur** (ouvert) — Test tautologique « même résultat, adresse connue ou non » dans `action.test.ts`.
- **mineur** (ouvert) — Expéditeur par défaut `onboarding@resend.dev` (`email-service.ts:38`, `env-schemas.ts:93`).
- **mineur** (ouvert) — Code mort `magic_link` dans `notification-service.ts:200` et `:346`.
- **mineur** (ouvert) — Au renvoi, un résultat `invalid` affiche l'alerte « service en panne ».

## Verdict

Les cinq correctifs sont réels et vérifiés dans le code de Better Auth 1.7.1 comme dans le nôtre :

- **CI** : `check:rules` repasse au vert et le build reste vert ;
- **cycle d'import** : il est rompu pour de bon, avec une garde qui porte sur l'invariant ;
- **endpoint HTTP** : il est fermé sans toucher à l'action ni à la vérification du lien ;
- **révocation** : elle est exacte, limitée aux liens magiques de l'adresse ;
- **nouvelle table** : elle respecte l'isolation par tenant (RLS forcée, `getDb`/`withTenant`, e2e croisé, migration générée et cohérente).

Il reste deux faiblesses sérieuses dans la limitation de débit elle-même : le compte n'est pas atomique, et l'IP est lue dans un en-tête que le client contrôle. S'y ajoute un plan qui n'a pas suivi le périmètre ajouté. Ces trois points sont majeurs mais circonscrits : aucun ne casse un chemin existant ni ne fait fuiter de données entre associations. Il faut les traiter au prochain cycle, en commençant par le verrou et la source de l'IP.

Max severity: major
Ship allowed: yes
