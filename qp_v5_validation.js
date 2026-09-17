/** Quiet Premium V5 validation harness — 5.0-alpha.7 */
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
 currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95,hyatt_points:1},legacyNaturalBenefitValue:{amex_platinum:700},
 bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"},typicalTripCashCost:2500,
 constraints:{maxNewCards:2},aspirations:["travel more"],...overrides};}

// Aspirations are presentation-only and never narrow the opportunity set.
{
 const a=E.analyze(base({aspirations:["travel more"]}));
 const b=E.analyze(base({aspirations:["stay better"]}));
 assert("aspirations do not change recommendation",E.recommendationFingerprint(a)===E.recommendationFingerprint(b));
 assert("aspirations change presentation order",!same(a.presentation.order,b.presentation.order));
 assert("all material opportunities are aspiration-invariant",same(a.allMaterialOpportunities,b.allMaterialOpportunities));
 assert("aspiration isolation integrity flag",a.integrity.aspirationsUsedInRecommendationSelection===false&&a.integrity.allMaterialOpportunitiesIndependentOfAspirations===true);
}

// Every real benefit stays visible; recommendation credit requires separate evidence.
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{}}));
 const r=E.strategyRecord(p,["venture_x"],"base");
 assert("Venture X lounge stays visible",r.visibleBenefits.some(x=>x.benefit==="lounge"));
 assert("visible lounge receives zero recommendation credit without evidence",r.recommendationCredit.lounge===0);
}
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:10,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},benefitEvidence:{venture_x:{lounge_access:true}},legacyNaturalBenefitValue:{}}));
 assert("explicit use evidence can create lounge recommendation credit",E.strategyRecord(p,["venture_x"],"base").recommendationCredit.lounge===1);
}

// Canonical benefit dedupe: Priority Pass and generic lounge access are the same internal value bucket, while display stays specific.
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","marriott_brilliant"],
  currentRouting:{dining:[{card:"marriott_brilliant",amount:20000}],grocery:[{card:"marriott_brilliant",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"marriott_brilliant",amount:10000}],general:[{card:"marriott_brilliant",amount:93000}]},
  benefitValueByType:{lounge:500},cardUniqueBenefitValue:{amex_platinum:200,marriott_brilliant:300},legacyNaturalBenefitValue:{}
 }));
 const l=E.benefitLedger(p,["amex_platinum","marriott_brilliant"]);
 assert("canonical lounge value counted once across Platinum + Brilliant",l.typeValue===500,JSON.stringify(l));
 assert("card-unique benefits remain additive",l.cardUniqueValue===500,JSON.stringify(l));
 assert("specific benefit display is preserved",l.visible.some(x=>x.benefit==="lounge")&&l.visible.some(x=>x.benefit==="priority_pass"));
}
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","marriott_brilliant"],
  currentRouting:{dining:[{card:"marriott_brilliant",amount:20000}],grocery:[{card:"marriott_brilliant",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"marriott_brilliant",amount:10000}],general:[{card:"marriott_brilliant",amount:93000}]},
  legacyNaturalBenefitValue:{amex_platinum:700,marriott_brilliant:650},benefitValueByType:{},cardUniqueBenefitValue:{}
 }));
 assert("legacy Platinum + Brilliant overlap is flagged",E.currentRecord(p,"base").quality.issues.some(x=>x.code==="benefit_overlap_unresolved"));
}

