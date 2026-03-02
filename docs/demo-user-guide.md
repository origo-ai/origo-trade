# Demo User Guide

## Demo Account
- Email: `demo@origo.local`
- Password: `<set in Supabase Auth>`
- Role: `CUSTOMER`
- Customer scope: `customer_id='demo'`

## What This Demo Covers
- Trade Performance
- Orders & Shipments
- Inventory
- Invoices & Payments
- YOUR Product
- Market Intelligence (READY product scope from customer requests)
- AI Agent responses from scoped datasets

## Data Notes
- Demo records are synthetic and not copied 1:1 from TRR production values.
- KPI totals, inventory, contract, delivery, and invoice values are intentionally different from TRR.
- Demo rows are isolated by `customer_id='demo'`.

## Known Constraints
- If a user is not mapped to `public.users.customer_id`, customer pages show a setup error.
- Some optional datasets (for example `purchase_trend`) require `customer_id` column to be present to return scoped data.

## Reset / Refresh Demo Data
1. Run `docs/sql/03_demo_seed.sql` in Supabase SQL Editor.
2. Re-login as demo user.

## Setup Prerequisite
Run in order:
1. `docs/sql/01_scope_migration.sql`
2. `docs/sql/02_rls_policies.sql`
3. `docs/sql/03_demo_seed.sql`

For full run instructions, see `docs/sql/runbook-demo-scope.md`.
