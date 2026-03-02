-- Hotfix: Restore TRR visibility after customer scope rollout
-- Use this when `trrgroup` logs in but sees empty customer datasets.
-- Safe to run multiple times.

do $$
declare
  v_default_trr_email constant text := 'info@farihealth.com';
  v_default_trr_username constant text := 'trrgroup';
  v_trr_company_hint constant text := 'thai roong ruang';
  v_trr_user_id uuid;
  v_trr_email text;
  v_trr_username text;
  v_trr_customer_id text;
  v_workspace_hint text;
  v_base_customer_id text;
  v_trr_company_name text;
  v_trr_invoice_count integer := 0;
  v_suffix integer := 0;
begin
  if to_regclass('public.users') is null then
    raise exception 'public.users not found. Run docs/supabase-auth-schema.sql first.';
  end if;
  if to_regclass('public.customers') is null then
    raise exception 'public.customers not found. Run docs/supabase-schema.sql first.';
  end if;

  select
    u.id,
    lower(trim(u.email)),
    lower(trim(u.username))
  into
    v_trr_user_id,
    v_trr_email,
    v_trr_username
  from public.users u
  where lower(trim(u.username)) = v_default_trr_username
     or lower(trim(u.email)) = v_default_trr_email
  order by
    case when lower(trim(u.username)) = v_default_trr_username then 0 else 1 end
  limit 1;

  if v_trr_user_id is null then
    raise exception
      'TRR user not found in public.users. Expected username=% or email=%',
      v_default_trr_username,
      v_default_trr_email;
  end if;

  if to_regclass('public.your_product_requests') is not null then
    select nullif(trim(ypr.customer_workspace), '')
    into v_workspace_hint
    from public.your_product_requests ypr
    where lower(trim(coalesce(ypr.customer_username, ''))) = v_trr_username
       or lower(trim(coalesce(ypr.customer_email, ''))) = v_trr_email
    limit 1;
  end if;

  select c.id
  into v_trr_customer_id
  from public.customers c
  where lower(trim(c.email)) = v_trr_email
     or lower(trim(c.id)) = v_trr_username
     or lower(trim(c.id)) like '%' || v_trr_username || '%'
     or lower(trim(c.company_name)) like '%' || v_trr_company_hint || '%'
     or (v_workspace_hint is not null and lower(trim(c.company_name)) = lower(trim(v_workspace_hint)))
  order by
    case
      when lower(trim(c.email)) = v_trr_email then 0
      when lower(trim(c.id)) = v_trr_username then 1
      when lower(trim(c.company_name)) like '%' || v_trr_company_hint || '%' then 2
      else 3
    end,
    c.id
  limit 1;

  if v_trr_customer_id is null then
    v_base_customer_id := regexp_replace(coalesce(v_trr_username, v_default_trr_username), '[^a-z0-9]+', '-', 'g');
    if v_base_customer_id is null or v_base_customer_id = '' then
      v_base_customer_id := 'trrgroup';
    end if;

    v_trr_customer_id := v_base_customer_id;
    while exists (
      select 1
      from public.customers c
      where c.id = v_trr_customer_id
        and lower(trim(c.email)) <> v_trr_email
    ) loop
      v_suffix := v_suffix + 1;
      v_trr_customer_id := v_base_customer_id || '-' || v_suffix::text;
    end loop;

    begin
      insert into public.customers (
        id,
        company_name,
        contact_name,
        email,
        status,
        notes,
        updated_at
      )
      values (
        v_trr_customer_id,
        coalesce(v_workspace_hint, 'THAI ROONG RUANG INDUSTRY CO., LTD.'),
        'TRR Team',
        v_trr_email,
        'active',
        'Autocreated by docs/sql/00_trr_scope_hotfix.sql',
        now()
      )
      on conflict (id) do update
      set email = excluded.email,
          status = 'active',
          updated_at = now();
    exception when unique_violation then
      select c.id
      into v_trr_customer_id
      from public.customers c
      where lower(trim(c.email)) = v_trr_email
      limit 1;

      if v_trr_customer_id is null then
        raise;
      end if;
    end;
  end if;

  update public.users u
  set customer_id = v_trr_customer_id
  where u.id = v_trr_user_id
     or lower(trim(u.username)) = v_trr_username
     or lower(trim(u.email)) = v_trr_email;

  select c.company_name
  into v_trr_company_name
  from public.customers c
  where c.id = v_trr_customer_id
  limit 1;

  if to_regclass('public.your_product_requests') is not null then
    update public.your_product_requests ypr
    set customer_id = v_trr_customer_id
    where coalesce(ypr.customer_id, '') <> v_trr_customer_id
      and (
        lower(trim(coalesce(ypr.customer_email, ''))) = v_trr_email
        or lower(trim(coalesce(ypr.customer_username, ''))) = v_trr_username
        or (v_workspace_hint is not null and lower(trim(coalesce(ypr.customer_workspace, ''))) = lower(trim(v_workspace_hint)))
        or lower(trim(coalesce(ypr.customer_workspace, ''))) like '%' || v_trr_company_hint || '%'
      );
  end if;

  if to_regclass('public.finance_invoices') is not null then
    -- 1) Strong mapping via contract id from contract_lines.
    if to_regclass('public.contract_lines') is not null then
      update public.finance_invoices fi
      set customer_id = v_trr_customer_id
      from public.contract_lines cl
      where cl.customer_id = v_trr_customer_id
        and cl.contract_id is not null
        and fi.contract is not null
        and lower(trim(fi.contract::text)) = lower(trim(cl.contract_id::text))
        and coalesce(fi.customer_id, '') <> v_trr_customer_id;
    end if;

    -- 2) Name/workspace based mapping.
    update public.finance_invoices fi
    set customer_id = v_trr_customer_id
    where (fi.customer_id is null or fi.customer_id <> v_trr_customer_id)
      and (
        lower(trim(coalesce(fi.customer_name, ''))) like '%' || v_trr_company_hint || '%'
        or (
          v_workspace_hint is not null
          and lower(trim(coalesce(fi.customer_name, ''))) = lower(trim(v_workspace_hint))
        )
        or (
          v_trr_company_name is not null
          and (
            lower(trim(coalesce(fi.customer_name, ''))) = lower(trim(v_trr_company_name))
            or lower(trim(coalesce(fi.customer_name, ''))) like '%' || lower(trim(v_trr_company_name)) || '%'
          )
        )
      );

    select count(*)
    into v_trr_invoice_count
    from public.finance_invoices fi
    where fi.customer_id = v_trr_customer_id;

    -- 3) Safety fallback: if still zero, map remaining NULL/non-demo invoices to TRR.
    if v_trr_invoice_count = 0 then
      update public.finance_invoices fi
      set customer_id = v_trr_customer_id
      where (fi.customer_id is null or trim(fi.customer_id) = '')
        and coalesce(upper(trim(fi.invoice)), '') not like 'DEMO-%'
        and lower(trim(coalesce(fi.customer_name, ''))) not like '%demo%';
    end if;
  end if;

  -- Legacy rows in these tables usually come from TRR-only dataset.
  if to_regclass('public.stock') is not null then
    update public.stock s
    set customer_id = v_trr_customer_id
    where s.customer_id is null or trim(s.customer_id) = '';
  end if;

  if to_regclass('public.contract_lines') is not null then
    update public.contract_lines cl
    set customer_id = v_trr_customer_id
    where cl.customer_id is null or trim(cl.customer_id) = '';
  end if;

  if to_regclass('public.deliveries') is not null then
    update public.deliveries d
    set customer_id = v_trr_customer_id
    where d.customer_id is null or trim(d.customer_id) = '';
  end if;

  select count(*)
  into v_trr_invoice_count
  from public.finance_invoices fi
  where fi.customer_id = v_trr_customer_id;

  raise notice 'TRR scope mapped: username=%, email=%, customer_id=%, invoice_count=%',
    v_trr_username,
    v_trr_email,
    v_trr_customer_id,
    v_trr_invoice_count;
end $$;

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

revoke all on function public.current_customer_id() from public;
grant execute on function public.current_customer_id() to authenticated;

-- Verification:
-- select id, email, username, customer_id from public.users where lower(username)='trrgroup' or lower(email)='info@farihealth.com';
-- select public.current_customer_id();
-- select count(*) from public.stock where customer_id = (select customer_id from public.users where lower(username)='trrgroup' limit 1);
