/** Quiet Premium V5 validation harness — 5.0-alpha.6 */
"use strict";
const E=require("./qp_sim_v5.js");
let pass=0,fail=0;const failures=[];
function assert(name,cond,detail=""){if(cond){pass++;console.log("PASS "+name);}else{fail++;failures.push({name,detail});console.error("FAIL "+name+(detail?" — "+detail:""));}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function sumRows(r,id){let x=0;for(const rows of Object.values(r||{}))for(const row of rows||[])if(row.card===id)x+=row.amount;return x;}
function base(overrides={}){return{
 asOfDate:"2026-09-17",
 spend:{dining:20000,grocery:15000,online_grocery:0,airfare:12000,hotel:10000,general:93000},
 currentCards:["amex_platinum"],
 currentRouting:{dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:93000}]},
 remainingYear:{cardSpend:{dining:8000,grocery:6000,online_grocery:0,airfare:5000,hotel:4000,general:40000},delta:{mqd:1500},hotel:{qualifyingNights:3}},
 primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,
 currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},
 primaryHotel:"marriott",primaryHotelShare:.35,currentHotelStatus:"Gold Elite",premiumStayShare:.5,
 currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95},
 legacyNaturalBenefitValue:{amex_platinum:700},
 bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"},typicalTripCashCost:2500,
 constraints:{maxNewCards:2},aspirations:["travel more"],...overrides};}

// 1. Aspirations only reorder presentation.
{
 const a=E.analyze(base({aspirations:["travel more"]}));
 const b=E.analyze(base({aspirations:["stay better"]}));
 assert("aspirations do not change recommendation",E.recommendationFingerprint(a)===E.recommendationFingerprint(b));
 assert("aspirations change presentation order",!same(a.presentation.order,b.presentation.order));
 assert("full viable opportunity set is aspiration-invariant",same(a.allMaterialOpportunities,b.allMaterialOpportunities));
 assert("aspiration isolation integrity flag",a.integrity.aspirationsUsedInRecommendationSelection===false&&a.integrity.allMaterialOpportunitiesIndependentOfAspirations===true);
}

// 2. Benefit visibility and recommendation credit are separate.
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{}}));
 const r=E.strategyRecord(p,["venture_x"],"base");
 assert("new lounge remains visible",r.visibleBenefits.some(x=>x.benefit==="lounge"));
 assert("visible lounge gets no recommendation credit without evidence",r.recommendationCredit.lounge===0);
}
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:10,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},benefitEvidence:{venture_x:{lounge:true}},legacyNaturalBenefitValue:{}}));
 const r=E.strategyRecord(p,["venture_x"],"base");
 assert("evidence can create lounge recommendation credit",r.recommendationCredit.lounge===1);
}

// 3. Detailed benefit values are deduped by benefit type.
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","venture_x"],
  currentRouting:{dining:[{card:"venture_x",amount:20000}],grocery:[{card:"venture_x",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"venture_x",amount:10000}],general:[{card:"venture_x",amount:93000}]},
  benefitValueByType:{lounge:500},cardUniqueBenefitValue:{amex_platinum:200,venture_x:100},legacyNaturalBenefitValue:{}
 }));
 const l=E.benefitLedger(p,["amex_platinum","venture_x"]);
 assert("duplicate lounge value is counted once",l.typeValue===500,JSON.stringify(l));
 assert("card-unique benefits remain additive",l.cardUniqueValue===300,JSON.stringify(l));
 assert("detailed benefit total is deduped",l.totalValue===800,JSON.stringify(l));
}

// 4. Legacy card totals surface overlap uncertainty rather than pretending exact precision.
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","venture_x"],
  currentRouting:{dining:[{card:"venture_x",amount:20000}],grocery:[{card:"venture_x",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"venture_x",amount:10000}],general:[{card:"venture_x",amount:93000}]},
  legacyNaturalBenefitValue:{amex_platinum:700,venture_x:300},benefitValueByType:{},cardUniqueBenefitValue:{}
 }));
 const r=E.currentRecord(p,"base");
 assert("legacy overlapping benefits are flagged",r.quality.issues.some(x=>x.code==="benefit_overlap_unresolved"),JSON.stringify(r.quality));
}

