# Design — Story s27-groupes-destinataires

> Conçu le 2026-11-18, chemin **agent** (orchestrateur). Source visuelle unique : `docs/design-system.md`.
> Contexte de code : `docs/research/s27-groupes-destinataires.md`. **Web : mode clair uniquement**
> (ADR 033). Aucun email nouveau : pas de jumelle « sombre forcé » (§5.2).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas sur la machine (`libnspr4.so`
> absente) ; contrôle en lecture seule à la place, le 18/11/2026 : couleurs toutes issues des tokens §1.1
> (zébrure §2.1 comprise), espacements dans l'échelle §1.4 (hors tracés de la coche et du point radio),
> une seule rupture mobile `max-width: 639px` + tiroir sous 1 024 px, quatre états présents par écran.

## Screen(s)

Quatre écrans, chacun en **bureau (≥ 1 024 px) et mobile (390 px)** dans le même fichier : sous 640 px,
les tableaux passent en cartes empilées (§3.5), boutons et champs à 56 px, pleine largeur. Données
fictives : « ASL Les Pins », groupe « Riverains du chemin des Crêtes » (38 fiches, 31 avec adresse
active, 7 sans, 33 adresses destinataires, 2 désinscrites).

| Écran | Route                                       | Change par rapport à l'existant                                                 |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| 1     | `/bureau/campagnes/nouvelle`                | carte « Destinataires » : choix de la cible + décompte en fiches, puis adresses |
| 2     | `/bureau/proprietaires`                     | filtre « Groupe », cases à cocher, barre « Ajouter / Retirer du groupe »        |
| 3     | `/bureau/groupes` et `/bureau/groupes/{id}` | nouveaux : liste des groupes, un groupe (composition, renommer, supprimer)      |
| 4     | `/bureau/campagnes/{id}`                    | carte « Résumé » : la valeur « Cible » nomme le groupe                          |

