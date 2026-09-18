/** Quiet Premium V5 validation harness — 5.0-alpha.12 */
"use strict";
const E=require("./qp_sim_v5.js");
let pass=0,fail=0;const failures=[];
function assert(name,cond,detail=""){if(cond){pass++;console.log("PASS "+name);}else{fail++;failures.push({name,detail});console.error("FAIL "+name+(detail?" — "+detail:""));}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function emptyRouting(){return Object.fromEntries(["dining","grocery","online_grocery","gas_ev","online_retail","vacation_home","airfare","hotel","general"].map(x=>[x,[]]));}
function base(overrides={}){return{
 asOfDate:"2026-09-17",
 spend:{dining:20000,grocery:15000,online_grocery:0,gas_ev:5000,online_retail:5000,vacation_home:0,airfare:12000,hotel:10000,general:83000},
 currentCards:["amex_platinum"],
 currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],gas_ev:[{card:"amex_platinum",amount:5000}],online_retail:[{card:"amex_platinum",amount:5000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:83000}]},
 remainingYear:{cardSpend:{dining:8000,grocery:6000,gas_ev:2000,online_retail:2000,airfare:5000,hotel:4000,general:36000},delta:{mqd:1500},hotel:{qualifyingNights:3}},
 primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,currentAirlineStatus:"Gold Medallion",
 statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},primaryHotel:"marriott",primaryHotelShare:.35,currentHotelStatus:"Gold Elite",premiumStayShare:.5,
 currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95,hyatt_points:1},legacyNaturalBenefitValue:{amex_platinum:700},
 bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"},constraints:{maxNewCards:2},aspirations:["travel more"],...overrides};}

assert("engine is alpha.12",E.ENGINE_VERSION==="5.0-alpha.12");

{
 const a=E.analyze(base({aspirations:["travel more"]}));
 const b=E.analyze(base({aspirations:["stay better"]}));
 assert("aspirations do not change recommendation",E.recommendationFingerprint(a)===E.recommendationFingerprint(b));
 assert("aspirations change presentation order",!same(a.presentation.order,b.presentation.order));
 assert("opportunity set is aspiration-invariant",same(a.allMaterialOpportunities,b.allMaterialOpportunities));
}

{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{}}));
 const r=E.strategyRecord(p,["venture_x"],"base");
 assert("Venture X lounge stays visible",r.visibleBenefits.some(x=>x.benefit==="lounge"));
 assert("unused lounge gets zero recommendation credit",r.recommendationCredit.lounge===0);
}

{
 const p=E.normalizeProfile(base({
  primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,currentAirlineStatus:"",
  statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{general:3000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},
  primaryHotel:"",primaryHotelShare:0,currentCards:["southwest_priority","venture"],
  currentRouting:{...emptyRouting(),airfare:[{card:"southwest_priority",amount:12000}],general:[{card:"venture",amount:138000}]},
  legacyNaturalBenefitValue:{southwest_priority:229,venture:0}
 }));
 assert("legacy valued Southwest card is protected",E.legacyBenefitProtectionIds(p).includes("southwest_priority"));
 assert("candidate portfolios cannot silently drop protected Southwest card",E.candidatePortfolios(p).every(x=>x.includes("southwest_priority")));
 const r=E.analyze(p);
 assert("recommended wallet retains protected Southwest card",r.recommended.portfolio.includes("southwest_priority"),r.recommended.id);
 assert("missing benefit detail is surfaced",r.current.quality.issues.some(x=>x.code==="legacy_benefit_detail_missing"&&x.detail==="southwest_priority"));
}

{
 const p=E.normalizeProfile(base({
  primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,
  statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:3000},southwest:{qualifyingFlights:1},hotel:{qualifyingNights:0}},
  primaryHotel:"",primaryHotelShare:0,currentCards:["southwest_priority","amex_platinum"],currentRouting:{...emptyRouting(),airfare:[{card:"southwest_priority",amount:12000}],general:[{card:"amex_platinum",amount:138000}]},
  legacyNaturalBenefitValue:{southwest_priority:229},benefitValueByType:{lounge:300,premium_hotel_booking:500},cardUniqueBenefitValue:{},explicitBenefitUse:{amex_platinum:{lounge_access:true,premium_hotel:true}}
 }));
 const ledger=E.benefitLedger(p,["southwest_priority","amex_platinum"]);
 assert("detail on Platinum does not remove Southwest protection",E.legacyBenefitProtectionIds(p).includes("southwest_priority"));
 assert("legacy Southwest value survives partial wallet detail",ledger.unresolvedLegacyValue===229&&ledger.totalValue===1029,JSON.stringify(ledger));
 assert("mixed benefit ledger identifies unresolved Southwest card",ledger.mode==="mixed_card_detail"&&ledger.unresolvedLegacyIds.includes("southwest_priority"),JSON.stringify(ledger));
}

