# Design — Story s56-import-annuel-coordonnees

> Conçu le 2026-11-26, chemin **agent** (`/ks-design --agent`). Point de départ : le design de s13
> (`docs/designs/s13-import-initial-membres.md` + `.html`), adapté au back-office **de l'association**.
> Source visuelle unique : `docs/design-system.md`. Contexte de code : `docs/research/s56-import-annuel-coordonnees.md`.
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). Aucune version sombre.

Contrôle visuel : fait le 2026-11-26 à 1280 et 390 px (Chromium headless de Playwright ; aucun
débordement horizontal à 390 px, cadre mobile à 390 px ; deux passes de correction : largeur du cadre
mobile sous 480 px, deux espacements ramenés sur l'échelle).

## Périmètre du design

Deux écrans et un point d'entrée, en **ordinateur (1 280 px) et mobile (390 px)**. Données fictives :
association « Rives Vertes » (monogramme « RV », teinte 195), fichier `clients-pennylane-2026.csv`
(58 Ko), noms et adresses inventés (`@exemple.fr`). Route proposée :
**`/bureau/proprietaires/mise-a-jour`** (sous-route de « Propriétaires », tenant résolu par le domaine,
jamais un `organizationId` du formulaire — ADR 003).

| Écran | Où                                    | Planches                                                 |
| ----- | ------------------------------------- | -------------------------------------------------------- |
| 0     | `/bureau/proprietaires`               | 0a (bouton d'entrée, présidence seule)                   |
| 1     | `/bureau/proprietaires/mise-a-jour`   | 1a vide · 1b prêt · 1c chargement · 1d, 1e erreurs · 1f accès refusé |
| 2     | même route, après la mise à jour      | 2a rapport complet · 2b rien n'a changé · 2c aucune ligne utile · 2d chargement / échec |

## Screen(s)

### Écran 0 — Point d'entrée

Sur la liste des propriétaires (s12, inchangée), à côté de « Ajouter un propriétaire » (`default`,
existant), un bouton `outline` **« Mettre à jour les coordonnées »** (icône `Upload`), 48 px, pleine
largeur 56 px en mobile. **Rendu pour la présidence seule** (rôle lu du registre d'actions, Président(e)
par défaut) : un membre du Bureau ne le voit pas. Pas de nouvelle entrée de barre latérale : l'item
« Propriétaires » reste actif sur la sous-route.

### Écran 1 — Déposer le fichier

Fil d'Ariane « Propriétaires › Mettre à jour les coordonnées », `h1` « Mettre à jour les
coordonnées », phrase d'usage (« Déposez le fichier clients exporté de Pennylane. Les fiches existantes
sont mises à jour ; aucune fiche n'est créée. »). Colonne de 880 px max. Pas de carte « Association »
(différence avec s13 : le tenant vient du domaine).

1. **Carte « Fichier »** — « Fichier CSV (.csv) exporté de Pennylane, 16 Mo au plus. Une ligne par
   client. » `file-upload` : zone de dépôt + « Choisir un fichier » en ordinateur, **bouton seul** au
   tactile. Fichier choisi : icône `FileText`, nom en 600, poids en `data`, lien « Choisir un autre
   fichier ».
2. **Carte « Ce qui va se passer »** (fond `muted`) — cinq puces : rapprochement par l'identifiant client
   Pennylane, ligne inconnue non créée et listée « à créer à la main » ; domicile, terrain, téléphone et
   adresses email mis à jour, valeur modifiée sur le site gardée et signalée ; titulaire remplacée → le
   propriétaire se connecte avec la nouvelle, adresses ajoutées sur le site conservées ; propriété des
   parcelles inchangée ; aucun email envoyé, relancer le même fichier ne change rien.
3. **Action** — un seul `default` « Mettre à jour les fiches » (256 px mini) + lien « Annuler » (retour à
   la liste). Sans fichier : bouton désactivé et phrase « Choisissez un fichier pour continuer. »

### Écran 2 — Lire le rapport (éphémère, ADR 047)

`h1` « Rapport de mise à jour », ligne `meta` : nom du fichier (`data`) · association · date et heure
(`data`). Puis, dans l'ordre :

- **Bandeau de résultat** — `alert` neutre `CircleCheck`, `role="status"` : « Mise à jour terminée :
  212 fiches mises à jour. » + « 12 points à vérifier et 4 membres à créer à la main, détaillés
  ci-dessous. »
- **Mention de confidentialité** (`Lock` 16 px, `meta`) — texte de s13 : rapport non conservé.
- **Carte « Bilan »** — compteur `dl` (§3.13, quatre colonnes, une paire par ligne sous 640 px) : Lignes
  lues · Fiches mises à jour · Fiches inchangées · Membres à créer à la main · Lignes rejetées ; filet ;
  « À vérifier » : Valeurs conservées · Titulaires remplacées · Titulaires désignées par le site ·
  Adresses plus actives. (Lignes lues = mises à jour + inchangées + à créer + rejetées.)
- **Sept cartes de section**, titre `h3` + décompte en `data` entre parenthèses, phrase d'usage, tableau
  (§2.1 ; 25 lignes par page, 10 sous 640 px, « Précédent / Suivant » écrits ; cartes empilées sous
  640 px, §3.5). Chaque nom de fiche est **un lien vers la fiche** — aucune autre action par ligne :
  1. **Fiches mises à jour** — Fiche · Mis à jour (« Domicile, terrain », « Téléphone », « Adresses email »).
  2. **Valeurs conservées, modifiées sur le site** — Fiche · Donnée · Gardée (site) · Dans le fichier.
     « … le fichier ne les a pas remplacées. Si le fichier a raison, corrigez la fiche. »
  3. **Adresses titulaires remplacées** — Fiche · Ancienne titulaire · Nouvelle titulaire. « Le
     propriétaire se connecte désormais avec la nouvelle adresse. L'ancienne n'est plus active. »
  4. **Titulaires désignées par le site** — Fiche · Ancienne titulaire · Nouvelle titulaire. « … Vérifiez
     ce choix avec les personnes concernées ; vous pouvez désigner une autre titulaire depuis la fiche. »
     Sans autre adresse active : « Aucune adresse active » + `badge` « Courrier uniquement » (s12).
  5. **Adresses qui ne sont plus actives** — Fiche · Adresse (supplémentaires venues d'un fichier
     précédent ; les titulaires sont dans 3 et 4). « Les adresses ajoutées sur le site restent actives. »
  6. **Membres à créer à la main** — Ligne · Identifiant client · Client ; consigne : ajouter le
     propriétaire puis saisir son identifiant Pennylane sur la fiche (s20) ; un bouton `outline` « Ajouter
     un propriétaire » pour la section (pas par ligne).
  7. **Lignes rejetées** — Ligne · Client · Motif (motifs de s13 : `AdminMemberImport.report.reasons`).
- **Actions** — « Retour aux propriétaires » (`default`) · « Importer un autre fichier » (`outline`,
  `Upload`). Pleine largeur 56 px empilées en mobile.

Une section vide se réduit à son titre « (0) » et une ligne en `muted-foreground` (« Aucune valeur
conservée. »), sans tableau.

## Mockup

`docs/designs/s56-import-annuel-coordonnees.html` — référence visuelle, 11 planches (0a, 1a–1f,
2a–2d), chacune en cadre bureau puis cadre mobile 390 px. **Ne pas copier en production** : l'exécution
construit l'écran avec les vrais composants du socle et réutilise ceux de s13
(`src/components/features/admin/member-import/`) là où ils conviennent.

## Reused components (from the design system)

- `sidebar`, `breadcrumb`, `card` — back-office de l'association ; « Propriétaires » actif (fond
  `sidebar-accent` + 600) ; tiroir sous `lg`.
- `file-upload` — zone de dépôt + bouton, zone masquée au tactile ; types et poids annoncés avant l'échec.
- `button` — un seul `default` par écran ; `outline` ailleurs ; chargement « Mise à jour en cours… »,
  désactivé, largeur conservée.
- `alert` — succès neutre `CircleCheck` (`role="status"`) ; erreur `destructive` 2 px `AlertTriangle`
  (`role="alert"`).
- `progress` indéterminée + nom du fichier (§2.1) ; `skeleton` sur le chargement du rapport seulement.
- Compteur `dl` (§3.13) pour le bilan — pas de cartes « statistique » (s13 en avait six : ici le §3.13
  fait foi).
- `table`, `pagination`, `badge` (« Courrier uniquement ») ; cartes empilées sous 640 px (§3.5).
- Accès refusé : forme de s12d (C4) / `BureauAccessDenied` — `h1`, phrase, bouton `outline` `ArrowLeft`.
- `<AssociationMark />` dans la barre latérale et l'en-tête mobile.

## States

- **Vide** — 1a : aucun fichier, bouton désactivé + phrase.
- **Chargement** — 1c : formulaire figé, `progress` indéterminée « Mise à jour depuis
  clients-pennylane-2026.csv en cours… », bouton « Mise à jour en cours… ». 2d : `skeleton` du rapport.
- **Erreur** — 1d fichier illisible (messages du lecteur de s13, ex. « Il manque la colonne
  « Identifiant Client ». » + « Aucune fiche n'a été modifiée. ») · 1e arrêt en cours (« Les fiches déjà
  traitées sont à jour. Relancez le même fichier pour terminer : ce qui est déjà fait ne changera pas. »
  + « Réessayer », `RefreshCw`) · 2c aucune ligne utile (toutes inconnues ou rejetées : `alert`
  `destructive` « Aucune fiche n'a été mise à jour. », les sections 6 et 7 restent) · 2d échec
  d'affichage (« La mise à jour, elle, est terminée… »).
- **Succès** — 2a rapport avec tous les cas · 2b **réimport du même fichier** : « Rien n'a changé : les
  fiches ont déjà les coordonnées de ce fichier. », sections 1 à 5 à « (0) », sections 6 et 7 toujours
  listées (elles le sont encore).
- **Accès refusé** — 1f : membre du Bureau qui n'est pas la présidence, dans le back-office (le layout
  laisse passer le Bureau) : « Cette page ne vous est pas accessible » + « La mise à jour des coordonnées
  depuis le fichier de l'année est réservée à la présidence de l'association. Pour corriger une fiche,
  ouvrez-la depuis la liste des propriétaires. » + « Revenir aux propriétaires ». Aucune donnée. La garde
  vit aussi côté serveur (service et action).

## Design system gaps

Besoins non couverts, **non inventés ici** :

1. **Notifications du back-office** (critère 4 : chaque désignation notifiée « au rapport et dans les
   notifications du back-office, sans email ») — aucune surface n'existe (table `notifications` sans
   tenant, avec email, sans écran ; recherche Q7). Le rapport est dessiné ; **la surface de
   notification ne l'est pas** : forme (encart du tableau de bord, liste sur la fiche, page dédiée) et
   persistance de données personnelles à arbitrer avant le plan (s58 en dépend).
