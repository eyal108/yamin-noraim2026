(()=>{
if(!window.YN)return;
const {S,db,$,createGroup,load,groupId,requestCount,assignedCount}=YN;
const host=$('aiPanelHost');
if(!host)return;
let active=null;
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sectionName(s){return s==='men'?'גברים':'נשים'}
function itemKey(familyId,family,section){return `${familyId||family}|${section}`}
function splitRuns(ids,section){
 const seats=[...new Set(ids)].map(id=>S.seats.find(s=>s.id===id)).filter(s=>s&&s.section===section).sort((a,b)=>a.row-b.row||a.order-b.order),runs=[];let cur=[];
 for(const seat of seats){const p=cur[cur.length-1];if(!p){cur=[seat];continue}if(seat.segment===p.segment&&seat.order===p.order+1)cur.push(seat);else{runs.push(cur);cur=[seat]}}if(cur.length)runs.push(cur);return runs;
}
function proposalItems(plan){
 const m=new Map();
 for(const p of plan?.placements||[]){
  const family=String(p.family||''),r=(p.family_id&&S.reqs.find(x=>x.family_id===p.family_id))||S.reqs.find(x=>x.family_name===family),fid=r?.family_id||p.family_id||null,sec=p.section,key=itemKey(fid,family,sec);
  if(!m.has(key))m.set(key,{key,familyId:fid,family:r?.family_name||family||'משפחה לא ידועה',section:sec,seatIds:[],reasons:[]});
  const x=m.get(key);for(const id of Array.isArray(p.seat_ids)?p.seat_ids:[])if(!x.seatIds.includes(id))x.seatIds.push(id);if(p.reason&&!x.reasons.includes(String(p.reason)))x.reasons.push(String(p.reason));
 }
 return [...m.values()].sort((a,b)=>a.family.localeCompare(b.family,'he')||String(a.section).localeCompare(String(b.section)));
}
function analyze(item){
 const free=[],same=[],conflicts=[],missing=[];
 if(!item.familyId||!['men','women'].includes(item.section))return{free,same,conflicts,missing:item.seatIds,valid:false,already:false,message:'פרטי משפחה או צד אינם תקינים'};
 for(const id of item.seatIds){
  const seat=S.seats.find(s=>s.id===id);if(!seat||seat.section!==item.section){missing.push(id);continue}
  const a=S.assignments.find(x=>x.seat_id===id);if(!a)free.push(id);else if(a.family_id===item.familyId&&a.section===item.section)same.push(id);else conflicts.push({id,family:a.family_name||''});
 }
 const remaining=Math.max(0,requestCount(item.familyId,item.section)-assignedCount(item.familyId,item.section));
 const tooMany=free.length>remaining,already=item.seatIds.length>0&&same.length===item.seatIds.length;
 let message='';if(already)message='כבר נשמר';else if(conflicts.length)message='חלק מהמקומות תפוסים';else if(missing.length)message='כולל כיסאות שאינם קיימים';else if(tooMany)message='מספר המקומות כבר השתנה';else if(same.length)message='חלק כבר נשמר';
 return{free,same,conflicts,missing,remaining,tooMany,already,valid:!conflicts.length&&!missing.length&&!tooMany,message};
}
function rowsText(item){const labels=[...new Set(item.seatIds.map(id=>S.seats.find(s=>s.id===id)?.row_label).filter(x=>x!=null))];return labels.length===1?`שורה ${labels[0]}`:labels.length?`שורות ${labels.join(', ')}`:''}
function clearProposalMarks(){document.querySelectorAll('.previewSeat,.savedSeat,.savedConflict').forEach(x=>x.classList.remove('previewSeat','savedSeat','savedConflict'));document.querySelectorAll('.previewOverlay,.savedOverlay,.partialOverlay').forEach(x=>x.remove())}
function drawSelection(){
 if(!active)return;clearProposalMarks();const mode=active.mode,els=[...document.querySelectorAll('.seat[data-seat]')];
 for(const item of active.items){if(!active.selected.has(item.key))continue;const a=analyze(item),ids=new Set([...a.free,...a.same]),hit=els.filter(e=>ids.has(e.dataset.seat));hit.forEach(e=>e.classList.add(mode==='saved'?'savedSeat':'previewSeat'));const byRow=new Map();for(const e of hit){const row=e.closest('.rowseats');if(!row)continue;if(!byRow.has(row))byRow.set(row,[]);byRow.get(row).push(e)}for(const [row,rowEls] of byRow){const left=Math.min(...rowEls.map(e=>e.offsetLeft)),right=Math.max(...rowEls.map(e=>e.offsetLeft+e.offsetWidth)),o=document.createElement('div');o.className='partialOverlay '+(mode==='saved'?'saved':'preview');o.style.left=left+'px';o.style.width=Math.max(1,right-left)+'px';o.textContent=item.family;o.title=item.reasons.join(' · ');row.appendChild(o)}}
 updateCount();
}
function updateCount(){if(!active)return;let groups=0,seats=0;for(const item of active.items)if(active.selected.has(item.key)){groups++;seats+=analyze(item).free.length}const e=active.panel.querySelector('.partialCount');if(e)e.textContent=`נבחרו ${groups} קבוצות · ${seats} מקומות חדשים לשמירה`;const apply=active.panel.querySelector('.aiApply');if(apply)apply.disabled=groups===0}
function renderPicker(){
 if(!active)return;const {panel,items,selected}=active,actions=panel.querySelector('.aiActions');if(!actions)return;
 const box=document.createElement('section');box.className='partialPicker';box.innerHTML=`<div class="partialHead"><div><b>בחירת השיבוצים לשמירה</b><div class="partialHint">אפשר לבטל סימון של משפחות שלא רוצים לקבל. הסימון בתרשים מתעדכן מיד.</div></div><div class="partialBulk"><button type="button" class="miniBtn partialAll">בחר הכל</button><button type="button" class="miniBtn partialNone">נקה הכל</button></div></div><div class="partialRows"></div><div class="partialCount"></div>`;
 actions.before(box);const rows=box.querySelector('.partialRows');
 for(const item of items){const a=analyze(item),disabled=!a.valid||a.already,checked=selected.has(item.key)&&!disabled,status=a.message?`<span class="partialStatus ${a.already?'done':!a.valid?'bad':'warn'}">${h(a.message)}</span>`:'';const row=document.createElement('label');row.className='partialRow'+(disabled?' disabled':'');row.innerHTML=`<input type="checkbox" data-key="${h(item.key)}" ${checked?'checked':''} ${disabled?'disabled':''}><span class="partialMain"><span class="partialName">${h(item.family)}</span><span class="partialMeta">${sectionName(item.section)} · ${item.seatIds.length} מקומות${rowsText(item)?' · '+h(rowsText(item)):''}</span></span>${status}`;rows.appendChild(row)}
 rows.querySelectorAll('input[type=checkbox]').forEach(c=>c.onchange=()=>{c.checked?selected.add(c.dataset.key):selected.delete(c.dataset.key);drawSelection()});
 box.querySelector('.partialAll').onclick=()=>{for(const item of items){const a=analyze(item);if(a.valid&&!a.already)selected.add(item.key)}renderChecks();drawSelection()};
 box.querySelector('.partialNone').onclick=()=>{selected.clear();renderChecks();drawSelection()};
 function renderChecks(){rows.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=selected.has(c.dataset.key)&&!c.disabled)}
 const apply=panel.querySelector('.aiApply');if(apply){apply.textContent='שמור את הנבחרים';apply.addEventListener('click',applySelected,true)}
 drawSelection();
}
async function applySelected(e){
 e.preventDefault();e.stopImmediatePropagation();if(!active)return;const chosen=active.items.filter(x=>active.selected.has(x.key)),checks=chosen.map(x=>[x,analyze(x)]),bad=checks.filter(([,a])=>!a.valid);
 if(bad.length)return alert('לא ניתן לשמור את הבחירה כי חלק מהשיבוצים השתנו מאז יצירת ההצעה. בטל את הסימון שלהם או צור הצעה חדשה.');
 const seats=checks.reduce((n,[,a])=>n+a.free.length,0);if(!chosen.length||!seats)return alert('לא נבחרו שיבוצים חדשים לשמירה.');
 if(!confirm(`לשמור ${chosen.length} קבוצות ובהן ${seats} מקומות מתוך ההצעה?`))return;
 const b=active.panel.querySelector('.aiApply');b.disabled=true;b.textContent='שומר...';
 try{
  for(const [item,a] of checks){for(const run of splitRuns(a.free,item.section))if(run.length)await createGroup(item.familyId,item.section,run,`auto:partial:${active.source}:${Date.now()}:${groupId()}`)}
  active.panel.querySelector('.aiHide')?.click();active=null;await load();alert(`נשמרו ${seats} מקומות. יתר השיבוצים בהצעה לא הוחלו.`);
 }catch(err){alert('שמירת השיבוץ נכשלה: '+err.message);b.disabled=false;b.textContent='שמור את הנבחרים'}
}
async function enhance(){
 const panel=host.querySelector('.aiPanel');if(!panel||panel.dataset.partialEnhanced)return;panel.dataset.partialEnhanced='loading';const listId=S.listId,layoutId=S.layoutId;
 const {data,error}=await db.from('yamim_noraim_automatic_proposals').select('source,plan,meta,created_at').eq('request_list_id',listId).eq('layout_id',layoutId).maybeSingle();
 if(!panel.isConnected||S.listId!==listId||S.layoutId!==layoutId)return;if(error||!data?.plan){panel.dataset.partialEnhanced='error';return}
 const items=proposalItems(data.plan),selected=new Set();for(const item of items){const a=analyze(item);if(a.valid&&!a.already)selected.add(item.key)}
 active={panel,items,selected,source:data.source||'algorithm',mode:panel.classList.contains('saved')?'saved':'preview'};panel.dataset.partialEnhanced='1';renderPicker();
}
const obs=new MutationObserver(()=>{const p=host.querySelector('.aiPanel');if(!p){active=null;return}if(!p.dataset.partialEnhanced)enhance()});obs.observe(host,{childList:true,subtree:true});
if(host.querySelector('.aiPanel'))enhance();
})();