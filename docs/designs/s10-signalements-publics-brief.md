# Design Brief — Story s10-signalements-publics

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** visiteur **je veux** signaler une fuite ou un incident sans compte **afin que** le
bureau intervienne vite.

Acceptance criteria:

1. Un signalement valide (catégorie, localisation, description, coordonnées facultatives) est
   enregistré, **confirmé à l'écran** et notifié par email aux adresses paramétrées de l'association.
2. Le signalement apparaît dans une **file de suivi** en back-office avec le statut initial
   **« Signalé »**.
3. Le bureau le fait passer de « Signalé » à **« En cours »** puis à **« Résolu »** ; chaque
   changement est **horodaté et attribué à son auteur**.
4. Les **catégories** (fuite, voirie, éclairage, nuisance…) sont **administrables par le bureau**,
   dans la limite de **10** ; la 11ᵉ est refusée avec un message explicite.
5. Supprimer une catégorie **ne supprime pas** les signalements déjà reçus dans cette catégorie.
6. Une catégorie peut porter une **adresse de routage facultative** : renseignée puis relue, elle
   revient inchangée ; laissée vide, elle se lit comme **absente** (« aucune »), jamais comme un
   champ vide.
7. Changer les adresses de notification dans les Réglages change les destinataires du signalement
   suivant — _aucun écran nouveau, la page Réglages existe._
8. Un signalement public n'est **jamais rattaché à un membre**, même si l'email saisi est celui d'un
   membre — _mécanique, aucun écran._
9. Le formulaire est soumis à la **même limitation d'envois** que le formulaire de contact : au-delà
   du seuil, refus avec un message explicite.

Contexte produit : le site public s'adresse aux propriétaires (souvent âgés, peu à l'aise avec
l'informatique) et aux visiteurs sans compte ; le back-office est tenu par 3 à 8 bénévoles élus, non
techniciens. Une fuite sur un réseau d'eau privé se signale **vite, depuis un téléphone, souvent
dehors** : l'écran public est d'abord un écran mobile.

### Arbitrages déjà rendus — ne pas les rouvrir

- **Le modèle est un signalement catégorisé, pas une « fuite »** : fuite, voirie, éclairage,
  nuisance… sont des catégories administrables.
- **Destinataires de l'email** (déjà écrit dans la page Réglages livrée) : l'**adresse de contact**
  reçoit tous les signalements ; l'**adresse du responsable forage** reçoit **en plus** les
  signalements **de fuite**. L'adresse de routage d'une catégorie **n'est pas utilisée** par les
  signalements (elle servira aux questions au bureau, une autre story) : elle se saisit et se relit
  ici, sans effet sur l'envoi. **Le dire sous le champ.**
