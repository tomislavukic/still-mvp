const { activeWorkerChain } = require('./worker-chain');

const chain = activeWorkerChain();
const source = chain.map(worker => worker.source).join('\n');
const requiredCapabilities = [
  'platform_audit_events',
  'OPERATIONS_REVIEWER_TOKEN',
  'OPERATIONS_SUPPORT_TOKEN',
  'OPERATIONS_READONLY_TOKEN',
  '/api/v1/admin/audit',
  'request.complete',
];

for (const capability of requiredCapabilities) {
  if (!source.includes(capability)) throw new Error(`Missing capability ${capability}`);
}

console.log(`Validated active Worker ${chain[0].relativePath} (${chain.length} files in delegation chain)`);
