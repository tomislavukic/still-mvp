(() => {
  'use strict';

  const ROOT = '#buyerOSV132';
  const STYLE_ID = 'buyerOSTimelineV142Style';

  const OWNERSHIP_KEY =
    'still-ownership-passports-v83';

  const DOCUMENTS_KEY =
    'still-buyeros-documents-v132';

  const SELECTED_KEY =
    'still-buyeros-selected-thing-v135';

  let observer = null;
  let timer = null;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

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
      .toLowerCase();
  }

  function parseDate(value) {
    if (!value) return null;

    const date =
      new Date(
        String(value).length <= 10
          ? `${String(value).slice(0,10)}T12:00:00`
          : value
      );

    return Number.isNaN(
      date.valueOf()
    )
      ? null
      : date;
  }

  function dateText(value) {
    const date =
      parseDate(value);

    if (!date) return '';

    return new Intl.DateTimeFormat(
      isHr()
        ? 'hr-HR'
        : 'en-GB',
      {
        dateStyle:'medium'
      }
    ).format(date);
  }

  function monthKey(value) {
    const date =
      parseDate(value);

    if (!date) return '';

    return `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2,'0')}`;
  }

  function monthLabel(value) {
    const date =
      parseDate(value);

    if (!date) return '';

    return new Intl.DateTimeFormat(
      isHr()
        ? 'hr-HR'
        : 'en-GB',
      {
        month:'long',
        year:'numeric'
      }
    ).format(date);
  }

  function relatedThing(doc) {
    const items =
      things();

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

    const title =
      normalize(
        doc.relatedThing
      );

    if (!title)
      return null;

    return items.find(
      item =>
        normalize(
          item.title
        ) === title
    ) || null;
  }

  function pushEvent(
    events,
    event
  ) {
    if (
      !event.date ||
      !parseDate(event.date)
    ) {
      return;
    }

    events.push(event);
  }

  function buildTimeline() {
    const events = [];

    things().forEach(item => {
      if (!item?.id) return;

      const title =
        item.title ||
        t(
          'Untitled thing',
          'Stvar bez naziva'
        );

      const purchaseDate =
        item.purchasedOn ||
        item.purchaseDate;

      pushEvent(
        events,
        {
          id:`purchase:${item.id}`,
          date:purchaseDate,
          type:'purchase',
          icon:'◇',
          title:
            t(
              'Purchased',
              'Kupljeno'
            ),
          detail:title,
          thingId:item.id
        }
      );

      pushEvent(
        events,
        {
          id:`warranty:${item.id}`,
          date:item.warrantyUntil,
          type:'warranty',
          icon:'◉',
          title:
            t(
              'Warranty ends',
              'Jamstvo istječe'
            ),
          detail:title,
          thingId:item.id
        }
      );

      pushEvent(
        events,
        {
          id:`return:${item.id}`,
          date:item.returnBy,
          type:'return',
          icon:'↩',
          title:
            t(
              'Return window ends',
              'Rok povrata završava'
            ),
          detail:title,
          thingId:item.id
        }
      );

      pushEvent(
        events,
        {
          id:`renewal:${item.id}`,
          date:item.renewalAt,
          type:'renewal',
          icon:'↻',
          title:
            t(
              'Renewal',
              'Obnova'
            ),
          detail:title,
          thingId:item.id
        }
      );

      if (
        Array.isArray(
          item.serviceHistory
        )
      ) {
        item.serviceHistory
          .forEach(
            (event,index) => {
              pushEvent(
                events,
                {
                  id:
                    `service:${item.id}:${index}`,
                  date:
                    event.occurredOn ||
                    event.date ||
                    event.createdAt,
                  type:'service',
                  icon:'⌘',
                  title:
                    event.title ||
                    t(
                      'Service event',
                      'Servisni događaj'
                    ),
                  detail:
                    `${title}${
                      event.providerName
                        ? ` · ${event.providerName}`
                        : ''
                    }`,
                  thingId:item.id
                }
              );
            }
          );
      }

      pushEvent(
        events,
        {
          id:`created:${item.id}`,
          date:item.createdAt,
          type:'created',
          icon:'＋',
          title:
            t(
              'Added to Still',
              'Dodano u Still'
            ),
          detail:title,
          thingId:item.id
        }
      );

      if (
        item.updatedAt &&
        item.updatedAt !==
          item.createdAt
      ) {
        pushEvent(
          events,
          {
            id:`updated:${item.id}`,
            date:item.updatedAt,
            type:'updated',
            icon:'•',
            title:
              t(
                'Ownership record updated',
                'Zapis vlasništva ažuriran'
              ),
            detail:title,
            thingId:item.id
          }
        );
      }
    });

    documents().forEach(
      (doc,index) => {
        const thing =
          relatedThing(doc);

        pushEvent(
          events,
          {
            id:
              `document:${
                doc.id ||
                index
              }`,
            date:
              doc.date ||
              doc.createdAt ||
              doc.updatedAt,
            type:'document',
            icon:'▧',
            title:
              doc.title ||
              t(
                'Document added',
                'Dokument dodan'
              ),
            detail:
              thing?.title ||
              doc.type ||
              t(
                'Document',
                'Dokument'
              ),
            thingId:
              thing?.id ||
              null
          }
        );
      }
    );

    return events.sort(
      (a,b) =>
        parseDate(b.date) -
        parseDate(a.date)
    );
  }

  function stats(events) {
    const uniqueThings =
      new Set(
        events
          .map(
            event =>
              event.thingId
          )
          .filter(Boolean)
      );

    return {
      events:
        events.length,
      things:
        uniqueThings.size,
      services:
        events.filter(
          event =>
            event.type ===
            'service'
        ).length,
      documents:
        events.filter(
          event =>
            event.type ===
            'document'
        ).length
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
      ${ROOT} .bos142{
        margin-top:14px
      }

      ${ROOT} .bos142-summary{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px
      }

      ${ROOT} .bos142-stat{
        padding:13px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:15px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos142-stat span{
        display:block;
        color:var(--muted,#66727a);
        font-size:8px;
        font-weight:800;
        letter-spacing:.06em;
        text-transform:uppercase
      }

      ${ROOT} .bos142-stat strong{
        display:block;
        margin-top:5px;
        font-size:21px;
        letter-spacing:-.04em
      }

      ${ROOT} .bos142-toolbar{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:10px
      }

      ${ROOT} .bos142-filter{
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

      ${ROOT} .bos142-filter[data-active="true"]{
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111)
      }

      ${ROOT} .bos142-month{
        margin-top:14px
      }

      ${ROOT} .bos142-month-title{
        margin:0 0 7px;
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:850;
        letter-spacing:.06em;
        text-transform:uppercase
      }

      ${ROOT} .bos142-list{
        position:relative;
        display:grid;
        gap:0
      }

      ${ROOT} .bos142-list::before{
        content:'';
        position:absolute;
        top:19px;
        bottom:19px;
        left:19px;
        width:1px;
        background:var(--line,#d9e1e5)
      }

      ${ROOT} .bos142-event{
        position:relative;
        display:grid;
        grid-template-columns:40px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        width:100%;
        padding:8px 10px;
        border:0;
        border-radius:13px;
        background:transparent;
        color:var(--ink,#111);
        text-align:left;
        font:inherit
      }

      ${ROOT} button.bos142-event{
        cursor:pointer
      }

      ${ROOT} button.bos142-event:hover{
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos142-icon{
        position:relative;
        z-index:1;
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        border:1px solid var(--line,#d9e1e5);
        border-radius:12px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos142-event b{
        display:block;
        font-size:11px
      }

      ${ROOT} .bos142-event small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      ${ROOT} .bos142-date{
        color:var(--muted,#66727a);
        font-size:9px;
        white-space:nowrap
      }

      ${ROOT} .bos142-empty{
        margin-top:10px;
        padding:25px;
        text-align:center;
        border:1px dashed var(--line,#d9e1e5);
        border-radius:16px;
        color:var(--muted,#66727a)
      }

      ${ROOT} .bos142-empty b{
        display:block;
        margin-bottom:4px;
        color:var(--ink,#111)
      }

      @media(max-width:720px){
        ${ROOT} .bos142-summary{
          grid-template-columns:1fr 1fr
        }
      }

      @media(max-width:480px){
        ${ROOT} .bos142-summary{
          grid-template-columns:1fr
        }

        ${ROOT} .bos142-event{
          grid-template-columns:40px minmax(0,1fr)
        }

        ${ROOT} .bos142-date{
          grid-column:2
        }
      }
    `;

    document.head.appendChild(style);
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
            source:'timeline-v142'
          }
        }
      )
    );
  }

  function groupByMonth(events) {
    const groups =
      new Map();

    events.forEach(event => {
      const key =
        monthKey(event.date);

      if (!key) return;

      if (
        !groups.has(key)
      ) {
        groups.set(
          key,
          {
            label:
              monthLabel(
                event.date
              ),
            events:[]
          }
        );
      }

      groups
        .get(key)
        .events
        .push(event);
    });

    return [...groups.values()];
  }

  function createTimeline() {
    const all =
      buildTimeline();

    const summary =
      stats(all);

    const filters = [
      ['all', t('All','Sve')],
      ['purchase', t('Purchases','Kupnje')],
      ['document', t('Documents','Dokumenti')],
      ['service', t('Service','Servis')],
      ['warranty', t('Warranty','Jamstvo')],
      ['renewal', t('Renewals','Obnove')]
    ];

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos142';

    section.dataset
      .v142Timeline =
      'true';

    section.innerHTML = `
      <div class="bos142-summary">
        <article class="bos142-stat">
          <span>
            ${esc(
              t(
                'EVENTS',
                'DOGAĐAJI'
              )
            )}
          </span>

          <strong>
            ${summary.events}
          </strong>
        </article>

        <article class="bos142-stat">
          <span>
            ${esc(
              t(
                'THINGS',
                'STVARI'
              )
            )}
          </span>

          <strong>
            ${summary.things}
          </strong>
        </article>

        <article class="bos142-stat">
          <span>
            ${esc(
              t(
                'SERVICE',
                'SERVIS'
              )
            )}
          </span>

          <strong>
            ${summary.services}
          </strong>
        </article>

        <article class="bos142-stat">
          <span>
            ${esc(
              t(
                'DOCUMENTS',
                'DOKUMENTI'
              )
            )}
          </span>

          <strong>
            ${summary.documents}
          </strong>
        </article>
      </div>

      <div class="bos142-toolbar">
        ${
          filters.map(
            ([id,label],index) => `
              <button
                type="button"
                class="bos142-filter"
                data-v142-filter="${id}"
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

      <div
        data-v142-list
      ></div>
    `;

    let filter = 'all';

    const render = () => {
      const visible =
        filter === 'all'
          ? all
          : all.filter(
              event =>
                event.type ===
                filter
            );

      const list =
        $('[data-v142-list]', section);

      if (!visible.length) {
        list.innerHTML = `
          <div class="bos142-empty">
            <b>
              ${esc(
                t(
                  'No timeline events.',
                  'Nema događaja na vremenskoj crti.'
                )
              )}
            </b>

            ${esc(
              t(
                'BuyerOS only shows dated events already stored in your ownership records.',
                'BuyerOS prikazuje samo događaje s datumom koji već postoje u tvojim zapisima vlasništva.'
              )
            )}
          </div>
        `;

        return;
      }

      const groups =
        groupByMonth(
          visible
        );

      list.innerHTML =
        groups.map(group => `
          <section class="bos142-month">
            <h4 class="bos142-month-title">
              ${esc(group.label)}
            </h4>

            <div class="bos142-list">
              ${
                group.events.map(event => {
                  const inner = `
                    <span class="bos142-icon">
                      ${event.icon}
                    </span>

                    <span>
                      <b>
                        ${esc(
                          event.title
                        )}
                      </b>

                      <small>
                        ${esc(
                          event.detail
                        )}
                      </small>
                    </span>

                    <span class="bos142-date">
                      ${esc(
                        dateText(
                          event.date
                        )
                      )}
                    </span>
                  `;

                  return event.thingId
                    ? `
                      <button
                        type="button"
                        class="bos142-event"
                        data-v142-thing="${esc(event.thingId)}"
                      >
                        ${inner}
                      </button>
                    `
                    : `
                      <div class="bos142-event">
                        ${inner}
                      </div>
                    `;
                }).join('')
              }
            </div>
          </section>
        `).join('');

      list.querySelectorAll(
        '[data-v142-thing]'
      ).forEach(button => {
        button.addEventListener(
          'click',
          () =>
            openThing(
              button.dataset
                .v142Thing
            )
        );
      });
    };

    section.querySelectorAll(
      '[data-v142-filter]'
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => {
          filter =
            button.dataset
              .v142Filter;

          section.querySelectorAll(
            '[data-v142-filter]'
          ).forEach(item => {
            item.dataset.active =
              String(
                item === button
              );
          });

          render();
        }
      );
    });

    render();

    return section;
  }

  function enhanceTimeline(
    root
  ) {
    if (
      location.hash !==
      '#buyeros-timeline'
    ) {
      return;
    }

    const content =
      $('#bos132Content', root);

    if (!content) return;

    const old =
      $('[data-v142-timeline]', content);

    if (old)
      old.remove();

    const timeline =
      createTimeline();

    const head =
      $('.bos132-page-head', content);

    if (head) {
      head.insertAdjacentElement(
        'afterend',
        timeline
      );
    } else {
      content.prepend(
        timeline
      );
    }
  }

  function enhance() {
    const root =
      document.querySelector(
        ROOT
      );

    if (!root) return false;

    installStyles();
    enhanceTimeline(root);

    return true;
  }

  function schedule() {
    clearTimeout(timer);

    timer =
      setTimeout(
        enhance,
        40
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
          mutations => {
            const relevant =
              mutations.some(
                mutation =>
                  [...mutation.addedNodes]
                    .some(node =>
                      node.nodeType === 1 &&
                      !node.matches?.(
                        '[data-v142-timeline]'
                      ) &&
                      !node.closest?.(
                        '[data-v142-timeline]'
                      )
                    )
              );

            if (relevant)
              schedule();
          }
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
          if (start())
            pageObserver.disconnect();
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
    'still:ownership-updated',
    schedule
  );

  window.addEventListener(
    'still:buyeros-data-updated',
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

