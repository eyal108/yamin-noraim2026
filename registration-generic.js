(()=>{
const {SUPA,KEY,SITE,makeClient,isAdmin}=YNGeneric,db=makeClient();
const BASE=SUPA+'/functions/v1/request-form',org=new URL(location.href).searchParams.get('org')||'';
const FN=BASE+(org?'?org='+encodeURIComponent(org):'');
const $=id=>document.getElementById(id);let lists=[],timer=null,lastLookup='',lookupSeq=0,lookupController=null,authSeq=0,authTimer=null;
function endpoint(extra=''){const sep=FN.includes('?')?'&':'?';return extra?FN+sep+extra:FN}
function val(id){const n=Number($(id)?.value);return Number.isInteger(n)&&n>=0&&n<=100?n:null}
function msg(t,e=false){const x=$('msg');x.textContent=t||'';x.className='msg '+(t?(e?'err':'ok'):'')}
function renderLists(){const box=$('requestCards');if(!lists.length){box.innerHTML='<div class="closed">כרגע אין רשימות פתוחות לרישום.</div>';$('save').disabled=true;return}box.innerHTML=lists.map(l=>`<div class="card requestCard" data-list="${l.id}"><h2>${YNGeneric.esc(l.title)}</h2><div class="requestGrid"><div class="countField"><label for="men-${l.id}">גברים</label><input id="men-${l.id}" type="number" min="0" max="100" step="1" value="0" inputmode="numeric"></div><div class="countField"><label for="women-${l.id}">נשים</label><input id="women-${l.id}" type="number" min="0" max="100" step="1" value="0" inputmode="numeric"></div></div></div>`).join('');$('save').disabled=false}
async function call(url,opts={}){const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json','apikey':KEY,...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||('HTTP '+r.status));return data}
function applySynagogue(data){if(data?.synagogue?.name){document.title='רישום למקומות — '+data.synagogue.name;const h=document.querySelector('h1');if(h)h.textContent='רישום למקומות — '+data.synagogue.name}}
async function loadLists(){try{const data=await call(FN);applySynagogue(data);lists=data.lists||[];renderLists()}catch(e){$('requestCards').innerHTML='<div class="closed">לא ניתן לטעון את רשימות הרישום כרגע.</div>';msg(e.message==='Synagogue not found'?'הקישור לבית הכנסת אינו תקין.':'שגיאה בטעינת הנתונים.',true)}}
function clearValues(){for(const l of lists){const m=$('men-'+l.id),w=$('women-'+l.id);if(m)m.value=0;if(w)w.value=0}$('notes').value='';$('existing').classList.remove('show')}
async function lookup(){
 clearTimeout(timer);timer=null;
 const name=$('family').value.trim().replace(/\s+/g,' ');
 if(!name){lastLookup='';lookupController?.abort();lookupSeq++;clearValues();msg('');return}
 if(name===lastLookup)return;
 const seq=++lookupSeq;lookupController?.abort();const controller=new AbortController();lookupController=controller;
 try{
  const data=await call(endpoint('family='+encodeURIComponent(name)),{signal:controller.signal});if(seq!==lookupSeq)return;
  applySynagogue(data);if(Array.isArray(data.lists)){const old=lists.map(x=>x.id).join(','),next=data.lists.map(x=>x.id).join(',');if(old!==next){lists=data.lists;renderLists()}}
  clearValues();if(data.family){$('family').value=data.family.family_name;$('notes').value=data.family.notes||'';$('existing').classList.add('show');const map=new Map((data.entries||[]).map(e=>[e.request_list_id,e]));for(const l of lists){const e=map.get(l.id);if(e){$('men-'+l.id).value=e.men;$('women-'+l.id).value=e.women}}}
  lastLookup=name;msg('');
 }catch(e){if(e?.name==='AbortError'||seq!==lookupSeq)return;lastLookup='';msg('לא הצלחנו לבדוק רישום קיים.',true)}finally{if(lookupController===controller)lookupController=null}
}
async function renderAuth(){
 const seq=++authSeq,{data:{session}}=await db.auth.getSession();if(seq!==authSeq)return;const login=$('googleLogin'),signed=$('signedIn'),who=$('who'),admin=$('adminLink');
 if(session?.user){login.style.display='none';signed.style.display='block';who.textContent='מחובר: '+(session.user.email||'');const ok=await isAdmin(db,session);if(seq!==authSeq)return;const a=YNGeneric.getAccess?.();admin.style.display=ok?'inline-block':'none';if(ok){const slug=a?.current?.slug||org;admin.href='admin.html'+(slug?'?org='+encodeURIComponent(slug):'')}}else{login.style.display='inline-block';signed.style.display='none';admin.style.display='none'}
}
$('googleLogin').onclick=async()=>{const redirect=SITE+(org?'?org='+encodeURIComponent(org):'');const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect}});if(error)alert('לא ניתן להתחבר כרגע: '+error.message)};
$('logout').onclick=async()=>{await db.auth.signOut()};
db.auth.onAuthStateChange(()=>{clearTimeout(authTimer);authTimer=setTimeout(renderAuth,75)});
$('family').oninput=()=>{lastLookup='';clearTimeout(timer);lookupController?.abort();lookupSeq++;timer=setTimeout(lookup,650)};
$('family').onblur=()=>{clearTimeout(timer);timer=null;lookup()};
$('form').onsubmit=async e=>{e.preventDefault();const name=$('family').value.trim().replace(/\s+/g,' ');if(!name)return msg('יש להזין שם משפחה.',true);const entries=[];for(const l of lists){const men=val('men-'+l.id),women=val('women-'+l.id);if(men===null||women===null)return msg('יש להזין מספר שלם בין 0 ל־100 בכל השדות.',true);entries.push({request_list_id:l.id,men,women})}const save=$('save');save.disabled=true;save.textContent='שומר...';try{lookupController?.abort();lookupSeq++;await call(FN,{method:'POST',body:JSON.stringify({family_name:name,notes:$('notes').value.trim(),entries})});$('existing').classList.add('show');msg('הרישום נשמר בהצלחה.');lastLookup=name}catch(e){msg(e.message==='One or more request lists are closed'?'אחת הרשימות נסגרה לרישום. רעננו את הדף ונסו שוב.':'לא הצלחנו לשמור את הרישום. נסו שוב.',true)}finally{save.disabled=!lists.length;save.textContent='שמירת הרישום'}};
loadLists();renderAuth();
})();
