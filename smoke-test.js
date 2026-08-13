/* Run with: node smoke-test.js */
const fs=require('fs');
const files=['index.html','app.js','enhancements.js','v10.js','theme.js','styles.css','privacy.html','terms.html','methodology.html'];
const read=f=>fs.readFileSync(f,'utf8');
const fail=[];
for(const f of files){if(!fs.existsSync(f))fail.push(`missing ${f}`);}
if(!fail.length){
 const html=read('index.html'),app=read('app.js'),v10=read('v10.js'),enh=read('enhancements.js'),theme=read('theme.js'),css=read('styles.css');
 ['language','themeToggle'].forEach(id=>{if(!html.includes(`id="${id}"`))fail.push(`missing public shell DOM id ${id}`)});
 ['returnForm','market','purchaseType','store','purchaseDate','itemName','result','addReminder','scanReceipt','retailerSearch'].forEach(id=>{if(!app.includes(id)&&!enh.includes(id))fail.push(`legacy protection capability is missing ${id}`)});
 ['Consumer rights checker','returnForm','checker-card','hero-share-row','share-icons.css','styles.css'].forEach(marker=>{if(html.includes(marker))fail.push(`retired public UI remains in canonical index.html: ${marker}`)});
 ['value="en"','value="hr"'].forEach(x=>{if(!html.includes(x))fail.push(`missing language option ${x}`)});
 ['warrantyNote','goWarranty','checkReturn'].forEach(k=>{if(!v10.includes(k))fail.push(`missing localization key ${k}`)});
 ['whatsapp','facebook','linkedin','telegram','email','native','copy'].forEach(k=>{if(!enh.includes(k)&&!app.includes(k))fail.push(`missing share route ${k}`)});
 if(!theme.includes('still-theme'))fail.push('theme preference is not persisted');
 if(!css.includes('[data-theme="dark"]'))fail.push('dark theme CSS missing');
 if(!enh.includes('BEGIN:VCALENDAR'))fail.push('calendar reminder generation missing');
 if(!enh.includes('TextDetector'))fail.push('receipt OCR capability detection missing');
 if(!app.includes('eu14'))fail.push('EU withdrawal calculator missing');
 if(!read('privacy.html').includes('Checks and recent history'))fail.push('privacy disclosure missing');
 if(!read('terms.html').includes('Not legal advice'))fail.push('legal disclaimer missing');
 if(!read('methodology.html').includes('Source hierarchy'))fail.push('source methodology missing');
 const buyerAuth=read('buyer-auth-v77.js');
 const activeWorkerSource=require('./scripts/worker-chain').activeWorkerChain().map(workerFile=>workerFile.source).join('\n');
 const authWorker=activeWorkerSource;
 const worker=activeWorkerSource;
 const commerceWorker=activeWorkerSource;
 const lifecycleWorker=activeWorkerSource;
 const operationsWorker=activeWorkerSource;
 const relationshipWorker=activeWorkerSource;
 const contactWorker=activeWorkerSource;
 const setupWorker=activeWorkerSource;
 const eslWorker=activeWorkerSource;
 const {execFileSync}=require('child_process');
 execFileSync(process.execPath,['scripts/validate-active-worker.js'],{stdio:'inherit'});
 execFileSync(process.execPath,['scripts/validate-production-bundle.js'],{stdio:'inherit'});
 const company=read('company.html');
 if(!buyerAuth.includes('/api/v1/buyer-auth/google/config'))fail.push('buyer Google config does not use isolated auth namespace');
 if(!buyerAuth.includes('/api/v1/buyer-auth/google'))fail.push('buyer Google login does not use isolated auth namespace');
 if(buyerAuth.includes("api('/api/v1/auth/google"))fail.push('buyer auth still calls the shared company auth namespace');
 ['use_fedcm_for_button: true','button_auto_select: true','itp_support: true'].forEach(capability=>{if(!buyerAuth.includes(capability))fail.push(`buyer Google sign-in is missing ${capability}`)});
 if(!buyerAuth.includes('Google authenticates only')||!buyerAuth.includes('buyer account')||!buyerAuth.includes('warranty claim'))fail.push('buyer-only Google scope is not explained');
 if(company.includes('buyer-auth-v77.js'))fail.push('buyer Google authentication is loaded on the company page');
 if(!authWorker.includes("pathname === '/api/v1/buyer-auth/google/config'"))fail.push('worker does not route buyer Google config');
 if(!authWorker.includes("VALUES('GOOGLE_CLIENT_ID'"))fail.push('auth worker does not persist Google Client ID');
 if(!worker.includes("import app from './worker-v79.js'"))fail.push('ownership worker does not delegate to the audited auth router');
 
 if(!read('_headers').includes('Content-Security-Policy:'))fail.push('content security policy missing');
 if(!read('_headers').includes('same-origin-allow-popups'))fail.push('Google-compatible opener policy missing');
 if(!read('sitemap.xml').includes('/company.html'))fail.push('business workspace missing from sitemap');
 if(!read('site-quality-v82.js').includes('/privacy.html'))fail.push('legal footer navigation missing');
 const companyLoader=read('company-authenticated-loader-v82.js');
 if(!companyLoader.includes("still:company-authenticated"))fail.push('company features are not gated by successful company authentication');
 if(!companyLoader.includes("if (!event?.detail?.organization)"))fail.push('company workspace is not gated by successful company authentication');
 if(companyLoader.includes("status !== 'verified'"))fail.push('company workspace is still hidden behind verified-company status');
 if(!companyLoader.includes("window.__stillOrganization"))fail.push('authenticated organization context is not exposed to progressive access');
 if(!read('company-portal-v46.js').includes("still:company-authenticated"))fail.push('company portal does not release authenticated feature modules');
 if(!companyLoader.includes('companyos-v120.js'))fail.push('live CompanyOS shell is not loaded after authentication');
 if(!companyLoader.includes('company-intelligence-v128.js'))fail.push('adaptive business profile and document intelligence are not loaded after authentication');
 const companyOS=read('companyos-v120.js');
 const companyIntelligence=read('company-intelligence-v128.js');
 const companyOSWorker=read('merchant-backend/worker-v120.js');
 ['/api/v1/companyos/bootstrap','/api/v1/companyos/memory','/api/v1/companyos/situations','/api/v1/companyos/events','/api/v1/companyos/documents'].forEach(route=>{if(!companyOS.includes(route))fail.push(`CompanyOS client is missing real route ${route}`)});
 ['companyos_situations','companyos_relationships','companyos_events','companyos_documents','companyos_work_objects','platform_audit_events','companyos_rate_limits'].forEach(table=>{if(!companyOSWorker.includes(table))fail.push(`CompanyOS schema is missing ${table}`)});
 ["cookie(request,'still_company')",'organization_id=?','sameOrigin(request)','platformAudit','rateLimit'].forEach(boundary=>{if(!companyOSWorker.includes(boundary))fail.push(`CompanyOS security boundary is missing ${boundary}`)});
 if(!companyOSWorker.includes("json_extract(metadata_json,'$.organizationId')")||!companyOSWorker.includes('actor_role'))fail.push('CompanyOS request audit is not compatible with the existing production audit schema');
 if(companyOS.includes('sessionStorage')||companyOS.includes('localStorage'))fail.push('live CompanyOS shell uses browser-only simulated persistence');
 if(!companyOS.includes("if(window.__stillOrganization)mount({organization:window.__stillOrganization})"))fail.push('CompanyOS does not mount when the authenticated loader finishes before the shell runtime');
 ['cos120-dashboard','cos120-attention','cos120-record-rail','cos120-record-main','cos120-side','cos120-object-rail','cos120-dock'].forEach(region=>{if(!companyOS.includes(region))fail.push(`CompanyOS cockpit is missing structural region ${region}`)});
 if(!companyOS.includes('state.notifications.slice(0,5)'))fail.push('CompanyOS activity rail is not derived from live notification data');
 if(!companyOS.includes("detail?.events||[]"))fail.push('CompanyOS object timeline is not derived from attributable events');
 ['repairs','inventory','customer360','warranty'].forEach(tool=>{if(!companyOS.includes(`data-cos-tool="${tool}"`))fail.push(`CompanyOS object workspace is missing integrated ${tool} access`)});
 ['Create warranty claim','Order related parts','Schedule follow-up','Send update to customer'].forEach(action=>{if(!companyOS.includes(action))fail.push(`CompanyOS is missing quick action: ${action}`)});
 if(!companyOS.includes('const toolGroups=')||companyOS.includes('const toolResults='))fail.push('CompanyOS does not expose its complete grouped production tool catalogue');
 if(!companyOS.includes('cos120ToolParking')||!companyOS.includes('parking.append(legacyNode)'))fail.push('CompanyOS tool switching does not preserve mounted production modules');
 if(!companyOS.includes('data-cos-memory-query')||!companyOS.includes('/api/v1/companyos/memory'))fail.push('CompanyOS authorized assistant is not integrated');
 if(!read('companyos-v120.css').includes('.cos120-assistant-prompts button{width:100%'))fail.push('CompanyOS assistant prompt actions collapse at desktop widths');
 if(!companyOS.includes('function conversations()')||!companyOS.includes("item.type==='conversation'")||!companyOS.includes('data-cos-conversations'))fail.push('CompanyOS active conversations are not derived from persisted company records');
 if(!companyOS.includes('function openConversationSearch()')||!companyOS.includes("openCreate(button.dataset.cosCreate)"))fail.push('CompanyOS conversation actions are not connected to real search and creation flows');
 if(!companyOS.includes('function goToday()')||!companyOS.includes("[data-cos-dock=\"today\"]"))fail.push('CompanyOS Today dock action is not connected');
 if(companyOS.includes('cos120-spark'))fail.push('Company Pulse still renders a decorative trend without real trend data');
 if(!companyOS.includes('cos120-healthbar')||!companyOS.includes('pulse.changedAt'))fail.push('Company Pulse does not expose its real health calculation and freshness');
 const companyOSCss=read('companyos-v120.css');
 if(!companyOSCss.includes('.cos120-dock{left:18px;right:18px')||!companyOSCss.includes('.cos120-conversations'))fail.push('CompanyOS responsive dock or conversation rail styling is missing');
 if(!companyOSCss.includes('/* Live visual QA corrections */')||!companyOS.includes("sourceLabel(object.source)"))fail.push('CompanyOS live visual QA corrections are missing');
 if(!companyOSWorker.includes("const buyerFacing=company.organization_status==='verified'")||!companyOSWorker.includes('cases:buyerFacing?Number(cases?.open||0):null')||!companyOSWorker.includes('buyerData:buyerFacing'))fail.push('CompanyOS bootstrap does not preserve the buyer-case verification boundary');
 const companyToolSource=companyOS.match(/const tools=\[([\s\S]*?)\n  \];/)?.[1]||'';
 const companyToolIds=[...companyToolSource.matchAll(/\['([A-Za-z][A-Za-z0-9]*)',t\(/g)].map(match=>match[1]);
 const companyToolGroupSource=companyOS.match(/const toolGroups=\[([\s\S]*?)\n  \];/)?.[1]||'';
 companyToolIds.forEach(id=>{if(!companyToolGroupSource.includes(`'${id}'`))fail.push(`CompanyOS tool is not assigned to a visible group: ${id}`)});
 if(companyToolIds.length<33)fail.push(`CompanyOS tool catalogue is incomplete (${companyToolIds.length}/33)`);
 if(!companyToolIds.includes('documents'))fail.push('CompanyOS document intelligence is not part of the visible tool catalogue');
 ['retail','services','manufacturer','rental','subscription','professional'].forEach(type=>{if(!companyIntelligence.includes(`${type}:`))fail.push(`CompanyOS is missing adaptive priorities for ${type} businesses`)});
 if(!companyIntelligence.includes('/api/v1/business/setup')||!companyIntelligence.includes('REQUIRED BEFORE VERIFICATION'))fail.push('business type is not required and persisted before verification');
 if(!companyIntelligence.includes("if($('#companyOSV120'))return adapt()"))fail.push('adaptive business context does not tolerate authenticated module load order');
 if(!read('company-intelligence-v128.css').includes('input[type=checkbox]{width:16px;height:16px'))fail.push('business profile checkbox controls can stretch when localized labels wrap');
 if(!companyIntelligence.includes('/api/v1/companyos/knowledge/import')||!companyIntelligence.includes('Review before anything is applied.'))fail.push('reviewable document OCR workflow is not integrated');
 if(!companyOSWorker.includes("error:'business_setup_required'")||!companyOSWorker.includes("verificationSubmission"))fail.push('verification submission is not protected by a server-side business setup gate');
 ['companyos_knowledge_documents','env.AI.toMarkdown','MAX_DOCUMENT_BYTES','file_hash','extracted-text-only'].forEach(capability=>{if(!companyOSWorker.includes(capability))fail.push(`document intelligence backend is missing ${capability}`)});
 if(!companyOSWorker.includes("'document_knowledge' kind")||!companyOSWorker.includes('authorized-deterministic-retrieval'))fail.push('extracted document knowledge is not searchable through authorized company memory');
 if(!read('wrangler.jsonc').includes('"binding": "AI"'))fail.push('Workers AI binding is not configured for document OCR');
 if(!companyOS.includes('openUnavailableTool')||!companyOS.includes('state.permissions.buyerFacing'))fail.push('CompanyOS does not explain verification-gated tools in context');
 const workbench=read('company-workbench-v72.js');
 const workbenchWorker=read('merchant-backend/worker-v72.js');
 if(!workbench.includes("document.readyState==='loading'")||!workbench.includes('else shell()'))fail.push('Company workbench cannot mount after authenticated dynamic loading');
 if(!workbench.includes("$('#cos120ToolParking')")||!workbench.includes("still:companyos-ready"))fail.push('Company workbench is not mounted inside the active CompanyOS lifecycle');
 if(!companyOS.includes("new CustomEvent('still:companyos-ready'"))fail.push('CompanyOS does not release dependent production tools after its shell is ready');
 if(!workbench.includes("organizationStatus==='verified'")||!workbench.includes('protectedBuyerData()'))fail.push('Company workbench does not separate private operations from verification-gated buyer data');
 if(!workbenchWorker.includes('buyerData:false')||!workbenchWorker.includes('if(pid&&!verified)')||!workbenchWorker.includes("if(s.organization_status!=='verified')return json({error:'verification_required'},403)"))fail.push('Unverified company operations do not preserve the buyer-data boundary');
 if(!companyOS.includes('authorized-deterministic-retrieval')&&!companyOSWorker.includes('authorized-deterministic-retrieval'))fail.push('Company Memory does not disclose deterministic authorized retrieval');
 if(!read('company-authenticated-loader-v82.js').includes('company-passport-studio-v83.js'))fail.push('company passport studio is missing from authenticated workspace');
 if(!worker.includes("'/api/v1/ownership/connect'"))fail.push('buyer-company passport connection route is missing');
 if(!worker.includes("'/api/v1/business/passports'"))fail.push('business passport route is missing');
 if(!read('legal-i18n.js').includes('not a webshop'))fail.push('mediator role is missing from terms disclosure');
 if(!read('legal-i18n.js').includes('private notes'))fail.push('passport privacy disclosure is missing');
 const ownership=read('ownership-platform-v83.js');
 ['id="decisionFormV83"',"decisionSelect('terms'","decisionSelect('repair'","decisionSelect('support'","decisionSelect('costs'",'data-save-discovery'].forEach(capability=>{if(!ownership.includes(capability))fail.push(`buyer decision capability missing ${capability}`)});
 const ownershipOnboarding=read('ownership-onboarding-v111.js');
 ['data-oo111="manual"','data-oo111="receipt"','data-oo111="upload"','data-oo111="import"','oo111UrlForm',"world.openAdd({ kind: 'product'",'world.openCapture()','world.openDocuments()','world.runMigration(true)'].forEach(capability=>{if(!ownershipOnboarding.includes(capability))fail.push(`ownership onboarding capability missing ${capability}`)});
 if(!ownershipOnboarding.includes("still:language"))fail.push('ownership onboarding is not restored after platform language remount');
 if(ownershipOnboarding.includes('fetch('))fail.push('product URL onboarding performs an external fetch');
 if(ownershipOnboarding.includes('message.innerHTML'))fail.push('receipt discovery reinterprets untrusted text as HTML');
 if(ownershipOnboarding.includes('setTimeout(() => {')&&ownershipOnboarding.includes("heading.textContent = t('Found it.'"))fail.push('ownership onboarding still simulates delayed receipt discovery');
 const ownershipHome=read('ownership-home-v112.js');
 ['still-ownership-passports-v83','returnBy','warrantyUntil','renewalAt','nextActionAt','recently added','still:ownership-updated'].forEach(capability=>{if(!ownershipHome.toLowerCase().includes(capability.toLowerCase()))fail.push(`living ownership home capability missing ${capability}`)});
 if(!ownershipHome.includes("still:language"))fail.push('living ownership home is not restored after platform language remount');
 const ownershipFeed=read('ownership-feed-v113.js');
 ['still-ownership-passports-v83','purchasedOn','returnBy','warrantyUntil','renewalAt','nextActionAt','still:ownership-updated'].forEach(capability=>{if(!ownershipFeed.includes(capability))fail.push(`ownership activity feed capability missing ${capability}`)});
 if(!ownershipFeed.includes("still:language"))fail.push('ownership activity feed is not restored after platform language remount');
 if(!ownership.includes("document.title = 'Still · Everything you own.'"))fail.push('ownership runtime title is not consumer-first');
 const designClarity=read('design-clarity-v84.js');
 if(!designClarity.includes('Still · Everything you own.'))fail.push('late metadata override is not consumer-first');
 if(designClarity.includes('Still? · Decide. Manage. Resolve.'))fail.push('late BuyerOS metadata override restores stale positioning');
 const buyerRewards=read('buyer-rewards-v76.js');
 if(!buyerRewards.includes('data-claim-offer')||!buyerRewards.includes('/rewards/offers/'))fail.push('buyer reward claim action is not connected');
 const companyRewards=read('company-rewards-v75.js');
 ['/api/v1/rewards/business/summary','/api/v1/rewards/business/offers','/api/v1/rewards/business/redeem-code','/api/v1/rewards/business/platform-credit'].forEach(route=>{if(!companyRewards.includes(route))fail.push(`company rewards capability missing ${route}`)});
 if(!read('site-quality-v82.js').includes("t('Next dates', 'Rokovi')"))fail.push('compact responsive buyer navigation is missing');
 if(!read('company-authenticated-loader-v82.js').includes('company-commerce-v92.js'))fail.push('business commerce tools are missing from authenticated workspace');
 if(!commerceWorker.includes("'/api/v1/commerce/offers'"))fail.push('public Passport Offer API is missing');
 if(!commerceWorker.includes("'/api/v1/commerce/requests'"))fail.push('buyer request API is missing');
 if(!commerceWorker.includes("'/api/v1/business/commerce/requests'"))fail.push('verified business request board API is missing');
 if(!commerceWorker.includes('acceptQuote'))fail.push('private quote acceptance flow is missing');
 if(!read('passport-commerce-v92.js').includes('id="pc93RequestForm"')||!read('passport-commerce-v92.js').includes('createRequest(event)'))fail.push('buyer quote request action is missing');
 if(!read('passport-commerce-v92.js').includes('data-pc92-accept-quote'))fail.push('buyer quote comparison and acceptance UI is missing');
 if(!read('company-commerce-v92.js').includes('data-cc93-quote'))fail.push('company quote response form is missing');
 if(!commerceWorker.includes("'/api/v1/commerce/webhooks/stripe'"))fail.push('verified payment webhook is missing');
 if(!commerceWorker.includes('application_fee_amount'))fail.push('direct seller payment platform fee is missing');
 if(!commerceWorker.includes('activateOrder'))fail.push('payment-to-passport activation is missing');
 if(!commerceWorker.includes('demo_confirmation_required'))fail.push('honest demo checkout guard is missing');
 if(!read('legal-i18n.js').includes('Payment and demonstration mode'))fail.push('commerce payment disclosure is missing');
 const cspHeader=read('_headers')
   .split(/\r?\n/)
   .find(line=>line.trimStart().startsWith('Content-Security-Policy:'));
 const stripeOrigin=cspHeader
   ?.slice(cspHeader.indexOf(':')+1)
   .trim()
   .split(/\s+/)
   .some(source=>{
     try{
       const url=new URL(source);
       return url.protocol==='https:'&&url.hostname==='js.stripe.com'&&url.port==='';
     }catch{
       return false;
     }
   });
 if(!stripeOrigin)fail.push('payment provider CSP is missing');
 if(!read('qrcode-generator-v94.js').includes('qrcode'))fail.push('Passport QR generator capability is missing');
 if(!ownership.includes('Passport QR')||!ownership.includes('passportSnapshot'))fail.push('Passport QR buyer interface is missing');
 if(!ownership.includes('/shares')||!ownership.includes('/ownership/verify/'))fail.push('Passport QR verification client routes are missing');
 if(!worker.includes('passport_public_shares')||!worker.includes('verifyPassportShare')||!worker.includes('revokePassportShare'))fail.push('revocable Passport QR server routes are missing');
 if(!read('legal-i18n.js').includes('Passport QR links and portable snapshots'))fail.push('Passport QR privacy disclosure is missing');
 if(!read('company-authenticated-loader-v82.js').includes('company-lifecycle-v95.js'))fail.push('company lifecycle workspace is missing from authenticated workspace');
 ['lifecycle_preferences','promise_templates','passport_service_events','passport_alerts','passport_threads','passport_messages','business_assets'].forEach(table=>{if(!lifecycleWorker.includes(table))fail.push(`lifecycle schema missing ${table}`)});
 ['/api/v1/lifecycle/dashboard','/api/v1/lifecycle/actions','/history','/support','/templates','/alerts','/assets'].forEach(route=>{if(!lifecycleWorker.includes(route))fail.push(`lifecycle route missing ${route}`)});
 if(!read('lifecycle-platform-v95.js').includes('Calculate true cost')||!read('lifecycle-platform-v95.js').includes('REPAIR READINESS'))fail.push('total cost and repairability tool is missing');
 if(!read('company-lifecycle-v95.js').includes('Outcome reputation')||!read('company-lifecycle-v95.js').includes('B2B PASSPORT'))fail.push('company reputation or B2B passport UI is missing');
 if(!read('company-authenticated-loader-v82.js').includes('company-operations-v96.js'))fail.push('company operations are missing from authenticated workspace');
 ['ops_products','ops_stock_movements','ops_purchase_orders','ops_repair_jobs','ops_rmas','ops_reservations','ops_agreements','ops_appointments','ops_crm_contacts','ops_quotes','ops_recall_campaigns','ops_audit_log'].forEach(table=>{if(!operationsWorker.includes(table))fail.push(`operations schema missing ${table}`)});
 ['/api/v1/business/ops/dashboard','/stock/adjust','/purchase-orders','/repairs','/returns','/reservations','/agreements','/appointments','/quotes','/recalls'].forEach(route=>{if(!operationsWorker.includes(route))fail.push(`operations route missing ${route}`)});
 if(!read('company-operations-v96.js').includes('Automatic reorder queue')||!read('company-operations-v96.js').includes('Batch and serial recall center'))fail.push('operations UI is missing reorder or recall workflows');
 const productionManifest=JSON.parse(read('public/build.json'));
 ['company-preview-v97.js','company-demo-v102.js','company-unified-workspace-v109.js','company-progressive-access-v108.js','company-capabilities-v1.js'].forEach(file=>{if((productionManifest.files||[]).includes(file)||(productionManifest.companyScripts||[]).includes(file)||(productionManifest.companyFeatureScripts||[]).includes(file))fail.push(`retired demo runtime is still shipped: ${file}`)});
 if((companyOS.match(/\['[^']+',t\(/g)||[]).length<29)fail.push('CompanyOS command palette does not expose the complete production capability set');
 if(!companyLoader.includes('meta[name="still-build"]')||!companyLoader.includes('searchParams.get(\'v\')'))fail.push('authenticated company features do not derive the active build version');
 if(!read('company-authenticated-loader-v82.js').includes('company-control-center-v101.js'))fail.push('advanced company controls are missing from authenticated workspace');
 const controlCenter=read('company-control-center-v101.js');
 ['/milestones','/changes','/completion-events','/evidence-requirements','/ops/capacity','/customers/','/ops/playbooks','/followup-rules','/supplier-claims'].forEach(route=>{if(!controlCenter.includes(route))fail.push(`advanced company control center is missing ${route}`)});
 if(!relationshipWorker.includes('PROFILE_MEDIA')||!relationshipWorker.includes('profileMediaUploads'))fail.push('protected profile-media capability detection is missing');
 ['/api/v1/buyer-profile','/api/v1/business-profile','/api/v1/buyer-dashboard','/api/v1/business-dashboard','/api/v1/profile-media/'].forEach(route=>{if(!relationshipWorker.includes(route))fail.push(`relationship identity API is missing ${route}`)});
 if(!relationshipWorker.includes('share_with_connected_businesses')||!relationshipWorker.includes('buyerRelatedToCompany'))fail.push('buyer profile visibility is not relationship-gated');
 if(!relationshipWorker.includes("hasLogo=Object.prototype.hasOwnProperty.call(body,'logoUrl')"))fail.push('company profile lacks a production logo URL fallback');
 if(!relationshipWorker.includes('/api/v1/profile-media/company-logo/')||!relationshipWorker.includes('safeLogoUrl'))fail.push('remote company logos are not privacy-proxied and SSRF-filtered');
 if(!read('ownership-platform-v83.js').includes("qrcode(0, 'H')")||!read('ownership-platform-v83.js').includes('op103-qr-brand'))fail.push('branded high-resilience Passport QR rendering is missing');
 if(!read('company-passport-studio-v83.js').includes('buyerProfile'))fail.push('company passport studio does not show connected buyer profiles');
 ['buyer_contact_profiles','organization_contact_profiles','commerce_order_parties','contact_required','buyer_json','seller_json'].forEach(capability=>{if(!contactWorker.includes(capability))fail.push(`complete order-party contact layer is missing ${capability}`)});
 if(!read('passport-commerce-v92.js').includes('checkoutContactFields')||!read('passport-commerce-v92.js').includes('buyerName'))fail.push('buyer checkout does not collect fulfilment contact details');
 if(!read('company-commerce-v92.js').includes('decorateOrderContacts'))fail.push('company orders do not show immutable buyer contact snapshots');
 ['organization_setup_profiles','/api/v1/business/setup','organization_status','sameOrigin','owner','manager'].forEach(capability=>{if(!setupWorker.includes(capability))fail.push(`pre-verification setup API is missing ${capability}`)});
 if(!companyOS.includes("state.organization.status")||!companyOS.includes("state.member.role"))fail.push('CompanyOS does not show authenticated organization and role context');
 if(!read('legal-i18n.js').includes('Pre-verification company setup'))fail.push('pre-verification setup privacy disclosure is missing');
 ['esl_connectors','esl_labels','esl_price_updates','/api/v1/business/esl','verification_required','bluetoothEslProfile','adapterPayload'].forEach(capability=>{if(!eslWorker.includes(capability))fail.push(`electronic shelf-label API is missing ${capability}`)});
 const eslStudio=read('electronic-shelf-labels-v106.js');
 ['1.54','2.13','2.90','4.20','5.80','7.50','10.20','lcd_wide','custom','widthMm','widthPx','Bluetooth ESL Profile 1.0','GS1 Digital Link','exportSvg','exportPng','exportJson','exportCsv','sessionStorage'].forEach(capability=>{if(!eslStudio.includes(capability))fail.push(`electronic shelf-label studio is missing ${capability}`)});
 if(!eslStudio.includes('vendor adapter required')||!eslWorker.includes('vendor_credentials_and_gateway_required'))fail.push('electronic shelf-label vendor boundary is not disclosed');
 if(!read('legal-i18n.js').includes('Electronic shelf labels and price updates'))fail.push('electronic shelf-label privacy disclosure is missing');
 if(!read('legal-i18n.js').includes('Lifecycle history, alerts and support'))fail.push('lifecycle privacy disclosure is missing');
 const publicExperience=read('still-public-v114.js');
 ['Everything you own.','One trusted place.','Your things are only the beginning.','Know what matters now','Build your private World','Turn proof into understanding','Pass a Thing on with context','Work with businesses intentionally','Bring your things into Still.','Meet the Passport.','PRIVATE BY CHOICE','STILL FOR BUSINESS · EARLY ACCESS','data-still-start'].forEach(capability=>{if(!publicExperience.includes(capability))fail.push(`consumer-first public experience is missing ${capability}`)});
 ['/app/world','/app/market','/app/together','data-still-destination'].forEach(capability=>{if(!publicExperience.includes(capability))fail.push(`current Still introduction is not connected to ${capability}`)});
 if(!publicExperience.includes('Still does not invent a provider, price, deadline, company update or transaction.'))fail.push('current Still introduction does not disclose its truthful data boundary');
 if(!publicExperience.includes('enterStill()')||!publicExperience.includes("location.assign(destination)"))fail.push('Start free is not connected to the authenticated Still OS');
 if(!publicExperience.includes("enterStill('/app?sight=receipt')"))fail.push('receipt CTA does not enter the canonical Still Sight receipt flow');
 if(publicExperience.includes('stillAccountMountV114')||publicExperience.includes('data-still-tool'))fail.push('private account or legacy tool controls are mounted in the public landing story');
 if(!publicExperience.includes("auth.classList.add('sp114-auth-stage')")||!read('still-v114.css').includes('sp114-auth-stage'))fail.push('buyer sign-in is not an anchored top-level landing stage');
 if(!publicExperience.includes('quarantineLegacyPublicModules()')||!publicExperience.includes("element.style.setProperty('display', 'none', 'important')"))fail.push('late legacy buyer modules can reappear inside the public landing page');
 if(!read('still-v114.css').includes('#relationshipDashboardV103'))fail.push('authenticated relationship dashboard can leak into the public hierarchy');
 if(!read('still-os-v133.js').includes('/api/v1/buyer-profile')||!read('still-os-v133.js').includes('/api/v1/buyer-profile/photo'))fail.push('authenticated Still profile management is incomplete');
 if(!read('still-os-v133.js').includes('/api/v1/buyer-auth/logout')||!read('still-os-v133.js').includes('recentPassports'))fail.push('authenticated Still account overview or logout is incomplete');
 if(!read('still-v114.css').includes('[data-theme="light"]'))fail.push('explicit light theme does not override a dark system preference');
 if(!publicExperience.includes("t('PLANNED', 'PLANIRANO')")||!publicExperience.includes('Still+'))fail.push('planned premium consumer capabilities are not clearly labelled');
 const worldFoundation=read('world-foundation-v131.js');
 const worldWorker=read('merchant-backend/worker-v131.js');
 ['/api/v1/world/bootstrap','/api/v1/world/things','/api/v1/world/receipts/capture','/api/v1/world/knowledge','/api/v1/world/situations','/api/v1/world/open-loops'].forEach(route=>{if(!worldFoundation.includes(route))fail.push(`World Foundation client capability missing ${route}`)});
 ['world_thing_profiles','world_receipts','world_receipt_items','world_evidence','world_history_events','world_knowledge_items','world_situations','world_open_loops','world_relationships','world_migrations'].forEach(table=>{if(!worldWorker.includes(table))fail.push(`World Foundation schema missing ${table}`)});
 if(!worldWorker.includes("cookie(request, 'still_buyer')")||!worldWorker.includes("error: 'unauthorized'"))fail.push('World Foundation does not enforce buyer authentication');
 if(!worldWorker.includes('env.WORLD_FILES.put')||!worldWorker.includes('env.AI.toMarkdown'))fail.push('World receipt OCR is not connected to private storage and Workers AI');
 if(!read('wrangler.jsonc').includes('"binding": "WORLD_FILES"'))fail.push('World private R2 binding is missing');
 const businessExperience=read('still-business-v114.js');
 ['OPERATE','SELL','SERVE','TRUST','GROW','Request Early Access','still:company-authenticated'].forEach(capability=>{if(!businessExperience.includes(capability))fail.push(`Still for Business public experience is missing ${capability}`)});
 if(!read('pricing-v114.js').includes('Still Free')||!read('pricing-v114.js').includes('Still+')||!read('pricing-v114.js').includes('Still for Business'))fail.push('pricing hierarchy is incomplete');
 if(!read('sitemap.xml').includes('/pricing.html'))fail.push('pricing page is missing from sitemap');
}

// BuyerOS Product Passport V138
{
  const passportPath='buyer/protection/ui/buyeros-passport-v138.js';
  const coordinatorPath='buyer/protection/ui/BuyerOSCoordinator.js';

  if(!fs.existsSync(passportPath)){
    fail.push('BuyerOS V138 Product Passport module is missing');
  }

  const passport=read(passportPath);

  [
    'Product identity',
    'Protection summary',
    'Passport completion',
    'Passport documents',
    'Related in your Still',
    'Print / Save PDF'
  ].forEach(x=>{
    if(!passport.includes(x))
      fail.push(`Missing ${x}`);
  });

  const coordinator=read(coordinatorPath);

  if(!coordinator.includes('buyeros-passport-v138.js')){
    fail.push('Coordinator does not load V138');
  }
}


// BuyerOS Universal Search V139
{
  const searchPath =
    'buyer/protection/ui/buyeros-search-v139.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(searchPath)) {
    fail.push(
      'BuyerOS Universal Search V139 module is missing'
    );
  } else {
    const search =
      read(searchPath);

    [
      'scoreItem',
      'searchableText',
      'thingDocs',
      'serviceHistory',
      'data-v139-index',
      'still:ownership-updated',
      '#buyeros-thing',
      'metaKey',
      'ctrlKey'
    ].forEach(capability => {
      if (
        !search.includes(capability)
      ) {
        fail.push(
          `BuyerOS V139 search missing ${capability}`
        );
      }
    });
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-search-v139.js'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Universal Search V139'
    );
  }
}


// BuyerOS Documents V140
{
  const modulePath =
    'buyer/protection/ui/buyeros-documents-v140.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push(
      'BuyerOS Documents V140 module is missing'
    );
  } else {
    const module =
      read(modulePath);

    [
      'relatedThing',
      'linkedDocuments',
      'documentType',
      'documentStats',
      'data-v140-open-thing',
      'Needs linking',
      '#buyeros-documents',
      '#buyeros-thing',
      'still:ownership-updated'
    ].forEach(capability => {
      if (
        !module.includes(
          capability
        )
      ) {
        fail.push(
          `BuyerOS Documents V140 missing ${capability}`
        );
      }
    });

    if (
      module.includes(
        'Math.random'
      )
    ) {
      fail.push(
        'BuyerOS Documents V140 fabricates random data'
      );
    }
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-documents-v140.js'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Documents V140'
    );
  }
}


