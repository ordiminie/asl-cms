# Design Brief — Story s04-pages-cms

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** membre du bureau **je veux** créer, modifier, publier et dépublier une page composée
de blocs **afin de** faire vivre le site sans intervention du prestataire.

Acceptance criteria:

- Le bureau crée une page (titre, slug, contenu riche, images) et la voit rendue à l'URL publique une
  fois publiée.
- Une page en brouillon n'est pas accessible publiquement (404 pour un visiteur) mais reste
  prévisualisable par le bureau.
- Dépublier une page la retire du site public sans la supprimer ; la republier la restaure à
  l'identique.
- L'insertion d'une image dans une page l'enregistre dans le stockage de fichiers et l'affiche dans le
  rendu public.
- Un slug déjà utilisé dans la même association est refusé avec un message de champ.
- Un membre non-bureau ne peut ni créer ni modifier de page.
- Une page est une **liste ordonnée de blocs typés**, pas un champ de texte unique : insertion à un
  rang précis, réordonnancement, le rendu public respecte l'ordre.
- Le réordonnancement est atteignable **sans glisser-déposer** — au clavier seul, même résultat qu'à
  la souris.
- Un type de bloc inconnu dans une page enregistrée ne casse pas le rendu : la page s'affiche, le bloc
  est ignoré et signalé au bureau.

Contexte produit : les utilisateurs du back-office sont 3 à 8 bénévoles élus, non techniciens, qui
changent tous les quelques années, souvent âgés et peu à l'aise avec l'informatique. Référence
d'ergonomie visée par le cahier des charges : un éditeur de pages type WordPress — sans en reprendre
l'identité visuelle, seulement le confort d'usage (voir/composer plutôt que rédiger de la syntaxe).

## Screens to produce

Cinq écrans (le premier existe déjà en code — inclus ici uniquement comme repère de continuité, ne
pas le reproduire) :

### 0 · Repère de continuité — chrome du back-office (déjà livré, ne pas redessiner)

