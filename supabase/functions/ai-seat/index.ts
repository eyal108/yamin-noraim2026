import { withSupabase } from 'npm:@supabase/server';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:corsHeaders});

const planSchema={
  type:'object',additionalProperties:false,required:['placements','unplaced','summary'],properties:{
    placements:{type:'array',items:{type:'object',additionalProperties:false,required:['family','section','seat_ids','reason'],properties:{
      family:{type:'string'},section:{type:'string',enum:['men','women']},seat_ids:{type:'array',minItems:1,items:{type:'string'}},reason:{type:'string'}
    }}},
    unplaced:{type:'array',items:{type:'object',additionalProperties:false,required:['family','section','remaining','reason'],properties:{
      family:{type:'string'},section:{type:'string',enum:['men','women']},remaining:{type:'integer',minimum:1},reason:{type:'string'}
    }}},
    summary:{type:'string'}
  }
};

function outputText(data:any){
  if(typeof data?.output_text==='string')return data.output_text;
  for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==='output_text'&&typeof c.text==='string')return c.text;
  return'';
}

const handler=withSupabase({auth:'user'},async(req,ctx)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const email=String((ctx.userClaims as any)?.email||'').trim().toLowerCase();
  if(!email)return json({error:'Authenticated user has no email'},403);
  const {data:admin,error:adminError}=await ctx.supabaseAdmin.from('yamim_noraim_admins').select('email').eq('email',email).maybeSingle();
  if(adminError||!admin)return json({error:'Admin access required'},403);

  const key=Deno.env.get('OPENAI_API_KEY');
  if(!key)return json({error:'OPENAI_API_KEY is not configured',code:'OPENAI_NOT_CONFIGURED'},503);
  const model=Deno.env.get('OPENAI_MODEL')||'gpt-5.6-terra';

  let body:any;
  try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  if(!['rh','yk'].includes(body?.event)||![1,2].includes(Number(body?.layout_no))||!Array.isArray(body?.families)||!Array.isArray(body?.seats))return json({error:'Invalid seating payload'},400);
  if(body.families.length>300||body.seats.length>500)return json({error:'Payload too large'},413);

  const system=`You are optimizing synagogue High Holidays seating. Produce a practical seating plan, not prose.
HARD RULES:
1. Existing assignments are immutable. Never move or reuse an occupied seat.
2. Use only seat IDs supplied in the input and only when occupied=false.
3. Men may only use men seats; women may only use women seats.
4. Never assign more seats to a family/section than its remaining count.
5. Every seat ID may appear at most once in the output.
6. Stage positions are absent from the seat list and must never be invented.
7. If no legal placement exists, put the remainder in unplaced.

OPTIMIZATION PRIORITIES, in order:
- Respect explicit natural-language notes when feasible, especially requested first/last row, same location, and near another named family.
- Preserve prior-year reference row/zone/side as much as possible. Reference is a preference, not a hard rule.
- Keep a family together in one contiguous run whenever possible.
- Avoid splitting. If splitting is unavoidable, prefer two groups and adjacent rows.
- If a family already has some seats, place its remaining seats close to those existing seats when feasible.
- Row 8 is a continuous row across former aisle positions.
- Row 0 is optional and should be used only when helpful; prefer normal rows when quality is similar.
- Consider the whole problem globally: do not consume scarce long contiguous runs if that strands a larger family.

A placement should normally be one contiguous group. If a family is split, return multiple placement objects for the same family/section. The reason field must be a single short practical explanation, not chain-of-thought or step-by-step reasoning. Return only data matching the required schema.`;

  const oa=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({
      model,store:false,reasoning:{effort:'medium'},max_output_tokens:8000,
      input:[{role:'system',content:system},{role:'user',content:JSON.stringify(body)}],
      text:{format:{type:'json_schema',name:'seating_plan',strict:true,schema:planSchema}}
    })
  });
  const data=await oa.json().catch(()=>({}));
  if(!oa.ok)return json({error:'AI provider error',provider_status:oa.status,detail:data?.error?.message||'Unknown provider error'},502);
  const text=outputText(data);if(!text)return json({error:'AI provider returned no plan'},502);
  let plan:any;try{plan=JSON.parse(text)}catch{return json({error:'AI provider returned invalid JSON'},502)}
  return json({plan,model,response_id:data?.id||null});
});

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  return handler(req);
});
