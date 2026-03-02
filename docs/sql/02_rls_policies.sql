-- Step 2/3: RLS policies for account isolation
-- Purpose:
-- 1) Enforce per-customer row visibility using customer_id.
-- 2) Allow admin users to access all rows.
-- 3) Remove insecure demo anon policies.
--
-- Prerequisite:
-- - Run docs/sql/01_scope_migration.sql first.
--
-- Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 0) Preflight checks
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.users') is null then
    raise exception 'public.users is missing. Run docs/supabase-auth-schema.sql first.';
  end if;
  if to_regclass('public.customers') is null then
    raise exception 'public.customers is missing. Run docs/supabase-schema.sql first.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A) Helper functions used by policies
-- ---------------------------------------------------------------------------
create or replace function public.current_customer_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.customer_id
      from public.users u
      where u.id = auth.uid()
        and u.is_active = true
      limit 1
    ),
    (
      select c.id
      from public.users u
      join public.customers c
        on lower(trim(u.email)) = lower(trim(c.email))
      where u.id = auth.uid()
        and u.is_active = true
      limit 1
    ),
    (
      select c.id
      from public.users u
      join public.customers c
        on lower(trim(c.id)) = lower(trim(u.username))
        or lower(trim(c.id)) like '%' || lower(trim(u.username)) || '%'
      where u.id = auth.uid()
        and u.is_active = true
      order by
        case
          when lower(trim(c.id)) = lower(trim(u.username)) then 0
          else 1
        end
      limit 1
    )
  )
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'ADMIN'
      and u.is_active = true
  )
$$;

revoke all on function public.current_customer_id() from public;
revoke all on function public.is_admin_user() from public;
grant execute on function public.current_customer_id() to authenticated;
grant execute on function public.is_admin_user() to authenticated;

