# Revue du découpage : ASL-CMS (Lp)

> Relecture à contexte neuf de `docs/stories.md` (56 stories) face à `docs/prd.md`, avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> Les stories s01 à s12a et s43 sont livrées (revue présente dans `docs/reviews/`). Ni leur taille ni leur contenu ne sont rediscutés.
> Passe précédente : verdict `major` / `yes`, un majeur M1 et six mineurs m1 à m6 (plus m7 pour mémoire), tous annoncés corrigés le 2026-09-20. Leur fermeture est vérifiée ci-dessous.
> L'effort porte surtout sur **s44-page-accueil**, **s45-retrait-pages-publiques-heritees** et **s46-comptes-herites-minimum** (insérées le 2026-10-07), et sur ce que leur insertion déplace. Le passage complet est quand même fait.

**En bref : aucun critique, un majeur, neuf mineurs. Les constats de la passe précédente sont fermés, sauf les compteurs (m4), qui ont de nouveau dérivé.**

- Toutes les lignes du périmètre restent couvertes. s44 n'est pas une dérogation : elle comble un manque latent de la ligne « CMS de pages génériques ». L'accueil figure dans le « Why kill it » n°2 et au V5 §3.1, mais rien ne branchait `/` sur un contenu de l'association.
- s45 et s46 ne sont **pas** des couches techniques déguisées. Chacune déclare un utilisateur, a un comportement observable (des 404, des liens absents, une destination après connexion, une inscription refusée) et peut être livrée seule. Leur justification ne s'appuie cependant que sur des dates d'arbitrage, alors que le PRD offre de vrais points d'appui (m9).
- Le majeur est un **conflit entre s46 et s12d**. s46 fait répondre `/dashboard` en 404 et envoie le membre propriétaire sur `/account`. s12d, non livrée, construit « Mes parcelles » dans l'espace membre, que son design et sa recherche placent sur `/dashboard`. Aucune story ne dit où vit l'espace membre après s46, ni qui y redirige le membre à la connexion.

## Suivi de la revue précédente

