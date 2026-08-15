(() => {
  if (window.__stillProfessionalPassportV186) return;
  window.__stillProfessionalPassportV186 = true;

  const hr = () => (document.documentElement.lang || '').toLowerCase().startsWith('hr');
  const t = (en, cro) => hr() ? cro : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const words = value => String(value || '').replaceAll('_',' ').toLocaleLowerCase().replace(/(^|\s)\S/g, c => c.toLocaleUpperCase());
  let cache = null;

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials:'same-origin', headers:{accept:'application/json', ...(options.headers || {})}, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || data.error || String(response.status)), { status:response.status, data });
    return data;
  }

  async function profile(force = false) {
    if (cache && !force) return cache;
    cache = await api('/api/v1/professional/profile');
    return cache;
  }

  function skillRows(capabilities = []) {
    if (!capabilities.length) return `<div class="spp186-empty"><b>${t('Your Capability Passport is ready.','Tvoja Putovnica sposobnosti je spremna.')}</b><p>${t('Add your first skill. It stays private while Professional Mode is a draft.','Dodaj prvu sposobnost. Ostaje privatna dok je Profesionalni način u skici.')}</p></div>`;
    return capabilities.map(capability => `<article class="spp186-skill"><span aria-hidden="true">✓</span><div><b>${esc(capability.name)}</b><small>${esc(words(capability.category))} · ${t('Unverified until supported by evidence','Nepotvrđeno dok nije poduprto dokazom')}</small></div><em>${Number(capability.evidenceCount || 0)} ${t('evidence','dokaza')}</em></article>`).join('');
  }

  function card(data) {
    const p = data.profile || {}, capabilities = data.capabilities || [], enabled = Boolean(p.professionalModeEnabled);
    return `<section class="spp186-card" data-professional-passport-card>
      <header><div><small>${t('PROFESSIONAL IDENTITY','PROFESIONALNI IDENTITET')}</small><h2>${t('Capability Passport','Putovnica sposobnosti')}</h2><p>${enabled ? t('Your professional identity is active. Skills and real evidence build this Passport over time.','Tvoj profesionalni identitet je aktivan. Sposobnosti i stvarni dokazi s vremenom grade ovu Putovnicu.') : t('Your saved skills live here even before you activate Professional Mode.','Tvoje spremljene sposobnosti žive ovdje i prije aktivacije Profesionalnog načina.')}</p></div><span class="spp186-state" data-enabled="${enabled}">${enabled ? t('Active','Aktivno') : t('Draft','Skica')}</span></header>
      <div class="spp186-skills">${skillRows(capabilities)}</div>
      <footer><button type="button" class="primary" data-open-capability-passport>${t('Open Passport','Otvori Putovnicu')}</button><button type="button" data-open-professional-setup>${enabled ? t('Professional settings','Profesionalne postavke') : t('Finish setup & activate','Dovrši postavljanje i aktiviraj')}</button></footer>
    </section>`;
  }

  async function mountNow() {
    if (!/^\/app\/?$/.test(location.pathname)) return;
    const main = document.querySelector('#stillOSMain');
    if (!main || main.querySelector('[data-professional-passport-card]')) return;
    try {
      const data = await profile();
      const invite = main.querySelector('.sos133-input-invite');
      const recent = main.querySelector('.sos133-recent');
      const holder = document.createElement('div'); holder.innerHTML = card(data);
      (recent || invite?.nextSibling || main.firstChild)?.before ? (recent || invite).before(holder.firstElementChild) : main.append(holder.firstElementChild);
      bind(document);
    } catch (error) {
      if (error.status !== 401) console.warn('professional passport unavailable', error);
    }
  }

  function dialogShell(title, body) {
    const dialog = document.createElement('dialog'); dialog.className = 'spp186-dialog';
    dialog.innerHTML = `<div class="spp186-dialog-inner"><button type="button" class="spp186-close" aria-label="${t('Close','Zatvori')}">×</button><header><small>${t('STILL PROFESSIONAL','STILL PROFESSIONAL')}</small><h2>${esc(title)}</h2></header>${body}</div>`;
    document.body.append(dialog); dialog.querySelector('.spp186-close').onclick = () => dialog.close(); dialog.addEventListener('close', () => dialog.remove()); dialog.showModal(); return dialog;
  }

  async function openPassport() {
    const data = await profile(true), p = data.profile || {}, capabilities = data.capabilities || [];
    const dialog = dialogShell(t('Capability Passport','Putovnica sposobnosti'), `<section class="spp186-passport-head"><div><b>${esc(p.displayName || t('Your professional identity','Tvoj profesionalni identitet'))}</b><p>${esc(p.headline || t('Add a headline when you finish Professional Mode setup.','Dodaj opis kada dovršiš postavljanje Profesionalnog načina.'))}</p></div><span>${p.professionalModeEnabled ? t('ACTIVE','AKTIVNO') : t('PRIVATE DRAFT','PRIVATNA SKICA')}</span></section><div class="spp186-skills large">${skillRows(capabilities)}</div><button type="button" class="primary" data-open-professional-setup>${p.professionalModeEnabled ? t('Edit Professional Mode','Uredi Profesionalni način') : t('Finish setup & activate','Dovrši postavljanje i aktiviraj')}</button>`);
    bind(dialog);
  }

  async function openSetup() {
    const data = await profile(true), p = data.profile || {};
    const selected = new Set(p.locationModes || []);
    const dialog = dialogShell(t('Professional Mode','Profesionalni način'), `<form class="spp186-setup" data-spp186-setup><div class="spp186-activation"><span aria-hidden="true">◎</span><div><b>${p.professionalModeEnabled ? t('Professional Mode is active','Profesionalni način je aktivan') : t('Activate your professional identity','Aktiviraj svoj profesionalni identitet')}</b><p>${t('Choose how you work, complete the required identity fields, then activate. Your private World is never exposed.','Odaberi kako radiš, ispuni obavezna polja identiteta i zatim aktiviraj. Tvoj privatni Svijet nikada se ne izlaže.')}</p></div></div>
      <label>${t('Professional name','Profesionalno ime')}<input name="displayName" required minlength="2" maxlength="120" value="${esc(p.displayName || '')}"></label>
      <label>${t('What do you help with?','U čemu pomažeš?')}<input name="headline" maxlength="180" value="${esc(p.headline || '')}"></label>
      <label>${t('Short introduction','Kratko predstavljanje')}<textarea name="bio" maxlength="1500">${esc(p.bio || '')}</textarea></label>
      <fieldset><legend>${t('How do you work? Choose at least one.','Kako radiš? Odaberi barem jedno.')}</legend>${[['REMOTE',t('Remote','Na daljinu')],['LOCAL',t('Local','Lokalno')],['HYBRID',t('Hybrid','Hibridno')]].map(([value,label]) => `<label><input type="checkbox" name="locationModes" value="${value}" ${selected.has(value)?'checked':''}><span>${label}</span></label>`).join('')}</fieldset>
      <label>${t('Coarse location','Okvirna lokacija')}<input name="coarseLocation" maxlength="120" value="${esc(p.coarseLocation || '')}" placeholder="Zagreb"></label>
      <label>${t('Availability','Dostupnost')}<select name="availabilityStatus">${['AVAILABLE','LIMITED','UNAVAILABLE','PAUSED'].map(value => `<option value="${value}" ${p.availabilityStatus===value?'selected':''}>${words(value)}</option>`).join('')}</select></label>
      <div class="spp186-actions"><button type="submit" class="primary">${p.professionalModeEnabled ? t('Save Professional Mode','Spremi Profesionalni način') : t('Activate Professional Mode','Aktiviraj Profesionalni način')}</button><button type="button" data-open-capability-passport>${t('View Capability Passport','Pogledaj Putovnicu sposobnosti')}</button></div><p role="status" data-spp186-status></p></form>`);
    bind(dialog);
    dialog.querySelector('[data-spp186-setup]').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget, out = form.querySelector('[data-spp186-status]'), button = form.querySelector('[type="submit"]');
      const modes = [...form.querySelectorAll('[name="locationModes"]:checked')].map(input => input.value);
      if (!modes.length) { out.textContent = t('Choose Remote, Local, or Hybrid before activating.','Prije aktivacije odaberi Na daljinu, Lokalno ili Hibridno.'); return; }
      button.disabled = true;
      try {
        const values = Object.fromEntries(new FormData(form));
        await api('/api/v1/professional/profile', { method:p.publicId ? 'PATCH' : 'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({...values, professionalModeEnabled:true, locationModes:modes, currency:'EUR'}) });
        cache = null; out.textContent = t('Professional Mode is active.','Profesionalni način je aktivan.');
        setTimeout(() => { dialog.close(); refreshNow(); }, 450);
      } catch (error) { out.textContent = error.data?.message || error.message; button.disabled = false; }
    });
  }

  function bind(scope) {
    scope.querySelectorAll?.('[data-open-capability-passport]').forEach(button => { if (!button.dataset.spp186Bound) { button.dataset.spp186Bound='1'; button.addEventListener('click', event => { event.preventDefault(); openPassport().catch(console.error); }); }});
    scope.querySelectorAll?.('[data-open-professional-setup]').forEach(button => { if (!button.dataset.spp186Bound) { button.dataset.spp186Bound='1'; button.addEventListener('click', event => { event.preventDefault(); openSetup().catch(console.error); }); }});
  }

  async function refreshNow() { document.querySelector('[data-professional-passport-card]')?.remove(); await mountNow(); }

  const observer = new MutationObserver(() => { mountNow(); bind(document); });
  observer.observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('popstate', () => setTimeout(mountNow));
  document.addEventListener('click', event => { const nav = event.target.closest?.('[data-nav]'); if (nav) setTimeout(mountNow, 80); });
  mountNow(); bind(document);
})();