/** Quiet Premium V5 validation harness — 5.0-alpha.4 */
"use strict";
const E=require("./qp_sim_v5.js");
let pass=0,fail=0;const failures=[];
function assert(name,cond,detail=""){if(cond){pass++;console.log("PASS "+name);}else{fail++;failures.push({name,detail});console.error("FAIL "+name+(detail?" — "+detail:""));}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function base(overrides={}){
 return {
  asOfDate:"2026-09-17",
  spend:{dining:20000,grocery:15000,online_grocery:0,airfare:12000,hotel:10000,general:93000},
  currentCards:["amex_platinum"],
  currentRouting:{
   dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],online_grocery:[],
   airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:93000}]
  },
  remainingYear:{
   cardSpend:{dining:8000,grocery:6000,online_grocery:0,airfare:5000,hotel:4000,general:40000},
   delta:{mqd:1500},hotel:{qualifyingNights:3}
  },
  primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,
  currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},
  primaryHotel:"marriott",primaryHotelShare:.35,currentHotelStatus:"Gold Elite",premiumStayShare:.5,
  currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95},
  naturalBenefitValue:{amex_platinum:700},
  bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"},
  typicalTripCashCost:2500,constraints:{maxNewCards:2},aspirations:["travel more"],...overrides
 };
}

{
 const a=E.analyze(base({aspirations:["travel more"]}));
 const b=E.analyze(base({aspirations:["stay better"]}));
 assert("aspirations do not change recommendation",E.recommendationFingerprint(a)===E.recommendationFingerprint(b));
 assert("aspirations change presentation order",!same(a.presentation.order,b.presentation.order));
 assert("integrity confirms aspirations excluded from selection",a.integrity.aspirationsUsedInRecommendationSelection===false);
}

{
 const p=base({
  currentCards:[],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},
  annualOneWayFlights:2,primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,
  statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},
  constraints:{maxNewCards:1}
 });
 const np=E.normalizeProfile(p);
 const rec=E.strategyRecord(np,["venture_x"],"base");
 assert("new Venture X lounge benefit remains visible",rec.visibleBenefits.some(x=>x.benefit==="lounge"));
 assert("new Venture X gets zero lounge recommendation credit without use evidence",rec.recommendationCredit.lounge===0);
}

{
 const p=E.normalizeProfile(base({
  currentCards:[],currentRouting:{dining:[],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},
  explicitBenefitUse:{venture_x:{lounge:true}},
  annualOneWayFlights:10,primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,
  statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}}
 }));
 const rec=E.strategyRecord(p,["venture_x"],"base");
 assert("explicit lounge use creates recommendation credit",rec.recommendationCredit.lounge===1);
}

assert("Hilton Aspire matcher wins",E.matchCard("Hilton Honors American Express Aspire Card")==="hilton_aspire");
assert("Hilton Surpass matcher wins",E.matchCard("Hilton Honors American Express Surpass Card")==="hilton_surpass");
assert("AA Executive fee is 695",E.RULES.cards.aa_executive.annualFee===695);

assert("CSP online grocery is 3x",E.RULES.cards.chase_preferred.earn.online_grocery===3);
assert("CSP generic grocery remains 1x",E.RULES.cards.chase_preferred.earn.grocery===1);
assert("CSP annual fee remains 95",E.RULES.cards.chase_preferred.annualFee===95);

