# Design — Story s06-presentation-bureau

> Conçu le 2026-09-23 par le chemin **Claude Design**, à partir du brief
> `docs/designs/s06-presentation-bureau-brief.md`.
>
> - **Export du canevas** : `docs/designs/s06-presentation-bureau.zip`, remis par Marie-Ève le
>   2026-09-23. **L'URL du canevas n'a pas été transmise.**
> - **Reporté ici le même jour**, puis normalisé en `docs/designs/s06-presentation-bureau.html`.
> - **Source visuelle unique** : `docs/design-system.md`.
> - **Contexte de code** : `docs/research/s06-presentation-bureau.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                                | Où                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1       | Le bureau crée, modifie, réordonne et supprime des fiches (nom, rôle, photo, biographie courte) | **Écran 2** (créer / modifier) + **Écran 1** (réordonner « Monter / Descendre », supprimer par `alert-dialog`)           |
| 2       | Page publique dans l'ordre défini par le bureau, photo redimensionnée et texte alternatif       | **Écran 3** (liste ordonnée, photo carrée 128 / 96 px) ; l'alternative est **déduite du nom**, dite en clair à l'écran 2 |
| 3       | Retirer une fiche la fait disparaître du public ; les restantes se renumérotent sans trou       | **Écran 1** (dialogue, puis `alert` « renumérotées de 1 à 4 » et liste à 4 lignes) → **Écran 3**                         |
| 4       | Une fiche sans photo affiche un visuel de repli, pas une image cassée                           | **Écrans 1, 2 et 3** (Jean-Pierre Vasseur → **JV**), règle annotée É1                                                    |

## Screen(s)

### Repère de continuité — barre latérale du back-office

La barre latérale existante (248 px, tiroir `sheet` sous `lg`) gagne **une seule entrée** :
« Membres du bureau », dans le groupe **« Le site »**, **après « Navigation »**, active sur l'écran 1
(fond `sidebar-accent`, libellé en 600). Son icône est un **emplacement neutre en pointillé** : le
vocabulaire figé n'en désigne aucune (annotation É6). Le reste de la barre est inchangé.

Contrairement à s05, ce repère **n'a pas de section ancrée à lui** : il est dessiné à l'intérieur de
l'écran 1 (voir « Écarts de la maquette au brief », point 1).

### Écran 1 — Bureau : Membres du bureau (`/bureau/le-bureau`)

`h1` « Membres du bureau » et, à droite, le **seul bouton `default` de l'écran** : « Ajouter un membre
du bureau ». Dessous, deux lignes `meta` en lecture seule :

- « 412 membres affichés en tête de la page publique — modifiable dans **L'association › Réglages** »
  (lien souligné) ;
- « Page publique : **/le-bureau** » avec « Voir la page » (`outline`, icône `SquareArrowOutUpRight`,
  nouvel onglet, ouverture annoncée en texte masqué).

Puis une `card` pleine largeur portant **`<SortableList />` repris tel quel**. Chaque ligne
(72 px minimum) enchaîne : poignée `GripVertical` (zone de 44 px sur toute la hauteur, `cursor: grab`,
`aria-label` « Déplacer …, position 2 sur 5. Espace pour saisir. ») · **pastille de rang écrite**
« 2 sur 5 » en `tabular-nums` · **photo 56 px** `rounded-md` — ou les **initiales** · **nom** en
`body-strong` · **rôle** en `meta` dessous · puis quatre boutons `outline` de 44 px, tous à
icône + libellé ou libellé seul, **jamais révélés au survol** : « Monter », « Descendre »,
« Modifier », « Supprimer ».

Pas de pagination, pas de recherche, pas de filtre : un bureau compte 3 à 9 personnes.

Mobile 390 px : chaque ligne devient une **carte empilée** (photo 56 px + nom, puis `<dl>`
Rôle / Rang, puis « Monter » et « Descendre » côte à côte à 44 px, puis « Modifier » et « Supprimer »
en pleine largeur 56 px). « Ajouter un membre du bureau » passe en tête, pleine largeur, 56 px.
**Aucun glisser-déposer n'est requis nulle part.**

### Écran 2 — Bureau : créer / modifier une fiche (`/bureau/le-bureau/nouveau`, `…/:id`)

Formulaire **à une colonne**, `max-w-[68ch]`, précédé de « ← Membres du bureau ». `h1` contextuel
(« Nouveau membre du bureau » / « Modifier la fiche de Claire Besson ») et, sous le titre, la ligne
`meta` « Cette fiche est visible sur /le-bureau dès son enregistrement. » — **ni `<PreviewBar />`, ni
statut, ni « Publier »** : il n'y a pas de brouillon.

Quatre champs, libellés au-dessus, **aucun astérisque**, 48 px (56 px en mobile) :

1. **Nom** — `input`, obligatoire, aide « Le nom affiché sur la page publique, tel qu'il doit se lire. »
2. **Rôle dans le bureau** — `input` **texte libre**, obligatoire, aide « Par exemple : Présidente,
   Trésorier, Secrétaire adjointe, référent voirie. » Aucun `select`.
3. **Photo (facultatif)** — consignes écrites **avant** tout échec (« PNG, JPEG ou WebP, carré de
   préférence, 400 px de côté au moins. »), zone de dépôt **et** bouton « Choisir un fichier ». Une
   fois la photo présente : aperçu carré 128 px, « Remplacer la photo » / « Retirer la photo » en
   `outline`, puis la ligne `meta` « Texte alternatif : « Portrait de Claire Besson » — généré à
   partir du nom, il n'y a rien à saisir. » **Aucun champ de texte alternatif.**
4. **Biographie (facultatif)** — `textarea` de 6 lignes, **texte brut**, aide écrite avant
   (« Quelques phrases de présentation. 500 caractères au plus. ») et compteur discret en `meta`
   aligné à droite (« 193 / 500 »). Pas de barre de mise en forme.

En pied : « Enregistrer la fiche » (`default`, 216 px de large au minimum) et « Annuler » (`outline`).

### Écran 3 — Site public : Le bureau (`/le-bureau`)

Corps de page seul (en-tête et pied publics figurés par un bandeau neutre). Contenu à
`max-w-[68ch]` dans un gabarit `max-w-[1200px]` :

- `h1` « Le bureau » (34 px) ;
- deux phrases en `body-lg` qui lèvent l'ambiguïté des deux « membres » : « L'association compte
  **412 membres propriétaires**. » puis « Son bureau, élu en assemblée générale, est composé des
  personnes suivantes. » ;
- une **liste verticale ordonnée** (`<ol>`), une fiche par ligne, filet `border` et 32 px entre
  fiches : **photo carrée 128 px à gauche** (ou initiales dans le même carré), **nom** en `h2` 26 px,
  **rôle** juste dessous en **18 px / 600**, **biographie** en `body-lg`. Sans biographie, la fiche
  s'arrête au rôle ;
- tout en bas, après un filet, **une seule** mention RGPD en `meta`.

Mobile 390 px : gouttière 18 px, **photo carrée de 96 px à gauche du nom**, rôle et biographie
dessous en pleine largeur (dérogation É5). La mention du bas reste unique.

## Mockup

`docs/designs/s06-presentation-bureau.html` est la **référence visuelle**, normalisée depuis l'export
Claude Design :

- **Retiré** : le runtime du canevas (`support.js`, `<x-dc>`, gabarits `{{ }}`, `sc-for` / `sc-if`,
  `<script type="text/x-dc">`, `onClick` / `style-hover`).
- **Remplacé** : les états que le canevas commutait par des **planches juxtaposées et étiquetées**
  (c'est la normalisation de s05) ; les listes par leurs données fictives ; les icônes lucide par des
  SVG en ligne ; la bascule clair / sombre par du JS natif (`data-theme` sur `#root`). Seul lien
  distant conservé : la feuille Google Fonts.
