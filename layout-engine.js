(()=>{
function cleanId(s,fallback){const x=String(s||'').trim().replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');return x||fallback}
const TYPES=new Set(['seat','aisle','stage','spacer']);
function clone(v){return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}
function normalizeGridCell(c){
 const x=c&&typeof c==='object'?{...c}:{type:'seat'};
 let t=String(x.type||'seat').toLowerCase();
 if(t==='seats')t='seat';
 if(!TYPES.has(t))t='seat';
 x.type=t;
 if(t==='stage')x.label=String(x.label||'במה');else delete x.label;
 if(t!=='seat')delete x.seat_id;
 return x;
}
function gridRowsToCells(grid){
 const out=[],rows=grid.cells||[];
 for(let r=0;r<grid.rows;r++){
  const src=rows[r]||[],cells=[];let c=0;
  while(c<grid.cols){
   const first=normalizeGridCell(src[c]),type=first.type,start=c,run=[];
   while(c<grid.cols&&normalizeGridCell(src[c]).type===type){run.push(normalizeGridCell(src[c]));c++}
   const id=`g-r${r+1}-${type}-${start+1}`;
   if(type==='seat')cells.push({id,type:'seats',count:run.length,seat_ids:run.map(x=>x.seat_id||null),grid_start:start+1});
   else cells.push({id,type,width:run.length,label:type==='stage'?'במה':undefined,grid_start:start+1});
  }
  out.push({id:`r${r+1}`,label:String(r+1),grid_row:r+1,cells});
 }
 return out;
}
function normalizeV2(d){
 d.version=2;d.front=d.front||{left:'',center:'',right:''};d.sections=d.sections||{};
 for(const sec of ['women','men']){
  const s=d.sections[sec]||(d.sections[sec]={});s.title=s.title||(sec==='men'?'גברים':'נשים');
  const g=s.grid&&typeof s.grid==='object'?s.grid:{rows:0,cols:0,cells:[]};
  g.rows=Math.max(0,Math.min(100,Math.round(Number(g.rows)||0)));
  g.cols=Math.max(0,Math.min(100,Math.round(Number(g.cols)||0)));
  const cells=[];
  for(let r=0;r<g.rows;r++){const row=[];for(let c=0;c<g.cols;c++)row.push(normalizeGridCell(g.cells?.[r]?.[c]));cells.push(row)}
  g.cells=cells;s.grid=g;s.rows=gridRowsToCells(g);
 }
 return d;
}
function normalizeV1(d){
 d.version=1;d.front=d.front||{left:'',center:'',right:''};d.sections=d.sections||{};
 for(const sec of ['women','men']){
  const s=d.sections[sec]||(d.sections[sec]={title:sec==='men'?'גברים':'נשים',rows:[]});s.title=s.title||(sec==='men'?'גברים':'נשים');s.rows=Array.isArray(s.rows)?s.rows:[];
  s.rows.forEach((r,ri)=>{r.id=cleanId(r.id,'r'+(ri+1));r.label=String(r.label??(ri+1));r.cells=Array.isArray(r.cells)?r.cells:[];r.cells.forEach((c,ci)=>{c.id=cleanId(c.id,'c'+(ci+1));if(!['seats','aisle','stage','spacer'].includes(c.type))c.type='seats';if(c.type==='seats')c.count=Math.max(1,Math.min(100,Number(c.count)||1));else c.width=Math.max(.25,Math.min(100,Number(c.width)||1));if(c.type==='stage')c.label=String(c.label||'במה')})});
 }
 return d;
}
function normalizeDefinition(raw){
 const d=raw&&typeof raw==='object'?clone(raw):{};
 return Number(d.version)>=2||d.sections?.men?.grid||d.sections?.women?.grid?normalizeV2(d):normalizeV1(d);
}
function seatId(layout,section,row,cell,index){
 const d=layout.definition||{};
 if(Array.isArray(cell.seat_ids)&&cell.seat_ids[index-1])return String(cell.seat_ids[index-1]);
 if(d.version>=2&&cell.grid_start){const r=Number(row.grid_row)||Number(row.label)||1,c=Number(cell.grid_start)+index-1;return `${cleanId(layout.code,'layout')}:${section}:r${r}:c${c}`}
 if(d.legacy_no){const code=section==='men'?'M':'W',key=String(cell.id||'').toUpperCase(),label=String(row.label);if(cell.legacy_single||/^X\d+$/.test(key))return `L${d.legacy_no}-${code}-${label}-${key}`;return `L${d.legacy_no}-${code}-${label}-${key}-${index}`}
 return `${cleanId(layout.code,'layout')}:${section}:${cleanId(row.id,'row')}:${cleanId(cell.id,'cell')}:${index}`;
}
function buildSeats(layout){
 const d=normalizeDefinition(layout.definition),out=[];
 if(d.version>=2){
  for(const section of ['women','men']){
   const g=d.sections[section].grid;
   for(let r=0;r<g.rows;r++){
    let block=-1,inRun=false,seatIndex=0,runStart=0;
    for(let c=0;c<g.cols;c++){
     const cell=normalizeGridCell(g.cells[r][c]);
     if(cell.type!=='seat'){inRun=false;seatIndex=0;continue}
     if(!inRun){block++;inRun=true;seatIndex=0;runStart=c}
     seatIndex++;
     const id=cell.seat_id||`${cleanId(layout.code,'layout')}:${section}:r${r+1}:c${c+1}`;
     out.push({id,section,row:r+1,row_id:`r${r+1}`,row_label:String(r+1),cell_id:`g-r${r+1}-seat-${runStart+1}`,cell_index:c,block,seat_index:seatIndex,order:c,segment:`${section}:r${r+1}:seg${block}`,col:c+1,grid_cols:g.cols});
    }
   }
  }
  return out;
 }
 for(const section of ['women','men']){
  const rows=d.sections[section].rows;
  rows.forEach((row,rowIndex)=>{let segmentIndex=0,order=0,blockIndex=0,lastWasSeat=false;row.cells.forEach((cell,cellIndex)=>{
   if(cell.type!=='seats'){if(lastWasSeat)segmentIndex++;lastWasSeat=false;return}
   const currentBlock=blockIndex++;
   for(let i=1;i<=cell.count;i++)out.push({id:seatId({...layout,definition:d},section,row,cell,i),section,row:rowIndex+1,row_id:row.id,row_label:row.label,cell_id:cell.id,cell_index:cellIndex,block:currentBlock,seat_index:i,order:order++,segment:`${section}:${row.id}:seg${segmentIndex}`});lastWasSeat=true;
  })})
 }
 return out;
}
function toGridDefinition(layout){
 const d=normalizeDefinition(layout?.definition||layout||{});
 if(d.version>=2)return normalizeDefinition(d);
 const out={version:2,front:clone(d.front||{}),sections:{},converted_from_version:1};
 if(d.legacy_no)out.legacy_no=d.legacy_no;
 for(const section of ['women','men']){
  const rows=d.sections[section].rows||[],expanded=[],maxCols=Math.max(0,...rows.map(row=>row.cells.reduce((n,c)=>n+(c.type==='seats'?Math.round(Number(c.count)||1):Math.max(1,Math.round(Number(c.width)||1))),0)));
  rows.forEach(row=>{
   const line=[];
   for(const cell of row.cells){
    if(cell.type==='seats'){
     for(let i=1;i<=cell.count;i++)line.push({type:'seat',seat_id:seatId({...layout,definition:d},section,row,cell,i)});
    }else{
     const n=Math.max(1,Math.round(Number(cell.width)||1));for(let i=0;i<n;i++)line.push({type:cell.type,label:cell.type==='stage'?String(cell.label||'במה'):undefined});
    }
   }
   while(line.length<maxCols)line.push({type:'spacer'});expanded.push(line);
  });
  out.sections[section]={title:d.sections[section].title||(section==='men'?'גברים':'נשים'),grid:{rows:expanded.length,cols:maxCols,cells:expanded}};
 }
 return normalizeDefinition(out);
}
function rowOrder(seats,section,rowRef){return seats.filter(s=>s.section===section&&(s.row_id===rowRef||s.row===rowRef||s.row_label===String(rowRef))).sort((a,b)=>a.order-b.order)}
function capacity(layout,section){return buildSeats(layout).filter(s=>s.section===section).length}
function seatIds(layout){return new Set(buildSeats(layout).map(s=>s.id))}
window.YNLayout={normalizeDefinition,toGridDefinition,seatId,buildSeats,rowOrder,capacity,seatIds,cleanId};
})();
