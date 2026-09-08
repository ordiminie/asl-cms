# ADR 006 — Planificateur de tâches en base Postgres, sans Inngest

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

Trois besoins du produit demandent une exécution différée ou périodique :

- **s26** — une campagne de plus de 300 destinataires est scindée sur deux jours (J puis J+1) ;
- **s29** — jusqu'à trois relances d'impayés, espacées de 3, 2 et 1 semaines, activables par tenant ;
- **ADR 005** — un budget quotidien d'envoi par association, avec report au lendemain plutôt que perte.

Le boilerplate utilise **Inngest** (`src/lib/inngest/`, dépendance `inngest@^4.18.0`) avec quatre fonctions dont deux crons (`0 4 * * *`, `0 3 * * *`). Aucune clé Inngest ne figure dans `env.example` : la brique est câblée mais pas configurée pour un usage réel.

L'hébergement est un VPS LWS unique, 2 vCore / 4 Go, infogéré, sous un contrat de maintenance à [montant masqué]/an.

## Decision

Retirer Inngest et le remplacer par un **planificateur en base**, dont Postgres est à la fois le magasin et le verrou.

- Une table `scheduled_job` porte `organization_id`, `kind`, `run_after`, `payload` (jsonb), `attempts`, `locked_at`, `completed_at`, et une **clé d'idempotence unique** par `(organization_id, kind, idempotency_key)`.
- Un cron système du VPS appelle périodiquement une route interne authentifiée par secret partagé. Elle prend un lot de tâches dues, les verrouille en `SELECT ... FOR UPDATE SKIP LOCKED`, les exécute, et les marque.
- L'idempotence est portée par la contrainte d'unicité, pas par la prudence de l'appelant. C'est exactement ce que s29 exige : une relance ne part pas deux fois parce que le cron s'est déclenché deux fois.
- La table est scopée tenant et couverte par une policy RLS comme toute table métier (ADR 002).

## Considered options

- **Conserver Inngest Cloud** — rejeté : dépendance SaaS externe pour trois besoins simples, données d'envoi transitant hors du VPS français (sous-traitant supplémentaire à documenter au RGPD), et un compte de plus à maintenir sur un contrat modeste. Le rejeu et l'observabilité offerts sont réels, mais ne compensent pas pour trois planifications dont l'état doit de toute façon être lisible en base par le bureau (s29 exige une page de gestion listant les relances déjà envoyées et leurs dates).
- **Inngest auto-hébergé sur le VPS** — rejeté : un troisième service à déployer, superviser et mettre à jour, à côté de Next.js et Postgres, sur 2 vCore et 4 Go. Le coût d'exploitation dépasse le problème résolu.
- **`pg_cron`** — rejeté : planifie du SQL, alors que nos tâches appellent Brevo et Pennylane. Il faudrait de toute façon un déclencheur applicatif, et l'hébergement infogéré ne garantit pas la disponibilité de l'extension.
- **`setInterval` dans le processus Next.js** — rejeté : ne survit pas à un redémarrage, se duplique si le processus est répliqué, et n'offre aucune trace. C'est le piège classique, séduisant parce qu'il ne demande rien à installer.

## Consequences

**Ce qui devient plus simple**

- L'état des envois est lisible en SQL. La page de gestion des relances exigée par s29 se lit dans la même table que celle qui les planifie — pas de réconciliation entre un tableau de bord externe et notre base.
- Idempotence et rejeu sont des propriétés de la base, garanties par une contrainte, pas par du code défensif.
- Aucune dépendance externe, aucun coût récurrent, aucune donnée d'envoi hors du VPS.

**Ce qui devient plus difficile**

- Le rejeu avec backoff, l'observabilité et les alertes sont à écrire — c'est précisément ce qu'Inngest offrait. La colonne `attempts` et Sentry (déjà présent) en couvrent l'essentiel, mais c'est du code à nous.
- Le déclenchement dépend d'un cron système sur le VPS, donc d'un élément hors du dépôt. Il doit être documenté au déploiement, sinon rien ne s'exécute et le symptôme est silencieux.

**À surveiller**

- **Un `SET LOCAL app.organization_id` est nécessaire dans le worker** (ADR 002) : il s'exécute hors requête HTTP, donc hors du `withTenant()` posé par la résolution de domaine. Une tâche exécutée sans scope de tenant ne verrait aucune ligne — l'erreur est sûre mais déroutante.
- Prévoir une supervision minimale du fait que le cron tourne. Une planification qui ne s'exécute plus ne produit aucune erreur : elle produit un silence, et une relance qui ne part jamais.
- Les deux crons du boilerplate (`reconcileNegativeCreditBalances`, `approveMaturedAffiliateCommissions`) disparaissent avec les sous-systèmes crédits et affiliation (ADR 009) : rien à porter.
