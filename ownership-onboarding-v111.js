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

  function useReceipt() {
    const scan = $('#scanReceipt');
    if (!scan) return;
    const form = passportForm();
    const receiptInput = $('#receiptFile');
    if (receiptInput && receiptInput.dataset.oo111Bound !== 'true') {
      receiptInput.dataset.oo111Bound = 'true';
      receiptInput.addEventListener('change', () => {
        setTimeout(() => {
          const item = $('#itemName')?.value?.trim();
          const store = $('#store')?.selectedOptions?.[0]?.textContent?.trim();
          const date = $('#purchaseDate')?.value;
          if (item) setField('title', item);
          if (store && !/^choose|odaberi/i.test(store)) setField('business', store);
          if (date) setField('purchasedOn', date);
          if (item || store || date) {
            const message = $('#oo111Message');
            if (message) message.textContent = t('Receipt details were copied into your ownership passport. Review before saving.', 'Podaci s računa kopirani su u tvoju putovnicu vlasništva. Pregledaj ih prije spremanja.');
            scrollToForm();
          }
        }, 1400);
      });
    }
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
        <span>${t('START WITH REAL LIFE', 'POČNI SA STVARNIM ŽIVOTOM')}</span>
        <h3>${t('Already own it? Bring it into Still? in seconds.', 'Već to posjeduješ? Dodaj u Still? za nekoliko sekundi.')}</h3>
        <p>${t('You do not need to have bought through Still?. Start with what is already in your home, subscriptions, services or projects.', 'Ne moraš ništa kupiti kroz Still?. Počni s onime što je već u tvom domu, pretplatama, uslugama ili projektima.')}</p>
      </div>
      <div class="oo111-actions">
        <button type="button" data-oo111="manual"><b>＋ ${t('Add manually', 'Dodaj ručno')}</b><small>${t('Fastest for anything you remember.', 'Najbrže za sve čega se sjećaš.')}</small></button>
        <button type="button" data-oo111="receipt"><b>▦ ${t('Use a receipt', 'Upotrijebi račun')}</b><small>${t('Reuse the existing receipt scanner and prefill ownership details.', 'Iskoristi postojeći skener računa i unaprijed ispuni podatke vlasništva.')}</small></button>
        <form id="oo111UrlForm"><label for="oo111Url">${t('Paste a product link', 'Zalijepi poveznicu proizvoda')}</label><div><input id="oo111Url" type="url" inputmode="url" autocomplete="url" placeholder="https://…"><button type="submit">${t('Use link', 'Upotrijebi')}</button></div><small>${t('Still? uses the link only to prefill fields. It does not scrape or invent product data.', 'Still? koristi poveznicu samo za unaprijed ispunjavanje polja. Ne dohvaća niti izmišlja podatke o proizvodu.')}</small></form>
      </div>
      <div id="oo111Message" class="oo111-message" role="status" aria-live="polite"></div>`;
    head.insertAdjacentElement('afterend', panel);

    panel.querySelector('[data-oo111="manual"]')?.addEventListener('click', scrollToForm);
    panel.querySelector('[data-oo111="receipt"]')?.addEventListener('click', useReceipt);
    $('#oo111UrlForm', panel)?.addEventListener('submit', event => {
      event.preventDefault();
      useProductUrl($('#oo111Url', panel)?.value || '');
    });
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
