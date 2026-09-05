# killer-saas — Repo rules

## Absolute rule
No direct coding. Every feature goes through the killer-saas pipeline, in order:

PRD → User Stories → Architecture (+ Design System) → then, per story: Research → Design → Plan → Execute → Review → Ship

No code is written before the story has a validated plan (`/ks-plan`). No feature ships before a passed review (`/ks-review`).

### Quick Fix mode — exception to the pipeline

`Quick Fix` is the explicit exception for a small, local, well-understood, and
easily reversible adjustment. It applies only when the user explicitly requests
a Quick Fix. The primary agent implements it directly, without the full
killer-saas pipeline and without mandatory TDD. It must not delegate
implementation to a subagent; a subagent may be used only for read-only
investigation or optional review.

Typical Quick Fixes include:

- changing a color, spacing, radius, font size, or button style;
- correcting short UI copy or a translation;
- making a small layout alignment or responsive adjustment;
- restoring or adjusting an already-existing presentation affordance;
- another similarly narrow change with no architectural or business impact.

Quick Fix mode does **not** apply to a new feature, shared-component redesign,
data model or migration, API or contract change, authorization, security,
business rules, persistence, cross-cutting refactor, dependency change, or any
change whose impact is uncertain. If the requested Quick Fix is too large or
investigation reveals one of these, the primary agent must stop Quick Fix mode,
recommend using the normal pipeline, and must not continue coding until the work
has passed the appropriate pipeline stages.

The primary agent must announce Quick Fix mode and its exact scope before
editing, keep the diff minimal, preserve existing abstractions, and perform a
proportionate verification (at minimum a focused lint, typecheck, existing test,
or visual browser check when applicable). TDD and subagent review are optional,
not forbidden. Quick Fix work must still happen on the currently authorized
branch/worktree. Before editing, the primary agent must verify that no other
agent is editing the same files or targets. If work overlaps, coordinate
ownership or stop; never make concurrent edits to the same targets.

## Pipeline (commands)
- `/ks-prd`        frames the kill: target SaaS, kill mode, perimeter (WHAT + WHY)
- `/ks-stories`    breaks it down into shippable user stories
- `/ks-stories-review`  reviews the breakdown against the PRD perimeter (stories-reviewer subagent)
- `/ks-architect`  sets the technical HOW + the conventions
- `/ks-design-system`  captures the global design system (docs/design-system.md)
- `/ks-research`   explores the story's real context (current code, APIs, traps)
- `/ks-design`     derives a story's screen from the design system (UI stories)
- `/ks-plan`       breaks a story into sequenced tasks
- `/ks-execute`    implements the story in TDD (implementer subagent)
- `/ks-review`     anti-hallucination review + gate (reviewer subagent)
- `/ks-ship`       opens the PR; merge/deploy per the ship strategy (manual by default)

Utilities:
- `/ks-orchestrator`  runs a story's full cycle with human checkpoints (plan validation, ship confirmation)
- `/ks-help`          prints the pipeline map (French, user-facing cheat sheet)
- `/ks-status`        derives the project's pipeline state from the files (framing, per-story progress, next command)

One feature = one Research → Design → Plan → Execute → Review → Ship cycle = one branch = one PR (Design only when the story has UI).

## Story ids and branches
- Every story has an id: `s<number>-<short-slug>` (e.g. `s01-submit-testimonial`). It is assigned in docs/stories.md and reused verbatim everywhere: `docs/research/<id>.md`, `docs/plans/<id>.md`, `docs/reviews/<id>.md`, branch `feature/<id>`.
- All work on a story happens on `feature/<id>`, branched from the default branch. Never commit story work to the default branch.
- The story diff = `git diff <default-branch>...feature/<id>`. That is what the review judges.
- A command that receives a fuzzy story name resolves it against docs/stories.md; if there is no unambiguous match, it lists the available stories and stops.

## Gate (mechanical)
- The review report `docs/reviews/<id>.md` must end with the exact lines `Max severity: <critical|major|minor|none>` and `Ship allowed: <yes|no>`. A single critical = no.
- `/ks-ship` refuses to run unless that file exists and contains the line `Ship allowed: yes`. No file, no line, or `no` → ship blocked. No exceptions.
- After a blocked review, `/ks-execute` runs in fix mode: the review findings are fed to the implementer and fixed before anything else.
- A plan executes only if its frontmatter says `validated: yes` — set by the human validation checkpoint (/ks-plan or the orchestrator), never by the file merely existing. /ks-execute is fail-closed on it.

