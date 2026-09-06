# PRD — ASL-CMS (nom commercial provisoire : Lp)

## Target SaaS

**Aucune cible à répliquer — projet greenfield assumé.**

killer-saas suppose normalement qu'un SaaS existant sert de spécification. Ce n'est pas le cas ici : ASL-CMS est conçu à partir d'un besoin client réel (ASL La Fourche, devis n°042 voté en AG de juillet 2026) et non par rétro-ingénierie d'un produit concurrent. La spécification de référence est donc `docs/Admin-MEL/cahier-des-charges-fonctionnel_V5.md` (contractuel) et sa traduction technique `docs/bases/cahier-des-charges-technique.md`.

**Concurrent de référence, utilisé comme source d'inspiration et non comme modèle** : [Lotisoft](https://www.lotisoft.fr) — logiciel généraliste de gestion pour ASL et lotissements (appels de fonds, tantièmes, AG, vote par correspondance, espace résident). Gratuit en gestion complète, premium à 15 € TTC/mois. Sept de ses fonctionnalités ont été retenues et sont marquées *(inspiré de Lotisoft)* dans le périmètre ci-dessous ; le reste est explicitement écarté.

Autres acteurs identifiés : **ASL Community** (fournisseur du module vote de La Fourche, et concurrent partiel via ses espaces Co-partage / Co-service) et **Vilogi** (copropriété/syndic généraliste).

## Kill mode

**Produit multi-clients.** ASL-CMS est développé comme un produit SaaS vendable, pas comme un site sur-mesure : tronc commun mutualisé, variantes par configuration de tenant. 1 client signé (ASL La Fourche) + 5 prospects au profil strictement identique.

Conséquences directes sur le périmètre :

- tout ce qui est propre à La Fourche doit être **paramétrable**, jamais codé en dur (adresses de notification, catégories, seuils, activation des relances) ;
- le coût d'une fonctionnalité se juge sur **six associations**, pas une ;
- les intégrations dont le fournisseur peut changer d'un tenant à l'autre passent derrière une **interface interchangeable** (Strategy) : facturation membres et vote en ligne ;
- la facturation plateforme (Zourite Studio ↔ association) est un système distinct de la facturation membres, et ne doit jamais être confondue avec elle.

## Why kill it

Lotisoft existe, couvre les ASL, et sa gestion complète est **gratuite**. Un PRD honnête doit dire ce qui justifie de construire malgré cela. Trois raisons retenues :

1. **La niche terrain de vacances.** Lotisoft raisonne en lots et tantièmes de copropriété bâtie. Il n'a aucun module de ressource individuelle mesurée : ni relevés de compteurs d'eau, ni facturation à la consommation, ni suivi de fuites, ni publication d'analyses. C'est le vrai fossé fonctionnel, et c'est le cœur du besoin des six associations visées (eau + routes + cotisations).
2. **Le site public.** Lotisoft est un outil de gestion interne ; son espace résident est un portail privé. Les associations visées veulent une **vitrine publique éditable et référencée** — accueil, actualités, présentation du bureau, page « je viens d'acquérir un terrain », résultats d'analyses d'eau consultables sans compte — pas seulement un intranet.
3. **La propriété du produit.** Zourite Studio possède le socle, le revend aux 5 prospects et facture la maintenance. Adopter Lotisoft reviendrait à renoncer à l'actif et à devenir prestataire de paramétrage d'un outil tiers.

*Non retenu comme argument, bien que vrai : le fait que Lotisoft gère lui-même la finance là où ASL-CMS la délègue à Pennylane. C'est une contrainte de conception, pas un avantage vendable.*

## Problem

Les associations syndicales libres de terrains de vacances gèrent des ressources partagées (eau individualisée, voirie collective) et des cotisations, avec des bureaux **bénévoles** et sans outil adapté. Elles fonctionnent au courrier, au tableur et au bouche-à-oreille.

Trois besoins non couverts par l'existant :

