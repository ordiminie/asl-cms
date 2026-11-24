# Design — Story s42b-lancement-invitations

> Conçu le 2026-11-24, chemin **agent**. Source visuelle unique : `docs/design-system.md`. Contexte de
> code : `docs/research/s42b-lancement-invitations.md`, dont les **arbitrages du 24/11/2026** font foi
> (Q1, Q3, Q7, Q10). Écrans d'ancrage : s42a (fiche, email d'invitation, section « Invitation des
> membres »), s29 (`/bureau/relances` : page du système, plan écrit par rang), s26 (détail de campagne,
> états d'un envoi, part entamée de s52), s27/s27b (décompte d'une cible, nature des envois, pied
> statutaire), s28 (carte « Courrier postal », lettre §6.1), s02 (cartes générées des réglages).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)), sauf les jumelles sombres
> de l'email (§5.2).
>
> Contrôle visuel : fait le 2026-11-24 à 1280 et 390 px (détail en dernière ligne).

## Périmètre du design

Données fictives : association « Clos-Fleuri » (CF, teinte 195). 296 fiches : 225 avec au moins une
adresse email active, 71 sans (courrier). 312 adresses actives distinctes au lancement (dont 15
désinscrites), 3 en attente de confirmation. Plafond des campagnes : 100 par jour. Lancement et relance :
nature `statutaire` (seed).

| Écran | Route / support                                                    | États     |
| ----- | ------------------------------------------------------------------ | --------- |
| 1     | `/bureau/invitations` — zone « Lancement » et « Relancer »         | 1a à 1l   |
| 2     | `/bureau/invitations` — zone « Suivi » (adoption)                  | 2a à 2e   |
| 3     | Email de lancement (et de relance)                                 | 3a, 3b    |
| 4     | Courrier de lancement — une lettre du PDF (§6.1)                   | 4a        |
| 5     | `/bureau/reglages` — texte du courrier ; deux natures              | 5a, 5b    |
| 6     | `/bureau/campagnes/{id}` — deux phrases qui changent pour un lancement | 6a    |

**Non dessiné** : la fiche du propriétaire (s42a écran 1 montre déjà l'état d'invitation par adresse ;
une adresse partagée a le même état sur chacune de ses fiches, sans changement de forme) ; le reste du
détail de campagne (avancement, parts, destinataires : s26 inchangé) ; la page de calage (s28) ; la
page de désinscription (s27b : les deux nouveaux types y sont listés quand ils sont statutaires, forme
inchangée) ; la page « Envois » de s52 (le lancement y est une « Campagne »).

**Vocabulaire** : « invitation », « lancement », « relance », « lien de connexion », « jamais connectée ».
Jamais « lien magique », « jeton », « token » (§3.6, §8). « Invitations envoyées » = **adresses invitées
au moins une fois** (Q8), toutes origines (fiche, lancement, relance).

## Question 11 — tranchée ici

1. **Emplacement du suivi et du lancement** : une **page dédiée** `/bureau/invitations`, entrée
   « Invitations » du groupe « L'association » de la barre du bureau, **après « Relances », avant
   « Envois »** (patron de s29 : un envoi du système a sa page, pas un filtre). Écarté : un filtre de la
   liste des propriétaires — elle compte en **fiches**, le suivi en **adresses** (C7), et le lancement
   n'y aurait pas de place. Droit : `campaign.manage` (Q9) ; sans lui, `BureauAccessDenied`. Donnée par
   utilisateur : lue derrière `<Suspense>`, non cachée.
2. **Bloc d'invitation dans le gabarit de campagne** : l'habillage de `CampaignMail` (en-tête au logo,
   pied de campagne selon la nature) **entoure** le contenu de l'invitation de s42a, repris tel quel :
   titre, texte du tenant découpé en paragraphes **texte**, bouton « Ouvrir mon espace » + URL en clair,
   trois étapes avec l'échéance calculée à la livraison. Le pied transactionnel de s42a disparaît au
   profit du pied de campagne (désinscription obligatoire sur un envoi de masse).
