(()=>{
const $=id=>document.getElementById(id);
const state={key:'',prefs:[],loading:false,seq:0,busy:false,renderQueued:false};
const MIME='application/x-yn-seat-preference';
function key(){return `${YN.S.listId||''}|${YN.S.layoutId||''}`}
function esc(s){return YN.esc(String(s??''))}
function familyName(fid){return YN.familyName(fid)||fid}
function selectedFamilyId(){
 const buttons=[...document.querySelectorAll('.familyPreferenceBtn')];
 const active=buttons.find(b=>b.textContent.includes('מוצג על התרשים'));
 if(!active)return null;
 const name=active.closest('.family')?.querySelector('.fname')?.textContent?.trim();
 return YN.S.reqs.find(r=>r.family_name===name)?.family_id||null;
}
function selectedPriorities(fid){
 const cards=[...document.querySelectorAll('.requests .family')].filter(card=>{
  const name=card.querySelector('.fname')?.textContent?.trim();
  return YN.S.reqs.find(r=>r.family_name===name)?.family_id===fid;
 });
 const first=cards.find(c=>c.querySelector('[data-family-priority]'));
 if(!first)return new Set();
 return new Set([...first.querySelectorAll('[data-family-priority]:checked')].map(x=>Number(x.dataset.familyPriority)));
}
function rowsFor(fid,p){return state.prefs.filter(x=>x.family_id===fid&&Number(x.priority)===Number(p))}
function priorityColorClass(p){return `priority${Number(p)}`}
function modeLabel(){return YN.isDraft?.()?'אשר לטיוטה':'אשר ושמור'}
function ensurePanel(){
 let panel=$('seatPreferenceApprovePanel');
 if(panel)return panel;
 panel=document.createElement('div');panel.id='seatPreferenceApprovePanel';panel.className='seatPreferenceApprovePanel hidden';
 const map=$('layoutMap');if(map)map.before(panel);
 return panel;
}
function queueRender(){if(state.renderQueued)return;state.renderQueued=true;requestAnimationFrame(()=>{state.renderQueued=false;renderPanel()})}
function renderPanel(){
 const panel=ensurePanel();if(!panel)return;
 const fid=selectedFamilyId();
 if(!fid){panel.classList.add('hidden');panel.innerHTML='';return}
 const priorities=selectedPriorities(fid),available=[...new Set(state.prefs.filter(x=>x.family_id===fid).map(x=>Number(x.priority)))].sort((a,b)=>a-b),shown=available.filter(p=>priorities.has(p));
 panel.classList.remove('hidden');
 panel.innerHTML=`<div class="prefApproveHead"><div><b>אישור בקשה על התרשים — ${esc(familyName(fid))}</b><span>${YN.isDraft?.()?'מצב טיוטה: האישור יישאר בטיוטה עד שמירת כל השינויים.':'מצב שמירה: האישור יישמר מיד כשיבוץ בפועל.'}</span></div></div><div class="prefApproveAlternatives">${shown.length?shown.map(p=>{const n=rowsFor(fid,p).length;return `<div class="prefApproveAlternative ${priorityColorClass(p)}" draggable="true" data-pref-family="${esc(fid)}" data-pref-priority="${p}" title="אפשר גם לגרור חלופה זו אל התרשים"><div class="prefApproveDrag">⋮⋮</div><div class="prefApproveText"><b>עדיפות ${p}</b><span>${n} מקומות · אפשר לגרור אל התרשים</span></div><button type="button" class="btn prefApproveBtn" data-pref-family="${esc(fid)}" data-pref-priority="${p}">${modeLabel()}</button></div>`}).join(''):`<div class="prefApproveEmpty">לא נבחרה עדיפות להצגה עבור משפחה זו.</div>`}</div>`;
 panel.querySelectorAll('.prefApproveBtn').forEach(b=>b.onclick=()=>approvePreference(b.dataset.prefFamily,Number(b.dataset.prefPriority),'button'));
 panel.querySelectorAll('.prefApproveAlternative').forEach(el=>{
  el.addEventListener('dragstart',e=>{const payload={familyId:el.dataset.prefFamily,priority:Number(el.dataset.prefPriority)};e.dataTransfer.setData(MIME,JSON.stringify(payload));e.dataTransfer.setData('text/plain',`בקשת ${familyName(payload.familyId)} — עדיפות ${payload.priority}`);e.dataTransfer.effectAllowed='copy';document.body.classList.add('prefRequestDragging')});
  el.addEventListener('dragend',()=>{document.body.classList.remove('prefRequestDragging');$('layoutMap')?.classList.remove('prefRequestDropTarget')});
 });
}
async function loadPrefs(){
 const k=key();state.key=k;if(!YN.S.listId||!YN.S.layoutId){state.prefs=[];return queueRender()}
 const seq=++state.seq;state.loading=true;
 const {data,error}=await YN.db.from('yamim_noraim_seat_preferences').select('family_id,seat_id,section,priority,seat_group').eq('request_list_id',YN.S.listId).eq('layout_id',YN.S.layoutId).order('priority').order('created_at');
 if(seq!==state.seq)return;state.loading=false;
 if(error){console.error(error);state.prefs=[];return queueRender()}
 state.prefs=data||[];queueRender();
}
function seatLabel(id){const s=YN.S.seats.find(x=>x.id===id);if(!s)return id;return `${s.area_name||''} שורה ${s.row_label||s.row} מקום ${s.col||s.seat_index}`.trim()}
function buildNewRows(fid,rows){
 const groupMap=new Map();return rows.map((p,i)=>{const source=`${p.section}|${p.seat_group||`single-${i}`}`;if(!groupMap.has(source))groupMap.set(source,YN.groupId());return{request_list_id:YN.S.listId,layout_id:YN.S.layoutId,family_id:fid,section:p.section,seat_id:p.seat_id,seat_group:groupMap.get(source)}})
}
function validatePreference(fid,p,rows){
 if(!rows.length)return 'לא נמצאו מקומות בחלופה זו.';
 const req=YN.S.reqs.find(r=>r.family_id===fid);if(!req)return 'המשפחה אינה קיימת ברשימת הבקשות הנוכחית.';
 const men=rows.filter(x=>x.section==='men').length,women=rows.filter(x=>x.section==='women').length;
 if(men!==Number(req.men||0)||women!==Number(req.women||0))return `החלופה אינה מלאה: נמצאו ${men} מקומות גברים ו-${women} נשים, במקום ${Number(req.men||0)} ו-${Number(req.women||0)}.`;
 const valid=new Set(YN.S.seats.map(s=>s.id)),missing=rows.filter(x=>!valid.has(x.seat_id));if(missing.length)return 'חלק מהמקומות שבבקשה כבר אינם קיימים בתצורה הנוכחית.';
 const wanted=new Set(rows.map(x=>x.seat_id)),conflicts=YN.S.assignments.filter(a=>a.family_id!==fid&&wanted.has(a.seat_id));
 if(conflicts.length){const labels=[...new Set(conflicts.map(a=>`${a.family_name||familyName(a.family_id)} — ${seatLabel(a.seat_id)}`))];return `לא ניתן לאשר את עדיפות ${p}: ${labels.slice(0,5).join(', ')}${labels.length>5?' ועוד':''}.`}
 return '';
}
async function restoreSavedRows(previous){if(!previous.length)return null;const rows=previous.map(a=>({request_list_id:YN.S.listId,layout_id:YN.S.layoutId,family_id:a.family_id,section:a.section,seat_id:a.seat_id,seat_group:a.seat_group||YN.groupId()}));const {error}=await YN.db.from('yamim_noraim_seating_v2').insert(rows);return error}
async function applyDraft(fid,newRows){
 YN.S.assignments=YN.S.assignments.filter(a=>a.family_id!==fid);
 const groups=new Map();for(const r of newRows){const k=`${r.section}|${r.seat_group}`,a=groups.get(k)||[];a.push(r);groups.set(k,a)}
 for(const a of groups.values()){const seats=a.map(r=>YN.S.seats.find(s=>s.id===r.seat_id)).filter(Boolean);await YN.createGroup(fid,a[0].section,seats,a[0].seat_group,'manual')}
 YN.render();YN.setStatus(`הבקשה של ${familyName(fid)} נוספה לטיוטה. השינויים עדיין לא נשמרו.`)
}
async function applySaved(fid,newRows){
 const previous=YN.S.assignments.filter(a=>a.family_id===fid).map(a=>({...a}));
 const del=await YN.db.from('yamim_noraim_seating_v2').delete().eq('request_list_id',YN.S.listId).eq('layout_id',YN.S.layoutId).eq('family_id',fid);if(del.error)throw del.error;
 const ins=await YN.db.from('yamim_noraim_seating_v2').insert(newRows);
 if(ins.error){const restoreError=await restoreSavedRows(previous);if(restoreError)console.error('Failed to restore previous seating',restoreError);throw ins.error}
 await YN.load();YN.setStatus(`בקשת המקומות של ${familyName(fid)} אושרה ונשמרה.`)
}
async function approvePreference(fid,p,source){
 if(state.busy)return;fid=String(fid);p=Number(p);const rows=rowsFor(fid,p),problem=validatePreference(fid,p,rows);if(problem)return alert(problem);
 const existing=YN.S.assignments.filter(a=>a.family_id===fid);
 if(existing.length&&!confirm(`למשפחת ${familyName(fid)} כבר קיים שיבוץ. להחליף אותו בעדיפות ${p}?`))return;
 state.busy=true;const panel=ensurePanel();panel?.classList.add('busy');
 try{const newRows=buildNewRows(fid,rows);if(YN.isDraft?.())await applyDraft(fid,newRows);else await applySaved(fid,newRows)}catch(e){console.error(e);alert(`לא ניתן ${YN.isDraft?.()?'להוסיף את הבקשה לטיוטה':'לשמור את הבקשה'}: ${e.message||e}`)}finally{state.busy=false;panel?.classList.remove('busy');queueRender()}
}
document.addEventListener('dragover',e=>{if(!e.target?.closest?.('#layoutMap'))return;if(![...e.dataTransfer.types].includes(MIME))return;e.preventDefault();e.dataTransfer.dropEffect='copy';$('layoutMap')?.classList.add('prefRequestDropTarget')},true);
document.addEventListener('dragleave',e=>{if(e.target?.closest?.('#layoutMap')&&e.relatedTarget&&!$('layoutMap')?.contains(e.relatedTarget))$('layoutMap')?.classList.remove('prefRequestDropTarget')},true);
document.addEventListener('drop',e=>{if(!e.target?.closest?.('#layoutMap'))return;const raw=e.dataTransfer?.getData(MIME);if(!raw)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();$('layoutMap')?.classList.remove('prefRequestDropTarget');let d;try{d=JSON.parse(raw)}catch{return}approvePreference(d.familyId,Number(d.priority),'drag')},true);
document.addEventListener('click',e=>{if(e.target?.closest?.('.familyPreferenceBtn,.seatRequester'))setTimeout(queueRender,0)},true);
document.addEventListener('change',e=>{if(e.target?.matches?.('[data-family-priority]'))setTimeout(queueRender,0)},true);
const obs=new MutationObserver(()=>queueRender());window.addEventListener('load',()=>{const host=document.querySelector('.workspace');if(host)obs.observe(host,{subtree:true,childList:true,characterData:true});queueRender()},{once:true});
window.addEventListener('yn:seating-rendered',()=>{if(key()!==state.key)loadPrefs();else queueRender()});
if(window.YN)loadPrefs();else window.addEventListener('load',()=>window.YN&&loadPrefs(),{once:true});
})();
