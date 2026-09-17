# Revue du découpage en stories — ASL-CMS (Lp)

> Revue en contexte neuf de `/workspace/docs/stories.md` face à `/workspace/docs/prd.md`, au format de `/workspace/templates/stories-review-checklist.md`. Ce passage fait suite à l'ajout de **s01b-logo-association** et à la reformulation de **s02** (commit 43e1be0). Sur l'ensemble des 44 stories, il fait ressortir 4 défauts majeurs et 14 mineurs, dont plusieurs viennent de ces deux changements.

## Perimeter coverage

J'ai parcouru le tableau du PRD ligne par ligne, et non la liste des stories.

| Fonctionnalité du PRD (tronc commun)                           | Couverte par                                                             | OK?                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| CMS de pages génériques                                        | s04                                                                      | ✅                                   |
| Attribution des rôles aux membres                              | s14                                                                      | ✅                                   |
| Permissions par rôle configurables                             | s37 (registre posé en s03)                                               | ✅                                   |
| Connexion par lien magique 4 h + invitation + suivi d'adoption | s03, s15, s42                                                            | ✅                                   |
| Pages publiques + formulaire de contact archivé                | s08                                                                      | ✅                                   |
| Navigation du site public                                      | s04b                                                                     | ✅                                   |
| Identité visuelle (logo, teinte, favicon)                      | s01b (logo, favicon), s02 (teinte), s25 (logo dans l'en-tête des emails) | ✅ (écart sur le favicon, voir I-03) |
| Limitation de débit des formulaires publics                    | s08, s10                                                                 | ✅                                   |
| Actualités                                                     | s05                                                                      | ✅                                   |
| Présentation du bureau                                         | s06                                                                      | ✅                                   |
| Désinscription et classification                               | s25, s27                                                                 | ✅                                   |
| Bandeau d'alerte                                               | s07                                                                      | ✅                                   |
| SEO                                                            | s11                                                                      | ✅                                   |
| Import initial des membres                                     | s13                                                                      | ✅                                   |
| Modèle membre ↔ parcelle daté                                  | s12                                                                      | ✅                                   |
| Coordonnées                                                    | s16 (+ saisie par le bureau en s12)                                      | ✅                                   |
| Questions au bureau                                            | s23                                                                      | ✅                                   |
| Notes internes et historique                                   | s24                                                                      | ✅                                   |
| Import annuel des relevés d'eau + rapport                      | s17                                                                      | ✅                                   |
| Historique de consommation                                     | s18                                                                      | ✅                                   |
| Signalements                                                   | s10, s22                                                                 | ✅                                   |
| Analyses d'eau                                                 | s09                                                                      | ✅                                   |
| Documents partagés                                             | s31                                                                      | ✅                                   |
| Documents nominatifs séparés                                   | s32                                                                      | ✅                                   |
| Campagnes email Brevo                                          | s25                                                                      | ✅                                   |
| Envoi échelonné + budget quotidien                             | s26                                                                      | ✅                                   |
| Relances d'impayés                                             | s29                                                                      | ✅                                   |
| Publipostage PDF                                               | s28                                                                      | ✅                                   |
| Groupes de destinataires                                       | s27                                                                      | ✅                                   |
| Statistiques de campagnes                                      | s30                                                                      | ✅                                   |
| Modèles de documents (unitaire + lot)                          | s36                                                                      | ✅                                   |
| Facturation membres : interface + Pennylane                    | s19, s20                                                                 | ✅                                   |
| Redirection de paiement                                        | s21                                                                      | ✅                                   |
| Multi-tenant                                                   | s01                                                                      | ✅                                   |
| Export individuel d'un membre                                  | s40                                                                      | ✅                                   |
| Simulation de rôle SuperAdmin                                  | s41                                                                      | ✅                                   |
| Export et portabilité                                          | s38, s39                                                                 | ✅                                   |
| Module Vote                                                    | s33                                                                      | ✅                                   |
| Module Voirie                                                  | s34                                                                      | ✅                                   |
| Module Petites annonces                                        | s35                                                                      | ✅                                   |

- [x] Toutes les fonctionnalités du tableau « Replicated (core loop) » sont livrées par au moins une story : **40 sur 40**, aucun trou.

## Scope

- [x] Aucune story ne ramène un élément du cimetière. J'ai vérifié chaque entrée : électricité/gaz, logique de vote, paiement, messagerie privée, multi-immeubles, plan B de connexion, appels de fonds, carte interactive, vote temps réel, IA, Kanban, messagerie dédiée, base par tenant, abstraction « ressource partagée », WordPress.
- [x] Aucune story ne dépasse le périmètre. Seule exception, déclarée : s39. En revanche, s01b et s02 **restreignent** le modèle de rôles du PRD sans décision de `/ks-prd` (I-02).

## Story quality

- [x] Chaque story est une tranche livrable de bout en bout. s39 est une dérogation déclarée (I-18). s01b porte bien le stockage sur une vraie valeur, le logo : ce n'est pas une couche technique déguisée.
- [ ] Chaque critère peut devenir un test : non. s12 c3 n'est pas testable à la livraison (I-04), s01b c6 est ambigu sur le favicon (I-03), l'acteur de s14 n'est pas nommé (I-14).
- [ ] Notes agentiques présentes et utiles : présentes, mais plusieurs sont devenues fausses depuis s01b ou renvoient à une brique remplacée (I-08, I-09, I-10, I-11).
- [x] Complexité notée, aucune story à 5, chaque story à 4 explique son risque. Je recompte bien 3 + 18 + 15 + 8 = 44.

## The list as a whole

- [ ] Ordre de dépendances exécutable : aucun cycle, mais une référence en avant structurelle. s01b et s02 créent des actions soumises à autorisation avant que le registre de s03 n'existe (I-01). Il manque aussi une dépendance déclarée : s17 → s13 (I-05).
- [x] Ids bien formés, uniques et stables. `s01b` et `s04b` utilisent le suffixe lettre qu'autorise `AGENTS.md`.
- [x] Pas de chevauchement entre stories. Seul flou : la sauvegarde du stockage n'a pas de propriétaire (I-12).

## Findings

### Majeurs

**I-01 — major — s01b, s02, s03, s37 : deux stories créent des actions autorisées avant que le registre existe.**

- **La règle :** toute action soumise à autorisation doit être « déclarée au registre créé par s03 ». s37 part de ce principe : elle se dit à 4 parce qu'elle « n'instrumente rien rétroactivement ».
- **Le problème :** s01b (téléverser un logo) et s02 (modifier les paramètres) créent chacune une action de ce type, mais passent avant s03. Elles ne peuvent donc pas la déclarer.
- **Le trou :** ni s03 ni s37 ne prévoit de déclarer ces actions après coup.
- **La conséquence :** les réglages de l'association n'apparaîtront pas dans la matrice de s37. Soit la ligne « Permissions configurables » est tenue à moitié, soit s37 doit faire le travail rétroactif qu'elle s'interdit.
- **À corriger :** donner à s03 un critère qui reprend les actions de s01b et s02 dans le registre.

**I-02 — major — s01b c8, s02 c6 (et s03 c6, s33, s08) : les réglages sont réservés à la présidente, contrairement au PRD.**

- **Ce que disent les stories :** le logo et tous les paramètres (adresses de notification, teinte) sont réservés à `owner` et au SuperAdmin ; un membre du bureau est refusé.
- **Ce que dit le PRD :** les prérogatives de la présidente se limitent « aujourd'hui » aux résolutions de vote et à la publication des résultats et du PV. Le bureau « doit pouvoir tout éditer sans intervention du prestataire ».
- **Les contradictions dans le document :**
  - s03 c6 dit qu'« un Bureau accède » au back-office, ce qui entre en conflit avec les refus testés en s01b et s02.
  - La note de s33 dit encore que la restriction présidente est « la **seule** action réservée du produit ».
  - s01b affirme que s03 « renomme le rôle Bureau (`admin` → `board`, décision du 17 septembre 2026) », mais s03 ne porte cette décision ni dans ses critères ni dans ses notes.
- **À corriger :** changer le modèle de rôles est une décision de `/ks-prd`, que le document lui-même exige pour s07. Il faut soit remonter l'arbitrage, soit aligner s01b et s02 sur le bureau. Dans les deux cas, mettre ensuite à jour s03 c6 et les notes de s03 et s33.

**I-03 — major — s01b c6 : le favicon ne suit pas le PRD.**

- **Ce que dit le PRD :** « le logo et le favicon sont **deux fichiers fournis par l'association** ».
- **Ce que fait s01b :** seul un logo se téléverse. c6 dit seulement que le favicon « dépend de l'association appelée », avec un repli quand il n'y a pas de logo. Cela laisse entendre que le favicon est tiré du logo, sans le dire.
- **La conséquence :** le critère ne dit pas d'où vient le favicon d'une association qui a un logo. Un agent peut l'implémenter de deux façons, et aucune ne correspond au « deux fichiers » du PRD.
- **À corriger :** ajouter le téléversement d'un favicon distinct, ou faire modifier la ligne du PRD par `/ks-prd`.

**I-04 — major — s12 c3 : le critère parle de données qui n'existent pas encore.**

- **Le critère :** « Une donnée datée d'avant la vente (relevé, facture, document) reste rattachée à l'ancien propriétaire… vérifié par un test sur une parcelle vendue ».
- **Le problème :** relevés, factures et documents n'existent qu'à partir de s17, s19 et s32. À la livraison de s12, le critère ne peut pas être testé tel qu'il est écrit.
- **Le précédent :** le document juge lui-même ce défaut en s01 (« un critère qui les nommerait ici serait intestable au moment de la livraison »).
- **À corriger :** reformuler sur la fonction de s12 qui donne le propriétaire d'une parcelle à une date, et laisser le test par type de ressource à s18, s19 et s32.

### Mineurs

**I-05 — minor — s17 : dépendance à s13 non déclarée.** La note dit « Réutiliser le motif d'import posé par s13… c'est aussi pourquoi s13 est ordonnée avant s17 », mais la section Dependencies et le récapitulatif ne listent que `s02, s12`.

**I-06 — minor — s24 : note factuellement fausse.** Elle dit que la story est « ordonnée avant les questions (s23) », alors que s24 vient après s23.

**I-07 — minor — s41 : deux erreurs dans la note.**

- « Ne pas confondre avec le changement de rôle d'un utilisateur (s37) » : l'attribution de rôles, c'est s14, pas s37.
- « ici rien n'est modifié, c'est une lecture » contredit c7 (une écriture faite en simulation est attribuée au SuperAdmin) et le PRD (« Écritures tracées au SuperAdmin »).

**I-08 — minor — s04 : notes devenues fausses depuis s01b.**

- « Faire trancher l'adaptateur de stockage en `/ks-architect` avant `/ks-plan` » : c'est déjà décidé par l'ADR 004 et livré par s01b.
- « Trois briques neuves s'y rencontrent (… l'adaptateur de stockage) » : l'adaptateur n'est plus neuf en s04.

