# Review s29-relances-impayes — round 6 (short round on `ce66303a`)

> Branch `feature/s29-relances-impayes`, HEAD `ce66303a` (fix for plan task 16, CI of 23/11, run 120112870061).
> `reviewer` subagent, fresh context, read-only. Short round: this commit read as new code, against task 16 of
> `docs/plans/s29-relances-impayes.md`, plus a trace of the two scheduler handlers for request-only APIs.

**Verdict:** `ce66303a` fixes the product defect CI found. `readReminderInvoices` no longer needs a Next request. The
tests prove the fix and would fail on the old code. I traced both scheduler handlers (`billing.unpaid_reminders`,
`campaign.deliver_part`) and neither reaches any other request-only API. No new finding. Only the minors kept for the
final round remain. CI still has to confirm the e2e at `unpaid-reminders.spec.ts:746`.

## History

- **Round 1** (`ca17486d`): max major (missing `templateNames.unpaid_reminder`). Fixed in `e13f9b7f`.
- **Round 2** (`e13f9b7f`): max minor, Ship allowed yes; minors 7, 8. PR 82 opened.
- **PR 82 CI, 23/11**: `unpaid-reminders.spec.ts:362` (`[]`, then FK error in `afterAll`), `campaigns.spec.ts:1601`
  (an intended new list item); `campaigns.spec.ts:622` flaky, unrelated to s29 (already seen 20/11).
- **Round 3** (`90f4713b`): CRITICAL. Status lists written by SQL were overwritten by the form's cached copy. Minors 9–12.
- **Round 4** (`2c6f9ea0`): CRITICAL. The stored body comes back CRLF but the assertion expected LF. Minors 13–15.
- **Round 5** (`01b7f4bc`): no finding, Ship allowed yes.
- **PR 82 CI, 23/11, run 120112870061**: 329 passed, 1 failed (`unpaid-reminders.spec.ts:746`). The scheduler script
  logged `[CAMPAIGN] Factures de la relance illisibles` because `getTranslations` (`next-intl/server`) throws outside a
  request. This is a product defect: in production no reminder would ever be sent. Became plan task 16.
- **Round 6** (`ce66303a`): this report.

## Findings

None.

## Verification of task 16

### 1. The fix is correct

- `src/services/unpaid-reminder-invoices.ts` now uses `createTranslator` from `next-intl`, with
  `messages: MESSAGES[PRODUCT_LOCALE]`, `MESSAGES: Record<SupportedLocale, typeof fr> = {fr}` and `fr` from
  `../../messages/fr.json`. This is the same pattern as `getCampaignFooterTexts`
  (`src/lib/emails/campaign-email.tsx:1,23,70,87-91`).
  - `SupportedLocale` and `PRODUCT_LOCALE` exist in `src/lib/helper/locale-helper.ts:5,12`.
  - `resolveJsonModule: true` is set in `tsconfig.json`.
  - `createTranslator` is synchronous, so dropping the `await` is right.
- The namespace `UnpaidReminders.invoiceList` exists (`messages/fr.json:4921-4924`):
  - `line` takes `{subject}`, `{parcelNumber}`, `{amount}`, `{dueOn}`.
  - `lineWithoutParcel` takes `{subject}`, `{amount}`, `{dueOn}`.
  - `lineOf` passes `{...values, parcelNumber}` and `values` (`UnpaidInvoiceLineValues` minus `parcelNumber`:
    `subject`, `amount`, `dueOn`, from `unpaid-reminder-rules.ts:129-134`). The ICU arguments match exactly, and every
    value is a plain string.
- Number and date formatting is unchanged. `formatUnpaidInvoicesList` (`unpaid-reminder-rules.ts:141-155`) is not
  touched by the commit: the amount still comes from `formatAmountCents` and the date from `formatReminderDay`, both
  computed before the translator runs.

### 2. The tests prove the fix

- In the services project, the global setup mocks only `next-intl/server` (`src/services/__tests__/setup-mocks.ts:28-30`).
  `next-intl` itself is real, so `createTranslator` runs against the real `fr.json`.
- In `unpaid-reminder-delivery.test.ts`, `beforeEach` now makes `getTranslations` reject with "hors d'une requête
  Next". This simulates the scheduler.
- The existing assertions at `:276` and `:279` check real French lines with a parcel. The new test at `:285-301` checks
  the line without a parcel, `markRecipientSentTxnDao('r1')` and `{status: 'completed'}`.
