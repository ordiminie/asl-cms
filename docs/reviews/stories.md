# Revue du découpage : ASL-CMS (Lp), douzième passe

> J'ai relu `docs/stories.md` (HEAD de main, commit 98780613, 68 stories) face à `docs/prd.md`, en suivant la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> Cette passe vérifie les corrections des deux mineurs de la onzième passe. Les décisions de l'utilisatrice du 16/11/2026 ne sont pas remises en cause : je vérifie seulement que le texte les applique de façon cohérente et testable.
>
> Ce que j'ai lu en entier :
>
> - le tableau du périmètre et le cimetière du PRD (l. 54-145) ;
> - s42 (l. 3103-3192) ;
> - s54 à s58 (l. 4006-4253) ;
> - le récapitulatif (l. 4255-4375).
>
> Je n'ai pas de shell, donc pas de diff git : j'ai vérifié les corrections sur le texte actuel. La liste des 68 titres de stories est identique à celle de la passe précédente.

**En bref : 0 critique, 0 majeur, 0 mineur.** Les deux mineurs de la onzième passe sont corrigés. Les corrections ne créent aucune nouvelle contradiction entre s42, s54, s56 et s58.

## Couverture du périmètre

Le tableau du PRD n'a pas changé : 42 lignes au tronc commun (l. 62-103) et 3 modules activables (l. 111-113).

