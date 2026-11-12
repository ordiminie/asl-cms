# Design Brief — Story s26-envoi-echelonne

> Brief à coller dans Claude Design. Il est autonome : story, écrans, contraintes, livrable.
> **Chaque écran en deux versions : bureau (desktop, 1 280 px) et mobile (390 px)**, même contenu et
> mêmes états.
> **Écrans web : thème clair seul** (ADR 033, qui remplace l'ADR 012 ; `docs/design-system.md` §10 :
> « une livraison de conception ne fournit plus de jeu sombre »). **Cette story n'ajoute aucun email** :
> il n'y a donc rien à livrer en sombre forcé.

## Story

**En tant que** membre du bureau **je veux** que les grosses campagnes s'étalent toutes seules sur
plusieurs jours, et voir qui a reçu la campagne **afin de** ne pas dépasser le quota d'envoi ni générer de
surcoût, et de savoir à qui elle est parvenue.

**Règle arbitrée le 11 novembre 2026.** Une campagne part en envois quotidiens de **100 destinataires au
plus** (plafond paramétrable par association). Le reste de la limite d'envoi de la messagerie est gardé
pour les emails de connexion. **Aucun message « vous avez trop de destinataires »** : l'étalement est
automatique, le bureau n'a rien à faire. Un plafond **par jour et par association, partagé entre toutes les
campagnes** : deux campagnes lancées le même jour se partagent les 100 envois.

Critères qui touchent l'écran :

- Une campagne au-dessus du plafond part en parts quotidiennes (la première le jour même, les suivantes
  les jours suivants) ; en dessous ou égale, elle part en un seul envoi.
- 250 destinataires → trois parts (100, 100, 50). Le nombre de parts découle du nombre de destinataires
  et du plafond, jamais d'un chiffre écrit en dur.
- **Indicateur par destinataire** : le bureau voit, pour chaque destinataire, s'il a reçu la campagne —
  _reçue_ (avec la date d'envoi), _programmée pour le <jour>_, _à vérifier_ ou _en échec_ — et, pour la
  campagne, le nombre de destinataires de chaque part et l'état de chacune.
- La liste des destinataires est **paginée**, ne montre que ceux de cette campagne et de cette
  association, **sans jamais afficher les jetons de désinscription**.
- Une campagne en cours d'étalement **n'est pas présentée comme interrompue** : une part programmée pour
  demain est _programmée_, pas _bloquée_.
- _À vérifier_ : un arrêt survenu entre l'envoi et son enregistrement. Le destinataire n'est **jamais
  renvoyé en silence** : l'état est visible du bureau.
- _En échec_ : après plusieurs tentatives, le bureau voit la campagne en échec.

## Ce qui existe déjà (à ne pas redessiner)

Livré par la story s25 (`docs/designs/s25-campagnes-email.md`) ; **on le modifie, on ne le refait pas** :

- **Back-office** : barre latérale 248 px (tiroir sous 1 024 px) ; groupe « L'association » =
  Propriétaires, **Campagnes**, Identité, Réglages. `breadcrumb` dès le 2ᵉ niveau.
- **Archive des campagnes** (`/bureau/campagnes`) : `h1` « Campagnes », tableau Objet · Envoyée le · Par ·
  Modèle · Destinataires · « Consulter », 25 lignes par page (10 cartes sous 640 px).
- **Aperçu avant l'envoi** (`/bureau/campagnes/nouvelle/apercu`) : identité de l'aperçu, cadre email,
  rappel du décompte (« 296 membres recevront cette campagne · 71 sans email et 15 désinscrits n'en
  recevront pas »), « Envoyer à 296 membres » (`default`), `alert-dialog` de confirmation.
- **Une campagne archivée** (`/bureau/campagnes/{id}`) : `h1` = l'objet + badge `outline` « Envoyée »,
  cartes « Résumé » et « Contenu envoyé », aucune action.
- **Réglages de l'association** (`/bureau/reglages`, s02) : cartes empilées, un champ par ligne rendu
  selon le type du paramètre (texte, nombre…), valeur par défaut, retour au défaut en vidant le champ.

## Écrans à produire

Quatre écrans. Données fictives : association **« ASL Les Pins »** (monogramme « LP », teinte 195),
**296 membres joignables**, 71 sans email, 15 désinscrits. Plafond : **100 par jour**. Campagne :
« Convocation à l'assemblée générale », lancée le **12/11/2026 à 14:32** par Marie Delorme.

| Écran | Route                               | Rôle                                                     |
| ----- | ----------------------------------- | -------------------------------------------------------- |
| 1     | `/bureau/campagnes/nouvelle/apercu` | l'aperçu : on annonce l'étalement avant de confirmer     |
| 2     | `/bureau/campagnes/{id}`            | une campagne étalée : parts, destinataires, état de tous |
| 3     | `/bureau/campagnes`                 | l'archive : l'état de chaque campagne d'un coup d'œil    |
| 4     | `/bureau/reglages`                  | le champ « Plafond quotidien des campagnes »             |

### Statuts à utiliser (design system §3.10 — **le mot porte l'information**)

Aucune couleur nouvelle. On compose les variantes existantes du `badge` :

| Mot écrit (campagne ou destinataire)   | Forme                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| **Reçue** (avec la date) / **Envoyée** | `outline`, texte `muted-foreground` (étape close)          |
| **Programmée pour le 13/11**           | `secondary` (étape à venir, rien à faire)                  |
| **En cours d'envoi** (campagne)        | `secondary`                                                |
| **À vérifier**                         | `outline` avec point plein `primary` (demande une action)  |
| **En échec**                           | `destructive` (vraie erreur, seule à porter cette couleur) |

Deux badges sur une ligne : `gap` 8 px. **Jamais l'accent de l'association** sur un statut.

### Écran 1 — Aperçu : annoncer l'étalement

On ne redessine que **ce qui change** sur l'écran 3 de s25 ; le reste (identité de l'aperçu, cadre email,
actions) est inchangé et montré en réduit.