- On the old code, `await getTranslations(...)` would reject, `readReminderInvoices` would throw,
  `deliverCampaignPartService` would take the `illisibles` branch and fall to `failedAttemptOutcome`, and nothing would
  be sent. All three tests would fail. The test pins the fix.

### 3. No other request-only API on the scheduler paths

I computed the import closure of `scheduled-job-service-facade.ts` (229 files) and then traced the call paths of both
handlers.

- **`runUnpaidRemindersJobService`** (`unpaid-reminder-service.ts:219-267`) calls:
  - `getAssociationSettingsService`: DAO under `withTenant` only; the s29 diff adds only validation in the update path.
  - `readProfilesAndInvoices`: the billing provider.
  - `listUnpaidRemindersDao`.
  - `createDueRank`, which calls `createCampaignInTenant` (`campaign-service.ts:659-741`): DAOs and
    `enqueueScheduledJobTxnDao`, with no `getAuthUser`, `after()`, `updateTag` or `revalidate*`.
  - `enqueueNextDay`.
  - `getAuthUser` is only used in `requireCampaignManager` (`:102-110`), which this handler never calls.
- **`deliverCampaignPartService`** (`campaign-service.ts:1213-1276`) calls:
  - `isClientEmailEnabledService` and `sendEmailService` (`email-service.ts:418-453`). Their helpers sit at `:155-400`,
    and the file's `getTranslations`/`getLocale` calls all start at `:470`, in the user and subscription emails.
    `email-service.ts` is also not part of the story diff.
  - `readAssociationWithSettings`.
  - `readReminderInvoices`: fixed.
  - `deliverToRecipient`, then `composeRecipientEmail`, then `buildCampaignEmail`: `getCampaignFooterTexts` (via
    `createTranslator`), `renderCampaignBodyHtml`, `renderCampaignText`, `substituteInvoicesList`.
- Across `campaign-service.ts`, `unpaid-reminder-service.ts`, `unpaid-reminder-invoices.ts` (only a comment mentions
  `next-intl/server`), `association-settings-service.ts`, the repositories touched and the rules touched, there are no
  hits for `next-intl/server`, `next/headers`, `next/cache`, `getLocale`, `headers()` or `cookies()`.

### 4. `campaign-letter-service.test.ts` is not weakened

The old assertions matched the JSON echo of the mock translator (`"parcelNumber":"3"`). That mock no longer applies,
because the list now uses the real `createTranslator`. The new assertions are stronger:

- the full French line for letter 1;
- `parcelle 14 :` present and `parcelle 3 :` absent for letter 2, so the per-letter isolation is still pinned.

The `listInvoicesOf` call assertion is unchanged.

### Plan conformity

Task 16 is fully done: the cause is fixed, the test is no longer mocked for this path (it is stricter than asked: the
mock rejects), and the paths were checked. The e2e spec is unchanged, as the plan says. Nothing in the commit falls
outside task 16.

## Open minors carried over (final round)

- MINOR 1: the « Relance automatique » label is missing in `EmailSendingBureau.pending`.
- MINOR 3: the subject cap ignores the association prefix (`association-settings-types.ts:737`).
- MINOR 4: when disabled with empty delays, the delays are `[0,0,0]` and each rank shows the due date
  (`unpaid-reminder-service.ts:499-500`).
- MINOR 5: the « Email » channel is shown for a fiche whose only addresses are unsubscribed (`membersOf`).
- MINOR 6: avoidable queries (`readRankCampaigns`, `readReminderInvoices`).
- MINOR 7: the doc comment at `unpaid-reminder-service.ts:275-280` is out of date.
- MINOR 8: the scheduler-spec cleanup is racy when local e2e runs in parallel.
- MINOR 11: the replay test passes without proving `submissionId` uniqueness (unit tests cover it).

## Checks run

- `pnpm test --run src/services/__tests__/unpaid-reminder-delivery.test.ts src/services/__tests__/campaign-letter-service.test.ts`:
  `Test Files 2 passed (2)`, `Tests 30 passed (30)`.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm lint`: 0 errors. The 2 warnings are in untracked files outside the diff (`.remember/tmp/last-ndc.ts`,
  `.scratch/check-migration.mjs`).
- Full suite not rerun by the reviewer. Implementer, local-disk copy: `Test Files 446 passed (446)`,
  `Tests 6102 passed | 4 skipped (6106)`.
- No build, no e2e (CI only). The fix for `unpaid-reminders.spec.ts:746` still needs a CI run to confirm it.

Max severity: none
Ship allowed: yes
