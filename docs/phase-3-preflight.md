# Phase 3 preflight · Needs and Resolution

## Confirmed architecture

- The active branch builds Bundle 133 and delegates `worker-v133.js` through the existing Worker chain. CompanyOS remains behind its existing company session and verification boundaries.
- Authenticated consumers enter `/app`. Now, World, Discover, Together and refresh-safe Thing, Situation, Knowledge, Receipt and Open Loop routes use server data.
- The World foundation persists Things, receipts, documents, Knowledge, Situations, Open Loops, relationships and History in D1. Receipt and document originals are private in the `WORLD_FILES` R2 bucket.
- Product Passport reads include provenance and evidence. Universal Input routes without persisting until the user confirms. Sight reuses canonical receipt OCR and document ingestion.
- Legacy browser ownership uses the owner-scoped idempotent migration endpoint; the old public ownership modules remain secondary compatibility surfaces rather than the signed-in home.

Preflight validation passed JavaScript syntax, Bundle 133 generation, the production smoke suite, 52 World assertions and 28 Still OS assertions.

## Relevant existing APIs and models

- `/api/v1/world/bootstrap`, `/now`, `/search`, `/history`
- `/api/v1/world/things`, `/receipts`, `/documents`, `/knowledge`, `/situations`, `/open-loops`, `/relationships`
- `/api/v1/world/context/:entityType/:id` and `/input/route`
- Existing `ownership_passports`, `world_*` tables and `world_history_events`
- Existing buyer/company commerce, service and quote APIs are company-scoped or tied to explicit commerce requests. They are not suitable as general consumer resolution providers without an intentional Trust Layer connection.

## Market and service hooks

The repository contains verified-company service operations and real commerce offer/request flows. Phase 3 will not expose them as Need options automatically: there is no safe general provider-matching contract, availability feed or neutral ranking layer yet. Public retailer directories are external policy links, not provider availability.

## Missing infrastructure to add

- First-class owner-scoped Need persistence and lifecycle
- Buyer-owned repair/service quotes independent of company commerce quotes
- Resolution outcomes and History linkage
- Deterministic resolution provider interface for existing World, Knowledge and internal actions
- Need-aware Now/context aggregation and `/app/need/:id`
- Short adaptive Need intake and factual quote comparison

## Risks and constraints

- Do not reinterpret generic Open Loops as Needs or silently resolve a Need when an Open Loop completes.
- Existing Market/service modules must not become implied availability, pricing or endorsement.
- Matching must remain conservative and explainable; insufficient information is a valid result.
- Quote documents remain private and owner-scoped. No company receives Need data in Phase 3.
- The managed development sandbox blocks loopback listeners, so the seeded Wrangler HTTP runner must also execute in CI or an unrestricted local environment. Static, build, security and Wrangler dry-run validation remain available here.
