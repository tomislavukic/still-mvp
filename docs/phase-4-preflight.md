# Phase 4 preflight

Date: 2026-08-12

## Confirmed foundations

- The authenticated buyer session and owner-scoped World APIs are active through `worker-v134.js`.
- Canonical Things use `ownership_passports` plus `world_thing_profiles`; receipts, evidence, History, Knowledge, Situations, Open Loops, Needs, resolution outcomes and relationships persist in D1.
- Thing duplicate review, private R2 receipt/document delivery, Product Passport context, deep links and responsive Still OS routes are covered by the current validation suite.
- Phase 3 supplies persisted Needs and deterministic resolution providers without fake commercial results.

## Reusable code

- Buyer session, same-origin checks, canonical Thing ownership queries and History statements can be reused by a new additive Market Worker.
- Existing World evidence can produce explainable Product Trust components without exposing raw receipt images or serial numbers.
- Existing Need links/outcomes and World History can record sale and purchase completion.
- Still OS provides the authenticated shell, routing, dialogs, mobile navigation and context workspaces.

## Existing code that is not C2C Market

- `market-catalog-v36.js` is a browser-side retailer/country directory for consumer-rights flows. It is not a listing store or matching engine.
- `passport-commerce-v92.js` and `worker-v92.js` implement verified-business offers and orders. They are Company commerce, not peer-to-peer ownership transfer.
- The Company commerce Worker can use Stripe Connect only when platform credentials and connected-account onboarding are genuinely configured. Its current credential-absent path is explicitly a demo checkout and must not be reused for C2C.
- Legacy localStorage ownership and saved-purchase modules remain compatibility surfaces for the public site; they are not acceptable Market persistence.

## Payment and delivery capability

- The repository has no verified C2C marketplace payment configuration, compliant escrow flow or consumer connected-account onboarding.
- There is no real carrier/shipping-provider adapter or tracking integration.
- Phase 4 must therefore use explicit `EXTERNAL_MANUAL` payment and `PICKUP` or `SHIPPING_EXTERNAL` delivery states. Still does not hold money, provide escrow or fabricate tracking.

## Missing infrastructure to add

- Canonical-Thing listings, structured condition disclosure and product-trust summaries.
- Wanted Objects, deterministic matching, private reverse matching preferences and private consider-price records.
- Persisted offers with immutable counter history, participant-only deals and both-party handoff confirmation.
- Ownership-transfer records with an explicit privacy filter and canonical owner change.
- Market notifications, reports and user blocks.
- Public-safe paginated search DTOs and authenticated Still OS Market workspaces.

## Policy and technical risks

- C2C payments, taxes, marketplace liability, KYC, consumer/seller classification and dispute handling require legal and provider review before in-platform payments.
- Shipping remains outside Still until a real provider is configured.
- Raw receipts, private notes, documents, addresses and relationship graphs must remain with the seller during transfer.
- Product Trust must remain component-based; no unearned badge or score can be shown.
- Category support must use a conservative allowlist. Unsupported or regulated goods must be rejected rather than silently listed.
