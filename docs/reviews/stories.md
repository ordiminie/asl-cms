# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée).
>
> **Quinzième passage** — 43 stories (s01–s42 + s04b). Le découpage a changé de forme : la story
> `s00`, qui portait l'application du design system au socle, a été **retirée** (arbitrage humain du
> 9 septembre 2026) et ce travail est conduit hors du pipeline. Tous les comptes ont été recalculés à
> la main, toutes les affirmations sur le dépôt re-vérifiées contre l'arbre.

## Vérification du retrait (rien pris pour acquis)

| Affirmation                                                              | Verdict                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La section `s00` a disparu de `docs/stories.md`                          | ✅ 43 titres `## Story s…`, aucun `s00` ; la seule occurrence de la chaîne est le paragraphe d'explication (ligne 2379)                                                                                                                                                               |
| « Socle habillé » réécrite, ne nomme plus s00 en dépendance              | ✅ lignes 29–35 : préalable hors pipeline, renvoie à `docs/adaptation-socle-design-system.md`, et dit explicitement « Ce n'est pas une dépendance de story… c'est l'état du dépôt au moment où s01 démarre »                                                                          |
| La contrainte sur les stories d'écran survit à la réécriture             | ✅ intacte et autoportante : « ne reprend ni les tokens, ni les polices, ni les conventions d'usage de `src/components/ui/` … un écran qui redéfinit une couleur, une taille de cible ou un rayon est un échec de review »                                                            |
| s01 revenue à « Aucune. Première story du projet. »                      | ✅ ligne 113 ; la ligne du récapitulatif porte `—` ; s01 est la nouvelle racine et toute story la rejoint                                                                                                                                                                             |
| s01 a perdu le critère et la note sur `theme` / `theme_type`             | ✅ 10 critères, aucun ne parle du thème. Le travail est possédé par `docs/adaptation-socle-design-system.md` §2, qui couvre l'enum, le modèle, le DTO, le SQL brut de `seed.ts:274/291` et la migration Drizzle — **mieux couvert qu'au quatorzième passage**, où F-03 restait ouvert |
| s39 est la seule story transverse                                        | ✅ son en-tête le dit, et le « Une seule story est hors du tableau de périmètre du PRD » du récapitulatif tient : tout autre id correspond à une ligne de périmètre                                                                                                                   |
| Récapitulatif : 43 / « trois à 1, dix-huit à 2, quatorze à 3, huit à 4 » | ✅ recompté depuis les 43 corps de story : 3 + 18 + 14 + 8 = 43, et les scores des corps correspondent au tableau ligne à ligne                                                                                                                                                       |
| `AGENTS.md` n'excepte plus s00 ; la règle du suffixe lettre reste        | ✅ `AGENTS.md:107` porte « Our own story ids start at `s01` » sans exception (les `s000-*`/`s001-*` sont les fichiers de recherche du boilerplate, correctement écartés) ; `AGENTS.md:70` autorise toujours l'id lettré, sans mention de s00                                          |
| `docs/adaptation-socle-design-system.md` n'est pas une story             | ✅ il se déclare « pas une story… pas un contrat de revue », et rend explicitement les cinq composants du §2.2 à s07, s41 et s04 — aucun n'est orphelin                                                                                                                               |

## Perimeter coverage

Les 37 lignes du tableau « Replicated (core loop) » sont couvertes : s04, s14, s37, s03/s15/s42,
s08, **s04b** (navigation), s02/s25, s08/s10, s05, s06, s25/s27, s07, s11, s13, s12, s16, s23, s24,
s17, s18, s10/s22, s09, s31, s32, s25, s26, s29, s28, s27, s30, s36, s19/s20, s21, s01/s02, s40, s41,
s38/s39. Modules activables : vote s33, voirie s34, petites annonces s35.

- [x] Toute ligne du tableau est délivrée par au moins une story. **Aucune ligne orpheline — aucun
      critical de couverture.** Le retrait de s00 n'a coûté aucune couverture : **s00 ne correspondait
      à aucune ligne de périmètre, et c'est précisément pourquoi elle a été sortie.**

## Scope

- [x] Aucune story ne réintroduit un item du cimetière. Liste parcourue intégralement : électricité/gaz,
      logique de vote (s33 l'exclut nommément), traitement des paiements (s20 c7, s21 c3), messagerie
      privée (s35), multi-immeubles/tantièmes, plan B de connexion (s03, s12, s28, s42), appels de
      fonds (s19), carte interactive (s34), vote temps réel/procurations/émargement (s33), IA
      conversationnelle (s01 retire le chat), classification IA (s32), Kanban (s01 retire
      projets/tâches), messagerie dédiée, une base par tenant (s01), abstraction « ressource
      partagée » (s34), WordPress (ADR 001). La réécriture de « Socle habillé » n'ajoute rien au
      périmètre — elle retire.
- [x] **Aucune story ne dépasse le périmètre.** Le contrôle passe désormais sur 42 des 43 stories ;
      la seule dérogation déclarée est s39, bornée et énoncée dans son en-tête **et** au récapitulatif.
      Le retrait de s00 a fermé l'autre moitié de la case restée ouverte au passage précédent.

## Story quality

- [x] Chaque story est une tranche livrable de bout en bout — à l'exception déclarée de s39 (harnais
      de non-régression). s01 embarque le retrait ADR 009, mais à l'intérieur d'une vraie tranche
      visible par l'utilisateur (« une association a son site »), avec le raisonnement écrit.
