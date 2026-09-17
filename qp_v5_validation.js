/** Quiet Premium V5 validation harness — 5.0-alpha.5 */
"use strict";
const E=require("./qp_sim_v5.js");
let pass=0,fail=0;const failures=[];
function assert(name,cond,detail=""){if(cond){pass++;console.log("PASS "+name);}else{fail++;failures.push({name,detail});console.error("FAIL "+name+(detail?" — "+detail:""));}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function base(overrides={}){return{
 asOfDate:"2026-09-17",
 spend:{dining:20000,grocery:15000,online_grocery:0,airfare:12000,hotel:10000,general:93000},
 currentCards:["amex_platinum"],
 currentRouting:{dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:93000}]},
 remainingYear:{cardSpend:{dining:8000,grocery:6000,online_grocery:0,airfare:5000,hotel:4000,general:40000},delta:{mqd:1500},hotel:{qualifyingNights:3}},
 primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,
 currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},
 primaryHotel:"marriott",primaryHotelShare:.35,currentHotelStatus:"Gold Elite",premiumStayShare:.5,
 currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95},naturalBenefitValue:{amex_platinum:700},
 bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"},typicalTripCashCost:2500,
 constraints:{maxNewCards:2},aspirations:["travel more"],...overrides};}

// Locked separation: aspirations may reorder output but cannot alter analysis.
{
 const a=E.analyze(base({aspirations:["travel more"]}));
 const b=E.analyze(base({aspirations:["stay better"]}));
 assert("aspirations never change recommendation",E.recommendationFingerprint(a)===E.recommendationFingerprint(b));
 assert("aspirations only change presentation order",!same(a.presentation.order,b.presentation.order));
 assert("full opportunity set is aspiration-invariant",same(a.allMaterialOpportunities,b.allMaterialOpportunities));
 assert("integrity flag confirms aspiration isolation",a.integrity.aspirationsUsedInRecommendationSelection===false&&a.integrity.allMaterialOpportunitiesIndependentOfAspirations===true);
}

// Benefit visibility is not recommendation credit.
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}}}));
 const r=E.strategyRecord(p,["venture_x"],"base");
 assert("new lounge benefit remains visible",r.visibleBenefits.some(x=>x.benefit==="lounge"));
 assert("visible lounge gets zero recommendation credit without explicit use evidence",r.recommendationCredit.lounge===0);
}
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:10,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},explicitBenefitUse:{venture_x:{lounge:true}}}));
 const r=E.strategyRecord(p,["venture_x"],"base");
 assert("explicit lounge use can earn recommendation credit",r.recommendationCredit.lounge===1);
}

// Current facts verified in alpha.5 registry.
assert("AA Executive fee is $695",E.RULES.cards.aa_executive.annualFee===695);
assert("CSP online grocery is 3x",E.RULES.cards.chase_preferred.earn.online_grocery===3);
assert("CSP ordinary grocery is 1x",E.RULES.cards.chase_preferred.earn.grocery===1);
assert("CSP annual fee is $95",E.RULES.cards.chase_preferred.annualFee===95);
assert("United Explorer earns 1 PQP per $20 with 1000 cap",E.RULES.cards.united_explorer.status.spendDivisor===20&&E.RULES.cards.united_explorer.status.annualCap===1000);
assert("Southwest Priority earns 2500 TQP per $5000",E.RULES.cards.southwest_priority.status.tqpPerBlock===2500&&E.RULES.cards.southwest_priority.status.spendBlock===5000);
assert("Boundless earns one elite night per $5000 spend",E.RULES.cards.marriott_boundless.hotelStatus.spendBlock===5000&&E.RULES.cards.marriott_boundless.hotelStatus.nightsPerBlock===1);

