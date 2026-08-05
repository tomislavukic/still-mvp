(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const LEGACY_SESSION_KEY = "still-company-demo-v102";

  let organization = window.__stillOrganization || null;
  let mounted = false;
  let saveTimer = 0;
  let observer = null;

  const isCroatian = () => document.documentElement.lang !== "en";
  const t = (hr, en) => isCroatian() ? hr : en;

  function organizationIdentity() {
    return String(
      organization?.id ||
      organization?.organization_id ||
      organization?.slug ||
      organization?.email ||
      "default-workspace"
    )
      .trim()
      .toLowerCase();
  }

  function persistentDraftKey() {
    return `still-company-workspace-drafts-v109:${organizationIdentity()}`;
  }

  function installStyles() {
    if ($("#companyUnifiedWorkspaceStylesV109")) return;

    const style = document.createElement("style");
    style.id = "companyUnifiedWorkspaceStylesV109";

    style.textContent = `
      .cuw109-shell {
        width: min(1220px, calc(100% - 28px));
        margin: 22px auto;
        border: 1px solid var(--line);
        border-radius: 26px;
        background: var(--surface);
        box-shadow: 0 24px 70px rgba(22, 45, 70, .10);
        overflow: hidden;
      }

      .cuw109-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(190px, 240px);
        gap: 20px;
        align-items: start;
        padding: 25px;
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--green) 10%, var(--surface)),
            var(--surface)
          );
      }

      .cuw109-header > div > span {
        color: var(--green);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .11em;
      }

      .cuw109-header h2 {
        margin: 7px 0 7px;
        font-size: clamp(28px, 4vw, 46px);
        line-height: 1;
        letter-spacing: -.05em;
      }

      .cuw109-header p {
        max-width: 760px;
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .cuw109-summary {
        display: grid;
        gap: 6px;
        padding: 15px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: color-mix(in srgb, var(--surface) 88%, transparent);
      }

      .cuw109-summary b {
        font-size: 13px;
      }

      .cuw109-summary small {
        color: var(--muted);
        font-size: 10px;
        line-height: 1.5;
      }

      .cuw109-legend {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 9px;
        padding: 0 25px 21px;
      }

      .cuw109-legend article {
        display: flex;
        gap: 10px;
        min-width: 0;
        padding: 13px;
        border: 1px solid var(--line);
        border-radius: 15px;
        background: var(--surface2);
      }

      .cuw109-legend i {
        display: grid;
        flex: 0 0 27px;
        width: 27px;
        height: 27px;
        place-items: center;
        border-radius: 50%;
        background: var(--surface);
        font-style: normal;
      }

      .cuw109-legend b,
      .cuw109-legend small {
        display: block;
      }

      .cuw109-legend b {
        font-size: 11px;
      }

      .cuw109-legend small {
        margin-top: 3px;
        color: var(--muted);
        font-size: 9px;
        line-height: 1.45;
      }

      .cuw109-host {
        padding: 0 18px 23px;
      }

      .cuw109-host #companyToolsPreviewV97 {
        display: block !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
      }

      .cuw109-host [hidden],
      .cuw109-host [data-demo-only],
      .cuw109-host .demo-only {
        display: revert;
      }

      .cuw109-hide-demo-entry {
        display: none !important;
      }

      .cuw109-draft-status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 24px;
        padding: 0 9px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface2);
        color: var(--muted);
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .05em;
      }

      @media (max-width: 780px) {
        .cuw109-header {
          grid-template-columns: 1fr;
          padding: 20px 16px;
        }

        .cuw109-legend {
          grid-template-columns: 1fr;
          padding-inline: 16px;
        }

        .cuw109-host {
          padding-inline: 8px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createShell() {
    let shell = $("#companyUnifiedWorkspaceV109");
    if (shell) return shell;

    shell = document.createElement("section");
    shell.id = "companyUnifiedWorkspaceV109";
    shell.className = "cuw109-shell";

    shell.innerHTML = `
      <header class="cuw109-header">
        <div>
          <span>STILL? FOR BUSINESS · UNIFIED WORKSPACE</span>

          <h2>
            ${t(
              "Jedan poslovni radni prostor.",
              "One business workspace."
            )}
          </h2>

          <p>
            ${t(
              "Funkcije iz prijašnjeg demo prikaza sada su dio glavne poslovne platforme. Moduli povezani sa Still? API-jima koriste stvarne podatke. Ostali omogućuju trajne nacrte dok se njihova objava ili vanjska integracija ne otključa.",
              "The former demo tools are now part of the main business platform. Modules connected to Still? APIs use live data. The remaining tools provide persistent drafts until publishing or an external integration is unlocked."
            )}
          </p>
        </div>

        <aside class="cuw109-summary">
          <b>${t("Radni prostor organizacije", "Organization workspace")}</b>

          <small>
            ${t(
              "Nacrti se čuvaju za ovu organizaciju na ovom uređaju. Vanjske i osjetljive radnje ostaju zaštićene verifikacijom, planom i backend dozvolama.",
              "Drafts persist for this organization on this device. External and sensitive actions remain protected by verification, plan, and backend permissions."
            )}
          </small>

          <span class="cuw109-draft-status" data-cuw109-save-status>
            ✓ ${t("Nacrti spremni", "Drafts ready")}
          </span>
        </aside>
      </header>

      <div class="cuw109-legend">
        <article>
          <i>●</i>
          <div>
            <b>${t("Uživo", "Live")}</b>
            <small>
              ${t(
                "Povezano sa stvarnim Still? API-jima i produkcijskim podacima.",
                "Connected to real Still? APIs and production data."
              )}
            </small>
          </div>
        </article>

        <article>
          <i>✎</i>
          <div>
            <b>${t("Nacrt", "Draft")}</b>
            <small>
              ${t(
                "Stvarno uređivanje, pretraživanje i izvoz bez lažnog objavljivanja.",
                "Real editing, search, and export without pretending to publish."
              )}
            </small>
          </div>
        </article>

        <article>
          <i>🔒</i>
          <div>
            <b>${t("Zaštićena radnja", "Protected action")}</b>
            <small>
              ${t(
                "Vidljiva, ali može zahtijevati verifikaciju, integraciju ili pretplatu.",
                "Visible, but may require verification, integration, or subscription."
              )}
            </small>
          </div>
        </article>
      </div>

      <div class="cuw109-host" data-cuw109-host></div>
    `;

    const workbench = $("#businessWorkbenchV72");
    const main = $("main");

    if (workbench) {
      workbench.insertAdjacentElement("afterend", shell);
    } else if (main) {
      main.appendChild(shell);
    } else {
      document.body.appendChild(shell);
    }

    return shell;
  }

  function restorePersistentDrafts() {
    try {
      const persistent = localStorage.getItem(persistentDraftKey());
      const currentSession = sessionStorage.getItem(LEGACY_SESSION_KEY);

      if (persistent && !currentSession) {
        sessionStorage.setItem(LEGACY_SESSION_KEY, persistent);
      }
    } catch (error) {
      console.warn("[Still?] Could not restore company workspace drafts.", error);
    }
  }

  function updateSaveStatus(message) {
    const status = $("[data-cuw109-save-status]");
    if (!status) return;

    status.textContent = message;
  }

  function savePersistentDraftsImmediately() {
    clearTimeout(saveTimer);

    try {
      const current = sessionStorage.getItem(LEGACY_SESSION_KEY);

      if (current) {
        localStorage.setItem(persistentDraftKey(), current);

        updateSaveStatus(
          `✓ ${t("Nacrti spremljeni", "Drafts saved")}`
        );
      }
    } catch (error) {
      updateSaveStatus(
        `! ${t("Spremanje nije uspjelo", "Save failed")}`
      );

      console.warn("[Still?] Could not save company workspace drafts.", error);
    }
  }

  function scheduleDraftSave() {
    clearTimeout(saveTimer);

    updateSaveStatus(
      `… ${t("Spremanje nacrta", "Saving drafts")}`
    );

    saveTimer = window.setTimeout(
      savePersistentDraftsImmediately,
      180
    );
  }

  function replaceText(root) {
    const replacements = [
      [
        /DEMO STUDIO · THIS TAB ONLY/gi,
        "WORKSPACE STUDIO · COMPANY DRAFTS"
      ],
      [
        /DEMO STUDIO · SAMO OVA KARTICA/gi,
        "RADNI STUDIO · NACRTI TVRTKE"
      ],
      [
        /DEMO WORKSPACE/gi,
        "BUSINESS WORKSPACE"
      ],
      [
        /DEMO RADNI PROSTOR/gi,
        "POSLOVNI RADNI PROSTOR"
      ],
      [
        /demo session/gi,
        "workspace draft history"
      ],
      [
        /demo sesij[ae]/gi,
        "povijest nacrta"
      ],
      [
        /demo records?/gi,
        "draft records"
      ],
      [
        /demo zapis(?:i|a)?/gi,
        "nacrti"
      ],
      [
        /temporary records?/gi,
        "workspace drafts"
      ],
      [
        /privremenih zapisa/gi,
        "nacrta radnog prostora"
      ],
      [
        /temporary record/gi,
        "workspace draft"
      ],
      [
        /privremeni zapis/gi,
        "nacrt radnog prostora"
      ],
      [
        /temporary action/gi,
        "draft action"
      ],
      [
        /privremena radnja/gi,
        "radnja nacrta"
      ],
      [
        /temporary CSV/gi,
        "workspace CSV"
      ],
      [
        /privremeni CSV/gi,
        "CSV radnog prostora"
      ],
      [
        /Nothing is sent to buyers, businesses or the production database\./gi,
        "Draft changes are saved to this organization workspace. Publishing and external actions use the verified live modules."
      ],
      [
        /Ništa se ne šalje kupcima, tvrtkama ni produkcijskoj bazi\./gi,
        "Promjene nacrta spremaju se u radni prostor organizacije. Objavljivanje i vanjske radnje koriste verificirane module uživo."
      ],
      [
        /NOT SAVED/gi,
        "DRAFTS SAVED"
      ],
      [
        /NE SPREMA SE/gi,
        "NACRTI SPREMLJENI"
      ],
      [
        /production data/gi,
        "until published"
      ],
      [
        /produkcijski podaci/gi,
        "do objave"
      ],
      [
        /Reset all 29 modules/gi,
        "Reset all workspace modules"
      ],
      [
        /Resetiraj svih 29 modula/gi,
        "Resetiraj sve module radnog prostora"
      ]
    ];

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach(node => {
      let next = node.nodeValue;

      replacements.forEach(([pattern, replacement]) => {
        next = next.replace(pattern, replacement);
      });

      if (next !== node.nodeValue) {
        node.nodeValue = next;
      }
    });
  }

  function hideSeparateDemoEntry() {
    $$("button, a, [role='button']").forEach(element => {
      if (element.closest("#companyUnifiedWorkspaceV109")) return;

      const signature = [
        element.textContent,
        element.getAttribute("aria-label"),
        element.dataset.action,
        element.dataset.feature
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (
        /open demo|start demo|interactive demo|demo workspace|pokreni demo|otvori demo|demo radni prostor/i.test(
          signature
        )
      ) {
        element.classList.add("cuw109-hide-demo-entry");
      }
    });
  }

  function installDraftListeners(previewRoot) {
    previewRoot.addEventListener(
      "input",
      scheduleDraftSave,
      { passive: true }
    );

    previewRoot.addEventListener(
      "change",
      scheduleDraftSave,
      { passive: true }
    );

    previewRoot.addEventListener(
      "click",
      scheduleDraftSave,
      { passive: true }
    );

    window.addEventListener(
      "beforeunload",
      savePersistentDraftsImmediately
    );
  }

  function installMutationSync(previewRoot) {
    observer?.disconnect();

    observer = new MutationObserver(mutations => {
      observer.disconnect();

      const requiresTextRefresh = mutations.some(mutation =>
        mutation.type === "characterData" ||
        mutation.addedNodes.length > 0
      );

      if (requiresTextRefresh) {
        replaceText(previewRoot);
      }

      observer.observe(previewRoot, {
        childList: true,
        subtree: true,
        characterData: true
      });

      scheduleDraftSave();
    });

    observer.observe(previewRoot, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function mountExistingStudio() {
    if (mounted) return;

    const previewRoot = $("#companyToolsPreviewV97");

    if (!previewRoot) {
      window.setTimeout(mountExistingStudio, 250);
      return;
    }

    const host = $("[data-cuw109-host]", createShell());
    if (!host) return;

    host.appendChild(previewRoot);

    previewRoot.hidden = false;
    previewRoot.removeAttribute("aria-hidden");

    replaceText(previewRoot);
    installDraftListeners(previewRoot);
    installMutationSync(previewRoot);
    hideSeparateDemoEntry();

    mounted = true;

    window.dispatchEvent(
      new CustomEvent("still:unified-company-workspace-ready", {
        detail: {
          organization,
          draftKey: persistentDraftKey()
        }
      })
    );
  }

  function start(event) {
    organization =
      event?.detail?.organization ||
      window.__stillOrganization ||
      organization;

    if (
      !organization ||
      !document.body.classList.contains("business-page")
    ) {
      return;
    }

    window.__stillOrganization = organization;

    installStyles();
    restorePersistentDrafts();
    createShell();
    hideSeparateDemoEntry();
    mountExistingStudio();
  }

  window.addEventListener(
    "still:company-authenticated",
    start
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        if (window.__stillOrganization) {
          start({
            detail: {
              organization: window.__stillOrganization
            }
          });
        }
      },
      { once: true }
    );
  } else if (window.__stillOrganization) {
    start({
      detail: {
        organization: window.__stillOrganization
      }
    });
  }
})();
