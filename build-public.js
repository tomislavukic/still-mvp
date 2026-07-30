const fs = require('fs');
const path = require('path');

// Canonical production files only. Keep this list explicit so obsolete,
// experimental, and deleted assets can never leak into the live Worker.
const files = [
  // Shell + core
  'index.html',
  'styles.css',
  'share-icons.css',
  'app.js',
  'enhancements.js',
  'v10.js',
  'theme.js',

  // Current consumer-rights runtime
  'visible-v20.js',
  'core-search-v33.js',
  'modern-bootstrap-v33.js',
  'market-catalog-v36.js',
  'decision-v21.js',
  'proof-v22.js',
  'support-v23.js',
  'saved-v24.js',
  'saved-status-v25.js',
  'saved-actions-v26.js',
  'saved-organize-v27.js',
  'case-v28.js',
  'backup-v29.js',

  // Buyer ↔ merchant runtime
  'merchant-v30.js',
  'merchant-intake-v31.js',
  'merchant-dashboard-v32.js',
  'merchant-handoff-v34.js',
  'merchant-response-v35.js',
  'merchant-entry-v37.js',

  // Public/legal assets
  'privacy.html',
  'terms.html',
  'methodology.html',
  'legal-i18n.js',
  'robots.txt',
  'sitemap.xml'
];

const outDir = path.join(__dirname, 'public');

// Always generate production from scratch. A removed file must disappear from
// public/ on the very next build instead of surviving as a stale asset.
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const src = path.join(__dirname, file);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing canonical production asset: ${file}`);
  }
  fs.copyFileSync(src, path.join(outDir, file));
}

const manifest = {
  app: 'Still?',
  productionBundle: 37,
  generatedAt: new Date().toISOString(),
  files
};
fs.writeFileSync(
  path.join(outDir, 'build.json'),
  JSON.stringify(manifest, null, 2) + '\n'
);

console.log(`Built clean public/ with ${files.length} canonical production assets + build.json.`);
