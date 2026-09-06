# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Troisième passage** — 37 stories, PRD aligné (import initial chiffré 3, volumétrie à 400).
> Reviewer neuf, sans connaissance des passages précédents. Le major du 2e passage (référence en
> avant dans un critère de s01 vers les modules vote/voirie/annonces) n'est plus signalé ; quatre
> nouveaux majors apparaissent, tous locaux à `docs/stories.md`.
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

**Tronc commun — livré à toute association**

| Feature du PRD (core loop) | Couverte par | OK ? |
| --- | --- | --- |
| CMS de pages génériques (créer / modifier / publier / dépublier) | s04 (+ s05, s06, s09 comme types de contenu) | ✅ |
| Permissions par rôle configurables en back-office | s35 | ✅ |
| Connexion par lien magique (validité 4 h) | s03 | ⚠️ partiel — voir major #3 (« flux d'invitation ») |
| Pages publiques + formulaire de contact archivé en BO | s08 (+ s04) | ✅ |
| Bandeau d'alerte global | s07 | ✅ |
| SEO (sitemap, métadonnées, Search Console) | s11 | ✅ |
| Import initial des membres d'une association | s13 | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Coordonnées (profil membre) | s14 | ✅ |
| Questions au bureau, catégories avec routage email | s21 | ✅ |
| Notes internes et historique par membre | s22 | ✅ |
| Import annuel des relevés d'eau + rapport d'erreurs par email | s15 | ✅ |
| Historique de consommation d'eau par membre | s16 | ✅ |
| Signalements avec catégories et statuts | s10 (public) + s20 (membre) | ✅ |
| Publication des analyses d'eau | s09 | ✅ |
| Documents partagés (statuts, PV, ordres du jour) | s29 | ✅ |
| Documents nominatifs en dossiers physiquement séparés | s30 | ✅ |
| Campagnes email Brevo (4 modèles + libre, gabarit commun) | s23 | ✅ |
| Envoi échelonné au-delà de 300 destinataires | s24 | ✅ |
| Relances d'impayés (jusqu'à 3, à 3/2/1 semaines), activables | s27 | ✅ |
| Publipostage PDF pour les membres sans email | s26 | ✅ |
| Groupes de destinataires personnalisés | s25 | ✅ |
| Statistiques d'ouverture et de clic des campagnes | s28 | ✅ |
| Modèles de documents réutilisables | s34 | ✅ |
| Facturation membres : interface + implémentation Pennylane | s17 (interface + manuel) + s18 (Pennylane) | ✅ |
| Redirection de paiement | s19 | ✅ |
| Multi-tenant (Organization, config par tenant, RLS Postgres) | s01 | ✅ |
| Export et portabilité des données | s36 | ⚠️ partiel — voir major #2 |

**Modules activables par tenant**

| Feature du PRD | Couverte par | OK ? |
| --- | --- | --- |
| Vote : interface + implémentation ASL Community | s31 | ✅ |
| Voirie | s32 | ✅ |
| Petites annonces entre membres | s33 | ✅ |

- [x] Chaque feature du tableau « Replicated (core loop) » est livrée par au moins une story —
  **aucune ligne non couverte, aucun défaut critique de couverture.**

## Périmètre