// Current rules central to v5.
assert("AA Executive fee is $695",E.RULES.cards.aa_executive.annualFee===695);
assert("CSP online grocery is 3x and generic grocery 1x",E.RULES.cards.chase_preferred.earn.online_grocery===3&&E.RULES.cards.chase_preferred.earn.grocery===1);
assert("United dual-path requirements are stored",E.RULES.airlines.united.thresholds[1].pqpOnly===12000&&E.RULES.airlines.united.thresholds[1].pqpWithPQF===10000&&E.RULES.airlines.united.thresholds[1].pqf===30);
assert("United four-segment minimum is stored",E.RULES.airlines.united.minimumUnitedSegments===4);
assert("Southwest Priority earns 2500 TQP per $5000",E.RULES.cards.southwest_priority.status.tqpPerBlock===2500&&E.RULES.cards.southwest_priority.status.spendBlock===5000);
assert("Boundless earns one elite night per $5000 spend",E.RULES.cards.marriott_boundless.hotelStatus.spendBlock===5000&&E.RULES.cards.marriott_boundless.hotelStatus.nightsPerBlock===1);

// Grocery total/subset semantics apply to annual and remaining-period spend.
{
 const p=E.normalizeProfile(base({
  spend:{dining:0,grocery:30000,online_grocery:10000,airfare:0,hotel:0,general:0},
  remainingYear:{cardSpend:{grocery:12000,online_grocery:4000},hotel:{qualifyingNights:0}}
 }));
 assert("annual grocery total is split without double counting",p.spend.grocery===20000&&p.spend.online_grocery===10000&&p.totalSpend===30000,JSON.stringify(p.spend));
 assert("remaining grocery total is split without double counting",p.remainingYear.cardSpend.grocery===8000&&p.remainingYear.cardSpend.online_grocery===4000,JSON.stringify(p.remainingYear.cardSpend));
}

// Shared Gold supermarket cap across online + in-store supermarket spend.
{
 const p=E.normalizeProfile(base({
  spend:{dining:0,grocery:30000,online_grocery:10000,airfare:0,hotel:0,general:0},
  currentCards:["amex_gold","venture"],currentRouting:{dining:[],grocery:[{card:"amex_gold",amount:15000},{card:"venture",amount:5000}],online_grocery:[{card:"amex_gold",amount:10000}],airfare:[],hotel:[],general:[]},
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{grocery:10000,online_grocery:5000},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{}
 }));
 const r=E.routeAnnual(p,["amex_gold","venture"],"base");
 assert("Gold receives exactly $25K across shared supermarket cap",sumRows(r,"amex_gold")===25000,JSON.stringify(r));
 assert("excess supermarket spend routes to next-best card",sumRows(r,"venture")===5000,JSON.stringify(r));
}

// Booking method drives earning.
{
 const portal=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"chase_travel",hotel:"chase_travel"}}));
 const direct=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"}}));
 assert("CSP Chase Travel routing earns more than direct travel",E.strategyRecord(portal,["chase_preferred"],"base").economics.grossTravelValue>E.strategyRecord(direct,["chase_preferred"],"base").economics.grossTravelValue);
}

