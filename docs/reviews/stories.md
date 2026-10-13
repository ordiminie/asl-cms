# Revue du découpage : ASL-CMS (Lp)

> Relecture à contexte neuf de `docs/stories.md` (57 stories) face à `docs/prd.md`, avec la grille de `templates/stories-review-checklist.md`. Chaque constat est classé critique, majeur ou mineur.
> Les stories s01 à s12a et s43 sont livrées (revue présente dans `docs/reviews/`). Ni leur taille ni leur contenu ne sont rediscutés. Les documents hérités du boilerplate (`docs/research/s000-*`, `s001-*`) ne sont pas des stories du projet.
> Passe précédente, le même jour : verdict `major` / `yes`, un majeur (M1) et neuf mineurs (m1 à m9). Depuis, s44, s45, s46, s12d, s12b et le récapitulatif ont été repris selon les arbitrages de l'utilisatrice. La fermeture de chaque constat est vérifiée ci-dessous.
> L'effort porte surtout sur **s47-roles-globaux-reduits** (ajoutée le 2026-10-07) et sur la cohérence des reprises de s44, s45, s46 et s12d. Le passage complet est quand même fait.

**En bref : aucun critique, aucun majeur, sept mineurs. Le majeur M1 est fermé : l'espace membre reste sur `/dashboard`, et s46 et s12d disent désormais la même chose. Deux constats de la passe précédente restent ouverts en partie : le récapitulatif (s08b) et la clause morte de s45.**

- Toutes les lignes du périmètre restent couvertes. s47 n'en retire aucune : les quatre rôles du PRD (Membre, Bureau, Président(e), SuperAdmin) survivent tous.
- **s47 n'est pas une couche technique déguisée.** Elle déclare un utilisateur (le SuperAdmin) et un comportement observable : le formulaire de `/admin` ne propose plus que les rôles conservés, et un ancien `admin` global est refusé sur `/admin`. Elle est livrable seule et se déclare en dérogation, comme s45 et s46. Ses défauts sont mineurs :
  - son critère de migration ne peut pas passer dans la stratégie de test du projet telle qu'elle est (m3) ;
  - les « rôles conservés » ne sont pas fixés (m4) ;
  - sa place avant s12d est affirmée sans être portée par une dépendance (m5).
- **s47 n'entre en conflit avec aucune autre story.** L'homonymie `board` / `admin` est traitée explicitement. La règle « seul le SuperAdmin fait exception » de s46 c5 prépare s47. s37 et s41 ne reposent que sur des rôles d'association et sur `super_admin`.
- Les reprises de s46 et s45 sont cohérentes entre elles et avec s12d. Deux points de forme restent :
  - le mode clair seul arrive dans s45 sans que son titre ni son « afin de » l'annoncent, et la règle transverse « Socle habillé » dit le contraire de ce que fait s45 (m6) ;
  - s46 a encore grossi depuis m8 (m7).

## Suivi de la revue précédente

