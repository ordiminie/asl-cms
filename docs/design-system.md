# Design System — ASL-CMS (Lp)

> **Référence visuelle unique du projet.** Lue par `/ks-design` à chaque story.
> Inventer un composant ou un token hors de ce document est interdit : on compose avec ce qui
> existe. Un besoin non couvert est un **« design system gap » à remonter**, jamais à combler
> en freestyle. La liste des manques connus est en fin de document.

**Sources** — deux livraisons Claude Design, fusionnées ici.

| Quoi                                          | Où                                                                                                                                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brief n° 1 — le système                       | `docs/designs/design-system-brief.md`                                                                                                                                                                                                           |
| Brief n° 2 — médias transverses et manques    | `docs/designs/design-system-brief-2.md`                                                                                                                                                                                                         |
| Livraison n° 1 — source éditable              | `docs/designs/design-system.dc.html` (§1 à §18)                                                                                                                                                                                                 |
| Livraison n° 1 — rendu ouvrable au navigateur | `docs/designs/design-system-mockups.html` ⚠️ **périmé sur un point** : ce rendu n'a pas été régénéré après la correction du second tour et affiche encore `<CodeInput />` comme s'il faisait partie du livrable. La source `.dc.html` fait foi. |
| Livraison n° 2 — source éditable              | `docs/designs/design-system-media.dc.html` (§19 à §25)                                                                                                                                                                                          |
| Livraison n° 2 — rendu ouvrable au navigateur | `docs/designs/design-system-media-mockups.html`                                                                                                                                                                                                 |
| Socle                                         | boilerplate ship-saas : Tailwind 4, shadcn/ui `new-york`, icônes lucide                                                                                                                                                                         |

**Décisions fondatrices**

- **Personnalisation par association = logo + une teinte d'accent**, rien d'autre.
- **Mode sombre abandonné** — un seul jeu de tokens. Conséquences en fin de document.
- **Aucun plan B de connexion pour les membres sans email.** Ils n'ont aucun compte : la
  réponse produit à leur situation est le **publipostage papier**. La livraison n° 1 proposait
  un `<CodeInput />` d'activation par courrier ; il a été **retiré au second tour**.
- **Aucun mot de passe** : connexion par lien magique seul, valable 4 heures.

---

## 1 · Tokens

### 1.1 Couleurs — feuille à copier dans `src/app/globals.css`

Thème clair unique. Deux valeurs du thème `stone` du boilerplate sont **volontairement
remplacées** : `primary` (quasi-noir chaud → bleu d'encre : une action doit se lire comme une
action, pas comme du texte) et `input` (0.86 → 0.66, pour atteindre 3:1 sur le contour des
champs, exigé par WCAG 1.4.11). Le trio `warning` est **ajouté** — il n'existait pas dans le
socle et le bandeau d'alerte comme la deuxième relance en dépendent.

```css
@import 'tailwindcss';

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
  --border: oklch(0.9 0.008 245);
  --input: oklch(0.66 0.014 245);
  --ring: oklch(0.55 0.11 235);

  /* actions & intentions */
  --primary: oklch(0.35 0.06 240);
  --primary-foreground: oklch(0.985 0.003 240);
  --secondary: oklch(0.965 0.006 240);
  --secondary-foreground: oklch(0.3 0.02 245);
  --destructive: oklch(0.48 0.17 27);
  --destructive-foreground: oklch(0.99 0.01 27);
  --link: oklch(0.45 0.13 250);

  /* avertissement — bandeau d'alerte niveau 2, deuxième relance */
  --warning: oklch(0.94 0.06 75);
  --warning-border: oklch(0.72 0.12 70);
  --warning-foreground: oklch(0.3 0.08 60);

  /* accent = couleur de l'association ; SEULE la teinte varie */
  --accent-hue: 195;
  --accent: oklch(0.958 0.024 var(--accent-hue));
  --accent-foreground: oklch(0.38 0.08 var(--accent-hue));
  --accent-solid: oklch(0.55 0.1 var(--accent-hue));
  --accent-border: oklch(0.88 0.045 var(--accent-hue));

  /* graphiques */
  --chart-1: oklch(0.55 0.1 195);
  --chart-2: oklch(0.45 0.09 250);
  --chart-3: oklch(0.58 0.09 145);
  --chart-4: oklch(0.62 0.1 85);
  --chart-5: oklch(0.5 0.1 300);

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
  --color-warning: var(--warning);
  --color-warning-border: var(--warning-border);
  --color-warning-foreground: var(--warning-foreground);
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
  --font-serif: var(--font-source-serif), Georgia, 'Times New Roman', serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, Menlo, monospace;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}
```

### 1.2 L'accent de l'association

`--accent-hue` est **la seule variable de tenant**. Lightness et chroma sont figés : aucun
bureau ne peut produire un site illisible.

**Six teintes validées.** Le bureau choisit dans cette liste, jamais au sélecteur libre.

| Teinte | Nom     | Aplat `accent-solid` | Surface `accent` | Encre `accent-foreground` |
| ------ | ------- | -------------------- | ---------------- | ------------------------- |
| 195    | eau     | `#17849B`            | `#E8F5F8`        | `#185A66`                 |
| 150    | pins    | `#2E7D52`            | `#E7F5EC`        | `#1E4A31`                 |
| 255    | lac     | `#3A6FB0`            | `#EAF1FA`        | `#23445F`                 |
| 40     | tuile   | `#A8623A`            | `#F8EDE6`        | `#5E3421`                 |
| 300    | bruyère | `#7A5AA8`            | `#F1ECF9`        | `#3F2E5C`                 |
| 95     | genêt   | `#7C7326`            | `#F4F2E2`        | `#423D14`                 |

_(les hex servent l'email et le papier, où OKLCH n'est pas calculable — voir §5 et §6)_

|              |                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **Autorisé** | logo, filet de navigation active, encarts d'information, barres de graphique, pastilles décoratives |
| **Interdit** | fond de bouton, texte sous 24 px sur blanc (4,9:1), porteur unique d'un statut                      |

`accent` / `accent-foreground` = la teinte en surface claire. `accent-solid` = la même teinte en
aplat lisible. **Les survols de menus et de lignes utilisent `secondary` ou `sidebar-accent`,
jamais la teinte du tenant.**

⚠️ **Injection de la teinte.** La livraison propose
`[data-tenant-hue] { --accent-hue: attr(data-tenant-hue type(<number>), 195); }`. L'`attr()`
typé est récent et son support inégal : **à vérifier avant de s'en remettre à elle**. Le repli
sûr est un style en ligne posé par le serveur sur `<html>` à partir du tenant résolu (ADR 003) :
`style={{'--accent-hue': hue}}`.

### 1.3 Typographie

Aucune police n'était configurée dans le boilerplate.

