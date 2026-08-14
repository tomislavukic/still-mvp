# Phase 7 preflight: Company Network and ownership-native commerce

Date: 2026-08-13

## Existing foundations retained

- `merchant_organizations`, members and hashed sessions remain the sole CompanyOS identity and tenancy boundary.
- Organization verification remains authoritative. A public company projection must never imply verification that the organization has not earned.
- `inventory_items`, `inventory_locations`, `inventory_balances` and `inventory_movements` remain the stock source of truth. Commerce offers link to these records; Phase 7 does not create a second stock count.
- `ownership_passports` and `world_thing_profiles` remain the canonical Buyer World object. A completed order or secure product claim creates or links this model instead of creating a parallel purchase object.
- Needs and deterministic Resolution remain world-first. Existing KEEP, repair, hire, borrow, rent and used-market paths keep their order and semantics; company offers are an additional honest option.
- `market_wanted` remains the Wanted source of truth. Phase 7 enriches its matches with real company offers.
- Existing service, professional, C2C market, rewards, passport, lifecycle and CompanyOS operations remain available.

## Gaps and risks found

1. The legacy commerce Worker can create `provider='demo'` orders and exposes a `demo-complete` route. That is not an honest production payment state and must not be used by the Phase 7 experience.
2. The legacy offer projection always returns `verified:true`. Verification must instead be derived from `merchant_organizations.status`.
3. Legacy products and offers are combined too loosely. Phase 7 separates Company Product, Variant, Offer and Inventory while retaining old records for compatibility.
4. No secure, single-use, hashed QR claim token currently connects a company product to the canonical Buyer World.
5. Company offers are not integrated into Needs, Wanted or the authenticated CompanyOS workspace.
6. Payment-provider availability is not represented honestly in the old fallback. Phase 7 supports recorded external checkout and real configured provider checkout only; it never simulates payment success.
7. Product/customer relationships need granular support, warranty and update permissions. Marketing consent must remain separate.
8. Pricing and entitlement presentation needs one configuration source and must not manufacture an active subscription when billing is unavailable.

## Boundary design

```text
Buyer World -> explicit intent/share -> Trust-boundary API -> CompanyOS tenant
CompanyOS -> verified public projection / product offer -> Trust-boundary API -> Buyer
Inventory -> Offer availability -> Order reservation -> confirmed purchase -> Thing/Passport
```

- Buyer private data is never available through the public catalog.
- Company writes are tenant-scoped and role-gated.
- Buyer relationship permissions are opt-in and field-specific.
- Public catalog reads contain only approved company/product/offer fields.
- Deterministic matching returns explicit reasons and never accepts paid rank input.
- Opaque claim tokens are generated with Web Crypto, stored only as SHA-256 hashes, expire and are single-use.

## Migration and compatibility approach

Phase 7 is additive. New `company_network_*` tables distinguish the normalized network from the legacy `commerce_*` tables. Existing APIs and data remain readable by their existing Workers. The active Phase 7 surface uses only the normalized tables, real inventory and explicit payment states. The unsafe legacy demo completion endpoint is retired with HTTP 410; no rows are deleted.

The active Worker remains a thin additive wrapper over Phase 6. Unmatched routes delegate unchanged, keeping D1, R2, authentication and all earlier phase behavior compatible.
