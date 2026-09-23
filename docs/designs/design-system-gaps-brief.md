# Brief — Manques du design system relevés en s06 à s09

> À porter sur le canevas Claude Design : `/design docs/designs/design-system-gaps-brief.md`
>
> Ce brief **ne dessine aucun écran de story**. Il produit les **planches de référence** qui manquent
> au design system (`docs/design-system.md`), relevées par les designs de s06, s07, s08 et s09.
> Chaque planche sert à trancher un point, pas à illustrer une fonctionnalité.
>
> Le résultat sera versé dans `docs/design-system.md` par `/ks-design-system`, puis réutilisé par les
> plans de s06 à s09.

## Ce qu'on attend

Un document de planches, une section par manque, dans l'ordre ci-dessous. Chaque planche montre :

- **les deux thèmes**, clair et sombre, côte à côte ou par bloc forçant `data-theme` ;
- **la valeur exacte** proposée (OKLCH, px, graisse), écrite à côté du visuel, pour pouvoir être
  recopiée telle quelle dans le design system ;
- **le mauvais cas quand il existe** (ce que ça donne sans la règle), barré ou marqué.

Largeur mobile 390 px **seulement** pour les planches où elle change quelque chose : P6 (portrait),
P7 (champ date), P4 (deux badges). Les autres sont des planches de composant, pas d'écran.

## Les tokens du système — seule source de couleur

Aucune couleur hors de cette liste, sauf là où le brief demande explicitement de **proposer** une
valeur manquante (P1, P2, P3, P9).

```css
[data-theme='light'] {
  --background: oklch(1 0 0);
  --foreground: oklch(0.22 0.015 250);
  --card: oklch(1 0 0);
  --muted: oklch(0.972 0.005 240);
  --muted-foreground: oklch(0.45 0.02 245);
  --border: oklch(0.9 0.008 245);
  --input: oklch(0.66 0.014 245);
  --ring: oklch(0.55 0.11 235);
  --primary: oklch(0.35 0.06 240);
  --primary-foreground: oklch(0.985 0.003 240);
  --secondary: oklch(0.965 0.006 240);
  --secondary-foreground: oklch(0.3 0.02 245);
  --destructive: oklch(0.48 0.17 27);
  --link: oklch(0.45 0.13 250);
  --accent: oklch(0.958 0.024 195);
  --accent-foreground: oklch(0.38 0.08 195);
  --accent-solid: oklch(0.55 0.1 195);
  --accent-border: oklch(0.88 0.045 195);
  --sidebar: oklch(0.985 0.004 250);
  --sidebar-foreground: oklch(0.26 0.015 250);
  --sidebar-accent: oklch(0.93 0.012 245);
  --sidebar-border: oklch(0.91 0.008 245);
  --warning: oklch(0.94 0.06 75);
  --warning-border: oklch(0.72 0.12 70);
  --warning-foreground: oklch(0.3 0.08 60);
}

[data-theme='dark'] {
  --background: oklch(0.215 0.009 255);
  --foreground: oklch(0.94 0.006 250);
  --card: oklch(0.215 0.009 255);
  --muted: oklch(0.255 0.009 250);
  --muted-foreground: oklch(0.72 0.015 248);
  --border: oklch(0.33 0.01 250);
  --input: oklch(0.52 0.016 250);
  --ring: oklch(0.7 0.12 235);
  --primary: oklch(0.5 0.14 255);
  --primary-foreground: oklch(0.985 0.003 240);
  --secondary: oklch(0.27 0.01 250);
  --secondary-foreground: oklch(0.9 0.008 250);
  --destructive: oklch(0.58 0.19 27);
  --link: oklch(0.8 0.1 250);
  --accent: oklch(0.275 0.035 195);
  --accent-foreground: oklch(0.84 0.075 195);
  --accent-solid: oklch(0.64 0.11 195);
  --accent-border: oklch(0.4 0.055 195);
  --sidebar: oklch(0.19 0.009 255);
  --sidebar-foreground: oklch(0.93 0.006 250);
  --sidebar-accent: oklch(0.3 0.014 250);
  --sidebar-border: oklch(0.33 0.01 250);
  /* trio derive, jamais valide par la conception — c'est l'objet de P3 */
  --warning: oklch(0.3 0.05 75);
  --warning-border: oklch(0.6 0.11 70);
  --warning-foreground: oklch(0.93 0.05 80);
}
```

