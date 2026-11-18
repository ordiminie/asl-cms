# Review: s27-groupes-destinataires, round 2

> 18/11/2026, reviewer subagent, fresh context, read-only. Story diff `git diff main...feature/s27-groupes-destinataires`: commits e807e500 (story) and 24f918a4 (fix). The fix commit was read line by line as new code.

The fix resolves C1 and nothing in it blocks the ship. What remains is three minors: an undocumented edge case, a stale design doc, and a silent fallback that is safe today.

## Round 2

- **What round 1 found:** one critical, C1. At delivery, `{parcelle}`, `{nom}` and the fiche count came from every active fiche at the address, not only from the targeted ones. That contradicts ADR 060 §2. Round 1 also listed minors m1 to m6 (m1 schema-level tenant coherence of `recipient_group_member`; m2 group name in the URL after deletion; m3 e2e did not exercise the refusal of a foreign fiche; m4 a read through a Server Action; m5 acceptable plan deviations; m6 unpaid predicate inside the transaction, to revisit in s20).
- **What the fix does:** it follows the new ADR 061 and plan tasks 11 to 13.
  - **C1:** new table `campaign_recipient_profile`, under forced RLS. It is written in the same transaction as `campaign_recipient`, and delivery restricts to frozen ∩ active fiches.
  - **m2:** the URL now carries `?supprime=1` and the message is generic.
  - **m3:** an e2e forges a foreign fiche id inside the Server Action request.
- **Left on purpose, as recorded in the plan:** m1, m4, m5, m6.
- **Verdict on C1:** fixed, and pinned by unit and e2e tests that would fail on the round-1 code.

## Critical

None.

## Major

None.

## Minor

### n1. Edge case not written down: none of the frozen fiches still holds the address

- **Where:** `src/db/repositories/campaign-repository.ts`, `getPendingPartRecipientsDao`, around lines 505-526, plus the fallback branch of `parcelNumbers`.
- **Scenario:** an "impayés" campaign freezes {A} for address X. Before part 2, X is removed from A, while B (paid, not targeted) keeps X active.
  - `sameAddress` is [B], so `targeted` is empty and `profileIds` is empty.
  - `parcelNumbers` falls back to the carrier A's parcels, `accountName` is null and the count is 1, so `{nom}` is A's name.
  - The email still goes to X, with A's name and A's parcels.
- **This is consistent with the ADRs:**
  - ADR 057 says the line is delivered "si elle est encore active sur une fiche de l'association".
  - ADR 060 §2 only requires that `{nom}` and `{parcelle}` come from targeted fiches. A is targeted (it is the carrier).
  - The round-1 code was worse here: it mixed A's name with B's parcels.
  - So skipping is not required by any accepted ADR. Skipping would be a new arbitration: an address that no longer stands for any targeted fiche gets no email.
- **Related case, same sort:** A leaves X but a frozen sibling C still holds it. The email then has A's name with only C's parcels. This mix is inherited from s53 and is not new.
- **Gaps:** ADR 061 says nothing about an empty intersection, and no unit test pins this branch.
- **Required fix:** add one sentence to ADR 061 (or a follow-up ADR) stating the chosen behaviour; add a DAO test for the empty-intersection case; if the user prefers to skip, return `email: null` when a frozen set exists and `targeted` is empty.

### n2. The design doc and mockup still show the old deletion message

- **Where:** `docs/designs/s27-groupes-destinataires.md:83` and `docs/designs/s27-groupes-destinataires.html:334`.
- **Problem:** both contradicted `messages/fr.json` (`RecipientGroupsBureau.deleted`, "Groupe supprimé. Ses fiches n'ont pas changé.") and task 12.
- **Required fix:** update both so the design stays traceable.
- **Status at ship:** both updated by the orchestrator in the ship commit (docs only).

### n3. A missed email match silently falls back to the old C1 behaviour

- **Where:** `insertRecipientProfilesTxnDao`, `campaign-repository.ts:333-353`.
- **How it matches today:** inserted rows are matched back to their source by `emailKeyOf` (trim + lowercase). That is sound: `computeCampaignTarget` (`campaign-rules.ts:149`) groups by the same key, so recipients are unique by trim + lowercase, and `inserted.email` is the same string as `recipient.email`.
- **Weakness:** the uniqueness comes from the rules function, not from the DAO's own data. The database index `campaign_recipient_campaign_email_idx` is on `lower(email)` only, with no trim. If a key ever fails to match, `return []` writes no frozen rows for that line, with no error, and delivery falls back to "all fiches at the address", which is exactly the C1 bug.
- **No live failure path today.** Every recipient gets at least its carrier, because `sameAddressRowsOf` always includes it.
- **Suggested fix:** throw instead of `return []`, so a mismatch fails the transaction rather than hiding.

