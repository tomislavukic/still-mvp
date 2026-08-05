(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const hr = () => document.documentElement.lang !== 'en';
  const t = (hrText, enText) => hr() ? hrText : enText;
  const number = value => Number(value || 0);
  let panel = null;
  let refreshTimer = 0;
  let loading = false;

  const api = async path => {
    const response = await fetch(path, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || data.error || 'Request failed'), { status: response.status });
    return data;
  };

  function installStyles() {
    if ($('#companyIntelligenceStylesV107')) return;
    const style = document.createElement('style');
    style.id = 'companyIntelligenceStylesV107';
    style.textContent = `
      .ci107{margin:18px 0 24px;padding:20px;border:1px solid color-mix(in srgb,var(--green) 30%,var(--line));border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--green) 8%,var(--surface)),var(--surface));box-shadow:0 18px 48px rgba(25,49,76,.08)}
      .ci107-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.ci107-head span{display:block;color:var(--green);font-size:10px;font-weight:900;letter-spacing:.11em}.ci107-head h3{margin:6px 0 5px;font-size:clamp(24px,3vw,36px);letter-spacing:-.045em}.ci107-head p{max-width:720px;margin:0;color:var(--muted);font-size:12px;line-height:1.55}.ci107-score{display:grid;place-items:center;min-width:82px;height:82px;border:1px solid var(--line);border-radius:24px;background:var(--surface);box-shadow:0 10px 28px rgba(25,49,76,.06)}.ci107-score b{font-size:29px}.ci107-score small{font-size:9px;color:var(--muted);text-transform:uppercase}
      .ci107-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}.ci107-card{display:grid;gap:4px;min-height:92px;padding:14px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--surface) 90%,transparent);text-align:left}.ci107-card b{font-size:24px}.ci107-card span{font-size:11px;color:var(--muted)}.ci107-card em{font-size:9px;font-style:normal;font-weight:900;letter-spacing:.06em;color:var(--green)}
      .ci107-recommendation{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;margin-top:12px;padding:14px 16px;border-radius:16px;background:var(--surface2)}.ci107-recommendation span{display:block;color:var(--green);font-size:9px;font-weight:900;letter-spacing:.09em}.ci107-recommendation b{display:block;margin-top:3px;font-size:14px}.ci107-recommendation p{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.5}.ci107-recommendation button,.ci107-refresh{min-height:40px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);padding:0 13px;font-weight:800;cursor:pointer}.ci107-refresh{margin-top:10px}.ci107-error{padding:16px;border:1px solid color-mix(in srgb,var(--urgent) 35%,var(--line));border-radius:15px;background:color-mix(in srgb,var(--urgent) 7%,var(--surface))}.ci107-error b,.ci107-error span{display:block}.ci107-error span{margin-top:4px;color:var(--muted);font-size:11px}
      @media(max-width:900px){.ci107-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.ci107{padding:16px}.ci107-head{display:grid;grid-template-columns:1fr auto}.ci107-grid{grid-template-columns:1fr 1fr}.ci107-recommendation{grid-template-columns:1fr}.ci107-recommendation button{width:100%}}@media(max-width:420px){.ci107-grid{grid-template-columns:1fr}.ci107-score{min-width:70px;height:70px}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    if (!document.body.classList.contains('business-page') || $('#companyIntelligenceV107')) return;
    const workbench = $('#businessWorkbenchV72');
    if (!workbench) return setTimeout(mount, 250);
    installStyles();
    panel = document.createElement('section');
    panel.id = 'companyIntelligenceV107';
    panel.className = 'ci107';
    panel.innerHTML = `<div class="ci107-head"><div><span>PLATFORM INTELLIGENCE · EXPLAINABLE</span><h3>${t('Priprema operativnog uvida…','Preparing operational insight…')}</h3><p>${t('Koristi samo postojeće slučajeve, zadatke, odobrenja, kupce, proizvode i poslovnice.','Uses only existing cases, tasks, approvals, customers, products and branches.')}</p></div><div class="ci107-score"><b>—</b><small>${t('stanje','health')}</small></div></div>`;
    const brief = $('[data-brief]', workbench);
    if (brief) brief.insertAdjacentElement('afterend', panel);
    else workbench.prepend(panel);
    panel.addEventListener('click', event => {
      if (event.target.closest('[data-ci-refresh]')) load();
      const action = event.target.closest('[data-ci-action]')?.dataset.ciAction;
      if (!action) return;
      const tab = workbench.querySelector(`[data-tab="${action}"]`);
      tab?.click();
      workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    load();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleRefresh();
    });
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(load, 1200);
  }

  async function load() {
    if (!panel || loading) return;
    loading = true;
    try {
      const [today, daily, tasksResult, approvalsResult, customersResult, productsResult, branchesResult] = await Promise.all([
        api('/api/v1/business/today'),
        api('/api/v1/business/daily-summary'),
        api('/api/v1/business/tasks'),
        api('/api/v1/business/approvals'),
        api('/api/v1/business/customers'),
        api('/api/v1/business/products'),
        api('/api/v1/business/branch-insights')
      ]);

      const summary = today.summary || {};
      const tasks = tasksResult.tasks || [];
      const approvals = approvalsResult.approvals || [];
      const customers = customersResult.customers || [];
      const products = productsResult.products || [];
      const branches = branchesResult.branches || [];
      const openTasks = tasks.filter(item => !['done','cancelled'].includes(item.status));
      const overdueTasks = openTasks.filter(item => item.due_at && new Date(item.due_at) < new Date());
      const pendingApprovals = approvals.filter(item => item.status === 'pending');
      const activeCases = number(summary.needResponse) + number(summary.waitingBuyer) + number(summary.unassigned) + number(summary.aging);
      const resolved = number(summary.resolved);
      const totalKnown = activeCases + resolved;
      const resolutionRate = totalKnown ? Math.round((resolved / totalKnown) * 100) : 100;
      const branchLoad = branches.reduce((sum, branch) => sum + number(branch.active), 0);
      const productPressure = products.reduce((max, product) => Math.max(max, number(product.active)), 0);
      const risk = number(summary.needResponse) * 12 + number(summary.unassigned) * 10 + number(summary.aging) * 14 + overdueTasks.length * 12 + pendingApprovals.length * 7;
      const health = Math.max(0, Math.min(100, 100 - risk));

      const recommendations = [
        { when: number(summary.needResponse) > 0, action: 'today', title: t('Odgovori kupcima koji čekaju.','Respond to waiting customers.'), detail: t(`${number(summary.needResponse)} slučajeva trenutno traži odgovor.`,`${number(summary.needResponse)} cases currently need a response.`) },
        { when: number(summary.unassigned) > 0, action: 'today', title: t('Dodijeli vlasnike nedodijeljenim slučajevima.','Assign owners to unassigned cases.'), detail: t(`${number(summary.unassigned)} slučajeva nema odgovornu osobu.`,`${number(summary.unassigned)} cases have no responsible owner.`) },
        { when: overdueTasks.length > 0, action: 'tasks', title: t('Riješi zadatke koji kasne.','Resolve overdue tasks.'), detail: t(`${overdueTasks.length} zadataka prošlo je rok.`,`${overdueTasks.length} tasks are past due.`) },
        { when: pendingApprovals.length > 0, action: 'approvals', title: t('Pregledaj odluke koje čekaju odobrenje.','Review pending decisions.'), detail: t(`${pendingApprovals.length} odluka čeka odobrenje.`,`${pendingApprovals.length} decisions await approval.`) },
        { when: number(summary.aging) > 0, action: 'today', title: t('Pregledaj stare otvorene slučajeve.','Review aging open cases.'), detail: t(`${number(summary.aging)} slučajeva stari bez dovršetka.`,`${number(summary.aging)} cases are aging without resolution.`) }
      ];
      const recommendation = recommendations.find(item => item.when) || { action: 'today', title: t('Operacije su trenutačno stabilne.','Operations are currently stable.'), detail: t('Nema kritičnog odstupanja u dostupnim podacima.','No critical deviation appears in the available data.') };

      panel.innerHTML = `<div class="ci107-head"><div><span>PLATFORM INTELLIGENCE · EXPLAINABLE</span><h3>${health >= 85 ? t('Operacije su u dobrom stanju.','Operations are in good shape.') : health >= 60 ? t('Nekoliko područja traži pažnju.','Several areas need attention.') : t('Operativni pritisak je visok.','Operational pressure is high.')}</h3><p>${t('Rezultat je deterministički i izračunat iz stvarnog reda rada. Ne koristi izmišljenu AI sigurnost.','The result is deterministic and calculated from the real work queue. It uses no invented AI confidence.')}</p></div><div class="ci107-score"><b>${health}</b><small>${t('stanje','health')}</small></div></div><div class="ci107-grid"><div class="ci107-card"><em>${t('RJEŠAVANJE','RESOLUTION')}</em><b>${resolutionRate}%</b><span>${t('udio riješenih poznatih slučajeva','share of known cases resolved')}</span></div><div class="ci107-card"><em>${t('PRITISAK','PRESSURE')}</em><b>${activeCases}</b><span>${t('aktivni operativni signali','active operational signals')}</span></div><div class="ci107-card"><em>${t('KUPCI','CUSTOMERS')}</em><b>${customers.length}</b><span>${t('povezani zapisi kupaca','linked customer records')}</span></div><div class="ci107-card"><em>${t('MREŽA','NETWORK')}</em><b>${branches.length}</b><span>${t(`${branchLoad} aktivnih slučajeva po poslovnicama`,`${branchLoad} active cases across branches`)}</span></div></div><div class="ci107-recommendation"><div><span>${t('PREPORUČENA SLJEDEĆA RADNJA','RECOMMENDED NEXT ACTION')}</span><b>${esc(recommendation.title)}</b><p>${esc(recommendation.detail)} ${productPressure ? t(`Najopterećeniji proizvod ima ${productPressure} aktivnih slučajeva.`,`The highest-pressure product has ${productPressure} active cases.`) : ''}</p></div><button data-ci-action="${recommendation.action}">${t('Otvori radni red','Open work queue')} →</button></div><button class="ci107-refresh" data-ci-refresh>${t('Osvježi uvid','Refresh insight')}</button>`;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        panel.remove();
        return;
      }
      panel.innerHTML = `<div class="ci107-error"><b>${t('Platform Intelligence trenutačno nije dostupan.','Platform Intelligence is currently unavailable.')}</b><span>${esc(error.message)}</span><button class="ci107-refresh" data-ci-refresh>${t('Pokušaj ponovno','Try again')}</button></div>`;
    } finally {
      loading = false;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
