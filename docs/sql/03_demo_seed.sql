-- Step 3/3: Demo account + synthetic data seed
-- Purpose:
-- 1) Create / upsert demo customer and map demo user to customer_id.
-- 2) Seed synthetic demo rows scoped by customer_id='demo'.
--
-- Prerequisite:
-- - Run docs/sql/01_scope_migration.sql
-- - Run docs/sql/02_rls_policies.sql
--
-- Note:
-- - Create Auth user in Supabase Authentication first (email below).
-- - This script is defensive: each table seed is wrapped and will skip with NOTICE on schema mismatch.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- A) Constants
-- ---------------------------------------------------------------------------
-- Keep these values aligned with your presentation account.
-- If you change them, update all sections consistently.
do $$
declare
  v_demo_customer_id constant text := 'demo';
  v_demo_company_name constant text := 'ORIGO DEMO COMPANY CO., LTD.';
  v_demo_contact_name constant text := 'Demo Team';
  v_demo_email constant text := 'demo@origo.local';
  v_demo_phone constant text := '+66-000-000-000';
  v_demo_country constant text := 'Thailand';
begin
  if to_regclass('public.customers') is null then
    raise exception 'public.customers not found. Run docs/supabase-schema.sql first.';
  end if;

  insert into public.customers (
    id,
    company_name,
    contact_name,
    email,
    phone,
    country,
    status,
    notes,
    updated_at
  )
  values (
    v_demo_customer_id,
    v_demo_company_name,
    v_demo_contact_name,
    v_demo_email,
    v_demo_phone,
    v_demo_country,
    'active',
    'Synthetic demo account. Do not mix with production customer records.',
    now()
  )
  on conflict (id) do update
  set company_name = excluded.company_name,
      contact_name = excluded.contact_name,
      email = excluded.email,
      phone = excluded.phone,
      country = excluded.country,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- B) Map auth user -> public.users -> customer_id
-- ---------------------------------------------------------------------------
do $$
declare
  v_demo_customer_id constant text := 'demo';
  v_demo_email constant text := 'demo@origo.local';
  v_demo_username constant text := 'demo';
  v_auth_user_id uuid;
begin
  if to_regclass('public.users') is null then
    raise exception 'public.users not found. Run docs/supabase-auth-schema.sql first.';
  end if;

  -- Auth user must be created from Supabase Dashboard/Auth API.
  select au.id
  into v_auth_user_id
  from auth.users au
  where lower(au.email) = lower(v_demo_email)
  limit 1;

  if v_auth_user_id is null then
    raise notice 'Auth user % not found in auth.users. Create it first, then rerun this script.', v_demo_email;
    return;
  end if;

  insert into public.users (id, email, username, role, is_active, customer_id)
  values (v_auth_user_id, v_demo_email, v_demo_username, 'CUSTOMER', true, v_demo_customer_id)
  on conflict (id) do update
  set email = excluded.email,
      username = excluded.username,
      role = excluded.role,
      is_active = excluded.is_active,
      customer_id = excluded.customer_id,
      updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- C) YOUR Product synthetic rows
-- ---------------------------------------------------------------------------
do $$
declare
  v_demo_customer_id constant text := 'demo';
  v_demo_email constant text := 'demo@origo.local';
  v_demo_username constant text := 'demo';
  v_demo_workspace constant text := 'ORIGO DEMO COMPANY CO., LTD.';
  v_has_product_details boolean := false;
  v_has_details_keyword boolean := false;
  v_has_details_application boolean := false;
  v_has_details_material boolean := false;
  v_has_details_packaging boolean := false;
