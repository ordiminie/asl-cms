# Design Brief — Story s24-notes-internes-membre

> Brief à coller dans Claude Design. Il est autonome : story, écrans, contraintes, livrable.
> **Chaque écran en deux versions : bureau (desktop, 1 280 px) et mobile (390 px)**, même contenu et
> mêmes états. **Thème clair seul** : le produit n'a plus de mode sombre (ADR 033, qui remplace
> l'ADR 012 ; `docs/design-system.md` §10 : « une livraison de conception ne fournit plus de jeu
> sombre »). Ne produisez donc **aucune** version sombre.

## Story

**En tant que** membre du bureau **je veux** consigner des notes et l'historique des échanges sur un
propriétaire **afin que** le suivi survive au renouvellement du bureau.

Critères d'acceptation :

1. Le bureau ajoute une note **datée et signée** sur la fiche d'un propriétaire, et la retrouve à la
   consultation suivante.
2. Le bureau consigne un **échange** avec un propriétaire : date, canal (téléphone, courrier, en
   personne, email) et résumé libre.
3. La fiche affiche notes et échanges dans **un fil chronologique unique**, chaque entrée portant son
   auteur, sa date et son type.
4. Un propriétaire n'a **aucun** accès à ces notes, ni les siennes ni celles d'un autre (aucun écran
   côté espace membre : voir « Hors périmètre »).
5. Une note peut être **modifiée ou supprimée** par le bureau ; **l'auteur et la date de dernière
   modification restent visibles**.

**Précisions de produit** (à respecter, pas à rediscuter) :

- Un « échange » est **une saisie manuelle** : un bénévole note qu'il a appelé M. X le 12 mars et ce
  qui s'est dit. Rien n'est alimenté automatiquement depuis les signalements, questions ou campagnes.
- Ce sont des notes sur des personnes, écrites par des bénévoles : le texte est **brut** (retours à
  la ligne conservés, aucun gras, lien ou titre interprété).
- **Vocabulaire** : le back-office dit « **propriétaire** » (liste « Propriétaires », route
  `/bureau/proprietaires`), pas « membre ».

## Ce qui existe déjà (à ne pas redessiner)

La **fiche d'un propriétaire** (`/bureau/proprietaires/{id}`, s12, s12d, s14) : `breadcrumb`
« Propriétaires › {nom} », `h1` = le nom (Source Serif 4, 34 px), badges d'état dessous, puis quatre
`card` empilées sur une colonne, titre de carte en `h2` serif 24 px : **Coordonnées** (paires libellé /
valeur, « Modifier les coordonnées » ouvre les champs **en place**, boutons « Enregistrer les
coordonnées » / « Annuler »), **Accès à l'espace membre** (une phrase), **Rôle dans l'association**,
**Parcelles** (actuelles, anciennes). Les messages après enregistrement sont des `alert` neutres
ancrés sous le titre (« Coordonnées enregistrées. »). Le back-office a sa barre latérale de 248 px
(tiroir sous 1 024 px). **Ces cartes ne bougent pas.**

## Écran à produire

