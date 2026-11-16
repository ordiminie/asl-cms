# Revue du découpage : ASL-CMS (Lp)

> J'ai relu `docs/stories.md` (HEAD de main, commit 24e29ee1, 68 stories) face à `docs/prd.md`, avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> C'est la neuvième passe, le 16/11/2026. Elle vérifie les corrections de M1 et de m1 à m6 de la huitième passe, ainsi que le cas limite signalé. Je ne remets pas en cause les décisions de l'utilisatrice du 16/11 : je vérifie seulement que le texte les applique de façon cohérente et testable.
> Ce que j'ai lu en entier : l'en-tête (l. 1-107), s33 (l. 2601-2667), s40 (l. 3005-3055), s41 et s42 (l. 3058-3191), et s53 à s58 (l. 3934-4251). Le récapitulatif, je l'ai contrôlé par recherche ciblée (ligne s58, ligne s42, décomptes l. 4327). Je n'ai pas de shell, donc pas de diff git.

**En bref : 0 critique, 1 majeur, 4 mineurs.** M1 et m1 à m6 de la huitième passe sont corrigés, et le cas limite de s54 c9 est tranché. Les corrections font apparaître trois points :

- un chemin indirect permet à une adresse supplémentaire de devenir titulaire, et donc de prendre la voix ;
- il reste une ambiguïté sur la voix « désignée » ;
- passer à un état d'invitation suivi adresse par adresse laisse le suivi d'adoption de s42 compté par membre.

## Couverture du périmètre

Le PRD compte toujours 42 lignes au cœur (l. 62-103) et 3 modules activables (l. 111-113). Aucune ligne n'a changé depuis la huitième passe.

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
| Un seul accès pour plusieurs terrains | s53 (+ s18, s19, s32, s40) | oui |
| Plusieurs adresses connectables | s54 (+ s29, s42) | oui |
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

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story. Aucune ligne n'est orpheline.

## Périmètre

- [x] Aucune story ne fait revenir un élément du cimetière.
  - **Procurations** : la note de s58 (l. 4245-4247) explique maintenant pourquoi l'adresse votante n'en est pas une. C'est l'adresse officielle du terrain, il n'y a ni mandat ni délégation, et le cas d'un votant non propriétaire est posé à ASL Community dans la réserve (l. 100).
  - **Comptage des voix** : s58 ne compte toujours aucune voix, et ne transmet pas le nombre de terrains avant la réponse sur le multi-vote (l. 4241-4243).
- [x] Aucune story ne dépasse le périmètre. Les treize stories hors tableau restent justifiées, et s58 relève de la ligne Vote (l. 4328).

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout.
- [ ] Chaque critère peut devenir un test : **non, pas entièrement**.
  - s54 c4 et c9, combinés à s58 c5, ne disent pas si une adresse supplémentaire peut remplacer l'adresse titulaire (M1).
  - Le cas d'une adresse à la fois titulaire et désignée par le bureau n'est pas tranché (m1).
  - Le suivi d'adoption de s42 est compté par membre alors que l'état est suivi par adresse (m2).
- [x] Notes agentiques présentes et utiles. s58 déclare maintenant sa donnée à s12c et s38, et prévoit la RLS forcée et le test de s39 (l. 4249-4250).
- [x] Complexité notée, aucun 5. s58 est à 2. Les treize stories à 4 énoncent leur risque, y compris s42 avec sa note « Taille » (l. 3184-3186).

## La liste dans son ensemble

- [x] Ordre des dépendances : pas de cycle, aucune référence en avant bloquante.
  - s58 dépend maintenant de s56, dans ses dépendances (l. 4233), dans l'en-tête (l. 34) et dans le récapitulatif (l. 4325).
  - Le renvoi de s54 c2 vers s40 et s58 n'est qu'une description, pas une dépendance (voir m4).
- [x] Ids bien formés, uniques et conformes au récapitulatif. Le décompte (68 stories ; cinq à 1, vingt-quatre à 2, vingt-six à 3, treize à 4) n'a pas changé.
- [x] Pas de recouvrement : s58 prend la désignation de l'adresse votante, et s33 garde la redirection et la publication.

## Vérification des corrections de la huitième passe

