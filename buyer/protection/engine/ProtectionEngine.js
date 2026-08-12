const RetailerDirectory = require('../providers/RetailerDirectory');
const WarrantyEngine = require('./WarrantyEngine');
const RecallEngine = require('./RecallEngine');
const ReturnPolicyEngine = require('./ReturnPolicyEngine');

class ProtectionEngine {
  constructor() {
    this.directory = new RetailerDirectory();
    this.warranty = new WarrantyEngine();
    this.recalls = new RecallEngine();
    this.returns = new ReturnPolicyEngine(this.directory);
  }

  loadMarket(market) {
    return this.directory.byMarket(market);
  }

  retailer(id, market = null) {
    return this.directory.find(id, market);
  }

  searchRetailers(query, market = null) {
    return this.directory.search(query, market);
  }

  async analyze(product = {}) {
    const [recalls] = await Promise.all([
      this.recalls.check(product)
    ]);

    const warranty = this.warranty.calculate(product);
    const returns = this.returns.evaluate(product);

    return {
      productId: product.id || null,
      retailer: returns.retailer || null,
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

module.exports = ProtectionEngine;