Un seul écran : la fiche d'un propriétaire, avec **une cinquième `card` « Notes et échanges »**,
placée **après « Parcelles »** (c'est la dernière : le fil peut devenir long). Représentez la fiche
entière pour situer la carte, mais détaillez seulement la nouvelle carte ; les quatre autres peuvent
être schématiques.

### La carte « Notes et échanges »

- **But** : retrouver en un coup d'œil ce que le bureau sait de ce propriétaire, et ajouter une note
  ou un échange sans quitter la fiche.
- **En-tête de carte** : titre « Notes et échanges » (`h2`). Dessous, une **phrase écrite**, en
  `meta` / `muted-foreground` : « Visible du bureau seulement. Le propriétaire ne les voit pas. »
  (aucune icône : voir « Manques » n° 1).
- **Deux actions, côte à côte** (en colonne pleine largeur, 56 px, sur mobile), toutes deux en
  `outline` (la fiche n'a pas d'action `default` à elle) : **« Ajouter une note »** et
  **« Consigner un échange »**.
- **Formulaire d'ajout, en place**, qui s'ouvre **en tête de carte, au-dessus du fil**, à l'image de
  « Modifier les coordonnées » (pas de `dialog` : l'échange compte trois champs, la limite d'un
  `dialog` est de deux). Une seule forme ouverte à la fois.
  - **Note** — un champ : **Note** (`textarea`, 4 lignes, libellé « Note », compteur de caractères en
    dessous). Boutons : **« Enregistrer la note »** (`default`) / « Annuler » (`outline`).
  - **Échange** — trois champs, une colonne :
    1. **Date de l'échange** — champ date (§3.9), **pré-rempli à aujourd'hui** ; une date passée est
       normale (« appelé le 12 mars »), une date **future est refusée** (« Cette date n'est pas
       encore arrivée. »).
    2. **Canal** — `select`, quatre options : **Téléphone**, **Courrier**, **En personne**, **Email**.
       Aucune présélection : le libellé de départ est « Choisissez un canal ».
    3. **Résumé** — `textarea`, 4 lignes, compteur de caractères.
    Boutons : **« Enregistrer l'échange »** (`default`) / « Annuler ».
  - Le plafond de caractères n'est pas arrêté : montrez le compteur avec une valeur **illustrative**
    de 2 000 (« 0 / 2 000 »), la valeur définitive sera fixée au plan.
- **Le fil** — **une seule liste**, notes et échanges mêlés, **la plus récente en premier** (voir
  « Manques » n° 2). Chaque entrée est un bloc séparé du suivant par un filet `border` 1 px, sans
  ombre ni carte imbriquée, avec :
  - une ligne d'identité : **badge de type** — **« Note »** (`outline`) ou **« Échange »**
    (`secondary`) suivi, pour un échange, du **canal écrit** (« Échange · Téléphone ») — puis la date en
    `data` : `jj/mm/aaaa` pour un échange (le jour choisi), `jj/mm/aaaa hh:mm` pour une note (le
    moment de la saisie), `tabular-nums`, `muted-foreground` ;
  - le **texte** de l'entrée, en `body` 17 px, retours à la ligne conservés ;
  - une ligne de signature en `meta` : **« Écrit par Marie Delorme »** (phrase écrite, jamais un
    avatar seul) ;
  - **si l'entrée a été modifiée** : à la suite, « · Modifiée le 04/11/2026 à 14:32 » (la date de
    dernière modification, `data`) ; une entrée jamais modifiée n'a pas cette mention ;
  - deux actions écrites, en `link` sous le texte : **« Modifier »** et **« Supprimer »**, chacune
    avec sa cible tactile de 44 × 44 minimum (56 px sur mobile), **sans icône** (voir « Manques » n° 3).
    Le mot porte le type : l'accessible name est « Modifier la note du 12/03/2026 ».
- **Modifier** : le bloc de l'entrée **se transforme en place** en formulaire pré-rempli (mêmes
  champs, mêmes compteurs ; pour un échange, la date et le canal sont modifiables). Boutons
  **« Enregistrer les modifications »** (`default`) / « Annuler ». Une seule entrée en modification à
  la fois.
- **Supprimer** : `alert-dialog` (l'acte est irréversible), titre « Supprimer cette note ? » (ou
  « Supprimer cet échange ? »), un rappel de ce qui disparaît — « Note écrite par Marie Delorme le
  12/03/2026. Elle sera effacée de la fiche. » —, boutons **« Supprimer la note »** (`destructive`,
  nomme l'acte) / « Garder la note » (`outline`). Pas de croix ; Échap ferme.
- **Pagination du fil** : « Précédent / Suivant » écrits, jamais de défilement infini, « Page 1 sur 3 »
  en `meta`. Montrez-la sur l'état « fil long » seulement (10 entrées par page sur la maquette,
  chiffre indicatif, fixé au plan).

### États à dessiner (desktop **et** mobile chacun)

- **a · Fil rempli** — quatre entrées de la même fiche : deux notes (dont une **modifiée**), deux
  échanges (téléphone, en personne), du plus récent au plus ancien ; les deux boutons d'ajout en tête.
- **b · Vide** — « Aucune note ni échange pour l'instant. » suivi de l'action pour le combler :
  « Ajouter la première note » (lien ou `outline`) ; les deux boutons d'ajout restent là.
