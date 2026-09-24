# Design Brief — Story s06-presentation-bureau

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** membre du bureau **je veux** tenir à jour l'organigramme et les fiches du bureau
**afin que** la page de présentation reste juste après chaque renouvellement.

Acceptance criteria:

- Le bureau crée, modifie, réordonne et supprime des fiches (nom, rôle, photo, biographie courte)
  depuis le back-office.
- La page publique affiche les fiches dans l'ordre défini par le bureau, avec la photo redimensionnée
  et un texte alternatif.
- Retirer une fiche la fait disparaître de la page publique ; les fiches restantes se renumérotent
  sans trou dans l'ordre d'affichage.
- Une fiche sans photo affiche un visuel de repli, pas une image cassée.

Contexte produit : le back-office est utilisé par 3 à 8 bénévoles élus, non techniciens, souvent âgés.
Le site public s'adresse aux propriétaires (souvent âgés) et aux visiteurs sans compte. Critère de
recette : un membre du bureau, **seul devant l'écran**, ajoute une fiche après un renouvellement et la
place au bon rang.

**Une fiche du bureau n'est pas une page, et pas non plus une actualité.** Les pages (s04) sont des
listes de blocs libres ; une actualité (s05) est un modèle à champs fixes **daté et publiable**. Une
fiche du bureau est un modèle à champs fixes **ordonné et toujours public** : pas de date, pas de
brouillon, pas de publication — mais un **rang** que le bureau maîtrise. L'écran d'édition est donc un
**formulaire court en une colonne**, sans `<PreviewBar />` et sans statut.

**Trois choses à ne jamais confondre à l'écran** (elles se ressemblent et portent des noms voisins) :

| Ce qui est désigné                                               | Où                          | Dans cette story                                                                  |
| ---------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| Un **membre du bureau** (élu, une fiche)                         | page publique « Le bureau » | **oui — c'est le sujet**                                                          |
| Un **membre de l'association** (un propriétaire, ~400 personnes) | espace membre, base membres | **non** (s12) — n'apparaît ici que comme un **nombre** affiché en tête de la page |
| Le **rôle d'autorisation** `board`                               | permissions techniques      | **non** — le « rôle » d'une fiche est un texte libre (Présidente, Trésorière…)    |

Le « rôle » affiché sur une fiche n'a **aucun lien** avec les permissions : une fiche n'est pas un
compte utilisateur, et un membre du bureau peut très bien n'avoir aucune adresse email.

## Décisions déjà prises — ne pas les rouvrir sur le canevas

Arbitrage du 22 septembre 2026. Elles sont ici pour que la maquette les applique, pas pour être
rediscutées.

1. **Page publique** : adresse `/le-bureau`, titre affiché « Le bureau ». (`/bureau` est déjà le
   back-office : ce n'est pas un choix esthétique.)
2. **Entrée de barre latérale du back-office** : « Membres du bureau » — jamais « Bureau », qui serait
   ambigu dans l'espace bureau.
3. **Fiche sans photo** : les **initiales de la personne** sur fond neutre. **Pas de silhouette**, pas
   d'icône de personne, pas de photo générique.
4. **Texte alternatif de la photo** : **déduit du nom**, aucun champ à remplir.
5. **Pas de brouillon** : toute fiche créée est publique immédiatement. Aucun statut, aucun bouton
   « Publier », aucun badge de statut nulle part.
6. **Champs** : **nom et rôle obligatoires** (rôle en **texte libre**, jamais une liste fermée) ;
   **biographie en texte brut, 500 caractères au plus**, facultative ; **photo facultative**.
7. **Organigramme = liste ordonnée simple.** Pas de groupes, pas de niveaux, pas de cases reliées par
   des traits.
8. **Nombre de membres de l'association** : **saisi à la main** (la base membres n'existe pas avant
   s12), **affiché en tête de la page publique du bureau**.
9. **RGPD** : **une seule mention, en bas de la page publique**, valable pour toutes les fiches.
   **Surtout pas** de phrase répétée sous chaque photo, **surtout pas** de case à cocher.

### Décisions de conception prises dans ce brief (à valider en le relisant, pas à redécider au canevas)

- **L'écran principal du bureau est une liste réordonnable, pas un tableau.** Le rang est la moitié du
  sujet : `<SortableList />` (§2.4) est le composant juste, comme pour le menu du site (s04b). Un
  `table` + `pagination` serait le patron de s05, mais il ne porte pas l'ordre.
