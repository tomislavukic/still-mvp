(() => {
  const STORAGE_KEY = 'still-ownership-passports-v83';
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function readPassports() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  function daysUntil(date) {
    if (!date) return null;
    const today = new Date();
    today.setHours(12,0,0,0);
    return Math.ceil((date - today) / 86400000);
  }

  function dateLabel(value) {
    const date = parseDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat(isHr() ? 'hr-HR' : 'en-GB', { day:'numeric', month:'short' }).format(date);
  }

  function typeIcon(kind) {
    return ({ product:'◇', service:'◎', subscription:'↻', booking:'◷', rental:'⌂', project:'□' })[kind] || '◇';
  }

  function upcoming(passports) {
    const defs = [
      ['returnBy', t('Return window', 'Rok povrata')],
      ['warrantyUntil', t('Warranty', 'Jamstvo')],
      ['renewalAt', t('Renewal', 'Obnova')],
      ['nextActionAt', t('Next action', 'Sljedeća radnja')]
    ];
    return passports.flatMap(passport => defs.map(([field,label]) => {
      const date = parseDate(passport[field]);
      const days = daysUntil(date);
      return date && days != null && days >= -30 && days <= 60 ? { passport, field, label, date, days } : null;
    }).filter(Boolean)).sort((a,b) => a.date - b.date);
  }

  function timingText(item) {
    if (item.days < 0) return t(`${Math.abs(item.days)} days overdue`, `kasni ${Math.abs(item.days)} dana`);
    if (item.days === 0) return t('today', 'danas');
    if (item.days === 1) return t('tomorrow', 'sutra');
    return t(`in ${item.days} days`, `za ${item.days} dana`);
  }

  function render() {
    if (document.body.classList.contains('business-page')) return false;
    const home = $('#discoverV83');
    if (!home) return false;
    let panel = $('#ownershipHomeV112');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'ownershipHomeV112';
      panel.className = 'oh112';
      home.insertAdjacentElement('afterend', panel);
    }

    const passports = readPassports();
    const actions = upcoming(passports);
    const recent = passports.slice().sort((a,b) => String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''))).slice(0,6);

    const attention = actions.length ? actions.slice(0,4).map(item => `
      <a href="#timelineV83" class="oh112-action">
        <span>${typeIcon(item.passport.kind)}</span>
        <div><b>${esc(item.passport.title || t('Untitled passport','Putovnica bez naziva'))}</b><small>${esc(item.label)} · ${esc(timingText(item))}</small></div>
        <time>${esc(dateLabel(item.passport[item.field]))}</time>
      </a>`).join('') : `<div class="oh112-empty"><span>✓</span><div><b>${t('Nothing urgent right now.', 'Trenutačno nema ničeg hitnog.')}</b><small>${t('Add dates to your things and Still? will keep watch here.', 'Dodaj datume svojim stvarima i Still? će ih ovdje pratiti.')}</small></div></div>`;

    const recentItems = recent.length ? recent.map(item => `
      <button type="button" class="oh112-item" data-oh112-open="#ownershipHubV83">
        <span>${typeIcon(item.kind)}</span>
        <b>${esc(item.title || t('Untitled','Bez naziva'))}</b>
        <small>${esc(item.business || ({product:t('Product','Proizvod'),service:t('Service','Usluga'),subscription:t('Subscription','Pretplata'),booking:t('Booking','Rezervacija'),rental:t('Rental','Najam'),project:t('Project','Projekt')})[item.kind] || '')}</small>
      </button>`).join('') : `<button type="button" class="oh112-first" data-oh112-open="#ownershipHubV83"><span>＋</span><b>${t('Add your first thing', 'Dodaj prvu stvar')}</b><small>${t('Anything you already own or use can start here.', 'Ovdje može početi sve što već posjeduješ ili koristiš.')}</small></button>`;

    panel.innerHTML = `
      <div class="oh112-top">
        <div><span>${t('YOUR OWNERSHIP, NOW', 'TVOJE VLASNIŠTVO, SADA')}</span><h2>${passports.length ? t(`${passports.length} ${passports.length === 1 ? 'thing' : 'things'} in Still?.`, `${passports.length} ${passports.length === 1 ? 'stvar' : 'stvari'} u Still?.`) : t('Your place for everything you own.', 'Tvoje mjesto za sve što posjeduješ.')}</h2></div>
        <button type="button" data-oh112-open="#ownershipHubV83">＋ ${t('Add something', 'Dodaj nešto')}</button>
      </div>
      <div class="oh112-grid">
        <section class="oh112-attention"><header><b>${actions.length ? t(`${actions.length} ${actions.length === 1 ? 'thing needs' : 'things need'} attention`, `${actions.length} ${actions.length === 1 ? 'stvar traži' : 'stvari traže'} pažnju`) : t('You are up to date', 'Sve je pod kontrolom')}</b><a href="#timelineV83">${t('See timeline','Vidi rokove')} →</a></header>${attention}</section>
        <section class="oh112-recent"><header><b>${t('Recently added', 'Nedavno dodano')}</b><a href="#ownershipHubV83">${t('All things','Sve stvari')} →</a></header><div class="oh112-items">${recentItems}</div></section>
      </div>
      <nav class="oh112-quick" aria-label="${t('Quick add', 'Brzo dodavanje')}">
        <button data-kind="product">＋ ${t('Product','Proizvod')}</button>
        <button data-kind="service">＋ ${t('Service','Usluga')}</button>
        <button data-kind="subscription">＋ ${t('Subscription','Pretplata')}</button>
        <button data-kind="project">＋ ${t('Project','Projekt')}</button>
      </nav>`;

    panel.querySelectorAll('[data-oh112-open]').forEach(button => button.addEventListener('click', () => document.querySelector(button.dataset.oh112Open)?.scrollIntoView({behavior:'smooth',block:'start'})));
    panel.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
      const form = $('#passportFormV83');
      const select = form?.elements?.namedItem('kind');
      if (select) select.value = button.dataset.kind;
      form?.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(() => form?.elements?.namedItem('title')?.focus({preventScroll:true}), 240);
    }));
    return true;
  }

  function start() {
    const renderAfterLanguage = () => setTimeout(render, 30);
    if (!render()) {
      const observer = new MutationObserver(() => { if (render()) observer.disconnect(); });
      observer.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(() => observer.disconnect(),10000);
    }
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) render(); });
    window.addEventListener('still:ownership-updated', render);
    window.addEventListener('still:commerce-paid', render);
    window.addEventListener('still:language', renderAfterLanguage);
    document.addEventListener('submit', event => { if (event.target?.id === 'passportFormV83') setTimeout(render,80); });
    $('#language')?.addEventListener('change', renderAfterLanguage);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
