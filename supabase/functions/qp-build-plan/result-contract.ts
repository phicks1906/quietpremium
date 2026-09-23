export const RESULT_CONTRACT_SCHEMA="qp-results-v1";

const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const list=x=>Array.isArray(x)?x:[];
const AIRPORT_KEYS=new Set(["lounge","lounge_access","priority_airport","priority_boarding","boarding_benefits","clear","trusted_traveler","global_entry_tsa","upgrade_priority"]);
const HOTEL_KEYS=new Set(["premium_hotel","premium_hotel_booking","premium_hotel_benefits","premium_hotel_collection","hotel_status","elite_night_credits"]);
const FLIGHT_KEYS=new Set(["checked_bag","seat_benefits","upgrade_priority","upgrade_eligibility","award_discount_annual","award_discount_threshold","companion_certificate_renewal","companion_pass_boost"]);

function cardFactsView(E,profile,cardId){
  const f=E?.cardFacts?.(profile,cardId)||{};
  return{cardId,label:f.label||cardId,kind:f.kind||"",annualFee:num(f.annualFee),currency:f.currency||"",airline:f.airline||"",hotel:f.hotel||""};
}
function routedAmount(routing,cardId){
  let total=0;for(const rows of Object.values(routing||{}))for(const row of list(rows))if(row?.card===cardId)total+=num(row?.amount);return total;
}
function benefitKey(x){return String(x?.benefit||"").trim().toLowerCase();}
function benefitsFor(visible,set){return list(visible).filter(x=>set.has(benefitKey(x))).map(clone);}
function statusView(rec){
  const ladder=rec?.strategy?.airlineStatusLadder||{},rows=list(ladder.rows),selected=ladder.selected||null;
  const selectedIndex=selected?rows.findIndex(x=>String(x?.tier||"").toLowerCase()===String(selected?.tier||"").toLowerCase()):-1;
  const whyNotHigher=selectedIndex>=0?rows.slice(selectedIndex+1).map(x=>({tier:x?.tier||"",reachable:x?.reachable===true,stopReason:x?.stopReason||"",opportunityCost:x?.opportunityCost??null})):rows.filter(x=>x?.stopReason).map(x=>({tier:x?.tier||"",reachable:x?.reachable===true,stopReason:x?.stopReason||"",opportunityCost:x?.opportunityCost??null}));
  const airAction=rec?.travelActions?.airline||{},hotelAction=rec?.travelActions?.hotel||{},hotelTarget=rec?.strategy?.hotelStatusTarget||null;
  const naturalAir=airAction.effectiveNaturalStatus||airAction.projectedNaturalStatus||"";
  return{
    airline:{
      program:ladder.airline||airAction.primary||"",
      naturalOutcome:naturalAir,
      selectedTarget:selected?.tier||naturalAir,
      stoppingPoint:selected?.tier||naturalAir,
      interventionRequired:!!rec?.strategy?.airlineStatusTarget,
      intervention:clone(rec?.strategy?.airlineStatusTarget||null),
      whyNotHigher,
      ladder:clone(rows),
      benefitFactsComplete:ladder.benefitFactsComplete===true
    },
    hotel:{
      program:hotelAction.primary||"",
      naturalOutcome:hotelAction.effectiveNaturalStatus||hotelAction.projectedNaturalStatus||"",
      selectedTarget:hotelTarget?.tier||rec?.outcomes?.hotelExperience?.effectiveStatus||hotelAction.effectiveNaturalStatus||"",
      interventionRequired:!!hotelTarget,
      intervention:clone(hotelTarget)
    }
  };
}
function classificationMap(result){return Object.fromEntries(list(result?.newCardClassifications).map(x=>[x.cardId,x]));}
function actionCard(action,result,E){
  const profile=result?.profile||{},byClass=classificationMap(result),c=byClass[action.cardId]||null;
  return{...cardFactsView(E,profile,action.cardId),action:action.action||"",role:action.role||"",routineAnnualSpend:routedAmount(result?.recommended?.ongoingRouting,action.cardId),classification:c?.classification||"",incrementalRecurringValue:c?.incrementalRecurringValue??null,requiredByConstraint:list(profile?.constraints?.requiredCards).includes(action.cardId)};
}


