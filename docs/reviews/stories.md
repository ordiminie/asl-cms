# Revue du découpage : ASL-CMS (Lp)

> Relecture à contexte neuf de `docs/stories.md` (50 stories) face à `docs/prd.md`, avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique / majeur / mineur.
> s01, s01b, s02 et s03 sont livrées : ni leur taille ni leur contenu ne sont rediscutés.
> Passe précédente : verdict `minor` / `yes`, six mineurs m16 à m21. Leur fermeture est vérifiée ci-dessous.
> Effort concentré sur **s12a-retrait-supabase** (insérée le 2026-09-20) et sur ce que son insertion déplace, sans renoncer au passage complet.

**En bref : aucun critique, un majeur, six mineurs. Les six mineurs de la passe précédente sont fermés.**

- Toutes les lignes du périmètre restent couvertes ; l'insertion de s12a n'en découvre aucune.
- s12a n'est **pas** une story de couche technique déguisée : elle a un utilisateur déclaré (le prestataire), un comportement observable (l'application démarre et sert ses fichiers sans Supabase) et elle solde une **contrainte explicite du PRD**, pas seulement une dette de boilerplate.
- Le majeur est un défaut de la liste, pas de la story : **s12a n'existe pas dans le récapitulatif de fin de document**, et s12b y garde une liste de dépendances fausse.

## Suivi de la revue précédente

| Constat                                                    | État                     | Preuve                                                                                                                                              |
| ---------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| m16 : s29 sans critère sur le désinscrit face à la relance | **Fermé**                | s29 c7 : « déclare sa nature dans le mécanisme de s27b… vérifié sur les deux cas ».                                                                 |
| m17 : gabarit de l'email de lancement implicite            | **Fermé**                | s42 c4 : « porte l'habillage commun des campagnes (s25)… et la mention de s27b ».                                                                   |
| m18 : s27b c1 déclarait des envois livrés plus tard        | **Fermé**                | s27b c1 borné aux « quatre modèles de s25 et la campagne libre » ; la note renvoie la déclaration à s29 et s42.                                     |
| m19 : détection inverse de s12c seulement en note          | **Fermé**                | s12c c4 : « Ajouter une colonne de clé de fichier qui suit la convention… fait échouer ce test ».                                                   |
| m20 : récapitulatif et libellés périmés                    | **Fermé**                | s03 est redescendue à 3 après scission, les « quatre écarts » sont exacts ; s26 cite « Mineurs m4 (planificateur) et m15 (report de la scission) ». |
| m21 : règle transverse citant un envoi inexistant          | **Fermé**                | La règle « Désinscription » ne parle plus que des « envois facultatifs, dont les campagnes libres ».                                                |
| m5 : stories hors du tableau du PRD                        | **Rouvert pour mémoire** | Elles sont désormais **quatre** (s12a, s12b, s12c, s39), toutes déclarées en en-tête — mais le récapitulatif en annonçait trois (m4).               |

## Couverture du périmètre

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story : 37 lignes du tronc commun et 3 modules. **L'insertion de s12a ne retire aucune couverture** : elle ne déplace ni ne dédouble aucune ligne de périmètre. Le détail ligne à ligne est repris de la passe précédente, dont aucune entrée n'a bougé.
- Note de couverture inverse, en faveur de s12a : la contrainte PRD « Le stockage de fichiers du boilerplate (Supabase) et l'email (Resend) devront être remplacés » n'était soldée qu'à moitié. s03 a fermé le volet email (contrat `EmailTransport`), s01b a posé l'adaptateur `local` — mais rien ne **retirait** Supabase. s12a ferme le volet fichiers. C'est une meilleure justification que celle de son en-tête et elle mériterait d'y figurer.

## Périmètre

