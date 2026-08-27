(()=>{
const {SUPA,KEY,SITE,makeClient,isAdmin}=YNGeneric,db=makeClient();
const BASE=SUPA+'/functions/v1/request-form',org=new URL(location.href).searchParams.get('org')||'';
const FN=BASE+(org?'?org='+encodeURIComponent(org):'');
const $=id=>document.getElementById(id);
let lists=[],seatPrefs=new Map(),timer=null,lastLookup='',lookupSeq=0,lookupController=null,authSeq=0,authTimer=null,currentPrefListId=null;
function endpoint(extra=''){const sep=FN.includes('?')?'&':'?';return extra?FN+sep+extra:FN}
function val(id){const n=Number($(id)?.value);return Number.isInteger(n)&&n>=0&&n<=100?n:null}
function msg(t,e=false){const x=$('msg');x.textContent=t||'';x.className='msg '+(t?(e?'err':'ok'):'')}
function listById(id){return lists.find(l=>String(l.id)===String(id))||null}
function prefArray(listId){return seatPrefs.get(String(listId))||[]}
function setPrefArray(listId,a){seatPrefs.set(String(listId),a)}
function seatLabel(list,seatId){
  if(!list?.layout)return seatId;
  const s=YNLayout.buildSeats(list.layout).find(x=>x.id===seatId);
  if(!s)return seatId;
  return `${s.area_name||''} · שורה ${s.row_label||s.row} · מקום ${s.col||s.seat_index}`.replace(/^ · /,'');
}
function renderPrefSummary(listId){
  const l=listById(listId),box=document.querySelector(`[data-pref-summary="${String(listId)}"]`);
  if(!box||!l)return;
  const a=prefArray(listId);
  if(!a.length){box.textContent='לא נבחרו מקומות מועדפים.';return}
  box.innerHTML=a.map((id,i)=>`<span class="prefSummaryItem"><b>${i+1}.</b> ${YNGeneric.esc(seatLabel(l,id))}</span>`).join('');
}
function countFor(listId,sec){return val(`${sec}-${listId}`)||0}
function pruneInvalidPrefs(listId){
  const l=listById(listId);if(!l?.layout)return;
  const byId=new Map(YNLayout.buildSeats(l.layout).map(s=>[s.id,s]));
  const a=prefArray(listId).filter(id=>{const s=byId.get(id);return s&&countFor(listId,s.section)>0});
  setPrefArray(listId,a.slice(0,3));renderPrefSummary(listId);
  if(currentPrefListId===String(listId))renderPrefDialog();
}
function renderLists(){
  const box=$('requestCards');
  if(!lists.length){box.innerHTML='<div class="closed">כרגע אין רשימות פתוחות לרישום.</div>';$('save').disabled=true;return}
  box.innerHTML=lists.map(l=>`<div class="card requestCard" data-list="${l.id}">
    <h2>${YNGeneric.esc(l.title)}</h2>
    <div class="requestGrid">
      <div class="countField"><label for="men-${l.id}">גברים</label><input id="men-${l.id}" type="number" min="0" max="100" step="1" value="0" inputmode="numeric"></div>
      <div class="countField"><label for="women-${l.id}">נשים</label><input id="women-${l.id}" type="number" min="0" max="100" step="1" value="0" inputmode="numeric"></div>
    </div>
    <div class="seatPreferenceBox">
      <div class="seatPreferenceHead"><b>מקומות מועדפים</b><span>בקשה בלבד — השיבוץ הסופי נקבע על ידי מנהל בית הכנסת.</span></div>
      ${l.layout?`<button class="prefOpen" type="button" data-pref-open="${l.id}">בחירת מקומות על התרשים</button><div class="prefSummary" data-pref-summary="${l.id}"></div>`:`<div class="prefUnavailable">לא הוגדרה עדיין תצורת אולם לרשימה זו, ולכן אין כרגע אפשרות לבחור מקום ספציפי.</div>`}
    </div>
  </div>`).join('');
  box.querySelectorAll('[data-pref-open]').forEach(b=>b.onclick=()=>openPrefDialog(b.dataset.prefOpen));
  for(const l of lists){
    ['men','women'].forEach(sec=>{const x=$(`${sec}-${l.id}`);if(x)x.addEventListener('input',()=>pruneInvalidPrefs(l.id))});
    renderPrefSummary(l.id);
  }
  $('save').disabled=false;
}
async function call(url,opts={}){
  const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json','apikey':KEY,...(opts.headers||{})}});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||('HTTP '+r.status));return data;
}
function applySynagogue(data){if(data?.synagogue?.name){document.title='רישום למקומות — '+data.synagogue.name;const h=document.querySelector('h1');if(h)h.textContent='רישום למקומות — '+data.synagogue.name}}
async function loadLists(){
  try{const data=await call(FN);applySynagogue(data);lists=data.lists||[];seatPrefs.clear();renderLists()}
  catch(e){$('requestCards').innerHTML='<div class="closed">לא ניתן לטעון את רשימות הרישום כרגע.</div>';msg(e.message==='Synagogue not found'?'הקישור לבית הכנסת אינו תקין.':'שגיאה בטעינת הנתונים.',true)}
}
function clearValues(){
  seatPrefs.clear();
  for(const l of lists){const m=$('men-'+l.id),w=$('women-'+l.id);if(m)m.value=0;if(w)w.value=0;renderPrefSummary(l.id)}
  $('notes').value='';$('existing').classList.remove('show');
}
async function lookup(){
  clearTimeout(timer);timer=null;
  const name=$('family').value.trim().replace(/\s+/g,' ');
  if(!name){lastLookup='';lookupController?.abort();lookupSeq++;clearValues();msg('');return}
  if(name===lastLookup)return;
  const seq=++lookupSeq;lookupController?.abort();const controller=new AbortController();lookupController=controller;
  try{
    const data=await call(endpoint('family='+encodeURIComponent(name)),{signal:controller.signal});if(seq!==lookupSeq)return;
    applySynagogue(data);
    if(Array.isArray(data.lists)){
      const old=lists.map(x=>`${x.id}:${x.default_layout_id||''}`).join(','),next=data.lists.map(x=>`${x.id}:${x.default_layout_id||''}`).join(',');
      if(old!==next){lists=data.lists;renderLists()}
    }
    clearValues();
    if(data.family){
      $('family').value=data.family.family_name;$('notes').value=data.family.notes||'';$('existing').classList.add('show');
      const map=new Map((data.entries||[]).map(e=>[String(e.request_list_id),e]));
      for(const l of lists){const e=map.get(String(l.id));if(e){$('men-'+l.id).value=e.men;$('women-'+l.id).value=e.women}}
      const grouped=new Map();
      for(const p of (data.seat_preferences||[]).sort((a,b)=>a.priority-b.priority)){const k=String(p.request_list_id),a=grouped.get(k)||[];a.push(String(p.seat_id));grouped.set(k,a)}
      seatPrefs=grouped;for(const l of lists)renderPrefSummary(l.id);
    }
    lastLookup=name;msg('');
  }catch(e){if(e?.name==='AbortError'||seq!==lookupSeq)return;lastLookup='';msg('לא הצלחנו לבדוק רישום קיים.',true)}finally{if(lookupController===controller)lookupController=null}
}
function ensurePrefDialog(){
  if($('seatPrefDialog'))return;
  const d=document.createElement('dialog');d.id='seatPrefDialog';d.className='seatPrefDialog';
  d.innerHTML=`<div class="prefDialogHead"><div><h2 id="seatPrefTitle"></h2><div class="prefDialogNote">אפשר לבחור עד 3 מקומות, לפי סדר עדיפות. הבחירה אינה מבטיחה את המקום.</div></div><button id="seatPrefCloseX" type="button" class="prefCloseX" aria-label="סגירה">×</button></div>
    <div id="seatPrefMap" class="seatPrefMap"></div>
    <div class="prefChosenWrap"><b>העדיפויות שבחרתם</b><div id="seatPrefChosen" class="prefChosen"></div></div>
    <div id="seatPrefDialogMsg" class="prefDialogMsg" aria-live="polite"></div>
    <div class="prefDialogActions"><button id="seatPrefClear" type="button">נקה בחירה</button><button id="seatPrefDone" type="button" class="primary">סיום</button></div>`;
  document.body.appendChild(d);
  $('seatPrefCloseX').onclick=()=>d.close();$('seatPrefDone').onclick=()=>d.close();
  $('seatPrefClear').onclick=()=>{if(!currentPrefListId)return;setPrefArray(currentPrefListId,[]);renderPrefDialog();renderPrefSummary(currentPrefListId)};
}
function prefCellHtml(area,r,c,cell,seats,selected,allowed){
  if(cell.type!=='seat')return `<div class="prefCell ${cell.type==='aisle'?'aisle':'spacer'}">${cell.type==='stage'?YNGeneric.esc(cell.label||'במה'):''}</div>`;
  const s=seats.find(x=>x.area_id===area.id&&x.row===r+1&&x.col===c+1);if(!s)return '<div class="prefSeat unavailable"></div>';
  const idx=selected.indexOf(s.id),disabled=!allowed.has(s.section);
  return `<button type="button" class="prefSeat${idx>=0?' selected':''}" data-pref-seat="${YNGeneric.esc(s.id)}" ${disabled?'disabled':''} title="${YNGeneric.esc(seatLabel(listById(currentPrefListId),s.id))}">${idx>=0?idx+1:''}</button>`;
}
function renderPrefDialog(){
  const l=listById(currentPrefListId);if(!l?.layout)return;
  $('seatPrefTitle').textContent=`${l.title} — בחירת מקומות מועדפים`;
  const selected=prefArray(l.id),seats=YNLayout.buildSeats(l.layout),d=YNLayout.toAreaDefinition(l.layout),allowed=new Set();
  if(countFor(l.id,'men')>0)allowed.add('men');if(countFor(l.id,'women')>0)allowed.add('women');
  $('seatPrefMap').innerHTML=d.levels.map(level=>`<section class="prefLevel"><h3>${YNGeneric.esc(level.name)}</h3>${level.areas.map(area=>`<section class="prefArea"><div class="prefAreaTitle">${YNGeneric.esc(area.name)} <span>${area.section==='women'?'נשים':'גברים'}</span></div><div class="prefRows">${Array.from({length:area.grid.rows},(_,r)=>`<div class="prefRow"><span class="prefRowNo">${r+1}</span><div class="prefRowCells">${(area.grid.cells[r]||[]).map((cell,c)=>prefCellHtml(area,r,c,cell,seats,selected,allowed)).join('')}</div></div>`).join('')}</div></section>`).join('')}</section>`).join('');
  $('seatPrefMap').querySelectorAll('[data-pref-seat]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.prefSeat,a=[...prefArray(l.id)],i=a.indexOf(id);$('seatPrefDialogMsg').textContent='';
    if(i>=0)a.splice(i,1);else if(a.length<3)a.push(id);else return void($('seatPrefDialogMsg').textContent='אפשר לבחור עד 3 מקומות.');
    setPrefArray(l.id,a);renderPrefDialog();renderPrefSummary(l.id);
  });
  $('seatPrefChosen').innerHTML=selected.length?selected.map((id,i)=>`<span><b>${i+1}.</b> ${YNGeneric.esc(seatLabel(l,id))}</span>`).join(''):'<span class="mutedPref">לא נבחרו מקומות.</span>';
}
function openPrefDialog(listId){
  ensurePrefDialog();const l=listById(listId);if(!l?.layout)return;
  if(countFor(l.id,'men')<=0&&countFor(l.id,'women')<=0){alert('לפני בחירת מקום, הזינו כמה מקומות נדרשים לגברים ו/או לנשים ברשימה זו.');return}
  currentPrefListId=String(l.id);renderPrefDialog();$('seatPrefDialog').showModal();
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
$('form').onsubmit=async e=>{
  e.preventDefault();const name=$('family').value.trim().replace(/\s+/g,' ');if(!name)return msg('יש להזין שם משפחה.',true);
  const entries=[],seat_preferences=[];
  for(const l of lists){
    const men=val('men-'+l.id),women=val('women-'+l.id);if(men===null||women===null)return msg('יש להזין מספר שלם בין 0 ל־100 בכל השדות.',true);
    entries.push({request_list_id:l.id,men,women});
    if(l.layout){
      const byId=new Map(YNLayout.buildSeats(l.layout).map(s=>[s.id,s])),a=prefArray(l.id);
      for(let i=0;i<a.length;i++){const s=byId.get(a[i]);if(!s||Number(s.section==='men'?men:women)<=0)return msg('אחת מהעדפות המקום אינה מתאימה למספר המקומות שביקשתם. בדקו את הבחירה.',true);seat_preferences.push({request_list_id:l.id,layout_id:l.layout.id,seat_id:a[i],priority:i+1})}
    }
  }
  const save=$('save');save.disabled=true;save.textContent='שומר...';
  try{lookupController?.abort();lookupSeq++;await call(FN,{method:'POST',body:JSON.stringify({family_name:name,notes:$('notes').value.trim(),entries,seat_preferences})});$('existing').classList.add('show');msg('הרישום והעדפות המקום נשמרו בהצלחה.');lastLookup=name}
  catch(e){const text=e.message==='One or more request lists are closed'?'אחת הרשימות נסגרה לרישום. רעננו את הדף ונסו שוב.':e.message==='Seat preference layout is unavailable'?'תצורת האולם השתנתה. רעננו את הדף ובחרו שוב את המקומות.':'לא הצלחנו לשמור את הרישום. נסו שוב.';msg(text,true)}
  finally{save.disabled=!lists.length;save.textContent='שמירת הרישום'}
};
loadLists();renderAuth();
})();
