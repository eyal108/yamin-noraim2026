(()=>{
let observer;
function drawGroups(){
  if(observer)observer.disconnect();
  document.querySelectorAll('.groupOverlay').forEach(x=>x.remove());
  document.querySelectorAll('.rowseats').forEach(row=>{
    const groups=new Map();
    row.querySelectorAll('.seat.taken[data-group]').forEach(el=>{
      const g=el.dataset.group;if(!g)return;
      if(!groups.has(g))groups.set(g,[]);
      groups.get(g).push(el);
    });
    groups.forEach((els,g)=>{
      if(!els.length)return;
      const left=Math.min(...els.map(e=>e.offsetLeft));
      const right=Math.max(...els.map(e=>e.offsetLeft+e.offsetWidth));
      const label=els.map(e=>e.querySelector('.gname')?.textContent||'').find(Boolean)||'';
      const overlay=document.createElement('div');
      overlay.className='groupOverlay'+(els.some(e=>e.classList.contains('selected'))?' selected':'');
      overlay.dataset.group=g;
      overlay.style.left=left+'px';
      overlay.style.width=(right-left)+'px';
      overlay.textContent=label;
      overlay.title=label;
      row.appendChild(overlay);
    });
  });
  observe();
}
function observe(){
  if(!observer)observer=new MutationObserver(()=>requestAnimationFrame(drawGroups));
  ['menMap','womenMap'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,subtree:true})});
}
window.addEventListener('resize',()=>requestAnimationFrame(drawGroups));
window.addEventListener('load',()=>setTimeout(drawGroups,50));
setTimeout(drawGroups,150);
})();
