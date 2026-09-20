# Design Brief — Story s03-connexion-lien-magique

> Brief pour Claude Design. Il est autonome : story, écrans, contraintes et livrable attendu. Produit en `/ks-design` le
> 2026-09-19, à partir de `docs/design-system.md` (seule source visuelle, §5 « L'email » et §7 « La connexion ») et
> de `docs/research/s03-connexion-lien-magique.md`.

## Story

**En tant que** membre propriétaire **je veux** recevoir un lien de connexion par email **afin de** consulter mon
espace sans avoir de mot de passe à retenir.

Le produit sert plusieurs associations syndicales de propriétaires (ASL), chacune sur son propre domaine. Ses
utilisateurs sont des **bénévoles et des propriétaires non techniciens, souvent âgés**. Registre visuel : **service
public local, sobre et très lisible**. Le lien magique est « la porte d'entrée de 300 personnes âgées » (§5.5).

Critères d'acceptation qui touchent l'écran :

1. Saisir une adresse email connue envoie un lien de connexion à usage unique et affiche un écran d'attente explicite.
2. Le lien ouvre une session valide ; réutilisé une seconde fois, il est refusé avec un message compréhensible et un bouton pour en redemander un.
3. Un lien de plus de **20 minutes** est refusé avec le même message et le même bouton.
4. Une adresse email inconnue ne révèle pas si le compte existe (même écran, aucun email envoyé, aucun compte créé).
5. L'email de connexion porte en en-tête le logo de l'association du domaine appelé, ou son nom quand elle n'a pas de logo.

Arbitrages du 2026-09-19 (à appliquer tels quels) :

- Le lien vaut **20 minutes** (et non plus 4 heures).
- **Le mot de passe est conservé**, au moins pour le SuperAdmin (le prestataire). Le lien magique est le seul chemin
  **mis en avant** ; l'accès par mot de passe est un **lien discret** en bas de l'écran A, pas un second formulaire.
- Le **monogramme** (deux lettres sur l'aplat de la teinte) remplace le logo quand l'association n'en a pas, le nom
  toujours écrit à côté.

## Screens to produce

Données d'exemple : association **« ASL Les Pins »** → monogramme **LP**, teinte **195 « Eau »**. Adresse d'exemple :
`m.durand@exemple.test`. Téléphone du bureau : **« [téléphone du bureau — réglage à créer] »**, à afficher tel quel
(aucun réglage ne le porte encore : manque signalé, ne pas inventer de numéro).

**Cadre commun des écrans A, B, C** — page publique de l'association, **sans** barre latérale ni menu du site : en
haut, le carré d'identité **44 px** (logo ou monogramme) + nom de l'association ; au centre, une **carte** unique
de largeur de lecture (~440 px) ; fond `muted`. Aucune autre navigation.

### Écran A — Saisie de l'adresse (§7, écran 1)

- **Purpose** : le membre demande son lien de connexion.
- **Layout** :
  1. `h1` « Se connecter à votre espace »
  2. Phrase : « Saisissez votre adresse email : vous recevrez un lien pour ouvrir votre espace. Il n'y a **aucun mot
     de passe** à retenir. »
  3. **Un seul champ** « Adresse email » (libellé au-dessus, `type="email"`, `autocomplete="email"`, `inputmode="email"`,
     sans majuscule automatique).
  4. Bouton **`default`** « Recevoir mon lien de connexion » (pleine largeur dans la carte).
  5. Encart bas de carte, neutre : « Vous n'avez pas d'adresse email ? Les documents vous sont envoyés par
     **courrier** — appelez le bureau au [téléphone du bureau — réglage à créer]. »
  6. **Sous la carte**, discret, en `meta` : lien « Accès prestataire » (mène à la connexion par mot de passe existante,
     hors maquette).
- **States** :
  - **Vide** : l'écran ci-dessus.
  - **Erreur de saisie** : adresse mal formée → bordure 2 px `destructive` + « Cette adresse n'est pas valide. Exemple :
    nom@domaine.fr » sous le champ (validation au départ du champ puis à l'envoi).
  - **Chargement** : bouton « Envoi en cours… », désactivé, largeur conservée.
  - **Erreur du service d'email** (manque §9 « Connexion », rattaché à s03) : `alert` destructive ancrée **dans la
    carte** : « Le lien n'a pas pu être envoyé. **Votre adresse n'est pas en cause.** Réessayez dans quelques minutes,
    ou appelez le bureau au [téléphone du bureau — réglage à créer]. » Le champ garde l'adresse saisie.
  - Pas d'état « succès » : l'envoi mène à l'écran B.

### Écran B — « Consultez votre boîte mail » (§7, écrans 2 et 4 — un seul écran)

- **Purpose** : dire quoi faire ensuite. **L'écran le plus important.** Il est **strictement identique** que
  l'adresse soit enregistrée ou non (même texte, même durée d'affichage) : il ne dit jamais « adresse inconnue ».
- **Layout** :
  1. Icône lucide `Mail` 24 px, `h1` « Consultez votre boîte mail »
  2. Texte conditionnel : « **Si l'adresse m.durand@exemple.test est enregistrée**, un lien de connexion vient de lui
     être envoyé. Il est valable **20 minutes** et ne sert qu'une fois. »
  3. Bloc « **Rien n'arrive ?** » en **trois étapes numérotées** : 1. Patientez quelques minutes. 2. Regardez dans le
     dossier des courriers indésirables. 3. Vérifiez l'adresse saisie : m.durand@exemple.test —
     « Corriger l'adresse » (lien, retour à A avec l'adresse pré-remplie).
  4. Paragraphe des **deux causes possibles** quand rien n'arrive, sans dureté : « Le bureau a peut-être enregistré une
     autre adresse pour vous. Ou aucune adresse n'est enregistrée pour votre parcelle : vous recevez alors vos
     documents par courrier, et c'est normal. »
  5. Bouton `outline` « Renvoyer un lien ».
  6. « Besoin d'aide ? Appelez le bureau au [téléphone du bureau — réglage à créer]. »
- **States** :
  - **Juste après l'envoi** : « Renvoyer un lien » **désactivé 60 s**, compte à rebours **écrit** dans le libellé
    (« Renvoyer un lien (disponible dans 45 s) »).
  - **Disponible** : bouton actif.
  - **Renvoyé** : `alert` neutre ancrée, icône `CircleCheck` en `primary` : « Un nouveau lien a été envoyé, si l'adresse
    est enregistrée. Le précédent ne fonctionne plus. » ; compte à rebours relancé.

### Écran C — Lien expiré ou déjà utilisé (§7, écran 3 — critères 2 et 3, même écran)

- **Purpose** : le membre a cliqué un lien qui ne marche plus. Le rassurer et lui rendre la main en un geste.
- **Layout** :
  1. Icône lucide `Clock` 24 px, `h1` « Ce lien ne fonctionne plus »
  2. « **Vous n'avez rien fait de mal** : il suffit d'en demander un nouveau. »
  3. Explication courte : « Un lien de connexion ne sert qu'une fois et reste valable 20 minutes. C'est ce qui protège
     votre espace, même si quelqu'un d'autre ouvre votre boîte mail. »
  4. Bouton **`default`** « Recevoir un nouveau lien » (mène à l'écran A).
  5. « Besoin d'aide ? Appelez le bureau au [téléphone du bureau — réglage à créer]. »
- **States** : un seul. Aucun code d'erreur, aucun jargon (« jeton », « token », « expiré » évité dans le titre).

### Planche D — L'email de connexion (§5.1, §5.2, §5.5 « Lien magique »)

- **Purpose** : un email d'**une seule action**, centrée, au-dessus de la ligne de flottaison mobile.
- **Contraintes du médium** (§5.1) : largeur **600 px**, une colonne, **couleurs en hexadécimal uniquement** (table
  ci-dessous), `Georgia, serif` pour le titre (24 px), `Helvetica, Arial, sans-serif` pour le texte (17 px, interlignage
  1,6), bouton en table ≥ 48 px, libellé 19 px, **URL en clair juste dessous**.
- **Contenu** :
  - **Objet** : « ASL Les Pins — votre lien de connexion » ; **pré-en-tête** (≤ 90 caractères) : « Valable 20 minutes,
    pour une seule connexion. Aucun mot de passe à retenir. »
  - **En-tête** : logo de l'association **36 px** (fond `#E8F5F8`, filet bas `#17849B`, nom `#185A66`) ; `alt` = nom de
    l'association.
  - `h1` « Votre lien de connexion »
  - « Bonjour, voici le lien pour ouvrir votre espace sur le site de l'ASL Les Pins. Il est valable **20 minutes** et ne
    sert qu'une fois. »
  - Bouton « Ouvrir mon espace » (fond `#2C3F63`, texte `#ffffff`), puis l'URL en clair (`#2B57A8`).
  - « Vous n'avez pas demandé ce lien ? Ignorez cet email : personne ne peut se connecter sans lui. »
  - **Pied** (`#F6F7F8`, texte `#52565E`) : « Cet email vous est envoyé parce qu'une connexion a été demandée avec votre
    adresse sur le site de l'ASL Les Pins. » **Aucune actualité, aucun rappel, aucune désinscription** (envoi
    transactionnel).
- **Variantes à produire** :
  - **Avec logo** (logo d'exemple dessiné, PNG transparent, sur **pastille blanche** pour survivre à l'inversion).
  - **Sans logo** : le **nom** de l'association seul dans l'en-tête (critère 5) — pas de monogramme en image.
  - **Images bloquées** : l'en-tête reste lisible (le nom est écrit).
  - **Mode sombre forcé** (§5.2) : corps, bouton, URL et pied restent lisibles ; la teinte de l'en-tête peut disparaître.

### Version mobile (390 px) — écrans A, B, C et planche D

Mêmes contenus et mêmes états, avec les règles sous 1 024 px :

- carte pleine largeur, **marges de 16 px**, intérieur 16 px ;
- champ **56 px**, texte 17 px ; boutons **56 px**, pleine largeur ;
- en-tête d'identité : carré 44 px + nom, sans menu (ces écrans n'en ont pas) ;
- l'email tel qu'il s'affiche sur un téléphone (colonne de 600 px réduite à la largeur de l'écran, bouton au-dessus de
  la ligne de flottaison).

