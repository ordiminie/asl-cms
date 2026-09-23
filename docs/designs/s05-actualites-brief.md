# Design Brief — Story s05-actualites

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** membre du bureau **je veux** publier des actualités datées **afin d'**informer les
membres et les visiteurs de la vie de l'association.

Acceptance criteria:

- Le bureau crée une actualité (titre, date, image, contenu) et la voit apparaître en tête de la liste
  publique une fois publiée.
- La liste publique est triée par date décroissante et paginée ; chaque actualité a sa page dédiée avec
  une URL stable.
- Une actualité en brouillon n'apparaît ni dans la liste ni à son URL pour un visiteur.
- Les actualités d'une association ne sont jamais visibles sur le site d'une autre _(isolation — pas
  d'écran à dessiner)_.

Contexte produit : le back-office est utilisé par 3 à 8 bénévoles élus, non techniciens, souvent âgés.
Le site public s'adresse aux propriétaires (souvent âgés) et aux visiteurs sans compte. Critère de
recette : un membre du bureau, **seul devant l'écran**, crée et publie une actualité.

**Une actualité n'est pas une page.** Les pages (story précédente, s04) sont des listes de blocs
libres. Une actualité est un **modèle à champs fixes** : titre, date, image, contenu — toujours dans cet
ordre, pas de blocs, pas de glisser-déposer, pas de sélecteur de blocs. L'écran d'édition est donc un
**formulaire simple en une colonne**, beaucoup plus court que l'éditeur de page. Il réemploie seulement
des pièces de l'éditeur de page : la barre d'aperçu `<PreviewBar />`, l'éditeur de texte à barre réduite,
le champ image avec texte alternatif.

## Screens to produce

Cinq écrans, plus un repère de continuité. Données fictives : association « Les Amis de l'Étang »,
teinte « eau » (195). Actualités d'exemple : « Assemblée générale du 10 octobre » (2 septembre 2026),
« Travaux sur la canalisation du chemin des Pins » (18 août 2026), « Résultats de l'analyse d'eau de
juillet » (29 juillet 2026), « Fête de l'étang : merci à tous » (14 juillet 2026).

### 0 · Repère de continuité — barre latérale du back-office (déjà livrée, ne pas redessiner)

Le back-office (`/bureau`) a déjà une barre latérale (`sidebar`, 248 px fixe → tiroir `sheet` sous
`lg`), avec l'identité de l'association en tête (logo ou monogramme 34 px + nom). Elle compte deux
groupes : **« Le site »** (Pages, Navigation), puis **« L'association »** (Identité, Réglages). Cette
story ajoute **« Actualités »** au groupe « Le site », **entre « Pages » et « Navigation »**. Montrer la
barre latérale avec « Actualités » actif sur l'écran 1 seulement (fond `sidebar-accent` + libellé 600).

### 1 · Bureau — Liste des actualités

- **Purpose** : voir toutes les actualités de l'association avec leur date et leur statut, en ouvrir une,
  en créer une nouvelle.
- **Layout** : `h1` « Actualités » + bouton `default` « Nouvelle actualité » à droite du titre. Dessous,
  un `table` dans une `card` pleine largeur :
  - **Titre** : texte `body-strong` ;
  - **Date** : `02/09/2026` en `data` (`font-mono`, `tabular-nums`) ;
  - **Statut** : `badge` à point + libellé écrit (Publiée / Brouillon / Dépubliée) ;
  - **Action** : un seul lien « Modifier », en clair.
- **Tri** : par date décroissante, la plus récente en haut (même ordre que le site public).
- **Pagination** : `pagination` sous le tableau, « Précédent / Suivant » écrits, **25 lignes par page**
  (règle du tableau). Jamais de défilement infini.
- **Actions** : « Nouvelle actualité » crée un brouillon et ouvre l'écran 2 ; « Modifier » ouvre l'écran 2
  rempli. **Pas de suppression dans cette story.**
- **States** :
  - **Vide** : « Aucune actualité pour l'instant. → Écrire la première ». C'est **l'exemple exact** du
    design system : ce qui manque, puis l'action pour le combler, en lien vers « Nouvelle actualité ».
  - **Chargement** : `skeleton` sur les lignes du tableau.
  - **Succès** : 4 lignes, avec les trois statuts représentés.
- **Mobile (390 px)** : patron « tableau → cartes empilées » du design system. Chaque ligne devient une
  carte : titre en tête, puis Date et Statut en paires libellé / valeur, puis « Modifier » en pleine
  largeur (56 px). « Nouvelle actualité » en tête, pleine largeur 56 px. **10 cartes par page**.

### 2 · Bureau — Éditer une actualité (écran principal)

- **Purpose** : écrire, enregistrer en brouillon, publier, dépublier une actualité.
- **`<PreviewBar />`** (composant déjà construit par s04, à reprendre tel quel) : sticky, 68 px desktop /
  104 px mobile, fond sombre `oklch(0.24 0.02 250)`. Elle ne se confond jamais avec le contenu.
  - **À gauche** : « ← Actualités » (retour à l'écran 1), puis le statut en point + libellé écrit. Six
    valeurs possibles : Brouillon, Modifications non enregistrées, Publiée, Publication en cours, Échec,
    Dépubliée.
  - **À droite** : « Enregistrer le brouillon » (`outline`), « Aperçu » (`outline`, ouvre la page
    publique dans un nouvel onglet, y compris pour un brouillon) et le **seul** bouton `default` de
    l'écran. Ce bouton suit le statut : « Publier l'actualité » pour un brouillon ou une actualité
    dépubliée, « Enregistrer et mettre à jour » pour une actualité déjà publiée.
  - **« Dépublier »** (`outline`) n'apparaît que si l'actualité est publiée. Il ouvre un `alert-dialog` :
    « Dépublier « Assemblée générale du 10 octobre » ? Elle disparaît du site et de la liste des
    actualités. Son contenu est conservé : vous pourrez la republier. » Deux boutons : « Dépublier
    l'actualité » et « Annuler ».
  - **Erreur** : en **2ᵉ ligne de la barre**, jamais en toast. Par exemple : « L'actualité n'a pas pu
    être publiée. L'image n'a pas de texte alternatif. Rien n'est perdu. »
- **Formulaire** : une colonne, `max-w-[68ch]`, centrée dans la zone de contenu. Libellés au-dessus,
  toujours visibles. Champs de 48 px (56 px sur mobile), texte à 17 px. Quatre champs, dans cet ordre :
  1. **Titre** — `input`. Aide sous le champ : « Le titre affiché dans la liste des actualités et en
     haut de la page. »
  2. **Date** — un champ date au format `02/09/2026`, pré-rempli à la date du jour pour une nouvelle
     actualité. Aide : « Les actualités sont classées de la plus récente à la plus ancienne selon
     cette date. » Voir l'écart 2 : le composant exact n'existe pas au design system. Dessiner un
     `input` de 48 px contenant la date au format `jj/mm/aaaa`, avec une icône `Calendar` de 20 px à
     droite. Ne pas inventer de calendrier déroulant.
  3. **Image** — `file-upload` : zone de dépôt **et** bouton « Choisir un fichier ». Consignes écrites
     **avant** tout échec : « PNG, JPEG ou WebP, 5 Mo au plus. » La zone de dépôt est masquée au
     tactile. Une fois l'image déposée :
     - l'aperçu de l'image, avec « Remplacer l'image » et « Retirer l'image », tous deux en `outline` ;
     - dessous, le champ **Texte alternatif** (`input`). Aide sous le champ : « Décrivez l'image pour
       les personnes qui ne la voient pas. Obligatoire pour publier. » Il est obligatoire pour publier,
       pas pour enregistrer le brouillon.
       Le libellé du champ image porte « Facultatif » écrit en clair : une actualité sans image se publie.
  4. **Contenu** — l'éditeur de texte à **barre réduite** de s04 : six actions seulement (gras, italique,
     titre 2, titre 3, liste, lien), puis un `textarea` haut de 12 lignes environ. Pas de tableau, pas
     de code, pas de couleur de texte.
- **Adresse publique** : sous la barre, au-dessus du formulaire, une ligne `meta` : « Adresse sur le
  site : /actualites/assemblee-generale-du-10-octobre ». Elle est **en lecture seule** : l'adresse est
  fixée à la création et ne change pas quand le titre change (URL stable, critère 2). C'est une
  hypothèse de conception, à confirmer au plan.
- **Téléversement en cours** : `progress` **indéterminée** accompagnée du nom du fichier (« Envoi de
  ag-2026.jpg »). L'aperçu précédent reste visible. Pas de pourcentage.
- **States à montrer** :
  - **Brouillon neuf** : champs vides, sauf la date du jour. Statut « Brouillon ».
  - **Modifications non enregistrées + échec de publication**, cumulés dans la barre. L'image est
    déposée sans texte alternatif, et le champ porte l'erreur : bordure `destructive` 2 px et message
    « Ajoutez un texte alternatif pour publier. » sous le champ.
  - **Publiée** : statut « Publiée », bouton « Dépublier » visible. Au-dessus du formulaire, un succès
    ancré (`alert` neutre, `CircleCheck` en `primary`, pas de vert) : « Actualité publiée. Visible à
    l'adresse /actualites/assemblee-generale-du-10-octobre et en tête de la liste des actualités. »
  - Le **`alert-dialog` de dépublication** ouvert.
- **Mobile (390 px)** : `PreviewBar` à 104 px, le statut sur sa propre ligne. Les actions secondaires
  (« Enregistrer le brouillon », « Aperçu », « Dépublier ») passent sous le bouton principal, ou dans la
  seconde ligne de la barre. Le formulaire occupe toute la largeur, gouttière 16 px. Champs à 56 px. Pas
  de zone de dépôt, seulement le bouton « Choisir un fichier » et les consignes.

### 3 · Site public — Liste des actualités (`/actualites`)

- **Purpose** : un visiteur sans compte voit les actualités publiées, la plus récente en tête.
- **Layout** : corps de page seul. L'en-tête public (logo, menu) et le pied de page existent déjà :
  **ne pas les redessiner**, un simple bandeau neutre suffit pour les situer. Gabarit public
  `max-w-[1200px]`, liste centrée à `max-w-[68ch]` environ.
  - `h1` « Actualités » (Source Serif 4, 34 px).
  - Une **liste verticale**, une actualité par élément, séparées par un filet `border`. Chaque élément
    se compose ainsi :
    - la **date en clair** en `meta` (« 2 septembre 2026 ») ;
    - le **titre** en `h2` (26 px, Source Serif 4), qui est le lien vers la page de l'actualité ;
    - l'**image**, si elle existe, en vignette à gauche du texte en desktop. Sans image, **rien** : ni
      cadre vide, ni illustration de remplacement.
    - un lien « Lire l'actualité » en `link`, souligné.
  - **Pas d'extrait du contenu** dans cette story : voir « Out of scope ».
  - **Pagination** en bas : « ← Précédent » / « Suivant → » écrits, et « Page 1 sur 3 » écrit entre les
    deux. « Précédent » est désactivé et annoncé en page 1, jamais absent. **10 actualités par page.**
    Jamais de défilement infini.
- **States** :
  - **Vide** (aucune actualité publiée) : « Aucune actualité pour l'instant. » Pas d'action : un
    visiteur ne peut rien y faire. Pas d'illustration.
  - **Succès** : 4 actualités, dont une sans image.
  - **Page 2** : « Précédent » actif.
  - Pas d'état de chargement ni d'erreur à dessiner : la page est rendue côté serveur.
- **Mobile (390 px)** : gouttière 18 px. L'image passe **au-dessus** du titre, en pleine largeur et sans
  marge (règle mobile des images, §4 du design system). La pagination passe en pleine largeur, boutons
  de 56 px.

### 4 · Site public — Page d'une actualité (`/actualites/{adresse}`)

- **Purpose** : lire une actualité en entier.
- **Layout** : article centré à `max-w-[68ch]`, dans cet ordre :
  1. « ← Toutes les actualités » en `link`, en tête ;
  2. la date en clair en `meta` (« 2 septembre 2026 ») ;
  3. le `h1` (34 px, Source Serif 4) ;
  4. l'image en `<figure>`, hauteur plafonnée à 520 px, avec son texte alternatif. Pas de légende :
     une actualité n'a pas de champ légende ;
  5. le contenu en `body-lg` (18 px, interlignage 1,65), avec seulement ce que produit la barre
     réduite : `h2`, `h3`, gras, italique, listes, liens soulignés.
     Pas de « lire la suite », pas de troncature.
- **State à montrer — l'aperçu d'un brouillon par le bureau** : même page, avec en tête un encart de
  statut, identique à celui des pages de s04 (`accent` / `accent-foreground`, `role="status"`) :
  « Aperçu — cette actualité est un brouillon. Les visiteurs ne la voient pas. » **Un visiteur, lui,
  obtient la page 404 existante** (critère 3) : ne pas la redessiner.
- **Sans image** : l'article commence directement par le contenu après le titre. À montrer une fois,
  en mobile par exemple.
- **Mobile (390 px)** : gouttière 18 px, image en pleine largeur sans marge, contenu non tronqué.

## Design system constraints (non-negotiable)

**Tokens — deux thèmes, clair et sombre (ADR 012).** Le back-office reprend les mêmes tokens que le
public ; seule la `sidebar` a sa propre palette.

**Clair** (`:root`) :

```
--background: oklch(1 0 0)           --foreground: oklch(0.22 0.015 250)
--card: oklch(1 0 0)                 --muted: oklch(0.972 0.005 240)
--muted-foreground: oklch(0.45 0.02 245)   --border: oklch(0.9 0.008 245)
--input: oklch(0.66 0.014 245)       --ring: oklch(0.55 0.11 235)
--primary: oklch(0.35 0.06 240)      --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.965 0.006 240)  --secondary-foreground: oklch(0.3 0.02 245)
--destructive: oklch(0.48 0.17 27)   --link: oklch(0.45 0.13 250)
--accent-hue: 195 (démo « eau » ; teinte réelle injectée par association, six teintes possibles)
--accent: oklch(0.958 0.024 195)     --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)  --accent-border: oklch(0.88 0.045 195)
--sidebar: oklch(0.985 0.004 250)    --sidebar-foreground: oklch(0.26 0.015 250)
--sidebar-accent: oklch(0.93 0.012 245)  --sidebar-border: oklch(0.91 0.008 245)
--radius: 0.5rem (rounded-md 8px champs/boutons/cartes, rounded-lg 12px dialogues/feuilles, rounded-full badges)
PreviewBar : fond oklch(0.24 0.02 250), hors palette de contenu, identique dans les deux thèmes
```

**Sombre** (`.dark`) :

```
--background: oklch(0.215 0.009 255)      --foreground: oklch(0.94 0.006 250)
--card: oklch(0.215 0.009 255)            --muted: oklch(0.255 0.009 250)
--muted-foreground: oklch(0.72 0.015 248) --border: oklch(0.33 0.01 250)
--input: oklch(0.52 0.016 250)            --ring: oklch(0.7 0.12 235)
--primary: oklch(0.5 0.14 255)            --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.27 0.01 250)         --secondary-foreground: oklch(0.9 0.008 250)
--destructive: oklch(0.58 0.19 27)        --link: oklch(0.8 0.1 250)
--accent: oklch(0.275 0.035 195)          --accent-foreground: oklch(0.84 0.075 195)
--accent-solid: oklch(0.64 0.11 195)      --accent-border: oklch(0.4 0.055 195)
--sidebar: oklch(0.19 0.009 255)          --sidebar-foreground: oklch(0.93 0.006 250)
--sidebar-accent: oklch(0.3 0.014 250)
```

**Typographie** :

- **Source Serif 4** — titres : `h1` 34 px / 600, `h2` 26 px / 600.
- **Public Sans** — texte : `h3` 20 px / 600, `body` 17 px (back-office), `body-lg` 18 px / 1,65 (site
  public), `body-strong` 17 px / 600, `label` 16 px / 500, `button` 16-17 px / 600, `meta` 15 px pour
  les dates et l'adresse.
- **JetBrains Mono** — `overline` 12 px / 600 ; `data` pour les dates en tableau, avec `tabular-nums`.

Règles :

- Texte courant jamais sous 17 px, et jamais sous 18 px en public.
- Pas de placeholder en guise de libellé, pas d'astérisque : « Facultatif » écrit.
- `text-wrap: pretty` sur les titres.
- Dates en clair côté public (« 2 septembre 2026 »), `02/09/2026` en tableau et en champ.

**Espacement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, rien d'autre.

- **Site public** : `max-w-[1200px]`, gouttière 24 / 44 px, 18 px en mobile.
- **Article** : `max-w-[68ch]`.
- **Back-office** : barre latérale de 248 px, en tiroir sous `lg`.

**Cibles et focus** : 44 × 44 minimum, 56 px pour les actions principales en mobile.
`outline: 2px solid var(--ring); outline-offset: 2px`, jamais `outline: none`. Aucune action au survol
seul.

**Icônes lucide** : 16 / 20 / 24 px, trait 1,75, `currentColor`. **`Megaphone` = actualité**
(vocabulaire figé). Toujours icône + libellé, jamais une icône seule comme action.

**Composants à réutiliser tels quels** :

- **`button`** : un seul `default` par écran, le reste en `outline`. Libellés à l'infinitif :
  « Publier l'actualité ». Pendant le chargement, le libellé est remplacé et la largeur conservée.
- **`input`, `textarea`, `label`** : une colonne, libellé au-dessus, validation au _blur_.
- **`file-upload`** : zone de dépôt et bouton, masquée au tactile, types et poids annoncés avant.
- **`progress`** : indéterminée pour un téléversement.
- **`table`, `badge`, `pagination`** : une action par ligne ; `badge` = statut ; 25 lignes par page,
  10 cartes sous 640 px ; « Précédent / Suivant » écrits.
- **`alert`** : erreur et succès ancrés ; succès neutre avec `CircleCheck` en `primary`.
- **`alert-dialog`** : dépublication.
- **`sheet`** : tiroir mobile.
- **`skeleton`** : listes et tableaux seulement.
- **`sidebar`** : item actif = fond `sidebar-accent` + libellé 600.

**Composants de s04 à reprendre, sans les réinventer** :

- `<PreviewBar />` : `status: draft | dirty | live | publishing | error | unpublished`, point + libellé
  écrit, erreur en 2ᵉ ligne.
- L'éditeur de texte à barre réduite : six actions au-dessus d'un `textarea`.
- L'encart de statut d'aperçu public : `accent` / `accent-foreground`, `role="status"`.

**Do / Don't** :

- ✅ Le mot porte l'information, la couleur ne fait que renforcer. Statut = point + libellé.
- ✅ Un message d'erreur dit ce qui est perdu, le plus souvent que rien ne l'est.
- ✅ Un échec n'est jamais montré au visiteur : pas d'image = rien, pas une boîte vide.
- ❌ L'accent de l'association sur un bouton, ou comme seul porteur d'un statut.
- ❌ Une information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ Défilement infini, carrousel, « lire la suite » tronquant l'article.
- ❌ Densité de tableau de bord SaaS.
- ❌ Menu d'icônes en bout de ligne de tableau.
- ❌ Dégradés, verre dépoli, ombres lourdes, animations d'apparition.
- ❌ Blocs, glisser-déposer, `<BlockPicker />` : une actualité a des champs fixes.

Ne pas inventer de composant, de token ni de couleur hors de cette liste. Un besoin non couvert se
**signale** en marge de la maquette, il ne se dessine pas en freestyle.

## Écarts connus au design system (à signaler dans la maquette, pas à combler)

1. **Vignette d'actualité dans la liste publique** : aucun ratio ni aucune taille n'est posé. Proposer
   une vignette 4:3 d'environ 160 px de large en desktop, pleine largeur en mobile. **L'annoter comme
   proposition** à valider.
2. **Champ date** : le socle n'a pas de sélecteur de date. Le design system ne fixe que le format
   (`02/09/2026` en champ). Dessiner un `input` simple avec une icône `Calendar`, et l'annoter comme
   écart.
3. **Liste publique paginée** : les règles de `pagination` (25 / 10) sont écrites pour les **tableaux**
   du back-office. Le nombre d'actualités par page côté public n'est pas fixé : la maquette en montre
   10, à confirmer.

## Out of scope

- **Suppression d'une actualité** : hors critères. La dépublication suffit, comme pour les pages.
- **Extrait, chapeau, catégorie, auteur, étiquettes, partage sur les réseaux, commentaires** : aucun
  n'est dans les critères. Ne pas les ajouter.
- **Lien « Actualités » dans le menu du site** : le menu (s04b) ne pointe aujourd'hui que vers des pages.
  Ne pas dessiner d'évolution de l'écran « Navigation ».
- **Bloc « dernières actualités » sur l'accueil** : hors périmètre.
- **Envoi d'une actualité par email** aux membres : story s25, pas ici.
- **Publication programmée** (date future qui publie seule) : hors périmètre. La date sert au tri et à
  l'affichage.
- **Métadonnées SEO et image de partage** : story s11.
- **L'en-tête et le pied du site public, la page 404, l'écran Pages** : déjà livrés, ne pas les
  redessiner.

## Expected output

Un mockup HTML statique de chacun des écrans 1 à 4, basse fidélité acceptée :

- en **desktop et en mobile 390 px** ;
- avec une **bascule clair / sombre** (ADR 012 : les deux jeux de tokens ci-dessus) ;
- en utilisant exclusivement les tokens et composants ci-dessus ;
- avec une section ancrée par écran ;
- avec les écarts annotés en marge.

Il sera enregistré comme `docs/designs/s05-actualites.html`.
