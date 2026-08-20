(()=>{
if(!window.YNGeneric)return;
const db=YNGeneric.makeClient(),$=id=>document.getElementById(id);
function currentTitle(){const o=$('layoutSelect')?.selectedOptions?.[0];return String(o?.textContent||'').replace(/\s+—\s+בארכיון\s*$/,'').trim()}
async function renameLayout(){
 const sel=$('layoutSelect'),id=sel?.value;if(!id)return;
 const old=currentTitle(),name=prompt('שם חדש לתצורה:',old);if(!name?.trim()||name.trim()===old)return;
 const title=name.trim(),btn=$('renameBtn');if(btn){btn.disabled=true;btn.textContent='שומר...'}
 try{
  const {error}=await db.from('yamim_noraim_layouts').update({title,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;
  const opt=sel.selectedOptions?.[0],archived=/—\s*בארכיון/.test(opt?.textContent||'');if(opt)opt.textContent=title+(archived?' — בארכיון':'');
  if($('layoutTitle'))$('layoutTitle').value=title;
  if($('status'))$('status').textContent='שם התצורה שונה. השיבוצים הקיימים נשארו ללא שינוי.';
 }catch(e){alert('שינוי השם נכשל: '+e.message)}finally{if(btn){btn.disabled=false;btn.textContent='שנה שם'}}
}
function init(){
 const toolbar=document.querySelector('.toolbar'),dup=$('duplicateBtn');if(!toolbar||$('renameBtn'))return;
 const b=document.createElement('button');b.className='btn';b.id='renameBtn';b.type='button';b.textContent='שנה שם';b.onclick=renameLayout;
 if(dup)dup.after(b);else toolbar.appendChild(b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
