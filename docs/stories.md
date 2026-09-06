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
- **Périmètre** : rien du cimetière du PRD ne devient une story. En particulier, aucun plan B de
  connexion pour les membres sans email — le publipostage PDF (s26) est la réponse produite.

## Dépendances externes bloquantes

Trois réserves du devis conditionnent des stories précises. **Ne pas démarrer la story tant que la
réserve n'est pas levée** ; les stories qui les contournent sont ordonnées avant.

| Réserve | Bloque | Contournement prévu |
| --- | --- | --- |
| Accès API Pennylane + clé de rapprochement | s18, et le déclencheur de s27 | s17 livre l'interface et la saisie manuelle |
| Fichier exemple des relevés d'eau (format imposé par Pennylane) | le parseur de s15 | aucun — s15 attend le fichier réel |
| Accès ASL Community + validation statutaire du vote électronique | s31 en entier | aucun, mais le module n'est pas en doute : seul son fournisseur l'est (voir s31) |
| Arbitrage RGPD sur la rétention des données d'un ex-propriétaire | la coupure d'accès de s12 | s12 livre le modèle daté sans purge |

---

# Bloc A — Fondations et site public (sept-oct 2026)

## Story s01-provisionner-association — Provisionner une association

**En tant que** SuperAdmin Zourite Studio **je veux** créer une association et activer ses modules
**afin qu'**elle dispose d'un site isolé sans écrire une ligne de code.

### Complexity

4

### Acceptance criteria

- [ ] Créer une association depuis le back-office SuperAdmin (nom, slug, domaine, modules activés) produit un tenant utilisable immédiatement.
- [ ] Chaque association porte un jeu de drapeaux d'activation de modules, persisté et modifiable depuis le back-office SuperAdmin ; deux associations peuvent avoir des drapeaux différents.
- [ ] Une route rattachée à un module inactif, ou à une clé de module inconnue, répond 404 — pas un lien masqué, pas une page vide (vérifié sur une route de test rattachée à un module fictif).
- [ ] Une requête authentifiée dans le tenant A ne retourne aucune donnée du tenant B, y compris en forgeant l'identifiant de la ressource (test d'accès croisé).
- [ ] La policy RLS refuse la lecture inter-tenant même lorsque la couche applicative est court-circuitée (test au niveau repository).

### Dependencies

Aucune. Première story du projet.

### Agentic notes

Réf. `CDCT §1`, `PRD` (Multi-tenant, complexité 4) et `docs/decisions/001-base-technique-cms.md`.
Le boilerplate fournit déjà `src/db/models/organization-model.ts` et `src/services/organization-service.ts` :
**partir de l'existant, ne pas créer un second modèle de tenant**. Analyser d'abord avec la skill
`codebase-analysis`.

Risque (complexité 4) : le scoping n'est pas rétroactif. Cette story pose la convention (colonne
`organization_id` + policy RLS + helper de scoping) que **chaque story suivante applique** ; une
convention mal posée ici se paie sur 36 stories. Faire trancher la forme exacte en `/ks-architect`
avant `/ks-plan`.

Pièges : le boilerplate porte des notions Stripe/abonnement qui relèvent de la facturation
**plateforme** (Zourite Studio ↔ association) — à ne jamais confondre avec la facturation membres
(s17). RLS Postgres exige que la connexion applicative ne soit pas `SUPERUSER` ni `BYPASSRLS` :
vérifier le rôle utilisé par le pool (`docs/database-pool.md`).

La simulation de rôle du SuperAdmin (`PRD`, Target users) est volontairement **hors de cette
story** : c'est le besoin d'un autre utilisateur, livrable séparément (s37).

**Cette story livre le mécanisme d'activation, pas les modules.** `vote`, `voirie` et `annonces`
arrivent en s31, s32 et s33 — un critère qui les nommerait ici serait intestable au moment de la
livraison et ferait doublon avec le critère « Le module se désactive par tenant » que chacune de ces
trois stories porte déjà. La preuve se fait donc ici sur une route de test rattachée à un module
fictif, et par module chez chacune des trois. Défaut relevé en revue du découpage.

Cimetière : pas une base par tenant, base partagée + RLS.

---

## Story s02-parametres-association — Paramétrer son association

**En tant que** membre du bureau **je veux** modifier les réglages de mon association
**afin de** ne dépendre du prestataire pour aucune adresse ni aucun seuil.

### Complexity

2

### Acceptance criteria

- [ ] Une page de back-office liste les paramètres du tenant et permet de les modifier avec validation (email valide, seuil numérique, booléen).
- [ ] Modifier un paramètre puis le relire renvoie la nouvelle valeur, sans redéploiement ni redémarrage.
- [ ] Un paramètre jamais renseigné se lit à sa valeur par défaut déclarée au registre ; le renseigner puis le vider le ramène à cette même valeur par défaut.
- [ ] Les valeurs de départ de La Fourche (`contact@asl-exemple.test`, responsable forage) se lisent depuis le tenant après exécution de son seed.
- [ ] Un membre non-bureau qui accède à la page de réglages reçoit un refus.

### Dependencies

s01

### Agentic notes

Réf. `V5 §4.6`, `CDCT §4.6`. C'est le socle du critère de succès « aucune donnée propre à La Fourche
codée en dur » : les stories s08, s10, s15, s20 et s27 lisent leurs adresses et seuils **ici**.

**À vérifier en review, pas en test** : aucune de ces valeurs ne doit subsister en constante dans le
code applicatif. C'est une propriété du diff, pas un comportement observable — la placer en critère
d'acceptation produirait un test invérifiable. Le critère testable est celui du défaut au registre.

Le boilerplate a `src/db/models/app-settings-model.ts` — vérifier s'il est global ou scopable par
organisation avant d'en créer un nouveau. Prévoir un registre typé des clés (nom, type, défaut,
description) plutôt qu'un `Record<string, string>` libre : c'est ce registre qui rend la page de BO
générique et la review vérifiable.

---

## Story s03-connexion-lien-magique — Se connecter sans mot de passe

**En tant que** membre propriétaire **je veux** recevoir un lien de connexion par email
**afin de** consulter mon espace sans avoir de mot de passe à retenir.

### Complexity

3

### Acceptance criteria

- [ ] Saisir une adresse email connue envoie un lien de connexion à usage unique et affiche un écran d'attente explicite.
- [ ] Le lien ouvre une session valide ; réutilisé une seconde fois, il est refusé avec un message compréhensible et un bouton pour en redemander un.
- [ ] Un lien de plus de 4 heures est refusé avec le même message et le même bouton.
- [ ] Une adresse email inconnue ne révèle pas si le compte existe (même écran, aucun email envoyé).
- [ ] Les rôles Membre, Bureau, Président(e) et SuperAdmin existent et déterminent ce qui est visible après connexion ; un Membre n'atteint aucune page de back-office.
- [ ] La session est scopée à l'association du membre : elle ne donne accès à aucune donnée d'un autre tenant.

### Dependencies

s01

### Agentic notes

Réf. `V5 §2, §3.2, §3.3`, `CDCT §2, §3.3`. Better Auth est déjà branché
(`src/lib/better-auth/auth.ts`) et gère nativement le magic link : **configurer, ne pas réécrire**.
La validité 4 h est contractuelle — c'est un paramètre, pas la valeur par défaut de la lib.

Public âgé et peu à l'aise : les messages d'erreur doivent être en français simple et proposer
l'action de sortie (redemander un lien), jamais un code d'erreur. À traiter en `/ks-design`.

