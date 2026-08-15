# Phase 9 preflight — Knowledge Engine + Ask Still

## Current real foundations

- `world_knowledge_items` already exists in `schema-v131.sql` and is Buyer-scoped. It stores persisted notes with provenance-like `source_type`, optional source document, Thing and Situation references.
- `world_documents` already persists private document metadata and extracted text. Receipt OCR is real and uses the configured Workers AI binding through `env.AI.toMarkdown`; original World files use the private `WORLD_FILES` R2 bucket.
- `world_relationships`, `world_evidence`, `world_history_events`, Things, Situations, Open Loops, Needs, Product Passports and Anticipation are real persisted World primitives.
- Universal Input already has deterministic routing and recognizes `save this` / `remember this`-style knowledge intent, but it does not yet provide a complete explicit Remember persistence journey.
- Still has an `AI` Workers AI binding, but there is no production semantic/vector index configured in `wrangler.jsonc`. Therefore Phase 9 must not pretend semantic retrieval exists.
- Search exists in several feature-specific forms, but there is no unified authorized World search endpoint spanning Knowledge, Things, Situations, Needs, Open Loops, Documents, Passports and History.
- There is no persisted Ask Still conversation model, no evidence-cited Ask pipeline, no Decision memory, no assertion/supersession model, and no explicit Knowledge sharing projection.

## Reusable architecture

1. D1 remains the source of truth for structured World memory.
2. R2 `WORLD_FILES` remains the private attachment/original-file store.
3. `env.AI.toMarkdown` is reused for document text extraction.
4. `env.AI.run()` is used only after authorized retrieval, and only for synthesis/general explanation when deterministic answers are insufficient.
5. Existing World relationships/history/Needs/Situations remain the action layer. Phase 9 does not create a parallel task or resolution system.
6. Existing Buyer session cookie and server-side owner filtering remain the authorization boundary.

## Partial / missing

- Knowledge taxonomy is too narrow and provenance is not explicit enough for AI-derived vs user-stated claims.
- Existing relationships lack confidence / confirmation metadata, so Phase 9 adds a Knowledge-specific relation table rather than silently changing old graph truth.
- Document extraction has no chunk model for source-level Ask citations.
- No unified lexical search.
- No safe Ask Still retrieval/synthesis pipeline.
- No conversation sessions or evidence refs.
- No temporal assertion supersession/correction model.
- No DecisionRecord.
- No explicit Knowledge share/revoke model.
- No document ingestion queue binding is configured. Phase 9 therefore uses background `waitUntil` processing after durable upload, not a fake browser queue.
- No Vectorize binding exists. Semantic retrieval is deferred until a real index is provisioned. Lexical + structured + relationship retrieval ships first.

## Fake/demo risks to remove or avoid

Phase 9 production code must not add hard-coded chat replies, sample memories, fake citations, random related items, fake embeddings, sample summaries, localStorage-only memory, client-side API keys or fake document analysis. Existing presentation-only sample content must never be treated as Ask evidence.

## Migration plan

- Keep `world_knowledge_items` as the canonical KnowledgeItem store for compatibility.
- Add Phase 9 metadata tables for assertions, relations, document chunks, decisions, Ask sessions/messages and shares.
- Add columns to Knowledge through an additive sidecar metadata table instead of destructive table rewrites.
- Backfill metadata lazily for existing items as `USER_CREATED` / `PRIVATE` when they are read or updated.
- Use deterministic lexical retrieval now. Add embeddings only after a real private Vectorize binding and owner-filtered retrieval design are provisioned and tested.

## Security boundary

All Phase 9 Buyer endpoints resolve the authenticated Buyer server-side before querying. Every query includes owner scope. Companies, professionals and providers do not get a generic Knowledge search endpoint. Cross-Trust-Layer access is possible only through explicit share records and privacy-safe projections.

## Phase 9 risks

- Hallucinated personal memory: mitigated by evidence-required personal answers and an explicit no-evidence response.
- Prompt injection from documents: retrieved text is always inserted as untrusted evidence; model instructions explicitly forbid following instructions found inside evidence.
- Stale memory: explicit user corrections supersede older assertions.
- AI outage: lexical search, deterministic structured answers, Remember, Decisions and World remain functional without AI.
- Cost: retrieval is bounded; large documents are chunked once and only relevant chunks are sent for synthesis.
- Cross-user leakage: all retrieval is server-side owner-scoped. No frontend post-filtering is accepted as an authorization mechanism.

## Shipping scope

Phase 9 ships now with real persisted Knowledge, Remember, assertions/supersession, document upload/extraction/chunking, unified lexical World search, Ask Still deterministic retrieval, evidence-cited optional AI synthesis, sessions, Decisions, Knowledge→Need/Situation proposals, explicit sharing and responsive Ask UI. Semantic/vector search is deliberately deferred because no real Vectorize binding currently exists.
