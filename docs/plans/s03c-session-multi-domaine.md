---
validated: yes
---

# Plan — Story s03c-session-multi-domaine

Branch: `feature/s03c-session-multi-domaine`

Recherche : `docs/research/s03c-session-multi-domaine.md`. Décision : ADR 022. Pas de design : la story
n'a pas d'écran (les écrans et l'email de s03 sont inchangés).

## Target story

**En tant que** membre propriétaire **je veux** que le lien de connexion me ramène sur le site de mon
association **afin d'**ouvrir mon espace là où je l'ai demandé, quelle que soit l'association.

1. Le lien pointe vers le domaine de l'association à laquelle il donne accès, jamais vers une adresse de
   configuration unique : demandé sur A, il mène à A et y ouvre la session ; demandé sur B, il mène à B —
   vérifié sur deux domaines.
2. La session est scopée à l'association du membre : elle ne donne accès à aucune donnée d'un autre tenant.

**Arbitrages du 2026-09-22 (Marie-Ève)** :

- **Non-membre = inconnu** : sur le domaine de B, une personne inscrite sur la plateforme mais sans
  appartenance à B est traitée comme une adresse inconnue — même écran, aucun email.
- **Critère 2 = cookie propre au domaine, prouvé** : une session ouverte sur A n'est jamais valable sur B.
  Les pages héritées du groupe `(app)` (`account/organizations`, `team/[slug]`, `activeOrganizationId`)
  restent **hors périmètre** et sont notées comme reste connu.

## Tasks (ordered)

1. [x] **Origine d'une association** — nouveau module serveur `src/lib/better-auth/association-origin.ts`,
       fonction pure `associationOriginOf(domain, platformUrl = env.BETTER_AUTH_URL)` : le `BETTER_AUTH_URL`
       dont le nom d'hôte est remplacé par `domain` (protocole et port conservés). Tests : `localhost:3000`
       → `127.0.0.1:3000`, `https://plateforme.fr` → `https://asso.fr`, domaine en majuscules ou avec point
       final normalisé par `normalizeTenantHost`, domaine vide → `undefined`.
2. [x] **Rebaser le lien** — dans le même module, fonction pure `rebaseMagicLinkUrl(url, origin)` : garde
       chemin et paramètres, remplace l'origine, rend absolus sur `origin` les `callbackURL`,
       `errorCallbackURL` et `newUserCallbackURL` relatifs ; un paramètre déjà absolu vers une autre origine
       est ramené à son chemin sur `origin` (jamais de redirection hors de l'association). Tests sur chaque cas,
       jeton inchangé.
3. [x] **`sendMagicLink` sur le domaine de l'association** (`magic-link-integration.ts`) :
       (a) l'URL envoyée est `rebaseMagicLinkUrl(url, associationOriginOf(organization.domain))` ;
       (b) l'URL du logo de l'email est construite sur cette même origine (plus sur l'origine de la requête) ;
       (c) **non-membre = inconnu** : après le décompte du quota (inchangé, pour que la durée ne trahisse rien),
       aucun email si `user.organizations` ne contient pas l'association du domaine. Tests unitaires dans
       `magic-link-integration.real-i18n.test.ts` (ou un fichier voisin) : lien de B sur l'origine de B,
       `callbackURL` absolu sur B, logo sur B, non-membre → `sendMagicLinkEmailService` non appelé et quota
       consommé. La garde `magic-link-integration-imports.test.ts` reste verte (aucun import statique vers les
       services).
4. [x] **Origines de confiance lues en base** (`auth.ts:270`) : `trustedOrigins` devient une fonction
       `trustedOriginsOf(request)` (dans `association-origin.ts`, services chargés par import dynamique comme
       `loadServices`) = liste d'environnement + origine de l'association servie par l'hôte de la requête
       (`normalizeTenantHost` → `getOrganizationByDomainService`). Tests : hôte d'une association → son origine
       incluse ; hôte inconnu → liste d'environnement seule ; sans requête → liste d'environnement seule ;
       aucune origine à joker produite.
5. [x] **Client sur le domaine de la page** (`auth-client.ts:29`) : retirer `baseURL:
 env.NEXT_PUBLIC_APP_URL`. Test unitaire : `createAuthClient` mocké, appelé sans `baseURL`.
6. [x] **Preuve e2e sur deux domaines** — `e2e/magic-link.spec.ts` étendu (ou `e2e/session-multi-domaine.spec.ts`
       sur ses helpers), compteurs du jour remis à zéro pour TechCorp **et** Marketing Pro : - lien demandé sur `127.0.0.1` par `user-admin@gmail.com` (bureau de Marketing Pro) : l'URL de l'email
       commence par `http://127.0.0.1:<port>/`, l'ouvrir mène à `127.0.0.1/…/dashboard`, cookie de session
       posé pour `127.0.0.1` et **aucun** pour `localhost` ; - même chose sur `localhost` pour `user-owner@gmail.com` (TechCorp) ; - `admin@gmail.com`, membre des deux : chaque lien mène au domaine où il a été demandé ; - critère 2 : la session ouverte sur `localhost` ne donne pas accès à `127.0.0.1` (`/fr/bureau` sur B
       renvoie vers la connexion) ; - non-membre : `user@gmail.com` (TechCorp seulement) sur `127.0.0.1` → écran « consultez votre boîte
       mail », aucun message dans la boîte de sortie.
       Specs existantes (`magic-link`, `auth`, `authorization`, `tenant-isolation`, `association-*`,
       `page-cms`, `site-navigation`) vertes.
7. [x] **Documentation** : `docs/architecture.md` (section authentification : origine d'association,
       `trustedOrigins` en fonction, cookie propre à l'hôte, reste connu du groupe `(app)`, point à vérifier en
       s12b) ; `env.example` : commentaire sur le nouveau sens de `BETTER_AUTH_URL` (protocole et port de la
       plateforme). Vérifié par `pnpm check:rules`.

## Files touched

- `src/lib/better-auth/association-origin.ts` (nouveau) + `association-origin.test.ts` (nouveau)
- `src/lib/better-auth/magic-link-integration.ts` + ses tests (`magic-link-integration.real-i18n.test.ts`,
  `magic-link-integration-imports.test.ts` si le graphe change)
- `src/lib/better-auth/auth.ts` (`trustedOrigins`)
- `src/lib/better-auth/auth-client.ts` + test (nouveau)
- `e2e/magic-link.spec.ts` (ou nouvelle spec voisine)
- `docs/architecture.md`, `env.example`
- `docs/decisions/022-lien-et-session-sur-le-domaine-de-l-association.md` (écrit au plan)
- Aucune migration, aucune nouvelle variable d'environnement, aucun libellé.

## Test strategy

- **Unitaire (Vitest)** : les deux fonctions pures (origine, rebasage) couvrent tous les cas de forme d'URL ;
  `sendMagicLink` et `trustedOriginsOf` avec les services mockés (import dynamique mocké comme aujourd'hui) ;
  le client par `vi.mock('better-auth/react')`.
- **E2E (Playwright, build de production)** : la seule preuve des critères — deux domaines réels
  (`localhost` / `127.0.0.1`), boîte de sortie du transport `file`, cookies lus par domaine. La RLS et le
  cookie ne sont pas testables en unitaire.
- **Falsification** (en revue) : remettre l'URL du plugin sans rebasage doit faire échouer l'e2e « lien sur
  B » ; retirer le contrôle d'appartenance doit faire échouer l'e2e « non-membre ».
- `pnpm test --run`, `pnpm lint`, `pnpm check:rules`, `pnpm exec tsc --noEmit`.

## Definition of Done

- Un commit de story sur `feature/s03c-session-multi-domaine`, apportant la recherche, l'ADR 022 et ce plan.
- Critère 1 prouvé en e2e sur deux domaines, critère 2 prouvé en e2e (cookie par domaine, session de A
  refusée sur B) ; non-membre traité comme inconnu.
- Aucun `baseURL` à joker, aucune origine de confiance à joker, aucun domaine en dur.
- Suites unitaire et e2e vertes, sans régression (hors les 2 échecs préexistants de `e2e/auth.spec.ts`).
- Revue `/ks-review` passée (aucun critique), PR ouverte par `/ks-ship`.
- Reste connu, écrit dans `docs/architecture.md` : pages héritées `(app)` non scopées au domaine ; proxy du
  VPS (`trustedProxyHeaders`) à vérifier en s12b ; liens OTP et d'invitation encore sur `NEXT_PUBLIC_APP_URL`.
