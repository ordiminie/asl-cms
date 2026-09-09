# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Quatorzième passage** — 44 stories (s00–s42 + s04b). Les huit constats E-01 à E-08 ont été
> re-vérifiés un à un contre le texte **et** contre le dépôt, et **les douze prédicats de s00 ont été
> exécutés**.

## Perimeter coverage

**Tronc commun — 37 lignes du tableau `Replicated (core loop)`**

| PRD feature (core loop)                           | Couvert par                       | OK ? |
| ------------------------------------------------- | --------------------------------- | ---- |
| CMS de pages génériques                           | s04                               | ✅   |
| Attribution des rôles (+ verrou anti-blocage)     | s14 (c1, c3)                      | ✅   |
| Permissions par rôle configurables en BO          | s37                               | ✅   |
| Lien magique 4 h + invitation + suivi d'adoption  | s03, s15 (c4), s42 (c5)           | ✅   |
| Pages publiques + contact archivé en BO           | s08 (c1, c3) + s04                | ✅   |
| Navigation du site public (menu + pied de page)   | s04b                              | ✅   |
| Identité visuelle (logo, teinte, favicon)         | s02 c6–c10 ; en-tête email s25 c3 | ✅   |
| Limitation de débit des formulaires publics       | s08 c5–c6, réutilisé s10 c9       | ✅   |
| Actualités (mini-blog daté)                       | s05                               | ✅   |
| Présentation du bureau                            | s06                               | ✅   |
| Désinscription et classification                  | s25 c6–c7 (effet), s27 c7–c10     | ✅   |
| Bandeau d'alerte global                           | s07                               | ✅   |
| SEO                                               | s11                               | ✅   |
| Import initial des membres                        | s13                               | ✅   |
| Modèle membre ↔ parcelle daté                     | s12                               | ✅   |
| Coordonnées (profil membre)                       | s16 (+ s12 côté bureau)           | ✅   |
| Questions au bureau + routage par catégorie       | s23 (modèle : s10)                | ✅   |
| Notes internes et historique par membre           | s24                               | ✅   |
| Import annuel relevés d'eau + rapport email       | s17 (c3)                          | ✅   |
| Historique de consommation                        | s18                               | ✅   |
| Signalements catégories + statuts                 | s10 (public), s22 (membre)        | ✅   |
| Publication des analyses d'eau                    | s09                               | ✅   |
| Documents partagés                                | s31                               | ✅   |
| Documents nominatifs physiquement séparés         | s32 (c2)                          | ✅   |
| Campagnes Brevo (4 modèles + libre, gabarit)      | s25                               | ✅   |
| Envoi échelonné > 300 + budget quotidien          | s26 (c6–c7)                       | ✅   |
| Relances d'impayés 3/2/1, activables              | s29                               | ✅   |
| Publipostage PDF                                  | s28                               | ✅   |
| Groupes de destinataires                          | s27                               | ✅   |
| Statistiques d'ouverture et de clic               | s30                               | ✅   |
| Modèles de documents (unitaire **et** en lot)     | s36 c3                            | ✅   |
| Facturation membres : interface + Pennylane       | s19, s20                          | ✅   |
| Redirection de paiement                           | s21                               | ✅   |
| Multi-tenant (Organization, config, RLS)          | s01 (+ s02)                       | ✅   |
| Export individuel d'un membre (y c. sans compte)  | s40 (c5)                          | ✅   |
| Simulation de rôle SuperAdmin (écritures tracées) | s41 (c7)                          | ✅   |
| Export et portabilité                             | s38 (+ s39)                       | ✅   |

**Modules activables** — Vote s33 ✅ · Voirie s34 ✅ · Petites annonces s35 ✅

- [x] Toute ligne du tableau « Replicated (core loop) » est délivrée par au moins une story. **Aucune
      ligne orpheline — aucun critical de couverture.**

## Scope

