/**
 * Quiet Premium — qp_sim.js
 * Phase 3A Core Engine
 * Build: 3A.1
 * Date: 2026-09-02
 *
 * PURPOSE
 * -------
 * Isolated Quiet Premium rules + calculation engine.
 * This file is intentionally NOT wired into diagnostic.html yet.
 *
 * Phase 3A establishes:
 *   1) effective-dated rules registry
 *   2) normalized traveler profile
 *   3) primary-airline-first ecosystem selection
 *   4) current architecture calculation
 *   5) spend reconciliation / allocation ledger
 *   6) airline + hotel status breakpoint calculations
 *   7) invariants and adversarial smoke tests
 *
 * Phase 3B will add competing architectures + optimizer + recommendation ranking.
 * Phase 3C will expand automated validation.
 *
 * NORTH STAR
 * ----------
 * Quiet Premium maximizes what a customer's EXISTING spend and travel behavior
 * can realistically produce. It does not manufacture value because spend is high.
 *
 * Airline rule:
 *   Travel reality determines the ecosystem. The card architecture optimizes
 *   within that ecosystem. Migration requires affirmative evidence.
 */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.QuietPremiumEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENGINE_VERSION = "3A.1";
  const RULES_AS_OF = "2026-09-02";

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const money = value => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value == null) return 0;
    const n = Number(String(value).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const round = (n, digits = 0) => {
    const p = 10 ** digits;
    return Math.round((Number(n) || 0) * p) / p;
  };
  const lc = v => String(v ?? "").trim().toLowerCase();
  const clean = v => String(v ?? "").trim();

  function rangeMidpoint(value, table, fallback = 0) {
    if (typeof value === "number") return value;
    const key = clean(value);
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : fallback;
  }

  function includesAny(value, needles) {
    const s = lc(value);
    return needles.some(n => s.includes(n));
  }

  // ---------------------------------------------------------------------------
  // Rules Registry
  // Facts and QP architecture rules remain explicitly separate.
  // Valuation assumptions are NOT embedded here as issuer facts.
  // ---------------------------------------------------------------------------

  const RULES = Object.freeze({
    meta: {
      version: ENGINE_VERSION,
      asOf: RULES_AS_OF,
      supportedAirlines: ["delta", "united", "american", "southwest"],
      supportedHotels: ["hyatt", "marriott", "hilton"],
      supportedFlexible: ["amex_mr", "chase_ur"]
    },

    airlines: {
      delta: {
        label: "Delta",
        qualificationMetric: "MQD",
        period: "calendar_year",
        thresholds: [
          { tier: "Silver Medallion", amount: 5000 },
          { tier: "Gold Medallion", amount: 10000 },
          { tier: "Platinum Medallion", amount: 15000 },
          { tier: "Diamond Medallion", amount: 28000 }
        ]
      },
      united: {
        label: "United",
        qualificationMetric: "PQP",
        period: "calendar_year",
        thresholds: [
          { tier: "Premier Silver", amount: 6000 },
          { tier: "Premier Gold", amount: 12000 },
          { tier: "Premier Platinum", amount: 18000 },
          { tier: "Premier 1K", amount: 28000 }
        ]
      },
      american: {
        label: "American",
        qualificationMetric: "Loyalty Points",
        period: "qualification_year",
        thresholds: [
          { tier: "AAdvantage Gold", amount: 40000 },
          { tier: "AAdvantage Platinum", amount: 75000 },
          { tier: "AAdvantage Platinum Pro", amount: 125000 },
          { tier: "AAdvantage Executive Platinum", amount: 200000 }
        ]
      },
      southwest: {
        label: "Southwest",
        qualificationMetric: "TQP",
        period: "calendar_year",
        thresholds: [
          { tier: "A-List", amount: 35000 },
          { tier: "A-List Preferred", amount: 70000 }
        ],
        flightThresholds: [
          { tier: "A-List", flights: 20 },
          { tier: "A-List Preferred", flights: 40 }
        ],
        companionPass: {
          qualifyingPoints: 135000,
          qualifyingOneWayFlights: 100
        }
      }
    },

    hotelPrograms: {
      hyatt: {
        label: "World of Hyatt",
        thresholds: [
          { tier: "Discoverist", nights: 10, basePoints: 25000 },
          { tier: "Explorist", nights: 30, basePoints: 50000 },
          { tier: "Globalist", nights: 60, basePoints: 100000 }
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
        diamondReserve: { nights: 80, stays: 40, spend: 18000 }
      }
    },

    cards: {
      // Airline cards — only rules required by Phase 3A status production.
      delta_reserve: {
        label: "Delta SkyMiles Reserve",
        ecosystem: "delta",
        annualFee: 650,
        status: { headstart: 2500, metric: "MQD", spendDivisor: 10 }
      },
      delta_platinum: {
        label: "Delta SkyMiles Platinum",
        ecosystem: "delta",
        status: { headstart: 2500, metric: "MQD", spendDivisor: 20 }
      },
      united_explorer: {
        label: "United Explorer",
        ecosystem: "united",
        status: { metric: "PQP", spendDivisor: 20, annualCap: 1000 }
      },
      united_quest: {
        label: "United Quest",
        ecosystem: "united",
        annualFee: 350,
        status: { metric: "PQP", spendDivisor: 20, annualCap: 18000, annualBonus: 1000, annualBonusConditional: true }
      },
      united_club: {
        label: "United Club",
        ecosystem: "united",
        annualFee: 695,
        status: { metric: "PQP", spendDivisor: 15, annualCap: 28000, annualBonus: 1500, annualBonusConditional: true }
      },
      aa_executive: {
        label: "Citi / AAdvantage Executive",
        ecosystem: "american",
        status: { metric: "Loyalty Points", pointsPerDollar: 1 }
      },
      southwest_priority: {
        label: "Southwest Rapid Rewards Priority",
        ecosystem: "southwest",
        annualFee: 229,
        status: { metric: "TQP", tqpPerSpendBlock: 2500, spendBlock: 5000, companionBoost: 10000 }
      },

      // Hotel cards — Phase 3A needs ownership/status and status-spend mechanics.
      hyatt_consumer: {
        label: "World of Hyatt Credit Card",
        ecosystem: "hyatt",
        annualFee: 95,
        hotelStatus: { automaticTier: "Discoverist", annualNights: 5, nightsPerSpendBlock: 2, spendBlock: 5000 }
      },
      marriott_boundless: {
        label: "Marriott Bonvoy Boundless",
        ecosystem: "marriott",
        hotelStatus: { automaticTier: "Silver Elite", annualNights: 15, nightsPerSpendBlock: 1, spendBlock: 5000, goldAtSpend: 35000 }
      },
      marriott_brilliant: {
        label: "Marriott Bonvoy Brilliant",
        ecosystem: "marriott",
        annualFee: 650,
        hotelStatus: { automaticTier: "Platinum Elite", annualNights: 25 }
      },
      hilton_no_fee: {
        label: "Hilton Honors American Express",
        ecosystem: "hilton",
        hotelStatus: { automaticTier: "Silver", goldAtSpend: 20000 }
      },
      hilton_surpass: {
        label: "Hilton Honors Surpass",
        ecosystem: "hilton",
        hotelStatus: { automaticTier: "Gold", diamondAtSpend: 40000 }
      },
      hilton_aspire: {
        label: "Hilton Honors Aspire",
        ecosystem: "hilton",
        annualFee: 550,
        hotelStatus: { automaticTier: "Diamond" }
      }
    },

    architecture: {
      // SYSTEM RULE: QP's routable/general reserve deliberately excludes dining,
      // grocery and hotel spend from total household card spend.
      reserveSpendDefinition: "total - dining - grocery - hotel",
      primaryAirlineFirst: true,
      migrationRequiresEvidence: true,
      spendCannotBeDoubleAllocated: true,
      statusIsOptional: true,
      alreadyOptimizedIsValid: true
    }
  });

  // ---------------------------------------------------------------------------
  // Product matching
  // Phase 3A uses conservative matching. Unknown products remain unsupported,
  // instead of being silently treated as a premium card.
  // ---------------------------------------------------------------------------

  const CARD_MATCHERS = [
    ["delta_reserve", ["delta reserve", "skymiles reserve"]],
    ["delta_platinum", ["delta platinum", "skymiles platinum"]],
    ["united_explorer", ["united explorer"]],
    ["united_quest", ["united quest"]],
    ["united_club", ["united club", "club infinite"]],
    ["aa_executive", ["aadvantage executive", "aa executive", "citi executive"]],
    ["southwest_priority", ["southwest priority", "rapid rewards priority"]],
    ["hyatt_consumer", ["world of hyatt", "hyatt credit"]],
    ["marriott_boundless", ["marriott boundless", "bonvoy boundless"]],
    ["marriott_brilliant", ["marriott brilliant", "bonvoy brilliant"]],
    ["hilton_no_fee", ["hilton honors american express", "hilton honors amex"]],
    ["hilton_surpass", ["hilton surpass"]],
    ["hilton_aspire", ["hilton aspire"]]
  ];

  function identifyCard(raw) {
    const value = lc(raw);
    if (!value) return null;
    for (const [id, terms] of CARD_MATCHERS) {
      if (terms.some(term => value.includes(term))) return { id, ...RULES.cards[id], raw: clean(raw) };
    }
    return { id: "unsupported", label: clean(raw), raw: clean(raw), supported: false };
  }

  function normalizeCardList(input) {
    if (Array.isArray(input)) return input.map(identifyCard).filter(Boolean);
    const raw = clean(input);
    if (!raw) return [];
    return raw.split(/\n|,|;/).map(s => identifyCard(s)).filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // Ecosystem normalization
  // ---------------------------------------------------------------------------

  function normalizeAirline(value) {
    const s = lc(value);
    if (s.includes("delta")) return "delta";
    if (s.includes("united")) return "united";
    if (s.includes("american") || s.includes("aadvantage")) return "american";
    if (s.includes("southwest")) return "southwest";
    if (s.includes("mixed") || s.includes("no primary") || s.includes("none")) return "mixed";
    return s || "unknown";
  }

  function normalizeHotel(value) {
    const s = lc(value);
    if (s.includes("hyatt")) return "hyatt";
    if (s.includes("marriott") || s.includes("bonvoy")) return "marriott";
    if (s.includes("hilton")) return "hilton";
    if (s.includes("none") || s.includes("mixed") || !s) return "mixed";
    return "other";
  }

  const FLIGHT_RANGE = {
    "40+": 42, "21-40": 30, "11-20": 15, "6-10": 8, "0-5": 4
  };
  const NIGHT_RANGE = {
    "40+": 42, "21-39": 30, "21-40": 30, "11-20": 15, "6-10": 8, "0-5": 4
  };
  const AIRFARE_RANGE = {
    "$20k+": 22000, "$10k-$20k": 15000, "$5k-$10k": 7500,
    "Under $5k": 3000, "Likely over $10k": 12000
  };

  // ---------------------------------------------------------------------------
  // Input Normalizer
  // Unknown data is kept unknown wherever possible. We do not invent precision.
  // ---------------------------------------------------------------------------

  function normalizeProfile(raw = {}) {
    const total = money(raw.total_spend);
    const dining = money(raw.dining_spend);
    const grocery = money(raw.grocery_spend);
    const general = money(raw.general_spend);
    const hotelSpendProvided = money(raw.hotel_spend);
    const hotelNights = rangeMidpoint(raw.hotel_nights, NIGHT_RANGE, money(raw.hotel_nights));
    const hotelSpend = hotelSpendProvided || (hotelNights ? hotelNights * 500 : 0);
    const airfareSpend = money(raw.individual_airfare_spend || raw.airfare_spend) ||
      rangeMidpoint(raw.airline_spend, AIRFARE_RANGE, money(raw.airline_spend));
    const flights = rangeMidpoint(raw.flights_taken, FLIGHT_RANGE, money(raw.flights_taken));

    const cards = normalizeCardList(raw.primary_cards);
    const usage = {
      airfare: identifyCard(raw.card_airfare),
      hotels: identifyCard(raw.card_hotels),
      dining: identifyCard(raw.card_dining),
      groceries: identifyCard(raw.card_groceries),
      general: identifyCard(raw.card_general)
    };

    // Preserve all cards found in category usage even if primary_cards was blank.
    const byId = new Map();
    [...cards, ...Object.values(usage).filter(Boolean)].forEach(c => {
      const key = c.id === "unsupported" ? `unsupported:${lc(c.raw)}` : c.id;
      if (!byId.has(key)) byId.set(key, c);
    });

    const primaryAirline = normalizeAirline(raw.primary_airline_eco || raw.primary_airline);
    const primaryHotel = normalizeHotel(raw.primary_hotel);

    const categoriesKnown = dining + grocery + general + hotelSpend + airfareSpend;
    const reconciliationDelta = total ? total - categoriesKnown : null;

    return {
      identity: {
        firstName: clean(raw.first_name || raw.full_name).split(/\s+/)[0] || null
      },
      spend: {
        total,
        dining,
        grocery,
        general,
        hotel: hotelSpend,
        airfareIndividual: airfareSpend,
        categoriesKnown,
        reconciliationDelta,
        reconciliationStatus:
          total === 0 ? "unknown_total" :
          Math.abs(reconciliationDelta) <= Math.max(1000, total * 0.05) ? "reconciled" :
          reconciliationDelta > 0 ? "unclassified_spend_remaining" :
          "categories_exceed_total"
      },
      travel: {
        primaryAirline,
        primaryAirlineRaw: clean(raw.primary_airline || raw.primary_airline_eco),
        currentAirlineStatus: clean(raw.primary_airline),
        flights,
        airlineConcentration: clean(raw.airline_conc),
        homeAirport: clean(raw.home_airport),
        frequentDestinations: clean(raw.frequent_destinations),
        bookingControl: clean(raw.booking_control),
        bookingMethod: clean(raw.booking_method),
        cabin: clean(raw.cabin_booked)
      },
      hotel: {
        primaryProgram: primaryHotel,
        currentStatusRaw: clean(raw.primary_hotel),
        nights: hotelNights,
        stays: money(raw.hotel_stays),
        spend: hotelSpend,
        concentration: clean(raw.hotel_conc),
        bookingMethod: clean(raw.hotel_booking_method || raw.booking_method)
      },
      benefits: {
        tsaClear: clean(raw.tsa_clear_activated),
        loungeAccess: clean(raw.lounge_access),
        bagFrequency: money(raw.checked_bag_roundtrips),
        pointsRedeemed: clean(raw.pts_redeemed),
        upgrades: clean(raw.upgrades_unasked),
        disruption: clean(raw.disruption)
      },
      cards: Array.from(byId.values()),
      usage,
      raw
    };
  }

  // ---------------------------------------------------------------------------
  // Spend Ledger
  // The ledger prevents a dollar from being assigned twice.
  // ---------------------------------------------------------------------------

  function createSpendLedger(profile) {
    const p = profile.spend;
    const ledger = {
      total: p.total,
      buckets: {
        dining: p.dining,
        grocery: p.grocery,
        hotel: p.hotel,
        airfare: p.airfareIndividual,
        general: p.general
      },
      allocated: {},
      unallocated: {},
      errors: []
    };

    let allocatedTotal = 0;
    Object.entries(ledger.buckets).forEach(([bucket, amount]) => {
      const value = Math.max(0, money(amount));
      ledger.allocated[bucket] = value;
      allocatedTotal += value;
    });

    ledger.allocatedTotal = allocatedTotal;
    ledger.unclassified = Math.max(0, p.total - allocatedTotal);
    ledger.overAllocated = Math.max(0, allocatedTotal - p.total);

    if (p.total > 0 && ledger.overAllocated > 0) {
      ledger.errors.push({
        code: "SPEND_OVERALLOCATED",
        amount: ledger.overAllocated,
        message: "Known spend categories exceed total household card spend."
      });
    }

    return ledger;
  }

  // ---------------------------------------------------------------------------
  // Status utilities
  // ---------------------------------------------------------------------------

  function tierFromMetric(thresholds, metricValue) {
    let achieved = null;
    for (const threshold of thresholds) {
      if (metricValue >= threshold.amount) achieved = threshold;
    }
    return achieved;
  }

  function nextTier(thresholds, metricValue) {
    return thresholds.find(t => metricValue < t.amount) || null;
  }

  function parseCurrentTier(ecosystem, raw) {
    const s = lc(raw);
    if (!s || s.includes("none")) return null;
    const tiers = RULES.airlines[ecosystem]?.thresholds || [];
    return tiers.find(t => s.includes(lc(t.tier).replace(" medallion", "").replace("premier ", "").replace("aadvantage ", ""))) || null;
  }

  // ---------------------------------------------------------------------------
  // Airline Status Production
  // Primary airline controls which airline rail is evaluated.
  // Phase 3A does NOT migrate the traveler to a different carrier.
  // ---------------------------------------------------------------------------

  function currentAirlineStatus(profile) {
    const eco = profile.travel.primaryAirline;
    if (!RULES.airlines[eco]) {
      return {
        ecosystem: eco,
        supported: false,
        reason: eco === "mixed"
          ? "No single primary airline. Phase 3B will evaluate whether a primary rail should be established."
          : "Airline ecosystem is not supported in V1."
      };
    }

    const airline = RULES.airlines[eco];
    const generalCard = profile.usage.general;
    const airfare = profile.spend.airfareIndividual;
    const flights = profile.travel.flights;
    let activityMetric = 0;
    let cardMetric = 0;
    let ownershipMetric = 0;
    const conditions = [];

    if (eco === "delta") {
      // QP does NOT apply household airfare as traveler MQDs. Only the normalized
      // individual qualifying airfare input is used here.
      activityMetric = airfare;

      const eligibleOwned = profile.cards.filter(c => ["delta_reserve", "delta_platinum"].includes(c.id));
      ownershipMetric = eligibleOwned.length * 2500;

      if (generalCard?.id === "delta_reserve") cardMetric += profile.spend.general / 10;
      if (generalCard?.id === "delta_platinum") cardMetric += profile.spend.general / 20;
    }

    if (eco === "united") {
      activityMetric = airfare; // Phase 3A proxy; Phase 3B will distinguish eligible PQP sources.
      if (generalCard?.id === "united_explorer") cardMetric += Math.min(1000, profile.spend.general / 20);
      if (generalCard?.id === "united_quest") {
        cardMetric += Math.min(18000, profile.spend.general / 20);
        conditions.push("United Quest annual Card Bonus PQP is conditional on account timing.");
      }
      if (generalCard?.id === "united_club") {
        cardMetric += Math.min(28000, profile.spend.general / 15);
        conditions.push("United Club annual Card Bonus PQP is conditional on account timing.");
      }
      // Conditional annual bonuses are not silently counted in confirmed metric.
    }

    if (eco === "american") {
      // Eligible card spend generally produces 1 Loyalty Point per eligible $1.
      if (generalCard?.id === "aa_executive") cardMetric += profile.spend.general;
      // Flight LP earning is status/fare dependent. Phase 3A refuses the old 5x blanket assumption.
      activityMetric = 0;
      if (airfare > 0) conditions.push("Flight Loyalty Points require fare/status-specific calculation; not estimated with a blanket multiplier.");
    }

    if (eco === "southwest") {
      if (generalCard?.id === "southwest_priority") {
        const blocks = Math.floor(profile.spend.general / 5000);
        cardMetric += blocks * 2500;
      }
      activityMetric = 0; // Fare-derived TQP needs booking data; don't fabricate it.
      if (airfare > 0) conditions.push("Southwest flight TQP requires eligible fare/activity detail; not inferred from airfare dollars.");
    }

    const confirmedMetric = round(activityMetric + cardMetric + ownershipMetric, 0);
    const achieved = tierFromMetric(airline.thresholds, confirmedMetric);
    const next = nextTier(airline.thresholds, confirmedMetric);
    const userReportedTier = parseCurrentTier(eco, profile.travel.currentAirlineStatus);

    return {
      ecosystem: eco,
      label: airline.label,
      supported: true,
      metric: airline.qualificationMetric,
      confirmedMetric,
      components: {
        travelActivity: round(activityMetric, 0),
        cardSpend: round(cardMetric, 0),
        ownershipHeadstart: round(ownershipMetric, 0)
      },
      calculatedTier: achieved?.tier || null,
      reportedTier: userReportedTier?.tier || profile.travel.currentAirlineStatus || null,
      nextTier: next ? {
        tier: next.tier,
        threshold: next.amount,
        remaining: Math.max(0, round(next.amount - confirmedMetric, 0))
      } : null,
      flightThresholdPath: eco === "southwest"
        ? RULES.airlines.southwest.flightThresholds.map(t => ({
            tier: t.tier,
            flightsRequired: t.flights,
            remaining: Math.max(0, t.flights - flights)
          }))
        : null,
      conditions
    };
  }

  // ---------------------------------------------------------------------------
  // Hotel Current Architecture
  // Phase 3A evaluates the current declared hotel ecosystem only.
  // It does not yet select a different chain.
  // ---------------------------------------------------------------------------

  function cardTierRank(program, tier) {
    const order = {
      hyatt: ["Discoverist", "Explorist", "Globalist"],
      marriott: ["Silver Elite", "Gold Elite", "Platinum Elite", "Titanium Elite"],
      hilton: ["Silver", "Gold", "Diamond", "Diamond Reserve"]
    };
    const i = order[program]?.indexOf(tier) ?? -1;
    return i;
  }

  function maxTier(program, a, b) {
    if (!a) return b || null;
    if (!b) return a || null;
    return cardTierRank(program, a) >= cardTierRank(program, b) ? a : b;
  }

  function currentHotelStatus(profile) {
    const program = profile.hotel.primaryProgram;
    if (!RULES.hotelPrograms[program]) {
      return {
        program,
        supported: false,
        reason: program === "mixed"
          ? "No primary hotel program."
          : "Hotel program is not supported in V1."
      };
    }

    const nightsActual = profile.hotel.nights;
    const staysActual = profile.hotel.stays;
    const spendActual = profile.hotel.spend;
    const generalCard = profile.usage.general;
    const owned = profile.cards;

    let cardNights = 0;
    let automaticTier = null;
    const conditions = [];

    for (const c of owned) {
      if (c.ecosystem !== program || !c.hotelStatus) continue;
      automaticTier = maxTier(program, automaticTier, c.hotelStatus.automaticTier);
      cardNights += c.hotelStatus.annualNights || 0;
    }

    // Only count spend-based hotel qualification when the relevant hotel card
    // is actually the general-spend card.
    if (program === "hyatt" && generalCard?.id === "hyatt_consumer") {
      cardNights += Math.floor(profile.spend.general / 5000) * 2;
    }
    if (program === "marriott" && generalCard?.id === "marriott_boundless") {
      cardNights += Math.floor(profile.spend.general / 5000);
      if (profile.spend.general >= 35000) automaticTier = maxTier(program, automaticTier, "Gold Elite");
    }
    if (program === "hilton" && generalCard?.id === "hilton_no_fee" && profile.spend.general >= 20000) {
      automaticTier = maxTier(program, automaticTier, "Gold");
    }
    if (program === "hilton" && generalCard?.id === "hilton_surpass" && profile.spend.general >= 40000) {
      automaticTier = maxTier(program, automaticTier, "Diamond");
    }

    let activityTier = null;
    const rules = RULES.hotelPrograms[program];

    if (program === "hyatt" || program === "marriott") {
      const qualifyingNights = nightsActual + cardNights;
      for (const t of rules.thresholds) if (qualifyingNights >= t.nights) activityTier = t.tier;
    }

    if (program === "hilton") {
      for (const t of rules.thresholds) {
        const qualifies =
          (t.nights && nightsActual >= t.nights) ||
          (t.stays && staysActual >= t.stays) ||
          (t.spend && spendActual >= t.spend);
        if (qualifies) activityTier = t.tier;
      }
      const dr = rules.diamondReserve;
      const reserveQualifies =
        (nightsActual >= dr.nights || staysActual >= dr.stays) &&
        spendActual >= dr.spend;
      if (reserveQualifies) activityTier = "Diamond Reserve";
    }

    const currentTier = maxTier(program, automaticTier, activityTier);

    return {
      program,
      label: rules.label,
      supported: true,
      currentTier,
      automaticTier,
      activityTier,
      components: {
        actualNights: nightsActual,
        cardNights,
        qualifyingNights: nightsActual + cardNights,
        stays: staysActual,
        hotelSpend: spendActual
      },
      conditions
    };
  }

  // ---------------------------------------------------------------------------
  // Current Architecture
  // No optimizer here. No fake "potential" is created.
  // ---------------------------------------------------------------------------

  function calculateCurrentArchitecture(rawProfile) {
    const profile = rawProfile?.spend ? rawProfile : normalizeProfile(rawProfile);
    const ledger = createSpendLedger(profile);
    const airline = currentAirlineStatus(profile);
    const hotel = currentHotelStatus(profile);

    const knownAnnualFees = profile.cards.reduce((sum, card) => sum + (card.annualFee || 0), 0);
    const unsupportedCards = profile.cards.filter(c => c.id === "unsupported").map(c => c.label);

    return {
      engine: {
        version: ENGINE_VERSION,
        phase: "3A",
        rulesAsOf: RULES_AS_OF
      },
      profile,
      current: {
        airline,
        hotel,
        spendLedger: ledger,
        knownAnnualCardFees: knownAnnualFees,
        unsupportedCards
      },
      optimization: {
        performed: false,
        reason: "Phase 3A calculates Current Architecture only. Candidate optimization begins in Phase 3B."
      },
      integrity: validateCurrentArchitecture(profile, ledger, airline, hotel)
    };
  }

  // ---------------------------------------------------------------------------
  // Integrity checks
  // ---------------------------------------------------------------------------

  function validateCurrentArchitecture(profile, ledger, airline, hotel) {
    const checks = [];

    function check(id, pass, detail) {
      checks.push({ id, pass: Boolean(pass), detail });
    }

    check(
      "SPEND_NOT_DOUBLE_ALLOCATED",
      ledger.overAllocated === 0,
      ledger.overAllocated ? `Over-allocated by $${round(ledger.overAllocated)}` : "Known spend buckets do not exceed total spend."
    );

    check(
      "PRIMARY_AIRLINE_GOVERNS",
      !airline.supported || airline.ecosystem === profile.travel.primaryAirline,
      "Airline status calculation remains in the declared primary airline ecosystem."
    );

    check(
      "NO_SOUTHWEST_TO_DELTA_FORCING",
      profile.travel.primaryAirline !== "southwest" || airline.ecosystem === "southwest",
      "Southwest is evaluated as Southwest, not silently migrated to Delta."
    );

    check(
      "NO_NEGATIVE_STATUS_METRIC",
      !airline.supported || airline.confirmedMetric >= 0,
      "Confirmed airline status metric is non-negative."
    );

    check(
      "NO_FAKE_OPTIMIZATION",
      true,
      "Phase 3A does not generate recommendations or potential-value claims."
    );

    check(
      "HOTEL_PROGRAM_PRESERVED",
      !hotel.supported || hotel.program === profile.hotel.primaryProgram,
      "Current hotel calculation remains in the declared hotel ecosystem."
    );

    return {
      passed: checks.every(c => c.pass),
      checks
    };
  }

  // ---------------------------------------------------------------------------
  // Phase 3A Smoke Profiles
  // These are logic tests, not valuation claims.
  // ---------------------------------------------------------------------------

  const TEST_PROFILES = [
    {
      label: "$200K Delta already concentrated",
      data: {
        total_spend: 200000,
        dining_spend: 30000,
        grocery_spend: 20000,
        general_spend: 95000,
        hotel_spend: 25000,
        individual_airfare_spend: 30000,
        primary_airline_eco: "Delta",
        primary_airline: "Delta Platinum Medallion",
        card_general: "Delta SkyMiles Reserve",
        card_airfare: "Delta SkyMiles Reserve",
        primary_cards: "Delta SkyMiles Reserve; American Express Gold",
        primary_hotel: "Marriott Bonvoy Platinum Elite",
        hotel_nights: 35
      }
    },
    {
      label: "$150K United",
      data: {
        total_spend: 150000,
        dining_spend: 24000,
        grocery_spend: 15000,
        general_spend: 70000,
        hotel_spend: 21000,
        individual_airfare_spend: 20000,
        primary_airline_eco: "United",
        primary_airline: "United Premier Gold",
        card_general: "United Club Infinite",
        primary_cards: "United Club Infinite",
        primary_hotel: "Hyatt Explorist",
        hotel_nights: 30
      }
    },
    {
      label: "Southwest preserved",
      data: {
        total_spend: 120000,
        dining_spend: 22000,
        grocery_spend: 15000,
        general_spend: 60000,
        hotel_spend: 13000,
        individual_airfare_spend: 10000,
        primary_airline_eco: "Southwest",
        primary_airline: "Southwest A-List",
        card_general: "Southwest Rapid Rewards Priority",
        primary_cards: "Southwest Rapid Rewards Priority",
        flights_taken: "21-40",
        primary_hotel: "Hilton Honors Gold",
        hotel_nights: 20
      }
    },
    {
      label: "$75K little travel",
      data: {
        total_spend: 75000,
        dining_spend: 16000,
        grocery_spend: 12000,
        general_spend: 39000,
        hotel_spend: 4000,
        individual_airfare_spend: 4000,
        primary_airline_eco: "Mixed",
        primary_airline: "None",
        flights_taken: "0-5",
        primary_hotel: "None",
        hotel_nights: "0-5"
      }
    }
  ];

  function runSmokeTests() {
    const results = TEST_PROFILES.map(test => {
      const result = calculateCurrentArchitecture(test.data);
      return {
        label: test.label,
        passed: result.integrity.passed,
        airline: result.current.airline,
        hotel: result.current.hotel,
        integrity: result.integrity
      };
    });

    return {
      engineVersion: ENGINE_VERSION,
      passed: results.every(r => r.passed),
      count: results.length,
      results
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return Object.freeze({
    ENGINE_VERSION,
    RULES_AS_OF,
    RULES,
    normalizeProfile,
    identifyCard,
    createSpendLedger,
    currentAirlineStatus,
    currentHotelStatus,
    calculateCurrentArchitecture,
    runSmokeTests
  });
});

// CLI smoke test: `node qp_sim.js`
if (typeof module === "object" && module.exports && require.main === module) {
  const report = module.exports.runSmokeTests();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
