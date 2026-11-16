# Revue du découpage : ASL-CMS (Lp)

> J'ai relu `docs/stories.md` (HEAD de main, commit 9e2260aa, 67 stories) face à `docs/prd.md` (HEAD), avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> C'est la septième passe, le 16/11/2026. Elle vérifie les corrections de m1 à m8 de la sixième passe et les décisions de l'utilisatrice du 16/11 sur m1, m2 et m8. Je ne remets pas ces décisions en cause : je vérifie que le texte les applique de façon cohérente et testable.
> Ce que j'ai lu : l'en-tête en entier (l. 1-106), s29, s40, s53 à s57 et le récapitulatif (l. 4207-4377). J'ai contrôlé le reste par recherche ciblée (`titulaire`, `supprim… adresse`, `sans adresse`), ce qui m'a fait lire s12 c4 (l. 1072) et un critère de s12d (l. 1454). Je n'ai pas de shell, donc pas de diff git : j'ai lu les corrections comme du texte neuf.

**En bref : 0 critique, 2 majeurs, 4 mineurs.** Les huit mineurs de la sixième passe sont corrigés. Deux des trois décisions du 16/11, appliquées à la lettre, entrent en contradiction avec des critères existants :

- la règle « pas de suppression de l'adresse titulaire sans remplaçante » contredit s12d, une story déjà livrée (M1) ;
- la règle « une adresse titulaire ailleurs ne peut pas être supplémentaire » contredit la règle de s53 « même adresse = même personne » (M2).

## Couverture du périmètre

Le PRD n'a pas changé depuis la passe précédente : 42 lignes au cœur (l. 62-103) et 3 modules activables (l. 111-113).

| Ligne du PRD (core loop) | Couverte par | OK |
| --- | --- | --- |
| CMS de pages génériques | s04 (+ s44) | oui |
| Attribution des rôles | s14 (+ s03b) | oui |
| Permissions configurables | s37 (+ s03b) | oui |
| Lien magique + suivi d'adoption | s03, s03c, s42 | oui |
| Pages publiques + contact archivé | s04, s08 | oui |
| Navigation du site public | s04b, s50 | oui |
| Identité visuelle | s01b, s02 | oui |
| Limitation de débit | s08b | oui |
| Actualités | s05 | oui |
| Présentation du bureau | s06 | oui |
| Désinscription et classification | s25, s27b | oui |
| Bandeau d'alerte | s07 | oui |
| SEO | s11 | oui |
| Import initial des membres | s13 (+ s53, s54, s55) | oui |
| Import annuel des coordonnées | s56 | oui |
| Modèle membre ↔ parcelle daté | s12 | oui |
| Accès de l'ancien propriétaire | s57 | oui |
| Coordonnées | s16 (+ s54, s55) | oui |
| Un seul accès pour plusieurs terrains | s53 (+ s18, s19, s32, s40) | oui (voir M2 : un sous-cas est restreint par s54 c8 sans que s53 le dise) |
| Plusieurs adresses connectables | s54 (+ s29, s42) | oui (connexion supplémentaire derrière le paramètre de la réserve RGPD) |
| Adresse terrain / domicile / entreprise | s55 (+ s28) | oui |
| Questions au bureau | s23 | oui |
| Notes internes et historique | s24 | oui |
| Import des relevés d'eau | s17 | oui |
| Historique de consommation | s18 | oui |
| Signalements | s10, s22 | oui |
| Analyses d'eau | s09 | oui |
| Documents partagés | s31 | oui |
| Documents nominatifs séparés | s32 | oui |
| Campagnes Brevo | s25 | oui |
| Envoi échelonné + budget quotidien | s26, s52 | oui |
| Relances d'impayés | s29 | oui |
| Publipostage PDF | s28 | oui |
| Groupes de destinataires | s27 | oui |
| Statistiques de campagne | s30 | oui |
| Modèles de documents | s36 | oui |
| Facturation membres + Pennylane | s19, s20 | oui |
| Redirection de paiement | s21 | oui |
| Multi-tenant | s01, s02 | oui |
| Export individuel d'un membre | s40 | oui |
| Simulation de rôle SuperAdmin | s41 (+ s48) | oui |
| Export et portabilité | s38, s39 | oui |
| Module Vote | s33 | oui |
| Module Voirie | s34 | oui |
| Module Petites annonces | s35 | oui |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story. Aucune ligne n'est orpheline.

