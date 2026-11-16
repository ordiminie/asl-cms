# Revue du découpage : ASL-CMS (Lp)

> J'ai relu `docs/stories.md` (HEAD de main, commit f90e7ad9, 68 stories) face à `docs/prd.md` (HEAD), avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> C'est la huitième passe, le 16/11/2026. Elle vérifie le traitement de M1, M2 et m1 à m4 de la septième passe et l'intégration de s58. Les décisions de l'utilisatrice du 16/11 ne sont pas remises en cause : je vérifie seulement que le texte les applique de façon cohérente et testable.
> Ce que j'ai lu en entier : l'en-tête (l. 1-103), s12d (l. 1438-1491), s33 (l. 2601-2667), s40 (l. 3005-3055), s42 (l. 3103-3191), s53 à s58 (l. 3934-4244) et le récapitulatif (l. 4247-4417). Le reste, je l'ai contrôlé par recherche ciblée : `titulaire`, `s54`, `s58`, et les restes du paramètre abandonné (`paramètre de la réserve`, `connexion supplémentaire`, `dans les deux états`). Je n'ai pas de shell, donc pas de diff git.

**En bref : 0 critique, 1 majeur, 6 mineurs.** M1, M2 et m1 à m4 de la septième passe sont corrigés. Le paramètre RGPD abandonné n'apparaît plus nulle part. s58 est bien rattachée à la ligne Vote, à l'en-tête et au récapitulatif, et les décomptes sont exacts. Les défauts restants viennent presque tous de s58 : elle restreint des critères écrits avant elle (s33 c2, s54 c2) sans le dire, et quelques cas limites ne sont pas tranchés.

## Couverture du périmètre