### Mode sombre

Le site a **deux jeux de tokens** (ADR 012). Fournir une bascule clair / sombre pour les écrans A, B et C. L'email a
son propre mode sombre **forcé** (planche D).

## Design system constraints (non-negotiable)

### Tokens — couleurs, thème clair (OKLCH)

| Token                                                             | Valeur                                                                                      | Usage                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `background` / `card`                                             | `oklch(1 0 0)`                                                                              | fonds                                        |
| `foreground`                                                      | `oklch(0.22 0.015 250)`                                                                     | texte                                        |
| `muted`                                                           | `oklch(0.972 0.005 240)`                                                                    | fonds discrets                               |
| `muted-foreground`                                                | `oklch(0.45 0.02 245)`                                                                      | aide sous les champs, métadonnées            |
| `border`                                                          | `oklch(0.9 0.008 245)`                                                                      | séparations, cartes                          |
| `input`                                                           | `oklch(0.66 0.014 245)`                                                                     | contour de champ (3:1)                       |
| `ring`                                                            | `oklch(0.55 0.11 235)`                                                                      | focus                                        |
| `primary` / `primary-foreground`                                  | `oklch(0.35 0.06 240)` / `oklch(0.985 0.003 240)`                                           | toute action, sélection, icône fonctionnelle |
| `secondary` / `secondary-foreground`                              | `oklch(0.965 0.006 240)` / `oklch(0.3 0.02 245)`                                            |                                              |
| `destructive` / `destructive-foreground`                          | `oklch(0.48 0.17 27)` / `oklch(0.99 0.01 27)`                                               | erreur                                       |
| `link`                                                            | `oklch(0.45 0.13 250)`                                                                      | liens                                        |
| `accent-hue`                                                      | une des six teintes ci-dessous, `195` par défaut                                            | **seule variable d'association**             |
| `accent` / `accent-foreground` / `accent-solid` / `accent-border` | `oklch(0.958 0.024 h)` / `oklch(0.38 0.08 h)` / `oklch(0.55 0.1 h)` / `oklch(0.88 0.045 h)` | identité seulement (h = `accent-hue`)        |
| `sidebar` / `sidebar-foreground`                                  | `oklch(0.985 0.004 250)` / `oklch(0.26 0.015 250)`                                          | barre latérale                               |
| `sidebar-accent` / `sidebar-accent-foreground`                    | `oklch(0.93 0.012 245)` / `oklch(0.26 0.02 245)`                                            | item actif (+ libellé en 600)                |
| `sidebar-border`                                                  | `oklch(0.91 0.008 245)`                                                                     |                                              |

