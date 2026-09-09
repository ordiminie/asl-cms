# Adaptation du socle au design system — hors pipeline killer-saas

> **Statut** : préalable au découpage, conduit **hors du pipeline killer-saas** (arbitrage du
> 9 septembre 2026). Ce n'est pas une story et ce document n'est pas un contrat de revue : c'est
> l'inventaire du travail, mesuré contre le dépôt.
>
> **Pourquoi hors pipeline** : ce travail a été porté pendant un temps par une story `s00`. Elle ne
> livrait aucune valeur observable par un utilisateur de l'association — à sa livraison, aucun écran
> d'ASL-CMS n'existe et ce qu'elle rhabille est le boilerplate. Quatre passages de revue consécutifs
> y ont buté, chacun demandant de mieux borner une surface que le découpage n'avait pas de bonne
> raison de porter. Elle est sortie de `docs/stories.md` ; la contrainte qu'elle imposait aux stories
> d'écran reste, en règle transverse « Socle habillé ».
>
> **Ce qui reste vrai pour les stories** : l'application du design system est faite **avant s01**.
> Une story d'écran ne reprend ni les tokens, ni les polices, ni les conventions d'usage des
> composants de `src/components/ui/`. Un écran qui redéfinit une couleur, une taille de cible ou un
> rayon est un échec de review.

## Objet

Appliquer `docs/design-system.md` au boilerplate ShipSaaS : poser les tokens, charger les polices, et
**retirer le thème sombre** — qui n'est pas seulement du CSS.

Référence : `docs/design-system.md` (le §1.1 s'intitule « feuille à copier dans
`src/app/globals.css` », le §10 énumère les dettes de socle) et `docs/designs/design-system.dc.html`
pour le rendu.

## Les chiffres, mesurés

Toutes les valeurs ci-dessous ont été relevées contre le dépôt et re-vérifiées par un agent en
contexte neuf. Chacune se recompte par la commande qui la porte.

| Ce qu'il faut obtenir                       | Commande                                                                                            | État de départ                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Les tokens du §1.1 dans `globals.css`       | lire `src/app/globals.css`                                                                          | `--radius: 0.625rem` (attendu `0.5rem`), **aucun** token `warning`, **pas** d'`--accent-hue` |
| Plus aucune classe `dark:`                  | `grep -rl 'dark:' src/`                                                                             | **34 fichiers**, 125 occurrences                                                             |
| Plus de bloc sombre ni de variante Tailwind | `grep -nE '\.dark\|@custom-variant dark' src/app/globals.css`                                       | **4 lignes** — 5, 73, 187, 188                                                               |
| Plus de sélecteur de thème                  | `grep -rl 'theme-toggle' src/`                                                                      | **3 fichiers** l'importent                                                                   |
| Plus de `next-themes`                       | `grep -rl 'next-themes' src/`                                                                       | **8 fichiers**                                                                               |
| Plus de thème dans le proxy                 | `grep -nE 'theme\|prefers-color-scheme' src/proxy.ts`                                               | **11 lignes**                                                                                |
| Plus de préférence de thème exposée         | `grep -rl 'theme' src/services/ src/components/features/user/ src/components/features/admin/users/` | **5 fichiers** hors `__tests__`                                                              |
| Les trois familles du §1.3 chargées         | `grep -rl 'next/font' src/`                                                                         | **0** — `next/font` est absent du dépôt                                                      |
| Les règles actives ne parlent plus de thème | `grep -rlE 'en sombre\|x-theme' .claude/rules/` puis `pnpm check:rules`                             | **2 fichiers**                                                                               |

## Les cinq pièges, et pourquoi ils coûtent cher

### 1. Ne pas toucher au thème sombre à moitié

Retirer le bloc `.dark` de `globals.css` sans neutraliser `next-themes` laisse les 125 classes `dark:`
s'appliquer par-dessus des tokens clairs dès que le système de l'utilisateur est en sombre — un rendu
mixte, **pire que l'état de départ**. Les six premières lignes du tableau vont ensemble.

### 2. La préférence de thème est persistée en base

