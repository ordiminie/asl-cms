# Design Brief — Story s14-attribuer-roles

> Brief à coller dans Claude Design. Il est autonome : story, écrans, contraintes, livrable.
> **Chaque écran en deux versions : bureau (desktop, 1 280 px) et mobile (390 px)**, même contenu et
> mêmes états. **Thème clair seul** : le produit n'a plus de mode sombre (ADR 033, qui remplace
> l'ADR 012). Ne produisez donc **aucune** version sombre.

## Story

**En tant que** membre du bureau d'une association **je veux** attribuer et retirer les rôles sur la
fiche d'un membre **afin que** le bureau nouvellement élu puisse administrer le site sans le
prestataire.

Critères d'acceptation :

1. Depuis la fiche d'un membre, un membre du bureau (Bureau ou Président(e)) lui attribue le rôle
   Bureau ou Président(e), ou le lui retire ; le changement prend effet pour le membre concerné.
2. Un membre promu Bureau accède au back-office ; le même membre, rôle retiré, y reçoit un refus.
3. Une association a toujours au moins un compte capable d'attribuer les rôles : retirer le dernier
   est refusé avec un message explicite.
4. Chaque attribution et chaque retrait est tracé (auteur, date, membre visé, rôle).
5. Un membre du bureau ne peut attribuer de rôle qu'aux membres de sa propre association.
6. Le rôle SuperAdmin (prestataire) n'est jamais attribuable depuis cet écran.

**Arbitrages de produit du 23/10/2026** (à respecter, ils ne sont pas à rediscuter) :

- **Trois rôles** dans l'association : **Membre** (par défaut), **Bureau**, **Président(e)**.
- **Une seule Président(e).** Le Bureau ne peut **ni retirer ni attribuer** la présidence.
- **Passation** : seule la Président(e) en place désigne son successeur, depuis la fiche de celui-ci.
  Elle **redevient alors Bureau**. C'est le seul moyen de changer de Président(e).
- **Effet immédiat** : le changement agit dès la page suivante du membre concerné. Les messages le
  disent (« dès maintenant »), jamais « à sa prochaine connexion ».
