(() => {
"use strict";

const STATES = {
    AVAILABLE: "available",
    VERIFY: "verify",
    PLAN: "plan",
    COMING_SOON: "coming-soon"
};

const CAPABILITIES = {
    dashboard: STATES.AVAILABLE,
    products: STATES.AVAILABLE,
    analytics: STATES.PLAN,
    ai: STATES.PLAN,
    returns: STATES.VERIFY,
    qr: STATES.AVAILABLE,
    exports: STATES.PLAN,
    api: STATES.PLAN,
    warehouses: STATES.COMING_SOON,
    automation: STATES.PLAN
};

window.StillCapabilities = {
    state(name) {
        return CAPABILITIES[name] || STATES.COMING_SOON;
    },

    allowed(name) {
        return this.state(name) === STATES.AVAILABLE;
    }
};

document.addEventListener("click", e => {
    const button = e.target.closest("[data-capability]");
    if (!button) return;

    const state = window.StillCapabilities.state(
        button.dataset.capability
    );

    if (state === STATES.AVAILABLE) return;

    e.preventDefault();
    e.stopPropagation();

    document.dispatchEvent(
        new CustomEvent("still:capability", {
            detail: {
                capability: button.dataset.capability,
                state
            }
        })
    );
});
})();
