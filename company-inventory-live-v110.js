(() => {
  "use strict";

  const API = "/api/v1/business/inventory";
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  let root;
  let data = null;
  let loading = false;
  let error = "";

  async function api(path = "", options = {}) {
    const response = await fetch(API + path, {
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const requestError = new Error(
        payload.error || `HTTP ${response.status}`
      );

      requestError.payload = payload;
      throw requestError;
    }

    return payload;
  }

  function installStyles() {
    if ($("#companyInventoryLiveStylesV110")) return;

    const style = document.createElement("style");
    style.id = "companyInventoryLiveStylesV110";

    style.textContent = `
      .inventory-live-v110 {
        margin: 20px 0;
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: var(--surface);
      }

      .inventory-live-v110 header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }

      .inventory-live-v110 h3 {
        margin: 6px 0;
        font-size: 30px;
        letter-spacing: -.04em;
      }

      .inventory-live-v110 .kicker {
        color: var(--green);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .1em;
      }

      .inventory-live-v110 p {
        margin: 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }

      .inventory-live-v110 .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .inventory-live-v110 button {
        min-height: 40px;
        padding: 0 13px;
        border: 1px solid var(--line);
        border-radius: 11px;
        background: var(--surface2);
        color: var(--ink);
        font-weight: 800;
        cursor: pointer;
      }

      .inventory-live-v110 button.primary {
        border-color: var(--green);
        background: var(--green);
        color: white;
      }

      .inventory-live-v110 button:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .inventory-live-v110 .metrics {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
        margin: 16px 0;
      }

      .inventory-live-v110 .metrics article {
        padding: 13px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface2);
      }

      .inventory-live-v110 .metrics b,
      .inventory-live-v110 .metrics span {
        display: block;
      }

      .inventory-live-v110 .metrics b {
        font-size: 22px;
      }

      .inventory-live-v110 .metrics span {
        color: var(--muted);
        font-size: 9px;
      }

      .inventory-live-v110 .table-wrap {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 16px;
      }

      .inventory-live-v110 table {
        width: 100%;
        min-width: 760px;
        border-collapse: collapse;
      }

      .inventory-live-v110 th,
      .inventory-live-v110 td {
        padding: 11px 12px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        font-size: 11px;
      }

      .inventory-live-v110 th {
        color: var(--muted);
        font-size: 9px;
      }

      .inventory-live-v110 tr:last-child td {
        border-bottom: 0;
      }

      .inventory-live-v110 .empty,
      .inventory-live-v110 .error,
      .inventory-live-v110 .loading {
        margin-top: 16px;
        padding: 28px;
        border: 1px dashed var(--line);
        border-radius: 16px;
        text-align: center;
        color: var(--muted);
      }

      .inventory-live-v110 .error {
        color: #b91c1c;
      }

      .inventory-live-v110 .form {
        margin-top: 16px;
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--surface2);
      }

      .inventory-live-v110 .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .inventory-live-v110 label {
        display: grid;
        gap: 5px;
        margin-top: 10px;
      }

      .inventory-live-v110 label span {
        color: var(--muted);
        font-size: 9px;
        font-weight: 800;
      }

      .inventory-live-v110 input,
      .inventory-live-v110 select,
      .inventory-live-v110 textarea {
        width: 100%;
        min-height: 40px;
        box-sizing: border-box;
        padding: 9px 10px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--surface);
        color: var(--ink);
      }

      .inventory-live-v110 textarea {
        min-height: 80px;
        resize: vertical;
      }

      .inventory-live-v110 .form footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
        padding: 0;
        background: transparent;
      }

      .inventory-live-v110 .history {
        margin-top: 18px;
      }

      .inventory-live-v110 .history h4 {
        margin: 0 0 8px;
      }

      .inventory-live-v110 .movement {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--line);
        font-size: 10px;
      }

      .inventory-live-v110 .movement:last-child {
        border-bottom: 0;
      }

      .inventory-live-v110 .movement b,
      .inventory-live-v110 .movement small {
        display: block;
      }

      .inventory-live-v110 .movement small {
        margin-top: 3px;
        color: var(--muted);
      }

      @media (max-width: 760px) {
        .inventory-live-v110 header {
          display: grid;
        }

        .inventory-live-v110 .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .inventory-live-v110 .form-grid {
          grid-template-columns: 1fr;
        }

        .inventory-live-v110 .actions {
          display: grid;
          grid-template-columns: 1fr;
        }

        .inventory-live-v110 .actions button {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function formMarkup(type) {
    if (type === "location") {
      return `
        <form class="form" data-inventory-form="location">
          <div class="form-grid">
            <label>
              <span>Location name</span>
              <input
                name="name"
                required
                maxlength="160"
                autocomplete="organization"
              >
            </label>

            <label>
              <span>Code</span>
              <input
                name="code"
                required
                maxlength="40"
                placeholder="ZG-WH"
              >
            </label>
          </div>

          <label>
            <span>Address</span>
            <input
              name="address"
              maxlength="300"
              autocomplete="street-address"
            >
          </label>

          <footer>
            <button type="button" data-close-form>
              Cancel
            </button>

            <button class="primary" type="submit">
              Add location
            </button>
          </footer>
        </form>
      `;
    }

    if (type === "item") {
      return `
        <form class="form" data-inventory-form="item">
          <div class="form-grid">
            <label>
              <span>SKU</span>
              <input
                name="sku"
                required
                maxlength="120"
                autocomplete="off"
              >
            </label>

            <label>
              <span>Item name</span>
              <input
                name="name"
                required
                maxlength="220"
                autocomplete="off"
              >
            </label>

            <label>
              <span>Barcode</span>
              <input
                name="barcode"
                maxlength="80"
                autocomplete="off"
              >
            </label>

            <label>
              <span>Unit</span>
              <input
                name="unit"
                value="unit"
                maxlength="30"
                autocomplete="off"
              >
            </label>

            <label>
              <span>Reorder point</span>
              <input
                name="reorderPoint"
                type="number"
                min="0"
                value="0"
                required
              >
            </label>
          </div>

          <footer>
            <button type="button" data-close-form>
              Cancel
            </button>

            <button class="primary" type="submit">
              Add item
            </button>
          </footer>
        </form>
      `;
    }

    const items = data?.items || [];
    const locations = data?.locations || [];

    return `
      <form class="form" data-inventory-form="adjustment">
        <div class="form-grid">
          <label>
            <span>Item</span>

            <select name="itemId" required>
              <option value="">Choose</option>

              ${items.map(item => `
                <option value="${esc(item.publicId)}">
                  ${esc(item.sku)} · ${esc(item.name)}
                </option>
              `).join("")}
            </select>
          </label>

          <label>
            <span>Location</span>

            <select name="locationId" required>
              <option value="">Choose</option>

              ${locations.map(location => `
                <option value="${esc(location.publicId)}">
                  ${esc(location.code)} · ${esc(location.name)}
                </option>
              `).join("")}
            </select>
          </label>

          <label>
            <span>Quantity change</span>

            <input
              name="quantityDelta"
              type="number"
              value="0"
              required
            >
          </label>

          <label>
            <span>Reserved change</span>

            <input
              name="reservedDelta"
              type="number"
              value="0"
              required
            >
          </label>
        </div>

        <label>
          <span>Reason</span>

          <textarea
            name="reason"
            required
            minlength="3"
            maxlength="300"
            placeholder="Goods receipt, correction, reservation…"
          ></textarea>
        </label>

        <footer>
          <button type="button" data-close-form>
            Cancel
          </button>

          <button
            class="primary"
            type="submit"
            ${!items.length || !locations.length ? "disabled" : ""}
          >
            Save movement
          </button>
        </footer>
      </form>
    `;
  }

  function movementsMarkup() {
    const movements = data?.movements || [];

    if (!movements.length) {
      return `
        <div class="empty">
          No stock movements yet.
        </div>
      `;
    }

    return movements.slice(0, 20).map(movement => {
      const quantity = Number(movement.quantity_delta || 0);
      const sign = quantity > 0 ? "+" : "";

      return `
        <article class="movement">
          <div>
            <b>
              ${esc(movement.item_name)} ·
              ${esc(movement.location_name)}
            </b>

            <small>${esc(movement.reason)}</small>
          </div>

          <div>
            <b>${sign}${quantity}</b>

            <small>
              ${new Date(movement.created_at).toLocaleString()}
            </small>
          </div>
        </article>
      `;
    }).join("");
  }

  function render(formType = "") {
    if (!root) return;

    if (loading) {
      root.innerHTML = `
        <div class="loading">
          Loading real inventory…
        </div>
      `;

      return;
    }

    if (error) {
      root.innerHTML = `
        <div class="error">
          <b>Inventory could not be loaded</b>
          <p>${esc(error)}</p>
          <button data-retry>Try again</button>
        </div>
      `;

      return;
    }

    if (!data) return;

    const summary = data.summary || {};
    const balances = data.balances || [];

    root.innerHTML = `
      <header>
        <div>
          <span class="kicker">LIVE · D1 DATA</span>

          <h3>Inventory and locations</h3>

          <p>
            Every stock change creates a persistent movement record
            and updates the organization balance.
          </p>
        </div>

        <div class="actions">
          <button data-open-form="location">
            + Location
          </button>

          <button data-open-form="item">
            + Item
          </button>

          <button
            class="primary"
            data-open-form="adjustment"
          >
            ± Stock movement
          </button>
        </div>
      </header>

      <div class="metrics">
        <article>
          <b>${summary.items || 0}</b>
          <span>items</span>
        </article>

        <article>
          <b>${summary.locations || 0}</b>
          <span>locations</span>
        </article>

        <article>
          <b>${summary.onHand || 0}</b>
          <span>on hand</span>
        </article>

        <article>
          <b>${summary.reserved || 0}</b>
          <span>reserved</span>
        </article>

        <article>
          <b>${summary.reorder || 0}</b>
          <span>reorder</span>
        </article>
      </div>

      ${balances.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Location</th>
                <th>On hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              ${balances.map(row => `
                <tr>
                  <td>${esc(row.sku)}</td>
                  <td>${esc(row.itemName)}</td>
                  <td>${esc(row.locationName)}</td>
                  <td>${Number(row.onHand || 0)}</td>
                  <td>${Number(row.reserved || 0)}</td>
                  <td>${Number(row.available || 0)}</td>
                  <td>${esc(row.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty">
          <b>No inventory balances yet.</b>

          <p>
            Add a location and item, then record the first
            stock movement.
          </p>
        </div>
      `}

      ${formType ? formMarkup(formType) : ""}

      <section class="history">
        <h4>Recent stock movements</h4>
        ${movementsMarkup()}
      </section>
    `;
  }

  async function load() {
    loading = true;
    error = "";
    render();

    try {
      data = await api();
    } catch (requestError) {
      error =
        requestError.payload?.error ||
        requestError.message;
    } finally {
      loading = false;
      render();
    }
  }

  async function submit(form) {
    const type = form.dataset.inventoryForm;
    const values = Object.fromEntries(new FormData(form));

    let path = "";
    let payload = values;

    if (type === "location") {
      path = "/locations";
    }

    if (type === "item") {
      path = "/items";
      payload.reorderPoint = Number(payload.reorderPoint);
    }

    if (type === "adjustment") {
      path = "/adjustments";
      payload.quantityDelta = Number(payload.quantityDelta);
      payload.reservedDelta = Number(payload.reservedDelta);
    }

    const submitButton = $(
      'button[type="submit"]',
      form
    );

    submitButton.disabled = true;

    try {
      await api(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      await load();
    } catch (requestError) {
      window.alert(
        requestError.payload?.error ||
        requestError.message
      );

      submitButton.disabled = false;
    }
  }

  function mount() {
    if (root) return;

    const host =
      document.querySelector("[data-cuw109-host]") ||
      document.querySelector("#companyUnifiedWorkspaceV109") ||
      document.querySelector("main");

    if (!host) {
      window.setTimeout(mount, 250);
      return;
    }

    installStyles();

    root = document.createElement("section");
    root.id = "companyInventoryLiveV110";
    root.className = "inventory-live-v110";

    host.prepend(root);

    root.addEventListener("click", event => {
      const open = event.target.closest(
        "[data-open-form]"
      );

      if (open) {
        render(open.dataset.openForm);
        return;
      }

      if (event.target.closest("[data-close-form]")) {
        render();
        return;
      }

      if (event.target.closest("[data-retry]")) {
        load();
      }
    });

    root.addEventListener("submit", event => {
      const form = event.target.closest(
        "[data-inventory-form]"
      );

      if (!form) return;

      event.preventDefault();
      submit(form);
    });

    load();
  }

  window.addEventListener(
    "still:company-authenticated",
    mount
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      mount,
      { once: true }
    );
  } else {
    mount();
  }
})();
