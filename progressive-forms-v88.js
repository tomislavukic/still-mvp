(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  function addFormNote(form, english, croatian) {
    if (!form || $('.v88-form-note', form)) return;
    const heading = $('h3', form);
    if (!heading) return;
    const note = document.createElement('p');
    note.className = 'v88-form-note';
    note.innerHTML = `<span aria-hidden="true">✓</span>${t(english, croatian)}`;
    heading.insertAdjacentElement('afterend', note);
  }

  function simplifyPassportForm() {
    const form = $('#passportFormV83');
    if (!form || $('.v88-form-details', form)) return;
    addFormNote(
      form,
      'Only the name is required. Add the rest when it is useful.',
      'Obavezan je samo naziv. Ostalo dodaj kada ti koristi.'
    );

    const reference = $(':scope > label:has(input[name="reference"])', form);
    const dates = $(':scope > .op83-form-grid', form);
    const notes = $(':scope > label:has(textarea[name="notes"])', form);
    if (!reference || !dates || !notes) return;

    const details = document.createElement('details');
    details.className = 'v88-form-details';
    details.innerHTML = `
      <summary>
        <span><b>${t('Add dates and details', 'Dodaj rokove i detalje')}</b><small>${t('Reference, return, warranty, renewal and private notes', 'Referenca, povrat, jamstvo, obnova i privatne bilješke')}</small></span>
      </summary>`;
    reference.insertAdjacentElement('beforebegin', details);
    details.append(reference, dates, notes);
  }

  function clarifyDecisionForm() {
    addFormNote(
      $('#decisionFormV83'),
      'About one minute. Your answers stay in this browser.',
      'Oko jedne minute. Tvoji odgovori ostaju u ovom pregledniku.'
    );
  }

  function enhance() {
    simplifyPassportForm();
    clarifyDecisionForm();
    document.documentElement.classList.add('forms-v88-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 70), { once: true });
  else setTimeout(enhance, 70);
  $('#language')?.addEventListener('change', () => setTimeout(enhance, 100));
  window.addEventListener('still:language', () => setTimeout(enhance, 100));
})();