## Périmètre

- [x] Aucune story ne fait revenir un élément du cimetière.
  - s54 reste hors du « plan B de connexion » : une fiche sans adresse reste gérée par courrier (note l. 4073-4074, s56 c4).
  - s57 ne code ni purge, ni prorata, ni solde.
  - s56 ne crée aucun membre (c7).
  - s33 et s53 ne comptent aucune voix.
- [x] Aucune story ne dépasse le périmètre. Les treize stories hors tableau sont justifiées dans le récapitulatif (l. 4280-4294).

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout. La seule transverse, s39, est assumée et bornée.
- [ ] Chaque critère peut devenir un test : **non, pas entièrement**.
  - s54 c9 et le critère de s12d l. 1454 ne peuvent pas passer ensemble (M1).
  - s54 c8 et s53 c3/c5 non plus, pour l'adresse partagée en position mixte (M2).
  - s56 c4 garde trois imprécisions (m3).
- [x] Les notes agentiques sont présentes et utiles. La note de s29 (l. 2455-2457) est maintenant alignée sur c6.
- [x] Complexité notée, aucun 5. Les treize stories à 4 énoncent leur risque.

## La liste dans son ensemble

- [x] Ordre des dépendances : pas de cycle et pas de référence en avant bloquante. L'en-tête (l. 31-34) décrit maintenant la place de s25 (avant s18 et s19) et celle de s54 (après s26).
- [x] Ids bien formés (`s<numéro>[lettre]-<slug>`), uniques et conformes au récapitulatif.
- [x] Décomptes vérifiés :
  - 67 lignes : cinq à 1, vingt-trois à 2, vingt-six à 3, treize à 4 ;
  - la liste des treize stories à 4 est exacte ;
  - les dépendances de s40 sont identiques dans la story (l. 3025) et au récapitulatif (l. 4259), s22 et s23 compris.
- [x] Pas de recouvrement entre stories. Les contradictions relevées plus bas sont des conflits de règles entre s53, s54, s56 et s12d, pas deux stories qui revendiquent la même tranche.

## Constats

### Critique

Aucun.

### Majeurs

- **M1 — s54 c9 (l. 4021) contredit s12d (l. 1454), une story livrée : le bureau ne peut plus retirer la seule adresse d'une fiche.**
  - Ce que dit s54 c9 : « Le bureau ne supprime l'adresse titulaire qu'en désignant, dans la même opération, celle qui la remplace […]. Sans remplaçante, le site refuse la suppression. » Le critère ne prévoit aucune exception.
  - Une fiche qui n'a qu'une adresse n'a donc plus de remplaçante possible parmi les adresses actives. Le bureau ne peut plus la ramener à l'état « courrier uniquement ».
  - Or s12d, déjà livrée, garantit : « Renseigner une adresse email sur une fiche "courrier uniquement" lui ouvre un compte […] ; **la retirer referme l'accès** sans supprimer la fiche ». Son test casse dès s54. Le critère de non-régression de s54 (c6, l. 4018) ne protège que la connexion et les campagnes : il ne le voit pas.
  - Ce n'est pas cohérent avec le reste du texte :
    - l'invariant de c9 (« une fiche qui porte au moins une adresse active a exactement une adresse titulaire ») reste vrai pour une fiche sans aucune adresse ;
    - la note l. 4073 maintient la fiche « sans aucune adresse » ;
    - s56 c4 (l. 4133) produit lui-même cet état par l'import (« la fiche reste sans adresse, gérée par courrier »). Le fichier peut donc faire ce que le bureau ne peut pas faire.
  - Il y a aussi un enjeu RGPD : un propriétaire qui demande l'effacement de son adresse (rectification) ne peut pas être servi par le bureau.
  - Correction attendue : une phrase dans s54 c9, par exemple « sauf si c'est la dernière adresse active de la fiche : la fiche repasse "courrier uniquement" (s12d) ». Si le retrait de cette capacité est voulu, il faut le dire, retirer explicitement le critère de s12d et prévoir la mise à jour de son test.