```ts
// src/app/[locale]/base-layout.tsx
import {JetBrains_Mono, Public_Sans, Source_Serif_4} from 'next/font/google'

const sans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-public-sans',
})
const serif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600', '700'],
  variable: '--font-source-serif',
})
const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
})

// <body className={`${sans.variable} ${serif.variable} ${mono.variable}
//   font-sans antialiased text-[17px] leading-[1.6] text-foreground bg-background`}>
```

| Famille            | Rôle                                                           | Pourquoi                                                                                         |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Source Serif 4** | Titres, chiffres mis en avant, chapeaux d'articles             | Serif de lecture, registre de service public, autorité tranquille                                |
| **Public Sans**    | Texte courant, interface, formulaires                          | Conçue pour l'administration américaine : très ouverte, chiffres non ambigus, excellente à 17 px |
| **JetBrains Mono** | Index de compteur, références de parcelle, montants en tableau | Chasse fixe = relecture chiffre par chiffre                                                      |

| Token         | Famille        | Taille            | Graisse | Interlignage | Interlettrage | Usage                                             |
| ------------- | -------------- | ----------------- | ------- | ------------ | ------------- | ------------------------------------------------- |
| `display`     | Source Serif 4 | 44 px             | 600     | 1.1 · 48px   | -0.01em       | Titre d'accueil du site public                    |
| `h1`          | Source Serif 4 | 34 px             | 600     | 1.15 · 39px  | -0.005em      | Titre de page, article, écran membre              |
| `h2`          | Source Serif 4 | 26 px             | 600     | 1.2 · 31px   | 0             | Section, titre de carte du site public            |
| `h3`          | Public Sans    | 20 px             | 600     | 1.3 · 26px   | 0             | Sous-section, titre de carte du back-office       |
| `body-lg`     | Public Sans    | 18 px             | 400     | 1.65 · 30px  | 0             | Texte courant du site public (AAA)                |
| `body`        | Public Sans    | 17 px             | 400     | 1.6 · 27px   | 0             | Texte courant de l'espace privé, valeurs de champ |
| `body-strong` | Public Sans    | 17 px             | 600     | 1.6 · 27px   | 0             | Nom de membre, montant, mise en avant             |
| `label`       | Public Sans    | 16 px             | 500     | 1.4 · 22px   | 0             | Libellé de formulaire, aide, item de liste        |
| `button`      | Public Sans    | 16–17 px          | 600     | 1 · 16px     | 0             | Boutons ; 17 px dès `lg` et sur mobile            |
| `meta`        | Public Sans    | 15 px             | 400     | 1.5 · 22px   | 0             | Date, poids de fichier, en-tête de tableau (600)  |
| `overline`    | JetBrains Mono | 12 px             | 600     | 1 · 12px     | 0.1em         | Étiquette de section en capitales, type de bloc   |
| `numeric`     | JetBrains Mono | 22 px (24 mobile) | 400     | 1 · 22px     | 0             | Index de compteur                                 |
| `data`        | JetBrains Mono | 15–17 px          | 400     | 1.4          | 0             | Parcelle, montants en tableau, `tabular-nums`     |

**Règles non négociables** — texte courant **17 px** en privé, **18 px** en public, jamais moins ·
libellés 16 px / 500, toujours visibles, **jamais de placeholder en guise de libellé** · plancher
absolu 15 px pour les métadonnées · longueur de ligne 60-75 caractères (`max-w-[68ch]`) en public ·
pas de graisse 300, pas d'italique porteur d'information, pas de capitales au-delà de trois mots ·
`text-wrap: pretty` sur les titres, `tabular-nums` dans les tableaux.

### 1.4 Espacement, rayon, bordures, ombres

**Huit valeurs d'espacement, pas neuf. Toute mesure hors échelle est un bug.**
`1` 4px bordure interne · `2` 8px icône ↔ libellé · `3` 12px champs d'un même groupe ·
`4` 16px carte compacte · `6` 24px intérieur de carte · `8` 32px entre blocs ·
`12` 48px entre sections · `16` 64px respiration de page publique

**Rayon** — `--radius: 0.5rem` (le socle était à 0.625rem : registre institutionnel, pas SaaS).
`rounded-sm` 4px puces · `rounded-md` 8px champs, boutons, cartes · `rounded-lg` 12px feuilles et
dialogues · `rounded-full` badges de compteur.

**Bordures** — 1px `border` séparation · 1px `input` champ (3:1) · 2px `primary` sélection ·
2px `destructive` erreur · 4px à gauche `accent-solid` citation.

**Ombres — trois seulement.** Aucune sur cartes de contenu et tableaux : la bordure suffit.
`shadow-sm` carte détachée du fond. `shadow-lg` dialogues, popovers, feuilles. Transitions
limitées à 120 ms, sur couleur et bordure.

### 1.5 Focus, cibles, mouvement

- `outline: 2px solid var(--ring); outline-offset: 2px`. **Jamais `outline: none`.**
- Cible minimale **44 × 44** ; 56 px pour les actions principales sur mobile.
- **Aucune action déclenchée au survol seul** : le survol ne fait que teinter.
- Ordre de tabulation = ordre de lecture ; lien d'évitement en tête de page.
- `prefers-reduced-motion` respecté ; aucune animation au-delà de 200 ms.

### 1.6 Points de rupture et gabarits

`sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280

| Contexte        | Gabarit                                                         |
| --------------- | --------------------------------------------------------------- |
| Site public     | `max-w-[1200px]`, gouttière 24 / 44 px (18 px en mobile)        |
| Article         | `max-w-[68ch]`                                                  |
| Back-office     | barre latérale 248 px fixe → tiroir (`sheet`) sous `lg`         |
| Éditeur de page | colonne de blocs + panneau 296 px → panneau en tiroir sous `xl` |
| Espace membre   | `max-w-[1000px]`, une colonne                                   |

### 1.7 Icônes — lucide

Trois tailles : 16 (dans le texte), 20 (boutons, lignes), 24 (en-têtes, cartes membre).
Trait 1.75, `currentColor` exclusivement.

**Jamais d'icône seule comme action** côté bureau ou membre : icône + libellé. Tolérées dans la
barre latérale repliée, avec `tooltip` **et** `aria-label`.

**Vocabulaire figé** : `Droplet` eau · `FileText` document · `Receipt` facture · `Map` parcelle ·
`Megaphone` actualité · `AlertTriangle` alerte · `Lock` personnel · `GripVertical` poignée de bloc.

### 1.8 Le logo de l'association

| Contexte    | Taille | Forme                                  |
| ----------- | ------ | -------------------------------------- |
| Site public | 44 px  | couleur                                |
| Back-office | 34 px  | couleur                                |
| Email       | 36 px  | **PNG** (SVG non fiable en messagerie) |
| Papier      | 34 px  | **monochrome**                         |

**Ce que l'association fournit** : SVG (préféré) ou PNG transparent — **JPEG refusé** (fond blanc
parasite). Ratio carré 1:1, jusqu'à 3:1 en largeur. ≥ 512 px de côté, ≤ 1 Mo. Rendu inscrit dans
un carré de 44 px, sans rognage, garde de 2 px. La version monochrome du papier est dérivée
automatiquement, **à valider**.

