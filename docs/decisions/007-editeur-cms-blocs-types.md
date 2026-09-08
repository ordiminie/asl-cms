# ADR 007 — Éditeur CMS : blocs typés composés dans Milkdown

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

L'ADR 001 a écarté WordPress tout en reconnaissant que le besoin qui le motivait restait de premier plan : « si le bureau ne s'approprie pas le BO, la promesse _gérer le site sans le prestataire_ tombe, quel que soit le reste ». Il renvoyait explicitement l'arbitrage de l'éditeur de texte riche à `/ks-architect`.

Les utilisateurs sont 3 à 8 bénévoles élus, non techniciens, qui changent tous les quelques années. Le critère de succès du PRD est mesurable et exigeant : « le bureau crée, modifie et publie une page, une actualité et une analyse d'eau **sans aucune intervention du prestataire** — mesuré à la recette, par un membre du bureau seul devant l'écran ».

L'analyse du boilerplate montre que les briques sont déjà là : **Milkdown** (`@milkdown/core`, `-react`, `-preset-commonmark`, `-preset-gfm`, `-plugin-history`, `-plugin-listener`, `-theme-nord`) et **@dnd-kit** (`core`, `sortable`, `utilities`), ce dernier servant déjà au réordonnancement des tâches.

Par ailleurs, le périmètre ne demande pas un CMS généraliste. Il demande des **contenus répétables** bien identifiés : pages génériques (s04), actualités (s05), fiches du bureau (s06), analyses d'eau (s09) — ces dernières avec une « UI de saisie rapide, pas un formulaire lourd », publiées au moins mensuellement.

## Decision

Une page est une **liste ordonnée de blocs typés**, pas un document unique.

- Chaque bloc a un type (`texte riche`, `image + légende`, `document PDF`, `galerie`, `encart`) et des données structurées propres. L'ordre est géré par glisser-déposer avec `@dnd-kit`, déjà présent.
- Le bloc `texte riche` utilise **Milkdown en mode WYSIWYG** — l'utilisateur voit du gras, pas des astérisques. Le markdown reste le format de persistance, il n'est pas l'interface.
- Les contenus répétables (actualités, fiches du bureau, analyses d'eau, chemins et portails) ne sont **pas** des pages à blocs libres : ce sont des modèles à champs fixes. C'est ce qui rend la saisie d'une analyse d'eau rapide, et surtout ce qui rend ces données exploitables ailleurs que dans une page — en liste, en flux, dans un email.
- Le rendu réutilise le pipeline MDX existant (`src/components/mdx-content.tsx`), dont les contraintes sont documentées dans `rule-mdx-rendering.md`.

## Considered options

- **Un seul champ markdown par page** — rejeté : le plus rapide à livrer, et c'est son seul mérite. Il reporte toute la mise en page sur des bénévoles non techniciens, et transforme les contenus structurés (analyses d'eau, fiches du bureau) en texte libre non exploitable — impossible d'en faire une liste triée, un flux, ou une variable d'email. Il échouerait au critère de recette.
- **Un CMS headless Node (Payload, Strapi)** — rejeté, et déjà écarté par l'ADR 001 : second modèle d'identité et de tenancy à concilier avec Better Auth. L'ADR 001 le gardait en réserve « si le bloc CMS maison s'avère coûteux à faire évoluer » ; ce point n'est pas atteint, le besoin éditorial restant modeste.
- **Un éditeur de blocs tiers clé en main (Editor.js, BlockNote)** — non retenu, mais c'est l'alternative la plus sérieuse. Écarté parce qu'il impose son propre format de persistance et son propre modèle de blocs, là où nos contenus répétables ont des champs métier précis, et parce que Milkdown est déjà dans les dépendances et déjà accordé au rendu MDX existant.
- **HTML libre dans un `<textarea>`** — rejeté sans discussion : injection, contenu non validable, et une ergonomie inaccessible au public visé.

## Consequences

**Ce qui devient plus simple**

- Le bureau compose au lieu de rédiger de la syntaxe. C'est le seul chemin crédible vers le critère de recette.
- Les contenus répétables sont des données, pas du texte : listables, triables, injectables comme variables dans un email (s25) ou un publipostage (s28).
- Aucune dépendance nouvelle : Milkdown et @dnd-kit sont déjà installés.

**Ce qui devient plus difficile**

- Le modèle de blocs est à concevoir une fois, sérieusement. Un modèle bâclé se paie sur toutes les stories de contenu.
- Chaque type de bloc demande deux implémentations, l'édition et le rendu, et le rendu doit être conforme au design system.
- L'aperçu avant publication devient une vraie fonctionnalité, pas un rendu markdown incident.

**À surveiller**

- **Ne pas laisser proliférer les types de blocs.** Cinq types couvrent le périmètre. Chaque ajout est une dette d'édition, de rendu, de test et de design system. Un besoin non couvert est un « design system gap » à remonter, pas un bloc à improviser.
- L'ergonomie du BO est un objectif explicite de `/ks-design-system`, comme l'exigeait déjà l'ADR 001 — pas un sous-produit des écrans d'admin.
- Le contenu des blocs est saisi par des humains et rendu en HTML : la sanitisation est une exigence de sécurité, pas une option.
