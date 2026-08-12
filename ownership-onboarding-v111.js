(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  function message(text, error = false) {
    const output = $('#oo111Message');
    if (!output) return;
    output.textContent = text;
    output.dataset.error = String(error);
  }

  function withWorld(action) {
    if (window.StillWorld) return action(window.StillWorld);
    message(t('Your private World is still loading. Try again in a moment.', 'Tvoj privatni Svijet još se učitava. Pokušaj ponovno za trenutak.'), true);
  }

  function cleanHost(hostname) {
    return hostname.replace(/^www\./i, '').split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  function useProductUrl(raw) {
    let url;
    try {
      url = new URL(raw.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error('scheme');
    } catch {
      message(t('Enter a valid http or https product link.', 'Unesi valjanu http ili https poveznicu proizvoda.'), true);
      return;
    }
    withWorld(world => world.openAdd({ kind: 'product', businessName: cleanHost(url.hostname), reference: url.toString() }));
  }

  function mount() {
    if (document.body.classList.contains('business-page') || $('#ownershipOnboardingV111')) return true;
    const section = $('#ownershipHubV83');
    const head = section?.querySelector('.op83-section-head');
    if (!section || !head) return false;

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
        <button type="button" data-oo111="receipt"><b>▦ ${t('Scan', 'Skeniraj')}</b><small>${t('Upload a receipt to private OCR review.', 'Prenesi račun u privatnu OCR provjeru.')}</small></button>
        <button type="button" data-oo111="upload"><b>↑ ${t('Upload', 'Prenesi')}</b><small>${t('Store and organize a document.', 'Pohrani i organiziraj dokument.')}</small></button>
        <button type="button" data-oo111="import"><b>↧ ${t('Import', 'Uvezi')}</b><small>${t('Move existing browser records into your World.', 'Prenesi postojeće zapise preglednika u svoj Svijet.')}</small></button>
        <button type="button" data-oo111="manual"><b>＋ ${t('Add manually', 'Dodaj ručno')}</b><small>${t('Name, type and optional business.', 'Naziv, vrsta i neobavezna tvrtka.')}</small></button>
      </div>
      <details class="oo111-link"><summary>${t('Use a product link for safe prefill', 'Upotrijebi poveznicu proizvoda za sigurno ispunjavanje')}</summary><form id="oo111UrlForm"><label for="oo111Url">${t('Paste a product link', 'Zalijepi poveznicu proizvoda')}</label><div><input id="oo111Url" type="url" inputmode="url" autocomplete="url" placeholder="https://…"><button type="submit">${t('Use link', 'Upotrijebi')}</button></div><small>${t('Still stores the link only as a source reference and seller hint. It does not scrape or invent product data.', 'Still sprema poveznicu samo kao izvornu referencu i naznaku prodavatelja. Ne dohvaća niti izmišlja podatke o proizvodu.')}</small></form></details>
      <div id="oo111Message" class="oo111-message" role="status" aria-live="polite"></div>`;
    head.insertAdjacentElement('afterend', panel);

    $('[data-oo111="manual"]', panel).addEventListener('click', () => withWorld(world => world.openAdd()));
    $('[data-oo111="receipt"]', panel).addEventListener('click', () => withWorld(world => world.openCapture()));
    $('[data-oo111="upload"]', panel).addEventListener('click', () => withWorld(world => world.openDocuments()));
    $('[data-oo111="import"]', panel).addEventListener('click', () => withWorld(world => world.runMigration(true)));
    $('#oo111UrlForm', panel).addEventListener('submit', event => {
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
