# Design — Story s12-membres-parcelles

> Conçu le 2026-09-30 par le chemin **Claude Design**, à partir du brief
> `docs/designs/s12-membres-parcelles-brief.md` (reçu tel quel par le canevas : le fichier `uploads/`
> de l'export est identique au brief du dépôt).
>
> - **Canevas** :
>   <https://claude.ai/design/p/be63b286-781d-460e-9ce6-a62bcf989d3b?file=s12-membres-parcelles.dc.html>
> - **Export du canevas** : `docs/designs/s12-membres-parcelles.zip`, remis par Marie-Ève le
>   2026-09-30.
> - **Normalisé le même jour** en `docs/designs/s12-membres-parcelles.html` : la source `.dc.html`
>   dépend du moteur de gabarits de Claude Design (`support.js`, absent du dépôt) ; elle a été rendue
>   par Chromium dans ses deux thèmes, et le fichier contient les deux rendus figés avec la bascule
>   « Passer en sombre / Passer en clair ». Aucun contenu n'a été retouché.
> - **Source visuelle unique** : `docs/design-system.md`. **Contexte de code** :
>   `docs/research/s12-membres-parcelles.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                               | Où                                                                                   |
| ------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1       | Créer un membre, lui rattacher des parcelles avec une date de début            | **Écran 2** (fiche) + **Écran 4** (rattachement, date)                               |
| 2       | Vente : clôture du vendeur, ouverture de l'acquéreur, période close intacte    | **Écran 5** (encart « Ce qui va changer », `alert-dialog`) + **Écran 3** (`3b`, `3c`) |
| 3       | Propriétaire lu à une date donnée                                              | _non dessinable en tant que tel_ ; la parcelle 47 se lit des deux fiches (`3b` ↔ `3c`) |
| 4       | Pas de chevauchement, message explicite                                        | **Écran 4** (`4c`) + **Écran 5** (`5g`)                                              |
| 5       | Plusieurs parcelles, un seul compte                                            | **Écran 1** (« 5, 6, 30 ») + **Écran 3** (`3a`)                                       |
| 6       | Coordonnées saisies par le bureau, y compris sans compte                       | **Écran 2** + **Écran 3** (`3e`)                                                     |
| 7       | Fiche sans email → pas de compte, « courrier uniquement »                      | **Écran 2** (`2c`, `2g`) + badge des écrans 1 et 3                                   |
| 8       | « Courrier uniquement » sans adresse postale → **incomplète** dans la liste    | **Écran 1** (badge « Fiche incomplète ») + **Écran 3** (`3d`)                        |
| 9       | Ajouter un email ouvre un compte ; le retirer referme l'accès, fiche conservée | **Écran 3** (`3f`, `3g`, `3h`)                                                       |
| 10      | Un membre ne voit que ses parcelles ; fiche d'un autre refusée                 | **Écran 6** (`6a`, `6c`)                                                             |

## Screen(s)

Huit sections ancrées (0 Repères, écrans 1 à 6, Écarts). Chaque planche porte sa puce (`1a`…) et ses
notes en marge (« ÉCART », « PROPOSITION », « NOTE », « AU PLAN »).

### Écran 0 — Repères de continuité

« **Membres** » s'ajoute **en tête** du groupe « L'association », avant Identité, sans icône. L'espace
membre (`/dashboard`, `max-w-[1000px]`, une colonne) reçoit la section « Mes parcelles » (écran 6).

### Écran 1 — Liste des membres (`/bureau/membres`)

`h1` « Membres », `meta` « 412 membres · 1 fiche incomplète », bouton `default` « Ajouter un
membre », champ « Rechercher un nom ou un numéro de parcelle » (proposition). Tableau trié par nom :
**Membre** (`body-strong`) · **Parcelles** (numéros actuels en `data`, ou « Aucune parcelle
actuelle ») · **Contact** (l'email, ou badge neutre « Courrier uniquement ») · **État** (badge
`warning` « Fiche incomplète » seulement ; cellule vide = aucune alerte) · **Action** « Ouvrir la
fiche ». Pagination « Page 1 sur 17 · membres 1 à 25 ». Mobile : cartes, **Contact** = l'email, sinon
l'adresse postale, sinon « Aucune adresse » ; bouton « Menu » écrit pour le tiroir.

### Écran 2 — Ajouter un membre (`/bureau/membres/nouveau`)

`breadcrumb` « Membres › Ajouter un membre ». Trois `card` : **Identité** (un seul champ **Nom**,
« Tel qu'il doit apparaître sur les courriers : « Jean et Odile Dubois », « SCI Les Pins ». ») ;
**Coordonnées** (Adresse email « Facultatif », Téléphone « Facultatif », Adresse, Complément
« Facultatif », Code postal, Commune) avec l'encart neutre « Sans adresse email, ce membre sera
joignable par courrier uniquement. Son adresse postale est alors indispensable. », visible tant que
l'email est vide ; **Parcelles** (« Vous rattacherez ses parcelles depuis sa fiche, une fois
enregistrée. »). Boutons « Enregistrer le membre » / « Annuler ». L'encart **ne bloque pas**
l'enregistrement sans adresse postale : la fiche sera alors « incomplète ».

### Écran 3 — Fiche d'un membre (`/bureau/membres/{id}`)

`breadcrumb`, `h1` = le nom, badges d'état dessous. Trois `card` :

1. **Coordonnées** — paires libellé / valeur ; absente = « Non renseignée » / « Non renseigné »
   (accordé) ; « Modifier les coordonnées » ouvre les champs **en place** (« Enregistrer les
   coordonnées » / « Annuler »).
2. **Accès à l'espace membre** — une phrase toujours écrite : « Compte ouvert. Claire Meunier peut se
   connecter à son espace avec … » ou « Joignable par courrier uniquement. Aucun compte : ajoutez une
   adresse email pour lui ouvrir son espace. »
3. **Parcelles** — « Rattacher une parcelle » ; **Parcelles actuelles** (Parcelle · Propriétaire
   depuis · « Enregistrer une vente ») ; **Anciennes parcelles** si elles existent (Parcelle · Période
   « du 03/02/1998 au 14/06/2026 » · Vendue à, en lien), avec « Les périodes closes ne se modifient
   pas. » et aucune action.

Retirer l'email (`3f`) : avertissement `warning` ancré sous le champ **avant** l'enregistrement
(« Attention. Sans adresse email, Paul Ferrand ne pourra plus se connecter… Sa fiche, ses parcelles
et son historique sont conservés. »), pas d'`alert-dialog` — l'acte est réversible. Fiche incomplète
(`3d`) : `alert` `warning` en tête, « Attention. Cette fiche n'a ni adresse email ni adresse postale :
aucun envoi ne peut atteindre ce membre. » + « Ajouter une adresse postale ».

### Écran 4 — Rattacher une parcelle (`dialog` depuis la fiche)

Titre « Rattacher une parcelle à Hélène Roy », deux champs : **Numéro de parcelle** (`data`) et
**Propriétaire depuis le** (champ date §3.9, pré-rempli à aujourd'hui). « Annuler » écrit, pas de
croix ; Échap ferme. Mobile : ancré en bas, pleine largeur, boutons 56 px empilés, principal en
premier.

### Écran 5 — Enregistrer une vente (`/bureau/membres/{id}/vente/{parcelle}`)

Une page : `breadcrumb` « Membres › Jean et Odile Dubois › Vendre la parcelle 47 », `h1`
« Enregistrer la vente de la parcelle 47 ». **Date de la vente** (champ date ; aide « Le dernier jour
de propriété des vendeurs est la veille de cette date. ») · **Acquéreur** (`command` dans un
`popover`, résultats avec les parcelles actuelles en `meta` ; `sheet` bas d'écran en mobile) + lien
« L'acquéreur n'a pas encore de fiche ? Ajoutez-le d'abord » · **Ce qui va changer** (encart `muted`
écrit, qui suit la saisie et calcule la clôture : 15/06 → 14/06). Bouton « Enregistrer la vente » →
`alert-dialog` qui reprend l'encart **mot pour mot**, bouton nommant l'acte.

### Écran 6 — Espace membre : Mes parcelles (`/dashboard`, section)

Marqueur §3.4 en haut, une seule fois : `Lock` + « Espace personnel » + « Parcelles 12 et 13 » (ou
« Aucune parcelle actuelle »). `h1` « Bonjour Claire Meunier », `card` « Mes parcelles » : une ligne
de 56 px par parcelle, « Parcelle 12 » + « Propriétaire depuis le 3 février 1998 » (date en clair),
pas de tableau. « Une erreur ? Écrivez au bureau. » + lien « Page Contact ». Accès refusé : « Cette
page ne vous est pas accessible », « Elle concerne un autre membre de l'association. », bouton
« Revenir à mon espace » — ni nom, ni parcelle, ni code d'erreur, ni marqueur personnel.

## Mockup

`docs/designs/s12-membres-parcelles.html` — référence visuelle. **NE PAS copier en production** :
l'Execute construit l'écran avec les vrais composants du socle. L'export d'origine reste
`docs/designs/s12-membres-parcelles.zip`.

## Reused components (from the design system)

- **`button`** — un seul `default` visible à la fois (celui de la page passe sous le voile de
  l'`alert-dialog`) ; libellés à l'infinitif ; « Annuler » en `outline`.
- **`form`, `input`, `label`** — une colonne, « Facultatif » écrit, validation au _blur_ puis à la
  soumission ; **champ date** §3.9 (clavier seul, `jj/mm/aaaa`, pré-rempli).
- **`table`, `pagination`, `badge`** — liste, parcelles actuelles et anciennes ; cartes empilées sous
  640 px ; deux badges sur une ligne (« Courrier uniquement » + « Fiche incomplète »).
- **`alert`** — succès neutres (« Fiche créée. », « Vente enregistrée. … »), erreurs `destructive`
  (chevauchement), avertissements `warning` (fiche incomplète, retrait d'email).
- **`dialog`** (deux champs), **`alert-dialog`** (vente), **`command`** + **`popover`** (acquéreur,
  back-office), **`sheet`** (tiroir et recherche en mobile), **`breadcrumb`**, **`card`**,
  **`skeleton`** (`1c`).
- **Icônes** — `Map` (parcelle, écran 6), `Lock` (marqueur personnel), `AlertTriangle`,
  `CircleCheck`, `Calendar` décorative. Pas d'icône loupe, menu ni croix : libellés écrits.

## States

- **Liste** : liste (`1a`) · vide (`1b`) · chargement (`1c`) · recherche sans résultat (`1d`) · mobile
  (`1e`).
- **Ajouter** : vierge (`2a`) · avec email (`2b`) · sans email, l'encart suit la saisie (`2c`) ·
  erreurs par champ avec résumé « 3 champs à corriger. Rien n'a été enregistré. » (`2d`) · email déjà
  utilisé par une autre fiche, avec lien (`2e`) · enregistré avec email → compte ouvert (`2f`) ·
  enregistré sans email (`2g`) · mobile (`2h`).
- **Fiche** : avec compte et deux parcelles (`3a`) · vendeur (`3b`) · acquéreur (`3c`) · fiche
  incomplète (`3d`) · en modification (`3e`) · email retiré avant enregistrement (`3f`) · après
  retrait, accès fermé (`3g`) · email ajouté, compte ouvert (`3h`) · mobile (`3i`).
- **Rattacher** : vierge (`4a`) · erreurs (`4b` — numéro vide, « Cette date n'existe pas. ») ·
  chevauchement refusé (`4c`) · parcelle inconnue créée (`4d`) · mobile (`4e`).
- **Vente** : vierge (`5a`) · recherche (`5b`) · rempli (`5c`) · confirmation (`5d`) · date antérieure
  au début de la période (`5e`) · acquéreur = vendeur (`5f`) · chevauchement (`5g`) · enregistrée
  (`5h`) · mobile (`5i`, `5j`).
- **Espace membre** : propriétaire (`6a`, `6d`) · ancien propriétaire (`6b`) · accès refusé (`6c`,
  `6e`).

## Écarts de la maquette au brief

1. **Encart « courrier uniquement »** visible **dès l'état vierge** (l'email est vide), neutre et
   sans icône, et il disparaît dès qu'un email est tapé.
2. **Vendeur non exclu** de la recherche d'acquéreur : s'il est choisi, le refus est explicite (`5f`).
3. **Retour après création de l'acquéreur** : acquéreur présélectionné, date conservée (proposition).
4. **Icône `Map` de l'écran 6 en `accent-foreground`** (« identité, elle ne porte aucun statut »).
   ⚠️ §3.3 réserve `primary` à « toute icône fonctionnelle » : à vérifier au plan que l'icône est bien
   décorative (le libellé « Parcelle 12 » porte seul l'information), sinon `primary`.
5. **Tokens sombres provisoires** : la maquette signale que le brief ne recopiait pas les valeurs
   sombres de `--warning`, `--warning-foreground`, `--destructive-foreground` et `--sidebar-border`, et
   qu'elle a posé des valeurs provisoires. **Sans conséquence pour l'Execute** : ces tokens existent
   déjà dans `src/app/globals.css` (bloc `.dark`), le trio `warning` sombre y est la version validée.
   Le rendu sombre de la maquette n'est donc pas une référence de couleur pour ces quatre tokens.

## Design system gaps

Propositions portées par la maquette, à verser au design system si le plan les retient :

1. **Aucune icône « membre / propriétaire »** — les écrans s'en passent ; `UsersRound` n'est pas
   réemployée.
2. **« Membres » et « Membres du bureau »** voisins dans la barre latérale — proposition
   **« Propriétaires »** (préférée : dit qui, sans ambiguïté, s'accorde à « Parcelles ») ou « Fiches
   des membres ». La maquette garde « Membres » en attendant l'arbitrage.
3. **Historique daté d'une parcelle** — liste « Anciennes parcelles » vue du membre, période + « Vendue
   à » en lien ; la parcelle 47 se lit des deux côtés (`3b` ↔ `3c`).
4. **`dialog` sur mobile** — pas de patron au design system ; proposé ancré en bas, pleine largeur,
   boutons 56 px empilés (`4e`).
5. **Aucune icône de recherche, de menu ni de fermeture** au vocabulaire — libellés écrits (« Menu »,
   « Annuler »), champ de recherche sans loupe.
6. **Retours de courrier (PND)** (§9, rattachés à s28 et s12) — restent ouverts, non dessinés.

## Hypothèses et points laissés au plan

- **Un seul champ Nom** (couple, société) : conséquence sur le tri — trié sur le libellé tel que saisi,
  donc par prénom ; un tri par nom de famille demanderait un « nom de tri ».
- **Adresse structurée** (Adresse / Complément / Code postal 5 chiffres / Commune) pour le publipostage.
- **Recherche** par nom ou numéro de parcelle actuelle (hors critères).
- **Convention de date d'une vente** : dernier jour des vendeurs = veille de la vente.
- **Parcelle inconnue créée au rattachement**, sans écran « Parcelles ».
- **Ouvrir un compte n'envoie rien** : l'invitation est une autre story.
- **Ouverture d'un compte à partir d'une adresse déjà connue du produit** (même personne dans une
  autre association), **changement d'email d'un membre qui a un compte**, **rattachement des fiches du
  bureau et de la présidence** : non dessinés.

## Ce que ce design ne couvre pas

Import de la liste des membres, invitation, lancement, désignation des rôles ; mise à jour de ses
coordonnées par le membre lui-même ; factures, relevés, documents (aucune section vide) ; suppression
ou fusion de fiches, export, purge, coupure d'accès ; écran « Parcelles » séparé ; indivision.
