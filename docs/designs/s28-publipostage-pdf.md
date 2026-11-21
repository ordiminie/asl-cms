# Design — Story s28-publipostage-pdf

Voie : **AGENT** (lancée par `/ks-orchestrator`). Ancré sur `docs/design-system.md` uniquement.

Contrôle visuel : non fait — le Chromium de Playwright ne démarre pas dans le conteneur
(`libnspr4.so: cannot open shared object file`) ; repli en lecture du HTML le 20/11/2026 (couleurs
littérales remplacées par les tokens, mesures ramenées à l'échelle, deux versions et états présents).

## Screen(s)

Deux surfaces, et deux seulement.

### 1 · Carte « Courrier postal » — détail d'une campagne (`/bureau/campagnes/[id]`)

Une **nouvelle carte** dans `CampaignDetail`, après la carte « Destinataires » et avant le
« Récapitulatif » : le courrier est l'autre canal de la même campagne, il se lit à côté de ceux
qui ont reçu l'email. Titre `h2` Source Serif « Courrier postal » (gabarit `CardHeading` existant).

Dans l'ordre :

1. **Phrase d'usage** (`body`) — « Les membres sans adresse email reçoivent cette campagne par la
   poste. Le PDF contient une lettre par page, au même contenu que l'email, prête à glisser dans une
   enveloppe à fenêtre. »
2. **Compteur** (`dl`, forme du §3.13) — « Fiches sans adresse email » · « Dont sans domicile » · « Date portée sur les lettres » (`jj/mm/aaaa`, la date d'envoi de la campagne). Trois
   paires en bureau, une par ligne sous 640 px.
3. **Signalement des homonymes** (critère 2) — seulement s'il en existe. `alert` `warning` +
   `AlertTriangle` (ce n'est pas un refus, §3.13) : « Une même personne semble posséder plusieurs
   terrains. » puis la liste écrite de chaque groupe : **nom**, domicile en clair, puis en `meta`
   « 2 fiches · parcelles 14 et 27 ». Filet gauche 2 px (forme du « plan écrit », §3.13).
4. **Choix du regroupement** — seulement s'il y a des homonymes. `radio-group` à deux options, libellé
   « Lettres des propriétaires de plusieurs terrains » :
   - « Une seule lettre par personne » — aide `meta` « Elle cite toutes ses parcelles : « 14, 27 ». »
   - « Une lettre par terrain » — aide `meta` « Une lettre par fiche, chacune avec sa parcelle. »
   **Aucune option présélectionnée** : « rien n'est regroupé d'office », et une présélection « par
   terrain » serait un choix fait à la place du bureau.
5. **Fiches sans domicile** — seulement s'il en existe. `alert` neutre sans icône, fond `muted`
   (variante de §3.13). **Arbitrage du 20/11/2026 (ADR 067)** : la lettre part quand même — à
   l'adresse du **terrain** si la fiche en a une, sinon au **nom seul** (à remettre ou compléter à la
   main). Deux listes, chacune seulement si elle n'est pas vide : « Adressées au terrain, faute de
   domicile : » et « Sans aucune adresse — nom seul dans la fenêtre : », chaque nom en **lien vers la
   fiche** + parcelle en `data`, puis « Complétez le domicile sur la fiche pour que la lettre parte à
   la bonne adresse. ».
6. **Actions** — bouton `default` « Télécharger le PDF du courrier », icône `Download` 20 px +
   libellé : la seule action attendue de cet écran. Puis bouton `outline` « Télécharger la page de
   calage » (icône `Download`), avec en `meta` dessous : « Une feuille avec les repères de la fenêtre,
   à glisser dans une enveloppe avant d'imprimer le lot. Si l'adresse tombe à côté, corrigez le
   décalage dans Réglages › Courrier. » (lien vers la page des réglages). 48 px en bureau, pleine
   largeur 56 px empilés (principal en premier) sous 640 px.
7. **Note** (`meta`) — « Les lettres sont triées par nom, dans l'ordre de mise sous pli. Le PDF n'est
   pas conservé : vous pouvez le télécharger à nouveau à tout moment. » (tri par nom : §6.3).

**Mobile (390 px)** — barre latérale en tiroir (`sheet`), marges 16 px, compteur une paire par
ligne, options du `radio-group` 56 px, bouton pleine largeur 56 px. Même contenu, mêmes états.

### 2 · La lettre — une page du PDF (§6.1, reprise sans écart)

A4 portrait recto, noir et blanc, marges 20 mm gauche/droite · 15 mm haut · 20 mm bas.

| Zone           | Contenu                                                                                                                 | Mesures (mm, coin haut gauche)                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| En-tête        | Logo **monochrome** 34 px (≈ 9 mm), sinon monogramme noir sur blanc (§1.8) ; nom de l'association en Source Serif 600     | y 15                                              |
| Fenêtre        | **Non imprimée** — repère de conception (enveloppe DL 110 × 220, fenêtre gauche, NF Z 11-011)                           | x 20 · y 45 · 100 × 35                            |
| Bloc adresse   | Nom · libellé d'entreprise s'il existe · ligne d'adresse du **domicile** · complément · code postal + ville. 12 pt, sans gras | cadre x 25 · y 50 · 90 × 25 (garde de 5 mm), 4 lignes max |
| Date           | « Le 12 novembre 2026 » — date d'envoi de la campagne, en clair                                                         | à droite, sous la fenêtre                         |
| Objet          | « Objet : » + objet de la campagne, variables remplacées. 13 pt / 600                                                    | sous la date                                      |
| Corps          | Le corps de la campagne, variables remplacées (`{nom}`, `{parcelle}`, `{date}`). 12,5 pt / 1,7, plancher 11 pt. Liens écrits **en clair** | colonne pleine largeur entre marges               |
| Pied           | Filet 0,5 pt, puis « Courrier envoyé par voie postale, faute d'adresse email connue. » (équivalence du pied de désinscription, §6.1) et mentions légales de l'association | au-dessus de la marge basse                       |

**Décalage de calage** (ADR 067) : deux réglages d'association, « Décalage horizontal » et
« Décalage vertical » du bloc adresse, en mm, entiers de −10 à +10, 0 par défaut, rangés dans une
carte « Courrier » de la page Réglages (rendu générique `input` numérique, unité « mm » à droite,
§3.1). Ils déplacent le cadre de l'adresse — jamais le reste de la lettre — sur les lettres **et** sur
la page de calage.

**Page de calage** — A4, une page : le contour de la fenêtre (x 20 · y 45 · 100 × 35, filet 0,5 pt),
le cadre de l'adresse décalé du réglage (filet 0,5 pt, tirets), un bloc adresse d'exemple « Nom du
destinataire / Adresse / Code postal Ville » à sa place réelle, les deux plis en trois, et la phrase
« Glissez cette feuille pliée dans une enveloppe à fenêtre : le cadre en tirets doit apparaître
entier dans la fenêtre. Décalage appliqué : 0 mm horizontal, 0 mm vertical. ». Noir et blanc.

Équivalences email → lettre appliquées (§6.1) : pas de lien de désinscription ni de bouton ; un
encart du corps devient un cadre noir 1 pt ; aucune information par la couleur ; aucun QR code.

Lettre **regroupée** (« une seule lettre par personne ») : même gabarit, `{parcelle}` = toutes les
parcelles actuelles du groupe en ordre numérique (« 14, 27 »), comme `addressValuesOf` côté email.

## Mockup

docs/designs/s28-publipostage-pdf.html — visual reference. DO NOT copy into production: Execute
builds with the real components (`Card`, `Alert`, `RadioGroup`, `Button`) and the PDF engine the
plan selects. La lettre y est dessinée à l'échelle 1 mm = 2 px (1,6 px sous 640 px) ; fenêtre et
plis sont des repères en pointillés, **jamais imprimés**.

## Reused components (from the design system)

- `card` + `CardHeading` existant de `campaign-detail.tsx` — la carte « Courrier postal ».
- Compteur `dl` (§3.13) — les trois décomptes.
- `alert` `warning` + `AlertTriangle` (§3.13) — signalement des homonymes.
- `alert` neutre sans icône, fond `muted` (§3.13, variante encore composée à la main) — fiches sans
  domicile, état vide.
- `alert` `destructive` bordure 2 px, `role="alert"` (§3.9) — erreur, choix manquant (résumé avec lien
  d'ancrage vers le `radio-group`).
- `alert` neutre + `CircleCheck` `primary` (§3.2) — succès.
- `radio-group` (§2.1 : 2-3 options courtes) — le choix du regroupement ; erreur de champ §3.1.
- `button` `default` + icône `Download` (vocabulaire de §3.15) — l'action.
- Liste écrite à filet gauche 2 px (« plan écrit », §3.13) — les groupes d'homonymes.
- `<AssociationMark />` en version papier monochrome (§1.8) — en-tête de la lettre.
- Gabarit papier §6.1 — la lettre, sans écart de mesure.

## States

Carte « Courrier postal » :

- **Vide** (critère 5) — aucune fiche sans email dans la cible : `alert` neutre « Aucun courrier à
  produire : tous les membres visés par cette campagne ont une adresse email. » **Pas de bouton**, pas
  de compteur. Exception assumée à la règle du vide (§3.2) : rien à combler, comme la file vide de
  s52.
- **Chargement** — bouton désactivé, libellé « Préparation du PDF… », largeur conservée. Pas de
  `progress` : la génération ne rend aucun avancement (§2.1).
- **Erreur** — `alert` `destructive` ancrée sous le bouton : « Le PDF n'a pas pu être préparé. Rien
  n'a été envoyé ni modifié. Réessayez dans un instant ; si cela recommence, écrivez à l'équipe
  technique. »
- **Choix manquant** — clic sans option cochée alors que des homonymes sont signalés : le bouton reste
  actif (§3.10), résumé `destructive` « Le PDF n'a pas été préparé. Choisissez une lettre par personne
  ou une lettre par terrain. Rien n'a été regroupé. » avec lien d'ancrage, focus porté sur le résumé,
  options en bordure 2 px `destructive` et message « Choisissez une des deux options. ».
- **Succès** — `alert` neutre + `CircleCheck` : « PDF prêt : 3 lettres, une par page (une seule pour
  Marcel Laurent). Le téléchargement a commencé dans votre navigateur. » Pas de toast (§2.1).

## Design system gaps

Aucun n'a été comblé par une invention. À trancher au plan, ou à verser au design system par lui.

1. **Écran « préparer l'envoi papier »** (§9, signalé comme bloquant pour s28) — le design system y
   range l'aperçu du lot, le nombre de plis, la **réimpression d'une page isolée** et le **marquage
   « envoyé le… »**. La story n'en demande que la génération du PDF, le signalement des homonymes et
   l'état « pas de courrier » : la carte ci-dessus **compose** ces trois besoins avec l'existant.
   Réimpression d'une page, marquage d'envoi, suivi du courrier et retours PND (§9, « Papier »)
   **restent hors périmètre** de s28 : à rattacher à une story, pas à improviser ici.
2. **Prévisualisation PDF paginée en back-office** (§9) — non fournie : le bureau ouvre le PDF
   téléchargé. Aucun composant d'aperçu n'est inventé.
3. **Page de calage** (§6.1 : « fournie avec le premier lot ») — **tranché le 20/11/2026** :
   téléchargement à part, toujours disponible, plus un décalage réglable par l'association (ADR 067).
   Forme ci-dessus ; à verser au §6.1 par le plan. Les mesures §6.1 restent « à confirmer avant la
   première impression » : le décalage est précisément le moyen de les corriger sans code.
4. **Bloc adresse à 5 lignes** — nom + libellé d'entreprise + ligne + complément + code postal/ville
   dépasse les « 4 lignes max » de §6.1 quand tout est renseigné. Règle à fixer (fusionner complément
   et ligne ? omettre le libellé quand il égale le nom, comme « SCI Les Chênes » ? réduire à 11 pt ?).
5. **Bordereau récapitulatif** (§6.3 : « en génération de lot, un bordereau en ouverture ») — décrit
   pour le gabarit de document institutionnel, pas pour la lettre §6.1. Le critère 1 dit « un courrier
   par fiche » : un bordereau en page 1 ferait une page sans destinataire. À trancher : l'ajouter, ou
   le laisser au gabarit institutionnel (s36).
6. **Logo monochrome** (§1.8 : « dérivé automatiquement, à valider ») — la dérivation n'existe pas
   encore dans le code ; le monogramme noir sur blanc est le repli sûr.
7. **`radio-group` sans valeur par défaut** — le design system ne dit pas si un `radio-group` peut
   s'ouvrir sans choix ; ici c'est imposé par le critère 2. À inscrire au §3.14 si retenu.
8. **`alert` « muted »** — toujours composée à la main (déjà au §9) : s28 en est le troisième
   consommateur.
9. **Campagne antérieure à s28** — **tranché par le plan (ADR 065)** : ses fiches sans email n'ont pas
   été figées, la carte le dit en `alert` neutre (« Le courrier n'est pas disponible pour cette
   campagne : elle a été envoyée avant l'ajout du courrier postal. Il le sera pour les suivantes. »),
   sans bouton. Aucune reconstitution de la cible après coup.
