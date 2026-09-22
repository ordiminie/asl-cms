# Design — Story s05-actualites

> Conçu le 2026-09-22 par le chemin **Claude Design**, à partir du brief `docs/designs/s05-actualites-brief.md`.
>
> - **Export du canevas** : `docs/designs/s05-actualites.zip`, remis par Marie-Ève le 2026-09-22. L'URL
>   du canevas n'a pas été transmise.
> - **Reporté ici le même jour**, puis normalisé en `docs/designs/s05-actualites.html`.
> - **Source visuelle unique** : `docs/design-system.md`.
> - **Contexte de code** : `docs/research/s05-actualites.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                                 | Où                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1       | Créer une actualité (titre, date, image, contenu), en tête de la liste publique une fois publiée | **Écran 2** (formulaire, « Publier l'actualité ») → **Écran 3** (première de la liste)            |
| 2       | Liste publique triée par date décroissante et paginée ; page dédiée à URL stable                 | **Écran 3** (dates décroissantes, « Page 1 sur 3 ») + **Écran 4** ; adresse fixe à l'écran 2      |
| 3       | Brouillon absent de la liste et de son URL pour un visiteur                                      | **Écran 1** (badge Brouillon) + **Écran 4** (aperçu réservé au bureau ; visiteur → 404 existante) |
| 4       | Aucune actualité d'une association visible sur le site d'une autre                               | _non dessinable_ (isolation, pas d'écran)                                                         |

## Screen(s)

### Écran 0 — Repère de continuité (barre latérale)

« Actualités » (icône `Megaphone`, active) s'ajoute au groupe « Le site », **entre « Pages » et
« Navigation »**. Le reste de la barre est inchangé.

### Écran 1 — Bureau : liste des actualités

`h1` « Actualités » et bouton `default` « Nouvelle actualité ». Le `table` a quatre colonnes :

- **Titre**, en 17 px / 600 ;
- **Date**, au format `02/09/2026` en `font-mono`, `tabular-nums` ;
- **Statut**, en `badge` à point + libellé écrit : Publiée / Brouillon / Dépubliée ;
- **Action**, un seul lien « Modifier ».

Tri par date décroissante. Pagination « Précédent / Suivant » écrite, avec « Page x sur y ».

États à côté du tableau :

- **vide** : « Aucune actualité pour l'instant. → Écrire la première » ;
- **chargement** : `skeleton` sur les lignes.

Mobile 390 px : le patron « tableau → cartes empilées » (paires Date / Statut, « Modifier » en pleine
largeur), et « Nouvelle actualité » en pleine largeur 56 px.

### Écran 2 — Bureau : éditer une actualité

`<PreviewBar />` de s04 (68 px, fond `oklch(0.24 0.02 250)`) :

- **À gauche** : « ← Actualités », puis le statut en point + libellé.
- **À droite** : « Enregistrer le brouillon », « Aperçu » et le bouton principal contextuel. Il vaut
  « Publier l'actualité » pour un brouillon ou une actualité dépubliée, « Enregistrer et mettre à jour »
  pour une actualité publiée, et dans ce cas « Dépublier » s'ajoute à côté. L'erreur s'affiche en
  2ᵉ ligne de la barre.

Un **formulaire à une colonne** (`max-w-[68ch]`), précédé de la ligne `meta` en lecture seule
« Adresse sur le site : /actualites/… ». Quatre champs fixes, dans cet ordre :

1. **Titre**, avec aide ;
2. **Date**, un `input` de 48 px au format `jj/mm/aaaa` avec l'icône `Calendar`, pré-rempli à la date
   du jour ;
3. **Image — Facultatif** : `file-upload` avec les consignes « PNG, JPEG ou WebP, 5 Mo au plus. ». Une
   fois l'image déposée : aperçu, « Remplacer l'image » / « Retirer l'image », puis le champ **Texte
   alternatif**, obligatoire pour publier ;
4. **Contenu** : l'éditeur à barre réduite de s04 (six actions au-dessus d'un `textarea` de 12 lignes).

Quatre états sont montrés :

- **brouillon neuf** ;
- **modifications non enregistrées + échec**, avec l'alt manquant sur le champ : bordure `destructive`
  2 px et message ;
- **publiée**, avec le succès ancré (`CircleCheck` en `primary` sur fond `muted`, pas de vert) ;
- **`alert-dialog` de dépublication** : « Dépublier « … » ? Elle disparaît du site et de la liste des
  actualités. Son contenu est conservé : vous pourrez la republier. », avec « Annuler » et « Dépublier
  l'actualité ».

Mobile 390 px : `PreviewBar` à 104 px, avec le statut sur la première ligne et « Publier l'actualité »
en pleine largeur. « Enregistrer le brouillon » et « Aperçu » passent sous la barre. Champs à 56 px,
sans zone de dépôt.

### Écran 3 — Site public : liste des actualités (`/actualites`)

`h1` « Actualités » (34 px). La liste est verticale, en `max-w-[68ch]`, avec un filet entre les
éléments. Chaque élément se compose de :

- une vignette 4:3 d'environ 160 px à gauche, seulement si l'actualité a une image. Sans image, rien :
  ni cadre, ni illustration de repli ;
- la date en clair (« 2 septembre 2026 ») ;
- le titre en `h2` 26 px, qui est le lien ;
- « Lire l'actualité », en lien souligné.

Pagination « ← Précédent » / « Page 1 sur 3 » / « Suivant → ». États :

- **vide** : « Aucune actualité pour l'instant. », sans action ;
- **page 2** : « Précédent » actif.

Mobile 390 px : l'image passe en pleine largeur au-dessus de la date. Pagination en deux boutons
pleine largeur de 56 px.

### Écran 4 — Site public : page d'une actualité (`/actualites/{adresse}`)

Article en `max-w-[68ch]`, dans cet ordre :

- « ← Toutes les actualités » ;
- la date en clair ;
- le `h1` 34 px ;
- l'image en `<figure>`, hauteur plafonnée à 520 px, sans légende ;
- le contenu en 18 px / 1,65 (paragraphe, `h2`, liste, gras).

Deuxième planche, en mobile 390 px : l'**aperçu d'un brouillon par le bureau**, sans image. Il porte
l'encart `role="status"` (`accent` / `accent-foreground`) : « Aperçu — cette actualité est un
brouillon. Les visiteurs ne la voient pas. » Un visiteur, lui, reçoit la 404 existante, qui n'est pas
redessinée.

## Mockup

`docs/designs/s05-actualites.html` est la **référence visuelle**, normalisée depuis l'export Claude
Design :

- **Retiré** : le runtime du canevas (`support.js`, `<x-dc>`, gabarits `{{ }}`, `sc-for` / `sc-if`).
- **Remplacé** : les listes par leurs données fictives, les icônes lucide par des SVG en ligne (plus de
  CDN), la bascule clair / sombre par du JS natif (`data-theme` sur `#root`).