begin
  if to_regclass('public.your_product_requests') is null then
    raise notice 'Skip your_product_requests seed: table not found.';
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'your_product_requests'
      and column_name = 'product_details'
  ) into v_has_product_details;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'your_product_requests'
      and column_name = 'details_keyword'
  ) into v_has_details_keyword;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'your_product_requests'
      and column_name = 'details_application'
  ) into v_has_details_application;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'your_product_requests'
      and column_name = 'details_material'
  ) into v_has_details_material;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'your_product_requests'
      and column_name = 'details_packaging'
  ) into v_has_details_packaging;

  begin
    delete from public.your_product_requests where customer_id = v_demo_customer_id;

    if v_has_product_details then
      insert into public.your_product_requests (
        customer_id,
        customer_email,
        customer_username,
        customer_workspace,
        product_name,
        hs_code,
        product_details,
        target_market,
        status,
        submitted_at,
        updated_at,
        updated_by,
        customer_message,
        admin_note,
        missing_info_checklist,
        confidence,
        ready_summary
      )
      values
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO REFINED CANE SUGAR',
          '170199',
          'Synthetic sample: fine crystal cane sugar, food-service grade.',
          'Vietnam, Indonesia',
          'PENDING_REVIEW',
          now() - interval '2 day',
          now() - interval '2 day',
          'Customer',
          'Submitted for demo review flow.',
          null,
          '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
          'MEDIUM',
          null
        ),
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO BROWN SUGAR CUBE',
          '170114',
          'Synthetic sample: brown sugar cube for horeca channel.',
          'Japan, South Korea',
          'NEED_MORE_INFO',
          now() - interval '6 day',
          now() - interval '1 day',
          'Admin',
          'Please add packaging and target market details.',
          'Missing packaging specification.',
          '{"packaging":true,"application":false,"target_market":true,"material":false}'::jsonb,
          'LOW',
          null
        ),
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO WHITE SUGAR GRANULATED',
          '170199',
          'Synthetic sample: white sugar for beverage manufacturing.',
          'Philippines',
          'READY',
          now() - interval '15 day',
          now() - interval '5 day',
          'Admin',
          'Ready for preview.',
          'Synthetic READY result for presentation.',
          '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
          'HIGH',
          'Synthetic demand signal: stable recurring buyers in ASEAN.'
        );
    elsif v_has_details_keyword
      and v_has_details_application
      and v_has_details_material
      and v_has_details_packaging then
      insert into public.your_product_requests (
        customer_id,
        customer_email,
        customer_username,
        customer_workspace,
        product_name,
        hs_code,
        details_keyword,
        details_application,
        details_material,
        details_packaging,
        target_market,
        status,
        submitted_at,
        updated_at,
        updated_by,
        customer_message,
        admin_note,
        missing_info_checklist,
        confidence,
        ready_summary
      )
      values
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO REFINED CANE SUGAR',
          '170199',
          'Fine crystal cane sugar',
          'Food-service and beverage',
          'Cane sugar',
          '25kg PP bag',
          'Vietnam, Indonesia',
          'PENDING_REVIEW',
          now() - interval '2 day',
          now() - interval '2 day',
          'Customer',
          'Submitted for demo review flow.',
          null,
          '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
          'MEDIUM',
          null
        ),
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO BROWN SUGAR CUBE',
          '170114',
          'Brown sugar cube',
          'HoReCa channel',
          'Brown cane sugar',
          'Retail carton',
          'Japan, South Korea',
          'NEED_MORE_INFO',
          now() - interval '6 day',
          now() - interval '1 day',
          'Admin',
          'Please add packaging and target market details.',
          'Missing packaging specification.',
          '{"packaging":true,"application":false,"target_market":true,"material":false}'::jsonb,
          'LOW',
          null
        ),
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO WHITE SUGAR GRANULATED',
          '170199',
          'White sugar granulated',
          'Beverage manufacturing',
          'Refined cane sugar',
          'Bulk bag',
          'Philippines',
          'READY',
          now() - interval '15 day',
          now() - interval '5 day',
          'Admin',
          'Ready for preview.',
          'Synthetic READY result for presentation.',
          '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
          'HIGH',
          'Synthetic demand signal: stable recurring buyers in ASEAN.'
        );
    else
      insert into public.your_product_requests (
        customer_id,
        customer_email,
        customer_username,
        customer_workspace,
        product_name,
        hs_code,
        target_market,
        status,
        submitted_at,
        updated_at,
        updated_by,
        customer_message,
        admin_note,
        missing_info_checklist,
        confidence,
        ready_summary
      )
      values
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO REFINED CANE SUGAR',
          '170199',
          'Vietnam, Indonesia',
          'PENDING_REVIEW',
          now() - interval '2 day',
          now() - interval '2 day',
          'Customer',
          'Submitted for demo review flow.',
          null,
          '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
          'MEDIUM',
          null
        ),
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO BROWN SUGAR CUBE',
          '170114',
          'Japan, South Korea',
          'NEED_MORE_INFO',
          now() - interval '6 day',
          now() - interval '1 day',
          'Admin',
          'Please add packaging and target market details.',
          'Missing packaging specification.',
          '{"packaging":true,"application":false,"target_market":true,"material":false}'::jsonb,
          'LOW',
          null
        ),
        (
          v_demo_customer_id,
          v_demo_email,
          v_demo_username,
          v_demo_workspace,
          'DEMO WHITE SUGAR GRANULATED',
          '170199',
          'Philippines',
          'READY',
          now() - interval '15 day',
          now() - interval '5 day',
          'Admin',
          'Ready for preview.',
          'Synthetic READY result for presentation.',
          '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
          'HIGH',
          'Synthetic demand signal: stable recurring buyers in ASEAN.'
        );
    end if;
  exception when others then
    raise notice 'Skip your_product_requests seed due to schema mismatch: %', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- D) Inventory synthetic rows
