const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const persistPath = fs.mkdtempSync(path.join(os.tmpdir(), 'still-world-integration-'));
const wranglerBinary = process.env.WRANGLER_BIN || 'npx';
const wrangler = process.env.WRANGLER_BIN ? [] : ['--yes', 'wrangler@4.118.0'];
const environment = { ...process.env, WRANGLER_LOG_PATH: path.join(persistPath, 'wrangler.log') };

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: environment, stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let output = '';
    if (options.capture) {
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { output += chunk; });
    }
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${output}`)));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function seed() {
  const files = ['merchant-backend/schema.sql', 'merchant-backend/schema-v83.sql', 'merchant-backend/schema-v95.sql', 'merchant-backend/schema-v131.sql', 'merchant-backend/schema-v134.sql', 'merchant-backend/schema-v135.sql', 'tests/world/seed.sql'];
  for (const file of files) await run(wranglerBinary, [...wrangler, 'd1', 'execute', 'still-production', '--local', '--persist-to', persistPath, '--file', file], { capture: true });
}

async function startServer(port) {
  const child = spawn(wranglerBinary, [...wrangler, 'dev', '--local', '--port', String(port), '--persist-to', persistPath], { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Wrangler did not become ready.\n${output}`)), 30000);
    const onData = chunk => {
      output += chunk;
      if (/Ready on http:\/\/localhost:/.test(output)) { clearTimeout(timeout); resolve(); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', code => { clearTimeout(timeout); reject(new Error(`Wrangler exited before tests (${code}).\n${output}`)); });
    child.on('error', reject);
  });
  await ready;
  return child;
}

(async () => {
  let server;
  try {
    await seed();
    const port = await freePort();
    server = await startServer(port);
    await run(process.execPath, ['scripts/world-foundation-integration-test.js', `http://127.0.0.1:${port}`]);
  } finally {
    if (server && !server.killed) server.kill('SIGINT');
    fs.rmSync(persistPath, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