// Chase Hyatt transfer valuation uses the destination currency, not generic UR value.
{
 const p=E.normalizeProfile(base({currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-07-01"},redemptionPartner:"hyatt",currencyUtility:{chase_ur:1,hyatt_points:1}}));
 assert("post-Jun-15 CSP transfer ratio is 4:3",E.transferRatio("chase_preferred","hyatt",p,false)===.75);
 assert("CSP Hyatt redemption value uses .75 Hyatt point value",Math.abs(E.currencyPointValue(p,"chase_ur","base",["chase_preferred"])-(.75*E.VALUATIONS.base.hyatt_points))<1e-9);
}
{
 const p=E.normalizeProfile(base({currentCards:["chase_preferred","chase_reserve"],cardOpenDate:{chase_preferred:"2026-07-01"},redemptionPartner:"hyatt",currencyUtility:{chase_ur:1,hyatt_points:1}}));
 assert("Reserve provides 1:1 pooled Hyatt path",E.portfolioTransferRatio(p,["chase_preferred","chase_reserve"],"chase_ur")===1);
 assert("pooled UR uses full Hyatt point value",Math.abs(E.currencyPointValue(p,"chase_ur","base",["chase_preferred","chase_reserve"])-E.VALUATIONS.base.hyatt_points)<1e-9);
}

// Platinum automatic hotel statuses are recognized while status only affects recommendation when useful.
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.6,currentHotelStatus:"",statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{hotel:1000},hotel:{qualifyingNights:0}},currentCards:["amex_platinum"]}));
 assert("Platinum supplies Marriott Gold baseline",E.currentRecord(p,"base").outcomes.hotelExperience.effectiveStatus==="Gold Elite");
}
{
 const p=E.normalizeProfile(base({annualOneWayFlights:2,primaryAirline:"delta",primaryAirlineShare:.9,currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:10000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:10000},delta:{mqd:0},hotel:{qualifyingNights:0}},currentCards:["delta_reserve"],currentRouting:{dining:[{card:"delta_reserve",amount:20000}],grocery:[{card:"delta_reserve",amount:15000}],online_grocery:[],airfare:[{card:"delta_reserve",amount:12000}],hotel:[{card:"delta_reserve",amount:10000}],general:[{card:"delta_reserve",amount:93000}]},legacyNaturalBenefitValue:{}}));
 const cmp=E.materialComparison(E.strategyRecord(p,["venture"],"base"),E.currentRecord(p,"base"));
 assert("non-useful status loss is not scored as flight-quality regression",!cmp.regressions.includes("flightQuality"),JSON.stringify(cmp));
}

// Delta fixed Headstart can create a real reachable co-brand status job.
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_gold"],currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],online_grocery:[],airfare:[{card:"amex_gold",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"amex_gold",amount:93000}]},
  statusProgress:{delta:{mqd:7500},hotel:{qualifyingNights:2}},currentAirlineStatus:"Silver Medallion",
  remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:2000,general:10000},delta:{mqd:0},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{amex_gold:200}
 }));
 assert("Delta Headstart creates reachable Reserve job",E.reachableAirlineJob(p,"delta_reserve")===true);
}

// United must support both PQP-only and PQF+PQP paths plus the 4 United-segment minimum.
{
 const p=E.normalizeProfile(base({
  primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.9},annualOneWayFlights:32,currentAirlineStatus:"Premier Silver",
  statusProgress:{united:{pqp:9000,pqf:28,unitedSegments:4},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{general:10000},united:{pqp:1000,pqf:2,unitedSegments:1},hotel:{qualifyingNights:0}},
  currentCards:["venture"],currentRouting:{dining:[{card:"venture",amount:20000}],grocery:[{card:"venture",amount:15000}],online_grocery:[],airfare:[{card:"venture",amount:12000}],hotel:[{card:"venture",amount:10000}],general:[{card:"venture",amount:93000}]},primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{}
 }));
 const proj=E.airlineProjection(p,"united",Object.fromEntries(["dining","grocery","online_grocery","airfare","hotel","general"].map(x=>[x,[]])),[]);
 assert("United 30 PQF + 10K PQP path reaches Gold",proj.tier==="Premier Gold",JSON.stringify(proj));
}
{
 const p=E.normalizeProfile(base({
  primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.9},annualOneWayFlights:32,currentAirlineStatus:"",
  statusProgress:{united:{pqp:12000,pqf:30,unitedSegments:2},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{general:0},united:{pqp:0,pqf:0,unitedSegments:1},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0
 }));
 const proj=E.airlineProjection(p,"united",Object.fromEntries(["dining","grocery","online_grocery","airfare","hotel","general"].map(x=>[x,[]])),[]);
 assert("United status is not projected without four United-operated segments",proj.tier==="",JSON.stringify(proj));
}
{
 const p=E.normalizeProfile(base({
  primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.9},annualOneWayFlights:20,
  statusProgress:{united:{pqp:5000,pqf:10},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{general:10000},united:{pqp:500,pqf:3},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0
 }));
 assert("missing United-operated segment count blocks precise status modeling",E.airlineQualificationDataReady(p,"united",[])===false);
 assert("missing United segments are surfaced in data quality",E.currentRecord(p,"base").quality.issues.some(x=>x.code==="united_operated_segments_missing"));
}

