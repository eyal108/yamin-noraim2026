(()=>{
if(!window.YN)return;
const {S,render,groupId,db,setStatus}=YN;
let seenDraft=null,draftTimer=0,regularTimer=0,regularBusy=false;
function originOf(a){const g=String(a.seat_group||a.id);return a.draft_origin||S.editSession?.groupOrigins?.get(g)||'manual'}
function contiguousRuns(){
 const bySeat=new Map(S.seats.map(s=>[s.id,s])),buckets=new Map(),runs=[];
 for(const a of S.assignments){const s=bySeat.get(a.seat_id);if(!s)continue;const k=`${a.family_id}|${a.section}|${s.segment}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push({a,s})}
 for(const arr of buckets.values()){
  arr.sort((x,y)=>x.s.order-y.s.order);let run=[];
  for(const x of arr){const p=run[run.length-1];if(!p||x.s.order===p.s.order+1)run.push(x);else{if(run.length)runs.push(run);run=[x]}}
  if(run.length)runs.push(run);
 }
 return runs;
}
function mergeAdjacentDraft(allowMixed=false){
 if(!S.editSession)return 0;let merged=0;
 for(const run of contiguousRuns()){
  if(run.length<2)continue;const groups=[...new Set(run.map(x=>String(x.a.seat_group||x.a.id)))];if(groups.length<2)continue;
  const origins=[...new Set(run.map(x=>originOf(x.a)))];if(origins.length!==1&&!allowMixed)continue;
  const ng='merged:'+groupId(),origin=origins.length===1?origins[0]:'final',old=new Set(groups);
  for(const x of run){x.a.seat_group=ng;if(origins.length===1)x.a.draft_origin=origin}
  S.editSession.groupOrigins.set(ng,origin);
  for(const g of old)if(!S.assignments.some(a=>String(a.seat_group||a.id)===g))S.editSession.groupOrigins.delete(g);
  if(old.has(String(S.selectedGroup)))S.selectedGroup=ng;merged+=groups.length-1;
 }
 return merged;
}
async function mergeAdjacentRegular(){
 if(S.editSession||regularBusy||!S.listId||!S.layoutId)return 0;
 regularBusy=true;const listId=S.listId,layoutId=S.layoutId;let merged=0,changed=false;
 try{
  for(const run of contiguousRuns()){
   if(run.length<2)continue;const groups=[...new Set(run.map(x=>String(x.a.seat_group||x.a.id)))];if(groups.length<2)continue;
   const ids=run.map(x=>x.a.id).filter(id=>id&&!String(id).startsWith('draft:'));if(!ids.length)continue;
   const ng='merged:'+groupId(),now=new Date().toISOString();
   const {error}=await db.from('yamim_noraim_seating_v2').update({seat_group:ng,updated_at:now}).in('id',ids);if(error)throw error;
   merged+=groups.length-1;
   if(S.listId===listId&&S.layoutId===layoutId&&!S.editSession){
    const idset=new Set(ids),old=new Set(groups);
    for(const a of S.assignments)if(idset.has(a.id))a.seat_group=ng;
    if(old.has(String(S.selectedGroup)))S.selectedGroup=ng;changed=true;
   }
  }
  if(changed){render();if(setStatus)setStatus(merged===1?'חלקים צמודים של אותה משפחה אוחדו אוטומטית.':`${merged} פיצולים צמודים של משפחות אוחדו אוטומטית.`)}
  return merged;
 }catch(e){console.error('Automatic adjacent-group merge failed',e);if(S.listId===listId&&S.layoutId===layoutId&&setStatus)setStatus('לא ניתן היה לאחד חלקים צמודים אוטומטית: '+e.message);return 0}
 finally{regularBusy=false}
}
function normalizeDraftAndRender(){draftTimer=0;if(!S.editSession)return;const n=mergeAdjacentDraft(false);if(n)render()}
function scheduleDraft(){if(draftTimer||!S.editSession)return;draftTimer=setTimeout(normalizeDraftAndRender,0)}
function scheduleRegular(){if(regularTimer||regularBusy||S.editSession)return;regularTimer=setTimeout(()=>{regularTimer=0;mergeAdjacentRegular()},0)}
window.addEventListener('yn:seating-rendered',()=>{
 if(S.editSession){if(seenDraft!==S.editSession.startedAt){seenDraft=S.editSession.startedAt;scheduleDraft()}return}
 seenDraft=null;scheduleRegular();
});
document.addEventListener('drop',()=>{if(S.editSession)scheduleDraft()});
document.addEventListener('dragend',()=>{if(S.editSession)scheduleDraft()});
document.addEventListener('click',e=>{if(S.editSession&&e.target.closest?.('.aiApply')){const n=mergeAdjacentDraft(true);if(n)render()}},true);
})();