- **Vérifié** : trois sections ancrées (`#ecran-1` à `#ecran-3`), arbre HTML bien formé, aucun
  identifiant dupliqué, aucun `label for` orphelin, aucun gabarit résiduel,
  `grep -c "support.js\|unpkg\|x-dc"` → 0. Le rendu dans un navigateur n'a pas été vérifié, faute de
  bibliothèque système dans le conteneur (même limite qu'en s05).

**NE PAS copier en production** : l'Execute construit les écrans avec les vrais composants du socle
(`<SortableList />`, `button`, `form`, `input`, `textarea`, `file-upload`, `progress`, `alert`,
`alert-dialog`, `card`, `separator`, `skeleton`, `sheet`, `sidebar`). La maquette porte ses propres
styles en ligne ; ils ne remplacent ni les tokens ni les tailles du design system.

**Données fictives** : association « Les Amis de l'Étang », teinte « eau » (195), 412 membres.
Bureau de cinq personnes — Claire Besson (Présidente), Michel Arnaud (Vice-président), Sylvie Renard
(Trésorière), **Jean-Pierre Vasseur (Secrétaire, sans photo → JV)**, **Hélène Dumas (référente
qualité de l'eau, sans biographie)**. Les rangs 4 et 5 portent exprès les deux cas limites.

## Reused components (from the design system)

- **`<SortableList />`** (§2.4), repris tel quel : poignée **et** « Monter » / « Descendre » de premier
  rang, visibles en permanence. « Monter » sur la première ligne et « Descendre » sur la dernière sont
  en **`aria-disabled`** (focusables et annoncés, jamais absents). Bande d'annulation de 10 s ancrée
  sous la liste, doublée d'une annonce `aria-live="polite"` avec le rang écrit.
- **`button`** : un seul `default` par écran, le reste en `outline` ; `destructive` uniquement pour
  « Supprimer la fiche » dans le dialogue. 48 px en desktop, 56 px pour les actions principales en
  mobile, largeur conservée pendant l'enregistrement.
- **`form`, `label`, `input`, `textarea`** : une colonne, libellé au-dessus, « Facultatif » écrit.
- **`file-upload`** : zone de dépôt **et** bouton, consignes avant l'échec, pas de zone au tactile.
- **`progress`** : indéterminée, accompagnée du nom du fichier, sans pourcentage.
- **`alert`** : erreur **et** succès ancrés, jamais un toast. Succès neutre, `CircleCheck` en
  `primary`, **pas de vert**. **`alert-dialog`** : suppression seule, bouton nommant l'acte.
- **`card`** (bordure 1 px, sans ombre), **`separator`**, **`skeleton`** (listes uniquement),
  **`sheet`** (tiroir mobile), **`sidebar`** (item actif = `sidebar-accent` + libellé 600).
- **`<AssociationMark />`** : identité de l'association en tête de barre latérale — **jamais détourné
  pour une personne**.
- **Icônes** : `GripVertical` (poignée, vocabulaire figé), `ArrowUp`, `ArrowDown`,
  `SquareArrowOutUpRight`, `CircleAlert`, `CircleCheck`. Aucune icône seule comme action.

## States

**Écran 1** — sept états dessinés :

- **succès** : les 5 lignes dans l'ordre, la 4ᵉ en initiales ;
- **vide** : « Aucune fiche pour l'instant. → Ajouter le premier membre du bureau » ;
- **chargement** : `skeleton` sur les lignes (desktop et mobile) ;
- **erreur** : `alert` ancrée au-dessus de la liste — « L'ordre n'a pas pu être enregistré. Les fiches
  sont restées dans leur ordre précédent. **Rien n'est perdu.** » ;
- **après un déplacement** : liste réordonnée + bande d'annulation ancrée sous la liste
  (« Hélène Dumas déplacée en position 4 sur 5. → Annuler le déplacement », « Possible pendant
  10 secondes ») ;
- **`alert-dialog` de suppression ouvert** : « Supprimer la fiche de Jean-Pierre Vasseur ? Elle
  disparaît de la page publique et sa photo est effacée. **Cette action est définitive.** » ;
- **après suppression** : `alert` neutre « Fiche supprimée. Les 4 fiches restantes ont été
  renumérotées de 1 à 4. » **au-dessus de la liste à quatre lignes renumérotées** — le critère 3 se
  voit et se lit.

**Écran 2** — sept états dessinés : fiche neuve · modification · téléversement en cours (`progress`
indéterminée, **aperçu précédent conservé**) · erreur de validation (**les trois à la fois** : résumé
ancré avec lien d'ancrage, bordure `destructive` 2 px, message sous le champ) · erreur de
téléversement (`alert` ancrée sous le champ photo, « Le reste de la fiche est conservé ») ·
enregistrement en cours (libellé remplacé, largeur conservée) · succès (`alert` ancrée en tête).

**Écran 3** — deux états seulement : **succès** et **vide** (« La composition du bureau sera publiée
prochainement. », sans aucune action). **Ni chargement ni erreur** : la page est rendue côté serveur,
et un échec ne se montre jamais au visiteur — une photo absente donne les initiales.

Les deux thèmes (ADR 012) sont vérifiables sur chaque planche par la bascule en tête de document ; le
carré d'initiales est en plus montré côte à côte en clair et en sombre dans l'annotation É1.

## Écarts de la maquette au brief et au design system

Ils sont écrits tels quels : c'est ce document qui sert de référence au plan.

1. **Pas d'écran 0 séparé.** Le brief demandait un « repère de continuité » distinct (comme l'écran 0
   de s05) ; la maquette dessine la barre latérale **à l'intérieur de l'écran 1**, avec l'annotation
   « Repère 0 ». Le document a donc **trois** sections ancrées, pas quatre. Le contenu attendu y est
   (entrée « Membres du bureau » active, après « Navigation », icône en pointillé).
2. **Message de succès de l'écran 2** : la maquette écrit « en position **1** sur 5 » là où le brief
   écrivait « position 3 sur 5 ». La maquette est cohérente avec la fiche réellement modifiée (Claire
   Besson, rang 1) ; c'est le brief qui portait un exemple arbitraire. La phrase reste à générer depuis
   le rang réel.
3. **« Monter » / « Descendre » et « Enregistrer » désactivés** sont rendus en **`aria-disabled="true"`
   avec opacité 0,45**, jamais avec l'attribut `disabled` : ils restent focusables et annoncés, ce que
   le brief exigeait. À reproduire tel quel — un `disabled` HTML les sortirait de l'ordre de tabulation.
4. **La bande d'annulation porte une mention de délai** que le brief n'avait pas écrite : « Possible
   pendant 10 secondes », alignée à droite en `meta`. Le délai devient lisible au lieu d'être deviné.
   En mobile, elle passe sous le message et cette mention disparaît.
5. **Le rang en mobile perd sa forme de pastille** : il est rendu en paire libellé / valeur dans un
   `<dl>` (« Rang — 4 sur 5 », `tabular-nums`), pas dans une pastille `secondary`. Le rang reste
   **écrit**, ce qui est la règle ; seule la forme change.
6. **La consigne de photo n'écrit aucun poids maximal** — conformément à la demande du brief de ne pas
   annoncer un chiffre avant qu'il soit tranché. Le plan doit écrire dans la consigne **la limite
   réellement appliquée** (voir « à confirmer au plan »).
7. **Le masquage de la zone de dépôt au tactile n'est plus porté par une `@media (pointer: coarse)`**
   comme dans l'export : dans un document où les planches desktop et mobile coexistent, cette règle
   masquerait aussi la planche desktop sur une tablette. La distinction est donc portée par les
   planches elles-mêmes (la planche mobile ne montre que le bouton) et par l'annotation
   « Note · Téléversement ». La règle `pointer: coarse` reste celle à implémenter.
8. **Le formulaire mobile de l'écran 2 est complet** (quatre champs, aides, pied), contrairement à la
   planche mobile tronquée de s05 : rien n'est laissé implicite.

## Design system gaps

Tous sont **signalés et annotés en marge de la maquette**, aucun n'est comblé ici. Les six premiers
demandaient une mise à jour de `docs/design-system.md` : cinq l'ont reçue le 23/09/2026.

> **Mise à jour du 23/09/2026.** Six des huit manques ci-dessous ont été portés sur le canevas des
> manques (brief `docs/designs/design-system-gaps-brief.md`, planches
> `docs/designs/design-system-gaps.html`) et **tranchés**. Les règles sont écrites dans
> `docs/design-system.md` — §1.7 (icônes), §1.9 (tokens), §3.9 (formes). La numérotation d'origine
> est conservée : le plan s'y réfère. Ce qui reste ouvert est resté écrit tel quel.

1. **É1 — Repli de photo d'une personne — ✅ tranché et écrit au design system (§3.9).** Le design
   system posait la question sans y répondre (« initiales, silhouette, ou rien ? »). La réponse
   retenue : **les initiales de la personne**, Source Serif 4 / 600, **`muted-foreground` sur `muted`**,
   même carré et même rayon (8 px) que la photo, **taille des lettres = 0,375 × le côté** ; deux
   lettres (initiale du prénom + initiale du nom, « Jean-Pierre Vasseur » → **JV**), un nom d'un seul
   mot donnant ses deux premières lettres. **Ni silhouette, ni icône de personne, ni image générique,
   ni teinte de l'association, ni `<AssociationMark />`** (dont la règle des deux lettres ignore un
   « ASL » en tête : elle nomme une association, pas une personne). Les ratios annotés sur la maquette (≈ 6,9:1
   et ≈ 6,3:1) étaient estimés depuis les clartés oklch ; ils ont été **mesurés** sur la planche P6 :
   **6,84:1 en clair, 6,36:1 en sombre**. `docs/design-system.md` §9 porte désormais le manque comme
   tranché et renvoie à §3.9 : il n'y a plus rien à y réécrire à la livraison.
2. **É2 — Patron de fiche publique de personne** : aucun n'existe dans le système. Celui de l'écran 3
   (photo carrée à gauche, `h2` pour le nom, rôle dessous, biographie en `body-lg`, filet `border`
   entre fiches, liste verticale ordonnée) est une **composition de pièces existantes**, pas un
   composant nouveau. À valider comme patron, ou à laisser local à s06.
3. **É3 — Texte public en gras hors titre — ✅ tranché (§1.9, planche P8) : un token de plus.** La
   dérogation au plancher public de 18 px est écartée ; le système gagne **`body-strong-public`,
   Public Sans 18 px / 600, interligne 1,5**. C'est lui qui porte le **rôle** d'un membre sur l'écran 3,
   là où la maquette écrivait « `body-lg` en graisse 600 » — le rendu ne change pas, la valeur est
   désormais nommée. `body-strong` (17 px) garde sa place : le back-office. **Le token n'existe pas
   encore dans le code** : voir « Tâches de code héritées du design system » ci-dessous.
4. **É4 — Compteur de caractères — ✅ tranché (§3.9, planche P5), et la proposition de s06 est
   complétée.** Le compteur reste ce que la maquette dessine : `meta` aligné à droite sous le champ,
   `tabular-nums`, `muted-foreground` en 400 **jusqu'au plafond inclus** (« 193 / 500 »). Colorer à
   l'approche transformerait un état normal en faute — s06 avait raison sur ce point. Mais la règle ne
   s'arrête pas là : **au dépassement seulement**, le compteur passe en **`--destructive-text`** et en
   **graisse 600**, la **bordure du champ passe à 2 px**, **et un message est écrit** (« 17 caractères
   de trop. »). C'est le seul ajout à reprendre par rapport à la maquette. La règle vaut partout où un
   champ est plafonné (280 caractères en s07, 500 en s06 et s09).
5. **É5 — Portrait en mobile — ✅ l'exception est inscrite (§3.9).** §4 impose l'image **pleine
   largeur, sans marge** sous 640 px ; cette règle vise les images de contenu d'un article, et
   appliquée à un portrait elle donnerait 390 px par fiche. L'**exception « portrait de personne »**
   est désormais écrite au design system : sous 640 px le portrait **ne passe pas en pleine largeur**,
   il reste un **carré de 96 px à gauche du nom**, gouttière 18 px conservée. Ce n'est plus une
   entorse de la maquette, c'est la règle.
6. **É6 — Icône « membre du bureau » — ✅ tranchée (§1.7, planche P11) : `UsersRound`.** Elle entre au
   **vocabulaire figé**. `UsersRound` plutôt que `UserRound`, parce que l'entrée liste plusieurs
   personnes, et plutôt que `Contact`, trop dense à 20 px. L'**emplacement en pointillé** de la maquette
   est donc à remplacer par cette icône à l'implémentation — c'est une tâche de code, reprise
   ci-dessous.
7. **É7 — Dimensions d'une photo de personne — ✅ tranchées (§3.9) ; le poids reste ouvert.** Les
   tailles de §1.8 visaient le **logo** ; le portrait a désormais les siennes, reprises telles que la
   maquette les proposait : carré **1:1**, `object-cover`, **rayon 8 px**, rendu **128 px** en public
   desktop, **96 px** en public mobile, **56 px** dans la liste du bureau, **128 px** en aperçu de
   formulaire ; source de **400 px de côté au minimum**, PNG / JPEG / WebP. **Le poids maximal reste
   ouvert** : il n'est pas visuel, il appartient au plan (voir « Hypothèses de conception à confirmer
   au plan »).
