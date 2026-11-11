# Revue du découpage : ASL-CMS (Lp)

> Relecture à contexte neuf de `docs/stories.md` (62 stories) face à `docs/prd.md`, avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> Seconde passe du 2026-11-11 (la première avait rendu `major` / `no`), après amendement du PRD et des stories. Consécutive à la scission de s26 en s26-envoi-echelonne et s52-budget-envoi-adaptateur (PR #64). Attention particulière à ces deux stories, aux références à s52 dans s29, s38, s42, s12c et s03, au tableau récapitulatif et aux décomptes. Le tableau de couverture a été repris ligne par ligne.
> Le fichier `docs/stories.md` dépasse la limite de lecture : il a été lu par passes ciblées.

**En bref : aucun critique, aucun majeur, trois mineurs (corrigés dans la foulée).**

- Le majeur de la première passe est levé : le PRD (ligne « Envoi échelonné » et critère de réussite) dit désormais « envois quotidiens de 100 au plus », avec la réserve pour les emails de connexion et la visibilité du bureau sur les destinataires.
- Sur les cinq mineurs de la première passe, quatre sont levés (m2 à m5) ; m1 ne l'était qu'à moitié, voir ci-dessous.
- La scission s26 / s52 reste propre : aucun recouvrement, aucun cycle, références à s52 cohérentes.

## Suivi de la première passe

| Constat                                                       | État                      | Preuve                                                                                               |
| ------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| M1 : PRD « sur deux jours » contre le plafond de 100 par jour | **Levé**                  | PRD l. 87 et l. 181 amendés ; s26 cohérente avec les deux.                                           |
| m1 : s52 comptée hors périmètre                               | **Levé après correction** | En-tête de s52 corrigé ; la liste des « treize hors tableau » ne cite plus s52 (voir m1 ci-dessous). |
| m2 : s52 critère 10 = tâche de recherche                      | **Levé**                  | Devenu un test sur la frontière 23h59 / 00h00 (Paris) ; la vérification Brevo est dans les notes.    |
| m3 : s52 en complexité 3, sans note de design                 | **Levé**                  | s52 à 4 avec son risque ; note « Écran » renvoyant à `/ks-design s52`.                               |
| m4 : titre de s26 et reprises sans limite                     | **Levé**                  | Titre « plafonnés » ; tentatives = paramètre de tenant, valeur par défaut au `/ks-plan`.             |
| m5 : s12c au présent sur s52                                  | **Levé**                  | « (à venir : s12c s'exécute avant et n'en dépend pas) ».                                             |

## Couverture du périmètre

Les 40 lignes du tableau « Replicated (core loop) » du PRD sont couvertes. Trois lignes de modules le sont aussi.

| Ligne du PRD (core loop)                                 | Couverte par                                       | OK           |
| -------------------------------------------------------- | -------------------------------------------------- | ------------ |
| CMS de pages génériques                                  | s04                                                | ✅           |
| Attribution des rôles aux membres                        | s14 (+ s03b)                                       | ✅           |
| Permissions par rôle configurables                       | s37 (+ registre de s03b)                           | ✅           |
| Connexion par lien magique + suivi d'adoption            | s03, s03c, s12d, s42                               | ✅           |
| Pages publiques + formulaire de contact archivé          | s04, s08                                           | ✅           |
| Navigation du site public                                | s04b, s50                                          | ✅           |
| Identité visuelle (logo, teinte, favicon)                | s01b, s02                                          | ✅           |
| Limitation de débit des formulaires publics              | s08b                                               | ✅           |
| Actualités                                               | s05                                                | ✅           |
| Présentation du bureau                                   | s06                                                | ✅           |
| Désinscription et classification                         | s25 (lien), s27b (nature)                          | ✅           |
| Bandeau d'alerte global                                  | s07                                                | ✅           |
| SEO                                                      | s11                                                | ✅           |
| Import initial des membres                               | s13                                                | ✅           |
| Modèle membre ↔ parcelle daté                            | s12                                                | ✅           |
| Coordonnées (profil membre)                              | s16                                                | ✅           |
| Questions au bureau, catégories avec routage             | s23                                                | ✅           |
| Notes internes et historique par membre                  | s24                                                | ✅           |
| Import annuel des relevés d'eau + rapport d'erreurs      | s17                                                | ✅           |
| Historique de consommation                               | s18                                                | ✅           |
| Signalements avec catégories et statuts                  | s10 (public), s22 (membre)                         | ✅           |
| Publication des analyses d'eau                           | s09                                                | ✅           |
| Documents partagés                                       | s31                                                | ✅           |
| Documents nominatifs séparés                             | s32                                                | ✅           |
| Campagnes email Brevo                                    | s25                                                | ✅           |
| Envoi échelonné + budget quotidien de tout email sortant | s26 (échelonnement) + s52 (budget)                 | ✅ (voir M1) |
| Relances d'impayés                                       | s29                                                | ✅           |
| Publipostage PDF                                         | s28                                                | ✅           |
| Groupes de destinataires                                 | s27                                                | ✅           |
| Statistiques d'ouverture et de clic                      | s30                                                | ✅           |
| Modèles de documents réutilisables                       | s36                                                | ✅           |
| Facturation membres : interface + Pennylane              | s19 (interface + saisie manuelle), s20 (Pennylane) | ✅           |
| Redirection de paiement                                  | s21                                                | ✅           |
| Multi-tenant (Organization, RLS, provisioning)           | s01, s02                                           | ✅           |
| Export individuel d'un membre                            | s40                                                | ✅           |
| Simulation de rôle SuperAdmin                            | s41 (+ s48)                                        | ✅           |
| Export et portabilité des données                        | s38, s39                                           | ✅           |
| Module Vote                                              | s33                                                | ✅           |
| Module Voirie                                            | s34                                                | ✅           |
| Module Petites annonces                                  | s35                                                | ✅           |

- [x] Chaque fonctionnalité du tableau « Replicated (core loop) » est livrée par au moins une story. La scission ne perd rien : la ligne « Envoi échelonné » du PRD nomme explicitement le budget quotidien « décompté par tout email sortant … avec report au lendemain », et s52 le livre.

## Périmètre

- [x] Aucune story ne réintroduit un élément du cimetière. Vérifiés en particulier : s48 (le SuperAdmin agit à la place d'un compte, ce n'est pas un plan B pour les membres sans email), s28 et s42 (aucune promesse d'accès pour les membres sans email), s50 (liens de menu libres, pas de menu à deux niveaux).
- [x] Aucune story ne dépasse le périmètre. s52 est dans le périmètre (voir m1).

## Qualité des stories

- [x] Tranches de bout en bout. s52 est à la limite d'une couche technique (voir m3), mais elle a un comportement observable : rapports, visibilité pour le bureau, test d'accès croisé entre tenants.
- [x] Critères d'acceptation testables, hors exceptions m2 et m4.
- [x] Notes agentiques présentes et utiles sur chaque story lue. s26 et s52 portent leurs pièges, leurs références d'ADR et les décisions à trancher au `/ks-plan`.
- [x] Complexité notée, aucun 5. Chaque 4 énonce son risque (s26, s29, s42 vérifiés). s52 est notée 3 (voir m3).

## La liste dans son ensemble

- [x] L'ordre des dépendances est exécutable.
  - Aucun cycle. s52 → s26 → (s02, s12b, s25).
  - s29, s38 et s42 listent désormais s52 dans leurs « Dépendances » et dans le récapitulatif.
  - Les références d'id en avance (s52 après s26 mais avant s29 et s42 ; s44 à s47 avant s12b) sont déclarées dans l'en-tête « Ordre des stories ». C'est une convention admise, pas un défaut.
- [x] Les ids sont bien formés (`s<numéro>[lettre]-<slug>`) et uniques. Les 62 titres correspondent aux 62 lignes du récapitulatif.
- [x] Aucun recouvrement entre s26 et s52. s26 garde le planificateur (ADR 006), l'étalement des campagnes, le suivi par destinataire et le plafond de 100 par jour. s52 garde le budget transversal, la réserve pour les emails de connexion et le report des envois ponctuels. s52 indique qu'elle réutilise le `scheduled_job` de s26.

**Décomptes vérifiés contre le récapitulatif.**

- 62 stories.
- Complexité : 5 à 1, 22 à 2, 25 à 3, 10 à 4. Tout correspond au décompte annoncé ; s26 reste à 4 et s52 est à 3.
- Dix stories « ajoutées en revue » ; la liste en nomme exactement dix.
- La liste « quatorze hors tableau » nomme quatorze ids, dont un n'est pas hors périmètre (voir m1).

## Constats de la seconde passe

- **mineur (m1, corrigé)** — récapitulatif — La liste « Treize stories hors du tableau » nommait quatorze ids, dont s52, qui est dans le périmètre. s52 est retirée de la liste et mentionnée à part.
- **mineur (m6, corrigé)** — récapitulatif — « Les dix stories à 4 » omettait s52 ; le décompte juste est onze. Corrigé, s52 ajoutée avec son risque.
- **mineur (m7, corrigé)** — s26, références — `CDCT §8.2` (`docs/bases/cahier-des-charges-technique.md` l. 180) dit encore « en 2 envois (jour J puis J+1) ». Les notes de s26 précisent désormais qu'il est antérieur à l'arbitrage et ne prime pas. Le CDCT lui-même n'est pas modifié.

## Autres mentions de l'ancienne règle « deux jours »

Non comptées comme défauts : `docs/decisions/005` l. 11 et `docs/decisions/006` l. 11 (ADR immuables ; s26 dit que la présente story fait foi), `docs/bases/brief-produit-asl-cms.md` l. 62 (cadrage, non contraignant). Le « deux jours » de la sauvegarde (`docs/exploitation/`, s12c) est sans rapport.

## Verdict

Aucun critique, aucun majeur : couverture complète (37 lignes du cœur et 3 modules), aucune fuite du cimetière, ordre exécutable, aucun recouvrement, décomptes cohérents (62 stories ; 5 à 1, 22 à 2, 24 à 3, 11 à 4 ; treize hors tableau).

Max severity: minor
Stories ready: yes