// Existing United card cap consumption requires card-specific PQP progress.
{
 const p=E.normalizeProfile(base({
  primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.9},annualOneWayFlights:20,
  currentCards:["united_explorer"],statusProgress:{united:{pqp:5000,pqf:15,unitedSegments:4},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{general:20000},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0
 }));
 assert("missing United card PQP progress blocks status precision",E.airlineQualificationDataReady(p,"united",["united_explorer"])===false);
}
{
 const p=E.normalizeProfile(base({
  primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.9},annualOneWayFlights:20,
  currentCards:["united_explorer"],statusProgress:{united:{pqp:5000,pqf:15,unitedSegments:4},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{general:20000},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},
  cardStatusProgressYTD:{united_explorer:{pqp:800}},primaryHotel:"",primaryHotelShare:0
 }));
 assert("known United card PQP progress restores status readiness",E.airlineQualificationDataReady(p,"united",["united_explorer"])===true);
}

// American uses its Mar-Feb qualification horizon rather than calendar-year spend.
{
 const p=E.normalizeProfile(base({
  primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.9},annualOneWayFlights:20,
  currentAirlineStatus:"AAdvantage Platinum",statusProgress:{american:{loyaltyPoints:110000},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{general:10000},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0
 }));
 assert("American status modeling is blocked without Mar-Feb qualification input",E.airlineQualificationDataReady(p,"american",[])===false);
 assert("American missing qualification horizon is surfaced",E.currentRecord(p,"base").quality.issues.some(x=>x.code==="american_qualification_activity_missing"));
}
{
 const p=E.normalizeProfile(base({
  primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.9},annualOneWayFlights:20,
  currentAirlineStatus:"AAdvantage Platinum",statusProgress:{american:{loyaltyPoints:110000},hotel:{qualifyingNights:0}},
  americanQualification:{cardSpend:{general:20000},loyaltyPoints:5000},primaryHotel:"",primaryHotelShare:0,
  currentCards:["aa_executive"],currentRouting:{dining:[{card:"aa_executive",amount:20000}],grocery:[{card:"aa_executive",amount:15000}],online_grocery:[],airfare:[{card:"aa_executive",amount:12000}],hotel:[{card:"aa_executive",amount:10000}],general:[{card:"aa_executive",amount:93000}]},legacyNaturalBenefitValue:{aa_executive:700}
 }));
 assert("American status modeling uses explicit qualification-period data",E.airlineQualificationDataReady(p,"american",["aa_executive"])===true);
 const r=E.strategyRecord(p,["aa_executive"],"base"),t=r.strategy.airlineStatusTarget;
 assert("American target, if stated, reconciles to projected tier",!t||E.RULES.airlines.american.thresholds.findIndex(x=>x.tier===t.projectedTier)>=E.RULES.airlines.american.thresholds.findIndex(x=>x.tier===t.tier),JSON.stringify(t));
}

// Organic Southwest flight qualification beats manufactured spend.
{
 const p=base({primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,currentAirlineStatus:"",statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{dining:1000,grocery:1000,airfare:1000,general:3000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},currentCards:["southwest_priority"],currentRouting:{dining:[{card:"southwest_priority",amount:20000}],grocery:[{card:"southwest_priority",amount:15000}],online_grocery:[],airfare:[{card:"southwest_priority",amount:12000}],hotel:[{card:"southwest_priority",amount:10000}],general:[{card:"southwest_priority",amount:93000}]},legacyNaturalBenefitValue:{southwest_priority:229}});
 const r=E.analyze(p);
 assert("remaining Southwest flight can qualify A-List",r.current.outcomes.flightQuality.effectiveStatus==="A-List"||r.recommended.outcomes.flightQuality.effectiveStatus==="A-List");
 assert("Southwest qualification does not manufacture spend",!r.recommended.strategy.airlineStatusTarget);
}

