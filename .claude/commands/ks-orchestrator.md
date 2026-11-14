---
description: Chain a story's full cycle — Research → Design → Plan → Execute ⇄ Review → Ship — stopping only to validate the plan or when an arbitration is needed
argument-hint: <story id or name>
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - AskUserQuestion
  - Agent
  - Bash
---

# ks-orchestrator — One story, full cycle, one command

Target story: $ARGUMENTS

You conduct the cycle; you never do a phase's work inline when a subagent owns it, and you never write code yourself. Every phase keeps the contract of its unit command (/ks-research, /ks-design, /ks-plan, /ks-execute, /ks-review, /ks-ship): same subagents, same gates, same files.

## Interruptions — the only two allowed

1. **Plan validation** (Phase 3) — always asked, via AskUserQuestion.
2. **Arbitration** — a decision that genuinely belongs to the user, asked via AskUserQuestion with a recommended option first. It covers:
   - a product or business choice that neither the story's acceptance criteria, the PRD nor the ADRs settle (check them before asking — never ask what they already decide);
   - a review finding whose fix requires choosing between options with different behaviour;
   - a review that allows the ship but leaves major findings: ask "fix before shipping (recommended) / ship as is";
   - a loop that no longer converges (see Phase 5);
   - a blocked prerequisite you cannot resolve (missing framing doc, missing design system, tooling down).

Nothing else stops the cycle: no confirmation before a routine phase, before opening the PR, or "should I continue?". Between phases, write one short progress line and go on.

## Phase 0 — Prerequisites (fail-closed)

The orchestrator drives one story's cycle — it never replaces the framing. Check, in order:

1. docs/prd.md exists? Missing → STOP: "No PRD — the pipeline starts with /ks-prd <target>. Nothing to orchestrate yet."
2. docs/stories.md exists? Missing → STOP: "No stories — run /ks-stories first."
3. docs/architecture.md exists? Missing → STOP: "No architecture — run /ks-architect first."
4. docs/reviews/stories.md says `Stories ready: yes`? If missing or negative, warn in the output (don't stop, don't ask): the breakdown hasn't passed /ks-stories-review.
   (docs/design-system.md is not required here: Phase 2 fail-closes on it only when the story has UI.)

Then resolve $ARGUMENTS to the story id (`s<number>-<slug>`) against docs/stories.md. No unambiguous match → list the available stories and stop. Never invent a framing doc or a story to keep going.

## Phase 1 — Research

If docs/research/<id>.md doesn't exist, produce it now following the ks-research contract: codebase-analysis skill on the story's scope, current state of the code, output structured by @templates/research.md. Otherwise reuse the existing file.

## Phase 2 — Design (UI stories only)

If the story has a screen and docs/designs/<id>.md doesn't exist, follow the ks-design contract on the **AGENT path** — don't ask who produces the design:

- fail-closed on docs/design-system.md (missing or empty → arbitration stop, pointing to /ks-design-system);
- output docs/designs/<id>.md + .html, desktop and mobile (390 px), anchored to the design system only; gaps recorded, never filled;
- run the visual check of the AGENT path (1280 and 390 px, two fix passes at most, fallback declared if the browser is unavailable) and record its outcome line in the .md.

A story without UI skips this phase.

## Phase 3 — Plan

If docs/plans/<id>.md doesn't exist, produce it following the ks-plan contract: small verifiable tasks, structured by @templates/plan.md, ADR when a structural choice is made. Open questions the plan can't settle from the story, research or ADRs are arbitrations: ask them before validation, in one AskUserQuestion call where possible.

CHECKPOINT — mandatory, whether the plan is new or already existed. If the plan's frontmatter already says `validated: yes`, continue. Otherwise present the plan summary (tasks, files touched, test strategy) and ask via AskUserQuestion: "Validate this plan?" — options: Validate / Modify / Stop. An existing plan file does NOT count as validated. On Validate, set `validated: yes` in the plan's frontmatter. Modify → apply the requested changes and ask again. Stop → stop. Never set the marker without an explicit Validate.

## Phase 4 — Execute

Fail-closed: docs/plans/<id>.md must carry `validated: yes` in its frontmatter — missing means back to the Phase 3 checkpoint. Then delegate to the `implementer` subagent exactly as /ks-execute does: branch feature/<id>, strict TDD, only what the plan specifies; fix mode first when a review requires fixes (blocked review, or majors the user chose to fix). In fix mode, any decision taken by arbitration is written into the plan before delegating, so the implementer works from the file. Capture its summary.

## Phase 5 — Review ⇄ Execute loop

Delegate to the `reviewer` subagent exactly as /ks-review does: fresh context, story diff `git diff <default-branch>...feature/<id>`, fix commits reviewed as new code, test suite run by the reviewer, verdict ending with the exact `Max severity:` and `Ship allowed:` lines. Write the full report to docs/reviews/<id>.md (a later round replaces it, and says what the previous round found and what was fixed).

Then:

- `Ship allowed: no` → back to Phase 4 in fix mode, then review again. No fixed round limit.
- `Ship allowed: yes` with major findings → arbitration (fix before shipping, recommended / ship as is). Fix → Phase 4 in fix mode, then review again.
- `Ship allowed: yes`, max severity minor or none → Phase 6.

Convergence guard: if a round leaves a finding open that the previous round already asked to fix, or the max severity stops decreasing over two rounds, stop the loop and ask for an arbitration, with the open findings and your recommendation. Never soften a verdict, edit the report's gate lines, or skip a review to move on.

## Phase 6 — Ship

No confirmation: the passed gate is the go. Run /ks-ship's flow: mechanical gate (`grep -q '^Ship allowed: yes' docs/reviews/<id>.md`), review committed on the branch, tests on the branch, push, PR with the review verdict — then the project's ship strategy (manual, the default: stop at the PR, never merge; auto: merge, deploy, confirm live, clean up the branch once the merge is proven).

End with: "Story <id> shipped. Cycle complete." (auto mode), "PR opened: <url> — squash-merging it is yours. After merging, rerun /ks-ship <id> to confirm the deployment and clean up the branch." (manual mode) — or the exact blocking state if stopped (which phase, what's missing, what you need from the user).
