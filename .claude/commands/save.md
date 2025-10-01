# Save

Quick commit with clean message and auto push to maintain neat git history.

## Workflow

1. **Stage**: `git add -A` to add everything
2. **Analyze**: `git diff --cached --stat` to see changes
3. **Commit**: Generate ONE-LINE message (max 50 chars):
   - `feat: [new feature]`
   - `fix: [bug correction]`
   - `update: [improvement]`
   - `refactor: [restructuring]`
   - `chore: [maintenance task]`
4. **Push**: `git push` immediately

## Message Rules

- **ONE LINE ONLY** - no body, no details
- **Under 50 characters** - be concise
- **No final period** - space economy
- **Present tense** - "add" not "added"
- **Lowercase after colon** - `feat: auth system` not `feat: Auth system`

## Examples

```
feat: add stripe payment integration
fix: resolve auth redirect loop
update: improve error handling
refactor: simplify user service
chore: update dependencies
```

## Execution

- NO interactive commands
- NO verbose messages
- NO "Generated with" signatures
- If no changes, exit silently
- If push fails, report error only

## Priority

Speed > Detail. Keep commits atomic and history clean.
