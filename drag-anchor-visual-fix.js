(()=>{
const STRIDE=34,BOX=30,MARGIN=2;
function parseDrag(e){
  try{return JSON.parse(e.dataTransfer?.getData('application/json')||'{}')||{}}catch{return{}}
}
function makeGhost(count,kind){
  const g=document.createElement('div');
  g.className='ynAnchorGhost';
  g.style.cssText='position:fixed;left:-10000px;top:-10000px;display:flex;align-items:center;direction:ltr;pointer-events:none;z-index:-1;';
  for(let i=0;i<count;i++){
    const s=document.createElement('span');
    s.style.cssText=`box-sizing:border-box;width:${BOX}px;height:${BOX}px;flex:0 0 ${BOX}px;margin:0 ${MARGIN}px;border:2px solid #50665a;border-radius:5px;background:${kind==='group'?'#9fcbae':'#dce9df'};`;
    g.appendChild(s);
  }
  document.body.appendChild(g);return g;
}
document.addEventListener('dragstart',e=>{
  const t=e.target?.closest?.('.frag,.seat[data-group]');
  if(!t||!e.dataTransfer)return;
  const d=parseDrag(e),count=Math.max(1,Number(d.count)||Number(t.dataset.count)||1);
  if(d.kind!=='request'&&d.kind!=='group')return;
  const g=makeGhost(count,d.kind);
  try{
    // Placement logic anchors the seat under the pointer as the visual RIGHT edge.
    // Put the drag-image hotspot on that same edge so the preview and drop agree.
    const hotspotX=Math.max(8,count*STRIDE-8);
    e.dataTransfer.setDragImage(g,hotspotX,Math.round(BOX/2));
  }catch{}
  setTimeout(()=>g.remove(),0);
},false);
})();