- **Vérifié avec jsdom** : cinq sections ancrées (`#ecran-0` à `#ecran-4`), la bascule change de thème,
  aucun gabarit résiduel. Le rendu dans Chromium n'a pas été vérifié, faute de bibliothèque système
  (`libnspr4`) dans le conteneur.

**NE PAS copier en production** : l'Execute construit l'écran avec les vrais composants du socle
(`table`, `badge`, `pagination`, `input`, `file-upload`, `progress`, `alert`, `alert-dialog`, `sheet`,
`skeleton`) et ceux de s04 (`<PreviewBar />`, `RestrictedMarkdownEditor`). La maquette a ses propres
styles en ligne : hauteurs de boutons de 44 px, couleurs de point de statut, rayon des cartes. Ils ne
remplacent pas les tokens et tailles du design system (voir « Écarts de la maquette »).

**Données fictives** :

- association « Les Amis de l'Étang », teinte 195 ;
- quatre actualités : « Assemblée générale du 10 octobre », « Travaux sur la canalisation du chemin des
  Pins », « Résultats de l'analyse d'eau de juillet » (sans image, Brouillon), « Fête de l'étang :
  merci à tous » (Dépubliée).

## Reused components (from the design system)

- **`button`** : un seul `default` par écran. « Dépublier l'actualité » est en `destructive` dans
  l'`alert-dialog`.
- **`table`, `badge`, `pagination`** : liste du bureau, et « tableau → cartes » sous 640 px.
- **`input`, `label`, `textarea`** : formulaire à une colonne, libellés au-dessus, « Facultatif » écrit.
- **`file-upload`** : zone de dépôt et bouton « Choisir un fichier », consignes avant l'échec, pas de
  zone au tactile.
- **`alert`** : succès neutre ancré. **`alert-dialog`** : dépublication.
- **`skeleton`** : chargement de la liste du bureau.
- **`sidebar`** : item « Actualités » actif.
- **Repris de s04, sans variante** :
  - `<PreviewBar />` (`src/components/ui/preview-bar.tsx`) ;
  - l'éditeur à barre réduite `RestrictedMarkdownEditor`
    (`src/components/features/pages/blocks/restricted-markdown-editor.tsx`) ;
  - l'encart d'aperçu public `role="status"` de `PublicCmsPage`.
- **Icônes** : `Megaphone` (vocabulaire figé « actualité »), `Calendar`, `Upload`, `CircleCheck`,
  `ArrowLeft`.

## States

**Écran 1** :

