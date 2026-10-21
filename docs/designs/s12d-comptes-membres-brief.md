# Design Brief — Story s12d-comptes-membres

> Brief à coller dans Claude Design. Il est autonome : story, écrans, contraintes, livrable.
> **Chaque écran en deux versions : bureau (desktop, 1 280 px) et mobile (390 px)**, même contenu et
> mêmes états. **Thème clair seul** : le produit n'a plus de mode sombre (ADR 033, qui remplace
> l'ADR 012). Ne produisez donc **aucune** version sombre.

## Story

**En tant que** membre du bureau **je veux** qu'une fiche de propriétaire dotée d'une adresse email
ait un compte connectable, et qu'il se referme quand l'adresse est retirée, **afin que** chaque
propriétaire joignable par email puisse accéder à son espace, et à lui seul.

Critères d'acceptation :

1. Renseigner une adresse email sur une fiche « courrier uniquement » lui ouvre un compte connectable
   sur cette association ; la retirer referme l'accès sans supprimer la fiche ni son historique.
2. Une fiche créée avec une adresse email a un compte connectable dès sa création, y compris les
   fiches qui avaient déjà une adresse avant cette story.
3. Une adresse déjà connue du produit (même personne dans une autre association) réutilise son compte
   au lieu d'en créer un second ; fermer l'accès ici ne touche pas à son accès ailleurs.
4. Un propriétaire ne voit que ses propres parcelles, **actuelles et passées**, dans son espace ;
   l'accès à la fiche d'un autre est refusé.
5. Après sa connexion, un propriétaire arrive sur « Mes parcelles » (`/dashboard`).
6. Retirer l'adresse d'une fiche dont le compte a une session ouverte coupe l'accès à la requête
   suivante.

**Arbitrages de produit du 20/10/2026** (à respecter, ils ne sont pas à rediscuter) :

- **Changer l'adresse** d'une fiche qui a un compte : l'accès lié à l'ancienne adresse est fermé ici,
  un accès s'ouvre sur la nouvelle. Les autres associations ne sont jamais touchées.
- **Accès fermé** : la personne est déconnectée et arrive sur la page de connexion avec un message
  explicite qui l'envoie vers le bureau.
- **Fiche d'un membre du bureau ou de la présidence** : son adresse est **modifiable, jamais
  supprimable**, et son rôle au bureau suit la nouvelle adresse. Pour un propriétaire ordinaire,
  retirer l'adresse reste permis (critère 1).
- **Anciennes parcelles** côté propriétaire : listées avec leur période (critère 4), **sans** le nom de
  l'acquéreur, qui est un autre propriétaire.
- **Supprimer une adresse est réservé au bureau.** Un propriétaire peut **modifier** sa propre adresse,
  jamais la supprimer. Cet écran-là appartient à s16 (hors périmètre ici) ; aucun écran de ce brief ne
  doit laisser croire qu'un propriétaire peut retirer son adresse lui-même.

**Vocabulaire** : le produit dit « **propriétaire** » (pas « membre ») dans le back-office : liste
« Propriétaires », bouton « Ajouter un propriétaire », route `/bureau/proprietaires`. Côté propriétaire
connecté, on parle de « votre espace ».

## Ce qui existe déjà (à ne pas redessiner)

- **Fiche d'un propriétaire** (`/bureau/proprietaires/{id}`), livrée par s12 : `breadcrumb`
  « Propriétaires › {nom} », `h1` = le nom, badges d'état dessous (« Courrier uniquement », « Fiche
  incomplète »), puis deux `card` : **Coordonnées** (paires libellé / valeur, « Modifier les
  coordonnées » ouvre les champs en place, boutons « Enregistrer les coordonnées » / « Annuler ») et
  **Parcelles** (actuelles, anciennes). Les messages après enregistrement sont des `alert` neutres
  ancrés sous le titre (« Coordonnées enregistrées. »).
- **Ajouter un propriétaire** (`/bureau/proprietaires/nouveau`) : cartes Identité, Coordonnées,
  Parcelles ; bouton « Enregistrer le propriétaire ». Après création, la fiche s'ouvre avec
  « Propriétaire enregistré. ».