Le PRD compte toujours 42 lignes au cœur (l. 62-103) et 3 modules activables (l. 111-113). La ligne Vote porte désormais « une adresse votante par terrain, titulaire par défaut, modifiable par le bureau seul (16/11/2026) ».

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
| Un seul accès pour plusieurs terrains | s53 (+ s18, s19, s32, s40) | oui (la restriction relevée en M2 de la septième passe est levée : rôle propre à chaque fiche, s54 c8) |
| Plusieurs adresses connectables | s54 (+ s29, s42) | oui (toutes les adresses actives se connectent, sans paramètre) |
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
| Module Vote (dont l'adresse votante) | s33, s58 | oui |
| Module Voirie | s34 | oui |
| Module Petites annonces | s35 | oui |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story. Aucune ligne n'est orpheline. La nouvelle phrase de la ligne Vote est couverte par s58, et le récapitulatif (l. 4321) le dit.

## Périmètre

- [x] Aucune story ne fait revenir un élément du cimetière.
  - s54 reste hors du « plan B de connexion » : une fiche sans adresse reste gérée par courrier (c9, note l. 4076-4077).
  - s56 ne crée aucun membre (c7).
  - s57 ne code ni purge, ni prorata, ni solde.
  - s58 ne compte aucune voix et ne transmet pas le nombre de terrains avant la réponse d'ASL Community (note l. 4241-4243).
  - Un point est à surveiller sans être une fuite : confier la voix d'un terrain à une adresse qui n'est pas celle du propriétaire ressemble à une procuration, et les procurations sont au cimetière. Voir m2.
- [x] Aucune story ne dépasse le périmètre. Les treize stories hors tableau sont toujours justifiées (l. 4321-4335), et s58 n'en fait pas partie.

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout. s58 livre une valeur observable : qui accède au vote de chaque terrain.
- [ ] Chaque critère peut devenir un test : **non, pas entièrement**.
  - s58 c4 et s33 c2 ne peuvent pas passer ensemble. s54 c2 (« mêmes droits ») est contredit par s58 c4 et s40 c3 (M1).
  - s58 c1 et c5 laissent ouvert le sort de la voix quand le bureau change de titulaire en gardant les deux adresses (m1).
  - s57 c2 contredit s57 c5 (m4).
  - s42 c10, c12 et c13 ne disent pas comment l'invitation individuelle traite une fiche à plusieurs adresses (m6).
- [ ] Notes agentiques présentes et utiles : **presque**. Contrairement à s53, s54 et s55, s58 ne demande pas de déclarer sa donnée à l'inventaire de s12c, à l'export de s38 et au registre de s39 (m3).
- [x] Complexité notée, aucun 5. s58 est à 2. Les treize stories à 4 énoncent toujours leur risque.

## La liste dans son ensemble

- [x] Ordre des dépendances : pas de cycle. L'en-tête place s58 après s33 et s54 (l. 34). Une seule référence en avant possible, sans blocage : s58 c5 teste un cas de s56 sans dépendre de s56 (m5).
- [x] Ids bien formés, uniques et conformes au récapitulatif. `s58-adresse-votante` est conforme.
- [x] Décomptes vérifiés :
  - 68 lignes au récapitulatif ;
  - cinq à 1, vingt-quatre à 2 (s58 comprise), vingt-six à 3, treize à 4 ;
  - la liste des treize stories à 4 est inchangée et exacte ;
  - les renvois « critères 8 et 9 » de s54 c2 désignent bien le rôle propre et la succession.
- [x] Pas de recouvrement : s58 prend la désignation de l'adresse votante, et s33 garde la redirection et la publication.

## Vérification des décisions du 16/11

| Décision / constat (septième passe) | État |
| --- | --- |
| M1 (dernière adresse active) | corrigé : s54 c9, « sauf s'il s'agit de la dernière adresse active de la fiche : la fiche repasse alors "courrier uniquement", comme le permet s12d (non-régression testée) ». C'est cohérent avec s12d c1 (l. 1455) et avec s56 c4. |
| M2 et m1 (rôle propre à chaque fiche) | corrigé : s54 c8 (le bureau choisit le rôle sur la fiche visée, l'import applique la règle de la cellule, testé en position mixte) et la note de s53 (l. 3990-3993). Le blocage antérieur a disparu partout, dans les deux sens. |
| Paramètre RGPD de connexion abandonné | corrigé : s54 c2 (« sans paramètre qui coupe les secondes »), la note de s54 (l. 4056-4060), le tableau des réserves (l. 102) et PRD l. 175. Aucun reste trouvé dans s29, s40, s42, s53 ou s56. |
| m2 (changement de titulaire en gardant les deux adresses) | corrigé : s54 c9, « l'ancienne devient supplémentaire ». |
| m3 (précisions de s56) | corrigé : (a) le canal est le rapport plus une notification du back-office, sans email ; (b) les candidates sont les adresses qui restent actives après l'import ; (c) quand il y a plusieurs adresses nouvelles, c'est la première de la cellule (c3). |
| m4 (le tableau des réserves cite s56) | corrigé : l. 102, « l'adresse d'un proche désignée titulaire par l'import (s56) ». |
| s58 intégrée | oui : ligne Vote du PRD, en-tête l. 34, renvoi depuis s33 (l. 2665-2666) et s54 (l. 4068), récapitulatif (bloc E, décomptes). Défauts de raccord en M1, m1, m2, m3 et m5. |

## Constats

### Critique

Aucun.

### Majeur

- **M1 — s58 c4 restreint s33 c2 et s54 c2 sans que ces critères le disent : des tests verts à la livraison de s33 et de s54 cassent à celle de s58.**
  - s33 c2 (l. 2613) : « Un membre connecté accède à l'espace de vote externe depuis son espace pendant la période ouverte. » Depuis s54, une adresse supplémentaire est un membre connecté « avec les mêmes droits ».
  - s58 c4 (l. 4225) : « l'accès à l'espace de vote n'est proposé qu'à une adresse votante d'au moins une fiche ; une adresse qui ne vote pour aucun terrain ne le voit pas. » Pour une adresse supplémentaire non votante, les deux critères ne peuvent pas passer ensemble. La note de s33 (l. 2665-2666) renvoie à s58 mais ne dit pas que c2 est restreint.
  - s54 c2 (l. 4018) écrit : « avec les mêmes droits […] Ce qui distingue l'adresse titulaire tient aux règles de gestion des critères 8 et 9. » Ce n'est plus vrai. La titulaire porte aussi la copie en ligne (s40 c3, l. 3018) et la voix par défaut (s58 c1). La note de s53 (l. 3992-3993) le dit, mais pas le critère de s54.
  - Correction attendue, sans revenir sur les décisions :
    - dans s33 c2, « une adresse votante (s58) », ou une phrase de s58 qui déclare amender s33 c2 et en mettre le test à jour ;
    - dans s54 c2, « les mêmes droits dans l'espace membre ; la copie en ligne (s40) et la voix par défaut (s58) suivent l'adresse titulaire ».

### Mineurs

- **m1 — s58 c1 et c5 : quand le bureau change de titulaire en gardant les deux adresses (s54 c9), on ne sait pas si la voix suit.**
  - c5 ne traite que la titulaire « remplacée (s54, s56) ». Or le changement de titulaire de s54 c9 garde l'ancienne active, comme supplémentaire. Est-ce un remplacement ?
  - Plus largement, c1 ne dit pas si le défaut est **dérivé** (la voix suit la titulaire tant que le bureau n'a rien désigné) ou **stocké** (fixé une fois). Un bureau qui désigne explicitement la titulaire comme votante, puis change de titulaire, obtient un résultat différent selon la lecture.
  - Correction attendue : une phrase qui tranche, et son test.

- **m2 — s58 n'est pas rattachée aux réserves du vote, et une note de s33 devient fausse.**
  - (a) Le tableau des réserves (l. 100) indique que l'accès ASL Community bloque « s33 en entier ». s58 dépend de s33, elle est donc bloquée de fait, mais la ligne ne la cite pas.
  - (b) La note de s33 (l. 2641) dit qu'« aucune autre story ne doit dépendre de celle-ci ». s58 en dépend. C'est légitime pour une story du même module, mais il faut l'écrire comme exception.
  - (c) Confier la voix d'un terrain à l'adresse d'un proche est proche de la procuration, que le PRD met au cimetière côté ASL Community. La validation statutaire du vote électronique (réserve l. 100) devrait couvrir ce cas : un votant qui n'est pas le propriétaire. La note de s58 devrait dire pourquoi ce n'est pas une gestion de procurations.
  - (d) Détail : le titre de la dernière colonne du tableau dit « État au 15 novembre 2026 » (l. 92 et 95), alors que la ligne RGPD rapporte une décision du 16.

- **m3 — Les notes de s58 ne déclarent pas la nouvelle donnée à la sauvegarde et à l'export.**
  - s53, s54 et s55 demandent toutes de « déclarer les colonnes à l'inventaire de s12c et à l'export de s38 ». s58 ajoute une donnée (l'adresse votante par fiche) et ne le demande pas. Elle n'est pas non plus dans les dépendances de s38.
  - Comme s58 se joue après s38 et s39, le test de complétude de s39 cassera si la colonne n'est ni exportée ni déclarée au registre des exclusions.
  - Correction attendue : la phrase habituelle, plus « RLS forcée » si une table est créée. c8 couvre déjà le test d'accès croisé.

- **m4 — s57 c2 contredit s57 c5 pour un proche qui possède lui-même un terrain.**
  - c2 (l. 4180) : « Passé le délai, aucune adresse reliée ne se connecte plus. »
  - c5 (l. 4183) : l'adresse supplémentaire « perd l'accès à cette fiche […] ; l'accès aux fiches où elle est titulaire […] n'est pas touché ».
  - Avec le rôle propre à chaque fiche, ce cas est désormais nominal. Correction attendue : dans c2, « aucune adresse reliée ne se connecte plus **à ces fiches** ».

- **m5 — s58 c5 teste un cas de s56 sans dépendre de s56.**
  - c5 exige « chaque cas testé », dont le remplacement de la titulaire par l'import annuel (s56). Or ni les dépendances de s58 ni l'en-tête (l. 34) ne placent s56 avant s58.
  - L'ordre des ids donne s56 avant s58, mais les deux stories ont une place explicite, et s56 attend s20.
  - Correction attendue : ajouter s56 aux dépendances de s58, ou dire que le cas s56 se teste à la livraison de la seconde des deux.

- **m6 — s42 : l'invitation individuelle face à une fiche à plusieurs adresses (s54).**
  - c8 (l. 3125) fait partir le **lancement** à chaque adresse active. En revanche, l'invitation individuelle de c10 (l. 3129) part vers « le membre », sans dire à quelle adresse.
  - Deux autres critères restent ambigus :
    - c13 (« réinviter […] l'ancien lien cesse de fonctionner ») : on ne sait pas si la réinvitation coupe le lien de toutes les adresses ou d'une seule ;
    - c12 (état « invité / connecté le <date> ») : on ne sait pas si l'état se suit par fiche ou par adresse.
  - Correction attendue : une phrase par critère (par exemple « à chaque adresse active, ou à celle que choisit le bureau » et « par adresse »).

Cas limite à signaler dans s54 c9, sans constat séparé. Une fiche dont on retire la dernière adresse active peut garder une adresse ajoutée par le membre et pas encore confirmée. À la confirmation, on ne sait pas qui devient titulaire, et donc votante. La règle « première adresse » ne vaut qu'à la création d'une fiche. Il en va de même quand le bureau renseigne de nouveau une adresse sur une fiche repassée « courrier uniquement ».

## Verdict

- Couverture complète : 42 lignes du cœur et 3 modules, la nouvelle phrase de la ligne Vote comprise (s58).
- Aucune fuite du cimetière. Le point « procuration » est à faire valider avec la réserve statutaire (m2).
- Ids conformes, décomptes exacts (68 stories ; 5 / 24 / 26 / 13), aucun 5.
- L'ordre est exécutable : pas de cycle, aucune référence en avant bloquante.
- Les décisions du 16/11 sont appliquées de façon cohérente dans s12d, s53, s54, s56 et le tableau des réserves. Le paramètre abandonné n'a laissé aucun reste.

Aucun constat n'est critique : le découpage passe le gate. Je recommande de traiter M1 avant le `/ks-research` de s33 : c'est une phrase dans s33 c2 et une dans s54 c2. m1 et m5 se règlent dans s58 avant son plan, et m3 avant que s39 ne casse. m2, m4 et m6 demandent chacun une phrase.

Max severity: major
Stories ready: yes