{
 const p=E.normalizeProfile(base({
  primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,
  statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:3000},southwest:{qualifyingFlights:1},hotel:{qualifyingNights:0}},
  primaryHotel:"",primaryHotelShare:0,currentCards:["southwest_priority","venture"],currentRouting:{...emptyRouting(),airfare:[{card:"southwest_priority",amount:12000}],general:[{card:"venture",amount:138000}]},
  legacyNaturalBenefitValue:{southwest_priority:229},cardUniqueBenefitValue:{},benefitValueByType:{checked_bag:229},explicitBenefitUse:{southwest_priority:{checked_bag:true}}
 }));
 assert("benefit-type detail removes protection only for that card",E.cardBenefitDetailKnown(p,"southwest_priority")===true&&!E.legacyBenefitProtectionIds(p).includes("southwest_priority"));
 assert("replacement candidates can be evaluated after that card is detailed",E.candidatePortfolios(p).some(x=>!x.includes("southwest_priority")));
}


{
 const p=base({
  spend:{dining:50000,grocery:25000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:75000},
  currentCards:["amex_platinum"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:50000}],grocery:[{card:"amex_platinum",amount:25000}],general:[{card:"amex_platinum",amount:75000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},
  primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},
  currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:.3,hyatt_points:.5},
  cardUniqueBenefitValue:{amex_platinum:900},legacyNaturalBenefitValue:{},benefitValueByType:{},explicitBenefitUse:{},benefitEvidence:{},
  constraints:{maxNewCards:1}
 });
 const n=E.normalizeProfile(p),r=E.analyze(n);
 assert("untyped $900 Platinum benefit total is not treated as benefit detail",E.cardBenefitDetailKnown(n,"amex_platinum")===false);
 assert("untyped $900 Platinum benefit total protects Platinum from removal",E.legacyBenefitProtectionIds(n).includes("amex_platinum")&&E.candidatePortfolios(n).every(x=>x.includes("amex_platinum")));
 assert("untyped Platinum dollars still count in economics",r.current.economics.naturalBenefitValue===900,JSON.stringify(r.current.economics.benefitLedger));
 assert("high-spend low-travel case keeps Platinum and can add Gold",r.recommended.portfolio.includes("amex_platinum")&&r.recommended.portfolio.includes("amex_gold"),r.recommended.id);
}

{
 const p=base({
  spend:{dining:50000,grocery:25000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:75000},
  currentCards:["amex_platinum"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:50000}],grocery:[{card:"amex_platinum",amount:25000}],general:[{card:"amex_platinum",amount:75000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},
  primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},
  currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:.3,hyatt_points:.5},
  legacyNaturalBenefitValue:{},cardUniqueBenefitValue:{},
  benefitValueByType:{lounge:300,premium_hotel_booking:300,airline_fee_credit:300},
  explicitBenefitUse:{amex_platinum:{lounge_access:true,premium_hotel:true,airline_fee_credit:true}},
  constraints:{maxNewCards:1}
 });
 const n=E.normalizeProfile(p),r=E.analyze(n);
 assert("typed Platinum benefit use is recognized as detail",E.cardBenefitDetailKnown(n,"amex_platinum")===true);
 assert("typed Platinum experience prevents Gold-only regression",r.recommended.portfolio.includes("amex_platinum")&&r.recommended.portfolio.includes("amex_gold"),r.recommended.id);
}


{
 const p=E.normalizeProfile(base({
  spend:{dining:50000,grocery:25000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:75000},
  currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:50000}],grocery:[{card:"amex_platinum",amount:25000}],general:[{card:"amex_platinum",amount:75000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},
  currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:.3},cardUniqueBenefitValue:{amex_platinum:900},legacyNaturalBenefitValue:{},
  benefitValueByType:{lounge:300},explicitBenefitUse:{amex_platinum:{lounge_access:true}},constraints:{maxNewCards:1}
 }));
 const ledger=E.benefitLedger(p,p.currentCards);
 assert("partial $300 explanation leaves $600 Platinum residual protected",ledger.totalValue===900&&ledger.residualByCard.amex_platinum===600&&E.legacyBenefitProtectionIds(p).includes("amex_platinum"),JSON.stringify(ledger));
}

