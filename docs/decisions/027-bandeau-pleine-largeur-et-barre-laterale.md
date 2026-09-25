# ADR 027 — Le bandeau d'alerte pousse la page : la barre latérale passe de `fixed` à `sticky`

- Status: accepted
- Date: 2026-09-24
- Scope: story s07-bandeau-alerte

## Context

s07 doit afficher un bandeau d'alerte **sur toutes les pages du site**, publiques comme
authentifiées (critère 1). Le seul point par lequel passent les huit gabarits est `LocaleLayout` /
`BaseLayout` : c'est le « gabarit commun » de la note de story, et c'est là que le bandeau se rend,
en premier enfant de `<body>`.

Le design system §2.2 exige que le bandeau **pousse la page et ne la recouvre pas**, et le design de
la story (écran 3, planche `3d` barrée) montre ce qui arrive sinon.

Or `Sidebar` (`src/components/ui/sidebar.tsx`) ancre sa colonne desktop au viewport :
`fixed inset-y-0 z-10 h-svh`, doublée d'un `div` d'espacement en flux qui lui réserve sa largeur. Un
bandeau rendu au-dessus du contenu est donc **recouvert à gauche** par la barre latérale du bureau,
de l'espace membre, de l'admin et des docs héritées : l'icône et le mot « Alerte » disparaissent
dessous, et la page dépasse la hauteur de l'écran.

Le décalage ne peut pas être calculé en CSS : la hauteur du bandeau dépend du message (1 à 3 lignes
en desktop, jusqu'à 7 ou 8 à 390 px pour un message de 280 caractères, que le design interdit de
tronquer). Le design system ne porte aucune convention pour un bandeau pleine largeur dans un
gabarit à barre latérale — c'est son manque n° 5, explicitement laissé « à valider » au plan.

## Decision

La colonne desktop de `Sidebar` passe de `fixed inset-y-0 h-svh` à **`sticky top-0 h-svh`**, et le
`div` d'espacement disparaît : il n'existait que pour réserver la largeur d'un élément hors flux, que
la colonne porte désormais elle-même. Le repli `offcanvas` se fait par marge négative animée au lieu
d'un `left` négatif ; le repli `icon` garde ses classes de largeur ; le tiroir mobile (`Sheet`) n'est
pas touché.

Le bandeau, lui, reste **dans le flux**, sans `position` ni `z-index` : il n'a rien à recouvrir.

Sans bandeau — le cas courant — le rendu est identique à l'actuel. Avec bandeau, la barre commence
sous le filet du bandeau, puis s'épingle en haut du viewport dès que le bandeau a défilé.

## Considered options

- **Coquille en colonne flex de `100svh` avec défilement interne du contenu** (la proposition
  littérale du design) — rejetée : elle impose un conteneur de défilement interne à **tous** les
  gabarits, y compris le site public, le blog et les docs héritées, dont `rule-mdx-rendering.md`
  documente déjà la fragilité de l'ancrage. Disproportionné pour une story de complexité 1, et le
  risque porte sur des zones que s07 ne touche pas autrement.
- **Rendre le bandeau dans chaque layout de groupe** (5 à 6 fichiers) — rejetée : contraire à la
  lettre de la note de story (« le bandeau se pose dans le gabarit commun, pas page par page »), et
  tout gabarit ajouté plus tard oublierait le bandeau, sans que rien ne le signale.
- **Garder `fixed` et décaler la barre par une variable CSS** — rejetée : la hauteur du bandeau est
  variable, il faudrait la mesurer côté client, donc accepter un saut de mise en page à chaque
  chargement de chaque page.
- **Rendre le bandeau `sticky` ou fixe au-dessus de la barre latérale** — rejetée : il recouvrirait la
  tête de la barre, ce que le design system §2.2 interdit explicitement.
- **N'afficher le bandeau que dans la zone de contenu des gabarits à barre latérale** — rejetée :
  contredit l'écran 3 du design validé, qui le montre sur toute la largeur de la fenêtre.

## Consequences

**Plus facile** : le bandeau se rend une seule fois, pour tout le produit ; les gabarits futurs
l'héritent sans y revenir ; aucune échelle de `z-index` n'a besoin d'être inventée — le manque §9 du
design system reste ouvert pour s41, intact.

**Plus difficile** : s07 modifie une primitive partagée (`src/components/ui/sidebar.tsx`) utilisée
par quatre gabarits — bureau, espace membre, admin et docs héritées. C'est le vrai coût de cette
story, et la non-régression de ces quatre zones est à prouver.

**À surveiller** :

- `position: sticky` est **neutralisé par un ancêtre en `overflow-x: hidden`** (qui calcule
  `overflow-y: auto`). Le seul cas du dépôt est `src/app/[locale]/docs/layout.tsx`, dont les deux
  `overflow-x-hidden` passent en `overflow-x-clip`. Toute nouvelle occurrence d'`overflow-x-hidden`
  au-dessus d'un `SidebarProvider` casserait silencieusement l'épinglage.
- Le repli `offcanvas` s'anime désormais par marge et non par `left` : l'état final est le même, la
  transition diffère légèrement.
- **Écart assumé au design** : celui-ci écrit « la barre occupe la hauteur restante, pas celle de la
  fenêtre ». Ici elle garde `100svh` et commence sous le bandeau ; le document gagne la hauteur du
  bandeau en défilement, et la barre devient entièrement visible exactement quand le bandeau sort de
  l'écran. C'est le prix de ne pas convertir tout le produit au défilement interne.