| Constat                                               | État                                               | Preuve                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 : s46 et s12d se contredisent sur l'espace membre  | **Fermé**                                          | s46 c2 : « `/dashboard` devient l'espace membre ». s46 c3 : le membre propriétaire arrive sur `/dashboard`. s46 c6 cite le provisioning de s01 et s12d « à venir ». s12d dépend de s46 (en-tête et récapitulatif). s12d c5 et sa note « Après s46 » posent « Mes parcelles » sur l'adresse fixée par s46, sans retoucher la destination, et créent le compte par `createUserDao`. Le design de s12d (`/dashboard`) n'est plus contredit. |
| m1 : récapitulatif dérivé pour s08b                   | **Ouvert en partie**                               | Les compteurs sont justes : 57 stories, quatre à 1, vingt et une à 2, vingt-trois à 3 et neuf à 4, recomptés ligne à ligne avec s08b à 1. En revanche, s08b n'a **toujours pas de ligne** dans le tableau. Les lignes de s10 et s12b citent toujours `s08` là où leurs en-têtes citent `s08b`. L'historique reste incomplet. Voir m1.                                                                                                    |
| m2 : « Ordre des stories » n'est plus vraie           | **Fermé**                                          | Paragraphe « Exception de numérotation » (l. 25-28) : s44 → s45 → s46 → s47 se jouent avant s12b et s12d. Reste un écart entre ce paragraphe et le graphe pour s47 (m5).                                                                                                                                                                                                                                                                 |
| m3 : s44 c2 non repris après la recherche             | **Fermé** ; suppression : **Écarté par arbitrage** | s44 c2 ne cite plus ni le sélecteur de thème ni la page « supprimée ». La note (l. 3146-3150) dit que la suppression d'une page n'existe pas dans le produit, et que le sélecteur de thème disparaît avec s45. Arbitrage de l'utilisatrice : pas de suppression de page, la dépublication suffit.                                                                                                                                        |
| m4 : clause morte de s45 c1                           | **Ouvert**                                         | s45 c1 se termine toujours par « y compris quand la configuration active encore ces familles de pages », alors que s45 c7 retire `blog` et `docs` de l'enum. Voir m2.                                                                                                                                                                                                                                                                    |
| m5 : règles et notes citant les fichiers retirés      | **Fermé**                                          | s45 c9 (`rule-react-cache-next-cache.md`, `rule-mdx-rendering.md`, inventaire au plan, `pnpm check:rules`). s46 c11 (`rule-form-front.md`, notes de s16 rebranchées).                                                                                                                                                                                                                                                                    |
| m6 : Google sans parité ni report vers s12b           | **Fermé**                                          | s46 c5 : connexion limitée à l'association du domaine « quel que soit le mode », Google compris, prouvée par un test croisé par mode. s46 c8 : « sur le domaine de son association seulement ». s12b, note « Connexion Google sur chaque domaine (reporté de s46) ».                                                                                                                                                                     |
| m7 : trois cas limites de s46                         | **Fermé**                                          | SuperAdmin : s46 c3, « même s'il a aussi un rôle dans l'association ». `admin` global : s46 c5 ne lui accorde pas d'exception, et s47 retire le rôle. `/dashboard` sans session : s46 c2, « il redirige vers la connexion comme aujourd'hui ».                                                                                                                                                                                           |
| m8 : trois valeurs sous un 3 sans risque              | **Fermé**                                          | s46 passe à 4. Son risque est écrit (l. 3320-3325) et le récapitulatif la range parmi les 4. Son « afin de » nomme désormais la fermeture aux inconnus. La story a toutefois encore grossi (m7).                                                                                                                                                                                                                                         |
| m9 : justification par le PRD plutôt que par une date | **Écarté par arbitrage**                           | Décision de l'utilisatrice : les stories hors périmètre n'ont pas à se justifier par le PRD. Constat non reconduit, y compris pour s47.                                                                                                                                                                                                                                                                                                  |

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

- [x] Chaque ligne du tableau « Replicated (core loop) » est livrée par au moins une story : 37 lignes du tronc commun et 3 modules.
- Les reprises et l'ajout ne retirent aucune couverture :
  - **s47** ne garde que `user` et `super_admin` côté global. Les quatre rôles des Target users et de s03b c1 sont tous intacts, et la simulation de rôle (s41) repose sur `super_admin`, conservé.
  - **s46 c5** limite la connexion à l'association du domaine pour tous les modes. Elle étend la règle du lien magique de s03, elle ne la retire pas.
  - **s45 c8** (mode clair seul) ne touche pas la ligne Identité visuelle : la teinte reste une variable de la palette claire.

## Périmètre

- [x] Aucune story ne reprend un élément du cimetière.
  - s46 c4, le lien de `/admin` vers `/bureau` pour le SuperAdmin, reste interne à Zourite Studio. Il n'expose rien aux associations, ce qui respecte la Target users « non exposé aux associations ».
  - La connexion Google, gardée sans inscription, suppose une adresse. Ce n'est donc pas le « plan B de connexion pour les membres sans email ».
