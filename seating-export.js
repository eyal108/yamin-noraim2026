(()=>{
if(!window.YN||!window.YNGeneric)return;
const {S}=YN,$=id=>document.getElementById(id);
let busy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function safeName(s){return String(s||'תרשים').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,100)||'תרשים'}
function currentList(){return S.lists?.find(x=>x.id===S.listId)||null}
function currentLayout(){return S.layouts?.find(x=>x.id===S.layoutId)||null}
function synagogueName(){return YNGeneric.getAccess?.()?.current?.name||'בית הכנסת'}
function fileBase(){return safeName(`תרשים-שיבוץ-${synagogueName()}-${currentList()?.title||''}`)}
function mount(){
 if(document.getElementById('seatingExportBar'))return;
 const summary=document.querySelector('.summary');if(!summary)return;
 const bar=document.createElement('div');bar.id='seatingExportBar';bar.className='seatingExportBar';
 bar.innerHTML='<span class="exportLabel">תרשים נקי להדפסה</span><button id="exportPngBtn" class="btn">הורד PNG</button><button id="exportPdfBtn" class="btn primary">הורד PDF להדפסה</button>';
 summary.before(bar);$('exportPngBtn').onclick=()=>runExport('png');$('exportPdfBtn').onclick=()=>runExport('pdf')
}
function cleanClone(root){
 root.querySelectorAll('.previewOverlay,.savedOverlay').forEach(x=>x.remove());
 root.querySelectorAll('.previewSeat,.savedSeat,.savedConflict,.selected,.touchSelected,.touchTargetHint').forEach(x=>x.classList.remove('previewSeat','savedSeat','savedConflict','selected','touchSelected','touchTargetHint'));
 root.querySelectorAll('[draggable]').forEach(x=>x.removeAttribute('draggable'));
 return root
}
async function prepareVisuals(){await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await sleep(80)}
function makeSheet(){
 const map=$('layoutMap'),front=document.querySelector('.hall>.front');if(!map)throw Error('תרשים האולם עדיין לא נטען.');
 const sheet=document.createElement('section');sheet.className='exportSheet';sheet.setAttribute('aria-hidden','true');
 const h=document.createElement('header');h.className='exportHeader';
 const list=currentList(),layout=currentLayout();h.innerHTML=`<h1>${YNGeneric.esc(synagogueName())}</h1><div class="exportSubtitle">${YNGeneric.esc(list?.title||'סידור מושבים')}</div><div class="exportLayoutName">${YNGeneric.esc(layout?.title||'')}</div>`;sheet.appendChild(h);
 if(front){const f=front.cloneNode(true);f.removeAttribute('id');sheet.appendChild(f)}
 const c=cleanClone(map.cloneNode(true));c.removeAttribute('id');sheet.appendChild(c);document.body.appendChild(sheet);return sheet
}
async function canvasForSheet(sheet){
 if(!window.html2canvas)throw Error('רכיב יצירת התמונה לא נטען. רענן את העמוד ונסה שוב.');
 if(document.fonts?.ready)await document.fonts.ready;
 const width=Math.ceil(sheet.scrollWidth),height=Math.ceil(sheet.scrollHeight),pixels=width*height;
 const scale=pixels>3_500_000?1.6:2.2;
 return await html2canvas(sheet,{backgroundColor:'#ffffff',scale,useCORS:true,logging:false,width,height,windowWidth:width+80,windowHeight:height+80,scrollX:0,scrollY:0})
}
function downloadUrl(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove()}
function downloadPng(canvas){downloadUrl(canvas.toDataURL('image/png'),fileBase()+'.png')}
function downloadPdf(canvas){
 const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)throw Error('רכיב יצירת ה-PDF לא נטען. רענן את העמוד ונסה שוב.');
 const large=canvas.width>3000||canvas.height>2100,format=large?'a3':'a4',orientation=canvas.width>=canvas.height?'landscape':'portrait',pdf=new JsPDF({orientation,unit:'mm',format,compress:true});
 const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight(),margin=8,maxW=pw-margin*2,maxH=ph-margin*2,ratio=Math.min(maxW/canvas.width,maxH/canvas.height),w=canvas.width*ratio,h=canvas.height*ratio,x=(pw-w)/2,y=(ph-h)/2;
 pdf.addImage(canvas.toDataURL('image/jpeg',0.96),'JPEG',x,y,w,h,undefined,'FAST');pdf.save(fileBase()+'.pdf')
}
function setBusy(on,label=''){busy=on;const bar=$('seatingExportBar');bar?.classList.toggle('exportBusy',on);for(const id of ['exportPngBtn','exportPdfBtn']){const b=$(id);if(b)b.disabled=on}if(on&&bar){const l=bar.querySelector('.exportLabel');if(l){l.dataset.old=l.textContent;l.textContent=label||'מכין תרשים...'}}else if(bar){const l=bar.querySelector('.exportLabel');if(l&&l.dataset.old){l.textContent=l.dataset.old;delete l.dataset.old}}}
async function runExport(kind){
 if(busy)return;if(YN.isDraft?.())return alert('יש טיוטת שיבוץ פתוחה. שמור אותה או חזור למצב הקודם לפני יצירת תרשים להדפסה.');
 if(!S.layoutId||!S.listId)return alert('יש לבחור רשימת בקשות ותצורה.');
 setBusy(true,kind==='pdf'?'מכין PDF...':'מכין תמונה...');let sheet=null;
 try{await prepareVisuals();sheet=makeSheet();await new Promise(r=>requestAnimationFrame(r));const canvas=await canvasForSheet(sheet);if(kind==='pdf')downloadPdf(canvas);else downloadPng(canvas)}catch(e){alert('יצירת התרשים נכשלה: '+(e?.message||e))}finally{sheet?.remove();setBusy(false)}
}
mount();window.addEventListener('yn:seating-rendered',mount);
})();
