# Design — Story s32-documents-nominatifs

> Conçu le 2026-11-25, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s32-documents-nominatifs.md`.
> Écrans d'ancrage : s31 (carte de documents, dépôt d'un PDF, retrait par `alert-dialog`, catégories
> génériques — §3.18), s19/s20 (« Mes factures », terrain d'une ligne, carte « Factures » de la fiche —
> §3.15), s53 (vocabulaire « terrain », un compte pour plusieurs fiches), s12 (fiche d'un
> propriétaire), s26 (filtre de tableau, compteur — §3.13).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du
> conteneur, sortie 127, comme pour s19, s31 et s53) ; contrôle en lecture seule à la place : aucune
> couleur hors des tokens de `:root` (chaque `oklch` est une déclaration de token du §1.1/§1.9,
> `--overlay` et `--destructive-foreground` compris), aucune valeur hex ni rgb, marges et écarts dans
> l'échelle 4/8/12/16/24/32/48/64, onze planches en deux versions chacune (ordinateur et mobile
> 390 px, par requêtes de conteneur sous 640 px), noms de fichiers longs en `overflow-wrap: anywhere`.

## Périmètre du design

Cinq écrans, chacun en **ordinateur (1 280 px) et mobile (390 px)**. Données fictives : association
« Clos-Fleuri » (CF, teinte 195) ; Bernard Lefèvre, un compte relié à trois fiches (parcelles 12 et 13
sur le compteur 0045821 ; parcelle 27, compteur 0051207 ; parcelle 31 au nom de « SCI Les Pins ») ;
catégories de seed « Facture » et « Convocation » ; identifiants Pennylane fictifs `C1234`…

| Écran | Route (indicative, à fixer au plan)                         | États          |
| ----- | ----------------------------------------------------------- | -------------- |
| 1     | `/dashboard` — carte « Mes documents »                      | 1a à 1d        |
| 2     | `/bureau/proprietaires/{id}` — section « Documents »        | 2a à 2f        |
| 3     | `/bureau/proprietaires/{id}/documents/nouveau`              | 3a à 3d        |
| 4     | `/bureau/documents-nominatifs` — vue d'ensemble du bureau   | 4a à 4d        |
| 5     | `/bureau/documents-nominatifs/lot` — dépôt en lot + rapport | 5a à 5e        |
| —     | `/bureau/documents-nominatifs/categories` — **pas de planche** (s23/s31) | — |

**Non dessiné**, parce que la story ne le demande pas ou l'exclut : notification par email (exclue),
modification d'un document déposé (on retire puis on redépose, comme s31), déplacement d'un document
d'une fiche à une autre, visionneuse PDF intégrée (manque §9 « prévisualisation PDF paginée »),
conservation ou export du rapport de lot (ADR 047 : rapport éphémère), délai d'accès du vendeur
(s57), classement automatique (cimetière).

## Screen(s)

### Écran 1 — Espace membre : « Mes documents » (`/dashboard`)

Carte de la coquille s46, lue derrière son **propre `<Suspense>`**, placée **après « Mes factures »
et avant « Documents de l'association »** (s31). Rendue dans les états « complet » et « sans
parcelle » de `MemberSpace` ; **jamais** pour un compte sans fiche (il n'a pas de dossier). Le marqueur
« Espace personnel » (§3.4) est déjà en tête de l'écran.

- Titre `h2` serif 20 px « Mes documents » ; `meta` « Vos factures et convocations déposées par le
  bureau, pour vos {n} terrains. Vous seul les voyez. » (un terrain : « … déposées par le bureau. Vous
  seul les voyez. »). Les mots « factures et convocations » viennent des catégories de seed : au plan,
  préférer une phrase neutre (« Vos documents personnels déposés par le bureau… ») si les catégories
  changent — rien en dur (ADR 010).
- **Une seule liste** pour toutes les fiches du compte (critère 3), triée par **date du document**
  décroissante. Ni groupe par terrain ni onglets (§8 : densité côté membre) ; pagination selon la
  règle du tableau au-delà de 25 lignes (10 sous 640 px), comme « Mes factures ».
- Ligne (forme s31) : icône `FileText`, **titre écrit par le bureau**, `meta` « {Catégorie} · Daté du
  `jj/mm/aaaa` · PDF · `poids` » (`data`), puis ligne `meta` **« Terrain : Parcelles 12 et 13 ·
  Compteur 0045821 »** — même vocabulaire que « Mes factures » (`parcel`/`parcels`/`meter`/`holder` de
  `MemberSpacePage.invoices`) : les parcelles de la fiche **à la date du document** (`parcelsOwnedOn`),
  puis le compteur, ou « Au nom de {nom} » quand la fiche porte un autre nom que le compte. Le terrain
  est écrit **même pour un compte à un seul terrain** (le critère dit « chacun indiquant son
  terrain »).
- **Une seule action** : `outline` « Télécharger » (icône `Download` 20 px), nom accessible complet
  « Télécharger « Facture 2026 », parcelle 31 (PDF, 310 Ko) » — deux lignes ont souvent le même titre
  sur deux terrains, le nom accessible doit les distinguer. Sous 640 px, pleine largeur 56 px. Le lien
  mène à la **route authentifiée par identifiant** (forme s31, route nominative propre à fixer au
  plan), jamais à un chemin de stockage.
- Pied de carte : « Un document vous manque ? Écrivez au bureau depuis la page Contact. »
- **Critère 5** : la carte suit les fiches du compte. Un vendeur garde les documents de sa fiche ;
  l'acquéreur, sur une autre fiche, ne les voit pas. Rien à dessiner de plus.

### Écran 2 — Bureau : section « Documents » de la fiche (`/bureau/proprietaires/{id}`)

`DetailCard` placée **après « Factures » et avant « Notes internes »** dans `MemberProfileDetail`, lue
par une promesse non attendue (patron `invoicesPromise`).

- Titre « Documents » (`h3` du back-office) ; `meta` « Visibles des comptes reliés à cette fiche, dans
  leur espace. Aucun autre membre ne les voit. »
- Action d'en-tête `outline` « Déposer un document » (icône `Upload`) — même place et même variante que
  « Rattacher une parcelle » de la carte « Parcelles » : la fiche garde son unique `default`.
- Tableau (§2.1) du plus récent au plus ancien : **Titre** (lien de téléchargement) · **Catégorie** ·
  **Daté du** (`data`) · **Poids** (`data`) · action. **Une seule action par ligne** : `outline`
  « Retirer ». Sous 640 px : cartes empilées (§3.5), « Retirer » pleine largeur 56 px.
- **Fiche sans compte relié** : la phrase `meta` « Cette fiche n'est reliée à aucun compte : ses
  documents attendent dans son dossier qu'un compte y soit relié. » (le dossier existe sans compte —
  note de la story).
- **2e — succès** (ancré en tête de section, `alert` neutre + `CircleCheck` `primary`) : « Document
  déposé. « {titre} » est visible dès maintenant dans l'espace des comptes reliés à cette fiche, carte
  « Mes documents ». » ; après retrait : « Document retiré. Il n'apparaît plus dans l'espace des comptes
  reliés à cette fiche et son adresse ne sert plus le fichier. »
- **2f — retrait** : `alert-dialog`, voile `--overlay` : « Retirer « {titre} » du dossier de {nom de la
  fiche} ? Il disparaît de l'espace des comptes reliés à cette fiche et son adresse cesse de servir le
  fichier. Le fichier est effacé : pour le remettre, il faudra le déposer à nouveau. » `outline`
  « Annuler », `destructive` « Retirer le document ». Sous 640 px, ancré en bas, boutons empilés, le
  principal en premier.
- Visible des rôles qui portent l'action de gestion du registre (à créer au plan) ; sinon la section
  n'est pas rendue.

### Écran 3 — Bureau : « Déposer un document » pour une fiche

Quatre champs : une **page** (§3.11, `dialog` ≤ 2 champs), sous-route de la fiche (patron
`factures/nouvelle`). Fil d'Ariane « Propriétaires › {nom} › Déposer un document ».

- En tête, en lecture seule : `dl` « Pour » — **nom de la fiche** + `meta` terrain (parcelles
  actuelles, compteur). Le bureau voit à qui il dépose avant d'envoyer.
1. **Titre** (`input`) — aide « Le titre que lit le propriétaire, par exemple « Facture 2026 ». »
   Plafond à fixer au plan, compteur si affiché (§3.9).
2. **Catégorie** (`select`) — les catégories **actives** du domaine des documents nominatifs.
3. **Date du document** — champ date §3.9 (clavier, `jj/mm/aaaa`, pré-rempli à aujourd'hui, icône
   `Calendar` décorative) ; aide « La date écrite sur le document. Les membres voient la liste dans cet
   ordre. »
4. **Fichier** (`file-upload`) — « PDF uniquement, 10 Mo au plus. » annoncé **avant** l'échec ; pas de
   zone de dépôt au tactile.

- Actions : `default` « Déposer le document », `outline` « Annuler » (empilés 56 px en mobile).
- **3b — erreurs** : résumé ancré `destructive` 2 px, `role="alert"`, « Le document n'a pas été
  déposé. Rien n'est perdu. » + liens d'ancrage ; messages de champ (« Saisissez un titre… »,
  « Choisissez une catégorie. », « Saisissez une date au format jj/mm/aaaa. », « Ce fichier n'est pas
  un PDF. Enregistrez le document en PDF puis déposez-le à nouveau. », « Ce fichier pèse 14,2 Mo : le
  plafond est de 10 Mo. »). Un refus de date (document postérieur à la dernière période de la fiche,
  questions 2 et 3 de la recherche) prendrait la même forme si le plan le retient — non dessiné.
- **3c — aucune catégorie active** : formulaire non proposé ; `alert` neutre `muted` + `Info`
  « Aucune catégorie de document nominatif. Un document se range dans une catégorie. Créez-en une
  d'abord, par exemple « Facture ». → Gérer les catégories ».
- **3d — dépôt en cours** : `progress` **indéterminée** + « Envoi de {nom du fichier} » ; bouton
  désactivé « Dépôt en cours… », largeur conservée.
- Succès : retour sur la fiche, alerte 2e.

### Écran 4 — Bureau : « Documents nominatifs » (`/bureau/documents-nominatifs`)

Entrée **« Documents nominatifs »** du groupe « L'association » de `NAV_GROUPS`, **juste après
« Documents »** (s31), active sur ses sous-routes (`matchesSubroutes`). Critère 6 : tous les documents
nominatifs de l'association, aucun d'une autre.

- `h1` « Documents nominatifs », `meta` « Les documents personnels déposés sur les fiches des
  propriétaires. Chacun n'est visible que des comptes reliés à sa fiche. »
- Barre : lien « Gérer les catégories » et **`default` « Déposer en lot »** (icône `Upload`), seul
  `default` de l'écran. Sous 640 px, le bouton d'abord, pleine largeur.
- **Filtres** (forme §3.13) : `input` « Rechercher une fiche » (nom de la fiche) et `select`
  « Catégorie » avec le **décompte dans chaque option** (« Toutes (812) », « Facture (406) »…) ; résumé
  `meta` `aria-live="polite"` sous les filtres (« 3 documents — « Lefèvre », toutes catégories ») ;
  tout changement revient à la page 1. Empilés pleine largeur sous 640 px.
- Tableau du plus récent au plus ancien : **Fiche** (lien vers la fiche + `meta` parcelles) · **Titre**
  (lien de téléchargement) · **Catégorie** · **Daté du** · **Poids** · action `outline` « Retirer »
  (même `alert-dialog` que 2f). 25 lignes par page, 10 cartes sous 640 px, « Précédent / Suivant »
  écrits, inactifs annoncés `aria-disabled` (§3.13). Volumétrie ~800 documents par an : la pagination
  est **côté serveur**.

### Écran 5 — Bureau : « Déposer en lot » (`/bureau/documents-nominatifs/lot`)

Page (fil d'Ariane « Documents nominatifs › Déposer en lot »). Critère 7 : chaque fichier va à la
bonne fiche ou est écarté et signalé, **jamais rattaché à une fiche par défaut**.

- **Règle écrite avant tout** : `alert` neutre `muted` + `Info` « Chaque fichier trouve sa fiche par son
  nom. Le nom doit commencer par l'identifiant client Pennylane du terrain, suivi de « _ » :
  `C1234_facture-2026.pdf`. Un fichier qui ne correspond à aucune fiche est écarté et signalé : il
  n'est jamais déposé sur une autre fiche. »
- Champs communs au lot : **Titre des documents** (`input`, aide « Le même titre pour tout le lot,
  celui que lit chaque propriétaire. ») · **Catégorie** (`select`) · **Date des documents** (champ date
  §3.9). Puis **Fichiers** : `file-upload` en mode multiple, « Choisir des fichiers », « PDF uniquement,
  10 Mo au plus par fichier. » ; sous la zone, « 12 fichiers choisis » et la liste des noms (`data`
  15 px), tronquée « … et 10 autres » au-delà de quelques lignes.
- Actions : `default` « Déposer les 12 documents » (le nombre suit la sélection), `outline` « Annuler ».
- **5b — erreurs** : résumé ancré « Le lot n'est pas parti. Rien n'est perdu. » + messages de champ
  (« Choisissez une catégorie. », « Choisissez au moins un fichier. »). Aucun fichier n'est envoyé tant
  que le formulaire n'est pas valide.
- **5c — en cours** : les fichiers partent **un par un** (plafond de 16 Mo par requête). La source
  compte vraiment : `progress` **déterminée** (§2.1), **sans pourcentage écrit**, la phrase porte le
  décompte (« 5 fichiers traités sur 12 », `aria-live="polite"`, forme du quota §3.13), puis « Envoi de
  {nom} ». `alert` `warning` + `AlertTriangle` : « Restez sur cette page jusqu'à la fin : si vous la
  quittez, les fichiers restants ne partent pas. Ceux déjà déposés le restent. » Le rapport se remplit
  ligne à ligne sous la barre. Bouton désactivé « Dépôt en cours… ».
- **5d — rapport final** (le succès du lot) : `alert` neutre + `CircleCheck` « Lot terminé : 7
  documents déposés, 5 écartés. Les documents déposés sont visibles dès maintenant dans l'espace des
  comptes reliés à leur fiche. Les fichiers écartés n'ont été déposés nulle part. » ; compteur `dl`
  (Déposés · Écartés · Total, forme §3.13) ; `meta` « Ce rapport n'est pas conservé : notez les fichiers
  écartés avant de quitter la page. » ; tableau **Fichier** (`data`) · **Résultat** (`badge`) ·
  **Fiche ou raison**, **écartés en tête**. Déposé → lien vers la fiche + `meta` terrain ; écarté → la
  raison écrite :
  - « Aucune fiche ne porte l'identifiant C9999. »
  - « Le nom ne commence pas par un identifiant client Pennylane. »
  - « Ce fichier n'est pas un PDF. »
  - « Ce fichier pèse 14,2 Mo : le plafond est de 10 Mo. »
  - « Le nom peut désigner plusieurs fiches : renommez le fichier avec l'identifiant complet. »
  - Puis, sous le tableau, `alert` neutre `muted` + `Info` : « {n} fiches n'ont pas d'identifiant client
    Pennylane : un lot ne peut pas les atteindre. Déposez leurs documents depuis leur fiche. → Voir ces
    fiches » — c'est la forme retenue pour « fiche sans référence » (voir manque n° 3).
  - Badges (composition §3.10/§3.13, aucune couleur nouvelle) : « Déposé » `outline` texte
    `muted-foreground` (terminé) ; « Écarté » `destructive` (vrai échec de la ligne). Le mot porte
    l'information.
  - Actions : `default` « Déposer un autre lot », `outline` « Voir les documents nominatifs ».
  - Sous 640 px : cartes empilées, nom du fichier en titre, badge dessous (§3.9), paire « Raison » ou
    « Fiche ».
- **5e — aucune fiche atteignable** (aucune fiche de l'association ne porte d'identifiant client
  Pennylane) : formulaire non proposé ; `alert` neutre `muted` + `Info` « Aucune fiche ne porte
  d'identifiant client Pennylane. Le lot ne peut rattacher aucun fichier. Renseignez l'identifiant sur
  les fiches (carte « Facturation »), ou déposez chaque document depuis la fiche du propriétaire. »
- Sans catégorie active : même alerte que 3c.

### Catégories (`/bureau/documents-nominatifs/categories`)

Pas de planche : écran générique `ReportCategoriesManager` (s10/s23/s31) avec `showRoutingEmail={false}`
(§3.18), pour le domaine des documents nominatifs (nouveau domaine ou réemploi de `document` : à
trancher au plan, question 7 de la recherche), seed « Facture », « Convocation », lien de retour vers
`/bureau/documents-nominatifs`.

## Mockup

`docs/designs/s32-documents-nominatifs.html` — visual reference. DO NOT copy into production: Execute
builds with the real components. Onze planches (1a ; 1b-1d ; 2a/2e ; 2b-2d/2f ; 3a/3b ; 3c/3d ; 4a ;
4b-4d ; 5a/5b ; 5c/5e ; 5d), chacune en cadre ordinateur puis cadre mobile 390 px.

## Reused components (from the design system)

- En-tête et coquille de l'espace membre (§3.12), marqueur « Espace personnel » (§3.4) — inchangés.
- Ligne de document de s31 (§3.18) : `FileText`, titre, `meta`, `outline` « Télécharger ».
- Vocabulaire et clés du terrain de « Mes factures » (§3.15, s19/s20/s53).
- `card` / `DetailCard` de la fiche (§3.11, patron `MemberInvoicesSection`).
- `table` + cartes empilées sous 640 px (§3.5), `pagination` « Précédent / Suivant » (§2.1, §3.13).
- Filtre de tableau `select` avec décompte + résumé `aria-live` (§3.13) ; `input` de recherche.
- `button` `default` / `outline` / `destructive` (48 px ; 56 px pleine largeur sur mobile).
- `input`, `select`, `label`, champ date (§3.9), `file-upload` (mode `multi` existant, jamais encore
  utilisé), `progress` indéterminée (unitaire) et déterminée (lot, §2.1).
- `alert` — succès neutre `CircleCheck`, neutre `muted` + `Info`, `warning` + `AlertTriangle`
  (§3.13), résumé d'erreurs `destructive` 2 px (§3.9).
- `alert-dialog` — retrait, voile `--overlay` (§1.9), ancré en bas sous 640 px (§3.11).
- `badge` — « Déposé » / « Écarté » (§3.10, §3.13).
- Compteur `dl` (§3.13).
- `skeleton` — chargement des listes (carte membre, section de fiche, tableau du bureau).
- `sidebar` du bureau — nouvelle entrée « Documents nominatifs ».
- `ReportCategoriesManager` avec `showRoutingEmail={false}` (§3.18).
- Icônes du vocabulaire figé (§1.7) : `FileText`, `Download`, `Upload`, `Info`, `CircleCheck`,
  `AlertTriangle`, `Calendar`.
- Typographie `data` : dates, poids, parcelles, compteurs, identifiants, noms de fichiers.

## States

- **Carte membre (1)** : remplie, plusieurs terrains (1a) · vide (1b, « Aucun document personnel pour
  l'instant… » + écrire au bureau) · chargement (1c, trois lignes `skeleton`, `aria-busy`) · erreur de
  lecture (1d, `alert` ancrée dans la carte : « Vos documents n'ont pas pu être affichés. Rien n'est
  perdu : ils restent dans votre dossier. Rechargez la page dans un instant. ») — le plan choisit entre
  une frontière d'erreur propre à la carte (dessinée) et la page d'erreur de l'espace (s31) ; la carte
  ne doit jamais emporter le reste de l'espace. Document retiré entre-temps : 404 nu (manque s31 n° 2,
  inchangé).
- **Section de fiche (2)** : remplie (2a) · vide, avec ou sans compte relié (2b) · chargement (2c) ·
  erreur (2d) · succès du dépôt ou du retrait (2e) · confirmation du retrait (2f).
- **Dépôt unitaire (3)** : au repos (3a) · erreurs (3b) · aucune catégorie (3c) · en cours (3d) ·
  succès : retour à la fiche (2e).
- **Vue d'ensemble (4)** : remplie et filtrée (4a) · vide (4b) · filtre sans résultat (4b′, « Aucun
  document ne correspond à « Duval » dans « Convocation ». → Effacer les filtres ») · chargement (4c) ·
  erreur (4d) · retrait : 2f puis succès ancré en tête de page.
- **Dépôt en lot (5)** : au repos (5a) · erreurs de formulaire (5b) · en cours (5c) · rapport final
  (5d, le succès) · aucune fiche atteignable (5e) · aucune catégorie (forme 3c).
- **Non autorisé** : `BureauAccessDenied` pour les écrans 3 à 5 ; section 2 non rendue.

## Design system gaps

1. **Rapport ligne à ligne d'un dépôt de fichiers** — l'import de s13 rend un rapport de lignes CSV ;
   aucune forme n'existe pour un rapport **par fichier**, rempli au fil de l'envoi (5c) puis figé (5d).
   Composé ici avec l'existant (compteur §3.13, tableau §3.5, badges §3.10, `progress` déterminée
   §2.1) : à verser au §3 comme forme décrite si le plan la retient. Rien d'inventé, mais la
   combinaison « barre + liste qui se remplit » n'est écrite nulle part.
2. **Avertissement « ne quittez pas la page »** — un lot envoyé fichier par fichier depuis le
   navigateur s'arrête si la page est quittée. Rendu en `alert` `warning` (report, pas refus : §3.13).
   La protection elle-même (`beforeunload`) n'a pas de règle au système ; à décider au plan, sans
   dialogue maison.
3. **« Fiche sans référence » comme raison de rejet d'une ligne** — un fichier ne nomme pas une fiche
   sans identifiant : la raison ne peut pas se détecter sur un fichier. Proposé : un encart du rapport
   (et l'état 5e) qui compte les fiches sans identifiant client Pennylane et renvoie vers elles. À
   confirmer au plan ; le lien « Voir ces fiches » suppose un filtre de la liste des propriétaires qui
   n'existe pas encore (sinon, lien vers la carte « Synchronisation Pennylane » qui les compte déjà).
4. **Format de l'identifiant dans le nom de fichier** — l'aide du champ de la carte « Facturation »
   (s20) décrit l'identifiant client Pennylane « de la forme 3f2a…-…-… » ; l'exemple arbitré pour le
   lot est `C1234_…`. Le séparateur « _ » et le cas « plusieurs fiches » (préfixe d'un autre
   identifiant) dépendent du vrai format : à trancher au plan, l'exemple écrit à l'écran doit être un
   identifiant réaliste du tenant.
5. **Titre commun du lot** — la décision fixe une catégorie et une date communes ; le système exige un
   titre écrit par le bureau, jamais le nom du fichier (§3.18). Proposé : un champ « Titre des
   documents » commun au lot (dessiné). À valider au plan (sinon, titre composé « {Catégorie}
   {année} »).
6. **Mention « document personnel » à l'impression** (§6.2) — elle s'applique aux pièces nominatives
   **imprimées depuis le site** ; les PDF déposés sont servis tels quels et ne la portent pas. Aucune
   action en s32 ; noté pour ne pas laisser croire que la règle est tenue sur ces fichiers.
7. **Entrée « Documents nominatifs »** de la barre du bureau — item sans icône du groupe
   « L'association », après « Documents » : à inscrire avec les autres entrées (comme « Invitations »,
   s42b).
