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
const countAssigned=(family,section)=>S.assignments.filter(a=>a.family_name===family&&a.section===section).length;
function payload(){
 const occupied=new Set(S.assignments.map(a=>a.seat_id));
 const families=S.regs.map(r=>{const men=Number(r[reqKey('men')])||0,women=Number(r[reqKey('women')])||0,am=countAssigned(r.family_name,'men'),aw=countAssigned(r.family_name,'women');return{
  family:r.family_name,notes:r.notes||'',reference:YEAR[r.family_name]||[],requested:{men,women},assigned:{men:am,women:aw},remaining:{men:Math.max(0,men-am),women:Math.max(0,women-aw)},
  existing_seats:{men:S.assignments.filter(a=>a.family_name===r.family_name&&a.section==='men').map(a=>a.seat_id),women:S.assignments.filter(a=>a.family_name===r.family_name&&a.section==='women').map(a=>a.seat_id)}
 }}).filter(f=>f.remaining.men||f.remaining.women);
 return{
  event:S.event,layout_no:S.layoutNo,
  rules:{existing_assignments_are_locked:true,avoid_splitting:true,prefer_adjacent_rows_if_split:true,row8_is_continuous:true,stage_seats_are_not_in_seat_list:true},
  families,
  seats:S.seats.map(s=>({id:s.id,section:s.section,row:s.row,block:String(s.block),order:s.order,segment:s.segment||'',occupied:occupied.has(s.id)}))
 };
}
async function adminSession(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){alert('שיבוץ AI זמין למנהל מחובר בלבד. יש להתחבר במסך הניהול ואז לחזור לסידור ההושבה.');location.href='admin.html';return null}
 return session;
}
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
function validate(raw){
 if(!raw||!Array.isArray(raw.placements))throw Error('מנוע ה-AI החזיר תשובה בפורמט לא תקין.');
 const occupied=new Set(S.assignments.map(a=>a.seat_id)),used=new Set(),remaining=new Map(),groups=[];
 for(const r of S.regs)for(const sec of ['men','women'])remaining.set(sec+'|'+r.family_name,Math.max(0,(Number(r[reqKey(sec)])||0)-countAssigned(r.family_name,sec)));
 for(const p of raw.placements){
  const family=String(p.family||''),section=p.section;
  if(!['men','women'].includes(section)||!S.regs.some(r=>r.family_name===family))throw Error('מנוע ה-AI החזיר משפחה או צד שאינם קיימים.');
  const key=section+'|'+family,ids=Array.isArray(p.seat_ids)?p.seat_ids:[];
  if(!ids.length)continue;
  if(ids.length>(remaining.get(key)||0))throw Error(`ה-AI ניסה לשבץ יותר מדי מקומות למשפחת ${family}.`);
  for(const id of ids){const s=S.seats.find(x=>x.id===id);if(!s||s.section!==section||occupied.has(id)||used.has(id))throw Error(`תוכנית ה-AI כוללת כיסא לא חוקי או כפול: ${id}`);used.add(id)}
  remaining.set(key,(remaining.get(key)||0)-ids.length);
  for(const run of splitRuns(ids,section))groups.push({family,section,seats:run,reason:String(p.reason||'')});
 }
 return{groups,unplaced:Array.isArray(raw.unplaced)?raw.unplaced:[],remaining};
}
function preview(v,model){
 const map=new Map();for(const g of v.groups){const k=g.section+'|'+g.family;if(!map.has(k))map.set(k,{family:g.family,section:g.section,n:0,rows:new Set(),reasons:new Set()});const x=map.get(k);x.n+=g.seats.length;g.seats.forEach(s=>x.rows.add(s.row));if(g.reason)x.reasons.add(g.reason)}
 const lines=[...map.values()].map(x=>`${x.family} — ${x.section==='men'?'גברים':'נשים'}: ${x.n} מקומות, שורה ${[...x.rows].join(', ')}`);
 let msg=`מנוע ${model||'AI'} מציע לשבץ ${v.groups.reduce((n,g)=>n+g.seats.length,0)} מקומות.\n\n${lines.slice(0,24).join('\n')}`;
 if(lines.length>24)msg+=`\nועוד ${lines.length-24} משפחות/קבוצות.`;
 const left=[...v.remaining.entries()].filter(([,n])=>n>0);if(left.length)msg+=`\n\nיישארו ללא שיבוץ מלא: ${left.map(([k,n])=>k.split('|')[1]+' '+n).join(', ')}`;
 return msg+'\n\nהשיבוצים הקיימים לא יוזזו. לשמור את ההצעה?';
}
async function runAi(){
 const session=await adminSession();if(!session)return;
 const body=payload();if(!body.families.length)return alert('אין כרגע מקומות חסרים לשיבוץ.');
 const btn=document.getElementById('aiSeatBtn');btn.disabled=true;btn.textContent='AI חושב...';
 try{
  const r=await fetch(SUPA+'/functions/v1/ai-seat',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':KEY},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){if(data.code==='OPENAI_NOT_CONFIGURED')throw Error('חיבור ה-AI טרם הוגדר ב-Supabase.');throw Error(data.error||('HTTP '+r.status))}
  const v=validate(data.plan);if(!v.groups.length)return alert('מנוע ה-AI לא מצא שיבוץ חדש שאפשר לשמור.');
  if(!confirm(preview(v,data.model)))return;
  for(const g of v.groups)await createGroup(g.family,g.section,g.seats,'ai:'+Date.now()+':'+crypto.randomUUID());
  await load();alert('שיבוץ ה-AI נשמר בהצלחה.');
 }catch(e){alert('שיבוץ AI נכשל: '+e.message)}finally{btn.disabled=false;btn.textContent='שיבוץ AI'}
}
async function clearAi(){
 const groups=[...new Set(S.assignments.map(a=>a.seat_group).filter(g=>String(g||'').startsWith('ai:')))];
 if(!groups.length)return alert('אין שיבוצי AI למחיקה בתצורה הזו.');
 if(!confirm(`למחוק ${groups.length} קבוצות שנוצרו על ידי AI?\nשיבוצים ידניים ושיבוץ אוטומטי רגיל יישארו.`))return;
 for(const g of groups){const r=await fetch(SEAT+'?seat_group=eq.'+encodeURIComponent(g),{method:'DELETE',headers:H});if(!r.ok)throw Error('שגיאה במחיקת שיבוץ AI')}
 await load();
}
function addUi(){
 if(document.getElementById('aiSeatBtn'))return;const top=document.querySelector('.top');if(!top)return;
 const ai=document.createElement('button');ai.id='aiSeatBtn';ai.className='btn aiBtn';ai.type='button';ai.textContent='שיבוץ AI';ai.onclick=runAi;
 const clear=document.createElement('button');clear.id='clearAiBtn';clear.className='btn';clear.type='button';clear.textContent='נקה AI';clear.onclick=()=>clearAi().catch(e=>alert(e.message));
 const auto=document.getElementById('autoSeatBtn');top.insertBefore(ai,auto||document.getElementById('clear'));top.insertBefore(clear,auto||document.getElementById('clear'));
 const st=document.createElement('style');st.textContent='.aiBtn{background:#5b4b86!important;color:#fff!important}.touchMode .aiBtn{min-height:44px;font-size:15px}';document.head.appendChild(st);
}
addUi();new MutationObserver(addUi).observe(document.body,{childList:true,subtree:true});
})();