- **L'édition d'une fiche se fait sur son propre écran**, pas dans un `dialog` : le design system
  réserve `dialog` à deux champs au plus (§2.1), et une fiche en a quatre dont un téléversement.
- **Le nombre de membres est un paramètre d'association** (registre typé, ADR 016, type « Nombre »),
  modifié sur la page « Réglages » **déjà générée** depuis ce registre (§3.1) : aucun écran nouveau.
  L'écran « Membres du bureau » se contente de le **rappeler en lecture seule**, avec le chemin pour
  le changer. Si le plan préfère un champ posé sur l'écran du bureau, c'est une divergence à décider
  au plan, pas au canevas.
- **La suppression d'une fiche est irréversible** : `alert-dialog` **avant**, pas de bande d'annulation
  **après**. C'est une différence assumée avec le retrait d'une entrée de menu (s04b), annulable 10 s :
  ici, la photo est effacée avec la fiche. Le réordonnancement, lui, garde bien sa bande d'annulation
  de 10 s (comportement natif de `<SortableList />`).
- **Adresses** : page publique `/le-bureau` (arbitrée) ; back-office **`/bureau/le-bureau`**, proposé
  par symétrie. `/bureau/membres` est écarté : il entrerait en collision avec la base des membres
  propriétaires (s12). À confirmer au plan.

## Screens to produce

Trois écrans, plus un repère de continuité. Données fictives : association « Les Amis de l'Étang »,
teinte « eau » (195), 412 membres. Bureau d'exemple, **dans cet ordre** :

| Rang | Nom                 | Rôle                                         | Photo                      | Biographie |
| ---- | ------------------- | -------------------------------------------- | -------------------------- | ---------- |
| 1    | Claire Besson       | Présidente                                   | oui                        | oui        |
| 2    | Michel Arnaud       | Vice-président                               | oui                        | oui        |
| 3    | Sylvie Renard       | Trésorière                                   | oui                        | oui        |
| 4    | Jean-Pierre Vasseur | Secrétaire                                   | **non** (initiales **JV**) | oui        |
| 5    | Hélène Dumas        | Membre du bureau, référente qualité de l'eau | oui                        | **non**    |

Les rangs 4 et 5 sont là exprès : ils portent les cas « sans photo » et « sans biographie », qui
doivent être visibles sur la maquette, côté bureau **et** côté public.

### 0 · Repère de continuité — barre latérale du back-office (déjà livrée, ne pas redessiner)

Le back-office (`/bureau`) a déjà une barre latérale (`sidebar`, 248 px fixe → tiroir `sheet` sous
`lg`), avec l'identité de l'association en tête (`<AssociationMark />`, carré 34 px + nom). Elle compte
deux groupes : **« Le site »** (Pages, Actualités, Navigation — « Actualités » ajoutée par s05) puis
**« L'association »** (Identité, Réglages).

