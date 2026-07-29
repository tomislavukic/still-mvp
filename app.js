const VERIFIED = 'July 29, 2026';
const policies = {
  apple: {name:'Apple', days:14, dateLabel:'Date received', dateHelp:'Apple’s standard U.S. window is measured from the date you received an eligible product.', url:'https://www.apple.com/shop/help/returns_refund', note:'Standard eligible purchases made directly from Apple: 14 calendar days after receipt. Carrier, wireless-service, software, personalized and other exceptions can apply.'},
  bestbuy: {name:'Best Buy', days:15, dateLabel:'Date received', dateHelp:'Use the date you received the product.', url:'https://www.bestbuy.com/site/help-topics/return-exchange-policy/pcmcat260800050014.c', variants:[['standard','Standard most products',15],['member','My Best Buy Plus / Total member',60],['activatable','Activatable device',14]], note:'Best Buy windows vary by membership and category. Activatable devices, major appliances, final-sale items, restocking fees and other exceptions require the official policy.'},
  target: {name:'Target', days:90, dateLabel:'Purchase / delivery date', dateHelp:'For online purchases, use the delivery or pickup date when the return window begins.', url:'https://www.target.com/help/articles/returns-exchanges/returns', variants:[['standard','Most items sold by Target',90],['electronics','Electronics / entertainment',30],['apple','Apple / Beats product',14],['targetplus','Target Plus partner item',30]], note:'Target has important category, seller, condition and membership exceptions. Target-owned brands and some Circle benefits can have longer windows; some items cannot be returned.'}
};
const $ = s => document.querySelector(s);
const form=$('#returnForm'), result=$('#result'), store=$('#store'), purchaseDate=$('#purchaseDate'), itemName=$('#itemName'), customDaysWrap=$('#customDaysWrap'), customDays=$('#customDays'), receiptInput=$('#receiptInput'), receiptPill=$('#receiptPill'), modifierWrap=$('#modifierWrap'), modifier=$('#modifier');
purchaseDate.max=new Date().toISOString().slice(0,10);
store.addEventListener('change', configureStore);
function configureStore(){
  const p=policies[store.value];
  customDaysWrap.classList.toggle('hidden',store.value!=='custom');
  modifierWrap.classList.add('hidden'); modifier.innerHTML='';
  $('#dateLabel').textContent=p?.dateLabel || (store.value==='custom'?'Policy start date':'Purchase / received date');
  $('#dateHelp').textContent=p?.dateHelp || (store.value==='custom'?'Use the date from which the retailer counts its return period.':'Choose a store to see which date to use.');
  if(p?.variants){ p.variants.forEach(([value,label])=>modifier.add(new Option(label,value))); modifierWrap.classList.remove('hidden'); }
}
document.querySelectorAll('[data-scroll]').forEach(btn=>btn.addEventListener('click',()=>$(btn.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
$('#focusForm').addEventListener('click',()=>store.focus());
receiptInput.addEventListener('change',()=>{const file=receiptInput.files?.[0];if(!file)return;if(file.size>8*1024*1024){receiptPill.textContent='That file is over 8 MB. Choose a smaller receipt image or PDF.';receiptPill.classList.remove('hidden');receiptInput.value='';return;}receiptPill.textContent=`✓ ${file.name} selected locally. Receipt reading is not enabled yet, so confirm the store and date below.`;receiptPill.classList.remove('hidden');store.focus();});
form.addEventListener('submit',event=>{
 event.preventDefault(); if(!store.value||!purchaseDate.value)return;
 const start=parseLocalDate(purchaseDate.value),today=startOfDay(new Date()); if(start>today){alert('The policy start date cannot be in the future.');return;}
 let policy;
 if(store.value==='custom'){const days=Number(customDays.value);if(!Number.isFinite(days)||days<1)return;policy={name:'Custom store',days,url:'',note:'Custom calculation only. Verify the retailer’s actual policy, start date and exceptions.',variantLabel:'Custom window'};}
 else {const base=policies[store.value];policy={...base};if(base.variants){const chosen=base.variants.find(v=>v[0]===modifier.value)||base.variants[0];policy.days=chosen[2];policy.variantLabel=chosen[1];}else policy.variantLabel='Standard policy';}
 const deadline=addDays(start,policy.days),ms=86400000,daysLeft=Math.ceil((deadline-today)/ms),elapsed=Math.max(0,Math.floor((today-start)/ms)),remaining=Math.max(0,Math.min(1,(policy.days-elapsed)/policy.days)),inside=daysLeft>=0;
 form.classList.add('hidden');result.classList.remove('hidden');const badge=$('#statusBadge');badge.classList.toggle('expired',!inside);badge.textContent=inside?'Estimated: inside window':'Estimated: window passed';
 $('#resultTitle').textContent=inside?(daysLeft===0?'Today may be your last day':`${daysLeft} day${daysLeft===1?'':'s'} left`):`Standard window passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft)===1?'':'s'} ago`;
 $('#deadlineText').textContent=inside?`Estimated return deadline: ${formatDate(deadline)}.`:`Estimated standard deadline: ${formatDate(deadline)}. An exception may still apply.`;
 $('#progressFill').style.width=`${remaining*100}%`;$('#resultStore').textContent=policy.name;$('#resultItem').textContent=itemName.value.trim()||'Not specified';$('#resultDate').textContent=formatDate(start);$('#resultWindow').textContent=`${policy.days} days · ${policy.variantLabel}`;$('#policyNote').textContent=policy.note;$('#verifiedText').textContent=policy.url?`Policy data last reviewed ${VERIFIED}. Always verify before acting.`:'Custom window supplied by you.';
 const link=$('#policyLink');if(policy.url){link.href=policy.url;link.classList.remove('hidden')}else link.classList.add('hidden');
});
$('#checkAnother').addEventListener('click',()=>{result.classList.add('hidden');form.classList.remove('hidden');itemName.value='';store.focus();});
function parseLocalDate(value){const[y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d)}
function startOfDay(date){return new Date(date.getFullYear(),date.getMonth(),date.getDate())}
function addDays(date,days){const copy=new Date(date);copy.setDate(copy.getDate()+days);return copy}
function formatDate(date){return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'}).format(date)}