// BuyerOS Attention Center V141
{
  const modulePath =
    'buyer/protection/ui/buyeros-attention-v141.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push(
      'BuyerOS Attention Center V141 module is missing'
    );
  } else {
    const module =
      read(modulePath);

    [
      'buildIssues',
      'daysUntil',
      'hasReceipt',
      'hasWarrantyDocument',
      'Document needs linking',
      'Warranty ending soon',
      'Return window closing',
      'Renewal approaching',
      'data-v141-index',
      'still:ownership-updated'
    ].forEach(capability => {
      if (
        !module.includes(capability)
      ) {
        fail.push(
          `BuyerOS Attention V141 missing ${capability}`
        );
      }
    });

    if (
      module.includes(
        'Math.random'
      )
    ) {
      fail.push(
        'BuyerOS Attention V141 fabricates random information'
      );
    }
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-attention-v141.js'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Attention Center V141'
    );
  }
}


// BuyerOS Timeline V142
{
  const modulePath =
    'buyer/protection/ui/buyeros-timeline-v142.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push(
      'BuyerOS Timeline V142 module is missing'
    );
  } else {
    const module =
      read(modulePath);

    [
      'buildTimeline',
      'groupByMonth',
      'Purchased',
      'Warranty ends',
      'Return window ends',
      'Renewal',
      'Service event',
      'Document added',
      'data-v142-thing',
      '#buyeros-timeline',
      '#buyeros-thing',
      'still:ownership-updated'
    ].forEach(capability => {
      if (
        !module.includes(
          capability
        )
      ) {
        fail.push(
          `BuyerOS Timeline V142 missing ${capability}`
        );
      }
    });

    if (
      module.includes(
        'Math.random'
      )
    ) {
      fail.push(
        'BuyerOS Timeline V142 fabricates random timeline data'
      );
    }
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-timeline-v142.js'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Timeline V142'
    );
  }
}


