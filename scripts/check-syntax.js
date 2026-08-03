const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', '.wrangler', 'node_modules', 'public']);

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

if (failures.length) {
  console.error(`JavaScript syntax validation failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(`JavaScript syntax validation passed (${files.length} files).`);
