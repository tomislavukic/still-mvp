# Still

**Version 1.0.0 · Production Build 155**

Still is a buyer-controlled operating system for everything a person owns. It keeps Things, receipts, documents, warranties, service history, important knowledge, unresolved needs and ownership history in one private World. The authenticated Still experience helps people remember what matters now, understand one Thing in context, resolve real needs and transfer ownership without losing trustworthy product history.

Still is not a webshop, payment provider, escrow service or merchant of record. Businesses remain the seller or service provider. Still connects a buyer-controlled Thing and Product Passport to verified business records only through explicit, scoped relationships.

## Version 1.0.0

Version 1 establishes the complete production foundation delivered across Builds 131–155:

- **World:** durable D1-backed Things, receipt review, private R2 originals, evidence and provenance, Product Passports, Knowledge, Situations, Open Loops, History, search and safe legacy migration.
- **Still OS:** an authenticated, responsive environment organized around Now, World, Discover and Together, with adaptive Thing, Knowledge and Situation workspaces.
- **Needs and Handle It:** persisted Needs, deterministic World-first resolution, real quotes, explicit user-selected actions and attributable outcomes without invented providers or availability.
- **Still Market:** canonical-Thing listings, Wanted Objects, explainable deterministic matching, private reverse matching, offers, counteroffers, participant-only deals, manual handoff and privacy-filtered two-party ownership transfer.
- **Still for Business:** existing authenticated CompanyOS, verification boundaries, operational tools, commerce, lifecycle, rewards and Trust Layer APIs remain available and isolated from buyer authentication.
- **Production safeguards:** active Worker module-graph validation, production-bundle validation, 91 HTTP integration flows, CodeQL configuration checks, Gitleaks and pinned Wrangler validation.

GitHub publishes a validated semantic release when version metadata changes on `main`; the same workflow remains manually dispatchable for controlled recovery.

Payments and shipping in the C2C Market remain explicitly external. Still does not claim escrow, carrier tracking, professional inspection, AI condition verification, seller ratings or market-value estimates unless a real production provider and supporting evidence exist.

## Experience design

- The buyer home screen is organized around three plain-language tasks: decide before buying, manage what you own, and resolve a problem.
- Ownership passports and company commitments remain the core connection between buyers and verified businesses.
- Less-frequent buyer features remain available behind one clearly labeled “more tools” control, reducing first-visit overload without removing functionality.
- Desktop uses a sticky task navigation; mobile uses a thumb-friendly bottom dock with safe-area support.
- Build 85 establishes a strict readable floor: functional text is at least 14px, normal copy and form controls are at least 16px, and supporting paragraphs use limited line lengths.
- Desktop content is constrained to comfortable reading widths; tablet layouts collapse before columns become cramped; mobile uses single-column forms and a four-item bottom navigation with short labels.
- The high-contrast visual system uses white surfaces, deep navy text, cobalt actions, teal success signals, and red only for urgency.
- Light and dark themes share visible focus treatments, 44–52px touch targets, clearer forms, and consistent card hierarchy.
- Build 86 removes decorative outlines from cards and fields. Layered surfaces and restrained shadows create hierarchy; saturated blue and teal actions remain stable in both themes.
- Dark mode uses comfortable blue-grey layers instead of near-black panels, with brighter placeholders and no inverted business-action colors.
- Build 87 sharpens active navigation, gives the three buyer journeys distinct visual identities, reduces nested shadows, and adds consistent hover, press, and reduced-motion behavior.
- Build 88 keeps passport creation short by default: only the essential fields remain visible, while dates, references and private notes are available in one accessible disclosure without changing submitted data.
- Build 89 adds accessible save and evaluation confirmations, mobile result movement, actionable empty states, and motion-aware scrolling so important outcomes are never easy to miss.
- Build 90 adds icon-led navigation, richer buyer/company identities, semantic decision colors, visual timeline markers, stronger empty states and a more deliberate footer without reintroducing decorative outlines.
- Build 91 makes Still? Rewards visible to both audiences. Buyers see exact earning events, balances, available benefits and claim codes; companies see how reputation, business credits, platform credit and buyer-funded benefits work before signing in.
- Build 92 adds service-first Passport Offers, verified seller identity, direct-seller payment-provider onboarding, buyer checkout, orders, fulfilment statuses, automatic passport activation and commerce rewards. Responsive buyer and company workspaces remain single-column on small screens.
- Build 93 turns buyer needs into an end-to-end workflow: private account-bound requests, a verified-company request board, structured quote comparison, one accepted private offer and the existing checkout-to-passport flow. Buyer identity and email are never exposed on the request board.
- Build 94 adds downloadable Passport QR codes, revocable and expiring server verification for synced passports, offline portable snapshots for local passports, and a responsive public verification view.
- Build 95 implements all eight lifecycle improvements as connected workflows: lifecycle inbox, promise templates, outcome reputation, transferable service history, safety alerts, passport support, total-cost/repairability decisions and B2B asset passports.
- Build 96 implements the twelve company operations capabilities as one connected workflow. Purchase receipts add stock; orders reserve it; fulfilment, repair parts and passport assignments consume it; returns restock or create refurbished lots; recalls target the exact assigned batch or serial and buyers acknowledge them inside their lifecycle account.
- Build 97 lets pending companies inspect all twelve workflows with sample data without gaining verified status, publishing offers, contacting buyers or changing production records.
- Build 102 makes all 29 company-tour modules interactive inside an isolated, temporary browser session with editable sample records, workflow actions, undo, reset and CSV export.
- Build 103 adds role-specific buyer and company dashboards, editable profiles, relationship-gated buyer pictures, public verified-company identity, privacy-proxied logo URLs and company-branded or buyer-profile Passport QR centres.
- Build 104 aligns dashboards and the 29-module demo with the violet/cobalt design system, adds complete buyer and company contact/location profiles, requires fulfilment contact details at checkout, and preserves immutable buyer/seller contact snapshots on every new order.

