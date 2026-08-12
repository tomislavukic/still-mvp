const service = require('../services/RetailerDirectoryService');

class RetailerDirectory {
  load(market) {
    return service.market(market);
  }

  all() {
    return service.all();
  }

  find(id, market = null) {
    const source = market ? this.load(market) : this.all();

    return source.find(
      retailer => retailer.id.toLowerCase() === String(id).toLowerCase()
    ) || null;
  }

  search(query, market = null) {
    const text = String(query || '').trim().toLowerCase();

    if (!text) return [];

    const source = market ? this.load(market) : this.all();

    return source.filter(retailer =>
      retailer.id.toLowerCase().includes(text) ||
      retailer.name.toLowerCase().includes(text)
    );
  }

  byMarket(market) {
    return this.load(market);
  }
}

module.exports = RetailerDirectory;

