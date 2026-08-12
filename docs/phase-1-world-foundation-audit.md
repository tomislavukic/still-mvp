# Phase 1 World Foundation audit

Date: 2026-08-12

This note records the production data paths inspected before Phase 1 implementation. It distinguishes durable behavior from browser-only and presentation-only behavior so the World foundation can reuse the working platform instead of introducing a parallel product model.

## Current architecture

| Area | Current source of truth | Classification | Phase 1 decision |
| --- | --- | --- | --- |
| Buyer identity | `buyer_accounts`, `buyer_sessions`, and the `still_buyer` HttpOnly session cookie in `merchant-backend/worker-v77.js` | Real, server persisted | Reuse unchanged. Every World API resolves ownership from the active buyer session. |
| Buyer/company separation | Routing and cookie boundaries in `merchant-backend/worker-v79.js` and later delegated workers | Real | Preserve. World routes are buyer-only; CompanyOS routes and the `still_company` session remain separate. |
| Owned products / Product Passports | `ownership_passports`, commitments, and public shares in `merchant-backend/worker-v83.js` | Real, server persisted | Reuse each ownership passport as the canonical identity/lifecycle row for a Thing. Add a keyed profile for richer Thing fields; do not create a second owned-product identity. |
| Browser ownership collection | `still-ownership-passports-v83` in `ownership-platform-v83.js`, read by Home and Feed | Local-only duplicate state | Migrate idempotently after buyer authentication, then make server World data canonical. Keep a compatibility cache only for offline rendering. |
| Ownership Home / activity feed | `ownership-home-v112.js` and `ownership-feed-v113.js` derive from localStorage | Real derivation over non-durable input | Replace their data input through the World API and deterministic Now/history responses. |
| Buyer manual add | `ownership-platform-v83.js` creates a local passport and optional later sync | Partly real, not durable by default | Route authenticated creation directly through canonical World Things. Incomplete Things remain valid. |
| Existing receipt scanner | `purchase-intelligence-v67.js` uses browser `TextDetector` where available and writes suggestions into the rights checker form | Local-only and browser-dependent; no stored receipt, line items, review record, or retry state | Preserve the rights checker, but replace the ownership Capture entry with an authenticated upload/OCR/review/confirm pipeline. OCR remains explicitly unverified. |
| Ownership onboarding | `ownership-onboarding-v111.js` waits for legacy form fields and then presents those values as “found” | Presentation-only handoff; can report a result without a durable receipt | Replace Capture behavior with the real receipt pipeline. No simulated completion. |
| Saved return checks | `still-saved-purchases-v1`, `still-cases-v1`, and backup support | Browser-only legacy data | Do not silently delete. Offer authenticated import into Things with an idempotent migration fingerprint. |
| Connected buyer cases | Server cases plus browser-held access tokens in `buyer-case-v60.js` | Server record is real; browser token is required for private access | Preserve. Do not move or expose access tokens in Phase 1. Cases may be linked later through explicit authorized relationships. |
| Documents | CompanyOS knowledge import is D1-extracted text only; buyer document UI/service files do not currently provide a canonical durable buyer document model | Company path is real but company-scoped; buyer path is incomplete | Add buyer-scoped private document metadata and object storage. Do not share CompanyOS knowledge rows across the auth boundary. |
| Company document OCR | Workers AI `toMarkdown` in `merchant-backend/worker-v120.js` | Real, company-scoped, original binary intentionally not retained | Reuse the conversion mechanism only. Buyer originals use a private R2 binding and authenticated delivery. |
| Warranties and lifecycle | Passport dates, commitments, `lifecycle-platform-v95.js`, and legacy rights checks | Mixed: passport dates/commitments are durable; some UI state is local | Derive World attention and history from canonical passport fields, evidence, situations, and open loops. Preserve Resolve functionality. |
| Household/family/AI buyer modules | `buyer-ui/` services and tests | Mostly modular client contracts; not the active production persistence path for the current ownership modules | Do not promote unfinished service abstractions to source of truth. Reuse UI vocabulary only where backed by World APIs. |
| Company product identity and QR | Company-created ownership passports and `qrcode-generator-v94.js` | Real | Preserve public share/verification behavior. A World Thing remains compatible with company-issued passports. |
| Schema management | Versioned SQL plus defensive `CREATE TABLE IF NOT EXISTS` in active Workers | Real, additive | Add an additive World schema. No reset, destructive migration, database ID, or existing table change. |
| Production validation | syntax checker, build, smoke test, bundle validator, CodeQL config check, Gitleaks, Wrangler dry-run | Real | Extend smoke/unit coverage for auth isolation, World assets, schema, OCR parsing, validation, deterministic sorting, and migration behavior. |

## Problems found

1. The same owned item can exist in D1 and localStorage, with optional manual synchronization and no durable migration marker.
2. Home, Feed, and onboarding use local browser records rather than the authenticated server collection.
3. The existing receipt OCR produces form suggestions only. It does not create a Receipt, retain the original, parse reviewable line items, record processing failure, detect duplicates, or create provenance/history.
4. Buyer documents, Knowledge, Situations, Open Loops, and cross-domain relationships lack a canonical buyer-authenticated persistence layer.
5. There is no private buyer object-storage binding. Company document extraction discards binaries and cannot satisfy receipt “view original” requirements.
6. The onboarding “Found it” state can be shown from legacy form values rather than a completed OCR job.
7. Existing passport fields do not record per-field provenance, so OCR suggestions cannot be distinguished from buyer-confirmed or verified values.
8. The current buyer experience has no unified server search or deterministic Now response across Things, Knowledge, Situations, Loops, Receipts, and Documents.

## Canonical Phase 1 boundary

- `ownership_passports` remains the canonical owned-object/passport identity and lifecycle record.
- `world_thing_profiles` extends that row one-to-one with product-specific fields and source state.
- Receipts, receipt items, evidence, documents, knowledge, situations, loops, relationships, history, and migration markers are buyer-owned World records.
- Every World query includes the active `buyer_account_id`; a client-supplied owner ID is never trusted.
- Original receipt/document bytes live under buyer-scoped keys in private R2 and are returned only through authenticated Worker routes.
- Workers AI OCR results are suggestions with confidence and source metadata. Only explicit buyer confirmation can create or enrich a Thing.
- Legacy local ownership data is imported once per content fingerprint after authentication. Ambiguous duplicates remain for review and are never auto-merged.

## Reuse, refactor, remove

Reuse unchanged: buyer auth, auth routing, `ownership_passports`, passport commitments/shares, CompanyOS APIs, QR generation, D1 binding, AI binding, and public verification.

Refactor: ownership client data access, Capture onboarding, Home/Feed data inputs, manual Thing creation, and production smoke coverage.

Remove from the primary Capture path: the delayed “Found it” simulation in `ownership-onboarding-v111.js`. The legacy rights-checker scanner remains available for its existing purpose but is no longer presented as durable World receipt capture.

## Rollout and compatibility

The implementation is additive. Existing passport rows remain readable even when no profile exists. World serializers synthesize an incomplete profile from the passport, so rollout does not require a destructive backfill. Legacy browser records stay untouched until an authenticated migration succeeds, and the client records the server migration result before switching its active source to World APIs.