- **c · Chargement** — `skeleton` sur trois entrées du fil (jamais sur un formulaire) ; titre et
  boutons déjà présents.
- **d · Ajouter une note, vierge** — formulaire ouvert, compteur « 0 / 2 000 ».
- **e · Consigner un échange, vierge** — date pré-remplie à aujourd'hui, canal « Choisissez un
  canal », résumé vide.
- **f · Erreurs de saisie** — résumé ancré `destructive` en tête du formulaire (bordure 2 px,
  `role="alert"`, titre en 700, liens d'ancrage) : « 2 champs à corriger. Rien n'a été enregistré. »
  — canal non choisi, date future (« Cette date n'est pas encore arrivée. »), résumé vide (« Écrivez le
  résumé de l'échange. ») ; chaque champ fautif en bordure 2 px + message en dessous.
- **g · Compteur dépassé** — « 17 caractères de trop. » : bordure 2 px, `--destructive-text`, graisse
  600 ; jusqu'au plafond inclus, le compteur reste neutre (§3.9).
- **h · Succès** — `alert` neutre ancré en tête de carte, `CircleCheck` en `primary` :
  « Note enregistrée. Elle apparaît en tête du fil. » / « Échange enregistré. » / « Note modifiée. » /
  « Note supprimée. » (quatre phrases, une seule à montrer à la fois).
- **i · Modification d'une entrée** — le bloc en formulaire pré-rempli, avec la mention « Modifiée
  le … » de l'entrée **telle qu'elle est avant** l'enregistrement.
- **j · Confirmation de suppression** — l'`alert-dialog`, voile `--overlay`.
- **k · Échec d'enregistrement ou de suppression** — `alert` `destructive` ancré, **ce qui s'est
  passé, ce qui est perdu, l'action suivante** : « La note n'a pas pu être enregistrée. Ce que vous
  avez écrit est conservé dans le formulaire. Réessayez dans un instant. »
- **l · Fil long** — dix entrées et la pagination (desktop seulement, plus une carte mobile).
- **m · Mobile** (390 px) — les états a, d, e, i et j : boutons d'ajout empilés pleine largeur 56 px,
  formulaire en pleine largeur, boutons 56 px **empilés, le principal en premier** ; l'`alert-dialog`
  ancré en bas, pleine largeur, boutons 56 px empilés.

## Contraintes du design system (non négociables)

### Jetons — thème clair seul

```
--background: oklch(1 0 0);                 --foreground: oklch(0.22 0.015 250);
--card: oklch(1 0 0);                       --card-foreground: oklch(0.22 0.015 250);
--muted: oklch(0.972 0.005 240);            --muted-foreground: oklch(0.45 0.02 245);
--border: oklch(0.9 0.008 245);             --input: oklch(0.66 0.014 245);   /* contour de champ, 3:1 */
--ring: oklch(0.55 0.11 235);
--primary: oklch(0.35 0.06 240);            --primary-foreground: oklch(0.985 0.003 240);
--secondary: oklch(0.965 0.006 240);        --secondary-foreground: oklch(0.3 0.02 245);
--destructive: oklch(0.48 0.17 27);         --destructive-foreground: oklch(0.99 0.01 27);
--destructive-text: oklch(0.48 0.17 27);    /* texte d'erreur */
--link: oklch(0.45 0.13 250);               /* toujours souligné */
--warning: oklch(0.94 0.06 75);             --warning-border: oklch(0.6 0.13 65);
--warning-foreground: oklch(0.3 0.08 60);
--accent-hue: 195;  --accent: oklch(0.958 0.024 195);  --accent-foreground: oklch(0.38 0.08 195);
--accent-solid: oklch(0.55 0.1 195);        --accent-border: oklch(0.88 0.045 195);
--overlay: oklch(0.22 0.015 250 / 0.5);     /* voile du dialog et de l'alert-dialog */
--sidebar: oklch(0.985 0.004 250);          --sidebar-accent: oklch(0.93 0.012 245);
--sidebar-border: oklch(0.91 0.008 245);
--radius: 0.5rem;
```

**Accent de l'association** : identité seulement (logo, filet de navigation active, encarts). **Jamais
sur un bouton, jamais comme seul porteur d'un statut.** `primary` pour toute action, toute sélection,
toute icône fonctionnelle. Survols de menus et de lignes en `secondary`, jamais en accent.

### Typographie

- **Source Serif 4** (titres) : `h1` 34 px / 600 / 1.15 ; `h2` de carte du back-office 24 px / 600.
- **Public Sans** (interface) : `body` 17 px / 400 / 1.6 (valeurs de champ, texte du fil) ;
  `body-strong` 17 px / 600 ; `label` 16 px / 500 (libellés, toujours visibles) ; `button` 16-17 px /
  600 ; `meta` 15 px / 400 (date, signature, compteur) — plancher absolu 15 px.
- **JetBrains Mono** : `data` 15-17 px, `tabular-nums` — dates, heures.
- Pas de graisse 300, pas d'italique porteur d'information, pas de capitales au-delà de trois mots.
  Typographie française : espace insécable avant `: ; ! ?`, guillemets « », apostrophe courbe.

### Espacement, rayon, bordures, ombres

- Échelle : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px. **Toute mesure hors échelle est un bug.**
- Rayon : 4 px puces ; **8 px champs, boutons, cartes** ; 12 px dialogues.
- Bordures : 1 px `border` séparation ; 1 px `input` champ ; **2 px `primary` sélection ; 2 px
  `destructive` erreur** (épaisseur unique de « quelque chose ne va pas »).
- Ombres : **aucune** sur cartes et blocs de contenu (la bordure suffit) ; `shadow-lg` seulement sur
  dialogues. Transitions ≤ 120 ms. Pas de dégradé, pas de verre dépoli, pas d'animation d'apparition.
- Focus : `outline: 2px solid var(--ring); outline-offset: 2px`, jamais retiré. Cibles ≥ 44 × 44 ;
  **56 px pour les actions principales sur mobile**. Aucune action au survol seul.
- Points de rupture : `sm` 640 · `md` 768 · `lg` 1024 (barre latérale 248 px → tiroir sous `lg`) ·
  `xl` 1280. Marges 16 px sous 1 024 px.

### Composants à réutiliser (rien d'autre)

- **`card`** — bordure 1 px, sans ombre, `gap` 20 px, padding 24 px (16 px mobile), `h2` serif.
- **`button`** — `default` 48 px (56 mobile), `outline`, `destructive`. **Un seul `default` par
  écran**, les autres en `outline`. Libellés à l'infinitif explicite, jamais « OK ». Chargement :
  libellé remplacé, bouton désactivé, **largeur conservée**.
- **`form` `label` `input` `textarea` `select`** — une colonne, un champ par ligne, libellé au-dessus,
  champs 48 px (56 mobile), texte 17 px, « Facultatif » écrit (aucun champ facultatif ici), **jamais
  d'astérisque, jamais de placeholder en guise de libellé**. Validation au _blur_ puis à la soumission.
  `select` au-delà de 3 options (ici 4). `textarea` + **compteur** (§3.9) : `meta` aligné à droite,
  neutre jusqu'au plafond inclus, rouge seulement au dépassement et avec un message écrit.
- **Champ date** (§3.9) — clavier seul, **pas de calendrier**, `jj/mm/aaaa`, `inputmode="numeric"`,
  barres insérées à la frappe, JetBrains Mono 500, icône `Calendar` 20 px **décorative**
  (`muted-foreground`, jamais un bouton), 48 px (56 sous 1 024 px), quatre états (vide, pré-rempli, en
  saisie `--ring` + halo 2 px, erreur).
- **`badge`** — statut / type, jamais une action. Deux badges sur une ligne : `gap` 8 px.
- **`alert`** — **succès** : `alert` neutre avec `CircleCheck` en `primary` (il n'y a pas de token
  « succès », pas de vert) ; **erreur** : `destructive`, bordure 2 px, `role="alert"`, ancré dans la
  page, ne disparaît pas seul ; **avertissement** : trio `warning`. **Rien d'important dans un toast.**
- **`alert-dialog`** — uniquement pour l'irréversible, le bouton nomme l'acte.
- **`skeleton`** — listes, jamais un formulaire. **`pagination`** — « Précédent / Suivant » écrits.
- **`breadcrumb`**, **`separator`**.
- **Icônes lucide** (16 / 20 / 24, trait 1,75, `currentColor`) : `CircleCheck`, `AlertTriangle`,
  `Calendar` (décorative). **Jamais d'icône seule comme action** ; on n'en ajoute pas d'autre.

### Patrons déjà arrêtés qu'il faut suivre

- **Historique d'un objet** (§3.10) : date et heure en `data`, puis **une phrase écrite** qui dit
  l'acteur ; le premier événement venu du site se lit « depuis le site » (non utilisé ici).
- **Erreurs** (§3.1, §3.9) : bordure 2 px + message sous le champ **+** résumé ancré en tête de
  formulaire avec liens d'ancrage ; message de champ en 16 px / 500, `--destructive-text`.
- **États** (§3.2) : le vide dit ce qui manque **et** l'action pour le combler ; l'erreur dit ce qui
  s'est passé, **ce qui est perdu**, l'action suivante.
- **Mobile** : un `dialog`/`alert-dialog` s'ancre en bas, pleine largeur, boutons 56 px empilés, le
  principal en premier ; « Annuler » est écrit, pas de croix.
- **Langue** : vouvoiement, phrases courtes, aucun jargon. Dates `02/09/2026` en champ et en liste.

### À ne pas faire

- ❌ Inventer un composant, un jeton, une couleur, une taille hors de ceux-ci.
- ❌ Une couleur seule pour porter une information (type d'entrée, erreur) : **le mot porte
  l'information**.
- ❌ Un `tabs`, une `sidebar` ou un menu d'icônes en bout de ligne ; un `collapsible` ou un `tooltip`
  pour cacher une information utile ; un défilement infini.
- ❌ Texte courant sous 17 px ; astérisque pour l'obligatoire ; calendrier déroulant.
- ❌ Un toast pour une confirmation qui compte.
- ❌ Un jeu sombre.

Ne pas inventer de composants, de jetons ou de couleurs hors de ceux-ci.

## Hors périmètre

- **Tout écran côté espace membre.** Un propriétaire ne voit jamais ces notes : il n'y a ni page, ni
  carte, ni message « accès refusé » à dessiner pour elles.
- La liste des propriétaires (pas d'indicateur « a des notes »), la création et l'édition de la fiche,
  les quatre autres cartes de la fiche.
- Un **fil alimenté automatiquement** (signalements, questions, campagnes) : exclu de la story.
- Un **historique des versions** d'une note, une corbeille, une restauration.
- L'**export** des notes (export d'association, copie du propriétaire) : autres stories.
- Pièces jointes, mentions, étiquettes, recherche dans les notes, filtres par type ou par canal.
- La session « à la place d'un compte » : aucune variante d'affichage de l'auteur.

## Livrable attendu

Une maquette HTML statique de l'écran (basse fidélité acceptée), **version bureau (1 280 px) et version
mobile (390 px)**, thème clair, avec les états a à m, n'utilisant que les jetons ci-dessus. Rapportez
l'export : il sera enregistré en `docs/designs/s24-notes-internes-membre.html`.

**Signalez en marge de la maquette (« ÉCART », « PROPOSITION », « NOTE », « AU PLAN ») tout besoin que
le design system ne couvre pas, sans le combler.** Trois sont déjà connus et à confirmer :

1. **Marqueur « interne au bureau »** — §3.4 réserve `Lock` + « Espace personnel » aux données du
   membre connecté. Le brief le remplace ici par une phrase écrite sans icône ; confirmez ou proposez
   mieux avec l'existant.
2. **Ordre du fil** — §3.10 range un historique **du plus ancien au plus récent** ; ici le brief
   demande le **plus récent en premier** (on rouvre une fiche pour lire le dernier échange). Écart
   assumé, à valider.
3. **Deux actions par entrée (« Modifier », « Supprimer »)** — la règle de tableau dit « une seule
   action par ligne », mais ce fil n'est pas un tableau. Les deux sont des liens écrits sans icône ;
   le design system ne fixe ni icône « modifier » ni « supprimer ».
