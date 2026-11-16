# Design — Story s53-un-acces-plusieurs-terrains

> Conçu le 2026-11-16, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s53-un-acces-plusieurs-terrains.md`.
> Écrans d'ancrage : s12 (liste, fiche, état `2e`), s12d (écran A, carte « Accès », écran C), s16
> (carte « Mes coordonnées »).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du
> conteneur) ; contrôle en lecture seule à la place : aucune couleur hors des tokens de `:root`, toutes
> les marges dans l'échelle 4/8/12/16/24/32/48/64 (une règle à 20 px, inutilisée, retirée), six
> planches en deux versions chacune (ordinateur et mobile 390 px, par requêtes de conteneur).

## Périmètre du design

Quatre écrans, chacun en **ordinateur (1 280 px) et mobile (390 px)**. Données fictives : association
« Clos-Fleuri » (CF, teinte 195) ; Bernard Lefèvre, `bernard.lefevre@exemple.fr`, adresse portée par
trois fiches : « Bernard Lefèvre » (parcelle 12, compteur 0045821), « Bernard Lefèvre » (parcelle 27,
compteur 0051207), « SCI Les Pins » (parcelle 31 sans compteur, ancienne parcelle 8). Lucie Moreau,
un seul terrain.

| Écran | Route                                                           | États   |
| ----- | --------------------------------------------------------------- | ------- |
| 1     | `/dashboard` — carte « Mes terrains »                           | 1a à 1c |
| 2     | `/dashboard` — carte « Mes coordonnées »                        | 2a à 2c |
| 3     | `/bureau/proprietaires/nouveau` et `/bureau/proprietaires/{id}` | 3a à 3d |
| 4     | `/bureau/proprietaires` — liste des membres                     | 4a      |

Ce que la story ne demande pas, donc **non dessiné** : factures (s19) et consommation (s18), qui se
logeront dans chaque groupe de terrain ; adresses multiples par fiche (s54) ; connexion (inchangée :
l'accès suit la ligne `member`, ADR 034/038) ; formulaires de signalement et de question (voir
« Décisions sans écran »).

**Vocabulaire** : à l'écran, un **terrain** = une fiche (un client Pennylane), désigné par son ou ses
numéros de parcelle actuels ; le nom de la fiche est écrit « Au nom de {nom} ». Le mot « fiche » reste
côté bureau.

## Screen(s)

### Écran 1 — Espace membre : « Mes terrains » (`/dashboard`)

Coquille s46 et ordre des cartes de s12d/s16 inchangés : marqueur, `h1`, **Mes terrains** (remplace
« Mes parcelles »), Mes coordonnées, Mes signalements / question (s22, s23), Sécurité du compte.

- **Marqueur** (§3.4) : `Lock` 16 px + « **Espace personnel** » + `meta` « · 3 terrains · Parcelles
  12, 27 et 31 ». Un seul terrain : « · Parcelle 21 » comme aujourd'hui.
- **`h1`** : « Bonjour {nom} ». Un terrain : nom de la fiche (inchangé). Plusieurs : **nom du compte**
  (`user.name`, déjà utilisé par l'état de chargement), parce que les fiches peuvent porter des noms
  différents (« SCI Les Pins »).
- **Carte « Mes terrains »** (`h2` serif 20 px) :
  - plusieurs terrains : phrase en `meta` « Vos {n} terrains sont réunis ici : vous vous connectez une
    seule fois. » ; puis **un groupe par fiche**, séparés par un filet, triés par premier numéro de
    parcelle actuel (puis anciennes seulement en dernier) ;
  - titre de groupe en 17 px / 600 : « Parcelle **12** » (`data`) — « Parcelles 12 et 13 » si la fiche
    en a deux ; « Ancienne parcelle 8 » si la fiche n'en a plus d'actuelle ;
  - sous le titre, en `meta` : « Au nom de {nom de la fiche} » ;
  - lignes de 56 px séparées par un filet (patron de s12d) : `Map` 20 px « Parcelle **12** · Propriétaire
    depuis le 3 février 1998 » (« avant l'import » pour la date sentinelle) ; `Droplet` 20 px
    « Compteur **0045821** » (`data`), ou « Compteur non renseigné » en `muted-foreground` ;
  - « Anciennes parcelles » (`h3` 17 px / 600) **dans le groupe de la fiche** qui les a eues, phrase de
    s12d inchangée ; « Vous n'êtes plus propriétaire… » de s12d (C3) vaut par groupe ;
  - pied de carte : « Un terrain manque, ou n'est pas à vous ? Écrivez au bureau. » + lien « Page
    Contact » (un seul terrain : « Une erreur ? Écrivez au bureau. », inchangé).
- **Mobile** : la date passe sous le numéro ; lignes et groupes identiques.
- **Aucun identifiant de fiche** dans l'écran ni dans un lien : la liste vient de la session et du
  domaine (critère 4). Aucun sélecteur de terrain, aucun onglet (§8 : pas de `tabs` côté membre).

### Écran 2 — Espace membre : « Mes coordonnées », compte à plusieurs terrains

**Proposition, à confirmer au plan** (la story laisse la question au design) : les coordonnées sont
celles **de la personne** ; une seule carte, et l'enregistrement s'applique à **toutes** les fiches
reliées au compte.

- 2a lecture : sous le titre, `meta` « Elles valent pour vos {n} terrains. » ; paires de s16 inchangées
  (email en lecture seule avec sa mention, téléphone, adresse postale).
- 2b fiches divergentes (cas de l'import) : `alert` neutre `Info` « **Vos terrains n'ont pas tous les
  mêmes coordonnées.** En les modifiant, vous les mettez à jour pour vos {n} terrains. » ; les paires
  « Téléphone » et « Adresse postale » sont regroupées par jeu de coordonnées, chaque groupe titré par
  ses parcelles (« Parcelles 12 et 27 », « Parcelle 31 · SCI Les Pins »). La modification part des
  coordonnées du premier terrain (ordre de l'écran 1).
- Modification : formulaire de s16 inchangé (C3, C4, C6).
- 2c succès : alerte neutre de s16, texte « Elles valent désormais pour vos {n} terrains. Le bureau les
  voit dès maintenant. »
- Un terrain : s16 inchangé.

### Écran 3 — Bureau : l'adresse saisie est déjà celle d'un compte

Remplace l'état `2e` de s12 (refus + lien) **en création comme en modification**.

- **3a, confirmation demandée** : à l'enregistrement, **rien n'est écrit**. Sous le champ email, un
  `alert` `warning` (`AlertTriangle`, patron des avertissements A3/A6 de s12d) :
  « **Cette adresse est déjà celle du compte de {nom du compte}.** Il s'en sert pour se connecter à
  l'espace de ses terrains : {liens vers chaque fiche, libellés par parcelle}. S'agit-il de la même
  personne ? » puis « Si oui, cette fiche rejoint son compte : il verra ce terrain, ses factures et ses
  documents. Rien n'a encore été enregistré. »
  - `default` « Oui, relier à son compte » : renvoie le formulaire avec la confirmation ;
  - `outline` « Non, corriger l'adresse » : ferme l'encart, rend le focus au champ email, rien n'est
    enregistré ;
  - mobile : boutons empilés pleine largeur, 56 px, le principal en premier.
  - Pas d'`alert-dialog` : l'acte se défait en retirant l'adresse (§2.1, réservé à l'irréversible).
  - Le reste du formulaire garde ses saisies. Une saisie modifiée après l'encart le referme.
- **3b, succès** : confirmation de s12d (`role="status"`, `CircleCheck`), titre « Coordonnées
  enregistrées. » (« Propriétaire enregistré. » en création) + « Fiche reliée au compte de {nom du
  compte} : ce terrain apparaît dans son espace. » Rien ne laisse croire qu'un email est parti.
- **3c, carte « Accès à l'espace membre »** d'une fiche dont le compte en porte d'autres : phrase de
  s12d « **Compte ouvert.** … » + « Ce compte réunit aussi : {nom de la fiche, parcelle N} · … », chaque
  entrée lien vers la fiche. C'est l'endroit où le bureau décèle une faute de frappe.
- **3d, adresse vidée** sur une fiche d'un compte partagé : avertissement A3 réécrit, sans pronom
  (manque relevé par s12d) : « **Attention.** Sans adresse email, cette fiche quitte le compte de {nom
  du compte}. Son accès à l'espace reste ouvert pour ses {n} autres terrains. Les envois de cette fiche
  partiront par courrier. » Confirmation : « Fiche retirée du compte de {nom du compte}. Son accès reste
  ouvert pour ses autres terrains. »
- **Adresse remplacée** sur une fiche d'un compte partagé (A6) : « {ancienne} ne donnera plus accès à
  ce terrain ; ses autres terrains restent accessibles avec elle. » + la phrase de s12d sur la nouvelle
  adresse. Si la nouvelle adresse est elle-même celle d'un compte → 3a.
- Erreur serveur : celle du formulaire existant.

### Écran 4 — Bureau : liste des membres

Colonne **Contact** existante (s12) : sous l'adresse, en `meta`, « Compte de {n} terrains » quand le
compte de la fiche en porte **au moins deux** ; rien pour un seul (le cas de ~400 fiches sur 413 :
l'afficher partout serait du bruit). Même paire dans la carte mobile (§3.5). Le nombre compte les
**fiches** reliées au compte (un terrain = une fiche). Aucune colonne ajoutée. Vide, chargement,
recherche sans résultat : 1b à 1d de s12, inchangés.

### Rapport d'import (s13) — libellé seul, écran inchangé

Le rejet « Cet email est déjà utilisé par un autre membre. » disparaît pour ce cas. Nouvelle remarque
dans la section « Lignes importées avec une remarque » existante, sur chaque ligne qui rejoint un
compte déjà ouvert par une ligne précédente : « Même adresse email que la ligne {line} : les deux
fiches sont reliées au même compte. Vérifiez qu'il s'agit de la même personne. » (patron de
`same_name_and_address`, `relatedLine`). Aucune planche : la table existe (design s13).

## Décisions sans écran (à confirmer au plan)

- **Signalement et question (s22, s23)** d'un compte à plusieurs terrains : rattachés à une fiche
  déterminée (la première dans l'ordre de l'écran 1), sans sélecteur ; « Mes signalements » liste ceux
  de **toutes** les fiches du compte. Aucun écran ne change.
- **Campagnes** : un envoi par adresse ; `{nom}` = nom du compte, `{parcelle}` = toutes les parcelles
  actuelles de ses fiches. Une désinscription vaut pour toutes les fiches de l'adresse. Rien à l'écran
  du bureau, qui affiche déjà des décomptes de destinataires.

## Mockup

`docs/designs/s53-un-acces-plusieurs-terrains.html` — visual reference. DO NOT copy into production:
Execute builds with the real components. Six planches (1a, 1b/1c, 2a/2b/2c, 3a/3b, 3c/3d, 4a), chacune
en cadre ordinateur puis cadre mobile 390 px ; la mise en page mobile s'applique par requête de
conteneur sous 640 px.

## Reused components (from the design system)

- En-tête de l'espace membre (§3.12), `<AssociationMark />`, marqueur « Espace personnel » (§3.4).
- `card` — Mes terrains, Mes coordonnées, Coordonnées, Accès à l'espace membre.
- Lignes de 56 px à filet de l'écran C de s12d — parcelle et compteur ; icônes `Map`, `Droplet`
  (vocabulaire figé §1.7), `Lock`, `AlertTriangle`, `CircleCheck`, `Info`, `Menu`, `LogOut`.
- `alert` — `warning` (3a, 3d), neutre succès (2c, 3b), neutre `muted` avec `Info` (2b, écran D de
  s12d).
- `button` `default` / `outline` (48 px ; 56 px empilés sur mobile).
- `input`, `label`, « Facultatif » écrit — formulaire existant.
- `table`, cartes empilées sous 640 px (§3.5), `badge` « Courrier uniquement » — liste existante.
- `skeleton` — chargement de « Mes terrains ».
- Typographie : `data` (JetBrains Mono, `tabular-nums`) pour parcelle, compteur et adresse.

## States

- **Mes terrains (1)** : plusieurs terrains (1a) · un terrain (1b, s12d + compteur) · chargement (1c,
  trois lignes `skeleton`, `aria-busy`, marqueur masqué) · groupe sans parcelle actuelle (phrase C3 de
  s12d par groupe) · vide et refus : C5 et C4 de s12d, inchangés · erreur : page d'erreur existante.
- **Mes coordonnées (2)** : lecture (2a) · fiches divergentes (2b) · modification, erreurs C4/C6 de s16 ·
  succès (2c).
- **Fiche du bureau (3)** : confirmation demandée (3a) · refus → retour au champ, rien d'écrit · succès
  (3b) · carte d'un compte partagé (3c) · adresse vidée (3d) · adresse remplacée · erreur serveur
  existante.
- **Liste (4)** : compte de plusieurs terrains (4a) ; autres états de s12 inchangés.

## Design system gaps

- **Libellé d'un terrain** : le design system ne connaît que « parcelle » (`Map`). « Terrain » =
  regroupement par fiche, désigné ici par ses parcelles + « Au nom de ». Aucun composant ni icône
  nouveau ; à inscrire au §3 si la forme est retenue.
- **Accord du pronom** (« Il s'en sert », « il verra », 3a) : même manque que s12d (A3). À reformuler
  sans pronom au plan, par exemple « Ce compte sert à se connecter à l'espace de… » et « cette fiche
  rejoint son compte : ce terrain, ses factures et ses documents y seront visibles ».
- **Nombre en `meta` dans une cellule de tableau** (4a) : la règle « deux badges sur une ligne » (§3.9)
  ne couvre pas une seconde ligne de texte dans une cellule ; la ligne reste à 56 px tant que l'email
  tient sur une ligne. Écart assumé, à valider : un `badge` aurait été un statut, ce n'en est pas un.
- **Titre de groupe dans une carte membre** (1a) : pas de niveau entre `h2` de carte et `h3` 17 px
  (manque déjà relevé par s12d) ; le titre de groupe est un texte 17 px / 600, les « Anciennes
  parcelles » restent en `h3`.
- Écarts propres à la maquette : polices non chargées (repli système), barre latérale indicative,
  icônes lucide redessinées à la main.
