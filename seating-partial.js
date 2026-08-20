(()=>{
if(!window.YN)return;
const {S,db,$,createGroup,load,groupId,requestCount,assignedCount}=YN;
const host=$('aiPanelHost');
if(!host)return;
let active=null;
function splitRuns(ids,section){
 const seats=[...new Set(ids)].map(id=>S.seats.find(s=>s.id===id)).filter(s=>s&&s.section===section).sort((a,b)=>a.row-b.row||a.order-b.order),runs=[];let cur=[];
 for(const seat of seats){const p=cur[cur.length-1];if(!p){cur=[seat];continue}if(seat.segment===p.segment&&seat.order===p.order+1)cur.push(seat);else{runs.push(cur);cur=[seat]}}if(cur.length)runs.push(cur);return runs;
}
function proposalItems(plan){
 const out=[];
 (plan?.placements||[]).forEach((p,pi)=>{
  const family=String(p.family||''),r=(p.family_id&&S.reqs.find(x=>x.family_id===p.family_id))||S.reqs.find(x=>x.family_name===family),fid=r?.family_id||p.family_id||null,sec=p.section,raw=[...new Set(Array.isArray(p.seat_ids)?p.seat_ids:[])],runs=splitRuns(raw,sec),found=new Set(runs.flat().map(s=>s.id));
  runs.forEach((run,ri)=>out.push({key:`${fid||family}|${sec}|${pi}|${ri}`,familyId:fid,family:r?.family_name||family||'משפחה לא ידועה',section:sec,seatIds:run.map(s=>s.id),missingIds:[],reason:String(p.reason||'')}));
  const missing=raw.filter(id=>!found.has(id));if(missing.length||!runs.length)out.push({key:`${fid||family}|${sec}|${pi}|missing`,familyId:fid,family:r?.family_name||family||'משפחה לא ידועה',section:sec,seatIds:[],missingIds:missing.length?missing:raw,reason:String(p.reason||'')});
 });
 return out;
}
function analyze(item){
 const free=[],same=[],conflicts=[],missing=[...(item.missingIds||[])];
 if(!item.familyId||!['men','women'].includes(item.section))return{free,same,conflicts,missing,valid:false,already:false,message:'פרטי משפחה או צד אינם תקינים'};
 for(const id of item.seatIds){
  const seat=S.seats.find(s=>s.id===id);if(!seat||seat.section!==item.section){missing.push(id);continue}
  const a=S.assignments.find(x=>x.seat_id===id);if(!a)free.push(id);else if(a.family_id===item.familyId&&a.section===item.section)same.push(id);else conflicts.push({id,family:a.family_name||''});
 }
 const remaining=Math.max(0,requestCount(item.familyId,item.section)-assignedCount(item.familyId,item.section));
 const tooMany=free.length>remaining,already=item.seatIds.length>0&&same.length===item.seatIds.length&&!missing.length;
 let message='';if(already)message='כבר נשמר';else if(conflicts.length)message='חלק מהמקומות תפוסים';else if(missing.length)message='כולל כיסאות שאינם קיימים';else if(tooMany)message='מספר המקומות כבר השתנה';else if(same.length)message='חלק כבר נשמר';
 return{free,same,conflicts,missing,remaining,tooMany,already,valid:!conflicts.length&&!missing.length&&!tooMany,message};
}
function clearProposalMarks(){
 document.querySelectorAll('.previewSeat,.savedSeat,.savedConflict,.partialCandidateSeat,.partialChosenSeat,.partialBlockedSeat').forEach(x=>x.classList.remove('previewSeat','savedSeat','savedConflict','partialCandidateSeat','partialChosenSeat','partialBlockedSeat'));
 document.querySelectorAll('.previewOverlay,.savedOverlay,.partialOverlay').forEach(x=>x.remove());
}
function toggleItem(key){
 if(!active)return;const item=active.items.find(x=>x.key===key);if(!item)return;const a=analyze(item);if(!a.valid||a.already||!a.free.length)return;
 active.selected.has(key)?active.selected.delete(key):active.selected.add(key);drawSelection();
}
function drawSelection(){
 if(!active)return;clearProposalMarks();const els=[...document.querySelectorAll('.seat[data-seat]')];
 for(const item of active.items){
  const a=analyze(item);if(a.already&&!a.free.length)continue;
  const chosen=active.selected.has(item.key),blocked=!a.valid,ids=new Set(blocked?[...item.seatIds]:[...a.free]),hit=els.filter(e=>ids.has(e.dataset.seat));
  hit.forEach(e=>e.classList.add(blocked?'partialBlockedSeat':chosen?'partialChosenSeat':'partialCandidateSeat'));
  if(!hit.length)continue;const byRow=new Map();for(const e of hit){const row=e.closest('.rowseats');if(!row)continue;if(!byRow.has(row))byRow.set(row,[]);byRow.get(row).push(e)}
  for(const [row,rowEls] of byRow){
   const left=Math.min(...rowEls.map(e=>e.offsetLeft)),right=Math.max(...rowEls.map(e=>e.offsetLeft+e.offsetWidth)),o=document.createElement('div');
   o.className=`partialOverlay ${blocked?'blocked':chosen?'chosen':'candidate'} ${active.mode==='saved'?'saved':'preview'}`;o.style.left=left+'px';o.style.width=Math.max(1,right-left)+'px';o.textContent=(chosen?'✓ ':'')+item.family;o.title=blocked?(a.message||'השיבוץ אינו זמין'):(item.reason||`${item.family} — לחץ כדי ${chosen?'לבטל בחירה':'לבחור'}`);o.dataset.key=item.key;
   if(!blocked){o.setAttribute('role','button');o.setAttribute('aria-pressed',chosen?'true':'false');o.tabIndex=0;o.onclick=e=>{e.preventDefault();e.stopPropagation();toggleItem(item.key)};o.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleItem(item.key)}}}
   row.appendChild(o);
  }
 }
 updateCount();
}
function updateCount(){
 if(!active)return;let groups=0,seats=0;for(const item of active.items)if(active.selected.has(item.key)){const a=analyze(item);if(a.valid&&!a.already&&a.free.length){groups++;seats+=a.free.length}}
 const e=active.panel.querySelector('.partialCount');if(e)e.textContent=groups?`נבחרו ${groups} שיבוצים · ${seats} מקומות לשמירה`:'לא נבחרו שיבוצים. לחץ על שיבוץ בתרשים כדי לבחור אותו.';
 const apply=active.panel.querySelector('.aiApply');if(apply)apply.disabled=groups===0;
}
function renderPicker(){
 if(!active)return;const {panel,items,selected}=active,actions=panel.querySelector('.aiActions');if(!actions)return;
 const unavailable=items.filter(x=>{const a=analyze(x);return !a.valid&&!a.already}).length;
 const box=document.createElement('section');box.className='chartPicker';box.innerHTML=`<div class="chartPickHead"><div><b>בחירה ישירות על התרשים</b><div class="chartPickHint">כל השיבוצים המוצעים מסומנים על המפה. לחץ על שיבוץ כדי לבחור אותו; לחץ שוב כדי לבטל.</div></div><div class="partialBulk"><button type="button" class="miniBtn partialAll">בחר הכל</button><button type="button" class="miniBtn partialNone">נקה בחירה</button></div></div><div class="chartLegend"><span><i class="legendSwatch candidate"></i>מוצע</span><span><i class="legendSwatch chosen"></i>נבחר לשמירה</span>${unavailable?`<span><i class="legendSwatch blocked"></i>${unavailable} לא זמינים</span>`:''}</div><div class="partialCount"></div>`;
 actions.before(box);
 box.querySelector('.partialAll').onclick=()=>{selected.clear();for(const item of items){const a=analyze(item);if(a.valid&&!a.already&&a.free.length)selected.add(item.key)}drawSelection()};
 box.querySelector('.partialNone').onclick=()=>{selected.clear();drawSelection()};
 const apply=panel.querySelector('.aiApply');if(apply){apply.textContent='שמור את הנבחרים';apply.addEventListener('click',applySelected,true)}
 drawSelection();
}
function validateChosen(checks){
 const issues=[],totals=new Map(),used=new Set();
 for(const [item,a] of checks){if(!a.valid){issues.push(`${item.family}: ${a.message||'השיבוץ אינו תקין'}`);continue}for(const id of a.free){if(used.has(id))issues.push(`הכיסא ${id} נבחר פעמיים`);used.add(id)}const key=`${item.familyId}|${item.section}`,x=totals.get(key)||{item,n:0,remaining:a.remaining};x.n+=a.free.length;totals.set(key,x)}
 for(const {item,n,remaining} of totals.values())if(n>remaining)issues.push(`${item.family}: נבחרו ${n} מקומות אך נותרו רק ${remaining}`);
 return [...new Set(issues)];
}
async function applySelected(e){
 e.preventDefault();e.stopImmediatePropagation();if(!active)return;const chosen=active.items.filter(x=>active.selected.has(x.key)),checks=chosen.map(x=>[x,analyze(x)]),issues=validateChosen(checks);
 if(issues.length)return alert('לא ניתן לשמור את הבחירה:\n'+issues.slice(0,8).join('\n'));
 const seats=checks.reduce((n,[,a])=>n+a.free.length,0);if(!chosen.length||!seats)return alert('לא נבחרו שיבוצים חדשים לשמירה.');
 if(!confirm(`לשמור ${chosen.length} שיבוצים ובהם ${seats} מקומות מתוך ההצעה?`))return;
 const b=active.panel.querySelector('.aiApply');b.disabled=true;b.textContent='שומר...';
 try{
  for(const [item,a] of checks){for(const run of splitRuns(a.free,item.section))if(run.length)await createGroup(item.familyId,item.section,run,`auto:partial:${active.source}:${Date.now()}:${groupId()}`)}
  active.panel.querySelector('.aiHide')?.click();active=null;await load();alert(`נשמרו ${seats} מקומות. יתר ההצעה נשארה שמורה וניתן להציג אותה שוב.`);
 }catch(err){alert('שמירת השיבוץ נכשלה: '+err.message);b.disabled=false;b.textContent='שמור את הנבחרים'}
}
async function enhance(){
 const panel=host.querySelector('.aiPanel');if(!panel||panel.dataset.partialEnhanced)return;panel.dataset.partialEnhanced='loading';const listId=S.listId,layoutId=S.layoutId;
 const {data,error}=await db.from('yamim_noraim_automatic_proposals').select('source,plan,meta,created_at').eq('request_list_id',listId).eq('layout_id',layoutId).maybeSingle();
 if(!panel.isConnected||S.listId!==listId||S.layoutId!==layoutId)return;if(error||!data?.plan){panel.dataset.partialEnhanced='error';return}
 const items=proposalItems(data.plan),selected=new Set();active={panel,items,selected,source:data.source||'algorithm',mode:panel.classList.contains('saved')?'saved':'preview'};panel.dataset.partialEnhanced='1';renderPicker();
}
const obs=new MutationObserver(()=>{const p=host.querySelector('.aiPanel');if(!p){clearProposalMarks();active=null;return}if(!p.dataset.partialEnhanced)enhance()});obs.observe(host,{childList:true,subtree:true});
if(host.querySelector('.aiPanel'))enhance();
})();