- **M2 — s54 c8 (l. 4020) contredit s53 c1, c3 et c5 (l. 3943, 3945, 3947) : le propriétaire de plusieurs terrains est bloqué comme un proche.**
  - s53 pose qu'une adresse portée par plusieurs fiches désigne **toujours la même personne**, avec un seul compte. Le site n'a donc aucun moyen de distinguer « le proche qui est lui-même membre » de « la même personne qui possède un deuxième terrain ».
  - s54 c8 bloque toute adresse titulaire d'une autre fiche quand elle serait supplémentaire sur la fiche visée. La décision vise le proche, mais elle frappe aussi le multi-propriétaire dès que son adresse n'occupe pas la même position sur ses fiches. Deux cas :
    - (a) **voie du bureau, s53 c3** : le bureau saisit l'adresse `a@` (titulaire de la fiche A) sur une fiche B qui a déjà une adresse titulaire `b@`, par exemple un conjoint. s53 c3 demande « même personne ? » puis relie la fiche au compte. s54 c8 bloque avec un message. Les deux critères ne peuvent pas passer ensemble.
    - (b) **voie de l'import, s53 c5 et s54 c11** : la cellule de la fiche A contient « `a@` », celle de la fiche B « `b@`, `a@` ». `a@` est titulaire de A et serait supplémentaire sur B, donc elle est écartée et listée au rapport. La fiche B n'est pas reliée au compte de `a@`, et le propriétaire ne voit pas ce terrain. La fixture de s53 c5 (« 10 adresses partagées », qui reproduit le fichier réel) peut contenir ce cas. Son test, vert à la livraison de s53, peut alors casser à celle de s54.
  - Correction attendue, sans revenir sur la décision : écrire dans s53 (c3 et c5, ou la note l. 3984-3990) que s54 c8 restreint la règle de l'adresse partagée. Une adresse partagée n'est acceptée que si elle a la même position, titulaire ou supplémentaire, sur chaque fiche ; le cas mixte est refusé ou écarté au rapport, même quand il s'agit de la même personne. Demander aussi que le test de s53 c5 soit rejoué après s54. Si ce n'est pas l'effet voulu, la règle de c8 doit être affinée par l'utilisatrice : ce n'est pas au découpage d'en décider.

### Mineurs

- **m1 — s54 c8 : la décision ne couvre qu'un sens, et le cas « proche lui-même membre » revient par l'ordre inverse.**
  - c8 empêche d'**ajouter comme supplémentaire** une adresse déjà titulaire ailleurs. Il n'empêche pas l'inverse : une adresse déjà supplémentaire sur la fiche du parent qui devient **titulaire** d'une nouvelle fiche.
  - Ce changement de titre peut arriver par plusieurs voies : l'enfant achète un terrain plus tard et le bureau crée sa fiche (s53 c3) ; une modification de l'adresse titulaire (s54 c9) ; le fichier annuel (s56 c3) ; la désignation arbitraire de s56 c4.
  - On retrouve alors exactement la situation que la décision voulait éviter, avec les effets déjà décrits à la passe précédente : accès maintenu par s57, copie de s40 c3 élargie aux fiches du parent, droits de vote de s33 rattachés au même compte.
  - Correction attendue : dire dans c8 si le blocage vaut aussi dans ce sens (« une adresse supplémentaire d'une fiche ne peut pas devenir titulaire d'une autre fiche »), et le tester sur les mêmes voies.

- **m2 — s56 c4 renvoie à une correction par le bureau que s54 ne permet pas.**
  - s56 c4 notifie le bureau de chaque désignation arbitraire « pour vérifier le choix […] et le corriger au besoin (s54) ».
  - s54 c9 donne au bureau deux opérations : modifier la valeur de l'adresse titulaire, ou la supprimer en désignant une remplaçante. Aucune ne permet de **changer de titulaire entre deux adresses actives en gardant les deux**. Pour corriger le choix du site (le mauvais enfant désigné), le bureau devrait supprimer une adresse qu'il veut garder.
  - Correction attendue : ajouter à s54 c9 « le bureau désigne une autre adresse active comme titulaire ; l'ancienne devient supplémentaire », avec son test.

