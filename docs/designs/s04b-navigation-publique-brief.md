# Design Brief — Story s04b-navigation-publique

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix (the app's `en`/`es` routing config still exists in code as unresolved debt from
> an earlier story — irrelevant to this design, which is fr-only like everything else in the product).

## Story

**En tant que** membre du bureau **je veux** décider où mes pages apparaissent dans le menu et ce que
dit le pied de page **afin que** le visiteur trouve le site sans connaître les URL.

Acceptance criteria:

- Le bureau compose le **menu du site public** : ajouter une entrée pointant vers une page, la
  retirer, en changer l'ordre. Le menu rendu au visiteur reflète cet ordre.
- Une page publiée mais absente du menu reste atteignable par son URL ; une entrée de menu pointant
  vers une page dépubliée ou supprimée **ne s'affiche pas** au visiteur, sans casser le rendu du menu.
- Le bureau modifie le contenu du **pied de page** ; la modification est visible sur toutes les pages
  publiques.
- Le menu et le pied de page sont **scopés au tenant** : deux associations servent deux navigations
  distinctes.
- Publier ou dépublier une page met le menu à jour **sans délai de revalidation**.
- Une entrée de menu porte sa **propre visibilité**, réglable indépendamment du statut de publication
  de sa page cible — l'entrée reste masquée si sa page cesse d'être publiée, et le bureau peut aussi la
  masquer lui-même sans dépublier la page ni retirer l'entrée.
- Un membre non-bureau ne peut modifier ni le menu ni le pied de page.

Contexte produit : même public que la story des pages (s04) — 3 à 8 bénévoles élus, non techniciens,
souvent âgés. Périmètre volontairement étroit : **une seule profondeur de menu**, pas de sous-menus ;
l'en-tête au-delà du logo et de la teinte (déjà livrés) n'est pas dans cette story.

**Décisions de périmètre prises pour ce design** (à valider en relisant le brief, pas à redécider
sur le canevas) :

1. **Le menu et le pied de page composés par le bureau remplacent le menu et le pied de page
   actuels du produit**, qui sont du contenu de démonstration SaaS hérité du boilerplate (liens
   « Privacy », « Terms », « Pricing », « Demo », texte « By Mike »…) sans rapport avec une
   association. Ce n'est pas un ajout à côté : c'est un remplacement.
2. **Le pied de page est un champ de contenu unique** (texte riche restreint, même barre que le bloc
   « texte riche » des pages), pas plusieurs colonnes de liens comme l'actuel pied SaaS. Le CDCT ne
   précise pas de structure plus riche, et la story est de complexité 2.

## Screens to produce

### Écran 1 · Bureau — Navigation du site

- **Purpose** : composer le menu (ajouter/retirer/réordonner des entrées vers ses pages) et éditer le
  contenu du pied de page, dans un seul écran à deux sections.
