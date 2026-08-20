(()=>{
if(!window.YN)return;
let observer=null,drawing=false,raf=0;
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;drawAll()})}
function drawGroups(){
 document.querySelectorAll('.groupOverlay').forEach(x=>x.remove());
 document.querySelectorAll('.rowseats').forEach(row=>{
  const groups=new Map();
  row.querySelectorAll('.seat.taken[data-group]').forEach(el=>{const g=el.dataset.group;if(!g)return;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(el)});
  groups.forEach((els,g)=>{
   if(!els.length)return;
   const left=Math.min(...els.map(e=>e.offsetLeft)),right=Math.max(...els.map(e=>e.offsetLeft+e.offsetWidth)),proposal=els.some(e=>e.classList.contains('draftProposal'));
   const label=els.map(e=>e.querySelector('.gname')?.textContent||'').find(Boolean)||'';
   const o=document.createElement('div');o.className='groupOverlay'+(proposal?' proposal':'')+(els.some(e=>e.classList.contains('selected'))?' selected':'');o.dataset.group=g;o.style.left=left+'px';o.style.width=Math.max(1,right-left)+'px';o.textContent=label;o.title=label+(proposal?' — הצעה אוטומטית בטיוטה':'');row.appendChild(o);
  });
 });
}
function stageGroups(map){
 const cells=[...map.querySelectorAll('.stageCell')];cells.forEach(x=>x.style.visibility='visible');map.querySelectorAll('.stageMerged').forEach(x=>x.remove());
 if(cells.length<2)return;
 const m=map.getBoundingClientRect(),items=cells.map(el=>{const r=el.getBoundingClientRect();return{el,left:r.left-m.left,top:r.top-m.top,width:r.width,bottom:r.bottom-m.top,label:el.textContent.trim()}}).sort((a,b)=>a.top-b.top||a.left-b.left),used=new Set();
 for(let i=0;i<items.length;i++){
  if(used.has(i))continue;const base=items[i],group=[base];used.add(i);let last=base;
  for(let j=i+1;j<items.length;j++){
   if(used.has(j))continue;const x=items[j],same=Math.abs(x.left-base.left)<=3&&Math.abs(x.width-base.width)<=3&&x.label===base.label,near=x.top-last.bottom<=10&&x.top>=last.top;
   if(same&&near){group.push(x);used.add(j);last=x}
  }
  if(group.length<2)continue;group.forEach(x=>x.el.style.visibility='hidden');
  const box=document.createElement('div');box.className='stageMerged';box.textContent=base.label||'במה';box.style.left=base.left+'px';box.style.top=base.top+'px';box.style.width=Math.max(...group.map(x=>x.width))+'px';box.style.height=(Math.max(...group.map(x=>x.bottom))-base.top)+'px';map.appendChild(box);
 }
}
function drawAll(){if(drawing)return;drawing=true;if(observer)observer.disconnect();try{drawGroups();['womenMap','menMap'].forEach(id=>{const m=document.getElementById(id);if(m)stageGroups(m)})}finally{drawing=false;observe()}}
function observe(){if(!observer)observer=new MutationObserver(schedule);['womenMap','menMap'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,subtree:true})})}
window.addEventListener('yn:seating-rendered',schedule);window.addEventListener('resize',schedule);window.addEventListener('load',()=>setTimeout(schedule,80));observe();setTimeout(schedule,120);
})();