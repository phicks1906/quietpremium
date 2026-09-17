/**
 * Quiet Premium V5 isolated travel-strategy engine — 5.0-alpha.4 (2026-09-17)
 * NOT wired to diagnostic.html or any customer-facing page.
 *
 * Locked:
 * - Facts determine opportunity.
 * - Behavioral constraints determine feasibility.
 * - Aspirations determine presentation order/emphasis only.
 * - Benefits remain visible. Internal recommendation credit is separate.
 * - Travel-life strategy comes before cards and spend routing.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.QuietPremiumEngineV5=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";

const ENGINE_VERSION="5.0-alpha.4";
const RULES_AS_OF="2026-09-17";
const CATS=["dining","grocery","online_grocery","airfare","hotel","general"];
const AIRLINES=["delta","united","american","southwest"];
const HOTELS=["hyatt","marriott","hilton"];

const n=v=>{ if(typeof v==="number") return Number.isFinite(v)?v:0; const x=Number(String(v??"").replace(/[$,%\s,]/g,"")); return Number.isFinite(x)?x:0; };
const s=v=>String(v??"").trim();
const lc=v=>s(v).toLowerCase();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const sum=a=>(a||[]).reduce((x,y)=>x+(Number(y)||0),0);
const clone=x=>JSON.parse(JSON.stringify(x));
const round=(x,d=0)=>{const p=10**d; return Math.round((Number(x)||0)*p)/p;};
const isoDate=v=>{ const x=s(v); return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:""; };
const onOrAfter=(a,b)=>!!a&&a>=b;
const before=(a,b)=>!!a&&a<b;

const RULES=Object.freeze({
 meta:{
   version:ENGINE_VERSION,asOf:RULES_AS_OF,
   supportedAirlines:AIRLINES,supportedHotels:HOTELS,
   supportedFlexible:["amex_mr","chase_ur","capital_one_miles"]
 },
 airlines:{
   delta:{metric:"MQD",thresholds:[
     {tier:"Silver Medallion",amount:5000},{tier:"Gold Medallion",amount:10000},
     {tier:"Platinum Medallion",amount:15000},{tier:"Diamond Medallion",amount:28000}]},
   united:{metric:"PQP",thresholds:[
     {tier:"Premier Silver",amount:6000},{tier:"Premier Gold",amount:12000},
     {tier:"Premier Platinum",amount:18000},{tier:"Premier 1K",amount:28000}]},
   american:{metric:"Loyalty Points",thresholds:[
     {tier:"AAdvantage Gold",amount:40000},{tier:"AAdvantage Platinum",amount:75000},
     {tier:"AAdvantage Platinum Pro",amount:125000},{tier:"AAdvantage Executive Platinum",amount:200000}]},
   southwest:{metric:"TQP",thresholds:[
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
   amex_gold:{
     label:"American Express Gold Card",kind:"flex",currency:"amex_mr",annualFee:325,
     earn:{dining:4,grocery:4,online_grocery:4,airfare:1,hotel:1,general:1},
     bookingEarn:{airfare:{direct_airline:3,amex_travel:3},hotel:{amex_prepaid:5}},
     caps:{dining:50000,grocery:25000,online_grocery:25000},
     benefitTags:["dining_credit","uber_cash","resy_credit","dunkin_credit"],verified:true
   },
   amex_platinum:{
     label:"The Platinum Card from American Express",kind:"flex",currency:"amex_mr",annualFee:895,
     earn:{dining:1,grocery:1,online_grocery:1,airfare:1,hotel:1,general:1},
     bookingEarn:{airfare:{direct_airline:5,amex_travel:5},hotel:{amex_prepaid:5}},
     benefitTags:["lounge","premium_hotel_booking","hotel_status","airline_fee_credit","resy_credit","digital_entertainment_credit"],verified:true
   },
   chase_preferred:{
     label:"Chase Sapphire Preferred",kind:"flex",currency:"chase_ur",annualFee:95,
     earn:{dining:3,grocery:1,online_grocery:3,airfare:2,hotel:2,general:1},
     bookingEarn:{airfare:{chase_travel:5},hotel:{chase_travel:5}},
     benefitTags:["chase_travel_hotel_credit","trusted_traveler_credit","travel_protections"],
     transferRules:{
       hyatt:{defaultRatio:.75,grandfatherBefore:"2026-06-15",grandfatherRatio:1,grandfatherThrough:"2026-09-30"}
     },
     verified:true
   },
   chase_reserve:{
     label:"Chase Sapphire Reserve",kind:"flex",currency:"chase_ur",annualFee:795,
     earn:{dining:3,grocery:1,online_grocery:1,airfare:4,hotel:4,general:1},
     bookingEarn:{airfare:{chase_travel:8},hotel:{chase_travel:8}},
     benefitTags:["lounge","travel_credit","travel_protections"],verified:true
   },
   venture:{
     label:"Capital One Venture Rewards",kind:"flex",currency:"capital_one_miles",annualFee:95,
     earn:{dining:2,grocery:2,online_grocery:2,airfare:2,hotel:2,general:2},verified:true
   },
   venture_x:{
     label:"Capital One Venture X Rewards",kind:"flex",currency:"capital_one_miles",annualFee:395,
     earn:{dining:2,grocery:2,online_grocery:2,airfare:2,hotel:2,general:2},
     bookingEarn:{airfare:{capital_one_travel:5},hotel:{capital_one_travel:10}},
     benefitTags:["lounge","capital_one_travel_credit","anniversary_miles"],verified:true
   },
   delta_platinum:{
     label:"Delta SkyMiles Platinum American Express Card",kind:"airline",airline:"delta",
     currency:"skymiles",annualFee:350,
     earn:{dining:2,grocery:2,online_grocery:2,airfare:3,hotel:3,general:1},
     status:{headstart:2500,spendDivisor:20},benefitTags:["companion_certificate_renewal"],verified:true
   },
   delta_reserve:{
     label:"Delta SkyMiles Reserve American Express Card",kind:"airline",airline:"delta",
     currency:"skymiles",annualFee:650,
     earn:{dining:1,grocery:1,online_grocery:1,airfare:3,hotel:1,general:1},
     status:{headstart:2500,spendDivisor:10},
     benefitTags:["lounge","upgrade_priority","companion_certificate_renewal"],verified:true
   },
   united_explorer:{
     label:"United Explorer Card",kind:"airline",airline:"united",
     currency:"united_miles",annualFee:150,
     earn:{dining:2,grocery:1,online_grocery:1,airfare:3,hotel:2,general:1},
     status:{spendDivisor:20,annualCap:1000},
     benefitTags:["priority_boarding","checked_bag","united_travel_credit_threshold","award_discount_threshold"],verified:true
   },
   united_quest:{
     label:"United Quest Card",kind:"airline",airline:"united",
     currency:"united_miles",annualFee:350,
     earn:{dining:2,grocery:1,online_grocery:1,airfare:4,hotel:2,general:1},
     status:{spendDivisor:20,annualCap:18000,annualBonus:1000,bonusRequiresPriorYearOpen:true},
     benefitTags:["united_travel_benefits"],verified:true
   },
   united_club:{
     label:"United Club Card",kind:"airline",airline:"united",
     currency:"united_miles",annualFee:695,
     earn:{dining:2,grocery:1,online_grocery:1,airfare:5,hotel:2,general:1},
     status:{spendDivisor:15,annualCap:28000,annualBonus:1500,bonusRequiresPriorYearOpen:true},
     benefitTags:["lounge","united_travel_benefits"],verified:true
   },
   aa_executive:{
     label:"Citi / AAdvantage Executive World Legend Mastercard",kind:"airline",airline:"american",
     currency:"aadvantage",annualFee:695,
     earn:{dining:1,grocery:1,online_grocery:1,airfare:4,hotel:1,general:1},
     status:{lpPerEligiblePurchaseDollar:1},
     benefitTags:["lounge","priority_airport"],verified:true
   },
   southwest_priority:{
     label:"Southwest Rapid Rewards Priority Credit Card",kind:"airline",airline:"southwest",
     currency:"southwest_points",annualFee:229,
     earn:{dining:2,grocery:1,online_grocery:1,airfare:4,hotel:1,general:1},
     status:{spendBlock:5000,tqpPerBlock:2500},
     benefitTags:["checked_bag","boarding_benefits","seat_benefits"],verified:true
   },
   hyatt_consumer:{
     label:"World of Hyatt Credit Card",kind:"hotel",hotel:"hyatt",
     currency:"hyatt_points",annualFee:95,
     earn:{dining:2,grocery:1,online_grocery:1,airfare:2,hotel:4,general:1},
     hotelStatus:{automaticTier:"Discoverist",annualNights:5,spendBlock:5000,nightsPerBlock:2},verified:true
   },
   marriott_boundless:{
     label:"Marriott Bonvoy Boundless Credit Card",kind:"hotel",hotel:"marriott",
     currency:"marriott_points",annualFee:95,
     earn:{dining:2,grocery:2,online_grocery:2,airfare:2,hotel:6,general:2},
     hotelStatus:{automaticTier:"Silver Elite",annualNights:15,spendBlock:5000,nightsPerBlock:1,goldAtSpend:35000},
     benefitTags:["free_night_award_35k"],verified:true
   },
   marriott_brilliant:{
     label:"Marriott Bonvoy Brilliant American Express Card",kind:"hotel",hotel:"marriott",
     currency:"marriott_points",annualFee:650,
     earn:{dining:3,grocery:2,online_grocery:2,airfare:3,hotel:6,general:2},
     hotelStatus:{automaticTier:"Platinum Elite",annualNights:25},
     benefitTags:["premium_hotel_benefits","dining_credit","free_night_award_85k","priority_pass"],verified:true
   },
   hilton_no_fee:{
     label:"Hilton Honors American Express Card",kind:"hotel",hotel:"hilton",
     currency:"hilton_points",annualFee:0,
     earn:{dining:5,grocery:5,online_grocery:5,airfare:3,hotel:7,general:3},
     hotelStatus:{automaticTier:"Silver"},verified:true
   },
   hilton_surpass:{
     label:"Hilton Honors American Express Surpass Card",kind:"hotel",hotel:"hilton",
     currency:"hilton_points",annualFee:150,
     earn:{dining:6,grocery:6,online_grocery:6,airfare:3,hotel:12,general:3},
     hotelStatus:{automaticTier:"Gold"},verified:true
   },
   hilton_aspire:{
     label:"Hilton Honors American Express Aspire Card",kind:"hotel",hotel:"hilton",
     currency:"hilton_points",annualFee:550,
     earn:{dining:7,grocery:3,online_grocery:3,airfare:7,hotel:14,general:3},
     hotelStatus:{automaticTier:"Diamond"},
     benefitTags:["premium_hotel_benefits"],verified:true
   }
 }
});

const VALUATIONS=Object.freeze({
 conservative:{amex_mr:.0125,chase_ur:.0125,capital_one_miles:.010,skymiles:.012,united_miles:.012,aadvantage:.013,southwest_points:.013,hyatt_points:.017,marriott_points:.007,hilton_points:.005},
 base:{amex_mr:.020,chase_ur:.020,capital_one_miles:.017,skymiles:.015,united_miles:.017,aadvantage:.018,southwest_points:.014,hyatt_points:.022,marriott_points:.009,hilton_points:.008},
 upper:{amex_mr:.024,chase_ur:.024,capital_one_miles:.020,skymiles:.018,united_miles:.021,aadvantage:.022,southwest_points:.016,hyatt_points:.026,marriott_points:.011,hilton_points:.010}
});
const MODEL=Object.freeze({
 maxPortfolioCards:4,maxNewCardsDefault:2,
 materialTravelValue:400,materialCashImprovement:300,
 minFlightsForStatus:8,minHotelNightsForStatus:8,
 minAirlineShare:.55,minHotelShare:.45,
 unsupportedMaterialSpendShare:.10,statusOpportunityCostLimit:900,
 brilliantMinDirectMarriottNights:10
});

const ALIASES=[
 ["hilton_aspire",["hilton honors american express aspire","hilton aspire"]],
 ["hilton_surpass",["hilton honors american express surpass","hilton surpass"]],
 ["hilton_no_fee",["hilton honors american express card","hilton honors american express"]],
 ["marriott_brilliant",["marriott bonvoy brilliant"]],
 ["marriott_boundless",["marriott bonvoy boundless"]],
 ["delta_reserve",["delta skymiles reserve","delta reserve"]],
 ["delta_platinum",["delta skymiles platinum","delta platinum"]],
 ["united_club",["united club"]],
 ["united_quest",["united quest"]],
 ["united_explorer",["united explorer"]],
 ["aa_executive",["aadvantage executive","american airlines executive","citi / aadvantage executive"]],
 ["southwest_priority",["southwest rapid rewards priority","southwest priority"]],
 ["hyatt_consumer",["world of hyatt credit card","world of hyatt card"]],
 ["amex_platinum",["platinum card from american express","american express platinum","amex platinum"]],
 ["amex_gold",["american express gold","amex gold"]],
 ["chase_reserve",["chase sapphire reserve","sapphire reserve"]],
 ["chase_preferred",["chase sapphire preferred","sapphire preferred"]],
 ["venture_x",["capital one venture x","venture x"]],
 ["venture",["capital one venture rewards","capital one venture"]]
];

function matchCard(v){
 const x=lc(v); if(!x) return null; if(RULES.cards[x]) return x;
 for(const [id,a] of ALIASES) if(a.some(z=>x.includes(z))) return id;
 return null;
}

function normalizeSpend(raw={}){
 const x=raw.spend||raw;
 const online=n(x.online_grocery??raw.online_grocery_spend??raw.onlineGrocerySpend);
 const grocery=n(x.grocery??raw.grocery_spend);
 return {
   dining:n(x.dining??raw.dining_spend),
   grocery:Math.max(0,grocery-online),
   online_grocery:online,
   airfare:n(x.airfare??raw.household_airfare_spend??raw.airfare_spend),
   hotel:n(x.hotel??raw.hotel_spend),
   general:n(x.general??raw.general_spend)
 };
}
function normalizeRouting(raw,sp){
 const src=raw.currentRouting||raw.current_routing||{}, out={};
 for(const c of CATS){
   out[c]=(Array.isArray(src[c])?src[c]:[]).map(r=>({
     card:matchCard(r.card||r.cardId||r.name)||s(r.card||r.cardId||r.name),
     amount:n(r.amount)
   })).filter(r=>r.card&&r.amount>0);
   if(!out[c].length){
     const fallback=matchCard(raw[`card_${c}`]||(c==="general"?raw.card_general:""));
     if(fallback&&sp[c]) out[c]=[{card:fallback,amount:sp[c]}];
   }
 }
 return out;
}
function normalizeProgress(raw={}){
 const p=raw.statusProgress||raw.status_progress||{};
 return {
   delta:{mqd:n(p.delta?.mqd??raw.delta_mqd)},
   united:{pqp:n(p.united?.pqp??raw.united_pqp),pqf:n(p.united?.pqf??raw.united_pqf)},
   american:{loyaltyPoints:n(p.american?.loyaltyPoints??raw.american_loyalty_points)},
   southwest:{tqp:n(p.southwest?.tqp??raw.southwest_tqp),qualifyingFlights:n(p.southwest?.qualifyingFlights??raw.southwest_qualifying_flights)},
   hotel:{qualifyingNights:n(p.hotel?.qualifyingNights??raw.hotel_qualifying_nights??raw.hotel_nights),
          qualifyingStays:n(p.hotel?.qualifyingStays??raw.hotel_qualifying_stays??raw.hotel_stays),
          qualifyingSpend:n(p.hotel?.qualifyingSpend??raw.hotel_qualifying_spend??raw.hotel_spend)}
 };
}
function normalizeRemaining(raw={}){
 const f=raw.remainingYear||raw.remaining_year||raw.futureActivity||raw.future_activity;
 const known=raw.remainingYearKnown===true||!!f;
 const x=f||{}, cs=x.cardSpend||x.statusSpend||{};
 return {
   known,
   cardSpend:Object.fromEntries(CATS.map(c=>[c,n(cs[c])])),
   delta:{mqd:n(x.delta?.mqd)},united:{pqp:n(x.united?.pqp),pqf:n(x.united?.pqf)},
   american:{loyaltyPoints:n(x.american?.loyaltyPoints)},
   southwest:{tqp:n(x.southwest?.tqp),qualifyingFlights:n(x.southwest?.qualifyingFlights)},
   hotel:{qualifyingNights:n(x.hotel?.qualifyingNights),qualifyingStays:n(x.hotel?.qualifyingStays),qualifyingSpend:n(x.hotel?.qualifyingSpend)}
 };
}
function normalizeProfile(raw={}){
 const sp=normalizeSpend(raw), cr=raw.currentCards||raw.primary_cards||raw.cards||[];
 const cards=uniq((Array.isArray(cr)?cr:[cr]).map(v=>matchCard(v)||s(v)).filter(Boolean));
 const air=lc(raw.primaryAirline||raw.primary_airline_eco||raw.primary_airline);
 const hot=lc(raw.primaryHotel||raw.primary_hotel||raw.hotel_program);
 const as=n(raw.primaryAirlineShare??raw.primary_airline_share??raw.airline_concentration);
 const hs=n(raw.primaryHotelShare??raw.primary_hotel_share??raw.hotel_concentration);
 const ar=raw.aspirations||raw.desiredOutcomes||raw.desired_outcomes||[];
 const c=raw.constraints||{}, rf=raw.routeFit||raw.route_fit||{};
 return {
   asOfDate:isoDate(raw.asOfDate)||RULES_AS_OF,
   spend:sp,totalSpend:sum(Object.values(sp)),
   currentCards:cards,currentRouting:normalizeRouting(raw,sp),
   statusProgress:normalizeProgress(raw),remainingYear:normalizeRemaining(raw),
   cardOpenDate:raw.cardOpenDate||raw.card_open_date||{},
   cardTenure:raw.cardTenure||raw.card_tenure||{},
   naturalBenefitValue:raw.naturalBenefitValue||raw.natural_benefit_value||{},
   explicitBenefitUse:raw.explicitBenefitUse||raw.explicit_benefit_use||{},
   bookingMethod:{
     airfare:lc(raw.bookingMethod?.airfare??raw.airfare_booking_method??"direct_airline"),
     hotel:lc(raw.bookingMethod?.hotel??raw.hotel_booking_method??"direct_hotel")
   },
   redemptionPartner:lc(raw.redemptionPartner||raw.redemption_partner),
   marriottBeyondFHR:raw.marriottBeyondFHR===true,
   directMarriottNights:n(raw.directMarriottNights??raw.direct_marriott_nights),
   hotelCardStackingAllowed:raw.hotelCardStackingAllowed===true,
   currencyUtility:{
     amex_mr:clamp(n(raw.currencyUtility?.amex_mr??1),0,1),
     chase_ur:clamp(n(raw.currencyUtility?.chase_ur??1),0,1),
     capital_one_miles:clamp(n(raw.currencyUtility?.capital_one_miles??1),0,1),
     skymiles:clamp(n(raw.currencyUtility?.skymiles??(air==="delta"?1:.45)),0,1),
     united_miles:clamp(n(raw.currencyUtility?.united_miles??(air==="united"?1:.45)),0,1),
     aadvantage:clamp(n(raw.currencyUtility?.aadvantage??(air==="american"?1:.45)),0,1),
     southwest_points:clamp(n(raw.currencyUtility?.southwest_points??(air==="southwest"?1:.45)),0,1),
     hyatt_points:clamp(n(raw.currencyUtility?.hyatt_points??(hot==="hyatt"?1:.45)),0,1),
     marriott_points:clamp(n(raw.currencyUtility?.marriott_points??(hot==="marriott"?1:.45)),0,1),
     hilton_points:clamp(n(raw.currencyUtility?.hilton_points??(hot==="hilton"?1:.45)),0,1)
   },
   travel:{
     annualOneWayFlights:n(raw.annualOneWayFlights??raw.one_way_flights??raw.flights_taken),
     bookingControl:lc(raw.bookingControl||raw.booking_control||"full"),
     typicalTripCashCost:n(raw.typicalTripCashCost??raw.typical_trip_cash_cost)
   },
   airline:{
     primary:air,share:clamp((as>1?as/100:as)||(air?.70:0),0,1),
     reportedStatus:s(raw.currentAirlineStatus||raw.primary_airline_status||raw.airline_status),
     routeFit:Object.fromEntries(Object.entries(rf).map(([k,v])=>[lc(k),clamp(n(v),0,1)])),
     statusUsefulOverride:typeof raw.airlineStatusUseful==="boolean"?raw.airlineStatusUseful:null
   },
   hotel:{
     primary:hot,share:clamp((hs>1?hs/100:hs)||(hot?.60:0),0,1),
     reportedStatus:s(raw.currentHotelStatus||raw.primary_hotel_status||raw.hotel_status),
     premiumStayShare:clamp(n(raw.premiumStayShare??raw.premium_stay_share)>1?n(raw.premiumStayShare??raw.premium_stay_share)/100:n(raw.premiumStayShare??raw.premium_stay_share),0,1)
   },
   aspirations:uniq((Array.isArray(ar)?ar:[ar]).map(lc)),
   constraints:{
     noNewCards:!!c.noNewCards,
     maxNewCards:c.maxNewCards==null?MODEL.maxNewCardsDefault:Math.max(0,n(c.maxNewCards)),
     noHotelConcentration:!!c.noHotelConcentration,
     prohibitedCards:uniq((c.prohibitedCards||[]).map(v=>matchCard(v)||s(v))),
     requiredCards:uniq((c.requiredCards||[]).map(v=>matchCard(v)||s(v)))
   },
   __normalizedV5:true
 };
}

function tierIndex(program,tier){
 const rows=RULES.airlines[program]?.thresholds||RULES.hotels[program]?.thresholds||[];
 return rows.findIndex(r=>lc(r.tier)===lc(tier));
}
function maxTier(program,a,b){ return tierIndex(program,a)>=tierIndex(program,b)?(a||""):(b||""); }
function airlineStatusUsefulness(p){
 if(p.airline.statusUsefulOverride!=null) return !!p.airline.statusUsefulOverride;
 return !!p.airline.primary&&p.airline.share>=MODEL.minAirlineShare&&p.travel.annualOneWayFlights>=MODEL.minFlightsForStatus&&p.travel.bookingControl!=="none";
}
function hotelStatusUsefulness(p){
 return !!p.hotel.primary&&!p.constraints.noHotelConcentration&&p.hotel.share>=MODEL.minHotelShare&&p.statusProgress.hotel.qualifyingNights>=MODEL.minHotelNightsForStatus;
}

function transferRatio(cardId,partner,p,isNew=false){
 const card=RULES.cards[cardId], rule=card?.transferRules?.[partner];
 if(!rule) return 1;
 const open=isoDate(p.cardOpenDate[cardId]);
 if(!isNew&&open&&rule.grandfatherBefore&&before(open,rule.grandfatherBefore)&&rule.grandfatherThrough&&!onOrAfter(p.asOfDate,rule.grandfatherThrough.slice(0,8)+(String(Number(rule.grandfatherThrough.slice(8,10))+1).padStart(2,"0")))){
   return rule.grandfatherRatio??1;
 }
 if(!isNew&&open&&rule.grandfatherBefore&&before(open,rule.grandfatherBefore)&&p.asOfDate<=rule.grandfatherThrough) return rule.grandfatherRatio??1;
 return rule.defaultRatio??1;
}
function currencyValueFactor(p,cardId){
 const card=RULES.cards[cardId];
 if(card?.currency==="chase_ur"&&p.redemptionPartner==="hyatt") return transferRatio(cardId,"hyatt",p,!p.currentCards.includes(cardId));
 return 1;
}

function bookingRate(card,p,cat){
 const m=cat==="airfare"?p.bookingMethod.airfare:cat==="hotel"?p.bookingMethod.hotel:"";
 return card?.bookingEarn?.[cat]?.[m]||null;
}
function baseRate(card,p,cat){
 const b=bookingRate(card,p,cat);
 return b!=null?b:(card?.earn?.[cat]||0);
}
function marginalRate(card,p,cat,assigned){
 const base=baseRate(card,p,cat), cap=card?.caps?.[cat];
 if(cap&&assigned>=cap) return 1;
 return base;
}
function nextBreakpoint(card,cat,assigned){
 const cap=card?.caps?.[cat];
 if(cap&&assigned<cap) return cap-assigned;
 return Infinity;
}
function pointDollarValue(p,id,scenario){
 const c=RULES.cards[id]; if(!c) return 0;
 return (VALUATIONS[scenario][c.currency]||0)*(p.currencyUtility[c.currency]??.5)*currencyValueFactor(p,id);
}
function catValue(p,id,cat,amount,scenario){ const c=RULES.cards[id]; if(!c||amount<=0)return -Infinity; return baseRate(c,p,cat)*pointDollarValue(p,id,scenario); }
function routeCategory(p,portfolio,cat,amount,scenario){
 const assigned=Object.fromEntries(portfolio.map(id=>[id,0])), rows=[];
 let remaining=amount;
 while(remaining>0){
   let best=null,bestV=-Infinity;
   for(const id of portfolio){
     const c=RULES.cards[id]; if(!c) continue;
     const v=marginalRate(c,p,cat,assigned[id])*pointDollarValue(p,id,scenario);
     if(v>bestV+1e-12){bestV=v;best=id;}
   }
   if(!best) break;
   let chunk=Math.min(remaining,nextBreakpoint(RULES.cards[best],cat,assigned[best]));
   if(!Number.isFinite(chunk)||chunk<=0) chunk=remaining;
   rows.push({card:best,amount:round(chunk)});
   assigned[best]+=chunk; remaining-=chunk;
 }
 const merged={}; for(const r of rows) merged[r.card]=(merged[r.card]||0)+r.amount;
 return Object.entries(merged).map(([card,amount])=>({card,amount:round(amount)}));
}
function routeAnnual(p,portfolio,scenario){
 return Object.fromEntries(CATS.map(cat=>[cat,routeCategory(p,portfolio,cat,p.spend[cat]||0,scenario)]));
}
function pointsFromRouting(p,routing,scenario){
 const byCurrency={};
 for(const cat of CATS){
   const assigned={};
   for(const row of routing[cat]||[]){
     const card=RULES.cards[row.card]; if(!card) continue;
     assigned[row.card]=assigned[row.card]||0;
     let remaining=row.amount, points=0;
     while(remaining>0){
       const rate=marginalRate(card,p,cat,assigned[row.card]);
       let chunk=Math.min(remaining,nextBreakpoint(card,cat,assigned[row.card]));
       if(!Number.isFinite(chunk)||chunk<=0) chunk=remaining;
       points+=chunk*rate; assigned[row.card]+=chunk; remaining-=chunk;
     }
     byCurrency[card.currency]=(byCurrency[card.currency]||0)+points;
   }
 }
 let gross=0;
 for(const [cur,pts] of Object.entries(byCurrency)) gross+=pts*(VALUATIONS[scenario][cur]||0)*(p.currencyUtility[cur]??.5);
 return {pointsByCurrency:Object.fromEntries(Object.entries(byCurrency).map(([k,v])=>[k,round(v)])),grossTravelValue:round(gross)};
}
function naturalBenefitValue(p,portfolio){ return sum(portfolio.map(id=>n(p.naturalBenefitValue[id]))); }
function economics(p,routing,portfolio,scenario){
 const q=pointsFromRouting(p,routing,scenario), fees=sum(portfolio.map(id=>RULES.cards[id]?.annualFee||0));
 const benefits=naturalBenefitValue(p,portfolio);
 return { ...q,annualFees:fees,naturalBenefitValue:benefits,netEconomicValue:round(q.grossTravelValue+benefits-fees),
          unverifiedCards:portfolio.filter(id=>RULES.cards[id]&&!RULES.cards[id].verified) };
}
function visibleBenefits(portfolio){
 const out=[];
 for(const id of portfolio){
   const c=RULES.cards[id]; if(!c) continue;
   for(const b of c.benefitTags||[]) out.push({cardId:id,benefit:b});
   if(c.hotelStatus?.automaticTier) out.push({cardId:id,benefit:"automatic_hotel_status",detail:c.hotelStatus.automaticTier});
   if(c.airline&&c.status) out.push({cardId:id,benefit:"status_earning_mechanism",detail:c.airline});
 }
 return out;
}
function explicitUse(p,id,benefit){
 return p.explicitBenefitUse?.[id]?.[benefit]===true||p.explicitBenefitUse?.[benefit]===true||n(p.naturalBenefitValue[id])>0;
}
function recommendationCredit(p,portfolio){
 const credit={lounge:0,premiumHotel:0,priorityAirport:0,upgradePriority:0};
 for(const id of portfolio){
   const c=RULES.cards[id]; if(!c) continue;
   const isNew=!p.currentCards.includes(id);
   const tags=c.benefitTags||[];
   if(tags.includes("lounge")&&(!isNew||explicitUse(p,id,"lounge"))) credit.lounge=1;
   if((tags.includes("premium_hotel_booking")||tags.includes("premium_hotel_benefits"))&&(!isNew||explicitUse(p,id,"premium_hotel"))) credit.premiumHotel=1;
   if(tags.includes("priority_airport")&&(!isNew||explicitUse(p,id,"priority_airport"))) credit.priorityAirport=1;
   if(tags.includes("upgrade_priority")&&(!isNew||explicitUse(p,id,"upgrade_priority"))) credit.upgradePriority=1;
 }
 return credit;
}

function coBrandHasJob(p,id){
 const c=RULES.cards[id]; if(!c||c.kind==="flex") return true;
 if(p.currentCards.includes(id)) return true;
 if(n(p.naturalBenefitValue[id])>0) return true;
 if(c.airline) return c.airline===p.airline.primary&&airlineStatusUsefulness(p);
 if(c.hotel) return c.hotel===p.hotel.primary&&hotelStatusUsefulness(p);
 return false;
}
function brilliantAllowed(p,set){
 if(!set.includes("marriott_brilliant")) return true;
 if(p.currentCards.includes("marriott_brilliant")) return true;
 if(!set.includes("amex_platinum")) return true;
 return p.hotel.primary==="marriott"&&p.hotel.share>=.55&&(p.marriottBeyondFHR||p.directMarriottNights>=MODEL.brilliantMinDirectMarriottNights);
}
function badHotelStack(p,set){
 if(p.hotelCardStackingAllowed) return false;
 const m={};
 for(const id of set){const h=RULES.cards[id]?.hotel;if(h)(m[h]||=[]).push(id);}
 return Object.values(m).some(a=>a.length>1);
}
function protectedCurrentIds(p){
 return p.currentCards.filter(id=>!RULES.cards[id]||RULES.cards[id]?.verified!==true);
}
function relevantCards(p){
 const flex=["amex_gold","amex_platinum","chase_preferred","chase_reserve","venture","venture_x"];
 const air={delta:["delta_platinum","delta_reserve"],united:["united_explorer","united_quest","united_club"],american:["aa_executive"],southwest:["southwest_priority"]}[p.airline.primary]||[];
 const hotel={hyatt:["hyatt_consumer"],marriott:["marriott_boundless","marriott_brilliant"],hilton:["hilton_no_fee","hilton_surpass","hilton_aspire"]}[p.hotel.primary]||[];
 return uniq([...p.currentCards,...p.constraints.requiredCards,...flex,...air,...hotel]).filter(id=>!p.constraints.prohibitedCards.includes(id));
}
function combinations(a,max){
 const out=[];(function go(i,pick){if(pick.length<=max)out.push(pick.slice());if(pick.length===max)return;for(let j=i;j<a.length;j++){pick.push(a[j]);go(j+1,pick);pick.pop();}})(0,[]);
 return out;
}
function candidatePortfolios(p){
 const relevant=relevantCards(p), protectedIds=protectedCurrentIds(p), out=[];
 const max=Math.min(MODEL.maxPortfolioCards,relevant.length);
 for(const set of combinations(relevant,max)){
   if(!set.length&&p.totalSpend) continue;
   if(p.constraints.requiredCards.some(id=>!set.includes(id))) continue;
   if(protectedIds.some(id=>!set.includes(id))) continue;
   const adds=set.filter(id=>!p.currentCards.includes(id));
   if((p.constraints.noNewCards&&adds.length)||adds.length>p.constraints.maxNewCards) continue;
   if(adds.some(id=>!coBrandHasJob(p,id))) continue;
   if(badHotelStack(p,set)||!brilliantAllowed(p,set)) continue;
   out.push(set);
 }
 const currentSorted=JSON.stringify(p.currentCards.slice().sort());
 if(!out.some(x=>JSON.stringify(x.slice().sort())===currentSorted)) out.push(p.currentCards.slice());
 return out;
}

function remBase(p,annual){
 const out={};
 for(const cat of CATS){
   const rem=p.remainingYear.cardSpend[cat], total=p.spend[cat];
   if(!rem||!total){out[cat]=[];continue;}
   out[cat]=(annual[cat]||[]).map(x=>({card:x.card,amount:round(rem*x.amount/total)})).filter(x=>x.amount>0);
 }
 return out;
}
function cardTotals(r){const o={};for(const c of CATS)for(const x of r[c]||[])o[x.card]=(o[x.card]||0)+x.amount;return o;}
function curMetric(p,a){const x=p.statusProgress[a]||{};return a==="delta"?x.mqd:a==="united"?x.pqp:a==="american"?x.loyaltyPoints:a==="southwest"?x.tqp:0;}
function remMetric(p,a){const x=p.remainingYear[a]||{};return a==="delta"?x.mqd:a==="united"?x.pqp:a==="american"?x.loyaltyPoints:a==="southwest"?x.tqp:0;}
function airTier(a,metric,flights){
 let t="";for(const x of RULES.airlines[a]?.thresholds||[])if(metric>=x.amount)t=x.tier;
 if(a==="southwest")for(const x of RULES.airlines[a]?.flightThresholds||[])if(flights>=x.flights)t=x.tier;
 return t;
}
function airProjection(p,a,remRouting,portfolio){
 let metric=curMetric(p,a)+remMetric(p,a);
 let flights=a==="southwest"?p.statusProgress.southwest.qualifyingFlights+p.remainingYear.southwest.qualifyingFlights:0;
 const totals=cardTotals(remRouting);
 for(const id of portfolio){
   const c=RULES.cards[id],sp=totals[id]||0;if(!c||c.airline!==a||!c.status)continue;
   if(a==="delta"){if(!p.currentCards.includes(id))metric+=c.status.headstart||0;metric+=sp/c.status.spendDivisor;}
   else if(a==="united"){metric+=Math.min(c.status.annualCap||Infinity,sp/c.status.spendDivisor);if(p.cardTenure[id]?.futureAnnualBonusEligible===true)metric+=c.status.annualBonus||0;}
   else if(a==="american")metric+=sp*(c.status.lpPerEligiblePurchaseDollar||0);
   else if(a==="southwest")metric+=Math.floor(sp/c.status.spendBlock)*c.status.tqpPerBlock;
 }
 return {metric:round(metric),qualifyingFlights:flights,tier:airTier(a,metric,flights)};
}
function nextAirTarget(p,a,organic){
 const rules=RULES.airlines[a], ri=tierIndex(a,p.airline.reportedStatus), oi=tierIndex(a,organic.tier);
 if(ri>=0&&oi<ri) return {target:rules.thresholds[ri],type:"retain"};
 const target=rules.thresholds.find((x,i)=>i>Math.max(ri,oi));
 return target?{target,type:"upgrade"}:null;
}
function statusNeed(p,a,id,organic){
 const c=RULES.cards[id],plan=nextAirTarget(p,a,organic);if(!c?.status||!plan)return null;
 if(a==="southwest"){const ft=RULES.airlines[a].flightThresholds.find(x=>x.tier===plan.target.tier);if(ft&&organic.qualifyingFlights>=ft.flights)return{spend:0,...plan,achievedOrganically:true};}
 const gap=Math.max(0,plan.target.amount-organic.metric);if(!gap)return{spend:0,...plan,achievedOrganically:true};
 let sp=Infinity;
 if(a==="delta"||a==="united")sp=gap*c.status.spendDivisor;
 else if(a==="american")sp=gap/(c.status.lpPerEligiblePurchaseDollar||1);
 else if(a==="southwest")sp=Math.ceil(gap/c.status.tqpPerBlock)*c.status.spendBlock;
 return {spend:sp,...plan,achievedOrganically:false};
}
function shift(p,r,target,need,scenario){
 const out=clone(r), choices=[];
 for(const cat of CATS){
   const avail=sum((out[cat]||[]).map(x=>x.amount));if(!avail)continue;
   const normal=(out[cat]||[]).sort((a,b)=>b.amount-a.amount)[0]?.card;
   const baseAmt=p.spend[cat]||avail;
   choices.push({cat,avail,normal,loss:Math.max(0,catValue(p,normal,cat,baseAmt,scenario)-catValue(p,target,cat,baseAmt,scenario))});
 }
 choices.sort((a,b)=>a.loss-b.loss);
 let left=need,cost=0,moved=0;
 for(const q of choices){
   if(left<=0)break;
   const take=Math.min(q.avail,left),rows=out[q.cat];let x=take;
   for(const row of rows){if(row.card===target)continue;const z=Math.min(row.amount,x);row.amount=round(row.amount-z);x-=z;if(x<=0)break;}
   const t=rows.find(r=>r.card===target);if(t)t.amount=round(t.amount+take);else rows.push({card:target,amount:round(take)});
   out[q.cat]=rows.filter(r=>r.amount>0);left-=take;moved+=take;cost+=take*q.loss;
 }
 return left>0?null:{routing:out,shifted:round(moved),opportunityCost:round(cost)};
}
function hotelProjection(p,portfolio,rr){
 const pr=p.hotel.primary;if(!pr)return{projectedTier:"",effectiveTier:p.hotel.reportedStatus||"",qualifyingNights:p.statusProgress.hotel.qualifyingNights};
 let nights=p.statusProgress.hotel.qualifyingNights+p.remainingYear.hotel.qualifyingNights;
 let stays=p.statusProgress.hotel.qualifyingStays+p.remainingYear.hotel.qualifyingStays;
 let qSpend=p.statusProgress.hotel.qualifyingSpend+p.remainingYear.hotel.qualifyingSpend;
 let auto="";const totals=cardTotals(rr);
 for(const id of portfolio){
   const c=RULES.cards[id],h=c?.hotelStatus;if(!h||c.hotel!==pr)continue;
   if(!p.currentCards.includes(id))nights+=h.annualNights||0;
   if(h.spendBlock&&h.nightsPerBlock)nights+=Math.floor((totals[id]||0)/h.spendBlock)*h.nightsPerBlock;
   if(h.automaticTier)auto=maxTier(pr,auto,h.automaticTier);
   if(h.goldAtSpend&&(totals[id]||0)>=h.goldAtSpend)auto=maxTier(pr,auto,"Gold Elite");
 }
 let earned="";
 if(pr==="hilton"){
   for(const x of RULES.hotels.hilton.thresholds)if(nights>=x.nights||stays>=x.stays||qSpend>=x.spend)earned=x.tier;
   const d=RULES.hotels.hilton.diamondReserve;if((nights>=d.nights||stays>=d.stays)&&qSpend>=d.spend)earned=d.tier;
 }else for(const x of RULES.hotels[pr].thresholds)if(nights>=x.nights)earned=x.tier;
 const projectedTier=maxTier(pr,earned,auto);
 return {projectedTier,effectiveTier:maxTier(pr,p.hotel.reportedStatus,projectedTier),qualifyingNights:nights};
}
function hotelNeed(p,portfolio,id,organic){
 const pr=p.hotel.primary,c=RULES.cards[id],h=c?.hotelStatus;
 if(!pr||!h||c.hotel!==pr||!hotelStatusUsefulness(p)||pr==="hilton"||!h.spendBlock)return null;
 const ri=tierIndex(pr,p.hotel.reportedStatus),oi=tierIndex(pr,organic.projectedTier),rules=RULES.hotels[pr].thresholds;
 let target,type;
 if(ri>=0&&oi<ri){target=rules[ri];type="retain";}else{target=rules.find((x,i)=>i>Math.max(ri,oi));type="upgrade";}
 if(!target)return null;
 const gap=Math.max(0,target.nights-organic.qualifyingNights);
 return gap?{spend:Math.ceil(gap/h.nightsPerBlock)*h.spendBlock,target,type}:{spend:0,target,type,achievedOrganically:true};
}
function statusPlan(p,portfolio,annual,scenario){
 const base=p.remainingYear.known?remBase(p,annual):Object.fromEntries(CATS.map(c=>[c,[]]));
 let rr=clone(base),airlineTarget=null,hotelTarget=null,cost=0,a=p.airline.primary;
 if(p.remainingYear.known&&airlineStatusUsefulness(p)&&a){
   const organic=airProjection(p,a,base,portfolio);let best=null;
   for(const id of portfolio.filter(id=>RULES.cards[id]?.airline===a)){
     const need=statusNeed(p,a,id,organic);if(!need||need.achievedOrganically||need.spend<=0)continue;
     const sh=shift(p,rr,id,need.spend,scenario);if(!sh||sh.opportunityCost>MODEL.statusOpportunityCostLimit)continue;
     const pr=airProjection(p,a,sh.routing,portfolio);if(tierIndex(a,pr.tier)<tierIndex(a,need.target.tier))continue;
     if(!best||sh.opportunityCost<best.sh.opportunityCost)best={id,need,sh,pr};
   }
   if(best){rr=best.sh.routing;cost+=best.sh.opportunityCost;airlineTarget={airline:a,tier:best.need.target.tier,type:best.need.type,cardId:best.id,spendDirected:best.sh.shifted,projectedTier:best.pr.tier};}
 }
 if(p.remainingYear.known&&hotelStatusUsefulness(p)&&p.hotel.primary){
   const organic=hotelProjection(p,portfolio,base);let best=null;
   for(const id of portfolio.filter(id=>RULES.cards[id]?.hotel===p.hotel.primary&&RULES.cards[id]?.hotelStatus?.spendBlock)){
     const need=hotelNeed(p,portfolio,id,organic);if(!need||need.achievedOrganically||need.spend<=0)continue;
     const sh=shift(p,rr,id,need.spend,scenario);if(!sh||sh.opportunityCost>MODEL.statusOpportunityCostLimit)continue;
     const pr=hotelProjection(p,portfolio,sh.routing);if(tierIndex(p.hotel.primary,pr.projectedTier)<tierIndex(p.hotel.primary,need.target.tier))continue;
     if(!best||sh.opportunityCost<best.sh.opportunityCost)best={id,need,sh,pr};
   }
   if(best){rr=best.sh.routing;cost+=best.sh.opportunityCost;hotelTarget={program:p.hotel.primary,tier:best.need.target.tier,type:best.need.type,cardId:best.id,spendDirected:best.sh.shifted,projectedTier:best.pr.projectedTier};}
 }
 return {routing:rr,airlineTarget,hotelTarget,opportunityCost:round(cost)};
}

function unsupportedShare(p){
 let x=0;for(const c of CATS)for(const r of p.currentRouting[c]||[])if(!RULES.cards[r.card])x+=r.amount;
 return p.totalSpend?x/p.totalSpend:0;
}
function dataQuality(p,eco){
 const issues=[],u=unsupportedShare(p);
 if(u>=MODEL.unsupportedMaterialSpendShare)issues.push({code:"unsupported_material_current_spend",severity:"blocking"});
 else if(u>0)issues.push({code:"unsupported_current_spend",severity:"high"});
 for(const id of eco.unverifiedCards||[])issues.push({code:"rule_verification_pending",severity:"medium",detail:id});
 if(airlineStatusUsefulness(p)&&!p.remainingYear.known)issues.push({code:"remaining_year_activity_missing",severity:"medium"});
 return {issues,precisionSuppressed:issues.some(x=>x.severity==="blocking")};
}
function actions(p,portfolio){
 const out=[];
 for(const id of p.currentCards){
   const r=RULES.cards[id];
   out.push({cardId:id,action:!r||!r.verified?"manual_review":portfolio.includes(id)?"keep":"remove_or_downgrade_after_review"});
 }
 for(const id of portfolio)if(!p.currentCards.includes(id))out.push({cardId:id,action:"add"});
 return out;
}
function complexity(p,portfolio){
 const currencies=uniq(portfolio.map(id=>RULES.cards[id]?.currency).filter(Boolean)),newCards=portfolio.filter(id=>!p.currentCards.includes(id));
 return {cardCount:portfolio.length,newCardCount:newCards.length,currencyCount:currencies.length,burden:round(portfolio.length*1.25+currencies.length*.75+newCards.length,2)};
}
function airlineStrategy(p){return p.airline.primary?{type:"keep",airline:p.airline.primary,statusUseful:airlineStatusUsefulness(p),routeFitEstablished:p.airline.routeFit[p.airline.primary]!=null}:{type:"none",airline:"",statusUseful:false,routeFitEstablished:false};}
function hotelStrategy(p,credit){const a=hotelStatusUsefulness(p),b=credit.premiumHotel>0;return{type:a&&b?"mixed":a?"chain_loyalty_status":b?"premium_booking":"none",program:p.hotel.primary||""};}
function strategyRecord(p,portfolio,scenario="base"){
 const annual=routeAnnual(p,portfolio,scenario),eco=economics(p,annual,portfolio,scenario),plan=statusPlan(p,portfolio,annual,scenario);
 const air=p.airline.primary&&p.remainingYear.known?airProjection(p,p.airline.primary,plan.routing,portfolio):{tier:""};
 const hot=p.remainingYear.known?hotelProjection(p,portfolio,plan.routing):{projectedTier:"",effectiveTier:p.hotel.reportedStatus||""};
 const credit=recommendationCredit(p,portfolio),effectiveAir=p.airline.primary?maxTier(p.airline.primary,p.airline.reportedStatus,air.tier):"";
 const ri=p.airline.primary?tierIndex(p.airline.primary,p.airline.reportedStatus):-1,pi=p.airline.primary?tierIndex(p.airline.primary,air.tier):-1;
 const rec={
   profileRef:p,
   id:portfolio.slice().sort().join("+")||"no_cards",portfolio,annualRouting:annual,remainingYearRouting:plan.routing,economics:eco,
   strategy:{airlineStrategy:airlineStrategy(p),hotelStrategy:hotelStrategy(p,credit),airlineStatusTarget:plan.airlineTarget,hotelStatusTarget:plan.hotelTarget},
   outcomes:{
     travelCapacity:{annualTravelValue:eco.grossTravelValue,pointsByCurrency:eco.pointsByCurrency},
     flightQuality:{effectiveStatus:effectiveAir},
     hotelExperience:{effectiveStatus:hot.effectiveTier||""},
     reliability:{preservesCurrentAirlineStatus:ri<0||pi>=ri},
     cashEfficiency:{netEconomicValue:eco.netEconomicValue},
     complexity:complexity(p,portfolio)
   },
   visibleBenefits:visibleBenefits(portfolio),recommendationCredit:credit,actions:actions(p,portfolio)
 };
 rec.quality=dataQuality(p,eco);return rec;
}
function currentRecord(p,scenario="base"){
 const eco=economics(p,p.currentRouting,p.currentCards,scenario),rem=p.remainingYear.known?remBase(p,p.currentRouting):Object.fromEntries(CATS.map(c=>[c,[]]));
 const air=p.airline.primary&&p.remainingYear.known?airProjection(p,p.airline.primary,rem,p.currentCards):{tier:""};
 const hot=p.remainingYear.known?hotelProjection(p,p.currentCards,rem):{effectiveTier:p.hotel.reportedStatus||""};
 const credit=recommendationCredit(p,p.currentCards),ri=p.airline.primary?tierIndex(p.airline.primary,p.airline.reportedStatus):-1,pi=p.airline.primary?tierIndex(p.airline.primary,air.tier):-1;
 const rec={
   profileRef:p,
   id:"current",portfolio:p.currentCards,annualRouting:clone(p.currentRouting),remainingYearRouting:rem,economics:eco,
   strategy:{airlineStrategy:airlineStrategy(p),hotelStrategy:hotelStrategy(p,credit),airlineStatusTarget:null,hotelStatusTarget:null},
   outcomes:{
     travelCapacity:{annualTravelValue:eco.grossTravelValue,pointsByCurrency:eco.pointsByCurrency},
     flightQuality:{effectiveStatus:p.airline.primary?maxTier(p.airline.primary,p.airline.reportedStatus,air.tier):""},
     hotelExperience:{effectiveStatus:hot.effectiveTier||""},
     reliability:{preservesCurrentAirlineStatus:ri<0||pi>=ri},
     cashEfficiency:{netEconomicValue:eco.netEconomicValue},
     complexity:complexity(p,p.currentCards)
   },
   visibleBenefits:visibleBenefits(p.currentCards),recommendationCredit:credit,actions:actions(p,p.currentCards)
 };
 rec.quality=dataQuality(p,eco);return rec;
}
function materialCurrentBenefitTags(p){
 const tags=new Set();
 for(const id of p.currentCards){
   const used=n(p.naturalBenefitValue[id])>0||Object.values(p.explicitBenefitUse?.[id]||{}).some(Boolean);
   if(!used) continue;
   for(const tag of RULES.cards[id]?.benefitTags||[]) tags.add(tag);
 }
 return tags;
}
function missingMaterialBenefitTags(p,record){
 const required=materialCurrentBenefitTags(p);
 const present=new Set((record.visibleBenefits||[]).map(x=>x.benefit));
 return [...required].filter(tag=>!present.has(tag));
}
function compare(a,b){
 const imp=[],reg=[];
 if(a.outcomes.travelCapacity.annualTravelValue-b.outcomes.travelCapacity.annualTravelValue>=MODEL.materialTravelValue)imp.push("travelCapacity");
 if(b.outcomes.travelCapacity.annualTravelValue-a.outcomes.travelCapacity.annualTravelValue>=MODEL.materialTravelValue)reg.push("travelCapacity");
 if(a.economics.netEconomicValue-b.economics.netEconomicValue>=MODEL.materialCashImprovement)imp.push("cashEfficiency");
 if(b.economics.netEconomicValue-a.economics.netEconomicValue>=MODEL.materialCashImprovement)reg.push("cashEfficiency");
 const air=a.strategy.airlineStrategy.airline||b.strategy.airlineStrategy.airline;
 if(air){
   const ai=tierIndex(air,a.outcomes.flightQuality.effectiveStatus),bi=tierIndex(air,b.outcomes.flightQuality.effectiveStatus);
   if(ai>bi)imp.push("flightQuality");if(bi>ai)reg.push("flightQuality");
   if(a.outcomes.reliability.preservesCurrentAirlineStatus&&!b.outcomes.reliability.preservesCurrentAirlineStatus)imp.push("reliability");
   if(b.outcomes.reliability.preservesCurrentAirlineStatus&&!a.outcomes.reliability.preservesCurrentAirlineStatus)reg.push("reliability");
 }
 const h=a.strategy.hotelStrategy.program||b.strategy.hotelStrategy.program;
 if(h){const ai=tierIndex(h,a.outcomes.hotelExperience.effectiveStatus),bi=tierIndex(h,b.outcomes.hotelExperience.effectiveStatus);if(ai>bi)imp.push("hotelExperience");if(bi>ai)reg.push("hotelExperience");}
 if(a.recommendationCredit.premiumHotel>b.recommendationCredit.premiumHotel)imp.push("hotelExperience");
 if(b.recommendationCredit.premiumHotel>a.recommendationCredit.premiumHotel)reg.push("hotelExperience");
 const aa=a.recommendationCredit.lounge+a.recommendationCredit.priorityAirport+a.recommendationCredit.upgradePriority;
 const bb=b.recommendationCredit.lounge+b.recommendationCredit.priorityAirport+b.recommendationCredit.upgradePriority;
 if(aa>bb)imp.push("airportExperience");if(bb>aa)reg.push("airportExperience");
 if(b.outcomes.complexity.burden-a.outcomes.complexity.burden>=2)imp.push("complexity");
 if(a.outcomes.complexity.burden-b.outcomes.complexity.burden>=2)reg.push("complexity");
 if(a.profileRef){
   if(missingMaterialBenefitTags(a.profileRef,a).length<missingMaterialBenefitTags(a.profileRef,b).length)imp.push("benefitContinuity");
   if(missingMaterialBenefitTags(a.profileRef,a).length>missingMaterialBenefitTags(a.profileRef,b).length)reg.push("benefitContinuity");
 }
 return {improvements:uniq(imp),regressions:uniq(reg)};
}
function dominates(a,b){const c=compare(a,b);return c.improvements.length>0&&c.regressions.length===0;}
function paretoSurvivors(records){return records.filter((r,i)=>!records.some((o,j)=>i!==j&&dominates(o,r)));}
function choose(p,records,current){
 if(current.quality.precisionSuppressed)return current;
 const hardProtected=new Set(["flightQuality","hotelExperience","reliability","benefitContinuity"]);
 const candidates=paretoSurvivors(records).map(r=>({r,c:compare(r,current)})).filter(x=>x.c.improvements.length);
 const viable=candidates.filter(x=>!x.c.regressions.some(k=>hardProtected.has(k))).filter(x=>{
   const onlyPoints=x.c.improvements.every(k=>k==="travelCapacity"||k==="cashEfficiency"||k==="complexity");
   if(onlyPoints&&x.r.outcomes.complexity.newCardCount>current.outcomes.complexity.newCardCount&&x.r.economics.netEconomicValue<current.economics.netEconomicValue)return false;
   if(x.c.improvements.every(k=>k==="complexity") &&
      (x.r.economics.netEconomicValue<current.economics.netEconomicValue || x.r.economics.grossTravelValue<current.economics.grossTravelValue)) return false;
   return true;
 });
 viable.sort((x,y)=>{
   const xNon=x.c.improvements.filter(k=>!["cashEfficiency","complexity"].includes(k)).length;
   const yNon=y.c.improvements.filter(k=>!["cashEfficiency","complexity"].includes(k)).length;
   if(yNon!==xNon)return yNon-xNon;
   if(x.r.outcomes.complexity.burden!==y.r.outcomes.complexity.burden)return x.r.outcomes.complexity.burden-y.r.outcomes.complexity.burden;
   return y.r.economics.netEconomicValue-x.r.economics.netEconomicValue;
 });
 return viable[0]?.r||current;
}
function selectForScenario(p,scenario){
 const current=currentRecord(p,scenario),records=candidatePortfolios(p).map(set=>strategyRecord(p,set,scenario)),recommended=choose(p,records,current);
 return {current,records,recommended,pareto:paretoSurvivors(records)};
}
function presentationOrder(p){
 const base=["travelCapacity","flightQuality","airportExperience","hotelExperience","reliability","cashEfficiency","complexity"];
 const map={"travel more":["travelCapacity","cashEfficiency"],"fly & airport better":["flightQuality","airportExperience","reliability"],"stay better":["hotelExperience"],"get more travel from what i already spend":["travelCapacity","cashEfficiency"],"show me everything":[]};
 const first=[];for(const a of p.aspirations)for(const k of map[a]||[])if(!first.includes(k))first.push(k);
 return [...first,...base.filter(k=>!first.includes(k))];
}
function recommendationFingerprint(x){
 const r=x.recommended||x;
 return JSON.stringify({portfolio:r.portfolio.slice().sort(),annualRouting:r.annualRouting,remainingYearRouting:r.remainingYearRouting,airlineStatusTarget:r.strategy.airlineStatusTarget,hotelStatusTarget:r.strategy.hotelStatusTarget});
}
function analyze(raw){
 const p=raw?.__normalizedV5?raw:normalizeProfile(raw),c=selectForScenario(p,"conservative"),b=selectForScenario(p,"base"),u=selectForScenario(p,"upper");
 const fps=[c,b,u].map(x=>recommendationFingerprint(x.recommended));
 return {
   engineVersion:ENGINE_VERSION,rulesAsOf:RULES_AS_OF,profile:p,current:b.current,recommended:b.recommended,
   candidatesEvaluated:b.records.length,visibleBenefits:b.recommended.visibleBenefits,
   presentation:{aspirations:p.aspirations,order:presentationOrder(p)},
   sensitivity:{strategyStable:new Set(fps).size===1,recommendationIds:{conservative:c.recommended.id,base:b.recommended.id,upper:u.recommended.id}},
   integrity:{
     aspirationsUsedInRecommendationSelection:false,
     benefitVisibilitySeparatedFromRecommendationCredit:true,
     annualAndRemainingYearRoutingSeparated:true,
     reportedStatusAuthoritative:true,
     unverifiedCurrentCardsProtected:true,
     coBrandAdditionsRequireJob:true,
     bookingMethodAware:true,
     transferRatioEffectiveDated:true,
     cappedCategorySplitting:true
   }
 };
}

return Object.freeze({
 ENGINE_VERSION,RULES_AS_OF,RULES,VALUATIONS,MODEL,
 matchCard,normalizeProfile,transferRatio,airlineStatusUsefulness,hotelStatusUsefulness,
 visibleBenefits,recommendationCredit,candidatePortfolios,routeAnnual,
 airlineProjection:airProjection,hotelProjection,strategyRecord,currentRecord,
 materialComparison:compare,paretoSurvivors,selectForScenario,analyze,recommendationFingerprint
});
});
