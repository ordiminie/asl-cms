# ADR 022 — Lien de connexion et session sur le domaine de l'association : `baseURL` fixe, lien rebasé, origines de confiance lues en base

- Status: accepted
- Date: 2026-09-22
- Scope: story s03c-session-multi-domaine

## Context

Chaque association a son domaine (ADR 003), stocké dans `organization.domain`. Better Auth construit
le lien de connexion sur **une seule** adresse de base (`BETTER_AUTH_URL`,
`plugins/magic-link/index.mjs:85-90`) : un lien demandé sur le domaine de B mène au domaine de A, et
la session s'y ouvre. La story impose que le lien mène au domaine de l'association, que ce domaine soit
**lu en base** (s42 enverra des liens hors de toute requête), et qu'une nouvelle association fonctionne
**sans redéploiement**.

Better Auth 1.7.1 offre deux leviers, vérifiés dans `dist/` (recherche s03c, « Verified APIs ») :

- un `baseURL` **dynamique** `{allowedHosts, protocol, fallback}`, résolu par requête contre une liste
  **fixée au démarrage** ;
- des `trustedOrigins` fournies par une **fonction** `(request) => Awaitable<string[]>`, appelée **à
  chaque requête** (`auth/base.mjs:35`, `getTrustedOrigins`).

## Decision

1. **`baseURL` reste fixe** (`BETTER_AUTH_URL`). Il ne désigne plus « le site », mais la configuration
   de la plateforme : son **protocole et son port** servent à construire l'origine de chaque association.
2. **Origine d'une association** = `BETTER_AUTH_URL` dont on remplace le nom d'hôte par
   `organization.domain` (lu en base). En local, `localhost:3000` → `127.0.0.1:3000` ; en production,
   `https://<plateforme>` → `https://<domaine de l'association>`. Aucune lecture d'en-tête.
3. **Le lien est rebasé dans `sendMagicLink`** : l'URL fournie par le plugin garde son chemin et son jeton,
   son origine devient celle de l'association, et ses `callbackURL` / `errorCallbackURL` relatifs deviennent
   absolus sur cette même origine (sinon la redirection après ouverture serait résolue contre le
   `baseURL` fixe, donc vers la plateforme).
4. **`trustedOrigins` devient une fonction** : la liste d'environnement (`BETTER_AUTH_TRUSTED_ORIGINS`),
   **plus** l'origine de l'association servie par l'hôte de la requête s'il en sert une. Une nouvelle
   association est reconnue dès sa ligne en base.
5. **Le cookie de session reste propre à l'hôte** (aucun `domain`, pas de `crossSubDomainCookies`) : il
   est posé par la réponse de `/magic-link/verify`, servie par le domaine de l'association, et n'est jamais
   envoyé à un autre domaine.
6. **Le client navigateur** (`auth-client.ts`) n'est plus construit sur `NEXT_PUBLIC_APP_URL` : sans
   `baseURL`, Better Auth prend `window.location.origin` (`utils/url.mjs:86`), donc le domaine de la page.

## Considered options

- **`baseURL` dynamique avec `allowedHosts: ['*']`** — rejeté. Better Auth transforme chaque motif de
  `allowedHosts` en origine de confiance (`getTrustedOrigins`, `context/helpers.mjs:59-72`) : `*` produit
  `https://*`, que `matchesOriginPattern` (`auth/trusted-origins.mjs`) accepte pour **toute** origine
  HTTPS. La protection CSRF (`validateOrigin`) et le contrôle des `callbackURL` (`originCheck`, redirection
  ouverte) seraient neutralisés. Vérifié dans le code, pas supposé.
- **`baseURL` dynamique avec une liste de domaines** (environnement, ou lue en base au démarrage) —
  rejeté : fixée au démarrage, elle oblige à redéployer ou redémarrer pour chaque association, contraire
  aux notes de la story. Un hôte hors liste lève en outre une exception sur **toute** route `/api/auth/*`.
- **Domaine du lien tiré de l'en-tête `Host`** — rejeté : indisponible hors requête (s42), et la story
  exige une lecture en base.
- **Cookie partagé entre domaines** (`crossSubDomainCookies`) — rejeté : les associations n'ont pas de
  domaine parent commun, et le critère 2 demande l'inverse.

## Consequences

- s15 et s42 réutilisent la même fonction d'origine (domaine lu en base, sans requête) pour leurs liens.
- `BETTER_AUTH_URL` change de sens : protocole et port de la plateforme. En production, le domaine de
  la plateforme doit avoir le même protocole que ceux des associations (HTTPS partout).
- Les origines de confiance coûtent une lecture d'association (`getOrganizationByDomainService`, donc un
  passage par l'intercepteur de journalisation de la façade) à **chaque** requête du handler
  `/api/auth/*` dont l'hôte est un domaine, cookie ou non (`auth/base.mjs:35`) — et une **seconde** quand
  la requête porte un cookie et n'est ni `GET`, ni `HEAD`, ni `OPTIONS`
  (`api/middlewares/origin-check.mjs:108`, `validateOrigin`, qui rappelle la fonction). Le `get-session`
  du client (`GET`) en coûte une ; son rafraîchissement (`POST`) et la déconnexion, deux. Coût connu, à
  surveiller ; aucun cache n'est ajouté ici.
- **Reste à vérifier en s12b** : derrière le reverse proxy du VPS, `Host` et `x-forwarded-host` ; Better
  Auth n'honore ce dernier qu'avec `advanced.trustedProxyHeaders`, que cette story n'active pas.
- Les liens OTP (2FA) et d'invitation, encore construits sur `NEXT_PUBLIC_APP_URL` (`auth.ts:142, 163`),
  ne sont pas traités ici : l'invitation relève de s15.
