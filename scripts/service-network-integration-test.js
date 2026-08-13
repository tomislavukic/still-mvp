const assert = require('node:assert/strict');

const origin = process.argv[2] || 'http://localhost:8791';
const clientCookie = 'still_buyer=world-test-session';
const unrelatedCookie = 'still_buyer=world-test-session-two';
const companyCookie = 'still_company=service-company-session';
let passed = 0;

async function request(path, { cookie = clientCookie, method = 'GET', body } = {}) {
  const response = await fetch(`${origin}${path}`, { method, body, signal: AbortSignal.timeout(15000), headers: { cookie, ...(!['GET','HEAD'].includes(method) ? { origin, 'content-type': 'application/json' } : {}) } });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function check(name, action) { await action(); passed += 1; process.stdout.write(`✓ Services ${String(passed).padStart(2,'0')} ${name}\n`); }

const run = (async () => {
  let providerId, capabilityId, availabilityId, thingId, needId, briefId, quoteRequestId, quoteId, bookingId, reportId, repeatId;
  const suffix = crypto.randomUUID().slice(0, 8);

  await check('service APIs require an existing authenticated identity', async () => {
    assert.equal((await request('/api/v1/services/provider', { cookie: '' })).status, 401);
  });
  await check('verified CompanyOS organization enables its real provider role', async () => {
    const result = await request('/api/v1/services/provider', { cookie: companyCookie, method: 'POST', body: JSON.stringify({ displayName: 'Service Fixture Company', description: 'Repairs household appliances in Zagreb.', coarseLocation: 'Zagreb, Croatia', acceptingRequests: true, active: true }) });
    assert.equal(result.status, 201); assert.equal(result.data.provider.type, 'BUSINESS'); assert.equal(result.data.provider.active, true); providerId = result.data.provider.publicId;
  });
  await check('business provider configuration persists', async () => {
    const result = await request('/api/v1/services/provider', { cookie: companyCookie }); assert.equal(result.status, 200); assert.equal(result.data.provider.publicId, providerId); assert.equal(result.data.provider.identityTrust, 'VERIFIED_ORGANIZATION');
  });
  await check('provider adds a structured declared repair capability', async () => {
    const result = await request('/api/v1/services/provider/capabilities', { cookie: companyCookie, method: 'POST', body: JSON.stringify({ name: 'Washing machine repair', key: `washer_repair_${suffix}`, category: 'REPAIR', serviceModes: ['AT_CUSTOMER','AT_PROVIDER'], pricingModel: 'DIAGNOSTIC_FIRST', diagnosticFirst: true, startingPriceCents: 3500, currency: 'EUR', coverageType: 'CITY', coverage: { cities: ['Zagreb'] }, brandCompatibility: ['Bosch'], description: 'Provider-declared diagnostic and repair service.' }) });
    assert.equal(result.status, 201); capabilityId = result.data.capabilities[0].publicId; assert.equal(result.data.capabilities[0].declarationStatus, 'PROVIDER_DECLARED');
  });
  await check('capability never claims platform verification', async () => {
    const result = await request('/api/v1/services/provider/capabilities', { cookie: companyCookie }); assert.equal(result.data.capabilities[0].declarationStatus, 'PROVIDER_DECLARED'); assert.equal(JSON.stringify(result.data).includes('VERIFIED_SERVICE'), false);
  });
  await check('provider publishes one real manual availability slot', async () => {
    const result = await request('/api/v1/services/provider/availability', { cookie: companyCookie, method: 'POST', body: JSON.stringify({ startsAt: '2026-09-10T09:00:00.000Z', endsAt: '2026-09-10T11:00:00.000Z' }) }); assert.equal(result.status, 201); availabilityId = result.data.slotId;
  });
  await check('overlapping fake calendar slots are rejected', async () => {
    const result = await request('/api/v1/services/provider/availability', { cookie: companyCookie, method: 'POST', body: JSON.stringify({ startsAt: '2026-09-10T10:00:00.000Z', endsAt: '2026-09-10T12:00:00.000Z' }) }); assert.equal(result.status, 409);
  });
  await check('provider workspace initially contains only persisted records', async () => {
    const result = await request('/api/v1/services/provider/work', { cookie: companyCookie }); assert.equal(result.status, 200); assert.equal(result.data.quoteRequests.length, 0); assert.equal(result.data.bookings.length, 0); assert.equal(result.data.availability[0].public_id, availabilityId);
  });
  await check('buyer creates a real owned Thing for service context', async () => {
    const result = await request('/api/v1/world/things', { method: 'POST', body: JSON.stringify({ title: `Bosch Washer ${suffix}`, thingType: 'product', source: 'manual', brand: 'Bosch', model: 'WAT-Test' }) }); assert.equal(result.status, 201); thingId = result.data.thing.publicId;
  });
  await check('buyer creates a canonical REPAIR Need linked to the Thing', async () => {
    const result = await request('/api/v1/world/needs', { method: 'POST', body: JSON.stringify({ title: `Repair washer ${suffix}`, description: 'Washer stops during the drain cycle.', problemDescription: 'Stops during drain and shows an error.', needType: 'REPAIR', thingId, category: 'REPAIR', locationMode: 'AT_CUSTOMER', confidence: 'CONFIRMED' }) }); assert.equal(result.status, 201); needId = result.data.need.publicId;
  });
  await check('buyer saves a draft service brief without publishing it', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/service-brief`, { method: 'POST', body: JSON.stringify({ title: 'Diagnose and repair washer', issueDescription: 'Washer stops during drain and displays an error.', category: 'REPAIR', serviceMode: 'AT_CUSTOMER', coarseLocation: '10000 Zagreb, Croatia', brand: 'Bosch', model: 'WAT-Test', desiredWindowStart: '2026-09-10T09:30:00.000Z', desiredWindowEnd: '2026-09-10T10:30:00.000Z', addressRequired: true, approvedFields: ['thing_name','brand','model'], confirmed: false }) }); assert.equal(result.status, 201); briefId = result.data.brief.publicId; assert.equal(result.data.brief.matchingEnabled, false);
  });
  await check('unconfirmed brief cannot run provider matching', async () => {
    assert.equal((await request(`/api/v1/world/needs/${needId}/service-matches`)).status, 409);
  });
  await check('buyer confirms exact shared fields and stores private address', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/service-brief`, { method: 'POST', body: JSON.stringify({ title: 'Diagnose and repair washer', issueDescription: 'Washer stops during drain and displays an error.', category: 'REPAIR', serviceMode: 'AT_CUSTOMER', coarseLocation: '10000 Zagreb, Croatia', brand: 'Bosch', model: 'WAT-Test', desiredWindowStart: '2026-09-10T09:30:00.000Z', desiredWindowEnd: '2026-09-10T10:30:00.000Z', addressRequired: true, approvedFields: ['thing_name','brand','model'], address: { addressLine: 'Private Service Street 7', postalCode: '10000', city: 'Zagreb', countryCode: 'HR' }, confirmed: true, matchingEnabled: true }) }); assert.equal(result.status, 200); assert.ok(result.data.brief.confirmedAt); assert.equal(result.data.brief.privacy.exactAddressShared, false);
  });
  await check('service brief read never returns exact address', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/service-brief`); assert.equal(result.status, 200); assert.equal(JSON.stringify(result.data).includes('Private Service Street'), false);
  });
  await check('another buyer cannot read the service brief', async () => {
    assert.equal((await request(`/api/v1/world/needs/${needId}/service-brief`, { cookie: unrelatedCookie })).status, 404);
  });
  await check('matching returns only the real compatible provider', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/service-matches`); assert.equal(result.status, 200); assert.equal(result.data.matches.length, 1); assert.equal(result.data.matches[0].provider.publicId, providerId); assert.equal(result.data.matches[0].capability.publicId, capabilityId);
  });
  await check('matching explains mode coverage brand and real slot', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/service-matches`); const reasons = result.data.matches[0].matchReasons.join(' '); assert.match(reasons, /service/i); assert.match(reasons, /coverage/i); assert.match(reasons, /brand/i); assert.match(reasons, /real offered slot/i);
  });
  await check('matching is deterministic across fresh reads', async () => {
    const a = await request(`/api/v1/world/needs/${needId}/service-matches`), b = await request(`/api/v1/world/needs/${needId}/service-matches`); assert.deepEqual(a.data.matches, b.data.matches);
  });
  await check('provider invitation creates an invite and no provider', async () => {
    const before = await request('/api/v1/services/provider', { cookie: companyCookie }); const invited = await request(`/api/v1/world/needs/${needId}/service-invites`, { method: 'POST', body: JSON.stringify({ contact: 'external-provider@example.invalid', invitationNote: 'Join Still to quote this request.' }) }); const after = await request('/api/v1/services/provider', { cookie: companyCookie }); assert.equal(invited.status, 201); assert.match(invited.data.notice, /does not create/i); assert.equal(before.data.provider.publicId, after.data.provider.publicId);
  });
  await check('buyer sends a real diagnostic-first quote request', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/service-quote-requests`, { method: 'POST', body: JSON.stringify({ providerId, capabilityId, message: 'Please quote the initial diagnostic visit.' }) }); assert.equal(result.status, 201); assert.equal(result.data.quoteRequest.diagnosticFirst, true); quoteRequestId = result.data.quoteRequest.publicId;
  });
  await check('duplicate quote request is rejected', async () => {
    assert.equal((await request(`/api/v1/world/needs/${needId}/service-quote-requests`, { method: 'POST', body: JSON.stringify({ providerId, capabilityId }) })).status, 409);
  });
  await check('provider inbox receives only the persisted request', async () => {
    const result = await request('/api/v1/services/provider/work', { cookie: companyCookie }); assert.equal(result.data.quoteRequests.length, 1); assert.equal(result.data.quoteRequests[0].public_id, quoteRequestId); assert.equal(JSON.stringify(result.data).includes('Private Service Street'), false);
  });
  await check('provider creates an honest diagnostic-first quote', async () => {
    const result = await request(`/api/v1/services/quote-requests/${quoteRequestId}/quotes`, { cookie: companyCookie, method: 'POST', body: JSON.stringify({ pricingType: 'DIAGNOSTIC_FIRST', diagnosticFeeCents: 3500, currency: 'EUR', scope: 'On-site diagnosis. Repair price will be quoted only after diagnosis.', estimatedDurationMinutes: 60, validUntil: '2026-09-30' }) }); assert.equal(result.status, 201); quoteId = result.data.quote.publicId; assert.equal(result.data.quote.amountCents, null);
  });
  await check('buyer sees the real quote and external-payment disclosure', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/service-quotes`); assert.equal(result.status, 200); assert.equal(result.data.quotes[0].public_id, quoteId); assert.match(result.data.paymentNotice, /does not hold funds/i);
  });
  await check('buyer creates a booking from quote and real slot', async () => {
    const result = await request('/api/v1/services/bookings', { method: 'POST', body: JSON.stringify({ quoteId, availabilityId, clientNote: 'Please ring the apartment intercom.' }) }); assert.equal(result.status, 201); assert.equal(result.data.status, 'REQUESTED'); assert.match(result.data.paymentNotice, /No deposit or escrow/i); bookingId = result.data.bookingId;
  });
  await check('requested booking still hides exact address', async () => {
    const result = await request(`/api/v1/services/bookings/${bookingId}`); assert.equal(result.data.booking.status, 'REQUESTED'); assert.equal(result.data.booking.address, null); assert.equal(JSON.stringify(result.data).includes('Private Service Street'), false);
  });
  await check('unrelated buyer cannot read booking or address', async () => {
    assert.equal((await request(`/api/v1/services/bookings/${bookingId}`, { cookie: unrelatedCookie })).status, 404);
  });
  await check('business provider confirms the real booking', async () => {
    const result = await request(`/api/v1/services/bookings/${bookingId}/accept`, { cookie: companyCookie, method: 'POST', body: '{}' }); assert.equal(result.status, 200); assert.equal(result.data.status, 'CONFIRMED');
  });
  await check('exact address is revealed only after confirmation', async () => {
    const client = await request(`/api/v1/services/bookings/${bookingId}`), provider = await request(`/api/v1/services/bookings/${bookingId}`, { cookie: companyCookie }); assert.equal(client.data.booking.address.address_line, 'Private Service Street 7'); assert.equal(provider.data.booking.address.address_line, 'Private Service Street 7');
  });
  await check('confirmed network booking enters the real CompanyOS service workspace', async () => {
    const result = await request('/api/v1/services/engagements', { cookie: companyCookie }); assert.equal(result.status, 200); assert.ok(result.data.engagements.some(item => item.reference === bookingId));
  });
  await check('client sends a private booking message', async () => {
    assert.equal((await request(`/api/v1/services/bookings/${bookingId}/messages`, { method: 'POST', body: JSON.stringify({ body: 'The drain filter was cleaned yesterday.' }) })).status, 201);
  });
  await check('provider replies in the participant-scoped booking', async () => {
    assert.equal((await request(`/api/v1/services/bookings/${bookingId}/messages`, { cookie: companyCookie, method: 'POST', body: JSON.stringify({ body: 'Thank you. We will check the pump and drain hose.' }) })).status, 201); const read = await request(`/api/v1/services/bookings/${bookingId}`); assert.equal(read.data.messages.length, 2);
  });
  await check('provider starts only a confirmed booking', async () => {
    const result = await request(`/api/v1/services/bookings/${bookingId}/start`, { cookie: companyCookie, method: 'POST', body: '{}' }); assert.equal(result.status, 200); assert.equal(result.data.status, 'IN_PROGRESS');
  });
  await check('provider submits a structured service report and real part', async () => {
    const result = await request(`/api/v1/services/bookings/${bookingId}/report`, { cookie: companyCookie, method: 'POST', body: JSON.stringify({ summary: 'Drain pump replaced and tested.', diagnosis: 'Drain pump failed under load.', workPerformed: 'Replaced the pump and completed two drain cycles.', recommendations: 'Clean the filter monthly.', serviceWarrantyDays: 180, warrantyTerms: 'Provider-declared warranty covering the installed pump and labour.', parts: [{ name: 'Drain pump', partNumber: 'PUMP-42', quantity: 1, unitCostCents: 4800, currency: 'EUR' }] }) }); assert.equal(result.status, 201); reportId = result.data.reportId;
  });
  await check('report alone does not complete or resolve the Need', async () => {
    const booking = await request(`/api/v1/services/bookings/${bookingId}`), need = await request(`/api/v1/world/needs/${needId}`); assert.equal(booking.data.booking.status, 'REPORT_SUBMITTED'); assert.equal(booking.data.report.publicId, reportId); assert.notEqual(need.data.need.status, 'RESOLVED');
  });
  await check('only the client can confirm service completion', async () => {
    assert.equal((await request(`/api/v1/services/bookings/${bookingId}/confirm`, { cookie: companyCookie, method: 'POST', body: '{}' })).status, 409);
  });
  await check('client confirmation completes booking and resolves Need', async () => {
    const result = await request(`/api/v1/services/bookings/${bookingId}/confirm`, { method: 'POST', body: '{}' }); assert.equal(result.status, 200); assert.equal(result.data.status, 'COMPLETED'); const need = await request(`/api/v1/world/needs/${needId}`); assert.equal(need.data.need.status, 'RESOLVED');
  });
  await check('completed service appends real Thing service history', async () => {
    const result = await request(`/api/v1/world/things/${thingId}`); assert.equal(result.status, 200); assert.ok(JSON.stringify(result.data).includes('thing.service_completed'));
  });
  await check('client can favorite only the completed provider', async () => {
    const result = await request(`/api/v1/services/bookings/${bookingId}/favorite`, { method: 'POST', body: '{}' }); assert.equal(result.status, 200); assert.equal(result.data.providerId, providerId);
  });
  await check('repeat booking creates a new real request without copying payment', async () => {
    const result = await request(`/api/v1/services/bookings/${bookingId}/repeat`, { method: 'POST', body: '{}' }); assert.equal(result.status, 201); repeatId = result.data.bookingId; const read = await request(`/api/v1/services/bookings/${repeatId}`); assert.equal(read.data.booking.payment.status, 'NOT_RECORDED');
  });
  await check('client can cancel the repeat request with a reason', async () => {
    const result = await request(`/api/v1/services/bookings/${repeatId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Created only to verify the repeat-booking flow.' }) }); assert.equal(result.status, 200); assert.equal(result.data.status, 'CANCELLED');
  });
  await check('NOW exposes only persisted active service work', async () => {
    const result = await request('/api/v1/world/now'); assert.equal(result.status, 200); assert.ok(result.data.services); assert.equal(result.data.services.bookings.some(item => item.public_id === repeatId), false);
  });
  await check('provider workspace reflects quote booking and report lifecycle', async () => {
    const result = await request('/api/v1/services/provider/work', { cookie: companyCookie }); assert.equal(result.status, 200); assert.ok(result.data.bookings.some(item => item.public_id === bookingId && item.status === 'COMPLETED')); assert.ok(result.data.bookings.some(item => item.public_id === repeatId && item.status === 'CANCELLED'));
  });
  await check('service lifecycle never reports Still payment escrow or settlement', async () => {
    const result = await request(`/api/v1/services/bookings/${bookingId}`); assert.equal(result.data.booking.payment.mode, 'EXTERNAL_MANUAL'); assert.equal(result.data.booking.payment.status, 'NOT_RECORDED'); assert.match(result.data.booking.payment.notice, /does not hold funds/i);
  });

  process.stdout.write(`Services and Local Resolution Network HTTP integration tests passed (${passed} flows).\n`);
})();

module.exports = run;
