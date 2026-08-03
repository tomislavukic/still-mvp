const fs = require('fs');
const path = require('path');

const workflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'codeql.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const failures = [];

for (const trigger of ['push:', 'pull_request:', 'workflow_dispatch:', 'schedule:']) {
  if (!workflow.includes(trigger)) failures.push(`missing trigger ${trigger.slice(0, -1)}`);
}

if (!/cron:\s*["'][^"']+["']/.test(workflow)) failures.push('missing weekly cron schedule');
if (!/languages:\s*javascript-typescript/.test(workflow)) failures.push('JavaScript language is not configured');
if (!/security-events:\s*write/.test(workflow)) failures.push('security-events write permission is missing');

const actionReferences = [...workflow.matchAll(/github\/codeql-action\/(init|analyze)@([0-9a-f]{40})/g)];
if (actionReferences.length !== 2) {
  failures.push('expected exactly one pinned CodeQL init and analyze action');
} else if (actionReferences[0][2] !== actionReferences[1][2]) {
  failures.push('CodeQL init and analyze actions use different commits');
}

if (failures.length) {
  console.error(`CodeQL configuration validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`CodeQL configuration validation passed (${actionReferences[0][2]}).`);
