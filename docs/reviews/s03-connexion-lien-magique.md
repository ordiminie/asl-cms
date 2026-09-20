# Revue : story s03-connexion-lien-magique (septième passe, après `fc0ff7c`)

> Revue faite à contexte neuf. Chaque problème est classé critique, majeur ou mineur.
>
> **Diff relu** : `git diff main...feature/s03-connexion-lien-magique`, 13 commits. L'examen porte sur `fc0ff7c` (6 fichiers, +192/−6), qui répond à l'échec CI survenu après la sixième passe.
>
> **Références** : `docs/plans/s03-connexion-lien-magique.md` (`validated: yes`), AGENTS.md, ADR 001 à 017 (dont 002, 005, 008, 010, 016, 017), `docs/design-system.md`, `docs/designs/s03-connexion-lien-magique.md`.
>
> **Historique** : 1ʳᵉ passe ship autorisé puis CI en échec (cycle d'import) ; 2ᵉ bloquée (`check:rules`) ; 3ᵉ autorisée, trois majeurs sur la limitation ; 4ᵉ autorisée après simplification (3 demandes par adresse et par jour) puis CI en échec (email en anglais) ; 5ᵉ bloquée (correctif de locale sans effet) ; 6ᵉ autorisée puis CI en échec (429 du limiteur de Better Auth).
>
> **État de l'arbre** : le relecteur n'a modifié aucun fichier suivi. `git status` est **propre** à la fin, et **rien n'a changé sous `drizzle/migrations/meta`**. La sonde de falsification vit uniquement dans le scratchpad, hors du dépôt.

## Conformité au plan

- [x] Tâches 1 à 11 toujours cochées et faites (établi aux passes précédentes, inchangé).
- [x] **Le plan porte l'amendement** « Seuil de débit de l'ouverture du lien (après la sixième revue) » : cause (429 en CI), mécanique du plugin, raisonnement d'entropie, nom de la constante, nature « garde d'infrastructure » et non réglage d'association. « Files touched » est complété avec les cinq fichiers du commit.
- [x] Aucune dérive : `fc0ff7c` ne touche que la constante, l'option, ses trois tests, la spec e2e, l'architecture et le plan. Aucun rendu, aucune migration, aucun réglage.
- Observation — la tâche 3 du plan énumère littéralement `magicLink({expiresIn, disableSignUp, sendMagicLink})` et n'a pas été mise à jour avec `rateLimit`. L'amendement final le dit explicitement ; c'est la convention du document depuis la 4ᵉ passe. Sans conséquence.

## Anti-hallucination

- [x] **L'option existe vraiment et est réellement lue, vérifié dans `node_modules` (better-auth 1.7.1)** — `dist/plugins/magic-link/index.mjs` l. 197-203 :

  ```js
  rateLimit: [
    {
      pathMatcher(path) {
        return (
          path.startsWith('/sign-in/magic-link') ||
          path.startsWith('/magic-link/verify')
        )
      },
      window: opts.rateLimit?.window || 60,
      max: opts.rateLimit?.max || 5,
    },
  ]
  ```

  Le type l'expose (`index.d.mts` l. 55 : `rateLimit?: {window: number; max: number}`), le défaut documenté est bien `{60, 5}`, et le `pathMatcher` couvre bien **les deux** routes annoncées. Rien d'inventé.

- [x] **La règle du plugin gagne bien sur les règles par défaut** (`api/rate-limiter/index.mjs`, `resolveRateLimitConfig`) : la règle spéciale `/sign-in*` (3 par 10 s) est posée d'abord, puis la boucle sur les plugins l'écrase. L'ordre décrit par le commit est le bon.
- [x] **Les nouveaux tests exercent le vrai routeur HTTP, et ils tombent sans l'option — sonde exécutée.** Copie autonome dans le scratchpad (aucun fichier suivi touché), même montage `betterAuth + memoryAdapter + rateLimit{enabled:true, storage:'memory'}`, avec et sans `magicLink({rateLimit})` :

  ```
  SANS option (défaut 5/min)  | 5 premiers: 302,302,302,302,302 | 6e: 429 | sessions: 0
  AVEC option {60,30}         | 5 premiers: 302,302,302,302,302 | 6e: 302 → /dashboard | sessions: 1
  première requête bloquée au rang : 31
  ```

  Les deux essais ajoutés fixent donc réellement le critère : le premier échoue si l'option disparaît (429 au lieu d'une session), le second cale exactement sur le seuil (30 passent, la 31ᵉ est refusée). Filet réel, pas un double.

