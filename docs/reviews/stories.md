# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `docs/stories.md` (40 stories) face à `docs/prd.md`, par le subagent
> `stories-reviewer` (skill `stories-review` préchargée). Chaque constat est classé
> critical / major / minor.
>
> **Huitième passage** — premier des deux passages de confirmation demandés. **Le critical du 7e
> passage est levé** : la ligne « Publipostage PDF » repasse en ✅, l'adresse postale ayant un
> producteur (s12 saisie bureau, s13 import). Quatre majors apparaissent, tous des trous d'origine
> et non des régressions : trois données métier sans définition (prédicat « impayé », échéance de
> facture, budget d'envoi quotidien) et une capacité absente (attribution des rôles).
>
> Document de cadrage : committé sur la branche par défaut, contrairement à
> `docs/reviews/<id>.md` qui voyage avec sa branche de story.

## Couverture du périmètre

**Tronc commun — livré à toute association**

| Feature du PRD (core loop) | Couverte par | OK ? |
| --- | --- | --- |
| CMS de pages génériques (créer/modifier/publier/dépublier) | s04 | ✅ |
| Permissions par rôle configurables en back-office | s36 | ⚠️ partiel — voir major #4 |
| Connexion par lien magique (4 h) + flux d'invitation + suivi d'adoption | s03, s14, s40 | ✅ |
| Pages publiques + formulaire de contact archivé en BO | s04, s08 | ✅ |
| Limitation de débit des formulaires publics | s08 (réutilisé par s10) | ✅ |
| Actualités de l'association (mini-blog daté) | s05 | ✅ |
| Présentation du bureau (fiches listables et éditables) | s06 | ✅ |
| Bandeau d'alerte global | s07 | ✅ |
| SEO (sitemap, métadonnées, Search Console) | s11 | ✅ |
| Import initial des membres d'une association | s13 | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Coordonnées (profil membre) | s15 (+ saisie bureau en s12) | ✅ |
| Questions au bureau, catégories avec routage email | s22 (modèle de catégories en s10) | ✅ |
| Notes internes et historique par membre | s23 | ✅ |
| Import annuel des relevés d'eau + rapport d'erreurs email | s16 | ✅ |
| Historique de consommation d'eau par membre | s17 | ✅ |
| Signalements avec catégories et statuts (public + membre) | s10, s21 | ✅ |
| Publication des analyses d'eau | s09 | ✅ |
| Documents partagés | s30 | ✅ |
| Documents nominatifs en dossiers physiquement séparés | s31 | ✅ |
| Campagnes email Brevo (4 modèles + libre, gabarit commun) | s24 | ✅ |
| Envoi échelonné au-delà de 300 destinataires | s25 | ⚠️ voir major #3 |
| Relances d'impayés (3, à 3/2/1 semaines), activables par tenant | s28 | ⚠️ voir majors #1 et #2 |
| Publipostage PDF pour les membres sans email | s27 | ✅ |
| Groupes de destinataires personnalisés | s26 | ✅ |
| Statistiques d'ouverture et de clic | s29 | ✅ |
| Modèles de documents réutilisables | s35 | ✅ |
| Facturation membres : interface + implémentation Pennylane | s18, s19 | ⚠️ voir major #1 |
| Redirection de paiement | s20 | ✅ |
| Multi-tenant (Organization, config par tenant, RLS Postgres) | s01, s02 | ✅ |
| Export individuel d'un membre (droit d'accès RGPD) | s38 | ✅ |
| Simulation de rôle SuperAdmin | s39 | ✅ |
| Export et portabilité des données | s37 | ✅ |

**Modules activables par tenant**

| Feature du PRD | Couverte par | OK ? |
| --- | --- | --- |
| Vote : interface + implémentation ASL Community | s32 | ✅ |
| Voirie | s33 | ✅ |
| Petites annonces entre membres | s34 | ✅ |

- [x] Chaque feature du tableau « Replicated (core loop) » est livrée par au moins une story —
  **aucune ligne orpheline.** Trois lignes sont couvertes mais avec un trou fonctionnel à
  l'intérieur (majors #1 à #4).

