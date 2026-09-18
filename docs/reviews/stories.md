# Stories Review — ASL-CMS (Lp)

> Relecture à froid de `/workspace/docs/stories.md` (45 stories) par rapport à `/workspace/docs/prd.md`. Chaque problème est classé : critique, majeur ou mineur.
> s01 et s01b sont déjà livrées. Je ne rediscute ni leur taille ni leur contenu.
> Cette revue suit celle de `docs/reviews/stories.md` (majeurs M1 à M4, mineurs m1 à m5). Pour chaque point, j'indique s'il est toujours ouvert. La nouvelle story s12b-mise-en-ligne est relue avec la même exigence que les autres.

**En bref : aucun critique, quatre majeurs, six mineurs.**

- Toutes les lignes du périmètre restent couvertes et aucune story ne reprend un élément du cimetière.
- M3 et M4 sont levés.
- M1 et M2 sont toujours ouverts, **sans aucune modification**.
- s12b soulève deux nouveaux majeurs (M5, M6) et deux mineurs (m6, m7).
- M6 touche s03, qui passe juste après s02 : il faut le corriger avant `/ks-plan s03`.

## Suivi de la revue précédente

| Constat                                                          | État                                   | Preuve                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 — s24 c4 « ni export » contredit s40 c2                       | **Ouvert**                             | l. 1604 inchangée (« ni page, ni API, ni export ») ; s40 c2 (l. 2445) et la note de s24 (l. 1627-1629) incluent toujours les notes dans l'export                                                                                     |
| M2 — le rattachement daté des factures n'a pas de test           | **Ouvert**                             | s12 c3 (l. 900) renvoie toujours « à la recherche de s19 » ; s19 (l. 1400-1407) n'a toujours aucun critère sur une parcelle vendue                                                                                                   |
| M3 — dépendance s03 → s02                                        | **Levé**                               | s03 dépend de `s01, s01b, s02` (l. 398 et récapitulatif l. 2587)                                                                                                                                                                     |
| M4 — s13 attend une story inexistante                            | **Levé**                               | s12b est écrite, placée avant s13 et dans le récapitulatif ; s13 en dépend (l. 1107, l. 2599) ; les notes de s01b (l. 263-264), s13 (l. 1115-1118) et s31 (l. 1988-1990) sont à jour. Nouveaux points sur s12b : voir M5, M6, m6, m7 |
| m1 — s38 : numéros de critères et chiffres périmés               | **Ouvert, et un peu aggravé**          | voir m1 ci-dessous                                                                                                                                                                                                                   |
| m2 — s40 : aucun critère sur l'export ou l'exclusion de la trace | **Ouvert**                             | s40 c6 (l. 2449) est inchangé ; s41 c5 (l. 2493) porte toujours seul ce critère                                                                                                                                                      |
| m3 — s27 : trois sujets, onze critères, noté 3                   | **Ouvert**                             | justification toujours limitée à la cible « impayés » (l. 1812)                                                                                                                                                                      |
| m4 — planificateur de l'ADR 006 : personne n'en est chargé       | **Ouvert**                             | s12b l. 1073-1077 le renvoie à « la première story qui planifie une tâche métier », sans la nommer                                                                                                                                   |
| m5 — s39 story transverse                                        | **Ouvert pour mémoire**, étendu à s12b | les deux sont déclarées hors périmètre (l. 2631-2635)                                                                                                                                                                                |

## Perimeter coverage

