# Cahier des charges technique — Site ASL La Fourche

**Usage** : document de travail interne à Zourite Studio, non contractuel (voir `docs/Admin-MEL/contrat-prestation-services-asl-la-fourche.md`, Article 2). Il sert de base à l'écriture des user stories (`stories.md`) et au découpage en tâches de développement. Il part de `cahier-des-charges-fonctionnel_V4.md` (version de travail brute, questions/réponses) en y intégrant directement les réponses du bureau et les ajouts faits dans la version client consolidée `cahier-des-charges-fonctionnel_V5.md`.
**Document contractuel de référence** : `cahier-des-charges-fonctionnel_V5.md` (annexé au contrat). En cas de divergence entre ce document et la V5, la V5 prévaut ; toute divergence constatée doit être signalée et corrigée ici.
**Dernière synchronisation avec la V5** : 3 septembre 2026.

## 1. Objet

Site multi-tenant (plateforme ASL-CMS), premier tenant = ASL La Fourche. Périmètre fonctionnel organisé en 6 blocs : fondations techniques, site public, espace membres, vote en ligne, espace documentaire, communication e-mail — + module Voirie (hors devis, offert).

### 1.1 Base technique — arbitrage CMS (tranché le 5 septembre 2026)

> Décision formalisée dans `docs/decisions/001-base-technique-cms.md` (ADR 001) — options considérées et conséquences détaillées.

**Retenu : le boilerplate ship-saas** (Next.js 16, Drizzle/PostgreSQL, Better Auth, Stripe, architecture en couches Presentation/Service/Persistence). **WordPress est écarté.**

WordPress avait été envisagé pour une seule raison, légitime : offrir au bureau un back-office ergonomique, prévisible, éventuellement déjà connu. Il a été écarté parce qu'il entre en conflit avec les choix non négociables du projet :

- **Deux runtimes** : ship-saas est Node/Next.js, WordPress est PHP. Les faire cohabiter (WP headless) double l'hébergement, le déploiement et la maintenance sur un VPS infogéré à [montant masqué]/an.
- **Multi-tenant** : le modèle retenu est 1 Organization = 1 association, données scopées par `organization_id` en base partagée + RLS Postgres. WP multisite raisonne en base/préfixe par site — provisioning plus lourd, RLS inapplicable.
- **Authentification** : le magic link est natif Better Auth. WordPress imposerait un second système d'identité et un pont à maintenir entre les deux.
- **Facturation plateforme** : l'abonnement Zourite Studio ↔ association est couvert nativement par Stripe/ship-saas (paramétrage, pas développement). Côté WordPress, c'est un développement à part entière.
- **Pipeline killer-saas** : il pilote du code applicatif testé (TDD, review anti-hallucination). L'écosystème de plugins WP tire vers de la configuration manuelle non testable, hors gate.
- **Sécurité et maintenance** : la surface d'attaque et le rythme de mise à jour des plugins tiers WP sont mal compatibles avec un contrat de maintenance à [montant masqué]/an.

