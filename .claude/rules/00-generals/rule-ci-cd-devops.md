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

Each package in the monorepo must include:

- **Unit tests** for individual functions and components
  - Database and authentication are mocked
  - Use `vi.mock()` for external dependencies
- **Integration tests** using TestContainers
  - Real database interactions with isolated containers
  - Authentication flows tested with mocked providers

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

#### Integration Testing with TestContainers

- Use **TestContainers** for isolated database testing
- Each test runs in a fresh database instance

Example Integration Test:

```ts
import {PostgreSqlContainer} from '@testcontainers/postgresql'
import {drizzle} from 'drizzle-orm/node-postgres'

describe('UserRepository Integration', () => {
  let container
  let db

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start()
    db = drizzle(/* container connection config */)
    await db.migrate()
  })

  afterAll(async () => {
    await container.stop()
  })

  it('should persist and retrieve user data', async () => {
    const userRepo = new UserRepository(db)
    const user = await userRepo.create({name: 'John'})
    const retrieved = await userRepo.findById(user.id)
    expect(retrieved).toEqual(user)
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
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:latest
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run lint
      - run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Migrations
        run: npm run db:migrate
      - name: Deploy
        run: npm run deploy
```

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
