(()=>{
const db=YNGeneric.makeClient(),listSel=document.getElementById('requestListSelect'),layoutSel=document.getElementById('defaultLayoutSelect');
if(!listSel||!layoutSel)return;
let seq=0,timer=null;
function ensureEmptyOption(){let o=layoutSel.querySelector('option[value=""]');if(!o){o=document.createElement('option');o.value='';o.textContent='— לא נבחרה תצורת ברירת־מחדל —';o.disabled=true;layoutSel.prepend(o)}return o}
async function sync(){const listId=listSel.value;if(!listId)return;const my=++seq;const {data,error}=await db.from('yamim_noraim_request_lists').select('default_layout_id').eq('id',listId).maybeSingle();if(my!==seq||error||!data)return;ensureEmptyOption();layoutSel.value=data.default_layout_id||''}
listSel.addEventListener('change',()=>setTimeout(sync,0));
document.getElementById('refreshBtn')?.addEventListener('click',()=>setTimeout(sync,120));
const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(sync,0)});observer.observe(layoutSel,{childList:true});
setTimeout(sync,120);
})();
