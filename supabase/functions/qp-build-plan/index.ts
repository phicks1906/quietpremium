import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "./qp_sim_v5.js";
import { stageOneEntities, finalEntities, chunkEntityRequest, verificationGaps, mergeSnapshotParts, sameEntityRequest } from "./core.ts";
import { auditPlan } from "./audit.ts";
import { buildResultContract } from "./result-contract.ts";

const ORIGINS=new Set(["https://quietpremium.com","https://www.quietpremium.com"]);
const PUBLIC_BROWSER_KEY="sb_publishable_BETG0zmWAEmPByBsKyEUzA_yPCOkh5F";
const VERIFIER="qp-verify-facts",MAX_PROFILE_BYTES=250000,MAX_STABILIZATION_PASSES=2;
const E=(globalThis as any).QuietPremiumEngineV5;

function json(body:any,status=200,origin=""){
  const h:any={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
  if(origin&&ORIGINS.has(origin)){h["Access-Control-Allow-Origin"]=origin;h["Vary"]="Origin"}
  return new Response(JSON.stringify(body),{status,headers:h});
}
function preflight(origin:string){
  if(!ORIGINS.has(origin))return new Response(null,{status:403});
  return new Response(null,{status:204,headers:{
    "Access-Control-Allow-Origin":origin,
    "Access-Control-Allow-Headers":"apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Max-Age":"86400","Vary":"Origin"
  }});
}
function publishableKeys(){
  const out:string[]=[PUBLIC_BROWSER_KEY];
  try{const x=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");for(const v of Object.values(x))if(typeof v==="string"&&v)out.push(v)}catch{}
  const legacy=Deno.env.get("SUPABASE_ANON_KEY");if(legacy)out.push(legacy);
  return new Set(out);
}
function authorized(req:Request){const k=req.headers.get("apikey")||"";return !!k&&publishableKeys().has(k)}
async function hash(s:string){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
  return[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function verifierRequest(request:any){
  const base=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_ANON_KEY");
  if(!base||!key)throw new Error("verifier_backend_not_configured");
  const res=await fetch(base+"/functions/v1/"+VERIFIER,{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":key},
    body:JSON.stringify(request)
  });
  let body:any=null;try{body=await res.json()}catch{}
  if(!res.ok)throw new Error("verifier_http_"+res.status+":"+(body?.error||"unknown"));
  return body;
}
async function verifyRequest(request:any,stage:string){
  const chunks=chunkEntityRequest(request,12),parts:any[]=[];
  for(const chunk of chunks)parts.push(await verifierRequest(chunk));
  const verifiedAt=new Date().toISOString();
  const sig=parts.map(p=>p.snapshotId||"").sort().join("|")+"|"+stage+"|"+verifiedAt;
  const snapshotId="qpp_"+verifiedAt.replace(/\D/g,"").slice(0,14)+"_"+(await hash(sig)).slice(0,12);
  return mergeSnapshotParts(parts,snapshotId,verifiedAt);
}
function approvedValuationSnapshot(){return E.CURRENT_QP_VALUATION_SNAPSHOT}
function attach(profile:any,snapshot:any){return{...(profile||{}),verifiedFacts:snapshot,valuationSnapshot:approvedValuationSnapshot()}}
function safePlanResult(result:any,resultExperience:any){
  return{
    status:"ready",
    engineVersion:result.engineVersion,
    rulesAsOf:result.rulesAsOf,
    factsSnapshot:result.factsSnapshot,
    valuationSnapshot:result.valuationSnapshot,
    factQuality:result.factQuality,
    current:result.current,
    recommended:result.recommended,
    travelStrategy:result.travelStrategy,
    rewardsStrategy:result.rewardsStrategy,
    newCardClassifications:result.newCardClassifications,
    considerCards:result.considerCards,
    allMaterialOpportunities:result.allMaterialOpportunities,
    presentation:result.presentation,
    resultExperience,
    sensitivity:result.sensitivity,
    integrity:result.integrity
  };
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS")return preflight(origin);
  if(req.method!=="POST")return json({error:"method_not_allowed"},405,origin);
  if(origin&&!ORIGINS.has(origin))return json({error:"origin_not_allowed"},403,origin);
  if(!authorized(req))return json({error:"unauthorized"},401,origin);
  if(!E||typeof E.analyze!=="function"||!E.CURRENT_QP_VALUATION_SNAPSHOT)return json({error:"engine_unavailable"},500,origin);

  let rawText="";try{rawText=await req.text()}catch{}
  if(!rawText||rawText.length>MAX_PROFILE_BYTES)return json({error:"invalid_profile_payload"},400,origin);
  let body:any;try{body=JSON.parse(rawText)}catch{return json({error:"invalid_json"},400,origin)}
  const rawProfile=body?.profile??body;
  if(!rawProfile||typeof rawProfile!=="object"||Array.isArray(rawProfile))return json({error:"profile_required"},400,origin);

  try{
    const normalized=E.normalizeProfile({...rawProfile,valuationSnapshot:approvedValuationSnapshot()});
    const stage1Request=stageOneEntities(normalized,E);
    const stage1Snapshot=await verifyRequest(stage1Request,"strategy");
    const stage1Gaps=verificationGaps(stage1Snapshot,stage1Request);
    if(stage1Gaps.length)return json({
      status:"not_ready",reason:"strategy_verification_incomplete",
      verification:{stage:"strategy",request:stage1Request,gaps:stage1Gaps,snapshot:stage1Snapshot}
    },409,origin);

    let working=attach(normalized,stage1Snapshot);
    let target=finalEntities(working,E).request;
    let finalSnapshot:any=null;
    let stabilized=false;

    for(let pass=1;pass<=MAX_STABILIZATION_PASSES;pass++){
      finalSnapshot=await verifyRequest(target,"final_"+pass);
      const gaps=verificationGaps(finalSnapshot,target);
      if(gaps.length)return json({
        status:"not_ready",reason:"final_verification_incomplete",
        verification:{stage:"final",pass,request:target,gaps,snapshot:finalSnapshot}
      },409,origin);

      working=attach(normalized,finalSnapshot);
      const recomputed=finalEntities(working,E).request;
      if(sameEntityRequest(target,recomputed)){stabilized=true;break}
      target=recomputed;
    }

    if(!stabilized)return json({
      status:"not_ready",reason:"strategy_did_not_stabilize",
      verification:{request:target,snapshot:finalSnapshot}
    },409,origin);

    const result=E.analyze(working);
    const audit=auditPlan(result,E);
    if(!audit.pass)return json({status:"not_ready",reason:"pre_output_audit_failed",audit,factQuality:result?.factQuality||null,factsSnapshot:result?.factsSnapshot||null,valuationSnapshot:result?.valuationSnapshot||null},409,origin);
    if(!result?.factQuality?.productionReady)return json({
      status:"not_ready",reason:"engine_fact_quality_not_ready",
      factQuality:result?.factQuality||null,factsSnapshot:result?.factsSnapshot||null,valuationSnapshot:result?.valuationSnapshot||null
    },409,origin);

    const expected=finalEntities(result.profile,E).request;
    const finalGaps=verificationGaps(result.profile.verifiedFacts,expected);
    if(finalGaps.length)return json({
      status:"not_ready",reason:"post_analysis_verification_gap",
      verification:{request:expected,gaps:finalGaps,snapshot:result.profile.verifiedFacts}
    },409,origin);

    const resultExperience=buildResultContract(result,E,audit);
    if(resultExperience?.quality?.ready!==true)return json({status:"not_ready",reason:"results_contract_not_ready",audit,resultExperience},409,origin);
    return json({...safePlanResult(result,resultExperience),audit},200,origin);
  }catch(e){
    return json({error:"plan_build_failed",detail:String((e as Error)?.message||e)},502,origin);
  }
});
