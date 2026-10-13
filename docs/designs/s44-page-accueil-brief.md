# Design Brief — Story s44-page-accueil

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.
>
> **Mode clair uniquement.** Arbitrage du 7 octobre 2026 : le produit n'est servi qu'en clair
> (le mode sombre et son sélecteur sont retirés par la story s45, qui remplace l'ADR 012). **Ne pas
> dessiner de version sombre**, ni de sélecteur de thème : ce serait du travail perdu. Chaque écran
> est en revanche livré en **deux versions : ordinateur et mobile (390 px)**.

## Story

**En tant que** membre du bureau **je veux** désigner quelle page du site sert d'accueil **afin
que** un visiteur qui tape l'adresse de l'association arrive sur le contenu de l'association, et non
sur la vitrine commerciale du boilerplate.

Acceptance criteria:

- Depuis le back-office, le bureau désigne une page **publiée** du site comme page d'accueil ; `/`
  affiche alors le contenu de cette page, avec la navigation et le bandeau d'alerte du site public.
- Sans page désignée, ou si la page désignée est dépubliée, `/` affiche un **accueil minimal** : nom
  et logo de l'association et ses dernières actualités publiées. Jamais un texte, un lien ou un
  bouton de la vitrine du boilerplate (« Essayez gratuitement », lien vers la tarification).
- Le choix est propre à chaque association _(isolation — pas d'écran à dessiner)_.
- Seuls le bureau, la présidence et le SuperAdmin changent la page d'accueil ; tout autre
  utilisateur reçoit un refus _(autorisation — la page de refus existe déjà, ne pas la redessiner)_.
- Changer de page d'accueil prend effet à la requête suivante _(cache — pas d'écran)_.
- La page désignée n'a qu'une adresse pour les moteurs _(référencement — pas d'écran)_.

Contexte produit : le back-office est utilisé par 3 à 8 bénévoles élus, non techniciens, souvent
âgés. Le site public s'adresse aux propriétaires (souvent âgés) et aux visiteurs sans compte.
Critère de recette : un membre du bureau, **seul devant l'écran**, choisit sa page d'accueil et voit
le résultat sur le site.

**Ce que le bureau choisit est simple : l'un ou l'autre.** Soit « l'accueil automatique » (ce que
le site affiche aujourd'hui quand rien n'est choisi), soit **une page** qu'il a lui-même écrite
dans l'éditeur de pages. Il n'y a ni accueil à composer ici, ni bloc, ni mise en page nouvelle.

### Décisions de périmètre (déjà prises, à respecter)

1. **Un écran dédié, « Page d'accueil »**, dans la barre latérale du back-office. Le choix ne passe
   pas par la page « Réglages » : celle-ci est générée depuis un registre de paramètres typés qui ne
   sait pas désigner une page. Il ne passe pas non plus par « Navigation » : cet écran applique ses
   changements immédiatement et porte déjà un bouton « Enregistrer » (pied de page) ; en ajouter un
   second casserait la règle « un seul bouton `default` par écran ».
2. **La page désignée est rendue exactement comme elle l'est à son adresse propre** (`/qualite-de-l-eau`
   par exemple) : même colonne, même titre, mêmes blocs. L'accueil n'a pas de mise en page à lui.
3. **Seules les pages publiées sont proposables.** Un brouillon ou une page dépubliée ne peut pas
   être désigné.
4. **On ne supprime pas une page, on la dépublie** (arbitrage du 7 octobre) : aucun écran de
   suppression, aucun état « page supprimée ».

## Screens to produce

Trois écrans, plus un repère de continuité. Données fictives : association « Les Amis de l'Étang »,
teinte « eau » (195), logo absent (donc monogramme « AE »). Pages du site : « Bienvenue aux Amis de
l'Étang » (publiée), « Qualité de l'eau » (publiée), « Adhérer à l'association » (publiée),
« Compte-rendu AG 2025 » (brouillon). Actualités d'exemple : « Assemblée générale du 10 octobre »
(2 septembre 2026), « Travaux sur la canalisation du chemin des Pins » (18 août 2026), « Résultats de
l'analyse d'eau de juillet » (29 juillet 2026), « Fête de l'étang : merci à tous » (14 juillet 2026).

