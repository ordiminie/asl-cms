# Design Brief — Story s46-comptes-herites-minimum

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md), 13 octobre 2026) : le
> produit n'est servi qu'en clair, thème forcé, sans sélecteur. **Ne pas dessiner de version
> sombre** : le design system dit que « tout nouvel écran se dessine et se vérifie en clair seul ».
> Chaque écran est en revanche livré en **deux versions : ordinateur et mobile (390 px)**.

## Story

**En tant que** membre du bureau **je veux** un espace de compte réduit à ma sécurité **afin de** ne
pas me perdre dans des écrans de clés d'API, d'organisations ou d'abonnement qui ne servent pas
l'association.

Acceptance criteria (ceux qui ont un écran sont en gras) :

- **`/account` reste accessible à tout utilisateur connecté et ne propose que la sécurité (email, mot
  de passe, double authentification, sessions)** ; les autres adresses du compte hérité
  (`/account/settings`, `/account/api-keys`, `/account/notifications`, `/account/organizations/…`,
  `/account/invitations/…`, `/account/billing/…`, `/team/…`) répondent 404, et aucun menu n'y
  renvoie _(la page 404 existe déjà, ne pas la redessiner)_.
- **`/dashboard` devient l'espace membre : il ne montre plus rien du tableau de bord du boilerplate,
  seulement le nom de l'association et un lien vers la sécurité du compte (`/account`)**, en
  attendant « Mes parcelles » (story s12d). Sans session, il redirige vers la connexion _(pas
  d'écran)_.
- **Sur le domaine d'une association, le menu de `/admin` propose au SuperAdmin un lien vers le
  back-office du bureau de cette association (`/bureau`)**, qui s'ouvre sans nouvelle connexion.
- Familles de pages retirées de la configuration, dates en français, règles de code à jour _(pas
  d'écran)_.

Contexte produit : l'espace membre sert des propriétaires souvent âgés, qui viennent deux fois par an
chercher **une** chose. Le back-office du bureau (`/bureau`) sert 3 à 8 bénévoles élus. `/admin` est
le back-office de la plateforme, réservé au SuperAdmin (le prestataire) : c'est un écran hérité du
boilerplate, qui n'est **pas** redessiné ici.

### Décisions de périmètre (déjà prises, à respecter)

1. **L'espace membre garde l'adresse `/dashboard`.** La story s12d y posera la section « Mes
   parcelles » (déjà dessinée : `docs/designs/s12-membres-parcelles.md`, écran 6 — `h1` « Bonjour
   {prénom nom} », marqueur « Espace personnel », carte « Mes parcelles »). Ici, la page est **vide
   de contenu métier** : elle doit pouvoir recevoir cette section sans changer de cadre.
2. **Pas de barre latérale ni d'onglets côté membre** (design system §2.1 et §8). Aujourd'hui,
   `/dashboard` et `/account` vivent dans la coquille du boilerplate, qui a une barre latérale avec
   sélecteur d'organisation, menu utilisateur et bouton de retour d'expérience : **tout cela part**.
   Gabarit de l'espace membre : `max-w-[1000px]`, une colonne (§1.6).
3. **Les formulaires de sécurité de `/account` existent et ne sont pas redessinés** : changement
   d'adresse email, changement de mot de passe, double authentification, sessions ouvertes. On
   dessine la page qui les porte, pas leur contenu.
4. **Destination après connexion inchangée dans cette story** : tout le monde arrive encore sur
   `/dashboard` (la story suivante, s46b, enverra le bureau sur `/bureau`). Un membre du bureau peut
   donc atterrir sur l'espace membre vide : l'écran doit rester compréhensible pour lui aussi.
5. **Personne n'a de compte sans y être invité** : il n'y a pas d'inscription, pas d'écran « créer
   un compte ».

## Screens to produce

Trois écrans et un repère de continuité. Données fictives : association « Les Amis de l'Étang »,
teinte « eau » (195), logo absent (donc monogramme « AE »). Membre connectée : Claire Meunier,
`claire.meunier@exemple.fr`.

### 0 · Coquille de l'espace membre — en-tête (⚠️ manque du design system, à proposer)

Le design system fixe le gabarit de l'espace membre mais **ne dit rien de son en-tête** : ni
identité, ni moyen de se déconnecter, ni retour au site public. C'est un manque signalé, à trancher
sur le canevas. Contraintes de la proposition :

- **Identité** : `<AssociationMark />` en taille `public` (carré 44 px, nom en 20 px, Source Serif 4 /
  600), qui mène au site public (`/`). Jamais recomposé à la main.
- **Se déconnecter** : un bouton `outline` « Se déconnecter », **icône `LogOut` + libellé** (jamais
  l'icône seule), cible 48 px (56 px sur mobile). C'est une action secondaire : elle ne prend pas le
  `default` de l'écran.
- **Aucune autre entrée** : pas de menu, pas d'avatar, pas de cloche de notifications, pas de
  sélecteur. Deux pages seulement vivent dans cette coquille (`/dashboard`, `/account`) ; la
  navigation entre elles passe par des liens dans le contenu.
- Filet `border` 1 px sous l'en-tête, fond `background`. Pas d'ombre.
- **Mobile (390 px)** : les deux éléments restent visibles et étiquetés ; si la largeur manque, le
  nom de l'association passe à la ligne ou se tronque avec points de suspension, **le bouton garde
  son libellé**. Pas de tiroir : il n'y a rien à y ranger.
- Lien d'évitement « Aller au contenu » en tête de page (§1.5).

Montrer la coquille sur les écrans 1 et 2 (même en-tête, même gabarit).

### 1 · Espace membre (`/dashboard`)

- **Purpose** : être l'endroit où le membre arrive après sa connexion. Aujourd'hui, il n'y trouve que
  l'accès à la sécurité de son compte ; demain, ses parcelles.
- **Layout** : coquille de l'écran 0, puis colonne `max-w-[1000px]`. `h1` « Votre espace membre »
  (Source Serif 4, 34 px). Dessous, une `card` « Sécurité du compte » : une phrase en `body` —
  « Votre adresse email, votre mot de passe et les appareils connectés à votre compte. » — et un
  lien d'action « Gérer la sécurité du compte » vers `/account`.
- **Proposition à valider** : une phrase sous le `h1`, en `body` `muted-foreground`, qui dit
  l'espace sans rien promettre de daté — par exemple « Vous trouverez ici les informations de votre
  compte. ». Si elle n'apporte rien, la retirer.
- **Ce qui n'y figure pas** : aucun chiffre, graphique, tuile, statistique, « activité récente »,
  carte d'abonnement, nom d'organisation. Pas de marqueur « Espace personnel » : il arrivera avec
  « Mes parcelles », la seule donnée personnelle de la page (§3.4).
- **Actions** : le lien « Gérer la sécurité du compte » (c'est l'action unique de l'écran : un seul
  `default` au plus, ou un lien) ; « Se déconnecter » dans l'en-tête.
- **States** :
  - nominal : ci-dessus ;
  - visiteur sans session : redirigé vers la connexion _(pas d'écran)_ ;
  - **SuperAdmin ou compte sans appartenance à l'association** : même écran, à l'identique — la page
    ne lit rien du membre ;
  - chargement, vide, erreur : sans objet (aucune liste, aucune donnée chargée).

### 2 · Sécurité du compte (`/account`)

- **Purpose** : le seul écran de compte qui reste. Changer son email, son mot de passe, gérer la
  double authentification, voir et fermer ses sessions.
- **Layout** : coquille de l'écran 0, colonne `max-w-[1000px]`. En tête, un lien retour « Revenir à
  mon espace » (vers `/dashboard`, icône `ArrowLeft` + libellé). `h1` « Sécurité du compte ».
  Chapeau en `body` `muted-foreground` : « Votre adresse email, votre mot de passe et les appareils
  connectés à votre compte. » Puis les quatre sections existantes, chacune dans sa `card`, empilées
  dans cet ordre : **Adresse email** · **Mot de passe** · **Double authentification** · **Appareils
  connectés** (aujourd'hui « sessions »). Représenter le contenu de chaque carte par son titre et un
  aperçu schématique (un champ, un bouton) : il n'est pas redessiné.
- Aujourd'hui la page porte un `h1` « Mon Compte », un `h2` « Sécurité » qui répète le titre et une
  description qui contient « authentification » : le titre unique « Sécurité du compte » les
  remplace.
- **States** : chaque formulaire garde ses états actuels (non redessinés). La page elle-même n'a ni
  vide ni chargement : elle est toujours remplie.

### 3 · Repère de continuité — barre latérale de `/admin` (héritée, ne pas redessiner)

`/admin` a une barre latérale du boilerplate (repliable en icônes), avec un groupe en bas qui porte
aujourd'hui une seule entrée, « Application (front office) », vers `/dashboard`. **Cette entrée est
remplacée**, sur le domaine d'une association, par **« Back-office de l'association »** (icône du
vocabulaire lucide, proposée sur le canevas, + libellé ; `tooltip` et `aria-label` en mode replié),
avec le nom de l'association en sous-libellé `meta` si la place le permet. Elle ouvre `/bureau`
dans le même onglet, sans nouvelle connexion. **Sur l'adresse de la plateforme**, qui ne sert
aucune association, l'entrée **n'apparaît pas** — pas d'entrée grisée. Montrer les deux cas, en
desktop seulement (le back-office plateforme n'est pas un usage mobile).

## Design system constraints (non-negotiable)

- **Tokens** (clair seul, `docs/design-system.md` §1.1) :
  - surfaces & texte : `--background: oklch(1 0 0)` · `--foreground: oklch(0.22 0.015 250)` ·
    `--card: oklch(1 0 0)` · `--muted: oklch(0.972 0.005 240)` ·
    `--muted-foreground: oklch(0.45 0.02 245)` · `--border: oklch(0.9 0.008 245)` ·
    `--input: oklch(0.66 0.014 245)` · `--ring: oklch(0.55 0.11 235)` ;
  - actions : `--primary: oklch(0.35 0.06 240)` · `--primary-foreground: oklch(0.985 0.003 240)` ·
    `--secondary: oklch(0.965 0.006 240)` · `--secondary-foreground: oklch(0.3 0.02 245)` ·
    `--link: oklch(0.45 0.13 250)` (souligné en plus de la couleur) ;
  - accent de l'association (identité seulement, **jamais sur un bouton**) : `--accent-hue: 195` ·
    `--accent: oklch(0.958 0.024 195)` · `--accent-foreground: oklch(0.38 0.08 195)` ·
    `--accent-solid: oklch(0.55 0.1 195)` ;
  - barre latérale (écran 3 seulement) : `--sidebar: oklch(0.985 0.004 250)` ·
    `--sidebar-accent: oklch(0.93 0.012 245)`.
- **Typographie** (§1.3) : `h1` Source Serif 4 34 px / 600 · `h3` (titre de carte) Public Sans
  20 px / 600 · `body` Public Sans **17 px** / 400 · `label` 16 px / 500 · `button` 16–17 px / 600 ·
  `meta` 15 px (plancher absolu). Jamais de texte courant sous 17 px.
- **Espacement** (§1.4) : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, rien d'autre. Intérieur de carte
  24 px, entre blocs 32 px. Marges latérales 16 px sous 1 024 px.
- **Rayon** : 8 px (`rounded-md`) cartes et boutons. **Bordures** : 1 px `border` ; cartes sans
  ombre.
- **Focus** : anneau 2 px `ring`, décalé de 2 px, jamais supprimé. Cibles 44 × 44 minimum, **56 px
  pour les actions principales sur mobile**.
- **Composants à réutiliser** : `button` (`default` 48 px, `outline` ; **jamais `sm` côté membre**),
  `card`, `separator`, lien (`link`), `<AssociationMark />` (§2.7), `sidebar` (écran 3, existant).
  Icônes lucide, trait 1.75, 16/20/24 px, toujours avec libellé.
- **Do** : sobre, aéré, registre de service public local · le mot porte l'information · une seule
  action attendue par écran · vouvoiement, phrases courtes, typographie française (espace insécable
  avant `: ; ! ?`, guillemets « »).
- **Don't** : `sidebar` ou `tabs` côté membre · densité de tableau de bord SaaS · tuiles de
  statistiques · menu d'icônes · accent du tenant sur un bouton · information dans un toast ou un
  tooltip · **jargon à l'écran** : « lien magique », « token », « OTP », « authentification »
  (§3.6) · dégradés, ombres lourdes, animations d'apparition.

Do not invent components, tokens or colors outside these.

## Out of scope

- Le contenu des quatre formulaires de sécurité (non redessinés). ⚠️ Leurs libellés actuels
  emploient « authentification à deux facteurs », que le design system interdit à l'écran : à
  signaler dans le retour, pas à corriger ici.
- « Mes parcelles » (story s12d) et le marqueur « Espace personnel ».
- La destination après connexion selon le rôle, la fermeture de l'inscription et la connexion
  limitée au domaine de l'association (story s46b) — aucun écran de connexion ici.
- L'en-tête du site public (son bouton « Connexion » ne sait pas encore qu'on est connecté).
- L'écran affiché après la déconnexion (existant).
- Le back-office `/admin` au-delà de l'entrée de l'écran 3 ; le back-office `/bureau`.
- La page 404 des adresses retirées.
- Toute version sombre.

## Expected output

Une maquette HTML statique de chaque écran (basse fidélité acceptée), **en desktop et en mobile
390 px** (sauf l'écran 3, desktop seul), en clair seul, n'utilisant que les tokens ci-dessus.
Rapporter l'export : il sera enregistré sous `docs/designs/s46-comptes-herites-minimum.html`. Noter
sur la maquette, en marge, la proposition retenue pour l'en-tête de l'espace membre (écran 0) : elle
entrera dans le design system comme réponse au manque signalé.
