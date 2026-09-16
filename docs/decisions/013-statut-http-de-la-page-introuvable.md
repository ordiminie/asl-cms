# ADR 013 — Statut HTTP de la page introuvable (domaine inconnu, module inactif)

- Status: accepted
- Date: 2026-09-10
- Scope: story s01-provisionner-association

## Context

L'ADR 003 affirme, en une phrase : « Un host inconnu fait appeler `notFound()` par le layout
racine, ce qui produit le 404 exigé. » Les critères 2 et 4 de s01 en dépendent — domaine inconnu
→ 404, route d'un module inactif ou de clé inconnue → 404.

Le dépôt avait déjà mesuré l'inverse sur le cas jumeau : `src/app/[locale]/admin/layout.tsx:23-30`
documente que `forbidden()` rend un **200** portant l'UI interdite, et `e2e/authorization.spec.ts`
l'asserte volontairement (`toBe(200)`) sur trois pages refusées. Aucune assertion `404` n'existait
dans `e2e/`. La tâche 1 du plan de s01 a donc exigé la mesure avant toute conception.

**Mesures du 2026-09-10**, sur le build de production (`pnpm build && pnpm start`, Next 16.3.0,
`cacheComponents: true`) :

| Cas mesuré                                                                           | Statut  |
| ------------------------------------------------------------------------------------ | ------- |
| `/xx-invalide` — l'URL que le plan proposait                                         | **307** |
| `notFound()` depuis un layout portant `instant = false` et `await headers()` en tête | **200** |
| `notFound()` depuis un composant placé derrière `<Suspense>` (variante streamée)     | **200** |
| `/fr/does-not-exist` — aucune route ne correspond, donc aucun rendu                  | **404** |

Trois faits en découlent, et ils sont tous nouveaux par rapport à l'ADR 003 :

1. **Le `notFound()` du layout racine est du code mort en pratique.** `/xx-invalide` ne l'atteint
   jamais : le middleware next-intl redirige toute locale inconnue vers la locale par défaut
   (`307 → /en/xx-invalide`). La mesure a donc dû passer par une sonde jetable — un layout imbriqué
   lisant `headers()` puis appelant `notFound()`, construit, mesuré, supprimé.
2. **`export const instant = false` n'achète pas le statut.** Comme pour `forbidden()`, un layout
   bloquant qui `await` en tête rend malgré tout un 200 : sous Cache Components toute route de page
   émet d'abord son shell prerendu (le corps de la réponse mesurée contient à la fois le shell et
   l'UI introuvable). Le statut est parti avant que `notFound()` ne soit levé.
3. **Un 404 réel n'existe que sans rendu du tout** : quand aucune route ne correspond, la décision
   précède le premier octet. Dès qu'une route correspond, elle streame.

Fait connexe mesuré au passage, qui pèse sur la tâche 8 : lire `headers()` **au niveau supérieur du
layout racine** fait **échouer le build** de `/[locale]/chat` et `/[locale]/account/affiliate`
(`blocking-prerender-dynamic`). Ces deux routes disparaissent avec l'ADR 009, mais la contrainte
reste : toute page conservée qui ne tolère pas de devenir dépendante de la requête devra être
traitée.

## Decision

**Pour une page, le comportement « introuvable » de s01 est un `notFound()` qui rend l'UI introuvable
avec un statut HTTP 200. Le mot « 404 » des critères 2 et 4 se lit « la page introuvable, et aucun
contenu de tenant », pas « le code de statut 404 ».**

- Domaine inconnu et module inactif ou de clé inconnue appellent tous deux `notFound()`, via le
  helper unique de la tâche 9. Le rendu est celui de `src/app/[locale]/not-found.tsx`.
- Ce que la décision garantit, et qui est ce que les critères protègent réellement : **aucun contenu
  d'aucun tenant n'est servi**. C'est vérifiable sur le corps de la réponse, pas sur son statut.
- Le statut mesuré est **asserté strictement en e2e** (`toBe(200)`), sur le modèle de
  `e2e/authorization.spec.ts` : le test tombe le jour où la situation change, plutôt que de laisser
  la limite se perdre.
- **Les Route Handlers ne sont pas concernés** : ils ne streament aucun shell et rendent de vrais
  statuts (`src/lib/api-auth.ts` rend 401 sans session et 403 sur rôle insuffisant). Une API appelée
  sur un domaine inconnu peut donc, elle, répondre 404 — et devra le faire quand une telle API
  existera. ⚠️ Ce point **n'est plus couvert par une spec** : les deux tests de
  `e2e/authorization.spec.ts` qui le prouvaient visaient `/api/projects`, la seule route API gardée
  du dépôt, retirée par l'ADR 009 dans la même story. À recouvrir dès qu'une route API gardée
  d'ASL-CMS existe.

