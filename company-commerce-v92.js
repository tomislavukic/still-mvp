(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const money = (cents, currency = 'EUR') => new Intl.NumberFormat(isHr() ? 'hr-HR' : 'en-GB', { style: 'currency', currency }).format((Number(cents) || 0) / 100);
  let root;
  let state = { profile: null, payments: null, offers: [], orders: [], requests: [] };

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || data.error || `HTTP ${response.status}`), { status: response.status, data });
    return data;
  }

  function typeOptions() {
    return `<option value="service">${t('Service', 'Usluga')}</option><option value="product">${t('Product', 'Proizvod')}</option><option value="booking">${t('Booking', 'Rezervacija')}</option><option value="subscription">${t('Subscription', 'Pretplata')}</option><option value="project">${t('Project', 'Projekt')}</option><option value="rental">${t('Rental', 'Najam')}</option>`;
  }

  function mount() {
    if ($('#companyCommerceV92')) return;
    const portal = $('#companyPortalV46');
    if (!portal || !document.body.classList.contains('company-authenticated')) return setTimeout(mount, 250);
    root = document.createElement('section');
    root.id = 'companyCommerceV92';
    root.className = 'cc92';
    root.innerHTML = `<div class="cc92-loading">${t('Opening Passport Commerce…', 'Otvaranje Passport Commercea…')}</div>`;
    portal.insertAdjacentElement('afterend', root);
    root.addEventListener('click', click);
    root.addEventListener('change', click);
    root.addEventListener('submit', submit);
    load();
  }

  async function load() {
    try {
      const [profile, offers, orders, requests] = await Promise.all([
        api('/api/v1/business/commerce/profile'),
        api('/api/v1/business/commerce/offers'),
        api('/api/v1/business/commerce/orders'),
        api('/api/v1/business/commerce/requests')
      ]);
      state = { ...profile, offers: offers.offers || [], orders: orders.orders || [], requests: requests.requests || [] };
      render();
    } catch (error) {
      root.innerHTML = `<div class="cc92-error"><b>${t('Passport Commerce is temporarily unavailable.', 'Passport Commerce je trenutačno nedostupan.')}</b><p>${esc(error.message)}</p><button data-cc92-refresh>${t('Try again', 'Pokušaj ponovno')}</button></div>`;
    }
  }

  function render() {
    const profile = state.profile || {};
    const ready = profile.chargesEnabled && profile.payoutsEnabled;
    root.innerHTML = `
      <header class="cc92-head">
        <div><span>PASSPORT COMMERCE</span><h2>${t('Sell the promise—not just the item.', 'Prodajte obećanje—ne samo predmet.')}</h2><p>${t('Publish a structured service or product offer. The buyer pays your verified business and automatically receives a lasting passport. Still? takes only the disclosed platform fee.', 'Objavite strukturiranu ponudu usluge ili proizvoda. Kupac plaća vašoj verificiranoj tvrtki i automatski dobiva trajnu putovnicu. Still? uzima samo objavljenu platformski naknadu.')}</p></div>
        <div class="cc92-payment ${ready ? 'ready' : ''}"><small>${t('PAYMENTS', 'NAPLATA')}</small><b>${ready ? t('Ready for live payments', 'Spremno za živu naplatu') : state.payments?.configured ? t('Finish business onboarding', 'Dovršite povezivanje tvrtke') : t('Platform provider not configured', 'Pružatelj platforme nije konfiguriran')}</b><span>${ready ? t('Payments go to your connected account.', 'Plaćanja idu na vaš povezani račun.') : state.payments?.note || ''}</span><button data-cc92-connect>${ready ? t('Review payment account', 'Pregledaj račun naplate') : t('Connect payment account', 'Poveži račun naplate')}</button></div>
      </header>
      <div class="cc92-role"><b>${t('Your business remains the seller or provider.', 'Vaša tvrtka ostaje prodavatelj ili pružatelj.')}</b><span>${t('You set the price and terms, issue the invoice, fulfil the order, handle cancellation, refund and warranty, and receive the sale proceeds. Still? verifies identity, structures checkout, activates the passport and preserves evidence.', 'Vi određujete cijenu i uvjete, izdajete račun, izvršavate narudžbu, vodite otkazivanje, povrat i jamstvo te primate prihod od prodaje. Still? verificira identitet, strukturira naplatu, aktivira putovnicu i čuva dokaze.')}</span></div>
      <div class="cc92-tabs"><button class="active" data-cc92-tab="requests">${t('Buyer requests', 'Zahtjevi kupaca')} <b>${state.requests.length}</b></button><button data-cc92-tab="offers">${t('Offers', 'Ponude')} <b>${state.offers.length}</b></button><button data-cc92-tab="orders">${t('Orders', 'Narudžbe')} <b>${state.orders.length}</b></button><button data-cc92-tab="profile">${t('Seller profile', 'Profil prodavatelja')}</button></div>
      <div id="cc92Panel">${requestsPanel()}</div>`;
  }

  function requestBudget(request) {
    if (request.budgetMinCents == null && request.budgetMaxCents == null) return t('Budget not fixed', 'Budžet nije zadan');
    if (request.budgetMinCents != null && request.budgetMaxCents != null) return `${money(request.budgetMinCents)}–${money(request.budgetMaxCents)}`;
    return request.budgetMinCents != null ? `${t('From', 'Od')} ${money(request.budgetMinCents)}` : `${t('Up to', 'Do')} ${money(request.budgetMaxCents)}`;
  }

  function quoteForm(request) {
    return `<details class="cc93-quote-box"><summary>${t('Prepare a structured quote', 'Pripremi strukturiranu ponudu')} →</summary><form data-cc93-quote="${esc(request.publicId)}">
      <div class="cc93-quote-intro"><b>${t('Promise only what your business can deliver.', 'Obećajte samo ono što vaša tvrtka može izvršiti.')}</b><span>${t('The buyer compares price, fulfilment, timing, cancellation, warranty and rewards. If chosen, this becomes their private checkout offer and lasting passport.', 'Kupac uspoređuje cijenu, izvršenje, rok, otkazivanje, jamstvo i nagrade. Ako vas odabere, ovo postaje njegova privatna ponuda za naplatu i trajna putovnica.')}</span></div>
      <div class="cc92-fields"><label>${t('Quote title', 'Naslov ponude')}<input name="title" value="${esc(request.title)}" required maxlength="180"></label><label>${t('Total price · EUR', 'Ukupna cijena · EUR')}<input name="price" type="number" min="0.50" step="0.01" inputmode="decimal" required></label></div>
      <label>${t('Your proposed result and scope', 'Predloženi rezultat i opseg')}<textarea name="description" minlength="10" maxlength="3000" required placeholder="${t('State exactly what the buyer receives.', 'Točno navedite što kupac dobiva.')}"></textarea></label>
      <div class="cc92-fields"><label>${t('Fulfilment', 'Izvršenje')}<select name="fulfillmentType"><option value="appointment">${t('Appointment', 'Termin')}</option><option value="on_site">${t('On-site', 'Na lokaciji')}</option><option value="delivery">${t('Delivery', 'Dostava')}</option><option value="pickup">${t('Pickup', 'Preuzimanje')}</option><option value="digital">${t('Digital', 'Digitalno')}</option><option value="agreed">${t('As agreed', 'Prema dogovoru')}</option></select></label><label>${t('Estimated duration', 'Procijenjeno trajanje')}<input name="estimatedDuration" maxlength="120" placeholder="${t('e.g. 3 working days', 'npr. 3 radna dana')}"></label></div>
      <label>${t('Fulfilment details', 'Detalji izvršenja')}<input name="fulfillmentDetails" maxlength="2000" placeholder="${t('Where, when and how', 'Gdje, kada i kako')}"></label>
      <label>${t('Cancellation / return terms', 'Uvjeti otkazivanja / povrata')}<textarea name="cancellationTerms" minlength="5" maxlength="3000" required></textarea></label>
      <label>${t('Warranty or service guarantee', 'Jamstvo ili garancija usluge')}<textarea name="warrantyTerms" maxlength="2000"></textarea></label>
      <div class="cc92-fields"><label>${t('Buyer reward points', 'Bodovi nagrade kupca')}<input name="rewardPoints" type="number" min="0" max="1000" value="10"></label><label class="cc92-check"><input name="taxIncluded" type="checkbox" checked><span>${t('Price includes applicable tax', 'Cijena uključuje primjenjivi porez')}</span></label></div>
      <button>${t('Send private Passport Quote', 'Pošalji privatnu Passport ponudu')}</button><small data-cc93-message></small>
    </form></details>`;
  }

  function requestsPanel() {
    const rows = state.requests || [];
    return `<div class="cc92-card cc93-requests"><header><div><span>VERIFIED REQUEST BOARD</span><h3>${t('Answer real buyer needs.', 'Odgovorite na stvarne potrebe kupaca.')}</h3><p>${t('Buyers publish a structured need without exposing their identity or email. Only verified businesses can view this board and respond.', 'Kupci objavljuju strukturiranu potrebu bez otkrivanja identiteta ili e-pošte. Samo verificirane tvrtke mogu vidjeti ovu ploču i odgovoriti.')}</p></div><button data-cc92-refresh>${t('Refresh', 'Osvježi')}</button></header>${rows.length ? rows.map(request => `<article class="cc93-request"><div class="cc93-request-head"><div><span>${esc(request.kind)} · ${esc(request.publicId)}</span><h4>${esc(request.title)}</h4></div><strong>${requestBudget(request)}</strong></div><p>${esc(request.description)}</p><div class="cc93-request-meta">${request.location ? `<span><b>${t('Area', 'Područje')}</b>${esc(request.location)}</span>` : ''}${request.desiredBy ? `<span><b>${t('Needed by', 'Potrebno do')}</b>${esc(request.desiredBy)}</span>` : ''}<span><b>${t('Responses', 'Odgovori')}</b>${request.quoteCount || 0}</span></div>${request.mustHaves ? `<div class="cc93-must"><b>${t('Buyer must-haves', 'Obavezni uvjeti kupca')}</b><p>${esc(request.mustHaves)}</p></div>` : ''}${request.ownQuote ? `<div class="cc93-sent">✓ ${t('Your private quote was submitted.', 'Vaša privatna ponuda je poslana.')} <b>${esc(request.ownQuote.status)}</b></div>` : quoteForm(request)}</article>`).join('') : `<div class="cc92-empty"><b>${t('No open buyer requests right now.', 'Trenutačno nema otvorenih zahtjeva kupaca.')}</b><p>${t('New requests will appear here without exposing buyer contact details.', 'Novi zahtjevi pojavit će se ovdje bez otkrivanja kontakata kupca.')}</p></div>`}</div>`;
  }

  function offersPanel() {
    return `<div class="cc92-offers-grid">
      <form id="cc92OfferForm" class="cc92-card cc92-form">
        <div><span>NEW PASSPORT OFFER</span><h3>${t('Publish an offer buyers can trust.', 'Objavite ponudu kojoj kupci mogu vjerovati.')}</h3></div>
        <div class="cc92-fields"><label>${t('Type', 'Vrsta')}<select name="kind">${typeOptions()}</select></label><label>${t('Price in EUR', 'Cijena u EUR')}<input name="price" type="number" min="0.50" step="0.01" required inputmode="decimal"></label></div>
        <label>${t('Offer title', 'Naslov ponude')}<input name="title" required maxlength="180" placeholder="${t('e.g. Annual air-conditioner service', 'npr. Godišnji servis klima-uređaja')}"></label>
        <label>${t('Clear description', 'Jasan opis')}<textarea name="description" required minlength="10" maxlength="3000" placeholder="${t('What the buyer is purchasing and what result to expect', 'Što kupac kupuje i koji rezultat može očekivati')}"></textarea></label>
        <div class="cc92-fields"><label>${t('Fulfilment', 'Izvršenje')}<select name="fulfillmentType"><option value="appointment">${t('Appointment', 'Termin')}</option><option value="on_site">${t('On-site', 'Na lokaciji')}</option><option value="delivery">${t('Delivery', 'Dostava')}</option><option value="pickup">${t('Pickup', 'Preuzimanje')}</option><option value="digital">${t('Digital', 'Digitalno')}</option><option value="agreed">${t('As agreed', 'Prema dogovoru')}</option></select></label><label>${t('Availability', 'Dostupna količina')}<input name="quantityAvailable" type="number" min="0" placeholder="${t('Empty = unlimited', 'Prazno = neograničeno')}"></label></div>
        <label>${t('Fulfilment details', 'Detalji izvršenja')}<input name="fulfillmentDetails" maxlength="2000" placeholder="${t('Where, when and how', 'Gdje, kada i kako')}"></label>
        <div class="cc92-fields"><label>${t('What is included', 'Što je uključeno')}<textarea name="includes" maxlength="2000"></textarea></label><label>${t('What is excluded', 'Što nije uključeno')}<textarea name="exclusions" maxlength="2000"></textarea></label></div>
        <label>${t('Cancellation / return terms', 'Uvjeti otkazivanja / povrata')}<textarea name="cancellationTerms" required minlength="5" maxlength="3000" placeholder="${t('State deadlines, method and any permitted charge', 'Navedite rokove, način i moguću dopuštenu naknadu')}"></textarea></label>
        <label>${t('Warranty or service guarantee', 'Jamstvo ili garancija usluge')}<textarea name="warrantyTerms" maxlength="2000"></textarea></label>
        <div class="cc92-fields"><label>${t('Estimated duration', 'Procijenjeno trajanje')}<input name="estimatedDuration" maxlength="120" placeholder="${t('e.g. 2 hours / 5 working days', 'npr. 2 sata / 5 radnih dana')}"></label><label>${t('Buyer reward points', 'Bodovi nagrade kupca')}<input name="rewardPoints" type="number" min="0" max="1000" value="10"></label></div>
        <label class="cc92-check"><input name="taxIncluded" type="checkbox" checked><span>${t('Displayed price includes applicable tax', 'Prikazana cijena uključuje primjenjivi porez')}</span></label>
        <label class="cc92-check"><input name="publish" type="checkbox" checked><span>${t('Publish immediately', 'Objavi odmah')}</span></label>
        <button>${t('Create Passport Offer', 'Izradi Passport ponudu')}</button><small id="cc92OfferMessage"></small>
      </form>
      <div class="cc92-card cc92-list"><header><div><span>LIVE CATALOGUE</span><h3>${t('Your structured offers', 'Vaše strukturirane ponude')}</h3></div><button data-cc92-refresh>${t('Refresh', 'Osvježi')}</button></header>${state.offers.length ? state.offers.map(offerRow).join('') : `<div class="cc92-empty"><b>${t('No Passport Offers yet.', 'Još nema Passport ponuda.')}</b><p>${t('Create one service or high-value product offer to begin.', 'Izradite jednu ponudu usluge ili vrijednog proizvoda za početak.')}</p></div>`}</div>
    </div>`;
  }

  function offerRow(offer) {
    const next = offer.status === 'published' ? 'paused' : 'published';
    return `<article class="cc92-offer"><div><span>${esc(offer.kind)} · ${esc(offer.publicId)}</span><b>${esc(offer.title)}</b><small>${esc(offer.fulfillmentType)} · +${offer.rewardPoints} ${t('buyer points', 'bodova kupca')}</small></div><strong>${money(offer.amountCents, offer.currency)}</strong><em class="${esc(offer.status)}">${esc(offer.status)}</em><button data-cc92-offer-status="${esc(offer.publicId)}" data-status="${next}">${next === 'paused' ? t('Pause', 'Pauziraj') : t('Publish', 'Objavi')}</button></article>`;
  }

  function partyAddress(profile = {}) {
    return [profile.addressLine1, profile.addressLine2, [profile.postalCode, profile.city].filter(Boolean).join(' '), profile.region, profile.countryCode].filter(Boolean).join(', ');
  }

  function decorateOrderContacts() {
    const articles = [...root.querySelectorAll('.cc92-orders article')];
    articles.forEach((article, index) => {
      const buyer = state.orders[index]?.parties?.buyer;
      if (!buyer) return;
      const contact = document.createElement('div');
      contact.className = 'cc104-order-contact';
      contact.innerHTML = `<span>${t('BUYER CONTACT FOR THIS ORDER', 'KONTAKT KUPCA ZA OVU NARUDŽBU')}</span><b>${esc(buyer.name)} · ${esc(buyer.phone)} · ${esc(buyer.email)}</b><small>${esc(partyAddress(buyer) || t('No delivery address required', 'Adresa dostave nije potrebna'))}</small>${buyer.deliveryInstructions ? `<p>${esc(buyer.deliveryInstructions)}</p>` : ''}`;
      article.append(contact);
    });
  }

  function ordersPanel() {
    const rows = state.orders || [];
    return `<div class="cc92-card cc92-orders"><header><div><span>ORDER → PASSPORT → OUTCOME</span><h3>${t('Orders and fulfilment', 'Narudžbe i izvršenje')}</h3></div><button data-cc92-refresh>${t('Refresh', 'Osvježi')}</button></header>${rows.length ? rows.map(order => `<article><div><span>${esc(order.publicId)} · ${esc(order.provider)}</span><b>${esc(order.offer?.title || '')}</b><small>${order.passportId ? `${t('Passport', 'Putovnica')} ${esc(order.passportId)}` : t('Awaiting payment confirmation', 'Čeka potvrdu plaćanja')}</small></div><strong>${money(order.amountCents, order.currency)}</strong><em class="${esc(order.status)}">${esc(order.status.replaceAll('_', ' '))}</em>${['paid', 'accepted', 'in_progress'].includes(order.status) ? `<select data-cc92-order="${esc(order.publicId)}"><option value="">${t('Update status…', 'Ažuriraj status…')}</option><option value="accepted">${t('Accept order', 'Prihvati narudžbu')}</option><option value="in_progress">${t('Mark in progress', 'Označi u tijeku')}</option><option value="completed">${t('Complete and reward', 'Dovrši i nagradi')}</option><option value="disputed">${t('Mark disputed', 'Označi spornim')}</option></select>` : ''}</article>`).join('') : `<div class="cc92-empty"><b>${t('No orders yet.', 'Još nema narudžbi.')}</b><p>${t('Orders appear after a buyer starts checkout.', 'Narudžbe se pojavljuju nakon što kupac pokrene naplatu.')}</p></div>`}</div>`;
  }

  function profilePanel() {
    const p = state.profile || {};
    return `<form id="cc92ProfileForm" class="cc92-card cc92-profile"><div><span>VERIFIED SELLER PROFILE</span><h3>${t('Identity shown before every payment', 'Identitet prikazan prije svakog plaćanja')}</h3><p>${t('Use the legal or customer-facing name buyers will recognize. Verification remains tied to your company account.', 'Koristite pravni ili kupcima poznat naziv. Verifikacija ostaje vezana uz račun vaše tvrtke.')}</p></div><label>${t('Display name', 'Naziv za prikaz')}<input name="displayName" value="${esc(p.displayName || '')}" required maxlength="180"></label><label>${t('Seller summary', 'Sažetak prodavatelja')}<textarea name="summary" maxlength="1000">${esc(p.summary || '')}</textarea></label><label>${t('Support email', 'E-pošta podrške')}<input name="supportEmail" type="email" value="${esc(p.supportEmail || '')}" maxlength="254"></label><button>${t('Save seller profile', 'Spremi profil prodavatelja')}</button><small id="cc92ProfileMessage"></small></form>`;
  }

  async function submit(event) {
    const quoteRequest = event.target.dataset.cc93Quote;
    if (quoteRequest) {
      event.preventDefault();
      const form = event.target;
      const button = $('button', form);
      const message = $('[data-cc93-message]', form);
      const values = Object.fromEntries(new FormData(form));
      button.disabled = true;
      message.textContent = t('Sending private quote…', 'Slanje privatne ponude…');
      try {
        await api(`/api/v1/business/commerce/requests/${encodeURIComponent(quoteRequest)}/quotes`, { method: 'POST', body: JSON.stringify({ ...values, amountCents: Math.round(Number(values.price) * 100), taxIncluded: !!form.taxIncluded.checked }) });
        await load();
      } catch (error) { message.textContent = error.message; button.disabled = false; }
      return;
    }
    if (event.target.id === 'cc92OfferForm') {
      event.preventDefault();
      const form = event.target;
      const message = $('#cc92OfferMessage', root);
      const values = Object.fromEntries(new FormData(form));
      const body = { ...values, amountCents: Math.round(Number(values.price) * 100), taxIncluded: !!form.taxIncluded.checked, status: form.publish.checked ? 'published' : 'draft' };
      message.textContent = t('Creating offer…', 'Izrada ponude…');
      try {
        await api('/api/v1/business/commerce/offers', { method: 'POST', body: JSON.stringify(body) });
        form.reset();
        form.taxIncluded.checked = true;
        form.publish.checked = true;
        message.textContent = t('Offer created and ready for buyers.', 'Ponuda je izrađena i spremna za kupce.');
        await load();
      } catch (error) { message.textContent = error.message; }
    }
    if (event.target.id === 'cc92ProfileForm') {
      event.preventDefault();
      const message = $('#cc92ProfileMessage', root);
      try {
        await api('/api/v1/business/commerce/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
        message.textContent = t('Seller profile saved.', 'Profil prodavatelja je spremljen.');
        await load();
      } catch (error) { message.textContent = error.message; }
    }
  }

  async function click(event) {
    const button = event.target.closest('button');
    const select = event.target.closest('[data-cc92-order]');
    if (select && select.value) {
      select.disabled = true;
      try { await api(`/api/v1/business/commerce/orders/${encodeURIComponent(select.dataset.cc92Order)}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await load(); } catch (error) { alert(error.message); select.disabled = false; }
      return;
    }
    if (!button) return;
    if (button.dataset.cc92Refresh !== undefined) return load();
    if (button.dataset.cc92Tab) {
      root.querySelectorAll('[data-cc92-tab]').forEach(item => item.classList.toggle('active', item === button));
      $('#cc92Panel', root).innerHTML = button.dataset.cc92Tab === 'requests' ? requestsPanel() : button.dataset.cc92Tab === 'orders' ? ordersPanel() : button.dataset.cc92Tab === 'profile' ? profilePanel() : offersPanel();
      if (button.dataset.cc92Tab === 'orders') decorateOrderContacts();
      return;
    }
    if (button.dataset.cc92OfferStatus) {
      button.disabled = true;
      try { await api(`/api/v1/business/commerce/offers/${encodeURIComponent(button.dataset.cc92OfferStatus)}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) }); await load(); } catch (error) { alert(error.message); button.disabled = false; }
      return;
    }
    if (button.dataset.cc92Connect !== undefined) {
      button.disabled = true;
      try {
        const data = await api('/api/v1/business/commerce/onboarding', { method: 'POST', body: '{}' });
        location.href = data.onboardingUrl;
      } catch (error) {
        alert(error.status === 503 ? t('The platform owner must configure Stripe Connect credentials before businesses can onboard.', 'Vlasnik platforme mora konfigurirati Stripe Connect pristupne podatke prije povezivanja tvrtki.') : error.message);
        button.disabled = false;
      }
    }
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mount, { once: true }) : mount();
})();
