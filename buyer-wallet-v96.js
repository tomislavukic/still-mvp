(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const META_KEY = 'still-buyer-wallet-meta-v96';
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  let filter = 'active';
  let query = '';
  let observer;

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

  function controls() {
    const panel = $('.op83-passport-panel');
    const list = $('#passportListV83');
    if (!panel || !list || $('#buyerWalletControlsV96')) return;
    const bar = document.createElement('div');
    bar.id = 'buyerWalletControlsV96';
    bar.className = 'wallet96-controls';
    bar.innerHTML = `<label><span>⌕</span><input type="search" data-wallet-search placeholder="${t('Search passports, companies or references', 'Pretraži putovnice, tvrtke ili reference')}"></label><div role="group" aria-label="${t('Wallet collections', 'Zbirke novčanika')}"><button class="active" data-wallet-filter="active">${t('Active', 'Aktivno')}</button><button data-wallet-filter="pinned">${t('Pinned', 'Prikvačeno')}</button><button data-wallet-filter="soon">${t('Due soon', 'Uskoro')}</button><button data-wallet-filter="archived">${t('Archived', 'Arhiva')}</button></div><small data-wallet-result></small>`;
    list.insertAdjacentElement('beforebegin', bar);
    bar.addEventListener('input', event => {
      if (!event.target.matches('[data-wallet-search]')) return;
      query = event.target.value.trim().toLowerCase();
      apply();
    });
    bar.addEventListener('click', event => {
      const button = event.target.closest('[data-wallet-filter]');
      if (!button) return;
      filter = button.dataset.walletFilter;
      $$('[data-wallet-filter]', bar).forEach(item => item.classList.toggle('active', item === button));
      apply();
    });
  }

  function decorate(card) {
    const key = keyFor(card);
    if (!key) return;
    card.dataset.walletKey = key;
    if (!card.querySelector('.wallet96-card-tools')) {
      const tools = document.createElement('div');
      tools.className = 'wallet96-card-tools';
      tools.innerHTML = `<button type="button" data-wallet-pin aria-label="${t('Pin passport', 'Prikvači putovnicu')}">☆</button><button type="button" data-wallet-detail>${t('Details', 'Detalji')}</button><button type="button" data-wallet-archive></button>`;
      card.appendChild(tools);
      tools.addEventListener('click', event => {
        const meta = readMeta();
        const item = meta[key] || {};
        if (event.target.closest('[data-wallet-pin]')) item.pinned = !item.pinned;
        else if (event.target.closest('[data-wallet-archive]')) item.archived = !item.archived;
        else if (event.target.closest('[data-wallet-detail]')) return showDetail(card);
        else return;
        meta[key] = item;
        writeMeta(meta);
        apply();
      });
    }
  }

  function apply() {
    const cards = $$('.op83-passport', $('#passportListV83'));
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
      card.hidden = !show;
      if (show) visible++;
    });
    const result = $('[data-wallet-result]');
    if (result) result.textContent = visible ? `${visible} ${t('shown', 'prikazano')}` : t('No passports match this view.', 'Nijedna putovnica ne odgovara ovom prikazu.');
    const sorted = [...cards].sort((a, b) => Number(b.classList.contains('wallet96-pinned')) - Number(a.classList.contains('wallet96-pinned')));
    sorted.forEach(card => card.parentElement?.appendChild(card));
  }

  function showDetail(card) {
    let dialog = $('#buyerWalletDetailV96');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'buyerWalletDetailV96';
      dialog.className = 'wallet96-dialog';
      document.body.appendChild(dialog);
      dialog.addEventListener('click', event => {
        if (event.target === dialog || event.target.closest('[data-wallet-close]')) dialog.close();
      });
    }
    const clone = card.cloneNode(true);
    clone.querySelector('.wallet96-card-tools')?.remove();
    dialog.innerHTML = `<button type="button" data-wallet-close aria-label="${t('Close', 'Zatvori')}">×</button><div class="wallet96-detail"><span>${t('OWNERSHIP PASSPORT', 'PUTOVNICA VLASNIŠTVA')}</span><div data-wallet-detail-card></div><p>${t('Your original passport remains unchanged. Use its existing actions to share, update or remove it.', 'Izvorna putovnica ostaje nepromijenjena. Koristi postojeće radnje za dijeljenje, ažuriranje ili uklanjanje.')}</p></div>`;
    $('[data-wallet-detail-card]', dialog).appendChild(clone);
    dialog.showModal();
  }

  function mount() {
    if (document.body.classList.contains('business-page')) return;
    const wait = () => {
      const list = $('#passportListV83');
      if (!list) return setTimeout(wait, 250);
      controls();
      apply();
      observer = new MutationObserver(() => apply());
      observer.observe(list, { childList: true });
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
