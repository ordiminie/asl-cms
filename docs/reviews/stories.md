# Revue du découpage : ASL-CMS (Lp)

> J'ai relu `/workspace/docs/stories.md` (47 stories) sans contexte préalable et je l'ai comparé à `/workspace/docs/prd.md`. Chaque problème est classé critique, majeur ou mineur.
> s01 et s01b sont déjà livrées : je ne rediscute ni leur taille ni leur contenu.
> Cette revue suit celle de `docs/reviews/stories.md`, qui avait relevé le majeur M7 et les mineurs m5, m8 à m15. Pour chacun, j'indique s'il est fermé, avec les lignes qui le prouvent. J'ai relu les stories modifiées (s03, s08, s12b, s12c, s15, s24, s26, s27b, s29, s34, s42) avec la même exigence que les autres.
> La classification des envois du premier tenant (arbitrage du 18 septembre 2026, s27b l. 1986-2004) est une décision du product owner. Je l'enregistre telle quelle et je ne la rediscute pas : publication post-AG et campagne libre facultatives, campagne libre jamais envoyée à un désinscrit, invitation de lancement et sa relance statutaires.

**En bref : aucun critique, aucun majeur, six nouveaux mineurs.**

- M7 est fermé.
- Les mineurs m8 à m15 sont fermés. m5 reste, pour mémoire.
- Toutes les lignes du périmètre sont couvertes, aucune story ne reprend un élément du cimetière, aucune story n'est à 5 et il n'y a pas de cycle.
- Les nouveaux mineurs sont surtout des effets de bord de la correction de M7 :
  - la règle de s27b est testée en s42 mais pas en s29 (m16) ;
  - le gabarit de l'email de lancement reste implicite (m17) ;
  - s27b c1 annonce des types d'envoi livrés plus tard (m18).

## Suivi de la revue précédente

| Constat                                                            | État             | Preuve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M7 : nature des relances et du lancement fixée en dur              | **Fermé**        | s29, note l. 2096-2099 : « La cible des relances passe par le calcul de la cible de s27… découle de la nature configurée… ne pas contourner le filtre de désinscription ici, ni coder la nature en dur ». L'ancienne consigne « Ne pas appliquer le filtre » a disparu. s42 c3 (l. 2734) teste les deux natures, `statutaire` et `facultative`. s27b présente sa classification comme des « valeurs de seed, pas des constantes » (l. 1986-1997), ce qui concorde avec c1 (l. 1961) et c6 (l. 1966). La relance automatique et le lancement figurent au tableau (l. 1994-1995). Il reste une asymétrie entre s29 et s42, voir m16. |
| m8 : inventaire de s12c incomplet                                  | **Fermé**        | La note nomme cinq familles, dont s05 et s06 (l. 1147-1151). s12c dépend désormais de s05 et s06 (l. 1114, l. 2798). s34 porte la consigne de déclaration (l. 2341-2342). La détection inverse est adoptée (l. 1153-1157), mais seulement dans les notes, voir m19.                                                                                                                                                                                                                                                                                                                                                                |
| m9 : purge de s08 sans tâche périodique                            | **Fermé**        | s08 c7 (l. 753) : l'opération de purge peut être appelée seule. La note (l. 776-782) décrit les trois étapes. s12b c6 (l. 1015) planifie l'appel quotidien, et s12b dépend de s08 (l. 1020, l. 2797). Pas de cycle : s08 ne dépend que de s02 et s04.                                                                                                                                                                                                                                                                                                                                                                              |
| m10 : s03 sous-notée                                               | **Fermé**        | Complexité 4 (l. 381). Les quatre risques et un seuil de scission sont nommés (l. 405-410). Le récapitulatif est à jour (l. 2786, l. 2846-2847) et la répartition est recalculée (l. 2831). Un seul effet de bord : le paragraphe des écarts avec le PRD, voir m20.                                                                                                                                                                                                                                                                                                                                                                |
| m11 : s24 renvoyait le droit d'accès à s38                         | **Fermé**        | l. 1737-1738 : « au titre de la portabilité dans l'export d'association (s38), et au titre du droit d'accès dans la copie du membre (s40) ».                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| m12 : la règle de sûreté de s27b n'avait pas de critère            | **Fermé**        | s27b c2 (l. 1962) : « Un type d'envoi sans nature configurée se traite comme `facultative` ». La campagne libre est tranchée en c1 (l. 1961) : sa nature n'est pas choisie à la rédaction.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| m13 : s12b c6 en partie intestable                                 | **Fermé**        | Le critère devenu c7 (l. 1016) ne garde que la partie vérifiable. La partie qui relève du diff est passée en « À vérifier en review » (l. 1080-1081).                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| m14 : vérification de s15 sur deux domaines absente des critères   | **Fermé**        | s15 c8 (l. 1341) : « vérifié sur deux associations ».                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| m15 : scission conditionnelle de s26 non reportée sur le découpage | **Fermé**        | s26, note l. 1882-1886 : la scission se fait dans `docs/stories.md`, avec un nouvel id et la mise à jour des dépendances de s29, s30, s38 et s42. s03 applique la même règle (l. 408-410). Le paragraphe cite toutefois « Mineur m4 », voir m20.                                                                                                                                                                                                                                                                                                                                                                                   |
| m5 : stories hors du tableau du PRD                                | **Pour mémoire** | Trois dérogations déclarées : s39, s12b et s12c (l. 996-999, l. 1090-1092, l. 2581-2585, l. 2832-2836).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Couverture du périmètre

