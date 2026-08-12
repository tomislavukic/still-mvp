(() => {
  'use strict';

  const ROOT = '#buyerOSV132';
  const STYLE_ID = 'buyerOSServicesV143Style';

  const OWNERSHIP_KEY =
    'still-ownership-passports-v83';

  const SELECTED_KEY =
    'still-buyeros-selected-thing-v135';

  let observer = null;
  let timer = null;

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
    return readArray(
      OWNERSHIP_KEY
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

  function daysUntil(value) {
    const target =
      parseDate(value);

    if (!target) return null;

    const now =
      new Date();

    now.setHours(
      12,
      0,
      0,
      0
    );

    target.setHours(
      12,
      0,
      0,
      0
    );

    return Math.ceil(
      (
        target.getTime() -
        now.getTime()
      ) / 86400000
    );
  }

  function serviceHistory() {
    const events = [];

    things().forEach(item => {
      if (
        !Array.isArray(
          item.serviceHistory
        )
      ) {
        return;
      }

      item.serviceHistory
        .forEach(
          (event,index) => {
            events.push({
              id:
                event.id ||
                `service:${item.id}:${index}`,

              thingId:
                item.id,

              thingTitle:
                item.title ||
                t(
                  'Untitled thing',
                  'Stvar bez naziva'
                ),

              type:
                String(
                  event.type ||
                  'service'
                ),

              title:
                event.title ||
                t(
                  'Service',
                  'Servis'
                ),

              occurredOn:
                event.occurredOn ||
                event.date ||
                event.createdAt ||
                '',

              providerName:
                event.providerName ||
                '',

              notes:
                event.notes ||
                '',

              isPublic:
                event.isPublic ===
                true
            });
          }
        );
    });

    return events.sort(
      (a,b) =>
        String(
          b.occurredOn ||
          ''
        ).localeCompare(
          String(
            a.occurredOn ||
            ''
          )
        )
    );
  }

  function ongoingServices() {
    return things()
      .filter(item =>
        [
          'service',
          'subscription',
          'rental',
          'booking'
        ].includes(
          String(
            item.kind ||
            ''
          ).toLowerCase()
        )
      );
  }

  function typeInfo(type) {
    const value =
      normalize(type);

    if (
      /repair|poprav/.test(value)
    ) {
      return {
        id:'repair',
        icon:'⌘',
        en:'Repair',
        hr:'Popravak'
      };
    }

    if (
      /inspection|pregled/.test(value)
    ) {
      return {
        id:'inspection',
        icon:'◎',
        en:'Inspection',
        hr:'Pregled'
      };
    }

    if (
      /maintenance|odrzavanje/.test(value)
    ) {
      return {
        id:'maintenance',
        icon:'↻',
        en:'Maintenance',
        hr:'Održavanje'
      };
    }

    if (
      /upgrade|nadograd/.test(value)
    ) {
      return {
        id:'upgrade',
        icon:'↑',
        en:'Upgrade',
        hr:'Nadogradnja'
      };
    }

    return {
      id:'service',
      icon:'◇',
      en:'Service',
      hr:'Servis'
    };
  }

  function stats(
    history,
    ongoing
  ) {
    const providers =
      new Set(
        history
          .map(event =>
            normalize(
              event.providerName
            )
          )
          .filter(Boolean)
      );

    const publicEvents =
      history.filter(
        event =>
          event.isPublic === true
      );

    const renewals =
      ongoing.filter(item => {
        const days =
          daysUntil(
            item.renewalAt
          );

        return (
          days !== null &&
          days >= 0 &&
          days <= 60
        );
      });

    return {
      history:
        history.length,

      ongoing:
        ongoing.length,

      providers:
        providers.size,

      public:
        publicEvents.length,

      renewals:
        renewals.length
    };
  }

  function lastServiceFor(
    item,
    history
  ) {
    return history.find(
      event =>
        event.thingId ===
        item.id
    ) || null;
  }

  function groupedHistory(
    history
  ) {
    const map =
      new Map();

    history.forEach(event => {
      const key =
        event.thingId ||
        event.thingTitle ||
        'unknown';

      if (!map.has(key)) {
        map.set(
          key,
          {
            thingId:
              event.thingId ||
              '',

            title:
              event.thingTitle ||
              t(
                'Unknown thing',
                'Nepoznata stvar'
              ),

            events:[]
          }
        );
      }

      map.get(key)
        .events
        .push(event);
    });

    return [...map.values()]
      .sort(
        (a,b) =>
          String(a.title)
            .localeCompare(
              String(b.title)
            )
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
      ${ROOT} .bos143{
        margin-top:14px
      }

      ${ROOT} .bos143-summary{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:8px
      }

      ${ROOT} .bos143-stat{
        padding:13px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:15px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos143-stat span{
        display:block;
        color:var(--muted,#66727a);
        font-size:8px;
        font-weight:800;
        letter-spacing:.06em;
        text-transform:uppercase
      }

      ${ROOT} .bos143-stat strong{
        display:block;
        margin-top:5px;
        font-size:21px;
        letter-spacing:-.04em
      }

      ${ROOT} .bos143-toolbar{
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

      ${ROOT} .bos143-filters{
        display:flex;
        flex-wrap:wrap;
        gap:5px
      }

      ${ROOT} .bos143-filter{
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

      ${ROOT} .bos143-filter[data-active="true"]{
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111)
      }

      ${ROOT} .bos143-search{
        min-width:190px;
        flex:1;
        max-width:300px;
        min-height:32px;
        padding:0 10px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:10px;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        font:inherit;
        font-size:10px;
        outline:none
      }

      ${ROOT} .bos143-section{
        margin-top:12px
      }

      ${ROOT} .bos143-section-head{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:end;
        margin-bottom:7px
      }

      ${ROOT} .bos143-section-head h3{
        margin:0;
        font-size:13px
      }

      ${ROOT} .bos143-section-head small{
        color:var(--muted,#66727a);
        font-size:9px
      }

      ${ROOT} .bos143-ongoing{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:7px
      }

      ${ROOT} .bos143-ongoing-card{
        display:grid;
        grid-template-columns:40px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        padding:11px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:14px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos143-icon{
        width:40px;
        height:40px;
        display:grid;
        place-items:center;
        border-radius:11px;
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos143-ongoing-card b,
      ${ROOT} .bos143-event b{
        display:block;
        font-size:11px
      }

      ${ROOT} .bos143-ongoing-card small,
      ${ROOT} .bos143-event small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      ${ROOT} .bos143-renewal{
        display:inline-flex;
        align-items:center;
        min-height:24px;
        padding:0 7px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:999px;
        color:var(--muted,#66727a);
        font-size:8px;
        white-space:nowrap
      }

      ${ROOT} .bos143-groups{
        display:grid;
        gap:9px
      }

      ${ROOT} .bos143-group{
        overflow:hidden;
        border:1px solid var(--line,#d9e1e5);
        border-radius:16px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos143-group-head{
        display:grid;
        grid-template-columns:38px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        padding:11px 12px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      ${ROOT} .bos143-group-head b{
        display:block;
        font-size:11px
      }

      ${ROOT} .bos143-group-head small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      ${ROOT} .bos143-open{
        min-height:30px;
        padding:0 9px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:9px;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        font:inherit;
        font-size:9px;
        font-weight:760;
        cursor:pointer
      }

      ${ROOT} .bos143-events{
        display:grid
      }

      ${ROOT} .bos143-event{
        display:grid;
        grid-template-columns:38px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        padding:10px 12px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      ${ROOT} .bos143-event:last-child{
        border-bottom:0
      }

      ${ROOT} .bos143-visibility{
        display:inline-flex;
        align-items:center;
        min-height:23px;
        padding:0 7px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:999px;
        color:var(--muted,#66727a);
        font-size:8px;
        font-weight:760
      }

      ${ROOT} .bos143-visibility[data-public="true"]{
        color:var(--green,#337b58)
      }

      ${ROOT} .bos143-empty{
        padding:24px;
        border:1px dashed var(--line,#d9e1e5);
        border-radius:16px;
        text-align:center;
        color:var(--muted,#66727a)
      }

      ${ROOT} .bos143-empty b{
        display:block;
        margin-bottom:4px;
        color:var(--ink,#111)
      }

      @media(max-width:900px){
        ${ROOT} .bos143-summary{
          grid-template-columns:repeat(3,minmax(0,1fr))
        }
      }

      @media(max-width:700px){
        ${ROOT} .bos143-summary{
          grid-template-columns:1fr 1fr
        }

        ${ROOT} .bos143-ongoing{
          grid-template-columns:1fr
        }

        ${ROOT} .bos143-search{
          width:100%;
          max-width:none
        }
      }

      @media(max-width:480px){
        ${ROOT} .bos143-summary{
          grid-template-columns:1fr
        }

        ${ROOT} .bos143-event{
          grid-template-columns:36px minmax(0,1fr)
        }

        ${ROOT} .bos143-visibility{
          grid-column:2;
          justify-self:start
        }

        ${ROOT} .bos143-group-head{
          grid-template-columns:36px minmax(0,1fr)
        }

        ${ROOT} .bos143-open{
          grid-column:2;
          justify-self:start
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
            source:'services-v143'
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

  function searchableEvent(event) {
    return normalize([
      event.title,
      event.type,
      event.thingTitle,
      event.providerName,
      event.notes,
      event.occurredOn
    ].filter(Boolean).join(' '));
  }

  function createHub() {
    const history =
      serviceHistory();

    const ongoing =
      ongoingServices();

    const summary =
      stats(
        history,
        ongoing
      );

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos143';

    section.dataset
      .v143Services =
      'true';

    section.innerHTML = `
      <div class="bos143-summary">
        <article class="bos143-stat">
          <span>
            ${esc(
              t(
                'HISTORY',
                'POVIJEST'
              )
            )}
          </span>
          <strong>
            ${summary.history}
          </strong>
        </article>

        <article class="bos143-stat">
          <span>
            ${esc(
              t(
                'ONGOING',
                'TRAJE'
              )
            )}
          </span>
          <strong>
            ${summary.ongoing}
          </strong>
        </article>

        <article class="bos143-stat">
          <span>
            ${esc(
              t(
                'PROVIDERS',
                'PRUŽATELJI'
              )
            )}
          </span>
          <strong>
            ${summary.providers}
          </strong>
        </article>

        <article class="bos143-stat">
          <span>
            ${esc(
              t(
                'PUBLIC',
                'JAVNO'
              )
            )}
          </span>
          <strong>
            ${summary.public}
          </strong>
        </article>

        <article class="bos143-stat">
          <span>
            ${esc(
              t(
                'NEXT 60 DAYS',
                'SLJEDEĆIH 60 DANA'
              )
            )}
          </span>
          <strong>
            ${summary.renewals}
          </strong>
        </article>
      </div>

      <div class="bos143-toolbar">
        <div class="bos143-filters">
          <button
            type="button"
            class="bos143-filter"
            data-v143-filter="all"
            data-active="true"
          >
            ${esc(t('All','Sve'))}
          </button>

          <button
            type="button"
            class="bos143-filter"
            data-v143-filter="repair"
            data-active="false"
          >
            ${esc(t('Repairs','Popravci'))}
          </button>

          <button
            type="button"
            class="bos143-filter"
            data-v143-filter="inspection"
            data-active="false"
          >
            ${esc(t('Inspections','Pregledi'))}
          </button>

          <button
            type="button"
            class="bos143-filter"
            data-v143-filter="maintenance"
            data-active="false"
          >
            ${esc(t('Maintenance','Održavanje'))}
          </button>

          <button
            type="button"
            class="bos143-filter"
            data-v143-filter="upgrade"
            data-active="false"
          >
            ${esc(t('Upgrades','Nadogradnje'))}
          </button>

          <button
            type="button"
            class="bos143-filter"
            data-v143-filter="public"
            data-active="false"
          >
            ${esc(t('Public','Javno'))}
          </button>
        </div>

        <input
          class="bos143-search"
          type="search"
          autocomplete="off"
          placeholder="${esc(
            t(
              'Search service history…',
              'Pretraži servisnu povijest…'
            )
          )}"
        >
      </div>

      <div data-v143-content></div>
    `;

    let filter = 'all';
    let query = '';

    function render() {
      const needle =
        normalize(query);

      const visible =
        history.filter(event => {
          const info =
            typeInfo(
              event.type
            );

          const filterMatch =
            filter === 'all'
              ? true
              : filter === 'public'
                ? event.isPublic === true
                : info.id === filter;

          const queryMatch =
            !needle ||
            searchableEvent(event)
              .includes(needle);

          return (
            filterMatch &&
            queryMatch
          );
        });

      const groups =
        groupedHistory(
          visible
        );

      const target =
        $('[data-v143-content]', section);

      const ongoingHTML =
        ongoing.length
          ? `
            <section class="bos143-section">
              <div class="bos143-section-head">
                <h3>
                  ${esc(
                    t(
                      'Ongoing services',
                      'Trajne usluge'
                    )
                  )}
                </h3>

                <small>
                  ${ongoing.length}
                </small>
              </div>

              <div class="bos143-ongoing">
                ${
                  ongoing.map(item => {
                    const renewalDays =
                      daysUntil(
                        item.renewalAt
                      );

                    const last =
                      lastServiceFor(
                        item,
                        history
                      );

                    return `
                      <article class="bos143-ongoing-card">
                        <span class="bos143-icon">
                          ${
                            item.kind === 'subscription'
                              ? '↻'
                              : item.kind === 'rental'
                                ? '⌂'
                                : '◎'
                          }
                        </span>

                        <div>
                          <b>
                            ${esc(
                              item.title ||
                              t(
                                'Untitled service',
                                'Usluga bez naziva'
                              )
                            )}
                          </b>

                          <small>
                            ${esc(
                              item.business ||
                              item.kind ||
                              ''
                            )}
                            ${
                              last
                                ? ` · ${esc(
                                    t(
                                      'last service',
                                      'zadnji servis'
                                    )
                                  )}: ${esc(
                                    dateText(
                                      last.occurredOn
                                    )
                                  )}`
                                : ''
                            }
                          </small>
                        </div>

                        ${
                          item.renewalAt
                            ? `
                              <span class="bos143-renewal">
                                ${esc(
                                  t(
                                    'Renews',
                                    'Obnova'
                                  )
                                )}
                                ·
                                ${esc(
                                  dateText(
                                    item.renewalAt
                                  )
                                )}
                                ${
                                  renewalDays !== null &&
                                  renewalDays >= 0
                                    ? ` · ${renewalDays}d`
                                    : ''
                                }
                              </span>
                            `
                            : ''
                        }
                      </article>
                    `;
                  }).join('')
                }
              </div>
            </section>
          `
          : '';

      const historyHTML =
        groups.length
          ? `
            <section class="bos143-section">
              <div class="bos143-section-head">
                <h3>
                  ${esc(
                    t(
                      'Service history',
                      'Servisna povijest'
                    )
                  )}
                </h3>

                <small>
                  ${visible.length}
                </small>
              </div>

              <div class="bos143-groups">
                ${
                  groups.map(group => `
                    <section class="bos143-group">
                      <header class="bos143-group-head">
                        <span class="bos143-icon">
                          ◇
                        </span>

                        <div>
                          <b>
                            ${esc(
                              group.title
                            )}
                          </b>

                          <small>
                            ${group.events.length}
                            ${esc(
                              t(
                                'service events',
                                'servisnih događaja'
                              )
                            )}
                          </small>
                        </div>

                        ${
                          group.thingId
                            ? `
                              <button
                                type="button"
                                class="bos143-open"
                                data-v143-thing="${esc(group.thingId)}"
                              >
                                ${esc(
                                  t(
                                    'Open passport',
                                    'Otvori putovnicu'
                                  )
                                )}
                              </button>
                            `
                            : ''
                        }
                      </header>

                      <div class="bos143-events">
                        ${
                          group.events.map(event => {
                            const info =
                              typeInfo(
                                event.type
                              );

                            return `
                              <article class="bos143-event">
                                <span class="bos143-icon">
                                  ${info.icon}
                                </span>

                                <div>
                                  <b>
                                    ${esc(
                                      event.title
                                    )}
                                  </b>

                                  <small>
                                    ${esc(
                                      t(
                                        info.en,
                                        info.hr
                                      )
                                    )}
                                    ${
                                      event.occurredOn
                                        ? ` · ${esc(
                                            dateText(
                                              event.occurredOn
                                            )
                                          )}`
                                        : ''
                                    }
                                    ${
                                      event.providerName
                                        ? ` · ${esc(
                                            event.providerName
                                          )}`
                                        : ''
                                    }
                                  </small>

                                  ${
                                    event.notes
                                      ? `
                                        <small>
                                          ${esc(
                                            event.notes
                                          )}
                                        </small>
                                      `
                                      : ''
                                  }
                                </div>

                                <span
                                  class="bos143-visibility"
                                  data-public="${
                                    event.isPublic
                                      ? 'true'
                                      : 'false'
                                  }"
                                >
                                  ${esc(
                                    event.isPublic
                                      ? t(
                                          'Public',
                                          'Javno'
                                        )
                                      : t(
                                          'Private',
                                          'Privatno'
                                        )
                                  )}
                                </span>
                              </article>
                            `;
                          }).join('')
                        }
                      </div>
                    </section>
                  `).join('')
                }
              </div>
            </section>
          `
          : `
            <section class="bos143-section">
              <div class="bos143-empty">
                <b>
                  ${esc(
                    t(
                      'No matching service events.',
                      'Nema odgovarajućih servisnih događaja.'
                    )
                  )}
                </b>

                ${esc(
                  t(
                    'Service Hub only shows service information already stored in BuyerOS.',
                    'Service Hub prikazuje samo servisne podatke koji su već spremljeni u BuyerOS-u.'
                  )
                )}
              </div>
            </section>
          `;

      target.innerHTML =
        ongoingHTML +
        historyHTML;

      $$(
        '[data-v143-thing]',
        target
      ).forEach(button => {
        button.addEventListener(
          'click',
          () =>
            openThing(
              button.dataset
                .v143Thing
            )
        );
      });
    }

    $$(
      '[data-v143-filter]',
      section
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => {
          filter =
            button.dataset
              .v143Filter;

          $$(
            '[data-v143-filter]',
            section
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

    $('.bos143-search', section)
      ?.addEventListener(
        'input',
        event => {
          query =
            event.target.value;

          render();
        }
      );

    render();

    return section;
  }

  function enhanceServicesPage(
    root
  ) {
    if (
      location.hash !==
      '#buyeros-services'
    ) {
      return;
    }

    const content =
      $('#bos132Content', root);

    if (!content) return;

    const existing =
      $('[data-v143-services]', content);

    if (existing) {
      existing.remove();
    }

    const hub =
      createHub();

    const head =
      $('.bos132-page-head', content);

    if (head) {
      head.insertAdjacentElement(
        'afterend',
        hub
      );
    } else {
      content.prepend(
        hub
      );
    }
  }

  function enhance() {
    const root =
      document.querySelector(
        ROOT
      );

    if (!root)
      return false;

    installStyles();
    enhanceServicesPage(
      root
    );

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

      if (!root)
        return false;

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
                        '[data-v143-services]'
                      ) &&
                      !node.closest?.(
                        '[data-v143-services]'
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

    if (start())
      return;

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

