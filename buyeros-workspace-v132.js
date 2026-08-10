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

  const purchaseDateOf = item => item?.purchasedOn || item?.purchaseDate || '';

  function documentLinks(item) {
    const title = String(item?.title || '').trim().toLowerCase();

    return documents().filter(doc =>
      doc.thingId === item.id ||
      doc.relatedThingId === item.id ||
      (title && String(doc.relatedThing || '').trim().toLowerCase() === title)
    );
  }

  function serviceHistory(item) {
    return Array.isArray(item?.serviceHistory) ? item.serviceHistory : [];
  }

  function allServiceHistory() {
    return things().flatMap(item =>
      serviceHistory(item).map(event => ({
        ...event,
        thingId: item.id,
        thingTitle: item.title || t('Untitled thing', 'Stvar bez naziva')
      }))
    );
  }

  function ownershipHealth(item) {
    const docs = documentLinks(item);
    const services = serviceHistory(item);

    const signals = [
      Boolean(item.title),
      Boolean(item.kind),
      Boolean(purchaseDateOf(item)),
      docs.length > 0,
      Boolean(item.warrantyUntil || item.returnBy || item.renewalAt),
      services.length > 0
    ];

    const complete =
      signals.filter(Boolean).length;

    const score =
      Math.round(
        (complete / signals.length) * 100
      );

    let label;
    let tone;

    if (score >= 84) {
      label = t('Well documented', 'Dobro dokumentirano');
      tone = 'good';
    } else if (score >= 50) {
      label = t('Good start', 'Dobar početak');
      tone = 'medium';
    } else {
      label = t('Needs details', 'Nedostaju podaci');
      tone = 'attention';
    }

    return {
      score,
      label,
      tone,
      complete,
      total: signals.length,
      hasDocuments: docs.length > 0,
      hasProtection:
        Boolean(
          item.warrantyUntil ||
          item.returnBy ||
          item.renewalAt
        ),
      hasService: services.length > 0
    };
  }

  function nextThingAction(item) {
    const candidates = [
      {
        type: 'return',
        label: t('Return deadline', 'Rok povrata'),
        value: item.returnBy
      },
      {
        type: 'warranty',
        label: t('Warranty ends', 'Jamstvo završava'),
        value: item.warrantyUntil
      },
      {
        type: 'renewal',
        label: t('Renewal', 'Obnova'),
        value: item.renewalAt
      },
      {
        type: 'action',
        label: t('Next action', 'Sljedeća radnja'),
        value: item.nextActionAt
      }
    ]
      .map(entry => ({
        ...entry,
        days: daysUntil(entry.value)
      }))
      .filter(entry =>
        entry.value &&
        entry.days !== null &&
        entry.days >= 0
      )
      .sort((a, b) => a.days - b.days);

    return candidates[0] || null;
  }

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
  let selectedThingId =
    sessionStorage.getItem('still-buyeros-selected-thing-v135') || '';

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

      .bos132-dashboard{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:14px;margin-top:14px}
      .bos132-attention{display:grid;gap:8px}
      .bos132-attention-item{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:0;border-radius:13px;background:var(--soft,#f3f6f4);color:var(--ink,#111);text-align:left;cursor:pointer}
      .bos132-attention-item.urgent{box-shadow:inset 3px 0 0 #d65b62}
      .bos132-attention-item.soon{box-shadow:inset 3px 0 0 #c9902f}
      .bos132-attention-item b{display:block;font-size:12px}
      .bos132-attention-item small{display:block;margin-top:3px;color:var(--muted,#66727a);font-size:10px}
      .bos132-quick-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .bos132-quick-grid button{min-height:66px;border:1px solid var(--line,#d9e1e5);border-radius:14px;padding:11px;text-align:left;background:var(--soft,#f3f6f4);color:var(--ink,#111);cursor:pointer}
      .bos132-quick-grid b{display:block;font-size:12px}
      .bos132-quick-grid small{display:block;margin-top:4px;color:var(--muted,#66727a);font-size:9px}
      .bos132-thing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .bos132-thing-card{border:1px solid var(--line,#d9e1e5);border-radius:18px;padding:16px;background:var(--surface,#fff)}
      .bos132-thing-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .bos132-thing-top h3{margin:4px 0 2px;font-size:18px}
      .bos132-thing-top small{color:var(--muted,#66727a)}
      .bos132-thing-icon{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:var(--soft,#f3f6f4);font-size:19px}
      .bos132-thing-meta{display:flex;flex-wrap:wrap;gap:6px;margin:13px 0}
      .bos132-thing-actions{display:flex;flex-wrap:wrap;gap:6px}
      .bos132-thing-actions button{min-height:32px;border:1px solid var(--line,#d9e1e5);border-radius:9px;padding:0 9px;background:var(--surface,#fff);color:var(--ink,#111);font-size:10px;font-weight:750;cursor:pointer}
      .bos132-service-grid{display:grid;gap:8px}
      .bos132-service-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border-radius:13px;background:var(--soft,#f3f6f4)}
      .bos132-service-row b{font-size:12px}
      .bos132-service-row small{display:block;color:var(--muted,#66727a);margin-top:3px}
      .bos132-section-note{margin:3px 0 0;color:var(--muted,#66727a);font-size:11px;line-height:1.5}
      .bos135-back{
        display:inline-flex;
        align-items:center;
        gap:7px;
        margin:0 0 14px;
        padding:0;
        border:0;
        background:none;
        color:var(--muted,#66727a);
        font:inherit;
        font-size:11px;
        font-weight:760;
        cursor:pointer
      }

      .bos135-hero{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        gap:22px;
        align-items:start;
        padding:22px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:22px;
        background:var(--surface,#fff)
      }

      .bos135-eyebrow{
        margin:0 0 7px;
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:850;
        letter-spacing:.12em;
        text-transform:uppercase
      }

      .bos135-title{
        margin:0;
        font-size:clamp(28px,4vw,48px);
        line-height:.98;
        letter-spacing:-.055em
      }

      .bos135-subtitle{
        margin:10px 0 0;
        color:var(--muted,#66727a);
        font-size:12px;
        line-height:1.55
      }

      .bos135-state{
        min-width:150px;
        padding:14px;
        border-radius:16px;
        background:var(--soft,#f3f6f4)
      }

      .bos135-state span{
        display:block;
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase
      }

      .bos135-state strong{
        display:block;
        margin-top:6px;
        font-size:15px
      }

      .bos135-tabs{
        position:sticky;
        top:10px;
        z-index:3;
        display:flex;
        gap:6px;
        overflow:auto;
        margin:12px 0;
        padding:6px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:14px;
        background:color-mix(in srgb,var(--surface,#fff) 92%,transparent);
        backdrop-filter:blur(18px)
      }

      .bos135-tabs button{
        flex:0 0 auto;
        min-height:34px;
        padding:0 11px;
        border:0;
        border-radius:9px;
        background:transparent;
        color:var(--muted,#66727a);
        font-size:10px;
        font-weight:780;
        cursor:pointer
      }

      .bos135-tabs button:hover{
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111)
      }

      .bos135-overview{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px
      }

      .bos135-metric{
        padding:15px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:16px;
        background:var(--surface,#fff)
      }

      .bos135-metric span{
        display:block;
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:800;
        letter-spacing:.07em;
        text-transform:uppercase
      }

      .bos135-metric strong{
        display:block;
        margin-top:7px;
        font-size:17px
      }

      .bos135-section{
        scroll-margin-top:76px
      }

      .bos135-empty{
        padding:18px;
        border:1px dashed var(--line,#d9e1e5);
        border-radius:14px;
        color:var(--muted,#66727a);
        font-size:11px;
        line-height:1.55
      }

      .bos135-actions{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-top:14px
      }

      .bos136-passport{
        position:relative;
        overflow:hidden
      }

      .bos136-passport::before{
        content:'';
        position:absolute;
        width:420px;
        height:420px;
        right:-210px;
        top:-250px;
        border-radius:50%;
        background:
          radial-gradient(
            circle,
            rgba(104,92,255,.15),
            rgba(104,92,255,0) 68%
          );
        pointer-events:none
      }

      .bos136-identity{
        display:flex;
        align-items:center;
        gap:14px
      }

      .bos136-mark{
        flex:0 0 auto;
        width:64px;
        height:64px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:18px;
        display:grid;
        place-items:center;
        background:var(--soft,#f3f6f4);
        font-size:26px;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.07)
      }

      .bos136-health{
        min-width:190px;
        padding:15px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:18px;
        background:var(--soft,#f3f6f4)
      }

      .bos136-health-top{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px
      }

      .bos136-health-top span{
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:850;
        letter-spacing:.08em;
        text-transform:uppercase
      }

      .bos136-health-top strong{
        font-size:20px;
        letter-spacing:-.04em
      }

      .bos136-health-bar{
        height:5px;
        margin-top:10px;
        border-radius:999px;
        background:var(--line,#d9e1e5);
        overflow:hidden
      }

      .bos136-health-bar i{
        display:block;
        height:100%;
        width:var(--bos-health);
        border-radius:inherit;
        background:currentColor
      }

      .bos136-health.good{
        color:#39a96b
      }

      .bos136-health.medium{
        color:#c08c2c
      }

      .bos136-health.attention{
        color:#cf5c64
      }

      .bos136-health-label{
        display:block;
        margin-top:8px;
        color:var(--ink,#111);
        font-size:11px;
        font-weight:760
      }

      .bos136-status-strip{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:12px
      }

      .bos136-status{
        display:grid;
        grid-template-columns:30px minmax(0,1fr);
        gap:9px;
        align-items:center;
        padding:10px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:13px;
        background:var(--surface,#fff)
      }

      .bos136-status-icon{
        width:30px;
        height:30px;
        border-radius:9px;
        display:grid;
        place-items:center;
        background:var(--soft,#f3f6f4)
      }

      .bos136-status b{
        display:block;
        font-size:10px
      }

      .bos136-status small{
        display:block;
        margin-top:2px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      .bos136-next{
        display:grid;
        grid-template-columns:42px minmax(0,1fr) auto;
        gap:12px;
        align-items:center;
        margin-top:12px;
        padding:13px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:16px;
        background:var(--surface,#fff)
      }

      .bos136-next-icon{
        width:42px;
        height:42px;
        border-radius:12px;
        display:grid;
        place-items:center;
        background:var(--soft,#f3f6f4)
      }

      .bos136-next span{
        display:block;
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:820;
        letter-spacing:.07em;
        text-transform:uppercase
      }

      .bos136-next b{
        display:block;
        margin-top:3px;
        font-size:12px
      }

      .bos136-next strong{
        font-size:13px
      }

      .bos136-knowledge{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px
      }

      .bos136-knowledge-row{
        display:grid;
        grid-template-columns:30px minmax(0,1fr) auto;
        gap:9px;
        align-items:center;
        padding:11px;
        border-radius:13px;
        background:var(--soft,#f3f6f4)
      }

      .bos136-knowledge-row b{
        font-size:11px
      }

      .bos136-knowledge-row small{
        display:block;
        margin-top:2px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      .bos136-check{
        font-weight:850;
        font-size:11px
      }

      @media(max-width:800px){
        .bos136-status-strip{
          grid-template-columns:1fr
        }

        .bos136-health{
          min-width:0
        }
      }

      @media(max-width:560px){
        .bos136-knowledge{
          grid-template-columns:1fr
        }

        .bos136-next{
          grid-template-columns:38px minmax(0,1fr)
        }

        .bos136-next strong{
          grid-column:2
        }

        .bos136-identity{
          align-items:flex-start
        }

        .bos136-mark{
          width:52px;
          height:52px;
          border-radius:15px
        }
      }

      @media(max-width:800px){
        .bos135-overview{grid-template-columns:1fr 1fr}
        .bos135-hero{grid-template-columns:1fr}
        .bos135-state{min-width:0}
      }

      @media(max-width:520px){
        .bos135-overview{grid-template-columns:1fr}
      }

      @media(max-width:900px){.bos132-dashboard{grid-template-columns:1fr}.bos132-thing-grid{grid-template-columns:1fr}}
      @media(max-width:560px){.bos132-quick-grid{grid-template-columns:1fr}}

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

  function attentionItems() {
    const result = [];

    things().forEach(item => {
      [
        ['returnBy', t('Return deadline', 'Rok povrata'), '↩'],
        ['warrantyUntil', t('Warranty ends', 'Jamstvo završava'), '◇'],
        ['renewalAt', t('Renewal', 'Obnova'), '↻'],
        ['nextActionAt', t('Next action', 'Sljedeća radnja'), '→']
      ].forEach(([field, label, icon]) => {
        const days = daysUntil(item[field]);

        if (days !== null && days >= 0 && days <= 60) {
          result.push({ item, field, label, icon, days, date: item[field] });
        }
      });
    });

    return result.sort((a, b) => a.days - b.days);
  }

  function recentActivity(limit = 6) {
    return timelineEvents().slice(0, limit);
  }

  function renderHome() {
    const { items, docs, upcoming } = stats();
    const recent = items.slice(-4).reverse();
    const attention = attentionItems().slice(0, 6);
    const activity = recentActivity(5);
    const serviceCount = allServiceHistory().length;

    return `
      ${pageHead(
        'BUYEROS',
        t('Everything you own.', 'Sve što posjeduješ.'),
        t(
          'What you own, what needs attention and what happened recently — in one calm workspace.',
          'Što posjeduješ, što zahtijeva pažnju i što se nedavno dogodilo — u jednom mirnom radnom prostoru.'
        ),
        `<button class="bos132-primary" data-bos132-add="thing">+ ${t('Add thing', 'Dodaj stvar')}</button>`
      )}

      <div class="bos132-grid">
        <article class="bos132-card"><span>${t('MY THINGS','MOJE STVARI')}</span><strong>${items.length}</strong><p>${t('Products, services and commitments.','Proizvodi, usluge i obveze.')}</p></article>
        <article class="bos132-card"><span>${t('NEEDS ATTENTION','ZAHTIJEVA PAŽNJU')}</span><strong>${upcoming.length}</strong><p>${t('Important dates in the next 60 days.','Važni datumi u sljedećih 60 dana.')}</p></article>
        <article class="bos132-card"><span>${t('DOCUMENTS','DOKUMENTI')}</span><strong>${docs.length}</strong><p>${t('Receipts, manuals and proof.','Računi, priručnici i dokazi.')}</p></article>
        <article class="bos132-card"><span>${t('SERVICE HISTORY','SERVISNA POVIJEST')}</span><strong>${serviceCount}</strong><p>${t('Repairs, inspections and upgrades.','Popravci, pregledi i nadogradnje.')}</p></article>
      </div>

      <div class="bos132-dashboard">
        <section class="bos132-section" style="margin-top:0">
          <div class="bos132-section-head">
            <h3>${t('Needs attention','Zahtijeva pažnju')}</h3>
            <button class="bos132-secondary" data-bos132-go="protection">${t('Protection','Zaštita')}</button>
          </div>

          ${attention.length
            ? `<div class="bos132-attention">${attention.map(entry => `
                <button class="bos132-attention-item ${entry.days <= 7 ? 'urgent' : entry.days <= 30 ? 'soon' : ''}" data-bos132-go="${entry.field === 'warrantyUntil' || entry.field === 'returnBy' ? 'protection' : 'timeline'}">
                  <span class="bos132-row-icon">${entry.icon}</span>
                  <span><b>${esc(entry.item.title || t('Untitled thing','Stvar bez naziva'))}</b><small>${esc(entry.label)} · ${esc(dateText(entry.date))}</small></span>
                  <strong>${entry.days === 0 ? t('Today','Danas') : `${entry.days}d`}</strong>
                </button>`).join('')}</div>`
            : `<div class="bos132-empty">${t('Nothing urgent in the next 60 days.','Ništa hitno u sljedećih 60 dana.')}</div>`}
        </section>

        <aside>
          <section class="bos132-section" style="margin-top:0">
            <div class="bos132-section-head"><h3>${t('Quick actions','Brze radnje')}</h3></div>
            <div class="bos132-quick-grid">
              <button data-bos132-add="thing"><b>+ ${t('Add thing','Dodaj stvar')}</b><small>${t('Something you already own','Nešto što već posjeduješ')}</small></button>
              <button data-bos132-add="document"><b>▤ ${t('Add document','Dodaj dokument')}</b><small>${t('Receipt, invoice or manual','Račun, faktura ili priručnik')}</small></button>
              <button data-bos132-add="service"><b>⌁ ${t('Add service','Dodaj servis')}</b><small>${t('Repair, inspection or upgrade','Popravak, pregled ili nadogradnja')}</small></button>
              <button data-bos132-go="assistant"><b>✦ ${t('Ask Still','Pitaj Still')}</b><small>${t('Use your ownership context','Koristi kontekst vlasništva')}</small></button>
            </div>
          </section>
        </aside>
      </div>

      <div class="bos132-dashboard">
        <section class="bos132-section" style="margin-top:0">
          <div class="bos132-section-head"><h3>${t('Recent activity','Nedavna aktivnost')}</h3><button class="bos132-secondary" data-bos132-go="timeline">${t('Timeline','Vremenska crta')}</button></div>
          ${activity.length
            ? `<div class="bos132-list">${activity.map(event => `<div class="bos132-row"><span class="bos132-row-icon">◷</span><div><b>${esc(event.title)}</b><small>${esc(event.detail || '')}${event.date ? ` · ${esc(dateText(event.date))}` : ''}</small></div><span>›</span></div>`).join('')}</div>`
            : `<div class="bos132-empty">${t('Activity appears as you add and maintain things.','Aktivnost se pojavljuje kako dodaješ i održavaš stvari.')}</div>`}
        </section>

        <section class="bos132-section" style="margin-top:0">
          <div class="bos132-section-head"><h3>${t('Recently added','Nedavno dodano')}</h3><button class="bos132-secondary" data-bos132-go="things">${t('View all','Prikaži sve')}</button></div>
          ${recent.length
            ? `<div class="bos132-list">${recent.map(item => `<div class="bos132-row"><span class="bos132-row-icon">◇</span><div><b>${esc(item.title || t('Untitled thing','Stvar bez naziva'))}</b><small>${esc(item.business || item.kind || '')}</small></div><span>→</span></div>`).join('')}</div>`
            : `<div class="bos132-empty">${t('Your Still is empty. Add something you already own.','Tvoj Still je prazan. Dodaj nešto što već posjeduješ.')}</div>`}
        </section>
      </div>

      <section class="bos132-section">
        <div class="bos132-section-head"><div><h3>${t('Useful tools already in Still','Korisni alati koji su već u Still-u')}</h3><p class="bos132-section-note">${t('BuyerOS keeps existing workflows close instead of hiding them farther down the page.','BuyerOS drži postojeće funkcije blizu umjesto da ih skriva niže na stranici.')}</p></div></div>
        <div class="bos132-quick-grid">
          <button data-bos132-scroll="#decisionLabV83"><b>◎ ${t('Plan a purchase','Planiraj kupnju')}</b><small>${t('Compare before paying.','Usporedi prije kupnje.')}</small></button>
          <button data-bos132-scroll="#passportCommerceV92"><b>◇ ${t('Passport commerce','Kupnja s putovnicom')}</b><small>${t('Open the existing purchase workflow.','Otvori postojeći tijek kupnje.')}</small></button>
          <button data-bos132-scroll="#checker"><b>↩ ${t('Return & warranty checker','Provjera povrata i jamstva')}</b><small>${t('Use the existing rights and retailer-policy workflow.','Koristi postojeću provjeru prava i pravila trgovca.')}</small></button>
          <button data-bos132-scroll="#lifecyclePlatformV95"><b>◷ ${t('Lifecycle workspace','Životni ciklus')}</b><small>${t('Support, alerts and detailed history.','Podrška, upozorenja i detaljna povijest.')}</small></button>
        </div>
      </section>
    `;
  }

  function thingCard(item) {
    const warrantyDays = daysUntil(item.warrantyUntil);
    const returnDays = daysUntil(item.returnBy);
    const docs = documentLinks(item);
    const services = serviceHistory(item);

    return `
      <article class="bos132-thing-card">
        <div class="bos132-thing-top">
          <div>
            <small>${esc(item.kind || t('Thing','Stvar'))}</small>
            <h3>${esc(item.title || t('Untitled thing','Stvar bez naziva'))}</h3>
            <small>${esc(item.business || item.store || t('Personally owned','Osobno vlasništvo'))}</small>
          </div>
          <span class="bos132-thing-icon">◇</span>
        </div>

        <div class="bos132-thing-meta">
          ${purchaseDateOf(item) ? `<span class="bos132-mini-pill">${t('Bought','Kupljeno')} ${esc(dateText(purchaseDateOf(item)))}</span>` : ''}
          ${warrantyDays !== null && warrantyDays >= 0 ? `<span class="bos132-mini-pill">${t('Warranty','Jamstvo')} ${warrantyDays}d</span>` : ''}
          ${returnDays !== null && returnDays >= 0 ? `<span class="bos132-mini-pill">${t('Return','Povrat')} ${returnDays}d</span>` : ''}
          <span class="bos132-mini-pill">▤ ${docs.length}</span>
          <span class="bos132-mini-pill">⌁ ${services.length}</span>
        </div>

        <div class="bos132-thing-actions">
          <button class="bos132-primary" data-bos132-open-thing="${esc(item.id)}">${t('Open','Otvori')} →</button>
          <button data-bos132-thing-route="timeline">${t('Timeline','Vremenska crta')}</button>
          <button data-bos132-thing-route="protection">${t('Protection','Zaštita')}</button>
          <button data-bos132-add="document" data-bos132-thing-id="${esc(item.id)}">${t('Add document','Dodaj dokument')}</button>
          <button data-bos132-add="service" data-bos132-thing-id="${esc(item.id)}">${t('Add service','Dodaj servis')}</button>
        </div>
      </article>
    `;
  }

  function thingDetailPage() {
    const item = things().find(entry => entry.id === selectedThingId);

    if (!item) {
      return `
        ${pageHead(
          'THING',
          t('Thing not found.', 'Stvar nije pronađena.'),
          t(
            'This ownership record may have been removed.',
            'Ovaj zapis vlasništva možda je uklonjen.'
          )
        )}

        <button
          class="bos132-primary"
          data-bos132-go="things"
        >
          ← ${t('Back to My Things', 'Natrag na Moje stvari')}
        </button>
      `;
    }

    const docs = documentLinks(item);
    const services = serviceHistory(item)
      .slice()
      .sort((a, b) =>
        String(b.occurredOn || '')
          .localeCompare(String(a.occurredOn || ''))
      );

    const warrantyDays = daysUntil(item.warrantyUntil);
    const returnDays = daysUntil(item.returnBy);
    const renewalDays = daysUntil(item.renewalAt);

    const health = ownershipHealth(item);
    const nextAction = nextThingAction(item);

    const protectedNow =
      (warrantyDays !== null && warrantyDays >= 0) ||
      (returnDays !== null && returnDays >= 0);

    const timeline = [];

    if (purchaseDateOf(item)) {
      timeline.push({
        date: purchaseDateOf(item),
        icon: '◇',
        title: t('Purchased', 'Kupljeno'),
        detail: item.business || item.store || ''
      });
    }

    if (item.warrantyUntil) {
      timeline.push({
        date: item.warrantyUntil,
        icon: '◉',
        title: t('Warranty ends', 'Jamstvo završava'),
        detail: item.title || ''
      });
    }

    if (item.returnBy) {
      timeline.push({
        date: item.returnBy,
        icon: '↩',
        title: t('Return deadline', 'Rok povrata'),
        detail: item.title || ''
      });
    }

    if (item.renewalAt) {
      timeline.push({
        date: item.renewalAt,
        icon: '↻',
        title: t('Renewal', 'Obnova'),
        detail: item.business || ''
      });
    }

    docs.forEach(doc => {
      if (!doc.date) return;

      timeline.push({
        date: doc.date,
        icon: '▤',
        title: t('Document added', 'Dodan dokument'),
        detail: doc.title || ''
      });
    });

    services.forEach(service => {
      if (!service.occurredOn) return;

      timeline.push({
        date: service.occurredOn,
        icon: '⌁',
        title:
          service.title ||
          t('Service event', 'Servisni događaj'),
        detail:
          service.providerName ||
          service.type ||
          ''
      });
    });

    timeline.sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || ''))
    );

    return `
      <button class="bos135-back" data-bos132-go="things">
        ← ${t('My Things', 'Moje stvari')}
      </button>

      <section class="bos135-hero bos136-passport">
        <div>
          <div class="bos136-identity">
            <div class="bos136-mark">◇</div>

            <div>
              <p class="bos135-eyebrow">
                ${esc(item.kind || t('THING', 'STVAR'))}
                · ${t('OWNERSHIP PASSPORT', 'PUTOVNICA VLASNIŠTVA')}
              </p>

              <h2 class="bos135-title">
                ${esc(
                  item.title ||
                  t('Untitled thing', 'Stvar bez naziva')
                )}
              </h2>

              <p class="bos135-subtitle">
                ${esc(
                  item.business ||
                  item.store ||
                  t(
                    'Personally owned',
                    'Osobno vlasništvo'
                  )
                )}
                ${
                  purchaseDateOf(item)
                    ? ` · ${t('Bought', 'Kupljeno')} ${esc(
                        dateText(purchaseDateOf(item))
                      )}`
                    : ''
                }
              </p>
            </div>
          </div>

          <div class="bos135-actions">
            <button
              class="bos132-primary"
              data-bos132-add="document"
              data-bos132-thing-id="${esc(item.id)}"
            >
              + ${t('Document', 'Dokument')}
            </button>

            <button
              class="bos132-secondary"
              data-bos132-add="service"
              data-bos132-thing-id="${esc(item.id)}"
            >
              + ${t('Service', 'Servis')}
            </button>
          </div>
        </div>

        <div
          class="bos136-health ${health.tone}"
          style="--bos-health:${health.score}%"
        >
          <div class="bos136-health-top">
            <span>${t('Ownership health', 'Stanje vlasništva')}</span>
            <strong>${health.score}%</strong>
          </div>

          <div class="bos136-health-bar">
            <i></i>
          </div>

          <span class="bos136-health-label">
            ${esc(health.label)}
          </span>
        </div>
      </section>

      <div class="bos136-status-strip">
        <div class="bos136-status">
          <div class="bos136-status-icon">▤</div>
          <div>
            <b>${t('Proof', 'Dokazi')}</b>
            <small>
              ${
                health.hasDocuments
                  ? `${docs.length} ${t('stored', 'spremljeno')}`
                  : t('Nothing stored', 'Ništa nije spremljeno')
              }
            </small>
          </div>
        </div>

        <div class="bos136-status">
          <div class="bos136-status-icon">◉</div>
          <div>
            <b>${t('Protection', 'Zaštita')}</b>
            <small>
              ${
                protectedNow
                  ? t('Active information', 'Aktivni podaci')
                  : health.hasProtection
                    ? t('Dates stored', 'Rokovi spremljeni')
                    : t('No dates stored', 'Rokovi nisu spremljeni')
              }
            </small>
          </div>
        </div>

        <div class="bos136-status">
          <div class="bos136-status-icon">⌁</div>
          <div>
            <b>${t('Service history', 'Servisna povijest')}</b>
            <small>
              ${
                services.length
                  ? `${services.length} ${t('events', 'događaja')}`
                  : t('No events', 'Nema događaja')
              }
            </small>
          </div>
        </div>
      </div>

      ${
        nextAction
          ? `
            <div class="bos136-next">
              <div class="bos136-next-icon">→</div>

              <div>
                <span>${t('Next important date', 'Sljedeći važan datum')}</span>
                <b>${esc(nextAction.label)}</b>
              </div>

              <strong>
                ${
                  nextAction.days === 0
                    ? t('Today', 'Danas')
                    : `${nextAction.days}d`
                }
              </strong>
            </div>
          `
          : ''
      }

      <nav class="bos135-tabs">
        <button data-bos135-jump="overview">
          ${t('Overview', 'Pregled')}
        </button>
        <button data-bos135-jump="protection">
          ${t('Protection', 'Zaštita')}
        </button>
        <button data-bos135-jump="documents">
          ${t('Documents', 'Dokumenti')}
        </button>
        <button data-bos135-jump="services">
          ${t('Services', 'Usluge')}
        </button>
        <button data-bos135-jump="timeline">
          ${t('Timeline', 'Vremenska crta')}
        </button>
      </nav>

      <section
        class="bos135-section"
        data-bos135-section="overview"
      >
        <div class="bos135-overview">
          <article class="bos135-metric">
            <span>${t('PROOF', 'DOKAZI')}</span>
            <strong>${docs.length}</strong>
          </article>

          <article class="bos135-metric">
            <span>${t('SERVICE EVENTS', 'SERVISNI DOGAĐAJI')}</span>
            <strong>${services.length}</strong>
          </article>

          <article class="bos135-metric">
            <span>${t('OWNERSHIP HEALTH', 'STANJE VLASNIŠTVA')}</span>
            <strong>${health.score}%</strong>
          </article>

          <article class="bos135-metric">
            <span>${t('KNOWN SIGNALS', 'POZNATI PODACI')}</span>
            <strong>${health.complete}/${health.total}</strong>
          </article>
        </div>

        <section class="bos132-section">
          <div class="bos132-section-head">
            <div>
              <h3>${t('What Still knows', 'Što Still zna')}</h3>
              <p class="bos132-section-note">
                ${t(
                  'This comes only from information stored for this thing.',
                  'Ovo dolazi isključivo iz podataka spremljenih za ovu stvar.'
                )}
              </p>
            </div>
          </div>

          <div class="bos136-knowledge">
            <div class="bos136-knowledge-row">
              <span class="bos132-row-icon">◇</span>
              <div>
                <b>${t('Purchase', 'Kupnja')}</b>
                <small>
                  ${
                    purchaseDateOf(item)
                      ? esc(dateText(purchaseDateOf(item)))
                      : t('Date not stored', 'Datum nije spremljen')
                  }
                </small>
              </div>
              <span class="bos136-check">
                ${purchaseDateOf(item) ? '✓' : '—'}
              </span>
            </div>

            <div class="bos136-knowledge-row">
              <span class="bos132-row-icon">▤</span>
              <div>
                <b>${t('Documents', 'Dokumenti')}</b>
                <small>
                  ${docs.length}
                  ${t('linked to this thing', 'povezano s ovom stvari')}
                </small>
              </div>
              <span class="bos136-check">
                ${docs.length ? '✓' : '—'}
              </span>
            </div>

            <div class="bos136-knowledge-row">
              <span class="bos132-row-icon">◉</span>
              <div>
                <b>${t('Protection', 'Zaštita')}</b>
                <small>
                  ${
                    health.hasProtection
                      ? t('Protection dates stored', 'Rokovi zaštite spremljeni')
                      : t('No protection dates', 'Nema rokova zaštite')
                  }
                </small>
              </div>
              <span class="bos136-check">
                ${health.hasProtection ? '✓' : '—'}
              </span>
            </div>

            <div class="bos136-knowledge-row">
              <span class="bos132-row-icon">⌁</span>
              <div>
                <b>${t('Service history', 'Servisna povijest')}</b>
                <small>
                  ${services.length}
                  ${t('recorded events', 'evidentiranih događaja')}
                </small>
              </div>
              <span class="bos136-check">
                ${services.length ? '✓' : '—'}
              </span>
            </div>
          </div>
        </section>

        ${
          item.notes
            ? `
              <section class="bos132-section">
                <div class="bos132-section-head">
                  <h3>${t('Private notes', 'Privatne bilješke')}</h3>
                </div>

                <p class="bos132-section-note">
                  ${esc(item.notes)}
                </p>
              </section>
            `
            : ''
        }
      </section>

      <section
        class="bos132-section bos135-section"
        data-bos135-section="protection"
      >
        <div class="bos132-section-head">
          <div>
            <h3>${t('Protection', 'Zaštita')}</h3>
            <p class="bos132-section-note">
              ${t(
                'Important ownership deadlines for this thing.',
                'Važni rokovi vlasništva za ovu stvar.'
              )}
            </p>
          </div>

          <button
            class="bos132-secondary"
            data-bos132-go="protection"
          >
            ${t('Open Protection Center', 'Otvori Centar zaštite')}
          </button>
        </div>

        <div class="bos132-list">
          ${
            item.warrantyUntil
              ? `
                <div class="bos132-row">
                  <span class="bos132-row-icon">◉</span>
                  <div>
                    <b>${t('Warranty', 'Jamstvo')}</b>
                    <small>
                      ${esc(dateText(item.warrantyUntil))}
                      ${
                        warrantyDays !== null &&
                        warrantyDays >= 0
                          ? ` · ${warrantyDays}d`
                          : ''
                      }
                    </small>
                  </div>
                  <span>›</span>
                </div>
              `
              : ''
          }

          ${
            item.returnBy
              ? `
                <div class="bos132-row">
                  <span class="bos132-row-icon">↩</span>
                  <div>
                    <b>${t('Return window', 'Rok povrata')}</b>
                    <small>
                      ${esc(dateText(item.returnBy))}
                      ${
                        returnDays !== null &&
                        returnDays >= 0
                          ? ` · ${returnDays}d`
                          : ''
                      }
                    </small>
                  </div>
                  <span>›</span>
                </div>
              `
              : ''
          }

          ${
            item.renewalAt
              ? `
                <div class="bos132-row">
                  <span class="bos132-row-icon">↻</span>
                  <div>
                    <b>${t('Renewal', 'Obnova')}</b>
                    <small>
                      ${esc(dateText(item.renewalAt))}
                      ${
                        renewalDays !== null &&
                        renewalDays >= 0
                          ? ` · ${renewalDays}d`
                          : ''
                      }
                    </small>
                  </div>
                  <span>›</span>
                </div>
              `
              : ''
          }
        </div>

        ${
          !item.warrantyUntil &&
          !item.returnBy &&
          !item.renewalAt
            ? `
              <div class="bos135-empty">
                ${t(
                  'No protection dates have been stored for this thing yet.',
                  'Za ovu stvar još nisu spremljeni rokovi zaštite.'
                )}
              </div>
            `
            : ''
        }
      </section>

      <section
        class="bos132-section bos135-section"
        data-bos135-section="documents"
      >
        <div class="bos132-section-head">
          <div>
            <h3>${t('Documents', 'Dokumenti')}</h3>
            <p class="bos132-section-note">
              ${t(
                'Receipts, invoices, manuals and proof attached to this thing.',
                'Računi, fakture, priručnici i dokazi vezani uz ovu stvar.'
              )}
            </p>
          </div>

          <button
            class="bos132-primary"
            data-bos132-add="document"
            data-bos132-thing-id="${esc(item.id)}"
          >
            + ${t('Add', 'Dodaj')}
          </button>
        </div>

        ${
          docs.length
            ? `
              <div class="bos132-list">
                ${docs.map(doc => `
                  <div class="bos132-row">
                    <span class="bos132-row-icon">▤</span>
                    <div>
                      <b>${esc(doc.title)}</b>
                      <small>
                        ${esc(doc.type || '')}
                        ${
                          doc.date
                            ? ` · ${esc(dateText(doc.date))}`
                            : ''
                        }
                      </small>
                    </div>
                    <span>›</span>
                  </div>
                `).join('')}
              </div>
            `
            : `
              <div class="bos135-empty">
                ${t(
                  'No documents are linked to this thing yet.',
                  'Još nema dokumenata povezanih s ovom stvari.'
                )}
              </div>
            `
        }
      </section>

      <section
        class="bos132-section bos135-section"
        data-bos135-section="services"
      >
        <div class="bos132-section-head">
          <div>
            <h3>${t('Service history', 'Servisna povijest')}</h3>
            <p class="bos132-section-note">
              ${t(
                'Repairs, inspections and upgrades stay with the ownership record.',
                'Popravci, pregledi i nadogradnje ostaju uz zapis vlasništva.'
              )}
            </p>
          </div>

          <button
            class="bos132-primary"
            data-bos132-add="service"
            data-bos132-thing-id="${esc(item.id)}"
          >
            + ${t('Add', 'Dodaj')}
          </button>
        </div>

        ${
          services.length
            ? `
              <div class="bos132-service-grid">
                ${services.map(service => `
                  <div class="bos132-service-row">
                    <span class="bos132-row-icon">⌁</span>
                    <div>
                      <b>
                        ${esc(
                          service.title ||
                          t('Service', 'Servis')
                        )}
                      </b>
                      <small>
                        ${
                          service.providerName
                            ? esc(service.providerName)
                            : ''
                        }
                        ${
                          service.occurredOn
                            ? ` · ${esc(
                                dateText(service.occurredOn)
                              )}`
                            : ''
                        }
                      </small>
                    </div>
                    <span class="bos132-mini-pill">
                      ${
                        service.isPublic
                          ? t('Public', 'Javno')
                          : t('Private', 'Privatno')
                      }
                    </span>
                  </div>
                `).join('')}
              </div>
            `
            : `
              <div class="bos135-empty">
                ${t(
                  'No service events have been recorded yet.',
                  'Još nije zabilježen nijedan servisni događaj.'
                )}
              </div>
            `
        }
      </section>

      <section
        class="bos132-section bos135-section"
        data-bos135-section="timeline"
      >
        <div class="bos132-section-head">
          <div>
            <h3>${t('Ownership timeline', 'Vremenska crta vlasništva')}</h3>
            <p class="bos132-section-note">
              ${t(
                'The story of this thing, assembled from its real stored data.',
                'Priča ove stvari sastavljena iz stvarno spremljenih podataka.'
              )}
            </p>
          </div>
        </div>

        ${
          timeline.length
            ? `
              <div class="bos132-list">
                ${timeline.map(event => `
                  <div class="bos132-row">
                    <span class="bos132-row-icon">
                      ${event.icon}
                    </span>

                    <div>
                      <b>${esc(event.title)}</b>
                      <small>
                        ${esc(event.detail || '')}
                        ${
                          event.date
                            ? ` · ${esc(dateText(event.date))}`
                            : ''
                        }
                      </small>
                    </div>

                    <span>›</span>
                  </div>
                `).join('')}
              </div>
            `
            : `
              <div class="bos135-empty">
                ${t(
                  'The timeline will grow as you add documents, protection dates and service history.',
                  'Vremenska crta rast će kako dodaješ dokumente, rokove zaštite i servisnu povijest.'
                )}
              </div>
            `
        }
      </section>
    `;
  }

  function thingsPage() {
    const data = things();

    return `
      ${pageHead(
        'MY THINGS',
        t('Everything you own.', 'Sve što posjeduješ.'),
        t(
          'Each thing keeps its proof, protection and service history together.',
          'Svaka stvar drži dokaze, zaštitu i servisnu povijest na jednom mjestu.'
        ),
        `<button class="bos132-primary" data-bos132-add="thing">+ ${t('Add thing','Dodaj stvar')}</button>`
      )}

      <section class="bos132-section">
        <div class="bos132-section-head"><div><h3>${data.length} ${t('ownership records','zapisa vlasništva')}</h3><p class="bos132-section-note">${t('Open one thing through its timeline, protection, documents and service history.','Otvori jednu stvar kroz njezinu vremensku crtu, zaštitu, dokumente i servisnu povijest.')}</p></div><button class="bos132-secondary" data-bos132-go="search">${t('Search','Pretraži')}</button></div>
        ${data.length
          ? `<div class="bos132-thing-grid">${data.map(thingCard).join('')}</div>`
          : `<div class="bos132-empty">${t('Nothing here yet. Add something you already own.','Ovdje još nema ničega. Dodaj nešto što već posjeduješ.')}</div>`}
      </section>
    `;
  }

  function protectionPage() {
    const data = things();

    const protectionModel =
      window.StillBuyerOSProtectionV153 || null;

    const protectionOverview =
      protectionModel &&
      typeof protectionModel.overview === 'function'
        ? protectionModel.overview()
        : null;

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

      if (purchaseDateOf(item)) {
        events.push({
          date: purchaseDateOf(item),
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

      const related = doc.thingId
        ? things().find(item => item.id === doc.thingId)
        : null;

      events.push({
        date: doc.date,
        title: t('Document added', 'Dodan dokument'),
        detail: [doc.title, related?.title].filter(Boolean).join(' · ')
      });
    });

    allServiceHistory().forEach(service => {
      if (!service.occurredOn) return;

      events.push({
        date: service.occurredOn,
        title: service.title || t('Service event', 'Servisni događaj'),
        detail: [service.thingTitle, service.providerName].filter(Boolean).join(' · ')
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
    const history = allServiceHistory()
      .sort((a, b) => String(b.occurredOn || '').localeCompare(String(a.occurredOn || '')));

    const serviceLike = things().filter(item =>
      ['service', 'subscription', 'rental', 'booking']
        .includes(String(item.kind || '').toLowerCase())
    );

    return `
      ${pageHead(
        'SERVICES',
        t('Keep it working.', 'Neka i dalje radi.'),
        t(
          'Repairs, inspections, upgrades and ongoing services stay attached to the things they belong to.',
          'Popravci, pregledi, nadogradnje i trajne usluge ostaju vezani uz stvari kojima pripadaju.'
        ),
        `<button class="bos132-primary" data-bos132-add="service">+ ${t('Add service','Dodaj servis')}</button>`
      )}

      <div class="bos132-grid">
        <article class="bos132-card"><span>${t('SERVICE HISTORY','SERVISNA POVIJEST')}</span><strong>${history.length}</strong><p>${t('Recorded maintenance events.','Evidentirani događaji održavanja.')}</p></article>
        <article class="bos132-card"><span>${t('ONGOING SERVICES','TRAJNE USLUGE')}</span><strong>${serviceLike.length}</strong><p>${t('Subscriptions, rentals and bookings.','Pretplate, najmovi i rezervacije.')}</p></article>
        <article class="bos132-card"><span>${t('WITH PROVIDER','S PRUŽATELJEM')}</span><strong>${history.filter(item => item.providerName).length}</strong><p>${t('Events with a recorded provider.','Događaji s evidentiranim pružateljem.')}</p></article>
        <article class="bos132-card"><span>${t('PUBLIC IN PASSPORT','JAVNO U PUTOVNICI')}</span><strong>${history.filter(item => item.isPublic).length}</strong><p>${t('Events explicitly allowed in public history.','Događaji izričito dopušteni u javnoj povijesti.')}</p></article>
      </div>

      <section class="bos132-section">
        <div class="bos132-section-head"><h3>${t('Service history','Servisna povijest')}</h3></div>
        ${history.length
          ? `<div class="bos132-service-grid">${history.map(event => `<div class="bos132-service-row"><span class="bos132-row-icon">⌁</span><div><b>${esc(event.title || t('Service','Servis'))}</b><small>${esc(event.thingTitle)}${event.providerName ? ` · ${esc(event.providerName)}` : ''}${event.occurredOn ? ` · ${esc(dateText(event.occurredOn))}` : ''}</small></div><span class="bos132-mini-pill">${event.isPublic ? t('Public','Javno') : t('Private','Privatno')}</span></div>`).join('')}</div>`
          : `<div class="bos132-empty">${t('No service history yet. Add a repair, inspection or upgrade.','Još nema servisne povijesti. Dodaj popravak, pregled ili nadogradnju.')}</div>`}
      </section>

      ${serviceLike.length ? `<section class="bos132-section"><div class="bos132-section-head"><h3>${t('Ongoing services','Trajne usluge')}</h3></div><div class="bos132-list">${serviceLike.map(item => `<div class="bos132-row"><span class="bos132-row-icon">↻</span><div><b>${esc(item.title || t('Untitled service','Usluga bez naziva'))}</b><small>${esc(item.business || item.kind || '')}${item.renewalAt ? ` · ${t('renews','obnova')} ${esc(dateText(item.renewalAt))}` : ''}</small></div><span>›</span></div>`).join('')}</div></section>` : ''}
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
                        ${doc.thingId ? ` · ${esc(things().find(item => item.id === doc.thingId)?.title || t('Linked thing', 'Povezana stvar'))}` : ''}
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
      thing: {
        title: t('Add something you own', 'Dodaj nešto što posjeduješ'),
        body: `<label>${t('Name','Naziv')}<input name="title" required maxlength="160"></label><div class="bos132-form-grid"><label>${t('Type','Vrsta')}<select name="kind"><option value="product">${t('Product','Proizvod')}</option><option value="service">${t('Service','Usluga')}</option><option value="subscription">${t('Subscription','Pretplata')}</option><option value="rental">${t('Rental','Najam')}</option><option value="booking">${t('Booking','Rezervacija')}</option></select></label><label>${t('Store / provider','Trgovina / pružatelj')}<input name="business" maxlength="160"></label></div><div class="bos132-form-grid"><label>${t('Purchase date','Datum kupnje')}<input name="purchaseDate" type="date"></label><label>${t('Warranty until','Jamstvo do')}<input name="warrantyUntil" type="date"></label></div><div class="bos132-form-grid"><label>${t('Return deadline','Rok povrata')}<input name="returnBy" type="date"></label><label>${t('Renewal','Obnova')}<input name="renewalAt" type="date"></label></div><label>${t('Private notes','Privatne bilješke')}<textarea name="notes" maxlength="1000"></textarea></label>`
      },

      service: {
        title: t('Add service event', 'Dodaj servisni događaj'),
        body: `<label>${t('Thing','Stvar')}<select name="thingId" required>${things().map(item => `<option value="${esc(item.id)}">${esc(item.title || t('Untitled thing','Stvar bez naziva'))}</option>`).join('')}</select></label><div class="bos132-form-grid"><label>${t('Type','Vrsta')}<select name="serviceType"><option value="service">${t('Service','Servis')}</option><option value="repair">${t('Repair','Popravak')}</option><option value="inspection">${t('Inspection','Pregled')}</option><option value="upgrade">${t('Upgrade','Nadogradnja')}</option></select></label><label>${t('Date','Datum')}<input name="occurredOn" type="date" required></label></div><label>${t('What happened?','Što se dogodilo?')}<input name="title" required maxlength="180"></label><label>${t('Provider','Izvršitelj')}<input name="providerName" maxlength="160"></label><label>${t('Private details','Privatni detalji')}<textarea name="notes" maxlength="1500"></textarea></label><label><input name="isPublic" type="checkbox"> ${t('Allow this event in public Passport history','Dopusti ovaj zapis u javnoj povijesti putovnice')}</label>`
      },

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

          <label>
            ${t('Related thing', 'Povezana stvar')}
            <select name="thingId">
              <option value="">${t('Not linked', 'Nije povezano')}</option>
              ${things().map(item => `<option value="${esc(item.id)}">${esc(item.title || t('Untitled thing','Stvar bez naziva'))}</option>`).join('')}
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

    if (form.dataset.type === 'thing') {
      const data = things();

      data.push({
        id: uid('thing'),
        title: String(fd.get('title') || '').trim(),
        kind: String(fd.get('kind') || 'product'),
        business: String(fd.get('business') || '').trim(),
        purchasedOn: String(fd.get('purchaseDate') || ''),
        warrantyUntil: String(fd.get('warrantyUntil') || ''),
        returnBy: String(fd.get('returnBy') || ''),
        renewalAt: String(fd.get('renewalAt') || ''),
        notes: String(fd.get('notes') || '').trim(),
        serviceHistory: [],
        createdAt: new Date().toISOString()
      });

      write(OWNERSHIP_KEY, data);
      window.dispatchEvent(new CustomEvent('still:ownership-updated'));
    }

    if (form.dataset.type === 'service') {
      const data = things();
      const item = data.find(entry => entry.id === String(fd.get('thingId') || ''));

      if (item) {
        item.serviceHistory = Array.isArray(item.serviceHistory) ? item.serviceHistory : [];
        item.serviceHistory.push({
          id: uid('service'),
          type: String(fd.get('serviceType') || 'service'),
          occurredOn: String(fd.get('occurredOn') || ''),
          title: String(fd.get('title') || '').trim(),
          providerName: String(fd.get('providerName') || '').trim(),
          notes: String(fd.get('notes') || '').trim(),
          isPublic: fd.get('isPublic') === 'on',
          createdAt: new Date().toISOString()
        });

        write(OWNERSHIP_KEY, data);
        window.dispatchEvent(new CustomEvent('still:ownership-updated'));
      }
    }

    if (form.dataset.type === 'document') {
      const data = documents();

      data.push({
        id: uid('doc'),
        title: String(fd.get('title') || '').trim(),
        type: String(fd.get('type') || '').trim(),
        date: String(fd.get('date') || ''),
        reference: String(fd.get('reference') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        thingId: String(fd.get('thingId') || ''),
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
      button.addEventListener('click', () => {
        openDialog(button.dataset.bos132Add);

        const thingId = button.dataset.bos132ThingId;
        const select = $('#bos132CrudForm [name="thingId"]');

        if (thingId && select) select.value = thingId;
      });
    });

    $$('[data-bos132-open-thing]').forEach(button => {
      button.addEventListener(
        'click',
        () => openThing(button.dataset.bos132OpenThing)
      );
    });

    $$('[data-bos135-jump]').forEach(button => {
      button.addEventListener('click', () => {
        const section = document.querySelector(
          `[data-bos135-section="${button.dataset.bos135Jump}"]`
        );

        section?.scrollIntoView({
          behavior:
            matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
          block: 'start'
        });
      });
    });

    $$('[data-bos132-thing-route]').forEach(button => {
      button.addEventListener('click', () => navigate(button.dataset.bos132ThingRoute));
    });

    $$('[data-bos132-scroll]').forEach(button => {
      button.addEventListener('click', () => {
        const target = document.querySelector(button.dataset.bos132Scroll);
        if (!target) return;
        target.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      });
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
    } else if (current === 'thing') {
      content.innerHTML = thingDetailPage();
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

  function openThing(id) {
    selectedThingId = id || '';

    if (!selectedThingId) return;

    sessionStorage.setItem(
      'still-buyeros-selected-thing-v135',
      selectedThingId
    );

    current = 'thing';

    history.replaceState(
      null,
      '',
      '#buyeros-thing'
    );

    render();

    $('#buyerOSV132')?.scrollIntoView({
      behavior:
        matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      block: 'start'
    });
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
      /^#buyeros-(home|things|thing|protection|timeline|documents|services|household|family|search|assistant)$/
    );

    if (match) current = match[1];

    if (current === 'thing' && !selectedThingId) {
      current = 'things';
    }

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
