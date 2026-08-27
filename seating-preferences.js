(()=>{
const state={key:'',prefs:[],visible:true,selectedFamily:null,loading:false,seq:0};
const $=id=>document.getElementById(id);
function ensureUi(){
  if($('seatPreferenceToolbar'))return;
  const bar=document.createElement('div');bar.id='seatPreferenceToolbar';bar.className='seatPreferenceToolbar';
  bar.innerHTML=`<div><b>בקשות למקומות</b><span id="seatPreferenceInfo">טוען...</span></div><div class="seatPreferenceActions"><button id="seatPreferenceToggle" class="btn" type="button">הסתר בקשות</button><button id="seatPreferenceClearFamily" class="btn" type="button" style="display:none">נקה הדגשת משפחה</button></div>`;
  document.querySelector('.summary')?.after(bar);
  $('seatPreferenceToggle').onclick=()=>{state.visible=!state.visible;$('seatPreferenceToggle').textContent=state.visible?'הסתר בקשות':'הצג בקשות';decorate()};
  $('seatPreferenceClearFamily').onclick=()=>{state.selectedFamily=null;$('seatPreferenceClearFamily').style.display='none';decorate()};
  const d=document.createElement('dialog');d.id='seatPreferenceDetails';d.className='seatPreferenceDetails';
  d.innerHTML='<div class="seatPreferenceDialogHead"><h3 id="seatPreferenceDetailsTitle"></h3><button id="seatPreferenceDetailsClose" type="button" aria-label="סגירה">×</button></div><div id="seatPreferenceDetailsBody"></div>';
  document.body.appendChild(d);$('seatPreferenceDetailsClose').onclick=()=>d.close();
}
function key(){return `${YN.S.listId||''}|${YN.S.layoutId||''}`}
function familyName(id){return YN.familyName(id)||id}
function seatLabel(id){
  const s=YN.S.seats.find(x=>x.id===id);
  if(!s)return id;
  return `${s.area_name||''} · שורה ${s.row_label||s.row} · מקום ${s.col||s.seat_index}`.replace(/^ · /,'');
}
async function load(){
  ensureUi();
  const k=key();state.key=k;state.selectedFamily=null;$('seatPreferenceClearFamily').style.display='none';
  if(!YN.S.listId||!YN.S.layoutId){state.prefs=[];return decorate()}
  const seq=++state.seq;state.loading=true;$('seatPreferenceInfo').textContent='טוען...';
  const {data,error}=await YN.db.from('yamim_noraim_seat_preferences')
    .select('family_id,seat_id,section,priority')
    .eq('request_list_id',YN.S.listId).eq('layout_id',YN.S.layoutId).order('priority');
  if(seq!==state.seq)return;
  state.loading=false;
  if(error){state.prefs=[];$('seatPreferenceInfo').textContent='לא ניתן לטעון בקשות למקומות';console.error(error);return decorate()}
  state.prefs=data||[];decorate();
}
function bySeat(){
  const m=new Map();for(const p of state.prefs){const a=m.get(p.seat_id)||[];a.push(p);m.set(p.seat_id,a)}return m;
}
function familyPrefs(fid){return state.prefs.filter(p=>p.family_id===fid).sort((a,b)=>a.priority-b.priority)}
function openSeatDetails(seatId){
  const prefs=(bySeat().get(seatId)||[]).sort((a,b)=>a.priority-b.priority||familyName(a.family_id).localeCompare(familyName(b.family_id),'he'));
  const assigned=YN.S.assignments.find(a=>a.seat_id===seatId);
  $('seatPreferenceDetailsTitle').textContent=seatLabel(seatId);
  $('seatPreferenceDetailsBody').innerHTML=`${assigned?`<div class="actualAssignment">משובץ בפועל: <b>${YN.esc(assigned.family_name)}</b></div>`:''}
    ${prefs.length?prefs.map(p=>`<button type="button" class="seatRequester" data-family="${YN.esc(p.family_id)}"><b>${YN.esc(familyName(p.family_id))}</b><span>עדיפות ${p.priority}</span></button>`).join(''):'<div class="noSeatRequests">אין בקשות למקום זה.</div>'}`;
  $('seatPreferenceDetailsBody').querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{state.selectedFamily=b.dataset.family;$('seatPreferenceClearFamily').style.display='inline-block';$('seatPreferenceDetails').close();decorate()});
  $('seatPreferenceDetails').showModal();
}
function decorateFamilies(){
  document.querySelectorAll('.familyPreferenceLine').forEach(x=>x.remove());
  document.querySelectorAll('.requests .family').forEach(card=>{
    const name=card.querySelector('.fname')?.textContent?.trim();if(!name)return;
    const req=YN.S.reqs.find(r=>r.family_name===name);if(!req)return;
    const prefs=familyPrefs(req.family_id);if(!prefs.length)return;
    const line=document.createElement('div');line.className='familyPreferenceLine';
    line.innerHTML=`<button type="button" class="familyPreferenceBtn">${state.selectedFamily===req.family_id?'מוצג על התרשים':'הצג בקשות למקומות'} · ${prefs.length}</button><span>${prefs.map(p=>`${p.priority}: ${YN.esc(seatLabel(p.seat_id))}`).join(' · ')}</span>`;
    line.querySelector('button').onclick=()=>{state.visible=true;$('seatPreferenceToggle').textContent='הסתר בקשות';state.selectedFamily=state.selectedFamily===req.family_id?null:req.family_id;$('seatPreferenceClearFamily').style.display=state.selectedFamily?'inline-block':'none';decorate();if(state.selectedFamily)$('layoutMap')?.scrollIntoView({behavior:'smooth',block:'start'})};
    card.appendChild(line);
  });
}
function decorate(){
  ensureUi();
  document.querySelectorAll('.seatPrefBadge,.seatPrefPriority').forEach(x=>x.remove());
  document.querySelectorAll('.seatPreferenceRequested,.seatPreferenceFamily').forEach(x=>x.classList.remove('seatPreferenceRequested','seatPreferenceFamily'));
  const map=bySeat(),selected=state.selectedFamily?new Map(familyPrefs(state.selectedFamily).map(p=>[p.seat_id,p])):new Map();
  if(state.visible){
    document.querySelectorAll('.seat[data-seat]').forEach(el=>{
      const seatId=el.dataset.seat,prefs=map.get(seatId)||[];
      if(prefs.length){
        el.classList.add('seatPreferenceRequested');
        const b=document.createElement('span');b.className='seatPrefBadge';b.textContent=String(prefs.length);b.title=`${prefs.length} בקשות למקום זה`;
        b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openSeatDetails(seatId)});
        el.appendChild(b);
      }
      const sp=selected.get(seatId);
      if(sp){
        el.classList.add('seatPreferenceFamily');
        const p=document.createElement('span');p.className='seatPrefPriority';p.textContent=String(sp.priority);p.title=`עדיפות ${sp.priority} של ${familyName(sp.family_id)}`;el.appendChild(p);
      }
    });
  }
  decorateFamilies();
  const families=new Set(state.prefs.map(p=>p.family_id)).size,seats=map.size;
  $('seatPreferenceInfo').textContent=state.loading?'טוען...':`${state.prefs.length} בקשות · ${families} משפחות · ${seats} מקומות מבוקשים`;
}
function onRendered(){
  ensureUi();
  if(key()!==state.key)return void load();
  decorate();
}
window.addEventListener('yn:seating-rendered',onRendered);
if(window.YN)onRendered();else window.addEventListener('load',()=>window.YN&&onRendered(),{once:true});
})();
