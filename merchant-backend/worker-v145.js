import phase9 from './worker-v144.js';
import phase8 from './worker-v143.js';

// Compatibility bridge for Phase 9.
// The Phase 9 worker owns Ask Still, Remember, document intelligence and sharing,
// while the mature Phase 1 Knowledge create/update handlers remain the source of
// truth for legacy Thing/Situation/tag relationships. This prevents Phase 9 from
// shadowing those fields and breaking existing BuyerOS integrations.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/v1/world/knowledge' && request.method === 'POST') {
      return phase8.fetch(request, env, ctx);
    }

    if (/^\/api\/v1\/world\/knowledge\/[^/]+$/.test(path) && request.method === 'PATCH') {
      return phase8.fetch(request, env, ctx);
    }

    return phase9.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof phase8.scheduled === 'function') {
      return phase8.scheduled(controller, env, ctx);
    }
  }
};