- [x] Aucune story ne dépasse le périmètre, à **huit** dérogations déclarées près : s12a, s12b, s12c, s39, s43, s45, s46 et s47. Chacune est déclarée dans son en-tête, et le récapitulatif les énumère toutes les huit. s47 est bornée : retrait seul, voie de retour écrite, migration isolée dans un second commit.

## Qualité des stories

- [x] Chaque story est une tranche livrable de bout en bout, aux dérogations déclarées près.
  - **s47** : ce n'est pas une couche technique. L'utilisateur est déclaré (le SuperAdmin) et le comportement est observable :
    - formulaire de `/admin` réduit (c2) ;
    - comptes convertis en `user` (c3) ;
    - refus de `/admin` à tout autre que le SuperAdmin, sur chaque action serveur (c1).

    Elle est livrable seule. Sa valeur réelle est le moindre privilège : aucun droit plateforme ne dépend d'un rôle que le modèle d'ASL-CMS ne connaît pas. Son « afin que » le formule mal (m4).

  - **s46** reste une tranche livrable, avec une valeur désormais double, écran réduit et fermeture aux inconnus, nommée dans son « afin de ». Elle est à la limite haute de son 4 (m7).
  - **s45** porte maintenant une deuxième valeur, le mode clair seul, que son utilisateur déclaré (le visiteur) ne couvre pas (m6).

- [ ] Chaque critère peut devenir un test : **presque**.
  - s45 c1 garde sa clause morte (m2).
  - s47 c3 vérifie la migration « sur la base seedée avant et après », alors qu'aucun niveau de test du projet n'exécute de migration (m3).
  - s47 c2 dépend d'une décision renvoyée au plan (le sort de `public`), et sa clause « ni dans le code d'autorisation » est une propriété du diff, pas un comportement (m4).
  - Les nouveaux critères de s46 (c2 à c6) et de s45 (c8, c9) sont exerçables tels quels.
- [x] Notes agentiques présentes et utiles. Celles de s47 sont d'un bon niveau : homonymie `board` / `admin`, piège du plugin `admin()` de Better Auth, voie de retour, second commit pour la migration, test à réécrire plutôt qu'à supprimer. Deux remarques, sans constat :
  - la note ne cite que `e2e/association-settings.spec.ts`, alors que `e2e/association-identity.spec.ts`, qui porte le critère livré de s01b (« administrateur global de la plateforme… reçoit un refus »), boucle aussi sur `admin@gmail.com` ;
  - `moderator-member@gmail.com` sert de `MEMBER_A` dans `e2e/incident-report.spec.ts`.

  L'inventaire revient au plan, mais le critère de s01b perd son cas « administrateur global » : le réécrire sur `user` reviendrait à doubler le cas `user` déjà présent dans la boucle.

- [x] Complexité notée partout, **aucune story à 5**, et les neuf stories à 4 explicitent leur risque (s46 comprise).
  - **Le 3 de s47 se défend.** Le retrait des valeurs de l'enum transforme tout reste de `RoleConst.ADMIN` en erreur de compilation : c'est un volume mécanique et outillé, le raisonnement que s01 tenait pour le retrait de l'ADR 009. Son vrai risque, perdre les opérations du plugin `admin()` ou rouvrir `/admin` par la hiérarchie `roleHierarchy`, est écrit en piège. Un 3 n'exige pas plus.

## La liste dans son ensemble

- [x] Pas de cycle. Arêtes nouvelles ou modifiées vérifiées :
  - s47 → s03b (livrée), s46 ;
  - s12b → s44, s45, s46, s47 ;
  - s12d → s03, s03c, s12, s46.

  La chaîne s44 → s45 → s46 → s47 → s12b → s12c → s13 est exécutable, et s46 → s12d → s13 aussi. L'en-tête de s12b concorde avec le récapitulatif sur ces quatre ajouts.