**I-09 — minor — s32 : note devenue fausse depuis s01b.** Elle parle de « l'adaptateur de stockage que s31 pose ». Il est posé par s01b ; s31 n'ajoute que la lecture authentifiée.

**I-10 — minor — s04b : note devenue fausse depuis s01b.** « Ce que l'en-tête porte d'association — logo et teinte — vient de s02 » : le logo vient désormais de s01b.

**I-11 — minor — s26 : la note renvoie à une brique retirée.** Elle demande d'évaluer Inngest (`docs/inngest.md`). Or l'ADR 006 (`/workspace/docs/decisions/006-planificateur-taches-postgres.md`) remplace Inngest par la table `scheduled_job` et un cron système.

**I-12 — minor — s01b, s13, s31 : la sauvegarde du stockage n'a pas de propriétaire.** s01b dit qu'elle « devra être couverte avant l'import des vraies données (voir s13) », mais s13 n'en parle pas. s31 la mentionne aussi (« à prendre en compte dès cette story »). Aucune story ne la porte en critère.

**I-13 — minor — s02 : la note contredit le critère 1.**

- La note dit que le registre ne déclare que les clés utilisées et qu'« afficher en back-office des réglages qui ne font encore rien est exclu ». Pourtant c1 déclare l'adresse de contact et l'adresse du responsable forage, que seules s08 et s10 utiliseront.
- c2 prouve les types nombre et booléen, qui n'ont encore aucun usage. En parallèle, les stories suivantes auront besoin de types absents de la liste : texte libre (s15), URL (s21, s33), liste de statuts (s19).

