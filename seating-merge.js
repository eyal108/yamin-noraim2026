(()=>{
if(!window.YN)return;
const {S,render,groupId}=YN;
let seenDraft=null,timer=0;
function originOf(a){const g=String(a.seat_group||a.id);return a.draft_origin||S.editSession?.groupOrigins?.get(g)||'manual'}
function mergeAdjacent(){
 if(!S.editSession)return 0;
 const bySeat=new Map(S.seats.map(s=>[s.id,s])),buckets=new Map();
 for(const a of S.assignments){const s=bySeat.get(a.seat_id);if(!s)continue;const k=`${a.family_id}|${a.section}|${s.segment}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push({a,s})}
 let merged=0;
 const mergeRun=run=>{
  if(run.length<2)return;const groups=[...new Set(run.map(x=>String(x.a.seat_group||x.a.id)))];if(groups.length<2)return;
  const origins=[...new Set(run.map(x=>originOf(x.a)))];if(origins.length!==1)return;
  const ng='merged:'+groupId(),origin=origins[0],old=new Set(groups);
  for(const x of run){x.a.seat_group=ng;x.a.draft_origin=origin}
  S.editSession.groupOrigins.set(ng,origin);
  for(const g of old)if(!S.assignments.some(a=>String(a.seat_group||a.id)===g))S.editSession.groupOrigins.delete(g);
  if(old.has(String(S.selectedGroup)))S.selectedGroup=ng;merged+=groups.length-1;
 };
 for(const arr of buckets.values()){
  arr.sort((x,y)=>x.s.order-y.s.order);let run=[];
  for(const x of arr){const p=run[run.length-1];if(!p||x.s.order===p.s.order+1)run.push(x);else{mergeRun(run);run=[x]}}mergeRun(run);
 }
 return merged;
}
function normalizeAndRender(){timer=0;if(!S.editSession)return;const n=mergeAdjacent();if(n)render()}
function schedule(){if(timer||!S.editSession)return;timer=setTimeout(normalizeAndRender,0)}
window.addEventListener('yn:seating-rendered',()=>{
 if(!S.editSession){seenDraft=null;return}
 if(seenDraft!==S.editSession.startedAt){seenDraft=S.editSession.startedAt;schedule()}
});
document.addEventListener('drop',schedule);
document.addEventListener('dragend',schedule);
document.addEventListener('click',e=>{if(S.editSession&&e.target.closest?.('.aiApply')){const n=mergeAdjacent();if(n)render()}},true);
})();
