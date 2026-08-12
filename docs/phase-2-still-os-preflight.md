# Phase 2 Still OS preflight

Date: 2026-08-12

## Phase 1 confirmed

- Buyer World routes use the existing `still_buyer` session and scope every read and write by `buyer_account_id`.
- Things persist in `ownership_passports` plus `world_thing_profiles`; authenticated manual creation no longer relies on local-only storage.
- Receipt images and documents have owner-scoped metadata in D1 and private originals in the `WORLD_FILES` R2 binding.
- Receipt OCR uses the existing Workers AI conversion path, preserves processing failure state, supports retry and requires review before creating or linking Things.
- Knowledge, Situations, Open Loops, relationships, evidence and History are persisted in D1.
- World search returns mixed, typed, owner-scoped results.
- Thing detail exposes Passport provenance and History.
- Legacy browser ownership records use an idempotent authenticated migration endpoint.
- The isolated Phase 1 suite covers 52 structural/unit assertions and 28 real HTTP flows. The unit and build portions pass after rebasing onto current `main`. The HTTP runner requires a local Wrangler process; this sandbox's package runner could not start because external package resolution was unavailable during this preflight.
- Cloudflare R2 is active and the private `still-private-world` bucket exists with public access disabled. The repository dry-run resolves it as `env.WORLD_FILES`.

## Missing Phase 2 foundations

- No deep-linkable authenticated `/app` environment exists.
- `GET /api/v1/world/now` returns a ranked list, but not the required `dominantContext`, compact attention summary, recent items and explicit quiet state.
- There is no reusable `GET /api/v1/world/context/:entityType/:id` aggregator.
- Universal capture requires the user to select a destination before entering content; there is no confidence-bearing routing step.
- Sight is not a coherent input mode. Receipt and document ingestion exist, but their real actions are split across legacy surfaces.
- Profile, buyer relationship dashboard, ownership modules and World compete as authenticated destinations.
- Deep links for Thing, Situation, Knowledge and Receipt work only through in-memory dialogs.
- Together has no general-purpose World collaboration model. Existing selective passport/case sharing must remain the only exposed sharing capability until stronger permissions exist.

## Regressions and lineage repair

- The Phase 1 feature branch had diverged before the CompanyOS pull requests were merged. It carried duplicate CompanyOS commits and Build 131 while production reports Build 132.
- Only the seven Phase 1 commits were rebased onto current local `main`. Merged CompanyOS remains the source of truth; no CompanyOS capability was replayed or downgraded.
- Phase 2 must use the next coherent bundle and must not deploy the rebased branch until full validation succeeds.

## Legacy consumer UI disposition

| Existing surface | Decision | Phase 2 destination |
| --- | --- | --- |
| World Foundation | Merge | Still OS data/actions behind Now, World and contextual workspaces |
| Ownership home/feed | Merge | World and contextual History |
| Ownership onboarding | Move | Universal input and Add flow |
| Buyer relationship dashboard | Move | Profile/account sheet and Together relationship summary |
| Buyer notifications | Merge | Now attention; every notification must open a real object |
| Buyer rewards | Move | Profile; supporting capability, not primary navigation |
| Lifecycle/timeline | Move | Thing/Situation context and secondary History |
| Receipt scanner | Keep | Canonical receipt path used by Sight and universal input |
| Product Passport | Keep | Primary Thing workspace action |
| Public marketing sections | Keep signed out | Hidden behind the authenticated `/app` environment |
| Old AI assistant destinations or canned replies | Defer/remove from primary UX | Contextual commands only; no simulated AI response |
| Market/commerce | Defer from primary OS | Existing real routes remain reachable but do not generate attention |

## Implementation constraints

- No new local-only state or parallel object store.
- No inferred classification is persisted without a visible confirmation step.
- Sight reuses receipt and document ingestion and does not claim product recognition.
- Together exposes only existing real relationship/selective-sharing capabilities.
- CompanyOS, Trust Layer, rewards, commerce and existing APIs remain available and unchanged beneath the new consumer hierarchy.