- **informer sans intermédiaire** : publier alertes, actualités et résultats d'analyses d'eau sans dépendre d'un prestataire technique ;
- **individualiser** : donner à chaque propriétaire l'accès à ses factures, sa consommation d'eau et ses documents nominatifs, sans qu'aucun ne voie ceux d'un autre ;
- **communiquer en masse et légalement** : convoquer aux AG, relancer les impayés, diffuser les PV — y compris auprès des membres sans adresse email.

Pourquoi maintenant : La Fourche a voté le budget en AG de juillet 2026 et signé. Cinq autres associations attendent. Le calendrier contractuel court jusqu'à la mise en production en mai 2027.

## Target users

- **Visiteur** — futur acquéreur, riverain, curieux. Consulte le site public sans compte : présentation, actualités, analyses d'eau, contact, signalement de fuite.
- **Membre propriétaire** — de quelques dizaines à ~400 par association (La Fourche : 400 propriétaires, dont 300 avec adresse email et compte connectable, 100 joignables par courrier seulement — arbitrage du 6 septembre 2026). Souvent âgé, peu à l'aise avec l'informatique, présent une partie de l'année seulement. Se connecte rarement, pour une raison précise : sa facture, sa consommation, un document, une déclaration. **Environ un quart n'a pas d'adresse email** et reste joignable uniquement par courrier.
- **Bureau** — 3 à 8 bénévoles élus, non techniciens, qui changent tous les quelques années. Ce sont eux qui font vivre le site : ils doivent pouvoir tout éditer sans intervention du prestataire. Leur temps est la ressource la plus rare du projet.
- **Président(e)** — membre du bureau avec des prérogatives propres (aujourd'hui : résolutions de vote et publication des résultats/PV).
- **SuperAdmin (Zourite Studio)** — support et débogage, simulation de rôle, non exposé aux associations.

## Perimeter — the 20% that matters

### Replicated (core loop)

**Tronc commun — livré à toute association**

| Feature | Complexity (1-5) | Why this score |
| --- | --- | --- |
| CMS de pages génériques (créer / modifier / publier / dépublier) | 3 | Éditeur, cycle de publication, modèles de contenu répétables. Le bureau doit pouvoir tout faire seul. |
| Permissions par rôle configurables en back-office | 4 | Autorisation transverse à tout le produit. CASL est présent dans le boilerplate, mais le rendre paramétrable par tenant reste structurant. |
| Connexion par lien magique (validité 4 h) | 3 | Natif Better Auth, mais flux d'invitation, expiration et absence de mot de passe à éprouver auprès d'un public âgé. Le flux d'invitation inclut le suivi d'adoption au lancement — qui a été invité, qui s'est connecté — sans quoi le premier contact avec 400 propriétaires se ferait à l'aveugle. |
| Pages publiques + formulaire de contact archivé en BO | 2 | Formulaire, persistance, liste consultable, notification paramétrable. |
| Limitation de débit des formulaires publics | 1 | Un formulaire public sans protection est une porte ouverte au spam, qui coûte au bureau bénévole le temps que le produit prétend lui rendre. Compteur sur empreinte d'IP hachée, purgé sous 24 h : aucun journal d'adresses en clair, donc aucune donnée personnelle sans règle de rétention. |
| Actualités de l'association (mini-blog daté) | 2 | Contenu répétable listé au CDC §4.1 et nommé dans les critères de succès. Réemploie l'éditeur et le cycle de publication du CMS. |
| Présentation du bureau (fiches listables et éditables) | 2 | Explicitement pas une page statique : sous-modèle nom / rôle / photo / bio, réordonnable. C'est ce que « le bureau met à jour dynamiquement » exige à chaque renouvellement. |
| Bandeau d'alerte global | 1 | Activation / édition / désactivation par tout membre du bureau. |
| SEO (sitemap, métadonnées, Search Console) | 2 | Réglages par tenant, pas de logique propre. |
| Import initial des membres d'une association (liste nom / adresse postale / email / parcelle) | 3 | Provisioning d'un nouveau client : parseur, dédoublonnage des propriétaires multi-parcelles, fiches sans compte pour les membres sans email. Six associations à charger, pas une. La clé de dédoublonnage n'est pas tranchée et sa défaillance donnerait à deux propriétaires distincts accès aux données l'un de l'autre. |
| Modèle membre ↔ parcelle **daté** | 4 | Cœur du modèle de données. L'historique est attaché à la parcelle au moment des faits : une vente ne transfère pas les factures et documents antérieurs. Ce n'est pas une simple clé étrangère. |
| Coordonnées (profil membre) | 1 | CRUD sur ses propres données. |
| Questions au bureau, catégories avec routage email | 2 | Modèle de catégories (max 10) réutilisable avec les petites annonces. |
| Notes internes et historique par membre *(inspiré de Lotisoft)* | 2 | Fiche membre côté bureau : notes privées et historique des échanges. Assure la continuité quand le bureau change. **Sensible RGPD** : ce sont des notes sur des personnes. |
| Import annuel des relevés d'eau (Excel/CSV) + rapport d'erreurs par email | 3 | Parseur, validation, rapport. Format non figé : dépend du modèle imposé par Pennylane. |
| Historique de consommation d'eau par membre | 2 | Lecture scopée strictement par membre, agrégée si multi-parcelles. |
| Signalements avec catégories et statuts *(généralisé, inspiré de Lotisoft)* | 3 | Workflow `signalé → en cours → résolu`, en version publique anonyme et en version membre identifiée. Généralisé au-delà des fuites d'eau : voirie, éclairage, nuisance. La V5 §5.6 parle déjà de « fuite ou d'incident ». |
| Publication des analyses d'eau | 2 | Contenu répétable (date, affiche, texte, PDF), saisie rapide car publication au moins mensuelle. |
| Documents partagés (statuts, PV, ordres du jour) | 2 | Dossier commun, accès à tout membre authentifié. |
| Documents nominatifs en dossiers **physiquement séparés** | 4 | Un dossier par membre, pas un filtre logique : l'objectif est d'exclure tout accès croisé même en cas de bug d'autorisation. |
| Campagnes email Brevo (4 modèles + campagne libre, gabarit commun) | 3 | En-tête et pied de page communs, variables dynamiques, contenu des modèles à rédiger avec le bureau. |
| Envoi échelonné au-delà de 300 destinataires | 3 | Scission automatique sur deux jours à coder dans le déclenchement, pas une limite affichée. |
| Relances d'impayés (jusqu'à 3, à 3/2/1 semaines), activables par tenant | 4 | Planification, idempotence, ciblage du sous-groupe impayés, activation en configuration. |
| Publipostage PDF pour les membres sans email *(inspiré de Lotisoft)* | 3 | Une campagne génère un PDF à variables dynamiques, prêt à imprimer et poster. **Fait entrer dans le produit le quart de membres aujourd'hui hors système.** |
| Groupes de destinataires personnalisés *(inspiré de Lotisoft)* | 2 | Au-delà des deux cibles actuelles (tous / impayés) : groupes composés par le bureau. |
| Statistiques d'ouverture et de clic des campagnes *(inspiré de Lotisoft)* | 2 | Brevo les mesure déjà ; il s'agit de les restituer en back-office. |
| Modèles de documents réutilisables *(inspiré de Lotisoft)* | 3 | Convocation, PV, courrier type — au-delà des modèles d'email. |
| Facturation membres : interface + implémentation Pennylane | 4 | Lecture seule : liste, statuts remontés tels quels (pas un booléen), téléchargement PDF si l'API le permet. Derrière une interface interchangeable, car toute ASL a besoin de la fonction mais pas forcément de Pennylane — une saisie manuelle doit rester possible. |
| Redirection de paiement | 1 | Simple lien sortant. Aucune donnée bancaire ne transite ni n'est stockée. |
| Multi-tenant (Organization, configuration par tenant, RLS Postgres) | 4 | Scoping de toutes les données métier, cloisonnement renforcé sur les tables sensibles, provisioning d'un nouveau client. |
| Export individuel d'un membre (droit d'accès RGPD) | 2 | Même machinerie que l'export d'association, filtrée sur un membre — mais autre utilisateur, autre surface d'autorisation, et doit fonctionner pour un membre sans compte, via le bureau. |
| Simulation de rôle SuperAdmin (support et débogage) | 2 | Décrit aux Target users comme une capacité du SuperAdmin. Consulter le site avec les droits d'un rôle pour reproduire un incident, sans demander ses accès au bureau. Écritures tracées au SuperAdmin. |
| Export et portabilité des données *(inspiré de Lotisoft)* | 3 | Export complet dans un format ouvert. Répond au droit à la portabilité RGPD et constitue un argument anti-verrouillage face aux concurrents. |

