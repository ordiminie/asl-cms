# Design System — ASL-CMS (Lp)

> **Référence visuelle unique du projet.** Lue par `/ks-design` à chaque story.
> Inventer un composant ou un token hors de ce document est interdit : on compose avec ce qui
> existe. Un besoin non couvert est un **« design system gap » à remonter**, jamais à combler
> en freestyle.

**Sources**

| Quoi | Où |
| --- | --- |
| Brief envoyé | `docs/designs/design-system-brief.md` |
| Livraison Claude Design — source éditable | `docs/designs/design-system.dc.html` |
| Livraison Claude Design — rendu ouvrable au navigateur | `docs/designs/design-system-mockups.html` |
| Socle | boilerplate ship-saas : Tailwind 4, shadcn/ui `new-york`, icônes lucide |

**Deux hypothèses du brief, tranchées à la livraison**

- **Personnalisation par association = logo + une couleur d'accent**, rien d'autre.
- **Mode sombre abandonné** — un seul jeu de tokens. Voir « Conséquences » en fin de document.

---

## Tokens

### Couleurs — feuille à copier dans `src/app/globals.css`

Thème clair uniquement. Deux valeurs du thème `stone` du boilerplate sont **volontairement
remplacées** : `primary` (quasi-noir chaud → bleu d'encre : une action doit se lire comme une
action, pas comme du texte) et `input` (0.86 → 0.66, pour atteindre 3:1 sur le contour des
champs, exigé par WCAG 1.4.11).

```css
@import "tailwindcss";

:root {
  --radius: 0.5rem;

  /* surfaces & texte */
  --background: oklch(1 0 0);
  --foreground: oklch(0.22 0.015 250);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.015 250);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.015 250);
  --muted: oklch(0.972 0.005 240);
  --muted-foreground: oklch(0.45 0.02 245);
  --border: oklch(0.90 0.008 245);
  --input: oklch(0.66 0.014 245);
  --ring: oklch(0.55 0.11 235);

  /* actions & intentions */
  --primary: oklch(0.35 0.06 240);
  --primary-foreground: oklch(0.985 0.003 240);
  --secondary: oklch(0.965 0.006 240);
  --secondary-foreground: oklch(0.30 0.02 245);
  --destructive: oklch(0.48 0.17 27);
  --destructive-foreground: oklch(0.99 0.01 27);
  --link: oklch(0.45 0.13 250);

  /* accent = couleur de l'association ; SEULE la teinte varie */
  --accent-hue: 195;
  --accent: oklch(0.958 0.024 var(--accent-hue));
  --accent-foreground: oklch(0.38 0.08 var(--accent-hue));
  --accent-solid: oklch(0.55 0.10 var(--accent-hue));
  --accent-border: oklch(0.88 0.045 var(--accent-hue));

  /* graphiques */
  --chart-1: oklch(0.55 0.10 195);
  --chart-2: oklch(0.45 0.09 250);
  --chart-3: oklch(0.58 0.09 145);
  --chart-4: oklch(0.62 0.10 85);
  --chart-5: oklch(0.50 0.10 300);

  /* barre latérale du back-office */
  --sidebar: oklch(0.985 0.004 250);
  --sidebar-foreground: oklch(0.26 0.015 250);
  --sidebar-primary: oklch(0.35 0.06 240);
  --sidebar-primary-foreground: oklch(0.985 0.003 240);
  --sidebar-accent: oklch(0.93 0.012 245);
  --sidebar-accent-foreground: oklch(0.26 0.02 245);
  --sidebar-border: oklch(0.91 0.008 245);
  --sidebar-ring: oklch(0.55 0.11 235);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-solid: var(--accent-solid);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-link: var(--link);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-public-sans), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-source-serif), Georgia, "Times New Roman", serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, Menlo, monospace;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}
```

### L'accent de l'association — le mécanisme interchangeable

`--accent-hue` est **la seule variable de tenant**. Lightness et chroma sont figés : aucun
bureau ne peut produire un site illisible.

**Six teintes validées, une par association.** Le bureau choisit dans cette liste, pas au
sélecteur libre : `195` eau · `150` pins · `255` lac · `40` tuile · `300` bruyère · `95` genêt.

| | |
| --- | --- |
| **Usages autorisés** | logo, filet de navigation active, encarts d'information, barres de graphique, pastilles décoratives |
| **Usages interdits** | fond de bouton, texte sous 24 px sur blanc (4,9:1 — insuffisant en corps de texte), porteur unique d'un statut |

