import { stageOneEntities, finalEntities, ALL_ACQUISITION_FLEX_CARDS } from "./core.ts";
import { buildResultContract, RESULT_CONTRACT_SCHEMA } from "./result-contract.ts";
import { auditPlan } from "./audit.ts";

function assert(condition,message){if(!condition)throw new Error(message)}

Deno.test("core preserves an already-normalized V5 profile",()=>{
  const profile={
    __normalizedV5:true,
    currentCards:["amex_platinum"],
    constraints:{requiredCards:[],prohibitedCards:[]},
    airline:{primary:"delta"},
    hotel:{primary:"marriott"}
  };
  const E={
    normalizeProfile:()=>{throw new Error("normalized profile was normalized again")},
    travelStrategy:p=>({airline:{primary:p.airline.primary},hotel:{primary:p.hotel.primary}}),
    rewardsStrategy:()=>({primaryCurrency:"amex_mr"})
  };
  const stage1=stageOneEntities(profile,E);
  const final=finalEntities(profile,E).request;
  assert(stage1.airlines.includes("delta")&&stage1.hotels.includes("marriott"),"stage-one normalized airline/hotel lost");
  assert(final.airlines.includes("delta")&&final.hotels.includes("marriott"),"final normalized airline/hotel lost");
});

Deno.test("final verification spans every supported flexible acquisition ecosystem",()=>{
  const profile={__normalizedV5:true,currentCards:["amex_platinum"],constraints:{requiredCards:[],prohibitedCards:[]},airline:{primary:"delta"},hotel:{primary:"marriott"}};
  const E={
    normalizeProfile:x=>x,
    travelStrategy:()=>({airline:{primary:"delta"},hotel:{primary:"marriott"}}),
    rewardsStrategy:()=>({primaryCurrency:"amex_mr"})
  };
  const out=finalEntities(profile,E).request.cards;
  for(const id of ALL_ACQUISITION_FLEX_CARDS)assert(out.includes(id),"missing flexible acquisition candidate "+id);
  assert(out.includes("delta_blue")&&out.includes("delta_reserve"),"missing relevant airline family");
  assert(out.includes("marriott_bold")&&out.includes("marriott_brilliant"),"missing relevant hotel family");
  assert(!out.includes("chase_freedom_rise"),"existing-only card entered acquisition universe");
});

