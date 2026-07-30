const fs = require('fs');
const path = require('path');

// Canonical production files only. Keep this list explicit so obsolete,
// experimental, and deleted assets can never leak into the live Worker.
const files = [
  // Shell + core
  'index.html','styles.css','share-icons.css','app.js','enhancements.js','v10.js','theme.js',
  'runtime-recovery-v38.js','warranty-recovery-v39.js',
  // Current consumer-rights runtime
  'visible-v20.js','core-search-v33.js','modern-bootstrap-v33.js','market-catalog-v36.js',
  'decision-v21.js','proof-v22.js','support-v23.js','saved-v24.js','saved-status-v25.js',
  'saved-actions-v26.js','saved-organize-v27.js','case-v28.js','backup-v29.js',
  // Buyer ↔ merchant runtime
  'merchant-v30.js','merchant-intake-v31.js','merchant-dashboard-v32.js','merchant-handoff-v34.js',
  'merchant-response-v35.js','merchant-entry-v37.js',
  // Public/legal assets
  'privacy.html','terms.html','methodology.html','legal-i18n.js','robots.txt','sitemap.xml'
];
const outDir=path.join(__dirname,'public');
fs.rmSync(outDir,{recursive:true,force:true});fs.mkdirSync(outDir,{recursive:true});
for(const file of files){const src=path.join(__dirname,file);if(!fs.existsSync(src))throw new Error(`Missing canonical production asset: ${file}`);fs.copyFileSync(src,path.join(outDir,file))}
// Critical recovery modules are injected directly into the generated artifact.
// Warranty therefore cannot disappear merely because a historical loader failed.
const indexPath=path.join(outDir,'index.html');let html=fs.readFileSync(indexPath,'utf8');
const tags=['<script src="runtime-recovery-v38.js?v=39" defer></script>','<script src="warranty-recovery-v39.js?v=39" defer></script>'];
for(const tag of tags){const file=tag.match(/src="([^?]+)/)[1];if(!html.includes(file))html=html.includes('</body>')?html.replace('</body>',`  ${tag}\n</body>`):`${html}\n${tag}\n`}
fs.writeFileSync(indexPath,html);
const manifest={app:'Still?',productionBundle:39,generatedAt:new Date().toISOString(),files};
fs.writeFileSync(path.join(outDir,'build.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built clean public/ with ${files.length} canonical production assets + build.json (V39 warranty recovery enabled).`);