`accent` / `accent-foreground` = la teinte en surface claire (encarts, sélection douce).
`accent-solid` = la même teinte en aplat lisible (filets, barres, pastilles).
**Les survols de menus et de lignes utilisent `secondary` ou `sidebar-accent`, jamais la teinte
du tenant.**

⚠️ **Injection de la teinte — point d'implémentation.** La livraison propose
`[data-tenant-hue] { --accent-hue: attr(data-tenant-hue type(<number>), 195); }`. L'`attr()`
typé est une fonctionnalité CSS récente au support inégal : **à vérifier avant de s'en
remettre à elle**. Le repli sûr et universel est un style en ligne posé par le serveur sur
`<html>` à partir du tenant résolu (ADR 003) : `style={{'--accent-hue': hue}}`.

### Typographie

Aucune police n'était configurée dans le boilerplate. Configuration complète :

```ts
// src/app/[locale]/base-layout.tsx (ou layout racine)
import {JetBrains_Mono, Public_Sans, Source_Serif_4} from 'next/font/google'

const sans = Public_Sans({
  subsets: ['latin'], display: 'swap',
  weight: ['400', '500', '600', '700'], variable: '--font-public-sans',
})
const serif = Source_Serif_4({
  subsets: ['latin'], display: 'swap',
  weight: ['400', '600', '700'], variable: '--font-source-serif',
})
const mono = JetBrains_Mono({
  subsets: ['latin'], display: 'swap',
  weight: ['400', '500'], variable: '--font-jetbrains-mono',
})

// <body className={`${sans.variable} ${serif.variable} ${mono.variable}
//   font-sans antialiased text-[17px] leading-[1.6] text-foreground bg-background`}>
```

| Famille | Rôle | Pourquoi |
| --- | --- | --- |
| **Source Serif 4** | Titres, chiffres mis en avant, chapeaux d'articles | Serif de lecture, registre de service public, autorité tranquille |
| **Public Sans** | Tout le texte courant, l'interface, les formulaires | Conçue pour l'administration américaine : très ouverte, chiffres non ambigus, excellente à 17 px |
| **JetBrains Mono** | Index de compteur, références de parcelle, montants en tableau | Chasse fixe = relecture chiffre par chiffre |

**Échelle complète**

| Token | Famille | Taille | Graisse | Interlignage | Interlettrage | Usage |
| --- | --- | --- | --- | --- | --- | --- |
| `display` | Source Serif 4 | 44 px / 2.75rem | 600 | 1.1 · 48px | -0.01em | Titre d'accueil du site public, hors bandeau |
| `h1` | Source Serif 4 | 34 px / 2.125rem | 600 | 1.15 · 39px | -0.005em | Titre de page, article, écran membre |
| `h2` | Source Serif 4 | 26 px / 1.625rem | 600 | 1.2 · 31px | 0 | Section, titre de carte du site public |
| `h3` | Public Sans | 20 px / 1.25rem | 600 | 1.3 · 26px | 0 | Sous-section, titre de carte du back-office |
| `body-lg` | Public Sans | 18 px / 1.125rem | 400 | 1.65 · 30px | 0 | Texte courant du site public (AAA) |
| `body` | Public Sans | 17 px / 1.0625rem | 400 | 1.6 · 27px | 0 | Texte courant de l'espace privé, valeurs de champ |
| `body-strong` | Public Sans | 17 px | 600 | 1.6 · 27px | 0 | Nom de membre, montant, mise en avant dans une phrase |
| `label` | Public Sans | 16 px / 1rem | 500 | 1.4 · 22px | 0 | Libellé de formulaire, aide sous le champ, item de liste |
| `button` | Public Sans | 16–17 px | 600 | 1 · 16px | 0 | Boutons ; 17 px dès la taille `lg` et sur mobile |
| `meta` | Public Sans | 15 px / 0.9375rem | 400 | 1.5 · 22px | 0 | Date, poids de fichier, en-tête de tableau (600) |
| `overline` | JetBrains Mono | 12 px | 600 | 1 · 12px | 0.1em | Étiquette de section en capitales, type de bloc |
| `numeric` | JetBrains Mono | 22 px (24 mobile) | 400 | 1 · 22px | 0 | Index de compteur, code d'activation |
| `data` | JetBrains Mono | 15–17 px | 400 | 1.4 | 0 | Parcelle, montants en tableau, `tabular-nums` |

**Règles non négociables**

- Texte courant : **17 px** en privé, **18 px** sur le site public. Jamais moins.
- Libellés de formulaire 16 px / 500 — lisibles, pas discrets. **Jamais de placeholder en guise
  de libellé.**
- Plancher absolu 15 px, réservé aux métadonnées.
- Longueur de ligne 60 à 75 caractères (`max-w-[68ch]`) sur le site public.
- Pas de graisse 300, pas d'italique pour porter une information, pas de capitales sur plus de
  trois mots.
- `text-wrap: pretty` sur les titres, `tabular-nums` dans les tableaux.

### Espacement, rayon, bordures, ombres

**Huit valeurs d'espacement, pas neuf. Toute mesure hors échelle est un bug.**

`1` 4 px bordure interne · `2` 8 px icône ↔ libellé · `3` 12 px champs d'un même groupe ·
`4` 16 px carte compacte · `6` 24 px intérieur de carte · `8` 32 px entre blocs ·
`12` 48 px entre sections · `16` 64 px respiration de page publique

**Rayon** — `--radius: 0.5rem` (le boilerplate était à 0.625rem : registre institutionnel, pas
SaaS). `rounded-sm` 4px puces et pastilles · `rounded-md` 8px champs, boutons, cartes ·
`rounded-lg` 12px feuilles et dialogues · `rounded-full` badges de compteur.

**Bordures** — 1px `border` séparation · 1px `input` champ (3:1) · 2px `primary` sélection ·
2px `destructive` erreur · 4px à gauche `accent-solid` citation.

**Ombres — trois seulement.** Aucune sur les cartes de contenu et les tableaux : la bordure
suffit. `shadow-sm` pour une carte détachée du fond. `shadow-lg` pour dialogues, popovers,
feuilles. Transitions limitées à 120 ms, sur couleur et bordure uniquement.

### Focus, cibles, mouvement

- `outline: 2px solid var(--ring); outline-offset: 2px`. **Jamais `outline: none`**, jamais un
  simple changement de fond.
- Cible minimale **44 × 44** ; 56 px de haut pour les actions principales sur mobile.
- **Aucune action déclenchée au survol seul** : le survol ne fait que teinter.
- Ordre de tabulation = ordre de lecture ; lien d'évitement en tête de chaque page.
- `prefers-reduced-motion` respecté ; aucune animation au-delà de 200 ms.

### Points de rupture et gabarits

`sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280