{
 const p=E.normalizeProfile(base({
  spend:{dining:50000,grocery:25000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:75000},
  currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:50000}],grocery:[{card:"amex_platinum",amount:25000}],general:[{card:"amex_platinum",amount:75000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},
  currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:.3},cardUniqueBenefitValue:{amex_platinum:900},legacyNaturalBenefitValue:{},
  benefitValueByType:{},explicitBenefitUse:{amex_platinum:{lounge_access:false}},constraints:{maxNewCards:1}
 }));
 assert("unused single benefit does not unlock unexplained Platinum total",!E.cardBenefitDetailKnown(p,"amex_platinum")&&E.legacyBenefitProtectionIds(p).includes("amex_platinum"));
}

{
 const p=E.normalizeProfile(base({
  spend:{dining:50000,grocery:25000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:75000},
  currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:50000}],grocery:[{card:"amex_platinum",amount:25000}],general:[{card:"amex_platinum",amount:75000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},
  currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:.3},cardUniqueBenefitValue:{amex_platinum:900},legacyNaturalBenefitValue:{},
  benefitValueByType:{checked_bag:900},explicitBenefitUse:{amex_platinum:{checked_bag:true}},constraints:{maxNewCards:1}
 }));
 assert("irrelevant benefit detail does not unlock Platinum",!E.cardBenefitDetailKnown(p,"amex_platinum")&&E.legacyBenefitProtectionIds(p).includes("amex_platinum"));
}

{
 const p=E.normalizeProfile(base({
  spend:{dining:50000,grocery:25000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:75000},
  currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:50000}],grocery:[{card:"amex_platinum",amount:25000}],general:[{card:"amex_platinum",amount:75000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},
  currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:.3},cardUniqueBenefitValue:{amex_platinum:900},legacyNaturalBenefitValue:{},
  benefitValueByType:{lounge:300,premium_hotel_booking:300,airline_fee_credit:300},explicitBenefitUse:{amex_platinum:{lounge_access:true,premium_hotel:true,airline_fee_credit:true}},constraints:{maxNewCards:1}
 }));
 const ledger=E.benefitLedger(p,p.currentCards);
 assert("complete $900 breakdown replaces rather than stacks with aggregate",ledger.totalValue===900&&ledger.unresolvedLegacyValue===0&&E.cardBenefitDetailKnown(p,"amex_platinum")&&!E.legacyBenefitProtectionIds(p).includes("amex_platinum"),JSON.stringify(ledger));
}

{
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","venture_x"],
  currentRouting:{...emptyRouting(),dining:[{card:"venture_x",amount:20000}],grocery:[{card:"venture_x",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"venture_x",amount:10000}],general:[{card:"venture_x",amount:93000}]},
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:4,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},
  cardUniqueBenefitValue:{amex_platinum:900,venture_x:400},legacyNaturalBenefitValue:{},benefitValueByType:{},explicitBenefitUse:{},constraints:{maxNewCards:0}
 }));
 const ledger=E.benefitLedger(p,p.currentCards);
 assert("overlapping unexplained premium-card totals are not blindly summed",ledger.overlapUnresolved===true&&ledger.totalValue===900,JSON.stringify(ledger));
 assert("both unexplained premium cards remain protected",E.legacyBenefitProtectionIds(p).includes("amex_platinum")&&E.legacyBenefitProtectionIds(p).includes("venture_x"));
}

{
 const p=E.normalizeProfile(base({
  currentCards:["delta_reserve"],currentRouting:{...emptyRouting(),airfare:[{card:"delta_reserve",amount:12000}],general:[{card:"delta_reserve",amount:138000}]},
  currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:13000},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{general:20000},delta:{mqd:1000},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{delta_reserve:650}
 }));
 const c=E.currentRecord(p,"base");
 assert("airline reported status remains explicit",c.outcomes.flightQuality.reportedStatus==="Gold Medallion");
 assert("airline projected status is explicit",c.outcomes.flightQuality.projectedStatus==="Platinum Medallion",JSON.stringify(c.outcomes.flightQuality));
 assert("airline effective status reflects higher projected tier",c.outcomes.flightQuality.effectiveStatus==="Platinum Medallion");
}

