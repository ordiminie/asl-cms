# ADR 019 — Blocs de page : stockage JSON typé et rendu sanitisé indépendant de MDXContent

- Status: accepted
- Date: 2026-09-21
- Scope: story s04-pages-cms

## Context

ADR 007 fixe qu'une page est « une liste ordonnée de blocs typés », avec cinq types (texte riche,
image + légende, document PDF, galerie, encart), et prescrit la réutilisation du pipeline MDX partagé
(`src/components/mdx-content.tsx`) pour le rendu. La recherche de s04
(`docs/research/s04-pages-cms.md`, Trap 2 et Open question 2) a vérifié que `MDXContent` appelle
`await connection()` en tête (ligne 32) — ce qui **force** le rendu dynamique par requête, exactement
l'inverse du mandat de la story et de `docs/architecture.md` (§Cache Components) : le rendu public
d'une page doit être cachable (`'use cache'` + `cacheTag`), invalidé par `updateTag` à la publication.
Les deux exigences ne peuvent pas cohabiter dans le même composant.

Par ailleurs, aucune forme n'est posée nulle part pour `content_block.data` (Open question 4), et
`package.json` ne contient aucune librairie de sanitisation HTML (`rehype-sanitize`, `dompurify` ou
équivalent — Trap 3), alors qu'ADR 007 est explicite : « le contenu des blocs est saisi par des
humains et rendu en HTML : la sanitisation est une exigence de sécurité, pas une option. » Le critère 9
de la story exige de plus qu'un type de bloc inconnu (donnée déjà en base, code qui ne le reconnaît
plus) ne casse jamais le rendu — la forme de stockage doit rester lisible même pour un type que le code
actuel ignore.

## Decision

**`content_block` stocke `type` (texte) et `data` (`jsonb`) séparément, sans schéma de colonnes par
type.** Le rendu public passe par une fonction pure et synchrone, propre à s04
(`src/services/types/domain/page-block-types.ts` pour les schémas Zod discriminés par `type`,
`src/lib/cms/render-page-block.ts` pour le rendu HTML), **pas par `MDXContent`**.

- **Écriture** : le `<BlockPicker />` ne propose que les cinq types actuels ; le service valide
  `data` avec un schéma Zod discriminé (`z.discriminatedUnion('type', [...])`) au moment de
  l'enregistrement. Un type absent du schéma est refusé **à l'écriture** (le bureau ne peut pas créer
  un sixième type en freestyle).
