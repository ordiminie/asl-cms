# Repository Guidelines

## Code Generation Prerequisites

Before generating ANY new code, you **MUST** complete these two verification steps:

1. **Check Existing Codebase Patterns**
   Find and analyze **at least three existing examples** of similar functionality in the codebase. Look for:
   - Similar components, functions, or modules
   - Existing patterns that solve comparable problems
   - Code structure and conventions already in use

   If no such examples exist, explicitly state that fact before proceeding.

2. **Check .cursor/rules Directory**
   Review the `.cursor/rules/` folder to verify if a predefined rule exists for the task at hand:
   - Check `00-generals/` for general technical guidelines
   - Check `01-presentation/` for UI/frontend patterns
   - Check `02-services/` for business logic patterns
   - Check `03-persistance/` for database patterns

   If a rule exists, you **MUST** follow it exactly. If no rule exists, mention this before proposing a solution.

**Until both verifications are complete, do NOT proceed with implementation.**
Every new feature must be analyzed against existing rules and codebase patterns before any code is written. Always propose an implementation plan and wait for approval before coding.

## Project Structure & Module Organization

Application code lives in `src`; Next.js routes sit under `src/app` and shared UI components in `src/components`. Utilities and cross-cutting helpers belong in `src/lib`, while database schemas and migrations live in `drizzle` with supporting scripts in `src/db/scripts`. End-to-end Playwright scenarios are under `e2e`, docs for subsystems (auth, Stripe, Inngest) reside in `docs`, shared assets in `public`, and automation helpers in `scripts`.

## Build, Test, and Development Commands

Use `pnpm dev` to launch the Next.js 15 app with Turbopack. `pnpm build` compiles the production bundle and `pnpm start` serves it. Run code quality checks with `pnpm lint` and `pnpm format`; apply automatic formatting via `pnpm format:fix`. Execute unit and integration suites with `pnpm test`, and run Playwright journeys via `pnpm test:e2e` (append `--ui` for debugging). Database tasks rely on Drizzle: `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:reset-seed` to refresh fixtures.

## Coding Style & Naming Conventions

Follow Prettier defaults: two-space indentation, single quotes, no semicolons, 80-character line width, and Tailwind class sorting. ESLint enforces module ordering and disallows direct `process.env` access; import configuration from `@/env`. Name React components with PascalCase, variables and helpers with camelCase, and non-component files using kebab-case.

## Testing Guidelines

Vitest powers unit and integration tests with separate `jsdom` and `node` projects; colocate specs as `*.test.ts(x)` near the code under test. Initialize mocks using the setup files referenced in `vitest.config.ts`. For browser flows, add Playwright specs under `e2e` and run `pnpm test:e2e --project=chromium` when isolating failures. Keep seeds deterministic by updating `src/db/scripts/seed.ts` whenever tests rely on fixture data.

## Commit & Pull Request Guidelines

Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`); Husky hooks will lint, format, and run targeted tests on staged files. Pull requests should summarize scope, call out impacted areas (UI, API, DB), and note any `.env` or migration updates. Include relevant screenshots or terminal output for visible changes and link to docs updates in `docs/` when applicable.

## Security & Configuration Tips

Bootstrap environment files with `pnpm init:env`, then fill values from `env.example`. Generate secrets such as `AUTH_SECRET` and Stripe keys using the scripts referenced in `README.md`, and never commit `.env`. When validating Stripe webhooks locally, run `pnpm stripe:listen` alongside `pnpm dev`.
