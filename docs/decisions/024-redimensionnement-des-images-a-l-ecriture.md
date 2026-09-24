# ADR 024 — Redimensionner les images à l'écriture, avec `sharp`

- Status: accepted
- Date: 2026-09-24
- Scope: story s06-presentation-bureau

## Context

Le critère 2 de s06 demande que la page publique affiche « la photo **redimensionnée** ». Or **rien
ne redimensionne dans le produit aujourd'hui** : le rendu public d'un bloc image de s04 émet un
`<img src="/api/pages/files/…">` brut, et l'aperçu du bureau passe par `next/image` en
`unoptimized`. `next.config.ts` ne déclare aucun `images.localPatterns`.

Trois forces :

1. **Le tenant vient du domaine appelé.** `/api/files/[...key]` résout l'association par
   `getCurrentTenantDal()`, c'est-à-dire par l'hôte de la requête (ADR 002, ADR 022). Tout mécanisme
   qui va rechercher le fichier **par un autre chemin** que la requête du visiteur doit conserver cet
   hôte, sans quoi la clé ne se résout plus.
2. **Le VPS est petit** (4 Go, ADR 004). Le disque porte tous les fichiers de toutes les
   associations, et le CPU n'a pas de marge pour un traitement d'image par requête.
3. **s06 est la première story à recevoir des photos prises au téléphone** — 3 à 5 Mo, rarement
   carrées — alors que le rendu ne dépasse jamais 128 px de côté (design system §3.9).

Une décision est nécessaire maintenant : s09 (analyses d'eau) et toute story ultérieure qui stocke
une image hériteront du choix fait ici, et l'ADR 023 a posé le principe d'**une seule chaîne de
fichiers de contenu**, pas d'une implémentation par modèle.

## Decision

**Les images sont redimensionnées côté serveur, à l'écriture**, par `sharp` ajouté en dépendance
directe.

- Un module dédié, `src/lib/files/resize-image.ts`, hors de tout service métier : il prend des
  octets et rend des octets.
- Une **photo de personne** y entre sous n'importe quel format accepté (PNG, JPEG, WebP) et en sort
  en **WebP carré de 512 px de côté**, `fit: cover` centré. 512 px couvre le plus grand rendu du
  design system (128 px) jusqu'à 4× de densité.
- **L'original n'est pas conservé.** Le fichier stocké est le fichier servi, sous la clé générée par
  `buildContentFileKey` avec le format `webp`.
- Le redimensionnement s'intercale **après** la validation par signature binaire et **avant**
  l'écriture : un fichier refusé n'est jamais décodé.

## Considered options

- **`next/image` optimisé sur `/api/files/**`** (`images.localPatterns` + `sharp` en production) —
  rejeté : l'optimiseur va chercher le chemin local lui-même, et rien ne garantit que cette requête
  interne porte l'hôte de l'association. La panne ne se verrait **qu'en production, sur toutes les
  photos à la fois**, et le diagnostic passerait par la résolution de tenant — le pire endroit où
  découvrir un défaut. Le mécanisme exige `sharp` en production de toute façon, et ajoute un coût CPU
  à chaque requête d'image.
- **Contrainte CSS seule** (`object-cover` dans un carré) — rejeté : les octets servis restent ceux
  de l'original. Une photo de 4 Mo est téléchargée entière par chaque visiteur pour être affichée à
  128 px. Le critère parle d'une photo redimensionnée, pas d'une photo rognée à l'affichage.
- **Conserver l'original à côté de la copie redimensionnée** — rejeté : double le disque occupé, pour
  un besoin qui n'existe dans aucune story du périmètre. Le recadrage, la rotation et la retouche sont
  explicitement hors du design de s06.
- **Une bibliothèque en JavaScript pur** (`jimp`, `@squoosh/lib`) pour éviter un module natif —
  rejeté : plus lent d'un ordre de grandeur sur un VPS sans marge, et `sharp` est **déjà dans l'arbre**
  (0.35.3, dépendance transitive de `next`). Le passer en dépendance directe ne change pas ce qui est
  installé, seulement ce qui est déclaré.

## Consequences

**Plus facile** : un seul fichier canonique par photo, servi par la route existante avec son cache
immuable ; comportement identique en développement, en CI et en production, sans configuration
d'image ; empreinte disque bornée quelle que soit la taille des originaux déposés.

**Plus difficile** : `sharp` devient une dépendance directe, donc un module natif à installer pour
la plateforme cible. **À vérifier explicitement en s12b** (mise en ligne) : l'image de déploiement
doit résoudre le binaire `sharp` pour l'architecture du VPS. L'échec serait bruyant (l'écriture
lève), pas silencieux.

**À surveiller** : le recadrage `cover` centré peut couper une tête sur une photo très allongée. La
consigne du formulaire demande un carré ; si le problème se présente réellement, la marche suivante
est `position: 'attention'` de `sharp`, **pas** une interface de recadrage — celle-ci reste hors
périmètre.

**Portée** : le module ne connaît ni les fiches du bureau ni les actualités. s09 et toute story qui
stockera une image pourront l'appeler avec leurs propres dimensions. Reprendre les images de blocs de
s04 est possible mais **n'est pas fait ici** : ce serait modifier le rendu d'une story livrée, hors du
périmètre de s06.
