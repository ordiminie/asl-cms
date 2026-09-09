# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Douzième passage** — 44 stories (s00–s42, s04b inclus). Les onze constats C-01 à C-11 du onzième
> passage ont été re-vérifiés un à un contre le texte actuel, sans présomption de correction. Les
> affirmations chiffrées de s00 ont en outre été **confrontées au dépôt réel** — ce que les passages
> précédents n'avaient pas fait.

## Perimeter coverage

**Tronc commun — livré à toute association**

| PRD feature (core loop)                                                 | Couvert par                                 | OK ?                        |
| ----------------------------------------------------------------------- | ------------------------------------------- | --------------------------- |
| CMS de pages génériques (créer / modifier / publier / dépublier)        | s04 (9 critères)                            | ✅                          |
| Attribution des rôles aux membres (+ verrou anti-blocage)               | s14 (critère 3 = verrou)                    | ✅                          |
| Permissions par rôle configurables en back-office                       | s37                                         | ✅                          |
| Connexion par lien magique (4 h) + flux d'invitation + suivi d'adoption | s03, s15, s42                               | ✅                          |
| Pages publiques + formulaire de contact archivé en BO                   | s08 (+ s04)                                 | ✅                          |
| **Navigation du site public (menu, en-tête, pied de page éditables)**   | **s04b**                                    | ⚠️ partiel — en-tête (D-04) |
| Identité visuelle par association (logo, teinte, favicon)               | s02 (critères 6-10), en-tête d'email s25 c3 | ✅                          |
| Limitation de débit des formulaires publics                             | s08 (c5, c6), réutilisé s10 (c9)            | ✅                          |
| Actualités de l'association (mini-blog daté)                            | s05                                         | ✅                          |
| Présentation du bureau (fiches listables)                               | s06                                         | ✅                          |
| Désinscription et classification des communications                     | s25 (effet), s27 (nature)                   | ✅                          |
| Bandeau d'alerte global                                                 | s07                                         | ✅                          |
| SEO (sitemap, métadonnées, Search Console)                              | s11                                         | ✅                          |
| Import initial des membres                                              | s13                                         | ✅                          |
| Modèle membre ↔ parcelle daté                                           | s12                                         | ✅                          |
| Coordonnées (profil membre)                                             | s16 (+ s12 côté bureau)                     | ✅                          |
| Questions au bureau, catégories avec routage email                      | s23 (modèle : s10)                          | ✅                          |
| Notes internes et historique par membre                                 | s24                                         | ✅                          |
| Import annuel des relevés d'eau + rapport par email                     | s17                                         | ✅                          |
| Historique de consommation d'eau                                        | s18                                         | ✅                          |
| Signalements avec catégories et statuts                                 | s10 (public), s22 (membre)                  | ✅                          |
| Publication des analyses d'eau                                          | s09                                         | ✅                          |
| Documents partagés                                                      | s31                                         | ✅                          |
| Documents nominatifs physiquement séparés                               | s32                                         | ✅                          |
| Campagnes email Brevo (4 modèles + libre, gabarit commun)               | s25                                         | ✅                          |
| Envoi échelonné > 300 + budget quotidien                                | s26                                         | ✅                          |
| Relances d'impayés (3, à 3/2/1 semaines), activables                    | s29                                         | ✅                          |
| Publipostage PDF (membres sans email)                                   | s28                                         | ✅                          |
| Groupes de destinataires personnalisés                                  | s27                                         | ✅                          |
| Statistiques d'ouverture et de clic                                     | s30                                         | ✅                          |
| Modèles de documents réutilisables (unitaire **et** en lot)             | s36 (c3)                                    | ✅                          |
| Facturation membres : interface + Pennylane                             | s19 (interface + manuel), s20               | ✅                          |
| Redirection de paiement                                                 | s21                                         | ✅                          |
| Multi-tenant (Organization, config, RLS)                                | s01 (+ s02)                                 | ✅                          |
| Export individuel d'un membre (droit d'accès)                           | s40                                         | ✅                          |
| Simulation de rôle SuperAdmin                                           | s41                                         | ✅                          |
| Export et portabilité des données                                       | s38 (+ s39)                                 | ⚠️ voir D-02                |

**Modules activables** — Vote : s33 ✅ · Voirie : s34 ✅ · Petites annonces : s35 ✅

