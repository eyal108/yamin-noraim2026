(()=>{
if(!window.YN)return;
const {S,chooseFrom,deleteGroup,createGroup,load,groupId}=YN;
let dragGroup=null,busy=false;
function assignmentsFor(g){return S.assignments.filter(a=>String(a.seat_group||a.id)===String(g))}
function originOf(a,g){return a?.draft_origin||S.editSession?.groupOrigins?.get(String(g))||'manual'}
function targetSeat(el){return el?.dataset?.seat?S.seats.find(s=>s.id===el.dataset.seat):null}
function clearDrag(){dragGroup=null;document.body.classList.remove('draftMoveDragging');document.querySelectorAll('.draftMoveSource,.draftMoveTarget').forEach(x=>x.classList.remove('draftMoveSource','draftMoveTarget'))}
function markSource(g){document.querySelectorAll('.seat[data-group]').forEach(x=>x.classList.toggle('draftMoveSource',String(x.dataset.group)===String(g)))}
async function moveGroup(g,target){
 if(busy||!S.editSession||!g||!target)return;
 const cur=assignmentsFor(g);if(!cur.length)return;
 if(cur[0].section!==target.section)return alert('יש להזיז קבוצה בתוך אזור של אותו צד.');
 const pick=chooseFrom(target,cur.length,g);if(!pick.chosen.length)return alert('אין כאן מקום פנוי.');
 busy=true;
 try{
  const fam=cur[0].family_id,sec=cur[0].section,origin=originOf(cur[0],g);
  if(pick.chosen.length<cur.length){
   if(!confirm(`יש כאן רק ${pick.chosen.length} מקומות רצופים. לפצל את הקבוצה ולהעביר רק אותם?`))return;
   const bySeat=new Map(S.seats.map(s=>[s.id,s])),ordered=[...cur].sort((a,b)=>{const x=bySeat.get(a.seat_id),y=bySeat.get(b.seat_id);return String(x?.area_id||'').localeCompare(String(y?.area_id||''))||(x?.row||0)-(y?.row||0)||(x?.order||0)-(y?.order||0)}),moving=new Set(ordered.slice(0,pick.chosen.length).map(a=>a.id));
   S.assignments=S.assignments.filter(a=>!moving.has(a.id));
   await createGroup(fam,sec,pick.chosen,groupId(),origin);
  }else{
   await deleteGroup(g);
   await createGroup(fam,sec,pick.chosen,g,origin);
  }
  await load();
 }catch(e){alert('הזזת הקבוצה נכשלה: '+(e?.message||e))}
 finally{busy=false;clearDrag()}
}
// Chrome/Safari fallback: keep a standard text/plain drag payload in addition to the app payload.
document.addEventListener('dragstart',e=>{
 if(!S.editSession)return;const el=e.target.closest?.('.seat[data-group]');if(!el)return;
 dragGroup=el.dataset.group;document.body.classList.add('draftMoveDragging');markSource(dragGroup);
 try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',JSON.stringify({kind:'group',group:dragGroup}))}catch{}
},true);
document.addEventListener('dragover',e=>{
 if(!S.editSession||!dragGroup)return;const el=e.target.closest?.('.seat[data-seat]');if(!el)return;e.preventDefault();
 document.querySelectorAll('.draftMoveTarget').forEach(x=>x.classList.remove('draftMoveTarget'));el.classList.add('draftMoveTarget');try{e.dataTransfer.dropEffect='move'}catch{}
},true);
document.addEventListener('drop',async e=>{
 if(!S.editSession||!dragGroup)return;const el=e.target.closest?.('.seat[data-seat]');if(!el)return;
 e.preventDefault();e.stopImmediatePropagation();const g=dragGroup,target=targetSeat(el);clearDrag();await moveGroup(g,target)
},true);
document.addEventListener('dragend',clearDrag,true);
// Reliable mouse fallback: click a group, then click an empty destination seat.
document.addEventListener('click',async e=>{
 if(!S.editSession||busy)return;const el=e.target.closest?.('.seat[data-seat]');if(!el)return;
 if(el.dataset.group){requestAnimationFrame(()=>{if(S.editSession&&S.selectedGroup)markSource(S.selectedGroup)});return}
 const g=S.selectedGroup;if(!g)return;e.preventDefault();e.stopImmediatePropagation();await moveGroup(g,targetSeat(el))
},true);
function explain(){const t=document.querySelector('.draftReviewText');if(t&&!t.dataset.moveHelp){t.dataset.moveHelp='1';t.textContent='אפשר לגרור קבוצה למושב יעד. אם הגרירה לא נוחה, לחץ על קבוצה ואז לחץ על מושב פנוי שאליו תרצה להעביר אותה. אפשר גם לפצל או לשחרר קבוצות.'}}
const obs=new MutationObserver(explain);obs.observe(document.body,{childList:true,subtree:true});explain();
})();
