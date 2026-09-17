/**
 * Quiet Premium — qp_v5_validation.js
 * Internal V5 regression + architecture validation harness
 * Build: 5.0-alpha.2
 * Date: 2026-09-17
 *
 * This is NOT the independent expert-vs-engine accuracy gate.
 */
"use strict";
const E = require("./qp_sim_v5.js");

let pass = 0, fail = 0;
const failures = [];
function assert(name, condition, detail = "") {
  if (condition) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; failures.push({name, detail}); console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}
function same(a,b){ return JSON.stringify(a) === JSON.stringify(b); }

function baseProfile(overrides = {}) {
  return {
    id: "base",
    spend: { dining: 20000, grocery: 15000, airfare: 12000, hotel: 10000, general: 93000 },
    currentCards: ["amex_platinum"],
    currentRouting: {
      dining: [{ card: "amex_platinum", amount: 20000 }],
      grocery: [{ card: "amex_platinum", amount: 15000 }],
      airfare: [{ card: "amex_platinum", amount: 12000 }],
      hotel: [{ card: "amex_platinum", amount: 10000 }],
      general: [{ card: "amex_platinum", amount: 93000 }]
    },
    futureActivity: {
      statusSpend: { dining: 8000, grocery: 6000, airfare: 5000, hotel: 4000, general: 40000 },
      delta: { mqd: 1500 },
      hotel: { qualifyingNights: 3 }
    },
    primaryAirline: "delta",
    primaryAirlineShare: .75,
    routeFit: { delta: .9 },
    annualOneWayFlights: 16,
    currentAirlineStatus: "Gold Medallion",
    statusProgress: { delta: { mqd: 5500 }, hotel: { qualifyingNights: 8 } },
    primaryHotel: "marriott",
    primaryHotelShare: .35,
    currentHotelStatus: "Gold Elite",
    premiumStayShare: .5,
    currencyUtility: { amex_mr: 1, chase_ur: .75, capital_one_miles: .95 },
    naturalBenefitValue: { amex_platinum: 700 },
    typicalTripCashCost: 2500,
    constraints: { maxNewCards: 2, noAirlineChange: true },
    aspirations: ["travel more"],
    ...overrides
  };
}

// Aspirations: presentation only.
{
  const a = E.analyze(baseProfile({ aspirations:["travel more"] }));
  const b = E.analyze(baseProfile({ aspirations:["stay better"] }));
  assert("aspirations do not change recommendation", E.recommendationFingerprint(a) === E.recommendationFingerprint(b));
  assert("aspirations change presentation order", !same(a.presentation.order,b.presentation.order));
  assert("aspirations absent from selection", a.integrity.aspirationsUsedInRecommendationSelection === false);
}

// Benefit visibility is never suppressed by internal recommendation credit.
{
  const p = E.normalizeProfile(baseProfile({
    annualOneWayFlights: 2,
    spend:{ dining:0,grocery:0,airfare:2000,hotel:0,general:48000 },
    currentCards:["amex_platinum"],
    currentRouting:{
      dining:[],grocery:[],airfare:[{card:"amex_platinum",amount:2000}],hotel:[],general:[{card:"amex_platinum",amount:48000}]
    },
    futureActivity:{ statusSpend:{airfare:1000,general:20000}, delta:{mqd:0}, hotel:{qualifyingNights:0}},
    primaryAirline:"",
    currentAirlineStatus:"",
    primaryHotel:"",
    currentHotelStatus:""
  }));
  const r = E.currentRecord(p);
  assert("lounge benefit remains visible", r.visibleBenefits.some(x => x.benefit === "lounge"));
  assert("unused lounge gets no internal recommendation credit", r.recommendationCredit.lounge === 0);
  assert("visibility/credit separation integrity is exposed", E.analyze(p).integrity.benefitVisibilitySeparatedFromRecommendationCredit === true);
}

