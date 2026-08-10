(() => {
  'use strict';

  const VERSION = '153';

  function tools() {
    return window.StillBuyerOSToolsV149 || null;
  }

  function graph() {
    return window.StillBuyerOSOwnershipGraphV152 || null;
  }

  async function execute(name, args = {}) {
    const api = tools();

    if (!api || typeof api.execute !== 'function') {
      return {
        ok: false,
        code: 'TOOLS_UNAVAILABLE',
        message: 'BuyerOS tools are unavailable.'
      };
    }

    return api.execute(name, args);
  }

  async function attention(args = {}) {
    return execute('get_attention', args);
  }

  async function documents(args = {}) {
    return execute('get_documents', args);
  }

  async function serviceHistory(args = {}) {
    return execute('get_service_history', args);
  }

  async function timeline(args = {}) {
    return execute('get_timeline', args);
  }

  function normalizeResult(result) {
    if (!result || result.ok !== true) {
      return [];
    }

    if (Array.isArray(result.data)) {
      return result.data;
    }

    if (result.data && Array.isArray(result.data.items)) {
      return result.data.items;
    }

    return result.data ? [result.data] : [];
  }

  function priority(item) {
    const days =
      Number.isFinite(Number(item?.daysUntil))
        ? Number(item.daysUntil)
        : null;

    if (days !== null) {
      if (days < 0) return 1000 + Math.abs(days);
      if (days <= 7) return 900 - days;
      if (days <= 30) return 700 - days;
      if (days <= 90) return 500 - days;
    }

    const severity =
      String(
        item?.severity ||
        item?.priority ||
        item?.status ||
        ''
      ).toLowerCase();

    if (
      severity.includes('critical') ||
      severity.includes('expired') ||
      severity.includes('overdue')
    ) return 950;

    if (
      severity.includes('high') ||
      severity.includes('urgent')
    ) return 800;

    if (
      severity.includes('medium') ||
      severity.includes('soon')
    ) return 600;

    return 100;
  }

  function kind(item) {
    const value = [
      item?.kind,
      item?.type,
      item?.category,
      item?.title,
      item?.label
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (value.includes('warranty')) return 'warranty';
    if (value.includes('return')) return 'return';
    if (value.includes('renew')) return 'renewal';
    if (value.includes('service') || value.includes('repair')) {
      return 'service';
    }
    if (value.includes('document') || value.includes('receipt')) {
      return 'document';
    }

    return 'attention';
  }

  function protectionItem(item) {
    return Object.freeze({
      ...item,
      protectionKind: kind(item),
      protectionPriority: priority(item)
    });
  }

  async function overview(args = {}) {
    const [
      attentionResult,
      documentsResult,
      serviceResult,
      timelineResult
    ] = await Promise.all([
      attention(args),
      documents(args),
      serviceHistory(args),
      timeline(args)
    ]);

    const attentionItems =
      normalizeResult(attentionResult)
        .map(protectionItem)
        .sort(
          (a, b) =>
            b.protectionPriority -
            a.protectionPriority
        );

    const documentItems =
      normalizeResult(documentsResult);

    const serviceItems =
      normalizeResult(serviceResult);

    const timelineItems =
      normalizeResult(timelineResult);

    return Object.freeze({
      attention: attentionItems,
      documents: documentItems,
      serviceHistory: serviceItems,
      timeline: timelineItems,

      urgent: attentionItems.filter(
        item => item.protectionPriority >= 800
      ),

      upcoming: attentionItems.filter(
        item =>
          item.protectionPriority >= 500 &&
          item.protectionPriority < 800
      ),

      protectedCount: attentionItems.filter(
        item =>
          item.protectionKind === 'warranty' &&
          item.protectionPriority < 1000
      ).length,

      documentCount: documentItems.length,
      serviceCount: serviceItems.length,

      generatedAt: new Date().toISOString()
    });
  }

  function thingGraph(thingId) {
    const api = graph();

    if (
      !thingId ||
      !api ||
      typeof api.graphForThing !== 'function'
    ) {
      return null;
    }

    try {
      return api.graphForThing(thingId);
    } catch {
      return null;
    }
  }

  const api = Object.freeze({
    version: VERSION,
    overview,
    attention,
    documents,
    serviceHistory,
    timeline,
    thingGraph
  });

  Object.defineProperty(
    window,
    'StillBuyerOSProtectionV153',
    {
      value: api,
      configurable: false,
      enumerable: false,
      writable: false
    }
  );

  window.dispatchEvent(
    new CustomEvent(
      'still:buyeros-protection-ready',
      {
        detail: {
          version: VERSION
        }
      }
    )
  );
})();
