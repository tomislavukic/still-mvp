const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set([
  '.git',
  '.wrangler',
  'node_modules',
  'public',
  'archive',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache'
]);

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap(entry => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return ignoredDirectories.has(entry.name) ? [] : javascriptFiles(absolute);
      }
      return entry.isFile() && entry.name.endsWith('.js') ? [absolute] : [];
    });
}

const failures = [];
const files = javascriptFiles(root);

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    failures.push(`${path.relative(root, file)}: ${(result.stderr || result.stdout).trim()}`);
  }
}

// `node --check` can accept an ESM Worker as CommonJS without resolving its
// module graph. Import the configured entrypoint as well so the active Worker
// and every additive Worker it imports are parsed together.
const wrangler = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8');
const mainMatch = wrangler.match(/"main"\s*:\s*"([^"]+)"/);
if (!mainMatch) {
  failures.push('wrangler.jsonc: active Worker entrypoint is missing');
} else {
  const activeWorker = path.resolve(root, mainMatch[1]);
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `import(${JSON.stringify(pathToFileURL(activeWorker).href)})`], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  if (result.status !== 0) failures.push(`${mainMatch[1]} module graph: ${(result.stderr || result.stdout).trim()}`);
}

if (failures.length) {
  console.error(`JavaScript syntax validation failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(`JavaScript syntax validation passed (${files.length} files).`);
