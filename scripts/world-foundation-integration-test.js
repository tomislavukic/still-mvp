const assert = require('node:assert/strict');

const origin = process.argv[2] || 'http://localhost:8791';
const firstCookie = 'still_buyer=world-test-session';
const secondCookie = 'still_buyer=world-test-session-two';
const thirdCookie = 'still_buyer=world-test-session-three';
let passed = 0;

async function request(path, { cookie = firstCookie, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    body,
    signal: AbortSignal.timeout(15000),
    headers: { ...(cookie ? { cookie } : {}), ...(!['GET', 'HEAD'].includes(method) ? { origin } : {}), ...headers }
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, headers: response.headers };
}

async function htmlRequest(path, { cookie = firstCookie } = {}) {
  const response = await fetch(`${origin}${path}`, { headers: cookie ? { cookie } : {}, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  return { status: response.status, text: await response.text(), headers: response.headers };
}

async function check(name, assertion) {
  await assertion();
  passed += 1;
  process.stdout.write(`✓ ${name}\n`);
}

const integrationRun = (async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  let thingId, secondThingId, knowledgeId, situationId, loopId, receiptId, relationshipId, receiptThingId, sightDocumentId, sightKnowledgeId, needId, needLoopId, quoteId, outcomeId, lowNeedId;
  let marketThingId, sellNeedId, listingId, wantedId, offerId, dealId, transferId, cancellationThingId, cancellationListingId, cancellationOfferId, cancellationDealId, cancellationTransferId;

  await check('unauthenticated World bootstrap is denied', async () => {
    assert.equal((await request('/api/v1/world/bootstrap', { cookie: '' })).status, 401);
  });
  await check('signed-out Still OS deep links redirect to the real buyer sign-in', async () => {
    const result = await htmlRequest('/app/thing/not-owned', { cookie: '' });
    assert.equal(result.status, 302);
    const destination = new URL(result.headers.get('location'));
    assert.equal(destination.pathname, '/');
    assert.equal(destination.searchParams.get('signin'), '1');
    assert.equal(destination.searchParams.get('returnTo'), '/app/thing/not-owned');
  });
  await check('authenticated Still OS deep links serve the production shell', async () => {
    const result = await htmlRequest('/app/world');
    assert.equal(result.status, 200);
    assert.match(result.text, /id="stillOSV133"/);
  });
  await check('an owner with no active context receives the honest quiet state', async () => {
    const result = await request('/api/v1/world/now', { cookie: secondCookie });
    assert.equal(result.status, 200);
    assert.equal(result.data.quietState, true);
    assert.equal(result.data.dominantContext, null);
  });
  await check('authenticated buyer creates a durable Thing', async () => {
    const result = await request('/api/v1/world/things', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Integration Bicycle ${suffix}`, kind: 'product', serialNumber: `SER-${suffix}`, purchaseDate: '2026-08-12' }) });
    assert.equal(result.status, 201);
    thingId = result.data.thing.publicId;
  });
  await check('Thing persists through a new HTTP read', async () => {
    const result = await request(`/api/v1/world/things/${thingId}`);
    assert.equal(result.status, 200);
    assert.equal(result.data.thing.serialNumber, `SER-${suffix}`);
  });
  await check('Still OS Thing context aggregates the real Passport and history', async () => {
    const result = await request(`/api/v1/world/context/thing/${thingId}`);
    assert.equal(result.status, 200);
    assert.equal(result.data.entity.publicId, thingId);
    assert.ok(result.data.passport);
    assert.ok(result.data.history.some(event => event.eventType === 'thing.created'));
  });
  await check('another buyer cannot open the Still OS Thing context', async () => {
    assert.equal((await request(`/api/v1/world/context/thing/${thingId}`, { cookie: secondCookie })).status, 404);
  });
  await check('another buyer cannot read the Thing', async () => {
    assert.equal((await request(`/api/v1/world/things/${thingId}`, { cookie: secondCookie })).status, 404);
  });
  await check('duplicate protection returns a review conflict', async () => {
    const result = await request('/api/v1/world/things', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Integration Bicycle ${suffix}`, kind: 'product', serialNumber: `SER-${suffix}` }) });
    assert.equal(result.status, 409);
    assert.equal(result.data.error, 'duplicate_review_required');
  });
  await check('buyer can explicitly keep an identical product separate', async () => {
    const result = await request('/api/v1/world/things', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Integration Bicycle ${suffix}`, kind: 'product', serialNumber: `SER-${suffix}`, allowDuplicate: true }) });
    assert.equal(result.status, 201);
    secondThingId = result.data.thing.publicId;
    assert.notEqual(secondThingId, thingId);
  });
  await check('Product Passport exposes field provenance and history', async () => {
    const result = await request(`/api/v1/world/things/${thingId}`);
    assert.equal(result.data.passport.provenance.serialNumber.source, 'USER_CONFIRMED');
    assert.ok(result.data.history.some(event => event.event_type === 'thing.created'));
  });
  await check('reviewed OCR line items persist before confirmation', async () => {
    const result = await request('/api/v1/world/receipts/RCP-WORLD-FIXTURE/review', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ merchant: 'Fixture Store Reviewed', purchaseDate: '2026-08-12', totalCents: 30000, currency: 'EUR', items: [{ publicId: 'RLI-WORLD-CREATE', title: 'Fixture Camera', totalCents: 20000, disposition: 'CREATE_THING' }, { publicId: 'RLI-WORLD-LINK', title: 'Fixture Existing Thing', totalCents: 10000, disposition: 'LINK_THING' }] }) });
    assert.equal(result.status, 200);
    assert.equal(result.data.receipt.items.length, 2);
    assert.equal(result.data.receipt.merchant, 'Fixture Store Reviewed');
  });
  await check('receipt confirmation creates one Thing and links another', async () => {
    const result = await request('/api/v1/world/receipts/RCP-WORLD-FIXTURE/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ publicId: 'RLI-WORLD-CREATE', action: 'create', title: 'Fixture Camera' }, { publicId: 'RLI-WORLD-LINK', action: 'link', thingPublicId: 'STP-WORLD-FIXTURE' }] }) });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.results.map(item => item.action).sort(), ['created', 'linked']);
    receiptThingId = result.data.results.find(item => item.action === 'created').thingPublicId;
  });
  await check('receipt-created Passport contains durable evidence and history', async () => {
    const result = await request(`/api/v1/world/things/${receiptThingId}`);
    assert.equal(result.status, 200);
    assert.ok(result.data.evidence.some(item => item.sourceId === 'RCP-WORLD-FIXTURE'));
    assert.ok(result.data.history.some(item => item.event_type === 'thing.created_from_receipt'));
  });
  await check('Knowledge can be created and linked to the Thing', async () => {
    const result = await request('/api/v1/world/knowledge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Bicycle manual note ${suffix}`, body: 'Torque specification kept for service.', sourceUrl: 'https://example.invalid/manual', tags: 'bike, service', thingId }) });
    assert.equal(result.status, 201);
    knowledgeId = result.data.knowledge.publicId;
    assert.equal(result.data.knowledge.thingId, thingId);
    assert.deepEqual(result.data.knowledge.tags, ['bike', 'service']);
  });
  await check('Knowledge edits persist', async () => {
    const result = await request(`/api/v1/world/knowledge/${knowledgeId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Updated bicycle note ${suffix}`, body: 'Updated service knowledge.' }) });
    assert.equal(result.status, 200);
    assert.equal(result.data.knowledge.title, `Updated bicycle note ${suffix}`);
  });
  await check('Knowledge opens through an owner-scoped Still OS workspace', async () => {
    const result = await request(`/api/v1/world/context/knowledge/${knowledgeId}`);
    assert.equal(result.status, 200);
    assert.equal(result.data.entity.publicId, knowledgeId);
  });
  await check('Situation can be created with a Thing relationship', async () => {
    const result = await request('/api/v1/world/situations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Bicycle service ${suffix}`, description: 'Prepare for scheduled service.', thingId, startDate: '2026-08-12', dueAt: '2026-08-20' }) });
    assert.equal(result.status, 201);
    situationId = result.data.situation.publicId;
    assert.equal(result.data.situation.startDate, '2026-08-12');
  });
  await check('Knowledge can add and remove its Situation relationship', async () => {
    const linked = await request(`/api/v1/world/knowledge/${knowledgeId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ situationId }) });
    assert.equal(linked.status, 200);
    assert.equal(linked.data.knowledge.situationId, situationId);
    const removed = await request(`/api/v1/world/knowledge/${knowledgeId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ situationId: '' }) });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.knowledge.situationId, null);
  });
  await check('Situation workspace relationships can be added and removed', async () => {
    const linked = await request('/api/v1/world/relationships', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fromType: 'situation', fromId: situationId, toType: 'knowledge', toId: knowledgeId, relationship: 'context' }) });
    assert.equal(linked.status, 201);
    relationshipId = linked.data.relationship.publicId;
    assert.ok(relationshipId);
    const removed = await request(`/api/v1/world/relationships/${relationshipId}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmRelationshipId: relationshipId }) });
    assert.equal(removed.status, 200);
  });
  await check('WAITING Open Loop requires waiting_on', async () => {
    const result = await request('/api/v1/world/open-loops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Wait for workshop', status: 'WAITING', situationId }) });
    assert.equal(result.status, 422);
    assert.equal(result.data.error, 'waiting_on_required');
  });
  await check('WAITING Open Loop persists with responsible context', async () => {
    const result = await request('/api/v1/world/open-loops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Workshop reply ${suffix}`, type: 'WAITING', status: 'WAITING', waitingOn: 'Authorized workshop', dueAt: '2026-08-01', notes: 'Expected service quote.', situationId, thingId }) });
    assert.equal(result.status, 201);
    loopId = result.data.openLoop.publicId;
    assert.equal(result.data.openLoop.waitingOn, 'Authorized workshop');
    assert.equal(result.data.openLoop.type, 'WAITING');
    assert.equal(result.data.openLoop.notes, 'Expected service quote.');
  });
  await check('Now exposes one deterministic dominant context and full attention count', async () => {
    const result = await request('/api/v1/world/now');
    assert.equal(result.status, 200);
    assert.equal(result.data.method, 'deterministic_priority');
    assert.ok(result.data.attentionCount >= 1);
    assert.ok(result.data.dominantContext);
    assert.equal(result.data.quietState, false);
  });
  await check('Situation context includes its real open loop and linked Thing', async () => {
    const result = await request(`/api/v1/world/context/situation/${situationId}`);
    assert.equal(result.status, 200);
    assert.ok(result.data.openLoops.some(loop => loop.publicId === loopId));
    assert.ok(result.data.things.some(thing => thing.publicId === thingId));
  });
  await check('universal input classifies without persisting or pretending certainty', async () => {
    const result = await request('/api/v1/world/input/route', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'A thought with no explicit destination' }) });
    assert.equal(result.status, 200);
    assert.equal(result.data.persisted, false);
    assert.equal(result.data.needsConfirmation, true);
    assert.equal(result.data.route, null);
  });
  await check('explicit Need language routes to review without persisting', async () => {
    const routed = await request('/api/v1/world/input/route', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'I need to repair my camera' }) });
    assert.equal(routed.data.route, 'need');
    assert.equal(routed.data.persisted, false);
    assert.equal(routed.data.needsConfirmation, true);
    assert.equal(routed.data.proposedNeed.needType, 'REPAIR');
  });
  await check('confirmed universal input creates durable Knowledge through the canonical API', async () => {
    const routed = await request('/api/v1/world/input/route', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'Save this article about bicycle care' }) });
    assert.equal(routed.data.route, 'knowledge');
    assert.equal(routed.data.needsConfirmation, true);
    const created = await request('/api/v1/world/knowledge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Bicycle care ${suffix}`, body: 'Confirmed from universal input.' }) });
    assert.equal(created.status, 201);
    const removed = await request(`/api/v1/world/knowledge/${created.data.knowledge.publicId}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmKnowledgeId: created.data.knowledge.publicId }) });
    assert.equal(removed.status, 200);
  });
  await check('explicit universal-input destination is respected but still not persisted', async () => {
    const result = await request('/api/v1/world/input/route', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'My new bicycle', requestedType: 'thing' }) });
    assert.equal(result.status, 200);
    assert.equal(result.data.route, 'thing');
    assert.equal(result.data.method, 'explicit_user_choice');
    assert.equal(result.data.persisted, false);
  });
  await check('buyer creates a persisted Need linked to a Thing, Situation and Knowledge', async () => {
    const result = await request('/api/v1/world/needs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Repair Integration Bicycle ${suffix}`, description: 'Rear wheel needs a real workshop assessment.', needType: 'REPAIR', urgency: 'URGENT', sourceType: 'USER_CREATED', confidence: 'CONFIRMED', thingId, situationId, knowledgeId }) });
    assert.equal(result.status, 201);
    needId = result.data.need.publicId;
    assert.equal(result.data.need.thingId, thingId);
    assert.equal(result.data.need.situationId, situationId);
  });
  await check('Need persists and both linked context workspaces expose it', async () => {
    const direct = await request(`/api/v1/world/needs/${needId}`);
    const thing = await request(`/api/v1/world/context/thing/${thingId}`);
    const situation = await request(`/api/v1/world/context/situation/${situationId}`);
    assert.equal(direct.status, 200);
    assert.ok(thing.data.needs.some(item => item.publicId === needId));
    assert.ok(situation.data.needs.some(item => item.publicId === needId));
  });
  await check('Need and its Resolution Context are private to the authenticated owner', async () => {
    assert.equal((await request(`/api/v1/world/needs/${needId}`, { cookie: secondCookie })).status, 404);
    assert.equal((await request(`/api/v1/world/needs/${needId}/context`, { cookie: secondCookie })).status, 404);
  });
  await check('urgent explicit Need becomes the dominant Need in Now', async () => {
    const result = await request('/api/v1/world/now');
    assert.equal(result.status, 200);
    assert.equal(result.data.dominantNeed.publicId, needId);
    assert.ok(result.data.activeNeedCount >= 1);
    assert.equal(result.data.quietState, false);
  });
  await check('Resolution Context offers linked Knowledge but never an invented provider', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/context`);
    assert.equal(result.status, 200);
    assert.ok(result.data.options.some(option => option.type === 'LEARN' && option.actionType === 'OPEN_KNOWLEDGE'));
    assert.equal(result.data.options.some(option => /recommended provider|best provider/i.test(`${option.title} ${option.description}`)), false);
    assert.ok(result.data.missing.some(value => /quote/i.test(value)));
  });
  await check('low-confidence Need remains inactive until explicit confirmation', async () => {
    const created = await request('/api/v1/world/needs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Maybe replace bell ${suffix}`, needType: 'REPLACE', confidence: 'LOW', thingId }) });
    assert.equal(created.status, 201);
    lowNeedId = created.data.need.publicId;
    assert.equal(created.data.need.status, 'NEEDS_CONFIRMATION');
    const confirmed = await request(`/api/v1/world/needs/${created.data.need.publicId}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.need.status, 'ACTIVE');
    const waiting = await request(`/api/v1/world/needs/${created.data.need.publicId}/wait`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ waitingOn: 'A real replacement estimate', waitingUntil: '2026-08-20' }) });
    assert.equal(waiting.data.need.status, 'WAITING');
    assert.equal(waiting.data.need.waitingOn, 'A real replacement estimate');
    const resumed = await request(`/api/v1/world/needs/${created.data.need.publicId}/resume`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(resumed.data.need.status, 'ACTIVE');
    await request(`/api/v1/world/needs/${created.data.need.publicId}/dismiss`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const current = await request('/api/v1/world/now');
    assert.equal((current.data.recentNeeds || []).some(item => item.publicId === lowNeedId), false);
  });
  await check('duplicate Need creation requires explicit review', async () => {
    const result = await request('/api/v1/world/needs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Repair Integration Bicycle ${suffix}`, needType: 'REPAIR', thingId, situationId }) });
    assert.equal(result.status, 409);
    assert.equal(result.data.error, 'duplicate_need_review_required');
    assert.ok(result.data.matches.some(item => item.publicId === needId));
  });
  await check('World-first resolution produces KEEP only from a deterministic real Thing match', async () => {
    const created = await request('/api/v1/world/needs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Find Integration Bicycle ${suffix}`, needType: 'FIND', confidence: 'CONFIRMED' }) });
    assert.equal(created.status, 201);
    const context = await request(`/api/v1/world/needs/${created.data.need.publicId}/context`);
    assert.ok(context.data.options.some(option => option.type === 'KEEP' && option.actionPayload.thingId === thingId));
    await request(`/api/v1/world/needs/${created.data.need.publicId}/dismiss`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  });
  await check('a Need with insufficient data receives only honest internal next steps', async () => {
    const created = await request('/api/v1/world/needs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Unspecified outcome ${suffix}`, needType: 'OTHER', confidence: 'CONFIRMED' }) });
    const context = await request(`/api/v1/world/needs/${created.data.need.publicId}/context`);
    assert.ok(context.data.options.length >= 1);
    assert.ok(context.data.options.every(option => option.source !== 'EXTERNAL'));
    assert.ok(context.data.options.every(option => !option.actionPayload?.providerId));
    await request(`/api/v1/world/needs/${created.data.need.publicId}/dismiss`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  });
  await check('real repair quotes persist and compare factually', async () => {
    const first = await request(`/api/v1/world/needs/${needId}/quotes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerName: 'Workshop One', amountCents: 12500, currency: 'EUR', description: 'Wheel repair' }) });
    assert.equal(first.status, 201); quoteId = first.data.quotes[0].publicId;
    const second = await request(`/api/v1/world/needs/${needId}/quotes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerName: 'Workshop Two', amountCents: 17900, currency: 'EUR', description: 'Wheel repair and service' }) });
    assert.equal(second.status, 201);
    const context = await request(`/api/v1/world/needs/${needId}/context`);
    assert.equal(context.data.quotes.length, 2);
    assert.equal(context.data.quoteComparison.lowestCents, 12500);
    assert.equal(context.data.quoteComparison.highestCents, 17900);
  });
  await check('another buyer cannot access or select an owner quote', async () => {
    assert.equal((await request(`/api/v1/world/needs/${needId}/quotes/${quoteId}/select`, { cookie: secondCookie, method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 404);
  });
  await check('Handle It creates a canonical Open Loop without resolving the Need', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/select`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ optionType: 'DO_IT', actionType: 'CREATE_OPEN_LOOP', title: `Call workshop ${suffix}` }) });
    assert.equal(result.status, 200); needLoopId = result.data.openLoop.publicId;
    assert.equal(result.data.need.status, 'HANDLING');
    const completed = await request(`/api/v1/world/open-loops/${needLoopId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'COMPLETED' }) });
    assert.equal(completed.status, 200);
    assert.equal((await request(`/api/v1/world/needs/${needId}`)).data.need.status, 'HANDLING');
  });
  await check('user-selected quote begins handling but does not simulate resolution', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/quotes/${quoteId}/select`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(result.status, 200);
    assert.equal(result.data.need.status, 'HANDLING');
  });
  await check('user-confirmed resolution creates a durable outcome and Thing service history', async () => {
    const resolved = await request(`/api/v1/world/needs/${needId}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resolutionType: 'REPAIR', summary: 'Workshop repaired and tested the rear wheel.', selectedQuoteId: quoteId, providerName: 'Workshop One' }) });
    assert.equal(resolved.status, 200); outcomeId = resolved.data.outcome.publicId;
    assert.equal(resolved.data.need.status, 'RESOLVED');
    const context = await request(`/api/v1/world/needs/${needId}/context`);
    assert.ok(context.data.history.some(event => event.eventType === 'need.resolved'));
    assert.ok(context.data.outcomes.some(outcome => outcome.publicId === outcomeId));
    const thing = await request(`/api/v1/world/context/thing/${thingId}`);
    assert.ok(thing.data.history.some(event => event.eventType === 'thing.service_recorded'));
    const situation = await request(`/api/v1/world/context/situation/${situationId}`);
    assert.equal(situation.data.entity.status, 'ACTIVE');
  });
  await check('resolution feedback persists without rewriting the outcome', async () => {
    const feedback = await request(`/api/v1/world/resolution-outcomes/${outcomeId}/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ feedback: 'YES' }) });
    assert.equal(feedback.status, 200);
    const context = await request(`/api/v1/world/needs/${needId}/context`);
    assert.equal(context.data.outcomes.find(outcome => outcome.publicId === outcomeId).feedback, 'YES');
  });
  await check('resolved Need leaves active Now but remains in History and World management', async () => {
    const now = await request('/api/v1/world/now');
    assert.equal((now.data.urgentNeeds || []).some(item => item.publicId === needId), false);
    const history = await request('/api/v1/world/needs?status=RESOLVED');
    assert.ok(history.data.needs.some(item => item.publicId === needId));
  });
  await check('completing an Open Loop creates durable state', async () => {
    const result = await request(`/api/v1/world/open-loops/${loopId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'COMPLETED' }) });
    assert.equal(result.status, 200);
    assert.equal(result.data.openLoop.status, 'COMPLETED');
  });
  await check('Situation resolves and records history', async () => {
    const result = await request(`/api/v1/world/situations/${situationId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'RESOLVED' }) });
    assert.equal(result.status, 200);
    assert.ok(result.data.history.some(event => event.event_type === 'situation.resolved'));
  });
  await check('World search finds owner data', async () => {
    const result = await request(`/api/v1/world/search?q=${encodeURIComponent(suffix)}`);
    assert.equal(result.status, 200);
    assert.ok(result.data.results.some(item => item.publicId === thingId && item.resultType === 'Thing'));
  });
  await check('universal World search returns mixed real result types', async () => {
    const result = await request(`/api/v1/world/search?q=${encodeURIComponent(suffix)}`);
    const types = new Set(result.data.results.map(item => item.resultType));
    assert.ok(types.has('Thing'));
    assert.ok(types.has('Knowledge'));
    assert.ok(types.has('Situation'));
  });
  await check('World search does not leak data to another buyer', async () => {
    const result = await request(`/api/v1/world/search?q=${encodeURIComponent(suffix)}`, { cookie: secondCookie });
    assert.equal(result.status, 200);
    assert.equal(result.data.results.length, 0);
  });
  await check('localStorage migration is idempotent', async () => {
    const payload = { source: 'still-ownership-passports-v83', records: [{ id: `legacy-${suffix}`, title: `Legacy Camera ${suffix}`, kind: 'product' }] };
    const first = await request('/api/v1/world/migrations/local-storage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const second = await request('/api/v1/world/migrations/local-storage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(first.data.imported, 1);
    assert.equal(second.data.imported, 0);
    assert.equal(second.data.results[0].status, 'already_migrated');
  });
  await check('invalid receipt content is rejected before storage', async () => {
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/jpeg' }), 'invalid.jpg');
    const result = await request('/api/v1/world/receipts/capture', { method: 'POST', body: form });
    assert.equal(result.status, 422);
    assert.equal(result.data.error, 'invalid_image_content');
  });
  await check('supported mobile receipt upload reaches a durable OCR state', async () => {
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from([0xff, 0xd8, 0xff]), new TextEncoder().encode(suffix), Uint8Array.from([0xff, 0xd9])], { type: 'image/jpeg' }), `receipt-${suffix}.jpg`);
    const result = await request('/api/v1/world/receipts/capture', { method: 'POST', body: form });
    assert.equal(result.status, 422);
    assert.equal(result.data.receipt.processingStatus, 'FAILED');
    receiptId = result.data.receipt.publicId;
  });
  await check('Sight image uses real document ingestion and can become Knowledge without invented OCR text', async () => {
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from([0xff, 0xd8, 0xff]), new TextEncoder().encode(`Sight ${suffix}`), Uint8Array.from([0xff, 0xd9])], { type: 'image/jpeg' }), `sight-${suffix}.jpg`);
    form.append('title', `Sight note ${suffix}`);
    form.append('documentType', 'image');
    form.append('consent', 'true');
    const uploaded = await request('/api/v1/world/documents', { method: 'POST', body: form });
    assert.ok([201, 422].includes(uploaded.status));
    sightDocumentId = uploaded.data.document.publicId;
    const knowledgeInput = { title: `Sight knowledge ${suffix}`, sourceDocumentId: sightDocumentId };
    if (uploaded.status === 422) {
      const withoutText = await request('/api/v1/world/knowledge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(knowledgeInput) });
      assert.equal(withoutText.status, 422);
      assert.equal(withoutText.data.error, 'invalid_knowledge');
      knowledgeInput.body = `Buyer supplied context for Sight ${suffix}`;
    }
    const saved = await request('/api/v1/world/knowledge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(knowledgeInput) });
    assert.equal(saved.status, 201);
    sightKnowledgeId = saved.data.knowledge.publicId;
  });
  await check('Sight image can attach to an existing Thing without parallel storage', async () => {
    const linked = await request('/api/v1/world/relationships', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fromType: 'document', fromId: sightDocumentId, toType: 'thing', toId: thingId, relationship: 'supports' }) });
    assert.equal(linked.status, 201);
    const context = await request(`/api/v1/world/context/thing/${thingId}`);
    assert.ok(context.data.documents.some(document => document.publicId === sightDocumentId));
  });
  await check('receipt original is private to its owner', async () => {
    assert.equal((await request(`/api/v1/world/receipts/${receiptId}/original`)).status, 200);
    assert.equal((await request(`/api/v1/world/receipts/${receiptId}/original`, { cookie: secondCookie })).status, 404);
  });
  await check('Now hides completed loops and resolved situations', async () => {
    const result = await request('/api/v1/world/now');
    assert.equal(result.status, 200);
    assert.equal(result.data.attentionItems.some(item => item.id === loopId || item.id === situationId), false);
  });
  await check('Knowledge deletion removes active search visibility', async () => {
    const deleted = await request(`/api/v1/world/knowledge/${knowledgeId}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmKnowledgeId: knowledgeId }) });
    assert.equal(deleted.status, 200);
    const search = await request(`/api/v1/world/search?q=${encodeURIComponent(`Updated bicycle note ${suffix}`)}`);
    assert.equal(search.data.results.some(item => item.publicId === knowledgeId), false);
  });
  await check('Sight-created Knowledge can be removed through the canonical lifecycle', async () => {
    const deleted = await request(`/api/v1/world/knowledge/${sightKnowledgeId}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmKnowledgeId: sightKnowledgeId }) });
    assert.equal(deleted.status, 200);
  });

  await check('Market 00 legacy owned Passport is backfilled and can enter Market', async () => {
    const listing = await request('/api/v1/market/listings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ thingId: 'STP-WORLD-LEGACY', category: 'tools', askingPriceCents: 2500, currency: 'EUR', conditionGrade: 'GOOD', pickupAvailable: true }) });
    assert.equal(listing.status, 201);
    const thing = await request('/api/v1/world/things/STP-WORLD-LEGACY');
    assert.equal(thing.status, 200);
    assert.equal(thing.data.thing.lifecycleState, 'OWNED');
    assert.equal((await request(`/api/v1/market/listings/${listing.data.listing.publicId}/withdraw`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 200);
  });
  await check('Market 01 user prepares a canonical owned Thing for listing', async () => {
    const updated = await request(`/api/v1/world/things/${receiptThingId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Fixture Camera ${suffix}`, kind: 'product', category: 'photography', manufacturer: 'Fixture Optics', model: `FC-${suffix}`, notes: 'Seller-only calibration and home location.' }) });
    assert.equal(updated.status, 200);
    marketThingId = updated.data.thing.publicId;
    assert.equal(marketThingId, receiptThingId);
  });
  await check('Market 02 seller creates a real SELL Need linked to the Thing', async () => {
    const result = await request('/api/v1/world/needs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Sell Fixture Camera ${suffix}`, needType: 'SELL', confidence: 'CONFIRMED', thingId: marketThingId }) });
    assert.equal(result.status, 201);
    sellNeedId = result.data.need.publicId;
  });
  await check('Market 03 Wanted Object persists before any matching listing exists', async () => {
    const result = await request('/api/v1/market/wanted', { cookie: secondCookie, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Fixture Camera ${suffix}`, category: 'photography', manufacturer: 'Fixture Optics', model: `FC-${suffix}`, maxPriceCents: 85000, currency: 'EUR', minCondition: 'GOOD', requirements: ['camera'], shippingAllowed: true }) });
    assert.equal(result.status, 201);
    wantedId = result.data.wanted.publicId;
    assert.ok(wantedId);
  });
  await check('Market 04 reverse matching is private and disabled by default', async () => {
    const result = await request(`/api/v1/market/things/${marketThingId}/preference`);
    assert.equal(result.status, 200);
    assert.equal(result.data.reverseMatches.enabled, false);
    assert.equal(result.data.reverseMatches.count, 0);
  });
  await check('Market 05 owner can enable private reverse matching without publishing the Thing', async () => {
    const result = await request(`/api/v1/market/things/${marketThingId}/preference`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ privateMatchingEnabled: true, considerPriceCents: 70000, currency: 'EUR' }) });
    assert.equal(result.status, 200);
    assert.equal(result.data.reverseMatches.enabled, true);
    assert.equal(result.data.reverseMatches.thingPublished, false);
    assert.equal(result.data.reverseMatches.buyerIdentitiesExposed, false);
  });
  await check('Market 06 owner creates a persisted draft over the canonical Thing', async () => {
    const result = await request('/api/v1/market/listings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ thingId: marketThingId, needId: sellNeedId, category: 'photography', askingPriceCents: 70000, currency: 'EUR', description: 'Owner-confirmed used camera.', conditionGrade: 'GOOD', knownDefects: 'None known', includedAccessories: ['camera strap'], coarseLocation: 'Zagreb', pickupAvailable: true, shippingAvailable: true, sellerNotes: 'Never share this private seller note.' }) });
    assert.equal(result.status, 201);
    listingId = result.data.listing.publicId;
    assert.equal(result.data.listing.thing.publicId, marketThingId);
    assert.equal(result.data.listing.status, 'DRAFT');
  });
  await check('Market 07 another buyer cannot list a Thing they do not own', async () => {
    const result = await request('/api/v1/market/listings', { cookie: secondCookie, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ thingId: marketThingId, category: 'photography', askingPriceCents: 1, conditionGrade: 'GOOD' }) });
    assert.equal(result.status, 403);
    assert.equal(result.data.error, 'thing_not_owned');
  });
  await check('Market 08 duplicate open listing for one canonical Thing is prevented', async () => {
    const result = await request('/api/v1/market/listings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ thingId: marketThingId, category: 'photography', askingPriceCents: 71000, conditionGrade: 'GOOD' }) });
    assert.equal(result.status, 409);
    assert.equal(result.data.error, 'active_listing_exists');
    assert.equal(result.data.listingId, listingId);
  });
  await check('Market 09 draft persists through a fresh read but is not publicly searchable', async () => {
    const own = await request(`/api/v1/market/listings/${listingId}`);
    const search = await request(`/api/v1/market/listings?q=${encodeURIComponent(suffix)}`, { cookie: secondCookie });
    assert.equal(own.status, 200);
    assert.equal(own.data.listing.status, 'DRAFT');
    assert.equal(search.data.listings.some(item => item.publicId === listingId), false);
  });
  await check('Market 10 Product Trust reflects real receipt evidence without a magic score', async () => {
    const result = await request(`/api/v1/market/listings/${listingId}`);
    assert.equal(result.data.listing.productTrust.components.ownership.state, 'RECEIPT_SUPPORTED');
    assert.equal(result.data.listing.productTrust.score, null);
    assert.equal(result.data.listing.productTrust.components.condition.state, 'SELLER_CONFIRMED');
  });
  await check('Market 11 public Market Passport never exposes private receipt image, serial or notes', async () => {
    await request(`/api/v1/market/listings/${listingId}/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const result = await request(`/api/v1/market/listings/${listingId}`, { cookie: secondCookie });
    assert.equal(result.status, 200);
    assert.equal(result.data.listing.marketPassport.privateReceiptImageExposed, false);
    assert.equal(result.data.listing.marketPassport.serial.publicValue, null);
    assert.equal(result.data.listing.privateSellerNotes, null);
    assert.equal(JSON.stringify(result.data).includes('Never share this private seller note.'), false);
  });
  await check('Market 12 active search returns only the real published listing', async () => {
    const result = await request(`/api/v1/market/listings?q=${encodeURIComponent(`FC-${suffix}`)}&category=photography&trust=receipt_supported`, { cookie: secondCookie });
    assert.equal(result.status, 200);
    assert.ok(result.data.listings.some(item => item.publicId === listingId), JSON.stringify(result.data));
    assert.ok(result.data.listings.every(item => item.status === 'ACTIVE'));
    assert.equal(result.data.filters.trust, 'receipt_supported');
  });
  await check('Market 13 persisted Wanted receives deterministic real match reasons', async () => {
    const result = await request('/api/v1/market/wanted', { cookie: secondCookie });
    const wanted = result.data.wanted.find(item => item.publicId === wantedId);
    assert.ok(wanted.matches.some(match => match.listing.publicId === listingId));
    assert.ok(wanted.matches.flatMap(match => match.reasons).includes('Within stated budget'));
    assert.equal(wanted.matches.some(match => /random|sample|fake/i.test(JSON.stringify(match))), false);
  });
  await check('Market 14 match notification deep-links to the real listing', async () => {
    const result = await request('/api/v1/market/bootstrap', { cookie: secondCookie });
    const notification = result.data.notifications.find(item => item.notification_type === 'WANTED_MATCH');
    assert.equal(notification.href, `/app/market/listing/${listingId}`);
  });
  await check('Market 15 buyer offer persists with the entered amount', async () => {
    const result = await request('/api/v1/market/offers', { cookie: secondCookie, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listingId, amountCents: 64000, currency: 'EUR', message: 'Real integration offer.' }) });
    assert.equal(result.status, 201);
    offerId = result.data.offer.publicId;
    assert.equal(result.data.offer.amountCents, 64000);
  });
  await check('Market 16 seller counteroffer appends immutable history', async () => {
    const result = await request(`/api/v1/market/offers/${offerId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'COUNTER', amountCents: 66000, message: 'Counter based on included strap.' }) });
    assert.equal(result.status, 200);
    assert.equal(result.data.offer.status, 'COUNTERED');
    assert.deepEqual(result.data.offer.history.map(event => event.event_type), ['CREATED', 'COUNTER']);
  });
  await check('Market 17 buyer accepts counteroffer and a persisted deal is created', async () => {
    const result = await request(`/api/v1/market/offers/${offerId}`, { cookie: secondCookie, method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ACCEPT_COUNTER' }) });
    assert.equal(result.status, 200);
    assert.ok(result.data.dealId);
    dealId = result.data.dealId;
    const deal = await request(`/api/v1/market/deals/${dealId}`, { cookie: secondCookie });
    assert.equal(deal.data.deal.agreedAmountCents, 66000);
    assert.equal(deal.data.deal.payment.mode, 'EXTERNAL_MANUAL');
    assert.equal(deal.data.deal.payment.stillProtection, false);
  });
  await check('Market 18 unrelated buyer cannot see private deal data', async () => {
    assert.equal((await request(`/api/v1/market/deals/${dealId}`, { cookie: thirdCookie })).status, 404);
    assert.equal((await request(`/api/v1/market/deals/${dealId}/messages`, { cookie: thirdCookie })).status, 404);
  });
  await check('Market 19 handoff enforces external payment and seller-before-receipt ordering', async () => {
    const earlyHandoff = await request(`/api/v1/market/deals/${dealId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'HANDOFF' }) });
    const earlyReceipt = await request(`/api/v1/market/deals/${dealId}`, { cookie: secondCookie, method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'RECEIVED' }) });
    assert.equal(earlyHandoff.status, 409);
    assert.equal(earlyHandoff.data.error, 'external_payment_confirmation_required');
    assert.equal(earlyReceipt.status, 409);
    assert.equal(earlyReceipt.data.error, 'seller_handoff_required');
  });
  await check('Market 20 manual handoff requires real actions from both sides', async () => {
    assert.equal((await request(`/api/v1/market/deals/${dealId}`, { cookie: secondCookie, method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'CONFIRM_EXTERNAL_PAYMENT' }) })).status, 200);
    assert.equal((await request(`/api/v1/market/deals/${dealId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'HANDOFF' }) })).status, 200);
    const received = await request(`/api/v1/market/deals/${dealId}`, { cookie: secondCookie, method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'RECEIVED' }) });
    assert.equal(received.status, 200);
    transferId = received.data.deal.transfer.publicId;
    assert.equal(received.data.deal.transfer.status, 'PENDING');
  });
  await check('Market 21 one transfer confirmation cannot change ownership', async () => {
    const confirmed = await request(`/api/v1/market/transfers/${transferId}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.bothConfirmed, false);
    assert.equal((await request(`/api/v1/world/things/${marketThingId}`)).status, 200);
    assert.equal((await request(`/api/v1/world/things/${marketThingId}`, { cookie: secondCookie })).status, 404);
  });
  await check('Market 22 both confirmations transfer the same canonical Thing', async () => {
    const confirmed = await request(`/api/v1/market/transfers/${transferId}/confirm`, { cookie: secondCookie, method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.bothConfirmed, true);
    assert.equal((await request(`/api/v1/world/things/${marketThingId}`)).status, 404);
    const buyerThing = await request(`/api/v1/world/things/${marketThingId}`, { cookie: secondCookie });
    assert.equal(buyerThing.status, 200);
    assert.equal(buyerThing.data.thing.publicId, marketThingId);
  });
  await check('Market 23 privacy filter clears seller private note from transferred Thing', async () => {
    const buyerThing = await request(`/api/v1/world/things/${marketThingId}`, { cookie: secondCookie });
    assert.equal(buyerThing.data.thing.notes, null);
    assert.equal(JSON.stringify(buyerThing.data).includes('Seller-only calibration'), false);
  });
  await check('Market 24 completed sale resolves linked SELL Need and records outcome', async () => {
    const result = await request(`/api/v1/world/needs/${sellNeedId}/context`);
    assert.equal(result.data.need.status, 'RESOLVED');
    assert.ok(result.data.outcomes.some(item => item.resolutionType === 'SELL' && item.summary.includes(dealId)));
  });
  await check('Market 25 transfer remains visible to seller History but not owned World', async () => {
    const history = await request('/api/v1/market/transfers/history');
    assert.ok(history.data.transfers.some(item => item.public_id === transferId && item.role === 'SOLD'));
    const world = await request('/api/v1/world/bootstrap');
    assert.equal(world.data.things.some(item => item.publicId === marketThingId), false);
  });
  await check('Market 26 browser refresh semantics preserve the same deal state', async () => {
    const first = await request(`/api/v1/market/deals/${dealId}`, { cookie: secondCookie });
    const refreshed = await request(`/api/v1/market/deals/${dealId}`, { cookie: secondCookie });
    assert.equal(first.data.deal.publicId, refreshed.data.deal.publicId);
    assert.equal(refreshed.data.deal.status, 'COMPLETED');
    assert.equal(refreshed.data.deal.transfer.status, 'COMPLETED');
  });
  await check('Market 27 transfer cancellation before confirmations preserves seller ownership', async () => {
    const thing = await request('/api/v1/world/things', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Cancellation Drill ${suffix}`, kind: 'product', category: 'tools', manufacturer: 'Fixture Tools', model: `DR-${suffix}` }) });
    cancellationThingId = thing.data.thing.publicId;
    const listing = await request('/api/v1/market/listings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ thingId: cancellationThingId, category: 'tools', askingPriceCents: 4000, conditionGrade: 'GOOD', pickupAvailable: true }) });
    cancellationListingId = listing.data.listing.publicId;
    await request(`/api/v1/market/listings/${cancellationListingId}/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const offer = await request('/api/v1/market/offers', { cookie: thirdCookie, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listingId: cancellationListingId, amountCents: 4000, currency: 'EUR' }) });
    cancellationOfferId = offer.data.offer.publicId;
    const accepted = await request(`/api/v1/market/offers/${cancellationOfferId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ACCEPT' }) });
    cancellationDealId = accepted.data.dealId;
    await request(`/api/v1/market/deals/${cancellationDealId}`, { cookie: thirdCookie, method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'CONFIRM_EXTERNAL_PAYMENT' }) });
    await request(`/api/v1/market/deals/${cancellationDealId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'HANDOFF' }) });
    const received = await request(`/api/v1/market/deals/${cancellationDealId}`, { cookie: thirdCookie, method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'RECEIVED' }) });
    cancellationTransferId = received.data.deal.transfer.publicId;
    const cancelled = await request(`/api/v1/market/transfers/${cancellationTransferId}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.ownershipChanged, false);
    assert.equal((await request(`/api/v1/world/things/${cancellationThingId}`)).status, 200);
    assert.equal((await request(`/api/v1/world/things/${cancellationThingId}`, { cookie: thirdCookie })).status, 404);
  });
  await check('Market 28 withdrawn listing disappears from active search', async () => {
    const withdrawn = await request(`/api/v1/market/listings/${cancellationListingId}/withdraw`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(withdrawn.status, 200);
    const search = await request(`/api/v1/market/listings?q=${encodeURIComponent(`DR-${suffix}`)}`, { cookie: secondCookie });
    assert.equal(search.data.listings.some(item => item.publicId === cancellationListingId), false);
  });
  await check('Market 29 participant messaging persists and blocked relationship stops further messages', async () => {
    const sent = await request(`/api/v1/market/deals/${dealId}/messages`, { cookie: secondCookie, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Receipt confirmed in the real deal.' }) });
    assert.equal(sent.status, 200);
    const messages = await request(`/api/v1/market/deals/${dealId}/messages`);
    assert.ok(messages.data.messages.some(item => item.body === 'Receipt confirmed in the real deal.'));
    assert.equal((await request('/api/v1/market/blocks', { cookie: secondCookie, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listingId }) })).status, 200);
    assert.equal((await request(`/api/v1/market/deals/${dealId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Must be rejected after block.' }) })).status, 403);
  });
  await check('Market 30 authenticated shell ships a responsive ownership-native Market flow', async () => {
    const page = await htmlRequest('/app/market/listing/example');
    assert.equal(page.status, 200);
    assert.match(page.text, /still-market-v135\.js/);
    assert.match(page.text, /still-market-v135\.css/);
  });

  await check('Thing archival requires exact confirmation and preserves evidence', async () => {
    const warning = await request(`/api/v1/world/things/${secondThingId}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(warning.status, 409);
    const archived = await request(`/api/v1/world/things/${secondThingId}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmTitle: `Integration Bicycle ${suffix}` }) });
    assert.equal(archived.status, 200);
    assert.equal(archived.data.evidencePreserved, true);
  });

  process.stdout.write(`World Foundation HTTP integration tests passed (${passed} flows).\n`);
})();

module.exports = integrationRun;
if (require.main === module) integrationRun.catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