**Sans logo — le cas au provisioning** : un **monogramme** de deux lettres tirées du nom
(« La Fourche » → LF), en Source Serif 4 sur la teinte de l'association, et en noir sur blanc
pour le papier. Jamais de logo générique ni de silhouette d'immeuble. Le bureau peut le
remplacer à tout moment **sans qu'aucun écran ne change de mise en page** : le carré fait 44 px
dans les deux cas.

---

## 2 · Composants

### 2.1 Les 37 du socle — conventions d'usage

| Composant                                                                    | Usage imposé                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button`                                                                     | Variantes `default` `outline` `secondary` `destructive` `link`. Tailles `sm` 40 px (**jamais côté membre**), `default` 48 px, `lg` 56 px. **Un seul bouton `default` par écran** ; les autres en `outline`. Libellés à l'infinitif explicite : « Publier la page », pas « OK ». Chargement : libellé remplacé, bouton désactivé, **largeur conservée**. |
| `form` `label` `input` `textarea` `select` `checkbox` `radio-group` `switch` | Une colonne, un champ par ligne. Libellé au-dessus, toujours visible. Champs 48 px (56 mobile), texte 17-18 px. « Facultatif » écrit en clair, **jamais d'astérisque**. Validation au _blur_ puis à la soumission (sauf `MeterInput`). 2-3 options courtes → `radio-group`. `switch` réservé aux réglages à effet immédiat, avec libellé d'état.        |
| `table` `pagination` `badge`                                                 | Lignes 56 px, texte 17 px, en-tête sur `muted` en 15 px / 600. Zébrure `oklch(0.99 0.002 250)`. **Une seule action par ligne, en clair.** Chiffres en `font-mono` + `tabular-nums`. 25 lignes par page (**10 sous 640 px**), « Précédent / Suivant » écrits, **jamais de défilement infini**. `badge` = statut, jamais une action.                      |
| `alert` `sonner` `toast` `alert-dialog` `dialog` `sheet`                     | **Rien d'important ne passe par un toast.** `sonner` réservé aux confirmations sans conséquence, 6 s. Erreur, échec de publication, donnée perdue → `alert` ancré dans la page. `alert-dialog` uniquement pour l'irréversible, le bouton nommant l'acte. `dialog` ≤ 2 champs. `sheet` pour tiroirs mobiles et aperçu, jamais empilé.                    |
| `sidebar` `breadcrumb` `tabs` `card` `separator` `scroll-area`               | `sidebar` : **back-office uniquement**, deux groupes (« Le site », « L'association »), item actif = fond `sidebar-accent` **+ libellé en 600**. `breadcrumb` dès le 2ᵉ niveau du back-office. `tabs` : 4 maximum, **jamais côté membre**. `card` : bordure 1px sans ombre par défaut. `scroll-area` jamais imbriquée.                                   |
| `markdown-editor`                                                            | Le bloc « texte riche ». Barre réduite : gras, italique, titre 2, titre 3, liste, lien. **Pas de tableau, pas de code, pas de couleur de texte.**                                                                                                                                                                                                       |
| `file-upload`                                                                | Zone de dépôt **et** bouton « Choisir un fichier ». Types et poids annoncés **avant** l'échec.                                                                                                                                                                                                                                                          |
| `chart`                                                                      | Uniquement la consommation d'eau. **Barres, pas de courbe lissée** ; valeurs écrites sous les barres ; `chart-1` année courante, `chart-1` à 45 % pour l'historique.                                                                                                                                                                                    |
| `progress` `skeleton`                                                        | `progress` : envoi de campagne et téléversement. `skeleton` : listes et tableaux, **jamais un formulaire**.                                                                                                                                                                                                                                             |
| `command` `popover` `tooltip` `collapsible`                                  | `command` : back-office seulement. `tooltip` **jamais porteur d'information indispensable**. `collapsible` jamais pour cacher du contenu public.                                                                                                                                                                                                        |
| `avatar` `code-block` `dropdown-menu` `separator`                            | Reste du socle, sans convention propre au-delà des règles générales.                                                                                                                                                                                                                                                                                    |

### 2.2 Les six à construire

Tous se montent **sur les 37 existants, sans dépendance nouvelle**, et suivent la convention
shadcn `src/components/ui/<nom>.tsx`. Chaque état correspond à une story.

| Composant              | Prio   | Rôle et contraintes clés                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<PreviewBar />`       | **P0** | Aperçu avant publication. `status: draft \| dirty \| live \| publishing \| error \| unpublished`. Fond sombre `oklch(0.24 0.02 250)` **hors palette de contenu**. Sticky 68 px (104 mobile). L'erreur s'affiche en 2ᵉ ligne de la barre, **jamais en toast**. Point d'état **+ libellé écrit** : jamais la couleur seule.                                                                                                         |
| `<AlertBanner />`      | **P0** | Bandeau d'alerte global, au-dessus de l'en-tête public, **pousse la page, ne la recouvre pas**. Voir §2.3.                                                                                                                                                                                                                                                                                                                        |
| `<SortableList />`     | **P0** | Réordonnancement des blocs. Voir §2.4 — la contrainte d'accessibilité y est structurante.                                                                                                                                                                                                                                                                                                                                         |
| `<BlockPicker />`      | **P0** | Insertion d'un bloc à un rang précis. Voir §2.5.                                                                                                                                                                                                                                                                                                                                                                                  |
| `<MeterInput />`       | **P1** | Relevé de compteur : rappelle l'index précédent, calcule la consommation à la frappe, **avertit au-delà de 4× la moyenne** (bloque jusqu'à confirmation, **garde la valeur**), **refuse un index en recul**. Cas particuliers : non relevé (motif), nouveau compteur, premier relevé. Saisie conservée localement — une coupure réseau au fond d'un chemin ne perd rien. `Entrée` = enregistrer et passer à la parcelle suivante. |
| `<ImpersonationBar />` | **P1** | Simulation de rôle SuperAdmin. Voir §2.6.                                                                                                                                                                                                                                                                                                                                                                                         |

### 2.3 `<AlertBanner />` — trois niveaux

```
id · level: "info" | "warning" | "critical" · message (280 car. max)
link?: {label, href} · endsAt?: Date · publishedAt · publishedBy
dismissible = level !== "critical" · onDismiss() · onDeactivate()
```

Les trois niveaux se distinguent par **quatre signaux** : la forme de l'icône (rond, triangle,
carré), le mot du niveau écrit, l'épaisseur du filet, la couleur. **Jamais la couleur seule.**

- **Niveau 1 · information** — réunion, rappel. Refermable.
- **Niveau 2 · avertissement** — coupure programmée. Refermable. Palette `warning`.
- **Niveau 3 · urgence** — eau impropre à la consommation. **Non refermable.**

