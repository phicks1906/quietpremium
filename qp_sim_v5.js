/**
 * Quiet Premium — qp_sim_v5.js
 * Isolated V5 Travel-Strategy Engine
 * Build: 5.0-alpha.1
 * Date: 2026-09-17
 *
 * IMPORTANT: This file is intentionally NOT wired to diagnostic.html or any
 * customer-facing page. It exists only for recommendation development and
 * validation until the V5 accuracy gate passes.
 *
 * NORTH STAR
 * Quiet Premium optimizes for the best realistic travel life the customer can
 * receive from money they already spend. Points, cards, status and benefits are
 * mechanisms, not the objective.
 *
 * V5 DECISION ORDER
 * travel life -> route/airline strategy -> hotel strategy -> rewards currency
 * -> benefits/overlap -> cards -> exact spend routing -> travel outcomes.
 *
 * ASPIRATIONS ARE PRESENTATION-ONLY.
 * Facts determine opportunity. Behavioral constraints determine feasibility.
 * Aspirations determine display order and emphasis only.
 */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.QuietPremiumEngineV5 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENGINE_VERSION = "5.0-alpha.1";
  const RULES_AS_OF = "2026-09-17";

  const CATEGORIES = ["dining", "grocery", "airfare", "hotel", "general"];
  const OUTCOME_KEYS = [
    "travelCapacity",
    "flightQuality",
    "airportExperience",
    "hotelExperience",
    "reliability",
    "cashEfficiency",
    "complexity"
  ];

  const clean = v => String(v ?? "").trim();
  const lc = v => clean(v).toLowerCase();
  const num = v => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(/[$,%\s,]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
  const round = (n, d = 0) => {
    const p = 10 ** d;
    return Math.round((Number(n) || 0) * p) / p;
  };
  const uniq = arr => [...new Set((arr || []).filter(Boolean))];
  const sum = arr => (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);
  const deepClone = obj => JSON.parse(JSON.stringify(obj));

  // -------------------------------------------------------------------------
  // Rule registry
  // -------------------------------------------------------------------------

  // Rule records distinguish current verified facts from QP modeling choices.
  // URLs are documentation notes for validation, not runtime dependencies.
  const RULES = Object.freeze({
    meta: {
      version: ENGINE_VERSION,
      asOf: RULES_AS_OF,
      supportedAirlines: ["delta", "united", "american", "southwest"],
      supportedHotels: ["hyatt", "marriott", "hilton"],
      supportedFlexible: ["amex_mr", "chase_ur", "capital_one_miles"]
    },
    airlines: {
      delta: {
        label: "Delta",
        metric: "MQD",
        thresholds: [
          { tier: "Silver Medallion", amount: 5000 },
          { tier: "Gold Medallion", amount: 10000 },
          { tier: "Platinum Medallion", amount: 15000 },
          { tier: "Diamond Medallion", amount: 28000 }
        ]
      },
      united: {
        label: "United",
        metric: "PQP",
        thresholds: [
          { tier: "Premier Silver", amount: 6000 },
          { tier: "Premier Gold", amount: 12000 },
          { tier: "Premier Platinum", amount: 18000 },
          { tier: "Premier 1K", amount: 28000 }
        ]
      },
      american: {
        label: "American",
        metric: "Loyalty Points",
        thresholds: [
          { tier: "AAdvantage Gold", amount: 40000 },
          { tier: "AAdvantage Platinum", amount: 75000 },
          { tier: "AAdvantage Platinum Pro", amount: 125000 },
          { tier: "AAdvantage Executive Platinum", amount: 200000 }
        ]
      },
      southwest: {
        label: "Southwest",
        metric: "TQP",
        thresholds: [
          { tier: "A-List", amount: 35000 },
          { tier: "A-List Preferred", amount: 70000 }
        ],
        flightThresholds: [
          { tier: "A-List", flights: 20 },
          { tier: "A-List Preferred", flights: 40 }
        ]
      }
    },
    hotels: {
      hyatt: {
        label: "World of Hyatt",
        thresholds: [
          { tier: "Discoverist", nights: 10 },
          { tier: "Explorist", nights: 30 },
          { tier: "Globalist", nights: 60 }
        ]
      },
      marriott: {
        label: "Marriott Bonvoy",
        thresholds: [
          { tier: "Silver Elite", nights: 10 },
          { tier: "Gold Elite", nights: 25 },
          { tier: "Platinum Elite", nights: 50 },
          { tier: "Titanium Elite", nights: 75 }
        ]
      },
      hilton: {
        label: "Hilton Honors",
        thresholds: [
          { tier: "Silver", nights: 10, stays: 4, spend: 2500 },
          { tier: "Gold", nights: 25, stays: 15, spend: 6000 },
          { tier: "Diamond", nights: 50, stays: 25, spend: 11500 }
        ],
        diamondReserve: { tier: "Diamond Reserve", nights: 80, stays: 40, spend: 18000 },
        verifiedAsOf: "2026-09-17",
        source: "https://www.hilton.com/en/hilton-honors/support-faq/"
      }
    },
    cards: {
      amex_gold: {
        label: "American Express Gold Card",
        family: "amex",
        currency: "amex_mr",
        annualFee: 325,
        earn: { dining: 4, grocery: 4, airfare: 3, hotel: 1, general: 1 },
        caps: { dining: 50000, grocery: 25000 },
        bookingBonuses: { amex_prepaid_hotel: 5 },
        verifiedAsOf: "2026-09-17",
        source: "https://www.americanexpress.com/us/credit-cards/card/gold-card/"
      },
      amex_platinum: {
        label: "The Platinum Card from American Express",
        family: "amex",
        currency: "amex_mr",
        annualFee: 895,
        earn: { dining: 1, grocery: 1, airfare: 5, hotel: 1, general: 1 },
        caps: { airfare: 500000 },
        bookingBonuses: { amex_prepaid_hotel: 5 },
        premiumBooking: "fhr_thc",
        benefitTags: ["lounge", "premium_hotel_booking"],
        verifiedAsOf: "2026-09-17",
        source: "https://www.americanexpress.com/us/credit-cards/card/platinum/"
      },
      chase_preferred: {
        label: "Chase Sapphire Preferred",
        family: "chase",
        currency: "chase_ur",
        annualFee: 95,
        earn: { dining: 3, grocery: 1, airfare: 2, hotel: 2, general: 1 },
        verifiedAsOf: "2026-09-03",
        verificationPending: true
      },
      chase_reserve: {
        label: "Chase Sapphire Reserve",
        family: "chase",
        currency: "chase_ur",
        annualFee: 795,
        earn: { dining: 3, grocery: 1, airfare: 4, hotel: 4, general: 1 },
        bookingBonuses: { chase_travel: 8 },
        benefitTags: ["lounge", "travel_credit"],
        verifiedAsOf: "2026-09-17",
        source: "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve"
      },
      venture: {
        label: "Capital One Venture Rewards",
        family: "capital_one",
        currency: "capital_one_miles",
        annualFee: 95,
        earn: { dining: 2, grocery: 2, airfare: 2, hotel: 2, general: 2 },
        verifiedAsOf: "2026-09-17",
        source: "https://www.capitalone.com/credit-cards/compare/"
      },
      venture_x: {
        label: "Capital One Venture X Rewards",
        family: "capital_one",
        currency: "capital_one_miles",
        annualFee: 395,
        earn: { dining: 2, grocery: 2, airfare: 2, hotel: 2, general: 2 },
        bookingBonuses: { capital_one_flights: 5, capital_one_hotels: 10 },
        benefitTags: ["lounge", "capital_one_travel_credit", "anniversary_miles"],
        verifiedAsOf: "2026-09-17",
        source: "https://www.capitalone.com/credit-cards/venture-x/"
      },
      delta_platinum: {
        label: "Delta SkyMiles Platinum American Express Card",
        family: "delta",
        currency: "skymiles",
        annualFee: 350,
        earn: { dining: 2, grocery: 2, airfare: 3, hotel: 3, general: 1 },
        airline: "delta",
        status: { metric: "MQD", headstart: 2500, spendDivisor: 20 },
        benefitTags: ["companion_certificate_renewal"],
        verifiedAsOf: "2026-09-17",
        source: "https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-platinum-american-express-card/"
      },
      delta_reserve: {
        label: "Delta SkyMiles Reserve American Express Card",
        family: "delta",
        currency: "skymiles",
        annualFee: 650,
        earn: { dining: 1, grocery: 1, airfare: 3, hotel: 1, general: 1 },
        airline: "delta",
        status: { metric: "MQD", headstart: 2500, spendDivisor: 10 },
        benefitTags: ["lounge", "upgrade_priority", "companion_certificate_renewal"],
        verifiedAsOf: "2026-09-17",
        source: "https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-reserve-american-express-card/"
      },
      united_explorer: {
        label: "United Explorer Card",
        family: "united",
        currency: "united_miles",
        annualFee: 150,
        earn: { dining: 2, grocery: 1, airfare: 3, hotel: 2, general: 1 },
        airline: "united",
        status: { metric: "PQP", spendDivisor: 20, annualCap: 1000 },
        verifiedAsOf: "2026-09-03",
        verificationPending: true
      },
      united_quest: {
        label: "United Quest Card",
        family: "united",
        currency: "united_miles",
        annualFee: 350,
        earn: { dining: 2, grocery: 1, airfare: 4, hotel: 2, general: 1 },
        airline: "united",
        status: { metric: "PQP", spendDivisor: 20, annualCap: 18000, annualBonus: 1000, bonusRequiresPriorYearOpen: true },
        verifiedAsOf: "2026-09-17",
        source: "https://creditcards.chase.com/travel-credit-cards/united/united-quest"
      },
      united_club: {
        label: "United Club Card",
        family: "united",
        currency: "united_miles",
        annualFee: 695,
        earn: { dining: 2, grocery: 1, airfare: 5, hotel: 2, general: 1 },
        airline: "united",
        status: { metric: "PQP", spendDivisor: 15, annualCap: 28000, annualBonus: 1500, bonusRequiresPriorYearOpen: true },
        benefitTags: ["lounge"],
        verifiedAsOf: "2026-09-17",
        source: "https://www.chase.com/personal/credit-cards/united/united-visa-infinite-card"
      },
      aa_executive: {
        label: "Citi / AAdvantage Executive World Legend Mastercard",
        family: "american",
        currency: "aadvantage",
        annualFee: 695,
        earn: { dining: 1, grocery: 1, airfare: 4, hotel: 1, general: 1 },
        airline: "american",
        status: { metric: "Loyalty Points", lpPerEligiblePurchaseDollar: 1 },
        benefitTags: ["lounge", "priority_airport"],
        verifiedAsOf: "2026-09-17",
        source: "https://creditcards.aa.com/credit-cards/citi-executive-card-american-airlines-direct/"
      },
      southwest_priority: {
        label: "Southwest Rapid Rewards Priority Credit Card",
        family: "southwest",
        currency: "southwest_points",
        annualFee: 229,
        earn: { dining: 2, grocery: 1, airfare: 4, hotel: 1, general: 1 },
        airline: "southwest",
        status: { metric: "TQP", spendBlock: 5000, tqpPerBlock: 2500 },
        verifiedAsOf: "2026-09-03",
        verificationPending: true
      },
      hyatt_consumer: {
        label: "World of Hyatt Credit Card",
        family: "hyatt",
        currency: "hyatt_points",
        annualFee: 95,
        earn: { dining: 2, grocery: 1, airfare: 2, hotel: 4, general: 1 },
        hotel: "hyatt",
        hotelStatus: { automaticTier: "Discoverist", annualNights: 5, spendBlock: 5000, nightsPerBlock: 2 },
        verifiedAsOf: "2026-09-17",
        source: "https://www.chase.com/personal/credit-cards/hyatt/world-hyatt/earn-maintain"
      },
      marriott_boundless: {
        label: "Marriott Bonvoy Boundless Credit Card",
        family: "marriott",
        currency: "marriott_points",
        annualFee: 95,
        earn: { dining: 2, grocery: 2, airfare: 2, hotel: 6, general: 2 },
        hotel: "marriott",
        hotelStatus: { automaticTier: "Silver Elite", annualNights: 15 },
        verifiedAsOf: "2026-09-03",
        verificationPending: true
      },
      marriott_brilliant: {
        label: "Marriott Bonvoy Brilliant American Express Card",
        family: "marriott",
        currency: "marriott_points",
        annualFee: 650,
        earn: { dining: 3, grocery: 2, airfare: 3, hotel: 6, general: 2 },
        hotel: "marriott",
        hotelStatus: { automaticTier: "Platinum Elite", annualNights: 25 },
        verifiedAsOf: "2026-09-03",
        verificationPending: true
      },
      hilton_no_fee: {
        label: "Hilton Honors American Express Card",
        family: "hilton",
        currency: "hilton_points",
        annualFee: 0,
        earn: { dining: 5, grocery: 5, airfare: 3, hotel: 7, general: 3 },
        hotel: "hilton",
        hotelStatus: { automaticTier: "Silver" },
        verifiedAsOf: "2026-09-03",
        verificationPending: true
      },
      hilton_surpass: {
        label: "Hilton Honors American Express Surpass Card",
        family: "hilton",
        currency: "hilton_points",
        annualFee: 150,
        earn: { dining: 6, grocery: 6, airfare: 3, hotel: 12, general: 3 },
        hotel: "hilton",
        hotelStatus: { automaticTier: "Gold" },
        verifiedAsOf: "2026-09-03",
        verificationPending: true
      },
      hilton_aspire: {
        label: "Hilton Honors American Express Aspire Card",
        family: "hilton",
        currency: "hilton_points",
        annualFee: 550,
        earn: { dining: 7, grocery: 3, airfare: 7, hotel: 14, general: 3 },
        hotel: "hilton",
        hotelStatus: { automaticTier: "Diamond" },
        verifiedAsOf: "2026-09-03",
        verificationPending: true
      }
    }
  });

  const VALUATIONS = Object.freeze({
    conservative: {
      amex_mr: 0.0125,
      chase_ur: 0.0125,
      capital_one_miles: 0.010,
      skymiles: 0.011,
      united_miles: 0.012,
      aadvantage: 0.012,
      southwest_points: 0.012,
      hyatt_points: 0.016,
      marriott_points: 0.006,
      hilton_points: 0.0045
    },
    base: {
      amex_mr: 0.020,
      chase_ur: 0.020,
      capital_one_miles: 0.017,
      skymiles: 0.015,
      united_miles: 0.017,
      aadvantage: 0.018,
      southwest_points: 0.014,
      hyatt_points: 0.022,
      marriott_points: 0.009,
      hilton_points: 0.008
    },
    upper: {
      amex_mr: 0.025,
      chase_ur: 0.025,
      capital_one_miles: 0.020,
      skymiles: 0.018,
      united_miles: 0.021,
      aadvantage: 0.022,
      southwest_points: 0.016,
      hyatt_points: 0.026,
      marriott_points: 0.011,
      hilton_points: 0.010
    }
  });

  // Modeling thresholds are QP judgment calls, not issuer facts.
  const MODEL = Object.freeze({
    materialAnnualTravelValue: 400,
    materialCashImprovement: 300,
    materialTravelValueDifference: 250,
    routeFitMinimumForMigration: 0.80,
    routeFitMinimumForConcentration: 0.60,
    airlineConcentrationMinimum: 0.60,
    minimumFlightsForStatusUseCase: 6,
    hotelConcentrationMinimum: 0.50,
    minimumHotelNightsForStatusUseCase: 10,
    maxNewCardsDefault: 2,
    complexityPenaltyPerCard: 1,
    complexityPenaltyPerCurrency: 1,
    statusSpendOpportunityCostLimit: 900
  });

  // -------------------------------------------------------------------------
  // Card matching: specific products before broad family names.
  // -------------------------------------------------------------------------

  const CARD_ALIASES = [
    ["hilton_aspire", ["hilton honors american express aspire", "hilton aspire"]],
    ["hilton_surpass", ["hilton honors american express surpass", "hilton surpass"]],
    ["hilton_no_fee", ["hilton honors american express card", "hilton honors american express"]],
    ["marriott_brilliant", ["marriott bonvoy brilliant"]],
    ["marriott_boundless", ["marriott bonvoy boundless"]],
    ["delta_reserve", ["delta skymiles reserve", "delta reserve"]],
    ["delta_platinum", ["delta skymiles platinum", "delta platinum"]],
    ["united_club", ["united club", "club infinite"]],
    ["united_quest", ["united quest"]],
    ["united_explorer", ["united explorer"]],
    ["aa_executive", ["aadvantage executive", "aa executive", "world legend"]],
    ["southwest_priority", ["southwest rapid rewards priority", "southwest priority"]],
    ["hyatt_consumer", ["world of hyatt credit card", "world of hyatt"]],
    ["chase_reserve", ["chase sapphire reserve", "sapphire reserve"]],
    ["chase_preferred", ["chase sapphire preferred", "sapphire preferred"]],
    ["venture_x", ["capital one venture x", "venture x"]],
    ["venture", ["capital one venture rewards", "capital one venture"]],
    ["amex_platinum", ["platinum card from american express", "american express platinum", "amex platinum"]],
    ["amex_gold", ["american express gold", "amex gold"]]
  ];

  function matchCard(value) {
    const s = lc(value);
    if (!s) return null;
    if (RULES.cards[s]) return s;
    for (const [id, aliases] of CARD_ALIASES) {
      if (aliases.some(alias => s.includes(alias))) return id;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Normalization
  // -------------------------------------------------------------------------

  function normalizeSpend(raw = {}) {
    const spend = raw.spend || raw;
    return {
      dining: num(spend.dining ?? raw.dining_spend),
      grocery: num(spend.grocery ?? raw.grocery_spend),
      airfare: num(spend.airfare ?? raw.household_airfare_spend ?? raw.airfare_spend),
      hotel: num(spend.hotel ?? raw.hotel_spend),
      general: num(spend.general ?? raw.general_spend)
    };
  }

  function normalizeRouting(raw = {}, spend) {
    const input = raw.currentRouting || raw.current_routing || {};
    const out = {};
    for (const category of CATEGORIES) {
      const rows = Array.isArray(input[category]) ? input[category] : [];
      out[category] = rows.map(row => ({
        card: matchCard(row.card || row.cardId || row.name) || clean(row.card || row.cardId || row.name),
        amount: num(row.amount)
      })).filter(row => row.card && row.amount > 0);

      if (!out[category].length) {
        const fallbackName = raw[`card_${category}`] || (category === "general" ? raw.card_general : null);
        const fallbackCard = matchCard(fallbackName);
        if (fallbackCard && spend[category] > 0) out[category] = [{ card: fallbackCard, amount: spend[category] }];
      }
    }
    return out;
  }

  function normalizeStatusProgress(raw = {}) {
    const p = raw.statusProgress || raw.status_progress || {};
    return {
      delta: { mqd: num(p.delta?.mqd ?? raw.delta_mqd) },
      united: { pqp: num(p.united?.pqp ?? raw.united_pqp), pqf: num(p.united?.pqf ?? raw.united_pqf) },
      american: { loyaltyPoints: num(p.american?.loyaltyPoints ?? raw.american_loyalty_points) },
      southwest: { tqp: num(p.southwest?.tqp ?? raw.southwest_tqp), qualifyingFlights: num(p.southwest?.qualifyingFlights ?? raw.southwest_qualifying_flights) },
      hotel: {
        qualifyingNights: num(p.hotel?.qualifyingNights ?? raw.hotel_qualifying_nights ?? raw.hotel_nights),
        qualifyingStays: num(p.hotel?.qualifyingStays ?? raw.hotel_qualifying_stays ?? raw.hotel_stays),
        qualifyingSpend: num(p.hotel?.qualifyingSpend ?? raw.hotel_qualifying_spend ?? raw.hotel_spend)
      }
    };
  }

  function normalizeProfile(raw = {}) {
    const spend = normalizeSpend(raw);
    const currentCardsRaw = raw.currentCards || raw.primary_cards || raw.cards || [];
    const currentCards = uniq((Array.isArray(currentCardsRaw) ? currentCardsRaw : [currentCardsRaw])
      .map(v => matchCard(v) || clean(v))
      .filter(Boolean));

    const primaryAirline = lc(raw.primaryAirline || raw.primary_airline_eco || raw.primary_airline);
    const primaryHotel = lc(raw.primaryHotel || raw.primary_hotel || raw.hotel_program);
    const routeFitRaw = raw.routeFit || raw.route_fit || {};
    const airlineShare = clamp(num(raw.primaryAirlineShare ?? raw.primary_airline_share ?? raw.airline_concentration) / (num(raw.primaryAirlineShare ?? raw.primary_airline_share ?? raw.airline_concentration) > 1 ? 100 : 1), 0, 1);
    const hotelShare = clamp(num(raw.primaryHotelShare ?? raw.primary_hotel_share ?? raw.hotel_concentration) / (num(raw.primaryHotelShare ?? raw.primary_hotel_share ?? raw.hotel_concentration) > 1 ? 100 : 1), 0, 1);

    const aspirationsRaw = raw.aspirations || raw.desiredOutcomes || raw.desired_outcomes || [];
    const aspirations = uniq((Array.isArray(aspirationsRaw) ? aspirationsRaw : [aspirationsRaw]).map(lc));
    const constraintsRaw = raw.constraints || {};

    const profile = {
      spend,
      totalSpend: sum(Object.values(spend)),
      householdAirfareSpend: num(raw.householdAirfareSpend ?? raw.household_airfare_spend ?? spend.airfare),
      currentCards,
      currentRouting: normalizeRouting(raw, spend),
      cardTenure: raw.cardTenure || raw.card_tenure || {},
      benefitUse: raw.benefitUse || raw.benefit_use || {},
      naturalBenefitValue: raw.naturalBenefitValue || raw.natural_benefit_value || {},
      currencyUtility: {
        amex_mr: clamp(num(raw.currencyUtility?.amex_mr ?? raw.currency_utility?.amex_mr ?? 1), 0, 1),
        chase_ur: clamp(num(raw.currencyUtility?.chase_ur ?? raw.currency_utility?.chase_ur ?? 1), 0, 1),
        capital_one_miles: clamp(num(raw.currencyUtility?.capital_one_miles ?? raw.currency_utility?.capital_one_miles ?? 1), 0, 1),
        skymiles: clamp(num(raw.currencyUtility?.skymiles ?? raw.currency_utility?.skymiles ?? (primaryAirline === "delta" ? 1 : 0.45)), 0, 1),
        united_miles: clamp(num(raw.currencyUtility?.united_miles ?? raw.currency_utility?.united_miles ?? (primaryAirline === "united" ? 1 : 0.45)), 0, 1),
        aadvantage: clamp(num(raw.currencyUtility?.aadvantage ?? raw.currency_utility?.aadvantage ?? (primaryAirline === "american" ? 1 : 0.45)), 0, 1),
        southwest_points: clamp(num(raw.currencyUtility?.southwest_points ?? raw.currency_utility?.southwest_points ?? (primaryAirline === "southwest" ? 1 : 0.45)), 0, 1),
        hyatt_points: clamp(num(raw.currencyUtility?.hyatt_points ?? raw.currency_utility?.hyatt_points ?? (primaryHotel === "hyatt" ? 1 : 0.45)), 0, 1),
        marriott_points: clamp(num(raw.currencyUtility?.marriott_points ?? raw.currency_utility?.marriott_points ?? (primaryHotel === "marriott" ? 1 : 0.45)), 0, 1),
        hilton_points: clamp(num(raw.currencyUtility?.hilton_points ?? raw.currency_utility?.hilton_points ?? (primaryHotel === "hilton" ? 1 : 0.45)), 0, 1)
      },
      travel: {
        homeAirport: clean(raw.homeAirport || raw.home_airport),
        frequentDestinations: raw.frequentDestinations || raw.frequent_destinations || [],
        annualOneWayFlights: num(raw.annualOneWayFlights ?? raw.one_way_flights ?? raw.flights_taken),
        annualRoundTrips: num(raw.annualRoundTrips ?? raw.trips_per_year),
        cabin: lc(raw.cabin || raw.cabin_booked || "economy"),
        partySize: Math.max(1, num(raw.partySize ?? raw.travel_party_size) || 1),
        desiredTripType: lc(raw.desiredTripType || raw.desired_trip_type),
        typicalTripCashCost: num(raw.typicalTripCashCost ?? raw.typical_trip_cash_cost),
        bookingControl: lc(raw.bookingControl || raw.booking_control || "full")
      },
      airline: {
        primary: primaryAirline,
        share: airlineShare || (primaryAirline ? 0.70 : 0),
        reportedStatus: clean(raw.currentAirlineStatus || raw.primary_airline_status || raw.airline_status),
        progress: normalizeStatusProgress(raw),
        routeFit: Object.fromEntries(Object.entries(routeFitRaw).map(([k, v]) => [lc(k), clamp(num(v), 0, 1)])),
        statusUsefulOverride: typeof raw.airlineStatusUseful === "boolean" ? raw.airlineStatusUseful : null
      },
      hotel: {
        primary: primaryHotel,
        share: hotelShare || (primaryHotel ? 0.60 : 0),
        reportedStatus: clean(raw.currentHotelStatus || raw.primary_hotel_status || raw.hotel_status),
        premiumStayShare: clamp(num(raw.premiumStayShare ?? raw.premium_stay_share) / (num(raw.premiumStayShare ?? raw.premium_stay_share) > 1 ? 100 : 1), 0, 1)
      },
      statusProgress: normalizeStatusProgress(raw),
      aspirations, // PRESENTATION ONLY. Never used to choose the recommendation.
      constraints: {
        noNewCards: !!constraintsRaw.noNewCards,
        maxNewCards: constraintsRaw.maxNewCards == null ? MODEL.maxNewCardsDefault : Math.max(0, num(constraintsRaw.maxNewCards)),
        keepAirline: constraintsRaw.keepAirline !== false,
        noAirlineChange: constraintsRaw.noAirlineChange !== false,
        noHotelConcentration: !!constraintsRaw.noHotelConcentration,
        noPortalBooking: !!constraintsRaw.noPortalBooking,
        prohibitedCards: uniq((constraintsRaw.prohibitedCards || []).map(v => matchCard(v) || clean(v))),
        requiredCards: uniq((constraintsRaw.requiredCards || []).map(v => matchCard(v) || clean(v)))
      },
      __normalizedV5: true,
      meta: {
        source: raw.source || "v5",
        quickAspirations: aspirations,
        rawProfileId: clean(raw.id || raw.profileId)
      }
    };

    return profile;
  }

  // -------------------------------------------------------------------------
  // Status facts and usefulness
  // -------------------------------------------------------------------------

  function tierIndex(program, tier) {
    const t = lc(tier);
    if (!t) return -1;
    const rows = RULES.airlines[program]?.thresholds || RULES.hotels[program]?.thresholds || [];
    return rows.findIndex(row => lc(row.tier) === t);
  }

  function airlineStatusUsefulness(profile) {
    if (profile.airline.statusUsefulOverride != null) return !!profile.airline.statusUsefulOverride;
    if (!profile.airline.primary) return false;
    if (profile.airline.share < MODEL.airlineConcentrationMinimum) return false;
    if (profile.travel.annualOneWayFlights < MODEL.minimumFlightsForStatusUseCase) return false;
    if (profile.travel.bookingControl === "none") return false;
    return true;
  }

  function hotelStatusUsefulness(profile) {
    if (!profile.hotel.primary || profile.constraints.noHotelConcentration) return false;
    if (profile.hotel.share < MODEL.hotelConcentrationMinimum) return false;
    return profile.statusProgress.hotel.qualifyingNights >= MODEL.minimumHotelNightsForStatusUseCase;
  }

  function currentReportedStatus(profile) {
    return {
      airline: profile.airline.reportedStatus || "",
      hotel: profile.hotel.reportedStatus || ""
    };
  }

  function cardSpendTotals(routing) {
    const totals = {};
    for (const category of CATEGORIES) {
      for (const row of routing[category] || []) totals[row.card] = (totals[row.card] || 0) + num(row.amount);
    }
    return totals;
  }

  function airlineProgressWithCardSpend(profile, airline, cardSpendById) {
    const p = profile.statusProgress[airline] || {};
    let metric = airline === "delta" ? p.mqd : airline === "united" ? p.pqp : airline === "american" ? p.loyaltyPoints : p.tqp;
    let qualifyingFlights = airline === "southwest" ? p.qualifyingFlights : 0;
    const contributions = [];

    for (const [cardId, spend] of Object.entries(cardSpendById || {})) {
      const card = RULES.cards[cardId];
      if (!card || card.airline !== airline || !card.status) continue;
      const s = card.status;
      let added = 0;
      if (airline === "delta") {
        added += s.headstart || 0;
        added += spend / s.spendDivisor;
      } else if (airline === "united") {
        added += Math.min(s.annualCap || Infinity, spend / s.spendDivisor);
        const tenure = profile.cardTenure[cardId] || {};
        if (s.annualBonus && (!s.bonusRequiresPriorYearOpen || tenure.eligibleAnnualBonus === true)) added += s.annualBonus;
      } else if (airline === "american") {
        // AAdvantage credit-card Loyalty Points accrue from base miles on eligible purchases.
        // The current supported AAdvantage card earns one base mile per eligible purchase dollar.
        added += spend * (s.lpPerEligiblePurchaseDollar || 0);
      } else if (airline === "southwest") {
        added += Math.floor(spend / (s.spendBlock || Infinity)) * (s.tqpPerBlock || 0);
      }
      metric += added;
      contributions.push({ cardId, spend: round(spend), added: round(added) });
    }

    return { metric: round(metric), qualifyingFlights, contributions };
  }

  function statusTierForProgress(airline, progress) {
    const rules = RULES.airlines[airline];
    if (!rules) return "";
    let tier = "";
    for (const row of rules.thresholds || []) if (progress.metric >= row.amount) tier = row.tier;
    if (airline === "southwest") {
      for (const row of rules.flightThresholds || []) if (progress.qualifyingFlights >= row.flights) tier = row.tier;
    }
    return tier;
  }

  function hotelStatusFromCards(profile, cardSpendById) {
    const program = profile.hotel.primary;
    if (!program || !RULES.hotels[program]) return { tier: "", qualifyingNights: profile.statusProgress.hotel.qualifyingNights, contributions: [] };
    let nights = profile.statusProgress.hotel.qualifyingNights;
    let bestAutoTier = "";
    const contributions = [];
    for (const [cardId, spend] of Object.entries(cardSpendById || {})) {
      const card = RULES.cards[cardId];
      if (!card || card.hotel !== program || !card.hotelStatus) continue;
      const hs = card.hotelStatus;
      let addedNights = hs.annualNights || 0;
      if (hs.spendBlock && hs.nightsPerBlock) addedNights += Math.floor(spend / hs.spendBlock) * hs.nightsPerBlock;
      nights += addedNights;
      if (hs.automaticTier && tierIndex(program, hs.automaticTier) > tierIndex(program, bestAutoTier)) bestAutoTier = hs.automaticTier;
      contributions.push({ cardId, spend: round(spend), addedNights, automaticTier: hs.automaticTier || "" });
    }
    let earnedTier = "";
    const rules = RULES.hotels[program];
    if (program === "hilton") {
      const stays = profile.statusProgress.hotel.qualifyingStays;
      const qSpend = profile.statusProgress.hotel.qualifyingSpend;
      for (const row of rules.thresholds) {
        if (nights >= row.nights || stays >= row.stays || qSpend >= row.spend) earnedTier = row.tier;
      }
      const dr = rules.diamondReserve;
      if ((nights >= dr.nights && qSpend >= dr.spend) || (stays >= dr.stays && qSpend >= dr.spend)) earnedTier = dr.tier;
    } else {
      for (const row of rules.thresholds) if (nights >= row.nights) earnedTier = row.tier;
    }
    const tier = tierIndex(program, bestAutoTier) > tierIndex(program, earnedTier) ? bestAutoTier : earnedTier;
    return { tier, qualifyingNights: nights, contributions };
  }

  // -------------------------------------------------------------------------
  // Earning and benefits
  // -------------------------------------------------------------------------

  function earningRate(card, category, profile) {
    if (!card) return 0;
    let rate = card.earn?.[category] || 0;
    const booking = profile.bookingMethods || {};
    if (category === "hotel" && booking.hotel === "amex_prepaid" && card.bookingBonuses?.amex_prepaid_hotel) rate = card.bookingBonuses.amex_prepaid_hotel;
    if (category === "airfare" && booking.airfare === "capital_one" && card.bookingBonuses?.capital_one_flights) rate = card.bookingBonuses.capital_one_flights;
    if (category === "hotel" && booking.hotel === "capital_one" && card.bookingBonuses?.capital_one_hotels) rate = card.bookingBonuses.capital_one_hotels;
    if ((category === "airfare" || category === "hotel") && booking[category] === "chase_travel" && card.bookingBonuses?.chase_travel) rate = card.bookingBonuses.chase_travel;
    return rate;
  }

  function categoryPoints(cardId, category, amount, profile) {
    const card = RULES.cards[cardId];
    if (!card || amount <= 0) return { currency: null, points: 0 };
    const rate = earningRate(card, category, profile);
    let points = amount * rate;
    if (card.caps?.[category]) {
      const cap = card.caps[category];
      points = Math.min(amount, cap) * rate + Math.max(0, amount - cap) * 1;
    }
    return { currency: card.currency, points: round(points) };
  }

  function naturalBenefitValue(profile, cardId) {
    const v = profile.naturalBenefitValue?.[cardId];
    if (typeof v === "number") return Math.max(0, v);
    if (v && typeof v === "object") return sum(Object.values(v).map(num));
    return 0;
  }

  function evaluateRouting(profile, routing, portfolio, valuationScenario = "base") {
    const pointsByCurrency = {};
    const spendByCard = cardSpendTotals(routing);
    const unsupportedRouting = [];

    for (const category of CATEGORIES) {
      for (const row of routing[category] || []) {
        const card = RULES.cards[row.card];
        if (!card) {
          unsupportedRouting.push({ category, card: row.card, amount: row.amount });
          continue;
        }
        const earned = categoryPoints(row.card, category, row.amount, profile);
        if (earned.currency) pointsByCurrency[earned.currency] = (pointsByCurrency[earned.currency] || 0) + earned.points;
      }
    }

    const valuations = VALUATIONS[valuationScenario] || VALUATIONS.base;
    let travelValue = 0;
    for (const [currency, points] of Object.entries(pointsByCurrency)) {
      const utility = profile.currencyUtility[currency] ?? 0.5;
      travelValue += points * (valuations[currency] || 0) * utility;
    }

    let annualFees = 0;
    let benefitValue = 0;
    const unverifiedCards = [];
    for (const cardId of portfolio) {
      const card = RULES.cards[cardId];
      if (!card) continue;
      annualFees += card.annualFee || 0;
      benefitValue += naturalBenefitValue(profile, cardId);
      if (card.verificationPending) unverifiedCards.push(cardId);
    }

    const airline = profile.airline.primary;
    const airlineProgress = airline ? airlineProgressWithCardSpend(profile, airline, spendByCard) : null;
    const modeledAirlineStatus = airlineProgress ? statusTierForProgress(airline, airlineProgress) : "";
    const hotelStatus = hotelStatusFromCards(profile, spendByCard);

    return {
      pointsByCurrency: Object.fromEntries(Object.entries(pointsByCurrency).map(([k, v]) => [k, round(v)])),
      grossTravelValue: round(travelValue),
      naturalBenefitValue: round(benefitValue),
      annualFees: round(annualFees),
      netEconomicValue: round(travelValue + benefitValue - annualFees),
      spendByCard,
      airlineProgress,
      modeledAirlineStatus,
      reportedAirlineStatus: profile.airline.reportedStatus,
      modeledHotelStatus: hotelStatus.tier,
      reportedHotelStatus: profile.hotel.reportedStatus,
      hotelStatusDetails: hotelStatus,
      unsupportedRouting,
      unverifiedCards
    };
  }

  function currentRoutingCoverage(profile) {
    const coverage = {};
    let covered = 0;
    for (const category of CATEGORIES) {
      const amount = sum((profile.currentRouting[category] || []).map(r => r.amount));
      coverage[category] = { expected: profile.spend[category], routed: amount, gap: round(profile.spend[category] - amount) };
      covered += Math.min(profile.spend[category], amount);
    }
    return { coverage, ratio: profile.totalSpend ? covered / profile.totalSpend : 1 };
  }

  // -------------------------------------------------------------------------
  // Strategy layer
  // -------------------------------------------------------------------------

  function airlineStrategy(profile) {
    const primary = profile.airline.primary;
    if (!primary) return { type: "none", airline: "", statusUseful: false, reason: "No primary airline relationship established." };
    const routeFit = profile.airline.routeFit[primary];
    const fitKnown = routeFit != null;
    const concentrationOk = profile.airline.share >= MODEL.airlineConcentrationMinimum;
    if (!concentrationOk) return { type: "none", airline: primary, statusUseful: false, reason: "Travel is not concentrated enough to justify airline concentration." };
    if (fitKnown && routeFit < MODEL.routeFitMinimumForConcentration) return { type: "none", airline: primary, statusUseful: false, reason: "Current airline does not meet the minimum route-fit threshold." };
    return {
      type: "keep",
      airline: primary,
      routeFitKnown: fitKnown,
      routeFit: fitKnown ? routeFit : null,
      statusUseful: airlineStatusUsefulness(profile),
      reason: fitKnown ? "Current airline fits the traveler’s routes and concentration." : "Current airline is preserved; independent migration is not allowed without route-fit evidence."
    };
  }

  function hotelStrategy(profile, portfolio) {
    const primary = profile.hotel.primary;
    const hasPlatinum = portfolio.includes("amex_platinum");
    const loyaltyUseful = hotelStatusUsefulness(profile);
    if (profile.constraints.noHotelConcentration) {
      return hasPlatinum ? { type: "premium_booking", program: primary, reason: "Hotel concentration is constrained; premium booking benefits remain available." } : { type: "none", program: primary, reason: "Hotel concentration is constrained." };
    }
    if (loyaltyUseful && hasPlatinum && profile.hotel.premiumStayShare > 0.25) return { type: "mixed", program: primary, reason: "Both chain concentration and premium booking treatment are materially relevant." };
    if (loyaltyUseful) return { type: "loyalty", program: primary, reason: "Qualifying activity and concentration support a hotel loyalty strategy." };
    if (hasPlatinum && profile.hotel.premiumStayShare > 0) return { type: "premium_booking", program: primary, reason: "Premium booking benefits fit the stay pattern better than manufactured hotel status." };
    return { type: "none", program: primary, reason: "No hotel-status strategy is justified by current stay behavior." };
  }

  function relevantFlexibleCards(profile) {
    if (profile.constraints.noNewCards) return [];
    const ids = ["amex_gold", "amex_platinum", "chase_preferred", "chase_reserve", "venture", "venture_x"];
    return ids.filter(id => {
      if (profile.currentCards.includes(id)) return false;
      if (profile.constraints.prohibitedCards.includes(id)) return false;
      const card = RULES.cards[id];
      return (profile.currencyUtility[card.currency] ?? 0) >= 0.55;
    });
  }

  function relevantAirlineCards(profile, airStrategy) {
    if (profile.constraints.noNewCards || !airStrategy.airline || !airStrategy.statusUseful) return [];
    return Object.keys(RULES.cards).filter(id => {
      const card = RULES.cards[id];
      return card.airline === airStrategy.airline && !profile.currentCards.includes(id) && !profile.constraints.prohibitedCards.includes(id);
    });
  }

  function relevantHotelCards(profile) {
    if (profile.constraints.noNewCards || !profile.hotel.primary || profile.constraints.noHotelConcentration) return [];
    if (!hotelStatusUsefulness(profile)) return [];
    return Object.keys(RULES.cards).filter(id => {
      const card = RULES.cards[id];
      return card.hotel === profile.hotel.primary && !profile.currentCards.includes(id) && !profile.constraints.prohibitedCards.includes(id);
    });
  }

  function candidatePortfolios(profile) {
    const base = uniq([...profile.currentCards, ...profile.constraints.requiredCards]);
    const air = airlineStrategy(profile);
    const additions = uniq([...relevantFlexibleCards(profile), ...relevantAirlineCards(profile, air), ...relevantHotelCards(profile)]);
    const sets = new Map();
    const addSet = cards => {
      const sorted = uniq(cards).sort();
      const newCount = sorted.filter(id => !base.includes(id)).length;
      if (newCount > profile.constraints.maxNewCards) return;
      const key = sorted.join("|");
      if (!sets.has(key)) sets.set(key, sorted);
    };

    addSet(base);

    for (const add of additions) {
      addSet([...base, add]);
      for (const existing of base) {
        if (profile.constraints.requiredCards.includes(existing)) continue;
        addSet([...base.filter(id => id !== existing), add]);
      }
    }

    // Removal-only cases expose redundancy and ensure fees cannot vanish silently.
    for (const existing of base) {
      if (profile.constraints.requiredCards.includes(existing)) continue;
      addSet(base.filter(id => id !== existing));
    }

    // Limited two-add combinations: one flexible plus one airline/hotel mechanism.
    const flex = relevantFlexibleCards(profile);
    const purpose = uniq([...relevantAirlineCards(profile, air), ...relevantHotelCards(profile)]);
    for (const f of flex) for (const p of purpose) if (f !== p) addSet([...base, f, p]);

    return [...sets.values()];
  }

  function cardValueForCategory(profile, cardId, category, scenario = "base") {
    const card = RULES.cards[cardId];
    if (!card) return -Infinity;
    const rate = earningRate(card, category, profile);
    const utility = profile.currencyUtility[card.currency] ?? 0.5;
    return rate * (VALUATIONS[scenario][card.currency] || 0) * utility;
  }

  function routeSpendNormally(profile, portfolio, scenario = "base") {
    const routing = {};
    for (const category of CATEGORIES) {
      const amount = profile.spend[category];
      if (amount <= 0) { routing[category] = []; continue; }
      let best = null;
      let bestValue = -Infinity;
      for (const cardId of portfolio) {
        if (!RULES.cards[cardId]) continue;
        const v = cardValueForCategory(profile, cardId, category, scenario);
        if (v > bestValue) { bestValue = v; best = cardId; }
      }
      routing[category] = best ? [{ card: best, amount }] : [];
    }
    return routing;
  }

  function nextAirlineThreshold(profile, airline) {
    const rules = RULES.airlines[airline];
    if (!rules) return null;
    const p = profile.statusProgress[airline] || {};
    const currentMetric = airline === "delta" ? p.mqd : airline === "united" ? p.pqp : airline === "american" ? p.loyaltyPoints : p.tqp;
    return rules.thresholds.find(row => row.amount > currentMetric) || null;
  }

  function qualifyingStatusCardIds(portfolio, airline) {
    return portfolio.filter(id => RULES.cards[id]?.airline === airline && RULES.cards[id]?.status);
  }

  function statusSpendNeeded(profile, airline, cardId) {
    const card = RULES.cards[cardId];
    const threshold = nextAirlineThreshold(profile, airline);
    if (!card?.status || !threshold) return null;
    const s = card.status;
    const p = profile.statusProgress[airline] || {};
    let base = airline === "delta" ? p.mqd : airline === "united" ? p.pqp : airline === "american" ? p.loyaltyPoints : p.tqp;
    if (airline === "delta") base += s.headstart || 0;
    if (airline === "united" && s.annualBonus) {
      const tenure = profile.cardTenure[cardId] || {};
      if (!s.bonusRequiresPriorYearOpen || tenure.eligibleAnnualBonus === true) base += s.annualBonus;
    }
    const gap = Math.max(0, threshold.amount - base);
    if (gap <= 0) return { spend: 0, target: threshold };
    if (airline === "delta") return { spend: gap * s.spendDivisor, target: threshold };
    if (airline === "united") return { spend: gap * s.spendDivisor, target: threshold };
    if (airline === "american") return { spend: gap / (s.lpPerEligiblePurchaseDollar || 1), target: threshold };
    if (airline === "southwest") return { spend: Math.ceil(gap / (s.tqpPerBlock || 1)) * (s.spendBlock || 0), target: threshold };
    return null;
  }

  function applyUsefulStatusRouting(profile, portfolio, routing, scenario = "base") {
    const air = airlineStrategy(profile);
    if (!air.statusUseful || !air.airline) return { routing, statusTarget: null, opportunityCost: 0 };
    const statusCards = qualifyingStatusCardIds(portfolio, air.airline);
    if (!statusCards.length) return { routing, statusTarget: null, opportunityCost: 0 };

    let bestPlan = null;
    for (const statusCard of statusCards) {
      const need = statusSpendNeeded(profile, air.airline, statusCard);
      if (!need || need.spend <= 0 || need.spend > profile.totalSpend) continue;
      let remaining = need.spend;
      let cost = 0;
      const shifts = [];
      const categoryLosses = CATEGORIES.map(category => {
        const normalCard = routing[category]?.[0]?.card;
        const amount = routing[category]?.[0]?.amount || 0;
        const normal = normalCard ? cardValueForCategory(profile, normalCard, category, scenario) : 0;
        const status = cardValueForCategory(profile, statusCard, category, scenario);
        return { category, amount, lossPerDollar: Math.max(0, normal - status) };
      }).sort((a, b) => a.lossPerDollar - b.lossPerDollar);

      for (const item of categoryLosses) {
        if (remaining <= 0) break;
        const shifted = Math.min(item.amount, remaining);
        if (shifted <= 0) continue;
        shifts.push({ ...item, shifted });
        cost += shifted * item.lossPerDollar;
        remaining -= shifted;
      }
      if (remaining > 0) continue;
      if (cost > MODEL.statusSpendOpportunityCostLimit) continue;
      if (!bestPlan || cost < bestPlan.cost) bestPlan = { statusCard, need, shifts, cost };
    }

    if (!bestPlan) return { routing, statusTarget: null, opportunityCost: 0 };

    const adjusted = deepClone(routing);
    for (const shift of bestPlan.shifts) {
      const rows = adjusted[shift.category] || [];
      const normal = rows[0];
      if (!normal) continue;
      normal.amount = round(Math.max(0, normal.amount - shift.shifted));
      const existing = rows.find(r => r.card === bestPlan.statusCard);
      if (existing) existing.amount = round(existing.amount + shift.shifted);
      else rows.push({ card: bestPlan.statusCard, amount: round(shift.shifted) });
      adjusted[shift.category] = rows.filter(r => r.amount > 0);
    }

    return {
      routing: adjusted,
      statusTarget: { airline: air.airline, tier: bestPlan.need.target.tier, cardId: bestPlan.statusCard, spendDirected: round(bestPlan.need.spend) },
      opportunityCost: round(bestPlan.cost)
    };
  }

  // -------------------------------------------------------------------------
  // Outcomes, actions, confidence
  // -------------------------------------------------------------------------

  function complexity(profile, portfolio, economics) {
    const currencies = uniq(portfolio.map(id => RULES.cards[id]?.currency).filter(Boolean));
    const newCards = portfolio.filter(id => !profile.currentCards.includes(id));
    return {
      cardCount: portfolio.length,
      newCardCount: newCards.length,
      currencyCount: currencies.length,
      burden: portfolio.length * MODEL.complexityPenaltyPerCard + currencies.length * MODEL.complexityPenaltyPerCurrency + newCards.length
    };
  }

  function outcomeLedger(profile, portfolio, economics, strategyMeta) {
    const currentStatus = currentReportedStatus(profile);
    const modeledAirlineStatus = economics.modeledAirlineStatus;
    const modeledHotelStatus = economics.modeledHotelStatus;
    const hasLounge = portfolio.some(id => (RULES.cards[id]?.benefitTags || []).includes("lounge"));
    const hasPremiumHotel = portfolio.some(id => (RULES.cards[id]?.benefitTags || []).includes("premium_hotel_booking"));
    const comp = complexity(profile, portfolio, economics);
    const tripCost = profile.travel.typicalTripCashCost;
    const equivalentTrips = tripCost > 0 ? economics.grossTravelValue / tripCost : null;

    return {
      travelCapacity: {
        annualTravelValue: economics.grossTravelValue,
        equivalentTrips: equivalentTrips == null ? null : round(equivalentTrips, 1),
        pointsByCurrency: economics.pointsByCurrency
      },
      flightQuality: {
        reportedStatus: currentStatus.airline,
        projectedStatus: modeledAirlineStatus,
        usefulStatusStrategy: !!strategyMeta.statusTarget,
        statusTarget: strategyMeta.statusTarget
      },
      airportExperience: {
        loungeAccess: hasLounge,
        priorityFromStatus: !!modeledAirlineStatus || !!currentStatus.airline
      },
      hotelExperience: {
        reportedStatus: currentStatus.hotel,
        projectedStatus: modeledHotelStatus,
        premiumBooking: hasPremiumHotel,
        strategy: strategyMeta.hotelStrategy.type
      },
      reliability: {
        airlineStatusUseful: airlineStatusUsefulness(profile),
        statusPresent: !!(modeledAirlineStatus || currentStatus.airline)
      },
      cashEfficiency: {
        annualTravelValue: economics.grossTravelValue,
        netEconomicValue: economics.netEconomicValue
      },
      complexity: comp
    };
  }

  function explicitCardActions(profile, portfolio) {
    const actions = [];
    for (const id of profile.currentCards) {
      if (!RULES.cards[id]) actions.push({ cardId: id, action: "manual_review", reason: "Current card is outside the supported rules universe." });
      else if (portfolio.includes(id)) actions.push({ cardId: id, action: "keep", reason: "Card remains part of the recommended implementation." });
      else actions.push({ cardId: id, action: "remove_or_downgrade_after_review", reason: "Modeled strategy does not require this card; final close/downgrade path must be verified before action." });
    }
    for (const id of portfolio) {
      if (!profile.currentCards.includes(id)) actions.push({ cardId: id, action: "add", reason: "Card has a defined role in the recommended travel strategy." });
    }
    return actions;
  }

  function dataQuality(profile, economics) {
    const issues = [];
    const coverage = currentRoutingCoverage(profile);
    if (coverage.ratio < 0.90) issues.push({ code: "routing_incomplete", severity: "high", detail: `Only ${round(coverage.ratio * 100)}% of modeled spend is represented in current routing.` });
    for (const id of profile.currentCards) if (!RULES.cards[id]) issues.push({ code: "unsupported_current_card", severity: "high", detail: id });
    for (const id of economics?.unverifiedCards || []) issues.push({ code: "rule_verification_pending", severity: "medium", detail: id });
    if (profile.airline.primary && profile.airline.routeFit[profile.airline.primary] == null) issues.push({ code: "route_fit_not_independently_verified", severity: "medium", detail: profile.airline.primary });
    if (profile.airline.primary && airlineStatusUsefulness(profile)) {
      const p = profile.statusProgress[profile.airline.primary];
      const known = profile.airline.primary === "delta" ? p?.mqd > 0 : profile.airline.primary === "united" ? p?.pqp > 0 : profile.airline.primary === "american" ? p?.loyaltyPoints > 0 : p?.tqp > 0 || p?.qualifyingFlights > 0;
      if (!known) issues.push({ code: "status_progress_missing", severity: "medium", detail: profile.airline.primary });
    }
    const high = issues.filter(i => i.severity === "high").length;
    const medium = issues.filter(i => i.severity === "medium").length;
    return { level: high ? "low" : medium >= 2 ? "medium" : "high", issues };
  }

  function strategyRecord(profile, portfolio, scenario = "base") {
    const normal = routeSpendNormally(profile, portfolio, scenario);
    const statusAdjusted = applyUsefulStatusRouting(profile, portfolio, normal, scenario);
    const economics = evaluateRouting(profile, statusAdjusted.routing, portfolio, scenario);
    const airStrategy = airlineStrategy(profile);
    const hStrategy = hotelStrategy(profile, portfolio);
    const meta = {
      airlineStrategy: airStrategy,
      hotelStrategy: hStrategy,
      statusTarget: statusAdjusted.statusTarget,
      statusOpportunityCost: statusAdjusted.opportunityCost
    };
    const outcomes = outcomeLedger(profile, portfolio, economics, meta);
    const actions = explicitCardActions(profile, portfolio);
    const quality = dataQuality(profile, economics);
    return {
      id: portfolio.slice().sort().join("+") || "no_cards",
      portfolio: portfolio.slice(),
      routing: statusAdjusted.routing,
      economics,
      strategy: meta,
      outcomes,
      actions,
      quality
    };
  }

  function currentRecord(profile, scenario = "base") {
    const economics = evaluateRouting(profile, profile.currentRouting, profile.currentCards, scenario);
    const meta = { airlineStrategy: airlineStrategy(profile), hotelStrategy: hotelStrategy(profile, profile.currentCards), statusTarget: null, statusOpportunityCost: 0 };
    return {
      id: "current",
      portfolio: profile.currentCards.slice(),
      routing: deepClone(profile.currentRouting),
      economics,
      strategy: meta,
      outcomes: outcomeLedger(profile, profile.currentCards, economics, meta),
      actions: explicitCardActions(profile, profile.currentCards),
      quality: dataQuality(profile, economics)
    };
  }

  function materialComparison(a, b) {
    // Returns material improvements of A relative to B. No opaque weighted score.
    const improvements = [];
    const regressions = [];
    const av = a.outcomes.travelCapacity.annualTravelValue;
    const bv = b.outcomes.travelCapacity.annualTravelValue;
    if (av - bv >= MODEL.materialAnnualTravelValue) improvements.push("travelCapacity");
    if (bv - av >= MODEL.materialAnnualTravelValue) regressions.push("travelCapacity");

    const an = a.outcomes.cashEfficiency.netEconomicValue;
    const bn = b.outcomes.cashEfficiency.netEconomicValue;
    if (an - bn >= MODEL.materialCashImprovement) improvements.push("cashEfficiency");
    if (bn - an >= MODEL.materialCashImprovement) regressions.push("cashEfficiency");

    const as = tierIndex(a.strategy.airlineStrategy.airline, a.outcomes.flightQuality.projectedStatus);
    const bs = tierIndex(b.strategy.airlineStrategy.airline, b.outcomes.flightQuality.projectedStatus);
    if (a.strategy.airlineStrategy.airline === b.strategy.airlineStrategy.airline) {
      if (as > bs) improvements.push("flightQuality");
      if (bs > as) regressions.push("flightQuality");
    }

    const ah = a.outcomes.hotelExperience.projectedStatus;
    const bh = b.outcomes.hotelExperience.projectedStatus;
    const hp = a.strategy.hotelStrategy.program || b.strategy.hotelStrategy.program;
    if (hp) {
      const ai = tierIndex(hp, ah), bi = tierIndex(hp, bh);
      if (ai > bi || (a.outcomes.hotelExperience.premiumBooking && !b.outcomes.hotelExperience.premiumBooking)) improvements.push("hotelExperience");
      if (bi > ai || (b.outcomes.hotelExperience.premiumBooking && !a.outcomes.hotelExperience.premiumBooking)) regressions.push("hotelExperience");
    }

    if (a.outcomes.airportExperience.loungeAccess && !b.outcomes.airportExperience.loungeAccess) improvements.push("airportExperience");
    if (b.outcomes.airportExperience.loungeAccess && !a.outcomes.airportExperience.loungeAccess) regressions.push("airportExperience");

    const ac = a.outcomes.complexity.burden, bc = b.outcomes.complexity.burden;
    if (bc - ac >= 2) improvements.push("complexity");
    if (ac - bc >= 2) regressions.push("complexity");

    return { improvements: uniq(improvements), regressions: uniq(regressions) };
  }

  function dominates(a, b) {
    const c = materialComparison(a, b);
    return c.improvements.length > 0 && c.regressions.length === 0;
  }

  function paretoSurvivors(records) {
    return records.filter((candidate, i) => !records.some((other, j) => i !== j && dominates(other, candidate)));
  }

  function chooseRecommended(profile, records, current) {
    const survivors = paretoSurvivors(records);
    // Aspirations are intentionally NOT referenced here.
    // 1) Prefer strategies with more distinct material improvements over current.
    // 2) Then lower complexity.
    // 3) Then stronger base economics.
    const ranked = survivors.map(r => {
      const cmp = materialComparison(r, current);
      return { record: r, improvements: cmp.improvements, regressions: cmp.regressions };
    }).filter(x => x.regressions.length === 0 || x.improvements.length > x.regressions.length);

    ranked.sort((x, y) => {
      if (y.improvements.length !== x.improvements.length) return y.improvements.length - x.improvements.length;
      const xc = x.record.outcomes.complexity.burden, yc = y.record.outcomes.complexity.burden;
      if (xc !== yc) return xc - yc;
      return y.record.economics.netEconomicValue - x.record.economics.netEconomicValue;
    });

    const best = ranked[0]?.record || current;
    const againstCurrent = materialComparison(best, current);
    if (!againstCurrent.improvements.length) return current;
    return best;
  }

  function sensitivity(profile, portfolio) {
    const result = {};
    for (const scenario of ["conservative", "base", "upper"]) result[scenario] = strategyRecord(profile, portfolio, scenario);
    const ids = Object.values(result).map(r => r.id);
    return { scenarios: result, strategyStable: new Set(ids).size === 1 };
  }

  function presentationOrder(profile, recommended) {
    const base = ["travelCapacity", "flightQuality", "airportExperience", "hotelExperience", "reliability", "cashEfficiency", "complexity"];
    const mapping = {
      "travel more": ["travelCapacity", "cashEfficiency"],
      "fly & airport better": ["flightQuality", "airportExperience", "reliability"],
      "fly and airport better": ["flightQuality", "airportExperience", "reliability"],
      "stay better": ["hotelExperience"],
      "get more travel from what i already spend": ["travelCapacity", "cashEfficiency"],
      "show me everything": []
    };
    const first = [];
    for (const a of profile.aspirations) for (const key of mapping[a] || []) if (!first.includes(key)) first.push(key);
    return [...first, ...base.filter(k => !first.includes(k))];
  }

  function allMaterialBenefits(current, recommended) {
    const cmp = materialComparison(recommended, current);
    return cmp.improvements.map(key => ({ key, outcome: recommended.outcomes[key] }));
  }

  function analyze(rawProfile) {
    const profile = rawProfile?.__normalizedV5 ? rawProfile : normalizeProfile(rawProfile);
    const current = currentRecord(profile, "base");
    const portfolios = candidatePortfolios(profile);
    const records = portfolios.map(p => strategyRecord(profile, p, "base"));
    const recommended = chooseRecommended(profile, records, current);
    const sens = sensitivity(profile, recommended.portfolio);

    return {
      engineVersion: ENGINE_VERSION,
      rulesAsOf: RULES_AS_OF,
      profile,
      current,
      recommended,
      candidatesEvaluated: records.length,
      paretoSurvivorIds: paretoSurvivors(records).map(r => r.id),
      allMaterialBenefits: allMaterialBenefits(current, recommended),
      presentation: {
        aspirations: profile.aspirations,
        order: presentationOrder(profile, recommended)
      },
      sensitivity: {
        strategyStable: sens.strategyStable,
        economics: Object.fromEntries(Object.entries(sens.scenarios).map(([k, v]) => [k, {
          grossTravelValue: v.economics.grossTravelValue,
          netEconomicValue: v.economics.netEconomicValue
        }]))
      },
      integrity: {
        aspirationsUsedInRecommendationSelection: false,
        factsConstraintsAspirationsSeparated: true,
        reportedStatusAuthoritative: true,
        currentRoutingCoverage: currentRoutingCoverage(profile)
      }
    };
  }

  function recommendationFingerprint(result) {
    const r = result.recommended;
    return JSON.stringify({
      portfolio: r.portfolio.slice().sort(),
      routing: r.routing,
      airlineStrategy: r.strategy.airlineStrategy,
      hotelStrategy: r.strategy.hotelStrategy,
      statusTarget: r.strategy.statusTarget
    });
  }

  return Object.freeze({
    ENGINE_VERSION,
    RULES_AS_OF,
    RULES,
    VALUATIONS,
    MODEL,
    matchCard,
    normalizeProfile,
    currentReportedStatus,
    airlineStatusUsefulness,
    hotelStatusUsefulness,
    airlineProgressWithCardSpend,
    hotelStatusFromCards,
    evaluateRouting,
    airlineStrategy,
    hotelStrategy,
    candidatePortfolios,
    strategyRecord,
    currentRecord,
    materialComparison,
    paretoSurvivors,
    analyze,
    recommendationFingerprint
  });
});