Piège transport email : le boilerplate envoie via **Resend**, le produit part sur **Brevo**
(contrainte PRD). C'est la première story qui envoie un email — elle doit passer par l'adaptateur
d'envoi tranché en `/ks-architect`, pas par un appel Resend en dur. Les emails transactionnels
(lien magique) et les campagnes (s23) peuvent avoir deux chemins distincts, mais un seul adaptateur.

Cimetière : aucun plan B pour les membres sans email — pas de compte partagé, pas de code postal.

Les quatre rôles sont ici **fixes** ; les rendre configurables en back-office est la story s35.

---

## Story s04-pages-cms — Publier une page du site

**En tant que** membre du bureau **je veux** créer, modifier, publier et dépublier une page
**afin de** faire vivre le site sans intervention du prestataire.

### Complexity

3

### Acceptance criteria

- [ ] Le bureau crée une page (titre, slug, contenu riche, images) et la voit rendue à l'URL publique une fois publiée.
- [ ] Une page en brouillon n'est pas accessible publiquement (404 pour un visiteur) mais reste prévisualisable par le bureau.
- [ ] Dépublier une page la retire du site public sans la supprimer ; la republier la restaure à l'identique.
- [ ] L'insertion d'une image dans une page l'enregistre dans le stockage de fichiers et l'affiche dans le rendu public.
- [ ] Un slug déjà utilisé dans la même association est refusé avec un message de champ ; deux associations peuvent avoir le même slug.
- [ ] Un membre non-bureau ne peut ni créer ni modifier de page.

### Dependencies

s01, s03

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
Référence d'ergonomie visée : éditeur de pages type WordPress/Payload — c'est l'exigence qui a
justifié d'écarter WordPress, elle se paie en `/ks-design`.

Piège stockage : le boilerplate uploade vers **Supabase**, le VPS LWS impose un stockage local
(contrainte PRD). Passer par l'adaptateur de stockage tranché en `/ks-architect` ; ne pas coder
contre `src/services/file-service.ts` tel quel sans avoir vérifié ce point.

Piège cache : le rendu public est caché (`'use cache'` + `cacheTag`), la publication doit invalider
avec `updateTag` — le bureau doit voir son changement immédiatement, pas au bout d'un délai de
revalidation.

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

Réf. `V5 §4.1` (mini-blog), `CDCT §4.1`. **Dérivation du PRD** : pas une ligne du tableau du
périmètre, mais un contenu du CMS générique (ligne « CMS de pages génériques ») et un support du
critère de succès « le bureau crée, modifie et publie une page, une actualité et une analyse d'eau
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
**Dérivation du PRD** : pas une ligne du tableau du périmètre, mais une exigence du « Why kill it »
n°2 (« une vitrine publique éditable et référencée […] présentation du bureau ») et du critère
« le bureau doit pouvoir tout éditer sans intervention du prestataire ».

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

- [ ] Activer le bandeau avec un message l'affiche sur toutes les pages publiques et sur l'espace membre.
- [ ] Modifier le message met à jour le bandeau immédiatement, sans redéploiement.
- [ ] Désactiver le bandeau le retire de toutes les pages.
- [ ] N'importe quel membre du bureau peut l'activer, le modifier et le retirer, sans restriction supplémentaire.

### Dependencies

s01, s03

### Agentic notes

Réf. `V5 §4.2`, `CDCT §4.2`. Volontairement sans workflow : pas de validation, pas de programmation
horaire, pas de niveaux de gravité — le CDC n'en demande pas.

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
- [ ] Au-delà d'un nombre d'envois par adresse IP et par heure fixé en paramètre de tenant, une soumission supplémentaire est refusée avec un message explicite ; en deçà du seuil, elle passe.

### Dependencies

s02, s04

### Agentic notes

Réf. `V5 §4.1, §4.6`, `CDCT §4.1`. Exigence explicite : **l'email ne suffit pas**, le message doit
être persisté et consultable en BO. Un agent qui n'implémente que la notification rate la story.

Adresse par défaut = celle de la présidente, lue dans les paramètres du tenant (s02), jamais en dur.

Distinct du formulaire « Questions au bureau » de l'espace membre (s20), qui est identifié et routé
par catégorie. Ne pas fusionner les deux modèles.

Le boilerplate a `src/db/models/user-submission-model.ts` — vérifier s'il convient avant d'en créer
un nouveau. Server Action : suivre `rule-safe-server-action` et `rule-form-front-and-back`
(validation Zod partagée client/serveur, messages traduits).

---

## Story s09-analyses-eau — Publier un résultat d'analyse d'eau

**En tant que** membre du bureau **je veux** publier rapidement un résultat d'analyse d'eau
**afin que** tout visiteur puisse le consulter sans compte.

### Complexity

2

### Acceptance criteria

- [ ] Publier une analyse (date, affiche, texte facultatif, PDF) la fait apparaître en tête de la page publique des analyses.
- [ ] Le PDF se télécharge depuis la page publique sans authentification.
- [ ] Le texte est facultatif : une publication sans texte s'affiche correctement.
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

Stockage PDF : même adaptateur que s04 (pas Supabase, voir `/ks-architect`). Servir le PDF sans
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
- [ ] Les catégories de signalement (fuite, voirie, éclairage, nuisance…) sont administrables par le bureau, pas figées dans le code.
- [ ] Modifier les adresses de notification dans les paramètres (s02) change les destinataires du signalement suivant.
- [ ] Un signalement public est enregistré sans lien vers un membre, même lorsque les coordonnées saisies correspondent exactement à celles d'un membre existant (aucun rapprochement automatique).

### Dependencies

s02, s04

### Agentic notes

Réf. `V5 §4.3, §4.6`, `CDCT §4.3, §4.6`. Le PRD **généralise** au-delà de la fuite d'eau (voirie,
éclairage, nuisance) : le modèle est un signalement catégorisé, pas une table `fuites`. La V5 parle
déjà de « fuite ou d'incident » au §5.6.

Deux destinataires par défaut chez La Fourche (contact général + responsable forage), tous deux
**paramétrables** (s02) car « susceptibles de changer au fil des années ».

Cette story livre la version **publique anonyme**. La version membre identifiée avec suivi de statut
est s20 et réutilise ce modèle et ce workflow — concevoir le lien vers un membre comme nullable dès
maintenant pour éviter une migration en s20.

---

## Story s11-seo — Rendre le site référençable

**En tant que** visiteur **je veux** trouver le site de l'association dans un moteur de recherche
**afin d'**accéder à ses informations sans en connaître l'adresse.

### Complexity

2

### Acceptance criteria

- [ ] Le sitemap liste toutes les pages publiées du tenant et aucune page en brouillon ; publier une page l'y ajoute.
- [ ] Chaque page publique expose un titre, une description et des métadonnées de partage renseignés par le bureau, avec un repli sur les valeurs du tenant si le champ est vide.
- [ ] `robots.txt` autorise l'indexation des pages publiques et exclut le back-office et l'espace membre.
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
- [ ] Une donnée datée d'avant la vente (relevé, facture, document) reste rattachée à l'ancien propriétaire et n'apparaît jamais chez le nouveau — vérifié par un test sur une parcelle vendue.
- [ ] Une parcelle ne peut pas avoir deux propriétaires sur des périodes qui se chevauchent ; la tentative est refusée avec un message explicite.
- [ ] Un membre possédant plusieurs parcelles est un seul compte, avec la liste de ses parcelles.
- [ ] Le bureau crée une fiche membre **sans adresse email** : la fiche existe, aucun compte de connexion n'est créé, et elle est marquée « joignable par courrier uniquement ».
- [ ] Renseigner une adresse email sur une fiche « courrier uniquement » lui ouvre un compte connectable ; la retirer referme l'accès sans supprimer la fiche ni son historique.
- [ ] Un membre ne voit que ses propres parcelles ; l'accès à la fiche d'un autre membre est refusé.

