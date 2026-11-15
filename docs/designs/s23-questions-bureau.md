# Design — Story s23-questions-bureau

Design produit par l'agent (`/ks-orchestrator`, chemin agent) le 14/11/2026, à partir de `docs/design-system.md`.
Thème clair seul (ADR 033) : aucune version sombre n'est produite ni attendue.

Contrôle visuel : non fait — Chromium de Playwright ne démarre pas sur la machine (`libnspr4.so` absente, pas de `sudo`
pour l'installer). Repli par lecture du HTML : aucune couleur hors des tokens de `:root`, espacements ramenés sur l'échelle
du §1.4 (trois valeurs corrigées : 6, 10 et 20 px → 8, 12 et 24 px ; filet de navigation 3 → 4 px), 11 planches présentes
en desktop **et** en mobile 390 px, les quatre états couverts.

## Screen(s)

Quatre écrans, chacun en **desktop** et **mobile (390 px)**, mêmes contenus, mêmes états. Vocabulaire à l'écran :
**« sujet »** pour la catégorie (le membre comme le bureau lisent « Sujet de votre question », « Sujets des questions ») ;
le code et la base gardent `category`.

### A — Espace membre : carte « Une question pour le bureau ? » (`/dashboard`)

- Carte `h2` serif 20 px, **sous « Mes signalements »**, avant « Sécurité du compte ». Une phrase, un bouton `outline`
  « Poser une question au bureau ». Mobile : pleine largeur, 56 px.
- **Aucune liste des questions envoyées** : aucun critère ne la demande (hors périmètre).
- Après l'envoi : retour sur `/dashboard?question=envoyee`, `alert` neutre avec `CircleCheck` `primary` dans la carte
  (« Question envoyée. Le bureau vous répondra à votre adresse email. »), affichée une fois ; le bouton devient
  « Poser une autre question ».
- Compte connecté sans fiche dans l'association : pas de carte (comme « Mes signalements », s22).

### B — Poser une question (page dédiée de l'espace membre)

- Colonne `max-w-[68ch]` : lien « Revenir à mon espace » (`ArrowLeft`), `h1` « Poser une question au bureau », puis `card`.
- Deux champs : **Sujet de votre question** (`select`, « Choisissez… », aide : « Votre question part vers la personne du
  bureau chargée de ce sujet. ») et **Votre question** (`textarea` 144 px mini, compteur au plafond, 2 000 caractères
  proposés — valeur à fixer au plan).
- **Aucun champ d'identité.** Bloc séparé par un filet avant les boutons (patron s22) : « Le bureau saura que c'est vous :
  nous lui transmettons votre nom et votre adresse email. » puis les valeurs de la fiche en `meta`. Pas de téléphone : une
  question appelle une réponse écrite.
- Un seul bouton `default` « Envoyer la question », « Annuler » en `outline`. Desktop côte à côte 48 px ; mobile empilés
  56 px, « Envoyer » en premier.
- **Aucun sujet ouvert par l'association (B4)** : pas de formulaire ; une phrase et un bouton `outline` « Écrire au
  bureau » vers la page Contact publique (s08). Validé avec le plan le 14/11/2026.

### C — Bureau : « Questions des membres » (`/bureau/questions`)

- Nouvelle entrée de la barre latérale, groupe « L'association », **sans icône** (`Inbox` est réservée aux messages reçus,
  §1.7 ; aucune icône nouvelle n'est inventée).
- File, plus récente d'abord, paginée comme les messages (25 par page ; 10 cartes sous 640 px, §3.5). Colonnes : Reçue le
  (`data`) · Membre (nom en `body-strong`, email en `meta`, ou « Sans adresse email ») · Sujet · Question (extrait sur une
  ligne) · « Lire ». Bouton `outline` « Gérer les sujets » dans la barre d'outils.
- Sujet supprimé : son nom suivi de « — catégorie supprimée » en `meta` (critère 5, forme de s10).
- Échec de notification : `badge` `destructive` « Notification non envoyée » sur la même ligne (§3.10).
- Détail (C2) : lien de retour, `h1` « Question de <nom> », liste de définitions Membre (lien vers la fiche + `mailto:`) ·
  Sujet · Reçue le (`jj/mm/aaaa hh:mm`), carte « Question » au texte entier, bouton `default` « Répondre par email »
  (`mailto:`). Pas de réponse dans l'outil, pas de statut.
- Vide (C3) : « Aucune question reçue pour l'instant. » ; sans aucun sujet, la phrase ajoute que les membres ne peuvent pas
  encore en poser, et l'action est « Créer les sujets ». Chargement : `skeleton` sur la liste seule.

### D — Bureau : « Sujets des questions » (`/bureau/questions/sujets`)

- **Même écran que les catégories de signalement** (s10, `report-categories-manager`), textes adaptés : nom (40 caractères,
  compteur), adresse facultative « Adresse qui reçoit ces questions » avec l'aide « Laissée vide : l'adresse de contact de
  l'association. », compteur « n sur 10 », chaque ligne dit son adresse (ou « Adresse de contact ») et son nombre de
  questions.
- Phrase d'en-tête : chaque question part vers l'adresse de son sujet ; sans adresse, vers l'adresse de contact (affichée).
  C'est le routage **exclusif** du critère 2, différent de celui des signalements (ADR 028 §5).
- 11ᵉ sujet (D2) : bouton actif, refus en `alert` `destructive` sous le titre (§3.10) : « Vous avez déjà 10 sujets, le
  maximum. Supprimez-en un avant d'en ajouter un autre. »
- Suppression (D2) : `alert-dialog` qui dit combien de questions restent consultables avec « catégorie supprimée ».

## Mockup

`docs/designs/s23-questions-bureau.html` — référence visuelle, **11 planches × desktop et mobile**, chacune avec sa puce.
DO NOT copy into production : Execute builds with the real components. Elle charge les polices depuis Google Fonts, comme
les autres maquettes.

| Puce | Écran | État |
| ---- | ----- | ---- |
| A1 | Espace membre | Carte et bouton, place entre les cartes voisines |
| A2 | Espace membre | Succès au retour |
| B1 | Poser une question | Formulaire vierge + « Ce que le bureau reçoit » |
| B2 | Poser une question | Erreurs de saisie, résumé ancré |
| B3 | Poser une question | Envoi en cours, puis échec technique (texte conservé) |
| B4 | Poser une question | Aucun sujet ouvert |
| C1 | Bureau | File : sujet supprimé, notification non envoyée, membre sans email |
| C2 | Bureau | Détail d'une question |
| C3 | Bureau | Vide (aucun sujet) + chargement |
| D1 | Bureau | Sujets, 3 sur 10, ajout |
| D2 | Bureau | 11ᵉ sujet refusé, suppression confirmée |

## Reused components (from the design system)

- `card` — cartes de l'espace membre, formulaire, détail, sujets ; bordure 1 px, sans ombre.
- `select`, `textarea`, `input`, `label`, `form` — formulaire de s22 et écran des catégories de s10.
- `button` — `outline` (entrées, Annuler, Gérer les sujets) ; `default` unique par écran ; tailles 48 / 56 px, jamais `sm`.
- `alert` — neutre + `CircleCheck` `primary` (succès) ; `destructive` 2 px (résumé d'erreurs, échec, limite).
- `alert-dialog` — confirmation de suppression (s10).
- `badge` — `destructive` « Notification non envoyée » (§3.10).
- `table` → cartes empilées sous 640 px (§3.5) ; `skeleton` sur la liste seule ; `pagination` comme `/bureau/messages`.
- `ReportCategoriesManager` (s10) — à rendre paramétrable par domaine plutôt que dupliqué (décision du plan).
- Icônes : `ArrowLeft`, `CircleCheck`, `AlertTriangle`. Aucune icône nouvelle.

## States

- **A** : entrée (A1) · succès (A2) · sans fiche → pas de carte (non dessiné, comme s22).
- **B** : vierge (B1) · erreurs (B2) · envoi et échec (B3) · aucun sujet (B4).
- **C** : file (C1) · détail (C2) · vide et chargement (C3) · accès refusé → `BureauAccessDenied` existant (non dessiné).
- **D** : liste et ajout (D1) · limite et suppression (D2).

## Design system gaps

Aucun composant ni token inventé. Deux points, hors invention :

- **Icône de l'entrée « Questions des membres »** : le vocabulaire figé (§1.7) n'en a pas. L'entrée est sans icône, comme
  la plupart des entrées de la barre ; en ajouter une serait un ajout au vocabulaire, à décider hors de cette story.
- **Bouton désactivé (B3)** : pas de token « désactivé », comme relevé par s22 ; la maquette reprend l'état `disabled`
  existant du composant `button`.
