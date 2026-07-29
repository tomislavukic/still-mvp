# Still? MVP

A zero-build static MVP for a simple return-window checker.

## What works
- Responsive landing page inspired by the approved mockup.
- Return calculator for Apple, Best Buy, and Target standard policies.
- Custom return-window calculator.
- Deadline, days remaining, progress, policy caveat, and official policy link.
- Receipt image/PDF selection is handled locally only. No upload occurs.
- Mobile-friendly UI and no account requirement.

## Important limitation
This MVP intentionally does **not** pretend to OCR or automatically interpret receipts. Retail return rules have category, membership, seller, country, product-condition, holiday and other exceptions. The result is an estimate of the standard window, not a guarantee of eligibility.

## Run locally
Option 1: open `index.html` directly in a browser.

Option 2 (recommended):
```bash
cd still-mvp
python3 -m http.server 8080
```
Then visit `http://localhost:8080`.

## Publish free / cheaply
Because this is static, you can deploy the folder on Cloudflare Pages, GitHub Pages, Netlify, or another static host. No server is needed for this MVP.

## Next production steps
1. Add more retailers and regional/country variants.
2. Store policy records in a versioned data file or database with `verified_at` timestamps.
3. Add real OCR only after selecting a trusted OCR provider or on-device/browser OCR path.
4. Add accounts/reminders only when retention is proven.
5. Add analytics, privacy policy, terms, error monitoring and SEO landing pages.