| PRD feature (core loop)                                         | Covered by                          | OK?                                        |
| --------------------------------------------------------------- | ----------------------------------- | ------------------------------------------ |
| CMS de pages génériques                                         | s04                                 | ✅                                         |
| Attribution des rôles aux membres (+ verrou anti-blocage)       | s14                                 | ✅                                         |
| Permissions par rôle configurables en BO                        | s03 (registre), s37                 | ✅                                         |
| Connexion par lien magique 4 h (+ invitation, suivi d'adoption) | s03, s15, s42                       | ✅ (voir M6 : lien sur plusieurs domaines) |
| Pages publiques + formulaire de contact archivé en BO           | s04, s08                            | ✅                                         |
| Navigation du site public (menu, pied de page)                  | s04b                                | ✅                                         |
| Identité visuelle (logo, teinte, favicon, en-tête des emails)   | s01b, s02, s03 c9, s15 c2, s25 c3   | ✅                                         |
| Limitation de débit des formulaires publics                     | s08 c5-c6, s10 c9                   | ✅                                         |
| Actualités                                                      | s05                                 | ✅                                         |
| Présentation du bureau                                          | s06                                 | ✅                                         |
| Désinscription et classification des communications             | s25, s27                            | ✅                                         |
| Bandeau d'alerte global                                         | s07                                 | ✅                                         |
| SEO                                                             | s11                                 | ✅                                         |
| Import initial des membres                                      | s13 (précédée de s12b)              | ✅                                         |
| Modèle membre ↔ parcelle daté                                   | s12, s17, s18, s32                  | ✅ (factures non vérifiées, M2)            |
| Coordonnées (profil membre)                                     | s16 (+ saisie par le bureau en s12) | ✅                                         |
| Questions au bureau, catégories routées                         | s23 (modèle en s10)                 | ✅                                         |
| Notes internes et historique par membre                         | s24                                 | ✅                                         |
| Import annuel des relevés d'eau + rapport par email             | s17                                 | ✅                                         |
| Historique de consommation d'eau                                | s18                                 | ✅                                         |
| Signalements (public anonyme + membre identifié)                | s10, s22                            | ✅                                         |
| Publication des analyses d'eau                                  | s09                                 | ✅                                         |
| Documents partagés                                              | s31                                 | ✅                                         |
| Documents nominatifs physiquement séparés                       | s32                                 | ✅                                         |
| Campagnes email Brevo (4 modèles + libre)                       | s25                                 | ✅                                         |
| Envoi échelonné / budget quotidien                              | s26                                 | ✅                                         |
| Relances d'impayés activables                                   | s29                                 | ✅                                         |
| Publipostage PDF                                                | s28                                 | ✅                                         |
| Groupes de destinataires                                        | s27                                 | ✅                                         |
| Statistiques d'ouverture et de clic                             | s30                                 | ✅                                         |
| Modèles de documents (unitaire + lot)                           | s36                                 | ✅                                         |
| Facturation membres : interface + Pennylane                     | s19, s20                            | ✅                                         |
| Redirection de paiement                                         | s21                                 | ✅                                         |
| Multi-tenant                                                    | s01                                 | ✅                                         |
| Export individuel d'un membre                                   | s40                                 | ✅                                         |
| Simulation de rôle SuperAdmin                                   | s41                                 | ✅                                         |
| Export et portabilité                                           | s38, s39                            | ✅                                         |
| Module Vote (ASL Community)                                     | s33                                 | ✅                                         |
| Module Voirie                                                   | s34                                 | ✅                                         |
| Module Petites annonces                                         | s35                                 | ✅                                         |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story : 37 lignes du tronc commun et 3 modules.
- Le critère de succès « mise en production effective sur le VPS avant fin mai 2027 » n'est pas une ligne du tableau. Il est désormais porté par s12b.

## Scope

- [x] Aucune story ne reprend un élément du cimetière.
  - s12b n'introduit ni une base par tenant, ni une supervision au-delà de Sentry.
  - Les exclusions restent rappelées là où le risque existe : s01, s19-s21, s28, s33-s35, s42.
- [x] Aucune story ne dépasse le périmètre, sauf deux exceptions déclarées : s39 (garde-fou) et s12b (exploitation). Toutes deux sont justifiées dans leur en-tête et dans le récapitulatif.

## Story quality

- [ ] Chaque story est une tranche livrable de bout en bout : oui, sauf les deux dérogations déclarées. s12b réunit en revanche deux tranches distinctes (M5).
- [ ] Chaque critère peut devenir un test : non.
  - s24 c4 (M1).
  - Les factures n'ont pas de critère daté (M2).
  - s12b c5 est en partie une propriété du diff et de la documentation (m7).
- [x] Les notes agentiques sont présentes et utiles. Celles de s12b sont précises : RLS forcée et `pg_dump`, ordre base puis fichiers, en-tête `Host`, build. Certaines notes sont périmées (m1).
- [ ] La complexité est notée et aucune story n'est à 5. La répartition 3 / 18 / 15 / 9 = 45 est juste, et les neuf stories à 4 expliquent leur risque. Mais le risque de s12b ne décrit que la moitié « sauvegarde », et la story ressemble à une 5 déguisée (M5).

## The list as a whole

- [ ] Ordre de dépendances exécutable : pas de cycle, et s12b (`s01, s01b`) est bien placée avant s13. Mais la note de s12b confie un problème à s03, qui passe **avant** elle, sans qu'aucun critère de s03 le prenne en charge (M6).
- [x] Les ids sont bien formés, uniques et identiques entre les en-têtes et le récapitulatif.
  - Le suffixe de `s12b` est légitime : la story doit précéder s13 et l'ordre des ids suit les dépendances.
  - Conséquence prévue par `AGENTS.md` : `/ks-plan s12` résoudra désormais deux stories, il faudra taper `s12-membres-parcelles` ou le slug.
- [ ] Pas de chevauchement entre stories. En revanche, s12b groupe deux valeurs (M5).

## Findings

### Majeurs

**M1 — majeur — s24 c4 contredit s40 c2 (toujours ouvert).**

- s24 c4 (l. 1604) dit toujours « ni page, ni API, **ni export** ».
- s40 c2 (l. 2445), la note de s24 (l. 1627-1629) et celle de s38 (l. 2341-2343) incluent les notes internes dans l'export.
- De plus, le « ni export » ne peut pas être testé à la livraison de s24, puisque aucun export n'existe avant s38.
- À corriger : limiter le critère à « ni page ni API côté membre ». À faire avant `/ks-plan s24`.

**M2 — majeur — s12 c3 et s19 : le rattachement daté des factures n'a pas de test (toujours ouvert).**

- s12 c3 (l. 900) renvoie toujours les factures « à la recherche de s19 ».
- Aucun critère de s19 (l. 1400-1407) ni de s20 ne porte sur une parcelle vendue.
- Or le PRD dit « une vente ne transfère pas les **factures** et documents antérieurs ».
- À corriger : ajouter à s19 soit le test de la parcelle vendue, soit un critère qui dit explicitement que la facture est rattachée à la personne facturée. À faire avant `/ks-plan s19`.

**M5 — majeur — s12b : deux valeurs dans une seule story, et un risque décrit pour une seule des deux.**

- Le titre le dit (« Mettre le site en ligne **et** le sauvegarder »). La story porte 13 critères et 5 pièges, sur deux livrables séparables :
  - **Déploiement** : c1-c5 et c13 (HTTPS multi-domaine, redirection, migrations avec retour à la version précédente, persistance de `LOCAL_STORAGE_ROOT`, ajout de domaine, workflows).
  - **Sauvegarde et restauration** : c6-c12 (base + fichiers, rôle qui contourne la RLS forcée, restauration vérifiée sur deux tenants, planification, copie hors serveur, rétention, alerte).
- Le document s'est fixé des seuils bien plus bas :
  - s25 a été scindée à 9 critères ;
  - s26 prévoit une scission au-delà de dix tâches de plan ;
  - s38 a été scindée deux fois parce qu'elle « se lisait comme une 5 ».
- La note de risque (l. 1018-1023) ne traite que la restauration. Les risques du déploiement ne sont pas nommés comme risque de complexité : retour arrière d'une migration en échec, certificats sur plusieurs domaines, réécriture de `Host`, build sous Cache Components.
- Le déploiement peut être livré seul, et il a de la valeur seul : le critère de succès « mise en production ». La sauvegarde en dépend.
- À corriger : scinder en `s12b-mise-en-ligne` (déploiement) et `s12c-sauvegarde` (sauvegarde et restauration), s13 dépendant de s12c. À défaut, écrire dans les notes un seuil de scission explicite, comme en s26, et compléter la note de risque avec le déploiement.

**M6 — majeur — s12b piège n°4 confie à s03 un problème qu'aucun critère de s03 ne couvre.**

- La note l. 1045-1048 constate que `BETTER_AUTH_URL` et `NEXT_PUBLIC_APP_URL` ne portent qu'une seule valeur alors que le produit sert plusieurs domaines. Elle conclut : « il reviendra à s03 (lien magique) et s15 ».
- Or s03 passe **avant** s12b. C'est un renvoi vers une story antérieure, qui n'en porte aucune trace : aucun critère de s03 (l. 385-394) ne dit vers quel domaine pointe le lien de connexion.
- Conséquence : s03 peut passer sa review avec un lien qui renvoie toutes les associations vers un seul domaine. La session ouverte ne serait alors pas celle du tenant appelé, et le critère de succès n°1 du PRD serait faux pour cinq associations sur six. Le défaut ne se verrait qu'une fois s12b déployée, c'est-à-dire après s03.
- s15 et s42 génèrent aussi des liens et héritent du même trou.
- À corriger avant `/ks-plan s03`, la prochaine story après s02 : ajouter à s03 un critère du type « un lien demandé depuis le domaine de l'association B pointe vers le domaine B et y ouvre la session — vérifié sur deux domaines », et aligner la note de s12b.

### Mineurs

**m1 — mineur — s38 et s42 : renvois et chiffres périmés (toujours ouvert, élargi).**

- s38 c4 (l. 2314) et les notes (l. 2355, 2359) renvoient au « critère 8 » pour le mécanisme piloté par l'inventaire. C'est le **critère 9** (l. 2319) ; le critère 8 porte sur la configuration.
- La note de risque dit « vingt-six dépendances » (l. 2332, juste : 26 listées) mais la l. 2357 conclut « d'où vingt-cinq ».
- La phrase l. 2341-2343 (« L'export individuel répond au droit d'accès… ») date d'avant la séparation de s40.
- Nouveau : s42 (l. 2549) parle des « 43 stories précédentes ». Avec s12b, elles sont 44.

**m2 — mineur — s40 c6 : la trace de la demande n'a pas de critère d'export ou d'exclusion (toujours ouvert).**

- s41 c5 porte ce critère, s40 non. Le test de s39 le détectera, mais les deux stories ne sont pas traitées de la même façon.

**m3 — mineur — s27 : trois sujets, onze critères, pour une complexité de 3 (toujours ouvert).**

- La justification (l. 1812) ignore la classification facultatif / statutaire, qui est à elle seule une ligne du PRD notée 2.

**m4 — mineur — planificateur de l'ADR 006 : toujours personne n'est chargé de le mettre en place.**

- s12b pose le cron système des sauvegardes et documente son emplacement. C'est un progrès.
- Mais `scheduled_job` reste attribué à « la première story qui planifie une tâche métier » (l. 1073-1077), sans la nommer. Les candidates sont s08 (purge sous 24 h) ou s26.
- Nommer la story évite de découvrir le manque en recherche.

**m6 — mineur — s12b c8 : les clés de fichiers à vérifier sont énumérées à la main.**

- Le critère ne vérifie que `identity_logo_key` et `identity_favicon_key` (l. 990).
- Or s12b s'exécute **après** s04 (images de blocs) et s09 (PDF d'analyses), qui stockent déjà des fichiers. Une clé d'image orpheline après restauration passerait le test.
- C'est le défaut que s38 et s39 dénoncent pour l'export.
- À corriger : formuler « toute clé de fichier référencée en base », par inventaire. À défaut, nommer s04 et s09 et noter que s31, s32 et s36 étendront le test.

