# Design — Story s01-provisionner-association

> Conçu le 2026-09-10, chemin **Agent**. Source visuelle unique :
> `docs/design-system.md` (889 lignes, §1 tokens · §2 composants · §3 patterns · §8 do/don't).
> Aucun composant, token, couleur ni mesure hors de ce document.
> Contexte de code : `docs/research/s01-provisionner-association.md`.

## Périmètre du design

s01 est une story **majoritairement non-UI** : sur ses dix critères d'acceptation, sept portent sur
la tenancy, la RLS et le retrait ADR 009 — rien à dessiner. **Trois seulement produisent un écran**,
et ils vivent tous dans le back-office SuperAdmin Zourite Studio :

| Critère | Ce qu'il demande                                                         | Écran       |
| ------- | ------------------------------------------------------------------------ | ----------- |
| 1       | Créer une association (nom, slug, domaine, modules activés) depuis le BO | **A**       |
| 5       | Désigner l'administrateur initial par son adresse email                  | **A**       |
| 3       | Drapeaux de modules **modifiables** depuis le BO                         | **B**       |
| 2, 4    | 404 sur domaine inconnu / module inactif                                 | _non conçu_ |

Les critères 2 et 4 exigent un écran « introuvable » que le design system déclare explicitement
comme un **manque** (§9, rattaché à s11). Il n'est donc pas dessiné ici — voir
« Design system gaps ».

## Écran(s)

### Écran A — Provisionner une association · `/admin/organizations/new`

**Une page, pas un dialogue.** Le socle édite une organisation dans un `dialog`
(`edit-organization-dialog.tsx`), et il serait tentant de suivre ce patron. Le design system
l'interdit : « `dialog` ≤ 2 champs » (§2.1). L'écran A en porte cinq. Le dialogue d'édition existant
reste en place et n'est pas touché ; c'est une **page nouvelle** qui s'ajoute.

Gabarit back-office (§1.6) : barre latérale 248 px fixe → tiroir sous `lg`. `breadcrumb` présent,
puisqu'on est au 2ᵉ niveau (§2.1). Un `h1` unique.

Formulaire en **une colonne, un champ par ligne**, libellé au-dessus toujours visible (§3.1).
Trois `card` (bordure 1 px, sans ombre) séparent trois questions distinctes :

| Carte                                   | Champs                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| **1 · L'association**                   | Nom · Identifiant court (préfixé `/`, en `data`) · Domaine |
| **2 · Administrateur de l'association** | Adresse email                                              |
| **3 · Modules**                         | Vote en ligne · Voirie · Petites annonces                  |

Actions en pied : **`Provisionner l'association`** en `default` — le seul de l'écran (§8) — et
`Annuler` en `outline`. Libellé à l'infinitif explicite, jamais « OK » (§2.1).

Deux choix à motiver, parce qu'ils ne sont pas arbitraires :

- **Cases à cocher, pas d'interrupteurs.** `switch` est réservé aux réglages **à effet immédiat**
  (§2.1). Sur un formulaire de création, rien n'est immédiat : la valeur est soumise avec le reste.
  D'où `checkbox` ici, et `switch` sur l'écran B.
- **Le monogramme est montré dès le provisioning.** §1.8 traite nommément « le cas au
  provisioning » : sans logo, deux lettres tirées du nom (« La Fourche » → LF) en Source Serif 4 sur
  la teinte de l'association. L'afficher ici évite que le SuperAdmin croie devoir fournir un logo,
  et le remplacement ultérieur ne change aucune mise en page (44 px dans les deux cas).

**Un encart dit que rien ne part.** s01 crée le compte, elle ne le contacte pas : l'envoi du lien de
connexion appartient à s03. Sans cette mention, le SuperAdmin repart en croyant l'administrateur
prévenu. Le texte est en langue ordinaire — « l'envoi automatique du lien de connexion n'est pas
encore en service » — parce que §3.6 interdit « lien magique », « token » et « authentification » à
l'écran.

### Écran B — Modules d'une association · `/admin/organizations/[id]/edit`

Une `card` **de plus** sur la page d'édition qui existe déjà (`[id]/edit/page.tsx` : titre +
`EditOrganizationForm` + carte d'usage + table des membres). Pas de nouvelle page.

Une ligne par module : nom, phrase d'usage, **libellé d'état écrit** (« Activé » / « Désactivé »),
puis l'interrupteur. Ici l'effet est immédiat, donc `switch` (§2.1) — et le libellé porte
l'information, l'interrupteur ne fait que la redoubler (§8 : « le mot porte l'information »).
L'interrupteur dessiné mesure 48 × 28, inscrit dans une cible de 44 × 44 (§1.5).

Un `badge` « 2 modules sur 3 » en tête : statut, jamais une action (§2.1).

⚠️ **Cette page affiche aujourd'hui `usage.projects` et `usage.credits`** dans sa carte d'usage —
deux sous-systèmes que le critère 8 supprime. s01 doit donc y passer de toute façon : la carte
d'usage perd deux de ses trois colonnes. C'est une contrainte de code relevée à la recherche, pas un
choix de design, mais elle tombe exactement sur l'écran B.

## Mockup

`docs/designs/s01-provisionner-association.html` — référence visuelle. **NE PAS copier en
production** : l'Execute construit avec les vrais composants du socle
(`src/components/ui/*`, `src/components/features/*`). La maquette communique la mise en page et les
états, elle ne remplace pas le système de composants.

Elle embarque **les deux jeux de tokens** (clair et sombre), comme l'exige l'ADR 012 : « toute
livraison de conception doit fournir deux jeux de tokens ». Poser `data-theme="dark"` sur `<html>`
pour vérifier le second.

## Reused components (from the design system)

Aucun composant nouveau. Tout vient des 37 du socle (§2.1) :

- **`card`** — les trois sections de l'écran A, la carte Modules de l'écran B. Bordure 1 px, **sans
  ombre** : la bordure suffit (§1.4).
- **`form` `label` `input`** — champs 48 px, texte 17 px, libellé 16 px / 500 au-dessus. Aide sous le
  champ en `muted-foreground`. « Facultatif » écrit en clair le cas échéant, **jamais d'astérisque**
  (§8).
- **`checkbox`** — les trois modules de l'écran A (valeur soumise, pas d'effet immédiat).
- **`switch`** — les trois modules de l'écran B (effet immédiat + libellé d'état).
- **`button`** — `default` 48 px pour l'action unique, `outline` pour Annuler. Chargement : libellé
  remplacé, bouton désactivé, **largeur conservée**.