| Ligne du PRD (core loop)                                        | Couverte par                                 | OK ? |
| --------------------------------------------------------------- | -------------------------------------------- | ---- |
| CMS de pages génériques                                         | s04                                          | ✅   |
| Attribution des rôles (+ verrou anti-blocage)                   | s14                                          | ✅   |
| Permissions par rôle configurables en BO                        | s03 (registre), s37                          | ✅   |
| Connexion par lien magique 4 h (+ invitation, suivi d'adoption) | s03, s15, s42                                | ✅   |
| Pages publiques + formulaire de contact archivé en BO           | s04, s08                                     | ✅   |
| Navigation du site public (menu, pied de page)                  | s04b                                         | ✅   |
| Identité visuelle (logo, teinte, favicon, en-tête des emails)   | s01b, s02, s03 c9, s15 c2, s25 c3            | ✅   |
| Limitation de débit des formulaires publics                     | s08 c5-c7, s10 c9, s12b c6 (purge planifiée) | ✅   |
| Actualités                                                      | s05                                          | ✅   |
| Présentation du bureau                                          | s06                                          | ✅   |
| Désinscription et classification des communications             | s25 c6-c7 (lien et exclusion), s27b (nature) | ✅   |
| Bandeau d'alerte global                                         | s07                                          | ✅   |
| SEO                                                             | s11                                          | ✅   |
| Import initial des membres                                      | s13 (précédée de s12c)                       | ✅   |
| Modèle membre ↔ parcelle daté                                   | s12, s17, s18, s19 c7, s32                   | ✅   |
| Coordonnées (profil membre)                                     | s16 (+ saisie par le bureau en s12)          | ✅   |
| Questions au bureau, catégories routées                         | s23 (modèle en s10)                          | ✅   |
| Notes internes et historique par membre                         | s24                                          | ✅   |
| Import annuel des relevés d'eau + rapport par email             | s17                                          | ✅   |
| Historique de consommation d'eau                                | s18                                          | ✅   |
| Signalements (public anonyme + membre identifié)                | s10, s22                                     | ✅   |
| Publication des analyses d'eau                                  | s09                                          | ✅   |
| Documents partagés                                              | s31                                          | ✅   |
| Documents nominatifs physiquement séparés                       | s32                                          | ✅   |
| Campagnes email Brevo (4 modèles + campagne libre)              | s25                                          | ✅   |
| Envoi échelonné / budget quotidien                              | s26                                          | ✅   |
| Relances d'impayés activables                                   | s29                                          | ✅   |
| Publipostage PDF                                                | s28                                          | ✅   |
| Groupes de destinataires                                        | s27                                          | ✅   |
| Statistiques d'ouverture et de clic                             | s30                                          | ✅   |
| Modèles de documents (unitaire + lot)                           | s36                                          | ✅   |
| Facturation membres : interface + Pennylane                     | s19, s20                                     | ✅   |
| Redirection de paiement                                         | s21                                          | ✅   |
| Multi-tenant                                                    | s01                                          | ✅   |
| Export individuel d'un membre                                   | s40                                          | ✅   |
| Simulation de rôle SuperAdmin                                   | s41                                          | ✅   |
| Export et portabilité                                           | s38, s39                                     | ✅   |
| Module Vote (ASL Community)                                     | s33                                          | ✅   |
| Module Voirie                                                   | s34                                          | ✅   |
| Module Petites annonces                                         | s35                                          | ✅   |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story : 37 lignes du tronc commun et 3 modules.
- La classification de s27b (l. 1989-1997) est cohérente avec le PRD (l. 72). Convocation, facture et relance y sont statutaires, et la classification reste une donnée de configuration à faire confirmer par le conseil RGPD.

## Périmètre

- [x] Aucune story ne reprend un élément du cimetière.
  - s27b refuse explicitement une case « information obligatoire » sur la campagne libre (l. 2000-2002). Cela durcit la règle ; ça n'élargit rien.
  - s42 ne promet toujours aucun accès aux membres sans email (l. 2755-2759).
- [x] Aucune story ne dépasse le périmètre, sauf trois exceptions déclarées et justifiées : s39, s12b et s12c.

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, sauf les dérogations déclarées. Les ajouts de s08 (purge appelable seule) et de s12b (planification de la purge) restent rattachés à une valeur, et aucun n'est une couche technique isolée.
- [ ] Chaque critère peut devenir un test : presque.
  - Deux comportements testables ne vivent que dans les notes : la nature de la relance en s29 (m16) et la détection inverse en s12c (m19).
  - s27b c1 énumère des types d'envoi qui n'existent pas encore au moment de sa livraison (m18).
- [x] Les notes agentiques sont présentes et utiles. Celles de s27b donnent la classification et les deux arbitrages à ne pas « corriger ». Il reste quelques renvois et libellés périmés (m20, m21).
- [x] La complexité est notée et aucune story n'est à 5. J'ai vérifié la répartition 3 / 19 / 16 / 9 = 47 story par story. Les neuf stories à 4 expliquent leur risque, et s03 et s26 portent un seuil de scission qui dit comment se reporter dans `docs/stories.md`.

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable : pas de cycle, aucune dépendance vers une story postérieure.
  - Nouvelles arêtes vérifiées : s12b → s08 ; s12c → s05, s06 ; s29 → s27b ; s42 → s27b. Toutes pointent vers des stories antérieures.
  - En-têtes et récapitulatif concordent. s38 compte bien 27 dépendances (l. 2521, l. 2825).
- [x] Les ids sont bien formés, uniques et identiques entre les en-têtes et le récapitulatif. Les ids intercalés (s01b, s04b, s12b, s12c, s27b) sont légitimes.
- [x] Pas de chevauchement. La répartition entre s25 (exclusion totale), s27 (extension aux nouvelles cibles) et s27b (réintégration statutaire) est nette, et s29 et s42 consomment désormais la nature au lieu de la fixer.

## Constats

### Mineurs

**m16 : mineur : s29, le comportement d'un membre désinscrit face à la relance automatique n'a pas de critère.**

- La correction de M7 est portée par la note de s29 (l. 2096-2099), pas par un critère.
- s42 c3 (l. 2734), lui, teste les deux natures sur un cas précis. s27b c3 (l. 1963) ne vérifie que les trois cibles de campagne, pas la série de relances de s29.
- Un contournement du calcul de la cible dans s29, c'est-à-dire exactement le défaut de M7, passerait donc tous les tests.
- À corriger : ajouter à s29 un critère symétrique de s42 c3. Un membre désinscrit en impayé reçoit la relance avec la nature `statutaire` (valeur du premier tenant) et ne la reçoit pas avec `facultative`.

**m17 : mineur : s42, le gabarit de l'email de lancement reste implicite.**

- c3 (l. 2734) suppose qu'on peut se désinscrire « depuis l'email de lancement ». L'email porte donc le pied de page de s25, avec son lien de désinscription.
- Comme le lancement est `statutaire`, s27b c4 (l. 1964) impose aussi la mention « reçu malgré la désinscription ».
- Or la note (l. 2770-2771) dit que s42 réutilise l'invitation de s15, et s15 est explicitement un email transactionnel sans habillage de campagne (l. 1361-1363).
- À corriger : écrire dans s42 que l'email de lancement porte l'habillage de s25 (lien de désinscription et mention statutaire de s27b), tout en reprenant le texte et le lien de s15.

**m18 : mineur : s27b c1 déclare la nature de types d'envoi livrés plus tard.**

- c1 (l. 1961) énumère « la relance automatique d'impayé (s29), l'invitation de lancement et sa relance (s42) ». Ces types d'envoi n'existent pas quand s27b est livrée.
- Cela contredit la règle de s02 (l. 338-343), selon laquelle « les clés propres à une story arrivent avec elle ».
- À corriger : soit dire explicitement que s27b déclare ces clés et leur seed avant leurs émetteurs (ce qui est testable sur la configuration seule), soit limiter c1 aux types de s25 et laisser s29 et s42 déclarer chacune la nature de leurs envois, avec le seed du tableau.

**m19 : mineur : s12c, la détection inverse ne vit que dans les notes.**

- La convention qui rend une colonne de clé de fichier reconnaissable, et l'échec du test sur une colonne conforme absente de l'inventaire (l. 1153-1157), sont un comportement testable.
- C'est ce comportement qui transforme un oubli en test rouge, mais c3 (l. 1105) ne vérifie que les colonnes inventoriées.
- À corriger : en faire un critère, vérifié par une colonne de contrôle, sur le modèle de s39 c3 (l. 2598).

**m20 : mineur : récapitulatif et libellés périmés.**

- Le paragraphe des écarts avec le PRD (l. 2856) en compte « quatre » : s04, s27, s38 et l'identité visuelle. Il omet s03, désormais à 4 alors que la ligne « Connexion par lien magique » est notée 3 au PRD (l. 65). La note de s03 justifie bien ce score (l. 405), mais le paragraphe n'a pas été mis à jour.
- s26 (l. 1885-1886) attribue à un « Mineur m4 » la règle de report de la scission. Cette règle vient de m15 ; m4 portait sur le planificateur.
- À corriger : « cinq écarts », en ajoutant s03, et « mineurs m4 et m15 ».

**m21 : mineur : la règle transverse cite un type d'envoi qui n'existe pas.**

- La l. 53 dit qu'un désinscrit cesse de recevoir « les campagnes libres et les annonces d'actualité ».
- Aucune story n'envoie d'annonce d'actualité par email, et le tableau de s27b (l. 1989-1997) ne connaît pas ce type. Un agent qui lit la règle transverse pourrait l'inventer au `/ks-research` de s27b.
- À corriger : retirer « annonces d'actualité », ou préciser qu'une telle annonce passe par la campagne libre.

**m5 : mineur, pour mémoire : s39, s12b et s12c sont hors du tableau du PRD.**

- Les trois dérogations sont déclarées, bornées et justifiées. Rien à corriger.

## Verdict

Aucun problème critique :

- toutes les lignes du périmètre sont couvertes ;
- aucune story ne reprend un élément du cimetière ;
- aucune story n'est à 5 ;
- aucun cycle et aucune dépendance vers une story postérieure.

Le majeur M7 est fermé, avec les preuves ci-dessus, et les mineurs m8 à m15 aussi. Les six nouveaux mineurs se corrigent dans le markdown. Le plus utile est m16, à traiter avant `/ks-plan s29`. m18 et m21 sont à régler avant `/ks-research s27b`, et m17 avant `/ks-plan s42`. Aucun ne bloque s03, la prochaine story.

Fichiers relus :

- `/workspace/docs/prd.md`
- `/workspace/docs/stories.md`
- `/workspace/templates/stories-review-checklist.md`
- `/workspace/docs/reviews/stories.md` (revue précédente)

Max severity: minor
Stories ready: yes