8. **É8 — Mention RGPD de bas de page** : le composant n'a rien de nouveau (`separator` + paragraphe
   `meta`) ; c'est **le texte** qui est une rédaction de travail, **à valider par le bureau**. Une seule
   fois pour toute la page, jamais sous une fiche, jamais de case à cocher.

**Restent ouverts** : É2 (patron de fiche publique de personne — à valider comme patron ou à laisser
local à s06 ; le canevas ne le traitait pas) et É8 (le texte de la mention RGPD, qui se valide auprès
du bureau, pas sur une planche). Le **poids maximal** d'une photo (É7) reste lui aussi au plan.

### Tâches de code héritées du design system

`docs/design-system.md` §1.9 le dit explicitement : **ces valeurs ne sont pas encore dans
`src/app/globals.css`**, et chaque token entre dans le code avec la story qui le consomme en premier.
Un token écrit dans un document n'entre jamais tout seul dans une feuille de style. s06 porte :

- **Ajouter le token `body-strong-public`** — Public Sans **18 px / 600 / interligne 1,5** — et
  **l'employer pour le rôle d'un membre** sur la page publique `/le-bureau` (écran 3). Aucun autre
  écran du produit ne le consomme aujourd'hui : c'est bien s06 qui le fait entrer.
- **Poser `UsersRound`** sur l'entrée « Membres du bureau » de la barre latérale, à la place de
  l'emplacement en pointillé de la maquette (§1.7). Pas de token, pas de feuille de style : un import
  lucide, à 20 px, `currentColor`.

