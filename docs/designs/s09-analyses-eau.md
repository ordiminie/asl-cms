# Design — Story s09-analyses-eau

> Conçu le 2026-09-23 par le chemin **Claude Design**, à partir du brief
> `docs/designs/s09-analyses-eau-brief.md`.
>
> - **Export du canevas** : `docs/designs/s09-analyses-eau.zip`, remis par Marie-Ève le 2026-09-23.
>   **L'URL du canevas n'a pas été transmise.**
> - **Reporté ici le même jour**, puis normalisé en `docs/designs/s09-analyses-eau.html`.
> - **Source visuelle unique** : `docs/design-system.md`.
> - **Contexte de code** : `docs/research/s09-analyses-eau.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                               | Où                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1       | Publier (date, affiche, texte facultatif, PDF) fait apparaître l'analyse **en tête** du public | **Écran 2** (« Publier l'analyse ») → **Écran 1** état `1b` (succès ancré) → **Écran 4** état `4a`, en tête |
| 2       | Le PDF **se télécharge** depuis la page publique, sans authentification                        | **Écran 4** : lien `outline` à attribut `download`, libellé dérivé de la date, poids écrit                  |
| 3       | Texte facultatif, **sans bloc vide ni libellé orphelin**                                       | **Écran 4** état `4a` : l'analyse du 4 août 2026 n'a pas de texte, et rien ne le remplace                   |
| 4       | **Quatre champs**, **une seule soumission**                                                    | **Écran 2** : quatre champs, un bouton, ni `PreviewBar`, ni « Aperçu », ni brouillon                        |
| 5       | Tri par date décroissante ; pas de fuite entre associations                                    | **Écrans 1 et 4** (même ordre décroissant) ; l'isolation n'est _pas dessinable_                             |

## Screen(s)

La maquette comporte six sections ancrées : `#s0` à `#s4`, puis `#ecarts`. Chaque planche porte sa
puce d'identification (`1a`, `2c`, `4d`…) et ses notes en marge, qui renvoient aux écarts.

### Écran 0 — Repère de continuité (barre latérale, `#s0`)

« Analyses d'eau » s'ajoute au groupe « Le site », **après « Actualités » et avant « Navigation »**,
avec l'icône `Droplet` et l'état actif (fond `sidebar-accent` + libellé 600). Le reste de la barre
(248 px, identité de l'association en tête, groupe « L'association ») est inchangé. L'ordre est
annoté « à confirmer » : il dépend de l'ordre de livraison des stories parallèles.

**Ce que la maquette montre réellement** : l'icône n'est posée **que sur l'entrée active**. Les six
autres entrées restent sans icône — c'est l'état actuel de la barre, pas une proposition de
généralisation (écart 8).

### Écran 1 — Bureau : liste des analyses (`#s1`, `/bureau/analyses-eau`)

`h1` « Analyses d'eau » (34 px) et un seul bouton `default` « Publier une analyse ». Le tableau, dans
un conteneur `card`, a quatre colonnes :

- **Date du prélèvement**, `02/09/2026` en `font-mono` / `tabular-nums` ;
- **Affiche**, vignette carrée de 44 px, sans libellé ;
- **Résultat PDF**, le poids seul (« 320 Ko »), **jamais le nom du fichier** ;
- **Action**, un seul lien « Modifier ».

Aucune colonne « Statut », aucun `badge` : toute analyse listée est en ligne. Pagination
« Précédent / Suivant » écrite avec « Page 1 sur 1 » — les deux boutons sont désactivés et annoncés
(`aria-disabled`), ce qui est cohérent, contrairement à la planche équivalente de s05.

Cinq planches desktop : `1a` succès · `1b` succès après publication (l'`alert` neutre `role="status"`
avec `CircleCheck` en `primary`, ancré) · `1c` vide (« Aucune analyse publiée pour l'instant. →
Publier la première ») · `1d` chargement (`skeleton` sur les lignes seulement) · `1e` erreur
(« La liste des analyses n'a pas pu être chargée. Rien n'est perdu : rechargez la page. »).

