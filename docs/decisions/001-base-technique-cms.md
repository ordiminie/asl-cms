# ADR 001 — Base technique du CMS : ship-saas, pas WordPress

- Status: accepted
- Date: 2026-09-05
- Scope: framing

## Context

ASL-CMS est une plateforme multi-tenant (1 Organization = 1 association) dont le premier tenant est l'ASL La Fourche. Deux contraintes sont posées comme non négociables : le pipeline de développement **killer-saas** et le boilerplate **ship-saas** (Next.js 15, Drizzle/PostgreSQL, Better Auth, Stripe, architecture en couches Presentation/Service/Persistence).

Le cahier des charges technique ouvrait cependant la porte à un CMS bâti sur **WordPress dernière version**, avec des plugins maison préfixés `zs-`. La motivation était réelle et légitime : le bureau de l'association doit administrer son site sans compétence technique ni intervention du prestataire, et WordPress offre un back-office éprouvé, prévisible, éventuellement déjà connu de certains membres du bureau.

Il fallait trancher avant `/ks-prd` et `/ks-architect` : le choix détermine le modèle de tenancy, l'authentification, la facturation plateforme, le périmètre du design system et la structure des stories. Le laisser ouvert aurait produit un PRD et un découpage à réécrire.

Contraintes additionnelles pesant sur la décision : hébergement sur un VPS unique infogéré par Zourite Studio, contrat de maintenance à [montant masqué]/an, ~6 associations × ~300-400 comptes à terme, et une facturation plateforme (Zourite Studio ↔ association) par abonnement Stripe.

## Decision

Le CMS et l'ensemble de l'application sont bâtis sur le **boilerplate ship-saas** (Next.js 15, Drizzle/PostgreSQL, Better Auth, Stripe). **WordPress est écarté**, sous quelque forme que ce soit (monolithe, multisite ou headless derrière Next.js).

Le besoin d'ergonomie qui motivait WordPress n'est pas abandonné : il est requalifié en **exigence de design system**, traitée en `/ks-design-system` (patterns d'édition de page, listes, formulaires, aperçu avant publication), avec pour référence assumée l'expérience d'un éditeur de pages type WordPress/Payload.

## Considered options

- **ship-saas seul (retenu)** — un seul runtime, le multi-tenant, l'auth magic link et la facturation plateforme sont natifs, tout le code passe par le gate killer-saas (TDD + review). Coût accepté : le back-office éditorial est à construire, alors que WordPress le fournirait déjà.
- **WordPress monolithe (avec plugins maison `zs-`)** — rejeté : incompatible avec ship-saas, qui est non négociable. Imposerait de redévelopper le multi-tenant, l'authentification par lien magique et l'abonnement Stripe déjà fournis par le boilerplate.
- **WordPress multisite comme socle multi-tenant** — rejeté : WP multisite raisonne en base ou préfixe de tables par site, là où le modèle retenu est une base partagée scopée par `organization_id` avec Row-Level Security Postgres. La RLS y devient inapplicable et le provisioning d'un nouveau client s'alourdit.
- **WordPress headless (CMS de contenu) derrière un front Next.js** — rejeté : deux runtimes à héberger, déployer et maintenir (PHP + Node) sur un VPS unique à [montant masqué]/an de maintenance ; deux systèmes d'identité (utilisateurs WP vs Better Auth) reliés par un pont à maintenir ; et le contenu éditorial est trop imbriqué avec les données métier (blocs analyses d'eau, formulaire de fuite, page Contacts utiles) pour être isolé proprement d'un côté de la frontière.
- **Autre CMS headless Node (Payload, Strapi)** — non retenu à ce stade, mais moins disqualifié que WordPress : même langage et même base Postgres, ce qui lève l'objection des deux runtimes. Écarté pour l'instant parce qu'il ajouterait un second modèle d'authentification et de tenancy à concilier avec ship-saas, pour un besoin de contenu qui reste modeste (pages génériques, actualités, contenus répétables). À réévaluer seulement si le bloc CMS maison s'avère coûteux à faire évoluer.

## Consequences

**Ce qui devient plus simple**

- Un seul runtime, un seul déploiement, une seule base — cohérent avec un VPS unique et un contrat de maintenance modeste.
- Le multi-tenant (`organization_id` + RLS Postgres), l'auth magic link (Better Auth) et la facturation plateforme (Stripe) sont réutilisés tels quels, sans pont ni redéveloppement.
- Tout le code applicatif passe par le pipeline killer-saas : TDD, review anti-hallucination, gate avant ship. Rien d'important ne se joue dans de la configuration de plugins non testable.
- Surface de sécurité réduite : pas d'écosystème de plugins tiers à surveiller et à mettre à jour.

**Ce qui devient plus difficile**

- Le back-office éditorial est à construire : édition de pages, gestion des médias, aperçu avant publication, contenus répétables (analyses d'eau, actualités, membres du bureau, chemins et portails). C'est un coût de développement réel, qui n'existerait pas avec WordPress.
- L'ergonomie devient un risque produit à part entière : si le bureau ne s'approprie pas le BO, la promesse « gérer le site sans le prestataire » tombe, quel que soit le reste.

**À surveiller**

- Traiter l'ergonomie du back-office comme un objectif explicite de `/ks-design-system`, pas comme un sous-produit des écrans d'admin.
- Ne pas reconstruire un CMS généraliste : viser le strict nécessaire au périmètre (système de pages générique + quelques modèles de contenu répétables), et n'élargir que sur besoin avéré.
- Éditeur de texte riche et gestion des médias : deux briques où une bibliothèque tierce mature est probablement préférable à du maison — arbitrage à faire en `/ks-architect`.
- Si un besoin éditorial nettement plus lourd apparaît (chez un futur tenant, par exemple), rouvrir la piste d'un CMS headless Node par un nouvel ADR — pas WordPress.

**Portée documentaire**

- La convention de préfixe `zs-` visait des plugins WordPress : sans objet. La convention de nommage des modules est fixée par `/ks-architect`.
- Décision répercutée dans `docs/bases/cahier-des-charges-technique.md` §1.1, `docs/bases/brief-produit-asl-cms.md` (section « Base technique ») et `docs/bases/synthese-asl-cms-projetc.md` (section « Le produit »).
