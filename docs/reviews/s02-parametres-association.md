# Review — Story s02-parametres-association

> Second fresh-context review by the `reviewer` subagent, 2026-09-19, on
> `git diff main...feature/s02-parametres-association` (69 files, three commits: `1bf5803` migration only —
> allowed by the plan —, `e93ddaf` story, `c6db1cd` fixes for M1 and m4 of the first review).
> The first review (same day) ended `Max severity: major` / `Ship allowed: yes`; the user asked to fix M1 and m4
> before shipping and explicitly declined m9. Issues classified critical / major / minor.

## Commands run by the reviewer

- **Unit tests:** `pnpm test --run` → **Test Files 53 passed | 2 skipped, Tests 694 passed | 8 skipped**. The
  skipped ones predate the story. One more test file and seven more tests than the first review.
- **Typecheck:** `tsc --noEmit` with a temporary config excluding `.next` (deleted afterwards) → no errors.
- **Lint:** `pnpm lint` → 0 errors; one warning in `.remember/tmp/last-ndc.ts`, outside the story.
- **Rules check:** `pnpm check:rules` → « Règles et documentation alignées sur le code ».
- **Migrations:** `drizzle-kit check` → "Everything's fine"; journal lists 0006 (generated) and 0007 (`--custom`).
- **e2e not run:** no Chromium in the container; `e2e/association-settings.spec.ts` judged by reading. It must
  pass in CI on the PR.
- **No changes made** by the review: no source code modified.

## The two fixes, checked

**M1 — form on react-hook-form + zod: fixed.** `association-settings-form.tsx` uses `useForm` with
`zodResolver(createAssociationSettingsFormSchema(definitions))`, `mode: 'onBlur'`, re-validation on change; one
`Controller` per field; server refusals shown with `form.setError`. The schema
(`association-settings-form-validation.ts`) is a `z.object` of `z.string()` plus a `superRefine` calling
`validateSettingsChanges`: the browser applies the same registry rules as the server, each error carries the
registry code, translated at display. Dotted registry keys are encoded (`encodeURIComponent` plus `.`→`%2E`) and
decoded back exactly; a unit test proves the round trip without collisions. Imports (`zodResolver`, `Controller`,
`useWatch`, `FieldErrors`) exist as used; the resolver is already used by the provisioning form; tsc green. Same
rendered markup as before: design conformity from the first review still holds.

**m4 — a never-set default is no longer written: fixed.** `changesToSend` only sends a key already stored or
changed by the user. Risky side checked: the server action does not treat a missing key as « empty, so delete » —
`settingsPageChanges` in `bureau/reglages/actions.ts` filters with `formData.has(definition.key)`. Three new tests:
untouched boolean or choice not sent; stored value set back to the default is sent; clearing a stored optional
address sends an empty value (row deleted). e2e flows for criteria 2, 3, 4, 5 and 7 traced by hand: unchanged
behaviour.

## Checklist

### Plan compliance

- [x] All 10 tasks present and conform to the plan.
- Small drift from the plan's file list: m1, m2, n1.

### Anti-hallucination

- [x] **No invented API.** Checked as used: `getDb`, `withTenant` and nested scope restoring the outer tenant
      (`src/db/tenant-scope.ts`); `saveOrganizationSettingsTxnDao`, `upsertOrganizationSettingsDao`;
      `canManageAssociation`, `requireCurrentTenantDal`, `requireActionAuth`; `updateTag`, `cacheLife`, `cacheTag`
      (`next/cache`); `z.email()` (zod 4); UI components in `src/components/ui/`; accent tokens in `globals.css`;
      message keys present in `fr`, `en` and `es`.
- [x] **No plausible-but-wrong values:** favicon `oklch(0.55 0.1 h)` = `--accent-solid`; six hues = §1.2; inline
      `--accent-hue` on `<html>` overrides `:root`.
- [x] The code does what its comments claim.

### Rules compliance

- [x] **AGENTS.md and project rules** — the form rule is now respected. New table with `organization_id` and
      forced RLS; repositories on `getDb()` only; no new `withRlsBypass()` (the provisioning one predates the story);
      nothing hard-coded (neutral registry defaults, fictitious `.test` seed addresses); migrations generated, policy
      via `--custom`; labels in message files. The hue card is not a form (one closed radio group and a button,
      nothing to validate): react-hook-form not required.