- **m3 — s56 c4 (l. 4133) et c3 (l. 4132) : trois imprécisions qui gênent le test.**
  - (a) **Canal de la notification.** Le texte ne dit pas comment le bureau est notifié : rapport éphémère de l'ADR 047, notification en back-office ou email. Un email serait décompté du budget de s52 (règle transverse), et s56 ne dépend pas de s52. L'ordre de l'en-tête la place probablement après, mais rien ne le déclare.
  - (b) **Adresses candidates et ordre d'application de c4 et c5.** Si la désignation de c4 retient une adresse venue d'un fichier précédent et absente du nouveau fichier, elle devient titulaire et échappe à c5, qui ne vise que les adresses « non titulaires ». Il faut préciser que les candidates sont les adresses qui restent actives après l'import : présentes dans le fichier, ou ajoutées sur le site.
  - (c) **Plusieurs adresses nouvelles.** s56 c3 dit « la nouvelle adresse devient titulaire ». Si la cellule en apporte plusieurs, laquelle prend le titre ? Probablement la première, par analogie avec la règle de création de s54 c9, mais ce n'est pas écrit.

- **m4 — Tableau des réserves (l. 101), s54 c2 et la note l. 4052-4056 ne mentionnent pas l'exception de s56 c4.**
  - La désignation arbitraire peut faire d'une adresse ajoutée par un proche (s54 c4 et c5) l'adresse titulaire. Elle se connecte alors **paramètre de la réserve désactivé**, avant l'avis du conseil RGPD. La note de s54 (l. 4066-4068) l'assume comme exception décidée le 16/11.
  - Le tableau des réserves dit pourtant encore que la connexion supplémentaire est « coupée par un paramètre du tenant » et que « ni s54 ni s40 n'attendent l'avis ». La note de s54 dit aussi que l'activer « est une décision de l'association **après** l'avis ».
  - Ce n'est pas une contestation de la décision : le tableau, qui sert de référence pour la réserve, en dit moins que la story. Correction attendue : citer s56 c4 dans la ligne « Avis RGPD sur l'accès d'un tiers » et inclure ce cas dans la question posée au conseil. Le test « dans les deux états » de s54 c2 peut aussi couvrir une adresse devenue titulaire par s56 c4.

### Suivi de la revue précédente

| Constat (sixième passe) | État |
| --- | --- |
| m1 (invariant contredit par la suppression) | corrigé selon la décision du 16/11 : s54 c9 et la note l. 4069-4071 disent que l'état « sans titulaire » n'existe pas. La correction fait naître M1 (dernière adresse) et m2 (changement de titulaire). |
| m2 (remplacement par le fichier) | corrigé : s56 c3, c4 (désignation et notification) et c5 (adresse venue du fichier qui disparaît) ; s54 c9 dit que l'ordre dans la cellule ne déplace pas le titre d'une fiche existante. Restent m3 et m4. |
| m3 (tableau des réserves périmé) | corrigé (l. 101 : « tout le fil de s24 », notes et échanges) |
| m4 (place de s25 dans l'en-tête) | corrigé (l. 31-33 : s53 après s25, s25 avant s18 et s19, s54 après s26) |
| m5 (dépendances de s40) | corrigé (s22 et s23 ajoutés, l. 3025 et l. 4259) |
| m6 (deux sens de « titulaire ») | corrigé (s53 c3 : « détenteur du compte ») |
| m7 (note de s29 face à c6) | corrigé (l. 2455-2457 : le design ne décide que de la présentation) |
| m8 (proche lui-même membre) | corrigé selon la décision du 16/11 : s54 c8 et la note de s53 l. 3988-3990. La correction fait naître M2 (même personne en position mixte) et m1 (sens inverse). |

## Verdict

- Couverture complète : 42 lignes du cœur et 3 modules.
- Aucune fuite du cimetière.
- Ids conformes, décomptes exacts, aucun 5.
- L'ordre est exécutable : pas de cycle, pas de référence en avant bloquante.
- Les huit mineurs de la sixième passe sont corrigés sur le fond.

Aucun constat n'est critique : le découpage passe le gate. Je recommande tout de même de traiter M1 et M2 avant le `/ks-research` de s54 et de s56 :

- M1 fait régresser un critère livré (s12d) ;
- M2 restreint en silence la ligne « Un seul accès pour plusieurs terrains » et peut casser le test de s53 c5.

Chacun se règle en une phrase, mais M2 demande une décision de l'utilisatrice sur la portée de la règle du 16/11. m1 à m4 se règlent en une phrase chacun ; m4 est le plus pressant des quatre, parce qu'il touche la réserve RGPD.

Max severity: major
Stories ready: yes
