const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const worker = read('merchant-backend/worker-v137.js');
const schema = read('merchant-backend/schema-v137.sql');
const runtimeSchema = read('merchant-backend/service-network-schema-v137.js');
const client = read('service-network-v137.js');
const style = read('service-network-v137.css');
const company = read('company-service-network-v137.js');
const companyStyle = read('company-service-network-v137.css');
const needs = read('needs-resolution-v134.js');
const loader = read('company-authenticated-loader-v82.js');
const build = read('build-public.js');
const app = read('app.html');
const wrangler = read('wrangler.jsonc');
const integration = read('scripts/service-network-integration-test.js');
let passed = 0;
function test(name, check) { check(); passed += 1; process.stdout.write(`✓ ${name}\n`); }

test('01 Phase 6 is additive over the complete Phase 5 Worker', () => assert.ok(worker.includes("import app from './worker-v136.js'") && worker.includes('return app.fetch(request,env,ctx)')));
test('02 active deployment chain preserves Phase 6 through the current entry point', () => assert.ok(
  wrangler.includes('merchant-backend/worker-v144.js') &&
  read('merchant-backend/worker-v144.js').includes("import app from './worker-v143.js'") &&
  read('merchant-backend/worker-v143.js').includes("import app from './worker-v142.js'") &&
  read('merchant-backend/worker-v142.js').includes("import app from './worker-v141.js'") &&
  read('merchant-backend/worker-v141.js').includes("import app from './worker-v140.js'") &&
  read('merchant-backend/worker-v140.js').includes("import app from './worker-v139.js'") &&
  read('merchant-backend/worker-v139.js').includes("import app from './worker-v138.js'") &&
  read('merchant-backend/worker-v138.js').includes("import app from './worker-v137.js'")
));
test('03 no database identifier or binding was replaced', () => ['2fce8b3f-ffb7-4ffe-8e11-b565a65ea655','WORLD_FILES','ASSETS','AI'].forEach(value => assert.ok(wrangler.includes(value))));
test('04 service provider reuses Professional or CompanyOS identity', () => assert.ok(schema.includes('professional_profile_id TEXT UNIQUE') && schema.includes('organization_id TEXT UNIQUE')));
test('05 no service password or third identity store exists', () => assert.equal(/service_(?:password|sessions|accounts)/i.test(schema), false));
test('06 professional provider requires existing Professional Mode', () => assert.ok(worker.includes('professional_mode_required') && worker.includes('professional_profiles WHERE buyer_account_id=?')));
test('07 business provider uses hashed CompanyOS session', () => assert.ok(worker.includes("cookie(request,'still_company')") && worker.includes('merchant_sessions s JOIN merchant_members')));
test('08 verified organization state is distinct from service claims', () => assert.ok(worker.includes("'VERIFIED_ORGANIZATION':'UNVERIFIED_ORGANIZATION'") && worker.includes("serviceClaims:'PROVIDER_DECLARED'")));
test('09 unverified organization cannot publish active provider', () => assert.ok(worker.includes("canPublish=company.organization_status==='verified'") && worker.includes('active=requested&&canPublish')));
test('10 structured capability persists category mode pricing coverage and brand data', () => ['category TEXT NOT NULL','service_modes_json','pricing_model','coverage_type','coverage_json','brand_compatibility_json'].forEach(value => assert.ok(schema.includes(value))));
test('11 declarations are never automatic verification', () => assert.ok(schema.includes("declaration_status TEXT NOT NULL DEFAULT 'PROVIDER_DECLARED'") && !schema.includes("DEFAULT 'VERIFIED'")));
test('12 service categories cover repair installation diagnostics and local work', () => ['REPAIR','INSTALLATION','MAINTENANCE','DIAGNOSTIC','HOME_SERVICE','AUTOMOTIVE','APPLIANCE'].forEach(value => assert.ok(worker.includes(`'${value}'`))));
test('13 pricing supports quote, fixed-from, hourly-from and diagnostic-first', () => ['QUOTE_REQUIRED','FIXED_FROM','HOURLY_FROM','DIAGNOSTIC_FIRST'].forEach(value => assert.ok(worker.includes(`'${value}'`))));
test('14 quote-required capability cannot publish an unrelated starting price', () => assert.ok(worker.includes('starting_price_not_allowed_for_quote_required')));
test('15 availability is persisted and overlapping slots are rejected', () => assert.ok(schema.includes('service_network_availability') && worker.includes('availability_overlap')));
test('16 matching uses only active accepting providers and active capabilities', () => assert.ok(worker.includes('p.active=1 AND p.accepting_requests=1 AND c.active=1')));
test('17 matching respects capability category', () => assert.ok(worker.includes('c.category=?')));
test('18 matching checks declared service mode', () => assert.ok(worker.includes('modes.includes(brief.service_mode)')));
test('19 matching checks privacy-safe coverage', () => assert.ok(worker.includes('coverageMatches(row,brief)') && worker.includes("coverage_type==='CITY'")));
test('20 matching checks compatible brands when shared', () => assert.ok(worker.includes('brandMatches(row,brief)')));
test('21 requested windows require a real overlapping offered slot', () => assert.ok(worker.includes("status='OFFERED' AND starts_at<? AND ends_at>?")));
test('22 matching respects bidirectional blocks', () => assert.ok(worker.includes('NOT EXISTS(SELECT 1 FROM market_blocks')));
test('23 matching is deterministic and bounded', () => assert.ok(worker.includes('sort((a,b)=>b.matchScore-a.matchScore||a.provider.publicId.localeCompare') && worker.includes('Math.min(int(url.searchParams.get')));
test('24 matching never uses randomness ratings or sponsored ordering', () => assert.equal(/Math\.random|average_rating|sponsored|paid_rank|fake_provider/i.test(worker), false));
test('25 zero-result state names only honest next actions', () => assert.ok(worker.includes('No real matching service providers are available yet.') && worker.includes("'Continue externally','Invite a provider'")));
test('26 ServiceBrief links canonical Need and optional Thing', () => assert.ok(schema.includes('need_id TEXT NOT NULL UNIQUE') && schema.includes('thing_passport_id TEXT')));
test('27 only service-oriented Needs can create ServiceBrief', () => assert.ok(worker.includes("['REPAIR','SERVICE','MAINTAIN','BOOK','HIRE']")));
test('28 brief explicitly records approved fields', () => assert.ok(schema.includes('approved_fields_json') && worker.includes("['thing_name','brand','model','purchase_date','warranty_status','service_history']")));
test('29 matching requires confirmed brief and explicit consent', () => assert.ok(worker.includes('confirmed_service_brief_required') && worker.includes('!brief?.confirmed_at||!brief.matching_enabled')));
test('30 private address is isolated from ServiceBrief table', () => assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS service_network_addresses') && !/service_network_briefs[^;]+address_line/.test(schema)));
test('31 brief JSON explicitly excludes exact address and private World', () => assert.ok(client.includes('You control what is shared.') && worker.includes('exactAddressShared:false') && worker.includes('otherThingsShared:false')));
test('32 exact address is returned only in confirmed-or-later booking', () => assert.ok(worker.includes("row.status==='CONFIRMED'||['IN_PROGRESS','REPORT_SUBMITTED','COMPLETED'].includes(row.status)")));
test('33 address reveal is observable', () => assert.ok(worker.includes("log('address_revealed'")));
test('34 provider invite creates only an invitation record', () => assert.ok(worker.includes('This invitation does not create a provider, availability, quote, or booking.')));
test('35 quote request requires a persisted deterministic match', () => assert.ok(worker.includes('provider_match_required') && worker.includes('service_network_matches WHERE brief_id=?')));
test('36 duplicate quote requests are structurally prevented', () => assert.ok(schema.includes('UNIQUE(brief_id,provider_id,capability_id)')));
test('37 diagnostic-first quotes require a diagnostic fee', () => assert.ok(worker.includes('diagnostic_fee_required')));
test('38 fixed quotes require a real amount', () => assert.ok(worker.includes('fixed_amount_required')));
test('39 quote scope duration and validity are persisted', () => ['scope TEXT NOT NULL','estimated_duration_minutes','valid_until'].forEach(value => assert.ok(schema.includes(value))));
test('40 booking can reference a real quote and offered slot', () => assert.ok(schema.includes('quote_id TEXT') && schema.includes('availability_id TEXT')));
test('41 booking lifecycle has required participant actions', () => ['accept','decline','suggest-time','reschedule','cancel','no-show','start'].forEach(value => assert.ok(worker.includes(value))));
test('42 invalid booking transitions are rejected', () => assert.ok(worker.includes('invalid_booking_transition')));
test('43 provider cannot start before confirmation', () => assert.ok(worker.includes("action==='START'&&role==='PROVIDER'&&current==='CONFIRMED'")));
test('44 cancellation requires a real reason', () => assert.ok(worker.includes('cancellation_reason_required')));
test('45 private messages are participant-scoped', () => assert.ok(schema.includes('service_network_booking_messages') && worker.includes('bookingForParticipant')));
test('46 block policy applies to booking messages', () => assert.ok(worker.includes("if(await blocked(env,row.buyer_account_id,row.provider_buyer_account_id))")));
test('47 service reports require a real in-progress provider booking', () => assert.ok(worker.includes('provider_in_progress_booking_required')));
test('48 reports persist diagnosis work recommendations and provider-declared warranty', () => ['diagnosis TEXT','work_performed TEXT NOT NULL','recommendations TEXT','service_warranty_days','warranty_terms'].forEach(value => assert.ok(schema.includes(value))));
test('49 report parts are structured durable records', () => assert.ok(schema.includes('service_network_report_parts') && schema.includes('part_number TEXT') && schema.includes('quantity INTEGER')));
test('50 report submission alone cannot complete the booking', () => assert.ok(worker.includes("status='REPORT_SUBMITTED'") && worker.includes("row.viewerRole!=='CLIENT'||row.status!=='REPORT_SUBMITTED'")));
test('51 client confirmation completes booking and resolves Need', () => assert.ok(worker.includes("SET status='COMPLETED'") && worker.includes("SET status='RESOLVED'")));
test('52 completed service creates ResolutionOutcome', () => assert.ok(worker.includes('INSERT INTO world_resolution_outcomes') && worker.includes("'REPAIR'")));
test('53 completed service appends Thing history', () => assert.ok(worker.includes("'thing.service_completed'")));
test('54 favorite provider requires completed client booking', () => assert.ok(worker.includes('completed_client_booking_required') && schema.includes('service_network_favorites')));
test('55 repeat booking creates a new request without copying payment', () => assert.ok(worker.includes("'Repeat service request','EXTERNAL_MANUAL','NOT_RECORDED'")));
test('56 payment is always honestly external/manual', () => assert.ok(schema.includes("payment_mode TEXT NOT NULL DEFAULT 'EXTERNAL_MANUAL'") && worker.includes('Still does not hold funds or provide escrow')));
test('57 no payment provider escrow or deposit mutation exists', () => assert.equal(/stripe|payment_intent|escrow_account|deposit_charged/i.test(worker), false));
test('58 confirmed business booking enters CompanyOS service engagement', () => assert.ok(worker.includes('mirrorCompanyBooking') && worker.includes('INSERT INTO service_engagements')));
test('59 CompanyOS tenant scope is retained in mirrored engagement', () => assert.ok(worker.includes('WHERE organization_id=? AND reference=?') && worker.includes('row.organization_id')));
test('60 NOW is augmented only from persisted active bookings', () => assert.ok(worker.includes('augmentNow') && worker.includes("status NOT IN ('COMPLETED','CANCELLED','DECLINED','NO_SHOW')")));
test('61 required observability events are emitted', () => ['service_provider_enabled','service_capability_created','service_brief_created','provider_match_generated','quote_request_sent','service_quote_created','booking_requested','booking_confirmed','booking_rescheduled','booking_cancelled','service_started','service_report_created','service_confirmed','need_resolved','authorization_denied','address_revealed'].forEach(value => assert.ok(worker.includes(value), `missing ${value}`)));
test('62 Need workspace exposes the real service flow', () => assert.ok(needs.includes('StillServicesV137?.serviceSection') && needs.includes('StillServicesV137?.bindService')));
test('63 buyer UI supports privacy review matching quotes and booking', () => ['data-service-brief-form','service-matches','service-quote-requests','data-book-service'].forEach(value => assert.ok(client.includes(value))));
test('64 booking UI supports provider and client lifecycle actions', () => ['data-booking-action','data-service-report','data-confirm-service','data-favorite-provider','data-repeat-service'].forEach(value => assert.ok(client.includes(value))));
test('65 individual provider workspace is integrated into Work', () => assert.ok(client.includes('appendProviderWork') && client.includes('Set up service provider')));
test('66 CompanyOS loads its provider network after authentication', () => assert.ok(loader.includes('company-service-network-v137.js') && company.includes("#companyServicesV73")));
test('67 CompanyOS provider module uses real APIs for quotes bookings and reports', () => ['/api/v1/services/provider/work','/api/v1/services/quote-requests/','/api/v1/services/bookings/'].forEach(value => assert.ok(company.includes(value))));
test('68 responsive buyer and company layouts cover tablet and mobile', () => assert.ok(style.includes('@media(max-width:900px)') && style.includes('@media(max-width:640px)') && companyStyle.includes('@media(max-width:800px)') && companyStyle.includes('@media(max-width:520px)')));
test('69 buyer UI respects reduced motion', () => assert.ok(style.includes('prefers-reduced-motion:reduce')));
test('70 production app and build ship every Phase 6 asset', () => ['service-network-v137.js','service-network-v137.css','company-service-network-v137.js','company-service-network-v137.css'].forEach(value => assert.ok(build.includes(value) || app.includes(value))));
test('71 integration suite contains more than 34 real flows', () => assert.ok((integration.match(/await check\(/g) || []).length >= 34));
test('72 integration suite verifies privacy completion and CompanyOS intake', () => ['exact address is revealed only after confirmation','confirmed network booking enters the real CompanyOS service workspace','client confirmation completes booking and resolves Need'].forEach(value => assert.ok(integration.includes(value))));
test('73 production bundle remains at or beyond the Phase 6 release', () => { const value=Number(build.match(/const BUNDLE=(\d+)/)?.[1]); assert.ok(value>=164); });
test('74 no map SDK or invented map marker was added', () => assert.equal(/google\.maps|mapbox|leaflet|fake marker/i.test(`${worker}${client}${company}`), false));
test('75 no demo provider or simulated service success was added', () => assert.equal(/demo provider|sample provider|simulated (?:booking|payment|success)/i.test(`${worker}${client}${company}`), false));
test('76 buyer explicitly chooses stored documents for a ServiceBrief', () => assert.ok(client.includes('name="attachmentIds"') && client.includes("h.api('/api/v1/world/documents')")));
test('77 approved brief documents are copied into participant-scoped bookings', () => assert.ok(worker.includes('service_network_booking_attachments') && worker.includes('service_network_brief_attachments WHERE brief_id=?')));
test('78 approved originals require booking participant authorization', () => assert.ok(worker.includes('/attachments\\/([^/]+)\\/original') && worker.includes('serviceAttachmentOriginal') && worker.includes('bookingForParticipant')));
test('79 booking UI exposes real slots and manual requested windows', () => ['availabilityId','scheduledStart','scheduledEnd','Request another time'].forEach(value => assert.ok(client.includes(value))));
test('80 both provider surfaces expose scheduling messages parts and warranties', () => ['suggest-time','reschedule','data-service-message','data-add-part','serviceWarrantyDays'].forEach(value => assert.ok(client.includes(value) || company.includes(value))));
test('81 quote inbox projects only buyer-approved Thing fields', () => assert.ok(worker.includes("approved.has('thing_name')") && worker.includes("approved.has('brand')") && worker.includes("approved.has('service_history')") && worker.includes('shared_fields')));
test('82 quote attachments use provider-scoped private R2 delivery', () => assert.ok(worker.includes('quoteRequestAttachmentOriginal') && worker.includes('q.public_id=? AND q.provider_id=?') && client.includes('Buyer-approved context') && company.includes('Buyer-approved service context')));

process.stdout.write(`Services and Local Resolution Network tests passed (${passed} assertions).\n`);
