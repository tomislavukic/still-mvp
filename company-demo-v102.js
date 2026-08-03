(() => {
  const KEY = 'still-company-demo-v102';
  const preview = () => window.StillCompanyPreviewV102;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const hr = () => document.documentElement.lang !== 'en';
  const t = (croatian, english) => hr() ? croatian : english;
  const clone = value => JSON.parse(JSON.stringify(value));
  let state = read();

  function read() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (parsed?.modules) return parsed;
    } catch {}
    return {modules:{},startedAt:new Date().toISOString()};
  }
  function persist() {
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }
  function pick(value) { return preview()?.pick?.(value) ?? value; }
  function textCell(value) { return String(pick(value) ?? ''); }
  function toolState(tool) {
    if (!state.modules[tool.id]) state.modules[tool.id] = {rows:clone(tool.rows),filter:'all',search:'',selected:0,mode:'record',activity:[],steps:[],history:[]};
    const current = state.modules[tool.id];
    if (!Array.isArray(current.rows)) current.rows = clone(tool.rows);
    if (!Array.isArray(current.activity)) current.activity = [];
    if (!Array.isArray(current.steps)) current.steps = [];
    if (!Array.isArray(current.history)) current.history = [];
    return current;
  }
  function snapshot(module) {
    module.history.push(clone(module.rows));
    if (module.history.length > 12) module.history.shift();
  }
  function activity(module, message) {
    module.activity.unshift({message,at:new Date().toISOString()});
    if (module.activity.length > 30) module.activity.length = 30;
  }
  function time(value) {
    try { return new Intl.DateTimeFormat(hr() ? 'hr-HR' : 'en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(value)); } catch { return ''; }
  }
  function statusText(row) { return textCell(row[row.length - 1]).toLowerCase(); }
  function matchesFilter(row, filter) {
    const value = statusText(row);
    if (filter === 'attention') return /(pending|late|critical|attention|waiting|open|review|draft|missing|due|kasni|krit|paž|čeka|otvor|pregled|nacrt|nedost|dosp)/i.test(value);
    if (filter === 'completed') return /(done|complete|closed|approved|verified|published|awarded|healthy|active|dovrš|završen|zatvor|odobren|verific|objavljen|dodijeljen|uredno|aktiv)/i.test(value);
    return true;
  }
  function visibleRows(tool) {
    const module = toolState(tool);
    const query = module.search.trim().toLowerCase();
    return module.rows.map((row,key)=>({row,key})).filter(({row}) => matchesFilter(row,module.filter) && (!query || row.some(cell => textCell(cell).toLowerCase().includes(query))));
  }
  function rerender() { preview()?.render?.(); }
  function setResult(message) {
    const result = $('[data-cpv97-result]', $('#companyToolsPreviewV97'));
    if (!result) return;
    result.classList.add('done');
    result.innerHTML = `<i>✓</i><span>${esc(message)}</span>`;
  }

  function field(tool, cell, index, prefix = 'field') {
    const title = textCell(tool.columns[index]);
    const value = textCell(cell);
    if (index === tool.columns.length - 1) return `<label><span>${esc(title)}</span><select name="${prefix}${index}">${['Draft','Open','In progress','Waiting approval','Approved','Completed','Cancelled'].map(option => `<option value="${option}" ${value.toLowerCase() === option.toLowerCase() ? 'selected' : ''}>${t(option === 'In progress' ? 'U tijeku' : option === 'Waiting approval' ? 'Čeka odobrenje' : option === 'Approved' ? 'Odobreno' : option === 'Completed' ? 'Dovršeno' : option === 'Cancelled' ? 'Otkazano' : option === 'Open' ? 'Otvoreno' : 'Nacrt',option)}</option>`).join('')}<option value="${esc(value)}" selected>${esc(value || t('Nacrt','Draft'))}</option></select></label>`;
    return `<label><span>${esc(title)}</span><input name="${prefix}${index}" value="${esc(value)}" ${index === 0 ? 'required' : ''} maxlength="240"></label>`;
  }
  function recordForm(tool, module, create = false, actionName = '') {
    const row = create ? tool.columns.map((_,index) => index === 0 ? `DEMO-${String(Date.now()).slice(-5)}` : index === tool.columns.length - 1 ? t('Nacrt','Draft') : '') : module.rows[module.selected];
    if (!row) return empty(t('Odaberite zapis u tablici ili izradite novi.','Choose a record in the table or create a new one.'));
    return `<form class="cpv102-form" data-cpv102-form="${create ? 'create' : 'edit'}"><header><div><span>${create ? t('NOVA PRIVREMENA STAVKA','NEW TEMPORARY RECORD') : t('UREDI OGLEDNI ZAPIS','EDIT SAMPLE RECORD')}</span><h4>${esc(actionName || (create ? t('Izradite zapis kao u stvarnom radu','Create a record as you would in real work') : textCell(row[0])))}</h4></div><button type="button" data-cpv102-close aria-label="${t('Zatvori','Close')}">×</button></header><div class="cpv102-fields">${row.map((cell,index)=>field(tool,cell,index)).join('')}</div><label class="cpv102-note"><span>${t('Interna bilješka demonstracije','Demo internal note')}</span><textarea name="note" placeholder="${t('Objasnite odluku, dokaz ili sljedeći korak…','Explain the decision, evidence or next step…')}"></textarea></label><footer><button type="submit">${create ? t('Izradi privremeni zapis','Create temporary record') : t('Spremi promjene','Save changes')}</button>${create ? '' : `<button type="button" class="secondary" data-cpv102-duplicate>${t('Dupliciraj','Duplicate')}</button><button type="button" class="danger" data-cpv102-delete>${t('Izbriši iz demo sesije','Delete from demo session')}</button>`}</footer></form>`;
  }
  function workflowForm(tool, module, actionName) {
    const row = module.rows[module.selected] || module.rows[0];
    if (!row) return recordForm(tool,module,true,actionName);
    return `<form class="cpv102-form cpv102-workflow-form" data-cpv102-form="workflow"><header><div><span>${t('PRIVREMENA RADNJA','TEMPORARY ACTION')}</span><h4>${esc(actionName)}</h4><p>${t('Radnja mijenja samo ovu demo sesiju i stvara zapis aktivnosti.','This action changes only this demo session and creates an activity entry.')}</p></div><button type="button" data-cpv102-close aria-label="${t('Zatvori','Close')}">×</button></header><div class="cpv102-target"><span>${t('Ciljani zapis','Target record')}</span><b>${esc(textCell(row[0]))}</b><small>${esc(row.slice(1,3).map(textCell).join(' · '))}</small></div><div class="cpv102-fields"><label><span>${t('Novi status','New status')}</span><select name="status"><option value="In progress">${t('U tijeku','In progress')}</option><option value="Waiting approval">${t('Čeka odobrenje','Waiting approval')}</option><option value="Approved">${t('Odobreno','Approved')}</option><option value="Completed">${t('Dovršeno','Completed')}</option><option value="Cancelled">${t('Otkazano','Cancelled')}</option></select></label><label><span>${t('Odgovorna osoba','Owner')}</span><input name="owner" placeholder="${t('npr. Maja K.','e.g. Maja K.')}"></label></div><label class="cpv102-note"><span>${t('Odluka, dokaz ili poruka','Decision, evidence or message')}</span><textarea name="note" required placeholder="${t('Zabilježite što je učinjeno i zašto…','Record what was done and why…')}"></textarea></label><footer><button type="submit">${esc(actionName)}</button><button type="button" class="secondary" data-cpv102-close>${t('Odustani','Cancel')}</button></footer></form>`;
  }
  function empty(message) { return `<div class="cpv102-empty">${esc(message)}</div>`; }
  function scenario(tool, module) {
    return `<section class="cpv102-scenario"><header><div><span>${t('VOĐENI SCENARIJ','GUIDED SCENARIO')}</span><h4>${t('Prođite cijeli tijek kao budući korisnik','Walk through the complete flow as a future user')}</h4></div><strong>${module.steps.filter(Boolean).length}/${tool.workflow.length}</strong></header><div>${tool.workflow.map((step,index)=>`<button type="button" data-cpv102-step="${index}" class="${module.steps[index] ? 'done' : ''}"><i>${module.steps[index] ? '✓' : index + 1}</i><span>${esc(textCell(step))}</span></button>`).join('')}</div></section>`;
  }
  function activityList(module) {
    return `<section class="cpv102-activity"><header><span>${t('AKTIVNOST OVE SESIJE','THIS SESSION ACTIVITY')}</span><button type="button" data-cpv102-hide-activity>×</button></header>${module.activity.map(item=>`<article><i></i><div><b>${esc(item.message)}</b><small>${time(item.at)}</small></div></article>`).join('') || empty(t('Još nema aktivnosti. Izradite ili promijenite zapis.','No activity yet. Create or change a record.'))}</section>`;
  }
  function panel(tool) {
    const module = toolState(tool);
    let body = '';
    if (module.mode === 'create') body = recordForm(tool,module,true,module.actionName);
    else if (module.mode === 'workflow') body = workflowForm(tool,module,module.actionName || t('Dovrši radnju','Complete action'));
    else if (module.mode === 'activity') body = activityList(module);
    else body = recordForm(tool,module,false);
    return `<div class="cpv102-studio-head"><div><span>${t('DEMO STUDIO · SAMO OVA KARTICA','DEMO STUDIO · THIS TAB ONLY')}</span><h3>${t('Radite s modulom, ne samo gledajte ga.','Operate the module, don’t just view it.')}</h3><p>${t('Zapisi, promjene i aktivnosti postoje samo u ovoj kartici preglednika. Ništa se ne šalje kupcima, tvrtkama ni produkcijskoj bazi.','Records, changes and activity exist only in this browser tab. Nothing is sent to buyers, businesses or the production database.')}</p></div><div class="cpv102-studio-actions"><button type="button" data-cpv102-new>${t('+ Novi zapis','+ New record')}</button><button type="button" class="secondary" data-cpv102-activity>${t('Aktivnost','Activity')} <b>${module.activity.length}</b></button><button type="button" class="secondary" data-cpv102-export>${t('CSV izvoz','CSV export')}</button><button type="button" class="secondary" data-cpv102-undo ${module.history.length ? '' : 'disabled'}>${t('Poništi','Undo')}</button><button type="button" class="secondary" data-cpv102-reset>${t('Resetiraj modul','Reset module')}</button></div></div><div class="cpv102-demo-metrics"><div><b>${module.rows.length}</b><span>${t('privremenih zapisa','temporary records')}</span></div><div><b>${module.activity.length}</b><span>${t('radnji ove sesije','session actions')}</span></div><div><b>${module.steps.filter(Boolean).length}</b><span>${t('koraka scenarija','scenario steps')}</span></div><div><b>${t('NE SPREMA SE','NOT SAVED')}</b><span>${t('produkcijski podaci','production data')}</span></div></div>${scenario(tool,module)}<div class="cpv102-editor">${body}</div><footer class="cpv102-reset-all"><span>${t('Želite početi potpuno iznova?','Want to start completely over?')}</span><button type="button" data-cpv102-reset-all>${t('Resetiraj svih 29 modula','Reset all 29 modules')}</button></footer>`;
  }

  function afterRender(tool) {
    const module = toolState(tool);
    const select = $('[data-cpv97-view]');
    if (select) select.value = module.filter || 'all';
    const host = $('#cpv102DemoPanel');
    if (host) host.innerHTML = panel(tool);
    document.querySelectorAll('[data-cpv97-row]').forEach(row => row.classList.toggle('selected', Number(row.dataset.cpv97Row) === module.selected));
    persist();
  }
  function searchValue(tool) { return toolState(tool).search || ''; }
  function setFilter(tool, value) { const module=toolState(tool);module.filter=value;persist();rerender(); }

  function exportCSV(tool) {
    const module = toolState(tool);
    const quote = value => `"${textCell(value).replaceAll('"','""')}"`;
    const csv = [tool.columns.map(quote).join(','),...module.rows.map(row=>row.map(quote).join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `still-demo-${tool.id}.csv`;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    activity(module,t('Izvezen je privremeni CSV.','Temporary CSV exported.'));persist();afterRender(tool);setResult(t('CSV s trenutačnim demo zapisima je preuzet.','CSV with the current demo records was downloaded.'));
  }
  function openAction(tool, index) {
    const module = toolState(tool);
    const name = textCell(tool.actions[index]);
    if (/export|izvezi/i.test(name)) return exportCSV(tool);
    if (/preview|review|view|open sample|inspect|pregled|prikaži|otvori ogled/i.test(name)) {
      module.mode = 'record'; module.selected = Math.min(module.selected,module.rows.length-1);activity(module,t(`Otvoren pregled: ${name}.`,`Opened review: ${name}.`));
    } else if (index === 0) {
      module.mode = 'create'; module.actionName = name;
    } else {
      module.mode = 'workflow'; module.actionName = name;
    }
    persist(); rerender();
    setTimeout(()=>$('#cpv102DemoPanel')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'}),0);
  }

  function valuesFromForm(form, tool) {
    const data = new FormData(form);
    return tool.columns.map((_,index)=>data.get(`field${index}`) || '—');
  }
  function current() { const tool=preview()?.tool?.();return tool ? {tool,module:toolState(tool)} : {}; }
  function closeEditor(tool,module) { module.mode='record';persist();rerender(); }

  document.addEventListener('input', event => {
    if (!event.target.matches('[data-cpv102-search]')) return;
    const {tool,module}=current();if(!tool)return;module.search=event.target.value;persist();clearTimeout(module.searchTimer);module.searchTimer=setTimeout(rerender,120);
  });
  document.addEventListener('keydown', event => {
    const row = event.target.closest('[data-cpv97-row]');
    if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault();row.click(); }
  });
  document.addEventListener('click', event => {
    const {tool,module}=current();if(!tool)return;
    const row=event.target.closest('[data-cpv97-row]');if(row){module.selected=Number(row.dataset.cpv97Row);module.mode='record';persist();rerender();return;}
    if(event.target.closest('[data-cpv102-new]')){module.mode='create';module.actionName=t('Novi zapis','New record');persist();rerender();return;}
    if(event.target.closest('[data-cpv102-close],[data-cpv102-hide-activity]')){closeEditor(tool,module);return;}
    if(event.target.closest('[data-cpv102-activity]')){module.mode='activity';persist();rerender();return;}
    if(event.target.closest('[data-cpv102-export]')){exportCSV(tool);return;}
    if(event.target.closest('[data-cpv102-undo]')){const previous=module.history.pop();if(previous){module.rows=previous;activity(module,t('Posljednja promjena je poništena.','Last change undone.'));module.selected=Math.min(module.selected,module.rows.length-1);persist();rerender();}return;}
    if(event.target.closest('[data-cpv102-reset]')){state.modules[tool.id]={rows:clone(tool.rows),filter:'all',search:'',selected:0,mode:'record',activity:[],steps:[],history:[]};persist();rerender();setResult(t('Ovaj modul vraćen je na početne ogledne podatke.','This module was reset to its original sample data.'));return;}
    if(event.target.closest('[data-cpv102-reset-all]')){state={modules:{},startedAt:new Date().toISOString()};persist();rerender();setResult(t('Svih 29 modula vraćeno je na početak.','All 29 modules were reset.'));return;}
    const step=event.target.closest('[data-cpv102-step]');if(step){const index=Number(step.dataset.cpv102Step);module.steps[index]=!module.steps[index];activity(module,module.steps[index]?t(`Dovršen je korak ${index+1}.`,`Step ${index+1} completed.`):t(`Ponovno je otvoren korak ${index+1}.`,`Step ${index+1} reopened.`));persist();rerender();return;}
    if(event.target.closest('[data-cpv102-duplicate]')){const source=module.rows[module.selected];if(source){snapshot(module);module.rows.splice(module.selected+1,0,clone(source));module.selected++;activity(module,t(`Dupliciran zapis ${textCell(source[0])}.`,`Duplicated record ${textCell(source[0])}.`));persist();rerender();}return;}
    if(event.target.closest('[data-cpv102-delete]')){const source=module.rows[module.selected];if(source){snapshot(module);module.rows.splice(module.selected,1);activity(module,t(`Zapis ${textCell(source[0])} uklonjen je iz demo sesije.`,`Record ${textCell(source[0])} was removed from the demo session.`));module.selected=Math.max(0,Math.min(module.selected,module.rows.length-1));module.mode='record';persist();rerender();}return;}
  });
  document.addEventListener('submit', event => {
    const form=event.target.closest('[data-cpv102-form]');if(!form)return;event.preventDefault();const {tool,module}=current();if(!tool)return;
    const kind=form.dataset.cpv102Form;snapshot(module);
    if(kind==='create'){const row=valuesFromForm(form,tool);module.rows.unshift(row);module.selected=0;activity(module,t(`Izrađen privremeni zapis ${textCell(row[0])}.`,`Created temporary record ${textCell(row[0])}.`));setResult(t('Privremeni zapis je izrađen i dodan u tablicu.','Temporary record created and added to the table.'));}
    if(kind==='edit'){const row=valuesFromForm(form,tool);module.rows[module.selected]=row;activity(module,t(`Ažuriran privremeni zapis ${textCell(row[0])}.`,`Updated temporary record ${textCell(row[0])}.`));setResult(t('Promjene su spremljene samo u ovoj demo sesiji.','Changes were saved only in this demo session.'));}
    if(kind==='workflow'){const row=module.rows[module.selected];if(row){row[row.length-1]=new FormData(form).get('status');const owner=new FormData(form).get('owner'),note=new FormData(form).get('note');activity(module,t(`${module.actionName}: ${textCell(row[0])}${owner?' · '+owner:''}. ${note}`,`${module.actionName}: ${textCell(row[0])}${owner?' · '+owner:''}. ${note}`));setResult(t('Radnja je izvršena, status promijenjen i aktivnost zabilježena.','Action completed, status changed and activity recorded.'));}}
    module.mode='record';persist();rerender();
  });

  window.StillCompanyDemoV102={visibleRows,afterRender,openAction,setFilter,searchValue};
})();
