# Project Rules Index

This file is a table of contents for all project rules. Before implementing a feature, browse this index to find the most relevant rule to consult.

## How to Use This Index

1. **Read the description** of each rule to identify the one matching your task
2. **Consult the rule file** before writing any code
3. **Multiple rules** may apply to the same task (e.g., form + validation + i18n)

---

## 00-generals - General Rules

Cross-cutting rules applicable to the entire project.

| Rule                      | Link                                                                        | Description                                                                      | When to Consult                                      |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Architecture**          | [rule-architecture.mdc](00-generals/rule-architecture.md)                   | Strict layered architecture: Presentation → Facade → Service → DAL → Persistence | Understanding data flow, knowing which layer to call |
| **General Technical**     | [rule-general-technical.mdc](00-generals/rule-general-technical.md)         | TypeScript conventions, Next.js, RSC, Server Actions, clean code                 | Any new feature, basic conventions                   |
| **Top-Down Design**       | [top-down-design.mdc](00-generals/top-down-design.md)                       | Refactoring complex functions (>100 lines) into sub-functions                    | Long or hard-to-understand functions                 |
| **Helper/Utils**          | [helper-rules.mdc](00-generals/helper-rules.md)                             | Organizing isomorphic files (client/server) with .server.ts/.client.ts suffixes  | Creating reusable helpers for both client AND server |
| **Environment Variables** | [rule-environment-variables.mdc](00-generals/rule-environment-variables.md) | Managing env vars with @t3-oss/env-nextjs and Zod validation                     | Adding/modifying environment variables               |
| **Logger**                | [rule-logger.mdc](00-generals/rule-logger.md)                               | Using Winston logger (server-side only)                                          | Adding server-side logs                              |
| **CI/CD DevOps**          | [rule-ci-cd-devops.mdc](00-generals/rule-ci-cd-devops.md)                   | CI/CD pipeline, tests, linting, deployment                                       | CI/CD configuration, testing strategy                |

---

## 01-presentation - Presentation Layer

Rules for pages, components, forms, and Server Actions.

### Pages and Layouts

| Rule                  | Link                                                                          | Description                                                            | When to Consult                       |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| **Presentation**      | [rule-presentation.mdc](01-presentation/rule-presentation.md)                 | RSC vs Client Components, route organization, import patterns          | Creating a new page or component      |
| **UX Page Layout**    | [rules-ux-pagelayout.mdc](01-presentation/rules-ux-pagelayout.md)             | Page composition, visual hierarchy, Card sections, form multi-sections | Structuring page content and sections |
| **Responsive Layout** | [rule-layout-page-breaking.mdc](01-presentation/rule-layout-page-breaking.md) | Tailwind breakpoints, responsive tables, avoiding horizontal scroll    | Responsive UI, tables, cards          |

### Forms

| Rule                  | Link                                                                        | Description                                                       | When to Consult                  |
| --------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------- |
| **Form Front + Back** | [rule-form-front-and-back.mdc](01-presentation/rule-form-front-and-back.md) | Client validation (RHF + Zod) + server validation (Server Action) | Form with dual validation        |
| **Form Front Only**   | [rule-form-front.mdc](01-presentation/rule-form-front.md)                   | Client-only validation with React Hook Form                       | Simple client-side form          |
| **Form Back Only**    | [rule-form-back.mdc](01-presentation/rule-form-back.md)                     | Server Actions with useActionState, Zod safeParse validation      | Form with server-side submission |

### Server Actions and Security

| Rule                      | Link                                                                                                       | Description                                                        | When to Consult                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| **Secure Server Action**  | [rule-safe-server-action.mdc](01-presentation/rule-safe-server-action.md)                                  | Mandatory requireActionAuth(), role verification                   | Creating a Server Action                       |
| **Server Action Imports** | [rule-server-actions-imports.mdc](01-presentation/rule-server-actions-imports.md)                          | What can/cannot be imported in a Server Action                     | Import errors in Server Actions                |
| **Server Action i18n**    | [rule-server-actions-internationalization.md](01-presentation/rule-server-actions-internationalization.md) | Translated messages in Server Actions with getTranslations         | Multilingual Server Action                     |
| **Secure Routes**         | [rule-safe-route.mdc](01-presentation/rule-safe-route.md)                                                  | Proxy gating, session promise in layouts, withAuth for role checks | Securing a page or layout, reading the session |

### Tables and Pagination

| Rule                 | Link                                                                              | Description                                                     | When to Consult                       |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| **Table Pagination** | [rule-table-pagination.mdc](01-presentation/rule-table-pagination.md)             | Complete table structure with pagination, search, CRUD          | Creating a management page with table |
| **Table UI/UX**      | [rule-table-ui-ux-pagination.mdc](01-presentation/rule-table-ui-ux-pagination.md) | Table design standards: toolbar, responsive columns, pagination | Improving table UX                    |

### API and Cache

| Rule                          | Link                                                                              | Description                                                                             | When to Consult                                     |
| ----------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **API Routes**                | [rule-api-routes.mdc](01-presentation/rule-api-routes.md)                         | RESTful CRUD, withAuth/withAuthToken authentication                                     | Creating an API Route                               |
| **React Query**               | [rule-react-query.mdc](01-presentation/rule-react-query.md)                       | useQuery/useMutation hooks, query keys, invalidation                                    | Client-side fetching with React Query               |
| **React Cache vs Next Cache** | [rule-react-cache-next-cache.mdc](01-presentation/rule-react-cache-next-cache.md) | Cache Components: 'use cache' in the DAL, unstable_cache, per-user data behind Suspense | Caching a read, invalidating it, opting a route out |

