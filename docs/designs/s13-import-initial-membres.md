# Design — Story s13-import-initial-membres

> Conçu le 2026-11-08, chemin **Claude Design** : brief `docs/designs/s13-import-initial-membres-brief.md`,
> livraison rapportée par Marie-Ève le 2026-11-08 (export `S13 Import Initial Members.zip`, fichier
> `s13-import-initial-membres.dc.html`), puis figée ici. Canevas :
> `https://claude.ai/design/p/1d7323b2-ed78-47a3-9114-2e1070683907?file=s13-import-initial-membres.dc.html`.
> Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s13-import-initial-membres.md`.
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). Aucune version sombre
> n'a été dessinée, volontairement.

## Périmètre du design

Deux écrans et un point d'entrée, en **ordinateur (1 280 px) et mobile (390 px)**, thème clair seul.
Données fictives : association « Rives Vertes » (monogramme « RV », teinte 195), fichier
`proprietaires-rives-vertes.csv` (62 Ko), noms inventés. Back-office SuperAdmin, route
`/admin/membres-import`.

| Écran | Route                    | Planches                                    |
| ----- | ------------------------ | ------------------------------------------- |
| 0     | fiche de l'association   | 0a (carte « Membres »)                      |
| 1     | `/admin/membres-import`  | 1a à 1f : vide, prêt, chargement, 3 erreurs |
| 2     | même route, après import | 2a à 2f : voir États                        |

## Screen(s)

### Écran 0 — Point d'entrée depuis la fiche de l'association

Sur la fiche de l'association, une carte **« Membres »** (titre `h3` 20 px) : « Aucun membre pour
l'instant. » et un bouton `outline` « Importer des membres » (icône `Upload`), 48 px en ordinateur,
pleine largeur 56 px en mobile. Le bouton ouvre l'écran 1 avec **l'association déjà choisie**. Dans la
barre latérale du back-office, une entrée « Importer des membres » ouvre le même écran sans association.

### Écran 1 — Déposer le fichier

Colonne de 720 px maximum, trois cartes empilées (24 px) puis l'action :

1. **« 1 · Association »** — liste déroulante (`select`, 48 px, 56 px mobile), libellé « Association »,
   aide « Les membres seront créés dans cette association. »
2. **« 2 · Fichier »** — « Fichier CSV (.csv), 16 Mo au plus. Une ligne par client. » Zone de dépôt
   pointillée + « Choisir un fichier » en ordinateur ; **seul le bouton** « Choisir un fichier » (icône
   `Upload`, 56 px) au tactile. Fichier choisi : icône, nom (600), poids en mono, lien « Choisir un autre
   fichier ».
3. **« Ce qui va se passer »** (fond `muted`) — quatre puces : une ligne devient un membre avec sa ou ses
   parcelles et plusieurs lignes du même propriétaire donnent un seul membre ; une ligne sans adresse
   postale ni email est ignorée et apparaît au rapport ; une ligne sans email crée un membre sans compte,
   joint par courrier ; aucun email n'est envoyé, relancer le même fichier ne crée rien en double.

**Action** : un seul bouton `default` « Importer les membres » (256 px mini), et le lien « Annuler » vers
la fiche. Tant que l'association ou le fichier manque, le bouton est désactivé et une phrase le dit en
dessous : « Choisissez une association et un fichier pour continuer. »

### Écran 2 — Lire le rapport

Même route, après l'import. `h1` « Rapport d'import », puis une ligne : nom du fichier · association ·
date et heure (mono). Dans l'ordre :

- **Bandeau de résultat** : `alert` neutre (`CircleCheck`, `role="status"`) en cas de succès,
  `destructive` quand rien n'a été importé ou que la page échoue.
- **« Bilan »** — six cartes (grille 3 colonnes, 2 en mobile), valeur en mono : lignes lues · membres
  créés · comptes de connexion ouverts · membres « courrier uniquement » · parcelles rattachées · lignes
  rejetées. Si le fichier a déjà été importé : ligne pleine largeur « Déjà présents : N membres,
  inchangés. »
- **« Lignes rejetées »** — mention de confidentialité (icône `Lock`, 15 px) : « Ce rapport contient des
  données personnelles. Il n'est pas conservé : en quittant cette page, vous ne le retrouvez qu'en
  relançant le même fichier. » puis un tableau **Ligne · Client · Motif** (25 par page, zébré), ou
  « Aucune ligne rejetée. »
- **« Lignes importées avec une remarque »** — même tableau, colonne **Remarque** : « Ces lignes ont été
  importées. Vérifiez-les si besoin. »
- Actions : « Retour à l'association » (`default`) et « Importer un autre fichier » (`outline`, icône
  `Upload`).

**Mobile (390 px)** : le tableau devient des cartes empilées (« Ligne N », client en 600, motif), 10 par
page, « Précédent / Suivant » sur deux colonnes de 48 px ; actions pleines largeur 56 px.

**Motifs de rejet maquettés** : ni adresse postale ni email ; email déjà utilisé par un autre membre ; code
postal non valide ; nom manquant. **Remarques maquettées** : plusieurs emails (seul le premier gardé) ; code
postal complété d'un zéro.

## Mockup

`docs/designs/s13-import-initial-membres.html` — référence visuelle, figée depuis l'export du canevas
(moteur `support.js` retiré, données déroulées ; les 13 planches 0a, 1a–1f et 2a–2f y sont). **Ne pas
copier en production** : l'exécution construit l'écran avec les vrais composants du socle. L'archive de la
livraison est conservée à côté : `docs/designs/S13 Import Initial Members.zip`.

## Reused components (from the design system)

- `card`, `breadcrumb`, `sidebar` — structure du back-office ; item actif = fond `sidebar-accent` et
  libellé en 600 (§ 2.1).
- `select`, `label` — choix de l'association, 48 px (56 px mobile).
- `file-upload` — zone de dépôt **et** bouton ; masquée au tactile (`pointer: coarse`) ; types et poids
  annoncés avant l'échec.
- `button` — `default` pour « Importer les membres » et « Retour à l'association » (un seul `default` par
  écran), `outline` ailleurs ; chargement = libellé remplacé « Import en cours… », désactivé, largeur
  conservée.
- `alert` — erreurs `destructive` (`role="alert"`, filet 2 px, `AlertTriangle`) ; résultat neutre
  (`role="status"`, `CircleCheck`).
- `progress` — barre **indéterminée** avec le nom du fichier, sans pourcentage inventé (§ 2.1).
- `table`, `pagination` — rapport : lignes 56 px, en-tête sur `muted`, zébrure, 25 par page (10 sous
  640 px), « Précédent / Suivant » écrits ; cartes empilées sous 640 px (§ 3.5).
- `skeleton` — chargement du rapport (2e), seulement sur ce chargement.
- `<AssociationMark />` — monogramme de l'association dans l'en-tête de la fiche (0a).

## States

- **Écran 1** : 1a vide (aucune association, aucun fichier) · 1b prêt (arrivée depuis la fiche) · 1c
  chargement (formulaire figé, barre indéterminée) · 1d fichier illisible (cause en clair, « Rien n'a été
  importé. ») · 1e association disparue · 1f erreur inattendue (« Les lignes déjà traitées sont
  enregistrées ; relancer le même fichier termine le travail sans rien doubler. » + « Réessayer »).
- **Écran 2** : 2a avec rejets et remarques · 2b sans rejet · 2c relance du même fichier (« Rien de
  nouveau : ce fichier avait déjà été importé. ») · 2d tout rejeté (`alert` `destructive`) · 2e chargement
  du rapport · 2f erreur de page (« Le rapport n'a pas pu s'afficher. L'import, lui, est terminé. »).

## Design system gaps

Relevés par le canevas et résolus **par le design system ou l'existant**, sans rien inventer :

1. **Item actif de la barre latérale** : le canevas l'a rendu sur `muted` faute de token ; le design system
   le définit (`sidebar-accent` + libellé en 600). On suit le design system.
2. **État désactivé du bouton** : pas de token ; on garde l'état `disabled` du composant `button`.
3. **Accent de l'association** : le canevas a supposé L 0,55 / C 0,09 ; on suit le mécanisme de l'accent
   du design system (§ 1.2), pas la valeur supposée.
4. **Zone de dépôt** : bordure pointillée et fond `muted` inventés par le canevas ; on suit le composant
   `file-upload` du design system.
5. **`progress` indéterminée et `skeleton`** : couleurs non données ; on suit les conventions du § 2.1.
6. **Tailles de `h1`/`h2` en mobile** : non spécifiées, conservées à 34 / 26 px.
7. **« Déjà présents »** : ligne pleine largeur sous la grille plutôt qu'une septième carte — gardé.

**Points à trancher au plan** (choix de produit du canevas, pas des manques du système) :

- **2c** : la section « remarques » est masquée à la relance, puisque rien n'a été importé — à confirmer.
- **« N lignes à relire »** compte les seules lignes rejetées, pas les remarques — à confirmer.
- **2d** : « Ces lignes n'ont pas été importées. Les autres l'ont été. » serait faux quand tout est
  rejeté ; la variante « Aucune ligne n'a été importée. » est retenue.
- **Rapport non conservé et non téléchargeable** (brief) : tranche la question 8 de la recherche si
  l'utilisatrice le valide ; l'historique des imports reste hors de cette story.
- **Entrée « Importer des membres » dans la barre latérale** : à poser dans la barre latérale du
  back-office existante ; sa place exacte est à vérifier dans le code au plan.

Écarts acceptés : barre latérale, en-tête « Zourite Studio » et fiche de l'association schématiques
(existants, non redessinés) ; livraison en `.dc.html`, figée ici en `.html`.
