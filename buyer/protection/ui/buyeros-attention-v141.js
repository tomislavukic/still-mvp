(() => {
  'use strict';

  const ROOT = '#buyerOSV132';
  const STYLE_ID = 'buyerOSAttentionV141Style';

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

  function dateValue(value) {
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
      dateValue(value);

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
      dateValue(value);

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

  function docsFor(item) {
    const title =
      normalize(item.title);

    return documents().filter(doc =>
      doc.thingId === item.id ||
      doc.relatedThingId === item.id ||
      (
        title &&
        normalize(
          doc.relatedThing
        ) === title
      )
    );
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

    if (!title) return null;

    return items.find(
      item =>
        normalize(
          item.title
        ) === title
    ) || null;
  }

  function hasReceipt(docs) {
    return docs.some(doc =>
      /receipt|invoice|racun|faktur/
        .test(
          normalize(
            `${doc.type || ''} ${doc.title || ''}`
          )
        )
    );
  }

  function hasWarrantyDocument(docs) {
    return docs.some(doc =>
      /warranty|jamstv/
        .test(
          normalize(
            `${doc.type || ''} ${doc.title || ''}`
          )
        )
    );
  }

  function addIssue(
    issues,
    issue
  ) {
    if (!issue.id) return;

    if (
      issues.some(
        existing =>
          existing.id === issue.id
      )
    ) {
      return;
    }

    issues.push(issue);
  }

  function buildIssues() {
    const issues = [];
    const items = things();
    const docs = documents();

    items.forEach(item => {
      if (!item?.id) return;

      const itemDocs =
        docsFor(item);

      const title =
        item.title ||
        t(
          'Untitled thing',
          'Stvar bez naziva'
        );

      const warrantyDays =
        daysUntil(
          item.warrantyUntil
        );

      const returnDays =
        daysUntil(
          item.returnBy
        );

      const renewalDays =
        daysUntil(
          item.renewalAt
        );

      if (
        warrantyDays !== null &&
        warrantyDays >= 0 &&
        warrantyDays <= 30
      ) {
        addIssue(
          issues,
          {
            id:
              `warranty:${item.id}`,
            priority:
              warrantyDays <= 7
                ? 100
                : 85,
            level:
              warrantyDays <= 7
                ? 'urgent'
                : 'soon',
            icon:'◇',
            title:
              t(
                'Warranty ending soon',
                'Jamstvo uskoro istječe'
              ),
            detail:
              `${title} · ${
                warrantyDays === 0
                  ? t(
                      'today',
                      'danas'
                    )
                  : `${warrantyDays} ${t(
                      'days',
                      'dana'
                    )}`
              }`,
            date:
              item.warrantyUntil,
            thingId:
              item.id,
            action:
              'thing'
          }
        );
      }

      if (
        returnDays !== null &&
        returnDays >= 0 &&
        returnDays <= 14
      ) {
        addIssue(
          issues,
          {
            id:
              `return:${item.id}`,
            priority:
              returnDays <= 3
                ? 110
                : 95,
            level:
              returnDays <= 3
                ? 'urgent'
                : 'soon',
            icon:'↩',
            title:
              t(
                'Return window closing',
                'Rok povrata uskoro završava'
              ),
            detail:
              `${title} · ${
                returnDays === 0
                  ? t(
                      'today',
                      'danas'
                    )
                  : `${returnDays} ${t(
                      'days',
                      'dana'
                    )}`
              }`,
            date:
              item.returnBy,
            thingId:
              item.id,
            action:
              'thing'
          }
        );
      }

      if (
        renewalDays !== null &&
        renewalDays >= 0 &&
        renewalDays <= 30
      ) {
        addIssue(
          issues,
          {
            id:
              `renewal:${item.id}`,
            priority:
              renewalDays <= 7
                ? 90
                : 75,
            level:
              renewalDays <= 7
                ? 'urgent'
                : 'soon',
            icon:'↻',
            title:
              t(
                'Renewal approaching',
                'Obnova se približava'
              ),
            detail:
              `${title} · ${renewalDays} ${t(
                'days',
                'dana'
              )}`,
            date:
              item.renewalAt,
            thingId:
              item.id,
            action:
              'thing'
          }
        );
      }

      if (
        item.warrantyUntil &&
        !hasWarrantyDocument(
          itemDocs
        )
      ) {
        addIssue(
          issues,
          {
            id:
              `warranty-doc:${item.id}`,
            priority:55,
            level:'missing',
            icon:'▧',
            title:
              t(
                'Warranty document missing',
                'Nedostaje dokument jamstva'
              ),
            detail:title,
            thingId:item.id,
            action:'thing'
          }
        );
      }

      if (
        (
          item.purchasedOn ||
          item.purchaseDate
        ) &&
        !hasReceipt(itemDocs)
      ) {
        addIssue(
          issues,
          {
            id:
              `receipt:${item.id}`,
            priority:50,
            level:'missing',
            icon:'▤',
            title:
              t(
                'Receipt not linked',
                'Račun nije povezan'
              ),
            detail:title,
            thingId:item.id,
            action:'thing'
          }
        );
      }

      if (
        !item.purchasedOn &&
        !item.purchaseDate
      ) {
        addIssue(
          issues,
          {
            id:
              `purchase-date:${item.id}`,
            priority:25,
            level:'complete',
            icon:'＋',
            title:
              t(
                'Add purchase date',
                'Dodaj datum kupnje'
              ),
            detail:title,
            thingId:item.id,
            action:'thing'
          }
        );
      }

      if (
        !item.brand &&
        !item.manufacturer
      ) {
        addIssue(
          issues,
          {
            id:
              `brand:${item.id}`,
            priority:15,
            level:'complete',
            icon:'＋',
            title:
              t(
                'Add brand',
                'Dodaj marku'
              ),
            detail:title,
            thingId:item.id,
            action:'thing'
          }
        );
      }
    });

    docs.forEach(
      (doc,index) => {
        if (
          relatedThing(doc)
        ) {
          return;
        }

        addIssue(
          issues,
          {
            id:
              `document:${
                doc.id ||
                index
              }`,
            priority:45,
            level:'missing',
            icon:'▧',
            title:
              t(
                'Document needs linking',
                'Dokument treba povezati'
              ),
            detail:
              doc.title ||
              doc.type ||
              t(
                'Unlinked document',
                'Nepovezani dokument'
              ),
            action:'documents'
          }
        );
      }
    );

    return issues.sort(
      (a,b) =>
        b.priority -
        a.priority
    );
  }

  function stats(issues) {
    return {
      total:
        issues.length,

      urgent:
        issues.filter(
          issue =>
            issue.level ===
            'urgent'
        ).length,

      soon:
        issues.filter(
          issue =>
            issue.level ===
            'soon'
        ).length,

      missing:
        issues.filter(
          issue =>
            issue.level ===
            'missing'
        ).length,

      complete:
        issues.filter(
          issue =>
            issue.level ===
            'complete'
        ).length
    };
  }

  function levelLabel(level) {
    switch (level) {
      case 'urgent':
        return t(
          'Urgent',
          'Hitno'
        );

      case 'soon':
        return t(
          'Soon',
          'Uskoro'
        );

      case 'missing':
        return t(
          'Missing',
          'Nedostaje'
        );

      default:
        return t(
          'Complete',
          'Dopuni'
        );
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
      document.createElement(
        'style'
      );

    style.id = STYLE_ID;

    style.textContent = `
      ${ROOT} .bos141{
        margin-top:14px
      }

      ${ROOT} .bos141-head{
        display:flex;
        justify-content:space-between;
        gap:16px;
        align-items:flex-start;
        margin-bottom:10px
      }

      ${ROOT} .bos141-head h3{
        margin:0;
        font-size:16px;
        letter-spacing:-.02em
      }

      ${ROOT} .bos141-head p{
        margin:4px 0 0;
        max-width:620px;
        color:var(--muted,#66727a);
        font-size:10px;
        line-height:1.5
      }

      ${ROOT} .bos141-count{
        min-width:46px;
        height:46px;
        display:grid;
        place-items:center;
        border-radius:14px;
        background:var(--soft,#f3f6f4);
        font-size:18px;
        font-weight:820
      }

      ${ROOT} .bos141-stats{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:7px
      }

      ${ROOT} .bos141-stat{
        padding:11px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:13px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos141-stat span{
        display:block;
        color:var(--muted,#66727a);
        font-size:8px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.06em
      }

      ${ROOT} .bos141-stat strong{
        display:block;
        margin-top:4px;
        font-size:18px
      }

      ${ROOT} .bos141-list{
        display:grid;
        gap:7px;
        margin-top:9px
      }

      ${ROOT} .bos141-item{
        display:grid;
        grid-template-columns:40px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        width:100%;
        padding:10px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:14px;
        background:var(--surface,#fff);
        color:var(--ink,#111);
        text-align:left;
        font:inherit;
        cursor:pointer;
        transition:
          transform .16s ease,
          background .16s ease
      }

      ${ROOT} .bos141-item:hover{
        transform:translateY(-1px);
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos141-icon{
        width:40px;
        height:40px;
        display:grid;
        place-items:center;
        border-radius:11px;
        background:var(--soft,#f3f6f4);
        font-size:15px
      }

      ${ROOT} .bos141-item b{
        display:block;
        font-size:11px
      }

      ${ROOT} .bos141-item small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      ${ROOT} .bos141-level{
        display:inline-flex;
        align-items:center;
        min-height:24px;
        padding:0 8px;
        border-radius:999px;
        border:1px solid var(--line,#d9e1e5);
        color:var(--muted,#66727a);
        font-size:8px;
        font-weight:800
      }

      ${ROOT} .bos141-level[data-level="urgent"]{
        color:#a53d36;
        background:rgba(165,61,54,.07);
        border-color:rgba(165,61,54,.18)
      }

      ${ROOT} .bos141-level[data-level="soon"]{
        color:#8a661d;
        background:rgba(138,102,29,.07);
        border-color:rgba(138,102,29,.18)
      }

      ${ROOT} .bos141-empty{
        padding:24px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:16px;
        background:var(--surface,#fff);
        text-align:center
      }

      ${ROOT} .bos141-empty strong{
        display:block;
        font-size:13px
      }

      ${ROOT} .bos141-empty span{
        display:block;
        margin-top:4px;
        color:var(--muted,#66727a);
        font-size:10px
      }

      @media(max-width:720px){
        ${ROOT} .bos141-stats{
          grid-template-columns:1fr 1fr
        }
      }

      @media(max-width:480px){
        ${ROOT} .bos141-head{
          align-items:center
        }

        ${ROOT} .bos141-item{
          grid-template-columns:36px minmax(0,1fr)
        }

        ${ROOT} .bos141-level{
          grid-column:2;
          justify-self:start
        }
      }

      @media(prefers-reduced-motion:reduce){
        ${ROOT} .bos141-item{
          transition:none
        }
      }
    `;

    document.head
      .appendChild(style);
  }

  function openIssue(issue) {
    if (
      issue.action ===
      'documents'
    ) {
      history.replaceState(
        null,
        '',
        '#buyeros-documents'
      );

      window.dispatchEvent(
        new Event(
          'hashchange'
        )
      );

      return;
    }

    if (
      issue.thingId
    ) {
      sessionStorage.setItem(
        SELECTED_KEY,
        issue.thingId
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
              thingId:
                issue.thingId,
              source:
                'attention-v141'
            }
          }
        )
      );
    }
  }

  function createCenter() {
    const issues =
      buildIssues();

    const summary =
      stats(issues);

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos141 bos132-section';

    section.dataset
      .v141Attention =
      'true';

    section.innerHTML = `
      <div class="bos141-head">
        <div>
          <span class="bos132-eyebrow">
            ${esc(
              t(
                'OWNERSHIP ATTENTION',
                'PAŽNJA VLASNIŠTVA'
              )
            )}
          </span>

          <h3>
            ${esc(
              t(
                'What needs your attention',
                'Što zahtijeva tvoju pažnju'
              )
            )}
          </h3>

          <p>
            ${esc(
              t(
                'Calculated from dates, documents and ownership information already stored in your BuyerOS.',
                'Izračunato iz datuma, dokumenata i podataka o vlasništvu koji su već spremljeni u tvom BuyerOS-u.'
              )
            )}
          </p>
        </div>

        <span class="bos141-count">
          ${summary.total}
        </span>
      </div>

      ${
        issues.length
          ? `
            <div class="bos141-stats">
              <article class="bos141-stat">
                <span>
                  ${esc(
                    t(
                      'URGENT',
                      'HITNO'
                    )
                  )}
                </span>
                <strong>
                  ${summary.urgent}
                </strong>
              </article>

              <article class="bos141-stat">
                <span>
                  ${esc(
                    t(
                      'SOON',
                      'USKORO'
                    )
                  )}
                </span>
                <strong>
                  ${summary.soon}
                </strong>
              </article>

              <article class="bos141-stat">
                <span>
                  ${esc(
                    t(
                      'MISSING',
                      'NEDOSTAJE'
                    )
                  )}
                </span>
                <strong>
                  ${summary.missing}
                </strong>
              </article>

              <article class="bos141-stat">
                <span>
                  ${esc(
                    t(
                      'COMPLETE',
                      'DOPUNI'
                    )
                  )}
                </span>
                <strong>
                  ${summary.complete}
                </strong>
              </article>
            </div>

            <div class="bos141-list">
              ${
                issues
                  .slice(0,8)
                  .map(
                    (issue,index) => `
                      <button
                        type="button"
                        class="bos141-item"
                        data-v141-index="${index}"
                      >
                        <span class="bos141-icon">
                          ${issue.icon}
                        </span>

                        <span>
                          <b>
                            ${esc(
                              issue.title
                            )}
                          </b>

                          <small>
                            ${esc(
                              issue.detail
                            )}
                            ${
                              issue.date
                                ? ` · ${esc(
                                    dateText(
                                      issue.date
                                    )
                                  )}`
                                : ''
                            }
                          </small>
                        </span>

                        <span
                          class="bos141-level"
                          data-level="${esc(
                            issue.level
                          )}"
                        >
                          ${esc(
                            levelLabel(
                              issue.level
                            )
                          )}
                        </span>
                      </button>
                    `
                  )
                  .join('')
              }
            </div>
          `
          : `
            <div class="bos141-empty">
              <strong>
                ${esc(
                  t(
                    'Nothing needs attention right now.',
                    'Trenutno ništa ne zahtijeva pažnju.'
                  )
                )}
              </strong>

              <span>
                ${esc(
                  t(
                    'BuyerOS found no current issues in the information you have stored.',
                    'BuyerOS nije pronašao trenutačne probleme u spremljenim podacima.'
                  )
                )}
              </span>
            </div>
          `
      }
    `;

    section
      .querySelectorAll(
        '[data-v141-index]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const issue =
              issues[
                Number(
                  button.dataset
                    .v141Index
                )
              ];

            if (issue) {
              openIssue(issue);
            }
          }
        );
      });

    return section;
  }

  function enhanceHome(root) {
    if (
      location.hash !==
        '#buyeros-home' &&
      location.hash !==
        ''
    ) {
      return;
    }

    const content =
      $('#bos132Content', root);

    if (!content) return;

    const old =
      $('[data-v141-attention]', content);

    if (old) {
      old.remove();
    }

    const center =
      createCenter();

    const target =
      $('.bos136-next', content) ||
      $('.bos136-status-strip', content) ||
      $('.bos132-page-head', content);

    if (target) {
      target.insertAdjacentElement(
        'afterend',
        center
      );
    } else {
      content.prepend(
        center
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
    enhanceHome(root);

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
                        '[data-v141-attention]'
                      ) &&
                      !node.closest?.(
                        '[data-v141-attention]'
                      )
                    )
              );

            if (relevant) {
              schedule();
            }
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

