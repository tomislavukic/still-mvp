(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const money = (cents, currency = 'EUR') => new Intl.NumberFormat(isHr() ? 'hr-HR' : 'en-GB', { style: 'currency', currency }).format((Number(cents) || 0) / 100);
  const kindLabel = kind => ({ product: t('Product', 'Proizvod'), service: t('Service', 'Usluga'), subscription: t('Subscription', 'Pretplata'), booking: t('Booking', 'Rezervacija'), rental: t('Rental', 'Najam'), project: t('Project', 'Projekt') })[kind] || kind;
  const fulfillmentLabel = kind => ({ delivery: t('Delivery', 'Dostava'), pickup: t('Pickup', 'Preuzimanje'), appointment: t('Appointment', 'Termin'), on_site: t('On-site service', 'Usluga na lokaciji'), digital: t('Digital delivery', 'Digitalna isporuka'), agreed: t('As agreed', 'Prema dogovoru') })[kind] || kind;
  let root;
  let dialog;
  let offers = [];
  let selected = null;
  let stripePromise;

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, signal: controller.signal, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.message || data.error || `HTTP ${response.status}`), { status: response.status, data });
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function shell() {
    return `
      <section class="pc92-intro">
        <div>
          <span class="pc92-kicker">PASSPORT COMMERCE</span>
          <h2>${t('Pay the business. Keep the promise.', 'Plati tvrtki. Sačuvaj obećanje.')}</h2>
          <p>${t('Buy a verified service or product and receive a permanent passport with the seller, accepted terms, payment record, commitments, rewards and future support.', 'Kupi verificiranu uslugu ili proizvod i primi trajnu putovnicu s prodavateljem, prihvaćenim uvjetima, zapisom plaćanja, obećanjima, nagradama i budućom podrškom.')}</p>
        </div>
        <div class="pc92-role"><b>${t('Not an anonymous webshop', 'Nije anonimni webshop')}</b><span>${t('Every offer names the verified seller. Still? structures checkout and the evidence trail; the business remains responsible for fulfilment, invoices, cancellations, refunds and warranties.', 'Svaka ponuda imenuje verificiranog prodavatelja. Still? strukturira naplatu i trag dokaza; tvrtka ostaje odgovorna za izvršenje, račune, otkaze, povrate i jamstva.')}</span></div>
      </section>
      <div class="pc92-flow" aria-label="${t('Passport Commerce flow', 'Tijek Passport Commercea')}">
        <span><b>1</b>${t('Choose a verified offer', 'Odaberi verificiranu ponudu')}</span><i>→</i>
        <span><b>2</b>${t('Review seller and terms', 'Provjeri prodavatelja i uvjete')}</span><i>→</i>
        <span><b>3</b>${t('Pay that business', 'Plati toj tvrtki')}</span><i>→</i>
        <span><b>4</b>${t('Passport activates', 'Putovnica se aktivira')}</span>
      </div>
      <div class="pc92-tools">
        <label><span>${t('Search offers', 'Pretraži ponude')}</span><input id="pc92Search" type="search" placeholder="${t('Repair, consultation, appliance…', 'Popravak, savjetovanje, uređaj…')}"></label>
        <label><span>${t('Type', 'Vrsta')}</span><select id="pc92Kind"><option value="">${t('All offers', 'Sve ponude')}</option><option value="service">${t('Services', 'Usluge')}</option><option value="product">${t('Products', 'Proizvodi')}</option><option value="booking">${t('Bookings', 'Rezervacije')}</option><option value="subscription">${t('Subscriptions', 'Pretplate')}</option><option value="project">${t('Projects', 'Projekti')}</option><option value="rental">${t('Rentals', 'Najam')}</option></select></label>
        <div class="pc93-tool-actions"><button type="button" data-pc92-requests>${t('My requests', 'Moji zahtjevi')}</button><button type="button" data-pc92-orders>${t('Paid passports', 'Plaćene putovnice')}</button></div>
      </div>
      <div id="pc92List" class="pc92-list" aria-live="polite"><div class="pc92-loading">${t('Loading verified offers…', 'Učitavanje verificiranih ponuda…')}</div></div>
      <div class="pc92-request">
        <div><span>REQUEST → VERIFIED QUOTES → PASSPORT</span><h3>${t('Cannot find the right offer?', 'Ne nalaziš pravu ponudu?')}</h3><p>${t('Describe what you need once. Verified businesses can answer with comparable, private Passport Quotes. Your email and identity are not shown on the request board.', 'Jednom opiši što trebaš. Verificirane tvrtke mogu odgovoriti usporedivim, privatnim Passport ponudama. Tvoja e-pošta i identitet nisu prikazani na ploči zahtjeva.')}</p></div>
        <button type="button" data-pc92-request>${t('Request verified quotes', 'Zatraži verificirane ponude')}</button>
      </div>
      <section class="pc93-guide" aria-label="${t('What the buyer gets', 'Što kupac dobiva')}">
        <header><span>BEFORE · DURING · AFTER</span><h3>${t('Useful before you buy—not only when something goes wrong.', 'Korisno prije kupnje—ne samo kada nešto pođe po zlu.')}</h3></header>
        <div><article><b>✓ ${t('Know who is responsible', 'Znaj tko je odgovoran')}</b><p>${t('See the verified seller, exact scope, total price and cancellation terms before payment.', 'Prije plaćanja vidi verificiranog prodavatelja, točan opseg, ukupnu cijenu i uvjete otkazivanja.')}</p></article><article><b>↔ ${t('Compare real commitments', 'Usporedi stvarna obećanja')}</b><p>${t('Compare price with fulfilment, timing, warranty and rewards—not a vague star score.', 'Usporedi cijenu s izvršenjem, rokom, jamstvom i nagradama—ne s nejasnom ocjenom zvjezdicama.')}</p></article><article><b>◇ ${t('Keep one lasting passport', 'Sačuvaj jednu trajnu putovnicu')}</b><p>${t('The accepted promise, payment record, support history, warranty and reward points stay together.', 'Prihvaćeno obećanje, zapis plaćanja, povijest podrške, jamstvo i bodovi ostaju zajedno.')}</p></article></div>
      </section>`;
  }

  function mount() {
    if ($('#passportCommerceV92') || document.body.classList.contains('business-page')) return;
    const anchor = $('#commerceMountV92');
    if (!anchor) return setTimeout(mount, 200);
    root = document.createElement('section');
    root.id = 'passportCommerceV92';
    root.className = 'pc92 op83-section';
    root.innerHTML = shell();
    anchor.replaceWith(root);
    $$('#pc92Dialog').forEach(existing => existing.remove());
    dialog = document.createElement('dialog');
    dialog.id = 'pc92Dialog';
    dialog.className = 'pc92-dialog';
    document.body.appendChild(dialog);
    bind();
    load();
  }

  function bind() {
    $('#pc92Search', root)?.addEventListener('input', debounce(load, 250));
    $('#pc92Kind', root)?.addEventListener('change', load);
    $('[data-pc92-orders]', root)?.addEventListener('click', showOrders);
    $('[data-pc92-requests]', root)?.addEventListener('click', showRequests);
    $('[data-pc92-request]', root)?.addEventListener('click', showRequestForm);
    $('#pc92List', root)?.addEventListener('click', event => {
      const button = event.target.closest('[data-pc92-offer]');
      if (button) openOffer(button.dataset.pc92Offer);
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-pc92-close]')) dialog.close();
      const accept = event.target.closest('[data-pc92-accept-quote]');
      if (accept) acceptQuoteUI(accept.dataset.request, accept.dataset.pc92AcceptQuote, accept);
      const closeRequest = event.target.closest('[data-pc92-close-request]');
      if (closeRequest) updateRequest(closeRequest.dataset.pc92CloseRequest, 'closed', closeRequest);
      const signIn = event.target.closest('[data-pc92-signin]');
      if (signIn) openBuyerSignIn();
    });
    dialog.addEventListener('submit', event => {
      if (event.target.id === 'pc92CheckoutForm') checkout(event);
      if (event.target.id === 'pc92DemoForm') completeDemo(event);
      if (event.target.id === 'pc93RequestForm') createRequest(event);
    });
  }

  function debounce(callback, delay) {
    let timer;
    return () => { clearTimeout(timer); timer = setTimeout(callback, delay); };
  }

  async function load() {
    const host = $('#pc92List', root);
    const params = new URLSearchParams();
    const q = $('#pc92Search', root)?.value.trim();
    const kind = $('#pc92Kind', root)?.value;
    if (q) params.set('q', q);
    if (kind) params.set('kind', kind);
    host.innerHTML = `<div class="pc92-loading">${t('Loading verified offers…', 'Učitavanje verificiranih ponuda…')}</div>`;
    try {
      const data = await api(`/api/v1/commerce/offers?${params}`);
      offers = data.offers || [];
      render();
    } catch {
      host.innerHTML = `<div class="pc92-empty"><b>${t('Offers are temporarily unavailable.', 'Ponude su trenutačno nedostupne.')}</b><p>${t('Your existing passports and buyer tools continue to work.', 'Tvoje postojeće putovnice i alati za kupce nastavljaju raditi.')}</p><button type="button" data-pc92-retry>${t('Try again', 'Pokušaj ponovno')}</button></div>`;
      $('[data-pc92-retry]', host)?.addEventListener('click', load);
    }
  }

  function offerCard(offer) {
    const availability = offer.quantityAvailable === null ? t('Available', 'Dostupno') : offer.quantityAvailable > 0 ? t(`${offer.quantityAvailable} available`, `${offer.quantityAvailable} dostupno`) : t('Sold out', 'Rasprodano');
    return `<article class="pc92-card">
      <div class="pc92-card-top"><span>${kindLabel(offer.kind)}</span><em>✓ ${t('Verified seller', 'Verificirani prodavatelj')}</em></div>
      <h3>${esc(offer.title)}</h3><p>${esc(offer.description)}</p>
      <div class="pc92-seller"><span>${esc(offer.seller.name)}</span><small>${fulfillmentLabel(offer.fulfillmentType)} · ${availability}</small></div>
      <div class="pc92-price"><b>${money(offer.amountCents, offer.currency)}</b><span>${offer.taxIncluded ? t('tax included', 'porez uključen') : t('plus applicable tax', 'uz primjenjivi porez')}</span></div>
      <div class="pc92-reward">+${offer.rewardPoints} ${t('Still? points after verified payment', 'Still? bodova nakon verificiranog plaćanja')}</div>
      <button type="button" data-pc92-offer="${esc(offer.publicId)}" ${offer.quantityAvailable === 0 ? 'disabled' : ''}>${t('Review offer and seller', 'Provjeri ponudu i prodavatelja')} →</button>
    </article>`;
  }

  function render() {
    const host = $('#pc92List', root);
    if (!offers.length) {
      host.innerHTML = `<div class="pc92-empty"><b>${t('No published offers match yet.', 'Još nema objavljenih ponuda koje odgovaraju.')}</b><p>${t('Verified businesses publish the first Passport Offers from their company workspace.', 'Verificirane tvrtke objavljuju prve Passport ponude iz poslovnog radnog prostora.')}</p><a href="/company.html#passportCommerceV92">${t('Publish as a business', 'Objavi kao tvrtka')} →</a></div>`;
      return;
    }
    host.innerHTML = offers.map(offerCard).join('');
  }

  async function openOffer(publicId) {
    dialog.innerHTML = `<div class="pc92-dialog-loading">${t('Opening offer…', 'Otvaranje ponude…')}</div>`;
    dialog.showModal();
    try {
      selected = (await api(`/api/v1/commerce/offers/${encodeURIComponent(publicId)}`)).offer;
      renderOffer();
    } catch {
      dialog.innerHTML = `<button data-pc92-close aria-label="Close">×</button><div class="pc92-dialog-error">${t('This offer is no longer available.', 'Ova ponuda više nije dostupna.')}</div>`;
    }
  }

  function detail(label, value) {
    return value ? `<div><span>${label}</span><p>${esc(value)}</p></div>` : '';
  }

  function postalAddress(profile = {}) {
    return [profile.addressLine1, profile.addressLine2, [profile.postalCode, profile.city].filter(Boolean).join(' '), profile.region, profile.countryCode].filter(Boolean).join(', ');
  }

  function checkoutContactFields(offer) {
    const profile = window.StillIdentityV103?.buyerProfile || {};
    const addressRequired = ['delivery', 'on_site'].includes(offer.fulfillmentType);
    return `<fieldset class="pc104-contact"><legend>${t('Your contact for this order', 'Tvoj kontakt za ovu narudžbu')}</legend><p>${t('The seller receives a fixed copy with this order. Later profile changes will not alter it.', 'Prodavatelj prima nepromjenjivu kopiju uz ovu narudžbu. Kasnije promjene profila neće je izmijeniti.')}</p><div><label><span>${t('Full name', 'Ime i prezime')}</span><input name="buyerName" required maxlength="180" autocomplete="name" value="${esc(profile.displayName||'')}"></label><label><span>${t('Phone', 'Telefon')}</span><input name="phone" required maxlength="40" inputmode="tel" autocomplete="tel" value="${esc(profile.phone||'')}"></label><label><span>${t('Street and number', 'Ulica i broj')}</span><input name="addressLine1" ${addressRequired?'required':''} maxlength="240" autocomplete="address-line1" value="${esc(profile.addressLine1||'')}"></label><label><span>${t('Apartment / unit', 'Stan / jedinica')}</span><input name="addressLine2" maxlength="240" autocomplete="address-line2" value="${esc(profile.addressLine2||'')}"></label><label><span>${t('Postal code', 'Poštanski broj')}</span><input name="postalCode" ${addressRequired?'required':''} maxlength="30" autocomplete="postal-code" value="${esc(profile.postalCode||'')}"></label><label><span>${t('City', 'Grad')}</span><input name="city" ${addressRequired?'required':''} maxlength="120" autocomplete="address-level2" value="${esc(profile.city||'')}"></label><label><span>${t('Region', 'Regija')}</span><input name="region" maxlength="120" autocomplete="address-level1" value="${esc(profile.region||'')}"></label><label><span>${t('Country code', 'Oznaka države')}</span><input name="countryCode" ${addressRequired?'required':''} maxlength="2" autocomplete="country" placeholder="HR" value="${esc(profile.countryCode||'')}"></label></div><label><span>${t('Delivery / access instructions', 'Upute za dostavu / pristup')}</span><textarea name="deliveryInstructions" maxlength="600">${esc(profile.deliveryInstructions||'')}</textarea></label><label class="pc92-accept"><input name="saveContact" type="checkbox" checked><span>${t('Save these details to my private profile for the next order.', 'Spremi ove podatke u moj privatni profil za sljedeću narudžbu.')}</span></label></fieldset>`;
  }

  function renderOffer() {
    const offer = selected;
    dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="${t('Close', 'Zatvori')}">×</button>
      <div class="pc92-dialog-head"><span>${kindLabel(offer.kind)}</span><h2>${esc(offer.title)}</h2><p>${esc(offer.description)}</p></div>
      <div class="pc92-dialog-seller"><div><small>${t('SELLER / PROVIDER', 'PRODAVATELJ / PRUŽATELJ')}</small><b>✓ ${esc(offer.seller.name)}</b><span>${esc(offer.seller.summary || t('Verified Still? business', 'Verificirana Still? tvrtka'))}</span><div class="pc104-seller-contact"><strong>${esc(offer.seller.phone||offer.seller.supportEmail||t('Contact not added','Kontakt nije dodan'))}</strong><span>${esc(postalAddress(offer.seller)||t('Business address not added','Adresa tvrtke nije dodana'))}</span>${offer.seller.businessHours?`<small>${esc(offer.seller.businessHours)}</small>`:''}</div></div><em>${t('Verified', 'Verificirano')}</em></div>
      <div class="pc92-dialog-details">
        ${detail(t('Included', 'Uključeno'), offer.includes)}
        ${detail(t('Not included', 'Nije uključeno'), offer.exclusions)}
        ${detail(t('Fulfilment', 'Izvršenje'), `${fulfillmentLabel(offer.fulfillmentType)}${offer.fulfillmentDetails ? ` · ${offer.fulfillmentDetails}` : ''}`)}
        ${detail(t('Estimated time', 'Procijenjeno vrijeme'), offer.estimatedDuration)}
        ${detail(t('Cancellation / return terms', 'Uvjeti otkazivanja / povrata'), offer.cancellationTerms)}
        ${detail(t('Warranty / service guarantee', 'Jamstvo / garancija usluge'), offer.warrantyTerms)}
      </div>
      <div class="pc92-dialog-role"><b>${t('You pay this business—not Still?.', 'Plaćaš ovoj tvrtki—ne Still?.')}</b><span>${t('The seller handles fulfilment, invoice, cancellation, refund and warranty. Still? records the accepted offer, orchestrates checkout and activates your passport.', 'Prodavatelj vodi izvršenje, račun, otkazivanje, povrat i jamstvo. Still? bilježi prihvaćenu ponudu, usmjerava naplatu i aktivira tvoju putovnicu.')}</span></div>
      <form id="pc92CheckoutForm" class="pc92-checkout-form">
        ${checkoutContactFields(offer)}
        <label><span>${t('Message or preferred appointment', 'Poruka ili željeni termin')}</span><textarea name="buyerMessage" maxlength="1000" placeholder="${t('Optional details for the seller', 'Neobavezni detalji za prodavatelja')}"></textarea></label>
        <label class="pc92-accept"><input type="checkbox" required><span>${t('I reviewed the seller, scope, price and cancellation terms.', 'Pregledao/la sam prodavatelja, opseg, cijenu i uvjete otkazivanja.')}</span></label>
        <div class="pc92-checkout-total"><span>${t('Total', 'Ukupno')}<small>${offer.taxIncluded ? t('Tax included', 'Porez uključen') : t('Tax shown by seller', 'Porez prikazuje prodavatelj')}</small></span><b>${money(offer.amountCents, offer.currency)}</b></div>
        <button type="submit">${t(`Continue to pay ${offer.seller.name}`, `Nastavi na plaćanje tvrtki ${offer.seller.name}`)}</button>
        <small id="pc92CheckoutMessage"></small>
      </form>`;
  }

  async function checkout(event) {
    event.preventDefault();
    const button = $('button[type="submit"]', event.currentTarget);
    const message = $('#pc92CheckoutMessage', dialog);
    button.disabled = true;
    message.textContent = t('Preparing secure checkout…', 'Priprema sigurne naplate…');
    try {
      const me = await api('/api/v1/buyer-auth/me');
      if (!me.authenticated) throw Object.assign(new Error('buyer_sign_in_required'), { status: 401 });
      const values = Object.fromEntries(new FormData(event.currentTarget));
      values.saveContact = event.currentTarget.saveContact.checked;
      const data = await api(`/api/v1/commerce/offers/${encodeURIComponent(selected.publicId)}/checkout`, { method: 'POST', body: JSON.stringify(values) });
      if (data.payment.provider === 'stripe') return renderStripe(data);
      renderDemo(data);
    } catch (error) {
      if (error.status === 401) {
        message.innerHTML = `${t('Buyer sign-in is required before checkout.', 'Prije naplate potrebna je prijava kupca.')} <button type="button" data-pc92-signin>${t('Open Google sign-in', 'Otvori Google prijavu')}</button>`;
        $('[data-pc92-signin]', message)?.addEventListener('click', () => {
          dialog.close();
          $('#buyerAuthV77 [data-open]')?.click();
          $('#buyerAuthV77')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else message.textContent = error.message === 'sold_out' ? t('This offer is sold out.', 'Ova ponuda je rasprodana.') : error.message === 'contact_required' ? t('Add the required name, phone and delivery address.', 'Dodaj obvezno ime, telefon i adresu dostave.') : t('Checkout could not start. Please try again.', 'Naplatu nije moguće pokrenuti. Pokušaj ponovno.');
      button.disabled = false;
    }
  }

  function renderDemo(data) {
    dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button>
      <div class="pc92-demo"><span>DEMO CHECKOUT</span><h2>${t('Payment provider connection is still required.', 'Još je potrebno povezati pružatelja naplate.')}</h2><p>${esc(data.payment.reason)}</p>
        <div><b>${esc(data.seller.name)}</b><strong>${money(data.order.amountCents, data.order.currency)}</strong></div>
        <form id="pc92DemoForm" data-order="${esc(data.order.publicId)}">
          <label><input type="checkbox" name="confirmDemo" required><span>${t('I understand that this demonstration does not charge a card or transfer money.', 'Razumijem da ova demonstracija ne tereti karticu niti prenosi novac.')}</span></label>
          <button>${t('Activate demonstration passport', 'Aktiviraj demonstracijsku putovnicu')}</button><small id="pc92DemoMessage"></small>
        </form>
        <small>${t('Live checkout activates automatically only after the platform owner adds provider credentials and the business completes payment onboarding.', 'Živa naplata aktivira se automatski tek nakon što vlasnik platforme doda pristupne podatke pružatelja i tvrtka dovrši povezivanje naplate.')}</small>
      </div>`;
  }

  async function completeDemo(event) {
    event.preventDefault();
    const button = $('button', event.currentTarget);
    const message = $('#pc92DemoMessage', dialog);
    button.disabled = true;
    message.textContent = t('Activating passport…', 'Aktiviranje putovnice…');
    try {
      const data = await api(`/api/v1/commerce/orders/${encodeURIComponent(event.currentTarget.dataset.order)}/demo-complete`, { method: 'POST', body: JSON.stringify({ confirmDemo: true }) });
      savePassport(data.passport);
      window.dispatchEvent(new CustomEvent('still:commerce-paid', { detail: data }));
      dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button><div class="pc92-success"><span>✓</span><h2>${t('Passport activated.', 'Putovnica je aktivirana.')}</h2><p>${t('No money was transferred in this demonstration. The order, seller commitment and passport were created successfully.', 'U ovoj demonstraciji novac nije prenesen. Narudžba, obećanje prodavatelja i putovnica uspješno su stvoreni.')}</p><a href="#ownershipHubV83" data-pc92-close>${t('Open my passports', 'Otvori moje putovnice')} →</a></div>`;
    } catch {
      message.textContent = t('The demonstration could not be completed.', 'Demonstraciju nije moguće dovršiti.');
      button.disabled = false;
    }
  }

  function savePassport(item) {
    if (!item) return;
    const key = 'still-ownership-passports-v83';
    let items = [];
    try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    const passport = { id: item.publicId, publicId: item.publicId, kind: item.kind, title: item.title, business: item.businessName || '', reference: item.reference || '', purchasedOn: item.purchasedOn || '', status: item.status, connection: 'company', commitments: item.commitments || [], createdAt: item.createdAt, updatedAt: item.updatedAt };
    localStorage.setItem(key, JSON.stringify([passport, ...items.filter(existing => existing.publicId !== passport.publicId)]));
  }

  function loadStripe() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    if (stripePromise) return stripePromise;
    stripePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => resolve(window.Stripe);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return stripePromise;
  }

  async function renderStripe(data) {
    dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button><div class="pc92-live"><span>${t('SECURE BUSINESS CHECKOUT', 'SIGURNA NAPLATA TVRTKE')}</span><h2>${t(`Pay ${data.seller.name}`, `Plati tvrtki ${data.seller.name}`)}</h2><p>${t('Still? does not receive the sale proceeds. Your passport activates after verified payment confirmation.', 'Still? ne prima prihod od prodaje. Tvoja putovnica aktivira se nakon potvrđenog plaćanja.')}</p><div id="pc92PaymentElement"></div><button id="pc92Pay">${t('Pay', 'Plati')} ${money(data.order.amountCents, data.order.currency)}</button><small id="pc92PayMessage"></small></div>`;
    try {
      const Stripe = await loadStripe();
      const stripe = Stripe(data.payment.publishableKey, { stripeAccount: data.payment.connectedAccountId });
      const elements = stripe.elements({ clientSecret: data.payment.clientSecret, appearance: { theme: document.documentElement.dataset.theme === 'dark' ? 'night' : 'stripe' } });
      const element = elements.create('payment');
      element.mount('#pc92PaymentElement');
      $('#pc92Pay', dialog).addEventListener('click', async () => {
        const button = $('#pc92Pay', dialog);
        button.disabled = true;
        const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${location.origin}/#passportCommerceV92` }, redirect: 'if_required' });
        if (result.error) {
          $('#pc92PayMessage', dialog).textContent = result.error.message;
          button.disabled = false;
          return;
        }
        $('#pc92PayMessage', dialog).textContent = t('Payment confirmed. Activating your passport…', 'Plaćanje potvrđeno. Aktiviranje putovnice…');
        try {
          const confirmed = await api(`/api/v1/commerce/orders/${encodeURIComponent(data.order.publicId)}/confirm`, { method: 'POST', body: '{}' });
          savePassport(confirmed.passport);
          window.dispatchEvent(new CustomEvent('still:commerce-paid', { detail: confirmed }));
          dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button><div class="pc92-success"><span>✓</span><h2>${t('Payment verified. Passport activated.', 'Plaćanje verificirano. Putovnica aktivirana.')}</h2><p>${t('The seller received the order and its accepted commitment is now in your permanent record.', 'Prodavatelj je primio narudžbu, a prihvaćeno obećanje sada je u tvojem trajnom zapisu.')}</p><a href="#ownershipHubV83" data-pc92-close>${t('Open my passport', 'Otvori moju putovnicu')} →</a></div>`;
        } catch {
          $('#pc92PayMessage', dialog).textContent = t('Payment succeeded. Passport activation is waiting for the secure provider webhook; check My paid passports shortly.', 'Plaćanje je uspjelo. Aktivacija putovnice čeka sigurnu potvrdu pružatelja; uskoro provjeri Moje plaćene putovnice.');
          button.disabled = false;
        }
      });
    } catch {
      $('#pc92PayMessage', dialog).textContent = t('Secure payment form could not load. No charge was made.', 'Sigurni obrazac plaćanja nije se mogao učitati. Kartica nije terećena.');
    }
  }

  function openBuyerSignIn() {
    dialog.close();
    $('#buyerAuthV77 [data-open]')?.click();
    $('#buyerAuthV77')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function signedOut(title, description) {
    dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="${t('Close', 'Zatvori')}">×</button><div class="pc93-auth"><span>BUYER ACCOUNT</span><h2>${title}</h2><p>${description}</p><button type="button" data-pc92-signin>${t('Continue with Google', 'Nastavi s Googleom')}</button><small>${t('Google sign-in is for buyers. Verified businesses use the separate company workspace.', 'Google prijava namijenjena je kupcima. Verificirane tvrtke koriste odvojeni poslovni prostor.')}</small></div>`;
  }

  async function requireBuyer() {
    const me = await api('/api/v1/buyer-auth/me');
    if (!me.authenticated) throw Object.assign(new Error('buyer_sign_in_required'), { status: 401 });
    return me;
  }

  async function showRequestForm() {
    dialog.innerHTML = `<div class="pc92-dialog-loading">${t('Opening a private request…', 'Otvaranje privatnog zahtjeva…')}</div>`;
    if (!dialog.open) dialog.showModal();
    try {
      await requireBuyer();
      dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="${t('Close', 'Zatvori')}">×</button>
        <form id="pc93RequestForm" class="pc93-request-form">
          <header><span>REQUEST → VERIFIED QUOTES</span><h2>${t('Tell verified businesses what you need.', 'Reci verificiranim tvrtkama što trebaš.')}</h2><p>${t('Write one clear brief. Businesses see the need—not your Google profile or email—and answer with structured quotes you can compare.', 'Napiši jedan jasan opis. Tvrtke vide potrebu—ne tvoj Google profil ili e-poštu—i odgovaraju strukturiranim ponudama koje možeš usporediti.')}</p></header>
          <div class="pc93-fields"><label><span>${t('What are you looking for?', 'Što tražiš?')}</span><select name="kind">${['service','product','booking','project','subscription','rental'].map(kind => `<option value="${kind}">${kindLabel(kind)}</option>`).join('')}</select></label><label><span>${t('Area—not exact address', 'Područje—ne točna adresa')}</span><input name="location" maxlength="180" placeholder="${t('e.g. Zagreb or remote', 'npr. Zagreb ili udaljeno')}"></label></div>
          <label><span>${t('Short title', 'Kratak naslov')}</span><input name="title" required minlength="3" maxlength="180" placeholder="${t('e.g. Annual heat-pump service', 'npr. Godišnji servis dizalice topline')}"></label>
          <label><span>${t('What result do you need?', 'Koji rezultat trebaš?')}</span><textarea name="description" required minlength="20" maxlength="3000" placeholder="${t('Describe the situation, desired result and anything a company needs to price responsibly.', 'Opiši situaciju, željeni rezultat i sve što tvrtka treba za odgovorno određivanje cijene.')}"></textarea></label>
          <label><span>${t('Must-haves', 'Obavezni uvjeti')}</span><textarea name="mustHaves" maxlength="2000" placeholder="${t('Qualifications, materials, compatibility, accessibility or other non-negotiables', 'Kvalifikacije, materijali, kompatibilnost, pristupačnost ili drugi obavezni uvjeti')}"></textarea></label>
          <div class="pc93-fields pc93-fields-three"><label><span>${t('Budget from · EUR', 'Budžet od · EUR')}</span><input name="budgetMin" type="number" min="0" step="0.01" inputmode="decimal"></label><label><span>${t('Budget to · EUR', 'Budžet do · EUR')}</span><input name="budgetMax" type="number" min="0" step="0.01" inputmode="decimal"></label><label><span>${t('Needed by', 'Potrebno do')}</span><input name="desiredBy" type="date"></label></div>
          <div class="pc93-privacy"><b>◉ ${t('Privacy by design', 'Privatnost po dizajnu')}</b><span>${t('Do not include an exact address, phone number, email, payment data or sensitive personal information. Share detailed contact information only after choosing a business.', 'Ne navodi točnu adresu, telefon, e-poštu, podatke za plaćanje ili osjetljive osobne podatke. Detaljne kontakte podijeli tek nakon odabira tvrtke.')}</span></div>
          <label class="pc92-accept"><input type="checkbox" required><span>${t('I confirm this brief contains no private contact or payment information.', 'Potvrđujem da opis ne sadrži privatne kontakte ni podatke za plaćanje.')}</span></label>
          <button type="submit">${t('Publish request to verified businesses', 'Objavi zahtjev verificiranim tvrtkama')}</button><small id="pc93RequestMessage"></small>
        </form>`;
    } catch (error) {
      if (error.status === 401) signedOut(t('Sign in to request verified quotes.', 'Prijavi se za verificirane ponude.'), t('Your requests and company responses stay connected to your buyer account across devices.', 'Tvoji zahtjevi i odgovori tvrtki ostaju povezani s računom kupca na svim uređajima.'));
      else dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close>×</button><div class="pc92-dialog-error">${t('Requests are temporarily unavailable.', 'Zahtjevi su trenutačno nedostupni.')}</div>`;
    }
  }

  async function createRequest(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const message = $('#pc93RequestMessage', form);
    const values = Object.fromEntries(new FormData(form));
    const cents = value => value === '' ? null : Math.round(Number(value) * 100);
    button.disabled = true;
    message.textContent = t('Publishing securely…', 'Sigurna objava…');
    try {
      await api('/api/v1/commerce/requests', { method: 'POST', body: JSON.stringify({ kind: values.kind, title: values.title, description: values.description, location: values.location, budgetMinCents: cents(values.budgetMin), budgetMaxCents: cents(values.budgetMax), desiredBy: values.desiredBy, mustHaves: values.mustHaves }) });
      await showRequests(t('Request published. Verified businesses can now respond.', 'Zahtjev je objavljen. Verificirane tvrtke sada mogu odgovoriti.'));
    } catch (error) {
      message.textContent = error.message === 'invalid_budget' ? t('The maximum budget must be greater than the minimum.', 'Najveći budžet mora biti veći od najmanjeg.') : error.message;
      button.disabled = false;
    }
  }

  function budget(request) {
    if (request.budgetMinCents == null && request.budgetMaxCents == null) return t('Open budget', 'Otvoren budžet');
    if (request.budgetMinCents != null && request.budgetMaxCents != null) return `${money(request.budgetMinCents)}–${money(request.budgetMaxCents)}`;
    return request.budgetMinCents != null ? `${t('From', 'Od')} ${money(request.budgetMinCents)}` : `${t('Up to', 'Do')} ${money(request.budgetMaxCents)}`;
  }

  function quoteCard(request, quote) {
    const accepted = quote.status === 'accepted';
    const rejected = quote.status === 'rejected';
    return `<article class="pc93-quote ${accepted ? 'accepted' : ''}">
      <div class="pc93-quote-head"><div><span>✓ ${t('Verified business', 'Verificirana tvrtka')}</span><b>${esc(quote.seller?.name || '')}</b></div><strong>${money(quote.amountCents, quote.currency)}</strong></div>
      <h4>${esc(quote.title)}</h4><p>${esc(quote.description)}</p>
      <dl><div><dt>${t('Fulfilment', 'Izvršenje')}</dt><dd>${esc(`${fulfillmentLabel(quote.fulfillmentType)}${quote.fulfillmentDetails ? ` · ${quote.fulfillmentDetails}` : ''}`)}</dd></div><div><dt>${t('Timing', 'Rok')}</dt><dd>${esc(quote.estimatedDuration || t('Confirm with business', 'Potvrdi s tvrtkom'))}</dd></div><div><dt>${t('Cancellation', 'Otkazivanje')}</dt><dd>${esc(quote.cancellationTerms)}</dd></div><div><dt>${t('Warranty', 'Jamstvo')}</dt><dd>${esc(quote.warrantyTerms || t('Not stated', 'Nije navedeno'))}</dd></div></dl>
      <div class="pc93-quote-foot"><span>+${quote.rewardPoints} ${t('points', 'bodova')}</span><span>${quote.taxIncluded ? t('Tax included', 'Porez uključen') : t('Tax may apply', 'Porez se može dodati')}</span></div>
      ${accepted && quote.offerPublicId ? `<button type="button" data-pc92-offer="${esc(quote.offerPublicId)}">${t('Continue to accepted offer', 'Nastavi na prihvaćenu ponudu')} →</button>` : !rejected && request.status === 'open' ? `<button type="button" data-pc92-accept-quote="${esc(quote.publicId)}" data-request="${esc(request.publicId)}">${t(`Choose ${quote.seller?.name || 'business'}`, `Odaberi ${quote.seller?.name || 'tvrtku'}`)}</button>` : `<em>${accepted ? t('Chosen', 'Odabrano') : t('Not selected', 'Nije odabrano')}</em>`}
    </article>`;
  }

  function requestCard(request) {
    const quotes = request.quotes || [];
    return `<article class="pc93-request-card"><header><div><span>${kindLabel(request.kind)} · ${esc(request.publicId)}</span><h3>${esc(request.title)}</h3></div><em class="${esc(request.status)}">${esc(request.status)}</em></header><p>${esc(request.description)}</p><div class="pc93-request-meta"><span><b>${t('Budget', 'Budžet')}</b>${budget(request)}</span>${request.location ? `<span><b>${t('Area', 'Područje')}</b>${esc(request.location)}</span>` : ''}${request.desiredBy ? `<span><b>${t('Needed by', 'Potrebno do')}</b>${esc(request.desiredBy)}</span>` : ''}<span><b>${t('Quotes', 'Ponude')}</b>${quotes.length}</span></div>${request.mustHaves ? `<div class="pc93-must"><b>${t('Must-haves', 'Obavezni uvjeti')}</b><p>${esc(request.mustHaves)}</p></div>` : ''}${quotes.length ? `<div class="pc93-quotes">${quotes.map(quote => quoteCard(request, quote)).join('')}</div>` : `<div class="pc93-waiting"><b>${t('Waiting for verified businesses', 'Čekanje verificiranih tvrtki')}</b><span>${t('You can close the request at any time. Your identity remains private.', 'Zahtjev možeš zatvoriti bilo kada. Tvoj identitet ostaje privatan.')}</span></div>`}${request.status === 'open' ? `<button class="pc93-close-request" type="button" data-pc92-close-request="${esc(request.publicId)}">${t('Close this request', 'Zatvori ovaj zahtjev')}</button>` : ''}</article>`;
  }

  async function showRequests(notice = '') {
    dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button><div class="pc92-dialog-loading">${t('Loading your requests…', 'Učitavanje tvojih zahtjeva…')}</div>`;
    if (!dialog.open) dialog.showModal();
    try {
      const data = await api('/api/v1/commerce/requests');
      const requests = data.requests || [];
      dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button><div class="pc93-requests"><header><span>MY REQUESTS</span><h2>${t('Compare promises—not just prices.', 'Usporedi obećanja—ne samo cijene.')}</h2><p>${t('Only you can see these quotes. Choosing one creates a private offer; you still review every term before checkout.', 'Samo ti vidiš ove ponude. Odabirom se stvara privatna ponuda; i dalje pregledavaš svaki uvjet prije naplate.')}</p><button type="button" data-pc92-new-request>${t('New request', 'Novi zahtjev')} +</button></header>${notice ? `<div class="pc93-notice">✓ ${esc(notice)}</div>` : ''}${requests.length ? requests.map(requestCard).join('') : `<div class="pc92-empty"><b>${t('No requests yet.', 'Još nema zahtjeva.')}</b><p>${t('Describe a need once and compare structured responses from verified businesses.', 'Jednom opiši potrebu i usporedi strukturirane odgovore verificiranih tvrtki.')}</p><button type="button" data-pc92-new-request>${t('Create my first request', 'Izradi moj prvi zahtjev')}</button></div>`}</div>`;
      $$('[data-pc92-new-request]', dialog).forEach(button => button.addEventListener('click', showRequestForm));
      $$('[data-pc92-offer]', dialog).forEach(button => button.addEventListener('click', () => openOffer(button.dataset.pc92Offer)));
    } catch (error) {
      if (error.status === 401) signedOut(t('Sign in to see your requests.', 'Prijavi se za pregled zahtjeva.'), t('Quotes are private and available only inside your buyer account.', 'Ponude su privatne i dostupne samo unutar tvog računa kupca.'));
      else dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close>×</button><div class="pc92-dialog-error">${t('Requests are temporarily unavailable.', 'Zahtjevi su trenutačno nedostupni.')}</div>`;
    }
  }

  async function acceptQuoteUI(requestId, quoteId, button) {
    if (!confirm(t('Choose this quote? Other quotes for this request will be closed, but you will review the full offer again before payment.', 'Odabrati ovu ponudu? Ostale ponude za ovaj zahtjev bit će zatvorene, ali prije plaćanja ponovno ćeš pregledati cijelu ponudu.'))) return;
    button.disabled = true;
    try {
      const data = await api(`/api/v1/commerce/requests/${encodeURIComponent(requestId)}/quotes/${encodeURIComponent(quoteId)}/accept`, { method: 'POST', body: '{}' });
      selected = data.offer;
      renderOffer();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  }

  async function updateRequest(requestId, status, button) {
    button.disabled = true;
    try {
      await api(`/api/v1/commerce/requests/${encodeURIComponent(requestId)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await showRequests(t('Request closed.', 'Zahtjev je zatvoren.'));
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  }

  async function showOrders() {
    dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button><div class="pc92-dialog-loading">${t('Loading your orders…', 'Učitavanje tvojih narudžbi…')}</div>`;
    if (!dialog.open) dialog.showModal();
    try {
      const data = await api('/api/v1/commerce/orders');
      const rows = data.orders || [];
      dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button><div class="pc92-orders"><span>MY PASSPORT COMMERCE</span><h2>${t('Orders and activated passports', 'Narudžbe i aktivirane putovnice')}</h2>${rows.length ? rows.map(order => `<article><div><b>${esc(order.offer?.title || order.publicId)}</b><span>${esc(order.offer?.sellerName || '')} · ${esc(order.publicId)}</span></div><strong>${money(order.amountCents, order.currency)}</strong><em class="${esc(order.status)}">${esc(order.status.replaceAll('_', ' '))}</em>${order.passportId ? `<a href="#ownershipHubV83" data-pc92-close>${t('Open passport', 'Otvori putovnicu')} →</a>` : ''}</article>`).join('') : `<p>${t('No Passport Commerce orders yet.', 'Još nema Passport Commerce narudžbi.')}</p>`}</div>`;
    } catch (error) {
      dialog.innerHTML = `<button class="pc92-close" type="button" data-pc92-close aria-label="Close">×</button><div class="pc92-dialog-error">${error.status === 401 ? t('Sign in as a buyer to view orders.', 'Prijavi se kao kupac za pregled narudžbi.') : t('Orders are temporarily unavailable.', 'Narudžbe su trenutačno nedostupne.')}</div>`;
    }
  }

  function remountLanguage() {
    if (!root || !root.isConnected) return mount();
    root.innerHTML = shell();
    bind();
    load();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mount, { once: true }) : mount();
  window.addEventListener('still:language', () => setTimeout(remountLanguage, 0));
})();
