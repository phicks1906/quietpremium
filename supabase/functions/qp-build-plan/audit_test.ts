import {auditPlan,recurringThresholdMoveAllowance} from "./audit.ts";
import {assertEquals} from "jsr:@std/assert";

const requiredIntegrity=[
  "travelStrategyPrecedesCards","primaryFlexibleEcosystem","ongoingAndTemporaryRoutingSeparated","temporaryJobsHaveExplicitHandoffs",
  "welcomeOffersExcludedFromSelection","currentBenefitsAreBaselineNotIncrementalCredit","verifiedFactsSnapshotSupported","volatileFactsSeparatedFromDecisionRules","verifiedFactsImmutablePerAnalysis",
  "fullAirlineStatusLadder","universalNewCardBands","singleApprovedValuationSnapshot","currentApprovedValuationSnapshot","annualThresholdsAreRecurringEconomics",
  "flexibleRewardsCrossEcosystemCompared","oneActiveFlexibleEcosystemPerPortfolio","replacementFeeSavingsExcludedFromNewCardHurdle",
  "futureCompanionTravelIntake","oneUseCompanionCertificatesCapped","companionCertificateDemandDeduped"
];
const E:any={
  CURRENT_QP_VALUATION_SNAPSHOT:{snapshotId:"v1"},
  MODEL:{newCardRecommendedMin:350,newCardConsiderMin:200},
  cardFacts:(_p:any,id:string)=>id==="united_quest"?{kind:"airline",currency:"united_miles",annualFee:0}:{kind:"flex",currency:"amex_mr",annualFee:0},
  classifyNewCardValue:(x:number)=>x>=350?"recommended":x>=200?"consider":"do_not_surface"
};
function baseResult(){
  const integrity:any={newCardRecommendedMin:350,newCardConsiderMin:200};for(const k of requiredIntegrity)integrity[k]=true;
  return{
    factQuality:{productionReady:true,valuation:{productionReady:true}},
    factsSnapshot:{snapshotId:"s1"},
    valuationSnapshot:{snapshotId:"v1"},
    profile:{valuationSnapshot:{snapshotId:"v1"},constraints:{requiredCards:[]},companionTravel:{intent:"no"},totalSpend:4000},
    current:{factsSnapshotId:"s1"},
    rewardsStrategy:{primaryCurrency:""},
    recommended:{
      factsSnapshotId:"s1",portfolio:["united_quest"],cardRoles:[{cardId:"united_quest",role:"travel_benefit"}],
      ongoingRouting:{general:[{card:"united_quest",amount:4000}]},
      recurringJobs:[{id:"annual_threshold:united_quest:award_discount_10k",type:"annual_threshold",recurring:true,cardId:"united_quest",annualSpendRequired:20000,spendRequired:6000,stopCondition:{resetsAnnually:true},nextStep:[],moves:[{category:"general",amount:4000,toCard:"united_quest",from:[{card:"amex_gold",amount:4000}]}]}],
      temporaryJobs:[],actions:[],economics:{portfolioRecurringBenefits:{companion:{totalValue:0}}},strategy:{southwestCompanionPass:{benefit:{totalValue:0}},airlineStatusLadder:{rows:[],selected:null}}
    },
    newCardClassifications:[],considerCards:[],integrity
  };
}
Deno.test("recurring threshold move allowance de-duplicates identical job moves",()=>{
  const rec:any=baseResult().recommended;
  rec.recurringJobs.push({...rec.recurringJobs[0],id:"duplicate"});
  assertEquals(recurringThresholdMoveAllowance(rec)["united_quest|general"],4000);
});
Deno.test("audit allows co-brand category spend exactly traced to recurring threshold move",()=>{
  const result:any=baseResult();
  const audit=auditPlan(result,E);
  assertEquals(audit.errors.filter((x:any)=>x.code==="airline_cobrand_wrong_routine_category"),[]);
});
Deno.test("audit still blocks unexplained non-airfare airline co-brand spend",()=>{
  const result:any=baseResult();result.recommended.recurringJobs=[];
  const audit=auditPlan(result,E);
  assertEquals(audit.errors.some((x:any)=>x.code==="airline_cobrand_wrong_routine_category"),true);
});