- **Le rappel du décompte** s'allonge d'un **plan d'envoi écrit**, juste au-dessus des actions :
  « **296 membres** recevront cette campagne · 71 sans email et 15 désinscrits n'en recevront pas. »
  puis « **Elle part en 3 jours** : 100 membres le 12/11/2026, 100 le 13/11/2026, 96 le 14/11/2026. Vous
  n'avez rien à faire. » (dates en `data`, une ligne par jour). Un campagne de 100 ou moins : « Elle part
  **en une seule fois, aujourd'hui**. »
- **Si d'autres campagnes ont déjà pris une partie du plafond du jour** : une phrase en plus — « 40 envois
  de campagne sont déjà partis aujourd'hui : celle-ci commence avec les 60 qui restent. » et le plan
  d'envoi devient 60 · 100 · 100 · 36 sur quatre jours.
- **Si le plafond du jour est déjà atteint** : `alert` `warning` (trio `warning` + `AlertTriangle` + mot
  écrit « Attention ») : « Les envois de campagne du jour sont déjà complets. La première part partira
  demain, le 13/11/2026. » Le bouton **reste visible et actif** (§3.10) : ce n'est pas un refus, c'est un
  report annoncé.
- **Le bouton garde son libellé** « Envoyer à 296 membres » ; le `alert-dialog` de confirmation ajoute
  une phrase : « 296 membres vont recevoir « ASL Les Pins — Convocation à l'assemblée générale », en 3
  jours : 100 aujourd'hui, 100 demain, 96 après-demain. L'envoi ne peut pas être annulé. » Boutons
  inchangés (`destructive` qui nomme l'acte / « Revenir à l'aperçu » en `outline`).
