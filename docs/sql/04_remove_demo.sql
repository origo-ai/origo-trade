-- Step 4/4: Remove demo account and synthetic demo data
-- Purpose:
-- 1) Delete demo-scoped rows (`customer_id='demo'`) from customer-facing tables.
-- 2) Remove demo profile from `public.users` and demo customer from `public.customers`.
-- 3) Attempt to remove demo auth user from `auth.users`.
--
-- Safe to run multiple times.

do $$
declare
  v_demo_customer_id constant text := 'demo';
  v_demo_email constant text := 'demo@origo.local';
  v_demo_username constant text := 'demo';
  v_demo_user_id uuid;
begin
  if to_regclass('public.users') is not null then
    select u.id
    into v_demo_user_id
    from public.users u
    where lower(trim(u.email)) = lower(v_demo_email)
       or lower(trim(u.username)) = lower(v_demo_username)
       or lower(trim(coalesce(u.customer_id, ''))) = lower(v_demo_customer_id)
    limit 1;
  end if;

  -- -------------------------------------------------------------------------
  -- A) Delete demo data from scoped tables
  -- -------------------------------------------------------------------------
  if to_regclass('public.your_product_requests') is not null then
    delete from public.your_product_requests
    where lower(trim(coalesce(customer_id, ''))) = lower(v_demo_customer_id)
       or lower(trim(coalesce(customer_email, ''))) = lower(v_demo_email)
       or lower(trim(coalesce(customer_username, ''))) = lower(v_demo_username);
  end if;

  if to_regclass('public.deliveries') is not null then
    delete from public.deliveries
    where lower(trim(coalesce(customer_id, ''))) = lower(v_demo_customer_id)
       or upper(trim(coalesce(contract_id::text, ''))) like 'DEMO-%'
       or upper(trim(coalesce(job::text, ''))) like 'DEMO-%'
       or lower(trim(coalesce(record::text, ''))) like '%demo%';
  end if;

  if to_regclass('public.contract_lines') is not null then
    delete from public.contract_lines
    where lower(trim(coalesce(customer_id, ''))) = lower(v_demo_customer_id)
       or upper(trim(coalesce(contract_id::text, ''))) like 'DEMO-%'
       or upper(trim(coalesce(job::text, ''))) like 'DEMO-%';
  end if;

  if to_regclass('public.finance_invoices') is not null then
    delete from public.finance_invoices
    where lower(trim(coalesce(customer_id, ''))) = lower(v_demo_customer_id)
       or upper(trim(coalesce(invoice::text, ''))) like 'DEMO-%'
       or upper(trim(coalesce(contract::text, ''))) like 'DEMO-%'
       or lower(trim(coalesce(customer_name::text, ''))) like '%demo%';
  end if;

  if to_regclass('public.stock') is not null then
    delete from public.stock
    where lower(trim(coalesce(customer_id, ''))) = lower(v_demo_customer_id);
  end if;

  if to_regclass('public.uploads') is not null then
    delete from public.uploads
    where lower(trim(coalesce(customer_id, ''))) = lower(v_demo_customer_id);
  end if;

  -- -------------------------------------------------------------------------
  -- B) Remove demo user mapping
  -- -------------------------------------------------------------------------
  if to_regclass('public.users') is not null then
    delete from public.users
    where lower(trim(email)) = lower(v_demo_email)
       or lower(trim(username)) = lower(v_demo_username)
       or lower(trim(coalesce(customer_id, ''))) = lower(v_demo_customer_id)
       or (v_demo_user_id is not null and id = v_demo_user_id);
  end if;

  -- -------------------------------------------------------------------------
  -- C) Remove demo auth user (best effort)
  -- -------------------------------------------------------------------------
  begin
    if v_demo_user_id is not null then
      delete from auth.users
      where id = v_demo_user_id
         or lower(trim(email)) = lower(v_demo_email);
    else
      delete from auth.users
      where lower(trim(email)) = lower(v_demo_email);
    end if;
  exception
    when undefined_table then
      raise notice 'Skip auth.users cleanup: table not accessible in this environment.';
    when insufficient_privilege then
      raise notice 'Skip auth.users cleanup: insufficient privilege.';
    when others then
      raise notice 'Skip auth.users cleanup: %', sqlerrm;
  end;

  -- -------------------------------------------------------------------------
  -- D) Remove demo customer
  -- -------------------------------------------------------------------------
  if to_regclass('public.customers') is not null then
    delete from public.customers
    where lower(trim(id)) = lower(v_demo_customer_id)
       or lower(trim(email)) = lower(v_demo_email);
  end if;
end $$;

-- Verification helpers:
-- select id, email, username, customer_id from public.users where lower(email) = lower('demo@origo.local') or lower(username) = 'demo';
-- select id, company_name, email from public.customers where lower(id) = 'demo' or lower(email) = lower('demo@origo.local');
-- select count(*) from public.stock where customer_id = 'demo';
-- select count(*) from public.finance_invoices where customer_id = 'demo' or upper(coalesce(invoice, '')) like 'DEMO-%';
-- select count(*) from public.contract_lines where customer_id = 'demo' or upper(coalesce(contract_id::text, '')) like 'DEMO-%';
-- select count(*) from public.deliveries where customer_id = 'demo' or upper(coalesce(contract_id::text, '')) like 'DEMO-%';
-- select count(*) from public.your_product_requests where customer_id = 'demo' or lower(coalesce(customer_email, '')) = lower('demo@origo.local');
