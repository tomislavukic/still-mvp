class RecallEngine {
  async check(product = {}) {
    const recalls = Array.isArray(product.recalls)
      ? product.recalls
      : [];

    return {
      checked: recalls.length > 0,
      recalls,
      affected: recalls.length > 0,
      status: recalls.length > 0
        ? 'recall-present'
        : 'no-recall-data'
    };
  }
}

module.exports = RecallEngine;
