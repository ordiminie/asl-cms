# User Stories — ASL-CMS

> One story = one shippable slice, written to be executed by an agent.
> Id format: `s<number>-<short-slug>` — reused in every pipeline file and in the branch name.

> Note on "target as spec": per `docs/prd.md`, Vilogi is a loose category reference only — it was not reverse-engineered, so agentic notes below point to the PRD/devis instead of a specific competitor screen. All "org"/"tenant" references mean the ShipSaaS Organization = Association model from the architecture constraints.

## Story s01-member-account-access
**As a** property owner or bureau member **I want** to receive an account and log in via a magic email link **so that** I can access my association's private member space without managing a password.

### Complexity
3

### Acceptance criteria
- [ ] A bureau admin can create/invite a member account (email + linked owner record) within their organization only (no cross-tenant leakage)
- [ ] A member requests a magic link with their registered email and receives a working single-use, expiring login link
- [ ] Following a valid magic link logs the member in and creates a session scoped to their organization
- [ ] An expired or already-used magic link is rejected with a clear error and no session is created
- [ ] A logged-in user with the Membre role cannot access Bureau-only screens/routes
- [ ] A login attempt with an email not registered in that organization fails without revealing whether the email exists (no user enumeration)

### Dependencies
None — builds directly on ShipSaaS's native Organization + Better Auth primitives.

### Agentic notes
ShipSaaS already provides multi-tenant Organization + Better Auth; this story wires passwordless (magic-link) auth and maps it to two application roles (Bureau=admin, Membre=member) rather than inventing a new auth system. All member records must be scoped by `organization_id` with RLS — verify no cross-tenant query path exists. ~400 accounts per tenant: a simple per-member invite is acceptable for v1 (bulk import is not in this PRD's perimeter — don't build it speculatively).

---

## Story s02-manage-public-pages
**As a** bureau member **I want** to create and edit public pages and a contact form **so that** visitors and members can find information about the association without logging in.

### Complexity
2

### Acceptance criteria
- [ ] A bureau admin can create, edit, and publish/unpublish a page (title + rich content) visible on the association's public site
- [ ] An unauthenticated visitor can view any published page and cannot view an unpublished/draft page
- [ ] A visitor can submit the contact form with name/email/message; a valid submission is persisted and confirmed, an invalid one shows field errors and persists nothing
- [ ] A submitted contact message is visible to the Bureau role only
- [ ] Pages and contact submissions are scoped to the owning organization only

### Dependencies
None.

### Agentic notes
This is the CMS backbone other modules attach public-facing blocks to (leak-report form in s08, alert banner in s03, water status in s09). Build the page/block model extensibly enough that a later story can register a new block type without a rearchitecture — but don't build speculative block types now, only what s03/s08/s09 actually need. Corresponds to the devis's "Socle indispensable" site-public tier.

---

## Story s03-manage-alert-banner
**As a** bureau member **I want** to publish a sitewide alert banner (e.g. water cutoff, road works) **so that** visitors and members see urgent notices immediately.

### Complexity
2

### Acceptance criteria
- [ ] A bureau admin can create/edit/clear a single active alert banner (message + type) shown on every public and member page
- [ ] When no alert is active, no banner renders
- [ ] A visitor or member can dismiss the banner for their current visit without it reappearing until they revisit the site
- [ ] A banner from one association never appears on another association's site

### Dependencies
s02 (uses the public page shell/layout)

