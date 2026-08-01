import buyerApp from './worker-v77.js';
import companyApp from './worker-v75.js';

let configSchemaReady;

function rewrite(req, pathname) {
  const u = new URL(req.url);
  u.pathname = pathname;
  return new Request(u.toString(), req);
}

function isCompanyRoute(pathname) {
  return (
    pathname === '/api/v1/auth/login' ||
    pathname === '/api/v1/auth/register' ||
    pathname === '/api/v1/auth/me' ||
    pathname === '/api/v1/auth/logout' ||
    pathname.startsWith('/api/v1/merchant/') ||
    pathname.startsWith('/api/v1/business/') ||
    pathname.startsWith('/api/v1/services/') ||
    pathname.startsWith('/api/v1/ops/') ||
    pathname.startsWith('/api/v1/rewards/business/')
  );
}

function isGoogleRoute(pathname) {
  return (
    pathname === '/api/v1/buyer-auth/google/config' ||
    pathname === '/api/v1/buyer-auth/google' ||
    pathname === '/api/v1/auth/google/config' ||
    pathname === '/api/v1/auth/google'
  );
}

async function ensureConfigSchema(env) {
  if (!env.DB) return;
  if (!configSchemaReady) {
    configSchemaReady = env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_runtime_config(
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run().catch(error => {
      configSchemaReady = undefined;
      throw error;
    });
  }
  await configSchemaReady;
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

function withGoogleClientId(env, clientId) {
  if (!clientId || env.GOOGLE_CLIENT_ID) return env;
  return new Proxy(env, {
    get(target, property, receiver) {
      if (property === 'GOOGLE_CLIENT_ID') return clientId;
      return Reflect.get(target, property, receiver);
    }
  });
}

async function buyerEnv(pathname, env) {
  if (!isGoogleRoute(pathname)) return env;
  try {
    return withGoogleClientId(env, await resolveGoogleClientId(env));
  } catch (error) {
    console.error('google_config_resolution_failed', error);
    return env;
  }
}

export default {
  async fetch(req, env) {
    const { pathname: p } = new URL(req.url);

    // Public pages and static assets are always served by Cloudflare Assets.
    if (!p.startsWith('/api/') && !p.startsWith('/admin')) {
      return env.ASSETS.fetch(req);
    }

    // Admin pages and admin APIs continue through the existing application stack.
    if (p === '/admin' || p.startsWith('/admin/')) {
      return buyerApp.fetch(req, env);
    }

    // Company authentication and operational APIs stay together.
    if (isCompanyRoute(p)) {
      return companyApp.fetch(req, env);
    }

    const resolvedBuyerEnv = await buyerEnv(p, env);

    // Buyer account routes use an isolated namespace and buyer session cookie.
    if (p === '/api/v1/buyer-auth/google/config') {
      return buyerApp.fetch(rewrite(req, '/api/v1/auth/google/config'), resolvedBuyerEnv);
    }
    if (p === '/api/v1/buyer-auth/google') {
      return buyerApp.fetch(rewrite(req, '/api/v1/auth/google'), resolvedBuyerEnv);
    }
    if (p === '/api/v1/buyer-auth/me') {
      return buyerApp.fetch(rewrite(req, '/api/v1/auth/me'), resolvedBuyerEnv);
    }
    if (p === '/api/v1/buyer-auth/logout') {
      return buyerApp.fetch(rewrite(req, '/api/v1/auth/logout'), resolvedBuyerEnv);
    }
    const link = p.match(/^\/api\/v1\/buyer-auth\/cases\/([^/]+)\/link$/);
    if (link) {
      return buyerApp.fetch(rewrite(req, `/api/v1/auth/cases/${link[1]}/link`), resolvedBuyerEnv);
    }

    // Compatibility for clients cached before Build 79.
    if (p === '/api/v1/auth/google' || p === '/api/v1/auth/google/config') {
      return buyerApp.fetch(req, resolvedBuyerEnv);
    }

    return buyerApp.fetch(req, resolvedBuyerEnv);
  }
};