// 5. Card/product facts central to current engine.
assert("AA Executive fee is $695",E.RULES.cards.aa_executive.annualFee===695);
assert("CSP online grocery is 3x",E.RULES.cards.chase_preferred.earn.online_grocery===3);
assert("CSP generic grocery is 1x",E.RULES.cards.chase_preferred.earn.grocery===1);
assert("United Explorer earns 1 PQP per $20 and caps at 1000",E.RULES.cards.united_explorer.status.spendDivisor===20&&E.RULES.cards.united_explorer.status.annualCap===1000);
assert("Southwest Priority earns 2500 TQP per $5000",E.RULES.cards.southwest_priority.status.tqpPerBlock===2500&&E.RULES.cards.southwest_priority.status.spendBlock===5000);
assert("Boundless earns one elite night per $5000 spend",E.RULES.cards.marriott_boundless.hotelStatus.spendBlock===5000&&E.RULES.cards.marriott_boundless.hotelStatus.nightsPerBlock===1);
assert("Venture hotel portal bonus is 5x",E.RULES.cards.venture.bookingEarn.hotel.capital_one_travel===5);

// 6. Chase-to-Hyatt effective-date + pooling path.
{
 const old=E.normalizeProfile(base({currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-05-01"},redemptionPartner:"hyatt"}));
 const newer=E.normalizeProfile(base({currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-07-01"},redemptionPartner:"hyatt"}));
 const oct=E.normalizeProfile(base({asOfDate:"2026-10-01",currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-05-01"},redemptionPartner:"hyatt"}));
 assert("grandfathered CSP is 1:1 through Sep 30",E.transferRatio("chase_preferred","hyatt",old,false)===1);
 assert("newer CSP is 4:3",E.transferRatio("chase_preferred","hyatt",newer,false)===.75);
 assert("grandfathered CSP becomes 4:3 Oct 1",E.transferRatio("chase_preferred","hyatt",oct,false)===.75);
}
{
 const p=E.normalizeProfile(base({currentCards:["chase_preferred","chase_reserve"],cardOpenDate:{chase_preferred:"2026-07-01"},redemptionPartner:"hyatt"}));
 assert("Reserve path preserves 1:1 pooled Hyatt transfer",E.portfolioTransferFactor(p,["chase_preferred","chase_reserve"],"chase_ur")===1);
}

// 7. Grocery input is total; online grocery is a subset, not additive.
{
 const p=E.normalizeProfile(base({spend:{dining:0,grocery:30000,online_grocery:10000,airfare:0,hotel:0,general:0}}));
 assert("normalized grocery retains only in-store remainder",p.spend.grocery===20000,JSON.stringify(p.spend));
 assert("normalized online grocery keeps subset",p.spend.online_grocery===10000,JSON.stringify(p.spend));
 assert("grocery total is not double counted",p.totalSpend===30000,JSON.stringify(p.spend));
}

// 8. Gold's $25K supermarket cap is shared across in-store + online subset.
{
 const p=E.normalizeProfile(base({
  spend:{dining:0,grocery:30000,online_grocery:10000,airfare:0,hotel:0,general:0},
  currentCards:["amex_gold","venture"],currentRouting:{dining:[],grocery:[{card:"amex_gold",amount:15000},{card:"venture",amount:5000}],online_grocery:[{card:"amex_gold",amount:10000}],airfare:[],hotel:[],general:[]},
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{grocery:10000,online_grocery:5000},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{}
 }));
 const r=E.routeAnnual(p,["amex_gold","venture"],"base");
 assert("Gold shared supermarket cap receives exactly $25K",sumRows(r,"amex_gold")===25000,JSON.stringify(r));
 assert("$5K above shared cap routes to Venture",sumRows(r,"venture")===5000,JSON.stringify(r));
}

// 9. Booking method changes earn mechanics.
{
 const portal=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"chase_travel",hotel:"chase_travel"}}));
 const direct=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"}}));
 assert("CSP Chase Travel earns more than direct travel",E.strategyRecord(portal,["chase_preferred"],"base").economics.grossTravelValue>E.strategyRecord(direct,["chase_preferred"],"base").economics.grossTravelValue);
}

// 10. Platinum automatic hotel statuses are recognized.
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.6,currentHotelStatus:"",statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{hotel:1000},hotel:{qualifyingNights:0}},currentCards:["amex_platinum"]}));
 const r=E.currentRecord(p,"base");
 assert("Platinum supplies Marriott Gold baseline",r.outcomes.hotelExperience.effectiveStatus==="Gold Elite",r.outcomes.hotelExperience.effectiveStatus);
}
{
 const p=E.normalizeProfile(base({primaryHotel:"hilton",primaryHotelShare:.6,currentHotelStatus:"",statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{hotel:1000},hotel:{qualifyingNights:0}},currentCards:["amex_platinum"]}));
 const r=E.currentRecord(p,"base");
 assert("Platinum supplies Hilton Gold baseline",r.outcomes.hotelExperience.effectiveStatus==="Gold",r.outcomes.hotelExperience.effectiveStatus);
}

