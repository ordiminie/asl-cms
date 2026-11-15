# Revue du découpage : ASL-CMS (Lp)

> J'ai relu `docs/stories.md` (version de travail non commitée, 67 stories) en partant de zéro, face à `docs/prd.md`, avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> Troisième passe, le 15/11/2026. Elle fait suite à l'ajout de s53 à s57 (réponses de La Fourche) et aux amendements portés le même jour sur s12, s12d, s13, s17 à s20, s27 à s29, s33, s38 et s42.
> Le fichier dépasse la limite de lecture : je l'ai lu par passes ciblées. J'ai lu en entier s12d, s13, s14, s16, s17 à s24, s27 à s30, s32, s33, s40, s42, s52, s53 à s57 et le récapitulatif. Je n'ai pas fait de diff git (pas d'accès au shell).
> Stories déjà livrées (une revue existe dans `docs/reviews/`) : s01 à s14, s16, s22 à s26, s43 à s49, s51, s52. Les amendements du 15/11 touchent surtout des stories qui ne sont pas encore livrées.

**En bref : 1 critique, 5 majeurs, 7 mineurs. Le découpage n'est pas prêt.**

Le critique ne vient pas d'un oubli de couverture. Cinq stories hors périmètre (s53 à s57), dont le texte dit lui-même qu'elles doivent être validées et qu'elles peuvent relever d'un devis complémentaire, sont devenues des dépendances de huit stories du cœur pas encore livrées.

## Couverture du périmètre

| Ligne du PRD (core loop) | Couverte par | OK |
| --- | --- | --- |
| CMS de pages génériques | s04 | oui |
| Attribution des rôles | s14 (+ s03b) | oui |
| Permissions configurables | s37 (+ s03b) | oui |
| Lien magique + suivi d'adoption | s03, s03c, s12d, s42 | oui |
| Pages publiques + contact archivé | s04, s08 | oui |
| Navigation du site public | s04b, s50 | oui |
| Identité visuelle | s01b, s02 | oui |
| Limitation de débit | s08b | oui |
| Actualités | s05 | oui |
| Présentation du bureau | s06 | oui |
| Désinscription et classification | s25, s27b | oui |
| Bandeau d'alerte | s07 | oui |
| SEO | s11 | oui |
| Import initial des membres | s13 (+ s53 pour les multi-terrains) | oui |
| Modèle membre ↔ parcelle daté | s12 (+ s57 pour la coupure) | oui |
| Coordonnées | s16 (+ s54, s55) | oui |
| Questions au bureau | s23 | oui |
| Notes internes | s24 | oui |
| Import des relevés d'eau | s17 | oui |
| Historique de consommation (« agrégée si multi-parcelles ») | s18 | oui, mais voir M5 |
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

- [x] Chaque fonctionnalité du tableau « Replicated (core loop) » est livrée par au moins une story. Aucune ligne n'est orpheline. Une divergence de contenu sur s18 est traitée en M5.

## Périmètre

- [x] Aucune story ne fait revenir un élément du cimetière.
  - s54 n'est pas un plan B de connexion : donner une adresse à une fiche sans email, c'est déjà ce que fait s12d.
  - s57 ne code aucune purge.
  - s33 ne compte toujours aucune voix.
  - s57 ne contient aucune logique de prorata ni de dette.
- [ ] **Des stories dépassent le périmètre : s53 à s57 (voir C1).**

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout. s53 à s57 ont toutes un comportement observable.
- [ ] Tous les critères ne sont pas testables à la livraison : plusieurs supposent une story jouée plus tard (M1).
- [x] Notes agentiques présentes et utiles, y compris sur s53 à s57 (références aux réponses de La Fourche, risques, questions à trancher).
- [x] Complexité notée, aucun 5. s53 et s54 sont à 4, avec leur risque énoncé.

## La liste dans son ensemble