| Constat | État |
| --- | --- |
| M1 (s33 c2, s54 c2) | **Corrigé.** s33 c2 (l. 2613) : « À la livraison de s58, cet accès est réservé à l'adresse votante de chaque terrain : s58 restreint ce critère et met son test à jour. » s54 c2 (l. 4018) : « mêmes droits dans l'espace membre […] Ce qui distingue l'adresse titulaire : les règles de gestion des critères 8 et 9, la copie en ligne des données (s40) et la voix du terrain par défaut (s58) ». Le test de s54 ne casse pas : s33 n'existe pas encore quand s54 est livrée. |
| m1 (la voix suit la titulaire, sauf désignation) | **Corrigé** dans s58 c5 (l. 4226) : la voix est dérivée de la titulaire tant que le bureau n'a rien désigné, et une désignation la fixe. Le cas où l'adresse votante est retirée est traité. Il reste un cas limite : m1 ci-dessous. |
| m2 (réserves, note de s33, procuration, date) | **Corrigé.** (a) La réserve l. 100 cite s58 et l'adresse d'un proche. (b) La note de s33 (l. 2641-2642) fait de s58 une exception explicite. (c) La note de s58 explique pourquoi ce n'est pas une procuration. (d) La colonne s'intitule « État au 16 novembre 2026 » (l. 92, l. 95). |
| m3 (déclaration de la donnée de s58) | **Corrigé** (l. 4249-4250). |
| m4 (s57 c2 contre c5) | **Corrigé** : « aucune adresse reliée ne se connecte plus **à ces fiches** ; ses fiches restantes ailleurs ne sont pas touchées (critère 5) » (l. 4180). |
| m5 (s58 dépend de s56) | **Corrigé** (l. 34, l. 4233, l. 4325). |
| m6 (invitation individuelle de s42) | **Corrigé** pour les trois critères visés : c10 vise « chaque adresse active de la fiche » (l. 3129), c12 affiche l'état « adresse par adresse » (l. 3132), c14 « remplace l'invitation précédente de chaque adresse » (l. 3134). Cette correction crée un nouveau décalage : m2 ci-dessous. |
| Cas limite de s54 c9 (fiche sans adresse active) | **Tranché** : « Une fiche sans adresse active qui en reçoit une — saisie par le bureau, ou ajoutée par le membre et confirmée — en fait son adresse titulaire, donc votante par défaut (s58) » (l. 4025). |

## Constats

### Critique

Aucun.

### Majeur

- **M1 — s54 c4 et c9 avec s58 c5 : rien ne dit si une adresse supplémentaire peut remplacer l'adresse titulaire. Si elle le peut, elle prend la voix du terrain et la copie des données sans passer par le bureau.**
  - s54 c4 (l. 4020) : « Le membre ajoute et modifie ses propres adresses depuis son espace ». Le critère ne dit pas si « le membre » couvre toutes les adresses de la fiche. Or s54 c2 leur donne à toutes « les mêmes droits dans l'espace membre ».
  - s54 c9 (l. 4025) : modifier ou remplacer l'adresse titulaire « par le membre une fois la nouvelle adresse confirmée transfère le titre à la nouvelle adresse ».
  - s58 c5 (l. 4226) : quand le titre passe par « remplacement (s54, s56) », la voix passe avec lui.
  - Mis bout à bout, c'est un chemin de prise de contrôle. Un proche, connecté en adresse supplémentaire, remplace l'adresse du parent par la sienne, puis confirme le lien qu'il reçoit lui-même. Il devient alors titulaire et votant, et le parent perd son adresse. Trois règles tombent :
    - la ligne Vote du PRD (« modifiable par le bureau seul ») ;
    - s58 c3 (« le membre […] ne peut pas la changer »), dont le test passe pourtant, puisqu'il ne vise que l'appel direct ;
    - s40 c3 (« un proche, supplémentaire sur la fiche d'un parent, n'y reçoit pas les données de ce parent »).
  - Avec l'autre lecture (une adresse ne modifie qu'elle-même), il n'y a aucun trou. Mais le texte ne choisit pas, et le choix revient à `/ks-plan` sur une règle d'autorisation. C'est ce qui rend le critère non testable tel quel.
  - Correction attendue : une phrase dans s54 c4 ou c9 qui dit qui peut modifier l'adresse titulaire. Par exemple : l'adresse titulaire elle-même et le bureau, jamais une adresse supplémentaire. Ajouter le test d'autorisation correspondant. Ce n'est pas un retour sur la décision m1 : la voix suit toujours la titulaire, seule la porte d'accès au titre est précisée.