Deno.test("results contract separates Recommended, Consider, and required-by-constraint cards without changing engine output",()=>{
  const result={
    engineVersion:"5.0-alpha.31",rulesAsOf:"2026-09-22",
    factsSnapshot:{snapshotId:"facts-1"},valuationSnapshot:{snapshotId:"valuation-1"},factQuality:{productionReady:true,missingCriticalFacts:[]},
    profile:{constraints:{requiredCards:["required_card"]},companionTravel:{intent:"not_sure",frequency:"",minimumExpectedRoundTrips:0}},
    travelStrategy:{airline:{primary:"delta",mode:"primary_with_exceptions"},hotel:{primary:"marriott",mode:"chain_default"}},
    rewardsStrategy:{primaryCurrency:"amex_mr",reason:"delta_travel_strategy"},
    newCardClassifications:[
      {cardId:"recommended_card",classification:"recommended",incrementalRecurringValue:410},
      {cardId:"consider_card",classification:"consider",incrementalRecurringValue:250},
      {cardId:"required_card",classification:"do_not_surface",incrementalRecurringValue:40}
    ],
    considerCards:[{cardId:"consider_card",classification:"consider",incrementalRecurringValue:250,bestWithId:"with",bestWithoutId:"without"}],
    current:{economics:{netEconomicValue:1000}},
    integrity:{protectedMultiplierSpend:true},
    recommended:{
      portfolio:["old_benefit_card","recommended_card","required_card"],
      ongoingRouting:{general:[{card:"recommended_card",amount:10000}]},
      recurringJobs:[],temporaryJobs:[],
      actions:[
        {cardId:"old_benefit_card",action:"keep",role:"travel_benefit"},
        {cardId:"recommended_card",action:"add",role:"ongoing_rewards"},
        {cardId:"required_card",action:"add",role:"ongoing_rewards"},
        {cardId:"old_remove_card",action:"manual_review_before_removal",role:"manual_review"}
      ],
      strategy:{airlineStatusLadder:{airline:"delta",rows:[],selected:null,benefitFactsComplete:true},airlineStatusTarget:null,hotelStatusTarget:null,southwestCompanionPass:null},
      travelActions:{airline:{primary:"delta",effectiveNaturalStatus:"Gold Medallion"},hotel:{primary:"marriott",effectiveNaturalStatus:"Gold Elite"}},
      outcomes:{travelCapacity:{annualTravelValue:2200},hotelExperience:{effectiveStatus:"Gold Elite"}},
      recommendationCredit:{lounge:1,premiumHotel:1,priorityAirport:0,upgradePriority:0},
      visibleBenefits:[],
      feeSummary:{currentAnnualFees:900,recommendedAnnualFees:700,annualSavings:200,annualIncrease:0},
      economics:{netEconomicValue:1500,portfolioRecurringBenefits:{companion:{totalValue:0,uses:0,demand:0,byCard:{},unresolved:[],intent:"not_sure"}}},
      quality:{issues:[]}
    }
  };
  const before=JSON.stringify(result);
  const E={cardFacts:(_p,id)=>({label:id,kind:"flex",annualFee:95})};
  const contract=buildResultContract(result,E,{pass:true,errors:[],warnings:[]});
  assert(contract.meta.schema===RESULT_CONTRACT_SCHEMA,"wrong result schema");
  assert(contract.cards.recommendedNew.length===1&&contract.cards.recommendedNew[0].cardId==="recommended_card","recommended card not isolated");
  assert(contract.cards.consider.length===1&&contract.cards.consider[0].cardId==="consider_card","consider card not isolated");
  assert(contract.cards.requiredByConstraint.length===1&&contract.cards.requiredByConstraint[0].cardId==="required_card","required card mislabeled as recommendation");
  assert(contract.cards.keepButStopRoutineSpend.some(x=>x.cardId==="old_benefit_card"),"benefit-only card should stop routine spend");
  assert(contract.companion.quantitativeState==="qualitative_unresolved","not-sure companion intent should stay qualitative");
  assert(contract.spendPlan.protectedSpend.guardrailEnforced===true,"protected multiplier-spend guardrail not carried into contract");
  assert(contract.quality.ready===true,"ready contract not marked ready");
  assert(JSON.stringify(result)===before,"presentation adapter mutated engine result");
});

Deno.test("status stopping point and higher-tier reasons come directly from engine ladder",()=>{
  const result={
    engineVersion:"5.0-alpha.31",rulesAsOf:"2026-09-22",factsSnapshot:{snapshotId:"f"},valuationSnapshot:{snapshotId:"v"},factQuality:{productionReady:true,missingCriticalFacts:[]},
    profile:{constraints:{requiredCards:[]},companionTravel:{intent:"no",frequency:"",minimumExpectedRoundTrips:0}},
    travelStrategy:{airline:{primary:"delta",mode:"primary_with_exceptions"},hotel:{primary:"",mode:"flexible"}},rewardsStrategy:{primaryCurrency:"amex_mr"},
    newCardClassifications:[],considerCards:[],current:{economics:{netEconomicValue:0}},integrity:{protectedMultiplierSpend:true},
    recommended:{
      portfolio:[],ongoingRouting:{},recurringJobs:[],temporaryJobs:[],actions:[],visibleBenefits:[],recommendationCredit:{},
      feeSummary:{currentAnnualFees:0,recommendedAnnualFees:0,annualSavings:0,annualIncrease:0},
      economics:{netEconomicValue:0,portfolioRecurringBenefits:{companion:{totalValue:0,intent:"no"}}},
      travelActions:{airline:{primary:"delta",effectiveNaturalStatus:"Gold Medallion"},hotel:{}},
      outcomes:{travelCapacity:{},hotelExperience:{}},
      strategy:{airlineStatusTarget:{tier:"Platinum Medallion"},hotelStatusTarget:null,southwestCompanionPass:null,airlineStatusLadder:{airline:"delta",benefitFactsComplete:true,selected:{tier:"Platinum Medallion"},rows:[
        {tier:"Gold Medallion",selected:false,stopReason:"lower_tier"},
        {tier:"Platinum Medallion",selected:true,stopReason:"incremental_value_supports_tier"},
        {tier:"Diamond Medallion",selected:false,reachable:true,stopReason:"incremental_quantified_value_below_opportunity_cost"}
      ]}},
      quality:{issues:[]}
    }
  };
  const contract=buildResultContract(result,{cardFacts:()=>({})},{pass:true,errors:[],warnings:[]});
  assert(contract.status.airline.stoppingPoint==="Platinum Medallion","wrong stopping point");
  assert(contract.status.airline.whyNotHigher.length===1&&contract.status.airline.whyNotHigher[0].tier==="Diamond Medallion","higher-tier reason missing");
});