- [x] **Chaque critère peut devenir un test.** Aucun critère indécidable trouvé ; les propriétés non
      observables sont systématiquement poussées hors des critères, vers « À vérifier en review, pas
      en test » (s02, s03, s13, s15, s42).
- [x] Notes agentiques présentes et utiles partout.
- [x] Complexité chiffrée, aucune 5, et chacune des huit 4 énonce son risque (s01, s04, s12, s26,
      s29, s32, s37, s38).

## The list as a whole

- [x] **Ordre exécutable.** Les 43 jeux d'arêtes parcourus : toute arête pointe vers un id antérieur,
      s04b → s04, s34 → s04b, s38 → s04b, s41 → s39 compris. Aucun cycle. **Le graphe a survécu à la
      perte de sa racine** : s01 n'a plus de dépendance, et s02/s03/s07/s12/s34/s41 l'atteignent
      toujours directement. Les dépendances de s38 recomptées à la main : exactement 25.
- [x] Ids bien formés, uniques et stables — 43 ids distincts, un lettré (s04b), couvert par
      `AGENTS.md:70`.
- [x] Aucun recouvrement. Frontières re-vérifiées : s12/s16, s10/s23/s35, s25/s27, s28/s36,
      s38/s39/s40, s14/s37/s41, s15/s42.

## Findings

**G-01 — minor — récapitulatif (ligne 2385) : renvoi pendant vers la story retirée.**
« Sa surface est énumérée dans ses critères » — s00 n'a plus de critères. Sa surface est désormais
énumérée dans `docs/adaptation-socle-design-system.md` (le tableau mesuré). Faire pointer la phrase là.

**G-02 — minor — rien dans le découpage n'échoue si le préalable n'est pas fait.**
« Socle habillé » impose la bonne chose aux stories (« un écran qui redéfinit une couleur… est un
échec de review »), mais cela attrape une story qui redéclare des tokens, pas un socle jamais habillé
— et le piège n°1 du document de reprise dit qu'un retrait à moitié fait est **pire que l'état de
départ** (125 classes `dark:` par-dessus des tokens clairs). Correction la moins chère : un contrôle
d'état d'entrée en tête du `/ks-research` de s01 (ou de s04, première grosse story d'écran), pas une
story de plus.

**G-03 — minor — s02, notes agentiques (ligne 260) : affirmation fausse contre le dépôt.**
« Les tokens sont déjà en place dans `src/app/globals.css` » — vérifié : pas d'`--accent-hue`, aucun
token `warning`, et `--radius: 0.625rem` ligne 60 là où le design system veut `0.5rem`. La phrase
n'est vraie qu'**après** le travail hors pipeline, et avec s00 partie c'est la seule note de story qui
affirme cet état du dépôt sans nommer qui le produit.

**G-04 — minor — s19 : arête manquante vers s02.**
Dépendances déclarées : `s12` seul. Or le critère 4 (« La configuration du tenant désigne lesquels des
statuts de la source valent « impayé » ») exige s02, qui n'est pas atteignable transitivement
(s19 → s12 → s01, s03). L'ordre n'en souffre pas (s02 précède s19), donc c'est une arête manquante et
non une référence en avant — mais s27 et s29 héritent du prédicat d'ici, l'arête vaut d'être déclarée.

**G-05 — minor — s42 : arête manquante vers s27.**
Les dépendances omettent s27, alors que le critère 3 (« La campagne de lancement est de nature
`statutaire` : elle atteint tous les membres, y compris ceux qui se seraient désinscrits ») n'a de sens
qu'une fois s27 livrée : sous s25 seule, la règle est l'exclusion totale. Pas de rupture d'ordre non
plus, juste une arête non déclarée.

**G-06 — minor — récapitulatif (ligne 2396) : « Deux écarts avec les scores du PRD » en sous-compte un.**
s04 est chiffrée **4** contre le **3** du PRD pour « CMS de pages génériques », et ses propres notes le
disent (« la story tient au-dessus du 3 chiffré par le PRD… le modèle en blocs typés de l'ADR 007 »).
Dire trois écarts, ou dire pourquoi s04 n'est pas comptée.

**G-07 — minor — comptes de prose périmés, révélés par le retrait.**
Trois nombres du texte courant ne correspondent plus à 43 stories : s01 ligne 124 « se paie sur **36**
stories » contredit s01 ligne 179 « **42** stories les traverseront en revue » (les deux nomment le
même ensemble — tout ce qui suit s01, soit 42) ; s03 ligne 304 « les **trente-trois** stories
intermédiaires » entre s03 et s37 en fait 34 depuis l'intercalation de s04b ; s42 ligne 2295 « les
**37** stories précédentes » en fait 42. `docs/architecture.md:88` (« engage 42 stories ») est, lui,
correct.

**G-08 — minor — s35 : l'entrée de menu morte n'est pas couverte.**
La ligne Navigation du PRD exige qu'un module désactivé « ne laisse aucune entrée de menu morte ».
s34 c4 la porte mot pour mot (« aucune navigation n'y renvoie ») et s33 c1 couvre l'accès côté membre
(« l'accès à l'espace de vote n'est pas proposé »), mais s35 c6 s'arrête à « ni la page ni le
formulaire de soumission n'existent » — rien sur le point d'entrée dans l'espace membre.

Aucun des huit ne touche à la couverture, au cimetière, ni à l'exécutabilité de l'ordre.

## Verdict

Max severity: minor
Stories ready: yes
