# Revue du découpage : ASL-CMS (Lp)

> J'ai relu `docs/stories.md` (version de travail non commitée, 67 stories) face à `docs/prd.md` (version de travail, amendée le 15/11/2026), avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> C'est la quatrième passe du 15/11/2026. Elle fait suite aux corrections apportées après la revue précédente (constats C1, M1 à M5, m1 à m7).
> Le fichier dépasse la limite de lecture, je l'ai donc lu par passes ciblées. J'ai lu en entier l'en-tête, les réserves, s12, s12d, s13, s14, s16 à s33, s36 à s42, s52 à s57 et le récapitulatif. Je n'ai pas fait de diff git (pas de shell).

**En bref : 0 critique, 3 majeurs, 9 mineurs.** Le critique C1 est levé : le PRD a maintenant une ligne datée pour chacune des stories s53 à s57. M1 à M5 sont corrigés. Les trois majeurs sont nouveaux et viennent des corrections : une règle de confirmation d'adresse qui peut couper les 300 adresses existantes, une réserve RGPD du PRD absente du découpage, et un critère de s40 contredit par sa propre note.

## Couverture du périmètre

Le PRD compte 42 lignes au cœur (37 d'origine et 5 ajoutées le 15/11), plus 3 modules.

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
| Import initial des membres | s13 (+ s53, s54, s55 pour les corrections) | oui |
| Import annuel des coordonnées (15/11) | s56 | oui |
| Modèle membre ↔ parcelle daté | s12 | oui |
| Accès de l'ancien propriétaire (15/11) | s57 | oui |
| Coordonnées | s16 (+ s55) | oui |
| Un seul accès pour plusieurs terrains (15/11) | s53 (+ s18, s19, s32, s40) | oui |
| Plusieurs adresses connectables (15/11) | s54 (+ s29, s42) | oui, mais voir M1 et M2 |
| Adresse terrain / domicile / entreprise (15/11) | s55 (+ s28) | oui |
| Questions au bureau | s23 | oui |
| Notes internes | s24 | oui |
| Import des relevés d'eau | s17 | oui |
| Historique de consommation (sans cumul, PRD précisé le 15/11) | s18 | oui |
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
| Export individuel d'un membre | s40 | oui, mais voir M3 |
| Simulation de rôle SuperAdmin | s41 (+ s48) | oui |
| Export et portabilité | s38, s39 | oui |
| Module Vote | s33 | oui |
| Module Voirie | s34 | oui |
| Module Petites annonces | s35 | oui |

- [x] Chaque fonctionnalité du tableau « Replicated (core loop) » est livrée par au moins une story. Aucune ligne n'est orpheline.
  - Les cinq lignes datées du 15/11 sont couvertes, et leur contenu correspond aux stories : signalement des regroupements (s53), aucune création ni changement de propriété (s56), espace consultable par le bureau (s57), libellé d'entreprise imprimé (s55 et s28).
  - Les complexités concordent avec le PRD (4, 4, 2, 3, 3).

## Périmètre

- [x] Aucune story ne fait revenir un élément du cimetière.
  - s54 n'est pas un plan B de connexion : une fiche sans adresse reste gérée par courrier.
  - s57 ne code aucune purge, ni prorata, ni solde.
  - s56 ne crée aucun membre et ne touche pas aux appels de fonds.
  - s33 ne compte aucune voix.
- [x] Aucune story ne dépasse le périmètre. s53 à s57 ont maintenant leur ligne au PRD (C1 levé), et la note du PRD l. 105 dit explicitement que la question contractuelle n'a pas d'effet sur l'ordre.

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout. La seule transverse, s39, est assumée et bornée dans son en-tête.
- [ ] **Critères testables : trois défauts** (M1, M3, et dans une moindre mesure m6).
- [x] Les notes agentiques sont présentes et utiles. Exception : s54 ne mentionne pas la réserve RGPD que le PRD lui attache (M2).
- [x] Complexité notée, aucun 5. Les treize stories à 4 énoncent leur risque, y compris s53 et s54.

## La liste dans son ensemble

- [x] Ordre des dépendances : pas de cycle, pas de référence en avant bloquante. M1 et M2 de la revue précédente sont corrigés :
  - s57 dépend maintenant de s19 et s32 ;
  - les critères de s53, s54 et s55 renvoient aux stories consommatrices (« porte ce critère de son côté »), et chaque consommatrice porte bien ce critère (s18 c2, s19 c1, s28 c2-c3, s29 c6, s42 c5-c6, s56 c3).
  - Il reste des dépendances déclarées incomplètes, sans effet bloquant (m5).
- [x] Ids bien formés, uniques et conformes au récapitulatif.
- [x] Décomptes vérifiés : 67 lignes ; cinq à 1, vingt-trois à 2, vingt-six à 3, treize à 4 ; la liste des treize stories à 4 et celle des treize stories hors tableau sont exactes.
- [x] Recouvrements : la contradiction entre s53 et s54 sur l'adresse partagée (ancien M3) est tranchée. La règle commune est écrite dans les notes de s53, dans s53 c3 et dans s54 c5. Il reste une ambiguïté sur le retrait d'une adresse (m4).

## Constats

### Critique

Aucun.

### Majeurs

**M1 — s54 (et par ricochet s29, s42) : on ne sait pas si une adresse importée ou saisie par le bureau est « confirmée ».**

- s54 c4 : seule une adresse « ajoutée par le membre » doit être confirmée par lien.
- s54 c2, s29 c6 et s42 c6 n'envoient qu'aux adresses **confirmées**, et la note l. 4034 précise qu'« une adresse non confirmée ne reçoit rien et ne permet pas de se connecter ».
- Rien ne dit quel statut prennent :
  - les ~300 adresses déjà présentes (import s13, saisie du bureau en s12, comptes ouverts par s12d) ;
  - les adresses que l'import annuel (s56) ou le bureau ajouteront.
- Selon la lecture, deux tests opposés sont possibles. Dans la lecture stricte, la livraison de s54 coupe connexion et campagnes pour tous les membres existants, et le lancement (s42) n'envoie rien. C'est une régression sur des stories déjà livrées (s12d, s25, s26).
- Correction attendue : écrire dans s54 quelles origines d'adresse sont confirmées d'office (fichier, bureau) et lesquelles exigent le lien (membre), avec un critère de non-régression sur les adresses existantes.

**M2 — s54 : une dépendance externe bloquante du PRD n'est pas reportée dans le découpage.**

- PRD, _Constraints_ (« Dépendances externes bloquantes ») : « Validation RGPD de l'accès d'un tiers (un proche du propriétaire, connecté avec sa propre adresse) aux données d'un membre ». La ligne s54 du PRD y renvoie.
- Le tableau des réserves de `docs/stories.md` (l. 84-97, « Cinq points ») ne la contient pas, et les notes de s54 n'en parlent pas. Seule s40 l'évoque, pour la copie des données.
- Résultat : rien n'empêche de livrer s54, qui ouvre à un tiers les factures, la consommation et les documents nominatifs d'un membre, avant l'avis que le PRD déclare bloquant. (Ce point était déjà noté en m7 la dernière fois ; le PRD l'a depuis promu au rang de dépendance bloquante, d'où le passage en majeur.)
- Correction attendue :
  - ajouter une sixième ligne au tableau des réserves, avec s54 dans la colonne « Bloque » (et s40 pour la copie) ;
  - écrire dans s54 « ne pas démarrer avant l'avis », ou nommer le contournement retenu.

**M3 — s40 : le critère 2 est contredit par le défaut proposé dans sa propre note.**

- c2 : la copie demandée par le membre connecté contient « toutes les données le concernant, y compris les notes internes écrites sur lui par le bureau (s24) ».
- Note l. 3024-3028, ajoutée le 15/11 : « Défaut proposé tant que l'avis n'est pas rendu : la copie en ligne exclut les notes internes, et la copie complète passe par le bureau ».
- Un implémenteur qui suit la note échoue au critère, et l'inverse aussi. On ne peut pas écrire un test unique tant que l'avis n'est pas rendu.
- Correction attendue : réécrire c2 selon le défaut retenu (copie en ligne sans notes internes, copie complète par le bureau), ou retirer le défaut de la note.

### Mineurs

- **m1 — s29, note l. 2446 (repris de la revue précédente, non corrigé).**
  - La note dit « Le budget de s52 (100 par jour) les étale ».
  - Le budget de s52 est de 300 avec une réserve de 100 : il reste 200 envois reportables par jour. Les 100 par jour sont le plafond des campagnes de s26.
  - Le test de volume (200 relances le même jour) en dépend.
- **m2 — s38, l. 2894 et l. 2917-2920, et récapitulatif l. 4278 (non corrigé).**
  - Le texte dit « vingt-sept dépendances » ; la liste en compte 31 (s53, s54 et s55 ajoutées).
  - La phrase « La liste ci-dessus fait foi : vingt-sept aujourd'hui » est fausse.
- **m3 — s53 c5 (non corrigé).** Le critère s'appuie sur le fichier réel, hors git (« 25 lignes, 10 adresses partagées »), donc la CI ne peut pas l'exécuter. Il faut une fixture anonymisée qui reproduise le cas.
- **m4 — s53 c6 et s54 c6 : retrait d'une adresse.**
  - s53 : l'accès ne se ferme que quand plus aucune fiche ne porte l'adresse.
  - s54 : « Retirer une adresse ferme l'accès de cette adresse seule ».
  - Pour une adresse portée par deux fiches, on peut lire s54 comme une fermeture du compte entier. Il faudrait écrire « ferme l'accès de cette adresse à cette fiche ».
- **m5 — dépendances déclarées incomplètes (sans effet bloquant, ces stories étant livrées ou placées après).**
  - s53 c7 agit sur le calcul de la cible de s25 sans dépendre de s25.
  - s54 c2 cite s26 sans en dépendre.
  - s56 suppose que le bureau saisit l'identifiant Pennylane, ce que permet s20 (s20 c4), sans dépendre de s20. L'en-tête (« s56 après s53, s54 et s55 ») permet de la jouer avant s20.
  - L'en-tête l. 33 dit encore « s57 après s53 » alors que s57 dépend maintenant de s19 et s32.
- **m6 — s56 c2 et la note l. 4116-4118.** Le critère met les coordonnées à jour sans condition. Le défaut proposé, lui, protège une valeur modifiée sur le site depuis le dernier import. Il faut faire entrer l'exception dans le critère, sous peine d'un test faux une fois la question tranchée.
- **m7 — s54 c3 et s57 face à s54.**
  - s54 c3 ne dit toujours pas si le bureau peut **ajouter** une adresse sur une fiche qui en a déjà une (« modifie et supprime »). s53 c3 ne le suggère qu'indirectement.
  - s57 parle de « son accès », au singulier, et ne dépend pas de s54. Il faut préciser que la fin du délai ferme l'accès de **toutes** les adresses et de tous les comptes reliés à la fiche (celle d'un enfant, par exemple), et ajouter s54 aux dépendances.
