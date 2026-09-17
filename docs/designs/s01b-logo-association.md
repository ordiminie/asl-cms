# Design — Story s01b-logo-association

> Conçu le 2026-09-17, chemin **externe (Claude Design)** : brief `docs/designs/s01b-logo-association-brief.md`,
> maquettes produites dans un canevas Claude Design, **validées par Marie-Ève le 2026-09-17** (ordinateur et
> mobile), puis reportées ici. Source visuelle unique : `docs/design-system.md`. Aucun composant, token,
> couleur ni mesure hors de ce document. Contexte de code : `docs/research/s01b-logo-association.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                      | Où                  |
| ------- | ------------------------------------------------------------------------------------- | ------------------- |
| 1, 2    | Téléverser et remplacer le logo ; fichier refusé → erreur, fichier précédent conservé | **Écran A**         |
| 6       | Favicon distinct, téléversé séparément ; favicon par défaut sans téléversement        | **Écran A**, **C**  |
| 7       | Association sans logo lisible, aucun écran cassé                                      | **A** (vide), **C** |
| 8       | Refus d'accès côté interface pour qui n'est pas au bureau                             | **Écran B**         |
| 3, 4, 5 | Stockage disque, route de lecture, deux domaines                                      | _non dessinable_    |

**Arbitrages de design du 2026-09-17** (Marie-Ève) :

- **Sans logo → monogramme** (deux lettres tirées du nom, Source Serif 4 sur `accent-solid`, dans le même
  carré que le logo), **le nom de l'association restant écrit à côté**. Conforme à §1.8.
- **Favicon par défaut → le monogramme.**
- **Formats du logo : PNG ou WebP seulement.** SVG refusé (un SVG servi depuis le domaine de l'association
  peut porter du script), JPEG refusé (fond blanc, §1.8). **Écart assumé avec §1.8** (« SVG préféré ») — voir
  « Design system gaps ».

## Écran(s)

### Écran A — Identité de l'association · back-office de l'association

Place : back-office **de l'association** (pas `/admin`, back-office de la plateforme). Barre latérale 248 px à
deux groupes « Le site » / « L'association » ; item actif **« Identité »** dans « L'association ». Fil
d'Ariane `L'association › Identité`. La route exacte se décide au plan.

1. `h1` « Identité de l'association » + aide : « Le logo et le favicon apparaissent sur votre site et dans cet
   espace. Les changements sont visibles dès l'enregistrement. »
2. **Carte « Logo »** : aperçu tel qu'en en-tête public (carré 44 px + nom) ; zone de dépôt **et** bouton
   `outline` « Choisir un fichier » ; consignes annoncées **avant** tout échec : « PNG ou WebP, fond
   transparent · au moins 512 px de côté · 1 Mo maximum · du carré jusqu'à trois fois plus large que haut ».
3. **Carte « Favicon »** : aide « La petite icône affichée dans l'onglet du navigateur. Distincte du logo. » ;
   aperçu dans un **onglet de navigateur stylisé** ; zone de dépôt et bouton ; consignes : **à définir**
   (manque, voir plus bas).

**Aucun bouton `default`** : choisir un fichier lance le téléversement. Pas d'action « Retirer ».

### Écran B — Accès refusé

Sans barre latérale d'administration : `h1` « Cette page est réservée au bureau de l'association », texte
« Si vous pensez devoir y accéder, adressez-vous à un membre du bureau. », bouton `outline` « Revenir à
l'accueil ».

### Planche C — Où l'identité apparaît (variantes d'affichage, pas des écrans)

- En-tête du **site public** : logo 44 px + nom ; variante monogramme. Même mise en page dans les deux cas.
- En-tête du **back-office** : logo 34 px + nom ; variante monogramme.
- **Onglet du navigateur** : favicon téléversé ; favicon par défaut = monogramme.

### Mobile (390 px)

Mêmes contenus et mêmes états, avec les règles de §1.5 et §1.6 sous `lg` :

- barre latérale → **tiroir** (`sheet`), ouvert par un bouton « Menu » (icône + libellé) dans une barre haute
  de 64 px portant logo 34 px et nom ;
- actions principales **56 px**, texte 17 px, pleine largeur ;
- marges de page 16 px, cartes compactes (intérieur 16 px) ;
- **pas de glisser-déposer au tactile** : la zone de dépôt se réduit au bouton et aux consignes (voir manques).

## Mockup

`docs/designs/s01b-logo-association.html` — référence visuelle, 14 planches (7 ordinateur, 7 mobile). **NE PAS
copier en production** : l'Execute construit avec les vrais composants du socle (`src/components/ui/*`). La
maquette communique la mise en page et les états, pas le code.

Elle embarque **les deux jeux de tokens** (ADR 012), le sombre repris de `src/app/globals.css` ; le bouton
« Basculer clair / sombre » pose `data-theme="dark"` sur `<html>`. Données fictives : « ASL Les Pins »,
monogramme LP, teinte 195, logo d'exemple dessiné (pin stylisé). Canevas source :
`https://claude.ai/artifact/HrrTgVN78asSNFEGXaHtoU` (version 3, privé).

## Reused components (from the design system)

Aucun composant nouveau du catalogue — mais voir le manque n° 2 (monogramme).

- **`sidebar`** — back-office de l'association, deux groupes, item actif `sidebar-accent` + libellé 600 ;
  **`sheet`** sous `lg`.
- **`breadcrumb`** — dès le 2ᵉ niveau.
- **`card`** — les deux sections de l'écran A ; bordure 1 px, sans ombre ; titre `h3`.
- **`file-upload`** — zone de dépôt **et** bouton « Choisir un fichier » ; types et poids annoncés avant
  l'échec. Aujourd'hui `src/components/ui/file-upload.tsx`.