**La décision sur le masquage**, et son raisonnement : les niveaux 1 et 2 sont refermables, mais
le masquage vaut pour _ce message_ (clé = `id`), dure **24 h**, et ne survit pas à une
modification du texte. _Un bandeau permanent qu'on ne peut pas écarter fait fuir le lecteur âgé
qui croit avoir cassé le site._ Le niveau 3 n'est pas refermable : _une eau impropre à la
consommation n'est pas une préférence d'affichage._

**Contrepartie assumée** : le bureau doit pouvoir désactiver **en un clic depuis n'importe quelle
page** du back-office, et un rappel « bandeau d'urgence actif depuis 3 jours » s'affiche à partir
de 48 h — sinon un niveau 3 oublié devient du bruit.

Un seul bandeau actif à la fois ; en activer un second remplace le premier, avec confirmation.
`endsAt` dépassé → désactivation automatique. Masquage en `localStorage` sous `alert:{id}`.
Mobile : trois lignes maximum, **jamais la moitié de l'écran**.

### 2.4 `<SortableList />` — le glisser-déposer n'est pas le chemin obligatoire

```
items: T[] · getId(item) · onReorder(nextItems, moved)
renderItem(item, {index, total, isDragging}) · labelFor(item)
showMoveButtons = true · undoWindowMs = 10000
```

**C'est la règle la plus importante du composant** : une main âgée ou tremblante ne fait pas de
_drag_. La poignée **et** les boutons « Monter / Descendre » sont donc de premier rang, visibles
en permanence, **jamais révélés au survol**. Les boutons sont la voie recommandée au bureau.

- Le premier bloc a « Monter » **désactivé et annoncé, jamais absent** : la barre d'actions ne
  bouge pas d'une ligne à l'autre.
- Poignée : `Espace` saisit, `↑ ↓` déplacent, `Espace` dépose, `Échap` annule.
- Cibles 44 × 44 ; zone de poignée de 44 px de large sur toute la hauteur de ligne.
- **Le focus suit le bloc déplacé**, jamais le rang libéré.
- Annulation : un seul niveau, 10 secondes, dans une **bande ancrée sous la liste** — pas un
  toast, pas un `Ctrl+Z` à deviner.
- Annonces en `aria-live="polite"` : « Image + légende, position 2 sur 4 ». Le rang est **écrit
  dans la pastille**, jamais porté par la seule position.

### 2.5 `<BlockPicker />` — comprendre « Encart » sans l'avoir essayé

```
types: BlockType[] {id, label, description, preview} · insertAt: number
onInsert(typeId, index) · trigger: "separator" | "footer" · searchable = true
```

L'insertion se fait **à un endroit précis** : un séparateur « + Insérer un bloc ici » apparaît
entre deux blocs, **visible en permanence** (jamais au survol seul), 44 px de haut. En bas de
page, le même composant en pleine largeur : « + Ajouter un bloc ».

Chaque type porte un nom en clair, **une phrase d'usage** et un aperçu miniature :

| Type            | Phrase d'usage                                                      |
| --------------- | ------------------------------------------------------------------- |
| Texte riche     | Un titre et des paragraphes, avec gras, listes et liens.            |
| Image + légende | Une photo et son texte explicatif en dessous.                       |
| Document PDF    | Un fichier à télécharger : analyse d'eau, statuts, compte rendu.    |
| Galerie         | Plusieurs photos en grille, agrandissables au clic.                 |
| Encart          | Une information mise à part, teintée aux couleurs de l'association. |

**Cinq types, jamais plus** : pas de catégories, pas d'onglets, aucun défilement caché. La
recherche est présente mais facultative — cinq lignes se lisent plus vite qu'elles ne se tapent.

### 2.6 `<ImpersonationBar />` — à ne jamais confondre avec `<PreviewBar />`

```
actor: {id, email} · subject: {id, name, role, parcel?}
startedAt · expiresAt · onExit() · onConfirmWrite(action) · writeGuard = true
```

**Distinction visuelle imposée** : `PreviewBar` est sombre et neutre, `ImpersonationBar` est
**rayée magenta**. Deux états dangereux à confondre, deux traitements que rien ne rapproche.

- `sticky; top: 0; z-index: 60` — **au-dessus de `AlertBanner`** et de tout le reste.
- **Jamais réductible, jamais refermable** : la seule sortie est de quitter la simulation.
- « Revenir à mon compte » est un **bouton plein blanc**, seul élément clair de la barre, donc le
  premier vu.
- **Avertissement avant une écriture, jamais après** : `writeGuard` ouvre un `alert-dialog`
  disant que l'action sera réellement effectuée et **tracée au compte prestataire**.
- Expiration automatique à **30 minutes**, compte à rebours dans les 2 dernières.
- `Échap` deux fois quitte la simulation, avec confirmation. Entrée et sortie annoncées en
  `aria-live="assertive"`.
- Les rayures sont décoratives : le texte « Simulation de rôle en cours » porte seul l'information.

---

## 3 · Patterns UI

### 3.1 Formulaires

Libellé au-dessus, 16 px / 500, toujours visible. Aide sous le champ en `muted-foreground`.
Erreur : bordure `destructive` 2 px **+** message sous le champ **+** résumé en tête de
formulaire avec liens d'ancrage. Validation au _blur_, puis à la soumission.

### 3.2 États — vide, chargement, erreur, succès

| État           | Forme imposée                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vide**       | Ce qui manque **et l'action pour le combler** : « Aucune actualité pour l'instant. → Écrire la première »                                                                                    |
| **Chargement** | `skeleton` sur listes et tableaux uniquement. Sur un bouton : libellé remplacé, largeur conservée.                                                                                           |
| **Erreur**     | Ce qui s'est passé, **ce qui est perdu**, l'action suivante : « La page n'a pas pu être publiée. Le bloc "Image" n'a pas de fichier. **Rien n'est perdu.** » Ancrée, ne disparaît pas seule. |
| **Succès**     | Ce qui a eu lieu et où le vérifier : « Page publiée. Visible à l'adresse /nouvel-acquereur. »                                                                                                |

### 3.3 `primary` ou accent ?

- **`primary`** : toute action, tout état de sélection, toute icône fonctionnelle. Commun aux six
  associations.
- **Accent tenant** : identité seulement.
- **Jamais d'accent sur un bouton** : sa teinte est inconnue à la conception.

### 3.4 Donnée personnelle

**Un seul marqueur, toujours le même** : `Lock` + « Espace personnel » + parcelle, en haut de
l'écran. Tout écran qui l'affiche ne contient **que** des données du membre connecté.

### 3.5 Le tableau sous 640 px — cartes empilées

**Patron unique retenu.** Une ligne devient une carte : la colonne d'identité en titre, les
autres en paires libellé / valeur, l'action en pleine largeur (56 px).

Les deux autres options ont été écartées, et il ne faut pas les réintroduire story par story :

- **Défilement horizontal** — un tableau qui se pousse latéralement est invisible pour qui ne l'a
  jamais fait, et les en-têtes sortent de l'écran.
