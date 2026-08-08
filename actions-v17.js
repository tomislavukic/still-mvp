(()=>{
  const $=s=>document.querySelector(s),lang=()=>localStorage.getItem('still-lang')==='hr'?'hr':'en',t={en:{policy:'Policy',reminder:'Reminder',message:'Message'},hr:{policy:'Pravila',reminder:'Podsjetnik',message:'Poruka'}};
  function render(){
    const result=$('#result');
    if(!result||result.classList.contains('hidden'))return;
    let dock=$('#v17ActionDock');
    if(!dock){dock=document.createElement('div');dock.id='v17ActionDock';dock.className='v17-action-dock';($('#v17Summary')||result.firstChild)?.after(dock)}
    const c=t[lang()],policy=$('#policyLink'),reminder=$('#addReminder');
    dock.innerHTML=`${policy?.href?`<a href="${policy.href}" target="_blank" rel="noopener"><span>↗</span>${c.policy}</a>`:''}${reminder&&!reminder.classList.contains('hidden')?`<button type="button" data-v17-action="reminder"><span>◷</span>${c.reminder}</button>`:''}<button type="button" data-v17-action="message"><span>✉</span>${c.message}</button>`;
    dock.querySelector('[data-v17-action="reminder"]')?.addEventListener('click',()=>reminder?.click());
    dock.querySelector('[data-v17-action="message"]')?.addEventListener('click',()=>$('#v17Message')?.scrollIntoView({behavior:'smooth',block:'center'}));
  }

  const isHr=()=>document.querySelector('#language')?.value==='hr';
  const copy=(en,hr)=>isHr()?hr:en;
  function setMeta(name,value){document.querySelector(`meta[name="${name}"]`)?.setAttribute('content',value)}
  function setProperty(property,value){document.querySelector(`meta[property="${property}"]`)?.setAttribute('content',value)}

  function repositionBuyer(){
    if(document.body.classList.contains('business-page'))return false;
    const home=$('#discoverV83');
    if(!home)return false;

    document.title=copy('Still? · Everything you own.','Still? · Sve što posjeduješ.');
    setMeta('description',copy(
      'Everything you own, in one calm place. Keep products, services, subscriptions, documents, dates, service history and the next action together.',
      'Sve što posjeduješ na jednom mirnom mjestu. Čuvaj proizvode, usluge, pretplate, dokumente, datume, servisnu povijest i sljedeću radnju zajedno.'
    ));
    setProperty('og:title',copy('Still? · Everything you own.','Still? · Sve što posjeduješ.'));
    setProperty('og:description',copy('Keep what you own organized, useful and ready when you need it.','Drži ono što posjeduješ organizirano, korisno i spremno kada ti zatreba.'));

    const kicker=home.querySelector('.op83-kicker');
    if(kicker)kicker.textContent=copy('BUYEROS · EVERYTHING YOU OWN','BUYEROS · SVE ŠTO POSJEDUJEŠ');
    const heading=home.querySelector('h1');
    if(heading)heading.innerHTML=copy('Everything you own.<br><em>Finally in one place.</em>','Sve što posjeduješ.<br><em>Napokon na jednom mjestu.</em>');
    const lead=home.querySelector('.op83-home-copy>p');
    if(lead)lead.textContent=copy(
      'Add the things and services you already have, keep their documents and important dates together, and know what needs attention next. No company connection required.',
      'Dodaj stvari i usluge koje već imaš, drži njihove dokumente i važne datume zajedno i uvijek znaj što sljedeće traži pažnju. Povezivanje s tvrtkom nije potrebno.'
    );

    const tasks=home.querySelector('.v84-task-grid');
    if(tasks){
      tasks.setAttribute('aria-label',copy('Start with what you already own','Počni s onime što već posjeduješ'));
      tasks.innerHTML=`
        <a href="#ownershipHubV83"><span>01</span><b>${copy('Add what I already own','Dodaj ono što već imam')}</b><small>${copy('Products, services, subscriptions, bookings and projects.','Proizvodi, usluge, pretplate, rezervacije i projekti.')}</small><i>→</i></a>
        <a href="#lifecyclePlatformV95"><span>02</span><b>${copy('Keep the important stuff','Sačuvaj ono važno')}</b><small>${copy('Documents, service history, support, alerts and useful context.','Dokumenti, servisna povijest, podrška, upozorenja i koristan kontekst.')}</small><i>→</i></a>
        <a href="#timelineV83"><span>03</span><b>${copy('See what comes next','Vidi što slijedi')}</b><small>${copy('Returns, renewals, warranty endings and maintenance in one queue.','Povrati, obnove, završeci jamstva i održavanje u jednom redu.')}</small><i>→</i></a>
        <a href="#checker"><span>04</span><b>${copy('Resolve it when needed','Riješi kada zatreba')}</b><small>${copy('Returns, warranty, evidence and the next practical step.','Povrat, jamstvo, dokazi i sljedeći praktični korak.')}</small><i>→</i></a>`;
    }

    const positioning=home.querySelector('.op83-positioning');
    if(positioning)positioning.innerHTML=`<b>${copy('Start with your real life, not a blank account.','Počni sa stvarnim životom, ne praznim računom.')}</b> ${copy(
      'Still? works with things you bought before Still? existed. Add them yourself first; verified company data can enrich them later only when you choose to connect.',
      'Still? radi i sa stvarima kupljenima prije nego što je Still? postojao. Prvo ih dodaj sam; podaci verificirane tvrtke mogu ih kasnije obogatiti samo ako se odlučiš povezati.'
    )}`;

    const connection=home.querySelector('.op83-connection');
    if(connection){
      connection.setAttribute('aria-label',copy('Your ownership flow','Tvoj tijek vlasništva'));
      connection.innerHTML=`
        <div class="op83-party"><span>01</span><b>${copy('Bring it in','Dodaj')}</b><small>${copy('Create a passport for something you already own or use.','Izradi putovnicu za nešto što već posjeduješ ili koristiš.')}</small></div>
        <div class="op83-bridge"><strong>Still?</strong><span>→</span><small>${copy('One ownership memory','Jedna memorija vlasništva')}</small></div>
        <div class="op83-party"><span>02</span><b>${copy('Stay ready','Budi spreman')}</b><small>${copy('Dates, documents, service history and next actions stay together.','Datumi, dokumenti, servisna povijest i sljedeće radnje ostaju zajedno.')}</small></div>`;
    }

    const ownershipHead=$('#ownershipHubV83 .op83-section-head h2');
    if(ownershipHead)ownershipHead.textContent=copy('Give everything important you own a useful home.','Daj svemu važnom što posjeduješ korisno mjesto.');
    const ownershipKicker=$('#ownershipHubV83 .op83-section-head .op83-kicker');
    if(ownershipKicker)ownershipKicker.textContent=copy('EVERYTHING YOU OWN','SVE ŠTO POSJEDUJEŠ');

    const nav=$('#featureNavV82');
    if(nav){
      const labels={discover:copy('Home','Početna'),buy:copy('Add','Dodaj'),things:copy('My things','Moje stvari'),timeline:copy('Next','Sljedeće'),resolve:copy('Resolve','Riješi')};
      nav.querySelectorAll('[data-feature-label]').forEach(link=>{
        if(link.dataset.featureLabel==='buy')link.href='#ownershipHubV83';
        const label=link.querySelector('b');if(label)label.textContent=labels[link.dataset.featureLabel]||label.textContent;
      });
      const business=nav.querySelector('.feature-nav-business');
      if(business){business.textContent=copy('CompanyOS · Coming soon','CompanyOS · Uskoro');business.title=copy('Public CompanyOS launch follows BuyerOS. Existing company access remains available.','Javno izdanje CompanyOS-a slijedi nakon BuyerOS-a. Postojeći pristup tvrtki ostaje dostupan.');}
    }

    document.body.dataset.stillPositioning='everything-you-own';
    return true;
  }

  function scheduleReposition(){
    if(repositionBuyer())return;
    const observer=new MutationObserver(()=>{if(repositionBuyer())observer.disconnect()});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),10000);
  }

  window.addEventListener('still:v17-refresh',render);
  document.addEventListener('change',e=>{
    if(e.target?.id==='language')setTimeout(()=>{render();repositionBuyer()},20);
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleReposition,{once:true});
  else scheduleReposition();
})();
