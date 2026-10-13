# Design — Story s44-page-accueil

> Conçu le 2026-10-12, chemin **Claude Design** : brief `docs/designs/s44-page-accueil-brief.md`,
> canevas `https://claude.ai/design/p/85f17bc0-0fef-4088-997b-d7d8a5da30bd?file=S44+Page+accueil.dc.html`,
> livraison remise par Marie-Ève le 2026-10-12, puis reportée ici. Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s44-page-accueil.md`.
>
> **Mode clair uniquement** : le produit n'est servi qu'en clair (arbitrage du 7 octobre 2026, porté
> par s45 qui remplace l'ADR 012). Aucune version sombre n'a été dessinée, volontairement.

## Périmètre du design

| Critère | Ce qu'il demande                                                              | Où                                                   |
| ------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1       | Le bureau désigne une page publiée ; `/` l'affiche avec navigation et bandeau | **Écran 1** (choix) → **Écran 2** (rendu)            |
| 2       | Sans page, ou page dépubliée : accueil minimal, rien de la vitrine            | **Écran 3** ; **Écran 1** état d                     |
| 3       | Paramètre d'association, jamais la page d'une autre                           | _non dessinable_ (isolation, pas un écran)           |
| 4       | Seuls bureau, Présidence et SuperAdmin changent l'accueil                     | _non dessinable_ (autorisation ; le 403 existe déjà) |
| 5       | Effet à la requête suivante, sans redéploiement                               | _non dessinable_ (cache, pas un écran)               |
| 6       | Une seule adresse pour les moteurs (sitemap, canonique)                       | _non dessinable_ (référencement, mécanique)          |

## Screen(s)

Trois écrans, chacun en **ordinateur (1 200 px) et mobile (390 px)**, plus un repère de continuité.
Données fictives : « Les Amis de l'Étang », teinte « eau » (195), monogramme « AE ».

### Repère 0 — barre latérale du back-office (existante, non redessinée)

« **Page d'accueil** » est ajouté au groupe « Le site », **juste après « Pages »** (avant Actualités),
actif sur l'écran 1 seulement (fond `sidebar-accent`, libellé en 600). Sous `lg`, la barre devient le
tiroir existant ; la maquette ne montre qu'un bandeau hachuré « barre mobile existante ».

### Écran 1 — Bureau : Page d'accueil

`h1` « Page d'accueil », chapeau : « C'est la première chose que voient les visiteurs quand ils
tapent l'adresse de votre association. » Une seule `card` « Ce que voient les visiteurs », qui
contient dans cet ordre :

1. une ligne `meta` d'**état actuel** : « Aujourd'hui : l'accueil automatique. » ou « Aujourd'hui :
   la page « Bienvenue aux Amis de l'Étang ». » ;
2. (état d seulement) l'`alert` d'avertissement ;
3. un `radio-group` de deux choix, chacun avec une aide de 17 px :
   - **« L'accueil automatique »** (par défaut) — « Le nom et le logo de l'association, puis ses
     trois dernières actualités. » ;
   - **« Une page du site »** — « Vous écrivez l'accueil vous-même dans l'éditeur de pages. » ;
4. quand le choix 2 est sélectionné, un `select` « **Page choisie** » avec l'aide « Seules les pages
   publiées sont proposées. » (les trois pages publiées ; le brouillon « Compte-rendu AG 2025 »
   n'apparaît pas) ;
5. (état e) l'`alert` d'échec, **au-dessus** des actions ;
6. les actions : un seul bouton `default` **« Enregistrer l'accueil »**, puis un bouton `outline`
   **« Voir l'accueil du site »** (icône `ExternalLink`, s'ouvre dans un nouvel onglet, libellé
   accessible « … (s'ouvre dans un nouvel onglet) ») ;
7. (état b) l'`alert` neutre de succès, **sous** les actions.

Sélection d'un choix : bordure 2 px `primary` + point `primary`, jamais la couleur seule. Choix
désactivé : fond `muted`, texte `muted-foreground`, **la raison écrite** dessous.

**Mobile (390 px)** : une colonne, gouttière 16 px, champs et boutons pleine largeur à **56 px** ;
« Enregistrer l'accueil » au-dessus de « Voir l'accueil du site » ; barre mobile existante en tête.

### Écran 2 — Site public : l'accueil avec une page désignée

Bandeau d'alerte du site (s'il existe), en-tête public et pied de page : **existants, figurés en
hachures, non redessinés**. Entre les deux, `<article>` centré (colonne de 832 px), identique au
gabarit d'une page du site : `h1` 34 px (le titre de la page), puis les blocs dans l'ordre — texte
riche (18 px / 1,65), image avec légende, **encart** (seul bloc où la teinte s'exprime). Aucun contenu
ajouté par le produit autour.

**Mobile (390 px)** : gouttière 18 px, **image pleine largeur sans marge** (légende alignée sur la
gouttière), espacement entre blocs 24 px.

### Écran 3 — Site public : l'accueil minimal

En-tête et pied de page existants, non redessinés. Dans la même colonne de lecture :

1. le **nom de l'association en `h1` au gabarit `display`** (Source Serif 4, 44 px / 48) ;
2. sa **description** en `body-lg` 18 px, si elle existe (sinon rien) ;
3. la section « **Dernières actualités** » en `h2` 26 px : trois actualités au patron de la liste
   publique — vignette 4:3 de 160 px **seulement si l'actualité a une image**, date en clair
   (18 px, `muted-foreground`), titre en `h3` 20 px / 600 qui est le lien, filet entre éléments ;
4. le lien souligné « **Toutes les actualités** » (44 px de haut au moins).

**Mobile (390 px)** : gouttière 18 px ; le `h1` garde 44 px et passe à la ligne ; l'image de
l'actualité passe en pleine largeur **au-dessus** de la date.

## Mockup

`docs/designs/s44-page-accueil.html` — référence visuelle, normalisée depuis l'export Claude Design
(runtime `<x-dc>` et `support.js` retirés, boucles et conditions déroulées, aucune logique restante).
Sections ancrées `#ecran-1`, `#ecran-2`, `#ecran-3`, `#notes` ; planches `#1a`…`#1f`, `#2`,
`#3a`…`#3c`, chacune avec son jumeau `-mobile` (17 planches). En-têtes, pieds de page, bandeau
d'alerte et barre mobile du back-office sont des **bandeaux hachurés « existant »**, volontairement
non dessinés. **NE PAS copier en production** : l'Execute construit l'écran avec les vrais
composants (`card`, `radio-group`, `select`, `alert`, `button`, `<AssociationMark />`) et réutilise
le rendu de page du site et la liste d'actualités existants.