// BuyerOS Services V143
{
  const modulePath =
    'buyer/protection/ui/buyeros-services-v143.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push(
      'BuyerOS Services V143 module is missing'
    );
  } else {
    const module =
      read(modulePath);

    [
      'serviceHistory',
      'ongoingServices',
      'providerName',
      'occurredOn',
      'isPublic',
      'typeInfo',
      'groupedHistory',
      'data-v143-thing',
      '#buyeros-services',
      '#buyeros-thing',
      'still:ownership-updated'
    ].forEach(capability => {
      if (
        !module.includes(
          capability
        )
      ) {
        fail.push(
          `BuyerOS Services V143 missing ${capability}`
        );
      }
    });

    if (
      module.includes(
        'Math.random'
      )
    ) {
      fail.push(
        'BuyerOS Services V143 fabricates random service data'
      );
    }
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-services-v143.js'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Services V143'
    );
  }
}



// BuyerOS Intelligence V148
{
  const modulePath = 'buyer/protection/ui/buyeros-intelligence-v148.js';
  const coordinatorPath = 'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push('BuyerOS Intelligence V148 module is missing');
  } else {
    const module = read(modulePath);

    [
      'interpret',
      'findThings',
      'attentionItems',
      'serviceEvents',
      'docsFor',
      'What is expiring soon?',
      'Which things have no warranty?',
      'How many things do I have?'
    ].forEach(capability => {
      if (!module.includes(capability)) {
        fail.push(`BuyerOS Intelligence V148 missing ${capability}`);
      }
    });
  }

  const coordinator = read(coordinatorPath);

  if (!coordinator.includes('buyeros-intelligence-v148.js')) {
    fail.push('BuyerOS Coordinator does not load Intelligence V148');
  }
}