- [ ] Ordre lisible de haut en bas : **oui pour s44 à s46, presque pour s47.**
  - Le paragraphe « Exception de numérotation » rend l'écart d'ids explicite.
  - Il place aussi s47 « avant s12d », sans que s12d en dépende et sans que la dépendance s47 → s46 soit motivée (m5).
  - Ce n'est pas une référence en avant : aucune story ne suppose un travail planifié après elle.
- [ ] Ids bien formés et uniques : oui pour la forme. `s47-roles-globaux-reduits` est conforme et unique. **Non pour la concordance avec le récapitulatif**, toujours à cause de s08b (m1).
- [x] Aucun chevauchement. Soupçons examinés et levés :
  - **s47 / s03b** : s03b a renommé le Bureau en `board` et déclaré que « le rôle global `admin` ne change pas ». C'était le périmètre de s03b (un rechercher-remplacer aveugle), pas un engagement durable. s47 le reprend explicitement (« Homonymie à ne pas casser ») et ne touche que `RoleConst`. Pas de conflit.
  - **s47 / s46** : s46 c3 envoie le SuperAdmin sur `/admin`, et s46 c5 ne fait d'exception que pour lui. Entre s46 et s47, un `admin` global sans rôle d'association ne peut donc plus se connecter sur un domaine d'association. s47 achève ce mouvement au lieu de le contredire. s46 c4 (lien `/admin` → `/bureau`) et s47 c1 (`/admin` au seul SuperAdmin) se complètent.
  - **s47 / s37** : la matrice porte sur les rôles d'association du registre. Aucun rôle global n'y entre, et l'ADR 018 excluait déjà l'`admin` global du contournement. Pas de recouvrement.
  - **s47 / s41** : la simulation s'appuie sur `super_admin` et sur les rôles d'association. Rien de retiré.
  - **s47 / s12d** : s12d crée des comptes au rôle global `user` par défaut. Elle n'utilise aucune valeur retirée.
  - **s47 / s01b, s02 (livrées)** : le critère de s01b nomme l'« administrateur global de la plateforme » parmi les refusés. Après s47, cette population n'existe plus ; le critère reste vrai, mais son test change de sujet (voir « Qualité »). s02 ne nomme pas le rôle global.
  - **s46 / s12d** : s46 vide `/dashboard` et fixe la destination ; s12d remplit la page sans retoucher la destination. s12d c5 vérifie l'arrivée sur « Mes parcelles » : c'est un recouvrement de vérification, pas de livraison. Acceptable.

## Constats

### Mineurs

**m1 : le récapitulatif n'a toujours pas de ligne pour s08b (reprise partielle de m1).**

- Les compteurs ont été corrigés et sont justes.
- En revanche :
  - s08b, livrée, n'a **pas de ligne** dans le tableau « ordre et dépendances » ;
  - les lignes de **s10** (« s02, s04, s08 ») et de **s12b** (« …, s03c, s08, s12a, … ») citent `s08`, alors que leurs en-têtes citent `s08b` ;
  - **s12b c6** dit encore « la purge des empreintes des formulaires publics (s08) », et sa note « Le cron système » parle de « la purge quotidienne des empreintes de s08 ». La purge est livrée par s08b c3.
- L'historique de fin de document ne consigne ni s08b, ni s12d, ni s43. s44 à s47 n'y apparaissent que dans le paragraphe des dérogations. Le paragraphe « Dix stories ont été ajoutées en revue du découpage » ne compte pas s47, pourtant « décidé[e] à la revue du découpage du 7 octobre ».
- Le constat reste mineur parce que la story absente est livrée : personne ne peut la sauter. C'est toutefois la troisième passe où le tableau dérive.

**m2 : s45 c1, la clause « y compris quand la configuration active encore ces familles de pages » est toujours morte (ex-m4, non repris).**

