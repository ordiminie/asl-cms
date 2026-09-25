# User Stories — ASL-CMS (Lp)

> Une story = une tranche livrable de bout en bout, écrite pour être exécutée par un agent.
> Format d'id : `s<numéro>-<slug-court>` — repris tel quel dans `docs/research/<id>.md`,
> `docs/designs/<id>.md`, `docs/plans/<id>.md`, `docs/reviews/<id>.md` et la branche `feature/<id>`.

## Spécification de référence

Le PRD assume le greenfield : **aucun SaaS cible à répliquer**. Là où killer-saas pointerait
normalement l'écran équivalent chez la cible, les notes agentiques pointent la section du
cahier des charges contractuel :

- `docs/Admin-MEL/cahier-des-charges-fonctionnel_V5.md` (**contractuel**, prévaut en cas de divergence) — cité `V5 §x`
- `docs/bases/cahier-des-charges-technique.md` (traduction technique interne) — cité `CDCT §x`
- `docs/prd.md` (périmètre, angle, cimetière) et `docs/decisions/001-base-technique-cms.md`

## Ordre des stories

L'ordre des ids suit les **dépendances techniques**, pas le calendrier du devis. Là où les deux
divergent, la dépendance l'emporte (arbitrage client du 6 septembre 2026) : les mois annoncés au
devis sont des jalons de livraison, et le chiffrage calendaire a été établi avant le passage au
développement agentique. Seul écart à ce jour : la GED passe avant le vote — détaillé en fin de
document.

## Règles transverses à toutes les stories

Ces contraintes valent pour chaque story et ne sont pas répétées à chaque fois :

- **Socle habillé** : l'application du design system au boilerplate — tokens, polices, retrait du
  thème sombre — est un **préalable au découpage, conduit hors du pipeline killer-saas** (voir
  `docs/adaptation-socle-design-system.md`). Toute story porteuse d'écran compose avec ce socle déjà
  habillé : elle ne reprend ni les tokens, ni les polices, ni les conventions d'usage des composants
  de `src/components/ui/`. Un écran qui redéfinit une couleur, une taille de cible ou un rayon est un
  échec de review. Ce n'est pas une dépendance de story, donc rien n'apparaît dans la colonne
  « Dépend de » — c'est l'état du dépôt au moment où s01 démarre, et c'est le `/ks-research` de s01
  qui le vérifie (voir ses notes).
- **Multi-tenant** : toute table métier créée après s01 porte `organization_id`, est couverte par une
  policy RLS, et sa story prouve l'isolation par un test d'accès croisé entre deux tenants.
- **Rien de propre à La Fourche en dur** : adresses de notification, catégories, seuils, activation
  de modules → paramètres de tenant (s02). Une valeur codée en dur est un échec de review.
- **Architecture en couches** : Présentation → Façade → Service (validation + autorisation) → DAL →
  Repository. La présentation n'importe jamais `src/db/models`. Voir `.claude/rules/RULES-INDEX.md`.
- **Cache Components (Next 16)** : lectures publiques en `'use cache'` dans le DAL, données par
  utilisateur derrière `<Suspense>`, jamais de `logger` ni d'horloge dans un scope `'use cache'`.
- **Tests** : `pnpm test --run` (jamais `pnpm test`, qui reste en watch). Migrations via
  `pnpm db:generate`, jamais de SQL écrit à la main.
- **Identité d'un membre = clé primaire arbitraire**, jamais l'email ni le numéro de parcelle. Ces
  deux valeurs sont des **attributs** : l'email peut être absent (100 membres sur 400), changer, ou
  être partagé dans un foyer ; le numéro de parcelle n'est pas unique par personne et se transmet à
  la vente. Toute clé de rattachement — stockage nominatif, rapprochement Pennylane, dédoublonnage
  d'import, export — s'indexe sur cette clé primaire. Voir `V5 §5.1`.
- **Désinscription : elle ne couvre que les communications facultatives.** Un membre qui se
  désinscrit cesse de recevoir les envois facultatifs, dont les campagnes libres ; il continue de
  recevoir les communications statutaires et contractuelles — convocation à l'AG, mise à disposition
  d'une facture, relance d'impayé — auxquelles son appartenance à l'association l'engage. Le pied de
  page de ces envois-là le dit explicitement.
  ⚠️ **Ce qui est acquis et ce qui ne l'est pas** : le _mécanisme_ est certain et se code (une nature
  par modèle, un filtre au calcul de la cible en s27b). La _classification_ de chaque modèle est une
  doctrine posée par défaut, **à faire confirmer par le conseil RGPD** en même temps que la règle de
  rétention (s12) — elle est donc une donnée de configuration, pas une constante : si l'arbitrage la
  contredit, on change une valeur, pas du code. C'est la même prudence que s12, qui livre le modèle
  daté sans coder la purge.
- **Registre d'actions** : toute story qui introduit une action soumise à autorisation la **déclare
  au registre** créé par s03b, avec les rôles qui l'exécutent par défaut. C'est ce registre que s37
  transforme en matrice configurable ; sans cette discipline story par story, s37 devrait
  instrumenter rétroactivement l'autorisation de tout le produit — ce qui la ferait passer de 4 à
  bien davantage. Une action non déclarée est un défaut de review de la story qui l'introduit, pas de
  s37.
- **Périmètre** : rien du cimetière du PRD ne devient une story. En particulier, aucun plan B de
  connexion pour les membres sans email — le publipostage PDF (s28) est la réponse produite.

## Dépendances externes bloquantes

Cinq points en attente d'un retour extérieur conditionnent des stories précises (`PRD` Constraints,
`V5` Annexe A). **Ne pas démarrer la story tant que le point n'est pas levé** ; les stories qui les
contournent sont ordonnées avant.

| Réserve                                                          | Bloque                                                                                        | Contournement prévu                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Accès API Pennylane + clé de rapprochement                       | s20 seule                                                                                     | s19 livre l'interface et la saisie manuelle ; s27 et s29 s'appuient dessus et ne sont pas bloquées |
| Contenu détaillé des 4 modèles d'email et de leurs variables     | la rédaction des modèles de s25, pas son code                                                 | livrer les modèles câblés avec un contenu provisoire marqué comme tel                              |
| Fichier exemple des relevés d'eau (format imposé par Pennylane)  | le parseur de s17, et par ricochet s18 (historique de consommation) — donc l'angle n°1 du PRD | aucun — s17 attend le fichier réel                                                                 |
| Accès ASL Community + validation statutaire du vote électronique | s33 en entier                                                                                 | aucun, mais le module n'est pas en doute : seul son fournisseur l'est (voir s33)                   |
| Arbitrage RGPD sur la rétention des données d'un ex-propriétaire | la coupure d'accès de s12                                                                     | s12 livre le modèle daté sans purge                                                                |

---

# Bloc A — Fondations et site public (sept-oct 2026)

## Story s01-provisionner-association — Provisionner une association

**En tant que** SuperAdmin Zourite Studio **je veux** créer une association et activer ses modules
**afin qu'**elle dispose d'un site isolé sans écrire une ligne de code.

### Complexity

4

### Acceptance criteria

- [ ] Créer une association depuis le back-office SuperAdmin (nom, slug, domaine, modules activés) produit un tenant sur lequel on peut immédiatement écrire puis relire une donnée scopée.
- [ ] Une requête entrante est rattachée à son association d'après le domaine appelé ; deux domaines servent deux tenants distincts, et un domaine inconnu répond 404.
- [ ] Chaque association porte un jeu de drapeaux d'activation de modules, persisté et modifiable depuis le back-office SuperAdmin ; deux associations peuvent avoir des drapeaux différents.
- [ ] Une route rattachée à un module inactif, ou à une clé de module inconnue, répond 404 — pas un lien masqué, pas une page vide (vérifié sur une route de test rattachée à un module fictif).
- [ ] Le provisioning désigne l'**administrateur initial** de l'association par son adresse email : le compte existe, il est rattaché à ce tenant et à lui seul, et il porte les droits d'administration — vérifié en le chargeant et en exerçant une action réservée.
- [ ] Une requête authentifiée dans le tenant A ne retourne aucune donnée du tenant B, y compris en forgeant l'identifiant de la ressource (test d'accès croisé).
- [ ] La policy RLS refuse la lecture inter-tenant même lorsque la couche applicative est court-circuitée (test au niveau repository).
- [ ] Les cinq sous-systèmes écartés par l'ADR 009 — chat IA, crédits, affiliation, projets/tâches, newsletter Mailchimp — ont disparu de l'arbre de travail : leurs tables ne sont plus dans le schéma Drizzle, la suite de tests passe sans elles, et `pnpm knip` ne signale pas d'orphelin issu du retrait.
- [ ] Aucune table métier restante n'est dépourvue de policy RLS : toute table portant `organization_id` en a une, et les tables exemptées sont exactement celles listées dans `docs/architecture.md`.
- [ ] `rule-react-query.md` et `rule-seed-usersroles-and-organization.md` ne renvoient plus à `projects`, retiré : elles pointent vers un domaine ASL-CMS réellement présent, et `pnpm check:rules` passe.

### Dependencies

Aucune. Première story du projet.

### Agentic notes

Réf. `CDCT §1`, `PRD` (Multi-tenant, complexité 4) et `docs/decisions/001-base-technique-cms.md`.
Le boilerplate fournit déjà `src/db/models/organization-model.ts` et `src/services/organization-service.ts` :
**partir de l'existant, ne pas créer un second modèle de tenant**. Analyser d'abord avec la skill
`codebase-analysis`.

**Première story du découpage, elle vérifie l'état d'entrée du socle.** Le `/ks-research` de s01
commence par là, avant toute autre chose : `grep -rl 'dark:' src/` et `grep -rl 'next-themes' src/` ne
doivent rien retourner. Le travail de socle est conduit hors pipeline
(`docs/adaptation-socle-design-system.md`) et un socle habillé à moitié est pire que pas habillé du
tout — 125 classes `dark:` par-dessus des tokens clairs. Rien d'autre dans le découpage ne
l'attraperait : la règle transverse « Socle habillé » sanctionne une story qui redéclare des tokens,
pas un socle jamais fait.

Risque (complexité 4) : le scoping n'est pas rétroactif. Cette story pose la convention (colonne
`organization_id` + policy RLS + helper de scoping) que **chaque story suivante applique** ; une
convention mal posée ici se paie sur 42 stories. Faire trancher la forme exacte en `/ks-architect`
avant `/ks-plan`.

**Le score reste à 4 après l'ajout du retrait ADR 009, et c'est un choix, pas un oubli** (C-06) :
s02 et s04 ont été re-chiffrées en grossissant, pas s01. La raison est que le retrait ajoute du
**volume mécanique et outillé** — `pnpm knip` nomme les orphelins, `pnpm check:rules` nomme les
règles cassées, la suite de tests nomme ce qui reste accroché — là où les re-chiffrages de s02 et s04
sanctionnaient du **risque conceptuel** (identité par tenant, modèle en blocs typés). Un 4 mesure ici
le risque de la convention de scoping, qui n'a pas bougé. Si `/ks-architect` conclut autrement, le
retrait se sort en story propre plutôt que de porter s01 à 5 — le découpage n'a aucune 5.

Cette story est la plus large du découpage — création du tenant, routage par domaine, drapeaux de
modules — et c'est assumé : les trois sont la même valeur vue de trois côtés (« une association a son
site »), et les séparer produirait deux stories non livrables seules. La simulation de rôle, elle, en
est bien sortie (s41) parce qu'elle répond au besoin d'un autre utilisateur.

Le **routage par domaine** est livré ici et nulle part ailleurs : c'est lui qui rend testable
« deux associations, deux sites », et le dernier critère de s11 (sitemap par domaine) s'appuie
dessus. Trancher en `/ks-architect` la forme retenue (domaine complet, sous-domaine, ou les deux) —
le VPS LWS et le certificat TLS en dépendent.

**Rôles : cette story s'appuie sur ceux du boilerplate, elle n'en crée aucun.** `admin` et
`super_admin` existent déjà (`src/services/types/domain/auth-types.ts`), ainsi que les rôles
d'organisation — c'est ce qui rend testables ici « le back-office SuperAdmin » et « une requête
authentifiée ». Les rôles **propres à l'association** (Membre, Bureau, Président(e)) arrivent en s03b
et le magic link en s03. Ne pas anticiper s03 ni s03b ici, et ne pas redéfinir un système de rôles concurrent.

Pièges : le boilerplate porte des notions Stripe/abonnement qui relèvent de la facturation
**plateforme** (Zourite Studio ↔ association) — à ne jamais confondre avec la facturation membres
(s19). RLS Postgres exige que la connexion applicative ne soit pas `SUPERUSER` ni `BYPASSRLS` :
vérifier le rôle utilisé par le pool (`docs/database-pool.md`).

L'administrateur initial est ce qui rend le critère de succès « une deuxième association est
provisionnée sans écrire une ligne de code » réellement vrai : sans lui, l'association serait livrée
sans personne pour l'administrer. La désignation des autres membres du bureau vient ensuite (s14).
**Livré** : l'administrateur initial est créé avec le rôle d'association `owner`, soit Président(e)
dans la correspondance des rôles de s03b — ce qui lui ouvre les réglages de s01b et s02 dès le
provisioning.

**Cette story crée le compte, elle ne le contacte pas.** L'envoi du lien de connexion appartient à
s03, première story à envoyer un email et seule à connaître l'adaptateur d'envoi. Faire partir un
email ici obligerait à un second chemin d'envoi que s03 devrait remplacer — référence en avant
relevée en revue du découpage. Entre s01 et s03, l'administrateur initial se connecte par le
mécanisme du boilerplate ; c'est assumé et temporaire.

La simulation de rôle du SuperAdmin (`PRD`, Target users) est volontairement **hors de cette
story** : c'est le besoin d'un autre utilisateur, livrable séparément (s41).

**Cette story livre le mécanisme d'activation, pas les modules.** `vote`, `voirie` et `annonces`
arrivent en s33, s34 et s35 — un critère qui les nommerait ici serait intestable au moment de la
livraison et ferait doublon avec le critère « Le module se désactive par tenant » que chacune de ces
trois stories porte déjà. La preuve se fait donc ici sur une route de test rattachée à un module
fictif, et par module chez chacune des trois. Défaut relevé en revue du découpage.

**Le retrait des sous-systèmes du boilerplate appartient à cette story**, et l'ADR 009 le dit
nommément : « Le retrait est exécuté dans s01 ». La raison n'est pas le ménage — c'est que s01 doit
donner une policy RLS à chaque table métier, et que le moyen le moins cher d'en donner une à
`credit_ledger` est de ne pas avoir `credit_ledger`. Sans ce retrait, s01 livre une dizaine de tables
dormantes à équiper ou à exempter, et 42 stories les traverseront en revue.

Le coût réel n'est pas dans les fichiers supprimés mais dans ceux qui restent : **44 fichiers
conservés référencent ces sous-systèmes**, dont `src/services/authorization/casl-abilities.ts`
(`Project`, `Task`, `Credit`, `Affiliate` y sont des sujets CASL, utilisés dans une quinzaine de
règles) et `src/lib/better-auth/auth.ts` (le hook Stripe `onSubscriptionComplete` appelle un service
de crédits). `src/db/scripts/seed.ts` est du SQL brut à réécrire en partie. La table des chemins de
l'ADR 009 est **incomplète** : elle omet `src/app/dal/task-dal.ts` et `src/components/features/tasks/`.

⚠️ `rule-react-query.md` et `rule-seed-usersroles-and-organization.md` citent `projects` comme
implémentation de référence. **Les mettre à jour dans le commit du retrait**, sinon elles pointent
vers des fichiers absents — l'ADR 009 en fait une tâche explicite de s01, pas un détail de nettoyage.
`docs/architecture.md` demande par ailleurs à s01 de désigner le remplaçant de `createProjectService`
comme modèle canonique de la couche service.

Cimetière : pas une base par tenant, base partagée + RLS.

---

## Story s01b-logo-association — Afficher le logo de son association

**En tant que** membre du bureau d'une association **je veux** téléverser son logo et son favicon
**afin que** le site public, le back-office et l'onglet du navigateur portent son identité, sans
intervention du prestataire.

### Complexity

3

### Acceptance criteria

- [ ] Depuis la page de réglages de son association, un membre du bureau téléverse un logo ; il s'affiche sur le site public et dans le back-office, et le remplacer met à jour les deux sans redéploiement.
- [ ] Un fichier refusé (type non autorisé ou taille dépassée) affiche une erreur explicite et laisse en place, inchangé, le fichier qu'il devait remplacer.
- [ ] Le fichier est écrit sur le disque du serveur, sous un répertoire propre à l'association : deux associations qui téléversent un fichier de même nom obtiennent deux emplacements distincts, chacun sous le préfixe de son association.
- [ ] Le logo et le favicon sont servis par une route de l'application, jamais depuis un dossier statique public : cette route ne sert que les fichiers d'identité de l'association du domaine appelé, et une demande portant sur le fichier d'une autre association ou sur un chemin forgé (remontée `../`, chemin absolu) ne rend aucun fichier.
- [ ] Deux associations servent deux logos distincts — vérifié sur les deux domaines.
- [ ] Le **favicon est un fichier distinct du logo**, téléversé séparément depuis la même page : le favicon servi est celui de l'association du domaine appelé, jamais un fichier unique du dépôt ni une dérivation du logo, et une association qui n'en a pas téléversé reçoit un favicon par défaut. Deux associations servent deux favicons distincts — vérifié sur les deux domaines.
- [ ] Une association sans logo reste lisible : le monogramme de l'association — ses initiales — remplace le logo, son nom restant écrit à côté, sur le site public comme dans le back-office. Aucun écran cassé faute de logo.
- [ ] Seuls les membres du bureau de l'association du domaine appelé — Bureau et Président(e) — et le SuperAdmin accèdent à la page de réglages et téléversent un logo ou un favicon : tout autre utilisateur authentifié — simple membre, bureau ou présidente d'une autre association, administrateur global de la plateforme — reçoit un refus, côté interface et côté serveur.

### Dependencies

s01

### Agentic notes

Réf. ADR 004 (stockage sur le disque du serveur), ADR 003 (tenant par domaine), `docs/design-system.md`
§1.2 (le logo est l'un des deux seuls éléments d'identité d'une association, avec la teinte portée par
s02), et `docs/research/s02-parametres-association.md` pour l'état du code vérifié le 17 septembre 2026.
Le PRD précise que « le logo et le favicon sont deux fichiers fournis par l'association » : le favicon
n'est pas dérivé du logo (arbitrage du 17 septembre 2026, revue du découpage I-03).

**Pourquoi cette story existe** : ajoutée le 17 septembre 2026 lors de la recherche de s02. Le
stockage de fichiers décidé par l'ADR 004 n'était porté par **aucune** story, alors que s04, s09, s31
et s32 le supposent. Il est posé ici sur la **première valeur qui en a besoin**, le logo, plutôt
qu'en story technique (précédent de `s00`, sortie du découpage). La ligne « identité visuelle » du
périmètre est désormais portée par **s01b** (logo, favicon) et **s02** (teinte).

**État d'entrée vérifié** : l'adaptateur `local` n'existe pas (`StorageType = 'supabase' | 's3'` dans
`src/lib/files/storage/storage-factory.ts`, `STORAGE_TYPE` à `supabase` par défaut) ; aucune route ne
sert de fichier ; `src/services/file-service.ts` construit des chemins **sans préfixe
d'organisation** et fabrique des URL publiques Supabase ; `files-repository.ts` dépend du type
`FileObject` de `@supabase/storage-js`.

**Ce que la story pose et que les suivantes réutilisent** : l'implémentation `local` derrière
`createStorage` (contrat `StorageOperations` inchangé, `list` découplé du type Supabase),
l'arborescence `{organizationId}/…` de l'ADR 004, et la route de lecture. La règle d'accès posée ici
est **publique mais bornée** : le logo et le favicon du tenant du domaine appelé, rien d'autre. s31 et s32 y
ajouteront la lecture authentifiée des documents, sans changer l'adaptateur.

**Emplacement du stockage** : le répertoire racine vient de la configuration validée par `@/env`,
jamais d'un chemin codé en dur. Il est hors de `public/` et ignoré par git ; en développement, un
dossier de la machine de développement. Sa sauvegarde n'est pas l'objet de cette story : elle revient à
s12c-sauvegarde, livrée avant s13.

**Accès** : le bureau édite, conformément au PRD (« le bureau doit pouvoir tout éditer sans
intervention du prestataire » ; arbitrage du 17 septembre 2026, revue du découpage I-02). Avant s03b,
les rôles fonctionnels s'appuient sur les rôles d'association du boilerplate : Bureau = `admin`
(renommé `board` en s03b), Président(e) = `owner`, SuperAdmin = `super_admin` (rôle **global**).

Piège vérifié : ni `withAuthAdmin` ni `requireActionAuth`, qui ne connaissent que les rôles
**globaux**. `canUpdateOrganization` (CASL) accepte bien `admin` et `owner` d'association, **mais aussi
l'`admin` global**, que la règle exclut : il faut un contrôle portant sur le rôle dans l'association
**du domaine appelé**, ou `super_admin`. La page **ne vit pas sous `/admin`**, qui est le back-office de
la plateforme. Comptes du seed, vérifiés en base le 17 septembre 2026 :

- sur `127.0.0.1` (Marketing Pro) : `user-admin@gmail.com` (Bureau, global `user`) **accepté** ;
- sur `localhost` (TechCorp) : `user-owner@gmail.com` (Présidente, global `user`) **accepté**,
  `user@gmail.com` (Membre) **refusé**, `admin@gmail.com` (`admin` global, Membre) **refusé** ;
- `superadmin@gmail.com` **accepté** sur les deux domaines.

Éviter `admin@gmail.com` et `admin-owner@gmail.com` comme cas « accepté » : tous deux sont aussi
`admin` global, ce qui brouille ce que le test prouve. **Le seed n'a aucun compte Bureau chez
TechCorp** : à ajouter au plan si le test en a besoin.

Les actions posées ici (téléverser le logo, téléverser le favicon) précèdent le registre des
permissions de s03b : **s03b les y déclare** (revue du découpage I-01, scission de s03 du 19 septembre 2026),
sans changer cette page.