## Ship strategy
Merge mode: manual   (manual | auto — default: manual)
- manual: /ks-ship opens the PR and stops. Merging is a human decision (review on GitHub, protected branch, CI). After the merge, rerun /ks-ship to confirm the deployment and clean up the branch.
- auto: /ks-ship merges and deploys immediately after the gate. Only for solo flows where running /ks-ship IS the decision.

## Design
The global design system lives in `docs/design-system.md` (components + tokens, anchored to the boilerplate). Each story's design lives in `docs/designs/<id>.md` (+ a reference `.html` mockup).
- A story's design can be generated by the agent or produced in Claude Design / Gemini and brought back. Either way it builds on the design system.
- Inventing a component or token outside the design system is forbidden. Compose with what exists.
- The HTML mockup is a reference, not code: the implementation uses the boilerplate's real components.
- A need the system doesn't cover = a "design system gap" to report, never to fill freestyle.
- Stories without UI skip `/ks-design`.

## Data & docs lifecycle
All pipeline data lives in markdown files under docs/, versioned by git. No database, no state file: the pipeline state is derived from the files (a story is planned if docs/plans/<id>.md exists, shipped if its review says `Ship allowed: yes` and the branch is merged) — a derived state can't go stale.

- Framing docs — docs/prd.md, docs/stories.md, docs/reviews/stories.md, docs/architecture.md, docs/design-system.md: committed on the default branch at the end of their phase. (docs/reviews/stories.md reviews the breakdown, not a story: it is a framing doc, unlike docs/reviews/<id>.md which travels with its branch.)
- Story docs — docs/research/<id>.md, docs/designs/<id>* (brief, md, html), docs/plans/<id>.md, docs/reviews/<id>.md: committed on feature/<id>. The implementer's single story commit brings the research, the design and the plan; /ks-ship commits the review. Every PR carries its own research, design, plan and review.
- Task progress — the checkboxes in docs/plans/<id>.md: the implementer ticks each task as it lands, and they travel in the story's commit. The plan file is the live progress tracker, never a commit trigger.
- Commits — **one commit per story**, not one per plan task. A second commit only for something you would want to revert on its own (typically a migration). The branch's commits are squashed at merge, so the default branch gets one commit per story.
- Boilerplate-inherited docs — `docs/research/s000-*`, `docs/research/s001-*`, `docs/plans/cache-components-migration.md`, `docs/migrations/` and the subsystem docs in `docs/` (auth, Stripe, Inngest, Sentry…) belong to the ShipSaaS boilerplate, not to ASL-CMS. Never implement them and never treat them as project stories: see `docs/research/README.md`. Our own story ids start at `s01` in docs/stories.md.
- Decisions — docs/decisions/NNN-<slug>.md (MADR format, @templates/adr.md): one file per structural decision, with the considered options and why they were rejected. Immutable: a change means a new ADR superseding the old one. Framing decisions commit on the default branch; story decisions travel with feature/<id>.

## Technical conventions
Ces conventions sont celles du boilerplate ShipSaaS, dont ce dépôt est issu. Elles
portent sur le **code** ; les règles ci-dessus portent sur le **processus**. Les deux
s'appliquent : une story passe par le pipeline killer-saas *et* respecte les règles
d'architecture ci-dessous.

### Rules Index

**IMPORTANT:** Before implementing ANY feature, consult the **Rules Index** at:
📋 [`.claude/rules/RULES-INDEX.md`](.claude/rules/RULES-INDEX.md)

The rules in `.claude/rules/` are canonical. Files in `.cursor/rules/` are
generated compatibility copies and must not be edited directly.

This index is a table of contents for all project implementation rules. Browse it to quickly find the relevant rule(s) for your task.

### Code Generation Prerequisites

Before generating ANY new code, you **MUST** complete these verification steps:

1. **Consult the Rules Index**
   Open [`.claude/rules/RULES-INDEX.md`](.claude/rules/RULES-INDEX.md) and:
   - Use the **Quick Decision Matrix** to identify relevant rules for your task
   - Read the **Description** column to find matching rules
   - **Read the full rule file(s)** before writing any code

   Common rule mappings:

   | Task                | Rules to Read                                                             |
   | ------------------- | ------------------------------------------------------------------------- |
   | New page/component  | `rule-presentation`, `rule-safe-route`                                    |
   | Form implementation | `rule-form-front-and-back`, `rule-zod-client-server-internationalization` |
   | Server Action       | `rule-safe-server-action`, `rule-server-actions-imports`                  |
   | Business service    | `rule-service`, `rule-authorization-service`                              |
   | Database model      | `rule-persistence`                                                        |
   | API Route           | `rule-api-routes`                                                         |

