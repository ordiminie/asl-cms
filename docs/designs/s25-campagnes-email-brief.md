# Design Brief — Story s25-campagnes-email

> Brief à coller dans Claude Design. Il est autonome : story, écrans, contraintes, livrable.
> **Chaque écran en deux versions : bureau (desktop, 1 280 px) et mobile (390 px)**, même contenu et
> mêmes états.
> **Écrans web : thème clair seul** (ADR 033, qui remplace l'ADR 012 ; `docs/design-system.md` §10 :
> « une livraison de conception ne fournit plus de jeu sombre »). **Une seule exception : l'email.**
> Certains clients de messagerie (Outlook, Gmail Android) forcent le mode sombre quoi que fasse le
> site (§5.2) : **l'email d'habillage est donc livré en clair ET en « sombre forcé »**, avec les
> jumelles sombres arrêtées en §5.2 (copiées plus bas). Aucun écran web en sombre.

## Story

**En tant que** membre du bureau **je veux** envoyer une campagne email aux membres **afin de** les
informer sans passer par ma messagerie personnelle.

Critères d'acceptation :

1. N'importe quel membre du bureau compose une campagne, choisit un des **4 modèles** ou le **mode
   libre**, et l'envoie aux membres disposant d'une adresse email.
2. Le **nombre de destinataires est affiché avant l'envoi**, en distinguant ceux qui ont un email de
   ceux qui n'en ont pas.
3. Tout envoi, modèle ou libre, porte **le même habillage** : en-tête au logo de l'association et
   pied de page avec mentions et **lien de désinscription**.
4. Les **variables dynamiques** (nom, parcelle, date) sont remplacées par les valeurs du destinataire ;
   une **variable inconnue est signalée avant l'envoi**, pas laissée telle quelle dans l'email reçu.
5. Un **aperçu** montre le rendu final avec les données d'**un destinataire réel** avant l'envoi
   définitif.
6. Suivre le lien de désinscription du pied **enregistre le refus du membre, le lui confirme à
   l'écran, et se voit sur sa fiche côté bureau**.
7. Un membre désinscrit est **exclu** de la cible de l'envoi suivant **et de son décompte**.
8. La campagne envoyée est **archivée** avec son contenu, sa cible et sa date, et consultable en
   back-office.
9. Une campagne d'une association ne peut pas cibler les membres d'une autre (invisible à l'écran :
   rien à dessiner).

**Précisions de produit** (à respecter, pas à rediscuter) :

- **La cible est « tous les membres », et c'est tout.** Pas de choix de cible, pas de groupes, pas de
  « impayés » (autres stories) : montrez « Tous les membres » comme une **information**, pas comme un
  champ.
- **Les 4 modèles** : relance manuelle · facture disponible · convocation à l'AG · publication de
  documents après l'AG. **Leur texte n'est pas encore rédigé** avec le bureau : chaque modèle est livré
  avec un **contenu provisoire, clairement marqué comme tel**, et ses variables déjà câblées. Le
  **mode libre** part d'un corps vide.
- **Le mode libre n'est pas un envoi brut** : il porte exactement le même habillage que les modèles.
- **Aucune promesse sur ce que le membre continuera de recevoir** après sa désinscription : la page de
  confirmation dit seulement que sa demande est enregistrée. (La distinction envois facultatifs /
  obligatoires arrive plus tard ; ne la dessinez pas, ne l'évoquez pas.)
- **Tout envoi porte le pied avec désinscription** (pied « facultatif », §5.4). Le pied « statutaire »
  (sans désinscription) n'est **pas** dans cette story.
- **Vocabulaire** : le back-office dit « **propriétaire** » dans la fiche et la liste (route
  `/bureau/proprietaires`) ; l'email et le décompte parlent de « **membres** » (vocabulaire du cahier
  des charges de la story). Gardez « membres » dans les écrans de campagne.
- **Un seul envoi, pas de planification** : pas de choix de date d'envoi, pas de brouillon enregistré.
  L'envoi est immédiat après confirmation.
- Un destinataire sans adresse email **n'est pas joint par cette campagne** (le courrier papier est une
  autre story) : l'écran le dit en une phrase, sans promettre de suite.

## Ce qui existe déjà (à ne pas redessiner)

- **Back-office** : barre latérale 248 px (tiroir sous 1 024 px), deux groupes « Le site » et
  « L'association » ; « L'association » contient aujourd'hui **Propriétaires, Identité, Réglages**.
  `breadcrumb` dès le 2ᵉ niveau.
- **Fiche d'un propriétaire** (`/bureau/proprietaires/{id}`) : `breadcrumb` « Propriétaires › {nom} »,
  `h1` = le nom (Source Serif 4, 34 px), **badges d'état dessous**, puis cartes empilées (Coordonnées,
  Accès à l'espace membre, Rôle, Parcelles, Notes et échanges). Ces cartes ne bougent pas ; on **ajoute
  seulement une mention de désinscription** (écran 5).
- **Éditeur de texte** `markdown-editor` : barre réduite (gras, italique, titre 2, titre 3, liste,
  lien), pas de tableau, de code ni de couleur.
- **Gabarits d'email d'association** (lien magique, message de contact, signalement) : en-tête au logo
  - pied. L'habillage commun de cette story les prolonge ; il **suit la charte email de §5**.
- **`<AssociationMark />`** : le logo, ou **le monogramme** quand l'association n'a pas de logo, **le
  nom toujours écrit à côté**.

## Écrans à produire

