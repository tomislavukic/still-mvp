(() => {
  if (window.__stillAnticipationV143) return;
  window.__stillAnticipationV143 = true;
  const root = () => document.querySelector('#stillOSV133');
  const hr = () => localStorage.getItem('still-lang') === 'hr';
  const t = (en, hrv) => hr() ? hrv : en;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char]);
  const api = async (path, options={}) => {
    const response = await fetch(path,{credentials:'same-origin',...options,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||data.message||String(response.status));
    return data;
  };

  function card(item) {
    return `<article class="ant143-card" data-ant-id="${esc(item.publicId)}">
      <div class="ant143-card-copy"><small>${t('MAY NEED ATTENTION','MOŽDA TREBA PAŽNJU')}</small><h3>${esc(item.title)}</h3><p>${esc(item.explanation)}</p><details><summary>${t('Why now?','Zašto sada?')}</summary><p>${esc(item.whyNow)}</p></details></div>
      <div class="ant143-actions"><button type="button" data-ant-action="confirm">${t('Handle it','Riješi')}</button><button type="button" data-ant-action="later">${t('Later','Kasnije')}</button><button type="button" data-ant-action="handled">${t('Already handled','Već riješeno')}</button><button type="button" data-ant-action="dismiss">${t('Not needed','Nije potrebno')}</button></div>
    </article>`;
  }

  function attention(item) {
    return `<article class="ant143-attention"><small>${esc(item.type==='SAFETY'?t('IMPORTANT','VAŽNO'):t('UPCOMING','USKORO'))}</small><h3>${esc(item.title)}</h3><p>${esc(item.whyNow)}</p></article>`;
  }

  async function getState() {
    const [candidates,attentionItems,schedules,preferences]=await Promise.all([
      api('/api/v1/world/anticipation'),api('/api/v1/world/attention'),api('/api/v1/world/schedules'),api('/api/v1/world/anticipation/preferences')
    ]);
    return {candidates:candidates.candidates||[],attention:attentionItems.attention||[],schedules:schedules.schedules||[],preferences:preferences.preferences||{}};
  }

  async function act(id, action) {
    if(action==='later'){
      const until=new Date(Date.now()+86400000).toISOString();
      return api(`/api/v1/world/anticipation/${encodeURIComponent(id)}/snooze`,{method:'POST',body:JSON.stringify({until})});
    }
    const map={confirm:'confirm',handled:'already-handled',dismiss:'dismiss'};
    return api(`/api/v1/world/anticipation/${encodeURIComponent(id)}/${map[action]}`,{method:'POST',body:'{}'});
  }

  async function openCenter() {
    let state;
    try{state=await getState()}catch(error){return window.alert(t('Still could not open proactive attention.','Still nije mogao otvoriti proaktivnu pažnju.'))}
    const overlay=document.createElement('div');overlay.className='ant143-overlay';overlay.innerHTML=`<section class="ant143-center" role="dialog" aria-modal="true" aria-labelledby="ant143Title">
      <header><div><small>${t('ANTICIPATION','PREDVIĐANJE')}</small><h2 id="ant143Title">${t('What may need attention','Što bi uskoro moglo trebati pažnju')}</h2><p>${t('Few signals. Clear reasons. You stay in control.','Malo signala. Jasni razlozi. Ti odlučuješ.')}</p></div><button type="button" data-ant-close aria-label="${t('Close','Zatvori')}">×</button></header>
      ${state.attention.length?`<section><h3>${t('Upcoming','Uskoro')}</h3><div class="ant143-grid">${state.attention.slice(0,3).map(attention).join('')}</div></section>`:''}
      <section><h3>${t('Needs review','Za pregled')}</h3>${state.candidates.length?`<div class="ant143-stack">${state.candidates.map(card).join('')}</div>`:`<div class="ant143-quiet"><span aria-hidden="true">✓</span><h3>${t("Everything's handled.",'Sve je riješeno.')}</h3><p>${t('Nothing needs you right now.','Trenutno ništa ne traži tvoju pažnju.')}</p></div>`}</section>
      <section class="ant143-settings"><header><div><h3>${t('Proactive settings','Proaktivne postavke')}</h3><p>${t('Turn categories on or off at any time.','Uključi ili isključi kategorije kad god želiš.')}</p></div><label><input type="checkbox" data-ant-pref="proactive_enabled" ${Number(state.preferences.proactive_enabled)!==0?'checked':''}><span>${t('Proactive reminders','Proaktivni podsjetnici')}</span></label></header>
      <div class="ant143-pref-grid">${[['warranty_enabled','Warranty','Jamstvo'],['returns_enabled','Returns','Povrati'],['service_enabled','Service','Servis'],['open_loops_enabled','Open loops','Otvorene obveze'],['market_wants_enabled','Market Wants','Market želje'],['product_notices_enabled','Product notices','Obavijesti o proizvodu'],['user_schedules_enabled','User schedules','Moji rasporedi']].map(([key,en,hrv])=>`<label><input type="checkbox" data-ant-pref="${key}" ${Number(state.preferences[key])!==0?'checked':''}><span>${t(en,hrv)}</span></label>`).join('')}</div></section>
    </section>`;
    document.body.appendChild(overlay);overlay.querySelector('[data-ant-close]').focus();
    overlay.addEventListener('click',async event=>{
      if(event.target===overlay||event.target.closest('[data-ant-close]')){overlay.remove();return}
      const action=event.target.closest('[data-ant-action]');if(action){const article=action.closest('[data-ant-id]');action.disabled=true;try{const result=await act(article.dataset.antId,action.dataset.antAction);if(result.needId)location.href=`/app/need/${encodeURIComponent(result.needId)}`;else article.remove()}catch{action.disabled=false}return}
      const pref=event.target.closest('[data-ant-pref]');if(pref){const payload={[pref.dataset.antPref]:pref.checked};try{await api('/api/v1/world/anticipation/preferences',{method:'PATCH',body:JSON.stringify(payload)})}catch{pref.checked=!pref.checked}}
    });
  }

  async function enhanceNow() {
    const main=document.querySelector('#stillOSMain');if(!main||location.pathname!=='/app'&&location.pathname!=='/app/')return;
    if(main.querySelector('[data-ant-now]'))return;
    try{
      const state=await getState(),items=[...state.attention.slice(0,1),...state.candidates.slice(0,2)];
      const section=document.createElement('section');section.className='ant143-now';section.dataset.antNow='';
      if(items.length){section.innerHTML=`<header><div><small>${t('RIGHT TIME','PRAVI TRENUTAK')}</small><h2>${t('May need your attention','Možda treba tvoju pažnju')}</h2></div><button type="button" data-ant-open>${t('Review','Pregled')}</button></header><div class="ant143-now-items">${items.map(item=>item.candidateType?`<button type="button" data-ant-open><b>${esc(item.title)}</b><span>${esc(item.whyNow)}</span></button>`:`<button type="button" data-ant-open><b>${esc(item.title)}</b><span>${esc(item.whyNow)}</span></button>`).join('')}</div>`}
      else section.innerHTML=`<button type="button" class="ant143-quiet-inline" data-ant-open><span aria-hidden="true">✓</span><div><b>${t("Everything's handled.",'Sve je riješeno.')}</b><small>${t('Nothing needs you right now.','Trenutno ništa ne traži tvoju pažnju.')}</small></div></button>`;
      main.prepend(section);
    }catch{}
  }

  document.addEventListener('click',event=>{if(event.target.closest('[data-ant-open]'))openCenter()});
  const observer=new MutationObserver(()=>enhanceNow());observer.observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('popstate',()=>setTimeout(enhanceNow));
  setTimeout(enhanceNow,400);
  window.StillAnticipationV143={open:openCenter,refresh:enhanceNow};
})();
