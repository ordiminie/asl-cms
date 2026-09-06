# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Quatrième passage** — 38 stories. Reviewer neuf, sans connaissance des passages précédents.
> Les quatre majors du 3e passage sont levés (export s36 complété par un test de complétude, rôles
> de s01/s02 adossés au boilerplate, flux d'invitation couvert, s23 scindée). **Un critical
> apparaît, introduit par la correction du flux d'invitation elle-même** : les critères ajoutés à
> s03 dépendent de s12, qui dépend de s03.
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

Parcours ligne à ligne des tableaux « Replicated (core loop) » du PRD (31 lignes : 28 tronc commun
+ 3 modules).

| Feature du PRD (core loop) | Couverte par | OK ? |
| --- | --- | --- |
| CMS de pages génériques (créer/modifier/publier/dépublier) | s04 | ✅ |
| Permissions par rôle configurables en back-office | s35 | ✅ |
| Connexion par lien magique (validité 4 h) | s03 | ✅ |
| Pages publiques + formulaire de contact archivé en BO | s04 + s08 | ✅ |
| Bandeau d'alerte global | s07 | ✅ |
| SEO (sitemap, métadonnées, Search Console) | s11 | ✅ |
| Import initial des membres | s13 | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Coordonnées (profil membre) | s14 | ✅ |
| Questions au bureau, catégories avec routage email | s21 | ✅ |
| Notes internes et historique par membre | s22 | ✅ |
| Import annuel des relevés d'eau + rapport d'erreurs email | s15 | ✅ |
| Historique de consommation d'eau par membre | s16 | ✅ |
| Signalements avec catégories et statuts (public + membre) | s10 + s20 | ✅ |
| Publication des analyses d'eau | s09 | ✅ |
| Documents partagés | s29 | ✅ |
| Documents nominatifs en dossiers physiquement séparés | s30 | ✅ |
| Campagnes email Brevo (4 modèles + libre, gabarit commun) | s23 | ✅ |
| Envoi échelonné au-delà de 300 destinataires | s24 | ✅ |
| Relances d'impayés (3, à 3/2/1 semaines), activables | s27 | ✅ |
| Publipostage PDF pour les membres sans email | s26 | ✅ |
| Groupes de destinataires personnalisés | s25 | ✅ |
| Statistiques d'ouverture et de clic | s28 | ✅ |
| Modèles de documents réutilisables | s34 | ✅ |
| Facturation membres : interface + implémentation Pennylane | s17 + s18 | ✅ |
| Redirection de paiement | s19 | ✅ |
| Multi-tenant (Organization, config par tenant, RLS) | s01 + s02 | ✅ |
| Export et portabilité des données | s36 | ✅ |
| Vote : interface + implémentation ASL Community *(module)* | s31 | ✅ |
| Voirie *(module)* | s32 | ✅ |
| Petites annonces entre membres *(module)* | s33 | ✅ |

- [x] Chaque feature du tableau « Replicated (core loop) » est livrée par au moins une story —
  **31/31, aucun trou.**

## Périmètre

- [x] Aucune story ne réintroduit un élément du cimetière. Les 16 entrées ont été vérifiées ;
  plusieurs stories nomment leur propre exclusion (s19 paiement, s26 « pas un plan B de connexion »,
  s30 pas de classification IA, s31 aucune logique de vote, s32 pas de carte interactive, s33 pas de
  messagerie privée, s01 pas de base par tenant). Le « renseigner un email ouvre un compte » de s12
  n'est pas un plan B : c'est un vrai email qui arrive, correctement traité.
- [~] Aucune story ne dépasse le périmètre — quatre dérivations documentées (s05 actualités, s06
  présentation-bureau, s37 simulation-rôle, s38 invitations de lancement) sont rattachées aux
  critères de succès du PRD, au « Why kill it » ou aux Target users, et sont acceptables. Un ajout
  auto-déclaré (le limiteur de débit de s08) est hors PRD **et** hors CDC.

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, pas une couche technique. s01 est le cas
  limite (RLS, convention de scoping) mais livre une valeur réelle côté SuperAdmin et correspond à
  une ligne du périmètre — ce n'est pas un défaut.
- [~] Chaque critère d'acceptation peut devenir un test — quelques-uns restent composés ou faiblement
  observables (voir Constats).
- [x] Notes agentiques présentes et utiles sur les 38 stories : fichiers du boilerplate nommés,
  pièges nommés (Resend→Brevo, Supabase→local, `'use cache'`, `pnpm test --run`), rappels du
  cimetière en ligne.
- [x] Complexité renseignée ; aucun 5 non scindé ; les cinq 4 (s01, s12, s27, s30, s35) énoncent
  chacun leur risque.

## La liste dans son ensemble

- [~] Ordre de dépendances exécutable — le graphe déclaré est acyclique (toute dépendance pointe vers
  un id inférieur), **mais s03 porte des critères qui exigent le modèle de s12, et s12 dépend de
  s03.** Non exécutable en l'état.
- [x] Ids bien formés (`s<numéro>-<slug>`), uniques, s01→s38, aucun doublon, aucune collision de
  slug.
- [~] Aucun recouvrement ni doublon — un vrai conflit de propriété sur le modèle de catégories
  (s10 / s21).

## Constats

### Critical

- **critical — s03** — les critères d'acceptation font une **référence en avant vers s12, qui dépend
  elle-même de s03**. Les critères 5 (« Le bureau envoie une invitation à un membre **depuis sa
  fiche** »), 6 (« Le bureau voit **sur la fiche** si une invitation a été envoyée… ») et 7
  (« Inviter un membre **sans adresse email** est refusé ») opèrent tous sur la fiche membre et sur
  l'attribut « sans email », que les notes de s12 revendiquent explicitement : *« s12 possède la
  fiche membre et son attribut "a une adresse email" »* et *« Le marquage "joignable par courrier
  uniquement" est un attribut du modèle membre, porté ici »*. s03 étant livrée avant s12, un agent
  exécutant s03 devrait inventer une fiche membre — produisant exactement le modèle en double que
  les deux stories s'interdisent. La frontière est décrite en prose mais non résolue dans l'ordre.
  **Correction** : sortir les critères d'invitation (5-7) de s03 vers s12 ou une story postérieure,
  ou faire précéder s03 par s12 et réduire s03 au flux d'authentification.

### Majors

- **major — s03** — groupe trois valeurs distinctes sous un seul id et une seule complexité 3 :
  (a) l'authentification par lien magique, (b) le flux d'invitation et son suivi, (c) la création des
  quatre rôles fixes. Neuf critères d'acceptation — exactement le seuil retenu par les auteurs pour
  scinder s23 (*« la story groupant auparavant neuf critères »*). La règle est appliquée de façon
  incohérente, et la complexité 3 est le score du PRD pour le lien magique seul, pas pour les trois
  ensemble.
- **major — s10 / s21** — propriété du modèle de catégories administrables en recouvrement. s10
  (id 10) livre déjà *« Les catégories de signalement … sont administrables par le bureau, pas figées
  dans le code »*, mais s21 (id 21) se déclare conceptrice du modèle générique : *« Le modèle de
  catégories ({nom, email_destination?}, plafond 10, administrable) est explicitement prévu pour être
  réutilisé par les petites annonces (s33) … Le concevoir générique ici »*. Quand s21 s'exécute, un
  modèle de catégories existe déjà. Soit s10 possède l'abstraction (et s21/s33 la réutilisent), soit
  s10 doit dire qu'elle livre un modèle délibérément local — en l'état, deux implémentations sont
  l'issue probable.

### Minors

- **minor — s01** — le premier critère est composé : création du tenant + écriture/lecture scopée +
  service sur son propre domaine font trois tests en un, et le routage par domaine et par tenant
  (tranche non triviale, dont dépend aussi le dernier critère de s11) n'apparaît nulle part ailleurs
  dans le découpage.
- **minor — s36** — le critère 3 exige que l'archive contienne *« résolutions et résultats de vote »*,
  mais s31 est délibérément exclue des dépendances et les notes précisent que les données de vote
  n'entrent *« dès que le module est livré »*. Tel quel, le critère 3 ne peut pas passer à la
  livraison ; le critère opérant est le test de complétude (critère 4). Contradiction entre le
  critère et la note.
- **minor — s36** — l'énumération et la liste de dépendances omettent des données par tenant
  persistées par des stories antérieures : `s34` (modèles de documents) et `s07` (bandeau d'alerte).
  Le test de complétude échouerait dessus. Auto-corrigeant par construction, mais la liste devrait
  être honnête.
- **minor — s36** — 18 dépendances, tâche de fond, archive en flux sur un VPS à 4 Go, export
  individuel par membre, test de complétude : cela se lit comme un 4 et ne porte aucun risque
  énoncé. Soit repasser le score, soit énoncer le risque.
- **minor — s08** — le limiteur de débit est un ajout auto-déclaré au périmètre (*« Ajout assumé au
  périmètre : le limiteur de débit n'est demandé ni par le PRD ni par le CDC »*), compteur d'IP
  hachée et purge à 24 h compris. Bien argumenté et peu coûteux, mais c'est du périmètre que le
  cadrage n'a pas autorisé : cela relève d'un amendement au PRD, pas des notes d'une story.
- **minor — s35** — ne déclare que `s03` en dépendance alors que son critère 3 affirme que *« la
  matrice par défaut reproduit exactement le comportement livré par les stories précédentes »*,
  c'est-à-dire s04→s34. La conception par registre d'actions justifie le couplage lâche, mais la
  liste de dépendances sous-estime ce qui doit exister pour rendre ce critère testable.
- **minor — s03** — le critère 5 (*« un email qui explique ce qu'est son espace, ce qu'il y
  trouvera »*) est une affirmation de qualité rédactionnelle ; seule la présence du lien est
  mécaniquement testable.
- **minor — couverture** — s05, s06, s37 et s38 ne sont pas des lignes du tableau du périmètre.
  Chacune documente sa dérivation depuis un critère de succès du PRD, le « Why kill it » ou les
  Target users, et chacune est défendable ; signalé pour que la dérive de périmètre reste visible
  plutôt que silencieuse.

## Ce qui est notablement juste

Deux points que la revue signalerait autrement : le découpage distingue systématiquement la
facturation **membres** de la facturation **plateforme** (s01, s17), et les rappels du cimetière sont
inscrits story par story plutôt que supposés acquis.

## Verdict

Max severity: critical
Stories ready: no
