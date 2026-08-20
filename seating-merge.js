(()=>{
if(!window.YN)return;
const {S,db,render,groupId}=YN;
let seenDraft=null,timer=0,regularBusy=false;
function originOf(a){const g=String(a.seat_group||a.id);return a.draft_origin||S.editSession?.groupOrigins?.get(g)||'manual'}
function buckets(){
 const bySeat=new Map(S.seats.map(s=>[s.id,s])),out=new Map();
 for(const a of S.assignments){const s=bySeat.get(a.seat_id);if(!s)continue;const k=`${a.family_id}|${a.section}|${s.segment}`;if(!out.has(k))out.set(k,[]);out.get(k).push({a,s})}
 return out;
}
function contiguousRuns(arr){
 arr.sort((x,y)=>x.s.order-y.s.order);const runs=[];let run=[];
 for(const x of arr){const p=run[run.length-1];if(!p||x.s.order===p.s.order+1)run.push(x);else{if(run.length)runs.push(run);run=[x]}}if(run.length)runs.push(run);return runs;
}
function mergeAdjacentDraft(allowMixed=false){
 if(!S.editSession)return 0;let merged=0;
 const mergeRun=run=>{
  if(run.length<2)return;const groups=[...new Set(run.map(x=>String(x.a.seat_group||x.a.id)))];if(groups.length<2)return;
  const origins=[...new Set(run.map(x=>originOf(x.a)))];if(origins.length!==1&&!allowMixed)return;
  const ng='merged:'+groupId(),origin=origins.length===1?origins[0]:'final',old=new Set(groups);
  for(const x of run){x.a.seat_group=ng;if(origins.length===1)x.a.draft_origin=origin}
  S.editSession.groupOrigins.set(ng,origin);
  for(const g of old)if(!S.assignments.some(a=>String(a.seat_group||a.id)===g))S.editSession.groupOrigins.delete(g);
  if(old.has(String(S.selectedGroup)))S.selectedGroup=ng;merged+=groups.length-1;
 };
 for(const arr of buckets().values())for(const run of contiguousRuns(arr))mergeRun(run);
 return merged;
}
async function mergeAdjacentRegular(){
 if(S.editSession||regularBusy||!S.listId||!S.layoutId)return 0;regularBusy=true;let merged=0;
 try{
  for(const arr of buckets().values())for(const run of contiguousRuns(arr)){
   if(run.length<2)continue;const groups=[...new Set(run.map(x=>String(x.a.seat_group||x.a.id)))];if(groups.length<2)continue;
   const target=String(run[0].a.seat_group||run[0].a.id),change=run.filter(x=>String(x.a.seat_group||x.a.id)!==target).map(x=>x.a);
   if(!change.length)continue;
   const ids=change.map(a=>a.id).filter(id=>id&&!String(id).startsWith('draft:'));
   if(ids.length){const {error}=await db.from('yamim_noraim_seating_v2').update({seat_group:target,updated_at:new Date().toISOString()}).in('id',ids);if(error)throw error}
   const old=new Set(groups);for(const a of change)a.seat_group=target;if(old.has(String(S.selectedGroup)))S.selectedGroup=target;merged+=groups.length-1;
  }
  if(merged)render();return merged;
 }catch(e){console.error('Automatic adjacent-group merge failed',e);return 0}finally{regularBusy=false}
}
function normalizeAndRender(){timer=0;if(!S.editSession)return;const n=mergeAdjacentDraft(false);if(n)render()}
function scheduleDraft(){if(timer||!S.editSession)return;timer=setTimeout(normalizeAndRender,0)}
function scheduleRegular(){if(S.editSession||regularBusy)return;setTimeout(()=>mergeAdjacentRegular(),0)}
window.addEventListener('yn:seating-rendered',()=>{
 if(!S.editSession){seenDraft=null;scheduleRegular();return}
 if(seenDraft!==S.editSession.startedAt){seenDraft=S.editSession.startedAt;scheduleDraft()}
});
document.addEventListener('drop',()=>{S.editSession?scheduleDraft():scheduleRegular()});
document.addEventListener('dragend',()=>{S.editSession?scheduleDraft():scheduleRegular()});
document.addEventListener('click',e=>{if(S.editSession&&e.target.closest?.('.aiApply')){const n=mergeAdjacentDraft(true);if(n)render()}},true);
})();
