/**
 * Quiet Premium — qp_sim_v5.js
 * Isolated V5 Travel-Strategy Engine
 * Build: 5.0-alpha.2
 * Date: 2026-09-17
 *
 * NOT wired to diagnostic.html or any customer-facing page.
 *
 * NORTH STAR
 * Optimize for the best realistic travel life from money the customer already
 * spends. Points, cards, status and benefits are mechanisms, not the objective.
 *
 * LOCKED DISTINCTIONS
 * - Facts determine opportunity.
 * - Behavioral constraints determine feasibility.
 * - Aspirations determine presentation order/emphasis ONLY.
 * - Benefit visibility is separate from recommendation credit.
 *   Real supported benefits stay visible; internal weighting only determines
 *   how much a benefit helps justify a recommendation.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.QuietPremiumEngineV5 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENGINE_VERSION = "5.0-alpha.2";
  const RULES_AS_OF = "2026-09-17";
  const CATEGORIES = ["dining", "grocery", "airfare", "hotel", "general"];

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
  const uniq = a => [...new Set((a || []).filter(Boolean))];
  const sum = a => (a || []).reduce((x, y) => x + (Number(y) || 0), 0);
  const clone = x => JSON.parse(JSON.stringify(x));

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
        diamondReserve: { tier: "Diamond Reserve", nights: 80, stays: 40, spend: 18000 }
      }
    },
    cards: {
      amex_gold: {
        label: "American Express Gold Card",
        family: "amex",
        currency: "amex_mr",
        annualFee: 325,
        earn: { dining: 4, grocery: 4, airfare: 3, hotel: 1, general: 1 },
        caps: { dining: 50000, grocery: 25000 }
      },
      amex_platinum: {
        label: "The Platinum Card from American Express",
        family: "amex",
        currency: "amex_mr",
        annualFee: 895,
        earn: { dining: 1, grocery: 1, airfare: 5, hotel: 1, general: 1 },
        caps: { airfare: 500000 },
        benefitTags: ["lounge", "premium_hotel_booking"]
      },
      chase_preferred: {
        label: "Chase Sapphire Preferred",
        family: "chase",
        currency: "chase_ur",
        annualFee: 95,
        earn: { dining: 3, grocery: 1, airfare: 2, hotel: 2, general: 1 },
        verificationPending: true
      },
      chase_reserve: {
        label: "Chase Sapphire Reserve",
        family: "chase",
        currency: "chase_ur",
        annualFee: 795,
        earn: { dining: 3, grocery: 1, airfare: 4, hotel: 4, general: 1 },
        benefitTags: ["lounge", "travel_credit"]
      },
      venture: {
        label: "Capital One Venture Rewards",
        family: "capital_one",
        currency: "capital_one_miles",
        annualFee: 95,
        earn: { dining: 2, grocery: 2, airfare: 2, hotel: 2, general: 2 }
      },
      venture_x: {
        label: "Capital One Venture X Rewards",
        family: "capital_one",
        currency: "capital_one_miles",
        annualFee: 395,
        earn: { dining: 2, grocery: 2, airfare: 2, hotel: 2, general: 2 },
        benefitTags: ["lounge", "travel_credit", "anniversary_miles"]
      },
      delta_platinum: {
        label: "Delta SkyMiles Platinum American Express Card",
        family: "delta",
        currency: "skymiles",
        annualFee: 350,
        earn: { dining: 2, grocery: 2, airfare: 3, hotel: 3, general: 1 },
        airline: "delta",
        status: { headstart: 2500, spendDivisor: 20 },
        benefitTags: ["companion_certificate_renewal"]
      },
      delta_reserve: {
        label: "Delta SkyMiles Reserve American Express Card",
        family: "delta",
        currency: "skymiles",
        annualFee: 650,
        earn: { dining: 1, grocery: 1, airfare: 3, hotel: 1, general: 1 },
        airline: "delta",
        status: { headstart: 2500, spendDivisor: 10 },
        benefitTags: ["lounge", "upgrade_priority", "companion_certificate_renewal"]
      },
      united_explorer: {
        label: "United Explorer Card",
        family: "united",
        currency: "united_miles",
        annualFee: 150,
        earn: { dining: 2, grocery: 1, airfare: 3, hotel: 2, general: 1 },
        airline: "united",
        status: { spendDivisor: 20, annualCap: 1000 },
        verificationPending: true
      },
      united_quest: {
        label: "United Quest Card",
        family: "united",
        currency: "united_miles",
        annualFee: 350,
        earn: { dining: 2, grocery: 1, airfare: 4, hotel: 2, general: 1 },
        airline: "united",
        status: { spendDivisor: 20, annualCap: 18000, annualBonus: 1000, bonusRequiresPriorYearOpen: true }
      },
      united_club: {
        label: "United Club Card",
        family: "united",
        currency: "united_miles",
        annualFee: 695,
        earn: { dining: 2, grocery: 1, airfare: 5, hotel: 2, general: 1 },
        airline: "united",
        status: { spendDivisor: 15, annualCap: 28000, annualBonus: 1500, bonusRequiresPriorYearOpen: true },
        benefitTags: ["lounge"]
      },
      aa_executive: {
        label: "Citi / AAdvantage Executive World Legend Mastercard",
        family: "american",
        currency: "aadvantage",
        annualFee: 695,
        earn: { dining: 1, grocery: 1, airfare: 4, hotel: 1, general: 1 },
        airline: "american",
        status: { lpPerEligiblePurchaseDollar: 1 },
        benefitTags: ["lounge", "priority_airport"]
      },
      southwest_priority: {
        label: "Southwest Rapid Rewards Priority Credit Card",
        family: "southwest",
        currency: "southwest_points",
        annualFee: 229,
        earn: { dining: 2, grocery: 1, airfare: 4, hotel: 1, general: 1 },
        airline: "southwest",
        status: { spendBlock: 5000, tqpPerBlock: 2500 },
        verificationPending: true
      },
      hyatt_consumer: {
        label: "World of Hyatt Credit Card",
        family: "hyatt",
        currency: "hyatt_points",
        annualFee: 95,
        earn: { dining: 2, grocery: 1, airfare: 2, hotel: 4, general: 1 },
        hotel: "hyatt",
        hotelStatus: { automaticTier: "Discoverist", annualNights: 5, spendBlock: 5000, nightsPerBlock: 2 }
      },
      marriott_boundless: {
        label: "Marriott Bonvoy Boundless Credit Card",
        family: "marriott",
        currency: "marriott_points",
        annualFee: 95,
        earn: { dining: 2, grocery: 2, airfare: 2, hotel: 6, general: 2 },
        hotel: "marriott",
        hotelStatus: { automaticTier: "Silver Elite", annualNights: 15 },
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
        benefitTags: ["premium_hotel_benefits"]
      },
      hilton_no_fee: {
        label: "Hilton Honors American Express Card",
        family: "hilton",
        currency: "hilton_points",
        annualFee: 0,
        earn: { dining: 5, grocery: 5, airfare: 3, hotel: 7, general: 3 },
        hotel: "hilton",
        hotelStatus: { automaticTier: "Silver" }
      },
      hilton_surpass: {
        label: "Hilton Honors American Express Surpass Card",
        family: "hilton",
        currency: "hilton_points",
        annualFee: 150,
        earn: { dining: 6, grocery: 6, airfare: 3, hotel: 12, general: 3 },
        hotel: "hilton",
        hotelStatus: { automaticTier: "Gold" }
      },
      hilton_aspire: {
        label: "Hilton Honors American Express Aspire Card",
        family: "hilton",
        currency: "hilton_points",
        annualFee: 550,
        earn: { dining: 7, grocery: 3, airfare: 7, hotel: 14, general: 3 },
        hotel: "hilton",
        hotelStatus: { automaticTier: "Diamond" },
        benefitTags: ["premium_hotel_benefits"]
      }
    }
  });

  const VALUATIONS = Object.freeze({
    conservative: {
      amex_mr: .0125, chase_ur: .0125, capital_one_miles: .010,
      skymiles: .012, united_miles: .012, aadvantage: .013,
      southwest_points: .013, hyatt_points: .017, marriott_points: .007, hilton_points: .005
    },
    base: {
      amex_mr: .020, chase_ur: .020, capital_one_miles: .017,
      skymiles: .015, united_miles: .017, aadvantage: .018,
      southwest_points: .014, hyatt_points: .022, marriott_points: .009, hilton_points: .008
    },
    upper: {
      amex_mr: .024, chase_ur: .024, capital_one_miles: .020,
      skymiles: .018, united_miles: .021, aadvantage: .022,
      southwest_points: .016, hyatt_points: .026, marriott_points: .011, hilton_points: .010
    }
  });

  const MODEL = Object.freeze({
    maxPortfolioCards: 4,
    maxNewCardsDefault: 2,
    materialTravelValue: 400,
    materialCashImprovement: 300,
    minFlightsForStatus: 8,
    minHotelNightsForStatus: 8,
    minAirlineShare: .55,
    minHotelShare: .45,
    complexityPenaltyPerCard: 1.25,
    complexityPenaltyPerCurrency: .75,
    statusOpportunityCostLimit: 900,
    incrementalTravelValuePerExtraCard: 750
  });

  const CARD_ALIASES = [
    ["hilton_aspire", ["hilton honors american express aspire", "hilton aspire"]],
    ["hilton_surpass", ["hilton honors american express surpass", "hilton surpass"]],
    ["hilton_no_fee", ["hilton honors american express card", "hilton honors american express"]],
    ["marriott_brilliant", ["marriott bonvoy brilliant"]],
    ["marriott_boundless", ["marriott bonvoy boundless"]],
    ["delta_reserve", ["delta skymiles reserve", "delta reserve"]],
    ["delta_platinum", ["delta skymiles platinum", "delta platinum"]],
    ["united_club", ["united club"]],
    ["united_quest", ["united quest"]],
    ["united_explorer", ["united explorer"]],
    ["aa_executive", ["aadvantage executive", "american airlines executive", "citi / aadvantage executive"]],
    ["southwest_priority", ["southwest rapid rewards priority", "southwest priority"]],
    ["hyatt_consumer", ["world of hyatt credit card", "world of hyatt card"]],
    ["amex_platinum", ["platinum card from american express", "american express platinum", "amex platinum"]],
    ["amex_gold", ["american express gold", "amex gold"]],
    ["chase_reserve", ["chase sapphire reserve", "sapphire reserve"]],
    ["chase_preferred", ["chase sapphire preferred", "sapphire preferred"]],
    ["venture_x", ["capital one venture x", "venture x"]],
    ["venture", ["capital one venture rewards", "capital one venture"]]
  ];

  function matchCard(v) {
    const s = lc(v);
    if (!s) return null;
    if (RULES.cards[s]) return s;
    for (const [id, aliases] of CARD_ALIASES) {
      if (aliases.some(a => s.includes(a))) return id;
    }
    return null;
  }

  function normalizeSpend(raw = {}) {
    const s = raw.spend || raw;
    return {
      dining: num(s.dining ?? raw.dining_spend),
      grocery: num(s.grocery ?? raw.grocery_spend),
      airfare: num(s.airfare ?? raw.household_airfare_spend ?? raw.airfare_spend),
      hotel: num(s.hotel ?? raw.hotel_spend),
      general: num(s.general ?? raw.general_spend)
    };
  }

  function normalizeSpendMap(raw = {}, fallback = {}) {
    const r = raw || {};
    return Object.fromEntries(CATEGORIES.map(c => [c, num(r[c] ?? fallback[c] ?? 0)]));
  }

  function normalizeRouting(raw = {}, spend) {
    const input = raw.currentRouting || raw.current_routing || {};
    const out = {};
    for (const c of CATEGORIES) {
      const rows = Array.isArray(input[c]) ? input[c] : [];
      out[c] = rows.map(row => ({
        card: matchCard(row.card || row.cardId || row.name) || clean(row.card || row.cardId || row.name),
        amount: num(row.amount)
      })).filter(r => r.card && r.amount > 0);
      if (!out[c].length) {
        const fallback = matchCard(raw[`card_${c}`] || (c === "general" ? raw.card_general : ""));
        if (fallback && spend[c] > 0) out[c] = [{ card: fallback, amount: spend[c] }];
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

  function normalizeFutureActivity(raw = {}, annualSpend) {
    const f = raw.futureActivity || raw.future_activity || {};
    const s = f.statusSpend || f.status_spend || raw.futureStatusSpend || raw.future_status_spend || {};
    return {
      statusSpend: normalizeSpendMap(s, annualSpend),
      delta: { mqd: num(f.delta?.mqd ?? raw.future_delta_mqd) },
      united: { pqp: num(f.united?.pqp ?? raw.future_united_pqp), pqf: num(f.united?.pqf ?? raw.future_united_pqf) },
      american: { loyaltyPoints: num(f.american?.loyaltyPoints ?? raw.future_american_loyalty_points) },
      southwest: { tqp: num(f.southwest?.tqp ?? raw.future_southwest_tqp), qualifyingFlights: num(f.southwest?.qualifyingFlights ?? raw.future_southwest_qualifying_flights) },
      hotel: {
        qualifyingNights: num(f.hotel?.qualifyingNights ?? raw.future_hotel_qualifying_nights),
        qualifyingStays: num(f.hotel?.qualifyingStays ?? raw.future_hotel_qualifying_stays),
        qualifyingSpend: num(f.hotel?.qualifyingSpend ?? raw.future_hotel_qualifying_spend)
      }
    };
  }

  function normalizeProfile(raw = {}) {
    const spend = normalizeSpend(raw);
    const currentCardsRaw = raw.currentCards || raw.primary_cards || raw.cards || [];
    const currentCards = uniq((Array.isArray(currentCardsRaw) ? currentCardsRaw : [currentCardsRaw])
      .map(v => matchCard(v) || clean(v)).filter(Boolean));
    const primaryAirline = lc(raw.primaryAirline || raw.primary_airline_eco || raw.primary_airline);
    const primaryHotel = lc(raw.primaryHotel || raw.primary_hotel || raw.hotel_program);
    const aspirationsRaw = raw.aspirations || raw.desiredOutcomes || raw.desired_outcomes || [];
    const aspirations = uniq((Array.isArray(aspirationsRaw) ? aspirationsRaw : [aspirationsRaw]).map(lc));
    const constraints = raw.constraints || {};
    const airlineShareRaw = num(raw.primaryAirlineShare ?? raw.primary_airline_share ?? raw.airline_concentration);
    const hotelShareRaw = num(raw.primaryHotelShare ?? raw.primary_hotel_share ?? raw.hotel_concentration);
    const routeFitRaw = raw.routeFit || raw.route_fit || {};
    const statusProgress = normalizeStatusProgress(raw);
    return {
      spend,
      totalSpend: sum(Object.values(spend)),
      currentCards,
      currentRouting: normalizeRouting(raw, spend),
      statusProgress,
      futureActivity: normalizeFutureActivity(raw, spend),
      progressIncludesCurrentCardCredits: raw.progressIncludesCurrentCardCredits !== false,
      cardTenure: raw.cardTenure || raw.card_tenure || {},
      naturalBenefitValue: raw.naturalBenefitValue || raw.natural_benefit_value || {},
      explicitBenefitUse: raw.explicitBenefitUse || raw.explicit_benefit_use || {},
      currencyUtility: {
        amex_mr: clamp(num(raw.currencyUtility?.amex_mr ?? 1), 0, 1),
        chase_ur: clamp(num(raw.currencyUtility?.chase_ur ?? 1), 0, 1),
        capital_one_miles: clamp(num(raw.currencyUtility?.capital_one_miles ?? 1), 0, 1),
        skymiles: clamp(num(raw.currencyUtility?.skymiles ?? (primaryAirline === "delta" ? 1 : .45)), 0, 1),
        united_miles: clamp(num(raw.currencyUtility?.united_miles ?? (primaryAirline === "united" ? 1 : .45)), 0, 1),
        aadvantage: clamp(num(raw.currencyUtility?.aadvantage ?? (primaryAirline === "american" ? 1 : .45)), 0, 1),
        southwest_points: clamp(num(raw.currencyUtility?.southwest_points ?? (primaryAirline === "southwest" ? 1 : .45)), 0, 1),
        hyatt_points: clamp(num(raw.currencyUtility?.hyatt_points ?? (primaryHotel === "hyatt" ? 1 : .45)), 0, 1),
        marriott_points: clamp(num(raw.currencyUtility?.marriott_points ?? (primaryHotel === "marriott" ? 1 : .45)), 0, 1),
        hilton_points: clamp(num(raw.currencyUtility?.hilton_points ?? (primaryHotel === "hilton" ? 1 : .45)), 0, 1)
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
        share: clamp((airlineShareRaw > 1 ? airlineShareRaw / 100 : airlineShareRaw) || (primaryAirline ? .70 : 0), 0, 1),
        reportedStatus: clean(raw.currentAirlineStatus || raw.primary_airline_status || raw.airline_status),
        routeFit: Object.fromEntries(Object.entries(routeFitRaw).map(([k,v]) => [lc(k), clamp(num(v),0,1)])),
        statusUsefulOverride: typeof raw.airlineStatusUseful === "boolean" ? raw.airlineStatusUseful : null
      },
      hotel: {
        primary: primaryHotel,
        share: clamp((hotelShareRaw > 1 ? hotelShareRaw / 100 : hotelShareRaw) || (primaryHotel ? .60 : 0), 0, 1),
        reportedStatus: clean(raw.currentHotelStatus || raw.primary_hotel_status || raw.hotel_status),
        premiumStayShare: clamp(num(raw.premiumStayShare ?? raw.premium_stay_share) > 1
          ? num(raw.premiumStayShare ?? raw.premium_stay_share)/100
          : num(raw.premiumStayShare ?? raw.premium_stay_share), 0, 1)
      },
      aspirations,
      constraints: {
        noNewCards: !!constraints.noNewCards,
        maxNewCards: constraints.maxNewCards == null ? MODEL.maxNewCardsDefault : Math.max(0, num(constraints.maxNewCards)),
        noAirlineChange: constraints.noAirlineChange !== false,
        noHotelConcentration: !!constraints.noHotelConcentration,
        noPortalBooking: !!constraints.noPortalBooking,
        prohibitedCards: uniq((constraints.prohibitedCards || []).map(v => matchCard(v) || clean(v))),
        requiredCards: uniq((constraints.requiredCards || []).map(v => matchCard(v) || clean(v)))
      },
      __normalizedV5: true,
      meta: { rawProfileId: clean(raw.id || raw.profileId), source: raw.source || "v5" }
    };
  }

  function tierIndex(program, tier) {
    if (!program || !tier) return -1;
    const rules = RULES.airlines[program]?.thresholds || RULES.hotels[program]?.thresholds || [];
    return rules.findIndex(r => lc(r.tier) === lc(tier));
  }

  function maxTier(program, a, b) {
    return tierIndex(program, a) >= tierIndex(program, b) ? (a || "") : (b || "");
  }

  function airlineStatusUsefulness(p) {
    if (p.airline.statusUsefulOverride != null) return !!p.airline.statusUsefulOverride;
    return !!p.airline.primary &&
      p.airline.share >= MODEL.minAirlineShare &&
      p.travel.annualOneWayFlights >= MODEL.minFlightsForStatus &&
      p.travel.bookingControl !== "none";
  }

  function hotelStatusUsefulness(p) {
    return !!p.hotel.primary && !p.constraints.noHotelConcentration &&
      p.hotel.share >= MODEL.minHotelShare &&
      (p.statusProgress.hotel.qualifyingNights + p.futureActivity.hotel.qualifyingNights) >= MODEL.minHotelNightsForStatus;
  }

  function progressMetric(p, airline) {
    const x = p.statusProgress[airline] || {};
    return airline === "delta" ? x.mqd :
      airline === "united" ? x.pqp :
      airline === "american" ? x.loyaltyPoints :
      airline === "southwest" ? x.tqp : 0;
  }

  function organicFutureMetric(p, airline) {
    const x = p.futureActivity[airline] || {};
    return airline === "delta" ? x.mqd :
      airline === "united" ? x.pqp :
      airline === "american" ? x.loyaltyPoints :
      airline === "southwest" ? x.tqp : 0;
  }

  function tierForAirlineProgress(airline, metric, flights) {
    const rules = RULES.airlines[airline];
    if (!rules) return "";
    let tier = "";
    for (const r of rules.thresholds || []) if (metric >= r.amount) tier = r.tier;
    if (airline === "southwest") {
      for (const r of rules.flightThresholds || []) if (flights >= r.flights) tier = r.tier;
    }
    return tier;
  }

  function airlineFutureProgress(p, airline, futureCardSpend = {}) {
    let metric = progressMetric(p, airline) + organicFutureMetric(p, airline);
    let flights = (p.statusProgress.southwest?.qualifyingFlights || 0) +
      (p.futureActivity.southwest?.qualifyingFlights || 0);
    const contributions = [];
    for (const [cardId, spendRaw] of Object.entries(futureCardSpend || {})) {
      const card = RULES.cards[cardId];
      if (!card || card.airline !== airline || !card.status) continue;
      const spend = num(spendRaw);
      let added = 0;
      if (airline === "delta") {
        if (!p.currentCards.includes(cardId)) added += card.status.headstart || 0;
        added += spend / (card.status.spendDivisor || Infinity);
      } else if (airline === "united") {
        added += Math.min(card.status.annualCap || Infinity, spend / (card.status.spendDivisor || Infinity));
        const pending = p.cardTenure[cardId]?.futureAnnualBonusEligible === true;
        if (pending && card.status.annualBonus) added += card.status.annualBonus;
      } else if (airline === "american") {
        added += spend * (card.status.lpPerEligiblePurchaseDollar || 0);
      } else if (airline === "southwest") {
        added += Math.floor(spend / (card.status.spendBlock || Infinity)) * (card.status.tqpPerBlock || 0);
      }
      metric += added;
      contributions.push({ cardId, spend: round(spend), added: round(added) });
    }
    return { metric: round(metric), qualifyingFlights: flights, contributions, tier: tierForAirlineProgress(airline, metric, flights) };
  }

  function hotelTierFromFacts(p, portfolio, futureCardSpend = {}) {
    const program = p.hotel.primary;
    if (!program || !RULES.hotels[program]) {
      return { projectedTier: "", effectiveTier: p.hotel.reportedStatus || "", qualifyingNights: p.statusProgress.hotel.qualifyingNights };
    }
    let nights = p.statusProgress.hotel.qualifyingNights + p.futureActivity.hotel.qualifyingNights;
    const stays = p.statusProgress.hotel.qualifyingStays + p.futureActivity.hotel.qualifyingStays;
    const qSpend = p.statusProgress.hotel.qualifyingSpend + p.futureActivity.hotel.qualifyingSpend;
    let auto = "";
    const contributions = [];

    for (const cardId of portfolio) {
      const card = RULES.cards[cardId];
      if (!card || card.hotel !== program || !card.hotelStatus) continue;
      const hs = card.hotelStatus;
      let addedNights = 0;
      if (!p.currentCards.includes(cardId)) addedNights += hs.annualNights || 0;
      const futureSpend = num(futureCardSpend[cardId]);
      if (hs.spendBlock && hs.nightsPerBlock) {
        addedNights += Math.floor(futureSpend / hs.spendBlock) * hs.nightsPerBlock;
      }
      nights += addedNights;
      if (hs.automaticTier) auto = maxTier(program, auto, hs.automaticTier);
      contributions.push({ cardId, futureSpend, addedNights, automaticTier: hs.automaticTier || "" });
    }

    let earned = "";
    if (program === "hilton") {
      for (const r of RULES.hotels.hilton.thresholds) {
        if (nights >= r.nights || stays >= r.stays || qSpend >= r.spend) earned = r.tier;
      }
      const d = RULES.hotels.hilton.diamondReserve;
      if (((nights >= d.nights) || (stays >= d.stays)) && qSpend >= d.spend) earned = d.tier;
    } else {
      for (const r of RULES.hotels[program].thresholds) if (nights >= r.nights) earned = r.tier;
    }
    const projectedTier = maxTier(program, earned, auto);
    const effectiveTier = maxTier(program, p.hotel.reportedStatus, projectedTier);
    return { projectedTier, effectiveTier, qualifyingNights: nights, qualifyingStays: stays, qualifyingSpend: qSpend, contributions };
  }

  function earningRate(card, category, amount) {
    if (!card) return 0;
    const base = card.earn?.[category] || 0;
    const cap = card.caps?.[category];
    if (!cap || amount <= cap) return base;
    return ((cap * base) + ((amount - cap) * 1)) / amount;
  }

  function cardCategoryValue(p, cardId, category, amount, scenario) {
    const card = RULES.cards[cardId];
    if (!card || amount <= 0) return -Infinity;
    const rate = earningRate(card, category, amount);
    const utility = p.currencyUtility[card.currency] ?? .5;
    return rate * (VALUATIONS[scenario][card.currency] || 0) * utility;
  }

  function routeAnnualSpend(p, portfolio, scenario) {
    const routing = {};
    for (const c of CATEGORIES) {
      const amount = p.spend[c];
      if (!amount) { routing[c] = []; continue; }
      let best = null, bestV = -Infinity;
      for (const cardId of portfolio) {
        const v = cardCategoryValue(p, cardId, c, amount, scenario);
        if (v > bestV) { bestV = v; best = cardId; }
      }
      routing[c] = best ? [{ card: best, amount }] : [];
    }
    return routing;
  }

  function pointsFromRouting(p, routing, scenario) {
    const byCurrency = {};
    for (const c of CATEGORIES) {
      for (const row of routing[c] || []) {
        const card = RULES.cards[row.card];
        if (!card) continue;
        const amount = num(row.amount);
        const pts = amount * earningRate(card, c, amount);
        byCurrency[card.currency] = (byCurrency[card.currency] || 0) + pts;
      }
    }
    let gross = 0;
    for (const [cur, pts] of Object.entries(byCurrency)) {
      gross += pts * (VALUATIONS[scenario][cur] || 0) * (p.currencyUtility[cur] ?? .5);
    }
    return { byCurrency: Object.fromEntries(Object.entries(byCurrency).map(([k,v]) => [k, round(v)])), grossTravelValue: round(gross) };
  }

  function visibleBenefits(portfolio) {
    const out = [];
    for (const id of portfolio) {
      const card = RULES.cards[id];
      for (const tag of card?.benefitTags || []) out.push({ cardId: id, benefit: tag });
      if (card?.hotelStatus?.automaticTier) out.push({ cardId: id, benefit: "automatic_hotel_status", detail: card.hotelStatus.automaticTier });
      if (card?.airline && card?.status) out.push({ cardId: id, benefit: "status_earning_mechanism", detail: card.airline });
    }
    return out;
  }

  function benefitRecommendationCredit(p, portfolio) {
    const credits = {
      lounge: 0,
      premiumHotel: 0,
      priorityAirport: 0,
      upgradePriority: 0
    };
    const tags = new Set(portfolio.flatMap(id => RULES.cards[id]?.benefitTags || []));
    if (tags.has("lounge") && p.travel.annualOneWayFlights >= 6) credits.lounge = 1;
    if ((tags.has("premium_hotel_booking") || tags.has("premium_hotel_benefits")) && p.spend.hotel > 0 && p.hotel.premiumStayShare > 0) credits.premiumHotel = 1;
    if (tags.has("priority_airport") && p.travel.annualOneWayFlights >= 6) credits.priorityAirport = 1;
    if (tags.has("upgrade_priority") && p.airline.primary === "delta" && p.travel.annualOneWayFlights >= 8) credits.upgradePriority = 1;
    return credits;
  }

  function naturalBenefitValue(p, portfolio) {
    let total = 0;
    for (const id of portfolio) total += num(p.naturalBenefitValue[id]);
    return total;
  }

  function evaluateEconomics(p, routing, portfolio, scenario) {
    const pts = pointsFromRouting(p, routing, scenario);
    const fees = sum(portfolio.map(id => RULES.cards[id]?.annualFee || 0));
    const benefits = naturalBenefitValue(p, portfolio);
    const unverifiedCards = portfolio.filter(id => RULES.cards[id]?.verificationPending);
    return {
      pointsByCurrency: pts.byCurrency,
      grossTravelValue: pts.grossTravelValue,
      annualFees: fees,
      naturalBenefitValue: benefits,
      netEconomicValue: round(pts.grossTravelValue + benefits - fees),
      unverifiedCards
    };
  }

  function airlineStrategy(p) {
    if (!p.airline.primary) return { type: "none", airline: "", statusUseful: false, routeFitEstablished: false };
    const routeFit = p.airline.routeFit[p.airline.primary];
    return {
      type: "keep",
      airline: p.airline.primary,
      statusUseful: airlineStatusUsefulness(p),
      routeFitEstablished: routeFit != null,
      routeFit: routeFit == null ? null : routeFit
    };
  }

  function hotelStrategy(p, portfolio, benefitCredit) {
    const chain = hotelStatusUsefulness(p);
    const premium = benefitCredit.premiumHotel > 0;
    return {
      type: chain && premium ? "mixed" : chain ? "chain_loyalty_status" : premium ? "premium_booking" : "none",
      program: p.hotel.primary || ""
    };
  }

  function relevantCards(p) {
    const flex = ["amex_gold", "amex_platinum", "chase_preferred", "chase_reserve", "venture", "venture_x"];
    const airline = {
      delta: ["delta_platinum", "delta_reserve"],
      united: ["united_explorer", "united_quest", "united_club"],
      american: ["aa_executive"],
      southwest: ["southwest_priority"]
    }[p.airline.primary] || [];
    const hotel = {
      hyatt: ["hyatt_consumer"],
      marriott: ["marriott_boundless", "marriott_brilliant"],
      hilton: ["hilton_no_fee", "hilton_surpass", "hilton_aspire"]
    }[p.hotel.primary] || [];
    return uniq([...p.currentCards, ...p.constraints.requiredCards, ...flex, ...airline, ...hotel])
      .filter(id => RULES.cards[id] && !p.constraints.prohibitedCards.includes(id));
  }

  function combinations(arr, maxSize) {
    const out = [];
    function walk(i, picked) {
      if (picked.length <= maxSize) out.push(picked.slice());
      if (picked.length === maxSize) return;
      for (let j = i; j < arr.length; j++) {
        picked.push(arr[j]); walk(j + 1, picked); picked.pop();
      }
    }
    walk(0, []);
    return out;
  }

  function hasUnjustifiedHotelOverlap(p, set) {
    const byProgram = {};
    for (const id of set) {
      const card = RULES.cards[id];
      if (!card?.hotel) continue;
      (byProgram[card.hotel] ||= []).push(id);
    }
    for (const ids of Object.values(byProgram)) {
      if (ids.length <= 1) continue;
      const sorted = ids.slice().sort((a,b) => (RULES.cards[b].annualFee || 0) - (RULES.cards[a].annualFee || 0));
      for (const extra of sorted.slice(1)) {
        if (num(p.naturalBenefitValue[extra]) <= 0) return true;
      }
    }
    return false;
  }

  function candidatePortfolios(p) {
    const relevant = relevantCards(p);
    const max = Math.min(MODEL.maxPortfolioCards, relevant.length);
    const sets = [];
    for (const s of combinations(relevant, max)) {
      if (!s.length && p.totalSpend > 0) continue;
      if (p.constraints.requiredCards.some(id => !s.includes(id))) continue;
      const newCount = s.filter(id => !p.currentCards.includes(id)).length;
      if (p.constraints.noNewCards && newCount > 0) continue;
      if (newCount > p.constraints.maxNewCards) continue;
      if (hasUnjustifiedHotelOverlap(p, s)) continue;
      sets.push(s);
    }
    if (!sets.some(s => JSON.stringify(s.slice().sort()) === JSON.stringify(p.currentCards.slice().sort()))) sets.push(p.currentCards.slice());
    return sets;
  }

  function categoryFutureBudgets(p) {
    return clone(p.futureActivity.statusSpend);
  }

  function futureSpendOnCardFromRouting(p, annualRouting, targetCard) {
    const budgets = categoryFutureBudgets(p);
    let total = 0;
    for (const c of CATEGORIES) {
      const rows = annualRouting[c] || [];
      const annualCategory = p.spend[c] || 0;
      const futureCategory = budgets[c] || 0;
      if (!annualCategory || !futureCategory) continue;
      for (const r of rows) if (r.card === targetCard) total += futureCategory * (r.amount / annualCategory);
    }
    return total;
  }

  function futureCardSpendMap(p, annualRouting) {
    const out = {};
    for (const id of uniq(Object.values(annualRouting).flat().map(r => r.card))) {
      out[id] = futureSpendOnCardFromRouting(p, annualRouting, id);
    }
    return out;
  }

  function nextUsefulAirlineThreshold(p, airline) {
    const rules = RULES.airlines[airline];
    if (!rules) return null;
    const reportedIdx = tierIndex(airline, p.airline.reportedStatus);
    const organic = airlineFutureProgress(p, airline, {});
    const projectedIdx = tierIndex(airline, organic.tier);
    const baselineIdx = Math.max(reportedIdx, projectedIdx);
    if (reportedIdx >= 0 && projectedIdx < reportedIdx) {
      return { target: rules.thresholds[reportedIdx], type: "retain", organic };
    }
    const target = rules.thresholds.find((r, idx) => idx > baselineIdx);
    return target ? { target, type: "upgrade", organic } : null;
  }

  function airlineStatusSpendNeed(p, airline, cardId) {
    const card = RULES.cards[cardId];
    const plan = nextUsefulAirlineThreshold(p, airline);
    if (!card?.status || !plan) return null;
    const organic = plan.organic;

    if (airline === "southwest") {
      const targetFlight = RULES.airlines.southwest.flightThresholds.find(r => r.tier === plan.target.tier);
      if (targetFlight && organic.qualifyingFlights >= targetFlight.flights) return { spend: 0, ...plan, achievedOrganically: true };
    }

    let base = organic.metric;
    if (airline === "delta" && !p.currentCards.includes(cardId)) base += card.status.headstart || 0;
    if (airline === "united" && p.cardTenure[cardId]?.futureAnnualBonusEligible === true) base += card.status.annualBonus || 0;

    const gap = Math.max(0, plan.target.amount - base);
    if (!gap) return { spend: 0, ...plan, achievedOrganically: true };
    let spend = Infinity;
    if (airline === "delta" || airline === "united") spend = gap * card.status.spendDivisor;
    if (airline === "american") spend = gap / (card.status.lpPerEligiblePurchaseDollar || 1);
    if (airline === "southwest") spend = Math.ceil(gap / (card.status.tqpPerBlock || 1)) * card.status.spendBlock;
    return { spend, ...plan, achievedOrganically: false };
  }

  function hotelStatusSpendNeed(p, portfolio, cardId) {
    const program = p.hotel.primary;
    const card = RULES.cards[cardId];
    if (!program || !card?.hotelStatus || card.hotel !== program || !hotelStatusUsefulness(p)) return null;
    const currentFuture = hotelTierFromFacts(p, portfolio, {});
    const currentIdx = tierIndex(program, p.hotel.reportedStatus);
    const projectedIdx = tierIndex(program, currentFuture.projectedTier);
    const baseline = Math.max(currentIdx, projectedIdx);
    const rules = RULES.hotels[program];
    if (program === "hilton") return null;
    let target;
    let type;
    if (currentIdx >= 0 && projectedIdx < currentIdx) {
      target = rules.thresholds[currentIdx]; type = "retain";
    } else {
      target = rules.thresholds.find((r, idx) => idx > baseline); type = "upgrade";
    }
    if (!target) return null;
    const hs = card.hotelStatus;
    if (!hs.spendBlock || !hs.nightsPerBlock) return null;
    let nights = p.statusProgress.hotel.qualifyingNights + p.futureActivity.hotel.qualifyingNights;
    if (!p.currentCards.includes(cardId)) nights += hs.annualNights || 0;
    const gapNights = Math.max(0, target.nights - nights);
    if (!gapNights) return { spend: 0, target, type, achievedOrganically: true };
    const blocks = Math.ceil(gapNights / hs.nightsPerBlock);
    return { spend: blocks * hs.spendBlock, target, type, achievedOrganically: false };
  }

  function shiftFutureStatusSpend(p, routing, targetCard, requiredSpend, scenario) {
    if (!requiredSpend || requiredSpend <= 0) return { routing: clone(routing), shifted: 0, opportunityCost: 0 };
    const futureBudget = categoryFutureBudgets(p);
    const adjusted = clone(routing);
    const choices = [];

    for (const c of CATEGORIES) {
      const annual = p.spend[c] || 0;
      const available = Math.min(annual, futureBudget[c] || 0);
      if (!available) continue;
      const rows = adjusted[c] || [];
      const normalCard = rows[0]?.card;
      if (!normalCard) continue;
      const normalValue = cardCategoryValue(p, normalCard, c, annual, scenario);
      const targetValue = cardCategoryValue(p, targetCard, c, annual, scenario);
      choices.push({ c, available, normalCard, loss: Math.max(0, normalValue - targetValue) });
    }
    choices.sort((a,b) => a.loss - b.loss);
    let remaining = requiredSpend, cost = 0, shifted = 0;
    for (const x of choices) {
      if (remaining <= 0) break;
      const take = Math.min(x.available, remaining);
      if (!take) continue;
      const rows = adjusted[x.c] || [];
      const normal = rows.find(r => r.card === x.normalCard);
      if (normal) normal.amount = round(Math.max(0, normal.amount - take));
      const target = rows.find(r => r.card === targetCard);
      if (target) target.amount = round(target.amount + take);
      else rows.push({ card: targetCard, amount: round(take) });
      adjusted[x.c] = rows.filter(r => r.amount > 0);
      shifted += take; remaining -= take; cost += take * x.loss;
    }
    if (remaining > 0) return null;
    return { routing: adjusted, shifted: round(shifted), opportunityCost: round(cost) };
  }

  function applyStatusPlan(p, portfolio, baseRouting, scenario) {
    let routing = clone(baseRouting);
    const air = airlineStrategy(p);
    let airlineTarget = null;
    let hotelTarget = null;
    let opportunityCost = 0;

    if (air.statusUseful && air.airline) {
      const statusCards = portfolio.filter(id => RULES.cards[id]?.airline === air.airline && RULES.cards[id]?.status);
      let best = null;
      for (const id of statusCards) {
        const need = airlineStatusSpendNeed(p, air.airline, id);
        if (!need || need.achievedOrganically || need.spend <= 0) continue;
        const shifted = shiftFutureStatusSpend(p, routing, id, need.spend, scenario);
        if (!shifted || shifted.opportunityCost > MODEL.statusOpportunityCostLimit) continue;
        if (!best || shifted.opportunityCost < best.shifted.opportunityCost) best = { id, need, shifted };
      }
      if (best) {
        routing = best.shifted.routing;
        opportunityCost += best.shifted.opportunityCost;
        airlineTarget = {
          airline: air.airline, tier: best.need.target.tier, type: best.need.type,
          cardId: best.id, spendDirected: best.shifted.shifted
        };
      }
    }

    if (hotelStatusUsefulness(p) && p.hotel.primary) {
      const hotelCards = portfolio.filter(id => RULES.cards[id]?.hotel === p.hotel.primary && RULES.cards[id]?.hotelStatus?.spendBlock);
      let best = null;
      for (const id of hotelCards) {
        const need = hotelStatusSpendNeed(p, portfolio, id);
        if (!need || need.achievedOrganically || need.spend <= 0) continue;
        const shifted = shiftFutureStatusSpend(p, routing, id, need.spend, scenario);
        if (!shifted || shifted.opportunityCost > MODEL.statusOpportunityCostLimit) continue;
        if (!best || shifted.opportunityCost < best.shifted.opportunityCost) best = { id, need, shifted };
      }
      if (best) {
        routing = best.shifted.routing;
        opportunityCost += best.shifted.opportunityCost;
        hotelTarget = {
          program: p.hotel.primary, tier: best.need.target.tier, type: best.need.type,
          cardId: best.id, spendDirected: best.shifted.shifted
        };
      }
    }

    return { routing, airlineTarget, hotelTarget, opportunityCost: round(opportunityCost) };
  }

  function effectiveAirlineStatus(p, airline, futureProgress) {
    return maxTier(airline, p.airline.reportedStatus, futureProgress.tier);
  }

  function explicitActions(p, portfolio) {
    const actions = [];
    for (const id of p.currentCards) {
      if (!RULES.cards[id]) actions.push({ cardId: id, action: "manual_review" });
      else if (portfolio.includes(id)) actions.push({ cardId: id, action: "keep" });
      else actions.push({ cardId: id, action: "remove_or_downgrade_after_review" });
    }
    for (const id of portfolio) if (!p.currentCards.includes(id)) actions.push({ cardId: id, action: "add" });
    return actions;
  }

  function complexity(portfolio, p) {
    const currencies = uniq(portfolio.map(id => RULES.cards[id]?.currency).filter(Boolean));
    const newCards = portfolio.filter(id => !p.currentCards.includes(id));
    return {
      cardCount: portfolio.length,
      newCardCount: newCards.length,
      currencyCount: currencies.length,
      burden: round(portfolio.length * MODEL.complexityPenaltyPerCard +
        currencies.length * MODEL.complexityPenaltyPerCurrency + newCards.length, 2)
    };
  }

  function outcomeLedger(p, portfolio, economics, statusPlan, futureAir, futureHotel, credit) {
    const effectiveAir = p.airline.primary ? effectiveAirlineStatus(p, p.airline.primary, futureAir) : "";
    return {
      travelCapacity: {
        annualTravelValue: economics.grossTravelValue,
        pointsByCurrency: economics.pointsByCurrency,
        equivalentTrips: p.travel.typicalTripCashCost > 0 ? round(economics.grossTravelValue / p.travel.typicalTripCashCost, 1) : null
      },
      flightQuality: {
        reportedStatus: p.airline.reportedStatus,
        projectedFutureStatus: futureAir.tier || "",
        effectiveStatus: effectiveAir,
        statusTarget: statusPlan.airlineTarget
      },
      airportExperience: {
        loungeRecommendationCredit: credit.lounge,
        priorityRecommendationCredit: credit.priorityAirport,
        upgradePriorityRecommendationCredit: credit.upgradePriority
      },
      hotelExperience: {
        reportedStatus: p.hotel.reportedStatus,
        projectedFutureStatus: futureHotel.projectedTier || "",
        effectiveStatus: futureHotel.effectiveTier || "",
        premiumHotelRecommendationCredit: credit.premiumHotel,
        statusTarget: statusPlan.hotelTarget
      },
      reliability: {
        preservesCurrentAirlineStatus: !!(p.airline.reportedStatus && effectiveAir === p.airline.reportedStatus &&
          tierIndex(p.airline.primary, futureAir.tier) >= tierIndex(p.airline.primary, p.airline.reportedStatus))
      },
      cashEfficiency: { netEconomicValue: economics.netEconomicValue, annualTravelValue: economics.grossTravelValue },
      complexity: complexity(portfolio, p)
    };
  }

  function dataQuality(p, economics) {
    const issues = [];
    for (const id of p.currentCards) if (!RULES.cards[id]) issues.push({ code: "unsupported_current_card", severity: "high", detail: id });
    for (const id of economics.unverifiedCards || []) issues.push({ code: "rule_verification_pending", severity: "medium", detail: id });
    if (p.airline.primary && p.airline.routeFit[p.airline.primary] == null) issues.push({ code: "route_fit_not_independently_verified", severity: "medium", detail: p.airline.primary });
    const totalRouted = sum(CATEGORIES.flatMap(c => (p.currentRouting[c] || []).map(r => r.amount)));
    if (p.totalSpend && totalRouted / p.totalSpend < .9) issues.push({ code: "routing_incomplete", severity: "high" });
    return {
      level: issues.some(i => i.severity === "high") ? "low" : issues.filter(i => i.severity === "medium").length >= 2 ? "medium" : "high",
      issues
    };
  }

  function strategyRecord(p, portfolio, scenario = "base") {
    const baseRouting = routeAnnualSpend(p, portfolio, scenario);
    const statusPlan = applyStatusPlan(p, portfolio, baseRouting, scenario);
    const economics = evaluateEconomics(p, statusPlan.routing, portfolio, scenario);
    const futureCardSpend = futureCardSpendMap(p, statusPlan.routing);
    const futureAir = p.airline.primary ? airlineFutureProgress(p, p.airline.primary, futureCardSpend) : { tier: "", metric: 0, qualifyingFlights: 0 };
    const futureHotel = hotelTierFromFacts(p, portfolio, futureCardSpend);
    const credit = benefitRecommendationCredit(p, portfolio);
    const airStrategy = airlineStrategy(p);
    const hStrategy = hotelStrategy(p, portfolio, credit);
    const record = {
      id: portfolio.slice().sort().join("+") || "no_cards",
      portfolio: portfolio.slice(),
      routing: statusPlan.routing,
      economics,
      strategy: {
        airlineStrategy: airStrategy,
        hotelStrategy: hStrategy,
        airlineStatusTarget: statusPlan.airlineTarget,
        hotelStatusTarget: statusPlan.hotelTarget,
        statusOpportunityCost: statusPlan.opportunityCost
      },
      outcomes: outcomeLedger(p, portfolio, economics, statusPlan, futureAir, futureHotel, credit),
      visibleBenefits: visibleBenefits(portfolio),
      recommendationCredit: credit,
      actions: explicitActions(p, portfolio)
    };
    record.quality = dataQuality(p, economics);
    return record;
  }

  function currentRecord(p, scenario = "base") {
    const economics = evaluateEconomics(p, p.currentRouting, p.currentCards, scenario);
    const futureSpend = futureCardSpendMap(p, p.currentRouting);
    const futureAir = p.airline.primary ? airlineFutureProgress(p, p.airline.primary, futureSpend) : { tier: "", metric: 0, qualifyingFlights: 0 };
    const futureHotel = hotelTierFromFacts(p, p.currentCards, futureSpend);
    const credit = benefitRecommendationCredit(p, p.currentCards);
    const plan = { airlineTarget: null, hotelTarget: null, opportunityCost: 0 };
    const record = {
      id: "current",
      portfolio: p.currentCards.slice(),
      routing: clone(p.currentRouting),
      economics,
      strategy: { airlineStrategy: airlineStrategy(p), hotelStrategy: hotelStrategy(p, p.currentCards, credit), airlineStatusTarget: null, hotelStatusTarget: null, statusOpportunityCost: 0 },
      outcomes: outcomeLedger(p, p.currentCards, economics, plan, futureAir, futureHotel, credit),
      visibleBenefits: visibleBenefits(p.currentCards),
      recommendationCredit: credit,
      actions: explicitActions(p, p.currentCards)
    };
    record.quality = dataQuality(p, economics);
    return record;
  }

  function materialComparison(a, b) {
    const improvements = [], regressions = [];
    const av = a.outcomes.travelCapacity.annualTravelValue;
    const bv = b.outcomes.travelCapacity.annualTravelValue;
    if (av - bv >= MODEL.materialTravelValue) improvements.push("travelCapacity");
    if (bv - av >= MODEL.materialTravelValue) regressions.push("travelCapacity");

    const an = a.outcomes.cashEfficiency.netEconomicValue;
    const bn = b.outcomes.cashEfficiency.netEconomicValue;
    if (an - bn >= MODEL.materialCashImprovement) improvements.push("cashEfficiency");
    if (bn - an >= MODEL.materialCashImprovement) regressions.push("cashEfficiency");

    const air = a.strategy.airlineStrategy.airline || b.strategy.airlineStrategy.airline;
    if (air) {
      const ai = tierIndex(air, a.outcomes.flightQuality.effectiveStatus);
      const bi = tierIndex(air, b.outcomes.flightQuality.effectiveStatus);
      if (ai > bi) improvements.push("flightQuality");
      if (bi > ai) regressions.push("flightQuality");
      if (a.outcomes.reliability.preservesCurrentAirlineStatus && !b.outcomes.reliability.preservesCurrentAirlineStatus) improvements.push("reliability");
      if (b.outcomes.reliability.preservesCurrentAirlineStatus && !a.outcomes.reliability.preservesCurrentAirlineStatus) regressions.push("reliability");
    }

    const hotel = a.strategy.hotelStrategy.program || b.strategy.hotelStrategy.program;
    if (hotel) {
      const ai = tierIndex(hotel, a.outcomes.hotelExperience.effectiveStatus);
      const bi = tierIndex(hotel, b.outcomes.hotelExperience.effectiveStatus);
      if (ai > bi) improvements.push("hotelExperience");
      if (bi > ai) regressions.push("hotelExperience");
    }
    if (a.recommendationCredit.premiumHotel > b.recommendationCredit.premiumHotel) improvements.push("hotelExperience");
    if (b.recommendationCredit.premiumHotel > a.recommendationCredit.premiumHotel) regressions.push("hotelExperience");

    const aAirport = a.recommendationCredit.lounge + a.recommendationCredit.priorityAirport + a.recommendationCredit.upgradePriority;
    const bAirport = b.recommendationCredit.lounge + b.recommendationCredit.priorityAirport + b.recommendationCredit.upgradePriority;
    if (aAirport > bAirport) improvements.push("airportExperience");
    if (bAirport > aAirport) regressions.push("airportExperience");

    const ac = a.outcomes.complexity.burden, bc = b.outcomes.complexity.burden;
    if (bc - ac >= 2) improvements.push("complexity");
    if (ac - bc >= 2) regressions.push("complexity");
    return { improvements: uniq(improvements), regressions: uniq(regressions) };
  }

  function dominates(a, b) {
    const x = materialComparison(a, b);
    return x.improvements.length > 0 && x.regressions.length === 0;
  }

  function paretoSurvivors(records) {
    return records.filter((r, i) => !records.some((o, j) => i !== j && dominates(o, r)));
  }

  function chooseRecommended(p, records, current) {
    const survivors = paretoSurvivors(records);
    const viable = survivors.map(r => ({ r, cmp: materialComparison(r, current) }))
      .filter(x => x.cmp.improvements.length > 0)
      .filter(x => x.cmp.regressions.filter(k => k !== "complexity").length === 0 ||
        x.cmp.improvements.length > x.cmp.regressions.filter(k => k !== "complexity").length);

    viable.sort((x, y) => {
      const xn = x.cmp.improvements.filter(k => k !== "complexity").length;
      const yn = y.cmp.improvements.filter(k => k !== "complexity").length;
      if (yn !== xn) return yn - xn;

      const xCards = x.r.outcomes.complexity.cardCount;
      const yCards = y.r.outcomes.complexity.cardCount;
      const travelDelta = y.r.outcomes.travelCapacity.annualTravelValue - x.r.outcomes.travelCapacity.annualTravelValue;
      const cardDelta = yCards - xCards;
      if (cardDelta !== 0) {
        const required = Math.abs(cardDelta) * MODEL.incrementalTravelValuePerExtraCard;
        if (Math.abs(travelDelta) >= required) return travelDelta > 0 ? 1 : -1;
      }

      if (x.r.outcomes.complexity.burden !== y.r.outcomes.complexity.burden) {
        return x.r.outcomes.complexity.burden - y.r.outcomes.complexity.burden;
      }
      return y.r.economics.netEconomicValue - x.r.economics.netEconomicValue;
    });

    const best = viable[0]?.r || current;
    return materialComparison(best, current).improvements.length ? best : current;
  }

  function selectForScenario(p, scenario) {
    const current = currentRecord(p, scenario);
    const records = candidatePortfolios(p).map(set => strategyRecord(p, set, scenario));
    const recommended = chooseRecommended(p, records, current);
    return { current, records, recommended, pareto: paretoSurvivors(records) };
  }

  function presentationOrder(p) {
    const base = ["travelCapacity", "flightQuality", "airportExperience", "hotelExperience", "reliability", "cashEfficiency", "complexity"];
    const map = {
      "travel more": ["travelCapacity", "cashEfficiency"],
      "fly & airport better": ["flightQuality", "airportExperience", "reliability"],
      "fly and airport better": ["flightQuality", "airportExperience", "reliability"],
      "stay better": ["hotelExperience"],
      "get more travel from what i already spend": ["travelCapacity", "cashEfficiency"],
      "show me everything": []
    };
    const first = [];
    for (const a of p.aspirations) for (const k of map[a] || []) if (!first.includes(k)) first.push(k);
    return [...first, ...base.filter(k => !first.includes(k))];
  }

  function recommendationFingerprint(resultOrRecord) {
    const r = resultOrRecord.recommended || resultOrRecord;
    return JSON.stringify({
      portfolio: r.portfolio.slice().sort(),
      routing: r.routing,
      airline: r.strategy.airlineStrategy,
      hotel: r.strategy.hotelStrategy,
      airlineStatusTarget: r.strategy.airlineStatusTarget,
      hotelStatusTarget: r.strategy.hotelStatusTarget
    });
  }

  function allMaterialBenefits(current, recommended) {
    const cmp = materialComparison(recommended, current);
    return cmp.improvements.map(key => ({ key, outcome: recommended.outcomes[key] }));
  }

  function analyze(raw) {
    const p = raw?.__normalizedV5 ? raw : normalizeProfile(raw);
    const base = selectForScenario(p, "base");
    const conservative = selectForScenario(p, "conservative");
    const upper = selectForScenario(p, "upper");
    const fp = [conservative, base, upper].map(x => recommendationFingerprint(x.recommended));
    const visible = base.recommended.visibleBenefits;
    return {
      engineVersion: ENGINE_VERSION,
      rulesAsOf: RULES_AS_OF,
      profile: p,
      current: base.current,
      recommended: base.recommended,
      candidatesEvaluated: base.records.length,
      paretoSurvivorIds: base.pareto.map(r => r.id),
      allMaterialBenefits: allMaterialBenefits(base.current, base.recommended),
      visibleBenefits: visible,
      presentation: { aspirations: p.aspirations, order: presentationOrder(p) },
      sensitivity: {
        strategyStable: new Set(fp).size === 1,
        recommendationIds: {
          conservative: conservative.recommended.id,
          base: base.recommended.id,
          upper: upper.recommended.id
        },
        economics: {
          conservative: conservative.recommended.economics,
          base: base.recommended.economics,
          upper: upper.recommended.economics
        }
      },
      integrity: {
        aspirationsUsedInRecommendationSelection: false,
        benefitVisibilitySeparatedFromRecommendationCredit: true,
        reportedStatusAuthoritative: true,
        currentStatusProgressNotDoubleCounted: true
      }
    };
  }

  return Object.freeze({
    ENGINE_VERSION, RULES_AS_OF, RULES, VALUATIONS, MODEL,
    matchCard, normalizeProfile, airlineStatusUsefulness, hotelStatusUsefulness,
    airlineFutureProgress, hotelTierFromFacts, visibleBenefits, benefitRecommendationCredit,
    candidatePortfolios, strategyRecord, currentRecord, materialComparison,
    paretoSurvivors, selectForScenario, analyze, recommendationFingerprint
  });
});