- [x] **Isolation des essais correcte** : le magasin `memory` du limiteur est une `Map` de **module** (`getRateLimitStorage`), donc globale au processus — le commentaire du test dit vrai, et l'IP propre à chaque essai est nécessaire. Les essais de contrat préexistants montent leur instance avec `rateLimit: {enabled: false}` : aucune contamination croisée.
- [x] **La clé du compteur est bien `${ip}|${path}`** (`createRateLimitKey`), donc `/sign-in/magic-link` (déjà 404 par `disabledPaths`) et `/magic-link/verify` ont des compteurs séparés. Pas d'effet de bord entre les deux routes.
- [ ] **Chiffre d'entropie inexact** — le plugin appelle `generateRandomString(32, "a-z", "A-Z")` : alphabet de **52** symboles, **lettres seulement**. Donc ~**182 bits**, pas 190, et « alphanumériques » est faux (aucun chiffre). La conclusion ne bouge pas d'un iota (la force brute reste hors de portée), mais le chiffre est répété à l'identique dans trois documents. Mineur.
- [x] Le message de commit décrit fidèlement le diff, y compris la limite « la spec e2e donne en plus une IP propre à chaque contexte ».

## Conformité aux règles et aux ADR

- [x] **ADR 010 (« rien en dur ») n'est pas contredit.** L'ADR vise les données propres à l'association — adresses, catégories, seuils **métier**, textes — et exige qu'elles vivent dans `organization_setting`. Un plafond HTTP attaché à la mécanique de Better Auth n'est pas une donnée d'association et n'aurait aucun sens dans un back-office de bureau. Le seuil métier de la story, lui, reste bien un réglage (`login.link_requests_per_address_per_day`, défaut 3, bornes 1-20) — inchangé et toujours prouvé. La constante est du même registre que `MAGIC_LINK_EXPIRES_IN_SECONDS`, accepté aux passes précédentes. Classement défendable.
- [x] **ADR 002 (multi-tenant)** : rien de touché. `rate_limit_event` garde sa RLS **forcée** et sa policy `tenant_isolation` (`0009_rate_limit_event_rls.sql`), le repository passe par `getDb()` et le service par `withTenant(organizationId, ...)`. Aucune nouvelle occurrence de `withRlsBypass()` dans le diff.
- [x] **Révocation, `disabledPaths`, quota journalier, chaîne de locale, garde d'imports paresseux : intacts.** `revokeEarlierMagicLinks` et `consumeMagicLinkRequestQuotaService` ne sont pas touchés ; `MAGIC_LINK_DISABLED_HTTP_PATHS` inchangé ; `magic-link-constants.ts` n'importe rien, donc l'arête ajoutée dans `magic-link-integration.ts` ne peut créer aucun cycle (vérifié aussi par `magic-link-integration-imports.test.ts`, vert).
- [x] **Design system / design s03** : `fc0ff7c` ne change aucun rendu (aucun fichier de `src/app` ni `src/components` dans le commit).
- [x] `pnpm check:rules` : « Règles et documentation alignées sur le code ».

## Tests et vérifications, lancés par le relecteur

