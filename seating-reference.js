(()=>{
if(!window.YN||!window.YNGeneric)return;
const {S,db,$,esc}=YN;
let charts=[],active=null,loaded=false,loadPromise=null,selectedId=null,viewing=false,mounted=false;
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('he-IL');
function currentList(){return S.lists.find(x=>x.id===S.listId)||null}
function currentLayout(){return S.layouts.find(x=>x.id===S.layoutId)||null}
function familyReference(familyId,familyName,section){
 const fs=active?.snapshot?.families;if(!Array.isArray(fs))return[];
 const f=fs.find(x=>x.family_id===familyId)||fs.find(x=>norm(x.family_name)===norm(familyName));
 const refs=Array.isArray(f?.reference)?f.reference:[];
 return refs.filter(x=>!x?.section||x.section===section);
}
function activeMeta(){return active?{id:active.id,name:active.name,source_request_list_id:active.source_request_list_id,source_layout_id:active.source_layout_id,created_at:active.created_at}:null}
async function loadCharts(){
 const {data,error}=await db.from('yamim_noraim_reference_charts').select('id,name,snapshot,is_active,source_request_list_id,source_layout_id,created_by,created_at,updated_at').order('created_at',{ascending:false});
 if(error)throw error;charts=data||[];active=charts.find(x=>x.is_active)||null;loaded=true;if(!selectedId||!charts.some(x=>x.id===selectedId))selectedId=active?.id||charts[0]?.id||null;renderControl();return active;
}
function ensureLoaded(){if(loaded)return Promise.resolve(active);if(loadPromise)return loadPromise;loadPromise=loadCharts().finally(()=>loadPromise=null);return loadPromise}
function mount(){
 if(mounted)return;const card=document.querySelector('.autoCard');if(!card)return;mounted=true;
 const box=document.createElement('section');box.className='referenceControl';box.id='referenceControl';box.innerHTML=`<div class="referenceHead"><div><b>תרשים ייחוס</b><small id="referenceState">טוען...</small></div><button id="referenceSaveBtn" class="btn">שמור שיבוץ נוכחי כייחוס</button></div><div class="referenceActions"><select id="referenceSelect" aria-label="תרשים ייחוס"></select><button id="referenceActivateBtn" class="btn">הגדר כפעיל</button><button id="referenceShowBtn" class="btn">הצג על התרשים</button><button id="referenceDeleteBtn" class="btn danger">מחק</button></div>`;
 const engine=card.querySelector('.engineOption');if(engine)engine.before(box);else card.appendChild(box);
 $('referenceSelect').onchange=e=>{selectedId=e.target.value||null;viewing=false;clearReferenceMarks();renderControl()};
 $('referenceSaveBtn').onclick=saveCurrentAsReference;$('referenceActivateBtn').onclick=activateSelected;$('referenceDeleteBtn').onclick=deleteSelected;$('referenceShowBtn').onclick=toggleShow;
 renderControl();ensureLoaded().catch(e=>{const s=$('referenceState');if(s)s.textContent='שגיאה בטעינת תרשימי הייחוס: '+e.message});
}
function renderControl(){
 if(!mounted)return;const sel=$('referenceSelect'),state=$('referenceState'),act=$('referenceActivateBtn'),del=$('referenceDeleteBtn'),show=$('referenceShowBtn');if(!sel||!state)return;
 if(!loaded){sel.innerHTML='<option value="">טוען...</option>';sel.disabled=true;act.disabled=del.disabled=show.disabled=true;return}
 sel.disabled=false;sel.innerHTML=charts.length?charts.map(c=>`<option value="${c.id}">${esc(c.name)}${c.is_active?' — פעיל':''}</option>`).join(''):'<option value="">אין תרשימי ייחוס</option>';
 if(selectedId&&charts.some(c=>c.id===selectedId))sel.value=selectedId;else sel.value='';
 const chosen=charts.find(c=>c.id===selectedId)||null;state.textContent=active?`פעיל כעת: ${active.name}`:'אין כרגע תרשים ייחוס פעיל. השיבוץ האוטומטי יעבוד ללא העדפת מיקום היסטורי.';
 act.disabled=!chosen||chosen.is_active;del.disabled=!chosen;show.disabled=!chosen;show.textContent=viewing?'הסתר ייחוס':'הצג על התרשים';
}
function buildSnapshot(){
 const seatById=new Map(S.seats.map(s=>[s.id,s])),buckets=new Map();
 for(const a of S.assignments){const s=seatById.get(a.seat_id);if(!s)continue;const g=String(a.seat_group||a.id||a.seat_id),key=[a.family_id,a.section,g,s.segment].join('|');if(!buckets.has(key))buckets.set(key,{family_id:a.family_id,family_name:a.family_name||'',section:a.section,seats:[]});buckets.get(key).seats.push(s)}
 const famMap=new Map();
 for(const b of buckets.values()){
  const seats=b.seats.slice().sort((x,y)=>x.order-y.order),first=seats[0];if(!first)continue;
  const rowSeats=S.seats.filter(s=>s.section===b.section&&s.row_id===first.row_id).sort((x,y)=>x.order-y.order),min=rowSeats[0]?.order??0,max=rowSeats[rowSeats.length-1]?.order??min,avg=seats.reduce((n,s)=>n+s.order,0)/seats.length,x=max>min?(avg-min)/(max-min):.5;
  const blockSeats=rowSeats.filter(s=>s.block===first.block),bmin=Math.min(...blockSeats.map(s=>s.seat_index)),bmax=Math.max(...blockSeats.map(s=>s.seat_index)),bavg=seats.filter(s=>s.block===first.block).reduce((n,s)=>n+s.seat_index,0)/Math.max(1,seats.filter(s=>s.block===first.block).length),within=Number.isFinite(bmin)&&bmax>bmin?(bavg-bmin)/(bmax-bmin):.5;
  const anchor={section:b.section,row:first.row,row_label:first.row_label,block:first.block,segment:first.segment,order_center:Number(avg.toFixed(3)),x_ratio:Number(x.toFixed(4)),zone:x<.34?'right':x>.66?'left':'center',side_ratio:Number(within.toFixed(4)),side:within<.34?'right':within>.66?'left':'center',seat_count:seats.length,seat_ids:seats.map(s=>s.id)};
  if(!famMap.has(b.family_id))famMap.set(b.family_id,{family_id:b.family_id,family_name:b.family_name||S.reqs.find(r=>r.family_id===b.family_id)?.family_name||'',reference:[]});famMap.get(b.family_id).reference.push(anchor);
 }
 return{version:2,source:'seating-snapshot',created_at:new Date().toISOString(),request_list:{id:S.listId,title:currentList()?.title||'',code:currentList()?.code||''},layout:{id:S.layoutId,title:currentLayout()?.title||'',code:currentLayout()?.code||''},families:[...famMap.values()]};
}
async function saveCurrentAsReference(){
 if(S.editSession)return alert('יש טיוטת שיבוץ פתוחה. שמור אותה או חזור למצב הקודם לפני יצירת תרשים ייחוס.');
 if(!S.assignments.length)return alert('אין כרגע שיבוץ שממנו ניתן ליצור תרשים ייחוס.');
 const l=currentList(),y=currentLayout(),suggest=`${l?.title||'שיבוץ'} · ${y?.title||'תצורה'} · ${new Date().toLocaleDateString('he-IL')}`,name=prompt('שם לתרשים הייחוס:',suggest);if(!name?.trim())return;
 const row={name:name.trim(),source_request_list_id:S.listId,source_layout_id:S.layoutId,snapshot:buildSnapshot(),is_active:false,created_by:S.session?.user?.email||null,updated_at:new Date().toISOString()};
 const {data,error}=await db.from('yamim_noraim_reference_charts').insert(row).select('id').single();if(error)return alert('שמירת תרשים הייחוס נכשלה: '+error.message);
 const r=await db.rpc('set_yamim_noraim_reference_chart',{p_reference_id:data.id});if(r.error)return alert('התרשים נשמר, אך לא ניתן היה להגדיר אותו כפעיל: '+r.error.message);
 selectedId=data.id;loaded=false;await ensureLoaded();alert('תרשים הייחוס נשמר כצילום מצב והוגדר כפעיל. שינויים עתידיים בשיבוץ לא ישנו אותו.');
}
async function activateSelected(){const c=charts.find(x=>x.id===selectedId);if(!c)return;const {error}=await db.rpc('set_yamim_noraim_reference_chart',{p_reference_id:c.id});if(error)return alert('לא ניתן להגדיר את תרשים הייחוס: '+error.message);loaded=false;await ensureLoaded();}
async function deleteSelected(){const c=charts.find(x=>x.id===selectedId);if(!c||!confirm(`למחוק את תרשים הייחוס "${c.name}"?\nהשיבוצים עצמם לא יימחקו.`))return;const {error}=await db.from('yamim_noraim_reference_charts').delete().eq('id',c.id);if(error)return alert('מחיקת תרשים הייחוס נכשלה: '+error.message);viewing=false;clearReferenceMarks();selectedId=null;loaded=false;await ensureLoaded();}
function clearReferenceMarks(){document.querySelectorAll('.referenceSeat,.referenceAnchor').forEach(x=>x.classList.remove('referenceSeat','referenceAnchor'))}
function anchorRatio(a){if(Number.isFinite(Number(a?.x_ratio)))return Math.max(0,Math.min(1,Number(a.x_ratio)));const z=String(a?.zone||'').toLowerCase();if(z==='right'||z==='start')return 0;if(z==='left'||z==='end')return 1;return .5}
function approximateSeats(anchor){
 const rows=S.seats.filter(s=>s.section===anchor.section);if(!rows.length)return[];let row=rows.filter(s=>String(s.row_label)===String(anchor.row_label));if(!row.length&&Number(anchor.row))row=rows.filter(s=>s.row===Number(anchor.row));if(!row.length){const target=Number(anchor.row)||1,minDiff=Math.min(...rows.map(s=>Math.abs(s.row-target)));row=rows.filter(s=>Math.abs(s.row-target)===minDiff)}row=row.sort((a,b)=>a.order-b.order);if(!row.length)return[];
 const ratio=anchorRatio(anchor),idx=Math.round(ratio*(row.length-1)),n=Math.max(1,Number(anchor.seat_count)||1),start=Math.max(0,Math.min(row.length-n,idx-Math.floor((n-1)/2)));return row.slice(start,start+n);
}
function applyReferenceMarks(){clearReferenceMarks();const c=charts.find(x=>x.id===selectedId);if(!viewing||!c)return;const families=Array.isArray(c.snapshot?.families)?c.snapshot.families:[];let any=false;
 for(const f of families)for(const a of Array.isArray(f.reference)?f.reference:[]){let ids=[];if(c.source_layout_id===S.layoutId&&Array.isArray(a.seat_ids))ids=a.seat_ids;else ids=approximateSeats(a).map(s=>s.id);for(const id of ids){const el=document.querySelector(`.seat[data-seat="${CSS.escape(id)}"]`);if(el){el.classList.add('referenceSeat');any=true}}}
 if(!any){viewing=false;renderControl();alert('אין מספיק מידע גאומטרי כדי להציג את תרשים הייחוס על התצורה הנוכחית. הוא עדיין יכול לשמש כהעדפה בשיבוץ האוטומטי.');}
}
function toggleShow(){if(!selectedId)return;viewing=!viewing;if(viewing)applyReferenceMarks();else clearReferenceMarks();renderControl()}
window.addEventListener('yn:seating-rendered',()=>{mount();if(!loaded)ensureLoaded().catch(()=>{});if(viewing)setTimeout(applyReferenceMarks,0)});
['requestListSelect','layoutSelect'].forEach(id=>$(id)?.addEventListener('change',()=>{viewing=false;clearReferenceMarks();renderControl()},{capture:true}));
window.YNReference={ensureLoaded,getActive:()=>active,getActiveMeta:activeMeta,forFamily:familyReference,refresh:async()=>{loaded=false;return ensureLoaded()}};
mount();
})();
