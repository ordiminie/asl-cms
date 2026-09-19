# Design — Story s02-parametres-association

> Conçu le 2026-09-19, chemin **Claude Design** : brief `docs/designs/s02-parametres-association-brief.md`,
> canevas `https://claude.ai/artifact/FjpQwWCS9xD69ncaNzSfYM` (version 3, privé), **validé par Marie-Ève
> le 2026-09-19** (ordinateur et mobile), puis reporté ici. Source visuelle unique : `docs/design-system.md`.
> Contexte de code : `docs/research/s02-parametres-association.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                     | Où                                         |
| ------- | -------------------------------------------------------------------- | ------------------------------------------ |
| 1       | Modifier les paramètres du registre, validés selon leur type         | **Écran A**, **Écran B**                   |
| 2       | Refus explicite d'une valeur non conforme ; rendu générique par type | **Écran B**, **Planche C**                 |
| 4       | Valeur par défaut, retour au défaut en vidant le champ               | **Écran B**                                |
| 5 bis   | Adresse de contact obligatoire, saisie à la création, jamais vidée   | **Écran B**, **Planche D**                 |
| 6       | Refus d'accès côté interface                                         | écran de refus de s01b, réutilisé tel quel |
| 7, 9    | Six teintes validées, jamais de sélecteur libre ; teinte par défaut  | **Écran A**                                |
| 3, 5, 8 | Relecture, seed, isolation entre domaines                            | _non dessinable_                           |

**Arbitrages du 2026-09-19** (Marie-Ève) :

- **La teinte se choisit dans la page « Identité »**, avec le logo et le favicon ; les adresses dans la
  page « Réglages ». Critère 1 reformulé sur `main` en ce sens (PR 11).
- **L'adresse de contact est l'adresse par défaut** : obligatoire, saisie à la création de l'association
  (formulaire de provisioning de s01), jamais vidée ; l'adresse du responsable forage laissée vide renvoie
  vers elle. Critère 4 complété et nouveau critère sur `main` (PR 12).
- **Le monogramme prend la teinte choisie** et est traité comme un **logotype** (dispensé de l'exigence de
  contraste WCAG 1.4.3) : le nom de l'association est toujours écrit à côté.
- **Chaque pastille montre la couleur de sa teinte** (correction demandée à la validation).

## Screen(s)

**Cadre commun** — back-office de l'association, groupe de routes `(bureau)` existant. Barre latérale
248 px : carré 34 px + nom en tête, **un seul groupe « L'association » à deux items, « Identité » et
« Réglages »** ; item actif fond `sidebar-accent` + libellé 600. Fil d'Ariane `L'association › …`. Sous
`lg` : barre haute 64 px (carré + nom + bouton « Menu ») et tiroir (`sheet`) portant les deux items.

### Écran A — Identité : carte « Teinte »

Page existante (`bureau/identite`) : intro élargie à la teinte (« Le logo, le favicon et la teinte
apparaissent sur votre site et dans cet espace… »), cartes « Logo » et « Favicon » inchangées, puis une
**troisième carte « Teinte »** :

1. `h3` « Teinte » + aide : « La couleur de votre association. Elle colore le monogramme, les filets et
   les encarts de votre site. Les boutons gardent leur couleur. »
2. Ligne d'état (`aria-live="polite"`) : dit la teinte appliquée ou sélectionnée (voir États).
3. **Six choix en `radio-group`** — grille de 3 colonnes sur ordinateur, **une par ligne** sur mobile.
   Chaque choix, 56 px de haut minimum : le bouton radio, une **pastille carrée 24 px de l'aplat
   `accent-solid` de sa propre teinte**, son **nom écrit** (Eau, Pins, Lac, Tuile, Bruyère, Genêt) ;
   « Eau » porte en plus « par défaut » en `meta`. Sélection : bordure 2 px `primary` + point `primary`
   — jamais la couleur de la pastille seule.
4. **Aperçu** (`figure`, légende en `overline` « Aperçu sur votre site ») qui suit la sélection **avant**
   l'enregistrement : `AssociationMark` taille `public`, un filet de navigation active (3 px
   `accent-solid`) et un encart d'information (`accent` / `accent-border` / `accent-foreground`, icône
   `Info`). Décoratif : son contenu est dit par la ligne d'état.
5. Bouton **`default`** « Enregistrer la teinte » — le seul `default` de la page.