- **Écran 1 — Composeur, carte « Destinataires ».** Les cartes « Modèle » et « Contenu » sont
  inchangées (s25). La carte s'ouvre sur un `radio-group` de trois options, légende « Qui reçoit cette
  campagne ? » : **Tous les membres** · **Les membres en impayé** (« Calculé au moment de l'envoi,
  d'après les factures. Une facture « à classer » ne compte pas. ») · **Un groupe**. « Un groupe » révèle
  un `select` « Groupe » (nom + nombre de fiches dans chaque option) et le lien « Gérer les groupes ».
  Puis deux `dl` de décompte (forme du compteur s26 §3.13, en lignes) :
  - **Fiches** (critère 5) : « Avec au moins une adresse email active », « Sans adresse email active »
    (aide : « Elles ne reçoivent rien par email. »), filet, total « Fiches de la cible » ;
  - **Adresses** (s54) : « Adresses qui recevront la campagne » (aide : « Une adresse partagée par
    plusieurs fiches ne reçoit qu'un message. »), « Adresses désinscrites ».
    Le même décompte vaut pour les trois cibles. Le choix de cible est porté jusqu'à l'aperçu et à l'envoi
    (le plan d'envoi de s26 et la confirmation parlent du nombre d'adresses de la cible choisie).
- **Écran 2 — Propriétaires.** Barre d'outils : « Rechercher » (existant) et un `select` **« Groupe »**
  (« Tous les propriétaires » par défaut, puis chaque groupe). Une colonne de `checkbox` en tête du
  tableau (« Tout sélectionner sur cette page » dans l'en-tête), une case dans le titre de chaque carte
  mobile. Dès qu'une fiche est cochée, une **barre de sélection** (bordure 2 px `primary`, §1.4
  « sélection ») apparaît au-dessus du tableau : « 2 fiches sélectionnées » (`aria-live="polite"`),
  `select` « Ajouter au groupe » + bouton `outline` « Ajouter au groupe ». Filtrée sur un groupe, la
  barre propose **« Retirer du groupe »**. La sélection vaut pour la page affichée (pas de sélection
  entre pages). Succès : `alert` neutre `CircleCheck` « 2 fiches ajoutées au groupe « … ». Le groupe compte
  38 fiches. Voir le groupe ». L'action de ligne reste « Ouvrir » (une seule action par ligne, §2.1).
- **Écran 3 — Groupes.** `h1` « Groupes de destinataires », bouton `default` « Créer un groupe »
  (`dialog`, un champ « Nom du groupe »). Tableau Nom · Fiches · « Ouvrir ». Un groupe ouvert :
  breadcrumb, `h1` = nom, carte **Composition** (même décompte en fiches que l'écran 1, « 33 adresses
  recevraient une campagne envoyée aujourd'hui », lien « Voir et modifier les fiches du groupe » → écran 2
  filtré), carte **Le groupe** : « Renommer le groupe » (`dialog`, un champ) et « Supprimer le groupe »
  (`alert-dialog`, bouton `destructive` qui nomme l'acte : « Le groupe disparaît. Ses 6 fiches restent
  dans la liste des propriétaires, et les campagnes déjà envoyées à ce groupe gardent leurs
  destinataires et son nom. »).
- **Écran 4 — Détail d'une campagne.** Seule la valeur « Cible » du résumé (s25) change : « Tous les
  membres », « Membres en impayé » ou « Groupe « Riverains du chemin des Crêtes » » ; un groupe supprimé
  depuis garde son nom, suivi de « (supprimé) ».

## Mockup

`docs/designs/s27-groupes-destinataires.html` — référence visuelle. **NE PAS copier en production** :
l'Execute construit les écrans avec les vrais composants (`radio-group`, `select`, `checkbox`, `table`,
`dialog`, `alert-dialog`, `alert`, `card`, `breadcrumb`, `button`).

## Reused components (from the design system)

- `radio-group` — choix de la cible (3 options courtes, §2.1 et §3.1).
- `select` — groupe visé (écran 1), filtre « Groupe » et groupe d'ajout (écran 2).
- `checkbox` — sélection des fiches (écran 2) ; **voir gap 1**.
- `table` + cartes empilées §3.5 — propriétaires, groupes.
- `dialog` (≤ 2 champs, ancré en bas sous 640 px, §3.11) — créer, renommer.
- `alert-dialog` — supprimer un groupe (irréversible, bouton nommant l'acte).
- `alert` neutre `CircleCheck` (succès), `alert` erreur ancrée (§3.2).
- Compteur `dl` libellé / valeur `data` (§3.13), en lignes ; `skeleton` sur les nombres au chargement.
- `card`, `breadcrumb`, `sidebar` (item « Groupes » sous « L'association »).

## States

| Écran | Vide                                                                                                                                                                                                                                    | Chargement                                   | Erreur                                                                                                                                                                            | Succès                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1     | « Aucun groupe pour l'instant. Créer un groupe » ; cible sans adresse : « Aucun membre de cette cible n'a d'adresse email active. Rien ne peut être envoyé. » / « Aucun membre n'est en impayé aujourd'hui. Rien ne peut être envoyé. » | `skeleton` sur les nombres, options lisibles | « La liste des membres en impayé n'a pas pu être lue. Aucune campagne n'est partie. Réessayez dans un moment, ou choisissez une autre cible. » — **jamais de repli sur « tous »** | aperçu (s25)                                            |
| 2     | groupe sans fiche : « Ce groupe n'a encore aucune fiche. Choisissez « Tous les propriétaires », cochez des fiches, puis « Ajouter au groupe ». » ; sans groupe, la barre dit « Aucun groupe pour l'instant. Créer un groupe »           | `skeleton` du tableau (existant)             | « Les fiches n'ont pas été ajoutées au groupe. Rien n'a changé. Réessayez. »                                                                                                      | `alert` neutre, nombre de fiches du groupe              |
| 3     | « Aucun groupe pour l'instant. Créer le premier »                                                                                                                                                                                       | `skeleton` du tableau                        | nom déjà pris : « Un groupe porte déjà ce nom. Choisissez-en un autre. » (bordure `destructive` 2 px) ; groupe introuvable → 404                                                  | « Groupe « … » supprimé. Ses fiches n'ont pas changé. » |
| 4     | —                                                                                                                                                                                                                                       | inchangé (s25)                               | inchangé                                                                                                                                                                          | —                                                       |

## Design system gaps

1. **Sélection de lignes dans un tableau + barre d'action groupée** (écran 2). Le §2.1 prévoit « une
   seule action par ligne » et rien sur la sélection multiple. Proposition de la maquette : `checkbox` en
   première colonne (case de l'en-tête = la page affichée), barre bordée 2 px `primary` au-dessus du
   tableau avec le décompte annoncé `aria-live`, actions `outline` ; en mobile, case dans le titre de la
   carte, barre empilée pleine largeur. La case n'est pas une action de ligne : la règle « une action par
   ligne » reste tenue. À trancher, puis à inscrire au §3.5 / §3.13 (s28 et s29 pourraient la réutiliser).
2. **Option de `radio-group` à contenu révélé** (écran 1) : le `select` « Groupe » n'apparaît qu'avec
   « Un groupe », en retrait sous l'option. Non décrit au §3.1. Proposition : retrait de 48 px sous
   l'option en bureau, pleine largeur sans retrait sous 640 px, focus inchangé (le champ suit l'option
   dans l'ordre de tabulation).
3. **Place de « Groupes » dans la barre latérale** : item propre sous « L'association », à côté de
   « Campagnes » (route `/bureau/groupes`), plutôt qu'un sous-niveau de « Campagnes » — les groupes se
   composent depuis « Propriétaires » et serviront aussi au publipostage papier (s28). À confirmer.