// Constraints may change the feasible answer.
{
  const open = E.analyze(baseProfile());
  const closed = E.analyze(baseProfile({ constraints:{noNewCards:true,maxNewCards:0,noAirlineChange:true} }));
  assert("no-new-card constraint blocks additions", closed.recommended.actions.every(a => a.action !== "add"));
  assert("behavioral constraint can change recommendation", E.recommendationFingerprint(open) !== E.recommendationFingerprint(closed));
}

// Reported status is authoritative and cannot be falsely presented as an upgrade.
{
  const p = E.normalizeProfile(baseProfile({
    currentAirlineStatus:"Gold Medallion",
    statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},
    futureActivity:{statusSpend:{general:40000},delta:{mqd:0},hotel:{qualifyingNights:0}}
  }));
  const current = E.currentRecord(p);
  const cand = E.strategyRecord(p, ["amex_platinum","delta_reserve"]);
  const cmp = E.materialComparison(cand,current);
  assert("effective airline status never falls below reported status", cand.outcomes.flightQuality.effectiveStatus === "Gold Medallion" || E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===cand.outcomes.flightQuality.effectiveStatus) > 1);
  assert("retaining same reported tier is not falsely called flight-quality upgrade", !(cmp.improvements.includes("flightQuality") && cand.outcomes.flightQuality.effectiveStatus === current.outcomes.flightQuality.effectiveStatus));
}

// Existing Delta Headstart is not added again to actual YTD progress.
{
  const p = E.normalizeProfile(baseProfile({
    currentCards:["delta_reserve"],
    currentRouting:{dining:[],grocery:[],airfare:[],hotel:[],general:[{card:"delta_reserve",amount:100000}]},
    statusProgress:{delta:{mqd:3000},hotel:{qualifyingNights:0}},
    futureActivity:{statusSpend:{general:10000},delta:{mqd:0},hotel:{qualifyingNights:0}}
  }));
  const prog = E.airlineFutureProgress(p,"delta",{delta_reserve:10000});
  assert("existing Delta Headstart not double-counted", prog.metric === 4000, `got ${prog.metric}`);
}

// New Delta card can add a future Headstart once.
{
  const p = E.normalizeProfile(baseProfile({
    currentCards:["amex_gold"],
    statusProgress:{delta:{mqd:3000},hotel:{qualifyingNights:0}},
    futureActivity:{statusSpend:{general:10000},delta:{mqd:0},hotel:{qualifyingNights:0}}
  }));
  const prog = E.airlineFutureProgress(p,"delta",{delta_reserve:10000});
  assert("new Delta card Headstart counted once", prog.metric === 6500, `got ${prog.metric}`);
}