Deno.test("pre-output audit fails closed on a non-approved valuation snapshot",()=>{
  const integrityKeys=[
    "travelStrategyPrecedesCards","primaryFlexibleEcosystem","ongoingAndTemporaryRoutingSeparated","temporaryJobsHaveExplicitHandoffs",
    "welcomeOffersExcludedFromSelection","currentBenefitsAreBaselineNotIncrementalCredit","verifiedFactsSnapshotSupported","volatileFactsSeparatedFromDecisionRules","verifiedFactsImmutablePerAnalysis",
    "fullAirlineStatusLadder","universalNewCardBands","singleApprovedValuationSnapshot","currentApprovedValuationSnapshot","annualThresholdsAreRecurringEconomics",
    "flexibleRewardsCrossEcosystemCompared","oneActiveFlexibleEcosystemPerPortfolio","replacementFeeSavingsExcludedFromNewCardHurdle",
    "futureCompanionTravelIntake","oneUseCompanionCertificatesCapped","companionCertificateDemandDeduped"
  ];
  const integrity=Object.fromEntries(integrityKeys.map(k=>[k,true]));
  integrity.newCardRecommendedMin=350;integrity.newCardConsiderMin=200;
  const result={
    factQuality:{productionReady:true,valuation:{productionReady:true}},
    factsSnapshot:{snapshotId:"facts"},valuationSnapshot:{snapshotId:"tampered"},
    profile:{valuationSnapshot:{snapshotId:"tampered"},constraints:{requiredCards:[]},companionTravel:{intent:"no"},totalSpend:0},
    current:{factsSnapshotId:"facts"},recommended:{factsSnapshotId:"facts",portfolio:[],ongoingRouting:{},cardRoles:[],recurringJobs:[],temporaryJobs:[],actions:[],strategy:{airlineStatusLadder:{rows:[],selected:null}},economics:{portfolioRecurringBenefits:{companion:{totalValue:0}}}},
    rewardsStrategy:{primaryCurrency:"amex_mr"},newCardClassifications:[],considerCards:[],integrity
  };
  const E={
    CURRENT_QP_VALUATION_SNAPSHOT:{snapshotId:"approved"},
    MODEL:{newCardRecommendedMin:350,newCardConsiderMin:200},
    classifyNewCardValue:v=>v>=350?"recommended":v>=200?"consider":"do_not_surface",
    cardFacts:()=>null
  };
  const audit=auditPlan(result,E);
  assert(audit.pass===false,"tampered valuation snapshot passed audit");
  assert(audit.errors.some(x=>x.code==="valuation_snapshot_not_current_approved"),"valuation snapshot failure not identified");
});