## Reused components (from the design system)

- `button` (un seul `default` : « Enregistrer l'accueil » ; « Voir l'accueil du site » en
  `outline`), `card`, `radio-group` (deux options), `select` (liste de pages), `label`.
- `alert` dans ses trois formes : **neutre** avec `CircleCheck` en `primary` (succès), **`warning`**
  (page plus publiée), **`destructive`** à bordure 2 px et `role="alert"` (échec). Jamais de toast.
- `sidebar` : une entrée de plus dans le groupe « Le site ».
- Site public, **réemployés tels quels** : le rendu d'une page CMS (`h1` + blocs, `renderPageBlock`),
  la liste d'actualités (date, titre en lien, vignette facultative), `<AssociationMark />` dans
  l'en-tête, le bloc « Encart ».

## States

**Écran 1** (une planche chacune, ordinateur et mobile) :

- **a. Rien de choisi** : choix 1 sélectionné, pas de `select`.
- **b. Une page choisie, enregistrée** : choix 2, `select` sur « Bienvenue aux Amis de l'Étang »,
  `alert` neutre sous les actions : « Accueil enregistré. Les visiteurs voient maintenant la page
  « Bienvenue aux Amis de l'Étang » à l'adresse de l'association. »
- **c. Aucune page publiée** : choix 2 désactivé, « Aucune page n'est publiée pour l'instant. » +
  lien « Publier une page » ; choix 1 reste sélectionné.
