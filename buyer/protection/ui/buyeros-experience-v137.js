(() => {
  'use strict';

  const STYLE_ID = 'stillBuyerOSExperienceV137Style';
  const TOAST_ID = 'stillBuyerOSExperienceV137Toast';
  const ROOT_SELECTOR = '#buyerOSV132';
  let toastTimer = null;
  let observedRoot = null;
  let mutationObserver = null;
  let tabObserver = null;

  function isReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  function isHr() {
    return document.querySelector('#language')?.value === 'hr';
  }

  function t(en, hr) {
    return isHr() ? hr : en;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      ${ROOT_SELECTOR} .bos132-main > *{animation:bos137-enter .32s cubic-bezier(.22,.72,.18,1) both}
      @keyframes bos137-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
      ${ROOT_SELECTOR} .bos132-card,${ROOT_SELECTOR} .bos132-section,${ROOT_SELECTOR} .bos132-thing-card,${ROOT_SELECTOR} .bos135-hero,${ROOT_SELECTOR} .bos135-metric,${ROOT_SELECTOR} .bos136-status,${ROOT_SELECTOR} .bos136-next,${ROOT_SELECTOR} .bos136-knowledge-row{transition:transform .2s ease,border-color .2s ease,background-color .2s ease,box-shadow .2s ease}
      ${ROOT_SELECTOR} .bos132-card:hover,${ROOT_SELECTOR} .bos135-metric:hover,${ROOT_SELECTOR} .bos136-status:hover,${ROOT_SELECTOR} .bos136-knowledge-row:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--line,#d9e1e5) 65%,var(--ink,#111))}
      ${ROOT_SELECTOR} .bos132-thing-card{position:relative;overflow:hidden}
      ${ROOT_SELECTOR} .bos132-thing-card::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);opacity:0;transition:opacity .2s ease}
      ${ROOT_SELECTOR} .bos132-thing-card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(0,0,0,.09)}
      ${ROOT_SELECTOR} .bos132-thing-card:hover::after{opacity:1}
      ${ROOT_SELECTOR} button{transition:transform .16s ease,background-color .18s ease,border-color .18s ease,opacity .18s ease,box-shadow .18s ease}
      ${ROOT_SELECTOR} button:hover{transform:translateY(-1px)}
      ${ROOT_SELECTOR} button:active{transform:translateY(0) scale(.985)}
      ${ROOT_SELECTOR} .bos132-primary:hover{box-shadow:0 7px 20px rgba(91,88,255,.18)}
      ${ROOT_SELECTOR} .bos132-nav button{position:relative}
      ${ROOT_SELECTOR} .bos132-nav button:hover{transform:translateX(2px)}
      ${ROOT_SELECTOR} .bos132-nav button.active::before{content:'';position:absolute;left:0;top:50%;width:3px;height:20px;border-radius:999px;background:currentColor;transform:translateY(-50%)}
      ${ROOT_SELECTOR} .bos136-health-bar i{transform-origin:left center;animation:bos137-health .6s cubic-bezier(.2,.75,.15,1) both}
      @keyframes bos137-health{from{transform:scaleX(0)}to{transform:scaleX(1)}}
      ${ROOT_SELECTOR} .bos136-status-strip > *{animation:bos137-rise .36s ease both}
      ${ROOT_SELECTOR} .bos136-status-strip > *:nth-child(2){animation-delay:.045s}
      ${ROOT_SELECTOR} .bos136-status-strip > *:nth-child(3){animation-delay:.09s}
      @keyframes bos137-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      ${ROOT_SELECTOR} .bos135-tabs{scrollbar-width:none}
      ${ROOT_SELECTOR} .bos135-tabs::-webkit-scrollbar{display:none}
      ${ROOT_SELECTOR} .bos135-tabs button{position:relative}
      ${ROOT_SELECTOR} .bos135-tabs button::after{content:'';position:absolute;left:11px;right:11px;bottom:3px;height:2px;border-radius:999px;background:currentColor;opacity:0;transform:scaleX(.4);transition:opacity .18s ease,transform .18s ease}
      ${ROOT_SELECTOR} .bos135-tabs button:hover::after{opacity:.28;transform:scaleX(1)}
      ${ROOT_SELECTOR} .bos135-tabs button[data-bos137-active='true']{background:var(--soft,#f3f6f4);color:var(--ink,#111)}
      ${ROOT_SELECTOR} .bos135-tabs button[data-bos137-active='true']::after{opacity:.42;transform:scaleX(1)}
      ${ROOT_SELECTOR} .bos137-focus{animation:bos137-focus 1.1s ease}
      @keyframes bos137-focus{0%{box-shadow:0 0 0 0 rgba(99,91,255,0)}35%{box-shadow:0 0 0 4px rgba(99,91,255,.14)}100%{box-shadow:0 0 0 0 rgba(99,91,255,0)}}
      #${TOAST_ID}{position:fixed;left:50%;bottom:24px;z-index:9999;max-width:min(420px,calc(100% - 28px));padding:11px 14px;border:1px solid var(--line,#d9e1e5);border-radius:13px;background:color-mix(in srgb,var(--surface,#fff) 92%,transparent);color:var(--ink,#111);box-shadow:0 14px 40px rgba(0,0,0,.18);backdrop-filter:blur(18px);font-size:11px;font-weight:720;opacity:0;transform:translate(-50%,12px);transition:opacity .2s ease,transform .2s ease;pointer-events:none}
      #${TOAST_ID}.visible{opacity:1;transform:translate(-50%,0)}
      ${ROOT_SELECTOR} .bos137-empty-action{display:flex;flex-direction:column;align-items:flex-start;gap:10px;text-align:left}
      ${ROOT_SELECTOR} .bos137-kicker{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 8px;border:1px solid var(--line,#d9e1e5);border-radius:999px;color:var(--muted,#66727a);font-size:9px;font-weight:800;letter-spacing:.04em}
      @media(prefers-reduced-motion:reduce){${ROOT_SELECTOR} .bos132-main > *,${ROOT_SELECTOR} .bos136-health-bar i,${ROOT_SELECTOR} .bos136-status-strip > *{animation:none!important}${ROOT_SELECTOR} *{scroll-behavior:auto!important}${ROOT_SELECTOR} .bos132-card,${ROOT_SELECTOR} .bos132-section,${ROOT_SELECTOR} .bos132-thing-card,${ROOT_SELECTOR} .bos135-hero,${ROOT_SELECTOR} .bos135-metric,${ROOT_SELECTOR} .bos136-status,${ROOT_SELECTOR} .bos136-next,${ROOT_SELECTOR} .bos136-knowledge-row,${ROOT_SELECTOR} button{transition:none!important}${ROOT_SELECTOR} button:hover,${ROOT_SELECTOR} .bos132-card:hover,${ROOT_SELECTOR} .bos132-thing-card:hover,${ROOT_SELECTOR} .bos135-metric:hover,${ROOT_SELECTOR} .bos136-status:hover,${ROOT_SELECTOR} .bos136-knowledge-row:hover{transform:none!important}}
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2100);
  }

  function decorateEmptyStates(root) {
    root.querySelectorAll('.bos132-empty').forEach(empty => {
      if (empty.dataset.bos137Decorated === 'true') return;
      const text = empty.textContent.trim().toLowerCase();
      if (!['nothing urgent', 'ništa hitno', 'no urgent'].some(token => text.includes(token))) return;
      empty.dataset.bos137Decorated = 'true';
      empty.classList.add('bos137-empty-action');
      const badge = document.createElement('span');
      badge.className = 'bos137-kicker';
      badge.textContent = t('✓ No urgent dates', '✓ Nema hitnih rokova');
      empty.appendChild(badge);
    });
  }

  function decoratePassport(root) {
    const hero = root.querySelector('.bos136-passport');
    if (!hero || hero.dataset.bos137Decorated === 'true') return;
    hero.dataset.bos137Decorated = 'true';
    const healthLabel = hero.querySelector('.bos136-health-label')?.textContent?.trim();
    if (!healthLabel) return;
    const kicker = document.createElement('span');
    kicker.className = 'bos137-kicker';
    kicker.textContent = healthLabel;
    root.querySelector('.bos136-identity > div:last-child')?.appendChild(kicker);
  }

  function focusSection(section) {
    if (!section) return;
    section.classList.remove('bos137-focus');
    requestAnimationFrame(() => section.classList.add('bos137-focus'));
  }

  function bindClickFeedback(root) {
    if (root.dataset.bos137ClickBound === 'true') return;
    root.dataset.bos137ClickBound = 'true';
    root.addEventListener('click', event => {
      const tab = event.target.closest('[data-bos135-jump]');
      if (tab) {
        const id = tab.dataset.bos135Jump;
        const section = root.querySelector(`[data-bos135-section="${CSS.escape(id)}"]`);
        window.setTimeout(() => focusSection(section), isReducedMotion() ? 0 : 180);
      }
      const openThing = event.target.closest('[data-bos132-open-thing]');
      if (openThing) focusSection(openThing.closest('.bos132-thing-card'));
    });
  }

  function syncPassportTabs(root) {
    tabObserver?.disconnect();
    tabObserver = null;
    const tabs = [...root.querySelectorAll('[data-bos135-jump]')];
    const sections = [...root.querySelectorAll('[data-bos135-section]')];
    if (!tabs.length || !sections.length || !('IntersectionObserver' in window)) return;
    tabObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.dataset.bos135Section;
      tabs.forEach(tab => { tab.dataset.bos137Active = String(tab.dataset.bos135Jump === id); });
    }, { rootMargin: '-18% 0px -58% 0px', threshold: [0, .15, .35, .6] });
    sections.forEach(section => tabObserver.observe(section));
  }

  function enhance(root) {
    installStyles();
    decorateEmptyStates(root);
    decoratePassport(root);
    bindClickFeedback(root);
    syncPassportTabs(root);
  }

  function observeRoot(root) {
    if (observedRoot === root) return enhance(root);
    mutationObserver?.disconnect();
    observedRoot = root;
    enhance(root);
    mutationObserver = new MutationObserver(() => enhance(root));
    mutationObserver.observe(root, { childList: true, subtree: true });
  }

  function mount() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return false;
    observeRoot(root);
    return true;
  }

  function boot() {
    installStyles();
    if (mount()) return;
    const pageObserver = new MutationObserver(() => {
      if (mount()) pageObserver.disconnect();
    });
    pageObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('still:buyeros-data-updated', () => {
    showToast(t('Saved to your BuyerOS.', 'Spremljeno u tvoj BuyerOS.'));
    mount();
  });
  window.addEventListener('still:ownership-updated', () => mount());
  window.addEventListener('still:language', () => mount());

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
