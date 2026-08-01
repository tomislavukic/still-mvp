import buyerApp from './worker-v77.js';
import companyApp from './worker-v75.js';

function rewrite(req, pathname) {
  const u = new URL(req.url);
  u.pathname = pathname;
  return new Request(u.toString(), req);
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const p = u.pathname;

    // Company authentication owns the original auth session routes.
    if