- **La trace est stockée, sans écran** : aucun historique des rôles à dessiner.
- **Comptes du bureau sans fiche** (l'administrateur créé à l'ouverture de l'association) : on leur
  crée d'abord une fiche avec leur adresse ; elle s'y rattache, et leur rôle devient gérable comme
  celui de tout autre propriétaire. Aucun écran dédié.

**Vocabulaire** : le back-office dit « **propriétaire** » (liste « Propriétaires », route
`/bureau/proprietaires`). Rôles écrits **Membre**, **Bureau**, **Président(e)** — le produit ne
connaît pas le genre des personnes (manque déjà noté en s12d). « Back-office » ne s'écrit pas à
l'écran : on dit « gérer le site de l'association ».

## Ce qui existe déjà (à ne pas redessiner)

- **Fiche d'un propriétaire** (`/bureau/proprietaires/{id}`, s12 puis s12d) : `breadcrumb`
  « Propriétaires › {nom} », `h1` = le nom, badges d'état (« Courrier uniquement »), puis trois `card`
  empilées (24 px) :
  1. **Coordonnées** — paires libellé / valeur ; « Modifier les coordonnées » (`outline`) ouvre les
     champs en place, boutons « Enregistrer les coordonnées » (`default`) / « Annuler » (`outline`) ;
  2. **Accès à l'espace membre** — icône `Lock` 20 px, une phrase, **aucune action** : « **Compte
     ouvert.** {nom} peut se connecter à son espace avec {adresse}. » ou « **Joignable par courrier
     uniquement.** Aucun compte : ajoutez une adresse email pour lui ouvrir son espace. » ; pour un
     membre du bureau, en `meta` : « Membre du bureau : son adresse peut être modifiée, pas
     supprimée. » (ou « Président(e) : … ») ;
  3. **Parcelles**.
- **Confirmations de la fiche** : des `alert` neutres (`role="status"`, `CircleCheck` en `primary`)
  en haut de la fiche, titre + une ligne.
- **Liste des propriétaires** (`/bureau/proprietaires`) : tableau (nom, parcelles, badges d'état
  « Courrier uniquement », « Fiche incomplète »), recherche, bouton « Ajouter un propriétaire ».
- **Écran de refus d'un simple membre** sur le back-office (s12d, « C4 ») : `h1` « Cette page ne vous
  est pas accessible », « Elle est réservée au bureau de l'association. », bouton « Revenir à mon
  espace ». Réutilisé tel quel, pas à redessiner.

## Écrans à produire

### Écran A — Fiche d'un propriétaire : la carte « Rôle dans l'association »

- **But** : voir d'un coup d'œil le rôle d'un propriétaire, et le changer sans ambiguïté sur ce que
  cela lui ouvre ou lui retire.
- **Disposition** : la fiche existante, avec une **quatrième `card` « Rôle dans l'association »**
  placée **juste après** « Accès à l'espace membre » (avant « Parcelles »). En lecture : une phrase
  toujours écrite (jamais un badge seul), puis le bouton `outline` « Modifier le rôle » quand la
  personne connectée y a droit.
- **Phrase en lecture selon le rôle enregistré** :
  - Membre : « **Membre.** {nom} accède à son espace personnel. »
  - Bureau : « **Bureau.** {nom} gère le site de l'association avec le reste du bureau. »
  - Président(e) : « **Président(e).** {nom} gère le site de l'association et peut transmettre la
    présidence. »
  - fiche sans compte (courrier uniquement) : « Aucun rôle possible : ajoutez d'abord une adresse
    email pour lui ouvrir un compte. » — **pas** de bouton.
- **Modification en place** (même patron que les Coordonnées, pas de `dialog`) : « Modifier le
  rôle » ouvre un `radio-group` « Rôle » (une option par ligne, libellé + phrase d'aide en `meta`),
  puis « Enregistrer le rôle » (`default`) et « Annuler » (`outline`).
  - Options pour un **membre du Bureau** qui modifie une fiche Membre ou Bureau : « Membre — accède à
    son espace personnel » et « Bureau — gère le site de l'association ». **Pas** d'option
    Président(e).
  - Options pour la **Président(e)** qui modifie une fiche Membre ou Bureau : les deux mêmes, plus
    « Président(e) — vous lui transmettez la présidence ».
- **Avertissements avant l'enregistrement** (encart `warning` sous le `radio-group`, apparaît dès que
  le choix diffère du rôle enregistré : fond `--warning`, filet `--warning-border`, texte
  `--warning-foreground`, `AlertTriangle` + « Attention. » en tête) :
  - vers Bureau : « Attention. {nom} pourra gérer tout le site de l'association dès maintenant : pages,
    actualités, propriétaires. »
  - vers Membre (depuis Bureau) : « Attention. {nom} ne pourra plus gérer le site de l'association dès
    maintenant. Son espace personnel reste ouvert. »
  - vers Membre **sur sa propre fiche** : « Attention. Vous ne pourrez plus gérer le site de
    l'association dès l'enregistrement. Votre espace personnel reste ouvert. »
- **Passation de la présidence** (seul acte sans retour possible pour la Président(e) : elle ne peut
  pas reprendre la présidence elle-même) : choisir « Président(e) » puis « Enregistrer le rôle »
  ouvre un **`alert-dialog`** :
  - titre « Transmettre la présidence à {nom} ? » ;
  - texte « {nom} devient Président(e) dès maintenant. Vous redevenez membre du bureau. Vous ne
    pourrez pas reprendre la présidence vous-même : seul(e) {nom} pourra la transmettre à nouveau. » ;
  - boutons « Transmettre la présidence » (`default`) et « Annuler » (`outline`), le bouton nommant
    l'acte.
- **Cas où il n'y a rien à modifier** (phrase en `meta` sous la phrase de rôle, **pas** de bouton) :
  - un membre du Bureau sur la fiche de la Président(e) : « Seul(e) la Président(e) peut transmettre
    la présidence. »
  - la Président(e) sur sa propre fiche : « Pour transmettre la présidence, ouvrez la fiche de la
    personne qui vous succède. »
- **Refus — dernier compte capable de désigner le bureau** (association sans Président(e), par
  exemple ancienne : le dernier compte Bureau ne peut pas redevenir Membre) : à l'enregistrement,
  résumé d'erreurs `alert` `destructive` (filet 2 px, `AlertTriangle`) en haut de la carte :
  « {nom} est le dernier compte qui peut désigner le bureau de l'association. Désignez d'abord une
  autre personne au bureau. Rien n'a été enregistré. »
- **Confirmations** (`alert` neutre en haut de la fiche, `CircleCheck`, titre « Rôle enregistré. »
  puis une ligne) :
  - vers Bureau : « {nom} fait maintenant partie du bureau. Il peut gérer le site de l'association dès
    maintenant. »
  - vers Membre : « {nom} ne fait plus partie du bureau. Son espace personnel reste ouvert. »
  - passation : « {nom} est maintenant Président(e). Vous restez membre du bureau. »
- **Sa propre rétrogradation** : après « Enregistrer le rôle » sur sa propre fiche vers Membre, la
  personne n'a plus accès au back-office ; elle arrive sur **son espace personnel** (`/dashboard`)
  avec, en haut, un `alert` neutre « Vous ne faites plus partie du bureau. » + « Votre espace
  personnel reste ouvert. »
- **États à montrer** (desktop **et** mobile pour chacun) :
  - `A1` fiche Membre, vue par un membre du Bureau (lecture) ;
  - `A2` même fiche, en modification, « Bureau » choisi → avertissement ;
  - `A3` après enregistrement → confirmation + carte « Bureau. … » ;
  - `A4` fiche Bureau, vue par un membre du Bureau, « Membre » choisi → avertissement ;
  - `A5` fiche de la Président(e), vue par un membre du Bureau → phrase, pas de bouton ;
  - `A6` fiche Bureau, vue par la Président(e), en modification avec les trois options ;
  - `A7` passation : `alert-dialog` ouvert ;
  - `A8` après passation → confirmation ; la carte montre « Président(e). » pour la fiche ouverte ;
  - `A9` sa propre fiche (Bureau), « Membre » choisi → avertissement à la 2ᵉ personne ;
  - `A10` refus du dernier compte capable ;
  - `A11` fiche « courrier uniquement » → « Aucun rôle possible… », pas de bouton ;
  - `A12` après sa propre rétrogradation : l'espace personnel avec le message.
- **Mobile** : cartes pleine largeur, marges 16 px ; options du `radio-group` en lignes de 56 px ;
  boutons 56 px empilés, « Enregistrer le rôle » en premier ; l'`alert-dialog` ancré en bas, pleine
  largeur, boutons empilés.

### Écran B — Liste des propriétaires : le rôle en badge

- **But** : repérer qui est au bureau sans ouvrir chaque fiche.
- **Disposition** : la liste existante ; à côté du nom, un `badge` « Bureau » ou « Président(e) » pour
  les fiches dont le compte a ce rôle. Rien pour un Membre. Le badge est un statut, jamais une action.
- **États** : `B1` desktop, `B2` mobile (le badge passe sous le nom si la place manque).

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

Barre latérale du back-office : `--sidebar: oklch(0.985 0.004 250)`, item actif
`--sidebar-accent: oklch(0.93 0.012 245)` + libellé en 600.

### Typographie

| Token         | Famille        | Taille | Graisse | Usage                                              |
| ------------- | -------------- | ------ | ------- | -------------------------------------------------- |
| `h1`          | Source Serif 4 | 34 px  | 600     | Titre de page                                      |
| `h3`          | Public Sans    | 20 px  | 600     | Titre de carte du back-office, sous-titre          |
| `body`        | Public Sans    | 17 px  | 400     | Texte courant, valeurs de champ                    |
| `body-strong` | Public Sans    | 17 px  | 600     | Nom, rôle mis en avant                             |
| `label`       | Public Sans    | 16 px  | 500     | Libellé de formulaire, aide                        |
| `button`      | Public Sans    | 16–17  | 600     | Boutons ; 17 px sur mobile                         |
| `meta`        | Public Sans    | 15 px  | 400     | Mention, aide d'une option                         |
| `data`        | JetBrains Mono | 15–17  | 400     | Numéro de parcelle, adresse en clair, tabular-nums |

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
- Points de rupture : `sm` 640 · `lg` 1024. Back-office : barre latérale 248 px → tiroir (`sheet`)
  sous 1 024 px. Sous 640 px, un `dialog` ou `alert-dialog` est ancré en bas, pleine largeur.
- Icônes lucide, trait 1.75, `currentColor` : 16 px dans le texte, 20 px boutons et lignes.
  Vocabulaire figé : `Lock` personnel, `AlertTriangle` alerte, `CircleCheck` succès. Jamais d'icône
  seule comme action.

### Composants à réutiliser

- `card` — bordure 1 px, sans ombre.
- `radio-group` — 2 ou 3 options courtes, une par ligne, libellé + aide ; au-delà de 3, `select`.
- `alert` — neutre avec `CircleCheck` `primary` pour un succès (**pas de vert**, il n'existe pas de
  token « succès ») ; `destructive` bordure 2 px pour un résumé d'erreurs ; encart `warning` pour un
  avertissement **avant** l'écriture.
- `alert-dialog` — **uniquement pour un acte sans retour**, le bouton nommant l'acte ; un seul voile
  `--overlay`.
- `button` — `default` (un seul par écran), `outline`, `link`. Tailles `default` 48 px, `lg` 56 px.
  Libellé à l'infinitif explicite.
- `badge` — statut, jamais une action.
- `breadcrumb` — back-office, dès le 2ᵉ niveau.
- `form`, `label` — libellé au-dessus, toujours visible ; jamais d'astérisque.

### Do / Don't

- ✅ Le mot porte l'information ; la couleur ne fait que renforcer.
- ✅ Un message dit ce qui a eu lieu, ce qui est conservé, et l'action suivante.
- ✅ Une seule action attendue par écran, en `default` ; le reste en `outline`.
- ✅ Vouvoiement, phrases courtes, typographie française (espace insécable avant `: ; ! ?`,
  guillemets « »).
- ❌ Information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ L'accent de l'association sur un bouton ou comme unique porteur d'un statut.
- ❌ Jargon : « back-office », « owner », « board », « rôle global », « session ».
- ❌ Un `select` ou un menu déroulant pour 2 ou 3 rôles.
- ❌ Toute version sombre (ADR 033).

**N'inventez aucun composant, token ou couleur hors de cette liste.** Un besoin non couvert se note
en marge (« MANQUE »), il ne se comble pas.

## Hors périmètre

- **L'historique des rôles** : la trace est stockée, aucun écran (arbitrage du 23/10).
- Le rôle **SuperAdmin** (prestataire) : n'apparaît jamais dans les options ni dans les badges.
- La matrice des droits par rôle (s37) et la simulation de rôle (s41).
- La création d'une fiche pour un compte du bureau sans fiche : c'est le formulaire « Ajouter un
  propriétaire » existant, inchangé.
- Les coordonnées et la carte « Accès à l'espace membre » : inchangées depuis s12d.
- L'invitation des membres (s42).
- Toute version sombre.

## Livrable attendu

Une maquette HTML statique (basse fidélité acceptée) avec, pour chaque état listé (`A1`…`B2`), une
planche **desktop** et une planche **mobile 390 px**, en n'utilisant que les tokens ci-dessus. Chaque
planche porte sa puce (`A3`, `B1`…). Données fictives : association « Clos-Fleuri » (monogramme
« CF », teinte 195), propriétaires Hélène Roux (Président(e)), Paul Vidal (Bureau), Lucie Moreau
(Membre). Les écarts au brief sont signalés en marge (« ÉCART »), les manques du design system aussi
(« MANQUE »). L'export sera enregistré sous `docs/designs/s14-attribuer-roles.html`.
