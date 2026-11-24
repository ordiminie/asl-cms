# Design — Story s42a-invitation-individuelle

> Conçu le 2026-11-24, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s42a-invitation-individuelle.md`.
> Écrans d'ancrage : s54 écran 4 (carte « Adresses email » de la fiche), s12d (carte « Accès à l'espace
> membre »), s03 / §7 écran 3 (lien expiré), §5 (email, lien magique), s02 (page Réglages).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)), sauf les jumelles sombres
> de l'email (§5.2).
>
> Contrôle visuel : non fait (navigateur indisponible), voir la dernière ligne de ce fichier.

## Périmètre du design

Arbitrages du 24/11/2026 appliqués : le lien d'une invitation vaut **7 jours** (paramètre de tenant,
seed), le lien demandé garde ses 20 minutes ; l'invitation est **reportable** faute de budget, rejouée avec
un lien neuf.

Données fictives : association « Clos-Fleuri » (CF, teinte 195). Fiche « Jean Dubois » (parcelle 21) :
`jean.dubois@exemple.fr` titulaire, active ; `claire.dubois@exemple.fr` supplémentaire, active ;
`marc.dubois@exemple.fr` supplémentaire, en attente de confirmation.

| Écran | Route / support                                                     | États   |
| ----- | ------------------------------------------------------------------- | ------- |
| 1     | `/bureau/proprietaires/{id}` — carte « Adresses email » (colonne)   | 1a      |
| 2     | `/bureau/proprietaires/{id}` — carte « Accès à l'espace membre »    | 2a à 2g |
| 3     | Email « Votre espace membre » (transactionnel)                      | 3a, 3b  |
| 4     | `/bureau/reglages` — section « Invitation »                         | 4a, 4b  |
| 5     | `/login/lien-invalide` — variante « invitation »                    | 5a      |

**Non dessiné** : le lancement de masse, le courrier, la relance et l'écran d'adoption (**s42b**) ; la
liste des propriétaires (aucun critère n'y met l'état de l'invitation) ; la vue « Envois d'emails » de
s52, qui gagne seulement le libellé de nature « Invitation » (§3.13, « s42 Invitation »), sans changement
de forme ; la connexion (§7 inchangé).

**Vocabulaire** : « invitation », « inviter », « lien de connexion ». Jamais « lien magique », « jeton »,
« token » (§8).

## Screen(s)

### Écran 1 — Fiche, carte « Adresses email » : l'état de l'invitation par adresse

Le tableau de s54 (écran 4) ne change pas de colonnes. **Sous le statut « Active »**, en `meta`, l'état de
l'invitation de cette adresse, un seul des trois :

- « Jamais invitée » ;
- « Invitée le 24/11/2026 » (date du dernier envoi parti, jour de Paris) ;
- « Connectée le 26/11/2026 » (première connexion réussie sur l'association) — il prime sur « invitée ».

Une adresse **en attente de confirmation** garde sa `meta` de s54 (« ajoutée par … · jusqu'au … ») et
n'a pas d'état d'invitation : elle ne reçoit rien. Sous 640 px, dans la carte empilée, la paire
« Statut » porte la même ligne.

- **1a** — Jean « Active · Connectée le 26/11/2026 », Claire « Active · Invitée le 24/11/2026 », Marc en
  attente.

### Écran 2 — Fiche, carte « Accès à l'espace membre » : l'action d'invitation

La carte garde sa phrase de s12d (`Lock` 20 px + « **Compte ouvert.** … »). Dessous, l'action, **un
bouton `outline`** (la fiche a déjà son `default`), 48 px, 56 px pleine largeur sous 640 px, icône `Send`
20 px, puis une `meta` qui dit ce qui va se passer :

- **2a jamais invitée** — `outline` « Envoyer l'invitation ». `meta` : « Un email part à chacune des
  2 adresses actives, avec son propre lien de connexion, valable 7 jours. »
- **2b déjà invitée** — `outline` « Renvoyer l'invitation ». `meta` : « Les liens envoyés le 24/11/2026
  cesseront de fonctionner. Un email part à chacune des 2 adresses actives. »
- **2c envoi en cours** — bouton désactivé, libellé « Envoi en cours… », largeur conservée.
- **2d envoyée** — `alert` neutre `role="status"`, `CircleCheck`, ancrée en tête de carte :
  « **Invitation envoyée** à jean.dubois@exemple.fr et claire.dubois@exemple.fr. » L'écran 1 se met à jour
  (« Invitée le … »).
- **2e reportée** (budget du jour, s52) — `alert` neutre `Info` : « **L'invitation partira demain
  matin** : l'association a atteint sa limite d'envois du jour. Un lien neuf sera créé au moment de
  l'envoi. » L'adresse reste « Jamais invitée » (ou garde sa date précédente) jusqu'au départ réel.
- **2f courrier uniquement** — pas de bouton. La phrase de s12d reste (« **Joignable par courrier
  uniquement.** Aucun compte : ajoutez une adresse email pour lui ouvrir son espace. »), suivie d'une
  `meta` : « Pas d'invitation possible : ce membre reçoit tout par courrier. » Si l'action est appelée
  quand même (dernière adresse retirée dans un autre onglet), refus en `alert` neutre `Info` : « **Ce
  membre relève du courrier.** Il n'a plus d'adresse email active : ajoutez-en une pour l'inviter. »
  Jamais d'erreur technique.
- **2g échec** — `alert` `destructive` ancrée dans la carte (jamais un toast) : « **L'invitation n'est
  pas partie.** Aucun email n'a été envoyé ; réessayez dans quelques minutes. » Si une partie des
  adresses a reçu l'invitation avant l'échec : « **L'invitation n'est partie qu'à
  jean.dubois@exemple.fr.** Réessayez pour les autres adresses. »

Aucune confirmation préalable (`alert-dialog` réservé à l'irréversible, §2.1) : réinviter n'efface rien
qu'un nouvel envoi ne remplace.

### Écran 3 — Email « Votre espace membre »

Gabarit transactionnel du lien magique (§5.5) : en-tête teinté au logo PNG (nom seul sinon), une seule
action, aucune actualité. Corps 17 px, titres 24 px, Georgia / Helvetica, hexadécimal de `theme.ts`.

- Objet : « Clos-Fleuri — Votre espace membre vous attend » (≤ 60 caractères). Pré-en-tête : « Un
  espace personnel vous est ouvert sur le site de l'association. Aucun mot de passe à retenir. »
- Titre 24 px : « Votre espace sur le site de Clos-Fleuri ».
- **Le texte de l'association** (réglage, écran 4), rendu comme **texte** (paragraphes séparés par une
  ligne vide), jamais comme HTML. Texte par défaut (à n'énumérer aucune fonctionnalité livrée après
  s42a) :
  > Bonjour,
  >
  > Votre association a ouvert sur son site un espace personnel pour chaque propriétaire. Vous y
  > retrouverez les informations qui vous concernent.
- Bouton en table « Ouvrir mon espace » (`buttonBg`, blanc forcé), **doublé de l'URL en clair**
  (« Ou recopiez ce lien dans votre navigateur : »).
- **Trois étapes numérotées** (§5.5, « Invitation initiale »), texte fixe de `messages/fr.json` :
  1. « Cliquez sur le bouton : votre espace s'ouvre directement. »
  2. « Ce lien vaut jusqu'au 1er décembre 2026 et ne sert qu'une fois. »
  3. « Ensuite, pour revenir, saisissez votre adresse sur la page de connexion : un nouveau lien vous
     est envoyé. Il n'y a **aucun mot de passe** à retenir. »
- Pied transactionnel (§5.4, fond `muted`, sans désinscription) : « Cet email vous est envoyé parce que
  le bureau de Clos-Fleuri vous a invité à rejoindre l'espace membre de son site. »
- **3a** clair ; **3b** jumelle sombre (§5.2 : `#171A1E`, texte `#E8EBEF`, bouton `#2063B0` blanc forcé,
  lien `#8CC3FC`).

