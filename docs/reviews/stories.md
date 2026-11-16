# Revue du découpage : ASL-CMS (Lp), dixième passe

> J'ai relu `docs/stories.md` (HEAD de main, commit 7cafe547, 68 stories) face à `docs/prd.md`, avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> Cette passe vérifie les corrections de M1 et de m1 à m4 de la neuvième passe. Je ne remets pas en cause les décisions de l'utilisatrice du 16/11/2026. Je vérifie seulement que le texte les applique de façon cohérente et testable.
> Ce que j'ai lu en entier : l'en-tête (l. 1-106), s33 (l. 2601-2668), s40 (l. 3005-3056), s42 (l. 3103-3192), s53 à s58 (l. 3934-4253), le récapitulatif (l. 4255-4353) et le tableau du PRD (l. 56-134). Je n'ai pas de shell, donc pas de diff git : les corrections sont vérifiées sur le texte actuel.

**En bref : 0 critique, 0 majeur, 4 mineurs.** M1 et m1 à m4 sont corrigés. Les corrections ouvrent quatre points mineurs, sans effet sur le gate :

- le cas d'une adresse votante désignée qui change ou disparaît sans que le bureau intervienne ;
- un pronom ambigu dans s58 c5 ;
- deux cas limites dans s54 c4 ;
- l'unité de la relance dans s42 c8.

## Couverture du périmètre

Le tableau du PRD n'a pas changé : 42 lignes au cœur (l. 62-103) et 3 modules activables (l. 111-113).

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
  - **Procurations** : la note de s58 (l. 4246-4248) écarte toujours le mandat et la délégation.
  - **Comptage des voix** : s58 ne compte aucune voix. Elle affiche seulement le nombre de terrains, sans le transmettre avant la réponse d'ASL Community (l. 4242-4244).
  - **Plan B de connexion** : une fiche sans adresse reste « courrier uniquement » (s54 c9, s58 c7).
- [x] Aucune story ne dépasse le périmètre. Les treize stories hors tableau restent justifiées (l. 4329-4343).

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout.
- [ ] Chaque critère peut devenir un test : **presque**. Il reste quatre ambiguïtés mineures, sur s58 c5, s54 c4 et s42 c8 (m1 à m4).
- [x] Les notes agentiques sont présentes et utiles. Une phrase de la note de risque de s54 est en retard sur c4 (voir m3).
- [x] La complexité est notée, et aucune story n'est à 5. s54 et s42 restent à 4 et énoncent leur risque (l. 4040, l. 3184-3186). s58 reste à 2.

## La liste dans son ensemble

- [x] L'ordre des dépendances est exécutable : pas de cycle, aucune référence en avant bloquante. Les renvois de s54 c2 et c9 vers s40 et s58 sont maintenant présentés comme des effets portés par ces stories.
- [x] Les ids sont bien formés, uniques et conformes au récapitulatif. Le décompte n'a pas changé : 68 stories, dont cinq à 1, vingt-quatre à 2, vingt-six à 3 et treize à 4.
- [x] Pas de recouvrement. s54 décide qui modifie une adresse et s58 décide qui détient la voix. s42 suit l'adoption par adresse, et la couverture des canaux reste comptée en fiches.

## Vérification des corrections de la neuvième passe

