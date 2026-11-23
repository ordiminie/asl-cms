# Review s29-relances-impayes — round 5 (short round on `01b7f4bc`)

> Branche `feature/s29-relances-impayes`, HEAD `01b7f4bc` (correctif revue 4, tâche 15). Subagent
> `reviewer`, contexte neuf, lecture seule. Tour court décidé par arbitrage (23/11/2026, « Corriger puis
> CI ») : relecture de ce commit comme du code neuf, plus `e2e/unpaid-reminders.spec.ts` en entier ; la CI
> tranche ensuite par une vraie exécution.

**Verdict:** `01b7f4bc` fixes the round-4 CRITICAL 1 and MINORS 13, 14, 15. No new finding. Nothing validated in
rounds 3 and 4 regressed. Only the minors kept for the final round remain. CI still has to confirm the e2e run.

## History

- **Round 1** (`ca17486d`): max major (missing `templateNames.unpaid_reminder`). Fixed in `e13f9b7f`.
- **Round 2** (`e13f9b7f`): max minor, Ship allowed yes; minors 7, 8. PR 82 opened.
- **PR 82 CI, 23/11**: `unpaid-reminders.spec.ts:362` (`[]`, then FK error in `afterAll`), `campaigns.spec.ts:1601`
  (intended new list item); `campaigns.spec.ts:622` flaky, unrelated to s29 (already seen 20/11).
- **Round 3** (`90f4713b`): CRITICAL — status lists written by SQL, overwritten by the form's cached copy. Minors 9–12.
- **Round 4** (`2c6f9ea0`): CRITICAL — stored body comes back CRLF, assertion expected LF. Minors 13–15.
- **Round 5** (`01b7f4bc`): this report.

## Findings

None.

## Status of round-4 findings

### CRITICAL 1 — fixed

`normalizeLineEndings` (`unpaid-reminders.spec.ts:332`) and `normalizedSettings` (`:334-340`) apply to the values
`storedTouchedSettings` reads (`:350`); the expected body is normalized too (`:627`). Holds whether the server stores
CRLF or LF. No other multiline comparison in the spec; the multiline seed status lists only appear in the `afterAll`
comparison, normalized on both sides.

### MINOR 13 — fixed

Against `src/components/features/unpaid-reminder/unpaid-reminders-overview.tsx`: 5 `TableHead` (Membre, Parcelle,
Facture, Relances, Envoi — `messages/fr.json:4896-4902`), « Envoi » at index 4; 5 `TableCell` per row, same order;
mobile cards are a `ul` outside the `table` (`sm:hidden`), CI projects desktop only; single `table` on the page;
`Channel` renders `<span>Email</span>` or a `Badge` « Courrier » (`fr.json:4906-4909`), exact `toHaveText`; headers
read after the table is awaited. Fiche renamed `Brunet ${MARKER}`.

### MINOR 14 — fixed

`originalSettings` is `Record | null`, set only in `beforeAll` (`:522`); no restore when `null` (`:577-584`),
`deleteRunData` still in `finally`. DB check after restore against `normalizedSettings(original)`.
`deleteSettingsAbsentFrom` (`:391-401`) only deletes `TOUCHED_KEYS` absent from the snapshot, scoped to TechCorp under
`inTenantScope`, no-op in CI (seed `'true'`). Known limit documented: the cache may hold `'false'` for a boolean deleted
by SQL — harmless (default), not reached with the seed.

### MINOR 15 — fixed

The scheduler script has no kind filter (`run-scheduled-jobs.ts`): the filter is only in the spec's wait condition
(`jobsOf(ids, kind)`), consistent with tests 2 and 4. `payload->>'campaignId'` matches the enqueue code
(`campaign-service.ts:724-729`); kind `campaign.deliver_part` (`scheduled-job-types.ts:71`). Open jobs made due cover
the 00:00–02:00 Paris case (`campaign-schedule-rules.ts:103`). `toEqual(['sent'])` correct (« 1 sur 3 » counts
reminders whose campaign has a `sent` recipient, `unpaid-reminder-repository.ts:58,107`). Residual risks surfaced by
the diagnosis, not hidden: client email off (`released`), daily cap reached (`deferred`, unlikely: `email-budget.spec.ts`
restores the counter), outbox unaffected (only `water-analysis.spec.ts` runs after). Precedent:
`campaigns.spec.ts:890-950`. Test 9 timeout `SCHEDULER_TEST_TIMEOUT_MS` (330 s).

## Rounds 3–4 regressions and tests 1–6 consistency

Test 1 unchanged apart from normalization; tests 2 and 4 `jobsOf(ids, JOB_KIND)` = former `reminderJobsOf`; test 9
gains delivery and exact cell checks; tests 3 and 6 unchanged; cleanup order (restore, absent keys, SQL in `finally`)
consistent with the FK order validated in round 3. Task 15 fully implemented, nothing outside it.

## Open minors carried over (final round)

- MINOR 1 — « Relance automatique » label missing in `EmailSendingBureau.pending`.
- MINOR 3 — subject cap ignores the association prefix (`association-settings-types.ts:737`).
- MINOR 4 — disabled with empty delays: `[0,0,0]`, each rank shows the due date (`unpaid-reminder-service.ts:499-500`).
- MINOR 5 — « Email » channel shown for a fiche whose only addresses are unsubscribed (`membersOf`).
- MINOR 6 — avoidable queries (`readRankCampaigns`, `readReminderInvoices`).
- MINOR 7 — doc comment `unpaid-reminder-service.ts:275-280` out of date.
- MINOR 8 — scheduler-spec cleanup racy under parallel local e2e.
- MINOR 11 — the replay test passes without proving the `submissionId` uniqueness (covered by unit tests).

## Checks run

- `pnpm exec tsc --noEmit`: exit 0. `pnpm lint`: 0 errors (2 warnings in untracked files outside the diff).
- Unit tests not rerun: no product code changed since round 2 (`Tests 6101 passed | 4 skipped (6105)`, local-disk copy).
- No build, no e2e (CI only).

Max severity: minor
Ship allowed: yes
