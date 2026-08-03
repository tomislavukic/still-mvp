(() => {
  const $ = selector => document.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  function render() {
    if (!document.body.classList.contains('business-page')) return;
    document.title = t('Still? for Business · Keep every customer promise', 'Still? for Business · Ispunite svako obećanje kupcu');
    const hero = $('.business-hero');
    if (!hero) return;
    const heading = $('h1', hero);
    const lead = $('p', hero);
    if (heading) heading.textContent = t('Keep every customer promise in one shared record.', 'Svako obećanje kupcu u jednom zajedničkom zapisu.');
    if (lead) lead.textContent = t(
      'Publish structured offers, receive payment as the verified seller, and continue the relationship through passports for products, services, subscriptions, bookings and projects.',
      'Objavite strukturirane ponude, primite plaćanje kao verificirani prodavatelj i nastavite odnos kroz putovnice proizvoda, usluga, pretplata, rezervacija i projekata.'
    );
    const content = [
      [t('Issue a useful passport', 'Izdajte korisnu putovnicu'), t('Give the buyer dates, documents, maintenance, renewals and service scope as a lasting structured record.', 'Predajte kupcu datume, dokumente, održavanje, obnove i opseg usluge kao trajan strukturirani zapis.')],
      [t('Make a specific commitment', 'Obećajte konkretno'), t('Delivery, service, repair, response or refund gets a deadline, status and attributable trail.', 'Dostava, servis, popravak, odgovor ili povrat dobivaju rok, status i provjerljiv trag.')],
      [t('Earn reputation and credits', 'Zaradite reputaciju i kredite'), t('Reliable outcomes build reputation and qualifying activity earns business credits. Reputation can never be bought.', 'Pouzdani ishodi grade reputaciju, a kvalificirana aktivnost donosi poslovne kredite. Reputacija se nikada ne može kupiti.')],
      [t('Manage the full lifecycle', 'Upravljajte cijelim životnim ciklusom'), t('Promise templates, passport support, safety alerts, service history and B2B assets continue the relationship long after payment.', 'Predlošci obećanja, podrška putovnice, sigurnosna upozorenja, servisna povijest i B2B imovina nastavljaju odnos dugo nakon plaćanja.')]
    ];
    if (hero.querySelectorAll('.business-points div').length < content.length) hero.querySelector('.business-points')?.appendChild(document.createElement('div'));
    hero.querySelectorAll('.business-points div').forEach((point, index) => {
      if (content[index]) point.innerHTML = `<b>${content[index][0]}</b><span>${content[index][1]}</span>`;
    });
    const trust = $('.business-trust');
    if (trust) trust.innerHTML = `<strong>${t('Still? is not a webshop.', 'Still? nije webshop.')}</strong> ${t(
      'Your company remains the seller or service provider and receives the sale payment through its connected account. Still? structures checkout, passports, evidence and commitments. Operational and commerce tools are available only to verified companies.',
      'Vaša tvrtka ostaje prodavatelj ili pružatelj usluge i prima uplatu prodaje na svoj povezani račun. Still? strukturira naplatu, putovnice, dokaze i obećanja. Operativni i prodajni alati dostupni su samo verificiranim tvrtkama.'
    )}<a id="businessAccessV82" class="business-access-v82" href="#companyPortalV46">${t('Open company sign-in and verification ↓', 'Otvori prijavu i verifikaciju tvrtke ↓')}</a>`;
    let model = $('#businessModelV83');
    if (!model) {
      model = document.createElement('section');
      model.id = 'businessModelV83';
      model.className = 'business-model-v83';
      trust?.insertAdjacentElement('afterend', model);
    }
    model.innerHTML = `
      <div><span>01</span><b>${t('Company publishes', 'Tvrtka objavljuje')}</b><p>${t('A structured Passport Offer with seller identity, price, scope, cancellation and guarantee.', 'Strukturiranu Passport ponudu s identitetom prodavatelja, cijenom, opsegom, otkazivanjem i garancijom.')}</p></div><i>→</i>
      <div><span>02</span><b>${t('Buyer pays the company', 'Kupac plaća tvrtki')}</b><p>${t('Single-seller checkout routes payment to the business connected account; Still? may take a disclosed platform fee.', 'Naplata jednog prodavatelja usmjerava uplatu na povezani račun tvrtke; Still? može uzeti objavljenu platformsku naknadu.')}</p></div><i>→</i>
      <div><span>03</span><b>${t('Passport activates', 'Putovnica se aktivira')}</b><p>${t('Accepted terms, order, commitments, rewards and future support continue in one shared record.', 'Prihvaćeni uvjeti, narudžba, obećanja, nagrade i buduća podrška nastavljaju se u jednom zajedničkom zapisu.')}</p></div>`;
    let commerce = $('#businessCommercePromiseV92');
    if (!commerce) {
      commerce = document.createElement('section');
      commerce.id = 'businessCommercePromiseV92';
      commerce.className = 'business-commerce-promise-v92';
      model.insertAdjacentElement('afterend', commerce);
    }
    commerce.innerHTML = `
      <div><span>PASSPORT COMMERCE</span><h2>${t('Accept payment without becoming an anonymous webshop.', 'Primajte plaćanja bez pretvaranja u anonimni webshop.')}</h2><p>${t('Sell a service, product, booking, subscription or project through a durable relationship—not a disposable order confirmation.', 'Prodajte uslugu, proizvod, rezervaciju, pretplatu ili projekt kroz trajan odnos—ne kroz potrošnu potvrdu narudžbe.')}</p></div>
      <div class="bcv92-grid"><article><b>${t('Your offer, your terms', 'Vaša ponuda, vaši uvjeti')}</b><p>${t('Set the price, tax treatment, availability, fulfilment, cancellation, warranty and buyer reward.', 'Postavite cijenu, porezni tretman, dostupnost, izvršenje, otkazivanje, jamstvo i nagradu kupca.')}</p></article><article><b>${t('Your payment account', 'Vaš račun naplate')}</b><p>${t('After verification, connect a supported payment-provider account. Your business remains the named seller and receives sale proceeds.', 'Nakon verifikacije povežite podržani račun pružatelja naplate. Vaša tvrtka ostaje imenovani prodavatelj i prima prihod prodaje.')}</p></article><article><b>${t('One operational record', 'Jedan operativni zapis')}</b><p>${t('Payment activates the buyer passport and your fulfilment queue. Completion creates attributable rewards and reputation.', 'Plaćanje aktivira putovnicu kupca i vaš red izvršenja. Dovršetak stvara pripisive nagrade i reputaciju.')}</p></article></div>
      <a href="#companyPortalV46">${t('Verify the company and publish an offer', 'Verificiraj tvrtku i objavi ponudu')} →</a>`;
    let rewards = $('#businessRewardsPromiseV91');
    if (!rewards) {
      rewards = document.createElement('section');
      rewards.id = 'businessRewardsPromiseV91';
      rewards.className = 'business-rewards-promise-v91';
      commerce.insertAdjacentElement('afterend', rewards);
    }
    rewards.innerHTML = `
      <div class="v91-company-rewards-head"><span>STILL? REWARDS</span><h2>${t('Reliable service creates measurable value.', 'Pouzdana usluga stvara mjerljivu vrijednost.')}</h2><p>${t('Verified companies earn reputation and business credits from attributable outcomes, while giving buyers reasons to keep participating responsibly.', 'Verificirane tvrtke zarađuju reputaciju i poslovne kredite kroz dokazive ishode, a kupcima daju razlog za odgovorno sudjelovanje.')}</p></div>
      <div class="v91-company-rewards-grid">
        <article><span>01</span><b>${t('Earn reputation', 'Zaradite reputaciju')}</b><p>${t('Timely responses, completed services and kept commitments improve a public, evidence-based score. It cannot be purchased.', 'Pravodobni odgovori, dovršene usluge i ispunjena obećanja poboljšavaju javnu ocjenu temeljenu na dokazima. Ne može se kupiti.')}</p></article>
        <article><span>02</span><b>${t('Earn business credits', 'Zaradite poslovne kredite')}</b><p>${t('Qualifying cases and completed outcomes create spendable credits. 500 credits convert to €5 internal Still? platform credit; external billing is not connected yet.', 'Kvalificirani slučajevi i dovršeni ishodi stvaraju iskoristive kredite. 500 kredita pretvara se u 5 € internog Still? kredita; vanjska naplata još nije povezana.')}</p></article>
        <article><span>03</span><b>${t('Create buyer benefits', 'Kreirajte pogodnosti kupaca')}</b><p>${t('Publish discounts, free services, priority support or extended returns. Buyers exchange earned points for a one-time code your team verifies.', 'Objavite popuste, besplatne usluge, prioritetnu podršku ili dulje povrate. Kupci zamjenjuju bodove za jednokratni kod koji vaš tim potvrđuje.')}</p></article>
      </div>
      <div class="v91-company-rewards-note"><b>${t('The exchange is transparent.', 'Razmjena je transparentna.')}</b><span>${t('Buyers earn points through reliable participation. Companies fund the benefit and earn credits through real outcomes. Published terms always apply.', 'Kupci zarađuju bodove pouzdanim sudjelovanjem. Tvrtke financiraju pogodnost i zarađuju kredite stvarnim ishodima. Uvijek vrijede objavljeni uvjeti.')}</span><a href="#companyPortalV46">${t('Open the company workspace →', 'Otvori poslovni radni prostor →')}</a></div>`;
    const footer = $('.business-footer');
    if (footer) footer.textContent = `Still? for Business · ${t('Shared commitments, verified outcomes', 'Zajednička obećanja, provjereni ishodi')}`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
  $('#language')?.addEventListener('change', () => setTimeout(render, 0));
})();
