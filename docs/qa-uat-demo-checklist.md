# QA + UAT Checklist (TRR vs Demo)

## Scope
- Compare `trrgroup` account and `demo@origo.local` account.
- Verify data isolation across customer-facing modules.
- Verify no cross-account data exposure via UI and API-backed pages.

## Test Matrix
| Area | Scenario | Expected (TRR) | Expected (Demo) | Status |
|---|---|---|---|---|
| Login | Sign in with valid credentials | Login success | Login success | ☐ |
| Trade Performance | Open `/my-company` | TRR-only KPI | Demo-only KPI (different values) | ☐ |
| Orders & Shipments | Open `/my-company/orders` | TRR-only contracts/deliveries | Demo-only contracts/deliveries | ☐ |
| Inventory | Open `/my-company/inventory` | TRR-only stock rows | Demo-only stock rows | ☐ |
| Invoices & Payments | Open `/my-company/invoices` | TRR-only invoices | Demo-only invoices | ☐ |
| YOUR Product | Open `/upload/your-product` | TRR request list only | Demo request list only | ☐ |
| Market Intelligence | Ready product scope options | Derived from TRR requests | Derived from demo requests | ☐ |
| AI Agent | Ask inventory/invoice/orders summary | TRR-scoped result | Demo-scoped result | ☐ |

## Cross-Account Negative Tests
1. Login as `trrgroup`, capture one record id from demo dataset (if known), attempt to open related detail page.
Expected: record not visible.

2. Login as `demo@origo.local`, attempt filters/search keywords that match TRR customers.
Expected: no TRR rows returned.

3. Verify direct table-backed pages do not show mixed aggregates (counts, totals, charts).
Expected: totals differ between accounts and align with each account dataset.

## Regression Checks
1. Admin pages still work for admin account.
2. Existing customer account without `customer_id` mapping shows clear setup error.
3. App build and lint are clean after scope changes.

## Sign-off
- QA Owner:
- UAT Owner:
- Date:
- Notes:

Use `docs/uat-signoff-sheet.md` for final approval record.
