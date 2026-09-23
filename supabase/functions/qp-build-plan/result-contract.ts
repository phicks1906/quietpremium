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
