/** Quiet Premium V5 validation harness — 5.0-alpha.3 */
"use strict";
const E=require("./qp_sim_v5.js");
let pass=0,fail=0;const failures=[];
function assert(name,cond,detail=""){if(cond){pass++;console.log("PASS "+name);}else{fail++;failures.push({name,detail});console.error("FAIL "+name+(detail?" — "+detail:""));}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

function base(overrides={}){
  return {
    spend:{dining:20000,grocery:15000,airfare:12000,hotel:10000,general:93000},
    currentCards:["amex_platinum"],
    currentRouting:{
      dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],
      airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:93000}]
    },
    remainingYear:{
      cardSpend:{dining:8000,grocery:6000,airfare:5000,hotel:4000,general:40000},
      delta:{mqd:1500},hotel:{qualifyingNights:3}
    },
    primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,
    currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},
    primaryHotel:"marriott",primaryHotelShare:.35,currentHotelStatus:"Gold Elite",premiumStayShare:.5,
    currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95},naturalBenefitValue:{amex_platinum:700},
    typicalTripCashCost:2500,constraints:{maxNewCards:2,noAirlineChange:true},aspirations:["travel more"],...overrides
  };
}

{
  const a=E.analyze(base({aspirations:["travel more"]}));
  const b=E.analyze(base({aspirations:["stay better"]}));
  assert("aspirations do not change recommendation",E.recommendationFingerprint(a)===E.recommendationFingerprint(b));
  assert("aspirations change presentation order",!same(a.presentation.order,b.presentation.order));
  assert("benefit visibility separated from recommendation credit",a.integrity.benefitVisibilitySeparatedFromRecommendationCredit===true);
}

{
  const p=base({annualOneWayFlights:2,currentCards:["amex_platinum"],currentRouting:{dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:93000}]}});
  const r=E.analyze(p);
  assert("lounge benefit remains visible",r.current.visibleBenefits.some(x=>x.benefit==="lounge"));
  assert("low travel can assign zero lounge recommendation credit",r.current.recommendationCredit.lounge===0);
}

{
  const p=base({primaryAirline:"united",primaryAirlineShare:.8,routeFit:{united:.9},currentAirlineStatus:"Premier Silver",statusProgress:{united:{pqp:11000,pqf:20},hotel:{qualifyingNights:8}},remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:4000,hotel:3000,general:25000},united:{pqp:1000,pqf:4},hotel:{qualifyingNights:2}},currentCards:["united_quest"],currentRouting:{dining:[{card:"united_quest",amount:20000}],grocery:[{card:"united_quest",amount:15000}],airfare:[{card:"united_quest",amount:12000}],hotel:[{card:"united_quest",amount:10000}],general:[{card:"united_quest",amount:93000}]},cardTenure:{united_quest:{futureAnnualBonusEligible:false}}});
  const r=E.analyze(p);
  assert("higher projected United tier counts as preserving current status",r.recommended.outcomes.reliability.preservesCurrentAirlineStatus===true);
}

{
  const r=E.analyze(base());
  assert("annual and remaining-year routing are separately exposed",r.integrity.annualAndRemainingYearRoutingSeparated===true && r.recommended.annualRouting && r.recommended.remainingYearRouting);
}

{
  const p=base({
    currentCards:["delta_reserve","amex_gold"],
    currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],airfare:[{card:"delta_reserve",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"delta_reserve",amount:93000}]},
    naturalBenefitValue:{delta_reserve:650,amex_gold:200},
    statusProgress:{delta:{mqd:10500},hotel:{qualifyingNights:5}},currentAirlineStatus:"Gold Medallion",
    remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:5000,hotel:3000,general:30000},delta:{mqd:1000},hotel:{qualifyingNights:1}}
  });
  const r=E.analyze(p),t=r.recommended.strategy.airlineStatusTarget;
  if(t) assert("Delta status target reconciles to projected tier",E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.projectedTier)>=E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.tier));
  else assert("Delta status target may correctly be omitted",true);
}

