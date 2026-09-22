**⚠️ Superseded by the third pass below — kept for the full audit trail of the fix loop.**

# Review — Story s04-pages-cms (second pass)

Diff reviewed: `git diff main...feature/s04-pages-cms` (59 files, two commits: `f4edb9a` feat,
`fb83759` fix). First pass (on `f4edb9a` alone) is superseded by this report; its six findings are
re-verified below rather than repeated as a separate document.

## Test suite (run by the reviewer, not trusted from any report)

- `pnpm test --run` → **914 passed, 8 skipped** (87 files, 89 total incl. skipped) — up from 900 at
  the first pass, consistent with the fix round's new test files (`page-block-types.test.ts` +56,
  `pages-list.test.tsx` new, `preview-bar.test.tsx` new, `page-i18n.test.ts` new).
- `pnpm lint` → clean (2 warnings, both in `.scratch`/`.remember`, unrelated).
- `pnpm check:rules` → `✅ Règles et documentation alignées sur le code.`
- `npx tsc --noEmit` → clean, no output.
- e2e not executed (needs Postgres + Playwright + production build); `e2e/page-cms.spec.ts`
  untouched by the fix commit, already read in full at the first pass.

## Plan compliance

All 9 tasks still present and matching their description; the fix commit only touches items
explicitly raised by the first review plus their own regression tests — within the fix-mode contract
of AGENTS.md.

## The six first-pass findings — independently re-verified

1. **`RESERVED_PAGE_SLUGS` completeness** — confirmed fixed and well done. `account`, `dashboard`,
   `pricing_old` are now in the list. The new test walks `src/app/[locale]/` with `node:fs`, recurses
   into route groups (`(...)`), correctly skips dynamic segments (`[...]`), and only counts a
   directory as "served" if it has its own `page.tsx`/`route.ts`. Independently re-running the same
   algorithm standalone returns exactly `['account','dashboard','auth-error','login','logout',
'register','reset-password','verify-request','blog','contact','pricing','pricing_old','privacy',
'terms','admin','docs']` — all 16 are in `RESERVED_PAGE_SLUGS`. The guard would have failed pre-fix
   (the three missing segments are all in this computed list), so it's a real regression guard.
   `bureau`/`checkout`/`modules` correctly aren't flagged since they have no `page.tsx` at their own
   root segment (only children do) — the manual reservation of those three names is conservative
   extra safety, not a gap.
2. **ADR 019 direct edit + design doc** — accurate and consistent with the shipped code. Per
   Marie-Ève's explicit instruction, the direct-edit-of-an-immutable-ADR pattern itself is not
   flagged as a finding here — only whether the corrected text matches reality, which it does:
   `markdown-editor.tsx` (Milkdown) is imported only by `post-form.tsx` (admin blog); the new
   `RestrictedMarkdownEditor` is a separate, from-scratch component used by `text-block-form.tsx` and
   `callout-block-form.tsx`. `docs/designs/s04-pages-cms.md` no longer cites `markdown-editor
restreint` under "Reused components".
3. **Status-dot tokens** — confirmed. No `oklch(...)` literal remains in either `STATUS_DOT_CLASS`
   map (`preview-bar.tsx`, `pages-list.tsx`); both use `bg-muted-foreground` / `bg-accent-solid` /
   `bg-warning-border` / `bg-destructive`, all real tokens in `docs/design-system.md` §1.1/§4.2. New
   tests assert `className` never contains `'oklch'` and pin the exact token per status. Status is
   still read from a written label next to the dot, never color alone. The `<PreviewBar />` bar's own
   background (`oklch(0.24 0.02 250)`) and the error-banner background remain raw oklch, but the
   first is explicitly mandated verbatim by the design system's `<PreviewBar />` row — sanctioned, not
   drift; the second is a minor unlisted variant, not part of the original finding.
4. **`page-dal.ts` comment / plan DoD** — confirmed accurate. The comment now states the facade's
   logging interceptor does call `logger.info`/`logger.debug` inside the `'use cache'` scope, that
   this is tenable only because the logger is neutralized during `NEXT_PHASE=phase-production-build`,
   and that it's inherited from `association-settings-dal.ts`'s template, not introduced or resolved
   by s04. The plan's DoD line was reworded to match.
5. **`pages-list.tsx` async create + anchored alert** — confirmed correct and well tested. `create()`
   now awaits `createAction()` inside the transition, catches failures, recognizes a `NEXT_REDIRECT`
   digest as success (not an error), and shows an anchored `role="alert"` on genuine failure — never a
   toast. Three new tests cover success, retry-exhaustion failure, and the redirect-signal path; all
   pass.
