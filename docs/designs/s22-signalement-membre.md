# Design — Story s22-signalement-membre

Canvas Claude Design : https://claude.ai/design/p/1f43501f-86a0-4207-9240-c2d35a88bdc7?file=docs%2Fdesigns%2Fs22-signalement-membre.dc.html
Brief : `docs/designs/s22-signalement-membre-brief.md` — maquette reçue et normalisée le 09/11/2026.
Thème clair seul (ADR 033, qui remplace l'ADR 012) : aucune version sombre n'est produite ni attendue.

## Screen(s)

Trois écrans, chacun en **desktop (1 280 px)** et **mobile (390 px)**, mêmes contenus, mêmes états.

### A — Espace membre : carte « Mes signalements » (`/dashboard`)

- Carte `h2` serif 20 px, **entre « Mes coordonnées » et « Sécurité du compte »**. Pas d'icône de carte.
- Liste, **plus récent d'abord**, tous les signalements, sans pagination. Lignes séparées par un filet
  1 px `border` (pas de tableau). Chaque ligne : catégorie (`body-strong`, « Sans catégorie » si absente),
  lieu tronqué sur une ligne, « Envoyé le » `jj/mm/aaaa` en `data`, « Mis à jour le » **seulement si le
  statut a changé**, badge de statut (§3.10) à droite sur desktop, sous le bloc sur mobile.
- Bouton `outline` « Signaler une fuite ou un incident » sous la liste (ou sous le texte d'invitation
  quand elle est vide). **Aucun bouton `default`** sur cet écran. Mobile : 56 px, pleine largeur.
- Pas de page de détail, d'historique ni de commentaire.

### B — Déclarer : « Signaler une fuite ou un incident » (page dédiée de l'espace membre)

- Colonne `max-w-[68ch]` : lien « Revenir à mon espace » (`ArrowLeft`), `h1`, `alert` neutre du 112
  (texte et icône repris de s10), puis `card` avec **De quoi s'agit-il ?** (`select`, « Choisissez… »),
  **Où ?** (`input` + aide avec exemples), **Que se passe-t-il ?** (`textarea`, 144 px mini).
- **Aucun champ nom, email ou téléphone.** Un bloc texte, séparé par un filet, entre les champs et les
  boutons : « Le bureau saura que c'est vous : nous lui transmettons votre nom, votre adresse email et
  votre téléphone. » puis les valeurs de la fiche en `meta` (`Lucie Moreau · lucie.moreau@exemple.fr ·
  06 12 34 56 78`).
- Un seul bouton `default` « Envoyer le signalement » ; « Annuler » en `outline`. Desktop : côte à côte,
  48 px. Mobile : empilés, 56 px, « Envoyer » en premier.
- Succès : retour sur l'écran A (état A5). Rien n'est montré sur l'envoi de l'email au bureau.

### C — Bureau : déclarant d'un signalement de membre (extension de la file et du détail livrés en s10)

- File `/bureau/signalements` : colonne « Signalé par » inchangée ; pour un membre, nom puis
  « Membre · » + email (ou téléphone s'il n'a que lui). **Texte seul** : ni badge, ni icône, ni couleur.
- Détail : la section **Coordonnées** ajoute, sous le nom, « Membre de l'association » ; liens `mailto:`
  et `tel:` conservés. Signalements publics inchangés (« Aucune coordonnée laissée »).
- Email `email.report.notification` : aucune planche. Les lignes « Déclarant », « Email », « Téléphone »
  portent l'identité de la fiche au lieu de « non renseigné ».
- Sous 640 px, la file passe en cartes empilées (une ligne = une carte).

## Mockup

`docs/designs/s22-signalement-membre.html` — référence visuelle, **26 planches** (13 états × desktop et
mobile), chacune avec sa puce. DO NOT copy into production : Execute builds with the real components.
Fichier aplati depuis l'export du canvas (le runtime du canvas est retiré) ; il charge les polices
depuis Google Fonts, comme les autres maquettes.

| Puce | Écran | État |
| ---- | ----- | ---- |
| A1 | Espace membre | Trois signalements, un par statut (un avec « Mis à jour le », un sans) |
| A2 | Espace membre | Carte vide + bouton |
| A3 | Espace membre | Chargement (`skeleton`) — le bouton reste visible |
| A4 | Espace membre | Espace complet, place de la carte |
| A5 | Espace membre | Après envoi : `alert` de succès, nouveau signalement en tête, statut « Signalé » |
| B1 | Déclarer | Formulaire vierge + bloc « Ce que le bureau reçoit » |
| B2 | Déclarer | Erreurs de saisie (catégorie, lieu), valeurs conservées |
| B3 | Déclarer | Envoi en cours, largeur du bouton conservée |
| B4 | Déclarer | Échec technique, texte conservé |
| B5 | Déclarer | Association sans catégorie : le champ disparaît, le formulaire commence par « Où ? » |
| B6 | Déclarer | Téléphone absent de la fiche : « téléphone non renseigné » + « Ajouter mon téléphone » |
| C1 | Bureau | File : un signalement de membre entre deux signalements publics |
| C2 | Bureau | Détail d'un signalement de membre, statut « Signalé », « Passer en cours » |

## Reused components (from the design system)

- `card` — carte « Mes signalements », carte du formulaire ; bordure 1 px, sans ombre.
- `badge` — statuts « Signalé » / « En cours » / « Résolu », tels quels (§3.10) ; jamais rouge.
- `alert` — neutre avec `CircleCheck` `primary` (succès, A5) ; neutre du 112 ; `destructive` bordure 2 px
  (résumé d'erreurs B2, échec B4).
- `button` — `outline` (A, Annuler) ; `default` unique en B (« Envoyer le signalement ») ; `link`
  (« Revenir à mon espace », « Ajouter mon téléphone »). Tailles `default` 48 px / `lg` 56 px, jamais `sm`.
- `form`, `label`, `input`, `textarea`, `select` — repris du formulaire public s10.
- `skeleton` — A3 seulement (liste), jamais le formulaire.
- `table` — côté bureau (C1), cartes empilées sous 640 px.
- Lien « Revenir à mon espace » — §3.12 (s46) ; en-tête de l'espace membre inchangé.
- Icônes : `ArrowLeft`, `AlertTriangle`, `CircleCheck`, `Lock` (marqueur existant). Aucune icône « signalement ».

## States

- **A** : liste (A1, A5) · vide (A2) · chargement (A3) · succès au retour (A5).
- **B** : vierge (B1) · erreurs de saisie (B2) · envoi (B3) · échec technique (B4) · sans catégorie (B5) ·
  téléphone absent (B6).
- **C** : file (C1) · détail (C2).

Décisions de la maquette à reprendre au plan (notes HYPOTHÈSE du canvas, non contradictoires avec le brief) :

- Le lieu est tronqué en une ligne ; catégorie et statut ne le sont jamais.
- En A3, le bouton « Signaler… » reste visible : signaler ne dépend pas de la liste.
- L'`alert` de succès de A5 s'affiche une fois, au retour ; elle disparaît au prochain chargement.
- B1 : le bloc « Ce que le bureau reçoit » est entre les champs et les boutons, pour être lu avant l'envoi.
- B2 et B4 : l'alerte est ancrée en tête du formulaire ; messages de validation, aide de « Où ? » et texte
  du 112 **copiés mot pour mot de s10**.
- B6 : la phrase est adaptée (« votre nom et votre adresse email ») pour ne pas annoncer un téléphone
  absent ; « Ajouter mon téléphone » mène à l'ancre `#mes-coordonnees`.
- L'en-tête bureau, le lien de retour et « Étape actuelle » (C2) : écrans déjà livrés, esquissés seulement.

## Arbitrages de la V1 (validés le 09/11/2026, non rouverts)

1. Pas de détail ni d'historique pour le membre : statut courant et deux dates.
2. Le membre ne peut ni modifier, ni compléter, ni retirer un signalement envoyé.
3. Aucun repère visuel propre aux signalements de membres côté bureau (texte « Membre » seulement).
4. Aucune limite d'envois affichée au membre connecté.
5. Compte connecté sans fiche dans l'association : aucune carte « Mes signalements » ; non dessiné.
6. Tous les signalements affichés, sans plafond ni pagination.

Hors périmètre : formulaire public `/signaler`, détail, historique, commentaires, photo, géolocalisation,
réouverture, numéro de dossier, notification du membre au changement de statut, autres cartes de
l'espace membre, imitation de compte (s48), toute version sombre.

## Design system gaps

Aucun composant ni token inventé. Un point à trancher, hors invention :

- **MANQUE — état désactivé du bouton (B3).** Le design system n'a pas de token « désactivé ». La maquette
  reprend l'opacité du composant `button` (`disabled`) telle quelle et tient la largeur en superposant les
  deux libellés (« Envoyer le signalement » / « Envoi en cours… »). À confirmer au
  plan : réutiliser l'état `disabled` existant du composant, sans nouveau token.

## Validation

Maquette validée par Marie-Ève sur le canvas le 09/11/2026 (zip `docs/designs/s22.zip` fourni, export
Claude Design). Le zip reste non versionné, comme pour s42 (#60) : à ne pas committer.