Mobile 390 px (`1f`) : patron « tableau → cartes », date en titre, Affiche et Résultat PDF en paires
libellé / valeur, « Modifier » en pleine largeur 56 px, « Publier une analyse » en tête. Barre
latérale dans le tiroir « Menu ». Les notes annoncent **25 lignes par page en desktop, 10 cartes en
mobile**, conformément au design system.

### Écran 2 — Bureau : publier une analyse (`#s2`, `/bureau/analyses-eau/nouvelle`)

Pas de `<PreviewBar />`. En tête : « ← Analyses d'eau », `h1` « Publier une analyse d'eau », puis la
ligne `meta` d'honnêteté « Une fois publiée, l'analyse est visible immédiatement sur /analyses-eau. »
Formulaire à une colonne, `max-w-[68ch]` centré dans une zone de contenu de 952 px. Quatre champs,
dans cet ordre, et aucun autre :

1. **Date du prélèvement** — champ de 48 px au format `jj/mm/aaaa`, pré-rempli à la date du jour,
   icône `Calendar` à droite, **sans calendrier déroulant**. Aide : « Les analyses sont classées de la
   plus récente à la plus ancienne selon cette date. »
2. **Affiche** — zone de dépôt **et** bouton « Choisir un fichier », consignes écrites avant tout
   échec (« PNG, JPEG ou WebP, 2 Mo au plus. »). Une fois déposée : aperçu, nom et poids,
   « Remplacer l'affiche » en `outline`, puis la ligne `meta` « Description pour les lecteurs
   d'écran : Affiche de l'analyse d'eau du 2 septembre 2026. » **Pas de champ texte alternatif.**
3. **Texte — Facultatif** — zone de saisie d'environ quatre lignes, texte brut, sans barre d'outils,
   avec le compteur « 0 / 500 » sous le champ à droite.
4. **Résultat complet (PDF)** — même zone de dépôt, restreinte au PDF, consignes « PDF, 2 Mo au
   plus. ». Une fois déposé : icône `FileText`, nom, poids, « Remplacer le PDF » en `outline`, sans
   aperçu d'image.

En bas, « Annuler » en `link` puis un seul bouton `default` « Publier l'analyse ».

Trois planches desktop et une mobile :

- **`2a` vide** : les deux consignes de fichier lisibles avant tout dépôt, la date du jour déjà
  remplie ;
- **`2b` chargement** : le libellé devient « Publication en cours… », le bouton est désactivé et
  **garde sa largeur**, une `progress` indéterminée porte les deux noms de fichier, les aperçus
  restent visibles ;
- **`2c` erreur, deux erreurs cumulées** : résumé ancré en tête (`destructive`) avec liens d'ancrage,
  bordure `destructive` 2 px sur la date future (12/09/2026) et message sous le champ, **plus** la
  même bordure et un message sur le champ PDF ;
- **`2d` mobile 390 px** : pas de zone de dépôt, seulement les boutons « Choisir un fichier » et les
  consignes ; champs à 56 px ; « Publier l'analyse » en pleine largeur, « Annuler » dessous.

### Écran 3 — Bureau : corriger une analyse publiée (`#s3`, `/bureau/analyses-eau/{id}`)

Même formulaire, rempli. En tête : « ← Analyses d'eau », `h1` « Analyse du 2 septembre 2026 », puis
un `alert` neutre `role="status"` : « Cette analyse est en ligne. Vos modifications sont visibles
immédiatement sur le site. » Les deux fichiers portent « Remplacer … » en `outline`, **jamais
« Retirer »** : affiche et PDF sont obligatoires.

« Supprimer l'analyse » en `outline` vit en bas de page, **séparé du formulaire par un `separator` et
48 px**, jamais à côté du bouton principal.

Quatre planches desktop et une mobile :

- **`3a`** rempli, au repos ;
- **`3b`** l'`alert-dialog` ouvert : « Supprimer l'analyse du 2 septembre 2026 ? Elle disparaît du
  site, avec son affiche et son résultat PDF. **Cette action est définitive.** », avec « Annuler » en
  `outline` et « Supprimer l'analyse » en `destructive` — le bouton nomme l'acte ;
