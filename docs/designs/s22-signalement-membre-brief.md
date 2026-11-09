# Design Brief — Story s22-signalement-membre

> Brief à coller dans Claude Design. Il est autonome : story, écrans, contraintes, livrable.
> **Chaque écran en deux versions : bureau (desktop, 1 280 px) et mobile (390 px)**, même contenu et
> mêmes états. **Thème clair seul** : le produit n'a plus de mode sombre (ADR 033, qui remplace
> l'ADR 012). Ne produisez donc **aucune** version sombre.

## Story

**En tant que** membre propriétaire **je veux** déclarer une fuite depuis mon espace et suivre son statut
**afin de** savoir où en est mon incident sans relancer le bureau.

Critères d'acceptation :

1. Un membre connecté déclare un incident **sans ressaisir son identité** ; le bureau voit le déclarant
   dans la file de suivi.
2. Le membre voit la liste de **ses propres** déclarations avec leur **statut à jour**.
3. Un membre ne voit aucune déclaration d'un autre membre.
4. Le changement de statut par le bureau est visible par le membre déclarant.
5. La notification email part vers les mêmes adresses paramétrées que le signalement public.

**Même formulaire et même workflow que le signalement public** (`/signaler`, s10, déjà livré) : mêmes
champs, mêmes catégories, mêmes statuts. Ce qui change : le membre est connecté, donc il ne saisit
**ni nom, ni email, ni téléphone** (le bureau les reçoit depuis sa fiche), et il retrouve ses
signalements dans son espace.

**Vocabulaire** : vouvoiement ; « espace membre », « bureau », « signalement ». Ni « ticket », ni
« profil », ni « compte utilisateur », ni « identifiant ». Le produit ne connaît pas le genre des
personnes : pas de pronom genré.

## Ce qui existe déjà (à ne pas redessiner)

- **Espace membre** (`/dashboard`), colonne unique `max-w-[1000px]`, cartes empilées (24 px), dans cet
  ordre : marqueur « Espace personnel » (`Lock` + « Espace personnel » + parcelle) ; `h1`
  « Bonjour {nom} » ; carte **« Mes parcelles »** ; carte **« Mes coordonnées »** (lecture, « Modifier mes
  coordonnées » en `outline`) ; carte **« Sécurité du compte »**. Titres de carte en `h2` serif 20 px,
  sans icône. **L'en-tête** (logo ou monogramme à gauche, « Se déconnecter » à droite) est celui de
  s46 : ne rien y ajouter.
- **Retour à l'espace** : sur les écrans de l'espace membre autres que `/dashboard`, la navigation passe
  par un lien dans le contenu, « Revenir à mon espace », icône `ArrowLeft` + libellé (design system §3.12).
  Pas de menu, pas de barre latérale.
