(() => {
  const root = document.documentElement;
  const button = document.getElementById('themeToggle');
  const meta = document.getElementById('themeColor');
  const media = matchMedia('(prefers-color-scheme: dark)');
  const labels = {
    en: { system: 'System appearance', light: 'Light appearance', dark: 'Dark appearance' },
    hr: { system: 'Izgled sustava', light: 'Svijetli izgled', dark: 'Tamni izgled' }
  };
  let preference = localStorage.getItem('still-theme') || 'system';
  const language = () => localStorage.getItem('still-lang') === 'hr' ? 'hr' : 'en';
  const actual = () => preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;

  function paint() {
    const appearance = actual();
    root.dataset.theme = appearance;
    root.dataset.themePreference = preference;
    root.style.colorScheme = appearance;
    meta?.setAttribute('content', appearance === 'dark' ? '#151d2a' : '#e9f0f5');
    if (!button) return;
    button.textContent = preference === 'system' ? '◐' : preference === 'dark' ? '☾' : '☀';
    button.title = labels[language()][preference];
    button.setAttribute('aria-label', labels[language()][preference]);
  }

  function cycle() {
    preference = preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system';
    localStorage.setItem('still-theme', preference);
    paint();
  }

  button?.addEventListener('click', cycle);
  media.addEventListener?.('change', () => { if (preference === 'system') paint(); });
  document.getElementById('language')?.addEventListener('change', () => setTimeout(paint, 0));
  paint();
})();

