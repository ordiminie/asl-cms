# Design — Story s24-notes-internes-membre

> Conçu le 2026-11-09 par le chemin **Claude Design**, à partir du brief
> `docs/designs/s24-notes-internes-membre-brief.md` (reçu tel quel par le canevas : le fichier
> `uploads/` de l'export est identique au brief du dépôt, vérifié octet pour octet).
>
> - **Canevas** :
>   <https://claude.ai/design/p/5870d9da-9c84-4046-bda3-8d2ccda6e6e8?file=s24+Notes+et+%C3%A9changes.dc.html>
> - **Export du canevas** : `docs/designs/S24 notes.zip`, remis par Marie-Ève le 2026-11-09
>   (fichier **non suivi par git**, comme `s22.zip` : les zips de design sont retirés du dépôt).
> - **Validé** : 2026-11-09, par Marie-Ève (elle a ouvert le canevas et rapporté l'export).
> - **Normalisé le même jour** en `docs/designs/s24-notes-internes-membre.html` : la source
>   `.dc.html` dépend du moteur de gabarits de Claude Design (`support.js`, absent du dépôt). Aucun
>   navigateur n'étant disponible dans l'environnement, les `sc-for` / `sc-if` ont été déroulés par un
>   script Node sur le gabarit, sans toucher au contenu ni aux styles ; les icônes sont les SVG du
>   canevas. Une page statique, thème clair seul, à ouvrir au navigateur.
> - **Source visuelle unique** : `docs/design-system.md`. **Contexte de code** :
>   `docs/research/s24-notes-internes-membre.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                        | Où                                                                     |
| ------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1       | Note datée et signée, retrouvée à la consultation suivante              | États **d** (formulaire), **h** (succès), **a** (fil)                  |
| 2       | Échange : date, canal, résumé                                           | État **e** (formulaire), **f** (erreurs)                               |
| 3       | Un fil unique ; auteur, date et type par entrée                         | États **a**, **l** (badge de type, date, « Écrit par »)                |
| 4       | Aucun accès côté membre                                                 | _non dessinable_ : aucun écran n'existe côté membre (test, pas écran)  |
| 5       | Modifier / supprimer ; auteur et date de dernière modification visibles | États **i** (modification), **j** (suppression), mention « Modifiée le » en **a** |

## Screen(s)

Un seul écran : **la fiche d'un propriétaire** (`/bureau/proprietaires/{id}`), avec **une cinquième `card`
« Notes et échanges »** placée **après « Parcelles »**. Les quatre cartes existantes (Coordonnées, Accès à
l'espace membre, Rôle dans l'association, Parcelles) sont **schématiques** dans la maquette : leur
contenu n'est pas à reprendre. Idem pour la barre latérale et les badges d'en-tête (« Propriétaire
actuel », « Espace membre activé ») : ce sont des repères de la maquette, pas ceux de la fiche réelle
(« Courrier uniquement », « Fiche incomplète »).

### La carte « Notes et échanges »

- **En-tête** : `h2` « Notes et échanges » (Source Serif 4, 24 px) ; dessous, en `meta` /
  `muted-foreground`, **sans icône** : « Visible du bureau seulement. Le propriétaire ne les voit pas. »
- **Deux boutons `outline`** côte à côte (empilés, pleine largeur, 56 px en mobile) : « Ajouter une
  note » et « Consigner un échange ».
- **Formulaire d'ajout, en place**, en tête de carte, au-dessus du fil (comme « Modifier les
  coordonnées ») :
  - **Note** : un `textarea` « Note » (4 lignes) + compteur `meta` aligné à droite ; « Enregistrer la
    note » (`default`) / « Annuler » (`outline`).
  - **Échange** : « Date de l'échange » (champ date §3.9, pré-rempli à aujourd'hui, aide « Au format
    jj/mm/aaaa. » sous le libellé, largeur plafonnée à 240 px), « Canal » (`select` : « Choisissez un
    canal », Téléphone, Courrier, En personne, Email), « Résumé » (`textarea` + compteur) ;
    « Enregistrer l'échange » / « Annuler ».
- **Le fil** — une seule liste ordonnée (`ol`), notes et échanges mêlés, **du plus récent au plus
  ancien**, une entrée = un bloc séparé par un filet `border` 1 px (aucune carte imbriquée, aucune
  ombre) :
  1. ligne d'identité : badge **« Note »** (`outline`) ou **« Échange »** (`secondary`) suivi du **canal
     écrit** (« · Téléphone ») ; la date en `data` : `jj/mm/aaaa hh:mm` pour une note (instant de
     saisie), `jj/mm/aaaa` pour un échange (le jour choisi) ;
  2. le texte, `body` 17 px, retours à la ligne conservés (`white-space: pre-wrap`) ;
  3. la signature, `meta` : « Écrit par Marie Delorme », puis, si l'entrée a été modifiée,
     « · Modifiée le 04/11/2026 à 14:32 » (date et heure en `data`) ;
  4. deux liens écrits, sans icône : « Modifier », « Supprimer » (44 px de cible, 56 px en mobile),
     avec un nom accessible typé (« Modifier la note du 14/09/2026 »).
- **Modifier** : le bloc se transforme **en place** en formulaire pré-rempli (bordure de focus 2 px
  `--ring`), « Enregistrer les modifications » / « Annuler » ; la ligne d'identité et la signature
  restent telles qu'avant l'enregistrement.
- **Supprimer** : `alert-dialog`, 512 px de large, voile `--overlay`, `rounded-lg`, `shadow-lg` ;
  « Supprimer cette note ? » — « Note écrite par Marie Delorme le 14/09/2026. Elle sera effacée de la
  fiche. » — « Garder la note » (`outline`) puis « Supprimer la note » (`destructive`, nomme l'acte). En
  mobile : ancré en bas, pleine largeur, boutons 56 px empilés.
- **Pagination** : « Précédent » (désactivé en page 1, écrit) · « Page 1 sur 3 » · « Suivant ».

## Mockup

`docs/designs/s24-notes-internes-membre.html` — référence visuelle, états **a** à **l**, chacun en
bureau (1 280 px) et en mobile (390 px) ; l'état **m** du brief est porté par les colonnes mobiles des
états a, d, e, i et j. **NE PAS copier en production** : l'Execute construit l'écran avec les vrais
composants (`DetailCard`, `Button`, `Badge`, `Textarea`, `Select`, `DateField`, `AlertDialog`, `Alert`,
`Skeleton`, `Pagination`).

## Reused components (from the design system)

- **`DetailCard`** (`src/components/features/member-profile/member-profile-detail-card.tsx`) — le cadre
  de la carte, avec son `h2` serif ; la carte s'y range comme les quatre autres.
- **`button`** — `outline` pour les deux ajouts et « Annuler », `default` pour l'enregistrement de la
  forme ouverte, `destructive` pour la suppression ; `link` pour « Modifier » / « Supprimer ».
- **`form` `label` `textarea` `select`** — une colonne, libellé au-dessus, compteur de caractères et
  résumé d'erreurs ancré (§3.1, §3.9).
- **Champ date** (`src/components/ui/date-field.tsx`, §3.9) — pré-rempli à aujourd'hui, sans calendrier.
- **`badge`** — type d'entrée (« Note » `outline`, « Échange » `secondary`).
- **`alert`** — succès neutre (`CircleCheck` `primary`), échec `destructive` (bordure 2 px,
  `role="alert"`), résumé d'erreurs ; **`alert-dialog`** — la suppression.
- **`skeleton`** (trois entrées), **`pagination`** (« Précédent / Suivant » écrits).
- **Icônes** — `CircleCheck`, `AlertTriangle`, `Calendar` (décorative), rien d'autre.

## States

Vue d'ensemble ; les libellés exacts sont dans la maquette.

- **a · Fil rempli** — quatre entrées, dont une note modifiée.
- **b · Vide** — « Aucune note ni échange pour l'instant. » + « Ajouter la première note ».
- **c · Chargement** — trois `skeleton` d'entrée ; titre, phrase et boutons déjà présents.
- **d · Note, vierge** — formulaire ouvert, « 0 / 2 000 ».
- **e · Échange, vierge** — date du jour, « Choisissez un canal », résumé vide.
- **f · Erreurs de saisie** — résumé ancré « 3 champs à corriger. Rien n'a été enregistré. » (date
  future, canal manquant, résumé vide), chaque champ en bordure 2 px + message.
- **g · Compteur dépassé** — « 17 caractères de trop. », bordure 2 px, `--destructive-text` 600.
- **h · Succès** — « Note enregistrée. Elle apparaît en tête du fil. » (trois autres phrases à écrire).
- **i · Modification d'une entrée** — la note du 14/09 en formulaire pré-rempli.
- **j · Confirmation de suppression** — `alert-dialog`, bureau et mobile.
- **k · Échec** — « La note n'a pas pu être enregistrée. Ce que vous avez écrit est conservé dans le
  formulaire. Réessayez dans un instant. »
- **l · Fil long** — dix entrées, pagination.

## Écarts du design au brief et tranchés ici

1. **Aucun jeu sombre.** Le produit est en clair seul (ADR 033) : la maquette n'en porte pas.
2. **« 3 champs à corriger »**, pas « 2 » : le brief listait trois erreurs sous un compteur de deux ;
   c'était une erreur du brief, la maquette a raison.
3. **Les deux boutons d'ajout s'effacent tant qu'un formulaire est ouvert** (état d, e) : une seule forme
   ouverte à la fois, sans perte de saisie par un second clic. Proposition de la maquette, **retenue**.
4. **L'aide de format de la date** (« Au format jj/mm/aaaa. ») s'écrit en `meta` **sous le libellé**, le
   §3.9 ne dit pas où elle va. Proposition retenue.

## Design system gaps

À consigner ; **rien n'a été comblé** dans la maquette ni ne doit l'être à l'Execute.

1. **Marqueur « interne au bureau »** — confirmé : une phrase écrite en `meta`, sans icône. `Lock` reste
   réservée à « Espace personnel » (§3.4). À verser au design system comme forme des données
   réservées au bureau.
2. **Ordre du fil** — du plus récent au plus ancien, **contre §3.10** (historique du plus ancien au
   plus récent). Écart assumé : on rouvre une fiche pour lire le dernier échange. À inscrire en §3.10
   comme exception des fils de suivi.
3. **Deux actions par entrée** — « Modifier » / « Supprimer » en liens écrits sans icône ; la règle « une
   action par ligne » vise les tableaux. À inscrire au design system (§3.5 ou §3.10).
4. **`gap` de carte de 20 px** hors de l'échelle 4 · 8 · 12 · 16 · 24 : la maquette reprend la valeur du
   composant existant (`DetailCard`, `gap-5`). À corriger dans le design system, **pas** dans cette
   story.

## À trancher au plan

- **Qui a modifié en dernier** — la maquette affiche « Modifiée le … à … » **sans nom** ; elle propose
  « Modifiée par Jean-Paul Rivière le … » si un autre membre modifie. Lié à la question ouverte n° 3 de
  la recherche (`updated_by_*` ou non). Le critère 5 ne demande que « l'auteur et la date de dernière
  modification » : la lecture littérale est l'auteur d'origine + la date.
- **Mobile, `alert-dialog` : le principal en premier** place « Supprimer la note » (acte destructif) en
  tête de la pile, au-dessus de « Garder la note ». La règle §3.11 dit « le principal en premier » ; la
  maquette demande de confirmer pour un acte destructif. Défaut sûr proposé : « Garder la note » en
  premier sur mobile, et **focus initial sur « Garder la note »** dans les deux versions.
- **Modifier un échange** — non dessiné : les trois champs de l'état e, pré-remplis (date et canal
  modifiables).
- **Phrases de succès manquantes** : « Échange enregistré. » (donnée), « Note modifiée. » (donnée),
  « Note supprimée. » (donnée) ; reste à écrire « Échange modifié. » / « Échange supprimé. » et à fixer
  la durée de vie de l'`alert` (jusqu'à la prochaine action ?).
- **Échec de suppression** — proposition : « La note n'a pas pu être supprimée. Elle est toujours sur
  la fiche. Réessayez dans un instant. »
- **Valeurs** : plafond de caractères (2 000 illustratif), taille de page du fil (10 indicatif) ; **focus**
  à l'ouverture et à la fermeture des formulaires et de la boîte de dialogue.
- **Libellés de l'`alert-dialog` pour un échange** : « Supprimer cet échange ? », « Supprimer l'échange »
  / « Garder l'échange ».

## Ce que ce design ne couvre pas

Tout écran côté espace membre ; l'indicateur « a des notes » dans la liste des propriétaires ; un fil
alimenté automatiquement (signalements, questions, campagnes) ; un historique des versions, une
corbeille, une restauration ; l'export des notes (s38, s40) ; les pièces jointes, mentions, étiquettes,
recherche et filtres ; l'affichage de l'auteur pendant une session « à la place d'un compte ».
