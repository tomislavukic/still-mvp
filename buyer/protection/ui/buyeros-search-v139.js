(() => {
  'use strict';

  const OWNERSHIP_KEY = 'still-ownership-passports-v83';
  const DOCUMENTS_KEY = 'still-buyeros-documents-v132';
  const SELECTED_KEY = 'still-buyeros-selected-thing-v135';

  const OVERLAY_ID = 'buyerOSUniversalSearchV139';
  const INPUT_ID = 'buyerOSUniversalSearchInputV139';
  const RESULTS_ID = 'buyerOSUniversalSearchResultsV139';
  const STYLE_ID = 'buyerOSUniversalSearchStyleV139';

  let selectedIndex = 0;
  let currentResults = [];

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

  function readArray(key) {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(key) || '[]'
        );

      return Array.isArray(value)
        ? value
        : [];
    } catch {
      return [];
    }
  }

  function things() {
    return readArray(OWNERSHIP_KEY);
  }

  function documents() {
    return readArray(DOCUMENTS_KEY);
  }

  function serviceHistory(item) {
    return Array.isArray(item.serviceHistory)
      ? item.serviceHistory
      : [];
  }

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase(
        isHr() ? 'hr' : 'en'
      );
  }

  function thingDocs(item) {
    const title =
      normalize(item.title);

    return documents().filter(doc =>
      doc.thingId === item.id ||
      doc.relatedThingId === item.id ||
      (
        title &&
        normalize(doc.relatedThing) === title
      )
    );
  }

  function searchableText(item) {
    const docs =
      thingDocs(item);

    const services =
      serviceHistory(item);

    return normalize([
      item.title,
      item.brand,
      item.manufacturer,
      item.model,
      item.modelName,
      item.serialNumber,
      item.serial,
      item.business,
      item.store,
      item.kind,
      item.notes,
      item.location,
      item.owner,
      item.warrantyUntil,
      item.returnBy,
      item.renewalAt,

      ...docs.flatMap(doc => [
        doc.title,
        doc.type,
        doc.date,
        doc.issuer,
        doc.business,
        doc.notes
      ]),

      ...services.flatMap(event => [
        event.title,
        event.type,
        event.providerName,
        event.occurredOn,
        event.notes
      ])
    ].filter(Boolean).join(' '));
  }

  function scoreItem(item, query) {
    const needle =
      normalize(query);

    if (!needle)
      return 1;

    const title =
      normalize(item.title);

    const brand =
      normalize(
        item.brand ||
        item.manufacturer
      );

    const model =
      normalize(
        item.model ||
        item.modelName
      );

    const serial =
      normalize(
        item.serialNumber ||
        item.serial
      );

    const text =
      searchableText(item);

    let score = 0;

    if (title === needle)
      score += 100;

    if (title.startsWith(needle))
      score += 70;

    if (title.includes(needle))
      score += 50;

    if (serial.includes(needle))
      score += 45;

    if (brand.includes(needle))
      score += 35;

    if (model.includes(needle))
      score += 35;

    if (text.includes(needle))
      score += 20;

    needle
      .split(/\s+/)
      .filter(Boolean)
      .forEach(token => {
        if (text.includes(token))
          score += 5;
      });

    return score;
  }

  function reasonFor(item, query) {
    const needle =
      normalize(query);

    if (!needle) {
      return t(
        'Ownership record',
        'Zapis vlasništva'
      );
    }

    if (
      normalize(
        item.serialNumber ||
        item.serial
      ).includes(needle)
    ) {
      return t(
        'Serial number',
        'Serijski broj'
      );
    }

    if (
      thingDocs(item).some(doc =>
        normalize(
          `${doc.title} ${doc.type} ${doc.notes}`
        ).includes(needle)
      )
    ) {
      return t(
        'Found in documents',
        'Pronađeno u dokumentima'
      );
    }

    if (
      serviceHistory(item).some(event =>
        normalize(
          `${event.title} ${event.providerName} ${event.type} ${event.notes}`
        ).includes(needle)
      )
    ) {
      return t(
        'Found in service history',
        'Pronađeno u servisnoj povijesti'
      );
    }

    if (
      normalize(
        item.brand ||
        item.manufacturer
      ).includes(needle)
    ) {
      return t(
        'Brand',
        'Marka'
      );
    }

    if (
      normalize(
        item.business ||
        item.store
      ).includes(needle)
    ) {
      return t(
        'Retailer or provider',
        'Trgovac ili pružatelj'
      );
    }

    return t(
      'Matching ownership data',
      'Podudaranje u podacima vlasništva'
    );
  }

  function search(query) {
    return things()
      .map(item => ({
        item,
        score:scoreItem(item, query),
        reason:reasonFor(item, query)
      }))
      .filter(entry =>
        entry.score > 0
      )
      .sort(
        (a,b) =>
          b.score - a.score
      )
      .slice(0,30);
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
      document.createElement('style');

    style.id = STYLE_ID;

    style.textContent = `
      #${OVERLAY_ID}{
        position:fixed;
        inset:0;
        z-index:10000;
        display:grid;
        place-items:start center;
        padding-top:min(14vh,130px);
        background:rgba(10,16,14,.38);
        backdrop-filter:blur(18px)
      }

      #${OVERLAY_ID}[hidden]{
        display:none
      }

      .bos139-panel{
        width:min(720px,calc(100% - 28px));
        max-height:72vh;
        overflow:hidden;
        border:1px solid var(--line,#d9e1e5);
        border-radius:22px;
        background:var(--surface,#fff);
        box-shadow:0 28px 90px rgba(0,0,0,.24)
      }

      .bos139-head{
        display:grid;
        grid-template-columns:34px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        padding:15px 16px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      .bos139-head input{
        width:100%;
        border:0;
        outline:0;
        background:transparent;
        color:var(--ink,#111);
        font:inherit;
        font-size:18px
      }

      .bos139-head button{
        border:0;
        border-radius:8px;
        padding:6px 8px;
        background:var(--soft,#f3f6f4);
        color:var(--muted,#66727a);
        font-size:9px;
        cursor:pointer
      }

      .bos139-meta{
        display:flex;
        justify-content:space-between;
        gap:12px;
        padding:8px 16px;
        border-bottom:1px solid var(--line,#d9e1e5);
        color:var(--muted,#66727a);
        font-size:9px
      }

      .bos139-results{
        max-height:52vh;
        overflow:auto;
        padding:8px
      }

      .bos139-result{
        width:100%;
        display:grid;
        grid-template-columns:42px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        padding:10px;
        border:0;
        border-radius:13px;
        background:transparent;
        color:var(--ink,#111);
        text-align:left;
        cursor:pointer
      }

      .bos139-result:hover,
      .bos139-result[data-selected="true"]{
        background:var(--soft,#f3f6f4)
      }

      .bos139-icon{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        border:1px solid var(--line,#d9e1e5);
        border-radius:12px;
        background:var(--surface,#fff)
      }

      .bos139-result b{
        display:block;
        font-size:12px
      }

      .bos139-result small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      .bos139-empty{
        padding:34px 20px;
        text-align:center;
        color:var(--muted,#66727a)
      }

      .bos139-empty b{
        display:block;
        margin-bottom:5px;
        color:var(--ink,#111)
      }

      @media(max-width:600px){
        #${OVERLAY_ID}{
          padding-top:20px
        }

        .bos139-panel{
          max-height:calc(100vh - 40px)
        }

        .bos139-results{
          max-height:calc(100vh - 150px)
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createOverlay() {
    if (
      document.getElementById(
        OVERLAY_ID
      )
    ) {
      return;
    }

    const overlay =
      document.createElement('div');

    overlay.id =
      OVERLAY_ID;

    overlay.hidden = true;

    overlay.innerHTML = `
      <section
        class="bos139-panel"
        role="dialog"
        aria-modal="true"
      >
        <div class="bos139-head">
          <span>⌕</span>

          <input
            id="${INPUT_ID}"
            type="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="${esc(
              t(
                'Search things, brands, serials, documents, services…',
                'Traži stvari, marke, serijske brojeve, dokumente, servise…'
              )
            )}"
          >

          <button
            type="button"
            data-v139-close
          >
            ESC
          </button>
        </div>

        <div class="bos139-meta">
          <span>
            ${esc(
              t(
                'Universal BuyerOS search',
                'Univerzalna BuyerOS pretraga'
              )
            )}
          </span>

          <span>
            ↑ ↓ · Enter
          </span>
        </div>

        <div
          id="${RESULTS_ID}"
          class="bos139-results"
        ></div>
      </section>
    `;

    document.body.appendChild(
      overlay
    );

    overlay.addEventListener(
      'click',
      event => {
        if (
          event.target === overlay
        ) {
          closeSearch();
        }
      }
    );

    overlay.querySelector(
      '[data-v139-close]'
    )?.addEventListener(
      'click',
      closeSearch
    );

    document.getElementById(
      INPUT_ID
    )?.addEventListener(
      'input',
      event =>
        render(
          event.target.value
        )
    );
  }

  function iconFor(item) {
    switch (item.kind) {
      case 'service':
        return '◎';
      case 'subscription':
        return '↻';
      case 'booking':
        return '⌁';
      default:
        return '◇';
    }
  }

  function render(query = '') {
    const root =
      document.getElementById(
        RESULTS_ID
      );

    if (!root)
      return;

    currentResults =
      search(query);

    selectedIndex = 0;

    if (
      !currentResults.length
    ) {
      root.innerHTML = `
        <div class="bos139-empty">
          <b>
            ${esc(
              t(
                'Nothing found.',
                'Ništa nije pronađeno.'
              )
            )}
          </b>

          ${esc(
            t(
              'Search uses only information already stored in BuyerOS.',
              'Pretraga koristi samo podatke već spremljene u BuyerOS-u.'
            )
          )}
        </div>
      `;

      return;
    }

    root.innerHTML =
      currentResults
        .map(
          (entry,index) => {
            const item =
              entry.item;

            const subtitle = [
              item.brand ||
              item.manufacturer,
              item.model ||
              item.modelName,
              item.business ||
              item.store,
              entry.reason
            ]
              .filter(Boolean)
              .join(' · ');

            return `
              <button
                type="button"
                class="bos139-result"
                data-v139-index="${index}"
                data-selected="${
                  index === 0
                    ? 'true'
                    : 'false'
                }"
              >
                <span class="bos139-icon">
                  ${iconFor(item)}
                </span>

                <span>
                  <b>
                    ${esc(
                      item.title ||
                      t(
                        'Untitled thing',
                        'Stvar bez naziva'
                      )
                    )}
                  </b>

                  <small>
                    ${esc(subtitle)}
                  </small>
                </span>

                <span>→</span>
              </button>
            `;
          }
        )
        .join('');

    root.querySelectorAll(
      '[data-v139-index]'
    )
      .forEach(button => {
        button.addEventListener(
          'click',
          () =>
            openResult(
              Number(
                button.dataset
                  .v139Index
              )
            )
        );
      });
  }

  function updateSelection() {
    const buttons =
      $$('#' + RESULTS_ID + ' [data-v139-index]');

    buttons.forEach(
      (button,index) => {
        button.dataset.selected =
          String(
            index ===
            selectedIndex
          );
      }
    );

    buttons[selectedIndex]
      ?.scrollIntoView({
        block:'nearest'
      });
  }

  function openResult(index) {
    const entry =
      currentResults[index];

    if (
      !entry?.item?.id
    ) {
      return;
    }

    sessionStorage.setItem(
      SELECTED_KEY,
      entry.item.id
    );

    history.replaceState(
      null,
      '',
      '#buyeros-thing'
    );

    closeSearch();

    window.dispatchEvent(
      new CustomEvent(
        'still:ownership-updated',
        {
          detail:{
            thingId:entry.item.id,
            source:'search-v139'
          }
        }
      )
    );
  }

  function openSearch() {
    installStyles();
    createOverlay();

    const overlay =
      document.getElementById(
        OVERLAY_ID
      );

    overlay.hidden = false;

    render('');

    setTimeout(() => {
      const input =
        document.getElementById(
          INPUT_ID
        );

      if (!input)
        return;

      input.value = '';
      input.focus();
    },0);
  }

  function closeSearch() {
    const overlay =
      document.getElementById(
        OVERLAY_ID
      );

    if (overlay)
      overlay.hidden = true;
  }

  function bind() {
    document.addEventListener(
      'click',
      event => {
        const trigger =
          event.target.closest(
            '[data-bos-search], [data-bos132-nav="search"]'
          );

        if (!trigger)
          return;

        event.preventDefault();

        openSearch();
      }
    );

    document.addEventListener(
      'keydown',
      event => {
        const overlay =
          document.getElementById(
            OVERLAY_ID
          );

        const opened =
          overlay &&
          !overlay.hidden;

        if (
          (event.metaKey ||
           event.ctrlKey) &&
          event.key
            .toLowerCase() === 'k'
        ) {
          event.preventDefault();

          opened
            ? closeSearch()
            : openSearch();

          return;
        }

        if (!opened)
          return;

        if (
          event.key === 'Escape'
        ) {
          event.preventDefault();
          closeSearch();
          return;
        }

        if (
          event.key === 'ArrowDown'
        ) {
          event.preventDefault();

          selectedIndex =
            Math.min(
              selectedIndex + 1,
              currentResults.length - 1
            );

          updateSelection();
          return;
        }

        if (
          event.key === 'ArrowUp'
        ) {
          event.preventDefault();

          selectedIndex =
            Math.max(
              selectedIndex - 1,
              0
            );

          updateSelection();
          return;
        }

        if (
          event.key === 'Enter' &&
          currentResults.length
        ) {
          event.preventDefault();

          openResult(
            selectedIndex
          );
        }
      }
    );
  }

  function boot() {
    installStyles();
    createOverlay();
    bind();
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

