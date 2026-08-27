(()=>{
const navs=[...document.querySelectorAll('.appTabs')];
if(!navs.length)return;
const params=new URL(location.href).searchParams;
let org=params.get('org')||'';
try{org=org||YNGeneric.getAccess?.()?.current?.slug||''}catch{}
for(const nav of navs){for(const a of nav.querySelectorAll('a[href]')){const raw=a.getAttribute('href');if(!raw||raw.startsWith('http')||raw.startsWith('#'))continue;const u=new URL(raw,location.href);if(org)u.searchParams.set('org',org);a.setAttribute('href',u.pathname.split('/').pop()+(u.search||'')+(u.hash||''))}}
const adminOnly=navs.filter(n=>n.hasAttribute('data-admin-only'));
if(!adminOnly.length)return;
const setVisible=visible=>adminOnly.forEach(n=>{n.style.display=visible?'flex':'none'});
setVisible(false);
if(!window.YNGeneric?.makeClient||!window.YNGeneric?.isAdmin)return;
const db=YNGeneric.makeClient();let seq=0,timer=null;
async function refresh(){const s=++seq;try{const {data:{session}}=await db.auth.getSession();if(s!==seq)return;if(!session)return setVisible(false);const ok=await YNGeneric.isAdmin(db,session);if(s===seq)setVisible(!!ok)}catch(e){console.error('Unable to resolve admin tabs',e);if(s===seq)setVisible(false)}}
db.auth.onAuthStateChange(()=>{clearTimeout(timer);timer=setTimeout(refresh,75)});
refresh();
})();
