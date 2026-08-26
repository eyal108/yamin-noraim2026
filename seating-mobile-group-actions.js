(()=>{
const touchMode=(navigator.maxTouchPoints||0)>0||(typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches);
if(!touchMode)return;
let selectedGroup=null,selectedSeat=null,passThroughOnce=false,busy=false;
const $=id=>document.getElementById(id);
function groupRows(g){return window.YN?.S?.assignments?.filter(a=>String(a.seat_group||a.id)===String(g))||[]}
function ensureButtons(){
 const bar=$('touchBar');if(!bar)return false;
 if(!$('touchMoveGroup')){const move=document.createElement('button');move.id='touchMoveGroup';move.type='button';move.textContent='העבר';move.style.display='none';bar.insertBefore(move,$('touchCancel')||null);move.onclick=moveSelected}
 if(!$('touchReleaseGroup')){const rel=document.createElement('button');rel.id='touchReleaseGroup';rel.type='button';rel.textContent='שחרר';rel.style.display='none';bar.insertBefore(rel,$('touchCancel')||null);rel.onclick=releaseSelected}
 const cancel=$('touchCancel');if(cancel&&!cancel.dataset.groupClear){cancel.dataset.groupClear='1';cancel.addEventListener('click',clearSelection)}
 return true
}
function setActionButtons(show){ensureButtons();const m=$('touchMoveGroup'),r=$('touchReleaseGroup');if(m)m.style.display=show?'inline-block':'none';if(r)r.style.display=show?'inline-block':'none'}
function clearHighlight(){document.querySelectorAll('.seat.mobileGroupSelected').forEach(x=>x.classList.remove('mobileGroupSelected','selected'))}
function clearSelection(){clearHighlight();selectedGroup=null;selectedSeat=null;if(window.YN?.S)window.YN.S.selectedGroup=null;setActionButtons(false)}
function selectGroup(g,seatEl){
 const rows=groupRows(g);if(!rows.length)return;
 clearHighlight();selectedGroup=String(g);selectedSeat=seatEl;window.YN.S.selectedGroup=selectedGroup;
 document.querySelectorAll('.seat[data-group]').forEach(x=>{if(String(x.dataset.group)===selectedGroup)x.classList.add('mobileGroupSelected','selected')});
 ensureButtons();const proposal=!!window.YN.S.editSession&&rows.some(x=>x.draft_origin==='proposal');
 $('touchBarText').textContent=`${rows[0].family_name} — ${rows.length} מקומות`;
 $('touchMoveGroup').textContent='העבר';$('touchReleaseGroup').textContent=proposal?'הסר הצעה':'שחרר';
 setActionButtons(true);$('touchBar').style.display='flex';
}
function moveSelected(){
 if(!selectedGroup||!selectedSeat)return;
 setActionButtons(false);passThroughOnce=true;selectedSeat.click();
}
async function releaseSelected(){
 if(busy||!selectedGroup||!window.YN)return;const g=selectedGroup,rows=groupRows(g);if(!rows.length)return clearSelection();
 const proposal=!!window.YN.S.editSession&&rows.some(x=>x.draft_origin==='proposal');
 if(!confirm(proposal?'להסיר את השיבוץ המוצע מהטיוטה?':'לשחרר את הקבוצה?'))return;
 busy=true;try{await window.YN.deleteGroup(g);clearSelection();await window.YN.load()}catch(e){alert('שחרור הקבוצה נכשל: '+(e?.message||e))}finally{busy=false}
}
function mount(){ensureButtons();if(!selectedGroup)setActionButtons(false)}
document.addEventListener('click',e=>{
 if(passThroughOnce){passThroughOnce=false;return}
 const seat=e.target.closest?.('.seat[data-group]');if(!seat||!window.YN)return;
 e.preventDefault();e.stopImmediatePropagation();selectGroup(seat.dataset.group,seat)
},true);
window.addEventListener('yn:seating-rendered',()=>{selectedGroup=null;selectedSeat=null;mount()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
