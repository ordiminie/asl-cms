# ADR 009 — Sous-systèmes du boilerplate écartés de la V1

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

Le boilerplate ship-saas est un socle SaaS générique. Il embarque des sous-systèmes complets qui n'ont aucun usage dans le périmètre ASL-CMS : chat IA, crédits, affiliation, projets/tâches, newsletter Mailchimp.

La question posée n'est pas « ce code sert-il en V1 ? » — il ne sert pas — mais « que se passe-t-il si la V2 en a besoin ? ». Le chat IA est un candidat crédible : le cimetière du PRD y range explicitement l'« assistant IA conversationnel interrogeant les données de l'association », et le « tableau de tâches (Kanban) du bureau ». Ce sont des **exclusions de périmètre V1**, pas des non-sens métier.

L'état du dépôt, vérifié, désamorce l'essentiel du risque :

- le remote `upstream` pointe vers `MikeCodeur/shipsaas-ai-boilerplate`, dernier commit le 28/08/2026 ;
- `git rev-list --left-right --count main...upstream/main` donne `42 0` : notre `main` est en avance de 42 commits (les documents du pipeline killer-saas) et **en retard de zéro**. Aucune divergence sur le code du boilerplate ;
- les 57 fichiers concernés sont présents sur `upstream/main` ;
- nos 970 commits contiennent par ailleurs tout l'historique du boilerplate.

À l'inverse, conserver ce code a un coût **récurrent**, et il vient directement de l'ADR 002 : la convention multi-tenant impose que toute table métier porte `organization_id` et une policy RLS. Chaque table dormante doit donc être soit équipée pour rien, soit exemptée avec une justification — à chaque revue, sur 42 stories.

Enfin, sous killer-saas, du code dormant n'est pas un raccourci vers la V2. Une fonctionnalité V2 traverserait de toute façon PRD → stories → Research → Design → Plan → Execute → Review, et devrait être scopée par tenant, couverte par RLS, francisée et testée. Le code dormant n'est pas une étape économisée : c'est une **entrée de `/ks-research`**, exactement comme `upstream/main` en est une.

## Decision

Les sous-systèmes hors périmètre sont **retirés de l'arbre de travail**, et leur récupération est documentée ici plutôt que confiée à la mémoire.

Le retrait est exécuté **dans s01**, et non dans une story dédiée : s01 est la story qui doit donner une policy RLS à chaque table métier, et le moyen le moins cher de donner une policy à `credit_ledger` est de ne pas avoir `credit_ledger`.

| Sous-système         | Candidat V2 | Motif                                                                                      | Récupération                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat IA              | **oui**     | Cimetière PRD : « assistant IA conversationnel interrogeant les données de l'association » | `git checkout upstream/main -- src/services/chat-service.ts src/services/facades/chat-service-facade.ts src/services/types/domain/chat-types.ts src/services/validation/chat-validation.ts src/app/api/chat src/app/\[locale\]/\(app\)/chat src/components/features/chat`                                                                                                  |
| Projets / tâches     | **oui**     | Cimetière PRD : « tableau de tâches (Kanban) du bureau »                                   | `git checkout upstream/main -- src/db/models/project-model.ts src/db/repositories/project-repository.ts src/services/project-service.ts src/services/facades/project-service-facade.ts src/services/authorization/project-authorization.ts src/services/validation/project-validation.ts src/app/dal/project-dal.ts src/app/api/projects src/components/features/projects` |
| Crédits              | non         | Aucun usage métier pour une ASL. La facturation membres est chez Pennylane (ADR 011)       | `git checkout upstream/main -- src/db/models/credit-ledger-model.ts src/db/repositories/credit-ledger-repository.ts src/services/credit-service.ts src/services/facades/credit-service-facade.ts src/app/dal/credit-dal.ts src/components/features/credits src/lib/helper/credit-period-helper.ts src/lib/stripe/credit-pack-checkout.ts`                                  |
| Affiliation          | non         | Aucun usage métier : une ASL ne parraine pas de clients                                    | `git checkout upstream/main -- src/db/models/affiliate-model.ts src/db/repositories/affiliate-repository.ts src/services/affiliate-service.ts src/services/facades/affiliate-service-facade.ts src/services/authorization/affiliate-authorization.ts src/app/dal/affiliate-dal.ts src/components/features/affiliate e2e/affiliate.spec.ts`                                 |
| Newsletter Mailchimp | non         | **Contredit activement l'ADR 005** : l'envoi de masse passe par Brevo                      | `git checkout upstream/main -- src/services/newsletter-service.ts src/services/facades/newsletter-service-facade.ts src/services/types/domain/newsletter-email-types.ts src/components/features/blog/newsletter-form.tsx`                                                                                                                                                  |

