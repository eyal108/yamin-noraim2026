(()=>{
function enhance(){
  const d=document.getElementById('aiPreviewDialog');
  if(!d||d.dataset.enhanced)return;
  d.dataset.enhanced='1';
  const summary=document.querySelector('.summary');
  if(summary&&d.parentNode!==summary.parentNode)summary.after(d);
  const head=d.querySelector('.aiPreviewHead');
  const body=d.querySelector('.aiPreviewSummary');
  if(head&&body){
    const hint=head.querySelector('.aiPreviewHint');
    if(hint)hint.textContent='ה-AI בחר כיסאות מדויקים; הסיכום מציג שורות בלבד. הכיסאות המוצעים מסומנים בסגול בתרשים.';
    body.hidden=true;
    const toggle=document.createElement('button');
    toggle.type='button';toggle.className='btn aiPreviewToggle';toggle.textContent='הצג פירוט';
    toggle.onclick=()=>{body.hidden=!body.hidden;toggle.textContent=body.hidden?'הצג פירוט':'הסתר פירוט'};
    head.appendChild(toggle);
  }
}
const style=document.createElement('style');
style.textContent=`
#aiPreviewDialog.aiPreviewDialog{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:none!important;max-height:none!important;margin:10px 0 12px!important;padding:10px 12px!important;box-sizing:border-box!important;box-shadow:none!important;border:1px solid #c9bdea!important;border-radius:10px!important;background:#faf8ff!important;z-index:auto!important}
#aiPreviewDialog .aiPreviewHead{display:flex!important;align-items:center!important;gap:10px!important;flex-wrap:wrap!important;margin:0!important}
#aiPreviewDialog .aiPreviewHint{font-size:12px!important;color:#655a76!important;flex:1 1 340px!important}
#aiPreviewDialog .aiPreviewToggle{margin-inline-start:auto!important}
#aiPreviewDialog .aiPreviewSummary{max-height:180px!important;margin-top:8px!important;padding-top:8px!important;border-top:1px solid #e3dcf6!important;overflow:auto!important}
#aiPreviewDialog .aiPreviewActions{display:flex!important;gap:8px!important;align-items:center!important;margin-top:8px!important}
#aiPreviewDialog .aiSaveBtn{background:#5b4b86!important;color:#fff!important}
@media(max-width:700px){#aiPreviewDialog.aiPreviewDialog{padding:9px!important}#aiPreviewDialog .aiPreviewHead{align-items:flex-start!important}#aiPreviewDialog .aiPreviewActions{position:static!important}}
`;
document.head.appendChild(style);
new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
enhance();
})();