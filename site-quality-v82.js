(() => {
  const $ = selector => document.querySelector(selector);
  const isCroatian = () => $('#language')?.value === 'hr';
  const t = (english, croatian) => isCroatian() ? croatian : english;

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
    $('.feature-nav-business', nav).textContent = t('For Business ↗', 'Za tvrtke ↗');
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
    $('[data-footer-link="privacy"]', nav).textContent = t('Privacy', 'Privatnost');
    $('[data-footer-link="terms"]', nav).textContent = t('Terms', 'Uvjeti');
    $('[data-footer-link="methodology"]', nav).textContent = t('Methodology', 'Metodologija');
  }

  function start() {
    mountBuyerNavigation();
    mountBusinessAccess();
    mountFooterLinks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  $('#language')?.addEventListener('change', () => setTimeout(() => {
    updateBuyerNavigation();
    updateBusinessAccess();
    updateFooterLinks();
  }, 0));
})();
