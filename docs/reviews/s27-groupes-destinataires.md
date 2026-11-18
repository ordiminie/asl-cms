# Review s27-groupes-destinataires, round 3

> 18/11/2026, reviewer subagent, fresh context, read-only. Story diff `git diff main...feature/s27-groupes-destinataires`: e807e500 (story), 24f918a4 (fix C1), 6c1a4332 (round-2 review + design), 46388f3d (CI fix, test only), the last one read line by line as new code.

## Round 3

- **Round 1:** one critical, C1 — at delivery, `{parcelle}`, `{nom}` and the fiche count came from every active fiche at the address instead of the targeted ones (ADR 060 §2). Fixed in round 2 by ADR 061 (`campaign_recipient_profile`, frozen ∩ active), with m2 and m3.
- **Round 2 verdict:** Ship allowed: yes, max severity minor. n2 (design doc and mockup) fixed in the ship commit. n1, n3, m1, m4, m5 and m6 stayed open.
- **CI failure, run 44371415954 on PR #74:** 297 passed, 1 failed: `e2e/recipient-groups.spec.ts:514` (« critères 1 et 2 — impayés »), `expect(...).toBe(1)`, received 0 after 30 s, on the first run, retry1 and retry2. Test 3-7 passed on every retry.
- **What changed, commit `46388f3d`:** only `e2e/recipient-groups.spec.ts` (+60/-1) and `docs/plans/s27-groupes-destinataires.md` (task 14). No application code changed. The spec's `beforeAll` raises TechCorp's `campaign.daily_send_cap` to `100000` (upsert under `inTenantScope`, previous value saved); the `afterAll` runs `cleanUpRun()` in `try`, then in `finally` restores the old value or deletes the key.

## Diagnosis: confirmed with the CI evidence

The run's artifact (trace and screenshot of the failing test) shows:

- **Preview (retry1):** « les envois de campagne du jour sont déjà complets. La première part partira demain, le 19/11/2026 ».
- **Confirm dialog:** « 2 membres vont recevoir … en 1 jours : 2 le 19/11/2026 ».
- **Screenshot:** `LaunchedAlert` (`campaign-detail.tsx:173-189`), `first.day` = 19/11, 0/2 received, 2 scheduled.

The whole campaign was planned for tomorrow by `planCampaignParts` (`campaign-schedule-rules.ts:37-60`): `free = dailyCap − allotted[today]`, `allotted` from `getAllottedRecipientsByDayDao` (`campaign-repository.ts:374-410`). The cap is read fresh on every request, so a direct DB write is seen at once (`campaigns.spec.ts` relies on the same). `100000` is valid (`min: 1`, integer, no `max`).

**The email budget was ruled out:** `email.daily_send_limit` 300 − `email.login_reserve` 100 = 200 reportable sends per day (`email-service.ts:367-395`). Had it blocked, the campaign would have been planned today then deferred (`DeferredAlert`, `deferred_to`), and test 3-7 would have failed on a retry. With the fix the spec needs X + 4 sends, within what the run already held (X + 6).

**First-part delivery:** `partRunAfter(today, now)` returns `now`; `runImmediatePass` (`campaign-service.ts:802`) via `after()` sends with `nature: 'campaign'`.

## Critical

None.

## Major

None.

## Minor

### r1. The fix is not yet proven by CI

- `46388f3d` was not pushed at review time; task 14's own check is « la suite e2e verte en CI ».
- **Fix:** push and wait for the « Tests e2e (build de production) » job to go green before merging (manual merge mode).

### r2. The spec still silently depends on the email budget, and the 98 was never traced

- **Where:** `e2e/recipient-groups.spec.ts:369-421` and the test at :572.
- The per-tenant email budget (200 per day, in DB, not refunded) remains a shared dependency; a future spec sending tenant emails earlier could cause « 0 reçu » again, with `deferred_to` set. Something left `allotted[today] = 98` for TechCorp before the spec; the source was not found in the repo.
- **Fix (optional, test-only):** assert the launch banner says « aujourd'hui » before polling the outbox; trace the 98 (query `campaign_part` for TechCorp at spec start in CI).

### r3. The restore leaks on a hard worker crash or a parallel local run

- **Where:** `e2e/recipient-groups.spec.ts:381-421`.
- `previousCap` is module state: a worker dying without `afterAll` leaves the cap at 100000, and the next run would save and restore 100000. Locally, with `fullyParallel: true`, `campaigns.spec.ts` (sets `'2'`, then deletes the key) could interleave and leave TechCorp's cap at 2.
- **CI is not affected:** `workers: 1` on CI, files in alphabetical order, `campaigns.spec.ts` deletes the key first.
- The rest of the restore is correct (try/finally, `undefined` guard, rollback on a failed upsert, module re-import after a worker restart).
- **Fix (optional):** restore only if the stored value is still `RAISED_CAP`; otherwise accept as a documented limit (e2e run only in CI).

### r4. Small plan drift in the wording

- Task 14 cites `recipient-groups.spec.ts:514`; after the commit the test is at :572. Cosmetic.

### Observation (not a finding against this diff)

- `partRunAfter(today, now)` returns 02:00 Paris when `now` is before 02:00 Paris (`campaign-schedule-rules.ts:107-110`, ADR 053 §6): a CI run between 00:00 and 02:00 Paris would leave the first part waiting for the timer. Existing behaviour, also affects `campaigns.spec.ts`.

## Open minors carried from round 2

- **n1:** empty intersection (no frozen fiche still holds the address) not written in ADR 061, not unit-tested.
- **n3:** `insertRecipientProfilesTxnDao` `return []` on an email-key mismatch would silently fall back to the C1 behaviour; no live path today.
- **m1:** composite FKs for tenant coherence — separate cross-cutting ADR.
- **m4:** a read through a Server Action.
- **m5:** accepted plan deviations.
- **m6:** unpaid predicate inside the transaction, to revisit in s20.

## Checks (run by the reviewer)

- **`pnpm exec tsc --noEmit`:** exit 0, no output (`e2e/` covered by `tsconfig.json`).
- **`pnpm exec eslint e2e/recipient-groups.spec.ts`:** exit 0, no output.
- **`pnpm lint`:** `✖ 2 problems (0 errors, 2 warnings)`, exit 0; both warnings outside the diff (`.remember/tmp/last-ndc.ts`, `.scratch/check-migration.mjs`).
- **`pnpm test --run`:** not run — `46388f3d` touches no unit-tested file; round 2 results unchanged (full suite on a local-disk copy of 6c1a4332: `Test Files 405 passed (405)`, `Tests 5278 passed | 4 skipped (5282)`).
- **Not run, as instructed:** e2e and `pnpm build`.

## Verified OK

- **Scope:** `git show --stat 46388f3d` lists only the plan and the spec; no other commit since round 2.
- **RLS pattern:** every new read and write goes through `inTenantScope(a, …)`; no new `asMaintenance`, `app.bypass_rls` or `withRlsBypass`; queries filter on `organization_id = $1`.
- **SQL:** same upsert statement as `campaigns.spec.ts:946-950`; key matches `CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY` (`association-settings-types.ts:204`).
- **Types:** tsc green; `string | null | undefined` state used consistently.
- **No contradiction with AGENTS.md or the accepted ADRs** (« Rien en dur » applies to application code; `100000` is test data).

Max severity: minor
Ship allowed: yes
