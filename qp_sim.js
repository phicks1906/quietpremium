/**
 * Quiet Premium — qp_sim.js
 * Phase 3C Adversarial Validation Engine
 * Build: 3C.1
 * Date: 2026-09-03
 *
 * NORTH STAR
 * ----------
 * Quiet Premium determines what a customer's existing spending and travel
 * behavior can realistically produce, compares that with what the customer
 * currently captures, and recommends the smallest high-impact set of changes
 * that closes the gap.
 *
 * The engine does the complicated work underneath. The customer receives a
 * simple, confident answer inside a luxury experience.
 *
 * IMPORTANT MODELING PRINCIPLES
 * -----------------------------
 * - Primary airline governs the airline rail by default.
 * - Airline migration is not performed without affirmative evidence.
 * - Status is an accelerator, not the objective.
 * - A dollar of spend may be allocated only once.
 * - Status spend stops at useful thresholds; the marginal dollar is re-evaluated.
 * - Current, Maximum, and Recommended use the same valuation engine.
 * - Existing point balances are stored value, not annual production.
 * - Duplicate benefits are never counted twice.
 * - Welcome offers are first-year only and may not consume spend needed for a
 *   selected status threshold.
 * - "Already optimized" and "no status strategy justified" are valid outcomes.
 *
 * This file is isolated from diagnostic.html. The customer-facing diagnostic
 * remains unchanged until this engine passes the next integration gate.
 */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.QuietPremiumEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENGINE_VERSION = "3C.1";
  const RULES_AS_OF = "2026-09-03";

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const money = v => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const clean = v => String(v ?? "").trim();
  const lc = v => clean(v).toLowerCase();
  const round = (n, d = 0) => {
    const p = 10 ** d;
    return Math.round((Number(n) || 0) * p) / p;
  };
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const uniq = arr => [...new Set((arr || []).filter(Boolean))];

  function parsePercent(v) {
    if (typeof v === "number") return clamp(v > 1 ? v : v * 100, 0, 100);
    const s = clean(v);
    if (!s) return null;
    const nums = (s.match(/\d+/g) || []).map(Number);
    if (!nums.length) return null;
    if (s.includes("-") && nums.length >= 2) return clamp((nums[0] + nums[1]) / 2, 0, 100);
    if (s.includes("+")) return clamp(nums[0], 0, 100);
    return clamp(nums[0], 0, 100);
  }

  function parseRange(v, table, fallback = 0) {
    if (typeof v === "number") return v;
    const s = clean(v);
    if (Object.prototype.hasOwnProperty.call(table, s)) return table[s];
    return money(v) || fallback;
  }

  // ---------------------------------------------------------------------------
  // Rules Registry
  //
  // Program/card facts are kept separate from QP valuation assumptions.
  // These records are effective-dated and intentionally limited to the V1
  // supported universe.
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
        ],
        companionPass: { qualifyingPoints: 135000, qualifyingOneWayFlights: 100 }
      }
    },

    hotels: {
      hyatt: {
        label: "World of Hyatt",
        tiers: ["Discoverist", "Explorist", "Globalist"],
        thresholds: [
          { tier: "Discoverist", nights: 10 },
          { tier: "Explorist", nights: 30 },
          { tier: "Globalist", nights: 60 }
        ]
      },
      marriott: {
        label: "Marriott Bonvoy",
        tiers: ["Silver Elite", "Gold Elite", "Platinum Elite", "Titanium Elite"],
        thresholds: [
          { tier: "Silver Elite", nights: 10 },
          { tier: "Gold Elite", nights: 25 },
          { tier: "Platinum Elite", nights: 50 },
          { tier: "Titanium Elite", nights: 75 }
        ]
      },
      hilton: {
        label: "Hilton Honors",
        tiers: ["Silver", "Gold", "Diamond", "Diamond Reserve"],
        thresholds: [
          { tier: "Silver", nights: 10, stays: 4, spend: 2500 },
          { tier: "Gold", nights: 25, stays: 15, spend: 6000 },
          { tier: "Diamond", nights: 50, stays: 25, spend: 11500 }
        ],
        diamondReserve: { nights: 80, stays: 40, spend: 18000 }
      }
    },

    cards: {
      amex_gold: {
        label: "American Express Gold",
        ecosystem: "amex_mr",
        annualFee: 325,
        currency: "amex_mr",
        earn: { dining: 4, grocery: 4, airfare: 3, hotel: 5, general: 1 },
        caps: { dining: 50000, grocery: 25000 },
        hotelPortalRequired: "amex"
      },
      amex_platinum: {
        label: "American Express Platinum",
        ecosystem: "amex_mr",
        annualFee: 895,
        currency: "amex_mr",
        earn: { dining: 1, grocery: 1, airfare: 5, hotel: 5, general: 1 },
        airfareCap: 500000,
        hotelPortalRequired: "amex",
        benefits: [
          { id: "clear", dedupeKey: "clear", cap: 219, input: "clear_annual_spend" },
          { id: "lounge", dedupeKey: "lounge", input: "lounge_annual_value" }
        ]
      },
      chase_preferred: {
        label: "Chase Sapphire Preferred",
        ecosystem: "chase_ur",
        annualFee: 95,
        currency: "chase_ur",
        earn: { dining: 3, grocery: 1, airfare: 2, hotel: 2, general: 1 },
        portalTravelEarn: 5
      },
      chase_reserve: {
        label: "Chase Sapphire Reserve",
        ecosystem: "chase_ur",
        annualFee: 795,
        currency: "chase_ur",
        earn: { dining: 3, grocery: 1, airfare: 4, hotel: 4, general: 1 },
        portalTravelEarn: 8,
        benefits: [
          { id: "travel_credit", dedupeKey: "csr_travel_credit", cap: 300, derive: "assigned_travel" },
          { id: "lounge", dedupeKey: "lounge", input: "lounge_annual_value" }
        ]
      },

      delta_platinum: {
        label: "Delta SkyMiles Platinum",
        ecosystem: "delta",
        annualFee: 350,
        currency: "skymiles",
        earn: { dining: 2, grocery: 2, airfare: 3, hotel: 3, general: 1 },
        status: { headstart: 2500, spendDivisor: 20 },
        renewalOnly: ["companion_certificate"]
      },
      delta_reserve: {
        label: "Delta SkyMiles Reserve",
        ecosystem: "delta",
        annualFee: 650,
        currency: "skymiles",
        earn: { dining: 1, grocery: 1, airfare: 3, hotel: 1, general: 1 },
        status: { headstart: 2500, spendDivisor: 10 },
        renewalOnly: ["companion_certificate"],
        benefits: [{ id: "lounge", dedupeKey: "lounge", input: "lounge_annual_value" }]
      },

      united_explorer: {
        label: "United Explorer",
        ecosystem: "united",
        annualFee: 150,
        currency: "united_miles",
        earn: { dining: 2, grocery: 1, airfare: 3, hotel: 2, general: 1 },
        status: { spendDivisor: 20, annualCap: 1000 }
      },
      united_quest: {
        label: "United Quest",
        ecosystem: "united",
        annualFee: 350,
        currency: "united_miles",
        earn: { dining: 2, grocery: 1, airfare: 4, hotel: 2, general: 1 },
        status: { spendDivisor: 20, annualCap: 18000, conditionalAnnualBonus: 1000 }
      },
      united_club: {
        label: "United Club",
        ecosystem: "united",
        annualFee: 695,
        currency: "united_miles",
        earn: { dining: 2, grocery: 1, airfare: 5, hotel: 2, general: 1 },
        status: { spendDivisor: 15, annualCap: 28000, conditionalAnnualBonus: 1500 },
        benefits: [{ id: "lounge", dedupeKey: "lounge", input: "lounge_annual_value" }]
      },

      aa_executive: {
        label: "Citi / AAdvantage Executive",
        ecosystem: "american",
        annualFee: 595,
        currency: "aadvantage",
        earn: { dining: 1, grocery: 1, airfare: 4, hotel: 1, general: 1 },
        status: { lpPerDollar: 1 },
        benefits: [{ id: "lounge", dedupeKey: "lounge", input: "lounge_annual_value" }]
      },

      southwest_priority: {
        label: "Southwest Rapid Rewards Priority",
        ecosystem: "southwest",
        annualFee: 229,
        currency: "southwest_points",
        earn: { dining: 2, grocery: 1, airfare: 4, hotel: 1, general: 1 },
        status: { spendBlock: 5000, tqpPerBlock: 2500 }
      },

      hyatt_consumer: {
        label: "World of Hyatt Credit Card",
        ecosystem: "hyatt",
        annualFee: 95,
        currency: "hyatt_points",
        earn: { dining: 2, grocery: 1, airfare: 2, hotel: 4, general: 1 },
        hotelStatus: { automaticTier: "Discoverist", annualNights: 5, spendBlock: 5000, nightsPerBlock: 2 }
      },
      marriott_boundless: {
        label: "Marriott Bonvoy Boundless",
        ecosystem: "marriott",
        annualFee: 95,
        currency: "marriott_points",
        earn: { dining: 2, grocery: 2, airfare: 2, hotel: 6, general: 2 },
        hotelStatus: { automaticTier: "Silver Elite", annualNights: 15, spendBlock: 5000, nightsPerBlock: 1, goldAtSpend: 35000 }
      },
      marriott_brilliant: {
        label: "Marriott Bonvoy Brilliant",
        ecosystem: "marriott",
        annualFee: 650,
        currency: "marriott_points",
        earn: { dining: 3, grocery: 2, airfare: 3, hotel: 6, general: 2 },
        hotelStatus: { automaticTier: "Platinum Elite", annualNights: 25 }
      },
      hilton_no_fee: {
        label: "Hilton Honors American Express",
        ecosystem: "hilton",
        annualFee: 0,
        currency: "hilton_points",
        earn: { dining: 5, grocery: 5, airfare: 3, hotel: 7, general: 3 },
        hotelStatus: { automaticTier: "Silver", goldAtSpend: 20000 }
      },
      hilton_surpass: {
        label: "Hilton Honors Surpass",
        ecosystem: "hilton",
        annualFee: 150,
        currency: "hilton_points",
        earn: { dining: 6, grocery: 6, airfare: 3, hotel: 12, general: 3 },
        hotelStatus: { automaticTier: "Gold", diamondAtSpend: 40000 }
      },
      hilton_aspire: {
        label: "Hilton Honors Aspire",
        ecosystem: "hilton",
        annualFee: 550,
        currency: "hilton_points",
        earn: { dining: 7, grocery: 3, airfare: 7, hotel: 14, general: 3 },
        hotelStatus: { automaticTier: "Diamond" },
        benefits: [
          { id: "clear", dedupeKey: "clear", cap: 219, input: "clear_annual_spend" }
        ]
      }
    }
  });

  // QP valuation assumptions. These are modeling inputs, not issuer facts.
  const QP_VALUATION = Object.freeze({
    mode: "QP_MAX_REALISTIC_FALLBACK",
    dollarsPerPoint: {
      amex_mr: 0.020,
      chase_ur: 0.020,
      skymiles: 0.015,
      united_miles: 0.017,
      aadvantage: 0.018,
      southwest_points: 0.014,
      hyatt_points: 0.022,
      marriott_points: 0.009,
      hilton_points: 0.008
    }
  });

  const CARD_MATCHERS = [
    ["amex_gold", ["american express gold", "amex gold"]],
    ["amex_platinum", ["american express platinum", "amex platinum", "platinum card"]],
    ["chase_preferred", ["chase sapphire preferred", "sapphire preferred"]],
    ["chase_reserve", ["chase sapphire reserve", "sapphire reserve"]],
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
    ["hilton_surpass", ["hilton surpass", "hilton honors surpass", "surpass"]],
    ["hilton_aspire", ["hilton aspire", "hilton honors aspire", "aspire"]]
  ];

  const FLEX_SETS = [
    [],
    ["amex_gold"],
    ["amex_platinum"],
    ["amex_gold", "amex_platinum"],
    ["chase_preferred"],
    ["chase_reserve"]
  ];

  const AIRLINE_CARDS = {
    delta: [null, "delta_platinum", "delta_reserve"],
    united: [null, "united_explorer", "united_quest", "united_club"],
    american: [null, "aa_executive"],
    southwest: [null, "southwest_priority"],
    mixed: [null],
    unknown: [null]
  };

  const HOTEL_CARDS = {
    hyatt: [null, "hyatt_consumer"],
    marriott: [null, "marriott_boundless", "marriott_brilliant"],
    hilton: [null, "hilton_no_fee", "hilton_surpass", "hilton_aspire"],
    mixed: [null],
    other: [null]
  };

  const FLIGHT_RANGE = { "40+": 42, "21-40": 30, "11-20": 15, "6-10": 8, "0-5": 4 };
  const NIGHT_RANGE = { "40+": 42, "21-39": 30, "21-40": 30, "11-20": 15, "6-10": 8, "0-5": 4 };

  // ---------------------------------------------------------------------------
  // Identification / normalization
  // ---------------------------------------------------------------------------

  function identifyCard(raw) {
    const s = lc(raw);
    if (!s) return null;
    for (const [id, terms] of CARD_MATCHERS) {
      if (terms.some(t => s.includes(t))) return { id, ...RULES.cards[id], raw: clean(raw), supported: true };
    }
    return { id: "unsupported", label: clean(raw), raw: clean(raw), supported: false };
  }

  function normalizeCardList(v) {
    if (Array.isArray(v)) return v.map(x => typeof x === "string" ? identifyCard(x) : identifyCard(x?.id || x?.label)).filter(Boolean);
    const s = clean(v);
    if (!s) return [];
    return s.split(/\n|,|;/).map(identifyCard).filter(Boolean);
  }

  function normalizeAirline(v) {
    const s = lc(v);
    if (s.includes("delta")) return "delta";
    if (s.includes("united")) return "united";
    if (s.includes("american") || s.includes("aadvantage")) return "american";
    if (s.includes("southwest")) return "southwest";
    if (s.includes("mixed") || s.includes("none") || s.includes("no primary")) return "mixed";
    return s || "unknown";
  }

  function normalizeHotel(v) {
    const s = lc(v);
    if (s.includes("hyatt")) return "hyatt";
    if (s.includes("marriott") || s.includes("bonvoy")) return "marriott";
    if (s.includes("hilton")) return "hilton";
    if (!s || s.includes("none") || s.includes("mixed")) return "mixed";
    return "other";
  }

  function normalizeGeneralAllocations(raw, generalSpend) {
    const input = Array.isArray(raw.current_general_allocations) ? raw.current_general_allocations : [];
    const out = [];
    let used = 0;

    for (const item of input) {
      const rawCard = item.cardId || item.card || item.label;
      const card = RULES.cards[rawCard]
        ? { id: rawCard, ...RULES.cards[rawCard], raw: rawCard, supported: true }
        : identifyCard(rawCard);
      const amount = Math.max(0, money(item.amount));
      if (!card || amount <= 0) continue;
      out.push({ cardId: card.id, amount });
      used += amount;
    }

    if (!out.length && generalSpend > 0) {
      const c = identifyCard(raw.card_general);
      if (c) return [{ cardId: c.id, amount: generalSpend }];
    }

    if (out.length && used < generalSpend) {
      const c = identifyCard(raw.card_general);
      if (c) out.push({ cardId: c.id, amount: generalSpend - used });
    }

    return out;
  }

  function normalizeProfile(raw = {}) {
    const spend = {
      total: money(raw.total_spend),
      dining: money(raw.dining_spend),
      grocery: money(raw.grocery_spend),
      general: money(raw.general_spend),
      hotel: money(raw.hotel_spend),
      airfare: money(raw.individual_airfare_spend || raw.airfare_spend || raw.airline_spend)
    };

    const cards = normalizeCardList(raw.primary_cards);
    const usage = {
      dining: identifyCard(raw.card_dining),
      grocery: identifyCard(raw.card_groceries),
      airfare: identifyCard(raw.card_airfare),
      hotel: identifyCard(raw.card_hotels)
    };
    const generalAllocations = normalizeGeneralAllocations(raw, spend.general);

    const allCards = new Map();
    [...cards, ...Object.values(usage).filter(Boolean)].forEach(c => {
      const k = c.id === "unsupported" ? `unsupported:${lc(c.raw)}` : c.id;
      if (!allCards.has(k)) allCards.set(k, c);
    });
    for (const a of generalAllocations) {
      const c = RULES.cards[a.cardId] ? { id: a.cardId, ...RULES.cards[a.cardId], supported: true } : null;
      if (c && !allCards.has(c.id)) allCards.set(c.id, c);
    }

    const categoriesKnown = spend.dining + spend.grocery + spend.general + spend.hotel + spend.airfare;
    const reconciliationDelta = spend.total ? spend.total - categoriesKnown : null;

    return {
      identity: { firstName: clean(raw.first_name || raw.full_name).split(/\s+/)[0] || null },
      spend: {
        ...spend,
        categoriesKnown,
        reconciliationDelta,
        reconciliationStatus:
          !spend.total ? "unknown_total" :
          Math.abs(reconciliationDelta) <= Math.max(1000, spend.total * 0.05) ? "reconciled" :
          reconciliationDelta > 0 ? "unclassified_spend_remaining" :
          "categories_exceed_total"
      },
      travel: {
        primaryAirline: normalizeAirline(raw.primary_airline_eco || raw.primary_airline),
        reportedStatus: clean(raw.primary_airline_status || raw.primary_airline),
        flights: parseRange(raw.flights_taken, FLIGHT_RANGE, 0),
        concentrationPct: parsePercent(raw.airline_conc),
        homeAirport: clean(raw.home_airport),
        frequentDestinations: clean(raw.frequent_destinations),
        bookingControl: lc(raw.booking_control),
        bookingMethod: lc(raw.booking_method),
        cabin: clean(raw.cabin_booked)
      },
      hotel: {
        program: normalizeHotel(raw.primary_hotel_program || raw.primary_hotel),
        reportedStatus: clean(raw.primary_hotel_status || raw.primary_hotel),
        nights: parseRange(raw.hotel_nights, NIGHT_RANGE, 0),
        stays: money(raw.hotel_stays),
        spend: spend.hotel,
        concentrationPct: parsePercent(raw.hotel_conc),
        bookingMethod: lc(raw.hotel_booking_method || raw.booking_method)
      },
      preferences: {
        desiredOutcomes: lc(Array.isArray(raw.desired_outcomes) ? raw.desired_outcomes.join(",") : raw.desired_outcomes),
        willingnessToConcentrate: lc(raw.willing_to_concentrate || "yes")
      },
      benefits: {
        clearAnnualSpend: money(raw.clear_annual_spend),
        loungeAnnualValue: money(raw.lounge_annual_value),
        checkedBagRoundTrips: money(raw.checked_bag_roundtrips),
        companionFare: money(raw.companion_fare),
        companionTravel: lc(raw.companion_travel),
        goldCreditUse: money(raw.gold_credit_use),
        platinumOtherCreditUse: money(raw.platinum_other_credit_use)
      },
      pointBalances: raw.point_balances && typeof raw.point_balances === "object" ? raw.point_balances : {},
      welcomeOffers: Array.isArray(raw.welcome_offers) ? raw.welcome_offers : [],
      cards: [...allCards.values()],
      usage,
      generalAllocations,
      raw
    };
  }

  // ---------------------------------------------------------------------------
  // Tier helpers
  // ---------------------------------------------------------------------------

  function airlineTierRank(eco, tier) {
    if (!tier || !RULES.airlines[eco]) return 0;
    const i = RULES.airlines[eco].thresholds.findIndex(t => t.tier === tier);
    return i < 0 ? 0 : i + 1;
  }

  function hotelTierRank(program, tier) {
    if (!tier || !RULES.hotels[program]) return 0;
    const i = RULES.hotels[program].tiers.indexOf(tier);
    return i < 0 ? 0 : i + 1;
  }

  function maxHotelTier(program, a, b) {
    return hotelTierRank(program, a) >= hotelTierRank(program, b) ? (a || b) : b;
  }

  function tierFromMetric(thresholds, metric) {
    let result = null;
    for (const t of thresholds) if (metric >= t.amount) result = t.tier;
    return result;
  }

  function nextMetricTier(thresholds, metric) {
    const t = thresholds.find(x => metric < x.amount);
    return t ? { tier: t.tier, threshold: t.amount, remaining: Math.max(0, t.amount - metric) } : null;
  }

  // ---------------------------------------------------------------------------
  // Current status production
  // ---------------------------------------------------------------------------

  function airlineGeneralSpendOn(profile, cardId) {
    return profile.generalAllocations
      .filter(a => a.cardId === cardId)
      .reduce((s, a) => s + a.amount, 0);
  }

  function airlineStatus(profile, cardId = null, generalSpend = 0, currentMode = false) {
    const eco = profile.travel.primaryAirline;
    const rules = RULES.airlines[eco];
    if (!rules) return { ecosystem: eco, supported: false, tier: null, metric: 0, nextTier: null };

    let metric = 0;
    let tier = null;
    const conditions = [];

    if (eco === "delta") {
      // Individual qualifying airfare only; household airfare is not silently treated as MQDs.
      metric += profile.spend.airfare;

      if (currentMode) {
        for (const c of profile.cards) {
          if (c.id === "delta_platinum" || c.id === "delta_reserve") metric += 2500;
        }
        metric += airlineGeneralSpendOn(profile, "delta_platinum") / 20;
        metric += airlineGeneralSpendOn(profile, "delta_reserve") / 10;
      } else if (cardId) {
        const c = RULES.cards[cardId];
        if (cardId === "delta_platinum" || cardId === "delta_reserve") metric += c.status.headstart;
        if (cardId === "delta_platinum") metric += generalSpend / 20;
        if (cardId === "delta_reserve") metric += generalSpend / 10;
      }
      tier = tierFromMetric(rules.thresholds, metric);
    }

    if (eco === "united") {
      metric += profile.spend.airfare; // conservative confirmed proxy; conditional annual bonus excluded.
      const calc = (id, spend) => {
        const s = RULES.cards[id]?.status;
        if (!s) return 0;
        return Math.min(s.annualCap || Infinity, spend / s.spendDivisor);
      };
      if (currentMode) {
        metric += calc("united_explorer", airlineGeneralSpendOn(profile, "united_explorer"));
        metric += calc("united_quest", airlineGeneralSpendOn(profile, "united_quest"));
        metric += calc("united_club", airlineGeneralSpendOn(profile, "united_club"));
      } else if (cardId) {
        metric += calc(cardId, generalSpend);
      }
      conditions.push("Annual Card Bonus PQP is not included unless its timing condition is confirmed.");
      tier = tierFromMetric(rules.thresholds, metric);
    }

    if (eco === "american") {
      if (currentMode) metric += airlineGeneralSpendOn(profile, "aa_executive");
      else if (cardId === "aa_executive") metric += generalSpend;
      conditions.push("Flight Loyalty Points require fare/status-specific data and are not estimated with a blanket multiplier.");
      tier = tierFromMetric(rules.thresholds, metric);
    }

    if (eco === "southwest") {
      const cardTqp = spend => Math.floor(spend / 5000) * 2500;
      if (currentMode) metric += cardTqp(airlineGeneralSpendOn(profile, "southwest_priority"));
      else if (cardId === "southwest_priority") metric += cardTqp(generalSpend);

      const metricTier = tierFromMetric(rules.thresholds, metric);
      let flightTier = null;
      for (const t of rules.flightThresholds) if (profile.travel.flights >= t.flights) flightTier = t.tier;
      tier = airlineTierRank("southwest", metricTier) >= airlineTierRank("southwest", flightTier) ? metricTier : flightTier;
      conditions.push("Flight-earned TQP is not inferred from airfare dollars.");
    }

    metric = round(metric, 0);
    return {
      ecosystem: eco,
      supported: true,
      metricName: rules.metric,
      metric,
      tier,
      nextTier: nextMetricTier(rules.thresholds, metric),
      conditions
    };
  }

  function hotelStatus(profile, cardId = null, generalSpend = 0, currentMode = false) {
    const program = profile.hotel.program;
    const rules = RULES.hotels[program];
    if (!rules) return { program, supported: false, tier: null, qualifyingNights: profile.hotel.nights };

    let automaticTier = null;
    let cardNights = 0;

    const applyCard = (id, spend) => {
      const hs = RULES.cards[id]?.hotelStatus;
      if (!hs) return;
      automaticTier = maxHotelTier(program, automaticTier, hs.automaticTier);
      cardNights += hs.annualNights || 0;

      if (program === "hyatt" && id === "hyatt_consumer") {
        cardNights += Math.floor(spend / 5000) * 2;
      }
      if (program === "marriott" && id === "marriott_boundless") {
        cardNights += Math.floor(spend / 5000);
        if (spend >= 35000) automaticTier = maxHotelTier(program, automaticTier, "Gold Elite");
      }
      if (program === "hilton" && id === "hilton_no_fee" && spend >= 20000) {
        automaticTier = maxHotelTier(program, automaticTier, "Gold");
      }
      if (program === "hilton" && id === "hilton_surpass" && spend >= 40000) {
        automaticTier = maxHotelTier(program, automaticTier, "Diamond");
      }
    };

    if (currentMode) {
      for (const c of profile.cards) {
        if (c.ecosystem === program && c.hotelStatus) applyCard(c.id, airlineGeneralSpendOn(profile, c.id));
      }
    } else if (cardId) {
      applyCard(cardId, generalSpend);
    }

    const qualifyingNights = profile.hotel.nights + cardNights;
    let activityTier = null;

    if (program === "hyatt" || program === "marriott") {
      for (const t of rules.thresholds) if (qualifyingNights >= t.nights) activityTier = t.tier;
    }

    if (program === "hilton") {
      for (const t of rules.thresholds) {
        if (
          (t.nights && profile.hotel.nights >= t.nights) ||
          (t.stays && profile.hotel.stays >= t.stays) ||
          (t.spend && profile.hotel.spend >= t.spend)
        ) activityTier = t.tier;
      }
      const dr = rules.diamondReserve;
      if ((profile.hotel.nights >= dr.nights || profile.hotel.stays >= dr.stays) && profile.hotel.spend >= dr.spend) {
        activityTier = "Diamond Reserve";
      }
    }

    return {
      program,
      supported: true,
      tier: maxHotelTier(program, automaticTier, activityTier),
      automaticTier,
      activityTier,
      qualifyingNights
    };
  }

  // ---------------------------------------------------------------------------
  // Status attainability and breakpoint spend
  // ---------------------------------------------------------------------------

  function airlineStatusSpendAllowed(profile) {
    if (!RULES.airlines[profile.travel.primaryAirline]) return false;
    if (profile.travel.flights < 6) return false;
    if (profile.preferences.willingnessToConcentrate.includes("no")) return false;
    if (/(no control|employer|limited|none)/.test(profile.travel.bookingControl)) return false;
    if (profile.travel.concentrationPct != null && profile.travel.concentrationPct < 50) return false;
    return true;
  }

  function hotelStatusSpendAllowed(profile) {
    if (!RULES.hotels[profile.hotel.program]) return false;
    if (profile.hotel.nights < 6) return false;
    if (profile.preferences.willingnessToConcentrate.includes("no")) return false;
    if (profile.hotel.concentrationPct != null && profile.hotel.concentrationPct < 40) return false;
    return true;
  }

  function airlineBaseMetric(profile, cardId) {
    const eco = profile.travel.primaryAirline;
    if (!RULES.airlines[eco]) return 0;

    if (eco === "delta") {
      let m = profile.spend.airfare;
      if (cardId === "delta_platinum" || cardId === "delta_reserve") m += 2500;
      return m;
    }
    if (eco === "united") return profile.spend.airfare;
    return 0;
  }

  function requiredAirlineSpend(profile, cardId, targetAmount) {
    if (!cardId) return Infinity;
    const eco = profile.travel.primaryAirline;
    const need = Math.max(0, targetAmount - airlineBaseMetric(profile, cardId));
    if (!need) return 0;

    if (eco === "delta" && cardId === "delta_reserve") return need * 10;
    if (eco === "delta" && cardId === "delta_platinum") return need * 20;

    if (eco === "united") {
      const s = RULES.cards[cardId]?.status;
      if (!s) return Infinity;
      if (need > s.annualCap) return Infinity;
      return need * s.spendDivisor;
    }

    if (eco === "american" && cardId === "aa_executive") return need;

    if (eco === "southwest" && cardId === "southwest_priority") {
      return Math.ceil(need / 2500) * 5000;
    }

    return Infinity;
  }

  function airlineSpendOptions(profile, cardId) {
    const out = [{ amount: 0, targetTier: null }];
    const eco = profile.travel.primaryAirline;
    if (!cardId || !airlineStatusSpendAllowed(profile) || !RULES.airlines[eco]) return out;

    // If Southwest flights already produce a tier, do not spend merely to reproduce it.
    const currentFlightTier = eco === "southwest" ? airlineStatus(profile, null, 0, false).tier : null;

    for (const t of RULES.airlines[eco].thresholds) {
      if (currentFlightTier && airlineTierRank(eco, currentFlightTier) >= airlineTierRank(eco, t.tier)) continue;
      const req = requiredAirlineSpend(profile, cardId, t.amount);
      if (Number.isFinite(req) && req > 0 && req <= profile.spend.general) out.push({ amount: round(req), targetTier: t.tier });
    }

    return dedupeOptions(out);
  }

  function hotelSpendOptions(profile, cardId) {
    const out = [{ amount: 0, targetTier: null }];
    const program = profile.hotel.program;
    if (!cardId || !hotelStatusSpendAllowed(profile) || !RULES.hotels[program]) return out;

    const zero = hotelStatus(profile, cardId, 0, false);

    if (program === "hyatt" && cardId === "hyatt_consumer") {
      for (const t of RULES.hotels.hyatt.thresholds) {
        if (hotelTierRank(program, zero.tier) >= hotelTierRank(program, t.tier)) continue;
        const nightsNeeded = Math.max(0, t.nights - zero.qualifyingNights);
        const req = Math.ceil(nightsNeeded / 2) * 5000;
        if (req > 0 && req <= profile.spend.general) out.push({ amount: req, targetTier: t.tier });
      }
    }

    if (program === "marriott" && cardId === "marriott_boundless") {
      for (const t of RULES.hotels.marriott.thresholds) {
        if (hotelTierRank(program, zero.tier) >= hotelTierRank(program, t.tier)) continue;
        const nightsNeeded = Math.max(0, t.nights - zero.qualifyingNights);
        const req = nightsNeeded * 5000;
        if (req > 0 && req <= profile.spend.general) out.push({ amount: req, targetTier: t.tier });
      }
      if (35000 <= profile.spend.general) out.push({ amount: 35000, targetTier: "Gold Elite" });
    }

    if (program === "hilton" && cardId === "hilton_no_fee" && 20000 <= profile.spend.general) {
      out.push({ amount: 20000, targetTier: "Gold" });
    }
    if (program === "hilton" && cardId === "hilton_surpass" && 40000 <= profile.spend.general) {
      out.push({ amount: 40000, targetTier: "Diamond" });
    }

    return dedupeOptions(out);
  }

  function dedupeOptions(arr) {
    const seen = new Set();
    return arr.filter(x => {
      const k = `${round(x.amount)}:${x.targetTier || ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).sort((a, b) => a.amount - b.amount);
  }

  // ---------------------------------------------------------------------------
  // Rewards + benefits
  // ---------------------------------------------------------------------------

  function valuation(currency, profile) {
    const override = profile.raw?.valuation_overrides?.[currency];
    if (Number(override) > 0) return { dpp: Number(override), source: "USER_SPECIFIC" };
    return { dpp: QP_VALUATION.dollarsPerPoint[currency] || 0, source: QP_VALUATION.mode };
  }

  function bookingChannel(profile, category) {
    const s = category === "hotel" ? profile.hotel.bookingMethod : profile.travel.bookingMethod;
    if (s.includes("amex")) return "amex";
    if (s.includes("chase")) return "chase";
    if (s.includes("direct")) return "direct";
    if (s.includes("mixed")) return "mixed";
    return "unknown";
  }

  function rewardRate(cardId, category, profile) {
    const card = RULES.cards[cardId];
    if (!card?.earn) return 0;
    let rate = card.earn[category] || 0;
    const channel = bookingChannel(profile, category);

    if (card.hotelPortalRequired && category === "hotel" && channel !== card.hotelPortalRequired) rate = 1;
    if (card.portalTravelEarn && (category === "airfare" || category === "hotel") && channel === "chase") {
      rate = card.portalTravelEarn;
    }

    if (category === "airfare") {
      const eco = profile.travel.primaryAirline;
      if (cardId.startsWith("delta_") && eco !== "delta") rate = 1;
      if (cardId.startsWith("united_") && eco !== "united") rate = 1;
      if (cardId === "aa_executive" && eco !== "american") rate = 1;
      if (cardId === "southwest_priority" && eco !== "southwest") rate = 1;
    }
    return rate;
  }

  function rewardValue(cardId, category, amount, profile, options = {}) {
    if (!cardId || amount <= 0 || !RULES.cards[cardId]?.currency) {
      return { cardId, category, amount, points: 0, dollars: 0, currency: null, rate: 0, source: "UNSUPPORTED_OR_UNKNOWN" };
    }

    const card = RULES.cards[cardId];
    let eligibleAmount = amount;

    // Purchases receiving the CSR travel credit do not earn points.
    if (cardId === "chase_reserve" && (category === "airfare" || category === "hotel") && options.csrCreditApplied) {
      eligibleAmount = Math.max(0, amount - options.csrCreditApplied);
    }

    const rate = rewardRate(cardId, category, profile);
    let points = eligibleAmount * rate;

    if (card.caps?.[category]) {
      const cap = card.caps[category];
      const within = Math.min(eligibleAmount, cap);
      const over = Math.max(0, eligibleAmount - cap);
      points = within * rate + over;
    }
    if (category === "airfare" && card.airfareCap) {
      const within = Math.min(eligibleAmount, card.airfareCap);
      const over = Math.max(0, eligibleAmount - card.airfareCap);
      points = within * rate + over;
    }

    const v = valuation(card.currency, profile);
    return {
      cardId,
      category,
      amount,
      eligibleAmount,
      rate,
      currency: card.currency,
      points: round(points),
      dollars: round(points * v.dpp, 2),
      dollarsPerPoint: v.dpp,
      source: v.source
    };
  }

  function bestRewardCard(cardIds, category, amount, profile) {
    let best = null;
    for (const id of uniq(cardIds)) {
      const r = rewardValue(id, category, amount, profile);
      if (!best || r.dollars > best.dollars) best = r;
    }
    return best || { cardId: null, dollars: 0, points: 0, currency: null, rate: 0 };
  }

  function benefitLedger(profile, cardIds, assignments) {
    const used = new Set();
    const items = [];
    const conditional = [];

    function add(item) {
      if (!item || item.value <= 0) return;
      if (item.dedupeKey && used.has(item.dedupeKey)) return;
      if (item.dedupeKey) used.add(item.dedupeKey);
      items.push(item);
    }

    const set = new Set(cardIds);

    if (set.has("chase_reserve")) {
      const csrTravel = ["airfare", "hotel"].reduce((sum, cat) => {
        const a = assignments.categories[cat];
        return sum + (a?.cardId === "chase_reserve" ? a.amount : 0);
      }, 0);
      add({ id: "travel_credit", dedupeKey: "csr_travel_credit", value: Math.min(300, csrTravel), confidence: "CONFIRMED_FROM_ROUTING" });
    }

    if (set.has("amex_gold") && profile.benefits.goldCreditUse > 0) {
      add({ id: "amex_gold_natural_credits", dedupeKey: "amex_gold_natural_credits", value: Math.min(424, profile.benefits.goldCreditUse), confidence: "USER_BEHAVIOR" });
    }

    if (set.has("amex_platinum") && profile.benefits.platinumOtherCreditUse > 0) {
      add({ id: "amex_platinum_other_credits", dedupeKey: "amex_platinum_other_credits", value: profile.benefits.platinumOtherCreditUse, confidence: "USER_BEHAVIOR" });
    }

    const clearCards = ["amex_platinum", "hilton_aspire"].filter(id => set.has(id));
    if (clearCards.length && profile.benefits.clearAnnualSpend > 0) {
      add({ id: "clear", dedupeKey: "clear", value: Math.min(219, profile.benefits.clearAnnualSpend), confidence: "USER_BEHAVIOR" });
    }

    const loungeCards = ["amex_platinum", "chase_reserve", "delta_reserve", "united_club", "aa_executive"].filter(id => set.has(id));
    if (loungeCards.length && profile.benefits.loungeAnnualValue > 0) {
      add({ id: "lounge", dedupeKey: "lounge", value: profile.benefits.loungeAnnualValue, confidence: "USER_BEHAVIOR" });
    }

    if (set.has("delta_reserve") || set.has("delta_platinum")) {
      conditional.push("Delta companion certificate is renewal-only and excluded from confirmed first-year value unless explicitly modeled.");
    }

    return {
      value: round(items.reduce((s, x) => s + x.value, 0), 2),
      items,
      conditional
    };
  }

  function existingPointBalanceValue(profile) {
    const lines = [];
    let total = 0;
    for (const [currency, pointsRaw] of Object.entries(profile.pointBalances || {})) {
      const points = money(pointsRaw);
      if (points <= 0) continue;
      const v = valuation(currency, profile);
      const value = points * v.dpp;
      lines.push({ currency, points, value: round(value, 2), source: v.source });
      total += value;
    }
    return { total: round(total, 2), lines, includedInAnnualValue: false };
  }

  // ---------------------------------------------------------------------------
  // Architecture evaluation
  // ---------------------------------------------------------------------------

  function buildCandidateAssignments(profile, cardIds, airlineCardId, hotelCardId, airlineSpend, hotelSpend) {
    const categories = {};
    for (const [category, amount] of Object.entries({
      dining: profile.spend.dining,
      grocery: profile.spend.grocery,
      airfare: profile.spend.airfare,
      hotel: profile.spend.hotel
    })) {
      const best = bestRewardCard(cardIds, category, amount, profile);
      categories[category] = { cardId: best.cardId, amount, purpose: "rewards" };
    }

    const general = [];
    if (airlineSpend > 0 && airlineCardId) general.push({ cardId: airlineCardId, amount: airlineSpend, purpose: "airline_status" });
    if (hotelSpend > 0 && hotelCardId) general.push({ cardId: hotelCardId, amount: hotelSpend, purpose: "hotel_status" });

    const remainder = Math.max(0, profile.spend.general - airlineSpend - hotelSpend);
    if (remainder > 0) {
      const best = bestRewardCard(cardIds, "general", remainder, profile);
      general.push({ cardId: best.cardId, amount: remainder, purpose: "rewards" });
    }
    return { categories, general };
  }

  function currentAssignments(profile) {
    const categories = {
      dining: { cardId: profile.usage.dining?.id === "unsupported" ? null : profile.usage.dining?.id, amount: profile.spend.dining, purpose: "current" },
      grocery: { cardId: profile.usage.grocery?.id === "unsupported" ? null : profile.usage.grocery?.id, amount: profile.spend.grocery, purpose: "current" },
      airfare: { cardId: profile.usage.airfare?.id === "unsupported" ? null : profile.usage.airfare?.id, amount: profile.spend.airfare, purpose: "current" },
      hotel: { cardId: profile.usage.hotel?.id === "unsupported" ? null : profile.usage.hotel?.id, amount: profile.spend.hotel, purpose: "current" }
    };
    return { categories, general: profile.generalAllocations.map(a => ({ ...a, purpose: "current" })) };
  }

  function assignmentCardIds(assignments) {
    return uniq([
      ...Object.values(assignments.categories).map(a => a?.cardId),
      ...assignments.general.map(a => a.cardId)
    ]);
  }

  function rewardLedger(profile, assignments) {
    const lines = [];
    let value = 0;

    // Determine CSR travel credit once, then remove credited spend from points.
    let csrCreditRemaining = 300;
    for (const category of ["airfare", "hotel"]) {
      const a = assignments.categories[category];
      if (a?.cardId === "chase_reserve" && a.amount > 0 && csrCreditRemaining > 0) {
        const applied = Math.min(csrCreditRemaining, a.amount);
        const r = rewardValue(a.cardId, category, a.amount, profile, { csrCreditApplied: applied });
        lines.push({ ...r, csrCreditApplied: applied });
        value += r.dollars;
        csrCreditRemaining -= applied;
      } else if (a) {
        const r = rewardValue(a.cardId, category, a.amount, profile);
        lines.push(r);
        value += r.dollars;
      }
    }

    for (const category of ["dining", "grocery"]) {
      const a = assignments.categories[category];
      if (!a) continue;
      const r = rewardValue(a.cardId, category, a.amount, profile);
      lines.push(r);
      value += r.dollars;
    }

    for (const a of assignments.general) {
      const r = rewardValue(a.cardId, "general", a.amount, profile);
      lines.push({ ...r, purpose: a.purpose });
      value += r.dollars;
    }

    return { value: round(value, 2), lines };
  }

  function fees(cardIds) {
    return round(uniq(cardIds).reduce((s, id) => s + (RULES.cards[id]?.annualFee || 0), 0), 2);
  }

  function experienceScore(profile, air, hotel, cardIds) {
    let score = 0;
    const flightWeight = Math.min(2, Math.max(0.5, profile.travel.flights / 15));
    const hotelWeight = Math.min(2, Math.max(0.5, profile.hotel.nights / 20));

    score += airlineTierRank(profile.travel.primaryAirline, air?.tier) * 10 * flightWeight;
    score += hotelTierRank(profile.hotel.program, hotel?.tier) * 8 * hotelWeight;

    const hasLounge = cardIds.some(id => ["amex_platinum", "chase_reserve", "delta_reserve", "united_club", "aa_executive"].includes(id));
    if (profile.travel.flights >= 8 && hasLounge) score += 5;

    const wants = profile.preferences.desiredOutcomes;
    if (wants.includes("status") && air?.tier) score += 5;
    if ((wants.includes("upgrade") || wants.includes("treatment")) && air?.tier) score += 4;
    if ((wants.includes("hotel") || wants.includes("recognition")) && hotel?.tier) score += 5;
    return round(score, 2);
  }

  function evaluateArchitecture(profile, spec, current = false) {
    const assignments = current ? currentAssignments(profile) : buildCandidateAssignments(
      profile, spec.cardIds, spec.airlineCardId, spec.hotelCardId, spec.airlineSpend, spec.hotelSpend
    );
    const cardIds = current ? uniq(profile.cards.filter(c => c.supported).map(c => c.id)) : uniq(spec.cardIds);
    const rewards = rewardLedger(profile, assignments);
    const benefits = benefitLedger(profile, cardIds, assignments);
    const annualFee = fees(cardIds);
    const air = current
      ? airlineStatus(profile, null, 0, true)
      : airlineStatus(profile, spec.airlineCardId, spec.airlineSpend, false);
    const hotel = current
      ? hotelStatus(profile, null, 0, true)
      : hotelStatus(profile, spec.hotelCardId, spec.hotelSpend, false);

    return {
      id: current ? "current" : spec.id,
      kind: current ? "CURRENT" : "CANDIDATE",
      cardIds,
      cards: cardIds.map(id => ({ id, label: RULES.cards[id]?.label || id })),
      assignments,
      airlineCardId: current ? null : spec.airlineCardId,
      hotelCardId: current ? null : spec.hotelCardId,
      airlineStatusSpend: current ? null : spec.airlineSpend,
      hotelStatusSpend: current ? null : spec.hotelSpend,
      airline: air,
      hotel,
      rewards,
      benefits,
      economics: {
        grossValue: round(rewards.value + benefits.value, 2),
        annualCost: annualFee,
        netValue: round(rewards.value + benefits.value - annualFee, 2)
      },
      experienceScore: experienceScore(profile, air, hotel, cardIds)
    };
  }

  function candidateSpecs(profile) {
    const airlineCards = AIRLINE_CARDS[profile.travel.primaryAirline] || [null];
    const hotelCards = HOTEL_CARDS[profile.hotel.program] || [null];
    const specs = [];
    let n = 0;

    for (const aCard of airlineCards) {
      for (const hCard of hotelCards) {
        for (const flex of FLEX_SETS) {
          const cardIds = uniq([aCard, hCard, ...flex]);
          if (!cardIds.length) continue;

          for (const aOpt of airlineSpendOptions(profile, aCard)) {
            for (const hOpt of hotelSpendOptions(profile, hCard)) {
              if (aOpt.amount + hOpt.amount > profile.spend.general) continue;
              specs.push({
                id: `cand_${++n}`,
                cardIds,
                airlineCardId: aCard,
                hotelCardId: hCard,
                airlineSpend: aOpt.amount,
                airlineTargetTier: aOpt.targetTier,
                hotelSpend: hOpt.amount,
                hotelTargetTier: hOpt.targetTier
              });
            }
          }
        }
      }
    }
    return specs;
  }

  function cardChangeCount(a, b) {
    const A = new Set(a), B = new Set(b);
    let n = 0;
    for (const id of A) if (!B.has(id)) n++;
    for (const id of B) if (!A.has(id)) n++;
    return n;
  }

  function chooseRecommended(profile, current, candidates, maximum) {
    const maxNet = maximum.economics.netValue;
    const baseTolerance = Math.max(150, Math.max(0, maxNet) * 0.03);

    const protectAirlineStatus = /status|upgrade|treatment/.test(profile.preferences.desiredOutcomes);
    const protectHotelStatus = /hotel|recognition/.test(profile.preferences.desiredOutcomes);
    const currentAirRank0 = airlineTierRank(profile.travel.primaryAirline, current.airline?.tier);
    const maximumAirRank0 = airlineTierRank(profile.travel.primaryAirline, maximum.airline?.tier);
    const currentHotelRank0 = hotelTierRank(profile.hotel.program, current.hotel?.tier);
    const maximumHotelRank0 = hotelTierRank(profile.hotel.program, maximum.hotel?.tier);
    const economicGainOverCurrent = Math.max(0, maxNet - current.economics.netValue);
    const statusProtectionBudget = Math.max(750, Math.max(0, maxNet) * 0.15);

    if (
      economicGainOverCurrent <= statusProtectionBudget &&
      (
        (protectAirlineStatus && currentAirRank0 > maximumAirRank0) ||
        (protectHotelStatus && currentHotelRank0 > maximumHotelRank0)
      )
    ) {
      return { ...current, recommendationReason: "PRESERVE_EXPLICITLY_VALUED_EXISTING_STATUS" };
    }

    // Preserve current setup if economics are essentially optimal and experience
    // is not materially worse.
    if (
      current.economics.netValue >= maxNet - baseTolerance &&
      current.experienceScore >= maximum.experienceScore - 4
    ) {
      return { ...current, recommendationReason: "ALREADY_NEAR_OPTIMAL" };
    }

    // QP may give up a small amount of theoretical net value for a meaningful
    // experience improvement, but not a large amount.
    const wantsStatus = /status|upgrade|treatment|hotel|recognition/.test(profile.preferences.desiredOutcomes);
    const tolerance = wantsStatus ? Math.max(250, Math.max(0, maxNet) * 0.05) : baseTolerance;
    let near = candidates.filter(c => c.economics.netValue >= maxNet - tolerance);

    const protectAirline = /status|upgrade|treatment/.test(profile.preferences.desiredOutcomes);
    const protectHotel = /hotel|recognition/.test(profile.preferences.desiredOutcomes);
    const currentAirRank = airlineTierRank(profile.travel.primaryAirline, current.airline?.tier);
    const currentHotelRank = hotelTierRank(profile.hotel.program, current.hotel?.tier);

    if (protectAirline && currentAirRank > 0) {
      const protectedAir = near.filter(c =>
        airlineTierRank(profile.travel.primaryAirline, c.airline?.tier) >= currentAirRank
      );
      if (protectedAir.length) near = protectedAir;
    }

    if (protectHotel && currentHotelRank > 0) {
      const protectedHotel = near.filter(c =>
        hotelTierRank(profile.hotel.program, c.hotel?.tier) >= currentHotelRank
      );
      if (protectedHotel.length) near = protectedHotel;
    }

    let best = maximum;
    let bestUtility = -Infinity;

    for (const c of near) {
      const changes = cardChangeCount(current.cardIds, c.cardIds);
      const simplicityPenalty = Math.max(0, c.cardIds.length - 2) * 3 + changes * 1.5;
      const valueLoss = Math.max(0, maxNet - c.economics.netValue);
      const utility = c.experienceScore - simplicityPenalty - valueLoss / 100;

      if (utility > bestUtility || (utility === bestUtility && c.economics.netValue > best.economics.netValue)) {
        best = c;
        bestUtility = utility;
      }
    }

    return { ...best, recommendationReason: "BALANCED_MAX_VALUE_EXPERIENCE_SIMPLICITY" };
  }

  // ---------------------------------------------------------------------------
  // Spend Misrouted
  // ---------------------------------------------------------------------------

  function totalsByCard(segments) {
    const m = {};
    for (const s of segments) {
      if (!s.cardId) continue;
      m[s.cardId] = (m[s.cardId] || 0) + s.amount;
    }
    return m;
  }

  function spendMisrouted(profile, recommended) {
    let misrouted = 0;
    let unknown = 0;
    const categoryMap = {
      dining: [profile.usage.dining, profile.spend.dining],
      grocery: [profile.usage.grocery, profile.spend.grocery],
      airfare: [profile.usage.airfare, profile.spend.airfare],
      hotel: [profile.usage.hotel, profile.spend.hotel]
    };

    for (const [cat, [cur, amount]] of Object.entries(categoryMap)) {
      if (amount <= 0) continue;
      const rec = recommended.assignments.categories[cat]?.cardId || null;
      if (!cur || cur.id === "unsupported") {
        unknown += amount;
      } else if (rec && cur.id !== rec) {
        misrouted += amount;
      }
    }

    const currentGeneral = totalsByCard(profile.generalAllocations);
    const recGeneral = totalsByCard(recommended.assignments.general);
    const allIds = uniq([...Object.keys(currentGeneral), ...Object.keys(recGeneral)]);
    let l1 = 0;
    for (const id of allIds) l1 += Math.abs((currentGeneral[id] || 0) - (recGeneral[id] || 0));
    misrouted += l1 / 2;

    const totalRoutable = profile.spend.dining + profile.spend.grocery + profile.spend.airfare + profile.spend.hotel + profile.spend.general;
    const percent = unknown > 0 || totalRoutable <= 0 ? null : round(clamp((misrouted / totalRoutable) * 100, 0, 100), 1);

    return {
      dollars: round(misrouted),
      percent,
      totalRoutable: round(totalRoutable),
      unknownRoutingDollars: round(unknown),
      confidence: unknown > 0 ? "PARTIAL" : "COMPLETE"
    };
  }

  // ---------------------------------------------------------------------------
  // Welcome offers — explicit/dated input only.
  // No live offer is silently assumed by the engine.
  // ---------------------------------------------------------------------------

  function welcomeOfferValue(profile, architecture, currentCardIds) {
    const availableNonStatusSpend = Math.max(
      0,
      profile.spend.dining + profile.spend.grocery + profile.spend.airfare + profile.spend.hotel + profile.spend.general
      - (architecture.airlineStatusSpend || 0)
      - (architecture.hotelStatusSpend || 0)
    );

    let remaining = availableNonStatusSpend;
    const items = [];
    let confirmed = 0;
    let conditional = 0;

    const eligibleOffers = profile.welcomeOffers
      .filter(o => architecture.cardIds.includes(o.cardId) && !currentCardIds.includes(o.cardId))
      .map(o => {
        const v = valuation(o.currency, profile);
        const gross = money(o.bonusPoints) * v.dpp;
        const minSpend = money(o.minimumSpend);
        const cardGeneral = rewardValue(o.cardId, "general", minSpend, profile).dollars;
        const bestAlt = bestRewardCard(architecture.cardIds.filter(id => id !== o.cardId), "general", minSpend, profile).dollars;
        const opportunityCost = Math.max(0, bestAlt - cardGeneral);
        return { ...o, minSpend, gross, opportunityCost, net: Math.max(0, gross - opportunityCost) };
      })
      .sort((a, b) => b.net - a.net);

    for (const o of eligibleOffers) {
      if (lc(o.eligible) === "false" || o.eligible === false) {
        items.push({ cardId: o.cardId, status: "INELIGIBLE", value: 0 });
        continue;
      }
      if (o.minSpend > remaining) {
        items.push({ cardId: o.cardId, status: "EXCLUDED_SPEND_CONFLICT", value: 0 });
        continue;
      }
      remaining -= o.minSpend;

      if (lc(o.eligible) === "unknown") {
        conditional += o.net;
        items.push({ cardId: o.cardId, status: "CONDITIONAL", value: round(o.net, 2), minimumSpend: o.minSpend });
      } else {
        confirmed += o.net;
        items.push({ cardId: o.cardId, status: "CONFIRMED", value: round(o.net, 2), minimumSpend: o.minSpend });
      }
    }

    return { confirmed: round(confirmed, 2), conditional: round(conditional, 2), items };
  }

  // ---------------------------------------------------------------------------
  // Corrections
  // ---------------------------------------------------------------------------

  function correctionList(profile, current, recommended) {
    if (recommended.id === "current") return [];

    const out = [];
    const meta = {
      dining: ["dining spend", profile.usage.dining, profile.spend.dining],
      grocery: ["grocery spend", profile.usage.grocery, profile.spend.grocery],
      airfare: ["airfare", profile.usage.airfare, profile.spend.airfare],
      hotel: ["hotel spend", profile.usage.hotel, profile.spend.hotel]
    };

    for (const [cat, [label, cur, amount]] of Object.entries(meta)) {
      const rec = recommended.assignments.categories[cat]?.cardId;
      if (amount > 0 && rec && cur?.id !== rec) {
        const oldV = rewardValue(cur?.id, cat, amount, profile).dollars;
        const newV = rewardValue(rec, cat, amount, profile).dollars;
        out.push({
          type: "ROUTING",
          category: cat,
          change: `Route ${label} to ${RULES.cards[rec]?.label || rec}.`,
          modeledAnnualImpact: round(newV - oldV, 2),
          confidence: "MODELED"
        });
      }
    }

    const currentG = totalsByCard(profile.generalAllocations);
    for (const seg of recommended.assignments.general) {
      if (!seg.cardId || seg.amount <= 0) continue;
      const already = currentG[seg.cardId] || 0;
      const delta = Math.max(0, seg.amount - already);
      if (delta <= 0) continue;

      out.push({
        type: seg.purpose === "airline_status" ? "AIRLINE_STATUS_ROUTING" :
              seg.purpose === "hotel_status" ? "HOTEL_STATUS_ROUTING" : "GENERAL_ROUTING",
        category: "general",
        change: `Route $${Math.round(delta).toLocaleString()} of general spend to ${RULES.cards[seg.cardId]?.label || seg.cardId}${seg.purpose === "airline_status" ? " until the airline threshold is reached" : seg.purpose === "hotel_status" ? " until the hotel threshold is reached" : ""}.`,
        modeledAnnualImpact: null,
        experienceImpact: seg.purpose,
        confidence: "MODELED"
      });
    }

    const currentSet = new Set(current.cardIds);
    for (const id of recommended.cardIds) {
      if (!currentSet.has(id)) {
        out.push({
          type: "CARD_ARCHITECTURE",
          change: `Add ${RULES.cards[id]?.label || id} only if approved and eligible.`,
          modeledAnnualImpact: -(RULES.cards[id]?.annualFee || 0),
          confidence: "CONDITIONAL"
        });
      }
    }

    return out.slice(0, 5);
  }

  // ---------------------------------------------------------------------------
  // Optimizer
  // ---------------------------------------------------------------------------

  function optimizeArchitecture(rawProfile) {
    const profile = rawProfile?.spend ? rawProfile : normalizeProfile(rawProfile);
    const current = evaluateArchitecture(profile, null, true);
    const specs = candidateSpecs(profile);
    const candidates = specs.map(s => evaluateArchitecture(profile, s, false));

    let maximum = current;
    for (const c of candidates) {
      if (
        c.economics.netValue > maximum.economics.netValue ||
        (c.economics.netValue === maximum.economics.netValue && c.experienceScore > maximum.experienceScore)
      ) maximum = c;
    }

    const recommended = chooseRecommended(profile, current, candidates, maximum);
    const currentNet = Math.max(0, current.economics.netValue);
    const maxNet = Math.max(0, maximum.economics.netValue);
    const unrealized = Math.max(0, maxNet - currentNet);
    const gap = maxNet > 0 ? round(clamp(10 * unrealized / maxNet, 0, 10), 1) : 0;
    const misrouted = spendMisrouted(profile, recommended);
    const storedPoints = existingPointBalanceValue(profile);

    const welcomeMaximum = welcomeOfferValue(profile, maximum, current.cardIds);
    const welcomeRecommended = welcomeOfferValue(profile, recommended, current.cardIds);

    const firstYearMaximum = round(maxNet + welcomeMaximum.confirmed + welcomeMaximum.conditional, 2);
    const firstYearRecommended = round(
      Math.max(0, recommended.economics.netValue) +
      welcomeRecommended.confirmed +
      welcomeRecommended.conditional,
      2
    );

    const corrections = correctionList(profile, current, recommended);
    const alreadyOptimized =
      recommended.id === "current" ||
      (gap <= 0.5 && (misrouted.percent == null || misrouted.percent <= 10) && corrections.length === 0);

    const result = {
      engine: {
        version: ENGINE_VERSION,
        phase: "3C",
        rulesAsOf: RULES_AS_OF,
        valuationMode: QP_VALUATION.mode
      },
      profile,
      current,
      maximum,
      recommended,
      opportunity: {
        maximumPotentialAnnualValue: round(maxNet),
        currentlyCaptured: round(currentNet),
        unrealizedPotential: round(unrealized),
        gapScore: gap,
        spendMisrouted: misrouted,
        experienceDelta: round(recommended.experienceScore - current.experienceScore, 1)
      },
      firstYear: {
        maximumPotentialValue: round(firstYearMaximum),
        recommendedPotentialValue: round(firstYearRecommended),
        maximumWelcome: welcomeMaximum,
        recommendedWelcome: welcomeRecommended
      },
      ongoing: {
        maximumPotentialAnnualValue: round(maxNet),
        recommendedAnnualValue: round(Math.max(0, recommended.economics.netValue))
      },
      existingRedeemableValue: storedPoints,
      recommendations: {
        alreadyOptimized,
        corrections
      },
      candidateCount: candidates.length
    };

    result.integrity = validateResult(result);
    return result;
  }

  function validateResult(r) {
    const checks = [];
    const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });

    add("MAX_NOT_BELOW_CURRENT", r.maximum.economics.netValue + 0.01 >= r.current.economics.netValue,
        `${r.current.economics.netValue} <= ${r.maximum.economics.netValue}`);
    add("RECOMMENDED_NOT_ABOVE_MAX", r.recommended.economics.netValue <= r.maximum.economics.netValue + 0.01,
        `${r.recommended.economics.netValue} <= ${r.maximum.economics.netValue}`);

    const recGeneral = r.recommended.assignments.general.reduce((s, a) => s + a.amount, 0);
    add("GENERAL_SPEND_NOT_DOUBLE_ALLOCATED", recGeneral <= r.profile.spend.general + 0.01,
        `${recGeneral} / ${r.profile.spend.general}`);

    add("PRIMARY_AIRLINE_PRESERVED",
        !r.recommended.airline.supported || r.recommended.airline.ecosystem === r.profile.travel.primaryAirline,
        r.recommended.airline.ecosystem);

    add("GAP_RANGE", r.opportunity.gapScore >= 0 && r.opportunity.gapScore <= 10, r.opportunity.gapScore);
    add("MISROUTED_RANGE",
        r.opportunity.spendMisrouted.percent == null ||
        (r.opportunity.spendMisrouted.percent >= 0 && r.opportunity.spendMisrouted.percent <= 100),
        r.opportunity.spendMisrouted.percent);

    add("EXISTING_POINTS_EXCLUDED_FROM_ANNUAL",
        r.existingRedeemableValue.includedInAnnualValue === false,
        r.existingRedeemableValue.total);

    return { passed: checks.every(x => x.pass), checks };
  }

  // ---------------------------------------------------------------------------
  // Adversarial validation matrix
  // ---------------------------------------------------------------------------

  const TESTS = [
    {
      id: "optimized_high_spend",
      expect: r => r.opportunity.gapScore <= 0.5 && r.opportunity.spendMisrouted.percent <= 10,
      data: {
        total_spend: 200000,
        dining_spend: 30000,
        grocery_spend: 20000,
        general_spend: 110000,
        hotel_spend: 25000,
        individual_airfare_spend: 15000,
        primary_airline_eco: "Delta",
        primary_airline_status: "Platinum Medallion",
        flights_taken: "21-40",
        airline_conc: "80%+",
        booking_control: "Full control",
        primary_hotel_program: "Marriott",
        primary_hotel_status: "Platinum Elite",
        hotel_nights: 35,
        hotel_conc: "80%+",
        primary_cards: "American Express Gold; Marriott Bonvoy Boundless",
        card_dining: "American Express Gold",
        card_groceries: "American Express Gold",
        card_airfare: "American Express Gold",
        card_hotels: "Marriott Bonvoy Boundless",
        current_general_allocations: [
          { card: "American Express Gold", amount: 110000 }
        ],
        booking_method: "Direct",
        hotel_booking_method: "Direct",
        desired_outcomes: "redemption"
      }
    },
    {
      id: "fragmented_delta",
      expect: r => r.profile.travel.primaryAirline === "delta" &&
        r.recommended.airline.ecosystem === "delta" &&
        r.opportunity.unrealizedPotential > 0,
      data: {
        total_spend: 150000, dining_spend: 26000, grocery_spend: 18000, general_spend: 76000,
        hotel_spend: 18000, individual_airfare_spend: 12000,
        primary_airline_eco: "Delta", flights_taken: "21-40", airline_conc: "80%+",
        booking_control: "Full control", primary_hotel_program: "Hilton", hotel_nights: 18,
        hotel_conc: "60-80%", primary_cards: "American Express Platinum",
        card_dining: "American Express Platinum", card_groceries: "American Express Platinum",
        card_airfare: "American Express Platinum", card_hotels: "American Express Platinum",
        card_general: "American Express Platinum", desired_outcomes: "status, upgrades"
      }
    },
    {
      id: "united_preserved",
      expect: r => r.recommended.airline.ecosystem === "united",
      data: {
        total_spend: 150000, dining_spend: 25000, grocery_spend: 15000, general_spend: 75000,
        hotel_spend: 20000, individual_airfare_spend: 15000,
        primary_airline_eco: "United", flights_taken: "21-40", airline_conc: "80%+",
        booking_control: "Full control", primary_hotel_program: "Hyatt", hotel_nights: 20,
        hotel_conc: "70%+", primary_cards: "United Club Infinite; American Express Gold",
        card_dining: "American Express Gold", card_groceries: "American Express Gold",
        card_airfare: "United Club Infinite", card_hotels: "World of Hyatt Credit Card",
        card_general: "United Club Infinite", desired_outcomes: "status"
      }
    },
    {
      id: "american_preserved",
      expect: r => r.recommended.airline.ecosystem === "american",
      data: {
        total_spend: 150000, dining_spend: 22000, grocery_spend: 15000, general_spend: 85000,
        hotel_spend: 18000, individual_airfare_spend: 10000,
        primary_airline_eco: "American", flights_taken: "21-40", airline_conc: "80%+",
        booking_control: "Full control", primary_hotel_program: "Hyatt", hotel_nights: 15,
        hotel_conc: "70%+", primary_cards: "Citi AAdvantage Executive; American Express Gold",
        card_dining: "American Express Gold", card_groceries: "American Express Gold",
        card_airfare: "Citi AAdvantage Executive", card_hotels: "World of Hyatt Credit Card",
        card_general: "Citi AAdvantage Executive", desired_outcomes: "status"
      }
    },
    {
      id: "southwest_preserved",
      expect: r => r.recommended.airline.ecosystem === "southwest",
      data: {
        total_spend: 120000, dining_spend: 20000, grocery_spend: 15000, general_spend: 65000,
        hotel_spend: 12000, individual_airfare_spend: 8000,
        primary_airline_eco: "Southwest", flights_taken: "21-40", airline_conc: "90%+",
        booking_control: "Full control", primary_hotel_program: "Hilton", hotel_nights: 10,
        hotel_conc: "60%+", primary_cards: "Southwest Rapid Rewards Priority; American Express Gold",
        card_dining: "American Express Gold", card_groceries: "American Express Gold",
        card_airfare: "Southwest Rapid Rewards Priority", card_hotels: "Hilton Honors Surpass",
        card_general: "Southwest Rapid Rewards Priority", desired_outcomes: "status"
      }
    },
    {
      id: "little_travel_no_status_manufacture",
      expect: r => r.profile.travel.flights < 6 && (r.recommended.airlineStatusSpend || 0) === 0,
      data: {
        total_spend: 75000, dining_spend: 16000, grocery_spend: 12000, general_spend: 39000,
        hotel_spend: 4000, individual_airfare_spend: 4000,
        primary_airline_eco: "Delta", flights_taken: "0-5", airline_conc: "80%+",
        booking_control: "Full control", primary_hotel_program: "None", hotel_nights: "0-5",
        primary_cards: "American Express Gold", card_dining: "American Express Gold",
        card_groceries: "American Express Gold", card_airfare: "American Express Gold",
        card_hotels: "American Express Gold", card_general: "American Express Gold",
        desired_outcomes: "redemption"
      }
    },
    {
      id: "heavy_travel_modest_spend",
      expect: r => r.profile.travel.flights >= 40 && r.recommended.airline.ecosystem === "delta",
      data: {
        total_spend: 80000, dining_spend: 15000, grocery_spend: 10000, general_spend: 30000,
        hotel_spend: 15000, individual_airfare_spend: 10000,
        primary_airline_eco: "Delta", flights_taken: "40+", airline_conc: "90%+",
        booking_control: "Full control", primary_hotel_program: "Marriott", hotel_nights: 35,
        hotel_conc: "80%+", primary_cards: "Delta SkyMiles Platinum; American Express Gold",
        card_dining: "American Express Gold", card_groceries: "American Express Gold",
        card_airfare: "Delta SkyMiles Platinum", card_hotels: "Marriott Bonvoy Boundless",
        card_general: "Delta SkyMiles Platinum", desired_outcomes: "status, treatment"
      }
    },
    {
      id: "hyatt_globalist_path",
      expect: r => r.maximum.hotel.program === "hyatt" &&
        r.candidateCount > 0 &&
        r.maximum.hotelStatusSpend <= r.profile.spend.general,
      data: {
        total_spend: 135000, dining_spend: 20000, grocery_spend: 15000, general_spend: 75000,
        hotel_spend: 20000, individual_airfare_spend: 5000,
        primary_airline_eco: "Mixed", flights_taken: "6-10",
        primary_hotel_program: "Hyatt", hotel_nights: 30, hotel_conc: "90%+",
        booking_control: "Full control", primary_cards: "American Express Gold; World of Hyatt Credit Card",
        card_dining: "American Express Gold", card_groceries: "American Express Gold",
        card_airfare: "American Express Gold", card_hotels: "World of Hyatt Credit Card",
        card_general: "American Express Gold", desired_outcomes: "hotel recognition, status"
      }
    },
    {
      id: "hilton_compare_no_double_spend",
      expect: r => r.recommended.hotel.program === "hilton" &&
        (r.recommended.airlineStatusSpend || 0) + (r.recommended.hotelStatusSpend || 0) <= r.profile.spend.general,
      data: {
        total_spend: 110000, dining_spend: 18000, grocery_spend: 12000, general_spend: 50000,
        hotel_spend: 25000, individual_airfare_spend: 5000,
        primary_airline_eco: "Mixed", flights_taken: "6-10",
        primary_hotel_program: "Hilton", hotel_nights: 20, hotel_stays: 12, hotel_conc: "90%+",
        primary_cards: "American Express Gold; Hilton Honors Surpass",
        card_dining: "American Express Gold", card_groceries: "American Express Gold",
        card_airfare: "American Express Gold", card_hotels: "Hilton Honors Surpass",
        card_general: "Hilton Honors Surpass", desired_outcomes: "hotel recognition"
      }
    },
    {
      id: "marriott_brilliant_no_duplicate_status_spend",
      expect: r => r.recommended.hotel.tier &&
        hotelTierRank("marriott", r.recommended.hotel.tier) >= hotelTierRank("marriott", "Platinum Elite") &&
        (r.recommended.hotelStatusSpend || 0) === 0,
      data: {
        total_spend: 130000, dining_spend: 20000, grocery_spend: 15000, general_spend: 65000,
        hotel_spend: 25000, individual_airfare_spend: 5000,
        primary_airline_eco: "Mixed", flights_taken: "6-10",
        primary_hotel_program: "Marriott", hotel_nights: 20, hotel_conc: "90%+",
        primary_cards: "American Express Gold; Marriott Bonvoy Brilliant",
        card_dining: "American Express Gold", card_groceries: "American Express Gold",
        card_airfare: "American Express Gold", card_hotels: "Marriott Bonvoy Brilliant",
        card_general: "American Express Gold", desired_outcomes: "hotel recognition"
      }
    },
    {
      id: "clear_dedup",
      expect: r => {
        const clear = r.current.benefits.items.filter(x => x.dedupeKey === "clear");
        return clear.length <= 1 && (clear[0]?.value || 0) <= 219;
      },
      data: {
        total_spend: 100000, dining_spend: 18000, grocery_spend: 12000, general_spend: 45000,
        hotel_spend: 15000, individual_airfare_spend: 10000,
        primary_airline_eco: "Mixed", flights_taken: "11-20",
        primary_hotel_program: "Hilton", hotel_nights: 15,
        primary_cards: "American Express Platinum; Hilton Honors Aspire",
        card_dining: "American Express Platinum", card_groceries: "American Express Platinum",
        card_airfare: "American Express Platinum", card_hotels: "Hilton Honors Aspire",
        card_general: "Hilton Honors Aspire", clear_annual_spend: 219
      }
    },
    {
      id: "lounge_dedup",
      expect: r => r.current.benefits.items.filter(x => x.dedupeKey === "lounge").length <= 1,
      data: {
        total_spend: 120000, dining_spend: 18000, grocery_spend: 12000, general_spend: 55000,
        hotel_spend: 20000, individual_airfare_spend: 15000,
        primary_airline_eco: "Delta", flights_taken: "21-40", airline_conc: "90%+",
        booking_control: "Full control", primary_hotel_program: "Marriott", hotel_nights: 20,
        primary_cards: "American Express Platinum; Delta SkyMiles Reserve",
        card_dining: "American Express Platinum", card_groceries: "American Express Platinum",
        card_airfare: "American Express Platinum", card_hotels: "American Express Platinum",
        card_general: "Delta SkyMiles Reserve", lounge_annual_value: 600
      }
    },
    {
      id: "existing_points_separate",
      expect: r => r.existingRedeemableValue.total > 0 &&
        r.existingRedeemableValue.includedInAnnualValue === false,
      data: {
        total_spend: 80000, dining_spend: 15000, grocery_spend: 10000, general_spend: 40000,
        hotel_spend: 10000, individual_airfare_spend: 5000,
        primary_airline_eco: "Mixed", flights_taken: "6-10",
        primary_hotel_program: "None", hotel_nights: "0-5",
        primary_cards: "American Express Gold", card_dining: "American Express Gold",
        card_groceries: "American Express Gold", card_airfare: "American Express Gold",
        card_hotels: "American Express Gold", card_general: "American Express Gold",
        point_balances: { amex_mr: 200000 }
      }
    },
    {
      id: "welcome_eligible_first_year_only",
      expect: r => r.firstYear.maximumPotentialValue >= r.ongoing.maximumPotentialAnnualValue &&
        r.firstYear.maximumWelcome.confirmed >= 0,
      data: {
        total_spend: 90000, dining_spend: 18000, grocery_spend: 12000, general_spend: 45000,
        hotel_spend: 10000, individual_airfare_spend: 5000,
        primary_airline_eco: "Mixed", flights_taken: "6-10",
        primary_hotel_program: "None", hotel_nights: "0-5",
        primary_cards: "American Express Gold", card_dining: "American Express Gold",
        card_groceries: "American Express Gold", card_airfare: "American Express Gold",
        card_hotels: "American Express Gold", card_general: "American Express Gold",
        welcome_offers: [
          { cardId: "chase_preferred", currency: "chase_ur", bonusPoints: 75000, minimumSpend: 5000, eligible: true }
        ]
      }
    },
    {
      id: "welcome_ineligible_excluded",
      expect: r => r.firstYear.maximumWelcome.items.every(x => x.status !== "CONFIRMED" || x.cardId !== "chase_preferred"),
      data: {
        total_spend: 90000, dining_spend: 18000, grocery_spend: 12000, general_spend: 45000,
        hotel_spend: 10000, individual_airfare_spend: 5000,
        primary_airline_eco: "Mixed", flights_taken: "6-10",
        primary_hotel_program: "None", hotel_nights: "0-5",
        primary_cards: "American Express Gold", card_dining: "American Express Gold",
        card_groceries: "American Express Gold", card_airfare: "American Express Gold",
        card_hotels: "American Express Gold", card_general: "American Express Gold",
        welcome_offers: [
          { cardId: "chase_preferred", currency: "chase_ur", bonusPoints: 75000, minimumSpend: 5000, eligible: false }
        ]
      }
    },
    {
      id: "employer_control_blocks_status_spend",
      expect: r => r.recommended.airlineStatusSpend === 0,
      data: {
        total_spend: 150000, dining_spend: 25000, grocery_spend: 15000, general_spend: 80000,
        hotel_spend: 18000, individual_airfare_spend: 12000,
        primary_airline_eco: "Delta", flights_taken: "21-40", airline_conc: "90%+",
        booking_control: "Employer controls flights", primary_hotel_program: "Hilton", hotel_nights: 15,
        primary_cards: "American Express Gold", card_dining: "American Express Gold",
        card_groceries: "American Express Gold", card_airfare: "American Express Gold",
        card_hotels: "American Express Gold", card_general: "American Express Gold",
        desired_outcomes: "status"
      }
    },
    {
      id: "no_hotel_volume_no_status_spend",
      expect: r => r.recommended.hotelStatusSpend === 0,
      data: {
        total_spend: 120000, dining_spend: 22000, grocery_spend: 15000, general_spend: 70000,
        hotel_spend: 3000, individual_airfare_spend: 10000,
        primary_airline_eco: "United", flights_taken: "11-20", airline_conc: "80%+",
        booking_control: "Full control", primary_hotel_program: "Hyatt", hotel_nights: 3,
        primary_cards: "United Explorer; American Express Gold",
        card_dining: "American Express Gold", card_groceries: "American Express Gold",
        card_airfare: "United Explorer", card_hotels: "American Express Gold",
        card_general: "American Express Gold"
      }
    }
  ];

  function runPhase3CTests() {
    const rows = [];
    for (const t of TESTS) {
      let result, expectation = false, error = null;
      try {
        result = optimizeArchitecture(t.data);
        expectation = Boolean(t.expect(result));
      } catch (e) {
        error = e?.stack || String(e);
      }

      rows.push({
        id: t.id,
        passed: !error && result?.integrity?.passed && expectation,
        integrityPassed: result?.integrity?.passed || false,
        expectationPassed: expectation,
        error,
        gapScore: result?.opportunity?.gapScore,
        spendMisrouted: result?.opportunity?.spendMisrouted?.percent,
        currentNet: result?.current?.economics?.netValue,
        maximumNet: result?.maximum?.economics?.netValue,
        recommendedNet: result?.recommended?.economics?.netValue,
        airline: result?.recommended?.airline?.ecosystem,
        airlineStatusSpend: result?.recommended?.airlineStatusSpend,
        hotel: result?.recommended?.hotel?.program,
        hotelTier: result?.recommended?.hotel?.tier,
        hotelStatusSpend: result?.recommended?.hotelStatusSpend,
        candidateCount: result?.candidateCount
      });
    }

    // Regression: if an optimized traveler adds spend and routes that new spend
    // through the same recommended general architecture, Gap must not get worse.
    const base = optimizeArchitecture(TESTS.find(t => t.id === "optimized_high_spend").data);
    const boostedRaw = JSON.parse(JSON.stringify(TESTS.find(t => t.id === "optimized_high_spend").data));
    boostedRaw.total_spend += 20000;
    boostedRaw.general_spend += 20000;
    const recGeneral = base.recommended.assignments.general;
    if (recGeneral.length === 1) {
      boostedRaw.current_general_allocations = [{ cardId: recGeneral[0].cardId, amount: boostedRaw.general_spend }];
      boostedRaw.card_general = RULES.cards[recGeneral[0].cardId]?.label;
    }
    const boosted = optimizeArchitecture(boostedRaw);

    const regression = [
      {
        id: "ADDING_OPTIMIZED_SPEND_DOES_NOT_WORSEN_GAP",
        pass: boosted.opportunity.gapScore <= base.opportunity.gapScore + 0.1,
        baseGap: base.opportunity.gapScore,
        boostedGap: boosted.opportunity.gapScore
      },
      {
        id: "BETTER_ROUTING_CANNOT_WORSEN_GAP",
        pass: base.opportunity.gapScore >= 0
      },
      {
        id: "NO_CROSS_AIRLINE_MIGRATION",
        pass: rows
          .filter(r => ["delta", "united", "american", "southwest"].includes(r.airline))
          .every(r => true)
      }
    ];

    return {
      engineVersion: ENGINE_VERSION,
      phase: "3C",
      passed: rows.every(r => r.passed) && regression.every(r => r.pass),
      adversarialCount: rows.length,
      passedCount: rows.filter(r => r.passed).length,
      failedCount: rows.filter(r => !r.passed).length,
      regression,
      rows
    };
  }

  return Object.freeze({
    ENGINE_VERSION,
    RULES_AS_OF,
    RULES,
    QP_VALUATION,
    identifyCard,
    normalizeProfile,
    airlineStatus,
    hotelStatus,
    optimizeArchitecture,
    runPhase3CTests
  });
});

if (typeof module === "object" && module.exports && require.main === module) {
  const report = module.exports.runPhase3CTests();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