### Tokens — couleurs, thème sombre (OKLCH)

| Token                                                             | Valeur                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `background` / `card`                                             | `oklch(0.215 0.009 255)`                                                                     |
| `foreground`                                                      | `oklch(0.94 0.006 250)`                                                                      |
| `muted` / `muted-foreground`                                      | `oklch(0.255 0.009 250)` / `oklch(0.72 0.015 248)`                                           |
| `border` / `input` / `ring`                                       | `oklch(0.33 0.01 250)` / `oklch(0.52 0.016 250)` / `oklch(0.7 0.12 235)`                     |
| `primary` / `primary-foreground`                                  | `oklch(0.5 0.14 255)` / `oklch(0.985 0.003 240)`                                             |
| `secondary` / `secondary-foreground`                              | `oklch(0.27 0.01 250)` / `oklch(0.9 0.008 250)`                                              |
| `destructive` / `destructive-foreground`                          | `oklch(0.58 0.19 27)` / `oklch(0.98 0.01 27)`                                                |
| `link`                                                            | `oklch(0.8 0.1 250)`                                                                         |
| `accent` / `accent-foreground` / `accent-solid` / `accent-border` | `oklch(0.275 0.035 h)` / `oklch(0.84 0.075 h)` / `oklch(0.64 0.11 h)` / `oklch(0.4 0.055 h)` |
| `sidebar` / `sidebar-foreground`                                  | `oklch(0.19 0.009 255)` / `oklch(0.93 0.006 250)`                                            |
| `sidebar-accent` / `sidebar-accent-foreground` / `sidebar-border` | `oklch(0.3 0.014 250)` / `oklch(0.92 0.01 250)` / `oklch(0.32 0.01 250)`                     |

