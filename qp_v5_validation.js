/**
 * Quiet Premium — qp_v5_validation.js
 * Internal V5 regression + architecture validation harness
 * Build: 5.0-alpha.1
 * Date: 2026-09-17
 *
 * This is NOT the independent accuracy gate. It is a regression harness that
 * verifies V5 invariants before manual expert-vs-engine profile review.
 */

"use strict";
const E = require("./qp_sim_v5.js");

let pass = 0, fail = 0;
const failures = [];
function assert(name, condition, detail = "") {
  if (condition) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; failures.push({ name, detail }); console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

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
    primaryAirline: "delta",
    primaryAirlineShare: 0.75,
    routeFit: { delta: 0.9 },
    annualOneWayFlights: 16,
    currentAirlineStatus: "Gold Medallion",
    statusProgress: { delta: { mqd: 10000 }, hotel: { qualifyingNights: 8 } },
    primaryHotel: "marriott",
    primaryHotelShare: 0.35,
    currentHotelStatus: "Gold Elite",
    premiumStayShare: 0.5,
    currencyUtility: { amex_mr: 1, chase_ur: 0.75, capital_one_miles: 0.95 },
    naturalBenefitValue: { amex_platinum: 700 },
    typicalTripCashCost: 2500,
    constraints: { maxNewCards: 2, noAirlineChange: true },
    aspirations: ["travel more"],
    ...overrides
  };
}

// 1. Aspirations change presentation only, never the recommendation.
{
  const a = E.analyze(baseProfile({ aspirations: ["travel more"] }));
  const b = E.analyze(baseProfile({ aspirations: ["stay better"] }));
  assert("aspirations do not change recommendation", E.recommendationFingerprint(a) === E.recommendationFingerprint(b));
  assert("aspirations do change presentation order", !eq(a.presentation.order, b.presentation.order));
  assert("integrity flag says aspirations absent from selection", a.integrity.aspirationsUsedInRecommendationSelection === false);
}

// 2. Explicit constraints can legitimately change recommendation.
{
  const open = E.analyze(baseProfile());
  const constrained = E.analyze(baseProfile({ constraints: { noNewCards: true, maxNewCards: 0, noAirlineChange: true } }));
  assert("no-new-card constraint prevents additions", constrained.recommended.actions.every(a => a.action !== "add"));
  assert("constraint can change recommendation", E.recommendationFingerprint(open) !== E.recommendationFingerprint(constrained));
}

// 3. Reported status is authoritative and preserved separately from model status.
{
  const r = E.analyze(baseProfile({ currentAirlineStatus: "Platinum Medallion", statusProgress: { delta: { mqd: 5500 }, hotel: { qualifyingNights: 8 } } }));
  assert("reported airline status remains authoritative fact", r.current.economics.reportedAirlineStatus === "Platinum Medallion");
  assert("modeled status remains separate", r.current.economics.modeledAirlineStatus !== r.current.economics.reportedAirlineStatus);
}

// 4. Delta MQD Boost counts ALL purchases charged to the card, not just general spend.
{
  const p = E.normalizeProfile(baseProfile({
    currentCards: ["delta_reserve"],
    currentRouting: {
      dining: [{ card: "delta_reserve", amount: 20000 }],
      grocery: [{ card: "delta_reserve", amount: 15000 }],
      airfare: [{ card: "delta_reserve", amount: 12000 }],
      hotel: [{ card: "delta_reserve", amount: 10000 }],
      general: [{ card: "delta_reserve", amount: 93000 }]
    },
    statusProgress: { delta: { mqd: 0 }, hotel: { qualifyingNights: 0 } }
  }));
  const e = E.evaluateRouting(p, p.currentRouting, p.currentCards, "base");
  const expected = 2500 + 150000 / 10;
  assert("Delta status counts all qualifying card spend", Math.abs(e.airlineProgress.metric - expected) < 1, `got ${e.airlineProgress.metric}, expected ${expected}`);
}

// 5. AAdvantage Loyalty Points count eligible purchases across the card.
{
  const p = E.normalizeProfile(baseProfile({
    primaryAirline: "american",
    routeFit: { american: 0.9 },
    currentCards: ["aa_executive"],
    currentRouting: {
      dining: [{ card: "aa_executive", amount: 20000 }],
      grocery: [{ card: "aa_executive", amount: 15000 }],
      airfare: [{ card: "aa_executive", amount: 12000 }],
      hotel: [{ card: "aa_executive", amount: 10000 }],
      general: [{ card: "aa_executive", amount: 93000 }]
    },
    statusProgress: { american: { loyaltyPoints: 10000 }, hotel: { qualifyingNights: 0 } }
  }));
  const e = E.evaluateRouting(p, p.currentRouting, p.currentCards, "base");
  assert("AAdvantage LP counts all eligible card purchases", e.airlineProgress.metric === 160000, `got ${e.airlineProgress.metric}`);
}

