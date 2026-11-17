# Review — s54-adresses-email-multiples (round 6)

Diff reviewed: `git diff main...feature/s54-adresses-email-multiples`, committed HEAD 7ec199b5 — 43242a0b
(story), 3e647ceb, cf14e6f3, f2bc58e2, 7ec199b5 (fix round 4, read as new code). Uncommitted working-tree changes
ignored. Reviewer: `reviewer` subagent, fresh context, read-only.

## Previous rounds

- **Round 1** (43242a0b): blocked — C1 critical (a person removed by the bureau regains access by confirming a
  pending address they added), M1 (clear token in `deferred_email`), M2 (wrong nature label), m1–m6. Fixed in
  3e647ceb, except m2, m5, m6 (left by decision).
- **Round 2** (3e647ceb): ship allowed, max major — MA1 (public `revoked` copy disclosing a third party's status),
  mi1–mi5. Arbitration: fix before shipping. cf14e6f3 fixed MA1, mi1, mi3, mi4; mi2, mi5 left.
- **Round 3** (cf14e6f3): blocked — C1-bis critical (mi3's re-attribution reopened C1 on bureau edit), MA2 (deferred
  link lost on retry), mi-a, mi-b. Arbitration: revert mi3. f2bc58e2 fixed all four.
- **Round 4** (f2bc58e2): ship allowed, max major — MA-r4 (an account linked to a profile without a `member` row
  was never cut off, its pending additions stayed activable), mi-r4. Arbitration: fix before shipping. 7ec199b5
  fixed both.

## What the reviewer ran

- Local-disk copy of committed HEAD 7ec199b5 (`git archive`, node_modules symlinked): `pnpm test --run` →
  `Test Files 382 passed (382)`, `Tests 4847 passed | 4 skipped (4851)`, exit 0, no timeout.
- `tsc --noEmit` on the copy (no `.next`): exit 0. eslint on the 12 source files of 7ec199b5: exit 0.
- No e2e, no build (CI).

## Checklist (templates/review-checklist.md)

| Item | Verdict |
| --- | --- |
| Plan compliance | yes — "Fix round 4" (MA-r4 (a), MA-r4 (b), mi-r4) fully in the diff, nothing beyond; no UI touched |
| No invented API | yes — `getUserOrganizationDao(userId, organizationId)` (`organization-repository.ts:185`, `getDb()`; `member` has no RLS policy and the query filters on `organizationId`, so the public page and the cron read it correctly), `updateDeferredEmailConfirmationTokenHashTxnDao` (`.returning({id})`, returns `row !== undefined`), `replaceMemberAccount`, `unlinkProfileAccount`, `deletePendingEmailsAddedByDao`, `applyMemberAccountDecision` |
| No plausible-but-wrong logic | yes |
| Code matches its claims | yes |
| Repo conventions (AGENTS.md) | yes — `getDb()`, `withTenant`, no new `withRlsBypass`, nothing hard-coded (delay from `getMemberEmailConfirmationDays`), functional style |
| No accepted ADR contradicted | yes — ADR 053 §4 (deferred lifecycle, refund), ADR 054 §4/§6 (shared accounts, `member` row leaves with the last profile), ADR 056 §5 (author still linked, now also still a member); ADR 057 untouched |
| Design system / screen intent | yes — 7ec199b5 touches no UI; the screens were judged in earlier rounds |
| Test suite run by the reviewer, passing | yes, 4847 |
| Assertions pin the criteria | yes — see below |
| No regressions | yes on the touched paths; default `getUserOrganizationDao` mocks return a member, so earlier scenarios keep their assumptions |

## Round-4 findings

- **MA-r4 (a) — closed.** `profileIdsOfMemberAuthor` returns an empty set when the author has no `member` row, so
  `pendingRowsStillAuthored` drops their rows. `stillAuthoredPendingRows` is the single filter of the three
  activation-by-link paths (page state, confirmation, deferred rotation, `email-service.ts:1610`). The only other
  caller of `activatePendingEmail` is the bureau's own edit, authorised under `member.profile.manage`.
- **MA-r4 (b) — closed.** `member-account-rules.ts:55`: `open` only if `linkedRole === null &&
  !previousAccountLinked`. Callers: bureau edit (`previous !== undefined`), removal (`account !== undefined`;
  emptied address → `unlink` regardless), profile creation (`false`); no other caller. s53/s54 behaviour
  re-checked: shared account (only this profile unlinked, `member` row kept), no `member` row (role `member`, no
  row deleted), `link_shared` still before `replace` (new test), unlink on emptied address unchanged (new test),
  board/owner refusal and role move unchanged, bureau edit of a pending row consistent.
- **mi-r4 — closed.** Rotation writes the deferred row's hash first, in the same `withTenant` transaction; if not
  written it returns `not_sending`, no pending row touched; the caller refunds the unit, logs only `jobId`, keeps
  the row and returns `failed`. Consistent with s52: a claimed row stops being `sending` only through the
  stale-lock takeover (`markDeferredEmailToVerifyTxnDao`, which also clears the hash) — `to_verify` is never
  resent and is checked by hand; the refund avoids double counting; pending rows keep a hash whose token was never
  sent, so nothing can be activated by mistake.

Pinning tests: `member-email-replaced-author.test.ts` (O unlinked, N linked, pending rows emptied; `invalid` on
read and confirm; `getUserOrganizationDao` called with `(O_USER_ID, ORG_ID)`), `deferred-email-delivery.test.ts`
(mixed authors: only the member author's row rotated; `not_sending`: no send, refund, no delete, `failed`),
repository test (`returning "id"`, true/false), four pure-rule tests for `previousAccountLinked`.

## End to end

- No removed, unlinked or non-member author can get a pending address activated: removal or edit by the bureau
  unlinks and deletes the pending rows; unlinked authors are filtered per row's profile; authors without a
  `member` row are filtered at read, confirm and deferred rotation; author-less rows are never activable. The
  check re-runs at click time, under the caller's tenant.
- No clear token is persisted: only `hashConfirmationToken(token)` is written (pending rows and
  `deferred_email.confirmation_token_hash`); the deferred row keeps placeholders; the clear token exists only in
  the email being sent; `transmitWithinBudget` stores nothing again; the new log line holds only `jobId`.

## Findings

### Critical

None.

### Major

None.

### Minor

- **Bureau re-save restores a `member` row** — `member-profile-email-service.ts` (update) with
  `member-account-service.ts` `replaceMemberAccount`. When the bureau re-saves the same address (or only its case)
  on a profile whose linked account has no `member` row (e.g. after `removeUserFromOrganizationService`), the path
  goes through `replace` → `ensureMembership`, which gives the `member` row back. Not new (before 7ec199b5: `open`
  → `createMemberIfAbsentTxnDao`, same effect); follows ADR 037 ("access follows the address") and needs an
  explicit bureau action. Noted only.
- Left by decision in earlier rounds: m2 (pre-s53 duplicates: "already unsubscribed" message, nothing sent), m5 (no
  per-member throttle on confirmation emails), m6 (no row lock on confirmation, idempotent), mi2 (two deferred
  links on the same row), mi5 (database error during replay loses the email).

## Round 6 — CI e2e fix (6c4417aa)

GitHub CI on PR 71 (HEAD e9d16c0c): e2e 1 failed / 11 did not run (serial file) / 273 passed. Failure, identical on
3 attempts: `e2e/member-accounts.spec.ts:711` (s16 criteria 1 and 4) expected the member's email inside the
« Mes coordonnées » region; received "Mes coordonnéesTéléphoneNon renseignéAdresse postale5 impasse des Bruyères
33680 LacanauModifier mes coordonnées". 6c4417aa (e2e only, +9/−5) updates that test and s16 C7 (same stale
expectation, hidden by the serial mode) and hoists the `myEmails` locator. Reviewed by the `reviewer` subagent,
fresh context, read-only.

- **Diagnosis confirmed: the test was stale, the app is right.** Design screen 1 (l.51-53): « Mes coordonnées »
  loses its read-only Email pair (ADR 040 replaced by ADR 056). On main `my-contact-card.tsx` rendered the email
  pair; on HEAD `ContactReading` renders phone and address only — exactly the CI text. In scope of plan task 11.
- **Assertions not weakened.** Locator names match the real accessible names (« Mes coordonnées »,
  « Mes adresses email »), no colliding region (the loading skeleton is replaced by Suspense). Each
  `not.toContainText(email)` runs after a positive check on rendered-only content ('Adresse postale',
  '3 rue du Lavoir'); the email is asserted in `myEmails` first. Screen 1 is now pinned in both directions.
- **The 11 tests that never ran**, read one by one (s16 crit. 2/3/C7, six s53, s54 crit. 1/2/4/5/10 and 8): every
  asserted string exists in `messages/fr.json`, `NoticeAlert` is `role="status"`, `markerLands` unchanged,
  `storedContactOf` reads the active holder from `member_profile_email`. Remaining risk is only what CI can show
  (timing, outbox delivery).
- Ran: `pnpm lint` 0 errors; `tsc --noEmit` exit 0 on a `git archive HEAD` copy. Unit suite not rerun
  (e2e-only commit). e2e: CI only — **merge only after CI's e2e passes on this commit**.

New minor findings:

- `messages/fr.json`: dead keys `MemberSpacePage.contact.email`, `emailNote`, `contact`; `emailNote` ("…Pour la
  changer, écrivez au bureau.") contradicts s54 but never renders.
- `e2e/member-accounts.spec.ts:691` and s16-era JSDoc comments (`dashboard/actions.ts:17`,
  `member-profile-form-validation.ts:229`, `member-profile-repository.ts:501`, `member-space-service.ts:201`,
  `member-space-types.ts:69`) still cite ADR 040 without mentioning ADR 056.

Round 5's open minors carry over unchanged.

Max severity: minor
Ship allowed: yes
