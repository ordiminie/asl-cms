# Design Brief — Story s08-formulaire-contact

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** visiteur **je veux** envoyer un message au bureau depuis le site **afin de** poser une
question sans avoir de compte.

Acceptance criteria:

1. Un envoi valide enregistre le message, affiche une confirmation et notifie par email l'adresse
   paramétrée de l'association.
2. Un envoi invalide (email mal formé, message vide) affiche les erreurs **par champ**, n'enregistre
   rien et n'envoie aucun email.
3. Le bureau consulte en back-office la liste des messages reçus, **triée par date**, avec le détail de
   chaque message.
4. Changer l'adresse de notification dans les Réglages redirige le message suivant vers la nouvelle
   adresse.
5. Au-delà d'un nombre d'envois **par heure et par visiteur** fixé en paramètre de l'association, une
   soumission supplémentaire est **refusée avec un message explicite** ; en deçà, elle passe.
6. Le compteur repose sur une empreinte d'adresse IP hachée (aucune IP en clair) — _mécanique, aucun
   écran._
7. Une opération de purge supprime les empreintes de plus de 24 h — _mécanique, aucun écran._

Contexte produit : le site public s'adresse aux propriétaires (souvent âgés) et aux visiteurs sans
compte ; le back-office est tenu par 3 à 8 bénévoles élus, non techniciens. Critère de recette : un
visiteur écrit au bureau sans aide, et un membre du bureau retrouve son message **seul devant l'écran**.

**Exigence explicite de la story : l'email ne suffit pas.** Le message est persisté et consultable en
back-office. Une maquette qui ne montrerait que le formulaire et l'email rate la story.

**Un écran `/contact` existe déjà** (hérité du boilerplate). Ce brief décrit l'**écran cible**, pas
l'existant : l'existant est hors charte sur deux points (voir « Écarts connus »).

### Arbitrages déjà rendus — ne pas les rouvrir

- **Champs : nom (facultatif), email, objet, message.** Rien d'autre.
- **L'objet est un champ de texte libre.** Une liste d'objets administrable a été envisagée puis
  **écartée** : la catégorisation et le routage sont la machinerie d'une autre story (s10), et le
  formulaire « Questions au bureau » routé par catégorie appartient à l'espace membre (s22). **Ne
  proposer ni sélecteur d'objets, ni liste déroulante, ni écran d'administration des objets.**
- **Échec de notification** : le visiteur voit **la même confirmation** — son message est bien
  enregistré. C'est côté bureau que la liste signale la notification non envoyée.
- **Écran du bureau** : liste triée par date + détail, avec un état **lu / non lu**, **sans archivage**,
  dans le groupe **« Le site »** de la barre latérale.
- **Refus au-delà du seuil** : message explicite à l'écran, et **aucun captcha visible** (règle du
  design system). Cet état fait partie de la maquette.

## Screens to produce

Quatre écrans, plus des repères de continuité à ne pas redessiner. Données fictives : association
**« Les Amis de l'Étang »**, teinte **« eau » (195)**. Messages d'exemple :

| Objet                           | De                                          | Reçu le                | État                                  |
| ------------------------------- | ------------------------------------------- | ---------------------- | ------------------------------------- |
| Analyse d'eau du forage         | Claire Meunier — claire.meunier@example.fr  | 2 septembre 2026 14:32 | Non lu                                |
| Vente de ma parcelle n° 47      | _(nom non renseigné)_ — m.dubois@example.fr | 1 septembre 2026 09:05 | Non lu · **Notification non envoyée** |
| Branche cassée chemin des Pins  | Paul Ferrand — p.ferrand@example.fr         | 28 août 2026 18:47     | Lu                                    |
| Demande du compte rendu de l'AG | Hélène Roy — helene.roy@example.fr          | 21 août 2026 11:20     | Lu                                    |

### 0 · Repères de continuité — déjà livrés, **ne pas redessiner**

- **Site public** : en-tête (logo ou monogramme + nom + menu) et pied de page existent. Un simple
  bandeau neutre suffit à situer l'écran 1 dans la page.
