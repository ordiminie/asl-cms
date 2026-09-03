---
title: ASL-CMS — vue d'ensemble du projet
description: Synthèse du produit ASL-CMS (plateforme multi-tenant pour ASL) et de son premier client, ASL La Fourche, à partir des docs du repo (S:\VSCode\asl-cms\docs)
last_updated: 2026-08-25
---

Artifact plan de com : https://claude.ai/code/artifact/1bfe8756-a92b-4849-a7fd-ceb0d66dd9ea

# ASL-CMS — vue d'ensemble

## Le produit

ASL-CMS (nom de code interne dev — nom commercial : voir section Communication ci-dessous) est un CMS + espace membre modulable destiné aux **associations syndicales libres (ASL) de terrains de vacances** (parcelles avec cabanon en dur + mobil-home/caravane). Zourite Studio (Marie-Ève Louvel, entreprise individuelle, La Réunion) le développe comme un **vrai produit SaaS vendable à plusieurs clients** — pas un site sur-mesure pour un seul client — avec un tronc commun mutualisé et des variantes de config par association.

**Modèle de tenancy** : 1 Organization ShipSaaS = 1 Association. Réutilisation directe du multi-tenant natif du boilerplate. Sous-domaine par défaut, domaine custom possible ensuite. Données scopées par `organization_id`, base partagée + Row-Level Security Postgres sur les tables sensibles.

**Stack technique** : boilerplate ShipSaaS — Next.js 15, Drizzle/PostgreSQL, Better Auth, Stripe, architecture en couches Presentation/Service/Persistence. Développement piloté par un pipeline maison "killer-saas" (`/ks-prd`, `/ks-architect`, `/ks-design-system`, cycle Research → Design → Plan → Execute → Review → Ship par story). Environnement de dev : conteneur Docker (`docker compose run --rm dev`) montant le dossier projet, avec Claude Code lancé dedans (`claude --permission-mode auto`).