Deno.test("implementation plan uses engine actions and never promotes Consider cards",()=>{
  const result={
    engineVersion:"5.0-alpha.31",rulesAsOf:"2026-09-22",
    factsSnapshot:{snapshotId:"f"},valuationSnapshot:{snapshotId:"v"},factQuality:{productionReady:true,missingCriticalFacts:[]},
    profile:{constraints:{requiredCards:[]},companionTravel:{intent:"no",frequency:"",minimumExpectedRoundTrips:0}},
    travelStrategy:{airline:{primary:"delta",mode:"primary_with_exceptions"},hotel:{primary:"",mode:"flexible"}},
    rewardsStrategy:{primaryCurrency:"amex_mr",reason:""},
    newCardClassifications:[
      {cardId:"new_card",classification:"recommended",incrementalRecurringValue:400},
      {cardId:"consider_card",classification:"consider",incrementalRecurringValue:250}
    ],
    considerCards:[{cardId:"consider_card",classification:"consider",incrementalRecurringValue:250}],
    current:{economics:{netEconomicValue:0}},integrity:{protectedMultiplierSpend:true},
    recommended:{
      portfolio:["new_card"],ongoingRouting:{dining:[{card:"new_card",amount:12000}]},
      recurringJobs:[{id:"annual_threshold:new_card:cert",type:"annual_threshold",recurring:true,cardId:"new_card",purpose:"cert",annualSpendRequired:15000,spendRequired:7000,modeledValue:300,routingOpportunityCost:50,stopCondition:{type:"annual_card_spend",amount:15000,benefit:"cert",resetsAnnually:true},nextStep:[{category:"general",card:"new_card"}]}],
      temporaryJobs:[{id:"airline_status:delta:platinum",type:"airline_status",cardId:"new_card",purpose:"platinum",spendRequired:5000,opportunityCost:75,stopCondition:{type:"airline_status",program:"delta",tier:"platinum"},nextStep:[{category:"general",card:"new_card"}]}],
      actions:[{cardId:"new_card",action:"add",role:"ongoing_rewards"}],
      strategy:{airlineStatusLadder:{airline:"delta",rows:[{tier:"platinum",selected:true,stopReason:"selected"},{tier:"diamond",selected:false,stopReason:"protected_spend_required"}],selected:{tier:"platinum"},benefitFactsComplete:true},airlineStatusTarget:{tier:"platinum"},hotelStatusTarget:null,southwestCompanionPass:null},
      travelActions:{airline:{primary:"delta",effectiveNaturalStatus:"gold"},hotel:{}},
      outcomes:{travelCapacity:{},hotelExperience:{}},recommendationCredit:{},visibleBenefits:[],
      feeSummary:{currentAnnualFees:0,recommendedAnnualFees:95,annualSavings:0,annualIncrease:95},
      economics:{netEconomicValue:400,portfolioRecurringBenefits:{companion:{totalValue:0,intent:"no"}}},quality:{issues:[]}
    }
  };
  const E={cardFacts:(_p,id)=>({label:id==="new_card"?"Recommended Card":"Consider Card",kind:"flex",annualFee:95})};
  const c=buildResultContract(result,E,{pass:true,errors:[],warnings:[]});
  const actions=c.implementationPlan.phases.flatMap(p=>p.actions);
  assert(actions.some(x=>x.type==="card_add"&&x.cardId==="new_card"),"recommended add missing from implementation plan");
  assert(actions.some(x=>x.type==="recurring_threshold"&&x.annualSpendRequired===15000),"recurring threshold missing");
  assert(actions.some(x=>x.type==="finite_intervention"&&x.spendRequired===5000),"finite intervention missing");
  assert(actions.some(x=>x.type==="status_stop"&&x.tier==="diamond"),"status stop missing");
  assert(!actions.some(x=>x.cardId==="consider_card"),"Consider card leaked into implementation plan");
  assert(c.implementationPlan.excludesConsiderCards===true,"Consider exclusion not explicit");
});

Deno.test("implementation plan does not invent a threshold when the engine has none",()=>{
  const result={
    engineVersion:"5.0-alpha.31",rulesAsOf:"2026-09-22",
    factsSnapshot:{snapshotId:"f"},valuationSnapshot:{snapshotId:"v"},factQuality:{productionReady:true,missingCriticalFacts:[]},
    profile:{constraints:{requiredCards:[]},companionTravel:{intent:"no",frequency:"",minimumExpectedRoundTrips:0}},
    travelStrategy:{airline:{primary:"",mode:"flexible"},hotel:{primary:"",mode:"flexible"}},rewardsStrategy:{primaryCurrency:"amex_mr"},
    newCardClassifications:[],considerCards:[],current:{economics:{netEconomicValue:0}},integrity:{protectedMultiplierSpend:true},
    recommended:{
      portfolio:[],ongoingRouting:{},recurringJobs:[],temporaryJobs:[],actions:[],visibleBenefits:[],recommendationCredit:{},
      feeSummary:{currentAnnualFees:0,recommendedAnnualFees:0,annualSavings:0,annualIncrease:0},
      economics:{netEconomicValue:0,portfolioRecurringBenefits:{companion:{totalValue:0,intent:"no"}}},
      travelActions:{airline:{},hotel:{}},outcomes:{travelCapacity:{},hotelExperience:{}},
      strategy:{airlineStatusTarget:null,hotelStatusTarget:null,southwestCompanionPass:null,airlineStatusLadder:{airline:"",benefitFactsComplete:true,selected:null,rows:[]}},
      quality:{issues:[]}
    }
  };
  const c=buildResultContract(result,{cardFacts:()=>({})},{pass:true,errors:[],warnings:[]});
  const middle=c.implementationPlan.phases.find(p=>p.id==="days_31_60");
  assert(middle.actions.length===1&&middle.actions[0].type==="no_change","empty threshold phase manufactured work");
  assert(middle.actions[0].title.includes("No status or spend threshold intervention"),"no-change conclusion missing");
});