// 11. Co-brand additions need a concrete travel job.
{
 const r=E.analyze(base({annualOneWayFlights:2,primaryAirline:"delta",primaryAirlineShare:.8,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{airfare:1000,general:5000},delta:{mqd:0},hotel:{qualifyingNights:0}}}));
 assert("low-frequency traveler gets no Delta co-brand solely for points",!r.recommended.actions.some(x=>x.action==="add"&&["delta_platinum","delta_reserve"].includes(x.cardId)),JSON.stringify(r.recommended.actions));
}
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_gold"],currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],online_grocery:[],airfare:[{card:"amex_gold",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"amex_gold",amount:93000}]},
  statusProgress:{delta:{mqd:7500},hotel:{qualifyingNights:2}},currentAirlineStatus:"Silver Medallion",
  remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:2000,general:10000},delta:{mqd:0},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{amex_gold:200}
 }));
 assert("Delta Headstart can create a reachable co-brand job",E.reachableAirlineJob(p,"delta_reserve")===true);
 assert("candidate universe includes reachable Delta co-brand",E.candidatePortfolios(p).some(x=>x.includes("delta_reserve")));
}

// 12. Marriott Brilliant / Platinum overlap rule.
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.7,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:8}},remainingYear:{cardSpend:{hotel:3000,general:10000},hotel:{qualifyingNights:3}},currentCards:["amex_platinum"],marriottBeyondFHR:false,directMarriottNights:5}));
 assert("Brilliant is blocked with Platinum absent strong Marriott-specific use",!E.candidatePortfolios(p).some(x=>x.includes("marriott_brilliant")));
}
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.8,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:20}},remainingYear:{cardSpend:{hotel:5000,general:10000},hotel:{qualifyingNights:8}},currentCards:["amex_platinum"],marriottBeyondFHR:true,directMarriottNights:15}));
 assert("Brilliant may be evaluated with strong Marriott-specific use",E.candidatePortfolios(p).some(x=>x.includes("marriott_brilliant")));
}

// 13. Useful airline outcome cannot be traded away for unrelated gains.
{
 const p=base({
  primaryAirline:"united",primaryAirlineShare:.85,routeFit:{united:.9},annualOneWayFlights:20,currentAirlineStatus:"Premier Silver",
  statusProgress:{united:{pqp:10500,pqf:20},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{dining:2000,grocery:2000,airfare:3000,hotel:1000,general:20000},united:{pqp:500,pqf:4},hotel:{qualifyingNights:0}},
  currentCards:["united_quest","venture"],currentRouting:{dining:[{card:"venture",amount:20000}],grocery:[{card:"venture",amount:15000}],online_grocery:[],airfare:[{card:"united_quest",amount:12000}],hotel:[{card:"venture",amount:10000}],general:[{card:"venture",amount:93000}]},
  legacyNaturalBenefitValue:{united_quest:350},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:""
 });
 const np=E.normalizeProfile(p),cur=E.currentRecord(np,"base"),r=E.analyze(p);
 const ci=E.RULES.airlines.united.thresholds.findIndex(x=>x.tier===cur.outcomes.flightQuality.effectiveStatus),ri=E.RULES.airlines.united.thresholds.findIndex(x=>x.tier===r.recommended.outcomes.flightQuality.effectiveStatus);
 assert("recommended plan preserves useful United tier",ri>=ci,`${cur.outcomes.flightQuality.effectiveStatus}->${r.recommended.outcomes.flightQuality.effectiveStatus}`);
}