- **`progress`** — téléversement en cours.
- **`button`** — `outline` ; `default` 48 px (56 px pour l'action principale sur mobile) ; en chargement,
  libellé remplacé, largeur conservée.
- **`alert`** — erreurs **ancrées dans la carte**, ne disparaissent pas seules ; confirmation de succès dans
  la carte également. **Rien d'important dans un toast** (§2.1).
- Icônes lucide (trait 1.75) : `Upload`, `CircleAlert`, `CircleCheck`, `ChevronRight`, `Menu`.

## States

Par carte (Logo, Favicon), les quatre états de §3.2 :

| État           | Forme retenue                                                                                                                                                                                                                                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vide**       | Monogramme LP dans le carré (et dans l'onglet) ; « Aucun logo pour l'instant : le monogramme de l'association est affiché à sa place. » (idem favicon) ; l'action pour combler : « Choisir un fichier ».                                                                                                                                      |
| **Chargement** | `progress` avec nom du fichier et pourcentage ; bouton « Envoi en cours… » désactivé, largeur conservée ; l'aperçu actuel reste visible.                                                                                                                                                                                                      |
| **Erreur**     | `alert` destructive ancrée : ce qui s'est passé, **ce qui est conservé**, l'action suivante. Format : « Ce fichier n'a pas été enregistré. Le format JPEG n'est pas accepté. **Le logo actuel est conservé.** Choisissez un fichier PNG ou WebP. » Taille : « …Il pèse 3,2 Mo, la limite est 1 Mo… ». L'aperçu montre toujours l'ancien logo. |
| **Succès**     | « Logo remplacé. Visible sur votre site et dans cet espace. » / « Favicon remplacé. Visible dans l'onglet du navigateur, sur votre site. » ; l'aperçu montre le nouveau fichier.                                                                                                                                                              |

Écran B : un seul état.

### Accessibilité — liste de §3.8

- [x] Contour de champ et de zone de dépôt en `input` (3:1).
- [x] Aucune information portée par la seule couleur : erreurs et succès écrits, icône + texte.
- [x] Tout au clavier, focus visible : cibles ≥ 44 px ; bouton de fichier atteignable même sans glisser-déposer.
- [x] Un seul `h1` par page ; `h3` pour les cartes.
- [ ] Zoom 200 % : à vérifier sur l'écran construit.
- [ ] Monogramme : texte clair sur `accent-solid` — contraste à vérifier pour **chacune des six teintes** (seule
      la teinte 195 est maquettée).

## Design system gaps

Besoins que le système ne couvre pas, ou sur lesquels il est contredit. **Signalés, pas inventés.**

1. **Formats et dimensions du favicon** — aucune règle (§9 range le favicon parmi les manques). La maquette
   affiche volontairement « [formats et dimensions du favicon — à définir] ». À trancher au plan (ICO, PNG ;
   tailles) et à reporter dans le design system.
2. **Le monogramme n'est pas un composant du catalogue.** §1.8 en fixe la règle visuelle (deux lettres,
   Source Serif 4, teinte de l'association, carré 44 / 34 px) mais aucun composant ne le porte, ni sa règle
   d'extraction des deux lettres (« ASL Les Pins » → LP : quels mots ignorer ?). Nécessaire aussi au favicon
   par défaut. À ajouter au design system (§2.2) plutôt qu'à improviser dans l'Execute.
3. **§1.8 contredit la décision de sécurité** : « SVG (préféré) ». Arbitrage du 2026-09-17 : PNG ou WebP
   seulement. **Le design system doit être corrigé** (§1.8), sinon la prochaine story le relira comme une
   consigne.
4. **§9 « Favicon et icônes d'application »** suggérait de dériver le favicon du logo : dépassé par la décision
   du PRD (« deux fichiers fournis par l'association ») et l'arbitrage I-03. **À mettre à jour dans §9** ; les
   icônes d'application (écran d'accueil mobile) restent non couvertes.
5. **Téléversement sur écran tactile** — §2.1 impose « zone de dépôt **et** bouton » sans dire ce que devient
   la zone au tactile. La maquette mobile la réduit au bouton : règle à confirmer et à écrire dans §2.1.
6. **Confirmation de succès** — aucun token « succès » (pas de vert) : la maquette utilise une `alert` neutre
   avec icône `primary`. Cohérent avec §3.3, mais non écrit.
7. **Le back-office de l'association n'existe pas dans le code** : §2.1 décrit sa barre latérale, aucune
   story antérieure ne l'a construite. s01b en pose la première page ; l'enveloppe (barre latérale, tiroir,
   fil d'Ariane) est à traiter au plan sans déborder sur la navigation des stories suivantes.

## Écart avec la story

- **Critère 7** dit « son nom remplace le logo ». Le design retient le **monogramme + le nom écrit à côté**
  (§1.8, arbitrage du 2026-09-17). Le critère est à reformuler en ce sens dans `docs/stories.md` (framing,
  sur la branche par défaut) avant ou pendant le plan.

## Ce que ce design ne couvre pas

- **Teinte d'accent et paramètres** (sélecteur des six teintes, adresses) → s02.
- Toute autre page du back-office et le contenu des autres rubriques de la barre latérale.
- Retirer un logo, recadrer ou éditer une image.
- Avatar utilisateur, images du blog, logo du formulaire d'organisation du boilerplate (restent sur leur
  stockage actuel, arbitrage du 2026-09-17).
- Logo dans les **emails** (s03) et sur le **papier** (§1.8, version monochrome).
- Icônes d'application pour l'écran d'accueil mobile.
