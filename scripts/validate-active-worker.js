const { activeWorkerChain } = require('./worker-chain');

const chain = activeWorkerChain();
const source = chain.map(worker => worker.source).join('\n');
const requiredCapabilities = [
  'platform_audit_events',
  '/api/v1/companyos/bootstrap',
  '/api/v1/companyos/search',
  '/api/v1/companyos/memory',
  '/api/v1/companyos/audit',
  'companyos_situations',
  'companyos_relationships',
  'companyos_events',
  'companyos_documents',
  'companyos_work_objects',
  "cookie(request,'still_company')",
  'organization_id=?',
  'sameOrigin(request)',
  'platformAudit',
  'rateLimit',
  "json_extract(metadata_json,'$.organizationId')",
  "outcome=status>=500?'error':status>=400?'denied':'success'",
];

for (const capability of requiredCapabilities) {
  if (!source.includes(capability)) throw new Error(`Missing capability ${capability}`);
}

console.log(`Validated active Worker ${chain[0].relativePath} (${chain.length} files in delegation chain)`);
