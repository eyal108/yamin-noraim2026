(()=>{
const REG='https://fhilbjbuhtqdwvxhiedz.supabase.co/rest/v1/yamim_noraim_registrations';
const {S,H,SEAT,reqKey}=YN;
let decorating=false;
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function familyCard(box,name){return [...box.querySelectorAll('.family')].find(x=>x.querySelector('.fname')?.textContent===name)}
function latestSeatTime(seats,name,sec){const ts=seats.filter(a=>a.family_name===name&&a.section===sec&&a.seat_id.startsWith(`L${S.layoutNo}-`)).map(a=>Date.parse(a.updated_at||a.created_at||0)).filter(Number.isFinite);return ts.length?Math.max(...ts):0}
function decorateSide(sec,regs,seats){const box=document.getElementById(sec==='men'?'menRequests':'womenRequests');if(!box)return 0;let changedCount=0;
 for(const r of regs){const need=Number(r[reqKey(sec)])||0;const currentSeats=seats.filter(a=>a.family_name===r.family_name&&a.section===sec&&a.seat_id.startsWith(`L${S.layoutNo}-`));const got=currentSeats.length;if(need===0&&got===0)continue;let card=familyCard(box,r.family_name);
  if(!card){card=document.createElement('div');card.className='family';card.innerHTML=`<div class="fname">${esc(r.family_name)}</div><div class="frags"></div><div class="progress"></div>`;box.appendChild(card)}
  card.classList.remove('seat-ok','seat-missing','seat-over');card.querySelectorAll('.changeBadge,.zeroRequest').forEach(x=>x.remove());
  const progress=card.querySelector('.progress');if(progress)progress.textContent=`שובצו ${got} מתוך ${need}${got<need?' · נותרו '+(need-got):''}`;
  if(got===need&&need>0)card.classList.add('seat-ok');else if(got<need)card.classList.add('seat-missing');else if(got>need)card.classList.add('seat-over');
  const regTime=Date.parse(r.updated_at||0),seatTime=latestSeatTime(seats,r.family_name,sec),changedAfter=got>0&&seatTime>0&&Number.isFinite(regTime)&&regTime>seatTime;
  let text='',kind='';
  if(need===0&&got>0){text=`הבקשה ירדה ל־0 — יש לשחרר ${got} מקומות`;kind='danger'}
  else if(got>need){text=`יש ${got-need} מקומות עודפים — יש לשחרר`;kind='danger'}
  else if(got<need&&got>0&&changedAfter){text=`הרישום עודכן אחרי השיבוץ — חסרים ${need-got} מקומות`;kind='warn'}
  else if(got<need){text=`חסרים ${need-got} מקומות לשיבוץ`;kind='warn'}
  else if(got===need&&got>0&&changedAfter){text='הרישום עודכן אחרי השיבוץ — הכמות עדיין תואמת';kind='info'}
  if(text){const b=document.createElement('div');b.className='changeBadge '+kind;b.textContent=text;card.appendChild(b);if(changedAfter||kind==='danger')changedCount++}
 }
 return changedCount}
async function decorate(){if(decorating)return;decorating=true;try{const [rr,sr]=await Promise.all([
  fetch(REG+'?select=family_name,rh_men,rh_women,yk_men,yk_women,notes,updated_at&order=family_name.asc',{headers:H}),
  fetch(SEAT+'?select=family_name,section,seat_id,created_at,updated_at&event=eq.'+S.event,{headers:H})]);
  if(!rr.ok||!sr.ok)return;const regs=await rr.json(),seats=await sr.json();const count=decorateSide('men',regs,seats)+decorateSide('women',regs,seats);
  let pill=document.getElementById('changeSummary');if(!pill){pill=document.createElement('span');pill.id='changeSummary';pill.className='pill changeSummary';document.querySelector('.summary')?.appendChild(pill)}pill.style.display=count?'inline-block':'none';pill.textContent=`⚠ ${count} רישומים דורשים תשומת לב`;
 }finally{decorating=false}}
const oldRender=YN.render;YN.render=()=>{oldRender();setTimeout(decorate,0)};
const top=document.querySelector('.top');if(top&&!document.getElementById('refreshChanges')){const b=document.createElement('button');b.id='refreshChanges';b.className='btn refreshChanges';b.type='button';b.textContent='רענן רישומים';b.onclick=async()=>{b.disabled=true;b.textContent='מרענן...';try{await YN.load()}finally{b.disabled=false;b.textContent='רענן רישומים'}};top.insertBefore(b,document.getElementById('clear'))}
setTimeout(decorate,300);
})();