# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Onzième passage** — 43 stories (s00–s42). Les constats F-01 à F-15 du dixième passage ont été
> **re-vérifiés un à un contre le texte actuel**, sans présomption de correction. Verdict re-dérivé
> de bout en bout.

## Perimeter coverage

**Tronc commun — livré à toute association**

| PRD feature (core loop)                                                 | Couvert par                         | OK ?                         |
| ----------------------------------------------------------------------- | ----------------------------------- | ---------------------------- |
| CMS de pages génériques (créer / modifier / publier / dépublier)        | s04                                 | ✅ (réserve : C-01)          |
| Attribution des rôles aux membres (+ verrou anti-blocage)               | s14 (critère 3 = verrou)            | ✅                           |
| Permissions par rôle configurables en back-office                       | s37                                 | ✅                           |
| Connexion par lien magique (4 h) + flux d'invitation + suivi d'adoption | s03, s15, s42                       | ✅                           |
| Pages publiques + formulaire de contact archivé en BO                   | s08 (+ s04)                         | ✅                           |
| **Navigation du site public (menu, en-tête, pied de page éditables)**   | s04 (menu, pied), s02 (logo/teinte) | ⚠️ partiel (C-05)            |
| **Identité visuelle par association (logo, teinte, favicon)**           | s02 (critères 6 à 10)               | ✅                           |
| Limitation de débit des formulaires publics                             | s08, réutilisé par s10              | ✅                           |
| Actualités (mini-blog daté)                                             | s05                                 | ✅                           |
| Présentation du bureau (fiches listables)                               | s06                                 | ✅                           |
| Désinscription et classification des communications                     | s25 (effet), s27 (nature)           | ✅                           |
| Bandeau d'alerte global                                                 | s07                                 | ✅ (arbitrage ouvert : C-10) |
| SEO (sitemap, métadonnées, Search Console)                              | s11                                 | ✅                           |
| Import initial des membres                                              | s13                                 | ✅                           |
| Modèle membre ↔ parcelle daté                                           | s12                                 | ✅                           |
| Coordonnées (profil membre)                                             | s16 (+ s12 côté bureau)             | ✅                           |
| Questions au bureau, catégories avec routage email                      | s23 (modèle : s10)                  | ✅                           |
| Notes internes et historique par membre                                 | s24                                 | ✅                           |
| Import annuel des relevés d'eau + rapport par email                     | s17                                 | ✅                           |
| Historique de consommation d'eau                                        | s18                                 | ✅                           |
| Signalements avec catégories et statuts                                 | s10 (public), s22 (membre)          | ✅                           |
| Publication des analyses d'eau                                          | s09                                 | ✅                           |
| Documents partagés                                                      | s31                                 | ✅                           |
| Documents nominatifs physiquement séparés                               | s32                                 | ✅                           |
| Campagnes email Brevo (4 modèles + libre, gabarit commun)               | s25 (logo : s02)                    | ✅                           |
| Envoi échelonné > 300 + budget quotidien                                | s26                                 | ✅                           |
| Relances d'impayés (3, à 3/2/1 semaines), activables                    | s29                                 | ✅                           |
| Publipostage PDF (membres sans email)                                   | s28                                 | ✅                           |
| Groupes de destinataires personnalisés                                  | s27                                 | ✅                           |
| Statistiques d'ouverture et de clic                                     | s30                                 | ✅                           |
| Modèles de documents réutilisables (unitaire **et** en lot)             | s36                                 | ✅                           |
| Facturation membres : interface + Pennylane                             | s19 (interface + manuel), s20       | ✅                           |
| Redirection de paiement                                                 | s21                                 | ✅                           |
| Multi-tenant (Organization, config, RLS)                                | s01, s02                            | ✅                           |
| Export individuel d'un membre (droit d'accès)                           | s40                                 | ✅                           |
| Simulation de rôle SuperAdmin                                           | s41                                 | ✅                           |
| Export et portabilité des données                                       | s38 (+ s39)                         | ✅                           |

**Modules activables** — Vote : s33 ✅ · Voirie : s34 ✅ · Petites annonces : s35 ✅