- **Pas de rapprochement avec un membre**, pas de compte, pas de suivi par le visiteur (le suivi
  depuis l'espace membre est une autre story).
- **Même limitation que le contact**, même message, **aucun captcha visible**.
- **Échec de l'email au bureau** : le visiteur voit la même confirmation ; c'est côté bureau que la
  file le signale (précédent : « Notification non envoyée » des Messages reçus).
- **Statuts à sens unique** : Signalé → En cours → Résolu. Réouvrir un signalement résolu n'est pas
  dans les critères : **ne pas dessiner de réouverture**.

## Screens to produce

Cinq écrans, plus des repères de continuité à ne pas redessiner. Données fictives : association
**« Les Amis de l'Étang »**, teinte **« eau » (195)**.

Catégories d'exemple (4 sur 10) : **Fuite d'eau** · **Voirie et chemins** · **Éclairage** ·
**Nuisance**. Une catégorie **supprimée** : « Portail » (des signalements anciens la portent encore).

Signalements d'exemple :

| Catégorie         | Localisation                           | Signalé par                         | Reçu le          | Statut                                    |
| ----------------- | -------------------------------------- | ----------------------------------- | ---------------- | ----------------------------------------- |
| Fuite d'eau       | Chemin des Pins, devant la parcelle 47 | _anonyme_                           | 29/09/2026 07:42 | Signalé · **Notification non envoyée**    |
| Éclairage         | Lampadaire à l'entrée nord             | Paul Ferrand — p.ferrand@example.fr | 27/09/2026 21:10 | En cours                                  |
| Voirie et chemins | Nid-de-poule allée des Chênes          | Hélène Roy — 06 12 34 56 78         | 20/09/2026 10:05 | Résolu                                    |
| Portail           | Portail sud bloqué ouvert              | _anonyme_                           | 02/09/2026 18:30 | Résolu · catégorie supprimée depuis       |

Historique d'exemple (signalement « Éclairage ») : Signalé le 27/09/2026 à 21 h 10 depuis le site ·
Passé « En cours » le 28/09/2026 à 09 h 15 par Marie Delorme.

### 0 · Repères de continuité — déjà livrés, **ne pas redessiner**

- **Site public** : en-tête (logo ou monogramme + nom + menu) et pied de page existent. Un bandeau
  neutre suffit à situer l'écran 1.
- **Back-office** : barre latérale `sidebar` (248 px fixe → tiroir `sheet` sous `lg`), identité de
  l'association en tête (34 px + nom), deux groupes. **« Le site »** : Pages, Actualités, Analyses
  d'eau, Navigation, Messages reçus, Membres du bureau, Bandeau d'alerte. **« L'association »** :
  Identité, Réglages. Cette story ajoute **« Signalements »** au groupe « Le site », **après
  « Messages reçus »** (l'ordre définitif se règle à l'intégration). Les items n'ont pas d'icône,
  sauf le Bandeau d'alerte — **ne pas en ajouter**. Actif = fond `sidebar-accent` + libellé en 600.
- **Page « Réglages »** : générée depuis un registre ; les deux adresses (contact, responsable
  forage) et le seuil d'envois par heure **existent déjà**. Aucun écran à dessiner.
- **Le formulaire de contact** (`/contact`) : c'est le **précédent visuel direct** de l'écran 1 —
  même gabarit, même résumé d'erreurs ancré, même succès neutre, même refus au-delà du seuil.

### 1 · Site public — Signaler une fuite ou un incident

- **Purpose** : un visiteur sans compte signale un problème en moins d'une minute, et sait que le
  bureau l'a reçu.
- **Layout** : gabarit public `max-w-[1200px]`, contenu à `max-w-[68ch]`.
  - `h1` « Signaler une fuite ou un incident ».
  - Introduction en `body-lg` : « Une fuite, un chemin abîmé, un lampadaire éteint ? Dites-le au
    bureau. Il n'y a pas besoin de compte. » **En cas de danger immédiat**, une phrase en `alert`
    neutre au-dessus du formulaire : « En cas de danger immédiat, appelez les secours (112). Ce
    formulaire prévient le bureau, pas les services d'urgence. » _(Proposition, à annoter.)_
  - Le formulaire dans une `card` (bordure 1 px, sans ombre), une colonne, un champ par ligne.
- **Champs, dans cet ordre.** Libellé au-dessus, 16 px / 500, toujours visible. **Jamais de
  placeholder en guise de libellé, jamais d'astérisque.**
  1. **De quoi s'agit-il ?** — la catégorie. Au plus 10 options : suivre la règle du design system
     (`radio-group` jusqu'à 3 options, `select` au-delà). Avec 4 catégories : `select`, première
     option vide « Choisissez… » jamais présélectionnée. _(Annoter : un `radio-group` vertical serait
     plus lisible pour ce public jusqu'à 10 options courtes — écart à trancher, ne pas le dessiner
     comme la solution.)_
  2. **Où ?** — `input` texte. Aide : « Une adresse, un numéro de parcelle ou un repère : "devant le
     portail nord", "parcelle 47". »
  3. **Que se passe-t-il ?** — `textarea` ~6 lignes. Aide : « Décrivez ce que vous voyez. Depuis
     quand, si vous le savez. »
  4. Un sous-titre `h3` **« Vos coordonnées »** suivi de « Facultatif. Laissez-les si vous souhaitez
     que le bureau puisse vous recontacter. » puis trois champs, chacun libellé « Facultatif » :
     **Votre nom** · **Votre adresse email** (`type="email"`, `autocomplete="email"`) · **Votre
     téléphone** (`type="tel"`, `autocomplete="tel"`).
- **Action** : **un seul** bouton `default`, « Envoyer le signalement », 48 px (56 px pleine
  largeur en mobile).
- **States à montrer** :
  1. **Vierge**.
  2. **Erreurs par champ** — les trois signaux exigés : résumé `alert` `destructive` 2 px en tête
     (`role="alert"`, `AlertTriangle` 20 px, titre « Le signalement n'a pas été envoyé. », liens
     d'ancrage « De quoi s'agit-il ? », « Que se passe-t-il ? », puis « Votre texte est conservé. ») ;
     bordure `destructive` 2 px sur chaque champ fautif ; message dessous en `--destructive-text`
     16 px / 500 (« Choisissez ce que vous signalez. » / « Décrivez ce que vous voyez avant
     d'envoyer. »). Montrer aussi « Où ? » valide, et un email mal formé dans les coordonnées.
  3. **Envoi en cours** — libellé « Envoi en cours… », bouton désactivé, **largeur conservée**.
  4. **Succès** — le formulaire est remplacé par un `alert` **neutre** ancré, `CircleCheck` 20 px
     en `primary` : « Signalement envoyé. Le bureau de l'association l'a reçu. » Si une adresse ou un
     téléphone a été laissé : « Il pourra vous recontacter au 06 12 34 56 78. » Sinon : « Vous
     n'avez pas laissé de coordonnées : le bureau ne pourra pas vous tenir informé. » Dessous, un
     bouton `outline` « Signaler autre chose ». **Pas de vert, pas de toast, pas de numéro de
     ticket.** Le même écran s'affiche si l'email au bureau n'est pas parti.
  5. **Refus au-delà du seuil** — `alert` `destructive` ancré en tête, texte saisi conservé :
     « Vous avez envoyé plusieurs messages coup sur coup. Ce formulaire en accepte {N} par heure.
     Réessayez dans une heure, ou appelez le bureau de votre association. Votre texte est
     conservé. » `{N}` = valeur du réglage (montrer « 3 », annoté). Bouton d'envoi désactivé.
     **Aucun captcha.**
  6. **Aucune catégorie** (le bureau les a toutes supprimées) : le champ « De quoi s'agit-il ? »
     disparaît-il, ou le formulaire est-il indisponible ? _(Proposition : le formulaire reste
     utilisable sans catégorie ; à annoter comme point à trancher.)_
- **Mobile (390 px)** : c'est la version prioritaire. Gouttière 18 px, champs 56 px, bouton pleine
  largeur 56 px, résumé d'erreurs en tête. Clavier adapté par champ (`inputmode`).

### 2 · Back-office — Signalements, la file de suivi (`/bureau/signalements`)

- **Purpose** : voir ce qui attend le bureau, du plus récent au plus ancien, et ouvrir un
  signalement.
- **Layout** : `h1` « Signalements ». Ligne `meta` : « 1 signalement à traiter · 1 en cours ».
  À droite du titre (dessous en mobile), un lien `outline` « Gérer les catégories » → écran 4.
  **Aucun bouton `default`** : le bureau ne crée pas de signalement.
  Un `table` dans une `card`, trié par date décroissante :
  - **Catégorie** — `body-strong`, colonne d'identité ; une catégorie supprimée s'écrit
    « Portail » + mention `meta` « catégorie supprimée ».
  - **Où** — la localisation, `body`, tronquée à une ligne avec la fin en entier au détail (seule
    troncature admise : en tableau, pas en public).
  - **Signalé par** — nom, sinon email, sinon téléphone, sinon « Anonyme » ; seconde ligne en
    `meta`.
  - **Reçu le** — `29/09/2026` en `data`.
  - **Statut** — `badge` point + libellé écrit : « Signalé » / « En cours » / « Résolu ».
    **Jamais la couleur seule.** Second `badge` sur la même ligne (règle « deux badges », gap 8 px) :
    `AlertTriangle` 16 px + « Notification non envoyée ».
  - **Action** — une seule, en clair : « Ouvrir le signalement ».
- **Pagination** : 25 lignes, « Précédent / Suivant » écrits, « Page 1 sur 2 ».
- **Ni recherche, ni filtre par statut, ni tri par colonne** : hors critères. _(Un filtre « à
  traiter » serait utile à l'usage : le signaler en marge, ne pas le dessiner.)_
- **States** : **vide** (« Aucun signalement pour l'instant. Les signalements envoyés depuis le
  site apparaissent ici. » + lien « Voir le formulaire de signalement ») · **chargement**
  (`skeleton` sur les lignes) · **liste** (les 4 exemples).
- **Mobile (390 px)** : cartes empilées — Catégorie en titre, badges sous le titre, puis « Où »,
  « Signalé par », « Reçu le » en paires, « Ouvrir le signalement » pleine largeur 56 px ; 10 par
  page.

### 3 · Back-office — Détail d'un signalement (`/bureau/signalements/{id}`)

- **Purpose** : lire le signalement, savoir qui recontacter, le faire avancer, voir qui a fait quoi.
- **Layout** : colonne unique `max-w-[68ch]` :
  1. « ← Signalements » en `link` souligné ;
  2. `h1` = la catégorie (« Éclairage ») ; badge de statut à côté ;
  3. `meta` : « Reçu le 27 septembre 2026 à 21 h 10 depuis le site » ;
  4. **Où** (`h3`) puis la localisation en `body` ;
  5. **Ce qui a été signalé** (`h3`) puis la description, retours à la ligne conservés ;
  6. **Coordonnées** (`h3`) : nom, email en `link` `mailto:`, téléphone en `link` `tel:` —
     « Aucune coordonnée laissée » s'il n'y en a pas ;
  7. **Suivi** (`h3`) : l'action puis l'historique.
- **Action — une seule `default` à la fois, selon le statut** :
  - « Signalé » → bouton `default` « Passer en cours » ;
  - « En cours » → bouton `default` « Marquer comme résolu » ;
  - « Résolu » → aucun bouton ; `meta` « Signalement résolu. »
  **Pas de `select` de statut**, pas de saut direct de « Signalé » à « Résolu » _(à confirmer au
  plan ; le dessiner à sens unique)_. Pas de commentaire libre, pas de suppression.
- **Historique** : liste chronologique, une ligne par changement, **toujours écrite** : date et
  heure en `data`, statut écrit, auteur. « 27/09/2026 21:10 — Signalé depuis le site » ·
  « 28/09/2026 09:15 — Passé en cours par Marie Delorme ». Le premier événement n'a pas d'auteur :
  « depuis le site », jamais « Anonyme ».
- **States** : **Signalé** (avec bouton) · **En cours** · **Résolu** (historique à trois lignes) ·
  **Notification non envoyée** : `alert` `destructive` ancré au-dessus de « Où » : « Ce signalement
  est bien enregistré, mais l'email d'avertissement au bureau n'est pas parti. Rien n'est perdu :
  vérifiez les adresses dans les Réglages. » + lien « Ouvrir les Réglages » · **Changement
  enregistré** : `alert` neutre `CircleCheck` « Signalement passé en cours. » · **Catégorie
  supprimée** : `h1` « Portail » + `meta` « Cette catégorie a été supprimée depuis ; le signalement
  est conservé. » · **Sans coordonnées**.
- **Mobile (390 px)** : gouttière 16 px, bouton d'action pleine largeur 56 px.

### 4 · Back-office — Catégories de signalement (`/bureau/signalements/categories`)

- **Purpose** : le bureau adapte la liste des catégories à son domaine, sans dépasser 10.
- **Layout** : `breadcrumb` « Signalements › Catégories ». `h1` « Catégories de signalement ».
  Ligne `meta` : « 4 catégories sur 10 possibles. » Bouton `default` « Ajouter une catégorie ».
  Un `table` dans une `card` : **Nom** (`body-strong`) · **Adresse de routage** (l'adresse, ou
  « Aucune » en `muted-foreground` — **jamais une cellule vide**) · **Action** : « Modifier ».
  La suppression est dans le `dialog` de modification (une seule action par ligne).
- **Ajouter / modifier** — `dialog` (deux champs, la limite du composant) :
  1. **Nom de la catégorie** — `input`, compteur de caractères (plafond à fixer au plan, montrer
     « 12 / 40 »).
  2. **Adresse de routage** — `input` type email, « Facultatif ». Aide, **obligatoire** : « Pour
     l'instant, cette adresse n'est pas utilisée par les signalements : ils partent vers les
     adresses des Réglages. Elle servira aux questions posées au bureau. »
  Boutons : `default` « Enregistrer la catégorie », `outline` « Annuler » ; en modification, un
  bouton `destructive` « Supprimer la catégorie » en bas à gauche.
- **Supprimer** — `alert-dialog` : titre « Supprimer la catégorie « Nuisance » ? », texte « Elle
  ne sera plus proposée dans le formulaire du site. Les 3 signalements déjà reçus dans cette
  catégorie sont conservés. » Bouton `destructive` « Supprimer la catégorie ».
- **States** : **liste** (4) · **vide** (« Aucune catégorie. Le formulaire du site fonctionne sans,
  mais vos visiteurs ne pourront pas préciser ce qu'ils signalent. » + « Ajouter une catégorie ») ·
  **plafond atteint** (10 sur 10) : le bouton « Ajouter une catégorie » reste **visible et actif**,
  et le refus arrive en `alert` `destructive` ancré sous le titre : « Vous avez déjà 10 catégories,
  le maximum. Supprimez-en une avant d'en ajouter une autre. » _(Proposition : ne pas désactiver le
  bouton sans dire pourquoi ; un bouton désactivé seul serait l'information par l'absence.)_ ·
  **erreur dans le dialog** (nom vide, email mal formé) · **enregistrée** (`alert` neutre
  `CircleCheck`) · **adresse relue** : une catégorie avec adresse, une sans (« Aucune »).
- **Mobile (390 px)** : cartes empilées (Nom en titre, « Adresse de routage » en paire,
  « Modifier » pleine largeur 56 px) ; le `dialog` devient plein écran.

### 5 · Email — Nouveau signalement, au bureau

- **Purpose** : l'adresse de contact (et, pour une fuite, celle du responsable forage) apprend qu'un
  signalement est arrivé, avec tout ce qu'il faut pour agir sans ouvrir le back-office.
- **Contraintes du médium** : 600 px, tables imbriquées, styles en ligne, **ni OKLCH ni variable
  CSS**, une colonne, `Georgia, serif` / `Helvetica, Arial, sans-serif`, corps 17 px / 1,6, titres
  24 px.
- **Objet** : « Les Amis de l'Étang — Signalement : fuite d'eau » (≤ 60 caractères, l'information
  d'abord, **ni majuscules, ni emoji, ni « URGENT »**, même pour une fuite).
- **Pré-en-tête** (90 car.) : « Chemin des Pins, devant la parcelle 47 — signalé ce matin à 7 h 42. »
- **Structure** : en-tête (logo PNG 36 px ou monogramme + nom, filet `#17849B`, fond `#E8F5F8`) ·
  titre « Nouveau signalement depuis le site » · table deux colonnes (Catégorie · Où · Reçu le ·
  Signalé par · Email · Téléphone ; les coordonnées absentes s'écrivent « non renseigné ») ·
  la description dans un encart `#F6F7F8` filet `#DFE1E5` · bouton en table `#2C3F63` / `#FDFDFE`
  « Ouvrir le signalement », **doublé de l'URL en clair** en `#2B57A8` · pied `#F6F7F8` /
  `#52565E` — **nature « notification interne au bureau »** (§5.4) : « Cet email vous est envoyé
  parce qu'un visiteur a fait un signalement depuis le site des Amis de l'Étang, et que cette
  adresse est celle que l'association a choisie pour être avertie. » Pas de désinscription.
- **Versions** : 600 px et 390 px ; clair et **mode sombre forcé** (jumelles sombres §5.2 :
  fond `#171A1E`, texte `#E8EBEF`, texte atténué `#9DA6AE`, filet `#32363A`, bouton `#2063B0` texte
  `#FFFFFF`, lien `#8CC3FC`). Version **texte brut** à côté.

## Design system constraints (non-negotiable)

**Tokens — deux thèmes, clair et sombre (ADR 012).** Le back-office reprend les tokens du public ;
seule la `sidebar` a sa propre palette.

**Clair** (`:root`) :

```
--background: oklch(1 0 0)                 --foreground: oklch(0.22 0.015 250)
--card: oklch(1 0 0)                       --muted: oklch(0.972 0.005 240)
--muted-foreground: oklch(0.45 0.02 245)   --border: oklch(0.9 0.008 245)
--input: oklch(0.66 0.014 245)             --ring: oklch(0.55 0.11 235)
--primary: oklch(0.35 0.06 240)            --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.965 0.006 240)        --secondary-foreground: oklch(0.3 0.02 245)
--destructive: oklch(0.48 0.17 27)         --destructive-foreground: oklch(0.99 0.01 27)
--destructive-text: oklch(0.48 0.17 27)    --link: oklch(0.45 0.13 250)
--warning: oklch(0.94 0.06 75)             --warning-border: oklch(0.6 0.13 65)
--warning-foreground: oklch(0.3 0.08 60)
--accent-hue: 195 (démo « eau » ; teinte réelle injectée par association, six teintes possibles)
--accent: oklch(0.958 0.024 195)           --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)        --accent-border: oklch(0.88 0.045 195)
--table-stripe: oklch(0.99 0.002 250)      --table-row-hover: = --muted
--overlay: oklch(0.22 0.015 250 / 0.5)
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
--destructive: oklch(0.58 0.19 27)         --destructive-text: oklch(0.68 0.17 27)
--link: oklch(0.8 0.1 250)                 --warning-border: oklch(0.6 0.11 70)
--accent: oklch(0.275 0.035 195)           --accent-foreground: oklch(0.84 0.075 195)
--accent-solid: oklch(0.64 0.11 195)       --accent-border: oklch(0.4 0.055 195)
--table-stripe: oklch(0.235 0.009 255)     --table-row-hover: oklch(0.29 0.012 250)
--overlay: oklch(0.1 0.01 255 / 0.7)
--sidebar: oklch(0.19 0.009 255)           --sidebar-foreground: oklch(0.93 0.006 250)
--sidebar-accent: oklch(0.3 0.014 250)
```

**Email — jumelles hexadécimales** (ni OKLCH ni variable CSS) : background `#FFFFFF` · foreground
`#1B1E26` · muted `#F6F7F8` · muted-foreground `#52565E` · border `#DFE1E5` · primary `#2C3F63` ·
primary-foreground `#FDFDFE` · link `#2B57A8` · destructive `#B32317` · accent-solid (195) `#17849B`
· accent `#E8F5F8` · accent-foreground `#185A66`. Sombre forcé : voir écran 5.

**Typographie** : **Source Serif 4** — `h1` 34 px / 600, `h2` 26 px / 600. **Public Sans** — `h3`
20 px / 600, `body` 17 px (back-office), `body-lg` 18 px / 1,65 (public), `body-strong` 17 px / 600,
`label` 16 px / 500, `button` 16-17 px / 600, `meta` 15 px. **JetBrains Mono** — `data` (dates en
tableau, `tabular-nums`), `overline` 12 px / 600. Texte courant **jamais sous 17 px, 18 px en
public** · libellés toujours visibles · **jamais de placeholder en guise de libellé, jamais
d'astérisque** (« Facultatif » écrit) · `max-w-[68ch]` en public · dates en clair côté public,
`29/09/2026` en tableau · typographie française (espace insécable avant `: ; ! ?`, « », ’).

**Espacement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, rien d'autre. Site public `max-w-[1200px]`,
gouttière 24 / 44 px, 18 px en mobile. Back-office : barre latérale 248 px, tiroir sous `lg`.
Ruptures `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

**Cibles, focus, mouvement** : 44 × 44 minimum, **56 px** pour les actions principales en mobile ·
`outline: 2px solid var(--ring); outline-offset: 2px`, jamais `outline: none` · **aucune action au
survol seul** · transitions ≤ 120 ms · `prefers-reduced-motion` respecté.

**Bordures / ombres** : 1 px `border` séparation · 1 px `input` champ · 2 px `primary` sélection ·
**2 px `destructive` erreur** (épaisseur unique de « quelque chose ne va pas »). Aucune ombre sur
cartes et tableaux ; `shadow-lg` pour dialogues et tiroirs, voile `--overlay`.

**Icônes lucide** : 16 / 20 / 24 px, trait 1,75, `currentColor`. **Icône + libellé**, jamais seule.
Vocabulaire figé : `Droplet` eau · `FileText` document · `Receipt` facture · `Map` parcelle ·
`Megaphone` actualité · `AlertTriangle` alerte · `Lock` personnel · `GripVertical` poignée ·
`UsersRound` membres du bureau · `Inbox` messages reçus. `CircleCheck` = succès ancré. **Aucune
icône « signalement » au vocabulaire** : ne pas en inventer (voir Écarts).

**Composants à réutiliser tels quels** :

- **`button`** : `default` `outline` `secondary` `destructive` `link` ; 40 / 48 / 56 px. **Un seul
  `default` par écran.** Libellés à l'infinitif explicite. Chargement : libellé remplacé, désactivé,
  **largeur conservée**. Survol de `outline` en `secondary`, jamais en accent.
- **`form` `label` `input` `textarea` `select` `radio-group`** : une colonne, libellé au-dessus,
  48 px (56 mobile), validation au _blur_ puis à la soumission ; 2-3 options → `radio-group`, au-delà
  → `select`.
- **`table` `pagination` `badge`** : lignes 56 px, en-tête `muted` 15 px / 600, zébrure
  `--table-stripe`, survol `--table-row-hover`, **une seule action par ligne, en clair**, 25 lignes
  (10 cartes sous 640 px), « Précédent / Suivant » écrits. `badge` = statut, jamais une action ;
  deux badges sur une ligne, gap 8 px.
- **`alert`** : erreur et succès **ancrés**. **Rien d'important dans un toast.** `alert-dialog`
  uniquement pour l'irréversible, bouton nommant l'acte. `dialog` ≤ 2 champs.
- **Compteur de caractères** : `meta` à droite sous le champ, `muted-foreground` jusqu'au plafond
  inclus ; au dépassement seulement : `--destructive-text` 600, bordure 2 px, message écrit.
- **`card`** sans ombre · **`skeleton`** listes seulement · **`breadcrumb`** dès le 2ᵉ niveau du
  back-office · **`sidebar`** item actif selon la route.

**Patrons imposés** : formulaire en erreur = bordure 2 px **+** message sous le champ **+** résumé
ancré avec liens d'ancrage · les quatre états (vide = ce qui manque + l'action ; chargement =
`skeleton` ; erreur = ce qui s'est passé, ce qui est perdu, l'action suivante ; succès = `alert`
**neutre**, `CircleCheck` en `primary`, **pas de vert**) · `primary` pour les actions, l'accent
pour l'identité seulement, **jamais d'accent sur un bouton** · tableau sous 640 px = cartes
empilées · vouvoiement, aucun jargon (jamais « ticket », « captcha », « back-office » à l'écran
public).

**Do / Don't** : ✅ sobre, service public local · ✅ le mot porte l'information, la couleur
renforce · ✅ une seule action attendue par écran · ❌ pas de vert, pas de rouge pour « Signalé »
(un statut n'est pas une erreur) · ❌ pas de captcha · ❌ accent sur un bouton ou seul porteur
d'un statut · ❌ information importante dans un toast, un tooltip ou un `collapsible` · ❌
défilement infini, menu d'icônes en bout de ligne · ❌ densité de tableau de bord SaaS · ❌ en
email : OKLCH, police web, flex/grid, bouton sans URL en clair.

Ne pas inventer de composant, de token ni de couleur hors de cette liste. Un besoin non couvert se
**signale** en marge, il ne se dessine pas en freestyle.

## Écarts connus au design system (à signaler dans la maquette, pas à combler)

1. **Trois statuts d'un workflow** : le design system ne définit pas de palette de statuts. Les trois
   badges se distinguent **par le mot** (et au plus par la variante `secondary` / `outline` du
   `badge`), **jamais par une couleur nouvelle**. Annoter la proposition.
2. **Historique d'un objet** (qui a fait quoi, quand) : aucun composant ne le couvre. Proposer une
   liste simple (date en `data`, phrase écrite) et l'annoter comme proposition à verser au design
   system — les factures, votes et documents en auront besoin.
3. **Aucune icône « signalement »** au vocabulaire figé. Les écrans se lisent sans. Si la maquette en
   propose une, l'annoter comme écart à trancher.
4. **Liste de plus de 3 options pour un public âgé** : la règle dit `select` au-delà de 3 ; pour 4 à
   10 catégories courtes, un `radio-group` vertical serait plus accessible. Montrer le `select`,
   annoter l'alternative.
5. **Plafond atteint** : aucun patron pour « action refusée parce qu'une limite est atteinte ».
   Proposition de l'écran 4 à annoter.

## Points laissés au plan — à ne pas trancher dans la maquette

- Comment le produit reconnaît la catégorie « fuite » pour prévenir aussi le responsable forage
  (marqueur de catégorie, catégorie non supprimable…). **Ne rien dessiner** pour ça tant que le plan
  ne l'a pas tranché ; le signaler en marge de l'écran 4.
- Le plafond de longueur du nom de catégorie et de la description.
- Le partage du compteur d'envois avec le formulaire de contact (même message dans les deux cas).
- Un éventuel passage direct « Signalé → Résolu ».

## Out of scope

- **Photo jointe, carte, géolocalisation, pièce jointe** : aucun critère.
- **Suivi par le visiteur, numéro de dossier, email de confirmation au visiteur** : aucun critère
  (le suivi membre est une autre story).
- **Commentaires internes, assignation à un membre du bureau, réouverture, suppression d'un
  signalement, recherche, filtres, export** : hors critères.
- **Questions au bureau** et **petites annonces** : elles réutiliseront les catégories, mais leurs
  écrans sont d'autres stories.
- **Page Réglages, en-tête, pied et menu publics, barre latérale** : déjà livrés.
- ⚠️ Comme pour `/contact`, **le menu du site ne peut pointer que vers des pages du CMS** : l'accès
  au formulaire se fera par le pied de page ou un lien dans une page. Limite connue, à signaler en
  marge, ne pas dessiner d'évolution de l'écran « Navigation ».

## Expected output

Un mockup HTML statique des écrans 1 à 5, basse fidélité acceptée :

- en **desktop et en mobile 390 px** pour les écrans 1 à 4, en **600 px et 390 px** pour l'email ;
- en **clair et en sombre**, avec une bascule (ADR 012) — et pour l'email, **clair** et **sombre
  forcé** ;
- avec **tous les états listés** ;
- en utilisant **exclusivement** les tokens et composants ci-dessus ;
- une section ancrée par écran, les écarts annotés en marge.

Il sera enregistré comme `docs/designs/s10-signalements-publics.html`.
