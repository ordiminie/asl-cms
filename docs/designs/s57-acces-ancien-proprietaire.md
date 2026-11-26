# Design — Story s57-acces-ancien-proprietaire

> Conçu le 2026-11-26, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s57-acces-ancien-proprietaire.md`.
> Écrans d'ancrage : s12d / s42a (carte « Accès à l'espace membre » de la fiche,
> `member-profile-detail.tsx`, `AccessState` et `MemberInvitation`), s54 (phrase d'ouverture par
> adresse), s52 / s27b (réglage réservé au SuperAdmin, lu en lecture seule par le bureau), §3.1
> (rendu généré d'un réglage « Nombre »).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so`, `libnss3.so` et
> d'autres bibliothèques absentes du conteneur, vérifié le 2026-11-26) ; contrôle en lecture seule à la
> place : aucune couleur hors des tokens de `:root`, marges dans l'échelle 4/8/12/16/24/32/48, chaque
> planche en deux versions (ordinateur et mobile 390 px, par requêtes de conteneur), états présents.

## Périmètre du design

Arbitrages appliqués (décidés, non rouverts) :

1. **Règle par fiche.** Une fiche dont toutes les périodes sont closes perd l'accès `délai` après la fin
   de sa dernière période, pour toutes ses adresses et tous ses comptes ; la session reste ouverte tant
   qu'une autre fiche reliée est ouverte. Une fiche **sans aucune période** est hors règle. Un membre
   du bureau qui vend tout garde le bureau.
2. Pendant le délai, le vendeur voit les factures émises avant la vente et les documents datés d'avant
   la vente ; pas ceux d'après, même impayés.
3. Délai **en mois** (seed 6), modifiable par le **SuperAdmin seul**, calculé à la volée : le changer
   rouvre ou ferme rétroactivement.

Données fictives : association « Clos-Fleuri » (CF, teinte 195), aujourd'hui le 26/11/2026, délai 6 mois.

| Écran | Route                                                         | États          |
| ----- | ------------------------------------------------------------- | -------------- |
| A     | `/bureau/proprietaires/{id}` — carte « Accès à l'espace membre » | A1 à A5     |
| B     | `/bureau/reglages` — carte « Accès à l'espace membre »        | B1 à B5        |

**Non dessiné** (la story ne demande rien côté membre) : l'espace membre (les fiches closes en sortent,
les factures et documents d'après la vente n'y figurent pas : c'est un filtre, pas un écran) ; la page de
connexion (l'écran D « accès fermé » de §7 / s12d sert tel quel au vendeur hors délai) ; les listes de
factures et de documents de la fiche du bureau (inchangées : le bureau voit tout, quelle que soit la
propriété) ; la liste des propriétaires.

**Dates** ([ADR 029](../decisions/029-propriete-datee-des-parcelles.md)) : `ends_on` est le jour de la
vente. La carte écrit « la vente du {ends_on} » ; l'échéance est `ends_on + délai`. Pendant le délai,
« Accès ouvert jusqu'au {veille de l'échéance} » (dernier jour ouvert) ; après, « Accès fermé depuis le
{échéance} » (premier jour fermé). Exemple : vente le 15/06/2026 → ouvert jusqu'au 14/12/2026, fermé
depuis le 15/12/2026. La borne exacte (inclusive ou non) est à figer dans le plan, avec le test d'horloge
du critère 3 ; la maquette suit cette lecture. Toutes les dates en `data`, `dd/MM/yyyy`.

## Screen(s)

### Écran A — Bureau : fiche, carte « Accès à l'espace membre »

Carte existante (`DetailCard`, `h2` serif 24 px), à sa place entre « Adresses email » et le rôle. Elle
garde sa forme : ligne `Lock` 20 px en `primary` + phrase en 17 px, puis l'invitation (bouton `outline`
« Envoyer / Renvoyer l'invitation » + aide en `muted-foreground` 15 px). s57 n'ajoute qu'**une phrase**
dans le bloc de la ligne `Lock`, ou la remplace :