C'est la partie qu'on oublie : supprimer le sélecteur ne suffit pas, un compte existant reste en
`dark`. La chaîne est complète, du formulaire jusqu'à Postgres :

```
src/db/models/user-model.ts:15   pgEnum('theme_type', ['light','dark','system'])
src/db/models/user-model.ts:31   theme: themeEnum('theme').default('system').notNull()
src/db/models/user-model.ts:100  export type ThemeEnumModel
src/services/types/domain/user-types.ts:32   export type Theme = ThemeEnumModel   ← capitalisé
src/services/validation/user-validation.ts
src/components/features/user/action.ts
src/components/features/user/edit-user-settings.tsx
src/components/features/admin/users/user-detail-form.tsx
src/components/features/admin/users/user-form-validation.ts
src/components/context/user-preferences-sync.tsx:31-33   applique settings.theme au chargement
src/db/scripts/seed.ts:274, :291   "theme"  et  END::theme_type as "theme"   ← SQL brut
```

⚠️ **`seed.ts` est le piège dans le piège.** C'est du SQL brut : retirer l'enum sans le réécrire fait
échouer `pnpm db:reset-seed`, et la suite e2e avec lui — elle tourne contre une base seedée.

⚠️ **`user-types.ts:32` échappe à un `grep` en minuscules** (`Theme`, capitalisé). Le typecheck le
rattrape, mais seulement une fois l'enum supprimé.

Retirer la colonne demande une **migration Drizzle** : `pnpm db:generate` après modification du
modèle, jamais de SQL écrit à la main dans `drizzle/migrations/`.

### 3. Le proxy renifle le thème, et produit un en-tête que personne ne lit

`src/proxy.ts` lit un cookie `theme` (75), se rabat sur `sec-ch-prefers-color-scheme` pour iOS
(83-91), pose un en-tête `x-theme` « pour Shiki » (99) et **force un cookie `theme` d'un an**
(127-131).

**`x-theme` est déjà du code mort** : `src/proxy.ts` est sa seule occurrence dans tout `src/` — il est
produit et consommé nulle part. La règle `.claude/rules/01-presentation/rule-react-cache-next-cache.md:163`
justifie encore un opt-out de `docs/[...slug]` par sa lecture, et cette règle est **périmée** :
`src/app/[locale]/docs/[...slug]/page.tsx` ne porte plus ni `instant = false` ni `x-theme`. Les quatre
opt-out restants sont `checkout/[priceId]`, `checkout/better-auth` et `admin/layout.tsx`.

### 4. Trois sites rendent en deux thèmes, et un quatrième en dur

```
src/components/mdx-content.tsx:46     themes: {light: 'github-light', dark: 'github-dark'}   ← Shiki dual-theme
src/components/ui/chart.tsx:9         const THEMES = {light: '', dark: '.dark'}              ← génère du CSS .dark
src/components/ui/code-block.tsx:29   theme: 'github-dark'                                   ← Shiki en dur, sombre
```

`ui/code-block.tsx` rend du code sur un thème sombre alors que `rule-mdx-rendering.md` impose un fond
`bg-muted` clair. Son unique importateur est `src/components/features/chat/message-content.tsx`, que
l'ADR 009 retire en s01 — `pnpm knip` le signalera comme orphelin à ce moment-là.

### 5. L'exception email est structurante

Le mode sombre disparaît du web, **pas de l'email** : certains clients l'imposent, et le §5.2 du
design system spécifie le comportement des gabarits sous mode sombre forcé.

Attention à la prémisse : **`src/lib/emails/` ne contient aujourd'hui aucune occurrence de `dark`** sur
ses 15 fichiers. Il n'y a pas de mode sombre existant à préserver — c'est la **spécification** du §5.2
qu'un nettoyage trop zélé effacerait, pas du code. Le §5.3 renvoie d'ailleurs à
`src/lib/emails/theme.ts`, qui n'existe pas.

## Ce que le nettoyage doit aussi emporter

Ces fichiers ne sortent d'aucun `grep` d'absence ci-dessus et ne tiennent que par la compilation :