### Écran B — Réglages de l'association (nouvelle page)

1. `h1` « Réglages de l'association » + aide : « Ces réglages sont propres à votre association. Les
   changements s'appliquent dès l'enregistrement. »
2. **Carte « Adresses de notification »**, un champ par ligne, libellé au-dessus, aide sous le libellé :
   - « Adresse de contact » — « Obligatoire. Reçoit les messages du formulaire de contact du site et les
     signalements. C'est aussi l'adresse utilisée quand une autre adresse est laissée vide. »
   - « Adresse du responsable forage — facultatif » (« facultatif » écrit en clair, §2.1) — « Reçoit les
     signalements de fuite, en plus de l'adresse de contact. Laissée vide, ils ne partent que vers
     l'adresse de contact. »
3. Bouton **`default`** « Enregistrer les réglages » sous la carte.

La page est **générée à partir du registre** (critère 2) : chaque clé s'affiche selon son type, voir
planche C.

### Planche D — Création d'une association (s01) : un champ de plus

Formulaire « Provisionner une association » du back-office du prestataire, carte « L'association » : un
quatrième champ **« Adresse de contact de l'association »**, obligatoire, après « Domaine ». Aide :
« Obligatoire. Reçoit les messages du site et sert d'adresse par défaut. Le bureau pourra la changer dans
ses réglages. » Mêmes conventions que les trois champs existants ; la création est refusée sans elle.
Ordinateur et mobile.

### Planche C — Rendu d'un réglage selon son type (référence)

| Type                        | Composant                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Adresse email               | `input` type email                                                                 |
| Nombre                      | `input` numérique en `data` (mono, `tabular-nums`), unité écrite à droite          |
| Booléen                     | `checkbox` + libellé explicite (pas de `switch` : l'effet attend l'enregistrement) |
| Choix dans une liste fermée | `radio-group` jusqu'à 3 options, `select` au-delà                                  |

Chaque type a son état d'erreur (bordure 2 px `destructive` + message sous le champ). Les libellés des
trois derniers types sont des **exemples**, pas des réglages de s02. La teinte est une liste fermée, mais
son rendu est celui de l'écran A (pastilles + aperçu), pas le rendu générique.

## Mockup

`docs/designs/s02-parametres-association.html` — référence visuelle, 14 planches (10 ordinateur, 4 mobile),
bascule clair / sombre. **NE PAS copier en production** : l'Execute construit avec les vrais composants du
socle (`src/components/ui/*`, `AssociationMark`, `BureauSidebar`). Données fictives : « ASL Les Pins »,
monogramme LP, adresses `@asl-les-pins.test`.

## Reused components (from the design system)

Aucun composant nouveau au catalogue.

- **`sidebar`** + **`sheet`** — `BureauSidebar` existant, un second item ; l'item actif doit suivre la route.
- **`breadcrumb`**, **`card`** (bordure 1 px, sans ombre, `h3`), **`button`** (`default` 48 px / 56 mobile,
  `outline`), **`alert`** (erreur ancrée ; succès neutre avec `CircleCheck` en `primary`).
- **`form` `label` `input` `checkbox` `radio-group` `select`** — conventions de §2.1 et §3.1.
- **`AssociationMark`** (§2.7) — en-tête, aperçu de la teinte.
- Icônes lucide (trait 1.75) : `ChevronRight`, `Menu`, `X`, `Upload`, `CircleAlert`, `CircleCheck`, `Info`.

## States

**Carte « Teinte »** (écran A)

| État                          | Forme retenue                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vide**                      | « Eau » sélectionnée ; « Aucune teinte choisie pour l'instant : la teinte Eau, par défaut, est appliquée. »                                                   |
| **Sélection non enregistrée** | Aperçu dans la nouvelle teinte ; « Teinte Tuile sélectionnée, pas encore enregistrée. » (600)                                                                 |
| **Chargement**                | Bouton « Enregistrement… » désactivé, largeur conservée                                                                                                       |
| **Erreur**                    | `alert` destructive ancrée : « La teinte n'a pas été enregistrée. **La teinte Eau reste appliquée.** Réessayez dans un instant. »                             |
| **Succès**                    | `alert` neutre : « Teinte Tuile enregistrée. Visible sur votre site et dans cet espace. » ; toute la page passe à la nouvelle teinte, barre latérale comprise |

