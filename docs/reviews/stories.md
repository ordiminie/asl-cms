# Revue du découpage — ASL-CMS (Lp)

> J'ai relu `/workspace/docs/stories.md` (47 stories) sans contexte préalable et je l'ai comparé à `/workspace/docs/prd.md`. Chaque problème est classé critique, majeur ou mineur.
> s01 et s01b sont déjà livrées : je ne rediscute ni leur taille ni leur contenu.
> Cette revue fait suite à celle de `docs/reviews/stories.md`, qui avait relevé les majeurs M1, M2, M5, M6 et les mineurs m1 à m7. Pour chacun, j'indique s'il est fermé, avec les lignes qui le prouvent. Les stories nouvelles ou modifiées (s03, s08, s12b, s12c, s19, s24, s26, s27, s27b, s40, s42) ont été relues avec la même exigence que les autres.

**En bref : aucun critique, un nouveau majeur, huit nouveaux mineurs.**

- Les quatre majeurs précédents sont fermés.
- Les mineurs m1, m2, m3, m4, m6 et m7 sont fermés. m5 reste, pour mémoire.
- Toutes les lignes du périmètre sont couvertes et aucune story ne reprend un élément du cimetière.
- Nouveau majeur M7 : s29 et s42 fixent en dur la nature statutaire des relances et du lancement. Cela contredit s27b.
- Le plus urgent : m10 (complexité de s03), car s03 est la prochaine story après s02.

## Suivi de la revue précédente

| Constat                                                         | État                   | Preuve                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 — s24 c4 contredisait s40 c2                                 | **Fermé**              | s24 c4 (l. 1688) : « ni par une page ni par un appel serveur côté membre… Leur présence dans sa copie de données relève de s40 ». Le « ni export » a disparu. Il reste une phrase périmée dans la note, voir m11.                                                            |
| M2 — le rattachement daté des factures n'avait pas de test      | **Fermé**              | s19 c7 (l. 1489) : la facture est rattachée à la clé primaire du membre, avec un test sur une parcelle vendue. s12 c3 (l. 913) renvoie désormais à « s19, qui en porte le critère ».                                                                                         |
| M5 — s12b réunissait deux valeurs                               | **Fermé**              | Scindée en s12b-mise-en-ligne (6 critères, complexité 3, l. 978-1066) et s12c-sauvegarde (8 critères, complexité 3, l. 1070-1164). s13 dépend de s12c (l. 1189, l. 2745). Chaque story nomme ses propres risques (l. 1022-1044, l. 1106-1143).                               |
| M6 — le lien multi-domaine était renvoyé à s03 sans critère     | **Fermé**              | s03 c11 (l. 395) teste le lien sur deux domaines. La note de s03 (l. 434-442) et celle de s12b (l. 1046-1050) sont alignées. s42 c8 (l. 2685) couvre le lien envoyé hors requête. Pour s15, voir m14.                                                                        |
| m1 — s38 et s42 : renvois et chiffres périmés                   | **Fermé**              | s38 c4 renvoie au critère 9 (l. 2456), qui est bien le 9e critère (l. 2461). La note dit « vingt-sept dépendances » (l. 2474), soit exactement les 27 listées (l. 2467). La phrase sur le droit d'accès renvoie à s40 (l. 2483-2485). s42 ne donne plus de nombre (l. 2695). |
| m2 — s40 : aucun critère sur la trace de la demande             | **Fermé**              | s40 c7 (l. 2593), aligné sur s41 c5                                                                                                                                                                                                                                          |
| m3 — s27 : trois sujets pour une complexité de 3                | **Fermé**              | La classification est sortie vers s27b (l. 1921-1961). s27 garde 8 critères, avec une justification à jour (l. 1900-1903).                                                                                                                                                   |
| m4 — personne ne mettait en place le planificateur de l'ADR 006 | **Fermé**              | s26 le pose (l. 1853-1858) et dépend de s12b (l. 1807). s12b choisit où vit le cron (l. 1056-1058). s08 en tient compte (l. 764) : voir m9.                                                                                                                                  |
| m6 — s12c : clés de fichiers énumérées à la main                | **Fermé sur la forme** | c3 dit « toute clé de fichier référencée en base » (l. 1087) et un inventaire est centralisé (l. 1129-1134). Mais cet inventaire oublie des familles, voir m8.                                                                                                               |
| m7 — critère de s12b intestable, canal d'alerte non défini      | **Fermé**              | s12b c5 (l. 998) est devenu testable ; la partie diff et documentation est passée en « À vérifier en review » (l. 1060-1063). s12c c8 (l. 1092) impose un canal indépendant de l'application et de son adaptateur, et le piège n°3 l'explique (l. 1136-1143).                |
| m5 — stories hors du tableau du PRD                             | **Pour mémoire**       | Désormais trois dérogations déclarées : s39, s12b et s12c (l. 980-983, l. 1072-1074, l. 2778-2782).                                                                                                                                                                          |

