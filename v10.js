(() => {
  const $ = selector => document.querySelector(selector);

  const copy = {
    en: {
      navCheck: 'Check', navRecent: 'My purchases', navHow: 'How it works',
      heroEyebrow: 'Check', heroTitle: 'Can I <span>still</span><br>do something?',
      heroLead: 'Returns and warranty rights, without the policy maze.',
      shareStill: 'Share Still?', privacy: '🔒 Account optional. Checks stay private in this browser.',
      check: 'Check', purchase: 'Check your purchase', scan: '📷 Scan / import receipt',
      scanHelp: 'On-device recognition when available. You confirm the result.',
      market: 'Country / market', buyMethod: 'How did you buy it?',
      online: 'Online / distance purchase', physical: 'Physical store',
      findRetailer: 'Find retailer', findHelp: 'Type a retailer name to filter the existing store list.',
      storeSource: 'Store / source', store: 'Store', purchaseDate: 'Purchase or delivery date',
      policyType: 'Policy type', returnDays: 'Return window (days)', item: 'Item', optional: 'optional',
      checkReturn: 'Check return window', policyStarts: 'Policy starts', windowUsed: 'Window used',
      verify: 'Verify with official source ↗', reminder: '📅 Add return reminder',
      reminderHelp: 'Creates a calendar event.', sendResult: 'Send this result', email: 'Email',
      copyResult: 'Copy result link', moreApps: 'More apps…', another: 'Check another purchase',
      official: 'Official-source verification', recent: 'Recent',
      recentTitle: 'Your browser remembers the useful stuff.', clearRecent: 'Clear recent checks',
      howTitle: 'Useful, without pretending.', step1: 'Enter or scan',
      step1p: 'Receipt recognition only suggests details. You review them.', step2: 'Calculate',
      step2p: 'Still? keeps legal rights separate from voluntary retailer policies.',
      step3: 'Verify and act', step3p: 'Open the official source before relying on a deadline or warranty right.',
      footer: 'Simple. Private. Useful.', return: 'Return', warranty: 'Warranty',
      questionReturn: 'Check a return', questionWarranty: 'Check warranty rights',
      goWarranty: 'Check warranty rights', warrantyInfo: 'Warranty guidance',
      warrantyNote: 'For goods bought from a professional seller in the EU, a minimum two-year legal guarantee generally applies when goods are faulty or not as advertised. National rules may provide more protection. This differs from a voluntary commercial warranty.',
      warrantyUS: 'U.S. warranty coverage depends on the product, seller or manufacturer warranty, and applicable law. Still? does not invent a universal warranty period.',
      eligible: 'Within the standard legal-guarantee period', expired: 'Standard two-year period has passed',
      daysRemain: days => `${days} days remain in the standard period`,
      passed: days => `Standard period passed ${days} days ago`,
      deadline: date => `Standard period ends: ${date}`, select: 'Check the written warranty',
      euStat: 'EU statutory consumer right', dateRequired: 'Choose the purchase or delivery date first.'
    },
    hr: {
      navCheck: 'Provjeri', navRecent: 'Moje kupnje', navHow: 'Kako radi',
      heroEyebrow: 'Provjera', heroTitle: 'Mogu li ovo <span>još</span><br>riješiti?',
      heroLead: 'Povrati i prava iz jamstva, bez lutanja kroz pravila.',
      shareStill: 'Podijeli Still?', privacy: '🔒 Račun nije obavezan. Provjere ostaju privatne u ovom pregledniku.',
      check: 'Provjera', purchase: 'Provjeri svoju kupnju', scan: '📷 Skeniraj / učitaj račun',
      scanHelp: 'Prepoznavanje na uređaju kada je dostupno. Ti potvrđuješ rezultat.',
      market: 'Država / tržište', buyMethod: 'Kako si kupio proizvod?',
      online: 'Online / kupnja na daljinu', physical: 'Fizička trgovina',
      findRetailer: 'Pronađi trgovca', findHelp: 'Upiši naziv trgovca za filtriranje postojećeg popisa.',
      storeSource: 'Trgovina / izvor', store: 'Trgovina', purchaseDate: 'Datum kupnje ili dostave',
      policyType: 'Vrsta pravila', returnDays: 'Rok povrata (dana)', item: 'Proizvod', optional: 'neobavezno',
      checkReturn: 'Provjeri rok povrata', policyStarts: 'Početak roka', windowUsed: 'Korišteni rok',
      verify: 'Provjeri službeni izvor ↗', reminder: '📅 Dodaj podsjetnik za povrat',
      reminderHelp: 'Stvara događaj u kalendaru.', sendResult: 'Pošalji ovaj rezultat', email: 'E-pošta',
      copyResult: 'Kopiraj poveznicu rezultata', moreApps: 'Ostale aplikacije…', another: 'Provjeri drugu kupnju',
      official: 'Provjera putem službenog izvora', recent: 'Nedavno',
      recentTitle: 'Preglednik pamti korisne stvari.', clearRecent: 'Obriši nedavne provjere',
      howTitle: 'Korisno, bez glume.', step1: 'Unesi ili skeniraj',
      step1p: 'Prepoznavanje računa samo predlaže podatke. Ti ih provjeravaš.', step2: 'Izračunaj',
      step2p: 'Still? odvaja zakonska prava od dobrovoljnih pravila trgovca.',
      step3: 'Provjeri i djeluj', step3p: 'Prije oslanjanja na rok ili jamstvo otvori službeni izvor.',
      footer: 'Jednostavno. Privatno. Korisno.', return: 'Povrat', warranty: 'Jamstvo',
      questionReturn: 'Provjeri povrat', questionWarranty: 'Provjeri prava iz jamstva',
      goWarranty: 'Provjeri prava iz jamstva', warrantyInfo: 'Upute o jamstvu',
      warrantyNote: 'Za robu kupljenu od profesionalnog trgovca u EU u pravilu postoji najmanje dvije godine zakonskog jamstva ako je roba neispravna ili nije kao oglašena. Nacionalna pravila mogu pružiti veću zaštitu. To nije isto što i dobrovoljno komercijalno jamstvo.',
      warrantyUS: 'U SAD-u jamstvo ovisi o proizvodu, trgovcu ili proizvođaču i primjenjivom pravu. Still? ne izmišlja univerzalni rok.',
      eligible: 'Unutar standardnog zakonskog razdoblja', expired: 'Standardno dvogodišnje razdoblje je prošlo',
      daysRemain: days => `Preostalo je ${days} dana standardnog razdoblja`,
      passed: days => `Standardno razdoblje prošlo je prije ${days} dana`,
      deadline: date => `Standardno razdoblje završava: ${date}`, select: 'Provjeri pisano jamstvo',
      euStat: 'Zakonsko pravo potrošača EU', dateRequired: 'Najprije odaberi datum kupnje ili dostave.'
    }
  };

  let mode = 'return';
  const language = () => $('#language')?.value === 'hr' ? 'hr' : 'en';
  const text = key => copy[language()][key];

  function translate() {
    document.documentElement.lang = language();
    document.querySelectorAll('[data-v10]').forEach(element => {
      const value = text(element.dataset.v10);
      if (typeof value === 'string') element.textContent = value;
    });
    document.querySelectorAll('[data-v10-html]').forEach(element => {
      const value = text(element.dataset.v10Html);
      if (typeof value === 'string') element.innerHTML = value;
    });

    const tabs = document.querySelectorAll('.mode-tabs button');
    if (tabs[0]?.querySelector('span')) tabs[0].querySelector('span').textContent = text('return');
    if (tabs[1]?.querySelector('span')) tabs[1].querySelector('span').textContent = text('warranty');
    if ($('#retailerSearch')) $('#retailerSearch').placeholder = language() === 'hr' ? 'Traži trgovca…' : 'Search retailer…';
    if ($('#itemName')) $('#itemName').placeholder = language() === 'hr' ? 'npr. AirPods Pro' : 'e.g. AirPods Pro';
    if ($('#returnForm button[type="submit"]')) $('#returnForm button[type="submit"]').textContent = mode === 'warranty' ? text('goWarranty') : text('checkReturn');
    if ($('.card-kicker')) $('.card-kicker').textContent = mode === 'warranty' ? text('questionWarranty') : text('questionReturn');
    window.dispatchEvent(new CustomEvent('still:language', { detail: { lang: language() } }));
  }

  function ensureTabs() {
    const card = $('.checker-card');
    if (!card || $('.mode-tabs')) return;
    const tabs = document.createElement('div');
    tabs.className = 'mode-tabs';
    tabs.innerHTML = '<button type="button" class="active" data-mode="return">↩ <span></span></button><button type="button" data-mode="warranty">◇ <span></span></button>';
    card.prepend(tabs);
  }

  function toggleField(selector, hidden) {
    const element = $(selector);
    element?.closest('.field')?.classList.toggle('hidden', hidden);
    if (!element) return;
    element.disabled = hidden;
    if (element.id === 'store') element.required = !hidden;
  }

  function setMode(nextMode) {
    mode = nextMode === 'warranty' ? 'warranty' : 'return';
    document.querySelectorAll('.mode-tabs button').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
    const warranty = mode === 'warranty';
    toggleField('#purchaseType', warranty);
    toggleField('#retailerSearch', warranty);
    toggleField('#store', warranty);
    $('#modifierWrap')?.classList.add('hidden');
    $('#customDaysWrap')?.classList.add('hidden');
    $('#scanReceipt')?.closest('.receipt-box')?.classList.toggle('hidden', warranty);
    $('#result')?.classList.add('hidden');
    $('#returnForm')?.classList.remove('hidden');
    translate();
    window.dispatchEvent(new CustomEvent('still:modechange', { detail: { mode } }));
  }

  function submitWarranty(event) {
    if (mode !== 'warranty') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const dateInput = $('#purchaseDate');
    if (!dateInput?.value) {
      dateInput?.setCustomValidity(text('dateRequired'));
      dateInput?.reportValidity();
      dateInput?.setCustomValidity('');
      return;
    }

    const start = new Date(`${dateInput.value}T00:00:00`);
    const isEu = $('#market')?.value !== 'us';
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 2);
    const daysLeft = Math.ceil((end - new Date()) / 86400000);
    const withinPeriod = daysLeft >= 0;
    const locale = language() === 'hr' ? 'hr-HR' : 'en-US';

    $('#returnForm')?.classList.add('hidden');
    $('#result')?.classList.remove('hidden');
    $('#statusBadge').textContent = isEu ? (withinPeriod ? text('eligible') : text('expired')) : text('warrantyUS');
    $('#resultTitle').textContent = isEu ? (withinPeriod ? text('daysRemain')(daysLeft) : text('passed')(Math.abs(daysLeft))) : text('warrantyInfo');
    $('#deadlineText').textContent = isEu ? text('deadline')(end.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })) : '';
    $('#progressFill').style.width = isEu ? `${Math.max(0, Math.min(100, daysLeft / 730 * 100))}%` : '100%';
    $('#resultMarket').textContent = $('#market')?.selectedOptions?.[0]?.textContent || '';
    $('#resultStore').textContent = isEu ? text('euStat') : text('select');
    $('#resultItem').textContent = $('#itemName')?.value || '—';
    $('#resultDate').textContent = start.toLocaleDateString(locale);
    $('#resultWindow').textContent = isEu ? (language() === 'hr' ? 'Najmanje 2 godine' : 'Minimum 2 years') : '—';
    $('#policyNote').textContent = isEu ? text('warrantyNote') : text('warrantyUS');

    const policy = $('#policyLink');
    if (policy) {
      policy.classList.remove('hidden');
      policy.href = isEu
        ? 'https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_en.htm'
        : 'https://consumer.ftc.gov/articles/warranties';
    }
    $('#addReminder')?.classList.add('hidden');
    $('#reminderHelp')?.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('still:result', { detail: { mode: 'warranty' } }));
    $('#result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ensureTabs();
  document.querySelectorAll('.mode-tabs button').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });
  $('#returnForm')?.addEventListener('submit', submitWarranty, true);
  $('#language')?.addEventListener('change', () => setTimeout(translate, 0));
  translate();
})();
