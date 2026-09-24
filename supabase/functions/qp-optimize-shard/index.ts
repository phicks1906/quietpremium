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
const TRAVEL_IMPROVEMENTS=new Set(["flightQuality","hotelExperience","airportExperience","reliability","benefitContinuity"]);
function betterSummary(a:any,b:any){
  if(!a)return b;if(!b)return a;
  if(Number(a.noJobCount)!==Number(b.noJobCount))return Number(a.noJobCount)<Number(b.noJobCount)?a:b;
  const at=(a.improvements||[]).filter((x:string)=>TRAVEL_IMPROVEMENTS.has(x)).length,
        bt=(b.improvements||[]).filter((x:string)=>TRAVEL_IMPROVEMENTS.has(x)).length;
  if(at!==bt)return at>bt?a:b;
  if(Number(a.netEconomicValue)!==Number(b.netEconomicValue))return Number(a.netEconomicValue)>Number(b.netEconomicValue)?a:b;
  if(Number(a.recommendedAnnualFees)!==Number(b.recommendedAnnualFees))return Number(a.recommendedAnnualFees)<Number(b.recommendedAnnualFees)?a:b;
  if(Number(a.complexityBurden)!==Number(b.complexityBurden))return Number(a.complexityBurden)<Number(b.complexityBurden)?a:b;
  return String(a.id||"").localeCompare(String(b.id||""))<=0?a:b;
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
          phase=String(body.phase||"counterfactual"),
          suppliedTravel=body.travel&&typeof body.travel==="object"?body.travel:null,
          suppliedRewards=body.rewards&&typeof body.rewards==="object"?body.rewards:null,
          travel=suppliedTravel||E.travelStrategy(p),
          rewards=suppliedRewards||E.rewardsStrategy(p,travel),
          classifications=Array.isArray(body.classifications)?body.classifications:[];

    if(phase==="eligibility"){
      return json({status:"ok",phase,engineVersion:E.ENGINE_VERSION,coBrandEligibility:E.candidateEligibility(p,rewards)});
    }

    const current=body.currentSearch&&typeof body.currentSearch==="object"
      ?body.currentSearch
      :E.currentRecord(p,"base",travel,rewards);

    if(phase==="select"){
      const portfolio=Array.isArray(body.portfolio)?body.portfolio.map((x:any)=>String(x||"")).filter(Boolean):[];
      if(!portfolio.length)return json({error:"portfolio_required"},400);
      const rr=E.rewardsStrategyForPortfolio(p,portfolio,travel,rewards),
            record=E.strategyRecord(p,portfolio,"base",travel,rr);
      if(body.expectedId&&String(body.expectedId)!==String(record.id))return json({error:"selected_portfolio_id_mismatch"},409);
      record.incrementalCardGate=E.recordAcquisitionGate(p,record,classifications);
      if(record.incrementalCardGate?.pass===false)return json({error:"selected_portfolio_failed_gate"},409);
      const prepared=E.prepareViable(p,[record],current),entry=prepared[0];
      if(!entry?.c)return json({error:"selected_portfolio_not_viable"},409);
      return json({status:"ok",phase,engineVersion:E.ENGINE_VERSION,best:record,bestSummary:preparedSummary(entry)});
    }

    const shardIndex=Math.max(0,Math.trunc(num(body.shardIndex))),
          shardCount=Math.max(1,Math.trunc(num(body.shardCount)||1)),
          allSets=E.candidatePortfoliosShard(p,rewards,shardIndex,shardCount,body.coBrandEligibility||null),
          classBy=new Map(classifications.map((x:any)=>[x.cardId,x.classification])),
          required=new Set(p.constraints?.requiredCards||[]),
          sets=phase==="gated"
            ?allSets.filter((set:any[])=>set.filter(id=>!p.currentCards.includes(id)).every(id=>required.has(id)||classBy.get(id)==="recommended"))
            :allSets;
    let records:any[]=[],prepared:any[]=[];
    if(phase==="counterfactual"){
      prepared=sets.map((set:any[])=>{
        const rr=E.rewardsStrategyForPortfolio(p,set,travel,rewards);
        return E.preparePortfolioSearch(p,set,current,"base",travel,rr);
      });
    }else{
      records=sets.map((set:any[])=>{
        const rr=E.rewardsStrategyForPortfolio(p,set,travel,rewards);
        return E.strategyRecord(p,set,"base",travel,rr);
      });
      prepared=E.prepareViable(p,records,current);
    }
    if(phase==="counterfactual"){
      const ids=Array.isArray(body.cardIds)?body.cardIds:[],
            bestWith:any={},bestWithout:any={},bestByNewSet:any={};
      for(const id of ids){bestWith[id]=null;bestWithout[id]=null;}
      for(const entry of prepared){
        if(!entry?.c)continue;
        const summary=preparedSummary(entry),portfolio=new Set(summary?.portfolio||[]);
        for(const id of ids){
          if(portfolio.has(id))bestWith[id]=betterSummary(bestWith[id],summary);
          else bestWithout[id]=betterSummary(bestWithout[id],summary);
        }
        const additions=(summary?.portfolio||[]).filter((id:string)=>!p.currentCards.includes(id)).slice().sort(),
              key=additions.join("|");
        bestByNewSet[key]=betterSummary(bestByNewSet[key]||null,summary);
      }
      return json({status:"ok",phase,engineVersion:E.ENGINE_VERSION,shardIndex,shardCount,candidateCount:sets.length,bestWith,bestWithout,bestByNewSet});
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