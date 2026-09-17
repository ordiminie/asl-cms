# Design Brief — Story s01b-logo-association

> Brief à coller dans l'outil de design externe (Claude Design). Il est autonome : story, écrans,
> contraintes et livrable attendu. Produit en `/ks-design` le 2026-09-17, à partir de
> `docs/design-system.md` (seule source visuelle) et de `docs/research/s01b-logo-association.md`.

## Story

**En tant que** membre du bureau d'une association **je veux** téléverser son logo et son favicon
**afin que** le site public, le back-office et l'onglet du navigateur portent son identité, sans
intervention du prestataire.

Le produit sert plusieurs associations syndicales de propriétaires (ASL), chacune sur son propre domaine.
Ses utilisateurs sont des **bénévoles non techniciens**, souvent âgés. Registre visuel : **service public
local, sobre et très lisible**, pas une startup.

Critères d'acceptation qui touchent l'écran :

1. Depuis la page de réglages de son association, un membre du bureau téléverse un logo ; il s'affiche sur le site public et dans le back-office, et le remplacer met à jour les deux.
2. Un fichier refusé (type non autorisé ou taille dépassée) affiche une erreur explicite et laisse en place, inchangé, le fichier qu'il devait remplacer.
3. Le favicon est un **fichier distinct du logo**, téléversé séparément depuis la même page ; une association qui n'en a pas téléversé reçoit un favicon par défaut.
4. Une association sans logo reste lisible : aucun écran cassé faute de logo.
5. Seuls le bureau (Bureau et Président·e) de l'association et le SuperAdmin accèdent à la page : tout autre utilisateur reçoit un refus.

Arbitrages de design du 2026-09-17 (à appliquer tels quels) :

- **Sans logo** → le **monogramme** de l'association (deux lettres tirées de son nom), dans le même carré
  que le logo, avec le nom de l'association écrit à côté comme d'habitude.
- **Sans favicon** → le **monogramme** sert de favicon par défaut.
- **Formats du logo** : **PNG ou WebP**, fond transparent. **SVG refusé** (sécurité), **JPEG refusé**
  (fond blanc parasite).

## Screens to produce

Données d'exemple : association **« ASL Les Pins »** → monogramme **LP**, teinte d'accent par défaut
**195 (« eau »)**. N'utiliser aucun nom, logo ou adresse d'une association réelle.

### Écran A — Identité de l'association (back-office)

- **Purpose** : le bureau voit le logo et le favicon actuels, et les remplace.
- **Place** : back-office de l'association (pas le back-office de la plateforme). Barre latérale 248 px à
  deux groupes, « Le site » et « L'association » ; l'item actif est **« Identité »**, dans le groupe
  « L'association ». Fil d'Ariane : `L'association › Identité`. Les autres items de la barre latérale
  sont des libellés neutres non détaillés (hors périmètre).
- **Layout** (une colonne, largeur de lecture) :
  1. `h1` « Identité de l'association » + phrase d'aide : « Le logo et le favicon apparaissent sur votre
     site et dans cet espace. Les changements sont visibles dès l'enregistrement. »
  2. **Carte « Logo »** (`h3`) :
     - aperçu du logo actuel dans son carré de 44 px, **à côté du nom de l'association**, tel qu'il
       apparaît dans l'en-tête du site public ;
     - zone de dépôt **et** bouton `outline` « Choisir un fichier » ;
     - consignes **annoncées avant tout échec** : « PNG ou WebP, fond transparent · au moins 512 px de côté
       · 1 Mo maximum · du carré jusqu'à trois fois plus large que haut ».
  3. **Carte « Favicon »** (`h3`) :
     - aperçu du favicon actuel, **montré dans un onglet de navigateur stylisé** (petite icône + nom du
       site), pour que le bureau comprenne où il apparaît ;
     - phrase d'aide : « La petite icône affichée dans l'onglet du navigateur. Distincte du logo. » ;
     - zone de dépôt **et** bouton `outline` « Choisir un fichier » ;
     - consignes : ligne **« [formats et dimensions du favicon — à définir] »** à afficher telle quelle
       (manque du design system, ne pas inventer de valeur).
- **Actions** : choisir un fichier (glisser-déposer **ou** bouton) déclenche le téléversement. **Aucun
  bouton `default` n'est nécessaire** sur cet écran. Pas d'action « Retirer le logo » (hors périmètre).
