# Revue du découpage : ASL-CMS (Lp)

> J'ai relu `docs/stories.md` (HEAD de main, 67 stories) face à `docs/prd.md` (HEAD), avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> C'est la cinquième passe du 15/11/2026. Elle suit les corrections de M1, M2, M3 et m8 de la passe précédente.
> Le fichier dépasse la limite de lecture, je l'ai donc lu par passes ciblées. J'ai lu en entier l'en-tête, le tableau des réserves, s24, s27 à s29, s33, s40 à s42, s52 à s57 et le récapitulatif. J'ai vérifié les autres stories par recherche ciblée. Je n'ai pas fait de diff git (pas de shell).

**En bref : 0 critique, 2 majeurs, 11 mineurs.** Les quatre corrections annoncées sont faites. Les deux majeurs sont nouveaux et viennent de ces corrections :

- la règle de « l'adresse titulaire », ajoutée pour la réserve RGPD de s54, ne dit pas ce que devient le titulaire quand son adresse change ;
- s40 exclut les notes internes de la copie en ligne, mais y laisse les échanges consignés par le bureau, qui font partie du même fil privé de s24.

## Couverture du périmètre

Le PRD compte 42 lignes au cœur (l. 62-103) et 3 modules activables.

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
| Coordonnées | s16 (+ s55) | oui |
| Un seul accès pour plusieurs terrains | s53 (+ s18, s19, s32, s40) | oui |
| Plusieurs adresses connectables | s54 (+ s29, s42) | oui (connexion supplémentaire livrée derrière un paramètre, voir M1 et m11) |
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
| Export individuel d'un membre | s40 | oui (voir M2) |
| Simulation de rôle SuperAdmin | s41 (+ s48) | oui |
| Export et portabilité | s38, s39 | oui |
| Module Vote | s33 | oui |
| Module Voirie | s34 | oui |
| Module Petites annonces | s35 | oui |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story. Aucune n'est orpheline.
  - s54 livre la connexion des adresses supplémentaires désactivée au seed. Je ne compte pas ça comme un trou de couverture : le PRD place lui-même cet accès sous réserve RGPD (_Constraints_), et le mécanisme est livré et activable par association.

## Périmètre

- [x] Aucune story ne fait revenir un élément du cimetière.
  - s54 n'est pas un plan B de connexion : une fiche sans adresse reste gérée par courrier (note l. 4049).
  - s57 ne code ni purge, ni prorata, ni solde.
  - s56 ne crée aucun membre.
  - s33 ne compte aucune voix.
- [x] Aucune story ne dépasse le périmètre. Les 13 stories hors tableau sont toutes justifiées dans le récapitulatif.

## Qualité des stories

- [x] Chaque story est une tranche de bout en bout. La seule transverse, s39, est assumée et bornée.
- [ ] **Critères testables : deux défauts majeurs** (M1, M2), plus m4, m6 et m7.
- [x] Les notes agentiques sont présentes et utiles. La réserve RGPD est maintenant reportée dans s54 et dans s40. Une note est périmée (s24 l. 2049-2050, voir M2).
- [x] Complexité notée, aucun 5. Les treize stories à 4 énoncent leur risque.

## La liste dans son ensemble

- [x] Ordre des dépendances : pas de cycle et pas de référence en avant bloquante. Certaines dépendances déclarées sont incomplètes, sans effet bloquant (m5).
- [x] Ids bien formés (`s<numéro>[lettre]-<slug>`), uniques et conformes au récapitulatif.
- [x] Décomptes vérifiés :
  - 67 lignes ; cinq à 1, vingt-trois à 2, vingt-six à 3, treize à 4 ;
  - la liste des treize stories à 4 est exacte ;
  - le tableau des réserves annonce « Six points » et en compte bien six.
- [ ] Recouvrements : un doublon interne à s40 (m10) et l'ambiguïté s53/s54 sur le retrait d'une adresse (m4, toujours ouverte).

## Constats

### Critique

Aucun.

### Majeurs

**M1 — s54 c2 (et par ricochet s56 c2, s54 c4, s54 c9) : la règle de l'adresse titulaire ne dit pas ce qui se passe quand le titulaire change.**

