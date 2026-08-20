(()=>{
function cleanId(s,fallback){const x=String(s||'').trim().replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');return x||fallback}
const TYPES=new Set(['seat','aisle','stage','spacer']);
const POSITIONS=new Set(['left','center','right','front','rear']);
function clone(v){return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}
function normalizeGridCell(c){
 const x=c&&typeof c==='object'?{...c}:{type:'seat'};let t=String(x.type||'seat').toLowerCase();if(t==='seats')t='seat';if(!TYPES.has(t))t='seat';x.type=t;
 if(t==='stage')x.label=String(x.label||'במה');else delete x.label;
 if(t!=='seat'&&x.seat_id){x.seat_id_backup=x.seat_id;delete x.seat_id}
 return x;
}
function normalizeGrid(g){g=g&&typeof g==='object'?g:{};g.rows=Math.max(0,Math.min(100,Math.round(Number(g.rows)||0)));g.cols=Math.max(0,Math.min(100,Math.round(Number(g.cols)||0)));const cells=[];for(let r=0;r<g.rows;r++){const row=[];for(let c=0;c<g.cols;c++)row.push(normalizeGridCell(g.cells?.[r]?.[c]));cells.push(row)}g.cells=cells;return g}
function gridRowsToCells(grid,areaId='area'){
 const out=[];for(let r=0;r<grid.rows;r++){const src=grid.cells[r]||[],cells=[];let c=0;while(c<grid.cols){const first=normalizeGridCell(src[c]),type=first.type,start=c,run=[];while(c<grid.cols&&normalizeGridCell(src[c]).type===type){run.push(normalizeGridCell(src[c]));c++}const id=`${cleanId(areaId,'area')}-r${r+1}-${type}-${start+1}`;if(type==='seat')cells.push({id,type:'seats',count:run.length,seat_ids:run.map(x=>x.seat_id||null),grid_start:start+1});else cells.push({id,type,width:run.length,label:type==='stage'?'במה':undefined,grid_start:start+1})}out.push({id:`${cleanId(areaId,'area')}-r${r+1}`,label:String(r+1),grid_row:r+1,cells})}return out
}
function normalizeV3(d){
 d.version=3;d.front=d.front||{left:'',center:'',right:''};d.levels=Array.isArray(d.levels)?d.levels:[];
 d.levels=d.levels.map((level,li)=>{const l={...level};l.id=cleanId(l.id,`level-${li+1}`);l.name=String(l.name||`מפלס ${li+1}`);l.areas=Array.isArray(l.areas)?l.areas:[];l.areas=l.areas.map((area,ai)=>{const a={...area};a.id=cleanId(a.id,`${l.id}-area-${ai+1}`);a.name=String(a.name||(a.section==='women'?'עזרת נשים':'גברים'));a.section=a.section==='women'?'women':'men';a.position=POSITIONS.has(a.position)?a.position:(a.section==='women'?'left':'center');a.grid=normalizeGrid(a.grid);a.rows=gridRowsToCells(a.grid,a.id);return a});return l});
 return d;
}
function normalizeV2(d){
 d.version=2;d.front=d.front||{left:'',center:'',right:''};d.sections=d.sections||{};for(const sec of ['women','men']){const s=d.sections[sec]||(d.sections[sec]={});s.title=s.title||(sec==='men'?'גברים':'נשים');s.grid=normalizeGrid(s.grid);s.rows=gridRowsToCells(s.grid,sec)}return d
}
function normalizeV1(d){
 d.version=1;d.front=d.front||{left:'',center:'',right:''};d.sections=d.sections||{};for(const sec of ['women','men']){const s=d.sections[sec]||(d.sections[sec]={title:sec==='men'?'גברים':'נשים',rows:[]});s.title=s.title||(sec==='men'?'גברים':'נשים');s.rows=Array.isArray(s.rows)?s.rows:[];s.rows.forEach((r,ri)=>{r.id=cleanId(r.id,'r'+(ri+1));r.label=String(r.label??(ri+1));r.cells=Array.isArray(r.cells)?r.cells:[];r.cells.forEach((c,ci)=>{c.id=cleanId(c.id,'c'+(ci+1));if(!['seats','aisle','stage','spacer'].includes(c.type))c.type='seats';if(c.type==='seats')c.count=Math.max(1,Math.min(100,Number(c.count)||1));else c.width=Math.max(.25,Math.min(100,Number(c.width)||1));if(c.type==='stage')c.label=String(c.label||'במה')})})}return d
}
function normalizeDefinition(raw){const d=raw&&typeof raw==='object'?clone(raw):{};if(Number(d.version)>=3||Array.isArray(d.levels))return normalizeV3(d);if(Number(d.version)>=2||d.sections?.men?.grid||d.sections?.women?.grid)return normalizeV2(d);return normalizeV1(d)}
function legacySeatId(layout,section,row,cell,index){const d=layout.definition||{};if(Array.isArray(cell.seat_ids)&&cell.seat_ids[index-1])return String(cell.seat_ids[index-1]);if(d.legacy_no){const code=section==='men'?'M':'W',key=String(cell.id||'').toUpperCase(),label=String(row.label);if(cell.legacy_single||/^X\d+$/.test(key))return `L${d.legacy_no}-${code}-${label}-${key}`;return `L${d.legacy_no}-${code}-${label}-${key}-${index}`}return `${cleanId(layout.code,'layout')}:${section}:${cleanId(row.id,'row')}:${cleanId(cell.id,'cell')}:${index}`}
function buildGridSeats(layout,area,level,out){const g=area.grid;for(let r=0;r<g.rows;r++){let block=-1,inRun=false,seatIndex=0,runStart=0;for(let c=0;c<g.cols;c++){const cell=normalizeGridCell(g.cells[r][c]);if(cell.type!=='seat'){inRun=false;seatIndex=0;continue}if(!inRun){block++;inRun=true;seatIndex=0;runStart=c}seatIndex++;const id=cell.seat_id||`${cleanId(layout.code,'layout')}:${cleanId(area.id,'area')}:r${r+1}:c${c+1}`;out.push({id,section:area.section,area_id:area.id,area_name:area.name,level_id:level.id,level_name:level.name,position:area.position,row:r+1,row_id:`${area.id}:r${r+1}`,row_label:String(r+1),cell_id:`${area.id}:r${r+1}:seat:${runStart+1}`,cell_index:c,block,seat_index:seatIndex,order:c,segment:`${area.id}:r${r+1}:seg${block}`,col:c+1,grid_cols:g.cols})}}}
function buildSeats(layout){
 const d=normalizeDefinition(layout.definition),out=[];
 if(d.version>=3){for(const level of d.levels)for(const area of level.areas)buildGridSeats(layout,area,level,out);return out}
 if(d.version>=2){const level={id:'main',name:'אולם ראשי'};for(const section of ['women','men'])buildGridSeats(layout,{id:section,name:d.sections[section].title,section,position:section==='women'?'left':'center',grid:d.sections[section].grid},level,out);return out}
 for(const section of ['women','men']){const rows=d.sections[section].rows;rows.forEach((row,rowIndex)=>{let segmentIndex=0,order=0,blockIndex=0,lastWasSeat=false;row.cells.forEach((cell,cellIndex)=>{if(cell.type!=='seats'){if(lastWasSeat)segmentIndex++;lastWasSeat=false;return}const currentBlock=blockIndex++;for(let i=1;i<=cell.count;i++)out.push({id:legacySeatId({...layout,definition:d},section,row,cell,i),section,area_id:section,area_name:d.sections[section].title,level_id:'main',level_name:'אולם ראשי',position:section==='women'?'left':'center',row:rowIndex+1,row_id:`${section}:${row.id}`,row_label:row.label,cell_id:`${section}:${cell.id}`,cell_index:cellIndex,block:currentBlock,seat_index:i,order:order++,segment:`${section}:${row.id}:seg${segmentIndex}`});lastWasSeat=true})})}return out
}
function v1ToGrid(layout,d,section){const rows=d.sections[section].rows||[],expanded=[],maxCols=Math.max(0,...rows.map(row=>row.cells.reduce((n,c)=>n+(c.type==='seats'?Math.round(Number(c.count)||1):Math.max(1,Math.round(Number(c.width)||1))),0)));rows.forEach(row=>{const line=[];for(const cell of row.cells){if(cell.type==='seats'){for(let i=1;i<=cell.count;i++)line.push({type:'seat',seat_id:legacySeatId({...layout,definition:d},section,row,cell,i)})}else{const n=Math.max(1,Math.round(Number(cell.width)||1));for(let i=0;i<n;i++)line.push({type:cell.type,label:cell.type==='stage'?String(cell.label||'במה'):undefined})}}while(line.length<maxCols)line.push({type:'spacer'});expanded.push(line)});return normalizeGrid({rows:expanded.length,cols:maxCols,cells:expanded})}
function toAreaDefinition(layout){
 const d=normalizeDefinition(layout?.definition||layout||{});if(d.version>=3)return normalizeDefinition(d);const out={version:3,front:clone(d.front||{}),levels:[{id:'main',name:'אולם ראשי',areas:[]}]};if(d.legacy_no)out.legacy_no=d.legacy_no;for(const section of ['women','men']){const grid=d.version>=2?clone(d.sections[section].grid):v1ToGrid(layout,d,section);out.levels[0].areas.push({id:section==='women'?'women-main':'men-main',name:d.sections[section].title||(section==='women'?'עזרת נשים':'גברים'),section,position:section==='women'?'left':'center',grid})}return normalizeDefinition(out)
}
function rowOrder(seats,section,rowRef,areaId=null){return seats.filter(s=>s.section===section&&(!areaId||s.area_id===areaId)&&(s.row_id===rowRef||s.row===rowRef||s.row_label===String(rowRef))).sort((a,b)=>a.order-b.order)}
function capacity(layout,section){return buildSeats(layout).filter(s=>s.section===section).length}
function seatIds(layout){return new Set(buildSeats(layout).map(s=>s.id))}
function allAreas(layout){const d=toAreaDefinition(layout);return d.levels.flatMap(l=>l.areas.map(a=>({...a,level_id:l.id,level_name:l.name})))}
window.YNLayout={normalizeDefinition,toAreaDefinition,buildSeats,rowOrder,capacity,seatIds,cleanId,allAreas};
})();