## Couverture du périmètre

| Ligne du PRD (core loop)                                        | Couverte par                           | OK ?         |
| --------------------------------------------------------------- | -------------------------------------- | ------------ |
| CMS de pages génériques                                         | s04                                    | ✅           |
| Attribution des rôles (+ verrou anti-blocage)                   | s14                                    | ✅           |
| Permissions par rôle configurables en BO                        | s03 (registre), s37                    | ✅           |
| Connexion par lien magique 4 h (+ invitation, suivi d'adoption) | s03, s15, s42                          | ✅           |
| Pages publiques + formulaire de contact archivé en BO           | s04, s08                               | ✅           |
| Navigation du site public (menu, pied de page)                  | s04b                                   | ✅           |
| Identité visuelle (logo, teinte, favicon, en-tête des emails)   | s01b, s02, s03 c9, s15 c2, s25 c3      | ✅           |
| Limitation de débit des formulaires publics                     | s08 c5-c6, s10 c9                      | ✅ (voir m9) |
| Actualités                                                      | s05                                    | ✅           |
| Présentation du bureau                                          | s06                                    | ✅           |
| Désinscription et classification des communications             | s25 (lien et exclusion), s27b (nature) | ✅ (voir M7) |
| Bandeau d'alerte global                                         | s07                                    | ✅           |
| SEO                                                             | s11                                    | ✅           |
| Import initial des membres                                      | s13 (précédée de s12c)                 | ✅           |
| Modèle membre ↔ parcelle daté                                   | s12, s17, s18, s19 c7, s32             | ✅           |
| Coordonnées (profil membre)                                     | s16 (+ saisie par le bureau en s12)    | ✅           |
| Questions au bureau, catégories routées                         | s23 (modèle en s10)                    | ✅           |
| Notes internes et historique par membre                         | s24                                    | ✅           |
| Import annuel des relevés d'eau + rapport par email             | s17                                    | ✅           |
| Historique de consommation d'eau                                | s18                                    | ✅           |
| Signalements (public anonyme + membre identifié)                | s10, s22                               | ✅           |
| Publication des analyses d'eau                                  | s09                                    | ✅           |
| Documents partagés                                              | s31                                    | ✅           |
| Documents nominatifs physiquement séparés                       | s32                                    | ✅           |
| Campagnes email Brevo (4 modèles + campagne libre)              | s25                                    | ✅           |
| Envoi échelonné / budget quotidien                              | s26                                    | ✅           |
| Relances d'impayés activables                                   | s29                                    | ✅           |
| Publipostage PDF                                                | s28                                    | ✅           |
| Groupes de destinataires                                        | s27                                    | ✅           |
| Statistiques d'ouverture et de clic                             | s30                                    | ✅           |
| Modèles de documents (unitaire + lot)                           | s36                                    | ✅           |
| Facturation membres : interface + Pennylane                     | s19, s20                               | ✅           |
| Redirection de paiement                                         | s21                                    | ✅           |
| Multi-tenant                                                    | s01                                    | ✅           |
| Export individuel d'un membre                                   | s40                                    | ✅           |
| Simulation de rôle SuperAdmin                                   | s41                                    | ✅           |
| Export et portabilité                                           | s38, s39                               | ✅           |
| Module Vote (ASL Community)                                     | s33                                    | ✅           |
| Module Voirie                                                   | s34                                    | ✅           |
| Module Petites annonces                                         | s35                                    | ✅           |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story : 37 lignes du tronc commun et 3 modules.
- Le critère de succès « mise en production sur le VPS » n'est pas une ligne du tableau. Il est porté par s12b, et s12c y ajoute la sauvegarde.

## Périmètre

- [x] Aucune story ne reprend un élément du cimetière.
  - s12b et s12c n'introduisent ni une base par tenant ni une supervision au-delà de Sentry (l. 1065).
  - Le service externe de signal de vie de s12c relève de l'exploitation. Ce n'est pas une fonctionnalité exclue.
- [x] Aucune story ne dépasse le périmètre, sauf trois exceptions déclarées et justifiées : s39, s12b et s12c.

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, sauf les dérogations déclarées. Chacune des deux moitiés de l'ancienne s12b se livre seule et apporte sa propre valeur. s27b porte une vraie valeur pour un utilisateur (« membre désinscrit »).
- [ ] Chaque critère peut devenir un test : presque.
  - Une règle de sûreté de s27b ne vit que dans les notes (m12).
  - s12b c6 relève en partie du diff (m13).
- [x] Les notes agentiques sont présentes et utiles. Celles de s12b et s12c sont particulièrement précises : `Host`, retour arrière d'une migration, certificats, RLS forcée face à `pg_dump`, ordre base puis fichiers, alerte hors application. Il reste quelques renvois périmés ou incomplets (m8, m11).
- [ ] La complexité est notée et aucune story n'est à 5. La répartition 3 / 19 / 17 / 8 = 47 est juste (vérifiée story par story), et les huit stories à 4 expliquent leur risque. Mais s03 semble sous-notée depuis la correction de M6 (m10), et le seuil de scission de s26 ne dit pas comment la scission se reporterait dans le découpage (m15).

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable : pas de cycle.
  - s12b dépend de `s01, s01b, s03` ; s12c de `s01b, s04, s09, s12b` ; s13 de `s12, s12c` ; s26 de `s02, s12b, s25`.
  - s27b dépend de `s25, s27`, et ceux qui la consomment la déclarent : s29, s38, s42.
  - Récapitulatif et en-têtes concordent.
  - Deux points de vigilance, sans renvoi vers une story postérieure dans les critères : s08 a besoin d'une tâche périodique que le découpage place plus tard (m9) ; la note de s12b confie à s12c, qui vient après elle, la reprise d'une migration appliquée à moitié (l. 1031-1032). Ce second point est acceptable : aucune donnée réelle n'est présente avant s13.
- [x] Les ids sont bien formés, uniques et identiques entre les en-têtes et le récapitulatif.
  - `s12c` et `s27b` sont des intercalations légitimes : elles doivent précéder s13 et s28/s29.
  - Conséquence prévue par `AGENTS.md` : il faudra taper `s12-membres-parcelles` et `s27-groupes-destinataires` en entier, ou leur slug.
- [ ] Pas de chevauchement entre stories. En revanche, s29 et s27b se disputent la règle qui fait recevoir les relances aux désinscrits (M7).

## Constats

### Majeur

**M7 — majeur — s29, s42 et s27b : la nature des relances et du lancement est fixée en dur, alors que s27b la veut configurable.**

- s27b dit que la nature est une donnée de configuration, « à fournir par la prestataire au `/ks-research` », à ne « ni déduire ni proposer d'office » (l. 1953-1956). La règle transverse va dans le même sens : « si l'arbitrage la contredit, on change une valeur, pas du code » (l. 60-61). Je respecte la décision de laisser la classification au product owner. Le défaut n'est pas cette classification en attente, mais trois passages qui la fixent déjà :
  - **s29, note l. 2047-2048** : « Ne pas appliquer le filtre de désinscription ici ». Cela contourne le calcul de la cible, présenté comme le point de passage unique (s27 l. 1905-1908, s27b l. 1949-1951), et code la nature « statutaire » des relances. Si le conseil RGPD classe la relance en facultative, il faudra modifier du code. s29 déclare pourtant s27b en dépendance (l. 2030).
  - **s42 c3 (l. 2680)** : un critère affirme que le lancement est `statutaire`. Le test figera une classification que s27b renvoie au product owner.
  - **s27b l. 1961** : « les relances sont statutaires », « le lancement est statutaire ». Cela contredit la note de s27b quatre lignes plus haut.
- À corriger avant `/ks-plan s29` :
  - dans s29, remplacer la consigne par « la cible passe par le calcul de s27 ; la réintégration des désinscrits découle de la nature configurée du modèle de relance (s27b) » ;
  - reformuler s42 c3 : « la campagne de lancement suit la nature configurée ; avec la nature `statutaire`, elle atteint aussi les désinscrits » ;
  - ajouter la relance automatique et le lancement à la liste des natures que le product owner doit fournir.

### Mineurs

**m8 — mineur — s12c : il manque des familles à l'inventaire des clés de fichier.**

- La note (l. 1129-1131) liste trois familles à la livraison : identité (s01b), images de blocs (s04), PDF d'analyses (s09).
- Or deux stories livrées avant s12c stockent aussi des fichiers : s05, dont l'actualité porte une image (l. 617), et s06, dont la fiche porte une photo (l. 652). Si ce ne sont pas des blocs de s04, une photo orpheline après restauration passerait le test de c3.
- s34 (plan des voiries téléversé, l. 2266-2267) ne porte pas la consigne de déclaration que portent s31, s32 et s36.
- Enfin, l'inventaire ne détecte que les colonnes listées qui n'existent pas, pas les colonnes absentes de la liste. Il reste une énumération à la main, simplement centralisée.
- À corriger :
  - nommer s05 et s06 dans la note (ou préciser qu'elles réutilisent les clés de s04) ;
  - ajouter la consigne à s34 ;
  - envisager une détection inverse, à la manière de s39, si le schéma permet d'identifier les colonnes de clé de fichier.

**m9 — mineur — s08 c6 : une purge « sous 24 h » sans tâche périodique disponible.**

- La note (l. 764-766) reconnaît que le planificateur n'arrive qu'en s26 et qu'une purge déclenchée seulement par une nouvelle soumission ne suffit pas.
- Or le cron système n'est installé qu'en s12b, ordonnée après s08. La note renvoie à `/ks-research` un besoin que le découpage place plus tard.
- À corriger : soit faire dépendre s08 de s12b (pas de cycle, s12b ne dépend que de s01, s01b, s03), soit nommer dans la note le mécanisme provisoire accepté et la story qui le remplacera.

**m10 — mineur — s03 : une complexité de 3 qui paraît sous-estimée depuis la correction de M6.**

- s03 porte désormais 11 critères et quatre sujets à risque :
  - lien magique 4 h ;
  - quatre rôles, avec le renommage `admin` → `board` (plugin Better Auth, énuméré, constantes, l. 444-451) ;
  - création du registre d'actions et reprise des actions de s01b et s02 ;
  - session multi-domaine (origines de confiance, cookie par domaine, l. 434-442).
- Pour comparaison, le document a scindé s25 à 9 critères.
- À corriger avant `/ks-plan s03`, la prochaine story : la passer à 4 avec une note de risque, ou y inscrire un seuil de scission comme en s26 (le multi-domaine ou le renommage des rôles sortant en premier).

**m11 — mineur — s24 : la note renvoie encore le droit d'accès à s38.**

- La l. 1711-1713 dit que les notes entrent dans l'export de s38 « au titre du droit d'accès ».
- Or s38 (l. 2483-2485) renvoie ce droit à s40, et s24 c4 aussi (l. 1688).
- À corriger : « portabilité (s38) et droit d'accès (s40) ».

**m12 — mineur — s27b : la règle de sûreté n'a pas de critère.**

- « Un modèle sans nature connue se traite comme `facultative` » (l. 1958) est un comportement testable, et c'est la garantie du « sens sûr de l'erreur ». Il ne vit que dans les notes.
- À corriger : en faire un critère.
- Au passage : c1 attribue une nature à « chaque campagne », lue dans la configuration du tenant. Préciser si la campagne libre a une nature unique configurée (la règle transverse, l. 52-53, la range en facultative) ou choisie à la composition. À mettre sur la même liste que la classification fournie par le product owner.

**m13 — mineur — s12b c6 : un critère en partie intestable.**

- « Aucun workflow du dépôt ne prétend déployer ce qu'il ne déploie pas » (l. 999) relève du diff.
- La seconde moitié (`production.yml` et `preview.yml` remplacés ou retirés) est vérifiable.
- À corriger : garder la partie vérifiable et passer le reste en « À vérifier en review », comme pour c5.

**m14 — mineur — s15 : la vérification sur deux domaines ne vit que dans la note.**

- La l. 1333-1334 demande de « le vérifier sur deux associations », mais aucun critère de s15 ne le porte, contrairement à s03 c11 et s42 c8.
- Le risque est faible, puisque s15 réutilise le lien de s03.
- À corriger : ajouter le critère, ou retirer la demande de la note.

**m15 — mineur — s26 : la scission conditionnelle n'est pas reportée sur le découpage.**

- Le planificateur s'ajoute au budget, à la file de report et à la scission de campagne. La note prévoit de scinder au-delà de dix tâches (l. 1817-1818, l. 1856-1858).
- Si cette scission a lieu en `/ks-plan`, une story apparaît hors de `docs/stories.md`. s29, s30, s38 et s42, qui dépendent de s26, devraient alors être repointées.
- À corriger : écrire dans la note que la scission se fait dans `docs/stories.md`, avec nouvel id et mise à jour des dépendances, avant le plan.

**m5 — mineur, pour mémoire — s39, s12b et s12c sont hors du tableau du PRD.**

- Les trois dérogations sont déclarées, bornées et justifiées. Rien à corriger.

## Verdict

Aucun problème critique :

- toutes les lignes du périmètre sont couvertes ;
- aucune story ne reprend un élément du cimetière ;
- aucune story n'est à 5 ;
- aucun cycle.

Les quatre majeurs précédents (M1, M2, M5, M6) sont fermés, avec les preuves ci-dessus. Il reste un majeur, M7, corrigeable dans le markdown avant `/ks-plan s29`. Le point le plus urgent est m10, à trancher avant `/ks-plan s03`.

Fichiers relus :

- `/workspace/docs/prd.md`
- `/workspace/docs/stories.md`
- `/workspace/templates/stories-review-checklist.md`
- `/workspace/docs/reviews/stories.md` (revue précédente)

Max severity: major
Stories ready: yes
