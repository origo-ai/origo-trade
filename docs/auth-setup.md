# ORIGO Unified Auth Setup (Supabase)

## 1) Run schema
Use one of these:
- Run `supabase db push`
- Or run the latest auth migration in Supabase SQL Editor:
  - `supabase/migrations/20260223095250_8bc5a832-e0e9-47ab-b94f-04644638e72f.sql`

## 2) Create Auth users
Go to Supabase Dashboard:
- `Authentication` -> `Users` -> `Add user`
- Create users with email + password

## 3) Insert profile rows in `public.users`
For each auth user, insert profile data:

```sql
insert into public.users (id, email, username, is_active)
values
  ('<auth_user_uuid>', 'admin@origo.com', 'origo_admin', true),
  ('<auth_user_uuid_2>', 'customer@company.com', 'customer_demo', true);
```

## 4) Insert role rows in `public.user_roles`
The current schema stores roles separately from the user profile:

```sql
insert into public.user_roles (user_id, role)
values
  ('<auth_user_uuid>', 'admin'),
  ('<auth_user_uuid_2>', 'customer');
```

Notes:
- `username` is used for login when the user does not type `@`.
- `role` is lowercase in `public.user_roles`:
  - `admin` -> `/admin`
  - `customer` -> `/market-intelligence`
- Username login depends on the `resolve_login_email(...)` function from the auth migration above.

## 5) Optional demo users
You can seed demo accounts with the Edge Function:
- `supabase/functions/seed-demo-users/index.ts`

Seeded accounts:
- `admin@origo.com` / `admin123!`
- `customer@origo.com` / `customer123!`

## 6) Password reset
The app uses `supabase.auth.resetPasswordForEmail(...)`.
Reset link expiry is configured in Supabase Auth settings.
Recommended expiry: `30-60 minutes`.

## 7) Environment
Ensure `.env.local` has:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Legacy note:
- `VITE_SUPABASE_ANON_KEY` is still accepted as a fallback for older local setups.
