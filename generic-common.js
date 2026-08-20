(()=>{
const SUPA='https://fhilbjbuhtqdwvxhiedz.supabase.co';
const KEY='sb_publishable_sXoO_u65OB-SPt9OFPiz5A_XMUIIprl';
const SITE='https://eyal108.github.io/yamin-noraim2026/';
const makeClient=()=>supabase.createClient(SUPA,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('he-IL');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function isAdmin(db,session){
 if(!session?.user?.email)return false;
 const {data,error}=await db.from('yamim_noraim_admins').select('email').eq('email',session.user.email.toLowerCase()).maybeSingle();
 return !error&&!!data;
}
function uid(prefix='id'){return prefix+'-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2))}
window.YNGeneric={SUPA,KEY,SITE,makeClient,norm,esc,isAdmin,uid};
})();
