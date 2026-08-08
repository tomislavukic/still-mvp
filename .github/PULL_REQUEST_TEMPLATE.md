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

## Active production safety

- [ ] `node scripts/validate-active-worker.js` passes
- [ ] The `wrangler.jsonc` `main` entrypoint and its complete delegation chain are present
- [ ] `public/build.json` reports the active positive production bundle
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
