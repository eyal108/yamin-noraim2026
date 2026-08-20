(()=>{
if(!window.YNGeneric)return;
const db=YNGeneric.makeClient(),$=id=>document.getElementById(id);
let box=null,label=null,busy=false;
function setStatus(t){const el=$('statusEl');if(el)el.textContent=t||''}
async function refresh(){
 const sel=$('requestListSelect');if(!box||!sel?.value){if(box){box.checked=false;box.disabled=true}return}
 box.disabled=true;
 const {data,error}=await db.from('yamim_noraim_request_lists').select('show_on_registration').eq('id',sel.value).maybeSingle();
 if(error){setStatus('לא ניתן לטעון את הגדרת עמוד הרישום: '+error.message);return}
 box.checked=!!data?.show_on_registration;box.disabled=false;
}
async function save(){
 if(busy||!box)return;const sel=$('requestListSelect'),id=sel?.value;if(!id)return;busy=true;box.disabled=true;
 const wanted=box.checked;
 const {error}=await db.from('yamim_noraim_request_lists').update({show_on_registration:wanted,updated_at:new Date().toISOString()}).eq('id',id);
 if(error){box.checked=!wanted;setStatus('לא ניתן לשמור את ההגדרה: '+error.message)}else setStatus(wanted?'הרשימה תופיע בעמוד הרישום.':'הרשימה הוסרה מעמוד הרישום.');
 box.disabled=false;busy=false;
}
function init(){
 const meta=document.querySelector('.listMeta'),sel=$('requestListSelect');if(!meta||!sel||$('showOnRegistration'))return;
 label=document.createElement('label');label.className='publicListToggle';label.title='רק רשימות פעילות, פתוחות לרישום ומסומנות כאן מופיעות בעמוד הרישום.';
 label.innerHTML='<input id="showOnRegistration" type="checkbox"><span>מוצג בעמוד הרישום</span>';
 meta.prepend(label);box=$('showOnRegistration');box.onchange=save;
 const style=document.createElement('style');style.textContent='.publicListToggle{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid #c8d0ca;border-radius:9px;background:#f7f9f7;font-weight:700;cursor:pointer}.publicListToggle input{width:18px;height:18px;margin:0;accent-color:#263d31}.publicListToggle:has(input:disabled){opacity:.55;cursor:default}';document.head.appendChild(style);
 sel.addEventListener('change',()=>setTimeout(refresh,0));
 new MutationObserver(()=>setTimeout(refresh,0)).observe(sel,{childList:true,subtree:true});
 $('refreshBtn')?.addEventListener('click',()=>setTimeout(refresh,350));
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
