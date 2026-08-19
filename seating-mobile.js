(()=>{
const touchMode=(navigator.maxTouchPoints||0)>0||window.matchMedia('(pointer: coarse)').matches;
if(!touchMode||!window.YN)return;
const {S,reqKey,assignedCount,getFrags,setFrags,chooseFrom,createGroup,deleteGroup,gid,H,SEAT}=YN;
document.body.classList.add('touchMode','mobile-view-hall');
let selected=null;

function setView(view){
  document.body.classList.remove('mobile-view-hall','mobile-view-men','mobile-view-women');
  document.body.classList.add('mobile-view-'+view);
  document.querySelectorAll('.mobileNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='hall')setTimeout(()=>document.querySelector('.mobileNav')?.scrollIntoView({block:'nearest'}),0);
}
function addMobileChrome(){
  if(!document.querySelector('.mobileNav')){
    const nav=document.createElement('div');nav.className='mobileNav';
    nav.innerHTML='<button data-view="hall" class="active">תרשים</button><button data-view="men">בקשות גברים</button><button data-view="women">בקשות נשים</button>';
    document.querySelector('.workspace')?.before(nav);
    nav.querySelectorAll('button').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  }
  if(!document.getElementById('touchBar')){
    const bar=document.createElement('div');bar.id='touchBar';bar.className='touchBar';bar.style.display='none';
    bar.innerHTML='<div class="touchBarText" id="touchBarText"></div><button type="button" id="touchCancel">בטל</button>';
    document.body.appendChild(bar);document.getElementById('touchCancel').onclick=()=>clearSelection();
  }
  const hall=document.querySelector('.hall');
  if(hall&&!hall.querySelector('.mobileHallNav')){
    const hn=document.createElement('div');hn.className='mobileHallNav';
    hn.innerHTML='<button data-jump="women">נשים</button><button data-jump="center">מרכז</button><button data-jump="men">גברים</button>';
    const desc=document.getElementById('desc');desc?.after(hn);
    hn.querySelectorAll('button').forEach(b=>b.onclick=()=>jumpHall(b.dataset.jump));
  }
}
function jumpHall(where){
  const hall=document.querySelector('.hall'),grid=document.querySelector('.hallgrid');if(!hall||!grid)return;
  const women=grid.children[0],divider=grid.children[1],men=grid.children[2];
  const node=where==='women'?women:where==='men'?men:divider;if(!node)return;
  const left=node.offsetLeft-(hall.clientWidth-node.offsetWidth)/2;
  hall.scrollTo({left:Math.max(0,left),behavior:'smooth'});
}
function labelSelected(){
  document.querySelectorAll('.touchSelected').forEach(x=>x.classList.remove('touchSelected'));
  document.querySelectorAll('.touchTargetHint').forEach(x=>x.classList.remove('touchTargetHint'));
  if(!selected)return;
  if(selected.kind==='request'){
    document.querySelectorAll('.frag').forEach(el=>{if(el.dataset.family===selected.family&&el.dataset.section===selected.section&&+el.dataset.index===selected.index)el.classList.add('touchSelected')});
  }else{
    document.querySelectorAll('.seat[data-group]').forEach(el=>{if(el.dataset.group===selected.group)el.classList.add('touchSelected')});
  }
  document.querySelectorAll('.seat:not(.taken)').forEach(x=>x.classList.add('touchTargetHint'));
}
function showBar(text){const bar=document.getElementById('touchBar');if(!bar)return;document.getElementById('touchBarText').textContent=text;bar.style.display='flex'}
function clearSelection(hideTools=true){selected=null;labelSelected();const bar=document.getElementById('touchBar');if(bar)bar.style.display='none';if(hideTools){S.selectedGroup=null;document.getElementById('tools')?.classList.remove('show')}}
function selectRequest(el){
  selected={kind:'request',family:el.dataset.family,section:el.dataset.section,index:+el.dataset.index,count:+el.dataset.count};
  showBar(`${selected.family} — ${selected.count} מקומות. גע בכיסא שבו תרצה להתחיל.`);labelSelected();setView('hall');setTimeout(()=>jumpHall(selected.section==='men'?'men':'women'),80);
}
function prepareGroupTools(g){
  const a=S.assignments.filter(x=>(x.seat_group||x.id)===g);if(!a.length)return;
  S.selectedGroup=g;
  const title=document.getElementById('groupTitle'),sel=document.getElementById('splitCount'),split=document.getElementById('splitBtn'),tools=document.getElementById('tools');
  if(title)title.textContent=`${a[0].family_name} — ${a.length} מקומות`;
  if(sel){sel.innerHTML='';for(let i=1;i<a.length;i++)sel.insertAdjacentHTML('beforeend',`<option>${i}</option>`)}
  if(split)split.style.display=a.length>1?'inline-block':'none';tools?.classList.add('show');
}
function selectPlacedGroup(g){
  const a=S.assignments.filter(x=>(x.seat_group||x.id)===g);if(!a.length)return;
  selected={kind:'group',group:g,count:a.length,section:a[0].section,family:a[0].family_name};
  prepareGroupTools(g);showBar(`${a[0].family_name} — ${a.length} מקומות. גע בכיסא יעד כדי להזיז את כל הקבוצה.`);labelSelected();
}
async function placeRequest(d,t){
  if(d.section!==t.section)return alert('יש לבחור כיסא בצד המתאים.');
  const x=chooseFrom(t,d.count);if(!x.chosen.length)return alert('המקום שבחרת אינו פנוי.');
  const need=+S.regs.find(r=>r.family_name===d.family)?.[reqKey(d.section)]||0,rem=Math.max(0,need-assignedCount(d.family,d.section)),a=getFrags(d.family,d.section,rem);
  if(x.chosen.length<d.count){
    if(!confirm(`יש כאן רק ${x.chosen.length} מקומות רצופים. לפצל ${d.count} ל־${x.chosen.length}+${d.count-x.chosen.length} ולשבץ ${x.chosen.length}?`))return;
    a.splice(d.index,1,d.count-x.chosen.length);await createGroup(d.family,d.section,x.chosen);setFrags(d.family,d.section,a);
  }else{a.splice(d.index,1);await createGroup(d.family,d.section,x.chosen);setFrags(d.family,d.section,a)}
  clearSelection();await YN.load();
}
async function splitAndMove(cur,chosen){
  const row=S.seats.find(s=>s.id===cur[0].seat_id)?.row??1,ord=YN.rowOrder(cur[0].section,row),sorted=[...cur].sort((a,b)=>ord.findIndex(x=>x.id===a.seat_id)-ord.findIndex(x=>x.id===b.seat_id)),moving=sorted.slice(0,chosen.length),ng=gid();
  for(const a of moving){const r=await fetch(SEAT+'?id=eq.'+encodeURIComponent(a.id),{method:'DELETE',headers:H});if(!r.ok)throw Error('שגיאה בפיצול הקבוצה')}
  await createGroup(cur[0].family_name,cur[0].section,chosen,ng);
}
async function placeGroup(d,t){
  const cur=S.assignments.filter(a=>(a.seat_group||a.id)===d.group);if(!cur.length)return clearSelection();
  if(cur[0].section!==t.section)return alert('יש להזיז קבוצה בתוך אותו צד.');
  const occupied=S.assignments.find(a=>a.seat_id===t.id&&(a.seat_group||a.id)!==d.group);if(occupied)return alert('המקום שבחרת תפוס.');
  const x=chooseFrom(t,cur.length,d.group);if(!x.chosen.length)return alert('אין כאן מקום פנוי.');
  try{
    if(x.chosen.length<cur.length){
      if(!confirm(`יש כאן רק ${x.chosen.length} מקומות רצופים. לפצל את ${cur.length} המקומות ל־${x.chosen.length}+${cur.length-x.chosen.length} ולהעביר את החלק הראשון?`))return;
      await splitAndMove(cur,x.chosen);
    }else{const fam=cur[0].family_name,sec=cur[0].section;await deleteGroup(d.group);await createGroup(fam,sec,x.chosen,d.group)}
    clearSelection();await YN.load();
  }catch(e){alert('לא ניתן היה להזיז את הקבוצה: '+e.message)}
}
function onSeatTap(e,el){
  const t=S.seats.find(s=>s.id===el.dataset.seat);if(!t)return;
  const g=el.dataset.group;
  if(!selected){if(g){e.preventDefault();e.stopImmediatePropagation();selectPlacedGroup(g)}return}
  e.preventDefault();e.stopImmediatePropagation();
  if(selected.kind==='request')return placeRequest({...selected},t);
  if(selected.kind==='group'){
    if(g&&g!==selected.group)return alert('המקום שבחרת תפוס.');
    return placeGroup({...selected},t);
  }
}
function bind(){
  addMobileChrome();
  document.querySelectorAll('.frag').forEach(el=>{if(el.dataset.touchBound)return;el.dataset.touchBound='1';el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectRequest(el)})});
  document.querySelectorAll('.seat[data-seat]').forEach(el=>{if(el.dataset.touchBound)return;el.dataset.touchBound='1';el.addEventListener('click',e=>onSeatTap(e,el),true)});
  labelSelected();
  if(selected?.kind==='group'&&!S.assignments.some(a=>(a.seat_group||a.id)===selected.group))clearSelection();
}
const obs=new MutationObserver(()=>requestAnimationFrame(bind));obs.observe(document.body,{childList:true,subtree:true});
addMobileChrome();bind();
const hint=document.querySelector('.muted');if(hint)hint.textContent='בטלפון: נוגעים בקבוצה ואז בכיסא היעד. במחשב אפשר גם לגרור. אפשר לפצל לפני ואחרי השיבוץ.';
})();