### Les six teintes validées (§1.2) — aucune autre

| Teinte | Nom     | Aplat `accent-solid` | Surface `accent` | Encre `accent-foreground` |
| ------ | ------- | -------------------- | ---------------- | ------------------------- |
| 195    | Eau     | `#17849B`            | `#E8F5F8`        | `#185A66`                 |
| 150    | Pins    | `#2E7D52`            | `#E7F5EC`        | `#1E4A31`                 |
| 255    | Lac     | `#3A6FB0`            | `#EAF1FA`        | `#23445F`                 |
| 40     | Tuile   | `#A8623A`            | `#F8EDE6`        | `#5E3421`                 |
| 300    | Bruyère | `#7A5AA8`            | `#F1ECF9`        | `#3F2E5C`                 |
| 95     | Genêt   | `#7C7326`            | `#F4F2E2`        | `#423D14`                 |

Préférer les valeurs OKLCH (seule la teinte `h` varie) ; les hexadécimaux sont un repli si l'outil ne
calcule pas OKLCH. **Accent autorisé** : logo et monogramme, filet de navigation active, encarts
d'information, pastilles décoratives. **Accent interdit** : fond de bouton, texte sous 24 px sur blanc,
porteur unique d'un état. Survols de menus et de lignes : `secondary` ou `sidebar-accent`, jamais la
teinte.

### Tokens — typographie

- **Source Serif 4** : `h1` 34 px / 600 / interlignage 39 px ; `h2` 26 px / 600. Monogramme et nom de
  l'association.
- **Public Sans** : `h3` 20 px / 600 ; `body` 17 px / 400 / 27 px (espace privé) ; `label` 16 px / 500 ;
  `button` 16–17 px / 600 ; `meta` 15 px (plancher absolu).
- **JetBrains Mono** : `data` 15–17 px pour les valeurs numériques.

### Tokens — espacement, rayon, bordures, focus

- Espacement, **huit valeurs seulement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px.
- Rayon : `--radius` 0.5 rem ; `rounded-md` 8 px champs, boutons, cartes ; `rounded-lg` 12 px dialogues.
- Bordures : 1 px `border` ; 1 px `input` ; 2 px `destructive` en erreur. Cartes : bordure 1 px **sans
  ombre**.
- Focus : `outline 2px solid ring`, décalage 2 px, jamais supprimé. Cibles ≥ 44 × 44 px.
- Icônes lucide, trait 1.75, 16/20/24 px, toujours **icône + libellé**.

### Couleurs de l'email — hexadécimal uniquement (§5.3)

