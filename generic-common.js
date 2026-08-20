(()=>{
const SUPA='https://fhilbjbuhtqdwvxhiedz.supabase.co';
const KEY='sb_publishable_sXoO_u65OB-SPt9OFPiz5A_XMUIIprl';
const SITE='https://eyal108.github.io/yamin-noraim2026/';
const TENANT_TABLES=new Set(['yamim_noraim_request_lists','yamim_noraim_layouts','yamim_noraim_families','yamim_noraim_requests','yamim_noraim_seating_v2','yamim_noraim_automatic_proposals']);
const ZERO='00000000-0000-0000-0000-000000000000';
let access=null;
const rawClient=()=>supabase.createClient(SUPA,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
function tenantId(){return localStorage.getItem('yn:synagogue')||''}
function addTenant(rows,id){if(Array.isArray(rows))return rows.map(x=>({...x,synagogue_id:id}));return {...(rows||{}),synagogue_id:id}}
function wrappedRelation(rel,table){
 if(!TENANT_TABLES.has(table))return rel;
 return new Proxy(rel,{get(target,prop){
  if(prop==='select')return(...args)=>target.select(...args).eq('synagogue_id',tenantId()||ZERO);
  if(prop==='insert')return(rows,...rest)=>{const id=tenantId();if(!id)throw Error('לא נבחר בית כנסת');return target.insert(addTenant(rows,id),...rest)};
  if(prop==='upsert')return(rows,...rest)=>{const id=tenantId();if(!id)throw Error('לא נבחר בית כנסת');return target.upsert(addTenant(rows,id),...rest)};
  if(prop==='update')return(values,...rest)=>target.update(values,...rest).eq('synagogue_id',tenantId()||ZERO);
  if(prop==='delete')return(...args)=>target.delete(...args).eq('synagogue_id',tenantId()||ZERO);
  const v=target[prop];return typeof v==='function'?v.bind(target):v;
 }})
}
function makeClient(){const c=rawClient();return new Proxy(c,{get(target,prop){if(prop==='from')return table=>wrappedRelation(target.from(table==='yamim_noraim_admins'?'yamim_noraim_synagogue_admins':table),table==='yamim_noraim_admins'?'yamim_noraim_synagogue_admins':table);const v=target[prop];return typeof v==='function'?v.bind(target):v}})}
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('he-IL');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
async function loadAccess(db,session){
 if(!session?.user?.email){access={isAdmin:false,isProductAdmin:false,synagogues:[],synagogueId:null};return access}
 const raw=rawClient();const [sr,pr]=await Promise.all([raw.from('yamim_noraim_synagogues').select('id,slug,name,is_active,ai_enabled').eq('is_active',true).order('name'),raw.rpc('is_yamim_noraim_product_admin')]);
 const synagogues=sr.error?[]:(sr.data||[]),isProductAdmin=!pr.error&&pr.data===true;
 const u=new URL(location.href),org=u.searchParams.get('org');let chosen=synagogues.find(s=>s.slug===org||s.id===org)?.id||localStorage.getItem('yn:synagogue');if(!synagogues.some(s=>s.id===chosen))chosen=synagogues[0]?.id||null;if(chosen)localStorage.setItem('yn:synagogue',chosen);else localStorage.removeItem('yn:synagogue');
 access={isAdmin:synagogues.length>0,isProductAdmin,synagogues,synagogueId:chosen,current:synagogues.find(s=>s.id===chosen)||null};window.YNAccess=access;mountTenantSelector();applyAiGate();return access
}
function mountTenantSelector(){if(!access?.isAdmin)return;const nav=document.querySelector('.appTabs');if(!nav||document.getElementById('ynTenantBar'))return;const cur=access.current,bar=document.createElement('div');bar.id='ynTenantBar';bar.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 16px;padding:10px 12px;background:#eef2ef;border-radius:12px';bar.innerHTML=`<b>בית כנסת:</b><select id="ynTenantSelect" style="min-width:180px;padding:7px;border:1px solid #c9d1cc;border-radius:8px">${access.synagogues.map(s=>`<option value="${s.id}"${s.id===access.synagogueId?' selected':''}>${esc(s.name)}</option>`).join('')}</select>${access.isProductAdmin?'<a class="btn" href="product-admin.html">ניהול מוצר</a>':''}`;nav.insertAdjacentElement('afterend',bar);bar.querySelector('select').onchange=e=>{const id=e.target.value,s=access.synagogues.find(x=>x.id===id);localStorage.setItem('yn:synagogue',id);const u=new URL(location.href);if(s)u.searchParams.set('org',s.slug);location.href=u.toString()};if(access.synagogues.length===1&&!access.isProductAdmin)bar.querySelector('select').disabled=true
}
function applyAiGate(){const cb=document.getElementById('useAiCheck');if(!cb||!access?.current)return;const enabled=!!access.current.ai_enabled;cb.checked=enabled&&cb.checked;cb.disabled=!enabled;const label=cb.closest('.engineOption');if(label){let note=label.querySelector('.aiTenantNote');if(!enabled){if(!note){note=document.createElement('small');note.className='aiTenantNote';note.style.cssText='display:block;color:#8a3b32;margin-top:4px';label.appendChild(note)}note.textContent='AI אינו מופעל לבית הכנסת הזה. רק מנהל המוצר יכול להפעיל אותו.'}else note?.remove()}}
async function isAdmin(db,session){const a=await loadAccess(db,session);return a.isAdmin}
function uid(prefix='id'){return prefix+'-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2))}
window.YNGeneric={SUPA,KEY,SITE,makeClient,makeRawClient:rawClient,norm,esc,isAdmin,loadAccess,getAccess:()=>access,tenantId,uid};
})();