- [x] Toute ligne du tableau « Replicated (core loop) » est délivrée par au moins une story.
      **Aucune ligne orpheline, donc aucun critical de couverture.** Les deux lignes ajoutées au PRD
      depuis le passage précédent sont bien servies : l'identité visuelle par s02, la navigation par
      s04 — cette dernière incomplètement (C-05).

## Scope

- [x] Aucune story ne réintroduit un item du cimetière. Re-vérifié un à un : électricité/gaz
      (absent), logique de vote (s33 l'exclut nommément), traitement des paiements (s21 réduit au
      lien sortant, avec test sur le schéma **et** sur le formulaire ; s20 critère 7 teste l'absence
      de champ bancaire dans les appels sortants), messagerie privée entre membres (s35 l'exclut ;
      s23 est membre → bureau, pas membre → membre), multi-immeubles/tantièmes (absent), plan B de
      connexion sans email (s42 l'interdit explicitement dans le courrier ; le critère de s12
      « renseigner une adresse email ouvre un compte » n'est pas un contournement mais l'entrée
      nominale), appels de fonds (absent), carte interactive (s34 : image statique), vote temps
      réel / procurations / émargement (absent), assistant IA (absent), classification IA des
      documents (s32 l'exclut), Kanban (absent), messagerie à adresse dédiée (absent), une base par
      tenant (s01 l'exclut), abstraction « ressource partagée » (s34 l'exclut), WordPress (ADR 001).
- [x] Le retrait de `<MeterInput />` du design system §2.2 **ferme un vecteur réel de dépassement de
      périmètre** : plus aucun document n'attribue une saisie manuelle de relevé à s17 ou s18, et les
      règles de validation ont un propriétaire nommé (critère 2 de s17, vérifié : « index en
      régression » y figure bien). F-08 est corrigé au bon endroit.
- [ ] Aucune story ne dépasse le périmètre — échoue sur s00 et s39, toutes deux hors tableau du
      périmètre (C-07 et C-08), les deux cas étant assumés par écrit.

## Story quality

- [ ] **Tranche livrable de bout en bout, pas une couche technique** — échoue sur s00 (déviation
      désormais assumée, C-07) et sur s39 (C-08). Les 41 autres sont des tranches réelles.
- [ ] **Chaque critère peut devenir un test** — remarquable sur l'ensemble (les stories isolent
      systématiquement ce qui est « à vérifier en review, pas en test » hors des critères ; s28 va
      jusqu'à tester les coordonnées du bloc adresse dans le PDF ; s37 critère 3 fait de la suite de
      tests existante son propre critère). Échoue sur trois critères de s00 (C-02) et un critère de
      s38 (C-03).
- [x] Notes agentiques présentes partout, et d'une qualité inhabituelle : pièges de cache, pièges
      d'adaptateur, frontières inter-stories, rappel du cimetière story par story.
- [ ] **Complexité chiffrée ; aucune 5 ; chaque 4 énonce son risque** — la répartition annoncée
      (3 × 1, 17 × 2, 15 × 3, 8 × 4 = 43) est exacte, recomptée. Mais s04 est le seul des huit 4 dont
      les notes agentiques n'énoncent aucun risque (C-04), et son périmètre en fait une candidate 5
      non scindée (C-01).

## The list as a whole

- [x] **Aucun cycle, aucune référence en avant dans les dépendances déclarées** : les 43 lignes du
      récapitulatif ont été re-parcourues une à une ; toute dépendance pointe vers un id strictement
      inférieur. La circularité s03 → s12 → s03 reste résolue par s15.
- [ ] **Ordre exécutable** — un défaut résiduel : le préalable de s00 n'existe que dans la prose des
      règles transverses, pas dans le graphe (C-09).
- [x] Ids bien formés, uniques, stables. Le `00` reste une dérogation à `AGENTS.md`, désormais
      assumée par écrit (C-11).
- [ ] **Aucun recouvrement** — les frontières internes sont explicites et tenues (s12/s16, s08/s10,
      s10/s22/s23/s35, s19/s20, s25/s27, s28/s36, s38/s39/s40, s14/s37/s41, s15/s42, s00/s01 par la
      portée). Échoue sur s04, qui empile deux lignes du périmètre (C-01).

