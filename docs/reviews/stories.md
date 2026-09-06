# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Septième passage** — 40 stories, PRD amendé (actualités, présentation du bureau, export
> individuel, simulation de rôle chiffrés au périmètre). Reviewer neuf. Les deux majors du 6e
> passage sont levés. **Un critical apparaît — et contrairement aux passages précédents, il ne vient
> pas d'un correctif : c'est un trou d'origine, présent depuis le premier découpage, que six revues
> n'avaient pas vu.**
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

**Tronc commun (33 lignes)**

| Feature du PRD (core loop) | Couverte par | OK ? |
| --- | --- | --- |
| CMS de pages génériques | s04 | ✅ |
| Permissions par rôle configurables en BO | s36 | ✅ |
| Connexion par lien magique (4 h) + flux d'invitation + suivi d'adoption | s03, s14, s40 | ✅ |
| Pages publiques + formulaire de contact archivé en BO | s04, s08 | ✅ |
| Limitation de débit des formulaires publics | s08 (livre), s10 (réutilise) | ✅ |
| Actualités (mini-blog daté) | s05 | ✅ |
| Présentation du bureau (fiches listables) | s06 | ✅ |
| Bandeau d'alerte global | s07 | ✅ |
| SEO (sitemap, métadonnées, Search Console) | s11 | ✅ |
| Import initial des membres | s13 | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Coordonnées (profil membre) | s15 | ⚠️ voir critical — self-service seulement |
| Questions au bureau, catégories + routage | s22 (modèle en s10) | ✅ |
| Notes internes **et historique** par membre | s23 | ⚠️ voir major #1 |
| Import annuel des relevés d'eau + rapport email | s16 | ✅ |
| Historique de consommation d'eau | s17 | ✅ |
| Signalements catégories + statuts (public + membre) | s10, s21 | ✅ |
| Publication des analyses d'eau | s09 | ✅ |
| Documents partagés | s30 | ✅ |
| Documents nominatifs, dossiers physiquement séparés | s31 | ✅ |
| Campagnes email Brevo (4 modèles + libre, gabarit) | s24 | ✅ |
| Envoi échelonné au-delà de 300 | s25 | ✅ |
| Relances d'impayés (3 / 3-2-1 sem., activables) | s28 | ✅ |
| Publipostage PDF pour les membres sans email | s27 | ❌ voir critical — donnée d'entrée sans producteur |
| Groupes de destinataires personnalisés | s26 | ✅ |
| Statistiques d'ouverture et de clic | s29 | ✅ |
| Modèles de documents réutilisables | s35 | ✅ |
| Facturation membres : interface + Pennylane | s18, s19 | ✅ |
| Redirection de paiement | s20 | ✅ |
| Multi-tenant (Organization, config, RLS) | s01, s02 | ✅ |
| Export individuel d'un membre (RGPD) | s38 | ✅ |
| Simulation de rôle SuperAdmin | s39 | ✅ |
| Export et portabilité des données | s37 | ✅ |

**Modules activables (3 lignes)**

| Feature du PRD | Couverte par | OK ? |
| --- | --- | --- |
| Vote : interface + ASL Community | s32 | ✅ |
| Voirie | s33 | ✅ |
| Petites annonces entre membres | s34 | ✅ |

- [x] Chaque ligne du tableau « Replicated (core loop) » a au moins une story nommée. Aucune ligne
  n'est orpheline — **mais deux lignes (publipostage, notes internes) sont couvertes par une story
  qui ne peut pas les livrer telles qu'écrites.**

## Périmètre

