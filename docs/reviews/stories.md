# Revue du découpage : ASL-CMS (Lp), onzième passe

> J'ai relu `docs/stories.md` (HEAD de main, commit 78fcc8cc, 68 stories) face à `docs/prd.md`, en suivant la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> Cette passe vérifie les corrections de m1 à m4 de la dixième passe. Les décisions de l'utilisatrice du 16/11/2026 ne sont pas remises en cause. Je vérifie seulement que le texte les applique de façon cohérente et testable.
> Ce que j'ai lu en entier :
>
> - le tableau du périmètre et le cimetière du PRD (l. 54-145) ;
> - s16 (l. 1647-1684) et s42 (l. 3103-3192) ;
> - s53 à s58 (l. 3934-4253) ;
> - le récapitulatif (l. 4255-4373).
>
> Je n'ai pas de shell, donc pas de diff git : j'ai vérifié les corrections sur le texte actuel. Les titres des 68 stories sont identiques à ceux de la passe précédente.

**En bref : 0 critique, 0 majeur, 2 mineurs.** Les quatre mineurs de la dixième passe sont corrigés. Les corrections laissent deux cas limites, sans effet sur le gate.

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
  - **Procurations** : la note de s58 (l. 4246-4248) écarte toujours le mandat et la délégation. Quand la désignation suit l'adresse corrigée par sa propriétaire (nouveau texte de s58 c5), c'est la même personne qui garde la voix, pas une délégation.
  - **Comptage des voix** : s58 ne compte aucune voix (l. 4242-4244).
  - **Plan B de connexion** : une fiche sans adresse reste « courrier uniquement » (s54 c9, s58 c7). Une adresse non confirmée qui expire n'ouvre aucun contournement.
- [x] Aucune story ne dépasse le périmètre. Les treize stories hors tableau restent justifiées (l. 4329-4343).

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout.
- [ ] Chaque critère peut devenir un test : **presque**. Il reste deux ambiguïtés mineures, dans s58 c5 et s42 c8 (voir m1 et m2).
- [x] Les notes agentiques sont présentes et utiles. La note de risque de s54 (l. 4040-4042) dit maintenant « ajoute désormais des adresses et modifie la sienne », ce qui est aligné sur c4.
- [x] La complexité est notée et aucune story n'est à 5. s54 et s42 restent à 4 et énoncent leur risque (l. 4040, l. 3184-3186). s58 reste à 2 malgré les deux cas ajoutés, ce qui reste plausible.

## La liste dans son ensemble