Six écrans et l'email. Données fictives : association **« ASL Les Pins »** (monogramme « LP », teinte
195), membres inventés (Marie Delorme, Paul Renaud, Claire Aubert, etc.), **382 membres** dont **296
joignables**, **71 sans email**, **15 désinscrits**.

| Écran | Route                               | Rôle                                         |
| ----- | ----------------------------------- | -------------------------------------------- |
| 0     | barre latérale du back-office       | point d'entrée « Campagnes »                 |
| 1     | `/bureau/campagnes`                 | archive : liste des campagnes envoyées       |
| 2     | `/bureau/campagnes/nouvelle`        | composer : modèle, message, décompte         |
| 3     | `/bureau/campagnes/nouvelle/apercu` | aperçu avec un destinataire réel, puis envoi |
| 4     | `/bureau/campagnes/{id}`            | une campagne archivée, en lecture seule      |
| 5     | `/bureau/proprietaires/{id}`        | mention « désinscrit » sur la fiche          |
| 6     | `/desinscription/{jeton}` (public)  | désinscription, confirmation, lien invalide  |
| E     | l'email reçu                        | habillage commun, clair et sombre forcé      |

### Écran 0 — Point d'entrée

Une entrée **« Campagnes »** dans le groupe **« L'association »**, **après « Propriétaires »**, **sans
icône** (comme les autres entrées de ce groupe), en item actif sur toutes les routes `/bureau/campagnes…`
(fond `sidebar-accent` + libellé en 600). Montrez la barre latérale seule, état actif, puis tiroir mobile.
→ _Voir « Manques » n° 1 (le groupe n'a pas d'icône pour cette entrée ; confirmer le groupe)._

### Écran 1 — Archive des campagnes

- **Titre** : `h1` « Campagnes » (Source Serif 4 34 px). Dessous, une phrase `muted-foreground` :
  « Les campagnes déjà envoyées aux membres. »
- **Action principale** (une seule `default` de l'écran) : **« Écrire une campagne »**, en haut à droite
  (desktop), pleine largeur 56 px sous le titre (mobile).
- **Tableau** (`table`, lignes 56 px, zébrure, **une seule action par ligne, en clair**) :
  **Objet** (600, l'identité de la ligne) · **Envoyée le** (`data`, `jj/mm/aaaa hh:mm`) · **Par**
  (nom de l'auteur) · **Modèle** (texte : « Convocation à l'AG », « Message libre »…) ·
  **Destinataires** (`data`, alignés à droite, ex. « 296 ») · action **« Consulter »** (lien). Trié
  de la plus récente à la plus ancienne. **25 lignes par page**, « Précédent / Suivant » écrits,
  « Page 1 sur 2 ». Aucune recherche, aucun filtre (hors périmètre).
- **Mobile** : le tableau passe en **cartes empilées** (§3.5) : l'objet en titre, les autres colonnes
  en paires libellé / valeur dans le même ordre, « Consulter » pleine largeur 56 px ; **10 cartes par
  page**.
- **États** : **a · rempli** (quatre campagnes) · **b · vide** — « Aucune campagne envoyée pour
  l'instant. » + l'action pour le combler : « Écrire la première campagne » (la même `default`, pas une
  seconde) · **c · chargement** — `skeleton` sur les lignes (titre et bouton déjà présents) ·
  **d · erreur de chargement** — `alert` `destructive` ancré : « La liste des campagnes n'a pas pu être
  chargée. Rien n'est perdu : vos campagnes envoyées sont conservées. Rechargez la page. »

### Écran 2 — Composer une campagne

Une colonne de **720 px maximum** (desktop), pleine largeur avec marges 16 px (mobile), trois `card`
empilées (32 px), puis les actions. `breadcrumb` « Campagnes › Nouvelle campagne ». `h1` « Écrire une
campagne ».

1. **Carte « 1 · Modèle »** — **`radio-group`** de **5** choix, un par ligne (cible 56 px, le nom en
   600, **une phrase d'usage** en `meta` dessous, **la sélection se lit** par la bordure 2 px
   `primary` + le point, jamais la couleur seule) :
   - **Message libre** — « Vous écrivez le message en entier. » _(présélectionné)_
   - **Relance manuelle** — « Rappeler un paiement en attente à un membre. »
   - **Facture disponible** — « Prévenir qu'une facture est consultable. »
   - **Convocation à l'AG** — « Convoquer à l'assemblée générale. »
   - **Documents après l'AG** — « Annoncer la publication des documents de l'assemblée. »

   Choisir un modèle **remplit** l'objet et le corps de la carte suivante (et remplace ce qui s'y
   trouve : une phrase l'annonce si du texte a déjà été saisi, voir état `h`). **Au-delà de 3 options,
   `select` est la règle** (§2.1) ; ici **on garde le `radio-group`** parce que chaque choix porte une
   phrase d'usage — à signaler en marge (« Manques » n° 2).
   - **Marqueur de contenu provisoire** : pour un **modèle** (pas pour « Message libre »), un `alert`
     **`warning`** (trio `warning`, `AlertTriangle`, le mot **« Texte provisoire »** écrit, filet 2 px)
     juste sous le `radio-group` : « Texte provisoire. Le contenu de ce modèle reste à rédiger avec le
     bureau : relisez-le et adaptez-le avant l'envoi. » (→ « Manques » n° 3.)

2. **Carte « 2 · Message »** — champs, une colonne, libellés au-dessus :
   - **Objet** — `input` 48 px (56 mobile). Aide : « Le nom de l'association est ajouté devant l'objet :
     « ASL Les Pins — … ». » Compteur de caractères sur **60** (§3.9).
   - **Texte d'aperçu** — `input`, libellé « Texte d'aperçu », aide « La ligne grise que la messagerie
     affiche à côté de l'objet. Facultatif. », compteur sur **90**. (Libellé **« Facultatif » écrit**,
     jamais d'astérisque.)
   - **Message** — `markdown-editor` (barre réduite). Dessous, **« Variables disponibles »** : trois
     lignes en `data` — `{nom}` « le nom du membre », `{parcelle}` « ses parcelles actuelles »,
     `{date}` « la date d'envoi » — avec la phrase « Elles sont remplacées pour chaque destinataire.
     Une variable que nous ne connaissons pas bloque l'envoi. » (Liste écrite, pas de composant
     nouveau : voir « Manques » n° 4.)
   - **Une ligne d'information** `meta` : « Les réponses arrivent à contact@lespins.example. » (adresse
     de contact de l'association, lecture seule). → « Manques » n° 5.

3. **Carte « 3 · Destinataires »** — **c'est le décompte** (critères 2 et 7). Un titre « Tous les
   membres » (le seul choix, écrit en `body-strong`, **pas un champ**), puis **trois paires libellé /
   valeur** (valeurs en `data`, `tabular-nums`, alignées à droite) :
   - **Recevront cette campagne** — **296**
   - **Sans adresse email** — **71** — avec la phrase « Cette campagne ne les joint pas. »
   - **Désinscrits (exclus)** — **15**

   puis, séparées d'un filet, une ligne **« Membres au total · 382 »** en `meta`. **La somme doit se
   lire** : 296 + 71 + 15 = 382. Si le décompte est à 0 destinataire : état `g`.

4. **Actions** — un seul `default` : **« Voir l'aperçu »** (256 px mini, pleine largeur 56 px en
   mobile) ; lien « Annuler » à côté (mobile : dessous). Aucun bouton « Envoyer » ici : l'envoi se
   confirme sur l'écran 3.