- [x] Aucune story ne réintroduit un item du cimetière. Vérifié ligne à ligne : électricité
  (absente), logique de vote (s32 la refuse explicitement), traitement de paiement (s19 et s20
  portent un test sur l'absence de champ bancaire), messagerie privée (s34 la refuse),
  multi-immeubles / tantièmes (absents), plan B de connexion sans email (refusé en règle transverse,
  s27 et s40), appels de fonds (absents), carte interactive (s33 impose l'image statique), vote temps
  réel / procurations (s32), IA conversationnelle et classification IA (s31), Kanban (absent),
  messagerie dédiée par association (s22 route vers des adresses existantes, ne crée pas de boîte),
  base par tenant (s01 : base partagée + RLS), abstraction « ressource partagée » (s33 la refuse),
  WordPress (s04 ne le mentionne que comme référence d'ergonomie).
- [x] Aucune story ne sort du périmètre. Un seul étirement discutable : s35 (minor).

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout : aucune story « poser la base de
  données », « créer la couche API ». s01 est la plus large (tenant + routage domaine + drapeaux +
  RLS) mais reste énoncée du point de vue d'un utilisateur avec un parcours vérifiable, et sa largeur
  est argumentée dans ses notes.
- [ ] Critères tous testables — voir les minors et le major #1.
- [x] Notes agentiques présentes partout, riches (fichiers du boilerplate, pièges cache, adaptateurs
  Brevo / stockage, cimetière rappelé story par story). **C'est la meilleure partie du document.**
- [x] Complexité chiffrée partout, aucune 5, six 4 (s01, s12, s28, s31, s36, s37) portant chacune un
  paragraphe « Risque (complexité 4) » explicite. Réserve sur s36 (major #2).

## La liste dans son ensemble

- [x] Ordre exécutable : les 40 listes de dépendances pointent toutes vers des ids strictement
  inférieurs. Aucun cycle, aucune référence en avant dans les dépendances déclarées. Les deux pièges
  classiques ont été traités et documentés (s03 → s12 → s03 cassé par s14 ; s24 qui n'attend pas s26
  pour le filtre de désinscription).
- [x] Ids `s01`…`s40`, format `s<numéro>-<slug>` respecté, uniques, slugs courts et stables.
- [x] Pas de recouvrement : la propriété de chaque brique partagée est attribuée nommément
  (catégories → s10 ; limiteur de débit → s08 ; ciblage → s26 ; moteur PDF → s27 ; export → s37
  filtré par s38 ; invitation unitaire s14 vs masse s40).

## Constats

### Critical

- **critical — s27 / s40 (et s12, s13, s15) — l'adresse postale des membres sans compte n'a aucun
  producteur.** s27 exige « Chaque courrier porte les variables du destinataire (nom, **adresse
  postale**, parcelle, date) » et s40 exige « la somme des destinataires email et des courriers
  produits égale l'effectif de l'association ». Or l'adresse postale n'apparaît que dans s15, dont le
  critère est *« Un membre **connecté** modifie ses coordonnées »* — et les ~100 membres visés par le
  publipostage n'ont, par construction, aucun compte (cimetière : aucun plan B de connexion). s12
  n'énumère aucun champ de contact dans ses critères, s13 importe « nom, email, parcelle » (conforme
  au PRD), et le seul critère du bureau sur les coordonnées est en lecture (« Le bureau **voit** les
  coordonnées à jour »). **Aucune story ne donne au bureau la saisie ni la mise à jour des
  coordonnées postales d'un membre.** Conséquence : le publipostage PDF — angle n°2 du PRD, ligne du
  périmètre, et critère de succès explicite (« Une campagne produit un PDF de publipostage
  exploitable pour les membres sans email, sans ressaisie ») — n'est pas livrable par ce découpage,
  et le défaut n'apparaîtrait qu'à l'exécution de s27, huit stories après le point où il fallait le
  corriger.

### Majors

- **major — s23 — la moitié « historique des échanges » de la ligne de périmètre n'est ni spécifiée
  ni produite.** Le PRD demande « notes privées **et historique des échanges** ». s23 a un critère
  pour ajouter une note, puis un critère qui affiche « l'historique chronologique des notes **et des
  échanges enregistrés** » — sans qu'aucun critère ne dise ce qu'est un échange, qui l'enregistre, ni
  comment. Si l'intention est l'alimentation automatique par les questions (s22), les signalements
  (s21) et les campagnes (s24), alors s23 ne peut pas la livrer : elle ne dépend que de s12 et est
  ordonnée avant s24. Si l'intention est une saisie manuelle par le bureau, il manque le critère
  correspondant. En l'état, ce critère n'est pas testable et la ligne de périmètre n'est couverte
  qu'à moitié.
- **major — s36 — la matrice suppose un registre d'actions que 35 stories antérieures n'ont aucune
  obligation d'alimenter.** Les notes posent le principe : « Chaque story déclare les actions qu'elle
  introduit ; la matrice les découvre » — et c'est ce principe qui justifie la liste de dépendances
  courte (s03 seule) et le score 4. Mais **aucune des stories s01→s35 ne porte ce devoir**, ni en
  critère, ni en note, et il ne figure pas dans les « Règles transverses à toutes les stories » en
  tête de document. Le critère 3 de s36 revient donc à instrumenter rétroactivement l'autorisation de
  tout le produit à l'intérieur d'une seule story — soit une story bien au-delà de 4, soit une
  convention à poser dès s01/s03. Le filet « les tests d'autorisation antérieurs passent sans
  modification » protège contre la régression, pas contre l'ampleur du travail.

### Minors

- **minor — s05, s06, s39, s40 — notes agentiques désynchronisées du PRD.** s05, s06 et s39
  affirment « **Dérivation du PRD** : pas une ligne du tableau du périmètre », alors que le PRD
  contient désormais ces lignes chiffrées. s40 dit que le suivi d'adoption « va un cran au-delà »,
  alors que la ligne « Connexion par lien magique » l'inclut mot pour mot. Le périmètre a été mis à
  jour après ces notes. Sans conséquence sur le découpage, mais une note qui dit « hors tableau »
  invite un agent à traiter la story comme optionnelle.
- **minor — s07 — critère partiellement invérifiable.** « l'affiche sur toutes les pages du site […]
  **y compris celles ajoutées par les stories ultérieures** » : la partie future n'est pas testable à
  la livraison. L'intention (poser le bandeau dans le gabarit commun) appartient aux notes, pas au
  critère.
- **minor — s03 — critère 5 vague.** « chacun des rôles […] accède **exactement aux pages qui lui
  reviennent** » : à s03, presque aucune page n'existe. Seuls les deux exemples qui suivent sont
  testables.
- **minor — s37 — chiffrage et forme des critères.** (a) La liste de dépendances en compte 24, le
  récapitulatif annonce « vingt-trois ». (b) Le critère 3 énumère une vingtaine de types de données
  en une seule case à cocher : un critère = un test, ici c'est vingt. (c) « le site reste navigable
  pendant la génération » n'est pas vérifiable de façon déterministe.
- **minor — s39 — nouvelle table après s37 sans traitement dans l'export.** s39 trace chaque entrée
  en simulation (identité, association, rôle, horodatage). Cette table est postérieure à s37, dont le
  test de complétude casse sur toute table scopée non exportée ou non déclarée exclue. La note de s37
  n'est reprise ni dans les critères ni dans les notes de s39.
- **minor — s26 — critère 7 non observable.** « cette classification est une donnée de configuration
  du tenant, **pas une constante du code** » : la seconde moitié est une propriété du diff. La forme
  testable existe déjà au critère 9.
- **minor — s10 — champ livré sans critère.** `email_destination` est porté par s10 « prévu pour
  s22 » et explicitement inutilisé par les signalements. L'argument (éviter une migration) est
  recevable, mais la charge de preuve retombe sur s22.
- **minor — s35 — étirement à ancrer.** La ligne du PRD dit « convocation, PV, courrier type ». s35 y
  ajoute la génération **en lot** avec **dépôt automatique dans les dossiers nominatifs**, qui n'est
  écrit nulle part au périmètre. Composition naturelle de s26/s27/s31, mais qui mérite une phrase
  d'ancrage.

## Verdict

Le découpage est d'une qualité inhabituelle : couverture nominale complète des 36 lignes du
périmètre, cimetière défendu story par story, ordre de dépendances réellement exécutable, propriété
de chaque brique partagée attribuée nommément, et des notes agentiques qui anticipent les pièges du
boilerplate. Les défauts restants ne sont pas des oublis de surface : ce sont **deux données d'entrée
sans producteur** (adresse postale, historique des échanges) et **une convention transverse non
déclarée** (registre d'actions). La première rend inexécutable l'angle que le PRD désigne comme le
plus différenciant.

Max severity: critical
Stories ready: no
