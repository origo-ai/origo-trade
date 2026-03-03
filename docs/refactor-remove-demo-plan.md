# Refactor Plan: Remove Demo Account And Data

## Goal
- Remove demo identity and synthetic rows completely.
- Keep customer-scope architecture (`customer_id`) for real accounts.
- Refactor docs/messages to production wording.

## Scope
- Database:
  - Delete demo user/customer and demo rows.
  - Keep RLS and scope functions for production accounts.
- Application:
  - Remove demo-specific wording and runbooks.
  - Keep scope resolver and scoped queries.
- Documentation:
  - Replace demo onboarding with operations-focused runbooks.

## Phase 1: Data Cleanup (Safe, idempotent)
1. Run `docs/sql/04_remove_demo.sql`.
2. Verify demo records are gone:
   - `public.users` no `demo` / `demo@origo.local`
   - `public.customers` no `id='demo'`
   - No `customer_id='demo'` in scoped tables.
3. Verify TRR still has rows after cleanup.

## Phase 2: Scope Integrity
1. Keep `public.current_customer_id()` active.
2. Validate `trrgroup` mapping in `public.users.customer_id`.
3. Verify RLS still isolates by `customer_id`.

## Phase 3: App Refactor
1. Replace demo-centric text in UI/constants.
2. Keep shared scope utilities:
   - `frontend/src/data-access/customer/scope.ts`
   - `frontend/src/data-access/products/yourProductData.ts`
   - scoped pages (`MyCompany`, `Inventory`, `InvoicesPayments`, `ContractTable`, `YourProduct`).
3. Ensure no runtime dependency on demo seed data.

## Phase 4: Docs Cleanup
1. Archive/remove demo-only docs:
   - `docs/demo-user-guide.md`
   - `docs/qa-uat-demo-checklist.md`
   - `docs/uat-signoff-sheet.md`
   - `docs/sql/03_demo_seed.sql`
   - `docs/sql/runbook-demo-scope.md`
2. Keep migration/policy docs:
   - `docs/sql/01_scope_migration.sql`
   - `docs/sql/02_rls_policies.sql`
3. Keep operational hotfix only if still needed:
   - `docs/sql/00_trr_scope_hotfix.sql`

## Rollback
- If cleanup was run by mistake:
  - Recreate target users/customers.
  - Re-seed required rows from backup/export.
  - Re-map `public.users.customer_id`.

## Acceptance Criteria
- Demo account cannot log in.
- All demo rows removed from scoped datasets.
- TRR account still sees full scoped data.
- App pages load without scope or schema errors.