- **`alert`** — erreurs et succès, **ancrés dans la page**. §2.1 est catégorique : « rien
  d'important ne passe par un toast » ; `sonner` est réservé aux confirmations sans conséquence.
  Provisionner une association et désactiver un module ont des conséquences.
- **`badge`** — « 2 modules sur 3 ». Statut, pas action.
- **`breadcrumb`** — dès le 2ᵉ niveau du back-office.
- **`sidebar`** — back-office uniquement, 248 px, item actif = fond `sidebar-accent` **+ libellé en
  600**.
- **`separator`** — entre les champs et l'aperçu du monogramme.

Volontairement **écartés** : `skeleton` (interdit sur un formulaire, §2.1) · `dialog` (limité à
deux champs) · `alert-dialog` (réservé à l'irréversible ; désactiver un module est réversible) ·
`tabs` (les trois cartes se lisent d'affilée, et un onglet cacherait un champ obligatoire) ·
`tooltip` (jamais porteur d'information indispensable).

**Tokens employés** — `background` `foreground` `card` `muted` `muted-foreground` `border` `input`
`ring` `primary` `primary-foreground` `secondary-foreground` `destructive` `link` `warning` +
`warning-border` + `warning-foreground` (l'encart « rien ne part »), `accent-solid` (le monogramme
seulement), la famille `sidebar-*`. Échelle d'espacement à huit valeurs, `--radius: 0.5rem`.

**`accent` n'est employé que pour l'identité** — le monogramme. Jamais sur un bouton : sa teinte est
inconnue à la conception (§3.3).

## States

Par écran, les quatre états de §3.2.

### Écran A

| État           | Forme retenue                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vide**       | Sans objet : c'est un formulaire de création, son état initial _est_ l'écran. L'identifiant court est proposé d'après le nom, modifiable. Modules **tous décochés** par défaut — un module s'active par décision, pas par oubli.                                                           |
| **Chargement** | Bouton : libellé → « Provisionnement… », désactivé, **largeur conservée**. Les deux boutons se désactivent. **Aucun `skeleton`** (interdit sur un formulaire).                                                                                                                             |
| **Erreur**     | Les trois signaux de §3.1 ensemble : résumé ancré en tête avec **liens d'ancrage** vers les champs fautifs, bordure `destructive` **2 px**, message sous chaque champ. Le résumé dit ce qui est perdu — « Rien n'est perdu : vos autres saisies sont conservées ». Ne disparaît pas seule. |
| **Succès**     | Ce qui a eu lieu **et où le vérifier** (§3.2) : « ASL La Fourche est provisionnée. Son site répond à asl-lafourche.fr. Le compte presidence@… peut l'administrer. » Affiché à l'arrivée sur la fiche, en `alert`, pas en toast.                                                            |

Deux erreurs métier ont un message écrit, parce qu'elles sont les seules que le SuperAdmin
rencontrera vraiment : **domaine déjà pris** (« Ce domaine sert déjà l'association « … ». Un domaine
ne peut servir qu'une association. ») et **email incomplète**. Le domaine est unique par
association (ADR 003) : le dire en nommant l'association qui l'occupe évite l'aller-retour.

### Écran B

| État           | Forme retenue                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vide**       | Sans objet : les trois modules existent toujours, activés ou non. Il n'y a pas de « zéro module ».                                                                                                                                        |
| **Chargement** | Pendant le basculement, l'interrupteur est inerte et le libellé d'état ne change **qu'après** confirmation de l'enregistrement.                                                                                                           |
| **Erreur**     | `alert` ancrée dans la carte, nommant le module : « Le module « Voirie » n'a pas été désactivé. … **Rien n'a changé** : le module reste activé. » **Le curseur revient à son état réel** — jamais un état que la base n'a pas enregistré. |
| **Succès**     | Le libellé d'état devient « Désactivé », le badge se recompte. C'est la confirmation ; pas de toast en plus, pour ne pas doubler un signal déjà lisible.                                                                                  |

### Accessibilité — liste de §3.8

- [x] Contour de champ ≥ 3:1 — `input` à `oklch(0.66 0.014 245)`, 3,1:1 (§3.7). **Jamais `border`
      sur un champ** : 1,4:1, décoratif seulement.
- [x] **Aucune information portée par la seule couleur** — l'état d'un module est un **mot**
      (« Activé »), l'erreur porte un pictogramme + un texte en plus de la bordure.
- [x] Cibles 44 × 44 — interrupteurs, cases, boutons 48 px.
- [x] Focus visible partout : `outline: 2px solid var(--ring); outline-offset: 2px`, jamais
      `outline: none`.
- [x] Un seul `h1` par page, hiérarchie sans saut (`h1` → `h3` de carte est conforme au barème de
      §1.3, où `h3` est « titre de carte du back-office »).
- [x] Texte courant 17 px, libellés 16 px / 500, plancher 15 px pour les métadonnées.
- [ ] **Zoom 200 %** et **parcours clavier complet** : à vérifier au navigateur pendant l'Execute,
      pas assertable sur une maquette statique.

## Design system gaps

Besoins que le système ne couvre pas. **Signalés, pas inventés.**

1. **La page « introuvable » — le seul manque bloquant pour s01.** Les critères 2 et 4 exigent un
   404 (domaine inconnu, route de module inactif), et le critère 4 précise « pas un lien masqué,
   **pas une page vide** ». Or §9 range la page 404 parmi les manques, **rattachée à s11** :
   « évoquée dans la livraison n° 1 (« renvoie vers l'accueil, les actualités et le contact »),
   jamais maquettée ». **s01 a besoin de l'écran avant que s11 le conçoive.** Trois issues
   possibles, à trancher hors de ce design : avancer la maquette 404 dans s01 (élargissement), se
   contenter du rendu introuvable du socle en s01 et l'habiller en s11, ou faire porter le gabarit
   par s11 en acceptant que s01 livre un écran non conforme au design system. **Ce n'est pas une
   décision de conception d'écran** : elle touche le périmètre de deux stories.
2. **Le shell du back-office SuperAdmin n'est pas couvert.** §2.1 décrit `sidebar` avec **deux
   groupes imposés** — « Le site », « L'association » — qui décrivent le back-office **de
   l'association**. Les écrans de s01 vivent dans l'espace **SuperAdmin Zourite Studio**, un shell
   hérité du boilerplate (`admin/layout.tsx`, `AdminSidebar`, 15 sections) que le design system ne
   mentionne nulle part. La maquette montre donc une barre latérale plausible **sans prétendre la
   spécifier**. À trancher : le SuperAdmin suit-il la convention à deux groupes, ou l'espace
   prestataire a-t-il son propre registre ?
3. **Le libellé d'un module sans écran.** À la fin de s01, les trois drapeaux existent mais aucun
   module n'a de page : `vote` arrive en s33, `voirie` en s34, `annonces` en s35. Un module activé
   qui ne mène nulle part est un état transitoire que le design system ne prévoit pas. Faut-il un
   marqueur « à venir » sur la ligne, ou l'assume-t-on en silence jusqu'au bloc F ?
4. **Le module fictif de test n'a pas de place définie.** Le critère 4 se prouve « sur une route de
   test rattachée à un module fictif ». Apparaît-il dans la liste des modules du back-office (au
   risque de s'y installer), ou reste-t-il invisible à l'interface ? La maquette ne le montre pas.
5. **La couleur des lettres du monogramme n'est pas spécifiée.** §1.8 impose la forme (deux lettres,
   Source Serif 4, sur la teinte de l'association) mais pas l'encre. Le problème est réel :
   §3.7 note `accent-solid` / `background` à 4,9:1, « AA **en ≥ 24 px seulement** », et le
   monogramme écrit à 18 px (carré de 44 px) et 15 px (carré de 34 px) — donc **sous le seuil
   documenté**. La maquette pose `primary-foreground`, seul quasi-blanc stable dans les deux jeux de
   tokens, mais **c'est un choix par défaut, pas une spécification** : le ratio réel dépend de la
   teinte choisie par l'association, inconnue à la conception. À trancher avec le sélecteur de
   teintes (s02), qui est déjà un manque déclaré — les deux se tiennent.

**Non-manques, à ne pas confondre** — ces trois-là sont déjà des manques _déclarés_ et
_attribués ailleurs_, donc hors de s01 : le sélecteur des six teintes d'accent (§9 → **s02**, seul
manque du bloc A), le favicon par association (§9 → s02/s11), et l'image Open Graph (§9 → s11). s01
ne les touche pas. Le monogramme, lui, **n'est pas un manque** : §1.8 le spécifie nommément pour le
provisioning.

## Ce que ce design ne couvre pas

Garde-fou de périmètre, pour que l'Execute ne dérive pas :

- Le choix de la **teinte d'accent** et le téléversement du **logo** → s02.
- L'envoi du **lien de connexion** à l'administrateur initial → s03. s01 crée le compte, point.
- Les écrans des **modules** eux-mêmes → s33 (vote), s34 (voirie), s35 (annonces).
- La **simulation de rôle** et son `<ImpersonationBar />` → s41.
- La **liste** des associations, sa recherche et sa pagination : elles existent déjà au socle
  (`organizations-management.tsx`, `organizations-toolbar.tsx`, `organizations-pagination.tsx`) et
  s01 n'y ajoute qu'un point d'entrée vers l'écran A.
- La **désignation des autres membres du bureau** → s14.

<< IP Mike: expected level of detail, what unblocks the Plan without over-designing. >>
