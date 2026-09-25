# Design Brief — Story s07-bandeau-alerte

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** membre du bureau **je veux** activer un bandeau d'alerte sur l'ensemble du site
**afin de** prévenir immédiatement d'une coupure d'eau ou de travaux.

Acceptance criteria :

1. Activer le bandeau avec un message l'affiche sur **toutes les pages du site existantes, publiques
   comme authentifiées**.
2. Modifier le message met à jour le bandeau **immédiatement**, sans redéploiement.
3. Désactiver le bandeau le retire de toutes les pages.
4. **N'importe quel membre du bureau** peut l'activer, le modifier et le retirer, sans restriction
   supplémentaire.

Contexte produit : le back-office est tenu par 3 à 8 bénévoles élus, non techniciens, souvent âgés.
Le site public s'adresse aux propriétaires (souvent âgés) et aux visiteurs sans compte. Critère de
recette : un membre du bureau, **seul devant l'écran, un jour de coupure d'eau**, écrit son message
et le voit sur le site en moins d'une minute.

### Les arbitrages déjà rendus — ne pas les rouvrir

Ces décisions sont prises. Elles ferment des questions que le design system laissait ouvertes ; la
maquette les applique telles quelles.

- **Un seul niveau de gravité, et le bandeau n'est pas refermable par le visiteur.** C'est le
  périmètre écrit de la story. Les trois niveaux (`info` / `warning` / `critical`) décrits au design
  system §2.3 restent une **extension future**, pas un attendu de la V1. Conséquences directes, à
  tenir dans la maquette : **pas de croix de fermeture**, pas de « masquer pendant 24 h », **aucune
  mémorisation côté visiteur**, pas de mot de niveau à écrire, pas de choix de gravité dans l'écran
  du bureau.
  _À faire hors de cette maquette_ : `docs/design-system.md` §2.3 porte encore « ne pas trancher
  avant `/ks-design s07` » et `docs/prd.md` n'a rien écrit sur la gravité — **les deux documents
  restent à mettre à jour** pour enregistrer cet arbitrage. Ce brief ne les modifie pas.
- **Écran du bureau : une page dédiée « Bandeau d'alerte »**, dans le groupe **« Le site »** de la
  barre latérale. Pas une section de l'écran « Réglages », pas une section de « Navigation ».
- **Le message est conservé à la désactivation**, pour pouvoir être réactivé tel quel. Retirer le
  bandeau ne vide pas le champ.
- **Message : texte brut, 280 caractères maximum, sans lien.** Pas de gras, pas de markdown, pas de
  `{label, href}`.
- **Le bandeau s'affiche sur toutes les pages, publiques comme authentifiées, back-office compris**
  (critère 1). C'est pour cela que cette maquette montre le bandeau dans **trois familles de
  gabarits**, et pas seulement sur le site public.

### Le piège de placement — la contrainte la plus structurante de la story

Le design system dit : le bandeau **pousse la page, il ne la recouvre pas** (§2.2). Or le
back-office du bureau, l'espace SuperAdmin et l'espace membre ont une **barre latérale fixée en
pleine hauteur d'écran** (`fixed; inset-y-0; height: 100svh`). Un bandeau posé naïvement en haut du
contenu **passerait dessous** : recouvert à gauche par la barre, et la page dépasserait la hauteur
de l'écran.

La maquette doit donc montrer, explicitement et sans ambiguïté :

- le bandeau **en tête du document, sur toute la largeur de la fenêtre**, au-dessus de tout le reste
  y compris de la barre latérale ;
- la barre latérale et la zone de contenu qui **commencent sous le bandeau** — leur arête haute est
  alignée sur le bas du bandeau, pas sur le haut de la fenêtre ;
- la hauteur restante qui se répartit dessous, sans double barre de défilement.

**Le bandeau n'est pas collant** (`sticky`) : il est dans le flux, en tête de page, et disparaît au
défilement. C'est la lecture littérale de « pousse la page, ne la recouvre pas ». _Décision de
conception, à confirmer au plan._