### Dependencies

s01, s03

### Agentic notes

Réf. `V5 §5.1`, `CDCT §5.1`. **Cœur du modèle de données du produit** — tout le bloc B en dépend.

Risque (complexité 4) : ce n'est pas une clé étrangère `parcelle → membre_actuel`, mais une relation
**datée** (période de propriété). Le piège classique de l'agent est de coder la FK simple, qui passe
tous les tests naïfs et casse silencieusement le jour de la première vente. Le test de la parcelle
vendue est le test qui compte — l'écrire en premier (`tdd-skill`).

Résolution du propriétaire « au moment des faits » : prévoir dès maintenant la fonction qui, pour une
parcelle et une date, retourne le propriétaire d'alors. s16, s17, s26 et s30 l'appellent toutes.

Le marquage « joignable par courrier uniquement » est un **attribut du modèle membre, porté ici** et
non par l'import (s13) : le bureau crée des fiches à la main tout au long de la vie de l'association
— une parcelle vendue à un acquéreur sans email est le cas nominal, pas l'exception. C'est ce champ
que s26 (publipostage) et s23 (cibles de campagne) consomment ; sans lui en s12, un membre créé
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
multi-parcelles (s17/s18), le site n'agrège rien.

---

## Story s13-import-initial-membres — Charger la liste des membres existants

**En tant que** SuperAdmin **je veux** importer la liste des propriétaires fournie par l'association
**afin d'**ouvrir le service sans saisie manuelle de plusieurs centaines de fiches.

### Complexity

3

### Acceptance criteria

- [ ] L'import se fait depuis le back-office, par téléversement du fichier : aucun script à lancer, aucun accès direct à la base, aucune ligne de code à écrire pour une nouvelle association.
- [ ] Importer un fichier (nom, email, parcelle) crée les membres et leurs rattachements de parcelle dans le tenant visé.
- [ ] Plusieurs lignes portant le même propriétaire produisent **un seul** compte avec plusieurs parcelles, pas plusieurs comptes.
- [ ] Une ligne sans email crée le membre et sa parcelle, sans compte de connexion, et le marque comme joignable par courrier uniquement.
- [ ] Les lignes invalides sont rejetées ligne à ligne, listées dans un rapport, et n'empêchent pas l'import des lignes valides.
- [ ] Relancer le même import ne duplique aucun membre ni aucune parcelle.

### Dependencies

s12

### Agentic notes

Réf. `PRD` (« Import initial des membres d'une association », complexité 2), `V5 §2`, `CDCT §2`.
Import réalisé par le prestataire au démarrage, puis création unitaire par le bureau (couverte par
s12).

Risque (complexité 3, relevée de 2 en revue du découpage) : la **clé de dédoublonnage n'est pas
tranchée**, et son mode de défaillance est grave — fusionner deux propriétaires distincts leur
donnerait accès aux documents et aux factures l'un de l'autre. Ce n'est pas un import anodin : c'est
un import qui crée des identités. En cas d'ambiguïté, remonter au rapport pour arbitrage humain,
jamais fusionner d'office.

**Pourquoi un écran et non un script** : le critère de succès du PRD exige qu'une deuxième
association soit provisionnée « sans écrire une ligne de code : uniquement configuration, activation
de modules et chargement de sa liste de membres ». Un script maintenu par le prestataire et relancé à
la main pour chaque client échouerait à ce critère — et il y a six associations à charger, pas une.
C'est ce qui justifie de chiffrer cette story au périmètre plutôt que de la traiter en opération
d'installation.

Cette story pose le **motif d'import du produit** (téléversement, validation ligne à ligne, rapport
d'erreurs, idempotence) que s15 réutilise pour les relevés d'eau. Le concevoir réutilisable ici
évite deux implémentations divergentes ; c'est aussi pourquoi s13 est ordonnée avant s15.

**Comptage tranché par le client le 6 septembre 2026** — la divergence entre `V5 §2` (300) et
`V5 §3.3` (« 100 des 400 ») est levée : **400 propriétaires au total**, dont **300 avec une adresse
email** (fiche membre + compte connectable) et **100 sans** (fiche membre, aucun compte, joignables
par courrier uniquement). L'import crée donc 400 fiches et 300 comptes.

Les deux chiffres du CDC n'étaient pas contradictoires, ils comptaient deux choses différentes :
les comptes d'un côté, les propriétaires de l'autre. C'est le total de 400 qui dimensionne la
volumétrie (s30) et la cible du publipostage (s26), pas le 300.

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

Ne pas confondre avec l'import des relevés d'eau (s15), qui est annuel et d'un autre format.

---

## Story s14-coordonnees-membre — Mettre à jour ses coordonnées

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

Le boilerplate a un formulaire de profil équivalent
(`src/components/features/user/edit-user-profile.tsx`) : s'en inspirer plutôt que réinventer, en
suivant `rule-form-front-and-back` et `rule-zod-client-server-internationalization`.

Attention : changer l'email de contact ne doit pas changer silencieusement l'identifiant de
connexion (s03) — trancher explicitement en `/ks-design` et écrire le test correspondant.

---

## Story s15-import-releves-eau — Importer les relevés d'eau annuels

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

s02, s12

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

## Story s16-historique-consommation — Consulter sa consommation d'eau

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

s15

### Agentic notes

Réf. `V5 §5.5`, `CDCT §5.5`. C'est **l'angle n°1 du PRD** (la ressource individuelle mesurée) qui
devient visible pour la première fois : le soin porté à la lisibilité du tableau compte autant que
l'exactitude du calcul.

Le critère d'autorisation croisée est un critère de succès explicite du PRD (« et à rien qui
appartienne à un autre membre »). Il est vérifié ressource par ressource : ici, en s16, s18, s20,
s22 et s30.

Piège cache : donnée par utilisateur — **jamais** de `'use cache'`. Lecture derrière `<Suspense>`
avec le motif `'use cache: private'` du DAL décrit dans
`.claude/rules/01-presentation/rule-react-cache-next-cache.md`. Ne jamais exporter une fonction
cachée prenant un `memberId` en argument : un appelant pourrait demander les données d'un autre.

---

## Story s17-factures-liste — Consulter ses factures

**En tant que** membre propriétaire **je veux** voir la liste de mes factures et leur statut
**afin de** savoir ce que je dois et récupérer mes justificatifs.

### Complexity

3

### Acceptance criteria

- [ ] Un membre connecté voit ses factures (date, objet, montant, statut) triées par date décroissante.
- [ ] Le statut est affiché tel qu'il est fourni par la source, y compris les statuts intermédiaires — jamais réduit à payé/impayé.
- [ ] Un membre ne voit aucune facture d'un autre membre, y compris en forgeant l'identifiant (test d'autorisation croisée).
- [ ] Le bureau saisit et met à jour manuellement une facture pour un membre, et le membre la voit apparaître.
- [ ] Le service de facturation est appelé derrière une interface : changer d'implémentation ne demande aucune modification de la présentation (prouvé par un test doublant l'implémentation).

### Dependencies

s12

### Agentic notes

