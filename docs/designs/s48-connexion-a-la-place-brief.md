# Design Brief — Story s48-connexion-a-la-place

> À coller dans Claude Design (`/design docs/designs/s48-connexion-a-la-place-brief.md`). Brief
> autonome : story, écrans, contraintes du design system, sortie attendue.

## Story

**En tant que** SuperAdmin Zourite Studio **je veux** me connecter à la place de n'importe quel compte
d'une association, sans son mot de passe, **afin de** réaliser en son nom une action qu'il ne peut pas
ou plus faire lui-même (passer la présidence, nommer le bureau, corriger sa fiche). C'est le garde-fou
de la plateforme quand une association se bloque.

Critères d'acceptation touchant l'interface :

1. Depuis l'écran SuperAdmin des membres d'une association, le SuperAdmin choisit un compte et ouvre
   une session à sa place, **sur le domaine de cette association** ; il voit exactement ce que ce
   compte voit.
2. Une **bannière permanente, sur toutes les pages**, dit à la place de qui il agit et permet d'en
   sortir ; la sortie rend sa session SuperAdmin.
3. Seul le SuperAdmin peut ouvrir une telle session. On ne peut pas agir à la place d'un autre
   SuperAdmin, ni enchaîner deux sessions.
4. Chaque ouverture et chaque sortie sont tracées.
5. La session expire d'elle-même (durée paramétrée) ; elle ne permet pas de changer le mot de passe,
   l'adresse email ni la double authentification du compte visé.

## Mode : clair seul

