# Design Brief — Story s11-seo

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** visiteur **je veux** trouver le site de l'association dans un moteur de recherche
**afin d'**accéder à ses informations sans en connaître l'adresse.

Acceptance criteria:

1. Le sitemap liste toutes les pages publiées de l'association et aucune page en brouillon ;
   publier une page l'y ajoute — _mécanique, aucun écran._
2. **Chaque page publique expose un titre, une description et des métadonnées de partage
   renseignés par le bureau, avec un repli sur les valeurs de l'association si le champ est vide.**
3. `robots.txt` autorise l'indexation des pages publiques et exclut toute route authentifiée —
   _mécanique, aucun écran._
4. **Le code de vérification Search Console est un paramètre de l'association, saisissable en
   back-office.**
5. Chaque association sert son propre sitemap et ses propres métadonnées sur son propre domaine —
   _mécanique, aucun écran._

Contexte produit : le back-office est tenu par 3 à 8 bénévoles élus, **non techniciens**. Ils ne
savent pas ce qu'est une « meta description » ni une « balise Open Graph » : l'écran doit leur dire,
avec leurs mots, **ce qui s'affichera et où** (dans Google, quand on partage le lien par WhatsApp ou
Facebook). La story est « du réglage par association » : **peu d'écran, et c'est voulu.**

**Seuls les critères 2 et 4 ont une surface visible.** Ce brief ne demande **aucun écran** pour le
sitemap ni pour `robots.txt`.

### Arbitrages déjà rendus — ne pas les rouvrir

- **Tout est facultatif pour le bureau.** Un champ vide n'est jamais une erreur : il prend la valeur
  de repli, **et l'écran dit laquelle** (règle du design system : « un réglage facultatif laissé
  vide dit sous le champ la valeur qui s'applique à sa place »).
- **Les réglages de l'association sont générés depuis un registre** : un nouveau réglage n'amène
  pas de page, seulement une ligne dans la page « Réglages » existante.
- **Pas de score SEO, pas de conseils automatiques, pas d'analyse de mots-clés** : ce n'est pas un
  outil de référencement, c'est un réglage.

## Screens to produce

Trois écrans, plus des repères de continuité. Données fictives : association **« Les Amis de
l'Étang »**, domaine **lesamisdeletang.fr**, teinte **« eau » (195)**. Page d'exemple :
**« Qualité de l'eau »**, adresse `/qualite-de-l-eau`. Actualité d'exemple : **« Fête de l'étang :
rendez-vous le 12 octobre »**, avec une image.

Description de l'association d'exemple (150 caractères) : « Association syndicale libre du domaine
de l'Étang : réseau d'eau privé, chemins et vie du lotissement. Actualités, analyses d'eau et
contact. »

### 0 · Repères de continuité — déjà livrés, **ne pas redessiner**