**États (desktop et mobile)** :

- **a · Modèle choisi, texte provisoire** — « Convocation à l'AG » sélectionné, objet et corps pré-remplis.
- **b · Message libre, vierge** — objet et message vides, compteurs à « 0 / 60 », « 0 / 90 ».
- **c · Erreurs de saisie** — résumé ancré `destructive` en tête de la page (bordure 2 px,
  `role="alert"`, titre en 700, liens d'ancrage) : « 2 champs à corriger. Rien n'a été envoyé. » —
  objet vide (« Écrivez l'objet de la campagne. »), message vide (« Écrivez le message. »). Chaque champ
  fautif en bordure 2 px + message dessous.
- **d · Compteur dépassé** — « 7 caractères de trop. » sur l'objet (bordure 2 px, `--destructive-text`,
  graisse 600).
- **e · Variable inconnue** (critère 4) — `alert` `destructive` ancré en tête, **qui nomme la variable
  et dit quoi faire** : « Variable inconnue : {parcele}. Elle n'est pas remplacée dans l'email.
  Corrigez-la, ou remplacez-la par {parcelle}, {nom} ou {date}. » Le bouton « Voir l'aperçu » reste
  **visible et actif** (§3.10 : une limite atteinte se dit au clic, jamais un bouton muet) ; l'alerte
  s'affiche au clic.
- **f · Succès du remplissage** — après un changement de modèle quand du texte existait : `alert` neutre
  (`CircleCheck` en `primary`) : « Modèle appliqué. L'objet et le message ont été remplacés. »
- **g · Aucun destinataire** — décompte à **0** : la carte 3 dit « Aucun membre ne peut recevoir cette
  campagne : aucun n'a d'adresse email, ou tous sont désinscrits. » ; « Voir l'aperçu » reste visible,
  son clic donne l'alerte `destructive` « Il n'y a personne à qui envoyer cette campagne. »
- **h · Remplacement du texte** — `alert-dialog` quand on change de modèle alors que du texte a été
  saisi : « Remplacer votre texte ? Le texte déjà écrit sera effacé. » Boutons **« Remplacer le
  texte »** (`destructive`, nomme l'acte) / « Garder mon texte » (`outline`).
- **i · Chargement du décompte** — `skeleton` sur les trois valeurs de la carte 3, le reste présent.
- **j · Mobile** (390 px) — états a, c, e : cartes pleine largeur, champs 56 px, boutons **empilés, le
  principal en premier**.

### Écran 3 — Aperçu, puis envoi

`breadcrumb` « Campagnes › Nouvelle campagne › Aperçu ». `h1` « Aperçu avant l'envoi ». Même colonne que
l'écran 2 mais **plus large** (le cadre email fait 600 px) : 720 px de gouttière, cadre email centré.

- **Bandeau d'identité de l'aperçu** (`card`) : « Aperçu avec les données de **Claire Aubert**, membre
  de l'association. » (le membre est **réel**, tiré de la liste des joignables) ; un `select`
  « Voir avec un autre membre » (libellé visible) pour changer de destinataire ; aide « Rien n'est envoyé
  tant que vous n'avez pas confirmé. »
- **Le cadre email** : un cadre de 600 px (largeur d'un email, **fond `muted` autour**, bordure 1 px
  `border`) contenant **le rendu final** — habillage de l'écran E, avec le nom, la parcelle (« 12, 14 »)
  et la date d'envoi **remplacés** ; l'**objet** (« ASL Les Pins — Convocation à l'assemblée générale »)
  et le **texte d'aperçu** s'affichent **au-dessus du cadre**, comme dans une boîte de réception
  (`meta`). En mobile, le cadre est fluide (pleine largeur, 390 px).
- **Un rappel du décompte**, juste au-dessus des actions : « **296 membres** recevront cette campagne ·
  71 sans email et 15 désinscrits n'en recevront pas. »
- **Si le texte est encore provisoire** (modèle non modifié) : le même `alert` `warning` « Texte
  provisoire » que sur l'écran 2, **au-dessus du cadre** (l'envoi n'est pas bloqué, mais on le dit une
  seconde fois).
- **Actions** : **« Envoyer à 296 membres »** (`default`, le **nombre écrit dans le libellé**), et
  « Modifier le message » (`outline`, retour à l'écran 2 **avec tout ce qui a été saisi**). Mobile :
  empilés, le principal en premier, 56 px.
- **Confirmation** : le clic sur « Envoyer… » ouvre un **`alert-dialog`** (l'acte est irréversible),
  titre « Envoyer la campagne ? », texte « 296 membres vont recevoir « ASL Les Pins — Convocation à
  l'assemblée générale ». L'envoi ne peut pas être annulé. », boutons **« Envoyer à 296 membres »**
  (`destructive`, nomme l'acte) / « Revenir à l'aperçu » (`outline`). Voile `--overlay`. **Mobile :
  ancré en bas**, pleine largeur, boutons 56 px empilés, le principal en premier ; pas de croix, Échap
  ferme.
- **Envoi en cours** : le bouton disparaît au profit d'une zone **`progress` déterminée** (la source
  compte vraiment : emails envoyés sur le total) : « Envoi en cours : 120 sur 296 membres. » Libellé
  seulement, **aucun pourcentage inventé**. L'écran **ne peut plus être validé deux fois**. Une phrase :
  « Ne fermez pas cette page tant que l'envoi n'est pas terminé. » (→ « Manques » n° 6.)

**États (desktop et mobile)** :

- **a · Aperçu** — le rendu complet d'un modèle (« Convocation à l'AG ») avec le décompte et les actions.
- **b · Aperçu, message libre** — même habillage autour d'un texte libre (prouve que le libre n'est pas
  brut).
- **c · Chargement** — `skeleton` à la place du cadre email ; l'identité du destinataire déjà écrite.
- **d · Variable inconnue** — l'aperçu **ne s'affiche pas** ; à la place l'`alert` `destructive` de
  l'écran 2 (e) avec un lien « Modifier le message ». (On ne montre jamais un rendu avec une variable
  laissée telle quelle.)
- **e · Confirmation** — l'`alert-dialog`.
- **f · Envoi en cours** — la `progress` à « 120 sur 296 ».
- **g · Envoi terminé** — redirection vers l'écran 4 avec un `alert` de succès (« Campagne envoyée à
  296 membres. Elle est archivée ci-dessous. », `CircleCheck` en `primary`, `role="status"`).
