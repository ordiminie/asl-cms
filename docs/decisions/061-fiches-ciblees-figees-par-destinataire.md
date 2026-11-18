# ADR 061 — Fiches ciblées figées par destinataire de campagne

- Status: accepted
- Date: 2026-11-18
- Scope: story s27-groupes-destinataires (correctif de revue, C1)

## Context

L'ADR 060 §2 veut que `{nom}`, `{parcelle}` et la fiche porteuse ne viennent **que des fiches ciblées**.
La création et l'aperçu le respectent, mais la livraison (`getPendingPartRecipientsDao`) recalcule ces
valeurs à partir de **toutes** les fiches actives qui partagent l'adresse : une relance d'impayé peut
citer un terrain réglé. La livraison se fait par parts, parfois sur plusieurs jours (s26) ; elle ne
connaît aujourd'hui que l'adresse figée dans `campaign_recipient` (ADR 051, 052).

## Decision

1. À la création de la campagne, on fige, pour chaque `campaign_recipient`, **l'ensemble des fiches
   ciblées que représente son adresse**, dans une table d'appartenance `campaign_recipient_profile`
   (`organization_id`, `campaign_recipient_id` en `CASCADE`, `member_profile_id` en `CASCADE`, clé
   primaire `(campaign_recipient_id, member_profile_id)`), sous RLS **forcée**, policy `tenant_isolation`.
   Écrite dans la même transaction que `campaign_recipient`.
2. À la livraison, `profileIds`, `parcelNumbers` et `addressProfileCount` sont restreints aux fiches
   **à la fois** figées pour ce destinataire **et** encore actives sur l'adresse. La **désinscription**
   reste évaluée sur **toutes** les fiches de l'adresse (ADR 057, ADR 060 §2) : inchangé.
3. Vaut pour les trois cibles : pour « tous les membres », l'ensemble figé est simplement toutes les
   fiches de l'adresse, le résultat est identique à l'existant.
4. Campagne antérieure à cette migration (aucune ligne figée pour le destinataire) : comportement
   d'avant (toutes les fiches actives de l'adresse) — ces campagnes sont toutes « tous les membres ».

## Considered options

- **Colonne `uuid[]` sur `campaign_recipient`** — rejeté pour la même raison que dans l'ADR 060 : pas de
  clé étrangère vers la fiche, pas de jointure simple ; et le dépôt n'en compte aucune.
- **Réévaluer la cible à la livraison** (depuis `target_kind` / `target_group_id`) — rejeté : le groupe a
  pu être supprimé (`SET NULL`) ou modifié, et le statut d'impayé change entre deux parts. Ce qui part
  doit être ce que le bureau a validé à la création.
- **Figer directement les valeurs rendues (`{nom}`, `{parcelle}`)** — rejeté : la livraison relit
  aujourd'hui les parcelles courantes (une vente entre deux parts est prise en compte) ; figer les fiches
  garde ce comportement et ne change que le périmètre.

## Consequences

- Une table de plus au classement RLS de `docs/architecture.md` (33 tables sous RLS) ; s38 devra la
  déclarer.
- s29 (relances automatiques) hérite du bon périmètre sans rien réimplémenter.
