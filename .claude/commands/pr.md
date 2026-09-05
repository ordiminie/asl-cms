# PR

Create and push PR with auto-generated title and description for your Next.js SaaS project.

## Workflow

1. **Verify**: `git status` and `git branch --show-current` for state
2. **Push**: `git push -u origin HEAD` to ensure remote tracking
3. **Analyze**: `git diff origin/boilerplate...HEAD --stat` to understand changes
4. **Generate**: Create PR with:
   - Title: One-line summary (max 72 chars)
   - Body: Key change bullet points
5. **Submit**: `gh pr create --title "..." --body "..." --base boilerplate`
6. **Return**: Display PR URL

## PR Format

```markdown
## Summary

• [Main change or feature]
• [Secondary changes]
• [Fixes included]

## Type

[feat/fix/refactor/docs/chore]

## Tests

• [Tests added/modified]
• [Manual validation performed]
```

## Execution Rules

- NO verbose descriptions
- NO "Generated with" signatures
- Default base: `boilerplate` (project's main branch)
- Use HEREDOC for multi-line body
- If PR exists, return existing URL
- Adapt content to SaaS context (Stripe, auth, etc.)

## Project Context

Account for specifics:

- Next.js 15 + App Router architecture
- Stripe and Better Auth integrations
- Stack: TypeScript, Drizzle ORM, ShadCN
- Layered structure (DAL, services, etc.)

## Priority

Clarity > Completeness. Keep PRs scannable and actionable.
