(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const isCroatian = () => document.documentElement.lang !== "en";
  const t = (hr, en) => isCroatian() ? hr : en;

  const PLAN_LEVEL = {
    free: 0,
    trial: 1,
    starter: 1,
    growth: 2,
    professional: 3,
    pro: 3,
    enterprise: 4
  };

  let organization = null;
  let banner = null;
  let dialog = null;

  function currentPlan(org) {
    return String(
      org?.subscription_plan ||
      org?.billing_plan ||
      org?.plan ||
      org?.subscription?.plan ||
      "free"
    ).trim().toLowerCase();
  }

  function verified(org) {
    return String(org?.status || "").toLowerCase() === "verified";
  }

  function planAllows(requiredPlan, actualPlan) {
    const required = PLAN_LEVEL[String(requiredPlan || "free").toLowerCase()] ?? 0;
    const actual = PLAN_LEVEL[String(actualPlan || "free").toLowerCase()] ?? 0;
    return actual >= required;
  }

  function installStyles() {
    if ($("#companyProgressiveAccessStylesV108")) return;

    const style = document.createElement("style");
    style.id = "companyProgressiveAccessStylesV108";
    style.textContent = `
      .cpa108 {
        width: min(1180px, calc(100% - 28px));
        margin: 18px auto 22px;
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--green) 9%, var(--surface)),
            var(--surface)
          );
        box-shadow: 0 18px 48px rgba(20,42,66,.09);
      }

      .cpa108-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
      }

      .cpa108-kicker {
        color: var(--green);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .1em;
      }

      .cpa108 h2 {
        margin: 6px 0 5px;
        font-size: clamp(23px,3vw,35px);
        letter-spacing: -.045em;
      }

      .cpa108 p {
        max-width: 720px;
        margin: 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.55;
      }

      .cpa108-progress {
        min-width: 90px;
        text-align: right;
      }

      .cpa108-progress b {
        display: block;
        font-size: 29px;
      }

      .cpa108-progress small {
        color: var(--muted);
        font-size: 10px;
      }

      .cpa108-track {
        overflow: hidden;
        height: 7px;
        margin: 16px 0 14px;
        border-radius: 999px;
        background: var(--surface2);
      }

      .cpa108-track i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--green);
      }

      .cpa108-steps {
        display: grid;
        grid-template-columns: repeat(4,minmax(0,1fr));
        gap: 9px;
      }

      .cpa108-step {
        display: flex;
        gap: 9px;
        min-height: 70px;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 15px;
        background: color-mix(in srgb,var(--surface) 90%,transparent);
      }

      .cpa108-step > span {
        display: grid;
        flex: 0 0 27px;
        width: 27px;
        height: 27px;
        place-items: center;
        border-radius: 50%;
        background: var(--surface2);
        color: var(--muted);
        font-size: 12px;
        font-weight: 900;
      }

      .cpa108-step.done > span {
        background: var(--green);
        color: white;
      }

      .cpa108-step b,
      .cpa108-step small {
        display: block;
      }

      .cpa108-step b {
        font-size: 12px;
      }

      .cpa108-step small {
        margin-top: 3px;
        color: var(--muted);
        font-size: 10px;
        line-height: 1.4;
      }

      .cpa108-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }

      .cpa108-actions button,
      .cpa108-actions a {
        display: inline-flex;
        min-height: 42px;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
        color: var(--ink);
        padding: 0 14px;
        font-size: 12px;
        font-weight: 850;
        text-decoration: none;
        cursor: pointer;
      }

      .cpa108-actions .primary {
        border-color: var(--green);
        background: var(--green);
        color: white;
      }

      .cpa108-action-locked {
        opacity: .52 !important;
        filter: grayscale(.45);
        cursor: not-allowed !important;
      }

      [data-progressive-locked="true"] {
        position: relative !important;
        opacity: .7;
        filter: grayscale(.25);
      }

      [data-progressive-locked="true"]::after {
        content: attr(data-progressive-label);
        position: absolute;
        inset: 8px;
        z-index: 20;
        display: grid;
        place-items: center;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: color-mix(in srgb,var(--surface) 86%,transparent);
        color: var(--ink);
        padding: 14px;
        text-align: center;
        font-size: 11px;
        font-weight: 850;
        line-height: 1.45;
        backdrop-filter: blur(8px);
        pointer-events: none;
      }

      .cpa108-dialog {
        width: min(520px,calc(100% - 24px));
        padding: 0;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: var(--surface);
        color: var(--ink);
        box-shadow: 0 30px 100px rgba(0,0,0,.35);
      }

      .cpa108-dialog::backdrop {
        background: rgba(5,12,20,.62);
        backdrop-filter: blur(7px);
      }

      .cpa108-dialog-inner {
        padding: 27px;
      }

      .cpa108-dialog-inner > span {
        color: var(--green);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .1em;
      }

      .cpa108-dialog h3 {
        margin: 8px 0;
        font-size: 28px;
        letter-spacing: -.04em;
      }

      .cpa108-dialog p {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .cpa108-dialog ul {
        margin: 15px 0;
        padding-left: 20px;
        font-size: 12px;
        line-height: 1.8;
      }

      .cpa108-dialog footer {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 18px;
        padding: 0;
        background: transparent;
      }

      .cpa108-dialog button,
      .cpa108-dialog a {
        display: inline-flex;
        min-height: 42px;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--line);
        border-radius: 11px;
        background: var(--surface);
        color: var(--ink);
        padding: 0 14px;
        font-weight: 850;
        text-decoration: none;
        cursor: pointer;
      }

      .cpa108-dialog .primary {
        border-color: var(--green);
        background: var(--green);
        color: white;
      }

      @media(max-width:800px) {
        .cpa108-steps {
          grid-template-columns: repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:520px) {
        .cpa108-head {
          display: grid;
          grid-template-columns: 1fr auto;
        }

        .cpa108-steps {
          grid-template-columns: 1fr;
        }

        .cpa108-actions {
          display: grid;
          grid-template-columns: 1fr;
        }

        .cpa108-actions button,
        .cpa108-actions a {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function stepsFor(org) {
    return [
      {
        title: t("Profil tvrtke","Company profile"),
        description: t("Osnovni identitet organizacije","Basic organization identity"),
        complete: Boolean(org?.name || org?.company_name)
      },
      {
        title: t("Adresa","Address"),
        description: t("Sjedište ili poslovna lokacija","Registered or operating address"),
        complete: Boolean(org?.address_verified || org?.address)
      },
      {
        title: t("Porezni podaci","Tax information"),
        description: t("OIB ili VAT podaci","Tax or VAT details"),
        complete: Boolean(
          org?.vat_verified ||
          org?.tax_verified ||
          org?.vat_number ||
          org?.tax_id
        )
      },
      {
        title: t("Verifikacija","Verification"),
        description: t(
          "Otključava javne i financijske radnje",
          "Unlocks public and financial operations"
        ),
        complete: verified(org)
      }
    ];
  }

  function renderBanner(org) {
    const steps = stepsFor(org);
    const completed = steps.filter(step => step.complete).length;
    const percentage = Math.round((completed / steps.length) * 100);
    const plan = currentPlan(org);

    if (!banner) {
      banner = document.createElement("section");
      banner.id = "companyProgressiveAccessV108";
      banner.className = "cpa108";

      const target =
        $("#businessWorkbenchV72") ||
        $("#companyPortalV46") ||
        $("main");

      if (target) target.insertAdjacentElement("beforebegin", banner);
      else document.body.prepend(banner);
    }

    banner.innerHTML = `
      <div class="cpa108-head">
        <div>
          <span class="cpa108-kicker">
            ${t("POSTAVLJANJE RADNOG PROSTORA","WORKSPACE SETUP")}
          </span>

          <h2>
            ${
              verified(org)
                ? t(
                    "Tvoj radni prostor je verificiran.",
                    "Your workspace is verified."
                  )
                : t(
                    "Cijela platforma je vidljiva od prvog dana.",
                    "The complete platform is visible from day one."
                  )
            }
          </h2>

          <p>
            ${
              verified(org)
                ? t(
                    `Aktivan plan: ${plan}. Dostupnost pojedinih značajki ovisi o planu.`,
                    `Current plan: ${plan}. Individual features depend on your plan.`
                  )
                : t(
                    "Slobodno istraži cijeli radni prostor. Samo osjetljive javne, financijske i kupčeve radnje ostaju zaključane do verifikacije.",
                    "Explore the full workspace. Only sensitive public, financial and buyer-facing operations remain locked until verification."
                  )
            }
          </p>
        </div>

        <div class="cpa108-progress">
          <b>${percentage}%</b>
          <small>${t("postavljeno","complete")}</small>
        </div>
      </div>

      <div class="cpa108-track">
        <i style="width:${percentage}%"></i>
      </div>

      <div class="cpa108-steps">
        ${steps.map(step => `
          <div class="cpa108-step ${step.complete ? "done" : ""}">
            <span>${step.complete ? "✓" : "○"}</span>
            <div>
              <b>${step.title}</b>
              <small>${step.description}</small>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="cpa108-actions">
        ${
          !verified(org)
            ? `
              <a class="primary" href="#companyPortalV46">
                ${t("Dovrši verifikaciju","Complete verification")}
              </a>
            `
            : ""
        }

        <a href="#companyBilling">
          ${t(`Plan: ${plan}`,`Plan: ${plan}`)}
        </a>

        <button type="button" data-cpa-explore>
          ${t("Pregledaj cijeli radni prostor","Explore full workspace")}
        </button>
      </div>
    `;
  }

  function ensureDialog() {
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "companyProgressiveAccessDialogV108";
    dialog.className = "cpa108-dialog";
    document.body.appendChild(dialog);

    dialog.addEventListener("click", event => {
      if (
        event.target === dialog ||
        event.target.closest("[data-cpa-close]")
      ) {
        dialog.close();
      }
    });

    return dialog;
  }

  function showLocked(requirement) {
    const modal = ensureDialog();
    const verification = requirement.type === "verification";
    const requiredPlan = requirement.plan || "growth";

    modal.innerHTML = `
      <div class="cpa108-dialog-inner">
        <span>
          ${
            verification
              ? t("VERIFIKACIJA ORGANIZACIJE","ORGANIZATION VERIFICATION")
              : t("PLAN PRETPLATE","SUBSCRIPTION PLAN")
          }
        </span>

        <h3>
          ${
            verification
              ? t("Ova radnja još je zaključana.","This action is still locked.")
              : t("Ova značajka zahtijeva viši plan.","This feature requires a higher plan.")
          }
        </h3>

        <p>
          ${
            verification
              ? t(
                  "Ostatak platforme ostaje dostupan. Verifikacija je potrebna samo za javne, financijske i kupčeve radnje.",
                  "The rest of the platform remains available. Verification is required only for public, financial and buyer-facing operations."
                )
              : t(
                  `Možeš pregledati cijeli modul, ali aktivne radnje zahtijevaju plan ${requiredPlan}.`,
                  `You can preview the complete module, but active operations require the ${requiredPlan} plan.`
                )
          }
        </p>

        <ul>
          ${
            verification
              ? `
                <li>${t("Izdavanje javnih QR kodova","Issuing public QR codes")}</li>
                <li>${t("Povezivanje kupaca","Connecting buyers")}</li>
                <li>${t("Primanje i povrat plaćanja","Receiving and refunding payments")}</li>
              `
              : `
                <li>${t("Modul ostaje vidljiv","The module remains visible")}</li>
                <li>${t("Pregled i primjeri ostaju dostupni","Preview and examples remain available")}</li>
                <li>${t("Nadogradnja otključava aktivne radnje","Upgrading unlocks active operations")}</li>
              `
          }
        </ul>

        <footer>
          <button type="button" data-cpa-close>
            ${t("Nastavi pregledavati","Keep exploring")}
          </button>

          <a
            class="primary"
            href="${verification ? "#companyPortalV46" : "#companyBilling"}"
          >
            ${
              verification
                ? t("Dovrši verifikaciju","Complete verification")
                : t("Pregledaj planove","View plans")
            }
          </a>
        </footer>
      </div>
    `;

    modal.showModal();
  }

  function actionRequirement(element) {
    if (element.matches("[data-requires-verification]")) {
      return {
        locked: !verified(organization),
        type: "verification"
      };
    }

    const requiredPlan =
      element.dataset.requiresPlan ||
      element.dataset.planRequired;

    if (requiredPlan) {
      return {
        locked: !planAllows(requiredPlan, currentPlan(organization)),
        type: "plan",
        plan: requiredPlan
      };
    }

    const signature = [
      element.id,
      element.dataset.action,
      element.dataset.feature,
      element.getAttribute("aria-label"),
      element.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const sensitive =
      /publish|issue|activate|connect buyer|payment|payout|refund|public qr|objavi|izdaj|aktiviraj|poveži kupca|plaćanje|isplata|povrat/i;

    if (!verified(organization) && sensitive.test(signature)) {
      return {
        locked: true,
        type: "verification"
      };
    }

    return { locked: false };
  }

  function decorateKnownLocks() {
    const plan = currentPlan(organization);

    $$("[data-requires-verification]").forEach(element => {
      const locked = !verified(organization);
      element.dataset.progressiveLocked = String(locked);

      if (locked) {
        element.dataset.progressiveLabel =
          "🔒 " + t(
            "Vidljivo sada. Aktivne radnje otključavaju se nakon verifikacije.",
            "Visible now. Active operations unlock after verification."
          );
      } else {
        delete element.dataset.progressiveLabel;
      }
    });

    $$("[data-requires-plan], [data-plan-required]").forEach(element => {
      const requiredPlan =
        element.dataset.requiresPlan ||
        element.dataset.planRequired ||
        "growth";

      const locked = !planAllows(requiredPlan, plan);
      element.dataset.progressiveLocked = String(locked);

      if (locked) {
        element.dataset.progressiveLabel =
          "🔒 " + t(
            `Pregled je dostupan. Aktivne radnje zahtijevaju plan ${requiredPlan}.`,
            `Preview available. Active operations require the ${requiredPlan} plan.`
          );
      } else {
        delete element.dataset.progressiveLabel;
      }
    });
  }

  function revealWorkspace() {
    document.body.classList.add("company-progressive-workspace");

    $$(
      "[data-verification-hidden]," +
      "[data-demo-only]," +
      "[data-requires-verification]," +
      "[data-requires-plan]," +
      "[data-plan-required]"
    ).forEach(element => {
      element.hidden = false;
      element.removeAttribute("aria-hidden");
    });
  }

  function installActionGuard() {
    document.addEventListener(
      "click",
      event => {
        const element = event.target.closest(
          "button, a, [role='button']"
        );

        if (!element || element.closest(".cpa108")) return;

        const requirement = actionRequirement(element);
        if (!requirement.locked) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        showLocked(requirement);
      },
      true
    );
  }

  function apply(org) {
    organization = org || window.__stillOrganization || {};

    installStyles();
    revealWorkspace();
    renderBanner(organization);
    decorateKnownLocks();

    window.dispatchEvent(
      new CustomEvent("still:progressive-company-ready", {
        detail: {
          organization,
          verified: verified(organization),
          plan: currentPlan(organization)
        }
      })
    );
  }

  function start() {
    if (!document.body.classList.contains("business-page")) return;

    installActionGuard();

    if (window.__stillOrganization) {
      apply(window.__stillOrganization);
    }
  }

  window.addEventListener("still:company-authenticated", event => {
    apply(event.detail?.organization);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
