# Design — Story s07-bandeau-alerte

> Conçu le 2026-09-23 par le chemin **Claude Design**, à partir du brief
> `docs/designs/s07-bandeau-alerte-brief.md`.
>
> - **Export du canevas** : `docs/designs/s07-bandeau-alerte.zip`, remis par Marie-Ève le
>   2026-09-23. L'URL du canevas n'a pas été transmise.
> - **Reporté ici le même jour**, puis normalisé en `docs/designs/s07-bandeau-alerte.html`.
> - **Source visuelle unique** : `docs/design-system.md`.
> - **Contexte de code** : `docs/research/s07-bandeau-alerte.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                        | Où                                                                                                                                                                                                |
| ------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Le bandeau s'affiche sur **toutes les pages existantes**, publiques comme authentifiées | **Écran 2** (site public), **Écran 3** (gabarit à barre latérale : `/bureau/**`, `admin/**`, espace membre), **Écran 4** (connexion), et **Écran 1 · 1f** (la page du bureau l'hérite elle aussi) |
| 2       | Modifier le message met à jour le bandeau **immédiatement**                             | **Écran 1** (« Enregistrer le message », succès ancré `1f`) ; l'aperçu de la carte 2 montre le message avant enregistrement                                                                       |
| 3       | Désactiver le bandeau le retire de toutes les pages                                     | **Écran 1 · 1g** (« Retirer le bandeau », message conservé) → **Écrans 2a / 3a / 4a**, les références « sans bandeau »                                                                            |
| 4       | N'importe quel membre du bureau peut l'activer, le modifier, le retirer                 | _non dessinable_ — aucune restriction supplémentaire, donc aucun écran de garde ; **Écran 0** place l'entrée de menu pour tout le bureau                                                          |

## Screen(s)

### Le composant — `<AlertBanner />`

Le seul élément visuel nouveau de la story. Dessiné une fois, réemployé tel quel dans les quatre
écrans ; seul son environnement change.

- Pleine largeur de fenêtre, contenu centré dans `max-w-[1200px]`, gouttière héritée du gabarit
  (24 / 44 px en desktop, 16 / 18 px en mobile — porté par une variable `--gutter` dans la maquette).
- Fond `warning`, texte `warning-foreground`, **filet de 2 px `warning-border` en bas**. Aucun rayon,
  aucune ombre, aucun bouton, aucune croix, aucun lien : le bandeau n'est pas interactif.
- Intérieur 12 px vertical. En ligne : icône `AlertTriangle` 20 px (trait 1,75, `currentColor`,
  alignée sur la première ligne du texte) · 8 px · **« Alerte : »** en `body-strong` (17 px / 600) ·
  le message en `body` 17 px, `text-wrap: pretty`, **jamais tronqué**.
- Balisage porté en marge : `<section role="region" aria-label="Alerte de l'association">`, **sans**
  `aria-live` et **sans** `role="alert"` (voir « Design system gaps » n° 4).
- `@media print` masque le bandeau (§6.2). La maquette l'implémente réellement.

La planche « Composant » montre les deux thèmes **côte à côte**, chacun dans un bloc qui force son
`data-theme` : c'est là que se lit l'écart n° 2 (tokens `warning` sombres dérivés). Les trois
pastilles de chaque bloc affichent la valeur OKLCH des trois tokens.

### Écran 0 — Repère de continuité (barre latérale du bureau)

Barre déjà livrée, non redessinée. Seul ajout : **« Bandeau d'alerte »** (icône `AlertTriangle`), en
**dernière position du groupe « Le site »**, après « Navigation ». Le groupe « L'association »
(Identité, Réglages) est inchangé. Montrée active sur l'écran 1 seulement. « Actualités » (s05) n'est
pas reproduit : les deux stories ajoutent au même groupe, l'ordre final se règle au moment du merge.

### Écran 1 — Bureau : page « Bandeau d'alerte »

Gabarit du bureau (barre latérale 248 px + contenu), colonne de contenu à 720 px. `h1` « Bandeau
d'alerte » (34 px) et une ligne d'introduction en `muted-foreground` : « Le bandeau s'affiche en haut
de toutes les pages du site, y compris de cet espace. »

**Carte 1 — le message** : `label` toujours visible « Message de l'alerte », `textarea` de 4 lignes
(6 en mobile), consigne écrite **avant tout échec** (« 280 caractères au maximum. Texte simple, sans
lien : écrivez la date, l'heure et le lieu. ») et compteur `« n / 280 »` en `font-mono`
`tabular-nums` aligné à droite. Au-delà de 280 : compteur en `destructive` **et** bordure
`destructive` 2 px. **Sous la carte**, hors de son cadre, la ligne d'état écrite : point + « Bandeau
affiché sur le site » / « Bandeau masqué ».

**Carte 2 — l'aperçu** : `h3` « Aperçu » + `meta` « Voici ce que verront les visiteurs. », puis le
`<AlertBanner />` à l'échelle dans un cadre neutre figurant le haut d'une page (un filet et deux à
quatre lignes grisées). Champ vide → une seule ligne `muted-foreground` : « Écrivez un message pour
voir l'aperçu. », sans cadre vide illustré.

**Actions**, alignées à gauche sous les cartes : un seul bouton `default` de 48 px, dont le libellé
suit l'état (« Afficher le bandeau sur le site » / « Enregistrer le message ») ; « Retirer le
bandeau » en `outline` n'apparaît que quand le bandeau est affiché. **Pas d'interrupteur.**

Sept états en desktop, trois en mobile 390 px :

| Repère | État                                  | Ce qu'il prouve                                                                   |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------- |
| `1a`   | Vide                                  | Première visite : « 0 / 280 », pas d'aperçu, un seul bouton                       |
| `1b`   | Chargement                            | Libellé remplacé par « Enregistrement… », bouton désactivé, **largeur conservée** |
| `1c`   | Erreur · message vide à la soumission | Bordure `destructive` 2 px + « Écrivez le message avant d'afficher le bandeau. »  |
| `1d`   | Erreur · plus de 280 caractères       | 313 / 280 : compteur et bordure en `destructive`, consigne déjà écrite            |
| `1e`   | Erreur · échec d'enregistrement       | `alert` ancrée en tête, jamais un toast : « Rien n'est perdu… »                   |
| `1f`   | Succès                                | `alert` neutre (`CircleCheck` en `primary`), **et la page hérite du bandeau**     |
| `1g`   | Masqué, message conservé              | L'état qui prouve l'arbitrage : après le retrait, le message reste dans le champ  |
| `1h`   | Vide · 390 px                         | Une colonne, en-tête 56 px avec « Menu », boutons pleine largeur 56 px            |
| `1i`   | Succès · 390 px                       | Bandeau au-dessus de l'en-tête mobile                                             |
| `1j`   | Masqué, message conservé · 390 px     | Même preuve qu'en `1g`                                                            |

### Écran 2 — Site public

De haut en bas : `<AlertBanner />`, en-tête public existant (marque 44 px + nom + menu horizontal),
corps de page, pied de page — tous dessinés **sommairement**, ils existent déjà. Gabarit
`max-w-[1200px]`, gouttière 44 px en desktop, 18 px en mobile.

Ce que la planche prouve : le bandeau **pousse l'en-tête vers le bas**. `2a` (sans bandeau) et `2b`
(message court) se lisent l'une sous l'autre, tout descend de la hauteur du bandeau.

- `2a` sans bandeau (référence) · `2b` message court, une ligne · `2c` message long, deux lignes.
- `2d` message court · 390 px · `2e` message long · 390 px — **le pire cas**, celui de l'écart n° 3.

Ni chargement ni erreur : la page est rendue par le serveur, le bandeau est présent ou absent.

### Écran 3 — Gabarit à barre latérale (l'écran qui règle le piège)

Vaut à l'identique pour `/bureau/**`, `admin/**` et l'espace membre ; dessiné sur `/bureau/pages`.

Bandeau **en première position, sur toute la largeur de la fenêtre**. Sous lui seulement : barre
latérale 248 px + zone de contenu. L'arête haute de la barre est alignée sur le bas du filet du
bandeau ; la barre occupe la hauteur restante, pas celle de la fenêtre ; le contenu défile seul.
Une annotation en marge le dit explicitement sur les planches qui portent un bandeau.

- `3a` sans bandeau · `3b` message court · `3c` message long.
- `3d` **contre-exemple barré**, en desktop clair uniquement : bandeau posé naïvement, barre latérale
  en `fixed; inset-y-0`. Elle recouvre la gauche du bandeau, l'icône et le mot « Alerte »
  disparaissent dessous. C'est le piège que la maquette existe pour fermer.
- `3e` sans bandeau · 390 px · `3f` message long · 390 px · `3g` **tiroir ouvert** · 390 px : le
  tiroir s'ouvre **sous le bandeau**, il ne le recouvre pas.

### Écran 4 — Connexion (gabarit centré)

Troisième famille : fond `muted`, sans barre latérale ni en-tête de site. La carte de connexion est
centrée verticalement dans **l'espace restant sous le bandeau**, jamais recalée sous le bord de la
fenêtre. `4a` sans bandeau · `4b` message long · `4c` message long · 390 px.

Espace membre et SuperAdmin reprennent l'écran 3 ; pages d'erreur et documentation héritée
reprennent l'écran 2. Non dessinés, conformément au brief.

## Mockup

`docs/designs/s07-bandeau-alerte.html` est la **référence visuelle**, normalisée depuis l'export
Claude Design. L'export contenait **trois fichiers de canevas** — le principal plus les deux
composants qu'il importait (`AlertBanner`, `BureauSidebar`) — recomposés en un seul fichier.

- **Retiré** : le script de support du canevas, les éléments propriétaires, les boucles et conditions
  de gabarit, toutes les liaisons `{{ }}`.
- **Remplacé** : les listes par leurs données fictives résolues, les icônes lucide par des SVG en
  ligne (aucun script distant), la bascule clair / sombre par du JS natif (`data-theme` sur `#root`).
  L'attribut de survol propre au canevas a disparu avec lui : la règle « survol d'un `outline` en
  `secondary` » reste celle du design system.
- **Conservé** : le lien Google Fonts, la règle `@media print` qui masque le bandeau, les deux blocs
  de la planche « Composant » qui forcent chacun leur thème, et le `zoom: 0.4` de la vignette du
  contre-exemple.
- **Corrigé** : un renvoi interne de la marge de l'écran 1 annonçait « 1e » en pointant l'ancre de
  l'état Succès, qui porte le repère `1f`. Le libellé suit désormais l'ancre.
- **Vérifié avec jsdom** : sept sections ancrées (`#composant`, `#ecran-0` à `#ecran-4`, `#ecarts`),
  les cinq ancres d'écart, **aucun lien interne cassé**, 26 instances du bandeau toutes en
  `section[role="region"][aria-label]`, la bascule change bien de thème et revient, les dix compteurs
  affichent les valeurs attendues (`0`, `70`, `267`, `313`). Le rendu dans un vrai navigateur n'a pas
  été vérifié (pas de Chromium utilisable dans le conteneur).

**NE PAS copier en production** : l'Execute construit l'écran avec les vrais composants du socle
(`textarea`, `label`, `card`, `button`, `alert`, `sidebar`, `sheet`) et l'`<AssociationMark />`
existant. La maquette porte ses propres styles en ligne ; ils ne remplacent ni les tokens ni les
tailles du design system (voir « Écarts de la maquette »).

**Données fictives** : association « Les Amis de l'Étang », teinte « eau » 195. Deux messages, repris
partout pour que le pire cas soit toujours visible — un court (70 caractères) et un long
(267 caractères), plus une variante en dépassement (313 caractères) pour l'état `1d`.

## Reused components (from the design system)

- **`<AlertBanner />`** : le composant de la story, spécifié au §2.3 — **ramené à un seul niveau**
  par l'arbitrage de la story.
- **`textarea`, `label`** : une colonne, libellé au-dessus toujours visible, aide en
  `muted-foreground` sous le champ, bordure `destructive` 2 px en erreur.
- **`card`** : intérieur 24 px (16 px en mobile), bordure 1 px, `rounded-md`, **pas d'ombre**.
- **`button`** : un seul `default` par écran (48 px, 56 px en mobile, pleine largeur en mobile),
  « Retirer le bandeau » en `outline`. Libellés à l'infinitif explicite. En chargement : libellé
  remplacé, bouton désactivé, largeur conservée.
- **`alert`** : succès **et** erreur **ancrés** dans la page, jamais un toast, ne disparaissent pas
  seuls. Le succès est neutre, avec `CircleCheck` en `primary` — il n'y a pas de token de succès,
  pas de vert.
- **`sidebar`** : item actif = fond `sidebar-accent` + libellé 600 ; **`sheet`** pour le tiroir sous
  `lg` (planche `3g`).
- **`<AssociationMark />`** : marque 44 px en public, 34 px au bureau, **nom toujours écrit à côté**.
- **Icônes** : `AlertTriangle` (vocabulaire figé « alerte »), `CircleCheck` (succès), `Menu`, `X`.

## States

**Écran 1** : vide · chargement · erreur de champ (message vide) · erreur de champ (dépassement) ·
erreur d'enregistrement · succès · **masqué, message conservé**. Les trois derniers portent une
`alert` ancrée. En mobile, seuls vide, succès et masqué-conservé sont dessinés.

**Écrans 2, 3 et 4** : sans bandeau (référence) · message court · message long. **Ni chargement ni
erreur** : ces pages sont rendues par le serveur, le bandeau y est présent ou absent. L'écran 3
ajoute le tiroir ouvert et le contre-exemple barré.

## Écarts de la maquette au brief et au design system

Ils ne sont **pas à reproduire**. L'Execute suit le design system et les composants réels.

1. **Le message long ne fait pas 280 caractères mais 267.** Le brief demandait « ≈ 280 caractères, le
   maximum autorisé », et la légende de la planche `2c` annonce « Message long (280 caractères) » ;
   le compteur de l'écran 1 affiche « 267 / 280 » sur le même texte. Le pire cas est donc
   sous-représenté de treize caractères, y compris sur la planche `2e` qui sert à justifier l'écart
   n° 3. À la vérification en recette, mesurer avec un message réellement à 280.
2. **Le bandeau écrit « Alerte : » (deux-points, espace insécable avant).** Le brief demandait le mot
   « Alerte » seul, suivi du message. La maquette a tranché pour le deux-points ; c'est le libellé à
   reprendre tel quel, avec l'espace insécable de la typographie française.
3. **Les quatre états d'erreur et de chargement de l'écran 1 ne sont pas dessinés en mobile.** Seuls
   vide, succès et masqué-conservé le sont. `/ks-design` demande les mêmes états dans les deux
   largeurs : `1b`, `1c`, `1d` et `1e` sont donc implicites — même écran qu'en desktop, champs et
   boutons à 56 px, bouton principal en pleine largeur.
4. **La marque de l'association est recomposée à la main** (carré + nom) dans toutes les planches,
   alors que le brief l'interdit explicitement : « Ne pas recomposer un carré et un nom à la main. »
   C'est une limite du médium statique. L'Execute utilise l'`<AssociationMark />` existant.
5. **Deux mesures hors de l'échelle d'espacement** : le `textarea` en erreur passe à `11px 15px`
   d'intérieur pour compenser optiquement la bordure de 2 px (l'échelle ne connaît que
   4 · 8 · 12 · 16 · 24 · 32 · 48 · 64). Le vrai `textarea` du socle gère sa bordure ; ne pas
   recopier cette compensation. Les autres valeurs hors échelle (hauteurs de planche, chrome de la
   maquette, onglets de repère) appartiennent au document de maquette, pas au produit.
6. **L'`alert` d'échec d'enregistrement porte `role="status"`** dans la maquette, comme l'`alert` de
   succès. Le brief ne tranchait que le balisage du bandeau. Le balisage de l'alerte d'erreur reste
   à décider au plan (`role="alert"` pour un échec de soumission est l'usage courant).
7. **L'écart n° 3 est chiffré « sept à huit lignes »** sur la maquette, là où le brief écrivait « six
   à huit ». Même constat, même conclusion ; la fourchette exacte dépend du message réel.
8. **La carte « Message » n'a pas de titre `h3`**, contrairement à la carte « Aperçu ». Le `label`
   « Message de l'alerte » en tient lieu. Lecture admissible du brief, mais à confirmer : un `h3`
   « Message » symétrique se défendrait.

## Design system gaps

Tous sont signalés dans la maquette, **aucun n'est comblé** ici. Ils sont repris de la marge du
canevas, confrontés à ce qu'elle montre réellement.

> **Mise à jour du 23/09/2026.** Le manque n° 2 a été porté sur le canevas des manques (brief
> `docs/designs/design-system-gaps-brief.md`, planches `docs/designs/design-system-gaps.html`,
> planche P3) et **tranché** ; la règle est écrite dans `docs/design-system.md` §1.9. Les quatre
> autres restent ouverts, tels quels. La numérotation d'origine est conservée : le plan s'y réfère.

1. **L'échelle de `z-index` n'existe pas** (`docs/design-system.md` §9, manque partagé s04 / s07 /
   s41). Seules deux valeurs sont posées : `<PreviewBar />` à 50 et `<ImpersonationBar />` à 60,
   cette dernière explicitement au-dessus du bandeau. La maquette montre l'ordre d'empilement attendu
   — simulation de rôle > aperçu > alerte > barre latérale — avec trois `?` assumés, et **ne propose
   aucune valeur** pour le bandeau, la barre latérale ni les couches flottantes. À trancher au plan,
   ou à renvoyer à s41.
2. **Les tokens `warning` du thème sombre — ✅ jugés le 23/09/2026 (planche P3, §1.9) : le trio sombre
   est validé sans retouche.** Texte 11,14:1, filet 3,40:1. Les trois valeurs avaient beau être
   dérivées par inversion de luminosité, elles tiennent : **le doute ouvert par s07 est levé, il n'y a
   rien à corriger en sombre**. C'est le **thème clair** qui ne tenait pas. `--warning-border` valait
   `oklch(0.72 0.12 70)`, soit **2,09:1 sur son fond** (2,53:1 sur la page) — sous le seuil d'un
   élément d'interface. Il est corrigé à **`oklch(0.6 0.13 65)`**, qui remonte à **3,37:1 / 4,08:1**.
   Ce n'est pas un goût, c'est une mesure. Le bandeau étant le **second consommateur** du token (le
   premier est l'encart ambré de `provision-organization-form.tsx`), **c'est s07 qui porte la
   correction dans le code** : voir « Tâches de code héritées du design system » ci-dessous.
3. **« Trois lignes maximum en mobile » (§2.3) est incompatible avec un message de 280 caractères non
   refermable.** À 390 px, le message long occupe sept à huit lignes (planche `2e`). Tronquer
   cacherait l'alerte, sans « Lire la suite » ni fermeture pour la rattraper. La maquette **affiche
   le message en entier** et retient l'intention de la règle : « jamais la moitié de l'écran ».
   Écart assumé, à enregistrer au design system en même temps que l'arbitrage « un seul niveau ».
4. **Le rôle ARIA du bandeau n'est pas tranché par le design system.** Proposition portée en marge :
   `role="region"` + `aria-label="Alerte de l'association"`, **sans** `aria-live` et **sans**
   `role="alert"` — sinon le message serait réannoncé à chaque chargement, sur toutes les pages du
   site ; l'annonce impérative reste réservée à l'entrée et la sortie de simulation de rôle (§2.6).
   Elle engage l'implémentation, pas le dessin.
5. **Aucune convention n'existe pour un bandeau pleine largeur dans un gabarit à barre latérale.** Le
   design system dit « au-dessus de l'en-tête public » et s'arrête là. Règle **proposée** par la
   maquette, à valider : bandeau **hors de la coquille**, coquille en `flex` colonne de `100svh`,
   barre latérale et contenu dans la hauteur restante — plus de `fixed; inset-y-0`. C'est la planche
   `3d`, barrée, qui montre ce qui arrive sans cette règle.

### Règles de forme désormais écrites — rien à rouvrir au plan

Trois décisions du 23/09/2026 recouvrent ce que la maquette dessinait déjà, ou la complètent d'un
point. Elles sont citées ici pour que le plan n'ait pas à les retrancher.

- **Épaisseur de filet : 2 px** (§3.9). 2 px est désormais l'**épaisseur unique de « quelque chose ne
  va pas »** dans tout le produit : `alert`, champ fautif, **filet du bandeau d'alerte**. Le bandeau la
  porte déjà ; elle n'est plus une valeur locale à s07.
- **Compteur de caractères** (§3.9, planche P5). `meta` aligné à droite sous le champ, `tabular-nums`,
  `muted-foreground` en 400 **jusqu'à 280 inclus** ; **au dépassement seulement**, couleur
  **`--destructive-text`**, **graisse 600**, **bordure du champ à 2 px** **et un message écrit**
  (« 33 caractères de trop. » pour l'état `1d`, qui affiche 313 / 280). L'état `1d` de la maquette
  montre le compteur et la bordure : **le message écrit est l'ajout** à reprendre.
- **Couleur du texte d'erreur** (§1.9). C'est **`--destructive-text`**, pas `--destructive`, qui reste
  la couleur des **bordures** et des **fonds**. En clair les deux valeurs coïncident — le rendu de la
  maquette est donc juste — mais en sombre `--destructive` ne fait que 3,72:1 en texte. **Le token
  entre dans le code avec s08**, pas avec s07 : s07 n'a qu'à ne pas coder la couleur en dur.

### Tâches de code héritées du design system

`docs/design-system.md` §1.9 le dit explicitement : **ces valeurs ne sont pas encore dans
`src/app/globals.css`**, et chaque token entre dans le code avec la story qui le consomme en premier.
Un token écrit dans un document n'entre jamais tout seul dans une feuille de style. s07 porte :

- **Corriger `--warning-border` en thème clair** dans `src/app/globals.css` :
  `oklch(0.72 0.12 70)` → **`oklch(0.6 0.13 65)`** (2,09:1 → 3,37:1 sur son fond, 4,08:1 sur la page).
  Le trio `warning` **sombre** ne bouge pas : `--warning: oklch(0.3 0.05 75)`,
  `--warning-border: oklch(0.6 0.11 70)`, `--warning-foreground: oklch(0.93 0.05 80)`.
- **Vérifier au passage le seul autre consommateur actuel** du token : l'encart ambré de
  `src/components/features/admin/organizations/provision-organization-form.tsx`. La correction le
  traverse — elle l'améliore, son filet était sous le seuil lui aussi — mais elle doit être regardée,
  pas subie.

### Hors maquette — fait le 23/09/2026

**L'arbitrage « un seul niveau de gravité, bandeau non refermable » est reporté** (commit `03117ff`,
PR #26) :

- `docs/design-system.md` **§2.3** s'intitule désormais « `<AlertBanner />` — un seul niveau ». Il
  décrit le niveau unique et relègue les trois niveaux, la fermeture 24 h en `localStorage`, `endsAt`
  et la désactivation « en un clic depuis n'importe quelle page » en extension documentée, hors
  périmètre V1 ;
- `docs/prd.md` porte la décision et sa date sur la ligne « Bandeau d'alerte global » ;
- la note de s07 dans `docs/stories.md` ne dit plus « arbitrage ouvert ».

La maquette garde sa dernière case « HORS MAQUETTE », écrite avant ce report : elle est datée, elle
n'est plus à suivre. Le design system ne contredit plus la story.

## Hypothèses de conception à confirmer au plan

- **Le bandeau n'est pas collant** (`sticky`) : il est dans le flux, en tête du document, et
  disparaît au défilement. C'est la lecture littérale de « pousse la page, ne la recouvre pas »
  (§2.2). Non démontrable sur une maquette statique : annoté en marge.
- **Pas d'interrupteur (`switch`)** : message et affichage s'enregistrent d'un seul geste. Un
  interrupteur basculé pendant qu'une modification n'est pas enregistrée serait ambigu pour un
  bénévole.
- **« Retirer le bandeau » agit sans confirmation et laisse le message dans le champ.** L'action est
  sans danger et réversible ; c'est l'état `1g` qui le prouve. Le message conservé suppose une
  persistance du couple (message, actif) — la forme exacte (clés `organization_setting` sur le
  précédent de l'ADR 021, ou table dédiée) reste une question ouverte de la recherche.
- **Balisage du bandeau** : `role="region"` + `aria-label`, sans `aria-live` (gap n° 4).
- **Placement** : bandeau hors de la coquille à barre latérale, rendu une seule fois pour tout le
  site (gap n° 5). La recherche pose la question du layout porteur (`LocaleLayout` ou chaque groupe)
  et celle des zones héritées couvertes — le design ne la tranche pas.
- **Masqué à l'impression** (§6.2) : la maquette l'implémente ; à reprendre.
- **Message : texte brut, 280 caractères, sans lien.** Pas de gras, pas de markdown, pas de
  `{label, href}`.

## Ce que ce design ne couvre pas

- Les trois niveaux de gravité, le mot du niveau écrit, l'épaisseur de filet variable, la forme
  d'icône par niveau : arbitrage rendu, un seul niveau.
- La fermeture par le visiteur : croix, « masquer 24 h », mémorisation `localStorage`, identifiant de
  version du message.
- `endsAt`, publication programmée, désactivation automatique, rappel « bandeau actif depuis
  3 jours », bouton de désactivation depuis n'importe quelle page du back-office.
- Plusieurs bandeaux simultanés, file d'attente, confirmation de remplacement.
- Lien dans le message, texte riche, markdown, retours à la ligne mis en forme, emoji.
- Historique des alertes, journal, « dernière modification par X le … ».
- L'envoi du message par email ou par SMS aux membres : autres stories.
- L'isolation entre associations : garantie par la base, aucun écran à dessiner.
- L'en-tête et le pied du site public, la page de connexion, l'écran « Pages », la barre latérale du
  bureau : déjà livrés, ils n'apparaissent que sommairement pour situer le bandeau.