| Contexte | Gabarit |
| --- | --- |
| Site public | `max-w-[1200px]`, gouttière 24 / 44 px |
| Article | `max-w-[68ch]` |
| Back-office | barre latérale 248 px fixe → tiroir (`sheet`) sous `lg` |
| Éditeur de page | colonne de blocs + panneau 296 px → panneau en tiroir sous `xl` |
| Espace membre | `max-w-[1000px]`, une colonne |

### Icônes — lucide

Trois tailles : 16 (dans le texte), 20 (boutons, lignes), 24 (en-têtes, cartes membre).
Trait 1.75, `currentColor` exclusivement.

**Jamais d'icône seule comme action** côté bureau ou membre : icône + libellé. Les icônes
seules sont tolérées dans la barre latérale repliée, avec `tooltip` **et** `aria-label`.

**Vocabulaire figé** : `Droplet` eau · `FileText` document · `Receipt` facture · `Map` parcelle ·
`Megaphone` actualité · `AlertTriangle` alerte · `Lock` personnel · `GripVertical` poignée de bloc.

---

## Composants disponibles

Les 37 composants du boilerplate, avec la convention d'usage imposée.

| Composant | Usage imposé |
| --- | --- |
| `button` | Variantes `default` `outline` `secondary` `destructive` `link`. Tailles `sm` 40 px (**jamais côté membre**), `default` 48 px, `lg` 56 px (actions principales et mobile). **Un seul bouton `default` par écran** — l'action attendue ; les autres en `outline`. Libellés à l'infinitif explicite : « Publier la page », pas « OK » ni « Valider ». Chargement : libellé remplacé par « Publication en cours… », bouton désactivé, **largeur conservée**. |
| `form` `label` `input` `textarea` `select` `checkbox` `radio-group` `switch` | Une colonne, un champ par ligne ; deux côte à côte seulement s'ils sont courts et liés. Libellé au-dessus, toujours visible. Champs 48 px de haut (56 mobile), texte 17-18 px. « Facultatif » écrit en clair, **jamais d'astérisque**. Validation au *blur* puis à la soumission — jamais à la frappe (sauf `MeterInput`). 2-3 options courtes → `radio-group`, pas `select`. `switch` réservé aux réglages à effet immédiat, avec libellé d'état. |
| `table` `pagination` `badge` | Lignes 56 px, texte 17 px, en-tête sur `muted` en 15 px / 600. Zébrure très légère `oklch(0.99 0.002 250)`. **Une seule action par ligne, en clair** (« Ouvrir ») ; les actions secondaires vivent dans la fiche, pas dans un menu d'icônes. Chiffres en `font-mono` + `tabular-nums`, montants alignés à droite. 25 lignes par page, `pagination` avec « Précédent / Suivant » écrits ; **jamais de défilement infini**. `badge` = statut, jamais une action. |
| `alert` `sonner` `toast` `alert-dialog` `dialog` `sheet` | **Rien d'important ne passe par un toast.** `sonner` réservé aux confirmations sans conséquence (« Brouillon enregistré »), 6 s, bas d'écran. Une erreur, un échec de publication, une donnée perdue → `alert` ancré dans la page, qui ne disparaît pas seul. `alert-dialog` uniquement pour l'irréversible, le bouton nommant l'acte (« Supprimer le bloc image »). `dialog` ≤ 2 champs, au-delà une page ; aucun formulaire long en modale côté membre. `sheet` pour tiroirs mobiles et aperçu, jamais empilé. |
| `sidebar` `breadcrumb` `tabs` `card` `separator` `scroll-area` | `sidebar` : **back-office uniquement**, deux groupes nommés (« Le site », « L'association »), item actif = fond `sidebar-accent` **+ libellé en 600** (pas seulement la couleur). `breadcrumb` dès le 2ᵉ niveau du back-office, inutile en public et membre. `tabs` : 4 maximum, **jamais côté membre** — un membre âgé ne cherche pas un onglet. `card` : bordure 1px sans ombre par défaut. `separator` plutôt qu'une marge quand deux groupes n'ont pas le même statut ; `scroll-area` jamais imbriquée. |
| `markdown-editor` | Le bloc « texte riche ». Barre réduite : gras, italique, titre 2, titre 3, liste, lien. **Pas de tableau, pas de code, pas de couleur de texte.** |
| `file-upload` | Zone de dépôt **et** bouton « Choisir un fichier » — un dépôt seul est inutilisable au doigt et à la souris tremblante. Types et poids annoncés **avant**, pas après l'échec. |
| `chart` | Uniquement la consommation d'eau. **Barres, pas de courbe lissée** ; valeurs écrites sous les barres ; `chart-1` pour l'année courante, `chart-1` à 45 % d'opacité pour l'historique. |
| `progress` `skeleton` | `progress` réservé à l'envoi de campagne et au téléversement. `skeleton` uniquement pour listes et tableaux, **jamais sur un formulaire**. |
| `command` `popover` `tooltip` `collapsible` | `command` : back-office seulement (insertion de bloc, recherche de membre). `tooltip` **jamais porteur d'information indispensable**. `collapsible` jamais utilisé pour cacher du contenu du site public. |
| `avatar` `alert-dialog` `breadcrumb` `code-block` `collapsible` `dropdown-menu` `progress` `radio-group` `scroll-area` `separator` `switch` `tooltip` | Reste du socle shadcn, sans convention propre au-delà des règles générales ci-dessus. |

### Composants à construire

Trois manques structurels, spécifiés en entier dans la livraison (`§18` du mockup). Chacun se
construit **sur les 37 existants, sans dépendance nouvelle**, et suit la convention shadcn
`src/components/ui/<nom>.tsx`.

| Composant | Priorité | Rôle | Statut |
| --- | --- | --- | --- |
| `<PreviewBar />` | **P0** | Barre d'aperçu persistante : ce que je regarde, si c'est en ligne, comment publier ou revenir. `status: draft \| dirty \| live \| publishing \| error \| unpublished`. Fond sombre `oklch(0.24 0.02 250)` hors palette de contenu, sticky 68 px (104 px mobile). L'erreur s'affiche en 2ᵉ ligne de la barre, **jamais en toast**. | Retenu — c'est le dernier écran avant le critère de recette |
| `<MeterInput />` | **P1** | Relevé de compteur : rappelle l'index précédent, calcule la consommation à la frappe, avertit au-delà de 4× la moyenne (bloque jusqu'à confirmation, **garde la valeur**), refuse un index en recul. Cas particuliers : non relevé, nouveau compteur, premier relevé. Saisie conservée localement. | Retenu — cœur de s17/s18 |
| `<CodeInput />` | — | Code d'activation à 6 caractères reçu par courrier. | ⛔ **Hors périmètre** — voir « Écarts » |

