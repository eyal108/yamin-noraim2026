(()=>{
const {SITE,makeClient,isAdmin,esc}=YNGeneric,{normalizeDefinition,toGridDefinition,seatIds}=YNLayout,db=makeClient(),$=id=>document.getElementById(id);
let session=null,layouts=[],layoutId=null,definition=null,dirty=false,activeTool='seat',painting=false,lastPaintKey='';
const toolLabels={seat:'מושב',aisle:'מעבר',stage:'במה',spacer:'רווח'};
function status(t){$('status').textContent=t||''}
function current(){return layouts.find(x=>x.id===layoutId)||null}
function makeGrid(rows=8,cols=12){return{rows,cols,cells:Array.from({length:rows},()=>Array.from({length:cols},()=>({type:'seat'})))}}
function blankDefinition(){return normalizeDefinition({version:2,front:{left:'חזית / ספרים',center:'ארון קודש',right:'כניסה'},sections:{women:{title:'נשים',grid:makeGrid()},men:{title:'גברים',grid:makeGrid()}}})}
function compactDefinition(){
 const d=normalizeDefinition(definition),out={version:2,front:d.front||{},sections:{}};
 if(d.legacy_no)out.legacy_no=d.legacy_no;
 for(const sec of ['women','men'])out.sections[sec]={title:d.sections[sec].title,grid:d.sections[sec].grid};
 return out;
}
function clearSeatIds(d){for(const sec of ['women','men'])for(const row of d.sections[sec].grid.cells)for(const c of row){delete c.seat_id;delete c.seat_id_backup}delete d.legacy_no;return d}
async function gate(){const r=await db.auth.getSession();session=r.data.session;if(!session?.user||!(await isAdmin(db,session))){$('loginGate').innerHTML='יש להתחבר כמנהל כדי לערוך תצורות. <button id="loginBtn" class="btn primary">התחבר עם Google</button>';$('loginBtn').onclick=()=>db.auth.signInWithOAuth({provider:'google',options:{redirectTo:SITE+'layouts.html'}});return false}$('loginGate').classList.add('hidden');$('app').classList.remove('hidden');return true}
async function loadLayouts(prefer=null){const {data,error}=await db.from('yamim_noraim_layouts').select('id,code,title,definition,sort_order,is_active,updated_at').order('sort_order').order('created_at');if(error)throw error;layouts=data||[];layoutId=prefer||layoutId||localStorage.getItem('yn:layout')||layouts[0]?.id||null;if(!layouts.some(x=>x.id===layoutId))layoutId=layouts[0]?.id||null;renderSelect();loadCurrent()}
function renderSelect(){const sel=$('layoutSelect');sel.innerHTML=layouts.map(l=>`<option value="${l.id}">${esc(l.title)}${l.is_active?'':' — בארכיון'}</option>`).join('');if(layoutId)sel.value=layoutId}
function loadCurrent(){const l=current();if(!l){definition=blankDefinition();$('layoutTitle').value='';renderAll();return}definition=toGridDefinition(l);$('layoutTitle').value=l.title;$('toggleActiveBtn').textContent=l.is_active?'העבר לארכיון':'החזר לפעילות';dirty=false;renderAll();if(Number(l.definition?.version||1)<2)status('התצורה הוותיקה הומרה לגריד לצורך עריכה. השיבוצים הקיימים יישמרו בעת השמירה.');else status('')}
function grid(sec){return definition.sections[sec].grid}
function setTool(t){if(!toolLabels[t])return;activeTool=t;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('toolState').textContent=`כלי פעיל: ${toolLabels[t]}`}
function cellSymbol(type){return type==='seat'?'●':type==='aisle'?'↕':type==='stage'?'במה':'×'}
function renderSection(sec){
 const g=grid(sec),host=$(sec+'Grid');$(sec+'Rows').value=g.rows;$(sec+'Cols').value=g.cols;
 const cols=Array.from({length:g.cols},(_,i)=>`<span class="colLabel">${i+1}</span>`).join('');
 const rows=g.cells.map((row,r)=>`<div class="gridLine"><span class="rowLabel">${r+1}</span>${row.map((c,i)=>`<button type="button" class="gridCell ${c.type}" data-sec="${sec}" data-r="${r}" data-c="${i}" title="שורה ${r+1}, עמודה ${i+1}: ${toolLabels[c.type]||c.type}">${cellSymbol(c.type)}</button>`).join('')}</div>`).join('');
 host.innerHTML=`<div class="gridHeader"><span></span>${cols}</div>${rows}`;
}
function renderAll(){renderSection('women');renderSection('men');setTool(activeTool)}
function mark(){dirty=true}
function paintCell(el){
 const sec=el.dataset.sec,r=+el.dataset.r,c=+el.dataset.c,key=`${sec}:${r}:${c}:${activeTool}`;if(lastPaintKey===key)return;lastPaintKey=key;
 const old=grid(sec).cells[r][c]||{type:'seat'};if(old.type===activeTool)return;
 let next=activeTool==='seat'?{type:'seat'}:{type:activeTool};
 const backup=old.type==='seat'?(old.seat_id||old.seat_id_backup):old.seat_id_backup;
 if(activeTool==='seat'&&backup)next.seat_id=backup;
 if(activeTool!=='seat'&&backup)next.seat_id_backup=backup;
 if(activeTool==='stage')next.label='במה';
 grid(sec).cells[r][c]=next;mark();
 el.className=`gridCell ${activeTool}`;el.textContent=cellSymbol(activeTool);el.title=`שורה ${r+1}, עמודה ${c+1}: ${toolLabels[activeTool]}`;
}
function resizeSection(sec){
 const g=grid(sec),rows=Math.max(1,Math.min(60,Math.round(Number($(sec+'Rows').value)||g.rows||1))),cols=Math.max(1,Math.min(60,Math.round(Number($(sec+'Cols').value)||g.cols||1)));
 if(rows===g.rows&&cols===g.cols)return;
 if((rows<g.rows||cols<g.cols)&&!confirm('הקטנת הגריד עשויה להסיר תאים מהקצה. אם מושבים שהוסרו משובצים, השמירה תיחסם. להמשיך?')){$(sec+'Rows').value=g.rows;$(sec+'Cols').value=g.cols;return}
 const cells=[];for(let r=0;r<rows;r++){const line=[];for(let c=0;c<cols;c++)line.push(g.cells?.[r]?.[c]?{...g.cells[r][c]}:{type:'seat'});cells.push(line)}
 definition.sections[sec].grid={rows,cols,cells};mark();renderSection(sec);
}
function bindPainter(){
 document.addEventListener('pointerdown',e=>{const cell=e.target.closest?.('.gridCell');if(!cell)return;painting=true;lastPaintKey='';e.preventDefault();paintCell(cell)});
 document.addEventListener('pointerover',e=>{if(!painting)return;const cell=e.target.closest?.('.gridCell');if(cell)paintCell(cell)});
 document.addEventListener('pointermove',e=>{if(!painting)return;const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.gridCell');if(cell)paintCell(cell)},{passive:false});
 window.addEventListener('pointerup',()=>{painting=false;lastPaintKey=''});window.addEventListener('pointercancel',()=>{painting=false;lastPaintKey=''})
}
async function save(){
 const l=current();if(!l)return;definition=normalizeDefinition(definition);const title=$('layoutTitle').value.trim();if(!title)return alert('יש להזין שם לתצורה.');
 for(const sec of ['women','men']){const g=grid(sec);if(!g.rows||!g.cols)return alert('יש להגדיר לפחות שורה ועמודה אחת לכל צד.');if(!g.cells.some(row=>row.some(c=>c.type==='seat')))return alert(`בצד ${sec==='men'?'גברים':'נשים'} אין אף מושב.`)}
 const stored=compactDefinition(),{data:assigned,error:aerr}=await db.from('yamim_noraim_seating_v2').select('seat_id').eq('layout_id',l.id);if(aerr)return alert(aerr.message);
 if(assigned?.length){const ids=seatIds({code:l.code,definition:stored}),missing=assigned.filter(a=>!ids.has(a.seat_id));if(missing.length)return alert(`לא ניתן לשמור: ${missing.length} מושבים שכבר שובצו אינם קיימים עוד בגריד. החזר אותם ל"מושב" או שחרר אותם קודם בסידור ההושבה.`)}
 const {error}=await db.from('yamim_noraim_layouts').update({title,definition:stored,updated_at:new Date().toISOString()}).eq('id',l.id);if(error)return alert('שגיאה בשמירה: '+error.message);status('התצורה נשמרה.');dirty=false;await loadLayouts(l.id)
}
async function createNew(duplicate=false){
 const base=duplicate&&current()?clearSeatIds(toGridDefinition(current())):blankDefinition(),title=prompt(duplicate?'שם לתצורה המשוכפלת:':'שם התצורה החדשה:',duplicate?(current().title+' - עותק'):'תצורה חדשה');if(!title?.trim())return;
 const code='layout-'+Date.now().toString(36),max=layouts.reduce((m,x)=>Math.max(m,Number(x.sort_order)||0),0)+10,d=normalizeDefinition(base),stored={version:2,front:d.front||{},sections:{}};for(const sec of ['women','men'])stored.sections[sec]={title:d.sections[sec].title,grid:d.sections[sec].grid};
 const {data,error}=await db.from('yamim_noraim_layouts').insert({code,title:title.trim(),definition:stored,sort_order:max,is_active:true}).select('id').single();if(error)return alert(error.message);await loadLayouts(data.id)
}
async function toggleActive(){const l=current();if(!l)return;const {error}=await db.from('yamim_noraim_layouts').update({is_active:!l.is_active,updated_at:new Date().toISOString()}).eq('id',l.id);if(error)return alert(error.message);await loadLayouts(l.id)}
$('layoutSelect').onchange=e=>{if(dirty&&!confirm('יש שינויים שלא נשמרו. לעבור לתצורה אחרת?')){e.target.value=layoutId;return}layoutId=e.target.value;localStorage.setItem('yn:layout',layoutId);loadCurrent()};
$('layoutTitle').oninput=()=>dirty=true;document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
for(const sec of ['women','men']){$(sec+'Resize').onclick=()=>resizeSection(sec);[$(sec+'Rows'),$(sec+'Cols')].forEach(x=>x.addEventListener('keydown',e=>{if(e.key==='Enter')resizeSection(sec)}))}
$('saveBtn').onclick=save;$('newBtn').onclick=()=>createNew(false);$('duplicateBtn').onclick=()=>createNew(true);$('toggleActiveBtn').onclick=toggleActive;
window.addEventListener('beforeunload',e=>{if(!dirty)return;e.preventDefault();e.returnValue=''});bindPainter();
(async()=>{if(await gate())try{await loadLayouts()}catch(e){status('שגיאה: '+e.message)}})();
})();
