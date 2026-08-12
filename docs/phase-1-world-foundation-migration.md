# World Foundation migration and rollback

## Production rollout

Phase 1 is additive. `merchant-backend/schema-v131.sql` creates buyer-scoped World tables without altering or deleting existing ownership, buyer-auth, CompanyOS, commerce, lifecycle, Trust Layer, or case tables.

The active Worker also runs the same `CREATE TABLE IF NOT EXISTS` and index statements defensively before serving `/api/v1/world/*`. This keeps a newly deployed Worker compatible with an existing D1 database while the SQL file remains the auditable migration source.

`ownership_passports` remains the canonical owned-object identity. A `world_thing_profiles` row enriches it but is not required to read an older passport. The World API uses a left join and returns older passports with incomplete profiles.

## Browser data migration

After buyer authentication, `world-foundation-v131.js` submits records from:

- `still-ownership-passports-v83`
- `still-saved-purchases-v1`

The server computes a stable per-record fingerprint and stores it in `world_migrations`. Repeating the migration is idempotent. Exact/high-confidence existing matches are recorded as `MATCHED_EXISTING` rather than duplicated. Ambiguous records are not auto-merged; the buyer can add a separate Thing explicitly.

The browser data is not deleted. After successful World loading, the old ownership key becomes a compatibility cache populated from server Things so older, non-canonical modules can render while Phase 1 rolls out. D1 remains the source of truth.

## Private files

Receipt images and buyer documents use the private R2 binding `WORLD_FILES` and bucket `still-private-world`. Object keys are buyer-scoped. No public bucket URL is exposed; authenticated Worker routes verify the `still_buyer` session and D1 owner before streaming an original.

Before production deployment, the R2 bucket must exist in the same Cloudflare account. A missing binding fails visibly as `private_storage_not_configured`; uploads never simulate success.

## Rollback

Rolling the Worker entrypoint back to `worker-v120.js` disables `/api/v1/world/*` without changing older APIs. Existing World rows and R2 objects remain intact and can be read again after restoring `worker-v131.js`.

Do not drop the World tables or delete the R2 bucket during an application rollback. No reverse data migration is required because existing ownership passport rows remain compatible with the previous Worker chain.

If the World UI asset must be rolled back independently, remove it from the production runtime and restore the previous consumer tool mapping. The browser compatibility cache preserves older ownership rendering, but new World-only Knowledge, Situations, Open Loops, and receipt originals will remain server-side until the World client is restored.

## Operational checks

After deployment verify:

1. An unauthenticated `/api/v1/world/bootstrap` request returns 401.
2. An authenticated buyer can create and reload a Thing.
3. A supported receipt image reaches `NEEDS_REVIEW` or a durable `FAILED` state.
4. The original is available only through the authenticated receipt route.
5. Confirming a line creates or links one canonical passport and creates evidence/history.
6. A second buyer cannot read the first buyer's World IDs.
7. CompanyOS bootstrap and authenticated tools still load through the delegated Worker chain.