// Effective-dated Chase-to-Hyatt logic.
{
 const old=E.normalizeProfile(base({currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-05-01"},redemptionPartner:"hyatt"}));
 const newer=E.normalizeProfile(base({currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-07-01"},redemptionPartner:"hyatt"}));
 const oct=E.normalizeProfile(base({asOfDate:"2026-10-01",currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-05-01"},redemptionPartner:"hyatt"}));
 assert("pre-Jun-15 CSP is 1:1 to Hyatt through Sep 30",E.transferRatio("chase_preferred","hyatt",old,false)===1);
 assert("post-Jun-15 CSP is 4:3 to Hyatt immediately",E.transferRatio("chase_preferred","hyatt",newer,false)===.75);
 assert("grandfathered CSP becomes 4:3 on Oct 1",E.transferRatio("chase_preferred","hyatt",oct,false)===.75);
}
{
 const p=E.normalizeProfile(base({currentCards:["chase_preferred","chase_reserve"],cardOpenDate:{chase_preferred:"2026-07-01"},redemptionPartner:"hyatt"}));
 assert("Reserve path preserves 1:1 Hyatt transfer for pooled UR",E.portfolioTransferFactor(p,["chase_preferred","chase_reserve"],"chase_ur")===1);
}

// Shared-category cap behavior: online + ordinary supermarket spend share Gold's supermarket cap.
{
 const p=E.normalizeProfile(base({
  spend:{dining:0,grocery:20000,online_grocery:10000,airfare:0,hotel:0,general:0},
  currentCards:["amex_gold","venture"],currentRouting:{dining:[],grocery:[{card:"amex_gold",amount:15000},{card:"venture",amount:5000}],online_grocery:[{card:"amex_gold",amount:10000}],airfare:[],hotel:[],general:[]},
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{grocery:5000,online_grocery:5000},hotel:{qualifyingNights:0}}
 }));
 const r=E.routeAnnual(p,["amex_gold","venture"],"base");
 const gold=sumRows(r,"amex_gold"),venture=sumRows(r,"venture");
 assert("Gold supermarket cap is shared across grocery and online grocery",gold===25000,JSON.stringify(r));
 assert("spend above shared supermarket cap flows to next-best card",venture===5000,JSON.stringify(r));
}
function sumRows(r,id){let x=0;for(const rows of Object.values(r))for(const row of rows||[])if(row.card===id)x+=row.amount;return x;}

// Booking method affects earn mechanics but does not alter user aspirations.
{
 const p=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"chase_travel",hotel:"chase_travel"}}));
 const direct=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"}}));
 const portal=E.strategyRecord(p,["chase_preferred"],"base").economics.grossTravelValue;
 const ordinary=E.strategyRecord(direct,["chase_preferred"],"base").economics.grossTravelValue;
 assert("CSP Chase Travel booking earns more than direct travel",portal>ordinary,`${ordinary}->${portal}`);
}

// Co-brand cards must have a concrete job, not just points earning.
{
 const r=E.analyze(base({annualOneWayFlights:2,primaryAirline:"delta",primaryAirlineShare:.8,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{airfare:1000,general:5000},delta:{mqd:0},hotel:{qualifyingNights:0}}}));
 assert("low-frequency traveler gets no Delta co-brand solely for points",!r.recommended.actions.some(x=>x.action==="add"&&["delta_platinum","delta_reserve"].includes(x.cardId)),JSON.stringify(r.recommended.actions));
}
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_gold"],currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],online_grocery:[],airfare:[{card:"amex_gold",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"amex_gold",amount:93000}]},
  statusProgress:{delta:{mqd:7500},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:2000,general:15000},delta:{mqd:0},hotel:{qualifyingNights:0}},currentAirlineStatus:"Silver Medallion",naturalBenefitValue:{amex_gold:200}
 }));
 const sets=E.candidatePortfolios(p);
 assert("reachable Delta status can create a legitimate co-brand job",sets.some(x=>x.includes("delta_reserve")||x.includes("delta_platinum")));
}