## Findings

**C-01 — major — s04 empile deux lignes du périmètre et le modèle ADR 007 dans une seule story.**
s04 porte aujourd'hui treize critères qui recouvrent trois valeurs distinctes : le CRUD éditorial
d'une page (six critères), le modèle en blocs typés avec réordonnancement accessible et tolérance au
type inconnu (trois critères), et la navigation du site public — menu, entrées orphelines, pied de
page, scoping tenant (quatre critères). Le PRD les chiffre séparément : « CMS de pages génériques » à
3 et « Navigation du site public » à 2. La navigation est livrable seule (le PRD le dit lui-même :
une page publiée hors menu reste atteignable par son URL — donc le CMS ship sans navigation, et la
navigation est un incrément). C'est **une correction de F-06 qui a introduit un nouveau problème** :
le travail orphelin a été rangé dans la story la plus proche au lieu d'obtenir la sienne. Conséquence
sur le chiffrage : s04 absorbe aussi trois des cinq composants du §2.2 (`<PreviewBar />`,
`<SortableList />`, `<BlockPicker />`), Milkdown, @dnd-kit et l'invalidation croisée de deux
`cacheTag`. Le passage 3 → 4 enregistre la croissance sans la traiter ; c'est le profil d'une 5 qui
doit être scindée.

**C-02 — major — s00 : la surface énumérée reste incomplète sur les trois points précis que F-02 nommait.**
La correction est réelle et substantielle — neuf des onze critères sont désormais mécaniquement
vérifiables (fichier `globals.css`, bloc `.dark`, 31 fichiers `dark:`, bascules de thème, exception
email, trois familles de polices, `rule-mdx-rendering.md`, `docs/architecture.md`). Mais trois
critères résistent, et ce sont exactement ceux que F-02 visait :

- « Les cibles et contrastes du §1.5 sont respectés **sur les écrans du socle repris** » — la
  formulation incriminée survit mot pour mot : aucun endroit de la story ne dit quels écrans sont
  repris. Le critère n'a pas de bord, donc pas de test.
- « Les conventions d'usage du §2.1 sont appliquées aux composants de `src/components/ui/` » suivi de
  quatre mesures de hauteur. Le §2.1 compte onze familles et plusieurs dizaines de règles, dont
  certaines ne sont **pas applicables à un composant** mais à la composition d'un écran (« un seul
  bouton `default` par écran », « rien d'important ne passe par un toast », « `tabs` : 4 maximum,
  jamais côté membre », « jamais de défilement infini »). Un critère qui affirme l'application d'un
  corpus dont une partie ne peut pas être satisfaite à ce stade est intestable en tant que tel ;
  seules les quatre mesures le sont.
- « Aucun manque du design system n'est comblé par une valeur inventée […] la liste est à jour en fin
  de story » reste inconditionnellement vrai si aucun manque n'est rencontré.

**C-03 — major — s38 : la correction de F-13 n'a touché que la liste de dépendances ; le critère la contredit.**
Le retrait de s34 et s35 des dépendances **est sound**, et pour la bonne raison : le mécanisme est
déclaré piloté par l'inventaire des tables scopées (critère 8), les trois modules sont désactivables
par tenant, et leurs ids étant inférieurs à 38 l'ordre d'exécution n'en souffre pas. Mais le critère 4
énumère toujours à la main « pages, actualités, fiches du bureau, analyses d'eau, bandeau d'alerte,
**chemins et portails de voirie**, **petites annonces** » — deux des trois modules activables nommés,
le troisième (vote) absent. Le « traitement désormais uniforme » revendiqué par les notes est donc
démenti par les critères, et l'énumération manuelle que la story déclare elle-même fatale (« une
énumération écrite à la main finit toujours par oublier un type de donnée ») subsiste à l'endroit qui
fait foi. Un agent qui exécute s38 en lisant ses critères code la liste en dur et oublie le vote.