Deno.test("implementation plan groups routine routing by card and uses human category labels",()=>{
  const result={
    engineVersion:"5.0-alpha.32",rulesAsOf:"2026-09-23",factsSnapshot:{snapshotId:"f"},valuationSnapshot:{snapshotId:"v"},
    factQuality:{productionReady:true,missingCriticalFacts:[]},profile:{constraints:{requiredCards:[]},companionTravel:{intent:"no",frequency:"",minimumExpectedRoundTrips:0}},
    travelStrategy:{airline:{primary:"",mode:"flexible"},hotel:{primary:"",mode:"flexible"}},rewardsStrategy:{primaryCurrency:"chase_ur"},newCardClassifications:[],considerCards:[],
    current:{economics:{netEconomicValue:0}},
    recommended:{portfolio:["chase_reserve"],ongoingRouting:{dining:[{card:"chase_reserve",amount:24000}],gas_ev:[{card:"chase_reserve",amount:6000}],general:[{card:"chase_reserve",amount:90000}]},recurringJobs:[],temporaryJobs:[],actions:[],visibleBenefits:[],recommendationCredit:{},feeSummary:{currentAnnualFees:0,recommendedAnnualFees:795,annualSavings:0,annualIncrease:795},economics:{netEconomicValue:1000,portfolioRecurringBenefits:{companion:{totalValue:0,intent:"no"}}},travelActions:{airline:{},hotel:{}},outcomes:{travelCapacity:{},hotelExperience:{}},strategy:{airlineStatusTarget:null,hotelStatusTarget:null,southwestCompanionPass:null,airlineStatusLadder:{airline:"",benefitFactsComplete:true,selected:null,rows:[]}},quality:{issues:[]}}
  };
  const E={cardFacts:()=>({label:"Chase Sapphire Reserve",kind:"flex",annualFee:795,currency:"chase_ur"})};
  const out=buildResultContract(result,E,{pass:true,errors:[],warnings:[]});
  const routes=out.implementationPlan.phases.flatMap(p=>p.actions).filter(x=>x.type==="routing");
  assert(routes.length===1,"routine routing should be grouped into one action per card");
  assert(routes[0].title.includes("Dining")&&routes[0].title.includes("Gas & EV charging")&&routes[0].title.includes("Everything else"),"grouped routing is not human-readable");
});

