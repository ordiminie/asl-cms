# Design — Story s14-attribuer-roles

> Conçu le 2026-10-23, chemin **Claude Design** : brief `docs/designs/s14-attribuer-roles-brief.md`,
> livraison validée par Marie-Ève le 2026-10-27 (export `S14 role assignment mockup-handoff.zip`,
> fichier `S14 Attribuer les rôles.dc.html`), puis figée ici. Canevas :
> `https://claude.ai/design/p/6a97eff5-4b7e-4bf6-b796-bb37fb61057d?file=S14+Attribuer+les+r%C3%B4les.dc.html`.
> Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s14-attribuer-roles.md`.
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). Aucune version sombre
> n'a été dessinée, volontairement.

## Périmètre du design

Deux écrans, chacun en **ordinateur (1 280 px) et mobile (390 px)**. Données fictives : association
« Clos-Fleuri » (monogramme « CF », teinte 195) ; Hélène Roux (Président(e)), Paul Vidal (Bureau),
Lucie Moreau (Membre), Marc Fabre (courrier uniquement), Jeanne Petit (fiche incomplète).

| Écran | Route                        | États    |
| ----- | ---------------------------- | -------- |
| A     | `/bureau/proprietaires/{id}` | A1 à A12 |
| B     | `/bureau/proprietaires`      | B1, B2   |

**Arbitrages de produit du 2026-10-23** (détail dans le brief) :

- trois rôles : **Membre**, **Bureau**, **Président(e)** ; le SuperAdmin n'apparaît jamais ;
- **une seule Président(e)** ; le Bureau ne peut ni retirer ni attribuer la présidence ;
- **passation par la Président(e) seule**, depuis la fiche du successeur ; elle redevient Bureau ;
- **effet immédiat** : les messages disent « dès maintenant », jamais « à la prochaine connexion » ;
- **trace stockée, sans écran** ;
- comptes du bureau sans fiche : on leur crée une fiche avec leur adresse (formulaire existant).

## Screen(s)

### Écran A — Fiche d'un propriétaire : carte « Rôle dans l'association »

Fiche existante (s12, s12d), coquille du back-office inchangée. Une **quatrième carte** « Rôle dans
l'association » s'insère **juste après** « Accès à l'espace membre », avant « Parcelles ». Carte sans
icône (`Lock` reste réservé au personnel).

**En lecture** : une phrase toujours écrite (`body-strong` pour le rôle, puis `body`), jamais un
badge seul :

- Membre : « **Membre.** {nom} accède à son espace personnel. »
- Bureau : « **Bureau.** {nom} gère le site de l'association avec le reste du bureau. »
- Président(e) : « **Président(e).** {nom} gère le site de l'association et peut transmettre la
  présidence. »
- fiche sans compte (A11) : « Aucun rôle possible : ajoutez d'abord une adresse email pour lui ouvrir
  un compte. » — pas de bouton.

Puis le bouton `outline` « Modifier le rôle » quand la personne connectée y a droit. Sinon, une phrase
en `meta` et **aucun bouton** :

- un membre du Bureau sur la fiche de la Président(e) (A5, A8) : « Seul(e) la Président(e) peut
  transmettre la présidence. »
- la Président(e) sur sa propre fiche : « Pour transmettre la présidence, ouvrez la fiche de la
  personne qui vous succède. »

**En modification** (en place, même patron que les Coordonnées, pas de `dialog`) : un `radio-group`
« Rôle », une option par ligne (libellé + aide en `meta`), puis « Enregistrer le rôle » (`default`)
et « Annuler » (`outline`).

- Bureau qui modifie une fiche Membre ou Bureau : « Membre — Accède à son espace personnel. » et
  « Bureau — Gère le site de l'association. »
- Président(e) : les deux mêmes, plus « Président(e) — Vous lui transmettez la présidence. » (A6).
- Choix égal au rôle enregistré : pas d'encart ; « Enregistrer le rôle » reste actif et n'écrit rien.

**Avertissement avant l'enregistrement** (encart `warning` sous le `radio-group`, `AlertTriangle` +
« Attention. », dès que le choix diffère du rôle enregistré) :

- vers Bureau (A2) : « Attention. {nom} pourra gérer tout le site de l'association dès maintenant :
  pages, actualités, propriétaires. »
- vers Membre (A4) : « Attention. {nom} ne pourra plus gérer le site de l'association dès maintenant.
  Son espace personnel reste ouvert. »
- vers Membre sur sa propre fiche (A9) : « Attention. Vous ne pourrez plus gérer le site de
  l'association dès l'enregistrement. Votre espace personnel reste ouvert. »

**Passation** (A7) : « Président(e) » + « Enregistrer le rôle » ouvre un `alert-dialog` (seul acte
sans retour pour la Président(e)) : titre « Transmettre la présidence à {nom} ? », texte « {nom}
devient Président(e) dès maintenant. Vous redevenez membre du bureau. Vous ne pourrez pas reprendre
la présidence vous-même : seul(e) {nom} pourra la transmettre à nouveau. », boutons « Transmettre la
présidence » (`default`) et « Annuler » (`outline`). Sur mobile, ancré en bas, pleine largeur,
boutons empilés. Pas d'encart `warning` en plus : le dialogue porte l'avertissement.

**Refus — dernier compte capable** (A10 ; association sans Président(e), un seul compte Bureau) :
résumé d'erreurs `alert` `destructive` (filet 2 px, `AlertTriangle`, `role="alert"`) en haut de la
carte ; le formulaire reste ouvert, choix et encart conservés.

- sur la fiche d'un autre : « {nom} est le dernier compte qui peut désigner le bureau de
  l'association. Désignez d'abord une autre personne au bureau. Rien n'a été enregistré. »
- **sur sa propre fiche** (le cas dessiné) : « Votre compte est le dernier qui peut désigner le
  bureau de l'association. Désignez d'abord une autre personne au bureau. Rien n'a été enregistré. »
  (formulation retenue ici pour le MANQUE relevé par le canevas, sans marque de genre).

**Confirmations** (`alert` neutre en haut de la fiche, `role="status"`, `CircleCheck` `primary`),
titre « Rôle enregistré. » puis :

- vers Bureau (A3) : « {nom} fait maintenant partie du bureau et peut gérer le site de l'association
  dès maintenant. » (reformulé sans pronom : le produit ne connaît pas le genre) ;
- vers Membre : « {nom} ne fait plus partie du bureau. Son espace personnel reste ouvert. » (non
  dessiné, même patron que A3) ;
- passation (A8) : « {nom} est maintenant Président(e). Vous restez membre du bureau. » ; la
  personne qui a transmis voit ensuite la carte comme un membre du Bureau (A5).

Après un changement, la carte « Accès à l'espace membre » suit le rôle (mention « Membre du bureau :
son adresse peut être modifiée, pas supprimée. », règle de s12d).

**Sa propre rétrogradation** (A12) : après l'enregistrement, redirection vers l'espace personnel
(`/dashboard`) avec, en haut, un `alert` neutre « Vous ne faites plus partie du bureau. » + « Votre
espace personnel reste ouvert. ».

### Écran B — Liste des propriétaires : badge de rôle

Liste existante. À côté du nom, un `badge` « Bureau » ou « Président(e) » pour les fiches dont le
compte a ce rôle ; rien pour un Membre. Le badge est un statut, jamais une action. Sur mobile (B2), le
badge passe sous le nom.

## Mockup

`docs/designs/s14-attribuer-roles.html` — référence visuelle, figée depuis l'export du canevas (moteur
`support.js` retiré, données déroulées). **Ne pas copier en production** : l'exécution construit
l'écran avec les vrais composants (`card`, `radio-group`, `alert`, `alert-dialog`, `button`,
`badge`).

## Reused components (from the design system)

- `card` — carte « Rôle dans l'association », comme les trois cartes existantes de la fiche.
- `radio-group` — 2 ou 3 rôles, jamais de `select`.
- `alert` — confirmations neutres (`CircleCheck`), résumé d'erreurs `destructive`, encart `warning`
  avant l'écriture.
- `alert-dialog` — passation de la présidence uniquement (acte sans retour).
- `button` — « Modifier le rôle » (`outline`), « Enregistrer le rôle » (`default`), « Annuler »
  (`outline`), « Transmettre la présidence » (`default` du dialogue).
- `badge` — rôle dans la liste des propriétaires.
- `MemberSpaceAccessDenied` / espace personnel (s12d) — inchangés, destination d'une
  auto-rétrogradation.

## States

- **Lecture** : A1 (Membre), A5 (Président(e) vue par le Bureau), A8 (après passation), A11 (sans
  compte).
- **Modification** : A2, A4, A6, A9 (avertissements), A7 (passation).
- **Succès** : A3 (vers Bureau), A8 (passation), A12 (auto-rétrogradation).
- **Erreur** : A10 (dernier compte capable).
- **Chargement** : sans objet (carte rendue avec la fiche, l'enregistrement suit le patron des
  Coordonnées : bouton désactivé pendant l'envoi).
- **Liste** : B1, B2.

## Design system gaps

Relevés par le canevas (« MANQUE ») et à trancher au plan, **pas** comblés ici :

1. **Badge de rôle** : le design system n'a qu'une variante de `badge` décrite ; le canevas propose
   rôle en contour `primary`, état (« Courrier uniquement ») en fond `secondary`. À valider avec les
   variantes existantes du composant, sans couleur nouvelle.
2. **Icône de la carte « Rôle »** : aucune icône définie ; carte sans icône (`Lock` reste réservé au
   personnel).
3. **Encart `warning` pour le choix « Président(e) »** : non prévu ; l'`alert-dialog` en tient lieu
   (retenu).
4. **Refus du dernier compte à la 2ᵉ personne** : texte écrit ci-dessus (« Votre compte est le
   dernier… »), à reprendre dans `messages/fr.json`.
5. **Genre** : « Président(e) » et « Seul(e) » faute de donnée de genre — manque déjà noté en s12d.

Écart signalé par le canevas (« ÉCART »), accepté : la confirmation vers Bureau est reformulée sans
« Il » (A3).