**Le besoin derrière WordPress reste une exigence de premier plan** : un back-office éditorial, prévisible, utilisable sans compétence technique par le bureau. Il est traité en `/ks-design-system` (patterns d'édition de page, listes, formulaires, aperçu avant publication) — pas par le choix de stack. La référence d'ergonomie visée pour le bloc CMS est bien celle d'un éditeur de pages type WordPress/Payload.

**Briques tierces vs développement maison** : préférer une brique existante uniquement quand elle apporte une vraie valeur (performance, sécurité, maintenance active, complexité de développement élevée — typiquement : éditeur de texte riche, parseur de fichiers tabulaires, client e-mail transactionnel). Sinon, développement maison sous forme de modules applicatifs du monorepo ship-saas. _(La convention de préfixe `zs-` visait des plugins WordPress : sans objet ici. La convention de nommage des modules est fixée par `/ks-architect`.)_

## 2. Rôles et permissions

| Rôle                                    | Portée                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Visiteur** (non authentifié)          | Pages publiques, formulaire de contact, alertes, résultats d'analyses d'eau, signalement de fuite                                                                                                                                                                                                                        |
| **Membre**                              | + factures, historique conso eau, documents qui lui sont destinés, vote, annonces, coordonnées                                                                                                                                                                                                                           |
| **Bureau**                              | + gestion des contenus, validation des déclarations/annonces, publication des documents, gestion de l'abonnement plateforme                                                                                                                                                                                              |
| **Président(e)**                        | Bureau + actions réservées. Une seule à ce jour : saisie des résolutions de vote et publication des résultats/PV (§6). D'autres viendront probablement — **prévoir un mécanisme de permission par rôle configurable en BO plutôt qu'un hardcode par action**, à étudier en amont de l'architecture (cf. `/ks-architect`) |
| **SuperAdmin** (interne Zourite Studio) | Bypass total, simulation de n'importe quel rôle à des fins de debug. Non exposé à l'association                                                                                                                                                                                                                          |

**Comptes de départ** : import initial par le prestataire à partir d'une liste fournie par l'association (nom, email, parcelle). Le bureau peut ensuite créer un compte unitairement (email + rattachement à une fiche Pennylane).

**✅ Comptage tranché (arbitrage client, 6 septembre 2026)** : **400 propriétaires au total**, dont **300 avec adresse email** (fiche membre + compte connectable) et **100 sans email** (fiche membre, aucun compte, joignables par courrier uniquement — cible du publipostage PDF). L'import initial crée donc **400 fiches membres et 300 comptes**.

Les deux chiffres du `V5` n'étaient pas contradictoires : le §2 comptait les comptes, le §3.3 les propriétaires. C'est le **400** qui dimensionne la volumétrie GED (§7) et la cible du publipostage (§8), pas le 300.

Reste valable indépendamment de ce comptage : la règle §5.1 (un propriétaire de plusieurs parcelles = **une** fiche membre) s'applique au dédoublonnage des lignes du fichier réel.

## 3. Fondations techniques

### 3.1 CMS

Back-office de gestion de contenu pour le bureau : créer/modifier/publier/dépublier des pages, sans intervention du prestataire.

### 3.2 Gestion des droits

3 profils association (Président(e), Bureau, Membre) + SuperAdmin interne. Voir §2 pour le détail et la piste de permissions paramétrables par rôle à étudier.

### 3.3 Authentification — magic link

Connexion sans mot de passe : lien à usage unique envoyé par email, valable **4 heures**.

- Pas de plan B pour les membres sans adresse email (voir écart de comptage au §2) : ils restent gérés hors-ligne par le bureau (courrier, contact direct). Aucun compte, aucune fonctionnalité de contournement à prévoir.

## 4. Site public

### 4.1 Pages de contenu

CMS librement éditable par le bureau (texte, images) + formulaire de contact public. Le formulaire de contact déclenche une notification email (destinataire paramétrable, défaut = présidente) ET un enregistrement consultable en BO (pas seulement l'email — prévoir une liste des messages reçus).

**Pages attendues au minimum** (contenu, pas des fonctionnalités à développer une par une — prévoir un système de pages CMS générique plutôt que des gabarits dédiés par page, sauf mention contraire ci-dessous) :

- Accueil
- Présentation du bureau : organigramme + fiche par membre du bureau, mis à jour dynamiquement (donc pas de simple page statique — un sous-modèle « membre du bureau » avec nom/rôle/photo/bio, listable et éditable en BO)
- Présentation de l'association : nombre de membres (calculé automatiquement à partir de la base membres, ou saisi manuellement ? — à trancher en conception), plan des parcelles (upload d'image statique par le bureau, pas de carte interactive/cliquable)
- Actualités / mini-blog : liste d'articles datés, éditables en CMS
- Page « je viens d'acquérir un terrain » : contenu CMS standard
- **Page « Contacts utiles »** (ajout V5) : annuaire d'information (coordonnées bureau, référents de proximité, urgences), alimenté par le bureau en CMS. **Distinct des petites annonces de services entre membres (§5.8)** — ne pas fusionner les deux modèles de données : celui-ci est un annuaire de contacts géré par le bureau, l'autre est du contenu généré par les membres avec workflow de modération.

### 4.2 Bandeau d'alerte

Bandeau global (coupure d'eau, travaux…), activable/modifiable/désactivable par n'importe quel membre du bureau (pas de restriction supplémentaire).

### 4.3 Signalement public de fuite

Formulaire public (pas de compte requis) → notification email + entrée dans une file de suivi en BO avec statut (`signalé` → `en cours` → `résolu`). Destinataires de la notification : voir §4.6.

### 4.4 Analyses d'eau

Modèle de contenu répétable : `date`, `image (affiche)`, `texte facultatif`, `fichier PDF téléchargeable`. Publication fréquente (≥ mensuelle) — prévoir une UI de saisie rapide en BO, pas un formulaire lourd.

### 4.5 SEO

Sitemap, métadonnées par page, intégration Search Console.

### 4.6 Règles de notification et paramétrage (issu des réponses B1-B4)

- Domaine à réserver par Marie-Eve ultérieurement : **asl-exemple.test**.
- Signalement de fuite (public §4.3 et membre §5.6) → notifie : `contact@asl-exemple.test` + email du responsable forage (`responsable-forage@asl-exemple.test` au démarrage) + apparaît dans la file BO. **Ces adresses sont des valeurs par défaut modifiables en BO par le bureau, pas des constantes codées en dur.**

## 5. Espace membres

### 5.1 Modèle de données membre / parcelle

- **Identifiant membre = clé primaire autogénérée**, indépendante du numéro de parcelle.
- Relation **1 membre ↔ N parcelles** (un membre peut posséder plusieurs parcelles).
- **Historique attaché à la parcelle-au-moment-des-faits, pas au membre courant** : si une parcelle change de propriétaire, les documents/factures/relevés antérieurs à la vente restent visibles par l'ancien propriétaire, pas transférés au nouveau. → nécessite un modèle qui date la relation membre↔parcelle (période de propriété), pas juste une FK simple parcelle→membre_actuel.
- **Facturation consolidée par membre** : un membre multi-parcelles ne reçoit qu'**une** facture de cotisation et **une** facture d'eau (conso cumulée de toutes ses parcelles). C'est **Pennylane qui produit cette facture consolidée** — le site n'agrège rien lui-même, il affiche le statut/lien renvoyés par Pennylane.
- **Accès après cession d'une parcelle** : l'ex-propriétaire garde l'accès à son compte tant qu'il est redevable de sa cotisation de l'année en cours ; une fois soldée, accès coupé mais données conservées (sauf demande de suppression explicite).
  **⚠️ Bloquant conformité** : cette règle de rétention doit être validée par un conseil RGPD avant implémentation — ne pas coder la purge/rétention tant que ce n'est pas tranché.
- **⚠️ Ouvert** : clé de rapprochement entre un compte site et la fiche client Pennylane (email ? n° de parcelle ? ID client Pennylane ?) — à définir avec le correspondant Pennylane avant de concevoir l'import/sync.

### 5.2 Factures (lecture Pennylane)

Liste des factures + statut (Pennylane remonte plus que payée/impayée — statuts intermédiaires à mapper tels quels, ne pas réduire à un booléen). Téléchargement PDF si l'API Pennylane le permet.

### 5.3 Paiement en ligne

Redirection pure vers Pennylane. Aucune donnée bancaire ne transite ni n'est stockée côté site.

### 5.4 Coordonnées

CRUD simple par le membre sur son propre profil.

### 5.5 Historique de consommation d'eau

- Import annuel (fréquence confirmée : 1×/an, sauf analyses d'eau qui sont plus fréquentes — voir §4.4) d'un fichier Excel/CSV par le bureau.
- **Format non figé** : dépend du modèle imposé par Pennylane (le bureau réutilise le même fichier pour la facturation) → **ne pas coder le parseur avant réception d'un fichier exemple** (colonnes, séparateur — voir Ouverts).
- Le bureau pré-traite/corrige manuellement le fichier brut (reçu de la société de relevé) avant import — le site n'a pas à gérer la correction, seulement l'import du fichier déjà nettoyé.
- Erreurs d'import → rapport automatique par email à `contact@asl-exemple.test` (ne pas juste logger côté serveur, il faut une notification).
- Chaque membre voit l'historique de sa propre consommation uniquement (scoping strict par membre, agrégée si multi-parcelles — cf §5.1).

### 5.6 Déclaration de fuite (membre connecté)

Même formulaire/workflow que §4.3, mais : identité du déclarant transmise automatiquement au bureau, et statut visible dans l'espace membre du déclarant (donc la déclaration doit être liée au membre, pas anonyme comme la version publique).

### 5.7 Questions au bureau

Formulaire distinct du contact public. Catégories définies par le bureau : **max 10**, chacune avec un email de routage optionnel (fallback = email de contact général si vide). → modèle `catégorie { nom, email_destination? }` géré en BO, pas une liste hardcodée.

### 5.8 Petites annonces (fusion annonces + services)

Un seul module (l'ancien « annuaire des services » séparé est abandonné, fusionné ici comme catégorie).

- Catégories de départ : entretien espaces verts, prêt de matériel, recherche de matériel, services, divers. **Extensible par le bureau, max 10 catégories** (même mécanique que §5.7 — envisager un modèle de catégories réutilisable entre les deux modules plutôt que deux implémentations séparées).
- Soumission via le formulaire de contact espace membre (catégorie dédiée, trame de rédaction suggérée dans le corps).
- Modération bureau obligatoire avant publication : 3 actions possibles — accepter tel quel / modifier / rejeter.
- Affichage : page publique-membres, tri par catégorie puis date.
- Pas d'expiration automatique — suppression manuelle uniquement (par l'auteur ou le bureau).

## 6. Vote en ligne

Redirection vers ASL Community (outil externe, pas de logique de vote développée ici — dépouillement/quorum/procurations hors périmètre, gérés par ASL Community).

- Le site publie : les résolutions soumises au vote + les résultats + le PV, une fois disponibles côté ASL Community.
- Convocation à l'AG envoyée par email avant l'AG (canal : campagnes email, voir §8), avec les modalités de vote par anticipation.
- **Permission stricte** : saisie des résolutions + publication résultats/PV = **présidente uniquement**, pas le reste du bureau (seule restriction de ce type à ce jour, cf §2).
- **⚠️ Bloquant** : accès ASL Community à confirmer par écrit + vérification que les statuts de l'association autorisent le vote électronique. Condition suspensive du devis — ne pas commencer le développement de ce module avant levée de la réserve.

## 7. Espace documentaire (GED)

Deux catégories de documents, avec des règles de stockage et d'accès différentes :

- **Nominatifs** : 1 facture + 1 convocation par membre et par an. **Dossier physiquement séparé par membre** (pas un simple filtre logique — l'objectif est d'exclure tout accès croisé même en cas de bug d'autorisation). Volumétrie prévisionnelle = nombre de membres/an, prévoir une marge de croissance.
- **Partagés** : 1 ordre du jour + 1 compte-rendu d'AG par an, + statuts et autres documents non nominatifs. Dossier commun, accessible à tous les membres authentifiés.

Accès selon profil (visiteur : rien ; membre : ses documents nominatifs + les partagés ; bureau : tout).

## 8. Communication e-mail (Brevo)

### 8.1 Campagnes

- Tout membre du bureau (pas seulement la présidente) peut créer/envoyer une campagne.
- **4 modèles prêts à l'emploi** : relance manuelle, facture disponible dans l'espace membre, convocation AG, publication de documents post-AG. Contenu détaillé de chaque modèle (texte, variables dynamiques telles que nom/parcelle/date) encore à rédiger avec le bureau — voir §11.
- **+ 1 mode « campagne libre »** : pas un modèle de contenu, juste l'habillage commun à toutes les campagnes (en-tête avec logo de l'association, pied de page avec mentions obligatoires + lien de désinscription). **Implication technique** : prévoir un gabarit d'email commun (header/footer) dans lequel s'insèrent aussi bien le contenu des 4 modèles que celui d'une campagne libre — ne pas traiter la campagne libre comme un cas à part dépourvu de tout habillage.
- Doublon de l'envoi de facture Pennylane (problème de délivrabilité connu de leur côté) : le site envoie sa propre notification en plus de celle de Pennylane, pas à sa place.
- Fonctionnalité à étudier avec Pennylane (non spécifiée techniquement à ce jour) : récupération automatique des PDF de factures pour stockage sur le VPS, ou lien dynamique direct vers Pennylane — **ne pas développer avant ce point**.

### 8.2 Limite d'envoi

Brevo plafonne à 300 emails/jour. Au-delà de 300 destinataires actifs, une campagne est **automatiquement scindée en 2 envois** (jour J puis J+1) — logique à coder dans le déclenchement de campagne, pas une simple limite affichée à l'utilisateur.

### 8.3 Relances impayés

- Notification "nouvelle facture disponible" : déclenchement **manuel** (le bureau lance l'envoi, ce n'est pas un cron sur détection Pennylane).
  > remarque : la détection automatique via Pennylane n'est pas une mauvaise idée. Sommes-nous sûr de pouvor détecter cela ? (à mettre éventuellement dans une itération ultérieure, après consultation du correspondant Penylane)
- Relances automatiques (jusqu'à 3, espacées 3/2/1 semaines) : **fonctionnalité développée mais son activation doit être un paramètre par tenant** (activable/désactivable en config, pas un comportement figé pour tous les clients de la plateforme).
- Page de gestion BO : par impayé → nom, n° de parcelle, nombre + date des relances déjà envoyées, date de la facture.
- Ciblage : relances = sous-groupe impayés uniquement ; campagnes manuelles (§8.1) = tous les membres.
- **⚠️ Ouvert** : exemple concret de facturation Pennylane à obtenir avant de finaliser le déclenchement des relances (quel champ Pennylane fait foi pour détecter un impayé et sa date).

## 9. Module Voirie (hors devis, offert)

Confirmé utile par le bureau → à développer et inclure sans surcoût pour ce client.

- Pas de dimension individuelle ni facturation — information collective uniquement.
- Plan des voiries : image statique uploadée (pas de carte interactive).
- Liste des chemins et portails, chacun avec un statut + message libre (ex. « portail à remplacer », « rénovation prévue le [date] »).
- Modèle de données volontairement **non fusionné** avec le module Eau (décision actée : Eau = individuel/facturable, Voirie = collectif/non facturable — deux domaines trop différents pour une abstraction commune forcée).
- Données de départ disponibles pour le seed : liste des chemins et des portails de La Fourche figure dans `ASL_LA_FOURCHE_Presentation.pdf` (support AG du 24/07/2026).

## 10. Hors périmètre

Ne pas développer, sauf devis complémentaire explicite :

- Gestion de l'électricité (contrats individuels propriétaire ↔ fournisseur).
- Logique de vote (dépouillement, quorum, procurations) — entièrement côté ASL Community.
- Traitement des paiements — entièrement côté Pennylane, aucune donnée bancaire ne transite par le site.
- Messagerie privée entre membres (au-delà des coordonnées volontairement affichées dans une annonce).
- Gestion multi-immeubles / répartition de charges type syndic professionnel.

## 11. Points ouverts avant/pendant l'implémentation

Bloquants ou quasi-bloquants pour certaines stories — à vérifier avant de démarrer le développement des parties concernées :

| Point                                                                | Bloque                            | Détail                                                                                                                                    |
| -------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Accès API Pennylane                                                  | §5.2, §5.3, §8.1 (récup factures) | Condition suspensive du devis, fourniture par le client                                                                                   |
| Clé de rapprochement site ↔ Pennylane                                | §5.1, §5.2                        | À définir en RDV Pennylane                                                                                                                |
| Format du fichier de relevés d'eau                                   | §5.5 (parseur d'import)           | Dépend du modèle imposé par Pennylane, exemple de fichier à obtenir                                                                       |
| Exemple de facturation Pennylane                                     | §8.3 (déclenchement des relances) | À obtenir en RDV Pennylane                                                                                                                |
| Accès ASL Community + validation statutaire du vote électronique     | §6 (tout le module)               | Condition suspensive du devis                                                                                                             |
| Contenu des 4 modèles d'email                                        | §8.1                              | Le nombre est fixé (4 modèles + campagne libre avec habillage commun) ; contenu détaillé et variables dynamiques à rédiger avec le bureau |
| Validation RGPD de la règle de rétention des données ex-propriétaire | §5.1                              | Ne pas coder la purge avant validation                                                                                                    |
| Réservation du nom de domaine (asl-exemple.test)                     | Déploiement                       | Action prestataire, non bloquante pour le dev                                                                                             |
