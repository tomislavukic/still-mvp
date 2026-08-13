# Phase 5 preflight: Professional Resolution Network

## Scope

Phase 5 adds an authenticated, ownership-native way to hire an individual professional to resolve a real Still Need. It is not a public freelancer marketplace and does not create a second identity system. A person opts into Professional Mode on the same buyer account they already use for Still.

## Existing production foundations

The following foundations are real, persisted, owner-scoped, and safe to extend:

- Buyer accounts and hashed `still_buyer` sessions.
- D1-backed Needs, including `HIRE`, desired outcomes, budgets, deadlines, location mode, required capabilities, and shareable-brief storage.
- Resolution outcomes, World history, NOW, notifications, and contextual Need workspaces.
- Private World documents in the `WORLD_FILES` R2 binding, with database metadata and owner authorization.
- Ownership Passports, Things, Situations, relationships, evidence, and lifecycle history.
- Deterministic matching patterns, blocks, reports, offers, deals, and external-manual payment disclosure in the ownership Market.
- The additive Worker chain and authenticated Still OS extension points.

## Foundations that must not be reused as Phase 5 truth

- Company service milestones are organization-scoped and require CompanyOS authorization. They cannot represent a personal professional project without weakening tenant boundaries.
- Legacy commerce's labelled demonstration checkout is not a real professional payment provider. Phase 5 must never report escrow, held funds, or successful payment from that path.
- Market listing reputation and ownership-transfer history do not prove a person's professional capability.
- Company verification does not automatically verify an individual professional profile.

## Missing production capabilities

Phase 5 therefore needs additive persisted models and authorization for:

- Professional profiles, availability, capabilities, evidence, and portfolio items.
- User-reviewed Still Briefs with explicitly approved context and document references.
- Explainable professional matching and explicit opportunity sharing.
- Versioned proposals and counters, accepted deals, projects, milestones, messages, deliverables, approvals, and revision requests.
- Completion-linked HIRE outcomes, capability evidence, and structured feedback.
- Professional favorites, blocks, reports, disputes, work notifications, and project history.
- Participant-authorized access to private brief and deliverable files.

## Trust and privacy boundaries

- Professional Mode is opt-in and disabled by default.
- Matching returns only active, available, real professional profiles and never invents providers, prices, ratings, response times, or availability.
- A Need remains private until its owner confirms a Still Brief and explicitly shares it with selected professionals.
- The professional receives only the confirmed brief and approved attachment metadata/files, never the owner's broader World.
- Every mutation is same-origin protected and every object is scoped by its client/professional participant IDs.
- Blocking is bidirectional for matching, opportunities, messages, and project contact.
- Payments begin as `EXTERNAL_MANUAL`; Still does not claim escrow or payment confirmation.
- Project completion, feedback eligibility, and capability evidence come only from persisted completed work.
- AI may draft a brief from user-approved context, but it cannot publish, share, or confirm that brief and must not invent missing facts.

## Additive implementation plan

1. Add the Phase 5 schema and an additive Worker entrypoint without changing existing APIs or bindings.
2. Implement professional profile, capability, brief, matching, opportunity, proposal, project, milestone, deliverable, feedback, safety, and notification APIs.
3. Integrate Professional Mode into the authenticated account, HIRE into Need resolution, professional work into NOW, and project views into Still OS.
4. Ship the new assets through the production build, add authorization/lifecycle/security tests, and validate responsive behavior.

## Retirement decision

No fake professional network exists in the active application, so there is no Phase 5 demo surface to migrate or retain. Existing unrelated, explicitly labelled commerce demonstrations remain outside this phase and are not called by the professional APIs or UI.
