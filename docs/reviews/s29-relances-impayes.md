# Review s29-relances-impayes — round 2

> Branche `feature/s29-relances-impayes` : commit de story `ca17486d` + commit de correctif `e13f9b7f`.
> Subagent `reviewer`, contexte neuf, lecture seule. Le correctif est relu comme du code neuf
> (`git show e13f9b7f`) puis recontrôlé sur le diff entier `git diff main...feature/s29-relances-impayes`.

The story can ship. Both items the user asked to fix are fixed, and the new tests pin them (each fix was
broken on purpose and the new tests failed). The fix brings no critical or major issue; it adds two new
minors, and the five open minors from round 1 stay open for the final round, as agreed.

## Round 1, and what was fixed

Round 1 (commit `ca17486d`) ended `Max severity: major`, `Ship allowed: yes`. Arbitration of 23/11/2026:
« Corriger avant la PR » — fix MAJOR 1 and MINOR 2, the other minors go to the final round (plan task 12).

| Round 1 | Decision | Status after `e13f9b7f` |
| --- | --- | --- |
| MAJOR 1: raw key `CampaignsBureau.templateNames.unpaid_reminder` in the campaign list and detail | fix | **Fixed** |
| MINOR 2: daily job enqueued only when the setting goes from off to on | fix | **Fixed** |
| MINOR 1, 3, 4, 5, 6 | final round | **Still open** (below, not blocking) |

### MAJOR 1 — verified fixed

- `messages/fr.json`: `CampaignsBureau.templateNames.unpaid_reminder = "Relance automatique"`, next to the
  other five keys. Read by `campaign-list.tsx:142` (row), `:171` (mobile card), `campaign-detail.tsx:617`.
- Tests: `campaign-list.test.tsx` checks the « Modèle » cell and the `campaign-card`;
  `campaign-detail.test.tsx` checks « Modèle » + « Relance automatique » in « Résumé ».
- Mutation check: with the key removed, both tests fail (`2 failed | 43 passed`).

### MINOR 2 — verified fixed

`unpaidRemindersEnabledAfterSave` (`src/app/[locale]/(bureau)/bureau/reglages/actions.ts:100-106`) uses the
submitted value when the key is in the form, otherwise the stored value. Checked against every save path:

- partial forms (`association-settings-form.tsx:189-207`, `changesToSend`): untouched checkbox → stored value;
- disable: `'false'` or `''` → no enqueue; `parseBoolean` accepts only `'true'`/`'false'`;
- rejected save returns before the check; thrown save is caught → no enqueue;
- `scheduleUnpaidRemindersService` (`unpaid-reminder-service.ts:281-293`) re-reads the settings and returns
  when off — second safety net;
- idempotence: `enqueueScheduledJobTxnDao` (`scheduled-job-repository.ts:45-60`) `onConflictDoNothing` on
  `(organizationId, kind, idempotencyKey)`, key = the day; a broken chain resumes the next day;
- scheduling errors are logged without the message, the save still succeeds (tested);
- `campaign.manage` and `association.settings.update` share `defaultRoles` `['owner','board']`: no
  authorization noise on the new path.
- Mutation check: with the old off→on logic restored, 2 of the new action tests fail (`2 failed | 27 passed`).

### Unplanned change — `CampaignDTO.templateId` widened to `CampaignSendKind | null`

Needed for the new tests to typecheck, and matches runtime (`toCampaignDto` already returned
`unpaid_reminder`). Every consumer checked: the composer and campaign actions use their own
`CampaignTemplateId`; validation is still `z.enum(CAMPAIGN_TEMPLATE_IDS)` (`campaign-validation.ts:40,100`), so
the composer still cannot accept `unpaid_reminder`. The only DTO readers are the three `templateNames`
lookups. No `switch`/`Record` keyed by the DTO field. `tsc --noEmit` exits 0. Justified, type-only drift from
task 12.

### e2e changes

- Only `campaigns.spec.ts` and `unpaid-reminders.spec.ts` run the scheduler script; the in-app immediate
  pass (`runImmediatePass`, `campaign-service.ts:951`) only claims `campaign.deliver_part`.
- Specs saving TechCorp settings (`association-settings`, `contact`, `email-budget`, `fonts-hebergees`,
  `incident-report`, `pennylane-invoices`, `rate-limit`, `seo`, `campaigns`, `unpaid-reminders`) now leave a
  reminder job; both scheduler specs delete them first (`campaigns.spec.ts` `runScheduler()` async, three
  call sites awaited at `:1092`, `:1101`, `:1145`; `unpaid-reminders.spec.ts` `beforeAll`).
- Deletion scoped to TechCorp + `kind = 'billing.unpaid_reminders'`, through the usual e2e maintenance
  pattern (`set_config('app.bypass_rls','on', true)` in a transaction, as in `campaign-letters`,
  `email-budget`, `pennylane-invoices:255`) — not a new `withRlsBypass` in application code.
- `backup-restore` compares snapshots; `scheduled_job` counts filter by kind or count under RLS. No other
  spec found at risk with CI `workers: 1`. Not run (CI only).

### Round 1 verified list — no regression

The fix touches only its 10 files; `campaign-rules.ts` is a type-only cast. Idempotence, « une à la fois »,
the delivery re-check, the shared `createCampaignInTenant`, migrations and RLS, authorization, ADR 010 and
the budget paths are unchanged.

## New findings

### MINOR 7 — comments out of date for « garantie à chaque enregistrement »

`src/services/unpaid-reminder-service.ts:276-280` still says « appele apres le passage de
`billing.reminder.enabled` a vrai »; ADR 070 §4 says « garantie quand le réglage passe à "activé" ». The new
behaviour is a superset, not a contradiction. Fix: update the doc comment; mention the wider rule in the PR
(ADRs are immutable).

### MINOR 8 — e2e cleanup racy under parallel e2e runs

`e2e/campaigns.spec.ts`, `dropUnpaidReminderJobs` then `runSchedulerProcess`: with `fullyParallel` and several
workers (local default; CI uses 1), a concurrent settings save could bring the job back before the scheduler
runs. No effect in CI today. Fix if local parallel runs matter: serial project for scheduler specs, or a
`kinds` filter on the scheduler script.

## Open minors carried over from round 1 (final round)

- **MINOR 1** — « Relance automatique » label missing in `EmailSendingBureau.pending` (`/bureau/envois`).
- **MINOR 3** — reminder subject cap ignores the association prefix (`association-settings-types.ts:737`).
- **MINOR 4** — disabled with empty delays: `[0,0,0]`, each rank shows the due date
  (`unpaid-reminder-service.ts:499-500`).
- **MINOR 5** — « Email » channel shown for a member whose only addresses are unsubscribed, nature
  `facultative` (`membersOf`, `unpaid-reminder-service.ts:445`).
- **MINOR 6** — avoidable queries (`readRankCampaigns`, `readReminderInvoices`).

## Test results (reviewer, local-disk copy, HEAD `e13f9b7f`)

- `pnpm test --run`: `Test Files  446 passed (446)`, `Tests  6101 passed | 4 skipped (6105)`, 270.96 s,
  0 « timed out ». Round 1's `pages-list` flake did not come back.
- Mutation checks restored afterwards; the three touched test files give `Tests 74 passed (74)`.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm lint`: 0 errors; 2 warnings in untracked local files outside the diff.
- `pnpm build` and e2e not run (CI only).

Max severity: minor
Ship allowed: yes
