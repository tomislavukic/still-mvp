const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'still-worker-sqlite-'));
const database = path.join(temporary, 'still.db');
const files = ['merchant-backend/schema.sql', 'merchant-backend/schema-v83.sql', 'merchant-backend/schema-v95.sql', 'merchant-backend/schema-v131.sql', 'merchant-backend/schema-v134.sql', 'merchant-backend/schema-v135.sql', 'merchant-backend/schema-v136.sql', 'merchant-backend/schema-v137.sql', 'merchant-backend/schema-v138.sql', 'merchant-backend/schema-v139.sql', 'tests/world/seed.sql'];

function quote(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function interpolate(sql, values) {
  let index = 0, output = '', single = false;
  for (let cursor = 0; cursor < sql.length; cursor += 1) {
    const char = sql[cursor];
    if (char === "'") {
      if (single && sql[cursor + 1] === "'") { output += "''"; cursor += 1; continue; }
      single = !single;
    }
    if (char === '?' && !single) output += quote(values[index++]); else output += char;
  }
  if (index !== values.length) throw new Error(`SQLite adapter bind mismatch: ${index} placeholders, ${values.length} values\n${sql}`);
  return output;
}

function sqlite(sql, values = [], changes = false) {
  const statement = interpolate(sql, values);
  const input = `.mode json\n${statement.replace(/;\s*$/, '')};${changes ? '\nSELECT changes() AS changes;' : ''}\n`;
  const output = execFileSync('sqlite3', [database], { input, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim();
  if (!output) return [];
  const chunks = output.split(/\n(?=\[)/).map(value => JSON.parse(value));
  return changes ? chunks.at(-1) || [] : chunks[0] || [];
}

class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  async first(column) { const row = sqlite(this.sql, this.values)[0] || null; return column ? row?.[column] ?? null : row; }
  async all() { return { success: true, results: sqlite(this.sql, this.values) }; }
  async run() { const rows = sqlite(this.sql, this.values, true); return { success: true, meta: { changes: Number(rows[0]?.changes || 0) } }; }
}

class Database {
  prepare(sql) { return new Statement(sql); }
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(/^\s*(SELECT|WITH|PRAGMA)\b/i.test(statement.sql) ? await statement.all() : await statement.run());
    return results;
  }
}

class PrivateFiles {
  constructor() { this.files = new Map([['test/fixture.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9])]]); }
  async put(key, value) { this.files.set(key, new Uint8Array(await new Response(value).arrayBuffer())); }
  async get(key) {
    const data = this.files.get(key);
    if (!data) return null;
    return { body: data, size: data.byteLength, httpMetadata: { contentType: 'image/jpeg' }, async arrayBuffer() { return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength); } };
  }
  async delete(key) { this.files.delete(key); }
}

function seed() {
  const input = files.map(file => `.read ${path.join(root, file)}`).join('\n');
  execFileSync('sqlite3', [database], { input, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function assetResponse(request) {
  const pathname = new URL(request.url).pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const target = path.join(root, 'public', relative);
  if (!target.startsWith(path.join(root, 'public')) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return new Response('Not found', { status: 404 });
  const type = target.endsWith('.html') ? 'text/html; charset=utf-8' : target.endsWith('.js') ? 'text/javascript; charset=utf-8' : target.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream';
  return new Response(fs.readFileSync(target), { headers: { 'content-type': type } });
}

async function main() {
  seed();
  const worker = (await import(path.join(root, 'merchant-backend/worker-v139.js'))).default;
  const env = {
    DB: new Database(),
    WORLD_FILES: new PrivateFiles(),
    ASSETS: { fetch: assetResponse },
    AI: {
      async toMarkdown(file) {
        if (String(file?.name || '').startsWith('receipt-')) throw new Error('Receipt OCR provider unavailable in deterministic integration test');
        return { format: 'text', data: `Extracted text from ${String(file?.name || 'uploaded document')}` };
      },
      async run() { throw new Error('Generative AI unavailable in deterministic integration test'); }
    }
  };
  const origin = 'http://still.local';
  global.fetch = async (input, init) => worker.fetch(input instanceof Request ? input : new Request(input, init), env, { waitUntil() {}, passThroughOnException() {} });
  process.argv[2] = origin;
  if (!process.env.SERVICE_ONLY && !process.env.COMPANY_NETWORK_ONLY) {
    await require('./world-foundation-integration-test.js');
    await require('./professional-network-integration-test.js');
  }
  if (!process.env.COMPANY_NETWORK_ONLY) await require('./service-network-integration-test.js');
  if (!process.env.SERVICE_ONLY) await require('./company-network-integration-test.js');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(() => fs.rmSync(temporary, { recursive: true, force: true }));