6. **en/es translation keys — partially resolved at first pass, re-opened here.** The two literal
   keys named by the first review (`PublicCmsPage.previewDraft`/`previewUnpublished`,
   `BureauPagesPage.errors.createFailed*`) are genuinely translated. But checking the "officially
   unreachable" premise used to justify treating this as low-priority: it does not hold.
   `src/i18n/routing.ts` still declares `locales: ['en','fr','es']` with **`defaultLocale: 'en'`** —
   ADR 008's decision (`locales: ['fr']`, no prefix, en/es removed) was never implemented in code.
   En/es are live, and English is the fallback locale. Exact string-equality against `fr.json` shows
   **all 43 keys of the `PageBlocks` namespace** and **38/40 (`en`) / 37/40 (`es`) keys of
   `BureauPagesPage`** are byte-identical to French in both locale files — only the two pairs named by
   the first review were actually translated. `page-i18n.test.ts` only asserted key-**shape** parity,
   not translation content, so it passed despite ~80 keys being unlocalized. `main`'s `en.json` has
   zero French-looking strings anywhere — full parity was maintained before this story. Raised to
   **major**: this ships an admin screen (the entire block-editor forms, most of the pages-list
   screen) rendering French text under English/Spanish chrome for any visitor whose browser doesn't
   negotiate `fr`, on what is currently the product's default locale.

## Re-verified from the first pass (untouched by the fix commit, checked independently)

- RLS: `page` and `content_block` both `ENABLE`+`FORCE ROW LEVEL SECURITY`; `content_block`'s policy
  joins through `page` (also forced), matching `0007_organization_setting_rls.sql`'s pattern exactly.
  `page-repository.ts` uses `getDb()` everywhere, never bare `db`.
- No `withRlsBypass` introduced anywhere in this diff.
- `validatePageBlocksForPublication` is only called from the publish path, never from
  `updatePageService`.
- File route (`/api/pages/files/[...key]`): tenant from the resolved domain, key checked against
  `{organizationId}/pages/` prefix before any read, `X-Content-Type-Options: nosniff` on both success
  and 404.
- Single `ActionIdConst.PAGE_MANAGE` (`['owner','board']`) registered once, no hand-rolled duplicate
  role check.
- File size limits (`PAGE_FILE_MAX_BYTES`) are hardcoded but match the established pattern from
  `association-identity-service.ts` (s01b) — technical upload caps, not an ADR 010 "rien en dur"
  violation.

## Findings

- **major — en/es translation debt in `PageBlocks` and `BureauPagesPage`**: ~80 of ~98 s04 message
  keys are untranslated French copies in `messages/en.json`/`messages/es.json`, and
  `src/i18n/routing.ts` (`defaultLocale: 'en'`, all three locales still `supported`) means these are
  live, reachable strings today, not dead code behind an implemented ADR 008. No test catches
  translation content, only key shape.
- **minor — `src/components/ui/preview-bar.tsx`**: the bar's own background and the error-banner
  background remain raw oklch literals; the first is explicitly specified as such by the design
  system, the second is an unlisted, cosmetic variant of it — not a blocker.

## Verdict

Both self-contained majors from the first pass (reserved slugs, ADR/design contradiction) are closed
with real, verified fixes and matching regression tests. The status-dot tokens, the `page-dal.ts`
documentation accuracy, and the create-action error handling are also genuinely fixed. The i18n fix
closes the two keys named by the first review but leaves the bulk of the same defect (untranslated
new namespaces) in place, resting on a premise ("en/es are unreachable per ADR 008") that the current
`routing.ts` contradicts — a real, scoped, non-security, non-data-corrupting UX defect on a live
default locale. It doesn't touch tenant isolation or RLS, and every acceptance criterion of the story
is otherwise met and tested.

Max severity: major
Ship allowed: yes

---

# Review — Story s04-pages-cms (third and final pass)

Diff reviewed: all three commits together (`f4edb9a`, `fb83759`, `6a14708`).

## Test suite (run by the reviewer, not trusted from any report)

- `pnpm test --run` → **918 passed, 8 skipped** (87 files, 89 total incl. skipped) — up from 914 at
  the second pass, exactly +4 = two new assertions (translation-content + interpolation-preservation)
  × two namespaces (`PageBlocks`, `BureauPagesPage`) added by `6a14708`.
- `pnpm lint` → clean (2 warnings, both in `.scratch`/`.remember`, unrelated).
- `pnpm check:rules` → `✅ Règles et documentation alignées sur le code.`
- `npx tsc --noEmit` → clean, no output.
- e2e not executed (needs Postgres + Playwright + production build); `e2e/page-cms.spec.ts`
  untouched by either fix commit.

## Commit `6a14708` — scope and mechanics

Touches exactly `messages/en.json`, `messages/es.json`, `src/services/__tests__/page-i18n.test.ts`.
No touch to `messages/fr.json` or `src/i18n/routing.ts`.