2. **Badge « Désactivée par l'import »** (§9, s42b/s56) — forme `outline` proposée, non tranchée. Le
   rapport n'en a pas besoin ; l'affichage d'une adresse désactivée **sur la fiche** (s54) en dépend si
   la désactivation conserve la ligne (recherche Q4).
3. **Bouton d'entrée réservé à un rôle** — le design system ne décrit pas une action visible selon le
   rôle dans une page partagée par Bureau et Présidence ; retenu : bouton masqué au Bureau + accès refusé
   (1f) si l'URL est ouverte. Le libellé « présidence » de 1f est à tirer du registre d'actions si le rôle
   par défaut est changé.
4. **Accès refusé dans le back-office** — `BureauAccessDenied` est rendu **sans** barre latérale (refus de
   tout l'espace) ; ici le refus porte sur une page, barre latérale conservée. Forme composée de s12d,
   à inscrire au §3 si retenue.
5. **Bouton désactivé** — pas de token (même manque que s13) : état `disabled` du composant `button`.
6. **Colonne « Donnée » / valeurs postales longues** dans « Valeurs conservées » : une adresse postale
   complète tient sur deux lignes dans une cellule de 56 px (hauteur qui croît) — accepté, à confirmer.

**Points à trancher au plan** (choix de produit, pas des manques du système) :

- Route (`/bureau/proprietaires/mise-a-jour`) et `matchesSubroutes` de l'item « Propriétaires ».
- Afficher la date du dernier import sur l'écran 1 (utile, mais dépend du support de « dernier import »,
  recherche Q2) — non dessinée.
- Granularité de « Mis à jour » (section 1) : par groupe (Domicile, Terrain, Téléphone, Adresses email)
  comme maquetté, ou par champ.
- Refus d'une désactivation d'adresse d'un membre du Bureau sur sa dernière fiche
  (`board_email_required`, recherche Q9) : s'il est rapporté, il prend la forme d'une ligne de la
  section 7 ou d'une section dédiée — non dessiné.
- L'écran SuperAdmin de s13 reste la voie de création ; cette page ne crée rien.
