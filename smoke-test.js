/* Run with: node smoke-test.js */
const fs=require('fs');
const files=['index.html','app.js','enhancements.js','v10.js','theme.js','styles.css'];
const read=f=>fs.readFileSync(f,'utf8');
const fail=[];
for(const f of files){if(!fs.existsSync(f))fail.push(`missing ${f}`);}
if(!fail.length){
 const html=read('index.html'),app=read('app.js'),v10=read('v10.js'),enh=read('enhancements.js'),theme=read('theme.js'),css=read('styles.css');
 const ids=['returnForm','market','purchaseType','store','purchaseDate','itemName','result','language','themeToggle','pageShare','globalShare','addReminder','scanReceipt','retailerSearch'];
 ids.forEach(id=>{if(!html.includes(`id="${id}"`))fail.push(`missing DOM id ${id}`)});
 ['English','Hrvatski'].forEach(x=>{if(!html.includes(x))fail.push(`missing language ${x}`)});
 ['warrantyNote','goWarranty','goReturn'].forEach(k=>{if(!v10.includes(k))fail.push(`missing localization key ${k}`)});
 ['whatsapp','facebook','linkedin','telegram','email','native','copy'].forEach(k=>{if(!enh.includes(k)&&!app.includes(k))fail.push(`missing share route ${k}`)});
 if(!theme.includes("still-theme"))fail.push('theme preference is not persisted');
 if(!css.includes("[data-theme=\"dark\"]"))fail.push('dark theme CSS missing');
 if(!enh.includes('BEGIN:VCALENDAR'))fail.push('calendar reminder generation missing');
 if(!enh.includes('TextDetector'))fail.push('receipt OCR capability detection missing');
 if(!app.includes("eu14"))fail.push('EU withdrawal calculator missing');
}
if(fail.length){console.error('Still? smoke tests FAILED\n- '+fail.join('\n- '));process.exit(1)}
console.log('Still? smoke tests passed');