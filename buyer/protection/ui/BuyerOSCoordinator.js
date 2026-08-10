(() => {
  const STORAGE_KEY = 'still-ownership-passports-v83';
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;' }[c]));
  let mounted = false;

  function passports() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function upcoming(items) {
    const fields = ['returnBy','warrantyUntil','renewalAt','nextActionAt'];
    const now = new Date();
    now.setHours(12,0,0,0);
    return items.flatMap(item => fields.map(field => {
      if (!item[field]) return null;
      const date = new Date(`${String(item[field]).slice(0,10)}T12:00:00`);
      if (Number.isNaN(date.valueOf())) return null;
      const days = Math.ceil((date - now) / 86400000);
      return days >= -30 && days <= 60 ? { item, field, days, date } : null;
    }).filter(Boolean)).sort((a,b) => a.date - b.date);
  }

  function injectStyle() {
    if ($('#buyerOSCoordinatorStyle')) return;
    const style = document.createElement('style');
    style.id = 'buyerOSCoordinatorStyle';
    style.textContent = `
      .bos-shell{width:min(1240px,calc(100% - 28px));margin:18px auto 26px;position:relative;z-index:8}
      .bos-bar{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;padding:12px 14px;border:1px solid var(--line,#d9e1e5);border-radius:18px;background:color-mix(in srgb,var(--surface,#fff) 90%,transparent);backdrop-filter:blur(24px);box-shadow:0 12px 34px rgba(20,35,30,.08)}
      .bos-brand{display:flex;align-items:center;gap:10px}.bos-brand b{font-size:15px}.bos-brand small{display:block;color:var(--muted,#66727a);font-size:10px;margin-top:1px}.bos-mark{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--green,#337b58);color:white;font-weight:900}
      .bos-nav{display:flex;gap:6px;overflow:auto;scrollbar-width:none}.bos-nav::-webkit-scrollbar{display:none}.bos-nav button,.bos-search-button{min-height:38px;border:0;border-radius:10px;padding:0 12px;background:transparent;color:var(--muted,#66727a);font-weight:750;white-space:nowrap;cursor:pointer}.bos-nav button:hover,.bos-search-button:hover{background:var(--soft,#edf3ef);color:var(--ink,#111)}
      .bos-summary{display:grid;grid-template-columns:1.25fr repeat(3,.75fr);gap:10px;margin-top:10px}.bos-summary article{border:1px solid var(--line,#d9e1e5);border-radius:16px;padding:14px 16px;background:var(--surface,#fff)}.bos-summary span{font-size:10px;font-weight:850;letter-spacing:.09em;color:var(--muted,#66727a)}.bos-summary strong{display:block;margin-top:4px;font-size:24px;letter-spacing:-.03em}.bos-summary p{margin:5px 0 0;color:var(--muted,#66727a);font-size:12px;line-height:1.45}
      .bos-search{position:fixed;inset:0;z-index:9999;background:rgba(10,18,15,.34);backdrop-filter:blur(12px);display:grid;place-items:start center;padding-top:min(15vh,140px)}.bos-search[hidden]{display:none}.bos-search-panel{width:min(680px,calc(100% - 28px));border:1px solid var(--line,#d9e1e5);border-radius:22px;background:var(--surface,#fff);box-shadow:0 28px 90px rgba(0,0,0,.22);overflow:hidden}.bos-search-head{display:flex;gap:10px;padding:14px;border-bottom:1px solid var(--line,#d9e1e5)}.bos-search-head input{flex:1;border:0;background:transparent;color:var(--ink,#111);font:inherit;font-size:18px;outline:none}.bos-search-head button{border:0;background:transparent;color:var(--muted,#66727a);cursor:pointer}.bos-results{max-height:54vh;overflow:auto;padding:8px}.bos-result{width:100%;display:grid;grid-template-columns:38px 1fr auto;gap:10px;align-items:center;text-align:left;border:0;border-radius:12px;background:transparent;padding:10px;cursor:pointer;color:var(--ink,#111)}.bos-result:hover{background:var(--soft,#edf3ef)}.bos-result i{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--soft,#edf3ef);font-style:normal}.bos-result small{color:var(--muted,#66727a)}.bos-empty{padding:32px;text-align:center;color:var(--muted,#66727a)}
      @media(max-width:900px){.bos-bar{grid-template-columns:1fr auto}.bos-nav{grid-column:1/-1;order:3}.bos-summary{grid-template-columns:1fr 1fr}.bos-summary article:first-child{grid-column:1/-1}}
      @media(max-width:520px){.bos-summary{grid-template-columns:1fr}.bos-summary article:first-child{grid-column:auto}.bos-brand small{display:none}}
    `;
    document.head.appendChild(style);
  }

  function countKind(items, kinds) {
    return items.filter(item => kinds.includes(item.kind)).length;
  }

  function shell() {
    const items = passports();
    const actions = upcoming(items);
    const products = countKind(items, ['product','rental']);
    const services = countKind(items, ['service','subscription','booking','project']);
    return `
      <section class="bos-shell" id="buyerOSCoordinatorV1" aria-label="BuyerOS">
        <div class="bos-bar">
          <div class="bos-brand"><span class="bos-mark">S</span><div><b>BuyerOS</b><small>${t('Everything you own', 'Sve što posjeduješ')}</small></div></div>
          <nav class="bos-nav" aria-label="${t('BuyerOS workspace', 'BuyerOS radni prostor')}">
            <button data-bos-target="home">${t('Home','Početna')}</button>
            <button data-bos-target="ownership">${t('My things','Moje stvari')}</button>
            <button data-bos-target="protection">${t('Protection','Zaštita')}</button>
            <button data-bos-target="timeline">${t('Timeline','Vremenska crta')}</button>
            <button data-bos-target="services">${t('Services','Usluge')}</button>
            <button data-bos-target="resolve">${t('Resolve','Riješi')}</button>
          </nav>
          <button class="bos-search-button" data-bos-search>⌕ ${t('Search','Traži')}</button>
        </div>
        <div class="bos-summary">
          <article><span>${t('YOUR STILL','TVOJ STILL')}</span><strong>${items.length}</strong><p>${items.length ? t('Records currently kept in this browser.','Zapisi koji se trenutačno čuvaju u ovom pregledniku.') : t('Start with something you already own.','Počni s nečime što već posjeduješ.')}</p></article>
          <article><span>${t('PRODUCTS','PROIZVODI')}</span><strong>${products}</strong><p>${t('Physical things and rentals.','Fizičke stvari i najmovi.')}</p></article>
          <article><span>${t('SERVICES','USLUGE')}</span><strong>${services}</strong><p>${t('Services, subscriptions and projects.','Usluge, pretplate i projekti.')}</p></article>
          <article><span>${t('NEXT 60 DAYS','SLJEDEĆIH 60 DANA')}</span><strong>${actions.length}</strong><p>${t('Dates that may need attention.','Datumi koji mogu zahtijevati pažnju.')}</p></article>
        </div>
      </section>
      <div class="bos-search" id="buyerOSSearchV1" hidden>
        <div class="bos-search-panel" role="dialog" aria-modal="true" aria-label="${t('Search your Still','Pretraži svoj Still')}">
          <div class="bos-search-head"><input id="buyerOSSearchInputV1" type="search" autocomplete="off" placeholder="${t('Search things, companies, types…','Traži stvari, tvrtke, vrste…')}"><button type="button" data-bos-search-close>Esc</button></div>
          <div class="bos-results" id="buyerOSSearchResultsV1"></div>
        </div>
      </div>`;
  }

  function clickExisting(tool) {
    const button = document.querySelector(`[data-still-tool="${tool}"]`);
    if (button) {
      button.click();
      return true;
    }
    return false;
  }

  function go(target) {
    const map = {
      home: () => $('#stillPublicV114')?.scrollIntoView({ behavior:'smooth', block:'start' }),
      ownership: () => clickExisting('ownership') || $('#ownershipHubV83')?.scrollIntoView({ behavior:'smooth' }),
      protection: () => $('#protectionCenterV1')?.scrollIntoView({ behavior:'smooth', block:'center' }),
      timeline: () => clickExisting('timeline') || $('#timelineV83')?.scrollIntoView({ behavior:'smooth' }),
      services: () => clickExisting('lifecycle') || $('#lifecyclePlatformV95')?.scrollIntoView({ behavior:'smooth' }),
      resolve: () => $('#checker')?.scrollIntoView({ behavior:'smooth', block:'start' })
    };
    map[target]?.();
  }

  function renderSearch(query = '') {
    const result = $('#buyerOSSearchResultsV1');
    if (!result) return;
    const needle = query.trim().toLocaleLowerCase(isHr() ? 'hr' : 'en');
    const items = passports().filter(item => !needle || [item.title,item.business,item.kind,item.notes].some(value => String(value || '').toLocaleLowerCase(isHr() ? 'hr' : 'en').includes(needle))).slice(0,40);
    if (!items.length) {
      result.innerHTML = `<div class="bos-empty"><b>${t('No matching things','Nema odgovarajućih stvari')}</b><p>${t('Search only uses the ownership records already saved in Still.','Pretraga koristi samo zapise vlasništva koji su već spremljeni u Still.')}</p></div>`;
      return;
    }
    result.innerHTML = items.map(item => `<button class="bos-result" type="button" data-bos-result><i>${item.kind === 'service' ? '◎' : item.kind === 'subscription' ? '↻' : '◇'}</i><span><b>${esc(item.title || t('Untitled thing','Stvar bez naziva'))}</b><small>${esc(item.business || item.kind || t('Ownership record','Zapis vlasništva'))}</small></span><small>→</small></button>`).join('');
    result.querySelectorAll('[data-bos-result]').forEach(button => button.addEventListener('click', () => {
      closeSearch();
      go('ownership');
    }));
  }

  function openSearch() {
    const overlay = $('#buyerOSSearchV1');
    if (!overlay) return;
    overlay.hidden = false;
    renderSearch('');
    setTimeout(() => $('#buyerOSSearchInputV1')?.focus(), 0);
  }

  function closeSearch() {
    const overlay = $('#buyerOSSearchV1');
    if (overlay) overlay.hidden = true;
  }

  function bind() {
    document.querySelectorAll('[data-bos-target]').forEach(button => button.addEventListener('click', () => go(button.dataset.bosTarget)));
    $('[data-bos-search]')?.addEventListener('click', openSearch);
    $('[data-bos-search-close]')?.addEventListener('click', closeSearch);
    $('#buyerOSSearchInputV1')?.addEventListener('input', event => renderSearch(event.target.value));
    $('#buyerOSSearchV1')?.addEventListener('click', event => { if (event.target.id === 'buyerOSSearchV1') closeSearch(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSearch(); });
  }

  function refresh() {
    const existing = $('#buyerOSCoordinatorV1');
    const overlay = $('#buyerOSSearchV1');
    if (!existing) return mount();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = shell();
    existing.replaceWith(wrapper.children[0]);
    if (overlay) overlay.replaceWith(wrapper.children[0]);
    bind();
  }

  function loadExperienceV137() {
    if (document.querySelector('script[data-still-buyeros-experience-v137]')) return;
    const script = document.createElement('script');
    script.src = 'buyer/protection/ui/buyeros-experience-v137.js';
    script.defer = true;
    script.dataset.stillBuyerosExperienceV137 = 'true';
    document.head.appendChild(script);
  }

  function mount() {
    if (mounted || document.body.classList.contains('business-page')) return;
    const anchor = $('#stillPublicV114') || $('#ownershipPlatformV83');
    if (!anchor) return setTimeout(mount, 100);
    injectStyle();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = shell();
    anchor.insertAdjacentElement('afterend', wrapper.children[0]);
    document.body.appendChild(wrapper.children[0]);
    mounted = true;
    bind();
    loadExperienceV137();
  }

  window.addEventListener('still:ownership-updated', refresh);
  window.addEventListener('still:commerce-paid', refresh);
  window.addEventListener('still:language', refresh);
  $('#language')?.addEventListener('change', refresh);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true }); else mount();
})();
