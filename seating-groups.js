(()=>{
const style=document.createElement('style');
style.textContent=`
.seat.group-single{border:1px solid #6d9b7a!important;border-radius:6px!important}
.seat.group-start{border:1px solid #6d9b7a!important;border-left:0!important;border-radius:0 6px 6px 0!important}
.seat.group-middle{border-top:1px solid #6d9b7a!important;border-bottom:1px solid #6d9b7a!important;border-right:0!important;border-left:0!important;border-radius:0!important}
.seat.group-end{border:1px solid #6d9b7a!important;border-right:0!important;border-radius:6px 0 0 6px!important}
.block .seat.group-middle,.block .seat.group-end{margin-right:calc(-1 * var(--gap))}
`;
document.head.appendChild(style);
function mark(){
 document.querySelectorAll('.seat.taken').forEach(el=>{
   el.classList.remove('group-single','group-start','group-middle','group-end');
   const g=el.dataset.group;if(!g)return;
   const prev=el.previousElementSibling,next=el.nextElementSibling;
   const samePrev=prev?.classList?.contains('seat')&&prev.dataset.group===g;
   const sameNext=next?.classList?.contains('seat')&&next.dataset.group===g;
   if(!samePrev&&!sameNext)el.classList.add('group-single');
   else if(!samePrev&&sameNext)el.classList.add('group-start');
   else if(samePrev&&sameNext)el.classList.add('group-middle');
   else el.classList.add('group-end');
 });
}
new MutationObserver(()=>requestAnimationFrame(mark)).observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',mark);setTimeout(mark,100);
})();