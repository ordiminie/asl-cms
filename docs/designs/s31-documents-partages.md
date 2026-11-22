# Design — Story s31-documents-partages

> Conçu le 2026-11-22, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s31-documents-partages.md`.
> Écrans d'ancrage : s46/s12d (coquille de l'espace membre, §3.12), s19/s20 (carte « Mes factures »,
> bouton de téléchargement par ligne, §3.15), s09 (dépôt d'un PDF et suppression par `alert-dialog`),
> s23 (écran générique des catégories).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du
> conteneur, comme pour s19 et s53) ; contrôle en lecture seule à la place : aucune couleur hors des
> tokens de `:root` (chaque `oklch` est une déclaration de token du §1.1/§1.9, `--overlay` compris),
> aucune valeur hex ni rgb, marges dans l'échelle 4/8/12/16/24/32/48/64, six planches en deux versions
> chacune (ordinateur et mobile 390 px, par requêtes de conteneur sous 640 px).

## Périmètre du design

Trois écrans, chacun en **ordinateur (1 280 px) et mobile (390 px)**. Données fictives : association
« Clos-Fleuri » (CF, teinte 195) ; catégories de seed « Statuts », « Procès-verbaux », « Ordres du
jour ».

| Écran | Route                                                       | États   |
| ----- | ----------------------------------------------------------- | ------- |
| 1     | `/dashboard` — carte « Documents de l'association »         | 1a à 1c |
| 2     | `/bureau/documents` — liste du bureau                       | 2a à 2d |
| 3     | `/bureau/documents/nouveau` — déposer un document           | 3a à 3d |
| —     | `/bureau/documents/categories` — **pas de planche** (s23)   | —       |

**Non dessiné**, parce que la story ne le demande pas : modification d'un document déposé (on retire
puis on redépose), documents nominatifs (s32), publication après l'AG et son email (s34), visionneuse
PDF intégrée (manque §9 « prévisualisation PDF paginée »), page publique des documents (le critère 3
l'interdit).

## Screen(s)

### Écran 1 — Espace membre : « Documents de l'association » (`/dashboard`)

Carte de la coquille s46, rendue **dans les trois états** de l'espace (fiche avec parcelles, fiche
sans parcelle, compte sans fiche) : le critère 2 vise **tout** membre authentifié de l'association.
Placée après « Mes factures » quand elle est rendue, sinon après « Mes coordonnées » ; pour un compte
sans fiche, sous le texte de s46. Lue derrière son propre `<Suspense>`.

- Titre `h2` serif 20 px « Documents de l'association » ; `meta` « Les statuts, procès-verbaux et
  ordres du jour publiés par le bureau. »
- **Groupée par catégorie** (`h3` 17 px / 600), catégories dans l'ordre alphabétique, documents du plus
  récent au plus ancien dans chaque catégorie. Volumétrie : quelques documents par an, aucune
  pagination.
- Ligne : icône `FileText` (vocabulaire figé §1.7), **titre écrit par le bureau** (jamais le nom du
  fichier, §4), puis `meta` « Déposé le `jj/mm/aaaa` · PDF · `poids` » (`data` pour la date et le
  poids). Le poids est annoncé (§4).
- **Une seule action par ligne** : `outline` « Télécharger » (icône `Download` 20 px, nom accessible
  complet : « Télécharger « Statuts de l'ASL » (PDF, 620 Ko) »). Sous 640 px, pleine largeur, 56 px.
  C'est un lien vers la **route authentifiée par identifiant** (`/api/documents/{id}`), jamais vers un
  chemin de stockage.
- Pied de carte : « Un document vous manque ? Écrivez au bureau depuis la page Contact. »

### Écran 2 — Bureau : « Documents » (`/bureau/documents`)

Entrée « Documents » dans le groupe « Association » de la barre du bureau (`NAV_GROUPS`), sous
l'action de gestion du registre ; sinon `BureauAccessDenied`.

- `h1` « Documents », `meta` « Les documents partagés avec tous les membres de l'association, dans
  leur espace. »
- Barre : lien « Gérer les catégories » et `default` « Déposer un document » (icône `Upload`) — le seul
  `default` de l'écran.
- Tableau (§2.1, §3.5) du plus récent au plus ancien : **Titre** (lien de téléchargement, même route) ·
  **Catégorie** · **Déposé le** (`data`) · **Poids** (`data`) · action. **Une seule action par ligne** :
  `outline` « Retirer ». Sous 640 px : cartes empilées, titre en tête, paires, « Retirer » pleine
  largeur 56 px.
- **2c — retrait** : `alert-dialog` (irréversible), voile `--overlay` : « Retirer « {titre} » ? Il
  disparaît de l'espace des membres et son adresse cesse de servir le fichier. Le fichier est effacé :
  pour le remettre, il faudra le déposer à nouveau. » Boutons `outline` « Annuler » et `destructive`
  « Retirer le document » (le bouton nomme l'acte). Sous 640 px, ancré en bas, boutons empilés.
- **2d — succès** (ancré, `alert` neutre + `CircleCheck` `primary`, §3.2) : après un dépôt, « Document
  déposé. « {titre} » est visible dès maintenant dans l'espace des membres, carte « Documents de
  l'association ». » ; après un retrait, « Document retiré. Il n'apparaît plus dans l'espace des
  membres et son adresse ne sert plus le fichier. »

### Écran 3 — Bureau : « Déposer un document » (`/bureau/documents/nouveau`)

Trois champs : une **page**, pas un `dialog` (§3.11, `dialog` ≤ 2 champs). Fil d'Ariane « Documents ›
Déposer un document ».

1. **Titre** (`input`) — aide « Le titre que lisent les membres, par exemple « Procès-verbal de l'AG du
   14 juin 2025 ». » Plafond de longueur à fixer au plan, avec compteur si le plafond est affiché (§3.1).
2. **Catégorie** (`select`) — les catégories **actives** du domaine `document` de l'association.
3. **Fichier** (`file-upload`) — « PDF uniquement, 10 Mo au plus. » annoncé **avant** l'échec ; pas de
   zone de dépôt au tactile (§2.1). Le plafond écrit est celui réellement appliqué.

- Actions : `default` « Déposer le document », `outline` « Annuler » (empilés 56 px en mobile, le
  principal en premier).
- **3b — erreurs** : résumé ancré `destructive` 2 px, `role="alert"`, « Le document n'a pas été
  déposé. Rien n'est perdu. », liens d'ancrage vers les champs, message sous chaque champ (« Saisissez
  un titre… », « Choisissez une catégorie. », « Ce fichier n'est pas un PDF. Enregistrez le document en
  PDF puis déposez-le à nouveau. », « Ce fichier pèse 14,2 Mo : le plafond est de 10 Mo. »).
- **3c — aucune catégorie active** : le formulaire n'est pas proposé ; `alert` neutre `muted` + `Info`
  « Aucune catégorie de document. Un document se range dans une catégorie. Créez-en une d'abord, par
  exemple « Statuts ». → Gérer les catégories ».
- **3d — dépôt en cours** : `progress` **indéterminée** + « Envoi de {nom du fichier} » (§2.1) ; bouton
  désactivé, libellé « Dépôt en cours… », largeur conservée.
- Succès : retour sur `/bureau/documents` avec l'alerte 2d.

### Catégories (`/bureau/documents/categories`)

Pas de planche : c'est l'écran générique `ReportCategoriesManager` de s10/s23, paramétré pour le
domaine `document` (libellés propres, lien de retour vers `/bureau/documents`, plafond de 10). Le
champ « adresse de routage » de cet écran n'a pas de sens pour un document : à masquer par paramètre
du composant ou à laisser hors de l'écran — voir manque n° 1.

## Mockup

`docs/designs/s31-documents-partages.html` — visual reference. DO NOT copy into production: Execute
builds with the real components. Six planches (1a, 1b/1c, 2a/2d, 2b/2c, 3a/3b, 3c/3d), chacune en cadre
ordinateur puis cadre mobile 390 px.

## Reused components (from the design system)

- En-tête de l'espace membre (§3.12) — inchangé.
- `card` — carte membre, liste et formulaire du bureau.
- `table` + cartes empilées sous 640 px (§3.5).
- `button` `default` / `outline` / `destructive` (48 px ; 56 px pleine largeur sur mobile).
- `input`, `select`, `label`, aide en `muted-foreground`, `file-upload`, `progress` indéterminée.
- `alert` — succès neutre `CircleCheck`, neutre `muted` + `Info`, résumé d'erreurs `destructive` 2 px.
- `alert-dialog` — retrait, voile `--overlay` (§1.9).
- `skeleton` — chargement de la carte membre (listes uniquement).
- `sidebar` du bureau — nouvelle entrée « Documents ».
- `ReportCategoriesManager` (s10/s23) — catégories du domaine `document`.
- Icônes du vocabulaire figé (§1.7) : `FileText` document, `Download`, `Upload`, `Info`,
  `CircleCheck`, `AlertTriangle`.
- Typographie `data` (JetBrains Mono, `tabular-nums`) : dates et poids.

## States

- **Carte membre (1)** : liste groupée (1a) · vide (1b, « Aucun document publié pour l'instant… » +
  écrire au bureau) · chargement (1c, trois lignes `skeleton`, `aria-busy`) · erreur : page d'erreur
  existante de l'espace membre · lien d'un document retiré entre-temps : la route rend 404, la page
  d'erreur générique du navigateur — voir manque n° 2.
- **Liste du bureau (2)** : liste (2a) · vide (2b, avec « Déposer un document ») · confirmation du
  retrait (2c) · succès du dépôt ou du retrait (2d) · non autorisé : `BureauAccessDenied`.
- **Dépôt (3)** : au repos (3a) · erreurs (3b) · aucune catégorie (3c) · en cours (3d) · succès : retour
  à la liste (2d).

## Design system gaps

1. **Écran des catégories sans adresse de routage** — `ReportCategoriesManager` porte un champ
   « adresse de routage » propre aux signalements et aux questions. Pour les documents, il n'a pas
   d'usage. Proposition : un paramètre du composant qui masque le champ (aucun composant nouveau). À
   trancher au plan.
2. **Téléchargement d'un document retiré entre-temps** — la route rend un 404 nu ; le navigateur
   affiche sa page d'erreur. Aucune forme n'existe pour « ce document n'est plus disponible » hors de
   la page. Acceptable en V1 (le cas est rare : la page se recharge après un retrait) ; à noter, non
   comblé ici.