// Southwest: expected remaining flight can make card-spend status chase unnecessary.
{
  const p = E.normalizeProfile(baseProfile({
    primaryAirline:"southwest", primaryAirlineShare:.9, routeFit:{southwest:.9},
    currentAirlineStatus:"",
    statusProgress:{southwest:{tqp:5000,qualifyingFlights:19},hotel:{qualifyingNights:0}},
    futureActivity:{statusSpend:{general:50000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},
    annualOneWayFlights:20
  }));
  const r = E.strategyRecord(p,["southwest_priority","venture"]);
  assert("Southwest flight path avoids unnecessary status spend", r.strategy.airlineStatusTarget == null);
  assert("Southwest projected status recognizes flight threshold", r.outcomes.flightQuality.projectedFutureStatus === "A-List");
}

// General-spend multiplier + category multiplier combination must be searchable.
{
  const p = E.normalizeProfile(baseProfile({
    spend:{dining:50000,grocery:25000,airfare:0,hotel:0,general:125000},
    currentCards:["amex_platinum"],
    currentRouting:{
      dining:[{card:"amex_platinum",amount:50000}],
      grocery:[{card:"amex_platinum",amount:25000}],
      airfare:[],hotel:[],general:[{card:"amex_platinum",amount:125000}]
    },
    primaryAirline:"",primaryHotel:"",currentAirlineStatus:"",currentHotelStatus:"",
    annualOneWayFlights:4,
    futureActivity:{statusSpend:{dining:20000,grocery:10000,general:50000},hotel:{qualifyingNights:0}},
    currencyUtility:{amex_mr:1,chase_ur:.4,capital_one_miles:1},
    naturalBenefitValue:{amex_platinum:0}
  }));
  const sets = E.candidatePortfolios(p).map(s=>s.slice().sort().join("+"));
  assert("candidate search includes Gold + 2X flexible combination", sets.includes(["amex_gold","venture"].sort().join("+")));
  const r = E.analyze(p);
  assert("engine can select a multiplier combination when materially better", r.recommended.portfolio.includes("amex_gold") && (r.recommended.portfolio.includes("venture") || r.recommended.portfolio.includes("venture_x")), `got ${r.recommended.id}`);
}

// Hyatt: existing annual elite-night credit is not double-counted.
{
  const p = E.normalizeProfile(baseProfile({
    primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"Explorist",
    currentCards:["hyatt_consumer"],
    statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:25}},
    futureActivity:{statusSpend:{general:0},hotel:{qualifyingNights:0}},
    currentRouting:{dining:[],grocery:[],airfare:[],hotel:[],general:[{card:"hyatt_consumer",amount:100000}]}
  }));
  const h = E.hotelTierFromFacts(p,["hyatt_consumer"],{hyatt_consumer:0});
  assert("existing Hyatt annual elite nights not double-counted", h.qualifyingNights === 25, `got ${h.qualifyingNights}`);
}

// Hyatt status spend stops at the threshold instead of consuming all available spend.
{
  const p = E.normalizeProfile(baseProfile({
    primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"Discoverist",
    currentCards:["venture"],
    spend:{dining:0,grocery:0,airfare:0,hotel:10000,general:90000},
    currentRouting:{dining:[],grocery:[],airfare:[],hotel:[{card:"venture",amount:10000}],general:[{card:"venture",amount:90000}]},
    statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:20}},
    futureActivity:{statusSpend:{hotel:10000,general:50000},hotel:{qualifyingNights:0}},
    primaryAirline:"",annualOneWayFlights:2
  }));
  const r = E.strategyRecord(p,["venture","hyatt_consumer"]);
  assert("Hyatt target is Explorist", r.strategy.hotelStatusTarget?.tier === "Explorist", JSON.stringify(r.strategy.hotelStatusTarget));
  assert("Hyatt status-directed spend stops at required threshold", r.strategy.hotelStatusTarget?.spendDirected === 15000, JSON.stringify(r.strategy.hotelStatusTarget));
}

// Same-program hotel overlap is not kept without explicit incremental benefit support.
{
  const p = E.normalizeProfile(baseProfile({
    primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Gold",
    currentCards:["hilton_surpass"],
    naturalBenefitValue:{hilton_surpass:0,hilton_aspire:0},
    statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:20}},
    futureActivity:{statusSpend:{general:30000},hotel:{qualifyingNights:10}},
    primaryAirline:""
  }));
  const sets = E.candidatePortfolios(p);
  assert("unjustified Surpass + Aspire overlap is pruned", !sets.some(s => s.includes("hilton_surpass") && s.includes("hilton_aspire")));
  assert("Aspire replacement remains available", sets.some(s => s.includes("hilton_aspire") && !s.includes("hilton_surpass")));
}

// Every current card gets an explicit action.
{
  const r = E.analyze(baseProfile({currentCards:["amex_platinum","amex_gold"]}));
  const ids = r.recommended.actions.filter(a=>["keep","remove_or_downgrade_after_review","manual_review"].includes(a.action)).map(a=>a.cardId);
  assert("every current card has explicit action", ["amex_platinum","amex_gold"].every(id=>ids.includes(id)));
}