Cette story ajoute **« Membres du bureau »** au groupe **« Le site »**, **après « Navigation »**
(proposition : c'est la dernière page publique composable ; à annoter). Montrer la barre latérale avec
« Membres du bureau » actif sur l'écran 1 seulement (fond `sidebar-accent` + libellé en 600).

### 1 · Bureau — Membres du bureau (écran principal)

- **Purpose** : voir la composition du bureau dans l'ordre publié, changer cet ordre, ouvrir une fiche,
  en ajouter une, en supprimer une.
- **Layout** :
  - `h1` « Membres du bureau » + bouton `default` « Ajouter un membre du bureau » à droite du titre.
    C'est **le seul bouton `default` de l'écran**.
  - Sous le titre, une ligne `meta` en lecture seule : « 412 membres affichés en tête de la page
    publique — modifiable dans **L'association › Réglages**. » (lien `link`, souligné).
  - Une seconde ligne `meta` : « Page publique : **/le-bureau** » avec un lien « Voir la page »
    (`outline`, ouvre un nouvel onglet, ouverture annoncée au lecteur d'écran).
  - Puis une `card` pleine largeur contenant **`<SortableList />` repris tel quel** (§2.4) — une ligne
    par fiche, hauteur de ligne confortable (72 px environ, la photo commande) :
    1. **poignée** `GripVertical`, zone de 44 px de large sur toute la hauteur de ligne ;
    2. **pastille de rang écrite** : « 2 sur 5 » — le rang est écrit, jamais porté par la seule position ;
    3. **photo** en carré 56 px, `rounded-md`, `object-cover` ; **sans photo, les initiales** (voir
       « Le repli de photo » plus bas) ;
    4. **nom** en `body-strong` (17 px / 600) ;
    5. **rôle** en `meta` (15 px) sous le nom ;
    6. **« Monter » / « Descendre »** : boutons **toujours visibles**, jamais révélés au survol, 44 × 44,
       icône **+** libellé. « Monter » est **désactivé et annoncé** sur la première ligne, jamais absent ;
    7. **« Modifier »** (`outline`), qui ouvre l'écran 2 ;
    8. **« Supprimer »** (`outline`), qui ouvre l'`alert-dialog`.
  - **Pas de pagination** : un bureau compte 3 à 9 personnes. Pas de recherche, pas de filtre.
- **Actions** : ajouter, modifier, monter, descendre, supprimer. Le réordonnancement s'applique
  **immédiatement**, sans bouton d'enregistrement, comme le menu du site (s04b).
- **States** :
  - **Vide** : « Aucune fiche pour l'instant. → Ajouter le premier membre du bureau » — c'est la forme
    imposée du design system : ce qui manque, puis l'action pour le combler, en lien vers le bouton
    principal.
  - **Chargement** : `skeleton` sur les lignes de la liste (jamais sur un formulaire).
  - **Erreur** : `alert` **ancrée au-dessus de la liste**, jamais un toast : « L'ordre n'a pas pu être
    enregistré. Les fiches sont restées dans leur ordre précédent. **Rien n'est perdu.** »
  - **Succès** : les 5 lignes du tableau de données ci-dessus, dans l'ordre, la ligne 4 en initiales.
  - **Après un déplacement** : la **bande d'annulation ancrée sous la liste**, 10 secondes, « Hélène
    Dumas déplacée en position 4 sur 5. → Annuler le déplacement ». Pas un toast, pas un `Ctrl+Z` à
    deviner. Une annonce `aria-live="polite"` dit la même chose.
  - **`alert-dialog` de suppression ouvert** : « Supprimer la fiche de Jean-Pierre Vasseur ? Elle
    disparaît de la page publique et sa photo est effacée. **Cette action est définitive.** » Deux
    boutons : « Supprimer la fiche » (`destructive`) et « Annuler ». Le bouton **nomme l'acte**.
  - **Après suppression** : `alert` de succès ancrée, neutre, `CircleCheck` en `primary` (**pas de
    vert**) : « Fiche supprimée. Les 4 fiches restantes ont été renumérotées de 1 à 4. » — la
    renumérotation sans trou est un critère d'acceptation : elle doit se **voir** et se **lire**.
- **Mobile (390 px)** : gouttière 16 px. Chaque ligne devient une **carte empilée** (patron §3.5) :
  photo 56 px et nom en tête, le rôle et la pastille de rang en paires libellé / valeur dessous, puis
  « Monter » et « Descendre » côte à côte (44 px chacun, toujours visibles), puis « Modifier » et
  « Supprimer » **en pleine largeur, 56 px**. Le bouton « Ajouter un membre du bureau » passe en tête,
  pleine largeur, 56 px. **Aucun glisser-déposer n'est requis nulle part.**

### 2 · Bureau — Créer / modifier une fiche

- **Purpose** : saisir ou corriger le nom, le rôle, la photo et la biographie d'un membre du bureau.
- **Layout** : une colonne, `max-w-[68ch]`, centrée dans la zone de contenu.
  - En tête, « ← Membres du bureau » en `link` (retour à l'écran 1).
  - `h1` : « Nouveau membre du bureau » en création, « Modifier la fiche de Claire Besson » en
    modification.
  - Libellés au-dessus des champs, **toujours visibles**. Champs de 48 px (56 px sur mobile), texte à
    17 px. **Aucun astérisque** : c'est « Facultatif » qui est écrit, en clair, dans le libellé.
  - Quatre champs, dans cet ordre :
    1. **Nom** — `input`. Aide sous le champ : « Le nom affiché sur la page publique, tel qu'il doit se
       lire. » Obligatoire.
    2. **Rôle dans le bureau** — `input` **texte libre**. Aide : « Par exemple : Présidente, Trésorier,
       Secrétaire adjointe, référent voirie. » Obligatoire. **Ne pas dessiner de `select` ni de liste
       de rôles** : chaque association nomme ses fonctions comme elle veut.
    3. **Photo (facultatif)** — `file-upload` : zone de dépôt **et** bouton « Choisir un fichier ».
       Consignes écrites **avant** tout échec : « PNG, JPEG ou WebP, carré de préférence, 400 px de
       côté au moins. » **La zone de dépôt est masquée au tactile** (`pointer: coarse`) ; il reste le
       bouton et les consignes. Une fois la photo déposée :
       - l'aperçu en carré 128 px, `rounded-md`, `object-cover` ;
       - « Remplacer la photo » et « Retirer la photo », tous deux en `outline` ;
       - dessous, une ligne `meta` : « Texte alternatif : « Portrait de Claire Besson » — généré à
         partir du nom, il n'y a rien à saisir. » **Aucun champ de texte alternatif** : contrairement au
         bloc image d'une page (s04), il n'est pas saisi ici.
    4. **Biographie (facultatif)** — `textarea` d'environ 6 lignes, **texte brut**. Aide écrite
       **avant** : « Quelques phrases de présentation. 500 caractères au plus. » Sous le champ, à
       droite, un compteur discret en `meta` : « 128 / 500 » (voir écart 4). **Pas de barre de mise en
       forme, pas de gras, pas de lien** : ce n'est pas l'éditeur de texte riche des pages.
  - En pied de formulaire, le **seul** bouton `default` de l'écran : « Enregistrer la fiche ». À côté,
    « Annuler » en `outline` (retour à l'écran 1). Pendant l'enregistrement : libellé remplacé, bouton
    désactivé, **largeur conservée**.
  - **Aucune `<PreviewBar />`, aucun statut, aucun bouton « Publier »** : il n'y a pas de brouillon.
    À la place, une ligne `meta` sous le titre : « Cette fiche est visible sur /le-bureau dès son
    enregistrement. »
- **States** :
  - **Fiche neuve** : tous les champs vides, pas d'aperçu de photo, compteur à « 0 / 500 ».
  - **Téléversement en cours** : `progress` **indéterminée** accompagnée du nom du fichier (« Envoi de
    claire-besson.jpg »). **Pas de pourcentage inventé.** L'aperçu précédent, s'il existe, reste visible.
  - **Erreur de validation** : le rôle a été vidé. Bordure `destructive` 2 px sur le champ **+** message
    sous le champ (« Indiquez le rôle de cette personne dans le bureau. ») **+** résumé ancré en tête de
    formulaire avec un lien d'ancrage vers le champ (§3.1). Les trois, pas un seul.
  - **Erreur de téléversement** : `alert` ancrée sous le champ photo, jamais un toast : « La photo n'a
    pas pu être envoyée. Le fichier n'est pas une image PNG, JPEG ou WebP. **Le reste de la fiche est
    conservé** — vous pouvez enregistrer sans photo. »
  - **Succès** : `alert` ancrée en tête, neutre, `CircleCheck` en `primary` : « Fiche enregistrée.
    Visible sur la page **/le-bureau**, en position 3 sur 5. »
- **Mobile (390 px)** : formulaire pleine largeur, gouttière 16 px, champs 56 px. Pas de zone de dépôt :
  seulement le bouton « Choisir un fichier » et les consignes. « Enregistrer la fiche » pleine largeur,
  56 px, « Annuler » dessous.

### 3 · Site public — Le bureau (`/le-bureau`)

- **Purpose** : un visiteur sans compte voit qui compose le bureau, dans l'ordre choisi par le bureau.
- **Layout** : corps de page seul. L'en-tête public (logo, menu) et le pied de page existent déjà :
  **ne pas les redessiner**, un simple bandeau neutre suffit pour les situer. Gabarit public
  `max-w-[1200px]`, contenu centré à `max-w-[68ch]`.
  - `h1` « Le bureau » (Source Serif 4, 34 px).
  - Dessous, **le nombre de membres**, en une phrase en `body-lg` : « L'association compte **412
    membres propriétaires**. » Puis, en dessous : « Son bureau, élu en assemblée générale, est composé
    des personnes suivantes. » Les deux phrases servent à lever l'ambiguïté entre les 412 **membres de
    l'association** et les 5 **membres du bureau** : ne pas les raccourcir en « 412 membres » seul.
  - Puis **une liste verticale ordonnée de fiches**, une par ligne, séparées par un filet `border`
    (espacement 32 px entre fiches). **Pas de grille de portraits, pas de cases reliées** : la liste
    verticale rend l'ordre lisible sans ambiguïté, contrairement à une grille qui se lit en zigzag.
    Chaque fiche se compose ainsi :
    - la **photo** à gauche, carré 128 px, `rounded-md`, `object-cover` ; sans photo, **les initiales**
      (voir ci-dessous) dans un carré de la même taille — la mise en page ne bouge pas ;
    - le **nom** en `h2` (26 px, Source Serif 4) ;
    - le **rôle** juste dessous, en 18 px / 600 (voir écart 3) ;
    - la **biographie** en `body-lg` (18 px, interlignage 1,65), en texte brut, sans troncature ni
      « lire la suite ». Sans biographie : **rien**, la fiche s'arrête au rôle.
  - Tout en bas de la page, après un `separator`, **une seule mention** en `meta` :
    « Les noms, fonctions et photographies publiés sur cette page le sont avec l'accord des personnes
    concernées. Pour toute demande de modification ou de retrait, contactez le bureau. » **Une seule
    fois pour toute la page** — jamais répétée sous une fiche, jamais accompagnée d'une case à cocher.
    Le texte exact est à valider par le bureau : l'annoter comme rédaction à confirmer.
- **Le repli de photo — la règle, à appliquer partout où une photo peut manquer** :
  - **les initiales de la personne**, en Source Serif 4 / 600, **encre `muted-foreground` sur fond
    `muted`** — un fond **neutre**, jamais la teinte de l'association, jamais une silhouette, jamais une
    icône de personne, jamais une image générique ;
  - deux lettres : l'initiale du prénom et celle du nom (« Jean-Pierre Vasseur » → **JV**) ; un nom
    d'un seul mot donne ses deux premières lettres ;
  - même carré, même rayon, même taille que la photo : passer d'une fiche sans photo à une fiche avec
    photo **ne change aucune mise en page** ;
  - **ne pas réutiliser `<AssociationMark />`** : c'est l'identité de l'association (fond `accent-solid`,
    règle des deux lettres qui ignore « ASL »), pas une personne.
- **States** :
  - **Succès** : les 5 fiches dans l'ordre, la 4ᵉ en initiales, la 5ᵉ sans biographie.
  - **Vide** (aucune fiche) : le `h1`, la phrase du nombre de membres, puis « La composition du bureau
    sera publiée prochainement. » **Aucune action** : un visiteur ne peut rien y faire. Pas
    d'illustration, pas de cadre vide.
  - **Pas d'état de chargement ni d'erreur à dessiner** : la page est rendue côté serveur. Et un échec
    ne se montre jamais au visiteur — une photo absente donne les initiales, pas une image cassée.
- **Mobile (390 px)** : gouttière 18 px. La photo reste un **carré de 96 px aligné à gauche du nom**,
  le rôle et la biographie passant dessous en pleine largeur (voir écart 5 : c'est une dérogation
  assumée à la règle « image pleine largeur en mobile »). La mention du bas reste unique et pleine
  largeur.

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
--destructive: oklch(0.48 0.17 27)   --destructive-foreground: oklch(0.99 0.01 27)
--link: oklch(0.45 0.13 250)
--accent-hue: 195 (démo « eau » ; teinte réelle injectée par association, six teintes possibles)
--accent: oklch(0.958 0.024 195)     --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)  --accent-border: oklch(0.88 0.045 195)
--sidebar: oklch(0.985 0.004 250)    --sidebar-foreground: oklch(0.26 0.015 250)
--sidebar-accent: oklch(0.93 0.012 245)  --sidebar-border: oklch(0.91 0.008 245)
--radius: 0.5rem (rounded-md 8px champs/boutons/cartes/photos, rounded-lg 12px dialogues/feuilles,
          rounded-full badges)
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

⚠️ **Le carré d'initiales doit être vérifié dans les deux thèmes** : `muted-foreground` sur `muted`,
en clair **et** en sombre. C'est le seul élément de cette story dont la lisibilité dépend d'une paire
de gris.

**Typographie** :

- **Source Serif 4** — titres et initiales de repli : `h1` 34 px / 600, `h2` 26 px / 600.
- **Public Sans** — texte : `h3` 20 px / 600, `body` 17 px (back-office), `body-lg` 18 px / 1,65 (site
  public), `body-strong` 17 px / 600 (nom de membre en back-office), `label` 16 px / 500,
  `button` 16-17 px / 600, `meta` 15 px (rôle en liste, aides, mentions).
- **JetBrains Mono** — `overline` 12 px / 600 ; `data` (`tabular-nums`) pour les nombres, dont le
  nombre de membres s'il est présenté comme une valeur de champ dans les Réglages.

Règles :

- Texte courant jamais sous 17 px, et **jamais sous 18 px en public**.
- Pas de placeholder en guise de libellé, **pas d'astérisque** : « Facultatif » écrit en clair.
- `text-wrap: pretty` sur les titres ; longueur de ligne 60-75 caractères en public (`max-w-[68ch]`).
- Typographie française : espace insécable avant `: ; ! ?`, guillemets « », apostrophe courbe.
- Vouvoiement, aucun jargon.

**Espacement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, **rien d'autre**. Toute mesure hors échelle
est un bug.

- **Site public** : `max-w-[1200px]`, gouttière 24 / 44 px, 18 px en mobile ; contenu à `max-w-[68ch]`.
- **Back-office** : barre latérale de 248 px, en tiroir (`sheet`) sous `lg` ; gouttière 16 px en mobile.

**Cibles et focus** : 44 × 44 minimum, **56 px pour les actions principales en mobile**.
`outline: 2px solid var(--ring); outline-offset: 2px`, **jamais `outline: none`**. **Aucune action au
survol seul** : le survol ne fait que teinter. Ordre de tabulation = ordre de lecture.

**Bordures et ombres** : 1 px `border` en séparation, 1 px `input` sur un champ (3:1), 2 px `primary`
en sélection, 2 px `destructive` en erreur. **Aucune ombre sur les cartes de contenu** : la bordure
suffit. `shadow-lg` réservé aux dialogues. Transitions ≤ 120 ms, sur couleur et bordure.

**Icônes lucide** : 16 / 20 / 24 px, trait 1,75, `currentColor`. `GripVertical` = poignée de
réordonnancement (vocabulaire figé). **Toujours icône + libellé, jamais une icône seule comme action.**
Il n'existe **pas** d'icône figée pour « membre du bureau » dans le vocabulaire : ne pas en inventer une
signification — si la barre latérale en demande une, l'annoter (voir écart 6).

**Composants à réutiliser tels quels** :

- **`<SortableList />`** (§2.4) : poignée **et** boutons « Monter / Descendre » de premier rang,
  **visibles en permanence**, jamais au survol. « Monter » désactivé et annoncé sur la première ligne,
  jamais absent. Poignée au clavier : `Espace` saisit, `↑ ↓` déplacent, `Espace` dépose, `Échap`
  annule. Le focus suit l'élément déplacé, jamais le rang libéré. Annulation : un seul niveau,
  10 secondes, **dans une bande ancrée sous la liste**. Annonces `aria-live="polite"` avec le rang
  écrit (« Hélène Dumas, position 4 sur 5 »). _Une main âgée ou tremblante ne fait pas de glisser-déposer :
  les boutons sont la voie recommandée._
- **`button`** : variantes `default`, `outline`, `secondary`, `destructive`, `link`. Tailles `default`
  48 px, `lg` 56 px. **Un seul bouton `default` par écran**, le reste en `outline`. Libellés à
  l'infinitif explicite : « Supprimer la fiche », pas « OK ». Chargement : libellé remplacé, bouton
  désactivé, **largeur conservée**. Survol de `outline` en `secondary`, **jamais en accent**.
- **`form`, `label`, `input`, `textarea`** : une colonne, un champ par ligne, libellé au-dessus
  toujours visible, champs 48 px (56 mobile), validation au _blur_ puis à la soumission.
- **`file-upload`** : zone de dépôt **et** bouton « Choisir un fichier ». Types et poids annoncés
  **avant** l'échec. **Pas de zone de dépôt au tactile.**
- **`progress`** : **indéterminée** pour un téléversement, accompagnée du nom du fichier. Pas de
  pourcentage inventé.
- **`alert`** : erreur **et** succès ancrés dans la page. Succès **neutre** avec `CircleCheck` en
  `primary` — il n'y a pas de token « succès », **pas de vert**.
- **`alert-dialog`** : uniquement pour l'irréversible (la suppression d'une fiche), **le bouton nommant
  l'acte**.
- **`card`** : bordure 1 px, sans ombre. **`separator`**, **`skeleton`** (listes uniquement),
  **`sheet`** (tiroir mobile), **`sidebar`** (item actif = fond `sidebar-accent` + libellé 600, selon
  la route).
- **`<AssociationMark />`** (§2.7) : l'identité de l'association dans la barre latérale et l'en-tête
  public. **Ne pas le détourner pour une personne.**

**Do / Don't** :

- ✅ **Le mot porte l'information ; la couleur ne fait que renforcer.** Le rang est **écrit**.
- ✅ Un message d'erreur dit ce qui s'est passé, **ce qui est perdu** — et le plus souvent, que rien
  ne l'est.
- ✅ Toute voie d'interaction fine (glisser-déposer) a **une alternative de premier rang**.
- ✅ Un échec n'est jamais montré au visiteur : une photo absente donne les initiales, pas une image
  cassée ni un cadre vide.
- ✅ Sobre, aéré, très lisible. Registre de service public local, pas de startup.
- ❌ **L'accent de l'association** sur un bouton, sur le carré d'initiales, ou comme seul porteur d'une
  information.
- ❌ Une information importante dans un toast, un `tooltip` ou un `collapsible`.
- ❌ Une silhouette, une icône de personne ou une photo générique en repli de photo.
- ❌ Un `select` ou une liste fermée pour le rôle. Un statut, un badge « Publiée », un brouillon.
- ❌ Un organigramme en cases reliées, des groupes, des niveaux hiérarchiques.
- ❌ Une grille de portraits en mosaïque, un carrousel, un défilement infini.
- ❌ Une carte de fiche « réseau social » : pas de lien email, pas de téléphone, pas d'icône sociale.
- ❌ Densité de tableau de bord SaaS. Dégradés, verre dépoli, ombres lourdes, animations d'apparition.
- ❌ Menu d'icônes en bout de ligne. Action au survol seul. `outline: none`.
- ❌ Texte courant sous 17 px (18 px en public). Placeholder en guise de libellé. Astérisque.

Ne pas inventer de composant, de token ni de couleur hors de cette liste. Un besoin non couvert se
**signale** en marge de la maquette, il ne se dessine pas en freestyle.

**Liste à cocher d'accessibilité, à passer sur chaque écran** : corps de texte public ≥ 7:1 · contour
de champ ≥ 3:1 · zoom texte à 200 % sans perte · **aucune information portée par la seule couleur** ·
tout au clavier, focus visible partout · un seul `h1` par page, hiérarchie sans saut de niveau.

## Écarts connus au design system (à signaler dans la maquette, pas à combler)

1. **Repli de photo d'une fiche du bureau — manque §9 tranché par cette story.** Le design system
   posait la question sans y répondre (« initiales, silhouette, ou rien ? », ligne 922, story s06).
   L'arbitrage la ferme : **initiales de la personne, `muted-foreground` sur `muted`**, Source Serif 4 /
   600, même carré que la photo. Le document `docs/design-system.md` doit être **mis à jour** au
   moment de la livraison : ce n'est plus un manque.
2. **Carte de fiche et mise en page des portraits** : aucune n'est maquettée dans le design system.
   Celle décrite ici (photo carrée à gauche, `h2` pour le nom, rôle dessous, biographie en `body-lg`,
   filet `border` entre fiches) est une **composition de pièces existantes**, pas un composant nouveau.
   **L'annoter comme proposition** à valider.
3. **Texte public en gras hors titre** : le rôle a besoin d'être plus fort que la biographie sans
   devenir un titre. Le seul token disponible, `body-strong`, est à **17 px** — sous le plancher public
   de 18 px. La maquette utilise donc **18 px / 600**, c'est-à-dire `body-lg` en graisse 600. **À
   annoter** : soit le système gagne un token, soit le plancher public l'autorise explicitement.
4. **Compteur de caractères** : le design system n'en définit aucun. La biographie est plafonnée à
   500 caractères, et un plafond invisible se découvre au moment où l'on est coupé. La maquette montre
   un compteur discret en `meta` (« 128 / 500 »), aligné à droite sous le champ. **À annoter comme
   proposition**, avec le passage en `destructive` à l'approche du plafond laissé de côté (l'aide
   écrite avant suffit).