- **Formulaire public « Signaler une fuite ou un incident »** (s10) : une `card` avec, dans cet ordre,
  **De quoi s'agit-il ?** (`select`, première option « Choisissez… »), **Où ?** (`input`, aide avec
  exemples), **Que se passe-t-il ?** (`textarea`). Au-dessus, un `alert` neutre : « En cas de danger
  immédiat, appelez les secours (112). Ce formulaire prévient le bureau, pas les services d'urgence. »
  Un seul bouton `default`, « Envoyer le signalement ». Les catégories sont celles du bureau (jusqu'à 10) ;
  **sans aucune catégorie, le champ disparaît** et le formulaire commence par « Où ? ».
- **Statuts d'un signalement** (design system §3.10, à reprendre tels quels) : trois étapes, dans cet
  ordre, sans retour ni saut — **« Signalé »** (`badge` `outline` + point plein `primary` : l'étape qui
  attend le bureau), **« En cours »** (`badge` `secondary`), **« Résolu »** (`badge` `outline`, texte
  `muted-foreground`). Le mot porte l'information ; **jamais de rouge** pour une étape normale.
- **Messages du public à reprendre** : succès « Signalement envoyé. Le bureau de l'association l'a
  reçu. » ; échec « Le signalement n'a pas pu être envoyé. Votre texte est conservé : réessayez dans un
  instant. ».
- **Côté bureau**, la file `/bureau/signalements` (tableau : Catégorie · Où · **Signalé par** · Reçu le ·
  Statut · action « Ouvrir le signalement ») et le détail (sections **Où**, **Ce qui a été signalé**,
  **Coordonnées**, **Suivi**) existent : **on les étend, on n'en crée pas de seconde**.

## Écrans à produire

### Écran A — Espace membre : la carte « Mes signalements »

- **But** : que le propriétaire retrouve ses signalements et leur statut à jour, et puisse en faire un
  nouveau sans quitter son espace.
- **Disposition** : une carte **« Mes signalements »** (titre `h2` serif 20 px), placée **entre « Mes
  coordonnées » et « Sécurité du compte »** (la sécurité reste en dernier). Pas d'icône de carte.
- **Contenu — liste** : un signalement par ligne, **le plus récent d'abord**, lignes séparées par un filet
  1 px `border` (pas de tableau : peu de lignes, lecture en une colonne). Chaque ligne porte :
  - la **catégorie** (`body-strong`) — ou « Sans catégorie » si le signalement a été envoyé sans ;
  - le **lieu**, une ligne en `body`, tronquée (le texte entier n'est pas affiché ici) ;
  - « **Envoyé le** 04/11/2026 » en `meta`, la date en `data` ; et, **quand le statut a changé**,
    « **Mis à jour le** 06/11/2026 » en `meta` ;
  - le **statut** en `badge` (§3.10), seul porteur de l'étape, accompagné de son mot.
- **Action** : bouton `outline` **« Signaler une fuite ou un incident »** sous la liste (ou sous le texte
  d'invitation quand elle est vide). Il mène à l'écran B. Il n'y a pas de `default` sur cet écran.
- **Pas de détail par signalement** : cet écran ne dessine ni page de détail, ni historique, ni
  commentaire (voir « Hors périmètre »).
- **États à montrer** (desktop **et** mobile pour chacun) :
  - `A1` carte avec trois signalements, un par statut (Signalé, En cours, Résolu), dont un avec « Mis à
    jour le » et un sans ;
  - `A2` carte **vide** : « Vous n'avez encore fait aucun signalement. » puis le bouton ;
  - `A3` **chargement** : la carte en `skeleton` (lignes), comme « Mes parcelles » ;
  - `A4` espace membre complet (marqueur, `h1`, les quatre cartes) en `A1`, pour montrer la place de la
    carte ;
  - `A5` après envoi depuis l'écran B : retour sur l'espace, `alert` neutre (`role="status"`,
    `CircleCheck` `primary`) en tête de la carte : « Signalement envoyé. Le bureau de l'association l'a
    reçu. », et le nouveau signalement en tête de liste au statut « Signalé ».
- **Mobile** : carte pleine largeur, marges 16 px ; chaque ligne est un bloc empilé (catégorie, lieu,
  dates, puis badge) ; le bouton fait 56 px, pleine largeur.

### Écran B — Déclarer : « Signaler une fuite ou un incident » (page de l'espace membre)

- **But** : déclarer un incident en trois champs, sans se présenter : le bureau sait déjà qui écrit.
- **Pourquoi une page et non un `dialog`** : un `dialog` n'a droit qu'à deux champs (design system §3.11) ;
  ce formulaire en a trois, dont un texte long. **Page dédiée** de l'espace membre (l'adresse est laissée
  au plan).
- **Disposition** : colonne `max-w-[68ch]` ; lien **« Revenir à mon espace »** (`ArrowLeft` + libellé) ;
  `h1` « Signaler une fuite ou un incident » ; l'`alert` neutre du 112 (texte du public) ; puis le
  formulaire dans une `card`, dans l'ordre du formulaire public : **De quoi s'agit-il ?**, **Où ?**,
  **Que se passe-t-il ?**. Aide de « Où ? » avec exemples, comme au public.
- **Ce que le bureau reçoit — bloc sous le formulaire** (texte, pas un champ) : « Le bureau saura que
  c'est vous : nous lui transmettons votre nom, votre adresse email et votre téléphone. » Puis, en
  `meta`, les trois valeurs de la fiche en lecture (« Lucie Moreau · lucie.moreau@exemple.fr · 06 12 34
  56 78 »). **Jamais de champ modifiable** ici ; un téléphone absent s'écrit « téléphone non renseigné »
  avec un lien « Ajouter mon téléphone » vers « Mes coordonnées » (ancre de l'espace membre).
- **Action** : un seul bouton `default` **« Envoyer le signalement »**, pleine largeur 56 px sur mobile ;
  « Annuler » en `outline` (retour à l'espace) à côté sur desktop, en dessous sur mobile. Pendant
  l'envoi : libellé « Envoi en cours… », bouton désactivé, **largeur conservée**.
- **Erreurs de saisie** : résumé d'erreurs `alert` `destructive` (filet 2 px, `AlertTriangle`,
  `role="alert"`) en tête de formulaire, avec un lien d'ancrage par champ fautif ; bordure 2 px sur le
  champ et message sous le champ en 16 px / 500. Les valeurs saisies sont **conservées**. Les messages
  de validation du formulaire public sont repris tels quels (catégorie obligatoire, lieu et description
  non vides, plafonds de longueur).
- **Échec technique** : `alert` `destructive` ancré : « Le signalement n'a pas pu être envoyé. Votre texte
  est conservé : réessayez dans un instant. »
- **Succès** : on revient à l'écran A (état `A5`). **Rien sur l'état de la notification au bureau** :
  un échec d'envoi d'email ne se montre jamais au membre.
- **États à montrer** (desktop **et** mobile) :
  - `B1` formulaire vierge, avec le bloc « Ce que le bureau reçoit » ;
  - `B2` erreurs de saisie (catégorie non choisie, lieu vide) ;
  - `B3` envoi en cours ;
  - `B4` échec technique ;
  - `B5` association **sans aucune catégorie** : le champ « De quoi s'agit-il ? » a disparu, le formulaire
    commence par « Où ? » ;
  - `B6` téléphone non renseigné dans la fiche (bloc « Ce que le bureau reçoit » avec le lien « Ajouter
    mon téléphone »).
- **Mobile** : champs 56 px ; le `select` et le `textarea` pleine largeur ; boutons 56 px empilés,
  « Envoyer le signalement » en premier.

### Écran C — Bureau : le déclarant d'un signalement de membre (**extension**, pas une nouvelle file)

- **But** : montrer comment un signalement fait par un membre se lit dans la file et le détail **déjà
  livrés**, sans les redessiner.
- **File** (`/bureau/signalements`) : la colonne **« Signalé par »** garde sa forme (nom, puis seconde
  ligne en `meta`). Pour un membre : nom en première ligne ; seconde ligne « **Membre** · » suivie de
  son email, ou de son téléphone s'il n'a que lui. **Du texte seulement** : pas de nouveau `badge`, pas
  d'icône, pas de couleur.
- **Détail** (`/bureau/signalements/{id}`) : la section **Coordonnées** garde ses liens `mailto:` et `tel:` ;
  elle ajoute, sous le nom, la mention « **Membre de l'association** ». Les signalements publics
  continuent d'afficher leurs coordonnées facultatives ou « Aucune coordonnée laissée ».
- **États à montrer** (desktop **et** mobile) : `C1` file avec un signalement de membre entre deux
  signalements publics ; `C2` détail d'un signalement de membre (statut « Signalé », bouton « Passer en
  cours »).
- **Email au bureau** (`email.report.notification`) : aucune planche. Une **annotation** en marge de `C2`
  suffit : les lignes « Déclarant », « Email », « Téléphone » de l'email existant se lisent avec l'identité
  de la fiche au lieu de « non renseigné ».

## Contraintes du design system (non négociables)

### Tokens — thème clair unique

```css
--radius: 0.5rem;
--background: oklch(1 0 0);
--foreground: oklch(0.22 0.015 250);
--card: oklch(1 0 0);
--muted: oklch(0.972 0.005 240);
--muted-foreground: oklch(0.45 0.02 245);
--border: oklch(0.9 0.008 245);
--input: oklch(0.66 0.014 245); /* contour de champ, 3:1 */
--ring: oklch(0.55 0.11 235);
--primary: oklch(0.35 0.06 240);
--primary-foreground: oklch(0.985 0.003 240);
--secondary: oklch(0.965 0.006 240);
--secondary-foreground: oklch(0.3 0.02 245);
--destructive: oklch(0.48 0.17 27);
--destructive-text: oklch(0.48 0.17 27);
--link: oklch(0.45 0.13 250);
--warning: oklch(0.94 0.06 75);
--warning-border: oklch(0.6 0.13 65);
--warning-foreground: oklch(0.3 0.08 60);
--accent-hue: 195; /* seule variable de l'association : identité, jamais une action */
--accent: oklch(0.958 0.024 var(--accent-hue));
--accent-foreground: oklch(0.38 0.08 var(--accent-hue));
--accent-solid: oklch(0.55 0.1 var(--accent-hue));
--overlay: oklch(0.22 0.015 250 / 0.5);
--table-stripe: oklch(0.99 0.002 250);
```

### Typographie

| Token         | Famille        | Taille | Graisse | Usage                                                           |
| ------------- | -------------- | ------ | ------- | --------------------------------------------------------------- |
| `h1`          | Source Serif 4 | 34 px  | 600     | Titre de page                                                   |
| `h2`          | Source Serif 4 | 20 px  | 600     | Titre de carte de l'espace membre                               |
| `h3`          | Public Sans    | 20 px  | 600     | Sous-titre                                                      |
| `body`        | Public Sans    | 17 px  | 400     | Texte courant, valeurs de champ                                 |
| `body-strong` | Public Sans    | 17 px  | 600     | Catégorie d'un signalement, libellé mis en avant                |
| `label`       | Public Sans    | 16 px  | 500     | Libellé de formulaire, aide                                     |
| `button`      | Public Sans    | 16–17  | 600     | Boutons ; 17 px sur mobile                                      |
| `meta`        | Public Sans    | 15 px  | 400     | Mention, aide d'un champ, « Envoyé le », « Mis à jour le »      |
| `data`        | JetBrains Mono | 15–17  | 400     | Dates `jj/mm/aaaa`, téléphone, email en clair, `tabular-nums`   |

Texte courant **17 px**, jamais moins ; plancher 15 px pour `meta` ; pas de graisse 300, pas
d'italique porteur d'information.

### Espacement, formes, cibles

- Échelle : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, **rien d'autre**.
- Rayons : 8 px champs, boutons, cartes ; 12 px dialogues.
- Bordures : 1 px `border` séparation ; 1 px `input` champ ; **2 px = « quelque chose ne va pas »**
  (erreur, résumé d'erreurs).
- Ombres : aucune sur les cartes (la bordure suffit).
- Cibles ≥ 44 × 44 ; **56 px** pour les actions principales sur mobile ; champs 48 px (56 mobile).
- Focus : `outline: 2px solid var(--ring); outline-offset: 2px`, jamais supprimé.
- Points de rupture : `sm` 640 · `lg` 1024. L'espace membre est une colonne unique, sans barre latérale.
- Icônes lucide, trait 1.75, `currentColor` : 16 px dans le texte, 20 px boutons et lignes. Vocabulaire
  figé : `Lock` personnel (réservé au marqueur « Espace personnel »), `ArrowLeft` retour, `AlertTriangle`
  alerte, `CircleCheck` succès. **Aucune icône « signalement »** n'existe : n'en dessinez pas. Jamais
  d'icône seule comme action.

### Composants à réutiliser

- `card` — bordure 1 px, sans ombre.
- `form`, `label`, `input`, `textarea`, `select` — libellé au-dessus, toujours visible ; « Facultatif »
  écrit en `meta`, jamais d'astérisque ; validation au _blur_ puis à la soumission.
- `badge` — **statut, jamais une action** ; les trois statuts de §3.10 ci-dessus.
- `alert` — neutre avec `CircleCheck` `primary` pour un succès (**pas de vert**, il n'existe pas de
  token « succès ») ; `destructive` bordure 2 px pour un résumé d'erreurs ou un échec.
- `button` — `default` (**un seul par écran**), `outline`, `link`. Tailles `default` 48 px, `lg` 56 px,
  **jamais `sm` côté membre**. Libellé à l'infinitif explicite.
- `skeleton` — chargement de listes et de tableaux **seulement, jamais un formulaire**.
- `table` — côté bureau seulement (écran C) ; sous 640 px, **cartes empilées** (une ligne devient une
  carte, 10 par page), jamais de défilement horizontal.

### Do / Don't

- ✅ Le mot porte l'information ; la couleur ne fait que renforcer (le statut s'écrit, il ne se devine
  pas).
- ✅ Un message dit ce qui a eu lieu, ce qui est conservé, et l'action suivante.
- ✅ Une seule action attendue par écran, en `default` ; le reste en `outline`.
- ✅ Vouvoiement, phrases courtes, typographie française (espace insécable avant `: ; ! ?`, guillemets
  « », apostrophe courbe). Dates `jj/mm/aaaa` en `data`.
- ✅ L'écran ne montre **que** des données du membre connecté (design system §3.4).
- ❌ Information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ L'accent de l'association sur un bouton ou comme unique porteur d'un statut.
- ❌ Un champ nom, email ou téléphone dans le formulaire : l'identité vient de la fiche, elle s'affiche
  en texte.
- ❌ Un statut en rouge (sauf une vraie erreur) ; un statut montré par la couleur seule.
- ❌ Un `dialog` pour un formulaire de plus de deux champs.
- ❌ Jargon : « profil », « identifiant », « ticket », « session ».
- ❌ Toute version sombre (ADR 033).

**N'inventez aucun composant, token ou couleur hors de cette liste.** Un besoin non couvert se note en
marge (« MANQUE »), il ne se comble pas.

## Arbitrages de la V1 — validés le 9 novembre 2026

Ces points dépendent du fonctionnement voulu par l'association. **Marie-Ève a validé l'option la plus
simple pour la V1** (9 novembre 2026) : la maquette la montre, sans les rouvrir. Si l'association en
demande davantage, ce sera une story ou un amendement, pas une variante de cette maquette.

1. **Pas de détail ni d'historique pour le membre** : il voit le statut courant et deux dates. S'il doit
   voir la chronologie complète ou **le nom** du membre du bureau qui a fait avancer le dossier, c'est un
   écran de plus.
2. **Le membre ne peut ni modifier, ni compléter, ni retirer** un signalement envoyé.
3. **Le bureau n'a pas de repère visuel propre** aux signalements de membres (texte « Membre » seulement).
4. **Aucune limite d'envois** affichée au membre connecté (le public en a une, « 3 par heure »).
5. **Compte connecté sans fiche** dans l'association : aucune carte « Mes signalements » ; non dessiné.
6. **Nombre de signalements affichés** dans la carte : tous, du plus récent au plus ancien ; aucun
   plafond ni pagination dessinés.

## Hors périmètre

- Le **formulaire public** `/signaler` (s10) : inchangé, toujours sans compte.
- Un **détail** de signalement côté membre, un historique, des commentaires, une photo, une
  géolocalisation, une réouverture, un numéro de dossier.
- **Notifier le membre** (email ou autre) quand le bureau change le statut : la story demande que le
  statut soit **visible**, pas notifié.
- Les écrans du bureau déjà livrés (file, détail, catégories) hors le seul affichage du déclarant ; la
  page Réglages ; l'en-tête, le pied et la barre latérale.
- Les autres cartes de l'espace membre (« Mes parcelles », « Mes coordonnées », « Sécurité du compte »).
- L'imitation d'un compte par le SuperAdmin (s48) : aucun écran propre.
- Toute version sombre.

## Livrable attendu

Une maquette HTML statique (basse fidélité acceptée) avec, pour chaque état listé (`A1`…`A5`,
`B1`…`B6`, `C1`, `C2`), une planche **desktop** et une planche **mobile 390 px**, en n'utilisant que les
tokens ci-dessus. Chaque planche porte sa puce (`A1`, `B3`…). Données fictives : association
« Clos-Fleuri » (monogramme « CF », teinte 195), propriétaire Lucie Moreau, parcelle 12,
lucie.moreau@exemple.fr, 06 12 34 56 78 ; catégories « Fuite d'eau », « Voirie », « Éclairage »,
« Nuisance » ; signalements « Fuite d'eau — chemin des Pins, devant la parcelle 47 » (Signalé, 04/11/2026),
« Éclairage — lampadaire éteint au portail nord » (En cours, envoyé le 28/10/2026, mis à jour le
02/11/2026), « Voirie — nid-de-poule rue des Tilleuls » (Résolu, envoyé le 12/10/2026, mis à jour le
19/10/2026). Les écarts au brief sont signalés en marge (« ÉCART »), les manques du design system aussi
(« MANQUE »), tout ce qui sortirait des arbitrages de la V1 (« HORS V1 »). L'export sera enregistré sous
`docs/designs/s22-signalement-membre.html`.
