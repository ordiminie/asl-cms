---
description: Derive a story's screen from the design system. Agent path (generates) or external path (Claude Design / Gemini). Never freestyles outside the system.
argument-hint: <story id or name> [--claude-design (default) | --agent | --gemini]
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - AskUserQuestion
  - Skill
  - Bash
  - Artifact
---

# ks-design — Story design, anchored to the design system

Target story: $ARGUMENTS

## Execution contract (non-negotiable)

You are FORBIDDEN from:

- Producing a design without an existing design system (see Step 1).
- Inventing a component, token, color or spacing outside the design system.
- Designing a screen the story doesn't ask for.

## Workflow

### Step 1 — Prerequisites (fail-closed)

Check that docs/design-system.md exists AND is non-empty.

- Missing or empty → STOP. Reply: "No design system found in docs/design-system.md. Set it up first via /ks-design-system, then rerun /ks-design." Produce NO design.
- Present → load it. Its tokens and components are your only visual source, whichever path is chosen.

### Step 2 — Tool choice

**Default path: Claude Design.** Unless $ARGUMENTS says `--agent` or `--gemini`, take the Claude Design path without asking.

- `--claude-design` (default) — you write the brief, then open the Claude Design canvas yourself (Step 4)
- `--agent` — you generate the design directly
- `--gemini` — you write the brief, the user produces the screens in Gemini and brings back the result

**Every screen comes in two versions: desktop and mobile (390 px)**, with the same content and the same states, following the design system's rules below 1 024 px (drawer, 56 px actions, 16 px margins…). Whatever the path, the brief asks for both and the mockup shows both. A screen delivered in one version only is incomplete.

### Step 3 — Read the story

Read docs/stories.md, resolve the target story id (`s<number>-<slug>`) and isolate its acceptance criteria. Read docs/research/<id>.md if it exists — its anchor points tell you which pages and layouts the screen plugs into. If the PRD names a target SaaS, its equivalent screen is a layout/UX reference — structure and states only, never visual identity: tokens and components come exclusively from the design system. The design covers this screen only.

### Step 4 — Produce, per the chosen path

**AGENT path** — you generate:

- docs/designs/<id>.md (structure: @templates/design-screen.md)
- docs/designs/<id>.html — a static HTML mockup of the screen, desktop and mobile, using EXCLUSIVELY the design system's tokens (colors, typography, spacing). Low fidelity. Goal: communicate layout + states, not be production code.

**CLAUDE DESIGN path (default)** — you write the brief, then open the canvas yourself:

1. Write docs/designs/<id>-brief.md (structure: @templates/design-brief.md): every screen with layout, exact fields and actions, the four states, a **desktop and a mobile (390 px) version**, and the design system constraints COPIED IN (tokens — both light and dark sets, ADR 012 — components, do/don't) so the brief is self-contained. Out-of-scope stated. This file is a deliverable of this step — not a chat message.
2. **Invoke the `design` skill yourself** (Claude Design's dedicated command, `/design`) with the brief and the previous story's mockup as visual reference. Don't stop to ask the user to carry the brief over. The canvas must hold both versions of every screen, all their states, and a light/dark toggle.
3. Give the user the canvas link and **wait for their validation** on the canvas. Apply the requested changes to the canvas until they validate.
4. Once validated: record/normalize the mockup into docs/designs/<id>.html, and write docs/designs/<id>.md (structure: @templates/design-screen.md) describing the screen, pointing to the HTML and to the canvas URL, and noting the validation date.

**GEMINI path** — you write the brief, the user produces the screens:

1. Write docs/designs/<id>-brief.md as in the Claude Design path (desktop and mobile versions included).
2. The user takes the brief to Gemini and brings back the result (exported HTML, screenshot, or description). You then: record/normalize the mockup into docs/designs/<id>.html, and write docs/designs/<id>.md (structure: @templates/design-screen.md) describing the screen and pointing to the HTML.
   If the user brought nothing back → end with: "Brief ready in docs/designs/<id>-brief.md — take it to Gemini, then rerun /ks-design <id> --gemini with the result." Don't generate in their place, unless they explicitly switch to another path.

### Step 5 — Gaps

Any need the design system doesn't cover → record it under "Design system gaps" in the .md. DON'T invent it.

Timebox: defined enough to unblock the Plan, not pixel-perfect.

## Mockup status (hard rule)

docs/designs/<id>.html is a REFERENCE, not code to copy. In Execute, the screen is built with the boilerplate's real components. The mockup communicates intent (layout, states); it doesn't replace the component system and never gets pasted into production.

End with: "Design ready (docs/designs/<id>.md + .html). Next step: /ks-plan <id>"
