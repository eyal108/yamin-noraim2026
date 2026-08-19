(()=>{
if(!window.YN)return;
const {S,reqKey,rowOrder,createGroup,load,H,SEAT}=YN;
const YEAR={
'אביקסיס':[A(7,'right','right')],'בלונדר':[A(7,'right','left')],'גוטליב':[A(2,'right','right')],'הר-זהב':[A(2,'right','left')],
'וידס':[A(8,'right','left')],'חן':[A(4,'right','right')],'נוב':[A(4,'left','left')],'פורת':[A(4,'left','center')],
'פישמן - זכות':[A(5,'right','right')],'צדוק':[A(5,'right','left')],'קסדו':[A(3,'left','left')],'קסנר':[A(6,'center','right')],
'רוט':[A(8,'center','left')],'שריד':[A(2,'center','left')],'שטרק 1':[A(1,'left','center'),A(1,'center','center')],
'צחי':[A(8,'left','right'),A(8,'center','right')]
};
function A(row,zone,side){return{row,zone,side}}
const zoneBlock=(sec,z)=>sec==='men'?(z==='right'?0:z==='center'?1:2):(z==='right'?0:1);
function norm(s){return String(s||'').replace(/[־–—-]/g,' ').replace(/\d+/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
function noteRules(note,sec){const n=String(note||'');const r={row:null,strong:false,near:null};
 const womenOnly=/נשים[^\n]*שורה|שורה[^\n]*נשים/.test(n),menOnly=/גברים[^\n]*שורה|שורה[^\n]*גברים/.test(n);
 if((!womenOnly||sec==='women')&&(!menOnly||sec==='men')){if(/שורה\s*(ה)?ראשונה/.test(n))r.row=1;if(/שורה\s*(ה)?אחרונה/.test(n))r.row=8}
 if(/אותו\s*מקום|אותו\s*המקום|להישאר\s*במיקום|להשאר\s*במיקום|להישאר\s*באותו|להשאר\s*באותו/.test(n))r.strong=true;
 if(/ליד/.test(n)&&(!/יעל[^\n]*ליד/.test(n)||sec==='women')){const names=S.regs.map(x=>x.family_name);const nn=norm(n);r.near=names.find(x=>{const q=norm(x);return q.length>2&&nn.includes(q.replace(/\s+\S$/,''))})||null}
 return r}
function seatObj(id){return S.seats.find(s=>s.id===id)}
function segmentKey(s){return s.segment||`${s.section}:${s.row}:${s.block}`}
function allSegments(sec){const map=new Map();for(const s of S.seats.filter(x=>x.section===sec)){const k=segmentKey(s);if(!map.has(k))map.set(k,[]);map.get(k).push(s)}
 for(const a of map.values()){const ord=rowOrder(sec,a[0].row);a.sort((x,y)=>ord.findIndex(q=>q.id===x.id)-ord.findIndex(q=>q.id===y.id))}return[...map.values()]}
function windows(sec,n,occ){const out=[];for(const seg of allSegments(sec)){if(seg.length<n)continue;for(let i=0;i<=seg.length-n;i++){const list=seg.slice(i,i+n);if(list.every(s=>!occ.has(s.id)))out.push(list)}}return out}
function familySeats(name,sec,virtual){return[...S.assignments.filter(a=>a.family_name===name&&a.section===sec).map(a=>seatObj(a.seat_id)).filter(Boolean),...(virtual.get(sec+'|'+name)||[])]}
function candidateScore(list,task,virtual){const row=list[0].row,anchors=YEAR[task.family]||[],rules=task.rules;let score=0;
 if(row===0)score+=35;
 if(rules.row!=null)score+=Math.abs(row-rules.row)*1000;
 const existing=familySeats(task.family,task.sec,virtual);if(existing.length){const er=Math.round(existing.reduce((a,s)=>a+s.row,0)/existing.length);score+=Math.abs(row-er)*70;const eb=existing.find(s=>typeof s.block==='number')?.block;if(eb!=null&&list[0].block!==eb)score+=45}
 if(anchors.length){let best=1e9;for(const a of anchors){let q=Math.abs(row-a.row)*(rules.strong?90:45);const pb=zoneBlock(task.sec,a.zone),cb=typeof list[0].block==='number'?list[0].block:null;if(cb!=null)q+=Math.abs(cb-pb)*(rules.strong?65:32);if(cb===pb){const seg=S.seats.filter(s=>s.section===task.sec&&s.row===row&&s.block===cb).sort((x,y)=>x.order-y.order);if(seg.length>1){const avg=list.reduce((z,s)=>z+s.order,0)/list.length,pos=(avg-1)/(seg.length-1),want=a.side==='right'?0:a.side==='left'?1:.5;q+=Math.abs(pos-want)*18}}best=Math.min(best,q)}score+=best}
 else score+=row*1.5;
 if(rules.near){const near=familySeats(rules.near,task.sec,virtual);if(near.length){let d=99;for(const s of list)for(const t of near){const rr=Math.abs(s.row-t.row);let dd=rr*20;if(s.row===t.row){const ord=rowOrder(task.sec,s.row),i=ord.findIndex(x=>x.id===s.id),j=ord.findIndex(x=>x.id===t.id);if(i>=0&&j>=0)dd+=Math.abs(i-j)}d=Math.min(d,dd)}score+=d-35}}
 return score}
function bestWhole(task,occ,virtual){let best=null;for(const w of windows(task.sec,task.count,occ)){const sc=candidateScore(w,task,virtual);if(!best||sc<best.score)best={parts:[w],score:sc}}return best}
function bestSplit(task,occ,virtual){let best=null;for(let a=1;a<task.count;a++){const b=task.count-a;for(const w1 of windows(task.sec,a,occ)){const occ2=new Set(occ);w1.forEach(s=>occ2.add(s.id));for(const w2 of windows(task.sec,b,occ2)){const rowGap=Math.abs(w1[0].row-w2[0].row),sc=candidateScore(w1,task,virtual)+candidateScore(w2,task,virtual)+120+rowGap*55;if(!best||sc<best.score)best={parts:[w1,w2],score:sc,rowGap}}}}
 if(best&&best.rowGap<=1)return best;return best}
function bestFallback(task,occ,virtual){const parts=[];let left=task.count,guard=0;while(left>0&&guard++<10){let found=null;for(let n=left;n>=1&&!found;n--){for(const w of windows(task.sec,n,occ)){const sc=candidateScore(w,task,virtual)+(task.count-n)*160;if(!found||sc<found.score)found={w,score:sc}}}if(!found)break;parts.push(found.w);found.w.forEach(s=>occ.add(s.id));left-=found.w.length}return left?null:{parts,score:9999}}
function tasks(){const out=[];for(const r of S.regs){for(const sec of ['men','women']){const need=Number(r[reqKey(sec)])||0,got=S.assignments.filter(a=>a.family_name===r.family_name&&a.section===sec).length,rem=Math.max(0,need-got);if(rem)out.push({family:r.family_name,sec,count:rem,notes:r.notes||'',rules:noteRules(r.notes,sec),known:!!YEAR[r.family_name]})}}
 out.sort((a,b)=>(!!a.rules.near-!!b.rules.near)||(!!b.rules.row-!!a.rules.row)||(!!b.rules.strong-!!a.rules.strong)||(b.known-a.known)||(b.count-a.count));return out}
async function runAuto(){const ts=tasks();if(!ts.length)return alert('אין כרגע מקומות חסרים לשיבוץ.');const occ=new Set(S.assignments.map(a=>a.seat_id)),virtual=new Map(),plan=[];let unplaced=[];
 for(const t of ts){let pick=bestWhole(t,occ,virtual);if(!pick)pick=bestSplit(t,occ,virtual);if(!pick)pick=bestFallback(t,occ,virtual);if(!pick){unplaced.push(`${t.family} (${t.sec==='men'?'גברים':'נשים'}: ${t.count})`);continue}for(const p of pick.parts){p.forEach(s=>occ.add(s.id));const k=t.sec+'|'+t.family;if(!virtual.has(k))virtual.set(k,[]);virtual.get(k).push(...p);plan.push({task:t,seats:p})}}
 const places=plan.reduce((a,p)=>a+p.seats.length,0);if(!places)return alert('לא נמצאו מקומות פנויים מתאימים.');let msg=`השיבוץ האוטומטי ישבץ ${places} מקומות ל־${new Set(plan.map(p=>p.task.family+'|'+p.task.sec)).size} קבוצות.\n\nשיבוצים קיימים לא יוזזו.`;if(unplaced.length)msg+=`\n\nלא נמצא מקום ל: ${unplaced.join(', ')}`;if(!confirm(msg+'\n\nלהמשיך?'))return;
 const btn=document.getElementById('autoSeatBtn');if(btn){btn.disabled=true;btn.textContent='משבץ...'}try{for(const p of plan)await createGroup(p.task.family,p.task.sec,p.seats,'auto:'+Date.now()+':'+Math.random().toString(36).slice(2));await load();alert(`השיבוץ האוטומטי הושלם: ${places} מקומות שובצו.`+(unplaced.length?'\nנותרו ללא מקום: '+unplaced.join(', '):''))}catch(e){alert('השיבוץ האוטומטי נעצר: '+e.message);await load()}finally{if(btn){btn.disabled=false;btn.textContent='שיבוץ אוטומטי'}}}
async function clearAuto(){const groups=[...new Set(S.assignments.map(a=>a.seat_group).filter(g=>String(g||'').startsWith('auto:')))];if(!groups.length)return alert('אין שיבוץ אוטומטי למחיקה בתצורה הזו.');if(!confirm(`למחוק ${groups.length} קבוצות שנוצרו אוטומטית?\nהשיבוצים הידניים יישארו.`))return;for(const g of groups){const r=await fetch(SEAT+'?seat_group=eq.'+encodeURIComponent(g),{method:'DELETE',headers:H});if(!r.ok)return alert('שגיאה במחיקת שיבוץ אוטומטי')}await load()}
function addUi(){if(document.getElementById('autoSeatBtn'))return;const top=document.querySelector('.top');if(!top)return;const b=document.createElement('button');b.id='autoSeatBtn';b.className='btn autoBtn';b.type='button';b.textContent='שיבוץ אוטומטי';b.onclick=runAuto;const c=document.createElement('button');c.id='clearAutoBtn';c.className='btn';c.type='button';c.textContent='נקה אוטומטי';c.onclick=clearAuto;top.insertBefore(c,document.getElementById('clear'));top.insertBefore(b,c);const st=document.createElement('style');st.textContent='.autoBtn{background:#486b54!important;color:#fff!important}.touchMode .autoBtn{min-height:44px;font-size:15px}';document.head.appendChild(st)}
addUi();new MutationObserver(addUi).observe(document.body,{childList:true,subtree:true});
})();