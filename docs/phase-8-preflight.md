# Phase 8 preflight — Anticipation Engine

## Baseline
Phase 8 starts from main at `da4490c2aff6d2afd07a5069bb18400ef7c846ea` after the service-pricing change was merged.

## Existing real foundations to reuse
- World persistence and authenticated World APIs live in the active merchant Worker chain, with `world-core-v131.js`, `schema-v131.sql`, World integration tests and `world-foundation-v131.js`.
- Phase 3 provides persisted Needs and the existing Resolution Engine (`needs-resolution-v134.js` plus worker/schema v134). Anticipation must convert into this system rather than creating a second resolution system.
- Phase 4 provides persisted Wanted Objects, Market matches/offers and ownership-transfer foundations (`still-market-v135.js`, worker/schema v135).
- Phase 5 provides the Professional Network (`professional-network-v136.js`, worker/schema v136).
- Phase 6 provides the Service Network, bookings, quotes and service lifecycle (`service-network-v137.js`, worker/schema v137).
- Phase 7 provides Company/Product relationships, notices and new-commerce event sources (`commerce-network-v138.js`, company network worker/schema v138, completion worker/schema v139).
- Buyer attention UI already exists (`buyer/protection/ui/buyeros-attention-v141.js`) and must be treated as presentation infrastructure, not proof of a persisted anticipation engine.
- Buyer notifications exist, but Phase 8 must add candidate-level deduplication and notification policy instead of blindly emitting reminders.
- Warranty/return calculation helpers exist under `buyer/protection/engine/`. They may be used only when backed by persisted real purchase/policy data.

## Important legacy / incomplete areas
- `buyer-backend/worker-v001.js`, the old `buyer-ui/` pages/services, `migrations/buyer/*`, and several old protection test/model stubs are zero-byte scaffolding. They are not production foundations and must not be revived as fake implementations.
- Existing buyer attention/intelligence UI predates Phase 8. Any hardcoded/sample/predictive content found there must not be treated as evidence and must not create candidates.
- No Phase 8 AnticipationSignal, AnticipationCandidate, feedback, user schedule, preference, notification-state or event-inbox persistence exists yet.
- No repository-level Phase 8 API currently exposes persisted anticipation state.
- AI must not be used to fill missing lifecycle data.

## Event infrastructure assessment
The repository has real domain mutations across World, Needs, Market, Professional, Service and Company workers, but no single privacy-scoped World event abstraction dedicated to anticipation. Phase 8 will introduce an append-only `world_events` abstraction with minimal payloads and idempotency keys. Domain mutation handlers can publish normalized events, while date-based reconciliation remains necessary for deadlines.

## Scheduling assessment
The project deploys to Cloudflare Workers through `wrangler.jsonc`. Phase 8 will use a real Worker scheduled handler / Cron Trigger for date reconciliation. Browser timers and localStorage reminders are forbidden.

## Deterministic categories safe to implement now
1. Warranty approaching/passed when an explicit warranty end exists or can be calculated from real persisted policy + purchase data.
2. Return-window closing only when a persisted return deadline/policy is known.
3. Open Loop overdue / waiting expectation passed from explicit due/expected timestamps.
4. Upcoming persisted service booking/project milestone as Attention, not a duplicate Need.
5. Wanted match from an actual persisted match event.
6. Company safety/support/warranty/service/product-update notice only through a valid ProductRelationship.
7. Explicit user recurring schedules.
8. Explicit user price thresholds when a real offer/match satisfies them.

## Deferred / prohibited until evidence exists
- Generic replenishment prediction.
- Upgrade prediction.
- Consumption prediction without an explicit schedule or confirmed pattern.
- Vague AI lifestyle inference.
- Commercial company upsell as anticipation.
- Any high-stakes medical, legal, financial-distress, employment or relationship inference.

## Architectural boundary
`World/domain event -> scoped WorldEvent -> deterministic rule -> AnticipationSignal -> AnticipationCandidate OR AttentionItem -> user review -> existing Need -> existing Resolution Engine -> outcome -> World update`

Signals never directly create active Needs. Attention and Needs remain distinct.

## Privacy boundary
Anticipation is Buyer-private. Company, professional and service actors may contribute normalized allowed events but cannot query candidate/signal/schedule/feedback state. Events carry only minimum necessary identifiers, timestamps and typed metadata.

## Quality rules
- A quiet result is valid.
- Every signal has provenance.
- Every candidate explains Why now.
- Deterministic rules first.
- Idempotent scheduled reconciliation.
- User corrections beat inference.
- Dismiss/snooze state suppresses immediate recreation.
- Revenue/commission never participates in priority.
- NOW remains capped and calm.