- [x] L'ordre des dépendances est exécutable : pas de cycle, aucune référence en avant bloquante.
  - Les nouveaux renvois de s58 c5 vers s54 (correction par la personne) et vers s56 (désactivation par l'import) pointent vers des stories qui figurent dans ses dépendances (s03b, s33, s53, s54, s56).
  - s42 c8 renvoie à des adresses ajoutées par s54, qui figure dans ses dépendances.
- [x] Les ids sont bien formés, uniques et conformes au récapitulatif. Le décompte est inchangé : 68 stories, dont cinq à 1, vingt-quatre à 2, vingt-six à 3 et treize à 4. Les treize stories à 4 sont bien énumérées à la l. 4353-4359.
- [x] Pas de recouvrement.
  - s54 décide qui modifie une adresse et combien de temps vit une adresse en attente.
  - s58 décide qui détient la voix.
  - s42 décide qui reçoit l'invitation et la relance.

## Vérification des corrections de la dixième passe

| Constat | État |
| --- | --- |
| m1 (désignation qui tombe sans le bureau) | **Corrigé.** s58 c5 (l. 4226) couvre les deux chemins. Sur la correction par la personne : « la désignation suit la nouvelle adresse une fois celle-ci confirmée ». Sur l'import : « la voix revient à la titulaire et le bureau en est notifié comme au critère suivant ». Ce texte est cohérent avec s54 c5, où l'ancienne adresse reste active pendant la confirmation : la voix ne reste donc jamais sans détenteur. Il reste un troisième chemin, celui du bureau (voir m1 ci-dessous). |
| m2 (pronom de s58 c5) | **Corrigé** : « Si l'adresse votante désignée est retirée ou n'est plus active ». |
| m3 (s54 c4 : retrait de sa propre adresse, adresse en attente, note de risque) | **Corrigé**, en trois points. (a) « Elle ne retire pas non plus sa propre adresse de la fiche : elle le demande au bureau. » (b) La personne qui a ajouté l'adresse peut l'annuler ou la corriger, et l'adresse expire après un délai fixé par un paramètre du tenant (seed 7 jours), conformément à l'ADR 010. (c) La note de risque est alignée. De plus, s54 c5 (l. 4021) précise que « pendant la confirmation d'une adresse modifiée, titulaire ou supplémentaire, l'ancienne reste active », ce qui est cohérent avec c9 pour la titulaire. |
| m4 (s42 c8 : adresses jamais invitées) | **Corrigé** : la relance part « qu'elle ait déjà été invitée ou non (une adresse ajoutée après le lancement comprise) ». c7, c12 et c14 restent cohérents avec ce texte. |

## Constats

### Critique

Aucun.

### Majeur

Aucun.

### Mineurs

- **m1 — s58 c5 : on ne sait pas ce que devient la désignation quand le bureau modifie lui-même l'adresse votante désignée.**
  - s54 c4 permet au bureau de modifier toutes les adresses. Selon s54 c5, une adresse saisie par le bureau est active d'office.
  - s58 c5 traite maintenant la correction par la personne (la désignation suit) et la désactivation par l'import (la voix revient à la titulaire, avec une notification).
  - Le texte ne dit pas lequel des deux s'applique quand c'est le bureau qui modifie l'adresse désignée. On peut lire que la désignation suit la nouvelle adresse, comme pour la personne. On peut aussi lire que l'ancienne adresse « n'est plus active », et que la voix revient donc à la titulaire.
  - L'enjeu est faible, puisque le bureau sait ce qu'il fait. Mais le test « chaque cas est testé » n'a pas d'attendu univoque sur ce cas.
  - Correction attendue : une phrase, par exemple « quand le bureau modifie l'adresse votante désignée, la désignation suit la nouvelle adresse ». Le choix inverse convient aussi, s'il est écrit.

- **m2 — s42 c8 (et c7) : le mot « active » manque, et on ne sait pas si la relance atteint une adresse non confirmée ou désactivée.**
  - Depuis la correction, c8 relance « chaque adresse jamais connectée, qu'elle ait déjà été invitée ou non ». Deux types d'adresses jamais connectées ne sont pas actives :
    - une adresse ajoutée par un membre et encore en attente de confirmation (s54 c4) ;
    - une adresse désactivée par l'import annuel (s56 c3, c4, c5).
  - c6 et c10 précisent bien « chaque adresse active ». c8 ne le dit pas, et c7 non plus pour la liste des jamais connectées.
  - s54 c5 tranche indirectement la question : « une adresse non active ne reçoit rien ». Mais l'implémenteur de s42 écrira ses tests à partir de s42.
  - Correction attendue : écrire « chaque adresse active jamais connectée » dans c8. Préciser aussi dans c7 si la liste des jamais connectées montre ou exclut les adresses non actives.

Point relevé sans constat séparé : s54 c4 réserve l'annulation et la correction d'une adresse en attente à « la personne qui l'a ajoutée ». Le test d'autorisation nommé dans ce critère ne couvre que le cas titulaire contre supplémentaire. Il serait utile d'ajouter au plan de s54 le cas d'une autre personne de la fiche qui tente d'annuler l'adresse en attente. Le critère se teste déjà tel qu'il est écrit, donc je ne le classe pas.

Rappel de la passe précédente, toujours valable et non classé : un proche connecté peut corriger l'adresse de domicile et le téléphone du parent (s55 c5, s16), car la règle de s54 c4 ne vaut que pour les adresses email. Il faut s'en souvenir au `/ks-design` de s54. L'avis RGPD ouvert couvre ce point.

## Verdict

- Couverture complète : 42 lignes du tronc commun et 3 modules.
- Aucune fuite du cimetière.
- Ids conformes et décomptes exacts (68 stories, 5 / 24 / 26 / 13). Aucune story à 5, et les stories à 4 énoncent leur risque.
- Ordre exécutable : pas de cycle, aucune référence en avant bloquante.
- Les quatre corrections de la dixième passe sont appliquées et cohérentes avec les décisions du 16/11. Elles ne créent aucune contradiction entre s54, s56, s58 et s42.

Il ne reste que deux mineurs, et le découpage passe le gate. m1 se règle dans s58 avant son plan, et m2 dans s42 avant son plan.

Max severity: minor
Stories ready: yes