- **d. La page désignée n'est plus publiée** : ligne d'état « Aujourd'hui : l'accueil automatique, la
  page « … » n'étant plus publiée. », `alert` `warning` **en tête de carte** (« … Publiez-la de
  nouveau, ou choisissez-en une autre. » + lien « Ouvrir la page »), `select` montrant « Bienvenue
  aux Amis de l'Étang — non publiée ».
- **e. Échec d'enregistrement** : `alert` `destructive` au-dessus des actions : « L'accueil n'a pas
  été enregistré. Rien n'a changé : les visiteurs voient toujours l'accueil automatique. Réessayez
  dans un instant. » Variante de texte si la page vient d'être dépubliée : « Cette page n'est plus
  publiée. Choisissez-en une autre. »
- **f. Enregistrement en cours** : bouton « Enregistrement… » (`aria-busy`), largeur conservée.
- Pas d'état « chargement » : un formulaire n'a jamais de `skeleton`.

**Écran 2** : un seul état — la page rendue. Un bloc incomplet est omis, jamais une boîte vide ; pas
d'aperçu de brouillon sur `/`.

**Écran 3** : **a.** avec trois actualités (dont une sans image) ; **b.** sans actualité — la section
reste, avec « Aucune actualité pour l'instant. », ni lien ni action ; **c.** sans description ni
actualités — le nom, puis cette phrase (association tout juste créée).

## Design system gaps

Aucun gap nouveau : tout est composé avec les composants et tokens existants. Deux points à garder
en vue, sans rien inventer :

1. **`display` sur mobile** : le design system ne fixe pas de taille mobile pour `display`. Il est
   gardé à 44 px sur 390 px ; « Les Amis de l'Étang » passe sur deux lignes sans déborder. Un mot
   isolé de plus de 13 à 14 caractères environ dépasserait la colonne de 354 px. À arbitrer si le
   cas se présente — par exemple un nom d'association d'un seul mot très long.
2. **Titre de carte du back-office** : la maquette met « Ce que voient les visiteurs » en `h2`
   Source Serif 26 px. Le design system (§1.3) réserve le `h2` serif au site public et fixe le
   **titre de carte du back-office en `h3`** (Public Sans 20 px / 600). L'implémentation suit le
   design system, pas la maquette sur ce point.

## Écarts de la maquette au design system (à ne pas reproduire)

- Titre de la carte : voir gap 2.
- Le monogramme de la barre latérale mesure 40 px dans la maquette ; le design system fixe **34 px**
  pour le back-office (§1.8). `<AssociationMark size="backoffice" />` s'en charge, ne rien recomposer.
- La maquette dessine le sélecteur « Page choisie » comme une pastille fermée ; l'implémentation
  utilise le `select` du socle, avec son comportement clavier et lecteur d'écran.

## Hypothèses de conception à confirmer au plan

1. **Trois actualités** sur l'accueil minimal : constante d'affichage (ADR 023), pas un paramètre.
2. **Le choix est conservé quand la page est dépubliée** (état d) et reprend effet à la
   republication. Si le plan décide de l'effacer à la dépublication, l'état d disparaît et la ligne
   d'état revient à « l'accueil automatique ».
3. **Métadonnées de `/`** avec une page désignée (titre moteur, image de partage : ceux de la page ou
   ceux de l'association) : non dessinable, à trancher au plan.
4. **Où est stocké le choix** (clé hors registre ou référence à la page) : ADR probable, au plan.

## Ce que ce design ne couvre pas

- L'en-tête, le pied de page, le bandeau d'alerte et le menu du site public (existants).
- L'éditeur de pages, la liste des pages, la publication et la dépublication (s04) — **aucun
  avertissement n'est dessiné** quand on dépublie la page d'accueil.
- La liste complète des actualités et la page d'une actualité (s05).
- Le menu du site : savoir si la page d'accueil y figure ou non n'est pas un sujet de cette story.
- La suppression d'une page (n'existe pas), un mode sombre, un sélecteur de thème.
- La page de refus d'accès (403) et les écrans de connexion et de compte (s46).