- **Back-office** : barre latérale `sidebar` (248 px fixe → tiroir `sheet` sous `lg`), identité de
  l'association en tête (34 px + nom), deux groupes : **« Le site »** (Pages, Navigation) et
  **« L'association »** (Identité, Réglages). Cette story ajoute **« Messages reçus »** au groupe
  **« Le site »**, **après « Navigation »**. Montrer la barre latérale avec « Messages reçus » actif
  sur l'écran 2 seulement (fond `sidebar-accent` + libellé en 600). _(D'autres stories ajoutent des
  entrées au même groupe en parallèle : l'ordre définitif se règle à l'intégration, pas ici. Les items
  de cette barre n'ont pas d'icône — ne pas en ajouter.)_
- **Page « Réglages »** : elle est **générée** depuis un registre de paramètres typés ; un réglage d'un
  type déjà couvert **ne demande aucun écran nouveau**. Les deux réglages de cette story s'y rendent
  seuls :
  - **Adresse de notification** (existe déjà) — `input` type email ;
  - **Nombre de messages par heure et par visiteur** (nouveau) — `input` numérique en `data`
    (`font-mono`, `tabular-nums`), **unité écrite à droite** : « messages par heure ».
    En montrer **un simple extrait** (deux lignes de la page Réglages), pour prouver que rien de neuf
    n'est nécessaire. Ne pas dessiner une page Réglages complète.

### 1 · Site public — Écrire au bureau (`/contact`)

- **Purpose** : un visiteur sans compte écrit au bureau et sait que son message est arrivé.
- **Layout** : gabarit public `max-w-[1200px]`, contenu centré à `max-w-[68ch]`.
  - `h1` « Contacter le bureau » (Source Serif 4, 34 px).
  - Un paragraphe d'introduction en `body-lg` (18 px / 1,65) : « Une question sur l'eau, les parcelles
    ou la vie de l'association ? Écrivez au bureau. Il vous répondra à l'adresse que vous indiquez
    ici. » **Pas de slogan générique** (« Nous sommes là pour vous »), pas d'icône décorative.
  - Le formulaire dans une `card` (bordure 1 px, sans ombre), une colonne, un champ par ligne.
- **Champs — exactement quatre, dans cet ordre.** Libellé **au-dessus**, toujours visible, 16 px / 500.
  Champs de 48 px (56 px en mobile), texte 17-18 px. **Jamais de placeholder en guise de libellé,
  jamais d'astérisque** : « Facultatif » est écrit en clair.
  1. **Votre nom** — `input`, libellé suivi de « Facultatif ». Aide sous le champ : « Le bureau saura
     mieux à qui il répond. »
  2. **Votre adresse email** — `input` type email, `autocomplete="email"`, `inputmode="email"`, sans
     majuscule automatique. Aide : « C'est à cette adresse que le bureau vous répondra. »
  3. **Objet** — `input` **texte libre**. Aide : « En quelques mots, le sujet de votre message. »
     **Ce n'est pas une liste déroulante et il n'y a pas de catégories.**
  4. **Votre message** — `textarea` d'environ 8 lignes, redimensionnable verticalement.
- **Action** : un **seul** bouton `default`, « Envoyer le message », 48 px (56 px et pleine largeur en
  mobile). Aucun autre bouton. Pas de « Réinitialiser ».
- **Validation** : au _blur_, puis à la soumission. Les mêmes règles s'appliquent côté serveur : un
  message refusé revient avec **les erreurs par champ**, jamais un seul message global.