-- ---------------------------------------------------------------------------
do $$
declare
  v_demo_customer_id constant text := 'demo';
begin
  if to_regclass('public.stock') is null then
    raise notice 'Skip stock seed: table not found.';
    return;
  end if;

  begin
    delete from public.stock where customer_id = v_demo_customer_id;

    insert into public.stock (customer_id, factory, qty, tag, type)
    values
      (v_demo_customer_id, 'F1', 185.0, 'EXPORT', 'CANE'),
      (v_demo_customer_id, 'F1', 92.0, 'DOMESTIC', 'WHITE'),
      (v_demo_customer_id, 'F2', 148.5, 'EXPORT', 'BROWN'),
      (v_demo_customer_id, 'F2', 63.2, 'BUFFER', 'CANE'),
      (v_demo_customer_id, 'F3', 41.0, 'PROMO', 'WHITE');
  exception when others then
    raise notice 'Skip stock seed due to schema mismatch: %', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- E) Finance synthetic rows
-- ---------------------------------------------------------------------------
do $$
declare
  v_demo_customer_id constant text := 'demo';
begin
  if to_regclass('public.finance_invoices') is null then
    raise notice 'Skip finance_invoices seed: table not found.';
    return;
  end if;

  begin
    delete from public.finance_invoices where customer_id = v_demo_customer_id;

    insert into public.finance_invoices (
      customer_id,
      invoice,
      tons,
      total_invoice,
      usd,
      contact,
      credit,
      "export",
      team,
      thb,
      booking_no,
      contract,
      convert_date,
      convert_rate,
      customer_name,
      fac,
      invoice_date,
      price,
      status_type,
      status_detail
    )
    values
      (
        v_demo_customer_id,
        'DEMO-INV-001',
        120.0,
        64200.0,
        64200.0,
        true,
        false,
        true,
        'TEAM-A',
        2247000.0,
        'BK-DEMO-001',
        'DEMO-C-001',
        current_date - interval '12 day',
        35.0,
        'ORIGO DEMO COMPANY CO., LTD.',
        'F1',
        current_date - interval '15 day',
        535.0,
        'Final price',
        'Synthetic final settlement'
      ),
      (
        v_demo_customer_id,
        'DEMO-INV-002',
        80.0,
        39600.0,
        39600.0,
        true,
        false,
        true,
        'TEAM-B',
        1386000.0,
        'BK-DEMO-002',
        'DEMO-C-002',
        current_date - interval '5 day',
        35.0,
        'ORIGO DEMO COMPANY CO., LTD.',
        'F2',
        current_date - interval '7 day',
        495.0,
        'Provisional price',
        'Pending final reconciliation'
      ),
      (
        v_demo_customer_id,
        'DEMO-INV-003',
        44.0,
        22000.0,
        22000.0,
        false,
        true,
        false,
        'TEAM-A',
        770000.0,
        'BK-DEMO-003',
        'DEMO-C-003',
        current_date - interval '2 day',
        35.0,
        'ORIGO DEMO COMPANY CO., LTD.',
        'F3',
        current_date - interval '3 day',
        500.0,
        'Pending',
        'Awaiting payment confirmation'
      );
  exception when others then
    raise notice 'Skip finance_invoices seed due to schema mismatch: %', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- F) Contract and delivery synthetic rows (best effort, optional schema)
-- ---------------------------------------------------------------------------
do $$
declare
  v_demo_customer_id constant text := 'demo';
  v_contract_lines_has_line_id boolean := false;
  v_contract_lines_has_contract_id boolean := false;
  v_deliveries_has_delivery_id boolean := false;
  v_deliveries_has_contract_id boolean := false;
