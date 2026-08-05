'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REQUIRED_CAPABILITIES = [
  'platform_audit_events',
  'OPERATIONS_REVIEWER_TOKEN',
  'OPERATIONS_SUPPORT_TOKEN',
  'OPERATIONS_READONLY_TOKEN',
  '/api/v1/admin/audit',
  'request.complete'
];

function stripJsonComments(source) {
  let output = '';
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (current === '\n') {
        lineComment = false;
        output += current;
      }
      continue;
    }

    if (blockComment) {
      if (current === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      output += current;
      if (escaped) escaped = false;
      else if (current === '\\') escaped = true;
      else if (current === '"') inString = false;
      continue;
    }

    if (current === '"') {
      inString = true;
      output += current;
      continue;
    }

    if (current === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    output += current;
  }

  return output.replace(/,\s*([}\]])/g, '$1');
}

function loadWranglerConfig() {
  const configPath = path.join(ROOT, 'wrangler.jsonc');
  if (!fs.existsSync(configPath)) throw new Error('wrangler.jsonc is missing');

  let config;
  try {
    config = JSON.parse(stripJsonComments(fs.readFileSync(configPath, 'utf8')));
  } catch (error) {
    throw new Error(`wrangler.jsonc is invalid: ${error.message}`);
  }

  if (typeof config.main !== 'string' || !config.main.trim()) {
    throw new Error('wrangler.jsonc must define a non-empty main Worker path');
  }

  const relativePath = config.main.replaceAll('\\', '/');
  if (path.isAbsolute(relativePath)) throw new Error('active Worker path must be relative');

  const absolutePath = path.resolve(ROOT, relativePath);
  const relativeFromRoot = path.relative(ROOT, absolutePath);
  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    throw new Error('active Worker path escapes the repository root');
  }
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`configured active Worker does not exist: ${relativePath}`);
  }

  return { relativePath, absolutePath };
}

function localImports(source) {
  const imports = [];
  const expression = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]+?\s+from\s+|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g;
  let match;
  while ((match = expression.exec(source)) !== null) imports.push(match[2]);
  return imports;
}

function resolveImport(parentFile, specifier) {
  const candidate = path.resolve(path.dirname(parentFile), specifier);
  const options = path.extname(candidate) ? [candidate] : [`${candidate}.js`, candidate];
  const resolved = options.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!resolved) throw new Error(`active Worker import is missing: ${specifier} from ${path.relative(ROOT, parentFile)}`);

  const relative = path.relative(ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`active Worker import escapes the repository root: ${specifier}`);
  }
  return resolved;
}

function collectWorkerChain(entryFile) {
  const visited = new Set();
  const visiting = new Set();
  const files = [];

  function visit(file) {
    const normalized = path.normalize(file);
    if (visiting.has(normalized)) {
      throw new Error(`circular active Worker delegation detected at ${path.relative(ROOT, normalized)}`);
    }
    if (visited.has(normalized)) return;

    visiting.add(normalized);
    const source = fs.readFileSync(normalized, 'utf8');
    files.push({ path: normalized, source });

    for (const specifier of localImports(source)) {
      const imported = resolveImport(normalized, specifier);
      if (path.basename(imported).startsWith('worker-') || imported === entryFile) visit(imported);
    }

    visiting.delete(normalized);
    visited.add(normalized);
  }

  visit(entryFile);
  return files;
}

function validateActiveWorker() {
  const active = loadWranglerConfig();
  const chain = collectWorkerChain(active.absolutePath);
  const combinedSource = chain.map(item => item.source).join('\n');

  if (!/export\s+default/.test(chain[0].source)) {
    throw new Error('active Worker does not provide a default module export');
  }

  for (const capability of REQUIRED_CAPABILITIES) {
    if (!combinedSource.includes(capability)) {
      throw new Error(`active Worker chain is missing required capability: ${capability}`);
    }
  }

  return {
    activeWorker: active.relativePath,
    chain: chain.map(item => path.relative(ROOT, item.path).replaceAll('\\', '/')),
    capabilities: REQUIRED_CAPABILITIES
  };
}

if (require.main === module) {
  try {
    const result = validateActiveWorker();
    console.log(`Validated active Worker: ${result.activeWorker}`);
    console.log(`Worker chain: ${result.chain.join(' -> ')}`);
  } catch (error) {
    console.error(`Active Worker validation FAILED\n- ${error.message}`);
    process.exit(1);
  }
}

module.exports = { validateActiveWorker, loadWranglerConfig, collectWorkerChain };