5. **Photo de portrait en mobile** : §4 impose que les images passent **pleine largeur, sans marge**
   sous 640 px. Cette règle vise les images de contenu d'un article ; appliquée à un portrait, elle
   donne une photo de 390 px de large par fiche, qui écrase la lecture et allonge la page hors de
   proportion. La maquette garde donc le **carré de 96 px aligné à gauche du nom**, gouttière 18 px
   conservée. **Dérogation à annoter explicitement.**
6. **Icône de « membre du bureau »** : le vocabulaire figé (§1.7) n'en désigne aucune, et les entrées
   de barre latérale existantes en portent une. **Ne pas en choisir une au canevas** : montrer l'entrée
   « Membres du bureau » avec un emplacement d'icône neutre et l'annoter comme choix à faire.
7. **Dimensions et poids de la photo** : rien n'est fixé dans le design system (les tailles de §1.8
   concernent le **logo**, pas une personne). Proposition à annoter : carré **1:1**, `object-cover`,
   rendu **128 px** en public desktop, **96 px** en public mobile, **56 px** dans la liste du bureau,
   **128 px** en aperçu de formulaire ; fichier PNG / JPEG / WebP, **400 px de côté au moins**. Le
   **poids maximal écrit dans les consignes doit être celui réellement appliqué** : ne pas écrire
   « 5 Mo » si la limite technique en vigueur est plus basse (à trancher au plan — c'est pour cela que
   ce brief n'écrit aucun chiffre de poids dans la consigne de l'écran 2).