## Verifying the i18n fix closes the second pass's major

Independently flattened and diffed `fr.json`/`en.json`/`es.json`:

- **Key parity**: `PageBlocks` (43 keys) and `BureauPagesPage` (40 keys) identical key sets across
  fr/en/es.
- **Translation content**: the only byte-identical-to-French values left are the two allowlisted ones
  — `en:BureauPagesPage.title` ("Pages"="Pages") and `en:BureauPagesPage.columns.actions`
  ("Actions"="Actions"). Both are real, natural translations matching a pre-existing convention
  (`Common.fields.actions`, `ApiKeysPage.table.actions` — untouched, also "Actions" in English); the
  Spanish catalog correctly renders "Pages" as "Páginas", proving it wasn't lazily copied. No other
  key is quietly in the allowlist. No other key in either namespace, either locale, is a French copy.
- **Interpolation variables**: preserved exactly across fr/en/es for every key checked, including
  namespaces beyond the two named (`SortableList`, `PublicCmsPage`, `PreviewBar`, `BlockPicker`,
  `RestrictedMarkdownEditor`).

The named major is genuinely and completely closed for `PageBlocks` and `BureauPagesPage`.

## New finding — one leftover French string outside the named scope

Widening the check to every new namespace this story added found one further miss:
**`SortableList.position`** is `"{position} sur {total}"` — byte-identical to French — in both
`en.json` and `es.json`. This is not decorative: `src/components/ui/sortable-list.tsx:213` renders it
on every row of the keyboard-reorderable block list (task 8, criterion 8's own screen). An
English/Spanish-locale board member sees "1 sur 5" instead of "1 of 5" / "1 de 5". The neighbouring
`SortableList.moved` (the `aria-live` announcement) _is_ correctly translated — an isolated miss, not
systemic. Never covered by any test in either commit; `page-i18n.test.ts`'s content-guard only checks
`PageBlocks`/`BureauPagesPage`.

Severity: minor — a single leftover connector word, still legible from the surrounding digits,
confined to one string in one component.

## Re-verified load-bearing items (all three commits together)

RLS forced on `page`+`content_block` and correctly joined through `page`; no `withRlsBypass`
anywhere; publish-only validation confined to the publish path; file route tenant/prefix validation
and `nosniff` unchanged; single `PAGE_MANAGE` action; `RESERVED_PAGE_SLUGS` still contains all 16
computed reserved segments; status-dot tokens still real design-system tokens, no invented color;
`page-dal.ts` comment and DoD wording, `pages-list.tsx` error handling — all intact, unregressed by
`6a14708` (message-catalog + test file only).

## Plan compliance

All 9 tasks present and matching their description. `6a14708` stays inside the fix-mode contract of
AGENTS.md — no scope creep.

## Findings

- **minor — `messages/en.json` / `messages/es.json` (`SortableList.position`)**: leftover French
  `"{position} sur {total}"`, visible on every row of the block-reorder editor under English/Spanish
  locale. Untested.
- **minor (previously accepted, unchanged)** — `src/components/ui/preview-bar.tsx`: bar background
  and error-banner background remain raw `oklch(...)`; the first is mandated verbatim by the design
  system, the second is an unlisted cosmetic variant.

## Verdict

The second pass's major is genuinely closed: `PageBlocks` and `BureauPagesPage` (83 keys) are now
correctly and completely translated in English and Spanish, matching interpolation variables, with
legitimate, checkable allowlisted exceptions. Widening the check surfaced one further isolated
leftover-French string (`SortableList.position`), real but small enough (one connector word, one
component) to stay minor rather than repeat the same failure at scale. Every previously-verified
load-bearing item (RLS, no `withRlsBypass`, publish-only validation, file-route tenant scoping, single
`PAGE_MANAGE` action, reserved slugs, status-dot tokens) remains intact across all three commits. Full
suite passes (918/918 excl. skipped), lint/rules/`tsc` clean. Nothing here rises above minor.

## Post-review fix, self-verified (no fourth full pass)

Commit `421584e` translated the one remaining minor (`SortableList.position`, "sur"→"of"/"de" in
en/es) and widened `page-i18n.test.ts`'s translation-content guard to all seven namespaces this story
introduced. Verified directly rather than through another reviewer subagent, given the scope is a
single interpolated string in two locale files plus a test-coverage widening: `git diff 6a14708..421584e`
touches exactly `messages/en.json` (1 line), `messages/es.json` (1 line), and the test file — confirmed
by inspection. Full suite: 928 passed, 8 skipped, 0 failed; lint/`check:rules`/`tsc` clean.

No open finding above minor remains. Nothing changes the third pass's verdict.

Max severity: minor
Ship allowed: yes