### Mineurs

- **m1 — s58 c2 et c5 : le cas d'une adresse à la fois titulaire et désignée par le bureau n'est pas tranché.**
  - c2 (l. 4223) permet de désigner « une autre adresse active » comme votante. c5 distingue la voix qui suit la titulaire de la voix désignée, qui reste en place.
  - Deux cas restent ouverts :
    - Le bureau a désigné X, puis désigne de nouveau la titulaire. Est-ce un retour au défaut, où la voix suit la titulaire, ou une désignation fixe ?
    - L'adresse désignée X devient titulaire (s54 c9), puis le titre change encore. La voix reste-t-elle sur X ou passe-t-elle à la nouvelle titulaire ?
  - Correction attendue : une phrase, par exemple « désigner l'adresse titulaire revient au défaut », et son test.

- **m2 — s42 c7 et c8 : le suivi d'adoption reste compté par membre, alors que l'état d'invitation est suivi adresse par adresse (c12).**
  - c7 (l. 3126) : « nombre de membres s'étant connectés au moins une fois, liste des membres jamais connectés ». c8 (l. 3127) : la relance part aux « membres jamais connectés […] sans réinviter ceux qui se sont déjà connectés ».
  - Prenons une fiche où le propriétaire s'est connecté mais pas l'adresse de son enfant. On ne sait pas si la fiche compte comme connectée, ni si la relance part à l'adresse de l'enfant. La même question se pose pour une adresse portée par deux fiches (s53) : invitée depuis la fiche A, apparaît-elle « invitée » sur la fiche B ?
  - Correction attendue : préciser l'unité de c7 et de c8, fiche ou adresse, comme c4 le fait déjà pour la couverture des canaux (« Le décompte se fait en fiches »).

- **m3 — s56 c4 : quand l'import désigne d'office une nouvelle titulaire, la voix change aussi (s58 c5), mais la notification au bureau ne le dit pas.**
  - Le bureau reçoit « fiche, ancienne et nouvelle adresse titulaire » (l. 4136). Il ne sait pas que la voix du terrain a suivi, peut-être vers l'adresse d'un proche, alors que la ligne Vote du PRD réserve ce choix au bureau.
  - s56 se joue avant s58. C'est donc à s58 d'ajouter « la notification de s56 c4 mentionne l'adresse votante quand la voix suit ». Ce n'est pas un retour sur la décision m1, juste une information pour le bureau qui vérifie le choix.

- **m4 — s54 c2 : le critère cite des effets de s40 et de s58 que son test (« Vérifié sur une fiche à deux adresses ») ne peut pas vérifier à la livraison de s54.**
  - s54 se joue avant s40 et avant s33/s58. Un implémenteur qui lit le critère au pied de la lettre pourrait chercher à tester la copie en ligne ou la voix dans s54.
  - Correction attendue : présenter ces deux effets comme un renvoi (« portés par s40 et s58 »), sur le modèle de s54 c3 (« Les relances (s29) et les invitations (s42), livrées après, portent ce critère de leur côté »).

Cas limite signalé sans constat séparé : s40 c3. Un proche qui n'est titulaire d'aucune fiche et qui demande sa copie ne reçoit, en lecture stricte, aucune fiche. Pourtant, l'association détient au moins son adresse, qui est une donnée personnelle le concernant. Ce point est à garder en tête lors du `/ks-research` de s40, et relève de l'avis RGPD déjà ouvert (l. 102).

## Verdict

- Couverture complète : 42 lignes du cœur et 3 modules.
- Aucune fuite du cimetière. Le point « procuration » est maintenant traité dans la note de s58 et dans la réserve.
- Ids conformes, décomptes exacts (68 stories ; 5 / 24 / 26 / 13), aucun 5.
- L'ordre est exécutable : pas de cycle, aucune référence en avant bloquante.
- Les corrections de la huitième passe sont toutes appliquées. Les décisions du 16/11 (M1, m1, m2, m6) sont reprises de façon cohérente dans s33, s54, s58 et s42.

Aucun constat n'est critique : le découpage passe le gate. Je recommande de traiter M1 avant le `/ks-research` de s54 : c'est une phrase dans s54 c4 ou c9, plus un test d'autorisation. m1 et m3 se règlent dans s58 avant son plan. m2 se règle dans s42 avant son plan, et m4 demande une reformulation.

Max severity: major
Stories ready: yes