**Modules activables par tenant**

| Feature | Complexity (1-5) | Why this score |
| --- | --- | --- |
| Vote : interface + implémentation ASL Community | 3 | Redirection, publication des résolutions, des résultats et du PV. Aucune logique de vote développée. Traité derrière une interface interchangeable — voir *L'angle*. Saisie des résolutions et publication réservées à la présidente. |
| Voirie | 2 | Chemins et portails avec statut et message libre, plan en image statique. Collectif, non facturable. Modèle volontairement **non fusionné** avec le module Eau. |
| Petites annonces entre membres | 3 | Soumission, modération obligatoire du bureau (accepter / modifier / rejeter), catégories extensibles, affichage trié. Classé « bonus » au catalogue produit ; la modération obligatoire crée une charge récurrente pour un bureau bénévole, d'où l'activation par tenant. |

### Explicitly NOT replicated (graveyard)

**Décidé avec le client (cahier des charges §10)**

- Gestion de l'électricité — contrats individuels propriétaire ↔ fournisseur. Pas de gaz de ville non plus.
- Logique de vote : dépouillement, quorum, procurations — entièrement côté ASL Community.
- Traitement des paiements — entièrement côté Pennylane. Aucune donnée bancaire ne transite par le site : hors périmètre DSP2/PCI.
- Messagerie privée entre membres, au-delà des coordonnées volontairement affichées dans une annonce.
- Gestion multi-immeubles et répartition de charges type syndic professionnel.
- Plan B de connexion pour les membres sans email : aucun compte, aucun contournement. Ils restent gérés par courrier — et c'est précisément ce que le publipostage PDF vient améliorer.

