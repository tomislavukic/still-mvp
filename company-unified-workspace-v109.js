(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const SESSION_KEY = 'still-company-demo-v102';
  const isHr = () => document.documentElement.lang !== 'en';
  const t = (hr, en) => isHr() ? hr : en;
  let organization = null;
  let syncTimer = 0;
  let mounted = false;

  const orgKey = () => {
    const id = organization?.id || organization?.organization_id || organization?.slug || organization?.email || 'workspace';
    return `still-company-workspace-drafts-v109:${String(id).toLowerCase()}`;
  };

  function installStyles() {
    if ($('#companyUnifiedWorkspaceStylesV109')) return;
    const style = document.createElement('style');
    style.id = 'companyUnifiedWorkspaceStylesV109';
    style.textContent = `
      .cuw109-shell{width:min(1220px,calc(100% - 28px));margin:22px auto;padding:0;border:1px solid var(--line);border-radius:26px;background:var(--surface);box-shadow:0 24px 70px rgba(22,45,70,.1);overflow:hidden}
      .cuw109-head{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:start;padding:24px;background:linear-gradient(135deg,color-mix(in srgb,var(--green) 10%,var(--surface)),var(--surface))}.cuw109-head span{color:var(--green);font-size:10px;font-weight:900;letter-spacing:.11em}.cuw109-head h2{margin:7px 0 6px;font-size:clamp(28px,4vw,46px);letter-spacing:-.05em}.cuw109-head p{max-width:760px;margin:0;color:var(--muted);font-size:13px;line-height:1.6}.cuw109-state{display:grid;gap:6px;min-width:190px;padding:14px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--surface) 88%,transparent)}.cuw109-state b{font-size:13px}.cuw109-state small{color:var(--muted);line-height:1.4}
      .cuw109-legend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:0 24px 20px}.cuw109-legend div{display:flex;gap:9px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--surface2)}.cuw109-legend i{display:grid;flex:0 0 25px;width:25px;height:25px;place-items:center;border-radius:50%;background:var(--surface);font-style:normal}.cuw109-legend b,.cuw109-legend small{display:block}.cuw109-legend b{font-size:11px}.cuw109-legend small{margin-top:2px;color:var(--muted);font-size:9px;line-height:1.45}
      .cuw109-host{padding:0 18px 22px}.cuw109-host #companyToolsPreviewV97{display:block!important;margin:0!important;max-width:none!important}.cuw109-host [data-demo-only],.cuw109-host .demo-only{display:block!important}.cuw109-host .cpv102-studio-head span,.cuw109-host [data-cpv97-result]{letter-spacing:.07em}.cuw109-mode-badge{display:inline-flex;align-items:center;gap:5px;margin-left:7px;padding:4px 8px;border-radius:999px;background:var(--surface2);color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.05em}.cuw109-hidden-entry{display:none!important}
      @media(max-width:760px){.cuw109-head{grid-template-columns:1fr}.cuw109-state{min-width:0}.cuw109-legend{grid-template-columns:1fr;padding-inline:16px}.cuw109-head{padding:20px 16px}.cuw109-host{padding-inline:8px}}
    `;
    document.head.appendChild(style);
  }

  function restoreDrafts() {
    try {
      const saved = localStorage.getItem(orgKey());
      if (saved && !sessionStorage.getItem(SESSION_KEY)) sessionStorage.setItem(SESSION_KEY, saved);
    } catch {}
  }

  function persistDrafts() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      try {
        const value = sessionStorage.getItem(SESSION_KEY);
        if (value) localStorage.setItem(orgKey(), value);
      } catch {}
    }, 180);
  }

  function replaceLegacyLanguage(root) {
    const replacements = [
      [/DEMO STUDIO · THIS TAB ONLY/gi, 'WORKSPACE STUDIO · COMPANY DRAFTS'],
      [/DEMO STUDIO · SAMO OVA KARTICA/gi, 'RADNI STUDIO · NACRTI TVRTKE'],
      [/demo session/gi, 'workspace draft history'],
      [/demo sesij[ae]/gi, 'povijest nacrta'],
      [/demo records?/gi, 'draft records'],
      [/demo zapis(?:i|a)?/gi, 'nacrti'],
      [/temporary records?/gi, 'workspace drafts'],
      [/privremenih zapisa/gi, 'nacrta radnog prostora'],
      [/temporary action/gi, 'draft action'],
      [/privremena radnja/gi, 'radnja nacrta'],
      [/temporary CSV/gi, 'workspace CSV'],
      [/privremeni CSV/gi, 'CSV radnog prostora'],
      [/Nothing is sent to buyers, businesses or the production database\./gi, 'Draft changes are saved to this company workspace. Publishing and external actions use the verified live modules.'],
      [/Ništa se ne šalje kupcima, tvrtkama ni produkcijskoj bazi\./gi, 'Promjene nacrta spremaju se u radni prostor tvrtke. Objavljivanje i vanjske radnje koriste verificirane module uživo.'],
      [/NOT SAVED/gi, 'DRAFTS SAVED'],
      [/NE SPREMA SE/gi, 'NACRTI SPREMLJENI'],
      [/production data/gi, 'until published'],
      [/produkcijski podaci/gi, 'do objave']
    ];

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let value = node.nodeValue;
      replacements.forEach(([pattern, replacement]) => { value = value.replace(pattern, replacement); });
      if (value !== node.nodeValue) node.nodeValue = value;
    });
  }

  function hideSeparateDemoEntry() {
    $$('button,a,[role="button"]').forEach(element => {
      const text = `${element.textContent} ${element.getAttribute('aria-label') || ''}`.trim();
      if (/open demo|start demo|interactive demo|pokreni demo|otvori demo/i.test(text)) element.classList.add('cuw109-hidden-entry');
    });
  }

  function shell() {
    let section = $('#companyUnifiedWorkspaceV109');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'companyUnifiedWorkspaceV109';
    section.className = 'cuw109-shell';
    section.innerHTML = `<header class="cuw109-head"><div><span>STILL? FOR BUSINESS · UNIFIED WORKSPACE</span><h2>${t('Jedan radni prostor. Stvarni moduli i trajni nacrti.','One workspace. Live modules and persistent drafts.')}</h2><p>${t('Funkcije iz prijašnjeg demo prikaza sada su dio poslovne platforme. Moduli povezani s API-jima koriste stvarne podatke. Ostali omogućuju trajne nacrte dok se njihova objava ili integracija ne otključa.','The former demo tools are now part of the business platform. API-connected modules use live data. The remaining tools create persistent drafts until publishing or integration is available.')}</p></div><div class="cuw109-state"><b>${t('Radni prostor tvrtke','Company workspace')}</b><small>${t('Nacrti se čuvaju na ovom uređaju za ovu organizaciju. Vanjske radnje ostaju zaštićene verifikacijom i planom.','Drafts persist on this device for this organization. External actions remain protected by verification and plan rules.')}</small></div></header><div class="cuw109-legend"><div><i>●</i><span><b>${t('Uživo','Live')}</b><small>${t('Povezano sa stvarnim Still? API-jima i podacima.','Connected to real Still? APIs and data.')}</small></span></div><div><i>✎</i><span><b>${t('Nacrt','Draft')}</b><small>${t('Stvarno uređivanje i izvoz bez lažnog objavljivanja.','Real editing and export without pretending to publish.')}</small></span></div><div><i>🔒</i><span><b>${t('Zaštićena radnja','Protected action')}</b><small>${t('Vidljiva, ali zahtijeva verifikaciju, integraciju ili plan.','Visible, but requires verification, integration, or a plan.')}</small></span></div></div><div class="cuw109-host" data-cuw109-host></div>`;
    const workbench = $('#businessWorkbenchV72') || $('main');
    if (workbench) workbench.insertAdjacentElement('afterend', section);
    else document.body.appendChild(section);
    return section;
  }

  function mountStudio() {
    if (mounted) return;
    const previewRoot = $('#companyToolsPreviewV97');
    if (!previewRoot) return setTimeout(mountStudio, 250);
    const host = $('[data-cuw109-host]', shell());
    if (!host) return;
    host.appendChild(previewRoot);
    previewRoot.hidden = false;
    replaceLegacyLanguage(previewRoot);
    hideSeparateDemoEntry();
    mounted = true;

    const observer = new MutationObserver(mutations => {
      observer.disconnect();
      const changed = mutations.some(m => m.addedNodes.length || m.type === 'characterData');
      if (changed) replaceLegacyLanguage(previewRoot);
      observer.observe(previewRoot, { childList: true, subtree: true, characterData: true });
      persistDrafts();
    });
    observer.observe(previewRoot, { childList: true, subtree: true, characterData: true });

    previewRoot.addEventListener('input', persistDrafts, { passive: true });
    previewRoot.addEventListener('change', persistDrafts, { passive: true });
    previewRoot.addEventListener('click', persistDrafts, { passive: true });
    window.addEventListener('beforeunload', () => {
      clearTimeout(syncTimer);
      try {
        const value = sessionStorage.getItem(SESSION_KEY);
        if (value) localStorage.setItem(orgKey(), value);
      } catch {}
    });
  }

  function start(event) {
    organization = event?.detail?.organization || window.__stillOrganization || organization;
    if (!organization || !document.body.classList.contains('business-page')) return;
    installStyles();
    restoreDrafts();
    shell();
    hideSeparateDemoEntry();
    mountStudio();
  }

  window.addEventListener('still:company-authenticated', start);
  if (window.__stillOrganization) start({ detail: { organization: window.__stillOrganization } });
})();