Le back-office (`/bureau`) a déjà une barre latérale (`sidebar`, 248 px fixe → tiroir sous `lg`) avec
un groupe **« L'association »** contenant Identité et Réglages (livrés par s01b et s02). Le design
system prévoit un second groupe, **« Le site »**, qui n'existe pas encore dans le code : **c'est cette
story qui l'ouvre**. Reprendre exactement la même barre latérale, le même en-tête (logo/monogramme +
nom de l'association, 34 px, en tête de la sidebar), et ajouter le groupe « Le site » avec son
libellé de groupe (14 px, mono, majuscules, `tracking-widest`) au-dessus du groupe « L'association »
existant (ordre : Le site, puis L'association). La première entrée du nouveau groupe est **« Pages »**
et pointe vers l'écran 1.

### 1 · Bureau — Liste des pages

- **Purpose** : voir toutes les pages de l'association, leur statut, et entrer dans l'édition ou en
  créer une nouvelle.
- **Layout** : `card` pleine largeur sous l'en-tête de section (`h1` « Pages »), bouton `default`
  « Nouvelle page » en tête à droite du titre. En dessous, un `table` : colonne Titre (avec le slug en
  `meta` gris juste en dessous, format `/mon-slug`), colonne Statut (`badge` — voir États), colonne
  Dernière modification (date en clair, `meta`), colonne Actions (« Modifier », seule action en
  clair, pas de menu d'icônes).
- **Fields / content** : liste des pages de l'association courante uniquement, triée par dernière
  modification décroissante.
- **Actions** : « Nouvelle page » (ouvre l'écran 2 vide) ; « Modifier » par ligne (ouvre l'écran 2
  rempli). Pas de suppression dans cette story (dépublier suffit, voir critère 3).
- **States** :
  - **Vide** : « Aucune page pour l'instant. → Créer la première » (lien vers Nouvelle page).
  - **Chargement** : `skeleton` sur les lignes du tableau.
  - **Succès** : liste peuplée, comme ci-dessus.
- **Mobile (390 px)** : patron « tableau sous 640 px » du design system — chaque ligne devient une
  carte : titre + slug en tête, statut et date en paires libellé/valeur, bouton « Modifier » pleine
  largeur (56 px) en pied de carte. Bouton « Nouvelle page » reste en tête, pleine largeur.

### 2 · Bureau — Éditeur de page (écran principal, P0)

C'est l'écran qui porte tout le risque de la story. Composition : une **barre d'en-tête** fixe pour le
titre/slug et les actions globales, une **colonne de blocs** (le contenu), un **panneau latéral** de
296 px (paramètres de page : titre, slug), qui passe en tiroir sous `xl` — gabarit « Éditeur de page »
du design system §1.6.

- **Barre d'en-tête / `<PreviewBar />`** (P0 du design system, à construire) : sticky, 68 px
  (104 mobile), fond sombre `oklch(0.24 0.02 250)` **hors palette de contenu** — volontairement
  distincte du reste de l'écran pour ne jamais se confondre avec le contenu de la page. Contient :
  bouton retour vers l'écran 1, statut courant en **point + libellé écrit** (jamais la couleur
  seule) — `draft` (brouillon), `dirty` (modifications non enregistrées), `live` (publiée),
  `publishing` (en cours), `error` (échec), `unpublished` (dépubliée) — et les actions à droite :
  « Enregistrer le brouillon », puis le bouton `default` unique de l'écran, contextuel au statut :
  « Publier la page » (si `draft`/`unpublished`), « Dépublier » (si `live`, en `outline`, avec
  confirmation `alert-dialog` car irréversible pour le visiteur), « Aperçu » (ouvre le rendu public en
  nouvel onglet, seulement si la page a déjà été publiée une fois). **L'erreur s'affiche en 2ᵉ ligne de
  la barre elle-même, jamais en toast.**
- **Panneau « Paramètres »** (296 px, tiroir sous `xl`) : champ `input` Titre (48 px, texte 17-18 px,
  libellé au-dessus), champ `input` Slug avec préfixe visuel `/` et aide sous le champ
  (« Utilisé dans l'adresse publique de la page ») ; erreur de slug dupliqué : bordure `destructive`
  2 px + message sous le champ (« Ce slug est déjà utilisé par une autre page »), jamais de blocage
  silencieux.
- **Colonne de blocs — `<SortableList />` + `<BlockPicker />`** (P0, à construire) :
  - Un séparateur **« + Insérer un bloc ici »**, visible en permanence (jamais au survol seul), 44 px
    de haut, entre chaque paire de blocs et au sommet de la liste. Au clic/à l'activation, il ouvre le
    `<BlockPicker />` : liste de 5 types en clair, chacun avec un nom, une phrase d'usage et un aperçu
    miniature (Texte riche, Image + légende, Document PDF, Galerie, Encart — voir table exacte
    ci-dessous). Recherche facultative. Cinq lignes, pas de catégories ni d'onglets.
  - Chaque bloc dans la liste porte, en tête de ligne : une **poignée** (icône `GripVertical`, zone de
    44 px de large sur toute la hauteur de la ligne), une **pastille de rang** (« 2 sur 4 », le rang
    **écrit**, jamais porté par la seule position), le **type du bloc** en `overline` (mono,
    majuscules), puis deux boutons « Monter » / « Descendre » toujours visibles (jamais révélés au
    survol), le premier bloc ayant « Monter » **visible mais désactivé**, le dernier « Descendre »
    désactivé. Un bouton « Supprimer le bloc » (icône + libellé, pas d'icône seule) en fin de ligne.
    Sous cet en-tête, le contenu éditable du bloc (voir les cinq gabarits ci-dessous).
  - En bas de la liste, un « + Ajouter un bloc » pleine largeur, même mécanique que le séparateur.
  - Annonces d'accessibilité en `aria-live="polite"` à chaque déplacement (« Image + légende, position
    2 sur 4 ») ; annulation d'un déplacement : une seule bande ancrée sous la liste, 10 secondes,
    jamais un toast.
- **Les cinq gabarits d'édition de bloc** (contenu affiché à l'intérieur de chaque ligne de la
  `<SortableList />`, une fois le bloc inséré) :
  1. **Texte riche** — `markdown-editor` à barre réduite (gras, italique, titre 2, titre 3, liste,
     lien **seulement** — pas de tableau, pas de code, pas de couleur de texte).
  2. **Image + légende** — `file-upload` (zone de dépôt + bouton « Choisir un fichier », masquée au
     tactile), aperçu de l'image une fois déposée, champ `input` **Texte alternatif** (obligatoire,
     état vide signalé : « Obligatoire pour publier »), champ `textarea` **Légende** (facultatif,
     écrit « Facultatif » en clair, jamais d'astérisque).
  3. **Document PDF** — `file-upload` (types/poids annoncés avant l'échec), champ `input` **Titre du
     document** (obligatoire — jamais le nom du fichier affiché tel quel côté public), aperçu = nom du
     fichier + poids une fois déposé.
  4. **Galerie** — `file-upload` multi-fichiers, grille de vignettes 1:1 avec un bouton de suppression
     par vignette, chaque vignette avec son propre champ `alt` (obligatoire par image).
  5. **Encart** — champ `input` **Titre** (facultatif), `markdown-editor` restreint (même barre que le
     bloc texte riche), aperçu **teinté aux couleurs de l'association** (`accent-foreground` sur
     `accent`) directement dans l'éditeur pour que le bureau voie l'effet avant publication. Rappeler
     dans l'aide du bloc : « Pas de bouton dans un encart. Deux encarts qui se suivent ne sont pas
     recommandés. »
- **États d'un bloc incomplet** (montrer les deux, dans l'éditeur) : pour un bloc Image ou PDF sans
  fichier déposé, `alert` ancrée **dans le bloc lui-même** : « Ce bloc n'a pas de fichier. Il
  n'apparaît pas sur le site public tant qu'un document n'est pas déposé », avec les deux actions
  « Déposer le fichier » / « Supprimer le bloc ».