- [x] Toute ligne du tableau « Replicated (core loop) » est délivrée par au moins une story.
      **Aucune ligne orpheline, donc aucun critical de couverture.** La ligne Navigation, absorbée
      par s04 au onzième passage, a désormais sa story dédiée (s04b) ; il lui manque l'en-tête, écart
      déclaré (D-04).

## Scope

- [x] Aucune story ne réintroduit un item du cimetière. Re-vérifié un à un : électricité/gaz
      (absent), logique de vote (s33 l'exclut nommément), traitement des paiements (s21 c3 teste
      formulaire **et** schéma ; s20 c7 teste les appels sortants), messagerie privée entre membres
      (s35 l'exclut ; s23 est membre → bureau), multi-immeubles/tantièmes (absent, s19 le rappelle),
      plan B de connexion sans email (s42 l'interdit dans le courrier ; s12 « renseigner un email
      ouvre un compte » est l'entrée nominale, pas un contournement), appels de fonds (absent), carte
      interactive (s34 : image statique), vote temps réel / procurations / émargement (absent),
      assistant IA (absent, retiré par s01), classification IA des documents (s32 l'exclut), Kanban
      (absent, retiré par s01), messagerie à adresse dédiée (absent), une base par tenant (s01
      l'exclut), abstraction « ressource partagée » (s34 l'exclut), WordPress (ADR 001).
- [x] **s04b n'élargit pas le périmètre** : elle borne explicitement à une profondeur de menu, exclut
      le menu par rôle et la navigation conditionnelle, et renvoie l'en-tête éditable à `/ks-prd` au
      lieu de se le donner.
- [ ] Aucune story ne dépasse le périmètre — échoue toujours sur s00 et s39, hors tableau de
      périmètre, les deux cas étant désormais assumés par écrit et symétriquement (C-07/C-08 corrigés
      dans la forme, pas dans la nature).

## Story quality

- [ ] **Tranche livrable de bout en bout, pas une couche technique** — échoue sur s00 et s39
      (déviations assumées). Les 42 autres sont des tranches réelles. **s04b en est une** : elle sert
      le visiteur (« trouver le site sans connaître les URL »), s'exécute après s04 et ne laisse aucun
      état intermédiaire cassé — le site conserve d'ici là l'en-tête/pied de page du socle habillé par
      s00.
- [ ] **Chaque critère peut devenir un test** — les trois critères non bornés de s00 sont réellement
      bornés (C-02 corrigé, et vérifié contre le dépôt), le critère 4 de s38 n'énumère plus les
      modules activables (C-03 corrigé), les sept critères de s04b sont tous testables. Échoue
      résiduellement sur deux clauses non testables logées dans des critères par ailleurs testables
      (D-06).
- [x] Notes agentiques présentes partout, y compris sur s04b (piège de l'invalidation croisée de
      `cacheTag`, nommé comme « le seul vrai risque de la story »).
- [x] **Complexité chiffrée ; aucune 5 ; chaque 4 énonce son risque.** Recompté ligne à ligne :
      3 × 1, 18 × 2, 15 × 3, 8 × 4 = 44, conforme à l'annonce. s04 porte enfin sa ligne « Risque
      (complexité 4) » — **C-04 corrigé**, et l'affirmation du récapitulatif (« les huit portent
      chacune leur risque explicité ») est désormais vraie pour les huit.

## The list as a whole

- [x] **Aucun cycle, aucune référence en avant** : les 44 lignes du récapitulatif re-parcourues ;
      toute dépendance pointe vers un id antérieur, s04b → s04 et s34 → s04b compris.
- [x] **Ordre exécutable, y compris pour un ordonnanceur qui ne lit que le tableau** : s01 dépend de
      s00 dans la story **et** dans le récapitulatif, et toute story remonte à s01 par ses propres
      arêtes (vérifié sur les têtes de graphe s37, s39, s40, s16, s18, s24, s30). s00 est donc un
      prédécesseur global par le graphe, plus seulement par la prose. **C-09 corrigé.**
- [x] **Ids bien formés, uniques, stables.** `s04b` est explicitement autorisé par `AGENTS.md`
      ligne 70, et l'amendement est **cohérent** : il restreint le suffixe au cas où l'id doit porter
      l'ordre d'exécution, préfère par défaut l'ajout en fin de numérotation, et documente honnêtement
      son coût (`/ks-plan s04` devient ambigu, l'agent liste et s'arrête — comportement conforme à la
      ligne 73). Réserve de forme en D-07.
- [ ] **Aucun recouvrement** — la frontière s04/s04b est nette et sans reliquat (grep exhaustif
      « menu / pied de page / navigation » : plus aucune trace de navigation dans s04, hors la note qui
      la renvoie à s04b). Échoue en sens inverse : le produit d'un contenu neuf par s04b n'a pas été
      répercuté sur s38 (D-02).

## Re-vérification des onze constats du onzième passage

| #         | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01      | **Corrigé, et pas seulement déplacé.** s04 tombe de 13 à 9 critères, une seule ligne de périmètre, complexité 4 assumée avec risque écrit. s04b porte 7 critères testables, est livrable seule, et a sa propre valeur utilisateur. Aucune référence orpheline ne subsiste. Conséquence non traitée : D-02.                                                                                                                                                                                                                                                                                     |
| C-02      | **Corrigé, et vérifié contre le dépôt.** 65 pages sous `src/app/[locale]/` (comptées : 65), 13 pages ADR-009 (énumérées : 13, toutes existantes), 52 reprises ✅ ; 37 composants dans `src/components/ui/` ✅ ; 31 fichiers `dark:` = 34 trouvés − 3 exclus nommément ✅ ; les six écrans de référence existent tous et couvrent bien les quatre groupes de routes ✅ ; `(public)/pricing_old` existe bien ✅. Le §2.1 est réduit à quatre mesures avec exclusion motivée du reste, et la déclaration §10 rend le critère de gaps décidable. **Un seul chiffre de s00 ne résiste pas : D-01.** |
| C-03      | **Corrigé.** Le critère 4 de s38 n'énumère plus voirie ni annonces ; il déclare l'exclusion des trois modules et renvoie au mécanisme du critère 8 + s39. Cohérent avec les notes.                                                                                                                                                                                                                                                                                                                                                                                                             |
| C-04      | **Corrigé** (s04 porte sa ligne de risque).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| C-05      | **Corrigé à moitié, l'autre moitié assumée.** La visibilité propre d'une entrée est un vrai critère neuf et testable (s04b c6) ✅. L'en-tête reste non livré, déclaré écart conscient avec propriétaire nommé — voir D-04.                                                                                                                                                                                                                                                                                                                                                                     |
| C-06      | **Corrigé sur la forme demandée** : la justification écrite distingue volume mécanique et outillé (s01) de risque conceptuel (s02, s04), et prévoit la sortie (« si `/ks-architect` conclut autrement, le retrait se sort en story propre »). Argument recevable.                                                                                                                                                                                                                                                                                                                              |
| C-07/C-08 | **Corrigés.** s00 est reformulée en dérogation consciente et n'affirme plus être seule de son espèce ; s39 porte le même bandeau. Le récapitulatif dit « deux stories transverses sur quarante-quatre ».                                                                                                                                                                                                                                                                                                                                                                                       |
| C-09      | **Corrigé** (arête s01 → s00 dans la story et dans le tableau).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| C-10      | **Corrigé** : propriétaire unique `/ks-prd`, `/ks-design` explicitement rétrogradé à la mise en forme.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C-11      | **Corrigé sur les quatre points** : « vingt-quatre dépendances » (recomptées : 24 exactement) ; plus aucun id de story dans `docs/prd.md` (grep `\bs\d{2}\b` : zéro occurrence) ; la ligne Identité visuelle dit désormais « une seule variable » + « deux fichiers », ce qui est exact ; la dérogation d'id est passée de « signalée » à « autorisée par `AGENTS.md` ».                                                                                                                                                                                                                       |

## Findings

**D-01 — major — s00 critère 4 : l'énumération des bascules de thème est fausse, et elle contredit sa propre clause de sortie.**
Le critère écrit : « `src/components/theme-toggle.tsx` et ses points d'appel dans `nav-user.tsx` et
`nav-user-admin.tsx` ». Vérifié dans le dépôt : `ModeToggle` de `@/components/theme-toggle` est
importé dans **trois fichiers non nommés** —

- `src/app/[locale]/(public)/layout.tsx:8`
- `src/app/[locale]/page.tsx:12`
- `src/components/features/docs/docs-menu-header.tsx:8`

— tandis que les deux fichiers nommés (`src/components/features/layouts/sidebar/nav-user.tsx`,
`nav-user-admin.tsx`) ne l'appellent pas : ce sont des bascules **en ligne** via `useTheme`/`setTheme`.
L'énumération est donc à la fois inexacte sur deux entrées et incomplète sur trois. C'est un défaut de
fond, pas de rédaction, parce que l'en-tête de s00 fait de l'énumération la définition même du
périmètre : « rien au-delà n'appartient à cette story ». Prise à la lettre, s00 supprime
`theme-toggle.tsx` en laissant trois imports pendants (build cassé), ou laisse une bascule de thème
sur **la page d'accueil et le layout public** — les deux écrans les plus visibles du socle — alors que
la seconde moitié du même critère affirme « Aucun écran ne propose plus de choisir un thème ». Un
critère ne peut pas énumérer trois fichiers et exiger un résultat qui en demande cinq. C'est
exactement la classe de défaut que C-02 devait fermer, à un endroit que C-02 n'avait pas regardé.
Correction : porter la liste à cinq sites réels (les trois imports ci-dessus + les deux bascules en
ligne), en distinguant les deux mécanismes.

**D-02 — major — s38 : la scission de s04 a créé un contenu de tronc commun que l'export n'énumère pas et dont il ne dépend pas.**
s04b introduit ses propres tables scopées : entrées de menu et contenu de pied de page. Or (a) le
critère 4 de s38 prétend énumérer « les **contenus publiés du tronc commun** : pages, actualités,
fiches du bureau, analyses d'eau, bandeau d'alerte » — le menu et le pied de page n'y sont pas ;
(b) le critère 9 (configuration) ne couvre que « paramètres du tenant et matrice de permissions », ce
que le menu n'est pas (ce sont des lignes de table, pas des `organization_setting`) ; (c) la liste de
dépendances de s38, présentée comme longue « parce que c'est le sens de la story », contient s04, s05,
s06, s07, s08, s09, s10 — tous les producteurs de contenu du bloc A — mais **pas s04b**. C'est le
défaut C-03 réapparu à une nouvelle coordonnée, produit par la correction de C-01 : une énumération
écrite à la main a perdu un type de donnée, dans la story qui écrit elle-même « une énumération écrite
à la main finit toujours par oublier un type de donnée ». Le mécanisme du critère 8 et le garde-fou de
s39 rattraperaient la donnée à l'exécution — c'est ce qui empêche de classer ceci critical — mais un
agent qui code s38 depuis ses critères produit une archive sans le menu, et le défaut n'apparaît qu'une
story plus tard. Correction en deux traits : ajouter s04b à la liste de dépendances et nommer menu +
pied de page au critère 4 (ou déclarer explicitement, comme pour les modules, qu'ils entrent par le
critère 8).

**D-03 — minor — s04b : les critères 2 et 6 se lisent comme contradictoires.**
Le critère 6 pose une visibilité d'entrée « **indépendante** de l'état de publication de sa page
cible », quand le critère 2 impose qu'une entrée pointant vers une page dépubliée ne s'affiche pas.
Les deux se composent bien si l'on comprend « indépendante » comme _attribut stocké séparément_
(règle de rendu = entrée visible **et** page publiée), et la clause démonstrative du critère 6 va dans
ce sens. Mais lu comme une règle de rendu, « indépendante » dit l'inverse du critère 2, et rien dans la
story ne tranche le cas (entrée visible, page dépubliée) autrement qu'au critère 2. Un mot suffit :
« indépendante **de son réglage**, l'entrée restant masquée si sa page cesse d'être publiée ».

**D-04 — minor — couverture : « en-tête éditable » n'est livré par aucune story, l'écart est déclaré mais le PRD dit toujours le contraire.**
s04b argumente correctement : le PRD ne définit nulle part ce que serait un en-tête éditable au-delà du
logo et de la teinte (tous deux livrés par s02), et élargir relèverait de `/ks-prd`. Je ne relitige pas
l'arbitrage. Mais tant que la ligne du tableau de périmètre s'intitule « menu, en-tête, pied de page
**éditables** » et qu'aucune story ne livre le troisième terme, la ligne reste servie à la lettre près.
C'est le même statut que C-07/C-08 : assumé, pas corrigé. La clôture propre est une édition d'un mot
dans `docs/prd.md`, pas une story de plus.

**D-05 — minor — le récapitulatif ne compte pas s04b parmi les stories nées en revue.**
« Six stories ont été ajoutées en revue du découpage : s14, s15, s39, s40, s41 et s42 » — elles sont
sept depuis ce passage, s04b étant la plus récente et la seule à porter un id intercalé. La traçabilité
du découpage vit dans ce paragraphe ; le laisser à six rend la genèse de s04b invisible pour qui lit le
récapitulatif seul (elle n'est expliquée que dans l'en-tête de la story).

**D-06 — minor — deux critères logent une clause non testable à côté d'une clause testable.**
s38 critère 8 : « … propriété que le test de complétude de s39 vérifie mécaniquement, et **qui n'est
donc pas testable ici** » — une acceptance criterion qui déclare elle-même son intestabilité. s19
critère 4 : « … le prédicat qui en découle est le **seul point du produit qui tranche**, et il est
consommé tel quel par s21, s27 et s29 » — propriété portant sur des stories futures, invérifiable en
s19. Les deux critères restent exploitables (leur première moitié donne un test), et le découpage est
par ailleurs exemplaire sur ce point, isolant partout ailleurs ce qui est « à vérifier en review, pas
en test ». Ces deux-là devraient rejoindre les notes agentiques par cohérence.

**D-07 — minor — `AGENTS.md` : l'amendement est cohérent, mais une ligne plus bas le contredit encore.**
La ligne 70 autorise le suffixe lettre, en borne l'usage, en documente le coût sur le résolveur flou et
grand-père `s00`. Bonne rédaction. La ligne 107 affirme toujours sans nuance « Our own story ids start
at `s01` in docs/stories.md », ce que `s00` dément et que seule la ligne 70 réconcilie, trente-sept
lignes plus haut. Un renvoi ou une incise suffit.

## Ce que je ne retiens pas comme défaut

- **La scission C-01 est une vraie scission, pas un déplacement.** J'ai cherché le contraire : s04 ne
  conserve qu'une ligne de périmètre, ses neuf critères couvrent le CRUD éditorial et le modèle ADR 007
  (indissociables — une page _est_ une liste de blocs), son 4 est motivé et son risque écrit ; s04b a
  une valeur utilisateur propre, une dépendance unique, sept critères testables et un piège technique
  nommé. Aucune référence croisée périmée ne subsiste dans les deux sens.
- **Le chiffrage de s04b à 2 est discutable mais pas fautif.** L'invalidation croisée de deux
  `cacheTag`, dont la moitié se pose dans le code de s04, est le genre de travail qui se paie plus
  qu'un CRUD de menu ; un 3 se défendrait. La règle du découpage ne contraint que les 5 (à scinder) et
  les 4 (risque à écrire) : ce n'est pas un constat, c'est un point à surveiller en `/ks-plan`.
- **Le chiffrage de s00 est exact partout où j'ai pu le vérifier mécaniquement** (65 pages, 13
  exclusions, 52 reprises, 37 composants, 31 fichiers `dark:`, six écrans de référence réels,
  `pricing_old` réel). C'est inhabituel et cela rend la dérogation C-07 tenable.
- **Les frontières inter-stories restent le point fort du découpage** : prédicat « impayé » possédé par
  s19 et consommé sans réinterprétation par s21/s27/s29 ; modèle de catégories possédé par s10 et
  prouvé par s23 ; exclusion totale des désinscrits en s25 puis réintégration statutaire en s27 ;
  s38/s39/s40 ; s14/s37/s41 ; s15/s42 ; s12/s16.
- **La « ligne de menu morte » d'un module désactivé**, exigée par le PRD sous la ligne Navigation, a
  bien un propriétaire testable : s34 critère 4, et s04b l'y renvoie explicitement.
- Le placement de la GED avant le vote, les cinq réserves externes tabulées avec leur contournement, et
  l'argumentaire de s29 sur sa non-dépendance à Pennylane : inchangés et toujours solides.

## Verdict

Le périmètre est intégralement couvert, le cimetière est étanche, l'ordre est exécutable et le graphe
est enfin complet : **aucun critical**. Sur les onze constats du onzième passage, neuf sont réellement
corrigés, un l'est à moitié avec écart déclaré (C-05 : la visibilité oui, l'en-tête non) et deux sont
des dérogations assumées désormais énoncées symétriquement. La correction de C-01 est bonne — mais elle
reproduit le schéma du passage précédent : en créant une story, elle a créé un contenu que l'export ne
connaît pas (D-02), comme la correction de F-06 avait créé la surcharge de s04. Et la vérification
contre le dépôt, que les passages précédents n'avaient pas faite sur ce point, met au jour une
énumération fausse dans la story dont l'énumération _est_ le contrat (D-01). Les deux majors se
corrigent par édition de `docs/stories.md` seul : compléter la liste des bascules de thème de s00, et
raccrocher s04b à s38.

Max severity: major
Stories ready: no
