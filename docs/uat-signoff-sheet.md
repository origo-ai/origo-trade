# UAT Sign-Off Sheet (Demo Scope Isolation)

## Release Information
- Project: ORIGO Trade Insights
- Scope: Demo user isolation (`trrgroup` vs `demo@origo.local`)
- Date:
- Build / Commit:
- Environment:

## Mandatory Sign-Off Criteria
| ID | Criteria | Result (Pass/Fail) | Evidence / Notes |
|---|---|---|---|
| C1 | Demo user can login successfully |  |  |
| C2 | TRR user can login successfully |  |  |
| C3 | Trade Performance KPIs are different between TRR and Demo |  |  |
| C4 | Orders/Deliveries are isolated by account |  |  |
| C5 | Inventory rows are isolated by account |  |  |
| C6 | Invoices are isolated by account |  |  |
| C7 | YOUR Product requests are isolated by account |  |  |
| C8 | AI Agent response is scoped by account |  |  |
| C9 | No cross-account record appears during negative tests |  |  |
| C10 | RLS policies are active on scoped tables |  |  |

## SQL Execution Record
| Script | Executed By | Execution Time | Status | Notes |
|---|---|---|---|---|
| `docs/sql/01_scope_migration.sql` |  |  |  |  |
| `docs/sql/02_rls_policies.sql` |  |  |  |  |
| `docs/sql/03_demo_seed.sql` |  |  |  |  |

## Outstanding Issues / Risk Acceptance
- Issue 1:
- Issue 2:
- Risk accepted by:

## Approvals
- QA Lead:
- Product Owner:
- Engineering Lead:
- Approval Date:

## References
- `docs/sql/runbook-demo-scope.md`
- `docs/qa-uat-demo-checklist.md`
- `docs/demo-user-guide.md`
