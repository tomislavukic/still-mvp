(() => {
  'use strict';

  const ROOT = '#buyerOSV132';
  const STYLE_ID = 'buyerOSExperienceV137Style';
  let observer = null;

  function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      ${ROOT} .bos132-card,
      ${ROOT} .bos132-section,
      ${ROOT} .bos132-thing-card,
      ${ROOT} .bos135-metric,
      ${ROOT} .bos136-status,
      ${ROOT} .bos136-knowledge-row {
        transition:
          transform .2s ease,
          border-color .2s ease,
          box-shadow .2s ease;
      }

      ${ROOT} .bos132-card:hover,
      ${ROOT} .bos135-metric:hover,
      ${ROOT} .bos136-status:hover,
      ${ROOT} .bos136-knowledge-row:hover {
        transform: translateY(-2px);
      }

      ${ROOT} .bos132-thing-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 14px 34px rgba(0,0,0,.09);
      }

      ${ROOT} button {
        transition:
          transform .16s ease,
          box-shadow .18s ease,
          background-color .18s ease;
      }

      ${ROOT} button:hover {
        transform: translateY(-1px);
      }

      ${ROOT} button:active {
        transform: scale(.985);
      }

      ${ROOT} .bos136-health-bar i {
        transform-origin: left center;
        animation: bos137Health .6s cubic-bezier(.2,.75,.15,1) both;
      }

      @keyframes bos137Health {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }

      ${ROOT} .bos136-status-strip > * {
        animation: bos137Rise .36s ease both;
      }

      ${ROOT} .bos136-status-strip > *:nth-child(2) {
        animation-delay: .05s;
      }

      ${ROOT} .bos136-status-strip > *:nth-child(3) {
        animation-delay: .1s;
      }

      @keyframes bos137Rise {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      ${ROOT} .bos135-tabs button[data-v137-active="true"] {
        background: var(--soft,#f3f6f4);
        color: var(--ink,#111);
      }

      ${ROOT} .bos137-focus {
        animation: bos137Focus 1s ease;
      }

      @keyframes bos137Focus {
        0%,100% {
          box-shadow: 0 0 0 0 rgba(83,91,255,0);
        }
        35% {
          box-shadow: 0 0 0 4px rgba(83,91,255,.14);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        ${ROOT} *,
        ${ROOT} *::before,
        ${ROOT} *::after {
          animation-duration: .01ms !important;
          transition-duration: .01ms !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function syncTabs(root) {
    observer?.disconnect();

    const tabs = [...root.querySelectorAll('[data-bos135-jump]')];
    const sections = [...root.querySelectorAll('[data-bos135-section]')];

    if (!tabs.length || !sections.length || !window.IntersectionObserver) return;

    observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      const id = visible.target.dataset.bos135Section;

      tabs.forEach(tab => {
        tab.dataset.v137Active =
          String(tab.dataset.bos135Jump === id);
      });
    }, {
      rootMargin: '-20% 0px -58% 0px',
      threshold: [0,.2,.5]
    });

    sections.forEach(section => observer.observe(section));
  }

  function bind(root) {
    if (root.dataset.v137Bound === 'true') return;

    root.dataset.v137Bound = 'true';

    root.addEventListener('click', event => {
      const tab = event.target.closest('[data-bos135-jump]');

      if (!tab) return;

      const id = tab.dataset.bos135Jump;
      const section = root.querySelector(
        `[data-bos135-section="${CSS.escape(id)}"]`
      );

      if (!section) return;

      section.classList.remove('bos137-focus');

      requestAnimationFrame(() => {
        section.classList.add('bos137-focus');
      });
    });
  }

  function enhance() {
    const root = document.querySelector(ROOT);
    if (!root) return false;

    installStyles();
    bind(root);
    syncTabs(root);

    return true;
  }

  function boot() {
    if (enhance()) return;

    const watcher = new MutationObserver(() => {
      if (enhance()) watcher.disconnect();
    });

    watcher.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();