**Écarté de Lotisoft après examen**

- Appels de fonds, fonds de travaux et répartition par tantièmes — reste chez le comptable de l'association.
- Carte interactive des lots et des voiries — une image statique uploadée suffit, décision client explicite.
- Vote en direct avec synchronisation temps réel, émargement numérique et gestion des procurations — côté ASL Community.
- Assistant IA conversationnel interrogeant les données de l'association.
- Classification automatique des documents scannés par IA.
- Tableau de tâches (Kanban) du bureau — outil de gestion interne trop éloigné du cœur « site + espace membre ».
- Messagerie intégrée avec adresse email dédiée par association.

**Écarté par décision d'architecture**

- Une base de données par tenant — base partagée + RLS Postgres.
- Abstraction générique « ressource partagée » fusionnant Eau et Voirie — les deux domaines divergent trop (individuel/facturable contre collectif/non facturable). À réévaluer seulement si un troisième domaine similaire apparaît réellement.
- WordPress comme base du CMS — voir `docs/decisions/001-base-technique-cms.md`.

### The angle (done differently / better)

1. **La ressource individuelle mesurée.** Aucun concurrent identifié ne traite l'eau comme une ressource relevée, facturée à la consommation, sujette à fuite et à analyse. C'est le cœur de la valeur pour une ASL de terrains de vacances, et le fossé le plus difficile à combler pour un généraliste de la copropriété.

2. **Les membres sans email cessent d'être des exclus.** C'est l'angle le plus concret et le moins imité. Un quart des membres de La Fourche n'a pas d'adresse email ; tous les outils du marché, y compris Lotisoft, les laissent hors du système. Le publipostage PDF les réintègre dans le même flux de communication que les autres, sans double saisie pour le bureau.

