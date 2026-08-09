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
  'relationship-dashboard-v103.js',
  'contact-profile-v104.js',
  'still-public-v114.js',
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
  'relationship-dashboard-v103.css',
  'brand-alignment-v104.css',
  'still-v114.css',
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
const manifestText = read('public/build.json');
let manifest = {};

try {
  manifest = JSON.parse(manifestText);
} catch {
  fail('public/build.json is not valid JSON');
}

const bundle = manifest.productionBundle;
if (!Number.isInteger(bundle) || bundle < 1) fail('public/build.json has no valid productionBundle');

for (const file of buyerScripts) {
  assertFileExists(`public/${file}`);
  assertManifestIncludes(manifest.runtime, file, 'BuyerOS runtime manifest');
  if (bundle) assertVersionedReference(indexHtml, 'public/index.html', file, bundle);
}

for (const file of buyerStyles) {
  assertFileExists(`public/${file}`);
  assertManifestIncludes(manifest.files, file, 'production file manifest');
  if (bundle) assertVersionedReference(indexHtml, 'public/index.html', file, bundle);
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

for (const [page, html] of [['public/index.html', indexHtml], ['public/company.html', companyHtml], ['public/pricing.html', pricingHtml]]) {
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
if (!indexHtml.includes('still-public-v114.js')) fail('consumer-first public experience is not shipped');
if (!indexHtml.includes('still-v114.css')) fail('consumer-first visual system is not shipped');
if (!companyHtml.includes('still-business-v114.js')) fail('Still for Business public experience is not shipped');
if (!companyHtml.includes('companyos-v120.css')) fail('live CompanyOS visual system is not shipped');
if (!pricingHtml.includes('pricing-v114.js') || !pricingHtml.includes('still-v114.css')) fail('pricing hierarchy is not shipped');
const consumerRuntime = read('public/still-public-v114.js');
if (!consumerRuntime.includes('Everything you own.') || !consumerRuntime.includes('One trusted place.')) fail('consumer proposition is missing from production runtime');
if (!consumerRuntime.includes('data-still-start') || !consumerRuntime.includes("openTool('ownership')")) fail('consumer CTAs are not connected to the real ownership workflow');
if (!consumerRuntime.includes("t('Planned', 'Planirano')")) fail('unavailable consumer capabilities are not truthfully labelled');
const companyRuntime = read('public/companyos-v120.js');
if (!companyRuntime.includes('/api/v1/companyos/bootstrap')) fail('CompanyOS does not load authenticated production records');
if (!companyRuntime.includes('/api/v1/companyos/memory')) fail('CompanyOS authorized memory is missing');
if (!companyRuntime.includes('idempotency-key')) fail('CompanyOS mutations are not issued with idempotency keys');
if (companyRuntime.includes('sessionStorage') || companyRuntime.includes('localStorage')) fail('CompanyOS production shell contains browser-only simulated persistence');

if (failures.length) {
  console.error(`Production bundle validation FAILED\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Production bundle validation passed (bundle ${bundle}, ${buyerScripts.length} BuyerOS scripts, ${companyScripts.length} CompanyOS scripts).`);
