# ADR 003 — Résolution du tenant par le domaine appelé

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

s01 exige qu'« une requête entrante soit rattachée à son association d'après le domaine appelé ; deux domaines servent deux tenants distincts, et un domaine inconnu répond 404 ». Chaque association a son propre nom de domaine — `asl-exemple.test` pour le premier tenant.

Le boilerplate ne fonctionne pas ainsi. Il résout l'organisation de deux manières, toutes deux inadaptées :

- par `activeOrganizationId` dans la session Better Auth (plugin `organization`, `src/lib/better-auth/auth.ts`) — inutilisable pour un **visiteur non authentifié**, qui représente l'essentiel du trafic du site public ;
- par un slug dans l'URL (`src/app/[locale]/(app)/team/[slug]/`) — impose un préfixe dans chaque URL publique, ce qui contredit l'idée même d'un site vitrine par association.

Contrainte supplémentaire : `src/proxy.ts` (le middleware) ne peut pas interroger Postgres. Il tourne sur le runtime Edge et `node-postgres` n'y est pas disponible.

## Decision

Le tenant est résolu **côté serveur applicatif, à partir de l'en-tête `Host`**, pas dans le middleware.

- Un helper `getCurrentTenant()` lit `headers()` pour obtenir le host, puis délègue à une fonction du DAL `getTenantByDomainDal(host)` portant `'use cache'`, `cacheLife('hours')` et `cacheTag('tenant')`.
- Le host est lu **en dehors** du scope caché et passé en argument : `headers()` est interdit dans un scope `'use cache'` (voir `rule-react-cache-next-cache.md`). C'est cette séparation qui rend la fonction cachable.
- Un host inconnu fait appeler `notFound()` par le layout racine, ce qui produit le 404 exigé.
- L'`organizationId` ainsi obtenu alimente le `withTenant()` de l'ADR 002. C'est le point d'entrée unique : un seul endroit décide de quel tenant il s'agit.
- Un domaine par association est stocké sur la table `organization`, en colonne indexée et unique.

Le middleware garde son rôle actuel — gating grossier de session sur les segments authentifiés — et ne gagne aucune responsabilité de tenancy.

## Considered options

- **Résolution dans le middleware** — rejeté : impossible d'interroger Postgres depuis le runtime Edge. Il faudrait un cache externe (Redis, KV) tenu à jour au provisioning, soit un service de plus sur un VPS unique, pour anticiper une résolution que le serveur applicatif fait très bien.
- **Slug dans l'URL (`/asl-la-fourche/actualites`)** — rejeté : chaque association a son domaine et attend un site à elle. Un préfixe de tenant dans chaque URL dégrade le SEO (s11), rend les liens partagés par le bureau plus fragiles, et expose la nature mutualisée du produit à ses utilisateurs finaux.
- **Sous-domaines d'un domaine de plateforme (`lafourche.asl-cms.fr`)** — rejeté comme modèle principal, mais reste compatible avec la décision : c'est un domaine comme un autre dans la table. Utile en recette, avant que le client ait délégué son propre domaine.
- **Un déploiement par association** — rejeté : contredit frontalement le critère de succès « une deuxième association est provisionnée sans écrire une ligne de code », et multiplie par six l'exploitation sur un VPS unique.

## Consequences

**Ce qui devient plus simple**

- Le visiteur anonyme est traité exactement comme le membre connecté : le tenant vient de la requête, pas de la session. Aucun cas particulier pour le site public, qui est pourtant l'angle n°3 du PRD.
- Les URL publiques sont propres et directement référençables (`asl-exemple.test/actualites`), ce que s11 exige.
- Ajouter une association, c'est insérer une ligne et pointer un DNS.

**Ce qui devient plus difficile**

- **Toute page dépend de l'en-tête `Host`**, donc devient dépendante de la requête. Sous Cache Components, cela signifie qu'aucune page n'est prerendue _par tenant_ au build. C'est la tension principale de cette décision, et elle est assumée : le coût réel est déplacé, pas payé deux fois, parce que le **contenu** rendu vient de fonctions du DAL en `'use cache'` indexées sur `organizationId`. Ce qui est cher est caché ; ce qui dépend de la requête est bon marché.
- Le développement local et les tests e2e doivent simuler plusieurs hosts. Prévoir des entrées `/etc/hosts` ou l'en-tête `Host` forcé côté Playwright — c'est précisément ce que le test d'accès croisé de s01 exige de toute façon.

**À surveiller**

- Le `cacheTag('tenant')` doit être invalidé par `updateTag` au provisioning et à tout changement de domaine, sinon une association fraîchement créée répond 404 jusqu'à expiration du cache.
- Ne jamais mettre le domaine ou le nom de l'association dans une clé de cache portant une donnée personnelle : les clés de cache sont stockées en clair (`rule-react-cache-next-cache.md`).