- **Lecture** : le rendu public itère les blocs dans l'ordre (`rank`) et traite tout `type` non
  reconnu par le renderer courant comme **ignoré**, jamais comme une erreur — c'est le seul chemin qui
  satisfait le critère 9 pour une donnée déjà en base créée par une version antérieure du code (type de
  bloc retiré depuis, ou donnée de test insérée directement, cf. tâche « Preuve d'isolation »).
- **Sanitisation** : le texte riche et l'encart passent par une chaîne minimale
  `remark` → `remark-html` → `rehype-sanitize` (ou équivalent retenu à l'implémentation si un paquet
  plus léger couvre le même besoin), avec un schéma de sanitisation limité aux balises que la barre
  réduite du design system produit (gras, italique, `h2`/`h3`, listes, liens) — pas le schéma GFM par
  défaut. Les autres types de blocs (image, PDF, galerie) n'ont pas de HTML libre à sanitiser : leurs
  champs texte (légende, titre, alt) sont échappés comme du texte, jamais interprétés comme du markup.
- `MDXContent` continue de servir le blog hérité (`post-model.ts`) sans changement ; cette décision ne
  le touche pas et n'en hérite pas.

## Considered options

- **Réutiliser `MDXContent` tel quel pour le rendu de page** — rejeté : `await connection()` empêche
  tout cache, en contradiction directe avec le mandat de cache de la story et `docs/architecture.md`.
  L'adapter pour accepter un mode « sans horloge » toucherait un composant partagé par le blog, hors
  périmètre de s04 et risque de régression documenté par `rule-mdx-rendering.md`.
- **Étendre `markdown-editor.tsx` (Milkdown + GFM) comme moteur de rendu public** — rejeté : ce
  composant est un éditeur client (`'use client'`), pas un renderer serveur cachable, et sa
  configuration actuelle expose tableaux, code et couleurs que le design system interdit pour le bloc
  texte riche (Trap 4).
- **Dériver l'éditeur du bloc texte riche de `markdown-editor.tsx` (Milkdown), en masquant les outils
  interdits** — rejeté aussi, et c'est le point où cet ADR s'écarte de son intuition de départ.
  Milkdown est un WYSIWYG : ce que le bureau voit dans l'éditeur est censé être ce qu'il obtient. Or
  sa barre GFM produit des tableaux et du code que le schéma de sanitisation de
  `render-page-block.ts` retire **silencieusement** à la publication — le bureau composerait un
  tableau, le verrait à l'écran, et il aurait disparu de la page publiée. Masquer des boutons ne
  supprime ni le collage de markup riche, ni les raccourcis clavier, ni la sérialisation GFM. L'éditeur
  du bloc texte riche est donc un **composant neuf, écrit pour cette story**
  (`src/components/features/pages/blocks/restricted-markdown-editor.tsx`) : un `textarea` et six
  actions de balisage (gras, italique, titre 2, titre 3, liste, lien) — exactement ce que le rendu
  accepte, rien de plus. Il ne dérive pas de Milkdown et n'en hérite aucune configuration.
  `markdown-editor.tsx` reste au blog hérité, intact.
- **Une colonne par type de bloc (`image_url`, `pdf_title`, `gallery_images`…) sur `content_block`** —
  rejeté : contredit « liste ordonnée de blocs typés » en réintroduisant un schéma rigide par type,
  empêche d'ajouter un champ à un type sans migration, et complique le passage silencieux d'un type
  inconnu (critère 9) puisque les colonnes des types inconnus n'existeraient simplement pas.
- **Refuser à la lecture un type de bloc inconnu (lever une erreur)** — rejeté : viole directement le
  critère 9 (« la page s'affiche, le bloc est ignoré »).

## Consequences

**Ce qui devient plus simple**

- Ajouter un champ à un type de bloc existant ne demande pas de migration (JSON), seulement une
  évolution du schéma Zod et du renderer.
- Le renderer est une fonction pure, testable en unitaire sans base ni requête HTTP — y compris le cas
  du type inconnu et le cas d'un contenu malveillant à sanitiser.

**Ce qui devient plus difficile**

- Aucune contrainte SQL ne garantit la forme de `data` : toute la validation de structure repose sur le
  service (Zod), jamais sur la base. Une écriture qui contournerait le service (script de migration de
  données, `withRlsBypass`) pourrait insérer une forme invalide — à traiter comme le cas « type
  inconnu » au rendu, jamais comme une exception qui casse la page.
- Deux moteurs de rendu markdown coexistent dans le produit (`MDXContent` pour le blog,
  `render-page-block.ts` pour les pages) : un futur alignement des deux devra repasser par un ADR, pas
  par une extension discrète de l'un des deux.

**À surveiller**

- Le dépôt d'une dépendance de sanitisation (`rehype-sanitize` ou équivalent) est un ajout de paquet :
  hors périmètre d'un Quick Fix, à documenter dans le commit de la story comme le reste des dépendances
  nouvelles (`@dnd-kit` est déjà présent et inutilisé jusqu'à cette story — l'activer n'est pas un ajout
  de dépendance, seulement son premier usage réel).
- `@milkdown/*` n'est toujours utilisé que par `markdown-editor.tsx`, lui-même appelé par le seul
  formulaire d'article du blog d'administration (`post-form.tsx`). s04 n'en fait aucun usage : le
  paquet ne doit pas être considéré comme « activé » par cette story.