Trois autres manques sont signalés sans spécification complète, à traiter en `/ks-design` de la
story concernée : **liste réordonnable par glisser-déposer** (l'éditeur en dépend, à monter sur
`@dnd-kit` déjà présent), **bandeau d'alerte global** (`alert` est un encart, pas une bande
pleine largeur persistante), **sélecteur d'insertion de bloc** (à monter sur `command` + `popover`).

---

## Patterns UI

### Formulaires

Libellé au-dessus, 16 px / 500, toujours visible. Aide sous le champ en `muted-foreground`.
Erreur : bordure `destructive` 2 px **+** message texte sous le champ **+** résumé en tête de
formulaire avec liens d'ancrage. Validation au *blur*, puis à la soumission.

### États — vide, chargement, erreur, succès

| État | Forme imposée |
| --- | --- |
| **Vide** | Une phrase qui dit ce qui manque, **et l'action pour le combler** : « Aucune actualité pour l'instant. → Écrire la première » |
| **Chargement** | `skeleton` sur listes et tableaux uniquement. Sur un bouton : libellé remplacé, largeur conservée. |
| **Erreur** | Ce qui s'est passé, **ce qui est perdu**, l'action suivante : « La page n'a pas pu être publiée. Le bloc "Image" n'a pas de fichier. **Rien n'est perdu.** » Ancrée dans la page, ne disparaît pas seule. |
| **Succès** | Ce qui a eu lieu et où le vérifier : « Page publiée. Visible à l'adresse /nouvel-acquereur. » |