**I-14 — minor — s14 : l'acteur n'est pas l'un des rôles de s03.** « Administrateur d'une association » ne fait pas partie des quatre rôles de s03 (Membre, Bureau, Président(e), SuperAdmin). c1 et c3 dépendent de qui peut attribuer les rôles.

**I-15 — minor — s01 c5 : le rôle de l'administrateur initial n'est pas précisé.** Si ce n'est pas `owner`, l'administrateur d'une association nouvellement créée ne peut pas accéder à ses propres réglages (s01b, s02) avant s14. C'est lié à I-02.

**I-16 — minor — s38 : les fichiers d'identité échappent à l'export.** L'archive ne liste pas le logo, et s38 ne déclare pas s01b. De plus, s39 compare des **tables** : un fichier posé sur le disque sous le répertoire de l'association échappe au garde-fou de complétude.

**I-17 — minor — récapitulatif et s42 : chiffres plus à jour.**

- « Trois écarts avec les scores du PRD » oublie l'identité visuelle : le PRD la note 2, elle est maintenant portée par s01b (3) et s02 (3).
- La note de s42 parle des « 42 stories précédentes » ; il y en a maintenant 43.

**I-18 — minor — s39 : story transverse sans valeur visible pour un utilisateur.** La dérogation est déclarée et bornée ; je la note seulement pour mémoire.

**I-19 — minor — s03, s15 : le logo manque dans les emails transactionnels.** Le PRD dit que « les gabarits d'email… leur en-tête porte le logo ». Seule s25 (campagnes) l'exige. L'invitation (s15) porte seulement le nom de l'association, et le lien magique (s03) rien du tout.

## Verdict

Le périmètre est couvert à 100 % et le cimetière est respecté. En revanche, les ajouts du 17 septembre ont introduit ou révélé quatre défauts majeurs, dont trois touchent directement **s01b et s02**, les prochaines stories à passer en `/ks-plan` :

- les actions de s01b et s02 sont hors du registre ;
- la règle d'accès réservée à la présidente contredit le PRD et s03 ;
- le favicon ne suit pas le PRD.

Aucun n'est critique au sens strict de la grille. Je rends pourtant `no` par jugement : planifier s01b dans cet état fige dans le code une règle d'accès et une forme de favicon qui ne correspondent pas au PRD.

Max severity: major
Stories ready: no
