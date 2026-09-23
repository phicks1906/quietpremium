(()=>{
"use strict";
const SCHEMA="qp-results-v1",KEY="qp-results-v1";
function parseEmbedded(){
  const el=document.getElementById("qp-plan-data");if(!el)return null;
  try{return JSON.parse(el.textContent||"null")}catch{return null}
}
function normalize(raw){return raw?.resultExperience||raw?.result?.resultExperience||raw}
function demo(){
  return{
    meta:{schema:SCHEMA,engineVersion:"5.0-alpha.31",rulesAsOf:"2026-09-22",factsSnapshotId:"demo-facts",valuationSnapshotId:"qp-valuations-2026-09-21-v1"},
    newTravelLife:{
      flyBetter:{primaryAirline:"united",status:{naturalOutcome:"Premier Silver",selectedTarget:"Premier Gold",stoppingPoint:"Premier Gold",interventionRequired:true,whyNotHigher:[{tier:"Premier Platinum",reachable:true,stopReason:"incremental_value_below_opportunity_cost"}],ladder:[{tier:"Premier Silver",selected:false,reachable:true,stopReason:"lower_tier"},{tier:"Premier Gold",selected:true,reachable:true,stopReason:"incremental_value_supports_tier"},{tier:"Premier Platinum",selected:false,reachable:true,stopReason:"incremental_value_below_opportunity_cost"}]}},
      airportExperience:{capabilities:{lounge:1,priorityAirport:1}},
      travelCapacity:{annualTravelValue:2400},
      stayBetter:{primaryHotel:"hyatt",status:{naturalOutcome:"Discoverist",selectedTarget:"Explorist",interventionRequired:true}}
    },
    strategy:{airline:{primary:"united",mode:"primary_with_exceptions"},hotel:{primary:"hyatt",mode:"chain_default"},primaryTransferableEcosystem:"chase_ur",rewardsReason:"optimized_portfolio_switch"},
    status:{airline:{program:"united",naturalOutcome:"Premier Silver",selectedTarget:"Premier Gold",stoppingPoint:"Premier Gold",interventionRequired:true,whyNotHigher:[{tier:"Premier Platinum",reachable:true,stopReason:"incremental_value_below_opportunity_cost"}],ladder:[{tier:"Premier Silver",selected:false,reachable:true,stopReason:"lower_tier"},{tier:"Premier Gold",selected:true,reachable:true,stopReason:"incremental_value_supports_tier"},{tier:"Premier Platinum",selected:false,reachable:true,stopReason:"incremental_value_below_opportunity_cost"}]},hotel:{program:"hyatt",naturalOutcome:"Discoverist",selectedTarget:"Explorist",interventionRequired:true}},
    cards:{keep:[{cardId:"existing_card",label:"Existing Travel Card",action:"keep",role:"travel_benefit",routineAnnualSpend:0}],keepButStopRoutineSpend:[{cardId:"benefit_card",label:"Existing Premium Card",action:"keep",role:"travel_benefit",routineAnnualSpend:0}],removeOrDowngrade:[{cardId:"old_card",label:"Overlapping Premium Card",action:"remove_or_downgrade_after_review",role:"remove_or_downgrade"}],manualReviewBeforeRemoval:[],recommendedNew:[{cardId:"chase_preferred",label:"Chase Sapphire Preferred",classification:"recommended",routineAnnualSpend:62000}],requiredByConstraint:[],consider:[{cardId:"venture_x",label:"Capital One Venture X",classification:"consider",incrementalRecurringValue:245}]},
    spendPlan:{ongoingRouting:{dining:[{card:"chase_preferred",amount:24000}],airfare:[{card:"existing_card",amount:12000}],general:[{card:"chase_preferred",amount:38000}]},protectedSpend:{guardrailEnforced:true,higherTierStops:[]},recurringThresholds:[],finiteInterventions:[]},
    economics:{currentAnnualFees:900,recommendedAnnualFees:700,annualFeeSavings:200,annualFeeIncrease:0,currentNetEconomicValue:3250,recommendedNetEconomicValue:5660,defensibleCurrentVsRecommendedDelta:2410},
    benefits:{highlightedTravelOutcomes:[{benefit:"lounge_access",label:"Lounge access"},{benefit:"checked_bag",label:"Checked bag benefit"},{benefit:"hotel_status",label:"Hotel recognition"}],additionalQualitativeBenefits:[{benefit:"travel_protection",label:"Incremental travel protection"}],allVisibleBenefits:[]},
    companion:{futureIntent:"not_sure",expectedFrequency:"",quantitativeState:"qualitative_unresolved"},
    implementationPlan:{schema:"qp-implementation-plan-v1",principle:"Set it up once. Then let it run.",excludesConsiderCards:true,phases:[
      {id:"days_1_30",days:"Days 1–30",title:"Make the structural changes",objective:"Put the recommended card structure and routine routing in place.",actions:[{id:"a1",type:"card_add",title:"Add Chase Sapphire Preferred",cardId:"chase_preferred"},{id:"a2",type:"stop_routine_spend",title:"Keep Existing Premium Card, but stop routine spend",cardId:"benefit_card"},{id:"a3",type:"routing",title:"Route Dining to Chase Sapphire Preferred",annualAmount:24000}],successState:"The recommended structure and routine routing are in place."},
      {id:"days_31_60",days:"Days 31–60",title:"Hit only the worthwhile targets",objective:"Execute only the recurring thresholds or finite interventions the engine justified.",actions:[{id:"a4",type:"finite_intervention",title:"Use Existing Travel Card only until Premier Gold is secured",spendRequired:4000,stopCondition:{tier:"Premier Gold"}}],successState:"The worthwhile targets are being tracked against their exact stop conditions."},
      {id:"days_61_90",days:"Days 61–90",title:"Move into steady state",objective:"End finite interventions at their stopping points and let the ongoing strategy run.",actions:[{id:"a5",type:"post_threshold",title:"After Premier Gold is complete, follow the steady-state routing"},{id:"a6",type:"status_stop",title:"Do not chase Premier Platinum",tier:"Premier Platinum",reason:"incremental_value_below_opportunity_cost"}],successState:"Temporary interventions end when their stop conditions are met, and the ongoing routing remains in force."}
    ],day90:{title:"Your system is running.",summary:"The recommended structure is in place, worthwhile thresholds have explicit stop conditions, and routine spend follows the ongoing strategy."}},
    quality:{ready:true,assumptions:[],unresolvedFacts:[],engineIssues:[],manualReviewItems:[],audit:{pass:true,errors:[],warnings:[]}}
  };
}
function resolve(){
  let raw=window.QP_PLAN_RESULT||parseEmbedded();
  if(!raw){try{raw=JSON.parse(sessionStorage.getItem(KEY)||"null")}catch{}}
  let isDemo=false;
  if(!raw&&new URLSearchParams(location.search).get("demo")==="1"){raw=demo();isDemo=true}
  const data=normalize(raw);
  if(!data)return window.QPPlanRenderer?.renderError("No results contract was supplied. Phase 4C will connect the live intake and server handoff.");
  if(data?.meta?.schema!==SCHEMA)return window.QPPlanRenderer?.renderError("This result uses an unsupported report schema.");
  if(data?.quality?.ready!==true)return window.QPPlanRenderer?.renderError("The analysis is not production-ready, so Quiet Premium is withholding the recommendation.");
  window.QP_PLAN_ACTIVE_RESULT=data;
  window.QP_PLAN_PREVIEW=isDemo;
  window.QPPlanRenderer?.render(data,{demo:isDemo});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",resolve);else resolve();
})();