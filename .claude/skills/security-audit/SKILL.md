---
name: security-audit
description: >
  Automated 4-layer security audit for any codebase. Combines dependency
  scanning (pnpm audit), filesystem scanning (Trivy), Snyk Studio MCP
  for agentic SAST/SCA, and AI-powered pentester reasoning to find
  vulnerabilities that tools alone miss.
  Use when the user says "scan security", "audit my code", "check
  vulnerabilities", "security report", or when scheduling recurring
  security checks on repos.
---

# Security Audit Skill

Automated 4-layer security audit for any codebase.

## Prerequisites

- `pnpm` or `npm` (for dependency audit)
- `trivy` CLI installed (`brew install trivy` / `apt install trivy`)
- `snyk` CLI installed (`npm install -g snyk`) + Snyk Studio MCP configured in Claude Code
- Claude Code or any LLM agent (for reasoning layer)

## Workflow

Before starting, create the output directory:
```bash
mkdir -p .security
```

### Layer 1 — Dependency Audit

Run in the project root:
```bash
pnpm audit --json > .security/deps-audit.json
```
If project uses npm instead:
```bash
npm audit --json > .security/deps-audit.json
```
Flags known CVEs in project dependencies.

### Layer 2 — Filesystem Scan (Trivy)

```bash
trivy fs --scanners vuln,secret,misconfig --skip-dirs .next,node_modules,.git,dist,build,.turbo --format json -o .security/trivy-report.json .
```
Detects:
- Hardcoded secrets (API keys, tokens, passwords)
- Infrastructure misconfigurations (Dockerfile, k8s, Terraform)
- Vulnerable dependencies (cross-validates with Layer 1)

### Layer 3 — Snyk

#### Option A: Snyk CLI (standalone)
```bash
snyk test --json > .security/snyk-report.json
snyk code test --json > .security/snyk-code-report.json
```
- `snyk test` — SCA (dependency vulnerabilities)
- `snyk code test` — SAST (static code analysis)

To monitor the project continuously:
```bash
snyk monitor --all-projects
```

#### Option B: Snyk Studio (MCP in Claude Code)
If Snyk Studio MCP is configured, run:
```
/snyk-fix
```
This performs SAST + SCA + container + IaC scanning with automated fix suggestions.

Save all outputs to `.security/`.

If Snyk is not installed or configured, skip this layer and note it in the report.

### Layer 4 — AI Reasoning (Pentester Prompt)

1. Read and analyze the raw JSON outputs from previous layers:
   - `.security/deps-audit.json` — parse vulnerabilities, group by severity
   - `.security/trivy-report.json` — parse findings, filter false positives
   - `.security/snyk-report.json` (if available)
   For each scanner output: summarize critical/high findings in plain language, explain the impact, suggest fixes. Discard noise and low-confidence results.
2. Apply the pentester prompt from `prompts/pentester.md`
3. Analyze the full codebase with all scanner results as context — go deeper than the scanners
4. Generate report using `templates/report.md`
5. Save to `.security/report-YYYY-MM-DD.md`

This layer catches what scanners miss:
- Broken authentication / authorization logic
- Business logic flaws
- Unsafe data flows across components
- Missing rate limiting, CORS misconfig
- Injection vectors (SQL, XSS, command injection)
- Insecure API design patterns

## Output Directory

All results go in `.security/` at the project root:
```
.security/
├── deps-audit.json       # Layer 1 raw output
├── trivy-report.json     # Layer 2 raw output
├── snyk-report.json      # Layer 3 raw output (if available)
├── report-YYYY-MM-DD.md  # Final combined report (dated)
```

## Scheduling

This skill can be called by:
- **Cowork Scheduled Tasks** — recurring (e.g. every Friday)
- **OpenClaw Cron** — sub-agent runs the skill, notifies via WhatsApp if critical findings
- **CI/CD** — run on every PR or weekly via GitHub Actions

## Fix Plan

After generating the report, prepare a step-by-step fix plan:

1. List all findings sorted by priority (critical first, then high, medium, low)
2. For each finding, include:
   - **What to fix**: clear description
   - **File(s)**: exact path(s) affected
   - **Difficulty**: 🟢 Easy (config change, dependency update) / 🟡 Medium (code refactor, logic change) / 🔴 Hard (architecture change, breaking change)
   - **Estimated effort**: quick (< 5 min) / moderate (5-30 min) / significant (> 30 min)
   - **Fix command or code**: the exact change to make
3. Present the plan to the user and ask which fixes to execute
4. Only apply fixes that the user explicitly approves
5. After each fix, re-run the relevant scanner to verify the fix worked

Save the fix plan to `.security/fix-plan-YYYY-MM-DD.md`.

## Future

When Claude Code Security becomes available, it can replace or augment Layer 4. The pipeline structure stays the same.
