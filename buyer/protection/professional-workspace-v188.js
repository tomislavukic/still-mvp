(() => {
  if (window.StillProfessionalWorkspaceV188) return;
  const t = (en, hr) => document.documentElement.lang?.toLowerCase().startsWith('hr') ? hr : en;
  const api = async (path, options = {}) => { const response = await fetch(path, { credentials:'same-origin', headers:{'content-type':'application/json',...(options.headers||{})}, ...options }); const data = await response.json().catch(()=>({})); if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`); return data; };
  async function openAvailability() {
    const data = await api('/api/v1/professional/profile'), p = data.profile || {};
    const dialog = document.createElement('dialog'); dialog.className='spn188-availability-dialog';
    dialog.innerHTML=`<form class="spn188-card"><button type="button" class="spn188-close" aria-label="${t('Close','Zatvori')}">×</button><span>${t('AVAILABILITY','DOSTUPNOST')}</span><h2>${t('When can people count on you?','Kada ljudi mogu računati na tebe?')}</h2><p>${t('Change availability without reopening the complete Professional Mode setup.','Promijeni dostupnost bez ponovnog otvaranja cijelog Profesionalnog načina.')}</p><label>${t('Status','Status')}<select name="availabilityStatus"><option value="AVAILABLE">${t('Available','Dostupan')}</option><option value="LIMITED">${t('Limited','Ograničeno')}</option><option value="UNAVAILABLE">${t('Unavailable','Nedostupan')}</option><option value="PAUSED">${t('Paused','Pauzirano')}</option></select></label><label>${t('Weekly working capacity','Tjedni radni kapacitet')}<div class="spn188-hours"><input name="weeklyCapacityHours" type="number" min="1" max="168" inputmode="numeric" placeholder="40"><b>${t('hours / week','sati / tjedno')}</b></div></label><fieldset><legend>${t('Where you can work','Gdje možeš raditi')}</legend><label><input type="checkbox" name="locationModes" value="REMOTE"> ${t('Remote','Udaljeno')}</label><label><input type="checkbox" name="locationModes" value="LOCAL"> ${t('Local','Lokalno')}</label><label><input type="checkbox" name="locationModes" value="HYBRID"> ${t('Hybrid','Hibridno')}</label></fieldset><button type="submit" class="primary spn188-save">${t('Save availability','Spremi dostupnost')}</button><output aria-live="polite"></output></form>`;
    document.body.append(dialog);
    dialog.querySelector('[name=availabilityStatus]').value=p.availabilityStatus||'AVAILABLE';
    dialog.querySelector('[name=weeklyCapacityHours]').value=p.weeklyCapacityHours||'';
    (p.locationModes||[]).forEach(v=>{const el=dialog.querySelector(`[name=locationModes][value="${v}"]`);if(el)el.checked=true});
    dialog.querySelector('.spn188-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelector('.spn188-card').addEventListener('submit',async e=>{
      e.preventDefault();
      const f=e.currentTarget, button=f.querySelector('.spn188-save'), output=f.querySelector('output');
      button.disabled=true; output.textContent=t('Saving…','Spremam…');
      try {
        await api('/api/v1/professional/profile',{method:'PATCH',body:JSON.stringify({availabilityStatus:f.elements.availabilityStatus.value,weeklyCapacityHours:f.elements.weeklyCapacityHours.value?Number(f.elements.weeklyCapacityHours.value):null,locationModes:[...f.querySelectorAll('[name=locationModes]:checked')].map(x=>x.value)})});
        output.textContent=t('Availability saved.','Dostupnost spremljena.');
        setTimeout(()=>{dialog.close();location.reload()},250);
      } catch(err){ output.textContent=err.message; button.disabled=false; }
    });
    dialog.showModal();
  }
  function bind(){
    document.querySelectorAll('.spn136-availability button').forEach(button=>{
      if(button.dataset.spn188==='1') return;
      button.dataset.spn188='1';
      button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openAvailability()},{capture:true});
    });
  }
  const observer=new MutationObserver(bind); observer.observe(document.documentElement,{subtree:true,childList:true}); bind(); window.StillProfessionalWorkspaceV188={openAvailability};
})();