Précéder toute récupération de `git fetch upstream`. Les chemins ci-dessus sont ceux du retrait ; les fichiers satellites (interceptors, tests, pages d'admin, entrées de menu, traductions) se retrouvent par `git ls-tree -r --name-only upstream/main | grep -i <sous-système>`.

### Complément écrit par s01 — les chemins que la table ci-dessus ne nommait pas

⚠️ **La table ci-dessus ne nommait que 46 des 109 chemins réellement retirés.** Le filet qu'elle
proposait (`git ls-tree … | grep -i <sous-système>`) ne rattrape **ni `tasks` ni `referral`**, dont le
nom ne contient aucun des cinq motifs. Sans ce complément, une récupération V2 ramènerait un
sous-système incomplet et silencieusement cassé. Mesuré et retiré le 2026-09-10 :

**Chat IA** — `src/components/ui/code-block.tsx` (doublon de `src/components/features/docs/code-block.tsx`,
qui reste), dépendance `react-markdown` devenue orpheline.

**Projets / tâches** — au-delà des chemins nommés :
`src/app/[locale]/(app)/team/[slug]/projects/` (7 fichiers),
`src/app/[locale]/(app)/team/[slug]/react-query/` (page de démonstration),
`src/components/features/projects/react-query/` (4),
`src/components/features/projects/{projects-pagination,projects-skeleton,projects-toolbar}.tsx`,
`src/lib/api/projects-api.ts`, `src/components/hooks/client/project-client.ts`,
`src/components/features/layouts/sidebar/nav-projects.tsx`,
`src/services/types/domain/project-types.ts`,
`src/services/facades/interceptors/project-service-logger-interceptor.ts`,
et **les tâches, jamais nommées** : `src/app/dal/task-dal.ts` +
`src/components/features/tasks/` (5 fichiers : `task-board`, `task-card`, `task-column`,
`create-task-modal`, `task-form-validation`). Dépendances `@dnd-kit/*` devenues orphelines mais
**conservées** : l'ADR 007 les réutilise pour l'ordre des blocs de contenu.

**Crédits** — `src/app/[locale]/(app)/account/billing/credit/` (3),
`src/app/[locale]/(app)/account/billing/usage/` (page de graphe de consommation, nom sans motif),
`src/app/[locale]/(app)/team/[slug]/credits-simulator/` (3),
`src/app/[locale]/admin/credits/` (2), `src/components/features/admin/credits/` (2),
`src/services/authorization/credit-authorization.ts`,
`src/services/types/domain/credit-types.ts`, `src/services/validation/credit-validation.ts`,
`src/services/facades/interceptors/credit-service-logger-interceptor.ts`,
`src/lib/__tests__/credit-period-helper.test.ts`.

**Affiliation** — `src/app/[locale]/(app)/account/affiliate/` (4),
`src/app/[locale]/admin/affiliates/` (3), `src/components/features/admin/affiliates/` (1),
`src/services/types/domain/affiliate-types.ts`, `src/services/validation/affiliate-validation.ts`,
`src/services/facades/interceptors/affiliate-service-logger-interceptor.ts`,
`src/services/__tests__/stripe-affiliate-webhook.test.ts`,
et **le parrainage, jamais nommé** : `src/lib/helper/referral-helper.ts`,
`referral-helper.server.ts`, `referral-helper.test.ts`. Le parrainage part **entièrement** — garder
un cookie de parrainage posé pour une table `referral` absente serait un bug, pas un statu quo. Il
était câblé dans du code conservé : `src/proxy.ts`, `src/env-schemas.ts`
(`NEXT_PUBLIC_AFFILIATE_TRACKING`, retirée), `src/lib/better-auth/auth.ts`
(`attributeReferralOnSignUp`), `src/app/[locale]/(auth)/action.ts`, `auth-form-validation.ts` et le
champ « code de parrainage » du formulaire d'inscription.

**Newsletter Mailchimp** — `src/components/features/blog/newsletter-inline.tsx`,
`src/app/[locale]/(public)/blog/actions.ts`,
`src/services/facades/interceptors/newsletter-service-logger-interceptor.ts`.
Dépendances `@mailchimp/mailchimp_marketing` et `@types/mailchimp__mailchimp_marketing` devenues
orphelines, **non retirées de `package.json` par s01** : un changement de dépendance sort du
périmètre de ses dix critères.

**Ce que le retrait a coûté en code conservé**, pour mémoire : `casl-abilities.ts` (4 sujets, 17
règles), `better-auth/auth.ts` (hooks crédits + parrainage + newsletter), `stripe-events.ts`
(allocation de crédits, primes d'affiliation, remboursements et litiges), `seed.ts` (blocs `project`,
`task`, barème d'affiliation, packs de crédits, limites `projects`/`credits`),
`subscription-repository.ts` (`AdminUsageStats` et `PlanLimits` amputés de `projects` et `credits`,
période désormais lue sur l'abonnement), `subscription-types.ts` (`LimitType` réduit à
`storage | users`), `user-service.ts` (allocation initiale de crédits), `inngest/functions.ts`
(2 crons), `menu-helper.ts`, les 4 fichiers de `sidebar/`, `subscription-authorization.ts`,
et les écrans d'usage (`team/[slug]`, `account/organizations`, `admin/organizations/[id]/edit`,
`user-detail-form`) qui perdent leurs colonnes « Projets » et « Crédits ».

**Conservé** : Stripe (facturation plateforme Zourite Studio ↔ association), `post` (base des actualités s05), `file`, `notification`, `organization`, `user`, `app_settings`, ainsi que toute l'infrastructure transverse — Better Auth, CASL, Sentry, logger, i18n, Drizzle.

## Considered options

- **Tout laisser dormant** — rejeté : zéro travail immédiat, mais environ deux fois plus de tables que le périmètre réel à couvrir en RLS ou à exempter, et du code mort traversé à chaque revue de story pendant 42 stories. Le coût est différé, pas évité, et il est payé par l'agent qui lira ce dépôt dans six mois.
- **Retirer, sauf les deux candidats V2 (chat IA, projets/tâches)** — rejeté : c'est l'option intuitive, et elle ne tient pas. Ces deux-là sont précisément ceux dont les tables (`project`, `task`) portent déjà `organization_id` et réclameraient donc le plus de travail RLS inutile. Et leur conservation n'avance en rien une V2 qui devra de toute façon repasser par le pipeline.
- **Retirer après le bloc A, une fois les conventions éprouvées** — rejeté : inverse l'ordre logique. Le bloc A est précisément le moment où la convention multi-tenant se pose ; la poser sur des tables destinées à disparaître, c'est faire le travail deux fois.
- **Extraire les sous-systèmes dans une branche d'archive locale** — rejeté comme redondant : `upstream/main` est déjà cette archive, maintenue par un tiers, et donc **plus à jour** que ne le serait notre copie gelée.

## Consequences

**Ce qui devient plus simple**

- La surface à couvrir en RLS, à relire et à sécuriser correspond au périmètre réel.
- Le diff d'une story se lit sans traverser du code sans rapport.
- Les dépendances Supabase, Resend, Inngest et Mailchimp partent avec, cohérent avec les ADR 004, 005 et 006.

**Ce qui devient plus difficile**

- **`projects` est l'implémentation de référence de l'architecture en couches**, et deux fichiers de règles la citent nommément : `rule-react-query.md` et `rule-seed-usersroles-and-organization.md`. Les retirer laisse ces règles pointer vers des fichiers absents — un piège réel pour un agent qui suivrait l'index des règles. **Ces deux règles doivent être mises à jour dans le même commit que le retrait**, en pointant vers un domaine ASL-CMS réel. C'est une tâche explicite de s01, pas un détail de nettoyage.
- Une récupération V2 demandera de réaccorder le code repris aux conventions posées depuis : scoping tenant, RLS, locale unique, planificateur maison. C'est du travail — mais c'est le même travail qu'il aurait fallu faire sur du code dormant.

**À surveiller**

- Exécuter `pnpm knip` après le retrait : la configuration `knip.json` est déjà présente et listera les orphelins restants (types, helpers, traductions, entrées de menu) que le retrait manuel aura laissés.
- Vérifier que les migrations de suppression de tables sont générées par `drizzle-kit generate --custom` et non écrites à la main, conformément à AGENTS.md.
- Ne pas retirer `post` par excès de zèle : c'est la base des actualités (s05).
