# Design Brief — Story s02-parametres-association

> Brief à coller dans l'outil de design externe (Claude Design). Il est autonome : story, écrans,
> contraintes et livrable attendu. Produit en `/ks-design` le 2026-09-19, à partir de
> `docs/design-system.md` (seule source visuelle) et de `docs/research/s02-parametres-association.md`.

## Story

**En tant que** membre du bureau d'une association **je veux** modifier ses réglages **afin de** ne
dépendre du prestataire pour aucune adresse ni aucun seuil.

Le produit sert plusieurs associations syndicales de propriétaires (ASL), chacune sur son propre domaine.
Ses utilisateurs sont des **bénévoles non techniciens**, souvent âgés. Registre visuel : **service public
local, sobre et très lisible**, pas une startup.

Critères d'acceptation qui touchent l'écran :

1. Une page de réglages liste les paramètres de l'association et permet de les modifier, chaque valeur étant validée selon son type. Pour l'instant : l'adresse de contact, l'adresse du responsable forage, et la teinte d'accent.
2. Une valeur non conforme est refusée avec un message explicite. Les types possibles sont : adresse email, nombre, booléen, choix dans une liste fermée. **Un réglage ajouté plus tard, d'un type existant, doit s'afficher sans redessiner la page** : la page est générée à partir de la liste des réglages.
3. Un réglage jamais renseigné vaut sa valeur par défaut ; le vider le ramène à cette valeur par défaut.
4. Seuls le bureau (Bureau et Président·e) de l'association et le SuperAdmin modifient les réglages : tout autre utilisateur reçoit un refus.
5. Le bureau choisit la **teinte d'accent** de son association **dans la liste des six teintes validées**, jamais au sélecteur libre ; la couleur s'applique au site public après rechargement.
6. Une association qui n'a pas choisi de teinte reçoit la teinte par défaut (195, « Eau »). Aucun écran cassé.

Arbitrages du 2026-09-19 (à appliquer tels quels) :

- **La teinte se choisit dans la page « Identité »** (existante, livrée avec le logo et le favicon), pas
  dans la page « Réglages ». La page « Réglages » porte les adresses.
- Le **monogramme** (deux lettres sur l'aplat de la teinte) **prend la teinte choisie**. Il est traité
  comme un logo : le nom de l'association est toujours écrit à côté.

## Screens to produce

Données d'exemple : association **« ASL Les Pins »** → monogramme **LP**. Adresses d'exemple :
`contact@asl-les-pins.test`, `forage@asl-les-pins.test`. N'utiliser aucun nom, logo ou adresse d'une
association réelle.

**Cadre commun aux deux écrans** — back-office de l'association (pas celui de la plateforme). Barre
latérale 248 px, en tête le carré 34 px (logo ou monogramme) + nom de l'association. **Un seul groupe**,
« L'association », avec **deux items** : « Identité » et « Réglages ». L'item actif a le fond
`sidebar-accent` **et** un libellé en 600. Le groupe « Le site » n'apparaît pas encore (règle du design
system : un groupe n'apparaît qu'avec sa première page). Fil d'Ariane dès le 2ᵉ niveau.

### Écran A — Identité de l'association : nouvelle carte « Teinte »

- **Purpose** : le bureau choisit la couleur de son association parmi six, et voit tout de suite ce
  qu'elle donne.
