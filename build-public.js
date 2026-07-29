const fs = require('fs');
const path = require('path');

const files = [
  'index.html',
  'styles.css',
  'share-icons.css',
  'app.js',
  'enhancements.js',
  'v10.js',
  'theme.js',
  'privacy.html',
  'terms.html',
  'methodology.html',
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