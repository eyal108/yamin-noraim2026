(()=>{
const state={
  key:'',
  prefs:[],
  visible:true,
  globalPriorities:new Set([1,2,3]),
  familyPriorities:new Map(),
  selectedFamily:null,
  working:new Map(),
  moved:new Set(),
  dragging:null,
  notice:'',
  loading:false,
  seq:0
};
const $=id=>document.getElementById(id);
const sid=x=>String(x??'');
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
function priorityChip(p,extra=''){return `<span class="prefPriorityChip priority${p}" ${extra}>${p}</span>`}
function globalPriorityControls(){return [1,2,3].map(p=>`<label class="priorityCheck priority${p}"><input type="checkbox" data-global-priority="${p}" checked><span>${p}</span></label>`).join('')}
function ensureUi(){
 if(!$('seatPreferenceToolbar')){
  const bar=document.createElement('div');bar.id='seatPreferenceToolbar';bar.className='seatPreferenceToolbar';
  bar.innerHTML=`<div class="seatPreferenceTitle"><b>בקשות למקומות</b><span id="seatPreferenceInfo">טוען...</span></div><div class="seatPreferenceGlobalFilter"><b>עדיפויות להצגה:</b>${globalPriorityControls()}</div><div class="seatPreferenceActions"><button id="seatPreferenceToggle" class="btn" type="button">הסתר בקשות</button><button id="seatPreferenceClearFamily" class="btn" type="button" style="display:none">נקה הדגשת משפחה</button></div>`;
  document.querySelector('.summary')?.after(bar);
  bar.querySelectorAll('[data-global-priority]').forEach(cb=>cb.onchange=()=>{const p=Number(cb.dataset.globalPriority);cb.checked?state.globalPriorities.add(p):state.globalPriorities.delete(p);decorate()});
  $('seatPreferenceToggle').onclick=()=>{state.visible=!state.visible;$('seatPreferenceToggle').textContent=state.visible?'הסתר בקשות':'הצג בקשות';decorate()};
  $('seatPreferenceClearFamily').onclick=()=>{state.selectedFamily=null;$('seatPreferenceClearFamily').style.display='none';state.notice='';decorate()};
  const d=document.createElement('dialog');d.id='seatPreferenceDetails';d.className='seatPreferenceDetails';d.innerHTML='<div class="seatPreferenceDialogHead"><h3 id="seatPreferenceDetailsTitle"></h3><button id="seatPreferenceDetailsClose" type="button" aria-label="סגירה">×</button></div><div id="seatPreferenceDetailsBody" class="seatPreferenceDetailsBody"></div>';document.body.appendChild(d);$('seatPreferenceDetailsClose').onclick=()=>d.close();
 }
 if(!$('seatPreferenceFamilyBar')&&$('layoutMap')){
  const b=document.createElement('div');b.id='seatPreferenceFamilyBar';b.className='seatPreferenceFamilyBar';b.style.display='none';$('layoutMap').before(b);
 }
 if(!document.documentElement.dataset.prefDragDelegated){
  document.documentElement.dataset.prefDragDelegated='1';
  document.addEventListener('dragstart',onPreferenceDragStart,true);
  document.addEventListener('dragover',onPreferenceDragOver,true);
  document.addEventListener('drop',onPreferenceDrop,true);
  document.addEventListener('dragend',()=>{state.dragging=null},true);
 }
}
function key(){return `${YN.S.listId||''}|${YN.S.layoutId||''}`}
function familyName(id){return YN.familyName(id)||id}
function seatLabel(id){const s=YN.S.seats.find(x=>x.id===id);if(!s)return id;return `${s.area_name||''} · שורה ${s.row_label||s.row} · מקום ${s.col||s.seat_index}`.replace(/^ · /,'')}
async function load(){
 ensureUi();const k=key();state.key=k;state.selectedFamily=null;state.familyPriorities.clear();state.working.clear();state.moved.clear();state.notice='';$('seatPreferenceClearFamily').style.display='none';
 if(!YN.S.listId||!YN.S.layoutId){state.prefs=[];return decorate()}
 const seq=++state.seq;state.loading=true;$('seatPreferenceInfo').textContent='טוען...';
 const {data,error}=await YN.db.from('yamim_noraim_seat_preferences').select('family_id,seat_id,section,priority,seat_group').eq('request_list_id',YN.S.listId).eq('layout_id',YN.S.layoutId).order('priority');
 if(seq!==state.seq)return;state.loading=false;
 if(error){state.prefs=[];$('seatPreferenceInfo').textContent='לא ניתן לטעון בקשות למקומות';console.error(error);return decorate()}
 state.prefs=(data||[]).map(p=>({...p,family_id:sid(p.family_id),seat_id:sid(p.seat_id),priority:Number(p.priority)}));decorate()
}
function basePriorityRows(fid,p){return state.prefs.filter(x=>sid(x.family_id)===sid(fid)&&Number(x.priority)===Number(p))}
function workKey(fid,p){return `${sid(fid)}|${Number(p)}`}
function workingPriorityRows(fid,p){
 const k=workKey(fid,p);
 if(!state.working.has(k))state.working.set(k,clone(basePriorityRows(fid,p)));
 return state.working.get(k)
}
function resetWorking(fid,p){state.working.delete(workKey(fid,p));state.moved.delete(workKey(fid,p));state.notice='';decorate()}
function familyAvailablePriorities(fid){return [...new Set(state.prefs.filter(x=>sid(x.family_id)===sid(fid)).map(p=>Number(p.priority)))].sort((a,b)=>a-b)}
function familyFilter(fid){fid=sid(fid);if(!state.familyPriorities.has(fid))state.familyPriorities.set(fid,new Set(familyAvailablePriorities(fid)));return state.familyPriorities.get(fid)}
function familyRows(fid){return familyAvailablePriorities(fid).flatMap(p=>workingPriorityRows(fid,p))}
function groupedFamilyPriorities(fid){const m=new Map();for(const p of familyRows(fid)){const a=m.get(Number(p.priority))||[];a.push(p);m.set(Number(p.priority),a)}return m}
function filteredGeneralPrefs(){return state.prefs.filter(p=>state.globalPriorities.has(Number(p.priority)))}
function bySeat(rows){const m=new Map();for(const p of rows){const a=m.get(p.seat_id)||[];a.push(p);m.set(p.seat_id,a)}return m}
function groupKey(row){return row.seat_group?`g:${sid(row.seat_group)}`:`s:${sid(row.seat_id)}`}
function openSeatDetails(seatId){
 const prefs=(bySeat(filteredGeneralPrefs()).get(seatId)||[]),assigned=YN.S.assignments.find(a=>a.seat_id===seatId),byFamily=new Map();
 for(const p of prefs){const a=byFamily.get(p.family_id)||[];a.push(Number(p.priority));byFamily.set(p.family_id,a)}
 $('seatPreferenceDetailsTitle').textContent=seatLabel(seatId);
 $('seatPreferenceDetailsBody').innerHTML=`${assigned?`<div class="actualAssignment">משובץ בפועל: <b>${YN.esc(assigned.family_name)}</b></div>`:''}${byFamily.size?[...byFamily].sort((a,b)=>familyName(a[0]).localeCompare(familyName(b[0]),'he')).map(([fid,priorities])=>`<button type="button" class="seatRequester" data-family="${YN.esc(fid)}"><b>${YN.esc(familyName(fid))}</b><span class="seatRequesterPriorities">${[...new Set(priorities)].sort().map(priorityChip).join('')}</span></button>`).join(''):'<div class="noSeatRequests">אין בקשות בעדיפויות המוצגות למקום זה.</div>'}`;
 $('seatPreferenceDetailsBody').querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{state.selectedFamily=sid(b.dataset.family);familyFilter(state.selectedFamily);$('seatPreferenceClearFamily').style.display='inline-block';$('seatPreferenceDetails').close();state.notice='';decorate()});
 $('seatPreferenceDetails').showModal()
}
function familyPriorityControls(fid,groups){
 const filter=familyFilter(fid);
 return [...groups].sort((a,b)=>a[0]-b[0]).map(([p,rows])=>`<label class="familyPriorityCheck priority${p}"><input type="checkbox" data-family-priority="${p}" ${filter.has(Number(p))?'checked':''}><span>${priorityChip(p)} ${rows.length} מקומות</span></label>`).join('')
}
function decorateFamilies(){
 document.querySelectorAll('.familyPreferenceLine').forEach(x=>x.remove());
 document.querySelectorAll('.requests .family').forEach(card=>{
  const name=card.querySelector('.fname')?.textContent?.trim();if(!name)return;
  const req=YN.S.reqs.find(r=>r.family_name===name);if(!req)return;
  const fid=sid(req.family_id),groups=groupedFamilyPriorities(fid);if(!groups.size)return;
  const line=document.createElement('div');line.className='familyPreferenceLine';
  line.innerHTML=`<button type="button" class="familyPreferenceBtn">${state.selectedFamily===fid?'מוצג על התרשים':'הצג בקשות למקומות'} · ${groups.size} חלופות</button><div class="familyPriorityFilters">${familyPriorityControls(fid,groups)}</div>`;
  line.querySelector('.familyPreferenceBtn').onclick=()=>{state.selectedFamily=state.selectedFamily===fid?null:fid;if(state.selectedFamily)familyFilter(fid);$('seatPreferenceClearFamily').style.display=state.selectedFamily?'inline-block':'none';state.notice='';decorate();if(state.selectedFamily)$('layoutMap')?.scrollIntoView({behavior:'smooth',block:'start'})};
  line.querySelectorAll('[data-family-priority]').forEach(cb=>cb.onchange=e=>{e.stopPropagation();const p=Number(cb.dataset.familyPriority),set=familyFilter(fid);cb.checked?set.add(p):set.delete(p);state.selectedFamily=fid;$('seatPreferenceClearFamily').style.display='inline-block';state.notice='';decorate()});
  card.appendChild(line)
 })
}
function renderFamilyBar(){
 ensureUi();const bar=$('seatPreferenceFamilyBar');if(!bar)return;
 const fid=state.selectedFamily;
 if(!fid){bar.style.display='none';bar.innerHTML='';return}
 const filter=familyFilter(fid),ps=familyAvailablePriorities(fid).filter(p=>filter.has(p));
 const draft=!!YN.S.editSession;
 const buttons=ps.map(p=>`<span class="prefFamilyBarChoice">${priorityChip(p)}<button type="button" class="btn prefApprove" data-pref-approve="${p}">${draft?'הוסף לטיוטה':'אשר ושמור'}</button>${state.moved.has(workKey(fid,p))?`<button type="button" class="btn prefReset" data-pref-reset="${p}">אפס מיקום</button>`:''}</span>`).join('');
 bar.style.display='flex';
 bar.innerHTML=`<div class="prefFamilyBarText"><b>${YN.esc(familyName(fid))}</b><span>אפשר לגרור את החלופה הצבועה ישירות על התרשים${draft?' · האישור יתווסף לטיוטה':' · האישור יישמר מיד'}</span>${state.notice?`<em>${YN.esc(state.notice)}</em>`:''}</div><div class="prefFamilyBarActions">${buttons||'<span class="prefNoPriority">לא נבחרה עדיפות להצגה.</span>'}</div>`;
 bar.querySelectorAll('[data-pref-approve]').forEach(b=>b.onclick=()=>approveAlternative(fid,Number(b.dataset.prefApprove)));
 bar.querySelectorAll('[data-pref-reset]').forEach(b=>b.onclick=()=>resetWorking(fid,Number(b.dataset.prefReset)))
}
function familyMarkChip(p,seatId){return priorityChip(p,`draggable="true" data-pref-drag-priority="${p}" data-pref-drag-seat="${YN.esc(seatId)}" title="גרור חלופה ${p}"`)}
function cleanupPrefDragAttrs(){
 document.querySelectorAll('.seat[data-pref-draggable="1"]').forEach(el=>{delete el.dataset.prefDraggable;if(!el.dataset.group)el.removeAttribute('draggable')})
}
function decorate(){
 ensureUi();cleanupPrefDragAttrs();
 document.querySelectorAll('.seatPrefBadge,.seatPrefMarks,.seatPrefFamilyMarks').forEach(x=>x.remove());
 document.querySelectorAll('.seatPreferenceRequested,.seatPreferenceFamily').forEach(x=>x.classList.remove('seatPreferenceRequested','seatPreferenceFamily'));
 const general=filteredGeneralPrefs(),map=bySeat(general),fid=state.selectedFamily,selected=fid?familyRows(fid).filter(p=>familyFilter(fid).has(Number(p.priority))):[];
 document.querySelectorAll('.seat[data-seat]').forEach(el=>{
  const seatId=el.dataset.seat;
  if(state.visible){
   const prefs=map.get(seatId)||[];
   if(prefs.length){
    el.classList.add('seatPreferenceRequested');
    const families=new Set(prefs.map(p=>p.family_id)),priorities=[...new Set(prefs.map(p=>Number(p.priority)))].sort();
    const b=document.createElement('span');b.className='seatPrefBadge';b.textContent=String(families.size);b.title=`${families.size} משפחות ביקשו מקום זה בעדיפויות המוצגות`;b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openSeatDetails(seatId)});el.appendChild(b);
    const marks=document.createElement('span');marks.className='seatPrefMarks';marks.innerHTML=priorities.map(priorityChip).join('');el.appendChild(marks)
   }
  }
  const mine=selected.filter(p=>p.seat_id===seatId);
  if(mine.length){
   el.classList.add('seatPreferenceFamily');
   const priorities=[...new Set(mine.map(p=>Number(p.priority)))].sort();
   const marks=document.createElement('span');marks.className='seatPrefFamilyMarks';marks.innerHTML=priorities.map(p=>familyMarkChip(p,seatId)).join('');el.appendChild(marks);
   if(priorities.length===1){el.dataset.prefDraggable='1';el.setAttribute('draggable','true')}
  }
 });
 decorateFamilies();renderFamilyBar();
 const allMap=bySeat(state.prefs),families=new Set(state.prefs.map(p=>p.family_id)).size,alternatives=new Set(state.prefs.map(p=>`${p.family_id}|${p.priority}`)).size,shown=[...state.globalPriorities].sort().join(',')||'ללא';
 $('seatPreferenceInfo').textContent=state.loading?'טוען...':`${families} משפחות · ${alternatives} חלופות · ${allMap.size} מקומות · כללי: ${shown}`
}
function dragGhost(count,p){
 const g=document.createElement('div');g.className=`prefMoveGhost priority${p}`;g.style.cssText='position:fixed;left:-10000px;top:-10000px;display:flex;align-items:center;direction:ltr;pointer-events:none;';
 for(let i=0;i<count;i++){const s=document.createElement('span');g.appendChild(s)}
 document.body.appendChild(g);return g
}
function onPreferenceDragStart(e){
 if(!state.selectedFamily||!e.dataTransfer)return;
 const chip=e.target?.closest?.('[data-pref-drag-priority]'),seat=e.target?.closest?.('.seat[data-seat]');
 let p=chip?Number(chip.dataset.prefDragPriority):null,seatId=chip?.dataset.prefDragSeat||null;
 if(!p&&seat?.dataset.prefDraggable==='1'){
  seatId=seat.dataset.seat;
  const mine=familyRows(state.selectedFamily).filter(r=>r.seat_id===seatId&&familyFilter(state.selectedFamily).has(Number(r.priority)));
  const ps=[...new Set(mine.map(r=>Number(r.priority)))];if(ps.length===1)p=ps[0]
 }
 if(!p||!seatId)return;
 const rows=workingPriorityRows(state.selectedFamily,p),src=rows.find(r=>r.seat_id===seatId);if(!src)return;
 const gk=groupKey(src),group=rows.filter(r=>groupKey(r)===gk),payload={kind:'seat-preference',familyId:state.selectedFamily,priority:p,groupKey:gk,section:src.section,count:group.length};
 state.dragging=payload;e.dataTransfer.setData('application/json',JSON.stringify(payload));e.dataTransfer.effectAllowed='move';
 const g=dragGhost(group.length,p);try{e.dataTransfer.setDragImage(g,Math.max(8,group.length*34-8),17)}catch{}setTimeout(()=>g.remove(),0);
 e.stopImmediatePropagation()
}
function onPreferenceDragOver(e){if(!state.dragging)return;const seat=e.target?.closest?.('.seat[data-seat]');if(!seat)return;e.preventDefault();e.dataTransfer.dropEffect='move'}
function onPreferenceDrop(e){
 if(!state.dragging)return;const seat=e.target?.closest?.('.seat[data-seat]');if(!seat)return;
 const payload={...state.dragging};e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();state.dragging=null;
 movePreferenceGroup(payload,seat.dataset.seat).catch(err=>{console.error(err);alert('לא ניתן להזיז את החלופה: '+err.message)})
}
function preferencePlacement(fid,p,gk,target,n){
 const rows=workingPriorityRows(fid,p),targetSeat=YN.S.seats.find(s=>s.id===target);if(!targetSeat)return{chosen:[],reason:'המקום אינו קיים בתצורה.'};
 const group=rows.filter(r=>groupKey(r)===gk),section=group[0]?.section;if(!group.length)return{chosen:[],reason:'הקבוצה לא נמצאה.'};
 if(targetSeat.section!==section)return{chosen:[],reason:'יש להזיז את הקבוצה בתוך אותו צד.'};
 const line=YN.S.seats.filter(s=>s.section===section&&s.segment===targetSeat.segment).sort((a,b)=>a.order-b.order),occ=new Set();
 for(const a of YN.S.assignments)if(sid(a.family_id)!==sid(fid))occ.add(a.seat_id);
 for(const r of rows)if(groupKey(r)!==gk)occ.add(r.seat_id);
 const idx=line.findIndex(s=>s.id===target);if(idx<0||occ.has(target))return{chosen:[],reason:'המקום תפוס בשיבוץ קיים או בחלק אחר של החלופה.'};
 let l=idx,r=idx;while(l>0&&!occ.has(line[l-1].id))l--;while(r<line.length-1&&!occ.has(line[r+1].id))r++;
 const run=line.slice(l,r+1);if(run.length<n)return{chosen:[],reason:`אין כאן רצף פנוי של ${n} מקומות.`};
 const at=run.findIndex(s=>s.id===target),start=Math.min(Math.max(0,at),run.length-n);return{chosen:run.slice(start,start+n)}
}
async function movePreferenceGroup(d,target){
 const fid=sid(d.familyId),p=Number(d.priority),rows=workingPriorityRows(fid,p),group=rows.filter(r=>groupKey(r)===d.groupKey),x=preferencePlacement(fid,p,d.groupKey,target,group.length);
 if(!x.chosen?.length)return alert(x.reason||'לא ניתן להזיז לכאן את החלופה.');
 group.forEach((r,i)=>r.seat_id=x.chosen[i].id);state.moved.add(workKey(fid,p));state.selectedFamily=fid;state.notice=`חלופה ${p} הוזזה זמנית. אשר אותה כדי ${YN.S.editSession?'להוסיף לטיוטה':'לשמור את השיבוץ'}.`;decorate()
}
function conflictsFor(rows,fid){
 const wanted=new Set(rows.map(r=>r.seat_id));return YN.S.assignments.filter(a=>sid(a.family_id)!==sid(fid)&&wanted.has(a.seat_id))
}
async function approveAlternative(fid,p){
 fid=sid(fid);p=Number(p);const rows=clone(workingPriorityRows(fid,p));if(!rows.length)return;
 const conflicts=conflictsFor(rows,fid);
 if(conflicts.length){const names=[...new Set(conflicts.map(a=>a.family_name||familyName(a.family_id)))].filter(Boolean);return alert(`אי אפשר לאשר את החלופה: ${conflicts.length} מהמקומות תפוסים${names.length?' על ידי '+names.join(', '):''}.`)}
 const existing=YN.S.assignments.filter(a=>sid(a.family_id)===fid);
 if(existing.length&&!confirm(`אישור חלופה ${p} יחליף את השיבוץ הקיים של ${familyName(fid)}. להמשיך?`))return;
 const groups=new Map();
 for(const r of rows){const k=`${r.section}|${groupKey(r)}`;const a=groups.get(k)||[];a.push(r);groups.set(k,a)}
 if(YN.S.editSession){
  YN.S.assignments=YN.S.assignments.filter(a=>sid(a.family_id)!==fid);
  for(const a of groups.values()){const seats=a.map(r=>YN.S.seats.find(s=>s.id===r.seat_id)).filter(Boolean);if(seats.length!==a.length)throw Error('אחד המקומות אינו קיים בתצורה.');await YN.createGroup(fid,a[0].section,seats,YN.groupId(),'manual')}
  YN.S.selectedGroup=null;state.notice=`חלופה ${p} נוספה לטיוטה.`;YN.render();return
 }
 const {error:delErr}=await YN.db.from('yamim_noraim_seating_v2').delete().eq('request_list_id',YN.S.listId).eq('layout_id',YN.S.layoutId).eq('family_id',fid);
 if(delErr)return alert('לא ניתן להחליף את השיבוץ הקיים: '+delErr.message);
 const groupIds=new Map();const inserts=rows.map(r=>{const k=`${r.section}|${groupKey(r)}`;if(!groupIds.has(k))groupIds.set(k,YN.groupId());return{request_list_id:YN.S.listId,layout_id:YN.S.layoutId,family_id:fid,section:r.section,seat_id:r.seat_id,seat_group:groupIds.get(k)}});
 const {error:insErr}=await YN.db.from('yamim_noraim_seating_v2').insert(inserts);
 if(insErr){await YN.load(true);return alert('השיבוץ הקודם הוסר, אבל שמירת החלופה נכשלה: '+insErr.message)}
 state.notice=`חלופה ${p} אושרה ונשמרה.`;await YN.load(true)
}
function onRendered(){ensureUi();if(key()!==state.key)return void load();decorate()}
window.addEventListener('yn:seating-rendered',onRendered);if(window.YN)onRendered();else window.addEventListener('load',()=>window.YN&&onRendered(),{once:true});
})();