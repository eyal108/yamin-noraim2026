(()=>{
const table=document.querySelector('.tablewrap table'),body=document.getElementById('rowsEl');if(!table||!body)return;
const headers=[...table.querySelectorAll('thead th')];
const sortable=[0,1,2,3,4,5,6];
let active=-1,dir=1,observer;
const style=document.createElement('style');style.textContent=`
th.sortable{cursor:pointer;user-select:none;white-space:nowrap}
th.sortable:hover{background:#edf2ee}
.sortMark{display:inline-block;min-width:16px;margin-right:4px;color:#5e6d63;font-size:11px}
`;document.head.appendChild(style);
function value(tr,col){
  const td=tr.children[col];if(!td)return'';
  if(col>=1&&col<=4)return Number(td.querySelector('input')?.value||0);
  if(col===0)return td.querySelector('input')?.value.trim()||'';
  if(col===5)return td.querySelector('textarea')?.value.trim()||'';
  if(col===6){const t=Date.parse(td.textContent.trim());return Number.isFinite(t)?t:0}
  return td.textContent.trim();
}
function compare(a,b){const x=value(a,active),y=value(b,active);if(typeof x==='number'&&typeof y==='number')return(x-y)*dir;return String(x).localeCompare(String(y),'he',{sensitivity:'base',numeric:true})*dir}
function updateMarks(){headers.forEach((h,i)=>{const mark=h.querySelector('.sortMark');if(mark)mark.textContent=i===active?(dir===1?'▲':'▼'):'';h.setAttribute('aria-sort',i===active?(dir===1?'ascending':'descending'):'none')})}
function observe(){observer?.disconnect();observer=new MutationObserver(()=>{if(active>=0)requestAnimationFrame(sortRows)});observer.observe(body,{childList:true})}
function sortRows(){if(active<0)return;observer?.disconnect();const rows=[...body.querySelectorAll('tr')].sort(compare);const frag=document.createDocumentFragment();rows.forEach(r=>frag.appendChild(r));body.appendChild(frag);updateMarks();observe()}
sortable.forEach(i=>{const h=headers[i];if(!h)return;h.classList.add('sortable');h.tabIndex=0;h.insertAdjacentHTML('beforeend',' <span class="sortMark"></span>');const go=()=>{if(active===i)dir*=-1;else{active=i;dir=1}sortRows()};h.addEventListener('click',go);h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})});
observe();
})();
