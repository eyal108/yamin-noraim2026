(()=>{
if(!window.YN)return;
let observer=null,drawing=false,raf=0;
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;drawAll()})}
function drawGroups(){
 document.querySelectorAll('.groupOverlay').forEach(x=>x.remove());
 document.querySelectorAll('.rowseats').forEach(row=>{
  const groups=new Map();
  row.querySelectorAll('.seat.taken[data-group]').forEach(el=>{const g=el.dataset.group;if(!g)return;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(el)});
  groups.forEach((els,g)=>{if(!els.length)return;const left=Math.min(...els.map(e=>e.offsetLeft)),right=Math.max(...els.map(e=>e.offsetLeft+e.offsetWidth)),proposal=els.some(e=>e.classList.contains('draftProposal')),label=els.map(e=>e.querySelector('.gname')?.textContent||'').find(Boolean)||'',o=document.createElement('div');o.className='groupOverlay'+(proposal?' proposal':'')+(els.some(e=>e.classList.contains('selected'))?' selected':'');o.dataset.group=g;o.style.left=left+'px';o.style.width=Math.max(1,right-left)+'px';o.textContent=label;o.title=label+(proposal?' — הצעה אוטומטית בטיוטה':'');row.appendChild(o)})
 })
}
function gap(a1,a2,b1,b2){return Math.max(0,Math.max(a1,b1)-Math.min(a2,b2))}
function overlap(a1,a2,b1,b2){return Math.min(a2,b2)-Math.max(a1,b1)}
function stageGroups(map){
 const raw=[...map.querySelectorAll('.stageCell')];raw.forEach(x=>x.style.visibility='visible');map.querySelectorAll('.stageMerged').forEach(x=>x.remove());if(!raw.length)return;
 const mr=map.getBoundingClientRect(),items=raw.map(el=>{const r=el.getBoundingClientRect();return{el,label:el.textContent.trim()||'במה',left:r.left-mr.left,right:r.right-mr.left,top:r.top-mr.top,bottom:r.bottom-mr.top}}),seen=new Set();
 const adjacent=(a,b)=>{if(a.label!==b.label)return false;const gx=gap(a.left,a.right,b.left,b.right),gy=gap(a.top,a.bottom,b.top,b.bottom),ox=overlap(a.left,a.right,b.left,b.right),oy=overlap(a.top,a.bottom,b.top,b.bottom);return(oy>4&&gx<=6)||(ox>4&&gy<=8)};
 for(let i=0;i<items.length;i++){
  if(seen.has(i))continue;const group=[],queue=[i];seen.add(i);
  while(queue.length){const idx=queue.shift(),cur=items[idx];group.push(cur);for(let j=0;j<items.length;j++)if(!seen.has(j)&&adjacent(cur,items[j])){seen.add(j);queue.push(j)}}
  if(group.length===1)continue;
  const left=Math.min(...group.map(x=>x.left)),right=Math.max(...group.map(x=>x.right)),top=Math.min(...group.map(x=>x.top)),bottom=Math.max(...group.map(x=>x.bottom));group.forEach(x=>x.el.style.visibility='hidden');
  const box=document.createElement('div');box.className='stageMerged';box.textContent=group[0].label||'במה';box.style.left=left+'px';box.style.top=top+'px';box.style.width=Math.max(1,right-left)+'px';box.style.height=Math.max(1,bottom-top)+'px';map.appendChild(box)
 }
}
function drawAll(){if(drawing)return;drawing=true;if(observer)observer.disconnect();try{drawGroups();document.querySelectorAll('.areaMap').forEach(stageGroups)}finally{drawing=false;observe()}}
function observe(){if(!observer)observer=new MutationObserver(schedule);const el=document.getElementById('layoutMap');if(el)observer.observe(el,{childList:true,subtree:true})}
window.addEventListener('yn:seating-rendered',schedule);window.addEventListener('resize',schedule);window.addEventListener('load',()=>setTimeout(schedule,80));observe();setTimeout(schedule,120);
})();