**Favicon** : la documentation embarquée de Next.js 16
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`)
indique qu'un `favicon.ico` ne vit qu'à la racine de `/app` et **ne peut pas être généré par code**.
Le favicon par association passe donc par les métadonnées `icons` ou une icône dynamique, et le
fichier racine `src/app/favicon.ico` ne doit plus s'imposer à tous les domaines.

`organization.logo` existe déjà (`text`, nullable) et contient aujourd'hui des URL externes (seed,
formulaire d'organisation du boilerplate) : trancher au plan ce que la colonne porte désormais, et où
vit la référence du favicon. La page de réglages naît ici avec sa section identité (logo, favicon) ; s02
y ajoute les paramètres et la teinte. Son emplacement
se décide en `/ks-design`.

---

## Story s02-parametres-association — Paramétrer son association

**En tant que** membre du bureau d'une association **je veux** modifier ses réglages
**afin de** ne dépendre du prestataire pour aucune adresse ni aucun seuil.

### Complexity

3

### Acceptance criteria

- [ ] Le bureau modifie les paramètres déclarés au registre depuis le back-office de l'association, chaque valeur étant validée selon le type déclaré au registre. En s02, le registre déclare l'adresse de contact et l'adresse du responsable forage (définies par `CDCT §4.6`, lues par s08 et s10), modifiées dans la page de réglages de l'association, et la teinte d'accent, choisie dans la page « Identité » avec le logo et le favicon (arbitrage du 19 septembre 2026).
- [ ] La validation du registre est prouvée pour chaque type qu'il sait porter — adresse email, nombre, booléen, choix dans une liste fermée — : une valeur conforme est acceptée, une valeur non conforme est refusée avec un message explicite. Déclarer une clé d'un type existant ne demande aucune modification de la page — vérifié par une clé de test déclarée au registre de test.
- [ ] Modifier un paramètre puis le relire renvoie la nouvelle valeur, sans redéploiement ni redémarrage.
- [ ] Un paramètre jamais renseigné se lit à sa valeur par défaut déclarée au registre ; le renseigner puis le vider le ramène à cette même valeur par défaut. L'adresse du responsable forage a pour valeur par défaut **l'adresse de contact de l'association** (arbitrage du 19 septembre 2026).
- [ ] L'adresse de contact est **obligatoire** : elle est saisie à la création de l'association (formulaire de provisioning de s01, qui refuse une création sans elle) et ne peut pas être vidée — une tentative est refusée avec un message explicite, l'adresse précédente restant en vigueur.
- [ ] Le seed d'un tenant charge les valeurs déclarées dans son jeu de paramètres : après exécution, chaque clé déclarée se lit à sa valeur déclarée — vérifié sur un tenant de test, sans dépendre des données d'un client.
- [ ] Seuls les membres du bureau de l'association du domaine appelé — Bureau et Président(e) — et le SuperAdmin modifient les paramètres : tout autre utilisateur authentifié reçoit un refus, côté interface et côté serveur.
- [ ] Le bureau choisit la **teinte d'accent** de son association **dans la liste des six teintes validées**, jamais au sélecteur libre ; la couleur retenue s'applique au site public après rechargement.
- [ ] Deux associations aux teintes différentes servent bien deux teintes distinctes — vérifié sur les deux domaines (test d'isolation visuelle).
- [ ] Une association qui n'a pas choisi de teinte reçoit la teinte par défaut. Aucun écran cassé faute de personnalisation.

### Dependencies

s01, s01b

### Agentic notes

Réf. `V5 §4.6`, `CDCT §4.6`. Les valeurs de départ de La Fourche (`contact@asl-exemple.test` pour `contact.email`,
`responsable-forage@asl-exemple.test` pour `forage.responsable.email`) sont des **données de seed de ce tenant**,
pas des valeurs attendues par la suite de tests : lier les tests d'une story du tronc commun aux
adresses d'un client donné les ferait échouer chez le suivant.

C'est le socle du critère de succès « aucune donnée propre à La Fourche
codée en dur » : les stories s08, s10, s17, s22 et s29 lisent leurs adresses et seuils **ici**.

**Le registre grandit avec les besoins** (décision du 17 septembre 2026) : il déclare les clés que le
cadrage définit déjà — les deux adresses de `CDCT §4.6`, qui sont la raison d'être de cette story et que
s08 et s10 lisent — et la teinte ; les clés propres à une story arrivent avec elle (seuil d'envoi en s26,
activation des relances en s29…). Aucune clé n'est déclarée pour démontrer un type : nombre et booléen
se prouvent sur le registre et sa clé de test, pas par des réglages sans usage affichés en back-office.
Les types viendront aussi avec leurs stories : texte libre (s15), URL (s21, s33), liste de statuts (s19).

**Accès** : la page de réglages et son contrôle d'accès sont posés par s01b — le bureau (Bureau et
Président(e)) de l'association du domaine appelé, et le SuperAdmin, conformément au PRD. s02 applique la
même règle à la modification des paramètres. L'action « modifier les paramètres » précède le registre
des permissions : **s03b l'y déclare** (revue du découpage I-01, scission de s03 du 19 septembre 2026).

**À vérifier en review, pas en test** : aucune de ces valeurs ne doit subsister en constante dans le
code applicatif. C'est une propriété du diff, pas un comportement observable — la placer en critère
d'acceptation produirait un test invérifiable. Le critère testable est celui du défaut au registre.

Le boilerplate a `src/db/models/app-settings-model.ts`, **global** (clé primaire `key` seule, vérifié) :
l'ADR 010 prescrit une table `organization_setting` scopée tenant. Prévoir un registre typé des clés
(nom, type, défaut, description) plutôt qu'un `Record<string, string>` libre : c'est ce registre qui
rend la page de BO générique et la review vérifiable.

**L'identité visuelle d'une association tient en deux variables, et pas une de plus** : un logo (s01b)
et une teinte. Le design system est catégorique (§1.2) : `--accent-hue` est la **seule** variable de
tenant, lightness et chroma restent figés, et le bureau choisit **dans une liste de six teintes
validées** (195 eau, 150 pins, 255 lac, 40 tuile, 300 bruyère, 95 genêt) — jamais au sélecteur libre,
pour qu'aucun bureau ne puisse produire un site illisible. Ne pas ouvrir un `<input type="color">`.
La teinte, elle, est bien un paramètre de `organization_setting`.

⚠️ **L'injection de la teinte est un point ouvert du design system** (§1.2). La livraison propose
`attr()` typé en CSS, dont le support est inégal — **à vérifier avant de s'en remettre à elle**. Le
repli sûr est un style en ligne posé par le serveur sur `<html>` à partir du tenant résolu (ADR 003) :
`style={{'--accent-hue': hue}}`. Les tokens sont en place dans `src/app/globals.css` (vérifié le
17 septembre 2026).

---

## Story s03-connexion-lien-magique — Se connecter sans mot de passe

**En tant que** membre propriétaire **je veux** recevoir un lien de connexion par email
**afin de** consulter mon espace sans avoir de mot de passe à retenir.

### Complexity

3

### Acceptance criteria

- [ ] Saisir une adresse email connue envoie un lien de connexion à usage unique et affiche un écran d'attente explicite.
- [ ] Le lien ouvre une session valide ; réutilisé une seconde fois, il est refusé avec un message compréhensible et un bouton pour en redemander un.
- [ ] Un lien de plus de 20 minutes est refusé avec le même message et le même bouton.
- [ ] Une adresse email inconnue ne révèle pas si le compte existe (même écran, aucun email envoyé, aucun compte créé).
- [ ] L'email de connexion part par l'adaptateur d'envoi de l'ADR 005 (transport Brevo derrière un contrat maison), jamais par un appel direct à un fournisseur — vérifié par un transport de test qui reçoit l'email à la place de Brevo.
- [ ] L'email de connexion porte en en-tête le logo de l'association du domaine appelé (s01b), ou son nom quand elle n'a pas de logo.

### Dependencies

s01, s01b, s02

### Agentic notes

Réf. `V5 §2, §3.2, §3.3`, `CDCT §2, §3.3`. Recherche : `docs/research/s03-connexion-lien-magique.md`.

**Scindée le 19 septembre 2026**, avant le plan, au seuil prévu par cette note : la recherche a
compté cinq sujets à risque — le lien magique, l'adaptateur d'envoi (absent du code), le renommage du
rôle `admin` en `board`, le registre d'actions et la session sur plusieurs domaines. Cette story garde
le lien magique et l'adaptateur ; **s03b** prend les rôles et le registre d'actions, **s03c** la
session multi-domaine. Complexité ramenée de 4 à 3.

**Durée du lien : 20 minutes** (arbitrage du 19 septembre 2026), et non plus 4 heures. Le cahier des
charges technique et le brief produit disent encore 4 h : documents de base, non modifiés, à mettre à
jour avec le client si ce point y est engagé. C'est un paramètre de configuration, pas la valeur par
défaut de la lib (5 minutes).

Better Auth est déjà branché (`src/lib/better-auth/auth.ts`) et gère nativement le magic link :
**configurer, ne pas réécrire**. Aujourd'hui, une adresse inconnue reçoit un lien et le clic crée le
compte (`disableSignUp` absent) : c'est une inscription libre, à fermer ici.

**Mot de passe conservé** (arbitrage du 19 septembre 2026) : la connexion par mot de passe existe
déjà et reste disponible, au moins pour le SuperAdmin. Le lien magique est le chemin mis en avant
pour les membres ; masquer le mot de passe pour les autres rôles est souhaitable **si c'est simple**,
sans complexifier l'écran — à trancher en `/ks-design`. Les tests de bout en bout existants se
connectent par mot de passe et n'ont pas à changer.

Public âgé et peu à l'aise : les messages d'erreur doivent être en français simple et proposer
l'action de sortie (redemander un lien), jamais un code d'erreur. À traiter en `/ks-design`, sur la
base du design system §7.

**Adaptateur d'envoi** : le boilerplate envoie via **Resend**, le produit part sur **Brevo** (contrainte
PRD, ADR 005). C'est la première story qui envoie un email à un membre : elle pose le contrat
`EmailTransport` et son implémentation Brevo, avec un transport de développement et de test qui
n'envoie rien. Les emails transactionnels (lien magique) et les campagnes (s25) peuvent avoir deux
chemins distincts, mais un seul adaptateur. Le **budget quotidien** par association appartient à s26 :
ne pas l'anticiper.

**Domaine du lien** : cette story construit le lien comme aujourd'hui ; le rendre propre au domaine de
chaque association est l'objet de s03c. Ne pas figer d'hypothèse contraire (pas d'URL absolue codée
en dur dans le gabarit, en dehors du logo).

Cimetière : aucun plan B pour les membres sans email — pas de compte partagé, pas de code postal.

---

## Story s03b-roles-registre-actions — Rôles de l'association et registre d'actions

**En tant que** présidente d'une association **je veux** que chacun n'accède qu'à ce que son rôle
permet **afin que** le back-office reste réservé au bureau sans réglage de ma part.

### Complexity

3

### Acceptance criteria

- [ ] Les quatre rôles Membre, Bureau, Président(e) et SuperAdmin existent et sont attribuables à un utilisateur.
- [ ] Un Membre reçoit un refus sur toute page de back-office, un Bureau y accède, et le refus vaut aussi bien en interface que sur l'appel serveur direct.
- [ ] Une action déclarée au registre avec ses rôles par défaut est refusée à tout rôle absent de cette liste, et autorisée aux autres — vérifié sur une action de test.
- [ ] Les actions posées avant cette story — téléverser le logo et le favicon (s01b), modifier les paramètres de l'association (s02) — sont déclarées au registre avec pour rôles par défaut Bureau et Président(e) : un Membre y reçoit un refus et un Bureau y est autorisé, en interface comme sur l'appel serveur direct.

### Dependencies

s01, s01b, s02

### Agentic notes

Réf. `V5 §2, §3.2`, `CDCT §2`. Scindée de s03 le 19 septembre 2026 (voir ses notes). Recherche :
`docs/research/s03-connexion-lien-magique.md` (section « Rôles » et « Autorisation »).

**Correspondance des rôles** (décisions du 17 septembre 2026) : Membre, Bureau et Président(e) sont
des rôles **d'association** (`member.role`), SuperAdmin un rôle **global** (`user.role`,
`super_admin`). Le boilerplate nomme le Bureau `admin`, homonyme du rôle global `admin` de la
plateforme, source de confusion avérée : cette story le **renomme `board`** (`member` et `owner`
conservés pour Membre et Président(e)). Piège : le plugin `organization` de Better Auth
(`src/lib/better-auth/auth.ts`) est configuré sans rôles personnalisés et suppose `owner`, `admin`,
`member` ; le renommage impose d'y déclarer les rôles (`ac`, `roles`, et le client), en plus de la
migration de l'énuméré `organization_role` (migration custom) et des usages de
`UserOrganizationRoleConst` / `OrganizationRoleConst`. **Le rôle global `admin` ne change pas** : un
rechercher-remplacer aveugle casserait la plateforme.

**Cette story crée le registre d'actions**, mécanisme minimal par lequel chaque story ultérieure
déclare ce qu'elle rend autorisable (voir les règles transverses). Le registre est ici une simple
déclaration avec rôles par défaut, sans écran ; s37 le transforme en matrice configurable par
tenant. Le poser dès maintenant est ce qui évite à s37 d'avoir à instrumenter les stories
intermédiaires après coup — défaut relevé en revue du découpage. Les quatre rôles sont ici **fixes** ;
les rendre configurables en back-office est la story s37.

**Reprise des actions antérieures** : s01b et s02 passent avant le registre et contrôlent l'accès
directement (`canManageAssociation` : bureau du domaine appelé ou SuperAdmin). Cette story les déclare
au registre sans changer leur comportement, pour que s37 les trouve dans la matrice sans
instrumentation rétroactive.

**À vérifier en review, pas en test** : que les pages n'écrivent pas de contrôle d'autorisation à la
main en doublon du registre. C'est une propriété du diff, pas un comportement observable.

Les tests se connectent par mot de passe (conservé, voir s03) : cette story ne dépend pas du lien
magique.

---

## Story s03c-session-multi-domaine — Se connecter sur le domaine de son association

**En tant que** membre propriétaire **je veux** que le lien de connexion me ramène sur le site de mon
association **afin d'**ouvrir mon espace là où je l'ai demandé, quelle que soit l'association.

### Complexity

3

### Acceptance criteria

- [ ] Le lien de connexion pointe vers le domaine de l'association à laquelle il donne accès, jamais vers une adresse de configuration unique : demandé sur le domaine de l'association A, il mène au domaine de A et y ouvre la session ; demandé sur celui de B, il mène à B — vérifié sur deux domaines.
- [ ] La session est scopée à l'association du membre : elle ne donne accès à aucune donnée d'un autre tenant.

### Dependencies

s03

### Agentic notes

Réf. ADR 003. Scindée de s03 le 19 septembre 2026 (voir ses notes). Recherche :
`docs/research/s03-connexion-lien-magique.md` (sections « Multi-domaine » et « Pièges »).

**Piège multi-domaine** : `BETTER_AUTH_URL` et `NEXT_PUBLIC_APP_URL` ne portent qu'une valeur,
alors que chaque association a son domaine (ADR 003). Un lien construit sur cette valeur renvoie
toutes les associations vers un seul domaine : la session s'ouvre sur le mauvais site, et le défaut
ne se voit qu'en production, sur la deuxième association. Le domaine du lien se déduit de
l'association, **lu en base**, et non de l'en-tête de la requête : s15 et s42 génèrent aussi ces
liens, et s42 les envoie depuis une tâche différée, hors de toute requête. Les origines de confiance
et le cookie de session de Better Auth doivent accepter chaque domaine d'association, sans
redéploiement pour une nouvelle association. Défaut relevé en revue du découpage (M6) ; s12b vérifie
ensuite que le déploiement ne le défait pas.

Better Auth 1.7 accepte un `baseURL` dynamique (`allowedHosts`, liste statique) et des
`trustedOrigins` calculées par une fonction ; le client (`auth-client.ts`) est aujourd'hui construit
sur `NEXT_PUBLIC_APP_URL`. Le choix du mécanisme mérite un ADR. Preuve sur deux domaines locaux
(`localhost` / `127.0.0.1`), en e2e.

---

## Story s04-pages-cms — Publier une page du site

**En tant que** membre du bureau **je veux** créer, modifier, publier et dépublier une page composée
de blocs **afin de** faire vivre le site sans intervention du prestataire.

### Complexity

4

### Acceptance criteria

- [ ] Le bureau crée une page (titre, slug, contenu riche, images) et la voit rendue à l'URL publique une fois publiée.
- [ ] Une page en brouillon n'est pas accessible publiquement (404 pour un visiteur) mais reste prévisualisable par le bureau.
- [ ] Dépublier une page la retire du site public sans la supprimer ; la republier la restaure à l'identique.
- [ ] L'insertion d'une image dans une page l'enregistre dans le stockage de fichiers et l'affiche dans le rendu public.
- [ ] Un slug déjà utilisé dans la même association est refusé avec un message de champ ; deux associations peuvent avoir le même slug.
- [ ] Un membre non-bureau ne peut ni créer ni modifier de page.
- [ ] Une page est une **liste ordonnée de blocs typés**, pas un champ de texte unique : le bureau insère un bloc à un rang précis, en change l'ordre, et le rendu public respecte cet ordre après rechargement.
- [ ] Le réordonnancement est atteignable **sans glisser-déposer** — au clavier seul, l'ordre obtenu est le même qu'à la souris.
- [ ] Un type de bloc inconnu dans une page enregistrée ne casse pas le rendu : la page s'affiche, le bloc est ignoré et signalé au bureau.

### Dependencies

s01, s02, s03b

### Agentic notes

Réf. `V5 §3.1, §4.1`, `CDCT §3.1, §4.1`. Système de pages **générique** : les pages listées par le
bureau (Accueil, Présentation de l'association, « je viens d'acquérir un terrain », « Contacts
utiles ») sont du **contenu**, pas des gabarits à développer un par un. Ne pas créer une story ni un
modèle par page.

Le boilerplate a `src/db/models/post-model.ts` et un rendu MDX partagé
(`.claude/rules/01-presentation/rule-mdx-rendering.md`) — l'analyser avant de décider entre réemploi
et modèle dédié ; les pages CMS et les actualités (s05) doivent rester deux modèles clairs, pas un
`type` fourre-tout.

Éditeur de texte riche : brique tierce assumée (`CDCT §1.1`), pas de développement maison.
Référence d'ergonomie visée : éditeur de pages type WordPress — c'est l'exigence qui a
justifié d'écarter WordPress, elle se paie en `/ks-design`.

**Une page est une liste ordonnée de blocs typés, pas un champ markdown** (ADR 007) : Milkdown pour
le texte riche, @dnd-kit pour l'ordre, tous deux déjà dans les dépendances. Le rendu public des cinq
blocs est décrit au §4 du design system. C'est cette story qui livre `<SortableList />` et
`<BlockPicker />` (design system §2.2, §2.4, §2.5) ; `<PreviewBar />` sert le critère d'aperçu du
brouillon. Ne pas laisser proliférer les types de blocs : un besoin non couvert est un « design
system gap » à remonter, jamais à combler en freestyle.

⚠️ **Le glisser-déposer n'est pas le chemin obligatoire** (§2.4). Le public visé est âgé et peu à
l'aise avec l'informatique, et un réordonnancement uniquement à la souris exclut le clavier comme
l'écran tactile imprécis. Prévoir des commandes « monter / descendre » explicites, le glisser-déposer
venant en plus.

Piège stockage : le boilerplate uploade vers **Supabase**, le VPS LWS impose un stockage local
(contrainte PRD). Passer par l'adaptateur de stockage `local` posé par **s01b** (ADR 004) ; ne pas
coder contre `src/services/file-service.ts` tel quel sans avoir vérifié ce point.

Piège cache : le rendu public est caché (`'use cache'` + `cacheTag`), la publication doit invalider
avec `updateTag` — le bureau doit voir son changement immédiatement, pas au bout d'un délai de
revalidation. La publication et la dépublication d'une page devront **aussi** invalider le `cacheTag`
du menu, mais celui-ci n'existe qu'en s04b : cette story pose l'invalidation de la page, s04b y
raccroche la sienne.

**La navigation du site public n'est pas ici : elle est en s04b.** Cette story livre une page
atteignable par son URL — ce que le PRD reconnaît explicitement comme un état valide (« une page
publiée hors menu reste atteignable par son URL »). La composer dans un menu est l'incrément suivant,
livrable seul. Les deux étaient empilées ici ; la revue du découpage l'a relevé (C-01), après que la
correction de F-06 eut rangé le travail orphelin de la navigation dans la story la plus proche au
lieu de lui donner la sienne.

Risque (complexité 4) : c'est le back-office éditorial, risque produit n°1 de l'ADR 001, et la story
tient au-dessus du 3 chiffré par le PRD pour une raison précise — le modèle en blocs typés de
l'ADR 007. Deux briques neuves s'y rencontrent (Milkdown, @dnd-kit), sur l'adaptateur de stockage posé par s01b, et
trois composants du design system §2.2 y naissent (`<PreviewBar />`, `<SortableList />`,
`<BlockPicker />`). Les deux pièges qui coûtent le plus cher sont ci-dessus : le glisser-déposer
non obligatoire et le stockage local. L'adaptateur de stockage est tranché (ADR 004) et livré par
s01b : vérifier en `/ks-research` qu'il couvre les images de blocs avant `/ks-plan`.

---

## Story s04b-navigation-publique — Composer la navigation du site public

⚠️ **Identifiant intercalé, dérogation assumée à `AGENTS.md`.** La navigation appartient au tronc
commun et se livre juste après s04 ; lui donner l'id `s43` l'aurait placée en dernier et aurait rendu
fausse la règle « l'ordre des ids suit les dépendances ». Renuméroter s05–s42 décalait 38 stories.
La règle d'`AGENTS.md` a été amendée en conséquence : un suffixe lettre est autorisé pour intercaler.
Conséquence pratique : `/ks-plan s04` ne résout pas (deux correspondances de préfixe), il faut taper
`s04b` ou le slug — l'agent liste et s'arrête, il ne se trompe pas de story.

**En tant que** membre du bureau **je veux** décider où mes pages apparaissent dans le menu et ce que
dit le pied de page **afin que** le visiteur trouve le site sans connaître les URL.

### Complexity

2

### Acceptance criteria

- [ ] Le bureau compose le **menu du site public** : ajouter une entrée pointant vers une page, la retirer, en changer l'ordre. Le menu rendu au visiteur reflète cet ordre.
- [ ] Une page publiée mais absente du menu reste atteignable par son URL ; une entrée de menu pointant vers une page dépubliée ou supprimée **ne s'affiche pas** au visiteur, sans casser le rendu du menu.
- [ ] Le bureau modifie le contenu du **pied de page** ; la modification est visible sur toutes les pages publiques.
- [ ] Le menu et le pied de page sont **scopés au tenant** : deux associations servent deux navigations distinctes sur leurs domaines respectifs.
- [ ] Publier ou dépublier une page depuis s04 met le menu à jour **sans délai de revalidation** : le visiteur suivant ne voit jamais une entrée pointant vers une page disparue.
- [ ] Une entrée de menu porte sa **propre visibilité**, réglable indépendamment de l'état de publication de sa page cible — l'entrée restant masquée si sa page cesse d'être publiée (critère 2) : le bureau masque une entrée sans dépublier la page ni retirer l'entrée, et la réaffiche telle quelle. Une page publiée dont l'entrée est masquée reste atteignable par son URL.
- [ ] Un membre non-bureau ne peut modifier ni le menu ni le pied de page.

### Dependencies

s04

### Agentic notes

Réf. `V5 §3.1`, `CDCT §3.1`, `PRD` (« Navigation du site public », complexité 2). Cette ligne du
périmètre était orpheline au dixième passage de revue, puis absorbée par s04 au onzième ; elle a
enfin sa story (C-01).

Périmètre à ne pas élargir : **une seule profondeur de menu**, pas de sous-menus déroulants — le
public visé est âgé et peu à l'aise avec l'informatique, et un menu à plusieurs niveaux est
précisément ce qu'il ne faut pas lui demander de manipuler.

**L'en-tête, précisément.** Le PRD nomme deux choses éditables — « menu et pied de page » — et ce
sont les critères ci-dessus. Il l'a nommé trois un temps, en incluant l'en-tête ; la ligne a été
corrigée (D-04) parce qu'aucune story ne le livrait et qu'aucun document ne définissait ce qu'un
en-tête éditable serait au-delà du logo et de la teinte. **Il n'y a donc plus d'écart à déclarer.**
Ce que l'en-tête porte d'association — logo (s01b) et teinte (s02) — ne se recode pas ici : cette
story compose la navigation dans un en-tête déjà habillé. Le rendre éditable davantage serait un
élargissement de périmètre, donc une décision de `/ks-prd`.

Les trois attributs d'entrée que le PRD nomme — « ordre des entrées, page cible, visibilité » — sont
en revanche tous les trois servis : les deux premiers par le critère 1, le troisième par le critère 6,
ajouté pour cela.

Piège cache, et c'est le seul vrai risque de la story : **le menu est rendu sur _toutes_ les pages
publiques**, donc caché lui aussi (`'use cache'` + `cacheTag`). Son tag doit être invalidé par
`updateTag` à deux endroits — au changement de menu, et à la publication ou dépublication d'une page
en s04. C'est une **invalidation croisée entre deux `cacheTag`** : l'oublier côté s04 est le défaut
qui produit une entrée de menu vers une page 404, et il ne se voit pas en développement, où le cache
est froid.

s34 s'appuie sur cette story : « désactivé, la page n'existe pas et aucune navigation n'y renvoie ».
Un module désactivé ne doit pas laisser d'entrée de menu morte.

Cimetière : pas de menu par rôle ni de navigation conditionnelle au membre connecté — le menu public
est le même pour tous. La navigation du back-office n'est pas du contenu : elle appartient au socle.

---

## Story s05-actualites — Publier une actualité

**En tant que** membre du bureau **je veux** publier des actualités datées
**afin d'**informer les membres et les visiteurs de la vie de l'association.

### Complexity

2

### Acceptance criteria

- [ ] Le bureau crée une actualité (titre, date, image, contenu) et la voit apparaître en tête de la liste publique une fois publiée.
- [ ] La liste publique est triée par date décroissante et paginée ; chaque actualité a sa page dédiée avec une URL stable.
- [ ] Une actualité en brouillon n'apparaît ni dans la liste ni à son URL pour un visiteur.
- [ ] Les actualités d'une association ne sont jamais visibles sur le site d'une autre.

### Dependencies

s04

### Agentic notes

Réf. `V5 §4.1` (mini-blog), `CDCT §4.1`. Réf. `PRD`, ligne « Actualités de l'association (mini-blog daté) », complexité 2 — ajoutée au
périmètre en revue du découpage. Elle sert aussi le critère de succès « le bureau crée, modifie et publie une page, une actualité et une analyse d'eau
sans aucune intervention du prestataire », qui nomme explicitement l'actualité.

Mêmes briques que s04 (éditeur, stockage, cache) :
réemployer les composants créés par s04 au lieu d'en dériver une variante.

Modèle de contenu répétable — le troisième du produit avec les analyses d'eau (s09) et les fiches de
bureau (s06). Si un motif commun se dégage à la conception, le factoriser **maintenant**, avant que
s09 ne fige une troisième implémentation divergente.

---

## Story s06-presentation-bureau — Présenter les membres du bureau

**En tant que** membre du bureau **je veux** tenir à jour l'organigramme et les fiches du bureau
**afin que** la page de présentation reste juste après chaque renouvellement.

### Complexity

2

### Acceptance criteria

- [ ] Le bureau crée, modifie, réordonne et supprime des fiches (nom, rôle, photo, biographie courte) depuis le back-office.
- [ ] La page publique affiche les fiches dans l'ordre défini par le bureau, avec la photo redimensionnée et un texte alternatif.
- [ ] Retirer une fiche la fait disparaître de la page publique ; les fiches restantes se renumérotent sans trou dans l'ordre d'affichage.
- [ ] Une fiche sans photo affiche un visuel de repli, pas une image cassée.

### Dependencies

s04

### Agentic notes

Réf. `V5 §4.1` (« organigramme et présentation de chaque membre, mis à jour dynamiquement »),
`CDCT §4.1` — explicitement **pas une simple page statique** : sous-modèle listable et éditable.
Réf. `PRD`, ligne « Présentation du bureau (fiches listables et éditables) », complexité 2 — ajoutée
au périmètre en revue du découpage, en appui du « Why kill it » n°2 (« une vitrine publique éditable
et référencée ») et du critère « le bureau doit pouvoir tout éditer sans intervention du
prestataire ».

À ne pas confondre avec la fiche membre propriétaire (s12) ni avec la page « Contacts utiles », qui
est du contenu CMS ordinaire (s04). Trois choses distinctes.

Le nombre de membres affiché sur la page de présentation de l'association (calculé depuis la base ou
saisi à la main) est une question ouverte de `CDCT §4.1` : la trancher en `/ks-design`, la saisie
manuelle étant le choix de repli si la base membres n'existe pas encore à ce stade.

---

## Story s07-bandeau-alerte — Afficher une alerte sur tout le site

**En tant que** membre du bureau **je veux** activer un bandeau d'alerte sur l'ensemble du site
**afin de** prévenir immédiatement d'une coupure d'eau ou de travaux.

### Complexity

1

### Acceptance criteria

- [ ] Activer le bandeau avec un message l'affiche sur toutes les pages du site existantes, publiques comme authentifiées.
- [ ] Modifier le message met à jour le bandeau immédiatement, sans redéploiement.
- [ ] Désactiver le bandeau le retire de toutes les pages.
- [ ] N'importe quel membre du bureau peut l'activer, le modifier et le retirer, sans restriction supplémentaire.

### Dependencies

s01, s03b

### Agentic notes

Réf. `V5 §4.2`, `CDCT §4.2`. Volontairement sans workflow : pas de validation, pas de programmation
horaire.

✅ **Niveaux de gravité : arbitrage rendu le 23/09/2026 — un seul niveau, non refermable.** Le bureau
ne veut qu'un bandeau. La décision est inscrite dans `docs/prd.md` et dans `docs/design-system.md`
§2.3, qui décrit désormais le niveau unique et relègue les trois niveaux en extension documentée,
hors périmètre V1. Les critères ci-dessous sont inchangés : ils n'exerçaient déjà qu'un seul niveau.
Le raisonnement qui a mené là est conservé ci-dessous, parce qu'il reste valable si le bureau veut y
revenir à l'usage.

⚠️ **Historique de l'arbitrage — propriétaire unique, `/ks-prd`.** Le CDC n'en demande
pas et le PRD porte cette ligne en complexité 1, d'où le parti pris d'origine — un seul niveau. Mais
le design system §2.3 en spécifie trois, dont un **non refermable**, avec un argument qui n'est pas
décoratif pour une ASL dont l'objet est l'eau : « une eau impropre à la consommation n'est pas une
préférence d'affichage ». Les critères ci-dessus n'exercent qu'un seul niveau.

Passer à trois est un **élargissement de périmètre**, donc une décision de `/ks-prd` — et de lui
seul. Une version antérieure de cette note l'attribuait simultanément à `/ks-design` et à `docs/prd.md` ;
`/ks-design` ne peut pas à la fois décider et ne pas décider (C-10). `/ks-design` reçoit l'arbitrage
déjà tranché et le met en forme. Ne pas choisir en silence à l'implémentation. Relevé en revue du
découpage (F-10, puis C-10).

Le bandeau se pose dans le **gabarit commun**, pas page par page : c'est ce qui le fait apparaître
sur les pages ajoutées par les stories ultérieures sans y revenir. Propriété de conception à vérifier
en review — le critère, lui, ne porte que sur les pages existant à la livraison.

Piège cache : le bandeau apparaît dans le layout de pages prerendues. Le rendre dynamique casserait
le prerender de tout le site ; le mettre en `'use cache'` avec un `cacheTag` invalidé par
`updateTag` à l'activation est le seul chemin qui tienne les deux exigences (immédiateté + pages
statiques). Voir `.claude/rules/01-presentation/rule-react-cache-next-cache.md`.

---

## Story s08-formulaire-contact — Écrire au bureau depuis le site public

**En tant que** visiteur **je veux** envoyer un message au bureau depuis le site
**afin de** poser une question sans avoir de compte.

### Complexity

2

### Acceptance criteria

- [ ] Un envoi valide enregistre le message, affiche une confirmation et notifie par email l'adresse paramétrée du tenant.
- [ ] Un envoi invalide (email mal formé, message vide) affiche les erreurs par champ, n'enregistre rien et n'envoie aucun email.
- [ ] Le bureau consulte en back-office la liste des messages reçus, triée par date, avec le détail de chaque message.
- [ ] Changer l'adresse de notification dans les paramètres (s02) redirige le message suivant vers la nouvelle adresse.

### Dependencies

s02, s04

### Agentic notes

Réf. `V5 §4.1, §4.6`, `CDCT §4.1`. Exigence explicite : **l'email ne suffit pas**, le message doit
être persisté et consultable en BO. Un agent qui n'implémente que la notification rate la story.

Adresse par défaut = celle de la présidente, lue dans les paramètres du tenant (s02), jamais en dur.

Distinct du formulaire « Questions au bureau » de l'espace membre (s22), qui est identifié et routé
par catégorie. Ne pas fusionner les deux modèles.

**Scindée le 24/09/2026, au moment du plan.** La limitation de débit des formulaires publics est
partie dans **s08b**, qui suit immédiatement. Motif : le plan atteignait neuf tâches pour une story
cotée 2, et la moitié « limitation » est exactement la ligne PRD « Limitation de débit des formulaires
publics », celle que s10 réemploie. L'ordre compte : s08 puis s08b est livrable, l'inverse ne l'est
pas — un limiteur sans formulaire ne protège rien.

Le boilerplate a `src/db/models/user-submission-model.ts` — vérifier s'il convient avant d'en créer
un nouveau. Server Action : suivre `rule-safe-server-action` et `rule-form-front-and-back`
(validation Zod partagée client/serveur, messages traduits).

---

## Story s08b-limitation-debit-formulaires — Protéger les formulaires publics du spam

**En tant que** membre du bureau **je veux** que les formulaires publics soient protégés du spam
**afin de** ne pas passer mon temps bénévole à trier des messages automatiques.

### Complexity

1

### Acceptance criteria

- [ ] Au-delà d'un nombre d'envois par heure et par visiteur fixé en paramètre de tenant, une soumission supplémentaire est refusée avec un message explicite ; en deçà du seuil, elle passe.
- [ ] Le compteur repose sur une empreinte d'adresse IP hachée : aucune adresse IP en clair n'est écrite en base.
- [ ] Une opération de purge supprime toute empreinte de plus de 24 h et n'en touche aucune autre ; elle s'exécute à chaque soumission et peut être appelée seule, hors de toute soumission — vérifié par un test sur des empreintes de part et d'autre des 24 h.

### Dependencies

s08

### Agentic notes

**Issue de la scission de s08**, décidée le 24/09/2026 au moment du plan : les trois critères
ci-dessus viennent de s08, mot pour mot. Le plan complet est déjà écrit — voir
`docs/plans/s08b-limitation-debit-formulaires.md`, tiré de celui de s08.

Réf. `PRD`, ligne « Limitation de débit des formulaires publics » (complexité 1), ajoutée au périmètre
en revue du découpage : un formulaire public sans protection est une porte ouverte au spam, qui
coûterait au bureau bénévole exactement le temps que le produit prétend lui rendre. Deux garde-fous
imposés par le PRD : compteur sur empreinte hachée et purge sous 24 h, pour ne pas faire entrer un
journal d'adresses IP — donnée personnelle sans règle de rétention — dans le produit. Rien à exporter
en s38 de ce fait.

**Un seul limiteur pour tout le produit.** s03 a déjà `rate_limit_event`, compté par jour calendaire.
Cette story le généralise — fenêtre horodatée, empreinte par usage, seuil en paramètre d'association —
au lieu d'en créer un second : **s10 doit réemployer celui-ci**, et deux tables rendraient le
troisième critère ambigu (« n'en touche aucune autre »). s03 garde son comportement.

**Qui déclenche la purge.** Une purge déclenchée seulement par une nouvelle soumission ne suffit pas :
sans trafic, les empreintes restent. Aucun déclencheur périodique n'existe encore — le cron système
arrive en s12b, le planificateur de l'ADR 006 en s26. Mécanisme retenu, par étapes : cette story
livre l'**opération de purge**, appelable seule (critère ci-dessus) et exécutée à chaque soumission ;
**s12b** en planifie l'appel quotidien sur le serveur, avant toute mise en ligne publique ; s26 peut
la reprendre dans `scheduled_job` sans changer l'opération. En développement, l'absence d'appel
périodique est sans conséquence : aucune adresse réelle n'y passe.

⚠️ **La RLS est forcée** : la purge s'exécute hors requête, donc sans association active, et une
suppression sans scope ne supprime rien **sans lever d'erreur**. Elle boucle sur les associations
sous `withTenant` ; `withRlsBypass()` est un point d'arrêt de revue.

---

## Story s09-analyses-eau — Publier un résultat d'analyse d'eau

**En tant que** membre du bureau **je veux** publier rapidement un résultat d'analyse d'eau
**afin que** tout visiteur puisse le consulter sans compte.

### Complexity

2

### Acceptance criteria

- [ ] Publier une analyse (date, affiche, texte facultatif, PDF) la fait apparaître en tête de la page publique des analyses.
- [ ] Le PDF se télécharge depuis la page publique sans authentification.
- [ ] Le texte est facultatif : une publication sans texte affiche la date, l'affiche et le lien du PDF, sans bloc vide ni libellé orphelin.
- [ ] Le formulaire de saisie ne demande que les quatre champs (date, affiche, texte facultatif, PDF) et publie en une seule soumission, sans étape intermédiaire.
- [ ] Les analyses sont listées par date décroissante et une analyse ne fuit pas vers une autre association.

### Dependencies

s04

### Agentic notes

Réf. `V5 §4.4`, `CDCT §4.4`. Publication **au moins mensuelle** par des bénévoles : l'exigence
dominante est la rapidité de saisie, pas la richesse du formulaire. C'est un critère de recette
(« le bureau publie une analyse d'eau sans intervention du prestataire »), donc un critère de design
autant que de code — à éprouver en `/ks-design`.

C'est un pilier de l'angle n°3 du PRD (contenu consultable **sans compte**) : la page ne doit jamais
passer derrière l'authentification, même par héritage de layout.

Stockage PDF : même adaptateur que s04, posé par s01b (pas Supabase, ADR 004). Servir le PDF sans
exposer un chemin devinable vers d'autres fichiers du tenant.

---

## Story s10-signalements-publics — Signaler une fuite ou un incident

**En tant que** visiteur **je veux** signaler une fuite ou un incident sans compte
**afin que** le bureau intervienne vite.

### Complexity

3

### Acceptance criteria

- [ ] Un signalement valide (catégorie, localisation, description, coordonnées facultatives) est enregistré, confirmé à l'écran et notifié par email aux adresses paramétrées du tenant.
- [ ] Le signalement apparaît dans une file de suivi en back-office avec le statut initial `signalé`.
- [ ] Le bureau fait passer un signalement de `signalé` à `en cours` puis à `résolu` ; chaque changement est horodaté et attribué à son auteur.
- [ ] Les catégories de signalement (fuite, voirie, éclairage, nuisance…) sont administrables par le bureau, pas figées dans le code, dans la limite de 10 ; la 11e est refusée avec un message explicite.
- [ ] Supprimer une catégorie ne supprime pas les signalements déjà reçus dans cette catégorie.
- [ ] Une catégorie peut porter une adresse de routage optionnelle : renseignée puis relue, elle revient inchangée ; laissée vide, elle se lit comme absente et non comme une chaîne vide.
- [ ] Modifier les adresses de notification dans les paramètres (s02) change les destinataires du signalement suivant.
- [ ] Un signalement public est enregistré sans lien vers un membre, même lorsque les coordonnées saisies correspondent exactement à celles d'un membre existant (aucun rapprochement automatique).
- [ ] Le formulaire public est soumis à la même limitation de débit que le formulaire de contact (s08b) : au-delà du seuil du tenant, une soumission supplémentaire est refusée avec un message explicite ; en deçà, elle passe.

### Dependencies

s02, s04, s08b

### Agentic notes

Réf. `V5 §4.3, §4.6`, `CDCT §4.3, §4.6`.

La ligne « Limitation de débit des formulaires publics » du PRD est **au pluriel** : elle couvre
autant ce formulaire que celui de s08. Réutiliser le limiteur livré par s08 (empreinte d'IP hachée,
purge sous 24 h), ne pas en écrire un second. C'est le seul autre formulaire ouvert sans compte du
produit — le laisser sans protection rouvrirait le vecteur de spam que la ligne ferme. Le PRD **généralise** au-delà de la fuite d'eau (voirie,
éclairage, nuisance) : le modèle est un signalement catégorisé, pas une table `fuites`. La V5 parle
déjà de « fuite ou d'incident » au §5.6.

Deux destinataires par défaut chez La Fourche (contact général + responsable forage), tous deux
**paramétrables** (s02) car « susceptibles de changer au fil des années ».

**Cette story possède le modèle de catégories du produit.** C'est la première à en avoir besoin, donc
c'est ici qu'il se conçoit générique — `{nom, email_destination?}`, plafond 10, administrable en BO,
avec un discriminant de domaine. s23 (questions au bureau) et s35 (petites annonces) le **réutilisent**
avec leur propre domaine ; aucune des deux ne le réimplémente. La propriété était en recouvrement
entre s10 et s23 en revue du découpage : elle est tranchée ici, au premier arrivé.

Le champ `email_destination` n'est pas utilisé par les signalements, dont les destinataires viennent
des paramètres du tenant (s02) : il est prévu pour s23. Le porter dès maintenant évite une migration, et
le critère d'aller-retour ci-dessus le prouve **ici** : une story ne doit pas livrer un champ qu'elle
ne teste pas, même quand son usage métier arrive plus tard. s23 en prouvera l'usage (le routage),
cette story en prouve la persistance.

Cette story livre la version **publique anonyme**. La version membre identifiée avec suivi de statut
est s22 et réutilise ce modèle et ce workflow — concevoir le lien vers un membre comme nullable dès
maintenant pour éviter une migration en s22.

---

## Story s11-seo — Rendre le site référençable

**En tant que** visiteur **je veux** trouver le site de l'association dans un moteur de recherche
**afin d'**accéder à ses informations sans en connaître l'adresse.

### Complexity

2

### Acceptance criteria

- [ ] Le sitemap liste toutes les pages publiées du tenant et aucune page en brouillon ; publier une page l'y ajoute.
- [ ] Chaque page publique expose un titre, une description et des métadonnées de partage renseignés par le bureau, avec un repli sur les valeurs du tenant si le champ est vide.
- [ ] `robots.txt` autorise l'indexation des pages publiques et exclut toute route authentifiée, back-office compris, par un préfixe qui couvre aussi les routes ajoutées ensuite.
- [ ] Le code de vérification Search Console est un paramètre de tenant, saisissable en back-office.
- [ ] Chaque association sert son propre sitemap et ses propres métadonnées sur son propre domaine.

### Dependencies

s02, s04, s05, s09

### Agentic notes

Réf. `V5 §4.5`, `CDCT §4.5`. Le boilerplate a déjà `src/app/sitemap.ts` et `src/app/robots.ts` : les
rendre conscients du tenant et du cycle de publication, ne pas repartir de zéro.

Aucune logique propre — c'est du réglage par tenant, d'où la complexité 2. Placée après les stories
de contenu parce qu'un sitemap sans contenu à indexer n'est pas testable.

---

# Bloc B — Espace membres (nov 2026)

## Story s12-membres-parcelles — Rattacher un membre à ses parcelles

**En tant que** membre du bureau **je veux** gérer les propriétaires et leurs parcelles avec les
périodes de propriété **afin que** l'historique reste attaché au bon propriétaire après une vente.

### Complexity

4

### Acceptance criteria

- [ ] Le bureau crée un membre (identifiant autogénéré, indépendant du numéro de parcelle **et** de l'email) et lui rattache une ou plusieurs parcelles avec une date de début de propriété.
- [ ] Enregistrer une vente clôture la période de propriété du vendeur et ouvre celle de l'acquéreur, sans supprimer ni modifier la période close.
- [ ] Le propriétaire d'une parcelle se lit à une date donnée : pour une parcelle vendue, une date antérieure à la vente renvoie l'ancien propriétaire et une date postérieure le nouveau — vérifié par un test sur une parcelle vendue. Le rattachement des relevés (s18) et des documents (s32) s'appuie sur cette lecture datée et se vérifie dans ces stories, qui en portent le critère ; celui des factures se vérifie en s19, qui en porte le critère.
- [ ] Une parcelle ne peut pas avoir deux propriétaires sur des périodes qui se chevauchent ; la tentative est refusée avec un message explicite.
- [ ] Un membre possédant plusieurs parcelles est un seul compte, avec la liste de ses parcelles.
- [ ] Le bureau saisit et met à jour les coordonnées d'un membre depuis sa fiche : adresse postale, téléphone, adresse email — y compris pour un membre qui n'a pas de compte.
- [ ] Le bureau crée une fiche membre **sans adresse email** : la fiche existe, aucun compte de connexion n'est créé, et elle est marquée « joignable par courrier uniquement ».
- [ ] Une fiche marquée « joignable par courrier uniquement » et dépourvue d'adresse postale est signalée comme incomplète dans la liste des membres : elle ne serait joignable par aucun canal.
- [ ] Renseigner une adresse email sur une fiche « courrier uniquement » lui ouvre un compte connectable ; la retirer referme l'accès sans supprimer la fiche ni son historique.
- [ ] Un membre ne voit que ses propres parcelles ; l'accès à la fiche d'un autre membre est refusé.

### Dependencies

s01, s03, s03b

### Agentic notes

Réf. `V5 §5.1`, `CDCT §5.1`. **Cœur du modèle de données du produit** — tout le bloc B en dépend.

Risque (complexité 4) : ce n'est pas une clé étrangère `parcelle → membre_actuel`, mais une relation
**datée** (période de propriété). Le piège classique de l'agent est de coder la FK simple, qui passe
tous les tests naïfs et casse silencieusement le jour de la première vente. Le test de la parcelle
vendue est le test qui compte — l'écrire en premier (`tdd-skill`).

Résolution du propriétaire « au moment des faits » : prévoir dès maintenant la fonction qui, pour une
parcelle et une date, retourne le propriétaire d'alors. s18, s19, s28 et s32 l'appellent toutes.

**L'adresse postale est produite ici, et nulle part ailleurs.** s16 ne couvre que le self-service
d'un membre **connecté** — or les ~100 membres joignables par courrier n'ont, par construction, aucun
compte. Sans saisie côté bureau, le publipostage de s28 n'aurait aucune adresse à imprimer : c'est le
défaut relevé en revue du découpage, qui rendait inexécutable l'angle n°2 du PRD. Le critère de fiche
incomplète est ce qui rend la lacune visible en s12 plutôt qu'en s28, quinze stories plus loin.

**Frontière avec s16** : le bureau saisit et corrige les coordonnées de n'importe quel membre (ici) ;
un membre connecté corrige les siennes (s16). Même modèle, deux points d'entrée — pas deux modèles.

**Frontière avec s03** : s03 possède le cycle de vie du compte de connexion (ouverture, fermeture,
lien magique) ; s12 possède la fiche membre, ses coordonnées et son attribut « a une adresse email ». Le critère
d'ouverture/fermeture ci-dessus **appelle** la capacité de s03, il ne la réimplémente pas. Une
seconde implémentation de l'ouverture de compte dans s12 serait un défaut de review.

Le marquage « joignable par courrier uniquement » est un **attribut du modèle membre, porté ici** et
non par l'import (s13) : le bureau crée des fiches à la main tout au long de la vie de l'association
— une parcelle vendue à un acquéreur sans email est le cas nominal, pas l'exception. C'est ce champ
que s28 (publipostage) et s25 (cibles de campagne) consomment ; sans lui en s12, un membre créé
manuellement disparaîtrait des deux canaux de communication. Défaut relevé en revue du découpage.

Ne pas déduire l'absence d'email d'une chaîne vide, et ne pas la contourner par une adresse fictive :
une adresse inventée casse à la fois le ciblage des campagnes et la complétude du publipostage
(email ∪ courrier = toute la cible).

L'identité du membre est une **clé primaire arbitraire** (`V5 §5.1`), et c'est elle que référencent
toutes les autres tables. Ni l'email ni le numéro de parcelle ne sont une identité : le premier est
absent chez 100 membres sur 400 et peut changer, le second se transmet à la vente — l'utiliser comme
clé ferait justement transférer l'historique que le modèle daté sert à retenir. C'est le même
raisonnement que pour la parcelle, appliqué à l'email.

**Bloquant conformité** : la règle « accès coupé une fois la cotisation soldée, données conservées »
(`V5 §5.1`) attend un arbitrage RGPD. Cette story livre **le modèle daté et la conservation** ; elle
ne code **ni purge, ni coupure automatique d'accès**. Le noter dans le plan pour que la review ne
le compte pas comme un manque.

Ne pas agréger les factures ici : c'est Pennylane qui produit la facture consolidée du membre
multi-parcelles (s19/s20), le site n'agrège rien.

---

## Story s12a-retrait-supabase — Se passer de Supabase

⚠️ **Story hors du tableau de périmètre du PRD**, comme s12b et s12c. Elle ne porte aucune ligne du
tableau, mais elle solde la seconde moitié d'une **contrainte explicite du PRD** : « le stockage de
fichiers du boilerplate (Supabase) et l'email (Resend) devront être remplacés ». s03 a fermé le volet
email (contrat `EmailTransport`), s01b a posé l'adaptateur `local` — mais rien ne **retirait**
Supabase. Décidée le 2026-09-20, après la livraison de s03, en dressant la liste des paramétrages du
premier déploiement.

⚠️ **Identifiant intercalé, dérogation assumée** : `s12a` partage son préfixe avec s12, s12b et s12c
sans dépendre de s12. L'id porte l'ordre d'exécution, pas une parenté. Conséquence connue
(`AGENTS.md`) : un nom approximatif comme `s12` ne se résout plus tout seul — taper l'identifiant
complet ou le slug.

**En tant que** prestataire (SuperAdmin) **je veux** que l'application démarre et serve les fichiers
sans compte Supabase **afin que** la mise en ligne ne dépende pas d'un service que le produit
n'utilise plus.

### Complexity

2

### Acceptance criteria

- [ ] Le build de production démarre et sert le site d'une association **sans aucune variable Supabase définie** — vérifié en lançant le serveur avec ces variables absentes de l'environnement.
- [ ] Les deux écrans d'envoi d'image hérités du boilerplate — logo d'organisation (`src/components/features/organization/`) et avatar d'utilisateur (`src/components/features/user/`) — sont **retirés** avec leurs actions et leurs tests : plus aucune route de l'application n'offre d'envoyer une image vers Supabase, et les parcours e2e existants passent toujours.
- [ ] Aucun module de `src/` n'importe `@supabase/*` — vérifié par un test de garde, sur le modèle de `provider-imports.test.ts` pour les fournisseurs d'email.
- [ ] Les paquets `@supabase/*` ne figurent plus ni dans `package.json` ni dans le lockfile, et `pnpm install --frozen-lockfile` passe.
- [ ] Les variables `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_BUCKET` ont disparu de `src/env-schemas.ts`, `src/env.ts`, `env.example`, `scripts/init-env.ts` et `.github/workflows/ci.yml` ; un environnement qui les définit encore démarre sans erreur (elles sont simplement ignorées).
- [ ] Un `STORAGE_TYPE` absent donne l'adaptateur `local`, jamais `supabase`.
- [ ] Aucune règle ni page de documentation ne décrit plus un flux de fichiers vers Supabase : `.claude/rules/01-presentation/rule-upload-file.md` et ses copies `.cursor` ne citent que l'adaptateur `local`, les notes de s16 ne renvoient plus à l'écran de coordonnées supprimé, et `pnpm check:rules` passe.

### Dependencies

s01b

### Agentic notes

**À livrer avant s12b** : la mise en ligne n'a pas à porter les variables d'un service que le produit
n'utilise plus, et la checklist de déploiement s'en trouve raccourcie d'autant.

Réf. `ADR 004` (fichiers sur le disque du VPS, en remplacement de Supabase Storage), `ADR 015`
(fichiers d'identité), `.claude/rules/01-presentation/rule-upload-file.md`.

**État d'entrée vérifié le 2026-09-20.** L'adaptateur `local` existe depuis s01b et sert le logo et
le favicon des associations. Mais Supabase est toujours câblé, à trois endroits :

- `src/env-schemas.ts` **exige** `SUPABASE_ANON_KEY` côté serveur, `NEXT_PUBLIC_SUPABASE_URL` et
  `NEXT_PUBLIC_SUPABASE_BUCKET` côté client : sans elles, l'application refuse de démarrer, alors
  qu'elle ne s'en sert plus pour son propre besoin ;
- `src/lib/files/storage/env.ts` déclare `STORAGE_TYPE: z.enum(['supabase', 's3']).default('supabase')`,
  et `src/db/repositories/files-repository.ts` construit son stockage à partir de cette valeur **au
  chargement du module** ;
- deux formulaires hérités appellent encore `uploadImageForEntityService` :
  `src/components/features/organization/action.ts` (logo d'organisation) et
  `src/components/features/user/action.ts` (avatar). Ce sont eux qui écriraient vers Supabase.

**Le piège : rendre les variables facultatives ne suffit pas.** Sans les deux formulaires traités,
l'échec se déplacerait simplement du démarrage vers l'envoi de fichier, où il se verrait plus tard et
plus mal.

**Arbitrage rendu le 2026-09-20 : les deux écrans partent.** Le logo d'organisation du boilerplate
fait doublon avec l'identité d'association de s01b, réglée par le bureau ; l'avatar d'utilisateur
n'apparaît dans aucune story du découpage. Les retirer supprime la dernière voie d'écriture vers
Supabase au lieu de la déplacer. Conséquence à traiter dans la même story : les notes de **s16**
citent `src/components/features/user/edit-user-profile.tsx` comme référence de l'écran de
coordonnées — cette référence doit être remplacée, sans quoi s16 pointera vers un fichier absent
quinze stories plus loin.

**Ne pas déborder sur les stories de contenu.** s04 (pages du CMS) et s31 (documents partagés) posent
leurs propres flux de fichiers sur l'adaptateur `local` : cette story ne les anticipe pas, elle
retire seulement ce qui reste de Supabase.

**Documentation du boilerplate.** Les pages MDX de `src/app/[locale]/docs/` décrivent encore la
configuration Supabase. Elles appartiennent au socle hérité : les corriger ou les retirer est un
choix à porter au plan, pas un oubli à constater en revue.

**Vérification finale** : `pnpm lint`, `pnpm check:rules`, `pnpm test --run`, `pnpm build`, et la
suite e2e, qui couvre déjà l'envoi du logo d'association par l'adaptateur `local`.

---

## Story s12b-mise-en-ligne — Mettre le site en ligne

⚠️ **Story hors du tableau de périmètre du PRD**, comme s12c qui la suit. Elle ne porte aucune ligne
du tableau, mais le critère de succès « mise en production effective sur le VPS avant fin mai 2027 »
(`PRD`, Success criteria) la rend obligatoire. Décidée le 17 septembre 2026, écrite pour lever le
majeur M4 de la revue du découpage, puis séparée de la sauvegarde (s12c) par la revue suivante (M5).

**En tant que** prestataire (SuperAdmin) **je veux** déployer l'application sur un VPS **afin que**
chaque association soit servie en HTTPS sur son propre domaine.

### Complexity

3

### Acceptance criteria

- [ ] Sur le serveur déployé, le domaine d'une association provisionnée répond en HTTPS avec un certificat valide et sert le site de cette association ; un domaine inconnu répond 404 — vérifié par un test de fumée lancé contre l'URL déployée, sur deux domaines d'associations distinctes.
- [ ] Une requête HTTP (non chiffrée) vers le domaine d'une association est redirigée vers HTTPS.
- [ ] Déployer une nouvelle version applique les migrations en attente avant que la nouvelle version ne serve des requêtes ; une migration en échec interrompt le déploiement et laisse la version précédente en service.
- [ ] Un redéploiement conserve les fichiers déjà téléversés : un logo envoyé avant le redéploiement est toujours servi après.
- [ ] Après l'ajout du domaine d'une nouvelle association dans la configuration du serveur, ce domaine répond en HTTPS avec un certificat valide et sert cette association — vérifié par le même test de fumée.
- [ ] Sur le serveur déployé, la purge des empreintes des formulaires publics (s08) est appelée au moins une fois par jour sans intervention humaine : une empreinte de plus de 24 h ne survit pas à l'appel planifié suivant.

### Dependencies

s01, s01b, s03, s03c, s08b, s12a

### Agentic notes

Réf. `PRD` (Constraints : hébergement ; Success criteria : mise en production), `ADR 001` (VPS
unique infogéré par le prestataire), `ADR 003` (tenant par domaine), `ADR 004` (fichiers sur le
disque).

**Écrite pour « un VPS », sans dépendre du fournisseur.** Le premier déploiement se fait sur le VPS
personnel du prestataire, en environnement temporaire ; la production cible est le VPS LWS du
contrat. L'infogérance est celle du prestataire dans les deux cas, ce que dit déjà l'ADR 001 : pas
d'ADR nouveau pour l'hébergement. En revanche les choix techniques propres à cette story (mode de
déploiement, reverse proxy et certificats) sont des décisions structurelles : un ADR de déploiement,
tranché en `/ks-research`.

**Pas encore de domaine client** (réserve du CDCT, non bloquante). Le test de fumée tourne sur des
sous-domaines d'un domaine du prestataire, ce que l'ADR 003 prévoit explicitement pour la recette :
c'est un domaine comme un autre dans la table `organization`.

Risque (complexité 3) : quatre pièges d'exploitation, dont aucun ne se voit en développement.

**Piège n°1 — le reverse proxy et l'en-tête `Host`.** Le tenant est résolu d'après le domaine appelé
(ADR 003). Un proxy qui réécrit `Host` vers `localhost:3000` rend **toutes** les associations en 404,
sans aucune erreur ailleurs. C'est pourquoi le test de fumée porte sur deux domaines.

**Piège n°2 — le retour arrière d'une migration.** « Laisser la version précédente en service »
suppose que la migration est appliquée **avant** la bascule et qu'un échec arrête tout avant elle.
Une migration appliquée à moitié n'a pas de retour automatique : Drizzle n'écrit pas de migration
descendante. Le déploiement s'arrête donc sur l'échec, avant la bascule, et la sauvegarde de s12c
couvre le reste — ne pas promettre davantage.

**Piège n°3 — les certificats sur plusieurs domaines.** Un domaine par association, et six
associations à terme : le certificat de chaque domaine doit s'obtenir et se renouveler sans
intervention manuelle. Un certificat unique listant tous les domaines oblige à le réémettre à chaque
nouvelle association et casse tous les sites si un seul domaine échoue à la validation.

**Piège n°4 — le build.** `production.yml` et `preview.yml`, restes du boilerplate qui ne déployaient
rien, ont été **retirés du dépôt le 2026-09-20** (Quick Fix) : cette story n'a plus à les nettoyer,
mais la revue vérifiera qu'aucun workflow restant ne prétend déployer ce qu'il ne déploie pas.
`production.yml` échouait faute de secrets : sous Cache
Components, le prerender traverse les façades. Où se fait le build (sur le serveur ou en CI), avec
quelles variables, et comment le résultat arrive sur le serveur : à trancher en `/ks-research`, sans
jamais committer un `.env`. Le `Dockerfile` et le `docker-compose.yml` du dépôt servent
l'environnement de développement, pas la production (`docs/architecture.md`) : ne pas les réutiliser
tels quels.

**`BETTER_AUTH_URL` et `NEXT_PUBLIC_APP_URL` sont mono-valeur**, alors que le produit sert plusieurs
domaines. Le lien de connexion propre au domaine de chaque association est un critère de s03c, livrée
avant cette story : le déploiement ne doit pas le défaire. Ne pas figer ces variables sur le domaine
du premier tenant comme si c'était le seul, et vérifier que le mécanisme retenu en s03c (origines de
confiance, cookies) fonctionne sur le serveur réel pour les deux domaines du test de fumée.

**`LOCAL_STORAGE_ROOT` vit hors du répertoire de l'application déployée**, sur un chemin qui survit
aux redéploiements ; sinon chaque déploiement efface les fichiers, ce que le critère du logo
détecte.

**Le cron système des tâches planifiées.** Cette story y installe la purge quotidienne des empreintes
de s08, s12c y ajoute les sauvegardes et s26 le déclencheur du planificateur de l'ADR 006. Cette story choisit **où** vivent ces planifications sur le serveur et
le documente, pour que les deux suivantes n'aient pas à le chercher.

**À vérifier en review, pas en test** : qu'ajouter un domaine ne demande aucune modification du code
de l'application (c'est une propriété du diff), et que la procédure d'ajout d'un domaine et de
déploiement est écrite dans la documentation d'exploitation (c'est une propriété de la
documentation). Le critère testable est celui du nouveau domaine servi en HTTPS. De même, qu'aucun
workflow restant ne prétende déployer ce qu'il ne déploie pas : c'est une propriété du diff.

**Hors de cette story** : la sauvegarde (s12c), la supervision applicative (Sentry reste tel quel),
la montée de version du système du VPS.

---

## Story s12c-sauvegarde — Sauvegarder et restaurer les données

⚠️ **Story hors du tableau de périmètre du PRD**, pour la même raison que s12b. s13 l'attend : on
n'importe pas les données réelles de quatre cents propriétaires sur un serveur qui ne sait pas les
restaurer.

**En tant que** prestataire (SuperAdmin) **je veux** sauvegarder la base et les fichiers de toutes
les associations **afin qu'**aucune perte du serveur ne fasse disparaître leurs données.

### Complexity

3

### Acceptance criteria

- [ ] Une sauvegarde produit, pour un même horodatage, une copie de la base **et** une copie du répertoire de fichiers (`LOCAL_STORAGE_ROOT`).
- [ ] La sauvegarde contient les lignes de **tous** les tenants : après restauration, le nombre de lignes de chaque table métier est identique à celui de la base d'origine, pour chacune des associations — vérifié par un test automatisé sur deux tenants.
- [ ] Restaurer une sauvegarde sur une base vide et un répertoire vide rend une application dans laquelle **toute clé de fichier référencée en base** désigne un fichier présent — vérifié par le même test, sur l'inventaire des colonnes de clé de fichier décrit dans les notes.
- [ ] Ajouter une colonne de clé de fichier qui suit la convention de nommage, sans la déclarer à l'inventaire, fait échouer ce test — vérifié en ajoutant une colonne de contrôle.
- [ ] La sauvegarde s'exécute sans intervention humaine, à une fréquence planifiée, et ne demande aucune confirmation interactive.
- [ ] Chaque sauvegarde est copiée hors du serveur qui l'a produite ; la destination vient de la configuration, pas du code.
- [ ] Les sauvegardes plus anciennes que la durée de conservation configurée sont supprimées, sur le serveur comme à destination ; la durée vient de la configuration.
- [ ] Une sauvegarde en échec (base, fichiers ou copie distante) sort en erreur et ne produit jamais une archive partielle présentée comme réussie.
- [ ] L'absence de sauvegarde réussie dans la fenêtre attendue déclenche une alerte reçue par le prestataire hors du serveur, par un canal qui ne dépend ni de l'application ni de son adaptateur d'envoi d'emails — que la sauvegarde ait échoué ou qu'elle ne se soit pas lancée du tout.

### Dependencies

s01b, s04, s05, s06, s09, s12b

### Agentic notes

Réf. `ADR 002` (rôles et RLS), `ADR 004` (conséquences et points à vérifier : « une restauration
rendrait une base cohérente pointant vers des documents disparus »), `ADR 015`.

Les choix techniques propres à cette story (rôle de sauvegarde, outil de copie distante, canal
d'alerte) sont des décisions structurelles : un ADR, tranché en `/ks-research`.

Risque (complexité 3) : **une sauvegarde qui ne restaure pas ne se voit que le jour où on en a
besoin.** C'est pourquoi les critères portent sur la restauration et non sur la production d'un
fichier. Le test de restauration est celui qui compte — l'écrire en premier (`tdd-skill`). Il se
joue en CI sur le Postgres éphémère (`rule-ci-cd-devops`), pas sur la base de preview : seed, deux
tenants, des fichiers par tenant, sauvegarde, restauration dans une base et un répertoire vides,
comparaison.

**Piège n°1 — la RLS forcée et `pg_dump`.** `db_backup.sh` se connecte avec `DATABASE_URL`, donc
avec `asl_app`, qui ne voit rien hors d'un scope de tenant (ADR 002). Et `FORCE ROW LEVEL SECURITY`
s'applique **aussi au propriétaire des tables** : passer à `DATABASE_MIGRATION_URL` ne suffit pas
forcément. Selon le rôle et les options, `pg_dump` échoue (`row_security` désactivé face à une policy
qui s'applique) ou, pire, sort une sauvegarde **vide de toute ligne métier** — le « zéro résultat
inexpliqué » d'AGENTS.md, version catastrophe. La même question se pose à la restauration : les
insertions passent sous la policy. Trancher en `/ks-research` quel rôle sauvegarde et restaure
(rôle dédié `BYPASSRLS`, ou porte `app.bypass_rls` posée pour la session), et le prouver par le
critère de comptage sur deux tenants. Tout nouveau contournement de la RLS est un point d'arrêt de
revue : le justifier dans l'ADR.

**Piège n°2 — la base et les fichiers ne sont pas pris au même instant.** Un logo remplacé entre le
dump et la copie du répertoire laisse une clé orpheline. Ordre à retenir : base d'abord, fichiers
ensuite — un fichier en trop est inoffensif, une clé sans fichier ne l'est pas. Le critère de
restauration le vérifie.

**Inventaire des clés de fichier — pas une liste écrite dans le test.** À la livraison de cette
story, cinq familles de fichiers existent : l'identité (`identity_logo_key`, `identity_favicon_key`,
s01b), les images de blocs de page (s04), l'image d'une actualité (s05), la photo d'une fiche du
bureau (s06) et les PDF d'analyses d'eau (s09). Vérifier en `/ks-research` lesquelles ont leur propre
colonne et lesquelles réutilisent celle de s04. Le test lit la liste des colonnes de clé de fichier à
**un seul endroit** du code, que chaque story qui stocke des fichiers complète ensuite (s31, s32,
s34, s36) ; il échoue si une colonne listée n'existe pas. **Détection inverse** : adopter une
convention qui rend une colonne de clé de fichier reconnaissable dans le schéma (nommage ou
type), à trancher en `/ks-research`, et faire échouer le test sur toute colonne qui suit la
convention sans figurer à l'inventaire (critère dédié) — c'est ce qui transforme l'oubli en test
rouge, comme s39 pour l'export. Une énumération recopiée
dans le test finit par oublier une famille — c'est le défaut que s38 et s39 traitent pour l'export.

**Piège n°3 — une alerte qui passe par ce qu'elle surveille.** L'application envoie ses emails par
Brevo, derrière l'adaptateur de s03 et le budget quotidien par association de s26. L'alerte n'y
passe pas : elle ne concerne aucune association, elle ne doit pas consommer leur budget, et elle doit
partir même si l'application est tombée. Le critère vise une **absence de succès**, pas seulement un
échec signalé, parce qu'un cron qui ne tourne plus ne produit aucune erreur — c'est le « silence »
que l'ADR 006 redoute pour ses propres tâches. Un signal de vie envoyé à chaque succès vers un
service externe, qui alerte quand il cesse d'arriver, couvre les deux cas ; le choix revient à
`/ks-research`.

**Ce qui existe et s'étend, sans dupliquer** : `db_backup.sh` et `db_restore.sh` ne couvrent que
Postgres (ADR 004, conséquences). Le premier demande une confirmation au clavier et lit
`.env.production` : inutilisable par un cron en l'état. Le second porte un garde-fou
(`DATABASE_URL="dangerous"`) contre la restauration accidentelle de la production : le conserver
sous une forme équivalente, la restauration sur la production doit rester un acte délibéré.

Les sauvegardes locales, avant copie, vivent comme `LOCAL_STORAGE_ROOT` hors du répertoire de
l'application déployée (voir s12b). La planification s'installe à l'endroit choisi et documenté par
s12b.

**Configuration d'exploitation, pas paramètre d'association.** Fréquence, destination distante,
durée de conservation et fenêtre d'alerte sont des réglages du serveur (`@/env` ou configuration du
planificateur système), pas des lignes d'`organization_setting` : la règle « rien en dur » d'ADR 010
vise les valeurs propres à une association, et une sauvegarde couvre toutes les associations à la
fois. Les identifiants de la destination distante sont des secrets.

**À vérifier en review, pas en test** : qu'un exercice de restauration a été mené au moins une fois
**sur le serveur réel** avant l'import de s13, et que la documentation d'exploitation en consigne la
date et la durée. C'est une propriété de l'exploitation ; le critère testable est la restauration
automatisée en CI.

---

## Story s13-import-initial-membres — Charger la liste des membres existants

**En tant que** SuperAdmin **je veux** importer la liste des propriétaires fournie par l'association
**afin d'**ouvrir le service sans saisie manuelle de plusieurs centaines de fiches.

### Complexity

3

### Acceptance criteria

- [ ] L'import se fait depuis le back-office, par téléversement du fichier : le parcours complet (choisir l'association, déposer le fichier, lire le rapport) s'accomplit à l'écran, sans ligne de commande ni accès direct à la base.
- [ ] Importer un fichier (nom, adresse postale, email, parcelle) crée les membres, leurs coordonnées et leurs rattachements de parcelle dans le tenant visé.
- [ ] Une ligne sans adresse postale ni email est rejetée et signalée dans le rapport : le membre ne serait joignable par aucun canal.
- [ ] Plusieurs lignes portant le même propriétaire produisent **un seul** compte avec plusieurs parcelles, pas plusieurs comptes.
- [ ] Une ligne sans email crée le membre et sa parcelle, sans compte de connexion, et le marque comme joignable par courrier uniquement.
- [ ] Les lignes invalides sont rejetées ligne à ligne, listées dans un rapport, et n'empêchent pas l'import des lignes valides.
- [ ] Relancer le même import ne duplique aucun membre ni aucune parcelle.

### Dependencies

s12, s12c

### Agentic notes

Réf. `PRD` (« Import initial des membres d'une association », complexité 3), `V5 §2`, `CDCT §2`.
Import réalisé par le prestataire au démarrage, puis création unitaire par le bureau (couverte par
s12).

**Prérequis d'exploitation, hors de cette story** : avant d'importer les données réelles d'une
association, la sauvegarde de la base **et** des fichiers du disque (s01b, ADR 004) doit être
opérationnelle sur le serveur. Elle revient à s12c-sauvegarde, d'où la dépendance (revue du
découpage I-12, puis M4).

Risque (complexité 3, alignée avec le PRD) : la **clé de dédoublonnage n'est pas tranchée**, et son mode de défaillance est grave — fusionner deux propriétaires distincts leur
donnerait accès aux documents et aux factures l'un de l'autre. Ce n'est pas un import anodin : c'est
un import qui crée des identités. En cas d'ambiguïté, remonter au rapport pour arbitrage humain,
jamais fusionner d'office.

**À vérifier en review, pas en test** : qu'aucune étape du provisioning ne demande d'écrire du code.
C'est une propriété du processus, pas un comportement observable — le critère testable est celui du
parcours à l'écran.

**Pourquoi un écran et non un script** : le critère de succès du PRD exige qu'une deuxième
association soit provisionnée « sans écrire une ligne de code : uniquement configuration, activation
de modules et chargement de sa liste de membres ». Un script maintenu par le prestataire et relancé à
la main pour chaque client échouerait à ce critère — et il y a six associations à charger, pas une.
C'est ce qui justifie de chiffrer cette story au périmètre plutôt que de la traiter en opération
d'installation.

Cette story pose le **motif d'import du produit** (téléversement, validation ligne à ligne, rapport
d'erreurs, idempotence) que s17 réutilise pour les relevés d'eau. Le concevoir réutilisable ici
évite deux implémentations divergentes ; c'est aussi pourquoi s13 est ordonnée avant s17.

**Comptage tranché par le client le 6 septembre 2026** — la divergence entre `V5 §2` (300) et
`V5 §3.3` (« 100 des 400 ») est levée : **400 propriétaires au total**, dont **300 avec une adresse
email** (fiche membre + compte connectable) et **100 sans** (fiche membre, aucun compte, joignables
par courrier uniquement). L'import crée donc 400 fiches et 300 comptes.

Les deux chiffres du CDC n'étaient pas contradictoires, ils comptaient deux choses différentes :
les comptes d'un côté, les propriétaires de l'autre. C'est le total de 400 qui dimensionne la
volumétrie (s32) et la cible du publipostage (s28), pas le 300.

Ce comptage ne dispense pas du regroupement : un propriétaire de plusieurs parcelles reste **une**
fiche membre. Le critère de dédoublonnage porte sur les lignes du fichier, pas sur le total attendu.

Piège du dédoublonnage : **l'email ne peut pas être la clé de regroupement**, puisque 100 lignes n'en
ont pas et qu'un foyer peut en partager un. La clé de rapprochement des lignes du fichier est à
trancher en `/ks-research` sur le fichier réel (nom + adresse ? identifiant fourni par le bureau ?),
et elle reste une clé **d'import** : la fiche créée, elle, porte sa propre clé primaire arbitraire.
Les cas ambigus doivent remonter au rapport pour arbitrage humain plutôt que d'être fusionnés
d'office — fusionner deux propriétaires distincts leur donnerait accès aux documents l'un de l'autre.

Le marquage « joignable par courrier uniquement » est **défini en s12**, pas ici : l'import le
renseigne pour les 100 lignes sans email, il ne l'invente pas. C'est ce champ qui réintègre le quart
de membres aujourd'hui hors système (angle n°2 du PRD).

**L'adresse postale fait partie du fichier d'import**, au même titre que le nom et la parcelle : sans
elle, les 100 membres sans email entrent dans le produit sans aucun canal de contact, et le
publipostage de s28 n'a rien à imprimer. Si le fichier réel transmis par le bureau ne la porte pas,
c'est un point bloquant à remonter en `/ks-research`, pas une colonne à rendre facultative.

Ne pas confondre avec l'import des relevés d'eau (s17), qui est annuel et d'un autre format.

---

## Story s14-attribuer-roles — Désigner les membres du bureau

**En tant que** membre du bureau d'une association **je veux** attribuer et retirer les rôles sur la
fiche d'un membre **afin que** le bureau nouvellement élu puisse administrer le site sans moi.

### Complexity

2

### Acceptance criteria

- [ ] Depuis la fiche d'un membre, un membre du bureau (Bureau ou Président(e)) lui attribue le rôle Bureau ou Président(e), ou le lui retire ; le changement prend effet à la connexion suivante du membre concerné.
- [ ] Un membre promu Bureau accède au back-office ; le même membre, rôle retiré, y reçoit un refus — vérifié en interface et sur l'appel serveur direct.
- [ ] Une association a toujours au moins un compte capable d'attribuer les rôles : retirer le dernier est refusé avec un message explicite.
- [ ] Chaque attribution et chaque retrait est tracé avec son auteur, sa date, le membre visé et le rôle.
- [ ] Un membre du bureau ne peut attribuer de rôle qu'aux membres de sa propre association.
- [ ] Le rôle SuperAdmin n'est jamais attribuable depuis cet écran : il est interne à Zourite Studio.

### Dependencies

s03b, s12

### Agentic notes

Réf. `V5 §2, §3.2`, `CDCT §2`, et le critère de succès « une deuxième association est provisionnée
sans écrire une ligne de code ».

Story créée en revue du découpage : les rôles existaient (s03b) et la matrice rôle × action était
prévue (s37), mais **rien ne permettait d'attribuer un rôle à quelqu'un**. Après l'import des 400
membres, aucune story ne désignait la présidente ni les 3 à 8 bénévoles du bureau — l'association
restait administrable par le seul compte initial créé au provisioning (s01).

Le verrou du dernier compte capable d'attribuer les rôles est le pendant de celui de s37 sur la matrice : un bureau
bénévole qui se retire ses propres droits n'a aucun moyen de revenir en arrière sans le prestataire.
Ces deux verrous protègent le même scénario, à deux endroits différents.

La traçabilité n'est pas décorative : le bureau change tous les quelques années, et savoir qui a
promu qui est ce qui permet de reconstituer une situation d'accès après coup. Elle entre dans
l'export de s38 comme le reste.

Ne pas confondre avec s41 (simulation de rôle) : ici on **change** durablement les droits de
quelqu'un, là on emprunte temporairement une vue pour déboguer.

---

## Story s15-inviter-membre — Inviter un membre à rejoindre son espace

**En tant que** membre du bureau **je veux** envoyer à un membre son invitation à se connecter
**afin qu'**il sache qu'il a un espace et puisse y entrer sans que j'aie à lui expliquer au téléphone.

### Complexity

2

### Acceptance criteria

- [ ] Depuis la fiche d'un membre disposant d'une adresse email, le bureau déclenche l'envoi d'une invitation ; le membre reçoit un email portant un lien de connexion valide.
- [ ] L'email d'invitation part par le même canal transactionnel que le lien magique (s03), dont il reprend l'en-tête au logo de l'association (s01b, ou son nom à défaut), et porte le nom de l'association.
- [ ] Le texte de l'invitation est un paramètre de tenant : le modifier change l'email suivant, sans redéploiement.
- [ ] La fiche membre affiche l'état de l'invitation : jamais invité, invité le <date>, ou connecté au moins une fois le <date>.
- [ ] Inviter un membre marqué « joignable par courrier uniquement » est refusé avec un message expliquant qu'il relève du courrier, et non par une erreur technique.
- [ ] Réinviter un membre déjà invité est possible et remplace l'invitation précédente ; l'ancien lien cesse de fonctionner.
- [ ] Le bureau d'une association ne peut inviter aucun membre d'une autre.
- [ ] Le lien de l'invitation pointe vers le domaine de l'association du membre et y ouvre la session — vérifié sur deux associations.

### Dependencies

s02, s03, s03c, s12

### Agentic notes

Réf. `PRD` (ligne « Connexion par lien magique » : « flux d'invitation, expiration et absence de mot
de passe à éprouver auprès d'un public âgé »), `V5 §2, §3.3`.

Story créée en revue du découpage : ces critères vivaient dans s03, où ils opéraient sur une fiche
membre livrée par s12 — laquelle dépend de s03. La dépendance était circulaire et non exécutable.
Placée ici, la story n'invente rien : le compte et le lien magique viennent de s03, la fiche et
l'attribut « a une adresse email » viennent de s12.

**Elle n'implémente ni compte ni lien magique** : elle déclenche ceux de s03 depuis la fiche de s12.
Une seconde implémentation du lien de connexion serait un défaut de review. Le lien pointe donc vers
le domaine de l'association du membre, comme en s03c (critère dédié ci-dessus).

**L'invitation est un email transactionnel, pas une campagne.** Elle emprunte le canal du lien
magique (s03), pas le gabarit de campagne livré par s25 — qui arrive dix stories plus tard. Exiger ce
gabarit ici serait la référence en avant relevée en revue du découpage. L'en-tête au logo, lui, n'est
pas provisoire : il est posé dès s03 sur le canal transactionnel, le logo existant depuis s01b. **À vérifier en review, pas en test** : que le texte par défaut n'énumère aucune fonctionnalité
(factures, consommation, documents) livrée après cette story. C'est un jugement rédactionnel, pas un
comportement observable — le critère testable est celui du paramètre de tenant, que le bureau
enrichira au fil des mises en ligne.

L'état « connecté au moins une fois » n'est pas un confort : c'est ce qui permet au bureau de savoir
qui relancer, et à s42 de mesurer l'adoption au lancement. Il se déduit de la première connexion
réussie, pas d'un clic sur le lien — un lien cliqué par un antivirus n'est pas une connexion.

Public âgé et peu à l'aise : la rédaction de l'email compte autant que le mécanisme. Elle se traite
en `/ks-design`, et sa qualité relève de la recette, pas d'un test automatisé.

---

## Story s16-coordonnees-membre — Mettre à jour ses coordonnées

**En tant que** membre propriétaire **je veux** corriger mes informations de contact
**afin que** le bureau puisse me joindre correctement.

### Complexity

1

### Acceptance criteria

- [ ] Un membre connecté modifie ses coordonnées (adresse postale, téléphone, email de contact) et voit la valeur enregistrée après rechargement.
- [ ] Une saisie invalide affiche les erreurs par champ et n'enregistre rien.
- [ ] Un membre ne peut modifier que ses propres coordonnées : une requête visant l'identifiant d'un autre membre est refusée.
- [ ] Le bureau voit les coordonnées à jour dans la fiche du membre.

### Dependencies

s12

### Agentic notes

Réf. `V5 §5.4`, `CDCT §5.4`. CRUD simple sur ses propres données — la seule subtilité est
l'autorisation, à écrire en test d'abord (tentative sur l'id d'un autre membre).

Le dépôt a un formulaire équivalent
(`src/components/features/user/edit-user-settings.tsx`) : s'en inspirer plutôt que réinventer, en
suivant `rule-form-front-and-back` et `rule-zod-client-server-internationalization`.

Cette story ne couvre que le **self-service d'un membre connecté**. La saisie par le bureau — seule
voie possible pour les membres sans compte — appartient à s12. Ne pas réimplémenter le formulaire :
c'est le même modèle de coordonnées, vu depuis l'espace membre.

Attention : changer l'email de contact ne doit pas changer silencieusement l'identifiant de
connexion (s03) — trancher explicitement en `/ks-design` et écrire le test correspondant.

---

## Story s17-import-releves-eau — Importer les relevés d'eau annuels

**En tant que** membre du bureau **je veux** importer le fichier annuel des relevés de compteurs
**afin que** chaque membre retrouve sa consommation sans ressaisie.

### Complexity

3

### Acceptance criteria

- [ ] Importer un fichier Excel/CSV valide enregistre les relevés et affiche un récapitulatif (lignes traitées, membres concernés, période).
- [ ] Les lignes erronées (parcelle inconnue, valeur non numérique, index en régression, doublon) sont rejetées individuellement et détaillées avec leur numéro de ligne.
- [ ] Un rapport d'erreurs est **envoyé par email** à l'adresse paramétrée du tenant, pas seulement affiché ni journalisé côté serveur.
- [ ] Un relevé est rattaché au propriétaire de la parcelle à la date du relevé, pas au propriétaire actuel.
- [ ] Réimporter le même fichier ne crée pas de doublon de relevés.

### Dependencies

s02, s12, s13

### Agentic notes

Réf. `V5 §5.5`, `CDCT §5.5`. Fréquence annuelle, fichier déjà nettoyé par le bureau en amont : le
site n'a pas à corriger les données, seulement à valider et rapporter.

**Bloquant** : le format exact dépend du modèle imposé par Pennylane. `CDCT §5.5` est explicite —
**ne pas coder le parseur avant réception d'un fichier exemple**. `/ks-research` commence par
vérifier que le fichier est arrivé ; sinon, la story attend. Le reste (rattachement daté, rapport
d'erreurs, idempotence) est indépendant du format et peut être conçu dès maintenant derrière une
frontière de parsing isolée.

Parseur de fichiers tabulaires : brique tierce assumée (`CDCT §1.1`), pas de développement maison.

Réutiliser le motif d'import posé par s13 (téléversement en back-office, validation ligne à ligne,
rapport d'erreurs, idempotence) : seules la grammaire du fichier et la cible changent. Un second
mécanisme d'import serait une divergence, pas une spécialisation.

Le rattachement daté est le point où le modèle de s12 se prouve : écrire le test « relevé importé
pour une parcelle vendue en cours d'année » avant le code.

---

## Story s18-historique-consommation — Consulter sa consommation d'eau

**En tant que** membre propriétaire **je veux** voir l'historique de ma consommation d'eau
**afin de** suivre mes relevés et repérer une dérive.

### Complexity

2

### Acceptance criteria

- [ ] Un membre connecté voit un tableau de ses relevés par année, avec la consommation de la période.
- [ ] Un membre multi-parcelles voit le cumul de ses parcelles, avec le détail par parcelle.
- [ ] Un membre ne voit aucun relevé d'un autre membre, y compris en forgeant l'identifiant dans l'URL ou l'appel serveur (test d'autorisation croisée).
- [ ] Après la vente d'une parcelle, l'ancien propriétaire conserve les relevés antérieurs à la vente et ne voit pas les suivants ; le nouveau voit l'inverse.
- [ ] Un membre sans relevé importé voit un message d'attente explicite, pas un tableau vide sans explication.

### Dependencies

s17

### Agentic notes

Réf. `V5 §5.5`, `CDCT §5.5`. C'est **l'angle n°1 du PRD** (la ressource individuelle mesurée) qui
devient visible pour la première fois : le soin porté à la lisibilité du tableau compte autant que
l'exactitude du calcul.

Le critère d'autorisation croisée est un critère de succès explicite du PRD (« et à rien qui
appartienne à un autre membre »). Il est vérifié ressource par ressource : ici, en s18, s20, s22,
s24 et s32.

Piège cache : donnée par utilisateur — **jamais** de `'use cache'`. Lecture derrière `<Suspense>`
avec le motif `'use cache: private'` du DAL décrit dans
`.claude/rules/01-presentation/rule-react-cache-next-cache.md`. Ne jamais exporter une fonction
cachée prenant un `memberId` en argument : un appelant pourrait demander les données d'un autre.

---

## Story s19-factures-liste — Consulter ses factures

**En tant que** membre propriétaire **je veux** voir la liste de mes factures et leur statut
**afin de** savoir ce que je dois et récupérer mes justificatifs.

### Complexity

3

### Acceptance criteria

- [ ] Un membre connecté voit ses factures (date, objet, montant, statut) triées par date décroissante.
- [ ] Le statut est affiché tel qu'il est fourni par la source, y compris les statuts intermédiaires — jamais réduit à payé/impayé.
- [ ] Une facture porte une **date d'échéance**, distincte de sa date d'émission ; c'est elle qui datera les relances (s29).
- [ ] La configuration du tenant désigne lesquels des statuts de la source valent « impayé » ; le prédicat « impayé » qui en découle est lisible et testable depuis cette story.
- [ ] Un statut jamais vu (nouvelle valeur côté source) n'est **pas** considéré comme réglé par défaut : il est signalé au bureau comme à classer, et la facture reste hors de la cible des relances tant qu'il ne l'est pas.
- [ ] Un membre ne voit aucune facture d'un autre membre, y compris en forgeant l'identifiant (test d'autorisation croisée).
- [ ] Une facture est rattachée au membre facturé (sa clé primaire), jamais à la parcelle : sur une parcelle vendue, les factures émises avant la vente restent visibles du vendeur et invisibles de l'acquéreur, et celles émises après la vente visibles de l'acquéreur seul — vérifié par un test sur une parcelle vendue.
- [ ] Le bureau saisit et met à jour manuellement une facture pour un membre, et le membre la voit apparaître.
- [ ] Le service de facturation est appelé derrière une interface : changer d'implémentation ne demande aucune modification de la présentation (prouvé par un test doublant l'implémentation).

### Dependencies

s02, s12

### Agentic notes

Réf. `V5 §5.2`, `CDCT §5.2`, `PRD` (« derrière une interface interchangeable, car toute ASL a besoin
de la fonction mais pas forcément de Pennylane »).

Cette story livre **l'interface et l'implémentation manuelle** — délibérément indépendante de la
réserve Pennylane, pour que le bloc B ne soit pas bloqué par une condition suspensive du devis.
L'implémentation Pennylane est s20 et ne doit rien changer ici.

Piège de conception : ne pas modéliser le statut en booléen ni en énumération fermée déduite des
seuls statuts connus aujourd'hui — Pennylane en remonte davantage, et ils doivent passer tels quels.

**Deux notions à ne pas confondre, et c'est cette story qui les tient** : le _statut_ est opaque et
affiché tel quel ; le _prédicat « impayé »_ est une dérivation, déclarée en configuration de tenant.
s21 (bouton de paiement), s27 (cible « impayés ») et s29 (relances) consomment ce prédicat et ne
doivent jamais réinterpréter un statut eux-mêmes — sinon trois lectures divergentes du même fait, et
une valeur codée en dur que la règle transverse interdit. Défaut relevé en revue du découpage, où le
prédicat n'appartenait à personne.

Le comportement sur statut inconnu est délibérément prudent : relancer à tort un membre à jour est
pire que rater une relance, sur une population âgée et bénévole.

**L'échéance est portée ici** parce que c'est la seule story qui possède le modèle de facture. Sans
elle, le calendrier « 3, 2 puis 1 semaine » de s29 n'a aucune ancre — défaut relevé en même temps.
Si la source ne fournit pas d'échéance, la saisie manuelle doit la permettre : c'est une donnée du
produit, pas un reflet de Pennylane.

Ne jamais confondre avec la facturation **plateforme** (Stripe, Zourite Studio ↔ association) portée
par le boilerplate : deux systèmes distincts, deux modèles distincts.

Cimetière : aucun traitement de paiement, aucune donnée bancaire, aucun appel de fonds, aucun
tantième.

---

## Story s20-factures-pennylane — Remonter les factures depuis Pennylane

**En tant que** membre propriétaire **je veux** que mes factures Pennylane apparaissent automatiquement
**afin de** ne pas dépendre d'une saisie manuelle du bureau.

### Complexity

3

### Acceptance criteria

- [ ] L'implémentation Pennylane s'active par configuration de tenant et remplace la saisie manuelle sans modification de l'interface membre.
- [ ] Les factures du membre sont remontées avec leur statut Pennylane d'origine, y compris les statuts intermédiaires.
- [ ] Un compte non rapproché est signalé au bureau plutôt que silencieusement vide.
- [ ] Quand l'API fournit un PDF, un bouton de téléchargement le sert au membre.
- [ ] Quand l'API n'en fournit pas, la ligne de facture indique explicitement que le PDF n'est pas disponible et n'affiche aucun bouton — jamais un lien mort.
- [ ] Une indisponibilité de l'API Pennylane affiche les dernières données connues avec la date de dernière synchronisation, sans page en erreur.
- [ ] Le schéma de facture et les appels sortants ne comportent aucun champ de moyen de paiement (numéro de carte, IBAN, mandat) — vérifié par un test sur la forme des données échangées.

### Dependencies

s02, s19

### Agentic notes

Réf. `V5 §5.2`, `CDCT §5.2`, `Annexe A`. **Bloquée par une condition suspensive du devis** : accès
API Pennylane **et** clé de rapprochement (email ? n° de parcelle ? id client Pennylane ?) non
tranchés. Quelle que soit la clé retenue, elle est stockée comme **attribut** de la fiche membre, à
côté de sa clé primaire — jamais à la place. Le rapprochement avec un système externe ne redéfinit
pas l'identité interne, sinon un changement d'outil de facturation devient une migration d'identités. `/ks-research` vérifie d'abord que l'accès est fourni ; sinon la story attend et le bloc B
continue sans elle grâce à s19.

**Prérequis de `/ks-research`** : la clé de rapprochement entre un compte du site et une fiche client
Pennylane (email ? n° de parcelle ? id client ?) doit être arbitrée avant que les critères de cette
story ne soient écrits comme des tests. Tant qu'elle ne l'est pas, la story n'entre pas en `/ks-plan`
— c'est un prérequis, pas une case à cocher.

Implémentation d'une interface existante (s19), pas une refonte : si cette story touche à la
présentation, le découpage a échoué.

Adaptateur fonctionnel autour du SDK/HTTP (convention du dépôt : pas d'objet à état pour une
intégration), secrets par `@/env`, jamais `process.env` en direct.

---

## Story s21-redirection-paiement — Payer sa facture

**En tant que** membre propriétaire **je veux** être redirigé vers l'espace de paiement de l'association
**afin de** régler ma facture sans quitter mon parcours.

### Complexity

1

### Acceptance criteria

- [ ] Une facture impayée affiche un bouton de paiement qui ouvre l'espace de paiement externe configuré pour le tenant.
- [ ] L'URL de redirection est un paramètre de tenant, pas une constante du code.
- [ ] Le parcours de paiement se réduit à un lien sortant : aucun formulaire de paiement n'est rendu par le site et aucun champ de moyen de paiement n'existe dans son schéma de données (test sur le formulaire et sur le schéma).
- [ ] Une facture qui n'est pas « impayée » au sens du prédicat de s19 n'affiche pas de bouton de paiement.

### Dependencies

s02, s19

### Agentic notes

Réf. `V5 §5.3`, `CDCT §5.3`. Simple lien sortant, d'où la complexité 1. C'est la story la plus courte
du projet et c'est volontaire : tout le reste est chez Pennylane.

Enjeu réglementaire, pas technique : cette frontière est ce qui maintient le projet hors DSP2/PCI
(angle n°4 du PRD). Toute tentative d'« améliorer » en capturant un moyen de paiement sort du
périmètre et doit être refusée en review.

---

## Story s22-signalement-membre — Suivre son signalement depuis son espace

**En tant que** membre propriétaire **je veux** déclarer une fuite depuis mon espace et suivre son statut
**afin de** savoir où en est mon incident sans relancer le bureau.

### Complexity

2

### Acceptance criteria

- [ ] Un membre connecté déclare un incident sans ressaisir son identité ; le bureau voit le déclarant dans la file de suivi.
- [ ] Le membre voit la liste de ses propres déclarations avec leur statut à jour.
- [ ] Un membre ne voit aucune déclaration d'un autre membre (test d'autorisation croisée).
- [ ] Le changement de statut par le bureau est visible par le membre déclarant.
- [ ] La notification email part vers les mêmes adresses paramétrées que le signalement public.

### Dependencies

s10, s12

### Agentic notes

Réf. `V5 §5.6`, `CDCT §5.6`. Même modèle et même workflow que s10 : le signalement porte un lien
nullable vers un membre (anonyme si public, identifié si connecté). Si s10 a bien été conçue, cette
story n'ajoute pas de table.

Piège : la file de suivi du back-office existe déjà (s10) — l'étendre, ne pas en créer une seconde
pour les déclarations membres.

---

## Story s23-questions-bureau — Poser une question au bureau

**En tant que** membre propriétaire **je veux** poser une question identifiée dans une catégorie
**afin qu'**elle arrive directement à la bonne personne du bureau.

### Complexity

2

### Acceptance criteria

- [ ] Un membre connecté choisit une catégorie dans une liste et envoie sa question ; elle est enregistrée et notifiée par email.
- [ ] La question part vers l'adresse de routage de la catégorie choisie ; si la catégorie n'en a pas, vers l'adresse de contact générale du tenant.
- [ ] Le bureau administre les catégories (libellé + email de routage facultatif) en back-office, avec un maximum de 10 catégories, la 11e étant refusée avec un message explicite.
- [ ] Le bureau consulte les questions reçues avec l'identité du membre et sa catégorie.
- [ ] Supprimer une catégorie ne supprime pas les questions déjà reçues dans cette catégorie.

### Dependencies

s02, s10, s12

### Agentic notes

Réf. `V5 §5.7`, `CDCT §5.7`. Formulaire **distinct** du contact public (s08) : identifié, catégorisé,
routé.

**Le modèle de catégories est livré par s10**, qui en a besoin la première pour les signalements :
cette story le **réutilise** avec son propre domaine et exploite son champ `email_destination`, porté
par s10 mais qu'aucun de ses critères n'exerce — c'est donc **ici** que ce champ est prouvé, par le
critère de routage. Si s10 l'a mal modélisé, c'est cette story qui le révèle. Ne pas en écrire un second — `CDCT §5.8` demande explicitement un modèle commun plutôt que
deux implémentations. s35 (petites annonces) fera de même.

---

## Story s24-notes-internes-membre — Tenir les notes internes sur un membre

**En tant que** membre du bureau **je veux** consigner des notes et l'historique des échanges sur un membre
**afin que** le suivi survive au renouvellement du bureau.

### Complexity

2

### Acceptance criteria

- [ ] Le bureau ajoute une note datée et signée sur la fiche d'un membre, et la retrouve à la consultation suivante.
- [ ] Le bureau consigne un échange avec un membre : date, canal (téléphone, courrier, en personne, email), et résumé libre.
- [ ] La fiche membre affiche notes et échanges dans un fil chronologique unique, chaque entrée portant son auteur, sa date et son type.
- [ ] Un membre n'a **aucun** accès à ses notes internes ni à celles d'un autre, ni par une page ni par un appel serveur côté membre (test d'autorisation explicite). Leur présence dans sa copie de données relève de s40.
- [ ] Une note peut être modifiée ou supprimée par le bureau, l'auteur et la date de dernière modification restant visibles.

### Dependencies

s12

### Agentic notes

Réf. `PRD` (« Notes internes et historique par membre », inspiré de Lotisoft), `V5 §2` (continuité du
bureau).

**Un « échange » est une saisie manuelle du bureau**, pas une agrégation automatique : un bénévole
note qu'il a appelé M. X le 12 mars et ce qui s'est dit. C'est ce que demande la ligne du périmètre —
« assure la continuité quand le bureau change » — et c'est la seule lecture livrable ici, la story
étant ordonnée avant les campagnes (s25) et n'ayant que s12 en dépendance.

Alimenter ce fil automatiquement depuis les signalements, les questions ou les campagnes serait une
extension : ni le PRD ni le CDC ne la demandent, et elle imposerait une convention transverse à une
dizaine de stories. Si le besoin apparaît à l'usage, il fera l'objet d'une story propre — ne pas
l'improviser ici.

**Sensible RGPD** : ce sont des notes sur des personnes physiques, écrites par des bénévoles. Deux
conséquences pour l'implémentation : l'étanchéité côté membre est un test, pas une intention ; et
ces notes doivent être **incluses dans l'export de données** : au titre de la portabilité dans l'export
d'association (s38), et au titre du droit d'accès dans la copie du membre (s40).
Le noter dans le plan de s38.

Ne pas exposer ces notes dans une réponse d'API partagée avec la présentation membre — le risque
n'est pas la page, c'est le DTO trop large réutilisé.

---

# Bloc C — Communication (nov-déc 2026)

## Story s25-campagnes-email — Envoyer une campagne email aux membres

**En tant que** membre du bureau **je veux** envoyer une campagne email aux membres
**afin de** les informer sans passer par ma messagerie personnelle.

### Complexity

3

### Acceptance criteria

- [ ] N'importe quel membre du bureau compose une campagne, choisit un des 4 modèles ou le mode libre, et l'envoie aux membres disposant d'une adresse email.
- [ ] Le nombre de destinataires est affiché avant l'envoi, en distinguant ceux qui ont un email de ceux qui n'en ont pas.
- [ ] Tout envoi, modèle ou campagne libre, porte le même habillage : en-tête au logo de l'association et pied de page avec mentions et lien de désinscription.
- [ ] Les variables dynamiques (nom, parcelle, date) sont remplacées par les valeurs du destinataire ; une variable inconnue est signalée avant l'envoi, pas laissée telle quelle dans l'email reçu.
- [ ] Un aperçu montre le rendu final avec les données d'un destinataire réel avant l'envoi définitif.
- [ ] Suivre le lien de désinscription du pied de page enregistre le refus du membre, le lui confirme à l'écran, et se voit sur sa fiche côté bureau.
- [ ] Un membre désinscrit est exclu de la cible de l'envoi suivant et de son décompte : le lien produit son effet dès cette story, sans attendre la classification de s27b.
- [ ] La campagne envoyée est archivée avec son contenu, sa cible et sa date, et consultable en back-office.
- [ ] Une campagne d'une association ne peut pas cibler les membres d'une autre.

### Dependencies

s02, s03, s12

### Agentic notes

Réf. `V5 §8.1`, `CDCT §8.1`. Les 4 modèles : relance manuelle, facture disponible, convocation AG,
publication de documents post-AG. **Leur contenu détaillé reste à rédiger avec le bureau**
(`Annexe A`) — `/ks-research` vérifie s'il est disponible ; à défaut, livrer les modèles avec un
contenu provisoire clairement marqué et les variables déjà câblées, la rédaction n'étant pas du code.

**Cette story envoie à tous les membres, et à eux seuls.** Le ciblage — cible « impayés » et groupes
composés par le bureau — est livré par s27. La scission a été décidée en revue du découpage, la story
groupant auparavant neuf critères. Conséquence pour le plan : le modèle « relance manuelle » existe
ici, mais il n'atteint le sous-groupe impayés qu'une fois s27 livrée.

Piège explicite du `CDCT §8.1` : **la campagne libre n'est pas un cas à part sans habillage**. Le
gabarit commun (header/footer) enveloppe aussi bien les 4 modèles que le mode libre. Un agent qui
traite la campagne libre comme un envoi brut rate la story.

L'envoi de facture double celui de Pennylane (problème de délivrabilité connu), il ne le remplace
pas.

**Le lien de désinscription produit son effet ici, pas plus tard.** Afficher un lien dont le filtrage
n'arriverait qu'en s27b livrerait une promesse non tenue sur un sujet à charge réglementaire — défaut
relevé en revue du découpage. Cette story applique donc l'exclusion **totale** : un désinscrit ne
reçoit plus rien. s27b introduit ensuite la distinction facultative / statutaire, qui le **réintègre**
dans les envois auxquels son appartenance à l'association l'engage. Sur-exclure temporairement est le
sens sûr de l'erreur ; l'inverse ne l'est pas. Pour la même raison, l'écran de confirmation ne
promet ici rien sur ce que le membre continuera de recevoir : cette phrase n'a de sens qu'une fois
s27b livrée.

Le gabarit commun (logo, mentions légales, adresse de désinscription) est alimenté par les
paramètres du tenant (s02), pas par des constantes.

Transport Brevo (voir s03) : plafond de 300 emails/jour. Cette story envoie **sans** gestion du
dépassement — c'est s26 qui l'ajoute. Concevoir le déclenchement d'envoi de façon à pouvoir
l'intercepter, sinon s26 imposera de tout reprendre.

---

## Story s26-envoi-echelonne — Scinder une campagne au-delà de 300 destinataires

**En tant que** membre du bureau **je veux** que les grosses campagnes se scindent toutes seules
**afin de** ne pas dépasser le quota d'envoi ni générer de surcoût.

### Complexity

4

### Acceptance criteria

- [ ] Une campagne dont le nombre de destinataires actifs dépasse le seuil d'envoi du tenant (300 par défaut, quota Brevo) part en deux envois : le jour même puis le lendemain, sans aucune action du bureau.
- [ ] Le bureau voit l'état de la campagne (première part envoyée, seconde part programmée pour telle date) et le nombre de destinataires de chaque part.
- [ ] Une campagne dont le nombre de destinataires est inférieur ou égal au seuil part en un seul envoi.
- [ ] Le seuil est un paramètre de tenant : le porter à 500 fait partir en un seul envoi une campagne de 400 destinataires, sans redéploiement.
- [ ] Une campagne dépassant deux fois le seuil est scindée en autant de parts quotidiennes que nécessaire, chacune sous le seuil.
- [ ] Le seuil est un **budget quotidien d'envoi par association**, décompté dans l'adaptateur d'envoi par **tout** email sortant qui le traverse, et pas seulement par les campagnes — vérifié avec un émetteur de test distinct des campagnes.
- [ ] Un envoi qui dépasserait le budget du jour est reporté au lendemain plutôt que refusé ou perdu, et le bureau voit qu'il est en attente.
- [ ] Un redémarrage du serveur entre les deux parts ne perd pas la seconde part et ne la duplique pas.
- [ ] Un destinataire ne reçoit jamais deux fois la même campagne, même si le traitement est relancé.

### Dependencies

s02, s12b, s25

### Agentic notes

Réf. `V5 §8.2`, `CDCT §8.2`, et critère de succès du PRD (« automatiquement scindée sur deux jours,
sans action du bureau »).

Risque (complexité 4, relevée de 3 en revue du découpage) : la story cumule une **planification
durable** qui survit au redémarrage, l'**idempotence par destinataire**, un **budget transverse**
décompté dans l'adaptateur que toutes les autres stories traversent, et une **file de report** avec
un état visible. C'est le trio qui vaut déjà un 4 à s29, plus le budget. Si le plan dépasse dix
tâches, séparer le budget et la file de report de la scission de campagne sur deux jours.

Le critère de budget se prouve sur l'**adaptateur d'envoi**, pas sur une énumération des émetteurs :
s29 (relances) et s42 (lancement) sont livrées après cette story et ne pourraient pas servir de
preuve. Chacune porte de son côté un critère affirmant qu'elle passe bien par l'adaptateur.

Piège explicite : c'est une **logique de déclenchement**, pas une limite affichée à l'utilisateur.
Un message « vous avez trop de destinataires » est un échec de la story.

Le `V5 §8.2` ne décrit que le cas à deux jours parce que La Fourche compte 300 membres avec email.
La règle générale — découper en parts quotidiennes toutes sous le seuil — couvre ce cas sans le
contredire, et évite qu'une association plus grande parmi les cinq prospects dépasse silencieusement
le quota. Ne pas coder « deux parts » en dur.

Le seuil de 300 est le quota Brevo actuel : paramètre de tenant (s02), pas une constante — un autre
client pourra avoir un autre plan.

À savoir en test : La Fourche compte **exactement 300 membres avec email** (s13). La campagne « tous
les membres » est donc pile au seuil — elle part en un seul envoi aujourd'hui, et bascule en deux
parts dès le 301e membre. Le jeu de tests doit couvrir 300 et 301, pas seulement un cas large.

**Le quota Brevo est par compte et par jour, tous envois confondus** — pas par campagne. Scinder
chaque campagne indépendamment ne borne donc rien : une campagne de 250, plus 60 invitations, plus 40
relances le même jour dépassent les 300 sans qu'aucune n'ait fauté seule. C'est pourquoi cette story
possède un **budget**, décompté par l'adaptateur d'envoi que toutes les stories traversent déjà
(posé en s03), et non un simple découpage de campagne. Défaut relevé en revue du découpage.

⚠️ **À vérifier en `/ks-architect`** : si plusieurs associations partagent un même compte Brevo, le
quota est partagé lui aussi et le budget doit être arbitré entre tenants. Un compte par association
lève la question mais change le coût — c'est un arbitrage d'architecture, pas de story.

Idempotence et persistance de la seconde part : la planification survit au redémarrage. Inngest est
écarté par l'ADR 006, qui retient une table `scheduled_job` et un cron système : s'y conformer. Un
`setTimeout` en mémoire ne satisfait aucun des deux derniers critères.

**Cette story pose le planificateur de l'ADR 006** : la table `scheduled_job`, la route interne
authentifiée par secret partagé, et son déclenchement par le cron système, installé à l'endroit
choisi et documenté par s12b. C'est la première story dont un critère exige une tâche durable ; s29
et s38 le réutilisent sans en créer un second. Le compter dans le seuil de dix tâches ci-dessus : s'il
fait déborder le plan, c'est lui qui part avec le budget et la file de report. La scission se fait
alors dans `docs/stories.md`, avant `/ks-plan`, avec un nouvel id et la mise à jour des dépendances
de s29, s30, s38 et s42 — jamais comme une story qui n'existerait que dans un plan. Mineurs m4
(planificateur) et m15 (report de la scission) de la revue du découpage.

---

## Story s27-groupes-destinataires — Choisir la cible d'une campagne

**En tant que** membre du bureau **je veux** choisir qui reçoit une campagne
**afin de** relancer les seuls impayés, ou de m'adresser à un groupe que j'ai composé.

### Complexity

3

### Acceptance criteria

- [ ] La cible « membres en impayé » est proposée à l'envoi d'une campagne, à côté de « tous les membres » (s25) ; elle est calculée au moment de l'envoi à partir du prédicat « impayé » de s19, jamais saisie à la main ni redérivée d'un statut.
- [ ] La cible « impayés » fonctionne avec la saisie manuelle des factures comme avec une implémentation externe : changer d'implémentation ne change pas la cible.
- [ ] Le bureau crée un groupe nommé et y ajoute ou retire des membres depuis la liste des membres.
- [ ] Un groupe est sélectionnable comme cible d'une campagne, à la place de « tous les membres » ou des impayés.
- [ ] Le nombre de destinataires du groupe est affiché avant l'envoi, en distinguant ceux qui ont un email de ceux qui n'en ont pas.
- [ ] Supprimer un groupe n'affecte ni les membres qu'il contenait ni les campagnes déjà envoyées.
- [ ] Un membre désinscrit (s25) est exclu des deux nouvelles cibles comme de « tous les membres » : l'exclusion se fait au calcul de la cible, quel qu'en soit le type.
- [ ] Un groupe est propre à son association et n'est jamais visible d'une autre.

### Dependencies

s19, s25

### Agentic notes

Réf. `PRD` (« Groupes de destinataires personnalisés », inspiré de Lotisoft), `V5 §8.3` pour les deux
cibles existantes.

**Cette story possède le ciblage des campagnes**, sorti de s25 en revue du découpage : s25 envoyait à
tous, et groupait neuf critères. `V5 §8.3` oppose les campagnes manuelles (tous les membres) aux
relances (sous-groupe impayés) — le modèle « relance manuelle » de s25 a besoin de cette cible pour
exister, et s29 réutilise le même calcul pour les relances automatiques.

Le statut d'impayé vient du système de facturation, donc de **l'interface de s19** — jamais d'un appel
direct à Pennylane. Passer par l'implémentation Pennylane (s20) rendrait la relance manuelle otage de
la condition suspensive du devis, alors qu'elle doit fonctionner dès la saisie manuelle.

La complexité 3 (contre 2 au PRD, qui ne chiffre que les groupes) tient à la cible « impayés » ajoutée
aux groupes. La classification facultatif / statutaire, troisième sujet que la story portait
auparavant, en a été sortie vers s27b en revue du découpage (m3) : elle est à elle seule une ligne du
PRD notée 2.

**Le calcul de la cible est le point de passage unique** des trois cibles (tous, impayés, groupe).
C'est là que s25 a posé l'exclusion des désinscrits, là que cette story l'étend aux deux nouvelles
cibles, et là que s27b ajoutera la réintégration des désinscrits dans les envois statutaires. Un
filtre posé ailleurs — à l'envoi, dans le gabarit — serait oublié par l'une des trois cibles.

La distinction avec/sans email dans le décompte prépare s28 : un groupe est aussi la cible d'un
publipostage papier, pas seulement d'un envoi email.

Groupes composés à la main par le bureau, **en plus** des deux cibles standard (tous les membres,
membres en impayé). C'est exactement le « au-delà des deux cibles actuelles » du PRD.

Pas de segmentation dynamique par critère au-delà de ces deux cibles : ni le CDC ni le PRD ne la
demandent, et elle ouvrirait un chantier de règles à maintenir.

---

## Story s27b-nature-envois — Distinguer les envois facultatifs des envois statutaires

**En tant que** membre désinscrit des campagnes **je veux** continuer à recevoir les convocations,
factures et relances **afin de** ne pas manquer ce que mon appartenance à l'association m'impose de
savoir, sans subir les envois facultatifs que j'ai refusés.

### Complexity

2

### Acceptance criteria

- [ ] Chaque type d'envoi existant porte une nature, `facultative` ou `statutaire`, lue dans la configuration du tenant : les quatre modèles de s25 et la campagne libre. La campagne libre n'a pas de nature propre à chaque envoi : le bureau ne la choisit pas en rédigeant.
- [ ] Un type d'envoi sans nature configurée se traite comme `facultative`.
- [ ] Un membre désinscrit, exclu de tout envoi depuis s25, est **réintégré** dans les cibles d'une campagne `statutaire` et reste exclu des `facultative` — vérifié sur les trois cibles (tous, impayés, groupe) et sur les deux natures.
- [ ] Le pied de page d'un envoi `statutaire` indique que le membre le reçoit malgré sa désinscription, parce que son appartenance à l'association l'y engage.
- [ ] L'écran de confirmation de désinscription précise désormais ce que le membre continuera de recevoir, d'après la classification.
- [ ] Reclasser un modèle change le comportement au prochain envoi, sans redéploiement.

### Dependencies

s25, s27

### Agentic notes

Réf. `PRD` (« Désinscription et classification des communications », complexité 2), règle
transverse « Désinscription » en tête de document. Story sortie de s27 en revue du découpage (m3) :
s27 portait trois sujets et onze critères pour une complexité de 3.

**La réintégration se fait au calcul de la cible**, point de passage unique posé par s25 et étendu
par s27 — pas à l'envoi. C'est le seul endroit où les trois cibles passent, donc le seul où la règle
ne peut pas être oubliée.

**Le mécanisme se code, la classification se configure.** La nature de chaque modèle est une doctrine
posée par défaut, à faire confirmer par le conseil RGPD : c'est une donnée de configuration du
tenant, jamais une constante.

**Classification du premier tenant** (arbitrage de la prestataire, 18 septembre 2026) — ce sont des
valeurs de **seed**, pas des constantes, et elles restent à faire confirmer par le conseil RGPD :

| Type d'envoi                                              | Nature        |
| --------------------------------------------------------- | ------------- |
| Convocation à l'assemblée générale                        | `statutaire`  |
| Facture disponible dans l'espace membre                   | `statutaire`  |
| Relance manuelle (modèle de s25)                          | `statutaire`  |
| Relance automatique d'impayé — déclarée par s29           | `statutaire`  |
| Invitation de lancement et sa relance — déclarées par s42 | `statutaire`  |
| Publication de documents après l'AG                       | `facultative` |
| Campagne libre                                            | `facultative` |

Deux arbitrages à ne pas « corriger » : la publication post-AG est facultative, parce que les
documents restent consultables dans l'espace documentaire ; et la campagne libre n'atteint **jamais**
un désinscrit, quel qu'en soit le sujet — pas de case « information obligatoire » à l'envoi, qui
permettrait de contourner une désinscription. L'invitation de lancement est statutaire pour sa
**relance** : un membre qui s'est désinscrit depuis l'email de lancement sans jamais se connecter
reçoit quand même la relance, qui porte sur son accès au service.

Sur-exclure est le sens sûr de l'erreur : un modèle sans nature connue se traite comme `facultative`,
jamais l'inverse.

Les deux lignes « déclarée par » ne sont pas des clés de cette story : conformément à la règle de s02
(« les clés propres à une story arrivent avec elle »), s29 et s42 déclarent chacune la nature de leurs
envois dans ce mécanisme, avec la valeur de seed du tableau. Elles figurent ici pour que la
classification du premier tenant se lise en un seul endroit.

---

## Story s28-publipostage-pdf — Générer le courrier des membres sans email

**En tant que** membre du bureau **je veux** produire un PDF prêt à imprimer pour les membres sans email
**afin qu'**ils reçoivent la même information que les autres, sans double saisie.

### Complexity

3

### Acceptance criteria

- [ ] Depuis une campagne, le bureau génère un PDF unique contenant un courrier par membre sans adresse email de la cible.
- [ ] Chaque courrier porte les variables du destinataire (nom, adresse postale, parcelle, date), issues du même contenu que la version email — sans ressaisie.
- [ ] Le PDF est directement imprimable : format A4, un courrier par page, bloc adresse positionné pour une enveloppe à fenêtre DL (110 × 220 mm, fenêtre à gauche) — position vérifiée par un test sur les coordonnées du bloc dans le PDF généré.
- [ ] Une cible sans aucun membre dépourvu d'email indique qu'il n'y a pas de courrier à produire, plutôt que de produire un PDF vide.
- [ ] Un membre disposant d'un email n'apparaît pas dans le publipostage, et réciproquement : aucun membre de la cible n'est oublié des deux canaux.

### Dependencies

s12, s25

### Agentic notes

Réf. `PRD` (angle n°2 : « Les membres sans email cessent d'être des exclus »), `V5 §3.3`.

C'est **l'angle le plus concret et le moins imité du produit**, et un critère de succès explicite
(« Une campagne produit un PDF de publipostage exploitable […] sans ressaisie »). Le critère de
complétude — email ∪ courrier = toute la cible, sans intersection ni oubli — est le test qui porte
l'angle : l'écrire en premier.

Le marquage « joignable par courrier uniquement » vient du modèle membre (s12), que l'import (s13)
se contente de renseigner — d'où la dépendance sur s12 et non sur s13, qui ne fournit que des
données de test. Ne pas déduire l'absence d'email d'une chaîne vide ambiguë : s'appuyer sur
le champ explicite.

Cimetière : ce n'est **pas** un plan B de connexion. Ces membres n'ont toujours pas de compte, et
c'est assumé.

Génération PDF : brique tierce assumée. Vérifier en `/ks-research` que la solution retenue tourne
sur le VPS LWS (2 vCore, 4 Go) — un moteur à navigateur headless y est un risque de mémoire réel.

---

## Story s29-relances-impayes — Relancer automatiquement les impayés

**En tant que** membre du bureau **je veux** que les impayés soient relancés automatiquement
**afin de** ne pas suivre à la main des dizaines de relances.

### Complexity

4

### Acceptance criteria

- [ ] Quand la relance automatique est activée pour le tenant, un membre dont une facture est « impayée » au sens du prédicat de s19 reçoit jusqu'à 3 relances, déclenchées 3, 2 puis 1 semaine après la **date d'échéance** de cette facture.
- [ ] Désactivée, aucune relance automatique ne part, et le reste des campagnes fonctionne normalement.
- [ ] Une facture réglée entre deux relances interrompt la série ; aucune relance ultérieure ne part.
- [ ] Un membre ne reçoit jamais deux fois la même relance, même si le traitement est rejoué (idempotence vérifiée par un test).
- [ ] Les relances passent par l'adaptateur d'envoi et sont décomptées du budget quotidien du tenant (s26) : une relance qui dépasserait le budget est reportée, pas perdue.
- [ ] Les relances ne ciblent que les membres en impayé au sens du prédicat de s19 ; aucun membre à jour, ni aucun membre dont le statut est en attente de classement, n'en reçoit.
- [ ] La relance automatique déclare sa nature dans le mécanisme de s27b, avec la valeur de seed `statutaire` pour le premier tenant. Avec la nature `statutaire`, un membre désinscrit en impayé reçoit la relance ; avec `facultative`, il ne la reçoit pas — vérifié sur les deux cas.
- [ ] Une page de back-office liste, par impayé : nom du membre, numéro de parcelle, date de la facture, nombre et dates des relances déjà envoyées.
- [ ] Les membres en impayé sans email apparaissent dans la page de suivi, marqués « courrier », avec une action qui génère leur publipostage de relance (s28) ; ils ne sont ni relancés par email ni omis de la liste.

### Dependencies

s02, s19, s25, s26, s27, s27b, s28

### Agentic notes

Réf. `V5 §8.3`, `CDCT §8.3`.

Risque (complexité 4) : trois pièges se cumulent. **Planification** (une série par facture, décalée
de semaines, qui survit aux redéploiements), **idempotence** (un traitement rejoué ne doit pas
renvoyer une relance déjà partie — un test explicite, pas une intention), et **ciblage** (le
sous-groupe impayés est recalculé à chaque échéance, pas figé au lancement de la série).

**Cette story n'est pas bloquée par la réserve Pennylane** — le tableau des réserves en tête de
document ne bloque que s20. Le champ Pennylane qui fait foi pour « impayé » et sa date n'est pas
connu (`Annexe A`), mais la série de relances se conçoit contre l'interface de facturation de s19 et
la cible calculée par s27 : avec la seule saisie manuelle, la story est testable de bout en bout.
Ne pas attendre s20 pour la livrer, et ne coder ici aucune détection Pennylane spécifique.

La cible des relances passe par le calcul de la cible de s27, comme toutes les autres. Qu'un membre
désinscrit reçoive ou non une relance découle de la **nature configurée** de la relance automatique
(s27b, `statutaire` pour le premier tenant) : ne pas contourner le filtre de désinscription ici, ni
coder la nature en dur. Si le conseil RGPD reclasse la relance, on change une valeur, pas du code.

L'activation est un **paramètre de tenant** (s02) : comportement développé pour tous, activé au cas
par cas. C'est explicitement demandé par le PRD.

Hors périmètre de cette story : la détection automatique d'une nouvelle facture. La notification
« facture disponible » reste à **déclenchement manuel** par le bureau (`CDCT §8.3`).

---

## Story s30-stats-campagnes — Voir si les campagnes sont lues

**En tant que** membre du bureau **je veux** consulter les taux d'ouverture et de clic de mes campagnes
**afin de** savoir si l'information passe.

### Complexity

2

### Acceptance criteria

- [ ] La fiche d'une campagne envoyée affiche le nombre d'envois, d'ouvertures et de clics, avec les taux correspondants.
- [ ] Une campagne scindée en deux parts (s26) présente des statistiques consolidées sur l'ensemble de la campagne.
- [ ] Des statistiques indisponibles ou pas encore consolidées côté fournisseur s'affichent comme telles, sans chiffre inventé ni zéro trompeur.
- [ ] Les statistiques d'une association ne sont jamais visibles d'une autre.

### Dependencies

s25, s26

### Agentic notes

Réf. `PRD` (« Statistiques d'ouverture et de clic », inspiré de Lotisoft), `V5 §8.1`.

Brevo mesure déjà : **restitution, pas mesure**. Aucun pixel de tracking, aucun compteur maison — ce
serait à la fois du travail dupliqué et une surface RGPD supplémentaire.

Distinguer « 0 ouverture » de « statistique pas encore disponible » : c'est le critère qui évite au
bureau de conclure à tort que personne ne lit ses campagnes.

---

# Bloc D — Espace documentaire (janvier 2027 au contrat — avancé avant le vote)

## Story s31-documents-partages — Consulter les documents de l'association

**En tant que** membre propriétaire **je veux** accéder aux statuts, PV et ordres du jour
**afin de** retrouver les documents de l'association sans les demander au bureau.

### Complexity

2

### Acceptance criteria

- [ ] Le bureau dépose un document partagé (titre, catégorie, fichier) et le voit apparaître dans l'espace documentaire des membres.
- [ ] Tout membre authentifié consulte et télécharge les documents partagés de son association.
- [ ] Un visiteur non connecté n'accède ni à la liste ni à un fichier, y compris par une URL directe.
- [ ] Les documents d'une association ne sont jamais accessibles depuis une autre.
- [ ] Le bureau retire un document ; il disparaît de la liste et son URL directe cesse de servir le fichier.

### Dependencies

s01b, s03, s03b, s12

### Agentic notes

Réf. `V5 §7.1`, `CDCT §7`. Volumétrie modeste : un ordre du jour et un compte-rendu d'AG par an,
plus les statuts.

Point de sécurité central : le fichier ne doit **jamais** être servi par une URL publique devinable.
L'accès passe par une route qui vérifie la session et le tenant avant de servir le contenu. Un
`<a href>` vers un chemin de stockage direct est un échec de review.

Stockage : adaptateur `local` et route de lecture posés par s01b (ADR 004, pas Supabase) ; cette
story y ajoute la lecture authentifiée. Volumétrie du VPS (100 Go) à prendre en compte dès cette
story ; la sauvegarde des fichiers relève de s12c-sauvegarde. Déclarer la colonne de clé de fichier
de cette story dans l'inventaire que lit le test de restauration de s12c, sans quoi un document
perdu à la restauration passerait inaperçu.

---

## Story s32-documents-nominatifs — Accéder à ses documents personnels

**En tant que** membre propriétaire **je veux** accéder à mes documents nominatifs
**afin de** récupérer ma facture et ma convocation sans risque qu'un autre membre les voie.

### Complexity

4

### Acceptance criteria

- [ ] Le bureau dépose un document nominatif pour un membre donné ; ce membre le voit dans son espace.
- [ ] Chaque membre dispose d'un dossier **physiquement séparé** : les fichiers d'un membre ne sont pas stockés dans un répertoire partagé filtré à la lecture.
- [ ] Un membre n'accède à aucun document d'un autre membre, y compris en forgeant l'identifiant du document ou le chemin du fichier (test d'autorisation croisée **et** test de traversée de chemin).
- [ ] Un document daté d'avant la vente d'une parcelle reste accessible à l'ancien propriétaire et invisible du nouveau.
- [ ] Le bureau accède à l'ensemble des documents nominatifs de son association, et à aucun de ceux d'une autre.
- [ ] Un dépôt en lot associe chaque fichier au bon membre, ou rejette la ligne en la signalant, sans jamais rattacher un document au mauvais membre.

### Dependencies

s12, s31

### Agentic notes

Réf. `V5 §7.1`, `CDCT §7`. Volumétrie : une facture et une convocation par membre et par an sur
**400 propriétaires** (comptage tranché en s13), soit ~800 documents nominatifs par an — et non 600 :
les 100 membres sans email ont eux aussi des factures et des convocations, ils les reçoivent par
courrier (s28). Prévoir la marge de croissance.

Corollaire à ne pas manquer : un dossier nominatif existe pour un membre **sans compte**. Le
cloisonnement du stockage ne peut donc pas être indexé sur l'identifiant de connexion — il s'indexe
sur la **clé primaire de la fiche membre** (règle transverse), qui existe avec ou sans compte.

Risque (complexité 4) : l'exigence n'est pas « filtrer à la lecture » mais **« exclure tout accès
croisé même en cas de bug d'autorisation »** (`CDCT §7`). C'est une exigence de défense en
profondeur : cloisonnement au niveau du stockage **en plus** de l'autorisation applicative. Un agent
qui implémente un filtre `WHERE member_id = ?` sur un répertoire commun a produit exactement ce que
le CDC refuse. À trancher en `/ks-architect` (arborescence, nommage non devinable, droits) avant
`/ks-plan`.

La dépendance sur s31 n'est pas fonctionnelle mais technique : cette story réutilise la **route de
service authentifiée** que s31 pose pour les documents partagés, sur l'adaptateur de stockage de s01b. C'est ce
qui garantit qu'aucun fichier n'est servi par une URL publique devinable — la propriété la plus
importante de cette story.

Le critère de la parcelle vendue s'appuie sur la résolution datée de s12 : le document appartient au
propriétaire **au moment des faits**.

C'est le critère de succès n°1 du PRD (« et à rien qui appartienne à un autre membre ») dans sa forme
la plus exigeante. Prévoir la review en conséquence.

Cimetière : pas de classification automatique des documents par IA.

Sauvegarde : déclarer la colonne de clé de fichier de cette story dans l'inventaire que lit le
test de restauration de s12c (voir ses notes).

---

# Bloc E — Vote (décembre 2026 au contrat — replacé après la GED, dont il dépend)

## Story s33-vote-asl-community — Voter à distance et publier les résultats

**En tant que** présidente **je veux** ouvrir le vote à distance et publier résolutions, résultats et PV
**afin que** les membres votent avant l'AG et consultent ensuite les décisions.

### Complexity

3

### Acceptance criteria

- [ ] La présidente ouvre puis ferme la période de vote ; hors période, l'accès à l'espace de vote n'est pas proposé aux membres.
- [ ] Un membre connecté accède à l'espace de vote externe depuis son espace pendant la période ouverte.
- [ ] L'URL de l'espace de vote externe est un paramètre de tenant, pas une constante du code.
- [ ] La présidente saisit les résolutions soumises au vote et les publie ; les membres les consultent.
- [ ] La présidente publie les résultats et le PV ; ils deviennent consultables par les membres.
- [ ] Un membre du bureau qui n'est pas la présidente ne peut ni saisir une résolution ni publier de résultat ni de PV (test d'autorisation explicite).
- [ ] Le module se désactive par tenant : désactivé, ni la page de vote ni les résolutions n'existent, **aucun point d'entrée n'y renvoie** depuis l'espace membre, et le reste du site est intact.
- [ ] Le service de vote est appelé derrière une interface : changer de fournisseur ne demande aucune modification de la présentation (prouvé par un test doublant l'implémentation).

### Dependencies

s02, s12, s31

### Agentic notes

Réf. `V5 §6`, `CDCT §6`.

**Bloquée par une condition suspensive du devis** : accès ASL Community confirmé par écrit **et**
vérification que les statuts autorisent le vote électronique. `CDCT §6` est explicite — ne pas
commencer avant la levée de la réserve. `/ks-research` commence par là. Le module étant activable,
son décalage n'empêche aucune autre story.

L'interface interchangeable est **stratégique**, pas cosmétique (angle n°6 du PRD) : ASL Community
est simultanément fournisseur et concurrent partiel, et le vote par correspondance est à l'origine
du projet. Internaliser un jour ne doit demander qu'une nouvelle implémentation.

**Position client (6 septembre 2026)** : le module de vote se fera, d'une façon ou d'une autre — c'est
la demande fondatrice du projet. Ce qui reste incertain, c'est le **fournisseur**, pas l'existence du
besoin. La réserve porte donc sur le calendrier et sur l'implémentation, jamais sur l'opportunité.
Conséquence pour le découpage : aucune autre story ne doit dépendre de celle-ci — c'est pourquoi s37
n'en dépend plus.

⚠️ **Attention au périmètre si le fournisseur change** : brancher un autre prestataire est une
nouvelle implémentation de l'interface, donc du travail prévu. Développer le moteur de vote
nous-mêmes est autre chose : dépouillement, quorum et procurations sont explicitement au cimetière du
PRD. Le PRD envisage l'internalisation comme une évolution future (angle n°6), pas comme une story de
ce projet — elle appellerait un devis complémentaire et un passage par `/ks-prd`, pas une extension
silencieuse de s33.

Cimetière : **aucune logique de vote** — ni dépouillement, ni quorum, ni procurations, ni émargement,
ni synchronisation temps réel. Le site redirige et publie, point. Un agent qui commence à compter
des voix est hors périmètre.

Restriction présidente : c'est aujourd'hui la **seule** action réservée du produit. Elle est codée
ici sur les rôles fixes de s03b ; s37 la rendra configurable sans la changer.

Dépendance à s31 : le PV et les résultats sont publiés comme documents partagés — ils s'appuient
sur la GED, qui est donc ordonnée avant. Les convocations, elles, sont nominatives (s32).

---

# Bloc F — Modules et fonctionnalités complémentaires (fév 2027)

## Story s34-module-voirie — Suivre l'état des chemins et portails

**En tant que** visiteur ou membre **je veux** consulter l'état des chemins et des portails
**afin de** savoir ce qui est en travaux ou à remplacer.

### Complexity

2

### Acceptance criteria

- [ ] Le bureau crée et modifie des chemins et des portails, chacun avec un statut et un message libre.
- [ ] La page publique du module affiche la liste avec statut et message, plus le plan des voiries téléversé par le bureau.
- [ ] Le plan est une image statique téléversée en back-office ; le remplacer met à jour la page.
- [ ] Le module se désactive par tenant : désactivé, la page n'existe pas et aucune navigation n'y renvoie.

### Dependencies

s01, s04, s04b

### Agentic notes

Réf. `V5 §9`, `CDCT §9`. Hors devis initial, offert à La Fourche, mais **module produit** : activable
par tenant comme les autres.

Décision d'architecture actée, à ne pas rouvrir : le modèle Voirie **n'est pas fusionné** avec le
module Eau. Eau = individuel et facturable, Voirie = collectif et non facturable. Le PRD range
l'abstraction « ressource partagée » commune au cimetière — à réévaluer seulement si un troisième
domaine similaire apparaît réellement.

Cimetière : pas de carte interactive ni de plan cliquable — image statique, décision client
explicite.

Données de seed disponibles : la liste des chemins et portails de La Fourche figure dans
`docs/Admin-MEL/ASL_LA_FOURCHE_Presentation.pdf` (support AG du 24/07/2026).

Sauvegarde : déclarer la colonne de clé de fichier du plan des voiries dans l'inventaire que lit le
test de restauration de s12c (voir ses notes).

---

## Story s35-petites-annonces — Publier une annonce entre membres

**En tant que** membre propriétaire **je veux** publier une annonce visible des autres membres
**afin de** vendre, prêter ou proposer un service entre voisins.

### Complexity

3

### Acceptance criteria

- [ ] Un membre soumet une annonce (catégorie, titre, texte, coordonnées de contact) ; elle est enregistrée en attente de modération et n'est visible de personne d'autre.
- [ ] Le bureau accepte telle quelle, modifie puis accepte, ou rejette avec un motif ; l'auteur est informé de la décision.
- [ ] Une annonce acceptée apparaît sur la page des annonces, triée par catégorie puis par date, visible des seuls membres connectés.
- [ ] Les catégories sont administrables par le bureau, dans la limite de 10 ; les cinq catégories de départ sont fournies en seed.
- [ ] Une annonce reste en ligne jusqu'à suppression manuelle par son auteur ou par le bureau — aucune expiration automatique.
- [ ] Le module se désactive par tenant : désactivé, ni la page ni le formulaire de soumission n'existent, et **aucun point d'entrée n'y renvoie** dans l'espace membre — pas un lien grisé, pas une entrée vide.

### Dependencies

s10, s12

### Agentic notes

Réf. `V5 §5.8`, `CDCT §5.8`. Catégories de départ : entretien d'espaces verts, prêt de matériel,
recherche de matériel, services, divers. L'« annuaire des services » séparé est abandonné, fusionné
ici comme catégorie.

Réutiliser le modèle de catégories livré par s10 et déjà réutilisé par s23 (plafond 10,
administrable, discriminant de domaine) plutôt que d'en écrire un troisième. La dépendance porte sur
s10, propriétaire du modèle, et non sur s23 : les deux réutilisations sont indépendantes l'une de
l'autre.

Ne pas confondre avec la page « Contacts utiles » (contenu CMS géré par le bureau, s04) : celle-ci
est du contenu généré par les membres avec workflow de modération. Deux modèles distincts,
explicitement.

Activable par tenant parce que la modération obligatoire crée une charge récurrente pour un bureau
bénévole (`PRD`) — c'est une décision produit, pas une commodité technique.

Cimetière : pas de messagerie privée entre membres. Le contact passe par les coordonnées que
l'auteur choisit d'afficher dans son annonce, rien d'autre.

---

## Story s36-modeles-documents — Générer un document depuis un modèle

**En tant que** membre du bureau **je veux** générer une convocation ou un courrier type pré-rempli
**afin de** ne pas repartir d'une page blanche à chaque AG.

### Complexity

3

### Acceptance criteria

- [ ] Le bureau crée un modèle de document avec des variables (nom, parcelle, date, association) et le retrouve dans une liste réutilisable.
- [ ] Générer un document depuis un modèle pour un membre remplace les variables par ses valeurs et produit un fichier téléchargeable.
- [ ] Une génération en lot pour un groupe (s27) produit un document par membre, déposable directement dans les dossiers nominatifs (s32).
- [ ] Une variable inconnue est signalée à l'enregistrement du modèle, pas laissée telle quelle dans le document produit.
- [ ] Les modèles d'une association ne sont jamais visibles d'une autre.

### Dependencies

s27, s28, s32

### Agentic notes

Réf. `PRD` (« Modèles de documents réutilisables », inspiré de Lotisoft) : convocation, PV, courrier
type — **au-delà des modèles d'email** (s25), qui restent un système distinct.

**Ancrage de la génération en lot** : la ligne du PRD nomme « convocation, PV, courrier type ». Or
une convocation d'AG est par nature produite pour tous les membres à la fois et déposée dans leurs
dossiers nominatifs — la produire une par une la rendrait inutilisable pour un bureau bénévole. Le
lot n'est donc pas une extension mais la forme d'usage de la ligne du périmètre, obtenue en composant
s27 (cibles), s28 (moteur PDF) et s32 (dossiers nominatifs) sans rien inventer.

Réutiliser le moteur de variables et de génération PDF de s28 : c'est la même mécanique appliquée à
un document unitaire plutôt qu'à un publipostage. Si cette story réintroduit un second moteur, le
découpage a échoué.

Le dépôt en lot dans les dossiers nominatifs passe par le mécanisme de s32 — ne pas écrire dans le
stockage en contournant sa couche de cloisonnement.

Sauvegarde : si un document généré est conservé, déclarer sa colonne de clé de fichier dans
l'inventaire que lit le test de restauration de s12c.

---

## Story s37-permissions-configurables — Ajuster les droits par rôle

**En tant que** présidente **je veux** régler ce que chaque rôle peut faire depuis le back-office
**afin de** réserver ou d'ouvrir une action sans dépendre du prestataire.

### Complexity

4

### Acceptance criteria

- [ ] Une page de back-office présente la matrice rôle × action et permet d'accorder ou de retirer un droit.
- [ ] Retirer un droit à un rôle bloque immédiatement l'action pour ses titulaires, en interface **et** côté serveur (test sur l'appel serveur direct, pas seulement sur le bouton masqué).
- [ ] Toute action déclarée au registre apparaît dans la matrice avec, par défaut, exactement les rôles qui l'exécutaient avant : la suite de tests d'autorisation des stories précédentes passe sans modification une fois la matrice branchée.
- [ ] Une story ultérieure qui introduit une action réservée la déclare, et cette action apparaît dans la matrice sans modification du code de la matrice (vérifié en enregistrant une action de test).
- [ ] Les actions d'un module désactivé, ou d'un module non encore livré, n'apparaissent pas dans la matrice et n'y laissent pas de ligne orpheline.
- [ ] Un module de test déclarant une action réservée à la présidente la voit apparaître dans la matrice, réservée par défaut, et refusée aux autres rôles. (La vérification sur les actions réelles du vote appartient à s33, qui peut être livrée bien après.)
- [ ] La configuration est propre à chaque association et ne fuit pas d'un tenant à l'autre.
- [ ] Une configuration ne peut pas retirer à la présidente le droit de modifier la matrice elle-même (verrouillage anti-blocage).

### Dependencies

s03b

_(Couplage volontairement lâche : la matrice se nourrit du registre d'actions créé en s03b et alimenté
par chaque story au titre des règles transverses, pas des stories elles-mêmes. Elle n'a donc aucune
dépendance de feature — voir les notes.)_

### Agentic notes

Réf. `V5 §2, §3.2`, `CDCT §2` (« prévoir un mécanisme de permission par rôle configurable en BO
plutôt qu'un hardcode par action »), `PRD` (complexité 4).

Risque (complexité 4) : autorisation **transverse à tout le produit**. Placée tard exprès — la
matrice se dérive d'actions réelles, existantes et testées, et non l'inverse. La coder trop tôt
aurait produit une abstraction devinée.

**La matrice est alimentée par le registre d'actions créé en s03b**, que chaque story alimente au fur
et à mesure (règle transverse en tête de document). Cette story n'instrumente donc rien
rétroactivement : elle lit un registre déjà rempli et lui ajoute la configuration par tenant et
l'écran. C'est ce qui la maintient à 4 et lui permet de ne dépendre d'aucune story de feature. C'est ce qui permet à
s38 d'ajouter « déclencher l'export » après coup, et au module vote d'apparaître quand il est livré
sans que cette story l'attende. Faire dépendre la matrice d'une feature précise — le vote en
particulier, suspendu à une condition suspensive du devis — rendrait une feature du tronc commun
otage d'un module activable. C'est le défaut relevé en revue du découpage, corrigé ici.

CASL est déjà présent dans le boilerplate
(`.claude/rules/02-services/rule-casl-authorization.md`) : rendre ses règles paramétrables par
tenant, ne pas remplacer la brique.

Le vrai piège est la régression silencieuse : chaque story antérieure a ses propres tests
d'autorisation. Ils doivent tous continuer à passer **sans modification** une fois la matrice
branchée, avec la configuration par défaut. C'est le filet de sécurité de cette story — et la raison
pour laquelle sa liste de dépendances est courte alors que son critère 3 porte sur tout le produit :
ce sont les tests existants qui font foi, pas une dépendance déclarée story par story.

Le verrou anti-blocage est un vrai risque terrain : un bureau bénévole qui se retire ses propres
droits n'a aucun moyen de revenir en arrière sans le prestataire.

---

## Story s38-export-donnees — Exporter les données de l'association

**En tant que** présidente **je veux** exporter l'ensemble des données de mon association
**afin de** rester libre de mes données et de répondre à une demande de portabilité.

### Complexity

4

### Acceptance criteria

- [ ] La présidente déclenche un export complet et récupère une archive ZIP contenant : un fichier CSV par type de donnée tabulaire (membres, parcelles, relevés, factures, campagnes, signalements), un fichier JSON pour les contenus structurés, les fichiers d'origine des documents, et un `README` décrivant chaque fichier et ses colonnes.
- [ ] Les CSV sont encodés en UTF-8 avec BOM, leur séparateur est celui documenté dans le README, chaque ligne porte le même nombre de colonnes que son en-tête, et le JSON est valide au parsing.
- [ ] L'archive contient les **données membres** : membres, coordonnées, parcelles avec leurs périodes de propriété, relevés d'eau, factures, notes internes et échanges, état d'invitation et d'adoption, historique des attributions de rôle.
- [ ] L'archive contient les **contenus publiés du tronc commun** : pages, actualités, fiches du bureau, analyses d'eau, bandeau d'alerte, **entrées de menu et pied de page** (s04b). Les contenus des trois modules activables — vote, voirie, petites annonces — ne sont **délibérément pas énumérés ici** : ils entrent dans l'archive par le mécanisme du critère 9 dès que le module est livré et actif, et leur présence est vérifiée par le test de complétude de s39. Un agent qui code cette liste en dur reproduit exactement le défaut que le critère 9 interdit.
- [ ] L'archive contient les **documents** : partagés, nominatifs, et modèles de documents, avec leurs fichiers d'origine.
- [ ] L'archive contient les **communications** : campagnes, leurs statistiques d'ouverture et de clic, leur état de planification, l'historique des relances, les groupes de destinataires.
- [ ] L'archive contient les **échanges entrants** : signalements, messages de contact, questions au bureau.
- [ ] L'archive contient la **configuration** : paramètres du tenant, matrice de permissions, et les fichiers d'identité de l'association (logo et favicon, s01b).
- [ ] Les données d'un module non livré ou désactivé (vote) ne font pas échouer l'export. Réciproquement, le mécanisme est **piloté par l'inventaire des tables scopées**, et non par une liste écrite à la main : un module livré et actif entre dans l'archive sans modification de cette story.
- [ ] L'export ne contient **aucune** donnée d'une autre association (test d'isolation sur l'archive produite).
- [ ] L'export s'exécute en tâche de fond : la requête qui le déclenche répond immédiatement sans attendre l'archive, une lecture concurrente sur le site répond pendant la génération, et la présidente est notifiée quand l'archive est prête.

### Dependencies

s01b, s02, s04, s04b, s05, s06, s07, s08, s09, s10, s12, s14, s15, s17, s19, s23, s24, s25, s26, s27, s27b, s29, s30, s31, s32, s36, s37

### Agentic notes

Réf. `PRD` (« Export et portabilité des données », angle n°5 : « Pas de verrouillage »), RGPD (droit
à la portabilité).

Risque (complexité 4) : vingt-sept dépendances, six familles de contenu, exécution en tâche de
fond avec notification, écriture en flux sur un VPS à 4 Go. Le harnais de complétude en a été sorti
(s39) en revue du découpage — la story se lisait comme une 5 déjà scindée une fois (s40) mais pas
assez. Ce qui reste est un moteur d'export et son archive, pas une traversée du produit.

L'**export individuel d'un membre** en est sorti (s40) en revue du découpage : deux valeurs, deux
utilisateurs, deux surfaces d'autorisation — la présidente exporte l'association, un membre exerce
son droit d'accès. Les garder ensemble faisait de cette story une 5 déguisée en 4.

Double usage assumé : argument commercial anti-verrouillage **et** conformité (portabilité). Les
notes internes de s24 y figurent parce qu'elles sont des données de l'association ; le droit d'accès
d'un membre à celles qui le concernent relève de s40, qui réutilise ce moteur.

L'action « déclencher un export » est une action réservée : elle se déclare au registre de la
matrice de permissions (s37), qui est extensible par construction — pas besoin de rouvrir s37.

Sa liste de dépendances est longue **parce que c'est le sens de la story** : elle doit exporter tout
ce que le produit stocke. **Aucun des trois modules activables n'y figure** — ni s33 (vote), ni s34
(voirie), ni s35 (petites annonces). Le traitement est désormais uniforme, alors que s34 et s35 y
étaient en dur pendant que s33 en était exclue : une incohérence relevée en revue du découpage
(F-13). Le raisonnement qui excluait s33 vaut pour les trois — un module activable peut être
désactivé chez un tenant, et l'export ne doit être otage d'aucun. Leurs données entrent dans
l'archive par le test de complétude de s39 dès que le module est livré, sans rouvrir cette story.
C'est cohérent avec le critère 9. Les trois modules retirés ramenaient la story de vingt-sept
dépendances à vingt-quatre ; la scission de s04 en a rendu une — s04b, productrice du menu et du
pied de page (D-02) — d'où vingt-cinq à l'époque. La liste ci-dessus fait foi : vingt-sept
aujourd'hui, avec s01b et s27b.

Le critère 9 énonce une propriété **du mécanisme**, pas du résultat d'un test local : c'est le
harnais de s39 qui la vérifie mécaniquement, une story plus loin. La clause qui le disait vivait dans
le critère lui-même et le rendait à moitié intestable (D-06) ; elle est ici, à sa place.

**Une énumération écrite à la main finit toujours par oublier un type de donnée** — c'est exactement
ce qui s'est produit en revue du découpage, où six types manquaient. C'est pourquoi le garde-fou
mécanique qui rend l'oubli impossible fait l'objet d'une story propre (s39), livrée juste après :
cette story-ci produit l'archive, celle-là garantit qu'elle ne rate rien, aujourd'hui comme dans
trois ans.

Chaque story qui ajoute un type de donnée après celle-ci doit l'ajouter à l'export — le noter dans
son plan.

Placée en dernier parce qu'elle doit couvrir **tout** ce qui existe. Corollaire : c'est aussi la
story qui révèle une donnée oubliée par le scoping tenant. Traiter un échec du test d'isolation ici
comme un défaut de la story fautive, pas comme un défaut de l'export.

Volumétrie : archive potentiellement lourde (documents nominatifs de 400 propriétaires, cf. s13 et
s32) sur un VPS à 4 Go.
Générer en flux vers le disque, pas en mémoire.

---

## Story s39-completude-export — Garantir qu'aucune donnée n'échappe à l'export

⚠️ **Seule story transverse du découpage.** Elle ne livre aucun comportement observable par un
utilisateur : c'est un garde-fou de non-régression qui compare deux inventaires. Sa valeur est réelle
— sans lui, l'export de s38 se périme silencieusement à chaque table ajoutée — mais ce n'est pas une
tranche de produit, et elle aurait pu rester un critère de s38. Elle en a été sortie parce que s38 se
lisait comme une 5. Dérogation assumée et bornée à cette story.

**En tant que** présidente **je veux** que l'export reste complet à mesure que le produit évolue
**afin de** ne pas découvrir dans trois ans qu'une partie de nos données n'en sortait jamais.

### Complexity

2

### Acceptance criteria

- [ ] Un test compare l'inventaire des tables scopées par `organization_id` à l'inventaire des fichiers produits par l'export (s38), et échoue si une table n'est ni exportée ni déclarée exclue.
- [ ] Le registre des exclusions porte, pour chaque table exclue, son motif ; une exclusion sans motif fait échouer le test.
- [ ] Ajouter une table scopée sans toucher à l'export fait échouer ce test — vérifié en ajoutant une table de contrôle.
- [ ] Le rapport d'échec nomme les tables fautives, de sorte que la story qui les a introduites soit identifiable sans lecture du schéma.

### Dependencies

s38

### Agentic notes

Réf. `PRD` (« Export complet dans un format ouvert », angle n°5 : « Pas de verrouillage ») et RGPD
(portabilité).

Sortie de s38 en revue du découpage : l'export d'un côté, sa garantie de complétude de l'autre. s38
produisait déjà l'archive ; cette story empêche qu'elle se périme silencieusement à mesure que les
stories suivantes ajoutent des tables.

**C'est un garde-fou, pas un rapport.** Sa valeur est de rendre l'oubli impossible plutôt que
détectable : un export incomplet ne se voit pas à l'usage — l'association ne sait pas ce qui manque —
et c'est précisément ce qui rend l'argument anti-verrouillage du PRD vérifiable ou creux.

Le motif d'exclusion est obligatoire par conception : une table peut légitimement ne pas être
exportée (journal technique, cache), mais jamais sans que quelqu'un l'ait écrit.

Limite connue : ce garde-fou compare des **tables**. Les fichiers posés sur le disque sous le
répertoire d'une association (logo et favicon de s01b, documents de s31 et s32) y échappent ; leur
présence dans l'archive est portée par les critères de s38, pas par ce test.

Ce test appartient à la suite exécutée en continu, pas à un contrôle manuel : il doit casser au
moment où la table est ajoutée, pas au prochain export demandé par une présidente.

---

## Story s40-export-membre — Obtenir la copie de ses propres données

**En tant que** membre propriétaire **je veux** obtenir une copie de toutes les données que
l'association détient sur moi **afin d'**exercer mon droit d'accès.

### Complexity

2

### Acceptance criteria

- [ ] Un membre connecté demande sa copie et la reçoit dans le même format ouvert que l'export d'association (CSV, JSON, fichiers d'origine, README).
- [ ] La copie contient toutes les données le concernant, y compris les notes internes écrites sur lui par le bureau (s24) et son historique d'échanges.
- [ ] La copie ne contient **aucune** donnée d'un autre membre — vérifié sur une association comportant plusieurs membres, y compris pour un membre multi-parcelles.
- [ ] Les données rattachées à une parcelle qu'il a vendue lui restent acquises pour la période où il en était propriétaire, et pas au-delà.
- [ ] Le bureau peut produire cette même copie pour un membre qui en fait la demande par courrier, sans que ce membre ait de compte.
- [ ] La demande et sa livraison sont tracées, avec leur date, pour prouver le respect du délai légal.
- [ ] Cette trace est soit incluse dans l'export d'association (s38), soit **déclarée au registre des exclusions avec son motif** : le test de complétude de s39 continue de passer.

### Dependencies

s12, s24, s38, s39

### Agentic notes

Réf. `PRD` (« Export et portabilité des données »), RGPD article 15 (droit d'accès).

Sortie de s38 en revue du découpage : l'export d'association et l'export individuel sont deux
valeurs, deux utilisateurs et deux surfaces d'autorisation. s38 sert la présidente (portabilité,
anti-verrouillage), celle-ci sert un membre (droit d'accès) — et c'est la seule des deux qui doit
fonctionner **pour un membre sans compte**, via le bureau, puisqu'un quart d'entre eux ne se
connectera jamais.

Réutiliser la machinerie de s38 (formats, écriture en flux, README) : ce n'est pas un second moteur
d'export, c'est le même filtré sur un membre.

Le piège est l'inverse de celui de s38 : là-bas on cherche l'exhaustivité, ici la **stricte
limitation**. Les notes internes de s24 entrent dans la copie — ce sont des données personnelles le
concernant, même si l'interface ne les lui montre jamais — mais rien qui concerne un autre membre,
pas même dans un fichier partagé. Écrire le test d'isolation avant le code.

La résolution par période de propriété vient de s12 : un ex-propriétaire reçoit ce qui le concernait
quand il l'était, pas ce qui a suivi.

---

## Story s41-simulation-role — Déboguer en se mettant à la place d'un utilisateur

**En tant que** SuperAdmin Zourite Studio **je veux** consulter le site avec le rôle d'un utilisateur
d'une association **afin de** reproduire un problème signalé par le bureau sans lui demander ses accès.

### Complexity

2

### Acceptance criteria

- [ ] Un SuperAdmin choisit une association et un rôle, et navigue avec exactement les droits de ce rôle.
- [ ] Une bannière permanente signale la simulation en cours et permet d'en sortir depuis n'importe quelle page.
- [ ] La simulation respecte la matrice de permissions configurée pour l'association simulée (s37), pas les droits par défaut.
- [ ] Chaque entrée en simulation est tracée avec l'identité du SuperAdmin, l'association, le rôle et l'horodatage.
- [ ] Cette trace est soit incluse dans l'export d'association (s38), soit **déclarée au registre des exclusions avec son motif** : le test de complétude de s39 continue de passer.
- [ ] Aucun rôle association ne peut déclencher une simulation ; la fonction n'est pas exposée aux associations.
- [ ] Une action d'écriture faite en simulation est attribuée dans l'historique au SuperAdmin, pas au rôle simulé.

### Dependencies

s01, s03b, s24, s37, s38, s39

### Agentic notes

Réf. `PRD` (Target users : « SuperAdmin — support et débogage, simulation de rôle, non exposé aux
associations »), `CDCT §2`, et ligne « Simulation de rôle SuperAdmin (support et débogage) » du périmètre, complexité
2 — ajoutée en revue du découpage. Capacité interne à Zourite Studio, non exposée aux associations.

Sortie de s01 en revue du découpage : s01 y groupait quatre valeurs distinctes, et la simulation
répond au besoin d'un autre utilisateur. Placée après s37 pour que la simulation reflète la matrice
configurée plutôt que des droits devinés.

Le piège est l'attribution des écritures : une simulation qui écrit sous l'identité du rôle simulé
corrompt les notes internes (s24) et l'historique des membres, et rend le débogage indistinguable
d'une action du bureau. La traçabilité n'est pas un confort, c'est ce qui rend la fonction
acceptable sur des données personnelles.

Ne pas confondre avec l'attribution de rôles (s14) ni avec la matrice de permissions (s37) : ici aucun
droit n'est modifié. La simulation consulte le site sous une autre identité ; une écriture faite
pendant une simulation reste possible mais est attribuée au SuperAdmin (critère ci-dessus, PRD :
« écritures tracées au SuperAdmin »).

---

## Story s42-lancement-invitations — Faire entrer les membres dans le service

**En tant que** membre du bureau **je veux** annoncer le site à tous les propriétaires d'un seul geste
**afin que** chacun sache qu'il a un espace — ou, à défaut, que le site existe.

### Complexity

3

### Acceptance criteria

- [ ] Une campagne d'invitation part vers tous les membres disposant d'une adresse email, chaque destinataire recevant un lien de connexion qui lui est propre.
- [ ] La même opération produit, pour les membres sans email, un publipostage PDF (s28) annonçant le site public et ses contenus consultables sans compte.
- [ ] L'invitation de lancement et sa relance déclarent leur nature dans le mécanisme de s27b, avec la valeur de seed `statutaire` pour le premier tenant, et la suivent : avec la nature `statutaire` (valeur du premier tenant), la relance atteint aussi un membre qui s'est désinscrit depuis l'email de lancement sans s'être connecté — vérifié sur ce cas ; avec `facultative`, elle l'exclut.
- [ ] L'email de lancement porte l'habillage commun des campagnes (s25) — en-tête au logo, pied de page avec lien de désinscription — et, avec la nature `statutaire`, la mention de s27b indiquant qu'il est reçu malgré une désinscription. Son texte et son lien de connexion sont ceux de l'invitation de s15.
- [ ] Aucun membre de la liste n'est omis des deux canaux : la somme des destinataires email et des courriers produits égale l'effectif de l'association.
- [ ] Le bureau suit l'adoption : nombre d'invitations envoyées, nombre de membres s'étant connectés au moins une fois, liste des membres jamais connectés.
- [ ] Relancer les membres jamais connectés renvoie une invitation à eux seuls, sans réinviter ceux qui se sont déjà connectés.
- [ ] L'opération passe par l'adaptateur d'envoi et respecte le budget quotidien du tenant (s26) : au-delà du seuil, elle se scinde et se reporte comme n'importe quel envoi.
- [ ] Un lien d'invitation envoyé par une part reportée au lendemain, donc hors de toute requête, pointe vers le domaine de l'association et y ouvre la session — vérifié sur deux associations.

### Dependencies

s03, s03c, s13, s15, s25, s26, s27, s27b, s28

### Agentic notes

Réf. `PRD` (ligne « Connexion par lien magique » : « flux d'invitation […] à éprouver auprès d'un
public âgé »), `V5 §2, §3.3`. Story créée en revue du découpage : les stories précédentes
livraient un service que **personne n'aurait su utiliser** — aucune ne disait comment 300
propriétaires apprennent qu'ils ont un espace.

**À vérifier en review, pas en test** : que le courrier ne promette aucun accès à ces membres. C'est
un jugement rédactionnel, comme en s15.

**Le courrier des 100 sans email n'est pas une invitation** : ils n'ont pas de compte et n'en auront
pas (cimetière du PRD — aucun plan B de connexion). Leur courrier annonce le site public, les
analyses d'eau consultables sans compte, et rappelle que le bureau continue de les joindre par
courrier. Promettre un accès dans ce courrier serait un défaut fonctionnel, pas une maladresse de
rédaction.

La ligne « Connexion par lien magique » du périmètre nomme le flux d'invitation **et** son suivi
d'adoption (« qui a été invité, qui s'est connecté »), précisé en revue du découpage. Il est retenu
parce que le critère de succès « les membres sans email reçoivent la même information que
les autres » n'est vérifiable qu'en sachant qui a reçu quoi — sans ce suivi, le lancement serait un
envoi à l'aveugle sur la population que le PRD désigne comme la plus fragile.

C'est le moment de vérité de l'angle n°2 du PRD : les deux populations reçoivent la même information
au même moment, depuis le même outil, sans double saisie.

Elle réutilise le mécanisme d'invitation unitaire de s15, appliqué à une cible entière : ni second
gabarit d'invitation, ni seconde génération de lien. **Mais l'enveloppe change** : l'invitation
unitaire de s15 est un email transactionnel sans habillage de campagne, alors que le lancement est un
envoi de masse — il porte donc le gabarit commun de s25 et son lien de désinscription, obligatoire sur
tout envoi de masse. Le texte et le lien de s15 s'insèrent dans ce gabarit.

Le lien de connexion propre à chaque destinataire est une variable de campagne d'un genre nouveau —
elle porte un secret à usage unique. Ne pas la journaliser, ne pas la stocker dans l'archive de
campagne (s25), ne pas la faire figurer dans l'export (s38).

---

# Récapitulatif — ordre et dépendances

| Id   | Story                     | Cx  | Dépend de                                                                                                                                | Bloc |
| ---- | ------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| s01  | provisionner-association  | 4   | —                                                                                                                                        | A    |
| s01b | logo-association          | 3   | s01                                                                                                                                      | A    |
| s02  | parametres-association    | 3   | s01, s01b                                                                                                                                | A    |
| s03  | connexion-lien-magique    | 3   | s01, s01b, s02                                                                                                                           | A    |
| s03b | roles-registre-actions    | 3   | s01, s01b, s02                                                                                                                           | A    |
| s03c | session-multi-domaine     | 3   | s03                                                                                                                                      | A    |
| s04  | pages-cms                 | 4   | s01, s02, s03b                                                                                                                           | A    |
| s04b | navigation-publique       | 2   | s04                                                                                                                                      | A    |
| s05  | actualites                | 2   | s04                                                                                                                                      | A    |
| s06  | presentation-bureau       | 2   | s04                                                                                                                                      | A    |
| s07  | bandeau-alerte            | 1   | s01, s03b                                                                                                                                | A    |
| s08  | formulaire-contact        | 2   | s02, s04                                                                                                                                 | A    |
| s09  | analyses-eau              | 2   | s04                                                                                                                                      | A    |
| s10  | signalements-publics      | 3   | s02, s04, s08                                                                                                                            | A    |
| s11  | seo                       | 2   | s02, s04, s05, s09                                                                                                                       | A    |
| s12  | membres-parcelles         | 4   | s01, s03, s03b                                                                                                                           | B    |
| s12a | retrait-supabase          | 2   | s01b                                                                                                                                     | B    |
| s12b | mise-en-ligne             | 3   | s01, s01b, s03, s03c, s08, s12a                                                                                                          | B    |
| s12c | sauvegarde                | 3   | s01b, s04, s05, s06, s09, s12b                                                                                                           | B    |
| s13  | import-initial-membres    | 3   | s12, s12c                                                                                                                                | B    |
| s14  | attribuer-roles           | 2   | s03b, s12                                                                                                                                | B    |
| s15  | inviter-membre            | 2   | s02, s03, s03c, s12                                                                                                                      | B    |
| s16  | coordonnees-membre        | 1   | s12                                                                                                                                      | B    |
| s17  | import-releves-eau        | 3   | s02, s12, s13                                                                                                                            | B    |
| s18  | historique-consommation   | 2   | s17                                                                                                                                      | B    |
| s19  | factures-liste            | 3   | s02, s12                                                                                                                                 | B    |
| s20  | factures-pennylane        | 3   | s02, s19                                                                                                                                 | B    |
| s21  | redirection-paiement      | 1   | s02, s19                                                                                                                                 | B    |
| s22  | signalement-membre        | 2   | s10, s12                                                                                                                                 | B    |
| s23  | questions-bureau          | 2   | s02, s10, s12                                                                                                                            | B    |
| s24  | notes-internes-membre     | 2   | s12                                                                                                                                      | B    |
| s25  | campagnes-email           | 3   | s02, s03, s12                                                                                                                            | C    |
| s26  | envoi-echelonne           | 4   | s02, s12b, s25                                                                                                                           | C    |
| s27  | groupes-destinataires     | 3   | s19, s25                                                                                                                                 | C    |
| s27b | nature-envois             | 2   | s25, s27                                                                                                                                 | C    |
| s28  | publipostage-pdf          | 3   | s12, s25                                                                                                                                 | C    |
| s29  | relances-impayes          | 4   | s02, s19, s25, s26, s27, s27b, s28                                                                                                       | C    |
| s30  | stats-campagnes           | 2   | s25, s26                                                                                                                                 | C    |
| s31  | documents-partages        | 2   | s01b, s03, s03b, s12                                                                                                                     | D    |
| s32  | documents-nominatifs      | 4   | s12, s31                                                                                                                                 | D    |
| s33  | vote-asl-community        | 3   | s02, s12, s31                                                                                                                            | E    |
| s34  | module-voirie             | 2   | s01, s04, s04b                                                                                                                           | F    |
| s35  | petites-annonces          | 3   | s10, s12                                                                                                                                 | F    |
| s36  | modeles-documents         | 3   | s27, s28, s32                                                                                                                            | F    |
| s37  | permissions-configurables | 4   | s03b                                                                                                                                     | F    |
| s38  | export-donnees            | 4   | s01b, s02, s04, s04b, s05, s06, s07, s08, s09, s10, s12, s14, s15, s17, s19, s23, s24, s25, s26, s27, s27b, s29, s30, s31, s32, s36, s37 | F    |
| s39  | completude-export         | 2   | s38                                                                                                                                      | F    |
| s40  | export-membre             | 2   | s12, s24, s38, s39                                                                                                                       | F    |
| s41  | simulation-role           | 2   | s01, s03b, s24, s37, s38, s39                                                                                                            | F    |
| s42  | lancement-invitations     | 3   | s03, s03c, s13, s15, s25, s26, s27, s27b, s28                                                                                            | F    |

**50 stories, aucune à 5.** Répartition : trois à 1, vingt à 2, dix-neuf à 3, huit à 4.
**Quatre stories sont hors du tableau de périmètre du PRD**, chacune justifiée dans son en-tête :
s39, garde-fou de non-régression de l'export, qui ne livre aucune valeur observable par un
utilisateur de l'association ; s12a, le retrait de Supabase, qui solde la contrainte du PRD sur le
remplacement des briques du boilerplate ; s12b, la mise en ligne, qu'exige le critère de succès
« mise en production effective sur le VPS » ; et s12c, la sauvegarde, que s13 attend avant
d'importer les données réelles.

L'application du design system au boilerplate — longtemps portée par une story `s00` — **a été sortie
du découpage** (arbitrage du 9 septembre 2026). Ce n'était pas une tranche de produit mais une
préparation du socle, et la tenir dans le pipeline coûtait plus qu'elle ne rapportait : quatre
passages de revue consécutifs y ont buté. Elle est conduite hors killer-saas ; l'inventaire mesuré du
travail vit dans `docs/adaptation-socle-design-system.md`, et la contrainte qu'elle imposait aux
stories d'écran reste, en règle transverse « Socle habillé ».
Sa surface est énumérée dans le tableau mesuré de `docs/adaptation-socle-design-system.md`, et elle est préalable à toute story porteuse d'écran
(voir « Règles transverses »).
Les huit stories à 4 — s01 (isolation multi-tenant), s04 (back-office éditorial : modèle en
blocs typés et réordonnancement accessible), s12 (modèle membre↔parcelle
daté), s26
(planification, budget transverse et file de report), s29 (planification et idempotence des
relances), s32 (cloisonnement physique des documents nominatifs), s37 (autorisation transverse),
s38 (moteur d'export et son archive) — portent chacune leur risque
explicité dans leurs notes agentiques, à trancher en `/ks-architect` ou `/ks-design` avant
`/ks-plan`.

Quatre écarts avec les scores du PRD, tous documentés dans la story concernée plutôt que lissés :
s04 à 4 contre 3, que le modèle en blocs typés de l'ADR 007 porte au-dessus du chiffrage du PRD ;
s27 à 3 contre 2 (elle porte le calcul de la cible « impayés » en plus des groupes composés à la
main) ; s38 à 4 contre 3 (vingt-sept dépendances, six familles de contenu, exécution en tâche de
fond, écriture en flux sur un VPS à 4 Go) ; et l'identité visuelle, chiffrée 2 par le PRD, portée par
s01b à 3 — le logo et le favicon y tirent le stockage de fichiers de l'ADR 004, que le PRD ne
chiffrait pas — et, pour la teinte, par s02, dont le 3 couvre d'abord le registre de paramètres. Le
PRD chiffre des _features_, ce tableau chiffre des _tranches livrables_.

Dix stories ont été ajoutées en revue du découpage : s12b (mise en ligne, qui manquait avant
l'import des données réelles — majeur M4), s12c (sauvegarde, scindée hors de s12b),
s27b (nature des envois, scindée hors de s27), s04b (navigation du site public, scindée hors
de s04 qui empilait deux lignes de périmètre — premier id intercalé), s14 (attribution
des rôles — les rôles
existaient et la matrice était prévue, mais rien ne permettait de désigner la présidente ni le
bureau), s15 (invitation unitaire, sortie de s03 où elle créait une dépendance circulaire vers s12),
s39 (garde-fou de complétude, sorti de s38), s40 (export individuel d'un membre, sorti de s38 qui
portait deux valeurs utilisateur distinctes), s41 (simulation de rôle, sortie de s01) et s42
(invitation des membres au lancement, qui n'était couverte par aucune story — le service existait
sans que personne sache qu'il existe).

**s01b a été ajoutée hors revue**, le 17 septembre 2026, lors de la recherche de s02 : le stockage de
fichiers de l'ADR 004 n'était porté par aucune story alors que s04, s09, s31 et s32 le supposaient.
Elle le pose sur la première valeur qui en a besoin — le logo et le favicon, sortis de s02 — et
porte un id intercalé parce que s02 en dépend. Le critère de validation de s02 a été reformulé le
même jour : le registre ne déclare que les clés utilisées, les autres types se prouvent sur le
registre.

**s03 a été scindée en trois le 19 septembre 2026**, avant son plan, au seuil que prévoyaient ses
notes : la recherche y a compté cinq sujets à risque, dont l'adaptateur d'envoi de l'ADR 005, absent du
code. s03 garde le lien magique et l'adaptateur (3), **s03b** prend les rôles et le registre d'actions
(3), **s03c** la session sur le domaine de chaque association (3). Les deux ids sont intercalés parce
que toute la suite en dépend : le registre est une règle transverse, et s12b, s15 et s42 supposent le
lien propre au domaine. Le même jour, la durée du lien est passée de 4 heures à **20 minutes**, et la
connexion par mot de passe est conservée, au moins pour le SuperAdmin.

**s12a a été ajoutée hors revue**, le 2026-09-20, après la livraison de s03, en dressant la liste des
paramétrages du premier déploiement : les variables Supabase sont encore exigées au démarrage et deux
formulaires hérités écrivent encore vers ce stockage, alors que l'ADR 004 l'a remplacé. Elle porte un
id intercalé parce que s12b en dépend. Le même jour, `production.yml` et `preview.yml`, qui ne
déployaient rien et échouaient à chaque poussée sur `main`, ont été retirés en Quick Fix, et le
critère correspondant de s12b a été supprimé.

**Ordre vs calendrier contractuel** : la GED (s31, s32) est placée **avant** le vote (s33), alors
que le calendrier du devis annonce l'inverse (vote en décembre 2026, GED en janvier 2027). Arbitrage
client du 6 septembre 2026 : la dépendance prime sur le jalon, le chiffrage calendaire ayant été
établi avant le passage au développement agentique. Le vote publie son PV via les documents partagés
plutôt que de se doter d'un stockage à lui — et il reste de toute façon suspendu à la levée de la
réserve ASL Community.

Les mois indiqués sur les blocs restent ceux du devis : ce sont des **jalons de livraison**, pas des
contraintes d'ordonnancement. Les échéances contractuelles inchangées sont la recette (mars 2027) et
la mise en production (mai 2027).