| Constat | État |
| --- | --- |
| M1 (prise du titre par une adresse supplémentaire) | **Corrigé.** s54 c4 (l. 4020) : une personne connectée « ajoute des adresses à la fiche (elles sont supplémentaires) et **ne modifie que sa propre adresse**, qu'elle soit titulaire ou supplémentaire ». Le bureau ajoute, modifie et supprime toutes les adresses. Le test d'autorisation sur l'appel serveur direct couvre les deux sens. s54 c9 (l. 4025) ne parle plus que de « la personne titulaire elle-même ». Le chemin du proche qui remplace l'adresse du parent est fermé. s58 c3 et s40 c3 redeviennent vrais sans réserve. |
| m1 (titulaire désignée votante) | **Corrigé.** s58 c5 (l. 4226) : « Désigner l'adresse titulaire comme votante, ou voir l'adresse désignée devenir titulaire, ramène au défaut ». La phrase insérée crée toutefois une ambiguïté de pronom (m2). |
| m2 (unité du suivi d'adoption) | **Corrigé.** s42 c7 (l. 3126) suit l'adoption « par adresse », avec un seul état pour une adresse partagée, affiché sur chaque fiche. La couverture des canaux reste comptée en fiches (c5). s42 c8 (l. 3127) relance chaque adresse jamais connectée, y compris celle d'un proche. c7, c12 et c14 sont cohérents entre eux. Il reste un cas limite (m4). |
| m3 (notification de s56 et voix) | **Corrigé** par s58 c6 (l. 4227). Il reste un cas voisin sans notification (m1). |
| m4 (s54 c2 et les effets de s40 et s58) | **Corrigé** (l. 4018) : ces effets sont « portés par s40 et s58, livrées après, et testées de leur côté ». |

## Constats

### Critique

Aucun.

### Majeur

Aucun.

### Mineurs

- **m1 — s58 c5 et c6, avec s54 c4 et s56 c5 : une adresse votante désignée par le bureau peut perdre la voix sans que le bureau intervienne ni soit prévenu.**
  - s58 c5 : si l'adresse désignée « est retirée ou n'est plus active, la voix revient à l'adresse titulaire ».
  - Deux chemins y mènent sans le bureau :
    - **L'import.** s56 c5 désactive une adresse non titulaire absente du nouveau fichier. Si c'était l'adresse votante désignée, la voix revient à la titulaire. Or s58 c6 ne prévoit de notification que pour la désignation d'office d'une titulaire.
    - **La personne elle-même.** La personne désignée corrige sa propre adresse, ce que s54 c4 lui permet. On ne sait pas si la désignation suit la nouvelle adresse une fois confirmée, ou si elle tombe parce que l'ancienne « n'est plus active ». s54 c9 règle ce délai de confirmation pour la seule titulaire (« jusqu'à la confirmation, l'ancienne reste titulaire »). Pour une adresse supplémentaire modifiée, le texte ne dit pas si l'ancienne reste active jusqu'à la confirmation.
  - La ligne Vote du PRD réserve ce choix au bureau (« modifiable par le bureau seul »), qui n'en saurait rien.
  - Correction attendue : une phrase dans s58, par exemple « une désignation qui tombe par l'import ou par la modification de l'adresse est notifiée au bureau comme en c6 ». Préciser aussi si la désignation suit l'adresse modifiée par sa propriétaire. Ce n'est pas un retour sur la décision m1 du 16/11 : seul le cas de la désignation qui tombe est ajouté.

- **m2 — s58 c5 : la correction de m1 rend ambigu le pronom de la phrase suivante.**
  - « […] ramène au défaut : la voix suit de nouveau la titulaire. **Si elle est retirée** ou n'est plus active, la voix revient à l'adresse titulaire. »
  - Juste après la phrase insérée, « elle » peut désigner la titulaire, ce qui n'a pas de sens, au lieu de l'adresse votante désignée.
  - Correction attendue : écrire « Si l'adresse votante désignée est retirée ou n'est plus active ».

- **m3 — s54 c4 : deux cas limites que la décision M1 ne tranche pas explicitement, et une note en retard sur le critère.**
  - (a) **Supprimer sa propre adresse.** Le critère dit que la personne « ajoute » et « modifie » la sienne, et que le bureau « supprime ». Il ne dit pas si une personne peut retirer sa propre adresse de la fiche (un proche qui ne veut plus rien recevoir). La décision du 16/11 (« only the board modifies and deletes all addresses ») suggère que non : il suffit de l'écrire.
  - (b) **Adresse en attente de confirmation.** Une personne en ajoute une, qui est supplémentaire. Tant que le lien n'est pas confirmé, cette adresse n'est « la propre adresse » de personne. Celle qui l'a ajoutée ne peut donc pas corriger une faute de frappe, et rien ne dit si l'adresse en attente expire. Le bureau reste le recours. Une phrase suffit.
  - (c) La note de risque de s54 (l. 4041-4042) dit encore que « le membre ajoute et modifie désormais **ses** adresses ». C'est en retard sur c4 (« ne modifie que sa propre adresse »). C'est un détail de rédaction, mais un implémenteur lit les notes.

- **m4 — s42 c8 : on ne sait pas si la relance « des jamais connectés » touche aussi les adresses jamais invitées.**
  - c12 distingue trois états : « jamais invitée », « invitée », « connectée ».
  - c8 « renvoie une invitation à chaque adresse jamais connectée ». Une adresse ajoutée après le lancement (s54), jamais invitée, est aussi « jamais connectée ».
  - Correction attendue : préciser si la relance couvre les deux états ou seulement les adresses invitées, pour que le test soit univoque.

Cas limite signalé sans constat séparé : s55 c5 et s16. Avec les « mêmes droits dans l'espace membre » de s54 c2, un proche connecté peut corriger l'adresse de domicile et le téléphone du parent. La règle de c4 (chacun ne modifie que sa propre adresse) ne vaut que pour les adresses email. Cela découle des décisions du 16/11 et je ne le classe pas. Il faut s'en souvenir au `/ks-design` de s54, et l'avis RGPD ouvert le couvre (l. 102).

## Verdict

- Couverture complète : 42 lignes du cœur et 3 modules.
- Aucune fuite du cimetière.
- Ids conformes, décomptes exacts (68 stories ; 5 / 24 / 26 / 13), aucune story à 5.
- Ordre exécutable : pas de cycle, aucune référence en avant bloquante.
- Les cinq corrections de la neuvième passe sont appliquées et cohérentes avec les décisions du 16/11. Le chemin de prise de contrôle de M1 est fermé.

Il ne reste que des mineurs, et le découpage passe le gate. m1 et m2 se règlent dans s58 avant son plan. m3 se règle dans s54 avant son `/ks-research`, et m4 dans s42 avant son plan.

Max severity: minor
Stories ready: yes