- **h · Envoi interrompu** — `alert` `destructive` ancré, **ce qui s'est passé, ce qui est perdu,
  l'action suivante** : « L'envoi s'est arrêté après 120 membres sur 296. Les 120 premiers ont reçu le
  message ; les 176 autres ne l'ont pas reçu. Contactez l'équipe technique avant de réessayer : relancer
  l'envoi écrirait deux fois aux 120 premiers. » Pas de bouton « Réessayer » (voir « Manques » n° 6).
- **i · Aucun email n'est parti** — `alert` `destructive` : « L'envoi est désactivé sur cet environnement :
  aucun email n'est parti. La campagne n'a pas été archivée. » (cas où l'envoi aux membres est coupé).
- **j · Échec avant tout envoi** — `alert` `destructive` : « La campagne n'a pas pu être envoyée. Rien n'est
  parti et votre message est conservé. Réessayez dans un instant. »
- **k · Mobile** (390 px) — états a, e, f.

### Écran 4 — Une campagne archivée

`breadcrumb` « Campagnes › {objet} ». `h1` = l'**objet** (« Convocation à l'assemblée générale »), un
badge `outline` « Envoyée » à côté (le mot porte l'information). Colonne 720 px, deux cartes :

1. **Carte « Résumé »** — paires libellé / valeur (labels `meta`, valeurs `body`) : **Envoyée le**
   (`data`, « 12/11/2026 à 14:32 »), **Par** (« Marie Delorme »), **Modèle** (« Convocation à
   l'AG » ou « Message libre »), **Cible** (« Tous les membres »), **Destinataires** (« 296 » en
   `data`), **Sans adresse email** (« 71 »), **Désinscrits exclus** (« 15 »).
2. **Carte « Contenu envoyé »** — l'**objet**, le texte d'aperçu, puis le **cadre email** (même rendu
   que l'écran 3) **avec les variables non remplacées** (`{nom}`, `{parcelle}` visibles telles qu'écrites)
   et la phrase « Chaque membre a reçu ce message avec ses propres valeurs. » (le contenu est archivé tel
   qu'écrit ; il n'y a pas un rendu par membre).

**Aucune action** (ni modifier, ni supprimer, ni renvoyer) : une campagne archivée est un fait. Un lien
« Retour aux campagnes » (`ArrowLeft` + libellé).
**États** : a · normale · b · chargement (`skeleton`) · c · **campagne introuvable** (`alert`
`destructive` : « Cette campagne n'existe pas ou n'appartient pas à votre association. » + lien « Retour
aux campagnes ») · d · mobile (a).

### Écran 5 — Mention « désinscrit » sur la fiche

Sur la fiche d'un propriétaire, **dans la ligne de badges sous le `h1`** : un badge `outline`
**« Désinscrit des campagnes »** (deux badges sur une ligne : `gap` 8 px, §3.9, retour à la ligne permis
en mobile) **et, juste dessous, une phrase `meta`** : « A refusé les campagnes email le 12/11/2026
(depuis le lien d'un email). » (date en `data`). **Aucune action** pour lever le refus. Sans refus : rien
n'est ajouté. Montrez la fiche avec la mention, puis sans ; mobile : les badges passent sous le titre.
États : a · désinscrit · b · non désinscrit · c · désinscrit **et sans email** (le badge « Sans email »
déjà existant à côté).
→ « Manques » n° 7.

### Écran 6 — La page publique de désinscription

**Pas de session, pas de back-office** : c'est la page qu'ouvre un membre, souvent âgé, depuis son
téléphone. `<AssociationMark size="public">` (logo ou monogramme + nom) en en-tête, `max-w-[68ch]`,
**texte 18 px**, un seul `h1` (Source Serif 4 34 px), **aucun menu**. Le texte est celui du **site
public** (18 px), pas celui du bureau.

États :

- **a · Demande de confirmation** — `h1` « Ne plus recevoir les campagnes de l'ASL Les Pins ». Texte :
  « Vous êtes sur le point de ne plus recevoir les campagnes que le bureau envoie par email aux
  membres. » Un seul bouton `default` **« Me désinscrire »** (56 px sur mobile, pleine largeur) et un
  lien « Je garde les campagnes » (vers le site public). **Pas de formulaire**, pas de champ email
  (le lien est personnel).
- **b · Désinscription confirmée** (critère 6 — « le lui confirme à l'écran ») — `alert` neutre
  (`CircleCheck` en `primary`, `role="status"`) en tête : « C'est enregistré. Vous ne recevrez plus les
  campagnes de l'ASL Les Pins à cette adresse. » **Rien de plus** : **aucune phrase** sur ce qui
  continuera ou non d'arriver. Un lien « Aller sur le site de l'association ».
- **c · Déjà désinscrit** — même `h1`, `alert` neutre : « Vous êtes déjà désinscrit. Rien d'autre à
  faire. »
- **d · Lien invalide ou modifié** — `h1` « Ce lien ne fonctionne pas ». `alert` `destructive` : « Ce
  lien de désinscription n'est pas valide. Rien n'a été modifié. Vous pouvez écrire au bureau de
  l'association : {adresse de contact}. » (adresse de contact des réglages ; **pas de numéro de
  téléphone** : aucun réglage n'en porte).
- **e · Échec technique** — `alert` `destructive` : « Votre demande n'a pas pu être enregistrée.
  Rien n'a changé. Réessayez dans un instant. » + le bouton « Me désinscrire » conservé.
- **f · Mobile** (390 px) — états a, b, d.

**À ne pas dessiner** : aucun écran de « préférences » à plusieurs cases, aucune ré-inscription, aucune
liste de ce que le membre reçoit encore. → « Manques » n° 8.

### Écran E — L'email d'habillage

**Charte email (§5)** : 600 px, tables imbriquées, **une colonne**, styles en ligne, **hexadécimal**
(jamais OKLCH), `Georgia, serif` pour les titres, `Helvetica, Arial, sans-serif` pour le texte, **corps
17 px / 1,6**, titres 24 px. **Rien d'indispensable dans une image.** Boutons en tables, ≥ 48 px,
**toujours doublés de l'URL en clair juste dessous**.

Structure, de haut en bas :

1. **Pré-en-tête** masqué : le texte d'aperçu (90 caractères).
2. **En-tête** — fond `accent` (`#E8F5F8`), filet bas `accent-solid` (`#17849B`) : **logo PNG de 36 px**
   (ou, sans logo, le monogramme « LP » sur `accent-solid`) **et le nom de l'association écrit à côté**,
   `accent-foreground` (`#185A66`). Le logo porte un `alt` = le nom ; **l'en-tête reste lisible sans lui**.
3. **Corps** — un `h1` de 24 px = l'objet sans préfixe ; le **message** (paragraphes, gras, italique,
   listes, liens) en 17 px. Les valeurs **remplacées** sont du texte ordinaire (rien ne les distingue).
   Pour le **mode libre**, une image facultative est possible (« dont le texte se passe »).
4. **Pied de page « facultatif »** (§5.4) — fond `muted` (`#F6F7F8`), texte `muted-foreground`
   (`#52565E`) : le nom de l'association en `body-strong` ; **les mentions** (raison sociale, adresse
   postale, 3 lignes, **illustratives**) ; une phrase de motif : « Vous recevez cet email parce que vous
   êtes membre de l'ASL Les Pins. » ; puis **un bouton de désinscription visible** — **« Ne plus recevoir
   ces campagnes »** (bouton `outline`-like en table, contour `input` `#8E939C`, ≥ 48 px) **doublé de
   l'URL en clair** dessous — **pas un lien perdu dans une ligne de 12 px**. Ajoutez la phrase du pied
   facultatif : « Se désinscrire ne vous prive d'aucune information obligatoire. »
   **Attention : cette dernière phrase est reprise du design system (§5.4) ; elle n'est pas une promesse
   détaillée.** Ne l'étoffez pas.
5. **Aucune** mention de « lien magique », aucune formule « vous ne pouvez pas vous désinscrire ».

**Versions à produire (bureau et mobile, chacune en clair ET en sombre forcé)** :

- **E1 · Message libre** (corps court, une image facultative absente).
- **E2 · Modèle « Convocation à l'AG »** (le corps contient une liste numérotée et une ligne « Texte
  provisoire » repérable, voir plus bas) — c'est le modèle qui exerce le plus l'habillage.
