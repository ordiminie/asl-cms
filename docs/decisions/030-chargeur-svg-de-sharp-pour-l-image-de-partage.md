# ADR 030 — Rouvrir le seul chargeur SVG en mémoire de sharp pour l'image de partage

- Status: accepted
- Date: 2026-10-01
- Scope: story s11-seo
- Décision de l'utilisatrice, après le 3ᵉ passage de revue de s11 (constat C3).

## Context

L'image de partage de repli (`/api/identity/share-image`, s11) est rendue par `next/og`. Quand sharp
est installé, `@vercel/og` (embarqué dans Next) rastérise le SVG produit par satori **avec sharp** :
`sharp(new TextEncoder().encode(svg)).resize(width).png()`
(`next/dist/compiled/@vercel/og/index.node.js`).

Or l'optimiseur de `next/image` (`next/dist/server/image-optimizer.js`, `getSharp`) charge sharp
paresseusement, au premier appel à `/_next/image` qui n'est pas en cache, puis :

1. bloque **globalement**, dans libvips, tous les chargeurs (`block({operation: ['VipsForeignLoad']})`) ;
2. ne rouvre que HEIF, JPEG, GIF, PNG, TIFF et WebP.

Le blocage vaut pour tout le processus et pour toute sa durée. Toute image de partage rendue ensuite
échoue en plein streaming (`Input buffer contains unsupported image format`) : le client reçoit une
connexion coupée, ni image ni erreur. En production, la première image optimisée après un
redémarrage casse l'`og:image` de toutes les pages publiques de toutes les associations, jusqu'au
redémarrage suivant. En CI (build neuf, cache d'images froid), la spec `seo.spec.ts` échoue de façon
déterministe.

C'est un défaut d'interaction entre Next 16.3 et `@vercel/og`, pas un défaut de nos données : le
monogramme de repli échoue de la même façon que le logo.

## Decision

Avant **chaque** rendu, la route rouvre le **seul** chargeur SVG en mémoire de libvips :

```ts
sharp.unblock({operation: ['VipsForeignLoadSvgBuffer']})
```

L'appel est fait juste avant `new ImageResponse(...)`, pas au chargement du module : le blocage de
l'optimiseur survient au premier `/_next/image`, qui peut arriver après le chargement de la route et
défaire un déblocage fait une fois pour toutes. `getSharp` ne bloque qu'une fois par processus ; un
déblocage à chaque rendu reste donc en vigueur pour la suite.

En complément, la route matérialise le corps de l'image (`await response.arrayBuffer()`) avant de
répondre : un échec de rendu devient un 500 explicite, journalisé par `logger.error`, au lieu d'une
connexion coupée.

## Considered options

- **Rouvrir uniquement `VipsForeignLoadSvgBuffer`** — retenue par l'utilisatrice. Une ligne, à
  l'endroit du besoin, sans changer le modèle de données ni le flux d'écriture.
- **Générer l'image de partage à l'écriture** (changement de logo, de nom ou de teinte) et la servir
  comme un fichier, dans l'esprit de l'ADR 024 — rejetée : plus lourde (déclencheurs sur trois
  réglages, stockage, migration des associations existantes) pour le même résultat visible, et le
  rendu passerait toujours par `next/og` et sharp dans un processus où l'optimiseur peut avoir bloqué
  le chargeur.
- **Désactiver sharp pour `next/og`** (forcer le repli resvg) ou **désinstaller sharp** — rejetée :
  `@vercel/og` choisit sharp dès qu'il est importable, sans option pour l'en empêcher, et sharp est
  requis par l'optimiseur de `next/image` et par le redimensionnement à l'écriture (ADR 024).
- **Rouvrir tous les chargeurs** (`unblock({operation: ['VipsForeignLoad']})`) — rejetée : défait la
  protection de Next pour des formats dont nous n'avons pas besoin.

## Consequences

Sécurité — le périmètre rouvert est minimal :

- Next continue de refuser les SVG en amont de l'optimiseur (`dangerouslyAllowSVG: false`) : une
  image SVG demandée à `/_next/image` n'atteint jamais sharp.
- Le chargeur SVG **depuis un fichier** (`VipsForeignLoadSvgFile`) reste bloqué.
- Les fichiers d'identité téléversés par le bureau n'acceptent que PNG et WebP
  (`IDENTITY_ACCEPTED_FORMATS.logo`) ; le logo est en plus réencodé en PNG borné avant le rendu.
- Le seul SVG que la route donne à sharp est celui que satori génère côté serveur à partir de notre
  gabarit : aucun SVG fourni par un visiteur.

À surveiller :

- **À revérifier à chaque montée de version de Next** : la liste des chargeurs bloqués par
  `getSharp`, le moteur de rastérisation de `@vercel/og`, et le nom de l'opération libvips. La spec
  `e2e/seo.spec.ts` (critère 2) force l'optimiseur avant de demander l'image de partage et vérifie un
  PNG 1200 × 630 décodable : elle échoue si l'interaction réapparaît.
- Une fenêtre résiduelle existe si le tout premier appel de l'optimiseur du processus tombe entre le
  déblocage et la rastérisation d'un rendu en cours. Cet unique rendu répond alors 500, journalisé ;
  les suivants passent.
