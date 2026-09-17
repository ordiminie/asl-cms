# Review: story s01b-logo-association

> Fresh-context review. Each issue is classified critical, major or minor.
> Diff reviewed: `git diff main...feature/s01b-logo-association` (one commit, 2621454, 71 files).

**Verdict:** no critical issue. The product code matches the plan, ADR 015 and the design. But one e2e test will fail every time it runs, so CI on the PR will be red. Fix it before anyone merges.

## Plan compliance

- [x] The code does what the plan asks, and nothing more. All 9 tasks are in the diff:
  1. Local storage adapter, with the neutral `StoredFile` type used by the Supabase adapter and its callers. `file-dal.ts` needed no change: no `FileObject` usage is left in storage.
  2. Two new columns and a generated migration (`0005_big_iron_man` plus snapshot and journal), `updateOrganizationIdentityKeyDao` using `getDb()`, and `TenantDTO` extended.
  3. The pure rules and the access matrix.
  4. The replacement service in the ADR 015 order, plus its façade and interceptor.
  5. The server action, with `updateTag(TENANT_CACHE_TAG)` only on success.
  6. The `/api/identity/[kind]` route.
  7. `AssociationMark`, favicon `icons` in the metadata, and `src/app/favicon.ico` deleted.
  8. The `(bureau)` layout and page, the access-denied screen (B), `/bureau` added to the proxy, and fr/en/es messages.
  9. The e2e spec, `docs/architecture.md` and the `rule-upload-file` docs.
- The "Non touchés" list is respected: `organization.logo`, the Supabase flows and `/admin` are unchanged. No `withRlsBypass` was added.
- One prerequisite outside the branch was not done (minor, see findings): the plan says to reword criterion 7 in `docs/stories.md` "avant /ks-review". `main` still says "son nom remplace le logo".

## Anti-hallucination

- [x] No invented API, function or import. I opened and checked each of these:
  - `requireCurrentTenantDal`, `getCurrentTenantDal`, `TENANT_CACHE_TAG` (`src/app/dal/tenant-dal.ts`)
  - `requireActionAuth` (throws `AuthorizationError`)
  - `getOrganizationByIdDao` (uses `getDb().query.organization.findFirst`, so it returns the new columns)
  - `createServiceInterceptor(methods, name, {shouldLogDetails})` (the option exists)
  - `RoleConst.SUPER_ADMIN`, `UserOrganizationRoleConst.OWNER/ADMIN`, and `User.role` / `User.organizations`, used the same way in `authorization-service.ts`
  - The `FileUpload` `maxSize` prop
  - `Progress` and `Alert` (`role="alert"` by default)
  - The `accent-solid` token (`--color-accent-solid` in `globals.css`)
  - `#17849B`, which is the hue-195 value in design-system §1.2
  - The `updateTag` import from `next/cache`
  - The `pointer-fine:` variant (Tailwind 4.3)
- [ ] One plausible-but-wrong value: the logo size limit collides with Next's default server-action body limit (minor, see findings).
- [x] The code does what it claims. Some points I checked:
  - Path confinement in `resolveInsideRoot` covers `..`, absolute POSIX and Windows paths, NUL, and a final check that the resolved path stays under the root.
  - Writes go to a temp file (`wx`) and are then renamed.
  - The route reads no path from the request: the type must be `logo` or `favicon`, the tenant comes from the domain, the key comes from the database, and the read service checks the prefix again.
  - The default SVG favicon escapes the association name.
  - The long cache is only used when `?v=` matches the current key.

## Rules compliance

- [x] Repo conventions are followed.
  - Layers: action → façade → service → repository; DAL → façade.
  - Messages come from `getTranslations` / `useTranslations`.
  - No `process.env` outside `env.ts`.
  - The session is never awaited at the top of a layout: `(bureau)` reads it behind `<Suspense>`.
  - The public layout now awaits the tenant, which the `[locale]` layout already blocks on (ADR 003).
  - `pnpm check:rules` passes, and the regenerated `.cursor` copy matches.
  - `eslint` on the changed files is clean, and `tsc --noEmit` shows no errors.
- [x] No accepted ADR is contradicted.
  - ADR 015 is followed point by point: columns, key format, three-step replacement, fixed route, fallbacks.
  - ADR 004: the adapter goes through the existing factory.
  - ADR 003: the tenant is resolved from the domain on the server.
  - ADR 014 / architecture: `organization` stays exempt from RLS, now documented.
  - ADR 010: the hex colour and the "ASL" prefix are hard-coded, but the plan approved both as temporary, in one module, to be replaced in s02.
