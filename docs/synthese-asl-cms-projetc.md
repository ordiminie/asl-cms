---
title: ASL-CMS — vue d'ensemble du projet
description: Synthèse du produit ASL-CMS (plateforme multi-tenant pour ASL) et de son premier client, ASL La Fourche, à partir des docs du repo (S:\VSCode\asl-cms\docs)
last_updated: 2026-09-05
---

Artifact plan de com : https://claude.ai/code/artifact/1bfe8756-a92b-4849-a7fd-ceb0d66dd9ea

# ASL-CMS — vue d'ensemble

## Le produit

ASL-CMS (nom de code interne dev — nom commercial : voir section Communication ci-dessous) est un CMS + espace membre modulable destiné aux **associations syndicales libres (ASL) de terrains de vacances** (parcelles avec cabanon en dur + mobil-home/caravane). Zourite Studio (Marie-Ève Louvel, entreprise individuelle, La Réunion) le développe comme un **vrai produit SaaS vendable à plusieurs clients** — pas un site sur-mesure pour un seul client — avec un tronc commun mutualisé et des variantes de config par association.

**Modèle de tenancy** : 1 Organization ShipSaaS = 1 Association. Réutilisation directe du multi-tenant natif du boilerplate. Sous-domaine par défaut, domaine custom possible ensuite. Données scopées par `organization_id`, base partagée + Row-Level Security Postgres sur les tables sensibles.

**Stack technique** : boilerplate ShipSaaS — Next.js 16, Drizzle/PostgreSQL, Better Auth, Stripe, architecture en couches Presentation/Service/Persistence. Développement piloté par un pipeline maison "killer-saas" (`/ks-prd`, `/ks-architect`, `/ks-design-system`, cycle Research → Design → Plan → Execute → Review → Ship par story). Environnement de dev : conteneur Docker (`docker compose run --rm dev`) montant le dossier projet, avec Claude Code lancé dedans (`claude --permission-mode auto`).

**Arbitrage CMS (5 septembre 2026) : WordPress écarté.** L'idée de bâtir le CMS sur WordPress — pour offrir au bureau un back-office ergonomique et familier — a été examinée puis rejetée : deux runtimes à héberger et maintenir (PHP + Node), un multi-tenant WP multisite incompatible avec le modèle `organization_id` + RLS Postgres, un second système d'identité face au magic link Better Auth, une facturation plateforme à redévelopper alors que Stripe/ShipSaaS la couvre nativement, et un écosystème de plugins hors du pipeline killer-saas (TDD + review) comme du contrat de maintenance à [montant masqué]/an. Le besoin réel — un back-office éditorial prévisible, utilisable sans compétence technique — reste une exigence de premier plan, traitée en `/ks-design-system` avec pour référence l'ergonomie d'un éditeur de pages type WordPress/Payload. Décision formalisée en ADR 001 (`docs/decisions/001-base-technique-cms.md`).

