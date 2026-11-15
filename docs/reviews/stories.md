# Revue du découpage : ASL-CMS (Lp)

> J'ai relu `docs/stories.md` (HEAD de main, commit f3692dc7, 67 stories) face à `docs/prd.md` (HEAD), avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> C'est la sixième passe du 15/11/2026. Elle vérifie les corrections de M1, M2 et m1 à m11 de la cinquième passe.
> Le fichier dépasse la limite de lecture, je l'ai donc lu par passes ciblées. J'ai lu en entier l'en-tête (l. 1-106), s24 à s27b, s29, s38 à s41, s52 à s57 et le récapitulatif. J'ai contrôlé les autres stories par recherche ciblée (`s53`, `s54`, `titulaire`). Je n'ai pas fait de diff git (pas de shell). J'ai donc lu les corrections comme du texte neuf, sans les comparer à l'ancien.

**En bref : 0 critique, 0 majeur, 8 mineurs.** Les deux majeurs et les onze mineurs de la passe précédente sont corrigés. Les corrections de M1 et M2 tiennent sur le fond. Elles laissent des imprécisions mineures autour de l'adresse titulaire (m1, m2, m6) et deux mentions périmées (m3, m4).

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
| Un seul accès pour plusieurs terrains | s53 (+ s18, s19, s32, s40) | oui |
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
  - s54 n'est pas un plan B de connexion : une fiche sans adresse reste gérée par courrier (note l. 4065).
  - s57 ne code ni purge, ni prorata, ni solde.
  - s56 ne crée aucun membre (c5).
  - s33 et s53 ne comptent aucune voix.
- [x] Aucune story ne dépasse le périmètre. Les treize stories hors tableau sont toutes justifiées dans le récapitulatif (l. 4270-4284).

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout. La seule transverse, s39, est assumée et bornée.
- [x] Chaque critère peut devenir un test. Trois critères gardent une imprécision mineure (m1, m2, m8).
- [x] Les notes agentiques sont présentes et utiles. Celle de s24 est maintenant alignée sur s40. Une note de s29 est en léger décalage avec son critère c6 (m7).
- [x] Complexité notée, aucun 5. Les treize stories à 4 énoncent leur risque.

## La liste dans son ensemble

- [x] Ordre des dépendances : pas de cycle et pas de référence en avant bloquante. L'en-tête ne décrit plus fidèlement la place de s25 (m4), sans effet bloquant, puisque les dépendances déclarées permettent un tri topologique.
- [x] Ids bien formés (`s<numéro>[lettre]-<slug>`), uniques et conformes au récapitulatif.
- [x] Décomptes vérifiés :
  - 67 lignes : cinq à 1, vingt-trois à 2, vingt-six à 3, treize à 4 ;
  - la liste des treize stories à 4 est exacte ;
  - s38 déclare bien 31 dépendances, et le texte (l. 2901, l. 2926-2927, l. 4307) dit maintenant « trente et une » ;
  - le tableau des réserves annonce « Six points » et en compte six.
- [x] Pas de recouvrement : le doublon interne à s40 est fusionné (c6), et le retrait d'une adresse est cohérent entre s53 c6 et s54 c9.

## Constats

### Critique

Aucun.

### Majeurs

Aucun.

### Mineurs

- **m1 — s54 c8 (l. 4018) : l'invariant du critère contredit son propre cas de suppression.**
  - Le critère pose qu'« une fiche qui porte au moins une adresse active a **exactement** une adresse titulaire ».
  - Il dit ensuite que supprimer l'adresse titulaire ne promeut aucune adresse : la fiche est « sans adresse titulaire » tant que le bureau n'a pas désigné la nouvelle « parmi les adresses actives ».
  - Dans cet état, la fiche a des adresses actives et zéro titulaire. Un test de l'invariant échoue donc sur le cas que le même critère exige.
  - Correction attendue : écrire « **au plus** une adresse titulaire ». Préciser aussi que, dans l'état « sans adresse titulaire », aucune adresse de la fiche ne se connecte tant que le paramètre de la réserve est désactivé.