| Constat                                | État           | Preuve                                                                                                                                                                                                      |
| -------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 : s12a absente du récapitulatif     | **Fermé**      | Ligne `s12a \| retrait-supabase \| 2 \| s01b \| B` présente ; la ligne de s12b contient `s12a`. **Le même défaut réapparaît pour s08b** (m1).                                                               |
| m1 : s12a c2 à deux branches           | **Fermé**      | s12a c2 : les deux écrans hérités « sont **retirés** avec leurs actions et leurs tests ».                                                                                                                  |
| m2 : s12b c7 devenu un constat historique | **Fermé**   | s12b a six critères, tous vérifiables à la livraison ; le retrait des workflows vit dans le « Piège n°4 ».                                                                                                |
| m3 : règles et notes citant les flux Supabase | **Fermé** | s12a c7 (règle d'upload, copies `.cursor`, notes de s16, `pnpm check:rules`). Les notes de s16 citent désormais `edit-user-settings.tsx`, que **s46 va retirer** (m5).                                    |
| m4 : compteurs et historique périmés   | **Rouvert**    | « 55 stories » alors que le document en compte 56. La répartition par score est fausse. L'historique ne consigne ni s08b, ni s12d, ni s43, ni s44 (m1).                                                   |
| m5 : id `s12a` sur le préfixe `s12`    | **Fermé**      | Mention de dérogation en tête de s12a.                                                                                                                                                                     |
| m6 : prose sous `### Dependencies` de s12a | **Fermé**  | La rubrique contient seulement `s01b`. Les rubriques de s44, s45 et s46 sont aussi de simples listes.                                                                                                    |
| m7 : s12a hors du tableau de périmètre | **Sans objet** | On compte désormais **sept** dérogations (s12a, s12b, s12c, s39, s43, s45, s46), toutes déclarées en en-tête, et le récapitulatif les énumère toutes les sept. s44 n'est pas une dérogation, à juste titre. |

## Couverture du périmètre

| Ligne du PRD (core loop)                      | Couverte par                       | OK  |
| --------------------------------------------- | ---------------------------------- | --- |
| CMS de pages génériques                       | s04 (+ s44 pour l'accueil)         | ✅  |
| Attribution des rôles aux membres             | s14                                | ✅  |
| Permissions par rôle configurables            | s37 (registre posé par s03b)       | ✅  |
| Connexion par lien magique + suivi d'adoption | s03, s03c, s15, s42 (c3)           | ✅  |
| Pages publiques + formulaire de contact       | s04, s08                           | ✅  |
| Navigation du site public                     | s04b                               | ✅  |
| Identité visuelle                             | s01b (logo, favicon), s02 (teinte) | ✅  |
| Limitation de débit des formulaires publics   | s08b, réemployée par s10           | ✅  |
| Actualités                                    | s05                                | ✅  |
| Présentation du bureau                        | s06                                | ✅  |
| Désinscription et classification              | s27b                               | ✅  |
| Bandeau d'alerte                              | s07                                | ✅  |
| SEO                                           | s11                                | ✅  |
| Import initial des membres                    | s13                                | ✅  |
| Modèle membre ↔ parcelle daté                 | s12                                | ✅  |
| Coordonnées                                   | s16                                | ✅  |
| Questions au bureau                           | s23                                | ✅  |
| Notes internes et historique                  | s24                                | ✅  |
| Import annuel des relevés d'eau               | s17                                | ✅  |
| Historique de consommation                    | s18                                | ✅  |
| Signalements                                  | s10 (public), s22 (membre)         | ✅  |
| Analyses d'eau                                | s09                                | ✅  |
| Documents partagés                            | s31                                | ✅  |
| Documents nominatifs séparés                  | s32                                | ✅  |
| Campagnes email Brevo                         | s25                                | ✅  |
| Envoi échelonné au-delà de 300                | s26                                | ✅  |
| Relances d'impayés                            | s29                                | ✅  |
| Publipostage PDF                              | s28                                | ✅  |
| Groupes de destinataires                      | s27                                | ✅  |
| Statistiques de campagnes                     | s30                                | ✅  |
| Modèles de documents                          | s36                                | ✅  |
| Facturation membres (interface + Pennylane)   | s19, s20                           | ✅  |
| Redirection de paiement                       | s21                                | ✅  |
| Multi-tenant                                  | s01                                | ✅  |
| Export individuel d'un membre                 | s40                                | ✅  |
| Simulation de rôle SuperAdmin                 | s41                                | ✅  |
| Export et portabilité                         | s38 (+ s39)                        | ✅  |
| Module Vote                                   | s33                                | ✅  |
| Module Voirie                                 | s34                                | ✅  |
| Module Petites annonces                       | s35                                | ✅  |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story : 37 lignes du tronc commun et 3 modules. **Les trois insertions ne retirent aucune couverture.** s45 et s46 retirent des écrans hérités dont aucune ligne du périmètre n'a besoin. En particulier, s46 garde le lien magique, la double authentification et les sessions, et l'invitation de s15 n'est pas l'invitation d'organisation de Better Auth (note de s46, vérifiée).
- Note de couverture, en faveur de s44 : le « Why kill it » n°2 nomme l'« accueil » parmi les contenus de la vitrine, et les notes de s04 rangent l'accueil parmi les pages « du **contenu** ». Mais aucune story ne faisait servir ce contenu à la racine. Le critère de succès « le bureau crée, modifie et publie une page » était tenu, alors que la première visite tombait sur la vitrine du boilerplate. s44 a raison de ne pas se déclarer hors périmètre.

## Périmètre

- [x] Aucune story ne reprend un élément du cimetière. La connexion Google conservée par s46 n'est pas le « plan B de connexion pour les membres sans email » : elle suppose une adresse. Elle reste toutefois hors du tableau (m6).
- [x] Aucune story ne dépasse le périmètre, à **sept** dérogations déclarées près : s12a, s12b, s12c, s39, s43, s45, s46. Les deux dernières sont bornées (« suppression du code », aucune migration, voie de retour par `git revert` ou `upstream/main`, comme l'ADR 009).

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, aux dérogations déclarées près.
  - **s44** : un utilisateur (le bureau), une valeur visible par le visiteur, livrable seule ; toutes ses dépendances sont livrées.
  - **s45** : utilisateur déclaré (le visiteur d'une association), comportement observable (404, aucun lien mort, sitemap propre). Ce n'est pas une couche, c'est le retrait d'un contenu étranger servi au public.
  - **s46** : utilisateur déclaré (le bureau), comportement observable (écrans réduits, destination par rôle, inscription refusée). C'est aussi la story qui **ferme l'inscription libre**, et c'est sa valeur la plus forte, mais son « afin de » ne la nomme pas (m8).
- [ ] Chaque critère peut devenir un test : **presque**. s44 c2 contient une branche impossible à exercer et un élément contesté par l'ADR 012 (m3). Une clause de s45 c1 devient sans objet après s45 c7 (m4). s46 c2 laisse trois cas limites ouverts (m7).
- [x] Notes agentiques présentes et utiles. Celles de s45 et s46 sont d'un bon niveau : voie de retour, absence de migration, pièges de configuration (`EnabledPageSchema`, `PriceRecap`, destination fixée avant l'identification). Il manque le report vers d'autres stories (m5, m6) et la relation avec s12d (M1).
- [ ] Complexité notée partout, **aucune story à 5**, et les huit stories à 4 explicitent leur risque. Le 3 de s44 et celui de s45 sont cohérents. **Le 3 de s46 est sous-estimé et son risque n'est pas écrit** (m8).

## La liste dans son ensemble

- [x] Pas de cycle. Arêtes nouvelles vérifiées :
  - s44 → s02, s04, s04b, s05, s07, s11 (toutes livrées) ;
  - s45 → s43 (livrée), s44 ;
  - s46 → s03, s03b, s43 (livrées), s45 ;
  - s12b → s44, s45, s46.

  La chaîne s44 → s45 → s46 → s12b → s12c → s13 est exécutable, et l'en-tête de s12b concorde avec le récapitulatif sur ces trois ajouts.

- [ ] Ordre lisible de haut en bas : **non**. s44, s45 et s46 sont numérotées après s42 mais s'exécutent avant s12b, et la section « Ordre des stories » affirme encore que l'ordre des ids suit les dépendances, la GED étant le « seul écart » (m2). La dépendance est déclarée, donc personne ne suppose en silence un travail planifié plus tard : c'est un défaut de document, pas un ordre impossible.
- [ ] Ids bien formés et uniques : oui pour la forme. **Non pour la concordance avec le récapitulatif** : s08b n'y figure pas, et les lignes de s10 et s12b y citent `s08` là où leurs en-têtes citent `s08b` (m1).
- [ ] Aucun chevauchement : **un conflit** (M1). Les autres soupçons examinés sont levés :
  - **s44 / s04, s04b, s11** : s44 réemploie le rendu de `/<slug>` et étend le sitemap. Elle ne redéfinit ni la page, ni le menu, ni le SEO. Sa note borne le nettoyage aux clés `HomePage.*` et renvoie le reste à s45.
  - **s44 / s45** : frontière nette. s44 retire la vitrine de `/`, s45 retire `/pricing`, `/checkout` et le reste, et dépend de s44 pour que son critère « aucun lien vers une adresse retirée » soit tenable.
  - **s45 / s46** : s45 retire `/checkout/…` (parcours d'achat public, qui crée aussi des comptes), s46 retire `/account/billing/…` et ferme l'inscription. Les deux restent compatibles avec l'abonnement plateforme piloté depuis `/admin` (s45 c6).
  - **s45 / s05** : les tables `posts…` restent (ADR 023), et aucune migration n'est prévue. Le plan de s45 devra vérifier qu'aucun composant de blog retiré ne sert les actualités livrées, comme sa note le prévoit pour le rendu MDX.
  - **s46 / s03, s03c** : s46 c4 est une garde de non-régression sur une fermeture livrée par s03, et le dit (m7).

## Constats

### Majeur

**M1 : s46 et s12d se contredisent sur l'espace membre, et personne ne rattache le membre à son espace après la connexion.**

- s46 c1 fait répondre `/dashboard` en 404. s46 c2 envoie « tout autre utilisateur », donc le membre propriétaire, sur `/account`, et précise que « plus aucun parcours ne renvoie vers `/dashboard` ».
- s12d n'est pas livrée et ne dépend pas de s46. Ses notes renvoient au design `docs/designs/s12-membres-parcelles.md`, écran 6, qui place « Mes parcelles » sur **`/dashboard`** (l. 41 et 102 du design). La recherche de s12d (`docs/research/s12d-comptes-membres.md`, l. 106-109 et 165) confirme : « C'est là qu'arrive un membre ».
- Les deux ordres d'exécution cassent quelque chose :
  - **s12d avant s46** (possible, toutes ses dépendances sont livrées) : s46 supprime l'écran que s12d vient de livrer, et s12d c4 (« un membre ne voit que ses propres parcelles… dans son espace ») cesse d'être tenu.
  - **s46 avant s12d** (l'ordre voulu, puisque s46 précède s12b) : s12d est planifiée sur un design qui vise une adresse en 404.
- La note de s46 a vu le risque (« vérifier qu'aucun autre parcours du bloc B (s12d, s15, s42) ne cite un écran retiré ») mais ne le tranche pas. Aucune story du bloc B ne reprend la **destination après connexion du membre propriétaire**, que s46 centralise dans une seule fonction. Le membre arriverait donc sur une page de sécurité à chaque connexion, y compris après s16, s18, s19 et s32. Le PRD décrit ce public comme âgé et venant « pour une raison précise ».
- Effet secondaire : s46 c3 dit « un compte ne naît que du back-office (s12d) ou du seed ». Il cite une story qui n'est pas une dépendance, et il oublie le provisioning de s01, qui crée l'administrateur initial depuis `/admin`. La recherche de s12d a retenu une création directe (`createUserDao`), compatible avec `disableSignUp`. Les notes de s12d ne le disent pas.
- À trancher dans le document, avant `/ks-plan s46` et `/ks-plan s12d` :
  1. l'adresse de l'espace membre après s46 ;
  2. la story qui fait pointer la destination « membre » vers lui (s12d est le candidat naturel : elle livre la première section de l'espace membre) ;
  3. la dépendance correspondante, s12d → s46 ou l'inverse, avec la référence de design mise à jour.

### Mineurs

**m1 : le récapitulatif a de nouveau dérivé, cette fois pour s08b.**

- s08b, scindée de s08 le 24/09 et livrée, **n'a pas de ligne** dans le tableau « ordre et dépendances ».
- Les lignes de s10 et de s12b citent `s08`, alors que leurs en-têtes citent `s08b`. Pour s12b, c'est pourtant la dépendance qui porte son critère 6 (purge quotidienne des empreintes).
- « 55 stories » : le document en compte 56. D'après le tableau lui-même, la répartition réelle est de **quatre à 1** (avec s08b), **vingt à 2**, **vingt-quatre à 3** et huit à 4, et non « trois / vingt et une / vingt-trois / huit ».
- L'historique de fin de document consigne s01b, s03b/s03c et s12a, mais ni s08b, ni s12d, ni s43, ni s44. s45 et s46 n'apparaissent que dans le compteur des dérogations.
- C'est la même classe de défaut que M1 de la passe précédente. Le constat reste mineur parce que la story absente est livrée : personne ne peut la sauter.

**m2 : la section « Ordre des stories » n'est plus vraie.**

- Elle affirme que « l'ordre des ids suit les dépendances techniques » et que le « seul écart à ce jour » est la GED avant le vote.
- Or s44, s45 et s46 (et s43 avant elles) portent des numéros postérieurs à s42 tout en précédant s12b. Le tableau récapitulatif, trié par id, n'est plus exécutable de haut en bas : la ligne de s12b précède de trente-cinq lignes ses trois dernières dépendances.
- `AGENTS.md` autorise ce choix (ajouter en fin de numérotation de préférence). Le document doit seulement le dire : une phrase dans « Ordre des stories », et une mention « à exécuter avant s12b » dans le récapitulatif ou dans les en-têtes de s44, s45 et s46. Les notes de s12b sont d'ailleurs muettes sur la raison de ces trois dépendances.

**m3 : s44 c2 n'a pas été repris après la recherche, contrairement à s45 et s46.**

- « Sélecteur de thème » figure parmi les éléments interdits de la vitrine. Mais l'ADR 012 garde ce sélecteur sur tout le site public, et la recherche le signale (piège 2, question 3) : placer l'accueil sous `(public)`, comme l'exige c1, le fait revenir. Le critère et l'ADR ne peuvent pas être tenus tous les deux sans arbitrage. Comme s07 le dit ailleurs, il ne faut pas « choisir en silence à l'implémentation ».
- « Ou supprimée » : le produit ne permet pas de supprimer une page (piège 6 de la recherche, critères de s04). Cette branche ne peut pas devenir un test aujourd'hui. La retirer, ou la rattacher explicitement à une référence pendante.

**m4 : s45 c1, la clause « y compris quand la configuration active encore ces familles de pages » est morte.**

- Après c7, `blog` et `docs` ne figurent plus dans `EnabledPageSchema`, qui refuse toute valeur inconnue au démarrage (la note de s45 le dit). La configuration ne peut donc plus les activer.
- `/pricing`, `/checkout`, `/privacy` et `/terms` n'ont aucune famille dans cet enum.
- La clause ne peut être exercée par aucun test. La supprimer ou la reformuler (par exemple « quelle que soit la valeur de `NEXT_PUBLIC_ENABLED_PAGES` »).

**m5 : ni s45 ni s46 ne porte de critère sur les règles et notes qui citent les fichiers qu'elles retirent.**

- **s46** retire `/account/settings`, donc vraisemblablement `edit-user-settings.tsx`. Or `.claude/rules/01-presentation/rule-form-front.md` le désigne comme « Exemple vivant du même patron », et les notes de **s16** le citent comme référence de l'écran de coordonnées. La correction de m3 de la passe précédente se défait ainsi une seconde fois.
- **s45** retire `checkout/[priceId]`, `checkout/better-auth` et `docs/[...slug]`. Or `rule-react-cache-next-cache.md` en fait trois des « quatre routes bloquantes assumées » et illustre le cache par `getAllBlogCategoriesDal` et `blog-article.tsx`. `rule-mdx-rendering.md` décrit le rendu du blog et des docs. La recherche de s45 le relève (piège 9), mais la story ne le reprend pas.
- Le précédent existe deux fois dans le document : s01 c10 et s12a c7. Ajouter le même critère : règles et copies `.cursor` à jour, notes de s16 rebranchées, `pnpm check:rules` vert.

**m6 : s46, la connexion Google est conservée sans ligne de périmètre, et son report vers s12b n'a pas été fait.**

- La ligne du PRD est « Connexion par lien magique ». Google est un reste du boilerplate que l'arbitrage du 7 octobre garde : c'est légitime, et l'en-tête le déclare.
- La note dit en revanche « à vérifier au plan et à reporter dans s12b » pour l'autorisation du retour OAuth sur **chaque domaine d'association**. s12b n'en dit rien, ni dans ses critères ni dans ses notes. s46 c5 peut passer en test puis échouer sur le premier domaine déployé.
- s46 c5 n'exige pas la parité avec la règle de s03 : un lien magique ne part pas pour un compte qui n'appartient pas à l'association du domaine appelé. Écrit tel quel, un compte d'une association A se connecte par Google sur le domaine de l'association B. Ajouter la condition, ou dire explicitement pourquoi elle ne s'applique pas.

**m7 : s46 c1 et c2, trois cas limites relevés par la recherche restent ouverts.**

- Le SuperAdmin passe le contrôle « bureau » de toute association (`canManageAssociation`). Le critère ne dit pas laquelle des deux règles l'emporte (question 3 de la recherche).
- Le rôle global `admin` du boilerplate accède à `/admin` mais tombe, selon c2, dans « tout autre utilisateur → `/account` » (question 4).
- `/dashboard` sans session : 404 selon c1, mais redirection vers `/login` tant que le segment reste dans `AUTHENTICATED_SEGMENTS`, liste que partage aussi `robots.txt` (question 6).
- Pour mémoire, c4 est une garde de non-régression sur une fermeture livrée par s03. Elle le dit, ce qui suffit. Si le test de s03 existe déjà, ce critère ne coûte rien.

**m8 : s46 porte trois valeurs sous un 3 sans risque écrit.**

- La story empile :
  1. la réduction des écrans de compte (huit familles d'adresses) ;
  2. la fermeture de l'inscription sur trois canaux, avec le maintien de Google sans inscription et le rattachement des comptes ;
  3. une destination par rôle, résolue **après** l'ouverture de la session pour le lien magique et OAuth, ce qui suppose une route de passage nouvelle.
- S'y ajoute un critère sans lien avec ces trois valeurs (c7, `DEFAULT_LOCALE` de `date-helper.ts`, reste de s43).
- La recherche liste neuf questions ouvertes et une dizaine de specs e2e touchées.
- Son « afin de » ne parle que de ne pas se perdre dans les écrans. La fermeture de l'inscription, qui est la valeur la plus importante (un inconnu ne doit pas pouvoir créer de compte sur le domaine d'une association), n'y apparaît pas.
- Soit passer à 4 en écrivant le risque (la route de passage et la fermeture des trois canaux), soit sortir Google et la destination par rôle dans une story voisine, au seuil que s03 s'était fixé le 19 septembre.

**m9 : s45 et s46 se justifient par une date d'arbitrage, pas par le PRD, qui offre pourtant de meilleurs appuis.**

- Pour **s45** :
  - le « Why kill it » n°2 (« une vitrine publique éditable et référencée ») ;
  - la ligne Identité visuelle (« la promesse "son site à elle" tombe à la première visite ») ;
  - le Kill mode : la facturation plateforme « ne doit jamais être confondue » avec celle des membres, or une page de tarifs Zourite servie sur le domaine d'une association fait exactement cette confusion ;
  - la ligne SEO : un sitemap qui indexe un blog étranger.
- Pour **s46** :
  - les Target users et la ligne d'import (un compte n'existe que pour un membre doté d'une adresse) ;
  - le premier critère de succès (« rien qui appartienne à un autre membre »), que l'inscription libre affaiblit.
- La passe précédente avait fait la même remarque pour s12a, et l'en-tête de s12a a été corrigé dans ce sens.
- Accessoirement, s45 retire `/privacy` et `/terms` en confiant les mentions légales au bureau (pages du CMS). Aucune story de lancement (s12b, s42) ne vérifie qu'elles existent avant l'ouverture au public. Ce n'est pas un défaut du découpage, mais c'est un point de recette à garder en tête.

## Verdict

Aucun problème critique :

- toutes les lignes du périmètre sont couvertes, et s44 comble même un manque latent sur l'accueil ;
- aucune story ne reprend un élément du cimetière ;
- aucune story n'est à 5 ;
- aucun cycle. La chaîne s44 → s45 → s46 → s12b → s12c → s13 est exécutable. Le fait qu'elle ne suive pas l'ordre des ids est un défaut de documentation (m2), pas un ordre impossible.

Le majeur M1 doit être tranché avant `/ks-plan s46` et `/ks-plan s12d` : où vit l'espace membre, et qui y envoie le membre à la connexion. s44 et s45 ne sont pas concernées et peuvent suivre leur cycle. Les mineurs m3 et m4 sont à corriger avant le plan de leur story. Pour m1 et m2 (récapitulatif et section d'ordre), c'est une édition de quelques lignes.

Max severity: major
Stories ready: yes
