# Brief produit — ASL-CMS

Document de cadrage à apporter comme contexte lors des phases `/ks-prd` et `/ks-architect` du pipeline killer-saas. Ce n'est pas une spec technique — le WHAT/WHY et les grandes décisions structurantes seulement.

**Sources et hiérarchie** : le périmètre du premier client fait foi dans `docs/Admin-MEL/cahier-des-charges-fonctionnel_V5.md` (document contractuel, annexé au contrat) ; sa traduction technique de travail est `docs/bases/cahier-des-charges-technique.md`. Le présent brief se limite au niveau produit/plateforme et s'aligne sur ces deux documents.
**Dernière mise à jour** : 5 septembre 2026 (synchronisation avec le cahier des charges technique).

## Vision

CMS + espace membre modulable pour associations syndicales libres (ASL) de terrains de vacances (parcelles avec cabanon en dur + mobil-home/caravane, occupation parfois permanente en pratique bien que non prévue statutairement). Objectif : un seul système capable de générer un site par association, avec un tronc commun mutualisé et des variantes par tenant.

## Périmètre client

- **Premier client signé** : ASL La Fourche (devis n°042, `docs/Admin-MEL/Devis_042_ASL_La_Fourche_v9.pdf`) — **~300 comptes membres pour ~400 propriétaires historiques** (regroupement multi-parcelles + ~100 membres sans adresse email, qui restent gérés hors-ligne par le bureau). Le chiffre exact reste à confirmer sur la liste réelle transmise avant l'import initial.
- **5 prospects intéressés**, profil strictement identique : ASL de terrains de vacances gérant eau + routes + cotisations.
- Aucune des associations n'a de tiers comptable connu à l'exception de La Fourche (Pennylane). Aucune n'a de module de vote propre — **ASL Community** est très probablement le fournisseur commun à toutes.
- La ressource **électricité** n'est pas portée par les associations (contrats individuels propriétaire ↔ fournisseur). Pas de gaz de ville.

## Base technique — arbitrage CMS (tranché le 5 septembre 2026)

> ADR 001 — `docs/decisions/001-base-technique-cms.md`.

**Retenu : le boilerplate ship-saas** (Next.js 16, Drizzle/PostgreSQL, Better Auth, Stripe, architecture en couches Presentation/Service/Persistence). **WordPress, envisagé comme base CMS, est écarté.**

L'intention derrière WordPress était bonne : un back-office ergonomique, prévisible, éventuellement déjà connu du bureau. Mais il entre en conflit avec les choix non négociables du projet — deux runtimes à héberger et maintenir (PHP + Node), un multi-tenant WP multisite incompatible avec le modèle `organization_id` + RLS Postgres, un second système d'identité face au magic link Better Auth, une facturation plateforme à redévelopper là où Stripe/ship-saas la couvre nativement, et un écosystème de plugins qui échappe au pipeline killer-saas (TDD + review) comme à un contrat de maintenance à [montant masqué]/an.

**Le besoin d'ergonomie, lui, reste une exigence produit de premier plan** : il se traite en `/ks-design-system` (patterns d'édition de page, listes, formulaires, aperçu avant publication), avec pour référence assumée l'expérience d'un éditeur de pages type WordPress/Payload. Détail d'implémentation volontairement hors du présent brief — à traiter via `/ks-architect`.

**Briques tierces vs maison** : une brique existante n'est retenue que si elle apporte une vraie valeur (performance, sécurité, maintenance active, complexité de développement élevée). Sinon, développement maison en modules applicatifs du monorepo.

## Modèle de tenancy

