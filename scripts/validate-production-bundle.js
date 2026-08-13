const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDirectory = path.join(root, 'public');
const failures = [];

const buyerScripts = [
  'actions-v17.js',
  'ownership-platform-v83.js',
  'ownership-onboarding-v111.js',
  'ownership-home-v112.js',
  'ownership-feed-v113.js',
  'qrcode-generator-v94.js',
  'lifecycle-platform-v95.js',
  'passport-commerce-v92.js',
  'site-quality-v82.js',
  'design-clarity-v84.js',
  'progressive-forms-v88.js',
  'flow-feedback-v89.js',
  'still-public-v114.js',
  'world-foundation-v131.js',
];

const buyerStyles = [
  'ownership-platform-v83.css',
  'ownership-onboarding-v111.css',
  'ownership-home-v112.css',
  'ownership-feed-v113.css',
  'lifecycle-platform-v95.css',
  'passport-commerce-v92.css',
  'site-quality-v82.css',
  'design-system-v84.css',
  'responsive-readability-v85.css',
  'surface-polish-v86.css',
  'refinement-v87.css',
  'interaction-clarity-v88.css',
  'flow-feedback-v89.css',
  'visual-details-v90.css',
  'rewards-visible-v91.css',
  'brand-alignment-v104.css',
  'still-v114.css',
  'world-foundation-v131.css',
];

const companyScripts = [
  'company-authenticated-loader-v82.js',
  'company-passport-studio-v83.js',
  'company-commerce-v92.js',
  'company-lifecycle-v95.js',
  'company-operations-v96.js',
  'company-control-center-v101.js',
  'company-inventory-live-v110.js',
  'electronic-shelf-labels-v106.js',
  'company-intelligence-v107.js',
  'still-business-v114.js',
  'company-intelligence-v128.js',
  'companyos-v120.js',
];

const companyStyles = [
  'company-passport-studio-v83.css',
  'company-commerce-v92.css',
  'company-lifecycle-v95.css',
  'company-operations-v96.css',
  'company-control-center-v101.css',
  'electronic-shelf-labels-v106.css',
  'still-v114.css',
  'companyos-v120.css',
  'company-intelligence-v128.css',
];

const retiredDemoAssets = [
  'company-preview-v97.js',
  'company-demo-v102.js',
  'company-unified-workspace-v109.js',
  'company-progressive-access-v108.js',
  'company-capabilities-v1.js',
  'company-preview-v97.css',
  'company-demo-v102.css',
];

const staticAssets = ['og-v85.png'];
const publicRuntime = ['theme.js', 'buyer-auth-v77.js', 'still-public-v114.js'];
const publicStyles = ['buyer-auth-v77.css', 'still-v114.css'];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) {
    fail(`missing ${relativePath}`);
    return '';
  }
  return fs.readFileSync(target, 'utf8');
}

function assertFileExists(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) fail(`missing ${relativePath}`);
}

function assetReference(html, file) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`(?:src|href)=["']${escaped}\\?v=([^"']+)["']`, 'i'))?.[1];
}

function assertVersionedReference(html, page, file, build) {
  const version = assetReference(html, file);
  if (version !== String(build)) {
    fail(`${page} does not load ${file} with active bundle ${build}`);
  }
}

function assertManifestIncludes(list, file, label) {
  if (!Array.isArray(list) || !list.includes(file)) fail(`${label} is missing ${file}`);
}

const indexHtml = read('public/index.html');
const companyHtml = read('public/company.html');
const pricingHtml = read('public/pricing.html');
const appHtml = read('public/app.html');
const manifestText = read('public/build.json');
let manifest = {};

try {
  manifest = JSON.parse(manifestText);
} catch {
  fail('public/build.json is not valid JSON');
}

const bundle = manifest.productionBundle;
if (!Number.isInteger(bundle) || bundle < 1) fail('public/build.json has no valid productionBundle');

