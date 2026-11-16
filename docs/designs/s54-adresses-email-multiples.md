# Design — Story s54-adresses-email-multiples

> Conçu le 2026-11-16, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s54-adresses-email-multiples.md`.
> Écrans d'ancrage : s12 (fiche, liste), s12d (carte « Accès à l'espace membre », avertissements A3/A6),
> s16 (carte « Mes coordonnées »), s53 (écrans 2, 3a, 3c, 4), s25 (page de désinscription), §7 (connexion),
> §5 (email).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)), sauf les jumelles sombres
> de l'email (§5.2).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du
> conteneur, vérifié le 2026-11-16) ; contrôle en lecture seule à la place : aucune couleur hors des
> tokens de `:root`, marges dans l'échelle 4/8/12/16/24/32/48, chaque planche en deux versions
> (ordinateur et mobile 390 px, par requêtes de conteneur), états présents.

## Périmètre du design

Arbitrages du 16/11/2026 appliqués : la **désinscription suit l'adresse** (le proche qui se désinscrit ne
coupe pas le propriétaire) ; une adresse ajoutée par une personne à plusieurs terrains l'est **sur tous ses
terrains**.

Données fictives : association « Clos-Fleuri » (CF, teinte 195). Fiche « Jean Dubois » (parcelle 21) :
`jean.dubois@exemple.fr` titulaire, origine fichier ; `claire.dubois@exemple.fr` (sa fille),
supplémentaire, saisie sur le site, confirmée ; `marc.dubois@exemple.fr`, ajoutée par Claire, en attente.

| Écran | Route                                                          | États   |
| ----- | -------------------------------------------------------------- | ------- |
| 1     | `/dashboard` — carte « Mes adresses email »                    | 1a à 1f |
| 2     | Email « Confirmez cette adresse »                              | 2a      |
| 3     | `/confirmer-adresse/{jeton}` — page publique                   | 3a à 3d |
| 4     | `/bureau/proprietaires/{id}` — carte « Adresses email »        | 4a à 4g |
| 5     | `/bureau/proprietaires` — liste (colonne Contact)              | 5a      |

**Non dessiné** (la story ne le demande pas, ou l'écran ne change pas) : connexion (§7 inchangé :
chaque adresse active se connecte comme aujourd'hui) ; création d'une fiche (`/nouveau` : le champ email
existant devient l'adresse **titulaire**, les suivantes s'ajoutent depuis la fiche) ; rapport d'import
(la remarque « adresse ignorée » disparaît, aucune remarque nouvelle) ; écran des campagnes (les décomptes
de destinataires comptent déjà des adresses depuis s53 et suivent) ; vote (s58) et copie des données
(s40), qui liront le rôle de titulaire plus tard.

**Vocabulaire** à l'écran : « adresse de connexion » côté membre (chaque adresse sert à se connecter et
reçoit les envois) ; côté bureau, « **titulaire** » et « **supplémentaire** ». Côté membre, le mot
« titulaire » n'apparaît qu'en `meta` sur l'adresse concernée (« adresse titulaire du terrain ») : il ne
donne aucun droit de plus dans l'espace (critère 2).

## Screen(s)

### Écran 1 — Espace membre : carte « Mes adresses email » (`/dashboard`)

Nouvelle carte, placée **juste après « Mes coordonnées »** (s16), avant Mes signalements / question. La
carte « Mes coordonnées » perd sa paire « Email » en lecture seule (ADR 040 remplacé) : elle garde
téléphone et adresse postale.

- **`h2`** serif 20 px « Mes adresses email ». `meta` : « Chacune permet de se connecter à cet espace et
  reçoit les envois de l'association. » Plusieurs terrains : « … Elles valent pour vos {n} terrains. »
- **Une ligne par adresse** (56 px, filet, patron de s12d) : icône `Mail` 20 px, adresse en `data`, puis
  en `meta` sous l'adresse :
  - la sienne : « **Votre adresse** · adresse titulaire » ou « **Votre adresse** », action `link`
    « Modifier » (une seule action par ligne) ;
  - celle d'une autre personne : rien de plus, **aucune action** (critère 4) ;
  - une adresse en attente qu'elle a ajoutée : `badge` « En attente de confirmation », `meta` « Lien
    envoyé le 16/11 · valable jusqu'au 23/11 », actions `link` « Corriger » et « Annuler » — écart
    assumé à « une action par ligne », voir gaps ;
  - une adresse en attente ajoutée par quelqu'un d'autre : `badge` « En attente de confirmation », sans
    action ;
  - une adresse qui ne vaut pas pour tous ses terrains (cas d'une adresse saisie par le bureau sur un
    seul) : `meta` « Pour la parcelle 21 seulement ».
- Pied : `button` `outline` « Ajouter une adresse » (`Plus` 20 px), puis `meta` « Pour retirer une
  adresse, écrivez au bureau. » + lien « Page Contact ».
- Aucun identifiant de fiche ni d'adresse dans un lien : la carte se lit par la session (le « Corriger /
  Annuler » envoie l'identifiant de l'adresse en attente, que le serveur revérifie contre l'auteur).

États :

- **1a lecture** — trois adresses (sienne titulaire, celle de Claire, Marc en attente sans action pour
  Jean).
- **1b ajout** — sous la liste, formulaire en place (pas de `dialog` : la carte reste lisible) :
  `label` « Nouvelle adresse email », `input` `type="email"` `autocomplete="email"` `inputmode="email"`,
  aide « Un lien de confirmation lui sera envoyé : elle ne servira qu'une fois confirmée. » Boutons
  `default` « Envoyer le lien de confirmation », `outline` « Annuler ». Mobile : empilés, 56 px, le
  principal d'abord.
- **1c lien envoyé** — `alert` neutre `role="status"`, `CircleCheck` : « **Lien envoyé à
  marc.dubois@exemple.fr.** L'adresse s'activera quand il cliquera sur le lien, valable 7 jours. Rien
  n'arrive ? Vérifiez les indésirables, ou corrigez l'adresse. » La ligne apparaît en attente.
- **1d adresse déjà portée par une autre fiche** (critère 7) — erreur de champ, sous l'`input`, en
  `destructive-text` + bordure 2 px : « Cette adresse est déjà enregistrée dans l'association. Pour
  l'ajouter ici, écrivez au bureau. » + lien « Page Contact ». Le message **ne nomme personne** (il dirait
  à un inconnu qui est adhérent, §7 écran 4). Une adresse déjà sur la fiche : « Cette adresse figure déjà
  dans la liste. »
- **1e modifier sa propre adresse** — la ligne devient formulaire en place : `label` « Votre nouvelle
  adresse », aide « Votre adresse actuelle reste valable jusqu'à la confirmation de la nouvelle. Ensuite,
  vous vous connecterez avec la nouvelle. » Après envoi, la ligne garde l'adresse actuelle et gagne
  dessous une ligne en attente (`badge`, « remplacera votre adresse actuelle »), avec Corriger / Annuler.
- **1f erreurs** — format invalide : message de champ du formulaire (§3.1) ; envoi impossible
  (budget du jour épuisé, s52) : `alert` neutre `Info` « Le lien partira demain matin : l'association a
  atteint sa limite d'envois du jour. » ; erreur serveur : `alert` `destructive` ancré dans la carte
  (§2.1, jamais un toast).
- **Chargement** : trois lignes `skeleton` (patron de 1c de s53), `aria-busy`.

### Écran 2 — Email « Confirmez cette adresse »

Gabarit transactionnel du lien magique (§5.5) : une seule action, aucune actualité.

- Objet : « Clos-Fleuri — Confirmez votre adresse email » ; pré-en-tête : « Claire Dubois a ajouté cette
  adresse à l'espace de la parcelle 21. »
- Corps (17 px, `text`) : « Bonjour, » puis « **{auteur}** a ajouté cette adresse pour qu'elle puisse se
  connecter à l'espace membre de {nom de la fiche} (parcelle 21) et recevoir les envois de l'association. »
  Bouton en table « Confirmer cette adresse » (`buttonBg`, blanc forcé), **doublé de l'URL en clair**.
  « Ce lien vaut jusqu'au 23 novembre 2026. Vous ne connaissez pas cette personne ? Ne cliquez pas :
  sans confirmation, l'adresse ne reçoit rien et ne donne accès à rien. »
- Pied transactionnel (§5.4, sans désinscription). Jumelles sombres §5.2.

### Écran 3 — Page publique « Confirmer l'adresse » (`/confirmer-adresse/{jeton}`)

Coquille publique de la page de désinscription (s25). **Le clic du lien ne confirme pas** : la page
affiche un bouton (les anti-virus de messagerie ouvrent les liens tout seuls).

- **3a à confirmer** — `h1` serif « Confirmer votre adresse » ; paire `data` « marc.dubois@exemple.fr » ;
  phrase « Elle pourra se connecter à l'espace membre de la parcelle 21 et recevra les envois de
  Clos-Fleuri. » ; `button` `default` « Confirmer cette adresse » (56 px pleine largeur sur mobile).
- **3b confirmée** — `alert` neutre `CircleCheck` : « **Adresse confirmée.** Vous pouvez vous connecter
  avec elle. » + `button` `default` « Se connecter » (vers l'écran 1 du §7, adresse préremplie). Une
  modification confirmée : « … Votre ancienne adresse ne sert plus à vous connecter. »
- **3c lien expiré, annulé ou déjà utilisé** — même ton que l'écran 3 du §7 : « **Ce lien ne sert
  plus.** Vous n'avez rien fait de mal. Demandez à la personne qui a ajouté l'adresse de la renvoyer
  depuis son espace, ou écrivez au bureau. » + lien « Page Contact ». Un seul message pour les trois
  causes (aucune ne se devine de l'extérieur).
- **3d adresse prise entre-temps** (une autre fiche l'a reçue avant la confirmation, critère 7) — « **Cette
  adresse ne peut pas être ajoutée ici.** Écrivez au bureau, qui fera le lien. » Rien n'est activé.

### Écran 4 — Bureau : fiche d'un propriétaire, carte « Adresses email »

Dans `/bureau/proprietaires/{id}`, le champ « Email » de la carte « Coordonnées » sort du formulaire et
devient **une carte à part**, « Adresses email », placée entre « Coordonnées » et « Accès à l'espace
membre ». La carte « Accès » est fondue dedans (chaque adresse active se connecte) : elle ne garde que
sa phrase d'ouverture et les autres fiches du compte (s53, 3c), par adresse.

- **Tableau** (§2.1 : 56 px, 17 px, une action par ligne) ; colonnes : Adresse (`data`) · Rôle (`badge`
  « Titulaire » ou « Supplémentaire ») · Origine (texte : « Fichier Pennylane » / « Saisie sur le site »)
  · Statut (texte : « Active » ; `badge` « En attente de confirmation » + `meta` « ajoutée par Claire
  Dubois · jusqu'au 23/11 ») · Action (`link` « Gérer »). Sous 640 px : cartes empilées (§3.5), badge sous
  l'adresse.
- Sous une adresse active, en `meta` : « Se connecte aussi aux fiches : Bernard Lefèvre (parcelle 27) »
  avec liens (s53, 3c) ; le rôle au bureau du compte : `badge` « Bureau » / « Présidence » à côté du rôle.
- Pied : `button` `outline` « Ajouter une adresse ». Fiche sans adresse : état vide « Aucune adresse
  email : cette fiche reçoit tout par courrier. » + même bouton (le `badge` « Courrier uniquement » de s12
  reste dans l'en-tête de la fiche).
- **« Gérer »** ouvre un `dialog` (≤ 2 champs, ancré en bas sous 640 px, §3.11) : « Modifier l'adresse »
  (`input`), puis les actions selon le rôle : `outline` « Désigner titulaire » (supplémentaire active),
  `outline` destructif « Retirer cette adresse ». Une adresse en attente : « Activer sans attendre » n'est
  **pas** proposé (une adresse saisie par le bureau est active d'office : le bureau la modifie, ce qui
  l'active).

États :

- **4a lecture** — trois adresses (titulaire fichier, supplémentaire site, en attente).
- **4b ajout** — `dialog` « Ajouter une adresse » : `input` ; aide « Active tout de suite : elle peut se
  connecter et reçoit les envois. Aucun email ne part. » Fiche sans adresse active : aide « Ce sera
  l'adresse titulaire de la fiche. »
- **4c adresse déjà portée par une autre fiche** — encart `warning` de s53 (3a) dans le `dialog`, reformulé
  sans pronom : « **Cette adresse est déjà celle du compte de {nom du compte}.** Ce compte sert à se
  connecter à l'espace de : {fiches}. S'agit-il de la même personne ? » + **choix du rôle sur cette
  fiche** (`radio-group`, critère 8) : « Supplémentaire » (coché par défaut) / « Titulaire de cette
  fiche — l'adresse titulaire actuelle devient supplémentaire ». Boutons « Oui, ajouter à cette fiche » /
  « Non, corriger l'adresse ». Rien n'est écrit avant le « Oui ».
- **4d désigner titulaire** — confirmation dans le `dialog` : « {nouvelle} devient l'adresse titulaire.
  {ancienne} reste sur la fiche, comme supplémentaire. » `default` « Désigner titulaire ».
- **4e retirer la titulaire** — `alert-dialog` (l'accès se ferme : irréversible pour cette adresse) :
  « **Choisissez l'adresse qui la remplace.** » `radio-group` : chaque autre adresse **active** de la
  fiche, puis « Une nouvelle adresse » (révèle un `input`). Bouton « Retirer et remplacer » désactivé tant
  que rien n'est choisi. Sans autre adresse active, la liste se réduit à « Une nouvelle adresse » + la
  phrase « Ou retirez-la sans remplaçante : la fiche passera en **courrier uniquement**. » et le bouton
  `outline` destructif « Retirer, passer en courrier » — seulement si c'est la **dernière adresse active**.
  Compte du bureau sur sa dernière fiche : refus de s12d/s53 inchangé (« L'adresse d'un membre du bureau
  ne se retire pas : modifiez-la. »).
- **4f retirer une supplémentaire** — `alert-dialog` : « **{adresse} ne pourra plus se connecter à cette
  fiche**, dès sa prochaine page. Ses autres fiches restent accessibles. » (dernière phrase seulement si
  elle en a), `destructive` « Retirer l'adresse ».
- **4g confirmations** — `alert` neutre `role="status"` au-dessus du tableau : « Adresse ajoutée : elle
  peut se connecter dès maintenant. » · « {adresse} est désormais l'adresse titulaire. » · « Adresse
  retirée : elle ne se connecte plus à cette fiche. » Rien ne laisse croire qu'un email est parti.
- Erreur serveur : `alert` `destructive` dans la carte.

### Écran 5 — Bureau : liste des membres

Colonne **Contact** (s12, s53) : l'adresse **titulaire** reste affichée ; quand la fiche en porte
d'autres actives, `meta` « + {n} autres adresses » sous elle (même place que « Compte de {n} terrains »
de s53, qui passe à la suite sur la même ligne `meta`, séparé par « · »). Recherche, vide, chargement :
inchangés.

## Décisions sans écran (à confirmer au plan)

- **Campagnes** : chaque adresse active d'une fiche est un destinataire ; une adresse portée par plusieurs
  fiches reste un seul envoi (s53). `{nom}` et `{parcelle}` suivent la règle de l'ADR 055 appliquée à
  l'adresse (une fiche : nom de la fiche ; plusieurs : nom du compte). Le lien de désinscription vise
  **l'adresse** (arbitrage) ; la page de désinscription (s25) dit « Cette adresse ne recevra plus… » sans
  changer de forme.
- **Signalement, question (s22, s23)** : l'adresse copiée est celle de **la personne connectée**
  (`replyTo` vers le proche qui a posé la question), pas la titulaire.
- **Expiration** : une adresse en attente échue disparaît de l'écran 1 et de la carte du bureau (aucun
  état « expirée » affiché) ; délai lu dans le paramètre du tenant (seed 7 jours), affiché en clair
  (« jusqu'au 23/11 »).

## Mockup

`docs/designs/s54-adresses-email-multiples.html` — visual reference. DO NOT copy into production:
Execute builds with the real components. Planches 1a-1c, 1d-1e, 2a, 3a-3d, 4a, 4c, 4e-4f, 5a, chacune en
cadre ordinateur puis cadre mobile 390 px (le second cadre est une copie du premier, mise en page mobile
par requête de conteneur sous 640 px).

## Reused components (from the design system)

- En-tête de l'espace membre (§3.12), coquille publique (page de désinscription s25), back-office
  (sidebar → tiroir sous `lg`).
- `card` — Mes adresses email, Adresses email (bureau).
- `table` + cartes empilées sous 640 px (§3.5) ; `badge` (Titulaire, Supplémentaire, En attente de
  confirmation, Bureau, Présidence, Courrier uniquement).
- `alert` — neutre succès (`CircleCheck`), neutre `Info`, `warning` (4c), `destructive` (erreur serveur).
- `dialog` (4b, 4c, 4d ; ancré en bas sous 640 px) et `alert-dialog` (4e, 4f).
- `radio-group` (4c, 4e), `input`, `label`, aide de champ, erreur de champ (§3.1).
- `button` `default` / `outline` / `destructive`, `link` ; icônes lucide `Mail`, `Plus`, `CircleCheck`,
  `Info`, `AlertTriangle`, `Lock`.
- `skeleton` — chargement de la carte membre.
- Email : gabarit du lien magique (§5.5), constantes hexadécimales et jumelles sombres (§5.2).

## States

- **Mes adresses (1)** : lecture (1a) · ajout (1b) · lien envoyé (1c) · adresse déjà portée (1d) ·
  modification de la sienne (1e) · erreurs et report au lendemain (1f) · chargement · une seule adresse
  (ligne unique, pied identique) · vide : impossible (une personne connectée a toujours son adresse).
- **Email (2)** : unique.
- **Page de confirmation (3)** : à confirmer (3a) · confirmée (3b) · lien inutilisable (3c) · adresse
  prise (3d).
- **Carte du bureau (4)** : lecture (4a) · ajout (4b) · adresse déjà portée + rôle (4c) · désigner
  titulaire (4d) · retirer la titulaire (4e) · retirer une supplémentaire (4f) · confirmations (4g) · vide
  (fiche courrier) · erreur serveur.
- **Liste (5)** : autres adresses (5a) ; le reste inchangé.

## Design system gaps

- **Deux actions sur une ligne** (1a, adresse en attente : Corriger / Annuler) : §2.1 dit « une seule
  action par ligne » pour le **tableau** ; la carte membre n'est pas un tableau, mais l'esprit est le
  même. Alternative à trancher au plan : une seule action « Gérer » ouvrant un `dialog` comme côté bureau.
- **`radio-group` dans un `alert-dialog`** (4e) : §2.1 limite le `dialog` à 2 champs et réserve
  l'`alert-dialog` à l'irréversible ; un choix parmi N adresses + un champ conditionnel dépasse la forme
  connue. À valider, ou faire de 4e une sous-page.
- **Page publique à bouton de confirmation** (3a) : la forme existe pour la désinscription (s25), pas au
  §7 ; à verser au §7 si elle est retenue.
- **Email « Confirmez cette adresse »** : huitième envoi, absent du §5.5. Gabarit du lien magique réutilisé,
  à inscrire au §5.5.
- **Accord du pronom** (« quand il cliquera », 1c) : manque de s12d ; à reformuler sans pronom au plan
  (« L'adresse s'activera dès que le lien reçu sera cliqué »).
- §9 « Changement d'adresse email par le membre » (tranché par l'ADR 040) : **rouvert** par la story,
  à mettre à jour avec le nouvel ADR.
- Écarts propres à la maquette : polices non chargées (repli système), icônes simplifiées, barre latérale
  indicative.