### `primary` ou accent ?

- **`primary`** : toute action, tout état de sélection, toute icône fonctionnelle. Commun aux
  six associations.
- **Accent tenant** : identité seulement — logo, filet de navigation active, encarts, barres de
  graphique.
- **Jamais d'accent sur un bouton** : sa teinte est inconnue à la conception, son contraste sur
  blanc n'est pas garanti.

### Donnée personnelle

**Un seul marqueur, toujours le même** : cadenas (`Lock`) + libellé « Espace personnel » +
parcelle, en haut de l'écran. Tout écran qui l'affiche ne contient **que** des données du membre
connecté. C'est la traduction visuelle du critère de succès « et à rien qui appartienne à un
autre membre ».

### Langue et libellés

- Vouvoiement, phrases courtes, **aucun jargon** : « Publier la page », pas « Déployer » ;
  « Espace membre », pas « Portail » ; « Signaler une fuite », pas « Créer un ticket ».
- Dates en clair côté public (« 2 septembre 2026 »), `02/09/2026` dans les tableaux et champs.
- Unités toujours écrites : m³, €, Ko. Montants au format français (123,45 €).
- Typographie française : espace insécable avant `: ; ! ?`, guillemets « », apostrophe courbe.

### Contrastes vérifiés — WCAG 2.1

| Paire | Ratio | Verdict |
| --- | --- | --- |
| `foreground` / `background` | 17,3:1 | AAA — corps de texte du site public |
| `muted-foreground` / `background` | 7,4:1 | AAA — corrige la limite AA du thème du boilerplate |
| `primary` / `background` | 11,3:1 | AAA |
| `primary-foreground` / `primary` | 11,0:1 | AAA — texte des boutons |
| `link` / `background` | 7,1:1 | AAA — **souligné en plus de la couleur** |
| `destructive` / `background` | 6,5:1 | AA+ — messages et statuts |
| `accent-foreground` / `accent` | 8,9:1 | AAA — texte des encarts d'association |
| `accent-solid` / `background` | 4,9:1 | AA **en ≥ 24 px seulement** — jamais en corps de texte |
| `input` / `background` | 3,1:1 | AA — contour de champ (1.4.11), d'où la valeur assombrie |
| `border` / `background` | 1,4:1 | Séparation décorative uniquement — **jamais un contour de champ** |
| `ring` / `background` | 4,6:1 | AA — anneau de focus 2 px + offset |