function titleCase(value){
  return String(value||"").replace(/[_-]+/g," ").replace(/\b\w/g,m=>m.toUpperCase()).trim();
}
const CATEGORY_LABELS=Object.freeze({
  dining:"Dining",grocery:"Groceries",online_grocery:"Online groceries",drugstore:"Drugstores",
  gas_ev:"Gas & EV charging",transit:"Transit",online_retail:"Online retail",vacation_home:"Vacation homes",
  airfare:"Airfare",hotel:"Hotels",general:"Everything else"
});
const BENEFIT_LABELS=Object.freeze({
  southwest_chase_travel_credit_500:"$500 Southwest Airlines Chase Travel credit",
  hyatt_explorist_status_threshold:"World of Hyatt Explorist status",
  ihg_diamond_status_threshold:"IHG One Rewards Diamond Elite status",
  southwest_alist_status_threshold:"Southwest Rapid Rewards A-List status",
  shops_at_chase_credit_250:"$250 Shops at Chase credit"
});
function categoryLabel(value){return CATEGORY_LABELS[value]||titleCase(value)}
function benefitLabel(value){return BENEFIT_LABELS[value]||titleCase(value)}
function fmtMoney(value){return "$"+Math.round(num(value)).toLocaleString("en-US")}
function routeGroups(rec,E,profile){
  const byCard=new Map();
  for(const [category,rows] of Object.entries(rec?.ongoingRouting||{})){
    for(const row of list(rows)){
      if(!row?.card||num(row?.amount)<=0)continue;
      if(!byCard.has(row.card))byCard.set(row.card,{cardId:row.card,label:cardFactsView(E,profile,row.card).label,categories:[],annualAmount:0});
      const group=byCard.get(row.card);group.categories.push({category,label:categoryLabel(category),annualAmount:num(row.amount)});group.annualAmount+=num(row.amount);
    }
  }
  return [...byCard.values()];
}
function routeActionRows(rec,E,profile){
  return routeGroups(rec,E,profile).map(group=>({
    id:"route:"+group.cardId,
    type:"routing",
    title:"Use "+group.label+" for "+group.categories.map(x=>x.label).join(", "),
    cardId:group.cardId,
    categories:clone(group.categories),
    annualAmount:num(group.annualAmount),
    source:"recommended.ongoingRouting"
  }));
}
function thresholdAction(job,E,profile,rec){
  const card=cardFactsView(E,profile,job?.cardId||"");
  const remaining=job?.spendRequired==null?null:num(job.spendRequired),required=num(job?.annualSpendRequired||job?.stopCondition?.amount),routine=routedAmount(rec?.ongoingRouting,job?.cardId||"");
  const natural=required>0&&routine>=required&&num(job?.routingOpportunityCost)<=0&&num(job?.opportunityCost)<=0;
  const label=benefitLabel(job?.purpose||"threshold");
  return{
    id:job?.id||("annual_threshold:"+job?.cardId),
    type:"recurring_threshold",
    title:natural
      ?"Your normal routing naturally clears the "+fmtMoney(required)+" annual spend target on "+card.label
      :"Reach the "+fmtMoney(required)+" annual spend target on "+card.label+" only because "+label+" justifies it",
    explanation:natural
      ?"No extra spending or detour is required. That normal routing also unlocks "+label+"."
      :"This is a justified recurring threshold, not a reason to spend more than planned.",
    naturalThroughOngoingRouting:natural,
    cardId:job?.cardId||"",
    purpose:job?.purpose||"",
    purposeLabel:label,
    annualSpendRequired:required,
    currentYearSpendRemaining:remaining,
    modeledValue:num(job?.modeledValue),
    routingOpportunityCost:num(job?.routingOpportunityCost),
    stopCondition:clone(job?.stopCondition||null),
    nextStep:clone(job?.nextStep||job?.postThresholdRouting||[]),
    source:"recommended.recurringJobs"
  };
}
function interventionAction(job,E,profile){
  const card=cardFactsView(E,profile,job?.cardId||"");
  const target=job?.purpose||job?.stopCondition?.tier||"target";
  return{
    id:job?.id||("finite_intervention:"+job?.cardId),
    type:"finite_intervention",
    title:"Use "+card.label+" only until "+titleCase(target)+" is secured",
    cardId:job?.cardId||"",
    purpose:target,
    spendRequired:num(job?.spendRequired),
    opportunityCost:num(job?.opportunityCost),
    stopCondition:clone(job?.stopCondition||null),
    nextStep:clone(job?.nextStep||job?.postThresholdRouting||[]),
    source:"recommended.temporaryJobs"
  };
}
function buildImplementationPlan(result,E,parts){
  const rec=result?.recommended||{},profile=result?.profile||{},phase1=[],phase2=[],phase3=[];
  for(const x of parts.recommendedNew||[])phase1.push({id:"add:"+x.cardId,type:"card_add",title:"Add "+x.label,cardId:x.cardId,classification:"recommended",source:"recommended.actions"});
  for(const x of parts.requiredByConstraint||[])phase1.push({id:"required:"+x.cardId,type:"required_card",title:"Set up "+x.label+" because it is an explicit constraint",cardId:x.cardId,source:"profile.constraints.requiredCards"});
  for(const x of parts.keepButStopRoutineSpend||[])phase1.push({id:"stop_spend:"+x.cardId,type:"stop_routine_spend",title:"Keep "+x.label+", but stop routine spend",cardId:x.cardId,source:"recommended.actions"});
  for(const x of parts.removeOrDowngrade||[])phase1.push({id:"review_remove:"+x.cardId,type:"remove_or_downgrade",title:"Review "+x.label+" for downgrade or removal",cardId:x.cardId,source:"recommended.actions"});
  for(const x of parts.manualReviewBeforeRemoval||[])phase1.push({id:"manual_review:"+x.cardId,type:"manual_review",title:"Resolve the open facts on "+x.label+" before any removal",cardId:x.cardId,source:"recommended.actions"});
  phase1.push(...routeActionRows(rec,E,profile));

  const recurring=list(rec?.recurringJobs).map(j=>thresholdAction(j,E,profile,rec));
  const finite=list(rec?.temporaryJobs).map(j=>interventionAction(j,E,profile));
  phase2.push(...finite,...recurring);
  if(!phase2.length)phase2.push({
    id:"no_threshold_chase",
    type:"no_change",
    title:"No status or spend threshold intervention is required",
    source:"recommended.recurringJobs+recommended.temporaryJobs"
  });

  for(const job of [...finite,...recurring]){
    if(list(job.nextStep).length)phase3.push({
      id:"handoff:"+job.id,
      type:"post_threshold",
      title:"After "+benefitLabel(job.purpose)+" is complete, return to the steady-state routing",
      jobId:job.id,
      nextStep:clone(job.nextStep),
      source:job.source
    });
  }
  for(const stop of parts?.status?.airline?.whyNotHigher||[]){
    if(!stop?.stopReason)continue;
    phase3.push({
      id:"status_stop:"+String(stop.tier||"").toLowerCase().replace(/\s+/g,"_"),
      type:"status_stop",
      title:"Do not chase "+(stop.tier||"the next airline tier"),
      tier:stop.tier||"",
      reason:stop.stopReason,
      opportunityCost:stop.opportunityCost??null,
      source:"recommended.strategy.airlineStatusLadder"
    });
  }
  if(!phase3.length&&Object.values(rec?.ongoingRouting||{}).some(rows=>list(rows).some(r=>num(r?.amount)>0)))phase3.push({
    id:"steady_state",
    type:"steady_state",
    title:"Continue the steady-state routing shown in this plan",
    source:"recommended.ongoingRouting"
  });

  return{
    schema:"qp-implementation-plan-v1",
    principle:"Set it up once. Then let it run.",
    phases:[
      {id:"days_1_30",days:"Days 1–30",title:"Make the structural changes",objective:"Put the recommended card structure and routine routing in place.",actions:phase1,successState:phase1.length?"The recommended structure and routine routing are in place.":"No structural change is required."},
      {id:"days_31_60",days:"Days 31–60",title:"Hit only the worthwhile targets",objective:"Execute only the recurring thresholds or finite interventions the engine justified.",actions:phase2,successState:(finite.length||recurring.length)?"The worthwhile targets are being tracked against their exact stop conditions.":"No unnecessary threshold chase has been introduced."},
      {id:"days_61_90",days:"Days 61–90",title:"Move into steady state",objective:"End finite interventions at their stopping points and let the ongoing strategy run.",actions:phase3,successState:"Temporary interventions end when their stop conditions are met, and the ongoing routing remains in force."}
    ],
    day90:{
      title:"Your system is running.",
      summary:"The recommended structure is in place, worthwhile thresholds have explicit stop conditions, and routine spend follows the ongoing strategy."
    },
    excludesConsiderCards:true
  };
}