- [ ] Ordre des dépendances : aucun cycle dans les colonnes « Dépend de ». En revanche, des dépendances manquent (M2) et des critères renvoient en avance (M1). L'exécutabilité dépend aussi d'une décision de périmètre (C1).
- [x] Ids bien formés et uniques. s53 à s57 suivent `s<numéro>-<slug>` et leurs titres correspondent au récapitulatif.
- [ ] Il reste des contradictions et des recouvrements entre s53 et s54, et entre les nouvelles stories et les anciennes (M3, M4).

**Décomptes vérifiés contre le récapitulatif :**

- 67 lignes.
- Complexité : 5 à 1, 23 à 2, 26 à 3, 13 à 4. Exact.
- La liste des treize stories à 4 est exacte, ainsi que celle des treize autres stories « hors tableau ».

## Constats

### Critique

**C1 — périmètre (s53 à s57, et s18, s19, s27, s28, s29, s33, s38, s42).**

- Le récapitulatif (l. 4212) et l'encadré des l. 3893-3900 le disent eux-mêmes : les cinq stories sont « hors du tableau de périmètre du PRD », sont « à valider avant tout `/ks-research` » et « peuvent relever d'un devis complémentaire ».
- Le PRD n'a pas été amendé.
- Pourtant, huit stories du cœur pas encore livrées en dépendent désormais :
  - s18 et s19 dépendent de s53 ;
  - s27 dépend de s54 ;
  - s28 dépend de s55 ;
  - s29 et s42 dépendent de s53 et s54 ;
  - s33 dépend de s53 ;
  - s38 dépend de s53, s54 et s55.
- Si la validation ou le devis est refusé, l'angle n°1 (s18, alors que s17 et s19 sont attendues pour janvier 2027), les relances, le lancement et le vote se retrouvent bloqués sur un travail hors périmètre. L'ordre n'est donc pas exécutable tant que la décision de périmètre n'est pas prise.
- Le sujet n'est pas le même pour toutes les stories :
  - s53 (PRD l. 75 « dédoublonnage des propriétaires multi-parcelles » et l. 81 « agrégée si multi-parcelles »), s55 (l. 77 et l. 89) et s57 (l. 76 et la contrainte de rétention) prolongent des lignes existantes ;
  - s54 (plusieurs adresses connectables, accès par un tiers) et s56 (import annuel) sont des fonctionnalités nouvelles.
- Correction attendue (décision humaine) :
  - soit repasser par le PRD pour y inscrire ces cinq fonctionnalités, comme pour s26 et s52 ;
  - soit, en cas de refus, retirer les dépendances des huit stories du cœur.

### Majeurs

**M1 — s53, s54, s55 : des critères renvoient à des stories jouées après elles, ils ne sont pas testables à la livraison.**

- s53 critère 2 : il demande l'accès aux factures (s19) et à la consommation (s18) depuis « Mes terrains ». Or s53 se joue avant s18 et s19, qui portent déjà ce même critère (l. 1736 et l. 1777). C'est donc à la fois un doublon et une dépendance inverse.
- s54 critère 2 : il couvre les relances (s29) et les invitations (s42), toutes deux jouées après s54.
- s54 critère 7 : il couvre l'import s56, joué après s54.
- s55 critère 2 : il porte sur le publipostage (s28, jouée après, qui a déjà le critère, l. 2352).
- s55 critère 6 : il couvre l'import s56.
- Chaque critère doit être ramené aux émetteurs et aux imports existants à la livraison. Le reste va dans la story consommatrice.

**M2 — s57 : des dépendances manquent.**

- Le critère 5 exige que le vendeur voie, pendant le délai, ses factures (s19) et ses documents (s32) d'avant la vente.
- Or s57 ne dépend que de s12, s12d et s53. L'en-tête ne la contraint qu'à passer « après s53 », ce qui permet de la jouer avant s19 et s32.
- Il faut ajouter s19 et s32, ou retirer ces deux ressources du critère.

**M3 — s53 et s54 se contredisent sur une adresse partagée entre fiches.**

- s53 critère 1 : une même adresse sur plusieurs fiches désigne une seule personne, avec un seul compte.
- s54 critère 5 : « une adresse déjà utilisée par un autre compte de l'association est refusée à l'ajout ».
- Rien ne dit comment le bureau rattache au compte existant une fiche créée à la main pour un deuxième terrain acheté plus tard. C'est pourtant le chemin nominal de s56 (« les nouveaux membres sont rajoutés manuellement »).
- Il faut décider de cette règle dans les deux stories.

