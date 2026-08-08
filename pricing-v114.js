(() => {
  const $ = selector => document.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  function render() {
    document.documentElement.lang = isHr() ? 'hr' : 'en';
    document.title = t('Still · Pricing', 'Still · Planovi');
    $('#pricingContentV114').innerHTML = `
      <section class="pv114-hero">
        <span class="sp114-kicker">${t('SIMPLE BY DESIGN', 'JEDNOSTAVNO PO DIZAJNU')}</span>
        <h1>${t('Add everything you own.', 'Dodaj sve što posjeduješ.')}</h1>
        <p>${t('Still does not punish the core habit. The free foundation is for ownership; future paid value is convenience, automation and intelligence.', 'Still ne kažnjava osnovnu naviku. Besplatna osnova služi vlasništvu; buduća plaćena vrijednost su praktičnost, automatizacija i inteligencija.')}</p>
      </section>
      <section class="pv114-plans" aria-label="${t('Still plans', 'Still planovi')}">
        <article class="pv114-plan">
          <span>${t('AVAILABLE', 'DOSTUPNO')}</span>
          <h2>Still Free</h2>
          <div><p>${t('A genuinely useful place for what you own. No arbitrary public limit is introduced here.', 'Stvarno korisno mjesto za ono što posjeduješ. Ovdje se ne uvodi proizvoljno javno ograničenje.')}</p><ul><li>${t('Ownership records', 'Zapisi vlasništva')}</li><li>${t('Warranties and reminders', 'Jamstva i podsjetnici')}</li><li>${t('Basic timeline', 'Osnovna vremenska crta')}</li><li>${t('QR identity', 'QR identitet')}</li><li>${t('Company-issued Passports', 'Putovnice koje izdaju tvrtke')}</li><li>${t('Basic sharing', 'Osnovno dijeljenje')}</li></ul><a href="/#ownershipHubV83">${t('Start free', 'Počni besplatno')} →</a></div>
        </article>
        <article class="pv114-plan">
          <span>${t('PLANNED', 'PLANIRANO')}</span>
          <h2>Still+</h2>
          <div><p>${t('Planned convenience and intelligence. These capabilities are not presented as live, and no exact price is published yet.', 'Planirana praktičnost i inteligencija. Te mogućnosti nisu predstavljene kao aktivne, a točna cijena još nije objavljena.')}</p><ul><li>${t('Automatic receipt understanding', 'Automatsko razumijevanje računa')}</li><li>${t('Purchase email import', 'Uvoz e-pošte o kupnji')}</li><li>${t('Automatic organization', 'Automatska organizacija')}</li><li>${t('Ask Still', 'Pitaj Still')}</li><li>${t('Advanced search', 'Napredno pretraživanje')}</li><li>${t('Family sharing', 'Obiteljsko dijeljenje')}</li><li>${t('Smart reminders', 'Pametni podsjetnici')}</li><li>${t('Encrypted archive and bulk import', 'Šifrirana arhiva i skupni uvoz')}</li></ul></div>
        </article>
        <article class="pv114-plan">
          <span>${t('EARLY ACCESS', 'RANI PRISTUP')}</span>
          <h2>Still for Business</h2>
          <div><p>${t('Support products and customers after the sale. Real access is controlled by the existing company account and verification flow; business pricing is not finalized.', 'Podržite proizvode i kupce nakon prodaje. Stvarni pristup kontroliraju postojeći račun tvrtke i postupak verifikacije; poslovne cijene nisu finalizirane.')}</p><ul><li>${t('Verified Passport issuance', 'Izdavanje verificiranih Putovnica')}</li><li>${t('Service and repair workflows', 'Radni tokovi servisa i popravaka')}</li><li>${t('Warranty handling', 'Rješavanje jamstva')}</li><li>${t('Product history updates', 'Ažuriranje povijesti proizvoda')}</li><li>${t('Customer support workspace', 'Radni prostor podrške kupcima')}</li></ul><a href="/company.html#early-access">${t('Request Early Access', 'Zatraži rani pristup')} →</a></div>
        </article>
      </section>
      <p class="pv114-note">${t('Capabilities marked Planned are product direction, not a promise of current availability. Still Free uses the ownership tools already present in the platform.', 'Mogućnosti označene kao Planirano predstavljaju smjer proizvoda, a ne obećanje trenutačne dostupnosti. Still Free koristi alate vlasništva koji već postoje na platformi.')}</p>`;
  }

  function start() {
    const stored = localStorage.getItem('still-language');
    if (stored === 'hr' || stored === 'en') $('#language').value = stored;
    $('#language')?.addEventListener('change', event => { localStorage.setItem('still-language', event.target.value); render(); });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