// BuyerOS Household Family V144
{
  const modulePath =
    'buyer/protection/ui/buyeros-household-family-v144.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push(
      'BuyerOS Household Family V144 module is missing'
    );
  } else {
    const module =
      read(modulePath);

    [
      'HOUSEHOLD_KEY',
      'FAMILY_KEY',
      'thingsForMember',
      'householdThings',
      'itemMatchesMember',
      'createFamilyView',
      'createHouseholdView',
      '#buyeros-household',
      '#buyeros-family',
      '#buyeros-thing',
      'still:ownership-updated'
    ].forEach(capability => {
      if (
        !module.includes(
          capability
        )
      ) {
        fail.push(
          `BuyerOS Household Family V144 missing ${capability}`
        );
      }
    });

    if (
      module.includes(
        'Math.random'
      )
    ) {
      fail.push(
        'BuyerOS Household Family V144 fabricates random data'
      );
    }
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-household-family-v144.js'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Household Family V144'
    );
  }
}


// BuyerOS Ownership Import V145
{
  const modulePath =
    'buyer/protection/ui/buyeros-import-v145.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push(
      'BuyerOS Ownership Import V145 module is missing'
    );
  } else {
    const module =
      read(modulePath);

    [
      'still-ownership-passports-v83',
      'readThings',
      'writeThings',
      'formRecord',
      'data-bos132-add="thing"',
      'purchaseDate',
      'warrantyUntil',
      'returnBy',
      'renewalAt',
      'serviceHistory',
      'still:ownership-updated',
      'Save & add another'
    ].forEach(capability => {
      if (
        !module.includes(
          capability
        )
      ) {
        fail.push(
          `BuyerOS Ownership Import V145 missing ${capability}`
        );
      }
    });

    if (
      module.includes(
        'Math.random'
      )
    ) {
      fail.push(
        'BuyerOS Ownership Import V145 fabricates random ownership data'
      );
    }
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-import-v145.js'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Ownership Import V145'
    );
  }
}

