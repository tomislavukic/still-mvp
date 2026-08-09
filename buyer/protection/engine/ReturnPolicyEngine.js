class ReturnPolicyEngine {
  constructor(directory) {
    this.directory = directory;
  }

  evaluate(product = {}) {
    const retailerId = product.retailerId || null;
    const market = product.market || product.country || null;

    if (!retailerId) {
      return {
        available: false,
        retailer: null,
        status: 'retailer-missing',
        source: null,
        returnUntil: null,
        message: 'Retailer is required to find an official return policy source.'
      };
    }

    const retailer = this.directory.find(retailerId, market);

    if (!retailer) {
      return {
        available: false,
        retailer: retailerId,
        status: 'retailer-not-found',
        source: null,
        returnUntil: null,
        message: 'Retailer is not currently available in the Protection directory.'
      };
    }

    return {
      available: true,
      retailer: {
        id: retailer.id,
        name: retailer.name,
        market: retailer.market
      },
      status: retailer.verificationStatus || 'unverified',
      source: retailer.policyUrl || null,
      returnUntil: null,
      verifiedAt: retailer.verifiedAt || null,
      message:
        'Still provides the retailer source but does not assume a return deadline until the exact policy is verified.'
    };
  }
}

module.exports = ReturnPolicyEngine;