- **States à montrer** (les cinq) :
  1. **Vierge** — formulaire vide, prêt à la saisie.
  2. **Erreurs par champ (critère 2)** — c'est l'état le plus important de cet écran. Il cumule
     **trois signaux**, et les trois sont exigés :
     - un **résumé ancré en tête du formulaire** : `alert` `destructive`, `role="alert"`,
       `AlertTriangle` 20 px, titre « Le message n'a pas été envoyé. », puis la liste des champs en
       **liens d'ancrage** (« Votre adresse email », « Votre message ») qui amènent au champ, et la
       phrase « Votre texte est conservé. » ;
     - sur chaque champ fautif, une **bordure `destructive` de 2 px** ;
     - **sous** chaque champ fautif, le message : « Cette adresse email n'est pas valide. Vérifiez
       qu'elle contient un @ et un nom de domaine. » / « Écrivez votre message avant de l'envoyer. »
       Dans cet état, montrer aussi le champ **Objet** valide, pour que le contraste se voie.
  3. **Envoi en cours** — bouton désactivé, libellé remplacé par « Envoi en cours… », **largeur
     conservée**. Les champs restent lisibles. Pas de `skeleton` (jamais sur un formulaire).
  4. **Succès (critère 1)** — le formulaire est remplacé par un **`alert` neutre ancré**, `CircleCheck`
     20 px en `primary` : « Message envoyé. Le bureau de l'association l'a reçu et vous répondra à
     l'adresse claire.meunier@example.fr. » Dessous, un bouton `outline` « Écrire un autre message ».
     **Pas de vert, pas de fond coloré, pas de toast.**
     ⚠️ **Le même écran s'affiche si l'email de notification au bureau n'est pas parti** : le message
     est enregistré et consultable, le visiteur n'a rien à réparer. Aucun état supplémentaire à
     dessiner de ce côté.
  5. **Refus au-delà du seuil (critère 5)** — `alert` `destructive` ancré **en tête du formulaire**,
     `AlertTriangle`, **le texte saisi reste à l'écran** : « Vous avez envoyé plusieurs messages coup
     sur coup. Ce formulaire accepte {N} messages par heure. Réessayez dans une heure, ou appelez le
     bureau de votre association. **Votre texte est conservé.** » Le bouton d'envoi est désactivé.
     `{N}` est **le réglage de l'association**, jamais un chiffre en dur dans la maquette : l'écrire
     comme une valeur variable (montrer « 3 » à titre d'exemple, annoté « valeur du réglage »).
     **Aucun captcha, aucune case « je ne suis pas un robot », aucune énigme** : la limitation est
     côté serveur et invisible.
- **Mobile (390 px)** : gouttière 18 px, champs à 56 px, bouton d'envoi en pleine largeur 56 px. Le
  résumé d'erreurs reste en tête de formulaire. Aucun repli de contenu, aucun « lire la suite ».

### 2 · Back-office — Messages reçus (`/bureau/messages`)

- **Purpose** : voir tous les messages reçus depuis le site, du plus récent au plus ancien, repérer
  ceux qui n'ont pas encore été lus, en ouvrir un.
- **Layout** : `h1` « Messages reçus ». Sous le titre, une ligne `meta` : « 2 messages non lus ».
  **Aucun bouton `default`** : le bureau ne crée pas de message. Dessous, un `table` dans une `card`
  pleine largeur, **trié par date décroissante** :
  - **Objet** — colonne d'identité, `body-strong` ;
  - **De** — le nom s'il est renseigné, sinon l'adresse email, en `body` ; l'adresse en seconde ligne
    en `meta` ;
  - **Reçu le** — `02/09/2026` en `data` (`font-mono`, `tabular-nums`) ;
  - **État** — `badge` à **point + libellé écrit** : « Non lu » / « Lu ». Jamais la couleur seule. Sur
    la ligne concernée, un **second `badge`** dessous : `AlertTriangle` 16 px + « Notification non
    envoyée » ;
  - **Action** — **une seule par ligne, en clair** : « Ouvrir le message ». Pas de menu d'icônes en
    bout de ligne.
  - Ligne non lue : l'objet en 600. **Le mot porte l'information, la graisse ne fait que renforcer.**
- **Pagination** : `pagination` sous le tableau, « Précédent / Suivant » **écrits**, « Page 1 sur 2 »
  écrit entre les deux, **25 lignes par page**. Jamais de défilement infini.
- **Ni recherche, ni filtre, ni tri par colonne, ni case à cocher de sélection multiple** : hors
  critères (voir « Out of scope »).
- **States à montrer** :
  - **Vide** : « Aucun message pour l'instant. Les messages envoyés depuis la page Contact du site
    apparaissent ici. » + un lien « Voir la page Contact du site ». _(Proposition : le bureau ne peut
    pas créer de message, l'action utile est donc d'aller voir le formulaire. À annoter.)_
  - **Chargement** : `skeleton` sur les lignes du tableau.
  - **Succès** : les 4 messages d'exemple, avec les deux états et le badge de notification non
    envoyée.
  - **Erreur** : aucune à dessiner ici.
- **Mobile (390 px)** : patron **« tableau → cartes empilées »**. Une ligne devient une carte :
  **Objet en titre**, puis « De », « Reçu le », « État » en paires libellé / valeur dans **l'ordre des
  colonnes du bureau**, puis « Ouvrir le message » en **pleine largeur, 56 px**. **10 cartes par
  page.** Pas de défilement horizontal, pas de colonne masquée.

### 3 · Back-office — Détail d'un message (`/bureau/messages/{id}`)

- **Purpose** : lire un message en entier et savoir à qui répondre.
- **Pourquoi une page et non un `dialog`** : un message peut être long, et le `dialog` du design
  system est réservé aux formulaires de deux champs au plus. Une page se lit, s'imprime et se partage
  par URL. _(Choix de conception, à confirmer au plan.)_
- **Layout** : colonne unique, `max-w-[68ch]`, dans cet ordre :
  1. « ← Messages reçus » en `link` souligné, en tête ;
  2. le `h1` = **l'objet du message** (34 px, Source Serif 4) ;
  3. une ligne `meta` : « Reçu le 2 septembre 2026 à 14 h 32 » ;
  4. un bloc **expéditeur** : « De : Claire Meunier » en `body-strong`, puis l'adresse email en `link`
     souligné, cliquable (`mailto:`) — c'est le chemin de réponse du bureau. Quand le nom manque :
     « De : nom non renseigné », l'adresse seule dessous. _(Le `mailto:` est une proposition ; le
     produit n'écrit pas de réponse — voir « Out of scope ».)_
  5. le **message**, en `body` 17 px, **retours à la ligne conservés**, sans troncature ni
     « lire la suite ».
- **Actions** : un seul bouton, en `outline` : « Marquer comme non lu ». Le message est **marqué lu à
  l'ouverture** ; le dire en une ligne `meta` sous le bouton : « Marqué comme lu à l'ouverture. »
  **Pas de suppression, pas d'archivage.**
- **States à montrer** :
  - **Message lu, nom renseigné** (cas courant) ;
  - **Notification non envoyée** : un `alert` `destructive` **ancré au-dessus de l'expéditeur** :
    « Ce message est bien enregistré, mais l'email d'avertissement au bureau n'est pas parti. **Rien
    n'est perdu** : le message est là, et l'adresse de notification se vérifie dans Réglages. » + un
    lien « Ouvrir les Réglages ». C'est l'exemple même de l'erreur du design system : ce qui s'est
    passé, ce qui est perdu (rien), l'action suivante ;
  - **Sans nom** : montrer une fois, en mobile par exemple ;
  - **Message long** : au moins un état avec un texte de 12 à 15 lignes, pour vérifier la longueur de
    ligne.
- **Mobile (390 px)** : gouttière 16 px, « Marquer comme non lu » en pleine largeur 56 px, le lien de
  retour en tête.

### 4 · Email — Notification d'un message au bureau

- **Purpose** : l'adresse paramétrée de l'association apprend qu'un message est arrivé, avec de quoi
  répondre sans ouvrir le back-office.
- **Contraintes du médium — elles priment sur toutes les règles du web** (voir plus bas) : 600 px,
  tables imbriquées, styles **en ligne**, **aucun OKLCH, aucune variable CSS, aucun Tailwind**, une
  seule colonne, polices de repli `Georgia, serif` (titres) et `Helvetica, Arial, sans-serif` (texte),
  corps 17 px / 1,6, titres 24 px.
- **Objet** : « Les Amis de l'Étang — Nouveau message depuis le site » (préfixé du nom de
  l'association, **60 caractères au plus**, l'information d'abord, **ni majuscules, ni emoji, ni
  « URGENT »**).