{
  const p=base({primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.9},annualOneWayFlights:20,currentAirlineStatus:"AAdvantage Platinum",statusProgress:{american:{loyaltyPoints:110000},hotel:{qualifyingNights:4}},remainingYear:{cardSpend:{dining:3000,grocery:3000,airfare:3000,hotel:1000,general:20000},american:{loyaltyPoints:5000},hotel:{qualifyingNights:0}},currentCards:["aa_executive"],currentRouting:{dining:[{card:"aa_executive",amount:20000}],grocery:[{card:"aa_executive",amount:15000}],airfare:[{card:"aa_executive",amount:12000}],hotel:[{card:"aa_executive",amount:10000}],general:[{card:"aa_executive",amount:93000}]},naturalBenefitValue:{aa_executive:700}});
  const r=E.analyze(p),t=r.recommended.strategy.airlineStatusTarget;
  if(t) assert("American status target reconciles to projected tier",E.RULES.airlines.american.thresholds.findIndex(x=>x.tier===t.projectedTier)>=E.RULES.airlines.american.thresholds.findIndex(x=>x.tier===t.tier));
  else assert("American status target may correctly be omitted",true);
}

{
  const p=base({primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,currentAirlineStatus:"",statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{dining:1000,grocery:1000,airfare:1000,hotel:0,general:3000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},currentCards:["southwest_priority"],currentRouting:{dining:[{card:"southwest_priority",amount:20000}],grocery:[{card:"southwest_priority",amount:15000}],airfare:[{card:"southwest_priority",amount:12000}],hotel:[{card:"southwest_priority",amount:10000}],general:[{card:"southwest_priority",amount:93000}]},naturalBenefitValue:{southwest_priority:229}});
  const r=E.analyze(p);
  assert("Southwest organic remaining flight can qualify A-List",r.recommended.outcomes.flightQuality.effectiveStatus==="A-List"||r.current.outcomes.flightQuality.effectiveStatus==="A-List");
  assert("Southwest does not manufacture status spend when flight path already qualifies",!r.recommended.strategy.airlineStatusTarget);
}

{
  const p=base({remainingYear:undefined,futureActivity:undefined,remainingYearKnown:false});
  const r=E.analyze(p);
  assert("missing remaining-year activity produces warning",r.current.quality.issues.some(x=>x.code==="remaining_year_activity_missing"));
  assert("missing remaining-year activity suppresses status target",!r.recommended.strategy.airlineStatusTarget);
}

{
  const p=base({spend:{dining:0,grocery:0,airfare:5000,hotel:5000,general:140000},currentCards:["amex_platinum"],currentRouting:{dining:[],grocery:[],airfare:[{card:"amex_platinum",amount:5000}],hotel:[{card:"amex_platinum",amount:5000}],general:[{card:"amex_platinum",amount:140000}]},remainingYear:{cardSpend:{dining:0,grocery:0,airfare:1000,hotel:1000,general:40000},delta:{mqd:0},hotel:{qualifyingNights:1}},primaryAirlineShare:.3,annualOneWayFlights:4,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:1},naturalBenefitValue:{amex_platinum:900}});
  const r=E.analyze(p),adds=r.recommended.actions.filter(x=>x.action==="add").map(x=>x.cardId);
  assert("2X general-spend card can be recommended",adds.includes("venture")||adds.includes("venture_x"),adds.join(","));
}

{
  const p=base({spend:{dining:50000,grocery:25000,airfare:0,hotel:0,general:125000},currentCards:["amex_platinum"],currentRouting:{dining:[{card:"amex_platinum",amount:50000}],grocery:[{card:"amex_platinum",amount:25000}],airfare:[],hotel:[],general:[{card:"amex_platinum",amount:125000}]},remainingYear:{cardSpend:{dining:10000,grocery:5000,airfare:0,hotel:0,general:30000},hotel:{qualifyingNights:0}},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,primaryHotel:"",primaryHotelShare:0,currentAirlineStatus:"",currentHotelStatus:"",statusProgress:{hotel:{qualifyingNights:0}},currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:1},naturalBenefitValue:{amex_platinum:0}});
  const sets=E.candidatePortfolios(E.normalizeProfile(p));
  assert("candidate set includes Gold plus Venture",sets.some(s=>s.includes("amex_gold")&&s.includes("venture")));
}

