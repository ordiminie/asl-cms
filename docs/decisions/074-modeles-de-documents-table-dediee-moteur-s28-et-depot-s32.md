# ADR 074 — Modèles de documents : une table dédiée, le moteur de s28 avec des variables en plus, le dépôt de s32 fiche par fiche

- Status: accepted
- Date: 2026-11-25
- Scope: story s36-modeles-documents
- Complète : ADR 066 (moteur PDF du courrier, PDF jamais stocké), ADR 067 (adresse et calage), ADR 060
  (cibles de campagne), ADR 073 (documents nominatifs), ADR 010 (rien en dur), ADR 018 (registre d'actions)

## Context

s36 laisse le bureau écrire des modèles (convocation, PV, courrier type) et en tirer un document par fiche,
à l'unité (téléchargé, déposé si le bureau le demande) ou en lot (déposé dans chaque dossier nominatif). La
story impose de **réutiliser le moteur de s28** (« si cette story réintroduit un second moteur, le
découpage a échoué ») et de **déposer par le mécanisme de s32**. Les arbitrages du 25/11/2026
(`docs/research/s36-modeles-documents.md`, dernière section) fixent le produit ; restent des choix de
structure que le code ne tranche pas.

Faits du code qui pèsent :

- `renderLettersPdf` (`src/lib/letters/render-letters-pdf.ts:562`) imprime une lettre DL : en-tête, bloc
  adresse, ligne de date, « Objet : … », corps, pied ; tous les libellés viennent de l'appelant ;
- `substituteVariables` (`src/services/rules/campaign-rules.ts:70`) et `letterBodyBlocksOf`
  (`src/lib/letters/render-letter-body.ts:206`) ne remplacent que `CAMPAIGN_VARIABLES` (`nom`, `parcelle`,
  `date`) ; une accolade inconnue reste telle quelle ;
- `findUnknownVariables(text, allowed)` accepte déjà des variables propres à un type d'envoi (`{factures}`
  de s29) ;
- `depositMemberDocumentService` (`src/services/member-document-service.ts:334`) prend un `File`, revérifie
  `member.document.manage`, lit la fiche sous le tenant et ouvre le stockage de son seul dossier ;
- les modèles d'email de s25 sont des identifiants de code, pas une table : rien à étendre.

## Decision

1. **Une table `document_template`**, plate : `id`, `organization_id` (RLS forcée), `name`, `subject`,
   `body_markdown`, `created_at`, `updated_at`. Aucune colonne de fichier, aucune clé `*_key`. Aucun lien
   vers les documents déposés : ceux-ci restent figés quand le modèle change ou disparaît.
2. **Les variables d'un document** sont celles des campagnes plus `{association}` (nom affiché de
   l'association, `organization.name`). Le moteur reçoit ces variables en plus par un paramètre optionnel
   `extraValues` (rendu PDF, corps, objet), vide par défaut : aucun appelant existant ne change de
   comportement. Un modèle qui contient une autre variable n'est pas enregistré ; la génération refuse en
   plus, par défense, un modèle qui en contiendrait une.
3. **Le gabarit imprimé est la lettre de s28**, objet compris : « Objet » est un champ du modèle, variables
   permises. Le pied du courrier postal est remplacé par une phrase propre aux documents, lue dans
   `messages/fr.json`. Le gabarit institutionnel du design system §6.3 reste une cible non réalisée.
4. **Livraison** : sans dépôt, une route `GET` produit le PDF en mémoire et le renvoie sans rien conserver
   (ADR 066 §5). Avec dépôt, une Server Action produit le PDF puis le dépose par
   `depositMemberDocumentService` ; le navigateur télécharge ensuite **le fichier déposé** par la route de
   s32. Le dépôt passe d'abord : un refus ne télécharge rien.
5. **Le lot** : la cible (tous, impayés, groupe) est lue une fois, dédoublonnée par fiche ; le navigateur
   envoie ensuite **un appel serveur par fiche**, l'un après l'autre, chacun produisant et déposant un
   document. Pas d'atomicité, pas de reprise : le rapport dit ce qui est fait.
6. **Autorisation** : une action `document.template.manage` (owner, board) couvre les modèles, le
   téléchargement unitaire et la lecture de la cible d'un lot (précédent : le composeur liste les groupes
   sous `campaign.manage`, `campaign-service.ts:544`). Tout dépôt exige en plus `member.document.manage`,
   vérifié d'emblée par s36 et revérifié par s32.

## Considered options

- Modèles en réglages d'association (`organization_setting`) — rejeté : un réglage est une valeur, pas une
  liste que le bureau crée, renomme et supprime ; l'export s38 attend une table scopée ordinaire.
- Étendre les modèles d'email de s25 — rejeté : la story les déclare système distinct, et ce sont des
  identifiants de code sans table.
- Modèle déposé sous forme de fichier (DOCX, PDF à champs) — rejeté : c'est un second moteur.
- Ajouter `association` à `CAMPAIGN_VARIABLES` — rejeté : la variable deviendrait valide dans le composeur,
  les relances et leurs libellés, et `CampaignVariableValues` changerait pour tous les appelants.
- Remplacer `{association}` avant le moteur — rejeté : la valeur serait relue comme du Markdown (le moteur
  remplace dans les nœuds texte justement pour l'éviter), et l'objet devrait être traité à part.
- Gabarit institutionnel §6.3 ajouté au moteur — rejeté pour s36 : il demande un signataire, des
  coordonnées, un lieu et un numéro de pièce qu'aucun réglage ne porte (manque du design system, arbitrage
  Q4).
- Une seule route `POST` qui dépose et renvoie le PDF, ou un `GET` qui dépose — rejeté : un effet de bord
  sur un téléchargement, et deux chemins de dépôt à garder cohérents ; la route de s32 sert déjà le fichier
  déposé avec ses trois contrôles.
- Lot en une seule requête — rejeté : ~400 rendus pdfkit et écritures disque dans une requête dépassent le
  délai, sans mesure sur le VPS (ADR 066). Lot en tâche de fond (`scheduled_job`, ADR 006) — rejeté :
  plus lourd, et le patron du lot de s32 (un appel par fichier) suffit au volume.
- Réutiliser `member.document.manage` seule — rejeté : écrire un modèle et télécharger un document ne
  déposent rien ; s37 doit pouvoir régler les deux séparément.

## Consequences

- Une 59ᵉ table, 40ᵉ scopée : classement de `docs/architecture.md`, bloc de `e2e/tenant-isolation.spec.ts`.
- Aucune nouvelle clé de fichier : les documents déposés vivent dans `member_document.file_key`, déjà dans
  `FILE_KEY_COLUMNS` ; le téléchargement unitaire ne conserve rien.
- `renderLettersPdf`, `letterBodyBlocksOf` et `substituteVariables` gagnent un paramètre optionnel ; les
  tests de s28, s29 et s42b doivent rester verts sans changement.
- Un lot interrompu laisse des dépôts partiels ; un lot relancé redépose (aucune unicité sur
  `member_document`). Le bureau en est averti ; une reprise serait une story à part.
- Un rôle qui aurait `document.template.manage` sans `member.document.manage` peut télécharger mais ni
  déposer ni lancer un lot : l'interface le lui refuse d'emblée.