### 0 · Repère de continuité — barre latérale du back-office (déjà livrée, ne pas redessiner)

Le back-office (`/bureau`) a une barre latérale (`sidebar`, 248 px fixe → tiroir `sheet` sous `lg`),
avec l'identité de l'association en tête. Groupe **« Le site »** : Pages, Actualités, Analyses
d'eau, Navigation, Messages, Signalements, Le bureau, Alerte. Cette story ajoute
**« Page d'accueil » au groupe « Le site », juste après « Pages »**. L'afficher actif (fond
`sidebar-accent` + libellé en 600) sur l'écran 1 seulement.

### 1 · Bureau — Page d'accueil

- **Purpose** : dire aux visiteurs ce qu'ils voient en premier à l'adresse de l'association.
- **Layout** : `h1` « Page d'accueil », chapeau en `body` : « C'est la première chose que voient les
  visiteurs quand ils tapent l'adresse de votre association. » Dessous, une `card` « Ce que voient
  les visiteurs » contenant un `radio-group` de deux choix, puis les actions.
- **Fields / content** :
  - Choix 1 (par défaut) : **« L'accueil automatique »** — aide : « Le nom et le logo de
    l'association, puis ses trois dernières actualités. »
  - Choix 2 : **« Une page du site »** — aide : « Vous écrivez l'accueil vous-même dans l'éditeur de
    pages. » Quand ce choix est sélectionné, un `select` apparaît dessous, libellé **« Page
    choisie »**, listant **les pages publiées seulement**, titre de la page en `body`, aide
    : « Seules les pages publiées sont proposées. »
  - Une ligne `meta` en tête de carte dit l'état **actuel** (avant tout changement) : « Aujourd'hui :
    l'accueil automatique. » ou « Aujourd'hui : la page « Bienvenue aux Amis de l'Étang ». »
- **Actions** : un seul bouton `default` **« Enregistrer l'accueil »** ; à côté, un bouton `outline`
  avec icône `ExternalLink` **« Voir l'accueil du site »** (s'ouvre dans un nouvel onglet, et le
  libellé accessible le dit). Libellé du bouton remplacé par « Enregistrement… » pendant l'envoi,
  **largeur conservée**.
- **States** (les montrer tous, une planche par état ou regroupés) :
  - **a. Rien de choisi** : choix 1 sélectionné, pas de `select`.
  - **b. Une page choisie, enregistrée** : choix 2 sélectionné, `select` sur « Bienvenue aux Amis de
    l'Étang », `alert` **neutre** ancrée avec `CircleCheck` en `primary` : « Accueil enregistré. Les
    visiteurs voient maintenant la page « Bienvenue aux Amis de l'Étang » à l'adresse de
    l'association. » (jamais un toast).
  - **c. Aucune page publiée** : le choix 2 est désactivé, et **la raison est écrite** sous lui :
    « Aucune page n'est publiée pour l'instant. » + lien « Publier une page » vers la liste des pages.
    Le choix 1 reste sélectionné.
  - **d. La page désignée n'est plus publiée** : choix 2 sélectionné, `select` montrant « Bienvenue aux
    Amis de l'Étang — non publiée », et une `alert` **`warning`** ancrée : « La page « Bienvenue aux
    Amis de l'Étang » n'est plus publiée. Les visiteurs voient l'accueil automatique en attendant.
    Publiez-la de nouveau, ou choisissez-en une autre. » avec les liens « Ouvrir la page » et le
    `select` ci-dessous pour en choisir une autre.
  - **e. Échec d'enregistrement** : `alert` `destructive`, bordure 2 px, `role="alert"` : « L'accueil
    n'a pas été enregistré. Rien n'a changé : les visiteurs voient toujours l'accueil automatique.
    Réessayez dans un instant. » Variante de texte quand la page choisie vient d'être dépubliée :
    « Cette page n'est plus publiée. Choisissez-en une autre. »
  - **f. Enregistrement en cours** : bouton « Enregistrement… », largeur conservée, tout le reste
    inchangé.
  - Pas d'état « chargement » : l'écran est un formulaire, jamais un `skeleton`.
