const assert = require('node:assert/strict');

const origin = process.argv[2] || 'http://localhost:8791';
const clientCookie = 'still_buyer=world-test-session-two';
const professionalCookie = 'still_buyer=world-test-session-three';
const unrelatedCookie = 'still_buyer=world-test-session';
let passed = 0;

async function request(path, { cookie = clientCookie, method = 'GET', body } = {}) {
  const response = await fetch(`${origin}${path}`, { method, body, signal: AbortSignal.timeout(15000), headers: { cookie, ...(!['GET','HEAD'].includes(method) ? { origin, 'content-type': 'application/json' } : {}) } });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function check(name, action) { await action(); passed += 1; process.stdout.write(`✓ Professional ${String(passed).padStart(2,'0')} ${name}\n`); }

const run = (async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  let needId, opportunityId, proposalId, projectId, milestoneId, firstDeliverableId, outcomeId, cancellableOpportunityId, cancellableProposalId, cancellableProjectId;

  await check('same buyer identity enables Professional Mode', async () => {
    const result = await request('/api/v1/professional/profile', { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ professionalModeEnabled: true, displayName: 'World Test Professional', headline: 'Brand identity designer', bio: 'Helps independent businesses with identity systems.', availabilityStatus: 'AVAILABLE', locationModes: ['REMOTE'], weeklyCapacityHours: 20, minimumProjectCents: 20000, currency: 'EUR' }) });
    assert.equal(result.status, 201); assert.equal(result.data.profile.professionalModeEnabled, true);
  });
  await check('professional profile persists across a fresh request', async () => {
    const result = await request('/api/v1/professional/profile', { cookie: professionalCookie });
    assert.equal(result.status, 200); assert.equal(result.data.profile.headline, 'Brand identity designer');
  });
  await check('declared capability persists as unverified', async () => {
    const result = await request('/api/v1/professional/capabilities', { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ name: 'Brand identity', key: 'brand_identity', category: 'DESIGN', yearsExperience: 4 }) });
    assert.equal(result.status, 201); assert.equal(result.data.capabilities[0].verificationStatus, 'UNVERIFIED');
  });
  await check('real portfolio evidence persists without claiming verification', async () => {
    const created = await request('/api/v1/professional/portfolio', { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ title: 'Independent restaurant identity', description: 'A real work sample shared by its author.', externalUrl: 'https://example.invalid/restaurant-identity', capabilityKeys: ['brand_identity'], isPublic: true }) });
    assert.equal(created.status, 201); const result = await request('/api/v1/professional/portfolio', { cookie: professionalCookie }); assert.equal(result.status, 200); assert.ok(result.data.portfolio.some(item => item.title === 'Independent restaurant identity'));
  });
  await check('client creates a real HIRE Need', async () => {
    const result = await request('/api/v1/world/needs', { method: 'POST', body: JSON.stringify({ title: `Restaurant identity ${suffix}`, description: 'Create a clear identity for a small restaurant.', desiredOutcome: 'A usable brand identity.', needType: 'HIRE', sourceType: 'USER_CREATED', confidence: 'CONFIRMED', budgetMaxCents: 50000, currency: 'EUR', deadline: '2026-09-30', locationMode: 'REMOTE', requiredCapabilities: ['brand_identity'] }) });
    assert.equal(result.status, 201); needId = result.data.need.publicId; assert.equal(result.data.need.type, 'HIRE');
  });
  await check('Still Brief persists only explicit approved fields', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/brief`, { method: 'POST', body: JSON.stringify({ objective: 'Create a practical restaurant identity.', scope: 'Logo direction and a concise color/type system.', deliverables: ['Logo direction', 'Color and type guide'], constraints: ['Use only supplied restaurant name'], budgetMaxCents: 50000, currency: 'EUR', deadline: '2026-09-30', locationMode: 'REMOTE', confirm: true, matchingEnabled: true }) });
    assert.equal(result.status, 201); assert.equal(result.data.brief.confirmedAt !== null, true); assert.deepEqual(result.data.brief.attachments, []);
  });
  await check('brief projection excludes private World records', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/brief`);
    assert.equal(result.status, 200); assert.ok(result.data.brief.excludedContext.includes('private World')); assert.equal(JSON.stringify(result.data).includes('world-one@example.invalid'), false);
  });
  await check('matching returns the real professional only', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/professional-matches`);
    assert.equal(result.status, 200); assert.equal(result.data.matches.length, 1); assert.equal(result.data.matches[0].professional.displayName, 'World Test Professional');
  });
  await check('match reasons are deterministic and explain capability fit', async () => {
    const first = await request(`/api/v1/world/needs/${needId}/professional-matches`), second = await request(`/api/v1/world/needs/${needId}/professional-matches`);
    assert.deepEqual(first.data.matches.map(item => [item.professional.publicId,item.matchScore,item.matchReasons]), second.data.matches.map(item => [item.professional.publicId,item.matchScore,item.matchReasons])); assert.ok(first.data.matches[0].matchReasons.some(reason => /capabilit/i.test(reason)));
  });
  await check('client explicitly shares with the selected professional', async () => {
    const matches = await request(`/api/v1/world/needs/${needId}/professional-matches`), professionalId = matches.data.matches[0].professional.publicId;
    const result = await request(`/api/v1/world/needs/${needId}/brief/share`, { method: 'POST', body: JSON.stringify({ professionalIds: [professionalId] }) });
    assert.equal(result.status, 201); opportunityId = result.data.opportunityIds[0];
  });
  await check('unrelated user cannot access the private opportunity', async () => {
    assert.equal((await request(`/api/v1/professional/opportunities/${opportunityId}`, { cookie: unrelatedCookie })).status, 404);
  });
  await check('selected professional opens the persisted opportunity', async () => {
    const result = await request(`/api/v1/professional/opportunities/${opportunityId}`, { cookie: professionalCookie });
    assert.equal(result.status, 200); assert.equal(result.data.opportunity.viewerRole, 'PROFESSIONAL'); assert.equal(result.data.opportunity.brief.needId, needId);
  });
  await check('professional records interest without auto-acceptance', async () => {
    const result = await request(`/api/v1/professional/opportunities/${opportunityId}/interest`, { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ action: 'INTERESTED' }) });
    assert.equal(result.status, 200); assert.equal(result.data.status, 'INTERESTED');
  });
  await check('professional question persists in opportunity scope', async () => {
    const sent = await request(`/api/v1/professional/opportunities/${opportunityId}/interest`, { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ action: 'QUESTION', question: 'Which restaurant name should appear in the identity?' }) });
    assert.equal(sent.status, 200); const read = await request(`/api/v1/professional/opportunities/${opportunityId}`); assert.ok(read.data.opportunity.messages.some(message => /restaurant name/.test(message.body)));
  });
  await check('proposal with real terms persists', async () => {
    const result = await request('/api/v1/professional/proposals', { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ opportunityId, amountCents: 40000, currency: 'EUR', summary: 'Two-stage identity proposal.', scope: 'Concept direction followed by final identity guide.', estimatedDays: 7, deadline: '2026-09-30', revisionRounds: 1, milestones: [{ title: 'Brand concept', amountCents: 15000 }, { title: 'Final identity guide', amountCents: 25000 }] }) });
    assert.equal(result.status, 201); proposalId = result.data.proposalId;
  });
  await check('proposal history begins with one immutable version', async () => {
    const result = await request(`/api/v1/professional/proposals/${proposalId}`);
    assert.equal(result.status, 200); assert.equal(result.data.proposal.versions.length, 1); assert.equal(result.data.proposal.amountCents, 40000);
  });
  await check('structured client counter preserves proposal history', async () => {
    const result = await request(`/api/v1/professional/proposals/${proposalId}`, { method: 'PATCH', body: JSON.stringify({ amountCents: 38000, currency: 'EUR', summary: 'Two-stage identity proposal.', scope: 'Concept direction followed by final identity guide.', estimatedDays: 8, deadline: '2026-09-30', revisionRounds: 1, milestones: [{ title: 'Brand concept', amountCents: 14000 }, { title: 'Final identity guide', amountCents: 24000 }], changeNote: 'Adjusted amount and timeline.' }) });
    assert.equal(result.status, 200); assert.equal(result.data.proposal.versions.length, 2); assert.equal(result.data.proposal.status, 'COUNTERED');
  });
  await check('unrelated user cannot accept proposal', async () => {
    assert.equal((await request(`/api/v1/professional/proposals/${proposalId}`, { cookie: unrelatedCookie, method: 'PATCH', body: JSON.stringify({ action: 'ACCEPT' }) })).status, 404);
  });
  await check('client acceptance creates a real Deal and Project', async () => {
    const result = await request(`/api/v1/professional/proposals/${proposalId}`, { method: 'PATCH', body: JSON.stringify({ action: 'ACCEPT' }) });
    assert.equal(result.status, 201); assert.equal(result.data.payment.mode, 'EXTERNAL_MANUAL'); assert.equal(result.data.payment.stillFeeCents, 0); projectId = result.data.projectId;
  });
  await check('project persists for both participants', async () => {
    const client = await request(`/api/v1/professional/projects/${projectId}`), professional = await request(`/api/v1/professional/projects/${projectId}`, { cookie: professionalCookie });
    assert.equal(client.status, 200); assert.equal(professional.status, 200); assert.equal(client.data.project.viewerRole, 'CLIENT'); assert.equal(professional.data.project.viewerRole, 'PROFESSIONAL'); milestoneId = professional.data.project.milestones[0].publicId;
  });
  await check('unrelated user cannot access project or files', async () => {
    assert.equal((await request(`/api/v1/professional/projects/${projectId}`, { cookie: unrelatedCookie })).status, 404);
  });
  await check('professional submits a real deliverable', async () => {
    const result = await request(`/api/v1/professional/milestones/${milestoneId}/submit`, { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ title: 'Brand concept v1', description: 'Initial concept ready for client review.', externalUrl: 'https://example.invalid/brand-concept-v1' }) });
    assert.equal(result.status, 201); firstDeliverableId = result.data.deliverableId;
  });
  await check('submission does not auto-complete the milestone', async () => {
    const result = await request(`/api/v1/professional/projects/${projectId}`); const milestone = result.data.project.milestones.find(item => item.publicId === milestoneId);
    assert.equal(milestone.status, 'SUBMITTED'); assert.ok(result.data.project.deliverables.some(item => item.public_id === firstDeliverableId));
  });
  await check('client requests revision with a required reason', async () => {
    assert.equal((await request(`/api/v1/professional/milestones/${milestoneId}/revision`, { method: 'POST', body: JSON.stringify({ reason: 'Please simplify the symbol and provide one monochrome version.' }) })).status, 200);
  });
  await check('professional resubmits without erasing first deliverable', async () => {
    const submitted = await request(`/api/v1/professional/milestones/${milestoneId}/submit`, { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ title: 'Brand concept v2', description: 'Simplified symbol and monochrome version included.', externalUrl: 'https://example.invalid/brand-concept-v2' }) });
    assert.equal(submitted.status, 201); const project = await request(`/api/v1/professional/projects/${projectId}`); assert.equal(project.data.project.deliverables.length, 2);
  });
  await check('client approval explicitly completes first milestone', async () => {
    assert.equal((await request(`/api/v1/professional/milestones/${milestoneId}/approve`, { method: 'POST', body: '{}' })).status, 200);
  });
  await check('professional submits and client approves final milestone', async () => {
    const project = await request(`/api/v1/professional/projects/${projectId}`), final = project.data.project.milestones[1];
    assert.equal((await request(`/api/v1/professional/milestones/${final.publicId}/submit`, { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ title: 'Final identity guide', description: 'Final guide ready.', externalUrl: 'https://example.invalid/final-guide' }) })).status, 201);
    assert.equal((await request(`/api/v1/professional/milestones/${final.publicId}/approve`, { method: 'POST', body: '{}' })).status, 200);
  });
  await check('client confirms final outcome before project completion', async () => {
    const result = await request(`/api/v1/professional/projects/${projectId}/complete`, { method: 'POST', body: JSON.stringify({ summary: 'Restaurant identity delivered and accepted.' }) });
    assert.equal(result.status, 200); assert.equal(result.data.status, 'COMPLETED'); outcomeId = result.data.resolutionOutcomeId;
  });
  await check('project completion resolves the original HIRE Need', async () => {
    const result = await request(`/api/v1/world/needs/${needId}`); assert.equal(result.data.need.status, 'RESOLVED');
  });
  await check('ResolutionOutcome links the professional and Project', async () => {
    const result = await request(`/api/v1/world/needs/${needId}/context`), outcome = result.data.outcomes.find(item => item.publicId === outcomeId);
    assert.equal(outcome.resolutionType, 'HIRE'); assert.ok(outcome.professionalId); assert.equal(outcome.professionalProjectId, projectId);
  });
  await check('only relevant completed-work capability gains evidence', async () => {
    const result = await request('/api/v1/professional/capabilities', { cookie: professionalCookie }); assert.equal(result.data.capabilities[0].verificationStatus, 'UNVERIFIED'); assert.equal(result.data.capabilities[0].evidenceCount, 2);
  });
  await check('structured feedback is allowed only after completion', async () => {
    const result = await request(`/api/v1/professional/projects/${projectId}/feedback`, { method: 'POST', body: JSON.stringify({ outcomeRating: 5, communicationRating: 5, reliabilityRating: 4, comment: 'Clear work and good communication.' }) }); assert.equal(result.status, 201);
  });
  await check('duplicate or fake feedback is rejected', async () => {
    const result = await request(`/api/v1/professional/projects/${projectId}/feedback`, { method: 'POST', body: JSON.stringify({ outcomeRating: 5, communicationRating: 5, reliabilityRating: 5 }) }); assert.equal(result.status, 409);
  });
  await check('completed client can mark trusted repeat work', async () => {
    assert.equal((await request(`/api/v1/professional/projects/${projectId}/favorite`, { method: 'POST', body: '{}' })).status, 200);
  });
  await check('completed project can be reported without inventing arbitration', async () => {
    const result = await request('/api/v1/professional/reports', { method: 'POST', body: JSON.stringify({ projectId, reason: 'Integration safety record', details: 'A durable test report attached to a real participant-scoped project.' }) }); assert.equal(result.status, 201); assert.ok(result.data.reportId);
  });
  await check('professional can withdraw a real proposal before acceptance', async () => {
    const created = await request('/api/v1/world/needs', { method: 'POST', body: JSON.stringify({ title: `Cancellable identity ${suffix}`, needType: 'HIRE', requiredCapabilities: ['brand_identity'], locationMode: 'REMOTE' }) });
    await request(`/api/v1/world/needs/${created.data.need.publicId}/brief`, { method: 'POST', body: JSON.stringify({ objective: 'Prepare a cancellable identity.', scope: 'One small identity task.', confirm: true, matchingEnabled: true, locationMode: 'REMOTE' }) });
    const matches = await request(`/api/v1/world/needs/${created.data.need.publicId}/professional-matches`), shared = await request(`/api/v1/world/needs/${created.data.need.publicId}/brief/share`, { method: 'POST', body: JSON.stringify({ professionalIds: [matches.data.matches[0].professional.publicId] }) }); cancellableOpportunityId = shared.data.opportunityIds[0];
    const proposal = await request('/api/v1/professional/proposals', { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ opportunityId: cancellableOpportunityId, amountCents: 10000, currency: 'EUR', summary: 'Small identity task.', scope: 'One agreed deliverable.', milestones: [{ title: 'Identity delivery' }] }) }); cancellableProposalId = proposal.data.proposalId;
    const withdrawn = await request(`/api/v1/professional/proposals/${cancellableProposalId}`, { cookie: professionalCookie, method: 'PATCH', body: JSON.stringify({ action: 'WITHDRAW' }) }); assert.equal(withdrawn.status, 200); assert.equal(withdrawn.data.status, 'WITHDRAWN');
  });
  await check('client can cancel a new project before completed work', async () => {
    const proposal = await request('/api/v1/professional/proposals', { cookie: professionalCookie, method: 'POST', body: JSON.stringify({ opportunityId: cancellableOpportunityId, amountCents: 10000, currency: 'EUR', summary: 'Replacement proposal.', scope: 'One agreed deliverable.', milestones: [{ title: 'Identity delivery' }] }) });
    const accepted = await request(`/api/v1/professional/proposals/${proposal.data.proposalId}`, { method: 'PATCH', body: JSON.stringify({ action: 'ACCEPT' }) }); cancellableProjectId = accepted.data.projectId;
    const cancelled = await request(`/api/v1/professional/projects/${cancellableProjectId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Client no longer needs this work.' }) }); assert.equal(cancelled.status, 200); assert.equal(cancelled.data.status, 'CANCELLED');
  });
  await check('professional can pause availability and leaves future matching', async () => {
    const profile = await request('/api/v1/professional/profile', { cookie: professionalCookie });
    assert.equal((await request('/api/v1/professional/profile', { cookie: professionalCookie, method: 'PATCH', body: JSON.stringify({ ...profile.data.profile, professionalModeEnabled: true, availabilityStatus: 'PAUSED', locationModes: ['REMOTE'] }) })).status, 200);
    const created = await request('/api/v1/world/needs', { method: 'POST', body: JSON.stringify({ title: `Second identity need ${suffix}`, needType: 'HIRE', requiredCapabilities: ['brand_identity'], locationMode: 'REMOTE' }) });
    await request(`/api/v1/world/needs/${created.data.need.publicId}/brief`, { method: 'POST', body: JSON.stringify({ objective: 'Create a second identity.', scope: 'Identity design.', confirm: true, matchingEnabled: true, locationMode: 'REMOTE' }) });
    const matches = await request(`/api/v1/world/needs/${created.data.need.publicId}/professional-matches`); assert.equal(matches.data.matches.length, 0); assert.equal(matches.data.emptyState.title, 'No matching professionals are available yet.');
  });
  await check('a blocked professional is excluded from future matching', async () => {
    const profile = await request('/api/v1/professional/profile', { cookie: professionalCookie }); await request('/api/v1/professional/profile', { cookie: professionalCookie, method: 'PATCH', body: JSON.stringify({ ...profile.data.profile, professionalModeEnabled: true, availabilityStatus: 'AVAILABLE', locationModes: ['REMOTE'] }) });
    const created = await request('/api/v1/world/needs', { method: 'POST', body: JSON.stringify({ title: `Blocked identity need ${suffix}`, needType: 'HIRE', requiredCapabilities: ['brand_identity'], locationMode: 'REMOTE' }) }); await request(`/api/v1/world/needs/${created.data.need.publicId}/brief`, { method: 'POST', body: JSON.stringify({ objective: 'Create an identity.', scope: 'Identity design.', confirm: true, matchingEnabled: true, locationMode: 'REMOTE' }) });
    const before = await request(`/api/v1/world/needs/${created.data.need.publicId}/professional-matches`); assert.equal(before.data.matches.length, 1); const blocked = await request('/api/v1/professional/blocks', { method: 'POST', body: JSON.stringify({ professionalId: before.data.matches[0].professional.publicId }) }); assert.equal(blocked.status, 200); const after = await request(`/api/v1/world/needs/${created.data.need.publicId}/professional-matches`); assert.equal(after.data.matches.length, 0);
  });
  await check('CompanyOS private authorization remains outside Phase 5', async () => {
    const result = await request('/api/v1/companyos/bootstrap'); assert.ok([401,403,404].includes(result.status));
  });
  await check('authenticated shell ships responsive Phase 5 assets', async () => {
    const response = await fetch(`${origin}/app/work`, { headers: { cookie: clientCookie } }); const html = await response.text(); assert.equal(response.status, 200); assert.match(html, /professional-network-v136\.js/); assert.match(html, /professional-network-v136\.css/);
  });

  process.stdout.write(`Professional Resolution Network HTTP integration tests passed (${passed} flows).\n`);
})();

module.exports = run;
if (require.main === module) run.catch(error => { console.error(error.stack || error); process.exit(1); });