2. **Check Existing Codebase Patterns**
   Find and analyze **at least three existing examples** of similar functionality in the codebase. Look for:
   - Similar components, functions, or modules
   - Existing patterns that solve comparable problems
   - Code structure and conventions already in use

   If no such examples exist, explicitly state that fact before proceeding.

3. **Follow the Rules Exactly**
   If a rule exists for your task, you **MUST** follow it exactly. The rules contain:
   - Required patterns and code structure
   - Security requirements (auth, validation)
   - File naming and organization conventions
   - Integration patterns with other layers

**Until all verifications are complete, do NOT proceed with implementation.**
Every new feature must be analyzed against existing rules and codebase patterns before any code is written. Always propose an implementation plan and wait for approval before coding.

### Project Structure & Module Organization

Application code lives in `src`; Next.js routes sit under `src/app` and shared UI components in `src/components`. Utilities and cross-cutting helpers belong in `src/lib`, while database schemas and migrations live in `drizzle` with supporting scripts in `src/db/scripts`. End-to-end Playwright scenarios are under `e2e`, docs for subsystems (auth, Stripe, Inngest) reside in `docs`, shared assets in `public`, and automation helpers in `scripts`.

### Build, Test, and Development Commands

Use `pnpm dev` to launch the Next.js 16 app with Turbopack. `pnpm build` compiles the production bundle and `pnpm start` serves it. Run code quality checks with `pnpm lint` and `pnpm format`; apply automatic formatting via `pnpm format:fix`. Execute unit and integration suites with `pnpm test`, and run Playwright journeys via `pnpm test:e2e` (append `--ui` for debugging). Database tasks rely on Drizzle: `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:reset-seed` to refresh fixtures.

### Coding Style & Naming Conventions

Follow Prettier defaults: two-space indentation, single quotes, no semicolons, 80-character line width, and Tailwind class sorting. ESLint enforces module ordering and disallows direct `process.env` access; import configuration from `@/env`. Name React components with PascalCase, variables and helpers with camelCase, and non-component files using kebab-case.

Prefer functional programming over object-oriented programming: use pure
functions, composition, immutability, stateless services, and functional
modules. Wrap class-based external SDKs in functional adapters. Use OOP only
for genuinely complex persistent state.

### Testing Guidelines

Vitest powers unit and integration tests with separate `jsdom` and `node` projects; colocate specs as `*.test.ts(x)` near the code under test. Initialize mocks using the setup files referenced in `vitest.config.ts`. For browser flows, add Playwright specs under `e2e` and run `pnpm test:e2e --project=chromium` when isolating failures. Keep seeds deterministic by updating `src/db/scripts/seed.ts` whenever tests rely on fixture data.

### Database Migration Safety

Never write migration SQL manually in `drizzle/migrations/`, and never edit
`drizzle/migrations/meta/_journal.json` or snapshot files manually. After
changing models in `src/db/models/`, generate migrations with
`pnpm db:generate`. For custom SQL or data migrations, use
`drizzle-kit generate --custom` so the journal and snapshots remain coherent.
If generation fails, repair the snapshot state instead of bypassing it.

Do not run `pnpm build` automatically as a final verification step.

### Commit & Pull Request Guidelines

Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`); Husky hooks will lint, format, and run targeted tests on staged files. Pull requests should summarize scope, call out impacted areas (UI, API, DB), and note any `.env` or migration updates. Include relevant screenshots or terminal output for visible changes and link to docs updates in `docs/` when applicable.

### Security & Configuration Tips

Bootstrap environment files with `pnpm init:env`, then fill values from `env.example`. Generate secrets such as `AUTH_SECRET` and Stripe keys using the scripts referenced in `README.md`, and never commit `.env`. When validating Stripe webhooks locally, run `pnpm stripe:listen` alongside `pnpm dev`.

## Definition of Done (per feature)
- Single PR, structured description, readable diff
- Passing tests on business logic
- No regression on existing code
- Review passed (no open critical issue)
- Deployed to production

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