Typographie : Source Serif 4 (600/700) pour les titres, Public Sans (400/500/600/700) pour le texte,
JetBrains Mono (500/600) pour les chiffres et les dates. Plancher de taille du **site public** :
18 px. Back-office : 17 px de corps. Hauteurs de contrôle : 48 px en desktop, 56 px sous 1 024 px.

---

## P1 — Zébrure des tableaux en mode sombre

**Le manque** : la zébrure claire vaut `oklch(0.99 0.002 250)`. Le mode sombre n'a aucune jumelle.
Concerne **tous** les tableaux du back-office, pas une story.

**À dessiner** : un tableau de 6 lignes (colonnes Titre / Date / Statut / Action), en clair et en
sombre, avec la valeur sombre proposée écrite à côté. La maquette de s08 proposait
`oklch(0.235 0.009 255)` — à valider ou à corriger. Montrer aussi une ligne survolée et une ligne
sélectionnée, pour vérifier que les trois états restent distincts en sombre.

## P2 — Voile des fenêtres de confirmation

**Le manque** : le voile d'un `alert-dialog` est écrit en dur (`oklch(0 0 0 / 0.5)`). Aucun token,
dans aucun des deux thèmes.

**À dessiner** : une boîte de confirmation de suppression posée sur une page de liste, en clair et en
sombre, avec la valeur de voile proposée pour chaque thème. Le noir à 50 % fonctionne mal en sombre
(le fond est déjà sombre) : proposer une valeur par thème et montrer les deux.

## P3 — Trio `warning` en mode sombre

**Le manque** : les trois valeurs sombres ci-dessus sont **dérivées**, jamais jugées à l'œil. Leur
premier consommateur visible est le bandeau d'alerte (s07), qui s'affiche sur **toutes** les pages.

**À dessiner** : le bandeau d'alerte pleine largeur avec un message de 280 caractères, en clair et en
sombre ; et les trois pastilles de couleur avec leur valeur. Vérifier le contraste du texte sur le
fond, et la visibilité du filet de 2 px. Corriger les valeurs si elles ne tiennent pas.

## P4 — Résumé d'erreurs ancré, et deux badges sur une même ligne

Deux manques du même écran (s08), à traiter ensemble.

**4a — Résumé d'erreurs** : §3.1 l'exige (« résumé en tête de formulaire avec liens d'ancrage »),
aucune planche ne le montre. À dessiner : un formulaire de 4 champs dont 2 en erreur, avec le résumé
en tête (`alert` `destructive`, liste de liens vers chaque champ fautif), les bordures de 2 px sur
les champs et les messages sous les champs. **Fixer l'épaisseur de bordure de l'`alert` elle-même**,
qui n'est écrite nulle part (1 px ou 2 px).

**4b — Deux badges de statut** : le système n'en prévoit qu'un par ligne. Une ligne doit en porter
deux (« Non lu » et « Notification non envoyée »). Montrer les deux solutions côte à côte : empilés
(la ligne passe de 56 à ~88 px) et sur une seule ligne. Trancher visuellement, en desktop **et** en
mobile 390 px (cartes empilées).

## P5 — Compteur de caractères

**Le manque** : aucun compteur dans le système, alors que plusieurs champs sont plafonnés (280
caractères pour le bandeau, 500 pour une biographie ou un texte d'analyse).

**À dessiner** : un `textarea` avec son compteur dans trois états — loin du plafond, proche, dépassé.
Proposition à valider : `meta` aligné à droite sous le champ, `tabular-nums`, passage en
`destructive` **au dépassement seulement**, jamais à l'approche.

## P6 — Portrait de personne : dimensions, repli, exception mobile

Trois manques liés (s06), à traiter sur une seule planche.

- **Dimensions** : carré 1:1, `object-cover`. Rendus proposés : 128 px en public desktop, 96 px en
  public mobile, 56 px dans la liste du bureau, 128 px en aperçu de formulaire. À valider.
- **Repli sans photo** : **déjà tranché** — initiales de la personne (deux lettres), Source Serif 4 /
  600, `muted-foreground` sur `muted`, même carré et même rayon que la photo. Ne pas rouvrir : le
  dessiner pour qu'il entre au design system, et **mesurer le contraste** (les ratios annotés en s06,
  ≈ 6,9:1 et ≈ 6,3:1, sont estimés, pas mesurés).
- **Exception mobile** : §4 impose l'image pleine largeur sous 640 px ; un portrait de 390 px écrase
  la page. Montrer les deux versions côte à côte pour justifier l'exception « portrait de personne »
  (carré 96 px aligné à gauche du nom).

## P7 — Champ date

**Le manque** : le socle n'a pas de sélecteur de date. Besoin partagé par s05 (date d'actualité) et
s09 (date de prélèvement).