- [x] `pnpm test --run` : **71 fichiers passent, 2 ignorés ; 803 tests passent, 8 ignorés.** Code 0. (800 → 803 : exactement les trois essais ajoutés.)
- [x] `pnpm vitest --run --project i18n` : **4 fichiers, 41 tests**, verts (38 → 41). La chaîne de locale réelle ne régresse pas.
- [x] Sonde de falsification (scratchpad) : voir ci-dessus, le comportement tombe sans l'option.
- [x] `pnpm build` : **exit 0**, aucun avertissement nouveau. La fin du tableau des routes montre toujours `◐` pour `team/[slug]` et `○` pour `/robots.txt` et `/sitemap.xml` : aucun prerender perdu.
- [x] `pnpm exec tsc --noEmit` : 0 erreur (l'option `rateLimit` est acceptée par le type du plugin ; le `{...CONSTANTE}` est nécessaire, la constante étant `as const`).
- [x] `pnpm lint` : 0 erreur (1 avertissement dans `.remember/tmp/last-ndc.ts`, fichier non suivi, hors diff).
- [x] `prettier . --check` : **les mêmes 9 fichiers qu'à la 6ᵉ passe**, aucun de plus. Les deux fichiers créés/modifiés par `fc0ff7c` sont, eux, bien formatés.
- [x] **Les assertions du quota journalier ne sont pas affaiblies** : l'essai « 4ᵉ demande du jour » demande toujours trois liens puis un quatrième et exige `newMessagesTo(...)` vide ; il passe par la Server Action (donc `auth.api.signInMagicLink`, hors routeur HTTP), le limiteur de Better Auth n'y joue aucun rôle. L'essai d'isolation tenant de `rate_limit_event` est inchangé.
- [x] **L'`x-forwarded-for` forgé en e2e ne masque aucun défaut produit** : le quota du produit est indexé sur `HMAC(organization_id, usage, email)`, **jamais sur une IP** — et un test unitaire le cloue explicitement (« compte la demande pour l'association du domaine, par adresse seulement : aucune IP lue », avec un `x-forwarded-for` à deux sauts). Les seuls autres lecteurs de l'en-tête (`contact/actions.ts`, `user/action.ts`) sont hérités du boilerplate, hors diff et non sollicités par cette spec. Le tenant, lui, vient de `x-forwarded-host`/`host`, pas de `x-forwarded-for`.

### E2E : ce que le relecteur a fait exactement

Il a **tenté** la suite en reproduisant le mode CI (`CI=1`, base de `.env.test`, `EMAIL_TRANSPORT=file`, variables `NEXT_PUBLIC_AUTH_METHODS` et `NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION` du job), donc `pnpm build && pnpm start` comme la CI, et **non** `pnpm dev` que `playwright.config.ts` lance sans `CI`.

Résultat : **2 réussites, 5 échecs d'environnement**, en 4,3 min.

- **Passent réellement**, et ce sont les deux qui ne demandent pas de navigateur :
  - « la demande de lien en HTTP direct est fermée » → `POST /api/auth/sign-in/magic-link` répond bien **404** sur le build de production, sans rien émettre (`disabledPaths` prouvé bout en bout) ;
  - « les compteurs de A ne sortent ni ne s'écrivent depuis B » → la RLS forcée de `rate_limit_event` est prouvée contre le vrai Postgres.
- **Échouent pour une raison hors produit** : `chrome-headless-shell: error while loading shared libraries: libnspr4.so`. `ldd` liste **dix** bibliothèques manquantes. `npx playwright install-deps chromium` échoue faute de root.

Sur la **revendication de l'implémenteur** (« 7/7 sur `magic-link.spec.ts` et 81/81 sur toute la suite, contre un build de production ») : le relecteur ne peut pas la reproduire, mais la trouve **corroborée par des traces matérielles** :