// Low travel frequency does not manufacture status.
{
  const r = E.analyze(baseProfile({
    annualOneWayFlights:2,
    statusProgress:{delta:{mqd:3000},hotel:{qualifyingNights:2}},
    futureActivity:{statusSpend:{general:50000},delta:{mqd:0},hotel:{qualifyingNights:0}}
  }));
  assert("low-frequency traveler gets no airline status target", r.recommended.strategy.airlineStatusTarget == null);
}

// Hilton product matching must be specific-first.
assert("Hilton Aspire matcher wins", E.matchCard("Hilton Honors American Express Aspire Card") === "hilton_aspire");
assert("Hilton Surpass matcher wins", E.matchCard("Hilton Honors American Express Surpass Card") === "hilton_surpass");

// Confirmed stale fee correction.
assert("AA Executive annual fee is $695", E.RULES.cards.aa_executive.annualFee === 695);

// Sensitivity reruns the full recommendation, not only economics of one portfolio.
{
  const r = E.analyze(baseProfile());
  assert("sensitivity exposes independently selected recommendation per valuation", ["conservative","base","upper"].every(k => typeof r.sensitivity.recommendationIds[k] === "string"));
  const stableFromIds = new Set(Object.values(r.sensitivity.recommendationIds)).size === 1;
  assert("strategyStable is derived from scenario selections", r.sensitivity.strategyStable === stableFromIds);
}

// A concrete valuation-sensitive profile must actually flip after full reselection.
{
  const r = E.analyze({
    spend:{dining:0,grocery:0,airfare:10000,hotel:0,general:50000},
    currentCards:["amex_platinum"],
    currentRouting:{dining:[],grocery:[],airfare:[{card:"amex_platinum",amount:10000}],hotel:[],general:[{card:"amex_platinum",amount:50000}]},
    primaryAirline:"",primaryHotel:"",annualOneWayFlights:4,
    futureActivity:{statusSpend:{airfare:5000,general:25000},hotel:{qualifyingNights:0}},
    currencyUtility:{amex_mr:.6,chase_ur:.5,capital_one_miles:.6},
    naturalBenefitValue:{amex_platinum:0},
    constraints:{maxNewCards:2,noAirlineChange:true}
  });
  assert("valuation-sensitive case is detected by full reselection", r.sensitivity.strategyStable === false, JSON.stringify(r.sensitivity.recommendationIds));
  assert("valuation-sensitive case has different selected portfolios", new Set(Object.values(r.sensitivity.recommendationIds)).size > 1);
}

// All supported benefits of the chosen setup remain visible regardless of aspiration order.
{
  const a = E.analyze(baseProfile({aspirations:["travel more"]}));
  const b = E.analyze(baseProfile({aspirations:["fly & airport better"]}));
  assert("visible benefits unaffected by aspiration preference", same(a.visibleBenefits,b.visibleBenefits));
}

// Premium hotel benefit remains visible even when internal recommendation credit is zero.
{
  const p = E.normalizeProfile(baseProfile({
    primaryHotel:"",
    premiumStayShare:0,
    spend:{dining:0,grocery:0,airfare:5000,hotel:0,general:45000},
    currentCards:["amex_platinum"],
    currentRouting:{dining:[],grocery:[],airfare:[{card:"amex_platinum",amount:5000}],hotel:[],general:[{card:"amex_platinum",amount:45000}]},
    annualOneWayFlights:10,
    futureActivity:{statusSpend:{airfare:2000,general:20000},hotel:{qualifyingNights:0}}
  }));
  const r = E.currentRecord(p);
  assert("premium hotel benefit stays visible", r.visibleBenefits.some(x=>x.benefit==="premium_hotel_booking"));
  assert("premium hotel internal credit can be zero without hiding benefit", r.recommendationCredit.premiumHotel === 0);
}

console.log("\n------------------------------");
console.log(`V5 alpha.2 harness: ${pass} passed, ${fail} failed`);
if (failures.length) console.log(JSON.stringify(failures,null,2));
process.exitCode = fail ? 1 : 0;
