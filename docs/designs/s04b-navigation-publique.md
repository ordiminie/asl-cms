# Design — Story s04b-navigation-publique

> Conçu le 2026-09-22, chemin **Claude Design** : brief `docs/designs/s04b-navigation-publique-brief.md`,
> canevas `https://claude.ai/design/p/4fad5fa8-30bd-42b1-bd47-f5210b780532`, **validé par Marie-Ève le
> 2026-09-22** (ordinateur et mobile, clair et sombre), puis reporté ici. Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s04b-navigation-publique.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                   | Où                                                           |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1       | Composer le menu (ajouter/retirer/réordonner), rendu dans l'ordre  | **Écran 1** (Card « Menu ») → **Écran 2**                    |
| 2       | Page dépubliée/supprimée → entrée absente côté public, sans casser | **Écran 1** (annotation « Masquée »), **Écran 2** (omission) |
| 3       | Pied de page modifiable, visible sur toutes les pages publiques    | **Écran 1** (Card « Pied de page ») → **Écran 2**            |
| 4       | Scopé au tenant                                                    | _non dessinable_ (isolation, pas un écran)                   |
| 5       | Publier/dépublier une page met le menu à jour sans délai           | _non dessinable_ (cache, pas un écran)                       |
| 6       | Visibilité propre à l'entrée, indépendante du statut de la page    | **Écran 1** (`switch` « Visible »)                           |
| 7       | Membre non-bureau ne peut modifier ni l'un ni l'autre              | _non dessinable_ (autorisation, pas un écran)                |

## Screen(s)

Décisions de périmètre prises pendant ce design (portées dans le brief, reprises ici) :

1. **Le menu et le pied de page composés par le bureau remplacent** le menu (Privacy/Terms/Docs/Blog)
   et le pied de page (quatre colonnes SaaS) actuels — contenu de démonstration du boilerplate, sans
   rapport avec une association. Ce n'est pas un ajout à côté.
2. **Le pied de page est un champ de contenu unique** en texte riche restreint, pas plusieurs colonnes
   de liens.

### Écran 1 — Bureau : Navigation du site

`h1` « Navigation du site », deux `card` empilées :

- **Card « Menu du site »** : liste réordonnable réutilisant **à l'identique** `<SortableList />`
  (poignée + Monter/Descendre toujours visibles, premier élément « Monter » désactivé, dernier
  « Descendre » désactivé, pastille de rang écrite). Chaque ligne : titre de la page cible + son statut
  en `meta`, un `switch` « Visible » à effet immédiat, les deux boutons de déplacement, un bouton
  « Retirer du menu ». Une entrée dont la page n'est pas publiée reste dans la liste avec l'annotation
  « Masquée sur le site public — la page n'est pas publiée » (`muted-foreground`, pas une couleur
  d'alerte : état normal, pas une erreur). Bouton `outline` « + Ajouter une entrée » ouvrant un
  sélecteur (`command`, recherche, back-office) des pages pas encore dans le menu, chacune avec son
  statut visible. Retirer une entrée montre une bande `warning` ancrée avec « Annuler » (10 s, même
  patron que l'annulation de réordonnancement de s04).
- **Card « Pied de page »** : un seul `markdown-editor` restreint (barre : gras, italique, titre 2,
  titre 3, liste, lien), aide sous le champ, bouton `default` unique de l'écran « Enregistrer »
  (libellé remplacé « Enregistrement… » pendant l'envoi, largeur conservée). Échec →`alert` `warning`
  ancrée, jamais un toast.

Toute action de la Card « Menu » (ajouter, retirer, réordonner, bascule de visibilité) s'applique
**immédiatement**, sans bouton d'enregistrement séparé.

**Mobile (390 px)** : les deux Cards restent empilées pleine largeur ; les lignes du menu suivent le
patron mobile déjà établi par `<SortableList />` (poignée + boutons conservés, switch et « Retirer »
en dessous) ; le sélecteur passe en `sheet` ; le bouton « Enregistrer » du pied de page passe pleine
largeur 56 px.

### Écran 2 — Site public : menu et pied de page rendus

En-tête public existant (logo/monogramme + nom, non redessiné), zone de navigation remplacée par les
entrées visibles du menu dans leur ordre, en liens texte simples (pas de bouton). Pied de page : le
contenu unique du bureau, rendu comme un bloc de texte riche (§4 du design system — `h2`/`h3`
seulement, gras, italique, listes, liens). L'entrée masquée (page en brouillon) est simplement absente
de la navigation rendue — aucun espace vide, aucun lien cassé.

**Mobile (390 px)** : le menu passe dans le tiroir mobile existant (`PublicMobileMenu`), avec les
entrées du bureau à la place des liens actuels. Le pied de page passe en une colonne, gouttière 18 px.

## Mockup

`docs/designs/s04b-navigation-publique.html` — référence visuelle, normalisée depuis l'export Claude
Design (runtime `<x-dc>`/`support.js` retiré, bascule clair-sombre réécrite en JS natif, aucune
dépendance externe). 2 sections ancrées (`#s1`–`#s2`), desktop et mobile 390 px, bascule clair/sombre
en tête de page. **NE PAS copier en production** : l'Execute construit l'écran avec les vrais
composants du socle (`card`, `switch`, `command`, `markdown-editor`, `alert`) et `<SortableList />`
réutilisé tel qu'il existe déjà dans le code depuis s04 — aucun composant n'est réinventé. Données
fictives : « Les Amis de l'Étang », mêmes pages que s04 (« Qualité de l'eau », « Adhérer à
l'association », « Fête de l'étang 2025 », plus « Compte-rendu AG 2025 » en brouillon pour illustrer
le masquage).

## Reused components (from the design system)

- `button`, `card`, `switch` (effet immédiat), `command` (back-office, recherche), `markdown-editor`
  restreint, `alert` (jamais de toast), `skeleton` (liste seulement), `sidebar` (nouvelle entrée dans
  le groupe déjà ouvert « Le site »).
- **`<SortableList />` réutilisé à l'identique** (P0 du design system, déjà construit et livré par
  s04) — aucun nouveau composant P0 introduit par cette story.

## States

**Écran 1** : liste peuplée avec une entrée masquée annotée ; menu vide (« Aucune entrée… → Ajouter
une page ») ; chargement (`skeleton`) ; sélecteur d'ajout ouvert ; bande de retrait avec annulation
10 s ; échec d'enregistrement du pied de page (`alert` ancrée).

**Écran 2** : navigation avec 3 entrées visibles (la 4ᵉ, en brouillon, omise) ; menu vide (en-tête
réduit au logo/nom, aucune zone de navigation) ; tiroir mobile ouvert.

## Design system gaps

Aucun gap nouveau. Le design system ne réserve aucune section à cette story (vérifié en recherche,
`docs/design-system.md` §9 ne cite pas s04b) — ce design compose entièrement depuis les tokens et
composants génériques (§1-§3) et le P0 déjà livré (`<SortableList />`), sans en inventer.

## Ce que ce design ne couvre pas

- L'en-tête au-delà de la zone de navigation (logo, teinte, nom) — déjà livré.
- La création/édition/publication d'une page — story s04, déjà livrée.
- Les sous-menus ou une profondeur de menu supplémentaire — hors périmètre assumé.
- Un module d'apparence pour le pied de page (couleurs, mise en page) — un seul champ de texte riche.