- **Bloc de type inconnu** (état à montrer une fois, pour couvrir le critère 9) : ligne grisée,
  libellé « Type de bloc inconnu (`nom-du-type`) — ignoré à l'affichage public », bouton « Supprimer le
  bloc » seul disponible (pas d'édition possible d'un type qu'on ne reconnaît pas).
- **Mobile (390 px)** : le panneau « Paramètres » passe en `sheet` (tiroir), ouvert par un bouton
  « Paramètres de la page » dans la `<PreviewBar />`. La colonne de blocs occupe toute la largeur,
  gouttière 18 px. La `<PreviewBar />` passe à 104 px pour accueillir le libellé de statut sur sa
  propre ligne si besoin. Les boutons Monter/Descendre restent visibles (pas de glisser-déposer
  attendu au tactile non plus — mêmes cibles 44 px).

### 3 · Bureau — `<BlockPicker />` ouvert (état de l'écran 2, à montrer isolément)

Zoom sur le sélecteur ouvert (probablement en `popover` ou petit `dialog` ancré au séparateur cliqué) :
les cinq lignes, chacune avec nom + phrase d'usage + aperçu miniature 60×40 environ, recherche
facultative en tête (`input` avec icône loupe). Montrer desktop et mobile (mobile : `sheet` bas
d'écran plutôt que `popover`, pour rester au pouce).

### 4 · Site public — Rendu d'une page publiée

Le rendu de chacun des cinq blocs, dans une page complète (en-tête public déjà existant + pied de page
existant, ne pas les redessiner — seulement le corps de page entre les deux) :

| Bloc            | Rendu attendu                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Texte riche     | `h2`/`h3` seulement, gras, italique, listes, liens. Paragraphes `body-lg` (18 px / 1.65). Pas de tableau, pas de couleur de texte.                                                                        |
| Image + légende | `<figure>` + `<figcaption>` (la légende est du texte, jamais incrustée dans l'image). Ratio libre, hauteur plafonnée 520 px, chargement paresseux.                                                        |
| Document PDF    | Titre écrit par le bureau, résultat en clair, poids annoncé, ouverture en nouvel onglet annoncée.                                                                                                         |
| Galerie         | Grille de 3 colonnes (2 sous 900 px, 1 sous 640 px), vignettes 1:1. Au clic, `dialog` avec « Précédente / Suivante » **écrits** (pas d'icône seule). Au-delà de 6 vignettes, une tuile de report « + N ». |
| Encart          | `accent-foreground` sur `accent`, titre facultatif, texte, liens — jamais de bouton dedans.                                                                                                               |

Montrer aussi **l'état « bloc incomplet côté public »** : rien — un bloc Image sans fichier ou une
galerie vide est **omis du rendu**, jamais affiché en boîte vide ni en icône cassée. Une capture de
page où un bloc manque simplement à la suite des autres suffit à illustrer.

**Mobile (390 px)** : gouttière 18 px sauf Image et Galerie qui passent pleine largeur sans marge.
Espacement entre blocs 24 px. Galerie en une colonne, vignettes 4:3, report après deux photos. Bloc PDF
: bouton pleine largeur sous le titre. Texte long : aucune troncature, pas de « lire la suite ».

## Design system constraints (non-negotiable)

**Tokens — deux thèmes, clair et sombre (ADR 012)** (le back-office reprend les mêmes tokens que le
public, seule la `sidebar` a sa propre palette dans chaque thème) :

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

**Sombre** (`.dark`, ADR 012 — **conservé, pas abandonné** : le produit garde les deux thèmes, un
sélecteur `next-themes`, et toute livraison de conception doit fournir les deux jeux de tokens) :

```
--background: oklch(0.215 0.009 255)      --foreground: oklch(0.94 0.006 250)
--card: oklch(0.215 0.009 255)            --muted: oklch(0.255 0.009 250)
--muted-foreground: oklch(0.72 0.015 248) --border: oklch(0.33 0.01 250)
--input: oklch(0.52 0.016 250)            --ring: oklch(0.7 0.12 235)
--primary: oklch(0.5 0.14 255)            --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.27 0.01 250)         --destructive: oklch(0.58 0.19 27)
--link: oklch(0.8 0.1 250)
--warning: oklch(0.3 0.05 75)  --warning-border: oklch(0.6 0.11 70)  --warning-foreground: oklch(0.93 0.05 80)
--accent-hue: 195 (même teinte de démo qu'en clair ; ne pas figer --accent-hue dans .dark en réel,
   c'est injecté par le serveur — figer 195 est correct seulement pour cette maquette de démo)
--accent: oklch(0.275 0.035 195)          --accent-foreground: oklch(0.84 0.075 195)
--accent-solid: oklch(0.64 0.11 195)      --accent-border: oklch(0.4 0.055 195)
--sidebar: oklch(0.19 0.009 255)          --sidebar-foreground: oklch(0.93 0.006 250)
--sidebar-accent: oklch(0.3 0.014 250)    --sidebar-border: oklch(0.32 0.01 250)
```

⚠️ Le trio `warning` en sombre est une valeur **dérivée**, non validée par la conception (le design
system ne le couvre qu'en clair) — à utiliser tel quel, sans l'ajuster davantage dans cette maquette.

Équivalents hex utiles pour l'aperçu en teinte réelle (n'importe laquelle des six, `accent-solid` /
`accent` / `accent-foreground`) : eau `#17849B` / `#E8F5F8` / `#185A66` — pins `#2E7D52` / `#E7F5EC` /
`#1E4A31` — lac `#3A6FB0` / `#EAF1FA` / `#23445F` — tuile `#A8623A` / `#F8EDE6` / `#5E3421` — bruyère
`#7A5AA8` / `#F1ECF9` / `#3F2E5C` — genêt `#7C7326` / `#F4F2E2` / `#423D14`.

**Typographie** : Source Serif 4 (titres — `h1` 34px/600, `h2` 26px/600), Public Sans (texte —
`h3` 20px/600, `body` 17px, `body-lg` 18px pour le site public, `label` 16px/500, `button` 16-17px/600,
`meta` 15px), JetBrains Mono (`overline` 12px/600 tracking large — type de bloc, statuts —, `data` pour
tout ce qui est chiffré). Texte courant jamais sous 17 px (public : jamais sous 18 px). Pas de
placeholder en guise de libellé, pas d'astérisque pour l'obligatoire (écrire « Facultatif » à la place).

**Espacement** : échelle à 8 valeurs seulement — 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px. Rien en dehors.

**Cibles et focus** : 44×44 minimum, 56 px pour les actions principales sur mobile. `outline: 2px solid
var(--ring); outline-offset: 2px` — jamais `outline: none`. Aucune action déclenchée au survol seul.

**Composants à réutiliser tels quels** (socle shadcn existant, conventions imposées rappelées) :
`button` (un seul `default` par écran, le reste en `outline`, libellés à l'infinitif : « Publier la
page », pas « OK »), `input`/`textarea`/`select`/`checkbox`/`radio-group` (une colonne, libellé
au-dessus, validation au blur), `table`/`badge` (une seule action par ligne, badge = statut jamais une
action), `alert`/`alert-dialog`/`sheet`/`dialog` (rien d'important dans un toast ; `alert-dialog`
seulement pour l'irréversible — dépublier une page en fait partie), `sidebar` (back-office, item actif
= fond `sidebar-accent` + libellé 600), `markdown-editor` **restreint à sa barre réduite** (gras,
italique, titre 2/3, liste, lien), `file-upload` (zone de dépôt + bouton, masquée au tactile),
`skeleton` (listes/tableaux seulement, jamais un formulaire).

**Composants à construire, entièrement spécifiés ici (P0 du design system, aucun ne doit être
réinventé au-delà de cette spec)** :

```
<PreviewBar />
status: draft | dirty | live | publishing | error | unpublished
Fond oklch(0.24 0.02 250), sticky, 68px desktop / 104px mobile.
Erreur en 2e ligne de la barre, jamais en toast. Point + libellé écrit, jamais la couleur seule.

<SortableList />
items[] · getId(item) · onReorder(nextItems, moved)
renderItem(item, {index, total, isDragging}) · showMoveButtons = true · undoWindowMs = 10000
Poignée ET boutons Monter/Descendre toujours visibles, jamais au survol seul.
Premier item : "Monter" visible et désactivé, jamais absent. Cibles 44x44, poignée 44px de large.
Annulation : bande ancrée sous la liste, 10s, un seul niveau. aria-live="polite" à chaque déplacement.

<BlockPicker />
types: 5 (Texte riche, Image + légende, Document PDF, Galerie, Encart) · insertAt: number
Séparateur "+ Insérer un bloc ici" visible en permanence entre deux blocs, 44px de haut.
"+ Ajouter un bloc" pleine largeur en bas de liste. Recherche facultative. Jamais plus de 5 types,
pas de catégories, pas d'onglets, pas de défilement caché.
```

**Do / Don't** (rappel du design system, ceux qui s'appliquent le plus à cet écran) :

- ✅ Une seule action `default` par écran ; tout le reste en `outline`.
- ✅ Icône + libellé toujours, jamais une icône seule comme action.
- ✅ Glisser-déposer = option en plus, jamais le seul chemin (boutons Monter/Descendre en premier
  rang).
- ✅ Un bloc incomplet est **omis** du rendu public, jamais affiché cassé.
- ✅ Un message d'erreur dit ce qui est perdu — le plus souvent, que rien ne l'est.
- ❌ L'accent (teinte de l'association) sur un bouton, ou comme unique porteur d'un statut.
- ❌ `tabs` pour organiser l'éditeur — pas prévu, ne pas en introduire.
- ❌ Menu d'icônes en bout de ligne de tableau (liste des pages) — une seule action en clair.
- ❌ Défilement infini ; action déclenchée au survol seul ; `outline: none`.

## Out of scope

- **La navigation du site public** (menu, pied de page) — story s04b, distincte. Cet écran ne montre
  qu'une page atteinte par son URL directe, sans en-tête de menu à composer.
- **Actualités, fiches du bureau, analyses d'eau** — modèles à champs fixes, stories s05/s06/s09.
  N'ajoutent aucun écran ici.
- **La visionneuse de galerie complète** (flèches de navigation entre images, compteur « 3 sur 10 »)
  — manque signalé du design system (§9), non spécifié davantage : montrer seulement l'ouverture du
  `dialog` avec Précédente/Suivante, pas la mécanique interne de navigation.
- **L'échelle de `z-index` globale** — manque signalé partagé avec s07/s41, non tranché ici :
  n'empiler qu'un seul niveau flottant à la fois dans les maquettes (`<PreviewBar />` **ou**
  `<BlockPicker />` ouvert, jamais les deux en simulant un conflit).
- **La suppression définitive d'une page** — hors critères de cette story (seule la
  dépublication existe).
- Tout réglage d'association (teinte, adresses) — déjà livré par s02, ne pas redessiner l'écran
  Réglages.

## Expected output

Un mockup HTML statique de chaque écran ci-dessus (basse fidélité acceptable), en **desktop et mobile
390 px**, avec un **bascule clair/sombre** (ADR 012 — les deux jeux de tokens ci-dessus, pas
seulement le clair), utilisant exclusivement les tokens et composants ci-dessus. Sera enregistré comme
`docs/designs/s04-pages-cms.html`.