// Marriott Brilliant / Platinum overlap remains locked.
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.7,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:8}},remainingYear:{cardSpend:{hotel:3000,general:10000},hotel:{qualifyingNights:3}},currentCards:["amex_platinum"],marriottBeyondFHR:false,directMarriottNights:5}));
 assert("Brilliant blocked beside Platinum absent strong Marriott-specific use",!E.candidatePortfolios(p).some(x=>x.includes("marriott_brilliant")));
}
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.8,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:20}},remainingYear:{cardSpend:{hotel:5000,general:10000},hotel:{qualifyingNights:8}},currentCards:["amex_platinum"],marriottBeyondFHR:true,directMarriottNights:15}));
 assert("Brilliant can be evaluated with strong Marriott-specific use",E.candidatePortfolios(p).some(x=>x.includes("marriott_brilliant")));
}

// Unsupported material current spend blocks fake precision.
{
 const r=E.analyze(base({currentCards:["Mystery Premium Card","amex_platinum"],currentRouting:{dining:[{card:"Mystery Premium Card",amount:20000}],grocery:[{card:"Mystery Premium Card",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"Mystery Premium Card",amount:93000}]}}));
 assert("unsupported material spend blocks precision",r.current.quality.precisionSuppressed===true);
 assert("blocked comparison keeps current setup",r.recommended.id==="current");
 assert("unsupported current card is manual review",r.recommended.actions.find(x=>x.cardId==="Mystery Premium Card")?.action==="manual_review");
}

// 2x general-spend card remains a valid travel mechanism; no-change also remains valid.
{
 const p=base({spend:{dining:0,grocery:0,online_grocery:0,airfare:5000,hotel:5000,general:140000},currentCards:["amex_platinum"],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[{card:"amex_platinum",amount:5000}],hotel:[{card:"amex_platinum",amount:5000}],general:[{card:"amex_platinum",amount:140000}]},remainingYear:{cardSpend:{airfare:1000,hotel:1000,general:40000},delta:{mqd:0},hotel:{qualifyingNights:1}},primaryAirlineShare:.3,annualOneWayFlights:4,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:1},legacyNaturalBenefitValue:{amex_platinum:900}});
 const adds=E.analyze(p).recommended.actions.filter(x=>x.action==="add").map(x=>x.cardId);
 assert("2x-everywhere card can be recommended",adds.includes("venture")||adds.includes("venture_x"),adds.join(","));
}
{
 const p=base({spend:{dining:25000,grocery:25000,online_grocery:0,airfare:10000,hotel:5000,general:35000},currentCards:["amex_gold","venture"],currentRouting:{dining:[{card:"amex_gold",amount:25000}],grocery:[{card:"amex_gold",amount:25000}],online_grocery:[],airfare:[{card:"venture",amount:10000}],hotel:[{card:"venture",amount:5000}],general:[{card:"venture",amount:35000}]},remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:1000,general:10000},hotel:{qualifyingNights:1}},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:3,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:2}},legacyNaturalBenefitValue:{amex_gold:250}});
 assert("already-strong Gold + Venture wallet can return no change",E.analyze(p).recommended.id==="current");
}

// Route-fit uncertainty stays visible and sensitivity reruns full selection.
{
 const r=E.analyze(base({routeFit:{}}));
 assert("missing route fit is flagged",r.current.quality.issues.some(x=>x.code==="route_fit_not_independently_verified"));
 assert("sensitivity exposes all three scenario recommendations",!!r.sensitivity.recommendationIds.conservative&&!!r.sensitivity.recommendationIds.base&&!!r.sensitivity.recommendationIds.upper);
}

console.log("\n------------------------------");
console.log(`V5 alpha.7 harness: ${pass} passed, ${fail} failed`);
if(failures.length)console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;