// Marriott Brilliant / Platinum overlap lock.
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.7,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:8}},remainingYear:{cardSpend:{hotel:3000,general:10000},hotel:{qualifyingNights:3}},currentCards:["amex_platinum"],marriottBeyondFHR:false,directMarriottNights:5}));
 const sets=E.candidatePortfolios(p);
 assert("Brilliant is blocked with Platinum absent strong ordinary Marriott use",!sets.some(x=>x.includes("marriott_brilliant")));
}
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.8,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:20}},remainingYear:{cardSpend:{hotel:5000,general:10000},hotel:{qualifyingNights:8}},currentCards:["amex_platinum"],marriottBeyondFHR:true,directMarriottNights:15}));
 const sets=E.candidatePortfolios(p);
 assert("Brilliant can be evaluated when Marriott-specific use independently supports it",sets.some(x=>x.includes("marriott_brilliant")));
}

// Existing useful travel outcomes cannot be traded away for unrelated wins.
{
 const p=base({
  primaryAirline:"united",primaryAirlineShare:.85,routeFit:{united:.9},annualOneWayFlights:20,currentAirlineStatus:"Premier Silver",
  statusProgress:{united:{pqp:10500,pqf:20},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{dining:2000,grocery:2000,airfare:3000,hotel:1000,general:20000},united:{pqp:500,pqf:4},hotel:{qualifyingNights:0}},
  currentCards:["united_quest","venture"],currentRouting:{dining:[{card:"venture",amount:20000}],grocery:[{card:"venture",amount:15000}],online_grocery:[],airfare:[{card:"united_quest",amount:12000}],hotel:[{card:"venture",amount:10000}],general:[{card:"venture",amount:93000}]},
  naturalBenefitValue:{united_quest:350},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:""
 });
 const np=E.normalizeProfile(p),current=E.currentRecord(np,"base"),r=E.analyze(p);
 const ci=E.RULES.airlines.united.thresholds.findIndex(x=>x.tier===current.outcomes.flightQuality.effectiveStatus),ri=E.RULES.airlines.united.thresholds.findIndex(x=>x.tier===r.recommended.outcomes.flightQuality.effectiveStatus);
 assert("recommended plan never regresses useful United status",ri>=ci,`${current.outcomes.flightQuality.effectiveStatus}->${r.recommended.outcomes.flightQuality.effectiveStatus}`);
}

// Unsupported material spend blocks fake precision; unsupported current card is not told to close.
{
 const p=base({currentCards:["Mystery Premium Card","amex_platinum"],currentRouting:{dining:[{card:"Mystery Premium Card",amount:20000}],grocery:[{card:"Mystery Premium Card",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"Mystery Premium Card",amount:93000}]}});
 const r=E.analyze(p);
 assert("unsupported material spend blocks precision",r.current.quality.precisionSuppressed===true);
 assert("blocked comparison returns current setup",r.recommended.id==="current");
 assert("unsupported current card is manual review",r.recommended.actions.find(x=>x.cardId==="Mystery Premium Card")?.action==="manual_review");
}

// Missing remaining-year facts must not manufacture a status plan.
{
 const r=E.analyze(base({remainingYear:undefined,futureActivity:undefined,remainingYearKnown:false}));
 assert("missing remaining-year activity is flagged",r.current.quality.issues.some(x=>x.code==="remaining_year_activity_missing"));
 assert("no status target is invented",!r.recommended.strategy.airlineStatusTarget);
}

// Organic Southwest flight path beats manufactured card spend.
{
 const p=base({primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,currentAirlineStatus:"",statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{dining:1000,grocery:1000,airfare:1000,general:3000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},currentCards:["southwest_priority"],currentRouting:{dining:[{card:"southwest_priority",amount:20000}],grocery:[{card:"southwest_priority",amount:15000}],online_grocery:[],airfare:[{card:"southwest_priority",amount:12000}],hotel:[{card:"southwest_priority",amount:10000}],general:[{card:"southwest_priority",amount:93000}]},naturalBenefitValue:{southwest_priority:229}});
 const r=E.analyze(p);
 assert("remaining flight can organically qualify A-List",r.current.outcomes.flightQuality.effectiveStatus==="A-List"||r.recommended.outcomes.flightQuality.effectiveStatus==="A-List");
 assert("engine does not manufacture Southwest status spend",!r.recommended.strategy.airlineStatusTarget);
}

