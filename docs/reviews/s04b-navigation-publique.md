# Review — Story s04b-navigation-publique

Diff reviewed: `git diff main...feature/s04b-navigation-publique` (44 files, +10568/-184). Plan: `docs/plans/s04b-navigation-publique.md` (validated: yes). ADR: `docs/decisions/021-navigation-menu-item-et-pied-de-page.md`. Design: `docs/designs/s04b-navigation-publique.md` + `docs/design-system.md`.

Reviewer: `reviewer` subagent, fresh context, read-only.

## Verification performed

- Ran `pnpm test --run`: **94 files passed, 2 skipped (pre-existing) — 991 tests passed, 8 skipped. 0 failed.**
- Ran `pnpm lint`: 0 errors (2 pre-existing warnings in unrelated scratch files, not part of this diff).
- Ran `pnpm check:rules`: passes ("Règles et documentation alignées sur le code").
- Opened and cross-checked every new/changed function against its call sites: `menu-item-model.ts` / migrations 0014-0015 / `_journal.json`, `menu-item-repository.ts`, `site-navigation-service.ts`, `site-navigation-validation.ts`, `site-navigation-service-facade.ts` + interceptor, `action-registry-types.ts`, `site-navigation-dal.ts`, `bureau/navigation/{page,actions}.tsx`, `bureau-sidebar.tsx`, `(public)/layout.tsx`, `public-footer.tsx`, `public-mobile-menu.tsx`, `site-navigation-manager.tsx`, `e2e/site-navigation.spec.ts`, `docs/architecture.md`.
- Verified every imported function's real signature at its definition (`getPageByIdDao`, `getOrganizationSettingsDao`, `upsertOrganizationSettingsDao`, `renderPageBlock`, `SortableList`, `RestrictedMarkdownEditor`, `getPagesForBureauDal`, `requireActionAuth`, `requireCurrentTenantDal`) — all match exactly (name, params, return type).
- Confirmed `UserOrganizationRoleConst.ADMIN === 'board'`, so `defaultRoles: ['owner','board']` and the test assertions using `UserOrganizationRoleConst.ADMIN` are consistent.
- Confirmed `en.json` / `es.json` are genuinely translated, not copied from French.
- Confirmed no `withRlsBypass` introduced, no hardcoded business values, no `process.env` misuse, no debug/TODO leftovers in the diff.

## Plan compliance

- [x] All 8 plan tasks implemented, each checked off, each verifiable against the diff. No drift: nothing implemented beyond the plan, nothing missing.
- `menu_item` table: `organization_id` direct (not joined, unlike `content_block`) exactly as ADR 021 mandates; RLS migration follows `page`'s template; unique `(organization_id, page_id)`.
- Single `SITE_NAVIGATION_MANAGE` action covering menu and footer, roles `['owner','board']` — confirmed in registry and tests.
- Footer stored under `site.footer_content` directly via `organization-setting-repository.ts`, outside `ASSOCIATION_SETTINGS_REGISTRY` — a dedicated test proves `getAssociationSettingsService` resolution is unaffected by that key (ADR 021's core guarantee).
- Cross-invalidation into s04's `bureau/pages/[id]/actions.ts`: `updateTag(siteNavigationTag(tenant.id))` added on both `publishPageAction` and `unpublishPageAction`, as the plan required.
- `docs/architecture.md` updated 23 → 24 tables, 4 → 5 RLS-scoped rows, `menu_item` justified.

## Anti-hallucination

- [x] No invented API / function / import — every reference opened and verified against its real definition.
- [x] No plausible-but-wrong logic found in the reviewed scope.
- [x] Duplicate-add flow: the service pre-checks existing entries and returns `{status: 'rejected', error: 'already_in_menu'}` rather than a raw Postgres error, as the plan asks. One residual gap noted below (minor).

## Rules compliance

- [x] Layered architecture respected (Presentation → Server Action → Facade → Service → Repository; DAL for reads, with the `'use cache'` / `cacheTag` public read and the uncached bureau read correctly split).
- [x] `requireActionAuth()` called first in every Server Action; the service re-verifies via `canPerformAction`.
- [x] No accepted ADR contradicted; ADR 021 followed (two persistence patterns, single combined cache tag, footer outside the typed settings registry).
- [x] Design system respected: `Alert` variants `destructive` / default are the only two in `alert.tsx` and match s04's precedent (`pages-list.tsx`); the removal banner uses the real `warning` / `warning-foreground` tokens as the design specifies; `<SortableList />` and `RestrictedMarkdownEditor` reused unmodified, no new component invented; one `default` button per screen (footer "Enregistrer"), all menu actions `outline`.

## Tests

- [x] Suite run by the reviewer, passing (991 passed, 8 skipped).
- [x] Assertions pin the acceptance criteria: role-based authorization (OWNER / BOARD / MEMBER / PUBLIC) for every service function, cross-tenant page rejection (`NotFoundError` under RLS scope), duplicate rejection, footer empty-vs-absent distinction, no leak into s02's settings registry, public rendering filtering on `visible` and `pageStatus === 'published'` independently (criteria 2 and 6), component tests for the annotation text and empty states, sanitization of the footer's rich-text render.
- e2e `e2e/site-navigation.spec.ts` read in full: encodes cross-tenant isolation, non-board refusal, publish → menu update without restart (criterion 5) and visibility independent of page status (criterion 6). Not executed in the review sandbox (needs a production build + seeded Postgres). The implementer ran it green against the production build, and verified criterion 5 negatively (removing the `updateTag` from `publishPageAction` made the spec fail on the expected assertion). CI will run it on the PR.

## Regressions

- [x] No impact found on unrelated code paths. The hardcoded "Connexion" label in the public layout header predates this diff (verified against `main`) and is out of scope.
- `home.test.tsx`'s added `vi.mock('server-only', ...)` only unblocks an import in an already skipped suite — harmless.

## Findings

- **minor** — `src/services/site-navigation-service.ts` (`addMenuItemService`): the "already in menu" guard is a read-then-check against `getMenuItemsByOrganizationDao`, not a caught unique-constraint violation. If two board members add the same page at the same instant, the second request hits `menu_item_organization_page_unique` and may surface a raw database error instead of the friendly `{status: 'rejected'}` (the Server Action still maps it to the generic "failed" message). Low likelihood for this screen; worth hardening later by catching the constraint violation as a fallback. Not blocking.

No critical or major issue found.

## Notes outside the diff (reported by the implementer, not blocking)

- The local e2e database `asl_cms_test` lacks `ALTER DEFAULT PRIVILEGES` for the `asl_app` role, so any table created by a new migration (here `menu_item`) is unreadable there until `docker/db-init/03-app-role.sql` is replayed on it. CI is unaffected (single Postgres role). The e2e runs for this story were done on the dev database `asl_cms`, cleaned back to seed state afterwards.
- `e2e/auth.spec.ts` has 2 pre-existing failures (the register page expects Google / Apple buttons) — `(auth)` group, untouched by this story.

Max severity: minor
Ship allowed: yes