- vide (« Aucune actualité pour l'instant. → Écrire la première ») ;
- chargement (`skeleton`) ;
- succès, avec les trois statuts.

**Écran 2** :

- brouillon neuf ;
- `dirty` et `error` cumulés, avec l'erreur de champ sur le texte alternatif ;
- publiée, avec le succès ancré ;
- dépublication en `alert-dialog`.

Les six valeurs de `<PreviewBar />` ne sont pas toutes dessinées. La barre étant celle de s04, elle
les porte déjà.

**Écran 3** :

- succès avec une actualité sans image ;
- vide ;
- page 2.

Pas d'état de chargement ni d'erreur : le rendu est côté serveur.

**Écran 4** :

- article publié avec image ;
- aperçu d'un brouillon sans image, avec l'encart de statut.

## Écarts de la maquette au brief et au design system

Ils ne sont **pas à reproduire**. L'Execute suit le design system et les composants réels.

1. **Hauteurs de boutons** : 44 px en desktop dans la maquette. Le socle impose `default` 48 px, `sm`
   40 px, et 56 px pour les actions principales en mobile.
2. **Tailles de `h1`** : 28 px au bureau et 30 px pour la liste publique en mobile. Le token `h1` vaut
   34 px, et c'est lui qui s'applique.
3. **Corps d'article en mobile à 17 px** (planche d'aperçu de l'écran 4) : le texte public ne descend
   **jamais sous 18 px** (`body-lg`). Le `h2` du contenu, à 24 px, doit suivre le token `h2` (26 px).
4. **Couleurs hors tokens dans la barre d'aperçu** : fond rouge de la 2ᵉ ligne d'erreur, point ambre
   de « Modifications non enregistrées ». C'est le `<PreviewBar />` de s04 qui fait foi. Même chose pour
   les points de statut du `badge` : reprendre ceux de la liste des pages (s04), pas ceux de la maquette.
5. **Pagination du bureau** incohérente en page 1 sur 1 : « Précédent » paraît actif et « Suivant »
   désactivé. Les deux sont désactivés et annoncés.
6. **Formulaire mobile incomplet** : la planche mobile de l'écran 2 s'arrête au champ Image. Le champ
   Contenu et les aides sous les champs sont implicites : même formulaire qu'en desktop, champs à
   56 px.
7. **Téléversement en cours non dessiné** : `progress` indéterminée avec le nom du fichier, l'aperçu
   précédent restant visible (design system §2.1 et §3.2). À appliquer tel que le brief le décrit.
8. **Page d'actualité en mobile avec image non dessinée** : image en pleine largeur sans marge
   (design system §4, mobile).

## Design system gaps

Tous sont signalés, aucun n'est comblé ici :

1. **Vignette d'actualité de la liste publique** : proposée en 4:3, environ 160 px en desktop et en
   pleine largeur en mobile, annotée « à valider » sur la maquette. Aucun ratio n'est posé au design
   system. Tant que le design system n'est pas amendé, c'est une décision locale à s05, reprise comme
   proposition par s06 et s09 s'ils en ont besoin.
2. **Champ date** : le socle n'a pas de sélecteur de date. Proposition annotée : un `input` de 48 px au
   format `jj/mm/aaaa`, avec l'icône `Calendar`, **sans calendrier déroulant**. La saisie (`input`
   natif `type="date"` ou texte masqué) et sa validation restent à trancher au plan. Même besoin
   attendu en s09 (date d'analyse).
3. **Nombre d'actualités par page côté public** : la maquette en montre 10. Les règles de `pagination`
   (25 / 10) visent les tableaux du back-office. Constante d'affichage ou paramètre d'association
   (ADR 010, ADR 016) : à trancher au plan (question ouverte 6 de la recherche).

## Hypothèses de conception à confirmer au plan

- **Adresse fixée à la création**, affichée en lecture seule, **jamais recalculée** quand le titre
  change (URL stable, critère 2).
- **Image facultative**. Si une image est déposée, son texte alternatif devient obligatoire pour
  publier, pas pour enregistrer le brouillon (même règle que le bloc image de s04).
- **Date pré-remplie à aujourd'hui**, qui sert seulement au tri et à l'affichage. Pas de publication
  programmée.
- **Segment public `/actualites`** : à ajouter à `RESERVED_PAGE_SLUGS` dans le même commit (ADR 020),
  après avoir vérifié qu'aucune page existante ne porte déjà ce slug (recherche, piège 5).

## Ce que ce design ne couvre pas

- La suppression d'une actualité : hors critères, la dépublication suffit.
- Extrait, chapeau, catégorie, auteur, étiquettes, partage, commentaires.
- Le lien « Actualités » dans le menu du site : le menu (s04b) ne pointe que vers des pages.
- Un bloc « dernières actualités » sur l'accueil.
- L'envoi d'une actualité par email (s25).
- Les métadonnées SEO et l'image de partage (s11).
- L'en-tête et le pied du site public, la page 404, l'écran Pages : déjà livrés.
