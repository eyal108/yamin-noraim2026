(()=>{
if(!window.YN||!window.YNGeneric)return;
const {S}=YN,$=id=>document.getElementById(id);
let busy=false,activeOutputUrl=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mobileLike=()=>((typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches)||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''));
function safeName(s){return String(s||'תרשים').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,100)||'תרשים'}
function currentList(){return S.lists?.find(x=>x.id===S.listId)||null}
function currentLayout(){return S.layouts?.find(x=>x.id===S.layoutId)||null}
function synagogueName(){return YNGeneric.getAccess?.()?.current?.name||'בית הכנסת'}
function fileBase(){return safeName(`תרשים-שיבוץ-${synagogueName()}-${currentList()?.title||''}`)}
function mount(){
 if(document.getElementById('seatingExportBar'))return;
 const summary=document.querySelector('.summary');if(!summary)return;
 const bar=document.createElement('div');bar.id='seatingExportBar';bar.className='seatingExportBar';
 const mobile=mobileLike();
 bar.innerHTML=`<span class="exportLabel">תרשים נקי להדפסה</span><button id="exportPngBtn" class="btn">${mobile?'צור / שתף PNG':'הורד PNG'}</button><button id="exportPdfBtn" class="btn primary">${mobile?'צור / שתף PDF':'הורד PDF להדפסה'}</button>`;
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
 const width=Math.max(1,Math.ceil(sheet.scrollWidth)),height=Math.max(1,Math.ceil(sheet.scrollHeight)),pixels=width*height,mobile=mobileLike();
 const wanted=mobile?1.15:(pixels>3_500_000?1.6:2.2),pixelBudget=mobile?4_000_000:12_000_000,maxDimension=mobile?8192:16000;
 const byPixels=Math.sqrt(pixelBudget/pixels),byDimension=Math.min(maxDimension/width,maxDimension/height),scale=Math.max(.5,Math.min(wanted,byPixels,byDimension));
 return await html2canvas(sheet,{backgroundColor:'#ffffff',scale,useCORS:true,logging:false,width,height,windowWidth:Math.max(width+80,document.documentElement.clientWidth),windowHeight:Math.max(height+80,document.documentElement.clientHeight),scrollX:0,scrollY:0,imageTimeout:8000})
}
function canvasBlob(canvas,type='image/png',quality){return new Promise((resolve,reject)=>{try{canvas.toBlob(b=>b?resolve(b):reject(Error('לא ניתן היה ליצור את קובץ התמונה.')),type,quality)}catch(e){reject(e)}})}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function pdfBlob(canvas){
 const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)throw Error('רכיב יצירת ה-PDF לא נטען. רענן את העמוד ונסה שוב.');
 const large=canvas.width>3000||canvas.height>2100,format=large?'a3':'a4',orientation=canvas.width>=canvas.height?'landscape':'portrait',pdf=new JsPDF({orientation,unit:'mm',format,compress:true});
 const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight(),margin=8,maxW=pw-margin*2,maxH=ph-margin*2,ratio=Math.min(maxW/canvas.width,maxH/canvas.height),w=canvas.width*ratio,h=canvas.height*ratio,x=(pw-w)/2,y=(ph-h)/2;
 const jpeg=canvas.toDataURL('image/jpeg',mobileLike()?0.88:0.94);pdf.addImage(jpeg,'JPEG',x,y,w,h,undefined,'FAST');return pdf.output('blob')
}
function closeOutput(){const box=$('exportResultOverlay');box?.remove();if(activeOutputUrl){URL.revokeObjectURL(activeOutputUrl);activeOutputUrl=null}}
function shareSupported(blob,name,type){try{if(!navigator.share||typeof File==='undefined')return false;const f=new File([blob],name,{type});return !navigator.canShare||navigator.canShare({files:[f]})}catch{return false}}
function showMobileResult(blob,name,type,kind){
 closeOutput();activeOutputUrl=URL.createObjectURL(blob);const canShare=shareSupported(blob,name,type),box=document.createElement('div');box.id='exportResultOverlay';box.className='exportResultOverlay';
 box.innerHTML=`<div class="exportResultCard" role="dialog" aria-modal="true"><div class="exportResultHead"><div><b>${kind==='pdf'?'ה-PDF מוכן':'התמונה מוכנה'}</b><small>${YNGeneric.esc(name)}</small></div><button type="button" class="exportCloseBtn" aria-label="סגור">×</button></div>${kind==='png'?`<img class="exportResultPreview" src="${activeOutputUrl}" alt="תצוגה מקדימה של תרשים ההושבה">`:'<div class="exportPdfReady">PDF מוכן לשמירה, שיתוף או פתיחה</div>'}<div class="exportResultActions">${canShare?'<button type="button" class="btn primary" data-share>שתף / שמור</button>':''}<button type="button" class="btn" data-open>פתח</button><button type="button" class="btn" data-download>הורד</button></div><div class="exportMobileHelp">בטלפון מומלץ להשתמש ב„שתף / שמור”. אם האפשרות אינה זמינה, לחץ „פתח” ואז שמור דרך תפריט הדפדפן.</div></div>`;
 document.body.appendChild(box);box.querySelector('.exportCloseBtn').onclick=closeOutput;box.addEventListener('click',e=>{if(e.target===box)closeOutput()});
 const share=box.querySelector('[data-share]');if(share)share.onclick=async()=>{try{const file=new File([blob],name,{type});await navigator.share({files:[file],title:name})}catch(e){if(e?.name!=='AbortError')alert('השיתוף לא הצליח. נסה „פתח” או „הורד”.')}};
 box.querySelector('[data-open]').onclick=()=>{const w=window.open(activeOutputUrl,'_blank','noopener');if(!w)location.href=activeOutputUrl};
 box.querySelector('[data-download]').onclick=()=>downloadBlob(blob,name)
}
function setBusy(on,label=''){busy=on;const bar=$('seatingExportBar');bar?.classList.toggle('exportBusy',on);for(const id of ['exportPngBtn','exportPdfBtn']){const b=$(id);if(b)b.disabled=on}if(on&&bar){const l=bar.querySelector('.exportLabel');if(l){l.dataset.old=l.textContent;l.textContent=label||'מכין תרשים...'}}else if(bar){const l=bar.querySelector('.exportLabel');if(l&&l.dataset.old){l.textContent=l.dataset.old;delete l.dataset.old}}}
async function runExport(kind){
 if(busy)return;if(YN.isDraft?.())return alert('יש טיוטת שיבוץ פתוחה. שמור אותה או חזור למצב הקודם לפני יצירת תרשים להדפסה.');
 if(!S.layoutId||!S.listId)return alert('יש לבחור רשימת בקשות ותצורה.');
 setBusy(true,kind==='pdf'?'מכין PDF...':'מכין תמונה...');let sheet=null;
 try{
  await prepareVisuals();sheet=makeSheet();await new Promise(r=>requestAnimationFrame(r));const canvas=await canvasForSheet(sheet),name=fileBase()+(kind==='pdf'?'.pdf':'.png');
  let blob,type;if(kind==='pdf'){blob=pdfBlob(canvas);type='application/pdf'}else{blob=await canvasBlob(canvas,'image/png');type='image/png'}
  if(mobileLike())showMobileResult(blob,name,type,kind);else downloadBlob(blob,name)
 }catch(e){alert('יצירת התרשים נכשלה: '+(e?.message||e))}finally{sheet?.remove();setBusy(false)}
}
mount();window.addEventListener('yn:seating-rendered',mount);
})();
