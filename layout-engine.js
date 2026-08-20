(()=>{
function cleanId(s,fallback){const x=String(s||'').trim().replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');return x||fallback}
function normalizeDefinition(raw){
 const d=raw&&typeof raw==='object'?structuredClone(raw):{};d.version=1;d.front=d.front||{left:'',center:'',right:''};d.sections=d.sections||{};
 for(const sec of ['women','men']){const s=d.sections[sec]||(d.sections[sec]={title:sec==='men'?'גברים':'נשים',rows:[]});s.title=s.title|| (sec==='men'?'גברים':'נשים');s.rows=Array.isArray(s.rows)?s.rows:[];s.rows.forEach((r,ri)=>{r.id=cleanId(r.id,'r'+(ri+1));r.label=String(r.label??(ri+1));r.cells=Array.isArray(r.cells)?r.cells:[];r.cells.forEach((c,ci)=>{c.id=cleanId(c.id,'c'+(ci+1));if(!['seats','aisle','stage','spacer'].includes(c.type))c.type='seats';if(c.type==='seats')c.count=Math.max(1,Math.min(100,Number(c.count)||1));else c.width=Math.max(.25,Math.min(30,Number(c.width)||1));if(c.type==='stage')c.label=String(c.label||'במה')})})}
 return d;
}
function seatId(layout,section,row,cell,index){
 const d=layout.definition||{};
 if(d.legacy_no){const code=section==='men'?'M':'W',key=String(cell.id||'').toUpperCase(),label=String(row.label);if(cell.legacy_single||/^X\d+$/.test(key))return `L${d.legacy_no}-${code}-${label}-${key}`;return `L${d.legacy_no}-${code}-${label}-${key}-${index}`}
 return `${cleanId(layout.code,'layout')}:${section}:${cleanId(row.id,'row')}:${cleanId(cell.id,'cell')}:${index}`;
}
function buildSeats(layout){
 const d=normalizeDefinition(layout.definition),out=[];
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
function rowOrder(seats,section,rowRef){return seats.filter(s=>s.section===section&&(s.row_id===rowRef||s.row===rowRef||s.row_label===String(rowRef))).sort((a,b)=>a.order-b.order)}
function capacity(layout,section){return buildSeats(layout).filter(s=>s.section===section).length}
function seatIds(layout){return new Set(buildSeats(layout).map(s=>s.id))}
window.YNLayout={normalizeDefinition,seatId,buildSeats,rowOrder,capacity,seatIds,cleanId};
})();