// BuyerOS Bulk Import V146
{
  const modulePath = 'buyer/protection/ui/buyeros-bulk-import-v146.js';
  const coordinatorPath = 'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push('BuyerOS Bulk Import V146 module is missing');
  } else {
    const module = read(modulePath);

    [
      'still-ownership-passports-v83',
      'parseInput',
      'tableMode',
      'simpleLineMode',
      'splitCSVLine',
      'buildRecord',
      'Import into Still',
      'Bulk import',
      'still:ownership-updated',
      'purchaseDate',
      'warrantyUntil',
      'serialNumber'
    ].forEach(capability => {
      if (!module.includes(capability)) {
        fail.push(`BuyerOS Bulk Import V146 missing ${capability}`);
      }
    });

    if (module.includes('Math.random')) {
      fail.push('BuyerOS Bulk Import V146 fabricates random ownership data');
    }
  }

  const coordinator = read(coordinatorPath);

  if (!coordinator.includes('buyeros-bulk-import-v146.js')) {
    fail.push('BuyerOS Coordinator does not load Bulk Import V146');
  }
}

// BuyerOS Import Review V147
{
  const modulePath = 'buyer/protection/ui/buyeros-import-review-v147.js';
  const coordinatorPath = 'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(modulePath)) {
    fail.push('BuyerOS Import Review V147 module is missing');
  } else {
    const module = read(modulePath);

    [
      'analyse',
      'compare',
      'Same serial number',
      'Same brand and model',
      'Possible duplicates found',
      'Import anyway',
      'data-v146-import',
      'still-ownership-passports-v83'
    ].forEach(capability => {
      if (!module.includes(capability)) {
        fail.push(`BuyerOS Import Review V147 missing ${capability}`);
      }
    });

    if (module.includes('Math.random')) {
      fail.push('BuyerOS Import Review V147 fabricates random matching data');
    }
  }

  const coordinator = read(coordinatorPath);

  if (!coordinator.includes('buyeros-import-review-v147.js')) {
    fail.push('BuyerOS Coordinator does not load Import Review V147');
  }
}


