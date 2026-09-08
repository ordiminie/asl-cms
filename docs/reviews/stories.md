# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Dixième passage** — 43 stories (s00–s42). Premier passage couvrant `s00-application-design-system`,
> ajoutée après le neuvième. Verdict re-dérivé sans s'appuyer sur celui du passage précédent.

## Perimeter coverage

**Tronc commun — livré à toute association**

| PRD feature (core loop)                                                          | Couvert par                               | OK ?                          |
| -------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------- |
| CMS de pages génériques (créer / modifier / publier / dépublier)                 | s04                                       | ✅ (réserve : cf. F-05, F-06) |
| Attribution des rôles aux membres                                                | s14                                       | ✅                            |
| Permissions par rôle configurables en back-office                                | s37                                       | ✅                            |
| Connexion par lien magique (validité 4 h) + flux d'invitation + suivi d'adoption | s03, s15, s42                             | ✅                            |
| Pages publiques + formulaire de contact archivé en BO                            | s08 (+ s04)                               | ✅ (réserve : F-06)           |
| Limitation de débit des formulaires publics                                      | s08, réutilisé par s10                    | ✅                            |
| Actualités de l'association (mini-blog daté)                                     | s05                                       | ✅                            |
| Présentation du bureau (fiches listables et éditables)                           | s06                                       | ✅                            |
| Désinscription et classification des communications                              | s25 (effet), s27 (nature)                 | ✅                            |
| Bandeau d'alerte global                                                          | s07                                       | ✅                            |
| SEO (sitemap, métadonnées, Search Console)                                       | s11                                       | ✅                            |
| Import initial des membres d'une association                                     | s13                                       | ✅                            |
| Modèle membre ↔ parcelle **daté**                                                | s12                                       | ✅                            |
| Coordonnées (profil membre)                                                      | s16 (+ s12 côté bureau)                   | ✅                            |
| Questions au bureau, catégories avec routage email                               | s23 (modèle de catégories : s10)          | ✅                            |
| Notes internes et historique par membre                                          | s24                                       | ✅                            |
| Import annuel des relevés d'eau + rapport d'erreurs par email                    | s17                                       | ✅                            |
| Historique de consommation d'eau par membre                                      | s18                                       | ✅                            |
| Signalements avec catégories et statuts                                          | s10 (public), s22 (membre)                | ✅                            |
| Publication des analyses d'eau                                                   | s09                                       | ✅                            |
| Documents partagés (statuts, PV, ordres du jour)                                 | s31                                       | ✅                            |
| Documents nominatifs en dossiers physiquement séparés                            | s32                                       | ✅                            |
| Campagnes email Brevo (4 modèles + libre, gabarit commun)                        | s25                                       | ✅ (réserve : F-04, le logo)  |
| Envoi échelonné au-delà de 300 destinataires                                     | s26                                       | ✅                            |
| Relances d'impayés (3, à 3/2/1 semaines), activables par tenant                  | s29                                       | ✅                            |
| Publipostage PDF pour les membres sans email                                     | s28                                       | ✅                            |
| Groupes de destinataires personnalisés                                           | s27                                       | ✅                            |
| Statistiques d'ouverture et de clic des campagnes                                | s30                                       | ✅                            |
| Modèles de documents réutilisables (unitaire **et** en lot)                      | s36                                       | ✅                            |
| Facturation membres : interface + implémentation Pennylane                       | s19 (interface + manuel), s20 (Pennylane) | ✅                            |
| Redirection de paiement                                                          | s21                                       | ✅                            |
| Multi-tenant (Organization, configuration par tenant, RLS)                       | s01, s02                                  | ✅ (réserve : F-04)           |
| Export individuel d'un membre (droit d'accès RGPD)                               | s40                                       | ✅                            |
| Simulation de rôle SuperAdmin                                                    | s41                                       | ✅                            |
| Export et portabilité des données                                                | s38 (+ s39, garde-fou)                    | ✅                            |

**Modules activables par tenant**

| PRD feature                                     | Couvert par | OK ? |
| ----------------------------------------------- | ----------- | ---- |
| Vote : interface + implémentation ASL Community | s33         | ✅   |
| Voirie                                          | s34         | ✅   |
| Petites annonces entre membres                  | s35         | ✅   |