export function buildResultContract(result,E,audit={pass:false,errors:[],warnings:[]}){
  const rec=result?.recommended||{},cur=result?.current||{},profile=result?.profile||{},actions=list(rec.actions),visible=list(rec.visibleBenefits);
  const actionViews=actions.map(a=>actionCard(a,result,E));
  const keeps=actionViews.filter(x=>x.action==="keep");
  const keepButStopRoutineSpend=keeps.filter(x=>x.routineAnnualSpend<=0&&["travel_benefit","no_job"].includes(x.role));
  const keepStopIds=new Set(keepButStopRoutineSpend.map(x=>x.cardId));
  const add=actionViews.filter(x=>x.action==="add");
  const recommendedNew=add.filter(x=>x.classification==="recommended");
  const requiredByConstraint=add.filter(x=>x.requiredByConstraint&&x.classification!=="recommended");
  const consider=list(result?.considerCards).filter(x=>!list(profile?.constraints?.requiredCards).includes(x.cardId)&&!list(rec.portfolio).includes(x.cardId)).map(x=>({...cardFactsView(E,profile,x.cardId),classification:"consider",incrementalRecurringValue:x.incrementalRecurringValue??null,bestWithId:x.bestWithId||"",bestWithoutId:x.bestWithoutId||""}));
  const removeOrDowngrade=actionViews.filter(x=>x.action==="remove_or_downgrade_after_review");
  const manualReviewBeforeRemoval=actionViews.filter(x=>x.action==="manual_review_before_removal"||x.action==="manual_review");
  const status=statusView(rec);
  const companionState=rec?.economics?.portfolioRecurringBenefits?.companion||{totalValue:0,uses:0,demand:0,byCard:{},unresolved:[],intent:profile?.companionTravel?.intent||""};
  const swCompanion=rec?.strategy?.southwestCompanionPass||null;
  const currentNet=num(cur?.economics?.netEconomicValue),recommendedNet=num(rec?.economics?.netEconomicValue);
  const protectedStops=status.airline.whyNotHigher.filter(x=>String(x.stopReason||"").includes("protected_spend"));
  return{
    meta:{
      schema:RESULT_CONTRACT_SCHEMA,
      engineVersion:result?.engineVersion||"",
      rulesAsOf:result?.rulesAsOf||"",
      factsSnapshotId:result?.factsSnapshot?.snapshotId||"",
      valuationSnapshotId:result?.valuationSnapshot?.snapshotId||""
    },
    newTravelLife:{
      flyBetter:{primaryAirline:result?.travelStrategy?.airline?.primary||"",relationshipMode:result?.travelStrategy?.airline?.mode||"",status:clone(status.airline),benefits:benefitsFor(visible,FLIGHT_KEYS)},
      airportExperience:{capabilities:clone(rec?.recommendationCredit||{}),benefits:benefitsFor(visible,AIRPORT_KEYS)},
      travelCapacity:clone(rec?.outcomes?.travelCapacity||{}),
      stayBetter:{primaryHotel:result?.travelStrategy?.hotel?.primary||"",relationshipMode:result?.travelStrategy?.hotel?.mode||"",status:clone(status.hotel),benefits:benefitsFor(visible,HOTEL_KEYS)}
    },
    strategy:{
      airline:clone(result?.travelStrategy?.airline||{}),
      hotel:clone(result?.travelStrategy?.hotel||{}),
      primaryTransferableEcosystem:result?.rewardsStrategy?.primaryCurrency||"",
      rewardsReason:result?.rewardsStrategy?.reason||""
    },
    status,
    cards:{
      keep:keeps.filter(x=>!keepStopIds.has(x.cardId)),
      keepButStopRoutineSpend,
      removeOrDowngrade,
      manualReviewBeforeRemoval,
      recommendedNew,
      requiredByConstraint,
      consider
    },
    spendPlan:{
      ongoingRouting:clone(rec?.ongoingRouting||{}),
      protectedSpend:{guardrailEnforced:result?.integrity?.protectedMultiplierSpend===true,higherTierStops:clone(protectedStops)},
      recurringThresholds:clone(rec?.recurringJobs||[]),
      finiteInterventions:clone(rec?.temporaryJobs||[]),
      postThresholdRouting:clone(list(rec?.temporaryJobs).map(x=>({jobId:x.id||"",nextStep:x.nextStep||x.postThresholdRouting||[]})))
    },
    economics:{
      currentAnnualFees:num(rec?.feeSummary?.currentAnnualFees),
      recommendedAnnualFees:num(rec?.feeSummary?.recommendedAnnualFees),
      annualFeeSavings:num(rec?.feeSummary?.annualSavings),
      annualFeeIncrease:num(rec?.feeSummary?.annualIncrease),
      currentNetEconomicValue:currentNet,
      recommendedNetEconomicValue:recommendedNet,
      defensibleCurrentVsRecommendedDelta:Math.round((recommendedNet-currentNet)*100)/100,
      source:"engine_net_economic_value"
    },
    benefits:{
      highlightedTravelOutcomes:clone(visible.filter(x=>FLIGHT_KEYS.has(benefitKey(x))||AIRPORT_KEYS.has(benefitKey(x))||HOTEL_KEYS.has(benefitKey(x)))),
      additionalQualitativeBenefits:clone(visible.filter(x=>!FLIGHT_KEYS.has(benefitKey(x))&&!AIRPORT_KEYS.has(benefitKey(x))&&!HOTEL_KEYS.has(benefitKey(x)))),
      allVisibleBenefits:clone(visible)
    },
    companion:{
      futureIntent:profile?.companionTravel?.intent||"",
      expectedFrequency:profile?.companionTravel?.frequency||"",
      minimumExpectedRoundTrips:num(profile?.companionTravel?.minimumExpectedRoundTrips),
      annualCertificates:clone(companionState),
      southwestCompanionPass:clone(swCompanion),
      quantitativeState:(profile?.companionTravel?.intent==="yes")?"quantified_when_supported":(profile?.companionTravel?.intent==="no")?"zero_by_future_intent":"qualitative_unresolved"
    },
    implementationPlan:buildImplementationPlan(result,E,{recommendedNew,requiredByConstraint,keepButStopRoutineSpend,removeOrDowngrade,manualReviewBeforeRemoval,status}),
    quality:{
      ready:audit?.pass===true&&result?.factQuality?.productionReady===true,
      assumptions:clone(rec?.quality?.assumptions||[]),
      unresolvedFacts:clone(result?.factQuality?.missingCriticalFacts||[]),
      engineIssues:clone(rec?.quality?.issues||[]),
      manualReviewItems:clone(manualReviewBeforeRemoval),
      audit:{pass:audit?.pass===true,errors:clone(audit?.errors||[]),warnings:clone(audit?.warnings||[])}
    }
  };
}