Cette décision **complète** l'ADR 003 sur son seul point erroné. Le reste de l'ADR 003 — résolution
côté serveur depuis `Host`, `getTenantByDomainDal` en `'use cache'`, un domaine par association en
colonne unique indexée — reste en vigueur tel quel.

## Considered options

- **(a) Assumer le 200 portant l'UI introuvable** — **retenu**. C'est le précédent déjà établi et
  documenté du dépôt (D20 pour le 403, `rule-safe-route.md`, trois assertions `toBe(200)` en e2e),
  c'est la seule issue qui ne demande aucun changement d'architecture, et la mesure montre qu'aucune
  autre n'est atteignable pour une page sans déplacer le contrôle hors du rendu. Le critère 4 exige
  « pas un lien masqué, pas une page vide » : une UI introuvable explicite le satisfait.
- **(b) Faire rendre le statut par un Route Handler** — rejeté. Techniquement exact (les Route
  Handlers rendent de vrais statuts, mesuré avant le retrait ADR 009) mais hors sujet : un visiteur qui tape un domaine
  inconnu demande une **page**. Il faudrait rediriger ou réécrire vers le handler, donc soit un
  `307` avant le 404 — pire qu'un 200 — soit une réécriture qui ramène le problème du rendu.
- **(c) Contrôler en amont dans `src/proxy.ts`** — rejeté pour s01, mais **le motif de l'ADR 003
  n'est plus valide** et il faut le dire : ADR 003 l'excluait parce que « le middleware tourne sur le
  runtime Edge et `node-postgres` n'y est pas disponible ». En Next 16, **Proxy tourne par défaut sur
  le runtime Node.js** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:223`
  ; l'option `runtime` y est même interdite). Interroger Postgres depuis le proxy est donc
  techniquement possible aujourd'hui. C'est néanmoins rejeté ici pour trois raisons de coût : ça
  ajoute une requête base **sur chaque requête entrante** (le matcher couvre toutes les pages), donc
  un cache à tenir hors du cache de Next ; ça déplace la résolution du tenant dans le proxy, ce que
  la décision centrale de l'ADR 003 refuse ; et ça élargit s01, déjà signalée comme sous-chiffrée à
  complexité 4. **À rouvrir si un besoin réel de statut apparaît** — référencement d'un domaine
  expiré, sonde de supervision, réponse à un scanner.
- **(d) Rendre le layout racine bloquant (`instant = false`)** — rejeté par la mesure, pas par
  l'argumentation : la sonde portait exactement cette configuration et rend 200. L'option était déjà
  affaiblie par `admin/layout.tsx`, qui la porte et rend 200 lui aussi ; elle est maintenant réfutée.

## Consequences

**Ce qui devient plus simple**

- s01 n'a aucun mécanisme de statut à construire : `notFound()` et le helper unique de modules
  suffisent, et le comportement est homogène avec le 403 déjà en place.
- Le contrôle reste au plus près de la donnée (layout, page, Server Action), là où il est réellement
  fiable, plutôt que dans un proxy qui ne valide rien.

**Ce qui devient plus difficile, et ce qu'il faut surveiller**

- **Le SEO d'un domaine inconnu** : un moteur reçoit un 200 sur une page introuvable, ce qui est
  précisément ce qu'un « soft 404 » désigne. Sans conséquence tant qu'aucun domaine inconnu n'est
  référencé, mais s11 (référencement) doit le savoir : le `robots`/`sitemap` par tenant ne doit
  jamais publier un domaine non provisionné.
- **Une supervision qui teste un statut** ne détectera pas un domaine dé-provisionné. À traiter au
  déploiement (s42) par une sonde sur le contenu, ou par une route API dédiée qui, elle, peut rendre
  un vrai 404.
- **L'assertion e2e à 200 est un capteur, pas une cible.** Si une version de Next permet un jour de
  décider le statut avant le shell, le test tombera — et c'est le signal attendu pour rouvrir cette
  décision, pas une régression à corriger en ajustant l'assertion.
- **Ne pas répéter la sonde.** La mesure a demandé deux builds complets ; elle est consignée
  ci-dessus pour n'avoir plus à la refaire.