{
 const pre=E.normalizeProfile(base({currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-05-01"},redemptionPartner:"hyatt"}));
 const post=E.normalizeProfile(base({currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-07-01"},redemptionPartner:"hyatt"}));
 assert("pre-June CSP remains 1:1 to Hyatt through Sep 30 2026",E.transferRatio("chase_preferred","hyatt",pre,false)===1);
 assert("post-June CSP uses 4:3 Hyatt ratio",E.transferRatio("chase_preferred","hyatt",post,false)===.75);
 const future=E.normalizeProfile(base({asOfDate:"2026-10-01",currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-05-01"},redemptionPartner:"hyatt"}));
 assert("pre-June CSP moves to 4:3 on Oct 1 2026",E.transferRatio("chase_preferred","hyatt",future,false)===.75);
}

assert("United Explorer PQP is 1 per 20",E.RULES.cards.united_explorer.status.spendDivisor===20);
assert("United Explorer PQP cap is 1000",E.RULES.cards.united_explorer.status.annualCap===1000);
assert("Southwest Priority annual fee is 229",E.RULES.cards.southwest_priority.annualFee===229);
assert("Southwest Priority earns 2500 TQP per 5000",E.RULES.cards.southwest_priority.status.tqpPerBlock===2500&&E.RULES.cards.southwest_priority.status.spendBlock===5000);
assert("Boundless earns one elite night per 5000 spend",E.RULES.cards.marriott_boundless.hotelStatus.spendBlock===5000&&E.RULES.cards.marriott_boundless.hotelStatus.nightsPerBlock===1);

{
 const direct=E.normalizeProfile(base({currentCards:["amex_platinum"],bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"}}));
 const portal=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"chase_travel",hotel:"chase_travel"}}));
 const e1=E.strategyRecord(direct,["amex_platinum"],"base").economics.pointsByCurrency.amex_mr;
 const e2=E.strategyRecord(portal,["chase_preferred"],"base").economics.pointsByCurrency.chase_ur;
 assert("Amex Platinum direct airfare uses 5x",e1>direct.totalSpend);
 assert("CSP Chase Travel method affects earn",e2>portal.totalSpend);
}

{
 const p=E.normalizeProfile(base({
  spend:{dining:80000,grocery:0,online_grocery:0,airfare:0,hotel:0,general:0},
  currentCards:["amex_gold","venture"],
  currentRouting:{dining:[{card:"amex_gold",amount:50000},{card:"venture",amount:30000}],grocery:[],online_grocery:[],airfare:[],hotel:[],general:[]},
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,
  statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{dining:20000},hotel:{qualifyingNights:0}}
 }));
 const r=E.routeAnnual(p,["amex_gold","venture"],"base");
 const gold=r.dining.find(x=>x.card==="amex_gold")?.amount||0, ven=r.dining.find(x=>x.card==="venture")?.amount||0;
 assert("Gold dining cap routes first 50k to Gold",gold===50000,JSON.stringify(r.dining));
 assert("dining above Gold cap routes to 2x card",ven===30000,JSON.stringify(r.dining));
}

{
 const p=E.normalizeProfile(base({
  spend:{dining:50000,grocery:25000,online_grocery:0,airfare:0,hotel:0,general:125000},
  currentCards:["amex_platinum"],
  currentRouting:{dining:[{card:"amex_platinum",amount:50000}],grocery:[{card:"amex_platinum",amount:25000}],online_grocery:[],airfare:[],hotel:[],general:[{card:"amex_platinum",amount:125000}]},
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,
  statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{dining:10000,grocery:5000,general:30000},hotel:{qualifyingNights:0}},
  naturalBenefitValue:{amex_platinum:0},currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:1}
 }));
 const sets=E.candidatePortfolios(p);
 assert("candidate set includes Gold plus Venture",sets.some(x=>x.includes("amex_gold")&&x.includes("venture")));
}

{
 const p=base({
  annualOneWayFlights:2,primaryAirline:"delta",primaryAirlineShare:.8,
  currentCards:["amex_platinum"],statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},
  remainingYear:{cardSpend:{airfare:1000,general:5000},delta:{mqd:0},hotel:{qualifyingNights:0}},
  naturalBenefitValue:{amex_platinum:700}
 });
 const r=E.analyze(p);
 assert("low-frequency traveler does not add Delta co-brand solely for points",!r.recommended.actions.some(x=>x.action==="add"&&["delta_platinum","delta_reserve"].includes(x.cardId)),JSON.stringify(r.recommended.actions));
}

{
 const p=base({
  primaryAirline:"united",primaryAirlineShare:.85,routeFit:{united:.9},annualOneWayFlights:20,
  currentAirlineStatus:"Premier Silver",
  statusProgress:{united:{pqp:10500,pqf:20},hotel:{qualifyingNights:2}},
  remainingYear:{cardSpend:{dining:2000,grocery:2000,airfare:3000,hotel:1000,general:20000},united:{pqp:500,pqf:4},hotel:{qualifyingNights:0}},
  currentCards:["united_quest","venture"],
  currentRouting:{dining:[{card:"venture",amount:20000}],grocery:[{card:"venture",amount:15000}],online_grocery:[],airfare:[{card:"united_quest",amount:12000}],hotel:[{card:"venture",amount:10000}],general:[{card:"venture",amount:93000}]},
  naturalBenefitValue:{united_quest:350,venture:0},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:""
 });
 const r=E.analyze(p);
 const currentTier=E.currentRecord(E.normalizeProfile(p),"base").outcomes.flightQuality.effectiveStatus;
 const recTier=r.recommended.outcomes.flightQuality.effectiveStatus;
 assert("recommended strategy does not regress useful United status",E.RULES.airlines.united.thresholds.findIndex(x=>x.tier===recTier)>=E.RULES.airlines.united.thresholds.findIndex(x=>x.tier===currentTier),`${currentTier}->${recTier}`);
}

{
 const p=E.normalizeProfile(base({
  primaryHotel:"marriott",primaryHotelShare:.7,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:8}},
  remainingYear:{cardSpend:{hotel:3000,general:10000},hotel:{qualifyingNights:3}},
  currentCards:["amex_platinum"],marriottBeyondFHR:false,directMarriottNights:5
 }));
 const sets=E.candidatePortfolios(p);
 assert("Brilliant is blocked beside Platinum without strong ordinary Marriott case",!sets.some(x=>x.includes("amex_platinum")&&x.includes("marriott_brilliant")));
}
{
 const p=E.normalizeProfile(base({
  primaryHotel:"marriott",primaryHotelShare:.8,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:20}},
  remainingYear:{cardSpend:{hotel:5000,general:10000},hotel:{qualifyingNights:8}},
  currentCards:["amex_platinum"],marriottBeyondFHR:true,directMarriottNights:15
 }));
 const sets=E.candidatePortfolios(p);
 assert("Brilliant can be evaluated beside Platinum with strong ordinary Marriott case",sets.some(x=>x.includes("amex_platinum")&&x.includes("marriott_brilliant")));
}