- **Place** : la page existe déjà (fil d'Ariane `L'association › Identité`, `h1` « Identité de
  l'association », cartes « Logo » puis « Favicon »). **Ajouter une troisième carte « Teinte »,
  après « Favicon ».** Les cartes Logo et Favicon restent telles quelles ; les montrer en tête, condensées,
  pour situer la nouvelle carte.
- **Carte « Teinte »** (`h3`) :
  - phrase d'aide : « La couleur de votre association. Elle colore le monogramme, les filets et les
    encarts de votre site. Les boutons gardent leur couleur. » ;
  - **six choix** en `radio-group`, un par ligne sur mobile, en grille sur ordinateur. Chaque choix :
    le bouton radio, une **pastille carrée** de l'aplat de la teinte, et son **nom écrit** :
    Eau (195), Pins (150), Lac (255), Tuile (40), Bruyère (300), Genêt (95). « Eau » porte en plus la
    mention « par défaut ». Le nom est l'information ; la pastille ne fait que l'illustrer ;
  - **aperçu immédiat**, qui suit la sélection **avant** l'enregistrement : le carré du monogramme LP
    - le nom de l'association, un filet de navigation active et un petit encart d'information
      (fond `accent`, texte `accent-foreground`), tels qu'ils apparaîtront sur le site public ;
  - bouton **`default`** « Enregistrer la teinte » (le seul bouton `default` de la page).
- **States** :
  - **Vide** (jamais choisie) : « Eau » sélectionnée, texte « Aucune teinte choisie pour l'instant : la
    teinte Eau, par défaut, est appliquée. »
  - **Sélection modifiée, pas encore enregistrée** : l'aperçu montre la nouvelle teinte, une ligne dit
    « Teinte Tuile sélectionnée, pas encore enregistrée. » (le mot porte l'état, pas la couleur).
  - **Chargement** : bouton « Enregistrement… » désactivé, largeur conservée.
  - **Erreur** : `alert` ancrée dans la carte, qui ne disparaît pas seule : « La teinte n'a pas été
    enregistrée. **La teinte Eau reste appliquée.** Réessayez dans un instant. »
  - **Succès** : `alert` neutre avec icône de validation, dans la carte : « Teinte Tuile enregistrée.
    Visible sur votre site et dans cet espace. »

### Écran B — Réglages de l'association (nouvelle page)

- **Purpose** : le bureau voit et modifie les adresses auxquelles le site envoie les messages.
- **Place** : item « Réglages » actif ; fil d'Ariane `L'association › Réglages`.
- **Layout** (une colonne, largeur de lecture) :
  1. `h1` « Réglages de l'association » + phrase d'aide : « Ces réglages sont propres à votre
     association. Les changements s'appliquent dès l'enregistrement. »
  2. **Carte « Adresses de notification »** (`h3`), un champ par ligne, libellé au-dessus :
     - **« Adresse de contact »** — aide : « Reçoit les messages du formulaire de contact du site et les
       signalements. »
     - **« Adresse du responsable forage »** — aide : « Reçoit les signalements de fuite, en plus de
       l'adresse de contact. »
     - sous chaque champ, une ligne en `meta` quand la valeur est celle par défaut : « Valeur par
       défaut ». Aide commune en bas de carte : « Laissez un champ vide pour revenir à sa valeur par
       défaut. »
  3. Bouton **`default`** « Enregistrer les réglages », en bas du formulaire.
- **States** :
  - **Vide** (rien de renseigné) : champs vides, chaque champ montre « Valeur par défaut » ; texte en
    tête de carte : « Aucune adresse renseignée pour l'instant. Renseignez au moins l'adresse de contact. »
  - **Chargement** : bouton « Enregistrement… » désactivé, largeur conservée ; champs conservés.
  - **Erreur de saisie** : validation au départ du champ puis à l'envoi. Champ en erreur : bordure
    `destructive` 2 px **+** message sous le champ (« Cette adresse n'est pas valide. Exemple :
    nom@domaine.fr ») **+** résumé en tête de formulaire avec lien vers chaque champ (« 1 réglage n'a pas
    été enregistré : Adresse du responsable forage »). **Rien n'est enregistré tant qu'une erreur
    reste** ; dire que les autres valeurs saisies sont conservées dans le formulaire.
  - **Erreur d'enregistrement** : `alert` destructive ancrée en tête : « Les réglages n'ont pas été
    enregistrés. **Les anciennes adresses restent en vigueur.** Réessayez dans un instant. »
  - **Succès** : `alert` neutre avec icône de validation : « Réglages enregistrés. Les prochains messages
    partiront vers ces adresses. »

### Planche C — Rendu d'un réglage selon son type (référence pour les réglages à venir)

La page « Réglages » est générée à partir de la liste des réglages. Montrer **un champ d'exemple par
type**, avec son état normal et son état d'erreur, pour que les réglages ajoutés plus tard aient déjà
leur forme. Libellés d'exemple fictifs, **à ne pas afficher dans l'écran B** :

| Type                        | Composant                                                                               | Exemple                                                |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Adresse email               | `input` type email                                                                      | « Adresse de contact »                                 |
| Nombre                      | `input` numérique, unité écrite à droite du champ                                       | « Nombre d'envois par heure » — `5` « envois »         |
| Booléen                     | `checkbox` avec libellé explicite (pas de `switch` : il y a un bouton d'enregistrement) | « Envoyer une relance avant l'échéance »               |
| Choix dans une liste fermée | `radio-group` jusqu'à 3 options, `select` au-delà                                       | « Fréquence du résumé » : Chaque semaine / Chaque mois |

### Version mobile (390 px) — écrans A et B

Mêmes contenus et mêmes états, avec les règles du design system sous 1 024 px :

- **Barre latérale → tiroir** (`sheet`), ouvert par un bouton « Menu » (icône + libellé) dans une barre
  haute de 64 px qui porte aussi le carré 34 px et le nom de l'association.
- **Actions principales en 56 px**, pleine largeur ; champs 56 px, texte 17 px.
- **Marges de page de 16 px** ; intérieur de carte 16 px.
- Écran A : les six teintes **une par ligne** (cible ≥ 44 px), l'aperçu sous la liste, avant le bouton.

### Mode sombre

Le produit a **deux jeux de tokens** (clair et sombre). Fournir un moyen de basculer la maquette en
sombre, au moins pour l'écran A : **la teinte change d'apparence en sombre** (aplat plus clair), l'aperçu
doit le montrer.

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

### Composants à réutiliser (conventions imposées)

- `sidebar` — back-office uniquement ; un groupe n'apparaît qu'avec sa première page ; item actif fond
  `sidebar-accent` + libellé 600. `sheet` sous 1 024 px.
- `breadcrumb` — dès le 2ᵉ niveau du back-office.
- `card` — bordure 1 px, sans ombre ; titre en `h3`.
- `form` `label` `input` `checkbox` `radio-group` `select` — une colonne, un champ par ligne ; libellé
  au-dessus, toujours visible ; champs 48 px (56 mobile), texte 17 px ; « Facultatif » écrit en clair,
  **jamais d'astérisque** ; validation au départ du champ puis à l'envoi ; 2-3 options courtes →
  `radio-group` ; `switch` réservé aux réglages à effet immédiat.
- `button` — **un seul `default` par écran**, les autres en `outline` ; tailles `default` 48 px, `lg`
  56 px ; libellés à l'infinitif explicite ; en chargement, libellé remplacé, **largeur conservée**.
- `alert` — erreur **ancrée**, ne disparaît pas seule ; succès en `alert` **neutre** avec icône
  `CircleCheck` en `primary` (il n'y a pas de vert). **Rien d'important dans un toast.**
- Carré d'identité (logo ou monogramme) : 34 px en back-office, 44 px sur le site public, le nom
  toujours écrit à côté ; monogramme en Source Serif 4 / 600, texte clair sur `accent-solid`.

### Do / Don't

- ✅ Sobre, aéré, très lisible. Le mot porte l'information ; la couleur ne fait que renforcer.
- ✅ Un message d'erreur dit ce qui est conservé — ici, l'ancienne teinte, les anciennes adresses.
- ✅ Chaque teinte a son nom écrit ; aucune n'est identifiable par sa seule couleur.
- ❌ Sélecteur de couleur libre, curseur de teinte, champ hexadécimal.
- ❌ **La teinte de l'association sur un bouton** ou comme unique porteur d'un état (la sélection d'une
  teinte se voit par le bouton radio en `primary`, pas par la couleur de la pastille).
- ❌ Texte courant sous 17 px, placeholder en guise de libellé, astérisque pour l'obligatoire.
- ❌ Information importante dans un toast, un tooltip ou un bloc repliable.
- ❌ Dégradés, verre dépoli, ombres lourdes, animations d'apparition, densité de tableau de bord SaaS.
- ❌ Jargon technique à l'écran (« hue », « OKLCH », « setting », « clé ») : écrire « teinte », « réglage ».

### Accessibilité — à respecter

Contour de champ et de composant ≥ 3:1 · aucune information portée par la seule couleur · tout au
clavier (flèches dans le `radio-group`), focus visible · zoom 200 % sans perte · un seul `h1` par page ·
l'aperçu de la teinte est décoratif : son contenu est dit par le texte (« Teinte Tuile sélectionnée… »).

**N'inventer aucun composant, token, couleur ou espacement hors de cette liste.**

## Out of scope

- Les cartes « Logo » et « Favicon » (déjà construites, à montrer telles quelles).
- L'écran « accès refusé » (déjà construit, réutilisé tel quel).
- Tout réglage autre que les deux adresses et la teinte : les réglages de la planche C sont des exemples.
- Le groupe « Le site » de la barre latérale et ses pages ; toute autre page du back-office.
- Le formulaire de contact et les signalements eux-mêmes (s08, s10).
- Le back-office de la plateforme (`/admin`), les emails, le papier.

## Expected output

Une maquette statique (basse fidélité acceptée), **sur ordinateur et sur mobile**, avec **tous les états**
des écrans A et B, la planche C, et une bascule clair / sombre, en utilisant **uniquement** les tokens
ci-dessus. L'export revient dans le dépôt sous `docs/designs/s02-parametres-association.html`.