**Page « Réglages »** (écran B)

| État                         | Forme retenue                                                                                                                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Forage non renseigné**     | Adresse de contact remplie (toujours) ; sous le champ forage vide : « Vide : les signalements de fuite partent vers contact@asl-les-pins.test. »                                                                                                                      |
| **Chargement**               | Bouton « Enregistrement… » désactivé, largeur conservée ; champs conservés                                                                                                                                                                                            |
| **Erreur de saisie**         | Bordure 2 px `destructive` + « Cette adresse n'est pas valide. Exemple : nom@domaine.fr » sous le champ + résumé en tête avec lien d'ancrage (« 1 réglage n'a pas été enregistré ») ; **rien n'est enregistré** tant qu'une erreur reste, les saisies sont conservées |
| **Adresse de contact vidée** | Refusée : « L'adresse de contact est obligatoire : c'est vers elle que partent les messages quand aucune autre adresse n'est renseignée. L'adresse contact@asl-les-pins.test reste en vigueur. » + résumé en tête                                                     |
| **Erreur d'enregistrement**  | `alert` destructive en tête : « Les réglages n'ont pas été enregistrés. **Les anciennes adresses restent en vigueur.** »                                                                                                                                              |
| **Succès**                   | `alert` neutre : « Réglages enregistrés. Les prochains messages partiront vers ces adresses. »                                                                                                                                                                        |

### Accessibilité — liste de §3.8

- [x] Contour des champs, des choix de teinte et des cases en `input` (3:1).
- [x] Aucune information portée par la seule couleur : chaque teinte a son nom écrit, la sélection se voit
      au bouton radio `primary`, l'état est dit par la ligne d'état.
- [x] Tout au clavier : flèches dans le `radio-group` ; cibles ≥ 44 px (choix de teinte 56 px).
- [x] Un seul `h1` par page ; `h3` pour les cartes ; résumé d'erreurs avec liens d'ancrage.
- [ ] Zoom 200 % : à vérifier sur l'écran construit.
- [x] Monogramme : logotype, dispensé (arbitrage du 2026-09-19).

## Design system gaps

Besoins que le système ne couvre pas, ou sur lesquels le code le contredit. **Signalés, pas inventés.**

1. **Sélecteur de teintes** — le manque de §9 (« Tenant ») est comblé par l'écran A, validé ; **à reporter
   dans le design system** (§2.1 ou une section dédiée) et à retirer de §9.
2. **Survol des boutons `outline` et `ghost` sur la teinte de l'association** : `src/components/ui/button.tsx`
   utilise `hover:bg-accent hover:text-accent-foreground`, alors que §1.2 interdit la teinte du tenant sur un
   bouton et pour les survols (`secondary` ou `sidebar-accent`). Invisible tant que tout le monde avait la
   teinte Eau ; **visible dès que s02 rend la teinte variable** (« Choisir un fichier » sur la page même).
   À corriger dans le socle — au plan de s02 ou en correction dédiée.
3. **Couleur du favicon par défaut** : le SVG ne lit pas les tokens ; il lui faut une couleur par teinte.
   Le tableau hexadécimal de §1.2 ne coïncide pas avec les tokens OKLCH (teinte 195 : `#17849B` contre
   environ `#008384` recalculé). Choisir la source de vérité au plan (recherche, question 7).
4. ~~**Valeur par défaut d'une adresse**~~ — **tranché le 2026-09-19** : l'adresse de contact est
   l'adresse par défaut, obligatoire ; le forage vide renvoie vers elle (PR 12).
5. **Rendu générique des types** (planche C) — le design system donne les composants (§2.1) mais pas la
   règle « un type de réglage → un composant » ni l'unité à droite d'un nombre : à reporter dans le design
   system si la planche est retenue telle quelle.

## Écart avec la story

- Aucun : critère 1 reformulé (PR 11, mergée) ; critère 4 complété et critère « adresse de contact
  obligatoire » ajouté (PR 12, à merger avant le plan).

## Ce que ce design ne couvre pas

- Les cartes « Logo » et « Favicon », l'écran de refus d'accès (s01b, réutilisés tels quels).
- Tout réglage autre que les deux adresses et la teinte ; le groupe « Le site » de la barre latérale.
- Le formulaire de contact et les signalements (s08, s10) ; les emails ; le papier.
- Le back-office de la plateforme (`/admin`).