- **Espace membre** (`/dashboard`), livré par s46 : en-tête à deux éléments (logo + nom de
  l'association à gauche, lien vers le site ; bouton `outline` « Se déconnecter » à droite), colonne
  unique `max-w-[1000px]`, `h1` « Votre espace membre », une `card` « Sécurité du compte » avec le
  lien « Gérer la sécurité du compte ».
- **Connexion** (`/login`) : un seul champ adresse email, aucun mot de passe pour les membres.

## Écrans à produire

### Écran A — Fiche d'un propriétaire : la carte « Accès à l'espace membre »

- **But** : que le bureau sache, sans ambiguïté, si ce propriétaire peut se connecter, et ce que
  change une modification de son adresse **avant** de l'enregistrer.
- **Disposition** : la fiche existante, avec une **troisième `card` « Accès à l'espace membre »**
  entre « Coordonnées » et « Parcelles ». Elle contient **une phrase toujours écrite** (jamais un
  badge seul), précédée d'une icône `Lock` 20 px. Aucune action propre : l'accès se pilote par
  l'adresse email des Coordonnées.
- **Contenu de la carte selon le cas** :
  - compte ouvert : « Compte ouvert. {nom} peut se connecter à son espace avec {adresse}. »
  - courrier uniquement : « Joignable par courrier uniquement. Aucun compte : ajoutez une adresse
    email pour lui ouvrir son espace. »
  - membre du bureau : « Compte ouvert. {nom} peut se connecter à son espace avec {adresse}. » puis,
    en `meta` : « Membre du bureau : son adresse peut être modifiée, pas supprimée. » (ou
    « Présidente » / « Président » selon le rôle).
- **Avertissements pendant la modification** (ancrés **sous le champ** « Adresse email », **avant**
  l'enregistrement, encart `warning` : fond `--warning`, filet `--warning-border`, texte
  `--warning-foreground`, icône `AlertTriangle` + mot « Attention. » en tête) :
  - adresse vidée (propriétaire ordinaire) : « Attention. Sans adresse email, {nom} ne pourra plus se
    connecter à son espace. Sa fiche, ses parcelles et son historique sont conservés. Il recevra les
    envois par courrier. »
  - adresse remplacée par une autre : « Attention. {nom} ne pourra plus se connecter avec {ancienne
    adresse}. Son espace s'ouvrira avec {nouvelle adresse}. »
  - adresse remplacée, membre du bureau : la phrase précédente, suivie de « Son rôle au bureau suit la
    nouvelle adresse. »
  - Pas d'`alert-dialog` : ces actes sont réversibles.
- **Refus — adresse vidée sur la fiche d'un membre du bureau** : erreur de champ (bordure 2 px
  `destructive`, message 16 px / 500 en `--destructive-text` sous le champ) **et** résumé d'erreurs en
  tête du formulaire (`alert` `destructive`, bordure 2 px) : « {nom} fait partie du bureau : son
  adresse lui sert à se connecter. Vous pouvez la modifier, pas la supprimer. Rien n'a été
  enregistré. »
- **Messages après enregistrement** (`alert` neutre ancré sous le titre, `CircleCheck` en `primary`,
  deux lignes) :
  - adresse ajoutée : « Coordonnées enregistrées. » + « Compte ouvert : {nom} peut désormais se
    connecter avec {adresse}. »
  - adresse retirée : « Coordonnées enregistrées. » + « Accès à l'espace fermé. »
  - adresse remplacée : « Coordonnées enregistrées. » + « {nom} se connecte désormais avec {nouvelle
    adresse}. L'accès avec {ancienne adresse} est fermé. »
  - **Ouvrir un compte n'envoie rien** au propriétaire (l'invitation viendra plus tard) : aucun écran ne
    doit laisser croire qu'un email est parti.
- **Adresse déjà utilisée dans une autre association** : **rien ne le montre au bureau**. Le message
  est exactement celui d'une adresse nouvelle (« Compte ouvert… »). Dire au bureau qu'une adresse
  existe ailleurs révélerait à une association qui est inscrit chez une autre.
- **États à montrer** (desktop **et** mobile pour chacun) :
  - `A1` compte ouvert (propriétaire ordinaire, deux parcelles) ;
  - `A2` courrier uniquement ;
  - `A3` en modification, adresse vidée → avertissement ;
  - `A4` après retrait → message + carte « Joignable par courrier uniquement… » ;
  - `A5` après ajout → message + carte « Compte ouvert… » ;
  - `A6` en modification, adresse remplacée → avertissement ;
  - `A7` après remplacement → message ;
  - `A8` fiche d'un membre du bureau, compte ouvert ;
  - `A9` fiche d'un membre du bureau, adresse vidée puis « Enregistrer » → refus ;
  - `A10` fiche d'un membre du bureau, adresse remplacée → avertissement avec « Son rôle au bureau suit
    la nouvelle adresse. ».