-- ---------------------------------------------------------------------------
-- B) Remove insecure demo policies from older setup
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.customers') is not null then
    execute 'drop policy if exists customers_all_anon on public.customers';
  end if;
  if to_regclass('public.admin_users') is not null then
    execute 'drop policy if exists admin_users_all_anon on public.admin_users';
  end if;
  if to_regclass('public.uploads') is not null then
    execute 'drop policy if exists uploads_all_anon on public.uploads';
  end if;
  if to_regclass('public.activity_logs') is not null then
    execute 'drop policy if exists activity_logs_all_anon on public.activity_logs';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- C) Customers table
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.customers') is not null then
    execute 'alter table public.customers enable row level security';

    execute 'drop policy if exists customers_admin_all on public.customers';
    execute 'create policy customers_admin_all on public.customers
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';

    execute 'drop policy if exists customers_customer_select on public.customers';
    execute 'create policy customers_customer_select on public.customers
      for select to authenticated
      using (id = public.current_customer_id())';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- D) Admin-only tables (legacy)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.admin_users') is not null then
    execute 'alter table public.admin_users enable row level security';
    execute 'drop policy if exists admin_users_admin_all on public.admin_users';
    execute 'create policy admin_users_admin_all on public.admin_users
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';
  end if;

  if to_regclass('public.activity_logs') is not null then
    execute 'alter table public.activity_logs enable row level security';
    execute 'drop policy if exists activity_logs_admin_all on public.activity_logs';
    execute 'create policy activity_logs_admin_all on public.activity_logs
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- E) uploads
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.uploads') is not null then
    execute 'alter table public.uploads enable row level security';

    execute 'drop policy if exists uploads_admin_all on public.uploads';
    execute 'create policy uploads_admin_all on public.uploads
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';

    execute 'drop policy if exists uploads_customer_all on public.uploads';
    execute 'create policy uploads_customer_all on public.uploads
      for all to authenticated
      using (customer_id = public.current_customer_id())
      with check (customer_id = public.current_customer_id())';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- F) Read-only customer datasets (admin has full access)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.stock') is not null then
    execute 'alter table public.stock enable row level security';
    execute 'drop policy if exists stock_admin_all on public.stock';
    execute 'create policy stock_admin_all on public.stock
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';
    execute 'drop policy if exists stock_customer_select on public.stock';
    execute 'create policy stock_customer_select on public.stock
      for select to authenticated
      using (customer_id = public.current_customer_id())';
  end if;

  if to_regclass('public.finance_invoices') is not null then
    execute 'alter table public.finance_invoices enable row level security';
    execute 'drop policy if exists finance_invoices_admin_all on public.finance_invoices';
    execute 'create policy finance_invoices_admin_all on public.finance_invoices
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';
    execute 'drop policy if exists finance_invoices_customer_select on public.finance_invoices';
    execute 'create policy finance_invoices_customer_select on public.finance_invoices
      for select to authenticated
      using (customer_id = public.current_customer_id())';
  end if;

  if to_regclass('public.contract_lines') is not null then
    execute 'alter table public.contract_lines enable row level security';
    execute 'drop policy if exists contract_lines_admin_all on public.contract_lines';
    execute 'create policy contract_lines_admin_all on public.contract_lines
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';
    execute 'drop policy if exists contract_lines_customer_select on public.contract_lines';
    execute 'create policy contract_lines_customer_select on public.contract_lines
      for select to authenticated
      using (customer_id = public.current_customer_id())';
  end if;

  if to_regclass('public.deliveries') is not null then
    execute 'alter table public.deliveries enable row level security';
    execute 'drop policy if exists deliveries_admin_all on public.deliveries';
    execute 'create policy deliveries_admin_all on public.deliveries
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';
    execute 'drop policy if exists deliveries_customer_select on public.deliveries';
    execute 'create policy deliveries_customer_select on public.deliveries
      for select to authenticated
      using (customer_id = public.current_customer_id())';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- G) your_product_requests (customer read/write own rows)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.your_product_requests') is not null then
    execute 'alter table public.your_product_requests enable row level security';

    execute 'drop policy if exists your_product_requests_admin_all on public.your_product_requests';
    execute 'create policy your_product_requests_admin_all on public.your_product_requests
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';

    execute 'drop policy if exists your_product_requests_customer_select on public.your_product_requests';
    execute 'create policy your_product_requests_customer_select on public.your_product_requests
      for select to authenticated
      using (customer_id = public.current_customer_id())';

    execute 'drop policy if exists your_product_requests_customer_insert on public.your_product_requests';
    execute 'create policy your_product_requests_customer_insert on public.your_product_requests
      for insert to authenticated
      with check (customer_id = public.current_customer_id())';

    execute 'drop policy if exists your_product_requests_customer_update on public.your_product_requests';
    execute 'create policy your_product_requests_customer_update on public.your_product_requests
      for update to authenticated
      using (customer_id = public.current_customer_id())
      with check (customer_id = public.current_customer_id())';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- H) Shared ready-page datasets (authenticated read, admin write)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.ready_page_products') is not null then
    execute 'alter table public.ready_page_products enable row level security';
    execute 'drop policy if exists ready_page_products_admin_all on public.ready_page_products';
    execute 'create policy ready_page_products_admin_all on public.ready_page_products
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';
    execute 'drop policy if exists ready_page_products_authenticated_select on public.ready_page_products';
    execute 'create policy ready_page_products_authenticated_select on public.ready_page_products
      for select to authenticated
      using (true)';
  end if;

  if to_regclass('public.ready_page_buyer_signals') is not null then
    execute 'alter table public.ready_page_buyer_signals enable row level security';
    execute 'drop policy if exists ready_page_buyer_signals_admin_all on public.ready_page_buyer_signals';
    execute 'create policy ready_page_buyer_signals_admin_all on public.ready_page_buyer_signals
      for all to authenticated
      using (public.is_admin_user())
      with check (public.is_admin_user())';
    execute 'drop policy if exists ready_page_buyer_signals_authenticated_select on public.ready_page_buyer_signals';
    execute 'create policy ready_page_buyer_signals_authenticated_select on public.ready_page_buyer_signals
      for select to authenticated
      using (true)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- I) Validation helpers
-- ---------------------------------------------------------------------------
-- select policyname, tablename, permissive, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in (
--     'customers',
--     'uploads',
--     'stock',
--     'finance_invoices',
--     'contract_lines',
--     'deliveries',
--     'your_product_requests',
--     'ready_page_products',
--     'ready_page_buyer_signals'
--   )
-- order by tablename, policyname;