{
  const p=base({spend:{dining:25000,grocery:25000,airfare:10000,hotel:5000,general:35000},currentCards:["amex_gold","venture"],currentRouting:{dining:[{card:"amex_gold",amount:25000}],grocery:[{card:"amex_gold",amount:25000}],airfare:[{card:"venture",amount:10000}],hotel:[{card:"venture",amount:5000}],general:[{card:"venture",amount:35000}]},remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:1000,general:10000},hotel:{qualifyingNights:1}},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:3,primaryHotel:"",primaryHotelShare:0,premiumStayShare:0,statusProgress:{hotel:{qualifyingNights:2}},currencyUtility:{amex_mr:1,chase_ur:.4,capital_one_miles:1},naturalBenefitValue:{amex_gold:200,venture:0}});
  const r=E.analyze(p);
  assert("already-good Gold+Venture wallet does not add Platinum solely for points",!r.recommended.actions.some(x=>x.action==="add"&&x.cardId==="amex_platinum"));
}

{
  const p=base({currentCards:["Mystery Premium Card","amex_platinum"],currentRouting:{dining:[{card:"Mystery Premium Card",amount:20000}],grocery:[{card:"Mystery Premium Card",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"Mystery Premium Card",amount:93000}]}});
  const r=E.analyze(p);
  assert("unsupported material spend blocks precision",r.current.quality.precisionSuppressed===true);
  assert("blocked comparison preserves current recommendation",r.recommended.id==="current");
}

{
  const p=base({primaryAirline:"southwest",primaryAirlineShare:.8,routeFit:{southwest:.9},currentCards:["southwest_priority","amex_gold"],currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],airfare:[{card:"southwest_priority",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"amex_gold",amount:93000}]},statusProgress:{southwest:{tqp:5000,qualifyingFlights:5},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{dining:5000,grocery:3000,airfare:2000,hotel:1000,general:10000},southwest:{tqp:0,qualifyingFlights:3},hotel:{qualifyingNights:0}},naturalBenefitValue:{amex_gold:200}});
  const r=E.analyze(p),action=r.recommended.actions.find(x=>x.cardId==="southwest_priority");
  assert("unverified current card is never told to remove/downgrade",!action||action.action!=="remove_or_downgrade_after_review",action?.action||"none");
}

{
  const p=base({primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"Explorist",statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:48}},remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:5000,general:30000},delta:{mqd:0},hotel:{qualifyingNights:2}},currentCards:["hyatt_consumer","amex_gold"],currentRouting:{dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],airfare:[{card:"amex_gold",amount:12000}],hotel:[{card:"hyatt_consumer",amount:10000}],general:[{card:"amex_gold",amount:93000}]},naturalBenefitValue:{hyatt_consumer:95,amex_gold:200}});
  const r=E.analyze(p),t=r.recommended.strategy.hotelStatusTarget;
  if(t){
    assert("Hyatt status target is reached",E.RULES.hotels.hyatt.thresholds.findIndex(x=>x.tier===t.projectedTier)>=E.RULES.hotels.hyatt.thresholds.findIndex(x=>x.tier===t.tier));
    assert("Hyatt status spend is bounded to remaining-year spend",t.spendDirected<=45000);
  }else assert("Hyatt target can be omitted if not justified",true);
}

{
  const p=base({primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Gold",currentCards:["hilton_surpass","amex_platinum"],currentRouting:{dining:[{card:"hilton_surpass",amount:20000}],grocery:[{card:"hilton_surpass",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"hilton_surpass",amount:10000}],general:[{card:"hilton_surpass",amount:93000}]},statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:20}},remainingYear:{cardSpend:{dining:5000,grocery:3000,airfare:2000,hotel:3000,general:15000},hotel:{qualifyingNights:5}},naturalBenefitValue:{hilton_surpass:150,amex_platinum:700}});
  const sets=E.candidatePortfolios(E.normalizeProfile(p));
  assert("candidate portfolios do not stack multiple Hilton cards without incremental benefit",!sets.some(s=>s.filter(id=>E.RULES.cards[id]?.hotel==="hilton").length>1));
}

assert("Hilton Aspire specific matcher wins",E.matchCard("Hilton Honors American Express Aspire Card")==="hilton_aspire");
assert("Hilton Surpass specific matcher wins",E.matchCard("Hilton Honors American Express Surpass Card")==="hilton_surpass");
assert("AA Executive fee is $695",E.RULES.cards.aa_executive.annualFee===695);

{
  const r=E.analyze(base());
  assert("sensitivity returns scenario recommendation ids",!!r.sensitivity.recommendationIds.conservative&&!!r.sensitivity.recommendationIds.base&&!!r.sensitivity.recommendationIds.upper);
}

console.log("\n------------------------------");
console.log(`V5 alpha.3 harness: ${pass} passed, ${fail} failed`);
if(failures.length)console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;
