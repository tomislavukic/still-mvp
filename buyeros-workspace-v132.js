(() => {
  'use strict';

  const OWNERSHIP_KEY = 'still-ownership-passports-v83';
  const DOCUMENTS_KEY = 'still-buyeros-documents-v132';
  const HOUSEHOLD_KEY = 'still-buyeros-household-v132';
  const FAMILY_KEY = 'still-buyeros-family-v132';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);

  const uid = prefix =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  function read(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));

    window.dispatchEvent(
      new CustomEvent('still:buyeros-data-updated', {
        detail: { key, count: value.length }
      })
    );
  }

  const things = () => read(OWNERSHIP_KEY);
  const documents = () => read(DOCUMENTS_KEY);
  const household = () => read(HOUSEHOLD_KEY);
  const family = () => read(FAMILY_KEY);

  function dateText(value) {
    if (!value) return '';

    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

    if (Number.isNaN(date.valueOf())) return '';

    return new Intl.DateTimeFormat(
      isHr() ? 'hr-HR' : 'en-GB',
      { dateStyle: 'medium' }
    ).format(date);
  }

  function daysUntil(value) {
    if (!value) return null;

    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

    if (Number.isNaN(date.valueOf())) return null;

    const now = new Date();
    now.setHours(12, 0, 0, 0);

    return Math.ceil((date - now) / 86400000);
  }

  const NAV = [
    ['home', 'Home', 'Početna', '⌂'],
    ['things', 'My Things', 'Moje stvari', '◇'],
    ['protection', 'Protection Center', 'Centar zaštite', '◉'],
    ['timeline', 'Timeline', 'Vremenska crta', '◷'],
    ['documents', 'Documents', 'Dokumenti', '▤'],
    ['services', 'Services', 'Usluge', '⌁'],
    ['household', 'Household', 'Kućanstvo', '⌂'],
    ['family', 'Family', 'Obitelj', '♙'],
    ['search', 'Search', 'Pretraži', '⌕'],
    ['assistant', 'AI Assistant', 'AI asistent', '✦']
  ];

  let current = 'home';
  let mounted = false;

  function installStyle() {
    if ($('#bos132Style')) return;

    const style = document.createElement('style');

    style.id = 'bos132Style';

    style.textContent = `
      #buyerOSCoordinatorV1{display:none!important}

      .bos132{
        width:min(1280px,calc(100% - 28px));
        margin:18px auto 34px;
        position:relative;
        z-index:20
      }

      .bos132-shell{
        display:grid;
        grid-template-columns:220px minmax(0,1fr);
        min-height:560px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:28px;
        overflow:hidden;
        background:color-mix(in srgb,var(--surface,#fff) 94%,transparent);
        box-shadow:0 24px 70px rgba(18,30,25,.10);
        backdrop-filter:blur(28px)
      }

      .bos132-sidebar{
        padding:18px 12px;
        border-right:1px solid var(--line,#d9e1e5);
        background:color-mix(in srgb,var(--surface,#fff) 86%,var(--soft,#edf3ef))
      }

      .bos132-brand{
        display:flex;
        align-items:center;
        gap:10px;
        padding:3px 8px 18px
      }

      .bos132-logo{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        border-radius:12px;
        color:white;
        background:var(--green,#337b58);
        font-weight:900
      }

      .bos132-brand b{display:block;font-size:15px}
      .bos132-brand small{
        display:block;
        margin-top:2px;
        font-size:10px;
        color:var(--muted,#66727a)
      }

      .bos132-nav{display:grid;gap:3px}

      .bos132-nav button{
        width:100%;
        min-height:42px;
        border:0;
        border-radius:11px;
        padding:0 10px;
        display:grid;
        grid-template-columns:28px 1fr;
        gap:7px;
        align-items:center;
        text-align:left;
        color:var(--muted,#66727a);
        background:transparent;
        font:inherit;
        font-size:13px;
        font-weight:720;
        cursor:pointer
      }

      .bos132-nav button span{
        text-align:center;
        font-size:17px
      }

      .bos132-nav button:hover{
        color:var(--ink,#111);
        background:var(--soft,#edf3ef)
      }

      .bos132-nav button.active{
        color:var(--ink,#111);
        background:var(--surface,#fff);
        box-shadow:0 5px 18px rgba(20,30,26,.08)
      }

      .bos132-main{
        min-width:0;
        padding:28px
      }

      .bos132-page-head{
        display:flex;
        justify-content:space-between;
        gap:20px;
        align-items:flex-start;
        margin-bottom:22px
      }

      .bos132-eyebrow{
        display:block;
        margin-bottom:8px;
        font-size:10px;
        font-weight:850;
        letter-spacing:.12em;
        color:var(--green,#337b58)
      }

      .bos132-page-head h2{
        margin:0;
        font-size:clamp(28px,4vw,46px);
        line-height:1;
        letter-spacing:-.045em
      }

      .bos132-page-head p{
        max-width:680px;
        margin:9px 0 0;
        color:var(--muted,#66727a);
        line-height:1.55
      }

      .bos132-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px
      }

      .bos132-card{
        border:1px solid var(--line,#d9e1e5);
        border-radius:18px;
        padding:17px;
        background:var(--surface,#fff)
      }

      .bos132-card span{
        display:block;
        font-size:10px;
        font-weight:850;
        letter-spacing:.09em;
        color:var(--muted,#66727a)
      }

      .bos132-card strong{
        display:block;
        margin:7px 0 4px;
        font-size:28px;
        letter-spacing:-.04em
      }

      .bos132-card p{
        margin:0;
        font-size:12px;
        line-height:1.55;
        color:var(--muted,#66727a)
      }

      .bos132-section{
        margin-top:14px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:20px;
        padding:18px;
        background:var(--surface,#fff)
      }

      .bos132-section-head{
        display:flex;
        justify-content:space-between;
        gap:15px;
        align-items:center;
        margin-bottom:14px
      }

      .bos132-section-head h3{
        margin:0;
        font-size:17px
      }

      .bos132-primary,
      .bos132-secondary{
        min-height:40px;
        padding:0 14px;
        border-radius:11px;
        font:inherit;
        font-size:12px;
        font-weight:800;
        cursor:pointer
      }

      .bos132-primary{
        border:0;
        background:var(--green,#337b58);
        color:white
      }

      .bos132-secondary{
        border:1px solid var(--line,#d9e1e5);
        background:var(--surface,#fff);
        color:var(--ink,#111)
      }

      .bos132-list{
        display:grid;
        gap:8px
      }

      .bos132-row{
        display:grid;
        grid-template-columns:42px minmax(0,1fr) auto;
        gap:11px;
        align-items:center;
        padding:11px;
        border-radius:13px;
        background:var(--soft,#f3f6f4)
      }

      .bos132-row-icon{
        width:38px;
        height:38px;
        border-radius:11px;
        display:grid;
        place-items:center;
        background:var(--surface,#fff);
        font-size:17px
      }

      .bos132-row b{
        display:block;
        font-size:13px
      }

      .bos132-row small{
        display:block;
        margin-top:2px;
        color:var(--muted,#66727a)
      }


      .bos132-mini-pill{
        display:inline-flex;
        align-items:center;
        min-height:23px;
        padding:0 8px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:999px;
        background:var(--surface,#fff);
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:760
      }

      .bos132-timeline-list{
        display:grid
      }

      .bos132-timeline-event{
        display:grid;
        grid-template-columns:110px 24px minmax(0,1fr);
        gap:10px;
        min-height:72px
      }

      .bos132-timeline-date{
        padding-top:2px;
        text-align:right;
        color:var(--muted,#66727a);
        font-size:10px
      }

      .bos132-timeline-track{
        position:relative
      }

      .bos132-timeline-track::before{
        content:'';
        position:absolute;
        left:11px;
        top:0;
        bottom:0;
        width:1px;
        background:var(--line,#d9e1e5)
      }

      .bos132-timeline-track span{
        position:absolute;
        z-index:2;
        left:6px;
        top:3px;
        width:10px;
        height:10px;
        border-radius:50%;
        background:var(--green,#337b58);
        border:3px solid var(--surface,#fff);
        box-shadow:0 0 0 1px var(--line,#d9e1e5)
      }

      .bos132-timeline-event b{
        display:block;
        font-size:13px
      }

      .bos132-timeline-event small{
        display:block;
        margin-top:4px;
        color:var(--muted,#66727a)
      }

      .bos132-empty{
        padding:34px 18px;
        text-align:center;
        color:var(--muted,#66727a)
      }

      .bos132-form{
        display:grid;
        gap:12px
      }

      .bos132-form-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px
      }

      .bos132-form label{
        display:grid;
        gap:6px;
        font-size:11px;
        font-weight:780;
        color:var(--muted,#66727a)
      }

      .bos132-form input,
      .bos132-form select,
      .bos132-form textarea{
        width:100%;
        box-sizing:border-box;
        border:1px solid var(--line,#d9e1e5);
        border-radius:11px;
        padding:10px 11px;
        background:var(--field,var(--surface,#fff));
        color:var(--ink,#111);
        font:inherit
      }

      .bos132-form textarea{
        min-height:90px;
        resize:vertical
      }

      .bos132-searchbox{
        display:flex;
        gap:8px;
        margin-bottom:14px
      }

      .bos132-searchbox input{
        flex:1;
        min-height:48px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:14px;
        padding:0 15px;
        background:var(--surface,#fff);
        color:var(--ink,#111);
        font:inherit;
        font-size:16px
      }

      .bos132-chat{
        max-width:780px
      }

      .bos132-chat-log{
        display:grid;
        gap:10px;
        min-height:220px;
        margin-bottom:12px
      }

      .bos132-message{
        max-width:82%;
        padding:12px 14px;
        border-radius:16px;
        line-height:1.55;
        font-size:13px
      }

      .bos132-message.user{
        margin-left:auto;
        background:var(--ink,#111);
        color:var(--surface,#fff)
      }

      .bos132-message.assistant{
        background:var(--soft,#f3f6f4)
      }

      .bos132-chat-form{
        display:flex;
        gap:8px
      }

      .bos132-chat-form input{
        flex:1;
        min-height:46px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:13px;
        padding:0 13px;
        background:var(--surface,#fff);
        color:var(--ink,#111);
        font:inherit
      }

      .bos132-chips{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:12px
      }

      .bos132-chips button{
        border:1px solid var(--line,#d9e1e5);
        border-radius:999px;
        padding:7px 10px;
        background:var(--surface,#fff);
        color:var(--muted,#66727a);
        font-size:11px;
        cursor:pointer
      }

      dialog.bos132-dialog{
        width:min(620px,calc(100% - 28px));
        border:1px solid var(--line,#d9e1e5);
        border-radius:22px;
        padding:0;
        background:var(--surface,#fff);
        color:var(--ink,#111);
        box-shadow:0 30px 100px rgba(0,0,0,.25)
      }

      dialog.bos132-dialog::backdrop{
        background:rgba(8,15,12,.35);
        backdrop-filter:blur(8px)
      }

      .bos132-dialog-inner{
        padding:22px
      }

      .bos132-dialog-head{
        display:flex;
        justify-content:space-between;
        gap:15px;
        margin-bottom:18px
      }

      .bos132-dialog-head h3{
        margin:0
      }

      .bos132-dialog-head button{
        border:0;
        background:transparent;
        cursor:pointer;
        color:var(--muted,#66727a)
      }

      @media(max-width:900px){
        .bos132-shell{grid-template-columns:1fr}
        .bos132-sidebar{
          border-right:0;
          border-bottom:1px solid var(--line,#d9e1e5)
        }
        .bos132-nav{
          display:flex;
          overflow-x:auto
        }
        .bos132-nav button{
          width:auto;
          min-width:max-content
        }
        .bos132-grid{
          grid-template-columns:1fr 1fr
        }
      }

      @media(max-width:560px){
        .bos132-main{padding:18px}
        .bos132-grid,
        .bos132-form-grid{
          grid-template-columns:1fr
        }
      }
    `;

    document.head.appendChild(style);
  }

  function shell() {
    return `
      <section class="bos132" id="buyerOSV132">
        <div class="bos132-shell">

          <aside class="bos132-sidebar">

            <div class="bos132-brand">
              <span class="bos132-logo">S</span>

              <div>
                <b>BuyerOS</b>
                <small>${t(
                  'Everything you own',
                  'Sve što posjeduješ'
                )}</small>
              </div>
            </div>

            <nav class="bos132-nav">
              ${NAV.map(([id, en, hr, icon]) => `
                <button
                  type="button"
                  data-bos132-nav="${id}"
                  class="${id === current ? 'active' : ''}"
                >
                  <span>${icon}</span>
                  ${t(en, hr)}
                </button>
              `).join('')}
            </nav>

          </aside>

          <main class="bos132-main" id="bos132Content"></main>

        </div>
      </section>

      <dialog class="bos132-dialog" id="bos132Dialog"></dialog>
    `;
  }

  function pageHead(kicker, title, description, action = '') {
    return `
      <header class="bos132-page-head">
        <div>
          <span class="bos132-eyebrow">${kicker}</span>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>

        ${action}
      </header>
    `;
  }

  function stats() {
    const items = things();
    const docs = documents();
    const people = family();
    const home = household();

    const upcoming = items.filter(item =>
      [
        item.returnBy,
        item.warrantyUntil,
        item.renewalAt,
        item.nextActionAt
      ].some(value => {
        const days = daysUntil(value);
        return days !== null && days >= 0 && days <= 60;
      })
    );

    return { items, docs, people, home, upcoming };
  }

  function renderHome() {
    const { items, docs, people, home, upcoming } = stats();

    const recent = items.slice(-5).reverse();

    return `
      ${pageHead(
        'BUYEROS',
        t('Everything you own.', 'Sve što posjeduješ.'),
        t(
          'Your things, documents, protection, services and people in one calm workspace.',
          'Tvoje stvari, dokumenti, zaštita, usluge i ljudi u jednom mirnom radnom prostoru.'
        )
      )}

      <div class="bos132-grid">

        <article class="bos132-card">
          <span>${t('MY THINGS', 'MOJE STVARI')}</span>
          <strong>${items.length}</strong>
          <p>${t(
            'Products, services, subscriptions and commitments.',
            'Proizvodi, usluge, pretplate i obveze.'
          )}</p>
        </article>

        <article class="bos132-card">
          <span>${t('DOCUMENTS', 'DOKUMENTI')}</span>
          <strong>${docs.length}</strong>
          <p>${t(
            'Receipts, invoices, manuals and other records.',
            'Računi, fakture, priručnici i drugi zapisi.'
          )}</p>
        </article>

        <article class="bos132-card">
          <span>${t('NEXT 60 DAYS', 'SLJEDEĆIH 60 DANA')}</span>
          <strong>${upcoming.length}</strong>
          <p>${t(
            'Upcoming dates that may need attention.',
            'Nadolazeći datumi koji mogu zahtijevati pažnju.'
          )}</p>
        </article>

        <article class="bos132-card">
          <span>${t('HOUSEHOLD', 'KUĆANSTVO')}</span>
          <strong>${home.length}</strong>
          <p>${t(
            `${people.length} family profiles stored locally.`,
            `${people.length} obiteljskih profila spremljeno lokalno.`
          )}</p>
        </article>

      </div>

      <section class="bos132-section">

        <div class="bos132-section-head">
          <h3>${t('Recently added', 'Nedavno dodano')}</h3>

          <button
            class="bos132-secondary"
            data-bos132-go="things"
          >
            ${t('View all', 'Prikaži sve')}
          </button>
        </div>

        ${
          recent.length
            ? `<div class="bos132-list">
                ${recent.map(item => `
                  <div class="bos132-row">
                    <span class="bos132-row-icon">◇</span>

                    <div>
                      <b>${esc(item.title || t(
                        'Untitled thing',
                        'Stvar bez naziva'
                      ))}</b>

                      <small>${esc(
                        item.business || item.kind || ''
                      )}</small>
                    </div>

                    <span>→</span>
                  </div>
                `).join('')}
              </div>`
            : `<div class="bos132-empty">
                ${t(
                  'Your Still is empty. Add something you already own in My Things.',
                  'Tvoj Still je prazan. Dodaj nešto što već posjeduješ u Moje stvari.'
                )}
              </div>`
        }

      </section>
    `;
  }

  function thingCard(item) {
    const warrantyDays = daysUntil(item.warrantyUntil);
    const returnDays = daysUntil(item.returnBy);

    return `
      <div class="bos132-row">

        <span class="bos132-row-icon">◇</span>

        <div>
          <b>${esc(
            item.title ||
            t('Untitled thing', 'Stvar bez naziva')
          )}</b>

          <small>
            ${esc(
              item.business ||
              item.store ||
              item.kind ||
              t('Personal ownership', 'Osobno vlasništvo')
            )}
          </small>

          <div style="
            display:flex;
            gap:6px;
            flex-wrap:wrap;
            margin-top:7px
          ">

            ${
              item.purchaseDate
                ? `<span class="bos132-mini-pill">
                    ${t('Bought', 'Kupljeno')} ${esc(dateText(item.purchaseDate))}
                   </span>`
                : ''
            }

            ${
              warrantyDays !== null && warrantyDays >= 0
                ? `<span class="bos132-mini-pill">
                    ${t('Warranty', 'Jamstvo')} ${warrantyDays}d
                   </span>`
                : ''
            }

            ${
              returnDays !== null && returnDays >= 0
                ? `<span class="bos132-mini-pill">
                    ${t('Return', 'Povrat')} ${returnDays}d
                   </span>`
                : ''
            }

          </div>
        </div>

        <span>→</span>

      </div>
    `;
  }

  function thingsPage() {
    const data = things();

    return `
      ${pageHead(
        'MY THINGS',
        t('Everything you own.', 'Sve što posjeduješ.'),
        t(
          'Products, services, subscriptions and other things you want Still to remember.',
          'Proizvodi, usluge, pretplate i druge stvari koje želiš da Still pamti.'
        )
      )}

      <section class="bos132-section">

        <div class="bos132-section-head">
          <h3>
            ${data.length}
            ${t('ownership records', 'zapisa vlasništva')}
          </h3>
        </div>

        ${
          data.length
            ? `<div class="bos132-list">
                ${data.map(thingCard).join('')}
              </div>`
            : `<div class="bos132-empty">
                ${t(
                  'Nothing here yet. Add something you already own.',
                  'Ovdje još nema ničega. Dodaj nešto što već posjeduješ.'
                )}
              </div>`
        }

      </section>
    `;
  }

  function protectionPage() {
    const data = things();

    const active = data.filter(item => {
      const days = daysUntil(item.warrantyUntil);
      return days !== null && days >= 0;
    });

    const expiring = active.filter(item => {
      const days = daysUntil(item.warrantyUntil);
      return days !== null && days <= 60;
    });

    const returns = data.filter(item => {
      const days = daysUntil(item.returnBy);
      return days !== null && days >= 0;
    });

    const protectedItems = data.filter(
      item => item.warrantyUntil || item.returnBy
    );

    return `
      ${pageHead(
        t('PROTECTION CENTER', 'CENTAR ZAŠTITE'),
        t('Know what protects it.', 'Znaj što ga štiti.'),
        t(
          'Warranty dates and return windows are visible directly inside BuyerOS.',
          'Datumi jamstva i rokovi povrata vidljivi su izravno unutar BuyerOS-a.'
        )
      )}

      <div class="bos132-grid">

        <article class="bos132-card">
          <span>${t('ACTIVE WARRANTIES', 'AKTIVNA JAMSTVA')}</span>
          <strong>${active.length}</strong>
          <p>${t(
            'Recorded warranties still active.',
            'Evidentirana jamstva koja još vrijede.'
          )}</p>
        </article>

        <article class="bos132-card">
          <span>${t('EXPIRING SOON', 'USKORO ISTJEČE')}</span>
          <strong>${expiring.length}</strong>
          <p>${t(
            'Within the next 60 days.',
            'Unutar sljedećih 60 dana.'
          )}</p>
        </article>

        <article class="bos132-card">
          <span>${t('RETURN WINDOWS', 'ROKOVI POVRATA')}</span>
          <strong>${returns.length}</strong>
          <p>${t(
            'Recorded return deadlines still open.',
            'Evidentirani rokovi povrata koji još traju.'
          )}</p>
        </article>

        <article class="bos132-card">
          <span>${t('MISSING WARRANTY DATE', 'NEDOSTAJE DATUM JAMSTVA')}</span>
          <strong>${data.filter(item => !item.warrantyUntil).length}</strong>
          <p>${t(
            'Ownership records without a warranty date.',
            'Zapisi vlasništva bez datuma jamstva.'
          )}</p>
        </article>

      </div>

      <section class="bos132-section">

        <div class="bos132-section-head">
          <h3>${t('Protection overview', 'Pregled zaštite')}</h3>
        </div>

        ${
          protectedItems.length
            ? `<div class="bos132-list">
                ${protectedItems.map(item => {
                  const warrantyDays = daysUntil(item.warrantyUntil);
                  const returnDays = daysUntil(item.returnBy);

                  return `
                    <div class="bos132-row">

                      <span class="bos132-row-icon">◉</span>

                      <div>
                        <b>${esc(
                          item.title ||
                          t('Untitled thing', 'Stvar bez naziva')
                        )}</b>

                        <small>
                          ${
                            item.warrantyUntil
                              ? `${t('Warranty until', 'Jamstvo do')} ${esc(dateText(item.warrantyUntil))}`
                              : t(
                                  'Warranty date not recorded',
                                  'Datum jamstva nije evidentiran'
                                )
                          }
                        </small>

                        <div style="
                          display:flex;
                          gap:6px;
                          flex-wrap:wrap;
                          margin-top:7px
                        ">

                          ${
                            warrantyDays !== null && warrantyDays >= 0
                              ? `<span class="bos132-mini-pill">
                                  ${warrantyDays} ${t('days', 'dana')}
                                 </span>`
                              : ''
                          }

                          ${
                            returnDays !== null && returnDays >= 0
                              ? `<span class="bos132-mini-pill">
                                  ${t('Return', 'Povrat')} ${returnDays}d
                                 </span>`
                              : ''
                          }

                        </div>
                      </div>

                      <span>›</span>

                    </div>
                  `;
                }).join('')}
              </div>`
            : `<div class="bos132-empty">
                ${t(
                  'No protection dates are recorded yet.',
                  'Još nema evidentiranih datuma zaštite.'
                )}
              </div>`
        }

      </section>
    `;
  }

  function timelineEvents() {
    const events = [];

    things().forEach(item => {
      const title =
        item.title ||
        t('Untitled thing', 'Stvar bez naziva');

      if (item.createdAt) {
        events.push({
          date: item.createdAt,
          title: t('Added to Still', 'Dodano u Still'),
          detail: title
        });
      }

      if (item.purchaseDate) {
        events.push({
          date: item.purchaseDate,
          title: t('Purchased', 'Kupljeno'),
          detail: title
        });
      }

      if (item.returnBy) {
        events.push({
          date: item.returnBy,
          title: t('Return deadline', 'Rok povrata'),
          detail: title
        });
      }

      if (item.warrantyUntil) {
        events.push({
          date: item.warrantyUntil,
          title: t('Warranty ends', 'Jamstvo završava'),
          detail: title
        });
      }

      if (item.renewalAt) {
        events.push({
          date: item.renewalAt,
          title: t('Renewal', 'Obnova'),
          detail: title
        });
      }
    });

    documents().forEach(doc => {
      if (!doc.date) return;

      events.push({
        date: doc.date,
        title: t('Document added', 'Dodan dokument'),
        detail: doc.title
      });
    });

    return events
      .filter(event => event.date)
      .sort(
        (a, b) =>
          String(b.date).localeCompare(String(a.date))
      );
  }

  function timelinePage() {
    const events = timelineEvents();

    return `
      ${pageHead(
        'TIMELINE',
        t('Everything has a history.', 'Sve ima svoju povijest.'),
        t(
          'Purchases, warranty dates, return deadlines and documents form one ownership timeline.',
          'Kupnje, datumi jamstva, rokovi povrata i dokumenti čine jednu vremensku crtu vlasništva.'
        )
      )}

      <section class="bos132-section">

        ${
          events.length
            ? `<div class="bos132-timeline-list">
                ${events.map(event => `
                  <div class="bos132-timeline-event">

                    <div class="bos132-timeline-date">
                      ${esc(dateText(event.date))}
                    </div>

                    <div class="bos132-timeline-track">
                      <span></span>
                    </div>

                    <div>
                      <b>${esc(event.title)}</b>
                      <small>${esc(event.detail)}</small>
                    </div>

                  </div>
                `).join('')}
              </div>`
            : `<div class="bos132-empty">
                ${t(
                  'Your timeline will appear as you add things and documents.',
                  'Tvoja vremenska crta pojavit će se kako dodaješ stvari i dokumente.'
                )}
              </div>`
        }

      </section>
    `;
  }

  function servicesPage() {
    const items = things();

    const serviceLike = items.filter(item =>
      ['service', 'subscription', 'rental', 'booking']
        .includes(String(item.kind || '').toLowerCase())
    );

    return `
      ${pageHead(
        'SERVICES',
        t('Keep it working.', 'Neka i dalje radi.'),
        t(
          'Services, subscriptions, rentals and bookings connected to your ownership records.',
          'Usluge, pretplate, najmovi i rezervacije povezani s tvojim zapisima vlasništva.'
        )
      )}

      <section class="bos132-section">

        <div class="bos132-section-head">
          <h3>
            ${serviceLike.length}
            ${t('service records', 'servisnih zapisa')}
          </h3>
        </div>

        ${
          serviceLike.length
            ? `<div class="bos132-list">
                ${serviceLike.map(item => `
                  <div class="bos132-row">

                    <span class="bos132-row-icon">⌁</span>

                    <div>
                      <b>${esc(
                        item.title ||
                        t('Untitled service', 'Usluga bez naziva')
                      )}</b>

                      <small>
                        ${esc(
                          item.business ||
                          item.kind ||
                          ''
                        )}
                      </small>
                    </div>

                    <span>›</span>

                  </div>
                `).join('')}
              </div>`
            : `<div class="bos132-empty">
                ${t(
                  'No services or subscriptions are stored yet.',
                  'Još nema spremljenih usluga ili pretplata.'
                )}
              </div>`
        }

      </section>
    `;
  }

  function documentPage() {
    const data = documents();

    return `
      ${pageHead(
        'DOCUMENTS',
        t(
          'Proof, without the paper hunt.',
          'Dokazi bez lova na papire.'
        ),
        t(
          'Keep references to receipts, invoices, manuals, certificates and other ownership documents.',
          'Čuvaj reference na račune, fakture, priručnike, potvrde i druge dokumente vlasništva.'
        ),
        `<button
          class="bos132-primary"
          data-bos132-add="document"
        >
          + ${t('Add document', 'Dodaj dokument')}
        </button>`
      )}

      <section class="bos132-section">
        ${
          data.length
            ? `<div class="bos132-list">
                ${data.map(doc => `
                  <div class="bos132-row">

                    <span class="bos132-row-icon">▤</span>

                    <div>
                      <b>${esc(doc.title)}</b>

                      <small>
                        ${esc(doc.type)}
                        ${doc.reference ? ` · ${esc(doc.reference)}` : ''}
                        ${doc.date ? ` · ${esc(dateText(doc.date))}` : ''}
                      </small>
                    </div>

                    <button
                      data-bos132-delete-document="${esc(doc.id)}"
                    >×</button>

                  </div>
                `).join('')}
              </div>`
            : `<div class="bos132-empty">
                ${t(
                  'No documents yet.',
                  'Još nema dokumenata.'
                )}
              </div>`
        }
      </section>
    `;
  }

  function householdPage() {
    const data = household();

    return `
      ${pageHead(
        'HOUSEHOLD',
        t(
          'Your home has an inventory.',
          'Tvoj dom ima inventar.'
        ),
        t(
          'Organize rooms and household spaces.',
          'Organiziraj prostorije i prostore kućanstva.'
        ),
        `<button
          class="bos132-primary"
          data-bos132-add="household"
        >
          + ${t('Add room', 'Dodaj prostoriju')}
        </button>`
      )}

      <section class="bos132-section">

        ${
          data.length
            ? `<div class="bos132-list">
                ${data.map(room => `
                  <div class="bos132-row">

                    <span class="bos132-row-icon">⌂</span>

                    <div>
                      <b>${esc(room.name)}</b>
                      <small>${esc(room.notes || '')}</small>
                    </div>

                    <button
                      data-bos132-delete-household="${esc(room.id)}"
                    >×</button>

                  </div>
                `).join('')}
              </div>`
            : `<div class="bos132-empty">
                ${t(
                  'Start with Kitchen, Living room or Garage.',
                  'Počni s Kuhinjom, Dnevnim boravkom ili Garažom.'
                )}
              </div>`
        }

      </section>
    `;
  }

  function familyPage() {
    const data = family();

    return `
      ${pageHead(
        'FAMILY',
        t(
          'Ownership is sometimes shared.',
          'Vlasništvo je ponekad zajedničko.'
        ),
        t(
          'Keep local family profiles for shared household context. Nothing is automatically shared with companies.',
          'Čuvaj lokalne profile obitelji za zajednički kontekst kućanstva. Ništa se automatski ne dijeli s tvrtkama.'
        ),
        `<button
          class="bos132-primary"
          data-bos132-add="family"
        >
          + ${t('Add person', 'Dodaj osobu')}
        </button>`
      )}

      <section class="bos132-section">

        ${
          data.length
            ? `<div class="bos132-list">
                ${data.map(person => `
                  <div class="bos132-row">

                    <span class="bos132-row-icon">♙</span>

                    <div>
                      <b>${esc(person.name)}</b>
                      <small>${esc(person.role || '')}</small>
                    </div>

                    <button
                      data-bos132-delete-family="${esc(person.id)}"
                    >×</button>

                  </div>
                `).join('')}
              </div>`
            : `<div class="bos132-empty">
                ${t(
                  'No family profiles yet.',
                  'Još nema obiteljskih profila.'
                )}
              </div>`
        }

      </section>
    `;
  }

  function searchData(query = '') {
    const needle = query
      .trim()
      .toLocaleLowerCase(isHr() ? 'hr' : 'en');

    const result = [];

    things().forEach(item => {
      result.push({
        type: t('Thing', 'Stvar'),
        icon: '◇',
        title: item.title || t(
          'Untitled thing',
          'Stvar bez naziva'
        ),
        subtitle: item.business || item.kind || '',
        text: [
          item.title,
          item.business,
          item.kind,
          item.reference,
          item.notes
        ].join(' ')
      });
    });

    documents().forEach(item => {
      result.push({
        type: t('Document', 'Dokument'),
        icon: '▤',
        title: item.title,
        subtitle: item.type || '',
        text: [
          item.title,
          item.type,
          item.reference,
          item.notes
        ].join(' ')
      });
    });

    household().forEach(item => {
      result.push({
        type: t('Household', 'Kućanstvo'),
        icon: '⌂',
        title: item.name,
        subtitle: item.notes || '',
        text: [item.name, item.notes].join(' ')
      });
    });

    family().forEach(item => {
      result.push({
        type: t('Family', 'Obitelj'),
        icon: '♙',
        title: item.name,
        subtitle: item.role || '',
        text: [item.name, item.role].join(' ')
      });
    });

    if (!needle) return result.slice(0, 40);

    return result
      .filter(item =>
        item.text
          .toLocaleLowerCase(isHr() ? 'hr' : 'en')
          .includes(needle)
      )
      .slice(0, 60);
  }

  function searchResults(results) {
    if (!results.length) {
      return `
        <div class="bos132-empty">
          ${t(
            'Nothing matched your search.',
            'Ništa ne odgovara pretrazi.'
          )}
        </div>
      `;
    }

    return `
      <div class="bos132-list">

        ${results.map(item => `
          <div class="bos132-row">

            <span class="bos132-row-icon">${item.icon}</span>

            <div>
              <b>${esc(item.title)}</b>

              <small>
                ${esc(item.type)}
                ${item.subtitle ? ` · ${esc(item.subtitle)}` : ''}
              </small>
            </div>

            <span>→</span>

          </div>
        `).join('')}

      </div>
    `;
  }

  function searchPage(query = '') {
    return `
      ${pageHead(
        'SEARCH',
        t(
          'Find anything in Still.',
          'Pronađi bilo što u Still-u.'
        ),
        t(
          'Search across things, documents, household and family.',
          'Pretraži stvari, dokumente, kućanstvo i obitelj.'
        )
      )}

      <div class="bos132-searchbox">

        <input
          id="bos132SearchInput"
          type="search"
          autocomplete="off"
          value="${esc(query)}"
          placeholder="${t(
            'Search products, receipts, people, rooms…',
            'Traži proizvode, račune, osobe, prostorije…'
          )}"
        >

      </div>

      <section
        class="bos132-section"
        id="bos132SearchResults"
      >
        ${searchResults(searchData(query))}
      </section>
    `;
  }

  function answerAssistant(question) {
    const q = String(question || '')
      .trim()
      .toLowerCase();

    const items = things();
    const docs = documents();
    const home = household();
    const people = family();

    if (
      q.includes('how many') ||
      q.includes('koliko')
    ) {
      return t(
        `You have ${items.length} ownership records, ${docs.length} documents, ${home.length} household spaces and ${people.length} family profiles stored in this browser.`,
        `U ovom pregledniku imaš ${items.length} zapisa vlasništva, ${docs.length} dokumenata, ${home.length} prostora kućanstva i ${people.length} obiteljskih profila.`
      );
    }

    if (
      q.includes('warranty') ||
      q.includes('jamstv')
    ) {
      const values = items
        .filter(item => item.warrantyUntil)
        .map(item => ({
          item,
          days: daysUntil(item.warrantyUntil)
        }))
        .filter(x => x.days !== null)
        .sort((a, b) => a.days - b.days);

      if (!values.length) {
        return t(
          'I do not have any warranty dates stored yet.',
          'Još nemam spremljenih datuma jamstva.'
        );
      }

      const next = values[0];

      return t(
        `${next.item.title || 'The next item'} has the nearest recorded warranty date: ${dateText(next.item.warrantyUntil)}.`,
        `${next.item.title || 'Sljedeća stvar'} ima najbliži evidentirani datum jamstva: ${dateText(next.item.warrantyUntil)}.`
      );
    }

    if (
      q.includes('document') ||
      q.includes('receipt') ||
      q.includes('račun') ||
      q.includes('dokument')
    ) {
      return docs.length
        ? t(
            `I found ${docs.length} document records.`,
            `Pronašao sam ${docs.length} zapisa dokumenata.`
          )
        : t(
            'There are no document records stored yet.',
            'Još nema spremljenih zapisa dokumenata.'
          );
    }

    const words = q
      .split(/\s+/)
      .filter(word => word.length >= 3);

    const matches = items.filter(item => {
      const text = [
        item.title,
        item.business,
        item.notes,
        item.reference
      ].join(' ').toLowerCase();

      return words.some(word => text.includes(word));
    });

    if (matches.length) {
      return t(
        `I found ${matches.length} matching ownership records: ${matches.slice(0,5).map(item => item.title || 'Untitled').join(', ')}.`,
        `Pronašao sam ${matches.length} odgovarajućih zapisa vlasništva: ${matches.slice(0,5).map(item => item.title || 'Bez naziva').join(', ')}.`
      );
    }

    return t(
      'I cannot answer that from the information currently stored in Still. I will not invent missing information.',
      'Na to ne mogu odgovoriti iz informacija koje su trenutačno spremljene u Still-u. Neću izmišljati podatke koji nedostaju.'
    );
  }

  function assistantPage() {
    return `
      ${pageHead(
        'AI ASSISTANT',
        t(
          'Ask your ownership history.',
          'Pitaj svoju povijest vlasništva.'
        ),
        t(
          'This assistant currently reads only local Still data. It does not send your ownership graph to an external AI service.',
          'Ovaj asistent trenutačno čita samo lokalne Still podatke. Ne šalje tvoj graf vlasništva vanjskom AI servisu.'
        )
      )}

      <section class="bos132-section bos132-chat">

        <div class="bos132-chat-log" id="bos132ChatLog">

          <div class="bos132-message assistant">
            ${t(
              'Ask me about your stored things, warranty dates and documents.',
              'Pitaj me o spremljenim stvarima, datumima jamstva i dokumentima.'
            )}
          </div>

        </div>

        <form
          class="bos132-chat-form"
          id="bos132ChatForm"
        >
          <input
            name="question"
            required
            autocomplete="off"
            placeholder="${t(
              'Ask about something you own…',
              'Pitaj nešto o onome što posjeduješ…'
            )}"
          >

          <button class="bos132-primary">
            ${t('Ask', 'Pitaj')}
          </button>
        </form>

        <div class="bos132-chips">

          <button
            type="button"
            data-bos132-prompt="${t(
              'Which warranty expires next?',
              'Koje jamstvo sljedeće istječe?'
            )}"
          >
            ${t('Next warranty', 'Sljedeće jamstvo')}
          </button>

          <button
            type="button"
            data-bos132-prompt="${t(
              'How many things do I have?',
              'Koliko stvari imam?'
            )}"
          >
            ${t('My totals', 'Moji ukupni podaci')}
          </button>

          <button
            type="button"
            data-bos132-prompt="${t(
              'How many documents do I have?',
              'Koliko dokumenata imam?'
            )}"
          >
            ${t('Documents', 'Dokumenti')}
          </button>

        </div>

      </section>
    `;
  }

  function openDialog(type) {
    const dialog = $('#bos132Dialog');

    const configs = {
      document: {
        title: t('Add document', 'Dodaj dokument'),
        body: `
          <label>
            ${t('Document name', 'Naziv dokumenta')}
            <input name="title" required maxlength="120">
          </label>

          <label>
            ${t('Type', 'Vrsta')}
            <select name="type">
              <option>${t('Receipt', 'Račun')}</option>
              <option>${t('Invoice', 'Faktura')}</option>
              <option>${t('Manual', 'Priručnik')}</option>
              <option>${t(
                'Warranty document',
                'Jamstveni dokument'
              )}</option>
              <option>${t('Certificate', 'Potvrda')}</option>
              <option>${t('Other', 'Ostalo')}</option>
            </select>
          </label>

          <div class="bos132-form-grid">
            <label>
              ${t('Date', 'Datum')}
              <input name="date" type="date">
            </label>

            <label>
              ${t('Reference', 'Referenca')}
              <input name="reference" maxlength="120">
            </label>
          </div>

          <label>
            ${t('Private notes', 'Privatne bilješke')}
            <textarea name="notes" maxlength="800"></textarea>
          </label>
        `
      },

      household: {
        title: t(
          'Add household space',
          'Dodaj prostor kućanstva'
        ),
        body: `
          <label>
            ${t('Room or space', 'Prostorija ili prostor')}
            <input name="name" required maxlength="100">
          </label>

          <label>
            ${t('Notes', 'Bilješke')}
            <textarea name="notes" maxlength="600"></textarea>
          </label>
        `
      },

      family: {
        title: t(
          'Add family member',
          'Dodaj člana obitelji'
        ),
        body: `
          <label>
            ${t('Name', 'Ime')}
            <input name="name" required maxlength="100">
          </label>

          <label>
            ${t('Relationship', 'Odnos')}
            <input
              name="role"
              maxlength="100"
              placeholder="${t(
                'Partner, child, parent…',
                'Partner, dijete, roditelj…'
              )}"
            >
          </label>
        `
      }
    };

    const config = configs[type];

    if (!dialog || !config) return;

    dialog.innerHTML = `
      <div class="bos132-dialog-inner">

        <div class="bos132-dialog-head">
          <h3>${config.title}</h3>
          <button type="button" data-bos132-close>×</button>
        </div>

        <form
          class="bos132-form"
          id="bos132CrudForm"
          data-type="${type}"
        >
          ${config.body}

          <button class="bos132-primary" type="submit">
            ${t('Save', 'Spremi')}
          </button>
        </form>

      </div>
    `;

    $('[data-bos132-close]', dialog)
      ?.addEventListener(
        'click',
        () => dialog.close()
      );

    $('#bos132CrudForm', dialog)
      ?.addEventListener(
        'submit',
        saveDialog
      );

    dialog.showModal();
  }

  function saveDialog(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const fd = new FormData(form);

    if (form.dataset.type === 'document') {
      const data = documents();

      data.push({
        id: uid('doc'),
        title: String(fd.get('title') || '').trim(),
        type: String(fd.get('type') || '').trim(),
        date: String(fd.get('date') || ''),
        reference: String(fd.get('reference') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        createdAt: new Date().toISOString()
      });

      write(DOCUMENTS_KEY, data);
    }

    if (form.dataset.type === 'household') {
      const data = household();

      data.push({
        id: uid('room'),
        name: String(fd.get('name') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        createdAt: new Date().toISOString()
      });

      write(HOUSEHOLD_KEY, data);
    }

    if (form.dataset.type === 'family') {
      const data = family();

      data.push({
        id: uid('person'),
        name: String(fd.get('name') || '').trim(),
        role: String(fd.get('role') || '').trim(),
        createdAt: new Date().toISOString()
      });

      write(FAMILY_KEY, data);
    }

    $('#bos132Dialog')?.close();
    render();
  }

  function removeById(key, id) {
    write(
      key,
      read(key).filter(item => item.id !== id)
    );

    render();
  }

  function appendChat(text, role) {
    const log = $('#bos132ChatLog');

    if (!log) return;

    const message = document.createElement('div');

    message.className = `bos132-message ${role}`;
    message.textContent = text;

    log.appendChild(message);
  }

  function bindContent() {
    $$('[data-bos132-go]').forEach(button => {
      button.addEventListener(
        'click',
        () => navigate(button.dataset.bos132Go)
      );
    });

    $$('[data-bos132-add]').forEach(button => {
      button.addEventListener(
        'click',
        () => openDialog(button.dataset.bos132Add)
      );
    });

    $$('[data-bos132-delete-document]').forEach(button => {
      button.addEventListener(
        'click',
        () => removeById(
          DOCUMENTS_KEY,
          button.dataset.bos132DeleteDocument
        )
      );
    });

    $$('[data-bos132-delete-household]').forEach(button => {
      button.addEventListener(
        'click',
        () => removeById(
          HOUSEHOLD_KEY,
          button.dataset.bos132DeleteHousehold
        )
      );
    });

    $$('[data-bos132-delete-family]').forEach(button => {
      button.addEventListener(
        'click',
        () => removeById(
          FAMILY_KEY,
          button.dataset.bos132DeleteFamily
        )
      );
    });

    const searchInput = $('#bos132SearchInput');

    searchInput?.addEventListener('input', () => {
      const results = $('#bos132SearchResults');

      if (results) {
        results.innerHTML = searchResults(
          searchData(searchInput.value)
        );
      }
    });

    const chatForm = $('#bos132ChatForm');

    chatForm?.addEventListener(
      'submit',
      event => {
        event.preventDefault();

        const question =
          chatForm.elements.question.value.trim();

        if (!question) return;

        appendChat(question, 'user');
        appendChat(
          answerAssistant(question),
          'assistant'
        );

        chatForm.reset();
      }
    );

    $$('[data-bos132-prompt]').forEach(button => {
      button.addEventListener(
        'click',
        () => {
          const question =
            button.dataset.bos132Prompt;

          appendChat(question, 'user');
          appendChat(
            answerAssistant(question),
            'assistant'
          );
        }
      );
    });
  }

  function render() {
    const content = $('#bos132Content');

    if (!content) return;

    $$('.bos132-nav button').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.bos132Nav === current
      );
    });

    if (current === 'home') {
      content.innerHTML = renderHome();
    } else if (current === 'things') {
      content.innerHTML = thingsPage();
    } else if (current === 'protection') {
      content.innerHTML = protectionPage();
    } else if (current === 'timeline') {
      content.innerHTML = timelinePage();
    } else if (current === 'services') {
      content.innerHTML = servicesPage();
    } else if (current === 'documents') {
      content.innerHTML = documentPage();
    } else if (current === 'household') {
      content.innerHTML = householdPage();
    } else if (current === 'family') {
      content.innerHTML = familyPage();
    } else if (current === 'search') {
      content.innerHTML = searchPage();
    } else if (current === 'assistant') {
      content.innerHTML = assistantPage();
    }

    bindContent();
  }

  function navigate(id) {
    current = id;

    history.replaceState(
      null,
      '',
      `#buyeros-${id}`
    );

    render();

    $('#buyerOSV132')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  function mount() {
    if (
      mounted ||
      document.body.classList.contains('business-page') ||
      $('#buyerOSV132')
    ) return;

    const ownership = $('#ownershipPlatformV83');

    if (!ownership) {
      setTimeout(mount, 100);
      return;
    }

    installStyle();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = shell();

    const root = wrapper.firstElementChild;
    const dialog = wrapper.lastElementChild;

    ownership.insertAdjacentElement(
      'beforebegin',
      root
    );

    document.body.appendChild(dialog);

    $$('.bos132-nav button', root)
      .forEach(button => {
        button.addEventListener(
          'click',
          () => navigate(
            button.dataset.bos132Nav
          )
        );
      });

    const match = location.hash.match(
      /^#buyeros-(home|things|protection|timeline|documents|services|household|family|search|assistant)$/
    );

    if (match) current = match[1];

    mounted = true;
    render();
  }

  window.addEventListener(
    'still:ownership-updated',
    () => mounted && render()
  );

  window.addEventListener(
    'still:buyeros-data-updated',
    () => mounted && render()
  );

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      mount,
      { once: true }
    );
  } else {
    mount();
  }

})();