{
 const p=E.normalizeProfile(base({
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Gold",
  statusProgress:{hotel:{qualifyingNights:20}},remainingYear:{cardSpend:{general:25000},hotel:{qualifyingNights:4}},
  currentCards:["hilton_surpass"],currentRouting:{...emptyRouting(),general:[{card:"hilton_surpass",amount:150000}]},cardSpendYTD:{hilton_surpass:20000},legacyNaturalBenefitValue:{hilton_surpass:150}
 }));
 const c=E.currentRecord(p,"base");
 assert("hotel reported status remains explicit",c.outcomes.hotelExperience.reportedStatus==="Gold");
 assert("hotel projected status is explicit",c.outcomes.hotelExperience.projectedStatus==="Diamond",JSON.stringify(c.outcomes.hotelExperience));
 assert("hotel effective status reflects projected Diamond",c.outcomes.hotelExperience.effectiveStatus==="Diamond");
}

{
 const p=E.normalizeProfile(base({
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Gold",
  statusProgress:{hotel:{qualifyingNights:20}},remainingYear:{cardSpend:{general:25000},hotel:{qualifyingNights:4}},
  currentCards:["hilton_surpass","venture"],currentRouting:{...emptyRouting(),general:[{card:"hilton_surpass",amount:150000}]},cardSpendYTD:{hilton_surpass:20000},
  benefitValueByType:{hilton_credit_200:200},cardUniqueBenefitValue:{hilton_surpass:0,venture:0},legacyNaturalBenefitValue:{}
 }));
 const baseline=E.projectedCurrentStatusBaseline(p);
 assert("current setup already projects Diamond",baseline.hotel.effectiveStatus==="Diamond",JSON.stringify(baseline.hotel));
 const r=E.strategyRecord(p,["hilton_surpass","venture"],"base");
 assert("no false Diamond upgrade target is stated",!r.strategy.hotelStatusTarget||r.strategy.hotelStatusTarget.tier!=="Diamond",JSON.stringify(r.strategy.hotelStatusTarget));
 const annualGeneral=(r.annualRouting.general||[]).find(x=>x.card==="hilton_surpass")?.amount||0;
 const remainingGeneral=(r.hotelQualificationRouting.general||[]).find(x=>x.card==="hilton_surpass")?.amount||0;
 assert("no unnecessary Surpass status reroute remains",annualGeneral===0&&remainingGeneral===0,JSON.stringify({annual:r.annualRouting.general,remaining:r.hotelQualificationRouting.general}));
}

{
 const p=E.normalizeProfile(base({
  currentCards:["delta_reserve","venture"],currentRouting:{...emptyRouting(),airfare:[{card:"delta_reserve",amount:12000}],general:[{card:"delta_reserve",amount:138000}]},
  currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:13000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:50000},delta:{mqd:1000},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,
  benefitValueByType:{lounge:300},cardUniqueBenefitValue:{delta_reserve:300,venture:0},legacyNaturalBenefitValue:{}
 }));
 const baseline=E.projectedCurrentStatusBaseline(p);
 const r=E.strategyRecord(p,["delta_reserve","venture"],"base"),t=r.strategy.airlineStatusTarget;
 assert("current airline projection is separated from reported status",baseline.airline.reportedStatus==="Gold Medallion"&&baseline.airline.projectedStatus==="Platinum Medallion");
 assert("stated airline upgrade, if any, exceeds current projected setup",!t||E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.tier)>E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===baseline.airline.effectiveStatus),JSON.stringify({baseline:baseline.airline,target:t}));
 const routedReserve=(r.airlineQualificationRouting.general||[]).find(x=>x.card==="delta_reserve")?.amount||0;
 assert("no status spend is redirected merely to recreate current projected Platinum",routedReserve===0,JSON.stringify(r.airlineQualificationRouting.general));
}

{
 const p=E.normalizeProfile(base({
  spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:120000,hotel:0,general:30000},
  currentCards:["delta_platinum","venture"],currentRouting:{...emptyRouting(),airfare:[{card:"delta_platinum",amount:120000}],general:[{card:"venture",amount:30000}]},
  currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:14500},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{airfare:110000},delta:{mqd:500},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,
  benefitValueByType:{companion_certificate_renewal:300},cardUniqueBenefitValue:{delta_platinum:300,venture:0},legacyNaturalBenefitValue:{}
 }));
 const baseline=E.projectedCurrentStatusBaseline(p);
 const r=E.strategyRecord(p,["delta_reserve","venture"],"base");
 assert("current setup stops at projected Platinum in genuine-upgrade case",baseline.airline.effectiveStatus==="Platinum Medallion",JSON.stringify(baseline.airline));
 assert("a genuinely higher projected Delta tier is still recognized",r.outcomes.flightQuality.projectedStatus==="Diamond Medallion",JSON.stringify(r.outcomes.flightQuality));
}


