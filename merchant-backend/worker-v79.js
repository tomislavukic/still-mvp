import buyerApp from './worker-v77.js';
import companyApp from './worker-v75.js';

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

export default {
  async fetch(req, env) {
    const { pathname: p } = new URL(req.url);

    // Never let application routing swallow public pages or static assets.
    if (!p.startsWith('/api/') && !p.startsWith('/admin')) {
      return env.ASSETS.fetch(req);
    }

    // Admin pages and admin APIs continue through the existing application stack.
    if (p === '/admin' || p.startsWith('/admin/')) {
      return buyerApp.fetch(req, env);
    }

    // All company authentication and company operational APIs stay together.
    if (isCompanyRoute(p)) {
      return companyApp.fetch(req, env);
    }

    // Buyer account routes use an isolated namespace and the buyer session cookie.
    if (p === '/api/v1/buyer-auth/google/config') {
      return buyerApp.fetch(rewrite(req, '/api/v1/auth/google/config'), env);
    }
    if (p === '/api/v1/buyer-auth/google') {
      return buyerApp.fetch(rewrite(req, '/api/v1/auth/google'), env);
    }
    if (p === '/api/v1/buyer-auth/me') {
      return buyerApp.fetch(rewrite(req, '/api/v1/auth/me'), env);
    }
    if (p === '/api/v1/buyer-auth/logout') {
      return buyerApp.fetch(rewrite(req, '/api/v1/auth/logout'), env);
    }
    const link = p.match(/^\/api\/v1\/buyer-auth\/cases\/([^/]+)\/link$/);
    if (link) {
      return buyerApp.fetch(rewrite(req, `/api/v1/auth/cases/${link[1]}/link`), env);
    }

    // Temporary compatibility for clients cached before Build 79.
    if (p === '/api/v1/auth/google' || p === '/api/v1/auth/google/config') {
      return buyerApp.fetch(req, env);
    }

    return buyerApp.fetch(req, env);
  }
};