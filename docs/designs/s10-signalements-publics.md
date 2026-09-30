# Design — Story s10-signalements-publics

> Conçu le 2026-09-30 par le chemin **Claude Design**, à partir du brief
> `docs/designs/s10-signalements-publics-brief.md` (reçu tel quel par le canevas : le fichier
> `uploads/` de l'export est identique au brief du dépôt).
>
> - **Canevas** :
>   <https://claude.ai/design/p/201626ce-34a0-49a3-ac67-010991307ca9?file=s10-signalements-publics.dc.html>
> - **Export du canevas** : `docs/designs/s10-signalements-publics.zip`, remis par Marie-Ève le
>   2026-09-30.
> - **Normalisé le même jour** en `docs/designs/s10-signalements-publics.html` : la source
>   `.dc.html` dépend du moteur de gabarits de Claude Design (`support.js`, absent du dépôt) ; elle a
>   été rendue par Chromium dans ses deux thèmes, et le fichier contient les deux rendus figés, avec
>   la bascule « Clair / Sombre » de la maquette. Aucun contenu n'a été retouché.
> - **Source visuelle unique** : `docs/design-system.md`. **Contexte de code** :
>   `docs/research/s10-signalements-publics.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                   | Où                                                                                 |
| ------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1       | Signalement enregistré, **confirmé à l'écran**, notifié par email                  | **Écran 1** (`1.C`, `1.F` : succès) + **Écran 5** (email au bureau)                |
| 2       | File de suivi avec statut initial « Signalé »                                      | **Écran 2** (`2.A`)                                                                |
| 3       | Signalé → En cours → Résolu, **horodaté et attribué**                              | **Écran 3** (`3.A` à `3.C` : un bouton par statut + historique)                    |
| 4       | Catégories administrables, plafond 10, la 11ᵉ refusée avec message                 | **Écran 4** (`4.A`, `4.E`)                                                         |
| 5       | Supprimer une catégorie ne supprime pas les signalements                           | **Écran 4** (`4.D`, texte de l'`alert-dialog`) + **Écrans 2 et 3** (`3.D`)         |
| 6       | Adresse de routage relue inchangée ; vide = **absente**                            | **Écran 4** (`4.A` « Aucune », `4.B` adresse relue)                                |
| 7       | Changer les adresses des Réglages change les destinataires                         | _aucun écran nouveau_ (Réglages livrés) ; destinataires annotés en tête de l'écran 5 |
| 8       | Aucun rattachement à un membre                                                     | _non dessinable_                                                                   |
| 9       | Même limitation d'envois que `/contact`                                            | **Écran 1** (`1.G`)                                                                |

## Screen(s)

La maquette a six sections ancrées (écrans 1 à 5, puis « Écarts et points ouverts »). Chaque planche
porte sa puce (`1.A`, `2.C`…) ; les annotations en encadré pointillé sont l'habillage de la maquette,
hors produit.

### Écran 1 — Site public : signaler (`/signaler`)

Gabarit public, colonne `max-w-[68ch]`, **mobile prioritaire** (planches `1.A` à `1.C` en 390 px).
`h1` « Signaler une fuite ou un incident », introduction `body-lg`, puis un `alert` neutre
« En cas de danger immédiat, appelez les secours (112). Ce formulaire prévient le bureau, pas les
services d'urgence. » (proposition du brief, gardée). Formulaire dans une `card`, dans cet ordre :
**De quoi s'agit-il ?** (`select`, première option « Choisissez… »), **Où ?** (`input`, aide avec
exemples), **Que se passe-t-il ?** (`textarea`), puis `h3` **« Vos coordonnées »** « Facultatif… » et
trois champs « Facultatif » : nom (`autocomplete="name"`), email (`type="email"`,
`inputmode="email"`), téléphone (`type="tel"`, `inputmode="tel"`). Un seul bouton `default`
« Envoyer le signalement », pleine largeur 56 px en mobile.

Le segment `/signaler` est celui de la maquette ; il doit rejoindre `RESERVED_PAGE_SLUGS` dans le
même commit (recherche, « Anchor points »).

### Écran 2 — Bureau : file de suivi (`/bureau/signalements`)

« Signalements » s'ajoute au groupe **« Le site »**, **après « Messages reçus »**, sans icône. `h1`
« Signalements », `meta` « 1 signalement à traiter · 1 en cours », lien `outline` « Gérer les
catégories ». Aucun bouton `default`. Tableau dans une `card`, trié par date décroissante :
**Catégorie** (`body-strong` ; une catégorie supprimée garde son nom + `meta` « catégorie
supprimée ») · **Où** (une ligne, tronquée ; texte entier au détail) · **Signalé par** (nom, sinon
email, sinon téléphone, sinon « Anonyme » ; seconde ligne en `meta`) · **Reçu le** (`data`) ·
**Statut** (badge, + badge `destructive` « Notification non envoyée » sur la même ligne) · **Action**
« Ouvrir le signalement ». Pagination 25 lignes. Mobile : cartes empilées, badges sous le titre,
10 par page.

### Écran 3 — Bureau : détail (`/bureau/signalements/{id}`)

Colonne `max-w-[68ch]` : « ← Signalements », `h1` = la catégorie + badge de statut, `meta` « Reçu le
29 septembre 2026 à 7 h 42 depuis le site », puis sections `h3` **Où**, **Ce qui a été signalé**
(retours à la ligne conservés), **Coordonnées** (`mailto:`, `tel:`, ou « Aucune coordonnée
laissée »), **Suivi**. Le suivi porte **un seul bouton `default` selon le statut** — « Passer en
cours », puis « Marquer comme résolu », puis rien (`meta` « Signalement résolu. ») — et l'historique
en liste : date et heure en `data`, phrase écrite (« Signalé depuis le site », « Passé en cours par
Marie Delorme », « Marqué comme résolu par Jean Vidal »). Pas de `select` de statut, pas de
réouverture, pas de commentaire.

### Écran 4 — Bureau : catégories (`/bureau/signalements/categories`)

`breadcrumb` « Signalements › Catégories », `h1` « Catégories de signalement », `meta` « 4
catégories sur 10 possibles. », bouton `default` « Ajouter une catégorie ». Tableau **Nom** ·
**Adresse de routage** (l'adresse ou « Aucune » en `muted-foreground`) · **Action** « Modifier ».
Ajout et modification en `dialog` à deux champs (nom avec compteur « 12 / 40 », adresse de routage
« Facultatif » avec l'aide « Pour l'instant, cette adresse n'est pas utilisée par les signalements… »).
La suppression est dans le `dialog` de modification (bouton `destructive` en bas) et passe par un
`alert-dialog` : « Supprimer la catégorie « Nuisance » ? … Les 3 signalements déjà reçus dans cette
catégorie sont conservés. » Mobile : cartes, `dialog` plein écran.

### Écran 5 — Email : nouveau signalement, au bureau

Nature **notification interne au bureau** (§5.4). Objet « Les Amis de l'Étang — Signalement : fuite
d'eau » (47 caractères), pré-en-tête « Chemin des Pins, devant la parcelle 47 — signalé ce matin à
7 h 42. », destinataires annotés : **adresse de contact + adresse du responsable forage (catégorie
fuite)**. En-tête teinté, titre « Nouveau signalement depuis le site », table Catégorie · Où · Reçu
le · Signalé par · Email · Téléphone (« non renseigné » pour une coordonnée absente), description en
encart, bouton en table « Ouvrir le signalement » doublé de « Ou copiez ce lien : … », pied « Cet
email vous est envoyé parce qu'un visiteur a fait un signalement… ». Rendus 600 px clair et sombre
forcé, 390 px, et version texte brut.

## Mockup

`docs/designs/s10-signalements-publics.html` — référence visuelle. **NE PAS copier en production** :
l'Execute construit l'écran avec les vrais composants du socle. L'export d'origine reste
`docs/designs/s10-signalements-publics.zip`.

## Reused components (from the design system)

- **`button`** — un seul `default` par écran : « Envoyer le signalement », « Passer en cours » /
  « Marquer comme résolu », « Ajouter une catégorie », « Enregistrer la catégorie ». Le reste en
  `outline` ; `destructive` pour « Supprimer la catégorie ». Chargement : « Envoi en cours… »,
  **largeur conservée** (`1.E`).
- **`form`, `label`, `input`, `textarea`, `select`** — une colonne, libellé au-dessus, « Facultatif »
  écrit ; erreur = bordure 2 px + message + résumé ancré avec liens d'ancrage.
- **Compteur de caractères** (§3.9) — nom de catégorie.
- **`table`, `pagination`, `badge`** — file et catégories, cartes empilées sous 640 px ; deux badges
  sur une ligne (§3.9).
- **`alert`** — succès neutre `CircleCheck`, refus ancrés, bandeau 112 ; **`alert-dialog`** —
  suppression seulement ; **`dialog`** — deux champs.
- **`breadcrumb`**, **`card`**, **`skeleton`** (`2.D`), **`sidebar`** + **`sheet`**.
- **Email** — gabarit `react-email` du contact (s08), jumelles de `src/lib/emails/theme.ts`.
- **Icônes** — `AlertTriangle` (résumé d'erreurs, notification non envoyée), `CircleCheck`, `ChevronDown`
  du `select`, `Menu`. Aucune icône « signalement ».

## States

- **Formulaire public** : vierge (`1.A`) · erreurs par champ (`1.B`, `1.D` — trois liens dans le
  résumé, dont l'email mal formé) · envoi en cours (`1.E`) · succès avec coordonnées (`1.C`) · succès
  sans coordonnées, identique quand l'email au bureau a échoué (`1.F`) · refus au-delà du seuil
  (`1.G`, `{N}` = réglage, montré à 3) · aucune catégorie (`1.H`, proposition).
- **File** : liste (`2.A`) · mobile (`2.B`) · vide avec lien vers le formulaire (`2.C`) · chargement
  (`2.D`).
- **Détail** : signalé + notification non envoyée + sans coordonnées (`3.A`) · en cours juste après
  le changement, `alert` « Signalement passé en cours. » (`3.B`) · résolu, historique à trois lignes
  (`3.C`) · catégorie supprimée (`3.D`) · mobile (`3.E`).
- **Catégories** : liste + « enregistrée » + adresse relue (`4.A`, `4.B`) · erreurs du `dialog`
  (`4.C`) · suppression (`4.D`) · plafond atteint (`4.E`) · vide (`4.F`) · mobile (`4.G`, `4.H`).
- **Email** : 600 px clair (`5.A`) et sombre forcé (`5.B`), 390 px (`5.C`), texte brut (`5.D`).

## Écarts de la maquette au brief

1. **Résumé d'erreurs à trois liens** (`1.B`) : le brief en citait deux ; la maquette ajoute
   « Votre adresse email » parce qu'un email mal formé est aussi une erreur. Conforme au patron §3.1.
   Message retenu : « Cette adresse semble incomplète. Corrigez-la, ou laissez le champ vide. »
2. **Formulaire sans catégorie** (`1.H`) : la maquette tranche la proposition — le champ disparaît,
   le formulaire reste utilisable et commence par « Où ? » (« une fuite doit toujours pouvoir être
   signalée ») ; l'alternative « formulaire indisponible » est écartée. **À confirmer au plan.**
3. **Destinataires de l'email** annotés « contact + responsable forage (catégorie fuite) » : conforme
   aux libellés des Réglages livrés en s02 ; le mécanisme de reconnaissance de la catégorie « fuite »
   reste ouvert (voir plus bas).

## Design system gaps

Aucun comblé par invention ; chacun est une **proposition** portée par la maquette, à verser au
design system si le plan la retient.

1. **Trois statuts d'un workflow, sans palette de statuts** (`2.A`) : distingués **par le mot**, puis
   par la variante — « Signalé » `outline` + point plein (demande une action), « En cours »
   `secondary` + anneau, « Résolu » fond `muted`, texte atténué. Aucune couleur nouvelle, jamais de
   rouge pour « Signalé » ; seul « Notification non envoyée » porte `destructive`, parce que c'est une
   vraie erreur.
2. **Historique d'un objet** (`3.A`–`3.C`) : liste ordonnée, date en `data` + phrase écrite (statut +
   auteur), premier événement « depuis le site », jamais « Anonyme ». Réutilisable par les factures,
   votes et documents.
3. **Aucune icône « signalement »** au vocabulaire figé : aucune proposée, l'entrée de barre latérale
   est sans icône.
4. **`select` au-delà de 3 options pour un public âgé** : dessiné en `select` (règle §3.1) ; un
   `radio-group` vertical est **recommandé** pour 4 à 10 libellés courts. À trancher.
5. **Action refusée parce qu'une limite est atteinte** (`4.E`) : le bouton reste visible et actif,
   le refus arrive en `alert` `destructive` ancré sous le titre — un bouton désactivé seul serait de
   l'information par l'absence.

## Hypothèses et points laissés au plan

- **Reconnaître la catégorie « fuite »** pour prévenir aussi le responsable forage (marqueur sur la
  catégorie, catégorie non supprimable…) : **rien de dessiné**.
- **Plafonds** : nom de catégorie (40 montré), description du signalement.
- **Compteur d'envois partagé ou non** avec `/contact` (même message dans les deux cas).
- **Passage direct Signalé → Résolu** : non dessiné.
- **Bandeau 112** en tête du formulaire : proposition gardée par la maquette.
- **Accès au formulaire** : comme `/contact`, le menu ne pointe que vers des pages du CMS ; lien
  depuis le pied de page ou une page. Limite connue, rien de dessiné.
- **Filtre « à traiter »** dans la file : utile, hors critères, non dessiné.

## Ce que ce design ne couvre pas

Photo jointe, carte ou géolocalisation ; suivi par le visiteur, numéro de dossier, accusé de
réception ; commentaires, assignation, réouverture, suppression d'un signalement, recherche, export ;
les écrans des questions au bureau et des petites annonces, qui réutiliseront les catégories ; la page
Réglages, l'en-tête, le pied et la barre latérale, déjà livrés.