## Account boundaries

- Google Sign-In is for buyers only and uses `/api/v1/buyer-auth/*` plus the `still_buyer` session cookie.
- Companies register or sign in with work email and password at `/company.html`. Their `/api/v1/auth/*` APIs and `still_company` session are separate.
- Company operational modules load only after company authentication succeeds.
- Anonymous buyers can still use the return and warranty checker.
- A company-issued passport connects only after the buyer signs in and enters the one-time connection code.
- Signed-in buyer Things are durable server records. Existing browser-only ownership and saved-purchase records are migrated idempotently into the authenticated World. Transfer-safe sharing excludes private notes and order references.

## Production architecture

- Cloudflare Worker entry point: the `main` file declared in `wrangler.jsonc`; its delegation chain preserves authenticated CompanyOS, Trust Layer and ownership APIs while newer wrappers add capabilities.
- Cloudflare static asset bundle: generated in `public/` by `build-public.js`
- Cloudflare D1 binding: `DB`
- Private buyer receipt/document storage: Cloudflare R2 binding `WORLD_FILES` using the non-public `still-private-world` bucket
- Optional private profile-image storage: Cloudflare R2 binding `PROFILE_MEDIA` after R2 is enabled; until then buyer Google photos and privacy-proxied company HTTPS logo URLs provide the live identity layer.
- Google OAuth client configuration: Cloudflare variable `GOOGLE_CLIENT_ID`
- Ownership data: `ownership_passports`, `passport_commitments` and hashed, expiring `passport_public_shares` in D1
- Commerce data: `commerce_business_profiles`, `commerce_offers`, `commerce_orders`, `commerce_requests` and `commerce_quotes` in D1
- Lifecycle data: `lifecycle_preferences`, `promise_templates`, `passport_service_events`, `passport_alerts`, `passport_threads`, `passport_messages` and `business_assets` in D1
- Company operations data: `ops_products`, `ops_stock_balances`, immutable `ops_stock_movements`, lots/serials, suppliers and purchase orders, repairs and parts, returns, reservations, agreements, staff and appointments, CRM/quotes, recall deliveries, audit log and idempotency records in D1
- Contact and fulfilment data: private current buyer contacts, public verified-company contact/location profiles and immutable buyer/seller order-party snapshots in D1
- Optional live payments: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECTED_ACCOUNT_COUNTRY` and `COMMERCE_FEE_BPS`

The active worker stores a configured Google client ID in D1 runtime configuration as a recovery fallback. `keep_vars: true` also prevents normal deployments from deleting dashboard-managed variables.

## Local development

Install Wrangler, then run:

```bash
npm run check
npm run build
npx wrangler dev --local --var GOOGLE_CLIENT_ID:your-client-id.apps.googleusercontent.com
```

The Google OAuth client must authorize both the production origin and the local development origin used for testing.

## Deploy

Production deployment is managed by the existing Cloudflare Workers Git integration connected to this repository. Cloudflare builds commits using `wrangler.jsonc`; a second GitHub Actions deployment pipeline is intentionally not used.

Workers Builds branch controls are stored in the Cloudflare dashboard, not in this repository. Configure the production trigger for `main` with `npx wrangler deploy`, and configure non-production branches with `npx wrangler versions upload` so pull-request builds create preview versions without replacing the active deployment. The August 2026 audit observed a feature-branch commit becoming the active Worker, so these dashboard-owned trigger settings must be verified before the next feature-branch push. Correcting them uses the existing Cloudflare Git integration and does not require new GitHub Actions credentials.

For an authorized manual recovery deployment only:

```bash
npm run deploy
```

Before a manual recovery deployment, authenticate Wrangler with the Cloudflare account that owns the Worker and confirm `GOOGLE_CLIENT_ID` is configured. The deploy script runs syntax checks, the smoke test, and a clean production build first.

## Production Validation

Repository validation is intentionally separate from production deployment. Run the complete local gate with:

```bash
npm run validate
```

- **Build validation:** `npm run validate:app` checks every tracked JavaScript source file, creates a clean production bundle, and runs the repository smoke tests. The same deterministic application checks run for pushes and pull requests.
- **Secret scanning:** Gitleaks scans the complete Git history with its default detection rules and fails when a secret is found. Only the root `README.md` and files under `docs/` are excluded as documentation.
- **CodeQL:** GitHub's official CodeQL Action analyzes JavaScript on pushes, pull requests, manual runs, and a weekly schedule. Results appear in GitHub code scanning.
- **Dependabot:** GitHub Actions and npm dependencies are checked weekly, with no more than five open update pull requests for each ecosystem.

`npm run validate:deploy` performs the complete validation gate followed by a pinned Wrangler dry run. It creates deployment output locally but does not publish or modify the Cloudflare Worker.

## Buyer World Foundation

Phase 1 adds a buyer-authenticated World for durable Things, private receipt OCR/review, Product Passport evidence, Knowledge, Situations, Open Loops, history, deterministic Now, and unified search. It reuses `ownership_passports` rather than creating a parallel owned-product identity and preserves the existing CompanyOS and Trust Layer boundaries.

Architecture and migration details are documented in [the Phase 1 audit](docs/phase-1-world-foundation-audit.md) and [migration/rollback guide](docs/phase-1-world-foundation-migration.md).

## Product and legal limitations

Retail return rules vary by country, seller, product category, membership, condition, and seasonal exceptions. Results are guidance based on standard windows, not a guarantee or legal advice. Policy links and dates should be reviewed regularly.
