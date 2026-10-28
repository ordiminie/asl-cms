# Design Brief — Story s16-coordonnees-membre

> Brief à coller dans Claude Design. Il est autonome : story, écrans, contraintes, livrable.
> **Chaque écran en deux versions : bureau (desktop, 1 280 px) et mobile (390 px)**, même contenu et
> mêmes états. **Thème clair seul** : le produit n'a plus de mode sombre (ADR 033, qui remplace
> l'ADR 012). Ne produisez donc **aucune** version sombre.

## Story

**En tant que** membre propriétaire **je veux** corriger mes informations de contact **afin que** le
bureau puisse me joindre correctement.

Critères d'acceptation (le critère 1 est **amendé** par l'arbitrage du 23/10/2026, ci-dessous) :

1. Un membre connecté modifie ses coordonnées (adresse postale, téléphone) et voit la valeur
   enregistrée après rechargement. **Son adresse email est affichée, pas modifiable** : pour la
   changer, il écrit au bureau.
2. Une saisie invalide affiche les erreurs par champ et n'enregistre rien.
3. Un membre ne peut modifier que ses propres coordonnées (aucun identifiant de fiche n'est visible
   ni transmis par l'écran).
4. Le bureau voit les coordonnées à jour dans la fiche du membre.

**Arbitrages de produit** (à respecter, ils ne sont pas à rediscuter) :

- **23/10/2026 — l'adresse email reste au bureau.** Un membre ne modifie **pas** son adresse email :
  c'est aussi l'adresse avec laquelle il se connecte, et la changer ferme son accès actuel pour en
  ouvrir un autre (règle de s12d). Seul le bureau la change pour lui, depuis la fiche. Le membre ne
  peut pas non plus la supprimer. Le changement d'adresse de la page « Sécurité du compte » reste
  fermé.
- **28/10/2026 — où vit l'écran** : une **carte « Mes coordonnées »** sur l'espace membre
  (`/dashboard`), modifiée **en place** ; elle s'affiche aussi au propriétaire dont la fiche n'a
  encore aucune parcelle.

**Vocabulaire** : vouvoiement ; « espace membre », « bureau ». Ni « profil », ni « compte
utilisateur », ni « identifiant ». Le produit ne connaît pas le genre des personnes : pas de pronom
genré.

## Ce qui existe déjà (à ne pas redessiner)

- **Espace membre** (`/dashboard`, s12d), colonne unique, cartes empilées (24 px) :
  1. **marqueur** « Espace personnel » (`Lock` 16 px + « Espace personnel » + « Parcelle 12 ») ;
  2. `h1` « Bonjour {nom} » ;
  3. carte **« Mes parcelles »** (titre `h2` serif 20 px) : parcelles actuelles et anciennes, puis
     « Une erreur ? Écrivez au bureau. » avec un lien « Page Contact » ;
  4. carte **« Sécurité du compte »** : « Votre adresse email, votre mot de passe et les appareils
     connectés à votre compte. » + lien « Gérer la sécurité du compte » (vers `/account`).
- **Propriétaire dont la fiche n'a aucune parcelle**, ou compte sans fiche : `h1` « Votre espace
  membre », puis la seule carte « Sécurité du compte ».
- **Côté bureau**, la fiche du propriétaire a déjà une carte « Coordonnées » modifiable en place
  (paires libellé / valeur, « Modifier les coordonnées » → champs → « Enregistrer les coordonnées » /
  « Annuler ») : **c'est le patron à suivre**, vu depuis l'espace membre, à la 1ʳᵉ personne.
- **Champs et messages de validation existants** (à reprendre tels quels) : « Téléphone »,
  « Adresse », « Complément », « Code postal », « Commune » ; « Ce numéro de téléphone n'est pas
  valide : 30 caractères au plus, des chiffres, des espaces et + . - ( ). », « Cette ligne d'adresse
  est trop longue : 200 caractères au plus. », « Un code postal compte 5 chiffres. », « Ce nom de
  commune est trop long : 100 caractères au plus. ».

## Écrans à produire

### Écran C — Espace membre : la carte « Mes coordonnées »

- **But** : que le propriétaire voie ce que le bureau sait pour le joindre, et corrige téléphone et
  adresse postale sans écrire au bureau.
- **Disposition** : une carte **« Mes coordonnées »** (titre `h2` serif 20 px, comme « Mes
  parcelles »), placée **entre « Mes parcelles » et « Sécurité du compte »**. Pas d'icône de carte.
- **En lecture** : trois paires libellé (`label`) / valeur (`body`) :
  - « Adresse email » — l'adresse en clair (`data`), puis en `meta` : « C'est aussi l'adresse avec
    laquelle vous vous connectez. Pour la changer, écrivez au bureau. » avec un lien « Page
    Contact » ;
  - « Téléphone » — le numéro, ou « Non renseigné » ;
  - « Adresse postale » — sur plusieurs lignes (adresse, complément, code postal et commune), ou
    « Non renseignée ».
  - Puis le bouton `outline` **« Modifier mes coordonnées »**.
- **En modification** (en place, pas de `dialog`) :
  - l'adresse email **reste affichée en lecture** en haut de la carte, avec la même mention ;
  - champs empilés, libellé au-dessus : « Téléphone », « Adresse », « Complément », « Code
    postal », « Commune » ; tous facultatifs, mention « Facultatif » en `meta` à côté du libellé ;
    code postal et commune côte à côte sur desktop, empilés sur mobile ;
  - boutons **« Enregistrer mes coordonnées »** (`default`) et « Annuler » (`outline`) ; pendant
    l'envoi, le bouton est désactivé et dit « Enregistrement… ».
- **Erreurs de saisie** : à l'enregistrement, résumé d'erreurs `alert` `destructive` (filet 2 px,
  `AlertTriangle`) en haut de la carte : « Vos coordonnées n'ont pas été enregistrées. Corrigez les
  champs signalés. », avec un lien par champ en erreur ; sous chaque champ fautif, le message de
  validation existant, champ à filet 2 px `--destructive`. Les valeurs saisies sont conservées.
- **Échec technique** : même `alert` `destructive` : « Vos coordonnées n'ont pas pu être
  enregistrées. Réessayez dans un instant. Rien n'a été enregistré. »
- **Confirmation** : la carte repasse en lecture avec les nouvelles valeurs, et un `alert` neutre
  (`role="status"`, `CircleCheck` `primary`) en haut de la carte : titre « Coordonnées
  enregistrées. » puis « Le bureau voit dès maintenant vos nouvelles coordonnées. ».
- **Carte « Sécurité du compte »** : son texte devient « Votre mot de passe et les appareils
  connectés à votre compte. » (l'adresse email n'y est plus modifiable).
- **États à montrer** (desktop **et** mobile pour chacun) :
  - `C1` espace membre complet, carte en lecture, tout renseigné ;
  - `C2` carte en lecture, téléphone et adresse non renseignés ;
  - `C3` carte en modification ;
  - `C4` erreurs de saisie (code postal à 4 chiffres, téléphone avec des lettres) ;
  - `C5` après enregistrement : confirmation + nouvelles valeurs ;
  - `C6` échec technique ;
  - `C7` propriétaire dont la fiche n'a aucune parcelle : `h1` « Votre espace membre », carte « Mes
    coordonnées » puis « Sécurité du compte » (pas de marqueur de parcelle, pas de salutation) ;
  - `C8` chargement : la carte en `skeleton`, comme « Mes parcelles ».
- **Mobile** : cartes pleine largeur, marges 16 px ; champs 56 px ; boutons 56 px empilés,
  « Enregistrer mes coordonnées » en premier.

## Contraintes du design system (non négociables)

### Tokens — thème clair unique

```css
--radius: 0.5rem;
--background: oklch(1 0 0);
--foreground: oklch(0.22 0.015 250);
--card: oklch(1 0 0);
--muted: oklch(0.972 0.005 240);
--muted-foreground: oklch(0.45 0.02 245);
--border: oklch(0.9 0.008 245);
--input: oklch(0.66 0.014 245); /* contour de champ, 3:1 */
--ring: oklch(0.55 0.11 235);
--primary: oklch(0.35 0.06 240);
--primary-foreground: oklch(0.985 0.003 240);
--secondary: oklch(0.965 0.006 240);
--secondary-foreground: oklch(0.3 0.02 245);
--destructive: oklch(0.48 0.17 27);
--destructive-text: oklch(0.48 0.17 27);
--link: oklch(0.45 0.13 250);
--warning: oklch(0.94 0.06 75);
--warning-border: oklch(0.6 0.13 65);
--warning-foreground: oklch(0.3 0.08 60);
--accent-hue: 195; /* seule variable de l'association : identité, jamais une action */
--accent: oklch(0.958 0.024 var(--accent-hue));
--accent-foreground: oklch(0.38 0.08 var(--accent-hue));
--accent-solid: oklch(0.55 0.1 var(--accent-hue));
--overlay: oklch(0.22 0.015 250 / 0.5);
--table-stripe: oklch(0.99 0.002 250);
```

### Typographie

| Token         | Famille        | Taille | Graisse | Usage                                                 |
| ------------- | -------------- | ------ | ------- | ----------------------------------------------------- |
| `h1`          | Source Serif 4 | 34 px  | 600     | Titre de page                                         |
| `h2`          | Source Serif 4 | 20 px  | 600     | Titre de carte de l'espace membre (« Mes parcelles ») |
| `h3`          | Public Sans    | 20 px  | 600     | Sous-titre                                            |
| `body`        | Public Sans    | 17 px  | 400     | Texte courant, valeurs de champ                       |
| `body-strong` | Public Sans    | 17 px  | 600     | Libellé mis en avant                                  |
| `label`       | Public Sans    | 16 px  | 500     | Libellé de formulaire, aide                           |
| `button`      | Public Sans    | 16–17  | 600     | Boutons ; 17 px sur mobile                            |
| `meta`        | Public Sans    | 15 px  | 400     | Mention, aide d'un champ                              |
| `data`        | JetBrains Mono | 15–17  | 400     | Numéro de parcelle, adresse en clair, tabular-nums    |

Texte courant **17 px**, jamais moins ; plancher 15 px pour `meta` ; pas de graisse 300, pas
d'italique porteur d'information.

### Espacement, formes, cibles

- Échelle : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, **rien d'autre**.
- Rayons : 8 px champs, boutons, cartes ; 12 px dialogues.
- Bordures : 1 px `border` séparation ; 1 px `input` champ ; **2 px = « quelque chose ne va pas »**
  (erreur, résumé d'erreurs).
- Ombres : aucune sur les cartes (la bordure suffit).
- Cibles ≥ 44 × 44 ; **56 px** pour les actions principales sur mobile ; champs 48 px (56 mobile).
- Focus : `outline: 2px solid var(--ring); outline-offset: 2px`, jamais supprimé.
- Points de rupture : `sm` 640 · `lg` 1024. L'espace membre est une colonne unique (largeur de
  lecture), sans barre latérale.
- Icônes lucide, trait 1.75, `currentColor` : 16 px dans le texte, 20 px boutons et lignes.
  Vocabulaire figé : `Lock` personnel (réservé au marqueur « Espace personnel »), `AlertTriangle`
  alerte, `CircleCheck` succès. Jamais d'icône
  seule comme action.

### Composants à réutiliser

- `card` — bordure 1 px, sans ombre.
- `form`, `label`, `input` — libellé au-dessus, toujours visible ; jamais d'astérisque ; « Facultatif »
  en `meta`.
- `alert` — neutre avec `CircleCheck` `primary` pour un succès (**pas de vert**, il n'existe pas de
  token « succès ») ; `destructive` bordure 2 px pour un résumé d'erreurs.
- `button` — `default` (un seul par écran), `outline`, `link`. Tailles `default` 48 px, `lg` 56 px.
  Libellé à l'infinitif explicite.
- `skeleton` — chargement.

### Do / Don't

- ✅ Le mot porte l'information ; la couleur ne fait que renforcer.
- ✅ Un message dit ce qui a eu lieu, ce qui est conservé, et l'action suivante.
- ✅ Une seule action attendue par écran, en `default` ; le reste en `outline`.
- ✅ Vouvoiement, phrases courtes, typographie française (espace insécable avant `: ; ! ?`,
  guillemets « »).
- ✅ L'écran ne montre **que** des données du membre connecté (design system §3.4).
- ❌ Information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ L'accent de l'association sur un bouton ou comme unique porteur d'un statut.
- ❌ Un champ email modifiable, grisé ou désactivé : l'adresse est un **texte**, pas un champ.
- ❌ Jargon : « profil », « identifiant », « compte utilisateur », « session ».
- ❌ Toute version sombre (ADR 033).

**N'inventez aucun composant, token ou couleur hors de cette liste.** Un besoin non couvert se note
en marge (« MANQUE »), il ne se comble pas.

## Hors périmètre

- **Le changement d'adresse email par le membre** (arbitrage du 23/10) et toute confirmation par
  email : le bureau le fait depuis la fiche, inchangée.
- Le **nom** du propriétaire et ses **parcelles** : non modifiables par le membre (« Une erreur ?
  Écrivez au bureau. » existe déjà).
- La fiche côté bureau (s12, s12d) : inchangée.
- La page « Sécurité du compte » (`/account`) : seul le texte de sa carte d'entrée change.
- Le compte sans fiche (aucune coordonnée à afficher) : inchangé.
- Toute version sombre.

## Livrable attendu

Une maquette HTML statique (basse fidélité acceptée) avec, pour chaque état listé (`C1`…`C8`), une
planche **desktop** et une planche **mobile 390 px**, en n'utilisant que les tokens ci-dessus. Chaque
planche porte sa puce (`C3`…). Données fictives : association « Clos-Fleuri » (monogramme « CF »,
teinte 195), propriétaire Lucie Moreau, parcelle 12, lucie.moreau@exemple.fr, 06 12 34 56 78,
« 4 chemin des Oliviers », « Bâtiment B », 13100 Aix-en-Provence. Les écarts au brief sont signalés
en marge (« ÉCART »), les manques du design system aussi (« MANQUE »). L'export sera enregistré sous
`docs/designs/s16-coordonnees-membre.html`.