**C-04 — minor — s04 : seul 4 dont les notes agentiques n'énoncent pas son risque, et le récapitulatif affirme le contraire.**
s01, s12, s26, s29, s32, s37 et s38 portent toutes une ligne « Risque (complexité 4) : … » explicite.
s04 n'en a aucune : ses pièges (cache du menu, glisser-déposer non obligatoire, adaptateur de
stockage) sont bien décrits, mais jamais rattachés au score. Le récapitulatif écrit pourtant que les
huit « portent chacune leur risque explicité dans leurs notes agentiques » — faux pour s04, dont le
risque n'est formulé que dans le paragraphe de synthèse.

**C-05 — minor — couverture : la ligne « Navigation du site public » n'est servie qu'aux deux tiers.**
Le PRD nomme trois choses éditables (« menu, en-tête, pied de page ») et trois attributs d'entrée
(« ordre des entrées, page cible, visibilité »). s04 livre le menu (ajout, retrait, ordre, page
cible) et le pied de page. L'**en-tête** n'est éditable qu'indirectement, via le logo et la teinte de
s02 — les notes de s04 interdisent même de le recoder — et aucun critère ne donne à une entrée de
menu une **visibilité** propre : elle se déduit de l'état de publication de la page cible. La ligne
est couverte, pas jusqu'à sa lettre.