- [x] **ADRs:** none contradicted. ADR 016 followed (values-only table, missing row = default) — the m4 fix brings
      the form in line with it. ADR 002, 003, 008, 010 followed.
- [x] **Design system:** no new component or token; `[data-accent-hue-scope]` re-declares existing tokens and is
      documented; button hover on `secondary` as planned; screens match the intent of
      `docs/designs/s02-parametres-association.md`.

### Tests

- [x] Suite run by the reviewer, green (figures above).
- [x] Assertions pin the criteria: criterion 2 (test registry, one key per type, unchanged component); service
      (one test per role, no DAO call on refusal); criteria 4 and 5 (forage falls back to contact; clearing contact
      refused); actions (`updateTag` on success only); m4 (three tests above); e2e criteria 3 to 10 against the
      database under the `asl_app` role. Weak spots: m6, m7.

### Regressions

- [x] None found on the touched paths: root layout reads the settings (cached per association, 195 fallback);
      `BureauSidebar` became a client component, tested; button hover change app-wide as planned; no remaining user of
      `canManageAssociationIdentity` or `DEFAULT_MONOGRAM_ACCENT_HEX`; provisioning tests extended.

## Findings

### Closed since the first review

- **M1** — fixed and verified.
- **m4** — fixed and verified.

### Still open — all minor

- **m1 — minor** — `src/app/globals.css` changed but not in the plan's file list (content legitimate and
  documented).
- **m2 — minor** — `src/app/[locale]/(bureau)/bureau/reglages/page.tsx` still guards the page with
  `canManageCurrentAssociationIdentityDal`, a name left from before the rename; `association-identity-dal.ts` listed
  in the plan but untouched.
- **m3 — minor** — `association-settings-form.tsx` puts every key of the `settings` page under the fixed card
  title `cards.notifications.title`; a future non-email key would get the wrong heading.
- **m5 — minor** — `e2e/association-settings.spec.ts` `afterAll` restores the database but not the cache;
  replaying against an already-running server fails until restart. CI unaffected.
- **m6 — minor** — criterion 7 replay in the e2e only asserts `status < 500` and an unchanged value, with no
  positive control (the owner replaying the same request successfully).
- **m7 — minor** — criterion 9 favicon-hue assertion in the e2e only runs when
  `content-type === image/svg+xml`, so it can be skipped silently (the route's unit test covers it).
- **m8 — minor, inherited** — `src/app/dal/association-settings-dal.ts` calls the facade inside `'use cache'`,
  so the logging interceptor runs inside a cached scope (same pattern as the tenant DAL, same open s01 minor).
- **m9 — minor, known and accepted by the user** — no backfill of `contact.email` for tenants created before s02
  (`acme-corp`, `evil-corp`). Since the m4 fix, their settings page refuses to save until the contact address is
  filled in, which is consistent; the refusal message says the empty address « reste en vigueur ».
- **m10 — minor** — the in-memory `'use cache'` stores resolved settings, email addresses included, in the clear.
  The rule only forbids personal data in cache keys and tags, but it deserves a line in ADR 016 or the DAL comment.

### New in this pass

- **n1 — minor** — `deleteOrganizationSettingsDao` in `src/db/repositories/organization-setting-repository.ts` is
  never used; deletions go through `saveOrganizationSettingsTxnDao`. Asked by plan task 1, needed by nothing now:
  delete it or wire it in.
- **n2 — minor** — since the m4 fix, `changesToSend` re-sends every stored key on each save, even untouched ones;
  the upsert rewrites `updated_at` and `updated_by` on unchanged rows, so these columns stop meaning « last real
  change ». No functional impact today; neither ADR 016 nor the plan defines their meaning. Worth fixing before an
  audit trail relies on them.

## Verdict

No critical and no major issue. M1 and m4 are fixed with real code and tests. Everything left is minor, including
m9, accepted by the user. The e2e spec was judged by reading only and must pass in CI on the PR.

Max severity: minor
Ship allowed: yes
