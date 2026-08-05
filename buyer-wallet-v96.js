(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const META_KEY = 'still-buyer-wallet-meta-v96';
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  let filter = 'active';
  let query = '';
  let observer = null;
  let list = null;
  let applyTimer = 0;
  let applying = false;

  const readMeta = () => {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; }
    catch { return {}; }
  };
  const writeMeta = value => localStorage.setItem(META_KEY, JSON.stringify(value));
  const keyFor = card => [
    $('h4', card)?.textContent.trim() || '',
    card.querySelector(':scope > p')?.textContent.trim() || '',
    $('.op83-passport-top em', card)?.textContent.trim() || ''
  ].join('|').toLowerCase();
  const textFor = card => card.textContent.toLowerCase();
  const isSoon = card => /soon|days?|uskoro|dana|jamstvo|warranty|renewal|obnova|maintenance|održavanje/i.test($('.op83-next', card)?.textContent || '');

  function installStyles() {
    if ($('#buyerWalletStylesV96')) return;
    const style = document.createElement('style');
    style.id = 'buyerWalletStylesV96';
    style.textContent = `
      .wallet96-controls{position:relative;z-index:2;display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;align-items:center;margin:0 0 18px;padding:14px;border:1px solid var(--line);border-radius:18px;background:color-mix(in srgb,var(--surface) 86%,transparent);box-shadow:0 12px 32px rgba(25,49,76,.07);backdrop-filter:blur(16px)}
      .wallet96-controls label{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 13px;border:1px solid var(--line);border-radius:13px;background:var(--field)}.wallet96-controls input{width:100%;border:0;outline:0;background:transparent;color:var(--ink)}
      .wallet96-controls>div{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.wallet96-controls button{min-height:40px;white-space:nowrap;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--muted);padding:0 12px;font-weight:800;cursor:pointer}.wallet96-controls button.active{border-color:color-mix(in srgb,var(--green) 48%,var(--line));background:color-mix(in srgb,var(--green) 13%,var(--surface));color:var(--ink)}.wallet96-controls>small{grid-column:1/-1;color:var(--muted);font-size:11px}
      .wallet96-card-tools{display:flex;gap:7px;margin-top:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--line) 76%,transparent)}.wallet96-card-tools button{min-height:38px;border:1px solid var(--line);border-radius:11px;background:color-mix(in srgb,var(--surface) 88%,transparent);color:var(--ink);padding:0 10px;font-size:11px;font-weight:800;cursor:pointer}.wallet96-card-tools [data-wallet-pin]{width:40px;padding:0;font-size:18px;color:var(--green)}.wallet96-pinned{order:-1;border-color:color-mix(in srgb,var(--green) 52%,var(--line))!important}.wallet96-archived{opacity:.72;filter:saturate(.68)}
      .wallet96-dialog{width:min(620px,calc(100% - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line);border-radius:24px;background:var(--surface);color:var(--ink);box-shadow:0 34px 110px rgba(0,0,0,.34);overflow:auto}.wallet96-dialog::backdrop{background:rgba(4,12,8,.64);backdrop-filter:blur(8px)}.wallet96-dialog>[data-wallet-close]{position:sticky;z-index:4;top:12px;float:right;margin:12px 12px 0 0;width:40px;height:40px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);color:var(--ink);font-size:21px;cursor:pointer}.wallet96-detail{padding:38px}.wallet96-detail>span{color:var(--green);font-size:10px;font-weight:900;letter-spacing:.1em}.wallet96-detail>[data-wallet-detail-card]{margin-top:14px}.wallet96-detail .op83-passport{min-height:auto!important;transform:none!important}.wallet96-detail>p{margin:14px 0 0;color:var(--muted);font-size:12px;line-height:1.55}
      @media(max-width:760px){.wallet96-controls{grid-template-columns:1fr;padding:12px}.wallet96-card-tools{display:grid;grid-template-columns:42px 1fr 1fr}.wallet96-detail{padding:24px 16px 26px}.wallet96-controls button,.wallet96-card-tools button{min-height:44px}}
    `;
    document.head.appendChild(style);
  }

  function controls() {
    if (!list || $('#buyerWalletControlsV96')) return;
    const bar = document.createElement('div');
    bar.id = 'buyerWalletControlsV96';
    bar.className = 'wallet96-controls';
    bar.innerHTML = `<label><span>⌕</span><input type="search" data-wallet-search placeholder="${t('Search passports, companies or references', 'Pretraži putovnice, tvrtke ili reference')}"></label><div role="group"><button class="active" data-wallet-filter="active">${t('Active', 'Aktivno')}</button><button data-wallet-filter="pinned">${t('Pinned', 'Prikvačeno')}</button><button data-wallet-filter="soon">${t('Due soon', 'Uskoro')}</button><button data-wallet-filter="archived">${t('Archived', 'Arhiva')}</button></div><small data-wallet-result></small>`;
    list.insertAdjacentElement('beforebegin', bar);
    bar.addEventListener('input', e => {
      if (!e.target.matches('[data-wallet-search]')) return;
      query = e.target.value.trim().toLowerCase();
      scheduleApply();
    });
    bar.addEventListener('click', e => {
      const button = e.target.closest('[data-wallet-filter]');
      if (!button) return;
      filter = button.dataset.walletFilter;
      $$('[data-wallet-filter]', bar).forEach(x => x.classList.toggle('active', x === button));
      scheduleApply();
    });
  }

  function decorate(card) {
    const key = keyFor(card);
    if (!key) return;
    card.dataset.walletKey = key;
    if (card.querySelector('.wallet96-card-tools')) return;
    const tools = document.createElement('div');
    tools.className = 'wallet96-card-tools';
    tools.innerHTML = `<button type="button" data-wallet-pin>☆</button><button type="button" data-wallet-detail>${t('Details', 'Detalji')}</button><button type="button" data-wallet-archive></button>`;
    card.appendChild(tools);
    tools.addEventListener('click', e => {
      const meta = readMeta();
      const item = meta[key] || {};
      if (e.target.closest('[data-wallet-pin]')) item.pinned = !item.pinned;
      else if (e.target.closest('[data-wallet-archive]')) item.archived = !item.archived;
      else if (e.target.closest('[data-wallet-detail]')) return showDetail(card);
      else return;
      meta[key] = item;
      writeMeta(meta);
      scheduleApply();
    });
  }

  function scheduleApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(apply, 80);
  }

  function reconnectObserver() {
    if (!observer || !list) return;
    observer.observe(list, { childList: true });
  }

  function apply() {
    if (!list || applying) return;
    applying = true;
    observer?.disconnect();
    try {
      const cards = $$('.op83-passport', list);
      const meta = readMeta();
      let visible = 0;

      cards.forEach(card => {
        decorate(card);
        const key = card.dataset.walletKey;
        const item = meta[key] || {};
        card.classList.toggle('wallet96-pinned', !!item.pinned);
        card.classList.toggle('wallet96-archived', !!item.archived);
        const pin = $('[data-wallet-pin]', card);
        const archive = $('[data-wallet-archive]', card);
        if (pin) { pin.textContent = item.pinned ? '★' : '☆'; pin.setAttribute('aria-pressed', String(!!item.pinned)); }
        if (archive) archive.textContent = item.archived ? t('Restore', 'Vrati') : t('Archive', 'Arhiviraj');
        const collection = filter === 'archived' ? !!item.archived : filter === 'pinned' ? !!item.pinned && !item.archived : filter === 'soon' ? isSoon(card) && !item.archived : !item.archived;
        const matches = !query || textFor(card).includes(query);
        const show = collection && matches;
        if (card.hidden === show) card.hidden = !show;
        if (show) visible++;
      });

      const result = $('[data-wallet-result]');
      if (result) result.textContent = visible ? `${visible} ${t('shown', 'prikazano')}` : t('No passports match this view.', 'Nijedna putovnica ne odgovara ovom prikazu.');

      const desired = [...cards].sort((a, b) => Number(b.classList.contains('wallet96-pinned')) - Number(a.classList.contains('wallet96-pinned')));
      const current = $$('.op83-passport', list);
      const needsReorder = desired.some((card, index) => current[index] !== card);
      if (needsReorder) desired.forEach(card => list.appendChild(card));
    } finally {
      applying = false;
      reconnectObserver();
    }
  }

  function showDetail(card) {
    let dialog = $('#buyerWalletDetailV96');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'buyerWalletDetailV96';
      dialog.className = 'wallet96-dialog';
      document.body.appendChild(dialog);
      dialog.addEventListener('click', e => {
        if (e.target === dialog || e.target.closest('[data-wallet-close]')) dialog.close();
      });
    }
    const clone = card.cloneNode(true);
    clone.querySelector('.wallet96-card-tools')?.remove();
    dialog.innerHTML = `<button type="button" data-wallet-close>×</button><div class="wallet96-detail"><span>${t('OWNERSHIP PASSPORT', 'PUTOVNICA VLASNIŠTVA')}</span><div data-wallet-detail-card></div><p>${t('Your original passport remains unchanged.', 'Izvorna putovnica ostaje nepromijenjena.')}</p></div>`;
    $('[data-wallet-detail-card]', dialog).appendChild(clone);
    dialog.showModal();
  }

  function mount() {
    if (document.body.classList.contains('business-page')) return;
    installStyles();
    const wait = () => {
      list = $('#passportListV83');
      if (!list) return setTimeout(wait, 250);
      controls();
      apply();
      observer = new MutationObserver(mutations => {
        if (applying) return;
        const externalChange = mutations.some(m => [...m.addedNodes, ...m.removedNodes].some(node => node.nodeType === 1 && !node.classList?.contains('wallet96-card-tools')));
        if (externalChange) scheduleApply();
      });
      reconnectObserver();
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