- Après s45 c7, `blog` et `docs` ne figurent plus dans `EnabledPageSchema`, qui refuse toute valeur inconnue au démarrage. `/pricing`, `/checkout`, `/privacy` et `/terms` n'ont aucune famille dans cet enum.
- Aucun test ne peut exercer cette clause. La supprimer, ou la reformuler, par exemple « quelle que soit la valeur de `NEXT_PUBLIC_ENABLED_PAGES` ».

**m3 : s47 c3, la vérification de la migration n'a pas de niveau de test, et la note de migration laisse l'ordre ambigu face à AGENTS.md.**

- « Vérifié sur la base seedée avant et après migration » ne correspond à aucun niveau de la stratégie de test du projet :
  - les tests unitaires n'ont pas de base (`db.ts` refuse la connexion) ;
  - la CI e2e monte la base par `pnpm db:push && pnpm db:seed` (`rule-ci-cd-devops.md`) et n'exécute **aucune migration** ;
  - et s47 c4 retire ces rôles du seed : la « base seedée avant » est celle de `main`, pas celle de la branche.
- La partie « garde ses rôles d'association » est vraie par construction, puisque la migration ne touche que `user.role`. Le vrai risque n'est pas couvert : une migration qui échoue sur une base de recette contenant ces valeurs.
- Deux sorties possibles :
  - suivre le précédent de s12c, avec un test joué en CI sur le Postgres éphémère : seed de `main`, application des migrations de la branche, contrôle ;
  - ou passer le critère en « à vérifier en review », avec la procédure écrite, comme s12b et s12c le font pour ce qui n'est pas automatisable.
- Côté AGENTS.md, la note énumère quatre étapes : convertir, créer le type, basculer la colonne, supprimer l'ancien type. Elle ne range explicitement que la conversion des données dans `drizzle-kit generate --custom`. Si les quatre étapes partent dans le fichier `--custom`, le modèle `roleEnum` et le snapshot divergent, et le `pnpm db:generate` suivant régénère le changement. C'est exactement l'incohérence de journal et de snapshot qu'AGENTS.md interdit. Préciser l'ordre dans la note :
  1. une migration `--custom` pour la conversion des données ;
  2. puis la modification de `roleEnum` dans `src/db/models/auth-model.ts` ;
  3. puis `pnpm db:generate`, pour que le snapshot reflète le nouveau type.

  s03b avait fait de même pour `organization_role`.

**m4 : s47 c2 renvoie au plan une décision de périmètre, et son « afin que » est inexact.**

- c2 exige que le formulaire de `/admin` « ne propose plus que les rôles conservés », mais la note renvoie au plan la question de garder `public` (« le plan vérifie à quoi sert `public` avant de le garder »). Retirer `public` serait une quatrième valeur retirée de `role_type`, hors de la liste du critère. Le critère ne peut pas devenir un test tant que l'ensemble n'est pas fixé. Le nommer dans la story (`user` et `super_admin`, avec ou sans `public`) : c'est une décision de découpage, pas d'implémentation.
- « Ni dans le code d'autorisation » est une propriété du diff, pas un comportement. La ranger en « à vérifier en review », comme s03b le fait pour les contrôles écrits à la main.
- L'« afin que » invoque « un rôle que plus personne ne sait attribuer ». C'est inexact : le formulaire de `/admin` les attribue aujourd'hui, et c2 le constate. La raison réelle est dans l'en-tête : ces rôles n'ont **aucun équivalent** dans le modèle d'ASL-CMS, et ils ouvrent des droits plateforme (paire `[ADMIN, SUPER_ADMIN]`). Corriger la formule.

**m5 : s47, l'ordre annoncé dépasse le graphe, et la dépendance vers s46 n'est pas motivée.**

