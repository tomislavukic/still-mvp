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
  'runtime-recovery-v38.js',

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

// Production must not depend on a historical loader chain. Inject one tiny,
// versioned recovery bootstrap directly into the generated HTML artifact.
const indexPath = path.join(outDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const recoveryTag = '<script src="runtime-recovery-v38.js?v=38" defer></script>';
if (!html.includes('runtime-recovery-v38.js')) {
  html = html.includes('</body>')
    ? html.replace('</body>', `  ${recoveryTag}\n</body>`)
    : `${html}\n${recoveryTag}\n`;
  fs.writeFileSync(indexPath, html);
}

const manifest = {
  app: 'Still?',
  productionBundle: 38,
  generatedAt: new Date().toISOString(),
  files
};
fs.writeFileSync(
  path.join(outDir, 'build.json'),
  JSON.stringify(manifest, null, 2) + '\n'
);

console.log(`Built clean public/ with ${files.length} canonical production assets + build.json (V38 recovery enabled).`);