- **`3c`** remplacement d'un fichier en cours : `progress` indéterminée et nom du nouveau fichier
  dans le champ Affiche, l'aperçu précédent restant visible ;
- **`3d`** erreur de champ : texte à 512 caractères, bordure `destructive` 2 px, compteur
  « 512 / 500 » en `destructive` **avec** le message écrit, et le résumé ancré en tête ;
- **`3e` mobile 390 px** : « Enregistrer les modifications » en pleine largeur, « Supprimer
  l'analyse » en pleine largeur tout en bas, après le `separator`.

### Écran 4 — Site public : liste des analyses (`#s4`, `/analyses-eau`)

Corps de page seul : l'en-tête et le pied publics sont figurés par des bandeaux neutres, non
redessinés. Gabarit 1200 px, contenu centré à `max-w-[68ch]`, texte à 18 px / 1,65. `h1` « Analyses
d'eau », sans chapeau. Une liste verticale, une analyse par élément, séparés par un filet et 48 px.

**Ordre desktop** : titre `h2` « Prélèvement du 2 septembre 2026 » → affiche en `<figure>` pleine
largeur de colonne, hauteur plafonnée à 520 px, sans `figcaption` → texte facultatif, s'il existe →
lien de téléchargement en `outline` avec `FileText` : « Résultat complet du 2 septembre 2026 (PDF,
320 Ko) ». **Aucun bouton `default` sur la page.**

**Ordre mobile (`4d`)** : titre → **lien de téléchargement en pleine largeur 56 px** → affiche en
pleine largeur sans marge → texte. Le lien remonte au-dessus de l'affiche, comme le demande la règle
mobile du bloc PDF. Gouttière 18 px, pagination en deux boutons de 56 px.