Réf. `V5 §5.2`, `CDCT §5.2`, `PRD` (« derrière une interface interchangeable, car toute ASL a besoin
de la fonction mais pas forcément de Pennylane »).

Cette story livre **l'interface et l'implémentation manuelle** — délibérément indépendante de la
réserve Pennylane, pour que le bloc B ne soit pas bloqué par une condition suspensive du devis.
L'implémentation Pennylane est s18 et ne doit rien changer ici.

Piège de conception : ne pas modéliser le statut en booléen ni en énumération fermée déduite des
seuls statuts connus aujourd'hui — Pennylane en remonte davantage, et ils doivent passer tels quels.

Ne jamais confondre avec la facturation **plateforme** (Stripe, Zourite Studio ↔ association) portée
par le boilerplate : deux systèmes distincts, deux modèles distincts.

Cimetière : aucun traitement de paiement, aucune donnée bancaire, aucun appel de fonds, aucun
tantième.

---

## Story s18-factures-pennylane — Remonter les factures depuis Pennylane

**En tant que** membre propriétaire **je veux** que mes factures Pennylane apparaissent automatiquement
**afin de** ne pas dépendre d'une saisie manuelle du bureau.

### Complexity

3

### Acceptance criteria

- [ ] L'implémentation Pennylane s'active par configuration de tenant et remplace la saisie manuelle sans modification de l'interface membre.
- [ ] Les factures du membre sont remontées avec leur statut Pennylane d'origine, y compris les statuts intermédiaires.
- [ ] Le rapprochement entre un compte du site et une fiche client Pennylane suit la clé retenue, et un compte non rapproché est signalé au bureau plutôt que silencieusement vide.
- [ ] Quand l'API fournit un PDF, un bouton de téléchargement le sert au membre.
- [ ] Quand l'API n'en fournit pas, la ligne de facture indique explicitement que le PDF n'est pas disponible et n'affiche aucun bouton — jamais un lien mort.
- [ ] Une indisponibilité de l'API Pennylane affiche les dernières données connues avec la date de dernière synchronisation, sans page en erreur.
- [ ] Le schéma de facture et les appels sortants ne comportent aucun champ de moyen de paiement (numéro de carte, IBAN, mandat) — vérifié par un test sur la forme des données échangées.

### Dependencies

s17

### Agentic notes

Réf. `V5 §5.2`, `CDCT §5.2`, `Annexe A`. **Bloquée par une condition suspensive du devis** : accès
API Pennylane **et** clé de rapprochement (email ? n° de parcelle ? id client Pennylane ?) non
tranchés. Quelle que soit la clé retenue, elle est stockée comme **attribut** de la fiche membre, à
côté de sa clé primaire — jamais à la place. Le rapprochement avec un système externe ne redéfinit
pas l'identité interne, sinon un changement d'outil de facturation devient une migration d'identités. `/ks-research` vérifie d'abord que l'accès est fourni ; sinon la story attend et le bloc B
continue sans elle grâce à s17.

Implémentation d'une interface existante (s17), pas une refonte : si cette story touche à la
présentation, le découpage a échoué.

Adaptateur fonctionnel autour du SDK/HTTP (convention du dépôt : pas d'objet à état pour une
intégration), secrets par `@/env`, jamais `process.env` en direct.

---

## Story s19-redirection-paiement — Payer sa facture

**En tant que** membre propriétaire **je veux** être redirigé vers l'espace de paiement de l'association
**afin de** régler ma facture sans quitter mon parcours.

### Complexity

1

### Acceptance criteria

- [ ] Une facture impayée affiche un bouton de paiement qui ouvre l'espace de paiement externe configuré pour le tenant.
- [ ] L'URL de redirection est un paramètre de tenant, pas une constante du code.
- [ ] Le parcours de paiement se réduit à un lien sortant : aucun formulaire de paiement n'est rendu par le site et aucun champ de moyen de paiement n'existe dans son schéma de données (test sur le formulaire et sur le schéma).
- [ ] Une facture déjà réglée n'affiche pas de bouton de paiement.

### Dependencies

s02, s17

### Agentic notes

Réf. `V5 §5.3`, `CDCT §5.3`. Simple lien sortant, d'où la complexité 1. C'est la story la plus courte
du projet et c'est volontaire : tout le reste est chez Pennylane.

Enjeu réglementaire, pas technique : cette frontière est ce qui maintient le projet hors DSP2/PCI
(angle n°4 du PRD). Toute tentative d'« améliorer » en capturant un moyen de paiement sort du
périmètre et doit être refusée en review.

---

## Story s20-signalement-membre — Suivre son signalement depuis son espace

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

## Story s21-questions-bureau — Poser une question au bureau

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

s02, s12

### Agentic notes

Réf. `V5 §5.7`, `CDCT §5.7`. Formulaire **distinct** du contact public (s08) : identifié, catégorisé,
routé.

Le modèle de catégories (`{ nom, email_destination? }`, plafond 10, administrable) est explicitement
prévu pour être **réutilisé par les petites annonces (s33)** — `CDCT §5.8` demande d'envisager un
modèle commun plutôt que deux implémentations. Le concevoir générique ici, avec un discriminant de
domaine, économise une refonte en s33 ; le décider en `/ks-design`, pas au moment de coder s33.

---

## Story s22-notes-internes-membre — Tenir les notes internes sur un membre

**En tant que** membre du bureau **je veux** consigner des notes et l'historique des échanges sur un membre
**afin que** le suivi survive au renouvellement du bureau.

### Complexity

2

### Acceptance criteria