- [x] Aucune story ne réintroduit un élément du cimetière. Vérifié ligne à ligne : électricité / gaz
  (absent), logique de vote (s31 l'exclut explicitement), traitement des paiements (s19 l'exclut et
  le teste), messagerie privée (s33 l'exclut), multi-immeubles / tantièmes (absent), plan B de
  connexion (s03 et s26 l'excluent), appels de fonds (s17 l'exclut), carte interactive (s32 impose
  l'image statique), IA conversationnelle et classification IA (s30 l'exclut), Kanban (absent),
  messagerie dédiée (absent), base par tenant (s01 l'exclut), abstraction « ressource partagée »
  (s32 l'exclut), WordPress (ADR 001).
- [ ] Aucune story ne dépasse le périmètre — une addition mineure : le rate-limiting par IP de s08
  (voir minor #6).

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, pas une couche technique. Aucune story
  « poser la base », « créer la couche API ». s01, souvent le point faible de ce type de découpage,
  est cadrée sur une valeur SuperAdmin réelle (provisionner une association) et exclut explicitement
  la simulation de rôle (s37).
- [ ] Chaque critère d'acceptation peut devenir un test — quelques formulations restent vagues
  (minor #4).
- [x] Notes agentiques présentes et substantielles sur les 37 stories (fichiers du boilerplate,
  pièges cache, pièges Supabase / Resend, cimetière rappelé story par story). **C'est le point fort
  du document.**
- [x] Complexité renseignée ; aucune story à 5 ; les six 4 (s01, s12, s23, s27, s30, s35) énoncent
  chacune leur risque. Répartition du récapitulatif vérifiée : 3 × 1, 15 × 2, 13 × 3, 6 × 4 = 37. ✅

## La liste dans son ensemble

- [x] Pas de cycle : toutes les dépendances déclarées pointent vers un id inférieur (graphe vérifié
  story par story).
- [ ] Pas de référence en avant — **deux faux : s01 et s02 s'appuient sur des rôles livrés par s03**
  (major #1).
- [x] Ids bien formés `s<numéro>-<slug>`, uniques, de s01 à s37, sans trou ni doublon.
- [x] Pas de recouvrement : les frontières risquées sont toutes traitées explicitement (s08 vs s21,
  s10 vs s20, s23 vs s25 vs s27, s26 vs s34, s04 vs s05 vs s06 vs s09, s35 vs s37). Découpage sain.

## Constats

### Majors

- **major — s01 / s02 — référence en avant sur les rôles.** s01 ne dépend de rien mais ses critères
  exigent « le back-office SuperAdmin » et « une requête authentifiée dans le tenant A » ; s02 ne
  dépend que de s01 mais son critère 5 exige un refus pour « un membre non-bureau ». Or s03 déclare
  livrer les rôles : « Les rôles Membre, Bureau, Président(e) et SuperAdmin existent ». s03 dépendant
  de s01, s01 ne peut pas être réordonnée après. Exécutés dans l'ordre des ids, s01 et s02 portent
  des critères non testables au moment de leur livraison. À trancher : soit s01 s'appuie
  explicitement sur le rôle admin du boilerplate (et le dit dans ses notes), soit le critère de rôle
  sort de s01/s02. Ajouter s03 aux dépendances de s02 dans les deux cas.
- **major — s36 — l'export « complet » énumère un sous-ensemble.** Le PRD exige un « export complet
  dans un format ouvert » et la story affirme « elle doit exporter tout ce que le produit stocke »,
  mais le critère 3 ne liste que membres, parcelles, relevés, factures, contenus publiés, documents,
  campagnes, signalements et notes internes. Manquent des données déjà persistées par des stories
  antérieures : **messages de contact (s08), questions au bureau (s21), petites annonces (s33),
  chemins et portails de voirie (s32), groupes de destinataires (s25), résolutions de vote (s31)**.
  Ces stories sont aussi absentes de la liste de dépendances de s36. Un export qui oublie six types
  de données ne répond ni à l'argument anti-verrouillage ni au droit à la portabilité.
- **major — couverture / s03 / s13 — le « flux d'invitation » n'est couvert par aucun critère.** La
  ligne « Connexion par lien magique » du périmètre nomme trois choses : le flux d'invitation,
  l'expiration, l'absence de mot de passe. s03 couvre les deux dernières mais est entièrement *pull*
  (le membre saisit son email de lui-même). s13 crée 300 comptes sans critère d'invitation ni de
  premier contact. **Rien dans les 37 stories ne dit comment 300 propriétaires âgés apprennent qu'ils
  ont un espace.** La ligne du périmètre est couverte en substance, pas dans cet élément-là.
- **major — s23 — la story reporte sa propre scission à `/ks-plan`.** Note agentique : « Si le plan
  dépasse dix tâches, scinder le calcul de cible plutôt que d'étaler l'exécution. » Un plan ne peut
  pas créer une story : pas d'id, pas de branche `feature/<id>`, pas de review séparée (règle « une
  story = une branche = une PR »). La story groupe composition + 4 modèles + mode libre + gabarit
  commun + moteur de variables + aperçu + archivage + les deux cibles standard, soit 9 critères
  d'acceptation. Soit la scission est décidée ici (le calcul de la cible « impayés » et l'archivage
  sont les candidats naturels), soit la phrase disparaît et la story assume son volume.

### Minors

- **minor — s13 — citation erronée du PRD.** Les notes disent « Réf. `PRD` (« Import initial des
  membres d'une association », complexité 2) » et le récapitulatif présente s13 comme un « écart
  assumé » 3 contre 2. Le tableau du PRD affiche **3** pour cette ligne, avec exactement le motif
  invoqué par la story (clé de dédoublonnage non tranchée). Il n'y a donc pas d'écart : la mention
  est à supprimer, sinon elle fera croire à une divergence en review de plan.
- **minor — en-tête — le tableau des réserves est incohérent avec lui-même et avec le PRD.** Le texte
  annonce « Trois réserves du devis » ; le tableau en compte quatre. Le PRD en liste cinq : la
  cinquième (contenu détaillé des 4 modèles d'email et de leurs variables) n'apparaît pas dans le
  tableau, alors qu'elle conditionne s23 et qu'elle est traitée dans ses notes.
- **minor — s27 — statut de blocage contradictoire.** Le tableau des réserves indique que l'accès
  Pennylane bloque « s18, et le déclencheur de s27 ». Les notes de s27 disent l'inverse : « avec la
  seule implémentation manuelle, la story est testable de bout en bout. Ne pas attendre s18 pour la
  livrer. » Un agent lisant l'un ou l'autre ne prendra pas la même décision de démarrage.
- **minor — critères vagues (s01, s09, s13).** « produit un tenant utilisable immédiatement » (s01,
  critère 1) : « utilisable » n'est pas défini. « une publication sans texte s'affiche correctement »
  (s09, critère 3) : « correctement » n'est pas testable en l'état. « aucune ligne de code à écrire
  pour une nouvelle association » (s13, critère 1) : propriété du processus, pas comportement
  observable — s02 traite très bien ce même cas en renvoyant l'exigence à la review plutôt qu'en
  critère.
- **minor — s23 / s24 / s26 / s27 — le lien de désinscription n'a pas de comportement.** Le critère 5
  de s23 impose « un lien de désinscription » dans le pied de page, mais aucune story ne définit ce
  qui se passe quand un membre s'en sert : le désinscrit sort-il de la cible « tous », des relances
  automatiques (s27), du décompte affiché avant envoi, du publipostage (s26) ? Le critère reste
  testable (présence du lien), le trou est fonctionnel.
- **minor — s08 — ajout au périmètre.** Le rate-limiting par IP et par heure n'est demandé ni par le
  PRD ni par le CDC cité. Défendable comme anti-spam, mais il fait entrer un stockage d'adresses IP
  (donnée personnelle, sans règle de rétention) dans une story chiffrée 2, et il n'apparaît pas dans
  l'export de s36. À assumer explicitement ou à retirer.
- **minor — s37 — dépendance non déclarée.** Le critère 6 (« Une action d'écriture faite en
  simulation est attribuée dans l'historique au SuperAdmin ») s'appuie sur l'historique livré par
  s22, que les notes citent d'ailleurs. s22 n'est pas dans la liste de dépendances (s01, s03, s35).
- **minor — s35 — critère conditionnellement vide.** Le critère 6 précise lui-même que « quand s31
  n'est pas encore livrée, ce critère est vide par construction ». Le repli sur un module de test est
  le bon réflexe, mais un critère d'acceptation dont la vacuité est prévue par écrit vaut mieux d'être
  reformulé sur le module de test seul, avec la vérification vote renvoyée à s31.
- **minor — s12 / s03 — frontière de propriété du compte.** Le critère 7 de s12 (« renseigner une
  adresse email […] lui ouvre un compte connectable ; la retirer referme l'accès ») crée et ferme des
  comptes de connexion, ce qui est le domaine de s03. La règle est claire et justifiée, mais aucune
  des deux stories ne dit laquelle possède le cycle de vie du compte — à trancher pour éviter deux
  implémentations.

## Verdict

Le découpage est d'un niveau nettement au-dessus de la moyenne : couverture intégrale des 31 lignes
du périmètre, cimetière respecté ligne à ligne et rappelé dans les stories exposées, aucune
story-couche-technique, graphe de dépendances acyclique, ids conformes, complexités cohérentes avec
les scores du PRD. Les notes agentiques font un vrai travail de prévention (pièges Supabase / Resend,
cache, RLS, DTO trop large). Les quatre majors sont des corrections locales de `docs/stories.md`, pas
une refonte : compléter l'export de s36, clarifier la propriété des rôles pour s01/s02, décider du
flux d'invitation, et trancher la scission de s23 ici plutôt qu'en plan.

Max severity: major
Stories ready: no