- **Layout** : `h1` « Navigation du site » en tête de section. Deux `card` empilées (gouttière 24 px) :
  1. **Card « Menu du site »** : liste réordonnable des entrées actuelles (réutiliser
     **exactement** `<SortableList />` du design system, §2.4 — poignée + boutons Monter/Descendre
     toujours visibles, jamais au survol seul, annonces `aria-live`, bande d'annulation 10 s). Chaque
     ligne : poignée (44 px), pastille de rang écrite (« 2 sur 4 »), titre de la page cible + son statut
     en `meta` (Publiée / Brouillon / Dépubliée), un `switch` « Visible dans le menu » (effet
     immédiat, libellé d'état — §2.1), boutons Monter/Descendre, bouton « Retirer du menu » (icône +
     libellé). Sous la liste, un bouton `outline` « + Ajouter une entrée » qui ouvre un sélecteur
     (`command`, recherche — back-office uniquement, §2.1) listant les pages de l'association qui ne
     sont pas déjà dans le menu, chacune avec son statut visible dans la liste de résultats. Toute
     action de cette Card (ajouter, retirer, réordonner, bascule de visibilité) s'applique
     **immédiatement**, sans bouton d'enregistrement séparé — comme le réordonnancement des blocs de
     page dans s04.
  2. **Card « Pied de page »** : un seul champ `markdown-editor` **restreint** (même barre réduite que
     le bloc « texte riche » des pages : gras, italique, titre 2, titre 3, liste, lien — pas de
     tableau, pas de code, pas de couleur), libellé « Contenu du pied de page », aide sous le champ
     (« Affiché en bas de toutes les pages du site public. »). Bouton `default` (le seul de l'écran)
     « Enregistrer » en pied de Card, désactivé et libellé remplacé pendant l'enregistrement, largeur
     conservée.
- **Fields / content** : entrées du menu de l'association courante uniquement ; pages disponibles pour
  une nouvelle entrée = toutes les pages de l'association (statut visible), pas seulement les
  publiées — une entrée peut être préparée avant publication, elle restera simplement masquée côté
  public jusqu'à ce que sa page soit publiée (voir États).
- **Actions** : ajouter une entrée, la retirer, la réordonner (boutons, clavier), basculer sa
  visibilité, éditer et enregistrer le pied de page.
- **States** :
  - **Menu vide** : « Aucune entrée dans le menu. → Ajouter une page » (lien vers le sélecteur).
  - **Chargement** : `skeleton` sur les lignes de la liste et sur le champ du pied de page.
  - **Entrée dont la page est dépubliée ou en brouillon** : ligne conservée dans la liste du bureau
    (il ne perd pas sa place), mais avec une annotation en clair sous le titre : « Masquée sur le site
    public — la page n'est pas publiée » (`meta`, ton `muted-foreground`, pas une couleur d'alerte : ce
    n'est pas une erreur, c'est un état normal). Le `switch` de visibilité reste actionnable
    indépendamment de cette annotation.
  - **Enregistrement du pied de page réussi/échoué** : `alert` ancrée sous le champ en cas d'échec
    (jamais un toast) ; pas d'état de succès visible au-delà du bouton qui redevient actif — rien
    d'important à confirmer ici.
- **Mobile (390 px)** : les deux Cards restent empilées, pleine largeur, gouttière 16 px. Les lignes du
  menu suivent le patron mobile de `<SortableList />` déjà établi par s04 (poignée et boutons
  Monter/Descendre conservés, jamais de glisser-déposer requis). Le sélecteur `command` passe en
  `sheet` bas d'écran. Bouton « Enregistrer » du pied de page pleine largeur, 56 px.

### Écran 2 · Site public — Menu et pied de page rendus

- **Purpose** : montrer le résultat du composeur, dans l'en-tête et le pied de page publics existants
  (logo/teinte déjà en place, à ne pas redessiner — seulement la zone de navigation et le pied).
- **Layout** : en-tête public existant (logo/monogramme + nom de l'association), avec la zone de
  navigation remplacée par les entrées visibles du menu, dans leur ordre, chacune en lien texte simple
  (pas de bouton, pas d'icône). Pied de page : le contenu unique édité par le bureau, rendu comme un
  bloc de texte riche (mêmes règles de rendu que le bloc « texte riche » des pages — §4 du design
  system : `h2`/`h3` seulement, gras, italique, listes, liens).
- **Fields / content** : 3-4 entrées de menu typiques (« Qualité de l'eau », « Adhérer à
  l'association », « Fête de l'étang 2025 » — cohérent avec les données fictives de s04) ; un pied de
  page court (2-3 phrases + un lien).
- **States** :
  - **Menu avec une entrée masquée** : montrer la même association que l'écran 1 mais **sans** l'entrée
    masquée — rien à sa place, pas d'espace vide ni de trait cassé (même principe que le bloc
    incomplet des pages : un élément absent est simplement omis).
  - **Menu vide** : en-tête avec seulement le logo/nom de l'association, aucune zone de navigation
    affichée (pas de conteneur vide visible).
- **Mobile (390 px)** : le menu passe dans le tiroir mobile existant (`PublicMobileMenu`, déjà en
  place pour l'en-tête) — montrer son contenu avec les entrées du bureau à la place des liens actuels.
  Le pied de page passe en une colonne, gouttière 18 px.

## Design system constraints (non-negotiable)

**Tokens — deux thèmes, clair et sombre (ADR 012)** :

**Clair** (`:root`) :

```
--background: oklch(1 0 0)           --foreground: oklch(0.22 0.015 250)
--card: oklch(1 0 0)                 --muted: oklch(0.972 0.005 240)
--muted-foreground: oklch(0.45 0.02 245)   --border: oklch(0.9 0.008 245)
--input: oklch(0.66 0.014 245)       --ring: oklch(0.55 0.11 235)
--primary: oklch(0.35 0.06 240)      --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.965 0.006 240)  --destructive: oklch(0.48 0.17 27)
--link: oklch(0.45 0.13 250)
--warning: oklch(0.94 0.06 75)  --warning-border: oklch(0.72 0.12 70)  --warning-foreground: oklch(0.3 0.08 60)
--accent-hue: 195 (démo — bleu « eau », teinte réelle choisie par association, six teintes possibles)
--accent: oklch(0.958 0.024 195)     --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)  --accent-border: oklch(0.88 0.045 195)
--sidebar: oklch(0.985 0.004 250)    --sidebar-foreground: oklch(0.26 0.015 250)
--sidebar-accent: oklch(0.93 0.012 245)  --sidebar-border: oklch(0.91 0.008 245)
--radius: 0.5rem (rounded-md 8px champs/boutons/cartes, rounded-lg 12px feuilles/dialogues, rounded-full badges)
```

**Sombre** (`.dark`, ADR 012 — conservé) :

```
--background: oklch(0.215 0.009 255)      --foreground: oklch(0.94 0.006 250)
--card: oklch(0.215 0.009 255)            --muted: oklch(0.255 0.009 250)
--muted-foreground: oklch(0.72 0.015 248) --border: oklch(0.33 0.01 250)
--input: oklch(0.52 0.016 250)            --ring: oklch(0.7 0.12 235)
--primary: oklch(0.5 0.14 255)            --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.27 0.01 250)         --destructive: oklch(0.58 0.19 27)
--link: oklch(0.8 0.1 250)
--warning: oklch(0.3 0.05 75)  --warning-border: oklch(0.6 0.11 70)  --warning-foreground: oklch(0.93 0.05 80)
--accent-hue: 195 (même teinte de démo qu'en clair)
--accent: oklch(0.275 0.035 195)          --accent-foreground: oklch(0.84 0.075 195)
--accent-solid: oklch(0.64 0.11 195)      --accent-border: oklch(0.4 0.055 195)
--sidebar: oklch(0.19 0.009 255)          --sidebar-foreground: oklch(0.93 0.006 250)
--sidebar-accent: oklch(0.3 0.014 250)    --sidebar-border: oklch(0.32 0.01 250)
```

**Typographie** : Source Serif 4 (`h1` 34px/600, `h2` 26px/600), Public Sans (`h3` 20px/600, `body`
17px, `body-lg` 18px pour le site public, `label` 16px/500, `button` 16-17px/600, `meta` 15px),
JetBrains Mono (`overline`/statuts, `data` chiffré). Texte jamais sous 17 px (public : jamais sous
18 px). « Facultatif » écrit en clair, jamais d'astérisque pour l'obligatoire.

**Espacement** : échelle à 8 valeurs — 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px. Rien en dehors.

**Cibles et focus** : 44×44 minimum, 56 px pour les actions principales sur mobile. `outline: 2px
solid var(--ring); outline-offset: 2px` — jamais `outline: none`. Aucune action au survol seul.

**Composants à réutiliser tels quels** : `button` (un seul `default` par écran, le reste `outline`),
`card`, `switch` (effet immédiat, libellé d'état, jamais pour une action différée), `command`
(back-office seulement, recherche), `markdown-editor` restreint (gras/italique/titre 2-3/liste/lien
seulement), `alert` (jamais de toast pour un échec), `skeleton` (listes seulement, jamais un
formulaire), `sidebar` (nouvelle entrée dans le groupe déjà ouvert « Le site »).

**`<SortableList />` — réutiliser à l'identique, ne pas réinventer** (design system §2.4, déjà
construit par s04) :

```
items[] · getId(item) · onReorder(nextItems, moved)
renderItem(item, {index, total, isDragging}) · showMoveButtons = true · undoWindowMs = 10000
Poignée ET boutons Monter/Descendre toujours visibles. Premier item : "Monter" visible et désactivé.
Cibles 44x44. Annulation : bande ancrée sous la liste, 10s. aria-live="polite" à chaque déplacement.
```

**Do / Don't** :

- ✅ Une seule action `default` par écran (« Enregistrer » du pied de page) ; tout le reste en
  `outline`, `switch`, ou boutons d'icône+libellé.
- ✅ Une entrée masquée reste visible **au bureau** (avec la raison écrite), jamais silencieusement
  retirée de sa vue.
- ✅ Une entrée masquée côté public est **omise**, jamais affichée en lien cassé ou en espace vide.
- ✅ Glisser-déposer en option seulement (boutons Monter/Descendre en premier rang).
- ❌ Colonnes multiples de liens dans le pied de page (voir décision de périmètre n°2).
- ❌ Sous-menus, menu à plusieurs niveaux.
- ❌ Bouton d'enregistrement séparé pour les actions du menu (elles sont immédiates).
- ❌ `tabs` pour séparer menu et pied de page — ils tiennent dans deux Cards de la même page.

## Out of scope

- **L'en-tête au-delà de la zone de navigation** (logo, teinte, nom de l'association) — déjà livré,
  ne pas redessiner.
- **La création, l'édition ou la publication d'une page** — story s04, déjà livrée. Cet écran ne fait
  que sélectionner une page existante par son titre et son statut.
- **Les sous-menus ou une profondeur de menu supplémentaire** — hors périmètre assumé de la story.
- **Un module d'apparence pour le pied de page** (couleurs, mise en page) — un seul champ de texte
  riche, rien d'autre.

## Expected output

Un mockup HTML statique de chaque écran ci-dessus (basse fidélité acceptable), en **desktop et mobile
390 px**, avec un **bascule clair/sombre** (les deux jeux de tokens ci-dessus), utilisant exclusivement
les tokens et composants ci-dessus — en particulier `<SortableList />` réutilisé à l'identique, pas
redessiné depuis zéro. Sera enregistré comme `docs/designs/s04b-navigation-publique.html`.