- **m2 — s56 c3 face à s54 c8 : le « remplacement » de l'adresse titulaire par le fichier n'est pas défini.**
  - s56 c3 dit que « la nouvelle adresse devient titulaire ». Trois cas restent sans règle :
    - (a) l'ancienne adresse titulaire disparaît du fichier, mais une adresse supplémentaire déjà présente (celle d'un enfant, venue du fichier) y reste. S'agit-il d'un remplacement, donc d'une promotion de l'adresse du proche, que la note de s54 l. 4063 interdit (« ne jamais promouvoir d'office ») ? Ou d'une suppression, qui laisse la fiche sans titulaire (s54 c8) ?
    - (b) la règle « dans une cellule d'import à plusieurs adresses, la première est titulaire » (s54 c8) s'applique-t-elle aussi à une fiche **existante** lors de l'import annuel ? Si oui, un simple changement d'ordre dans la cellule déplace le titre.
    - (c) une adresse venue du fichier, non titulaire, qui disparaît du nouveau fichier est-elle retirée ? s56 c7 ne protège que les adresses ajoutées sur le site.
  - La lecture prudente est probablement la bonne : « nouvelle » veut dire « absente de la fiche jusque-là ». Mais le cas (a) touche directement la réserve RGPD.
  - Correction attendue : une phrase dans s56 c3, par exemple « remplacement = ancienne titulaire absente du fichier et adresse nouvelle pour la fiche ; une adresse supplémentaire existante n'hérite jamais du titre par le fichier ». Dire aussi ce que devient une adresse venue du fichier qui disparaît.

- **m3 — Tableau des réserves, ligne « Avis RGPD sur l'accès d'un tiers » (l. 101) : texte périmé.**
  - Les colonnes « Bloque » et « Contournement prévu » parlent encore des « notes internes dans la copie en ligne » et disent que « s40 exclut les notes internes ».
  - Depuis la correction de M2, s40 c2 et la note de s24 (l. 2054) excluent **tout le fil de s24**, notes **et** échanges.
  - Il faut aligner la ligne, sans quoi le tableau dit moins que la story.

- **m4 — En-tête l. 31-34 : la place de s25 n'est plus décrite.**
  - La correction de m5 a ajouté s25 aux dépendances de s53. Or s53 doit passer avant s18 et s19. s25 (bloc C) doit donc s'exécuter avant s18 et s19 (bloc B).
  - La phrase « pour toutes les autres stories, l'ordre des ids reste l'ordre d'exécution » devient fausse pour s25.
  - L'en-tête place aussi s54 « après s25 », alors que s54 dépend maintenant de s26.
  - Sans effet bloquant : les dépendances déclarées suffisent au tri. C'est sans effet pratique si s25 et s26 sont déjà livrées. Il faut tout de même corriger la phrase (« s53 après s25 », « s54 après s26 »).

- **m5 — s40 c2 : dépendances non déclarées.**
  - Le critère nomme « ses questions au bureau (s23) et ses signalements (s22) ».
  - s40 ne dépend ni de s22 ni de s23. s23 n'arrive que par s38, et s22 par rien.
  - Sans effet bloquant, puisque les deux ids précèdent s40. Il faut les ajouter à la liste et au récapitulatif.

- **m6 — s53 c3 et s54 c2 : « titulaire » a deux sens.**
  - s53 c3 dit que le site « nomme le **titulaire du compte** existant », c'est-à-dire la personne.
  - s54 introduit l'« **adresse titulaire** » d'une fiche, une notion différente.
  - Les deux sont désormais au cœur des mêmes tests. Il faut renommer l'un des deux, par exemple « le détenteur du compte » dans s53.

- **m7 — s29, note l. 2455-2457, face à c6 : une décision déjà prise est présentée comme ouverte.**
  - La note laisse « à trancher en `/ks-design` » le choix entre une relance par accès et un email par facture.
  - Or c6 tranche déjà : une adresse ne reçoit pas deux fois la même relance pour une même échéance, et l'échéance est commune à tous (même note). Il y a donc une relance par adresse.
  - Il faut préciser que le design ne décide que de la présentation des factures regroupées dans cette relance, pas du nombre d'envois.

- **m8 — s53, règle de l'adresse partagée (l. 3984-3988), face au cas d'usage de s54 : le proche qui est lui-même membre.**
  - La règle pose qu'une adresse portée par plusieurs fiches désigne « toujours **une seule personne** ».
  - Or le cas d'usage de s54 est l'enfant qui gère l'espace de son parent avec sa propre adresse. Si cet enfant possède lui-même un terrain dans l'association, ajouter son adresse à la fiche du parent déclenche la confirmation « même personne » de s53 c3, renvoyée par s54 c7. Le bureau doit alors mentir ou refuser.
  - Selon le choix, les effets divergent :
    - s57 : la vente de tous les terrains du parent laisse l'accès ouvert, puisque le « même membre » possède encore le terrain de l'enfant ;
    - s40 c3 : la copie de l'enfant inclut toutes les fiches du parent, fil de s24 exclu ;
    - s33 : les droits de vote sont rattachés au même compte.
  - Il faut écrire que ce cas n'est pas servi en V1 (refus, s'adresser au bureau), ou le renvoyer explicitement à l'ADR de la table de liaison de s53/s54, à trancher en `/ks-research`.

