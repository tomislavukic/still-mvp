(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const STATES = Object.freeze({
    AVAILABLE: "available",
    VERIFY: "verify",
    PLAN: "plan",
    COMING_SOON: "coming-soon"
  });

  const PLAN_LEVEL = Object.freeze({
    free: 0,
    trial: 1,
    starter: 1,
    growth: 2,
    professional: 3,
    pro: 3,
    enterprise: 4
  });

  const CAPABILITIES = Object.freeze({
    dashboard: { state: STATES.AVAILABLE },
    organization: { state: STATES.AVAILABLE },
    products: { state: STATES.AVAILABLE },
    qr: { state: STATES.AVAILABLE },

    returns: { state: STATES.VERIFY },
    buyers: { state: STATES.VERIFY },
    payments: { state: STATES.VERIFY },

    analytics: { state: STATES.PLAN, plan: "growth" },
    intelligence: { state: STATES.PLAN, plan: "growth" },
    automation: { state: STATES.PLAN, plan: "professional" },
    exports: { state: STATES.PLAN, plan: "growth" },
    api: { state: STATES.PLAN, plan: "professional" },

    warehouses: { state: STATES.COMING_SOON }
  });

  const AUTO_MARKERS = [
    {
      capability: "analytics",
      pattern: /\banalytics\b|\banalitika\b/i
    },
    {
      capability: "intelligence",
      pattern: /platform intelligence|inteligencija platforme/i
    },
    {
      capability: "automation",
      pattern: /\bautomation\b|\bautomatizacija\b/i
    },
    {
      capability: "warehouses",
      pattern: /\bwarehouses?\b|\bskladišt/i
    },
    {
      capability: "api",
      pattern: /\bapi\b/i
    },
    {
      capability: "exports",
      pattern: /\bexports?\b|\bizvoz/i
    },
    {
      capability: "returns",
      pattern: /\breturns?\b|\bpovrati?\b|\breklamacij/i
    },
    {
      capability: "buyers",
      pattern: /buyer wallet|buyer connections|kupci|novčanik kupca/i
    },
    {
      capability: "payments",
      pattern: /\bpayments?\b|\bstripe\b|\bplaćanj/i
    },
    {
      capability: "qr",
      pattern: /\bqr\b/i
    }
  ];

  let organization = window.__stillOrganization || null;
  let dialog = null;

  const isCroatian = () => document.documentElement.lang !== "en";
  const t = (hr, en) => isCroatian() ? hr : en;

  function normalizedPlan(org = organization) {
    return String(
      org?.subscription_plan ||
      org?.billing_plan ||
      org?.subscription?.plan ||
      org?.plan ||
      "free"
    ).trim().toLowerCase();
  }

  function isVerified(org = organization) {
    return String(org?.status || "").trim().toLowerCase() === "verified";
  }

  function planAllows(requiredPlan, actualPlan = normalizedPlan()) {
    const required = PLAN_LEVEL[String(requiredPlan || "free").toLowerCase()] ?? 0;
    const actual = PLAN_LEVEL[String(actualPlan || "free").toLowerCase()] ?? 0;
    return actual >= required;
  }

  function capabilityDefinition(name) {
    return CAPABILITIES[name] || {
      state: STATES.COMING_SOON
    };
  }

  function effectiveState(name) {
    const definition = capabilityDefinition(name);

    if (definition.state === STATES.VERIFY) {
      return isVerified() ? STATES.AVAILABLE : STATES.VERIFY;
    }

    if (definition.state === STATES.PLAN) {
      return planAllows(definition.plan)
        ? STATES.AVAILABLE
        : STATES.PLAN;
    }

    return definition.state;
  }

  function autoMark(root = document) {
    const candidates = $$(
      "button, a, [role='button'], [data-tab], nav li, aside li",
      root
    );

    candidates.forEach(element => {
      if (element.dataset.capability) return;

      const signature = [
        element.dataset.tab,
        element.dataset.action,
        element.dataset.feature,
        element.getAttribute("aria-label"),
        element.textContent
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!signature) return;

      const match = AUTO_MARKERS.find(item => item.pattern.test(signature));
      if (match) element.dataset.capability = match.capability;
    });
  }

  function badgeText(state, definition) {
    if (state === STATES.VERIFY) {
      return t("Potrebna verifikacija", "Verification required");
    }

    if (state === STATES.PLAN) {
      return t(
        `Potreban plan ${definition.plan}`,
        `${definition.plan} plan required`
      );
    }

    if (state === STATES.COMING_SOON) {
      return t("Uskoro", "Coming soon");
    }

    return t("Dostupno", "Available");
  }

  function decorate(element) {
    const capability = element.dataset.capability;
    if (!capability) return;

    const definition = capabilityDefinition(capability);
    const state = effectiveState(capability);

    element.dataset.capabilityState = state;
    element.classList.toggle(
      "capability-access-locked",
      state !== STATES.AVAILABLE
    );

    element.setAttribute(
      "aria-disabled",
      state === STATES.AVAILABLE ? "false" : "true"
    );

    element.title = state === STATES.AVAILABLE
      ? ""
      : badgeText(state, definition);

    let badge = $(":scope > .capability-pill", element);

    if (state === STATES.AVAILABLE) {
      badge?.remove();
      return;
    }

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "capability-pill";
      badge.setAttribute("aria-hidden", "true");
      element.appendChild(badge);
    }

    badge.className = `capability-pill ${state}`;
    badge.textContent = state === STATES.VERIFY
      ? "🔒"
      : state === STATES.PLAN
        ? "◆"
        : "◷";
  }

  function refresh(root = document) {
    autoMark(root);
    $$("[data-capability]", root).forEach(decorate);
  }

  function ensureDialog() {
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "companyCapabilityDialogV1";
    dialog.className = "capability-dialog";
    document.body.appendChild(dialog);

    dialog.addEventListener("click", event => {
      if (
        event.target === dialog ||
        event.target.closest("[data-capability-close]")
      ) {
        dialog.close();
      }
    });

    return dialog;
  }

  function showRequirement(capability) {
    const definition = capabilityDefinition(capability);
    const state = effectiveState(capability);
    const modal = ensureDialog();

    const verification = state === STATES.VERIFY;
    const subscription = state === STATES.PLAN;
    const comingSoon = state === STATES.COMING_SOON;

    const title = verification
      ? t("Potrebna je verifikacija", "Verification required")
      : subscription
        ? t("Potreban je drugi plan", "A different plan is required")
        : t("Značajka dolazi uskoro", "This feature is coming soon");

    const description = verification
      ? t(
          "Modul ostaje vidljiv, ali aktivne javne, financijske ili kupčeve radnje otključavaju se nakon verifikacije organizacije.",
          "The module remains visible, but active public, financial or buyer-facing operations unlock after organization verification."
        )
      : subscription
        ? t(
            `Modul možeš pregledati, ali aktivne radnje zahtijevaju plan ${definition.plan}.`,
            `You can preview the module, but active operations require the ${definition.plan} plan.`
          )
        : t(
            "Ovaj modul je prikazan kako bi radni prostor ostao potpun, ali još nije dostupan za korištenje.",
            "This module is shown to keep the workspace complete, but it is not available for use yet."
          );

    modal.innerHTML = `
      <div class="capability-dialog-inner">
        <span class="capability-dialog-kicker">
          ${t("PRISTUP ZNAČAJCI", "FEATURE ACCESS")}
        </span>

        <h3>${title}</h3>
        <p>${description}</p>

        <div class="capability-dialog-state">
          <b>${capability}</b>
          <span>${badgeText(state, definition)}</span>
        </div>

        <footer>
          <button type="button" data-capability-close>
            ${t("Nastavi pregledavati", "Keep exploring")}
          </button>

          ${
            comingSoon
              ? ""
              : `
                <a
                  class="primary"
                  href="${verification ? "#companyPortalV46" : "#companyBilling"}"
                >
                  ${
                    verification
                      ? t("Dovrši verifikaciju", "Complete verification")
                      : t("Pregledaj planove", "View plans")
                  }
                </a>
              `
          }
        </footer>
      </div>
    `;

    modal.showModal();
  }

  function installClickGuard() {
    document.addEventListener(
      "click",
      event => {
        const target = event.target.closest("[data-capability]");
        if (!target) return;

        const capability = target.dataset.capability;
        const state = effectiveState(capability);

        if (state === STATES.AVAILABLE) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        showRequirement(capability);
      },
      true
    );
  }

  window.StillCapabilities = {
    STATES,
    definitions: CAPABILITIES,

    state(name) {
      return effectiveState(name);
    },

    allowed(name) {
      return effectiveState(name) === STATES.AVAILABLE;
    },

    refresh
  };

  window.addEventListener("still:company-authenticated", event => {
    organization = event.detail?.organization || organization;
    window.__stillOrganization = organization;
    refresh();
  });

  window.addEventListener("still:progressive-company-ready", event => {
    organization = event.detail?.organization || organization;
    refresh();
  });

  function start() {
    if (!document.body.classList.contains("business-page")) return;

    installClickGuard();
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