Les autres tokens du 23/09/2026 (`--warning-border` corrigé, `--destructive-text`, `--overlay`,
zébrure et survol de tableau) n'entrent pas avec s06 : ils sont portés par s07, s08 et s09, dont ils
touchent les écrans.

## Hypothèses de conception à confirmer au plan

- **Adresses** : page publique `/le-bureau` (arbitrée), back-office **`/bureau/le-bureau`** proposé par
  symétrie. `/bureau/membres` est écarté (collision avec la base des membres propriétaires, s12).
  `/le-bureau` est à ajouter à `RESERVED_PAGE_SLUGS` **dans le même commit** (ADR 020) ; `bureau` y est
  déjà, pas `le-bureau`.
- **Nombre de membres** : **paramètre d'association** du registre typé (ADR 016, type « Nombre »),
  modifié sur la page « Réglages » **déjà générée**, et seulement **rappelé en lecture seule** sur
  l'écran 1. Un champ posé directement sur l'écran du bureau serait une divergence à décider au plan.
- **Poids maximal de la photo** : non écrit dans la maquette, **à trancher au plan**, et la consigne
  devra afficher la limite **réellement appliquée** — jamais « 5 Mo » si le plafond effectif est plus
  bas. Le plafond de 2 Mo des Server Actions contre les 5 Mo de `PAGE_FILE_MAX_BYTES` est une question
  ouverte de la recherche (question 6) qui touche aussi s04 et s05.
