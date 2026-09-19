export const ENTITY_SOURCES = Object.freeze({
  cards: Object.freeze({
    amex_gold: { urls: ['https://www.americanexpress.com/us/credit-cards/card/gold-card/'], required: ['annualFee','earn','benefitTags'] },
    amex_platinum: { urls: ['https://www.americanexpress.com/us/credit-cards/card/platinum/','https://www.americanexpress.com/en-us/credit-cards/credit-intel/platinum-fee/'], required: ['annualFee','earn','benefitTags'] },
    chase_preferred: { urls: ['https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred','https://www.chase.com/sapphire-cards/personal/preferred'], required: ['annualFee','earn','benefitTags','transferRules'] },
    chase_reserve: { urls: ['https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve','https://www.chase.com/sapphire-cards/personal/reserve'], required: ['annualFee','earn','benefitTags','transferRules'] },
    venture: { urls: ['https://www.capitalone.com/credit-cards/venture/'], required: ['annualFee','earn','benefitTags'] },
    venture_x: { urls: ['https://www.capitalone.com/credit-cards/venture-x/'], required: ['annualFee','earn','benefitTags','annualBonusPoints'] },
    delta_platinum: { urls: ['https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-platinum-american-express-card/'], required: ['annualFee','earn','benefitTags','status'] },
    delta_reserve: { urls: ['https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-reserve-american-express-card/'], required: ['annualFee','earn','benefitTags','status'] },
    united_explorer: { urls: ['https://creditcards.chase.com/travel-credit-cards/united/united-explorer','https://www.chase.com/personal/credit-cards/united/united-explorer-card'], required: ['annualFee','earn','benefitTags','status'] },
    united_quest: { urls: ['https://creditcards.chase.com/travel-credit-cards/united/united-quest','https://www.chase.com/personal/credit-cards/united/united-quest-card'], required: ['annualFee','earn','benefitTags','status'] },
    united_club: { urls: ['https://creditcards.chase.com/travel-credit-cards/united/club-infinite','https://www.chase.com/personal/credit-cards/united/united-visa-infinite-card'], required: ['annualFee','earn','benefitTags','status'] },
    aa_executive: { urls: ['https://www.citi.com/credit-cards/citi-aadvantage-executive-world-legend-mastercard','https://www.aa.com/web/i18n/travel-info/clubs/admirals-club-membership.html'], required: ['annualFee','earn','benefitTags','status'] },
    southwest_priority: { urls: ['https://creditcards.chase.com/travel-credit-cards/southwest/priority','https://www.southwest.com/rapid-rewards/tiers/a-list/'], required: ['annualFee','earn','benefitTags','status'] },
    hyatt_consumer: { urls: ['https://creditcards.chase.com/travel-credit-cards/world-of-hyatt','https://www.chase.com/personal/credit-cards/hyatt/world-hyatt/earn-points','https://www.chase.com/personal/credit-cards/hyatt/world-hyatt/earn-maintain'], required: ['annualFee','earn','hotelStatus'] },
    marriott_boundless: { urls: ['https://marriott.chase.com/boundless'], required: ['annualFee','earn','hotelStatus','benefitTags'] },
    marriott_brilliant: { urls: ['https://www.americanexpress.com/us/credit-cards/card/marriott-bonvoy-brilliant/'], required: ['annualFee','earn','hotelStatus','benefitTags'] },
    hilton_no_fee: { urls: ['https://www.americanexpress.com/us/credit-cards/card/hilton-honors/'], required: ['annualFee','earn','hotelStatus'] },
    hilton_surpass: { urls: ['https://www.americanexpress.com/us/credit-cards/card/hilton-honors-surpass/'], required: ['annualFee','earn','hotelStatus','benefitTags'] },
    hilton_aspire: { urls: ['https://www.americanexpress.com/us/credit-cards/card/hilton-honors-aspire/'], required: ['annualFee','earn','hotelStatus','benefitTags'] }
  }),
  airlines: Object.freeze({
    delta: { urls: ['https://www.delta.com/us/en/skymiles/medallion-program/how-to-qualify','https://news.delta.com/booking-benefits-and-beyond-map-out-your-next-journey-skymiles-and-app'], required: ['thresholds'] },
    united: { urls: ['https://www.united.com/en/us/fly/mileageplus/premier/qualify.html'], required: ['thresholds','minimumUnitedSegments'] },
    american: { urls: ['https://www.aa.com/web/i18n/aadvantage-program/loyalty-points/index.html','https://news.aa.com/news/news-details/2026/American-Airlines-maintains-AAdvantage-status-and-reward-levels-for-third-year-in-a-row-AADV-01/default.aspx'], required: ['thresholds'] },
    southwest: { urls: ['https://www.southwest.com/rapid-rewards/tiers/a-list/','https://www.southwest.com/rapid-rewards/tiers/a-list-preferred/'], required: ['thresholds','flightThresholds'] }
  }),
  hotels: Object.freeze({
    hyatt: { urls: ['https://world.hyatt.com/content/gp/en/tiers-and-benefits.html'], required: ['thresholds'] },
    marriott: { urls: ['https://www.marriott.com/loyalty/member-benefits.mi','https://www.marriott.com/brands/mgm-collection/member-benefits.mi'], required: ['thresholds'] },
    hilton: { urls: ['https://www.hilton.com/en/hilton-honors/support-faq/','https://stories.hilton.com/hilton-honors-fact-sheet'], required: ['thresholds','diamondReserve'] }
  })
});

export const ALLOWED_CARD_IDS = Object.freeze(Object.keys(ENTITY_SOURCES.cards));
export const ALLOWED_AIRLINE_IDS = Object.freeze(Object.keys(ENTITY_SOURCES.airlines));
export const ALLOWED_HOTEL_IDS = Object.freeze(Object.keys(ENTITY_SOURCES.hotels));