8. **Mention RGPD de bas de page** : le texte proposé est une rédaction de travail. Le composant, lui,
   n'est rien de nouveau (`separator` + paragraphe `meta`). **Annoter le texte comme à valider par le
   bureau.**

## Out of scope

- **Le lien vers `/le-bureau` depuis le menu du site.** Le composeur de menu (s04b) ne pointe
  aujourd'hui **que vers des pages CMS** : la page du bureau n'est atteignable que par un lien écrit à
  la main dans une page ou dans le pied de page. **Ne pas dessiner d'évolution de l'écran
  « Navigation »** — c'est une limite connue à signaler, pas à combler ici.
- **Statut brouillon / publié d'une fiche, `<PreviewBar />`, bouton « Publier », badge de statut** :
  il n'y en a pas.
- **Groupes, niveaux, organigramme en cases reliées, distinction bureau / conseil syndical.**
- **Toute donnée de contact d'un membre du bureau** : email, téléphone, formulaire de contact
  individuel, réseaux sociaux. Le contact du bureau est la story s08.
- **La fiche du membre propriétaire (s12)** et **la page « Contacts utiles » (contenu CMS ordinaire,
  s04)** : trois choses distinctes, ne pas les rapprocher visuellement.
- **Le lien entre une fiche et un compte utilisateur**, et le rôle d'autorisation `board` : une fiche
  n'est pas un compte.
