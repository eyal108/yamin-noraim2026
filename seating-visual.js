(()=>{
if(!window.YN)return;
let observer=null,drawing=false,raf=0;
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;drawAll()})}
function drawGroups(){document.querySelectorAll('.groupOverlay').forEach(x=>x.remove());document.querySelectorAll('.rowseats').forEach(row=>{const groups=new Map();row.querySelectorAll('.seat.taken[data-group]').forEach(el=>{const g=el.dataset.group;if(!g)return;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(el)});groups.forEach((els,g)=>{if(!els.length)return;const left=Math.min(...els.map(e=>e.offsetLeft)),right=Math.max(...els.map(e=>e.offsetLeft+e.offsetWidth)),proposal=els.some(e=>e.classList.contains('draftProposal')),label=els.map(e=>e.querySelector('.gname')?.textContent||'').find(Boolean)||'',o=document.createElement('div');o.className='groupOverlay'+(proposal?' proposal':'')+(els.some(e=>e.classList.contains('selected'))?' selected':'');o.dataset.group=g;o.style.left=left+'px';o.style.width=Math.max(1,right-left)+'px';o.textContent=label;o.title=label+(proposal?' — הצעה אוטומטית בטיוטה':'');row.appendChild(o)})})}
function stageGroups(map){
 const rows=[...map.querySelectorAll('.areaRow .rowseats')];
 const cells=[];
 rows.forEach((row,ri)=>[...row.children].forEach((el,ci)=>{if(el.classList.contains('stageCell'))cells.push({el,r:ri,c:ci,label:el.textContent.trim()||'במה'})}));
 cells.forEach(x=>x.el.style.visibility='visible');map.querySelectorAll('.stageMerged').forEach(x=>x.remove());if(cells.length<2)return;
 const byKey=new Map(cells.map(x=>[`${x.r}:${x.c}`,x])),seen=new Set(),m=map.getBoundingClientRect();
 for(const start of cells){const sk=`${start.r}:${start.c}`;if(seen.has(sk))continue;const group=[],queue=[start];seen.add(sk);while(queue.length){const cur=queue.shift();group.push(cur);for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=`${cur.r+dr}:${cur.c+dc}`,n=byKey.get(k);if(n&&!seen.has(k)&&n.label===start.label){seen.add(k);queue.push(n)}}}
  if(group.length<2)continue;const minR=Math.min(...group.map(x=>x.r)),maxR=Math.max(...group.map(x=>x.r)),minC=Math.min(...group.map(x=>x.c)),maxC=Math.max(...group.map(x=>x.c));let rectangle=true;for(let r=minR;r<=maxR&&rectangle;r++)for(let c=minC;c<=maxC;c++){const x=byKey.get(`${r}:${c}`);if(!x||x.label!==start.label){rectangle=false;break}}
  if(!rectangle)continue;const rects=group.map(x=>x.el.getBoundingClientRect()),left=Math.min(...rects.map(r=>r.left))-m.left,top=Math.min(...rects.map(r=>r.top))-m.top,right=Math.max(...rects.map(r=>r.right))-m.left,bottom=Math.max(...rects.map(r=>r.bottom))-m.top;group.forEach(x=>x.el.style.visibility='hidden');const box=document.createElement('div');box.className='stageMerged';box.textContent=start.label||'במה';box.style.left=left+'px';box.style.top=top+'px';box.style.width=Math.max(1,right-left)+'px';box.style.height=Math.max(1,bottom-top)+'px';map.appendChild(box)
 }
}
function drawAll(){if(drawing)return;drawing=true;if(observer)observer.disconnect();try{drawGroups();document.querySelectorAll('.areaMap').forEach(stageGroups)}finally{drawing=false;observe()}}
function observe(){if(!observer)observer=new MutationObserver(schedule);const el=document.getElementById('layoutMap');if(el)observer.observe(el,{childList:true,subtree:true})}
window.addEventListener('yn:seating-rendered',schedule);window.addEventListener('resize',schedule);window.addEventListener('load',()=>setTimeout(schedule,80));observe();setTimeout(schedule,120);
})();