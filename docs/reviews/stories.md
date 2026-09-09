# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Treizième passage** — 44 stories (s00–s42 + s04b). Les sept constats D-01 à D-07 du douzième
> passage ont été re-vérifiés un à un contre le texte actuel, et **les neuf prédicats de s00 ont été
> exécutés contre le dépôt**.

## Perimeter coverage

**Tronc commun — 37 lignes**

| PRD feature (core loop)                                    | Couvert par                         | OK ? |
| ---------------------------------------------------------- | ----------------------------------- | ---- |
| CMS de pages génériques                                    | s04                                 | ✅   |
| Attribution des rôles aux membres (+ verrou anti-blocage)  | s14 (c3 = verrou)                   | ✅   |
| Permissions par rôle configurables en BO                   | s37                                 | ✅   |
| Connexion lien magique 4 h + invitation + suivi d'adoption | s03, s15, s42                       | ✅   |
| Pages publiques + contact archivé en BO                    | s08 (+ s04)                         | ✅   |
| Navigation du site public (menu et pied de page éditables) | s04b                                | ✅   |
| Identité visuelle (logo, teinte, favicon)                  | s02 c6–c10 ; en-tête d'email s25 c3 | ✅   |
| Limitation de débit des formulaires publics                | s08 c5–c6, réutilisé s10 c9         | ✅   |
| Actualités (mini-blog daté)                                | s05                                 | ✅   |
| Présentation du bureau                                     | s06                                 | ✅   |
| Désinscription et classification                           | s25 c6–c7 (effet), s27 c7–c10       | ✅   |
| Bandeau d'alerte global                                    | s07                                 | ✅   |
| SEO                                                        | s11                                 | ✅   |
| Import initial des membres                                 | s13                                 | ✅   |
| Modèle membre ↔ parcelle daté                              | s12                                 | ✅   |
| Coordonnées (profil membre)                                | s16 (+ s12 côté bureau)             | ✅   |
| Questions au bureau + routage par catégorie                | s23 (modèle : s10)                  | ✅   |
| Notes internes et historique par membre                    | s24                                 | ✅   |
| Import annuel relevés d'eau + rapport email                | s17                                 | ✅   |
| Historique de consommation                                 | s18                                 | ✅   |
| Signalements catégories + statuts                          | s10 (public), s22 (membre)          | ✅   |
| Publication des analyses d'eau                             | s09                                 | ✅   |
| Documents partagés                                         | s31                                 | ✅   |
| Documents nominatifs physiquement séparés                  | s32                                 | ✅   |
| Campagnes email Brevo (4 modèles + libre)                  | s25                                 | ✅   |
| Envoi échelonné > 300 + budget quotidien                   | s26                                 | ✅   |
| Relances d'impayés (3/2/1 semaines), activables            | s29                                 | ✅   |
| Publipostage PDF                                           | s28                                 | ✅   |
| Groupes de destinataires                                   | s27                                 | ✅   |
| Statistiques d'ouverture et de clic                        | s30                                 | ✅   |
| Modèles de documents (unitaire **et** en lot)              | s36 c3                              | ✅   |
| Facturation membres : interface + Pennylane                | s19, s20                            | ✅   |
| Redirection de paiement                                    | s21                                 | ✅   |
| Multi-tenant (Organization, config, RLS)                   | s01 (+ s02)                         | ✅   |
| Export individuel d'un membre                              | s40                                 | ✅   |
| Simulation de rôle SuperAdmin                              | s41                                 | ✅   |
| Export et portabilité                                      | s38 (+ s39)                         | ✅   |

**Modules activables** — Vote s33 ✅ · Voirie s34 ✅ · Petites annonces s35 ✅

- [x] Toute ligne du tableau « Replicated (core loop) » est délivrée par au moins une story. **Aucune
      ligne orpheline — aucun critical de couverture.** La ligne « Navigation » est désormais servie à
      la lettre : le PRD ne promet plus d'en-tête éditable et renvoie logo/teinte à la ligne
      « Identité visuelle » (**D-04 corrigé**).

## Scope