- **Dates de mandat, historique des bureaux successifs, archive des anciens membres.**
- **Recadrage, rotation ou retouche de la photo** dans le back-office.
- **Case à cocher de consentement, mention répétée sous chaque fiche** : explicitement écartés.
- **L'écran « Réglages »** où se saisit le nombre de membres : il est **déjà généré** depuis le
  registre des paramètres, et un paramètre de type « Nombre » n'y demande aucun écran nouveau.
- **Métadonnées SEO et image de partage** : story s11.
- **L'en-tête et le pied du site public, la barre latérale du back-office, la page 404** : déjà
  livrés, ne pas les redessiner.

## Expected output

Un mockup HTML statique des écrans 1, 2 et 3, basse fidélité acceptée :

- en **desktop et en mobile 390 px** ;
- avec une **bascule clair / sombre** (ADR 012 : les deux jeux de tokens ci-dessus) — chaque écran
  doit être vérifié dans les deux thèmes, le carré d'initiales en particulier ;
- avec les **quatre états** par écran (vide, chargement, erreur, succès), plus les états nommés en
  propre (bande d'annulation, `alert-dialog` de suppression, téléversement en cours) ;
- en utilisant **exclusivement** les tokens et composants ci-dessus ;
- avec une section ancrée par écran ;
- avec les **huit écarts annotés en marge**.

Il sera enregistré comme `docs/designs/s06-presentation-bureau.html`.
