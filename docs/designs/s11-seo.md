# Design — Story s11-seo

> Conçu le 2026-09-30 par le chemin **Claude Design**, à partir du brief `docs/designs/s11-seo-brief.md`
> (reçu tel quel par le canevas : le fichier `uploads/` de l'export est identique au brief du dépôt).
>
> - **Canevas** :
>   <https://claude.ai/design/p/7c73b335-8b5b-4f5e-b958-07b6a0ec5150?file=docs%2Fdesigns%2Fs11-seo.dc.html>
> - **Export du canevas** : `docs/designs/s11-seo.zip`, remis par Marie-Ève le 2026-09-30.
> - **Normalisé le même jour** en `docs/designs/s11-seo.html` : la source `.dc.html` dépend du moteur
>   de gabarits de Claude Design (`support.js`, absent du dépôt) ; elle a été rendue par Chromium dans
>   ses deux thèmes, et le fichier contient les deux rendus figés avec la bascule « Clair / Sombre ».
>   Aucun contenu n'a été retouché. ⚠️ La planche **`2·live`** (« l'aperçu suit la saisie ») était
>   interactive dans la source : dans le rendu figé, elle ne réagit plus à la frappe. Les planches
>   `2a` à `2j` montrent les mêmes états, figés.
> - **Source visuelle unique** : `docs/design-system.md`. **Contexte de code** : `docs/research/s11-seo.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                  | Où                                                                   |
| ------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1       | Sitemap des pages publiées                                                        | _mécanique, aucun écran_                                             |
| 2       | Titre, description, partage **renseignés par le bureau**, repli sur l'association | **Écran 1** (description de l'association) + **Écran 2** + **Écran 3** |
| 3       | `robots.txt`                                                                      | _mécanique, aucun écran_                                             |
| 4       | Code Search Console, paramètre saisissable en back-office                         | **Écran 1**                                                          |
| 5       | Sitemap et métadonnées propres à chaque domaine                                   | _mécanique, aucun écran_                                             |

## Screen(s)

Trois sections ancrées (Réglages, Éditeurs, Carte de partage). Chaque planche porte sa puce (`1a`…).

### Écran 1 — Réglages : carte « Référencement » (extrait de `/bureau/reglages`)

Deux lignes nouvelles, générées depuis le registre, dans une `card` « Référencement » (« Ce que Google
affiche de votre site, et ce qu'on voit quand un lien est partagé. »). Le bouton « Enregistrer les
réglages » est celui de la page, déjà livré.

- **Description de l'association** — `textarea` 3 lignes, « Facultatif », compteur **160**. Aide :
  « Deux phrases qui présentent l'association… ». Vide : « Vide : les résultats de recherche
  afficheront le texte que Google choisira dans la page. »
- **Code de vérification Google** — `input` en `data`, « Facultatif ». Aide : « Google vous le donne
  quand vous déclarez le site dans la Search Console : c'est la suite de lettres et de chiffres après
  `content=`. Collez-la ici. » Vide : « Vide : le site n'est pas déclaré auprès de Google. Il peut
  tout de même apparaître dans ses résultats. »
- Succès : `alert` neutre « Réglages enregistrés. Google en tiendra compte à son prochain passage sur
  le site. »

### Écran 2 — Éditeurs : section « Référencement et partage »

**Page** — dans le panneau « Paramètres » (296 px) de l'éditeur, sous Titre et Adresse ; en mobile,
en bas du `sheet` « Paramètres de la page ». Chapeau : « Ce qui s'affiche dans Google, et quand
quelqu'un partage le lien de la page. »

1. **Titre dans les moteurs de recherche** — « Facultatif », compteur **60**. Vide : « Vide : le titre
   de la page, « Qualité de l'eau », sera utilisé. »
2. **Description** — « Facultatif », compteur **160**. Vide : « Vide : la description de l'association
   sera utilisée. » ; si l'association n'en a pas : « Vide, comme la description de l'association :
   Google choisira un extrait de la page. » + lien « Renseigner la description de l'association ».
3. **Image de partage** — « Facultatif », `file-upload` (« PNG, JPEG ou WebP, 5 Mo au plus.
   Idéalement 1200 × 630 px. »). Vide : « Vide : le logo de l'association sera montré. » Déposée :
   nom, dimensions et poids, « Remplacer l'image » / « Retirer l'image », puis **Texte alternatif de
   l'image** (« Obligatoire avec une image »).
4. **Aperçu « Dans Google »** — encadré `muted` : adresse (`lesamisdeletang.fr › qualite-de-l-eau`) en
   `meta`, titre en `link` 20 px, description en `body` sur deux lignes, et la phrase « Google peut
   raccourcir ces textes ou en choisir d'autres. » Montre toujours la valeur de repli.

**Actualité** — version réduite, sous le contenu du formulaire en une colonne : « Le titre et l'image
montrés sont ceux de l'actualité, avec son texte alternatif. » Seule la **Description** s'ajoute
(compteur 160 ; vide : « Vide : le début du texte de l'actualité sera utilisé. »), avec l'aperçu.

**Chaîne de repli** (annotée par la maquette) : titre → titre de la page · description → description
de l'association → extrait choisi par Google · image → logo → monogramme · actualité : description →
début du texte.

### Écran 3 — Carte de partage

Trois cas dans une carte de messagerie **neutre** (toujours en clair : l'image est affichée par
l'application de l'autre personne) : page avec image de partage (`3a`) ; sans image, association avec
logo (`3b`) ; sans image ni logo, monogramme (`3c`). Puis le **gabarit de repli 1200 × 630** montré
pour deux teintes (eau 195, tuile 40), avec logo et avec monogramme.

## Mockup

`docs/designs/s11-seo.html` — référence visuelle. **NE PAS copier en production** : l'Execute construit
l'écran avec les vrais composants du socle. L'export d'origine reste `docs/designs/s11-seo.zip`.

## Reused components (from the design system)

- **`textarea`, `input`, `label`** — libellé au-dessus, « Facultatif » écrit, validation au _blur_ ; le
  code Google en `data` (`font-mono`).
- **Compteur de caractères** (§3.9) — 60 / 160 ; au dépassement seulement : `--destructive-text` 600,
  bordure 2 px, « 13 caractères de trop. ».
- **`file-upload`** — zone de dépôt et bouton, consignes avant l'échec, **pas de zone de dépôt au
  tactile** (`2g`).
- **`<PreviewBar />`** — le refus de publication (image sans texte alternatif) s'affiche **dans la
  barre**, « Rien n'est perdu », avec un lien « Décrire l'image » (`2f`).
- **`alert`** neutre `CircleCheck` (enregistré) ; **`card`**, **`separator`**, **`sheet`** (mobile).
- **`<AssociationMark />`** — logo ou monogramme, agrandi sans modification pour le gabarit de repli.
- **`button`** — aucun bouton nouveau : « Enregistrer les réglages » et « Publier » existent.

## States

- **Réglages** : vides (`1a`, `1g` mobile) · remplis (`1b`) · compteur dépassé (`1c`, `1h`) · balise
  collée entière → code extrait (`1d`, proposition) · code invalide (`1e`, `1h`) · enregistré (`1f`).
- **Éditeur de page** : tout vide (`2a`, `2g` mobile) · vide, association sans description (`2b`) ·
  rempli (`2c`) · compteurs dépassés (`2d`) · image déposée sans texte alternatif (`2e`) · publication
  refusée (`2f`) · image déposée en mobile (`2h`).
- **Éditeur d'actualité** : vide (`2i`) · rempli (`2j`).
- **Carte de partage** : trois cas (`3a`–`3c`) + gabarit sur deux teintes.

## Écarts de la maquette au brief

1. **Phrase de repli du code Google** : le brief n'en donnait pas ; la maquette écrit « Vide : le site
   n'est pas déclaré auprès de Google. Il peut tout de même apparaître dans ses résultats. » Conforme à
   la règle « un réglage vide dit ce qui s'applique ».
2. **Code extrait d'une balise collée** (`1d`) : extrait **au _blur_**, sans erreur, et la phrase le dit
   (« Nous avons gardé le code seul : k3Jd…NoPq. »). Proposition du brief, précisée.
3. **Consigne de dimensions** « Idéalement 1200 × 630 px » ajoutée sous le dépôt d'image.
4. **Message du succès** : « Google en tiendra compte à son prochain passage sur le site. » ajouté.

## Design system gaps

Propositions portées par la maquette, à verser au design system si le plan les retient :

1. **Extension de la table §3.1** — le registre ne connaît que email, nombre, booléen, choix. Deux
   rendus ajoutés : **texte long** (`textarea` 3 lignes + compteur, plafond par ligne du registre) et
   **code** (`input` en `data`, jeu de caractères restreint : lettres, chiffres, tirets, soulignés).
2. **Image de partage social** (§9, rattachée à s11) — gabarit **1200 × 630** (1,91:1), marges 64 px,
   logo ou monogramme 240 × 240, écart 40 px, nom en Source Serif 4 600 à 72 px, centré, deux lignes au
   plus. Couleurs : **surface + encre** des six teintes précalculées (hex du §1.2, pas de token) — eau
   `#E8F5F8` / `#185A66`, tuile `#F8EDE6` / `#5E3421`. Rien d'autre sur l'image.
