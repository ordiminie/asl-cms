# Design Brief — Story s09-analyses-eau

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** membre du bureau **je veux** publier rapidement un résultat d'analyse d'eau **afin
que** tout visiteur puisse le consulter sans compte.

Acceptance criteria:

1. Publier une analyse (date, affiche, texte facultatif, PDF) la fait apparaître **en tête** de la page
   publique des analyses.
2. Le PDF **se télécharge** depuis la page publique **sans authentification**.
3. Le texte est facultatif : une publication sans texte affiche la date, l'affiche et le lien du PDF,
   **sans bloc vide ni libellé orphelin**.
4. Le formulaire de saisie ne demande que **les quatre champs** (date, affiche, texte facultatif, PDF)
   et publie en **une seule soumission**, sans étape intermédiaire.
5. Les analyses sont listées **par date décroissante** et une analyse ne fuit pas vers une autre
   association _(isolation — pas d'écran à dessiner)_.

Contexte produit : le back-office est utilisé par 3 à 8 bénévoles élus, non techniciens, souvent âgés.
Le site public s'adresse aux propriétaires (souvent âgés) et aux visiteurs sans compte. La publication
est **au moins mensuelle** : l'exigence dominante est la **rapidité de saisie**, pas la richesse du
formulaire. Critère de recette du PRD : un membre du bureau, **seul devant l'écran**, publie une
analyse d'eau sans intervention du prestataire.

**Une analyse n'est ni une page ni un bloc.** Les pages (s04) sont des listes de blocs libres ; une
analyse d'eau est un **modèle à champs fixes** — date, affiche, texte facultatif, PDF — toujours dans
cet ordre. Pas de blocs, pas de glisser-déposer, pas de `<BlockPicker />`. Même famille que les
actualités (s05) : formulaire simple en une colonne, liste publique paginée, patron « tableau →
cartes » sous 640 px.

**Différence décisive avec s05 : il n'y a pas de brouillon.** La publication est **directe** : on
remplit, on publie, c'est en ligne. Donc **pas de `<PreviewBar />`** sur ces écrans — elle porte six
statuts (`draft`, `dirty`, `live`, `publishing`, `error`, `unpublished`) dont aucun n'existe ici — et
**pas de bouton « Aperçu »** : il n'y a rien à prévisualiser avant publication.

### Arbitrages déjà rendus — ne pas les rouvrir

| Point                 | Décision                                                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cycle de vie          | Publication **directe**, pas de brouillon. **Correction** d'une analyse publiée possible (date, affiche, PDF, texte). **Suppression** avec confirmation. Pas de dépublication.                                             |
| Texte alternatif      | **Dérivé de la date** (« Affiche de l'analyse d'eau du 2 septembre 2026 »). **Pas de cinquième champ** : le critère 4 impose strictement quatre champs.                                                                    |
| Sémantique de la date | Date du **prélèvement**. **Pré-remplie à aujourd'hui**. Une date **future est refusée**.                                                                                                                                   |
| Texte facultatif      | **Texte brut, 500 caractères au plus.** Pas d'éditeur riche, pas de markdown.                                                                                                                                              |
| Page publique         | Segment `/analyses-eau`, **10 analyses par page** (repris de s05).                                                                                                                                                         |
| Lien PDF              | Le PDF **se télécharge** (critère 2), il ne s'ouvre pas en nouvel onglet. Le design system exige un **libellé écrit** et le **poids annoncé** : aucun champ « titre » n'existe, donc le libellé est **dérivé de la date**. |
| Sans texte            | La page publique n'affiche **ni bloc vide ni libellé orphelin** (critère 3). Cet état est à montrer.                                                                                                                       |

### Un point à signaler sur la maquette, pas à trancher

**Les deux fichiers partent dans la même requête.** L'affiche et le PDF sont déposés en une seule
soumission (critère 4), et la plateforme limite aujourd'hui une soumission à **2 Mo au total**. Or une
affiche photographiée et un PDF de laboratoire dépassent facilement ce total.

Conséquence pour la maquette : les consignes écrites sous chaque champ de fichier annoncent un
plafond, et **ce plafond est provisoire**. Écrire « 2 Mo au plus » sur la maquette et **l'annoter en
marge** : « plafond provisoire — la valeur affichée à l'utilisateur reste à fixer au plan ; c'est le
**total** des deux fichiers qui est contraint, pas chacun séparément ». Ne pas choisir de valeur
définitive, ne pas inventer de dépôt en deux temps pour contourner la limite (le critère 4 l'interdit).

---

## Screens to produce

Quatre écrans, plus un repère de continuité. Données fictives : association **« Les Amis de
l'Étang »**, teinte « eau » (195). Analyses d'exemple, de la plus récente à la plus ancienne :

| Date du prélèvement | Texte                                                           | Affiche                             | PDF                              |
| ------------------- | --------------------------------------------------------------- | ----------------------------------- | -------------------------------- |
| 2 septembre 2026    | « Eau conforme aux limites de qualité. Aucune action requise. » | `affiche-septembre-2026.jpg` 680 Ko | `resultat-2026-09-02.pdf` 320 Ko |
| 4 août 2026         | **aucun** — c'est l'état du critère 3                           | `affiche-aout-2026.jpg` 540 Ko      | `resultat-2026-08-04.pdf` 295 Ko |
| 7 juillet 2026      | « Prélèvement au réservoir haut, à la demande du bureau. »      | `affiche-juillet-2026.png` 810 Ko   | `resultat-2026-07-07.pdf` 412 Ko |
| 3 juin 2026         | « Turbidité légèrement au-dessus du relevé habituel. »          | `affiche-juin-2026.jpg` 600 Ko      | `resultat-2026-06-03.pdf` 338 Ko |

### 0 · Repère de continuité — barre latérale du back-office (déjà livrée, ne pas redessiner)

Le back-office (`/bureau`) a déjà une barre latérale (`sidebar`, 248 px fixe → tiroir `sheet` sous
`lg`), avec l'identité de l'association en tête (logo ou monogramme 34 px + nom). Deux groupes :
**« Le site »** (Pages, Navigation ; « Actualités » s'y ajoute avec s05), puis **« L'association »**
(Identité, Réglages).

Cette story ajoute **« Analyses d'eau »** au groupe « Le site », **après « Actualités » et avant
« Navigation »**, avec l'icône **`Droplet`** (vocabulaire figé : `Droplet` = eau). Montrer la barre
latérale avec « Analyses d'eau » actif sur l'écran 1 seulement (fond `sidebar-accent` + libellé 600).
L'ordre exact dépend de l'ordre de livraison des stories parallèles : **annoter « à confirmer »**.

### 1 · Bureau — Liste des analyses d'eau

- **Purpose** : voir les analyses publiées, en ouvrir une pour la corriger, en publier une nouvelle.
- **Layout** : `h1` « Analyses d'eau » + bouton `default` « Publier une analyse » à droite du titre.
  Dessous, un `table` dans une `card` pleine largeur, quatre colonnes :
  - **Date du prélèvement** : `02/09/2026` en `data` (`font-mono`, `tabular-nums`) ;
  - **Affiche** : une vignette carrée de 44 px, sans libellé (l'image est reconnaissable) ;
  - **Résultat PDF** : le poids écrit, en `meta` (« 320 Ko ») — **jamais le nom du fichier** ;
  - **Action** : un seul lien « Modifier », en clair.
- **Tri** : par date de prélèvement décroissante, la plus récente en haut (même ordre que le site
  public, critère 5).
- **Pagination** : `pagination` sous le tableau, « Précédent / Suivant » écrits, « Page x sur y »,
  **25 lignes par page**. Jamais de défilement infini.
- **Pas de colonne « Statut »** : il n'y a pas de brouillon, toute analyse listée est en ligne. Ne pas
  ajouter de `badge`.
- **Pas de suppression depuis le tableau** : le design system impose **une seule action par ligne** et
  interdit le menu d'icônes en bout de ligne. La suppression vit sur l'écran 3.
- **States** :
  - **Vide** : « Aucune analyse publiée pour l'instant. → Publier la première ». C'est la forme imposée
    par le design system : ce qui manque, puis l'action pour le combler, en lien vers « Publier une
    analyse ».
  - **Chargement** : `skeleton` sur les lignes du tableau.
  - **Erreur** : `alert` ancré au-dessus du tableau — « La liste des analyses n'a pas pu être chargée.
    Rien n'est perdu : rechargez la page. »
  - **Succès** : les 4 analyses du tableau ci-dessus.
- **Mobile (390 px)** : patron « tableau → cartes empilées » du design system. Chaque ligne devient une
  carte : la date en titre (`body-strong`), puis Affiche (vignette) et Résultat PDF en paires libellé /
  valeur, puis « Modifier » en pleine largeur (56 px). « Publier une analyse » en tête, pleine largeur
  56 px. **10 cartes par page.**

### 2 · Bureau — Publier une analyse d'eau (écran principal)

C'est l'écran que mesure le critère de recette. **Il doit se lire d'un seul coup d'œil** : quatre
champs, un bouton, rien d'autre.

- **Purpose** : publier une analyse en **une seule soumission**.
- **Layout** : pas de `<PreviewBar />`. En tête, un lien `link` « ← Analyses d'eau » (retour à
  l'écran 1), puis `h1` « Publier une analyse d'eau ». Formulaire en **une colonne**, `max-w-[68ch]`,
  centré dans la zone de contenu. Libellés au-dessus, toujours visibles. Champs de 48 px (56 px en
  mobile), texte à 17 px. **Quatre champs, dans cet ordre, et aucun autre :**
  1. **Date du prélèvement** — un champ date au format `02/09/2026`, **pré-rempli à la date du jour**.
     Aide sous le champ : « Les analyses sont classées de la plus récente à la plus ancienne selon
     cette date. » Voir l'écart 2 : le composant exact n'existe pas au design system. Dessiner un
     `input` de 48 px contenant la date au format `jj/mm/aaaa`, avec une icône `Calendar` de 20 px à
     droite. **Ne pas inventer de calendrier déroulant.**
  2. **Affiche** — `file-upload` : zone de dépôt **et** bouton « Choisir un fichier ». Consignes
     écrites **avant** tout échec : « PNG, JPEG ou WebP, 2 Mo au plus. » La zone de dépôt est masquée
     au tactile. Le libellé **ne porte pas « Facultatif »** : l'affiche est obligatoire. Une fois
     l'image déposée : l'aperçu, le nom et le poids du fichier (« affiche-septembre-2026.jpg —
     680 Ko »), et « Remplacer l'affiche » en `outline`. **Pas de champ « Texte alternatif »** : il est
     dérivé de la date (arbitrage rendu, écart 4). Sous l'aperçu, une ligne `meta` le dit en clair :
     « Description pour les lecteurs d'écran : Affiche de l'analyse d'eau du 2 septembre 2026. »
  3. **Texte — Facultatif** — un `textarea` de 4 lignes environ, **texte brut**. Pas de barre d'outils,
     pas de gras, pas de lien : ce n'est **pas** l'éditeur à barre réduite de s04. Aide sous le champ :
     « Une ou deux phrases pour expliquer le résultat. 500 caractères au plus. » Un compteur écrit
     sous le champ, à droite : « 0 / 500 ». « Facultatif » est écrit en clair dans le libellé, **jamais
     d'astérisque**.
  4. **Résultat complet (PDF)** — `file-upload` restreint au PDF. Consignes écrites avant l'échec :
     « PDF, 2 Mo au plus. » Obligatoire, donc pas de « Facultatif ». Une fois déposé, **pas d'aperçu
     d'image** : une ligne avec l'icône `FileText` 20 px, le nom et le poids
     (« resultat-2026-09-02.pdf — 320 Ko »), et « Remplacer le PDF » en `outline`.
- **Action** : **un seul** bouton `default`, en bas du formulaire — « Publier l'analyse ». Pas de
  « Enregistrer le brouillon », pas d'« Aperçu », pas de seconde soumission. À sa gauche, « Annuler »
  en `link` (retour à l'écran 1).
- **Une ligne `meta` sous le titre** : « Une fois publiée, l'analyse est visible immédiatement sur
  /analyses-eau. » — l'honnêteté due à l'absence de brouillon.
- **States à montrer** :
  - **Vide (formulaire neuf)** : tous les champs vides, **sauf la date du jour**, déjà remplie. Les
    deux consignes de fichier sont lisibles avant tout dépôt.
  - **Chargement (soumission en cours)** : le bouton garde sa largeur, son libellé devient
    « Publication en cours… », il est désactivé ; dessous, une `progress` **indéterminée** accompagnée
    des deux noms de fichier (« Envoi de affiche-septembre-2026.jpg et resultat-2026-09-02.pdf »).
    **Pas de pourcentage.** Les aperçus restent visibles.
  - **Erreur** : deux erreurs cumulées, à montrer ensemble.
    - En tête de formulaire, un `alert` ancré (`destructive`) : « L'analyse n'a pas pu être publiée.
      L'affiche et le PDF pèsent ensemble 3,4 Mo, au-delà de la taille acceptée (2 Mo). **Rien n'est
      perdu** : la date et le texte sont conservés — remplacez le PDF par une version allégée. » Avec
      des liens d'ancrage vers les champs concernés.
    - Sur le champ Date, l'erreur de date future : bordure `destructive` 2 px et message sous le champ
      — « La date du prélèvement ne peut pas être dans le futur. »
  - **Succès** : après publication, retour à l'écran 1 avec un `alert` **neutre** ancré en haut
    (`CircleCheck` en `primary`, **pas de vert**) : « Analyse du 2 septembre 2026 publiée. Elle est en
    tête de la page /analyses-eau. » Montrer cet état **sur l'écran 1**.
- **Mobile (390 px)** : formulaire pleine largeur, gouttière 16 px, champs à 56 px. **Pas de zone de
  dépôt**, seulement le bouton « Choisir un fichier » et les consignes. « Publier l'analyse » en
  pleine largeur, 56 px, en bas du formulaire.

### 3 · Bureau — Corriger une analyse publiée

Même formulaire que l'écran 2, rempli, **plus la suppression**. À dessiner à part : c'est là que vit
l'action irréversible.

- **Purpose** : corriger une erreur (mauvaise date, mauvais fichier, texte à ajuster) ou retirer une
  analyse.
- **En tête** : « ← Analyses d'eau », puis `h1` « Analyse du 2 septembre 2026 ». Sous le titre, un
  `alert` **neutre** ancré, `role="status"` : « Cette analyse est en ligne. Vos modifications sont
  visibles immédiatement sur le site. » — conséquence directe de l'absence de brouillon.
- **Formulaire** : les quatre mêmes champs, remplis. Les deux fichiers sont déjà là : chacun affiche
  son aperçu (ou sa ligne `FileText`), son nom, son poids, et **« Remplacer … » en `outline`**. **Pas
  de « Retirer »** : affiche et PDF sont obligatoires, une analyse sans l'un des deux n'existe pas.
- **Actions** : un seul bouton `default`, « Enregistrer les modifications ». En bas de page, **séparé
  du formulaire par un `separator` et 48 px**, « Supprimer l'analyse » en `outline` — jamais à côté du
  bouton principal.
- **`alert-dialog` de suppression** (à dessiner ouvert) : « Supprimer l'analyse du 2 septembre 2026 ?
  Elle disparaît du site, avec son affiche et son résultat PDF. **Cette action est définitive.** »
  Deux boutons : « Annuler » (`outline`) et « Supprimer l'analyse » (`destructive`) — le bouton
  **nomme l'acte**, jamais « OK ».
- **States à montrer** : formulaire rempli au repos (succès) ; l'`alert-dialog` ouvert ; le
  remplacement d'un fichier en cours (`progress` indéterminée + nom du nouveau fichier, l'aperçu
  précédent restant visible) ; une erreur de champ (texte à 512 caractères → bordure `destructive`
  2 px, compteur « 512 / 500 » en `destructive`, message « Le texte ne peut pas dépasser
  500 caractères. »).
- **Mobile (390 px)** : même formulaire, champs 56 px, « Enregistrer les modifications » en pleine
  largeur ; « Supprimer l'analyse » en pleine largeur tout en bas, après le `separator`.

### 4 · Site public — Liste des analyses d'eau (`/analyses-eau`)

- **Purpose** : un visiteur **sans compte** consulte les analyses, la plus récente en tête, et
  télécharge le PDF.
- **Layout** : corps de page seul. L'en-tête public (logo, menu) et le pied de page existent déjà :
  **ne pas les redessiner**, un simple bandeau neutre suffit pour les situer. Gabarit public
  `max-w-[1200px]`, contenu centré à `max-w-[68ch]`.
  - `h1` « Analyses d'eau » (Source Serif 4, 34 px). **Pas de chapeau, pas de phrase d'introduction** :
    aucun champ ne la porte, ne pas l'inventer.
  - Une **liste verticale**, une analyse par élément, séparées par un filet `border` et 48 px. Chaque
    élément, **dans cet ordre** :
    1. le **titre** en `h2` (26 px, Source Serif 4) : « Prélèvement du 2 septembre 2026 » — la date
       en clair (§3.6), qui sert aussi de libellé dérivé ;
    2. l'**affiche** en `<figure>`, **pleine largeur de la colonne**, hauteur plafonnée à 520 px,
       `loading="lazy"`. **Pas de `<figcaption>`** : une analyse n'a pas de champ légende. Son `alt`
       est le texte dérivé (« Affiche de l'analyse d'eau du 2 septembre 2026 ») ;
    3. le **texte facultatif**, en `body-lg` (18 px, interlignage 1,65), **s'il existe**. S'il n'existe
       pas : **rien**. Ni libellé, ni cadre, ni ligne vide, ni « Pas de commentaire ». C'est le
       critère 3, et il se voit sur l'analyse du **4 août 2026** ;
    4. le **lien de téléchargement**, en bouton `outline` avec l'icône `FileText` 20 px :
       « **Résultat complet du 2 septembre 2026 (PDF, 320 Ko)** ». Le poids est écrit, l'unité aussi
       (§3.6). **Le libellé est dérivé de la date — jamais le nom du fichier.** Le téléchargement est
       annoncé au lecteur d'écran (« téléchargement »), **pas** l'ouverture dans un nouvel onglet :
       voir l'écart 3.
  - **Tous les liens PDF sont en `outline`** : avec 10 analyses par page, on ne peut pas avoir dix
    boutons `default`. Il n'y a **aucun** bouton `default` sur cette page.
  - **Pagination** en bas : « ← Précédent » / « Page 1 sur 3 » / « Suivant → », tout écrit.
    « Précédent » est **désactivé et annoncé** en page 1, jamais absent. **10 analyses par page.**
    Jamais de défilement infini.
- **States** :
  - **Vide** (aucune analyse publiée) : « Aucune analyse d'eau publiée pour l'instant. » **Pas
    d'action** : un visiteur ne peut rien y faire. Pas d'illustration.
  - **Succès** : les 4 analyses, dont celle du **4 août 2026 sans texte** — l'état du critère 3.
  - **Page 2** : « Précédent » actif.
  - **Pas d'état de chargement ni d'erreur à dessiner** : la page est rendue côté serveur.
- **Mobile (390 px)** : gouttière 18 px. L'affiche passe **pleine largeur, sans marge** (règle mobile
  des images, §4 du design system). Le bouton de téléchargement passe **en pleine largeur sous le
  titre de l'élément**, 56 px (règle mobile du bloc PDF). La pagination passe en deux boutons pleine
  largeur de 56 px.

---

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
--radius: 0.5rem (rounded-md 8px champs/boutons/cartes, rounded-lg 12px dialogues/feuilles, rounded-full badges)
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
--sidebar-accent: oklch(0.3 0.014 250)    --sidebar-border: oklch(0.32 0.01 250)
```

**Typographie** :

- **Source Serif 4** — titres : `h1` 34 px / 600, `h2` 26 px / 600.
- **Public Sans** — texte : `h3` 20 px / 600, `body` 17 px (back-office), `body-lg` 18 px / 1,65 (site
  public), `body-strong` 17 px / 600, `label` 16 px / 500, `button` 16-17 px / 600, `meta` 15 px pour
  les dates en clair, les poids de fichier et les aides.
- **JetBrains Mono** — `overline` 12 px / 600 ; `data` pour les dates en tableau, avec `tabular-nums`.

Règles :

- Texte courant jamais sous 17 px, et jamais sous 18 px en public.
- Pas de placeholder en guise de libellé, pas d'astérisque : « Facultatif » écrit.
- `text-wrap: pretty` sur les titres.
- **Dates en clair côté public** (« 2 septembre 2026 »), **`02/09/2026` en tableau et en champ.**
- **Unités toujours écrites** : Ko, Mo. Typographie française : espace insécable avant `: ; ! ?`,
  guillemets « », apostrophe courbe.

**Espacement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, rien d'autre.

- **Site public** : `max-w-[1200px]`, gouttière 24 / 44 px, 18 px en mobile.
- **Article / colonne de lecture** : `max-w-[68ch]`.
- **Back-office** : barre latérale de 248 px, en tiroir (`sheet`) sous `lg`.

**Cibles et focus** : 44 × 44 minimum, 56 px pour les actions principales en mobile.
`outline: 2px solid var(--ring); outline-offset: 2px`, jamais `outline: none`. **Aucune action au
survol seul.** Zoom texte à 200 % sans perte de contenu.

**Icônes lucide** : 16 / 20 / 24 px, trait 1,75, `currentColor`. **`Droplet` = eau** et
**`FileText` = document** (vocabulaire figé). Toujours icône + libellé, **jamais une icône seule comme
action**.

**Composants à réutiliser tels quels** :

- **`button`** : variantes `default` `outline` `secondary` `destructive` `link`. Tailles `default`
  48 px, `lg` 56 px. **Un seul `default` par écran**, le reste en `outline`. Libellés à l'infinitif :
  « Publier l'analyse ». Pendant le chargement, le libellé est remplacé, le bouton désactivé, la
  **largeur conservée**.
- **`input`, `textarea`, `label`** : une colonne, un champ par ligne, libellé au-dessus, validation au
  _blur_ puis à la soumission. Erreur = bordure `destructive` 2 px **+** message sous le champ **+**
  résumé ancré en tête de formulaire avec liens d'ancrage.
- **`file-upload`** : zone de dépôt **et** bouton « Choisir un fichier ». Types et poids annoncés
  **avant** l'échec. **Au tactile, pas de zone de dépôt** : il reste le bouton et les consignes.
- **`progress`** : **indéterminée** pour un téléversement, accompagnée du nom du fichier. Pas de
  pourcentage inventé.
- **`table`, `pagination`** : lignes 56 px, texte 17 px, en-tête sur `muted` en 15 px / 600. **Une
  seule action par ligne, en clair.** Chiffres en `font-mono` + `tabular-nums`. **25 lignes par page,
  10 cartes sous 640 px**, « Précédent / Suivant » écrits, jamais de défilement infini.
- **`alert`** : erreur et succès **ancrés** dans la page, ne disparaissent pas seuls. Succès **neutre**
  avec `CircleCheck` en `primary` — il n'y a pas de token « succès », **pas de vert**.
- **`alert-dialog`** : uniquement pour l'irréversible — ici la suppression. Le bouton **nomme l'acte**.
- **`sheet`** : tiroir mobile de la barre latérale.
- **`skeleton`** : listes et tableaux seulement, **jamais un formulaire**.
- **`sidebar`** : back-office uniquement ; item actif = fond `sidebar-accent` + libellé en 600.
- **`card`** : bordure 1 px, sans ombre.
- **`separator`** : sépare la zone de suppression du formulaire (écran 3).

**Rendu public du contenu (§4 du design system)** — ce qui s'applique ici :

- L'image publique va en `<figure>`, hauteur plafonnée à 520 px, `loading="lazy"`, **`alt` obligatoire**
  (ici dérivé, voir écart 4). En mobile, **pleine largeur sans marge**.
- Le document PDF porte un **libellé écrit** (jamais le nom du fichier), le **poids annoncé**, et il
  est **consultable sans compte**. En mobile, **bouton pleine largeur sous le titre**.
- **Un échec n'est jamais montré au visiteur** : un contenu incomplet est **omis**, jamais affiché en
  boîte vide ni en icône cassée.

**Do / Don't** :

- ✅ Le mot porte l'information, la couleur ne fait que renforcer.
- ✅ Un message d'erreur dit ce qui s'est passé, **ce qui est perdu** — le plus souvent, que rien ne
  l'est — et l'action suivante.
- ✅ Un état vide dit ce qui manque **et** l'action pour le combler.
- ✅ Une seule action attendue par écran, en `default` ; le reste en `outline`.
- ❌ L'accent de l'association sur un bouton, ou comme seul porteur d'un statut.
- ❌ Une information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ Défilement infini, carrousel, « lire la suite » tronquant un texte.
- ❌ Densité de tableau de bord SaaS.
- ❌ Menu d'icônes en bout de ligne de tableau.
- ❌ Dégradés, verre dépoli, ombres lourdes, animations d'apparition.
- ❌ Blocs, glisser-déposer, `<BlockPicker />` : une analyse a des champs fixes.
- ❌ `<PreviewBar />`, bouton « Aperçu », badge de statut : il n'y a pas de brouillon.
- ❌ Un cinquième champ, quel qu'il soit.

Ne pas inventer de composant, de token ni de couleur hors de cette liste. Un besoin non couvert se
**signale** en marge de la maquette, il ne se dessine pas en freestyle.

---

## Écarts connus au design system (à signaler dans la maquette, pas à combler)

1. **Le gap « bloc analyses d'eau » se ferme, il ne se rouvre pas.** Le design system (§9) hésite entre
   « bloc analyses d'eau dédié » et « réemploi du bloc PDF ». **Ni l'un ni l'autre** : l'architecture a
   déjà tranché pour un **modèle à champs fixes**, avec son propre écran de saisie et sa propre page
   publique. Le bloc PDF d'une page CMS ne sait ni trier par date, ni publier en une soumission.
   Annoter : « gap §9 clos dans ce sens — le design system est à amender ».
2. **Champ date** : le socle n'a **pas de sélecteur de date**. Le design system ne fixe que le format
   (`02/09/2026` en champ). Dessiner un `input` de 48 px avec une icône `Calendar`, **sans calendrier
   déroulant**, et l'annoter comme écart. **Manque partagé avec s05** (gap 2 de son design) : il sera
   tranché une fois pour les deux, au plan.
3. **Téléchargement contre ouverture en nouvel onglet.** Le design system (§4, bloc 3) annonce « ouverture
   en nouvel onglet annoncée au lecteur d'écran ». Le critère 2 dit « se télécharge ». C'est le critère
   qui prévaut ici : le lien **télécharge**, et c'est le téléchargement qui est annoncé. Annoter la
   divergence de formule — elle concerne le design system, pas seulement cette story.
4. **Texte alternatif dérivé.** Le design system (§4, bloc 2) impose un `alt` **saisi**, « sinon la
   publication est refusée ». Ici l'alt est **dérivé de la date** (arbitrage rendu : le critère 4
   impose strictement quatre champs). Limite assumée à écrire en marge : **une affiche d'analyse porte
   souvent ses résultats en texte dans l'image ; un alt dérivé ne les restitue pas.** Le texte
   facultatif et le PDF sont les seuls recours pour un lecteur d'écran. À consigner comme dette
   d'accessibilité, pas à combler par un cinquième champ.
5. **Taille et cadrage de l'affiche sur la page publique** : aucun ratio ni aucune taille n'est posé au
   design system (même manque que la vignette d'actualité, gap 1 de s05). Une affiche d'analyse est un
   **document à lire**, pas une vignette décorative : la maquette la montre en **pleine largeur de la
   colonne `max-w-[68ch]`**, hauteur plafonnée à 520 px. **L'annoter comme proposition** à valider.
6. **Nombre d'analyses par page côté public** : les règles de `pagination` (25 / 10) sont écrites pour
   les **tableaux du back-office**. La maquette en montre **10**, repris de s05 par cohérence. À
   confirmer au plan (constante d'affichage ou paramètre d'association).
7. **Plafond de taille affiché à l'utilisateur** : la maquette écrit « 2 Mo au plus » sous chaque champ
   de fichier. **Valeur provisoire, à fixer au plan** — voir la note plus haut : c'est le **total** des
   deux fichiers qui est contraint, puisqu'ils partent dans la même soumission.
8. **Icône dans la barre latérale du bureau** : la barre n'affiche **aucune icône** aujourd'hui, alors
   que le design de s05 en place une sur son entrée. La maquette place `Droplet` sur « Analyses
   d'eau » ; la cohérence des deux entrées est à tenir au plan.

---

## Out of scope

- **Le lien « Analyses d'eau » dans le menu du site.** Le menu (s04b) ne sait pointer **que vers des
  pages CMS** : il ne peut pas pointer vers `/analyses-eau` aujourd'hui. **Ne pas dessiner d'évolution
  de l'écran « Navigation ».** Le point est signalé, il n'est pas résolu ici — le visiteur atteint la
  page par un lien écrit dans une page, ou par son adresse directe.
- **Page dédiée par analyse** (`/analyses-eau/{...}`) : aucun critère n'en demande. Une seule page
  publique, avec la liste complète.
- **Brouillon, aperçu avant publication, dépublication, publication programmée** : la publication est
  directe, la suppression est définitive.
- **Historique des corrections**, journal des modifications, auteur de la publication : hors critères.
- **Filtres, recherche, tri par autre chose que la date** côté bureau comme côté public.
- **Plusieurs points de prélèvement, résultats structurés, seuils, indicateur « conforme / non
  conforme »** : aucun champ ne les porte. La conformité, s'il faut la dire, se dit dans le texte
  facultatif — ne pas inventer de pastille de statut.
- **Envoi d'une analyse par email** aux membres : story s25, pas ici.
- **Métadonnées SEO et image de partage** : story s11.
- **Feuille d'impression.** Le design system (§6.2) cite l'analyse d'eau parmi les documents imprimés,
  mais **aucune règle `@media print` n'existe** dans le produit. Hors critères : ne rien promettre, ne
  rien dessiner.
- **Bandeau d'alerte** en cas d'eau non conforme : c'est s07, un objet distinct.
- **L'en-tête et le pied du site public, la page 404, la barre latérale du bureau, l'écran Pages, les
  écrans d'actualités** : déjà livrés ou portés par d'autres stories — ne pas les redessiner.

---

## Expected output

Un mockup HTML statique de chacun des écrans 1 à 4 (plus le repère 0), basse fidélité acceptée :

- en **desktop et en mobile 390 px** ;
- avec une **bascule clair / sombre** (ADR 012 : les deux jeux de tokens ci-dessus) ;
- avec les **quatre états** de chaque écran, tels que décrits plus haut ;
- en utilisant **exclusivement** les tokens et composants ci-dessus ;
- avec une **section ancrée par écran** ;
- avec les **écarts annotés en marge**.

Il sera enregistré comme `docs/designs/s09-analyses-eau.html`.