**Pipeline commercial** : 1 client signé (ASL La Fourche) + 5 prospects au profil strictement identique (ASL de terrains de vacances gérant eau + routes + cotisations, aucune n'a de module de vote propre — ASL Community est probablement le fournisseur commun à toutes).

## Rôles

- **Visiteur** (public, non authentifié) — pages publiques, contact, alertes, résultats d'analyses d'eau, signalement de fuite
- **Membre** — tout ce que peut faire un visiteur + factures, historique conso eau, documents qui lui sont destinés, vote, annonces, coordonnées
- **Bureau** (admin) — + gestion de contenu, validation des déclarations et des annonces, publication de documents, abonnement plateforme
- **Président(e)** — Bureau + actions réservées. Une seule à ce jour : saisie des résolutions de vote et publication des résultats/PV. D'autres suivront probablement, d'où le besoin d'un **mécanisme de permissions par rôle configurable en back-office** plutôt qu'un hardcode par action (à étudier en `/ks-architect`)
- **SuperAdmin** (interne Zourite Studio) — simulation de n'importe quel rôle, aucune restriction, non exposé à l'association

## Catalogue de modules

**Socle transverse** : Site public/CMS (pages génériques éditables, contact archivé en BO, bandeau d'alerte activable par tout membre du bureau, actualités, page « Contacts utiles » alimentée par le bureau, assembleur de blocs pour d'autres modules), Espace membres & Auth (connexion par lien magique, 4 h de validité, aucun plan B pour les ~100 membres sans email — gérés hors-ligne), GED documentaire (accès par profil, dossier physiquement séparé par membre pour les documents nominatifs), Communauté (petites annonces, modération obligatoire du bureau : accepter / modifier / rejeter), SEO (config par tenant).

**Intégrations tierces** : Facturation membres — lecture seule, statuts Pennylane repris tels quels y compris intermédiaires (pas un booléen payé/impayé), facture consolidée produite par Pennylane et non agrégée par le site, paiement 100% délégué par simple redirection ; seule intégration avec un vrai pattern Strategy interchangeable par tenant. Vote en ligne — redirect vers ASL Community, publication résolutions/résultats/PV, aucune logique de vote développée ici. Communication — campagnes email Brevo (4 modèles + un mode campagne libre, tous dans un habillage commun en-tête/pied de page ; limite 300/jour avec scission automatique de l'envoi sur 2 jours), relances impayés automatiques (jusqu'à 3, à 3/2/1 semaines) dont **l'activation est un paramètre par tenant**.

**Modules domaine** (indépendants, pas de tronc commun forcé) : Module Eau (relevés individuels par import annuel CSV/Excel pré-nettoyé par le bureau, restriction/coupure, déclaration de fuite avec statut — anonyme côté public, rattachée au membre côté espace connecté, publication d'analyses ≥ mensuelle) ; Module Voirie (chemins et portails avec statut + message libre, plan en image statique, collectif et non facturable) — **confirmé utile par le bureau de La Fourche : développé et inclus sans surcoût, hors devis**.

Décisions actées : pas d'abstraction générique "ressource partagée" fusionnant Eau et Voirie (les deux domaines divergent trop : individuel/facturable vs collectif/non facturable) ; petites annonces et annuaire des services fusionnés en un seul module, mais la page « Contacts utiles » reste un modèle distinct ; l'historique (factures, documents, relevés) est attaché à la parcelle au moment des faits, pas au propriétaire courant.

## ASL La Fourche — premier client

**Client** : ASL La Fourche, [adresse masquée] — présidente [nom masqué] (presidente@asl-exemple.test). **~300 comptes membres pour ~400 propriétaires historiques** (regroupement multi-parcelles + ~100 membres sans adresse email) — chiffre exact à confirmer sur la liste réelle avant l'import initial. Tiers comptable : Pennylane (seule association du lot à en avoir un). Domaine à réserver : `asl-exemple.test`.

**Devis n°042** : [montants masqués]

**Contrat de prestation** : [clauses masquées]

**Documents de référence** : le cahier des charges fonctionnel **V5** (`docs/Admin-MEL/cahier-des-charges-fonctionnel_V5.md`) est le document contractuel annexé au contrat — il prévaut en cas de divergence. Sa traduction technique de travail, interne et non contractuelle, est `docs/cahier-des-charges-technique.md` (dernière synchronisation avec la V5 : 3 septembre 2026).

**Questions au bureau — tranchées.** Les questions ouvertes des versions V3/V4 (multi-parcelles, méthode de création des comptes, droits sur le bandeau d'alerte, destinataires des notifications de fuite, format de publication des analyses d'eau, nom de domaine, statuts de facture, format et fréquence des relevés, expiration des annonces, accès ASL Community, saisie des résolutions de vote, utilité du module Voirie, émetteurs de campagnes email, modèles de mail) ont toutes reçu une réponse du bureau, intégrée dans la V5 et dans le cahier technique. Notamment : comptes créés par import d'une liste fournie ; bandeau d'alerte ouvert à tout le bureau ; campagnes email ouvertes à tout le bureau ; résolutions et résultats de vote réservés à la présidente ; 4 modèles d'email + un mode campagne libre ; relevés d'eau importés 1×/an ; pas d'expiration automatique des annonces ; module Voirie confirmé.

**Points encore ouverts / bloquants** (détail et stories impactées dans `cahier-des-charges-technique.md` §11) :
- Nombre exact de comptes à importer (300 vs 400) — à vérifier sur la liste réelle.
- Accès API Pennylane, clé de rapprochement compte site ↔ fiche Pennylane, exemple de facturation (détection des impayés), format du fichier de relevés d'eau — à obtenir en RDV Pennylane.
- Accès ASL Community + validation statutaire du vote électronique — condition suspensive, module vote non démarrable.
- Validation RGPD de la règle de rétention des données d'un ex-propriétaire — ne pas coder la purge avant arbitrage.
- Contenu détaillé des 4 modèles d'email et de leurs variables dynamiques — à rédiger avec le bureau.
- Réservation du nom de domaine `asl-exemple.test` — action prestataire, non bloquante pour le dev.

## Backlog produit (stories)

**À régénérer.** Le PRD (`prd.md`) et le découpage en 16 stories (`stories.md`, s01→s16) issus du premier passage ont été retirés du repo : ils précédaient le cahier des charges technique et la V5, et ne reflètent plus le périmètre arbitré (rôle Président(e) distinct, fusion annonces/annuaire de services, page Contacts utiles, module Voirie confirmé, statuts de facture non binaires, historique attaché à la parcelle). Prochaine étape : rejouer `/ks-prd` puis `/ks-stories` sur la base du cahier technique et de la V5, avec `/ks-stories-review` pour valider le découpage.

Hors périmètre explicite, inchangé : DB par tenant, abstraction Eau/Voirie fusionnée, électricité/gaz, logique de vote propre, traitement de paiement, messagerie privée entre membres, gestion multi-immeubles type syndic professionnel.

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

Docs lus dans `S:\VSCode\asl-cms\docs\` : `cahier-des-charges-technique.md`, `brief-produit-asl-cms.md`, `Lancer-le-container-Docker.txt`, et dans `docs\Admin-MEL\` : `cahier-des-charges-fonctionnel_V5.md`, `contrat-prestation-services-asl-la-fourche.md`, `Devis_042_ASL_La_Fourche_v9.pdf`, `ASL_LA_FOURCHE_Presentation.pdf` (support AG du 24/07/2026), `calendrier-previsionnel-v1.jpg`.
Historique : `prd.md`, `stories.md` et `cahier-des-charges-fonctionnel_V3/V4` ont été lus lors de la première rédaction (2026-08-25) puis retirés du repo — voir Backlog produit.
Recherche web complémentaire (concurrence, positionnement, naming) menée le 2026-08-25.
