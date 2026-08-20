(()=>{
function apply(){
 const a=window.YNAccess,box=document.getElementById('adminsList'),add=document.getElementById('adminAdd'),auth=document.getElementById('adminAuth');
 if(!a||!box)return false;
 if(add)add.style.display='flex';
 box.querySelectorAll('button.danger,[data-email]').forEach(b=>b.style.display='');
 if(auth)auth.textContent=a.isProductAdmin?'מנהל מוצר — ניתן להוסיף ולהסיר מנהלים לבית הכנסת הנבחר.':'ניתן להוסיף ולהסיר מנהלים לבית הכנסת הזה.';
 return true;
}
let n=0;const t=setInterval(()=>{n++;if(apply()||n>50)clearInterval(t)},100);
const o=new MutationObserver(apply);
document.addEventListener('DOMContentLoaded',()=>{const x=document.getElementById('adminsList');if(x)o.observe(x,{childList:true,subtree:true})});
})();
