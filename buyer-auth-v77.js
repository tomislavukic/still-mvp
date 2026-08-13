(() => {
  if (/^\/company(?:\.html)?\/?$/.test(location.pathname)) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const isCroatian = () => $('#language')?.value === 'hr';
  const t = (english, croatian) => isCroatian() ? croatian : english;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const endpoints = {
    config: '/api/v1/buyer-auth/google/config',
    login: '/api/v1/buyer-auth/google',
    me: '/api/v1/buyer-auth/me',
    logout: '/api/v1/buyer-auth/logout'
  };

  let config = null;
  let me = { authenticated: false };
  let root = null;
  let googleLoadPromise = null;
  const osPath = '/app';
  const safeOsDestination = value => {
    try {
      const target = new URL(value || osPath, location.origin);
      if (target.origin !== location.origin || !/^\/app(?:\/|$)/.test(target.pathname)) return osPath;
      return `${target.pathname}${target.search}${target.hash}`;
    } catch { return osPath; }
  };
  const osDestination = () => {
    try {
      const saved = sessionStorage.getItem('still-post-auth-destination');
      return safeOsDestination(saved);
    } catch { return osPath; }
  };

  async function api(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
        ...options,
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error(data.message || data.error || `Request failed (${response.status})`), {
          data,
          status: response.status
        });
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function ensureRoot() {
    root = $('#buyerAuthV77');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'buyerAuthV77';
    root.className = 'ba77';
    ($('header') || document.body).appendChild(root);
    return root;
  }

  async function refresh() {
    ensureRoot();
    root.setAttribute('aria-busy', 'true');
    const [configResult, meResult] = await Promise.allSettled([
      api(endpoints.config),
      api(endpoints.me)
    ]);

    config = configResult.status === 'fulfilled'
      ? configResult.value
      : { enabled: false, unavailable: true, error: configResult.reason?.message || 'unavailable' };
    me = meResult.status === 'fulfilled'
      ? meResult.value
      : { authenticated: false, unavailable: true, error: meResult.reason?.message || 'unavailable' };

    render();
    root.removeAttribute('aria-busy');
    const parameters = new URLSearchParams(location.search);
    const requestedSignIn = parameters.get('signin') === '1';
    const returnTo = parameters.get('returnTo');
    if (requestedSignIn && returnTo) {
      try { sessionStorage.setItem('still-post-auth-destination', safeOsDestination(returnTo)); } catch {}
    }
    if (requestedSignIn && me.authenticated) return location.assign(osDestination());
    if (requestedSignIn && !me.authenticated) {
      const panel = $('[data-panel]', root), trigger = $('[data-open]', root);
      if (panel && trigger) { panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); }
    }
    if (!me.authenticated && config.enabled) loadGoogle();
  }

  function recentCases() {
    return (me?.cases || []).slice(0, 5).map(caseItem => `
      <button class="ba77-case" data-case-id="${escapeHtml(caseItem.public_id)}">
        <span>
          <b>${escapeHtml(caseItem.product_name || caseItem.case_type || caseItem.public_id)}</b>
          <small>${escapeHtml(caseItem.company_name || caseItem.public_id)}</small>
        </span>
        <em>${escapeHtml(caseItem.status || '')}</em>
      </button>`).join('');
  }

  function unavailableNotice() {
    if (!config?.unavailable && !me?.unavailable) return '';
    return `<div class="ba77-config ba77-retry-notice" role="status">
      <b>${t('Sign-in service is temporarily unavailable.', 'Usluga prijave trenutačno nije dostupna.')}</b>
      <span>${t('Your local checks still work. Retry Google sign-in without losing anything.', 'Lokalne provjere i dalje rade. Pokušaj ponovno bez gubitka podataka.')}</span>
      <button type="button" data-retry>${t('Retry sign in', 'Pokušaj ponovno')}</button>
    </div>`;
  }

  function renderSignedOut() {
    root.innerHTML = `
      <button class="ba77-login" type="button" data-open aria-haspopup="dialog" aria-expanded="false">
        ${t('Buyer sign in', 'Prijava kupca')}
      </button>
      <div class="ba77-panel login" data-panel role="dialog" aria-label="${t('Buyer account', 'Račun kupca')}" hidden>
        <button class="ba77-close" type="button" data-close aria-label="${t('Close sign in', 'Zatvori prijavu')}">×</button>
        <div class="ba77-login-copy">
          <small class="ba77-audience">${t('YOUR PRIVATE STILL', 'TVOJ PRIVATNI STILL')}</small>
          <h3>${t('Continue to everything you own.', 'Nastavi do svega što posjeduješ.')}</h3>
          <p>${t('Your Passports, receipts, reminders, company connections, cases and rewards stay together across devices.', 'Tvoje Putovnice, računi, podsjetnici, veze s tvrtkama, slučajevi i nagrade ostaju zajedno na svim uređajima.')}</p>
        </div>
        <div class="ba77-login-action">
          ${unavailableNotice()}
          ${config?.enabled
            ? '<div id="googleSignInV77" aria-label="Google sign in"></div>'
            : config?.unavailable
              ? ''
              : `<div class="ba77-config">${t('Google sign-in needs its configured Client ID before it can be used.', 'Za Google prijavu potrebno je postaviti Client ID.')}</div>`}
          <small class="ba77-trust">${t('Google authenticates only your buyer account. A purchase or warranty claim is always verified separately.', 'Google potvrđuje samo tvoj račun kupca. Kupnja ili jamstveni zahtjev uvijek se provjeravaju zasebno.')}</small>
          <a class="ba77-business-link" href="/company.html">${t('Signing in for a business? Open Still for Business →', 'Prijavljuješ se za tvrtku? Otvori Still za tvrtke →')}</a>
        </div>
      </div>`;
  }

  function renderSignedIn() {
    const buyer = me.buyer || {};
    const rewards = me.rewards || {};
    const cases = me.cases || [];
    const fallbackInitial = (buyer.name || buyer.email || '?').slice(0, 1).toUpperCase();
    const avatar = buyer.pictureUrl
      ? `<img src="${escapeHtml(buyer.pictureUrl)}" alt="">`
      : escapeHtml(fallbackInitial);

    root.innerHTML = `
      <button class="ba77-account" type="button" data-account aria-haspopup="dialog" aria-expanded="false">
        <span class="ba77-avatar">${avatar}</span>
        <span class="ba77-account-main">
          <small>${t('BUYER PROFILE', 'PROFIL KUPCA')}</small>
          <b>${escapeHtml(buyer.name || buyer.email)}</b>
          <em>${escapeHtml(buyer.email)}</em>
        </span>
        <span class="ba77-account-score"><b>${Number(rewards.points_balance || 0)}</b><small>${t('points', 'bodova')}</small></span>
        <span class="ba77-account-arrow">›</span>
      </button>
      <div class="ba77-quick">
        <button type="button" data-go="os">${t('Open Still', 'Otvori Still')}</button>
        <button type="button" data-go="world">${t('World', 'Svijet')}</button>
        <button type="button" data-go="together">${t('Together', 'Zajedno')}</button>
        <button type="button" data-go="rewards">${t('Rewards', 'Nagrade')}</button>
      </div>
      <div class="ba77-panel" data-panel role="dialog" aria-label="${t('Buyer profile', 'Profil kupca')}" hidden>
        <div class="ba77-profile">
          <span class="ba77-avatar large">${avatar}</span>
          <div>
            <b>${escapeHtml(buyer.name || 'Still? Buyer')}</b>
            <span>${escapeHtml(buyer.email)}</span>
            <small>✓ ${t('Google authenticated buyer account', 'Račun kupca prijavljen Googleom')}</small>
          </div>
        </div>
        <div class="ba77-stats">
          <div><b>${Number(rewards.points_balance || 0)}</b><span>${t('Points', 'Bodovi')}</span></div>
          <div><b>${Number(rewards.reputation_score || 50)}</b><span>${t('Reputation', 'Reputacija')}</span></div>
          <div><b>${cases.length}</b><span>${t('Cases', 'Slučajevi')}</span></div>
        </div>
        <div class="ba77-profile-actions">
          <button type="button" data-go="os"><b>${t('Open Still', 'Otvori Still')}</b><small>${t('Now, World and everything you own', 'Sada, Svijet i sve što posjeduješ')}</small></button>
          <button type="button" data-go="world"><b>${t('My World', 'Moj Svijet')}</b><small>${t('Things, Knowledge and Situations', 'Stvari, znanje i situacije')}</small></button>
          <button type="button" data-go="together"><b>${t('Together', 'Zajedno')}</b><small>${t('Real shared business relationships', 'Stvarni zajednički odnosi s tvrtkama')}</small></button>
          <button type="button" data-go="os_profile"><b>${t('Profile and privacy', 'Profil i privatnost')}</b><small>${t('Identity, connected data and migration', 'Identitet, povezani podaci i migracija')}</small></button>
          <button type="button" data-go="checker"><b>${t('Check a purchase', 'Provjeri kupnju')}</b><small>${t('Return or warranty eligibility', 'Povrat ili jamstvo')}</small></button>
          <button type="button" data-go="rewards"><b>${t('Rewards & reputation', 'Nagrade i reputacija')}</b><small>${t('Points, benefits and activity', 'Bodovi, pogodnosti i aktivnost')}</small></button>
        </div>
        <section class="ba77-recent">
          <header><b>${t('Recent cases', 'Nedavni slučajevi')}</b><span>${cases.length}</span></header>
          ${cases.length ? recentCases() : `<p>${t('No cases are linked to this account yet.', 'Još nema slučajeva povezanih s ovim računom.')}</p>`}
        </section>
        <div class="ba77-account-meta">
          <span>✓ ${t('Email verified by Google', 'E-pošta potvrđena putem Googlea')}</span>
          <span>${t('Purchase verification remains separate for each case.', 'Provjera kupnje ostaje zasebna za svaki slučaj.')}</span>
        </div>
        <button class="ba77-secondary" type="button" data-link>${t('Import cases saved on this device', 'Poveži slučajeve spremljene na ovom uređaju')}</button>
        <button class="ba77-logout" type="button" data-logout>${t('Sign out', 'Odjava')}</button>
      </div>`;
  }

  function render() {
    if (!root) return;
    if (me?.authenticated) renderSignedIn();
    else renderSignedOut();
    bind();
    if (me?.authenticated) window.dispatchEvent(new CustomEvent('still:buyer-authenticated', { detail: me }));
  }

  function togglePanel() {
    const panel = $('[data-panel]', root);
    const trigger = $('[data-open], [data-account]', root);
    if (!panel || !trigger) return;
    panel.hidden = !panel.hidden;
    trigger.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) {
      if (config?.enabled && !me?.authenticated) startGoogle();
      const reveal = () => root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      requestAnimationFrame(reveal);
      setTimeout(reveal, config?.enabled && !me?.authenticated ? 180 : 0);
    }
  }

  function go(destination) {
    if (destination === 'os') return location.assign(osDestination());
    if (destination === 'world') return location.assign('/app/world');
    if (destination === 'together') return location.assign('/app/together');
    if (destination === 'os_profile') return location.assign('/app?profile=1');
    const targets = { checker: '#checker', rewards: '#buyerRewardsV76' };
    if (destination === 'notifications') {
      const bell = $('#buyerNotifyV69 .sn69-button');
      if (bell) {
        bell.click();
        return;
      }
    }
    $(targets[destination] || '')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bind() {
    $('[data-open], [data-account]', root)?.addEventListener('click', togglePanel);
    $('[data-close]', root)?.addEventListener('click', () => {
      const panel = $('[data-panel]', root), trigger = $('[data-open], [data-account]', root);
      if (panel) panel.hidden = true;
      trigger?.setAttribute('aria-expanded', 'false');
    });
    $('[data-retry]', root)?.addEventListener('click', refresh);
    $('[data-logout]', root)?.addEventListener('click', async () => {
      await api(endpoints.logout, { method: 'POST', body: '{}' }).catch(() => {});
      me = { authenticated: false };
      await refresh();
    });
    $('[data-link]', root)?.addEventListener('click', () => linkSaved(false));
    root.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      go(button.dataset.go);
    }));
    root.querySelectorAll('[data-case-id]').forEach(button => button.addEventListener('click', () => {
      const publicId = button.dataset.caseId;
      const card = [...document.querySelectorAll('[data-public-id], [data-case-id], .case-card')]
        .find(element => (element.dataset.publicId || element.dataset.caseId || element.textContent || '').includes(publicId));
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else go('saved');
    }));
  }

  function loadGoogle() {
    if (window.google?.accounts?.id) {
      startGoogle();
      return Promise.resolve();
    }
    if (googleLoadPromise) return googleLoadPromise;
    googleLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        startGoogle();
        resolve();
      };
      script.onerror = () => {
        showGoogleError(t('Google sign-in could not load. Check your connection and retry.', 'Google prijava se nije mogla učitati. Provjeri vezu i pokušaj ponovno.'));
        googleLoadPromise = null;
        reject(new Error('google_script_unavailable'));
      };
      document.head.appendChild(script);
    });
    return googleLoadPromise;
  }

  function startGoogle() {
    if (!config?.clientId || !window.google?.accounts?.id) return;
    const container = $('#googleSignInV77');
    if (!container || container.dataset.ready === 'true') return;
    container.dataset.ready = 'true';
    window.google.accounts.id.initialize({
      client_id: config.clientId,
      callback: googleCallback,
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_button: true,
      button_auto_select: true
    });
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
      width: 360
    });
  }

  function showGoogleError(message) {
    const container = $('#googleSignInV77');
    if (!container) return;
    container.dataset.ready = 'false';
    container.innerHTML = `<div class="ba77-config" role="alert">${escapeHtml(message)} <button type="button" data-google-retry>${t('Retry', 'Pokušaj ponovno')}</button></div>`;
    $('[data-google-retry]', container)?.addEventListener('click', () => loadGoogle());
  }

  async function googleCallback(response) {
    try {
      await api(endpoints.login, {
        method: 'POST',
        body: JSON.stringify({ credential: response.credential })
      });
      await linkSaved(true);
      location.assign(osDestination());
    } catch (error) {
      showGoogleError(error.status === 503
        ? t('Google sign-in is not configured on the server yet.', 'Google prijava još nije konfigurirana na poslužitelju.')
        : t('Google sign-in could not be completed. Please retry.', 'Google prijavu nije bilo moguće dovršiti. Pokušaj ponovno.'));
    }
  }

  function savedCases() {
    for (const key of ['still-connected-cases-v60', 'still-cases-v28']) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(value)) return value;
      } catch {}
    }
    return [];
  }

  async function linkSaved(silent = false) {
    let linked = 0;
    for (const savedCase of savedCases()) {
      const publicId = savedCase.publicId || savedCase.public_id;
      const accessToken = savedCase.accessToken || savedCase.access_token || savedCase.token;
      if (!publicId || !accessToken) continue;
      try {
        await api(`/api/v1/buyer-auth/cases/${encodeURIComponent(publicId)}/link`, {
          method: 'POST',
          body: JSON.stringify({ accessToken })
        });
        linked += 1;
      } catch {}
    }
    if (!silent) {
      alert(linked
        ? t(`${linked} saved case(s) linked to your account.`, `${linked} spremljenih slučajeva povezano je s tvojim računom.`)
        : t('No compatible saved cases were found.', 'Nisu pronađeni kompatibilni spremljeni slučajevi.'));
    }
  }

  window.StillBuyerAuth = { authenticated: () => Boolean(me?.authenticated), open: () => me?.authenticated ? location.assign(osDestination()) : togglePanel() };
  window.addEventListener('still:buyer-sign-in', () => {
    // External CTA clicks continue bubbling after this custom event. Opening the
    // panel on the next task prevents the document-level outside-click handler
    // from immediately closing the panel again.
    setTimeout(() => window.StillBuyerAuth.open(), 0);
  });

  document.addEventListener('click', event => {
    if (!root || root.contains(event.target)) return;
    const panel = $('[data-panel]', root);
    const trigger = $('[data-open], [data-account]', root);
    if (panel && !panel.hidden) {
      panel.hidden = true;
      trigger?.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const panel = root && $('[data-panel]', root);
    if (panel && !panel.hidden) {
      panel.hidden = true;
      $('[data-open], [data-account]', root)?.setAttribute('aria-expanded', 'false');
    }
  });
  $('#language')?.addEventListener('change', () => setTimeout(render, 0));

  const start = refresh;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
