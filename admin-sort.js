(()=>{
const table=document.querySelector('.tablewrap table'),body=document.getElementById('rowsEl');if(!table||!body)return;
const headers=[...table.querySelectorAll('thead th')];
const sortable=[0,1,2,3,4];
let active=-1,dir=1,observer;
const style=document.createElement('style');style.textContent=`
th.sortable{cursor:pointer;user-select:none;white-space:nowrap}
th.sortable:hover{background:#edf2ee}
.sortMark{display:inline-block;min-width:16px;margin-inline-start:5px;color:#5e6d63;font-size:11px}
`;document.head.appendChild(style);
function parseDisplayedDate(text){
 const s=String(text||'').trim();if(!s)return 0;
 const m=s.match(/(\d{1,2})[.\/]\s*(\d{1,2})[.\/]\s*(\d{4}).*?(\d{1,2}):(\d{2})(?::(\d{2}))?/);
 if(m){const [,d,mo,y,h,mi,se='0']=m;return new Date(Number(y),Number(mo)-1,Number(d),Number(h),Number(mi),Number(se)).getTime()}
 const p=Date.parse(s);return Number.isFinite(p)?p:0;
}
function value(tr,col){
 const td=tr.children[col];if(!td)return'';
 if(col===0)return td.querySelector('input')?.value.trim()||'';
 if(col===1||col===2)return Number(td.querySelector('input')?.value||0);
 if(col===3)return td.querySelector('textarea')?.value.trim()||'';
 if(col===4){const raw=td.dataset.sortDate||td.dataset.updatedAt||'';if(raw){const n=Number(raw);if(Number.isFinite(n)&&n>0)return n;const p=Date.parse(raw);if(Number.isFinite(p))return p}return parseDisplayedDate(td.textContent)}
 return td.textContent.trim();
}
function compare(a,b){const x=value(a,active),y=value(b,active);if(typeof x==='number'&&typeof y==='number')return(x-y)*dir;return String(x).localeCompare(String(y),'he',{sensitivity:'base',numeric:true})*dir}
function updateMarks(){headers.forEach((h,i)=>{const mark=h.querySelector('.sortMark');if(mark)mark.textContent=i===active?(dir===1?'▲':'▼'):'';if(sortable.includes(i))h.setAttribute('aria-sort',i===active?(dir===1?'ascending':'descending'):'none')})}
function observe(){observer?.disconnect();observer=new MutationObserver(()=>{if(active>=0)requestAnimationFrame(sortRows)});observer.observe(body,{childList:true})}
function sortRows(){if(active<0)return;observer?.disconnect();const rows=[...body.querySelectorAll('tr')].sort(compare);const frag=document.createDocumentFragment();rows.forEach(r=>frag.appendChild(r));body.appendChild(frag);updateMarks();observe()}
sortable.forEach(i=>{const h=headers[i];if(!h)return;h.classList.add('sortable');h.tabIndex=0;h.insertAdjacentHTML('beforeend',' <span class="sortMark" aria-hidden="true"></span>');const go=()=>{if(active===i)dir*=-1;else{active=i;dir=i===4?-1:1}sortRows()};h.addEventListener('click',go);h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})});
observe();
})();
