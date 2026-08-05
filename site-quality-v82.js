(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isCroatian = () => $('#language')?.value === 'hr';
  const t = (english, croatian) => isCroatian() ? croatian : english;
  const CONNECTION_PATTERN = /^[A-Z0-9][A-Z0-9-]{5,29}$/i;
  let handoffDialog;

  function mountBuyerNavigation() {
    if (document.body.classList.contains('business-page') || $('#featureNavV82')) return;
    const header = $('.topbar');
    if (!header) return;
    const nav = document.createElement('nav');
    nav.id = 'featureNavV82';
    nav.className = 'feature-nav-v82';
    nav.setAttribute('aria-label', t('Buyer tools', 'Alati za kupce'));
    nav.innerHTML = `
      <a href="#discoverV83" data-feature-label="discover"><span aria-hidden="true">⌂</span><b>${t('Overview', 'Početna')}</b></a>
      <a href="#passportCommerceV92" data-feature-label="buy"><span aria-hidden="true">¤</span><b>${t('Buy', 'Kupi')}</b></a>
      <a href="#ownershipHubV83" data-feature-label="things"><span aria-hidden="true">◇</span><b>${t('My things', 'Moje stvari')}</b></a>
      <a href="#timelineV83" data-feature-label="timeline"><span aria-hidden="true">◷</span><b>${t('Next dates', 'Rokovi')}</b></a>
      <a href="#checker" data-feature-label="resolve"><span aria-hidden="true">?</span><b>${t('Get help', 'Pomoć')}</b></a>
      <a href="/company.html" class="feature-nav-business">${t('For Business ↗', 'Za tvrtke ↗')}</a>`;
    header.insertAdjacentElement('afterend', nav);
  }

  function updateBuyerNavigation() {
    const nav = $('#featureNavV82');
    if (!nav) return;
    nav.setAttribute('aria-label', t('Buyer tools', 'Alati za kupce'));
    const labels = {
      discover: t('Overview', 'Početna'),
      buy: t('Buy', 'Kupi'),
      things: t('My things', 'Moje stvari'),
      timeline: t('Next dates', 'Rokovi'),
      resolve: t('Get help', 'Pomoć')
    };
    nav.querySelectorAll('[data-feature-label]').forEach(link => {
      const label = link.querySelector('b');
      if (label) label.textContent = labels[link.dataset.featureLabel];
    });
    const business = $('.feature-nav-business', nav);
    if (business) business.textContent = t('For Business ↗', 'Za tvrtke ↗');
  }

  function mountBusinessAccess() {
    if (!document.body.classList.contains('business-page') || $('#businessAccessV82')) return;
    const trust = $('.business-trust');
    if (!trust) return;
    const access = document.createElement('a');
    access.id = 'businessAccessV82';
    access.className = 'business-access-v82';
    access.href = '#companyPortalV46';
    access.textContent = t('Open company sign-in and verification ↓', 'Otvori prijavu i verifikaciju tvrtke ↓');
    trust.appendChild(access);
  }

  function updateBusinessAccess() {
    const access = $('#businessAccessV82');
    if (access) access.textContent = t('Open company sign-in and verification ↓', 'Otvori prijavu i verifikaciju tvrtke ↓');
  }

  function mountFooterLinks() {
    const footer = document.querySelector('footer');
    if (!footer || $('#footerLinksV82')) return;
    const nav = document.createElement('nav');
    nav.id = 'footerLinksV82';
    nav.className = 'footer-links-v82';
    nav.setAttribute('aria-label', t('Legal and methodology', 'Pravni dokumenti i metodologija'));
    nav.innerHTML = `
      <a href="/privacy.html" data-footer-link="privacy">${t('Privacy', 'Privatnost')}</a>
      <a href="/terms.html" data-footer-link="terms">${t('Terms', 'Uvjeti')}</a>
      <a href="/methodology.html" data-footer-link="methodology">${t('Methodology', 'Metodologija')}</a>`;
    footer.appendChild(nav);
  }

  function updateFooterLinks() {
    const nav = $('#footerLinksV82');
    if (!nav) return;
    nav.setAttribute('aria-label', t('Legal and methodology', 'Pravni dokumenti i metodologija'));
    const privacy = $('[data-footer-link="privacy"]', nav);
    const terms = $('[data-footer-link="terms"]', nav);
    const methodology = $('[data-footer-link="methodology"]', nav);
    if (privacy) privacy.textContent = t('Privacy', 'Privatnost');
    if (terms) terms.textContent = t('Terms', 'Uvjeti');
    if (methodology) methodology.textContent = t('Methodology', 'Metodologija');
  }

  function connectionCodeFromUrl() {
    const code = new URL(location.href).searchParams.get('connect')?.trim().toUpperCase() || '';
    return CONNECTION_PATTERN.test(code) ? code : '';
  }

  function cleanConnectionUrl() {
    const url = new URL(location.href);
    url.searchParams.delete('connect');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash || '#ownershipHubV83'}`);
  }

  function prepareBuyerConnection() {
    if (document.body.classList.contains('business-page')) return;
    const code = connectionCodeFromUrl();
    if (!code) return;
    let attempts = 0;
    const findForm = () => {
      const form = $('#connectFormV83');
      const input = form?.querySelector('input[name="code"]');
      if (!form || !input) {
        if (++attempts < 40) setTimeout(findForm, 200);
        return;
      }
      input.value = code;
      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocapitalize', 'characters');
      form.classList.add('still-handoff-ready');
      let notice = $('#stillHandoffNotice');
      if (!notice) {
        notice = document.createElement('section');
        notice.id = 'stillHandoffNotice';
        notice.className = 'still-handoff-notice';
        notice.innerHTML = `<span>▦</span><div><b>${t('Company passport ready to review', 'Putovnica tvrtke spremna je za pregled')}</b><p>${t('The one-time code is prepared below. Review the request and press Connect only when you agree.', 'Jednokratni kod pripremljen je ispod. Pregledaj zahtjev i pritisni Poveži samo ako pristaješ.')}</p></div><button type="button" aria-label="${t('Dismiss', 'Zatvori')}">×</button>`;
        form.parentElement?.insertBefore(notice, form);
        notice.querySelector('button')?.addEventListener('click', () => notice.remove());
      }
      cleanConnectionUrl();
      setTimeout(() => {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
      }, 180);
    };
    findForm();
  }

  function handoffUrl(code) {
    const url = new URL('/', location.origin);
    url.searchParams.set('connect', code);
    url.hash = 'ownershipHubV83';
    return url.toString();
  }

  function ensureHandoffDialog() {
    if (handoffDialog) return handoffDialog;
    handoffDialog = document.createElement('dialog');
    handoffDialog.id = 'stillCompanyHandoffDialog';
    handoffDialog.className = 'still-handoff-dialog';
    document.body.appendChild(handoffDialog);
    handoffDialog.addEventListener('click', event => {
      if (event.target === handoffDialog || event.target.closest('[data-handoff-close]')) handoffDialog.close();
    });
    return handoffDialog;
  }

  function qrSvg(url) {
    if (typeof window.qrcode !== 'function') return '';
    const qr = window.qrcode(0, 'H');
    qr.addData(url, 'Byte');
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 18, scalable: true, alt: 'Still? connection QR code', title: 'Still? buyer connection' });
  }

  function showCompanyHandoff(code) {
    if (!CONNECTION_PATTERN.test(code)) return;
    const dialog = ensureHandoffDialog();
    const url = handoffUrl(code);
    const svg = qrSvg(url);
    dialog.innerHTML = `<button type="button" class="still-handoff-close" data-handoff-close aria-label="${t('Close', 'Zatvori')}">×</button><div class="still-handoff-layout"><div class="still-handoff-qr">${svg || '<div class="still-handoff-qr-fallback">▦</div>'}</div><div class="still-handoff-copy"><span>STILL? MOBILE HANDOFF</span><h2>${t('Ready for the buyer to scan', 'Spremno za skeniranje kupca')}</h2><p>${t('The buyer uses the normal phone camera. Still? opens with this one-time code prepared, but nothing connects until the buyer explicitly approves.', 'Kupac koristi običnu kameru telefona. Still? se otvara s pripremljenim jednokratnim kodom, ali se ništa ne povezuje dok kupac izričito ne potvrdi.')}</p><strong>${code}</strong><div class="still-handoff-safe"><b>✓ ${t('Consent preserved', 'Pristanak je sačuvan')}</b><small>${t('The QR contains only a Still? HTTPS link and the one-time connection code. It contains no buyer identity, receipt or private passport data.', 'QR sadrži samo Still? HTTPS poveznicu i jednokratni kod povezivanja. Ne sadrži identitet kupca, račun ni privatne podatke putovnice.')}</small></div><div class="still-handoff-actions"><button type="button" data-handoff-copy>${t('Copy buyer link', 'Kopiraj poveznicu za kupca')}</button>${navigator.share ? `<button type="button" data-handoff-share>${t('Share link', 'Podijeli poveznicu')}</button>` : ''}</div><small id="stillHandoffMessage"></small></div></div>`;
    dialog.querySelector('[data-handoff-copy]')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(url).catch(() => {});
      const message = $('#stillHandoffMessage', dialog);
      if (message) message.textContent = t('Buyer link copied.', 'Poveznica za kupca je kopirana.');
    });
    dialog.querySelector('[data-handoff-share]')?.addEventListener('click', async () => {
      await navigator.share({ title: 'Still? Passport', text: t('Open your company-issued Still? passport.', 'Otvori Still? putovnicu koju je izdala tvrtka.'), url }).catch(() => {});
    });
    if (!dialog.open) dialog.showModal();
  }

  function enhanceCompanyConnectionCodes() {
    if (!document.body.classList.contains('business-page')) return;
    const decorate = () => {
      document.querySelectorAll('[data-copy-code]').forEach(codeButton => {
        if (codeButton.dataset.handoffEnhanced === 'true') return;
        const code = codeButton.dataset.copyCode?.trim().toUpperCase() || codeButton.textContent.trim().toUpperCase();
        if (!CONNECTION_PATTERN.test(code)) return;
        codeButton.dataset.handoffEnhanced = 'true';
        const show = document.createElement('button');
        show.type = 'button';
        show.className = 'still-show-handoff';
        show.textContent = t('Show QR for buyer', 'Prikaži QR kupcu');
        show.addEventListener('click', () => showCompanyHandoff(code));
        codeButton.insertAdjacentElement('afterend', show);
        showCompanyHandoff(code);
      });
    };
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function loadBuyerWallet() {
    if (document.body.classList.contains('business-page') || document.querySelector('script[data-buyer-wallet]')) return;
    const script = document.createElement('script');
    script.src = '/buyer-wallet-v96.js';
    script.defer = true;
    script.dataset.buyerWallet = 'true';
    document.head.appendChild(script);
  }

  function installHandoffStyles() {
    if ($('#stillHandoffStyles')) return;
    const style = document.createElement('style');
    style.id = 'stillHandoffStyles';
    style.textContent = `
      .still-handoff-notice{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start;margin:0 0 14px;padding:14px;border:1px solid color-mix(in srgb,var(--green) 45%,var(--line));border-radius:14px;background:color-mix(in srgb,var(--soft) 72%,var(--surface));color:var(--ink)}
      .still-handoff-notice>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--green);color:#07130e;font-weight:900}.still-handoff-notice b,.still-handoff-notice p{display:block;margin:0}.still-handoff-notice p{margin-top:4px;color:var(--muted);font-size:12px;line-height:1.5}.still-handoff-notice button{border:0;background:transparent;color:var(--muted);font-size:20px;cursor:pointer}.still-handoff-ready input[name="code"]{border-color:var(--green)!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--green) 16%,transparent)!important}
      .still-show-handoff{margin-left:8px;min-height:38px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);padding:0 12px;font-weight:800;cursor:pointer}
      .still-handoff-dialog{width:min(820px,calc(100% - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line);border-radius:24px;background:var(--surface);color:var(--ink);box-shadow:0 30px 100px rgba(0,0,0,.32);overflow:auto}.still-handoff-dialog::backdrop{background:rgba(4,12,8,.62);backdrop-filter:blur(8px)}.still-handoff-close{position:sticky;z-index:2;top:12px;float:right;margin:12px 12px 0 0;width:38px;height:38px;border:1px solid var(--line);border-radius:11px;background:var(--surface2);color:var(--ink);font-size:20px;cursor:pointer}.still-handoff-layout{display:grid;grid-template-columns:minmax(250px,.84fr) 1.16fr;gap:28px;align-items:center;padding:42px}.still-handoff-qr{padding:16px;border:1px solid var(--line);border-radius:20px;background:#fff}.still-handoff-qr svg{display:block;width:100%;height:auto}.still-handoff-qr-fallback{display:grid;place-items:center;aspect-ratio:1;font-size:100px;color:#111}.still-handoff-copy>span{font-size:10px;font-weight:900;letter-spacing:.1em;color:var(--green)}.still-handoff-copy h2{margin:8px 0;font-size:clamp(28px,5vw,44px);line-height:1;letter-spacing:-1.8px}.still-handoff-copy p{color:var(--muted);font-size:14px;line-height:1.6}.still-handoff-copy>strong{display:block;margin:16px 0;padding:12px;border:1px dashed var(--line);border-radius:12px;text-align:center;letter-spacing:.08em;font-size:18px}.still-handoff-safe{padding:13px;border:1px solid var(--line);border-radius:13px;background:var(--surface2)}.still-handoff-safe b,.still-handoff-safe small{display:block}.still-handoff-safe small{margin-top:4px;color:var(--muted);line-height:1.5}.still-handoff-actions{display:flex;gap:8px;margin-top:14px}.still-handoff-actions button{min-height:44px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);padding:0 14px;font-weight:800;cursor:pointer}#stillHandoffMessage{display:block;margin-top:8px;color:var(--muted)}
      @media(max-width:680px){.still-handoff-layout{grid-template-columns:1fr;padding:22px 16px 26px;gap:18px}.still-handoff-qr{width:min(76vw,330px);margin:auto}.still-handoff-actions{flex-direction:column}.still-handoff-actions button,.still-show-handoff{width:100%;margin:8px 0 0}.still-handoff-copy h2{font-size:32px}.still-handoff-dialog{border-radius:20px}.still-handoff-notice{grid-template-columns:auto 1fr}}
    `;
    document.head.appendChild(style);
  }

  function start() {
    mountBuyerNavigation();
    mountBusinessAccess();
    mountFooterLinks();
    installHandoffStyles();
    prepareBuyerConnection();
    enhanceCompanyConnectionCodes();
    loadBuyerWallet();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  $('#language')?.addEventListener('change', () => setTimeout(() => {
    updateBuyerNavigation();
    updateBusinessAccess();
    updateFooterLinks();
  }, 0));
})();