### Agentic notes
Devis "Recommandée" tier, generic across water cutoffs and road works — build one reusable banner mechanism; s09 (water status) and s10 (voirie) surface into it via a bureau-authored message, not automated triggers (no automation in this PRD's scope).

---

## Story s04-member-profile-contact
**As a** member **I want** to update my own contact details and send a question directly to the bureau **so that** my information stays current and I can reach the board privately.

### Complexity
2

### Acceptance criteria
- [ ] A logged-in member can view and edit their own name/email/phone/address; changes persist and are reflected immediately
- [ ] A member cannot view or edit another member's contact details
- [ ] A member can submit a question/message to the bureau from their member space; a valid submission is persisted and confirmed
- [ ] The bureau can see questions submitted by members, attributed to the submitting member

### Dependencies
s01

### Agentic notes
Distinct from s02's public (anonymous) contact form — this one is authenticated, attributed to a known member, and lives inside the member space.

---

## Story s05-access-shared-documents
**As a** member **I want** to browse and download documents the bureau has shared with my profile (PV, statuts, convocations) **so that** I can stay informed without asking the bureau directly.

### Complexity
3

### Acceptance criteria
- [ ] A bureau admin can upload a document, set a title/category, and set its visibility (e.g. all members, bureau only)
- [ ] A member can list and download only documents visible to their role; a document scoped Bureau-only is not visible or downloadable by a Membre
- [ ] A member of one association cannot list or download another association's documents
- [ ] Deleting a document removes it from the member-visible list and blocks further downloads

### Dependencies
s01

### Agentic notes
Use whatever secure file storage ShipSaaS already provides — check boilerplate conventions before adding a new storage integration. Access-by-profile is the core business logic here: test both the allow and the deny path explicitly, not just the happy path.

---

## Story s06-configure-seo-settings
**As a** bureau admin **I want** to configure basic SEO settings (meta description, sitemap, indexing) for my association's public site **so that** it can be found via search engines.

### Complexity
1

### Acceptance criteria
- [ ] A bureau admin can set a site title, meta description, and social preview image for the public site
- [ ] The public site exposes a valid XML sitemap reflecting currently published pages only
- [ ] Meta tags configured by the bureau render correctly in the public page's HTML head

### Dependencies
s02

### Agentic notes
Config-only feature per the PRD ("pas un module à logique propre") — no custom logic beyond storing and rendering the config. Keep this story small; resist scope creep toward a full SEO toolkit.

---

## Story s07-water-consumption-history
**As a** member **I want** to see my water consumption history, **and as a** bureau admin **I want** to import consumption readings **so that** members' history stays current and I understand my own usage over time.

### Complexity
3

### Acceptance criteria
- [ ] A bureau admin can import a CSV/Excel file of consumption readings (owner identifier, date, reading); valid rows are persisted, invalid rows are reported without silently dropping or corrupting other rows
- [ ] A member can view their own consumption history as a table, scoped to their own parcel/account only
- [ ] A member cannot view another member's consumption data
- [ ] An import in one association never affects another association's records

### Dependencies
s01

### Agentic notes
No live third-party meter API — per the brief there's no retroactivity before the site's creation year, so define and validate a minimal CSV schema; surface parsing/validation errors clearly rather than failing silently. This is member-facing read + bureau-facing import in one slice — don't build a general-purpose import framework, just this one flow.

---

## Story s08-report-water-leak
**As a** member or visitor **I want** to report a water leak **so that** the bureau is notified and I can follow its resolution status.

### Complexity
3

### Acceptance criteria
- [ ] A member or public visitor can submit a leak report (location/description, optional contact) via a form; a valid submission is persisted and confirmed
- [ ] A bureau admin can see all leak reports for their organization and update a report's status (e.g. reported → in progress → resolved)
- [ ] A logged-in member who submitted a report can see its current status
- [ ] Leak reports are scoped to the owning organization

### Dependencies
s01, s02

### Agentic notes
Two entry points share one underlying flow: public/unauthenticated (devis "signalement public de fuite") and member/authenticated with status follow-up (devis "déclaration de fuite / d'incident") — build one reusable report+status model rather than two parallel ones. Status transitions should stay simple/linear, no branching workflow.

---

## Story s09-publish-water-status
**As a** bureau admin **I want** to publish water restriction/cutoff notices and water analysis results **so that** members and visitors are informed of current water conditions.

### Complexity
2

### Acceptance criteria
- [ ] A bureau admin can publish a restriction/cutoff notice (message + dates) visible to members and public visitors
- [ ] A bureau admin can publish water analysis results (date, summary/attachment) visible to members and public visitors
- [ ] Removing a published item removes it from public and member views
- [ ] Published items are scoped to the owning organization

### Dependencies
s02, s03, s01

### Agentic notes
A restriction/cutoff notice is a natural candidate for also setting s03's alert banner, but this story's acceptance criteria stand on their own — don't make the banner a hard dependency of publishing status.

---

## Story s10-voirie-tracking
**As a** bureau admin **I want** to track roads/ways and their work or renovation status, **and as a** member or visitor **I want** to see that status **so that** everyone knows the state of shared infrastructure.

### Complexity
2

### Acceptance criteria
- [ ] A bureau admin can create/edit a road/way entry (name/identifier, description) and set its work/renovation status
- [ ] A member or public visitor can view the list of roads/ways and their current status
- [ ] No billing or individual-owner data is attached to a road entry (collective only, per PRD scope)
- [ ] Entries are scoped to the owning organization

### Dependencies
s01, s02

### Agentic notes
Deliberately not merged with the water module's data model — the PRD graveyards a generic "shared resource" abstraction, so implement Voirie as its own independent module even though it superficially resembles a status-tracked list like s08/s09.

---

## Story s11-view-member-invoices
**As a** member **I want** to see my invoices and payment status and follow a secure link to pay **so that** I know what I owe and can settle it without the system handling my payment details.

### Complexity
4

### Acceptance criteria
- [ ] A member can list their own invoices (date, amount, paid/unpaid status) sourced from the association's billing provider, scoped to their own account only
- [ ] A member can follow a "pay" link that redirects to the billing provider's own secure payment page; no banking/card data is captured or stored by this system
- [ ] The billing provider integration is implemented behind an interface so a different provider can be plugged in per organization without changing member-facing code
- [ ] If the billing provider is unreachable or unconfigured for an organization, the member sees a clear message instead of a broken page or stale data
- [ ] Invoice data is scoped to the owning organization with no cross-tenant leakage

### Dependencies
s01

### Agentic notes
Highest-risk story in this batch. Risk 1: the Strategy interface for the billing provider must be genuinely swappable, not just parameterized — this is the PRD's one confirmed per-tenant-divergent integration. Risk 2: must stay strictly read-only + redirect-only — never accept, store, or proxy payment/banking data, to stay out of DSP2/PCI scope as the PRD requires. Build and validate against one concrete provider adapter (Pennylane-style, per La Fourche) first; don't build a second adapter speculatively.

---

## Story s12-participate-ag-vote
**As a** member **I want** to access the AG vote and see published results and resolutions **so that** I can participate in association governance.

### Complexity
3

### Acceptance criteria
- [ ] A member can follow a link from their member space to the association's configured external vote platform (ASL Community) when a vote is open
- [ ] A bureau admin can publish resolutions submitted to vote (title/description) visible to members
- [ ] A bureau admin can publish vote results (including a PV/minutes document or summary) visible to members
- [ ] Vote-related content is scoped to the owning organization

### Dependencies
s01, s02

### Agentic notes
Per the PRD's reserves, the vote itself is never owned by this system — this story is redirect + publish only, no voting logic to build or test here. Confirm the external vote link is per-organization configurable (each association points to its own ASL Community space), not hardcoded.

---

## Story s13-send-email-campaigns
**As a** bureau admin **I want** to send email campaigns to members via the association's email provider **so that** I can communicate with the membership at scale without breaching provider rate limits.

### Complexity
3

### Acceptance criteria
- [ ] A bureau admin can compose and send a campaign (subject, content, recipients = all members or a segment) through the organization's configured email provider
- [ ] Sending to more recipients than the provider's daily limit (300/day) automatically batches dispatch across days rather than failing or dropping recipients
- [ ] A member who has opted out is excluded from future campaigns
- [ ] Campaign sends use only the owning organization's own recipient list and provider account

### Dependencies
s01

### Agentic notes
The devis splits this into "campagnes" + "envoi échelonné" (rate-limited batching) — build batching in from the start rather than bolting it on later, since the 300/day cap is real for a ~400-member org. Batching state (what's been sent so far) must survive a server restart, not just live in memory.

---

## Story s14-payment-notifications
**As a** member **I want** to be automatically notified when a new invoice is available or overdue **so that** I don't have to check the site manually.

### Complexity
3

### Acceptance criteria
- [ ] When a new invoice becomes visible for a member (per s11's data source), a notification email is sent to that member
- [ ] When an invoice remains unpaid past a configurable threshold, a reminder (relance) email is sent, without repeating indefinitely for the same overdue invoice within the same period
- [ ] Notification sends respect the same provider rate-limit batching as s13
- [ ] Notification sends are scoped to the owning organization

### Dependencies
s11, s13

### Agentic notes
This is the automated counterpart to s13's manual campaigns — reuse its sending/batching mechanism rather than building a second one. Needs a way to detect "new" or "still overdue" invoice state from s11's billing-provider read model; define what triggers a check (e.g. a scheduled job), since there's no guaranteed push webhook from the provider.

---

## Story s15-community-classifieds
**As a** member **I want** to post and browse small classified ads visible to other members **so that** I can buy, sell, or give away things within the association.

### Complexity
2

### Acceptance criteria
- [ ] A member can create a classified ad (title, description, optional contact info) visible to other members of the same organization only
- [ ] A member can edit or remove their own ad; cannot edit or remove another member's ad
- [ ] Members can browse/list all active ads for their organization
- [ ] Ads are never visible to another organization's members or to the public

### Dependencies
s01

### Agentic notes
Bonus-tier feature per the devis — keep scope minimal: no in-app messaging/inbox between members, just a members-only listing showing the poster's own contact info if they choose to include it.

---

## Story s16-community-directory
**As a** member **I want** to browse a directory of services offered by other members **so that** I can find help or services within the association.

### Complexity
2

### Acceptance criteria
- [ ] A member can create/edit their own directory entry (service description, contact info) visible to other members of the same organization only
- [ ] Members can browse/search the directory for their organization
- [ ] A member can remove their own entry; cannot edit or remove another member's entry
- [ ] Directory entries are never visible to another organization's members or to the public

### Dependencies
s01

### Agentic notes
Structurally similar to s15 (member-authored, member-visible-only listing) but a distinct value proposition (services vs. items) per the devis's separate line items — reuse shared listing/permission patterns from s15 where sensible rather than duplicating from scratch.
