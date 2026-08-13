const fs=require('fs'),path=require('path');const BUNDLE=162;
const runtime=['theme.js','translations-v40.js','app.js','enhancements.js','v10.js','actions-v17.js','market-catalog-v36.js','visible-v20.js','core-search-v33.js','decision-v21.js','proof-v22.js','support-v23.js','saved-v24.js','saved-status-v25.js','saved-actions-v26.js','saved-organize-v27.js','case-v28.js','backup-v29.js','saved-polish-v58.js','warranty-recovery-v39.js','merchant-v30.js','merchant-intake-v31.js','merchant-handoff-v34.js','merchant-response-v35.js','purchase-action-v41.js','resolution-v42.js','relationship-v54.js','buyer-case-v60.js','relationship-v61.js','buyer-onboarding-v65.js','business-entry-v66.js','purchase-intelligence-v67.js','branch-match-v68.js','buyer-notifications-v69.js','buyer-rewards-v76.js','buyer-auth-v77.js','qrcode-generator-v94.js','ownership-platform-v83.js','ownership-onboarding-v111.js','ownership-home-v112.js','ownership-feed-v113.js','lifecycle-platform-v95.js','passport-commerce-v92.js','site-quality-v82.js','design-clarity-v84.js','progressive-forms-v88.js','flow-feedback-v89.js','still-public-v114.js','world-foundation-v131.js'];
const css=['readability-v57.css','saved-polish-v58.css','readability-v59.css','buyer-company-v60.css','relationship-v61.css','buyer-case-polish-v62.css','hero-density-v63.css','buyer-onboarding-v65.css','business-entry-v66.css','purchase-intelligence-v67.css','branch-match-v68.css','notifications-v69.css','buyer-rewards-v76.css','buyer-auth-v77.css','ownership-platform-v83.css','ownership-onboarding-v111.css','ownership-home-v112.css','ownership-feed-v113.css','lifecycle-platform-v95.css','passport-commerce-v92.css','site-quality-v82.css','design-system-v84.css','responsive-readability-v85.css','surface-polish-v86.css','refinement-v87.css','interaction-clarity-v88.css','flow-feedback-v89.css','visual-details-v90.css','rewards-visible-v91.css','brand-alignment-v104.css','company-capabilities.css','still-v114.css','world-foundation-v131.css'];
// Keep the complete capability inventory shipped for authenticated and deep-linked
// experiences, but activate only the landing shell and authentication on `/`.
// Loading every historical buyer module here made the Google account chooser
// compete with hidden dashboards for memory and could crash embedded browsers.
const publicRuntime=['theme.js','buyer-auth-v77.js','still-public-v114.js'];
const publicStyles=['buyer-auth-v77.css','still-v114.css'];
const companyFeatureScripts=['company-commerce-v92.js','company-passport-studio-v83.js','company-lifecycle-v95.js','company-operations-v96.js','retailer-claim-v48.js','company-inbox-v60.js','company-relationship-v61.js','company-branches-v68.js','company-notifications-v69.js','company-workbench-v72.js','company-services-mount-v79.js','company-services-v73.js','company-ops-v74.js','company-rewards-v75.js','company-control-center-v101.js','company-inventory-live-v110.js','company-intelligence-v128.js','companyos-v120.js'];
const companyScripts=['company-runtime-guard-v80.js','company-positioning-v83.js','company-authenticated-loader-v82.js','company-portal-v46.js','relationship-dashboard-v103.js','contact-profile-v104.js','qrcode-generator-v94.js','electronic-shelf-labels-v106.js','site-quality-v82.js','company-intelligence-v107.js','still-business-v114.js'];
const companyStyles=['relationship-v61.css','company-branches-v68.css','notifications-v69.css','company-workbench-v72.css','company-services-v73.css','company-ops-v74.css','company-rewards-v75.css','company-positioning-v83.css','company-passport-studio-v83.css','company-commerce-v92.css','company-lifecycle-v95.css','company-operations-v96.css','company-control-center-v101.css','relationship-dashboard-v103.css','electronic-shelf-labels-v106.css','site-quality-v82.css','design-system-v84.css','responsive-readability-v85.css','surface-polish-v86.css','refinement-v87.css','visual-details-v90.css','rewards-visible-v91.css','brand-alignment-v104.css','still-v114.css','companyos-v120.css','company-intelligence-v128.css'];
const companyExtra=[...companyScripts,...companyFeatureScripts,...companyStyles];
const files=['index.html','app.html','company.html','pricing.html','pricing-v114.js','admin.html','admin.js','styles.css',...css,'share-icons.css','og-v85.png',...runtime,'still-os-v133.js','still-os-v133.css','needs-resolution-v134.js','needs-resolution-v134.css','still-market-v135.js','still-market-v135.css','buyer-wallet-v96.js',...companyExtra,'admin-notifications-v69.js','privacy.html','terms.html','methodology.html','legal-i18n.js','robots.txt','sitemap.xml'];
const out=path.join(__dirname,'public');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});for(const f of files){const src=path.join(__dirname,f);if(!fs.existsSync(src))throw Error(`Missing canonical production asset: ${f}`);const target=path.join(out,f);fs.copyFileSync(src,target);if(f.endsWith('.js')){const source=fs.readFileSync(target,'utf8');fs.writeFileSync(target,source.replace(/\?v=\d+\b/g,`?v=${BUNDLE}`))}}
const stripScript=(html,f)=>{const e=f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return html.replace(new RegExp(`<script[^>]+src=["'][^"']*${e}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`,'gi'),'')};
const stripStyle=(html,f)=>{const e=f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return html.replace(new RegExp(`<link[^>]+href=["'][^"']*${e}(?:\\?[^"']*)?["'][^>]*>`,'gi'),'')};
const ip=path.join(out,'index.html');let h=fs.readFileSync(ip,'utf8');for(const f of ['styles.css','share-icons.css',...publicStyles])h=stripStyle(h,f);for(const f of runtime)h=stripScript(h,f);for(const f of companyScripts)h=stripScript(h,f);h=h.replace(/<main(?:\s[^>]*)?>[\s\S]*?<\/main>/i,'<main></main>');const tags=publicRuntime.map(f=>`<script src="${f}?v=${BUNDLE}" defer></script>`).join('\n');const googleConnections='<link rel="preconnect" href="https://accounts.google.com"><link rel="preconnect" href="https://accounts.gstatic.com" crossorigin>';const styleTags=publicStyles.map(f=>`<link rel="stylesheet" href="${f}?v=${BUNDLE}">`).join('\n');h=h.replace('</body>',tags+'\n</body>').replace(/<meta name=["']still-build["'][^>]*>/gi,'').replace(/<link rel=["']preconnect["'][^>]+accounts\.(?:google|gstatic)\.com[^>]*>/gi,'').replace('</head>',`${googleConnections}${styleTags}<meta name="still-build" content="${BUNDLE}"></head>`);const marker=`<span id="stillBuildMarker" style="display:block;margin-top:8px;font-size:9px;font-weight:500;opacity:.55">Build ${BUNDLE}</span>`;h=/<footer[\s>]/i.test(h)?h.replace(/(<\/footer>)/i,marker+'$1'):h.replace('</body>',marker+'</body>');fs.writeFileSync(ip,h);
const cp=path.join(out,'company.html');let company=fs.readFileSync(cp,'utf8');for(const f of [...companyScripts,...companyFeatureScripts])company=stripScript(company,f);for(const f of companyStyles)company=stripStyle(company,f);company=stripScript(company,'theme.js');company=company.replace(/\?v=\d+/g,`?v=${BUNDLE}`).replace(/<meta name=["']still-build["'][^>]*>/gi,'');company=company.replace('</head>',`<meta name="still-build" content="${BUNDLE}">`+companyStyles.map(f=>`<link rel="stylesheet" href="${f}?v=${BUNDLE}">`).join('')+'</head>');const companyTags=[`<script src="theme.js?v=${BUNDLE}" defer></script>`,...companyScripts.map(f=>`<script src="${f}?v=${BUNDLE}" defer></script>`)].join('');company=company.replace('</body>',companyTags+'</body>');fs.writeFileSync(cp,company);
const pp=path.join(out,'pricing.html');let pricing=fs.readFileSync(pp,'utf8');pricing=stripScript(pricing,'theme.js');pricing=stripScript(pricing,'pricing-v114.js');pricing=stripStyle(pricing,'still-v114.css');pricing=pricing.replace(/<meta name=["']still-build["'][^>]*>/gi,'').replace('</head>',`<meta name="still-build" content="${BUNDLE}"><link rel="stylesheet" href="still-v114.css?v=${BUNDLE}"></head>`).replace('</body>',`<script src="theme.js?v=${BUNDLE}" defer></script><script src="pricing-v114.js?v=${BUNDLE}" defer></script></body>`);fs.writeFileSync(pp,pricing);
const osp=path.join(out,'app.html');let stillOS=fs.readFileSync(osp,'utf8');stillOS=stillOS.replace(/\?v=\d+\b/g,`?v=${BUNDLE}`).replace(/<meta name=["']still-build["'][^>]*>/gi,'').replace('</head>',`<meta name="still-build" content="${BUNDLE}"></head>`);fs.writeFileSync(osp,stillOS);
const ap=path.join(out,'admin.html');let admin=fs.readFileSync(ap,'utf8');admin=admin.replace('</head>',`<link rel="stylesheet" href="notifications-v69.css?v=${BUNDLE}"></head>`).replace('</body>',`<script src="admin-notifications-v69.js?v=${BUNDLE}" defer></script></body>`);fs.writeFileSync(ap,admin);
fs.copyFileSync(path.join(__dirname,'_headers'),path.join(out,'_headers'));fs.writeFileSync(path.join(out,'build.json'),JSON.stringify({app:'Still',productionBundle:BUNDLE,architecture:'still-os-world-needs-resolution-ownership-native-market-with-preserved-company-workspace',generatedAt:new Date().toISOString(),runtime,publicRuntime,publicStyles,authenticatedApp:['app.html','still-os-v133.js','still-os-v133.css','needs-resolution-v134.js','needs-resolution-v134.css','still-market-v135.js','still-market-v135.css'],companyScripts,companyFeatureScripts,files},null,2)+'\n');console.log(`Built V${BUNDLE}: Still OS with a lightweight public sign-in shell and preserved authenticated capabilities.`);
for(const page of ['index.html','company.html']){const target=path.join(out,page);let themed=fs.readFileSync(target,'utf8');themed=themed.replace('#f4f8f5','#e9f0f5').replace('#eef2f4','#e9f0f5');fs.writeFileSync(target,themed)}
const socialIndex=path.join(out,'index.html');let social=fs.readFileSync(socialIndex,'utf8');social=storageOwnershipMeta(social);fs.writeFileSync(socialIndex,social);
function upsertMeta(html,pattern,tag){return pattern.test(html)?html.replace(pattern,tag):html.replace('</head>',tag+'</head>')}
function storageOwnershipMeta(html){let x=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>Still · Everything you own.</title>');x=upsertMeta(x,/<meta[^>]+name=["']description["'][^>]*>/i,'<meta name="description" content="Everything you own, in one trusted place. Keep the proof, know what needs attention, handle the next step and share only what you choose.">');x=upsertMeta(x,/<meta[^>]+property=["']og:title["'][^>]*>/i,'<meta property="og:title" content="Still · Everything you own.">');x=upsertMeta(x,/<meta[^>]+property=["']og:description["'][^>]*>/i,'<meta property="og:description" content="Keep the proof, know what needs attention, handle the next step and share only what you choose.">');x=upsertMeta(x,/<meta[^>]+property=["']og:image["'][^>]*>/i,'<meta property="og:image" content="https://still-mvp.tomislav-ukic-tu.workers.dev/og-v85.png">');x=upsertMeta(x,/<meta[^>]+property=["']og:image:width["'][^>]*>/i,'<meta property="og:image:width" content="1200">');x=upsertMeta(x,/<meta[^>]+property=["']og:image:height["'][^>]*>/i,'<meta property="og:image:height" content="630">');x=upsertMeta(x,/<meta[^>]+property=["']og:image:alt["'][^>]*>/i,'<meta property="og:image:alt" content="Still — Everything you own.">');x=upsertMeta(x,/<meta[^>]+name=["']twitter:card["'][^>]*>/i,'<meta name="twitter:card" content="summary_large_image">');return upsertMeta(x,/<meta[^>]+name=["']twitter:image["'][^>]*>/i,'<meta name="twitter:image" content="https://still-mvp.tomislav-ukic-tu.workers.dev/og-v85.png">')}


/* STILL_PROTECTION_BUILD_COPY_V1 */
;(() => {
  const protectionFs = require('fs');
  const protectionPath = require('path');

  const source = protectionPath.join(
    __dirname,
    'buyer',
    'protection'
  );

  const destination = protectionPath.join(
    __dirname,
    'public',
    'buyer',
    'protection'
  );

  if (!protectionFs.existsSync(source)) {
    throw new Error(
      'Protection source directory is missing: ' + source
    );
  }

  protectionFs.mkdirSync(destination, {
    recursive: true
  });

  protectionFs.cpSync(
    source,
    destination,
    {
      recursive: true,
      force: true
    }
  );

  console.log(
    'Protection Center assets copied to production bundle.'
  );
})();