- `~/.cache/ms-playwright/chromium-1234/` porte `INSTALLATION_COMPLETE` et `DEPENDENCIES_VALIDATED` horodatés avant le commit ;
- la boîte de sortie partagée contient **38 messages**, dont **32 à `user-owner@gmail.com`** (l'adresse connue de la spec, ~8 par exécution complète), 3 aux inscriptions de `auth.spec.ts` et 3 au formulaire de contact — la signature d'au moins une suite complète ;
- la base de test porte encore les organisations créées par ces inscriptions.

Ce qui **reste non vérifié** : que ces exécutions aient tourné sur un **build de production**. Le point n'est pas théorique — le limiteur de Better Auth est `enabled: options.rateLimit?.enabled ?? isProduction` : en `pnpm dev`, il n'existe pas. Le juge de paix reste la CI de la PR, mais le seuil lui-même est prouvé en unitaire sur le vrai routeur.

## Le seuil de 30/60 s est-il une posture défendable ?

Oui sur le fond, avec une réserve importante sur la manière dont il est documenté.

- **Ce que le compteur protège** : le martèlement de `GET /api/auth/magic-link/verify`. Une tentative invalide ne fait qu'une lecture de `verification` puis une redirection vers l'écran C — aucun envoi d'email, aucune écriture coûteuse.
- **Ce qu'un attaquant gagne en passant de 5 à 30** : rien d'exploitable. Le jeton est tiré sur 52 symboles × 32 caractères (~182 bits), à usage unique et valable 20 minutes.
- **Ce que le seuil coûte s'il est trop bas** : c'est le vrai arbitrage. La règle compte par accès internet, or les membres d'une même association partagent souvent une sortie NAT. 5/min les bloque mutuellement — c'est ce qui a cassé la CI.

**La réserve** : « cette règle compte par adresse IP » n'est vraie que si Better Auth résout une IP de confiance — voir le constat majeur.

## Régressions

- [x] Aucune assertion e2e affaiblie : le seul changement de `magic-link.spec.ts` est `freshPage`, qui ajoute un en-tête ; toutes les vérifications sont identiques au caractère près.
- [x] `198.51.100.x` (TEST-NET-2) en e2e et `203.0.113.x` (TEST-NET-3) en unitaire : plages de documentation, aucune collision avec du réseau réel.
- [x] Les essais de contrat Better Auth préexistants passent `rateLimit: {enabled: false}` : ils ne consomment pas le compteur partagé et ne deviennent pas flottants.
- [x] Aucune nouvelle lecture de requête, aucune horloge, rien dans un scope `'use cache'` : le prerender ne bouge pas.
- Observation hors diff, même famille de cause : `auth.spec.ts` enchaîne plusieurs `POST /api/auth/sign-in/email`, route couverte par la règle **par défaut** de Better Auth (3 par 10 s et par IP) et sans en-tête forgé. Elle n'a pas encore mordu et préexiste à la story ; à garder en tête si la CI se remet à échouer par un 429 ailleurs.

## Constats

### Nouveaux (`fc0ff7c`)

- **majeur** — `src/lib/better-auth/auth.ts` + `docs/architecture.md` + `src/lib/better-auth/magic-link-constants.ts` : « la règle compte **par adresse IP** » n'est vraie que sous une condition qui n'est ni remplie ni écrite. Dans better-auth 1.7.1 (`@better-auth/core/dist/utils/ip.mjs`, `getIPFromHeader`), **sans `advanced.ipAddress.trustedProxies`** — absent de `auth.ts` — un `x-forwarded-for` n'est accepté **que s'il ne contient qu'une seule valeur** ; sinon `getIP` rend `null`, et le limiteur retombe sur la clé `no-trusted-ip|/magic-link/verify`, c'est-à-dire **un seul compteur partagé par tous les visiteurs** (la lib le journalise : « falling back to a single shared per-path bucket »). Deux formes de déploiement, deux défauts :
  - reverse proxy qui **ajoute** (`proxy_add_x_forwarded_for`, la recette la plus courante) : n'importe quel visiteur qui envoie son propre `X-Forwarded-For` rend l'en-tête à deux sauts, force le compteur global, et peut alors épuiser les 30/min et **empêcher l'ouverture des liens de connexion pour tous les membres de toutes les associations** pendant la fenêtre — sur l'unique voie de connexion des membres ;
  - reverse proxy qui **transmet** l'en-tête du client tel quel : la limite est contournable à volonté en changeant d'IP déclarée — c'est précisément ce que fait la spec e2e.

  Le défaut **préexiste** au commit (il était pire à 5/min) et ne corrompt rien ; c'est pourquoi il n'est pas bloquant. Mais c'est ce commit qui adosse toute sa justification à « compte par IP » et l'inscrit dans l'architecture sans la condition — et le même document explique deux paragraphes plus haut que « la première entrée de `x-forwarded-for` est fournie par le client », raison pour laquelle le quota produit, lui, n'utilise aucune IP. Les deux affirmations se contredisent. À faire au prochain cycle : déclarer `advanced.ipAddress.trustedProxies` (CIDR du reverse proxy du VPS) et écrire la réserve dans `docs/architecture.md`.

- **mineur** — Entropie annoncée inexacte : `generateRandomString(32, "a-z", "A-Z")` donne 52 symboles, **lettres seulement**, soit ~182 bits. « 32 caractères alphanumériques (~190 bits) » est répété dans `magic-link-constants.ts`, `docs/architecture.md` et le plan. Sans effet sur la conclusion.
- **mineur** — Le 429 n'a pas d'écran. Quand la limite mord, Better Auth renvoie `{"message":"Too many requests. Please try again later."}` en 429, **sans `content-type`** : le membre voit du JSON brut, hors design system. C'est ce qu'a vu la CI. 30/min rend le cas rare, mais le design ne prévoit que l'écran C.
- **mineur** — Ni le plan ni `docs/architecture.md` ne disent que le limiteur est **inactif hors production** (`enabled ?? isProduction`). Conséquence : une exécution e2e locale lancée sans `CI` (donc en `pnpm dev`) n'exerce pas du tout cette garde.
- **mineur** — La preuve e2e du correctif n'est pas établie dans ce conteneur (navigateur inlançable, dix bibliothèques absentes, pas de root). Les traces corroborent la suite annoncée, mais pas qu'elle ait tourné sur un build de production.

### Constats des passes antérieures, toujours ouverts (mineurs, inchangés)

- Deux demandes concurrentes pour la même adresse peuvent se révoquer l'une l'autre (`revokeEarlierMagicLinks`).
- La purge des compteurs ne s'exécute qu'à une demande ultérieure de la même association (piste : `scheduled_job`, ADR 006).
- Pas de `whenEmptyKey` pour `login.link_requests_per_address_per_day`.
- 9 fichiers de la branche ne passent pas `prettier --check` (5 sous `src`, 4 métadonnées Drizzle générées).
- Le cadre de `(auth)/layout.tsx` dégrade `register`, `auth-error`, `verify-request/recovery` et `loading`.
- `registerMagicLinkAction` reste une impasse silencieuse avec `disableSignUp`, et consomme le quota.
- `requestMagicLinkAction` ne vérifie pas `env.NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')`.
- Écart au plan dans `e2e/auth.spec.ts` : « login pages do not offer sign-up » en remplace un autre.
- Test tautologique « même résultat, adresse connue ou non » (`action.test.ts`).
- Expéditeur par défaut `onboarding@resend.dev` ; code mort `magic_link` dans `notification-service.ts` ; au renvoi, un résultat `invalid` affiche l'alerte « service en panne ».
- `0010_long_baron_zemo.sql` ajoute `day date NOT NULL` sans défaut ; trous de test (minuit en heure d'hiver, scope tenant de la purge) ; l'aide du réglage n'indique ni le défaut ni le compromis.
- Alias Vitest `next-intl/server` vers un chemin interne au paquet (fragile aux montées de version, mais sans faux vert).

## Verdict

Le correctif est réel, minimal et bien ciblé. L'option `rateLimit` existe vraiment dans better-auth 1.7.1, elle est lue là où le commit le dit, son défaut est bien `{60, 5}`, et son `pathMatcher` couvre bien les deux routes annoncées : rien d'halluciné. Les trois essais ajoutés font tourner le **vrai** routeur HTTP avec le limiteur actif, et la sonde indépendante montre qu'ils tombent dès qu'on retire l'option — le filet est authentique, le seuil cale exactement sur 30 passantes et la 31ᵉ refusée. Le raisonnement de sécurité tient : avec ~182 bits d'entropie, un jeton à usage unique et 20 minutes de validité, le compteur ne protège que du martèlement, et 30/min est un meilleur compromis que 5 pour des membres qui partagent une sortie NAT. Le classement « garde d'infrastructure et non réglage d'association » est conforme à l'ADR 010.

Rien n'a régressé : révocation, `disabledPaths`, quota journalier par adresse (toujours sans aucune IP, et un test le cloue), chaîne de locale (projet `i18n` : 41 tests verts), garde d'imports paresseux, RLS forcée de `rate_limit_event`. Suite unitaire 803/803, build à 0, `tsc` à 0, lint propre, règles alignées.

Le constat majeur ne porte pas sur la valeur 30 mais sur ce qui la justifie : « par adresse IP » n'est vrai que si Better Auth résout une IP de confiance, ce que la configuration actuelle ne garantit pas. Selon la forme du reverse proxy, la règle se contourne à volonté ou se réduit à un compteur unique partagé par tous — auquel cas un visiteur peut fermer l'ouverture des liens pour tout le monde pendant une minute. Le défaut préexiste au commit et était pire avant lui ; il ne bloque pas le ship, mais il doit être traité au prochain cycle (`advanced.ipAddress.trustedProxies`, et la réserve écrite dans l'architecture).

Dernier point qui ne peut pas être tranché ici : l'exécution e2e pilotée par navigateur, faute des bibliothèques système du conteneur. La CI de la PR reste le juge de paix.

Max severity: major
Ship allowed: yes