// 14. Incidental status must not distort recommendation when status is not useful.
{
 const p=E.normalizeProfile(base({
  annualOneWayFlights:2,primaryAirline:"delta",primaryAirlineShare:.9,currentAirlineStatus:"Gold Medallion",
  statusProgress:{delta:{mqd:10000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:10000},delta:{mqd:0},hotel:{qualifyingNights:0}},
  currentCards:["delta_reserve"],currentRouting:{dining:[{card:"delta_reserve",amount:20000}],grocery:[{card:"delta_reserve",amount:15000}],online_grocery:[],airfare:[{card:"delta_reserve",amount:12000}],hotel:[{card:"delta_reserve",amount:10000}],general:[{card:"delta_reserve",amount:93000}]},legacyNaturalBenefitValue:{}
 }));
 const without=E.strategyRecord(p,["venture"],"base"),current=E.currentRecord(p,"base"),cmp=E.materialComparison(without,current);
 assert("non-useful status loss is not scored as flight-quality regression",!cmp.regressions.includes("flightQuality"),JSON.stringify(cmp));
}

// 15. Unsupported current economics cannot manufacture a precise recommendation.
{
 const r=E.analyze(base({currentCards:["Mystery Premium Card","amex_platinum"],currentRouting:{dining:[{card:"Mystery Premium Card",amount:20000}],grocery:[{card:"Mystery Premium Card",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"Mystery Premium Card",amount:93000}]}}));
 assert("unsupported material current spend blocks precision",r.current.quality.precisionSuppressed===true);
 assert("blocked comparison preserves current setup",r.recommended.id==="current");
 assert("unsupported card receives manual review action",r.recommended.actions.find(x=>x.cardId==="Mystery Premium Card")?.action==="manual_review");
}

// 16. Missing remaining-year facts cannot manufacture status pursuit.
{
 const r=E.analyze(base({remainingYear:undefined,futureActivity:undefined,remainingYearKnown:false}));
 assert("missing remaining-year facts are flagged",r.current.quality.issues.some(x=>x.code==="remaining_year_activity_missing"));
 assert("no current-year status target is invented",!r.recommended.strategy.airlineStatusTarget);
}

// 17. Organic Southwest flight qualification beats manufactured spend.
{
 const p=base({primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,currentAirlineStatus:"",statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{dining:1000,grocery:1000,airfare:1000,general:3000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},currentCards:["southwest_priority"],currentRouting:{dining:[{card:"southwest_priority",amount:20000}],grocery:[{card:"southwest_priority",amount:15000}],online_grocery:[],airfare:[{card:"southwest_priority",amount:12000}],hotel:[{card:"southwest_priority",amount:10000}],general:[{card:"southwest_priority",amount:93000}]},legacyNaturalBenefitValue:{southwest_priority:229}});
 const r=E.analyze(p);
 assert("one remaining Southwest flight can qualify A-List",r.current.outcomes.flightQuality.effectiveStatus==="A-List"||r.recommended.outcomes.flightQuality.effectiveStatus==="A-List");
 assert("no manufactured Southwest status spend",!r.recommended.strategy.airlineStatusTarget);
}