- [x] Aucune story ne reprend un élément du cimetière. s12a en particulier ne rouvre rien : elle retire un fournisseur, elle n'en introduit aucun, et sa note interdit explicitement de déborder sur s04 et s31.
- [x] Aucune story ne dépasse le périmètre, sauf **quatre** dérogations déclarées en en-tête : s12a, s12b, s12c (exploitation) et s39 (garde-fou de non-régression).
- Pas de contradiction avec s39, qui se dit « seule story transverse du découpage » : la définition qu'elle en donne est « ne livre aucun comportement observable par un utilisateur », et s12a en livre un pour un utilisateur déclaré au PRD, le SuperAdmin.

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, aux quatre dérogations déclarées près. **s12a n'est pas une couche technique** au sens de la règle : elle ne prépare pas un usage futur, elle retire un obstacle constaté et vérifiable, et elle est livrable seule. Elle appartient à la même famille que s12b et s12c, dont elle reprend la formule « En tant que prestataire (SuperAdmin) ».
- [ ] Chaque critère peut devenir un test : **presque**. Deux exceptions, toutes deux sur le couple s12a / s12b (m1 et m2).
- [x] Notes agentiques présentes et utiles partout. Celles de s12a sont d'un bon niveau : état d'entrée vérifié et daté, trois points de câblage nommés avec leurs fichiers, et le piège qui compte (« rendre les variables facultatives ne suffit pas », l'échec se déplaçant du démarrage vers l'envoi de fichier).
- [x] Complexité notée partout, **aucune story à 5**, et les huit stories à 4 explicitent leur risque. Le 2 de s12a est cohérent : périmètre mécanique, outillé (test de garde d'imports, `--frozen-lockfile`), sans décision d'architecture — le seul aléa est l'arbitrage sur les deux écrans hérités, objet de m1.

## La liste dans son ensemble

- [x] Ordre de dépendances exécutable : aucun cycle, aucune référence en avant. Arêtes nouvelles vérifiées : **s12a → s01b** (livrée) et **s12b → s12a**. La chaîne s01b → s12a → s12b → s12c → s13 tient, et s26 → s12b hérite correctement.
- [ ] Ids bien formés et uniques : oui pour la forme (`s12a-retrait-supabase`), **non pour la concordance en-tête / récapitulatif** (majeur M1).
- [x] Aucun chevauchement. Les trois soupçons examinés sont levés :
  - **s01b** pose l'adaptateur `local` et la route de lecture ; s12a ne les réimplémente pas, elle change le défaut de `STORAGE_TYPE` et retire l'autre implémentation ;
  - **s12b** déploie ; s12a ne déploie rien et sa note le dit. Le seul recouvrement de surface est `.github/workflows/ci.yml`, sur deux objets différents ;
  - **s04 / s31** posent leurs propres flux de fichiers sur l'adaptateur `local` ; la note de s12a leur interdit explicitement d'être anticipés.

## Constats

### Majeur

**M1 : s12a est absente du récapitulatif « ordre et dépendances », qui reste la seule vue d'ensemble du découpage.**

- Le tableau de fin de document comptait 49 lignes, de s01 à s42, **sans ligne s12a**. La story n'existait donc que dans le corps du document.
- Conséquence directe : la ligne de s12b **contredisait l'en-tête de s12b**, qui liste `s01, s01b, s03, s03c, s08, s12a`. La revue précédente avait explicitement validé « en-têtes et récapitulatif concordent ».
- Le risque n'est pas théorique : c'est ce tableau qu'on lit pour ordonner le travail. Une story invisible là est une story qu'on saute — et la sauter fait échouer la première mise en ligne sur un défaut de démarrage (`SUPABASE_ANON_KEY` exigée par `src/env-schemas.ts`), exactement ce que s12a existe pour éviter.
- **Corrigé le 2026-09-20** : ligne `s12a | retrait-supabase | 2 | s01b | B` ajoutée entre s12 et s12b, et dépendances de s12b complétées dans le tableau.

### Mineurs

**m1 : s12a c2 était un critère à deux branches, dont le choix était renvoyé au plan.** — _corrigé le 2026-09-20_

- Le critère dit : l'envoi d'image des formulaires hérités écrit sur le disque, « à défaut d'usage dans ASL-CMS, le formulaire concerné est retiré ». Deux comportements opposés, et on ne peut écrire le test qu'après avoir tranché.
- C'est contraire à la discipline que le document s'impose ailleurs : s07 refuse de laisser « choisir en silence à l'implémentation », s02 range les propriétés non observables en « à vérifier en review, pas en test ».
- Atténuation qui le maintient en mineur : l'invariant porteur (« aucun envoi vers Supabase ne subsiste ») est déjà prouvé par c3 et c4, et la validation humaine de `/ks-plan` verra la suppression avant tout code.
- **Arbitrage rendu le 2026-09-20 : les deux écrans hérités sont retirés.** Le logo d'organisation fait doublon avec l'identité d'association de s01b ; l'avatar n'apparaît dans aucune story. c2 est réécrit sur cette seule branche et redevient testable.

**m2 : s12b c7 était devenu un constat historique, plus un critère.** — _corrigé le 2026-09-20_

- Le critère racontait le retrait des deux workflows : rien à cocher à la livraison, il ne pouvait plus échouer. Il reprenait de surcroît une propriété du diff que les notes de s12b rangent déjà sous « À vérifier en review, pas en test ».
- Critère supprimé (les deux fichiers n'existent plus, PR 17) ; la phrase de contexte vit désormais dans les notes agentiques de s12b.

**m3 : s12a ne portait aucun critère sur les documents et règles qui décrivent encore les flux Supabase.** — _corrigé le 2026-09-20_

- `.claude/rules/01-presentation/rule-upload-file.md` annonce que les flux Supabase hérités vivent « jusqu'à leur story (s04, s31) ». s12a change ce fait et la règle devient fausse le jour de sa livraison.
- Les notes de **s16** désignent `src/components/features/user/edit-user-profile.tsx` comme référence pour l'écran de coordonnées. Si la branche « retrait » de c2 est retenue, cette référence pointe vers un fichier absent, quinze stories plus loin.
- Le précédent existe dans le même document : s01 porte un critère dédié sur les règles qui renvoyaient à `projects`.
- Critère ajouté, sur le modèle de celui de s01 : la règle d'upload et ses copies `.cursor` ne citent plus que l'adaptateur `local`, les notes de s16 ne renvoient plus à l'écran supprimé, et `pnpm check:rules` passe.

**m4 : compteurs et historique de fin de document périmés.** — _corrigé le 2026-09-20_

- « 49 stories » → 50, dont vingt à 2 ; « Trois stories hors du tableau de périmètre » → quatre, l'énumération complétée ; l'historique consigne désormais l'ajout de s12a et le retrait des deux workflows.

**m5 : l'id `s12a` est le quatrième sur le préfixe `s12`, sans lien de dépendance avec s12.** — _corrigé le 2026-09-20_

- Sa seule dépendance est s01b. Conséquence pratique annoncée par `AGENTS.md` : `/ks-plan s12` refuse d'arbitrer entre quatre stories et s'arrête en listant.
- Rien à renuméroter — le résolveur ne se trompe jamais, il abandonne. Mention de dérogation ajoutée à l'en-tête, comme s04b.

**m6 : s12a plaçait un paragraphe de prose sous la rubrique `### Dependencies`.** — _corrigé le 2026-09-20_

- C'est la rubrique que lisent les commandes qui dérivent l'état du pipeline. Le paragraphe « À livrer avant s12b » a été déplacé en tête des notes agentiques, sans changer un mot.

**m7, pour mémoire : s12a est la quatrième story hors du tableau de périmètre.** — _sans objet_

- Dérogation déclarée, bornée et motivée. Rien à corriger sur le fond ; seul le compteur l'était (m4).

## Verdict

Aucun problème critique :

- toutes les lignes du périmètre sont couvertes, et l'insertion de s12a n'en découvre aucune ;
- aucune story ne reprend un élément du cimetière ;
- aucune story n'est à 5 ;
- aucun cycle, aucune dépendance vers une story postérieure — la chaîne s01b → s12a → s12b → s12c → s13 est exécutable.

Le seul majeur, M1, était invisible pour qui lit le tableau d'ordonnancement. Il est corrigé, ainsi que les six mineurs : l'arbitrage que m1 réclamait a été rendu le jour même (les deux écrans hérités partent), ce qui a permis de réécrire c2 sur une seule branche et d'ajouter le critère de m3 sur les règles et la documentation. Le découpage est prêt pour `/ks-research s12a`.

Max severity: major
Stories ready: yes