| Ligne du PRD (core loop) | Couverte par | OK |
| --- | --- | --- |
| CMS de pages génériques | s04 (+ s44) | ✅ |
| Attribution des rôles | s14 (+ s03b) | ✅ |
| Permissions configurables | s37 (+ s03b) | ✅ |
| Lien magique + suivi d'adoption | s03, s03c, s42 | ✅ |
| Pages publiques + contact archivé | s04, s08 | ✅ |
| Navigation du site public | s04b, s50 | ✅ |
| Identité visuelle | s01b, s02 | ✅ |
| Limitation de débit | s08b | ✅ |
| Actualités | s05 | ✅ |
| Présentation du bureau | s06 | ✅ |
| Désinscription et classification | s25, s27b | ✅ |
| Bandeau d'alerte | s07 | ✅ |
| SEO | s11 | ✅ |
| Import initial des membres | s13 (+ s53, s54, s55) | ✅ |
| Import annuel des coordonnées | s56 | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Accès de l'ancien propriétaire | s57 | ✅ |
| Coordonnées | s16 (+ s54, s55) | ✅ |
| Un seul accès pour plusieurs terrains | s53 (+ s18, s19, s32, s40) | ✅ |
| Plusieurs adresses connectables | s54 (+ s29, s42) | ✅ |
| Adresse terrain / domicile / entreprise | s55 (+ s28) | ✅ |
| Questions au bureau | s23 | ✅ |
| Notes internes et historique | s24 | ✅ |
| Import des relevés d'eau | s17 | ✅ |
| Historique de consommation | s18 | ✅ |
| Signalements | s10, s22 | ✅ |
| Analyses d'eau | s09 | ✅ |
| Documents partagés | s31 | ✅ |
| Documents nominatifs séparés | s32 | ✅ |
| Campagnes Brevo | s25 | ✅ |
| Envoi échelonné + budget quotidien | s26, s52 | ✅ |
| Relances d'impayés | s29 | ✅ |
| Publipostage PDF | s28 | ✅ |
| Groupes de destinataires | s27 | ✅ |
| Statistiques de campagne | s30 | ✅ |
| Modèles de documents | s36 | ✅ |
| Facturation membres + Pennylane | s19, s20 | ✅ |
| Redirection de paiement | s21 | ✅ |
| Multi-tenant | s01, s02 | ✅ |
| Export individuel d'un membre | s40 | ✅ |
| Simulation de rôle SuperAdmin | s41 (+ s48) | ✅ |
| Export et portabilité | s38, s39 | ✅ |
| Module Vote (dont l'adresse votante) | s33, s58 | ✅ |
| Module Voirie | s34 | ✅ |
| Module Petites annonces | s35 | ✅ |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story. Aucune ligne n'est orpheline.

## Périmètre

- [x] Aucune story ne fait revenir un élément du cimetière.
  - **Procurations** : la nouvelle phrase de s58 c5 (le bureau modifie l'adresse désignée, et la désignation suit aussitôt) ne crée ni mandat ni délégation. Le bureau corrige l'adresse officielle qui porte la voix ; la note de s58 (l. 4246-4248) reste vraie.
  - **Comptage des voix** : s58 ne compte toujours aucune voix (l. 4242-4244).
  - **Plan B de connexion** : s42 c8 exclut maintenant de la relance toute adresse non active. Une adresse en attente de confirmation ne reçoit donc pas de lien de connexion par ce chemin. C'est cohérent avec s54 c5 (« une adresse non active ne reçoit rien et ne permet pas de se connecter »).
- [x] Aucune story ne dépasse le périmètre. Les treize stories hors tableau restent justifiées (l. 4329-4343).

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout.
- [x] Chaque critère peut devenir un test. Les deux ambiguïtés de la passe précédente sont levées (voir ci-dessous).
- [x] Les notes agentiques sont présentes et utiles.
- [x] La complexité est notée et aucune story n'est à 5. Les treize stories à 4 énoncent leur risque. s42 garde sa note de scission (l. 3184-3186). s58 reste à 2, ce qui reste plausible : la correction ajoute un cas à c5, pas une surface nouvelle.

## La liste dans son ensemble

- [x] L'ordre des dépendances est exécutable : pas de cycle, aucune référence en avant bloquante.
  - Le nouveau cas de s58 c5 (modification par le bureau) repose sur s54 c4 et c5. s54 figure dans les dépendances de s58.
  - s42 c7 et c8 nomment deux sortes d'adresses non actives : en attente de confirmation (s54) et désactivée par l'import (s56). s54 figure dans les dépendances de s42, mais pas s56. Ce n'est pas bloquant : avant la livraison de s56, la seconde sorte n'existe pas, et l'exclusion reste vraie sans rien coder de plus. Il faudra s'en souvenir au plan de s42, sans que cela fasse un constat.
- [x] Les ids sont bien formés, uniques et conformes au récapitulatif. J'ai recompté : 68 lignes au récapitulatif. Cinq stories à 1 (s07, s08b, s16, s21, s51), et les treize stories à 4 énumérées à la l. 4353-4359. Les totaux 5 / 24 / 26 / 13 sont inchangés.
- [x] Pas de recouvrement. Chaque story garde sa question :
  - s54 décide qui modifie une adresse, et quand elle devient active ;
  - s58 décide qui détient la voix ;
  - s42 décide qui reçoit l'invitation et la relance, et ce que le bureau voit de l'adoption.

## Vérification des corrections de la onzième passe

| Constat | État |
| --- | --- |
| m1 (s58 c5 : modification de l'adresse votante désignée par le bureau) | **Corrigé.** La l. 4226 dit maintenant : « quand c'est le bureau qui la modifie, la désignation suit la nouvelle adresse aussitôt ». Le résultat attendu du test est donc univoque. C'est cohérent avec s54 c5, où une adresse saisie par le bureau est active d'office : la voix n'est jamais sans détenteur. C'est aussi cohérent avec le chemin de la personne elle-même (la désignation suit une fois l'adresse confirmée, et l'ancienne reste active d'ici là). Ce cas se distingue bien du chemin de l'import : s56 ne « modifie » pas une adresse supplémentaire, il la désactive quand elle est absente du fichier (s56 c5), et s58 c5 renvoie alors la voix à la titulaire avec une notification. Les trois chemins sont maintenant écrits sans se recouvrir. |
| m2 (s42 c7 et c8 : adresses non actives) | **Corrigé.** c8 (l. 3127) dit « chaque adresse **active** jamais connectée — jamais à une adresse en attente de confirmation ou désactivée ». c7 (l. 3126) inclut les adresses non actives dans la liste des jamais connectées, « marquée[s] comme telle[s] ». La liste reste une liste d'adresses, et la couverture des canaux reste comptée en fiches (c5). c6, c10 et c14 restent alignés sur « chaque adresse active ». |

## Constats

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

Aucun.

Points relevés sans constat séparé, à garder pour les étapes suivantes :

- **Adresse non confirmée qui expire** (s54 c4 : expiration après le délai du tenant, 7 jours au seed). Le texte ne dit pas si elle disparaît de la fiche ou y reste comme adresse inactive. s42 c7 ne nomme que deux sortes d'adresses non actives : en attente, et désactivée par l'import. Une adresse expirée n'appartient à aucune des deux. Le critère se teste déjà pour les deux sortes qu'il nomme, donc je ne le classe pas. Il faut trancher ce point au `/ks-research` de s54 et le reprendre au plan de s42.
- **Rappel de la onzième passe** : le test d'autorisation de s54 c4 ne couvre que titulaire contre supplémentaire. Il serait utile d'ajouter au plan de s54 le cas d'une autre personne de la fiche qui tente d'annuler une adresse en attente.
- **Rappel des passes précédentes** : un proche connecté peut corriger l'adresse de domicile et le téléphone du parent (s55 c5, s16), car la règle de s54 c4 ne vaut que pour les adresses email. À garder pour le `/ks-design` de s54 ; l'avis RGPD ouvert couvre ce point.

## Verdict

- Couverture complète : 42 lignes du tronc commun et 3 modules.
- Aucune fuite du cimetière.
- Ids conformes et décomptes exacts : 68 stories, réparties 5 / 24 / 26 / 13. Aucune story à 5, et les stories à 4 énoncent leur risque.
- Ordre exécutable : pas de cycle, aucune référence en avant bloquante.
- Les deux corrections du commit 98780613 sont appliquées, testables et cohérentes avec les décisions du 16/11. Elles ne créent aucune contradiction entre s42, s54, s56 et s58.

Le découpage passe le gate sans réserve.

Max severity: none
Stories ready: yes