- [x] Toute ligne du tableau « Replicated (core loop) » est délivrée par au moins une story —
      **aucun trou de ligne, donc aucun critical de couverture.** Les réserves signalées sont des
      lacunes internes à une ligne couverte (F-04, F-05, F-06), pas des lignes orphelines.

## Scope

- [x] Aucune story ne réintroduit un item du cimetière. Vérifié un à un : électricité/gaz (absent),
      logique de vote (s33 l'exclut explicitement), traitement des paiements (s21 réduit au lien
      sortant, avec test sur le schéma), messagerie privée entre membres (s35 l'exclut),
      multi-immeubles/tantièmes (absent), plan B de connexion sans email (s42 interdit explicitement
      de promettre un accès dans le courrier), appels de fonds (absent), carte interactive (s34 :
      image statique), vote temps réel/procurations/émargement (absent), assistant IA (absent),
      classification IA des documents (s32 l'exclut), Kanban (absent), messagerie à adresse dédiée
      (absent), une base par tenant (s01 l'exclut), abstraction « ressource partagée » (s34
      l'exclut), WordPress (ADR 001).
- [ ] **Aucune story ne dépasse le périmètre** — échoue sur s00 : aucune ligne du PRD ne porte
      l'application du design system au socle. Ce n'est **pas** une fuite du cimetière (le sujet n'y
      figure pas) ; c'est un travail d'habillage mandaté par `docs/design-system.md` §10, doc de
      cadrage postérieur au PRD. Voir F-01.

## Story quality

- [ ] **Chaque story est une tranche livrable de bout en bout, pas une couche technique** — échoue
      sur s00 (F-01).
- [ ] **Chaque critère d'acceptation peut devenir un test** — les 42 stories relues sont exemplaires
      sur ce point (elles isolent systématiquement ce qui est « à vérifier en review, pas en test »
      hors des critères). Échoue sur s00 (F-02) et, à la marge, sur un critère de s38 (F-09).
- [x] Notes agentiques présentes et utiles partout (fichiers du socle, pièges cache, pièges
      d'adaptateur, cimetière rappelé story par story). Qualité inhabituellement haute.
- [x] Complexité chiffrée ; **aucune 5** ; les sept 4 (s01, s12, s26, s29, s32, s37, s38) énoncent
      chacune leur risque explicitement. Les deux écarts au PRD (s27 3 vs 2, s38 4 vs 3) sont
      justifiés dans la story. Le 3 de s00 est en revanche non ancrable tant que sa surface n'est pas
      définie (F-02).

## The list as a whole

- [x] **Aucun cycle, aucune référence en avant dans les dépendances déclarées** : vérifié ligne à
      ligne sur le récapitulatif, toute dépendance pointe vers un id strictement inférieur. La
      circularité s03 → s12 → s03 relevée à la passe précédente est bien résolue par s15.
- [ ] **Ordre exécutable** — deux défauts : s00 se déclare « préalable à toutes les stories porteuses
      d'écran » sans qu'aucune story ne la déclare en dépendance (F-03), et s00 est ordonnée avant
      s01 alors que s01 supprime une partie des composants qu'elle doit reprendre (F-07).
- [x] Ids bien formés (`s<numéro>-<slug>`), uniques, stables. Réserve mineure sur le choix du numéro
      `00` (F-11).
- [ ] **Aucun recouvrement** — les frontières internes aux 42 stories sont explicitement tenues
      (s12/s16, s08/s23, s10/s22/s23/s35, s19/s20, s25/s27, s28/s36, s14/s37/s41). Échoue sur le
      couple s00/s01 (F-07) et sur le routage des composants du §2.2 (F-08).

## Findings

**F-01 — major — s00 : ce n'est pas une tranche livrable, c'est une couche transverse.**
À la livraison de s00, aucun écran d'ASL-CMS n'existe : s00 n'a aucune dépendance et précède s01. Les
écrans effectivement rhabillés sont ceux du boilerplate (tableau de bord, checkout Stripe, blog,
docs, admin), dont aucun n'appartient au produit. La persona invoquée — « membre du bureau » —
n'existe pas avant s03, et le premier écran bureau arrive en s04. La story le dit elle-même :
« Préalable à toutes les stories porteuses d'écran ». C'est la signature d'une story de couche : elle
existe pour préparer les autres, pas pour livrer une valeur observable par un utilisateur. Aucune
ligne du périmètre ne la porte. Deux issues possibles pour l'humain — la dissoudre dans les stories
porteuses d'écran (chacune compose déjà avec `/ks-design`), ou l'assumer explicitement comme travail
de socle hors tableau du périmètre, avec une surface énumérée (cf. F-02).

**F-02 — major — s00 : sa surface n'est jamais définie, donc « fini » est indécidable.**
Le critère 5 porte « sur les écrans repris » — mais aucun endroit de la story ne dit quels écrans sont
repris. Le critère 4 réduit le §2.1 (onze familles, plusieurs dizaines de règles dont « un seul bouton
`default` par écran » ou « rien d'important ne passe par un toast ») à quatre mesures de hauteur, sur
« au moins un exemple de chaque famille » non spécifié. Le critère 6 est inconditionnellement vrai si
rien n'est rencontré : ce n'est pas un test, c'est une intention. Le critère 1 exige enfin que
`--accent-hue` soit « la seule variable dont dépend la couleur d'une association » — une propriété
multi-tenant affirmée avant que le tenant n'existe (s01) et avant qu'aucun écran ne permette de
choisir cette teinte (manque §9 du design system, attribué à s02). Sans surface énumérée, ni le score
3 ni le critère de sortie ne sont ancrables.

**F-03 — major — liste : le préalable annoncé par s00 n'est déclaré par personne.**
s00 se dit préalable à toutes les stories porteuses d'écran, mais s04, s05, s06, s07, s09, s34, s35…
dépendent de s01/s03/s04 seulement, et le récapitulatif porte « — » en face de s00. Rien n'empêche
donc l'exécution de s04 avant s00, ce qui produirait exactement la reprise écran par écran que s00 dit
éviter. Un préalable non exprimé dans le graphe n'est pas un préalable.

**F-04 — major — l'identité visuelle par tenant n'est portée par aucune story.**
s25 exige « en-tête au logo de l'association », s00 fait dépendre la couleur d'une association
d'`--accent-hue`, et le PRD pose en critère de succès qu'« une deuxième association est provisionnée
sans écrire une ligne de code ». Or s01 crée une association avec « nom, slug, domaine, modules
activés » (pas de logo), et les critères de s02 n'énumèrent que trois types de paramètres — « email
valide, seuil numérique, booléen ». Aucun critère, nulle part, ne permet de téléverser un logo, de
choisir une teinte ou de servir un favicon par association. Six sites partageant le favicon et la
couleur du boilerplate se voient immédiatement, et le gabarit de campagne de s25 n'a pas de logo à
afficher. Le design system range ces deux manques en §9 (attribués à s02 et s11) — mais un manque de
design system signalé ne devient pas un critère d'acceptation tout seul.

**F-05 — major — s01 ne porte pas le retrait des sous-systèmes du boilerplate, que l'ADR 009 lui assigne nommément.**
L'ADR 009 (accepté) est explicite : « Le retrait est exécuté **dans s01** », et « ces deux règles
[`rule-react-query.md`, `rule-seed-usersroles-and-organization.md`] doivent être mises à jour dans le
même commit que le retrait — c'est une tâche explicite de s01, pas un détail de nettoyage ».
`AGENTS.md` le reprend en règle de dépôt. Or s01 n'en dit **rien** : ni critère, ni note agentique. Un
agent exécutant s01 tel qu'écrit livrera chat IA, crédits, affiliation, projets/tâches et Mailchimp
intacts — donc des tables métier sans policy RLS, exactement ce que l'ADR voulait éviter, et deux
fichiers de règles pointant vers des fichiers présents mais hors périmètre.

**F-06 — major — la navigation du site public n'appartient à aucune story.**
s04 rend une page publiée « à l'URL publique », mais aucun critère ne la fait apparaître dans un menu,
et aucune story ne livre l'en-tête, le menu ou le pied du site public éditables par le bureau. s34
s'appuie pourtant dessus : « désactivé, la page n'existe pas et **aucune navigation n'y renvoie** » —
un critère qui suppose une navigation que personne ne construit. Conséquence directe sur le critère de
succès du PRD « le bureau crée, modifie et publie une page sans aucune intervention du prestataire » :
une page publiée mais inatteignable autrement qu'en tapant son URL ne satisfait pas ce critère.

**F-07 — major — s00 et s01 se disputent la même surface, dans le mauvais ordre.**
s00 doit neutraliser 157 classes `dark:` réparties dans 34 fichiers (inventaire vérifié : 34 fichiers
dans `src/`, chiffre exact). Trois de ces fichiers appartiennent à des sous-systèmes que s01 supprime
au titre de l'ADR 009 : `src/components/features/chat/message-content.tsx`,
`src/components/features/credits/credit-activity-timeline.tsx`,
`src/components/features/admin/credits/organization-search.tsx`. s00 étant ordonnée **avant** s01,
elle rhabille du code que la story suivante efface. L'ordre correct est l'inverse, ou bien s00 doit
énumérer sa surface en excluant ce que l'ADR 009 retire (ce qui rejoint F-02).

**F-08 — major — s00 route `<MeterInput />` vers s17/s18, qui ne contiennent aucune saisie de relevé.**
Le §2.2 du design system spécifie `<MeterInput />` comme un composant de **saisie** (rappel de l'index
précédent, calcul à la frappe, refus d'un index en recul, conservation locale en cas de coupure
réseau, `Entrée` = enregistrer et passer à la parcelle suivante). Or s17 est un **import** de fichier
Excel/CSV et s18 une **consultation** en lecture seule : ni l'une ni l'autre n'a de critère de saisie
manuelle de relevé, et le PRD n'en demande pas (ses deux lignes sont « Import annuel des relevés
d'eau » et « Historique de consommation »). Le renvoi de s00 attribue donc à deux stories une capacité
qu'elles ne portent pas, et ouvre la porte à ce qu'un agent développe en s17 un écran de relevé de
terrain hors périmètre. À trancher : soit une story propre (donc un passage par `/ks-prd`), soit le
retrait du composant du §2.2.

**F-09 — major — s04 est muette sur le modèle en blocs que l'ADR 007 impose et que s00 lui attribue.**
s00 attribue `<PreviewBar />`, `<SortableList />` et `<BlockPicker />` à s04. `<PreviewBar />` est bien
couvert (« reste prévisualisable par le bureau »). Les deux autres non : les critères de s04 parlent
de « contenu riche, images », jamais de blocs typés, d'insertion à un rang ni de réordonnancement —
alors que l'ADR 007 pose qu'« une page est une liste ordonnée de blocs typés (Milkdown + @dnd-kit),
pas un champ markdown » et que le design system §4 décrit le rendu public des cinq blocs. s04 peut
donc passer sa review sans qu'aucun de ces deux composants n'existe, et sans que le modèle en blocs
soit livré.

**F-10 — minor — s07 contredit le §2.3 du design system sur les niveaux d'alerte.**
Le §2.3 spécifie trois niveaux (info / avertissement / urgence), un niveau 3 non refermable, un
masquage de 24 h, une désactivation automatique sur `endsAt` et un rappel à 48 h. Les notes de s07
posent l'inverse : « pas de niveaux de gravité — le CDC n'en demande pas ». Le PRD donne raison à s07
(ligne complexité 1 : « activation / édition / désactivation »). La contradiction n'est donc pas un
défaut de périmètre, mais elle doit être tranchée dans un des deux documents, sinon `/ks-design` de
s07 livrera un composant que ses critères n'exercent pas.

**F-11 — minor — s00 : le numéro `00` contredit une règle du dépôt.**
`AGENTS.md` pose que « nos propres story ids commencent à `s01` dans docs/stories.md », et réserve
`docs/research/s000-*` / `s001-*` aux documents hérités du boilerplate, à ne jamais traiter comme des
stories du projet. `docs/research/s00-application-design-system.md` viendra se ranger juste à côté de
`s000-*` et `s001-*` : confusion garantie pour un agent qui lira ce répertoire. L'id reste bien formé
et unique — c'est un choix de numérotation à revoir, pas un défaut bloquant.

**F-12 — minor — s38 : renvoi pendant après la scission vers s39.**
Le critère « le module entre dans l'archive par le test de complétude **ci-dessous** » désigne un test
qui n'est plus dans s38 : il est en s39, story qui dépend de s38. La moitié vérifiable du critère
(« un module non livré ne fait pas échouer l'export ») reste bonne ; la seconde moitié n'est pas
testable dans s38.

**F-13 — minor — s38 : traitement incohérent des modules activables dans ses dépendances.**
s33 est volontairement exclue des dépendances « pour que l'export ne soit pas otage d'une condition
suspensive », mais s34 (voirie) et s35 (annonces) — modules activables eux aussi, désactivables par
tenant — y figurent en dur. Si le mécanisme sait traiter un module non livré (critère 8), ces deux
dépendances sont inutiles ; s'il ne le sait pas, l'exclusion de s33 est fragile. Vingt-six dépendances
rendent par ailleurs s38 non planifiable avant la quasi-totalité du produit : c'est assumé, mais c'est
la story la plus exposée à un glissement de calendrier.

**F-14 — minor — s41 : dépendance non déclarée et test mal attribué.**
Le critère « cette trace est soit incluse dans l'export (s38), soit déclarée exclue avec son motif : le
test de complétude de s38 continue de passer » s'appuie sur s38 **et** sur s39 (à qui appartient
réellement le test de complétude), alors que les dépendances de s41 n'en citent aucune. L'ordre reste
exécutable (39 < 41) : c'est la déclaration qui est incomplète, et l'attribution du test à s38 au lieu
de s39 qui est fausse.

**F-15 — minor — s00 : deux des trois conséquences de socle du §10 ne sont pas reprises en critère.**
Le design system §10 assigne explicitement à « la story qui applique le système au boilerplate » trois
dettes. La première (retrait du bloc `.dark` de `globals.css`) est couverte. Les deux autres ne le sont
pas : la mise à jour de `.claude/rules/01-presentation/rule-mdx-rendering.md`, qui impose de vérifier
chaque modification « en clair et en sombre » — donc une vérification devenue impossible, laissée en
piège pour toutes les stories suivantes — et la révision du motif d'opt-out de `docs/[...slug]` dans
`docs/architecture.md`, qui tombe avec le dual-theme Shiki.

## Ce que je n'ai pas retenu comme défaut

- Le recouvrement s12/s16 (coordonnées côté bureau vs self-service), la propriété du modèle de
  catégories (s10, réutilisé par s23 et s35), la scission s25/s27 du ciblage, la scission
  s38/s39/s40, la frontière s14/s41, le prédicat « impayé » possédé par s19 : toutes ces frontières
  sont posées explicitement et testées du bon côté. C'est le point fort de ce découpage.
- Le placement de la GED (s31, s32) avant le vote (s33) contre le calendrier du devis : arbitrage
  client daté et argumenté, dépendance réelle (le PV se publie en document partagé). Ce n'est pas un
  défaut d'ordre.
- Les cinq réserves externes bloquantes (Pennylane, ASL Community, fichier de relevés, contenus des
  modèles, arbitrage RGPD) sont tabulées avec leur contournement et n'immobilisent que s20, s33 et le
  parseur de s17. Correct.

## Verdict

Le périmètre du PRD est intégralement couvert et le cimetière est étanche : **aucun critical**. Mais
quatre travaux réels n'appartiennent à aucun critère d'acceptation (retrait ADR 009 en s01, identité
visuelle par tenant, navigation du site public, modèle en blocs de s04), et la story la plus récente —
s00, jamais relue — n'est pas encore une story au sens du pipeline : couche transverse, surface non
énumérée, préalable non câblé dans le graphe, et recouvrement d'ordre avec s01. Ces six points se
corrigent par édition de `docs/stories.md`, sans rouvrir le PRD, sauf F-08 (`<MeterInput />`) qui
demande un arbitrage de périmètre.

Max severity: major
Stories ready: no
