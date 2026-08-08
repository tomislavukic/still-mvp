const fs = require('fs');
const path = require('path');

function readWrangler(root) {
  const configPath = path.join(root, 'wrangler.jsonc');
  const source = fs.readFileSync(configPath, 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(source);
}

function activeWorkerChain(root = path.resolve(__dirname, '..')) {
  const config = readWrangler(root);
  if (!config.main) throw new Error('wrangler.jsonc has no main Worker entrypoint');

  const chain = [];
  const seen = new Set();
  let relativePath = config.main;

  while (relativePath) {
    const absolutePath = path.resolve(root, relativePath);
    if (seen.has(absolutePath)) throw new Error(`Worker import cycle detected at ${relativePath}`);
    if (!fs.existsSync(absolutePath)) throw new Error(`Active Worker file is missing: ${relativePath}`);
    seen.add(absolutePath);

    const source = fs.readFileSync(absolutePath, 'utf8');
    chain.push({ absolutePath, relativePath: path.relative(root, absolutePath), source });
    const delegated = source.match(/import\s+app\s+from\s+['"](\.\/[^'"]+\.js)['"]/);
    relativePath = delegated ? path.join(path.dirname(relativePath), delegated[1]) : '';
  }

  return chain;
}

function findWorkerContaining(capability, root = path.resolve(__dirname, '..')) {
  const match = activeWorkerChain(root).find(worker => worker.source.includes(capability));
  if (!match) throw new Error(`Active Worker chain does not contain ${capability}`);
  return match;
}

module.exports = { activeWorkerChain, findWorkerContaining, readWrangler };

if (require.main === module) {
  const chain = activeWorkerChain();
  if (process.argv.includes('--files')) {
    process.stdout.write(`${chain.map(worker => worker.relativePath).join('\n')}\n`);
  } else {
    process.stdout.write(`${chain[0].relativePath}\n`);
  }
}