**À dessiner** : le champ en desktop (48 px) et en mobile 390 px (56 px), format `jj/mm/aaaa`, icône
`Calendar`, dans quatre états : vide, pré-rempli à aujourd'hui, en cours de saisie, en erreur (date
future refusée). **Sans calendrier déroulant** : montrer que la saisie au clavier suffit, ou montrer
ce que coûterait un calendrier si la lecture est meilleure.

## P8 — Texte public en gras hors titre

**Le manque** : `body-strong` vaut 17 px, sous le plancher public de 18 px. Le rôle d'un membre du
bureau doit être plus fort que sa biographie sans devenir un titre.

**À dessiner** : trois lignes d'exemple (nom en `h2`, rôle, biographie) avec les deux options — un
token nouveau à 18 px / 600, ou une dérogation écrite au plancher. Dire laquelle tient le mieux.

## P9 — Jumelles sombres des couleurs d'email

**Le manque** : `src/lib/emails/theme.ts` n'a aucune valeur pour un client de messagerie en mode
sombre. Les couleurs y sont **hexadécimales**, jamais des tokens CSS (fond `#FFFFFF`, filet
`#DFE1E5`, texte de bouton `#FFFFFF` **forcé**).

**À dessiner** : un email de notification à 600 px, en rendu clair et en rendu sombre forcé, avec la
table des jumelles sombres proposées, en hexadécimal. Contrainte du médium : tables, styles en ligne,
aucune variable CSS, un bouton toujours doublé de l'URL écrite en clair.

## P10 — Cadrage des images de contenu

**Le manque** : aucun ratio n'est posé pour une image d'article (s05) ni pour une affiche d'analyse
(s09). Chaque story a proposé le sien.

**À dessiner** : une image de contenu sur la colonne de lecture (68 caractères), en trois formats
réels — paysage, portrait, très allongée — avec la règle proposée (pleine largeur de colonne, hauteur
plafonnée à 520 px). Montrer ce que donne une image portrait haute **sans** plafond.

## P11 — Icônes manquantes au vocabulaire figé

**Le manque** : le vocabulaire figé (§1.7 : `Droplet`, `FileText`, `Receipt`, `Map`, `Megaphone`,
`AlertTriangle`, `Lock`, `GripVertical`) ne couvre ni « membre du bureau » (s06) ni « message reçu »
(s08).

**À dessiner** : pour chacun des deux besoins, trois candidates Lucide côte à côte, à 20 px, dans une
entrée de barre latérale réelle, en clair et en sombre. Recommander une candidate par besoin. Ne pas
en inventer : uniquement des icônes Lucide existantes.

---

## Hors périmètre

- Redessiner un écran de s06, s07, s08 ou s09 : ils sont validés, ils ne bougent pas ici.
- Inventer un composant nouveau. Chaque planche complète une règle existante ou propose une valeur
  manquante.
- Trancher le repli en initiales (P6) : il est décidé, il est seulement à verser au système.
- Les manques qui ne sont pas visuels et qui restent au plan : plafond de poids des fichiers,
  nombre d'éléments par page, position des entrées de barre latérale, `download` contre nouvel
  onglet, quatrième nature d'envoi d'email (§5.4, règle écrite et non visuelle).

## Ce qu'on récupère

Un export du canevas, comme pour les stories. Il sera normalisé en
`docs/designs/design-system-gaps.html`, puis les règles retenues seront écrites dans
`docs/design-system.md` par `/ks-design-system`.