// BuyerOS Intelligence Tool Bridge V150
{
  const intelligencePath =
    'buyer/protection/ui/buyeros-intelligence-v148.js';

  const toolsPath =
    'buyer/protection/ui/buyeros-tools-v149.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  const intelligence =
    read(intelligencePath);

  const tools =
    read(toolsPath);

  const coordinator =
    read(coordinatorPath);

  [
    'StillBuyerOSToolsV149',
    'executeTool',
    "'list_things'",
    "'search_things'",
    "'count_things'",
    "'get_documents'",
    "'get_service_history'",
    "'get_attention'"
  ].forEach(capability => {
    if (
      !intelligence.includes(
        capability
      )
    ) {
      fail.push(
        `BuyerOS V150 Intelligence bridge missing ${capability}`
      );
    }
  });

  [
    'localStorage',
    'sessionStorage',
    'OWNERSHIP_KEY',
    'DOCUMENTS_KEY'
  ].forEach(forbidden => {
    if (
      intelligence.includes(
        forbidden
      )
    ) {
      fail.push(
        `BuyerOS V150 Intelligence still accesses ${forbidden}`
      );
    }
  });

  if (
    !tools.includes(
      "'list_things'"
    )
  ) {
    fail.push(
      'BuyerOS V149 is missing list_things required by V150'
    );
  }

  const toolsLoad =
    coordinator.indexOf(
      'loadToolsV149()'
    );

  const intelligenceLoad =
    coordinator.indexOf(
      'loadIntelligenceV148()'
    );

  if (
    toolsLoad < 0 ||
    intelligenceLoad < 0 ||
    toolsLoad >
      intelligenceLoad
  ) {
    fail.push(
      'BuyerOS V150 must load Tools before Intelligence'
    );
  }
}



