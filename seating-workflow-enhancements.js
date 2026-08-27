(()=>{
if(!window.YN)return;
const {S,$,esc,beginDraft,cancelDraft,commitDraft,isDraft,deleteGroup,load,requestCount,assignedCount,setStatus,familyName}=YN;

let manualBusy=false;
let priorDisabled=null;
let draggingGroup=null;
let currentOverGroups=new Set();

const style=document.createElement('style');
style.textContent=`
.manualDraftBar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 10px;padding:10px 12px;border:1px solid #cfd8d1;border-radius:10px;background:#fff}
.manualDraftBar.active{border-color:#8a78b8;background:#faf8ff}
.manualDraftInfo{display:flex;flex-direction:column;gap:2px}.manualDraftInfo b{font-size:13px}.manualDraftInfo span{font-size:11px;color:#66736b}
.manualDraftActions{display:flex;gap:6px;flex-wrap:wrap}.manualDraftActions .draftSave{background:#263d31;color:#fff;border-color:#263d31;font-weight:800}.manualDraftActions .draftCancel{color:#8b2820;border-color:#d5b6b2}
.requestBucketTitle{font-size:11px;font-weight:900;color:#536159;background:#f4f7f5;border-radius:6px;padding:5px 6px;margin:7px 0 2px;position:sticky;top:-1px;z-index:2}
.requestBucketTitle.over{color:#991b1b;background:#fff0f0}.family.overAssignedFamily{background:#fff1f1;border:1px solid #e4a7a7!important;border-radius:8px;padding:7px 6px;margin:4px 0}.family.overAssignedFamily .fname,.family.overAssignedFamily .progress{color:#a51d1d;font-weight:850}
.seat.overAssignedSeat{background:#ffdede!important;border-color:#b42318!important;box-shadow:inset 0 0 0 1px #b42318!important}
.groupOverlay.overAssignedGroup{background:#ffdede!important;border-color:#b42318!important;color:#7f1d1d!important;box-shadow:0 1px 4px #7f1d1d33!important}
#groupReleaseHint{display:none;position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100;background:#7f1d1d;color:#fff;border-radius:999px;padding:8px 13px;font-size:12px;font-weight:850;box-shadow:0 5px 18px #0004;pointer-events:none}
body.groupDragActive #groupReleaseHint{display:block}body.groupDragOutside #groupReleaseHint{background:#a61b1b}
@media(max-width:760px){.manualDraftBar{align-items:stretch;flex-direction:column}.manualDraftActions .btn{flex:1 1 auto}.requestBucketTitle{position:static}}
`;
document.head.appendChild(style);

function ensureDraftBar(){
 let bar=$('manualDraftBar');
 if(bar)return bar;
 const summary=document.querySelector('.summary');
 if(!summary)return null;
 bar=document.createElement('div');
 bar.id='manualDraftBar';
 bar.className='manualDraftBar';
 bar.innerHTML=`<div class="manualDraftInfo"><b>מצב עריכה</b><span id="manualDraftState">השינויים נשמרים אוטומטית.</span></div><div class="manualDraftActions"><button id="startManualDraft" class="btn">עבור למצב טיוטה</button><button id="saveManualDraft" class="btn draftSave" hidden>שמור טיוטה</button><button id="cancelManualDraft" class="btn draftCancel" hidden>בטל טיוטה</button></div>`;
 summary.after(bar);
 $('startManualDraft').onclick=startManualDraft;
 $('saveManualDraft').onclick=saveManualDraft;
 $('cancelManualDraft').onclick=cancelManualDraft;
 return bar;
}

const lockIds=['requestListSelect','layoutSelect','automaticSeatBtn','lastAutoProposalBtn','clearAutomaticBtn','clearBtn','referenceSelect','referenceSaveBtn','referenceActivateBtn','referenceShowBtn','referenceDeleteBtn','useAiCheck'];

function setManualLock(on){
 if(on){
  if(priorDisabled)return;
  priorDisabled=new Map();
  for(const id of lockIds){const el=$(id);if(el){priorDisabled.set(id,!!el.disabled);el.disabled=true}}
  document.body.classList.add('draftMode');
 }else if(priorDisabled){
  for(const [id,was] of priorDisabled){const el=$(id);if(el)el.disabled=was}
  priorDisabled=null;
  if(!isDraft())document.body.classList.remove('draftMode');
 }
}

function syncDraftUi(){
 const bar=ensureDraftBar();if(!bar)return;
 const draft=isDraft(),manual=draft&&S.editSession?.source==='manual';
 const start=$('startManualDraft'),save=$('saveManualDraft'),cancel=$('cancelManualDraft'),state=$('manualDraftState');
 bar.classList.toggle('active',draft);
 start.hidden=manual;
 save.hidden=!manual;
 cancel.hidden=!manual;
 if(manual){
  start.disabled=true;
  state.textContent='טיוטה ידנית פעילה — אפשר לשנות את הסידור; שום שינוי לא נשמר עד ללחיצה על „שמור טיוטה”.';
  setManualLock(true);
 }else{
  setManualLock(false);
  start.hidden=false;
  start.disabled=draft;
  if(draft)state.textContent='טיוטת הצעה אוטומטית פעילה. את השמירה או הביטול מבצעים בחלונית ההצעה.';
  else state.textContent='השינויים נשמרים אוטומטית. אפשר לעבור למצב טיוטה כדי לנסות שינויים לפני שמירה.';
 }
}

async function startManualDraft(){
 if(manualBusy||isDraft())return;
 if(document.querySelector('#aiPanelHost .aiPanel'))return alert('יש כרגע הצעת שיבוץ פתוחה. הסתר אותה לפני מעבר לטיוטה ידנית.');
 const result=beginDraft({placements:[]},'manual');
 if(!result?.ok)return alert('לא ניתן לפתוח טיוטה: '+(result?.issues||[]).join(' · '));
 syncDraftUi();
 setStatus('מצב טיוטה ידני: השינויים אינם נשמרים אוטומטית. אפשר להזיז, לפצל ולשחרר קבוצות, ואז לשמור או לבטל.');
}

async function saveManualDraft(){
 if(manualBusy||!isDraft()||S.editSession?.source!=='manual')return;
 if(!confirm('לשמור את כל השינויים שבטיוטה כשיבוץ הקבוע?'))return;
 manualBusy=true;
 const b=$('saveManualDraft');if(b){b.disabled=true;b.textContent='שומר...'}
 try{
  const n=await commitDraft();
  setManualLock(false);syncDraftUi();
  alert(`הטיוטה נשמרה. ${n} מקומות נמצאים כעת בשיבוץ הקבוע.`);
 }catch(e){
  alert('שמירת הטיוטה נכשלה: '+(e?.message||e));
 }finally{
  manualBusy=false;
  if(b){b.disabled=false;b.textContent='שמור טיוטה'}
 }
}

function cancelManualDraft(){
 if(manualBusy||!isDraft()||S.editSession?.source!=='manual')return;
 if(!confirm('לבטל את כל השינויים שבטיוטה ולחזור לשיבוץ שהיה לפני פתיחתה?'))return;
 cancelDraft();
 setManualLock(false);syncDraftUi();
 setStatus('הטיוטה בוטלה. חזרת לשיבוץ הקבוע שהיה לפני פתיחת הטיוטה.');
}

function sectionRows(sec){
 const rows=[...S.reqs];
 const seen=new Set(rows.map(r=>r.family_id));
 for(const a of S.assignments){
  if(a.section!==sec||seen.has(a.family_id))continue;
  seen.add(a.family_id);
  rows.push({family_id:a.family_id,family_name:familyName(a.family_id)||a.family_name||'משפחה ללא בקשה',notes:''});
 }
 return rows.filter(r=>requestCount(r.family_id,sec)>0||assignedCount(r.family_id,sec)>0);
}

function makeSyntheticFamily(r,sec){
 const el=document.createElement('div');
 el.className='family';
 el.dataset.familyId=r.family_id;
 const name=document.createElement('div');name.className='fname';name.textContent=r.family_name||familyName(r.family_id)||'משפחה';
 const frags=document.createElement('div');frags.className='frags';
 const progress=document.createElement('div');progress.className='progress';
 el.append(name,frags,progress);
 if(r.notes){const note=document.createElement('div');note.className='note';note.textContent=r.notes;el.appendChild(note)}
 return el;
}

function bucketTitle(text,kind=''){
 const h=document.createElement('div');h.className='requestBucketTitle'+(kind?' '+kind:'');h.textContent=text;return h;
}

function decorateRequests(sec){
 const box=$(sec==='men'?'menRequests':'womenRequests');if(!box)return;
 box.querySelectorAll('.requestBucketTitle').forEach(x=>x.remove());
 let nodes=[...box.children].filter(x=>x.classList?.contains('family'));
 const base=S.reqs.filter(r=>requestCount(r.family_id,sec)>0);
 const untagged=nodes.filter(x=>!x.dataset.familyId);
 if(untagged.length===base.length)untagged.forEach((el,i)=>el.dataset.familyId=base[i].family_id);
 const byId=new Map(nodes.filter(x=>x.dataset.familyId).map(x=>[x.dataset.familyId,x]));
 for(const r of sectionRows(sec))if(!byId.has(r.family_id)){
  const el=makeSyntheticFamily(r,sec);byId.set(r.family_id,el);nodes.push(el);
 }
 const cats={over:[],remaining:[],done:[]};
 for(const r of sectionRows(sec)){
  const el=byId.get(r.family_id);if(!el)continue;
  const need=requestCount(r.family_id,sec),got=assignedCount(r.family_id,sec),rem=Math.max(0,need-got),over=Math.max(0,got-need);
  el.classList.toggle('overAssignedFamily',over>0);
  el.classList.toggle('remainingFamily',rem>0&&over===0);
  el.classList.toggle('doneFamily',rem===0&&over===0);
  const progress=el.querySelector('.progress');
  if(progress)progress.textContent=over?`שובצו ${got} מתוך ${need} · ${over} מעבר לבקשה`:(rem?`שובצו ${got} מתוך ${need} · נותרו ${rem}`:`שובצו ${got} מתוך ${need}`);
  (over?cats.over:rem?cats.remaining:cats.done).push(el);
 }
 const alpha=(a,b)=>(a.querySelector('.fname')?.textContent||'').localeCompare(b.querySelector('.fname')?.textContent||'','he');
 cats.over.sort(alpha);cats.remaining.sort(alpha);cats.done.sort(alpha);
 if(cats.over.length){box.appendChild(bucketTitle('דורש טיפול — שובצו יותר מקומות מהבקשה','over'));cats.over.forEach(x=>box.appendChild(x))}
 if(cats.remaining.length){box.appendChild(bucketTitle('נותר לשבץ'));cats.remaining.forEach(x=>box.appendChild(x))}
 if(cats.done.length){box.appendChild(bucketTitle('שובץ במלואו'));cats.done.forEach(x=>box.appendChild(x))}
}

function computeOverAssignment(){
 const overKeys=new Set(),overGroups=new Set(),overSeats=new Set();
 const pairs=new Set();
 for(const r of S.reqs){pairs.add(r.family_id+'|men');pairs.add(r.family_id+'|women')}
 for(const a of S.assignments)pairs.add(a.family_id+'|'+a.section);
 for(const key of pairs){
  const p=key.lastIndexOf('|'),fid=key.slice(0,p),sec=key.slice(p+1);
  if(assignedCount(fid,sec)>requestCount(fid,sec))overKeys.add(key);
 }
 for(const a of S.assignments)if(overKeys.has(a.family_id+'|'+a.section)){
  overSeats.add(a.seat_id);overGroups.add(String(a.seat_group||a.id));
 }
 return{overGroups,overSeats};
}

function markOverAssignments(){
 const {overGroups,overSeats}=computeOverAssignment();currentOverGroups=overGroups;
 document.querySelectorAll('.seat[data-seat]').forEach(el=>el.classList.toggle('overAssignedSeat',overSeats.has(el.dataset.seat)));
 markOverlays();
}

function markOverlays(){
 document.querySelectorAll('.groupOverlay[data-group]').forEach(el=>el.classList.toggle('overAssignedGroup',currentOverGroups.has(String(el.dataset.group))));
}

function decorate(){
 decorateRequests('women');decorateRequests('men');markOverAssignments();syncDraftUi();
 requestAnimationFrame(markOverlays);
 setTimeout(markOverlays,80);
}

function ensureReleaseHint(){
 let h=$('groupReleaseHint');if(h)return h;
 h=document.createElement('div');h.id='groupReleaseHint';h.textContent='שחרור קבוצה — גרור מחוץ לתרשים ושחרר';document.body.appendChild(h);return h;
}
function endGroupDrag(){draggingGroup=null;document.body.classList.remove('groupDragActive','groupDragOutside')}
function eventInsideLayoutMap(e){
 const map=$('layoutMap');if(!map)return false;
 const path=typeof e.composedPath==='function'?e.composedPath():[];
 if(path.includes(map))return true;
 const target=e.target;
 return typeof Node!=='undefined'&&target instanceof Node&&map.contains(target);
}

document.addEventListener('dragstart',e=>{
 const seat=e.target.closest?.('.seat[data-group]');if(!seat)return;
 draggingGroup=String(seat.dataset.group||'');if(!draggingGroup)return;
 ensureReleaseHint();document.body.classList.add('groupDragActive');
},true);

document.addEventListener('dragover',e=>{
 if(!draggingGroup)return;
 const outside=!eventInsideLayoutMap(e);
 document.body.classList.toggle('groupDragOutside',outside);
 if(outside){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move'}
});

document.addEventListener('drop',async e=>{
 if(!draggingGroup)return;
 const g=draggingGroup,outside=!eventInsideLayoutMap(e);
 if(!outside){endGroupDrag();return}
 e.preventDefault();e.stopPropagation();
 const rows=S.assignments.filter(a=>String(a.seat_group||a.id)===g),name=rows[0]?.family_name||'הקבוצה';
 endGroupDrag();
 if(!rows.length)return;
 const msg=S.editSession?`לשחרר את ${name} מהטיוטה?`:`לשחרר את ${name} מהשיבוץ?`;
 if(!confirm(msg))return;
 try{await deleteGroup(g);await load()}catch(err){alert('שחרור הקבוצה נכשל: '+(err?.message||err))}
});

document.addEventListener('dragend',endGroupDrag,true);

const map=$('layoutMap');
if(map)new MutationObserver(()=>requestAnimationFrame(markOverlays)).observe(map,{childList:true,subtree:true});

window.addEventListener('yn:seating-rendered',decorate);
window.addEventListener('beforeunload',e=>{if(S.editSession?.source!=='manual')return;e.preventDefault();e.returnValue=''});
ensureDraftBar();syncDraftUi();setTimeout(decorate,120);
})();