Trois planches desktop : `4a` succès (l'analyse du 4 août sans texte y est visible) · `4b` page 2,
« Précédent » actif · `4c` vide (« Aucune analyse d'eau publiée pour l'instant. », sans action, sans
illustration). Pas d'état de chargement ni d'erreur : la page est rendue côté serveur.

## Mockup

`docs/designs/s09-analyses-eau.html` est la **référence visuelle**, normalisée depuis l'export Claude
Design :

- **Retiré** : le runtime du canevas (`support.js`, `<x-dc>`, gabarits `{{ }}`, `sc-for` / `sc-if`,
  le sprite SVG injecté en JS).
- **Remplacé** : les listes par leurs données fictives, les icônes lucide par **54 SVG en ligne**
  (plus aucun script distant ; seul le lien Google Fonts est conservé), la bascule clair / sombre par
  du JS natif (`data-theme` sur `#root`, comme s05).
- **Vérifié avec jsdom** : six sections ancrées (`#s0` à `#s4`, `#ecarts`), 38 identifiants tous
  uniques, **aucune ancre morte**, la bascule change de thème. `grep "support.js\|unpkg\|x-dc"` rend 0. Le rendu dans un vrai navigateur n'a pas été vérifié.

**NE PAS copier en production.** L'Execute construit les écrans avec les vrais composants du socle
(`table`, `pagination`, `input`, `textarea`, `label`, `file-upload`, `progress`, `alert`,
`alert-dialog`, `separator`, `sheet`, `skeleton`, `sidebar`, `card`). La maquette a ses propres
mesures en ligne, listées plus bas : elles ne remplacent pas les tokens.

**Données fictives** : association « Les Amis de l'Étang », teinte eau (195), aujourd'hui = 2
septembre 2026. Quatre analyses : 2 septembre (avec texte), **4 août (sans texte — l'état du
critère 3)**, 7 juillet, 3 juin 2026.

## Reused components (from the design system)

- **`button`** : un seul `default` par écran (« Publier une analyse », « Publier l'analyse »,
  « Enregistrer les modifications ») ; tout le reste en `outline`. 48 px en desktop, 56 px en mobile.
  Pendant le chargement, le libellé est remplacé, le bouton désactivé, **la largeur conservée**.
- **`table`, `pagination`** : liste du bureau, « tableau → cartes » sous 640 px, « Précédent /
  Suivant » écrits, jamais de défilement infini.
- **`input`, `textarea`, `label`** : une colonne, un champ par ligne, libellé au-dessus,
  « Facultatif » écrit en clair. Erreur = bordure `destructive` 2 px **+** message sous le champ **+**
  résumé ancré avec liens d'ancrage.
- **`file-upload`** : zone de dépôt **et** bouton, types et poids annoncés avant l'échec, pas de zone
  de dépôt au tactile.
- **`progress`** : indéterminée, avec le nom du fichier, sans pourcentage — au dépôt (écran 3) comme
  à la soumission (écran 2).
- **`alert`** : succès neutre (`CircleCheck` en `primary`, pas de vert) et erreurs, **ancrés**.
  **`alert-dialog`** : uniquement la suppression.
- **`separator`** : isole la zone de suppression de l'écran 3.
- **`skeleton`** : lignes du tableau du bureau seulement, jamais le formulaire.
- **`sidebar`** (+ `sheet` en mobile) : entrée « Analyses d'eau » active.
- **`card`** : conteneur du tableau, bordure 1 px, sans ombre.
- **Icônes** : `Droplet` (eau), `FileText` (document), `Calendar`, `Upload`, `CircleCheck`,
  `CircleAlert`, `Info`, `Menu`, `ArrowLeft`.

## States

**Écran 1** : succès · succès après publication · vide · chargement (`skeleton`) · erreur · mobile.

**Écran 2** : vide · chargement (soumission) · erreur (date future **et** dépassement de taille,
cumulées) · mobile. L'état de succès de l'écran 2 est dessiné **sur l'écran 1** (`1b`), puisque la
publication y renvoie.

**Écran 3** : rempli au repos · `alert-dialog` ouvert · remplacement de fichier en cours · erreur de
champ (512 / 500) · mobile.

**Écran 4** : succès (dont une analyse sans texte) · page 2 · vide · mobile. Pas de chargement ni
d'erreur : rendu côté serveur.

## Écarts de la maquette au brief et au design system

Constatés sur le canevas, **pas à reproduire** : l'Execute suit le design system et les composants
réels.

1. **Lignes de tableau à 64 px** (écran 1), là où le design system fixe **56 px**. L'en-tête est à
   48 px sur `muted`, ce qui est conforme.
2. **Date du tableau à 16 px**, là où le texte de tableau est à **17 px**. Le poids du PDF à 15 px est
   correct : c'est du `meta`.
3. **`h1` à 30 px sur les planches mobiles des formulaires** (`2d`, `3e`). Le token `h1` vaut **34 px**,
   et c'est lui qui s'applique. Les autres planches mobiles (`1f`, `4d`) sont bien à 34 px. Même écart
   qu'en s05.
4. **Mesures locales sans équivalent au design system** : champ date plafonné à 240 px de large en
   desktop, bouton de soumission à `min-width: 260px`, `progress` du champ Affiche figée à 280 px,
   aperçu d'affiche du bureau en 120 × 160 px. Ce sont des choix de maquette ; les composants réels
   décident.
5. **Affiche publique dessinée à hauteur fixe** (520 px en desktop, 440 px en mobile) alors que le
   brief demande une hauteur **plafonnée**. La valeur mobile de 440 px n'est pas au brief : c'est un
   placeholder.
6. **Le résumé d'erreur de `2c` pointe la planche, pas le champ.** Le lien « Aller au champ Date du
   prélèvement » cible `#2c` ; seul le champ PDF a une vraie ancre (`#2c-pdf`). Artefact de maquette :
   l'implémentation ancre sur chaque champ concerné.
7. **`aria-disabled` porté par un `<button>` (bureau) et par un `<span role="link">` (public)** pour
   la pagination désactivée. Le composant `pagination` réel tranche la forme ; l'intention — désactivé
   **et annoncé**, jamais absent — est la bonne.
8. **Le voile de l'`alert-dialog` est écrit en dur** (`oklch(0 0 0 / 0.5)`). Aucun token ne le porte :
   c'est un manque du design system, signalé plus bas (gap 9). La maquette l'annote elle-même.
9. **Ajout par rapport au brief, cohérent avec le design system** : en `2c`, le champ PDF reçoit lui
   aussi la bordure `destructive` 2 px et son message. Le brief ne décrivait l'erreur de champ que sur
   la date.
10. **La planche `4b` s'écarte du jeu de données du brief** : elle montre une analyse fictive du
    5 novembre 2025, absente du tableau de données, pour figurer une deuxième page. La maquette
    l'annote « donnée fictive (extrait) ».
11. **`4a` annonce « Page 1 sur 3 » en montrant 4 analyses**, alors que la règle affichée est de 10 par
    page. C'est un extrait, annoté comme tel.
12. **La planche mobile publique n'a pas de bandeau de pied**, contrairement à sa version desktop.
    Sans conséquence.

## Design system gaps

Signalés, aucun n'est comblé ici. Les huit premiers étaient annoncés au brief et sont bien présents
sur le canevas ; le neuvième a été trouvé sur la maquette.

> **Mise à jour du 23/09/2026.** Trois des neuf manques ci-dessous — les n° 2, 5 et 9 — ont été portés
> sur le canevas des manques (brief `docs/designs/design-system-gaps-brief.md`, planches
> `docs/designs/design-system-gaps.html` — P7, P10, P2) et **tranchés** ; un quatrième, le n° 1, était
> déjà clos et `docs/design-system.md` est désormais amendé. Les règles sont écrites en §1.9 (tokens)
> et §3.9 (formes). La numérotation d'origine est conservée : le plan s'y réfère. **Les cinq manques
> restants ne sont pas visuels** — `download` contre nouvel onglet, `alt` dérivé, nombre d'éléments par
> page, plafond de poids, icône et ordre des entrées de barre latérale : le canevas ne pouvait pas les
> trancher, ils restent au plan, tels quels.

1. **Gap §9 « bloc analyses d'eau » — clos dans le sens du modèle à champs fixes, et le design system
   est amendé.** Ni bloc dédié, ni réemploi du bloc PDF : une analyse a son écran de saisie et sa page
   publique. `docs/design-system.md` §9 porte désormais la ligne barrée et la date (« tranché le
   23/09/2026 »), avec sa raison écrite — le bloc PDF ne sait ni trier par date ni publier en une
   soumission. **Il n'y a plus rien à y amender.**
2. **Champ date — ✅ tranché (§3.9, planche P7) : saisie au clavier seule.** La proposition dessinée
   est retenue et précisée : **pas de calendrier déroulant** — les dates saisies dans le produit sont
   proches d'aujourd'hui — et le champ est **pré-rempli à aujourd'hui**. Format `jj/mm/aaaa`,
   `inputmode="numeric"`, **barres insérées à la frappe**, **JetBrains Mono 500** (17 px desktop,
   18 px mobile), icône `Calendar` **20 px, décorative**, en `muted-foreground`, **jamais un bouton** ;
   **48 px** desktop, **56 px** sous 1 024 px. Quatre états : vide (placeholder `jj/mm/aaaa`),
   pré-rempli, en saisie (`--ring` + halo 2 px), erreur (bordure 2 px + message). Le manque était
   **partagé avec s05** (gap 2 de son design) : la règle vaut pour elle aussi, mais **s05 est déjà
   livrée et rien n'y est rouvert ici** — c'est un écart à connaître, à reprendre quand une story
   touchera de nouveau sa date, pas une tâche de s09.
3. **Téléchargement contre ouverture en nouvel onglet** : le §4 (bloc 3) annonce une ouverture en
   nouvel onglet, le critère 2 dit « se télécharge ». Le critère prévaut ici — la maquette pose
   l'attribut `download` — mais la divergence de formule concerne le design system, pas seulement
   cette story.
4. **Texte alternatif dérivé** : le §4 (bloc 2) impose un `alt` **saisi**. Ici il est dérivé de la
   date, le critère 4 interdisant un cinquième champ. **Dette d'accessibilité assumée** : une affiche
   d'analyse porte souvent ses résultats en texte dans l'image, et un `alt` dérivé ne les restitue pas.
   Le texte facultatif et le PDF sont les seuls recours. À consigner, pas à combler par un champ.
5. **Taille et cadrage de l'affiche publique — ✅ tranchés (§3.9, planche P10).** Largeur de la colonne
   de lecture (**68 ch**), **ratio d'origine**, **hauteur plafonnée à 520 px**, pas de hauteur
   minimale. Au-delà du plafond, l'image est **contenue et centrée sur un bandeau `muted`, jamais
   rognée** : une affiche d'analyse doit rester lisible entière. C'est la correction de l'**écart 5**
   de la maquette, qui dessinait une **hauteur fixe** (520 px en desktop, 440 px en mobile) : le
   plafond ne fixe pas la hauteur, il la borne. `loading="lazy"` et l'absence de `figcaption` restent
   ceux de la maquette. La règle vaut aussi pour la vignette d'actualité (gap 1 de s05).
6. **Nombre d'analyses par page côté public** : les règles 25 / 10 visent les **tableaux du bureau**.
   La maquette montre 10, repris de s05. Constante d'affichage ou paramètre d'association (ADR 010,
   ADR 016) : à trancher au plan.
7. **Plafond de taille affiché à l'utilisateur** : « 2 Mo au plus » est écrit sous chaque champ de
   fichier, mais c'est **provisoire**. C'est le **total** des deux fichiers qui est contraint — ils
   partent dans la même soumission, et `serverActions.bodySizeLimit` vaut aujourd'hui `2mb`
   (recherche, piège 3). La valeur affichée reste à fixer au plan.
8. **Icône dans la barre latérale du bureau** : la barre n'en affiche aucune aujourd'hui ; s05 en pose
   une sur « Actualités », la maquette pose `Droplet` sur « Analyses d'eau ». **Cohérence des deux
   entrées à tenir au plan** ; l'ordre des entrées est également à confirmer.
9. **Voile du dialogue modal — ✅ tokenisé (§1.9, planche P2) : `--overlay`.** Clair
   **`oklch(0.22 0.015 250 / 0.5)`**, sombre **`oklch(0.1 0.01 255 / 0.7)`**. Le `oklch(0 0 0 / 0.5)`
   écrit en dur par la maquette disparaît : en sombre, du noir à 50 % ne sépare rien, le fond étant
   déjà sombre — d'où une valeur **par thème**, et non une seule. **En sombre, la boîte garde son filet
   `1px solid var(--border)`** : `--card` et `--background` sombres sont identiques, et c'est le filet,
   lui seul, qui détache la boîte du voile. s09 fait entrer le token dans le code (voir ci-dessous).

**Hors champ, signalé sans être résolu** : le menu du site (s04b) ne sait pointer que vers des pages
CMS. Il ne peut pas pointer vers `/analyses-eau` aujourd'hui. L'écran « Navigation » n'est pas
redessiné ; le visiteur atteint la page par un lien écrit dans une page, ou par son adresse.

**Décision transverse à reprendre, sans manque déclaré** — le **compteur de caractères** du texte
facultatif (« 0 / 500 », état `3d` à 512 caractères) suit désormais §3.9 : `meta` aligné à droite,
`tabular-nums`, `muted-foreground` en 400 **jusqu'à 500 inclus** ; **au dépassement seulement**,
couleur **`--destructive-text`**, **graisse 600**, **bordure du champ à 2 px** **et un message écrit**
(« 12 caractères de trop. »). La maquette montre le compteur et la bordure : **le message écrit est
l'ajout**.

### Tâches de code héritées du design system

`docs/design-system.md` §1.9 le dit explicitement : **ces valeurs ne sont pas encore dans
`src/app/globals.css`**, et chaque token entre dans le code avec la story qui le consomme en premier.
Un token écrit dans un document n'entre jamais tout seul dans une feuille de style. s09 porte le
voile :

- **Ajouter `--overlay`** — clair **`oklch(0.22 0.015 250 / 0.5)`**, sombre
  **`oklch(0.1 0.01 255 / 0.7)`** — et **l'employer pour le voile de l'`alert-dialog` de suppression**
  (écran 3), à la place du `oklch(0 0 0 / 0.5)` écrit en dur dans la maquette.
- **Conserver le filet de la boîte en mode sombre** : `1px solid var(--border)`. Ce n'est pas une
  décoration — `--card` et `--background` sombres sont identiques, la boîte se fondrait dans le voile
  sans lui.

Le **champ date** et le **cadrage de l'image de contenu** sont des **règles de forme** (§3.9) : elles
n'ajoutent aucun token et se règlent dans les composants de la story. Les autres tokens du 23/09/2026
(`--warning-border` corrigé, `--destructive-text`, zébrure et survol de tableau) entrent avec s07 et
s08 ; s09 les consomme sans les poser — ce qui suppose que s07 et s08 soient livrées avant, ou que le
plan le note.

## Hypothèses de conception à confirmer au plan

- **Plafond de taille** : valeur affichée à l'utilisateur, et façon de faire tenir les deux fichiers
  dans une seule soumission (relever `bodySizeLimit`, `proxyClientMaxBodySize`, ou changer de
  transport). **Aucun dépôt en deux temps** : le critère 4 l'interdit.
- **Saisie et validation de la date** : ~~`input type="date"` natif ou texte masqué~~ — **tranché
  (§3.9) : texte masqué, saisie au clavier, sans calendrier déroulant, pré-rempli à aujourd'hui.**
  Reste au plan le **refus d'une date future** (message écrit, et moment de la vérification), que le
  design system ne tranche pas.
- **Ce qui fait foi pour l'`alt` dérivé.** En `2c`, la ligne « Description pour les lecteurs d'écran »
  suit la date **saisie**, y compris quand celle-ci est refusée (12 septembre). À l'exécution, c'est la
  date **enregistrée** qui doit fabriquer l'`alt`.
- **Quand part un fichier remplacé.** La planche `3c` fait passer le bouton principal en
  « Enregistrement en cours… » pendant l'envoi de la nouvelle affiche : elle suppose que le
  remplacement part **avec la soumission**, pas au moment du choix du fichier. À confirmer — c'est
  cohérent avec « une seule soumission », mais ce n'était pas écrit au brief.
- **Ordre des éléments de la page publique** : titre / affiche / texte / lien en desktop, titre / lien
  / affiche / texte en mobile. Un seul ordre dans le DOM réordonné en CSS, ou deux rendus ? L'ordre de
  lecture au lecteur d'écran en dépend.
- **Lien de téléchargement** : attribut `download`, nom de fichier proposé au téléchargement, et
  annonce « téléchargement » au lecteur d'écran (le libellé visible, lui, reste dérivé de la date).
- **Segment public `/analyses-eau`** : nom à arrêter, puis **à ajouter à `RESERVED_PAGE_SLUGS` dans le
  même commit** (`page-block-types.ts:89`), après avoir vérifié qu'aucune page existante ne le porte.
- **Position et icône de l'entrée de barre latérale**, selon l'ordre de livraison de s05 et s09.
- **Pagination du bureau** : 25 lignes en desktop, 10 cartes en mobile, comme l'annoncent les notes de
  la maquette.

## Ce que ce design ne couvre pas

- **Brouillon, aperçu avant publication, dépublication, publication programmée** : la publication est
  directe, la suppression est définitive.
- **Page dédiée par analyse** (`/analyses-eau/{…}`) : aucun critère n'en demande.
- **Historique des corrections**, journal, auteur de la publication.
- **Filtres, recherche, tri par autre chose que la date**, au bureau comme au public.
- **Plusieurs points de prélèvement, résultats structurés, seuils, pastille « conforme / non
  conforme »** : aucun champ ne les porte.
- **Envoi d'une analyse par email** (s25), **métadonnées SEO et image de partage** (s11), **bandeau
  d'alerte** en cas d'eau non conforme (s07).
- **Feuille d'impression** : le design system (§6.2) cite l'analyse d'eau parmi les documents
  imprimés, mais aucune règle `@media print` n'existe dans le produit. Rien n'est promis ni dessiné.
- **L'en-tête et le pied du site public, la 404, la barre latérale du bureau, l'écran Navigation** :
  déjà livrés ou portés par d'autres stories.
