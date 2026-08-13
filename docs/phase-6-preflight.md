# Phase 6 preflight: Services and Local Resolution Network

## Scope

Phase 6 connects a real Still Need and the Thing it concerns to a real individual professional or CompanyOS organization that can quote, schedule, perform, and document local or remote service. It extends the existing identity systems; it does not create a third account type, a public directory of invented providers, or a payment simulation.

## Foundations that are safe to reuse

- Buyer accounts, hashed buyer sessions, Professional Mode, declared capabilities, blocks, reports, private messages, and D1-backed work history.
- CompanyOS organizations, hashed company sessions, roles, verification state, branches, service catalog, resources, engagements, contracts, and company workspace navigation.
- D1-backed Needs, Situations, ownership Passports, Resolution Outcomes, World history, NOW, and notifications.
- Private World documents stored through the `WORLD_FILES` R2 binding and owner-scoped metadata.
- The existing additive Worker chain, same-origin mutation checks, production bundle validation, and responsive Still OS extension points.

## Existing systems that cannot be treated as Phase 6 truth

- Company service engagements are private organization records. They do not currently authorize a buyer, expose a privacy-filtered Thing context, or resolve a buyer Need.
- Professional projects model scoped freelance work, not appointment availability, customer-location privacy, service reports, parts, or provider-declared service warranty.
- Legacy commerce and demo checkout do not prove payment, deposits, escrow, provider availability, prices, ratings, or completed service.
- Company verification proves organization review state only; it does not automatically verify a service capability or guarantee service quality.

## Additive domain seams

Phase 6 needs durable shared records for service providers, structured capabilities and coverage, manual availability slots, privacy-reviewed service briefs, deterministic matches, provider invites, quote requests and quotes, bookings, private address disclosure, messages and approved attachments, service reports and parts, favorites, and lifecycle events.

An individual provider references a real Professional profile and buyer account. A business provider references a real CompanyOS organization and remains administered through its existing company membership. A provider record may reference exactly one of those origins.

## Privacy and authorization boundaries

- A Thing remains private. A provider sees only the confirmed service brief fields and documents the owner selected.
- Matching uses coarse coverage only. Exact customer address is stored separately and is returned only to booking participants after confirmation, and only when the selected service mode requires it.
- Provider invitations create invitation records only. They never create a provider identity, listing, quote, booking, availability, or rating.
- Every quote, slot, booking state, message, part, report, favorite, and completion is persisted and participant-scoped.
- Company members can administer only the provider backed by their organization. Individual professionals can administer only the provider backed by their buyer identity.
- Blocks are bidirectional. Mutation routes enforce same-origin requests. Attachments retain private R2 authorization.
- Still records external/manual payment status only. It does not claim payment collection, escrow, deposits, refunds, or settlement.

## Matching and trust model

Matching is deterministic and bounded. It includes only active providers with an active structured capability, compatible mode/category/coverage/brand declarations, accepting-requests state, and no participant block. It returns reasons and unmet constraints. It never generates providers, prices, schedules, response times, distance, availability, ratings, or map positions.

Provider and capability declarations are clearly labelled as declared unless supported by a real existing verification source. Company verification remains visible as organization verification, not service quality certification.

## UI integration plan

1. Add service handling to contextual REPAIR, INSTALLATION, and service-oriented Needs.
2. Let the owner review a privacy-filtered brief, choose coarse location, exact-address policy, approved files, and matching consent.
3. Show real matches, quote requests, quotes, and honest zero-result actions.
4. Add a participant booking workspace for scheduling, state changes, messages, attachments, reports, completion confirmation, repeat booking, and favorite provider.
5. Add provider availability, capabilities, quote inbox, upcoming work, and service reports to Professional Mode and CompanyOS without exposing the internal tenant workspace.
6. Feed real booking and service events into NOW, notifications, Thing history, and Need resolution.

## Retirement decision

Phase 6 will not reuse simulated service providers, calendar events, prices, maps, ratings, payments, or completion. Existing CompanyOS service tools remain available for internal operations. They are connected to the shared service network only through authenticated, tenant-scoped provider and job-intake records.