- **Texte alternatif déduit du nom** (« Portrait de Claire Besson »), **jamais saisi** : c'est ce que
  l'écran 2 annonce en clair. Il n'existe donc pas de champ à valider.
- **Réordonnancement appliqué immédiatement**, sans bouton d'enregistrement (comme le menu du site de
  s04b), avec **annulation de 10 s**. La **suppression**, elle, est irréversible : `alert-dialog`
  **avant**, pas de bande **après** — la photo est effacée avec la fiche. Différence assumée avec s04b.
- **Renumérotation sans trou** après une suppression : `removeMenuItemDao` ne renumérote pas (recherche,
  APIs vérifiées). Le critère 3 impose donc une suppression **suivie d'une réécriture des rangs**, dans
  la même transaction.
- **Rôle en texte libre**, nom et rôle obligatoires, biographie en **texte brut** plafonnée à 500
  caractères, photo facultative. Aucun statut, aucun brouillon, aucune publication.

## Ce que ce design ne couvre pas

- **Le lien vers `/le-bureau` depuis le menu du site** : le composeur de menu (s04b) ne pointe que vers
  des pages CMS ; la page n'est atteignable que par un lien écrit à la main. Limite connue, annotée sur
  la maquette, **non comblée ici**.
- Statut brouillon / publié, `<PreviewBar />`, bouton « Publier », badge de statut : il n'y en a pas.
- Groupes, niveaux, organigramme en cases reliées, distinction bureau / conseil syndical.
- Toute donnée de contact d'un membre (email, téléphone, réseaux sociaux) : le contact du bureau est s08.
- La fiche du membre propriétaire (s12) et la page « Contacts utiles » (contenu CMS ordinaire, s04).
- Le lien entre une fiche et un compte utilisateur, et le rôle d'autorisation `board` : une fiche n'est
  pas un compte.
- Dates de mandat, historique des bureaux successifs, archive des anciens membres.
- Recadrage, rotation ou retouche de la photo dans le back-office.
- Case à cocher de consentement, mention RGPD répétée sous chaque fiche : explicitement écartées.
- L'écran « Réglages », déjà généré depuis le registre des paramètres.
- Métadonnées SEO et image de partage : story s11.
- L'en-tête et le pied du site public, la barre latérale du back-office, la page 404 : déjà livrés.
