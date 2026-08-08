(() => {
  const STORAGE_KEY='still-ownership-passports-v83';
  const $=(s,r=document)=>r.querySelector(s);
  const isHr=()=>$('#language')?.value==='hr';
  const t=(en,hr)=>isHr()?hr:en;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function read(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
  function date(value){if(!value)return null;const d=new Date(value.length===10?`${value}T12:00:00`:value);return Number.isNaN(d.valueOf())?null:d}
  function label(d){return d?new Intl.DateTimeFormat(isHr()?'hr-HR':'en-GB',{day:'numeric',month:'short',year:'numeric'}).format(d):''}
  function icon(type){return({added:'＋',purchased:'✓',return:'↩',warranty:'◇',renewal:'↻',action:'→'})[type]||'•'}

  function events(passports){
    const out=[];
    passports.forEach(p=>{
      const title=p.title||t('Untitled passport','Putovnica bez naziva');
      const created=date(p.createdAt||p.updatedAt);
      if(created)out.push({type:'added',when:created,title,text:t('Added to your ownership','Dodano u tvoje vlasništvo')});
      const purchased=date(p.purchasedOn);
      if(purchased)out.push({type:'purchased',when:purchased,title,text:t('Purchase date recorded','Zabilježen datum kupnje')});
      const returnBy=date(p.returnBy);
      if(returnBy)out.push({type:'return',when:returnBy,title,text:t('Return window ends','Završava rok povrata'),future:true});
      const warranty=date(p.warrantyUntil);
      if(warranty)out.push({type:'warranty',when:warranty,title,text:t('Warranty ends','Jamstvo završava'),future:true});
      const renewal=date(p.renewalAt);
      if(renewal)out.push({type:'renewal',when:renewal,title,text:t('Renewal date','Datum obnove'),future:true});
      const next=date(p.nextActionAt);
      if(next)out.push({type:'action',when:next,title,text:t('Next action due','Sljedeća radnja'),future:true});
    });
    const now=new Date();
    return out.sort((a,b)=>{
      const af=a.when>=now,bf=b.when>=now;
      if(af!==bf)return af?-1:1;
      return af?a.when-b.when:b.when-a.when;
    }).slice(0,14);
  }

  function render(){
    if(document.body.classList.contains('business-page'))return false;
    const anchor=$('#ownershipHomeV112')||$('#discoverV83');
    if(!anchor)return false;
    let section=$('#ownershipFeedV113');
    if(!section){section=document.createElement('section');section.id='ownershipFeedV113';section.className='of113';anchor.insertAdjacentElement('afterend',section)}
    const items=events(read());
    section.innerHTML=`<header><div><span>${t('OWNERSHIP ACTIVITY','AKTIVNOST VLASNIŠTVA')}</span><h2>${t('What changed, and what is coming.','Što se promijenilo i što slijedi.')}</h2></div><a href="#timelineV83">${t('Open timeline','Otvori vremensku crtu')} →</a></header><div class="of113-list">${items.length?items.map(item=>`<a href="#ownershipHubV83" class="of113-row"><span class="of113-icon">${icon(item.type)}</span><div><b>${esc(item.title)}</b><small>${esc(item.text)}</small></div><time>${esc(label(item.when))}</time></a>`).join(''):`<div class="of113-empty"><span>＋</span><div><b>${t('Your ownership story starts with the first thing you add.','Tvoja priča vlasništva počinje prvom stvari koju dodaš.')}</b><small>${t('Still? will build this activity view from real passport dates and changes.','Still? će iz stvarnih datuma i promjena putovnica izgraditi ovaj prikaz aktivnosti.')}</small></div><button type="button" data-of113-add>${t('Add something','Dodaj nešto')}</button></div>`}</div>`;
    section.querySelector('[data-of113-add]')?.addEventListener('click',()=>$('#ownershipHubV83')?.scrollIntoView({behavior:'smooth',block:'start'}));
    return true;
  }

  function start(){
    if(!render()){
      const observer=new MutationObserver(()=>{if(render())observer.disconnect()});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),10000);
    }
    window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY)render()});
    window.addEventListener('still:ownership-updated',render);
    window.addEventListener('still:commerce-paid',render);
    document.addEventListener('submit',e=>{if(e.target?.id==='passportFormV83')setTimeout(render,100)});
    $('#language')?.addEventListener('change',()=>setTimeout(render,20));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