Deno.test("natural recurring threshold is disclosed without manufacturing an intervention",()=>{
  const result={
    engineVersion:"5.0-alpha.32",rulesAsOf:"2026-09-23",factsSnapshot:{snapshotId:"f"},valuationSnapshot:{snapshotId:"v"},
    factQuality:{productionReady:true,missingCriticalFacts:[]},profile:{constraints:{requiredCards:[]},companionTravel:{intent:"no",frequency:"",minimumExpectedRoundTrips:0}},
    travelStrategy:{airline:{primary:"",mode:"flexible"},hotel:{primary:"",mode:"flexible"}},rewardsStrategy:{primaryCurrency:"chase_ur"},newCardClassifications:[],considerCards:[],
    current:{economics:{netEconomicValue:0}},
    recommended:{portfolio:["chase_reserve"],ongoingRouting:{general:[{card:"chase_reserve",amount:90000}]},recurringJobs:[{id:"annual_threshold:chase_reserve:southwest_chase_travel_credit_500",type:"annual_threshold",recurring:true,cardId:"chase_reserve",purpose:"southwest_chase_travel_credit_500",annualSpendRequired:75000,spendRequired:75000,modeledValue:500,routingOpportunityCost:0,opportunityCost:0,stopCondition:{type:"annual_card_spend",amount:75000,benefit:"southwest_chase_travel_credit_500",resetsAnnually:true},moves:[]}],temporaryJobs:[],actions:[],visibleBenefits:[],recommendationCredit:{},feeSummary:{currentAnnualFees:0,recommendedAnnualFees:795,annualSavings:0,annualIncrease:795},economics:{netEconomicValue:1000,portfolioRecurringBenefits:{companion:{totalValue:0,intent:"no"}}},travelActions:{airline:{},hotel:{}},outcomes:{travelCapacity:{},hotelExperience:{}},strategy:{airlineStatusTarget:null,hotelStatusTarget:null,southwestCompanionPass:null,airlineStatusLadder:{airline:"",benefitFactsComplete:true,selected:null,rows:[]}},quality:{issues:[]}}
  };
  const E={cardFacts:()=>({label:"Chase Sapphire Reserve",kind:"flex",annualFee:795,currency:"chase_ur"})};
  const out=buildResultContract(result,E,{pass:true,errors:[],warnings:[]});
  const threshold=out.implementationPlan.phases.flatMap(p=>p.actions).find(x=>x.type==="recurring_threshold");
  assert(threshold.naturalThroughOngoingRouting===true,"natural threshold was mislabeled as an intervention");
  assert(threshold.title.includes("normal routing naturally clears"),"natural threshold title is not customer-facing");
  assert(threshold.purposeLabel==="$500 Southwest Airlines Chase Travel credit","raw threshold identifier leaked into customer label");
});


Deno.test("unverified route fit produces conditional higher-tier guidance",()=>{
  const result={
    engineVersion:"5.0-alpha.46",rulesAsOf:"2026-09-23",
    factsSnapshot:{snapshotId:"f"},valuationSnapshot:{snapshotId:"v"},
    factQuality:{productionReady:true,missingCriticalFacts:[]},
    profile:{constraints:{requiredCards:[]},companionTravel:{intent:"no",frequency:"",minimumExpectedRoundTrips:0}},
    travelStrategy:{airline:{primary:"delta",mode:"existing_relationship_route_unverified"},hotel:{primary:"",mode:"flexible"}},
    rewardsStrategy:{primaryCurrency:"amex_mr"},newCardClassifications:[],considerCards:[],
    current:{economics:{netEconomicValue:0}},integrity:{protectedMultiplierSpend:true},
    recommended:{
      portfolio:[],ongoingRouting:{},recurringJobs:[],temporaryJobs:[],actions:[],visibleBenefits:[],recommendationCredit:{},
      feeSummary:{currentAnnualFees:0,recommendedAnnualFees:0,annualSavings:0,annualIncrease:0},
      economics:{netEconomicValue:0,portfolioRecurringBenefits:{companion:{totalValue:0,intent:"no"}}},
      travelActions:{airline:{primary:"delta",effectiveNaturalStatus:"Gold Medallion"},hotel:{}},
      outcomes:{travelCapacity:{},hotelExperience:{}},quality:{issues:[]},
      strategy:{airlineStatusTarget:null,hotelStatusTarget:null,southwestCompanionPass:null,airlineStatusLadder:{
        airline:"delta",benefitFactsComplete:true,
        selected:{tier:"Gold Medallion"},
        rows:[
          {tier:"Gold Medallion",selected:true,reachable:true,stopReason:"preserve_currently_achievable_tier"},
          {tier:"Platinum Medallion",selected:false,reachable:false,stopReason:"route_fit_unverified"},
          {tier:"Diamond Medallion",selected:false,reachable:false,stopReason:"route_fit_unverified"}
        ]
      }}
    }
  };
  const out=buildResultContract(result,{cardFacts:()=>({})},{pass:true,errors:[],warnings:[]});
  const stops=out.implementationPlan.phases.flatMap(p=>p.actions).filter(x=>x.type==="status_stop");
  assert(stops.length===2,"route-fit status stops missing");
  assert(stops.every(x=>x.title.startsWith("Verify route fit before considering an additional push toward ")),"unverified route fit leaked a do-not-chase directive");
  assert(!stops.some(x=>x.title.startsWith("Do not chase")),"missing route evidence became a definitive status judgment");
});