- [x] Aucune story ne réintroduit un item du cimetière. Re-parcouru intégralement : électricité/gaz,
      logique de vote (s33 l'exclut nommément), traitement des paiements (s20 c7, s21 c3), messagerie
      privée (s35), multi-immeubles/tantièmes, plan B de connexion (s03, s12, s28, s42), appels de
      fonds (s19), carte interactive (s34 c3), vote temps réel/procurations, IA conversationnelle,
      classification IA (s32), Kanban, messagerie dédiée, une base par tenant (s01), abstraction
      « ressource partagée » (s34), WordPress (ADR 001).
- [ ] Aucune story ne dépasse le périmètre — échoue toujours, de façon assumée et bornée, sur s00 et
      s39, dérogations déclarées symétriquement dans les deux en-têtes et au récapitulatif.

## Story quality

- [ ] **Tranche livrable de bout en bout** — échoue sur s00 (habillage du socle) et s39 (harnais de
      non-régression), les deux dérogations déclarées. Les 42 autres sont des tranches réelles.
- [x] **Chaque critère peut devenir un test.** E-01 (s00 c7) et E-07 (s19 c4) sont réellement
      corrigés ; je n'ai plus trouvé de critère non décidable.
- [x] Notes agentiques présentes et utiles partout.
- [x] **Complexité chiffrée ; aucune 5 ; chaque 4 énonce son risque.** Recompté ligne à ligne :
      3 × 1, 18 × 2, 15 × 3, 8 × 4 = 44, conforme à l'annonce.

## The list as a whole

- [x] **Aucun cycle, aucune référence en avant.** 44 lignes re-parcourues ; toutes les arêtes pointent
      vers un id antérieur. s04b → s04, s34 → s04b, s38 → s04b, s41 → s39 compris. s00 reste rattaché
      par l'arête s01 → s00.
- [x] **Ids bien formés, uniques, stables** (44 ids distincts). `AGENTS.md:70` autorise explicitement
      le suffixe lettre **et** qualifie `s00` de « legacy deviation of the same kind » ; `AGENTS.md:107`
      porte « except `s00`, a documented deviation ». Les deux dérogations sont couvertes.
- [x] **Aucun recouvrement.** Frontières re-vérifiées : s12/s16, s10/s23/s35 (catégories), s25/s27
      (ciblage), s28/s36 (moteur PDF), s38/s39/s40, s14/s37/s41, s15/s42, s00/s01 (portée).
      Dépendances de s38 recomptées à la main : exactement **25** (E-08 corrigé), et le récapitulatif
      dit bien « six familles de contenu », que les critères 3 à 8 énumèrent exactement.

## Vérification des douze prédicats de s00 contre le dépôt

| #   | Prédicat                                              | Valeur annoncée                                             | Mesuré                                                                                 | Verdict                                               |
| --- | ----------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | tokens §1.1                                           | `--radius: 0.625rem`, aucun `warning`, pas d'`--accent-hue` | ligne 60 `--radius: 0.625rem` ; 0 `warning` ; 0 `accent-hue`                           | ✅ exact                                              |
| 2   | `grep -rl 'dark:' src/`                               | 34                                                          | **34 fichiers** (125 occurrences)                                                      | ✅ exact                                              |
| 3   | `.dark` / `@custom-variant dark`                      | 4 lignes                                                    | lignes 5, 73, 187, 188                                                                 | ✅ exact                                              |
| 4   | `theme-toggle`                                        | 3 fichiers l'importent                                      | `docs-menu-header.tsx`, `[locale]/page.tsx`, `(public)/layout.tsx`                     | ✅ exact                                              |
| 5   | `grep -rl 'next-themes' src/`                         | 8, dont `user-preferences-sync.tsx`                         | **8 fichiers** ; `user-preferences-sync.tsx:31-33` applique bien la préférence         | ✅ exact                                              |
| 6   | polices `next/font`                                   | absent de `src/`                                            | **zéro occurrence**                                                                    | ✅ exact                                              |
| 7   | `git diff main...feature/s00 --stat -- …`             | 15 fichiers, **zéro** occurrence de `dark`                  | 15 fichiers, **zéro** occurrence (casse ignorée)                                       | ✅ **E-01 clos**                                      |
| 8   | quatre mesures §2.1 + contour 3:1 du **§1.4**         | 48 / 48-56 / 56 / 17-18 px                                  | conformes ; le 3:1 est bien en **§1.4** (ligne 254) ; borne restaurée                  | ✅ **E-04 clos**                                      |
| 9   | `grep -nE 'theme\|prefers-color-scheme' src/proxy.ts` | 11 lignes                                                   | lignes 75, 78, 79, 84, 86, 90, 91, 99, 126, 127, 128 = **11**                          | ✅ exact — **E-02 clos**                              |
| 10  | préférence non exposée                                | 5 hors `__tests__`                                          | **5** fichiers                                                                         | ✅ exact (mais voir F-01)                             |
| 11  | plus de rendu à deux thèmes                           | `mdx-content.tsx:46`, `chart.tsx:9`                         | `themes: {light, dark}` **ligne 46** ; `THEMES = {light:'', dark:'.dark'}` **ligne 9** | ✅ exact (mais voir F-02)                             |
| 12  | `check:rules` + grep `.claude/rules/`                 | —                                                           | 2 fichiers matchent ; `check-rules.ts` impose aussi la synchro `.cursor/`              | ✅ décidable, et plus couvrant que ne le dit la story |

**Aucune valeur annoncée n'est fausse** — la classe de défaut « 8 au lieu de 11 » ne se reproduit
nulle part. `x-theme` est bien produit et consommé nulle part.

## Sur le report de la colonne `theme` à s01 (décision humaine)

**Le handoff est sain, et pour une raison vérifiable dans le dépôt** : `src/db/models/user-model.ts:31`
déclare `theme: themeEnum('theme').default('system').notNull()`. La colonne dormante ne casse donc
aucune insertion pendant l'intervalle, et s00 c5 porte exactement le test qui le prouve (« un compte
dont `settings.theme` valait `dark` s'affiche en clair, sans erreur »). L'intervalle lui-même est
d'exactement une story : s01 dépend de s00, et toute autre story remonte à s01. s01 c10 est testable,
et la migration existait de toute façon pour l'ADR 009 — deux migrations pour une colonne auraient été
du bruit, conformément à `AGENTS.md`. Seule fissure réelle : F-03 ci-dessous.

## Findings

**F-01 — minor — s00 c10 : le prédicat est sensible à la casse, la prose ne l'est pas.**
`src/services/types/domain/user-types.ts:32` porte `export type Theme = ThemeEnumModel` (import ligne 9) et **aucune occurrence en minuscules** : `grep -rl 'theme' src/services/` ne le retourne pas. Le
critère peut donc passer alors que le type de domaine exposant la préférence survit dans la couche
service, ce que sa phrase (« la préférence de thème n'est plus exposée ») interdit. Conséquence
limitée : `ThemeEnumModel` disparaît avec l'enum en s01, donc le typecheck le rattrape — mais une
story plus tard, et par accident.

**F-02 — minor — s00 c11 : c'est le seul des douze prédicats qui énumère des fichiers, et un troisième site Shiki lui échappe.**
`src/components/ui/code-block.tsx:29` appelle `codeToHtml(..., {theme: 'github-dark'})` — un rendu
Shiki en dur sur un thème sombre, que ni c11 (qui nomme `mdx-content.tsx` et `chart.tsx`), ni c2 (le
fichier ne porte pas `dark:`), ni c5 n'atteignent. Sur un fond `bg-muted` clair imposé par
`rule-mdx-rendering.md`, c'est précisément le « rendu mixte » que la note ⚠️ de la story dit vouloir
éviter. Atténuation réelle et vérifiée : son unique importateur est
`src/components/features/chat/message-content.tsx`, retiré par l'ADR 009 en s01, dont le critère 8
exige que `pnpm knip` ne signale aucun orphelin. Le défaut n'est donc pas la survie du code, c'est le
retour de l'énumération par nom de fichier — la forme même qui a produit D-01 puis E-02 — dans le seul
critère qui l'emploie encore.

**F-03 — minor — la colonne `theme` vit aussi en SQL brut dans le seed, hors de portée des deux stories.**
`src/db/scripts/seed.ts:274` et `:291` écrivent `"theme"` et `END::theme_type as "theme"`. Aucun
prédicat de s00 ne balaie `src/db/` et aucun critère de s01 ne parle du seed : s01 c10 (« la colonne et
l'enum ont disparu du schéma et de la base ») peut passer pendant que `pnpm db:reset-seed` casse, donc
la suite e2e avec lui. Les notes de s01 nomment bien `seed.ts` comme « SQL brut à réécrire en partie »,
mais au titre de l'ADR 009 seulement — le thème n'y est pas mentionné, et c'est la seule pièce du
mécanisme que la chaîne s00 → s01 ne borde nulle part.

**F-04 — minor — s00 c8 et la règle transverse « Socle habillé » ne disent plus la même chose du §2.1.**
La borne est bien restaurée dans le critère (E-04 corrigé), mais la règle transverse affirme toujours
que « les conventions d'usage des composants de `src/components/ui/` […] sont faits une fois, **en
s00** », alors que c8 n'en livre que quatre mesures et renvoie « le reste » à la story de chaque écran.
Or plusieurs des onze lignes du §2.1 ne sont ni une des quatre mesures ni une règle de composition
d'écran : `card` « bordure 1px sans ombre par défaut », `markdown-editor` « barre réduite », `chart`
« barres, pas de courbe lissée », `sidebar` « item actif = fond + libellé en 600 ». Ce sont des défauts
de composant, personne ne les porte, et une story d'écran qui les appliquerait tomberait sous
l'interdit « un écran qui redéfinit une convention est un échec de review ».

**F-05 — minor — s00 ne demande nulle part que le produit compile et que sa suite passe.**
Les douze critères sont des prédicats d'**absence** plus trois vérifications à l'écran. Or ce qui
rattrape ce qu'un grep d'absence ne voit pas, c'est la compilation :
`src/components/context/app-providers.tsx:17-28` (`ThemeProvider`, `defaultTheme="system"`,
`storageKey="theme"`), `src/__tests__/customRender.tsx`, `src/app/__tests__/utils.tsx` et
`src/app/[locale]/base-layout.tsx:20` (`suppressHydrationWarning`, résidu de `next-themes`) échappent
tous aux douze prédicats et ne tiennent que par ce couplage. La Definition of Done du dépôt l'exige
déjà ; l'écrire en critère coûterait une ligne et fermerait mécaniquement la classe entière — F-01,
F-02 et F-03 comprises.

## Ce que je ne retiens pas comme défaut

- **Les huit constats du treizième passage sont réellement corrigés**, et pas seulement dans le texte :
  E-01 (forme `main...feature/s00` **et** prémisse vraie), E-02 (les 11 lignes de `src/proxy.ts`,
  valeur exacte), E-03, E-04 (§1.4 vérifié ligne 254, borne restaurée), E-05 (`AGENTS.md` seul, et sa
  section Design porte bien la règle), E-06, E-07, E-08 (27 → 24 → 25 et « six familles », arithmétique
  juste, 25 dépendances recomptées).
- **La correction de la valeur 8 → 11 était la bonne**, et c'est la seule du lot qui divergeait : les
  onze autres valeurs entre parenthèses sont exactes au fichier et à la ligne près.
- **s00 c7 est plus strict que sa formulation** — le pathspec porte `docs/design-system.md` entier,
  donc « ne touche pas le §5.2 » se prouve par « ne touche pas le fichier ». Conservateur, décidable,
  sans effet de bord.
- **s00 à 3 reste défendable** : 34 fichiers `dark:`, 8 `next-themes`, le proxy, les tokens et les
  polices, mais un travail mécanique et outillé par ses propres commandes.
- **Les deux dérogations de périmètre (s00, s39) sont assumées, bornées et symétriquement énoncées.**
- **Les frontières inter-stories restent le point fort du découpage** : prédicat « impayé » possédé par
  s19, modèle de catégories possédé par s10 et prouvé par s23, exclusion en s25 puis réintégration
  statutaire en s27, budget d'envoi prouvé sur l'adaptateur en s26, GED avant le vote, s29 non otage de
  Pennylane.

## Verdict

Le périmètre est intégralement couvert, le cimetière est étanche, l'ordre est exécutable, les ids sont
sains et vérifiés contre `AGENTS.md` réel : **aucun critical**. Les huit constats du treizième passage
sont fermés, et pour la première fois **les douze valeurs annoncées par s00 sont toutes exactes contre
le dépôt** — la classe de défaut « affirmation fausse sur le dépôt » ne se reproduit pas. Le report de
la colonne `theme` à s01 est un bon arbitrage, appuyé sur un `default('system').notNull()` qui rend
l'intervalle dormant inoffensif. Ce qui reste tient en cinq minor, tous de la même famille : ce que les
prédicats d'absence ne balaient pas (un type en `Theme` capitalisé, un troisième site Shiki nommé nulle
part, le SQL brut du seed) n'est rattrapé aujourd'hui que par la compilation et par `knip`, que la
story ne réclame jamais. Aucun n'empêche d'exécuter le découpage ; le plus rentable à corriger est
F-05, qui les ferme toutes en une ligne.

Max severity: minor
Stories ready: yes
