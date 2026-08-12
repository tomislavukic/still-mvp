# Phase 2 · Still OS

Phase 2 turns the authenticated consumer experience into one environment at `/app`. It is additive over the Phase 1 World foundation and does not replace the existing CompanyOS or buyer/company authentication boundary.

## Runtime model

- `/app` and `/app/*` are served by the Worker only after a valid `still_buyer` session is verified.
- Signed-out app requests return to the public site with the buyer sign-in panel requested.
- `GET /api/v1/world/now` returns deterministic attention, one dominant context, recent history and an honest quiet state.
- `GET /api/v1/world/context/:entityType/:id` aggregates only owner-authorized entity, relationship, loop and History data.
- `POST /api/v1/world/input/route` classifies text with deterministic rules and never persists it. The client requires an explicit destination before calling an existing canonical create endpoint.
- Sight reuses Phase 1 receipt OCR, private R2 document storage, Knowledge, Situation and relationship APIs. It does not claim product recognition.

## Primary spaces

- **Now** — real attention and recent context.
- **World** — persisted Things, Knowledge and Situations.
- **Discover** — deterministic recently saved Knowledge only; no invented recommendations.
- **Together** — existing buyer/company relationships only; no simulated collaboration.

Thing, Situation, Knowledge, Receipt and Open Loop workspaces use refresh-safe deep links below `/app`. Deeper records are loaded lazily through the context service rather than preloading every private document or receipt.

## Compatibility

Legacy browser ownership records are submitted to the existing idempotent migration endpoint before the OS first renders. Existing public ownership tools remain shipped as secondary compatibility surfaces. CompanyOS routes, APIs, D1 database identifiers, R2 binding and production data schemas are unchanged.

## Rollback

Pointing Wrangler back to `merchant-backend/worker-v131.js` removes the Phase 2 `/app` and context wrapper without deleting Phase 1 World rows, R2 objects, CompanyOS data or existing APIs. Re-enabling `worker-v133.js` restores the OS shell over the same records.