3. **Objet sans double préfixe** : l'objet reçu est « Clos-Fleuri — Votre espace membre vous attend ».
   Le préfixe « {association} — » est posé **une seule fois**, par le gabarit de campagne
   (`finalSubject`) ; l'objet figé du lancement est donc « Votre espace membre vous attend », sans nom.
   La clé de l'invitation individuelle garde le sien (son gabarit ne préfixe pas).
4. **Gap « téléphone du bureau »** : remonté (gap 1), pas comblé. Les trois étapes se lisent sans numéro.

## Screen(s)

### Écran 1 — `/bureau/invitations`, zone « Lancement » puis « Relancer les jamais connectés »

`breadcrumb` « L'association › Invitations », `h1` « Invitations des membres », `meta` « Annoncer le
site à tous les propriétaires, puis suivre qui s'est connecté à son espace. »

**Carte « Lancement »** (`h2` serif 20 px) :

- **1a — avant le lancement.** Phrase d'usage : « Un seul envoi, une seule fois : chaque adresse email
  active reçoit une invitation avec son propre lien de connexion ; les membres sans adresse email
  reçoivent un courrier qui annonce le site. » Puis le **décompte d'une cible** (§3.14), deux `dl` :
  - **Fiches** — « Avec au moins une adresse email active — reçoivent l'invitation » 225 · « Sans adresse
    email active — reçoivent le courrier » 71 · (en `facultative` seulement : « Toutes leurs adresses
    désinscrites — ne reçoivent rien » n) · filet · « Fiches au total » 296.
  - **Adresses** — « Adresses qui recevront l'invitation » 312 · « Dont désinscrites des campagnes —
    elles la reçoivent : c'est un envoi statutaire » 15 (en `facultative` : « Désinscrites — exclues :
    c'est un envoi facultatif », hors du total) · « En attente de confirmation — ne reçoivent rien » 3.
  - `meta` : « Une adresse partagée par plusieurs fiches ne reçoit qu'une invitation. Une fiche dont les
    seules adresses attendent leur confirmation reçoit le courrier. »
  - Bouton **`default`** « Lancer les invitations » (icône `Send` 20 px, 48 px ; pleine largeur 56 px
    sous 640 px). Le seul `default` de la page tant que le lancement n'est pas parti.
  - `meta` : « Le texte de l'invitation et celui du courrier se règlent dans Réglages › Invitation des
    membres. » (lien).
- **1b — confirmation** (`alert-dialog` : le lancement est **irréversible**, un par association, Q7 ;
  patron de s26, ancré en bas sous 640 px). Titre « Lancer les invitations ? ». « **225 fiches**
  reçoivent l'invitation par email (312 adresses) · **71 fiches** reçoivent le courrier. » Puis, si le
  plafond ou le budget du jour étale l'envoi, le **plan écrit** (§3.13) : « Le lancement part en 4 jours :
  100 adresses aujourd'hui / demain / après-demain / 12 adresses le 27/11/2026 » ; sinon « Il part en une
  seule fois, aujourd'hui. » « Le courrier des 71 fiches sera prêt à télécharger dès aujourd'hui. Chaque
  lien de connexion vaut 7 jours à partir de son envoi. » `meta` : « Le lancement ne peut ni être annulé
  ni être refait. Ensuite, vous pourrez relancer les adresses jamais connectées. » Boutons
  `destructive` « Envoyer le lancement » et `outline` « Revenir ».
