# Design — Story s36-modeles-documents

> Conçu le 2026-11-25, chemin **agent** (`/ks-design`, voie AGENT). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s36-modeles-documents.md` (la section
> « Arbitrages (25/11/2026) » fait foi). Écrans d'ancrage : s05 (liste + éditeur à
> `RestrictedMarkdownEditor`), s25 (liste des variables sous l'éditeur du composeur), s27 (cible en
> `radio-group` à contenu révélé, décompte en fiches — §3.14), s28 (lettre du moteur, bouton
> « Préparation du PDF… » — §3.17, §6.1), s32 (section « Documents » de la fiche, lot fichier par
> fichier, rapport, garde de sortie — §3.19).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du
> conteneur, comme pour s19, s31, s32 et s53) ; contrôle de repli en lecture le 2026-11-25 : aucune
> valeur hex ni rgb, chaque `oklch` est une déclaration de token de `:root` (§1.1/§1.9), marges, padding
> et écarts dans l'échelle 4/8/12/16/24/32/48/64, treize planches présentes chacune en cadre ordinateur
> et cadre mobile 390 px (requêtes de conteneur sous 640 px), états vide, chargement, erreur et succès
> présents pour les quatre écrans.

## Périmètre du design

Quatre écrans, chacun en **ordinateur (1 280 px) et mobile (390 px)**. Données fictives : association
« Clos-Fleuri » (CF, teinte 195) ; Bernard Lefèvre (parcelles 12 et 13, compteur 0045821) ; groupe
« Riverains du chemin des Crêtes » (18 fiches) ; catégories de seed « Facture » et « Convocation ».

| Écran | Route (indicative, à fixer au plan)                                   | Critères | États   |
| ----- | --------------------------------------------------------------------- | -------- | ------- |
| 1     | `/bureau/modeles-documents` — liste des modèles                        | 1, 5     | 1a à 1e |
| 2     | `/bureau/modeles-documents/nouveau` et `/{id}` — éditeur               | 1, 4     | 2a à 2e |
| 3     | `/bureau/proprietaires/{id}/documents/generer` — document pour une fiche | 2        | 3a à 3g |
| 4     | `/bureau/modeles-documents/lot` — génération en lot                    | 3        | 4a à 4f |

**Point d'entrée de la génération unitaire : la fiche du propriétaire.** C'est le plus cohérent avec
la recherche : la fiche est connue (pas de recherche de membre à dessiner), le dépôt facultatif va
dans **son** dossier, dont la section « Documents » (s32) porte déjà « Déposer un document » sur une
sous-route de la fiche (`documents/nouveau`) ; `depositMemberDocumentService` est appelé pour une
fiche connue. Le lot, lui, part de la liste des modèles (il n'a pas de fiche) ou d'un modèle
enregistré, qui le présélectionne.

**Non dessiné** — exclu par la story ou les arbitrages : PDF regroupé d'un lot (Q6 : dépôt seul, le
papier reste le rôle de s28), conservation d'un document unitaire hors dossier nominatif (Q5),
modèles de départ seedés (Q13), prévisualisation PDF paginée (manque §9), reprise d'un lot
interrompu (manque 7), variables autres que les quatre de la story, modèles d'email (s25, système
distinct), point d'entrée depuis le détail d'un groupe.

## Screen(s)

### Écran 1 — Liste des modèles (`/bureau/modeles-documents`)

Entrée **« Modèles de documents »** du groupe « L'association » de `NAV_GROUPS`, **juste après
« Documents nominatifs »**, active sur ses sous-routes (`matchesSubroutes`) — manque 6.

- `h1` « Modèles de documents » ; `meta` « Convocations, procès-verbaux, courriers types : écrits une
  fois, pré-remplis pour chaque propriétaire au moment de générer le document. »
- Barre : **`default` « Créer un modèle »** (icône `Plus`), seul `default` ; `outline` « Générer en
  lot » (icône `FileText`). Sous 640 px, empilés pleine largeur 56 px, le `default` d'abord.
- Tableau (§2.1) trié par nom : **Nom** (17 px / 600) · **Variables** (celles que le modèle emploie,
  en `data`) · **Modifié le** (`data`, `jj/mm/aaaa`) · action. **Une seule action par ligne** :
  `outline` « Modifier ». La suppression vit dans l'éditeur. Sous 640 px : cartes empilées (§3.5),
  nom en titre, « Modifier » pleine largeur. Volume attendu faible (quelques modèles) : pagination
  du socle si la liste dépasse 25 lignes, sans filtre.
- Critère 5 : la liste ne lit que les modèles du tenant (RLS) — rien à dessiner de plus.

### Écran 2 — Éditeur d'un modèle (`nouveau` et `/{id}`)

Une **page** (plus de deux champs : pas de `dialog`, §2.1). Fil d'Ariane « Modèles de documents ›
{nom} » (ou « Nouveau modèle »). `h1` = nom du modèle. Formulaire à une colonne dans une carte :

1. **Nom du modèle** (`input`) — aide « Le nom que vous retrouvez dans la liste. Il n'est pas
   imprimé. » Plafond et compteur à fixer au plan (§3.9).
2. **Objet** (`input`) — aide « Imprimé après « Objet : » en tête du document. Les variables y sont
   permises. » Exigé par la lettre du moteur de s28 (`subject`) : **à valider au plan** (manque 2).
3. **Texte du document** — `RestrictedMarkdownEditor` tel quel : barre de six boutons `outline`
   44 px (Gras, Italique, Titre 2, Titre 3, Liste, Lien), `textarea`, aide du composant.
4. **Variables disponibles** — sous l'éditeur, la forme du composeur de campagne (`dl` en `data` /
   `muted`) : `{nom}` « le nom de la fiche du propriétaire » · `{parcelle}` « ses parcelles
   actuelles (« 12 et 13 ») » · `{date}` « la date choisie au moment de générer le document » ·
   `{association}` « le nom de l'association ». Puis « Elles sont remplacées pour chaque
   propriétaire. Un modèle qui contient une autre variable n'est pas enregistré. » Sous 640 px, une
   variable par ligne, sa description dessous.

- Actions : **`default` « Enregistrer le modèle »** ; `outline` « Supprimer le modèle » (icône
  `Trash2`, modèle existant seulement). Sous 640 px empilés 56 px, le principal d'abord.
- **2b — variable inconnue (critère 4)** : l'enregistrement est **refusé** (patron s29
  `unknownVariable`). Résumé ancré `destructive` 2 px, `role="alert"`, focus porté dessus : « Le
  modèle n'a pas été enregistré. Rien n'est perdu : votre texte est toujours là. Corrigez ce point puis
  enregistrez à nouveau. » + lien d'ancrage « Texte du document : variables inconnues {adresse} et
  {date_ag}. » ; le champ en bordure 2 px `destructive` et le message de champ qui **nomme chaque
  variable fautive** : « Variables inconnues : {adresse} et {date_ag}. Les variables possibles sont
  {nom}, {parcelle}, {date} et {association}. » (une seule : « Variable inconnue : {adresse}. … »).
  Même forme pour le champ Objet. Nom vide : « Saisissez le nom du modèle. »
- **2c — enregistrement** : le formulaire n'est jamais en `skeleton` (§2.1) ; bouton désactivé
  « Enregistrement… », largeur conservée.
- **2d — succès** : `alert` neutre + `CircleCheck` « Modèle enregistré. Il est dans la liste des
  modèles, prêt à générer un document depuis la fiche d'un propriétaire ou en lot. » + lien
  « Générer en lot avec ce modèle ».
- **2e — suppression** : `alert-dialog`, voile `--overlay` : « Supprimer le modèle « {nom} » ? Il
  disparaît de la liste et ne peut plus servir à générer un document. Les documents déjà déposés avec
  ce modèle restent dans les dossiers des propriétaires, inchangés. » `outline` « Annuler »,
  `destructive` « Supprimer le modèle ». Sous 640 px ancré en bas, boutons empilés (§3.11). Retour à
  la liste avec le succès 1e.

### Écran 3 — Générer un document pour une fiche

**3a — point d'entrée** : dans la section « Documents » de la fiche (s32), une seconde action
d'en-tête **`outline` « Générer un document »** (icône `FileText`), **avant** « Déposer un
document ». La fiche garde son unique `default`. Sous 640 px, les deux boutons empilés pleine largeur
56 px. Visible des rôles qui portent l'action des modèles (registre, à créer au plan).

**3b — la page** (`documents/generer`, fil d'Ariane « Propriétaires › {nom} › Générer un document ») :

- En tête, lecture seule, `dl` « Pour » : **nom de la fiche** + `meta` parcelles actuelles et
  compteur, puis **l'adresse que la lettre imprimera** (filet gauche 2 px `border`, 15 px) : domicile,
  sinon terrain, sinon nom seul (ADR 067, `letterAddressLinesOf`).
1. **Modèle** (`select`) — les modèles du tenant, triés par nom ; lien « Gérer les modèles ».
2. **Date du document** — champ date §3.9, **pré-rempli à aujourd'hui** ; aide « Remplace {date}
   dans le document. Aujourd'hui par défaut. »
3. **`checkbox` « Déposer aussi dans le dossier de la fiche »**, décochée par défaut, aide « Le
   document sera visible dans l'espace des comptes reliés à cette fiche, carte « Mes documents ».
   Sans cette case, il est seulement téléchargé : rien n'est conservé. » Cochée, elle **révèle** en
   retrait de 48 px (pleine largeur sous 640 px, forme §3.14 — manque 5) :
   - **Catégorie** (`select`, catégories actives du domaine `member_document`, sans défaut) ;
   - **Titre** (`input`, aide « Le titre que lit le propriétaire dans son espace. », plafond 120 de
     s32).
- Actions : **`default` « Télécharger le PDF »** (icône `Download`), qui devient « Télécharger et
  déposer le PDF » quand la case est cochée ; `outline` « Annuler » (retour à la fiche).
- **3c — préparation** : bouton désactivé « Préparation du PDF… », largeur conservée (forme s28).
- **3d — succès** (ancré, `alert` neutre + `CircleCheck`) : « Document téléchargé. Le fichier
  `document-jj-mm-aaaa.pdf` est dans vos téléchargements. » ; case cochée, la suite « Il est aussi
  déposé dans le dossier de {nom}, catégorie « {catégorie} » : visible dès maintenant dans l'espace
  des comptes reliés à cette fiche. » + lien « Revenir à la fiche ». **Nom du fichier sans donnée
  nominative** (piège 11).
- **3e — erreurs** : résumé ancré « Le document n'a pas été généré. Rien n'a été téléchargé ni
  déposé. Corrigez ces points puis recommencez. » + liens d'ancrage ; messages de champ (« Saisissez
  une date au format jj/mm/aaaa. », « Choisissez une catégorie. », « Saisissez un titre. »). Échec du
  moteur : « Le PDF n'a pas pu être produit. Rien n'a été téléchargé ni déposé. Réessayez dans un
  moment. » Fiche sans parcelle actuelle : `alert` neutre `muted` + `Info` avant les actions,
  « Cette fiche n'a pas de parcelle actuelle : {parcelle} restera vide dans le document. » Fiche sans
  domicile : l'adresse affichée en tête le montre déjà (terrain ou nom seul).
- **3f — aucun modèle** : formulaire non proposé ; `alert` neutre `muted` + `Info` « Aucun modèle de
  document. Un document se génère depuis un modèle écrit par le bureau. Créez-en un d'abord, par
  exemple une convocation. → Créer un modèle ».
- **3g — aucune catégorie active** : la case reste disponible ; son contenu révélé est l'alerte
  « Aucune catégorie de document nominatif. Un document déposé se range dans une catégorie.
  Créez-en une d'abord, ou décochez la case pour télécharger seulement. → Gérer les catégories ».

### Écran 4 — Générer en lot (`/bureau/modeles-documents/lot`)

Page, fil d'Ariane « Modèles de documents › Générer en lot ». Ouverte depuis la liste (« Générer en
lot ») ou depuis le succès d'un modèle enregistré (modèle présélectionné).

- **Règle écrite avant tout** : `alert` neutre `muted` + `Info` « Un document est produit pour chaque
  fiche de la cible, puis déposé dans son dossier nominatif. Aucun fichier regroupé n'est
  téléchargé : pour un envoi papier, passez par le courrier postal d'une campagne. »
- **4a — formulaire** :
  1. **Modèle** (`select`).
  2. **« Pour qui ? »** — `radio-group` des trois cibles de s27, mêmes libellés : Tous les membres ·
     Les membres en impayé (« Calculé au lancement, d'après les factures. Une facture « à classer »
     ne compte pas. ») · Un groupe, qui révèle le `select` « Groupe » (nom + nombre de fiches) et le
     lien « Gérer les groupes » (§3.14).
  3. **Décompte** — compteur `dl` (§3.13) : « Fiches de la cible », « dont sans parcelle actuelle »,
     « Documents à déposer ». **Une fiche = un document** (Q9) : pas de regroupement des homonymes,
     pas de décompte d'adresses (rien n'est envoyé).
  4. **Date des documents** (champ date §3.9, aujourd'hui par défaut, « Remplace {date} dans chaque
     document. »), **Catégorie** (`select`), **Titre des documents** (`input`, « Le même titre pour
     tout le lot, celui que lit chaque propriétaire. », forme §3.19).
  - `meta` avant les actions : « Relancer un lot dépose une seconde fois les documents : vérifiez la
    cible avant de lancer. » (aucune unicité sur `member_document`, piège 8).
  - Actions : **`default` « Générer et déposer les {n} documents »** (le nombre suit le décompte),
    `outline` « Annuler ».
- **4b — en cours** : un appel serveur par fiche, séquentiel (Q10). `progress` **déterminée** sans
  pourcentage écrit ; la phrase porte le décompte « 7 fiches traitées sur 18 » (`aria-live="polite"`),
  puis « Génération pour {nom}… » en `meta`. Garde de sortie (§3.19) : `alert` `warning` +
  `AlertTriangle` « Restez sur cette page jusqu'à la fin. Si vous la quittez, les fiches restantes ne
  reçoivent pas leur document. Ceux déjà déposés le restent. » + `beforeunload` pendant le lot
  seulement. Le rapport se remplit sous la barre ; bouton désactivé « Génération en cours… ».
- **4c — bilan (le succès)** : `alert` neutre + `CircleCheck` « Lot terminé : 16 documents déposés,
  2 échecs. Les documents déposés sont visibles dès maintenant dans l'espace des comptes reliés à leur
  fiche. Les fiches en échec n'ont rien reçu : générez leur document depuis leur fiche. » ; compteur
  `dl` Déposés · Échecs · Total ; `meta` « Ce rapport n'est pas conservé : notez les fiches en échec
  avant de quitter la page. » ; tableau **Fiche** (lien vers la fiche) · **Résultat** (`badge`
  « Déposé » `outline` texte `muted-foreground`, « Échec » `destructive`) · **Terrain ou raison**,
  **échecs en tête**. Raisons rendues telles que le serveur les écrit, par exemple « Le PDF n'a pas pu
  être produit pour cette fiche. Rien n'a été déposé. » ou « Le dépôt a été refusé : la catégorie
  « Convocation » n'est plus active. ». Actions : `default` « Revenir aux modèles », `outline` « Voir
  les documents nominatifs ». Sous 640 px : cartes empilées, badge sous le titre (§3.9).
- **4d — vides** : cible sans fiche → `alert` neutre `muted` sous le décompte (« Aucun membre n'est
  en impayé aujourd'hui. Aucun document à générer. », « Ce groupe n'a encore aucune fiche. … ») ; le
  bouton reste visible et actif, un clic affiche le résumé ancré (§3.10). Sans modèle ou sans
  catégorie active : alertes 3f / 3g, formulaire non proposé. Erreurs de formulaire : résumé ancré
  « Le lot n'est pas parti. Rien n'est perdu. » + messages de champ, comme 3e.
- **4e — chargement** : `skeleton` sur les nombres du décompte seuls pendant la lecture de la cible ;
  les options restent lisibles (forme s27).
- **4f — lot interrompu** : résumé ancré `destructive` « Le lot s'est arrêté à la fiche 8 sur 18. La
  connexion au serveur a été perdue. Les 7 documents déjà déposés le restent ; les 11 fiches suivantes
  n'ont rien reçu. » ; le rapport partiel reste affiché. Pas de bouton de reprise (manque 7).
- Lecture de la cible en échec : « La liste des membres en impayé n'a pas pu être lue. Aucun document
  n'a été généré. Réessayez dans un moment, ou choisissez une autre cible. » — **jamais de repli sur
  « tous »** (s27).

## Mockup

`docs/designs/s36-modeles-documents.html` — visual reference. DO NOT copy into production: Execute
builds with the real components. Treize planches (1a/1e ; 1b-1d ; 2a ; 2b/2c ; 2d/2e ; 3a ; 3b ;
3c-3e ; 3f/3g ; 4a ; 4b ; 4c ; 4d-4f), chacune en cadre ordinateur puis cadre mobile 390 px.

## Reused components (from the design system)

- `sidebar` du bureau — nouvelle entrée « Modèles de documents » ; `breadcrumb` dès le 2ᵉ niveau.
- `table` + cartes empilées sous 640 px (§3.5), `pagination` du socle si besoin.
- `button` `default` / `outline` / `destructive` (48 px ; 56 px pleine largeur sur mobile), libellé
  remplacé pendant le chargement, largeur conservée.
- `input`, `select`, `label`, champ date (§3.9), `checkbox` (§3.1, booléen enregistré avec le
  formulaire), `radio-group` à contenu révélé (§3.14).
- `RestrictedMarkdownEditor` (barre réduite §2.1 `markdown-editor`) et la liste des variables du
  composeur de campagne (s25).
- Section « Documents » de la fiche (s32, `MemberDocumentsSection`) — une action d'en-tête ajoutée.
- `alert` — succès neutre `CircleCheck`, neutre `muted` + `Info`, `warning` + `AlertTriangle`
  (§3.13, §3.19), résumé d'erreurs `destructive` 2 px (§3.9).
- `alert-dialog` — suppression d'un modèle, voile `--overlay`, ancré en bas sous 640 px (§3.11).
- `progress` déterminée (lot) ; rapport ligne à ligne et garde de sortie de s32 (§3.19).
- `badge` « Déposé » / « Échec » (§3.10, §3.13) ; compteur `dl` (§3.13).
- `skeleton` — liste des modèles, nombres du décompte.
- Icônes lucide : `Plus`, `FileText`, `Download`, `Upload`, `Trash2`, `Calendar`, `Info`,
  `CircleCheck`, `AlertTriangle`.
- Typographie `data` : variables, dates, parcelles, nom du fichier téléchargé.

## States

| Écran | Vide | Chargement | Erreur | Rempli / succès |
| ----- | ---- | ---------- | ------ | --------------- |
| 1 Liste | 1b « Aucun modèle de document pour l'instant. … » → « Créer le premier modèle » | 1c lignes `skeleton`, `aria-busy` | 1d « La liste des modèles n'a pas pu être lue. Rien n'est perdu… » | 1a liste ; 1e « Modèle supprimé. … documents déjà déposés … inchangés. » |
| 2 Éditeur | nouveau modèle (champs vides, variables listées) | 2c bouton « Enregistrement… » (jamais de `skeleton` de formulaire) | 2b variable inconnue nommée, enregistrement refusé ; nom vide | 2d « Modèle enregistré. … » ; 2e confirmation de suppression |
| 3 Unitaire | 3f aucun modèle ; 3g aucune catégorie active (dépôt seul impossible) | 3c « Préparation du PDF… » | 3e champs, échec du moteur ; fiche sans parcelle (avertissement) | 3b formulaire rempli ; 3d téléchargé (et déposé) |
| 4 Lot | 4d cible sans fiche ; aucun modèle / aucune catégorie | 4e `skeleton` du décompte ; 4b progression fiche par fiche | 4d formulaire ; lecture de cible en échec ; 4f lot interrompu ; lignes « Échec » du bilan | 4a formulaire ; 4c bilan |

**Non autorisé** : `BureauAccessDenied` pour les écrans 1, 2 et 4 et la page de l'écran 3 ; le bouton
3a n'est pas rendu. Un rôle qui porterait l'action des modèles sans `member.document.manage` voit le
dépôt refusé par s32 : la case de 3b et l'écran 4 lui sont alors à refuser d'emblée (au plan).

## Design system gaps

1. **Gabarit imprimé : lettre de s28 au lieu du gabarit institutionnel §6.3** (arbitrage Q4). Le PDF
   est la lettre DL du moteur (`renderLettersPdf`) : en-tête nom de l'association, bloc adresse pour
   enveloppe à fenêtre, « Le {date} », « Objet : … », corps, pied. Le §6.3 décrit un autre gabarit pour
   « convocation, procès-verbal et courrier type » : **coordonnées et lieu dans l'en-tête, numéro de
   pièce, destinataire facultatif (un PV n'en a pas), titre 16 pt, signature nom + fonction non coupée,
   pied « page x/y » + date de génération** — rien de cela n'est produit, et aucun réglage ne porte un
   signataire, des coordonnées ou un lieu. À l'inverse, le §6.3 veut en lot « un seul fichier PDF … avec
   un bordereau », contredit par le critère 3 et Q6 (un PDF par fiche, déposé). Le §6.3 reste donc une
   cible non réalisée ; à amender (ou à réserver à une story ultérieure) plutôt qu'à combler ici.
2. **Objet du document** — la lettre imprime « Objet : … » (`subject` obligatoire du moteur) ; la story
   ne nomme que le nom et le corps. Dessiné : un champ « Objet » distinct du nom interne, variables
   permises. Alternatives à trancher au plan : imprimer le nom du modèle comme objet, ou un gabarit sans
   ligne d'objet (qui toucherait le moteur).
3. **Pied du document** — le pied de s28 dit « Courrier envoyé par voie postale, faute d'adresse email
   connue. » (`texts.footer`, passé par l'appelant) : faux pour un document déposé dans l'espace d'un
   membre. Aucune phrase de pied n'est fixée pour un document ; à écrire au plan dans
   `messages/fr.json` (proposition : mentions légales seules).
4. **Nom de la variable de l'association** — le critère et l'arbitrage Q1 disent `{association}` (nom
   affiché) ; le §5.6 liste `{nom_association}` (et `{date_ag}`, `{prénom}`). Le §5.6 décrit les
   variables des emails, plus larges que le code : il ne couvre pas un jeu propre aux documents. À
   verser au §5.6 : « documents : `{nom}`, `{parcelle}`, `{date}`, `{association}` ».
5. **Contenu révélé par une `checkbox`** — le §3.14 décrit le champ révélé sous une option de
   `radio-group` ; ici, Catégorie et Titre suivent la case « Déposer aussi… ». Même forme proposée
   (retrait 48 px, pleine largeur sous 640 px, ordre de tabulation à la suite de la case) : à inscrire
   au §3.14 comme généralisation.
6. **Entrée « Modèles de documents »** de la barre du bureau — item sans icône du groupe
   « L'association », juste après « Documents nominatifs » : à inscrire avec les autres entrées
   (comme « Invitations », s42b, et « Documents nominatifs », s32).
7. **Reprise d'un lot interrompu** — un lot séquentiel depuis le navigateur peut s'arrêter (page
   quittée, connexion perdue) ; relancer redépose les documents déjà servis (aucune unicité). Aucune
   forme ne permet de reprendre « avec les fiches restantes ». Dessiné : l'état 4f qui dit ce qui est
   fait et ce qui ne l'est pas, sans action. Une reprise (ou un refus du doublon) est à décider si le
   besoin apparaît.
8. **Échec partiel téléchargement / dépôt (écran 3)** — si le PDF est produit mais le dépôt refusé
   (catégorie désactivée entre-temps), l'ordre des deux opérations décide de ce que le bureau a en
   main. Proposé : déposer d'abord, télécharger ensuite, et un refus de dépôt ne télécharge rien
   (« Rien n'a été téléchargé ni déposé ») — à confirmer au plan.
9. **Prévisualisation du document** — aucun aperçu avant téléchargement ni avant un lot de 400 fiches
   (manque §9 « prévisualisation PDF paginée », déjà noté s28, s36). Non dessiné ; contournement
   naturel : générer d'abord un document unitaire sans dépôt pour le relire.
