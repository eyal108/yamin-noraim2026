(()=>{
if(!window.YN||!window.supabase)return;
const {S,reqKey,createGroup,load,rowOrder}=YN;
const SUPA='https://fhilbjbuhtqdwvxhiedz.supabase.co';
const KEY='sb_publishable_sXoO_u65OB-SPt9OFPiz5A_XMUIIprl';
const db=supabase.createClient(SUPA,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let showing=false,current=null;

function fmtUsd(n){if(n==null||!Number.isFinite(Number(n)))return'';const x=Number(n);return'$'+x.toFixed(x<0.01?4:3)}
function clearMarks(){document.querySelectorAll('.aiSavedSeat,.aiSavedConflict').forEach(x=>x.classList.remove('aiSavedSeat','aiSavedConflict'));document.querySelectorAll('.aiSavedOverlay').forEach(x=>x.remove())}
function hideSaved(){showing=false;current=null;clearMarks();document.getElementById('aiSavedPanel')?.remove();const b=document.getElementById('lastAiProposalBtn');if(b)b.textContent='הצג הצעה אחרונה'}
async function session(){const {data:{session}}=await db.auth.getSession();return session}

function splitRuns(ids,section){
 const seats=[...new Set(ids)].map(id=>S.seats.find(s=>s.id===id)).filter(Boolean);
 seats.sort((a,b)=>a.row-b.row||rowOrder(section,a.row).findIndex(x=>x.id===a.id)-rowOrder(section,b.row).findIndex(x=>x.id===b.id));
 const runs=[];let cur=[];
 for(const seat of seats){
  const prev=cur[cur.length-1];
  if(!prev){cur=[seat];continue}
  const ord=rowOrder(section,seat.row),pi=ord.findIndex(x=>x.id===prev.id),si=ord.findIndex(x=>x.id===seat.id),sameSegment=seat.row===8||seat.segment===prev.segment;
  if(seat.row===prev.row&&sameSegment&&si===pi+1)cur.push(seat);else{runs.push(cur);cur=[seat]}
 }
 if(cur.length)runs.push(cur);return runs;
}

function groupsFromPlan(plan){
 const out=[];
 for(const p of plan?.placements||[]){
  const family=String(p.family||''),section=p.section,ids=Array.isArray(p.seat_ids)?p.seat_ids:[],runs=splitRuns(ids,section);
  for(const run of runs)out.push({family,section,seats:run,missingIds:[],reason:String(p.reason||'')});
  const found=new Set(runs.flat().map(s=>s.id)),missingIds=ids.filter(id=>!found.has(id));
  if(missingIds.length)out.push({family,section,seats:[],missingIds,reason:String(p.reason||'')});
 }
 return out;
}

function inspect(groups){
 const conflicts=new Set(),issues=[];
 const planned=new Map();
 for(const g of groups){
  const key=g.section+'|'+g.family;planned.set(key,(planned.get(key)||0)+g.seats.length);
  if(!S.regs.some(r=>r.family_name===g.family)){issues.push(`המשפחה ${g.family} כבר אינה ברישום.`);g.seats.forEach(s=>conflicts.add(s.id));continue}
  for(const id of g.missingIds||[]){issues.push(`הכיסא ${id} כבר אינו קיים בתצורה.`)}
  for(const s of g.seats){
   const real=S.seats.find(x=>x.id===s.id);
   if(!real||real.section!==g.section){conflicts.add(s.id);issues.push(`הכיסא ${s.id} כבר אינו קיים בתצורה.`);continue}
   const a=S.assignments.find(x=>x.seat_id===s.id);
   if(a){conflicts.add(s.id);issues.push(`הכיסא ${s.id} תפוס כעת על ידי ${a.family_name}.`)}
  }
 }
 for(const [key,n] of planned){
  const [section,family]=key.split('|'),r=S.regs.find(x=>x.family_name===family);if(!r)continue;
  const need=Number(r[reqKey(section)])||0,assigned=S.assignments.filter(a=>a.family_name===family&&a.section===section).length,remaining=Math.max(0,need-assigned);
  if(n>remaining)issues.push(`${family}: ההצעה כוללת ${n} מקומות אבל נותרו כרגע רק ${remaining}.`);
 }
 return{conflicts,issues:[...new Set(issues)],valid:issues.length===0};
}

function draw(groups,conflicts){
 clearMarks();
 const seatEls=[...document.querySelectorAll('.seat[data-seat]')];
 groups.forEach((g,i)=>{
  const ids=new Set(g.seats.map(s=>s.id)),els=seatEls.filter(el=>ids.has(el.dataset.seat));
  els.forEach(el=>el.classList.add(conflicts.has(el.dataset.seat)?'aiSavedConflict':'aiSavedSeat'));
  if(!els.length)return;
  const row=els[0].closest('.rowseats');if(!row)return;
  const left=Math.min(...els.map(e=>e.offsetLeft)),right=Math.max(...els.map(e=>e.offsetLeft+e.offsetWidth));
  const overlay=document.createElement('div');overlay.className='aiSavedOverlay'+(els.some(e=>conflicts.has(e.dataset.seat))?' conflict':'');overlay.style.left=left+'px';overlay.style.width=(right-left)+'px';overlay.textContent=g.family;overlay.title=g.reason?`${g.family}: ${g.reason}`:g.family;row.appendChild(overlay);
 });
}

function detailText(groups){
 return groups.map(g=>`${g.family} — ${g.section==='men'?'גברים':'נשים'}: ${[...g.seats.map(s=>s.id),...(g.missingIds||[])].join(', ')}${g.reason?' — '+g.reason:''}`).join('\n');
}

function renderPanel(saved,groups,check){
 document.getElementById('aiSavedPanel')?.remove();
 const p=document.createElement('div');p.id='aiSavedPanel';p.className='aiSavedPanel';
 const when=saved.created_at?new Date(saved.created_at).toLocaleString('he-IL'):'';
 const n=groups.reduce((sum,g)=>sum+g.seats.length,0),cost=fmtUsd(saved.usage?.estimated_cost_usd);
 p.innerHTML=`<div class="aiSavedHead"><b>הצעת AI אחרונה</b><span>${when}${saved.model?' · '+saved.model:''}${cost?' · עלות הקריאה '+cost:''} · ${n} מקומות</span></div><div class="aiSavedState"></div><div class="aiSavedActions"><button type="button" class="btn aiSavedApply">החל את ההצעה</button><button type="button" class="btn aiSavedDetails">הצג פירוט</button><button type="button" class="btn aiSavedHide">הסתר</button></div><pre class="aiSavedDetail" hidden></pre>`;
 const state=p.querySelector('.aiSavedState'),apply=p.querySelector('.aiSavedApply'),detail=p.querySelector('.aiSavedDetail'),toggle=p.querySelector('.aiSavedDetails');
 if(check.valid){state.textContent='ההצעה עדיין מתאימה למצב הנוכחי. הכיסאות מסומנים בסגול.'}else{state.textContent='ההצעה נשמרה, אבל המצב השתנה מאז. כיסאות בעייתיים מסומנים באדום; לא ניתן להחיל אותה כפי שהיא.';apply.disabled=true;apply.title=check.issues.slice(0,5).join('\n')}
 detail.textContent=detailText(groups)+(check.issues.length?'\n\nבעיות נוכחיות:\n'+check.issues.join('\n'):'');
 toggle.onclick=()=>{detail.hidden=!detail.hidden;toggle.textContent=detail.hidden?'הצג פירוט':'הסתר פירוט'};
 p.querySelector('.aiSavedHide').onclick=hideSaved;
 apply.onclick=()=>applySaved(groups,check);
 const summary=document.querySelector('.summary');(summary||document.querySelector('.top'))?.after(p);
}

async function applySaved(groups,check){
 if(!check.valid)return;
 if(!confirm('להחיל עכשיו את הצעת ה-AI השמורה?'))return;
 const btn=document.querySelector('#aiSavedPanel .aiSavedApply');if(btn){btn.disabled=true;btn.textContent='שומר...'}
 try{
  for(const g of groups)await createGroup(g.family,g.section,g.seats,'ai:'+Date.now()+':'+crypto.randomUUID());
  await load();hideSaved();alert('הצעת ה-AI השמורה הוחלה בהצלחה.');
 }catch(e){alert('שמירת ההצעה נכשלה: '+e.message);if(btn){btn.disabled=false;btn.textContent='החל את ההצעה'}}
}

async function showLatest(){
 if(showing)return hideSaved();
 const s=await session();if(!s)return alert('יש להתחבר כמנהל כדי להציג את הצעת ה-AI האחרונה.');
 const b=document.getElementById('lastAiProposalBtn');if(b){b.disabled=true;b.textContent='טוען הצעה...'}
 try{
  const r=await fetch(`${SUPA}/functions/v1/ai-seat?event=${encodeURIComponent(S.event)}&layout_no=${S.layoutNo}`,{headers:{Authorization:'Bearer '+s.access_token,apikey:KEY}});
  const data=await r.json().catch(()=>({}));
  if(r.status===404&&data.code==='NO_SAVED_PROPOSAL')return alert('עדיין אין הצעת AI שמורה לחג ולתצורה האלה. הצעה חדשה שתיווצר מעכשיו תישמר אוטומטית.');
  if(!r.ok)throw Error(data.error||('HTTP '+r.status));
  const groups=groupsFromPlan(data.proposal);if(!groups.length)return alert('ההצעה השמורה אינה כוללת מקומות להצגה.');
  const check=inspect(groups);current={data,groups,check};showing=true;draw(groups,check.conflicts);renderPanel(data,groups,check);if(b)b.textContent='הסתר הצעה אחרונה';
 }catch(e){alert('טעינת הצעת AI שמורה נכשלה: '+e.message)}finally{if(b)b.disabled=false}
}

function addUi(){
 let b=document.getElementById('lastAiProposalBtn');if(b)return;
 const top=document.querySelector('.top');if(!top)return;
 b=document.createElement('button');b.id='lastAiProposalBtn';b.className='btn';b.type='button';b.textContent='הצג הצעה אחרונה';b.onclick=showLatest;
 const anchor=document.getElementById('clearAiBtn')||document.getElementById('aiSeatBtn')||document.getElementById('clear');anchor?.after(b);
 document.querySelectorAll('.eventTab,.layoutTab').forEach(x=>x.addEventListener('click',()=>{if(showing)hideSaved()},{capture:true}));
}

const st=document.createElement('style');st.textContent=`
.aiSavedSeat{background:#e8f1ff!important;border-color:#4f78b8!important}.aiSavedConflict{background:#ffe7e7!important;border-color:#b44!important}.aiSavedOverlay{position:absolute;top:0;height:var(--h);display:flex;align-items:center;justify-content:center;background:#e8f1ff;border:2px dashed #4f78b8;border-radius:6px;z-index:7;pointer-events:none;padding:0 5px;font-size:12px;font-weight:900;line-height:1;color:#23456f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}.aiSavedOverlay.conflict{background:#ffe7e7;border-color:#b44;color:#7b1f1f}.aiSavedPanel{margin:10px 0 12px;padding:10px 12px;border:1px solid #b9c9df;border-radius:10px;background:#f8fbff}.aiSavedHead{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.aiSavedHead span{font-size:12px;color:#56677d}.aiSavedState{font-size:12px;margin-top:5px}.aiSavedActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.aiSavedDetail{white-space:pre-wrap;max-height:220px;overflow:auto;font:12px/1.45 system-ui;margin:8px 0 0;padding:8px;border-top:1px solid #d8e2ef}.aiSavedApply{background:#345f93!important;color:#fff!important}.aiSavedApply:disabled{opacity:.5}@media(max-width:700px){.aiSavedPanel{padding:9px}.aiSavedActions .btn{min-height:40px}}
`;document.head.appendChild(st);
addUi();new MutationObserver(addUi).observe(document.body,{childList:true,subtree:true});
})();
