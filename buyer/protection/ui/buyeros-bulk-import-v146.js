(() => {
  'use strict';

  const STORAGE_KEY =
    'still-ownership-passports-v83';

  const MODAL_ID =
    'buyerOSBulkImportV146';

  const STYLE_ID =
    'buyerOSBulkImportV146Style';

  let parsedRows = [];

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const isHr = () =>
    $('#language')?.value === 'hr';

  const t = (en, hr) =>
    isHr() ? hr : en;

  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      })[char]
    );

  function clean(value) {
    return String(
      value ?? ''
    ).trim();
  }

  function readThings() {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || '[]'
        );

      return Array.isArray(value)
        ? value
        : [];
    } catch {
      return [];
    }
  }

  function writeThings(data) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    window.dispatchEvent(
      new CustomEvent(
        'still:ownership-updated',
        {
          detail:{
            source:'bulk-import-v146',
            count:data.length
          }
        }
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        'still:buyeros-data-updated',
        {
          detail:{
            key:STORAGE_KEY,
            count:data.length
          }
        }
      )
    );
  }

  function uid() {
    if (
      globalThis.crypto &&
      typeof crypto.randomUUID ===
        'function'
    ) {
      return (
        'thing-' +
        crypto.randomUUID()
      );
    }

    return (
      'thing-' +
      Date.now() +
      '-' +
      performance.now()
        .toString(36)
        .replace('.','')
    );
  }

  function normalizeHeader(
    value
  ) {
    const header =
      clean(value)
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          ''
        );

    const aliases = {
      name:'title',
      naziv:'title',
      title:'title',
      stvar:'title',

      type:'kind',
      vrsta:'kind',
      kind:'kind',

      brand:'brand',
      marka:'brand',

      model:'model',

      serial:'serialNumber',
      serialnumber:'serialNumber',
      serijskibroj:'serialNumber',

      purchasedate:'purchaseDate',
      datumkupnje:'purchaseDate',
      date:'purchaseDate',

      price:'purchasePrice',
      purchaseprice:'purchasePrice',
      cijena:'purchasePrice',

      store:'business',
      retailer:'business',
      business:'business',
      kupljenokod:'business',
      trgovac:'business',

      warranty:'warrantyUntil',
      warrantyuntil:'warrantyUntil',
      jamstvo:'warrantyUntil',
      jamstvodo:'warrantyUntil',

      returnby:'returnBy',
      povratdo:'returnBy',

      renewal:'renewalAt',
      renewalat:'renewalAt',
      obnova:'renewalAt',

      location:'location',
      lokacija:'location',

      notes:'notes',
      biljeske:'notes',
      napomena:'notes'
    };

    return (
      aliases[header] ||
      header
    );
  }

  function splitCSVLine(line) {
    const result = [];
    let current = '';
    let quoted = false;

    for (
      let i = 0;
      i < line.length;
      i++
    ) {
      const char =
        line[i];

      if (
        char === '"'
      ) {
        if (
          quoted &&
          line[i + 1] === '"'
        ) {
          current += '"';
          i++;
        } else {
          quoted = !quoted;
        }

        continue;
      }

      if (
        char === ',' &&
        !quoted
      ) {
        result.push(
          current
        );

        current = '';
        continue;
      }

      current += char;
    }

    result.push(current);

    return result.map(clean);
  }

  function detectDelimiter(
    text
  ) {
    const first =
      text.split(/\r?\n/)
        .find(line =>
          clean(line)
        ) || '';

    if (
      first.includes('\t')
    ) {
      return '\t';
    }

    if (
      first.includes(';') &&
      !first.includes(',')
    ) {
      return ';';
    }

    return ',';
  }

  function splitLine(
    line,
    delimiter
  ) {
    if (
      delimiter === ','
    ) {
      return splitCSVLine(
        line
      );
    }

    return line
      .split(delimiter)
      .map(clean);
  }

  function simpleLineMode(
    lines
  ) {
    return lines
      .map(line => clean(line))
      .filter(Boolean)
      .map(title => ({
        title,
        kind:'product'
      }));
  }

  function tableMode(
    lines,
    delimiter
  ) {
    const rows =
      lines
        .map(line =>
          splitLine(
            line,
            delimiter
          )
        )
        .filter(row =>
          row.some(Boolean)
        );

    if (
      rows.length < 2
    ) {
      return [];
    }

    const headers =
      rows[0].map(
        normalizeHeader
      );

    const known =
      headers.filter(header =>
        [
          'title',
          'kind',
          'brand',
          'model',
          'serialNumber',
          'purchaseDate',
          'purchasePrice',
          'business',
          'warrantyUntil',
          'returnBy',
          'renewalAt',
          'location',
          'notes'
        ].includes(header)
      );

    if (!known.length)
      return [];

    return rows
      .slice(1)
      .map(row => {
        const record = {};

        headers.forEach(
          (header,index) => {
            if (!header)
              return;

            record[header] =
              clean(
                row[index]
              );
          }
        );

        return record;
      })
      .filter(record =>
        clean(record.title)
      );
  }

  function parseInput(text) {
    const lines =
      String(text || '')
        .split(/\r?\n/)
        .filter(line =>
          clean(line)
        );

    if (!lines.length)
      return [];

    const delimiter =
      detectDelimiter(text);

    const table =
      tableMode(
        lines,
        delimiter
      );

    if (table.length)
      return table;

    return simpleLineMode(
      lines
    );
  }

  function normalizedKind(
    value
  ) {
    const kind =
      clean(value)
        .toLowerCase();

    const supported = [
      'product',
      'service',
      'subscription',
      'rental',
      'booking'
    ];

    return supported.includes(kind)
      ? kind
      : 'product';
  }

  function buildRecord(row) {
    const now =
      new Date().toISOString();

    return {
      id:uid(),

      title:
        clean(row.title),

      kind:
        normalizedKind(
          row.kind
        ),

      brand:
        clean(row.brand),

      model:
        clean(row.model),

      serialNumber:
        clean(
          row.serialNumber
        ),

      purchaseDate:
        clean(
          row.purchaseDate
        ),

      purchasedOn:
        clean(
          row.purchaseDate
        ),

      purchasePrice:
        clean(
          row.purchasePrice
        ),

      business:
        clean(
          row.business
        ),

      warrantyUntil:
        clean(
          row.warrantyUntil
        ),

      returnBy:
        clean(
          row.returnBy
        ),

      renewalAt:
        clean(
          row.renewalAt
        ),

      location:
        clean(
          row.location
        ),

      notes:
        clean(
          row.notes
        ),

      serviceHistory:[],

      createdAt:now,
      updatedAt:now
    };
  }

  function installStyles() {
    if (
      document.getElementById(
        STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id = STYLE_ID;

    style.textContent = `
      #${MODAL_ID}{
        position:fixed;
        inset:0;
        z-index:10030;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(8,14,18,.48);
        backdrop-filter:blur(18px)
      }

      #${MODAL_ID}[hidden]{
        display:none
      }

      .bos146-modal{
        width:min(920px,100%);
        max-height:calc(100vh - 40px);
        overflow:auto;
        border:1px solid var(--line,#d9e1e5);
        border-radius:23px;
        background:var(--surface,#fff);
        box-shadow:0 35px 110px rgba(0,0,0,.27)
      }

      .bos146-head{
        display:flex;
        justify-content:space-between;
        gap:18px;
        padding:20px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      .bos146-head h2{
        margin:4px 0 0;
        font-size:25px;
        letter-spacing:-.04em
      }

      .bos146-head p{
        max-width:620px;
        margin:6px 0 0;
        color:var(--muted,#66727a);
        font-size:10px;
        line-height:1.55
      }

      .bos146-close{
        width:34px;
        height:34px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:50%;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        cursor:pointer
      }

      .bos146-body{
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr);
        gap:14px;
        padding:18px
      }

      .bos146-panel{
        min-width:0
      }

      .bos146-label{
        display:block;
        margin-bottom:6px;
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:820;
        letter-spacing:.06em;
        text-transform:uppercase
      }

      .bos146-input{
        width:100%;
        box-sizing:border-box;
        min-height:370px;
        resize:vertical;
        border:1px solid var(--line,#d9e1e5);
        border-radius:14px;
        padding:13px;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        font:inherit;
        font-size:11px;
        line-height:1.55;
        outline:none
      }

      .bos146-help{
        margin-top:8px;
        color:var(--muted,#66727a);
        font-size:9px;
        line-height:1.5
      }

      .bos146-preview{
        display:grid;
        gap:6px;
        max-height:410px;
        overflow:auto
      }

      .bos146-row{
        display:grid;
        grid-template-columns:34px minmax(0,1fr) auto;
        gap:9px;
        align-items:center;
        padding:9px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:12px
      }

      .bos146-index{
        width:32px;
        height:32px;
        display:grid;
        place-items:center;
        border-radius:9px;
        background:var(--soft,#f3f6f4);
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:800
      }

      .bos146-row b{
        display:block;
        font-size:10px
      }

      .bos146-row small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:8px
      }

      .bos146-remove{
        width:28px;
        height:28px;
        border:0;
        border-radius:50%;
        background:transparent;
        color:var(--muted,#66727a);
        cursor:pointer
      }

      .bos146-empty{
        min-height:180px;
        display:grid;
        place-items:center;
        padding:20px;
        border:1px dashed var(--line,#d9e1e5);
        border-radius:14px;
        text-align:center;
        color:var(--muted,#66727a);
        font-size:10px
      }

      .bos146-footer{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        padding:14px 18px;
        border-top:1px solid var(--line,#d9e1e5)
      }

      .bos146-count{
        font-size:10px;
        color:var(--muted,#66727a)
      }

      .bos146-actions{
        display:flex;
        gap:7px
      }

      .bos146-actions button{
        min-height:38px;
        padding:0 13px;
        border-radius:10px;
        font:inherit;
        font-size:10px;
        font-weight:800;
        cursor:pointer
      }

      .bos146-secondary{
        border:1px solid var(--line,#d9e1e5);
        background:var(--surface,#fff);
        color:var(--ink,#111)
      }

      .bos146-primary{
        border:0;
        background:var(--accent,#6558e8);
        color:#fff
      }

      .bos146-primary:disabled{
        opacity:.45;
        cursor:not-allowed
      }

      .bos146-launch{
        margin-left:7px
      }

      @media(max-width:760px){
        .bos146-body{
          grid-template-columns:1fr
        }

        .bos146-input{
          min-height:240px
        }
      }
    `;

    document.head
      .appendChild(style);
  }

  function createModal() {
    if (
      document.getElementById(
        MODAL_ID
      )
    ) {
      return;
    }

    const modal =
      document.createElement(
        'div'
      );

    modal.id = MODAL_ID;
    modal.hidden = true;

    modal.innerHTML = `
      <section
        class="bos146-modal"
        role="dialog"
        aria-modal="true"
      >
        <header class="bos146-head">
          <div>
            <span class="bos132-eyebrow">
              ${esc(
                t(
                  'BULK IMPORT',
                  'MASOVNI UNOS'
                )
              )}
            </span>

            <h2>
              ${esc(
                t(
                  'Bring many things into Still.',
                  'Dodaj više stvari u Still.'
                )
              )}
            </h2>

            <p>
              ${esc(
                t(
                  'Paste one thing per line, or paste a table from Numbers, Excel or a CSV file. Review everything before it is saved.',
                  'Zalijepi jednu stvar po retku ili tablicu iz Numbersa, Excela ili CSV datoteke. Sve pregledaj prije spremanja.'
                )
              )}
            </p>
          </div>

          <button
            type="button"
            class="bos146-close"
            data-v146-close
          >
            ×
          </button>
        </header>

        <div class="bos146-body">
          <section class="bos146-panel">
            <label class="bos146-label">
              ${esc(
                t(
                  'PASTE YOUR THINGS',
                  'ZALIJEPI SVOJE STVARI'
                )
              )}
            </label>

            <textarea
              class="bos146-input"
              data-v146-input
              spellcheck="false"
              placeholder="${esc(
                t(
                  'MacBook Pro\nSony TV\nDyson V15\nBosch dishwasher',
                  'MacBook Pro\nSony TV\nDyson V15\nBosch perilica posuđa'
                )
              )}"
            ></textarea>

            <div class="bos146-help">
              ${esc(
                t(
                  'For detailed imports use columns such as: Name, Brand, Model, Serial Number, Purchase Date, Price, Store, Warranty, Location, Notes.',
                  'Za detaljniji unos koristi stupce: Naziv, Marka, Model, Serijski broj, Datum kupnje, Cijena, Trgovac, Jamstvo, Lokacija, Bilješke.'
                )
              )}
            </div>
          </section>

          <section class="bos146-panel">
            <label class="bos146-label">
              ${esc(
                t(
                  'PREVIEW',
                  'PREGLED'
                )
              )}
            </label>

            <div
              class="bos146-preview"
              data-v146-preview
            ></div>
          </section>
        </div>

        <footer class="bos146-footer">
          <span
            class="bos146-count"
            data-v146-count
          >
            0
          </span>

          <div class="bos146-actions">
            <button
              type="button"
              class="bos146-secondary"
              data-v146-clear
            >
              ${esc(
                t(
                  'Clear',
                  'Očisti'
                )
              )}
            </button>

            <button
              type="button"
              class="bos146-primary"
              data-v146-import
              disabled
            >
              ${esc(
                t(
                  'Import into Still',
                  'Uvezi u Still'
                )
              )}
            </button>
          </div>
        </footer>
      </section>
    `;

    document.body
      .appendChild(modal);

    modal.addEventListener(
      'click',
      event => {
        if (
          event.target ===
          modal
        ) {
          closeModal();
        }
      }
    );

    $('[data-v146-close]', modal)
      ?.addEventListener(
        'click',
        closeModal
      );

    $('[data-v146-input]', modal)
      ?.addEventListener(
        'input',
        event => {
          parsedRows =
            parseInput(
              event.target.value
            );

          renderPreview();
        }
      );

    $('[data-v146-clear]', modal)
      ?.addEventListener(
        'click',
        () => {
          parsedRows = [];

          const input =
            $('[data-v146-input]', modal);

          if (input)
            input.value = '';

          renderPreview();
        }
      );

    $('[data-v146-import]', modal)
      ?.addEventListener(
        'click',
        importRows
      );
  }

  function renderPreview() {
    const modal =
      document.getElementById(
        MODAL_ID
      );

    if (!modal)
      return;

    const preview =
      $('[data-v146-preview]', modal);

    const count =
      $('[data-v146-count]', modal);

    const importButton =
      $('[data-v146-import]', modal);

    count.textContent =
      t(
        `${parsedRows.length} items ready`,
        `${parsedRows.length} stavki spremno`
      );

    importButton.disabled =
      !parsedRows.length;

    if (
      !parsedRows.length
    ) {
      preview.innerHTML = `
        <div class="bos146-empty">
          ${esc(
            t(
              'Your preview will appear here before anything is saved.',
              'Pregled će se pojaviti ovdje prije nego što se išta spremi.'
            )
          )}
        </div>
      `;

      return;
    }

    preview.innerHTML =
      parsedRows.map(
        (row,index) => `
          <article class="bos146-row">
            <span class="bos146-index">
              ${index + 1}
            </span>

            <div>
              <b>
                ${esc(
                  row.title ||
                  t(
                    'Untitled thing',
                    'Stvar bez naziva'
                  )
                )}
              </b>

              <small>
                ${esc(
                  [
                    row.brand,
                    row.model,
                    row.business,
                    row.purchaseDate
                  ]
                    .filter(Boolean)
                    .join(' · ') ||
                  t(
                    'Basic ownership record',
                    'Osnovni zapis vlasništva'
                  )
                )}
              </small>
            </div>

            <button
              type="button"
              class="bos146-remove"
              data-v146-remove="${index}"
            >
              ×
            </button>
          </article>
        `
      ).join('');

    $$(
      '[data-v146-remove]',
      preview
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => {
          parsedRows.splice(
            Number(
              button.dataset
                .v146Remove
            ),
            1
          );

          renderPreview();
        }
      );
    });
  }

  function importRows() {
    if (
      !parsedRows.length
    ) {
      return;
    }

    const existing =
      readThings();

    const records =
      parsedRows
        .filter(row =>
          clean(row.title)
        )
        .map(
          buildRecord
        );

    writeThings([
      ...existing,
      ...records
    ]);

    parsedRows = [];

    closeModal();

    history.replaceState(
      null,
      '',
      '#buyeros-things'
    );

    window.dispatchEvent(
      new Event(
        'hashchange'
      )
    );
  }

  function openModal() {
    installStyles();
    createModal();

    const modal =
      document.getElementById(
        MODAL_ID
      );

    modal.hidden = false;

    parsedRows = [];

    const input =
      $('[data-v146-input]', modal);

    if (input)
      input.value = '';

    renderPreview();

    setTimeout(() => {
      input?.focus();
    },0);
  }

  function closeModal() {
    const modal =
      document.getElementById(
        MODAL_ID
      );

    if (modal)
      modal.hidden = true;
  }

  function installLaunchButton() {
    $$(
      '[data-bos132-add="thing"]'
    ).forEach(addButton => {
      const container =
        addButton.parentElement;

      if (
        !container ||
        container.querySelector(
          '[data-v146-launch]'
        )
      ) {
        return;
      }

      const button =
        document.createElement(
          'button'
        );

      button.type =
        'button';

      button.className =
        addButton.className +
        ' bos146-launch';

      button.dataset
        .v146Launch =
        'true';

      button.textContent =
        t(
          'Bulk import',
          'Masovni unos'
        );

      button.addEventListener(
        'click',
        event => {
          event.preventDefault();
          openModal();
        }
      );

      addButton.insertAdjacentElement(
        'afterend',
        button
      );
    });
  }

  function boot() {
    installStyles();
    createModal();
    installLaunchButton();

    const observer =
      new MutationObserver(
        installLaunchButton
      );

    observer.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
      }
    );

    document.addEventListener(
      'keydown',
      event => {
        if (
          event.key ===
          'Escape' &&
          !document.getElementById(
            MODAL_ID
          )?.hidden
        ) {
          closeModal();
        }
      }
    );
  }

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once:true }
    );
  } else {
    boot();
  }
})();

