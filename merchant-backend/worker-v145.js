import app from './worker-v144.js';
import phase8 from './worker-v143.js';

// Phase 9 compatibility bridge.
// Keep the canonical `import app from` delegation shape because CI's worker-chain
// validator follows that import to verify every protected capability in ancestry.
// Phase 9 owns Ask Still, Remember, document intelligence, search and sharing.
// Mature Phase 1-8 Knowledge create/update remains authoritative for legacy
// Thing/Situation/tag relationships so existing BuyerOS integrations keep working.
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

    // Phase 9 expanded World search with Ask Still evidence fields. Preserve the
    // Phase 1 response contract at the same endpoint so existing BuyerOS callers
    // and integration tests continue to receive publicId/resultType as well.
    if (path === '/api/v1/world/search' && request.method === 'GET') {
      const response = await app.fetch(request, env, ctx);
      if (!response.ok) return response;
      const payload = await response.json().catch(() => null);
      if (!payload || !Array.isArray(payload.results)) return response;
      const resultType = {
        thing: 'Thing',
        knowledge: 'Knowledge',
        situation: 'Situation',
        open_loop: 'OpenLoop',
        document: 'Document',
        history: 'History',
        decision: 'Decision'
      };
      payload.results = payload.results.map(item => ({
        ...item,
        publicId: item.publicId || item.id,
        resultType: item.resultType || resultType[item.type] || item.type
      }));
      return new Response(JSON.stringify(payload), {
        status: response.status,
        headers: response.headers
      });
    }

    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof phase8.scheduled === 'function') {
      return phase8.scheduled(controller, env, ctx);
    }
  }
};