- **Colonnes masquées par priorité** — l'information disparaît sans le dire, et le bureau croit
  que la donnée est absente.

Coût assumé : c'est vertical, donc long — d'où **10 cartes par page** au lieu de 25. Recherche et
filtres conservés, empilés en pleine largeur ; l'ordre des paires suit l'ordre des colonnes du
bureau, pour que les deux vues se lisent pareil.

### 3.6 Langue et libellés

- Vouvoiement, phrases courtes, **aucun jargon** : « Publier la page », pas « Déployer » ;
  « Espace membre », pas « Portail » ; « Signaler une fuite », pas « Créer un ticket ».
  **Jamais « lien magique », « token », « OTP » ni « authentification » à l'écran.**
- Dates en clair côté public (« 2 septembre 2026 »), `02/09/2026` en tableau et en champ.
- Unités toujours écrites : m³, €, Ko. Montants au format français (123,45 €).
- Typographie française : espace insécable avant `: ; ! ?`, guillemets « », apostrophe courbe.

### 3.7 Contrastes vérifiés — WCAG 2.1

| Paire                             | Ratio  | Verdict                                               |
| --------------------------------- | ------ | ----------------------------------------------------- |
| `foreground` / `background`       | 17,3:1 | AAA — corps de texte du site public                   |
| `muted-foreground` / `background` | 7,4:1  | AAA — corrige la limite AA du socle                   |
| `primary` / `background`          | 11,3:1 | AAA                                                   |
| `primary-foreground` / `primary`  | 11,0:1 | AAA — texte des boutons                               |
| `link` / `background`             | 7,1:1  | AAA — **souligné en plus de la couleur**              |
| `destructive` / `background`      | 6,5:1  | AA+                                                   |
| `accent-foreground` / `accent`    | 8,9:1  | AAA — texte des encarts                               |
| `accent-solid` / `background`     | 4,9:1  | AA **en ≥ 24 px seulement**                           |
| `input` / `background`            | 3,1:1  | AA — contour de champ (1.4.11)                        |
| `border` / `background`           | 1,4:1  | Décoratif uniquement — **jamais un contour de champ** |
| `ring` / `background`             | 4,6:1  | AA — anneau de focus                                  |
| `warning-foreground` / `warning`  | 8,2:1  | AAA — texte sur bandeau ambre                         |

### 3.8 Liste à cocher d'accessibilité — à passer à chaque story

- [ ] Corps de texte du site public ≥ 7:1
- [ ] Contour de champ et bordure de composant ≥ 3:1 (1.4.11)
- [ ] Zoom texte à 200 % sans perte de contenu ni de fonction (1.4.4)
- [ ] **Aucune information portée par la seule couleur** (1.4.1)
- [ ] Tout au clavier, focus visible partout (2.1.1, 2.4.7)
- [ ] Un seul `h1` par page, hiérarchie sans saut de niveau

---

## 4 · Le contenu — rendu public des cinq blocs

Le back-office compose des blocs typés ; voici ce que chacun **donne sur le site public**.

| Bloc                    | Rendu public                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · Texte riche**     | Titres `h2`/`h3` seulement, gras, italique, listes, liens. Paragraphes 18 px / 1.65. Pas de tableau, pas de couleur de texte.                                                                                             |
| **2 · Image + légende** | `<figure>` + `<figcaption>`. **La légende est du texte, jamais incrustée dans l'image.** Ratio libre, hauteur plafonnée à 520 px, `loading="lazy"`. **`alt` obligatoire à la saisie — sinon la publication est refusée.** |
| **3 · Document PDF**    | Support des **analyses d'eau**. Titre écrit par le bureau (**jamais le nom du fichier**), résultat en clair, poids annoncé. Consultable sans compte, ouverture en nouvel onglet annoncée au lecteur d'écran.              |
| **4 · Galerie**         | Grille de 3 (2 sous 900 px, 1 sous 640 px), vignettes 1:1. Au clic, `dialog` avec « Précédente / Suivante » **écrits**. Au-delà de 6 vignettes, une tuile de report.                                                      |
| **5 · Encart**          | **Le seul bloc où la teinte s'exprime** : `accent-foreground` sur `accent` (8,9:1). Un titre facultatif, du texte, des liens. **Jamais de bouton dedans. Deux encarts consécutifs interdits.**                            |

### L'état « le fichier est absent » — la règle à ne pas rater

- **Vue du bureau** : « Ce bloc PDF n'a pas de fichier. Il n'apparaît pas sur le site public tant
  qu'un document n'est pas déposé », avec « Déposer le document » et « Supprimer le bloc ».
- **Vue du public** : **rien.** Un bloc incomplet est **omis du rendu**, jamais affiché en boîte
  vide ni en icône cassée. Même règle pour une image sans fichier et une galerie vide.
  _La page ne montre jamais son propre échec à un visiteur._

### Mobile

Gouttière 18 px, **sauf l'image et la galerie qui passent pleine largeur, sans marge**.
Espacement entre blocs ramené à 24 px. Galerie en une colonne, vignettes 4:3, report après deux
photos. Bloc PDF : bouton pleine largeur sous le titre. **Texte long : aucune troncature, aucun
« lire la suite »** — le déroulé est plus simple qu'un pli.

---

## 5 · L'email — un médium à part

`react-email`, envoi via Brevo. **Les règles du web ne s'y appliquent pas.**

### 5.1 Contraintes du médium

- Largeur **600 px**, tables imbriquées, `role="presentation"`, styles en ligne uniquement.
  **Aucune variable CSS, aucun utilitaire Tailwind.** Une seule colonne, pas de flex ni de grid.
- ⚠️ **Aucun OKLCH** : chaque couleur en hexadécimal, figée dans une constante partagée.
- **Pas de police web** : `Georgia, serif` pour les titres, `Helvetica, Arial, sans-serif` pour le
  texte — repli assumé de Source Serif 4 et Public Sans. Corps **17 px**, interlignage 1,6,
  titres 24 px.
- Images bloquées par défaut : **rien d'indispensable dans une image**. Le logo porte un `alt` qui
  est le nom de l'association, et l'en-tête reste lisible sans lui.
- Boutons **en tables** (pas de `<button>`), hauteur ≥ 48 px, et **toujours doublés d'une URL en
  clair juste dessous** — un lien qui ne se clique pas doit pouvoir se recopier.

### 5.2 Mode sombre forcé (Outlook, Gmail Android)

Le mode sombre est abandonné côté web, mais **certains clients l'imposent** :

- **Doit rester lisible** : texte du corps, libellé du bouton, URL en clair, pied de page — donc
  en encre sur blanc, jamais en gris clair sur gris.
- **Peut être sacrifié** : fond ambre, teinte de l'association dans l'en-tête, filets. Aucun ne
  porte d'information.
- Pas de texte blanc sur fond coloré **sauf** dans le bouton, qui reçoit
  `color:#ffffff !important` et un fond hérité en table.
