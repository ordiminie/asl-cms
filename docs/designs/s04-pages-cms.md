# Design — Story s04-pages-cms

> Conçu le 2026-09-21, chemin **Claude Design** : brief `docs/designs/s04-pages-cms-brief.md`, canevas
> `https://claude.ai/design/p/75c678c8-9be1-4042-96d6-40d2b13d9b09`, **validé par Marie-Ève le 2026-09-21**
> (ordinateur et mobile, clair et sombre), puis reporté ici. Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s04-pages-cms.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                               | Où                                                                            |
| ------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1       | Créer une page (titre, slug, contenu riche, images), rendue en public une fois publiée         | **Écran 2** (éditeur) → **Écran 4** (rendu public)                            |
| 2       | Brouillon non accessible publiquement, prévisualisable par le bureau                           | **Écran 1** (badge Brouillon) + **Écran 2** (bouton Aperçu)                   |
| 3       | Dépublier retire sans supprimer ; republier restaure à l'identique                             | **Écran 2** (`alert-dialog` de dépublication) + **Écran 1** (badge Dépubliée) |
| 4       | Image insérée → stockée et affichée en public                                                  | **Écran 2** (bloc Image + légende) → **Écran 4** (figure/figcaption)          |
| 5       | Slug déjà utilisé refusé avec message de champ                                                 | **Écran 2** (panneau Paramètres)                                              |
| 6       | Membre non-bureau ne peut ni créer ni modifier                                                 | _non dessinable_ (autorisation, pas d'écran)                                  |
| 7       | Page = liste ordonnée de blocs typés, insertion à un rang, réordonnancement respecté en public | **Écran 2** (`SortableList` + `BlockPicker`) → **Écran 4** (ordre rendu)      |
| 8       | Réordonnancement atteignable au clavier seul                                                   | **Écran 2** (boutons Monter/Descendre toujours visibles, desktop et mobile)   |
| 9       | Type de bloc inconnu n'affiché pas le rendu, ignoré et signalé au bureau                       | **Écran 2** (bloc 6 grisé « Type de bloc inconnu »)                           |

## Screen(s)

Repère de continuité (non redessiné en écran séparé) : la sidebar du back-office gagne le groupe
**« Le site »** au-dessus de **« L'association »**, avec l'entrée **« Pages »** active — visible dans
l'écran 1.

### Écran 1 — Liste des pages

`card` pleine largeur, `h1` « Pages » + bouton `default` « Nouvelle page », `table` (Titre + slug en
`meta`, Statut en `badge` à point coloré + libellé écrit — Publiée / Brouillon / Dépubliée —, Dernière
modification, Actions avec un seul lien « Modifier »). États : vide (« Aucune page pour l'instant. →
Créer la première »), chargement (`skeleton` sur les lignes), succès (3 lignes montrant les trois
statuts). Mobile 390 px : patron « tableau → cartes » du design system, bouton « Nouvelle page » et
« Modifier » pleine largeur 56 px.

### Écran 2 — Éditeur de page (P0)

`<PreviewBar />` sticky (68 px desktop / 104 px mobile), fond `oklch(0.24 0.02 250)` hors palette de
contenu : retour vers l'écran 1, badge de statut à point + libellé écrit, actions à droite
(« Enregistrer le brouillon », « Aperçu », bouton `default` contextuel « Publier la page »). L'écran
montre le statut `dirty` (« Modifications non enregistrées ») cumulé à l'état `error` en 2ᵉ ligne
(« Échec de la publication… Rien n'est perdu »).

Colonne de blocs — `<SortableList />` + `<BlockPicker />` — avec les 6 gabarits : Texte riche
(éditeur à barre réduite, composant neuf — voir « Reused components »), Image + légende (zone de dépôt, alt obligatoire signalé, légende
facultative écrite en clair), Document PDF **incomplet** (`alert` ancrée dans le bloc + zone de dépôt +
titre obligatoire), Galerie (grille de vignettes avec alt par image), Encart (aperçu teinté
`accent`/`accent-foreground` in situ), et un bloc de **type inconnu** grisé, sans édition possible,
seul « Supprimer le bloc » disponible. Chaque bloc porte poignée + pastille de rang écrite (« 2 SUR
6 ») + Monter/Descendre toujours visibles (premier bloc : Monter visible et désactivé) + Supprimer.
Annonce `aria-live` et bande d'annulation 10 s montrées.

Panneau « Paramètres » (296 px, `sheet` sous `xl`) : Titre, Slug avec préfixe `/` — état d'erreur montré
(bordure `destructive` 2 px + « Ce slug est déjà utilisé par une autre page »). `alert-dialog` de
dépublication : « Dépublier « Qualité de l'eau » ? » avec les deux actions symétriques.

Mobile 390 px : `PreviewBar` à 104 px avec bouton « Paramètres de la page » ouvrant le panneau en
`sheet` ; même mécanique de blocs, boutons Monter/Descendre conservés (pas de glisser-déposer attendu
au tactile).

### Écran 3 — `<BlockPicker />` ouvert

Zoom desktop (`popover` ancré au séparateur cliqué, recherche facultative en tête, 5 lignes nom +
phrase d'usage + aperçu miniature 60×40) et mobile (`sheet` bas d'écran, mêmes 5 lignes, cibles 56 px).

### Écran 4 — Rendu public d'une page publiée

Corps de page seul (en-tête/pied publics non redessinés) : Texte riche (`h1`/`h2`/paragraphes
`body-lg` 18 px/liste/lien), Image + légende (`figure`/`figcaption`, hauteur plafonnée 520 px), Galerie
(grille 3 colonnes, tuile de report « + 7 »), Encart (`accent-foreground` sur `accent`, sans bouton).
Planche séparée : `dialog` de galerie à l'ouverture avec « ← Précédente » / « Suivante → » écrits.
Mobile 390 px : Image et Galerie pleine largeur, galerie en une colonne (report après deux photos),
bloc PDF en bouton pleine largeur sous son titre — **seule la version mobile montre le bloc PDF** (voir
gaps ci-dessous).

## Mockup

`docs/designs/s04-pages-cms.html` — référence visuelle, normalisée depuis l'export Claude Design
(support.js / `<x-dc>` retirés, bascule clair-sombre réécrite en JS natif, aucune dépendance externe
au runtime du canevas). 4 sections ancrées (`#s1`–`#s4`), desktop et mobile 390 px, bascule clair/sombre
en tête de page. **NE PAS copier en production** : l'Execute construit l'écran avec les vrais
composants du socle (`table`, `badge`, `alert-dialog`, `sheet`, `textarea`, `file-upload`,
`skeleton`) et les trois composants P0 (`<PreviewBar />`, `<SortableList />`, `<BlockPicker />`) tels
que spécifiés dans le brief — aucun ne doit être réinventé au-delà de cette spec. Données fictives :
« Les Amis de l'Étang », pages « Qualité de l'eau » / « Adhérer à l'association » / « Fête de l'étang
2025 ».

## Reused components (from the design system)

- `button` (un seul `default` par écran), `table`/`badge`, `alert`/`alert-dialog`/`sheet`,
  `input`/`textarea`, `sidebar` (groupe « Le site » ajouté), `file-upload`, `skeleton` (liste
  seulement).
- **Nouveaux composants P0 construits par cette story**, entièrement spécifiés dans le brief — aucun
  n'est inventé au-delà : `<PreviewBar />`, `<SortableList />`, `<BlockPicker />`.
- **Éditeur du bloc texte riche — composant neuf, local à la story**, et non le `markdown-editor`
  (Milkdown) du socle comme l'annonçait la première version de ce document :
  `src/components/features/pages/blocks/restricted-markdown-editor.tsx`, un `textarea` surmonté des
  six seules actions de la barre réduite (gras, italique, titre 2, titre 3, liste, lien). Raison en
  ADR 019 : la barre GFM de Milkdown produit du markup (tableaux, code) que la sanitisation du rendu
  public retire **sans le dire**, ce qui donnerait au bureau un WYSIWYG dont la mise en forme
  disparaît à la publication. Ce n'est **pas un P0 du design system** : c'est un détail
  d'implémentation local. Le promouvoir au catalogue de `docs/design-system.md` demanderait sa propre
  décision de design system, hors périmètre de s04.

## States

**Écran 1** : vide / chargement (`skeleton`) / succès avec les trois statuts (Publiée, Brouillon,
Dépubliée).

**Écran 2 — `<PreviewBar />`** : `dirty` et `error` montrés simultanément (le cas qui cumule le plus de
contraintes visuelles) ; `live` visible en tête de la version mobile. `draft`, `publishing` et
`unpublished` ne sont **pas** dessinés comme variantes séparées de la barre — seuls leurs équivalents en
`badge` figurent sur l'écran 1. À la charge de l'Execute de vérifier que les 6 valeurs de statut
partagent la même forme (point + libellé écrit), pas seulement les 2 montrées ici.

**Bloc incomplet** : Document PDF sans fichier (`alert` ancrée dans le bloc, deux actions). **Bloc
inconnu** : ligne grisée, action unique. **Dépublication** : `alert-dialog` avec ses deux issues.

**Écran 4** : galerie au-delà de 6 vignettes (tuile de report), `dialog` de navigation à l'ouverture. Le
critère 9 (« bloc incomplet omis du rendu public ») est documenté par une légende texte plutôt que par
une capture montrant réellement un bloc absent de la séquence — voir gaps.

## Design system gaps

Reportés du brief, toujours ouverts après ce design (signalés, pas comblés ici) :

1. **Visionneuse de galerie complète** (§9) — seule l'ouverture du `dialog` avec
   Précédente/Suivante est montrée ; la mécanique de navigation interne (compteur, boucle en fin de
   liste) reste à spécifier.
2. **Échelle de `z-index` globale** (partagé s07/s41) — la maquette n'empile jamais `<PreviewBar />` et
   `<BlockPicker />` en même temps ; l'ordre réel de superposition reste à trancher pour l'Execute.
3. **Rendu public du bloc PDF en desktop** — seule la version mobile de l'écran 4 montre ce bloc ; la
   version desktop ne le dessine pas explicitement (gabarit identique attendu — bouton + titre — mais
   non illustré à cette largeur).
4. **Bloc incomplet omis du rendu public** — illustré par une légende texte, pas par une capture où un
   bloc manque effectivement à la suite des autres (demandé par le brief). Comportement inchangé :
   simplement à vérifier visuellement une fois l'écran construit.

## Ce que ce design ne couvre pas

- La navigation du site public (menu, pied de page) — story s04b.
- Actualités, fiches du bureau, analyses d'eau — modèles à champs fixes, stories s05/s06/s09.
- La suppression définitive d'une page — hors critères de cette story.
- Tout réglage d'association (teinte, adresses) — déjà livré par s02.
