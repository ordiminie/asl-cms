# PRD — ASL-CMS

## Target SaaS
Vilogi (vilogi.com) — French copropriété/syndic & ASL management platform (site membres, GED, votes AG, gestion des charges), used here as a loose category reference only. No off-the-shelf solution was actually evaluated or reverse-engineered: this is a greenfield build, commissioned and scoped directly by a signed client (ASL La Fourche, devis n°042) and validated against 5 structurally identical prospects.

## Kill mode
Competing product (sell it). Zourite Studio (solo indie dev, entreprise individuelle) builds ASL-CMS as a paid multi-tenant product sold to multiple ASL associations — not an internal tool for one org. Scope must support onboarding new paying tenants on a shared trunk, not just satisfy one client.

## Why kill it
No existing solution was researched before deciding to build. The driver is direct: a client (ASL La Fourche) commissioned a tailored site and signed a devis for it, and the same profile repeats across 5 other prospects (vacation-land ASLs managing water + roads + dues, none with an accountant beyond La Fourche, none with their own vote tooling). Building a dedicated, reusable product — rather than adopting a generic professional-syndic platform — lets one solo developer serve this niche profitably at a price a volunteer-run bureau can approve ([montant masqué] build + [montant masqué]/an maintenance), with domain modules (individual metered water, non-billable collective roads) that generic copro tools don't offer.

## Problem
Volunteer-run ASL bureaus for vacation-land associations (~400 member accounts each) currently have no unified system: member communication, water metering/billing status, road/voirie tracking, and AG votes are handled through disconnected manual tools (paper, email, spreadsheets) or a single third-party vote platform (ASL Community). Generic copropriété-management SaaS doesn't model their two defining domains — individually metered/resold water and non-billable collective road maintenance — so bureaus either overpay for irrelevant features or keep doing it by hand.

## Target users
- **Bureau (admin)** — association board members, non-technical volunteers. Manage site content, validate member declarations (leaks, contact updates), see the association's own platform billing/subscription.
- **Membre (member)** — property/parcel owner, often with a cabanon + mobile home, sometimes living on-site in practice though not statutorily. Views their own water invoice status, declares leaks/incidents, updates contact info, participates in AG votes via redirect, browses shared documents by profile.
- **Public visitor** — unauthenticated. Browses the public site, contact form, published water-analysis results, leak-reporting form.

## Perimeter — the 20% that matters
### Replicated (core loop)
| Feature | Complexity (1-5) | Why this score |
|---|---|---|
| Site public / CMS (editable pages, contact, alert banner, block assembler for other modules) | 2 | Form + persistence + list — standard CMS back-office, no complex state |
| Espace membres & Auth (accounts, magic-link login, Bureau/Membre roles, contact updates, questions to bureau) | 3 | Several states (invite, active, roles) plus role-gated views, but no external integration |
| Espace documentaire (GED) — secure storage, access by profile | 3 | Business logic around per-role document visibility, not just storage |
| Communauté — small ads, member service directory | 2 | Form + persistence + list, no workflow beyond publish/unpublish |
| SEO — per-tenant meta/sitemap config | 1 | Trivial config, no logic of its own |
| Facturation membres — read-only invoice list/status via delegated redirect, per-tenant interchangeable provider | 4 | Third-party integration + Strategy interface (only module with a real per-tenant vendor difference) |
| Vote en ligne (AG) — redirect to ASL Community, publish results/resolutions | 3 | External system integration, but read/redirect only, no vote logic owned here |
| Communication — Brevo campaigns, notifications, unpaid-invoice relances, rate-limited batch sending (300/day) | 3 | Integration + batching/throttling logic |
| Module Eau — individual metering, consumption import (CSV), restriction/cutoff status, leak declaration with status tracking, published analysis results | 4 | Multiple owned states (leak lifecycle), data import, ties into billing display — the core domain differentiator |
| Module Voirie — road/way identification, work/renovation tracking, no billing | 2 | Form + persistence + status list, no individual/billing dimension |

Scale: 1 trivial CRUD · 2 form + persistence + list · 3 business logic / several states · 4 integrations, payments, roles · 5 real-time, migrations, external systems. A 5 is a graveyard candidate — keep it only if it IS the core value.

Platform billing (Zourite Studio ↔ Association subscription) is out of this table: it's covered natively by ShipSaaS's built-in Stripe subscription system (configuration only, no development), distinct from and never confused with member-facing "Facturation membres" above.

### Explicitly NOT replicated (graveyard)
- Per-tenant database (shared DB + Postgres RLS instead) — provisioning a new client must stay cheap.
- Generic "shared resource" abstraction merging Eau and Voirie — the two diverge too much (individual/billable vs collective/non-billable) to justify a common abstraction now; revisit only if a genuine 3rd similar domain appears.
- Électricité — not carried by the associations (individual owner ↔ supplier contracts); no gas either.
- Anything belonging to a professional-syndic platform's broader scope (multi-building portfolios, complex charge-splitting, professional accounting integrations) — out of reach and out of need for a single-site volunteer bureau.

Nothing from the signed La Fourche devis itself is graveyarded — its full scope (Socle indispensable + Haute + Recommandée + Bonus, [montant masqué]) is in this perimeter.

### The angle (done differently / better)
Purpose-built domain modules (individually metered/resold water, non-billable collective road tracking) that no generic copropriété/ASL SaaS offers off the shelf — the two things that actually define a vacation-land ASL's daily admin burden. Delivered at a fraction of a professional-syndic platform's cost via a config-per-tenant shared trunk (one codebase, JSON config per association, Strategy interfaces reserved for the one module that genuinely needs them), with payment fully delegated (no banking data transits the system — out of DSP2/PCI scope) and a single accountable solo-developer relationship instead of anonymous SaaS support.

## Constraints
- **Technical**: ShipSaaS boilerplate — Next.js 15, Drizzle/PostgreSQL, Better Auth, Stripe, layered Presentation/Service/Persistence architecture. Multi-tenant: 1 Organization = 1 Association, shared DB + Postgres RLS on sensitive tables, subdomain by default with custom domain supported later without an architecture change.
- **Team**: solo developer (entreprise individuelle) — the shared trunk must let one person cheaply serve multiple structurally-identical clients; flexibility (Strategy pattern, multi-instance modules) is added only where a real divergence is already confirmed, never speculatively.
- **External dependencies**: ASL Community access must be confirmed in writing + statutory authorization for electronic voting validated (per La Fourche devis reserves) before the vote module ships for a tenant; Pennylane-style API access must be provided by each association for the billing integration; Brevo email sending is capped at 300/day, requiring batched dispatch.
- **Budget precedent**: La Fourche's signed devis ([montant masqué] build, [montant masqué]/an maintenance) sets the price point the perimeter and complexity scores must stay compatible with for the next 5 prospects.
- **Scale**: ~6 associations × ~400 accounts — comfortably within the stack's capacity, no dimensioning work needed.

## Success criteria
- La Fourche's site ships live covering its full signed devis scope (Socle indispensable + Haute + Recommandée + Bonus).
- A second ASL tenant can be onboarded reusing the shared trunk (CMS, auth, GED, vote, communication, Eau, Voirie) through configuration only — no re-development of core modules — validating the mutualization thesis before the next prospect is pitched.
- All 10 replicated features in the perimeter table are implemented and pass review; nothing from the graveyard leaks into scope.
- The angle holds in practice: Eau and Voirie modules handle the vacation-land specifics no generic copro tool covers, and per-tenant onboarding cost stays low enough to keep the [montant masqué]/client price point viable across the 5 prospects.