- **Après la confirmation** : on arrive sur l'écran 2 avec un `alert` de succès (`CircleCheck` `primary`,
  `role="status"`) : « Campagne lancée. 100 membres la reçoivent aujourd'hui, la suite part seule les 13 et
  14 novembre. Suivez-la ci-dessous. » (La `progress` bloquante de s25 ne s'applique plus qu'à la part du
  jour ; l'écran ne reste pas ouvert plusieurs jours.)

**États (desktop et mobile)** : **a** · 3 jours · **b** · un seul envoi (≤ 100) · **c** · plafond déjà
entamé (quatre parts) · **d** · plafond du jour atteint (`alert` `warning`) · **e** · confirmation
(`alert-dialog`, ancré en bas en mobile).

### Écran 2 — Une campagne étalée

`breadcrumb` « Campagnes › {objet} ». `h1` = l'objet, **un badge de statut à côté** (voir tableau).
Colonne 720 px, puis cartes empilées dans cet ordre. Aucune action qui modifie la campagne (ni annuler, ni
renvoyer, ni « reprendre » : voir « Hors périmètre »).

1. **Bandeau d'état** (`alert`, juste sous le titre) — _en cours_ : `alert` neutre : « Les envois
   continuent seuls. Prochaine part : le 14/11/2026, 96 membres. Vous n'avez rien à faire. » Une part
   programmée pour demain **n'est jamais** présentée comme interrompue.
2. **Carte « Avancement »** — `progress` **déterminée** (source réelle : destinataires qui l'ont reçue sur
   le total), libellé « **200 sur 296** membres ont reçu la campagne. » (aucun pourcentage écrit) + trois
   compteurs en `data` : Reçue 200 · Programmée 96 · À vérifier 0 · En échec 0 (quatre paires libellé /
   valeur, une ligne en mobile).
3. **Carte « Envois par jour »** — **affichée seulement s'il y a plus d'une part**. Tableau de 3 lignes :
   **Part** (1, 2, 3) · **Jour** (`data`, 12/11/2026) · **Destinataires** (`data`, 100 / 100 / 96) ·
   **État** (badge : Envoyée · Envoyée · Programmée pour le 14/11). Sous 640 px : cartes empilées, une par
   part.
4. **Carte « Destinataires »** — au-dessus, un `select` « **Afficher** » (libellé visible) : Tous (296) ·
   Reçue (200) · Programmée (96) · À vérifier (0) · En échec (0), **le décompte écrit dans chaque option**.
   Tableau paginé, **25 lignes** par page (10 cartes sous 640 px), « Précédent / Suivant » écrits :
   **Nom** · **Parcelle** (`data`) · **État** (badge, avec la date d'envoi en `data` pour _Reçue_, « le
   13/11 » pour _Programmée_). **Ni adresse email, ni jeton** : le bureau n'a pas besoin de lire l'adresse
   pour savoir si la campagne est arrivée. Le filtre choisi se lit dans un résumé : « 96 destinataires —
   programmés ».
5. **Carte « Résumé »** et carte **« Contenu envoyé »** — inchangées (s25), avec en plus dans le Résumé la
   paire « **Plafond** · 100 envois par jour ».

**États (desktop et mobile)** :

- **a · En cours** — part 1 envoyée, parts 2 et 3 programmées (le cas ci-dessus : 200 sur 296 après deux
  parts).
- **b · Terminée** — badge `outline` « Envoyée », `alert` neutre « Campagne terminée : les 296 membres
  l'ont reçue. » (`CircleCheck` `primary`).
- **c · À vérifier** — badge de campagne « À vérifier » ; `alert` `warning` : « 2 destinataires sont à
  vérifier. L'envoi s'est arrêté au moment où l'on ne savait pas si leur email était parti. Nous ne
  le renvoyons pas, pour ne pas leur écrire deux fois. Contactez l'équipe technique pour les vérifier. »
  Le filtre « À vérifier (2) » est proposé sous l'alerte (lien).
- **d · En échec** — badge `destructive` « En échec » ; `alert` `destructive` ancré (`role="alert"`),
  **ce qui s'est passé, ce qui est perdu, l'action suivante** : « La part du 13/11/2026 n'a pas pu partir
  après plusieurs essais. 100 membres ont reçu la campagne ; 196 ne l'ont pas reçue. Rien n'est renvoyé à
  ceux qui l'ont déjà reçue. Contactez l'équipe technique. »
- **e · Chargement** — `skeleton` sur les trois tableaux ; l'objet et le badge d'abord.
- **f · Campagne introuvable** — `alert` `destructive` : « Cette campagne n'existe pas ou n'appartient pas
  à votre association. » + lien « Retour aux campagnes ».
- **g · Liste vide pour ce filtre** — « Aucun destinataire à vérifier. » (pas d'action).
- **h · Campagne en un seul envoi (≤ 100)** — la carte « Envois par jour » **disparaît** ; l'indicateur par
  destinataire reste.
- **i · Mobile** (390 px) — états a, c, d.

### Écran 3 — L'archive montre l'état

Sur la liste de s25 : une colonne **État** (badge) **avant** « Consulter », et la colonne « Destinataires »
devient « **Reçue par** » : « 200 sur 296 » en `data` quand la campagne est en cours ou incomplète, « 296 »
quand elle est terminée. Cinq lignes d'exemple : _En cours d'envoi_ (200 sur 296), _Envoyée_, _Envoyée_,
_À vérifier_ (294 sur 296), _En échec_ (100 sur 296). Mobile : cartes empilées, le badge sous l'objet.
**États** : a · liste mélangée · b · vide (inchangé s25) · c · chargement · d · erreur (inchangés).

### Écran 4 — Réglages : le plafond quotidien

Sur la page Réglages existante, **un champ de plus** dans la carte qui porte déjà les paramètres d'envoi :
libellé « **Plafond quotidien des campagnes** » (`label`, visible), champ numérique 48 px (56 mobile),
valeur par défaut **100** écrite, aide en dessous : « Nombre maximum d'emails de campagne envoyés par jour,
toutes campagnes confondues. Le reste de la limite d'envoi de votre messagerie est gardé pour les emails de
connexion et les autres messages. Par défaut : 100. »
**États** : a · valeur par défaut · b · valeur personnalisée (« 150 ») avec lien « Revenir à la valeur par
défaut » · c · erreur de saisie (« Saisissez un nombre entier supérieur à 0. », bordure 2 px
`destructive` + résumé ancré) · d · enregistré (`alert` neutre : « Réglage enregistré. Il s'applique aux
prochains envois ; une campagne déjà lancée garde son plan. » — **à confirmer au plan**).
**Pas de nouvelle page ni de nouvelle carte** : le rendu est celui des autres paramètres de s02.

## Contraintes du design system (non négociables)

### Jetons — thème clair seul (web)

```
--background: oklch(1 0 0);                 --foreground: oklch(0.22 0.015 250);
--card: oklch(1 0 0);                       --card-foreground: oklch(0.22 0.015 250);
--muted: oklch(0.972 0.005 240);            --muted-foreground: oklch(0.45 0.02 245);
--border: oklch(0.9 0.008 245);             --input: oklch(0.66 0.014 245);   /* contour de champ, 3:1 */
--ring: oklch(0.55 0.11 235);
--primary: oklch(0.35 0.06 240);            --primary-foreground: oklch(0.985 0.003 240);
--secondary: oklch(0.965 0.006 240);        --secondary-foreground: oklch(0.3 0.02 245);
--destructive: oklch(0.48 0.17 27);         --destructive-foreground: oklch(0.99 0.01 27);
--destructive-text: oklch(0.48 0.17 27);    /* texte d'erreur */
--link: oklch(0.45 0.13 250);               /* toujours souligné */
--warning: oklch(0.94 0.06 75);             --warning-border: oklch(0.6 0.13 65);
--warning-foreground: oklch(0.3 0.08 60);
--accent-hue: 195;  --accent: oklch(0.958 0.024 195);  --accent-foreground: oklch(0.38 0.08 195);
--accent-solid: oklch(0.55 0.1 195);        --accent-border: oklch(0.88 0.045 195);
--overlay: oklch(0.22 0.015 250 / 0.5);     /* voile du dialog et de l'alert-dialog */
--table-stripe: oklch(0.99 0.002 250);      --table-row-hover: var(--muted);
--sidebar: oklch(0.985 0.004 250);          --sidebar-accent: oklch(0.93 0.012 245);
--sidebar-border: oklch(0.91 0.008 245);
--radius: 0.5rem;
```

**Accent de l'association** : identité seulement (logo, filet de navigation active, encarts). **Jamais
sur un bouton, jamais comme seul porteur d'un statut.** `primary` pour toute action, toute sélection,
toute icône fonctionnelle. Survols de menus et de lignes en `secondary`, jamais en accent.

### Typographie

- **Source Serif 4** (titres) : `h1` 34 px / 600 / 1.15 ; `h2` de carte du back-office 24 px / 600 ;
  `h3` Public Sans 20 px / 600 pour un titre de carte du back-office quand c'est le cas.
- **Public Sans** (interface) : `body` 17 px / 400 / 1.6 (privé) ; **`body-lg` 18 px / 1.65 (site
  public, donc la page de désinscription)** ; `body-strong` 17 px / 600 ; `label` 16 px / 500 (libellés,
  toujours visibles) ; `button` 16-17 px / 600 ; `meta` 15 px / 400 — plancher absolu 15 px.
- **JetBrains Mono** : `data` 15-17 px, `tabular-nums` — dates, heures, nombres de destinataires,
  variables `{nom}`.
- Pas de graisse 300, pas d'italique porteur d'information, pas de capitales au-delà de trois mots.
  Typographie française : espace insécable avant `: ; ! ?`, guillemets « », apostrophe courbe.
- **Email** : `Georgia, serif` / `Helvetica, Arial, sans-serif`, corps 17 px, titres 24 px.

### Espacement, rayon, bordures, ombres

- Échelle : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px. **Toute mesure hors échelle est un bug.**
- Rayon : 4 px puces ; **8 px champs, boutons, cartes** ; 12 px dialogues.
- Bordures : 1 px `border` séparation ; 1 px `input` champ ; **2 px `primary` sélection ; 2 px
  `destructive` erreur** (épaisseur unique de « quelque chose ne va pas »).
- Ombres : **aucune** sur cartes et tableaux (la bordure suffit) ; `shadow-lg` seulement sur dialogues.
  Transitions ≤ 120 ms. Pas de dégradé, pas de verre dépoli, pas d'animation d'apparition.
- Focus : `outline: 2px solid var(--ring); outline-offset: 2px`, jamais retiré. Cibles ≥ 44 × 44 ;
  **56 px pour les actions principales sur mobile**. Aucune action au survol seul.
- Points de rupture : `sm` 640 · `md` 768 · `lg` 1024 (barre latérale 248 px → tiroir sous `lg`) ·
  `xl` 1280. Marges 16 px sous 1 024 px. Site public : `max-w-[1200px]`, article `max-w-[68ch]`.

### Composants à réutiliser (rien d'autre)

- **`card`** — bordure 1 px, sans ombre, padding 24 px (16 px mobile), `h2` serif (24 px).
- **`button`** — `default` 48 px (56 mobile), `outline`, `destructive`, `link`. **Un seul `default`
  par écran**, les autres en `outline`. Libellés à l'infinitif explicite, jamais « OK ». Chargement :
  libellé remplacé, bouton désactivé, **largeur conservée**. **`sm` 40 px : jamais côté membre** (la
  page publique de désinscription est côté membre).
- **`form` `label` `input` `textarea` `select` `radio-group`** — une colonne, un champ par ligne, libellé
  au-dessus, champs 48 px (56 mobile), texte 17 px, « Facultatif » écrit, **jamais d'astérisque, jamais
  de placeholder en guise de libellé**. Validation au _blur_ puis à la soumission. `radio-group` pour
  2-3 options courtes, `select` au-delà.
- **Compteur de caractères** (§3.9) — `meta` aligné à droite, neutre jusqu'au plafond inclus, rouge
  seulement au dépassement et avec un message écrit.
- **`markdown-editor`** — barre réduite : gras, italique, titre 2, titre 3, liste, lien.
- **`table` `pagination` `badge`** — lignes 56 px, zébrure, **une seule action par ligne, en clair**,
  25 lignes par page (**10 cartes** sous 640 px), « Précédent / Suivant » écrits. `badge` = statut,
  jamais une action. Deux badges sur une ligne : `gap` 8 px.
- **`alert`** — **succès** : `alert` neutre avec `CircleCheck` en `primary` (pas de vert, pas de token
  « succès ») ; **erreur** : `destructive`, bordure 2 px, `role="alert"`, ancré dans la page, ne
  disparaît pas seul ; **avertissement** : trio `warning` + `AlertTriangle` + mot écrit. **Rien
  d'important dans un toast.**
- **`alert-dialog`** — uniquement pour l'irréversible, le bouton nomme l'acte. **Mobile** : ancré en bas,
  pleine largeur, boutons 56 px empilés, le principal en premier, pas de croix.
- **`progress`** — pourcentage seulement quand la source compte vraiment (emails envoyés sur le total).
- **`skeleton`** — listes, tableaux et cadre d'aperçu, jamais un formulaire.
- **`breadcrumb`** (dès le 2ᵉ niveau), **`separator`**, **`sidebar`** (back-office seulement).
- **`<AssociationMark />`** — logo ou monogramme, le nom toujours écrit.
- **Icônes lucide** (16 / 20 / 24, trait 1,75, `currentColor`) : `CircleCheck`, `AlertTriangle`,
  `ArrowLeft`. **Jamais d'icône seule comme action** ; on n'en ajoute pas d'autre.

### Patrons déjà arrêtés qu'il faut suivre

- **États** (§3.2) : le vide dit ce qui manque **et** l'action pour le combler ; l'erreur dit ce qui
  s'est passé, **ce qui est perdu**, l'action suivante ; le succès dit ce qui a eu lieu et où le
  vérifier.
- **Erreurs** (§3.1, §3.9) : bordure 2 px + message sous le champ **+** résumé ancré en tête avec liens
  d'ancrage ; message de champ en 16 px / 500, `--destructive-text`.
- **Action refusée parce qu'une limite est atteinte** (§3.10) : le bouton reste **visible et actif**,
  le refus arrive en `alert` `destructive`.
- **Tableau sous 640 px** (§3.5) : cartes empilées, 10 par page.
- **Langue** (§3.6) : vouvoiement, phrases courtes, **aucun jargon** — **jamais « lien magique »,
  « token », « OTP », « authentification »** à l'écran. Les textes de la page publique et de l'email
  (« les campagnes de l'ASL Les Pins ») sont arrêtés dans ce brief : ne les remplacez pas. Dates
  `02/09/2026` en champ et en liste ; en clair côté public (« 12 novembre 2026 »).
- **Objets d'email** (§5.6) : préfixés « ASL Les Pins — », **60 caractères maximum**, l'information
  d'abord, **jamais de majuscules, jamais d'emoji, jamais « URGENT »** ; pré-en-tête de **90 caractères**
  qui complète l'objet sans le répéter ; réponse dirigée vers une boîte réellement lue.

### À ne pas faire

- ❌ Inventer un composant, un jeton, une couleur, une taille hors de ceux-ci.
- ❌ Une couleur seule pour porter une information (statut, sélection, erreur) : **le mot porte
  l'information**.
- ❌ Un `tabs`, une `sidebar` ou un menu d'icônes côté membre ; un `collapsible` ou un `tooltip` pour
  cacher une information utile ; un défilement infini ; un toast pour une confirmation qui compte.
- ❌ Texte courant sous 17 px ; astérisque pour l'obligatoire ; placeholder en guise de libellé.
- ❌ L'accent de l'association sur un bouton.
- ❌ Un jeu sombre **pour le web** (seul l'email a une version sombre forcée).
- ❌ En email : OKLCH, police web, flex/grid, bouton sans URL en clair dessous, information dans une image.
- ❌ « Vous ne pouvez pas vous désinscrire », ou **toute phrase sur ce que le membre continuera de
  recevoir** après sa désinscription.

Ne pas inventer de composants, de jetons ou de couleurs hors de ceux-ci.

## Hors périmètre

- **Le budget quotidien de tous les emails sortants** (invitations, relances, lancement), la **réserve pour
  les emails de connexion** et le **report d'un email isolé** : story s52, aucun écran ici. L'écran 4 ne
  montre que le plafond **des campagnes**.
- **Le ciblage** (impayés, groupes), le brouillon, la planification choisie par le bureau, la duplication.
- **Annuler, mettre en pause, reprendre ou renvoyer** une campagne ou une part ; un bouton « Réessayer »
  (il risquerait de réécrire à ceux qui l'ont reçue). Le bureau **regarde**, il ne pilote pas.
- **Résoudre un destinataire « à vérifier »** depuis l'écran : le bureau le voit, l'équipe technique le
  traite.
- **Les statistiques** (ouvertures, clics, rebonds) et le **journal des envois par membre**.
- **L'email lui-même** (habillage, objet, pied) et la page de désinscription : inchangés (s25).
- **L'adresse email des destinataires et leur jeton de désinscription** : jamais affichés.
- Le déclenchement technique (minuterie, planificateur) : aucun écran.

## Livrable attendu

Une maquette HTML statique des écrans 1 à 4 (basse fidélité acceptée) : **version bureau (1 280 px) et
version mobile (390 px)** pour chacun, **thème clair seul**, avec les états listés, n'utilisant que les
jetons ci-dessus. Rapportez l'export : il sera enregistré en `docs/designs/s26-envoi-echelonne.html`.

**Signalez en marge de la maquette (« ÉCART », « PROPOSITION », « NOTE », « AU PLAN ») tout besoin que le
design system ne couvre pas, sans le combler.** Cinq sont déjà connus et à confirmer :

1. **Les quatre états d'un destinataire** (reçue, programmée, à vérifier, en échec) — composés à partir des
   variantes de `badge` de §3.10 (le mot porte l'information). Confirmez, ou proposez mieux **avec
   l'existant**.
2. **Filtrer un tableau** — un `select` « Afficher » avec les décomptes dans les options, au-dessus d'un
   tableau paginé ; le design system ne décrit aucun filtre de tableau.
3. **Un compteur à quatre valeurs** (Reçue · Programmée · À vérifier · En échec) sous la `progress` — des
   paires libellé / valeur en `data`, sans nouveau composant.
4. **Un bandeau d'état qui annonce l'avenir** (« Les envois continuent seuls… ») — un `alert` neutre ;
   aucune notion de « tâche programmée » dans le design system.
5. **Un plan d'envoi écrit** (« 100 le 12/11, 100 le 13/11, 96 le 14/11 ») dans l'aperçu — une liste de
   lignes `data` ; pas de calendrier, pas de frise.