- **Mobile (390 px)** : même ordre, une colonne, gouttière 16 px ; `select` et boutons en pleine
  largeur, **56 px** de haut ; « Enregistrer l'accueil » au-dessus de « Voir l'accueil du site » ;
  barre latérale en tiroir (`sheet`), non dessinée.

### 2 · Site public — l'accueil quand une page est désignée (`/`)

- **Purpose** : le visiteur arrive sur le contenu choisi par le bureau.
- **Layout** : **l'en-tête public existant** (logo ou monogramme + nom, menu composé par le bureau,
  bouton « Connexion »), **non redessiné** ; le bandeau d'alerte du site, quand il existe, reste
  au-dessus. Puis la page : **exactement le gabarit d'une page du site** — un `<article>` centré, en
  colonne de lecture d'environ 832 px, le titre de la page en `h1` (34 px, Source Serif 4 / 600),
  puis les blocs dans leur ordre. Pied de page existant, non redessiné.
- **Fields / content** : la page « Bienvenue aux Amis de l'Étang » avec trois blocs : un paragraphe
  de texte riche (18 px / 1,65), une image avec légende, un **encart** (le seul bloc où la teinte
  de l'association s'exprime). Aucun contenu fixe ajouté par le produit autour.
- **Actions** : aucune propre à cet écran. Aucun bouton d'inscription ni de tarification.
- **States** : un seul — la page rendue. Un bloc incomplet est omis, jamais affiché en boîte vide.
  Pas d'aperçu de brouillon sur `/` : seule une page publiée peut être l'accueil.
- **Mobile (390 px)** : gouttière 18 px, image pleine largeur sans marge, espacement entre blocs
  24 px, menu dans le tiroir mobile existant (non dessiné).

### 3 · Site public — l'accueil minimal (`/` sans page désignée)

- **Purpose** : un accueil honnête quand le bureau n'a rien choisi, ou quand la page choisie n'est
  plus publiée. Il ne montre que ce que l'association a déjà publié.
- **Layout** : en-tête et pied de page existants, non redessinés. Dans la même colonne de lecture
  que les pages du site, dans cet ordre :
  1. **Le nom de l'association en `h1`** au gabarit `display` (Source Serif 4, 44 px / 600).
     L'en-tête porte déjà le logo ou le monogramme et le nom : ne pas refaire une seconde marque.
  2. **Sa description**, en `body-lg` 18 px, **si elle existe** ; sinon rien, pas de phrase de repli.
  3. **Section « Dernières actualités »** en `h2` (26 px), puis **les trois dernières actualités
     publiées**, chacune au patron déjà utilisé par la liste publique des actualités : vignette 4:3
     d'environ 160 px à gauche **seulement si l'actualité a une image** (sinon rien, ni cadre ni
     illustration), date en clair (« 2 septembre 2026 »), **titre en lien**, filet entre les
     éléments. Les titres d'actualité sont des `h3` (20 px / 600) puisqu'ils sont sous un `h2`.
  4. Un lien souligné **« Toutes les actualités »** vers la liste complète.
- **Fields / content** : jamais un texte, un lien ou un bouton de la vitrine du boilerplate (pas de
  « Essayez gratuitement », pas de lien vers les tarifs ni vers l'inscription, pas de cartes de
  fonctionnalités, pas d'image d'illustration).
