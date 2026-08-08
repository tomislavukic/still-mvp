(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  function render() {
    if (!document.body.classList.contains('business-page')) return;

    document.title = t('Still? CompanyOS · Coming soon', 'Still? CompanyOS · Uskoro');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(
      'CompanyOS is the business side of Still?. BuyerOS is launching first; existing company access remains available.',
      'CompanyOS je poslovna strana Still? platforme. BuyerOS izlazi prvi; postojeći pristup za tvrtke ostaje dostupan.'
    ));

    const hero = $('.business-hero');
    if (!hero) return;
    const kicker = $('.business-kicker', hero);
    const heading = $('h1', hero);
    const lead = $('p', hero);
    if (kicker) kicker.textContent = 'COMPANYOS · COMING SOON';
    if (heading) heading.textContent = t('Built for the businesses behind what people own.', 'Za tvrtke koje stoje iza onoga što ljudi posjeduju.');
    if (lead) lead.textContent = t(
      'BuyerOS is the public launch focus. CompanyOS is being prepared as the verified operating workspace for passports, service, fulfilment, commitments and the ownership relationship after the sale.',
      'BuyerOS je fokus javnog lansiranja. CompanyOS se priprema kao verificirani operativni prostor za putovnice, servis, izvršenje, obećanja i odnos vlasništva nakon prodaje.'
    );

    const points = [
      [t('BuyerOS launches first', 'BuyerOS izlazi prvi'), t('Still? first proves daily value to ordinary people by organizing what they already own.', 'Still? prvo dokazuje svakodnevnu vrijednost običnim ljudima organiziranjem onoga što već posjeduju.')],
      [t('CompanyOS connects later', 'CompanyOS se povezuje kasnije'), t('Verified companies can enrich buyer-owned passports with trusted product, service and fulfilment data.', 'Verificirane tvrtke mogu obogatiti putovnice u vlasništvu kupca pouzdanim podacima o proizvodu, servisu i izvršenju.')],
      [t('Separate by design', 'Odvojeno po dizajnu'), t('Business operations stay inside CompanyOS. Personal ownership data stays inside BuyerOS unless the buyer explicitly shares it.', 'Poslovne operacije ostaju unutar CompanyOS-a. Osobni podaci o vlasništvu ostaju unutar BuyerOS-a osim kada ih kupac izričito podijeli.')]
    ];
    const pointWrap = $('.business-points', hero);
    if (pointWrap) {
      pointWrap.innerHTML = points.map(([title, body]) => `<div><b>${title}</b><span>${body}</span></div>`).join('');
    }

    const trust = $('.business-trust');
    if (trust) trust.innerHTML = `<strong>${t('CompanyOS public launch is coming next.', 'Javno lansiranje CompanyOS-a dolazi sljedeće.')}</strong> ${t(
      'Existing company accounts, verification and operational tools remain available during this transition.',
      'Postojeći računi tvrtki, verifikacija i operativni alati ostaju dostupni tijekom ove tranzicije.'
    )}<a id="businessAccessV82" class="business-access-v82" href="#companyPortalV46">${t('Existing company? Open workspace ↓', 'Postojeća tvrtka? Otvori radni prostor ↓')}</a>`;

    const oldSections = ['businessModelV83', 'businessCommercePromiseV92', 'businessRewardsPromiseV91'];
    oldSections.forEach(id => document.getElementById(id)?.remove());

    const footer = $('.business-footer');
    if (footer) footer.textContent = `Still? CompanyOS · ${t('Coming soon · Existing access remains available', 'Uskoro · Postojeći pristup ostaje dostupan')}`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
  $('#language')?.addEventListener('change', () => setTimeout(render, 0));
})();
