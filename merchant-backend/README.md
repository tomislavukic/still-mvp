# Still? production merchant backend

This directory replaces the localStorage-only merchant prototype with a shared server-side case workflow.

## What is implemented

- Persistent consumer cases with public case IDs and private consumer access tokens.
- Automatic assignment to a verified merchant organization when retailer key + country match.
- Merchant organization/member/token model.
- Merchant inbox queries by status/search.
- Structured merchant decisions: accepted, more info, bring to store, repair, replacement, refund, rejected, other.
- Merchant messages / information requests.
- Buyer resolution handshake: accepted, declined, completed.
- Immutable-style case event timeline for auditability.
- Verified merchant profile storage for return/warranty/complaint instructions.
- Static site fallback through the Cloudflare `ASSETS` binding.

## Security model

Consumer case creation returns a random access token once. Only its SHA-256 hash is stored in D1. Reading or resolving the case requires `X-Still-Case-Token` or the token query parameter.

Merchant API access uses bearer tokens. Only SHA-256 token hashes are stored. Tokens are scoped to one verified organization and optionally one member. Revoked/expired tokens fail authentication.

Do not expose raw merchant API tokens in client JavaScript. The current token model is suitable for controlled pilot accounts and server/admin provisioning. Before public self-service merchant onboarding, add an identity provider/session layer and email/domain verification.

## API

- `GET /api/v1/health`
- `POST /api/v1/cases`
- `GET /api/v1/cases/:publicId`
- `POST /api/v1/cases/:publicId/resolution`
- `GET /api/v1/merchant/profile`
- `GET /api/v1/merchant/cases?status=&q=`
- `GET /api/v1/merchant/cases/:publicId`
- `POST /api/v1/merchant/cases/:publicId/decision`
- `POST /api/v1/merchant/cases/:publicId/messages`

## Cloudflare activation

Do not activate until the D1 database exists and `schema.sql` has been applied.

Required Wrangler concepts:

1. Static assets directory remains `./public`.
2. Add an assets binding named `ASSETS` so `worker.js` can call `env.ASSETS.fetch(request)`.
3. Add a D1 binding named `DB` with the created database ID.
4. Set the Worker main entry to `merchant-backend/worker.js`.
5. Apply `merchant-backend/schema.sql` to the production D1 database before deployment.

Keep Build 45 live until these bindings are configured. The backend files themselves do not change the currently deployed static Worker.

## Still required before public merchant self-service

The shared case engine is real, but these external/account capabilities still require production configuration rather than fake UI:

- merchant login/session identity provider;
- email/domain verification for claiming retailer profiles;
- transactional email provider for case notifications and magic links;
- object storage + malware/type/size validation if receipt/document uploads are moved server-side;
- privacy/retention policy and deletion/export endpoints;
- API rate limiting / abuse controls;
- admin tooling for merchant verification, suspension and disputes.

These should be added deliberately. The site must not claim a merchant is verified merely because a local user typed its name.
