const fs = require('fs');
const path = require('path');

const files = [
  'index.html',
  'styles.css',
  'share-icons.css',
  'launch-ui.css',
  'safe-improvements.css',
  'app.js',
  'enhancements.js',
  'v10.js',
  'theme.js',
  'retailer-reliability.js',
  'safe-improvements.js',
  'privacy.html',
  'terms.html',
  'methodology.html',
  'legal-i18n.js',
  'robots.txt',
  'sitemap.xml'
];

const outDir = path.join(__dirname, 'public');
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const src = path.join(__dirname, file);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing production asset: ${file}`);
  }
  fs.copyFileSync(src, path.join(outDir, file));
}

console.log(`Built public/ with ${files.length} production assets.`);