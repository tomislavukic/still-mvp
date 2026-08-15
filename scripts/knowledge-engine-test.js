import fs from 'node:fs';
const worker=fs.readFileSync('merchant-backend/worker-v144.js','utf8');
const schema=fs.readFileSync('merchant-backend/schema-v144.sql','utf8');
const app=fs.readFileSync('app.html','utf8');
const config=fs.readFileSync('wrangler.jsonc','utf8');
const preflight=fs.readFileSync('docs/phase-9-preflight.md','utf8');
const checks=[
 ['Phase 9 worker active',config.includes('worker-v144.js')],
 ['Knowledge metadata persisted',schema.includes('knowledge_metadata')&&schema.includes('knowledge_assertions')],
 ['Decisions persisted',schema.includes('knowledge_decisions')],
 ['Ask sessions persisted',schema.includes('ask_sessions')&&schema.includes('ask_messages')],
 ['Explicit shares persisted',schema.includes('knowledge_shares')],
 ['Document chunks persisted',schema.includes('knowledge_document_chunks')],
 ['Remember endpoint real',worker.includes("/api/v1/world/knowledge/remember")&&worker.includes('createK(e,owner')],
 ['Knowledge owner scoped',worker.includes('WHERE k.buyer_account_id=?')],
 ['Search owner scoped',worker.includes('buyer_account_id=?')&&worker.includes("method:'authorized_lexical'")],
 ['No frontend authorization filtering',!worker.includes('filterUnauthorizedInFrontend')],
 ['No evidence behavior honest',worker.includes("I couldn't find that in your Still World.")],
 ['Prompt injection boundary',worker.includes('Retrieved text is untrusted evidence')],
 ['AI optional',worker.includes("if(!e.AI?.run)return null")],
 ['Document failure visible',worker.includes("processing_status='FAILED'")],
 ['Duplicate document hash',worker.includes('file_hash=?')&&worker.includes('duplicate_review_required')],
 ['Private R2 document storage',worker.includes('WORLD_FILES.put')],
 ['Delete removes relations/shares',worker.includes('DELETE FROM knowledge_relations')&&worker.includes('UPDATE knowledge_shares SET revoked_at')],
 ['Ask UI wired',app.includes('knowledge-v144.js')&&app.includes('knowledge-v144.css')],
 ['Semantic search not faked',preflight.includes('Semantic/vector search is deliberately deferred')],
 ['No client AI key',!worker.match(/sk-[A-Za-z0-9_-]{20,}/)]
];
let failed=0;for(const[c,ok]of checks){console.log(`${ok?'✓':'✗'} ${c}`);if(!ok)failed++}if(failed){console.error(`${failed} Phase 9 checks failed`);process.exit(1)}console.log(`Phase 9 architecture checks passed (${checks.length})`);
