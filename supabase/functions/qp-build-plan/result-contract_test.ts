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
