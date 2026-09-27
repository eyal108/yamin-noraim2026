# Synagogue management — review and release notes

Reviewed 2026-09-27, PR #1. This is a first manual management workspace, not the entire proposed product roadmap.

## Review findings resolved

- **Tenant confusion:** the initial screen had no synagogue selector and relied on a shared localStorage value for mutations. Added an explicit selector; invalid `org` links fail closed; every data store captures one immutable tenant ID. The legacy shared client is restored byte-for-byte to main.
- **Shabbat board:** the initial date range included weekdays and Sunday, ordered services backwards, and counted empty duties as assigned. The board now covers Friday and Saturday in Israel, sorts chronologically, counts actual assignments and shows vacancies.
- **Persistence and editing:** paginated loads handle more than 1,000 records and lower server page caps; initial load failures block editing and provide retry. Errors remain visible in the modal. Save/delete operations are guarded against double submission, use a fixed editor context, and reject stale versions. A successful save is reflected without a second read that could misreport it as failed.
- **Authentication:** sign-out clears private state; users without a permitted synagogue can still sign out. OAuth keeps the requested organization and uses the established production origin. The new page pins its Supabase browser dependency; existing pages retain theirs.
- **Database integrity:** same-tenant composite foreign keys; referenced members cannot be deleted (deactivation is supported). Positive amounts, allowed statuses/types, nonblank names, date ranges and lengths are enforced in PostgreSQL. Record identity cannot move between tenants; updates increment a version token. Anonymous and truncate grants are removed from new tables. Inactive synagogues are blocked for ordinary administrators.
- **Reviewability:** readable JS, HTML and CSS; pure domain logic separated from UI and persistence; reproducible test runner with a pinned dev dependency and lockfile.

## Verification

- `npm ci && npm test`: 14 passing automated tests. Domain tests cover Israel dates, Shabbat boundaries, sorting, assignment counts, input validation, pagination and optimistic concurrency. DOM tests exercise create/edit/delete for each module, failure/retry, duplicate submission, tenant isolation from localStorage, invalid organization links, unauthenticated/denied views, sign-out, escaped names and member-name search.
- These DOM tests use jsdom and an in-memory backend. They do not claim to verify Google OAuth or a real browser rendering engine.
- The SQL upgrade was applied **twice within one transaction** against the actual PostgreSQL service, followed by synthetic tenant/RLS/FK/validation/version tests. The transaction ended in **ROLLBACK**. Both repetitions passed, establishing repeatability. No test fixtures or review schema changes were retained.
- `node --check` on new JavaScript and `git diff --check` passed.
- Supabase security advisor: no findings on the new tables. Existing informational notices for service-owned AI tables and a password-protection warning remain outside this PR. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . The new policies were validated in rollback tests; advisor results reflect the currently deployed schema.

## Deliberate first-version limits

- Prayer times, aliyot and duty allocation are manual. No computed halachic times, parashah service or AI suggestions.
- Events use a civil date for a single occurrence. Yahrzeits do not yet recur automatically by Hebrew date and no reminders are sent.
- Finances track positive pledges/donations with open/paid status. No payment collection, partial-payment ledger, expenses or tax receipts.
- Individual members are a new registry; existing seating families are preserved in their existing module and are not automatically converted into people or linked to member records.
- Existing seating screens and algorithms remain intact; their only HTML change is the navigation script cache version. The added navigation link opens the new workspace.

## Release — requires the user's final approval

1. Recheck that the PR head is unchanged and main has no conflicting changes.
2. Apply `supabase/synagogue-management.sql` atomically. The earlier turn already created the five initial empty tables; the reviewed constraints, version columns and triggers are **not yet deployed**. The new UI explicitly requests `version` and fails closed if the upgrade is absent.
3. Verify the schema and grants, then merge PR #1 and check the GitHub Pages deployment.
4. Smoke-test the deployed `synagogue.html?org=<existing slug>` with an authorized Google account. This part was not completed during review.

## Rollback

The pre-feature main commit is `0e548e638da85810d5a19f77742bd871faae2f67`. Revert the feature merge and republish GitHub Pages to restore the previous interface. Keep the new management tables and their data; do not drop them during a UI rollback. The new tables are separate from seating data, and this upgrade does not rewrite seating tables or legacy auth functions.
