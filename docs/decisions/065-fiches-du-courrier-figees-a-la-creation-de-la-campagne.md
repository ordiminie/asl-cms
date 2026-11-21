# ADR 065 — Fiches du courrier figées à la création de la campagne

- Status: accepted
- Date: 2026-11-20
- Scope: story s28-publipostage-pdf

## Context

s28 génère, « depuis une campagne », un courrier pour chaque fiche **ciblée sans adresse email
active**. Aujourd'hui ces fiches ne sont persistées nulle part : `campaign.without_email_count` n'en
garde que le nombre (s25), et `campaign_recipient.email` est `NOT NULL` — une ligne d'envoi est une
adresse. Le critère 6 de s28 exige que email ∪ courrier couvre toute la cible, sans intersection ni
oubli : il faut savoir, pour une campagne passée, **quelles** fiches étaient visées sans email.

## Decision

1. À la création de la campagne, dans la **même transaction** que `campaign_recipient` et
   `campaign_recipient_profile`, on fige les fiches ciblées sans adresse active dans une table
   d'appartenance `campaign_letter_profile` : `organization_id` (`CASCADE`), `campaign_id`
   (`CASCADE`), `member_profile_id` (`CASCADE`), clé primaire `(campaign_id, member_profile_id)`, RLS
   **forcée**, policy `tenant_isolation` (patron `0068`).
2. Le courrier se génère **uniquement** depuis cet ensemble ; adresses et parcelles sont relues à la
   génération (une vente ou un domicile corrigé entre-temps sont pris en compte, comme la livraison
   email relit les parcelles, ADR 061).
3. « Sans email » = aucune adresse **active** (champ explicite, `member_profile_email.status`), jamais
   une chaîne vide. Une fiche dont toutes les adresses actives sont désinscrites d'un envoi facultatif
   **n'est pas** au courrier : son refus porte sur l'envoi, pas sur le canal (ADR 057, ADR 064).
4. Une campagne **antérieure** à cette migration (`without_email_count > 0` et aucune ligne figée)
   n'a pas de courrier : l'écran le dit. Aucune reconstitution de la cible après coup.
5. Une cible sans aucune adresse email reste refusée (`no_recipient`) : la campagne « courrier seul »
   est hors de s28 (arbitrage du 20/11/2026).

## Considered options

- **Recalculer la cible à la génération** (depuis `target_kind` / `target_group_id`) — rejeté pour les
  mêmes raisons que l'ADR 061 : groupe supprimé (`SET NULL`) ou modifié, statut d'impayé changeant ; et
  un membre ayant ajouté un email depuis ne serait plus dans aucun canal, ce qui casse le critère 6.
- **Lignes `campaign_recipient` à `email` nul** — rejeté : la ligne d'envoi porte une part, un statut
  d'envoi et un jeton de désinscription qui n'ont pas de sens pour un courrier, et l'index unique sur
  `lower(email)` comme toute la livraison (s26) supposent une adresse.
- **Colonne `uuid[]` sur `campaign`** — rejeté comme dans l'ADR 060 et 061 : ni clé étrangère ni
  jointure simple, aucune dans le dépôt.
- **Reconstituer les campagnes anciennes** — rejeté : on afficherait comme validée par le bureau une
  cible qu'il n'a jamais vue. Le produit n'est pas encore en production.

## Consequences

- Une table de plus au classement RLS de `docs/architecture.md` (34 tables sous RLS) ; s38 devra la
  déclarer.
- Le critère 6 devient vérifiable en base : `campaign_recipient_profile` ∪ `campaign_letter_profile`
  = fiches ciblées, intersection vide.
- La campagne « courrier seul » (story future) héritera de la table sans la changer.
