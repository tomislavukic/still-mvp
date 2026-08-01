import buyerApp from './worker-v77.js';
import companyApp from './worker-v75.js';

function rewrite(req, pathname) {
  const u = new URL(req.url);
  u.pathname = pathname;
  return new Request(u.toString(), req);
}

export default {
  async fetch(req, env) {
    const { pathname: p } = new URL(req.url);

    // Existing company portal owns these routes and the still_company cookie.
    if (
      p === '/api/v1/auth/login' ||
      p === '/api/v1/auth/register' ||
      p === '/api/v1/auth/me' ||
      p === '/api/v1/auth/logout'
    ) {
      return companyApp.fetch(req, env);
    }

    // Buyer account routes use the still_buyer cookie and an isolated namespace.
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

    // Keep Google endpoints temporarily compatible with Build 77 clients.
    if (p === '/api/v1/auth/google' || p === '/api/v1/auth/google/config') {
      return buyerApp.fetch(req, env);
    }

    return buyerApp.fetch(req, env);
  }
};