### Internationalization

| Rule                       | Link                                                                                                              | Description                                             | When to Consult             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------- |
| **Translations**           | [rule-translation.mdc](01-presentation/rule-translation.md)                                                       | next-intl structure, useTranslations vs getTranslations | Adding translations         |
| **Zod Client/Server i18n** | [rule-zod-client-server-internationalization.mdc](01-presentation/rule-zod-client-server-internationalization.md) | Translated Zod schemas for both client AND server       | Multilingual Zod validation |

### Other Components

| Rule            | Link                                                        | Description                                                  | When to Consult                |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------ |
| **Charts**      | [rule-chart.mdc](01-presentation/rule-chart.md)             | ShadCN Charts with Recharts, ChartContainer, ChartConfig     | Adding charts/graphs           |
| **File Upload** | [rule-upload-file.mdc](01-presentation/rule-upload-file.md) | FileUpload component, upload Server Action, Supabase Storage | Implementing file/image upload |

---

## 02-services - Services Layer

Rules for business logic, validation, and authorization.

### Business Services

| Rule              | Link                                                          | Description                                               | When to Consult                 |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------- |
| **Service**       | [rule-service.mdc](02-services/rule-service.md)               | Service structure, Zod validation, authorization, facades | Creating a new business service |
| **Service Tests** | [rule-services-tests.mdc](02-services/rule-services-tests.md) | Test patterns by role (ADMIN, USER, PUBLIC), mocking DAOs | Writing service tests           |

### Authorization (CASL)

| Rule                        | Link                                                                                      | Description                                                 | When to Consult                      |
| --------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| **CASL Abilities**          | [rule-casl-authorization.mdc](02-services/rule-casl-authorization.md)                     | CASL system, defineAbilitiesFor, userCan, userCanOnResource | Understanding the permissions system |
| **Authorization Service**   | [rule-authorization-service.mdc](02-services/rule-authorization-service.md)               | canReadX, canUpdateX functions per domain                   | Creating authorization functions     |
| **Roles and Organizations** | [rule-roles-and-organization-roles.mdc](02-services/rule-roles-and-organization-roles.md) | Global roles (USER, ADMIN) vs org roles (OWNER, MEMBER)     | Understanding permission hierarchy   |

### Validation and Emails

| Rule                    | Link                                                                                                                    | Description                                            | When to Consult                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| **Validation Zod i18n** | [rule-service-zod-validation-internationalization.mdc](02-services/rule-service-zod-validation-internationalization.md) | createXServiceSchema() with integrated getTranslations | Multilingual service-side validation |
| **Email Service**       | [rule-email-service.mdc](02-services/rule-email-service.md)                                                             | Resend + React Email, templates, sendEmailService      | Sending emails                       |
| **Emails i18n**         | [rule-service-emails-internationalization.mdc](02-services/rule-service-emails-internationalization.md)                 | Translated email templates with getTranslations        | Multilingual emails                  |

### Test Data

| Rule                | Link                                                                                              | Description                                            | When to Consult                        |
| ------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| **Seed Users/Orgs** | [rule-seed-usersroles-and-organization.mdc](02-services/rule-seed-usersroles-and-organization.md) | Complete test dataset with all roles and organizations | Understanding test data, writing tests |

---

## 03-persistance - Persistence Layer

Rules for database and repositories.

| Rule             | Link                                                               | Description                                          | When to Consult                    |
| ---------------- | ------------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------- |
| **Persistence**  | [rule-persistence.mdc](03-persistance/rule-persistence.md)         | Drizzle ORM, schemas, DAO repositories, domain types | Creating a new model or repository |
| **Transactions** | [rule-transaction-dao.mdc](03-persistance/rule-transaction-dao.md) | db.transaction(), TxnDao suffix, atomicity           | Multiple atomic operations         |

---

## Quick Decision Matrix

### I want to create...

| Task                    | Rules to Consult                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| A new page              | `rule-presentation`, `rules-ux-pagelayout`, `rule-safe-route`                                    |
| A complete form         | `rule-form-front-and-back`, `rules-ux-pagelayout`, `rule-zod-client-server-internationalization` |
| A Server Action         | `rule-safe-server-action`, `rule-server-actions-imports`                                         |
| A table with pagination | `rule-table-pagination`, `rule-table-ui-ux`                                                      |
| A new business service  | `rule-service`, `rule-authorization-service`                                                     |
| A new DB model          | `rule-persistence`                                                                               |
| An API Route            | `rule-api-routes`                                                                                |
| Translations            | `rule-translation`                                                                               |
| Service tests           | `rule-services-tests`, `rule-seed-usersroles-and-organization`                                   |

### I have a problem with...

| Problem                     | Rules to Consult                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Architecture / data flow    | `rule-architecture`                                                                               |
| Permissions / authorization | `rule-casl-authorization`, `rule-roles-and-organization-roles`                                    |
| Responsive / mobile         | `rule-layout-page-breaking`                                                                       |
| Cache / performance         | `rule-react-cache-next-cache`                                                                     |
| Server Action imports       | `rule-server-actions-imports`                                                                     |
| Multilingual validation     | `rule-zod-client-server-internationalization`, `rule-service-zod-validation-internationalization` |