- **Pré-en-tête** (90 caractères, complète l'objet sans le répéter) : « Claire Meunier écrit au sujet
  de l'analyse d'eau du forage. »
- **Structure** :
  1. **En-tête** — logo **PNG** 36 px (ou monogramme) + nom de l'association, filet `accent-solid`
     `#17849B`, fond `accent` `#E8F5F8`. Reste lisible **images bloquées** : le logo porte un `alt`
     qui est le nom de l'association.
  2. **Titre** 24 px Georgia : « Nouveau message depuis le site ».
  3. **Une table de deux colonnes** (libellé `#52565E` / valeur `#1B1E26`) : De · Adresse email ·
     Objet · Reçu le. **L'adresse email du visiteur est écrite en clair** dans cette table et
     cliquable en `mailto:` — c'est elle qui permet au bureau de répondre.
  4. **Le message**, dans un encart `muted` `#F6F7F8` avec filet `#DFE1E5`, retours à la ligne
     conservés.
  5. **Un bouton en table** (pas de `<button>`), hauteur ≥ 48 px, fond `#2C3F63`, libellé
     `#FDFDFE !important` : « Ouvrir le message dans le back-office ». **Toujours doublé de l'URL en
     clair juste dessous**, en `#2B57A8`.
  6. **Pied de page** — fond `#F6F7F8`, texte `#52565E`. Il dit **pourquoi l'email arrive** : « Cet
     email vous est envoyé parce que votre adresse est celle qui reçoit les messages du formulaire de
     contact du site des Amis de l'Étang. Cette adresse se change dans les Réglages de
     l'association. » **Pas de lien de désinscription** (l'envoi n'est pas une campagne), et **jamais**
     la formule « vous ne pouvez pas vous désinscrire ».
- **Versions à fournir** : rendu **600 px** et rendu **mobile 390 px** ; **clair** et **mode sombre
  forcé** (Outlook, Gmail Android l'imposent, indépendamment du thème du site). En sombre, doivent
  rester lisibles : le corps, le libellé du bouton, l'URL en clair, le pied. Peuvent être sacrifiés :
  le fond de l'en-tête, le filet teinté.
- **Version texte brut** : obligatoire (§5 du design system). En écrire une, à côté du rendu HTML :
  mêmes informations, URL en clair, pas d'art ASCII.

## Design system constraints (non-negotiable)

**Tokens — deux thèmes, clair et sombre (ADR 012).** Le back-office reprend les mêmes tokens que le
public ; seule la `sidebar` a sa propre palette.

**Clair** (`:root`) :

```
--background: oklch(1 0 0)                 --foreground: oklch(0.22 0.015 250)
--card: oklch(1 0 0)                       --muted: oklch(0.972 0.005 240)
--muted-foreground: oklch(0.45 0.02 245)   --border: oklch(0.9 0.008 245)
--input: oklch(0.66 0.014 245)             --ring: oklch(0.55 0.11 235)
--primary: oklch(0.35 0.06 240)            --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.965 0.006 240)        --secondary-foreground: oklch(0.3 0.02 245)
--destructive: oklch(0.48 0.17 27)         --destructive-foreground: oklch(0.99 0.01 27)
--link: oklch(0.45 0.13 250)
--warning: oklch(0.94 0.06 75)             --warning-border: oklch(0.72 0.12 70)
--warning-foreground: oklch(0.3 0.08 60)
--accent-hue: 195 (démo « eau » ; teinte réelle injectée par association, six teintes possibles)
--accent: oklch(0.958 0.024 195)           --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)        --accent-border: oklch(0.88 0.045 195)
--sidebar: oklch(0.985 0.004 250)          --sidebar-foreground: oklch(0.26 0.015 250)
--sidebar-accent: oklch(0.93 0.012 245)    --sidebar-border: oklch(0.91 0.008 245)
--radius: 0.5rem (rounded-md 8px champs/boutons/cartes, rounded-lg 12px dialogues/feuilles,
                  rounded-full badges)
```

**Sombre** (`.dark`) :

```
--background: oklch(0.215 0.009 255)       --foreground: oklch(0.94 0.006 250)
--card: oklch(0.215 0.009 255)             --muted: oklch(0.255 0.009 250)
--muted-foreground: oklch(0.72 0.015 248)  --border: oklch(0.33 0.01 250)
--input: oklch(0.52 0.016 250)             --ring: oklch(0.7 0.12 235)
--primary: oklch(0.5 0.14 255)             --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.27 0.01 250)          --secondary-foreground: oklch(0.9 0.008 250)
--destructive: oklch(0.58 0.19 27)         --link: oklch(0.8 0.1 250)
--accent: oklch(0.275 0.035 195)           --accent-foreground: oklch(0.84 0.075 195)
--accent-solid: oklch(0.64 0.11 195)       --accent-border: oklch(0.4 0.055 195)
--sidebar: oklch(0.19 0.009 255)           --sidebar-foreground: oklch(0.93 0.006 250)
--sidebar-accent: oklch(0.3 0.014 250)
```

**Email — jumelles hexadécimales des tokens** (l'email n'a **ni OKLCH ni variable CSS**) :

```
background #FFFFFF · foreground #1B1E26 · muted #F6F7F8 · muted-foreground #52565E
border #DFE1E5 · input #8E939C · primary #2C3F63 · primary-foreground #FDFDFE
link #2B57A8 · destructive #B32317
accent-solid (teinte 195) #17849B · accent #E8F5F8 · accent-foreground #185A66
```

**Typographie** :

- **Source Serif 4** — titres : `h1` 34 px / 600, `h2` 26 px / 600.
- **Public Sans** — texte : `h3` 20 px / 600, `body` 17 px (back-office), `body-lg` 18 px / 1,65 (site
  public), `body-strong` 17 px / 600, `label` 16 px / 500, `button` 16-17 px / 600, `meta` 15 px
  (dates, aides, compteurs).
- **JetBrains Mono** — `data` pour les dates en tableau, avec `tabular-nums` ; `overline` 12 px / 600.

Règles : texte courant **jamais sous 17 px**, et **jamais sous 18 px en public** · libellés toujours
visibles, **jamais de placeholder en guise de libellé**, **jamais d'astérisque** (« Facultatif »
écrit) · longueur de ligne 60-75 caractères (`max-w-[68ch]`) en public · `text-wrap: pretty` sur les
titres · dates en clair côté public (« 2 septembre 2026 »), `02/09/2026` en tableau et en champ ·
typographie française (espace insécable avant `: ; ! ?`, guillemets « », apostrophe courbe).

**Espacement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, **rien d'autre**.

- **Site public** : `max-w-[1200px]`, gouttière 24 / 44 px, 18 px en mobile.
- **Colonne de lecture / formulaire** : `max-w-[68ch]`.
- **Back-office** : barre latérale de 248 px, en tiroir (`sheet`) sous `lg`.
- Points de rupture : `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

**Cibles, focus, mouvement** : cible minimale **44 × 44**, **56 px** pour les actions principales en
mobile · `outline: 2px solid var(--ring); outline-offset: 2px`, **jamais `outline: none`** · **aucune
action déclenchée au survol seul** · transitions ≤ 120 ms sur couleur et bordure ·
`prefers-reduced-motion` respecté.

**Bordures** : 1 px `border` séparation · 1 px `input` champ (3:1) · 2 px `primary` sélection · **2 px
`destructive` erreur**. **Ombres** : aucune sur les cartes de contenu et les tableaux — la bordure
suffit ; `shadow-lg` réservé aux dialogues et tiroirs.

**Icônes lucide** : 16 (dans le texte) / 20 (boutons, lignes) / 24 px, trait 1,75, `currentColor`.
**Toujours icône + libellé**, jamais une icône seule comme action. Vocabulaire figé utile ici :
`AlertTriangle` = alerte. `CircleCheck` = le succès ancré. **Il n'existe pas d'icône « message » au
vocabulaire** : ne pas en inventer (voir Écarts).

**Composants à réutiliser tels quels** :

- **`button`** : variantes `default` `outline` `secondary` `destructive` `link`, tailles 40 / 48 / 56
  px. **Un seul bouton `default` par écran**, le reste en `outline`. Libellés à l'infinitif explicite
  (« Envoyer le message », pas « OK »). Chargement : libellé remplacé, bouton désactivé, **largeur
  conservée**. Survol de `outline` en `secondary`, **jamais en accent**.
- **`form` `label` `input` `textarea`** : une colonne, un champ par ligne, libellé au-dessus, champs
  48 px (56 mobile), texte 17-18 px, validation au _blur_ puis à la soumission.
- **`table` `pagination` `badge`** : lignes 56 px, texte 17 px, en-tête sur `muted` en 15 px / 600,
  zébrure `oklch(0.99 0.002 250)`, **une seule action par ligne, en clair**, dates en `font-mono` +
  `tabular-nums`, **25 lignes par page (10 cartes sous 640 px)**, « Précédent / Suivant » écrits,
  **jamais de défilement infini**. `badge` = **statut**, jamais une action.
- **`alert`** : erreur **et** succès **ancrés dans la page**, ils ne disparaissent pas seuls. **Rien
  d'important ne passe par un toast.**
- **`card`** : bordure 1 px, sans ombre. **`skeleton`** : listes et tableaux uniquement, **jamais un
  formulaire**. **`sheet`** : tiroir mobile du back-office. **`sidebar`** : back-office uniquement,
  item actif = fond `sidebar-accent` + libellé en 600.

**Patrons imposés** :

- **Formulaire en erreur (§3.1)** : bordure `destructive` 2 px **+** message sous le champ **+**
  résumé en tête de formulaire **avec liens d'ancrage**. Les trois, pas un seul.
- **Les quatre états (§3.2)** : **Vide** = ce qui manque + l'action pour le combler · **Chargement** =
  `skeleton` sur les listes, libellé remplacé sur un bouton · **Erreur** = ce qui s'est passé, ce qui
  est perdu, l'action suivante, ancrée · **Succès** = ce qui a eu lieu et où le vérifier, en `alert`
  **neutre** avec `CircleCheck` en `primary` — **il n'y a pas de token « succès », pas de vert**.
- **`primary` ou accent** : `primary` pour toute action, toute sélection, toute icône fonctionnelle ;
  l'accent de l'association pour **l'identité seulement**. **Jamais d'accent sur un bouton.**
- **Tableau sous 640 px** : **cartes empilées** — colonne d'identité en titre, les autres en paires
  libellé / valeur dans l'ordre des colonnes, action en pleine largeur 56 px, 10 cartes par page. Les
  deux autres options (défilement horizontal, colonnes masquées) sont **écartées** et ne se
  réintroduisent pas story par story.
- **Langue (§3.6)** : vouvoiement, phrases courtes, **aucun jargon**. Jamais « token », « captcha »,
  « rate limit », « back-office » à l'écran public.

**Do / Don't** :

- ✅ Sobre, aéré, très lisible. Registre de service public local, pas de startup.
- ✅ **Le mot porte l'information ; la couleur ne fait que renforcer.** Statut = point + libellé écrit.
- ✅ Un message d'erreur dit ce qui est perdu — et ici, **rien ne l'est**.
- ✅ Une seule action attendue par écran, en `default` ; le reste en `outline`.
- ❌ **Pas de vert, pas de carte de succès colorée, pas d'icône verte.**
- ❌ Pas de captcha, pas de case « je ne suis pas un robot », pas d'énigme.
- ❌ L'accent de l'association sur un bouton, ou comme seul porteur d'un statut.
- ❌ Une information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ Défilement infini, menu d'icônes en bout de ligne, action au survol seul.
- ❌ Densité de tableau de bord SaaS ; dégradés, verre dépoli, ombres lourdes, animations d'apparition.
- ❌ En email : OKLCH, police web, flex/grid, bouton sans URL en clair dessous.

Ne pas inventer de composant, de token ni de couleur hors de cette liste. Un besoin non couvert se
**signale** en marge de la maquette, il ne se dessine pas en freestyle.

## Écarts connus au design system (à signaler dans la maquette, pas à combler)

1. **La carte de succès actuelle de `/contact` est verte** (`border-green-200 bg-green-50/50`, coche
   verte) : **le design system l'interdit** — il n'existe pas de token « succès » et pas de vert
   (§3.2). L'écran cible utilise un `alert` **neutre** avec `CircleCheck` en `primary`. C'est une
   **correction**, pas une invention : ne pas reproduire l'existant.
2. **Le résumé d'erreurs ancré avec liens d'ancrage n'a jamais été maquetté.** §3.1 l'exige (« résumé
   en tête de formulaire avec liens d'ancrage ») mais aucune planche du design system n'en montre la
   forme, et l'écran actuel n'affiche qu'un message global unique. **Proposer une forme** (`alert`
   `destructive`, titre, liste de liens vers les champs, phrase de réassurance) et **l'annoter comme
   proposition à verser au design system** — ce formulaire est le premier du produit à en avoir besoin.
3. **Aucune icône « message » au vocabulaire figé** (§1.7 : `Droplet`, `FileText`, `Receipt`, `Map`,
   `Megaphone`, `AlertTriangle`, `Lock`, `GripVertical`). L'écran actuel utilise `Mail` et `Send`,
   hors vocabulaire. **Ne pas en ajouter** : les écrans se lisent sans icône. Si la maquette en
   propose une pour l'entrée de barre latérale, l'annoter comme écart à trancher.
4. **Aucun des sept envois maquettés (§5.5) ne couvre une notification interne au bureau**, et §5.4 ne
   prévoit que deux pieds de page (facultatif avec désinscription, statutaire sans). Cet email est un
   **troisième cas**, comme le transactionnel du lien de connexion : il dit **pourquoi il arrive**,
   sans désinscription. **Proposer ce pied et l'annoter** comme extension à verser au design system.
5. **État « notification non envoyée » dans une liste** : le design system ne prévoit qu'un `badge` de
   statut par ligne. Deux badges sur la même ligne (« Non lu » + « Notification non envoyée ») est une
   **proposition** — l'annoter, et montrer qu'elle tient en carte empilée sur mobile.

## Points laissés au plan — à ne pas trancher dans la maquette

Ces points sont techniques : ils n'ont **aucune conséquence visuelle** et le plan les tranchera.
Ne pas les faire apparaître à l'écran, ne pas dessiner d'écran pour eux.

- Où les messages sont stockés (table réemployée ou table dédiée).
- La forme du limiteur d'envois (fenêtre horaire fixe ou glissante, table utilisée).
- La purge des empreintes de plus de 24 h : elle n'a **aucune interface**, ni bouton, ni page de
  supervision, ni compteur affiché.
- L'adresse de réponse de l'email de notification (mécanisme de « Répondre » du client de messagerie).
  C'est pourquoi la maquette écrit **l'adresse du visiteur en clair** dans le corps : l'email
  fonctionne quelle que soit la décision technique.

## Out of scope

- **Sélecteur d'objets, catégories, routage par sujet, écran d'administration des objets** : écartés
  par arbitrage. L'objet est un champ de texte libre.
- **Archivage, suppression, recherche, filtres, tri par colonne, sélection multiple, réponse rédigée
  depuis le produit, accusé de réception par email au visiteur** : aucun n'est dans les critères.
- **Le formulaire « Questions au bureau » de l'espace membre** (identifié, routé par catégorie) : autre
  story, autre modèle, **ne pas fusionner ni s'en inspirer**.
- **La page d'administration SuperAdmin des soumissions** (hors espace bureau) et le bouton de
  « retour rapide » hérités du boilerplate : ils existent, ne pas les redessiner.
- **La page « Réglages »** : elle est générée depuis le registre, aucun écran nouveau — seul un extrait
  de deux lignes est demandé (écran 0).
- **Case de consentement / mention RGPD** sous le formulaire : aucune durée de conservation des
  messages n'est fixée à ce jour, donc rien à afficher. À rouvrir quand la rétention sera décidée.
- **Écrans de supervision de la limitation** (compteurs, empreintes, journal des refus) : aucun.
- **L'en-tête, le pied et le menu du site public, la barre latérale du back-office, la page 404** :
  déjà livrés.
- ⚠️ **Un lien vers `/contact` ailleurs que dans le pied de page écrit à la main** : le menu du site ne
  peut pointer que vers des pages du CMS, `/contact` n'en est pas une. Aujourd'hui, seul le pied de
  page (markdown libre) peut y mener. **C'est une limite connue, hors critères de cette story** : la
  signaler en marge, ne pas dessiner d'évolution de l'écran « Navigation » pour la combler.

## Expected output

Un mockup HTML statique des écrans 1 à 4, basse fidélité acceptée :

- en **desktop et en mobile 390 px** pour les écrans 1 à 3 ; en **600 px et en mobile 390 px** pour
  l'email (écran 4) ;
- en **clair et en sombre**, avec une bascule (ADR 012 : les deux jeux de tokens ci-dessus) — et, pour
  l'email, le rendu **clair** et le rendu en **mode sombre forcé** ;
- avec **tous les états listés** pour chaque écran, y compris les erreurs par champ du formulaire
  public et le refus au-delà du seuil ;
- en utilisant **exclusivement** les tokens et composants ci-dessus ;
- avec une section ancrée par écran ;
- avec les écarts annotés en marge.

Il sera enregistré comme `docs/designs/s08-formulaire-contact.html`.