**Pipeline commercial** : 1 client signé (ASL La Fourche) + 5 prospects au profil strictement identique (ASL de terrains de vacances gérant eau + routes + cotisations, aucune n'a de module de vote propre — ASL Community est probablement le fournisseur commun à toutes).

## Rôles

- **Visiteur** (public, non authentifié) — pages publiques, contact, alertes, résultats d'analyses d'eau, signalement de fuite
- **Membre** — tout ce que peut faire un visiteur + factures, historique conso eau, documents, vote, annonces, coordonnées
- **Bureau / Président(e)** (admin) — + gestion de contenu, validation des déclarations, publication de documents, facturation plateforme (mêmes pouvoirs pour l'instant, distinction possible plus tard)
- **SuperAdmin** (interne Zourite Studio) — simulation de n'importe quel rôle, aucune restriction

## Catalogue de modules

**Socle transverse** : Site public/CMS (avec bandeau d'alerte, assembleur de blocs pour d'autres modules), Espace membres & Auth (connexion par lien magique, 4h de validité), GED documentaire (accès par profil, séparation stricte des dossiers nominatifs), Communauté (petites annonces + annuaire de services, validées par le bureau), SEO (config par tenant).

**Intégrations tierces** : Facturation membres — lecture seule, paiement 100% délégué (Pennylane pour La Fourche), seule intégration avec un vrai pattern Strategy interchangeable par tenant ; Vote en ligne — redirect vers ASL Community, publication résultats/résolutions ; Communication — campagnes email Brevo (limite 300/jour, envoi étalé automatiquement), relances impayés automatiques (3 relances à 3/2/1 semaines).

**Modules domaine** (indépendants, pas de tronc commun forcé) : Module Eau (relevés individuels par import CSV/Excel, restriction/coupure, déclaration de fuite avec statut, publication d'analyses) ; Module Voirie (voies/chemins, suivi travaux, collectif, non facturable — développé pour d'autres associations, offert gracieusement à La Fourche si elle le souhaite).

Décision actée : pas d'abstraction générique "ressource partagée" fusionnant Eau et Voirie — les deux domaines divergent trop (individuel/facturable vs collectif/non facturable).

## ASL La Fourche — premier client

**Client** : ASL La Fourche, [adresse masquée] — présidente [nom masqué] (presidente@asl-exemple.test). ~400 comptes membres. Tiers comptable : Pennylane (seule association du lot à en avoir un).

**Devis n°042** : [montants masqués]

**Contrat de prestation** : [clauses masquées]

**Questions ouvertes au bureau** (dans `cahier-des-charges-fonctionnel_V3.md`, non tranchées à ce jour) : multi-parcelles par propriétaire et modalité de compte (A1), méthode de création des ~400 comptes initiaux — import liste vs création au fil de l'eau (A2), droits d'activation du bandeau d'alerte (B1), destinataire des notifications de fuite (B2), format de publication des analyses d'eau — PDF brut vs tableau saisi (B3), nom de domaine déjà réservé ou à choisir (B4), statut de facture binaire ou intermédiaire (C2), format/source des relevés de consommation + exemple de fichier (C3), fréquence d'import des relevés (C4), expiration auto des annonces (C5), état de l'accès ASL Community (D1), qui saisit les résolutions/résultats de vote (D2), utilité du module Voirie pour La Fourche (F1), qui peut envoyer des campagnes email en dehors de la présidente (E1), liste des 5 modèles de mail à préparer (E2).

## Backlog produit (stories)

16 user stories définies (`stories.md`, s01 à s16), complexité 1 à 4, s11 (factures membres, intégration Pennylane derrière une interface Strategy) identifiée comme la plus à risque. Périmètre calé sur les 10 fonctionnalités répliquées du PRD ; hors périmètre explicite : DB par tenant, abstraction Eau/Voirie fusionnée, électricité/gaz, logique de vote propre, traitement de paiement, messagerie privée, gestion multi-immeubles type syndic professionnel.

## Concurrence identifiée (recherche web, 2026-08-25)

- **Lotisoft** — logiciel généraliste pour ASL (lotissements, résidences fermées, 10-200 propriétaires), créé en 2020 par un président d'ASL. Couvre appels de fonds/tantièmes, AG, vote par correspondance en ligne, espace résident, messagerie @lotisoft.fr. Gratuit en usage de base, premium à partir de 15€ TTC/mois. Ne cible pas spécifiquement les terrains de vacances (pas de module eau individualisée/voirie collective) et gère lui-même la finance/tantièmes — là où ASL-CMS délègue entièrement la facturation à Pennylane. Différenciation ASL-CMS : niche terrain de vacances (eau individuelle facturable + voirie collective non facturable), pas d'outil financier propre.
- **ASL Community** — déjà fournisseur du module vote pour La Fourche (cf. plus haut) ; propose aussi des espaces de mise en relation ("Co-partage", "Co-service", "Co-bio") qui recoupent en partie le module Communauté d'ASL-CMS.
- **Vilogi** — plateforme copropriété/syndic généraliste, catégorie de référence citée dans le PRD (positionnement large, pas spécifique terrain de vacances).

## Communication / go-to-market

Stratégie de "build in public" à deux canaux distincts :
- **LinkedIn**, au nom de Zourite Studio ("agence web & IA"), couvrant tous les projets (ASL-CMS/Lp, Nelia l'agent SEO, un site Payload CMS) — objectif crédibilité, réseau pro web/IA, et prospection indirecte.
- **Facebook**, au nom de la marque produit — objectif prospection directe des 5 autres ASL et au-delà, contenu produit ciblé niche copro de vacances (site public, intranet, vote, chat...).

**Nom commercial : "Lp"** (provisoire, retenu le 2026-08-25). Décision issue d'un brainstorm couvrant plusieurs pistes :
- *Riverain(s)* — sens le plus juste (évoque à la fois l'eau et la voirie/route), mais écarté car trop connoté urbain/permis de construire dans l'usage courant.
- *Estivant(s)* — écarté, vocabulaire trop rare/administratif, peu utilisé au quotidien.
- *Cabanon* — écarté : dans l'Hérault (siège de La Fourche à Vias), "cabanisation" désigne les constructions illégales sur terrain protégé, sujet de lutte administrative active — connotation négative locale à éviter.
- *Domaine* / *MonDomaine* — écarté : mondomaine.fr est déjà un registrar de noms de domaine connu, confusion quasi garantie avec "nom de domaine" auprès d'une audience tech (LinkedIn).
- *Hameau*, *Terrena*, *MonTerrain*, *Terracoop*, *Terralien* — alternatives explorées mais non retenues à ce stade.
- **Lp retenu** : [justification du nom et vérification de marque masquées]
- Entre elles (Mève/Claude), "asl-cms" reste le nom de code interne/dev.
- [vérification de marque masquée]

**Plan de communication détaillé** (calendrier éditorial calé sur les phases du contrat, piliers de contenu par canal, idées de premiers posts, checklist de lancement) : publié en artefact — https://claude.ai/code/artifact/1bfe8756-a92b-4849-a7fd-ceb0d66dd9ea

## Sources

Docs lus dans `S:\VSCode\asl-cms\docs\` : brief-produit-asl-cms.md, prd.md, cahier-des-charges-fonctionnel_V3.md, stories.md, contrat-prestation-services-asl-la-fourche.md, Lancer-le-container-Docker.txt.
Recherche web complémentaire (concurrence, positionnement, naming) menée le 2026-08-25.