3. **Aperçu « Dans Google »** — encadré `muted`, sans logo ni couleur de marque ; adresse en `meta`,
   titre en `link` 20 px, description en `body` coupée à deux lignes ; montre toujours la valeur de
   repli.
4. **Restent ouverts** — icônes d'application par association et page 404 (§9, rattachées à s11) : hors
   critères, non dessinées.

## Hypothèses et points laissés au plan

- **L'image de partage** est le champ le plus coûteux de la story (stockage, portée de fichier de
  contenu, recadrage) : **à confirmer au plan**. Sans lui, le gabarit de repli de l'écran 3 s'applique à
  toutes les pages. S'il est retenu : texte alternatif obligatoire dès qu'une image est déposée, refus
  à la publication dans la `PreviewBar`, comme pour un bloc image.
- **Le gabarit de repli** est une image générée par association (et par teinte) : son mode de
  production (rendu à la volée, fichier stocké) est un choix technique.
- **Plafonds** 60 et 160 : valeurs d'usage des moteurs, portées par le registre et par la page.
- **Pages à adresse fixe** (Actualités, Analyses d'eau, Le bureau, Contact) : repli sur l'association,
  aucun écran.
- **Sitemap, `robots.txt`, ADR 008** (locale unique non appliquée, voir la recherche) : aucun écran,
  décisions du plan.

## Ce que ce design ne couvre pas

Écran de supervision du référencement (indexation, statistiques) ; réglages par page du sitemap ou
exclusion d'une page publiée ; page 404 et icônes d'application ; l'éditeur de page lui-même et le rendu
public des pages, déjà livrés.