- **1 Organization (ShipSaaS) = 1 Association**, réutilisation directe du multi-tenant natif du boilerplate plutôt qu'un système maison.
- Sous-domaine par défaut, domaine custom possible ensuite sans changement d'architecture (pour La Fourche : `asl-exemple.test`, à réserver).
- Toutes les données métier scopées par `organization_id`, base partagée (pas de DB par tenant — écarté, cf. Décisions actées) renforcée par **Row-Level Security Postgres** sur les tables sensibles.
- **Rôles** : Visiteur (non authentifié) < **Membre** (son espace, ses factures, sa conso, ses documents, vote, annonces) < **Bureau** = admin (contenus, modération, publication de documents, abonnement plateforme) < **Président(e)** = Bureau + actions réservées < **SuperAdmin** interne Zourite Studio (bypass, simulation de rôle, non exposé à l'association).
  Une seule action est aujourd'hui réservée à la présidente (saisie des résolutions de vote, publication des résultats/PV), mais d'autres suivront probablement : **prévoir un mécanisme de permissions par rôle configurable en back-office plutôt qu'un hardcode par action** — à étudier en `/ks-architect`.
- Échelle cible (~6 associations × ~300-400 comptes) très confortable pour la stack, aucun ajustement de dimensionnement nécessaire.

## Système de personnalisation par tenant

Principe : **config par défaut, divergence de comportement (Strategy) réservée aux cas avérés** — pas de flexibilité anticipée sans besoin identifié.

- La majorité des modules sont pilotés par une config JSON validée par tenant (labels, champs, seuils, activation) — un même code, un comportement adapté par association. Cas déjà identifiés : activation des relances automatiques d'impayés, adresses de notification (fuite, contact, rapport d'erreur d'import), catégories de questions au bureau et de petites annonces (max 10 chacune).
- Seuls les modules à intégration tierce avec fournisseur potentiellement différent par tenant (aujourd'hui identifié : **facturation membres**) justifient une vraie interface interchangeable (Strategy). Vote et communication restent en intégration simple tant qu'un seul fournisseur (ASL Community, Brevo) est utilisé par toutes les associations.
- Un module peut avoir **plusieurs instances actives par tenant** quand c'est pertinent (à ce jour : aucun cas identifié après retrait du module générique "ressource partagée" — cf. Décisions actées).

## Catalogue de modules (périmètre pressenti)

**Socle transverse**

- Site public / CMS — pages éditables (système de pages générique, pas un gabarit par page), contact avec archivage des messages en BO, bandeau d'alerte gérable par tout membre du bureau, page « Contacts utiles » (annuaire d'information alimenté par le bureau), actualités ; sert aussi d'assembleur pour des blocs publics fournis par d'autres modules (ex. résultats d'analyses d'eau, formulaire de signalement de fuite)
- Espace membres & Auth — comptes, connexion par lien magique e-mail (validité 4 h, pas de plan B pour les membres sans email), mise à jour coordonnées, questions au bureau avec routage par catégorie
- Espace documentaire (GED) — accès par profil, **dossier physiquement séparé par membre** pour les documents nominatifs (pas un simple filtre logique), dossier commun pour les documents partagés (PV, statuts, convocations…)
- Communauté (bonus) — petites annonces entre membres, avec modération obligatoire du bureau (accepter / modifier / rejeter). L'annuaire des services n'est plus un module distinct : il est fusionné en catégorie d'annonces
- SEO — réglages de tenant (méta, sitemap), pas un module à logique propre

**Intégrations tierces**

- **Facturation membres** — lecture seule (liste des factures, **statuts remontés tels quels, y compris intermédiaires — pas un booléen payé/impayé**, historique depuis l'année de création du site, pas de rétroactivité). Facture consolidée par membre produite par le prestataire comptable, pas agrégée par le site. Paiement 100% délégué : simple lien de redirection vers le prestataire (Pennylane pour La Fourche). Aucune donnée bancaire ne transite par le système — hors périmètre DSP2/PCI.
- Vote en ligne (AG) — renvoi vers ASL Community, publication des résolutions, des résultats et du PV ; aucune logique de vote (dépouillement, quorum, procurations) développée ici
- Communication — campagnes e-mail (Brevo) : 4 modèles prêts à l'emploi + un mode campagne libre, tous dans un habillage commun (en-tête association, pied de page légal + désinscription) ; scission automatique des envois au-delà de 300 destinataires (plafond Brevo) ; relances d'impayés automatiques, activables par tenant

**Modules domaine (indépendants, pas de tronc commun forcé)**

- **Module Eau** — ressource individuelle par propriétaire, mesurée, facturable, sujette à restriction/coupure, relevés de consommation importés annuellement par le bureau, déclaration de fuite avec suivi de statut (public anonyme ou membre identifié), publication de résultats d'analyses
- **Module Voirie** — ressource collective portée par le bureau, identification des voies/chemins/portails avec statut et message libre, suivi de travaux/rénovation, pas de volet individuel ni de facturation associée. **Confirmé utile par le bureau de La Fourche : développé et inclus sans surcoût pour ce client** (hors devis)

**Facturation plateforme (vous ↔ association, distincte de la facturation membres)**

- Couvre développement initial, maintenance annuelle ([montant masqué]/an), développements spécifiques au fil de l'eau.
- Ne concerne jamais les propriétaires/membres, uniquement la relation Zourite Studio ↔ association.
- Couvert nativement par le système d'abonnement Stripe intégré à ShipSaaS (facturation SaaS → Organization) — pas de développement nécessaire, seulement du paramétrage de plans.
- Le Bureau doit pouvoir consulter ses propres factures/abonnement en self-service dans son espace admin (visibilité native ShipSaaS à activer pour le rôle admin, invisible aux membres simples).

## Décisions actées

- **WordPress écarté comme base CMS** au profit de ship-saas (voir Base technique) ; l'exigence d'ergonomie du back-office est reportée sur le design system.
- Multi-tenant partagé (pas de DB par tenant) + RLS Postgres, pour rester aligné avec le modèle natif ShipSaaS et ne pas alourdir le provisioning d'un nouveau client.
- Abandon du module générique "ressource partagée" (eau/route fusionnés) — les deux domaines divergent trop (individuel/facturable vs collectif/non facturable) pour justifier une abstraction commune à ce stade. À réévaluer seulement si un 3e domaine similaire apparaît réellement.
- Facturation membres et facturation plateforme sont deux systèmes distincts, ne doivent jamais être confondus dans la conception.
- **Petites annonces et annuaire des services fusionnés** en un seul module ; en revanche, la page « Contacts utiles » (annuaire géré par le bureau) reste un modèle de données distinct des annonces (contenu membre + modération) — ne pas fusionner.
- **L'historique est attaché à la parcelle au moment des faits, pas au propriétaire courant** : un changement de propriétaire ne transfère pas les documents et factures antérieurs. Implique un modèle qui date la relation membre ↔ parcelle.

## Ouvert / à trancher via le pipeline killer-saas

- Interview `/ks-prd` complète (mode greenfield : pas de reverse-engineering, pas de graveyard, périmètre entièrement cœur), puis `/ks-stories` — le PRD et les stories antérieurs ont été retirés du repo et sont à régénérer sur la base du cahier technique et de la V5.
- Architecture via `/ks-architect` : mécanisme de permissions par rôle configurable, modèle membre ↔ parcelle daté, conventions de nommage des modules.
- Design system via `/ks-design-system`, avec l'ergonomie du back-office éditorial comme objectif explicite.
- Découpage en stories, cycle Research → Design → Plan → Execute → Review → Ship par story.

## Réserves et dépendances externes (bloquantes)

Ces points conditionnent des pans entiers du périmètre et ne relèvent pas du pipeline mais du client ou d'un tiers — détail et impact story par story dans `cahier-des-charges-technique.md` §11.

- **Accès API Pennylane** (facturation membres, relances) et **clé de rapprochement** compte site ↔ fiche Pennylane — condition suspensive du devis.
- **Accès ASL Community confirmé par écrit + validation statutaire du vote électronique** — condition suspensive du devis, module vote bloqué tant qu'elle n'est pas levée.
- **Validation RGPD de la règle de rétention** des données d'un ex-propriétaire — la purge ne doit pas être codée avant arbitrage.
- Exemples de fichiers à obtenir avant développement : relevés de consommation d'eau (format imposé par Pennylane) et facturation Pennylane (détection des impayés).
