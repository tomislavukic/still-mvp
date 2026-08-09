# CompanyOS production audit

Date: 2026-08-09

Scope: authenticated company experience, active Cloudflare Worker dependency graph, D1-backed business APIs, public CompanyOS assets, authorization boundaries, and the 29 capabilities advertised by the former product tour.

## Architecture found

- The production Worker entrypoint is `merchant-backend/worker-v108.js`. It delegates through the v107, v106, v105, v104, v103, v96, v95, v92, v83 and v79 wrappers. The v79 router also delegates company requests through the v75 → v74 → v73 → v72 → v71 → v69 → v68 → v67 → v51 → v48 → v46 → base Worker chain.
- Company authentication uses the `still_company` HttpOnly, Secure, SameSite=Lax cookie. Sessions are resolved server-side and joined to an active member and organization.
- Buyer and company authentication are separate. Business queries are scoped with the organization ID resolved from the authenticated session rather than a tenant ID supplied by the browser.
- Existing company data is stored in D1 across operational, commerce, service, lifecycle, passport, case, rewards, branch, notification and ESL tables.
- The authenticated loader currently loads both real feature modules and a separate demo stack.

## Critical findings

1. `company-preview-v97.js` contains all 29 advertised tools as hardcoded sample rows, KPIs and simulated actions.
2. `company-demo-v102.js` persists simulated records in session storage. Those records are not production business records.
3. `company-unified-workspace-v109.js` relabels demo/session records as organization drafts and copies them to local storage. This changes wording but not the underlying production behavior.
4. `company-progressive-access-v108.js` and `company-capabilities-v1.js` infer subscription plans that do not exist in the authenticated company response or backend authorization model.
5. `merchant-backend/worker-v107.js` is a pass-through file containing capability strings only to satisfy validation. It does not implement `platform_audit_events`, operations roles, admin audit or request completion.
6. The application has two overlapping inventory models (`ops_*` and `inventory_*`). Both are real, but the split prevents one canonical stock identity across every workflow.
7. Real tools are rendered as many independent modules. There is no production Situation, Living Object or Adaptive Workspace model.
8. Existing tenant checks are generally server-side and organization-scoped, but permissions are inconsistent between wrappers and several older routes gate all use on verification rather than only public, financial or buyer-facing actions.
9. Several compatibility scripts are empty files. They are not functionality and must not be counted as completed modules.
10. External email, SMS, push, carrier, accounting and payment-provider operations are not fully configured. The UI must not present them as connected.

## Capability inventory before remediation

| # | Advertised capability | Real production implementation found | Audit classification |
|---|---|---|---|
| 01 | Inventory and locations | `worker-v108` inventory CRUD and balances; `worker-v96` stock, lots, reservations and movements | Partially functional; duplicated models and disconnected UI |
| 02 | Passport traceability | Ownership passports, commitments, expiring/revocable QR shares and verification endpoints in `worker-v83` | Functional backend, disconnected from adaptive workspace |
| 03 | Suppliers and purchase orders | Suppliers, purchase orders, receiving and stock propagation in `worker-v96` | Functional backend, disconnected UI |
| 04 | Repairs and spare parts | Repair jobs, part consumption, stock deduction, service events and audit in `worker-v96` | Functional backend, module UI only |
| 05 | Returns and refurbishment | RMA creation, disposition, refund amount record and stock return in `worker-v96` | Functional internal workflow; no payment-provider refund |
| 06 | Warranty | Passport warranty dates, lifecycle commitments, support records and case data | Partially functional; no unified warranty workspace |
| 07 | Orders and fulfilment | Commerce orders plus stock reservations and completion synchronization | Functional backend; payment depends on configured provider |
| 08 | Rentals and subscriptions | Agreements and lifecycle assets/contracts | Functional backend, disconnected UI |
| 09 | CRM and private quotes | CRM contacts/quotes and commerce buyer requests/private quotes | Functional backend, overlapping models |
| 10 | Appointments and workforce | Staff, conflict-checked appointments, resources and capacity | Functional backend, disconnected UI |
| 11 | Batch and serial recalls | Targeted recall campaigns, passport alerts and buyer acknowledgement | Functional backend, verified-company gated |
| 12 | Analytics and audit | Deterministic queries plus `ops_audit_log` and `merchant_audit_events` | Functional data; advertised sample KPIs are fake |
| 13 | Company Passport Studio | Company-issued passports and commitments | Functional backend, verified-company gated |
| 14 | Passport Commerce | Offers, requests, quotes, orders and optional Stripe webhook flow | Partially functional; provider-dependent operations must remain unavailable until configured |
| 15 | Services and bookings | Catalog, resources, engagements, milestones, changes, contracts and completion evidence | Functional backend |
| 16 | Lifecycle and service history | Templates, assets, commitments, support, alerts and service events | Functional backend |
| 17 | Buyer case inbox | Cases, decisions, messages, internal notes, assignment and escalation | Functional backend |
| 18 | Rewards and reputation | Offers, one-time redemption, balances and outcome reputation | Functional internal ledger; external funding is not implemented |
| 19 | Branches and retailer identity | Branch CRUD, public verified branches and retailer claims | Functional backend |
| 20 | Verification and team access | Verification review, member list and role-aware access | Partially functional; secure invitation delivery is intentionally unavailable |
| 21 | Integration readiness | Real webhook settings/test endpoint; other connectors are not configured | Partial; former sample table is not a real integration registry |
| 22 | Tasks, approvals and daily operations | Persistent tasks, approval policies, approvals, Today queue and summaries | Functional backend |
| 23 | Service milestones and changes | Persistent milestones, change review and completion events | Functional backend |
| 24 | Capacity and resource planning | Persistent resources and daily capacity with schedule conflict checks | Functional backend |
| 25 | Customer 360 | Tenant-scoped relationship timeline across cases, services, contracts, tasks and commitments | Functional backend |
| 26 | Playbooks and follow-up rules | Persistent playbooks and immediate task creation; rules persist | Partial; no unattended background runner |
| 27 | Supplier claims and warranty recovery | Persistent supplier recovery register linked to buyer cases | Functional backend |
| 28 | Notifications and preferences | Tenant notifications derived from real events with read state | Partial; external delivery channels are unavailable |
| 29 | B2B asset passports | Lifecycle assets, commitments, service history and company-owned passports | Functional backend |

## Production remediation decisions

- Remove demo/session/local-storage business records from the production bundle after the real adaptive workspace is integrated.
- Keep existing APIs and tables compatible; add a CompanyOS orchestration layer rather than replacing domain services.
- Resolve tenant identity only from the authenticated company session.
- Use canonical public IDs from existing tables as Living Object identities. Do not copy real records into a parallel frontend store.
- Derive Situations, Pulse and Company Memory only from persisted tenant data.
- Permit authenticated companies to use safe internal workspace functions before verification. Continue enforcing verification for public representation, buyer routing, company-issued public passports, recalls and financial operations.
- Expose unsupported external integrations as unavailable, never as successful or simulated.
- Replace string-presence validation with behavior/capability validation.