- [x] The design system is respected, with small drift.
  - Components: `sidebar`/`sheet`, `breadcrumb`, `card` without shadow, `file-upload` plus an `outline` button, `progress`, anchored `alert`, and no `default` button.
  - Sizes follow the type scale: 34 / 17 / 15 px, squares of 44 / 34 px, 56 px buttons on mobile.
  - No drag-and-drop on touch screens.
  - Two small deviations are listed in the findings: progress without a percentage, and one sidebar group (which the plan asked for).

## Tests

- [x] I ran `pnpm test --run` myself on `feature/s01b-logo-association`: **Test Files 39 passed | 2 skipped (41); Tests 564 passed | 8 skipped (572)**, exit 0.
- [x] The unit assertions test the acceptance criteria, not just that code runs:
  - The service tests check call order with `invocationCallOrder`, "no write" on each refusal, and both partial-failure branches.
  - The route tests check that forged `kind` values cause no tenant lookup and no read.
  - The adapter tests use a real temp filesystem: forged paths, interrupted write, and org prefixes.
  - The access matrix includes global admin, other-org owner/admin, and global admin who is only a member.
  - The metadata test checks that `src/app/favicon.ico` is gone.
- [ ] The e2e spec has a failure that will always happen (major, see findings). Playwright can't run in this container, so I judged it by reading the code.

## Regressions

- [x] Existing code paths are safe.
  - `StorageOperations.list` now returns `StoredFile[]`: `file-service.ts` and `files-repository.ts` were updated, and `file-service.test.ts` passes.
  - The public header shows `AssociationMark` instead of "Home", and no e2e spec checks for "Home".
  - Test fixtures were updated for the new `TenantDTO` and model fields.
  - `LOCAL_STORAGE_ROOT` is now a required server env variable. It is set in CI and documented in `env.example`, but every deployed environment must set it, or env validation fails at boot. The PR should say so.

## Findings

- **major** — `e2e/association-identity.spec.ts` lines 174 and 190 (test "critère 2"). On `/fr/bureau/identite` at the Desktop Chrome viewport (1280 px), two visible `img` elements are named `Logo de l'association TechCorp Solutions`:
  - the logo in the `BureauSidebar` header (the sidebar is `md:flex`, so it shows);
  - the logo preview in `AssociationIdentityCard`.

  `locator.getAttribute('src')` and `toHaveAttribute` are strict, so the test fails with a strict mode violation every run. (The mobile header is `md:hidden`, so it doesn't count.) Because the block is `test.describe.serial`, every later test is then skipped: 5/6 on two domains, 4 (forged paths, nosniff), and 8 (refusal screen, direct action replay, SuperAdmin). CI will be red, and criteria 5, 6 and 8 will have no e2e run. Fix: scope the locator to the card (for example the `Logo` card region), or use `.first()` inside `main`. This is a test defect, not a product bug.

- **minor** — `src/services/types/domain/association-identity-types.ts` (`IDENTITY_MAX_BYTES.logo = 1024*1024`) vs `next.config.ts` (no `serverActions.bodySizeLimit`, so the default is 1 MB = 1,048,576 bytes). The multipart request adds some overhead to the file. A logo just under the advertised 1 MB (roughly the last few hundred bytes) passes the client check, then Next rejects the request before the action runs. The user sees the generic "L'envoi n'a pas abouti." instead of a success. The old logo is kept. Also, the service's server-side "too large" message for logos can never be reached in practice. Fix: raise `bodySizeLimit` a little above 1 MB, or lower the limit.
- **minor** — `docs/stories.md` on `main`, criterion 7. The rewording the plan required before review ("monogramme + nom") was not done. The code shows the monogram with the name next to it, which still meets the current wording (the name is shown), but the framing doc and the plan/design now disagree.
- **minor** — `src/components/features/association/association-identity-card.tsx`, loading state. The design asks for a `progress` bar "avec nom du fichier et pourcentage". The code shows an indeterminate `Progress value={null}` with `animate-pulse`: the component draws it as an empty track, with no percentage. A server action reports no progress, so the design's intent (the upload is announced and the button disabled) is met, but the design doc should note the change.
- **minor** — `src/components/features/association/bureau-sidebar.tsx`. The sidebar has one group ("L'association") where the design shows two ("Le site" / "L'association"). The plan asked for this and design gap 7 allows it; I note it only so the design system can be updated.
- **minor** — The required new env variable `LOCAL_STORAGE_ROOT` (`src/env-schemas.ts`) needs a clear note in the PR description, and the production directory must be writable. How it is backed up belongs to the go-live story (ADR 015).

## Verdict

Ship is allowed, but the PR's CI will be red until the e2e finding is fixed. Don't merge before that.

Max severity: major
Ship allowed: yes
