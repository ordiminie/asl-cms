# ADR 064 — Nature des envois : un réglage par modèle, modifiable par le SuperAdmin, figée sur la campagne

- Status: accepted
- Date: 2026-11-20
- Scope: story s27b-nature-envois
- Amends: ADR 051 (archive `campaign`), ADR 060 §2 (calcul de la cible)

## Context

s25 exclut tout désinscrit de toute campagne, à deux endroits : au **calcul de la cible**
(`computeCampaignTarget`, ADR 060 §2) et à la **livraison** d'une part (s26 : une adresse désinscrite
entre la création et sa part est sautée). s27b distingue `facultative` et `statutaire` : un désinscrit
reste dans les envois statutaires. La classification est une donnée de configuration du tenant, à
confirmer par le conseil RGPD (architecture l. 364-367), avec `facultative` par défaut. Arbitrage du
20/11/2026 : **le SuperAdmin seul** la modifie.

## Decision

1. **Un réglage `choice` par type d'envoi** — `campaign.nature.<templateId>` pour les cinq valeurs de
   `CAMPAIGN_TEMPLATE_IDS`, options `facultative` / `statutaire`, défaut `facultative`, section
   `campaign_nature`, `editableBy: 'super_admin'` (s52). Lecture par un accesseur unique qui rend
   `facultative` pour toute valeur absente ou inconnue. Valeurs du premier tenant dans le seed, jamais dans
   le registre. s29 et s42 ajouteront leurs clés au même mécanisme.
2. **Le calcul de la cible reçoit la nature** — `computeCampaignTarget(rows, isTargeted, nature)` : en
   `statutaire`, une adresse désinscrite reste destinataire (comptée `reinstated`) ; en `facultative`,
   rien ne change. `readTarget` dérive la nature du modèle, lue dans les réglages : les quatre lecteurs
   de la cible reçoivent le modèle. Aucune nature dans une saisie.
3. **La nature est figée sur la campagne à la création** — colonne `campaign.nature` (enum
   `campaign_nature`, défaut `facultative` : c'est ce qu'ont fait les campagnes déjà envoyées). Elle
   commande la livraison (en `statutaire`, le contrôle de désinscription de s26 est sauté) et le pied de
   page. Reclasser un modèle vaut pour la campagne suivante, jamais pour une campagne en cours.
4. **Le lien de désinscription reste sur un envoi statutaire** (PRD l. 72) ; il désinscrit des seuls envois
   facultatifs, et son libellé le dit.

## Considered options

- **Nature choisie par le bureau en rédigeant** — rejetée par la story (« pas de case information
  obligatoire » : elle permettrait de contourner une désinscription).
- **Constante de code par modèle** — rejetée : la classification attend l'avis du conseil RGPD ; un
  changement doit être une valeur, pas un déploiement.
- **Réglage modifiable par le bureau** — rejeté par l'arbitrage du 20/11 : reclasser « Message libre » en
  statutaire annulerait les désinscriptions.
- **Lire la nature au moment de la livraison** — rejetée : une campagne étalée sur plusieurs jours
  changerait de règle en cours de route si le modèle était reclassé.
- **Réintégrer seulement au calcul de la cible** — rejetée : le filtre de livraison exclurait un membre
  qui se désinscrit pendant l'envoi étalé d'une convocation.

## Consequences

- `unsubscribed_count` d'une campagne se lit avec sa nature : adresses exclues en `facultative`,
  adresses désinscrites qui l'ont reçue en `statutaire`.
- En production, la classification de chaque association se saisit par le SuperAdmin dans les réglages
  (La Fourche : valeurs du tableau de s27b, à confirmer par le conseil RGPD).
- Un nouveau type d'envoi sans clé déclarée se traite comme `facultative`.
