---
name: code-review
description: Review local LINKO changes or a git diff on two independent axes (Spec/Behavior and CODING_STANDARDS.md compliance) after running mechanical checks. Use before committing, after implementing a feature, or when reviewing a teammate's branch before merge.
---

# LINKO Code Review

Perform a disciplined, two-axis review of a LINKO diff.

## Step 1: Determine Diff Scope & Run Mechanical Checks

1. Resolve what is being reviewed:
   - If the user named a branch, commit range, or files (e.g., `main...dev/jhonne`), diff that range.
   - Otherwise inspect uncommitted changes (`git status --short`, `git diff`, `git diff --cached`). If the working tree is clean, diff `HEAD` against `main` (or `staging` for DB branches).
2. Run deterministic Layer 1 checks first (never spend review prose on linter/test failures):
   - `npm run lint`
   - `npm test`
   - If `backend/` or `api/` changed: `npm run test:backend`
   - Surface any failing check as a **Blocker**.

## Step 2: Spawn Two Independent Review Subagents in Parallel

Spawn two read-only subagents with fresh context and the diff so the axes do not bias each other. (Fall back to two separate sequential passes only if subagents are unavailable.)

### Axis 1 — Standards (`CODING_STANDARDS.md`: "Is it built right?")
1. Read `CODING_STANDARDS.md` in full before auditing the diff.
2. Audit **only added and modified hunks**, honoring the **Ratchet Rule** (do not demand rewrites of untouched legacy lines in `logistics.js`, `orders.js`, `InventoryPage.jsx`, `LogisticsManagementPage.jsx`, or `app.test.js`, but do flag new bulk added to them that belongs in extracted modules).
3. Pay special attention to LINKO's high-impact smells and invariants:
   - **Frontend:** Raw `fetch()` bypassing `src/lib/api.js`; domain logic leaking into `src/components/ui/`; hardcoded roles instead of `src/auth/roleAccess.js`; unguarded `useEffect` fetches or derived-state sync chains; reinventing `useListUrlState` / `usePaginatedResource`.
   - **Backend auth & tenancy:** Missing `requireAuth` / role middleware; trusting `req.body.business_id` or reading `req.auth.memberships` directly instead of `getActiveMembership` / `activeMemberships` / `resolveActiveBusinessId`; assuming `platform_admin` has memberships or an implicit bypass.
   - **SQL & errors:** Unparameterized SQL or non-allowlisted dynamic `ORDER BY`; multi-write flows without a `BEGIN`/`COMMIT`/`ROLLBACK`/`client.release()` transaction; bare `CURRENT_DATE` instead of `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date`; ad-hoc 500 JSON or leaked errors instead of `createHttpError` + `next(error)`.
   - **Plain-JS safety:** Unguarded Express query params (arrays), missing 32-bit `INT` (`<= 2147483647`) bounds on IDs, `||` clobbering `0`/`false`.
   - **Testing:** New protected routes missing `401`, `403`, `400`/`404`, or happy-path coverage; new suites appended to `backend/src/app.test.js`.

### Axis 2 — Spec & Domain ("Is it the right thing?")
1. Check the diff against the stated task, `AGENTS.md`, and relevant contracts (`docs/API_CONTRACTS.md`, `docs/linko_database_specification.md`, `ROADMAP.md`).
2. Verify LINKO domain invariants:
   - Single canonical marketplace business type (`buyer` OR `wholesaler`, never `both`).
   - Accurate `buyer` / `wholesaler` / `MSME` / `supplier` terminology; no out-of-scope three-tier supply-chain framing.
   - Matching MVP remains proximity/location-only unless explicitly changed.
   - API payload shapes remain compatible with `docs/API_CONTRACTS.md` and frontend callers.
   - Migrations use sequential numbering from `staging` and never assume Vercel runs migrations.

## Step 3: Report Prioritized Findings

Omit trivial nitpicks. Every finding must cite `path:line`, the broken standard or spec requirement, and a concrete minimal fix.

```markdown
## Mechanical Checks
- `npm run lint`: PASS / FAIL
- `npm test`: PASS / FAIL
- `npm run test:backend`: PASS / FAIL / SKIPPED (reason)

## Findings

### Critical / Blocker
- `path/to/file.js:42` — <issue>. **Fix:** <specific fix>.

### Standards Violations (`CODING_STANDARDS.md`)
- `path/to/file.js:88` — <rule violated>. **Fix:** <specific fix>.

### Suggestions (Optional)
- `path/to/file.js:15` — <concise improvement>.

## Verdict
**Approve** | **Approve with minor fixes** | **Request changes**
```

Do not edit application code during review unless asked.
