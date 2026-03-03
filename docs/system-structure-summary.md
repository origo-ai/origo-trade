# ORIGO Web App Structure Summary

## 1) Tech Stack
- Frontend: React + TypeScript + Vite
- Frontend package root: `frontend/`
- Backend package root: `backend/`
- UI: shadcn/ui + Tailwind
- Routing: `react-router-dom`
- Data fetch/state:
- Supabase client (`frontend/src/lib/supabase.ts`)
- React Query provider (`frontend/src/app/App.tsx`)
- App-level contexts:
- Auth: `frontend/src/contexts/AuthContext.tsx`
- Backoffice data: `frontend/src/contexts/AdminDataContext.tsx`

## 2) App Entry & Layout
- Entry routing: `frontend/src/app/App.tsx`
- Protected layout shell: `frontend/src/components/layout/AppLayout.tsx`
- Desktop sidebar: `frontend/src/components/layout/AppSidebar.tsx`
- Mobile bottom nav: `frontend/src/components/layout/MobileTabBar.tsx`
- Nav definitions: `frontend/src/components/layout/navItems.ts`

## 3) Source Tree (High-Level)
```text
frontend/
  src/
    components/    # reusable UI + feature components
    contexts/      # AuthContext, AdminDataContext
    data/          # data adapters/transformers (market intelligence)
    data-access/   # frontend data access helpers
    features/      # route-level pages by domain
    hooks/         # custom hooks
    lib/           # Supabase/data services/utilities
    types/         # shared types
backend/
  server/          # express API + sqlite runtime
  scripts/         # backend utilities
supabase/          # shared migrations/functions
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
- Customer scope resolution in `frontend/src/data-access/customer/scope.ts`
- Data pages query Supabase with `customer_id` filter (where implemented)
- RLS/migration scripts live in `docs/sql/`

## 6) Core Page → Table Mapping

### Customer side
- Market Intelligence:
- adapter `frontend/src/data/market-intelligence/companyListSource.ts`
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
- service `frontend/src/data-access/products/yourProductData.ts`
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
- `frontend/src/features/market-intelligence/pages/MarketIntelligenceCompanyProfile.tsx`
- `frontend/src/features/market-intelligence/pages/MarketIntelligence.tsx`
- `frontend/src/components/contracts/ContractTable.tsx`
- `frontend/src/features/ai-agent/data/customerAiAgent.ts`
- `frontend/src/data-access/products/yourProductData.ts`
- Legacy compatibility in YOUR Product data layer still present
- Bundle size warning remains (need route/module code splitting)

## 9) Environment Variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPBOX_TOKEN`
- `VITE_ADMIN_API_URL` (optional; only if backend API is used)