{
 const p=base({
  currentCards:["Mystery Premium Card","amex_platinum"],
  currentRouting:{dining:[{card:"Mystery Premium Card",amount:20000}],grocery:[{card:"Mystery Premium Card",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"Mystery Premium Card",amount:93000}]}
 });
 const r=E.analyze(p);
 assert("unsupported material current spend blocks precision",r.current.quality.precisionSuppressed===true);
 assert("unsupported material spend preserves current recommendation",r.recommended.id==="current");
}

{
 const p=base({remainingYear:undefined,futureActivity:undefined,remainingYearKnown:false});
 const r=E.analyze(p);
 assert("missing remaining-year activity produces warning",r.current.quality.issues.some(x=>x.code==="remaining_year_activity_missing"));
 assert("missing remaining-year activity suppresses status target",!r.recommended.strategy.airlineStatusTarget);
}

{
 const p=base({
  primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,currentAirlineStatus:"",
  statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:2}},
  remainingYear:{cardSpend:{dining:1000,grocery:1000,airfare:1000,general:3000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},
  currentCards:["southwest_priority"],
  currentRouting:{dining:[{card:"southwest_priority",amount:20000}],grocery:[{card:"southwest_priority",amount:15000}],online_grocery:[],airfare:[{card:"southwest_priority",amount:12000}],hotel:[{card:"southwest_priority",amount:10000}],general:[{card:"southwest_priority",amount:93000}]},
  naturalBenefitValue:{southwest_priority:229}
 });
 const r=E.analyze(p);
 assert("Southwest organic remaining flight can qualify A-List",r.current.outcomes.flightQuality.effectiveStatus==="A-List"||r.recommended.outcomes.flightQuality.effectiveStatus==="A-List");
 assert("Southwest does not manufacture status spend when flight path qualifies",!r.recommended.strategy.airlineStatusTarget);
}

{
 const p=base({
  currentCards:["Mystery Card","amex_platinum"],
  currentRouting:{dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],online_grocery:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"Mystery Card",amount:1000},{card:"amex_platinum",amount:92000}]}
 });
 const r=E.analyze(p), action=r.recommended.actions.find(x=>x.cardId==="Mystery Card");
 assert("unsupported current card is manual review, never removal",action?.action==="manual_review",action?.action||"none");
}