- **m8 — s33, note l. 2656 (non corrigé).** Le nom d'un interlocuteur tiers chez ASL Community figure dans un dépôt public, contre la règle de caviardage des documents client. Dans la même story, la note l. 2647 (« la **seule** action réservée du produit ») est périmée : s56 c1 réserve aussi l'import annuel à la présidente.
- **m9 — s53 et la règle transverse « Identité d'un membre » (l. 59-63).**
  - La règle exclut l'email de toute clé de dédoublonnage d'import, notamment parce qu'il peut être « partagé dans un foyer ».
  - s53 c5 relie automatiquement à l'import les fiches qui partagent une adresse, et sa note pose « toujours une seule personne ». Deux conjoints propriétaires de terrains distincts avec une adresse commune se retrouveraient sur un même compte.
  - Le signalement au rapport atténue le risque. La règle transverse devrait nommer l'exception (le compte de connexion suit l'adresse, la fiche garde sa clé primaire), et s27 c5 devrait dire si le décompte « avec email » se fait en fiches ou en adresses depuis s54.

### Suivi de la revue précédente

| Constat | État |
| --- | --- |
| C1 | levé (PRD amendé, cinq lignes datées) |
| M1 | corrigé |
| M2 | corrigé (deps de s57) ; en-tête l. 33 à mettre à jour (m5) |
| M3 | corrigé (règle de l'adresse partagée) |
| M4 | corrigé (s13, s28, s32, s40, s42) |
| M5 | corrigé (PRD et s18 alignés) |
| m1 | non corrigé (m1) |
| m2 | non corrigé (m2) |
| m3 | non corrigé (m3) |
| m4 | en partie : l'écran de consultation de s57 c2 n'est toujours pas désigné ; s20 manque aux deps de s56 (m5) |
| m5 | corrigé |
| m6 | non corrigé (m8) |
| m7 | en partie (m7, et passé en M2 pour le volet RGPD) |

## Verdict

- Couverture complète : 42 lignes du cœur et 3 modules.
- Aucune fuite du cimetière.
- Ids conformes, décomptes exacts, aucun 5.
- L'ordre est exécutable.

Aucun constat critique, donc le découpage passe le gate. Je recommande quand même de traiter M1, M2 et M3 avant le `/ks-research` de s54, s40 et s42 : ils touchent l'accès aux données personnelles et la non-régression des envois déjà livrés.

Max severity: major
Stories ready: yes