- **States** — à produire pour **chacune des deux cartes** :
  - **Vide** (rien de téléversé) : le **monogramme LP** occupe le carré du logo, et l'onglet stylisé
    montre le monogramme en favicon ; texte « Aucun logo pour l'instant : le monogramme de l'association
    est affiché à sa place. » suivi de l'action pour le combler (« Choisir un fichier »).
  - **Chargement** (téléversement en cours) : barre `progress` dans la carte ; le bouton garde sa largeur,
    libellé remplacé par « Envoi en cours… », désactivé ; l'aperçu actuel reste visible.
  - **Erreur** (fichier refusé) : `alert` **ancrée dans la carte**, qui ne disparaît pas seule. Exemple :
    « Ce fichier n'a pas été enregistré : le format JPEG n'est pas accepté. **Le logo actuel est
    conservé.** Choisissez un fichier PNG ou WebP. » Variante taille : « …ce fichier pèse 3,2 Mo, la limite
    est 1 Mo… ». L'aperçu montre toujours l'ancien logo.
  - **Succès** : message dans la carte qui dit ce qui a eu lieu et où le vérifier : « Logo remplacé.
    Visible sur votre site et dans cet espace. » ; l'aperçu montre le nouveau logo.

### Écran B — Accès refusé

- **Purpose** : un utilisateur connecté qui n'est pas au bureau de cette association ouvre la page.
- **Layout** : message centré dans la zone de contenu, sans barre latérale d'administration : `h1`
  « Cette page est réservée au bureau de l'association » + phrase « Si vous pensez devoir y accéder,
  adressez-vous à un membre du bureau. » + bouton `outline` « Revenir à l'accueil ».
- **States** : un seul.

### Planche C — Où l'identité apparaît (variantes d'affichage, pas des écrans à construire)

- **En-tête du site public** : logo 44 px + nom de l'association ; variante **sans logo** avec monogramme
  44 px + nom. Même mise en page dans les deux cas (le carré fait 44 px).
- **En-tête du back-office** (haut de la barre latérale) : logo 34 px + nom ; variante monogramme.
- **Onglet du navigateur** : favicon téléversé ; variante favicon par défaut = monogramme.

### Version mobile (390 px) — écrans A, B et planche C

Demandée le 2026-09-17. Mêmes contenus et mêmes états, avec les règles du design system sous 1 024 px :

- **Barre latérale → tiroir** (`sheet`), ouvert par un bouton « Menu » (icône + libellé) dans une barre
  haute de 64 px qui porte aussi le logo 34 px et le nom de l'association.
