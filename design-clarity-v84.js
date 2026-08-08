(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  function setMetadata() {
    document.title = t('Still · Everything you own.', 'Still · Sve što posjeduješ.');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(
      'Everything you own, in one calm place. Keep products, services, subscriptions, documents, dates and service history together.',
      'Sve što posjeduješ na jednom mirnom mjestu. Drži proizvode, usluge, pretplate, dokumente, rokove i servisnu povijest zajedno.'
    ));
  }

  function mountAdvancedTools() {
    if (document.body.classList.contains('business-page') || $('#advancedToolsV84')) return;
    const first = ['relationshipV54', 'buyerRewardsV76', 'savedV24Section', 'recent', 'how'].map(id => document.getElementById(id)).find(Boolean);
    if (!first) return setTimeout(mountAdvancedTools, 250);
    const section = document.createElement('section');
    section.id = 'advancedToolsV84';
    section.className = 'v84-advanced';
    section.innerHTML = `<div><span>${t('MORE TOOLS', 'VIŠE ALATA')}</span><h2>${t('Need your saved checks, rewards or case tools?', 'Trebaš spremljene provjere, nagrade ili alate slučaja?')}</h2><p>${t('They are still here. Open them only when you need them.', 'I dalje su ovdje. Otvori ih samo kada ih trebaš.')}</p></div><button type="button" aria-expanded="false">${t('Show all buyer tools', 'Prikaži sve alate kupca')} <i>↓</i></button>`;
    first.insertAdjacentElement('beforebegin', section);
    $('button', section).addEventListener('click', event => {
      const open = document.body.classList.toggle('v84-show-advanced');
      event.currentTarget.setAttribute('aria-expanded', String(open));
      event.currentTarget.innerHTML = open
        ? `${t('Hide extra tools', 'Sakrij dodatne alate')} <i>↑</i>`
        : `${t('Show all buyer tools', 'Prikaži sve alate kupca')} <i>↓</i>`;
      if (open) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function improveForms() {
    const labels = [
      ['#decisionFormV83 h3', t('A one-minute decision check', 'Provjera odluke u jednoj minuti')],
      ['#passportFormV83 h3', t('Add one thing', 'Dodaj jednu stvar')]
    ];
    labels.forEach(([selector, text]) => {
      const heading = $(selector);
      if (heading) heading.textContent = text;
    });
    $('#passportFormV83')?.setAttribute('aria-label', t('Create an ownership passport', 'Izradi putovnicu vlasništva'));
    $('#decisionFormV83')?.setAttribute('aria-label', t('Check a buying decision', 'Provjeri odluku o kupnji'));
  }

  function activateNavigation() {
    const links = [...document.querySelectorAll('#featureNavV82 a[href^="#"]')];
    if (!links.length || !('IntersectionObserver' in window)) return;
    const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => {
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-25% 0px -65%', threshold: [0, .2, .6] });
    sections.forEach(section => observer.observe(section));
  }

  function markReady() {
    document.documentElement.classList.add('design-v84-ready');
    $('.brand')?.setAttribute('href', '#discoverV83');
    setMetadata();
    improveForms();
    mountAdvancedTools();
    activateNavigation();
  }

  function repaint() {
    setTimeout(() => {
      setMetadata();
      improveForms();
      const section = $('#advancedToolsV84');
      if (section) section.remove();
      mountAdvancedTools();
    }, 40);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markReady, { once: true });
  else markReady();
  $('#language')?.addEventListener('change', repaint);
  window.addEventListener('still:language', repaint);
})();
