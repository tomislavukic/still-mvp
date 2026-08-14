/* Still OS UI consistency and fast notification surface. */
(() => {
  const root = document.getElementById('stillOSV133');
  if (!root) return;
  const hr = () => localStorage.getItem('still-lang') === 'hr';
  const t = (en, cro) => hr() ? cro : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const getItems = source => {
    const market = source?.market || {};
    const direct = Array.isArray(source?.notifications) ? source.notifications : [];
    const marketItems = Array.isArray(market.notifications) ? market.notifications : [];
    return [...direct, ...marketItems].filter(Boolean).slice(0, 20);
  };
  const label = item => item.title || item.label || item.message || item.type || t('Still update','Still obavijest');
  const detail = item => item.description || item.detail || item.body || item.message || '';
  const renderItems = items => items.length ? `<div class="sos174-notify-list">${items.map(item => `<article class="sos174-notification"><span aria-hidden="true">${item.icon ? esc(item.icon) : '◌'}</span><div><b>${esc(label(item))}</b>${detail(item) ? `<small>${esc(detail(item))}</small>` : ''}</div>${item.createdAt || item.created_at ? `<time>${esc(new Date(item.createdAt || item.created_at).toLocaleDateString(hr() ? 'hr-HR' : 'en-GB'))}</time>` : ''}</article>`).join('')}</div>` : `<div class="sos174-empty"><b>${t('You’re all caught up.','Sve je pregledano.')}</b><p>${t('New World and Market updates will appear here.','Nove obavijesti iz Svijeta i Tržišta pojavit će se ovdje.')}</p></div>`;
  let dialog = null;
  let body = null;
  let inFlight = null;
  function ensureDialog() {
    if (dialog?.isConnected) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'sos172-dialog sos175-notifications-dialog';
    dialog.innerHTML = `<div class="sos172-dialog-body"><div class="sos172-dialog-head"><div><span>${t('STILL NOTIFICATIONS','STILL OBAVIJESTI')}</span><h2>${t('Notifications','Obavijesti')}</h2><p>${t('Important updates from your World and Market in one place.','Važne obavijesti iz tvog Svijeta i Tržišta na jednom mjestu.')}</p></div><button type="button" class="sos172-close" aria-label="${t('Close','Zatvori')}">×</button></div><div data-sos175-notifications-body></div></div>`;
    document.body.appendChild(dialog);
    body = dialog.querySelector('[data-sos175-notifications-body]');
    dialog.querySelector('.sos172-close').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { dialog.remove(); dialog = null; body = null; }, { once: true });
    return dialog;
  }
  function openImmediately() {
    const modal = ensureDialog();
    body.innerHTML = `<div class="sos175-notification-loading"><i aria-hidden="true"></i><span>${t('Refreshing notifications…','Osvježavam obavijesti…')}</span></div>`;
    if (!modal.open) modal.showModal();
    refresh();
  }
  async function refresh() {
    if (inFlight) return inFlight;
    inFlight = fetch('/api/v1/world/now', { credentials:'same-origin', headers:{ accept:'application/json' } })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || data.error || String(response.status));
        const items = getItems(data);
        if (body?.isConnected) body.innerHTML = renderItems(items);
        const badge = document.querySelector('[data-still-notifications] .sos174-badge');
        if (badge) {
          badge.textContent = items.length > 99 ? '99+' : String(items.length);
          badge.hidden = items.length < 1;
        }
        return data;
      })
      .catch(() => {
        if (body?.isConnected) body.innerHTML = `<div class="sos175-notification-error">${t('Notifications could not be refreshed. Try again in a moment.','Obavijesti se nisu mogle osvježiti. Pokušaj ponovno za trenutak.')}</div>`;
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-still-notifications]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openImmediately();
  }, true);
})();
