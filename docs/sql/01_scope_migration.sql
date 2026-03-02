-- Step 1/3: Account scope migration
-- Purpose:
-- 1) Add customer-level scope key (`customer_id`) to main customer-facing tables.
-- 2) Add indexes/FK guards for performance and integrity.
-- 3) Backfill customer mapping where possible from existing email/company fields.
--
-- Run this in Supabase SQL Editor before:
-- - docs/sql/02_rls_policies.sql
-- - docs/sql/03_demo_seed.sql
--
-- Safe to run multiple times.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- A) User -> customer mapping (source of truth for account scope)
-- ---------------------------------------------------------------------------
alter table if exists public.users
  add column if not exists customer_id text;

do $$
begin
  if to_regclass('public.users') is not null then
    execute 'create index if not exists idx_users_customer_id on public.users (customer_id)';
  end if;
end $$;

do $$
begin
  if to_regclass('public.users') is not null
     and to_regclass('public.customers') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'users_customer_id_fkey'
         and conrelid = to_regclass('public.users')
     ) then
    execute '
      alter table public.users
      add constraint users_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null
      not valid
    ';
  end if;
end $$;

-- Backfill users.customer_id by matching email.
do $$
begin
  if to_regclass('public.users') is not null
     and to_regclass('public.customers') is not null then
    execute '
      update public.users u
      set customer_id = c.id
      from public.customers c
      where u.customer_id is null
        and nullif(trim(u.email), '''') is not null
        and lower(trim(u.email)) = lower(trim(c.email))
    ';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- B) Add customer_id scope column on customer-facing datasets
-- ---------------------------------------------------------------------------
do $$
declare
  target_table text;
  target_regclass regclass;
  idx_name text;
  fk_name text;
begin
  foreach target_table in array array[
    'deliveries',
    'stock',
    'finance_invoices',
    'contract_lines',
    'your_product_requests'
  ] loop
    target_regclass := to_regclass(format('public.%I', target_table));
    if target_regclass is null then
      continue;
    end if;

    execute format(
      'alter table public.%I add column if not exists customer_id text',
      target_table
    );

    idx_name := format('idx_%s_customer_id', target_table);
    execute format(
      'create index if not exists %I on public.%I (customer_id)',
      idx_name,
      target_table
    );

    if to_regclass('public.customers') is not null then
      fk_name := format('%s_customer_id_fkey', target_table);
      if not exists (
        select 1
        from pg_constraint
        where conname = fk_name
          and conrelid = target_regclass
      ) then
        execute format(
          'alter table public.%I
           add constraint %I
           foreign key (customer_id)
           references public.customers(id)
           on delete set null
           not valid',
          target_table,
          fk_name
        );
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- C) Backfill customer_id by existing identity columns (best effort)
-- ---------------------------------------------------------------------------
-- 1) your_product_requests: strongest mapping from users/customers email + workspace
do $$
begin
  if to_regclass('public.your_product_requests') is not null
     and to_regclass('public.users') is not null then
    execute '
      update public.your_product_requests ypr
      set customer_id = u.customer_id
      from public.users u
      where ypr.customer_id is null
        and u.customer_id is not null
        and nullif(trim(ypr.customer_email), '''') is not null
        and lower(trim(ypr.customer_email)) = lower(trim(u.email))
    ';
  end if;
end $$;

do $$
begin
  if to_regclass('public.your_product_requests') is not null
     and to_regclass('public.customers') is not null then
    execute '
      update public.your_product_requests ypr
      set customer_id = c.id
      from public.customers c
      where ypr.customer_id is null
        and (
          (nullif(trim(ypr.customer_email), '''') is not null and lower(trim(ypr.customer_email)) = lower(trim(c.email)))
          or
          (nullif(trim(ypr.customer_workspace), '''') is not null and lower(trim(ypr.customer_workspace)) = lower(trim(c.company_name)))
        )
    ';
  end if;
end $$;

-- 2) Generic backfill for remaining tables using common columns.
do $$
declare
  target_table text;
  company_col text;
  email_col text;
  company_columns text[] := array[
    'customer_name',
    'company_name',
    'customer',
    'importer',
    'buyer',
    'customer_workspace'
  ];
  email_columns text[] := array[
    'customer_email',
    'email',
    'owner_email',
    'uploaded_by'
  ];
begin
  if to_regclass('public.customers') is null then
    return;
  end if;

  foreach target_table in array array[
    'deliveries',
    'stock',
    'finance_invoices',
    'contract_lines',
    'your_product_requests'
  ] loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    foreach company_col in array company_columns loop
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = company_col
      ) then
        execute format(
          'update public.%I t
           set customer_id = c.id
           from public.customers c
           where t.customer_id is null
             and nullif(trim(t.%I::text), '''') is not null
             and lower(trim(t.%I::text)) = lower(trim(c.company_name))',
          target_table,
          company_col,
          company_col
        );
      end if;
    end loop;

    foreach email_col in array email_columns loop
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = email_col
      ) then
        execute format(
          'update public.%I t
           set customer_id = c.id
           from public.customers c
           where t.customer_id is null
             and nullif(trim(t.%I::text), '''') is not null
             and lower(trim(t.%I::text)) = lower(trim(c.email))',
          target_table,
          email_col,
          email_col
        );
      end if;
    end loop;
  end loop;
end $$;

-- 3) contract_lines fallback via contracts table relation (if available).
do $$
begin
  if to_regclass('public.contract_lines') is not null
     and to_regclass('public.contracts') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'contract_lines'
         and column_name = 'contract_id'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'contracts'
         and column_name = 'contract_id'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'contracts'
         and column_name = 'customer'
     )
     and to_regclass('public.customers') is not null then
    execute '
      update public.contract_lines cl
      set customer_id = c.id
      from public.contracts ct
      join public.customers c
        on lower(trim(ct.customer)) = lower(trim(c.company_name))
      where cl.customer_id is null
        and cl.contract_id = ct.contract_id
    ';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- D) Helper function for RLS and scoped queries
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.users') is not null
     and to_regclass('public.customers') is not null then
    create or replace function public.current_customer_id()
    returns text
    language sql
    stable
    security definer
    set search_path = public
    as $func$
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
    $func$;

    revoke all on function public.current_customer_id() from public;
    grant execute on function public.current_customer_id() to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- E) Quick verification queries
-- ---------------------------------------------------------------------------
-- select id, email, customer_id from public.users order by created_at desc limit 20;
-- select customer_id, count(*) from public.stock group by customer_id order by count(*) desc;
-- select customer_id, count(*) from public.finance_invoices group by customer_id order by count(*) desc;
-- select customer_id, count(*) from public.contract_lines group by customer_id order by count(*) desc;
-- select customer_id, count(*) from public.deliveries group by customer_id order by count(*) desc;
-- select customer_id, count(*) from public.your_product_requests group by customer_id order by count(*) desc;
