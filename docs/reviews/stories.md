# Revue du découpage : ASL-CMS (Lp)

> Relecture à contexte neuf de `docs/stories.md` (58 stories) face à `docs/prd.md`, avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> Les stories s01 à s12a, s43, s44 et s45 sont livrées. Leur taille et leur contenu ne sont pas rediscutés. Les documents hérités du boilerplate (`docs/research/s000-*`, `s001-*`) ne sont pas des stories du projet.
> Passe précédente (2026-10-07) : verdict `minor` / `yes`, sept mineurs (m1 à m7). Depuis, le 2026-10-13, s46 a été scindée en s46 (retraits et espace membre vide, 3) et s46b-connexion-limitee-association (4). Les dépendances de s12b, s12d et s47 ont suivi, ainsi que le récapitulatif.
> Cette passe porte surtout sur la scission s46 / s46b, sur la cohérence des dépendances qu'elle touche et sur la fermeture des sept mineurs. Tout le tableau de couverture a quand même été repris ligne par ligne.

**En bref : aucun critique, un majeur, quatre mineurs.**

- Les sept mineurs de la passe précédente sont fermés. Deux laissent un petit reste, repris en m3 et m4.
- La scission est propre :
  - s46 et s46b ne se chevauchent pas ;
  - l'état intermédiaire entre les deux est écrit (destination encore `/dashboard` pour tous, `/register` gardé jusqu'à s46b) ;
  - le graphe ne contient aucun cycle et colle au paragraphe « Exception de numérotation ».
- **Le majeur porte sur Google dans s46b (M1).** Le critère c5 dit que la connexion Google « reste proposée ». La recherche de s46 a montré que c'est faux : aucun écran ne propose Google en dehors de `/register`, que s46b ferme. Ce critère cache donc trois choses :
  - une décision de produit à reprendre (ajouter un bouton, ou retirer Google) ;
  - un écran à concevoir ;
  - un mécanisme multi-domaine que personne n'a tranché.

  Le risque écrit pour la note 4 de s46b n'en parle pas.

## Suivi de la revue précédente

| Constat | État | Preuve |
| --- | --- | --- |
| m1 : récapitulatif sans ligne s08b, `s08` au lieu de `s08b` | **Fermé** | Ligne s08b présente (l. 3473). s10 et s12b citent `s08b` (l. 3475, 3479). s12b c6 et sa note « Le cron système » citent s08b (l. 1224, 1285). L'historique consigne s08b, s12d et s43 à s47 (l. 3594-3601). Il reste une phrase périmée, voir m4. |
| m2 : clause morte de s45 c1 | **Fermé** | Reformulé en « quelle que soit la valeur de `NEXT_PUBLIC_ENABLED_PAGES` » (l. 3191). s45 est livrée. |
| m3 : s47 c3 sans niveau de test, ordre des migrations | **Fermé, avec un reste** | c3 dit maintenant « vérifié dans la CI sur le Postgres éphémère : base du seed de `main`, migrations de la branche appliquées » (l. 3408). La note fixe l'ordre `--custom` → `roleEnum` → `pnpm db:generate` (l. 3425-3433). Le reste, le « précédent de s12c », est repris en m3. |
| m4 : rôles conservés non fixés, « afin que » inexact | **Fermé** | c2 fixe `user` et `super_admin` et refuse `public` (l. 3407). La propriété du diff est rangée « à vérifier en review » (l. 3445-3447). L'« afin que » est corrigé (l. 3397-3398). |
| m5 : ordre annoncé plus large que le graphe, s47 → s46 non motivée | **Fermé** | « s44 à s46b avant s12b et avant s12d, s47 avant s12b » (l. 27), ce qui correspond exactement aux en-têtes et au récapitulatif. La note « Pourquoi après s46b » est ajoutée (l. 3448-3450). |
| m6 : mode clair non annoncé, règle « Socle habillé » contraire | **Fermé** | L'« afin de » de s45 mentionne le clair (l. 3183). La règle transverse est mise à jour : « clair seul, forcé par s45 ; classes `dark:` inertes » (l. 41-43). |
| m7 : s46 à la limite haute de son 4 | **Fermé par la scission** | s46 passe à 3 avec six critères, sans changement d'authentification. s46b porte les trois changements d'authentification. Mais s46b a hérité de Google, qui ajoute un quatrième risque non écrit (M1). |

## Couverture du périmètre