- [ ] Le bureau ajoute une note datée et signée sur la fiche d'un membre, et la retrouve à la consultation suivante.
- [ ] La fiche membre affiche l'historique chronologique des notes et des échanges enregistrés.
- [ ] Un membre n'a **aucun** accès à ses notes internes ni à celles d'un autre : ni page, ni API, ni export (test d'autorisation explicite).
- [ ] Une note peut être modifiée ou supprimée par le bureau, l'auteur et la date de dernière modification restant visibles.

### Dependencies

s12

### Agentic notes

Réf. `PRD` (« Notes internes et historique par membre », inspiré de Lotisoft), `V5 §2` (continuité du
bureau).

**Sensible RGPD** : ce sont des notes sur des personnes physiques, écrites par des bénévoles. Deux
conséquences pour l'implémentation : l'étanchéité côté membre est un test, pas une intention ; et
ces notes doivent être **incluses dans l'export de données** (s36) au titre du droit d'accès.
Le noter dans le plan de s36.

Ne pas exposer ces notes dans une réponse d'API partagée avec la présentation membre — le risque
n'est pas la page, c'est le DTO trop large réutilisé.

---

# Bloc C — Communication (nov-déc 2026)

## Story s23-campagnes-email — Envoyer une campagne email aux membres

**En tant que** membre du bureau **je veux** envoyer une campagne email aux membres
**afin de** les informer sans passer par ma messagerie personnelle.

### Complexity

4

### Acceptance criteria

- [ ] N'importe quel membre du bureau compose une campagne, choisit un des 4 modèles ou le mode libre, et l'envoie aux membres disposant d'une adresse email.
- [ ] Deux cibles standard sont proposées à l'envoi : **tous les membres** et **les membres en impayé**. La cible « impayés » est calculée au moment de l'envoi à partir du service de facturation (s17), pas saisie à la main.
- [ ] La cible « impayés » fonctionne avec la saisie manuelle des factures comme avec une implémentation externe : changer d'implémentation ne change pas la cible.
- [ ] Le nombre de destinataires de la cible retenue est affiché avant l'envoi, en distinguant ceux qui ont un email de ceux qui n'en ont pas.
- [ ] Tout envoi, modèle ou campagne libre, porte le même habillage : en-tête au logo de l'association et pied de page avec mentions et lien de désinscription.
- [ ] Les variables dynamiques (nom, parcelle, date) sont remplacées par les valeurs du destinataire ; une variable inconnue est signalée avant l'envoi, pas laissée telle quelle dans l'email reçu.
- [ ] Un aperçu montre le rendu final avec les données d'un destinataire réel avant l'envoi définitif.
- [ ] La campagne envoyée est archivée avec son contenu, sa cible et sa date, et consultable en back-office.
- [ ] Une campagne d'une association ne peut pas cibler les membres d'une autre.

### Dependencies

s02, s03, s12, s17

### Agentic notes

Réf. `V5 §8.1`, `CDCT §8.1`. Les 4 modèles : relance manuelle, facture disponible, convocation AG,
publication de documents post-AG. **Leur contenu détaillé reste à rédiger avec le bureau**
(`Annexe A`) — `/ks-research` vérifie s'il est disponible ; à défaut, livrer les modèles avec un
contenu provisoire clairement marqué et les variables déjà câblées, la rédaction n'étant pas du code.

Risque (complexité 4, relevée de 3 en revue du découpage) : la story groupe beaucoup — composition,
4 modèles + mode libre, gabarit commun, moteur de variables, aperçu, archivage, **et** le calcul de la
cible « impayés » depuis l'interface s17. Le PRD chiffre la *feature* « Campagnes email Brevo » à 3 ;
la *story* vaut 4 parce qu'elle porte en plus les deux cibles standard, que le PRD suppose déjà
acquises dans sa ligne « Groupes de destinataires ». Si le plan dépasse dix tâches, scinder le calcul
de cible plutôt que d'étaler l'exécution.

Piège explicite du `CDCT §8.1` : **la campagne libre n'est pas un cas à part sans habillage**. Le
gabarit commun (header/footer) enveloppe aussi bien les 4 modèles que le mode libre. Un agent qui
traite la campagne libre comme un envoi brut rate la story.

L'envoi de facture double celui de Pennylane (problème de délivrabilité connu), il ne le remplace
pas.

**Les deux cibles standard sont livrées ici, pas ailleurs.** `V5 §8.3` oppose les campagnes manuelles
(tous les membres) aux relances (sous-groupe impayés) : le modèle « relance manuelle », l'un des 4
modèles imposés, a besoin de la cible impayés pour exister. s25 ajoute des groupes composés à la
main **au-delà** de ces deux cibles, s27 réutilise la même cible pour les relances automatiques —
aucune des deux ne la fournit. C'est le trou relevé en revue du découpage.

Le statut d'impayé vient du système de facturation, donc de **l'interface de s17** — jamais d'un
appel direct à Pennylane. Passer par l'implémentation Pennylane (s18) rendrait la relance manuelle
otage de la condition suspensive du devis, alors qu'elle doit fonctionner dès la saisie manuelle.

Le gabarit commun (logo, mentions légales, adresse de désinscription) est alimenté par les
paramètres du tenant (s02), pas par des constantes.

Transport Brevo (voir s03) : plafond de 300 emails/jour. Cette story envoie **sans** gestion du
dépassement — c'est s24 qui l'ajoute. Concevoir le déclenchement d'envoi de façon à pouvoir
l'intercepter, sinon s24 imposera de tout reprendre.

---

## Story s24-envoi-echelonne — Scinder une campagne au-delà de 300 destinataires

**En tant que** membre du bureau **je veux** que les grosses campagnes se scindent toutes seules
**afin de** ne pas dépasser le quota d'envoi ni générer de surcoût.

### Complexity

3

### Acceptance criteria

- [ ] Une campagne dont le nombre de destinataires actifs dépasse le seuil d'envoi du tenant (300 par défaut, quota Brevo) part en deux envois : le jour même puis le lendemain, sans aucune action du bureau.
- [ ] Le bureau voit l'état de la campagne (première part envoyée, seconde part programmée pour telle date) et le nombre de destinataires de chaque part.
- [ ] Une campagne dont le nombre de destinataires est inférieur ou égal au seuil part en un seul envoi.
- [ ] Le seuil est un paramètre de tenant : le porter à 500 fait partir en un seul envoi une campagne de 400 destinataires, sans redéploiement.
- [ ] Une campagne dépassant deux fois le seuil est scindée en autant de parts quotidiennes que nécessaire, chacune sous le seuil, sans qu'aucune journée ne dépasse le quota.
- [ ] Un redémarrage du serveur entre les deux parts ne perd pas la seconde part et ne la duplique pas.
- [ ] Un destinataire ne reçoit jamais deux fois la même campagne, même si le traitement est relancé.

### Dependencies

s02, s23

### Agentic notes

Réf. `V5 §8.2`, `CDCT §8.2`, et critère de succès du PRD (« automatiquement scindée sur deux jours,
sans action du bureau »).

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

Idempotence et persistance de la seconde part : la planification survit au redémarrage. Le
boilerplate embarque Inngest (`docs/inngest.md`) — évaluer en `/ks-research` s'il tient sur le VPS
LWS avant de retenir un `setTimeout` en mémoire, qui ne satisfait aucun des deux derniers critères.

---

## Story s25-groupes-destinataires — Composer un groupe de destinataires

**En tant que** membre du bureau **je veux** définir mes propres groupes de destinataires
**afin de** cibler une campagne au-delà de « tous » et « les impayés ».

### Complexity

2

### Acceptance criteria

- [ ] Le bureau crée un groupe nommé et y ajoute ou retire des membres depuis la liste des membres.
- [ ] Un groupe est sélectionnable comme cible d'une campagne, à la place de « tous les membres ».
- [ ] Le nombre de destinataires du groupe est affiché avant l'envoi, en distinguant ceux qui ont un email de ceux qui n'en ont pas.
- [ ] Supprimer un groupe n'affecte ni les membres qu'il contenait ni les campagnes déjà envoyées.
- [ ] Un groupe est propre à son association et n'est jamais visible d'une autre.

### Dependencies

s23

### Agentic notes

Réf. `PRD` (« Groupes de destinataires personnalisés », inspiré de Lotisoft), `V5 §8.3` pour les deux
cibles existantes.

La distinction avec/sans email dans le décompte prépare s26 : un groupe est aussi la cible d'un
publipostage papier, pas seulement d'un envoi email.

Groupes composés à la main par le bureau, **en plus** des deux cibles standard livrées par s23 (tous
les membres, membres en impayé) — cette story les complète, elle ne les remplace pas. C'est
exactement le « au-delà des deux cibles actuelles » du PRD.

Pas de segmentation dynamique par critère au-delà de ces deux cibles : ni le CDC ni le PRD ne la
demandent, et elle ouvrirait un chantier de règles à maintenir.

---

## Story s26-publipostage-pdf — Générer le courrier des membres sans email

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

s12, s23

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

## Story s27-relances-impayes — Relancer automatiquement les impayés

**En tant que** membre du bureau **je veux** que les impayés soient relancés automatiquement
**afin de** ne pas suivre à la main des dizaines de relances.

### Complexity

4

### Acceptance criteria

- [ ] Quand la relance automatique est activée pour le tenant, un membre en impayé reçoit jusqu'à 3 relances espacées de 3, 2 puis 1 semaine.
- [ ] Désactivée, aucune relance automatique ne part, et le reste des campagnes fonctionne normalement.
- [ ] Une facture réglée entre deux relances interrompt la série ; aucune relance ultérieure ne part.
- [ ] Un membre ne reçoit jamais deux fois la même relance, même si le traitement est rejoué (idempotence vérifiée par un test).
- [ ] Les relances ne ciblent que les membres en impayé ; aucun membre à jour n'en reçoit.
- [ ] Une page de back-office liste, par impayé : nom du membre, numéro de parcelle, date de la facture, nombre et dates des relances déjà envoyées.
- [ ] Les membres en impayé sans email apparaissent dans la page de suivi, marqués « courrier », avec une action qui génère leur publipostage de relance (s26) ; ils ne sont ni relancés par email ni omis de la liste.

### Dependencies

s02, s17, s23, s24, s26

### Agentic notes

Réf. `V5 §8.3`, `CDCT §8.3`.

Risque (complexité 4) : trois pièges se cumulent. **Planification** (une série par facture, décalée
de semaines, qui survit aux redéploiements), **idempotence** (un traitement rejoué ne doit pas
renvoyer une relance déjà partie — un test explicite, pas une intention), et **ciblage** (le
sous-groupe impayés est recalculé à chaque échéance, pas figé au lancement de la série).

**Dépendance externe** : le champ Pennylane qui fait foi pour « impayé » et sa date n'est pas connu
(`Annexe A`). La série de relances se conçoit contre l'interface de facturation de s17 ; avec la
seule implémentation manuelle, la story est testable de bout en bout. Ne pas attendre s18 pour la
livrer, mais ne pas coder de détection Pennylane spécifique ici.

L'activation est un **paramètre de tenant** (s02) : comportement développé pour tous, activé au cas
par cas. C'est explicitement demandé par le PRD.

Hors périmètre de cette story : la détection automatique d'une nouvelle facture. La notification
« facture disponible » reste à **déclenchement manuel** par le bureau (`CDCT §8.3`).

---

## Story s28-stats-campagnes — Voir si les campagnes sont lues

**En tant que** membre du bureau **je veux** consulter les taux d'ouverture et de clic de mes campagnes
**afin de** savoir si l'information passe.

### Complexity

2

### Acceptance criteria

- [ ] La fiche d'une campagne envoyée affiche le nombre d'envois, d'ouvertures et de clics, avec les taux correspondants.
- [ ] Une campagne scindée en deux parts (s24) présente des statistiques consolidées sur l'ensemble de la campagne.
- [ ] Des statistiques indisponibles ou pas encore consolidées côté fournisseur s'affichent comme telles, sans chiffre inventé ni zéro trompeur.
- [ ] Les statistiques d'une association ne sont jamais visibles d'une autre.

### Dependencies

s23, s24

### Agentic notes

Réf. `PRD` (« Statistiques d'ouverture et de clic », inspiré de Lotisoft), `V5 §8.1`.

Brevo mesure déjà : **restitution, pas mesure**. Aucun pixel de tracking, aucun compteur maison — ce
serait à la fois du travail dupliqué et une surface RGPD supplémentaire.

Distinguer « 0 ouverture » de « statistique pas encore disponible » : c'est le critère qui évite au
bureau de conclure à tort que personne ne lit ses campagnes.

---

# Bloc D — Espace documentaire (janvier 2027 au contrat — avancé avant le vote)

## Story s29-documents-partages — Consulter les documents de l'association

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

s03, s12

### Agentic notes

Réf. `V5 §7.1`, `CDCT §7`. Volumétrie modeste : un ordre du jour et un compte-rendu d'AG par an,
plus les statuts.

Point de sécurité central : le fichier ne doit **jamais** être servi par une URL publique devinable.
L'accès passe par une route qui vérifie la session et le tenant avant de servir le contenu. Un
`<a href>` vers un chemin de stockage direct est un échec de review.

Stockage : adaptateur tranché en `/ks-architect` (stockage local sur le VPS, pas Supabase).
Sauvegarde et volumétrie du VPS (100 Go) à prendre en compte dès cette story.

---

## Story s30-documents-nominatifs — Accéder à ses documents personnels

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

s12, s29

### Agentic notes

Réf. `V5 §7.1`, `CDCT §7`. Volumétrie : une facture et une convocation par membre et par an sur
**400 propriétaires** (comptage tranché en s13), soit ~800 documents nominatifs par an — et non 600 :
les 100 membres sans email ont eux aussi des factures et des convocations, ils les reçoivent par
courrier (s26). Prévoir la marge de croissance.

Corollaire à ne pas manquer : un dossier nominatif existe pour un membre **sans compte**. Le
cloisonnement du stockage ne peut donc pas être indexé sur l'identifiant de connexion — il s'indexe
sur la **clé primaire de la fiche membre** (règle transverse), qui existe avec ou sans compte.

Risque (complexité 4) : l'exigence n'est pas « filtrer à la lecture » mais **« exclure tout accès
croisé même en cas de bug d'autorisation »** (`CDCT §7`). C'est une exigence de défense en
profondeur : cloisonnement au niveau du stockage **en plus** de l'autorisation applicative. Un agent
qui implémente un filtre `WHERE member_id = ?` sur un répertoire commun a produit exactement ce que
le CDC refuse. À trancher en `/ks-architect` (arborescence, nommage non devinable, droits) avant
`/ks-plan`.

Le critère de la parcelle vendue s'appuie sur la résolution datée de s12 : le document appartient au
propriétaire **au moment des faits**.

C'est le critère de succès n°1 du PRD (« et à rien qui appartienne à un autre membre ») dans sa forme
la plus exigeante. Prévoir la review en conséquence.

Cimetière : pas de classification automatique des documents par IA.

---

# Bloc E — Vote (décembre 2026 au contrat — replacé après la GED, dont il dépend)

## Story s31-vote-asl-community — Voter à distance et publier les résultats

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
- [ ] Le module se désactive par tenant : désactivé, ni la page de vote ni les résolutions n'existent, et le reste du site est intact.
- [ ] Le service de vote est appelé derrière une interface : changer de fournisseur ne demande aucune modification de la présentation (prouvé par un test doublant l'implémentation).

### Dependencies

s02, s12, s29

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
Conséquence pour le découpage : aucune autre story ne doit dépendre de celle-ci — c'est pourquoi s35
n'en dépend plus.

⚠️ **Attention au périmètre si le fournisseur change** : brancher un autre prestataire est une
nouvelle implémentation de l'interface, donc du travail prévu. Développer le moteur de vote
nous-mêmes est autre chose : dépouillement, quorum et procurations sont explicitement au cimetière du
PRD. Le PRD envisage l'internalisation comme une évolution future (angle n°6), pas comme une story de
ce projet — elle appellerait un devis complémentaire et un passage par `/ks-prd`, pas une extension
silencieuse de s31.

Cimetière : **aucune logique de vote** — ni dépouillement, ni quorum, ni procurations, ni émargement,
ni synchronisation temps réel. Le site redirige et publie, point. Un agent qui commence à compter
des voix est hors périmètre.

Restriction présidente : c'est aujourd'hui la **seule** action réservée du produit. Elle est codée
ici sur les rôles fixes de s03 ; s35 la rendra configurable sans la changer.

Dépendance à s29 : le PV et les résultats sont publiés comme documents partagés — ils s'appuient
sur la GED, qui est donc ordonnée avant. Les convocations, elles, sont nominatives (s30).

---

# Bloc F — Modules et fonctionnalités complémentaires (fév 2027)

## Story s32-module-voirie — Suivre l'état des chemins et portails

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

s01, s04

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

---

## Story s33-petites-annonces — Publier une annonce entre membres

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
- [ ] Le module se désactive par tenant : désactivé, ni la page ni le formulaire de soumission n'existent.

### Dependencies

s12, s21

### Agentic notes

Réf. `V5 §5.8`, `CDCT §5.8`. Catégories de départ : entretien d'espaces verts, prêt de matériel,
recherche de matériel, services, divers. L'« annuaire des services » séparé est abandonné, fusionné
ici comme catégorie.

Réutiliser le modèle de catégories de s21 (plafond 10, administrable) plutôt que d'en écrire un
second — c'est la raison pour laquelle s21 est ordonnée avant.

Ne pas confondre avec la page « Contacts utiles » (contenu CMS géré par le bureau, s04) : celle-ci
est du contenu généré par les membres avec workflow de modération. Deux modèles distincts,
explicitement.

Activable par tenant parce que la modération obligatoire crée une charge récurrente pour un bureau
bénévole (`PRD`) — c'est une décision produit, pas une commodité technique.

Cimetière : pas de messagerie privée entre membres. Le contact passe par les coordonnées que
l'auteur choisit d'afficher dans son annonce, rien d'autre.

---

## Story s34-modeles-documents — Générer un document depuis un modèle

**En tant que** membre du bureau **je veux** générer une convocation ou un courrier type pré-rempli
**afin de** ne pas repartir d'une page blanche à chaque AG.

### Complexity

3

### Acceptance criteria

- [ ] Le bureau crée un modèle de document avec des variables (nom, parcelle, date, association) et le retrouve dans une liste réutilisable.
- [ ] Générer un document depuis un modèle pour un membre remplace les variables par ses valeurs et produit un fichier téléchargeable.
- [ ] Une génération en lot pour un groupe (s25) produit un document par membre, déposable directement dans les dossiers nominatifs (s30).
- [ ] Une variable inconnue est signalée à l'enregistrement du modèle, pas laissée telle quelle dans le document produit.
- [ ] Les modèles d'une association ne sont jamais visibles d'une autre.

### Dependencies

s25, s26, s30

### Agentic notes

Réf. `PRD` (« Modèles de documents réutilisables », inspiré de Lotisoft) : convocation, PV, courrier
type — **au-delà des modèles d'email** (s23), qui restent un système distinct.

Réutiliser le moteur de variables et de génération PDF de s26 : c'est la même mécanique appliquée à
un document unitaire plutôt qu'à un publipostage. Si cette story réintroduit un second moteur, le
découpage a échoué.

Le dépôt en lot dans les dossiers nominatifs passe par le mécanisme de s30 — ne pas écrire dans le
stockage en contournant sa couche de cloisonnement.

---

## Story s35-permissions-configurables — Ajuster les droits par rôle

**En tant que** présidente **je veux** régler ce que chaque rôle peut faire depuis le back-office
**afin de** réserver ou d'ouvrir une action sans dépendre du prestataire.

### Complexity

4

### Acceptance criteria

- [ ] Une page de back-office présente la matrice rôle × action et permet d'accorder ou de retirer un droit.
- [ ] Retirer un droit à un rôle bloque immédiatement l'action pour ses titulaires, en interface **et** côté serveur (test sur l'appel serveur direct, pas seulement sur le bouton masqué).
- [ ] La matrice par défaut reproduit exactement le comportement livré par les stories précédentes : sans modification, rien ne change.
- [ ] Une story ultérieure qui introduit une action réservée la déclare, et cette action apparaît dans la matrice sans modification du code de la matrice (vérifié en enregistrant une action de test).
- [ ] Les actions d'un module désactivé, ou d'un module non encore livré, n'apparaissent pas dans la matrice et n'y laissent pas de ligne orpheline.
- [ ] Quand le module vote est actif, ses actions réservées à la présidente (résolutions, résultats, PV) sont présentes et réservées par défaut. **Quand s31 n'est pas encore livrée, ce critère est vide par construction** et se vérifie sur un module de test déclarant une action réservée — ce n'est pas un manque.
- [ ] La configuration est propre à chaque association et ne fuit pas d'un tenant à l'autre.
- [ ] Une configuration ne peut pas retirer à la présidente le droit de modifier la matrice elle-même (verrouillage anti-blocage).

### Dependencies

s03

### Agentic notes

Réf. `V5 §2, §3.2`, `CDCT §2` (« prévoir un mécanisme de permission par rôle configurable en BO
plutôt qu'un hardcode par action »), `PRD` (complexité 4).

Risque (complexité 4) : autorisation **transverse à tout le produit**. Placée tard exprès — la
matrice se dérive d'actions réelles, existantes et testées, et non l'inverse. La coder trop tôt
aurait produit une abstraction devinée.

**La matrice est alimentée par un registre d'actions, elle ne dépend d'aucune story de feature.**
Chaque story déclare les actions qu'elle introduit ; la matrice les découvre. C'est ce qui permet à
s36 d'ajouter « déclencher l'export » après coup, et au module vote d'apparaître quand il est livré
sans que cette story l'attende. Faire dépendre la matrice d'une feature précise — le vote en
particulier, suspendu à une condition suspensive du devis — rendrait une feature du tronc commun
otage d'un module activable. C'est le défaut relevé en revue du découpage, corrigé ici.

CASL est déjà présent dans le boilerplate
(`.claude/rules/02-services/rule-casl-authorization.md`) : rendre ses règles paramétrables par
tenant, ne pas remplacer la brique.

Le vrai piège est la régression silencieuse : chaque story antérieure a ses propres tests
d'autorisation. Ils doivent tous continuer à passer **sans modification** une fois la matrice
branchée, avec la configuration par défaut. C'est le filet de sécurité de cette story.

Le verrou anti-blocage est un vrai risque terrain : un bureau bénévole qui se retire ses propres
droits n'a aucun moyen de revenir en arrière sans le prestataire.

---

## Story s36-export-donnees — Exporter les données de l'association

**En tant que** présidente **je veux** exporter l'ensemble des données de mon association
**afin de** rester libre de mes données et de répondre à une demande de portabilité.

### Complexity

3

### Acceptance criteria

- [ ] La présidente déclenche un export complet et récupère une archive ZIP contenant : un fichier CSV par type de donnée tabulaire (membres, parcelles, relevés, factures, campagnes, signalements), un fichier JSON pour les contenus structurés, les fichiers d'origine des documents, et un `README` décrivant chaque fichier et ses colonnes.
- [ ] Les CSV s'ouvrent sans erreur dans un tableur (encodage UTF-8, séparateur documenté dans le README) et le JSON est valide au parsing.
- [ ] L'export contient les membres et parcelles avec leurs périodes, les relevés et factures, les contenus publiés, les documents, les campagnes, les signalements et les notes internes.
- [ ] L'export ne contient **aucune** donnée d'une autre association (test d'isolation sur l'archive produite).
- [ ] Un export individuel pour un membre donné produit ses seules données, au titre du droit d'accès.
- [ ] L'export s'exécute en tâche de fond : la requête rend la main immédiatement, le site reste navigable pendant la génération, et la présidente est notifiée quand l'archive est prête.

### Dependencies

s04, s05, s09, s10, s15, s17, s22, s23, s30

### Agentic notes

Réf. `PRD` (« Export et portabilité des données », angle n°5 : « Pas de verrouillage »), RGPD (droit
à la portabilité).

Double usage assumé : argument commercial anti-verrouillage **et** conformité. L'export individuel
répond au droit d'accès d'un membre — d'où l'inclusion des notes internes de s22, qui sont des
données personnelles le concernant, même si elles ne lui sont jamais montrées dans l'interface.

L'action « déclencher un export » est une action réservée : elle se déclare au registre de la
matrice de permissions (s35), qui est extensible par construction — pas besoin de rouvrir s35.

Sa liste de dépendances est longue **parce que c'est le sens de la story** : elle doit exporter tout
ce que le produit stocke. Chaque story qui ajoute un type de donnée après celle-ci doit l'ajouter à
l'export — le noter dans son plan.

Placée en dernier parce qu'elle doit couvrir **tout** ce qui existe. Corollaire : c'est aussi la
story qui révèle une donnée oubliée par le scoping tenant. Traiter un échec du test d'isolation ici
comme un défaut de la story fautive, pas comme un défaut de l'export.

Volumétrie : archive potentiellement lourde (documents nominatifs de 400 propriétaires, cf. s13 et
s30) sur un VPS à 4 Go.
Générer en flux vers le disque, pas en mémoire.

---

## Story s37-simulation-role — Déboguer en se mettant à la place d'un utilisateur

**En tant que** SuperAdmin Zourite Studio **je veux** consulter le site avec le rôle d'un utilisateur
d'une association **afin de** reproduire un problème signalé par le bureau sans lui demander ses accès.

### Complexity

2

### Acceptance criteria

- [ ] Un SuperAdmin choisit une association et un rôle, et navigue avec exactement les droits de ce rôle.
- [ ] Une bannière permanente signale la simulation en cours et permet d'en sortir depuis n'importe quelle page.
- [ ] La simulation respecte la matrice de permissions configurée pour l'association simulée (s35), pas les droits par défaut.
- [ ] Chaque entrée en simulation est tracée avec l'identité du SuperAdmin, l'association, le rôle et l'horodatage.
- [ ] Aucun rôle association ne peut déclencher une simulation ; la fonction n'est pas exposée aux associations.
- [ ] Une action d'écriture faite en simulation est attribuée dans l'historique au SuperAdmin, pas au rôle simulé.

### Dependencies

s01, s03, s35

### Agentic notes

Réf. `PRD` (Target users : « SuperAdmin — support et débogage, simulation de rôle, non exposé aux
associations »), `CDCT §2`. **Dérivation du PRD** : pas une ligne du tableau du périmètre — la
simulation de rôle y est décrite comme une capacité du rôle SuperAdmin, pas comme une feature
vendue aux associations.

Sortie de s01 en revue du découpage : s01 y groupait quatre valeurs distinctes, et la simulation
répond au besoin d'un autre utilisateur. Placée après s35 pour que la simulation reflète la matrice
configurée plutôt que des droits devinés.

Le piège est l'attribution des écritures : une simulation qui écrit sous l'identité du rôle simulé
corrompt les notes internes (s22) et l'historique des membres, et rend le débogage indistinguable
d'une action du bureau. La traçabilité n'est pas un confort, c'est ce qui rend la fonction
acceptable sur des données personnelles.

Ne pas confondre avec le changement de rôle d'un utilisateur (s35) : ici rien n'est modifié, c'est
une lecture sous une autre identité.

---

# Récapitulatif — ordre et dépendances

| Id | Story | Cx | Dépend de | Bloc |
| --- | --- | --- | --- | --- |
| s01 | provisionner-association | 4 | — | A |
| s02 | parametres-association | 2 | s01 | A |
| s03 | connexion-lien-magique | 3 | s01 | A |
| s04 | pages-cms | 3 | s01, s03 | A |
| s05 | actualites | 2 | s04 | A |
| s06 | presentation-bureau | 2 | s04 | A |
| s07 | bandeau-alerte | 1 | s01, s03 | A |
| s08 | formulaire-contact | 2 | s02, s04 | A |
| s09 | analyses-eau | 2 | s04 | A |
| s10 | signalements-publics | 3 | s02, s04 | A |
| s11 | seo | 2 | s02, s04, s05, s09 | A |
| s12 | membres-parcelles | 4 | s01, s03 | B |
| s13 | import-initial-membres | 3 | s12 | B |
| s14 | coordonnees-membre | 1 | s12 | B |
| s15 | import-releves-eau | 3 | s02, s12 | B |
| s16 | historique-consommation | 2 | s15 | B |
| s17 | factures-liste | 3 | s12 | B |
| s18 | factures-pennylane | 3 | s17 | B |
| s19 | redirection-paiement | 1 | s02, s17 | B |
| s20 | signalement-membre | 2 | s10, s12 | B |
| s21 | questions-bureau | 2 | s02, s12 | B |
| s22 | notes-internes-membre | 2 | s12 | B |
| s23 | campagnes-email | 4 | s02, s03, s12, s17 | C |
| s24 | envoi-echelonne | 3 | s02, s23 | C |
| s25 | groupes-destinataires | 2 | s23 | C |
| s26 | publipostage-pdf | 3 | s12, s23 | C |
| s27 | relances-impayes | 4 | s02, s17, s23, s24, s26 | C |
| s28 | stats-campagnes | 2 | s23, s24 | C |
| s29 | documents-partages | 2 | s03, s12 | D |
| s30 | documents-nominatifs | 4 | s12, s29 | D |
| s31 | vote-asl-community | 3 | s02, s12, s29 | E |
| s32 | module-voirie | 2 | s01, s04 | F |
| s33 | petites-annonces | 3 | s12, s21 | F |
| s34 | modeles-documents | 3 | s25, s26, s30 | F |
| s35 | permissions-configurables | 4 | s03 | F |
| s36 | export-donnees | 3 | s04, s05, s09, s10, s15, s17, s22, s23, s30 | F |
| s37 | simulation-role | 2 | s01, s03, s35 | F |

**37 stories, aucune à 5.** Répartition : trois à 1, quinze à 2, treize à 3, six à 4.
Les six stories à 4 — s01 (isolation multi-tenant), s12 (modèle membre↔parcelle daté), s23 (volume
de la story de campagnes), s27 (planification et idempotence des relances), s30 (cloisonnement
physique des documents nominatifs), s35 (autorisation transverse) — portent chacune leur risque
explicité dans leurs notes agentiques, à trancher en `/ks-architect` ou `/ks-design` avant
`/ks-plan`.

Deux écarts assumés avec les scores du PRD, tous deux relevés en revue du découpage : s13 (3 contre 2
au PRD, à cause de la clé de dédoublonnage non tranchée) et s23 (4 contre 3, la story portant en plus
les deux cibles standard). Le PRD chiffre des *features*, ce tableau chiffre des *tranches livrables*
— l'écart est documenté dans chaque story plutôt que lissé.

**Ordre vs calendrier contractuel** : la GED (s29, s30) est placée **avant** le vote (s31), alors
que le calendrier du devis annonce l'inverse (vote en décembre 2026, GED en janvier 2027). Arbitrage
client du 6 septembre 2026 : la dépendance prime sur le jalon, le chiffrage calendaire ayant été
établi avant le passage au développement agentique. Le vote publie son PV via les documents partagés
plutôt que de se doter d'un stockage à lui — et il reste de toute façon suspendu à la levée de la
réserve ASL Community.

Les mois indiqués sur les blocs restent ceux du devis : ce sont des **jalons de livraison**, pas des
contraintes d'ordonnancement. Les échéances contractuelles inchangées sont la recette (mars 2027) et
la mise en production (mai 2027).