- [x] Aucune story ne réintroduit un item du cimetière. Re-parcouru : électricité/gaz, logique de
      vote (s33 l'exclut nommément), traitement des paiements (s21 c3, s20 c7), messagerie privée
      (s35), multi-immeubles/tantièmes, plan B de connexion (s42, s12), appels de fonds, carte
      interactive (s34), vote temps réel/procurations, IA conversationnelle et classification IA
      (s32), Kanban, messagerie dédiée, une base par tenant (s01), abstraction « ressource partagée »
      (s34), WordPress (ADR 001). La réécriture de s00 n'introduit rien de nouveau.
- [ ] Aucune story ne dépasse le périmètre — échoue toujours, et toujours de façon assumée, sur s00
      et s39. La dérogation reste défendable et est énoncée symétriquement dans les deux en-têtes et
      dans le récapitulatif.

## Story quality

- [ ] **Tranche livrable de bout en bout** — échoue sur s00 et s39 (dérogations déclarées). Les 42
      autres sont des tranches réelles.
- [ ] **Chaque critère peut devenir un test** — échoue sur s00 c7 (E-01) et, résiduellement, sur s19
      c4 (E-07).
- [x] Notes agentiques présentes et utiles partout.
- [x] **Complexité chiffrée ; aucune 5 ; chaque 4 énonce son risque.** Recompté ligne à ligne :
      3 × 1, 18 × 2, 15 × 3, 8 × 4 = 44, conforme à l'annonce.

## The list as a whole

- [x] **Aucun cycle, aucune référence en avant.** Les 44 lignes re-parcourues ; s04b → s04,
      s34 → s04b, s38 → s04b compris. s00 reste rattaché au graphe par l'arête s01 → s00.
- [x] **Ids bien formés, uniques, stables** (44 ids distincts). `AGENTS.md` ligne 70 autorise le
      suffixe lettre et la ligne 107 dit désormais « except `s00`, a documented deviation covered by
      the id rule above » — **D-07 corrigé**.
- [x] **Aucun recouvrement.** s38 dépend bien de s04b (story **et** récapitulatif) et son critère 4
      nomme « entrées de menu et pied de page (s04b) ». Dépendances recomptées à la main : exactement 25. **D-02 corrigé.**

## Vérification des neuf prédicats de s00 contre le dépôt

| #   | Prédicat                               | Valeur annoncée                                             | Mesuré                                                              | Verdict                                                                                                                                    |
| --- | -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | tokens §1.1 dans `globals.css`         | `--radius: 0.625rem`, aucun `warning`, pas d'`--accent-hue` | ligne 60 `--radius: 0.625rem` ; zéro `warning` ; zéro `accent-hue`  | ✅ exact                                                                                                                                   |
| 2   | `grep -rl 'dark:' src/`                | 34                                                          | **34 fichiers**                                                     | ✅ exact                                                                                                                                   |
| 3   | `.dark` / `@custom-variant dark`       | 4 lignes                                                    | lignes 5, 73, 187, 188 = **4**                                      | ✅ exact                                                                                                                                   |
| 4   | `theme-toggle`                         | 3 fichiers l'importent                                      | `page.tsx:12`, `(public)/layout.tsx:8`, `docs-menu-header.tsx:8`    | ✅ exact — **D-01 réellement clos** : le prédicat capture les cinq sites, là où l'ancienne liste en nommait deux faux et en omettait trois |
| 5   | `grep -rl 'next-themes' src/`          | 8, dont `user-preferences-sync.tsx`                         | **8 fichiers** ; l'enum `theme_type` existe (`user-model.ts:15,31`) | ✅ exact                                                                                                                                   |
| 6   | polices `next/font`                    | absent de `src/`                                            | **zéro occurrence**                                                 | ✅ exact                                                                                                                                   |
| 7   | `git diff --stat src/lib/emails/` vide | « le mode sombre des gabarits est intact »                  | 15 fichiers, **zéro occurrence de `dark`**                          | ❌ **E-01**                                                                                                                                |
| 8   | quatre mesures §2.1                    | 48/48-56/56/17-18 px                                        | conformes ; mais le 3:1 du contour est en **§1.4**, pas §1.5        | ⚠️ **E-04**                                                                                                                                |
| 9   | `check:rules` + grep `.claude/rules/`  | —                                                           | 2 fichiers matchent ; `scripts/check-rules.ts` existe               | ✅ décidable et pertinent                                                                                                                  |

## Findings

**E-01 — major — s00 critère 7 : la commande ne peut pas échouer, et sa prémisse est fausse contre le dépôt.**
Deux défauts dans le même critère. (a) `git diff --stat src/lib/emails/` compare l'arbre de travail à
HEAD : une fois le commit unique de la story posé (`AGENTS.md` : « one commit per story »), il est vide
**quoi qu'il soit arrivé à ce dossier**. Le seul diff qui juge une story est
`git diff <default-branch>...feature/<id>` — `AGENTS.md` le dit noir sur blanc. Au moment où la
vérification compte, à `/ks-review`, le prédicat passe vacuellement. (b) Sa justification écrite — « le
mode sombre des gabarits d'email est **intact** » — présuppose un mode sombre existant :
`src/lib/emails/` compte 15 fichiers et **zéro occurrence de `dark`**, casse ignorée. Le §5.2 ne décrit
pas un existant à préserver, il **spécifie** le comportement des futurs gabarits ASL-CMS sous mode
sombre forcé, et son §5.3 renvoie à `src/lib/emails/theme.ts`, qui n'existe pas. Le seul critère conçu
comme garde-fou ne protège donc rien qui existe et ne peut pas tomber. C'est exactement la classe de
défaut de D-01 — une affirmation sur le dépôt, fausse contre le dépôt — réapparue à la coordonnée que
la réécriture n'a pas re-mesurée. Correction : écrire la forme story-diff
(`git diff main...feature/s00 --stat -- src/lib/emails/`) et remplacer la justification par ce qui est
vrai — « ce dossier est hors périmètre de s00, son habillage appartient à s25 ».

**E-02 — major — s00 : la moitié de la machinerie de thème échappe aux neuf prédicats, dans la story qui interdit de « toucher au thème sombre à moitié ».**
`src/proxy.ts` porte un bloc de détection de thème complet : lecture du cookie `theme` (ligne 75),
repli iOS sur `sec-ch-prefers-color-scheme` avec `theme = 'dark'` (83-91), pose de l'en-tête `x-theme`
« pour Shiki » (99), et **écriture forcée d'un cookie `theme` d'un an** (127-131). Aucun des neuf
prédicats ne l'atteint : il ne contient pas `dark:` (hors c2), n'importe pas `next-themes` (hors c5),
n'est ni `globals.css` (c3) ni `theme-toggle` (c4), et c9 ne balaie que `.claude/rules/`. Conséquence
prise à la lettre : les neuf commandes passent toutes alors que le produit continue de renifler la
préférence système de chaque visiteur et de lui poser un cookie `theme` pour un système de thèmes qui
n'existe plus. Le prédicat c9 **supprime la documentation du mécanisme sans supprimer le mécanisme** —
et la règle est déjà périmée sur ce point : `docs/[...slug]/page.tsx` ne porte ni `instant = false` ni
`x-theme` (les quatre restants sont `checkout/[priceId]`, `checkout/better-auth` et `admin/layout.tsx`).
L'en-tête `x-theme` est produit et jamais consommé. C'est précisément le « rendu mixte, pire que l'état
de départ » que la note ⚠️ de la story dit vouloir éviter, et ça invalide la promesse de l'en-tête.
Un dixième prédicat suffit : `grep -rn 'theme' src/proxy.ts` ne retourne aucune ligne (aujourd'hui : 8).

**E-03 — minor — s00 : l'en-tête surqualifie ses propres critères.**
« Son sujet est étroit : **le CSS** […] Rien d'autre » et « **Chaque** critère ci-dessous est une
commande ». Ni l'un ni l'autre n'est vrai du corps : le critère 7 porte sur un diff, le 8 sur des
mesures « vérifiables à l'écran », le 9 sur des fichiers de règles — trois sujets qui ne sont pas du
CSS ; et les critères 1, 6 et 8 ne sont pas des commandes. Ils restent décidables, ce qui est
l'essentiel, mais l'en-tête promet une propriété uniforme que le corps ne tient pas — et c'est cette
promesse qui a servi à retirer les énumérations.

**E-04 — minor — s00 critère 8 : renvoi de section faux, et la borne du critère a disparu avec la réécriture.**
Le critère cite « contour de champ au contraste 3:1 du **§1.5** » : le §1.5 traite focus, cibles et
mouvement ; le 3:1 du contour de champ est en **§1.4**. Par ailleurs, l'ancienne version bornait
explicitement le §2.1 à quatre mesures « avec exclusion motivée du reste » (C-02) ; cette exclusion a
sauté. Or le §2.1 compte onze lignes de conventions, et la règle transverse « Socle habillé » affirme
toujours que ces choix « sont faits une fois, **en s00** ». Le critère 8 ne couvre plus que quatre
d'entre elles : la frontière entre s00 et les stories d'écran est redevenue implicite.

**E-05 — minor — s00 : la note renvoie à une règle transverse qui n'existe pas.**
« c'est une **règle transverse** (voir « Règles transverses » et `AGENTS.md`) ». La section « Règles
transverses à toutes les stories » compte dix règles et **aucune** ne porte le « design system gap ».
Seul `AGENTS.md` le fait. L'argument qui a servi à retirer le critère de gaps s'appuie donc sur un
renvoi à moitié faux : soit ajouter la règle à la section, soit ne citer qu'`AGENTS.md`.

**E-06 — minor — s04b : la correction de D-04 a périmé une citation du PRD dans la story.**
La note « L'en-tête, précisément » commence par « Le PRD nomme trois choses éditables — « menu,
en-tête, pied de page » ». Le PRD ne les nomme plus : sa ligne s'intitule « Navigation du site public
(**menu et pied de page** éditables) ». La note continue d'argumenter contre une formulation
supprimée, ce qui donnera à un agent l'impression d'un écart déclaré là où il n'y a plus d'écart.

**E-07 — minor — s19 critère 4 : D-06 n'est appliqué qu'à moitié.**
La référence en avant a bien rejoint les notes ✅. Mais le critère conserve « le prédicat qui en
découle est le **seul** point du produit qui tranche « impayé » » : une propriété portant sur
l'ensemble du produit, invérifiable par un test de s19. La première moitié donne un test ; la seconde
appartient aux notes, où le paragraphe qui la porte existe déjà. Côté s38, le critère 8 est en revanche
proprement corrigé ✅.

**E-08 — minor — s38 : les comptes tenus à la main dans les notes restent faux.**
« Les trois modules retirés ramenaient la story de **vingt-six** dépendances à **vingt-quatre** » :
26 − 3 = 23. La série cohérente est 27 → 24 → 25. Et « **sept** familles de contenu » (répété au
récapitulatif) : les critères en énumèrent six — membres, contenus publiés, documents, communications,
échanges entrants, configuration. Le chiffre qui compte est juste : 25 dépendances recomptées, les
trois occurrences de « vingt-cinq » sont exactes. Défaut mineur mais symptomatique, dans la story qui
écrit elle-même « une énumération écrite à la main finit toujours par oublier un type de donnée ».

## Ce que je ne retiens pas comme défaut

- **La réécriture de s00 est un vrai progrès, mesurable.** Les prédicats 2, 4 et 5 capturent
  strictement plus de surface que l'ancienne énumération : c4 attrape les trois imports réels de
  `theme-toggle` que la liste manuelle ratait (le cœur de D-01), et c5 attrape huit fichiers dont
  `sonner.tsx`, `vapour-text-effect.tsx` et `theme.test.tsx` qu'aucune liste écrite à la main n'aurait
  nommés. Les six valeurs mesurables sont **toutes exactes**. Le renoncement à l'énumération est le bon
  arbitrage.
- **La conservation de la mise à jour des règles dans le critère 9 est justifiée, et le raisonnement
  tient — mieux que ne le dit la story.** Vérification faite : `x-theme` n'est **pas** dans
  `docs/architecture.md` (zéro occurrence) ; l'opt-out motivé par la lecture du thème vit dans
  `rule-react-cache-next-cache.md:163`, et l'exigence « en clair et en sombre » dans
  `rule-mdx-rendering.md:54` — les deux exactement dans le périmètre du grep du critère 9. Le §10.3 du
  design system, qui attribue ce point à `docs/architecture.md`, est faux ; s00 a raison contre lui.
  Adjoindre `pnpm check:rules` est de surcroît le bon garde-fou. Rien à déplacer, pas d'orphelin
  recréé. (Défaut à corriger, mais dans `docs/design-system.md`, pas ici.)
- **Ce que la réécriture a laissé tomber ne crée pas de trou de périmètre.** Les « 52 reprises », les
  « 65 pages » et les « six écrans de référence » ont disparu ; aucune ligne du PRD n'en dépendait, et
  l'effet est obtenu par ricochet (les écrans consomment `bg-background`/`text-foreground`, et le
  critère 2 les traverse tous). Le seul reliquat réel est celui d'E-02.
- **s00 à 3 est défendable** malgré 34 fichiers `dark:` + 8 fichiers `next-themes` + les tokens et les
  polices : le travail est mécanique et outillé par ses propres commandes, comme l'argument de C-06
  pour s01.
- **Les frontières inter-stories restent le point fort du découpage** : prédicat « impayé » possédé par
  s19 ; modèle de catégories possédé par s10, prouvé par s23 ; exclusion des désinscrits en s25 puis
  réintégration statutaire en s27 ; s38/s39/s40 ; s14/s37/s41 ; s15/s42 ; s12/s16. Les cinq réserves
  externes, le placement de la GED avant le vote et la non-dépendance de s29 à Pennylane sont
  inchangés et toujours solides.

## Verdict

Le périmètre est intégralement couvert, le cimetière est étanche, l'ordre est exécutable et les ids
sont sains : **aucun critical**. Sur les sept constats du douzième passage, cinq sont réellement
corrigés (D-02, D-03, D-04, D-05, D-07), un l'est à moitié (D-06 : s38 oui, s19 non — E-07), et D-01
est clos dans sa forme — la réécriture de s00 supprime la classe de défaut plutôt que la seule
occurrence, et ses six valeurs mesurables sont exactes. Mais la réécriture reproduit le schéma du
passage précédent à une nouvelle coordonnée : **les deux endroits de s00 qui n'ont pas été re-mesurés
contre le dépôt sont les deux qui échouent** — un critère qui ne peut pas tomber et dont la prémisse
est fausse (E-01), et un pan entier du sujet de la story qui passe entre les neuf commandes (E-02).
Les deux se corrigent par édition de `docs/stories.md` seul : réparer la commande et la justification
du critère 7, ajouter un prédicat sur `src/proxy.ts`.

Max severity: major
Stories ready: no
