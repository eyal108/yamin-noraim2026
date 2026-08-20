(()=>{
if(!window.YNLayout?.toAreaDefinition||!window.YNLayout?.buildSeats)return;
const originalArea=window.YNLayout.toAreaDefinition,originalSeats=window.YNLayout.buildSeats;
function areaDefinition(layout){
 const raw=layout?.definition||layout||{},version=Number(raw?.version||1),d=originalArea(layout);
 if(version>=3||!Array.isArray(d?.levels))return d;
 for(const level of d.levels||[])for(const area of level.areas||[]){
  if(area.section==='women'&&(area.id==='women-main'||area.id==='women'))area.id='women';
  if(area.section==='men'&&(area.id==='men-main'||area.id==='men'))area.id='men';
 }
 return d;
}
function buildSeats(layout){
 const seats=originalSeats(layout),raw=layout?.definition||layout||{},version=Number(raw?.version||1);
 if(version!==1)return seats;
 const d=areaDefinition(layout),meta=new Map();
 for(const level of d.levels||[])for(const area of level.areas||[]){
  const g=area.grid||{};
  for(let r=0;r<(g.rows||0);r++)for(let c=0;c<(g.cols||0);c++){
   const cell=g.cells?.[r]?.[c];if(cell?.type!=='seat'||!cell.seat_id)continue;
   meta.set(String(cell.seat_id),{area_id:area.id,area_name:area.name,level_id:level.id,level_name:level.name,position:area.position,row:r+1,col:c+1,grid_cols:g.cols});
  }
 }
 return seats.map(s=>{const m=meta.get(String(s.id));return m?{...s,...m}:s});
}
window.YNLayout.toAreaDefinition=areaDefinition;
window.YNLayout.buildSeats=buildSeats;
})();
