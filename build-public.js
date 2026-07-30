const fs = require('fs');
const path = require('path');

// Deterministic production architecture. Runtime dependencies are explicit and
// are downloaded together as defer scripts, then executed in document order.
const runtime = [
  'theme.js',
  'translations-v40.js',
  'app.js',
  'enhancements.js',
  'v10.js',
  'market-catalog-v36.js',
  'visible-v20.js',
  'core-search-v33.js',
  'decision-v21.js',
  'proof-v22.js',
  'support-v23.js',
  'saved-v24.js',
  'saved-status-v25.js',
  'saved-actions-v26.js',
  'saved-organize-v27.js',
  'case-v28.js',
  'backup-v29.js',
  'merchant-v30.js',
  'merchant-intake-v31.js',
  'merchant-dashboard-v32.js',
  'merchant-handoff-v34.js',
  'merchant-response-v35.js',
  'merchant-entry-v37.js',
  'warranty-recovery-v39.js',
  'purchase-action-v41.js'
];

const files = [
  'index.html','styles.css','share-icons.css',...runtime,
  'privacy.html','terms.html','methodology.html','legal-i18n.js','robots.txt','sitemap.xml'
];
const outDir = path.join(__dirname, 'public');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const file of files) {
  const src = path.join(__dirname, file);
  if (!fs.existsSync(src)) throw new Error(`Missing canonical production asset: ${file}`);
  fs.copyFileSync(src, path.join(outDir, file));
}
const indexPath = path.join(outDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const inlineStyles = [];
html = html.replace(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi, (_, css) => {
  if (css.trim()) inlineStyles.push(css.trim());
  return '';
});
if (inlineStyles.length) {
  const stylesPath = path.join(outDir, 'styles.css');
  const existing = fs.readFileSync(stylesPath, 'utf8');
  fs.writeFileSync(stylesPath, `${existing}\n\n/* Canonical shell styles migrated from index.html */\n${inlineStyles.join('\n')}\n`);
}
for (const file of runtime) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<script[^>]+src=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, 'gi');
  html = html.replace(re, '');
}
html = html.replace(/<script[^>]+src=["'][^"']*runtime-recovery-v38\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi, '');
const tags = runtime.map(file => `  <script src="${file}?v=41" defer></script>`).join('\n');
html = html.includes('</body>') ? html.replace('</body>', `${tags}\n</body>`) : `${html}\n${tags}\n`;
fs.writeFileSync(indexPath, html);
const manifest = {app:'Still?',productionBundle:41,architecture:'deterministic-explicit-runtime',generatedAt:new Date().toISOString(),runtime,files};
fs.writeFileSync(path.join(outDir,'build.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built V41: ${runtime.length} explicit defer modules with actionable purchase cases.`);