### Liste à cocher d'accessibilité — à passer à chaque story

- [ ] Corps de texte du site public ≥ 7:1 (AAA visé)
- [ ] Contour de champ et bordure de composant ≥ 3:1 (1.4.11)
- [ ] Zoom texte à 200 % sans perte de contenu ni de fonction (1.4.4)
- [ ] **Aucune information portée par la seule couleur** (1.4.1) : statut, alerte, résultat
      d'analyse écrits en mots
- [ ] Tout au clavier, focus visible partout (2.1.1, 2.4.7)
- [ ] Un seul `h1` par page, hiérarchie sans saut de niveau

---

## Do / Don't

- ✅ Sobre, aéré, très lisible. Registre de service public local, pas de startup.
- ✅ Le mot porte l'information ; la couleur ne fait que renforcer.
- ✅ Icône **+** libellé. Cibles 44 × 44 minimum.
- ✅ Une seule action attendue par écran, en `default` ; le reste en `outline`.
- ✅ Un message d'erreur dit ce qui est perdu — et le plus souvent, que rien ne l'est.
- ❌ Dégradés spectaculaires, verre dépoli, ombres portées lourdes, animations d'apparition.
- ❌ Densité de tableau de bord SaaS, surtout côté membre : il vient chercher une chose.
- ❌ Texte courant sous 17 px. Placeholder en guise de libellé. Astérisque pour l'obligatoire.
- ❌ `tabs` ou `sidebar` côté membre. Menu d'icônes en bout de ligne de tableau.
- ❌ Une information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ L'accent du tenant sur un bouton, ou comme unique porteur d'un statut.
- ❌ Défilement infini. Action au survol seul. `outline: none`.

---

## Écarts et conséquences

### ⛔ Un point de la livraison sort du périmètre — non capturé

La livraison spécifie, en **P0**, un écran « Connexion & première connexion » avec **activation
par identifiant de parcelle + code reçu par courrier**, un **mot de passe**, et le composant
`<CodeInput />` construit pour ce flux. Le raisonnement est bon — un quart des membres n'a pas
d'email — mais il résout un problème que le produit a **délibérément choisi de ne pas résoudre** :

- PRD, cimetière : « Plan B de connexion pour les membres sans email : **aucun compte, aucun
  contournement**. Ils restent gérés par courrier — et c'est précisément ce que le publipostage
  PDF vient améliorer. »
- `CDCT §3.3` : « Aucun compte, aucune fonctionnalité de contournement à prévoir. »
- Règle transverse des stories : « aucun plan B de connexion pour les membres sans email — le
  publipostage PDF (s28) est la réponse produite. »

S'y ajoute un second écart : la connexion se fait **par lien magique, sans mot de passe**,
valable 4 h (s03). La livraison suppose un mot de passe.

**Ce point n'est donc pas capturé, et `/ks-design` ne doit pas s'en servir.** Le rouvrir serait
une modification du PRD et du cahier des charges contractuel — une décision client, pas une
décision de design system.

Le reste de la spécification `§17` (écrans manquants) est **retenu** et constitue une bonne
matière première pour les `/ks-design` des stories concernées.

### Le mode sombre disparaît — trois conséquences à traiter

L'abandon du mode sombre n'est pas neutre pour le socle :

1. `src/app/globals.css` porte un bloc `.dark` complet, à retirer ; `next-themes` et le sélecteur
   de thème deviennent sans objet.
2. `.claude/rules/01-presentation/rule-mdx-rendering.md` impose de vérifier chaque modification
   « en clair et en sombre ». **Cette règle doit être mise à jour** dans le même commit, sinon
   elle réclame une vérification impossible.
3. `docs/architecture.md` liste `docs/[...slug]` parmi les routes bloquantes assumées **au motif
   qu'elle lit `x-theme` pour la coloration Shiki**. Ce motif tombe : la route peut redevenir
   prerendable, et le dual-theme Shiki se simplifie en thème unique.

Ces trois points appartiennent à la story qui applique le design system au socle.

### Ce qui reste à trancher

- Le **format exact du code d'activation** imprimé sur les courriers — sans objet tant que le
  point ci-dessus reste hors périmètre.
- Le **relevé en série hors ligne** (s17) : stockage local avec synchronisation, ou simple
  tolérance aux coupures ? À trancher en `/ks-research s17`.
- Le support de l'`attr()` typé pour l'injection de la teinte de tenant — repli documenté
  plus haut.