### Round-1 minors still open, as decided

m1, m4, m5 and m6 are unchanged and recorded in the plan. That is acceptable.

## Tests, lint, typecheck (run by the reviewer)

- **`pnpm test --run`, full suite:** `Test Files  3 failed | 402 passed (405)` and `Tests  3 failed | 5278 passed | 1 skipped (5282)`. All three failures are timeouts on the 9p mount:
  - `src/db/member-profile-email-backfill.test.ts`: "Test timed out in 5000ms" (reads the migrations, so relevant to the diff)
  - `src/app/[locale]/fonts.test.ts`: "Test timed out in 15000ms"
  - `src/lib/better-auth/magic-link-integration-imports.test.ts`: "Test timed out in 5000ms"
- **Those three files re-run alone:** `Test Files  3 passed (3)` and `Tests  13 passed (13)`.
- **Story-touched files re-run alone** (`rls-inventory`, `campaign-model`, `campaign-repository`, `campaign-service`, `recipient-groups` components, `bureau/groupes`): `Test Files  8 passed (8)` and `Tests  213 passed (213)`.
- **`pnpm lint`:** `✖ 2 problems (0 errors, 2 warnings)`. Both warnings are outside the diff (`.remember/tmp/last-ndc.ts`, `.scratch/check-migration.mjs`). Exit code 0.
- **`pnpm exec tsc --noEmit`:** exit code 0, no output.
- **Not run, as instructed:** e2e and `pnpm build`.

## Verified OK

- **Model** (`campaign-model.ts:224-242`): three NOT NULL columns, CASCADE on organization, `campaign_recipient` and `member_profile`, composite PK `(campaign_recipient_id, member_profile_id)`, as ADR 061 §1 requires.
- **Migrations:** 0067 matches the model; 0068 does ENABLE + FORCE + `tenant_isolation`, word for word the 0066 pattern; snapshot chain 0066 → 0067 (`prevId` 967b5c61) → 0068 (`prevId` ea552af0) intact; 0068 snapshot identical to 0067, as expected for `--custom`; journal idx 67 and 68; `main` stops at 0064, no numbering clash.
- **RLS:** `docs/architecture.md` classifies the table (lines 375 and 409; 52 tables, 33 scoped); `rls-inventory.test.ts` green; the e2e checks the table is invisible from tenant B and returns 0 rows without a scope; no new `withRlsBypass`; every access goes through `getDb()`.
- **Same transaction:** creation runs in `sendCampaignService` → `withTenant` → `createCampaignWithRecipientsTxnDao`. Delivery reads frozen rows inside the existing `withTenant` (`campaign-service.ts:1059-1064`).
- **Frozen set for each recipient:** `[...new Set(sameAddressRowsOf(rows, row, isTargeted).map(…))]`. For "tous", every fiche at the address (ADR 061 §3). The service test pins both UNPAID → [A] and ALL → [A, E].
- **Delivery logic:** `profileIds`, `parcelNumbers`, `addressProfileCount` and `accountName` come from frozen ∩ active; `unsubscribed` is still `sameAddress.some(...)` over every fiche at the address (ADR 057), pinned by a DAO test; with no frozen rows, delivery behaves as before (existing s26/s53/s54 delivery tests pass).
- **The new DAO test** would fail on the round-1 code (it would get `['12','27']` and a count of 2).
- **"Tous les membres" and s26 delivery by parts:** no regression in unit tests; `createCampaignWithRecipientsTxnDao` has one caller and typecheck enforces `memberProfileIds`.
- **m2:** flag `'1'`, any other value shows nothing (page test); `router.push('/bureau/groupes?supprime=1')` pinned (`recipient-groups.test.tsx:262`); the e2e asserts the URL does not contain the group name.
- **m3 e2e is sound:** spec in `mode: 'serial'`, CI with 1 worker; the route only rewrites a POST with a `next-action` header containing the id; same-length UUIDs; `forged` is asserted, so a never-rewritten request fails loudly; the group still holds only `ficheIds.first` afterwards.
- **e2e outbox for C1:** unpaid fiche and a "Payée" fiche share one address; asserts only `P-<run>` and the targeted name, and the absence of `R-<run>` and of the paid fiche's name.
- **Labels:** the changed label lives in `messages/fr.json`; no hardcoded text added.

Max severity: minor
Ship allowed: yes
