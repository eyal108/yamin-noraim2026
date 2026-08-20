(()=>{
const {SITE,makeClient,isAdmin,norm,esc}=YNGeneric,db=makeClient(),$=id=>document.getElementById(id);
let session=null,lists=[],layouts=[],currentList=null,rows=[];
const sum=k=>rows.reduce((a,r)=>a+(Number(r[k])||0),0);
function setStatus(t){$('statusEl').textContent=t||''}
function current(){return lists.find(x=>x.id===currentList)||null}
async function gate(){
 const r=await db.auth.getSession();session=r.data.session;
 if(!session?.user){$('loginText').textContent='יש להתחבר כמנהל כדי להיכנס למסך הניהול.';$('adminLogin').classList.remove('hidden');$('adminApp').classList.add('hidden');return false}
 if(!(await isAdmin(db,session))){$('loginText').textContent='החשבון '+(session.user.email||'')+' אינו מוגדר כמנהל.';$('adminLogin').classList.add('hidden');$('adminApp').classList.add('hidden');return false}
 $('loginGate').classList.add('hidden');$('adminApp').classList.remove('hidden');$('adminAuth').textContent='מחובר: '+(session.user.email||'');return true
}
async function loadLayouts(){const {data,error}=await db.from('yamim_noraim_layouts').select('id,title,is_active,sort_order,created_at').eq('is_active',true).order('sort_order').order('created_at');if(error)throw error;layouts=data||[]}
async function loadLists(prefer=null){
 const {data,error}=await db.from('yamim_noraim_request_lists').select('id,code,title,sort_order,is_active,registration_open,default_layout_id,created_at').order('sort_order').order('created_at');
 if(error)throw error;lists=data||[];
 const wanted=prefer||currentList||localStorage.getItem('yn:list');currentList=lists.some(x=>x.id===wanted)?wanted:(lists[0]?.id||null);
 const sel=$('requestListSelect');sel.innerHTML=lists.map(l=>`<option value="${l.id}">${esc(l.title)}${l.is_active?'':' — בארכיון'}</option>`).join('');if(currentList)sel.value=currentList;updateListButtons();
}
function updateDefaultLayout(){const s=$('defaultLayoutSelect'),l=current();s.innerHTML=layouts.map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');s.disabled=!l||!layouts.length;if(!l||!layouts.length)return;const v=layouts.some(x=>x.id===l.default_layout_id)?l.default_layout_id:layouts[0].id;s.value=v}
function updateListButtons(){const l=current();$('toggleRegistrationBtn').textContent=l?.registration_open?'סגור רישום ציבורי':'פתח רישום ציבורי';$('toggleActiveBtn').textContent=l?.is_active?'העבר לארכיון':'החזר לפעילות';$('renameListBtn').disabled=!l;$('toggleRegistrationBtn').disabled=!l;$('toggleActiveBtn').disabled=!l;updateDefaultLayout()}
async function setDefaultLayout(id){const l=current();if(!l||!id)return;const {error}=await db.from('yamim_noraim_request_lists').update({default_layout_id:id,updated_at:new Date().toISOString()}).eq('id',l.id);if(error)return alert('לא ניתן לשמור תצורת ברירת מחדל: '+error.message);l.default_layout_id=id;setStatus('תצורת ברירת המחדל נשמרה')}
async function loadRows(){
 if(!currentList){rows=[];renderRows();return}
 setStatus('טוען...');
 const {data:reqData,error:reqError}=await db.from('yamim_noraim_requests').select('family_id,men,women,updated_at').eq('request_list_id',currentList).order('updated_at',{ascending:false});
 if(reqError)throw reqError;
 const requests=reqData||[],ids=[...new Set(requests.map(x=>x.family_id).filter(Boolean))];let families=[];
 if(ids.length){const {data:famData,error:famError}=await db.from('yamim_noraim_families').select('id,family_name,family_name_normalized,notes,updated_at').in('id',ids);if(famError)throw famError;families=famData||[]}
 const familyMap=new Map(families.map(f=>[f.id,f]));
 rows=requests.map(x=>{const f=familyMap.get(x.family_id);return{family_id:x.family_id,men:x.men,women:x.women,updated_at:x.updated_at,family_name:f?.family_name||'',notes:f?.notes||''}}).sort((a,b)=>a.family_name.localeCompare(b.family_name,'he'));
 renderRows();setStatus(rows.length+' משפחות');
}
function renderRows(){
 $('familiesEl').textContent=rows.length;$('menEl').textContent=sum('men');$('womenEl').textContent=sum('women');
 $('rowsEl').innerHTML=rows.map((r,i)=>`<tr id="row-${i}"><td><input value="${esc(r.family_name)}" data-f="family_name"></td><td><input type="number" min="0" max="100" step="1" value="${r.men}" data-f="men"></td><td><input type="number" min="0" max="100" step="1" value="${r.women}" data-f="women"></td><td><textarea data-f="notes">${esc(r.notes)}</textarea></td><td>${r.updated_at?new Date(r.updated_at).toLocaleString('he-IL'):''}</td><td><div class="actions"><button class="btn" data-save="${i}">שמור</button><button class="btn danger" data-delete="${i}">הסר מהרשימה</button></div></td></tr>`).join('');
 $('rowsEl').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>saveRow(+b.dataset.save));$('rowsEl').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteRow(+b.dataset.delete));
}
async function saveRow(i){
 const row=rows[i],tr=$('row-'+i),v={};tr.querySelectorAll('[data-f]').forEach(el=>v[el.dataset.f]=el.type==='number'?Number(el.value):el.value.trim());
 if(!v.family_name||!Number.isInteger(v.men)||!Number.isInteger(v.women)||v.men<0||v.women<0||v.men>100||v.women>100){tr.className='error';return setStatus('ערכים לא תקינים בשורה')}
 try{
  let q=await db.from('yamim_noraim_families').update({family_name:v.family_name,family_name_normalized:norm(v.family_name),notes:v.notes,updated_at:new Date().toISOString()}).eq('id',row.family_id);if(q.error)throw q.error;
  q=await db.from('yamim_noraim_requests').update({men:v.men,women:v.women,updated_at:new Date().toISOString()}).eq('request_list_id',currentList).eq('family_id',row.family_id);if(q.error)throw q.error;
  tr.className='saved';setStatus('נשמר בהצלחה');setTimeout(loadRows,350);
 }catch(e){tr.className='error';setStatus(e.code==='23505'?'כבר קיימת משפחה בשם הזה.':'שגיאה בשמירה: '+e.message)}
}
async function deleteRow(i){
 const r=rows[i],l=current();if(!confirm(`להסיר את משפחת ${r.family_name} מהרשימה "${l?.title||''}"?\n\nשיבוצי המשפחה ברשימה הזו יימחקו, אך היא תישאר ברשימות אחרות.`))return;
 setStatus('מוחק...');try{
  let q=await db.from('yamim_noraim_seating_v2').delete().eq('request_list_id',currentList).eq('family_id',r.family_id);if(q.error)throw q.error;
  q=await db.from('yamim_noraim_requests').delete().eq('request_list_id',currentList).eq('family_id',r.family_id);if(q.error)throw q.error;await loadRows();
 }catch(e){setStatus('שגיאה במחיקה: '+e.message)}
}
async function addFamily(){
 if(!currentList)return;const name=prompt('שם המשפחה להוספה:');if(!name?.trim())return;const clean=name.trim().replace(/\s+/g,' ');
 try{
  let {data:f,error}=await db.from('yamim_noraim_families').select('id').eq('family_name_normalized',norm(clean)).maybeSingle();if(error)throw error;
  if(!f){const x=await db.from('yamim_noraim_families').insert({family_name:clean,family_name_normalized:norm(clean)}).select('id').single();if(x.error)throw x.error;f=x.data}
  const q=await db.from('yamim_noraim_requests').upsert({request_list_id:currentList,family_id:f.id,men:0,women:0,updated_at:new Date().toISOString()},{onConflict:'request_list_id,family_id'});if(q.error)throw q.error;await loadRows();
 }catch(e){alert('לא ניתן להוסיף משפחה: '+e.message)}
}
async function newList(){
 const title=prompt('כותרת הרשימה החדשה:');if(!title?.trim())return;const code='list-'+Date.now().toString(36);
 const max=lists.reduce((m,x)=>Math.max(m,Number(x.sort_order)||0),0)+10;const {data,error}=await db.from('yamim_noraim_request_lists').insert({code,title:title.trim(),sort_order:max,is_active:true,registration_open:true,default_layout_id:layouts[0]?.id||null}).select('id').single();if(error)return alert('לא ניתן ליצור רשימה: '+error.message);await loadLists(data.id);await loadRows();
}
async function renameList(){const l=current();if(!l)return;const title=prompt('שם חדש לרשימה:',l.title);if(!title?.trim()||title.trim()===l.title)return;const {error}=await db.from('yamim_noraim_request_lists').update({title:title.trim(),updated_at:new Date().toISOString()}).eq('id',l.id);if(error)return alert(error.message);await loadLists(l.id)}
async function toggleListField(field){const l=current();if(!l)return;const {error}=await db.from('yamim_noraim_request_lists').update({[field]:!l[field],updated_at:new Date().toISOString()}).eq('id',l.id);if(error)return alert(error.message);await loadLists(l.id)}
function exportCsv(){
 const l=current();if(!l)return;const cell=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};const out=[['משפחה','גברים','נשים','הערות','עודכן'],...rows.map(r=>[r.family_name,r.men,r.women,r.notes,r.updated_at||''])].map(x=>x.map(cell).join(',')).join('\r\n');const blob=new Blob(['\ufeff'+out],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(l.title||'requests').replace(/[\\/:*?"<>|]/g,'-')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}
async function loadAdmins(){const {data,error}=await db.from('yamim_noraim_admins').select('email,created_at').order('email');if(error){$('adminsList').innerHTML='<div class="authNote">לא ניתן לטעון מנהלים.</div>';return}$('adminsList').innerHTML=(data||[]).map(a=>`<div class="adminRow"><div><div class="adminEmail">${esc(a.email)}</div>${a.email.toLowerCase()===String(session?.user?.email||'').toLowerCase()?'<div class="authNote">זה החשבון שלך</div>':''}</div><button class="btn danger" data-email="${esc(a.email)}">הסר</button></div>`).join('');$('adminsList').querySelectorAll('[data-email]').forEach(b=>b.onclick=()=>removeAdmin(b.dataset.email))}
async function addAdmin(){const e=$('adminEmail'),email=e.value.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('יש להזין כתובת אימייל תקינה.');const {error}=await db.from('yamim_noraim_admins').insert({email});if(error)return alert(error.code==='23505'?'הכתובת כבר מוגדרת כמנהל.':error.message);e.value='';loadAdmins()}
async function removeAdmin(email){if(!confirm('להסיר את '+email+' מרשימת המנהלים?'))return;const {error}=await db.from('yamim_noraim_admins').delete().eq('email',email);if(error)return alert(error.message);loadAdmins()}
async function refresh(){try{await loadLayouts();await loadLists();await loadRows();await loadAdmins()}catch(e){setStatus('שגיאה: '+e.message)}}
$('adminLogin').onclick=()=>db.auth.signInWithOAuth({provider:'google',options:{redirectTo:SITE+'admin.html'}});$('logoutBtn').onclick=async()=>{await db.auth.signOut();location.reload()};$('refreshBtn').onclick=refresh;$('exportBtn').onclick=exportCsv;$('addFamilyBtn').onclick=addFamily;$('newListBtn').onclick=newList;$('renameListBtn').onclick=renameList;$('toggleRegistrationBtn').onclick=()=>toggleListField('registration_open');$('toggleActiveBtn').onclick=()=>toggleListField('is_active');$('requestListSelect').onchange=async e=>{currentList=e.target.value;localStorage.setItem('yn:list',currentList);updateListButtons();await loadRows()};$('defaultLayoutSelect').onchange=e=>setDefaultLayout(e.target.value);$('addAdminBtn').onclick=addAdmin;$('adminEmail').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addAdmin()}});
(async()=>{if(await gate())await refresh()})();
})();