// BuyerOS Actions V151
{
  const actionPath =
    'buyer/protection/ui/buyeros-actions-v151.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(actionPath)) {
    fail.push(
      'BuyerOS Actions V151 module missing'
    );
  } else {
    const source =
      read(actionPath);

    [
      'StillBuyerOSActionsV151',
      "'update_thing'",
      "'add_service'",
      "'link_document'",
      "'delete_thing'",
      'confirmationToken',
      'CONFIRMATION_REQUIRED',
      'auditLog',
      'still:buyeros-actions-ready'
    ].forEach(capability => {
      if (
        !source.includes(capability)
      ) {
        fail.push(
          `BuyerOS Actions V151 missing ${capability}`
        );
      }
    });
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-actions-v151.js'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Actions V151'
    );
  }
}



// BuyerOS Ownership Graph V152
{
  const graphPath =
    'buyer/protection/ui/buyeros-ownership-graph-v152.js';

  const toolsPath =
    'buyer/protection/ui/buyeros-tools-v149.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(graphPath)) {
    fail.push(
      'BuyerOS Ownership Graph V152 module missing'
    );
  } else {
    const graph = read(graphPath);

    [
      'StillBuyerOSGraphV152',
      'resolveThingForDocument',
      'resolveOwnerForThing',
      'resolveHouseholdForThing',
      'canonicalThing',
      'canonicalDocument',
      'graphForThing',
      'still:buyeros-graph-ready'
    ].forEach(capability => {
      if (!graph.includes(capability)) {
        fail.push(
          `BuyerOS V152 Graph missing ${capability}`
        );
      }
    });

    [
      'localStorage.setItem',
      'sessionStorage.setItem',
      'fetch(',
      'XMLHttpRequest',
      'MutationObserver'
    ].forEach(forbidden => {
      if (graph.includes(forbidden)) {
        fail.push(
          `BuyerOS V152 Graph contains forbidden ${forbidden}`
        );
      }
    });
  }

  const tools = read(toolsPath);

  if (
    !tools.includes(
      'StillBuyerOSGraphV152'
    ) ||
    !tools.includes(
      'resolveThingForDocument'
    )
  ) {
    fail.push(
      'BuyerOS V149 tools are not connected to V152 graph'
    );
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-ownership-graph-v152.js'
    ) ||
    !coordinator.includes(
      'loadGraphV152();'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Graph V152'
    );
  }
}



