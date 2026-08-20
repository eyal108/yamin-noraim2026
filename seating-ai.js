(()=>{
if(!window.YN||!window.supabase)return;
const {S,reqKey,createGroup,load,rowOrder,H,SEAT}=YN;
const SUPA='https://fhilbjbuhtqdwvxhiedz.supabase.co';
const KEY='sb_publishable_sXoO_u65OB-SPt9OFPiz5A_XMUIIprl';
const db=supabase.createClient(SUPA,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const YEAR={
'אביקסיס':[{row:7,zone:'right',side:'right'}],'בלונדר':[{row:7,zone:'right',side:'left'}],'גוטליב':[{row:2,zone:'right',side:'right'}],'הר-זהב':[{row:2,zone:'right',side:'left'}],
'וידס':[{row:8,zone:'right',side:'left'}],'חן':[{row:4,zone:'right',side:'right'}],'נוב':[{row:4,zone:'left',side:'left'}],'פורת':[{row:4,zone:'left',side:'center'}],
'פישמן - זכות':[{row:5,zone:'right',side:'right'}],'צדוק':[{row:5,zone:'right',side:'left'}],'קסדו':[{row:3,zone:'left',side:'left'}],'קסנר':[{row:6,zone:'center',side:'right'}],
'רוט':[{row:8,zone:'center',side:'left'}],'שריד':[{row:2,zone:'center',side:'left'}],'שטרק 1':[{row:1,zone:'left',side:'center'},{row:1,zone:'center',side:'center'}],
'צחי':[{row:8,zone:'left',side:'right'},{row:8,zone:'center',side:'right'}]
};
let activePreview=null;
const countAssigned=(family,section)=>S.assignments.filter(a=>a.family_name===family&&a.section===section).length;
function fmtUsd(n){if(n==null||!Number.isFinite(Number(n)))return'לא ידוע';const x=Number(n);return'$'+x.toFixed(x<0.01?4:3)}
function usageText(u){if(!u)return'';let s=`עלות משוערת לקריאה: ${fmtUsd(u.estimated_cost_usd)}`;if(u.cumulative_cost_usd!=null)s+=` · מצטבר: ${fmtUsd(u.cumulative_cost_usd)}`;if(u.calls!=null)s+=` (${u.calls} קריאות)`;return s}
function showUsage(u){if(!u)return;let el=document.getElementById('aiCostBadge');if(!el){el=document.createElement('span');el.id='aiCostBadge';el.className='aiUsage';const clear=document.getElementById('clearAiBtn');(clear?.parentNode||document.querySelector('.top'))?.insertBefore(el,clear?.nextSibling||null)}el.textContent=usageText(u);el.title=`קלט: ${u.input_tokens||0} טוקנים · פלט: ${u.output_tokens||0} · מטמון: ${u.cached_input_tokens||0} · סה״כ: ${u.total_tokens||0}`}
function payload(){
 const occupied=new Set(S.assignments.map(a=>a.seat_id));
 const families=S.regs.map(r=>{const men=Number(r[reqKey('men')])||0,women=Number(r[reqKey('women')])||0,am=countAssigned(r.family_name,'men'),aw=countAssigned(r.family_name,'women');return{
  family:r.family_name,notes:r.notes||'',reference:YEAR[r.family_name]||[],requested:{men,women},assigned:{men:am,women:aw},remaining:{men:Math.max(0,men-am),women:Math.max(0,women-aw)},
  existing_seats:{men:S.assignments.filter(a=>a.family_name===r.family_name&&a.section==='men').map(a=>a.seat_id),women:S.assignments.filter(a=>a.family_name===r.family_name&&a.section==='women').map(a=>a.seat_id)}
 }}).filter(f=>f.remaining.men||f.remaining.women);
 return{event:S.event,layout_no:S.layoutNo,rules:{existing_assignments_are_locked:true,avoid_splitting:true,prefer_adjacent_rows_if_split:true,row8_is_continuous:true,stage_seats_are_not_in_seat_list:true},families,seats:S.seats.map(s=>({id:s.id,section:s.section,row:s.row,block:String(s.block),order:s.order,segment:s.segment||'',occupied:occupied.has(s.id)}))};
}
async function adminSession(){const {data:{session}}=await db.auth.getSession();if(!session){alert('שיבוץ AI זמין למנהל מחובר בלבד. יש להתחבר במסך הניהול ואז לחזור לסידור ההושבה.');location.href='admin.html';return null}return session}
function splitRuns(ids,section){
 const seats=[...new Set(ids)].map(id=>S.seats.find(s=>s.id===id)).filter(Boolean);
 seats.sort((a,b)=>a.row-b.row||rowOrder(section,a.row).findIndex(x=>x.id===a.id)-rowOrder(section,b.row).findIndex(x=>x.id===b.id));
 const runs=[];let cur=[];
 for(const seat of seats){const prev=cur[cur.length-1];if(!prev){cur=[seat];continue}const ord=rowOrder(section,seat.row),pi=ord.findIndex(x=>x.id===prev.id),si=ord.findIndex(x=>x.id===seat.id),sameSegment=seat.row===8||seat.segment===prev.segment;if(seat.row===prev.row&&sameSegment&&si===pi+1)cur.push(seat);else{runs.push(cur);cur=[seat]}}
 if(cur.length)runs.push(cur);return runs;
}
function validate(raw){
 if(!raw||!Array.isArray(raw.placements))throw Error('מנוע ה-AI החזיר תשובה בפורמט לא תקין.');
 const occupied=new Set(S.assignments.map(a=>a.seat_id)),used=new Set(),remaining=new Map(),groups=[];
 for(const r of S.regs)for(const sec of ['men','women'])remaining.set(sec+'|'+r.family_name,Math.max(0,(Number(r[reqKey(sec)])||0)-countAssigned(r.family_name,sec)));
 for(const p of raw.placements){const family=String(p.family||''),section=p.section;if(!['men','women'].includes(section)||!S.regs.some(r=>r.family_name===family))throw Error('מנוע ה-AI החזיר משפחה או צד שאינם קיימים.');const key=section+'|'+family,ids=Array.isArray(p.seat_ids)?p.seat_ids:[];if(!ids.length)continue;if(ids.length>(remaining.get(key)||0))throw Error(`ה-AI ניסה לשבץ יותר מדי מקומות למשפחת ${family}.`);for(const id of ids){const s=S.seats.find(x=>x.id===id);if(!s||s.section!==section||occupied.has(id)||used.has(id))throw Error(`תוכנית ה-AI כוללת כיסא לא חוקי או כפול: ${id}`);used.add(id)}remaining.set(key,(remaining.get(key)||0)-ids.length);for(const run of splitRuns(ids,section))groups.push({family,section,seats:run,reason:String(p.reason||'')})}
 return{groups,unplaced:Array.isArray(raw.unplaced)?raw.unplaced:[],remaining};
}
function clearPreviewMarks(){document.querySelectorAll('.aiPreviewSeat').forEach(x=>x.classList.remove('aiPreviewSeat'));document.querySelectorAll('.aiPreviewOverlay').forEach(x=>x.remove())}
function drawPreview(groups){
 clearPreviewMarks();
 const allSeatEls=[...document.querySelectorAll('.seat[data-seat]')];
 groups.forEach((g,i)=>{
  const ids=new Set(g.seats.map(s=>s.id)),els=allSeatEls.filter(el=>ids.has(el.dataset.seat));
  els.forEach(el=>el.classList.add('aiPreviewSeat'));
  if(!els.length)return;const row=els[0].closest('.rowseats');if(!row)return;
  const left=Math.min(...els.map(e=>e.offsetLeft)),right=Math.max(...els.map(e=>e.offsetLeft+e.offsetWidth));
  const overlay=document.createElement('div');overlay.className='aiPreviewOverlay';overlay.dataset.aiGroup=String(i);overlay.style.left=left+'px';overlay.style.width=(right-left)+'px';overlay.textContent=g.family;overlay.title=g.reason?`${g.family}: ${g.reason}`:g.family;row.appendChild(overlay);
 });
}
function closePreview(){clearPreviewMarks();const d=document.getElementById('aiPreviewDialog');if(d?.open)d.close();activePreview=null}
function previewLines(v){const map=new Map();for(const g of v.groups){const k=g.section+'|'+g.family;if(!map.has(k))map.set(k,{family:g.family,section:g.section,n:0,rows:new Set()});const x=map.get(k);x.n+=g.seats.length;g.seats.forEach(s=>x.rows.add(s.row))}return[...map.values()].map(x=>`${x.family} — ${x.section==='men'?'גברים':'נשים'}: ${x.n} מקומות, שורה ${[...x.rows].join(', ')}`)}
function showVisualPreview(v,model,usage){
 return new Promise(resolve=>{
  closePreview();activePreview={groups:v.groups};drawPreview(v.groups);
  let d=document.getElementById('aiPreviewDialog');if(!d){d=document.createElement('dialog');d.id='aiPreviewDialog';d.className='aiPreviewDialog';d.innerHTML='<div class="aiPreviewHead"><b>הצעת שיבוץ AI</b><span class="aiPreviewHint">המקומות המסומנים בסגול הם הצעה בלבד — עדיין לא נשמרו.</span></div><div id="aiPreviewSummary" class="aiPreviewSummary"></div><div class="aiPreviewActions"><button id="aiPreviewSave" class="btn aiSaveBtn">שמור שיבוץ</button><button id="aiPreviewCancel" class="btn">בטל</button></div>';document.body.appendChild(d)}
  const lines=previewLines(v),count=v.groups.reduce((n,g)=>n+g.seats.length,0),left=[...v.remaining.entries()].filter(([,n])=>n>0);
  const summary=document.getElementById('aiPreviewSummary');summary.textContent=`${model||'AI'} מציע ${count} מקומות. ${usageText(usage)}\n${lines.join('\n')}${left.length?'\nיישארו ללא שיבוץ מלא: '+left.map(([k,n])=>k.split('|')[1]+' '+n).join(', '):''}`;
  let done=false;const finish=ok=>{if(done)return;done=true;closePreview();resolve(ok)};
  document.getElementById('aiPreviewSave').onclick=()=>finish(true);document.getElementById('aiPreviewCancel').onclick=()=>finish(false);d.oncancel=e=>{e.preventDefault();finish(false)};
  d.show();
 });
}
async function runAi(){
 const session=await adminSession();if(!session)return;const body=payload();if(!body.families.length)return alert('אין כרגע מקומות חסרים לשיבוץ.');
 const btn=document.getElementById('aiSeatBtn');btn.disabled=true;btn.textContent='AI חושב...';
 try{
  closePreview();
  const r=await fetch(SUPA+'/functions/v1/ai-seat',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':KEY},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(data.usage)showUsage(data.usage);
  if(!r.ok){if(data.code==='OPENAI_NOT_CONFIGURED')throw Error('חיבור ה-AI טרם הוגדר ב-Supabase.');throw Error(data.error||('HTTP '+r.status))}
  const v=validate(data.plan);if(!v.groups.length)return alert('מנוע ה-AI לא מצא שיבוץ חדש שאפשר לשמור.\n'+usageText(data.usage));
  btn.textContent='הצעת AI מוצגת';
  const save=await showVisualPreview(v,data.model,data.usage);if(!save)return;
  btn.textContent='שומר...';for(const g of v.groups)await createGroup(g.family,g.section,g.seats,'ai:'+Date.now()+':'+crypto.randomUUID());await load();alert('שיבוץ ה-AI נשמר בהצלחה.\n'+usageText(data.usage));
 }catch(e){closePreview();alert('שיבוץ AI נכשל: '+e.message)}finally{btn.disabled=false;btn.textContent='שיבוץ AI'}
}
async function clearAi(){const groups=[...new Set(S.assignments.map(a=>a.seat_group).filter(g=>String(g||'').startsWith('ai:')))];if(!groups.length)return alert('אין שיבוצי AI למחיקה בתצורה הזו.');if(!confirm(`למחוק ${groups.length} קבוצות שנוצרו על ידי AI?\nשיבוצים ידניים ושיבוץ אוטומטי רגיל יישארו.`))return;for(const g of groups){const r=await fetch(SEAT+'?seat_group=eq.'+encodeURIComponent(g),{method:'DELETE',headers:H});if(!r.ok)throw Error('שגיאה במחיקת שיבוץ AI')}await load()}
function addUi(){
 if(document.getElementById('aiSeatBtn'))return;const top=document.querySelector('.top');if(!top)return;
 const ai=document.createElement('button');ai.id='aiSeatBtn';ai.className='btn aiBtn';ai.type='button';ai.textContent='שיבוץ AI';ai.onclick=runAi;
 const clear=document.createElement('button');clear.id='clearAiBtn';clear.className='btn';clear.type='button';clear.textContent='נקה AI';clear.onclick=()=>clearAi().catch(e=>alert(e.message));
 const auto=document.getElementById('autoSeatBtn');top.insertBefore(ai,auto||document.getElementById('clear'));top.insertBefore(clear,auto||document.getElementById('clear'));
 const st=document.createElement('style');st.textContent='.aiBtn{background:#5b4b86!important;color:#fff!important}.aiUsage{display:inline-flex;align-items:center;padding:6px 9px;border-radius:999px;background:#f2eefc;color:#4d3c78;font-size:12px;font-weight:750;white-space:nowrap}.aiPreviewSeat{background:#eee8ff!important;border-color:#7256b5!important}.aiPreviewOverlay{position:absolute;top:0;height:var(--h);display:flex;align-items:center;justify-content:center;background:#eee8ff;border:2px dashed #7256b5;border-radius:6px;z-index:6;pointer-events:none;padding:0 5px;font-size:12px;font-weight:900;line-height:1;color:#322458;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}.aiPreviewDialog{position:fixed;left:18px;right:18px;bottom:14px;top:auto;width:auto;max-width:920px;max-height:42vh;margin:0 auto;padding:14px 16px;border:1px solid #c9bdea;border-radius:12px;box-shadow:0 8px 28px #0003;z-index:80;background:white;color:#1f2430}.aiPreviewHead{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.aiPreviewHint{font-size:12px;color:#655a76}.aiPreviewSummary{white-space:pre-line;overflow:auto;max-height:24vh;font-size:12px;line-height:1.45;background:#faf9fd;padding:8px;border-radius:8px}.aiPreviewActions{display:flex;gap:8px;margin-top:10px}.aiSaveBtn{background:#5b4b86!important;color:#fff!important}.touchMode .aiBtn{min-height:44px;font-size:15px}.touchMode .aiUsage{white-space:normal}.touchMode .aiPreviewDialog{left:6px;right:6px;bottom:6px;max-height:48vh}';document.head.appendChild(st);
}
addUi();new MutationObserver(addUi).observe(document.body,{childList:true,subtree:true});window.addEventListener('resize',()=>{if(activePreview)requestAnimationFrame(()=>drawPreview(activePreview.groups))});
})();