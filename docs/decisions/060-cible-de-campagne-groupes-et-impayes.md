# ADR 060 — Cible de campagne : trois types, un seul calcul, groupes en table dédiée

- Status: accepted
- Date: 2026-11-18
- Scope: story s27-groupes-destinataires

## Context

s25 n'envoie qu'à « tous les membres » ; s27 ajoute les membres en impayé (prédicat de s19, ADR 059) et
des groupes composés par le bureau. La story impose que le calcul de la cible reste **le point de passage
unique** des trois cibles (exclusion des désinscrits, puis réintégration statutaire en s27b, relances de
s29, courrier de s28). Depuis s53 et s54, une adresse peut être portée par plusieurs fiches et la
désinscription vaut **par adresse** (ADR 057). Il faut décider : où et comment filtrer, comment
définir « fiche en impayé », comment stocker un groupe, et ce que garde une campagne d'un groupe
supprimé.

## Decision

1. **Type de cible** `CampaignTarget = {kind: 'all_members'} | {kind: 'unpaid_members'} | {kind:
'group', groupId}`, reçu par les quatre lecteurs de la cible (composeur, aperçu, plan d'envoi,
   création). Le serveur recalcule toujours la cible à la création, sous `withTenant` (critère 1), puis
   la fige dans `campaign_recipient` (ADR 051, 052).
2. **Filtre après regroupement, pas avant** (arbitrage du 18/11/2026). Les lignes de **toutes** les
   fiches sont lues et groupées par adresse ; une adresse est retenue si au moins une de ses fiches est
   ciblée ; une adresse désinscrite est exclue quelle que soit la fiche qui la porte ; la fiche porteuse
   (ordre ADR 054) et `{nom}` / `{parcelle}` ne viennent **que des fiches ciblées**. Implémenté dans la
   règle pure `computeCampaignTarget(rows, isTargeted)` : une seule fonction, les trois types.
3. **Fiche en impayé** = au moins une facture rendue par le fournisseur actif
   (`resolveMemberBillingProvider` → `listInvoicesOf`) dont `isUnpaidInvoice` est vrai. Aucun statut
   n'est lu ailleurs ; une erreur du fournisseur **remonte** (jamais de repli sur « tous » ni sur
   « vide »).
4. **Groupes** : table `recipient_group` (`organization_id`, `name`, unique `(organization_id,
lower(name))`, horodatages) et table d'appartenance `recipient_group_member` (`organization_id`,
   `group_id` en `CASCADE`, `member_profile_id` en `CASCADE`, clé primaire `(group_id,
member_profile_id)`). Les deux sous RLS **forcée**, policy `tenant_isolation`. Le service vérifie
   que chaque fiche ajoutée se lit sous le tenant (une fiche d'une autre association est invisible, donc
   refusée).
5. **Archive** : `campaign.target_group_id` (`SET NULL`) et `campaign.target_group_name` (copié à
   l'envoi), sur le modèle des noms d'auteur copiés. Supprimer un groupe ne touche ni les fiches ni les
   campagnes ; l'archive affiche le nom copié, suivi de « (supprimé) » quand l'id est nul.
6. **Droit** : nouvelle entrée du registre `campaign.group.manage` (rôles par défaut `owner`, `board`),
   distincte de `campaign.manage`, que s37 pourra régler seule. Choisir un groupe comme cible reste sous
   `campaign.manage`.

## Considered options

- **Filtrer les lignes avant le regroupement** — rejeté : une adresse désinscrite portée par une fiche
  hors cible cesserait d'exclure l'envoi, contraire à l'ADR 057.
- **`{parcelle}` de toutes les fiches de l'adresse** — rejeté par arbitrage : une relance d'impayé
  citerait un terrain réglé.
- **Méthode « fiches en impayé » ajoutée au contrat `MemberBillingProvider`** — rejeté : le contrat de
  l'ADR 059 est une lecture de factures ; le prédicat reste unique et pur, s20 n'a rien à réimplémenter.
- **Groupe en tableau d'ids (`uuid[]` / jsonb) sur une seule table** — rejeté : ni clé étrangère vers la
  fiche (une fiche supprimée resterait référencée), ni contrôle d'unicité, ni jointure simple pour le
  filtre « Groupe » de la liste.
- **Segmentation dynamique par critère** — rejeté par la story : ni le CDC ni le PRD ne la demandent.
- **Réutiliser `campaign.manage` pour les groupes** — rejeté : la discipline du registre (s14, s19, s24)
  est une entrée par action réglable par s37.

## Consequences

- s27b ajoute la nature de l'envoi au même calcul ; s29 l'appelle avec `{kind: 'unpaid_members'}` à
  chaque échéance ; s28 lit les fiches sans adresse active d'une cible.
- Avec s20, ouvrir le composeur sur la cible « impayés » appellera Pennylane : à surveiller (coût,
  disponibilité) ; l'erreur est ancrée dans la page, rien ne part.
- Deux tables de plus au classement RLS de `docs/architecture.md` ; s38 devra les déclarer.