- s54 c2 définit l'adresse titulaire comme « celle déjà reliée à un compte avant cette story ou, pour une fiche nouvelle, la première saisie ou importée ». Seule cette adresse se connecte tant que le paramètre RGPD est désactivé. Il l'est au seed, donc chez La Fourche pour une durée indéterminée.
- Rien ne dit ce que devient le titulaire quand :
  - le bureau supprime ou modifie l'adresse titulaire (c4) ;
  - le membre modifie sa propre adresse titulaire (c4). Il faut aussi savoir si une adresse modifiée par le membre doit être reconfirmée par lien (c5 ne parle que d'adresse « ajoutée ») ;
  - l'import annuel remplace l'adresse d'une fiche par une nouvelle (s56 c2, « leurs adresses email sont mises à jour »). C'est le cas d'usage principal de s56 : un propriétaire qui a changé d'adresse ;
  - l'import met plusieurs adresses dans une même cellule pour une fiche nouvelle (c9). Il faut savoir laquelle est « la première ».
- Deux lectures donnent deux tests opposés :
  - soit la nouvelle adresse hérite du titre ;
  - soit elle devient supplémentaire, et le propriétaire ne peut plus se connecter tant que le paramètre est coupé. Le message explicite de c2 ne le débloque pas, et seul le SuperAdmin pourrait réparer.
- La deuxième lecture est une régression silencieuse sur la population que c6 (non-régression) veut protéger.
- Correction attendue : écrire dans s54 la règle de succession du titulaire, par exemple « remplacer ou modifier l'adresse titulaire transfère le titre ; supprimer la seule adresse titulaire promeut … ou laisse la fiche sans connexion, avec un signalement au bureau ». Ajouter ensuite à s56 un critère sur le remplacement d'une adresse titulaire par le fichier.

**M2 — s40 c2 (et s24, note l. 2049-2050) : la copie en ligne exclut les notes internes mais inclut les échanges consignés par le bureau.**

- La correction de M3 a réécrit c2 : la copie en ligne contient tout, « historique d'échanges compris, **sauf les notes internes** écrites sur lui par le bureau (s24) ».
- Or s24 livre un seul fil privé, côté bureau, avec deux types d'entrée : des notes, et des échanges saisis à la main par un bénévole (« date, canal, résumé libre », s24 c2 et note l. 2037). La ligne du PRD les regroupe sous « Notes internes et historique par membre ».
- La note de s40 (l. 3026-3029) justifie l'exclusion ainsi : un proche connecté avec sa propre adresse ne doit pas obtenir ce que le bureau écrit sur le propriétaire. Le résumé libre d'un appel téléphonique est exactement ce genre de texte.
- c2 ouvre donc par la copie en ligne une partie du fil que s24 c4 déclare inaccessible au membre « ni par une page ni par un appel serveur ». Et on ne sait pas si l'« historique d'échanges » de c2 désigne les échanges de s24 ou autre chose (questions, signalements). Deux tests possibles.
- La note de s24 (l. 2049-2050) dit encore que les notes sont « incluses » dans la copie du membre, sans la nuance « copie par le bureau seulement ».
- Correction attendue :
  - écrire dans s40 c2 que les entrées de s24 (notes **et** échanges) sont exclues de la copie en ligne, ou nommer précisément l'historique qui y entre ;
  - aligner la note de s24 sur cette règle.

### Mineurs

- **m1 — s29, note l. 2447 (non corrigé depuis deux passes).**
  - La note dit « Le budget de s52 (100 par jour) les étale ».
  - Le budget de s52 est de 300 avec une réserve de 100, soit 200 envois reportables par jour (s52 c1 et c3). Les 100 par jour sont le plafond propre aux campagnes de s26.
  - Le test de volume (200 impayés le même jour) dépend de la bonne valeur.
- **m2 — s38, l. 2895 et l. 2918-2920, et récapitulatif l. 4290 (non corrigé).**
  - Le texte dit « vingt-sept dépendances » et « La liste ci-dessus fait foi : vingt-sept ».
  - La liste en compte 31.
- **m3 — s53 c5 (non corrigé).** Le critère repose sur le fichier réel, qui est hors git (« 25 lignes, 10 adresses partagées »), donc la CI ne peut pas l'exécuter. Il faut une fixture anonymisée qui reproduise le cas.
- **m4 — s53 c6 et s54 c8 : retrait d'une adresse (non corrigé).**
  - s54 c8 dit « ferme l'accès de cette adresse seule ».
  - Pour une adresse portée par plusieurs fiches, il faut écrire « ferme l'accès de cette adresse à cette fiche », sinon c8 contredit s53 c6.
- **m5 — dépendances déclarées incomplètes, sans effet bloquant (non corrigé).**
  - s53 c7 agit sur le calcul de la cible de s25 sans dépendre de s25.
  - s54 c3 cite s26 sans en dépendre.
  - s56 suppose que le bureau saisit l'identifiant Pennylane (s20) sans dépendre de s20.
  - L'en-tête l. 33 dit encore « s57 après s53 », alors que s57 dépend aussi de s19 et s32.
- **m6 — s56 c2 face à la note l. 4128-4130 (non corrigé).**
  - Le critère met les coordonnées à jour sans condition.
  - Le défaut proposé dans la note protège une valeur modifiée sur le site depuis le dernier import.
  - Il faut faire entrer cette exception dans le critère.
- **m7 — s57 face à s54 (non corrigé).**
  - s57 parle de « son accès » au singulier et ne dépend pas de s54.
  - Il faut préciser que la fin du délai ferme l'accès de toutes les adresses reliées à la fiche (celle d'un enfant, par exemple), et ajouter s54 aux dépendances.
  - Corollaire : s54 c4 dit toujours « modifie et supprime » pour le bureau, sans dire « ajoute ». Seul c5 le laisse entendre.