- **Mobile** : les `card` en pleine largeur, marges 16 px ; boutons 56 px empilés, « Enregistrer les
  coordonnées » en premier.

### Écran B — Ajouter un propriétaire : la confirmation de compte

- **But** : dire au bureau, dès la création, qu'une fiche avec adresse a un compte.
- **Disposition** : la fiche qui s'ouvre après « Enregistrer le propriétaire ».
- **États** :
  - `B1` créé **avec** adresse : « Propriétaire enregistré. » + « Compte ouvert : {nom} peut se
    connecter avec {adresse}. » ; carte « Accès » en « Compte ouvert » ;
  - `B2` créé **sans** adresse : « Propriétaire enregistré. » seul ; carte « Accès » en « Joignable par
    courrier uniquement… ».
- Desktop et mobile. Le formulaire d'ajout lui-même n'est pas à redessiner. Seule retouche : l'aide du
  champ email devient « Avec une adresse, ce propriétaire peut se connecter à son espace. Sans adresse,
  il reçoit tout par courrier. »

### Écran C — Espace membre : « Mes parcelles » (`/dashboard`)

- **But** : un propriétaire vient chercher une chose, ses parcelles. Rien d'autre à l'écran ; aucune
  densité de tableau de bord.
- **Disposition** (dans la coquille s46, en-tête inchangé, colonne `max-w-[1000px]`) :
  1. marqueur de donnée personnelle, **une seule fois en haut** : `Lock` 16 px + « Espace personnel » +
     « Parcelles 12 et 13 » (ou « Aucune parcelle actuelle ») en `meta` ;
  2. `h1` « Bonjour {nom} » (le nom de la fiche, tel qu'il figure sur les courriers) ;
  3. `card` **« Mes parcelles »** :
     - **Parcelles actuelles** : une ligne de 56 px par parcelle, icône `Map` 20 px, « Parcelle 12 »
       (numéro en `data`), puis « Propriétaire depuis le 3 février 1998 » (date en clair) ;
       **pas de tableau** ;
     - **Anciennes parcelles**, si elles existent, sous un sous-titre `h3` : une ligne par parcelle,
       « Parcelle 47 », puis « Propriétaire du 3 février 1998 au 14 juin 2026 » (date en clair ; le
       dernier jour est **la veille** de la vente). **Ni le nom de l'acquéreur, ni aucune action.** ;
     - sous la liste : « Une erreur ? Écrivez au bureau. » + lien « Page Contact » (`link`, souligné) ;
  4. la `card` « Sécurité du compte » de s46, inchangée, **après** « Mes parcelles ».
- **États** :
  - `C1` propriétaire, deux parcelles actuelles ;
  - `C2` propriétaire avec une parcelle actuelle **et** une ancienne ;
  - `C3` ancien propriétaire (accès encore ouvert) : marqueur « Aucune parcelle actuelle », carte avec
    la phrase « Vous n'êtes plus propriétaire d'une parcelle du domaine depuis le 15 juin 2026. »
    suivie de la liste des anciennes parcelles ;
  - `C4` accès refusé à la fiche d'un autre propriétaire : `h1` « Cette page ne vous est pas
    accessible », « Elle concerne un autre membre de l'association. », bouton `default` « Revenir à mon
    espace » (icône `ArrowLeft` + libellé). **Ni nom, ni parcelle, ni code d'erreur, ni marqueur
    personnel** ;
  - `C5` compte sans fiche dans cette association (le prestataire, par exemple) : la page actuelle de
    s46, sans marqueur ni « Mes parcelles ».
  - Chargement : la carte « Mes parcelles » en `skeleton` (deux lignes) ; l'en-tête et le `h1`
    restent visibles.
- **Mobile** : lignes de parcelle pleine largeur, 56 px ; marges 16 px ; bouton de `C4` en pleine
  largeur, 56 px.

### Écran D — Connexion : l'accès vient d'être fermé (`/login`)

- **But** : qu'un propriétaire dont le bureau a fermé l'accès comprenne ce qui se passe et sache à
  qui s'adresser, au lieu de tomber sur une page de connexion muette.
- **Quand** : il avait une session ouverte et fait sa requête suivante, **ou** il clique après coup
  sur un lien de connexion reçu avant la fermeture. Dans les deux cas, il est déconnecté.
- **Disposition** : l'écran de connexion existant (un champ « Adresse email », bouton « Recevoir un
  lien de connexion »), avec, **au-dessus du formulaire**, un `alert` neutre (`Info` 20 px, pas de
  rouge : il n'a rien fait de mal) :
  « Votre accès à l'espace de {association} est fermé. » + « Pour le rouvrir, écrivez au bureau. » +
  lien « Page Contact ».
- **États** : `D1` desktop, `D2` mobile. Aucun autre état à dessiner.
- **Langue** : jamais « lien magique », « token », « session », « authentification » à l'écran.

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
| `h1`          | Source Serif 4 | 34 px  | 600     | Titre de page, écran membre                        |
| `h3`          | Public Sans    | 20 px  | 600     | Titre de carte du back-office, sous-titre          |
| `body`        | Public Sans    | 17 px  | 400     | Texte courant de l'espace privé, valeurs de champ  |
| `body-strong` | Public Sans    | 17 px  | 600     | Nom, mise en avant                                 |
| `label`       | Public Sans    | 16 px  | 500     | Libellé de formulaire, aide                        |
| `button`      | Public Sans    | 16–17  | 600     | Boutons ; 17 px sur mobile                         |
| `meta`        | Public Sans    | 15 px  | 400     | Date secondaire, mention                           |
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
  sous 1 024 px. Espace membre : `max-w-[1000px]`, une colonne, marges 16 px sous 1 024 px.
- Icônes lucide, trait 1.75, `currentColor` : 16 px dans le texte, 20 px boutons et lignes.
  Vocabulaire figé : `Map` parcelle, `Lock` personnel, `AlertTriangle` alerte. Jamais d'icône seule
  comme action.

### Composants à réutiliser

- `card` — bordure 1 px, sans ombre.
- `alert` — neutre avec `CircleCheck` `primary` pour un succès (**pas de vert**, il n'existe pas de
  token « succès ») ; `destructive` bordure 2 px pour un résumé d'erreurs ; encart `warning` pour un
  avertissement.
- `input`, `label`, `form` — libellé au-dessus, toujours visible ; « Facultatif » écrit, jamais
  d'astérisque.
- `button` — `default` (un seul par écran), `outline`, `link`. Tailles `default` 48 px, `lg` 56 px ;
  **jamais `sm` côté membre**. Libellé à l'infinitif explicite.
- `badge` — statut, jamais une action.
- `breadcrumb` — back-office, dès le 2ᵉ niveau.
- `skeleton` — listes uniquement, jamais un formulaire.
- `<AssociationMark />` — logo ou monogramme + nom, dans l'en-tête de l'espace membre.

### Do / Don't

- ✅ Le mot porte l'information ; la couleur ne fait que renforcer.
- ✅ Un message dit ce qui a eu lieu, ce qui est conservé, et l'action suivante.
- ✅ Une seule action attendue par écran, en `default` ; le reste en `outline`.
- ✅ Vouvoiement, phrases courtes, typographie française (espace insécable avant `: ; ! ?`,
  guillemets « »).
- ❌ `tabs` ou `sidebar` côté membre ; densité de tableau de bord SaaS.
- ❌ Information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ L'accent de l'association sur un bouton ou comme unique porteur d'un statut.
- ❌ Jargon : « lien magique », « token », « OTP », « session », « authentification ».
- ❌ Toute version sombre (ADR 033).

**N'inventez aucun composant, token ou couleur hors de cette liste.** Un besoin non couvert se note
en marge (« MANQUE »), il ne se comble pas.

## Hors périmètre

- L'**envoi** d'une invitation ou d'un email au propriétaire (s15, s42) : ouvrir un compte n'envoie
  rien.
- L'import de la liste des propriétaires (s13), la désignation des rôles du bureau (s14).
- Le changement d'adresse par le propriétaire lui-même (s16) : il pourra la modifier, jamais la
  supprimer.
- La liste des propriétaires, le rattachement d'une parcelle, l'enregistrement d'une vente : inchangés
  depuis s12.
- L'en-tête de l'espace membre (s46) et les écrans de connexion autres que l'état `D`.
- Toute version sombre.

## Livrable attendu

Une maquette HTML statique (basse fidélité acceptée) avec, pour chaque état listé (`A1`…`D2`), une
planche **desktop** et une planche **mobile 390 px**, en n'utilisant que les tokens ci-dessus. Chaque
planche porte sa puce (`A3`, `C2`…). Les écarts au brief sont signalés en marge (« ÉCART »), les
manques du design system aussi (« MANQUE »). L'export sera enregistré sous
`docs/designs/s12d-comptes-membres.html`.