## Périmètre

- [x] Aucune story ne réintroduit un item du cimetière. Vérifié un par un : électricité / gaz
  (absent), logique de vote (s32 la refuse explicitement), traitement des paiements (s20 + test de
  schéma de s19), messagerie privée entre membres (s34 la refuse ; s22 est membre → bureau, pas
  membre → membre), multi-immeubles / tantièmes (absent), plan B de connexion (s12, s27 et s40
  répètent le refus), carte interactive (s33 : image statique), IA (s31, absente ailleurs), Kanban
  (absent), messagerie dédiée par association (absente), base par tenant (s01 : partagée + RLS),
  abstraction « ressource partagée » (s33 la refuse), WordPress (s04 + ADR 001).
- [ ] Aucune story ne dépasse le périmètre — un ajout non traçable au PRD : la classification
  *facultative / statutaire* et sa machinerie de désinscription (règle transverse + s24 + s26).
  Défendable juridiquement, mais c'est une surface de configuration que le PRD n'a jamais demandée
  (minor).

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, pas une couche technique. Aucune story
  « poser la base », « créer la couche API ». Les deux candidates les plus risquées — s01 (tenant +
  routage domaine + drapeaux) et s03 (auth + rôles + registre d'actions) — encapsulent de
  l'infrastructure dans une tranche visible par un utilisateur et argumentent le regroupement.
  Accepté.
- [ ] Chaque critère peut devenir un test — quatre critères ne le peuvent pas en l'état.
- [x] Notes agentiques présentes et utiles. Constamment solides : chemins du boilerplate, pièges de
  cache et de prerender, substitutions Supabase → local et Resend → Brevo, rappels du cimetière story
  par story.
- [x] Complexité chiffrée ; **aucune 5** ; les six 4 (s01, s12, s28, s31, s36, s37) énoncent chacune
  leur risque dans un paragraphe dédié. Les deux écarts avec les scores du PRD (s26 3 contre 2, s37 4
  contre 3) sont documentés plutôt que lissés.

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable. Les 40 listes ont été parcourues : chaque arête pointe vers un
  id strictement inférieur, donc ni cycle ni référence en avant n'est structurellement possible. Les
  renvois à l'intérieur des critères pointent aussi vers l'amont (s39 → s37 ; s36 et s37 évitent
  délibérément s32).
- [x] Ids bien formés (`s01`…`s40`), uniques, courts, stables, et cohérents entre les titres et le
  tableau récapitulatif.
- [x] Aucun recouvrement. Les cinq paires candidates sont chacune arbitrées par écrit avec un
  propriétaire : coordonnées (s12 bureau / s15 self-service), signalements (s10 public / s21 membre),
  catégories (propriété s10, réutilisée par s22 et s34), ciblage (s24 « tous » / s26 impayés et
  groupes), export (s37 association / s38 membre), invitation (s14 unitaire / s40 masse).

## Constats

### Majors

- **major — s18 (impact s20, s26, s28) — le prédicat « impayé » n'est défini nulle part.** s18
  interdit de modéliser le statut en booléen ou en énumération fermée (« statuts remontés tels
  quels »), et pourtant s20 (« Une facture déjà réglée n'affiche pas de bouton »), s26 (« La cible
  "membres en impayé" … calculée à partir du service de facturation ») et s28 (« un membre en impayé
  reçoit jusqu'à 3 relances ») consomment tous une dérivation binaire de ces statuts opaques. Aucune
  story ne possède ce mappage, et la règle « paramétrable, jamais codé en dur » du PRD interdit qu'il
  soit une constante implicite. Trois critères d'acceptation ne sont pas implémentables en l'état.
- **major — s28 (impact s18) — le calendrier de relance n'a pas d'ancre.** « 3 relances espacées de
  3, 2 puis 1 semaine » — comptées à partir de quelle date ? Le modèle de facture de s18 est (date,
  objet, montant, statut), sans échéance, et les notes de s28 concèdent elles-mêmes que « le champ
  Pennylane qui fait foi pour "impayé" et sa date n'est pas connu ». Le premier critère ne peut pas
  devenir un test tant que s18 ne porte pas d'échéance.
- **major — s25 — « sans qu'aucune journée ne dépasse le quota » promet plus que la story ne peut
  tenir.** Le plafond Brevo de 300/jour est **par compte et par jour, tous envois confondus** :
  invitations de s14, campagnes de s24, relances de s28, lancement de s40 — et potentiellement
  plusieurs tenants sur le même compte Brevo. Scinder chaque campagne indépendamment ne borne pas le
  total quotidien. Soit la story possède un budget d'envoi journalier et le dit dans un critère, soit
  le critère doit être restreint à une campagne isolée.
- **major — couverture (s03 / s36 / s39) — rien ne permet d'attribuer un rôle.** s03 dit que les
  quatre rôles « sont attribuables à un utilisateur » sans écran ni propriétaire ; s36 ne livre que
  la matrice rôle × action ; les notes de s39 renvoient à s36 pour « le changement de rôle d'un
  utilisateur », que les critères de s36 ne livrent pas. Conséquence : après l'import de 400 membres
  par s13, **aucune story ne dit comment le premier membre du Bureau ou la Présidente est
  désigné(e)** — ce qui contredit le critère de succès « une deuxième association est provisionnée
  sans écrire une ligne de code » et la persona Bureau qui « change tous les quelques années ».
  Limite du critical : si l'on lit la ligne de périmètre « Permissions par rôle configurables en
  back-office » comme incluant l'attribution utilisateur ↔ rôle, c'est une feature du périmètre non
  couverte.

### Minors

- **minor — s03** — le critère 7 se termine sur une propriété du code (« sans code d'autorisation
  écrit à la main dans la page ») qui ne peut pas devenir un test. La convention du document (s02,
  s13, s14) est de déplacer ce type d'énoncé en « à vérifier en review, pas en test ».
- **minor — s40** — « sans promettre un accès qu'ils n'auront pas » (critère 2) est un jugement
  éditorial, pas un test. s14 traite le point identique correctement, en le renvoyant à la review.
- **minor — s40 vs s24 / s26** — « la somme des destinataires email et des courriers produits égale
  l'effectif de l'association » ignore l'exclusion totale des désinscrits introduite par s24. La
  nature de la campagne de lancement (facultative ou statutaire) n'est jamais énoncée : le critère de
  complétude et la règle de désinscription peuvent se contredire.
- **minor — s24 / s26 + règles transverses** — la classification facultative / statutaire est un
  ajout au périmètre du PRD. Bien argumentée et marquée comme configuration, mais rien dans le
  tableau ni dans le cimetière ne la couvre : à rattacher au PRD ou à reconnaître explicitement comme
  un ajout.
- **minor — s31** — la dépendance sur s30 n'est justifiée nulle part dans ses notes ; aucun de ses
  critères ne concerne les documents partagés. Énoncer la réutilisation (route de service, adaptateur
  de stockage) ou retirer l'arête.
- **minor — tableau des réserves (en tête)** — il indique que l'absence de fichier exemple des
  relevés « bloque le parseur de s16 ». Elle bloque aussi s17, et donc l'angle n°1 du PRD (la
  ressource individuelle mesurée). La portée est sous-estimée dans le seul tableau qu'on consulte
  avant de planifier.
- **minor — s19** — le critère 3 (« le rapprochement … suit la clé retenue ») est paramétré sur un
  arbitrage qui n'a pas eu lieu ; il ne peut pas devenir un test tant que la clé n'est pas choisie.
  Acceptable vu la condition suspensive, mais la story devrait le dire.
- **minor — s10** — la story livre `email_destination`, champ exercé par aucun de ses propres
  critères (prouvé plus tard, en s22). Un champ livré non testé par sa story propriétaire ; la
  justification (éviter une migration) est saine, mais s10 devrait porter au moins un critère dessus
  ou énoncer que sa preuve vit en s22.

## Verdict

Max severity: major
Stories ready: no
