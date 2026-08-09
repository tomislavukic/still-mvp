class ProtectionBrowserService {
  constructor() {
    this.cache = new Map();
    this.markets = ['hr', 'de', 'at', 'si', 'it', 'us', 'eu'];
  }

  async loadMarket(market) {
    const key = String(market || '').toLowerCase();

    if (!key) return [];

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const response = await fetch(`/buyer/protection/data/${key}.json`, {
      credentials: 'same-origin'
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const retailers = Array.isArray(data.retailers)
      ? data.retailers
      : [];

    this.cache.set(key, retailers);
    return retailers;
  }

  async findRetailer(id, market) {
    if (!id) return null;

    const retailers = await this.loadMarket(market);
    const needle = String(id).trim().toLowerCase();

    return retailers.find(retailer =>
      String(retailer.id || '').toLowerCase() === needle
    ) || null;
  }

  async searchRetailers(query, market = null) {
    const needle = String(query || '').trim().toLowerCase();

    if (!needle) return [];

    const markets = market
      ? [String(market).toLowerCase()]
      : this.markets;

    const groups = await Promise.all(
      markets.map(code => this.loadMarket(code))
    );

    return groups.flat().filter(retailer => (
      String(retailer.id || '').toLowerCase().includes(needle) ||
      String(retailer.name || '').toLowerCase().includes(needle)
    ));
  }

  evaluateWarranty(product = {}) {
    const warranty = product.warranty || {};

    if (!warranty.startDate && !warranty.endDate) {
      return {
        available: false,
        active: null,
        startDate: null,
        endDate: null,
        daysRemaining: null,
        provider: null,
        type: null,
        status: 'unknown'
      };
    }

    const startDate = warranty.startDate
      ? new Date(`${String(warranty.startDate).slice(0, 10)}T12:00:00`)
      : null;

    const endDate = warranty.endDate
      ? new Date(`${String(warranty.endDate).slice(0, 10)}T23:59:59`)
      : null;

    const now = new Date();

    let active = null;
    let daysRemaining = null;

    if (endDate && !Number.isNaN(endDate.getTime())) {
      active = endDate >= now;
      daysRemaining = Math.ceil(
        (endDate.getTime() - now.getTime()) / 86400000
      );
    }

    return {
      available: true,
      active,
      startDate,
      endDate,
      daysRemaining,
      provider: warranty.provider || null,
      type: warranty.type || null,
      status: active === true
        ? 'active'
        : active === false
          ? 'expired'
          : 'unknown'
    };
  }

  async analyze(product = {}) {
    const retailer = product.retailerId
      ? await this.findRetailer(product.retailerId, product.market)
      : null;

    const warranty = this.evaluateWarranty(product);

    const returns = retailer
      ? {
          available: true,
          retailer: {
            id: retailer.id,
            name: retailer.name,
            market: retailer.market
          },
          status: retailer.verificationStatus || 'unverified',
          source: retailer.policyUrl || null,
          returnUntil: product.returnUntil || null,
          verifiedAt: retailer.verifiedAt || null
        }
      : {
          available: false,
          retailer: null,
          status: product.retailerId
            ? 'retailer-not-found'
            : 'retailer-missing',
          source: null,
          returnUntil: product.returnUntil || null,
          verifiedAt: null
        };

    const recalls = {
      checked: Array.isArray(product.recalls) && product.recalls.length > 0,
      recalls: Array.isArray(product.recalls) ? product.recalls : [],
      affected: Array.isArray(product.recalls) && product.recalls.length > 0,
      status: Array.isArray(product.recalls) && product.recalls.length > 0
        ? 'recall-present'
        : 'no-recall-data'
    };

    return {
      productId: product.id || null,
      retailer: retailer
        ? {
            id: retailer.id,
            name: retailer.name,
            market: retailer.market
          }
        : null,
      warranty,
      returns,
      recalls,
      protectionStatus: {
        warrantyKnown: warranty.available,
        returnSourceAvailable: Boolean(returns.source),
        recallDataAvailable: recalls.checked
      }
    };
  }
}

window.StillProtection = new ProtectionBrowserService();

(() => {
  const selector = 'script[data-still-protection-center]';
  if (document.querySelector(selector)) return;

  const script = document.createElement('script');
  script.src = '/buyer/protection/ui/ProtectionCenter.js';
  script.defer = true;
  script.dataset.stillProtectionCenter = '1';
  script.addEventListener('error', () => {
    console.error('[Still Protection] Unable to load Protection Center UI.');
  }, { once: true });
  document.head.appendChild(script);
})();