| Ligne du PRD (core loop) | Couverte par | OK |
| --- | --- | --- |
| CMS de pages génériques | s04 (+ s44 pour l'accueil) | ✅ |
| Attribution des rôles aux membres | s14 | ✅ |
| Permissions par rôle configurables | s37 (registre posé par s03b) | ✅ |
| Connexion par lien magique + suivi d'adoption | s03, s03c, s42 (absorbe s15 depuis le 23/10/2026) | ✅ |
| Pages publiques + formulaire de contact | s04, s08 | ✅ |
| Navigation du site public | s04b | ✅ |
| Identité visuelle | s01b (logo, favicon), s02 (teinte) | ✅ |
| Limitation de débit des formulaires publics | s08b, réemployée par s10 | ✅ |
| Actualités | s05 | ✅ |
| Présentation du bureau | s06 | ✅ |
| Désinscription et classification | s27b | ✅ |
| Bandeau d'alerte | s07 | ✅ |
| SEO | s11 | ✅ |
| Import initial des membres | s13 (comptes : s12d) | ✅ |
| Modèle membre ↔ parcelle daté | s12 | ✅ |
| Coordonnées | s16 | ✅ |
| Questions au bureau | s23 | ✅ |
| Notes internes et historique | s24 | ✅ |
| Import annuel des relevés d'eau | s17 | ✅ |
| Historique de consommation | s18 | ✅ |
| Signalements | s10 (public), s22 (membre) | ✅ |
| Analyses d'eau | s09 | ✅ |
| Documents partagés | s31 | ✅ |
| Documents nominatifs séparés | s32 | ✅ |
| Campagnes email Brevo | s25 | ✅ |
| Envoi échelonné au-delà de 300 | s26 | ✅ |
| Relances d'impayés | s29 | ✅ |
| Publipostage PDF | s28 | ✅ |
| Groupes de destinataires | s27 | ✅ |
| Statistiques de campagnes | s30 | ✅ |
| Modèles de documents | s36 | ✅ |
| Facturation membres (interface + Pennylane) | s19, s20 | ✅ |
| Redirection de paiement | s21 | ✅ |
| Multi-tenant | s01 | ✅ |
| Export individuel d'un membre | s40 | ✅ |
| Simulation de rôle SuperAdmin | s41 (+ s48, connexion à la place d'un compte, ajoutée hors revue le 28/10/2026) | ✅ |
| Export et portabilité | s38 (+ s39) | ✅ |
| Module Vote | s33 | ✅ |
| Module Voirie | s34 | ✅ |
| Module Petites annonces | s35 | ✅ |

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story : les 37 lignes du tronc commun et les 3 modules, recomptées dans le PRD (l. 62-98 et 104-106).
- La scission ne retire aucune couverture :
  - s46b ferme l'inscription libre sur le lien magique (c3, c4). Elle renforce la règle « un lien ne crée jamais de compte » de s03 sans la retirer.
  - Les comptes des membres viennent de s12d, qui crée le compte directement (`createUserDao`) et ne dépend donc pas de l'inscription publique (l. 1444-1446).
  - s42 dépend de s12d (s15, qui en dépendait aussi, y est fondue depuis le 23/10/2026).

## Périmètre

- [x] Aucune story ne reprend un élément du cimetière. La connexion Google gardée par s46b suppose une adresse email : ce n'est pas le « plan B de connexion pour les membres sans email ».
- [x] Aucune story ne sort du périmètre en dehors des **neuf** dérogations déclarées : s12a, s12b, s12c, s39, s43, s45, s46, s46b et s47. Chacune est déclarée dans son en-tête, et le récapitulatif les énumère toutes les neuf (l. 3521-3531). Réserve : avec un bouton Google à ajouter, s46b n'est plus « conservation », c'est un **ajout** (M1).

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, dérogations déclarées comprises.
  - **s46** : la valeur est observable (un compte réduit à la sécurité, `/dashboard` vidé, le lien SuperAdmin vers `/bureau`) et la story est livrable seule. L'état intermédiaire avant s46b est écrit (l. 3291-3293).
  - **s46b** : ce n'est pas une couche technique. Elle a un utilisateur (le bureau) et des comportements observables : destination par rôle, refus de connexion croisée, inscription fermée. Elle regroupe la destination (expérience) et la fermeture (sécurité), mais les deux passent par le même point, une route de passage après l'ouverture de la session. Le regroupement est défendable.
- [ ] Chaque critère peut devenir un test : **presque**.
  - s46b c5 : voir M1.
  - s46b c2 exige un test d'accès croisé « pour chaque mode », alors que le seed n'a ni compte à double authentification ni simulacre OAuth. Le niveau de test n'est pas fixé (m1).
  - s46b c3 affirme une liste fermée des origines possibles d'un compte, et cette liste est incomplète (m2).
- [x] Notes agentiques présentes et utiles. Celles de s46b sont précises : lignes de `action.ts`, trou de `loginCredentialAction`, hook `session.create.before`, `disableSignUp` sur trois canaux, reprise de la recherche de s46. Celles de s47 sont complétées (ordre des migrations, raison de la dépendance).
- [ ] Complexité notée partout, **aucune story à 5**, et les neuf stories à 4 écrivent leur risque. **Sauf** que le risque de s46b annonce « trois changements de l'authentification » et ne compte pas Google, qui en est un quatrième, multi-domaine et non tranché (M1).
  - Le 3 de s46 se défend : retraits mécaniques, aucune migration, aucun changement d'authentification.

## La liste dans son ensemble

- [x] Pas de cycle. Arêtes nouvelles ou modifiées, vérifiées en-tête par en-tête puis dans le récapitulatif :
  - s46 → s03, s03b, s43, s45 ;
  - s46b → s03, s03b, s03c, s46 ;
  - s47 → s03b, s46b ;
  - s12b → … s46, s46b, s47 ;
  - s12d → s03, s03c, s12, s46, s46b.

  La chaîne s44 → s45 → s46 → s46b → s47 → s12b → s12c → s13 est exécutable, et s46b → s12d → s13 aussi.
- [x] Ordre lisible de haut en bas : le paragraphe « Exception de numérotation » et le graphe disent la même chose. Une seule référence en avant, de forme, dans une note de s47 (m3).
- [x] Ids bien formés et uniques. `s46b-connexion-limitee-association` est conforme et l'id intercalé est justifié par l'ordre d'exécution. s46b a un préfixe commun avec s46 : le résolveur flou refusera de choisir entre les deux, il faudra taper l'id complet ou le slug. C'est prévu par AGENTS.md, ce n'est pas un défaut.
- [x] Aucun chevauchement. Soupçons examinés et levés :
  - **s46 / s46b** : s46 garde `/register` et la destination `/dashboard` pour tous ; s46b les change. s46 c3 (lien `/admin` vers `/bureau`) et s46b c1 (SuperAdmin envoyé sur `/admin`) se complètent.
  - **s46b / s12d** : s46b fixe la destination, s12d remplit la page sans la toucher. s12d c5 vérifie l'arrivée « par la destination de s46b » : c'est un recoupement de vérification, pas de livraison.
  - **s46b / s47** : s46b pose l'exception réservée au SuperAdmin, et s47 retire les rôles globaux qui n'y ont pas droit. Remarque, sans constat : dès s46b, un compte `admin` global sans ligne `member` ne peut plus se connecter sur un domaine d'association. Les specs qui l'utilisent (`e2e/association-settings.spec.ts`, `e2e/association-identity.spec.ts`) risquent donc de casser **à s46b**, pas à s47. L'inventaire des specs de s46b doit les inclure.
  - **s46b / s12b** : la procédure Google multi-domaine est reportée « de s46b » dans s12b (l. 1294). Ce report suppose que s46b a tranché le mécanisme, ce qui n'est pas acquis (M1).

## Constats

### Majeur

**M1 : s46b c5, la connexion Google « reste proposée » repose sur une prémisse fausse et cache une décision, un écran et un mécanisme non tranchés.**

- La recherche de s46 (`docs/research/s46-comptes-herites-minimum.md`, l. 228-231 et question 1, l. 440-444) établit qu'**aucun écran ne propose Google** : `/login` est l'écran du lien magique, `/login/prestataire` celui du mot de passe, et `login.test.tsx` affirme qu'il n'y a pas de bouton Google. Le seul appelant est `/register`, que s46b c3 ferme. La note de s46b le reconnaît (« le critère "reste proposée" suppose un bouton… à faire désigner »), mais le critère n'a pas été repris.
- L'arbitrage du 7 octobre (« la connexion par Google est conservée ») a été pris sur cette prémisse. Concrètement, il veut désormais dire **ajouter** un bouton sur un écran de connexion. Cela pose trois problèmes :
  1. **une décision de produit à reprendre** par l'utilisatrice : ajouter Google, ou le retirer comme Apple et GitHub. Retirer Google supprime d'un coup c5, la moitié des cas de c2 et la note Google de s12b ;
  2. **un écran sans design** : s46b ne se déclare pas porteuse d'écran, et un bouton OAuth sur `/login` (public âgé, lien magique en parcours principal) relève de `/ks-design`, voire d'un manque du design system ;
  3. **un mécanisme non tranché** : l'URI de retour est celle de `BETTER_AUTH_URL`, et la session serait ouverte sur l'hôte de la plateforme, pas sur le domaine de l'association (recherche, l. 222-227). c5 exige pourtant « sur le domaine de son association seulement ». La note renvoie le choix au plan (console Google par domaine, ou domaine commun) et la procédure à s12b. C'est une décision structurelle (ADR), pas une tâche de plan.
- Le risque écrit pour la note 4 (l. 3375-3380) ne compte que trois changements et ne mentionne pas Google. Au seuil que s03 s'était fixé le 19 septembre, ce quatrième risque justifie de **sortir Google de s46b** : soit dans une story propre ajoutée en fin de numérotation, avec son design et son ADR, soit en le retirant du produit. s46b resterait alors un 4 cohérent avec son risque écrit.
- À trancher avant `/ks-plan s46b`.

### Mineurs

**m1 : s46b c2, le niveau de test des preuves croisées pour la double authentification et Google n'est pas fixé.**

- c2 exige un test d'accès croisé « pour chaque mode ». AGENTS.md place le test d'isolation en e2e Playwright, mais le seed n'a aucun compte à double authentification et il n'existe aucun simulacre OAuth (recherche, l. 394 et question 10, l. 471-472). La note renvoie à « voir la recherche » sans trancher.
- Le contrôle doit vivre « à un seul endroit que tous les modes traversent » (note de s46b). La story peut donc fixer la preuve :
  - e2e croisé pour le mot de passe et le lien magique ;
  - ajout d'un compte à double authentification au seed, ou test de service sur le point de contrôle unique, pour la double authentification ;
  - test de service pour Google, ou aucun test si M1 retire Google.

  C'est une décision de découpage, parce qu'elle conditionne la testabilité du critère.

**m2 : s46b c3, la liste fermée des origines possibles d'un compte est incomplète.**

- c3 affirme qu'« un compte ne naît que du provisioning d'une association (s01), de l'ouverture du compte d'une fiche membre (s12d) ou du seed ». Or le webhook Stripe, conservé et vérifié par s45 c6, crée encore un utilisateur « guest » : `createUserFromStripeService` dans `src/lib/stripe/stripe-events.ts` (l. 425 et l. 569). Le parcours `/checkout` a disparu, mais le webhook réagit toujours aux événements Stripe.
- Deux choix : ajouter cette origine à la liste comme légitime (abonnement plateforme créé par le SuperAdmin), ou la fermer dans s46b. En l'état, le test prévu (« tente l'inscription et constate qu'aucun utilisateur n'est créé ») ne couvre pas cette affirmation. À noter aussi : le formulaire de `/admin/users` ne crée pas de compte (seulement modification, suppression et liste), il n'est donc pas concerné.

**m3 : s47, « sur le précédent de s12c » est une référence en avant.**

- La note de migration (l. 3432-3433) appuie le test du critère c3 sur « le précédent de s12c ». Mais s12c se joue **après** s47 (s47 → s12b → s12c). Ce précédent n'existe que dans une note de story, pas dans le dépôt.
- Ce n'est pas une dépendance impossible : c3 décrit le contrôle de façon autonome. Mais s47 sera la première à monter dans la CI une base au seed de `main` et à y appliquer les migrations de la branche. Le dire (« s47 crée ce contrôle ; s12c le réutilise pour sa restauration »), sinon l'agent de s47 cherchera un modèle absent.

**m4 : historique du récapitulatif, une phrase périmée par la scission.**

- L. 3597-3598 : « s46 les comptes et la connexion limitée à l'association du domaine ». La phrase suivante corrige (scission du 13 octobre), mais la première est fausse en lecture rapide. Écrire « s46 les comptes (la connexion passe dans s46b le 13 octobre) ».
- Le paragraphe « Dix stories ont été ajoutées en revue du découpage » ne compte toujours pas s47, que son en-tête dit « décidé[e] à la revue du découpage du 7 octobre ». Le paragraphe l. 3594-3601 la consigne bien : seul le compte du paragraphe précédent est inexact.

## Verdict

Aucun problème critique :

- toutes les lignes du périmètre sont couvertes (37 + 3), et la scission n'en retire aucune ;
- aucune story ne reprend un élément du cimetière ;
- aucune story n'est à 5 ;
- aucun cycle ni dépendance impossible. Les chaînes s44 → s45 → s46 → s46b → s47 → s12b et s46b → s12d → s13 sont exécutables, et le paragraphe d'ordre correspond au graphe.

Un majeur (M1) : le critère Google de s46b repose sur une prémisse fausse, établie par la recherche. Il cache une décision de produit (ajouter ou retirer Google), un écran sans design et un mécanisme multi-domaine non tranché, absent du risque écrit. À trancher par l'utilisatrice avant `/ks-plan s46b`. La sortie la moins chère : retirer Google, ou le sortir dans une story propre en fin de numérotation.

m1 et m2 sont à reprendre avec M1, avant le plan de s46b. m3 est une ligne à corriger dans la note de s47. m4 est une correction de quelques mots dans le récapitulatif. s46 n'est touchée par aucun constat et peut partir en plan telle quelle.

Fichiers concernés : `docs/stories.md` (s46b l. 3310-3380, s47 l. 3432-3433, récapitulatif l. 3560 et 3597-3598), `docs/research/s46-comptes-herites-minimum.md` (l. 222-240, 394, 440-444, 471-472), `src/lib/stripe/stripe-events.ts` (l. 425, 569).

Max severity: major
Stories ready: yes
