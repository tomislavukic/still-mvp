(() => {
  'use strict';

  const STORAGE_KEY =
    'still-ownership-passports-v83';

  const BULK_MODAL_ID =
    'buyerOSBulkImportV146';

  const STYLE_ID =
    'buyerOSImportReviewV147Style';

  const PANEL_ID =
    'buyerOSImportReviewV147';

  let allowCurrentImport = false;
  let analysisTimer = null;

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

  function normalize(value) {
    return clean(value)
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        ' '
      )
      .trim();
  }

  function compact(value) {
    return normalize(value)
      .replace(/\s+/g,'');
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

  function normalizeHeader(value) {
    const key =
      normalize(value)
        .replace(/\s+/g,'');

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

      price:'purchasePrice',
      cijena:'purchasePrice',

      store:'business',
      retailer:'business',
      business:'business',
      trgovac:'business',

      warranty:'warrantyUntil',
      warrantyuntil:'warrantyUntil',
      jamstvo:'warrantyUntil',
      jamstvodo:'warrantyUntil',

      location:'location',
      lokacija:'location',

      notes:'notes',
      biljeske:'notes'
    };

    return aliases[key] || key;
  }

  function splitCSVLine(line) {
    const output = [];
    let value = '';
    let quoted = false;

    for (
      let index = 0;
      index < line.length;
      index++
    ) {
      const char =
        line[index];

      if (char === '"') {
        if (
          quoted &&
          line[index + 1] === '"'
        ) {
          value += '"';
          index++;
        } else {
          quoted = !quoted;
        }

        continue;
      }

      if (
        char === ',' &&
        !quoted
      ) {
        output.push(
          clean(value)
        );

        value = '';
        continue;
      }

      value += char;
    }

    output.push(
      clean(value)
    );

    return output;
  }

  function delimiterFor(text) {
    const first =
      String(text || '')
        .split(/\r?\n/)
        .find(line =>
          clean(line)
        ) || '';

    if (first.includes('\t'))
      return '\t';

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
    if (delimiter === ',')
      return splitCSVLine(line);

    return line
      .split(delimiter)
      .map(clean);
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
      delimiterFor(text);

    const first =
      splitLine(
        lines[0],
        delimiter
      );

    const headers =
      first.map(
        normalizeHeader
      );

    const recognized =
      headers.some(header =>
        [
          'title',
          'brand',
          'model',
          'serialNumber',
          'purchaseDate',
          'business'
        ].includes(header)
      );

    if (
      recognized &&
      lines.length > 1
    ) {
      return lines
        .slice(1)
        .map(line => {
          const values =
            splitLine(
              line,
              delimiter
            );

          const record = {};

          headers.forEach(
            (header,index) => {
              record[header] =
                clean(
                  values[index]
                );
            }
          );

          return record;
        })
        .filter(record =>
          clean(record.title)
        );
    }

    return lines.map(line => ({
      title:clean(line),
      kind:'product'
    }));
  }

  function identity(item) {
    return {
      id:
        clean(item.id),

      title:
        normalize(item.title),

      brand:
        normalize(
          item.brand ||
          item.manufacturer
        ),

      model:
        normalize(
          item.model ||
          item.modelName
        ),

      serial:
        compact(
          item.serialNumber ||
          item.serial
        )
    };
  }

  function compare(
    candidate,
    existing
  ) {
    const a =
      identity(candidate);

    const b =
      identity(existing);

    if (
      a.serial &&
      b.serial &&
      a.serial === b.serial
    ) {
      return {
        severity:'exact',
        score:100,
        reason:t(
          'Same serial number',
          'Isti serijski broj'
        )
      };
    }

    if (
      a.brand &&
      a.model &&
      b.brand &&
      b.model &&
      a.brand === b.brand &&
      a.model === b.model
    ) {
      return {
        severity:'strong',
        score:80,
        reason:t(
          'Same brand and model',
          'Ista marka i model'
        )
      };
    }

    if (
      a.title &&
      b.title &&
      a.title === b.title &&
      a.brand &&
      b.brand &&
      a.brand === b.brand
    ) {
      return {
        severity:'strong',
        score:70,
        reason:t(
          'Same name and brand',
          'Isti naziv i marka'
        )
      };
    }

    if (
      a.title &&
      b.title &&
      a.title === b.title
    ) {
      return {
        severity:'possible',
        score:45,
        reason:t(
          'Same name',
          'Isti naziv'
        )
      };
    }

    return null;
  }

  function analyse(rows) {
    const existing =
      readThings();

    const matches = [];

    rows.forEach(
      (candidate,index) => {
        existing.forEach(
          stored => {
            const result =
              compare(
                candidate,
                stored
              );

            if (!result)
              return;

            matches.push({
              source:'existing',
              candidateIndex:index,
              candidate,
              existing:stored,
              ...result
            });
          }
        );
      }
    );

    for (
      let left = 0;
      left < rows.length;
      left++
    ) {
      for (
        let right = left + 1;
        right < rows.length;
        right++
      ) {
        const result =
          compare(
            rows[left],
            rows[right]
          );

        if (!result)
          continue;

        matches.push({
          source:'batch',
          candidateIndex:right,
          candidate:rows[right],
          existing:rows[left],
          ...result
        });
      }
    }

    return matches.sort(
      (a,b) =>
        b.score - a.score
    );
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
      #${PANEL_ID}{
        margin:0 18px 14px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:15px;
        overflow:hidden;
        background:var(--surface,#fff)
      }

      #${PANEL_ID}[hidden]{
        display:none
      }

      .bos147-head{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        padding:11px 13px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      .bos147-head b{
        display:block;
        font-size:10px
      }

      .bos147-head small{
        display:block;
        margin-top:2px;
        color:var(--muted,#66727a);
        font-size:8px
      }

      .bos147-count{
        min-width:28px;
        height:28px;
        display:grid;
        place-items:center;
        border-radius:9px;
        background:rgba(181,121,26,.10);
        color:#956516;
        font-size:10px;
        font-weight:850
      }

      .bos147-list{
        max-height:220px;
        overflow:auto;
        display:grid
      }

      .bos147-match{
        display:grid;
        grid-template-columns:28px minmax(0,1fr) auto;
        gap:9px;
        align-items:center;
        padding:9px 12px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      .bos147-match:last-child{
        border-bottom:0
      }

      .bos147-icon{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        border-radius:8px;
        background:var(--soft,#f3f6f4);
        font-size:10px
      }

      .bos147-match b{
        display:block;
        font-size:9px
      }

      .bos147-match small{
        display:block;
        margin-top:2px;
        color:var(--muted,#66727a);
        font-size:8px
      }

      .bos147-level{
        display:inline-flex;
        min-height:22px;
        align-items:center;
        padding:0 7px;
        border-radius:999px;
        border:1px solid var(--line,#d9e1e5);
        color:var(--muted,#66727a);
        font-size:7px;
        font-weight:850;
        text-transform:uppercase
      }

      .bos147-level[data-level="exact"]{
        color:#a33d36;
        background:rgba(163,61,54,.08)
      }

      .bos147-level[data-level="strong"]{
        color:#956516;
        background:rgba(149,101,22,.08)
      }

      .bos147-actions{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        padding:10px 12px;
        border-top:1px solid var(--line,#d9e1e5)
      }

      .bos147-actions small{
        color:var(--muted,#66727a);
        font-size:8px;
        line-height:1.4
      }

      .bos147-override{
        min-height:31px;
        padding:0 10px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:9px;
        background:var(--surface,#fff);
        color:var(--ink,#111);
        font:inherit;
        font-size:8px;
        font-weight:800;
        cursor:pointer;
        white-space:nowrap
      }

      .bos147-override[data-active="true"]{
        background:var(--soft,#f3f6f4)
      }

      .bos147-blocked{
        animation:bos147shake .22s linear 2
      }

      @keyframes bos147shake{
        0%,100%{transform:translateX(0)}
        25%{transform:translateX(-3px)}
        75%{transform:translateX(3px)}
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function createPanel(modal) {
    if (
      document.getElementById(
        PANEL_ID
      )
    ) {
      return;
    }

    const panel =
      document.createElement(
        'section'
      );

    panel.id = PANEL_ID;
    panel.hidden = true;

    const footer =
      $('.bos146-footer', modal);

    if (footer) {
      footer.insertAdjacentElement(
        'beforebegin',
        panel
      );
    } else {
      modal
        .querySelector(
          '.bos146-modal'
        )
        ?.appendChild(panel);
    }
  }

  function levelLabel(level) {
    switch (level) {
      case 'exact':
        return t(
          'Very likely duplicate',
          'Vrlo vjerojatan duplikat'
        );

      case 'strong':
        return t(
          'Likely duplicate',
          'Vjerojatan duplikat'
        );

      default:
        return t(
          'Possible duplicate',
          'Mogući duplikat'
        );
    }
  }

  function renderAnalysis() {
    const modal =
      document.getElementById(
        BULK_MODAL_ID
      );

    if (!modal)
      return;

    createPanel(modal);

    const panel =
      document.getElementById(
        PANEL_ID
      );

    const input =
      $('[data-v146-input]', modal);

    if (
      !panel ||
      !input
    ) {
      return;
    }

    const rows =
      parseInput(
        input.value
      );

    const matches =
      analyse(rows);

    allowCurrentImport = false;

    if (
      !rows.length ||
      !matches.length
    ) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }

    panel.hidden = false;

    panel.innerHTML = `
      <div class="bos147-head">
        <div>
          <b>
            ${esc(
              t(
                'Possible duplicates found',
                'Pronađeni mogući duplikati'
              )
            )}
          </b>

          <small>
            ${esc(
              t(
                'Still compared this import with your existing ownership records and the current batch.',
                'Still je usporedio ovaj unos s postojećim zapisima vlasništva i trenutnom grupom.'
              )
            )}
          </small>
        </div>

        <span class="bos147-count">
          ${matches.length}
        </span>
      </div>

      <div class="bos147-list">
        ${
          matches
            .slice(0,20)
            .map(match => `
              <article class="bos147-match">
                <span class="bos147-icon">
                  ${
                    match.severity ===
                    'exact'
                      ? '!'
                      : '≈'
                  }
                </span>

                <div>
                  <b>
                    ${esc(
                      match.candidate.title ||
                      t(
                        'Untitled thing',
                        'Stvar bez naziva'
                      )
                    )}
                  </b>

                  <small>
                    ${esc(
                      match.reason
                    )}
                    ·
                    ${
                      match.source ===
                      'existing'
                        ? esc(
                            t(
                              'already in Still',
                              'već postoji u Stillu'
                            )
                          )
                        : esc(
                            t(
                              'duplicate inside this import',
                              'duplikat unutar ovog unosa'
                            )
                          )
                    }
                  </small>
                </div>

                <span
                  class="bos147-level"
                  data-level="${esc(
                    match.severity
                  )}"
                >
                  ${esc(
                    levelLabel(
                      match.severity
                    )
                  )}
                </span>
              </article>
            `)
            .join('')
        }
      </div>

      <div class="bos147-actions">
        <small>
          ${esc(
            t(
              'Nothing has been removed automatically. Review these matches before continuing.',
              'Ništa nije automatski uklonjeno. Pregledaj podudaranja prije nastavka.'
            )
          )}
        </small>

        <button
          type="button"
          class="bos147-override"
          data-v147-override
          data-active="false"
        >
          ${esc(
            t(
              'Import anyway',
              'Svejedno uvezi'
            )
          )}
        </button>
      </div>
    `;

    $('[data-v147-override]', panel)
      ?.addEventListener(
        'click',
        event => {
          allowCurrentImport =
            !allowCurrentImport;

          event.currentTarget
            .dataset.active =
            String(
              allowCurrentImport
            );

          event.currentTarget
            .textContent =
            allowCurrentImport
              ? t(
                  'Override enabled',
                  'Nastavak dopušten'
                )
              : t(
                  'Import anyway',
                  'Svejedno uvezi'
                );
        }
      );
  }

  function scheduleAnalysis() {
    clearTimeout(
      analysisTimer
    );

    analysisTimer =
      setTimeout(
        renderAnalysis,
        80
      );
  }

  function blockUnsafeImport(
    event
  ) {
    const button =
      event.target.closest(
        '[data-v146-import]'
      );

    if (!button)
      return;

    const modal =
      document.getElementById(
        BULK_MODAL_ID
      );

    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }

    const input =
      $('[data-v146-input]', modal);

    if (!input)
      return;

    const matches =
      analyse(
        parseInput(
          input.value
        )
      );

    if (
      !matches.length ||
      allowCurrentImport
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    renderAnalysis();

    const panel =
      document.getElementById(
        PANEL_ID
      );

    panel?.classList.remove(
      'bos147-blocked'
    );

    requestAnimationFrame(() => {
      panel?.classList.add(
        'bos147-blocked'
      );

      panel?.scrollIntoView({
        behavior:
          window.matchMedia(
            '(prefers-reduced-motion: reduce)'
          ).matches
            ? 'auto'
            : 'smooth',
        block:'nearest'
      });
    });
  }

  function bindModal(modal) {
    if (
      modal.dataset
        .v147Bound ===
      'true'
    ) {
      return;
    }

    modal.dataset
      .v147Bound =
      'true';

    createPanel(modal);

    $('[data-v146-input]', modal)
      ?.addEventListener(
        'input',
        () => {
          allowCurrentImport =
            false;

          scheduleAnalysis();
        }
      );

    $('[data-v146-clear]', modal)
      ?.addEventListener(
        'click',
        () => {
          allowCurrentImport =
            false;

          scheduleAnalysis();
        }
      );

    scheduleAnalysis();
  }

  function findModal() {
    const modal =
      document.getElementById(
        BULK_MODAL_ID
      );

    if (modal)
      bindModal(modal);
  }

  function boot() {
    installStyles();
    findModal();

    document.addEventListener(
      'click',
      blockUnsafeImport,
      true
    );

    const observer =
      new MutationObserver(
        findModal
      );

    observer.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
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

