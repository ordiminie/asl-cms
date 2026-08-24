# Brief produit — ASL-CMS

Document de cadrage à apporter comme contexte lors des phases `/ks-prd` et `/ks-architect` du pipeline killer-saas. Ce n'est pas une spec technique — le WHAT/WHY et les grandes décisions structurantes seulement.

## Vision

CMS + espace membre modulable pour associations syndicales libres (ASL) de terrains de vacances (parcelles avec cabanon en dur + mobil-home/caravane, occupation parfois permanente en pratique bien que non prévue statutairement). Objectif : un seul système capable de générer un site par association, avec un tronc commun mutualisé et des variantes par tenant.

## Périmètre client

- **Premier client signé** : ASL La Fourche (devis n°042, `docs/Devis_042_ASL_La_Fourche_v9.pdf`) — ~400 comptes membres.
- **5 prospects intéressés**, profil strictement identique : ASL de terrains de vacances gérant eau + routes + cotisations.
- Aucune des associations n'a de tiers comptable connu à l'exception de La Fourche (Pennylane). Aucune n'a de module de vote propre — **ASL Community** est très probablement le fournisseur commun à toutes.
- La ressource **électricité** n'est pas portée par les associations (contrats individuels propriétaire ↔ fournisseur). Pas de gaz de ville.

## Modèle de tenancy

- **1 Organization (ShipSaaS) = 1 Association**, réutilisation directe du multi-tenant natif du boilerplate plutôt qu'un système maison.
- Sous-domaine par défaut, domaine custom possible ensuite sans changement d'architecture.
- Toutes les données métier scopées par `organization_id`, base partagée (pas de DB par tenant — écarté, cf. Décisions actées) renforcée par **Row-Level Security Postgres** sur les tables sensibles.
- Rôles : **Bureau** = admin (gère contenus, valide déclarations, voit la facturation plateforme), **Membre** = member (accès à son espace, ses factures eau, ses déclarations). Site public non authentifié.
- Échelle cible (~6 associations × ~400 comptes) très confortable pour la stack, aucun ajustement de dimensionnement nécessaire.

## Système de personnalisation par tenant

Principe : **config par défaut, divergence de comportement (Strategy) réservée aux cas avérés** — pas de flexibilité anticipée sans besoin identifié.

- La majorité des modules sont pilotés par une config JSON validée par tenant (labels, champs, seuils, activation) — un même code, un comportement adapté par association.
- Seuls les modules à intégration tierce avec fournisseur potentiellement différent par tenant (aujourd'hui identifié : **facturation membres**) justifient une vraie interface interchangeable (Strategy). Vote et communication restent en intégration simple tant qu'un seul fournisseur (ASL Community, Brevo) est utilisé par toutes les associations.
- Un module peut avoir **plusieurs instances actives par tenant** quand c'est pertinent (à ce jour : aucun cas identifié après retrait du module générique "ressource partagée" — cf. Décisions actées).

## Catalogue de modules (périmètre pressenti)

**Socle transverse**
- Site public / CMS — pages éditables, contact, bandeau d'alerte gérable ; sert aussi d'assembleur pour des blocs publics fournis par d'autres modules (ex. résultats d'analyses d'eau, formulaire de signalement de fuite)
- Espace membres & Auth — comptes, connexion par lien magique e-mail, mise à jour coordonnées, questions au bureau
- Espace documentaire (GED) — stockage sécurisé, accès par profil (PV, statuts, convocations...)
- Communauté (bonus) — petites annonces, annuaire des services entre membres
- SEO — réglages de tenant (méta, sitemap), pas un module à logique propre

**Intégrations tierces**
- **Facturation membres** — lecture seule (liste factures, statut payé/impayé, historique depuis l'année de création du site — pas de rétroactivité). Paiement 100% délégué : simple lien de redirection vers le prestataire (Pennylane pour La Fourche). Aucune donnée bancaire ne transite par le système — hors périmètre DSP2/PCI.
- Vote en ligne (AG) — renvoi vers ASL Community, publication résultats/résolutions
- Communication — campagnes e-mail (Brevo), notifications, relances impayés

**Modules domaine (indépendants, pas de tronc commun forcé)**
- **Module Eau** — ressource individuelle par propriétaire, mesurée, facturable, sujette à restriction/coupure, compteurs/consommation, déclaration de fuite avec suivi de statut, publication de résultats d'analyses
- **Module Voirie** — ressource collective portée par le bureau, identification des voies, suivi de travaux/rénovation, pas de volet individuel ni de facturation associée

**Facturation plateforme (vous ↔ association, distincte de la facturation membres)**
- Couvre développement initial, maintenance annuelle ([montant masqué]/an), développements spécifiques au fil de l'eau.
- Ne concerne jamais les propriétaires/membres, uniquement la relation Zourite Studio ↔ association.
- Couvert nativement par le système d'abonnement Stripe intégré à ShipSaaS (facturation SaaS → Organization) — pas de développement nécessaire, seulement du paramétrage de plans.
- Le Bureau doit pouvoir consulter ses propres factures/abonnement en self-service dans son espace admin (visibilité native ShipSaaS à activer pour le rôle admin, invisible aux membres simples).

## Décisions actées

- Multi-tenant partagé (pas de DB par tenant) + RLS Postgres, pour rester aligné avec le modèle natif ShipSaaS et ne pas alourdir le provisioning d'un nouveau client.
- Abandon du module générique "ressource partagée" (eau/route fusionnés) — les deux domaines divergent trop (individuel/facturable vs collectif/non facturable) pour justifier une abstraction commune à ce stade. À réévaluer seulement si un 3e domaine similaire apparaît réellement.
- Facturation membres et facturation plateforme sont deux systèmes distincts, ne doivent jamais être confondus dans la conception.

## Point d'architecture technique de référence

Boilerplate ship-saas retenu (Next.js 15, Drizzle/PostgreSQL, Better Auth, Stripe, architecture en couches Presentation/Service/Persistence). Détail d'implémentation volontairement **hors du présent brief** — à traiter via `/ks-architect` une fois le pipeline killer-saas en place, pas anticipé ici pour éviter toute divergence avec ce que produira cette phase.

## Ouvert / à trancher via le pipeline killer-saas

- Interview `/ks-prd` complète (mode greenfield : pas de reverse-engineering, pas de graveyard, périmètre entièrement cœur)
- Validation ou ajustement du choix ship-saas via `/ks-architect`
- Design system via `/ks-design-system`
- Découpage en stories, cycle Research → Design → Plan → Execute → Review → Ship par story