3. **Un site public, pas seulement un intranet.** Vitrine éditable et référencée, avec des contenus consultables sans compte (analyses d'eau, alertes, actualités, signalement de fuite). Les concurrents s'arrêtent au portail privé.

4. **La finance reste chez le comptable.** Le produit lit et affiche, il ne facture pas. Aucune donnée bancaire, aucun tantième, aucun appel de fonds — moins de responsabilité, moins de surface réglementaire, et pas de doublon avec l'outil comptable déjà en place.

5. **Pas de verrouillage.** Export complet des données dans un format ouvert. À l'inverse d'un outil qui retient ses clients par leurs données.

6. **Une dépendance au vote conçue pour être réversible.** Le vote en ligne est externalisé chez ASL Community, mais derrière une interface interchangeable. Ce point est stratégique : le vote par correspondance est **à l'origine même du projet**, et ASL Community est simultanément fournisseur et concurrent partiel. Internaliser un jour ne demandera qu'une nouvelle implémentation, pas une refonte.

## Constraints

**Techniques**

- Boilerplate ship-saas imposé : Next.js 16.3, React 19, Drizzle/PostgreSQL, Better Auth, Stripe, CASL, architecture en couches Presentation/Service/Persistence. Voir ADR 001.
- Pipeline killer-saas imposé : aucune ligne de code hors du cycle Research → Design → Plan → Execute → Review → Ship.
- Hébergement VPS LWS en France (2 vCore, 4 Go, 100 Go SSD), infogéré. Le stockage de fichiers du boilerplate (Supabase) et l'email (Resend) devront être remplacés — stockage local et Brevo. À trancher en `/ks-architect`.
- Brevo plafonne à 300 emails par jour.
- Équipe : une seule personne.

**Dépendances externes bloquantes**

- Accès API Pennylane et clé de rapprochement compte ↔ fiche client : condition suspensive du devis.
- Accès ASL Community confirmé par écrit **et** validation statutaire du vote électronique : condition suspensive du devis. Le module vote ne démarre pas tant que la réserve n'est pas levée.
- Validation RGPD de la règle de rétention des données d'un ex-propriétaire : la purge ne doit pas être codée avant arbitrage.
- Exemples de fichiers à obtenir avant développement : relevés de consommation d'eau et facturation Pennylane.
- Contenu détaillé des 4 modèles d'email et de leurs variables : à rédiger avec le bureau.

**Calendrier contractuel**

Signature septembre 2026 → fondations et site public (sept-oct) → espace membres et communication (nov) → vote (déc) → GED (janv 2027) → fonctionnalités complémentaires (fév) → recette (mars) → correctifs et mise en production (avr-mai 2027). Recette : 30 jours pour signaler une non-conformité. Garantie de conformité : 2 mois après mise en ligne.

## Success criteria

**Le produit fonctionne**

- Un membre se connecte par lien magique et accède à ses factures, sa consommation d'eau et ses documents nominatifs — et à rien qui appartienne à un autre membre. Vérifié par un test d'autorisation croisée sur chaque ressource nominative.
- Le bureau crée, modifie et publie une page, une actualité et une analyse d'eau **sans aucune intervention du prestataire**. Mesuré à la recette, par un membre du bureau seul devant l'écran.
- Une campagne partant à plus de 300 destinataires est automatiquement scindée sur deux jours, sans action du bureau.
- Une campagne produit un PDF de publipostage exploitable pour les membres sans email, sans ressaisie.
- L'import annuel des relevés d'eau traite le fichier réel du bureau et envoie un rapport d'erreurs exploitable.

**Le produit est un produit, pas un site**

- Une deuxième association est provisionnée sans écrire une ligne de code : uniquement configuration, activation de modules et chargement de sa liste de membres.
- Aucune donnée propre à La Fourche n'est codée en dur — vérifié par revue : adresses de notification, catégories, seuils, activation des relances.
- Les modules Vote et Voirie se désactivent par tenant sans effet de bord sur le reste.

**La qualité tient**

- Tests passants sur la logique métier ; aucune régression sur l'existant.
- Review passée sans critique ouverte pour chaque story (gate `/ks-review`).
- Recette client acceptée dans les 30 jours contractuels.
- Mise en production effective sur le VPS avant fin mai 2027.

**L'angle est tenu**

- Les membres sans email reçoivent la même information que les autres, par courrier généré depuis le même outil.
- L'export complet des données d'une association est produit à la demande, dans un format ouvert et relisible.