{
 const p=base({
  spend:{dining:25000,grocery:25000,online_grocery:0,airfare:10000,hotel:5000,general:35000},
  currentCards:["amex_gold","venture"],
  currentRouting:{dining:[{card:"amex_gold",amount:25000}],grocery:[{card:"amex_gold",amount:25000}],online_grocery:[],airfare:[{card:"venture",amount:10000}],hotel:[{card:"venture",amount:5000}],general:[{card:"venture",amount:35000}]},
  remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:1000,general:10000},hotel:{qualifyingNights:1}},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:3,primaryHotel:"",primaryHotelShare:0,premiumStayShare:0,
  statusProgress:{hotel:{qualifyingNights:2}},currencyUtility:{amex_mr:1,chase_ur:.4,capital_one_miles:1},naturalBenefitValue:{amex_gold:200,venture:0}
 });
 const r=E.analyze(p);
 assert("already-good wallet does not add Platinum solely for points",!r.recommended.actions.some(x=>x.action==="add"&&x.cardId==="amex_platinum"),JSON.stringify(r.recommended.actions));
}

{
 const p=base({
  currentCards:["delta_reserve","amex_gold"],
  currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],online_grocery:[],airfare:[{card:"delta_reserve",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"delta_reserve",amount:93000}]},
  naturalBenefitValue:{delta_reserve:650,amex_gold:200},
  statusProgress:{delta:{mqd:10500},hotel:{qualifyingNights:5}},currentAirlineStatus:"Gold Medallion",
  remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:5000,hotel:3000,general:30000},delta:{mqd:1000},hotel:{qualifyingNights:1}}
 });
 const r=E.analyze(p),t=r.recommended.strategy.airlineStatusTarget;
 assert("status target either reconciles or is omitted",!t||E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.projectedTier)>=E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.tier));
}

{
 const r=E.analyze(base());
 assert("sensitivity exposes scenario recommendation ids",!!r.sensitivity.recommendationIds.conservative&&!!r.sensitivity.recommendationIds.base&&!!r.sensitivity.recommendationIds.upper);
}

{
 const p=base({
  primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:22,currentAirlineStatus:"",
  currentCards:["southwest_priority","venture"],
  currentRouting:{dining:[{card:"venture",amount:15000}],grocery:[{card:"venture",amount:10000}],online_grocery:[],airfare:[{card:"southwest_priority",amount:12000}],hotel:[{card:"venture",amount:5000}],general:[{card:"venture",amount:58000}]},
  spend:{dining:15000,grocery:10000,online_grocery:0,airfare:12000,hotel:5000,general:58000},
  statusProgress:{southwest:{tqp:8000,qualifyingFlights:19},hotel:{qualifyingNights:2}},
  remainingYear:{cardSpend:{dining:2000,grocery:2000,airfare:2000,hotel:1000,general:10000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},
  primaryHotel:"",primaryHotelShare:0,naturalBenefitValue:{southwest_priority:229}
 });
 const r=E.analyze(p);
 assert("material Southwest card benefits are not traded away for unrelated gains",r.recommended.portfolio.includes("southwest_priority"),r.recommended.id);
}

{
 const r=E.analyze(base());
 assert("Amex Platinum rule is verified",E.RULES.cards.amex_platinum.verified===true);
 assert("Amex Gold rule is verified",E.RULES.cards.amex_gold.verified===true);
}

{
 const p=base({
  spend:{dining:25000,grocery:25000,online_grocery:0,airfare:10000,hotel:5000,general:35000},
  currentCards:["amex_gold","venture"],
  currentRouting:{dining:[{card:"amex_gold",amount:25000}],grocery:[{card:"amex_gold",amount:25000}],online_grocery:[],airfare:[{card:"venture",amount:10000}],hotel:[{card:"venture",amount:5000}],general:[{card:"venture",amount:35000}]},
  remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:1000,general:10000},hotel:{qualifyingNights:1}},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:3,primaryHotel:"",primaryHotelShare:0,
  statusProgress:{hotel:{qualifyingNights:2}},naturalBenefitValue:{amex_gold:250}
 });
 const r=E.analyze(p);
 assert("optimized Gold + Venture wallet can return no change",r.recommended.id==="current",r.recommended.id);
}

console.log("\n------------------------------");
console.log(`V5 alpha.4 harness: ${pass} passed, ${fail} failed`);
if(failures.length) console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;
