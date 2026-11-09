# ADR 049 — Un signalement de membre est lié à la fiche, avec le déclarant copié

- Status: accepted
- Date: 2026-11-09
- Scope: story s22-signalement-membre

## Context

`incident_report.member_id` existe depuis s10, nullable et **sans clé étrangère** ; le modèle promet que
« s22 ajoutera la contrainte ». Ce commentaire date d'avant s12 : il existe désormais deux « membres »,
`member` (pivot Better Auth, exempté de RLS) et `member_profile` (fiche métier, RLS forcée, ADR 029/037).
Aucune ligne existante n'a de `member_id` (le code ne l'a jamais écrit), et aucune suppression de fiche
n'existe encore.

Le bureau lit le déclarant dans `reporter_name`, `reporter_email`, `reporter_phone`, tant dans la file et
le détail que dans l'email de notification.

## Decision

- `member_id` référence **`member_profile.id`** (clé d'identité du produit, AGENTS.md), `ON DELETE RESTRICT` :
  l'historique d'un signalement ne disparaît pas et ne redevient pas anonyme en silence. Un index
  `(organization_id, member_id, created_at desc)` sert la lecture « mes signalements ». Aucune table nouvelle.
- Le lien vient **de la session et du domaine appelé**, jamais d'une saisie ni d'un rapprochement de
  coordonnées : le signalement public n'écrit toujours pas `member_id` (critère 8 de s10 inchangé).
- Le déclarant est **copié** dans `reporter_*` à la déclaration (instantané, comme `author_name`), au lieu
  d'être lu par jointure : la file, le détail et l'email du bureau ne changent pas de source.
- Le signalement est rattaché au **propriétaire déclarant**, pas à une parcelle : la « localisation » libre
  suffit, aucune colonne de parcelle.

## Considered options

- **FK vers `member`** ou `user.id` : rejeté, mauvaise clé (plan identité, pas fiche métier).
- **`ON DELETE SET NULL`** : rejeté, le signalement redevinrait anonyme sans trace ; à rouvrir par un ADR
  qui supplante celui-ci le jour où une suppression de fiche existe.
- **Lire la fiche par jointure** : rejeté pour la V1, change le DAO de la file et l'email ; l'instantané
  garde au bureau ce que le membre a déclaré, même si s16 lui laisse changer son téléphone ensuite.
- **Lien vers une parcelle** : rejeté, une vente ne transfère pas l'historique (AGENTS.md).

## Consequences

- Une migration (`pnpm db:generate`), pas de table.
- Si la fiche change de coordonnées, le bureau voit celles du jour de la déclaration.
- Supprimer une fiche portant des signalements sera refusé tant que cette décision tient.