// 18. Multiplier logic remains first-class when it materially expands travel.
{
 const p=base({spend:{dining:0,grocery:0,online_grocery:0,airfare:5000,hotel:5000,general:140000},currentCards:["amex_platinum"],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[{card:"amex_platinum",amount:5000}],hotel:[{card:"amex_platinum",amount:5000}],general:[{card:"amex_platinum",amount:140000}]},remainingYear:{cardSpend:{airfare:1000,hotel:1000,general:40000},delta:{mqd:0},hotel:{qualifyingNights:1}},primaryAirlineShare:.3,annualOneWayFlights:4,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:1},legacyNaturalBenefitValue:{amex_platinum:900}});
 const r=E.analyze(p),adds=r.recommended.actions.filter(x=>x.action==="add").map(x=>x.cardId);
 assert("2x-everywhere card can be recommended",adds.includes("venture")||adds.includes("venture_x"),adds.join(","));
}

// 19. No-change remains a valid outcome.
{
 const p=base({spend:{dining:25000,grocery:25000,online_grocery:0,airfare:10000,hotel:5000,general:35000},currentCards:["amex_gold","venture"],currentRouting:{dining:[{card:"amex_gold",amount:25000}],grocery:[{card:"amex_gold",amount:25000}],online_grocery:[],airfare:[{card:"venture",amount:10000}],hotel:[{card:"venture",amount:5000}],general:[{card:"venture",amount:35000}]},remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:1000,general:10000},hotel:{qualifyingNights:1}},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:3,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:2}},legacyNaturalBenefitValue:{amex_gold:250}});
 const r=E.analyze(p);
 assert("already-strong Gold + Venture wallet can return no change",r.recommended.id==="current",r.recommended.id);
}

// 20. Any stated status target must reconcile to its own projection.
{
 const p=base({currentCards:["delta_reserve","amex_gold"],currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],online_grocery:[],airfare:[{card:"delta_reserve",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"delta_reserve",amount:93000}]},legacyNaturalBenefitValue:{delta_reserve:650,amex_gold:200},statusProgress:{delta:{mqd:10500},hotel:{qualifyingNights:5}},currentAirlineStatus:"Gold Medallion",remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:5000,hotel:3000,general:30000},delta:{mqd:1000},hotel:{qualifyingNights:1}}});
 const r=E.analyze(p),t=r.recommended.strategy.airlineStatusTarget;
 assert("Delta target reconciles mathematically",!t||E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.projectedTier)>=E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.tier),JSON.stringify(t));
}

// 21. Opportunity output is viable, material, benefit-rich and aspiration-independent.
{
 const r=E.analyze(base());
 assert("all material opportunities carry strategy records",r.allMaterialOpportunities.every(x=>Array.isArray(x.strategies)&&x.strategies.length>0));
 assert("opportunity strategies carry visible benefits",r.allMaterialOpportunities.every(x=>x.strategies.every(y=>Array.isArray(y.visibleBenefits))));
 assert("presentation opportunity keys are only reordered, not filtered",same(r.presentation.opportunityKeys.slice().sort(),r.allMaterialOpportunities.map(x=>x.key).slice().sort()));
}

// 22. Candidate search can preserve a 5-card current wallet and still evaluate one new card.
{
 const cards=["amex_gold","amex_platinum","venture","chase_preferred","delta_reserve"];
 const p=E.normalizeProfile(base({currentCards:cards,constraints:{maxNewCards:1},legacyNaturalBenefitValue:{amex_platinum:700,delta_reserve:650}}));
 assert("candidate search supports current wallet plus one new card",E.candidatePortfolios(p).some(x=>x.length===6&&cards.every(id=>x.includes(id))));
}

// 23. Route-fit uncertainty is surfaced.
{
 const r=E.analyze(base({routeFit:{}}));
 assert("missing route fit is flagged",r.current.quality.issues.some(x=>x.code==="route_fit_not_independently_verified"));
}

// 24. Valuation sensitivity reruns the full selection process.
{
 const r=E.analyze(base());
 assert("sensitivity includes all three recommendation ids",!!r.sensitivity.recommendationIds.conservative&&!!r.sensitivity.recommendationIds.base&&!!r.sensitivity.recommendationIds.upper);
}

console.log("\n------------------------------");
console.log(`V5 alpha.6 harness: ${pass} passed, ${fail} failed`);
if(failures.length)console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;
