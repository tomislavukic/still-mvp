(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  function passportForm() {
    return $('#passportFormV83');
  }

  function scrollToForm() {
    const form = passportForm();
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => form.querySelector('input[name="title"]')?.focus({ preventScroll: true }), 260);
  }

  function setField(name, value) {
    const field = passportForm()?.elements?.namedItem(name);
    if (!field || value == null || value === '') return;
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function cleanHost(hostname) {
    return hostname.replace(/^www\./i, '').split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function useProductUrl(raw) {
    let url;
    try {
      url = new URL(raw.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error('scheme');
    } catch {
      const message = $('#oo111Message');
      if (message) message.textContent = t('Enter a valid http or https product link.', 'Unesi valjanu http ili https poveznicu proizvoda.');
      return;
    }

    setField('kind', 'product');
    setField('business', cleanHost(url.hostname));
    setField('reference', url.toString());
    const message = $('#oo111Message');
    if (message) message.textContent = t('Seller and source link prepared. Add the product name, review the fields and save the passport.', 'Prodavatelj i izvorna poveznica su pripremljeni. Dodaj naziv proizvoda, pregledaj polja i spremi putovnicu.');
    scrollToForm();
  }

  function bindReceiptResult() {
    const receiptInput = $('#receiptFile');
    if (receiptInput && receiptInput.dataset.oo111Bound !== 'true') {
      receiptInput.dataset.oo111Bound = 'true';
      receiptInput.addEventListener('change', () => {
        setTimeout(() => {
          const item = $('#itemName')?.value?.trim();
          const store = $('#store')?.selectedOptions?.[0]?.textContent?.trim();
          const date = $('#purchaseDate')?.value;
          if (item || store || date) {
            const message = $('#oo111Message');
            if (message) {
              const found = [item, date, store && !/^choose|odaberi/i.test(store) ? store : ''].filter(Boolean);
              message.innerHTML = `<b>${t('Found it.', 'Pronađeno.')}</b><span>${t('We found', 'Pronašli smo')}: ${found.join(' · ')}</span><button type="button" id="oo111ConfirmReceipt">${t('Add to Still?', 'Dodati u Still?')}</button>`;
              $('#oo111ConfirmReceipt')?.addEventListener('click', () => {
                if (item) setField('title', item);
                if (store && !/^choose|odaberi/i.test(store)) setField('business', store);
                if (date) setField('purchasedOn', date);
                message.textContent = t('Prepared for your review. Add or change any detail before saving.', 'Pripremljeno za tvoj pregled. Dodaj ili promijeni bilo koji detalj prije spremanja.');
                scrollToForm();
              }, { once: true });
            }
          }
        }, 1400);
      });
    }
  }

  function useReceipt() {
    const scan = $('#scanReceipt');
    if (!scan) return;
    bindReceiptResult();
    scan.click();
  }

  function mount() {
    if (document.body.classList.contains('business-page') || $('#ownershipOnboardingV111')) return true;
    const section = $('#ownershipHubV83');
    const head = section?.querySelector('.op83-section-head');
    if (!section || !head || !passportForm()) return false;

    const panel = document.createElement('section');
    panel.id = 'ownershipOnboardingV111';
    panel.className = 'oo111';
    panel.innerHTML = `
      <div class="oo111-copy">
        <span>${t('WELCOME TO STILL', 'DOBRO DOŠAO U STILL')}</span>
        <h3>${t('Bring your things here.', 'Donesi svoje stvari ovdje.')}</h3>
        <p>${t('Start with one thing. No tutorial and no unnecessary details up front.', 'Počni s jednom stvari. Bez dugog vodiča i nepotrebnih detalja na početku.')}</p>
      </div>
      <div class="oo111-actions">
        <button type="button" data-oo111="receipt"><b>▦ ${t('Scan', 'Skeniraj')}</b><small>${t('Use the existing receipt scanner.', 'Upotrijebi postojeći skener računa.')}</small></button>
        <button type="button" disabled><b>↑ ${t('Upload', 'Prenesi')}</b><small>${t('Planned', 'Planirano')}</small></button>
        <button type="button" disabled><b>↧ ${t('Import', 'Uvezi')}</b><small>${t('Planned', 'Planirano')}</small></button>
        <button type="button" data-oo111="manual"><b>＋ ${t('Add manually', 'Dodaj ručno')}</b><small>${t('Name, type and optional business.', 'Naziv, vrsta i neobavezna tvrtka.')}</small></button>
      </div>
      <details class="oo111-link"><summary>${t('Use a product link for safe prefill', 'Upotrijebi poveznicu proizvoda za sigurno ispunjavanje')}</summary><form id="oo111UrlForm"><label for="oo111Url">${t('Paste a product link', 'Zalijepi poveznicu proizvoda')}</label><div><input id="oo111Url" type="url" inputmode="url" autocomplete="url" placeholder="https://…"><button type="submit">${t('Use link', 'Upotrijebi')}</button></div><small>${t('Still uses the link only as a source reference and seller hint. It does not scrape or invent product data.', 'Still koristi poveznicu samo kao izvornu referencu i naznaku prodavatelja. Ne dohvaća niti izmišlja podatke o proizvodu.')}</small></form></details>
      <div id="oo111Message" class="oo111-message" role="status" aria-live="polite"></div>`;
    head.insertAdjacentElement('afterend', panel);

    panel.querySelector('[data-oo111="manual"]')?.addEventListener('click', scrollToForm);
    panel.querySelector('[data-oo111="receipt"]')?.addEventListener('click', useReceipt);
    $('#oo111UrlForm', panel)?.addEventListener('submit', event => {
      event.preventDefault();
      useProductUrl($('#oo111Url', panel)?.value || '');
    });
    bindReceiptResult();
    return true;
  }

  function start() {
    const remountAfterLanguage = () => setTimeout(mount, 30);
    window.addEventListener('still:language', remountAfterLanguage);
    $('#language')?.addEventListener('change', remountAfterLanguage);
    if (mount()) return;
    const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
