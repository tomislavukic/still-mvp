class WarrantyEngine {
  calculate(product = {}) {
    const warranty = product.warranty || {};

    if (!warranty.startDate && !warranty.endDate) {
      return {
        available: false,
        active: null,
        startDate: null,
        endDate: null,
        daysRemaining: null,
        provider: null,
        status: 'unknown'
      };
    }

    const startDate = warranty.startDate
      ? new Date(warranty.startDate)
      : null;

    const endDate = warranty.endDate
      ? new Date(warranty.endDate)
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
}

module.exports = WarrantyEngine;