- Logo fourni en PNG transparent **et** en variante sur pastille blanche : une inversion ne doit
  pas l'effacer.

### 5.3 Table de transposition OKLCH → hexadécimal

Ces valeurs sont les **jumelles canoniques** des tokens. Elles vivent dans **un seul fichier**
(`src/lib/emails/theme.ts`) et ne sont jamais retapées dans un modèle. Toute évolution d'un token
impose la mise à jour de sa jumelle — **c'est le seul endroit du produit où une couleur est
dupliquée, et c'est assumé**.

| Token                       | OKLCH                    | Hex email | Usage dans l'email                          |
| --------------------------- | ------------------------ | --------- | ------------------------------------------- |
| `background`                | `oklch(1 0 0)`           | `#FFFFFF` | fond du corps                               |
| `foreground`                | `oklch(0.22 0.015 250)`  | `#1B1E26` | texte courant, titres                       |
| `muted`                     | `oklch(0.972 0.005 240)` | `#F6F7F8` | fond du pied, encarts neutres               |
| `muted-foreground`          | `oklch(0.45 0.02 245)`   | `#52565E` | mentions du pied, tailles de fichier        |
| `border`                    | `oklch(0.90 0.008 245)`  | `#DFE1E5` | filets, bordures de table                   |
| `input`                     | `oklch(0.66 0.014 245)`  | `#8E939C` | contour du bouton secondaire                |
| `primary`                   | `oklch(0.35 0.06 240)`   | `#2C3F63` | fond du bouton principal                    |
| `primary-foreground`        | `oklch(0.985 0.003 240)` | `#FDFDFE` | libellé du bouton principal                 |
| `link`                      | `oklch(0.45 0.13 250)`   | `#2B57A8` | liens, URL en clair                         |
| `destructive`               | `oklch(0.48 0.17 27)`    | `#B32317` | filet du dernier rappel                     |
| `warning`                   | `oklch(0.94 0.06 75)`    | `#F7E6C4` | fond du deuxième rappel, encart d'attention |
| `warning-border`            | `oklch(0.72 0.12 70)`    | `#C9922F` | filet du deuxième rappel                    |
| `warning-foreground`        | `oklch(0.30 0.08 60)`    | `#5A3B12` | texte sur fond ambre                        |
| `accent-solid` (h 195)      | `oklch(0.55 0.10 195)`   | `#17849B` | filet de l'en-tête                          |
| `accent` (h 195)            | `oklch(0.958 0.024 195)` | `#E8F5F8` | fond de l'en-tête, encart                   |
| `accent-foreground` (h 195) | `oklch(0.38 0.08 195)`   | `#185A66` | nom de l'association                        |

Les six teintes d'accent sont **précalculées** (§1.2) ; le serveur injecte le triplet de
l'association au moment du rendu.

### 5.4 ⚠️ Deux pieds de page, pas un

Point structurant, et juridique autant que visuel.

| Nature          | Envois                                                                    | Pied de page                                                                      |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Facultative** | actualité, campagne libre                                                 | **Bouton de désinscription visible** — pas un lien perdu dans une ligne de 12 px  |
| **Statutaire**  | convocation, mise à disposition de facture, relance, publication après AG | **Pas de désinscription**, mais une phrase qui explique pourquoi l'envoi continue |

