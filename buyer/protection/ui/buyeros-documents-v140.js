(() => {
  'use strict';

  const ROOT = '#buyerOSV132';
  const STYLE_ID = 'buyerOSDocumentsV140Style';

  const OWNERSHIP_KEY =
    'still-ownership-passports-v83';

  const DOCUMENTS_KEY =
    'still-buyeros-documents-v132';

  const SELECTED_KEY =
    'still-buyeros-selected-thing-v135';

  let observer = null;
  let updateTimer = null;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const isHr = () =>
    $('#language')?.value === 'hr';

  const t = (en, hr) =>
    isHr() ? hr : en;

  const esc = value =>
    String(value ?? '')
      .replace(
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
    return readArray(
      OWNERSHIP_KEY
    );
  }

  function documents() {
    return readArray(
      DOCUMENTS_KEY
    );
  }

  function normalize(value) {
    return String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLocaleLowerCase(
        isHr() ? 'hr' : 'en'
      );
  }

  function dateText(value) {
    if (!value) return '';

    const date =
      new Date(
        String(value).length <= 10
          ? `${String(value).slice(0,10)}T12:00:00`
          : value
      );

    if (
      Number.isNaN(
        date.valueOf()
      )
    ) {
      return '';
    }

    return new Intl.DateTimeFormat(
      isHr()
        ? 'hr-HR'
        : 'en-GB',
      {
        dateStyle:'medium'
      }
    ).format(date);
  }

  function documentType(doc) {
    const source =
      normalize(
        `${doc.type || ''} ${doc.title || ''}`
      );

    if (
      /receipt|racun/.test(source)
    ) {
      return {
        id:'receipt',
        icon:'▤',
        en:'Receipt',
        hr:'Račun'
      };
    }

    if (
      /invoice|faktur/.test(source)
    ) {
      return {
        id:'invoice',
        icon:'▤',
        en:'Invoice',
        hr:'Faktura'
      };
    }

    if (
      /warranty|jamstv/.test(source)
    ) {
      return {
        id:'warranty',
        icon:'◇',
        en:'Warranty',
        hr:'Jamstvo'
      };
    }

    if (
      /manual|prirucnik|upute/.test(source)
    ) {
      return {
        id:'manual',
        icon:'≡',
        en:'Manual',
        hr:'Priručnik'
      };
    }

    if (
      /contract|ugovor/.test(source)
    ) {
      return {
        id:'contract',
        icon:'⌁',
        en:'Contract',
        hr:'Ugovor'
      };
    }

    if (
      /insurance|osiguran/.test(source)
    ) {
      return {
        id:'insurance',
        icon:'◉',
        en:'Insurance',
        hr:'Osiguranje'
      };
    }

    if (
      /service|repair|servis|poprav/.test(source)
    ) {
      return {
        id:'service',
        icon:'⌘',
        en:'Service',
        hr:'Servis'
      };
    }

    return {
      id:'other',
      icon:'▧',
      en:'Other',
      hr:'Ostalo'
    };
  }

  function relatedThing(doc) {
    const items = things();

    if (doc.thingId) {
      const exact =
        items.find(
          item =>
            item.id ===
            doc.thingId
        );

      if (exact) return exact;
    }

    if (doc.relatedThingId) {
      const exact =
        items.find(
          item =>
            item.id ===
            doc.relatedThingId
        );

      if (exact) return exact;
    }

    const named =
      normalize(
        doc.relatedThing
      );

    if (named) {
      const exact =
        items.find(
          item =>
            normalize(
              item.title
            ) === named
        );

      if (exact) return exact;
    }

    return null;
  }

  function linkedDocuments() {
    return documents().map(doc => ({
      doc,
      thing: relatedThing(doc),
      type: documentType(doc)
    }));
  }

  function documentStats(entries) {
    const linked =
      entries.filter(
        entry => entry.thing
      );

    const orphan =
      entries.filter(
        entry => !entry.thing
      );

    const thingIds =
      new Set(
        linked.map(
          entry =>
            entry.thing.id
        )
      );

    const types =
      new Set(
        entries.map(
          entry =>
            entry.type.id
        )
      );

    return {
      total:entries.length,
      linked:linked.length,
      orphan:orphan.length,
      things:thingIds.size,
      types:types.size
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

    style.id =
      STYLE_ID;

    style.textContent = `
      ${ROOT} .bos140{
        margin-top:14px
      }

      ${ROOT} .bos140-summary{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px
      }

      ${ROOT} .bos140-stat{
        padding:13px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:15px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos140-stat span{
        display:block;
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:800;
        letter-spacing:.06em;
        text-transform:uppercase
      }

      ${ROOT} .bos140-stat strong{
        display:block;
        margin-top:5px;
        font-size:22px;
        letter-spacing:-.04em
      }

      ${ROOT} .bos140-toolbar{
        display:flex;
        flex-wrap:wrap;
        justify-content:space-between;
        gap:8px;
        margin-top:10px;
        padding:9px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:14px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos140-filters{
        display:flex;
        flex-wrap:wrap;
        gap:5px
      }

      ${ROOT} .bos140-filter{
        min-height:30px;
        padding:0 9px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:999px;
        background:transparent;
        color:var(--muted,#66727a);
        font:inherit;
        font-size:9px;
        font-weight:760;
        cursor:pointer
      }

      ${ROOT} .bos140-filter[data-active="true"]{
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111)
      }

      ${ROOT} .bos140-search{
        min-width:190px;
        flex:1;
        max-width:300px;
        min-height:32px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:10px;
        padding:0 10px;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        font:inherit;
        font-size:10px;
        outline:none
      }

      ${ROOT} .bos140-groups{
        display:grid;
        gap:10px;
        margin-top:10px
      }

      ${ROOT} .bos140-group{
        border:1px solid var(--line,#d9e1e5);
        border-radius:17px;
        background:var(--surface,#fff);
        overflow:hidden
      }

      ${ROOT} .bos140-group-head{
        display:grid;
        grid-template-columns:38px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        padding:12px 13px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      ${ROOT} .bos140-group-icon{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        border-radius:11px;
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos140-group-head b{
        display:block;
        font-size:12px
      }

      ${ROOT} .bos140-group-head small{
        display:block;
        margin-top:2px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      ${ROOT} .bos140-open-thing{
        min-height:30px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:9px;
        padding:0 9px;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        font:inherit;
        font-size:9px;
        font-weight:760;
        cursor:pointer
      }

      ${ROOT} .bos140-docs{
        display:grid
      }

      ${ROOT} .bos140-doc{
        display:grid;
        grid-template-columns:38px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        padding:11px 13px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      ${ROOT} .bos140-doc:last-child{
        border-bottom:0
      }

      ${ROOT} .bos140-doc-icon{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        border-radius:10px;
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos140-doc b{
        display:block;
        font-size:11px
      }

      ${ROOT} .bos140-doc small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      ${ROOT} .bos140-type{
        display:inline-flex;
        min-height:23px;
        align-items:center;
        padding:0 7px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:999px;
        color:var(--muted,#66727a);
        font-size:8px;
        font-weight:760
      }

      ${ROOT} .bos140-orphan{
        border-color:
          color-mix(
            in srgb,
            #c08c2c 35%,
            var(--line,#d9e1e5)
          )
      }

      ${ROOT} .bos140-empty{
        padding:24px;
        text-align:center;
        color:var(--muted,#66727a);
        border:1px dashed var(--line,#d9e1e5);
        border-radius:16px;
        margin-top:10px
      }

      ${ROOT} .bos140-empty b{
        display:block;
        color:var(--ink,#111);
        margin-bottom:4px
      }

      @media(max-width:760px){
        ${ROOT} .bos140-summary{
          grid-template-columns:1fr 1fr
        }

        ${ROOT} .bos140-search{
          max-width:none;
          width:100%
        }
      }

      @media(max-width:480px){
        ${ROOT} .bos140-summary{
          grid-template-columns:1fr
        }

        ${ROOT} .bos140-group-head{
          grid-template-columns:34px minmax(0,1fr)
        }

        ${ROOT} .bos140-open-thing{
          grid-column:2
        }
      }
    `;

    document.head
      .appendChild(style);
  }

  function openThing(id) {
    if (!id) return;

    sessionStorage.setItem(
      SELECTED_KEY,
      id
    );

    history.replaceState(
      null,
      '',
      '#buyeros-thing'
    );

    window.dispatchEvent(
      new CustomEvent(
        'still:ownership-updated',
        {
          detail:{
            thingId:id,
            source:'documents-v140'
          }
        }
      )
    );

    setTimeout(() => {
      document.querySelector(
        ROOT
      )?.scrollIntoView({
        behavior:
          window.matchMedia(
            '(prefers-reduced-motion: reduce)'
          ).matches
            ? 'auto'
            : 'smooth',
        block:'start'
      });
    },50);
  }

  function groupEntries(
    entries
  ) {
    const groups =
      new Map();

    entries.forEach(entry => {
      const key =
        entry.thing
          ? `thing:${entry.thing.id}`
          : 'orphan';

      if (!groups.has(key)) {
        groups.set(
          key,
          {
            thing:
              entry.thing ||
              null,
            entries:[]
          }
        );
      }

      groups
        .get(key)
        .entries
        .push(entry);
    });

    return [...groups.values()]
      .sort((a,b) => {
        if (
          a.thing &&
          !b.thing
        ) {
          return -1;
        }

        if (
          !a.thing &&
          b.thing
        ) {
          return 1;
        }

        return String(
          a.thing?.title ||
          t(
            'Unlinked documents',
            'Nepovezani dokumenti'
          )
        ).localeCompare(
          String(
            b.thing?.title ||
            t(
              'Unlinked documents',
              'Nepovezani dokumenti'
            )
          )
        );
      });
  }

  function documentText(
    entry
  ) {
    return normalize([
      entry.doc.title,
      entry.doc.type,
      entry.doc.date,
      entry.doc.issuer,
      entry.doc.business,
      entry.doc.notes,
      entry.thing?.title,
      entry.thing?.brand,
      entry.thing?.manufacturer,
      entry.type.en,
      entry.type.hr
    ].filter(Boolean).join(' '));
  }

  function renderState(
    container,
    typeFilter = 'all',
    query = ''
  ) {
    const all =
      linkedDocuments();

    const needle =
      normalize(query);

    const visible =
      all.filter(entry => {
        const typeMatch =
          typeFilter === 'all'
            ? true
            : typeFilter === 'unlinked'
              ? !entry.thing
              : entry.type.id ===
                typeFilter;

        const searchMatch =
          !needle ||
          documentText(entry)
            .includes(needle);

        return (
          typeMatch &&
          searchMatch
        );
      });

    const groups =
      groupEntries(visible);

    const groupsNode =
      $('.bos140-groups', container);

    if (!groupsNode) return;

    if (!groups.length) {
      groupsNode.innerHTML = `
        <div class="bos140-empty">
          <b>
            ${esc(
              t(
                'No matching documents.',
                'Nema odgovarajućih dokumenata.'
              )
            )}
          </b>

          ${esc(
            t(
              'Try another document type or search term.',
              'Pokušaj drugu vrstu dokumenta ili pojam pretrage.'
            )
          )}
        </div>
      `;

      return;
    }

    groupsNode.innerHTML =
      groups.map(group => {
        const thing =
          group.thing;

        return `
          <section
            class="bos140-group ${
              thing
                ? ''
                : 'bos140-orphan'
            }"
          >
            <header class="bos140-group-head">
              <span class="bos140-group-icon">
                ${
                  thing
                    ? '◇'
                    : '?'
                }
              </span>

              <div>
                <b>
                  ${esc(
                    thing?.title ||
                    t(
                      'Unlinked documents',
                      'Nepovezani dokumenti'
                    )
                  )}
                </b>

                <small>
                  ${
                    group.entries.length
                  }
                  ${esc(
                    t(
                      'documents',
                      'dokumenata'
                    )
                  )}
                  ${
                    thing &&
                    (
                      thing.brand ||
                      thing.manufacturer
                    )
                      ? ` · ${esc(
                          thing.brand ||
                          thing.manufacturer
                        )}`
                      : ''
                  }
                </small>
              </div>

              ${
                thing
                  ? `
                    <button
                      type="button"
                      class="bos140-open-thing"
                      data-v140-open-thing="${esc(thing.id)}"
                    >
                      ${esc(
                        t(
                          'Open passport',
                          'Otvori putovnicu'
                        )
                      )}
                    </button>
                  `
                  : `
                    <span class="bos140-type">
                      ${esc(
                        t(
                          'Needs linking',
                          'Treba povezati'
                        )
                      )}
                    </span>
                  `
              }
            </header>

            <div class="bos140-docs">
              ${
                group.entries.map(entry => `
                  <article class="bos140-doc">
                    <span class="bos140-doc-icon">
                      ${entry.type.icon}
                    </span>

                    <div>
                      <b>
                        ${esc(
                          entry.doc.title ||
                          t(
                            entry.type.en,
                            entry.type.hr
                          )
                        )}
                      </b>

                      <small>
                        ${esc(
                          t(
                            entry.type.en,
                            entry.type.hr
                          )
                        )}
                        ${
                          entry.doc.date
                            ? ` · ${esc(
                                dateText(
                                  entry.doc.date
                                )
                              )}`
                            : ''
                        }
                        ${
                          entry.doc.issuer ||
                          entry.doc.business
                            ? ` · ${esc(
                                entry.doc.issuer ||
                                entry.doc.business
                              )}`
                            : ''
                        }
                      </small>
                    </div>

                    <span class="bos140-type">
                      ${esc(
                        t(
                          entry.type.en,
                          entry.type.hr
                        )
                      )}
                    </span>
                  </article>
                `).join('')
              }
            </div>
          </section>
        `;
      }).join('');

    $$(
      '[data-v140-open-thing]',
      groupsNode
    ).forEach(button => {
      button.addEventListener(
        'click',
        () =>
          openThing(
            button.dataset
              .v140OpenThing
          )
      );
    });
  }

  function createDocumentsLayer() {
    const entries =
      linkedDocuments();

    const stats =
      documentStats(entries);

    const types =
      [
        ['all', t('All','Sve')],
        ['receipt', t('Receipts','Računi')],
        ['warranty', t('Warranty','Jamstva')],
        ['manual', t('Manuals','Priručnici')],
        ['contract', t('Contracts','Ugovori')],
        ['insurance', t('Insurance','Osiguranje')],
        ['service', t('Service','Servis')],
        ['unlinked', t('Unlinked','Nepovezano')]
      ];

    const container =
      document.createElement(
        'section'
      );

    container.className =
      'bos140';

    container.dataset
      .v140DocumentsLayer =
      'true';

    container.innerHTML = `
      <div class="bos140-summary">
        <article class="bos140-stat">
          <span>
            ${esc(
              t(
                'DOCUMENTS',
                'DOKUMENTI'
              )
            )}
          </span>

          <strong>
            ${stats.total}
          </strong>
        </article>

        <article class="bos140-stat">
          <span>
            ${esc(
              t(
                'LINKED',
                'POVEZANO'
              )
            )}
          </span>

          <strong>
            ${stats.linked}
          </strong>
        </article>

        <article class="bos140-stat">
          <span>
            ${esc(
              t(
                'THINGS',
                'STVARI'
              )
            )}
          </span>

          <strong>
            ${stats.things}
          </strong>
        </article>

        <article class="bos140-stat">
          <span>
            ${esc(
              t(
                'NEEDS LINKING',
                'TREBA POVEZATI'
              )
            )}
          </span>

          <strong>
            ${stats.orphan}
          </strong>
        </article>
      </div>

      <div class="bos140-toolbar">
        <div class="bos140-filters">
          ${
            types.map(
              ([id,label],index) => `
                <button
                  type="button"
                  class="bos140-filter"
                  data-v140-filter="${id}"
                  data-active="${
                    index === 0
                      ? 'true'
                      : 'false'
                  }"
                >
                  ${esc(label)}
                </button>
              `
            ).join('')
          }
        </div>

        <input
          class="bos140-search"
          type="search"
          autocomplete="off"
          placeholder="${esc(
            t(
              'Search documents…',
              'Pretraži dokumente…'
            )
          )}"
        >
      </div>

      <div class="bos140-groups"></div>
    `;

    let filter = 'all';
    let query = '';

    const redraw = () =>
      renderState(
        container,
        filter,
        query
      );

    $$(
      '[data-v140-filter]',
      container
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => {
          filter =
            button.dataset
              .v140Filter;

          $$(
            '[data-v140-filter]',
            container
          ).forEach(item => {
            item.dataset.active =
              String(
                item === button
              );
          });

          redraw();
        }
      );
    });

    $('.bos140-search', container)
      ?.addEventListener(
        'input',
        event => {
          query =
            event.target.value;

          redraw();
        }
      );

    redraw();

    return container;
  }

  function enhanceDocumentsPage(
    root
  ) {
    if (
      location.hash !==
      '#buyeros-documents'
    ) {
      return;
    }

    const content =
      $('#bos132Content', root);

    if (!content) return;

    if (
      $('[data-v140-documents-layer]', content)
    ) {
      return;
    }

    installStyles();

    const layer =
      createDocumentsLayer();

    const head =
      $('.bos132-page-head', content);

    if (head) {
      head.insertAdjacentElement(
        'afterend',
        layer
      );
    } else {
      content.prepend(
        layer
      );
    }
  }

  function enhance() {
    const root =
      document.querySelector(
        ROOT
      );

    if (!root) return false;

    enhanceDocumentsPage(
      root
    );

    return true;
  }

  function schedule() {
    clearTimeout(
      updateTimer
    );

    updateTimer =
      setTimeout(
        enhance,
        30
      );
  }

  function boot() {
    installStyles();

    const start = () => {
      const root =
        document.querySelector(
          ROOT
        );

      if (!root) return false;

      enhance();

      observer?.disconnect();

      observer =
        new MutationObserver(
          schedule
        );

      observer.observe(
        root,
        {
          childList:true,
          subtree:true
        }
      );

      return true;
    };

    if (start()) return;

    const pageObserver =
      new MutationObserver(
        () => {
          if (start()) {
            pageObserver.disconnect();
          }
        }
      );

    pageObserver.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
      }
    );
  }

  window.addEventListener(
    'hashchange',
    schedule
  );

  window.addEventListener(
    'still:buyeros-data-updated',
    schedule
  );

  window.addEventListener(
    'still:ownership-updated',
    schedule
  );

  window.addEventListener(
    'still:language',
    schedule
  );

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