- **m8 — s27 c5 et la règle transverse « Identité d'un membre » (l. 59-63), ex-m9 (non corrigé).**
  - La règle exclut l'email de toute clé de dédoublonnage parce qu'il peut être « partagé dans un foyer ». Pourtant s53 relie à l'import les fiches qui partagent une adresse.
  - La règle devrait nommer l'exception : le compte de connexion suit l'adresse, la fiche garde sa clé primaire.
  - s27 c5 devrait dire si le décompte « avec email » se fait en fiches ou en adresses.
- **m9 — s57 c2 (repris de l'ancien m4).** L'écran où le bureau « consulte l'espace devenu inactif » n'est toujours pas désigné : fiche du bureau, ou vue de l'espace membre en lecture seule. Il faut le savoir pour écrire le test.
- **m10 — s40 c3 et c7 (nouveau).** Les deux critères disent la même chose (le bureau produit une copie complète pour un membre). Il faut les fusionner : un seul test, une seule formulation, « avec ou sans compte ».
- **m11 — s54 c2 et c3, portée de la réserve RGPD (nouveau).**
  - Le contournement coupe la **connexion** des adresses supplémentaires, mais les laisse recevoir tous les envois. Cela inclut les relances d'impayés (s29 c6) et la mise à disposition d'une facture, qui sont des données du membre adressées à un tiers.
  - La réserve du PRD porte sur « l'accès d'un tiers aux données d'un membre ».
  - Il faut dire explicitement, dans la note de s54 ou dans la ligne du tableau des réserves, que la question des envois aux adresses supplémentaires fait partie de l'avis attendu, ou que l'envoi est jugé hors réserve.

### Suivi de la revue précédente

| Constat | État |
| --- | --- |
| M1 (statut des adresses importées ou saisies par le bureau) | corrigé (s54 c5, c6). La correction fait naître M1 ci-dessus sur le titulaire. |
| M2 (réserve RGPD absente) | corrigé (sixième ligne du tableau, paramètre de tenant dans s54 c2, s42 c6 aligné). Portée à préciser (m11). |
| M3 (contradiction dans s40) | corrigé (c2, c3, note). La correction fait naître M2 (échanges) et m10 (doublon). |
| m1 | non corrigé (m1) |
| m2 | non corrigé (m2) |
| m3 | non corrigé (m3) |
| m4 | non corrigé (m4) |
| m5 | non corrigé (m5) |
| m6 | non corrigé (m6) |
| m7 | non corrigé (m7) |
| m8 (s33) | corrigé (nom retiré, « seule action réservée » amendé, multi-vote reporté dans les réserves) |
| m9 | non corrigé (m8) |

## Verdict

- Couverture complète : 42 lignes du cœur et 3 modules.
- Aucune fuite du cimetière.
- Ids conformes, décomptes exacts, aucun 5.
- L'ordre est exécutable.

Il n'y a aucun constat critique, donc le découpage passe le gate. Je recommande quand même de traiter M1 avant le `/ks-research` de s54 (et de s56), et M2 avant celui de s40 : tous deux touchent l'accès aux données personnelles, et M1 peut empêcher des membres déjà connectés de se reconnecter. Les mineurs m1 à m8 sont reportés pour la deuxième ou troisième fois ; ils se corrigent en quelques lignes.

Max severity: major
Stories ready: yes