## Screens to produce

Quatre écrans, plus un repère de continuité. Données fictives : association **« Les Amis de
l'Étang »**, teinte « eau » (195).

**Deux messages d'exemple**, à utiliser partout pour que le pire cas soit visible :

- **Court** (1 ligne en desktop) :
  « Coupure d'eau jeudi 24 septembre de 9 h à 16 h sur le chemin des Pins. »
- **Long** (≈ 280 caractères, le maximum autorisé) :
  « Coupure d'eau programmée jeudi 24 septembre, de 9 h à 16 h, sur le chemin des Pins et la route
  du Moulin, pour le remplacement de la canalisation principale. Pensez à remplir quelques
  bouteilles la veille. Le bureau reste joignable pendant toute la durée des travaux. »

### Le composant lui-même — `<AlertBanner />`, à dessiner une fois et à réemployer

C'est le seul élément visuel nouveau de la story. Il est identique dans les quatre écrans ; seul son
environnement change.

- **Pleine largeur de fenêtre** (le fond déborde jusqu'aux bords), **contenu centré** dans
  `max-w-[1200px]` avec les gouttières du gabarit de la page où il se trouve (24 / 44 px en desktop,
  18 px en mobile).
- **Fond `warning`**, **texte `warning-foreground`**, **filet de 2 px `warning-border` en bas** du
  bandeau — c'est ce filet qui le sépare de l'en-tête qui suit. Pas de rayon : le bandeau est
  d'angle droit, il touche les bords.
- **Intérieur** : 12 px vertical, gouttière horizontale du gabarit. En une ligne : icône
  `AlertTriangle` **20 px**, trait 1,75, `currentColor`, alignée sur la première ligne du texte ·
  8 px · le mot **« Alerte »** en `body-strong` (17 px / 600) · puis le message en `body` (17 px).
- **Jamais la couleur seule** (règle §8) : l'icône et le mot « Alerte » portent l'information ;
  l'ambre ne fait que la renforcer. C'est l'équivalent, à un seul niveau, des « quatre signaux » du
  design system.
- **Pas de bouton, pas de croix, pas de lien** dans le bandeau. Il n'est pas interactif.
- **Le message ne se tronque jamais** : il passe à la ligne autant que nécessaire. Voir l'écart 3.
- **Annotation de balisage à porter en marge** (elle ne se voit pas, mais elle engage
  l'implémentation) : le bandeau est une région étiquetée —
  `<section role="region" aria-label="Alerte de l'association">` — **sans** `aria-live` et **sans**
  `role="alert"`. Un `role="alert"` réannoncerait le message à chaque chargement de page, sur toutes
  les pages du site ; le design system réserve l'annonce impérative à l'entrée et à la sortie de
  simulation de rôle (§2.6). _Décision de conception, à confirmer au plan._
- **À l'impression, le bandeau disparaît** (§6.2). Rien à dessiner, mais à ne pas oublier.

### 0 · Repère de continuité — barre latérale du back-office (déjà livrée, ne pas redessiner)

Le back-office `/bureau` a déjà sa barre latérale (`sidebar`, 248 px fixe → tiroir `sheet` sous
`lg`), avec l'identité de l'association en tête (logo ou monogramme 34 px + nom écrit). Elle compte
deux groupes :

- **« Le site »** : Pages, Navigation ;
- **« L'association »** : Identité, Réglages.

Cette story ajoute **« Bandeau d'alerte »** au groupe **« Le site »**, en **dernière position du
groupe**, après « Navigation ». Icône `AlertTriangle` 20 px + libellé. La montrer active (fond
`sidebar-accent` + libellé 600) sur l'écran 1 seulement.

> Une autre story en cours ajoute « Actualités » au même groupe. Le voisinage n'a pas à être
> reproduit fidèlement : dessiner le groupe avec Pages, Navigation, puis Bandeau d'alerte.

### 1 · Bureau — page « Bandeau d'alerte » (écran principal)

- **Purpose** : écrire un message d'alerte, l'afficher sur tout le site, le corriger, le retirer.
- **Layout** : gabarit back-office habituel — barre latérale 248 px, zone de contenu. `h1` « Bandeau
  d'alerte » (Source Serif 4, 34 px), puis une ligne d'introduction en `body`
  `muted-foreground` : « Le bandeau s'affiche en haut de toutes les pages du site, y compris de cet
  espace. » Sous le titre, **deux cartes empilées**, colonne unique, largeur de contenu ≈ 720 px :

  **Carte 1 — « Message »**
  - Un `label` au-dessus, toujours visible : **« Message de l'alerte »**.
  - Un `textarea` de **4 lignes environ**, texte 17 px, bordure `input` 1 px.
  - **Consigne écrite avant tout échec**, sous le champ, en `meta` `muted-foreground` :
    « 280 caractères au maximum. Texte simple, sans lien : écrivez la date, l'heure et le lieu. »
  - **Compteur** aligné à droite sous le champ, en `data` (`font-mono`, `tabular-nums`) :
    « 71 / 280 ». Il passe en `destructive` **et** le champ prend sa bordure `destructive` 2 px
    au-delà de 280.
  - Sous la carte, la **ligne d'état du bandeau**, écrite, jamais portée par la seule couleur :
    point + libellé — **« Bandeau affiché sur le site »** ou **« Bandeau masqué »**.

  **Carte 2 — « Aperçu »**
  - Le `<AlertBanner />` tel qu'il apparaîtra, à l'échelle, dans un cadre neutre figurant le haut
    d'une page (un filet `border` et deux ou trois lignes grisées suffisent à situer le contexte).
  - Titre de carte en `h3` (20 px / 600) + une ligne `meta` : « Voici ce que verront les visiteurs. »
  - **Quand le message est vide** : à la place de l'aperçu, une ligne `muted-foreground` —
    « Écrivez un message pour voir l'aperçu. » Pas de cadre vide illustré.

- **Actions**, en bas de l'écran, alignées à gauche sous les cartes. **Un seul bouton `default` par
  écran** ; le libellé du bouton principal suit l'état :
  - bandeau masqué → **« Afficher le bandeau sur le site »** (`default`, 48 px) ;
  - bandeau affiché → **« Enregistrer le message »** (`default`) **et**, à sa droite, **« Retirer le
    bandeau »** (`outline`).
  - **Il n'y a pas d'interrupteur (`switch`).** Le message et son affichage sont enregistrés
    ensemble, d'un seul geste : un interrupteur basculé pendant que le champ porte une modification
    non enregistrée serait ambigu pour un bénévole. _Décision de conception, à confirmer au plan._
  - **Retirer le bandeau agit immédiatement, sans boîte de confirmation**, et **le message reste dans
    le champ**. C'est ce qui rend l'action sans danger et réversible.

- **States** :
  - **Vide** (première visite, aucun message n'a jamais été écrit) : `textarea` vide, compteur
    « 0 / 280 », carte Aperçu avec sa ligne « Écrivez un message pour voir l'aperçu. », ligne d'état
    « Bandeau masqué », un seul bouton : « Afficher le bandeau sur le site ».
  - **Chargement** (enregistrement en cours) : le bouton principal garde **sa largeur**, son libellé
    est remplacé par « Enregistrement… », il est désactivé. Pas de `skeleton` : ce n'est ni une liste
    ni un tableau.
  - **Erreur**, deux cas à montrer :
    1. _Message vide à la soumission_ — bordure `destructive` 2 px sur le `textarea` et message sous
       le champ : « Écrivez le message avant d'afficher le bandeau. »
    2. _Échec d'enregistrement_ — une `alert` **ancrée en tête de l'écran**, jamais un toast, jamais
       disparaissant seule : « Le bandeau n'a pas pu être affiché. **Rien n'est perdu** : votre
       message est toujours dans le champ. Réessayez dans un instant. »
  - **Succès** : `alert` neutre ancrée en tête, icône `CircleCheck` en `primary` (il n'y a pas de
    token de succès, pas de vert) : « Bandeau affiché sur tout le site, avec votre message. »
    Ligne d'état « Bandeau affiché sur le site », aperçu rempli, boutons « Enregistrer le message »
    - « Retirer le bandeau ».
  - **Cinquième état, propre à l'arbitrage — « masqué, message conservé »** : après un retrait, le
    `textarea` **contient toujours** le message long, le compteur affiche sa valeur, la ligne d'état
    dit « Bandeau masqué », le bouton principal est redevenu « Afficher le bandeau sur le site », et
    une `alert` neutre ancrée dit : « Bandeau retiré du site. Le message est conservé : vous pourrez
    l'afficher à nouveau. » **C'est l'état qui prouve la décision : le montrer explicitement.**

- **Le bandeau est-il visible sur cet écran même ?** Oui, quand il est actif : cette page est une
  page du site, elle l'hérite comme les autres (critère 1). Montrer l'état « Succès » **avec le
  `<AlertBanner />` en haut de la fenêtre**, au-dessus de la barre latérale. C'est le même dessin que
  l'écran 3.

- **Mobile (390 px)** : gouttière 16 px, une colonne. Barre latérale en tiroir (`sheet`) derrière un
  bouton « Menu » dans un en-tête de 56 px. `textarea` en pleine largeur, champs et boutons à 56 px,
  bouton principal en pleine largeur, « Retirer le bandeau » en dessous, en pleine largeur également.
  Les deux cartes restent empilées dans le même ordre : Message, puis Aperçu.

### 2 · Site public — le bandeau en tête d'une page publique

- **Purpose** : montrer ce que voit un visiteur sans compte, sur n'importe quelle page du site.
- **Layout** : de haut en bas — **`<AlertBanner />`**, puis l'en-tête public existant (logo 44 px +
  nom + menu horizontal), puis le corps de page, puis le pied de page. **L'en-tête et le pied de page
  existent déjà : ne pas les redessiner en détail**, un dessin sommaire suffit à situer le bandeau.
  Le corps de page peut être une page d'accueil quelconque (un titre, deux paragraphes, une image).
  Gabarit public `max-w-[1200px]`, gouttière 24 / 44 px.
- **Ce que la maquette doit prouver** : le bandeau **pousse l'en-tête vers le bas**, il ne flotte pas
  par-dessus, et rien du site n'est masqué.
- **States** :
  - **Sans bandeau** (référence de comparaison) : la même page sans rien en tête. Montrer les deux
    l'une sous l'autre : c'est la lecture la plus rapide de « pousse la page ».
  - **Message court** : le bandeau tient sur une ligne en desktop.
  - **Message long (280 caractères)** : deux lignes en desktop, davantage en mobile — voir l'écart 3.
  - **Chargement et erreur : rien à dessiner.** La page est rendue par le serveur ; le bandeau est
    présent ou absent, il n'a ni squelette ni état d'échec côté visiteur.
- **Mobile (390 px)** : gouttière 18 px. Le bandeau reste en pleine largeur, son contenu suit la
  gouttière. L'icône et le mot « Alerte » restent sur la première ligne du texte, jamais sur une
  ligne à eux seuls.

### 3 · Back-office — le bandeau au-dessus d'un gabarit à barre latérale

**C'est l'écran qui règle le piège.** Il vaut à l'identique pour `/bureau/**`, pour l'espace
SuperAdmin `admin/**` et pour l'espace membre : un seul dessin suffit, sur `/bureau/pages`.

- **Purpose** : montrer que le bandeau tient au-dessus d'une barre latérale fixée en pleine hauteur.
- **Layout desktop** : **`<AlertBanner />` sur toute la largeur de la fenêtre, en première position**.
  Sous lui, et seulement sous lui, la barre latérale de 248 px à gauche et la zone de contenu à
  droite. **L'arête haute de la barre latérale est alignée sur le bas du filet du bandeau.** La barre
  latérale occupe la hauteur restante, pas la hauteur de la fenêtre.
  - Montrer dans la zone de contenu un écran déjà livré, sommairement : `h1` « Pages » et un tableau
    de deux ou trois lignes. **Ne pas le redessiner en détail** : il est là pour le contexte.
  - **Annoter en marge** le trait de séparation : « la barre latérale commence sous le bandeau — elle
    ne monte pas jusqu'en haut de la fenêtre ».
- **Contre-exemple à dessiner une fois, barré ou marqué ❌** : le même écran avec le bandeau glissé
  _à l'intérieur_ de la zone de contenu, recouvert à gauche par la barre latérale. Une seule vignette,
  petite, uniquement en desktop clair. C'est le piège que la maquette existe pour fermer.
- **States** : **sans bandeau** (référence), **message court**, **message long**. Comme pour l'écran
  2, ni chargement ni erreur : le bandeau est rendu par le serveur.
- **Mobile (390 px)** : sous `lg` la barre latérale est un tiroir. De haut en bas : bandeau, puis
  en-tête de 56 px avec le bouton « Menu » et le nom de l'association, puis le contenu. **Montrer
  aussi le tiroir ouvert** : il s'ouvre **sous le bandeau**, il ne le recouvre pas.

### 4 · Connexion — le bandeau au-dessus d'un gabarit centré

- **Purpose** : troisième famille de gabarits — une page centrée sur fond `muted`, sans barre
  latérale et sans en-tête de site. Elle compte parmi les « pages existantes » du critère 1.
- **Layout** : **`<AlertBanner />`** en tête, puis le fond `muted` occupant le reste de la fenêtre,
  avec l'`<AssociationMark />` (carré 44 px + nom écrit) puis la `card` de connexion centrée
  verticalement dans **l'espace restant sous le bandeau**, jamais recalée sous le bord de la fenêtre.
  La carte de connexion existe déjà : un titre, un champ email, un bouton. **Sommaire suffit.**
- **States** : **sans bandeau** et **message long** — deux frames, c'est assez ; c'est le
  centrage vertical qui est en jeu, pas le contenu du message.
- **Mobile (390 px)** : gouttière 16 px, carte en pleine largeur sous le bandeau.

> **Les autres gabarits n'ont rien de nouveau à montrer** : l'espace membre et l'espace SuperAdmin
> reprennent exactement l'écran 3 (barre latérale), les pages d'erreur et la documentation héritée
> reprennent l'écran 2 (flux simple). Ne pas les dessiner.

## Design system constraints (non-negotiable)

**Tokens — deux thèmes, clair et sombre (ADR 012).** Le back-office reprend les mêmes tokens que le
site public ; seule la `sidebar` a sa propre palette. Le trio `warning` est le cœur de cette story.

**Clair** (`:root`) :

```
--background: oklch(1 0 0)                 --foreground: oklch(0.22 0.015 250)
--card: oklch(1 0 0)                       --muted: oklch(0.972 0.005 240)
--muted-foreground: oklch(0.45 0.02 245)   --border: oklch(0.9 0.008 245)
--input: oklch(0.66 0.014 245)             --ring: oklch(0.55 0.11 235)
--primary: oklch(0.35 0.06 240)            --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.965 0.006 240)        --secondary-foreground: oklch(0.3 0.02 245)
--destructive: oklch(0.48 0.17 27)         --link: oklch(0.45 0.13 250)

--warning: oklch(0.94 0.06 75)             ← fond du bandeau
--warning-border: oklch(0.72 0.12 70)      ← filet 2 px
--warning-foreground: oklch(0.3 0.08 60)   ← icône, mot « Alerte », message

--accent-hue: 195 (démo « eau » ; six teintes possibles, injectée par association)
--accent: oklch(0.958 0.024 195)           --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)        --accent-border: oklch(0.88 0.045 195)
--sidebar: oklch(0.985 0.004 250)          --sidebar-foreground: oklch(0.26 0.015 250)
--sidebar-accent: oklch(0.93 0.012 245)    --sidebar-border: oklch(0.91 0.008 245)
--radius: 0.5rem — rounded-md 8px champs/boutons/cartes, rounded-lg 12px dialogues/feuilles
```

**Sombre** (`.dark`) :

```
--background: oklch(0.215 0.009 255)       --foreground: oklch(0.94 0.006 250)
--card: oklch(0.215 0.009 255)             --muted: oklch(0.255 0.009 250)
--muted-foreground: oklch(0.72 0.015 248)  --border: oklch(0.33 0.01 250)
--input: oklch(0.52 0.016 250)             --ring: oklch(0.7 0.12 235)
--primary: oklch(0.5 0.14 255)             --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.27 0.01 250)          --secondary-foreground: oklch(0.9 0.008 250)
--destructive: oklch(0.58 0.19 27)         --link: oklch(0.8 0.1 250)

--warning: oklch(0.3 0.05 75)              ← fond du bandeau (valeur DÉRIVÉE, voir l'écart 2)
--warning-border: oklch(0.6 0.11 70)       ← filet 2 px  (valeur DÉRIVÉE)
--warning-foreground: oklch(0.93 0.05 80)  ← texte       (valeur DÉRIVÉE)

--accent: oklch(0.275 0.035 195)           --accent-foreground: oklch(0.84 0.075 195)
--accent-solid: oklch(0.64 0.11 195)       --accent-border: oklch(0.4 0.055 195)
--sidebar: oklch(0.19 0.009 255)           --sidebar-foreground: oklch(0.93 0.006 250)
--sidebar-accent: oklch(0.3 0.014 250)     --sidebar-border: oklch(0.32 0.01 250)
```

**Le rayon `--radius` ne dépend pas du thème.** Le bandeau, lui, n'a aucun rayon : il touche les
bords de la fenêtre.

**Typographie** :

- **Source Serif 4** — titres : `h1` 34 px / 600 (titre de page), `h2` 26 px / 600.
- **Public Sans** — `h3` 20 px / 600 (titre de carte du back-office), `body` 17 px / 1,6 (back-office
  et message du bandeau), `body-lg` 18 px / 1,65 (texte courant du site public), `body-strong`
  17 px / 600 (le mot « Alerte »), `label` 16 px / 500, `button` 16–17 px / 600, `meta` 15 px
  (consignes, aides sous les champs).
- **JetBrains Mono** — `data` pour le compteur de caractères, avec `tabular-nums`.

Règles non négociables : texte courant **jamais sous 17 px**, jamais sous 18 px en public ·
métadonnées jamais sous 15 px · libellé de champ toujours visible au-dessus, **jamais de placeholder
en guise de libellé**, jamais d'astérisque — « Facultatif » s'écrit · `text-wrap: pretty` sur les
titres · longueur de ligne 60-75 caractères en public.

**Espacement — huit valeurs, rien d'autre** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px.
Toute mesure hors échelle est un bug.

**Gabarits** : site public `max-w-[1200px]`, gouttière 24 / 44 px (18 px en mobile) · back-office
barre latérale 248 px fixe, tiroir (`sheet`) sous `lg` · points de rupture `sm` 640, `md` 768,
`lg` 1024, `xl` 1280.

**Cibles, focus, mouvement** : cible minimale **44 × 44**, **56 px** pour les actions principales en
mobile · `outline: 2px solid var(--ring); outline-offset: 2px`, **jamais `outline: none`** · aucune
action déclenchée au survol seul · aucune animation au-delà de 200 ms, transitions limitées à 120 ms
sur couleur et bordure.

**Icônes lucide** : 16 / 20 / 24 px, trait 1,75, `currentColor` exclusivement. Vocabulaire figé —
**`AlertTriangle` = alerte**, `CircleCheck` = succès. Toujours icône **+** libellé ; jamais une icône
seule comme action côté bureau.

**Ombres — trois seulement** : aucune sur les cartes de contenu (la bordure suffit), `shadow-sm` pour
une carte détachée du fond, `shadow-lg` pour dialogues et tiroirs. **Le bandeau n'a pas d'ombre
portée.**

**Composants à réutiliser tels quels** :

- **`button`** : variantes `default` `outline` `secondary` `destructive` `link` ; tailles 48 px
  (`default`) et 56 px (`lg`, mobile). **Un seul bouton `default` par écran**, le reste en `outline`.
  Libellés à l'infinitif explicite : « Afficher le bandeau sur le site », jamais « OK ». En
  chargement : libellé remplacé, bouton désactivé, **largeur conservée**. Survol d'un `outline` en
  `secondary`, **jamais en accent**.
- **`textarea`, `label`** : une colonne, un champ par ligne, libellé au-dessus toujours visible,
  aide en `muted-foreground` sous le champ, validation au _blur_ puis à la soumission.
- **`card`** : intérieur 24 px, bordure `border` 1 px, `rounded-md`, pas d'ombre.
- **`alert`** : erreur **et** succès **ancrés** dans la page, jamais un toast, ne disparaissent pas
  seuls. Le succès est une `alert` **neutre** avec `CircleCheck` en `primary` — **il n'y a pas de
  token de succès, pas de vert**.
- **`sidebar`** : item actif = fond `sidebar-accent` + libellé 600 ; tiroir `sheet` sous `lg`.
- **`<AssociationMark />`** (déjà construit) : carré 44 px en public / 34 px en back-office, logo ou
  monogramme, **le nom toujours écrit à côté**. Ne pas recomposer un carré et un nom à la main.

**Do / Don't** :

- ✅ **Le mot porte l'information ; la couleur ne fait que renforcer.** Ici : `AlertTriangle` + le mot
  « Alerte » + l'état écrit (« Bandeau affiché sur le site » / « Bandeau masqué »).
- ✅ Sobre, aéré, très lisible. Registre de service public local, pas de startup.
- ✅ Un message d'erreur dit ce qui s'est passé, **ce qui est perdu** — et le plus souvent, que rien
  ne l'est.
- ✅ Les consignes du champ sont écrites **avant** tout échec, pas seulement en message d'erreur.
- ✅ Vouvoiement, phrases courtes, aucun jargon ; typographie française (espace insécable avant
  `: ; ! ?`, guillemets « », apostrophe courbe) ; dates en clair côté public.
- ❌ L'accent de l'association sur le bandeau, sur un bouton, ou comme unique porteur d'un statut :
  le bandeau est **`warning`**, jamais la teinte du tenant.
- ❌ Une information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ Dégradés, verre dépoli, ombres portées lourdes, animations d'apparition ou de glissement du
  bandeau.
- ❌ Densité de tableau de bord SaaS.
- ❌ Bandeau flottant, collant, superposé, réductible, ou recouvert par la barre latérale.
- ❌ Une croix de fermeture, un « ne plus afficher », un choix de gravité, une date de fin.

Ne pas inventer de composant, de token ni de couleur hors de cette liste. Un besoin non couvert se
**signale en marge de la maquette**, il ne se dessine pas en freestyle.

## Design system gaps — à signaler dans la maquette, pas à combler

1. **L'échelle de `z-index` n'existe pas** (design system §9, manque « partagé s04, s07, s41 »).
   Seules deux valeurs sont posées : `<PreviewBar />` à 50 et `<ImpersonationBar />` à 60, cette
   dernière explicitement **au-dessus du bandeau d'alerte**. Avec trois bandes persistantes, plus les
   dialogues, popovers, tiroirs et toasts, il faudrait une échelle explicite. **Ne pas l'inventer** :
   la maquette montre l'ordre d'empilement attendu (simulation de rôle > aperçu > alerte > barre
   latérale) et l'annote comme manque à trancher.
2. **Les tokens `warning` du thème sombre sont dérivés, jamais validés par la conception.** Le design
   system ne définit le trio qu'en clair (§1.1) ; les trois valeurs sombres reprises ci-dessus ont
   été calculées par inversion de luminosité et vérifiées seulement au contraste. **Le bandeau est
   leur premier consommateur visible en mode sombre.** Les utiliser telles quelles, puis **annoter en
   marge** : les valider, les corriger si la conception les juge trop sourdes, et reporter la décision
   dans `docs/design-system.md`.
3. **« Trois lignes maximum en mobile » (§2.3) est incompatible avec un message de 280 caractères
   non refermable.** À 390 px, 280 caractères occupent six à huit lignes. La règle a été écrite pour
   un bandeau refermable à trois niveaux ; ici, tronquer reviendrait à cacher l'alerte, ce qu'aucune
   solution ne rattrape puisque le visiteur n'a ni « Lire la suite » ni fermeture. **La maquette
   affiche donc le message en entier**, et retient l'intention de la règle : « jamais la moitié de
   l'écran ». Montrer le pire cas (280 caractères en 390 px) et l'annoter comme écart assumé.
4. **Le rôle ARIA du bandeau n'est pas tranché par le design system.** La proposition retenue —
   `role="region"` + `aria-label`, sans `aria-live` — est argumentée plus haut. À annoter en marge :
   elle engage l'implémentation, pas le dessin.
5. **Aucune convention n'existe pour un bandeau pleine largeur dans un gabarit à barre latérale.**
   Le design system dit « au-dessus de l'en-tête public » et s'arrête là. La règle proposée par cette
   maquette (bandeau hors de la coquille, barre latérale alignée sous lui) est une **proposition à
   valider**, à annoter comme telle.

## Out of scope

- **Les trois niveaux de gravité** (`info` / `warning` / `critical`), le mot du niveau écrit,
  l'épaisseur de filet variable, la forme d'icône par niveau. Arbitrage rendu : un seul niveau.
- **La fermeture par le visiteur** : croix, « masquer 24 h », mémorisation `localStorage`,
  identifiant de version du message. Rien de tout cela.
- **`endsAt`, publication programmée, désactivation automatique, rappel « bandeau actif depuis
  3 jours »** : la story est explicitement « sans workflow, sans programmation horaire ».
- **Le bouton « désactiver en un clic depuis n'importe quelle page du back-office »** (§2.3) : c'est
  la contrepartie du niveau 3, qui n'existe pas ici. Le retrait se fait depuis l'écran 1.
- **Plusieurs bandeaux simultanés**, file d'attente, confirmation de remplacement.
- **Lien dans le message**, texte riche, markdown, gras, retours à la ligne mis en forme, emoji.
- **Historique des alertes, journal, « dernière modification par X le … »**, aperçu avant affichage
  sur une page réelle : aucun n'est dans les critères.
- **Envoi du message par email ou par SMS** aux membres : ce sont d'autres stories.
- **Isolation entre associations** : garantie par la base, aucun écran à dessiner.
- **L'en-tête et le pied du site public, la page de connexion, l'écran « Pages », la barre latérale
  du bureau** : déjà livrés. Ils apparaissent **sommairement**, pour situer le bandeau ; ne pas les
  redessiner ni les faire évoluer.
- **`docs/design-system.md` §2.3 et `docs/prd.md`** : à mettre à jour hors de cette maquette, pour
  enregistrer l'arbitrage « un seul niveau ».

## Expected output

Un mockup HTML statique des écrans 1 à 4, basse fidélité acceptée :

- en **desktop et en mobile 390 px** ;
- en **clair et en sombre**, avec une bascule (ADR 012 : les deux jeux de tokens ci-dessus) — le
  bandeau ambre est la pièce qui change le plus entre les deux thèmes, c'est là qu'il faut regarder ;
- avec les **états listés par écran**, y compris le cinquième état de l'écran 1 (« masqué, message
  conservé ») et la référence « sans bandeau » des écrans 2, 3 et 4 ;
- en utilisant **exclusivement** les tokens et composants ci-dessus ;
- avec une section ancrée par écran ;
- avec les **cinq écarts annotés en marge**.

Il sera enregistré comme `docs/designs/s07-bandeau-alerte.html`.
