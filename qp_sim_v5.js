/**
 * Quiet Premium V5 isolated travel-strategy engine — 5.0-alpha.7 (2026-09-17)
 * NOT wired to diagnostic.html or any customer-facing page.
 *
 * LOCKED
 * Facts determine opportunity. Behavioral constraints determine feasibility.
 * Aspirations determine presentation order/emphasis ONLY.
 * Every material supported benefit/opportunity remains visible regardless of aspiration.
 * Benefit visibility is separate from recommendation credit.
 * Travel life -> airline -> hotel -> rewards currency -> cards -> spend routing.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.QuietPremiumEngineV5=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";

const ENGINE_VERSION="5.0-alpha.7";
const RULES_AS_OF="2026-09-17";
const CATS=["dining","grocery","online_grocery","airfare","hotel","general"];
const AIRLINES=["delta","united","american","southwest"];
const HOTELS=["hyatt","marriott","hilton"];
const n=v=>{if(typeof v==="number")return Number.isFinite(v)?v:0;const x=Number(String(v??"").replace(/[$,%\s,]/g,""));return Number.isFinite(x)?x:0;};
const maybeNum=v=>(v===null||v===undefined||v==="")?null:n(v);
const s=v=>String(v??"").trim(),lc=v=>s(v).toLowerCase();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const sum=a=>(a||[]).reduce((x,y)=>x+(Number(y)||0),0);
const clone=x=>JSON.parse(JSON.stringify(x));
const round=(x,d=0)=>{const p=10**d;return Math.round((Number(x)||0)*p)/p;};
const isoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(s(v))?s(v):"";
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);

const BENEFIT_CANONICAL=Object.freeze({
  lounge:"lounge_access",priority_pass:"lounge_access",
  global_entry_tsa:"trusted_traveler",trusted_traveler_credit:"trusted_traveler"
});
const canonicalBenefit=x=>BENEFIT_CANONICAL[x]||x;

const RULES=Object.freeze({
 meta:{
  version:ENGINE_VERSION,asOf:RULES_AS_OF,
  supportedAirlines:AIRLINES,supportedHotels:HOTELS,
  supportedFlexible:["amex_mr","chase_ur","capital_one_miles"],
  spendInputContract:"grocery is total supermarket spend; online_grocery is the subset eligible for online-grocery rules"
 },
 airlines:{
  delta:{metric:"MQD",qualificationCycle:"calendar",thresholds:[
   {tier:"Silver Medallion",amount:5000},{tier:"Gold Medallion",amount:10000},
   {tier:"Platinum Medallion",amount:15000},{tier:"Diamond Medallion",amount:28000}]},
  united:{metric:"PQP",qualificationCycle:"calendar",minimumUnitedSegments:4,thresholds:[
   {tier:"Premier Silver",amount:6000,pqpOnly:6000,pqpWithPQF:5000,pqf:15},
   {tier:"Premier Gold",amount:12000,pqpOnly:12000,pqpWithPQF:10000,pqf:30},
   {tier:"Premier Platinum",amount:18000,pqpOnly:18000,pqpWithPQF:15000,pqf:45},
   {tier:"Premier 1K",amount:28000,pqpOnly:28000,pqpWithPQF:22000,pqf:60}]},
  american:{metric:"Loyalty Points",qualificationCycle:"mar_feb",thresholds:[
   {tier:"AAdvantage Gold",amount:40000},{tier:"AAdvantage Platinum",amount:75000},
   {tier:"AAdvantage Platinum Pro",amount:125000},{tier:"AAdvantage Executive Platinum",amount:200000}]},
  southwest:{metric:"TQP",qualificationCycle:"calendar",thresholds:[
   {tier:"A-List",amount:35000},{tier:"A-List Preferred",amount:70000}],
   flightThresholds:[{tier:"A-List",flights:20},{tier:"A-List Preferred",flights:40}]}
 },
 hotels:{
  hyatt:{thresholds:[{tier:"Discoverist",nights:10},{tier:"Explorist",nights:30},{tier:"Globalist",nights:60}]},
  marriott:{thresholds:[{tier:"Silver Elite",nights:10},{tier:"Gold Elite",nights:25},{tier:"Platinum Elite",nights:50},{tier:"Titanium Elite",nights:75}]},
  hilton:{thresholds:[
   {tier:"Silver",nights:10,stays:4,spend:2500},
   {tier:"Gold",nights:25,stays:15,spend:6000},
   {tier:"Diamond",nights:50,stays:25,spend:11500}],
   diamondReserve:{tier:"Diamond Reserve",nights:80,stays:40,spend:18000}}
 },
 cards:{
  amex_gold:{label:"American Express Gold Card",kind:"flex",currency:"amex_mr",annualFee:325,
   earn:{dining:4,grocery:4,online_grocery:4,airfare:1,hotel:1,general:1},
   bookingEarn:{airfare:{direct_airline:3,amex_travel:3},hotel:{amex_prepaid:5}},
   caps:{dining:50000},capGroups:{grocery:"amex_gold_supermarket",online_grocery:"amex_gold_supermarket"},groupCaps:{amex_gold_supermarket:25000},
   benefitTags:["dining_credit","uber_cash","resy_credit","dunkin_credit"],verified:true},
  amex_platinum:{label:"The Platinum Card from American Express",kind:"flex",currency:"amex_mr",annualFee:895,
   earn:{dining:1,grocery:1,online_grocery:1,airfare:1,hotel:1,general:1},
   bookingEarn:{airfare:{direct_airline:5,amex_travel:5},hotel:{amex_prepaid:5}},caps:{airfare:500000},
   hotelStatusByProgram:{marriott:"Gold Elite",hilton:"Gold"},
   benefitTags:["lounge","premium_hotel_booking","hotel_credit","hotel_status","airline_fee_credit","clear","global_entry_tsa","resy_credit","digital_entertainment_credit"],verified:true},
  chase_preferred:{label:"Chase Sapphire Preferred",kind:"flex",currency:"chase_ur",annualFee:95,
   earn:{dining:3,grocery:1,online_grocery:3,airfare:2,hotel:2,general:1},bookingEarn:{airfare:{chase_travel:5},hotel:{chase_travel:5}},
   benefitTags:["chase_travel_hotel_credit","trusted_traveler_credit","travel_protections"],
   transferRules:{hyatt:{defaultRatio:.75,grandfatherBefore:"2026-06-15",grandfatherRatio:1,grandfatherThrough:"2026-09-30"}},verified:true},
  chase_reserve:{label:"Chase Sapphire Reserve",kind:"flex",currency:"chase_ur",annualFee:795,
   earn:{dining:3,grocery:1,online_grocery:1,airfare:4,hotel:4,general:1},bookingEarn:{airfare:{chase_travel:8},hotel:{chase_travel:8}},
   transferRules:{hyatt:{defaultRatio:1}},benefitTags:["lounge","travel_credit","travel_protections"],verified:true},
  venture:{label:"Capital One Venture Rewards",kind:"flex",currency:"capital_one_miles",annualFee:95,
   earn:{dining:2,grocery:2,online_grocery:2,airfare:2,hotel:2,general:2},bookingEarn:{hotel:{capital_one_travel:5}},benefitTags:["lifestyle_collection"],verified:true},
  venture_x:{label:"Capital One Venture X Rewards",kind:"flex",currency:"capital_one_miles",annualFee:395,
   earn:{dining:2,grocery:2,online_grocery:2,airfare:2,hotel:2,general:2},bookingEarn:{airfare:{capital_one_travel:5},hotel:{capital_one_travel:10}},
   benefitTags:["lounge","capital_one_travel_credit","anniversary_miles","premium_hotel_collection","global_entry_tsa"],verified:true},
  delta_platinum:{label:"Delta SkyMiles Platinum American Express Card",kind:"airline",airline:"delta",currency:"skymiles",annualFee:350,
   earn:{dining:2,grocery:2,online_grocery:2,airfare:3,hotel:3,general:1},status:{headstart:2500,spendDivisor:20},benefitTags:["companion_certificate_renewal"],verified:true},
  delta_reserve:{label:"Delta SkyMiles Reserve American Express Card",kind:"airline",airline:"delta",currency:"skymiles",annualFee:650,
   earn:{dining:1,grocery:1,online_grocery:1,airfare:3,hotel:1,general:1},status:{headstart:2500,spendDivisor:10},benefitTags:["lounge","upgrade_priority","companion_certificate_renewal"],verified:true},
  united_explorer:{label:"United Explorer Card",kind:"airline",airline:"united",currency:"united_miles",annualFee:150,
   earn:{dining:2,grocery:1,online_grocery:1,airfare:3,hotel:2,general:1},status:{spendDivisor:20,annualCap:1000},
   benefitTags:["priority_boarding","checked_bag","united_travel_credit_threshold","award_discount_threshold"],verified:true},
  united_quest:{label:"United Quest Card",kind:"airline",airline:"united",currency:"united_miles",annualFee:350,
   earn:{dining:2,grocery:1,online_grocery:1,airfare:4,hotel:2,general:1},status:{spendDivisor:20,annualCap:18000,annualBonus:1000,bonusRequiresPriorYearOpen:true},benefitTags:["united_travel_benefits"],verified:true},
  united_club:{label:"United Club Card",kind:"airline",airline:"united",currency:"united_miles",annualFee:695,
   earn:{dining:2,grocery:1,online_grocery:1,airfare:5,hotel:2,general:1},status:{spendDivisor:15,annualCap:28000,annualBonus:1500,bonusRequiresPriorYearOpen:true},benefitTags:["lounge","united_travel_benefits"],verified:true},
  aa_executive:{label:"Citi / AAdvantage Executive World Legend Mastercard",kind:"airline",airline:"american",currency:"aadvantage",annualFee:695,
   earn:{dining:1,grocery:1,online_grocery:1,airfare:4,hotel:1,general:1},status:{lpPerEligiblePurchaseDollar:1},benefitTags:["lounge","priority_airport"],verified:true},
  southwest_priority:{label:"Southwest Rapid Rewards Priority Credit Card",kind:"airline",airline:"southwest",currency:"southwest_points",annualFee:229,
   earn:{dining:2,grocery:1,online_grocery:1,airfare:4,hotel:1,general:1},status:{spendBlock:5000,tqpPerBlock:2500},benefitTags:["checked_bag","boarding_benefits","seat_benefits"],verified:true},
  hyatt_consumer:{label:"World of Hyatt Credit Card",kind:"hotel",hotel:"hyatt",currency:"hyatt_points",annualFee:95,
   earn:{dining:2,grocery:1,online_grocery:1,airfare:2,hotel:4,general:1},hotelStatus:{automaticTier:"Discoverist",annualNights:5,spendBlock:5000,nightsPerBlock:2},verified:true},
  marriott_boundless:{label:"Marriott Bonvoy Boundless Credit Card",kind:"hotel",hotel:"marriott",currency:"marriott_points",annualFee:95,
   earn:{dining:2,grocery:2,online_grocery:2,airfare:2,hotel:6,general:2},hotelStatus:{automaticTier:"Silver Elite",annualNights:15,spendBlock:5000,nightsPerBlock:1,goldAtSpend:35000},benefitTags:["free_night_award_35k"],verified:true},
  marriott_brilliant:{label:"Marriott Bonvoy Brilliant American Express Card",kind:"hotel",hotel:"marriott",currency:"marriott_points",annualFee:650,
   earn:{dining:3,grocery:2,online_grocery:2,airfare:3,hotel:6,general:2},hotelStatus:{automaticTier:"Platinum Elite",annualNights:25},
   benefitTags:["premium_hotel_benefits","dining_credit","free_night_award_85k","priority_pass"],verified:true},
  hilton_no_fee:{label:"Hilton Honors American Express Card",kind:"hotel",hotel:"hilton",currency:"hilton_points",annualFee:0,
   earn:{dining:5,grocery:5,online_grocery:5,airfare:3,hotel:7,general:3},hotelStatus:{automaticTier:"Silver"},verified:true},
  hilton_surpass:{label:"Hilton Honors American Express Surpass Card",kind:"hotel",hotel:"hilton",currency:"hilton_points",annualFee:150,
   earn:{dining:6,grocery:6,online_grocery:6,airfare:3,hotel:12,general:3},hotelStatus:{automaticTier:"Gold"},verified:true},
  hilton_aspire:{label:"Hilton Honors American Express Aspire Card",kind:"hotel",hotel:"hilton",currency:"hilton_points",annualFee:550,
   earn:{dining:7,grocery:3,online_grocery:3,airfare:7,hotel:14,general:3},hotelStatus:{automaticTier:"Diamond"},benefitTags:["premium_hotel_benefits"],verified:true}
 }});

const VALUATIONS=Object.freeze({
 conservative:{amex_mr:.0125,chase_ur:.0125,capital_one_miles:.010,skymiles:.012,united_miles:.012,aadvantage:.013,southwest_points:.013,hyatt_points:.017,marriott_points:.007,hilton_points:.005},
 base:{amex_mr:.020,chase_ur:.020,capital_one_miles:.017,skymiles:.015,united_miles:.017,aadvantage:.018,southwest_points:.014,hyatt_points:.022,marriott_points:.009,hilton_points:.008},
 upper:{amex_mr:.024,chase_ur:.024,capital_one_miles:.020,skymiles:.018,united_miles:.021,aadvantage:.022,southwest_points:.016,hyatt_points:.026,marriott_points:.011,hilton_points:.010}
});
const MODEL=Object.freeze({
 maxPortfolioCards:6,maxNewCardsDefault:2,materialTravelValue:400,materialCashImprovement:300,
 minFlightsForStatus:8,minHotelNightsForStatus:8,minAirlineShare:.55,minHotelShare:.45,
 unsupportedMaterialSpendShare:.10,statusOpportunityCostLimit:900,brilliantMinDirectMarriottNights:10
});

const ALIASES=[
 ["hilton_aspire",["hilton honors american express aspire","hilton aspire"]],["hilton_surpass",["hilton honors american express surpass","hilton surpass"]],["hilton_no_fee",["hilton honors american express card","hilton honors american express"]],
 ["marriott_brilliant",["marriott bonvoy brilliant"]],["marriott_boundless",["marriott bonvoy boundless"]],["delta_reserve",["delta skymiles reserve","delta reserve"]],["delta_platinum",["delta skymiles platinum","delta platinum"]],
 ["united_club",["united club"]],["united_quest",["united quest"]],["united_explorer",["united explorer"]],["aa_executive",["aadvantage executive","american airlines executive","citi / aadvantage executive"]],
 ["southwest_priority",["southwest rapid rewards priority","southwest priority"]],["hyatt_consumer",["world of hyatt credit card","world of hyatt card"]],["amex_platinum",["platinum card from american express","american express platinum","amex platinum"]],
 ["amex_gold",["american express gold","amex gold"]],["chase_reserve",["chase sapphire reserve","sapphire reserve"]],["chase_preferred",["chase sapphire preferred","sapphire preferred"]],["venture_x",["capital one venture x","venture x"]],["venture",["capital one venture rewards","capital one venture"]]
];
function matchCard(v){const x=lc(v);if(!x)return null;if(RULES.cards[x])return x;for(const[id,a]of ALIASES)if(a.some(z=>x.includes(z)))return id;return null;}

function normalizeSpendShape(x={}){
 const online=n(x.online_grocery??x.onlineGrocery??x.online_grocery_spend),groceryTotal=n(x.grocery??x.grocery_spend);
 return{dining:n(x.dining??x.dining_spend),grocery:Math.max(0,groceryTotal-online),online_grocery:Math.min(groceryTotal,online),airfare:n(x.airfare??x.household_airfare_spend??x.airfare_spend),hotel:n(x.hotel??x.hotel_spend),general:n(x.general??x.general_spend)};
}
function scaleRowsToTarget(rows,target){
 const total=sum(rows.map(r=>r.amount));if(!target||!total)return target?rows:[];if(Math.abs(total-target)<.01)return rows;
 return rows.map(r=>({card:r.card,amount:round(target*r.amount/total)})).filter(r=>r.amount>0);
}
function normalizeRouting(raw,sp){
 const src=raw.currentRouting||raw.current_routing||{},out={};
 for(const cat of CATS){
  let rows=(Array.isArray(src[cat])?src[cat]:[]).map(r=>({card:matchCard(r.card||r.cardId||r.name)||s(r.card||r.cardId||r.name),amount:n(r.amount)})).filter(r=>r.card&&r.amount>0);
  if(rows.length)rows=scaleRowsToTarget(rows,sp[cat]);
  if(!rows.length){const fallback=matchCard(raw[`card_${cat}`]||(cat==="general"?raw.card_general:""));if(fallback&&sp[cat])rows=[{card:fallback,amount:sp[cat]}];}
  out[cat]=rows;
 }
 return out;
}
function normalizeProgress(raw={}){
 const p=raw.statusProgress||raw.status_progress||{},u=p.united||{};
 return{
  delta:{mqd:n(p.delta?.mqd??raw.delta_mqd)},
  united:{pqp:n(u.pqp??raw.united_pqp),pqf:n(u.pqf??raw.united_pqf),unitedSegments:maybeNum(u.unitedSegments??u.united_segments??raw.united_operated_segments)},
  american:{loyaltyPoints:n(p.american?.loyaltyPoints??raw.american_loyalty_points)},
  southwest:{tqp:n(p.southwest?.tqp??raw.southwest_tqp),qualifyingFlights:n(p.southwest?.qualifyingFlights??raw.southwest_qualifying_flights)},
  hotel:{qualifyingNights:n(p.hotel?.qualifyingNights??raw.hotel_qualifying_nights??raw.hotel_nights),qualifyingStays:n(p.hotel?.qualifyingStays??raw.hotel_qualifying_stays??raw.hotel_stays),qualifyingSpend:n(p.hotel?.qualifyingSpend??raw.hotel_qualifying_spend??raw.hotel_spend)}
 };
}
function normalizeCalendarRemaining(raw={}){
 const f=raw.remainingYear||raw.remaining_year||raw.futureActivity||raw.future_activity,known=raw.remainingYearKnown===true||!!f,x=f||{};
 const spend=normalizeSpendShape(x.cardSpend||x.statusSpend||{}),u=x.united||{};
 return{known,cardSpend:spend,delta:{mqd:n(x.delta?.mqd)},united:{pqp:n(u.pqp),pqf:n(u.pqf),unitedSegments:maybeNum(u.unitedSegments??u.united_segments)},southwest:{tqp:n(x.southwest?.tqp),qualifyingFlights:n(x.southwest?.qualifyingFlights)},hotel:{qualifyingNights:n(x.hotel?.qualifyingNights),qualifyingStays:n(x.hotel?.qualifyingStays),qualifyingSpend:n(x.hotel?.qualifyingSpend)}};
}
function normalizeAmericanQualification(raw={}){
 const x=raw.americanQualification||raw.american_qualification||raw.remainingAmericanQualification||raw.remaining_american_qualification;
 if(!x)return{known:false,cardSpend:normalizeSpendShape({}),loyaltyPoints:0};
 return{known:true,cardSpend:normalizeSpendShape(x.cardSpend||x.statusSpend||{}),loyaltyPoints:n(x.loyaltyPoints??x.loyalty_points)};
}
function normalizeProfile(raw={}){
 const sp=normalizeSpendShape(raw.spend||raw),cr=raw.currentCards||raw.primary_cards||raw.cards||[];
 const cards=uniq((Array.isArray(cr)?cr:[cr]).map(v=>matchCard(v)||s(v)).filter(Boolean));
 const air=lc(raw.primaryAirline||raw.primary_airline_eco||raw.primary_airline),hot=lc(raw.primaryHotel||raw.primary_hotel||raw.hotel_program);
 const as=n(raw.primaryAirlineShare??raw.primary_airline_share??raw.airline_concentration),hs=n(raw.primaryHotelShare??raw.primary_hotel_share??raw.hotel_concentration);
 const ar=raw.aspirations||raw.desiredOutcomes||raw.desired_outcomes||[],c=raw.constraints||{},rf=raw.routeFit||raw.route_fit||{};
 return{
  asOfDate:isoDate(raw.asOfDate)||RULES_AS_OF,spend:sp,totalSpend:sum(Object.values(sp)),
  currentCards:cards,currentRouting:normalizeRouting(raw,sp),statusProgress:normalizeProgress(raw),
  remainingYear:normalizeCalendarRemaining(raw),americanQualification:normalizeAmericanQualification(raw),
  cardOpenDate:raw.cardOpenDate||raw.card_open_date||{},cardTenure:raw.cardTenure||raw.card_tenure||{},
  cardStatusProgressYTD:raw.cardStatusProgressYTD||raw.card_status_progress_ytd||{},cardSpendYTD:raw.cardSpendYTD||raw.card_spend_ytd||{},
  legacyNaturalBenefitValue:raw.legacyNaturalBenefitValue||raw.naturalBenefitValue||raw.natural_benefit_value||{},
  cardUniqueBenefitValue:raw.cardUniqueBenefitValue||raw.card_unique_benefit_value||{},
  benefitValueByType:raw.benefitValueByType||raw.benefit_value_by_type||{},
  explicitBenefitUse:raw.explicitBenefitUse||raw.explicit_benefit_use||{},benefitEvidence:raw.benefitEvidence||raw.benefit_evidence||{},
  bookingMethod:{airfare:lc(raw.bookingMethod?.airfare??raw.airfare_booking_method??"direct_airline"),hotel:lc(raw.bookingMethod?.hotel??raw.hotel_booking_method??"direct_hotel")},
  redemptionPartner:lc(raw.redemptionPartner||raw.redemption_partner),marriottBeyondFHR:raw.marriottBeyondFHR===true,directMarriottNights:n(raw.directMarriottNights??raw.direct_marriott_nights),hotelCardStackingAllowed:raw.hotelCardStackingAllowed===true,
  currencyUtility:{amex_mr:clamp(n(raw.currencyUtility?.amex_mr??1),0,1),chase_ur:clamp(n(raw.currencyUtility?.chase_ur??1),0,1),capital_one_miles:clamp(n(raw.currencyUtility?.capital_one_miles??1),0,1),skymiles:clamp(n(raw.currencyUtility?.skymiles??(air==="delta"?1:.45)),0,1),united_miles:clamp(n(raw.currencyUtility?.united_miles??(air==="united"?1:.45)),0,1),aadvantage:clamp(n(raw.currencyUtility?.aadvantage??(air==="american"?1:.45)),0,1),southwest_points:clamp(n(raw.currencyUtility?.southwest_points??(air==="southwest"?1:.45)),0,1),hyatt_points:clamp(n(raw.currencyUtility?.hyatt_points??(hot==="hyatt"?1:.45)),0,1),marriott_points:clamp(n(raw.currencyUtility?.marriott_points??(hot==="marriott"?1:.45)),0,1),hilton_points:clamp(n(raw.currencyUtility?.hilton_points??(hot==="hilton"?1:.45)),0,1)},
  travel:{annualOneWayFlights:n(raw.annualOneWayFlights??raw.one_way_flights??raw.flights_taken),bookingControl:lc(raw.bookingControl||raw.booking_control||"full"),typicalTripCashCost:n(raw.typicalTripCashCost??raw.typical_trip_cash_cost)},
  airline:{primary:air,share:clamp((as>1?as/100:as)||(air?.70:0),0,1),reportedStatus:s(raw.currentAirlineStatus||raw.primary_airline_status||raw.airline_status),routeFit:Object.fromEntries(Object.entries(rf).map(([k,v])=>[lc(k),clamp(n(v),0,1)])),statusUsefulOverride:typeof raw.airlineStatusUseful==="boolean"?raw.airlineStatusUseful:null},
  hotel:{primary:hot,share:clamp((hs>1?hs/100:hs)||(hot?.60:0),0,1),reportedStatus:s(raw.currentHotelStatus||raw.primary_hotel_status||raw.hotel_status),premiumStayShare:clamp(n(raw.premiumStayShare??raw.premium_stay_share)>1?n(raw.premiumStayShare??raw.premium_stay_share)/100:n(raw.premiumStayShare??raw.premium_stay_share),0,1)},
  aspirations:uniq((Array.isArray(ar)?ar:[ar]).map(lc)),
  constraints:{noNewCards:!!c.noNewCards,maxNewCards:c.maxNewCards==null?MODEL.maxNewCardsDefault:Math.max(0,n(c.maxNewCards)),noHotelConcentration:!!c.noHotelConcentration,prohibitedCards:uniq((c.prohibitedCards||[]).map(v=>matchCard(v)||s(v))),requiredCards:uniq((c.requiredCards||[]).map(v=>matchCard(v)||s(v)))},
  __normalizedV5:true
 };
}

function tierIndex(program,tier){const rows=RULES.airlines[program]?.thresholds||RULES.hotels[program]?.thresholds||[];return rows.findIndex(r=>lc(r.tier)===lc(tier));}
function maxTier(program,a,b){return tierIndex(program,a)>=tierIndex(program,b)?(a||""):(b||"");}
function airlineStatusUsefulness(p){if(p.airline.statusUsefulOverride!=null)return!!p.airline.statusUsefulOverride;return!!p.airline.primary&&p.airline.share>=MODEL.minAirlineShare&&p.travel.annualOneWayFlights>=MODEL.minFlightsForStatus&&p.travel.bookingControl!=="none";}
function hotelStatusUsefulness(p){return!!p.hotel.primary&&!p.constraints.noHotelConcentration&&p.hotel.share>=MODEL.minHotelShare&&p.statusProgress.hotel.qualifyingNights>=MODEL.minHotelNightsForStatus;}
function unitedSegmentsKnown(p){return p.statusProgress.united.unitedSegments!=null&&p.remainingYear.united.unitedSegments!=null;}
function unitedCardPqpProgressKnown(p,id){return !p.currentCards.includes(id)||hasOwn(p.cardStatusProgressYTD,id)&&maybeNum(p.cardStatusProgressYTD[id]?.pqp)!=null;}
function airlineQualificationDataReady(p,airline,portfolio=[]){
 if(!airlineStatusUsefulness(p))return false;
 if(airline==="american")return p.americanQualification.known;
 if(!p.remainingYear.known)return false;
 if(airline==="united"){
  if(!unitedSegmentsKnown(p))return false;
  for(const id of portfolio)if(RULES.cards[id]?.airline==="united"&&RULES.cards[id]?.status&&!unitedCardPqpProgressKnown(p,id))return false;
 }
 return true;
}

function transferRatio(cardId,partner,p,isNew=false){const rule=RULES.cards[cardId]?.transferRules?.[partner];if(!rule)return 1;if(isNew)return rule.defaultRatio??1;const opened=isoDate(p.cardOpenDate[cardId]);if(opened&&rule.grandfatherBefore&&opened<rule.grandfatherBefore&&rule.grandfatherThrough&&p.asOfDate<=rule.grandfatherThrough)return rule.grandfatherRatio??1;return rule.defaultRatio??1;}
function portfolioTransferRatio(p,portfolio,currency){if(currency!=="chase_ur"||p.redemptionPartner!=="hyatt")return 1;const ratios=portfolio.filter(id=>RULES.cards[id]?.currency==="chase_ur").map(id=>transferRatio(id,"hyatt",p,!p.currentCards.includes(id)));return ratios.length?Math.max(...ratios):1;}
function currencyPointValue(p,currency,scenario,portfolio){
 if(currency==="chase_ur"&&p.redemptionPartner==="hyatt")return(VALUATIONS[scenario].hyatt_points||0)*(p.currencyUtility.hyatt_points??.5)*portfolioTransferRatio(p,portfolio,currency);
 return(VALUATIONS[scenario][currency]||0)*(p.currencyUtility[currency]??.5);
}
function bookingRate(card,p,cat){const method=cat==="airfare"?p.bookingMethod.airfare:cat==="hotel"?p.bookingMethod.hotel:"";return card?.bookingEarn?.[cat]?.[method]??null;}
function baseRate(card,p,cat){const b=bookingRate(card,p,cat);return b!=null?b:(card?.earn?.[cat]||0);}
function capKey(card,cat){return card?.capGroups?.[cat]||null;}
function capRemaining(card,cat,catAssigned,groupAssigned){const a=card?.caps?.[cat],gk=capKey(card,cat),g=gk?card?.groupCaps?.[gk]:null;return Math.min(a==null?Infinity:Math.max(0,a-catAssigned),g==null?Infinity:Math.max(0,g-groupAssigned));}
function marginalRate(card,p,cat,catAssigned,groupAssigned){return capRemaining(card,cat,catAssigned,groupAssigned)<=0?1:baseRate(card,p,cat);}
function pointDollarValue(p,id,scenario,portfolio){const c=RULES.cards[id];return c?currencyPointValue(p,c.currency,scenario,portfolio):0;}
function routeAnnual(p,portfolio,scenario){
 const out=Object.fromEntries(CATS.map(c=>[c,[]])),catAssigned={},groupAssigned={};for(const id of portfolio){catAssigned[id]={};groupAssigned[id]={};}
 for(const cat of CATS){let remaining=p.spend[cat]||0;while(remaining>0){let best=null,bestV=-Infinity;for(const id of portfolio){const card=RULES.cards[id];if(!card)continue;const ca=catAssigned[id][cat]||0,gk=capKey(card,cat),ga=gk?(groupAssigned[id][gk]||0):0,v=marginalRate(card,p,cat,ca,ga)*pointDollarValue(p,id,scenario,portfolio);if(v>bestV+1e-12){bestV=v;best=id;}}if(!best)break;const card=RULES.cards[best],ca=catAssigned[best][cat]||0,gk=capKey(card,cat),ga=gk?(groupAssigned[best][gk]||0):0,rem=capRemaining(card,cat,ca,ga);let chunk=Math.min(remaining,rem>0?rem:remaining);if(!Number.isFinite(chunk)||chunk<=0)chunk=remaining;const row=out[cat].find(r=>r.card===best);if(row)row.amount=round(row.amount+chunk);else out[cat].push({card:best,amount:round(chunk)});catAssigned[best][cat]=ca+chunk;if(gk)groupAssigned[best][gk]=ga+chunk;remaining-=chunk;}}
 return out;
}
function pointsFromRouting(p,routing,portfolio,scenario){
 const byCurrency={},byCard={},catAssigned={},groupAssigned={};for(const id of portfolio){catAssigned[id]={};groupAssigned[id]={};}
 for(const cat of CATS)for(const row of routing[cat]||[]){const card=RULES.cards[row.card];if(!card)continue;catAssigned[row.card]??={};groupAssigned[row.card]??={};let remaining=row.amount,pts=0;while(remaining>0){const ca=catAssigned[row.card][cat]||0,gk=capKey(card,cat),ga=gk?(groupAssigned[row.card][gk]||0):0,rate=marginalRate(card,p,cat,ca,ga),rem=capRemaining(card,cat,ca,ga);let chunk=Math.min(remaining,rem>0?rem:remaining);if(!Number.isFinite(chunk)||chunk<=0)chunk=remaining;pts+=chunk*rate;catAssigned[row.card][cat]=ca+chunk;if(gk)groupAssigned[row.card][gk]=ga+chunk;remaining-=chunk;}byCurrency[card.currency]=(byCurrency[card.currency]||0)+pts;byCard[row.card]=(byCard[row.card]||0)+pts;}
 let gross=0;for(const[id,pts]of Object.entries(byCard)){const c=RULES.cards[id];gross+=pts*currencyPointValue(p,c.currency,scenario,portfolio);}
 return{pointsByCurrency:Object.fromEntries(Object.entries(byCurrency).map(([k,v])=>[k,round(v)])),pointsByCard:Object.fromEntries(Object.entries(byCard).map(([k,v])=>[k,round(v)])),grossTravelValue:round(gross)};
}

function visibleBenefits(portfolio){const out=[];for(const id of portfolio){const c=RULES.cards[id];if(!c)continue;for(const b of c.benefitTags||[])out.push({cardId:id,benefit:b});if(c.hotelStatus?.automaticTier)out.push({cardId:id,benefit:"automatic_hotel_status",program:c.hotel,detail:c.hotelStatus.automaticTier});for(const[program,tier]of Object.entries(c.hotelStatusByProgram||{}))out.push({cardId:id,benefit:"automatic_hotel_status",program,detail:tier});if(c.airline&&c.status)out.push({cardId:id,benefit:"status_earning_mechanism",detail:c.airline});}return out;}
function canonicalVisibleSet(portfolio){const set=new Set();for(const b of visibleBenefits(portfolio))set.add(canonicalBenefit(b.benefit));return set;}
function detailedBenefitModel(p){return Object.keys(p.benefitValueByType||{}).length>0||Object.keys(p.cardUniqueBenefitValue||{}).length>0;}
function benefitLedger(p,portfolio){
 const visible=visibleBenefits(portfolio),present=canonicalVisibleSet(portfolio);
 if(detailedBenefitModel(p)){
  const typed={};for(const[type,val]of Object.entries(p.benefitValueByType||{})){const key=canonicalBenefit(type),v=n(val);typed[key]=Math.max(typed[key]||0,v);}
  let typeValue=0;const countedTypes=[];for(const[key,val]of Object.entries(typed))if(val>0&&present.has(key)){typeValue+=val;countedTypes.push(key);}
  const uniqueValue=sum(portfolio.map(id=>n(p.cardUniqueBenefitValue[id])));
  return{mode:"detailed_deduped",totalValue:round(typeValue+uniqueValue),typeValue:round(typeValue),cardUniqueValue:round(uniqueValue),countedTypes,visible,overlapUnresolved:false};
 }
 const total=sum(portfolio.map(id=>n(p.legacyNaturalBenefitValue[id]))),positive=portfolio.filter(id=>n(p.legacyNaturalBenefitValue[id])>0),owners={};
 for(const id of positive)for(const tag of RULES.cards[id]?.benefitTags||[]){const key=canonicalBenefit(tag);(owners[key]??=[]).push(id);}
 return{mode:"legacy_card_total",totalValue:round(total),typeValue:0,cardUniqueValue:round(total),countedTypes:[],visible,overlapUnresolved:Object.values(owners).some(ids=>uniq(ids).length>1)};
}
function economics(p,routing,portfolio,scenario){const q=pointsFromRouting(p,routing,portfolio,scenario),fees=sum(portfolio.map(id=>RULES.cards[id]?.annualFee||0)),benefits=benefitLedger(p,portfolio);return{...q,annualFees:fees,benefitLedger:benefits,naturalBenefitValue:benefits.totalValue,netEconomicValue:round(q.grossTravelValue+benefits.totalValue-fees),unverifiedCards:portfolio.filter(id=>RULES.cards[id]&&!RULES.cards[id].verified)};}
function hasBenefitEvidence(p,id,benefit){const key=canonicalBenefit(benefit),card=p.explicitBenefitUse?.[id]||{},ev=p.benefitEvidence?.[id]||{};if(card[benefit]===true||card[key]===true||ev[benefit]===true||ev[key]===true)return true;return p.explicitBenefitUse?.[benefit]===true||p.explicitBenefitUse?.[key]===true||p.benefitEvidence?.[benefit]===true||p.benefitEvidence?.[key]===true;}
function recommendationCredit(p,portfolio){const credit={lounge:0,premiumHotel:0,priorityAirport:0,upgradePriority:0};for(const id of portfolio){const tags=RULES.cards[id]?.benefitTags||[];if(tags.some(x=>canonicalBenefit(x)==="lounge_access")&&hasBenefitEvidence(p,id,"lounge_access"))credit.lounge=1;if(tags.some(x=>["premium_hotel_booking","premium_hotel_benefits","premium_hotel_collection"].includes(x))&&hasBenefitEvidence(p,id,"premium_hotel"))credit.premiumHotel=1;if(tags.includes("priority_airport")&&hasBenefitEvidence(p,id,"priority_airport"))credit.priorityAirport=1;if(tags.includes("upgrade_priority")&&hasBenefitEvidence(p,id,"upgrade_priority"))credit.upgradePriority=1;}return credit;}

function emptyRouting(){return Object.fromEntries(CATS.map(c=>[c,[]]));}
function cardTotals(r){const o={};for(const c of CATS)for(const x of r[c]||[])o[x.card]=(o[x.card]||0)+x.amount;return o;}
function calendarBudget(p){return p.remainingYear;}
function airlineBudget(p,a){if(a==="american")return{known:p.americanQualification.known,cardSpend:p.americanQualification.cardSpend};return p.remainingYear;}
function organicAirMetric(p,a){if(a==="american")return p.americanQualification.loyaltyPoints;const x=p.remainingYear[a]||{};return a==="delta"?x.mqd:a==="united"?x.pqp:a==="southwest"?x.tqp:0;}
function organicAirPqf(p,a){return a==="united"?p.remainingYear.united.pqf:0;}
function organicAirSegments(p,a){return a==="united"?p.remainingYear.united.unitedSegments:null;}
function organicAirFlights(p,a){return a==="southwest"?p.remainingYear.southwest.qualifyingFlights:0;}
function currentAirMetric(p,a){const x=p.statusProgress[a]||{};return a==="delta"?x.mqd:a==="united"?x.pqp:a==="american"?x.loyaltyPoints:a==="southwest"?x.tqp:0;}
function unitedTier(metric,pqf,segments,segmentsKnown){if(!segmentsKnown||segments<RULES.airlines.united.minimumUnitedSegments)return"";let tier="";for(const t of RULES.airlines.united.thresholds){if(metric>=t.pqpOnly||(pqf>=t.pqf&&metric>=t.pqpWithPQF))tier=t.tier;}return tier;}
function airTier(a,metric,opts={}){if(a==="united")return unitedTier(metric,opts.pqf||0,opts.unitedSegments||0,opts.unitedSegmentsKnown===true);let tier="";for(const t of RULES.airlines[a]?.thresholds||[])if(metric>=t.amount)tier=t.tier;if(a==="southwest")for(const t of RULES.airlines.southwest.flightThresholds)if((opts.qualifyingFlights||0)>=t.flights)tier=t.tier;return tier;}
function fixedAirlineCardCredit(p,a,id){const c=RULES.cards[id];if(!c||c.airline!==a||!c.status)return 0;let added=0;if(a==="delta"&&!p.currentCards.includes(id))added+=c.status.headstart||0;if(a==="united"&&p.cardTenure[id]?.futureAnnualBonusEligible===true)added+=c.status.annualBonus||0;return added;}
function unitedRemainingCardPqpCap(p,id){const c=RULES.cards[id];if(!c?.status?.annualCap)return Infinity;if(!p.currentCards.includes(id))return c.status.annualCap;const used=maybeNum(p.cardStatusProgressYTD[id]?.pqp);return used==null?null:Math.max(0,c.status.annualCap-used);}
function airProjection(p,a,qualificationRouting,portfolio){
 let metric=currentAirMetric(p,a)+organicAirMetric(p,a),pqf=a==="united"?p.statusProgress.united.pqf+organicAirPqf(p,a):0;
 const segCurrent=a==="united"?p.statusProgress.united.unitedSegments:null,segFuture=organicAirSegments(p,a),segmentsKnown=a!=="united"||(segCurrent!=null&&segFuture!=null),segments=a==="united"&&segmentsKnown?segCurrent+segFuture:0;
 const flights=a==="southwest"?p.statusProgress.southwest.qualifyingFlights+organicAirFlights(p,a):0,totals=cardTotals(qualificationRouting),uncertainties=[];
 for(const id of portfolio){const c=RULES.cards[id],spend=totals[id]||0;if(!c||c.airline!==a||!c.status)continue;metric+=fixedAirlineCardCredit(p,a,id);if(a==="delta")metric+=spend/c.status.spendDivisor;else if(a==="united"){const cap=unitedRemainingCardPqpCap(p,id);if(cap==null){uncertainties.push("united_card_pqp_progress_missing:"+id);continue;}metric+=Math.min(cap,spend/c.status.spendDivisor);}else if(a==="american")metric+=spend*(c.status.lpPerEligiblePurchaseDollar||0);else if(a==="southwest")metric+=Math.floor(spend/c.status.spendBlock)*c.status.tqpPerBlock;}
 return{metric:round(metric),pqf,unitedSegments:segments,unitedSegmentsKnown:segmentsKnown,qualifyingFlights:flights,tier:airTier(a,metric,{pqf,unitedSegments:segments,unitedSegmentsKnown:segmentsKnown,qualifyingFlights:flights}),uncertainties};
}
function targetRequiredMetric(a,target,progress){if(a!=="united")return target.amount;if(progress.unitedSegmentsKnown&&progress.unitedSegments>=RULES.airlines.united.minimumUnitedSegments&&progress.pqf>=target.pqf)return Math.min(target.pqpOnly,target.pqpWithPQF);return target.pqpOnly;}
function nextAirTarget(p,a,organic){const rules=RULES.airlines[a],ri=tierIndex(a,p.airline.reportedStatus),oi=tierIndex(a,organic.tier);if(ri>=0&&oi<ri)return{target:rules.thresholds[ri],type:"retain"};const target=rules.thresholds.find((x,i)=>i>Math.max(ri,oi));return target?{target,type:"upgrade"}:null;}
function statusSpendForGap(a,c,gap,p,id){if(gap<=0)return 0;if(a==="delta")return gap*c.status.spendDivisor;if(a==="united"){const cap=unitedRemainingCardPqpCap(p,id);if(cap==null||gap>cap)return Infinity;return gap*c.status.spendDivisor;}if(a==="american")return gap/(c.status.lpPerEligiblePurchaseDollar||1);if(a==="southwest")return Math.ceil(gap/c.status.tqpPerBlock)*c.status.spendBlock;return Infinity;}
function statusNeedFromBaseline(p,a,id,baseline){const c=RULES.cards[id],plan=nextAirTarget(p,a,baseline);if(!c?.status||!plan)return null;if(a==="southwest"){const ft=RULES.airlines.southwest.flightThresholds.find(x=>x.tier===plan.target.tier);if(ft&&baseline.qualifyingFlights>=ft.flights)return{spend:0,...plan,achievedOrganically:true};}const required=targetRequiredMetric(a,plan.target,baseline),gap=Math.max(0,required-baseline.metric);return gap?{spend:statusSpendForGap(a,c,gap,p,id),requiredMetric:required,...plan}:{spend:0,requiredMetric:required,...plan,achievedOrganically:true};}

function hotelBaselineStatus(p,program){if(!program)return"";let auto="";for(const id of p.currentCards){const c=RULES.cards[id];if(c?.hotel===program&&c.hotelStatus?.automaticTier)auto=maxTier(program,auto,c.hotelStatus.automaticTier);if(c?.hotelStatusByProgram?.[program])auto=maxTier(program,auto,c.hotelStatusByProgram[program]);}return maxTier(program,p.hotel.reportedStatus,auto);}
function hotelProjection(p,portfolio,calendarRouting){
 const pr=p.hotel.primary;if(!pr)return{projectedTier:"",effectiveTier:p.hotel.reportedStatus||"",qualifyingNights:p.statusProgress.hotel.qualifyingNights};
 let nights=p.statusProgress.hotel.qualifyingNights+(p.remainingYear.known?p.remainingYear.hotel.qualifyingNights:0),stays=p.statusProgress.hotel.qualifyingStays+(p.remainingYear.known?p.remainingYear.hotel.qualifyingStays:0),qSpend=p.statusProgress.hotel.qualifyingSpend+(p.remainingYear.known?p.remainingYear.hotel.qualifyingSpend:0),auto="";const totals=cardTotals(calendarRouting);
 for(const id of portfolio){const c=RULES.cards[id];if(c?.hotel===pr&&c.hotelStatus){const h=c.hotelStatus;if(!p.currentCards.includes(id))nights+=h.annualNights||0;if(h.spendBlock&&h.nightsPerBlock)nights+=Math.floor((totals[id]||0)/h.spendBlock)*h.nightsPerBlock;if(h.automaticTier)auto=maxTier(pr,auto,h.automaticTier);if(h.goldAtSpend){const ytd=p.currentCards.includes(id)?maybeNum(p.cardSpendYTD[id]):0;if(ytd!=null&&ytd+(totals[id]||0)>=h.goldAtSpend)auto=maxTier(pr,auto,"Gold Elite");}}if(c?.hotelStatusByProgram?.[pr])auto=maxTier(pr,auto,c.hotelStatusByProgram[pr]);}
 let earned="";if(pr==="hilton"){for(const x of RULES.hotels.hilton.thresholds)if(nights>=x.nights||stays>=x.stays||qSpend>=x.spend)earned=x.tier;const d=RULES.hotels.hilton.diamondReserve;if((nights>=d.nights||stays>=d.stays)&&qSpend>=d.spend)earned=d.tier;}else for(const x of RULES.hotels[pr].thresholds)if(nights>=x.nights)earned=x.tier;
 const projectedTier=maxTier(pr,earned,auto);return{projectedTier,effectiveTier:maxTier(pr,p.hotel.reportedStatus,projectedTier),qualifyingNights:nights};
}
function reachableAirlineJob(p,id){const c=RULES.cards[id];if(!c?.airline||c.airline!==p.airline.primary||!airlineStatusUsefulness(p)||!airlineQualificationDataReady(p,c.airline,[id]))return false;const baseline=airProjection(p,c.airline,emptyRouting(),[]),plan=nextAirTarget(p,c.airline,baseline);if(!plan)return false;const fixed=clone(baseline);fixed.metric+=fixedAirlineCardCredit(p,c.airline,id);fixed.tier=airTier(c.airline,fixed.metric,fixed);if(tierIndex(c.airline,fixed.tier)>=tierIndex(c.airline,plan.target.tier))return true;const need=statusNeedFromBaseline(p,c.airline,id,fixed),budget=airlineBudget(p,c.airline);return!!need&&Number.isFinite(need.spend)&&need.spend>0&&need.spend<=sum(Object.values(budget.cardSpend));}
function reachableHotelJob(p,id){const c=RULES.cards[id];if(!c?.hotel||c.hotel!==p.hotel.primary||!hotelStatusUsefulness(p))return false;const before=hotelBaselineStatus(p,c.hotel),after=maxTier(c.hotel,before,c.hotelStatus?.automaticTier||"");if(tierIndex(c.hotel,after)>tierIndex(c.hotel,before))return true;if(c.hotelStatus?.spendBlock&&p.remainingYear.known){const remaining=sum(Object.values(p.remainingYear.cardSpend)),nights=p.statusProgress.hotel.qualifyingNights+p.remainingYear.hotel.qualifyingNights+(c.hotelStatus.annualNights||0)+Math.floor(remaining/c.hotelStatus.spendBlock)*(c.hotelStatus.nightsPerBlock||0),target=RULES.hotels[c.hotel].thresholds.find(x=>tierIndex(c.hotel,x.tier)>tierIndex(c.hotel,before));return!!target&&nights>=target.nights;}return false;}
function coBrandHasJob(p,id){const c=RULES.cards[id];if(!c||c.kind==="flex"||p.currentCards.includes(id))return true;if(n(p.cardUniqueBenefitValue[id])>0||n(p.legacyNaturalBenefitValue[id])>0||Object.values(p.explicitBenefitUse?.[id]||{}).some(Boolean)||Object.values(p.benefitEvidence?.[id]||{}).some(Boolean))return true;if(c.airline)return reachableAirlineJob(p,id);if(c.hotel)return reachableHotelJob(p,id);return false;}
function brilliantAllowed(p,set){if(!set.includes("marriott_brilliant")||p.currentCards.includes("marriott_brilliant"))return true;const platinumRelevant=p.currentCards.includes("amex_platinum")||set.includes("amex_platinum");if(!platinumRelevant)return true;return p.hotel.primary==="marriott"&&p.hotel.share>=.55&&(p.marriottBeyondFHR||p.directMarriottNights>=MODEL.brilliantMinDirectMarriottNights);}
function badHotelStack(p,set){if(p.hotelCardStackingAllowed)return false;const m={};for(const id of set){const h=RULES.cards[id]?.hotel;if(h)(m[h]||=[]).push(id);}return Object.values(m).some(a=>a.length>1);}
function protectedCurrentIds(p){return p.currentCards.filter(id=>!RULES.cards[id]||RULES.cards[id]?.verified!==true);}
function relevantCards(p){const flex=["amex_gold","amex_platinum","chase_preferred","chase_reserve","venture","venture_x"],air={delta:["delta_platinum","delta_reserve"],united:["united_explorer","united_quest","united_club"],american:["aa_executive"],southwest:["southwest_priority"]}[p.airline.primary]||[],hotel={hyatt:["hyatt_consumer"],marriott:["marriott_boundless","marriott_brilliant"],hilton:["hilton_no_fee","hilton_surpass","hilton_aspire"]}[p.hotel.primary]||[];return uniq([...p.currentCards,...p.constraints.requiredCards,...flex,...air,...hotel]).filter(id=>!p.constraints.prohibitedCards.includes(id));}
function combinations(a,max){const out=[];(function go(i,pick){if(pick.length<=max)out.push(pick.slice());if(pick.length===max)return;for(let j=i;j<a.length;j++){pick.push(a[j]);go(j+1,pick);pick.pop();}})(0,[]);return out;}
function candidatePortfolios(p){const relevant=relevantCards(p),protectedIds=protectedCurrentIds(p),out=[],max=Math.min(relevant.length,Math.max(MODEL.maxPortfolioCards,p.currentCards.length+p.constraints.maxNewCards));for(const set of combinations(relevant,max)){if(!set.length&&p.totalSpend)continue;if(p.constraints.requiredCards.some(id=>!set.includes(id))||protectedIds.some(id=>!set.includes(id)))continue;const adds=set.filter(id=>!p.currentCards.includes(id));if((p.constraints.noNewCards&&adds.length)||adds.length>p.constraints.maxNewCards||adds.some(id=>!coBrandHasJob(p,id))||badHotelStack(p,set)||!brilliantAllowed(p,set))continue;out.push(set);}const cur=JSON.stringify(p.currentCards.slice().sort());if(!out.some(x=>JSON.stringify(x.slice().sort())===cur))out.push(p.currentCards.slice());return out;}

function routingForBudget(p,annual,budget){const out={};for(const cat of CATS){const amt=budget.cardSpend[cat]||0,total=p.spend[cat]||0;out[cat]=!amt||!total?[]:(annual[cat]||[]).map(x=>({card:x.card,amount:round(amt*x.amount/total)})).filter(x=>x.amount>0);}return out;}
function catValue(p,id,cat,scenario,portfolio){const card=RULES.cards[id];return card?baseRate(card,p,cat)*pointDollarValue(p,id,scenario,portfolio):-Infinity;}
function shift(p,r,target,need,scenario,portfolio){const out=clone(r),choices=[];for(const cat of CATS){const avail=sum((out[cat]||[]).map(x=>x.amount));if(!avail)continue;const normal=(out[cat]||[]).sort((a,b)=>b.amount-a.amount)[0]?.card;choices.push({cat,avail,normal,loss:Math.max(0,catValue(p,normal,cat,scenario,portfolio)-catValue(p,target,cat,scenario,portfolio))});}choices.sort((a,b)=>a.loss-b.loss);let left=need,cost=0,moved=0;for(const q of choices){if(left<=0)break;const take=Math.min(q.avail,left),rows=out[q.cat];let x=take;for(const row of rows){if(row.card===target)continue;const z=Math.min(row.amount,x);row.amount=round(row.amount-z);x-=z;if(x<=0)break;}const t=rows.find(r=>r.card===target);if(t)t.amount=round(t.amount+take);else rows.push({card:target,amount:round(take)});out[q.cat]=rows.filter(r=>r.amount>0);left-=take;moved+=take;cost+=take*q.loss;}return left>0?null:{routing:out,shifted:round(moved),opportunityCost:round(cost)};}
function hotelNeed(p,portfolio,id,organic){const pr=p.hotel.primary,c=RULES.cards[id],h=c?.hotelStatus;if(!pr||!h||c.hotel!==pr||!hotelStatusUsefulness(p)||pr==="hilton"||!h.spendBlock)return null;const ri=tierIndex(pr,p.hotel.reportedStatus),oi=tierIndex(pr,organic.projectedTier),rules=RULES.hotels[pr].thresholds;let target,type;if(ri>=0&&oi<ri){target=rules[ri];type="retain";}else{target=rules.find((x,i)=>i>Math.max(ri,oi));type="upgrade";}if(!target)return null;const gap=Math.max(0,target.nights-organic.qualifyingNights);return gap?{spend:Math.ceil(gap/h.nightsPerBlock)*h.spendBlock,target,type}:{spend:0,target,type,achievedOrganically:true};}
function statusPlan(p,portfolio,annual,scenario){
 const airline=p.airline.primary,airBudget=airline?airlineBudget(p,airline):{known:false,cardSpend:normalizeSpendShape({})},calendar=p.remainingYear;
 let airRouting=airBudget.known?routingForBudget(p,annual,airBudget):emptyRouting(),hotelRouting=calendar.known?routingForBudget(p,annual,calendar):emptyRouting();
 let airlineTarget=null,hotelTarget=null,airCost=0,hotelCost=0;
 if(airline&&airlineQualificationDataReady(p,airline,portfolio)){
  let baseline=airProjection(p,airline,airRouting,portfolio),best=null;
  for(const id of portfolio.filter(id=>RULES.cards[id]?.airline===airline)){
   const need=statusNeedFromBaseline(p,airline,id,baseline);if(!need||need.achievedOrganically||!Number.isFinite(need.spend)||need.spend<=0)continue;
   const shifted=shift(p,airRouting,id,need.spend,scenario,portfolio);if(!shifted||shifted.opportunityCost>MODEL.statusOpportunityCostLimit)continue;
   const projected=airProjection(p,airline,shifted.routing,portfolio);if(tierIndex(airline,projected.tier)<tierIndex(airline,need.target.tier))continue;
   if(!best||shifted.opportunityCost<best.shifted.opportunityCost)best={id,need,shifted,projected};
  }
  if(best){airRouting=best.shifted.routing;airCost=best.shifted.opportunityCost;airlineTarget={airline,tier:best.need.target.tier,type:best.need.type,cardId:best.id,spendDirected:best.shifted.shifted,projectedTier:best.projected.tier};}
 }
 if(calendar.known&&hotelStatusUsefulness(p)&&p.hotel.primary){
  const sharedWithAirline=airline&&airline!=="american"&&airlineQualificationDataReady(p,airline,portfolio);
  if(sharedWithAirline)hotelRouting=clone(airRouting);
  let organic=hotelProjection(p,portfolio,hotelRouting),best=null;
  for(const id of portfolio.filter(id=>RULES.cards[id]?.hotel===p.hotel.primary&&RULES.cards[id]?.hotelStatus?.spendBlock)){
   const need=hotelNeed(p,portfolio,id,organic);if(!need||need.achievedOrganically||need.spend<=0)continue;
   const shifted=shift(p,hotelRouting,id,need.spend,scenario,portfolio);if(!shifted||shifted.opportunityCost>MODEL.statusOpportunityCostLimit)continue;
   const projected=hotelProjection(p,portfolio,shifted.routing);if(tierIndex(p.hotel.primary,projected.projectedTier)<tierIndex(p.hotel.primary,need.target.tier))continue;
   if(!best||shifted.opportunityCost<best.shifted.opportunityCost)best={id,need,shifted,projected};
  }
  if(best){hotelRouting=best.shifted.routing;hotelCost=best.shifted.opportunityCost;hotelTarget={program:p.hotel.primary,tier:best.need.target.tier,type:best.need.type,cardId:best.id,spendDirected:best.shifted.shifted,projectedTier:best.projected.projectedTier};if(sharedWithAirline)airRouting=clone(hotelRouting);}
 }
 return{airlineRouting:airRouting,hotelRouting,airlineTarget,hotelTarget,opportunityCost:round(airCost+hotelCost)};
}

function unsupportedShare(p){let x=0;for(const c of CATS)for(const r of p.currentRouting[c]||[])if(!RULES.cards[r.card])x+=r.amount;return p.totalSpend?x/p.totalSpend:0;}
function dataQuality(p,eco,portfolio){const issues=[],u=unsupportedShare(p);if(u>=MODEL.unsupportedMaterialSpendShare)issues.push({code:"unsupported_material_current_spend",severity:"blocking"});else if(u>0)issues.push({code:"unsupported_current_spend",severity:"high"});for(const id of eco.unverifiedCards||[])issues.push({code:"rule_verification_pending",severity:"medium",detail:id});if(p.airline.primary&&p.airline.routeFit[p.airline.primary]==null)issues.push({code:"route_fit_not_independently_verified",severity:"medium",detail:p.airline.primary});if(airlineStatusUsefulness(p)){if(p.airline.primary==="american"&&!p.americanQualification.known)issues.push({code:"american_qualification_activity_missing",severity:"medium"});else if(p.airline.primary!=="american"&&!p.remainingYear.known)issues.push({code:"remaining_year_activity_missing",severity:"medium"});if(p.airline.primary==="united"){if(!unitedSegmentsKnown(p))issues.push({code:"united_operated_segments_missing",severity:"medium"});for(const id of portfolio||[])if(RULES.cards[id]?.airline==="united"&&RULES.cards[id]?.status&&p.currentCards.includes(id)&&!unitedCardPqpProgressKnown(p,id))issues.push({code:"united_card_pqp_progress_missing",severity:"medium",detail:id});}}
 if(p.hotel.primary==="marriott"&&hotelStatusUsefulness(p)){for(const id of portfolio||[])if(RULES.cards[id]?.hotel==="marriott"&&RULES.cards[id]?.hotelStatus?.goldAtSpend&&p.currentCards.includes(id)&&maybeNum(p.cardSpendYTD[id])==null)issues.push({code:"marriott_card_spend_ytd_missing",severity:"medium",detail:id});}
 if(eco.benefitLedger?.overlapUnresolved)issues.push({code:"benefit_overlap_unresolved",severity:"medium"});return{issues,precisionSuppressed:issues.some(x=>x.severity==="blocking")};}
function actions(p,portfolio){const out=[];for(const id of p.currentCards){const r=RULES.cards[id];out.push({cardId:id,action:!r||!r.verified?"manual_review":portfolio.includes(id)?"keep":"remove_or_downgrade_after_review"});}for(const id of portfolio)if(!p.currentCards.includes(id))out.push({cardId:id,action:"add"});return out;}
function complexity(p,portfolio){const currencies=uniq(portfolio.map(id=>RULES.cards[id]?.currency).filter(Boolean)),newCards=portfolio.filter(id=>!p.currentCards.includes(id));return{cardCount:portfolio.length,newCardCount:newCards.length,currencyCount:currencies.length,burden:round(portfolio.length*1.25+currencies.length*.75+newCards.length,2)};}
function airlineStrategy(p){return p.airline.primary?{type:"keep",airline:p.airline.primary,statusUseful:airlineStatusUsefulness(p),routeFitEstablished:p.airline.routeFit[p.airline.primary]!=null}:{type:"none",airline:"",statusUseful:false,routeFitEstablished:false};}
function hotelStrategy(p,credit){const a=hotelStatusUsefulness(p),b=credit.premiumHotel>0;return{type:a&&b?"mixed":a?"chain_loyalty_status":b?"premium_booking":"none",program:p.hotel.primary||""};}
function strategyRecord(p,portfolio,scenario="base"){
 const annual=routeAnnual(p,portfolio,scenario),eco=economics(p,annual,portfolio,scenario),plan=statusPlan(p,portfolio,annual,scenario),airline=p.airline.primary;
 const air=airline&&airlineQualificationDataReady(p,airline,portfolio)?airProjection(p,airline,plan.airlineRouting,portfolio):{tier:"",uncertainties:[]};
 const hot=p.remainingYear.known?hotelProjection(p,portfolio,plan.hotelRouting):{projectedTier:"",effectiveTier:hotelBaselineStatus(p,p.hotel.primary)};
 const credit=recommendationCredit(p,portfolio),effectiveAir=airline?maxTier(airline,p.airline.reportedStatus,air.tier):"",ri=airline?tierIndex(airline,p.airline.reportedStatus):-1,pi=airline?tierIndex(airline,air.tier):-1;
 const rec={profileRef:p,id:portfolio.slice().sort().join("+")||"no_cards",portfolio,annualRouting:annual,airlineQualificationRouting:plan.airlineRouting,hotelQualificationRouting:plan.hotelRouting,economics:eco,
  strategy:{airlineStrategy:airlineStrategy(p),hotelStrategy:hotelStrategy(p,credit),airlineStatusTarget:plan.airlineTarget,hotelStatusTarget:plan.hotelTarget},
  outcomes:{travelCapacity:{annualTravelValue:eco.grossTravelValue,pointsByCurrency:eco.pointsByCurrency},flightQuality:{effectiveStatus:effectiveAir,statusUseful:airlineStatusUsefulness(p)},hotelExperience:{effectiveStatus:hot.effectiveTier||"",statusUseful:hotelStatusUsefulness(p)},reliability:{preservesCurrentAirlineStatus:ri<0||pi>=ri},cashEfficiency:{netEconomicValue:eco.netEconomicValue},complexity:complexity(p,portfolio)},
  visibleBenefits:visibleBenefits(portfolio),recommendationCredit:credit,actions:actions(p,portfolio)};
 rec.quality=dataQuality(p,eco,portfolio);return rec;
}
function currentRecord(p,scenario="base"){
 const eco=economics(p,p.currentRouting,p.currentCards,scenario),annual=p.currentRouting,airBudget=p.airline.primary?airlineBudget(p,p.airline.primary):{known:false,cardSpend:normalizeSpendShape({})},airRoute=airBudget.known?routingForBudget(p,annual,airBudget):emptyRouting(),hotelRoute=p.remainingYear.known?routingForBudget(p,annual,p.remainingYear):emptyRouting();
 const airline=p.airline.primary,air=airline&&airlineQualificationDataReady(p,airline,p.currentCards)?airProjection(p,airline,airRoute,p.currentCards):{tier:""},hot=p.remainingYear.known?hotelProjection(p,p.currentCards,hotelRoute):{effectiveTier:hotelBaselineStatus(p,p.hotel.primary)},credit=recommendationCredit(p,p.currentCards),ri=airline?tierIndex(airline,p.airline.reportedStatus):-1,pi=airline?tierIndex(airline,air.tier):-1;
 const rec={profileRef:p,id:"current",portfolio:p.currentCards,annualRouting:clone(p.currentRouting),airlineQualificationRouting:airRoute,hotelQualificationRouting:hotelRoute,economics:eco,
  strategy:{airlineStrategy:airlineStrategy(p),hotelStrategy:hotelStrategy(p,credit),airlineStatusTarget:null,hotelStatusTarget:null},
  outcomes:{travelCapacity:{annualTravelValue:eco.grossTravelValue,pointsByCurrency:eco.pointsByCurrency},flightQuality:{effectiveStatus:airline?maxTier(airline,p.airline.reportedStatus,air.tier):"",statusUseful:airlineStatusUsefulness(p)},hotelExperience:{effectiveStatus:hot.effectiveTier||"",statusUseful:hotelStatusUsefulness(p)},reliability:{preservesCurrentAirlineStatus:ri<0||pi>=ri},cashEfficiency:{netEconomicValue:eco.netEconomicValue},complexity:complexity(p,p.currentCards)},
  visibleBenefits:visibleBenefits(p.currentCards),recommendationCredit:credit,actions:actions(p,p.currentCards)};
 rec.quality=dataQuality(p,eco,p.currentCards);return rec;
}

function explicitlyUsedBenefitKeys(p){const keys=new Set();for(const use of Object.values(p.explicitBenefitUse||{})){if(typeof use!=="object")continue;for(const[tag,val]of Object.entries(use))if(val===true)keys.add(canonicalBenefit(tag));}return keys;}
function missingMaterialBenefitKeys(p,record){const required=explicitlyUsedBenefitKeys(p),present=canonicalVisibleSet(record.portfolio);return[...required].filter(key=>!present.has(key));}
function compare(a,b){
 const p=a.profileRef||b.profileRef,imp=[],reg=[];
 if(a.outcomes.travelCapacity.annualTravelValue-b.outcomes.travelCapacity.annualTravelValue>=MODEL.materialTravelValue)imp.push("travelCapacity");
 if(b.outcomes.travelCapacity.annualTravelValue-a.outcomes.travelCapacity.annualTravelValue>=MODEL.materialTravelValue)reg.push("travelCapacity");
 if(a.economics.netEconomicValue-b.economics.netEconomicValue>=MODEL.materialCashImprovement)imp.push("cashEfficiency");
 if(b.economics.netEconomicValue-a.economics.netEconomicValue>=MODEL.materialCashImprovement)reg.push("cashEfficiency");
 const air=a.strategy.airlineStrategy.airline||b.strategy.airlineStrategy.airline;
 if(air&&p&&airlineStatusUsefulness(p)&&airlineQualificationDataReady(p,air,uniq([...a.portfolio,...b.portfolio]))){const ai=tierIndex(air,a.outcomes.flightQuality.effectiveStatus),bi=tierIndex(air,b.outcomes.flightQuality.effectiveStatus);if(ai>bi)imp.push("flightQuality");if(bi>ai)reg.push("flightQuality");if(a.outcomes.reliability.preservesCurrentAirlineStatus&&!b.outcomes.reliability.preservesCurrentAirlineStatus)imp.push("reliability");if(b.outcomes.reliability.preservesCurrentAirlineStatus&&!a.outcomes.reliability.preservesCurrentAirlineStatus)reg.push("reliability");}
 const h=a.strategy.hotelStrategy.program||b.strategy.hotelStrategy.program;
 if(h&&p&&hotelStatusUsefulness(p)){const ai=tierIndex(h,a.outcomes.hotelExperience.effectiveStatus),bi=tierIndex(h,b.outcomes.hotelExperience.effectiveStatus);if(ai>bi)imp.push("hotelExperience");if(bi>ai)reg.push("hotelExperience");}
 if(a.recommendationCredit.premiumHotel>b.recommendationCredit.premiumHotel)imp.push("hotelExperience");if(b.recommendationCredit.premiumHotel>a.recommendationCredit.premiumHotel)reg.push("hotelExperience");
 const aa=a.recommendationCredit.lounge+a.recommendationCredit.priorityAirport+a.recommendationCredit.upgradePriority,bb=b.recommendationCredit.lounge+b.recommendationCredit.priorityAirport+b.recommendationCredit.upgradePriority;if(aa>bb)imp.push("airportExperience");if(bb>aa)reg.push("airportExperience");
 if(b.outcomes.complexity.burden-a.outcomes.complexity.burden>=2)imp.push("complexity");if(a.outcomes.complexity.burden-b.outcomes.complexity.burden>=2)reg.push("complexity");
 if(p){if(missingMaterialBenefitKeys(p,a).length<missingMaterialBenefitKeys(p,b).length)imp.push("benefitContinuity");if(missingMaterialBenefitKeys(p,a).length>missingMaterialBenefitKeys(p,b).length)reg.push("benefitContinuity");}
 return{improvements:uniq(imp),regressions:uniq(reg)};
}
function dominates(a,b){const c=compare(a,b);return c.improvements.length>0&&c.regressions.length===0;}
function paretoSurvivors(records){return records.filter((r,i)=>!records.some((o,j)=>i!==j&&dominates(o,r)));}
function protectedRegressionKeys(){return new Set(["flightQuality","hotelExperience","reliability","benefitContinuity"]);}
function viableAgainstCurrent(r,current){const c=compare(r,current),protectedKeys=protectedRegressionKeys();if(!c.improvements.length||c.regressions.some(k=>protectedKeys.has(k)))return null;const onlyPoints=c.improvements.every(k=>k==="travelCapacity"||k==="cashEfficiency"||k==="complexity");if(onlyPoints&&r.outcomes.complexity.newCardCount>current.outcomes.complexity.newCardCount&&r.economics.netEconomicValue<current.economics.netEconomicValue)return null;if(c.improvements.every(k=>k==="complexity")&&(r.economics.netEconomicValue<current.economics.netEconomicValue||r.economics.grossTravelValue<current.economics.grossTravelValue))return null;return c;}
function choose(p,records,current){if(current.quality.precisionSuppressed)return current;const viable=paretoSurvivors(records).map(r=>({r,c:viableAgainstCurrent(r,current)})).filter(x=>x.c);viable.sort((x,y)=>{const xn=x.c.improvements.filter(k=>!["cashEfficiency","complexity"].includes(k)).length,yn=y.c.improvements.filter(k=>!["cashEfficiency","complexity"].includes(k)).length;if(yn!==xn)return yn-xn;if(x.r.outcomes.complexity.burden!==y.r.outcomes.complexity.burden)return x.r.outcomes.complexity.burden-y.r.outcomes.complexity.burden;return y.r.economics.netEconomicValue-x.r.economics.netEconomicValue;});return viable[0]?.r||current;}
function selectForScenario(p,scenario){const current=currentRecord(p,scenario),records=candidatePortfolios(p).map(set=>strategyRecord(p,set,scenario)),recommended=choose(p,records,current);return{current,records,recommended,pareto:paretoSurvivors(records)};}
function allMaterialOpportunities(p,current,records){const out={};for(const r of paretoSurvivors(records)){const c=viableAgainstCurrent(r,current);if(!c)continue;for(const key of c.improvements){if(key==="complexity")continue;(out[key]??=[]).push({strategyId:r.id,outcome:r.outcomes[key]||null,visibleBenefits:r.visibleBenefits});}}return Object.entries(out).map(([key,strategies])=>({key,strategies}));}
function presentationOrder(p){const base=["travelCapacity","flightQuality","airportExperience","hotelExperience","reliability","cashEfficiency","complexity"],map={"travel more":["travelCapacity","cashEfficiency"],"fly & airport better":["flightQuality","airportExperience","reliability"],"fly and airport better":["flightQuality","airportExperience","reliability"],"stay better":["hotelExperience"],"get more travel from what i already spend":["travelCapacity","cashEfficiency"],"show me everything":[]},first=[];for(const a of p.aspirations)for(const k of map[a]||[])if(!first.includes(k))first.push(k);return[...first,...base.filter(k=>!first.includes(k))];}
function recommendationFingerprint(x){const r=x.recommended||x;return JSON.stringify({portfolio:r.portfolio.slice().sort(),annualRouting:r.annualRouting,airlineQualificationRouting:r.airlineQualificationRouting,hotelQualificationRouting:r.hotelQualificationRouting,airlineStatusTarget:r.strategy.airlineStatusTarget,hotelStatusTarget:r.strategy.hotelStatusTarget});}
function analyze(raw){const p=raw?.__normalizedV5?raw:normalizeProfile(raw),c=selectForScenario(p,"conservative"),b=selectForScenario(p,"base"),u=selectForScenario(p,"upper"),fps=[c,b,u].map(x=>recommendationFingerprint(x.recommended)),opps=allMaterialOpportunities(p,b.current,b.records),order=presentationOrder(p);return{engineVersion:ENGINE_VERSION,rulesAsOf:RULES_AS_OF,profile:p,current:b.current,recommended:b.recommended,candidatesEvaluated:b.records.length,currentBenefits:b.current.visibleBenefits,visibleBenefits:b.recommended.visibleBenefits,allMaterialOpportunities:opps,presentation:{aspirations:p.aspirations,order,opportunityKeys:opps.map(x=>x.key).sort((a,z)=>order.indexOf(a)-order.indexOf(z))},sensitivity:{strategyStable:new Set(fps).size===1,recommendationIds:{conservative:c.recommended.id,base:b.recommended.id,upper:u.recommended.id}},integrity:{aspirationsUsedInRecommendationSelection:false,benefitVisibilitySeparatedFromRecommendationCredit:true,allMaterialOpportunitiesIndependentOfAspirations:true,detailedBenefitValuesDedupedByCanonicalType:true,annualAndQualificationRoutingSeparated:true,americanUsesMarFebQualificationInput:true,unitedDualQualificationPaths:true,unitedFourSegmentMinimumModeled:true,currentProgressAssumedToContainExistingCardStatusCredits:true,reportedStatusAuthoritative:true,statusDifferencesOnlyDriveRecommendationWhenUsefulAndDataReady:true,unverifiedCurrentCardsProtected:true,coBrandAdditionsRequireConcreteJob:true,bookingMethodAware:true,partnerSpecificTransferValuation:true,sharedCapAware:true,groceryInputUsesTotalWithOnlineSubset:true}};}

return Object.freeze({
 ENGINE_VERSION,RULES_AS_OF,RULES,VALUATIONS,MODEL,BENEFIT_CANONICAL,canonicalBenefit,
 matchCard,normalizeProfile,transferRatio,portfolioTransferRatio,currencyPointValue,
 airlineStatusUsefulness,hotelStatusUsefulness,airlineQualificationDataReady,
 visibleBenefits,benefitLedger,recommendationCredit,candidatePortfolios,routeAnnual,
 reachableAirlineJob,reachableHotelJob,airlineProjection:airProjection,hotelProjection,
 strategyRecord,currentRecord,materialComparison:compare,paretoSurvivors,allMaterialOpportunities,
 selectForScenario,analyze,recommendationFingerprint
});
});
