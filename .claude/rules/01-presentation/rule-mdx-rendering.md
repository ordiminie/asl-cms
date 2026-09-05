---
description: Rendu MDX du blog et de la documentation
---

# Rendu MDX (blog et documentation)

Le blog et la documentation partagent **un seul rendu** : `src/components/mdx-content.tsx`. Ne pas
en créer un second — c'est ce qui avait fait diverger les deux typographies.

## Répartition des responsabilités

| Quoi                   | Qui                                            | Ne pas faire                                                                                             |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Typographie du contenu | le wrapper `prose` (`@tailwindcss/typography`) | redéclarer `p`, `ul`, `ol`, `li`, `blockquote`, `hr`, `thead`, `tbody`, `tr`, `th`, `td` dans le mapping |
| Comportement           | le mapping `mdx-components.tsx`                | y remettre du style que `prose` gère déjà                                                                |
| Couleur du code        | Shiki en dual-theme + CSS                      | poser une variable maison                                                                                |
| Fond du bloc de code   | le design system (`bg-muted`)                  | prendre le fond de Shiki (`github-light` est blanc)                                                      |

**Le mapping ne garde que ce qui demande un vrai comportement** : les titres (ancres du sommaire),
`pre` (composant `CodeBlock`), `code` (détection de l'inline), `a` (lien interne via `next/link`),
`img` (`next/image`) et `table` (conteneur scrollable).

## Règles à ne pas casser

- **`MDXContent` porte `await connection()`** : la compilation MDX lit l'horloge, elle ne peut pas
  être prerendue. Tout appelant doit donc l'envelopper d'un `<Suspense>`. `<Suspense>` seul ne
  suffit pas — l'IO synchrone casse le prerender sans `connection()`.
- **Le mapping `pre` transmet le `style` et la `className` générés par Shiki.** S'il les remplace par
  ses propres classes, les variables `--shiki-light` / `--shiki-dark` n'atteignent jamais le HTML et
  la coloration se fige sur un seul thème.
- **Le code inline se reconnaît à son enfant** — une chaîne, là où un bloc porte les `<span>` de
  Shiki. Pas d'heuristique sur la longueur du texte.
- **Le sommaire vient de la source MDX**, jamais du DOM : le contenu est streamé, un effet client
  s'exécute avant son arrivée et ne se relance pas. Voir `src/lib/helper/mdx-headings.ts`, qui
  partage `slugifyHeading` avec le mapping des titres — les deux doivent rester d'accord, sinon les
  ancres ne correspondent plus.
- **Les liens du sommaire sont des ancres natives.** Le défilement doux ne fonctionne pas dans ce
  layout : `scrollIntoView({behavior:'smooth'})`, `scroll-behavior: smooth` et la navigation de hash
  de `next/link` laissent la page immobile (vérifié dans les trois cas). Le décalage sous l'en-tête
  vient de `scroll-mt-*` sur les titres.

## Écrire du contenu MDX

- **Un fence qui contient du JSX se déclare `tsx`** (ou `jsx`), pas `typescript` : la grammaire
  TypeScript ne connaît pas JSX et Shiki laisse balises et props sans couleur. L'en-tête du bloc
  affiche le langage déclaré, ce qui rend l'erreur visible.
- **Garder le contenu d'une balise JSX inline sur une seule ligne.** Écrit sur plusieurs lignes, MDX
  reparse le contenu comme un bloc Markdown et produit un `<p>` à l'intérieur — donc un `<p>` dans un
  `<p>`, invalide en HTML et signalé en erreur d'hydratation.
- `title="…"` sur un fence alimente l'en-tête du bloc de code à la place du langage.

## Vérifier une modification

Toujours en **clair et en sombre**, sur trois pages au minimum : une page avec blocs de code et
onglets, une page avec tableau, un article de blog. La majorité des régressions de rendu ne se voit
que dans un des deux thèmes.
