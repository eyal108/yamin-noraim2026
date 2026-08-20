(()=>{
if(!window.YNLayout?.toAreaDefinition)return;
const original=window.YNLayout.toAreaDefinition;
window.YNLayout.toAreaDefinition=function(layout){
 const raw=layout?.definition||layout||{},version=Number(raw?.version||1),d=original(layout);
 if(version>=3||!Array.isArray(d?.levels))return d;
 for(const level of d.levels||[])for(const area of level.areas||[]){
  if(area.section==='women'&&(area.id==='women-main'||area.id==='women'))area.id='women';
  if(area.section==='men'&&(area.id==='men-main'||area.id==='men'))area.id='men';
 }
 return d;
};
})();