**C-06 — minor — s01 a absorbé tout le retrait ADR 009 sans réexamen de son 4.**
La correction de F-05 est excellente sur le fond : trois critères mécaniques (tables disparues du
schéma Drizzle, `pnpm knip` sans orphelin, `pnpm check:rules` qui passe) et des notes qui chiffrent
le coût réel (44 fichiers conservés référençant les sous-systèmes, `casl-abilities.ts`, le hook
Stripe de `auth.ts`, `seed.ts` à réécrire, table de chemins de l'ADR 009 incomplète). Mais s01 se
déclarait déjà « la plus large du découpage » **avant** cet ajout, et son score n'a pas bougé, alors
que s02 (2 → 3) et s04 (3 → 4) ont été re-chiffrées quand elles ont grossi. Traitement inégal d'une
même croissance ; à réexaminer avant `/ks-plan`.

**C-07 — minor — s00 : F-01 n'est pas corrigé, il est assumé. C'est recevable, et ce n'est pas la même chose.**
La story déclare noir sur blanc qu'elle est une couche transverse hors tableau du périmètre, seule de
son espèce, et en contrepartie énumère sa surface. La nature du défaut est inchangée : à sa
livraison, aucun écran d'ASL-CMS n'existe et ce qui est rhabillé appartient au boilerplate. Je ne
relitige pas l'arbitrage humain — mais je refuse de le compter comme une correction. Il est
enregistré comme dérogation consciente, bornée à une story, avec un critère de sortie
(partiellement) décidable.

**C-08 — minor — s39 relève de la même catégorie que s00, sans le dire.**
s39 ne livre aucun comportement observable par un utilisateur : c'est un test de non-régression qui
compare l'inventaire des tables scopées à celui des fichiers de l'archive. Sa valeur est réelle et son
critère est excellent (« ajouter une table scopée sans toucher à l'export fait échouer ce test —
vérifié en ajoutant une table de contrôle »), mais c'est un garde-fou, pas une tranche. Il aurait pu
rester un critère de s38. Or s00 est présentée comme « la seule du découpage » dans ce cas —
l'affirmation est fausse.

**C-09 — minor — le préalable de s00 est exprimé, mais pas dans le graphe.**
La règle transverse « Socle habillé » est normative et bien argumentée (« un écran qui redéfinit une
couleur, une taille de cible ou un rayon est un échec de review »), et elle évite effectivement de
répéter la dépendance trente-cinq fois. F-03 est donc adressé sur le fond. Reste que le récapitulatif
— la seule forme lisible par un ordonnanceur — porte toujours « — » en face de s00 et aucune story
n'en dépend. Un outil qui lit le tableau peut légitimement démarrer s04 avant s00. Le préalable tient
par convention d'ordre des ids, pas par le graphe.

**C-10 — minor — s07 : l'arbitrage sur les niveaux d'alerte est bien ouvert dans les deux documents, mais son propriétaire est contradictoire.**
Consigner le désaccord plutôt que le trancher en silence est le bon choix, et les critères n'exercent
bien qu'un seul niveau — la story reste donc testable et conforme au PRD. Mais s07 écrit
simultanément « arbitrage ouvert, **à trancher en `/ks-design`**, pas en `/ks-plan` » et « livrer les
trois serait un élargissement de périmètre, **qui passerait d'abord par `docs/prd.md`** ».
`/ks-design` ne peut pas à la fois décider et ne pas décider. Nommer un seul propriétaire (ici :
`/ks-prd`, puisqu'il s'agit d'un élargissement) lève l'ambiguïté sans rouvrir le débat.

**C-11 — minor — divers, à corriger d'un trait de plume.**

- Le paragraphe de clôture du récapitulatif écrit encore « s38 à 4 contre 3 (**vingt-six**
  dépendances) » alors que la liste et la note de risque de s38 disent vingt-quatre — recomptées :
  vingt-quatre exactement. Correction partielle.
- Les deux nouvelles lignes du PRD citent des ids de story (« s34 s'appuie déjà dessus », « le
  gabarit d'email de s25 exige déjà »). Le PRD est en amont du découpage ; une ligne de périmètre qui
  nomme une story se périme à la première renumérotation et inverse le sens de l'autorité entre les
  deux documents. La justification tient sans les ids.
- La ligne « Identité visuelle » du PRD s'intitule « logo, teinte d'accent, favicon » puis affirme
  que le design system « la réduit à **deux** variables ». Trois éléments, deux variables : s02
  couvre bien les trois, c'est l'énoncé du PRD qui compte mal.
- s00 conserve son id `00` en dérogation à `AGENTS.md`, avec sa justification (renuméroter décalerait
  42 stories). Dérogation acceptée, signalée pour mémoire.

## Ce que je ne retiens pas comme défaut

- **F-04, F-05, F-06 (sur le fond), F-07, F-08, F-09, F-12, F-14, F-15 sont réellement corrigés**, et
  plusieurs le sont mieux que demandé : le partage de surface s00/s01 est réglé par une énumération
  chiffrée (31 fichiers repris, 3 exclus nommément) plutôt que par une inversion d'ordre ; s04 porte
  désormais des critères de blocs typés qui rendent `<SortableList />` et `<BlockPicker />`
  obligatoires ; s41 déclare enfin s37, s38 **et** s39 et attribue le test de complétude au bon
  propriétaire.
- Les frontières inter-stories restent le point fort du découpage : le prédicat « impayé » possédé
  par s19 et consommé sans réinterprétation par s21/s27/s29, le modèle de catégories possédé par s10
  et prouvé par s23, l'exclusion totale des désinscrits en s25 puis leur réintégration statutaire en
  s27 (sur-exclure temporairement comme sens sûr de l'erreur), la scission s38/s39/s40. Rien à y
  redire.
- Le placement de la GED (s31, s32) avant le vote (s33) contre le calendrier du devis : arbitrage
  client daté, dépendance réelle et argumentée.
- Les cinq réserves externes sont tabulées avec leur contournement et n'immobilisent que s20, s33 et
  le parseur de s17 — s29 explique correctement pourquoi elle n'est pas otage de Pennylane.
- **Je ne rouvre pas F-13 sur les dépendances** : retirer s34 et s35 de s38 est la bonne décision,
  contrairement à ce que la formulation de F-13 pouvait suggérer. Le défaut résiduel est ailleurs
  (C-03).

## Verdict

Le périmètre est intégralement couvert, le cimetière est étanche, l'ordre est exécutable : **aucun
critical**. Sur les quinze constats du passage précédent, neuf sont corrigés, deux sont assumés par
arbitrage explicite, trois sont partiellement corrigés (s00, s38, préalable de s00) et un —
l'orphelinat de la navigation — a été résorbé en surchargeant s04 au lieu de lui donner sa story, ce
qui produit le seul défaut structurel neuf de ce passage. Les trois majors se corrigent par édition
de `docs/stories.md` seul : scinder la navigation hors de s04, borner les trois critères non
décidables de s00, aligner le critère 4 de s38 sur son critère 8.

Max severity: major
Stories ready: no