for (const file of ['app.html', 'still-os-v133.js', 'still-os-v133.css', 'needs-resolution-v134.js', 'needs-resolution-v134.css', 'still-market-v135.js', 'still-market-v135.css']) {
  assertFileExists(`public/${file}`);
  assertManifestIncludes(manifest.files, file, 'production file manifest');
}
for (const file of ['app.html', 'still-os-v133.js', 'still-os-v133.css', 'needs-resolution-v134.js', 'needs-resolution-v134.css', 'still-market-v135.js', 'still-market-v135.css']) {
  assertManifestIncludes(manifest.authenticatedApp, file, 'authenticated Still OS manifest');
}
if (bundle) {
  assertVersionedReference(appHtml, 'public/app.html', 'still-os-v133.js', bundle);
  assertVersionedReference(appHtml, 'public/app.html', 'still-os-v133.css', bundle);
  assertVersionedReference(appHtml, 'public/app.html', 'needs-resolution-v134.js', bundle);
  assertVersionedReference(appHtml, 'public/app.html', 'needs-resolution-v134.css', bundle);
  assertVersionedReference(appHtml, 'public/app.html', 'still-market-v135.js', bundle);
  assertVersionedReference(appHtml, 'public/app.html', 'still-market-v135.css', bundle);
  assertVersionedReference(appHtml, 'public/app.html', 'theme.js', bundle);
}

for (const file of buyerScripts) {
  assertFileExists(`public/${file}`);
  assertManifestIncludes(manifest.runtime, file, 'BuyerOS runtime manifest');
}

for (const file of buyerStyles) {
  assertFileExists(`public/${file}`);
  assertManifestIncludes(manifest.files, file, 'production file manifest');
}

if (JSON.stringify(manifest.publicRuntime) !== JSON.stringify(publicRuntime)) {
  fail(`public landing runtime must contain only ${publicRuntime.join(', ')}`);
}
if (JSON.stringify(manifest.publicStyles) !== JSON.stringify(publicStyles)) {
  fail(`public landing styles must contain only ${publicStyles.join(', ')}`);
}
for (const file of publicRuntime) {
  if (bundle) assertVersionedReference(indexHtml, 'public/index.html', file, bundle);
}
for (const file of publicStyles) {
  if (bundle) assertVersionedReference(indexHtml, 'public/index.html', file, bundle);
}
for (const file of (manifest.runtime || []).filter(file => !publicRuntime.includes(file))) {
  if (assetReference(indexHtml, file)) fail(`public landing activates non-essential runtime ${file}`);
}
for (const file of buyerStyles.filter(file => !publicStyles.includes(file))) {
  if (assetReference(indexHtml, file)) fail(`public landing activates non-essential style ${file}`);
}
if (!/<main>\s*<\/main>/i.test(indexHtml)) fail('public landing ships the legacy homepage DOM instead of the lightweight Still shell');
if (assetReference(indexHtml, 'share-icons.css')) fail('public landing activates the retired share-control stylesheet');
if (assetReference(indexHtml, 'styles.css')) fail('public landing activates the retired checker stylesheet');
for (const marker of ['Consumer rights checker','returnForm','checker-card','hero-share-row']) {
  if (indexHtml.includes(marker)) fail(`public landing contains retired UI marker ${marker}`);
}
for (const capability of ['use_fedcm_for_button: true','button_auto_select: true','itp_support: true']) {
  if (!read('public/buyer-auth-v77.js').includes(capability)) fail(`production buyer sign-in is missing ${capability}`);
}
for (const origin of ['https://accounts.google.com', 'https://accounts.gstatic.com']) {
  if (!indexHtml.includes(`rel="preconnect" href="${origin}"`)) fail(`public landing does not preconnect to ${origin}`);
}

for (const file of companyScripts) {
  assertFileExists(`public/${file}`);
  const declared = (manifest.companyScripts || []).includes(file) || (manifest.companyFeatureScripts || []).includes(file);
  if (!declared) fail(`CompanyOS runtime manifest is missing ${file}`);
}

for (const file of companyStyles) {
  assertFileExists(`public/${file}`);
  assertManifestIncludes(manifest.files, file, 'production file manifest');
  if (bundle) assertVersionedReference(companyHtml, 'public/company.html', file, bundle);
}

for (const file of retiredDemoAssets) {
  if (fs.existsSync(path.join(publicDirectory, file))) fail(`retired demo asset is still shipped: ${file}`);
  if ((manifest.files || []).includes(file)) fail(`retired demo asset remains in production manifest: ${file}`);
  if ((manifest.companyScripts || []).includes(file) || (manifest.companyFeatureScripts || []).includes(file)) fail(`retired demo runtime remains active: ${file}`);
}

for (const file of staticAssets) {
  assertFileExists(`public/${file}`);
  assertManifestIncludes(manifest.files, file, 'production file manifest');
}

for (const file of (manifest.files || []).filter(file => file.endsWith('.js'))) {
  const source = read(`public/${file}`);
  for (const match of source.matchAll(/\?v=(\d+)\b/g)) {
    if (match[1] !== String(bundle)) fail(`public/${file} contains mixed runtime cache version ${match[1]} (expected ${bundle})`);
  }
}

