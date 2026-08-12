class Retailer {
    constructor(data = {}) {
        this.id = data.id || "";
        this.name = data.name || "";
        this.country = data.country || "";
        this.policyUrl = data.policyUrl || "";
        this.website = data.website || "";
        this.support = data.support || "";
        this.verified = Boolean(data.verified);
    }
}

module.exports = Retailer;

