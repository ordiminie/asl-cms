# ADR 020 — Page CMS publique servie à la racine, avec une liste de slugs réservés

- Status: accepted
- Date: 2026-09-21
- Scope: story s04-pages-cms

## Context

Aucun document ne tranche le préfixe de route d'une page CMS publique (Open question 3 de
`docs/research/s04-pages-cms.md`) : le CDCT ne mentionne qu'« une URL publique », sans forme. La
recherche relève un risque de collision entre une page créée librement par le bureau (n'importe quel
slug) et les segments déjà réservés par le produit à la racine de `src/app/[locale]/` :
`(public)/blog`, `(public)/checkout`, `(public)/contact`, `(public)/modules`, `(public)/pricing`,
`(public)/privacy`, `(public)/terms`, `(bureau)/bureau`, `(auth)/login`, `(auth)/logout`,
`(auth)/register`, `(auth)/reset-password`, `(auth)/verify-request`, `(auth)/auth-error`, `admin`,
`docs`, `api`, plus les futurs modules activables (`vote`, `voirie`, `annonces` — ADR 010).

Le design de s04, déjà validé par Marie-Ève (`docs/designs/s04-pages-cms.md`), montre des slugs à la
racine sans préfixe (`/qualite-de-leau`, `/adherer`, `/fete-2025`) — cohérent avec l'ADR 008 (locale
unique, sans préfixe d'URL) et avec le public visé (bénévoles non techniciens, adresses courtes à
communiquer par oral ou sur un flyer). Revenir sur ce choix maintenant referait invalider un design déjà
approuvé.

## Decision

**Les pages CMS sont servies à la racine (`/{slug}`), pas sous un préfixe dédié.** La collision est
prévenue par une **liste de slugs réservés**, vérifiée à la création et à la modification du slug
(service, pas seulement l'UI) : les segments listés ci-dessus, plus tout segment technique déjà
présent dans `src/app/[locale]/` au moment de l'implémentation (à générer par une liste explicite dans
le code, jamais codée en dur dans le service sans commentaire renvoyant à cet ADR — un nouveau segment
technique ajouté plus tard doit être ajouté à cette même liste dans le même commit).

- Un slug qui coïncide avec un segment réservé est refusé avec le même message de champ que pour un
  slug déjà utilisé (critère 5), pas une erreur distincte à inventer.
- La liste vit dans `src/services/types/domain/page-block-types.ts` (ou un fichier voisin dédié),
  exportée, pour que le test de validation du service la parcoure explicitement plutôt que de
  deviner un échantillon.
- Cette décision ne couvre que les pages CMS de s04. Les futurs modules (`vote`, `voirie`, `annonces`)
  restent sous leur propre segment (`/modules/[module]` existant) et n'ont pas besoin d'entrer dans
  cette liste au-delà de leur nom de segment lui-même.

## Considered options

- **Préfixe dédié (`/pages/{slug}`)** — rejeté : contredit le design déjà validé (slugs à la racine),
  et ajoute un segment que le public visé (bénévoles âgés, peu à l'aise avec l'informatique) doit
  retenir en plus du slug lui-même — l'inverse de l'objectif d'adresses courtes et mémorisables.
- **Aucune garde, laisser la collision se produire** — rejeté : une association qui crée une page
  `/admin` ou `/api` casserait silencieusement une route du socle, découverte en production plutôt qu'à
  la création.
- **Générer dynamiquement la liste des segments réservés en lisant `src/app/[locale]/` au runtime** —
  rejeté : lire le système de fichiers au runtime pour une liste qui ne change qu'au déploiement est une
  complexité inutile ; une liste explicite, versionnée et revue à chaque nouvelle route du socle est
  plus simple et plus sûre.

## Consequences

**Ce qui devient plus simple**

- Le design déjà validé n'a pas à être repris : les adresses restent courtes, cohérentes avec ADR 008.

**Ce qui devient plus difficile**

- Toute nouvelle route technique ajoutée à la racine du produit (une future story) doit penser à mettre
  à jour la liste réservée de s04, sinon elle risque une collision silencieuse avec une page existante
  d'une association. À rappeler dans la checklist de revue des stories qui ajoutent un segment racine.

**À surveiller**

- Le routage Next.js résout `/{slug}` par un unique `page.tsx` dynamique
  (`src/app/[locale]/(public)/[slug]/page.tsx`) : vérifier à l'implémentation qu'aucun autre segment
  dynamique à la racine n'entre en conflit de priorité avec lui (Next.js préfère un segment statique à
  un segment dynamique, donc l'ordre de résolution protège déjà les routes listées — la liste réservée
  sert la validation applicative à la création, pas le routage lui-même).
