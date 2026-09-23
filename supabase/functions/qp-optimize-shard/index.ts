import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "./qp_sim_v5.js";

const E=(globalThis as any).QuietPremiumEngineV5;
const MAX_BYTES=600000;
function json(body:any,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
function authorized(req:Request){
  const supplied=req.headers.get("apikey")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  return !!service&&supplied===service;
}
function num(v:any){return Number.isFinite(Number(v))?Number(v):0}
function noJobCount(r:any){return (r?.cardRoles||[]).filter((x:any)=>(r?.portfolio||[]).includes(x.cardId)&&x.role==="no_job").length}
function preparedSummary(x:any){
  if(!x?.r||!x?.c)return null;
  return{
    id:x.r.id,
    portfolio:x.r.portfolio||[],
    netEconomicValue:num(x.r?.economics?.netEconomicValue),
    recommendedAnnualFees:num(x.r?.feeSummary?.recommendedAnnualFees),
    complexityBurden:num(x.r?.outcomes?.complexity?.burden),
    noJobCount:noJobCount(x.r),
    improvements:x.c.improvements||[],
    regressions:x.c.regressions||[]
  };
}
function chosenEntry(prepared:any[],chosen:any,current:any){
  if(!chosen||chosen===current||chosen?.id===current?.id)return null;
  return prepared.find(x=>x.r===chosen)||prepared.find(x=>x.r?.id===chosen?.id)||null;
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  if(!authorized(req))return json({error:"unauthorized"},401);
  let raw="";try{raw=await req.text()}catch{}
  if(!raw||raw.length>MAX_BYTES)return json({error:"invalid_payload"},400);
  let body:any;try{body=JSON.parse(raw)}catch{return json({error:"invalid_json"},400)}
  if(!E||typeof E.candidatePortfoliosShard!=="function")return json({error:"engine_unavailable"},500);
  try{
    const p=E.normalizeProfile(body.profile||{}),
          shardIndex=Math.max(0,Math.trunc(num(body.shardIndex))),
          shardCount=Math.max(1,Math.trunc(num(body.shardCount)||1)),
          travel=E.travelStrategy(p),
          rewards=E.rewardsStrategy(p,travel),
          current=E.currentRecord(p,"base",travel,rewards),
          allSets=E.candidatePortfoliosShard(p,rewards,shardIndex,shardCount),
          phase=String(body.phase||"counterfactual"),
          classifications=Array.isArray(body.classifications)?body.classifications:[],
          classBy=new Map(classifications.map((x:any)=>[x.cardId,x.classification])),
          required=new Set(p.constraints?.requiredCards||[]),
          sets=phase==="gated"
            ?allSets.filter((set:any[])=>set.filter(id=>!p.currentCards.includes(id)).every(id=>required.has(id)||classBy.get(id)==="recommended"))
            :allSets,
          records=sets.map((set:any[])=>{
            const rr=E.rewardsStrategyForPortfolio(p,set,travel,rewards);
            return E.strategyRecord(p,set,"base",travel,rr);
          }),
          prepared=E.prepareViable(p,records,current);
    if(phase==="counterfactual"){
      const ids=Array.isArray(body.cardIds)?body.cardIds:[];
      const bestWith:any={},bestWithout:any={};
      for(const id of ids){
        const withChosen=E.choosePrepared(prepared.filter((x:any)=>x.c&&(x.r.portfolio||[]).includes(id)),current),
              withoutChosen=E.choosePrepared(prepared.filter((x:any)=>x.c&&!(x.r.portfolio||[]).includes(id)),current);
        bestWith[id]=preparedSummary(chosenEntry(prepared,withChosen,current));
        bestWithout[id]=preparedSummary(chosenEntry(prepared,withoutChosen,current));
      }
      return json({status:"ok",phase,engineVersion:E.ENGINE_VERSION,shardIndex,shardCount,candidateCount:records.length,bestWith,bestWithout});
    }
    if(phase==="gated"){
      current.incrementalCardGate={pass:true,thresholds:{recommended:E.MODEL.newCardRecommendedMin,consider:E.MODEL.newCardConsiderMin},cards:[]};
      for(const r of records)r.incrementalCardGate=E.recordAcquisitionGate(p,r,classifications);
      const chosen=E.choosePrepared(prepared.filter((x:any)=>x.c&&x.r.incrementalCardGate?.pass!==false),current);
      const entry=chosenEntry(prepared,chosen,current);
      return json({status:"ok",phase,engineVersion:E.ENGINE_VERSION,shardIndex,shardCount,candidateCount:records.length,totalShardCandidates:allSets.length,best:entry?.r||null,bestSummary:preparedSummary(entry)});
    }
    return json({error:"invalid_phase"},400);
  }catch(e){
    return json({error:"shard_failed",detail:String((e as Error)?.message||e)},500);
  }
});