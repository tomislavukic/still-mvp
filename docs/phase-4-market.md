# Phase 4 — ownership-native Still Market

Date: 2026-08-12

## Implemented production domain

- A Market listing is a durable D1 record referencing one canonical owned Thing. D1 prevents more than one open listing for that Thing.
- Draft readiness checks real identity, supported category, seller-confirmed condition, price and delivery before publication.
- Product Trust is an explainable set of ownership, identity, condition, service, document and ownership-history components. It does not produce an unsupported score.
- Seller Trust shows only real account verification, account age and completed Still transfers. Ratings and response claims are absent because no reliable source exists.
- Authenticated search returns only active listings and supports text, category, price, condition, location, external-shipping, explainable trust-evidence filters and bounded pagination. Results prioritize recorded evidence rather than sponsored placement.
- Wanted Objects persist structured demand. Matching is deterministic, records reasons and failed constraints, and notifies only for real active matches.
- Private reverse matching is disabled by default. An opted-in Thing and private consider-price remain unpublished and buyer identities are not exposed.
- Offers, counteroffers and their immutable event history persist independently from messages. An accepted offer creates one participant-scoped deal.
- Deal payment is explicitly `EXTERNAL_MANUAL`. Still does not hold money or claim escrow or payment protection.
- Delivery is `PICKUP` or `SHIPPING_EXTERNAL`. Still does not claim a carrier or tracking provider.
- Handoff requires buyer external-payment confirmation, seller handoff, and buyer receipt in order.
- Ownership transfer begins only after physical handoff and completes only after both parties confirm. The same canonical Thing changes owner.
- The privacy filter retains seller notes, raw receipts, private documents, Knowledge, addresses, payment data and World relationships with the seller. The buyer receives privacy-safe product identity, warranty state and ownership history.
- Completed transfers resolve linked real Sell/Buy Needs and create canonical resolution outcomes and History.
- Notifications, participant-only deal messages, reports, blocks and transfer history persist in D1.

## Authenticated experience

- Market is a primary Still OS space with responsive browse, search, Wants, activity and truthful quiet states.
- Owned Thing workspaces expose Sell and opt-in private reverse matching.
- Market Passport views expose structured condition, Product Trust, Seller Trust, delivery boundary, offers and known-field comparison with an owned comparable Thing.
- Offer workspaces expose accept, counter, decline, withdraw and immutable history.
- Deal workspaces expose the real payment, handoff, two-party transfer and privacy-filter sequence.
- Buy/Find/Replace Needs can create a Wanted Object or open a real matching listing.

## Deliberately unavailable

- No in-platform C2C payment or escrow is enabled because no compliant consumer marketplace payment provider is configured.
- No carrier, label, shipping-rate or tracking integration is enabled.
- No AI condition assessment or professional inspection is claimed.
- No market-value estimate is shown because the repository has no reliable comparable-data source.
- No seller ratings, response reliability or adoption statistics are invented.
- No swap UI is exposed because the current transaction model does not safely support it end to end.

## Validation coverage

- 42 Phase 4 static architecture and capability assertions run in `npm test`.
- 30 real HTTP Market journeys extend the isolated Wrangler/D1 integration suite, including canonical listing, privacy, matching, offers, manual handoff, transfer, Need resolution, cancellation, blocks and refresh persistence.
- The production bundle validator requires both Market assets and the active additive Worker.
- The SQL migration is executable by SQLite and the equivalent lazy Worker schema preserves deployment compatibility.
