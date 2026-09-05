---
description:
---

# Your rule content

You are an expert in TypeScript, Node.js, Next.js App Router, React, Shadcn UI, Radix UI, and Tailwind.

Key Principles

- The project follows a **structure** with multiple layer.
- Maintain a **clear separation of concerns** between different architectural layers.
- **Minimize direct coupling** between layers by using defined interfaces and abstractions.
- **Use TypeScript for strong typing** across all layers.
- Use kebab-case for new file
- You use PNPM over NPM as possible
- Generate a concise Git commit message based on the staged diff.
- Add new code and function at the end of the file.
- Clean Code : Dont comment code, use function name and comments to explain the code.

Layering and Dependencies

- **Presentation Layer (`src/app/<route>`):**
  - Uses Next.js **App Router**.
  - Prefers **React Server Components (RSC)** over Client Components.
  - Calls **Server Actions** for mutations instead of API Routes.
  - Avoids fetching data in Client Components — delegate to **RSC or DAL**.

- **Service Layer (`/services/`):**
  - Provides business logic abstraction for all applications.
  - Enforces authorization and validation before accessing persistence through repositories.
  - Is wrapped by **facades** when called from presentation or the DAL; a service never imports its facade.
  - Uses DTOs for structured data transfer.

- **Persistence Layer (`/db/`):**
  - Uses **Drizzle ORM** for database modeling.
  - Contains repositories that interact with the database.
  - Is called by services and never exposes DAL functions.

Data Handling and API Rules

- Avoid **fetching data directly in Client Components** — use Server Components instead.
- Use **Server Actions** for handling mutations instead of API Routes.
- Implement **caching and DTO transformations in the DAL** after reading through a service facade and before returning data to presentation.

Performance Optimization

- **Minimize `use client`**—only use it for Web API access, interactive UI components, or isolated stateful logic.
- Avoid **`useEffect` for data fetching**—favor Server Components or Suspense.
- Wrap **Client Components in Suspense** when necessary.
- Use **dynamic imports** for non-critical UI components.
- Optimize images using **WebP format and lazy loading**.

Security and Best Practices

- Enforce **authorization and validation at the service layer** before making any persistence calls.
- Limit **direct database interactions** to repositories in `/db/`.
- Use **environment variables (import from `@/env`)** for sensitive configurations with `@t3-oss/env-nextjs` validation.

Clean Code

- **Judicious commenting:** Comments are permitted but should be used sparingly—only in particularly complex cases where the code itself can’t fully convey intent.
- **No emojis in comments.**
- **Use JSDoc annotations for functions** when adding comments.
- **Explicit error handling:** Always handle errors deliberately—catch exceptions where they occur, provide contextual information, and ensure failures are surfaced rather than silently ignored.

Follow Next.js and TypeScript best practices for maintainability, scalability, and performance.