- Un **cadre de boîte de réception** (ligne objet + texte d'aperçu) **au-dessus de E2**, pour montrer
  ce que le membre voit avant d'ouvrir.
- **Sombre forcé** (§5.2) : mêmes écrans, fond `#171A1E`, texte `#E8EBEF`, texte atténué `#9DA6AE`, filets
  `#32363A`, bouton `#2063B0` / `#FFFFFF` (blanc forcé), lien `#8CC3FC`. **Peuvent être sacrifiés** : le
  fond de l'en-tête, la teinte de l'association, les filets. **Doivent rester lisibles** : le corps, le
  bouton de désinscription, l'URL en clair, le pied.
- **Marqueur provisoire dans le texte envoyé** : les modèles livrent un contenu provisoire (marqué à
  l'écran de composition, mais rien n'empêche un envoi). Montrez, **dans le corps de E2**, une **première
  ligne en gras** « [Texte provisoire — à remplacer avant l'envoi] » : elle est écrite dans le texte, elle
  se voit à l'aperçu, et c'est le bureau qui la supprime. (→ « Manques » n° 3.)

## Contraintes du design system (non négociables)

### Jetons — thème clair seul (web)

```
--background: oklch(1 0 0);                 --foreground: oklch(0.22 0.015 250);
--card: oklch(1 0 0);                       --card-foreground: oklch(0.22 0.015 250);
--muted: oklch(0.972 0.005 240);            --muted-foreground: oklch(0.45 0.02 245);
--border: oklch(0.9 0.008 245);             --input: oklch(0.66 0.014 245);   /* contour de champ, 3:1 */
--ring: oklch(0.55 0.11 235);
--primary: oklch(0.35 0.06 240);            --primary-foreground: oklch(0.985 0.003 240);
--secondary: oklch(0.965 0.006 240);        --secondary-foreground: oklch(0.3 0.02 245);
--destructive: oklch(0.48 0.17 27);         --destructive-foreground: oklch(0.99 0.01 27);
--destructive-text: oklch(0.48 0.17 27);    /* texte d'erreur */
--link: oklch(0.45 0.13 250);               /* toujours souligné */
--warning: oklch(0.94 0.06 75);             --warning-border: oklch(0.6 0.13 65);
--warning-foreground: oklch(0.3 0.08 60);
--accent-hue: 195;  --accent: oklch(0.958 0.024 195);  --accent-foreground: oklch(0.38 0.08 195);
--accent-solid: oklch(0.55 0.1 195);        --accent-border: oklch(0.88 0.045 195);
--overlay: oklch(0.22 0.015 250 / 0.5);     /* voile du dialog et de l'alert-dialog */
--table-stripe: oklch(0.99 0.002 250);      --table-row-hover: var(--muted);
--sidebar: oklch(0.985 0.004 250);          --sidebar-accent: oklch(0.93 0.012 245);
--sidebar-border: oklch(0.91 0.008 245);
--radius: 0.5rem;
```

**Accent de l'association** : identité seulement (logo, filet de navigation active, encarts). **Jamais
sur un bouton, jamais comme seul porteur d'un statut.** `primary` pour toute action, toute sélection,
toute icône fonctionnelle. Survols de menus et de lignes en `secondary`, jamais en accent.

### Jetons — email (hexadécimal, §5.2 et §5.3)

| Rôle                                    | Clair                             | Sombre forcé                        |
| --------------------------------------- | --------------------------------- | ----------------------------------- |
| fond du corps                           | `#FFFFFF`                         | `#171A1E`                           |
| texte                                   | `#151B21`                         | `#E8EBEF`                           |
| texte atténué                           | `#4C5760`                         | `#9DA6AE`                           |
| filet                                   | `#DFE1E5`                         | `#32363A`                           |
| bouton (fond / texte)                   | `#193E57` / `#FFFFFF`             | `#2063B0` / `#FFFFFF` (blanc forcé) |
| lien                                    | `#00579A`                         | `#8CC3FC`                           |
| en-tête : fond / filet / nom            | `#E8F5F8` / `#17849B` / `#185A66` | peuvent être sacrifiés              |
| pied : fond / texte                     | `#F6F7F8` / `#52565E`             | `#171A1E` / `#9DA6AE`               |
| encre du contour d'un bouton secondaire | `#8E939C`                         | `#8E939C`                           |

### Typographie

- **Source Serif 4** (titres) : `h1` 34 px / 600 / 1.15 ; `h2` de carte du back-office 24 px / 600 ;
  `h3` Public Sans 20 px / 600 pour un titre de carte du back-office quand c'est le cas.
- **Public Sans** (interface) : `body` 17 px / 400 / 1.6 (privé) ; **`body-lg` 18 px / 1.65 (site
  public, donc la page de désinscription)** ; `body-strong` 17 px / 600 ; `label` 16 px / 500 (libellés,
  toujours visibles) ; `button` 16-17 px / 600 ; `meta` 15 px / 400 — plancher absolu 15 px.
- **JetBrains Mono** : `data` 15-17 px, `tabular-nums` — dates, heures, nombres de destinataires,
  variables `{nom}`.
- Pas de graisse 300, pas d'italique porteur d'information, pas de capitales au-delà de trois mots.
  Typographie française : espace insécable avant `: ; ! ?`, guillemets « », apostrophe courbe.
- **Email** : `Georgia, serif` / `Helvetica, Arial, sans-serif`, corps 17 px, titres 24 px.

### Espacement, rayon, bordures, ombres

- Échelle : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px. **Toute mesure hors échelle est un bug.**
- Rayon : 4 px puces ; **8 px champs, boutons, cartes** ; 12 px dialogues.
- Bordures : 1 px `border` séparation ; 1 px `input` champ ; **2 px `primary` sélection ; 2 px
  `destructive` erreur** (épaisseur unique de « quelque chose ne va pas »).
- Ombres : **aucune** sur cartes et tableaux (la bordure suffit) ; `shadow-lg` seulement sur dialogues.
  Transitions ≤ 120 ms. Pas de dégradé, pas de verre dépoli, pas d'animation d'apparition.
- Focus : `outline: 2px solid var(--ring); outline-offset: 2px`, jamais retiré. Cibles ≥ 44 × 44 ;
  **56 px pour les actions principales sur mobile**. Aucune action au survol seul.
- Points de rupture : `sm` 640 · `md` 768 · `lg` 1024 (barre latérale 248 px → tiroir sous `lg`) ·
  `xl` 1280. Marges 16 px sous 1 024 px. Site public : `max-w-[1200px]`, article `max-w-[68ch]`.

### Composants à réutiliser (rien d'autre)

- **`card`** — bordure 1 px, sans ombre, padding 24 px (16 px mobile), `h2` serif (24 px).
- **`button`** — `default` 48 px (56 mobile), `outline`, `destructive`, `link`. **Un seul `default`
  par écran**, les autres en `outline`. Libellés à l'infinitif explicite, jamais « OK ». Chargement :
  libellé remplacé, bouton désactivé, **largeur conservée**. **`sm` 40 px : jamais côté membre** (la
  page publique de désinscription est côté membre).
- **`form` `label` `input` `textarea` `select` `radio-group`** — une colonne, un champ par ligne, libellé
  au-dessus, champs 48 px (56 mobile), texte 17 px, « Facultatif » écrit, **jamais d'astérisque, jamais
  de placeholder en guise de libellé**. Validation au _blur_ puis à la soumission. `radio-group` pour
  2-3 options courtes, `select` au-delà.
- **Compteur de caractères** (§3.9) — `meta` aligné à droite, neutre jusqu'au plafond inclus, rouge
  seulement au dépassement et avec un message écrit.
- **`markdown-editor`** — barre réduite : gras, italique, titre 2, titre 3, liste, lien.
- **`table` `pagination` `badge`** — lignes 56 px, zébrure, **une seule action par ligne, en clair**,
  25 lignes par page (**10 cartes** sous 640 px), « Précédent / Suivant » écrits. `badge` = statut,
  jamais une action. Deux badges sur une ligne : `gap` 8 px.
- **`alert`** — **succès** : `alert` neutre avec `CircleCheck` en `primary` (pas de vert, pas de token
  « succès ») ; **erreur** : `destructive`, bordure 2 px, `role="alert"`, ancré dans la page, ne
  disparaît pas seul ; **avertissement** : trio `warning` + `AlertTriangle` + mot écrit. **Rien
  d'important dans un toast.**
- **`alert-dialog`** — uniquement pour l'irréversible, le bouton nomme l'acte. **Mobile** : ancré en bas,
  pleine largeur, boutons 56 px empilés, le principal en premier, pas de croix.
- **`progress`** — pourcentage seulement quand la source compte vraiment (emails envoyés sur le total).
- **`skeleton`** — listes, tableaux et cadre d'aperçu, jamais un formulaire.
- **`breadcrumb`** (dès le 2ᵉ niveau), **`separator`**, **`sidebar`** (back-office seulement).
- **`<AssociationMark />`** — logo ou monogramme, le nom toujours écrit.
- **Icônes lucide** (16 / 20 / 24, trait 1,75, `currentColor`) : `CircleCheck`, `AlertTriangle`,
  `ArrowLeft`. **Jamais d'icône seule comme action** ; on n'en ajoute pas d'autre.

### Patrons déjà arrêtés qu'il faut suivre

- **États** (§3.2) : le vide dit ce qui manque **et** l'action pour le combler ; l'erreur dit ce qui
  s'est passé, **ce qui est perdu**, l'action suivante ; le succès dit ce qui a eu lieu et où le
  vérifier.
- **Erreurs** (§3.1, §3.9) : bordure 2 px + message sous le champ **+** résumé ancré en tête avec liens
  d'ancrage ; message de champ en 16 px / 500, `--destructive-text`.
- **Action refusée parce qu'une limite est atteinte** (§3.10) : le bouton reste **visible et actif**,
  le refus arrive en `alert` `destructive`.
- **Tableau sous 640 px** (§3.5) : cartes empilées, 10 par page.
- **Langue** (§3.6) : vouvoiement, phrases courtes, **aucun jargon** — **jamais « lien magique »,
  « token », « OTP », « authentification »** à l'écran. Les textes de la page publique et de l'email
  (« les campagnes de l'ASL Les Pins ») sont arrêtés dans ce brief : ne les remplacez pas. Dates
  `02/09/2026` en champ et en liste ; en clair côté public (« 12 novembre 2026 »).
- **Objets d'email** (§5.6) : préfixés « ASL Les Pins — », **60 caractères maximum**, l'information
  d'abord, **jamais de majuscules, jamais d'emoji, jamais « URGENT »** ; pré-en-tête de **90 caractères**
  qui complète l'objet sans le répéter ; réponse dirigée vers une boîte réellement lue.

### À ne pas faire

- ❌ Inventer un composant, un jeton, une couleur, une taille hors de ceux-ci.
- ❌ Une couleur seule pour porter une information (statut, sélection, erreur) : **le mot porte
  l'information**.
- ❌ Un `tabs`, une `sidebar` ou un menu d'icônes côté membre ; un `collapsible` ou un `tooltip` pour
  cacher une information utile ; un défilement infini ; un toast pour une confirmation qui compte.
- ❌ Texte courant sous 17 px ; astérisque pour l'obligatoire ; placeholder en guise de libellé.
- ❌ L'accent de l'association sur un bouton.
- ❌ Un jeu sombre **pour le web** (seul l'email a une version sombre forcée).
- ❌ En email : OKLCH, police web, flex/grid, bouton sans URL en clair dessous, information dans une image.
- ❌ « Vous ne pouvez pas vous désinscrire », ou **toute phrase sur ce que le membre continuera de
  recevoir** après sa désinscription.

Ne pas inventer de composants, de jetons ou de couleurs hors de ceux-ci.

## Hors périmètre

- **La cible et le ciblage** : aucun choix « impayés », aucun groupe, aucune liste de membres à cocher.
- **L'envoi échelonné, le plafond quotidien, le report au lendemain** : aucun écran, aucun compteur de
  budget. (Un envoi est immédiat ; seul l'échec en cours d'envoi est dessiné.)
- **Les statistiques** (ouvertures, clics, rebonds) et le **journal des envois par membre**.
- **Le brouillon enregistré, la planification, la duplication d'une campagne**, la modification ou la
  suppression d'une campagne archivée, la **ré-envoi**.
- **L'édition des modèles** : le bureau modifie le texte **d'une campagne**, pas le modèle lui-même.
- **Le pied « statutaire »** (sans désinscription) et la distinction facultatif / obligatoire.
- **Le publipostage papier** et les membres sans email (une phrase les nomme, c'est tout).
- **Une page de préférences d'envoi à plusieurs cases**, la **ré-inscription** (par le membre ou par le
  bureau).
- **Le téléphone du bureau** (aucun réglage ne le porte).
- **Les réglages de l'association** (raison sociale, adresse postale, mentions) : leur saisie est une
  autre page ; ici, on montre seulement leur effet dans le pied de l'email.
- L'espace membre, la liste des propriétaires, les quatre cartes existantes de la fiche.

## Livrable attendu

Une maquette HTML statique des écrans 0 à 6 et de l'email (basse fidélité acceptée) : **version bureau
(1 280 px) et version mobile (390 px)** pour chacun, **thème clair seul pour le web**, **clair et sombre
forcé pour l'email**, avec les états listés, n'utilisant que les jetons ci-dessus. Rapportez l'export :
il sera enregistré en `docs/designs/s25-campagnes-email.html`.

**Signalez en marge de la maquette (« ÉCART », « PROPOSITION », « NOTE », « AU PLAN ») tout besoin que
le design system ne couvre pas, sans le combler.** Huit sont déjà connus et à confirmer :

1. **Entrée « Campagnes » dans la barre latérale** — le design system ne prévoit que deux groupes
   (« Le site », « L'association »). Proposition : « Campagnes » dans « L'association », après
   « Propriétaires », sans icône. Confirmez ou proposez mieux avec l'existant.
2. **Choix du modèle** — cinq choix avec une phrase d'usage chacun : `radio-group` (cibles 56 px)
   plutôt que `select`, que §2.1 impose au-delà de trois options. Écart assumé, à valider.
3. **Marqueur « texte provisoire »** — `alert` `warning` à la composition et ligne en gras dans le corps
   du modèle. Le design system n'a pas de notion de « contenu à rédiger » ; confirmez ou proposez mieux
   avec l'existant (sans nouveau composant).
4. **Variables dynamiques** — liste écrite sous l'éditeur, saisie à la main : le design system n'a pas de
   bouton « insérer une variable ». Proposition possible : boutons `outline` de 40 px (`sm`) ; dites si
   c'est utile ou si la liste suffit.
5. **Adresse de réponse** (`Reply-To`) — ligne d'information en lecture seule sous le message. Le
   design system ne dit pas où se montre une donnée issue des réglages.
6. **Envoi en cours** — la barre `progress` déterminée, la consigne de ne pas fermer la page, et
   l'absence de « Réessayer » après une interruption (par risque de doublon). §2.1 autorise le
   pourcentage « quand la source compte vraiment » ; confirmez la forme.
7. **Mention « désinscrit » sur la fiche** — badge `outline` + phrase `meta`, sans carte nouvelle ni
   action. §3.10 range les statuts d'un workflow ; un refus n'en est pas un. Confirmez la forme.
8. **Page publique de désinscription** — le design system la nomme explicitement comme manque bloquant
   (« Page de préférences d'envoi », §9). Cette story n'en dessine que **la confirmation d'un seul
   refus** ; signalez tout ce que cette page appellerait de plus (préférences, ré-inscription) **sans
   le dessiner**.
