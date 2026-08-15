-- Phase 9 Knowledge Engine + Ask Still. Additive Buyer-private persistence.
CREATE TABLE IF NOT EXISTS knowledge_metadata(
  knowledge_item_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  knowledge_type TEXT NOT NULL DEFAULT 'NOTE',
  scope TEXT NOT NULL DEFAULT 'PRIVATE' CHECK(scope IN ('PRIVATE','HOUSEHOLD','CIRCLE','EXPLICIT_SHARE')),
  language TEXT,
  original_content_ref TEXT,
  valid_from TEXT,
  valid_until TEXT,
  supersedes_knowledge_id TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_assertions(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  knowledge_item_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  assertion_type TEXT NOT NULL CHECK(assertion_type IN ('USER_STATED','EXTRACTED','VERIFIED_SOURCE','AI_INFERRED')),
  confidence REAL NOT NULL DEFAULT 1,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  superseded_by_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_relations(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  provenance TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1,
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(owner_user_id,source_type,source_id,relation_type,target_type,target_id)
);

CREATE TABLE IF NOT EXISTS knowledge_document_chunks(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  section_title TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(owner_user_id,document_id,chunk_index,content_hash)
);

CREATE TABLE IF NOT EXISTS knowledge_decisions(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  decision TEXT NOT NULL,
  alternatives_json TEXT NOT NULL DEFAULT '[]',
  reasons_json TEXT NOT NULL DEFAULT '[]',
  related_entities_json TEXT NOT NULL DEFAULT '[]',
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ask_sessions(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ask_messages(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('USER','ASSISTANT')),
  content TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  answer_type TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_shares(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  knowledge_item_id TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  purpose TEXT,
  projection_json TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_meta_owner ON knowledge_metadata(owner_user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_assert_owner ON knowledge_assertions(owner_user_id,knowledge_item_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_relation_source ON knowledge_relations(owner_user_id,source_type,source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relation_target ON knowledge_relations(owner_user_id,target_type,target_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_owner_doc ON knowledge_document_chunks(owner_user_id,document_id,chunk_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_decisions_owner ON knowledge_decisions(owner_user_id,decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_ask_sessions_owner ON ask_sessions(owner_user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ask_messages_session ON ask_messages(owner_user_id,session_id,created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_shares_owner ON knowledge_shares(owner_user_id,knowledge_item_id,revoked_at,expires_at);
PRAGMA optimize;