const activeSourceFiles = new Set([
  'index.html',
  'company.html',
  ...(manifest.runtime || []),
  ...(manifest.companyScripts || []),
  ...(manifest.companyFeatureScripts || []),
]);

for (const file of activeSourceFiles) {
  const source = read(file);
  const fixedVersion = source.match(/\?v=(\d+)\b/);
  if (fixedVersion) fail(`${file} hardcodes cache version ${fixedVersion[1]} instead of resolving the active build`);
}

for (const file of manifest.companyScripts || []) {
  if (bundle) assertVersionedReference(companyHtml, 'public/company.html', file, bundle);
}

for (const [page, html] of [['public/index.html', indexHtml], ['public/app.html', appHtml], ['public/company.html', companyHtml], ['public/pricing.html', pricingHtml]]) {
  const metaBuild = html.match(/<meta\s+name=["']still-build["']\s+content=["']([^"']+)["']/i)?.[1];
  if (String(metaBuild) !== String(bundle)) fail(`${page} still-build metadata does not match productionBundle`);
  for (const match of html.matchAll(/(?:src|href)=["'][^"']+\?v=([^"']+)["']/gi)) {
    if (match[1] !== String(bundle)) fail(`${page} contains mixed cache version ${match[1]} (expected ${bundle})`);
  }
}

if (!/<title>Still · Everything you own\.<\/title>/i.test(indexHtml)) fail('Still production title is not ownership-first');
if (!/<meta\s+name=["']description["'][^>]+content=["'][^"']*own[^"']*["']/i.test(indexHtml)) fail('BuyerOS production description is not ownership-first');
if (!/<meta\s+property=["']og:title["'][^>]+Everything you own\./i.test(indexHtml)) fail('BuyerOS Open Graph title is not ownership-first');
if (!/<meta\s+name=["']twitter:card["'][^>]+summary_large_image/i.test(indexHtml)) fail('BuyerOS Twitter card metadata is missing');
if ((manifest.runtime || []).includes('buyer-auth-routes-v79.js')) fail('obsolete global buyer auth shim is shipped');
if ((manifest.runtime || []).includes('buyeros-workspace-v132.js')) fail('obsolete local-only BuyerOS workspace is shipped');
if (indexHtml.includes('buyeros-workspace-v132.js') || indexHtml.includes('BuyerOSCoordinator.js')) fail('obsolete BuyerOS dashboard is active on the public homepage');
if (!indexHtml.includes('still-public-v114.js')) fail('consumer-first public experience is not shipped');
if (!indexHtml.includes('still-v114.css')) fail('consumer-first visual system is not shipped');
if (!companyHtml.includes('still-business-v114.js')) fail('Still for Business public experience is not shipped');
if (!companyHtml.includes('companyos-v120.css')) fail('live CompanyOS visual system is not shipped');
if (!pricingHtml.includes('pricing-v114.js') || !pricingHtml.includes('still-v114.css')) fail('pricing hierarchy is not shipped');
const consumerRuntime = read('public/still-public-v114.js');
if (!consumerRuntime.includes('Everything you own.') || !consumerRuntime.includes('One trusted place.')) fail('consumer proposition is missing from production runtime');
if (!consumerRuntime.includes('data-still-start') || !consumerRuntime.includes("enterStill('/app/world')")) fail('consumer CTAs are not connected to the authenticated Still ownership workflow');
if (manifest.runtime?.some(file => ['relationship-dashboard-v103.js','contact-profile-v104.js','buyer-auth-layout-v78.js'].includes(file))) fail('authenticated profile/dashboard modules are shipped in the public landing runtime');
if (consumerRuntime.includes('stillAccountMountV114') || consumerRuntime.includes('data-still-tool')) fail('private account or legacy tool controls are mounted in the public landing story');
if (!consumerRuntime.includes("auth.classList.add('sp114-auth-stage')") || !read('public/still-v114.css').includes('sp114-auth-stage')) fail('anchored top-level buyer sign-in stage is not shipped');
if (!consumerRuntime.includes('quarantineLegacyPublicModules()') || !consumerRuntime.includes("element.style.setProperty('display', 'none', 'important')")) fail('public runtime does not quarantine late legacy buyer modules');
if (consumerRuntime.includes('initializeStillProtection') || consumerRuntime.includes('data-still-protection-runtime')) fail('public landing starts the private Protection runtime before authentication');
if (consumerRuntime.includes("if (!$('#ownershipPlatformV83'))")) fail('public landing waits for the legacy ownership platform before rendering');
if (!consumerRuntime.includes('restoreLanguage()') || !consumerRuntime.includes('persistLanguage()')) fail('lightweight public landing does not preserve language preference');
if (!read('public/buyer-auth-v77.js').includes('const start = refresh;')) fail('buyer authentication is delayed after the public shell placement step');
if (!consumerRuntime.includes("t('PLANNED', 'PLANIRANO')") || !consumerRuntime.includes('Still+')) fail('unavailable premium consumer capabilities are not truthfully labelled');
const worldRuntime = read('public/world-foundation-v131.js');
for (const capability of ['/api/v1/world/bootstrap','/api/v1/world/things','/api/v1/world/receipts/capture','/api/v1/world/knowledge','/api/v1/world/situations','/api/v1/world/open-loops']) {
  if (!worldRuntime.includes(capability)) fail(`World Foundation production runtime is missing ${capability}`);
}
if (!worldRuntime.includes("source: 'authenticated_world'") || !worldRuntime.includes('still-ownership-passports-v83')) fail('World Foundation does not migrate and replace browser-only ownership state');
const osRuntime = read('public/still-os-v133.js');
for (const route of ['/api/v1/world/now','/api/v1/world/context/','/api/v1/world/input/route','/api/v1/world/receipts/capture','/api/v1/world/documents','/api/v1/world/knowledge','/api/v1/world/relationships']) {
  if (!osRuntime.includes(route)) fail(`Still OS production runtime is missing ${route}`);
}
for (const route of ['/api/v1/buyer-dashboard','/api/v1/buyer-profile','/api/v1/buyer-profile/photo']) {
  if (!osRuntime.includes(route)) fail(`authenticated Still profile management is missing ${route}`);
}
if (!osRuntime.includes('/api/v1/buyer-auth/logout') || !osRuntime.includes('recentPassports')) fail('authenticated Still account overview or logout is not shipped');
for (const area of ['Now','World','Market','Discover','Together']) {
  if (!osRuntime.includes(area)) fail(`Still OS navigation is missing ${area}`);
}
if (!osRuntime.includes("'replaceState' : 'pushState'") || !osRuntime.includes("addEventListener('popstate'")) fail('Still OS deep-link navigation is not shipped');
if (!osRuntime.includes('confirmInput(values.content') || !osRuntime.includes('data-route-form')) fail('Still OS universal input does not require destination confirmation');
if (!osRuntime.includes('/api/v1/world/receipts/capture') || !osRuntime.includes('/api/v1/world/documents')) fail('Still Sight does not reuse canonical receipt and document services');
const phase2Worker = read('merchant-backend/worker-v133.js');
if (!phase2Worker.includes("import app from './worker-v131.js'") || !phase2Worker.includes("path.startsWith('/app/')")) fail('active Still OS Worker does not preserve Phase 1 or authenticated app routing');
if (!phase2Worker.includes("path === '/api/v1/world/input/route'") || !phase2Worker.includes('/api\\/v1\\/world\\/context')) fail('active Still OS Worker lacks context or input services');
const resolutionRuntime = read('public/needs-resolution-v134.js');
for (const capability of ['/api/v1/world/needs','/context','/quotes','/resolve','/api/v1/world/resolution-outcomes']) {
  if (!resolutionRuntime.includes(capability)) fail(`Needs resolution runtime is missing ${capability}`);
}
if (!resolutionRuntime.includes('Real options from your World') || !resolutionRuntime.includes('Still does not verify provider quality')) fail('Needs resolution workspace lacks truthful option and quote language');
const phase3Worker = read('merchant-backend/worker-v134.js');
if (!phase3Worker.includes("import app from './worker-v133.js'") || !phase3Worker.includes('deterministic_world_first')) fail('active Phase 3 Worker does not preserve Still OS or deterministic resolution');
for (const capability of ['world_needs','world_need_quotes','world_resolution_outcomes','duplicate_need_review_required','thing.service_recorded']) {
  if (!phase3Worker.includes(capability)) fail(`active Phase 3 Worker is missing ${capability}`);
}
const marketRuntime = read('public/still-market-v135.js');
for (const capability of ['/api/v1/market/bootstrap','/api/v1/market/listings','/api/v1/market/wanted','/api/v1/market/offers','/api/v1/market/deals/','/api/v1/market/transfers/']) {
  if (!marketRuntime.includes(capability)) fail(`Still Market production runtime is missing ${capability}`);
}
const marketWorker = read('merchant-backend/worker-v135.js');
if (!marketWorker.includes("import app from './worker-v134.js'") || !marketWorker.includes('privacy_filter_applied')) fail('active Market Worker does not preserve Phase 3 or privacy-filtered transfer');
for (const capability of ['market_listings','market_wanted','market_offers','market_deals','market_transfers','EXTERNAL_MANUAL']) {
  if (!marketWorker.includes(capability)) fail(`active Market Worker is missing ${capability}`);
}
const companyRuntime = read('public/companyos-v120.js');
if (!companyRuntime.includes('/api/v1/companyos/bootstrap')) fail('CompanyOS does not load authenticated production records');
if (!companyRuntime.includes('/api/v1/companyos/memory')) fail('CompanyOS authorized memory is missing');
if (!companyRuntime.includes('idempotency-key')) fail('CompanyOS mutations are not issued with idempotency keys');
if (companyRuntime.includes('sessionStorage') || companyRuntime.includes('localStorage')) fail('CompanyOS production shell contains browser-only simulated persistence');
for (const region of ['cos120-dashboard', 'cos120-record-rail', 'cos120-record-main', 'cos120-side', 'cos120-object-rail', 'cos120-dock']) {
  if (!companyRuntime.includes(region)) fail(`CompanyOS production cockpit is missing ${region}`);
}
if (!companyRuntime.includes('state.notifications.slice(0,5)')) fail('CompanyOS production activity is not sourced from authenticated notifications');
for (const tool of ['repairs', 'inventory', 'customer360', 'warranty']) {
  if (!companyRuntime.includes(`data-cos-tool="${tool}"`)) fail(`CompanyOS object workspace is missing ${tool}`);
}
if (!companyRuntime.includes('const toolGroups=') || companyRuntime.includes('const toolResults=')) fail('CompanyOS production bundle hides part of its tool catalogue');
if (!companyRuntime.includes('cos120ToolParking') || !companyRuntime.includes('parking.append(legacyNode)')) fail('CompanyOS production tool switching loses mounted modules');
if (!companyRuntime.includes('data-cos-memory-query')) fail('CompanyOS authorized assistant prompts are missing');
if (!read('public/companyos-v120.css').includes('.cos120-assistant-prompts button{width:100%')) fail('CompanyOS assistant prompt actions are not readable in production');
const productionToolSource = companyRuntime.match(/const tools=\[([\s\S]*?)\n  \];/)?.[1] || '';
const productionToolIds = [...productionToolSource.matchAll(/\['([A-Za-z][A-Za-z0-9]*)',t\(/g)].map(match => match[1]);
const productionToolGroups = companyRuntime.match(/const toolGroups=\[([\s\S]*?)\n  \];/)?.[1] || '';
for (const id of productionToolIds) {
  if (!productionToolGroups.includes(`'${id}'`)) fail(`CompanyOS production tool is outside the visible groups: ${id}`);
}
if (productionToolIds.length < 33) fail(`CompanyOS production tool catalogue is incomplete (${productionToolIds.length}/33)`);
if (!companyRuntime.includes('openUnavailableTool') || !companyRuntime.includes('state.permissions.buyerFacing')) fail('CompanyOS verification-gated tool context is missing');
const workbenchRuntime = read('public/company-workbench-v72.js');
if (!workbenchRuntime.includes("document.readyState==='loading'") || !workbenchRuntime.includes('else shell()')) fail('Company workbench cannot mount from the authenticated loader');
if (!workbenchRuntime.includes("$('#cos120ToolParking')") || !workbenchRuntime.includes('still:companyos-ready')) fail('Company workbench is not attached to the active CompanyOS shell');
if (!companyRuntime.includes("new CustomEvent('still:companyos-ready'")) fail('CompanyOS production runtime does not release dependent production tools');
if (!workbenchRuntime.includes("organizationStatus==='verified'") || !workbenchRuntime.includes('protectedBuyerData()')) fail('Company workbench production bundle does not protect buyer data while keeping private operations available');

if (failures.length) {
  console.error(`Production bundle validation FAILED\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Production bundle validation passed (bundle ${bundle}, ${publicRuntime.length} public scripts, ${buyerScripts.length} preserved BuyerOS capabilities, ${companyScripts.length} CompanyOS scripts).`);
