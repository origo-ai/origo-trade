# Demo Scope Runbook (Supabase SQL Editor)

## 1) Prepare Auth User
1. Open Supabase Dashboard > Authentication > Users.
2. Create customer user:
   - Email: `demo@origo.local`
   - Password: set temporary demo password
   - Email confirmed: true

## 2) Run SQL Files In Order
1. `docs/sql/01_scope_migration.sql`
2. `docs/sql/02_rls_policies.sql`
3. `docs/sql/03_demo_seed.sql`

Run each file separately and confirm no `ERROR` output.

If existing `trrgroup` account sees empty data after rollout, run:
- `docs/sql/00_trr_scope_hotfix.sql`

## 3) Quick Verification
Run these queries:

```sql
select id, email, username, role, customer_id
from public.users
where lower(email) = lower('demo@origo.local');

select id, company_name, email
from public.customers
where id = 'demo';

select customer_id, count(*) as row_count
from public.stock
group by customer_id
order by customer_id;
```

Expected:
- `demo@origo.local` exists in `public.users` with `role='CUSTOMER'` and `customer_id='demo'`.
- `public.customers` has row `id='demo'`.
- Demo rows exist in scoped tables.

## 4) App Smoke Test
1. Login as `trrgroup` account.
2. Check pages:
   - Trade Performance
   - Orders & Shipments
   - Inventory
   - Invoices & Payments
   - YOUR Product
3. Logout, then login as `demo@origo.local`.
4. Verify values and records are different from `trrgroup`.

## 5) Reset Demo Data
Re-run:
1. `docs/sql/03_demo_seed.sql`

This clears and reseeds only `customer_id='demo'` rows for supported tables.
