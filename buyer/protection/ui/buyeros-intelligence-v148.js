(() => {
  'use strict';

  const PANEL_ID = 'buyerOSIntelligenceV148';
  const STYLE_ID = 'buyerOSIntelligenceV148Style';

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

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase()
      .trim();
  }

  function tools() {
    const api =
      window.StillBuyerOSToolsV149;

    if (
      !api ||
      typeof api.execute !==
        'function'
    ) {
      throw new Error(
        'BuyerOS Tool Layer V149 is unavailable'
      );
    }

    return api;
  }

  async function executeTool(
    name,
    args = {}
  ) {
    const response =
      await tools().execute(
        name,
        args
      );

    if (
      !response ||
      response.ok !== true
    ) {
      throw new Error(
        response?.error?.message ||
        `BuyerOS tool failed: ${name}`
      );
    }

    return response.data;
  }

  async function things(
    filters = {}
  ) {
    return executeTool(
      'list_things',
      {
        limit:250,
        ...filters
      }
    );
  }

  async function documents() {
    return executeTool(
      'get_documents'
    );
  }

  async function findThings(query) {
    const result =
      await executeTool(
        'search_things',
        {
          query,
          limit:20
        }
      );

    return result.map(
      entry =>
        entry.thing
    );
  }

  async function docsFor(item) {
    if (!item?.id) {
      return [];
    }

    return executeTool(
      'get_documents',
      {
        thingId:item.id
      }
    );
  }

  async function serviceEvents() {
    return executeTool(
      'get_service_history'
    );
  }

  async function attentionItems() {
    const entries =
      await executeTool(
        'get_attention',
        {
          horizonDays:30
        }
      );

    return entries.map(
      entry => ({
        type:
          entry.type,

        days:
          entry.days,

        date:
          entry.date,

        thing:{
          id:
            entry.thingId,

          title:
            entry.thingTitle ||
            t(
              'Untitled thing',
              'Stvar bez naziva'
            )
        }
      })
    );
  }

  async function interpret(query) {
    const q =
      normalize(query);

    if (!q) {
      return {
        type:'empty',
        items:[]
      };
    }

    try {
      if (
        /koliko.*stvari|how many.*things|how many.*items/.test(q)
      ) {
        const result =
          await executeTool(
            'count_things'
          );

        return {
          type:'count',
          count:
            result.total
        };
      }

      if (
        /pretplat|subscription/.test(q)
      ) {
        return {
          type:'things',

          label:t(
            'Subscriptions',
            'Pretplate'
          ),

          items:
            await things({
              kind:'subscription'
            })
        };
      }

      if (
        /serijski|serial/.test(q)
      ) {
        return {
          type:'things',

          label:t(
            'Things with serial numbers',
            'Stvari sa serijskim brojem'
          ),

          items:
            await things({
              hasSerial:true
            })
        };
      }

      if (
        /nema.*jamstv|bez.*jamstv|without warranty|no warranty/.test(q)
      ) {
        return {
          type:'things',

          label:t(
            'Things without warranty information',
            'Stvari bez podataka o jamstvu'
          ),

          items:
            await things({
              missingWarranty:true
            })
        };
      }

      if (
        /istjec|istič|uskoro|expires|expiring|renew|obnov/.test(q)
      ) {
        return {
          type:'attention',
          items:
            await attentionItems()
        };
      }

      if (
        /racun|račun|receipt|invoice|dokument/.test(q)
      ) {
        const words =
          q
            .replace(
              /racun|račun|receipt|invoice|dokument|document/g,
              ''
            )
            .trim();

        if (!words) {
          const allDocuments =
            await documents();

          return {
            type:'documents',

            items:
              allDocuments.map(
                doc => ({
                  item:{
                    id:
                      doc.linkedThingId ||
                      null,

                    title:
                      doc.linkedThingTitle ||
                      ''
                  },

                  doc
                })
              )
          };
        }

        const candidates =
          await findThings(
            words
          );

        const groups =
          await Promise.all(
            candidates.map(
              async item => {
                const linked =
                  await docsFor(item);

                return linked.map(
                  doc => ({
                    item,
                    doc
                  })
                );
              }
            )
          );

        return {
          type:'documents',
          items:
            groups.flat()
        };
      }

      if (
        /servis|service|repair|maintenance/.test(q)
      ) {
        return {
          type:'services',
          items:
            await serviceEvents()
        };
      }

      const found =
        await findThings(q);

      if (found.length) {
        return {
          type:'things',

          label:t(
            'Matching things',
            'Pronađene stvari'
          ),

          items:found
        };
      }

      return {
        type:'unknown',
        items:[]
      };
    } catch (error) {
      console.error(
        'BuyerOS Intelligence tool query failed',
        error
      );

      return {
        type:'unknown',
        items:[],
        error:true
      };
    }
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
      #${PANEL_ID}{
        display:grid;
        gap:10px
      }

      .bos148-card{
        padding:12px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:14px;
        background:var(--surface,#fff)
      }

      .bos148-card b{
        display:block;
        font-size:11px
      }

      .bos148-card small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      .bos148-list{
        display:grid;
        gap:7px;
        margin-top:9px
      }

      .bos148-input{
        width:100%;
        min-height:42px;
        box-sizing:border-box;
        padding:0 12px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:12px;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        font:inherit;
        font-size:11px;
        outline:none
      }

      .bos148-actions{
        display:flex;
        gap:7px
      }

      .bos148-actions button{
        min-height:34px;
        padding:0 10px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:9px;
        background:var(--surface,#fff);
        color:var(--ink,#111);
        font:inherit;
        font-size:9px;
        font-weight:760;
        cursor:pointer
      }
    `;

    document.head.appendChild(style);
  }

  function resultHTML(result) {
    if (result.type === 'count') {
      return `
        <article class="bos148-card">
          <b>${result.count}</b>
          <small>
            ${esc(
              t(
                'things currently stored in BuyerOS',
                'stvari trenutno spremljeno u BuyerOS-u'
              )
            )}
          </small>
        </article>
      `;
    }

    if (result.type === 'things') {
      if (!result.items.length) {
        return `
          <article class="bos148-card">
            <b>
              ${esc(
                t(
                  'Nothing found.',
                  'Ništa nije pronađeno.'
                )
              )}
            </b>
          </article>
        `;
      }

      return `
        <article class="bos148-card">
          <b>${esc(result.label)}</b>

          <div class="bos148-list">
            ${
              result.items.map(item => `
                <div>
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
                    ${esc(
                      [
                        item.brand ||
                        item.manufacturer,
                        item.model,
                        item.business ||
                        item.store
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    )}
                  </small>
                </div>
              `).join('')
            }
          </div>
        </article>
      `;
    }

    if (result.type === 'attention') {
      if (!result.items.length) {
        return `
          <article class="bos148-card">
            <b>
              ${esc(
                t(
                  'Nothing is expiring soon.',
                  'Ništa uskoro ne istječe.'
                )
              )}
            </b>
          </article>
        `;
      }

      return `
        <article class="bos148-card">
          <b>
            ${esc(
              t(
                'Upcoming ownership dates',
                'Nadolazeći rokovi vlasništva'
              )
            )}
          </b>

          <div class="bos148-list">
            ${
              result.items.map(entry => `
                <div>
                  <b>
                    ${esc(
                      entry.thing.title ||
                      t(
                        'Untitled thing',
                        'Stvar bez naziva'
                      )
                    )}
                  </b>

                  <small>
                    ${esc(entry.type)}
                    · ${entry.days}d
                  </small>
                </div>
              `).join('')
            }
          </div>
        </article>
      `;
    }

    if (result.type === 'documents') {
      return `
        <article class="bos148-card">
          <b>
            ${esc(
              t(
                'Documents found',
                'Pronađeni dokumenti'
              )
            )}
          </b>

          <div class="bos148-list">
            ${
              result.items.length
                ? result.items.map(entry => `
                    <div>
                      <b>
                        ${esc(
                          entry.doc.title ||
                          entry.doc.type ||
                          t(
                            'Document',
                            'Dokument'
                          )
                        )}
                      </b>

                      <small>
                        ${esc(
                          entry.item.title ||
                          ''
                        )}
                      </small>
                    </div>
                  `).join('')
                : `<small>${esc(
                    t(
                      'No matching documents.',
                      'Nema odgovarajućih dokumenata.'
                    )
                  )}</small>`
            }
          </div>
        </article>
      `;
    }

    if (result.type === 'services') {
      return `
        <article class="bos148-card">
          <b>
            ${esc(
              t(
                'Service history',
                'Servisna povijest'
              )
            )}
          </b>

          <div class="bos148-list">
            ${
              result.items.length
                ? result.items
                    .slice(0,20)
                    .map(event => `
                      <div>
                        <b>
                          ${esc(
                            event.title ||
                            t(
                              'Service',
                              'Servis'
                            )
                          )}
                        </b>

                        <small>
                          ${esc(
                            [
                              event.thingTitle,
                              event.providerName,
                              event.occurredOn
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          )}
                        </small>
                      </div>
                    `).join('')
                : `<small>${esc(
                    t(
                      'No service history stored.',
                      'Nema spremljene servisne povijesti.'
                    )
                  )}</small>`
            }
          </div>
        </article>
      `;
    }

    return `
      <article class="bos148-card">
        <b>
          ${esc(
            t(
              'I could not answer that from the data currently stored in BuyerOS.',
              'Na to ne mogu odgovoriti iz podataka koji su trenutačno spremljeni u BuyerOS-u.'
            )
          )}
        </b>

        <small>
          ${esc(
            t(
              'Try asking about warranties, subscriptions, serial numbers, documents, services or a specific thing.',
              'Pokušaj pitati o jamstvima, pretplatama, serijskim brojevima, dokumentima, servisima ili konkretnoj stvari.'
            )
          )}
        </small>
      </article>
    `;
  }

  function enhanceAssistant() {
    if (
      location.hash !==
      '#buyeros-assistant'
    ) {
      return;
    }

    const root =
      document.querySelector(
        '#buyerOSV132'
      );

    const content =
      $('#bos132Content', root);

    if (!content)
      return;

    let panel =
      document.getElementById(
        PANEL_ID
      );

    if (panel)
      panel.remove();

    panel =
      document.createElement('section');

    panel.id = PANEL_ID;

    panel.innerHTML = `
      <article class="bos148-card">
        <b>
          ${esc(
            t(
              'Ask BuyerOS',
              'Pitaj BuyerOS'
            )
          )}
        </b>

        <small>
          ${esc(
            t(
              'Answers are built only from information already stored in your BuyerOS.',
              'Odgovori se temelje isključivo na podacima koji su već spremljeni u tvom BuyerOS-u.'
            )
          )}
        </small>
      </article>

      <input
        class="bos148-input"
        data-v148-query
        placeholder="${esc(
          t(
            'What is expiring soon?',
            'Što mi uskoro istječe?'
          )
        )}"
      >

      <div class="bos148-actions">
        <button data-v148-example="What is expiring soon?">
          ${esc(t('Expiring soon','Uskoro istječe'))}
        </button>

        <button data-v148-example="Which things have no warranty?">
          ${esc(t('No warranty','Bez jamstva'))}
        </button>

        <button data-v148-example="How many things do I have?">
          ${esc(t('Count things','Broj stvari'))}
        </button>
      </div>

      <div data-v148-result></div>
    `;

    const head =
      $('.bos132-page-head', content);

    if (head) {
      head.insertAdjacentElement(
        'afterend',
        panel
      );
    } else {
      content.prepend(panel);
    }

    const input =
      $('[data-v148-query]', panel);

    const result =
      $('[data-v148-result]', panel);

    const run = async query => {
      result.innerHTML = `
        <article class="bos148-card">
          <b>
            ${esc(
              t(
                'Checking your BuyerOS…',
                'Provjeravam tvoj BuyerOS…'
              )
            )}
          </b>
        </article>
      `;

      const answer =
        await interpret(query);

      result.innerHTML =
        resultHTML(
          answer
        );
    };

    input.addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Enter'
        ) {
          run(input.value);
        }
      }
    );

    panel.querySelectorAll(
      '[data-v148-example]'
    ).forEach(button => {
      button.addEventListener(
        'click',
        () => {
          input.value =
            button.dataset
              .v148Example;

          run(input.value);
        }
      );
    });
  }

  let renderScheduled = false;

  function scheduleEnhanceAssistant() {
    if (renderScheduled) {
      return;
    }

    renderScheduled = true;

    requestAnimationFrame(() => {
      renderScheduled = false;
      enhanceAssistant();
    });
  }

  function boot() {
    installStyles();
    scheduleEnhanceAssistant();

    window.addEventListener(
      'hashchange',
      scheduleEnhanceAssistant
    );

    window.addEventListener(
      'still:ownership-updated',
      scheduleEnhanceAssistant
    );

    window.addEventListener(
      'still:buyeros-data-updated',
      scheduleEnhanceAssistant
    );

    window.addEventListener(
      'still:language',
      scheduleEnhanceAssistant
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
