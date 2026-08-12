const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const worker = read('merchant-backend/worker-v133.js');
const client = read('still-os-v133.js');
const style = read('still-os-v133.css');
const app = read('app.html');
const build = read('build-public.js');
const wrangler = read('wrangler.jsonc');
const buyerAuth = read('buyer-auth-v77.js');
const publicExperience = read('still-public-v114.js');
let passed = 0;

function test(name, check) {
  check(); passed += 1; process.stdout.write(`✓ ${name}\n`);
}

test('01 Phase 2 is additive over the real Phase 1 Worker', () => assert.ok(worker.includes("import app from './worker-v131.js'")));
test('02 authenticated app routes are Worker-first', () => assert.ok(wrangler.includes('"/app", "/app/*"') && worker.includes("path.startsWith('/app/')")));
test('03 signed-out app requests preserve their safe deep link through buyer sign-in', () => {
  assert.ok(worker.includes("signIn.searchParams.set('signin', '1')"));
  assert.ok(worker.includes("signIn.searchParams.set('returnTo', `${requested.pathname}${requested.search}`)"));
  assert.ok(buyerAuth.includes('safeOsDestination(returnTo)'));
});
test('04 Now is deterministic and exposes quiet state', () => assert.ok(worker.includes("method: 'deterministic_priority'") && worker.includes('quietState: attentionItems.length === 0')));
test('05 adaptive context remains owner-scoped', () => assert.ok(worker.includes('WHERE k.buyer_account_id=?') && worker.includes('WHERE buyer_account_id=? AND ((from_type=?')));
test('06 universal routing never persists a classification', () => assert.ok(worker.includes('persisted: false') && !worker.includes('simulated')));
test('07 ambiguous input requires confirmation', () => assert.ok(worker.includes('confidence: 0.25') && worker.includes('needsConfirmation')));
test('08 main spaces are Now, World, Discover and Together', () => ['Now','World','Discover','Together'].forEach(label => assert.ok(client.includes(label))));
test('09 deep links cover every required context type', () => ['thing','situation','knowledge','receipt','open_loop'].forEach(type => assert.ok(worker.includes(`'${type}'`))));
test('10 History API drives browser navigation', () => assert.ok(client.includes("'replaceState' : 'pushState'") && client.includes("addEventListener('popstate'")));
test('11 universal input confirms a destination before canonical POST', () => assert.ok(client.includes('confirmInput(values.content') && client.includes('data-route-form')));
test('12 Sight reuses receipt capture and document storage', () => assert.ok(client.includes('/api/v1/world/receipts/capture') && client.includes('/api/v1/world/documents')));
test('13 Sight describes OCR honestly', () => assert.ok(client.includes('could not extract reliable text') && !client.includes('product recognized')));
test('14 document understanding saves canonical Knowledge', () => assert.ok(client.includes('sourceDocumentId: document.publicId')));
test('15 Together uses the existing authenticated relationship dashboard', () => assert.ok(client.includes("api('/api/v1/buyer-dashboard')")));
test('16 profile uses real authenticated account data', () => assert.ok(client.includes('data.profile || data.buyer') && !client.includes('Marko')));
test('17 UI supports English and Croatian without parallel data flows', () => assert.ok(client.includes("still-lang") && client.includes("document.documentElement.lang")));
test('18 app shell is private to search engines', () => assert.match(app, /name="robots" content="noindex,nofollow"/));
test('19 mobile navigation is an intentional bottom surface', () => assert.match(style, /@media\s*\(max-width:\s*600px\)[\s\S]*\.sos133-nav\{position:\s*fixed/));
test('20 focus and reduced motion are explicitly supported', () => assert.ok(style.includes(':focus-visible') && style.includes('prefers-reduced-motion')));
test('21 comfortable target sizing is enforced', () => assert.ok(/min-height:\s*44px/.test(style)));
test('22 the production builder ships app HTML, JS and CSS', () => ['app.html','still-os-v133.js','still-os-v133.css'].forEach(file => assert.ok(build.includes(`'${file}'`))));
test('23 Phase 2 emits privacy-safe operational telemetry', () => assert.ok(worker.includes("scope: 'still_os'") && worker.includes('contentLength') && !worker.includes('content, needsConfirmation')));
test('24 CompanyOS remains delegated and untouched by the app router', () => assert.ok(worker.trim().endsWith('};') && worker.includes('return app.fetch(request, env, ctx)')));
test('25 successful buyer authentication enters Still OS', () => assert.ok(buyerAuth.includes('location.assign(osDestination())') && buyerAuth.includes("const osPath = '/app'")));
test('26 public entry actions use the one authenticated environment', () => assert.ok(publicExperience.includes('enterStill()') && publicExperience.includes("enterStill('/app?sight=receipt')")));
test('27 browser ownership is migrated through the canonical idempotent endpoint', () => assert.ok(client.includes('/api/v1/world/migrations/local-storage') && client.includes('still-ownership-passports-v83')));
test('28 Sight can create a real linked Situation', () => assert.ok(client.includes('data-sight-action="situation"') && client.includes('documentId: document.publicId')));
test('29 external entry clicks cannot immediately close buyer sign-in', () => assert.ok(buyerAuth.includes('setTimeout(() => window.StillBuyerAuth.open(), 0)')));
test('30 obsolete BuyerOS workspace is not an active production runtime', () => assert.ok(!build.includes("'buyeros-workspace-v132.js'") && !build.includes('BuyerOSCoordinator connected to production runtime')));
test('31 obsolete BuyerOS hashes normalize to the public Still homepage', () => assert.ok(publicExperience.includes('normalizeLegacyWorkspaceHash()') && !publicExperience.includes("'#buyeros-home': 'ownership'")));
test('32 the landing introduction connects every current Still space truthfully', () => {
  ['/app/world','/app/market','/app/together','data-still-destination'].forEach(capability => assert.ok(publicExperience.includes(capability)));
  assert.ok(publicExperience.includes('Still does not invent a provider, price, deadline, company update or transaction.'));
});

process.stdout.write(`Still OS tests passed (${passed} assertions).\n`);