- « Ordre des stories » place s44 → s45 → s46 → s47 « avant s12b et avant s12d ». s12d dépend de s46, mais **pas de s47**, ni dans son en-tête ni dans le récapitulatif. Un agent qui suit le graphe peut planifier s12d avant s47.
- Rien ne l'interdit techniquement : s12d ne crée que des comptes `user`. Mais la phrase et le tableau disent deux choses différentes. Soit ajouter s47 aux dépendances de s12d, soit écrire « s44 à s46 avant s12d ; s47 avant s12b ».
- La dépendance s47 → s46 n'est expliquée nulle part dans les notes de s47. La raison probable est que les deux stories touchent `src/lib/better-auth/auth.ts`, la destination après connexion et l'exception SuperAdmin. Une ligne suffit, pour qu'un futur réordonnancement ne la casse pas sans le savoir.

**m6 : s45 porte le mode clair seul sans l'annoncer, et la règle transverse « Socle habillé » dit le contraire.**

- s45 c8 (thème clair forcé partout, sélecteur retiré, nouvelle ADR qui remplace l'ADR 012) est une deuxième valeur, sans lien avec « ne servir que le site de l'association ». Elle concerne le back-office, le compte et `/admin`, pas seulement le visiteur déclaré. Le titre, le slug et l'« afin de » de s45 n'en parlent pas. Seul l'en-tête la mentionne.
- Le coût est faible et la décision est actée : pas de scission nécessaire. Ajouter la valeur à l'« afin de » suffit, pour qu'un lecteur du récapitulatif sache où vit cette décision.
- La règle transverse « Socle habillé » (l. 34-36) range toujours le « retrait du thème sombre » parmi les préalables déjà faits, et les notes de s01 (livrée) supposent `grep 'dark:'` vide. Or l'ADR 012 (`012-mode-sombre-conserve.md`) avait gardé le mode sombre. Et s45 choisit de **forcer** le clair en laissant `.dark` et les classes `dark:` inertes. Une story d'écran écrite après s45 lira dans la règle transverse un état du dépôt qui n'existe pas. Mettre la règle à jour en même temps que la nouvelle ADR (« clair seul, forcé par s45 ; classes `dark:` inertes, ne pas en ajouter »).

**m7 : s46 a encore grossi depuis m8 et se tient à la limite haute de son 4.**

- Depuis la passe précédente, s46 a gagné deux nouveaux pans :
  - **c4**, le lien SuperAdmin vers `/bureau` ;
  - **c5**, la connexion limitée à l'association du domaine pour quatre modes, prouvée par un test croisé **par mode**.

  Elle compte onze critères. Sa note le dit : c5 corrige « un trou du code livré » (seul le lien magique vérifie l'appartenance).

- Cette correction de sécurité ne dépend d'aucun écran retiré. Elle pourrait être livrée seule, et plus tôt. Le risque écrit couvre bien les trois changements d'authentification, ce qui suffit à la grille.
- À surveiller au plan, au seuil que s03 s'était fixé le 19 septembre : si la recherche ou le plan compte plus de risques que les trois annoncés, sortir c5 dans une story propre, ajoutée en fin de numérotation selon AGENTS.md. C'est la scission la moins chère du document à ce jour.

## Verdict

Aucun problème critique :

- toutes les lignes du périmètre sont couvertes, et s47 ne retire aucun des rôles du PRD ;
- aucune story ne reprend un élément du cimetière ;
- aucune story n'est à 5 ;
- aucun cycle. Les chaînes s44 → s45 → s46 → s47 → s12b et s46 → s12d sont exécutables.

Aucun majeur : M1 est fermé, et s46 et s12d s'accordent sur `/dashboard`. s47 est une tranche légitime, sans conflit avec s03b, s37, s41, s46 ou s12d.

Les mineurs m3 et m4 sont à corriger avant `/ks-plan s47` : critère de migration testable, ordre des migrations conforme à AGENTS.md, ensemble des rôles conservés fixé. m2 est à corriger avant le plan de s45, et m6 avant ou avec lui. m1 et m5 sont des éditions de quelques lignes dans le récapitulatif et dans « Ordre des stories ». m7 est une vigilance pour le plan de s46, pas une correction à faire maintenant.

Max severity: minor
Stories ready: yes
