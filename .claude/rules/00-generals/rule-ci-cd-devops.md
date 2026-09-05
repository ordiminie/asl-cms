---
description:
---

# CI/CD Devops rules

You are an expert in TypeScript, Node.js, Next.js App Router, React, Shadcn UI, Radix UI, and Tailwind.

Key Principles

- The **CI/CD pipeline** ensures code quality, testing, and automated deployments.
- **Linting, formatting, and pre-commit hooks** must be enforced across project.
- Follow a **test-driven development (TDD) approach** with unit, integration, and end-to-end (E2E) tests.
- Deployments should be **automated and versioned** using GitHub Actions.
- Update README.md when structure / Script change
- Use pnpm instead of npm

### Linting, Formatting, and Code Quality

- Use **ESLint** for linting and **Prettier** for formatting.
- Enforce **pre-commit hooks** with `husky` and `lint-staged`.
- Follow **TypeScript strict mode** for type safety.

Example ESLint & Prettier Configuration:

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "prettier/prettier": "error",
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

Example Husky Hook:

```sh
#!/bin/sh
pnpm lint-staged
```

### Testing Strategy

Two levels, and two only:

- **Unit tests** (Vitest) for functions, services and components
  - Database and authentication are mocked with `vi.mock()`
  - No real database, no network
- **End-to-end tests** (Playwright) for full user flows
  - Run against the **production build** (`pnpm build && pnpm start`), never `pnpm dev`:
    the static shell and streaming don't behave the same, and that's what the tests protect
  - Backed by an **ephemeral Postgres service** in CI, seeded before the run

There is no integration-test layer between the two, and no TestContainers: repository behaviour is
covered by the e2e suite running against a real seeded database.

#### Unit Testing with Vitest

- Use **Vitest** for fast and reliable unit testing
- Mock dependencies with `vi.fn()`

Example Unit Test with Mocked DB:

```ts
import {describe, it, expect, vi} from 'vitest'
import {db} from '@/db/models/db'

vi.mock('@/db/models/db', () => ({
  db: {
    query: vi.fn(),
  },
}))

describe('UserService', () => {
  it('should create a user', async () => {
    const mockUser = {id: 1, name: 'John'}
    vi.mocked(db.query).mockResolvedValueOnce([mockUser])

    const result = await userService.createUser({name: 'John'})
    expect(result).toEqual(mockUser)
  })
})
```

#### E2E Testing with Playwright

- Test **full user flows** (e.g., authentication, form submissions)
- Ensure tests run in **isolated test environments**

Example Playwright Test:

```ts
import {test, expect} from '@playwright/test'

test('User can log in', async ({page}) => {
  await page.goto('/login')
  await page.fill('#email', 'test@example.com')
  await page.fill('#password', 'password123')
  await page.click("button[type='submit']")
  await expect(page).toHaveURL('/dashboard')
})
```

### CI/CD Pipeline

- Use **GitHub Actions** for automated testing and deployments
- Run **linting, tests, and type checks** before merging PRs
- **Database migrations** are automatically run using Drizzle

Example GitHub Actions Workflow:

```yaml
name: CI Pipeline

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm check:rules
      - run: pnpm test

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-retries 5
        ports:
          - 5432:5432
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm db:push && pnpm db:seed
      - run: pnpm test:e2e --project=chromium
```

⚠️ **Jamais la base de preview pour les e2e** : deux specs créent un compte et une lit le seed. Un
service Postgres éphémère isole totalement, sans secret supplémentaire.

### Deployment Guidelines

- Deployments should be **automated** and follow **Git versioning**
- Use **staging environments** before pushing to production
- Ensure **environment variables are correctly managed** in `.env` files
- **Database migrations** must be run before deployment

### Security Best Practices

- **Never commit sensitive information** (`.env` should be ignored)
- Use **role-based access control (RBAC)** for CI/CD permissions
- **Monitor logs and metrics** for anomalies in production
- **Secure database credentials** in GitHub Secrets

Follow these practices to maintain **code quality, reliability, and security** throughout the development lifecycle.