Version texte complète (titre, texte de l'association, URL en clair, trois étapes, pied).

### Écran 4 — Réglages, section « Invitation »

Page Réglages du bureau (s02), nouvelle section `card` « Invitation des membres », formulaire existant
(une colonne, libellé au-dessus, « Facultatif » écrit en clair) :

- `textarea` « Texte de l'invitation » (Facultatif), 6 lignes. Aide : « Il s'affiche au-dessus du bouton
  de connexion. Le bouton, le lien et le mode d'emploi sont ajoutés d'office. » Champ vide : phrase du
  défaut (`whenEmptyKey`, patron s11) « Laissé vide, l'email reprend le texte par défaut : « Bonjour, …
  » ».
- `input` numérique 48 px « Durée de validité du lien d'invitation », suffixe écrit « jours ». Aide :
  « Le lien de connexion demandé depuis la page de connexion garde, lui, 20 minutes. » Erreur de champ
  (§3.1) hors bornes : « Indiquez un nombre de jours entre 1 et 30. »
- **4a** lecture/saisie ; **4b** erreur de champ.

### Écran 5 — Lien d'invitation expiré ou déjà utilisé

Même page que l'écran 3 du §7 (`/login/lien-invalide`), même ton, même action « Recevoir un nouveau
lien ». Seule l'explication change quand le lien venait d'une invitation : « Un lien d'invitation ne sert
qu'une fois et reste valable 7 jours. C'est ce qui protège votre espace, même si quelqu'un d'autre ouvre
votre boîte mail. » La phrase « **Vous n'avez rien fait de mal** » reste en tête.

- **5a** — variante invitation.

## Mockup

docs/designs/s42a-invitation-individuelle.html — visual reference. DO NOT copy into production: Execute
builds with the real components.

## Reused components (from the design system)

- `card` (`DetailCard`) — cartes « Adresses email » et « Accès à l'espace membre » de la fiche, section
  des Réglages.
- `table` + cartes empilées (§3.5) — tableau des adresses de s54, inchangé hors de la `meta` d'état.
- `button` `outline` — « Envoyer / Renvoyer l'invitation » ; état de chargement à largeur conservée.
- `alert` neutre (`CircleCheck`, `Info`) et `destructive` — issues de l'envoi, ancrées dans la carte.
- `textarea`, `input`, `label`, aide et erreur de champ (§3.1) — section Réglages.
- Gabarit email du lien magique (`MagicLinkMail`, `AssociationHeader`), pied transactionnel (§5.4),
  jumelles sombres (§5.2).
- Page `/login/lien-invalide` (§7 écran 3).

## States

- **Vide** — fiche sans adresse active : écran 2f (pas de bouton, renvoi au courrier).
- **Chargement** — écran 2c (bouton désactivé, libellé remplacé).
- **Erreur** — 2f (refus métier lisible), 2g (échec total ou partiel), 4b (champ hors bornes), 5a (lien
  expiré).
- **Succès** — 2d (envoyée), 2e (reportée : un succès différé, pas une erreur), écran 1 à jour.

## Design system gaps

1. **Téléphone du bureau** (§5.5 « Invitation initiale », §9 ligne Connexion) — l'invitation devrait le
   donner ; aucun réglage ne le porte. Les étapes se lisent sans numéro, comme depuis s03. Non comblé.
2. **Envoi partiel** (2g) — aucune forme du design system pour « parti à une partie des destinataires »
   hors des campagnes (s26). Proposé : `alert` `destructive` qui nomme les adresses servies ; à confirmer.
3. **Icône `Send`** — lucide, 20 px, trait 1,75 (§1.7) ; pas encore utilisée par un bouton du bureau.
   Conforme à la règle des icônes, signalé pour l'inventaire.

Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du conteneur,
vérifié le 2026-11-24) ; contrôle en lecture seule à la place : couleurs par les seuls tokens de `:root`,
hexadécimaux limités aux sept jumelles sombres du §5.2, marges dans l'échelle 4/8/12/16/24/32/48, chaque
planche en deux versions (ordinateur et mobile 390 px, par requêtes de conteneur), les treize états
présents.
