# ADR 011 — Intégrations métier derrière une interface interchangeable

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

Le PRD impose que « les intégrations dont le fournisseur peut changer d'un tenant à l'autre passent derrière une interface interchangeable (Strategy) : facturation membres et vote en ligne ». Il en fait un point stratégique, particulièrement pour le vote : « ASL Community est simultanément fournisseur et concurrent partiel », et « le vote par correspondance est à l'origine même du projet ».

Le PRD pose le principe ; il ne fixe pas la forme, ce qui revient à `/ks-architect`.

Deux dépendances externes sont par ailleurs des conditions suspensives du devis, non levées à ce jour : l'accès API Pennylane, et l'accès ASL Community assorti de la validation statutaire du vote électronique. Le découpage en stories en tient déjà compte — s19 livre l'interface de facturation et la saisie manuelle, s20 seule est bloquée sur Pennylane.

Le boilerplate n'offre aucun précédent pour ce genre de couture métier. Le seul modèle disponible est technique : `createStorage(type, config)` dans `src/lib/files/storage/storage-factory.ts` (voir ADR 004).

## Decision

Deux contrats de domaine, sélectionnés par association.

- **`MemberBillingProvider`** — liste des factures d'un membre, statut remonté tel quel, téléchargement du PDF quand le fournisseur le permet. Deux implémentations en V1 : `pennylane` et `manuel` (saisie par le bureau). C'est `manuel` qui rend s19 livrable sans attendre la levée de la réserve, et c'est aussi la réponse à « toute ASL a besoin de la fonction mais pas forcément de Pennylane ».
- **`VoteProvider`** — publication des résolutions, redirection vers le vote, publication des résultats et du PV. Une implémentation en V1 : `asl-community`. Aucune logique de vote n'est développée — dépouillement, quorum et procurations sont au cimetière.

Les contrats vivent dans la couche service et sont exposés par façade, conformément à `rule-architecture.md`. Le choix du fournisseur est un **paramètre d'association** (ADR 010), pas une variable d'environnement globale : deux associations peuvent avoir deux fournisseurs de facturation différents sur le même déploiement.

**Point non négociable de la conception du contrat de facturation** : le statut d'une facture est transporté tel que le fournisseur le rend. Le CDCT §5.2 est explicite — « Pennylane remonte plus que payée/impayée, statuts intermédiaires à mapper tels quels, ne pas réduire à un booléen ». Un booléen dans le contrat serait une perte d'information irréversible, y compris pour le ciblage des relances (s29).

## Considered options

- **Appeler les API Pennylane et ASL Community directement depuis les services** — rejeté : contredit le PRD, et rendrait s19 non livrable tant que la condition suspensive n'est pas levée. Priverait aussi de la saisie manuelle, qui est une fonctionnalité à part entière et non un mode dégradé.
- **Une abstraction générique « fournisseur externe » couvrant facturation et vote** — rejeté pour la même raison que le PRD refuse de fusionner Eau et Voirie : les deux domaines n'ont rien en commun au-delà du fait d'être externes. Une abstraction commune n'exprimerait rien et compliquerait les deux.
- **Choix du fournisseur par variable d'environnement** — rejeté : un déploiement sert six associations (ADR 003). Une variable globale les forcerait au même fournisseur, ce qui vide la décision de son intérêt.
- **Développer le vote en interne dès la V1** — rejeté : hors périmètre, explicitement au cimetière, et l'externalisation est justement ce que le contrat rend réversible plus tard.

## Consequences

**Ce qui devient plus simple**

- s19 se développe et se livre sans attendre l'accès Pennylane. La réserve ne bloque que s20.
- Internaliser le vote un jour demandera une implémentation du contrat, pas une refonte — c'est l'angle n°6 du PRD, et il devient vrai plutôt que déclaratif.
- Les tests métier se font contre une implémentation en mémoire, sans appeler d'API externe. Cohérent avec `rule-ci-cd-devops.md`, qui interdit le réseau en test unitaire.

**Ce qui devient plus difficile**

- Un contrat conçu avant d'avoir vu l'API réelle risque de mal vieillir. C'est un risque assumé et borné : le contrat est dicté par **nos besoins d'affichage** — liste, statut, PDF — pas par la forme de l'API Pennylane, qu'il n'a pas à épouser.
- Deux implémentations de facturation à maintenir, dont une saisie manuelle avec sa propre interface de back-office.

**À surveiller**

- **La clé de rapprochement entre une fiche membre et une fiche client Pennylane n'est pas tranchée** (PRD Constraints, CDCT §5.1). Elle s'indexe sur la clé primaire du membre, jamais sur l'email ni sur le numéro de parcelle — règle transverse des stories. Le contrat doit exposer cette clé de rapprochement comme une donnée du membre, pas la déduire.
- Ne pas confondre cette facturation avec l'abonnement Stripe Zourite Studio ↔ association : deux systèmes distincts, le PRD insiste. `MemberBillingProvider` ne touche jamais à Stripe.
- Aucune donnée bancaire ne transite par le produit : le paiement est une redirection (s21). Le contrat ne doit exposer aucun moyen de paiement.