{
 const p=E.normalizeProfile(base({
  spend:{dining:100000,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:20000,general:30000},
  currentCards:["hyatt_consumer"],
  currentRouting:{...emptyRouting(),dining:[{card:"hyatt_consumer",amount:100000}],hotel:[{card:"hyatt_consumer",amount:20000}],general:[{card:"hyatt_consumer",amount:30000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,
  primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"Explorist",
  statusProgress:{hotel:{qualifyingNights:35}},
  remainingYear:{cardSpend:{dining:30000,hotel:5000,general:15000},hotel:{qualifyingNights:5}},
  legacyNaturalBenefitValue:{},cardUniqueBenefitValue:{},benefitValueByType:{},constraints:{maxNewCards:0}
 }));
 const r=E.strategyRecord(p,["hyatt_consumer"],"base");
 const naturalSpend=Object.values(r.hotelQualificationRouting).flat().filter(x=>x.card==="hyatt_consumer").reduce((a,x)=>a+x.amount,0);
 assert("natural Hyatt spend can project Globalist as a by-product",r.outcomes.hotelExperience.projectedStatus==="Globalist",JSON.stringify(r.outcomes.hotelExperience));
 assert("natural Hyatt Globalist does not create a separate status-chasing target",r.strategy.hotelStatusTarget===null,JSON.stringify(r.strategy.hotelStatusTarget));
 assert("Hyatt qualification routing preserves ordinary remaining-year card spend",naturalSpend===50000,JSON.stringify(r.hotelQualificationRouting));
}

assert("CSP gas/EV remains 3x",E.RULES.cards.chase_preferred.earn.gas_ev===3);
assert("Boundless combined cap remains $6K",E.RULES.cards.marriott_boundless.groupCaps.boundless_everyday===6000);
assert("Surpass Diamond threshold remains $40K",E.RULES.cards.hilton_surpass.hotelStatus.spendTier.amount===40000);
assert("Southwest Priority remains 2500 TQP per $5000",E.RULES.cards.southwest_priority.status.tqpPerBlock===2500&&E.RULES.cards.southwest_priority.status.spendBlock===5000);

{
 const r=E.analyze(base({currentCards:["Mystery Premium Card","amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"Mystery Premium Card",amount:20000}],grocery:[{card:"Mystery Premium Card",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"Mystery Premium Card",amount:93000}]}}));
 assert("unsupported material spend still blocks precision",r.current.quality.precisionSuppressed===true);
 assert("blocked comparison still keeps current setup",r.recommended.id==="current");
}

{
 const p=base({spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:5000,hotel:5000,general:140000},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),airfare:[{card:"amex_platinum",amount:5000}],hotel:[{card:"amex_platinum",amount:5000}],general:[{card:"amex_platinum",amount:140000}]},remainingYear:{cardSpend:{airfare:1000,hotel:1000,general:40000},delta:{mqd:0},hotel:{qualifyingNights:1}},primaryAirlineShare:.3,annualOneWayFlights:4,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:1},benefitValueByType:{lounge:0},cardUniqueBenefitValue:{amex_platinum:900},legacyNaturalBenefitValue:{}});
 const adds=E.analyze(p).recommended.actions.filter(x=>x.action==="add").map(x=>x.cardId);
 assert("2x-everywhere opportunity remains possible",adds.includes("venture")||adds.includes("venture_x"),adds.join(","));
}

{
 const r=E.analyze(base({routeFit:{}}));
 assert("missing route fit remains visible",r.current.quality.issues.some(x=>x.code==="route_fit_not_independently_verified"));
 assert("alpha.12 integrity flags are present",r.integrity.legacyBenefitRichCurrentCardsProtected===true&&r.integrity.untypedCardBenefitTotalsProtected===true&&r.integrity.partialCardBenefitTotalsRemainProtected===true&&r.integrity.aggregateBenefitValuesDoNotDoubleCountTypedBreakdowns===true&&r.integrity.unresolvedCrossCardBenefitOverlapIsConservative===true&&r.integrity.benefitProtectionIsCardSpecific===true&&r.integrity.legacyBenefitValuePreservedWithPartialDetail===true&&r.integrity.nonIncrementalStatusSpendMovesRemoved===true&&r.integrity.reportedAndProjectedStatusSeparated===true&&r.integrity.statusTargetsComparedToProjectedCurrentSetup===true);
}

console.log("\n------------------------------");
console.log(`V5 alpha.12 harness: ${pass} passed, ${fail} failed`);
if(failures.length)console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;
