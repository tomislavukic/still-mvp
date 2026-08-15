// Ask Still command surface. Keep this client-only layer additive to the existing Still OS search and World APIs.
(() => {
  if (window.__stillKnowledge144) return;
  window.__stillKnowledge144 = true;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const isHr = () => document.documentElement.lang?.toLowerCase().startsWith('hr') || localStorage.getItem('still-lang') === 'hr';
  const t = (en, hr) => isHr() ? hr : en;

  async function api(path, options = {}) {
    const headers = { accept: 'application/json', ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers['content-type'] = 'application/json';
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
    return data;
  }

  function close() {
    document.querySelector('.k144-overlay')?.remove();
  }

  function sourceMarkup(source) {
    const href = source.href || source.url || source.path || '#';
    return `<a class="k144-source" href="${esc(href)}"><b>${esc(source.title || t('Source', 'Izvor'))}</b><small>${esc(source.type || '')}</small></a>`;
  }

  async function ask(query, result) {
    result.innerHTML = `<p class="k144-processing">${t('Looking in your Still World…', 'Tražim u tvom Still Svijetu…')}</p>`;
    try {
      const data = await api('/api/v1/world/ask', { method: 'POST', body: JSON.stringify({ query }) });
      const answer = data.answer || t("I couldn't find that in your Still World.", 'Nisam to pronašao u tvom Still Svijetu.');
      result.innerHTML = `<div class="k144-answer"><p>${esc(answer).replace(/\n/g, '<br>')}</p>${data.sources?.length ? `<h4>${t('Sources', 'Izvori')}</h4><div class="k144-sources">${data.sources.map(sourceMarkup).join('')}</div>` : ''}</div>`;
    } catch (error) {
      result.innerHTML = `<p>${t('Ask Still is temporarily unavailable. Search and your World still work normally.', 'Ask Still trenutačno nije dostupan. Pretraga i tvoj Svijet i dalje normalno rade.')}</p>`;
    }
  }

  async function remember(content, result) {
    result.innerHTML = `<p class="k144-processing">${t('Saving to your World…', 'Spremam u tvoj Svijet…')}</p>`;
    try {
      const data = await api('/api/v1/world/knowledge/remember', { method: 'POST', body: JSON.stringify({ content }) });
      result.innerHTML = `<div class="k144-saved"><b>${t('Saved.', 'Spremljeno.')}</b><p>${esc(data.knowledge?.body || content)}</p></div>`;
    } catch (error) {
      result.innerHTML = `<p>${t('Could not save this. Nothing was claimed as remembered.', 'Ovo nije spremljeno. Still neće tvrditi da je zapamtio nešto što nije spremljeno.')}</p>`;
    }
  }

  function open(options = {}) {
    close();
    const overlay = document.createElement('div');
    overlay.className = 'k144-overlay';
    overlay.innerHTML = `
      <main class="k144-shell" role="dialog" aria-modal="true" aria-label="Ask Still">
        <header>
          <div>
            <small>${t('YOUR WORLD', 'TVOJ SVIJET')}</small>
            <h2>Ask Still</h2>
            <p>${t('Find what you saved, remember something, or ask about your World.', 'Pronađi što si spremio, zapamti nešto ili pitaj o svom Svijetu.')}</p>
          </div>
          <button class="k144-close" type="button" aria-label="${t('Close', 'Zatvori')}">×</button>
        </header>
        <form class="k144-form">
          <textarea rows="2" aria-label="Ask Still" placeholder="${t('Where are my spare keys?', 'Gdje su moji rezervni ključevi?')}">${esc(options.prefill || '')}</textarea>
          <div class="k144-actions">
            <button type="button" data-k144-show>${t('Show / upload', 'Pokaži / učitaj')}</button>
            <span class="k144-action-spacer"></span>
            <button type="button" data-k144-remember>${t('Remember', 'Zapamti')}</button>
            <button type="submit" class="k144-primary">Ask Still</button>
          </div>
        </form>
        <section class="k144-result" aria-live="polite">
          <div class="k144-prompts">
            <button type="button">${t('What am I still waiting for?', 'Što još uvijek čekam?')}</button>
            <button type="button">${t('Find my washing machine invoice', 'Pronađi račun za perilicu')}</button>
            <button type="button">${t('What did I decide?', 'Što sam odlučio?')}</button>
          </div>
        </section>
      </main>`;

    document.body.appendChild(overlay);
    const form = overlay.querySelector('.k144-form');
    const textarea = form.querySelector('textarea');
    const result = overlay.querySelector('.k144-result');

    overlay.querySelector('.k144-close').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const query = textarea.value.trim();
      if (query) ask(query, result);
    });
    overlay.querySelector('[data-k144-remember]').addEventListener('click', () => {
      const content = textarea.value.trim();
      if (content) remember(content, result);
    });
    overlay.querySelector('[data-k144-show]').addEventListener('click', () => {
      close();
      const sight = document.querySelector('#stillOSV133 [data-sight-open]');
      if (sight) sight.click();
      else document.querySelector('#stillOSV133 [data-command-open]')?.dispatchEvent(new CustomEvent('still:open-sight', { bubbles: true }));
    });
    overlay.querySelectorAll('.k144-prompts button').forEach(button => button.addEventListener('click', () => {
      textarea.value = button.textContent.trim();
      ask(textarea.value, result);
    }));

    setTimeout(() => textarea.focus(), 40);
    if (options.autoAsk && textarea.value.trim()) ask(textarea.value.trim(), result);
    if (options.autoRemember && textarea.value.trim()) remember(textarea.value.trim(), result);
  }

  const questionLike = query => /^(what|where|when|why|how|which|who|did|do|does|is|are|can|could|should|would|tell me|find|explain|compare|summarize|što|sta|gdje|gde|kada|kad|zašto|zasto|kako|koji|koja|koje|tko|da li|je li|pronađi|pronadi|objasni|usporedi|sažmi|sazmi)\b/i.test(query) || /[?？]\s*$/.test(query);
  const rememberLike = query => /^(remember|save this|note that|zapamti|zapamti da|spremi|zabilježi|zabiljezi)\b/i.test(query);

  function integrate() {
    document.querySelectorAll('.k144-global').forEach(node => node.remove());
    const form = document.querySelector('#stillOSV133 [data-global-search]');
    if (!form || form.dataset.k144Integrated) return;
    form.dataset.k144Integrated = '1';

    const plus = form.querySelector('[data-command-open]');
    if (plus) {
      const replacement = plus.cloneNode(true);
      plus.replaceWith(replacement);
      replacement.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        open();
      }, true);
    }

    form.addEventListener('submit', event => {
      const input = form.querySelector('input[name="q"]');
      const query = input?.value.trim() || '';
      if (query.length < 2) return;
      if (rememberLike(query)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        open({ prefill: query, autoRemember: true });
      } else if (questionLike(query)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        open({ prefill: query, autoAsk: true });
      }
    }, true);
  }

  new MutationObserver(integrate).observe(document.documentElement, { childList: true, subtree: true });
  integrate();

  window.StillKnowledge = { open, ask, remember };
})();
