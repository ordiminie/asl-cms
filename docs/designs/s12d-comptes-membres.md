# Design — Story s12d-comptes-membres

> Conçu le 2026-10-20, chemin **Claude Design** : brief `docs/designs/s12d-comptes-membres-brief.md`,
> livraison validée par Marie-Ève le 2026-10-20 (export `s12d Comptes membres.dc.html.zip`, fichier
> `s12d Comptes membres.dc.html`), puis reportée ici. Canevas :
> `https://claude.ai/design/p/da1e8ea8-708e-4b80-af57-b7b9d0348e3a?file=s12d+Comptes+membres.dc.html`.
> Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s12d-comptes-membres.md`.
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). Aucune version sombre
> n'a été dessinée, volontairement.

## Périmètre du design

Quatre écrans, chacun en **ordinateur (1 280 px) et mobile (390 px)**. Données fictives : association
« Clos-Fleuri » (monogramme « CF », teinte 195), propriétaires Bernard Lefèvre, Robert Chassagne,
Hélène Roux (membre du bureau), Lucie Moreau, Paul Vidal, Odile Marchand, Gérard Pommier.

| Écran | Route                                   | États                        |
| ----- | --------------------------------------- | ---------------------------- |
| A     | `/bureau/proprietaires/{id}`            | A1 à A10                     |
| B     | `/bureau/proprietaires/nouveau` → fiche | B1, B2, aide du champ        |
| C     | `/dashboard`                            | C1 à C5, chargement          |
| D     | `/login`                                | D1 (ordinateur), D2 (mobile) |

Rappel des arbitrages du 2026-10-20 (détail dans le brief) : l'accès à l'espace se pilote **par
l'adresse email de la fiche** ; la changer ferme l'ancien accès et en ouvre un sur la nouvelle ; la
vider ferme l'accès ; un membre du bureau ou la présidence garde une adresse (modifiable, jamais
supprimable) et son rôle suit la nouvelle adresse ; seul le bureau supprime une adresse, le
propriétaire ne peut que modifier la sienne (écran en s16).

## Screen(s)

### Écran A — Fiche d'un propriétaire (back-office)

Coquille du back-office existante (barre latérale, tiroir « Menu » sur mobile), colonne de 800 px.
Fil d'Ariane « Propriétaires › {nom} », `h1` {nom}, badge « Courrier uniquement » si la fiche n'a pas
d'adresse. Trois cartes empilées (24 px) :

1. **Coordonnées** (existante, s12) — en lecture : adresse postale, téléphone, adresse email
   (`font-mono`, ou « Non renseignée » en `muted-foreground`) et bouton `outline` « Modifier les
   coordonnées ». En modification : les trois champs, « Enregistrer les coordonnées » (`default`) et
   « Annuler » (`outline`), empilés pleine largeur sur mobile (56 px).
2. **Accès à l'espace membre** (nouvelle) — icône `Lock` 20 px, **aucune action** :
   - « **Compte ouvert.** {nom} peut se connecter à son espace avec {adresse}. »
   - « **Joignable par courrier uniquement.** Aucun compte : ajoutez une adresse email pour lui ouvrir
     son espace. »
   - membre du bureau, en `meta` 15 px : « Membre du bureau : son adresse peut être modifiée, pas
     supprimée. » (« Présidente » / « Président » selon le rôle).
   - Elle montre toujours **l'état enregistré**, même pendant une modification non validée.
3. **Parcelles** (existante, s12, non redessinée).

**Avertissements pendant la modification**, palette `warning`, icône `AlertTriangle`, **sous le champ
email, avant l'enregistrement** (pas d'`alert-dialog` : l'acte est réversible) :

- adresse vidée (A3) : « **Attention.** Sans adresse email, {nom} ne pourra plus se connecter à son
  espace. Sa fiche, ses parcelles et son historique sont conservés. Il recevra les envois par
  courrier. »
- adresse remplacée (A6, A10) : « **Attention.** {nom} ne pourra plus se connecter avec {ancienne}.
  Son espace s'ouvrira avec {nouvelle}. » + pour le bureau « Son rôle au bureau suit la nouvelle
  adresse. »

**Refus pour un membre du bureau** (A9), à l'enregistrement d'une adresse vide : résumé d'erreurs
`role="alert"` en haut de la carte (filet 2 px `destructive`, icône `AlertTriangle`) « {nom} fait
partie du bureau : son adresse lui sert à se connecter. Vous pouvez la modifier, pas la supprimer.
Rien n'a été enregistré. » + champ en erreur et message sous le champ « Saisissez une adresse email :
celle d'un membre du bureau ne peut pas être supprimée. » Pas de « Facultatif » sur l'adresse d'un
membre du bureau.

**Confirmations** (`role="status"`, icône `CircleCheck`, en haut de la fiche), titre « Coordonnées
enregistrées. » puis :

- retrait (A4) : « Accès à l'espace fermé. »
- ajout (A5) : « Compte ouvert : {nom} peut désormais se connecter avec {adresse}. »
- remplacement (A7) : « {nom} se connecte désormais avec {nouvelle}. L'accès avec {ancienne} est
  fermé. »

Aucun message ne laisse croire qu'un email est parti, et une adresse déjà connue dans une autre
association donne **exactement** le même message (A5) : rien n'est révélé.

### Écran B — Ajouter un propriétaire : confirmation

La fiche qui s'ouvre après la création, avec le titre « Propriétaire enregistré. » :

- B1, avec adresse : « Compte ouvert : {nom} peut se connecter avec {adresse}. » ; carte « Accès » en
  « Compte ouvert ».
- B2, sans adresse : titre seul ; badge « Courrier uniquement », carte en « Joignable par courrier
  uniquement ».
- Formulaire d'ajout, seule retouche : l'aide du champ « Adresse email · Facultatif » devient « Avec
  une adresse, ce propriétaire peut se connecter à son espace. Sans adresse, il reçoit tout par
  courrier. » (placement : voir les écarts).

### Écran C — Espace membre : « Mes parcelles » (`/dashboard`)

Coquille s46 inchangée (`AssociationMark` + « Se déconnecter »), colonne `max-w-[1000px]`, 24 px
entre les blocs :

1. marqueur `Lock` 16 px + « **Espace personnel** » + `meta` « · Parcelles 12 et 13 » (« · Parcelle
   21 », « · Aucune parcelle actuelle ») ;
2. `h1` « Bonjour {nom} » (nom de la fiche) ;
3. `card` « **Mes parcelles** » :
   - C3 seulement : « Vous n'êtes plus propriétaire d'une parcelle du domaine depuis le {date}. » ;
   - « Parcelles actuelles » : lignes de 56 px séparées par un filet, icône `Map` 20 px, « Parcelle
     **12** » (numéro en `font-mono`), « Propriétaire depuis le 3 février 1998 » en
     `muted-foreground` ; passe à la ligne sur mobile ; **pas de tableau** ;
   - « Anciennes parcelles » : « Propriétaire du {début} au {fin} », la fin étant la **veille** de la
     vente ; ni acquéreur, ni action ;
   - pied de carte, sous un filet : « Une erreur ? Écrivez au bureau. » + lien « Page Contact » ;
4. `card` « Sécurité du compte » de s46, inchangée, **en dessous** (la maquette l'abrège : le texte de
   s46 reste).

États :

- **C4, accès refusé** à la fiche d'un autre : `h1` « Cette page ne vous est pas accessible », « Elle
  concerne un autre membre de l'association. », bouton `default` `ArrowLeft` « Revenir à mon espace ».
  Ni nom, ni parcelle, ni code d'erreur, ni marqueur, ni carte Sécurité.
- **C5, compte sans fiche** dans cette association (SuperAdmin, compte venu d'une autre association) :
  page s46 actuelle, `h1` « Votre espace membre » + carte Sécurité.
- **Chargement** : `h1` « Bonjour {nom} », carte « Mes parcelles » en `skeleton` (deux lignes de
  56 px, `aria-busy`), marqueur masqué.

### Écran D — Connexion après fermeture de l'accès (`/login`)

Page de connexion existante (colonne 480 px), avec au-dessus du formulaire un encadré **neutre**
`role="status"`, icône `Info` : « **Votre accès à l'espace de {association} est fermé.** » + « Pour le
rouvrir, écrivez au bureau. » + lien « Page Contact ». Même écran que la session ait été coupée ou
qu'un ancien lien de connexion ait été suivi. Le titre et le formulaire dessinés (« Connexion »,
« Recevoir un lien de connexion ») sont indicatifs : la page garde son contenu actuel.

## Mockup

`docs/designs/s12d-comptes-membres.html` — référence visuelle. DO NOT copy into production: Execute
builds with the real components. Figée depuis l'export du canevas : le moteur de rendu de Claude
Design (`support.js`) est retiré et les données du canevas sont déroulées dans le HTML (une ligne par
état : repère, planche 1 280 px, planche 390 px, notes en marge).

## Reused components (from the design system)

- coquille du back-office (`sidebar`, tiroir mobile), fil d'Ariane, `badge` « Courrier uniquement » —
  fiche existante (s12).
- `card` — Coordonnées, Accès à l'espace membre, Parcelles, Mes parcelles, Sécurité du compte.
- `input`, `label`, `form` — champ email, « Facultatif » écrit.
- `button` `default` / `outline` (48 px, 56 px pleine largeur sur mobile).
- `alert` — avertissements `warning`, résumé d'erreurs `destructive`, confirmations et encadré de
  connexion neutres.
- `skeleton` — chargement de « Mes parcelles ».
- `<AssociationMark />` et en-tête de l'espace membre (s46) ; lien souligné (`link`).
- Icônes lucide : `Lock`, `Map`, `AlertTriangle`, `CircleCheck`, `Info`, `ArrowLeft`, `Menu`.

## States

- **Fiche (A)** : lecture avec compte ouvert / courrier uniquement / membre du bureau ; modification
  avec avertissement (vidée, remplacée) ; refus (bureau, adresse vide) ; succès (retrait, ajout,
  remplacement). Erreur serveur : celle du formulaire existant.
- **Création (B)** : succès avec ou sans adresse.
- **Mes parcelles (C)** : chargement, parcelles actuelles, actuelles + anciennes, anciennes seules,
  accès refusé, sans fiche. Pas d'état vide distinct : un propriétaire a au moins une parcelle,
  actuelle ou ancienne ; sinon c'est C5.
- **Connexion (D)** : encadré présent après fermeture ; page inchangée sinon.

## Design system gaps

- **Accord du pronom** dans l'avertissement A3 (« Il recevra les envois par courrier ») : figé au
  masculin, aucune règle d'accord selon la personne. À reformuler sans pronom au plan (par exemple
  « Les envois partiront par courrier. »), plutôt que d'inventer une règle.
- **Élision devant le nom de l'association** (« l'espace de Clos-Fleuri » / « de l'Étang ») : non
  spécifiée. Même remède : une tournure qui l'évite, ou la règle à ajouter au design system.
- **Accord de « Président(e) »** dans la carte « Accès » (A, rôle `owner`) : le design prévoit
  « Présidente » / « Président » selon le rôle, mais le rôle `owner` ne porte aucune donnée de genre
  (ni la fiche, ni le compte). Libellé écrit « Président(e) : son adresse peut être modifiée, pas
  supprimée. » (`messages/fr.json`). Une donnée de genre ou une tournure neutre est à décider au
  design system (revue n° 1 de s12d, mineur 4).
- **Badge de rôle au bureau** : absent du design system ; le rôle n'apparaît qu'en `meta` dans la
  carte « Accès ».
- **Niveau de titre côté membre** : pas de niveau entre `h1` et `h3`. Titre de carte en `h2` à 20 px,
  sous-titres « Parcelles actuelles » / « Anciennes parcelles » en `h3` à 17 px / 600 (écart assumé,
  pour ne pas égaler le titre de carte).
- **Token du `skeleton`** : aucun ; `--muted` utilisé.
- **Aide du champ email** placée **entre le libellé et le champ** sur le canevas ; le design system
  (§ formulaires) la met **sous le champ**. À l'exécution, suivre le design system.
- Écarts propres à la maquette, sans effet sur l'implémentation : icônes lucide en trait 2 (fichiers
  statiques) au lieu de 1,75 ; contenu de la barre latérale du back-office indicatif ; carte
  « Parcelles » de la fiche et carte « Sécurité du compte » simplifiées.
