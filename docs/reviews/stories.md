# Stories Review — ASL-CMS (Lp)

> Relecture à froid de `/workspace/docs/stories.md` (44 stories) par rapport à `/workspace/docs/prd.md`. Chaque problème est classé : critique, majeur ou mineur.
> s01 est déjà livrée (`docs/reviews/s01-provisionner-association.md` : `Ship allowed: yes`). Je ne rediscute donc pas sa taille ni son contenu.

**En bref : aucun problème critique, quatre majeurs, cinq mineurs.** Toutes les lignes du périmètre sont couvertes et aucune story ne reprend un élément du cimetière. Les stories sont prêtes au sens de la règle. Je conseille quand même de corriger M3 avant `/ks-plan s03`, et M1 avant `/ks-plan s24`.

## Perimeter coverage

| PRD feature (core loop)                                         | Covered by                          | OK?                                  |
| --------------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| CMS de pages génériques                                         | s04                                 | ✅                                   |
| Attribution des rôles aux membres (+ verrou anti-blocage)       | s14                                 | ✅                                   |
| Permissions par rôle configurables en BO                        | s03 (registre), s37                 | ✅                                   |
| Connexion par lien magique 4 h (+ invitation, suivi d'adoption) | s03, s15, s42                       | ✅                                   |
| Pages publiques + formulaire de contact archivé en BO           | s04, s08                            | ✅                                   |
| Navigation du site public (menu, pied de page)                  | s04b                                | ✅                                   |
| Identité visuelle (logo, teinte, favicon, en-tête des emails)   | s01b, s02, s03 c9, s15 c2, s25 c3   | ✅                                   |
| Limitation de débit des formulaires publics                     | s08 c5-c6, s10 c9                   | ✅                                   |
| Actualités                                                      | s05                                 | ✅                                   |
| Présentation du bureau                                          | s06                                 | ✅                                   |
| Désinscription et classification des communications             | s25, s27                            | ✅                                   |
| Bandeau d'alerte global                                         | s07                                 | ✅                                   |
| SEO                                                             | s11                                 | ✅                                   |
| Import initial des membres                                      | s13                                 | ✅ (voir M4)                         |
| Modèle membre ↔ parcelle daté                                   | s12, s17, s18, s32                  | ✅ (factures non vérifiées, voir M2) |
| Coordonnées (profil membre)                                     | s16 (+ saisie par le bureau en s12) | ✅                                   |
| Questions au bureau, catégories routées                         | s23 (modèle en s10)                 | ✅                                   |
| Notes internes et historique par membre                         | s24                                 | ✅                                   |
| Import annuel des relevés d'eau + rapport par email             | s17                                 | ✅                                   |
| Historique de consommation d'eau                                | s18                                 | ✅                                   |
| Signalements (public anonyme + membre identifié)                | s10, s22                            | ✅                                   |
| Publication des analyses d'eau                                  | s09                                 | ✅                                   |
| Documents partagés                                              | s31                                 | ✅                                   |
| Documents nominatifs physiquement séparés                       | s32                                 | ✅                                   |
| Campagnes email Brevo (4 modèles + libre)                       | s25                                 | ✅                                   |
| Envoi échelonné / budget quotidien                              | s26                                 | ✅                                   |
| Relances d'impayés activables                                   | s29                                 | ✅                                   |
| Publipostage PDF                                                | s28                                 | ✅                                   |
| Groupes de destinataires                                        | s27                                 | ✅                                   |
| Statistiques d'ouverture et de clic                             | s30                                 | ✅                                   |
| Modèles de documents (unitaire + lot)                           | s36                                 | ✅                                   |
| Facturation membres : interface + Pennylane                     | s19, s20                            | ✅                                   |
| Redirection de paiement                                         | s21                                 | ✅                                   |
| Multi-tenant                                                    | s01                                 | ✅                                   |
| Export individuel d'un membre                                   | s40                                 | ✅                                   |
| Simulation de rôle SuperAdmin                                   | s41                                 | ✅                                   |
| Export et portabilité                                           | s38, s39                            | ✅                                   |
| Module Vote (ASL Community)                                     | s33                                 | ✅                                   |
| Module Voirie                                                   | s34                                 | ✅                                   |
| Module Petites annonces                                         | s35                                 | ✅                                   |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story (37 lignes du tronc commun et 3 modules).

## Scope

- [x] Aucune story ne reprend un élément du cimetière. Les exclusions sont rappelées là où le risque existe : pas de logique de vote (s33), pas de moyen de paiement (s20, s21), pas de messagerie privée (s35), carte en image statique (s34), aucun plan B de connexion (s28, s42), pas de fusion Eau et Voirie (s34), sous-systèmes IA et Kanban retirés (s01).
- [x] Aucune story ne sort du périmètre, à une exception déclarée : s39, story transverse (voir m5).

## Story quality

- [ ] Chaque story est une tranche livrable de bout en bout : oui, sauf s39 (dérogation déclarée).
- [ ] Chaque critère peut devenir un test : non. Le critère 4 de s24 (« ni export ») ne peut pas être testé à la livraison et contredit s40 (M1). Le rattachement daté des factures n'a aucun critère (M2).
- [x] Les notes agentiques sont présentes et utiles. Certaines sont périmées dans s38 (m1).
- [x] La complexité est notée, aucune story à 5, et les huit stories à 4 (s01, s04, s12, s26, s29, s32, s37, s38) expliquent leur risque. La répartition du récapitulatif est juste (3 / 18 / 15 / 8 = 44).

## The list as a whole

- [ ] Ordre de dépendances exécutable : aucun cycle et aucune référence à une story ultérieure. En revanche, une dépendance manque (M3) et s13 attend une story qui n'existe pas (M4).
- [x] Les ids sont bien formés, uniques et identiques entre les en-têtes et le récapitulatif. s01b et s04b utilisent le suffixe lettre autorisé par `AGENTS.md`.
- [x] Pas de chevauchement réel. Les frontières sensibles sont écrites : s12/s16, s10/s23/s35, s15/s42, s25/s27, s01b/s02, s14/s37/s41.

## Findings

### Majeurs

**M1 — majeur — s24 c4 contre s40 c2 (et s24 note, s38 note) : deux critères se contredisent sur les notes internes.**

- Le critère 4 de s24 (l. 1483) dit : « Un membre n'a aucun accès à ses notes internes ni à celles d'un autre : ni page, ni API, **ni export** ».
- Le critère 2 de s40 (l. 2324) dit : « La copie contient toutes les données le concernant, **y compris les notes internes écrites sur lui** ». La note de s24 (l. 1507) et celle de s38 (l. 2221) vont dans le même sens que s40.
- Conséquence : le test de s40 fera tomber celui de s24, ou l'agent de s24 codera une exclusion que s40 devra défaire.
- Ce « ni export » ne peut pas non plus être testé à la livraison de s24, puisque aucun export n'existe avant s38.
- À corriger : limiter le critère de s24 à « ni page ni API côté membre ». Le contenu de la copie reste à s40.

**M2 — majeur — s12 c3 et s19 : aucun critère ne vérifie que les factures restent rattachées à la bonne période de propriété.**

- Le PRD dit : « une vente ne transfère pas les **factures** et documents antérieurs ».
- Le critère 3 de s12 (l. 900) répartit la vérification : relevés en s18, documents en s32, et factures « à la **recherche** de s19 ». Une recherche n'est pas un test.
- Aucun critère de s19 ni de s20 ne porte sur une parcelle vendue.
- Relevés (s17 c4, s18 c4) et documents (s32 c4) ont leur test. Les factures n'en ont pas.
- À corriger : ajouter un critère à s19. Soit le test de la parcelle vendue, soit un critère qui dit explicitement que la facture est rattachée à la personne facturée et non à la parcelle.

**M3 — majeur — s03 : dépendance envers s02 non déclarée.**

- Le critère 8 de s03 (l. 392) exige que l'action « modifier les paramètres de l'association (s02) » soit déclarée au registre, avec test en interface et côté serveur.
- Or les dépendances (l. 398) et le récapitulatif (l. 2466) ne listent que `s01, s01b`. Pour le graphe déclaré, s02 et s03 pourraient se faire dans n'importe quel ordre. Dans ce cas, le critère 8 ne peut pas être testé.
- L'ordre des numéros sauve l'exécution en série, pas le contrat de dépendances.
- À corriger : ajouter `s02` aux dépendances de s03, dans la story et dans le récapitulatif. C'est la prochaine story après s02.

**M4 — majeur — s13 (et s01b l. 264, s31 l. 1869) : s13 attend une story qui n'existe pas.**

- La note de s13 (l. 994-997) exige que la sauvegarde de la base et des fichiers soit en place avant l'import des données réelles. Elle renvoie à « la story de mise en ligne décidée le 17 septembre 2026, **à écrire et à livrer avant s13** ».
- Cette story n'est pas dans le découpage ni dans le récapitulatif.
- La revue précédente (I-12) signalait qu'aucune story ne portait la sauvegarde. La correction a seulement renvoyé le point vers une story qui reste à écrire.
- Sont bloquées : s13, puis s17, s18 (angle n°1 du PRD) et s42.
- Pas critique, parce que ce n'est pas une ligne du tableau du PRD et que tout reste exécutable jusqu'à s12.
- À corriger : écrire cette story, avec id, critères et place dans le récapitulatif, avant que s13 entre en `/ks-research`.

### Mineurs

**m1 — mineur — s38 : numéros de critères et chiffres périmés.**

- La note du critère 4 (l. 2193) et les notes (l. 2234, 2238) renvoient au « critère 8 » pour le mécanisme piloté par l'inventaire. C'est maintenant le **critère 9** (l. 2198) ; le critère 8 porte sur la configuration.
- La note de risque parle de « vingt-six dépendances » (l. 2211, juste : 26 listées), mais la note l. 2236 conclut « d'où vingt-cinq ».
- La phrase « L'export individuel répond au droit d'accès d'un membre — d'où l'inclusion des notes internes » (l. 2220-2222) date d'avant la séparation de s40.
- Risque : un agent qui suit « critère 8 » regarde le mauvais critère.

**m2 — mineur — s40 c6 : la trace de la demande n'a pas de critère d'export ou d'exclusion.**

- s40 crée une donnée scopée : la trace de la demande et de sa livraison. Elle arrive après le garde-fou de s39.
- s41 porte le critère attendu (c5 : exporter la trace ou la déclarer exclue avec son motif, pour que s39 continue de passer). s40 ne le porte pas.
- Le test de s39 le détectera, mais le traitement de s40 et s41 n'est pas cohérent.

**m3 — mineur — s27 : trois sujets, onze critères, pour une complexité de 3.**

- s27 regroupe la cible « impayés », les groupes composés par le bureau et la classification facultatif / statutaire. La classification est à elle seule une ligne du PRD, notée 2.
- La justification du 3 (l. 1691) ne parle que de la cible « impayés ». Elle oublie la classification.
- Le document a scindé s25 parce qu'elle « groupait neuf critères » ; s27 en a onze.
- À envisager : sortir la classification dans sa propre story, ou au minimum justifier le score en la comptant.

**m4 — mineur — planificateur de l'ADR 006 (`scheduled_job` + cron) : personne n'est chargé de le mettre en place.**

- s26 (l. 1645) demande seulement de « s'y conformer ». s29 et le traitement en tâche de fond de s38 le supposent.
- La purge sous 24 h de s08 c6 pourrait en être la première utilisatrice. Cela dépend de l'implémentation, qui relève de `/ks-plan`.
- C'est le même type de trou que le stockage de fichiers avant l'ajout de s01b. Nommer la story qui le crée évite de le découvrir en recherche.

**m5 — mineur — s39 : story transverse sans valeur visible pour un utilisateur.**

- La dérogation est déclarée, limitée et justifiée. Je la note pour mémoire, comme la revue précédente (I-18).

## Verdict

Toutes les lignes du périmètre sont couvertes et aucune story ne reprend un élément du cimetière. Aucune dépendance n'est circulaire ni n'attend une story ultérieure, et aucune story n'est à 5. Les quatre problèmes majeurs sont des défauts précis et peu coûteux à corriger dans le markdown :

- la contradiction entre s24 et s40 ;
- le rattachement daté des factures sans test ;
- la dépendance s03 → s02 manquante ;
- la story de mise en ligne à écrire avant s13.

Aucun ne concerne s02, la prochaine story du pipeline. Corriger M3 avant `/ks-plan s03`, M1 avant `/ks-plan s24`, M2 avant `/ks-plan s19` et M4 avant `/ks-research s13`.

Fichiers relus :

- `/workspace/docs/prd.md`
- `/workspace/docs/stories.md`
- `/workspace/templates/stories-review-checklist.md`
- `/workspace/docs/reviews/stories.md` (revue précédente, pour ne pas reposer des points réglés)

Max severity: major
Stories ready: yes
