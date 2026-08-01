import app from './worker-v79.js';

async function resolveGoogleClientId(env) {
  if (!env?.DB) return env?.GOOGLE_CLIENT_ID || null;

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_runtime_config(
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  const current = typeof env.GOOGLE_CLIENT_ID === 'string' ? env.GOOGLE_CLIENT_ID.trim() : '';
  if (