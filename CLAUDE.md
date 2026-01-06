# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Common Commands

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Run ESLint with auto-fix
- `pnpm format` - Check formatting with Prettier
- `pnpm format:fix` - Fix formatting with Prettier
- `pnpm test` - Run tests with Vitest (uses --pool=forks)

### Database Commands

- `pnpm db:generate` - Generate Drizzle schemas
- `pnpm db:migrate` - Run migrations
- `pnpm db:push` - Push schema to database (force)
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:seed` - Seed database with test data
- `pnpm db:reset-seed` - Clear, push, and seed database
- `pnpm db:check` - Check database connection

### Stripe Commands

- `pnpm stripe:listen` - Listen for webhooks on localhost:3000/api/auth/stripe/webhook
- `pnpm stripe:logs` - View Stripe logs

## Architecture Overview

This is a Next.js 15 SaaS boilerplate with a strict layered architecture:

### Core Technologies

- **Next.js 16** with App Router
- **React 19** (refs passed as props, no forwardRef needed)
- **TypeScript** with strict typing
- **Drizzle ORM** with PostgreSQL
- **Better Auth** for authentication
- **Stripe** for payments
- **ShadCN UI** components
- **Tailwind CSS v4**
- **Vitest** for testing

### Layer Architecture (Strict)

1. **Presentation** (`src/app/`, `src/components/`)
   - Uses domain types only
   - Reads through DAL (with react-cache)
   - Mutations through Server Actions only
   - No direct service/persistence calls

2. **DAL (Data Access Layer)** (`src/app/dal/`)
   - Caches data access with react-cache
   - Transforms persistence entities to DTOs
   - Never exposes raw Drizzle models

3. **Facade** (`src/services/facades/`)
   - Interface between presentation and services
   - Applies interceptors (logging, audit)

4. **Service** (`src/services/`)
   - Business logic
   - Validation (Zod schemas)
   - Authorization (CASL-based)

5. **Persistence** (`src/db/`)
   - Drizzle models and repositories
   - Database interactions only

### Key Directory Structure

- `src/app/[locale]/` - Internationalized routes
  - `(public)/` - Public pages
  - `(auth)/` - Authentication pages
  - `(app)/` - Protected user pages
  - `admin/` - Admin pages
- `src/components/` - Reusable components
  - `ui/` - ShadCN UI components
  - `features/` - Feature-specific components
- `src/services/` - Business logic layer
- `src/db/` - Database layer
- `src/lib/` - Utilities and helpers

## 🧑‍💻 Coding Style Rule: Functional over OOP

**Always prefer functional programming over object-oriented programming (OOP).**

- Write **pure functions** instead of classes.
- Favor **composition, immutability, and stateless services**.
- Use functional modules (`export function`) rather than singletons or global objects.
- Wrap external SDKs (e.g., Stripe, Resend) in **functional adapters** when they expose OOP APIs.
- OOP should only be used when handling truly **complex, persistent state** that is hard to model otherwise (rare in SaaS web apps).

### Development Guidelines

#### Authentication

- Uses Better Auth with Stripe integration
- Multi-organization support with role-based access
- TOTP 2FA support

#### Database

- Uses Drizzle ORM with PostgreSQL
- Seed data in `src/db/scripts/seed.ts`
- Always use transactions for related operations

#### Styling

- Tailwind CSS v4 with utility-first approach
- ShadCN UI components for consistency
- Dark mode support with next-themes

#### Testing

- Vitest with pool=forks for isolation
- Test files in `src/__tests__/` and `src/services/__tests__/`
- Mock database connections in tests

#### Internationalization

- next-intl for i18n
- Messages in `messages/` directory (en.json, fr.json, es.json)
- Locale-based routing

#### File Organization

- Use kebab-case for new files
- Feature-based organization in components
- Strict layer separation (no cross-layer calls)

## Environment Setup

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - Authentication secret (generate with `openssl rand -base64 32`)
- `RESEND_API_KEY` - For email sending
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

## Package Manager

Always use `pnpm` over `npm` for this project.

## RULES

### Rules Index

**IMPORTANT:** Before implementing ANY feature, consult the **Rules Index** at:
📋 [`.cursor/rules/RULES-INDEX.md`](.cursor/rules/RULES-INDEX.md)

This index is a table of contents for all project implementation rules. It helps you quickly find the relevant rule(s) for your task.

### Code Generation Prerequisites

Before generating ANY new code, you **MUST** complete these verification steps:

1. **Consult the Rules Index**
   Open [`.cursor/rules/RULES-INDEX.md`](.cursor/rules/RULES-INDEX.md) and:
   - Use the **Quick Decision Matrix** to identify relevant rules for your task
   - Read the **Description** column to find matching rules
   - **Read the full rule file(s)** before writing any code

   Common rule mappings:
   | Task | Rules to Read |
   |------|---------------|
   | New page/component | `rule-presentation`, `rule-safe-route` |
   | Form implementation | `rule-form-front-and-back`, `rule-zod-client-server-internationalization` |
   | Server Action | `rule-safe-server-action`, `rule-server-actions-imports` |
   | Business service | `rule-service`, `rule-authorization-service` |
   | Database model | `rule-persistence` |
   | API Route | `rule-api-routes` |

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
Every new feature must be analyzed against existing rules and codebase patterns before any code is written.

### Implementation Workflow

1. Analyze the requested feature or change
2. **Consult [RULES-INDEX.md](.cursor/rules/RULES-INDEX.md)** to find applicable rules
3. **Read the full content** of each relevant rule file
4. Search for 3+ existing examples in the codebase
5. Present findings and propose an implementation plan
6. Wait for approval before implementing
7. Follow existing patterns and rules strictly

## Coding Guidelines

- Ne pas utiliser de commentaires pour expliquer le code, seulement pour le code complexe
- Ne lance pas de pnpm build a la fin
