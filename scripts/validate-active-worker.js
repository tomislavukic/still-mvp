const fs=require('fs');
const path=require('path');
const wr=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8').replace(/\/\/.*$/mg,'').replace(/,\s*([}\]])/g,'$1'));
const main=wr.main;
if(!main) throw new Error('No main worker');
const seen=new Set();let src='';
function walk(f){
 const p=path.resolve(f); if(seen.has(p)) return; seen.add(p);
 const t=fs.readFileSync(p,'utf8'); src+=t;
 const m=t.match(/import\s+app\s+from\s+'(\.\/worker-v\d+\.js)'/);
 if(m) walk(path.join(path.dirname(p),m[1]));
}
walk(main);
for(const c of ['platform_audit_events','OPERATIONS_REVIEWER_TOKEN','OPERATIONS_SUPPORT_TOKEN','OPERATIONS_READONLY_TOKEN','/api/v1/admin/audit','request.complete']) if(!src.includes(c)) throw new Error('Missing capability '+c);
console.log('Validated active worker',main);
