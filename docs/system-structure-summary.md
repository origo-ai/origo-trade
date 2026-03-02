# ORIGO Web App Structure Summary

## 1) Tech Stack
- Frontend: React + TypeScript + Vite
- UI: shadcn/ui + Tailwind
- Routing: `react-router-dom`
- Data fetch/state:
- Supabase client (`src/lib/supabase.ts`)
- React Query provider (`src/App.tsx`)
- App-level contexts:
- Auth: `src/contexts/AuthContext.tsx`
- Backoffice data: `src/contexts/AdminDataContext.tsx`

## 2) App Entry & Layout
- Entry routing: `src/App.tsx`
- Protected layout shell: `src/components/layout/AppLayout.tsx`
- Desktop sidebar: `src/components/layout/AppSidebar.tsx`
- Mobile bottom nav: `src/components/layout/MobileTabBar.tsx`
- Nav definitions: `src/components/layout/navItems.ts`

## 3) Source Tree (High-Level)
```text
src/
  components/      # reusable UI + feature components
  contexts/        # AuthContext, AdminDataContext
  data/            # data adapters/transformers (market intelligence)
  hooks/           # custom hooks
  lib/             # Supabase/data services/utilities
  pages/           # customer pages
  pages/admin/     # admin pages
  types/           # shared types
docs/sql/          # DB migration/policy/seed scripts
```

## 4) Route Map

### Public
- `/login`
- `/forgot-password`
- `/reset-password`

### Customer
- `/market-intelligence`
- `/market-intelligence/company/:companyId`
- `/my-company/performance`
- `/my-company/orders`
- `/my-company/inventory`
- `/my-company/invoices`
- `/ai-agent`
- `/upload`
- `/upload/edit-data`
- `/upload/your-product`

### Admin
- `/admin`
- `/admin/dashboard`
- `/admin/backoffice`
- `/admin/customers`
- `/admin/users`
- `/admin/data`
- `/admin/products`

## 5) Data Flow (Auth → Scope → Data)
- Login via Supabase Auth in `AuthContext`
- App resolves user profile from `public.users`
- Customer scope resolution in `src/lib/customerScope.ts`
- Data pages query Supabase with `customer_id` filter (where implemented)
- RLS/migration scripts live in `docs/sql/`

## 6) Core Page → Table Mapping

### Customer side
- Market Intelligence:
- adapter `src/data/market-intelligence/companyListSource.ts`
- tables: `company_overview`, `company_basic_info`, `company_contacts`, `purchase_trend`/`purchase_trends`, `supabase_companies`/`companies`
- Market Intelligence Company Profile:
- `supabase_companies`, `companies` + per-table profile lookups
- Trade Performance (`MyCompany`):
- `contract_lines`, `stock`, `finance_invoices`, `deliveries`, `your_product_requests`
- Orders & Shipments:
- `contract_lines`, `deliveries`
- Inventory:
- `stock`
- Invoices & Payments:
- `finance_invoices`
- AI Agent:
- `customers`, `uploads`, `finance_invoices`, `stock`, `purchase_trend`, `contract_lines`, `deliveries`
- YOUR Product:
- service `src/lib/yourProductData.ts`
- tables: `your_product_requests`, `ready_page_products`, `ready_page_buyer_signals`

### Admin side
- Admin context CRUD:
- `customers`, `admin_users`, `uploads`, `activity_logs`

## 7) Key SQL/DB Ops Files
- `docs/sql/00_trr_scope_hotfix.sql`
- `docs/sql/01_scope_migration.sql`
- `docs/sql/02_rls_policies.sql`
- `docs/sql/03_demo_seed.sql`
- `docs/sql/04_remove_demo.sql`

## 8) Current Refactor Hotspots
- Very large files (split needed):
- `src/pages/MarketIntelligenceCompanyProfile.tsx`
- `src/pages/MarketIntelligence.tsx`
- `src/components/contracts/ContractTable.tsx`
- `src/lib/customerAiAgent.ts`
- `src/lib/yourProductData.ts`
- Legacy compatibility in YOUR Product data layer still present
- Bundle size warning remains (need route/module code splitting)

## 9) Environment Variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPBOX_TOKEN`
- `VITE_ADMIN_API_URL` (optional; only if backend API is used)