**Une seule version de thème : clair.** Le produit ne s'affiche qu'en clair (ADR 033, qui remplace
l'ADR 012) ; une livraison de conception ne fournit plus de jeu sombre. Chaque écran est en revanche
livré en **deux versions : bureau (≥ 1 024 px) et mobile (390 px)**, mêmes contenus, mêmes états.

## Écrans à produire

### Écran 1 — Le tableau des membres d'une association (point d'entrée)

- But : choisir le compte à la place duquel agir. Page existante `/admin/organizations/[id]/edit`,
  carte « Membres » du back-office SuperAdmin. On n'ajoute **qu'une action** à une ligne existante.
- Mise en page : tableau existant. Colonnes : avatar · nom · adresse email · rôle · date · action.
  Lignes 56 px, zébrure, en-tête sur `muted` en 15 px / 600.
- Action nouvelle par ligne : bouton `outline` **« Agir à sa place »**, icône `UserRoundCog` 20 px
  - libellé. La ligne porte déjà « Retirer » : montrer comment les deux cohabitent (le brief ne tranche
    pas, la planche propose) — c'est un manque à consigner, voir « Ce que le design system ne couvre pas ».
- Lignes **sans bouton** : un compte `super_admin` (on n'agit pas à la place d'un autre SuperAdmin).
  À la place du bouton, le texte `muted-foreground` « Compte SuperAdmin : impossible ». Les invitations
  en attente n'ont pas de compte : pas de bouton non plus.
- Sous 640 px : cartes empilées (§3.5), nom en titre, paires libellé / valeur, action en pleine largeur
  56 px, 10 cartes par page.
- États : vide (« Aucun membre avec un compte pour l'instant. »), chargement (`skeleton` de tableau),
  erreur (`alert` ancré), succès sans objet (l'action ouvre la boîte de l'écran 2).

### Écran 2 — Confirmer l'ouverture (`dialog`)

- But : une pause avant d'agir au nom de quelqu'un. Un `dialog`, **jamais plus de deux champs**.
- Contenu : titre « Agir à la place de {nom} ? » ; phrase « Vous verrez et ferez exactement ce que
  {nom} voit et fait ({rôle}, {association}). Vos actions seront enregistrées à votre nom, avec la
  mention « pour le compte de {nom} ». » ; durée écrite (« La session s'arrête d'elle-même au bout de
  {durée}. ») ; champ facultatif **Motif** (une ligne, « Facultatif » écrit, pas d'astérisque).
- Actions : « Agir à la place de {nom} » (`default`, 48 px) et « Annuler » (`outline`). Mobile :
  `dialog` ancré en bas, boutons 56 px empilés, principal en premier, pas de croix (§3.11).
- Variante **autre domaine** : quand l'écran est ouvert sur le domaine d'une autre association que celle
  du compte visé, la boîte dit où l'on va (« Vous allez ouvrir le site de {association}, adresse
  {domaine}. ») et le bouton devient « Ouvrir le site de {association} ». Un lien, pas un envoi de formulaire.
- États : envoi (libellé remplacé « Ouverture… », largeur conservée), erreur (`alert` dans la boîte).
- Erreurs à écrire, sans jargon : compte indisponible (« Ce compte est suspendu. Rien n'a été
  modifié. »), compte SuperAdmin (« On ne peut pas agir à la place d'un autre SuperAdmin. »), session
  SuperAdmin expirée (« Votre session a expiré. Reconnectez-vous, puis recommencez. »).

### Écran 3 — La bannière « à la place de »

- But : savoir à tout instant qu'on n'est pas soi-même, et pouvoir en sortir. **Sur toutes les pages** :
  site public, espace membre, bureau.
- Composant : `<ImpersonationBar />` du design system (§2.6), **rayée magenta**, `sticky top-0`,
  z-index 60, au-dessus du bandeau d'alerte (§2.3) et de tout le reste. Jamais réductible, jamais
  refermable. Les rayures sont décoratives : le texte porte l'information.
- Contenu : icône `UserRoundCog` + « **Vous agissez à la place de {nom}** » (`body-strong`) ; sous le
  texte, en `meta` : « {rôle} · {association} · fin de la session à {hh:mm} » ; bouton plein blanc
  **« Revenir à mon compte »** (seul élément clair de la barre, donc le premier vu), icône `LogOut` + libellé.
- Compte à rebours dans les **deux dernières minutes** : « La session se termine dans 1 min 45 s. »
  (annonce `aria-live="polite"` à 2 min, pas de rafraîchissement seconde par seconde lu à voix haute).
- Annonce d'entrée et de sortie en `aria-live="assertive"`.
- Montrer la bannière **sur trois pages** : l'accueil du site public, l'espace membre (`/dashboard`) et
  le bureau (`/bureau/pages`), avec le bandeau d'alerte de l'association actif pour prouver l'empilement
  (barre magenta au-dessus).
- Mobile : la barre passe sur trois lignes au plus (texte, détail, bouton pleine largeur 56 px) ;
  elle reste sticky et ne dépasse jamais un quart de l'écran.

### Écran 4 — Sortie et fin de session

- **Sortie explicite** : le clic sur « Revenir à mon compte » recharge la page entière et ramène au
  tableau des membres de l'association. Un `alert` neutre ancré en haut de l'écran 1 : « Vous êtes
  revenu à votre compte SuperAdmin. » (`CircleCheck` en `primary`, `role="status"`).
- **Fin par expiration** : le SuperAdmin arrive sur la page de connexion prestataire avec un `alert`
  neutre : « La session à la place de {nom} s'est terminée. Reconnectez-vous pour continuer. »
- Montrer les deux versions, bureau et mobile.

### Écran 5 — Les réglages du compte visé pendant la session (`/account`)

- But : montrer ce que le SuperAdmin **ne peut pas** faire. Page existante « Mon compte », espace membre.
- Les sections **Mot de passe, Adresse email, Double authentification** ne sont pas des formulaires : à
  leur place, un `alert` `muted` par section, ancré, qui dit « Indisponible pendant que vous agissez à la
  place de {nom}. Revenez à votre compte pour y accéder. » avec le bouton `outline` « Revenir à mon compte ».
- Le reste de la page (nom, coordonnées) reste tel que le membre le voit.
- Mobile : alertes pleine largeur, bouton 56 px.

## Contraintes du design system (non négociables)

### Tokens (thème clair unique)

- Surfaces et texte : `background` oklch(1 0 0) · `foreground` oklch(0.22 0.015 250) · `card` identique à
  `background` · `muted` oklch(0.972 0.005 240) · `muted-foreground` oklch(0.45 0.02 245) ·
  `border` oklch(0.9 0.008 245) · `input` oklch(0.66 0.014 245) · `ring` oklch(0.55 0.11 235).
- Actions : `primary` oklch(0.35 0.06 240) · `primary-foreground` oklch(0.985 0.003 240) · `secondary`
  oklch(0.965 0.006 240) · `destructive` oklch(0.48 0.17 27) · `link` oklch(0.45 0.13 250)
  (toujours souligné).
- Avertissement (`alert` de limite, bandeau d'alerte) : `warning` oklch(0.94 0.06 75) · `warning-border`
  oklch(0.6 0.13 65) · `warning-foreground` oklch(0.3 0.08 60).
- **Accent de l'association** (teinte 195 par défaut) : identité seulement (logo, filet de navigation
  active, encarts). **Jamais sur un bouton, jamais seul porteur d'un statut.**
- Bandes persistantes : `PreviewBar` fond `oklch(0.24 0.02 250)`, z-index 50. `ImpersonationBar` rayée
  **magenta** (hors palette de contenu), z-index 60. Le magenta n'est utilisé nulle part ailleurs.
- Polices : titres Source Serif 4 (`h1` 34 px / 600, `h2` 26 px) ; interface Public Sans (`h3` 20 px,
  `body` 17 px, `label` 16 px / 500, `button` 16-17 px / 600, `meta` 15 px) ; chiffres, heures et
  références en JetBrains Mono (`data`, `tabular-nums`). Aucun texte courant sous 17 px, aucune
  métadonnée sous 15 px.
- Espacement : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, **rien hors échelle**. Rayon : 4 px puces,
  8 px champs, boutons, cartes, 12 px dialogues. Bordures : 1 px `border`, 2 px `destructive` erreur.
  Ombres : aucune sur cartes et tableaux, `shadow-lg` sur dialogues.
- Focus : `outline: 2px solid var(--ring); outline-offset: 2px`, jamais `outline: none`. Cibles
  44 × 44 minimum, 56 px pour les actions principales sur mobile. Aucune action au survol seul.
  Mouvement ≤ 200 ms, `prefers-reduced-motion` respecté.
- Points de rupture : `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280. Back-office : barre latérale 248 px
  → tiroir sous `lg`. Espace membre : `max-w-[1000px]`, une colonne, marges 16 px sous 1 024 px.

### Composants à réutiliser

- `button` : `default` 48 px (56 mobile), `outline`, `destructive`. **Un seul `default` par écran.**
  Libellés à l'infinitif explicite. Chargement : libellé remplacé, bouton désactivé, largeur conservée.
- `table` + `badge` : lignes 56 px, une seule action par ligne, en clair. Sous 640 px, cartes empilées.
- `dialog` (≤ 2 champs) ; ancré en bas sous 640 px, boutons 56 px empilés, « Annuler » écrit, pas de croix.
- `alert` : ancré dans la page, jamais un toast. Succès neutre avec `CircleCheck` en `primary` ;
  échec en `destructive` ; limite atteinte : bouton visible et actif, refus en `alert` sous le titre.
- `skeleton` pour listes et tableaux uniquement. `breadcrumb` dès le 2ᵉ niveau du back-office.
- `<ImpersonationBar />` (§2.6) : `actor`, `subject`, `startedAt`, `expiresAt`, `onExit()`. Bouton plein
  blanc « Revenir à mon compte », seul élément clair. **Ne jamais confondre avec `<PreviewBar />`** (sombre
  et neutre).
- `<AlertBanner />` (§2.3) : le bandeau d'alerte de l'association, qui pousse la page ; la barre
  magenta est **au-dessus**.
- `<AssociationMark />` : logo ou monogramme, **le nom toujours écrit** ; ne pas recomposer.
- Icônes lucide, trait 1.75, tailles 16 / 20 / 24, `currentColor`. **Jamais d'icône seule** comme
  action : icône + libellé.

### Do / Don't

- ✅ Sobre, aéré, très lisible. Le mot porte l'information, la couleur ne fait que renforcer.
- ✅ Vouvoiement, phrases courtes, typographie française (espace insécable avant `: ; ! ?`, guillemets « »,
  apostrophe courbe). Dates `02/09/2026` en tableau, heures `hh:mm`.
- ✅ Un message d'erreur dit ce qui est perdu, et le plus souvent que rien ne l'est.
- ❌ Jamais « lien magique », « token », « OTP », « authentification », « impersonation » ni
  « usurpation » à l'écran. Écrire « agir à la place de ».
- ❌ Aucune information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ `tabs` ou `sidebar` côté membre. Dégradés, verre dépoli, ombres lourdes, animations d'apparition.

Ne pas inventer de composant, de token ni de couleur hors de cette liste.

## Hors périmètre

- Notification du compte visé (email ou ligne visible dans son espace) : non demandée par les critères.
- Écran de consultation du journal des ouvertures et sorties : la trace est écrite, pas lue ici.
- Simulation de rôle sans personne derrière (s41), et son sélecteur de rôle.
- Toute modification de l'écran « Membres » au-delà de l'ajout d'une action par ligne.
- Retrait d'un membre, invitation, changement de rôle : écrans existants, inchangés.
- Réglage de la durée de session : c'est un paramètre de plateforme, pas un écran de cette story.
- Mode sombre.

## Sortie attendue

Une maquette HTML statique, basse fidélité, des cinq écrans, **en bureau et en mobile (390 px)**, en
thème clair, avec les états listés (vide, chargement, erreur, succès) quand ils existent. Elle n'utilise
que les tokens ci-dessus. Rapporter l'export : il sera enregistré sous `docs/designs/s48-connexion-a-la-place.html`.
Consigner en fin de livraison tout besoin que le design system ne couvre pas (notamment deux actions sur
une ligne de tableau).