**M4 — le nouveau modèle (fiche = terrain, personne = compte) n'est pas reporté dans les stories pas encore livrées qui raisonnent « par membre ».**

- s32 : « un dossier par membre », sans dépendance à s53, alors que les notes de s53 la citent parmi les lecteurs à passer au pluriel. C'est la ressource la plus sensible du produit.
- s40 : « toutes les données le concernant » doit couvrir toutes les fiches d'une même personne. Avec s54, le compte d'un enfant peut aussi obtenir la copie des données du parent, notes internes comprises (point RGPD).
- s42 critère 5 : « destinataires email + courriers = effectif de l'association » devient faux. Avec s54, une fiche vaut N adresses ; avec s53, un compte vaut N fiches.
- s28 : rien n'empêche d'envoyer N courriers à un même propriétaire de plusieurs terrains sans email.
- s13, note l. 1552 : « un propriétaire de plusieurs parcelles reste une fiche membre » contredit le modèle retenu par s53 (« une fiche par client Pennylane, donc par terrain »).
- Pour information : la note de s13 indique que l'import livré rejette les lignes à adresse partagée, alors que son critère 4 promettait « un seul compte ». s53 en porte la correction.

**M5 — s18 s'écarte du PRD sans l'amender.**

- PRD l. 81 : « agrégée si multi-parcelles ».
- s18 critère 2 et notes : « le cumul n'est pas exigé », renvoyé à `/ks-design`.
- Il faut soit amender le PRD, soit écrire dans s18 que « agrégée » se lit « regroupée dans un seul accès ».

### Mineurs

- **m1 — s29, note l. 2438.** La note parle du « budget de s52 (100 par jour) ». Le budget de s52 est de 300 par jour, avec une réserve de 100 : il laisse 200 envois reportables. Les 100 par jour sont le plafond des campagnes de s26. Le test de volume de 200 relances en dépend.
- **m2 — s38, l. 2881 et 2906, récapitulatif l. 4249.** Le texte dit « vingt-sept dépendances » alors que la liste en compte maintenant 31.
- **m3 — s53 critère 4.** Il dépend du fichier réel, hors git (« 25 lignes, 10 adresses partagées »). Il faut une fixture anonymisée qui reproduise le cas.
- **m4 — s57 critère 2, et s56.**
  - s57 : « le bureau consulte l'espace devenu inactif » ne dit pas quel écran le bureau utilise.
  - s56 : la story suppose que l'identifiant Pennylane est saisi sur une fiche faite à la main. C'est un critère de s20, avec laquelle s56 n'a aucune relation d'ordre.
- **m5 — récapitulatif.**
  - s53, s55 et s57 sont présentées comme « hors tableau » alors qu'elles prolongent des lignes existantes (voir C1).
  - La mention « pas encore passées en revue du découpage » est à mettre à jour après cette revue.
- **m6 — s33, note l. 2643.** Le nom d'un interlocuteur tiers chez ASL Community figure dans un dépôt public. Cela va contre la règle de caviardage des documents client.
- **m7 — s54.**
  - Le critère 3 ne dit pas si le bureau peut ajouter une adresse : il écrit « modifie et supprime ».
  - L'accès d'un tiers (un enfant) aux données personnelles d'un membre est à faire valider par le conseil RGPD et à inscrire dans l'amendement du PRD.

## Verdict

- Couverture complète : 37 lignes du cœur et 3 modules.
- Aucune fuite du cimetière.
- Ids conformes, décomptes exacts.

Le découpage n'est pas prêt pour autant. Cinq stories hors périmètre, en attente de validation, sont devenues des dépendances de huit stories du cœur (C1). S'y ajoutent des critères qui renvoient à des stories jouées plus tard, des dépendances manquantes et un modèle fiche / compte qui n'a pas été reporté partout (M1 à M5).

Max severity: critical
Stories ready: no
