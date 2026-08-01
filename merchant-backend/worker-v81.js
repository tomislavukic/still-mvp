import app from './worker-v79.js';

let schemaReady;
async function ensureConfigSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_runtime_config(
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run().catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

async function resolveGoogleClientId(env) {
  const current = typeof env.GOOGLE_CLIENT_ID === 'string'
    ? env.GOOGLE_CLIENT_ID.trim()
    : '';

  if (!env.DB) return current || null;
  await ensureConfigSchema(env);

  if (current) {
    await env.DB.prepare(`INSERT INTO app_runtime_config(key,value,updated_at)
      VALUES('GOOGLE_CLIENT_ID',?,?)
      ON CONFLICT(key) DO UPDATE SET
        value=excluded.value,
        updated_at=excluded.updated_at`)
      .bind(current,new Date().toISOString()).run();
    return current;
  }

  const saved = await env.DB.prepare(
    `SELECT value FROM app_runtime_config WHERE key='GOOGLE_CLIENT_ID'`
  ).first();
  return typeof saved?.value === 'string' && saved.value.trim()
    ? saved.value.trim()
    : null;
}

function withClientId(env, clientId) {
  if (!clientId || env.GOOGLE_CLIENT_ID) return env;
  return new Proxy(env, {
    get(target, property, receiver) {
      if (property === 'GOOGLE_CLIENT_ID') return clientId;
      return Reflect.get(target, property, receiver);
    }
  });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const needsGoogleConfig =
      path === '/api/v1/buyer-auth/google/config' ||
      path === '/api/v1/buyer-auth/google' ||
      path === '/api/v1/auth/google/config' ||
      path === '/api/v1/auth/google';

    if (!needsGoogleConfig) return app.fetch(request, env);

    try {
      const clientId = await resolveGoogleClientId(env);
      return app.fetch(request, withClientId(env, clientId));
    } catch (error) {
      console.error('google_config_resolution_failed', error);
      return app.fetch(request, env);
    }
  }
};