// 6. Hyatt qualifying nights use total qualifying card purchases.
{
  const p = E.normalizeProfile(baseProfile({
    primaryHotel: "hyatt",
    primaryHotelShare: 0.8,
    currentCards: ["hyatt_consumer"],
    currentRouting: {
      dining: [{ card: "hyatt_consumer", amount: 20000 }],
      grocery: [{ card: "hyatt_consumer", amount: 15000 }],
      airfare: [{ card: "hyatt_consumer", amount: 12000 }],
      hotel: [{ card: "hyatt_consumer", amount: 10000 }],
      general: [{ card: "hyatt_consumer", amount: 93000 }]
    },
    statusProgress: { delta: { mqd: 0 }, hotel: { qualifyingNights: 10 } }
  }));
  const e = E.evaluateRouting(p, p.currentRouting, p.currentCards, "base");
  const expectedNights = 10 + 5 + Math.floor(150000 / 5000) * 2;
  assert("Hyatt card nights count spend across whole card", e.hotelStatusDetails.qualifyingNights === expectedNights, `got ${e.hotelStatusDetails.qualifyingNights}, expected ${expectedNights}`);
}

// 7. General-spend multiplier can be recommended when it materially increases useful travel.
{
  const r = E.analyze(baseProfile({
    spend: { dining: 0, grocery: 0, airfare: 5000, hotel: 5000, general: 140000 },
    currentCards: ["amex_platinum"],
    currentRouting: {
      dining: [], grocery: [],
      airfare: [{ card: "amex_platinum", amount: 5000 }],
      hotel: [{ card: "amex_platinum", amount: 5000 }],
      general: [{ card: "amex_platinum", amount: 140000 }]
    },
    currencyUtility: { amex_mr: 1, chase_ur: 0.4, capital_one_miles: 1 },
    naturalBenefitValue: { amex_platinum: 900 },
    primaryAirlineShare: 0.4,
    annualOneWayFlights: 4,
    statusProgress: { delta: { mqd: 0 }, hotel: { qualifyingNights: 2 } }
  }));
  const added = r.recommended.actions.filter(a => a.action === "add").map(a => a.cardId);
  assert("engine can recommend a 2X-everywhere mechanism", added.includes("venture") || added.includes("venture_x"), `adds: ${added.join(",")}`);
  assert("multiplier creates a material travel-capacity benefit", r.allMaterialBenefits.some(b => b.key === "travelCapacity"));
}

// 8. Every current card receives an explicit action; none silently disappears.
{
  const r = E.analyze(baseProfile({ currentCards: ["amex_platinum", "amex_gold"] }));
  const actionIds = r.recommended.actions.filter(a => ["keep", "remove_or_downgrade_after_review", "manual_review"].includes(a.action)).map(a => a.cardId);
  assert("every current card has explicit action", ["amex_platinum", "amex_gold"].every(id => actionIds.includes(id)));
}

// 9. Low-frequency travel does not manufacture airline-status pursuit.
{
  const r = E.analyze(baseProfile({ annualOneWayFlights: 2, primaryAirlineShare: 0.9, statusProgress: { delta: { mqd: 3000 }, hotel: { qualifyingNights: 5 } } }));
  assert("low-frequency traveler gets no status target", r.recommended.strategy.statusTarget == null);
}

// 10. No-change remains valid when the current setup already captures the material outcome.
{
  const p = baseProfile({
    spend: { dining: 25000, grocery: 25000, airfare: 10000, hotel: 5000, general: 35000 },
    currentCards: ["amex_gold", "venture"],
    currentRouting: {
      dining: [{ card: "amex_gold", amount: 25000 }],
      grocery: [{ card: "amex_gold", amount: 25000 }],
      airfare: [{ card: "venture", amount: 10000 }],
      hotel: [{ card: "venture", amount: 5000 }],
      general: [{ card: "venture", amount: 35000 }]
    },
    primaryAirline: "",
    primaryAirlineShare: 0,
    routeFit: {},
    annualOneWayFlights: 4,
    primaryHotel: "",
    primaryHotelShare: 0,
    currentAirlineStatus: "",
    currentHotelStatus: "",
    statusProgress: { hotel: { qualifyingNights: 4 } },
    currencyUtility: { amex_mr: 1, chase_ur: 0.4, capital_one_miles: 1 },
    naturalBenefitValue: { amex_gold: 200, venture: 0 },
    constraints: { maxNewCards: 1, noAirlineChange: true }
  });
  const r = E.analyze(p);
  const cmp = E.materialComparison(r.recommended, r.current);
  assert("already-strong profile does not require manufactured change", r.recommended.id === "current" || cmp.improvements.length > 0);
}

// 11. Hilton matcher must not shadow Surpass/Aspire with generic no-fee match.
assert("specific Hilton Aspire matcher wins", E.matchCard("Hilton Honors American Express Aspire Card") === "hilton_aspire");
assert("specific Hilton Surpass matcher wins", E.matchCard("Hilton Honors American Express Surpass Card") === "hilton_surpass");

// 12. Citi / AAdvantage Executive current annual fee is $695.
assert("AA Executive fee is current", E.RULES.cards.aa_executive.annualFee === 695);

console.log("\n------------------------------");
console.log(`V5 harness: ${pass} passed, ${fail} failed`);
if (failures.length) console.log(JSON.stringify(failures, null, 2));
process.exitCode = fail ? 1 : 0;
