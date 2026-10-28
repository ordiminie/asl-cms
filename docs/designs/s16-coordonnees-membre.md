# Design — Story s16-coordonnees-membre

> Conçu le 2026-10-28, chemin **Claude Design** : brief `docs/designs/s16-coordonnees-membre-brief.md`,
> livraison validée par Marie-Ève le 2026-10-28 (export `s16.zip`, fichier
> `s16-coordonnees-membre.dc.html`), puis figée ici. Canevas :
> `https://claude.ai/design/p/fe8b62f2-c626-4e1f-af29-5a2bb3a55372?file=docs%2Fdesigns%2Fs16-coordonnees-membre.dc.html`.
> Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s16-coordonnees-membre.md`.
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). Aucune version sombre
> n'a été dessinée, volontairement.

## Périmètre du design

Un écran, en **ordinateur (1 280 px) et mobile (390 px)**, états C1 à C8. Données fictives :
association « Clos-Fleuri » (monogramme « CF », teinte 195), Lucie Moreau, parcelle 12,
lucie.moreau@exemple.fr, 06 12 34 56 78, « 4 chemin des Oliviers », « Bâtiment B », 13100
Aix-en-Provence.

| Écran | Route        | États    |
| ----- | ------------ | -------- |
| C     | `/dashboard` | C1 à C8  |

**Arbitrages de produit** (détail dans le brief) :

- **23/10/2026** — l'adresse email est **affichée, jamais modifiable** par le membre : c'est son
  adresse de connexion, seul le bureau la change depuis la fiche (règle de s12d) ;
- **28/10/2026** — l'écran est une **carte « Mes coordonnées »** de l'espace membre, modifiée en
  place ; elle s'affiche aussi au propriétaire dont la fiche n'a aucune parcelle.

## Screen(s)

### Écran C — Espace membre : carte « Mes coordonnées »

Espace membre existant (s12d), une colonne, cartes empilées (24 px). La carte **« Mes
coordonnées »** (titre `h2` serif 20 px, sans icône) s'insère **entre « Mes parcelles » et
« Sécurité du compte »**. Même patron que la carte « Coordonnées » de la fiche côté bureau, à la
1ʳᵉ personne.

**En lecture** (C1, C2, C5, C7) : paires libellé (`label`, `muted-foreground`) / valeur, empilées
(4 px dans la paire, 24 px entre paires) :

- « Adresse email » — l'adresse en `data` (JetBrains Mono 17 px, `overflow-wrap: anywhere`), puis
  en `meta` : « C'est aussi l'adresse avec laquelle vous vous connectez. Pour la changer, écrivez au
  bureau. » + lien « Page Contact » ;
- « Téléphone » — le numéro (`body`), ou « Non renseigné » en `muted-foreground` ;
- « Adresse postale » — une ligne par élément présent (adresse, complément, « code postal
  commune »), ou « Non renseignée » en `muted-foreground` ;
- bouton `outline` « Modifier mes coordonnées » (pleine largeur, 56 px sur mobile).

**En modification** (C3, C4, C6), en place, pas de `dialog` :

- l'adresse email **reste en lecture** en haut de la carte, avec la même mention — un texte, jamais
  un champ, même grisé ;
- champs, libellé au-dessus + « Facultatif » en `meta` : « Téléphone », « Adresse »,
  « Complément » pleine largeur ; « Code postal » (1/3) et « Commune » (2/3) côte à côte sur
  desktop, empilés sur mobile ; champs 48 px (56 px mobile) ;
- autocomplete : `tel`, `address-line1`, `address-line2`, `postal-code`, `address-level2` ;
  `inputmode="numeric"` sur le code postal ;
- « Enregistrer mes coordonnées » (`default`) puis « Annuler » (`outline`) ; en ligne sur desktop,
  empilés pleine largeur 56 px sur mobile, « Enregistrer » en premier ;
- pendant l'envoi : libellé « Enregistrement… », bouton désactivé, largeur conservée (§ `button`
  du design system).

**Erreurs de saisie** (C4) : `alert` `destructive` (filet 2 px, `AlertTriangle`, `role="alert"`)
sous le titre de la carte : « Vos coordonnées n'ont pas été enregistrées. Corrigez les champs
signalés. », puis une liste de liens, un par champ fautif, dans l'ordre des champs. Sous chaque
champ fautif : le message de validation existant, champ à filet 2 px `--destructive`,
`aria-invalid` + `aria-describedby`. Valeurs saisies conservées. Le focus va sur le résumé
(`tabindex="-1"`).

**Échec technique** (C6) : même `alert` `destructive` : « Vos coordonnées n'ont pas pu être
enregistrées. » + « Réessayez dans un instant. Rien n'a été enregistré. ». La carte reste en
modification, saisies conservées, bouton de nouveau actif.

**Confirmation** (C5) : la carte repasse en lecture avec les nouvelles valeurs ; sous le titre, un
`alert` neutre (`role="status"`, `CircleCheck` `primary`, pas de vert) : « Coordonnées
enregistrées. » + « Le bureau voit dès maintenant vos nouvelles coordonnées. ». Le focus va sur
l'alerte.

**Sans parcelle** (C7) : `h1` « Votre espace membre », ni marqueur « Espace personnel », ni
salutation, ni « Mes parcelles » ; « Mes coordonnées » puis « Sécurité du compte ».

**Chargement** (C8) : la carte « Mes coordonnées » suit le `MemberSpaceLoading` existant (titres
`h2` visibles, blocs `skeleton`, `aria-busy`).

**Carte « Sécurité du compte »** (toutes les planches) : son texte devient « Votre mot de passe et
les appareils connectés à votre compte. ».

## Mockup

`docs/designs/s16-coordonnees-membre.html` — référence visuelle, figée depuis l'export du canevas
(moteur `support.js` retiré, données déroulées). **Ne pas copier en production** : l'exécution
construit l'écran avec les vrais composants (`card`, `form`, `label`, `input`, `alert`, `button`,
`skeleton`) et reprend le patron de la carte « Coordonnées » de la fiche
(`src/components/features/member-profile/`).

## Reused components (from the design system)

- `card` — « Mes coordonnées », comme « Mes parcelles » et « Sécurité du compte ».
- `form`, `label`, `input` — cinq champs facultatifs, messages de validation existants.
- `alert` — résumé d'erreurs et échec technique `destructive` ; confirmation neutre `CircleCheck`.
- `button` — « Modifier mes coordonnées » (`outline`), « Enregistrer mes coordonnées »
  (`default`), « Annuler » (`outline`).
- `skeleton` — via `MemberSpaceLoading` (`src/components/features/member-space/member-space.tsx`).

## States

- **Lecture** : C1 (tout renseigné), C2 (non renseigné), C7 (sans parcelle).
- **Modification** : C3 (avec l'état d'envoi en marge).
- **Erreur** : C4 (saisie : téléphone « 06 12 AB 56 78 », code postal « 1310 »), C6 (technique).
- **Succès** : C5.
- **Chargement** : C8.

## Design system gaps

Relevés par le canevas (« MANQUE » / « ÉCART ») et résolus **par le design system ou l'existant**,
sans rien inventer :

1. **Largeur de la colonne** : le canevas a pris 720 px faute de chiffre dans le brief ; le design
   system fixe l'espace membre à `max-w-[1000px]` (§ gabarits). L'implémentation garde le conteneur
   existant de `/dashboard`, la maquette n'est pas à suivre sur ce point.
2. **État désactivé** : pas de token ; le canevas montre une opacité 0,7. On garde l'état
   `disabled` du composant `button` (libellé remplacé, largeur conservée), pas de style nouveau.
3. **Skeleton** : le design system réserve `skeleton` aux listes et tableaux ; ici il ne couvre que
   le chargement de la page, comme le `MemberSpaceLoading` existant. Pas de skeleton pendant
   l'enregistrement.
4. **Position des alertes « en haut de la carte »** : sous le titre `h2`, retenu.
5. **Focus après envoi** : sur le résumé d'erreurs (échec) ou sur l'alerte `role="status"`
   (succès) — choix du canevas, retenu.

Écarts acceptés : en-tête du site et carte « Mes parcelles » schématiques (existants, non
redessinés) ; livraison en `.dc.html`, figée ici en `.html`.