- **Actions** : les titres d'actualité et le lien « Toutes les actualités ». Rien d'autre.
- **States** :
  - **a. Avec actualités** (trois) — l'état nominal.
  - **b. Sans aucune actualité** : la section « Dernières actualités » **reste** avec la phrase
    « Aucune actualité pour l'instant. », sans lien ni action (c'est un visiteur).
  - **c. Sans description ni actualités** : le nom en `h1`, puis la phrase de b. — c'est le cas
    d'une association qui vient d'être créée ; la page ne doit pas paraître cassée.
  - Pas d'état d'erreur ni de chargement visible : la page ne montre jamais son propre échec à un
    visiteur.
- **Mobile (390 px)** : gouttière 18 px ; le `h1` garde la taille `display` du design system
  (44 px) et **passe à la ligne** si le nom est long ; l'image de l'actualité passe en pleine largeur
  **au-dessus** de la date, comme sur la liste publique ; le lien « Toutes les actualités » mesure
  au moins 44 px de haut.

## Design system constraints (non-negotiable)

**Tokens — thème clair unique** (`:root`), copiés de `docs/design-system.md` §1.1 :

```
--background: oklch(1 0 0)           --foreground: oklch(0.22 0.015 250)
--card: oklch(1 0 0)                 --muted: oklch(0.972 0.005 240)
--muted-foreground: oklch(0.45 0.02 245)   --border: oklch(0.9 0.008 245)
--input: oklch(0.66 0.014 245)       --ring: oklch(0.55 0.11 235)
--primary: oklch(0.35 0.06 240)      --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.965 0.006 240)  --destructive: oklch(0.48 0.17 27)
--destructive-text: oklch(0.48 0.17 27)
--link: oklch(0.45 0.13 250)
--warning: oklch(0.94 0.06 75)  --warning-border: oklch(0.6 0.13 65)  --warning-foreground: oklch(0.3 0.08 60)
--accent-hue: 195 (démo — bleu « eau », teinte réelle choisie par association, six teintes possibles)
--accent: oklch(0.958 0.024 195)     --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)  --accent-border: oklch(0.88 0.045 195)
--sidebar: oklch(0.985 0.004 250)    --sidebar-foreground: oklch(0.26 0.015 250)
--sidebar-accent: oklch(0.93 0.012 245)  --sidebar-border: oklch(0.91 0.008 245)
--radius: 0.5rem (rounded-md 8px champs/boutons/cartes, rounded-lg 12px feuilles/dialogues, rounded-full badges)
```

**Typographie** : Source Serif 4 (`display` 44px/600 interligne 48px, `h1` 34px/600, `h2`
26px/600), Public Sans (`h3` 20px/600, `body` 17px, `body-lg` 18px pour le site public, `label`
16px/500, `button` 16-17px/600, `meta` 15px). Texte jamais sous 17 px (public : jamais sous 18 px).
« Facultatif » écrit en clair, jamais d'astérisque pour l'obligatoire. Longueur de ligne 60-75
caractères.

**Espacement** : échelle à 8 valeurs — 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px. Rien en dehors.

**Cibles et focus** : 44×44 minimum, 56 px pour les actions principales sur mobile. `outline: 2px
solid var(--ring); outline-offset: 2px` — jamais `outline: none`. Aucune action au survol seul.

