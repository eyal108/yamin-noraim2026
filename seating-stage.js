(()=>{
function drawStage(){
  const map=document.getElementById('menMap');if(!map)return;
  const stages=[...map.querySelectorAll('.stage')];
  map.querySelectorAll('.stageMerged').forEach(x=>x.remove());
  if(stages.length<2)return;
  stages.forEach(x=>x.style.visibility='hidden');
  const a=stages[0].getBoundingClientRect(),b=stages[1].getBoundingClientRect(),m=map.getBoundingClientRect();
  const box=document.createElement('div');
  box.className='stageMerged';box.textContent='במה';
  box.style.left=(Math.min(a.left,b.left)-m.left)+'px';
  box.style.top=(a.top-m.top)+'px';
  box.style.width=Math.max(a.width,b.width)+'px';
  box.style.height=(b.bottom-a.top)+'px';
  map.appendChild(box);
}
const style=document.createElement('style');style.textContent=`
#menMap{position:relative}
.stageMerged{position:absolute;z-index:3;display:flex;align-items:center;justify-content:center;background:#fff1bf;border:1px solid #d8bd61;border-radius:6px;font-weight:900;font-size:13px;pointer-events:none;box-sizing:border-box}
`;document.head.appendChild(style);
function relevant(m){return [...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('.row,.stage')||n.querySelector?.('.stage')))}
const map=document.getElementById('menMap');if(map)new MutationObserver(ms=>{if(ms.some(relevant))requestAnimationFrame(drawStage)}).observe(map,{childList:true,subtree:true});
window.addEventListener('resize',()=>requestAnimationFrame(drawStage));
window.addEventListener('load',()=>setTimeout(drawStage,80));setTimeout(drawStage,180);
})();
