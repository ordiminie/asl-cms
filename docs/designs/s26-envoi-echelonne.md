# Design — Story s26-envoi-echelonne

> Conçu le 2026-11-12, chemin **Claude Design** : brief `docs/designs/s26-envoi-echelonne-brief.md`,
> livraison rapportée par Marie-Ève le 2026-11-12 (export `s26.zip`, fichier
> `s26 Envoi echelonne.dc.html`), puis figée ici. Canevas :
> `https://claude.ai/design/p/dde4b85e-7abf-4396-a406-39a0c5d71da7?file=s26+Envoi+echelonne.dc.html`.
> Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s26-envoi-echelonne.md`.
> **Validé par Marie-Ève le 2026-11-12.** Les cinq points marqués « à confirmer »
> par la maquette (écarts 1 à 5 ci-dessous) sont retenus tels que proposés.
>
> **Web : mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)) : la maquette est
> livrée en clair seul, conformément à l'ADR. Aucun email nouveau dans cette story : pas de jumelle
> « sombre forcé » (§5.2) à produire.

## Screen(s)

Quatre écrans, chacun en **bureau (1 280 px) et mobile (390 px)**. Données fictives : « ASL Les Pins »
(monogramme « LP », teinte 195), **296 membres joignables** (71 sans email, 15 désinscrits), plafond
100 par jour, campagne « Convocation à l'assemblée générale » lancée le 12/11/2026 à 14:32.

| Écran | Route                               | Change par rapport à s25 / s02                                   |
| ----- | ----------------------------------- | ---------------------------------------------------------------- |
| 1     | `/bureau/campagnes/nouvelle/apercu` | annonce l'étalement : plan d'envoi écrit, report éventuel        |
| 2     | `/bureau/campagnes/{id}`            | **l'écran principal** : avancement, parts, état par destinataire |
| 3     | `/bureau/campagnes`                 | l'archive montre l'état (en cours, à vérifier, en échec)         |
| 4     | `/bureau/reglages`                  | un champ : « Plafond quotidien des campagnes »                   |

- **Écran 1 — Aperçu.** La zone d'identité et le cadre email sont inchangés (s25). Sous l'aperçu, une
  section « Destinataires et plan d'envoi » : « 296 membres recevront cette campagne · 71 sans email et 15
  désinscrits n'en recevront pas. » Puis, selon le cas : **envoi unique** (« Elle part en une seule fois,
  aujourd'hui. Vous n'avez rien à faire. ») ou **plan écrit** (« Elle part en 3 jours : » suivi d'une liste
  « 100 membres le 12/11/2026 », nombres alignés à droite en `data`, filet gauche 2 px `border`).
  « Envoyer à 296 membres » (`default`) et « Revenir à la rédaction » (`outline`). La confirmation
  (`alert-dialog`, bouton `destructive` qui nomme l'acte, ancré en bas en mobile) répète le plan :
  « 100 aujourd'hui, 100 demain, 96 après-demain. L'envoi ne peut pas être annulé. »
- **Écran 2 — Une campagne étalée.** `h1` = l'objet, badge d'état de la campagne. Dans l'ordre :
  1. un bandeau d'état (`alert`, un seul à la fois, voir États) ;
  2. carte **Avancement** : `progress` déterminée « 200 sur 296 membres ont reçu la campagne », sans
     pourcentage écrit, puis un compteur à quatre valeurs (Reçue · Programmée · À vérifier · En échec) en
     paires libellé `meta` / valeur `data` 17 px ; 4 colonnes en bureau, **une paire par ligne** en mobile ;
  3. carte **Envois par jour** (absente pour un envoi unique) : tableau Part · Jour · Destinataires · État
     (cartes empilées sous 640 px) ;
  4. carte **Destinataires** : `select` « Afficher » avec le décompte dans chaque option (Tous · Reçue ·
     Programmée · À vérifier · En échec), résumé écrit en `meta` sous le champ (`aria-live`), tableau Nom ·
     Parcelle · État, 25 lignes par page (10 cartes en mobile), « Précédent / Suivant ». Changer de filtre
     revient à la page 1. **Aucun jeton de désinscription n'apparaît.**
  5. carte **Résumé** (reprend s25) : Lancée le · Par · Modèle · Destinataires · **Plafond « 100 envois par
     jour » (seule paire nouvelle)** · « Contenu envoyé » (inchangé, s25).
- **Écran 3 — Archive.** Même tableau que s25. La colonne « Destinataires » devient « 200 sur 296 » pour une
  campagne non terminée ; la colonne d'état porte le badge de la campagne (En cours d'envoi, Envoyée,
  À vérifier, En échec). Reste inchangé : vide, chargement et erreur de s25.
- **Écran 4 — Réglages.** Dans la carte « Envois », sous « Adresse de réponse des campagnes » (existante),
  un champ **numérique** « Plafond quotidien des campagnes » (`data`, unité « envois par jour » à droite),
  aide : « Nombre maximum d'emails de campagne envoyés par jour, toutes campagnes confondues. Le reste de la
  limite d'envoi de votre messagerie est gardé pour les emails de connexion et les autres messages. Par
  défaut : 100. », lien « Revenir à la valeur par défaut », « Enregistrer les réglages ».

### États d'un destinataire (le cœur de la story)

Composés avec le `badge` existant ; **le mot porte l'information**, aucune couleur nouvelle (§3.10).

| État                                | Composition                                                  | Date / précision                               |
| ----------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Reçue                               | `outline`, texte `muted-foreground`                          | « le 12/11/2026 » en `data`, **hors du badge** |
| Programmée pour le 13/11            | `secondary`                                                  | la date est dans le libellé                    |
| À vérifier                          | `outline` + point plein `primary` (comme « Signalé », §3.10) | —                                              |
| En échec                            | `destructive`                                                | —                                              |
| En cours d'envoi (campagne ou part) | `secondary`                                                  | « En cours d'envoi »                           |

Une part programmée pour demain est **« Programmée »**, jamais « Bloquée » ni « Interrompue » (critère de
la story).

## Mockup

`docs/designs/s26-envoi-echelonne/index.dc.html` (+ `Badge.dc.html`, `S1Apercu.dc.html`,
`S2Campagne.dc.html`, `S3Archive.dc.html`, `S4Reglages.dc.html`, `support.js`) — canevas Claude Design, ouvert
via le stub `docs/designs/s26-envoi-echelonne.html`. **NE PAS copier en production** : l'Execute construit les
écrans avec les vrais composants.

⚠️ Même écart que s25 : maquette conservée **telle que livrée**, avec son runtime (`support.js`), qui charge
React et Babel depuis `unpkg.com` et les polices depuis Google Fonts : elle ne s'ouvre qu'avec un accès
réseau. Aucun navigateur n'a été utilisé pour la normaliser en statique. Le fichier `s26.zip` d'origine n'est
pas versionné (règle des zip de design, PR 60).

## Reused components (from the design system)

- **`sidebar`** (entrée « Campagnes » existante, active sur `/bureau/campagnes…`), **`breadcrumb`**.
- **`card`**, **`table`** / cartes empilées (§3.5), **`pagination`**, **`badge`** (`outline`, `secondary`,
  `destructive`), **`skeleton`** (chargement de la liste).
- **`button`** — `default` / `outline` / `destructive` / `link` ; jamais `sm` ; 48 px (56 mobile).
- **`form` `label` `input` `select`** — champ numérique en `data`, unité écrite à droite (§3.1, type
  « Nombre » du registre de réglages).
- **`alert`** — succès neutre (`CircleCheck` `primary`), avertissement `warning`, échec `destructive` 2 px
  (`role="alert"`) ; **`alert-dialog`** — confirmation d'envoi.
- **`progress`** — déterminée « n sur N membres », sans pourcentage (§2.1).
- **Icônes** — `CircleCheck`, `AlertTriangle` ; rien d'autre.

## States

- **Écran 1** : a trois jours · b envoi unique (≤ 100) · c plafond du jour déjà entamé, quatre parts (60
  puis 100, 100, 36) · d plafond du jour atteint, report annoncé (`alert` `warning`, première part demain)
  · e confirmation (`alert-dialog`).
- **Écran 2** : a en cours, part 3 programmée (bandeau neutre « Les envois continuent seuls. Prochaine
  part : le 14/11/2026, 96 membres. Vous n'avez rien à faire. ») · b terminée (succès neutre) · c à
  vérifier (`warning`, lien qui applique le filtre) · d en échec (`destructive` : « La part du 13/11/2026
  n'a pas pu partir après plusieurs essais. 100 membres ont reçu la campagne ; 196 ne l'ont pas reçue. Rien
  n'est renvoyé à ceux qui l'ont déjà reçue. ») · e chargement · f campagne introuvable (ou d'une autre
  association : même message) · g liste vide pour le filtre « À vérifier » · h envoi unique, sans carte
  « Envois par jour » · j juste après la confirmation (`alert` de succès « Campagne lancée. 100 membres la
  reçoivent aujourd'hui, la suite part seule les 13 et 14 novembre. »).
- **Écran 3** : a liste mélangée · b vide · c chargement · d erreur (b, c, d inchangés, s25).
- **Écran 4** : a valeur par défaut (100) · b valeur personnalisée (150) · c erreur de saisie (« Saisissez
  un nombre entier supérieur à 0. », bordure `destructive` 2 px + message + résumé en tête) · d enregistré
  (« Réglage enregistré. Il s'applique aux prochains envois ; une campagne déjà lancée garde son plan. »).

## Design system gaps

À consigner ; **rien n'a été comblé**. Les points 1 à 5 sont ceux que la maquette demande de confirmer.

1. **Filtre de tableau** (ÉCART) — `select` natif « Afficher » (libellé visible, 48/56 px), décompte dans
   chaque option, résumé en `meta` sous le champ. Le design system ne décrit aucun filtre de tableau hors
   recherche. À décrire en §3.5.
2. **`alert` neutre sans icône** (ÉCART) — pour annoncer l'avenir (« Les envois continuent seuls… »), fond
   `muted` et **sans icône** : `CircleCheck` est réservé au succès et aucune icône autorisée ne dit « à
   venir ». Voisin de la variante `alert` « muted » déjà signalée en §9 (s48, écran 5, avec `Lock`) : à
   traiter **ensemble**, une seule variante.
3. **`alert` `warning` pour « plafond atteint, report »** (écran 1d) — §3.10 dit « limite atteinte → `alert`
   `destructive` » ; ici ce n'est pas un refus, la campagne partira. À acter en §3.10.
4. **Compteur à quatre valeurs** — `dl` de paires libellé `meta` / valeur `data` 17 px. Pas de composant
   « statistique » dans le système ; composé avec les jetons existants. Une paire par ligne en mobile
   (quatre paires ne tiennent pas sur 326 px à 15 px).
5. **Plan d'envoi écrit** — liste de lignes « 100 membres le 12/11/2026 », filet gauche 2 px `border`. Pas
   de calendrier ni de frise. À inscrire si le motif revient (s29, s42).
6. **Pagination** — « Précédent » en page 1 rendu inactif (`aria-disabled`, bordure `border`) : le design
   system ne décrit pas cet état.
7. **Badge « à vérifier » / « programmée »** — composition de §3.10 réutilisée telle quelle ; à nommer en
   §3.10 comme « état d'un envoi » pour que s29 et s30 la reprennent.
8. **Rien ne couvre la sortie de « À vérifier »** — le bureau est renvoyé à « l'équipe technique ». Aucune
   action dessinée (ni « Marquer comme reçu », ni « Renvoyer »), voulu : un renvoi réintroduirait le risque
   de doublon. Écran de résolution à décider plus tard si le besoin apparaît.

## Écarts au design retenus par le plan

Versés par l'Execute (plan `docs/plans/s26-envoi-echelonne.md`, « Écarts au design validé »). Aucun
composant ni token nouveau.

1. **Carte « Envois » des Réglages** — la maquette la suppose existante, avec un champ « Adresse de
   réponse des campagnes » : il n'existe pas, les réponses vont à l'adresse de contact (carte des
   adresses de notification). La carte est **créée** par le registre des réglages avec deux champs
   « Nombre » (§3.1) : « Plafond quotidien des campagnes » (100 par défaut, aide de la maquette) et
   **« Nombre de tentatives d'envoi d'une part »** (3 par défaut, entre 1 et 10), que la maquette ne
   dessine pas. L'adresse de réponse n'est pas dupliquée.
2. **État « Désinscrit » d'un destinataire** — un membre désinscrit entre deux parts ne reçoit pas
   les suivantes (ADR 052). Sa ligne porte un `badge` `outline` texte `muted-foreground`, mot
   « Désinscrit », visible dans « Tous » ; **aucun filtre** ni paire de compteur nouveau. Gap
   consigné, non comblé librement.

### Gaps rencontrés à l'implémentation

3. **`select` du socle plutôt que natif** (gap 1) — « Afficher » est le `select` existant du socle
   (le même que « Voir avec un autre membre » de s25) ; la maquette dessinait un `select` natif.
4. **10 cartes par page sous 640 px** — non tenu : la pagination est serveur, 25 lignes par page en
   bureau comme en mobile, comme l'archive de s25. Tenir 10 en mobile demande une pagination qui
   dépend de la largeur de l'écran : à décider si le besoin se confirme.
5. **Paire « Plafond » du Résumé** — elle montre le plafond **actuel** de l'association (Réglages),
   pas celui en vigueur à la création de la campagne : il n'est pas conservé. Le message
   d'enregistrement du réglage dit déjà qu'une campagne lancée garde son plan.
6. **Destinataire dont la fiche a été supprimée** — la ligne reste, nom remplacé par « Fiche
   supprimée » ; à la livraison d'une part suivante, elle passe « En échec » (aucune adresse).
7. **Message d'enregistrement du plafond** (4d) — non implémenté tel quel : la page Réglages garde
   son message commun ; la description de la carte « Envois » dit que le réglage s'applique aux
   prochains envois et qu'une campagne déjà lancée garde son plan.

## À trancher au plan

- **Libellé quand la première part est reportée** (1d) — proposé « Elle part en 3 jours, à partir de
  demain ».
- **Dates ou mots** — « aujourd'hui, demain, après-demain » ne tient pas au-delà de trois parts (1c, 1d) :
  proposé de passer aux dates dans ces cas. La confirmation de l'écran 1e emploie encore les mots.
- **Colonne « Envoyée le »** de l'archive — pour une campagne en cours, c'est la date de lancement :
  renommer « Lancée le » ?
- **Part 3 après une part 2 en échec** (2d) — supposé qu'elle suit en échec (196 en échec, conforme à « 196
  ne l'ont pas reçue »).
- **État « À vérifier » sur une part** (2c) — la part 3 porte « À vérifier » (94 reçus, 2 à vérifier).
- **Message d'enregistrement du plafond** (4d) — à confirmer.
- **Borne haute du plafond** — aucune fixée ; un plafond au-dessus de la limite de la messagerie relève de
  s52.
- **Progression bloquante de s25** (part du jour) — non redessinée ; l'`alert` de succès 2j la remplace après
  la confirmation.
- **Tenant** — les clés « plafond quotidien des campagnes » et « tentatives maximales » du registre de
  réglages (s02) sont créées avec la story ; la valeur par défaut des tentatives est à fixer au `/ks-plan`.