/* Still OS capability restoration: semantic navigation + canonical Passport tools. */
(() => {
  const isHr = () => localStorage.getItem('still-lang') === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  const icons = {
    now: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" class="fill"/>'),
    world: svg('<circle cx="12" cy="12" r="8"/><path d="M4.5 9h15M4.5 15h15M12 4c2.2 2.1 3.3 4.8 3.3 8S14.2 17.9 12 20M12 4C9.8 6.1 8.7 8.8 8.7 12S9.8 17.9 12 20"/>'),
    market: svg('<path d="M4 8h16M6 8l1-4h10l1 4M6 8v11h12V8M9 12h6"/>'),
    discover: svg('<circle cx="12" cy="12" r="8"/><path d="m14.8 9.2-2 5.6-3.6-3.6 5.6-2Z"/><circle cx="12" cy="12" r="1" class="fill"/>'),
    together: svg('<circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3.5 19c.5-3.3 2.3-5 5.5-5s5 1.7 5.5 5M14 15c3.5-.5 5.6.9 6.5 4"/>'),
    qr: svg('<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 14h2v2h-2zM18 14h2v4h-2zM14 18h4v2h-4z"/>'),
    receipt: svg('<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
    knowledge: svg('<path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v18H8.5A3.5 3.5 0 0 0 5 23V5.5ZM19 5.5A3.5 3.5 0 0 0 15.5 2H12v18h3.5A3.5 3.5 0 0 1 19 23V5.5Z"/>'),
    print: svg('<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/>')
  };

  function installStyles() {
    if (document.getElementById('stillCapabilityRestoreStyle')) return;
    const style = document.createElement('style');
    style.id = 'stillCapabilityRestoreStyle';
    style.textContent = `
      .sos133-nav a>span{display:grid!important;place-items:center!important;width:22px!important;height:22px!important}
      .sos133-nav a>span svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      .sos133-nav a>span svg .fill{fill:currentColor;stroke:none}
      .sos133-nav a[aria-current="page"]>span{color:var(--sos-accent)}
      .still-passport-tools{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0 0;padding-top:16px;border-top:1px solid var(--sos-line)}
      .still-passport-tools button{display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:0 13px;border:1px solid var(--sos-line);border-radius:13px;background:var(--sos-surface);color:var(--sos-ink);font:inherit;font-weight:750;cursor:pointer}
      .still-passport-tools button.primary{background:var(--sos-accent);border-color:var(--sos-accent);color:#fff}
      .still-passport-tools svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      .still-qr-dialog{border:0;border-radius:24px;padding:0;max-width:min(760px,calc(100vw - 28px));width:100%;background:var(--sos-surface);color:var(--sos-ink);box-shadow:0 30px 90px rgba(10,14,35,.34)}
      .still-qr-dialog::backdrop{background:rgba(9,12,24,.62);backdrop-filter:blur(7px)}
      .still-qr-shell{padding:24px}.still-qr-head{display:flex;justify-content:space-between;gap:20px;align-items:start}.still-qr-head h2{margin:5px 0 0;font-size:clamp(25px,5vw,38px)}
      .still-qr-head small{font-weight:800;letter-spacing:.11em;color:var(--sos-accent)}.still-qr-close{width:42px;height:42px;border:0;border-radius:50%;background:var(--sos-soft);color:var(--sos-ink);font-size:24px;cursor:pointer}
      .still-qr-grid{display:grid;grid-template-columns:minmax(210px,280px) 1fr;gap:26px;align-items:center;margin-top:22px}.still-qr-code{padding:16px;border-radius:20px;background:#fff}.still-qr-code svg{display:block;width:100%;height:auto}
      .still-qr-copy p{color:var(--sos-muted);line-height:1.55}.still-qr-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.still-qr-actions button{min-height:42px;padding:0 13px;border:1px solid var(--sos-line);border-radius:12px;background:var(--sos-soft);color:var(--sos-ink);font-weight:750;cursor:pointer}.still-qr-actions .danger{color:#b43b4b}
      .still-public-passport{position:fixed;z-index:10000;inset:0;overflow:auto;background:var(--sos-bg,#f6f5f2);color:var(--sos-ink,#151d2a);padding:clamp(22px,5vw,64px)}.still-public-passport>main{max-width:760px;margin:auto}.still-public-passport .badge{display:inline-flex;padding:8px 11px;border-radius:999px;background:#e9e8ff;color:#4545b8;font-weight:800}.still-public-passport h1{font-size:clamp(38px,7vw,68px);letter-spacing:-.045em;margin:20px 0 10px}.still-public-passport p{line-height:1.6;color:var(--sos-muted,#667085)}.still-public-passport dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:28px 0}.still-public-passport dl div{padding:16px;border:1px solid var(--sos-line,#d9dde7);border-radius:16px}.still-public-passport dt{font-size:12px;font-weight:800;color:var(--sos-muted,#667085)}.still-public-passport dd{margin:5px 0 0;font-weight:800}.still-public-passport .privacy{padding:18px;border-radius:16px;background:var(--sos-soft,#eef0f5)}
      @media(max-width:720px){.sos133-nav a>span svg{width:18px;height:18px}.still-passport-tools{display:grid;grid-template-columns:1fr 1fr}.still-passport-tools button{justify-content:center;min-width:0;padding:0 9px;font-size:12px}.still-qr-grid{grid-template-columns:1fr}.still-qr-code{max-width:260px;margin:auto}.still-public-passport dl{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function enhanceNav() {
    const nav = document.querySelector('.sos133-nav');
    if (!nav) return;
    for (const [space, markup] of Object.entries({ now: icons.now, world: icons.world, market: icons.market, discover: icons.discover, together: icons.together })) {
      const mark = nav.querySelector(`[data-space="${space}"] > span`);
      if (mark && !mark.querySelector('svg')) mark.innerHTML = markup;
    }
  }

  function loadQr() {
    if (typeof window.qrcode === 'function') return Promise.resolve();
    if (window.__stillQrLoading) return window.__stillQrLoading;
    window.__stillQrLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/qrcode-generator-v94.js';
      script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
    });
    return window.__stillQrLoading;
  }

  function qrSvg(url, title) {
    const qr = window.qrcode(0, 'H'); qr.addData(url, 'Byte'); qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 18, scalable: true, alt: `${title} QR code`, title: `${title} · Still Passport` });
  }

  async function passportQr(publicId, title) {
    await loadQr();
    const response = await fetch(`/api/v1/ownership/passports/${encodeURIComponent(publicId)}/shares`, { method:'POST', credentials:'same-origin', headers:{'content-type':'application/json','accept':'application/json'}, body:JSON.stringify({days:30}) });
    const share = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(share.message || share.error || t('Could not create Passport QR.', 'Nije moguće izraditi QR putovnice.'));
    const dialog = document.createElement('dialog'); dialog.className = 'still-qr-dialog';
    dialog.innerHTML = `<div class="still-qr-shell"><div class="still-qr-head"><div><small>PASSPORT QR</small><h2>${esc(title)}</h2></div><button class="still-qr-close" aria-label="${t('Close','Zatvori')}">×</button></div><div class="still-qr-grid"><div class="still-qr-code">${qrSvg(share.verifyUrl,title)}</div><div class="still-qr-copy"><b>${t('Privacy-safe verification link','Poveznica za provjeru koja čuva privatnost')}</b><p>${t('The QR opens a limited public Passport record. Buyer identity, private notes, order references and internal evidence are excluded. The link expires in 30 days and can be revoked.','QR otvara ograničeni javni zapis Putovnice. Identitet kupca, privatne bilješke, reference narudžbi i interni dokazi nisu uključeni. Poveznica istječe za 30 dana i može se opozvati.')}</p><div class="still-qr-actions"><button data-copy>${t('Copy link','Kopiraj poveznicu')}</button><button data-share>${t('Share','Podijeli')}</button><button data-download>${t('Download QR','Preuzmi QR')}</button><button class="danger" data-revoke>${t('Revoke','Opozovi')}</button></div><small data-message></small></div></div></div>`;
    document.body.appendChild(dialog); dialog.showModal();
    const message = dialog.querySelector('[data-message]');
    dialog.querySelector('.still-qr-close').onclick = () => dialog.close(); dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.querySelector('[data-copy]').onclick = async()=>{await navigator.clipboard.writeText(share.verifyUrl);message.textContent=t('Link copied.','Poveznica kopirana.');};
    dialog.querySelector('[data-share]').onclick = async()=>{if(navigator.share) await navigator.share({title:`Still Passport · ${title}`,url:share.verifyUrl});else await navigator.clipboard.writeText(share.verifyUrl);};
    dialog.querySelector('[data-download]').onclick=()=>{const blob=new Blob([dialog.querySelector('.still-qr-code').innerHTML],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`still-passport-${String(title).toLowerCase().replace(/[^a-z0-9]+/g,'-')||'qr'}.svg`;a.click();URL.revokeObjectURL(url);};
    dialog.querySelector('[data-revoke]').onclick=async event=>{event.currentTarget.disabled=true;const r=await fetch(`/api/v1/ownership/passports/${encodeURIComponent(publicId)}/shares/${encodeURIComponent(share.token)}`,{method:'DELETE',credentials:'same-origin'});if(r.ok){message.textContent=t('Link revoked.','Poveznica opozvana.');event.currentTarget.remove();}else{event.currentTarget.disabled=false;message.textContent=t('Could not revoke the link.','Poveznicu nije moguće opozvati.');}};
  }

  function enhanceThing() {
    const workspace = document.querySelector('.sos133-workspace[data-context-type="thing"]');
    if (!workspace || workspace.dataset.capabilityRestored) return;
    workspace.dataset.capabilityRestored = '1';
    const publicId = workspace.dataset.contextId; const title = workspace.querySelector('.sos133-workspace-head h1')?.textContent?.trim() || t('Passport','Putovnica');
    const passport = workspace.querySelector('[data-passport]');
    if (passport) {
      const tools = document.createElement('div'); tools.className='still-passport-tools';
      tools.innerHTML=`<button class="primary" data-restored-qr>${icons.qr}${t('Passport QR','QR putovnice')}</button><button data-restored-receipt>${icons.receipt}${t('Add receipt','Dodaj račun')}</button><button data-restored-knowledge>${icons.knowledge}${t('Add knowledge','Dodaj znanje')}</button><button data-restored-print>${icons.print}${t('Print','Ispis')}</button>`;
      passport.appendChild(tools);
      tools.querySelector('[data-restored-qr]').onclick=()=>passportQr(publicId,title).catch(error=>alert(error.message));
      tools.querySelector('[data-restored-receipt]').onclick=()=>workspace.querySelector('[data-sight-open="receipt"]')?.click();
      tools.querySelector('[data-restored-knowledge]').onclick=()=>workspace.querySelector('[data-context-add="knowledge"]')?.click();
      tools.querySelector('[data-restored-print]').onclick=()=>window.print();
    }
    const more = workspace.querySelector('[data-workspace-more]');
    if (more && !more.dataset.restored) { more.dataset.restored='1'; more.title=t('Passport and Thing tools','Alati Putovnice i stvari'); more.setAttribute('aria-label',more.title); more.onclick=()=>{const passportButton=workspace.querySelector('[data-passport-toggle]'); if(passport?.hidden) passportButton?.click(); setTimeout(()=>workspace.querySelector('[data-restored-qr]')?.focus(),100);}; }
  }

  async function publicVerification() {
    const token = new URLSearchParams(location.hash.slice(1)).get('passportVerify');
    if (!token || location.pathname.startsWith('/app')) return;
    installStyles();
    const overlay=document.createElement('section');overlay.className='still-public-passport';overlay.innerHTML=`<main><p>${t('Checking Passport…','Provjera Putovnice…')}</p></main>`;document.body.appendChild(overlay);
    try { const response=await fetch(`/api/v1/ownership/verify/${encodeURIComponent(token)}`,{headers:{accept:'application/json'}}),data=await response.json();if(!response.ok)throw new Error();const p=data.passport||{};const fact=(label,value)=>value?`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`:'';overlay.innerHTML=`<main><span class="badge">✓ ${t('Live Still record','Aktivni Still zapis')}</span><h1>${esc(p.title||t('Passport','Putovnica'))}</h1><p>${t('This is a limited, privacy-safe Passport view.','Ovo je ograničeni prikaz Putovnice koji čuva privatnost.')}</p><dl>${fact(t('Type','Vrsta'),p.kind)}${fact(t('Business','Tvrtka'),p.businessName)}${fact(t('Purchased','Kupljeno'),p.purchasedOn)}${fact(t('Warranty until','Jamstvo do'),p.warrantyUntil)}${fact(t('Next action','Sljedeća radnja'),p.nextActionAt)}${fact(t('Record ID','ID zapisa'),p.publicId)}</dl>${p.issuer?.verified?`<p><b>✓ ${esc(p.issuer.name||t('Verified business','Verificirana tvrtka'))}</b> · ${t('verified on Still','verificirana na Still-u')}</p>`:''}<div class="privacy"><b>${t('Private by design','Privatno po dizajnu')}</b><p>${esc(p.privacy||t('Buyer identity, private notes, order references and internal evidence are excluded.','Identitet kupca, privatne bilješke, reference narudžbi i interni dokazi nisu uključeni.'))}</p></div></main>`;}catch{overlay.innerHTML=`<main><span class="badge">Still</span><h1>${t('This Passport link is unavailable.','Ova poveznica Putovnice nije dostupna.')}</h1><p>${t('It may have expired or been revoked by its owner.','Možda je istekla ili ju je vlasnik opozvao.')}</p></main>`;}
  }

  installStyles(); publicVerification();
  if (!location.pathname.startsWith('/app')) return;
  const enhance=()=>{enhanceNav();enhanceThing();}; enhance();
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
})();