- **1c — parti** (juste après la confirmation) : `alert` neutre + `CircleCheck`, `role="status"` :
  « **Lancement parti.** 100 adresses le reçoivent aujourd'hui ; la suite part seule les 25, 26 et 27/11.
  Le courrier des 71 fiches est prêt : Courrier postal (71). » Le bouton « Lancer » **disparaît pour
  toujours**, remplacé par la **ligne du lancement** (plan écrit de s29, filet gauche 2 px) :
  « Lancement — 24/11/2026 » + badge d'état d'un envoi (§3.13 : « En cours d'envoi » `secondary`), `meta`
  « 100 reçues sur 312 adresses · 71 courriers · par Anne Martin » (auteur effectif, s48), liens « Voir
  l'envoi » (détail s26) et « Courrier postal (71) » (ancre `#courrier` du détail, s28).
- **1d — reporté par le budget** (s52) : `alert` neutre fond `muted` **sans icône** (§3.13, annonce de
  l'avenir) « Le lancement continue seul : **112 adresses** le recevront le 25/11/2026, la limite d'envois
  du jour étant atteinte. Vous n'avez rien à faire. » Badge « Programmée pour le 25/11 » `secondary`,
  `meta` « 200 reçues · 112 reportées au 25/11 · 71 courriers » (forme « Part entamée »). Jamais « En
  échec », « Bloquée » ni « Interrompue ».
- **1e — terminé** : badge « Envoyée » (`outline`, texte `muted-foreground`), `meta` « 312 adresses · 71
  courriers · par Anne Martin ». Une partie en échec ou à vérifier se lit dans le détail (s26), le badge
  de la ligne reprenant l'état de la campagne.

**Carte « Relancer les jamais connectés »** — rendue seulement **après** le lancement (avant, elle
n'existe pas) :

- Phrase : « Une nouvelle invitation part à chaque adresse active qui ne s'est jamais connectée, qu'elle
  ait déjà été invitée ou non. Par email seulement : la relance n'envoie aucun courrier. » (Q10)
- Décompte (§3.14, un `dl`) : « Adresses qui recevront la relance » 142 · « Dont jamais invitées —
  ajoutées depuis le lancement » 6 · « Dont désinscrites des campagnes — elles la reçoivent : c'est un
  envoi statutaire » 9 (en `facultative` : « Désinscrites — exclues ») · « En attente de confirmation — ne
  reçoivent rien » 3.
- Bouton **`default`** « Relancer les jamais connectés » (`Send`) — devient l'action de la page une fois
  le lancement parti. `meta` : « Les liens encore valides de ces adresses cesseront de fonctionner :
  chacune reçoit un lien neuf. »
- Les relances déjà faites s'affichent en lignes de plan écrit au-dessus du bouton : « Relance —
  01/12/2026 » + badge + « 142 adresses ».
- **1f — confirmation** (`alert-dialog`) : « Relancer 142 adresses ? » + plan écrit ou « Elle part en
  une seule fois, aujourd'hui. Aucun courrier n'est produit. » `meta` « Les adresses connectées entre-temps
  sont écartées au moment de l'envoi. » (Q4, laissée au plan.) `destructive` « Envoyer la relance »,
  `outline` « Revenir ».
- **1g — relance en cours** : tant que le lancement ou une relance a encore des parts à envoyer, le
  bouton laisse la place à une `meta` « Une relance est en cours d'envoi : vous pourrez relancer quand
  elle sera entièrement partie. » (« Le lancement est en cours d'envoi : … » pendant le lancement).
  **Choix du design, à confirmer au plan** : il évite deux liens concurrents pour une même adresse.
- **1h — personne à relancer** : `alert` neutre `muted` sans icône, sans action (file qui se vide seule,
  §3.13 s52) : « Personne à relancer : toutes les adresses actives se sont connectées au moins une
  fois. »

**Refus, erreur, chargement** (ancrés dans la carte, jamais un toast) :

- **1i — refus métier** :
  - lancement déjà fait (autre onglet, double clic) : `alert` neutre `muted` + `Info` « **Le lancement a
    déjà été envoyé** le 24/11/2026 par Anne Martin. Rien n'est reparti. » + lien « Voir l'envoi » ;
  - association sans adresse de site : `alert` `warning` + `AlertTriangle` « **Le lancement attend la mise
    en ligne du site.** L'association n'a pas encore d'adresse de site : les liens de connexion ne
    peuvent pas être créés. Rien n'a été envoyé. » ;
  - envois aux membres coupés par les réglages : `alert` `warning` « **Les envois d'emails aux membres
    sont coupés.** Rien n'a été envoyé. Ils se rétablissent dans les réglages de l'association. »
- **1j — échec à la création** : `alert` `destructive` 2 px `role="alert"` « **Le lancement n'est pas
  parti.** Aucun email n'a été envoyé, aucun courrier préparé. Réessayez dans quelques minutes. » Le
  bouton reste.
- **1k — chargement** : `skeleton` des décomptes ; pendant l'action, bouton désactivé « Lancement en
  cours… » (« Relance en cours… »), largeur conservée.
- **1l — lecture impossible** : `alert` `destructive` « **Les invitations ne peuvent pas être lues pour
  l'instant.** Rien n'est perdu et rien n'a été envoyé. Rechargez la page dans un instant. » Jamais un
  décompte à zéro trompeur.

### Écran 2 — `/bureau/invitations`, zone « Suivi »

Sous la relance (sous le lancement avant celui-ci), même page.

**Carte « Suivi »** — compteur `dl` (§3.13), quatre paires en bureau, une par ligne sous 640 px :
« Invitations envoyées » (adresses invitées au moins une fois) · « Adresses connectées » · « Jamais
connectées » (actives) · « En attente » (adresses en attente de confirmation ; plus tard « désactivées
par l'import », s56). `meta` : « Compté en adresses. « Connectée » : une connexion réussie au moins une
fois sur le site de l'association, pas un clic sur le lien. » Puis « **Couverture des fiches** », compteur
à trois paires, **en fiches** (C5) : « Par email » · « Par courrier » · « Ni l'un ni l'autre » (0 sous la
nature du seed). Pas de `progress` : le design system le réserve à l'envoi et au quota (gap 4).

- **2a — avant le lancement** : mêmes chiffres, nourris par les invitations individuelles (s42a). Les
  comptes connectés avant s42a n'ont pas de trace et comptent « jamais connectés » : la `meta` du
  compteur peut le dire au plan si le bureau s'en étonne (note de la revue s42a).

**Carte « Adresses jamais connectées »** — `table` (§2.1), **une ligne par adresse**, triée par nom de
fiche, 25 par page (10 cartes sous 640 px), « Précédent / Suivant » écrits ; résumé `meta`
`aria-live="polite"` au-dessus : « 145 adresses — dont 3 en attente de confirmation, qui ne reçoivent
rien. » Colonnes :

- **Adresse** (`data`, coupe autorisée). Une adresse portée par plusieurs fiches (s53) a **une seule
  ligne** et la `meta` « Même adresse sur 2 fiches : un seul état ».
- **Fiche** — nom en lien vers la fiche + `meta` « parcelle 21 » ; plusieurs fiches empilées.
- **Invitation** — « Invitée le 24/11/2026 » (dernier envoi parti) ou « Jamais invitée » + `meta`
  « ajoutée le 28/11/2026 » ; une adresse **en attente** porte le badge `warning` « En attente de
  confirmation » (celui de s54) + `meta` « ne reçoit rien tant qu'elle n'est pas confirmée ». Quand s56
  sera livrée, une adresse désactivée par l'import portera un badge `outline` « Désactivée par
  l'import », même `meta` ; d'ici là, seule l'attente est marquée (note de la story).
- **Aucune action par ligne** : relancer est un acte de masse (écran 1), inviter une seule personne se
  fait depuis sa fiche (s42a, le nom y mène).

Sur la fiche elle-même (s42a écran 1), l'état d'une adresse partagée est le même sur chacune de ses
fiches : une adresse = un compte = une trace. Aucun changement de forme.

**Carte « Ont refusé les envois facultatifs »** (2c, Q3) — rendue **seulement** si le lancement a été
envoyé en `facultative` et qu'au moins une fiche a toutes ses adresses désinscrites : `alert` neutre
`muted` sans icône « Ces **2 fiches** n'ont reçu ni email ni courrier : toutes leurs adresses sont
désinscrites des campagnes, et le lancement est un envoi facultatif. », puis la liste écrite à filet
gauche (noms en lien vers la fiche + parcelle). La paire « Ni l'un ni l'autre » du compteur vaut alors
ce nombre.

- **2b** — suivi après lancement ; **2c** — nature facultative ; **2d** — liste vide : `alert` neutre
  `muted`, sans action, « Aucune adresse en attente de première connexion. Toutes les adresses se sont
  connectées au moins une fois. » ; **2e** — chargement : `skeleton` du compteur et de trois lignes,
  `aria-busy` ; erreur : 1l (une seule alerte pour la page).

### Écran 3 — Email de lancement (et de relance)

Gabarit commun des campagnes (§5.1 à §5.6) : 600 px, tables, Georgia / Helvetica, corps 17 px,
hexadécimal de `theme.ts`, en-tête teinté au logo (nom seul sinon). La relance reçoit **le même
email** ; seule sa nature (réglage propre) décide du pied.

- **Objet** : « Clos-Fleuri — Votre espace membre vous attend » (préfixe une fois, voir Q11). **Pré-en-tête** :
  « Un espace personnel vous est ouvert sur le site de l'association. Aucun mot de passe à retenir. »
- **Titre** 24 px : « Votre espace sur le site de Clos-Fleuri ».
- **Texte de l'invitation** (réglage `invitation.text` ou défaut de s42a), en paragraphes **texte**,
  jamais Markdown ni HTML.
- **Bloc d'invitation** : bouton en table « Ouvrir mon espace » (`buttonBg`, blanc forcé) + « Ou recopiez
  ce lien dans votre navigateur : » + URL en clair ; trois étapes numérotées de s42a (échéance « jusqu'au
  1er décembre 2026 » calculée à la livraison de chaque destinataire). Le lien naît à la livraison : il
  n'est ni dans l'archive, ni dans un journal.
- **Pied de campagne** (§5.4) — `statutaire` (seed) : « Vous recevez cet email parce que vous êtes
  membre de Clos-Fleuri. » · « Ce message vous parvient même si vous vous êtes désinscrit des campagnes :
  votre appartenance à Clos-Fleuri vous engage à en être informé. » · bouton « Ne plus recevoir les
  campagnes facultatives » + URL en clair · « Se désinscrire ne vous prive d'aucune information
  obligatoire. » · mentions légales. En `facultative` : pied de s25 inchangé (« Ne plus recevoir ces
  campagnes »), sans la phrase statutaire. `List-Unsubscribe` sur les deux.
- **3a** clair ; **3b** jumelle sombre (§5.2 : `#171A1E`, `#E8EBEF`, bouton `#2063B0` blanc forcé, lien
  `#8CC3FC`, mentions `#9DA6AE`, filets `#32363A`).
- **Version texte** : titre, texte, « Ouvrir mon espace : » + URL, trois étapes, pied (mêmes phrases,
  URL de désinscription en clair).

### Écran 4 — Courrier de lancement (une lettre du PDF)

Gabarit §6.1 sans écart (A4 recto, noir et blanc, fenêtre DL, bloc adresse, date, objet 13 pt / 600,
corps 12,5 pt / 1,7, pied « Courrier envoyé par voie postale, faute d'adresse email connue. » + mentions
légales). Ce qui change : **le contenu**.

- **Objet** (texte fixe de `messages/fr.json`, comme l'objet de l'invitation) : « Objet : le site de
  Clos-Fleuri est en ligne ».
- **Corps** = le **texte du courrier** (réglage, écran 5), en paragraphes texte, **jamais** le texte de
  l'invitation. Texte par défaut proposé (aucun lien, aucune promesse d'accès, aucune fonctionnalité
  non livrée ; actualités = s05, analyses d'eau = s09) :
  > Bonjour,
  >
  > L'association a mis en ligne son site internet. Chacun peut le consulter librement, sans
  > inscription : vous y trouverez les actualités de l'association et les résultats des analyses de
  > l'eau.
  >
  > Rien ne change pour vous : le bureau continue de vous écrire par la poste pour tout ce qui vous
  > concerne, comme aujourd'hui.
  >
  > Le bureau de l'association
- **Adresse du site ajoutée d'office** sous le texte, dans un cadre noir 1 pt (« encart » §6.1) :
  « Adresse du site : clos-fleuri.exemple.fr » — le domaine public de l'association, écrit en clair 12 pt
  (§6.1 : toute adresse web en clair, pas de QR code). Jamais un lien de connexion.
- Pas de variable dans ce texte (pas de `{nom}`) : il est écrit une fois pour tous, comme celui de
  l'invitation. Le bloc adresse nomme déjà le destinataire.
- Génération et calage : carte « Courrier postal » de s28 (écran 6), page de calage inchangée.

### Écran 5 — Réglages

- **5a — section « Invitation des membres »** (s42a), description élargie : « L'email qui invite un
  membre à se connecter à son espace, depuis sa fiche ou lors du lancement, et le courrier envoyé à ceux
  qui n'ont pas d'adresse email. »
  - « Texte de l'invitation » : aide élargie « Il s'affiche au-dessus du bouton de connexion, dans
    l'invitation depuis la fiche comme dans le lancement et la relance. Le bouton, le lien et le mode
    d'emploi sont ajoutés d'office. »
  - **Nouveau** « Texte du courrier de lancement » (Facultatif) — type « Texte long » du registre (§3.1 :
    `textarea` + compteur, plafond 2000 comme `invitation.text`). Aide : « Envoyé par la poste, lors du
    lancement, aux membres sans adresse email. Ils n'ont pas d'espace membre : ce courrier ne contient
    aucun lien de connexion et ne doit promettre aucun accès. L'adresse du site est ajoutée d'office en
    dessous. » Vide : « Laissé vide, le courrier reprend le texte par défaut : « … » » (`whenEmpty`).
- **5b — carte « Nature des envois »** (s27b), deux lignes générées de plus : « Lancement du site » et
  « Relance des invitations » (Q1), seed `statutaire`. Bureau : lecture seule (fond `muted`, aide
  « Réglé par l'équipe technique de la plateforme… »). SuperAdmin : `radio-group` à deux options. Mêmes
  libellés dans la liste et le détail des campagnes (`templateNames`) et sur la page de désinscription.
- Succès, erreur de champ et résumé : formes existantes de la page Réglages.

### Écran 6 — Détail de la campagne de lancement (s26), deux phrases

- Carte **« Courrier postal »** : la phrase d'usage de s28 (« au même contenu que l'email ») serait
  fausse ; pour un lancement : « Les membres sans adresse email reçoivent par la poste le courrier de
  lancement : il annonce le site, sans lien de connexion. Le PDF contient une lettre par fiche, prête à
  glisser dans une enveloppe à fenêtre. » Le reste de la carte est inchangé.
- Carte **« Contenu envoyé »** : le texte de l'invitation en paragraphes, puis `alert` neutre `muted`
  sans icône : « Ajoutés à chaque envoi : le bouton « Ouvrir mon espace », un lien de connexion propre à
  chaque destinataire, valable 7 jours, et le mode d'emploi en trois étapes. Les liens ne sont jamais
  conservés. » Le résumé affiche « Type : Lancement du site » (ou « Relance des invitations »).

## Mockup

docs/designs/s42b-lancement-invitations.html — visual reference. DO NOT copy into production: Execute
builds with the real components. Planches : 1a/2a, 1b, 1c-1e, 1f-1h, 1i-1l, 2b-2c, 2d-2e, 3a-3b, 4a,
5a-5b, 6a ; chacune en cadre ordinateur puis mobile 390 px.

## Reused components (from the design system)

- `sidebar` (nouvelle entrée « Invitations »), `breadcrumb`, `card`, `h1`/`h2` serif.
- Décompte d'une cible (§3.14), compteur `dl` (§3.13), plan écrit (§3.13, s29), « Part entamée » (s52).
- `badge` — états d'un envoi (§3.13) ; « En attente de confirmation » (s54).
- `button` `default` / `outline` / `destructive`, icônes `Send`, `Download` ; chargement à largeur conservée.
- `alert-dialog` — confirmations du lancement et de la relance (patron s26).
- `alert` neutre + `CircleCheck`, neutre `muted` sans icône ou avec `Info`, `warning` + `AlertTriangle`,
  `destructive` 2 px.
- `table` + cartes empilées (§3.5), pagination écrite, `skeleton`.
- Gabarit email des campagnes (`CampaignMail`, pied §5.4 statutaire/facultatif) + contenu de
  l'invitation de s42a ; jumelles sombres §5.2.
- Lettre §6.1 et carte « Courrier postal » (§3.17).
- Cartes générées des réglages (§3.1) : texte long à compteur, `radio-group` des natures, lecture seule.

## States

- **Vide** — avant lancement, relance absente (1a) ; personne à relancer (1h) ; liste jamais connectées
  vide (2d) ; aucune fiche « refus » : carte non rendue.
- **Chargement** — 1k (`skeleton`, bouton « Lancement en cours… »), 2e.
- **Erreur** — 1i (refus métier lisibles), 1j (échec de création), 1l (lecture impossible) ; réglages :
  formes existantes.
- **Succès** — 1c (parti), 1d (reporté : un succès différé, pas une erreur), 1e (terminé), 1g (relance
  en cours), 2b/2c (suivi).

## Design system gaps

Aucun n'a été comblé par une invention ; à trancher au plan ou à verser au design system.

1. **Téléphone du bureau** (§5.5 « Invitation initiale », §9 ligne Connexion) — l'invitation de masse
   devrait le donner ; aucun réglage ne le porte. Les étapes se lisent sans numéro. Non comblé.
2. **§6.1 contredit la story pour le courrier des sans-email** — la table d'équivalences dit, pour le
   lien de connexion : « Invitation à transmettre une adresse email au bureau ». La note de s42b dit que
   ces membres n'ont pas de compte et n'en auront pas, et qu'une promesse d'accès serait un défaut
   fonctionnel. Le texte par défaut ne fait **pas** cette invitation. À aligner au §6.1.
3. **Emplacement d'action dans le gabarit de campagne** — `CampaignMail` n'a pas de bloc bouton + URL +
   étapes. Composé ici avec les pièces existantes du gabarit transactionnel (§5.1, §5.5) ; à verser au §5
   comme « contenu d'invitation dans l'habillage de campagne ».
4. **Taux d'adoption** — pas de `progress` (réservé à l'envoi et au quota, §2.1, §3.13) : compteur seul.
   Si le bureau veut une barre « 176 sur 318 adresses connectées », c'est une extension de §2.1 à décider.
5. **Objets « toujours préfixés »** (§5.6) — la règle ne dit pas qui pose le préfixe : ici le gabarit de
   campagne, une seule fois. À préciser au §5.6.
6. **`alert` « muted »** — toujours composée à la main (§9) ; s42b en est un consommateur de plus (1d,
   1h, 2c, 2d, 6a), avec et sans `Info`.
7. **Entrée « Invitations »** dans la barre du bureau — item sans icône, après « Relances » ; à inscrire
   avec les autres entrées du groupe « L'association ».
8. **Badge « Désactivée par l'import »** — forme proposée (`outline`), non utilisée tant que s56 n'est
   pas livrée.
9. **Plan écrit d'un envoi du système** — la ligne « Lancement — date » + badge + liens reprend la ligne
   de rang de s29 (§3.13) hors des relances d'impayés ; à noter comme forme générale.

Contrôle visuel : fait le 2026-11-24 à 1280 et 390 px — Chromium de Playwright lancé avec des
bibliothèques système extraites hors du dépôt (`libnspr4`, `libdbus`… absentes du conteneur) ; aucun
débordement horizontal mesuré dans un cadre ni sur la page aux deux largeurs ; deux passes de
correction (cadre ordinateur élargi pour montrer la barre latérale au-delà de 1 024 px, compte « jamais
connectées » corrigé, pagination et colonnes du tableau en mobile) ; couleurs par les seuls tokens de
`:root`, hexadécimaux limités aux jumelles sombres du §5.2, marges dans l'échelle 4/8/12/16/24/32/48/64.