**Composants à réutiliser tels quels** : `button` (un seul `default` par écran, le reste `outline` ;
hauteur 48 px, 56 px sur mobile ; libellé à l'infinitif explicite), `card` (bordure 1 px, sans
ombre), `radio-group` (2-3 options courtes ; sélection = bordure 2 px `primary` + point `primary`,
jamais la couleur seule), `select` (au-delà de 3 options ou liste de pages), `label`, `alert`
(**jamais de toast pour un résultat important** ; neutre avec `CircleCheck` en `primary` pour un
succès, `warning` pour un état à corriger, `destructive` à bordure 2 px et `role="alert"` pour un
échec), `sidebar` (item actif = fond `sidebar-accent` + libellé en 600, selon la route),
`<AssociationMark />` (logo ou monogramme + nom, **seul composant autorisé pour montrer
l'identité** ; ne pas le recomposer), `breadcrumb` non nécessaire (premier niveau).

Patrons à réemployer à l'identique, sans les redessiner : le **gabarit d'une page du site public**
(`<article>` en colonne de lecture, `h1` 34 px puis blocs) et la **liste publique des actualités**
(date en clair, titre en lien, vignette 4:3 facultative, filet entre éléments).

**Do / Don't** :

- ✅ Une seule action `default` par écran (« Enregistrer l'accueil »).
- ✅ Le mot porte l'information ; la couleur ne fait que renforcer (état « non publiée » écrit,
  jamais seulement grisé).
- ✅ Vouvoiement, phrases courtes, aucun jargon : « Page d'accueil », « Publier une page ». Jamais
  « slug », « paramètre », « tenant », « route ».
- ✅ Un message d'erreur dit ce qui est perdu — ici : rien — et l'action suivante.
- ✅ Un échec n'est jamais montré au visiteur : un bloc incomplet est omis.
- ✅ Dates en clair côté public (« 2 septembre 2026 »).
- ✅ Typographie française : espace insécable avant `: ; ! ?`, guillemets « », apostrophe courbe.
- ❌ Mode sombre, sélecteur de thème, interrupteur clair/sombre — retirés du produit.
- ❌ Hero marketing, bouton « Essayez gratuitement », lien vers la tarification, cartes de
  fonctionnalités, illustration de produit — c'est la vitrine à faire disparaître.
- ❌ L'accent de l'association sur un bouton ou comme seul porteur d'un statut.
- ❌ Toast pour un résultat d'enregistrement. `skeleton` sur un formulaire. Défilement infini.
- ❌ Un second `h1`, ou un saut de niveau de titre (`h1` → `h2` → `h3`).
- ❌ Un bloc « Aperçu » ou un bandeau de brouillon sur l'accueil public.

Do not invent components, tokens or colors outside these.

**Point que le design system ne tranche pas** : le jeton `display` (44 px) n'a pas de taille
mobile fixée. Le garder à 44 px sur 390 px et **le signaler dans la livraison** s'il déborde ou
rend mal, sans inventer une taille intermédiaire.

## Out of scope

- L'**en-tête** et le **pied de page** du site public, le **bandeau d'alerte** et le **menu** :
  existants, pas redessinés.
- **L'éditeur de pages**, la liste des pages, la publication et la dépublication d'une page
  (s04) : pas redessinés. En particulier, **aucun avertissement n'est dessiné** dans l'éditeur
  quand on dépublie la page d'accueil.
- La **liste complète des actualités** et la page d'une actualité (s05) : on n'y renvoie que par un
  lien.
- Le **menu** du site : savoir si la page d'accueil y figure ou non n'est pas un sujet de cette story.
- Un **mode sombre**, un **sélecteur de thème**, une version de chaque écran en deux thèmes.
- La **suppression d'une page** : n'existe pas dans le produit.
- La page de **refus d'accès** (403) pour un non-membre du bureau : existe déjà.
- Les écrans de connexion, de compte et d'inscription (s46).
- Tout **bloc ou type de contenu nouveau** pour l'accueil : un besoin non couvert est un « design
  system gap » à signaler, pas à dessiner.

## Expected output

A static HTML mockup of each screen (low fidelity is fine), using only the tokens above : écrans 1
(avec ses états a à f), 2 et 3 (avec ses états a à c), **chacun en version ordinateur et en version
mobile 390 px, en mode clair seulement**. Les puces des planches suivent la numérotation ci-dessus
(`1a`…`1f`, `2`, `3a`…`3c`). Bring the export back — it will be saved as docs/designs/s44-page-accueil.html.