- `src/components/context/app-providers.tsx:17-28` — `ThemeProvider`, `defaultTheme="system"`, `storageKey="theme"`
- `src/components/context/theme-provider.tsx`
- `src/app/[locale]/base-layout.tsx:20` — `suppressHydrationWarning`, résidu de `next-themes`
- `src/app/__tests__/theme.test.tsx`, `src/app/__tests__/utils.tsx`, `src/__tests__/customRender.tsx`

**D'où la vérification qui ferme tout** : `pnpm lint`, le typecheck, `pnpm test --run` et `pnpm knip`.
C'est le seul filet qui attrape ce qu'un grep d'absence ne voit pas.

⚠️ `pnpm test` lance Vitest en mode **watch** et ne rend jamais la main : utiliser `pnpm test --run`.

## Documentation à mettre à jour dans le même lot

Sans quoi les règles mentent à l'agent suivant :

- `.claude/rules/01-presentation/rule-mdx-rendering.md:54` — ne demande plus de vérifier « en clair et en sombre »
- `.claude/rules/01-presentation/rule-react-cache-next-cache.md:163` — l'opt-out par lecture du thème tombe (déjà faux, voir §3)
- `docs/design-system.md` §10.3 — attribue à tort ce point à `docs/architecture.md`, où `x-theme` **n'apparaît pas** (grep : zéro occurrence)
- `pnpm check:rules` doit passer : il vérifie aussi la synchronisation des copies générées dans `.cursor/rules/`

## Ce qui n'appartient pas à ce travail

- **Les cinq composants du §2.2 ne sont pas construits ici.** `<AlertBanner />` appartient à s07,
  `<ImpersonationBar />` à s41, et `<PreviewBar />`, `<SortableList />`, `<BlockPicker />` à s04. Le
  design system l'écrit : « chaque état correspond à une story ».
- `<MeterInput />` a été **retiré** du design system (arbitrage du 8 septembre 2026) : il n'y a pas de
  saisie manuelle des relevés d'eau, le seul chemin est l'import de s17. Ne pas le réintroduire.
- **Ce travail applique des conventions à des composants existants, il n'en crée aucun.** Les « 37 du
  socle » du design system sont les 37 fichiers de `src/components/ui/`.
- **Pas de refonte des écrans.** La composition de chaque écran appartient à sa story et à son
  `/ks-design`.
- Du §2.1, seules les **quatre mesures** relèvent du socle : bouton `default` 48 px, champ 48 px
  (56 sous 640 px), ligne de tableau 56 px, texte courant 17-18 px — plus le contour de champ à 3:1
  (§1.4, WCAG 1.4.11). Les autres conventions du §2.1 gouvernent la **composition d'un écran** (« un
  seul bouton `default` par écran », « `tabs` : 4 maximum, jamais côté membre ») et appartiennent aux
  stories d'écran.
- Un manque du design system se **consigne** au §10, il ne se comble jamais par une valeur inventée
  (`AGENTS.md`, section Design).

## Deux pièges d'environnement

- **Les polices** : la feuille du §1.1 fait pointer `--font-sans` vers `--font-public-sans`, or aucune
  police n'est chargée dans le dépôt. Copier ces lignes avant de charger les polices rend les
  déclarations `font-family` invalides, **sans erreur visible**.
- **`pnpm dev` ne recharge pas à chaud** dans le conteneur de développement : le dépôt est un montage
  9p depuis un disque Windows et les événements de fichiers ne traversent pas. Prévoir un redémarrage
  du serveur à chaque vérification visuelle, ou déplacer le dépôt sur le système de fichiers Linux.

## Recouvrement avec s01

s01 supprime cinq sous-systèmes (ADR 009), dont des fichiers portant des classes `dark:`. Si ce
travail passe avant, il les nettoie et s01 les supprime ensuite — nettoyer du code qui sera effacé
coûte moins cher que de maintenir une liste d'exclusions. `(public)/pricing_old` est par ailleurs du
code mort du boilerplate qu'aucune story ne retire à ce jour : à signaler plutôt qu'à rhabiller.