- **A1 — fiche encore propriétaire** (au moins une période ouverte) : **rien ne change**. Pas de date,
  pas de mention « propriétaire » (la carte des parcelles le dit déjà).
- **A2 — vendue, dans le délai** : la phrase d'ouverture actuelle reste (« **Compte ouvert.** … »), et
  un second paragraphe s'ajoute dessous : « **Accès ouvert jusqu'au 14/12/2026.** Jean Dubois n'est plus
  propriétaire depuis la vente du 15/06/2026 ; il voit encore ses factures et documents d'avant cette
  date. Ensuite, aucune adresse de cette fiche ne s'y connectera plus. » L'invitation reste possible
  (l'accès est encore ouvert). C'est la « date de fin d'accès prévue » du critère 8.
- **A3 — délai écoulé** : la phrase d'ouverture est **remplacée** (« Compte ouvert » serait faux) :
  « **Accès fermé depuis le 03/08/2026.** Lucie Moreau n'est plus propriétaire depuis la vente du
  03/02/2026 : aucune adresse de cette fiche ne s'y connecte plus. Ses autres fiches ne sont pas
  touchées. » puis « Rien n'est supprimé : ses factures et ses documents restent consultables par le
  bureau, plus bas sur cette fiche. » Le bouton d'invitation disparaît au profit d'une aide, sur le
  patron de `mailOnlyHint` : « Pas d'invitation possible : l'accès de cette fiche est fermé. » Les
  sections factures et documents de la fiche sont inchangées (critère 2).
- **A3-bureau — délai écoulé, compte au bureau** (rôle `board` ou `owner`) : comme A3, plus une ligne
  `badge` « Bureau » (ou « Présidence ») + « Son compte garde l'accès au back-office ; cette fiche sort
  seulement de son espace membre. »
- **A4 — fiche sans aucune période** (jamais rattachée à une parcelle) : **hors règle, carte
  inchangée** (comme A1). Aucune phrase « hors règle » : elle n'apprendrait rien au bureau.
- **A5 — fiche courrier uniquement, vendue** : la phrase `mailOnly` reste, et la phrase de délai
  s'ajoute quand même, avec sa variante : « … Une adresse ajoutée d'ici là ouvrira son espace jusqu'à
  cette date. » Après le délai : « **Accès fermé depuis le …** » suivi de la phrase `mailOnly`
  inchangée. La règle est par fiche, elle ne dépend pas de l'existence d'un compte.

Plusieurs adresses (s54) ou compte partagé entre fiches (s53) : la phrase parle de **la fiche** (« aucune
adresse de cette fiche »), jamais du compte, puisque la session peut rester ouverte par une autre fiche.

Mobile (< 640 px) : même contenu, carte en 16 px de marge, bouton d'invitation pleine largeur 56 px
(forme actuelle).

### Écran B — Réglages : carte « Accès à l'espace membre »

Nouveau réglage du registre (ADR 016), rendu **généré** par `association-settings-form.tsx` : aucun
composant nouveau (§3.1, « un type de réglage → un composant »).

- **Carte** : nouvelle section du registre, titre « Accès à l'espace membre », description « Ce qui
  arrive à l'espace d'un membre qui n'est plus propriétaire d'aucune parcelle de sa fiche. » Placée
  après « Invitation des membres » (les deux parlent de l'accès à l'espace). Voir gap 1.
- **Champ** (type « Nombre ») : libellé « Délai d'accès après la vente — facultatif » ; aide
  « Nombre de mois pendant lesquels l'ancien propriétaire garde l'accès à son espace après la vente de
  sa dernière parcelle. Un changement s'applique tout de suite à toutes les fiches vendues, y compris
  aux accès déjà fermés. Par défaut : 6. » ; `input` en `data`, 160 px max, **unité « mois » à droite**
  (gap 2).
- `editableBy: 'super_admin'` + `readOnlyHelpKey` : la phrase propre déjà employée par « Nature des
  envois » (s27b), qui mentionne l'avis du conseil RGPD — la story renvoie au même conseil pour cette
  durée.

États :

- **B1 — SuperAdmin, valeur enregistrée** : champ modifiable, `6`.
- **B2 — membre du bureau** : le champ est **affiché en lecture seule** (fond `muted`, `readOnly`), pas
  masqué — c'est la forme existante de tout réglage `editableBy` (s52, s27b) ; phrase sous le champ :
  « Réglé par l'équipe technique de la plateforme, après avis du conseil RGPD : vous ne pouvez pas le
  modifier. » Le champ n'entre pas dans l'envoi.
- **B3 — vide** (SuperAdmin) : phrase commune « Vide : la valeur par défaut s'applique (6). »
- **B4 — refus** : `0`, négatif, décimal ou texte : bordure 2 px `destructive` + message de champ
  « Saisissez un nombre entier de mois supérieur à 0. » (+ résumé en tête de formulaire, existant).
  Un maximum éventuel (bornes à fixer au plan) utilise le message commun `aboveMax`.
- **B5 — enregistré** : bandeau de succès commun de la page, en tête du formulaire (existant, inchangé).
- **Chargement** : aucun nouveau (la page des réglages se rend déjà avec ses valeurs).

## Mockup

docs/designs/s57-acces-ancien-proprietaire.html — visual reference. DO NOT copy into production: Execute builds with the real components.

## Reused components (from the design system)

- `card` via `DetailCard` (`member-profile-detail-card.tsx`) — carte « Accès » de la fiche, inchangée.
- Ligne `Lock` + phrase `t.rich` (`AccessState`) — la phrase de délai s'y ajoute ou la remplace, même
  forme `<strong>` d'amorce.
- `button` `outline` + aide `muted-foreground` (`MemberInvitation`) — inchangés en A1/A2/A4 ; remplacés
  par l'aide seule en A3 (patron `mailOnlyHint`).
- `badge` « Bureau » / « Présidence » — déjà employé par la carte « Adresses email » (s54) ; en A3-bureau.
- Rendu généré d'un réglage « Nombre » (§3.1) : `Label`, aide, `input` en `data`, unité à droite,
  lecture seule `bg-muted` + `readOnlyHelpKey`, message de champ `CircleAlert` + `destructive-text`.
- `card` de section des Réglages (`CardHeader` titre 20 px / 600 + description).

## States

- **Vide** : A1 / A4 (rien à dire, carte inchangée) ; B3 (réglage vide → défaut 6).
- **Chargement** : aucun nouveau — la date est calculée avec la fiche (`readProfileView`), lue par la
  page qui attend déjà la fiche ; les Réglages se rendent déjà chargés.
- **Erreur** : B4 (refus de champ). Côté fiche, aucune erreur propre : une lecture du réglage en échec
  fait échouer la page comme aujourd'hui (pas de date inventée).
- **Succès** : B5 (bandeau commun). Côté fiche, pas de mutation : A2, A3, A3-bureau, A5 sont des états
  de lecture.

## Design system gaps

1. **Section de réglages « Accès à l'espace membre »** — l'union `AssociationSettingSection` n'a pas de
   section « membres » ou « accès ». Proposé : une nouvelle section, même gabarit généré que les autres
   cartes (aucun composant, aucun token nouveau ; seuls un titre et une description de carte). Variante
   sans nouvelle section : ranger le champ dans « Invitation des membres », dont la description (l'email
   d'invitation et le courrier) devrait alors changer. À trancher au plan.
2. **Unité « mois »** — `AssociationSettings.units` n'a pas `months`. C'est un libellé, pas un token :
   à ajouter dans `messages/fr.json` avec le réglage.
3. **Invitation d'une fiche close** (A3 : bouton retiré, aide « Pas d'invitation possible : l'accès de
   cette fiche est fermé. ») — proposé par cohérence avec le refus de `issueInvitation` (piste 13 de la
   recherche) ; l'exclusion des fiches closes du lancement et des campagnes (question 15) n'est pas un
   écran de cette story et reste à trancher au plan.
4. **Icône** — aucune icône nouvelle : la phrase de délai partage la ligne `Lock` existante. Une icône
   propre à « échéance » (`CalendarClock`, `Clock`) n'est pas au vocabulaire figé de §1.7 ; non employée.