### Suivi de la revue précédente

| Constat (cinquième passe) | État |
| --- | --- |
| M1 (succession de l'adresse titulaire) | corrigé : s54 c8 nouveau, c5 étendu à « ou modifiée », s56 c3 nouveau, note l. 4061-4063. Restent les imprécisions m1, m2 et m6. |
| M2 (fil de s24 dans la copie en ligne) | corrigé : s40 c2 exclut notes **et** échanges, s40 c6 et la note l. 3031-3035 sont alignés, la note de s24 (l. 2050-2055) aussi. Reste le tableau des réserves (m3). |
| m1 (s29, budget de 100) | corrigé (l. 2452-2453 : 300, réserve 100, 200 reportables) |
| m2 (s38, décompte des dépendances) | corrigé (« trente et une », l. 2901, l. 2926-2927, l. 4307) |
| m3 (s53 c5, fichier réel) | corrigé (fixture anonymisée versionnée) |
| m4 (retrait d'une adresse) | corrigé (s54 c9 « à cette fiche », cohérent avec s53 c6) |
| m5 (dépendances incomplètes) | corrigé (s25 dans s53, s26 dans s54, s20 dans s56, en-tête l. 33). La correction fait naître m4. |
| m6 (s56 c2, valeur modifiée sur le site) | corrigé (exception dans le critère) |
| m7 (s57 et plusieurs adresses) | corrigé (s57 c1 « toutes les adresses », dépendance à s54, s54 c4 « ajoute ») |
| m8 (identité d'un membre, s27 c5) | corrigé (exception nommée l. 64-66, décompte « en fiches » dans s27 c5) |
| m9 (écran de s57 c2) | corrigé (fiche membre du back-office) |
| m10 (doublon dans s40) | corrigé (critère unique c6, « avec ou sans compte ») |
| m11 (envois aux adresses supplémentaires) | corrigé (tableau des réserves et note de s54 l. 4055-4059) |

## Verdict

- Couverture complète : 42 lignes du cœur et 3 modules.
- Aucune fuite du cimetière.
- Ids conformes, décomptes exacts, aucun 5.
- L'ordre est exécutable : pas de cycle, pas de référence en avant bloquante.
- Les treize constats de la cinquième passe sont corrigés.

Aucun constat n'est critique ni majeur : le découpage passe le gate. Je recommande de traiter m1, m2 et m8 avant le `/ks-research` de s53, s54 et s56. Ils touchent la réserve RGPD et l'accès aux données d'un tiers, et ils se corrigent en une phrase chacun. Les autres mineurs sont rédactionnels.

Max severity: minor
Stories ready: yes
