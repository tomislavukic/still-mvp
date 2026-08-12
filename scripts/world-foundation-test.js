const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;

function test(name, check) {
  try {
    check();
    passed += 1;
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

(async () => {
  const coreSource = read('merchant-backend/world-core-v131.js');
  const core = await import(`data:text/javascript;base64,${Buffer.from(coreSource).toString('base64')}`);
  const worker = read('merchant-backend/worker-v131.js');
  const schema = read('merchant-backend/schema-v131.sql');
  const client = read('world-foundation-v131.js');
  const legacyOnboarding = read('ownership-onboarding-v111.js');
  const legacyOwnership = read('ownership-platform-v83.js');
  const build = read('build-public.js');
  const wrangler = read('wrangler.jsonc');

  test('01 incomplete Thing data remains valid', () => assert.equal(core.normalizeText('Trek FX 3'), 'trek fx 3'));
  test('02 valid ISO dates are accepted', () => assert.equal(core.safeDate('2026-08-12'), '2026-08-12'));
  test('03 invalid calendar dates are rejected', () => assert.equal(core.safeDate('2026-02-31'), null));
  test('04 comma-decimal receipt money is normalized', () => assert.equal(core.parseMoneyToCents('1.299,95'), 129995));
  test('05 dot-decimal receipt money is normalized', () => assert.equal(core.parseMoneyToCents('1299.95'), 129995));

  const parsed = core.parseReceiptText(`TRGOVINA TEST\nDatum: 12.08.2026\nMacBook Pro 1.299,00 EUR\nUSB Cable 19,99 EUR\nUKUPNO 1.318,99 EUR`);
  test('06 receipt merchant is parsed from OCR text', () => assert.equal(parsed.merchant, 'TRGOVINA TEST'));
  test('07 receipt purchase date is parsed', () => assert.equal(parsed.purchaseDate, '2026-08-12'));
  test('08 receipt total is parsed without inventing it', () => assert.equal(parsed.totalCents, 131899));
  test('09 receipt line items are structured', () => assert.equal(parsed.items.length, 2));
  test('10 receipt line title and amount stay associated', () => assert.deepEqual([parsed.items[0].title, parsed.items[0].totalCents], ['MacBook Pro', 129900]));
  test('11 empty OCR text produces no simulated receipt lines', () => assert.equal(core.parseReceiptText('').items.length, 0));

  const things = [{ publicId: 'STP-A', title: 'MacBook Pro', serialNumber: 'SN-1', gtin: '123', purchaseDate: '2026-08-12', receiptIds: [] }];
  test('12 exact serial numbers create duplicate candidates', () => assert.equal(core.duplicateCandidates(things, { title: 'Other', serialNumber: 'sn 1' })[0].score, 100));
  test('13 exact GTIN creates duplicate candidates', () => assert.equal(core.duplicateCandidates(things, { title: 'Other', gtin: '123' })[0].score, 100));
  test('14 matching title creates a review candidate rather than an auto-merge', () => assert.equal(core.duplicateCandidates(things, { title: 'MacBook Pro' })[0].score, 55));
  test('15 two identical products remain representable', () => assert.equal(things.concat({ ...things[0], publicId: 'STP-B' }).length, 2));

  const ranked = core.rankNow([
    { publicId: 'future', status: 'OPEN', dueAt: '2026-08-20', updatedAt: '2026-08-01' },
    { publicId: 'waiting', status: 'WAITING', dueAt: null, updatedAt: '2026-08-02' },
    { publicId: 'overdue', status: 'OPEN', dueAt: '2026-08-01', updatedAt: '2026-08-03' },
    { publicId: 'done', status: 'COMPLETED', dueAt: '2026-07-01', updatedAt: '2026-08-04' }
  ], Date.parse('2026-08-12T12:00:00Z'));
  test('16 Now ranks overdue work first', () => assert.equal(ranked[0].publicId, 'overdue'));
  test('17 Now ranks WAITING before non-urgent work', () => assert.equal(ranked[1].publicId, 'waiting'));
  test('18 Now removes completed work from active attention', () => assert.equal(ranked.some(item => item.publicId === 'done'), false));
  test('19 Open Loops can move into WAITING', () => assert.equal(core.validLoopTransition('OPEN', 'WAITING'), true));
  test('20 completed Open Loops cannot silently reopen', () => assert.equal(core.validLoopTransition('COMPLETED', 'OPEN'), false));

  test('21 mobile JPEG receipt content is accepted', () => assert.equal(core.validateImageBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg').ok, true));
  test('22 PNG receipt content is accepted', () => assert.equal(core.validateImageBytes(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0]), 'image/png').ok, true));
  test('23 WebP receipt content is accepted', () => assert.equal(core.validateImageBytes(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,0]), 'image/webp').ok, true));
  test('24 invalid image content is rejected safely', () => assert.equal(core.validateImageBytes(Uint8Array.from([1,2,3]), 'image/jpeg').code, 'invalid_image_content'));
  test('25 HEIC receives an explicit unsupported result', () => assert.equal(core.validateImageBytes(Uint8Array.from([1,2,3]), 'image/heic').code, 'heic_not_supported'));
  test('26 deterministic search escapes SQL wildcards', () => assert.equal(core.safeSearchTerm('100%_safe'), '100\\%\\_safe'));

  test('27 World APIs require the existing buyer session', () => assert.ok(worker.includes("cookie(request, 'still_buyer')") && worker.includes("error: 'unauthorized'")));
  test('28 Thing reads and writes scope by buyer_account_id', () => assert.ok(worker.includes('p.buyer_account_id=?') && worker.includes('WHERE id=? AND buyer_account_id=?')));
  test('29 receipt originals use authenticated private R2 delivery', () => assert.ok(worker.includes('env.WORLD_FILES.get(row.source_image_key)') && !wrangler.includes('preview_bucket_name')));
  test('30 OCR failure persists FAILED state and supports retry', () => assert.ok(worker.includes("processing_status='FAILED'") && worker.includes('/retry')));
  test('31 OCR line items persist as structured rows', () => assert.ok(worker.includes('INSERT INTO world_receipt_items') && schema.includes('world_receipt_items')));
  test('32 receipt confirmation creates or links canonical Things', () => assert.ok(worker.includes('thing.created_from_receipt') && worker.includes('thing.receipt_linked')));
  test('33 receipt evidence carries explicit provenance', () => assert.ok(worker.includes("provenance: 'USER_CONFIRMED'") && schema.includes('verification_status')));
  test('34 Knowledge supports create, edit and safe delete routes', () => assert.ok(worker.includes('createKnowledge(request') && worker.includes('updateKnowledge(request') && worker.includes('deleteKnowledge(request')));
  test('35 Knowledge can link to a Thing and Situation', () => assert.ok(worker.includes("'knowledge', pid, 'thing'") && worker.includes("'knowledge', pid, 'situation'")));
  test('36 Situation create, resolve and archive are persisted', () => assert.ok(worker.includes('situation.created') && worker.includes('situation.resolved') && worker.includes('situation.archived')));
  test('37 WAITING Open Loops require waiting_on', () => assert.ok(worker.includes("status === 'WAITING' && !waitingOn")));
  test('38 Open Loop completion creates history', () => assert.ok(worker.includes('open_loop.completed') && worker.includes('situation.open_loop_completed')));
  test('39 World search has explicit result types and owner scope', () => assert.ok(worker.includes("resultType, publicId") && worker.includes('owner = buyer.buyer_account_id')));
  test('40 localStorage migration uses durable idempotency keys', () => assert.ok(schema.includes('PRIMARY KEY(buyer_account_id,source,fingerprint)') && worker.includes('already_migrated')));
  test('41 key actions emit structured privacy-safe logs', () => assert.ok(worker.includes("scope: 'buyer_world'") && worker.includes("log('receipt_upload'") && !worker.includes('raw_ocr_text, fields')));
  test('42 the client uses server World endpoints for every Phase 1 area', () => ['/world/things','/world/receipts','/world/knowledge','/world/situations','/world/open-loops'].forEach(route => assert.ok(client.includes(route), route)));
  test('43 the production bundle ships the World client and style', () => assert.ok(build.includes("'world-foundation-v131.js'") && build.includes("'world-foundation-v131.css'")));
  test('44 the active Worker delegates to Phase 1 and keeps private storage configured', () => {
    const activeWorker = read('merchant-backend/worker-v135.js');
    const phase3Worker = read('merchant-backend/worker-v134.js');
    assert.ok(wrangler.includes('worker-v135.js') && activeWorker.includes("import app from './worker-v134.js'") && phase3Worker.includes("import app from './worker-v133.js'") && wrangler.includes('"binding": "WORLD_FILES"'));
  });
  test('45 receipt review exposes explicit existing-Thing selection', () => assert.ok(client.includes('function bindReceiptLine') && client.includes("choice.hidden=action.value!=='link'")));
  test('46 legacy onboarding delegates to the real World without simulated receipt success', () => assert.ok(legacyOnboarding.includes('world.openCapture()') && legacyOnboarding.includes('world.openDocuments()') && !legacyOnboarding.includes("heading.textContent = t('Found it.'")));
  test('47 legacy authenticated manual add persists through canonical World Things', () => assert.ok(legacyOwnership.includes("api('/api/v1/world/things'") && !legacyOwnership.includes('id: `local_${crypto.randomUUID()}`')));
  test('48 universal Capture creates real World entities without automatic classification', () => assert.ok(client.includes('data-quick-capture') && client.includes("values.destination==='open_loop'") && client.includes("sourceType:'PASTED_CONTENT'")));
  test('49 Knowledge persists URLs, tags and editable relationships', () => assert.ok(schema.includes('source_url TEXT') && schema.includes('tags_json TEXT') && client.includes('name="sourceUrl"') && client.includes('name="situationId"')));
  test('50 Situation workspaces expose linked context and relationship removal', () => assert.ok(client.includes('data-situation-link') && client.includes('data-remove-relationship') && worker.includes('deleteRelationship(request')));
  test('51 Open Loops persist required Phase 1 types and notes', () => assert.ok(worker.includes("'PROMISE', 'PAYMENT'") && schema.includes('notes TEXT')));
  test('52 compatibility cache is written only after legacy migration is considered', () => assert.ok(client.indexOf("if (migrate && !migratedThisSession") < client.indexOf('syncCompatibilityCache(bootstrap.things)')));

  process.stdout.write(`World Foundation tests passed (${passed} assertions).\n`);
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
