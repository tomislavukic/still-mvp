(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  let timer;

  function mountToast() {
    if ($('#flowToastV89') || document.body.classList.contains('business-page')) return;
    const toast = document.createElement('div');
    toast.id = 'flowToastV89';
    toast.className = 'v89-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toast);
  }

  function show(message) {
    const toast = $('#flowToastV89');
    if (!toast) return;
    clearTimeout(timer);
    toast.innerHTML = `<span aria-hidden="true">✓</span><b>${message}</b>`;
    toast.classList.add('visible');
    timer = setTimeout(() => toast.classList.remove('visible'), 3200);
  }

  function bindForms() {
    const passport = $('#passportFormV83');
    const decision = $('#decisionFormV83');
    if (passport && !passport.dataset.feedbackV89) {
      passport.dataset.feedbackV89 = 'true';
      passport.addEventListener('submit', () => setTimeout(() => {
        $('.v88-form-details', passport)?.removeAttribute('open');
        show(t('Passport saved on this device.', 'Putovnica je spremljena na ovom uređaju.'));
      }, 80));
    }
    if (decision && !decision.dataset.feedbackV89) {
      decision.dataset.feedbackV89 = 'true';
      decision.addEventListener('submit', () => setTimeout(() => {
        show(t('Your decision brief is ready.', 'Sažetak tvoje odluke je spreman.'));
        if (matchMedia('(max-width: 767px)').matches) {
          $('#decisionResultV83')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        }
      }, 90));
    }
  }

  function start() {
    mountToast();
    bindForms();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 120), { once: true });
  else setTimeout(start, 120);
  $('#language')?.addEventListener('change', () => setTimeout(bindForms, 150));
  window.addEventListener('still:language', () => setTimeout(bindForms, 150));
})();