// General-spend multiplier remains a first-class travel mechanism.
{
 const p=base({spend:{dining:0,grocery:0,online_grocery:0,airfare:5000,hotel:5000,general:140000},currentCards:["amex_platinum"],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[{card:"amex_platinum",amount:5000}],hotel:[{card:"amex_platinum",amount:5000}],general:[{card:"amex_platinum",amount:140000}]},remainingYear:{cardSpend:{airfare:1000,hotel:1000,general:40000},delta:{mqd:0},hotel:{qualifyingNights:1}},primaryAirlineShare:.3,annualOneWayFlights:4,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:1},naturalBenefitValue:{amex_platinum:900}});
 const r=E.analyze(p),adds=r.recommended.actions.filter(x=>x.action==="add").map(x=>x.cardId);
 assert("2x-everywhere card can be recommended when it materially expands travel",adds.includes("venture")||adds.includes("venture_x"),adds.join(","));
}

// Strong existing setup can correctly return no change.
{
 const p=base({spend:{dining:25000,grocery:25000,online_grocery:0,airfare:10000,hotel:5000,general:35000},currentCards:["amex_gold","venture"],currentRouting:{dining:[{card:"amex_gold",amount:25000}],grocery:[{card:"amex_gold",amount:25000}],online_grocery:[],airfare:[{card:"venture",amount:10000}],hotel:[{card:"venture",amount:5000}],general:[{card:"venture",amount:35000}]},remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:1000,general:10000},hotel:{qualifyingNights:1}},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:3,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:2}},naturalBenefitValue:{amex_gold:250}});
 const r=E.analyze(p);
 assert("already-strong Gold + Venture wallet can return no change",r.recommended.id==="current",r.recommended.id);
}

// Reported status + exact remaining-year routing must reconcile with any target.
{
 const p=base({currentCards:["delta_reserve","amex_gold"],currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],online_grocery:[],airfare:[{card:"delta_reserve",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"delta_reserve",amount:93000}]},naturalBenefitValue:{delta_reserve:650,amex_gold:200},statusProgress:{delta:{mqd:10500},hotel:{qualifyingNights:5}},currentAirlineStatus:"Gold Medallion",remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:5000,hotel:3000,general:30000},delta:{mqd:1000},hotel:{qualifyingNights:1}}});
 const r=E.analyze(p),t=r.recommended.strategy.airlineStatusTarget;
 assert("stated Delta target mathematically reconciles",!t||E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.projectedTier)>=E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.tier));
}

// This catches the next alpha issue if a new Delta card's fixed Headstart is ignored when deciding reachability.
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_gold"],currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],online_grocery:[],airfare:[{card:"amex_gold",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"amex_gold",amount:93000}]},
  statusProgress:{delta:{mqd:7500},hotel:{qualifyingNights:2}},currentAirlineStatus:"Silver Medallion",
  remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:2000,general:10000},delta:{mqd:0},hotel:{qualifyingNights:0}},naturalBenefitValue:{amex_gold:200}
 }));
 const sets=E.candidatePortfolios(p);
 assert("new Delta card reachability recognizes fixed MQD Headstart",sets.some(x=>x.includes("delta_reserve")),"Delta Reserve missing from candidate sets");
}

assert("sensitivity reruns complete recommendation under each valuation scenario",(()=>{const r=E.analyze(base());return!!r.sensitivity.recommendationIds.conservative&&!!r.sensitivity.recommendationIds.base&&!!r.sensitivity.recommendationIds.upper;})());

console.log("\n------------------------------");
console.log(`V5 alpha.5 harness: ${pass} passed, ${fail} failed`);
if(failures.length)console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;