| Token                       | Hex email | Usage dans l'email   |
| --------------------------- | --------- | -------------------- |
| `background`                | `#FFFFFF` | fond du corps        |
| `foreground`                | `#1B1E26` | texte courant, titre |
| `muted`                     | `#F6F7F8` | fond du pied         |
| `muted-foreground`          | `#52565E` | mentions du pied     |
| `border`                    | `#DFE1E5` | filets               |
| `primary`                   | `#2C3F63` | fond du bouton       |
| `primary-foreground`        | `#FDFDFE` | libellé du bouton    |
| `link`                      | `#2B57A8` | URL en clair         |
| `accent-solid` (h 195)      | `#17849B` | filet de l'en-tête   |
| `accent` (h 195)            | `#E8F5F8` | fond de l'en-tête    |
| `accent-foreground` (h 195) | `#185A66` | nom de l'association |

Les triplets des cinq autres teintes sont dans le tableau des six teintes ci-dessus ; le serveur injecte celui de
l'association.

### Composants à réutiliser (conventions imposées)

- `card` — bordure 1 px, sans ombre ; une seule carte par écran.
- `form` `label` `input` — libellé au-dessus, toujours visible ; champ 48 px (56 mobile), texte 17 px ; **jamais de
  placeholder en guise de libellé** ; validation au départ du champ puis à l'envoi.
- `button` — **un seul `default` par écran**, les autres en `outline` ; tailles `default` 48 px, `lg` 56 px ; libellés à
  l'infinitif explicite ; en chargement, libellé remplacé, **largeur conservée** ; bouton désactivé avec compte à
  rebours **écrit**.
- `alert` — erreur **ancrée** dans la carte, ne disparaît pas seule ; confirmation en `alert` **neutre** avec
  `CircleCheck` en `primary` (pas de vert). **Rien d'important dans un toast.**
- Carré d'identité (logo ou monogramme) 44 px + nom de l'association, en tête de page.
- Icônes lucide, trait 1.75 : `Mail`, `Clock`, `CircleAlert`, `CircleCheck`.

### Do / Don't

- ✅ Sobre, aéré, très lisible ; français simple ; chaque échec propose l'action de sortie (redemander un lien, appeler
  le bureau). **Personne n'est renvoyé à une impasse.**
- ✅ L'écran B ne dit jamais si l'adresse est connue : il est **conditionnel** (« si cette adresse est enregistrée »).
- ✅ Zéro jargon : pas de « token », « session », « magic link », « expiré » en titre, aucun code d'erreur.
- ❌ Captcha visible, second formulaire de mot de passe sur l'écran A, inscription libre (« Créer un compte »).
- ❌ Texte courant sous 17 px, placeholder en guise de libellé, astérisque pour l'obligatoire.
- ❌ **La teinte de l'association sur un bouton** ou comme unique porteur d'un état.
- ❌ Dégradés, verre dépoli, ombres lourdes, animations d'apparition.
- ❌ Dans l'email : OKLCH, variables CSS, police web, information indispensable dans une image, plus d'une action.

### Accessibilité — à respecter

Contour de champ ≥ 3:1 · aucune information portée par la seule couleur · tout au clavier, focus visible · cibles
≥ 44 px · un seul `h1` par écran · le compte à rebours est annoncé sans être relu chaque seconde · zoom 200 % sans perte.

**N'inventer aucun composant, token, couleur ou espacement hors de cette liste.**

## Out of scope

- Écrans « déjà connecté » et « déconnexion » de §7 (non demandés par les critères de s03).
- Le formulaire de connexion **par mot de passe** lui-même (existant, hors maquette) ; seul son lien d'accès est dessiné.
- Rôles, back-office, refus d'accès (s03b) ; lien propre au domaine de chaque association (s03c).
- Invitation initiale et invitation de masse (s15, s42) ; campagnes (s25).
- Réglage « téléphone du bureau » (manque signalé, story à désigner).

## Expected output

Une maquette statique (basse fidélité acceptée), **sur ordinateur et sur mobile (390 px)**, avec **tous les états** des
écrans A, B, C, les variantes de la planche D, et une bascule clair / sombre pour A, B, C, en utilisant **uniquement**
les tokens ci-dessus. L'export revient dans le dépôt sous `docs/designs/s03-connexion-lien-magique.html`.