- **Barre latérale** du back-office : « Le site » (Pages, Actualités, Analyses d'eau, Navigation,
  Messages reçus, Membres du bureau, Bandeau d'alerte), « L'association » (Identité, Réglages).
  **Aucune entrée nouvelle** : cette story ne crée pas de page de back-office.
- **Éditeur de page** (`/bureau/pages/{id}`) : colonne de blocs + panneau « Paramètres » de 296 px à
  droite (en `sheet` sous `xl` ; en mobile, bouton « Paramètres de la page » dans la `PreviewBar`
  sombre de 104 px). Le panneau contient aujourd'hui **Titre** et **Adresse** (slug, préfixe `/`).
- **Éditeur d'actualité** (`/bureau/actualites/{id}`) : formulaire en une colonne — Titre, Date,
  Image (facultative, avec texte alternatif), Contenu.
- **Page « Réglages »** (`/bureau/reglages`) : générée depuis le registre, une `card` par groupe ;
  existent déjà : Adresse de contact, Adresse du responsable forage, Nombre de membres, Demandes de
  lien par jour, Messages par heure.

### 1 · Réglages — deux lignes nouvelles (extrait de `/bureau/reglages`)

Montrer **un extrait** (une `card` « Référencement »), pas la page entière.

- **Description de l'association** — `textarea` 3 lignes, « Facultatif », **compteur de caractères**
  (plafond **160**). Aide : « Deux phrases qui présentent l'association. Elles s'affichent sous le nom
  du site dans les résultats de Google, et quand quelqu'un partage un lien vers une page qui n'a pas
  sa propre description. » Quand elle est vide, dessous : « Vide : les résultats de recherche
  afficheront le texte que Google choisira dans la page. »
- **Code de vérification Google** — `input` texte en `data` (`font-mono`), « Facultatif ». Aide :
  « Google vous le donne quand vous déclarez le site dans la Search Console : c'est la suite de
  lettres et de chiffres après `content=`. Collez-la ici. » Si le bureau colle la balise entière
  (`<meta name="google-site-verification" content="…">`), **le code en est extrait** et le dire :
  « Nous avons gardé le code seul : AbC1…xYz. » _(Proposition, à confirmer au plan.)_
- Bouton de la page existant, `default` « Enregistrer les réglages » : **ne pas en ajouter un**.
- **States** : **vides** (les deux, avec la phrase de repli) · **remplis** · **compteur dépassé**
  (« 12 caractères de trop. », `--destructive-text` 600, bordure 2 px) · **code invalide**
  (caractères interdits : « Ce code ne ressemble pas à celui de Google : il ne contient que des
  lettres, des chiffres, des tirets et des soulignés. ») · **enregistré** (`alert` neutre
  `CircleCheck`, comme aujourd'hui).
- **Mobile (390 px)** : une colonne, champs 56 px.

### 2 · Éditeur de page — section « Référencement et partage »

Dans le **panneau « Paramètres »** de l'éditeur de page (296 px), **sous** Titre et Adresse, séparée
par un `separator` et un `h3` « Référencement et partage ». Même section, en version réduite, dans
l'**éditeur d'actualité** (sous le contenu).

- **Champs de la page** (tous « Facultatif ») :
  1. **Titre dans les moteurs de recherche** — `input`, compteur (plafond **60**). Vide : « Vide :
     le titre de la page, « Qualité de l'eau », sera utilisé. »
  2. **Description** — `textarea` 3 lignes, compteur (plafond **160**). Vide : « Vide : la
     description de l'association sera utilisée. » — et si l'association n'en a pas non plus :
     « Vide, comme la description de l'association : Google choisira un extrait de la page. » + lien
     « Renseigner la description de l'association » (→ Réglages).
  3. **Image de partage** — `file-upload` (PNG, JPEG ou WebP, 5 Mo au plus, consignes écrites avant
     l'échec) + **texte alternatif** obligatoire si une image est déposée. Vide : « Vide : le logo de
     l'association sera montré. » _(Proposition — ce champ est le plus coûteux de la story : à
     confirmer au plan. Le dessiner, l'annoter.)_
- **Aperçu « Dans Google »** sous les champs : un encadré `muted`, **sans logo de Google ni couleur
  de marque**, qui montre ce qui s'affichera : la ligne d'adresse (`lesamisdeletang.fr › qualite-de-l-eau`
  en `meta`), le titre en `link` 20 px, la description en `body` sur deux lignes. Il suit la saisie
  et montre la **valeur de repli** quand un champ est vide. _(Proposition : le rendre utile sans
  l'imiter ; annoter.)_
- **Actualité** : titre et image **viennent déjà de l'actualité** (titre, image et son texte
  alternatif). La section ne contient qu'une **Description** (compteur 160 ; vide : « Vide : le début
  du texte de l'actualité sera utilisé. ») et l'aperçu.
- **States** : **tout vide** (les replis écrits) · **rempli** · **compteur dépassé** · **image
  déposée** (aperçu + « Remplacer l'image » / « Retirer l'image ») · **image sans texte
  alternatif** à la publication : refus ancré dans la `PreviewBar` (comme pour un bloc image, « Rien
  n'est perdu »).
- **Mobile (390 px)** : la section vit dans le `sheet` « Paramètres de la page », en bas.

### 3 · Carte de partage — ce qu'on voit quand le lien est partagé

Le design system signale ce manque (§9, « Image de partage social ») et le rattache à s11 : **quel
gabarit, quelles dimensions, que met-on quand l'association n'a pas d'image ?**

- **Montrer trois cas**, dans une carte de messagerie **neutre** (ni WhatsApp ni Facebook imités :
  un cadre `card`, l'image au format 1,91:1, puis le titre, la description et le domaine) :
  1. page avec **image de partage** déposée ;
  2. page **sans image**, association **avec logo** ;
  3. page **sans image**, association **sans logo** (monogramme).
- **Proposition de gabarit de repli, 1200 × 630** : fond `accent` de la teinte de l'association, le
  logo (ou le monogramme `<AssociationMark />` agrandi) centré, **le nom écrit** en Source Serif 4
  600 en `accent-foreground` dessous. Rien d'autre : pas de slogan, pas de photo générique. Les deux
  couleurs viennent **des six teintes précalculées** (hex du §1.2, l'image n'est pas une page web) :
  pour 195, fond `#E8F5F8`, texte `#185A66`. Le montrer pour deux teintes (eau 195, tuile 40 :
  `#F8EDE6` / `#5E3421`) pour prouver que le gabarit tient.
- Pas de version sombre pour cette image : elle est affichée par l'application de l'autre personne.

## Design system constraints (non-negotiable)

**Tokens — deux thèmes, clair et sombre (ADR 012).** Le back-office reprend les tokens du public ;
seule la `sidebar` a sa propre palette.

**Clair** (`:root`) :

```
--background: oklch(1 0 0)                 --foreground: oklch(0.22 0.015 250)
--card: oklch(1 0 0)                       --muted: oklch(0.972 0.005 240)
--muted-foreground: oklch(0.45 0.02 245)   --border: oklch(0.9 0.008 245)
--input: oklch(0.66 0.014 245)             --ring: oklch(0.55 0.11 235)
--primary: oklch(0.35 0.06 240)            --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.965 0.006 240)        --secondary-foreground: oklch(0.3 0.02 245)
--destructive: oklch(0.48 0.17 27)         --destructive-foreground: oklch(0.99 0.01 27)
--destructive-text: oklch(0.48 0.17 27)    --link: oklch(0.45 0.13 250)
--accent-hue: 195 (démo « eau » ; teinte réelle injectée par association, six teintes possibles)
--accent: oklch(0.958 0.024 195)           --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)        --accent-border: oklch(0.88 0.045 195)
--overlay: oklch(0.22 0.015 250 / 0.5)
--sidebar: oklch(0.985 0.004 250)          --sidebar-foreground: oklch(0.26 0.015 250)
--sidebar-accent: oklch(0.93 0.012 245)    --sidebar-border: oklch(0.91 0.008 245)
--radius: 0.5rem (rounded-md 8px champs/boutons/cartes, rounded-lg 12px dialogues/feuilles)
PreviewBar : fond oklch(0.24 0.02 250), hors palette de contenu
```

**Sombre** (`.dark`) :

```
--background: oklch(0.215 0.009 255)       --foreground: oklch(0.94 0.006 250)
--card: oklch(0.215 0.009 255)             --muted: oklch(0.255 0.009 250)
--muted-foreground: oklch(0.72 0.015 248)  --border: oklch(0.33 0.01 250)
--input: oklch(0.52 0.016 250)             --ring: oklch(0.7 0.12 235)
--primary: oklch(0.5 0.14 255)             --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.27 0.01 250)          --secondary-foreground: oklch(0.9 0.008 250)
--destructive: oklch(0.58 0.19 27)         --destructive-text: oklch(0.68 0.17 27)
--link: oklch(0.8 0.1 250)
--accent: oklch(0.275 0.035 195)           --accent-foreground: oklch(0.84 0.075 195)
--accent-solid: oklch(0.64 0.11 195)       --accent-border: oklch(0.4 0.055 195)
--overlay: oklch(0.1 0.01 255 / 0.7)
--sidebar: oklch(0.19 0.009 255)           --sidebar-foreground: oklch(0.93 0.006 250)
--sidebar-accent: oklch(0.3 0.014 250)
```

**Six teintes précalculées** (pour l'image de partage, qui n'est pas une page web) — aplat /
surface / encre : eau 195 `#17849B` `#E8F5F8` `#185A66` · pins 150 `#2E7D52` `#E7F5EC` `#1E4A31` ·
lac 255 `#3A6FB0` `#EAF1FA` `#23445F` · tuile 40 `#A8623A` `#F8EDE6` `#5E3421` · bruyère 300
`#7A5AA8` `#F1ECF9` `#3F2E5C` · genêt 95 `#7C7326` `#F4F2E2` `#423D14`.

**Typographie** : **Source Serif 4** — `h1` 34 px / 600, `h2` 26 px / 600. **Public Sans** — `h3`
20 px / 600, `body` 17 px, `body-strong` 17 px / 600, `label` 16 px / 500, `button` 16-17 px / 600,
`meta` 15 px. **JetBrains Mono** — `data` (codes, `tabular-nums`). Texte courant jamais sous 17 px ·
libellés toujours visibles · **jamais de placeholder en guise de libellé, jamais d'astérisque** ·
typographie française.

**Espacement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, rien d'autre. Éditeur : colonne de blocs +
panneau 296 px → `sheet` sous `xl`. Ruptures `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

**Cibles, focus** : 44 × 44 minimum, 56 px en mobile · anneau `2px solid var(--ring)`, décalé de
2 px · aucune action au survol seul.

**Icônes lucide** : 16 / 20 / 24 px, trait 1,75, `currentColor`, icône + libellé. `CircleCheck` =
succès ancré. **Aucune icône « moteur de recherche » ni logo de réseau social** au vocabulaire : ne
pas en ajouter.

**Composants à réutiliser tels quels** : `input`, `textarea`, `label` (libellé au-dessus, 48 px /
56 mobile, validation au _blur_) · **compteur de caractères** (`meta` à droite sous le champ,
`muted-foreground` jusqu'au plafond inclus, au dépassement seulement `--destructive-text` 600 +
bordure 2 px + message écrit) · `file-upload` (zone de dépôt **et** bouton « Choisir un fichier »,
types et poids annoncés avant l'échec, pas de zone de dépôt au tactile) · `card` sans ombre ·
`separator` · `alert` ancré (succès **neutre**, `CircleCheck` en `primary`, **pas de vert**) ·
`<PreviewBar />` (erreur de publication en 2ᵉ ligne de la barre, jamais en toast) ·
`<AssociationMark />` pour toute identité de l'association · `button` : **un seul `default` par
écran**, le reste en `outline`.

**Do / Don't** : ✅ dire au bureau **ce qui s'affichera et où**, avec ses mots · ✅ un champ vide dit
sa valeur de repli · ❌ jargon à l'écran : « SEO », « meta », « Open Graph », « balise », « sitemap »,
« indexation » (le mot « Search Console » est toléré dans l'aide, c'est le nom que Google donne à
l'outil) · ❌ score, jauge verte/orange/rouge, conseils automatiques · ❌ imiter l'interface de Google,
Facebook ou WhatsApp (logos, couleurs de marque) · ❌ accent sur un bouton · ❌ information
importante dans un tooltip.

Ne pas inventer de composant, de token ni de couleur hors de cette liste. Un besoin non couvert se
**signale** en marge.

## Écarts connus au design system (à signaler dans la maquette, pas à combler)

1. **Pas de type « texte libre » dans le registre des réglages** (§3.1 : email, nombre, booléen,
   choix). La description (`textarea` + compteur) et le code Google (`input` en `data`) en ajoutent
   deux rendus : les annoter comme **extension de la table §3.1**.
2. **Image de partage social** (§9, rattaché à s11) : l'écran 3 est la proposition de gabarit à
   verser au design system.
3. **Aperçu « Dans Google »** : aucun composant ne le couvre. Proposition de l'écran 2, à annoter.
4. **Icônes d'application par association** (§9, rattaché à s11) et **page 404** (§9, rattachée à
   s11) : **hors critères de la story**, ne pas les dessiner — les signaler en marge comme restant
   ouverts.

## Points laissés au plan — à ne pas trancher dans la maquette

- Quelles pages entrent dans le sitemap (pages CMS, actualités, pages fixes), et le sort du blog
  hérité et de `/pricing` : **aucun écran**.
- Les routes exclues par `robots.txt` : **aucun écran**.
- Les métadonnées des pages à adresse fixe (Actualités, Analyses d'eau, Le bureau, Contact), qui
  n'ont pas d'éditeur : repli sur l'association, **aucun écran nouveau**.
- L'extraction du code depuis une balise collée entière, et le stockage de l'image de partage.

## Out of scope

- **Écran de supervision du référencement** (état de l'indexation, pages trouvées par Google,
  statistiques de visite) : aucun critère.
- **Réglages par page du sitemap** (priorité, fréquence), **exclusion d'une page publiée** de
  l'indexation : aucun critère.
- **Page 404, icônes d'application** : voir Écarts n° 4.
- **L'éditeur de page lui-même** (blocs, `PreviewBar`, publication) : déjà livré, seule la section
  nouvelle du panneau est à dessiner.
- **Le rendu public des pages** : aucune modification visible, les métadonnées ne s'affichent pas
  dans la page.

## Expected output

Un mockup HTML statique des écrans 1 à 3, basse fidélité acceptée :

- en **desktop et en mobile 390 px** pour les écrans 1 et 2 (l'écran 3 est une image : montrer la
  carte de partage à 390 px de large, et le gabarit 1200 × 630 réduit) ;
- en **clair et en sombre**, avec une bascule (ADR 012) pour les écrans 1 et 2 ;
- avec **tous les états listés** ;
- en utilisant **exclusivement** les tokens et composants ci-dessus ;
- une section ancrée par écran, les écarts annotés en marge.

Il sera enregistré comme `docs/designs/s11-seo.html`.