begin
  if to_regclass('public.contract_lines') is null then
    raise notice 'Skip contract_lines seed: table not found.';
  else
    begin
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'contract_lines'
          and column_name = 'line_id'
      ) into v_contract_lines_has_line_id;

      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'contract_lines'
          and column_name = 'contract_id'
      ) into v_contract_lines_has_contract_id;

      delete from public.contract_lines where customer_id = v_demo_customer_id;

      if v_contract_lines_has_line_id and v_contract_lines_has_contract_id then
        insert into public.contract_lines (
          line_id,
          customer_id,
          contract_id,
          job,
          product,
          team,
          status,
          ton,
          acc,
          date_from,
          date_to
        )
        values
          ('11111111-1111-4111-8111-111111111101', v_demo_customer_id, 'DEMO-C-001', 'DEMO-JOB-001', 'CANE SUGAR', 'TEAM-A', 'Pending', 180.0, 74.0, current_date - interval '20 day', current_date + interval '7 day'),
          ('11111111-1111-4111-8111-111111111102', v_demo_customer_id, 'DEMO-C-002', 'DEMO-JOB-002', 'WHITE SUGAR', 'TEAM-B', 'Overdue', 96.0, 52.0, current_date - interval '28 day', current_date - interval '2 day'),
          ('11111111-1111-4111-8111-111111111103', v_demo_customer_id, 'DEMO-C-003', 'DEMO-JOB-003', 'BROWN SUGAR', 'TEAM-A', 'Complete', 60.0, 60.0, current_date - interval '40 day', current_date - interval '10 day');
      elsif v_contract_lines_has_line_id then
        insert into public.contract_lines (
          line_id,
          customer_id,
          job,
          product,
          team,
          status,
          ton,
          acc,
          date_from,
          date_to
        )
        values
          ('11111111-1111-4111-8111-111111111101', v_demo_customer_id, 'DEMO-JOB-001', 'CANE SUGAR', 'TEAM-A', 'Pending', 180.0, 74.0, current_date - interval '20 day', current_date + interval '7 day'),
          ('11111111-1111-4111-8111-111111111102', v_demo_customer_id, 'DEMO-JOB-002', 'WHITE SUGAR', 'TEAM-B', 'Overdue', 96.0, 52.0, current_date - interval '28 day', current_date - interval '2 day'),
          ('11111111-1111-4111-8111-111111111103', v_demo_customer_id, 'DEMO-JOB-003', 'BROWN SUGAR', 'TEAM-A', 'Complete', 60.0, 60.0, current_date - interval '40 day', current_date - interval '10 day');
      elsif v_contract_lines_has_contract_id then
        insert into public.contract_lines (
          customer_id,
          contract_id,
          job,
          product,
          team,
          status,
          ton,
          acc,
          date_from,
          date_to
        )
        values
          (v_demo_customer_id, 'DEMO-C-001', 'DEMO-JOB-001', 'CANE SUGAR', 'TEAM-A', 'Pending', 180.0, 74.0, current_date - interval '20 day', current_date + interval '7 day'),
          (v_demo_customer_id, 'DEMO-C-002', 'DEMO-JOB-002', 'WHITE SUGAR', 'TEAM-B', 'Overdue', 96.0, 52.0, current_date - interval '28 day', current_date - interval '2 day'),
          (v_demo_customer_id, 'DEMO-C-003', 'DEMO-JOB-003', 'BROWN SUGAR', 'TEAM-A', 'Complete', 60.0, 60.0, current_date - interval '40 day', current_date - interval '10 day');
      else
        insert into public.contract_lines (
          customer_id,
          job,
          product,
          team,
          status,
          ton,
          acc,
          date_from,
          date_to
        )
        values
          (v_demo_customer_id, 'DEMO-JOB-001', 'CANE SUGAR', 'TEAM-A', 'Pending', 180.0, 74.0, current_date - interval '20 day', current_date + interval '7 day'),
          (v_demo_customer_id, 'DEMO-JOB-002', 'WHITE SUGAR', 'TEAM-B', 'Overdue', 96.0, 52.0, current_date - interval '28 day', current_date - interval '2 day'),
          (v_demo_customer_id, 'DEMO-JOB-003', 'BROWN SUGAR', 'TEAM-A', 'Complete', 60.0, 60.0, current_date - interval '40 day', current_date - interval '10 day');
      end if;
    exception when others then
      raise notice 'Skip contract_lines seed due to schema mismatch: %', sqlerrm;
    end;
  end if;

  if to_regclass('public.deliveries') is null then
    raise notice 'Skip deliveries seed: table not found.';
  else
    begin
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'deliveries'
          and column_name = 'delivery_id'
      ) into v_deliveries_has_delivery_id;

      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'deliveries'
          and column_name = 'contract_id'
      ) into v_deliveries_has_contract_id;

      delete from public.deliveries where customer_id = v_demo_customer_id;

      if v_deliveries_has_delivery_id and v_deliveries_has_contract_id then
        insert into public.deliveries (
          delivery_id,
          customer_id,
          contract_id,
          job,
          delivery_date,
          record,
          quantity,
          remark
        )
        values
          ('22222222-2222-4222-8222-222222222201', v_demo_customer_id, 'DEMO-C-001', 'DEMO-JOB-001', current_date - interval '11 day', 'Demo delivery batch A', 36.0, 'Synthetic record'),
          ('22222222-2222-4222-8222-222222222202', v_demo_customer_id, 'DEMO-C-001', 'DEMO-JOB-001', current_date - interval '6 day', 'Demo delivery batch B', 38.0, 'Synthetic record'),
          ('22222222-2222-4222-8222-222222222203', v_demo_customer_id, 'DEMO-C-002', 'DEMO-JOB-002', current_date - interval '9 day', 'Demo delivery batch C', 52.0, 'Synthetic record');
      elsif v_deliveries_has_delivery_id then
        insert into public.deliveries (
          delivery_id,
          customer_id,
          job,
          delivery_date,
          record,
          quantity,
          remark
        )
        values
          ('22222222-2222-4222-8222-222222222201', v_demo_customer_id, 'DEMO-JOB-001', current_date - interval '11 day', 'Demo delivery batch A', 36.0, 'Synthetic record'),
          ('22222222-2222-4222-8222-222222222202', v_demo_customer_id, 'DEMO-JOB-001', current_date - interval '6 day', 'Demo delivery batch B', 38.0, 'Synthetic record'),
          ('22222222-2222-4222-8222-222222222203', v_demo_customer_id, 'DEMO-JOB-002', current_date - interval '9 day', 'Demo delivery batch C', 52.0, 'Synthetic record');
      elsif v_deliveries_has_contract_id then
        insert into public.deliveries (
          customer_id,
          contract_id,
          job,
          delivery_date,
          record,
          quantity,
          remark
        )
        values
          (v_demo_customer_id, 'DEMO-C-001', 'DEMO-JOB-001', current_date - interval '11 day', 'Demo delivery batch A', 36.0, 'Synthetic record'),
          (v_demo_customer_id, 'DEMO-C-001', 'DEMO-JOB-001', current_date - interval '6 day', 'Demo delivery batch B', 38.0, 'Synthetic record'),
          (v_demo_customer_id, 'DEMO-C-002', 'DEMO-JOB-002', current_date - interval '9 day', 'Demo delivery batch C', 52.0, 'Synthetic record');
      else
        insert into public.deliveries (
          customer_id,
          job,
          delivery_date,
          record,
          quantity,
          remark
        )
        values
          (v_demo_customer_id, 'DEMO-JOB-001', current_date - interval '11 day', 'Demo delivery batch A', 36.0, 'Synthetic record'),
          (v_demo_customer_id, 'DEMO-JOB-001', current_date - interval '6 day', 'Demo delivery batch B', 38.0, 'Synthetic record'),
          (v_demo_customer_id, 'DEMO-JOB-002', current_date - interval '9 day', 'Demo delivery batch C', 52.0, 'Synthetic record');
      end if;
    exception when others then
      raise notice 'Skip deliveries seed due to schema mismatch: %', sqlerrm;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- G) Verification helpers
-- ---------------------------------------------------------------------------
-- select id, email, username, role, customer_id from public.users where lower(email) = lower('demo@origo.local');
-- select id, company_name, email from public.customers where id = 'demo';
-- select customer_id, count(*) from public.your_product_requests where customer_id = 'demo' group by customer_id;
-- select customer_id, count(*) from public.stock where customer_id = 'demo' group by customer_id;
-- select customer_id, count(*) from public.finance_invoices where customer_id = 'demo' group by customer_id;
-- select customer_id, count(*) from public.contract_lines where customer_id = 'demo' group by customer_id;
-- select customer_id, count(*) from public.deliveries where customer_id = 'demo' group by customer_id;