- **Actions principales en 56 px**, texte 17 px, pleine largeur (« Choisir un fichier », « Revenir à
  l'accueil »).
- **Marges de page de 16 px** ; intérieur de carte 16 px (« carte compacte »).
- **Pas de glisser-déposer au tactile** : la zone de dépôt se réduit au bouton « Choisir un fichier » et
  aux consignes, annoncées avant tout échec.
- Planche C mobile : en-tête public (logo 44 px + nom + « Menu »), barre haute du back-office, onglet.

## Design system constraints (non-negotiable)

### Tokens — couleurs (thème clair, OKLCH)

| Token                                                             | Valeur                                                                                      | Usage                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `background` / `card`                                             | `oklch(1 0 0)`                                                                              | fonds                                        |
| `foreground`                                                      | `oklch(0.22 0.015 250)`                                                                     | texte                                        |
| `muted`                                                           | `oklch(0.972 0.005 240)`                                                                    | fonds discrets                               |
| `muted-foreground`                                                | `oklch(0.45 0.02 245)`                                                                      | aide sous les champs, métadonnées            |
| `border`                                                          | `oklch(0.9 0.008 245)`                                                                      | séparations, cartes                          |
| `input`                                                           | `oklch(0.66 0.014 245)`                                                                     | contour de champ et de zone de dépôt (3:1)   |
| `ring`                                                            | `oklch(0.55 0.11 235)`                                                                      | focus                                        |
| `primary` / `primary-foreground`                                  | `oklch(0.35 0.06 240)` / `oklch(0.985 0.003 240)`                                           | toute action, sélection, icône fonctionnelle |
| `secondary` / `secondary-foreground`                              | `oklch(0.965 0.006 240)` / `oklch(0.3 0.02 245)`                                            |                                              |
| `destructive` / `destructive-foreground`                          | `oklch(0.48 0.17 27)` / `oklch(0.99 0.01 27)`                                               | erreur                                       |
| `link`                                                            | `oklch(0.45 0.13 250)`                                                                      | liens                                        |
| `accent-hue`                                                      | `195`                                                                                       | **seule variable d'association**             |
| `accent` / `accent-foreground` / `accent-solid` / `accent-border` | `oklch(0.958 0.024 h)` / `oklch(0.38 0.08 h)` / `oklch(0.55 0.1 h)` / `oklch(0.88 0.045 h)` | identité seulement (h = `accent-hue`)        |
| `sidebar` / `sidebar-foreground`                                  | `oklch(0.985 0.004 250)` / `oklch(0.26 0.015 250)`                                          | barre latérale                               |
| `sidebar-accent` / `sidebar-accent-foreground`                    | `oklch(0.93 0.012 245)` / `oklch(0.26 0.02 245)`                                            | item actif (+ libellé en 600)                |
| `sidebar-border`                                                  | `oklch(0.91 0.008 245)`                                                                     |                                              |

Hexadécimaux de la teinte 195 si l'outil ne calcule pas OKLCH : aplat `#17849B`, surface `#E8F5F8`,
encre `#185A66`.

### Tokens — typographie

- **Source Serif 4** : `h1` 34 px / 600 / interlignage 39 px ; `h2` 26 px / 600. Monogramme.
- **Public Sans** : `h3` 20 px / 600 ; `body` 17 px / 400 / 27 px (espace privé) ; `body-lg` 18 px (public) ;
  `label` 16 px / 500 ; `button` 16–17 px / 600 ; `meta` 15 px (plancher absolu).
- **JetBrains Mono** : `data` 15–17 px pour poids de fichier et dimensions.

### Tokens — espacement, rayon, bordures, focus

- Espacement, **huit valeurs seulement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px.
- Rayon : `--radius` 0.5 rem ; `rounded-md` 8 px champs, boutons, cartes ; `rounded-lg` 12 px dialogues.
- Bordures : 1 px `border` ; 1 px `input` ; 2 px `destructive` en erreur. Cartes : bordure 1 px **sans
  ombre**.
- Focus : `outline 2px solid ring`, décalage 2 px, jamais supprimé. Cibles ≥ 44 × 44 px.
- Icônes lucide, trait 1.75, 16/20/24 px, toujours **icône + libellé**.

### Le logo et le monogramme (§1.8)

| Contexte    | Taille |
| ----------- | ------ |
| Site public | 44 px  |
| Back-office | 34 px  |

Logo inscrit dans un carré, **sans rognage**, garde de 2 px. **Monogramme** : deux lettres tirées du nom,
en **Source Serif 4**, sur la **teinte de l'association** (`accent-solid` en fond, texte clair lisible),
dans le même carré : **aucune mise en page ne change** entre logo et monogramme. Jamais de logo générique
ni de silhouette d'immeuble.

### Composants à réutiliser (conventions imposées)

- `sidebar` — back-office uniquement, groupes « Le site » et « L'association », item actif fond
  `sidebar-accent` + libellé 600.
- `breadcrumb` — dès le 2ᵉ niveau du back-office.
- `card` — bordure 1 px, sans ombre ; titre en `h3`.
- `file-upload` — zone de dépôt **et** bouton « Choisir un fichier » ; types et poids **annoncés avant
  l'échec**.
- `progress` — téléversement.
- `button` — `outline` pour « Choisir un fichier » ; taille `default` 48 px ; libellés à l'infinitif
  explicite ; en chargement, libellé remplacé, **largeur conservée**.
- `alert` — toute erreur, **ancrée**, ne disparaît pas seule. **Rien d'important dans un toast.**

### Do / Don't

- ✅ Sobre, aéré, très lisible. Le mot porte l'information ; la couleur ne fait que renforcer.
- ✅ Un message d'erreur dit ce qui est perdu — ici, que le logo actuel est conservé.
- ✅ Toute voie fine (glisser-déposer) a une alternative de premier rang (le bouton).
- ❌ Texte courant sous 17 px, placeholder en guise de libellé, astérisque pour l'obligatoire.
- ❌ **L'accent de l'association sur un bouton** ou comme unique porteur d'un état.
- ❌ Information importante dans un toast, un tooltip ou un bloc repliable.
- ❌ Dégradés, verre dépoli, ombres lourdes, animations d'apparition, densité de tableau de bord SaaS.
- ❌ Jargon technique à l'écran (« upload », « MIME », « favicon.ico ») : écrire « téléverser »,
  « format », « icône d'onglet ».

### Accessibilité — à respecter

Contour de champ et de composant ≥ 3:1 · aucune information portée par la seule couleur · tout au
clavier, focus visible · zoom 200 % sans perte · un seul `h1` par page.

**N'inventer aucun composant, token, couleur ou espacement hors de cette liste.**

## Out of scope

- **Teinte d'accent et paramètres de l'association** (adresses, sélecteur des six teintes) : story s02.
- Toute autre page du back-office ; le contenu des autres items de la barre latérale.
- Retirer un logo ; recadrer ou éditer une image.
- Avatar utilisateur, images du blog, back-office de la plateforme (`/admin`).
- Logo dans les emails (s03) et sur le papier.
- Mode sombre (le jeu sombre existe mais n'est pas demandé ici).

## Expected output

Une maquette statique de chaque écran (basse fidélité acceptée), **sur ordinateur et sur mobile**, avec
**tous les états** de l'écran A, l'écran B et la planche C, en utilisant **uniquement** les tokens ci-dessus. L'export revient dans le dépôt
sous `docs/designs/s01b-logo-association.html`.