**m7 — mineur — s12b c5 et c12 : un critère en partie intestable et un canal d'alerte non défini.**

- c5 (l. 987) mêle une partie testable (ajouter un domaine par configuration, puis le test de fumée répond) et deux propriétés qui ne le sont pas : « sans modifier le code », qui relève du diff, et « procédure écrite », qui relève de la documentation. Les déplacer dans « À vérifier en review ».
- c12 (l. 994) exige un signal « qui parvient au prestataire hors du serveur » sans en nommer le canal. Si c'est un email, il passe par l'adaptateur d'envoi de s03 et doit décider s'il compte dans le budget par tenant de s26. Cela ferait une dépendance implicite, non déclarée.

**m5 — mineur, pour mémoire — s39 et s12b sont hors du tableau du PRD.**

- Les deux dérogations sont déclarées, bornées et justifiées (l. 967-971, l. 2384-2388, l. 2631-2635). Rien à corriger.

## Verdict

Aucun problème critique :

- toutes les lignes du périmètre sont couvertes ;
- aucune story ne reprend un élément du cimetière ;
- aucune story n'est à 5 ;
- aucun cycle.

s12b lève bien M4 et M3 est corrigé. Il reste quatre majeurs, tous corrigeables dans le markdown :

- **M6 avant `/ks-plan s03`** : c'est la plus urgente, s03 suit s02 ;
- **M5 avant `/ks-research s12b`** ;
- **M2 avant `/ks-plan s19`** ;
- **M1 avant `/ks-plan s24`**.

Fichiers relus :

- `/workspace/docs/prd.md`
- `/workspace/docs/stories.md`
- `/workspace/templates/stories-review-checklist.md`
- `/workspace/docs/reviews/stories.md` (revue précédente)

Max severity: major
Stories ready: yes
