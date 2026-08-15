const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('app.html');
const guard = read('buyer/protection/still-mobile-nav-guard-v182.css');
const base = read('still-os-v133.css');

assert.ok(base.includes('.sos133-nav{top:104px'), 'Expected authenticated desktop nav rule to remain explicit');
assert.ok(base.includes('@media(max-width:820px)') && base.includes('.sos133-nav{top:92px'), 'Expected tablet nav rule to remain explicit');
assert.ok(app.includes('still-mobile-nav-guard-v182.css'), 'App must load the mobile nav guard');
assert.ok(app.indexOf('still-mobile-nav-guard-v182.css') > app.indexOf('still-ui-polish-v176.css'), 'Mobile guard must load after other Still OS styles');
assert.match(guard, /@media\s*\(max-width:\s*600px\)/, 'Guard must be mobile-scoped');
assert.match(guard, /\.still-os-document \.sos133-nav\{[\s\S]*top:auto!important;[\s\S]*bottom:0!important;/, 'Mobile nav must be bottom-pinned with top reset');
assert.match(guard, /max-height:calc\(76px \+ env\(safe-area-inset-bottom\)\)!important/, 'Mobile nav must have a bounded height');
assert.match(guard, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/, 'All five Still spaces must fit the mobile nav row');
assert.match(guard, /\.still-os-document \.sos133-nav>a\{[\s\S]*height:52px!important;[\s\S]*max-height:52px!important;/, 'Mobile nav items must not stretch vertically');

process.stdout.write('✓ Still OS mobile navigation regression guard passed.\n');
