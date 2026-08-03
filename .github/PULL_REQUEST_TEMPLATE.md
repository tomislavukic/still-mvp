## Summary

Describe what this pull request changes and why.

## Changes

- 
- 
- 

## Validation

Check every command that was run successfully:

- [ ] `actionlint .github/workflows/*.yml`
- [ ] `npm run validate:app`
- [ ] `npm run validate:codeql`
- [ ] `npm run security`
- [ ] Wrangler production deployment dry-run
- [ ] Relevant manual testing completed

## Build 106 safety

- [ ] `merchant-backend/worker-v106.js` still exists
- [ ] `wrangler.jsonc` still targets `merchant-backend/worker-v106.js`
- [ ] `public/build.json` reports production bundle 106 or newer
- [ ] No production secrets were added
- [ ] No placeholder or simulated implementation was introduced

## Cloudflare safety

- [ ] This pull request does not unintentionally deploy to Cloudflare
- [ ] Existing D1 and assets bindings remain unchanged
- [ ] Wrangler dry-run completed successfully
- [ ] Production variables and secrets are not stored in the repository

## Security and dependencies

- [ ] New dependencies are necessary
- [ ] Dependency Review passes
- [ ] Gitleaks passes
- [ ] CodeQL passes
- [ ] GitHub Actions use minimal permissions

## Screenshots or logs

Add screenshots or relevant output when the change affects the interface, production build, or deployment behavior.

## Release impact

- [ ] No release required
- [ ] Patch release
- [ ] Minor release
- [ ] Major release