// BuyerOS Protection V153
{
  const protectionPath =
    'buyer/protection/ui/buyeros-protection-v153.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(protectionPath)) {
    fail.push(
      'BuyerOS Protection V153 module missing'
    );
  } else {
    const protection =
      read(protectionPath);

    [
      'StillBuyerOSProtectionV153',
      'overview',
      'attention',
      'documents',
      'serviceHistory',
      'timeline',
      'thingGraph',
      'protectionPriority',
      'protectionKind',
      'still:buyeros-protection-ready'
    ].forEach(capability => {
      if (!protection.includes(capability)) {
        fail.push(
          `BuyerOS Protection V153 missing ${capability}`
        );
      }
    });

    [
      'localStorage.setItem',
      'sessionStorage.setItem',
      'fetch(',
      'XMLHttpRequest',
      'MutationObserver'
    ].forEach(forbidden => {
      if (protection.includes(forbidden)) {
        fail.push(
          `BuyerOS Protection V153 contains forbidden ${forbidden}`
        );
      }
    });
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-protection-v153.js'
    ) ||
    !coordinator.includes(
      'loadProtectionV153();'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Protection V153'
    );
  }
}



// BuyerOS Unified Onboarding V154
{
  const onboardingPath =
    'buyer/protection/ui/buyeros-onboarding-v154.js';

  const coordinatorPath =
    'buyer/protection/ui/BuyerOSCoordinator.js';

  if (!fs.existsSync(onboardingPath)) {
    fail.push(
      'BuyerOS Unified Onboarding V154 module missing'
    );
  } else {
    const source =
      read(onboardingPath);

    [
      'StillBuyerOSOnboardingV154',
      'Bring into Still',
      "'single'",
      "'document'",
      "'import'",
      'data-v154-launch',
      'data-v154-method',
      'data-bos132-add="thing"',
      'data-bos132-add="document"',
      'data-v146-launch',
      'still:buyeros-onboarding-selection'
    ].forEach(capability => {
      if (
        !source.includes(
          capability
        )
      ) {
        fail.push(
          `BuyerOS V154 missing ${capability}`
        );
      }
    });

    if (
      source.includes('localStorage.setItem') ||
      source.includes('sessionStorage.setItem') ||
      source.includes('fetch(') ||
      source.includes('XMLHttpRequest') ||
      source.includes('MutationObserver') ||
      source.includes('Math.random')
    ) {
      fail.push(
        'BuyerOS V154 owns forbidden storage/network/observer authority'
      );
    }
  }

  const coordinator =
    read(coordinatorPath);

  if (
    !coordinator.includes(
      'buyeros-onboarding-v154.js'
    ) ||
    !coordinator.includes(
      'loadOnboardingV154();'
    )
  ) {
    fail.push(
      'BuyerOS Coordinator does not load Onboarding V154'
    );
  }
}


if(fail.length){console.error('Still? smoke tests FAILED\n- '+fail.join('\n- '));process.exit(1)}
console.log('Still? smoke tests passed');