**Le ton de la phrase statutaire est décisif** : elle dit _pourquoi_ (« vous êtes propriétaire
d'une parcelle du domaine »), pas _que c'est comme ça_. **Interdit : « vous ne pouvez pas vous
désinscrire ».** Le pied statutaire renvoie tout de même vers les préférences, pour que le membre
voie qu'il a la main sur le reste. Réciproquement, le pied facultatif précise que la
désinscription « ne prive d'aucune information obligatoire ».

### 5.5 Les sept envois maquettés

| Envoi                      | Nature         | Ce qui le caractérise                                                                                                                                                                                               |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lien magique**           | transactionnel | Une seule action, centrée, 19 px, au-dessus de la ligne de flottaison mobile. **Aucune actualité, aucun rappel de cotisation : rien qui puisse détourner le clic.** C'est la porte d'entrée de 300 personnes âgées. |
| **Invitation initiale**    | statutaire     | Explique le fonctionnement en trois étapes numérotées, insiste sur « aucun mot de passe à retenir », donne le téléphone du bureau.                                                                                  |
| **Convocation à l'AG**     | statutaire     | Date, lieu, modalités de vote en table ; ordre du jour numéroté ; pièces jointes avec poids.                                                                                                                        |
| **Facture disponible**     | statutaire     | **Doublon volontaire assumé** de l'envoi du comptable : le corps dit explicitement « il s'agit bien du même document : cet email ne demande pas un second règlement ».                                              |
| **Relance d'impayé**       | statutaire     | Trois niveaux — 15 j, 45 j, 90 j. Voir ci-dessous.                                                                                                                                                                  |
| **Publication après l'AG** | statutaire     | Liste de documents avec poids ; mention « aussi disponibles en version papier sur demande ».                                                                                                                        |
| **Campagne libre**         | facultative    | Même habillage, image facultative dont le texte se passe, pied avec désinscription.                                                                                                                                 |

**Les trois relances — ferme, jamais humiliant.** Elles se distinguent par le **filet supérieur**
(gris → ambre → rouge), l'étiquette de rang écrite en clair, et la fermeté du texte — **jamais
par la taille du titre ni par des majuscules**. Aucune n'emploie « mauvais payeur », « mise en
demeure » ni le tutoiement du reproche. **Chacune propose au moins une porte de sortie** : « si
vous avez déjà payé, écrivez-nous », « un échelonnement est possible, il suffit de le demander »,
« un appel suffit ». Le destinataire est un voisin et un adhérent.

### 5.6 Variables et objets

Variables : `{prénom} {nom}` · `{parcelle}` · `{montant}` · `{échéance}` · `{date_ag}` ·
`{lien_magique}` · `{nom_association}`. Chaque modèle déclare sa liste **et un jeu de valeurs de
repli : un email dont une variable manque ne partira pas.**

**Les objets — la moitié du travail** : toujours préfixés « ASL La Fourche — » (une boîte
encombrée doit trier au premier mot) · 60 caractères maximum, l'information d'abord
(« Convocation à l'AG du 10 octobre », pas « Information importante ») · **jamais de majuscules,
jamais d'emoji, jamais « URGENT »** · pré-en-tête obligatoire de 90 caractères qui complète
l'objet sans le répéter · réponse dirigée vers une boîte **réellement lue** par le bureau.

---

## 6 · Le papier — l'autre médium

**100 propriétaires sur 400 n'ont aucune adresse email.** Le publipostage les réintègre dans le
même flux, sans double saisie : le bureau écrit une fois, le moteur choisit l'email ou la lettre
selon le mode de contact. **La lettre dit la même chose que l'email** — là où l'email a un lien,
la lettre a l'information écrite.

### 6.1 La lettre de publipostage — A4 recto, noir et blanc

```
format   A4 portrait, recto seul
marges   20 mm gauche/droite · 15 mm haut · 20 mm bas (zone non imprimable)
fenêtre  100 × 35 mm (enveloppe DL 110 × 220)
         x = 20 mm · y = 45 mm (NF Z 11-011)
adresse  cadre 90 × 25 mm dans la fenêtre, garde de 5 mm sur les 4 côtés
         4 lignes max, 12 pt, sans gras
corps    12,5 pt / 1.7 — plancher 11 pt
objet    13 pt / 600
```

⚠️ **Mesures à confirmer avant la première impression** — c'est une contrainte physique qui ne se
rattrape pas. Une **page de calage** imprimable (repères de fenêtre en traits fins) est fournie
avec le premier lot : le bureau la glisse dans une enveloppe réelle avant de lancer 100 pages.

**Noir et blanc — l'information ne passe jamais par la couleur.** Aucun aplat, aucune trame grise
sous du texte : filets noirs 0,5 pt, cadres 1 pt. Logo en version **monochrome**, testé à 300 dpi.
Les niveaux de relance se distinguent par l'**objet écrit** (« Deuxième rappel »), pas par un
filet coloré comme en email. **Pas de QR code seul** : toute adresse web est aussi écrite en
clair, en 12 pt.

**Équivalences email → lettre**

| Email                      | Lettre                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Bouton « Voir ma facture » | La facture **jointe au courrier** + l'adresse du site en clair                                   |
| Lien magique de connexion  | **Rien** — ces membres n'ont pas de compte. Invitation à transmettre une adresse email au bureau |
| Liste de PDF cliquables    | Liste des pièces + « disponibles sur demande auprès du bureau »                                  |
| Pied avec désinscription   | « Courrier envoyé par voie postale, faute d'adresse email connue »                               |
| Encart teinté              | Cadre noir 1 pt, même texte                                                                      |

### 6.2 Règles d'impression du site

Une seule feuille de style couvre les trois documents imprimés par les membres : une **facture**,
un **document nominatif ou partagé**, une **analyse d'eau**.

- **Disparaît** — navigation, barre latérale, pied de site, boutons et champs, bandeau d'alerte,
  bandeau de simulation, fils d'Ariane, blocs « voir aussi », images décoratives.
- **Apparaît** — en-tête avec logo monochrome et nom de l'association, **URL en clair sous chaque
  lien** (`a[href]:after`), date d'impression et adresse de la page en pied, mention « document
  personnel » sur les pièces nominatives, numérotation « page x/y ».
- **Se transforme** — texte 12 pt / 1.5, titres 16 et 14 pt, tout en noir sur blanc, fonds
  supprimés, encarts en cadres 1 pt, tableaux avec en-tête répété
  (`thead` + `display:table-header-group`).
- **Ne se coupe jamais** — `break-inside: avoid` sur les lignes de tableau, les encarts, les blocs
  signature et les cartes de document. Marges de page 15 mm.

### 6.3 Gabarit de document institutionnel

Un seul gabarit couvre convocation, procès-verbal et courrier type, généré à l'unité **ou en
lot** : **1.** en-tête (logo monochrome, nom et statut, coordonnées, date et lieu) · **2.**
références (numéro de pièce, objet en une ligne, destinataire si nominatif) · **3.** titre 16 pt
Source Serif 4, **jamais en capitales** · **4.** corps 12,5 pt / 1.7, listes numérotées pour les
ordres du jour et les résolutions · **5.** signature (nom, fonction, zone de 52 px, **jamais
coupée entre deux pages**) · **6.** pied (coordonnées, « page x/y », date de génération).

**En génération de lot** : un **seul fichier** PDF, une page par destinataire, **trié par nom pour
suivre l'ordre de mise sous pli**, avec un bordereau récapitulatif en ouverture (nombre de plis,
date, campagne).

---

## 7 · La connexion — lien magique seul

Pas de mot de passe, pas d'inscription libre : les comptes sont créés par le bureau. Le membre
saisit son adresse, reçoit un lien valable **4 heures**, clique, il est connecté.

| Écran                               | Ce qui le caractérise                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · Saisie de l'adresse**         | Un seul champ. « Il n'y a **aucun mot de passe** à retenir. » Un encart bas de page : « Vous n'avez pas d'adresse email ? Les documents vous sont envoyés par **courrier** — appelez le bureau. »                                                                                        |
| **2 · Consultez votre boîte mail**  | **L'écran le plus important.** Dit quoi faire, que le lien vaut 4 h, et **« Rien n'arrive ? »** en trois étapes numérotées (patienter, regarder les indésirables, vérifier l'adresse). « Renvoyer un lien » **désactivé 60 s avec compte à rebours écrit**. Puis le téléphone du bureau. |
| **3 · Lien expiré ou déjà utilisé** | « **Vous n'avez rien fait de mal** : il suffit d'en demander un nouveau. » Explique que l'usage unique est ce qui protège l'espace.                                                                                                                                                      |
| **4 · Adresse inconnue**            | Voir ci-dessous.                                                                                                                                                                                                                                                                         |
| **5 · Déjà connecté**               | « Inutile de demander un nouveau lien : votre espace est ouvert. »                                                                                                                                                                                                                       |
| **6 · Déconnexion**                 | « Vos documents restent disponibles… **Il n'y a pas de mot de passe à retrouver.** »                                                                                                                                                                                                     |

**L'écran 4 — sécurité sans dureté.** Le message ne dit **jamais** « cette adresse est inconnue » :
il dirait à un inconnu qui est adhérent. Il est donc **conditionnel** (« Si cette adresse est
enregistrée, le lien est parti ») et **strictement identique à l'écran 2 en durée d'affichage et
en temps de réponse serveur**.

La compensation est humaine : au lieu d'un échec sec, l'écran **explique les deux causes
possibles** — l'adresse enregistrée est une autre, ou bien _aucune adresse n'est enregistrée pour
votre parcelle, vous recevez vos documents par courrier, et c'est normal_ — puis offre un vrai
secours, le téléphone du bureau. **Personne n'est renvoyé à une impasse.**

**Règles du parcours** — un seul champ `type="email"`, `autocomplete="email"`, `inputmode="email"`,
sans majuscule automatique · **aucun captcha visible**, limitation par débit côté serveur
(3 demandes / 15 min / adresse) · le lien ouvre l'espace **directement**, aucune page
intermédiaire « connexion en cours » · session de **30 jours** — un membre qui revient deux fois
par an ne recommence pas à chaque visite · **zéro jargon à l'écran**.

---

## 8 · Do / Don't

- ✅ Sobre, aéré, très lisible. Registre de service public local, pas de startup.
- ✅ **Le mot porte l'information ; la couleur ne fait que renforcer.**
- ✅ Icône **+** libellé. Cibles 44 × 44 minimum.
- ✅ Une seule action attendue par écran, en `default` ; le reste en `outline`.
- ✅ Un message d'erreur dit ce qui est perdu — et le plus souvent, que rien ne l'est.
- ✅ Toute voie d'interaction fine (glisser-déposer) a **une alternative de premier rang**.
- ✅ Un échec n'est jamais montré au visiteur : un bloc incomplet est omis, pas affiché cassé.
- ❌ Dégradés spectaculaires, verre dépoli, ombres portées lourdes, animations d'apparition.
- ❌ Densité de tableau de bord SaaS, surtout côté membre : il vient chercher une chose.
- ❌ Texte courant sous 17 px. Placeholder en guise de libellé. Astérisque pour l'obligatoire.
- ❌ `tabs` ou `sidebar` côté membre. Menu d'icônes en bout de ligne de tableau.
- ❌ Une information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ L'accent du tenant sur un bouton, ou comme unique porteur d'un statut.
- ❌ Défilement infini. Action au survol seul. `outline: none`.
- ❌ En email : OKLCH, police web, flex/grid, bouton sans URL en clair dessous.
- ❌ Sur papier : couleur porteuse d'information, QR code seul, adresse web non écrite en clair.
- ❌ Le jargon technique à l'écran : « lien magique », « token », « OTP », « authentification ».

---

## 9 · Manques signalés — à combler, jamais à deviner

Aucun de ces points n'a été comblé par une invention : ce sont des **décisions à prendre**, pas
des composants à improviser. À traiter en `/ks-design` ou `/ks-research` de la story concernée.

### ⚠️ Deux bloquent une story entière

- **Page de préférences d'envoi** — cible du lien de désinscription. Il doit bien mener quelque
  part : sans cet écran, le pied facultatif de tous les emails est un lien mort. _(s25, s27)_
- **Écran « préparer l'envoi papier »** — aperçu du lot, nombre de plis, réimpression d'une page
  isolée, marquage « envoyé le… ». Aucun des 37 composants ne le couvre. _(s28)_

### Les autres

| Domaine   | Manque                                                                                                                                                                                                                                               | Story         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Email     | **Version texte brut** de chaque modèle — exigée par les filtres anti-spam, à écrire en même temps que le HTML                                                                                                                                       | s25           |
| Email     | **Journal des envois par membre** (quoi, quand, ouvert ou non) — nécessaire au bureau pour savoir qui relancer par courrier                                                                                                                          | s30, s29      |
| Papier    | Composant de **prévisualisation PDF paginée** en back-office                                                                                                                                                                                         | s28, s36      |
| Papier    | **Suivi du courrier** — un envoi papier n'a ni ouverture ni clic : le journal doit accepter un statut saisi à la main (« posté le 12/09 »)                                                                                                           | s28           |
| Papier    | **Retours de courrier (PND)** — où le bureau les note, et ce que devient le membre concerné                                                                                                                                                          | s28, s12      |
| Blocs     | **Visionneuse de galerie** — `dialog` couvre la coquille, pas la navigation entre images (flèches, balayage, compteur « 3 sur 10 »)                                                                                                                  | s04           |
| Blocs     | **Bloc « analyses d'eau » dédié** ou réemploi du bloc PDF — à trancher                                                                                                                                                                               | s09           |
| Édition   | Les **cinq aperçus miniatures** du sélecteur de blocs (dessins à maintenir avec la charte)                                                                                                                                                           | s04           |
| Connexion | **Erreur du service d'email** à l'envoi du lien, avec le téléphone du bureau en repli                                                                                                                                                                | s03           |
| Connexion | **Changement d'adresse email par le membre** : lui-même (avec validation de la nouvelle) ou via le bureau ?                                                                                                                                          | s16           |
| Connexion | **Lien cliqué après suppression du compte** par le bureau                                                                                                                                                                                            | s03, s14      |
| Relevé    | **Relevé en série hors ligne** (s17) : stockage local avec synchronisation, ou simple tolérance aux coupures ?                                                                                                                                       | s17           |
| Tenant    | **Sélecteur de teintes prédéfinies + aperçu immédiat** — signalé dès la livraison n° 1, jamais spécifié. Les six teintes existent (§1.2), l'écran qui les fait choisir non. **C'est le seul manque qui touche le bloc A**                            | s02           |
| Tenant    | **Favicon et icônes d'application par association** — aucune couverture. Un produit multi-tenant où six sites partagent un favicon se voit tout de suite. À dériver du logo, ou du monogramme quand il n'y a pas de logo (§1.8)                      | s02, s11      |
| SEO       | **Image de partage social (Open Graph)** — aucune couverture, alors que s11 demande les métadonnées. Quel gabarit, quelles dimensions, que met-on dessus quand l'association n'a pas d'image ?                                                       | s11           |
| Divers    | **Page 404** — évoquée dans la livraison n° 1 (« renvoie vers l'accueil, les actualités et le contact »), jamais maquettée                                                                                                                           | s11           |
| Divers    | **Photo manquante sur une fiche du bureau** — le composant `avatar` a un repli, mais aucune convention n'est posée : initiales, silhouette, ou rien ?                                                                                                | s06           |
| Technique | **Échelle de `z-index`** — seules deux valeurs sont posées (`PreviewBar` 50, `ImpersonationBar` 60). Avec trois bandes persistantes, les dialogues, les popovers, les tiroirs et les toasts, une échelle explicite évite les conflits au cas par cas | s04, s07, s41 |

### Point d'implémentation à vérifier

Le support de l'`attr()` typé pour l'injection de la teinte de tenant (§1.2) — repli documenté.

---

## 10 · Conséquences sur le socle

Ces dettes sont ouvertes par les décisions du design system. Elles appartiennent à la story qui
applique le système au boilerplate.

### L'abandon du mode sombre

1. `src/app/globals.css` porte un bloc `.dark` complet, à retirer ; `next-themes` et le sélecteur
   de thème deviennent sans objet.
2. `.claude/rules/01-presentation/rule-mdx-rendering.md` impose de vérifier chaque modification
   « en clair et en sombre ». **Cette règle doit être mise à jour** dans le même commit, sinon
   elle réclame une vérification impossible.
3. `docs/architecture.md` liste `docs/[...slug]` parmi les routes bloquantes assumées **au motif
   qu'elle lit `x-theme` pour la coloration Shiki**. Ce motif tombe : la route peut redevenir
   prerendable et le dual-theme Shiki se simplifie.

⚠️ **Exception** : le mode sombre disparaît du web, mais **pas de l'email** — certains clients
l'imposent. Voir §5.2.

### Ce qui change dans le socle

- **Trois tokens ajoutés** (`warning`, `warning-border`, `warning-foreground`) : ils n'existaient
  pas dans le thème du boilerplate.
- **`--radius` passe de 0.625rem à 0.5rem**, et `--radius-md` vaut désormais `var(--radius)` au
  lieu de `calc(var(--radius) - 2px)`.
- **Trois polices à installer** via `next/font/google` — aucune n'était configurée.
- **`primary` et `input` sont remplacés**, pas ajustés : voir §1.1.
