/** Quiet Premium V5 validation harness — 5.0-alpha.31 */
"use strict";
const E=require("./qp_sim_v5.js");
let pass=0,fail=0;const failures=[];
function assert(name,cond,detail=""){if(cond){pass++;console.log("PASS "+name);}else{fail++;failures.push({name,detail});console.error("FAIL "+name+(detail?" — "+detail:""));}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function roundForTest(x){return Math.round((Number(x)||0)*100)/100;}
function emptyRouting(){return Object.fromEntries(["dining","grocery","online_grocery","drugstore","gas_ev","transit","online_retail","vacation_home","airfare","hotel","general"].map(x=>[x,[]]));}
const VALIDATION_VALUATION=E.CURRENT_QP_VALUATION_SNAPSHOT;
function base(overrides={}){return{
 asOfDate:"2026-09-17",
 valuationSnapshot:VALIDATION_VALUATION,
 spend:{dining:20000,grocery:15000,online_grocery:0,gas_ev:5000,online_retail:5000,vacation_home:0,airfare:12000,hotel:10000,general:83000},
 currentCards:["amex_platinum"],
 currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],gas_ev:[{card:"amex_platinum",amount:5000}],online_retail:[{card:"amex_platinum",amount:5000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:83000}]},
 remainingYear:{cardSpend:{dining:8000,grocery:6000,gas_ev:2000,online_retail:2000,airfare:5000,hotel:4000,general:36000},delta:{mqd:1500},hotel:{qualifyingNights:3}},
 primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,currentAirlineStatus:"Gold Medallion",
 statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},primaryHotel:"marriott",primaryHotelShare:.35,currentHotelStatus:"Gold Elite",premiumStayShare:.5,
 currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95,hyatt_points:1},legacyNaturalBenefitValue:{amex_platinum:700},
 bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"},constraints:{maxNewCards:2},aspirations:["travel more"],...overrides};}

assert("engine is alpha.31",E.ENGINE_VERSION==="5.0-alpha.31");

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
 assert("lounge benefit receives recommendation credit without prior-use evidence",r.recommendationCredit.lounge===1);
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
 assert("legacy value no longer forces a permanent portfolio lock",E.candidatePortfolios(p).some(x=>!x.includes("southwest_priority")));
 const r=E.analyze(p);
 assert("unresolved Southwest benefit is reviewed before removal",r.recommended.portfolio.includes("southwest_priority")||r.recommended.actions.some(x=>x.cardId==="southwest_priority"&&x.action==="manual_review_before_removal"),JSON.stringify(r.recommended.actions));
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
 assert("untyped $900 Platinum benefit total remains visible but does not force Platinum to stay",E.legacyBenefitProtectionIds(n).includes("amex_platinum")&&E.candidatePortfolios(n).some(x=>!x.includes("amex_platinum")));
 assert("untyped Platinum dollars still count in economics",r.current.economics.naturalBenefitValue===900,JSON.stringify(r.current.economics.benefitLedger));
 assert("high-spend low-travel case can add Gold without blindly protecting Platinum",r.recommended.portfolio.includes("amex_gold"),r.recommended.id); assert("unresolved Platinum is flagged for review before removal",r.recommended.portfolio.includes("amex_platinum")||r.recommended.actions.some(x=>x.cardId==="amex_platinum"&&x.action==="manual_review_before_removal"),JSON.stringify(r.recommended.actions));
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
 assert("primary ecosystem prevents unrelated 2x patch",!adds.includes("venture")&&!adds.includes("venture_x"),adds.join(","));
}

{
 const r=E.analyze(base({routeFit:{}}));
 assert("missing route fit remains visible",r.current.quality.issues.some(x=>x.code==="route_fit_not_independently_verified"));
 assert("alpha.27 integrity flags are present",r.integrity.travelStrategyPrecedesCards===true&&r.integrity.primaryFlexibleEcosystem===true&&r.integrity.ongoingAndTemporaryRoutingSeparated===true&&r.integrity.temporaryJobsHaveExplicitHandoffs===true&&r.integrity.statusOpportunityRemainsDiscoverable===true&&r.integrity.existingCardRemovalEvaluated===true&&r.integrity.feeSavingsExposed===true&&r.integrity.aggregateBenefitValuesDoNotDoubleCountTypedBreakdowns===true&&r.integrity.unresolvedCrossCardBenefitOverlapIsConservative===true&&r.integrity.benefitProtectionIsCardSpecific===true&&r.integrity.fullAirlineStatusLadder===true&&r.integrity.projectedStatusCanBePreservedEfficiently===true&&r.integrity.protectedMultiplierSpend===true&&r.integrity.universalNewCardBands===true&&r.integrity.noSystemPortfolioCardCap===true&&r.integrity.singleApprovedValuationSnapshot===true);
}


{
 const p=E.normalizeProfile(base({home_airport:"SDF",frequent_destinations:"ATL, JFK, LAS",point_balances:{amex_mr:250000,chase_ur:50000},willing_to_concentrate:"maybe"}));
 assert("alpha.13 restores home airport",p.homeAirport==="SDF");
 assert("alpha.13 restores frequent destinations",same(p.frequentDestinations,["ATL","JFK","LAS"]));
 assert("alpha.13 restores point balances",p.pointBalances.amex_mr===250000&&p.pointBalances.chase_ur===50000);
 assert("alpha.13 restores concentration preference",p.preferences.willingnessToConcentrate==="maybe");
}

{
 const r=E.analyze(base({currentCards:["amex_gold","amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],gas_ev:[{card:"amex_platinum",amount:5000}],online_retail:[{card:"amex_platinum",amount:5000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:83000}]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:4,statusProgress:{hotel:{qualifyingNights:4}},remainingYear:{cardSpend:{dining:5000,grocery:4000,airfare:2000,hotel:2000,general:15000},hotel:{qualifyingNights:1}},cardUniqueBenefitValue:{amex_platinum:900,amex_gold:250},legacyNaturalBenefitValue:{}}));
 assert("coherent Amex wallet does not add Capital One",!r.recommended.portfolio.includes("venture")&&!r.recommended.portfolio.includes("venture_x"),r.recommended.id);
 const active=[...new Set(Object.values(r.recommended.ongoingRouting).flat().map(x=>E.RULES.cards[x.card]?.kind==="flex"?E.RULES.cards[x.card].currency:"").filter(Boolean))];
 assert("coherent wallet still routes controllable spend to one selected flexible ecosystem",active.length<=1&&(!active.length||active[0]===r.rewardsStrategy.primaryCurrency),JSON.stringify({primary:r.rewardsStrategy.primaryCurrency,active,portfolio:r.recommended.portfolio}));
}

{
 const p=base({
  spend:{dining:18000,grocery:12000,online_grocery:0,gas_ev:4000,online_retail:5000,vacation_home:0,airfare:6000,hotel:15000,general:40000},
  currentCards:["hilton_surpass","amex_gold"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:18000}],grocery:[{card:"amex_gold",amount:12000}],gas_ev:[{card:"hilton_surpass",amount:4000}],online_retail:[{card:"hilton_surpass",amount:5000}],airfare:[{card:"hilton_surpass",amount:6000}],hotel:[{card:"hilton_surpass",amount:12000}],general:[{card:"hilton_surpass",amount:43000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:4,primaryHotel:"hilton",primaryHotelShare:.75,currentHotelStatus:"Gold",
  statusProgress:{hotel:{qualifyingNights:12,qualifyingStays:7,qualifyingSpend:3500}},
  remainingYear:{cardSpend:{dining:4000,grocery:3000,hotel:3000,general:10000},hotel:{qualifyingNights:4,qualifyingStays:2,qualifyingSpend:1500}},
  cardSpendYTD:{hilton_surpass:12000},cardUniqueBenefitValue:{hilton_surpass:250,amex_gold:250},legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}
 });
 const r=E.analyze(p),job=r.recommended.recurringJobs.find(j=>j.type==="annual_threshold"&&j.cardId==="hilton_surpass"),visible=E.visibleBenefits(["hilton_surpass"]);
 assert("Surpass $15k Free Night Reward remains visible but unquantified",visible.some(x=>x.benefit==="free_night_reward_15k"&&x.detail?.spendRequired===15000&&x.detail?.quantified===false),JSON.stringify(visible));
 assert("unpriced Surpass Free Night Reward does not manufacture a quantified annual-threshold job",!job,JSON.stringify(r.recommended.recurringJobs));
 assert("unreachable $40k Surpass Diamond threshold creates no status chase",!r.recommended.strategy.hotelStatusTarget,JSON.stringify(r.recommended.strategy.hotelStatusTarget));
}

{
 const fixture=base({
  spend:{dining:45000,grocery:25000,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:4500,hotel:0,general:125500},
  currentCards:["amex_gold","amex_platinum","delta_reserve"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:45000}],grocery:[{card:"amex_gold",amount:25000}],airfare:[{card:"amex_platinum",amount:4500}],general:[{card:"delta_reserve",amount:125500}]},
  primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:12,currentAirlineStatus:"",
  statusProgress:{delta:{mqd:7000},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{dining:45000,grocery:25000,airfare:4500,general:125500},delta:{mqd:0},hotel:{qualifyingNights:0}},
  primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{},constraints:{maxNewCards:1}
 });
 const p=E.normalizeProfile(fixture),travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel);
 const without=E.strategyRecord(p,["amex_gold","amex_platinum","delta_reserve"],"base",travel,rewards);
 const withPlat=E.strategyRecord(p,["amex_gold","amex_platinum","delta_reserve","delta_platinum"],"base",travel,rewards);
 const job=without.temporaryJobs.find(j=>j.type==="airline_status"),job2=withPlat.temporaryJobs.find(j=>j.type==="airline_status");
 const q=without.airlineQualificationRouting,q2=withPlat.airlineQualificationRouting;
 const amountOn=(r,cat,id)=>(r[cat]||[]).filter(x=>x.card===id).reduce((a,x)=>a+x.amount,0);
 assert("Delta fixture preserves Platinum with exactly $80K Reserve spend",without.strategy.airlineStatusTarget?.tier==="Platinum Medallion"&&without.strategy.airlineStatusTarget?.type==="preserve"&&amountOn(q,"general","delta_reserve")===80000,JSON.stringify(without.strategy.airlineStatusTarget));
 assert("Delta fixture protects Gold dining and grocery plus Platinum airfare",amountOn(q,"dining","amex_gold")===45000&&amountOn(q,"grocery","amex_gold")===25000&&amountOn(q,"airfare","amex_platinum")===4500,JSON.stringify(q));
 assert("Delta status job has exact stop and post-threshold handoff",job?.spendRequired===80000&&job?.stopCondition?.tier==="Platinum Medallion"&&Array.isArray(job?.postThresholdRouting)&&job.postThresholdRouting.length>0,JSON.stringify(job));
 assert("full Delta ladder evaluates all four tiers",without.strategy.airlineStatusLadder?.rows?.length===4,JSON.stringify(without.strategy.airlineStatusLadder));
 assert("Delta Diamond is rejected when it requires protected multiplier spend",without.strategy.airlineStatusLadder.rows.find(x=>x.tier==="Diamond Medallion")?.reachable===false&&without.strategy.airlineStatusLadder.rows.find(x=>x.tier==="Diamond Medallion")?.stopReason==="protected_spend_or_budget_required",JSON.stringify(without.strategy.airlineStatusLadder.rows));
 assert("adding Delta Platinum Headstart reduces Reserve spend to $55K",amountOn(q2,"general","delta_reserve")===55000&&job2?.spendRequired===55000,JSON.stringify({target:withPlat.strategy.airlineStatusTarget,routing:q2.general}));
 const lowFlight=E.normalizeProfile({...fixture,annualOneWayFlights:4}),lt=E.travelStrategy(lowFlight),lr=E.rewardsStrategy(lowFlight,lt),lowRec=E.strategyRecord(lowFlight,["amex_gold","amex_platinum","delta_reserve"],"base",lt,lr);
 assert("high spend can preserve Delta Platinum with only four annual one-way flights",E.airlineStatusUsefulness(lowFlight)===true&&lowRec.strategy.airlineStatusTarget?.spendDirected===80000,JSON.stringify(lowRec.strategy.airlineStatusTarget));
}

{
 const p=base({
  currentCards:["amex_platinum","chase_reserve","venture_x"],
  currentRouting:{...emptyRouting(),dining:[{card:"chase_reserve",amount:20000}],grocery:[{card:"venture_x",amount:15000}],gas_ev:[{card:"venture_x",amount:5000}],online_retail:[{card:"venture_x",amount:5000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"venture_x",amount:83000}]},
  primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,currentAirlineStatus:"Gold Medallion",
  cardUniqueBenefitValue:{amex_platinum:900,chase_reserve:0,venture_x:0},legacyNaturalBenefitValue:{},
  explicitBenefitUse:{amex_platinum:{lounge_access:true,premium_hotel:true}},benefitValueByType:{lounge:300,premium_hotel_booking:400},constraints:{maxNewCards:1}
 });
 const r=E.analyze(p),secondaryIds=["amex_platinum","chase_reserve","venture_x"].filter(id=>E.RULES.cards[id]?.currency!==r.rewardsStrategy.primaryCurrency);
 const secondarySpend=Object.values(r.recommended.ongoingRouting).flat().filter(x=>secondaryIds.includes(x.card)).reduce((a,x)=>a+x.amount,0);
 assert("secondary flexible ecosystems do not receive routine spend",secondarySpend===0,JSON.stringify({primary:r.rewardsStrategy.primaryCurrency,routing:r.recommended.ongoingRouting}));
 assert("secondary premium cards must have a real retention job if kept",secondaryIds.filter(id=>r.recommended.portfolio.includes(id)).every(id=>r.recommended.cardRoles.find(x=>x.cardId===id)?.role==="travel_benefit"),JSON.stringify(r.recommended.cardRoles));
 assert("fee impact is exposed",typeof r.recommended.feeSummary.annualSavings==="number",JSON.stringify(r.recommended.feeSummary));
}


{
 const p=E.normalizeProfile(base({primaryAirline:"delta",primaryAirlineShare:undefined,primaryHotel:"marriott",primaryHotelShare:undefined}));
 assert("missing airline concentration is not invented",p.airline.share===0&&p.airline.shareKnown===false,JSON.stringify(p.airline));
 assert("missing hotel concentration is not invented",p.hotel.share===0&&p.hotel.shareKnown===false,JSON.stringify(p.hotel));
}
{
 const low=E.analyze(base({primaryAirline:"delta",primaryAirlineShare:.45,annualOneWayFlights:4,currentAirlineStatus:"",statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},constraints:{maxNewCards:0}}));
 assert("Delta 45 percent four flights does not become concentration strategy",low.travelStrategy.airline.mode==="preferred_without_concentration"&&!low.travelStrategy.airline.relationshipEstablished,JSON.stringify(low.travelStrategy.airline));
 const high=E.analyze(base({primaryAirline:"delta",primaryAirlineShare:.80,annualOneWayFlights:4,currentAirlineStatus:"",statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},constraints:{maxNewCards:0}}));
 assert("Delta 80 percent four flights can support spend-driven status",high.travelStrategy.airline.relationshipEstablished===true&&high.travelStrategy.airline.statusUseful===true,JSON.stringify(high.travelStrategy.airline));
}
{
 const p=base({spend:{dining:10000,grocery:8000,online_grocery:0,gas_ev:2000,online_retail:2000,vacation_home:0,airfare:6000,hotel:12000,general:30000},currentCards:["hyatt_consumer"],currentRouting:{...emptyRouting(),dining:[{card:"hyatt_consumer",amount:10000}],grocery:[{card:"hyatt_consumer",amount:8000}],gas_ev:[{card:"hyatt_consumer",amount:2000}],online_retail:[{card:"hyatt_consumer",amount:2000}],airfare:[{card:"hyatt_consumer",amount:6000}],hotel:[{card:"hyatt_consumer",amount:12000}],general:[{card:"hyatt_consumer",amount:30000}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:4,primaryHotel:"hyatt",primaryHotelShare:.80,currentHotelStatus:"Explorist",statusProgress:{hotel:{qualifyingNights:54,qualifyingStays:20,qualifyingSpend:9000}},remainingYear:{cardSpend:{hotel:6000},hotel:{qualifyingNights:6,qualifyingStays:3,qualifyingSpend:2500}},legacyNaturalBenefitValue:{},cardUniqueBenefitValue:{hyatt_consumer:250},constraints:{maxNewCards:1}});
 const r=E.analyze(p);assert("Hyatt 54 plus six known nights reaches Globalist naturally",r.recommended.travelActions.hotel.projectedNaturalStatus==="Globalist",JSON.stringify(r.recommended.travelActions.hotel));assert("natural Hyatt Globalist creates no hotel status intervention",!r.recommended.strategy.hotelStatusTarget,JSON.stringify(r.recommended.strategy.hotelStatusTarget));
}
{
 const p=base({currentCards:["amex_gold"],currentRouting:{...emptyRouting(),hotel:[{card:"amex_gold",amount:10000}],general:[{card:"amex_gold",amount:20000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:10000,general:20000},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,primaryHotel:"marriott",primaryHotelShare:.80,currentHotelStatus:"Gold Elite",statusProgress:{hotel:{qualifyingNights:43,qualifyingStays:20,qualifyingSpend:9000}},remainingYear:{cardSpend:{hotel:5000},hotel:{qualifyingNights:5,qualifyingStays:2,qualifyingSpend:2000}},legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}});
 const r=E.analyze(p);assert("Marriott 43 plus five known exposes two-night remaining gap",r.recommended.travelActions.hotel.remainingGap?.nights===2,JSON.stringify(r.recommended.travelActions.hotel));
}
{
 assert("universal new-card band excludes $199",E.classifyNewCardValue(199)==="do_not_surface");
 assert("universal new-card band starts Consider at $200",E.classifyNewCardValue(200)==="consider");
 assert("universal new-card band keeps $349 in Consider",E.classifyNewCardValue(349)==="consider");
 assert("universal new-card band starts Recommended at $350",E.classifyNewCardValue(350)==="recommended");
 const consider=E.analyze(base({spend:{dining:4000,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:4000}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{},constraints:{maxNewCards:1,requiredCards:["amex_platinum"],prohibitedCards:["chase_preferred","chase_freedom_unlimited","chase_freedom_flex","chase_reserve","venture_one","venture","venture_x"]}}));
 const c=consider.newCardClassifications.find(x=>x.cardId==="amex_gold");
 assert("Consider card is surfaced but cannot be core recommendation",c?.classification==="consider"&&!consider.recommended.portfolio.includes("amex_gold")&&consider.considerCards.some(x=>x.cardId==="amex_gold"),JSON.stringify({c,rec:consider.recommended.id}));
 const recommended=E.analyze(base({spend:{dining:5550,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:5550}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{},constraints:{maxNewCards:1,requiredCards:["amex_platinum"],prohibitedCards:["chase_preferred","chase_freedom_unlimited","chase_freedom_flex","chase_reserve","venture_one","venture","venture_x"]}}));
 assert("Recommended card can enter core at $350 recurring delta",recommended.newCardClassifications.find(x=>x.cardId==="amex_gold")?.classification==="recommended"&&recommended.recommended.portfolio.includes("amex_gold"),JSON.stringify({classes:recommended.newCardClassifications,rec:recommended.recommended.id}));
}
{
 const common={spend:{dining:17320,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:17320}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{dining:4000}},legacyNaturalBenefitValue:{},constraints:{maxNewCards:1,requiredCards:["amex_platinum"],prohibitedCards:["chase_preferred","chase_freedom_unlimited","chase_freedom_flex","chase_reserve","venture_one","venture","venture_x"]}};
 const a=E.analyze(base(common)),b=E.analyze(base({...common,welcomeOffers:[{cardId:"amex_gold",eligible:true,minimumSpend:4000,bonusPoints:250000}]}));assert("huge welcome offer does not change recurring card classification",E.recommendationFingerprint(a)===E.recommendationFingerprint(b),JSON.stringify({a:a.recommended.id,b:b.recommended.id}));
}
{
 const p=base({spend:{dining:20000,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:20000}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{dining:4000}},welcomeOffers:[{cardId:"amex_gold",eligible:true,minimumSpend:4000,bonusPoints:90000}],legacyNaturalBenefitValue:{},constraints:{maxNewCards:1,requiredCards:["amex_platinum"],prohibitedCards:["chase_preferred","chase_freedom_unlimited","chase_freedom_flex","chase_reserve","venture_one","venture","venture_x"]}});
 const r=E.analyze(p);assert("eligible welcome offer is exposed only after independent recommendation",r.recommended.portfolio.includes("amex_gold")&&r.recommended.welcomeOffers.some(x=>x.cardId==="amex_gold"),JSON.stringify({p:r.recommended.portfolio,o:r.recommended.welcomeOffers}));assert("welcome offer is not a temporary recommendation job",!r.recommended.temporaryJobs.some(x=>x.type==="welcome_offer"),JSON.stringify(r.recommended.temporaryJobs));
}
{
 const p=E.normalizeProfile(base({spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},currentCards:["amex_gold","amex_platinum"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{}}));const rewards=E.rewardsStrategy(p,E.travelStrategy(p)),a=E.routeAnnual(p,["amex_gold","amex_platinum"],"base",rewards),b=E.routeAnnual(p,["amex_platinum","amex_gold"],"base",rewards);assert("reversing equal-value card array order does not change routing",same(a,b),JSON.stringify({a,b}));assert("equal-value routing preserves existing category card",a.general?.[0]?.card==="amex_platinum",JSON.stringify(a.general));
}
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},benefitValueByType:{lounge:300},constraints:{maxNewCards:0}})),one=E.benefitLedger(p,["amex_platinum"]),two=E.benefitLedger(p,["amex_platinum","chase_reserve"]);assert("overlapping typed benefit is counted once",one.typeValue===300&&two.typeValue===300,JSON.stringify({one:one.typeValue,two:two.typeValue}));assert("benefit credit does not require historical use",E.recommendationCredit(p,["amex_platinum"]).lounge===1);
}
{assert("universal card bands replace legacy $750 and $300 gates",E.MODEL.newCardRecommendedMin===350&&E.MODEL.newCardConsiderMin===200&&E.MODEL.sameEcosystemIncrementalValueFloor===undefined&&E.MODEL.materialCashImprovement===undefined,JSON.stringify(E.MODEL));}


{
 const existing=E.normalizeProfile(base({currentCards:["amex_gold"],currentRouting:{...emptyRouting(),general:[{card:"amex_gold",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{}}));
 const proposed=E.normalizeProfile(base({currentCards:[],currentRouting:emptyRouting(),spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{}}));
 const a=E.portfolioRecurringBenefitValue(existing,["amex_gold"]),b=E.portfolioRecurringBenefitValue(proposed,["amex_gold"]);
 assert("existing and proposed identical card have identical built-in recurring benefit value",a.totalValue===b.totalValue&&a.totalValue===424,JSON.stringify({a,b}));
}
{
 const p=E.normalizeProfile(base({currentCards:["venture_x"],currentRouting:{...emptyRouting(),general:[{card:"venture_x",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{}}));
 const r=E.currentRecord(p,"conservative");
 assert("existing Venture X gets recurring annual travel credit",r.economics.recurringBenefitValue>=300,JSON.stringify(r.economics));
 assert("existing Venture X gets anniversary miles from the one approved valuation snapshot",r.economics.annualBonusTravelValue===roundForTest(10000*p.valuationSnapshot.values.capital_one_miles),JSON.stringify(r.economics));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},cardUniqueBenefitValue:{amex_platinum:900},legacyNaturalBenefitValue:{},benefitValueByType:{}}));
 const x=E.portfolioRecurringBenefitValue(p,["amex_platinum"]);
 assert("legacy aggregate does not stack or reintroduce excluded lifestyle value",x.totalValue===1649&&x.excludedByScope.some(v=>v.benefit==="digital_entertainment_credit"),JSON.stringify(x));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum","chase_reserve"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:5000},{card:"chase_reserve",amount:5000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{},benefitValueByType:{}}));
 const x=E.portfolioRecurringBenefitValue(p,["amex_platinum","chase_reserve"]);
 assert("shared multi-year trusted traveler benefit is counted once",x.byType.trusted_traveler===30,JSON.stringify(x));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}}));
 const s=E.selectForScenario(p,"base");
 assert("unchanged existing benefits create zero Quiet Premium economic improvement",s.recommended.economics.netEconomicValue-s.current.economics.netEconomicValue===0,JSON.stringify({current:s.current.economics.netEconomicValue,recommended:s.recommended.economics.netEconomicValue}));
}


{
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","venture"],
  currentRouting:{...emptyRouting(),dining:[{card:"venture",amount:20000}],grocery:[{card:"venture",amount:15000}],gas_ev:[{card:"venture",amount:5000}],online_retail:[{card:"venture",amount:5000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"venture",amount:83000}]},
  primaryAirline:"delta",primaryAirlineShare:.8,routeFit:{delta:.9},annualOneWayFlights:12,statusProgress:{delta:{mqd:5000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},delta:{mqd:1000}},
  primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}
 }));
 const s=E.selectForScenario(p,"base"),currentVenture=s.current.cardRoles.find(x=>x.cardId==="venture");
 assert("paid secondary-ecosystem card without sufficient job is no-job",currentVenture?.role==="no_job",JSON.stringify(s.current.cardRoles));
 assert("paid no-job card is removed when fee is saved",!s.recommended.portfolio.includes("venture")&&s.recommended.actions.some(x=>x.cardId==="venture"&&x.action==="remove_or_downgrade_after_review"),JSON.stringify({portfolio:s.recommended.portfolio,actions:s.recommended.actions}));
 const routed=Object.values(s.recommended.ongoingRouting).flat().filter(x=>x.card==="venture").reduce((a,x)=>a+x.amount,0);
 assert("removed secondary ecosystem gets no routine spend",routed===0,JSON.stringify(s.recommended.ongoingRouting));
}
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","hilton_no_fee"],
  currentRouting:{...emptyRouting(),dining:[{card:"hilton_no_fee",amount:20000}],grocery:[{card:"hilton_no_fee",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"hilton_no_fee",amount:93000}]},
  primaryAirline:"delta",primaryAirlineShare:.8,routeFit:{delta:.9},annualOneWayFlights:12,statusProgress:{delta:{mqd:5000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},delta:{mqd:1000}},
  primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}
 }));
 const s=E.selectForScenario(p,"base"),role=s.recommended.cardRoles.find(x=>x.cardId==="hilton_no_fee"),routed=Object.values(s.recommended.ongoingRouting).flat().filter(x=>x.card==="hilton_no_fee").reduce((a,x)=>a+x.amount,0);
 assert("zero-fee no-job card is retained",s.recommended.portfolio.includes("hilton_no_fee"),JSON.stringify(s.recommended.portfolio));
 assert("zero-fee no-job card receives no routine spend",routed===0,JSON.stringify(s.recommended.ongoingRouting));
 assert("zero-fee retained card can remain no-job",role?.role==="no_job",JSON.stringify(role));
}


{
 const p=E.normalizeProfile(base({verifiedFacts:{snapshotId:"fee-override",verifiedAt:"2026-09-19T16:00:00-04:00",sources:["issuer"],cards:{amex_platinum:{verificationStatus:"verified",complete:false,annualFee:999,sources:["issuer"],verifiedAt:"2026-09-19"}}},constraints:{maxNewCards:0}}));
 assert("verified card fee overrides fallback fixture",E.cardFacts(p,"amex_platinum").annualFee===999,JSON.stringify(E.cardFacts(p,"amex_platinum")));
 const r=E.analyze(p);assert("verified card fee override reaches current economics",r.current.economics.annualFees===999,JSON.stringify(r.current.economics));
 assert("partial verified card snapshot explicitly reports fallback",r.factQuality.fallbackFactsUsed.includes("cards.amex_platinum")&&r.factQuality.productionReady===false,JSON.stringify(r.factQuality));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_gold","amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:83000}]},verifiedFacts:{snapshotId:"earn-override",verifiedAt:"2026-09-19",sources:["issuer"],cards:{amex_platinum:{verificationStatus:"verified",complete:false,earn:{dining:10},sources:["issuer"],verifiedAt:"2026-09-19"}}},constraints:{maxNewCards:0}}));
 const s=E.selectForScenario(p,"base"),dining=s.recommended.ongoingRouting.dining||[];assert("verified earn rate changes routing",dining.length===1&&dining[0].card==="amex_platinum",JSON.stringify(dining));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_gold"],currentRouting:{...emptyRouting(),general:[{card:"amex_gold",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},verifiedFacts:{snapshotId:"benefits",verifiedAt:"2026-09-19",sources:["issuer"],cards:{amex_gold:{verificationStatus:"verified",complete:true,annualFee:325,earn:{dining:4,grocery:4,online_grocery:4,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["dining_credit"],recurringCredits:{dining_credit:500},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},verified:true,sources:["issuer"],verifiedAt:"2026-09-19"}}},constraints:{maxNewCards:0}}));
 const r=E.analyze(p);assert("verified recurring benefits apply symmetrically to current and recommended",r.current.economics.recurringBenefitValue===r.recommended.economics.recurringBenefitValue&&r.current.economics.recurringBenefitValue===500,JSON.stringify({c:r.current.economics.recurringBenefitValue,r:r.recommended.economics.recurringBenefitValue}));
 assert("complete single-card verified snapshot can be production ready",r.factQuality.productionReady===true,JSON.stringify(r.factQuality));
}
{
 const p=E.normalizeProfile(base({primaryAirline:"delta",primaryAirlineShare:.8,annualOneWayFlights:12,currentAirlineStatus:"",statusProgress:{delta:{mqd:6000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},delta:{mqd:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"delta-threshold",verifiedAt:"2026-09-19",sources:["delta"],cards:{amex_platinum:{verificationStatus:"verified",complete:true,sources:["amex"],verifiedAt:"2026-09-19"}},airlines:{delta:{verificationStatus:"verified",complete:true,thresholds:[{tier:"Silver Medallion",amount:9000},{tier:"Gold Medallion",amount:14000},{tier:"Platinum Medallion",amount:20000},{tier:"Diamond Medallion",amount:30000}],sources:["delta"],verifiedAt:"2026-09-19"}}}}));
 const r=E.analyze(p);assert("verified airline threshold overrides fallback fixture",r.recommended.travelActions.airline.projectedNaturalStatus==="",JSON.stringify(r.recommended.travelActions.airline));
}
{
 const p=E.normalizeProfile(base({currentCards:["hyatt_consumer"],currentRouting:{...emptyRouting(),hotel:[{card:"hyatt_consumer",amount:10000}],general:[{card:"hyatt_consumer",amount:20000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:10000,general:20000},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"hyatt",primaryHotelShare:.8,currentHotelStatus:"Explorist",statusProgress:{hotel:{qualifyingNights:54,qualifyingStays:20,qualifyingSpend:9000}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:6,qualifyingStays:3,qualifyingSpend:2500}},cardUniqueBenefitValue:{hyatt_consumer:250},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"hyatt-threshold",verifiedAt:"2026-09-19",sources:["hyatt"],cards:{hyatt_consumer:{verificationStatus:"verified",complete:true,sources:["chase"],verifiedAt:"2026-09-19"}},hotels:{hyatt:{verificationStatus:"verified",complete:true,thresholds:[{tier:"Discoverist",nights:10},{tier:"Explorist",nights:30},{tier:"Globalist",nights:70}],sources:["hyatt"],verifiedAt:"2026-09-19"}}}}));
 const r=E.analyze(p);assert("verified hotel threshold overrides fallback fixture",r.recommended.travelActions.hotel.projectedNaturalStatus!=="Globalist",JSON.stringify(r.recommended.travelActions.hotel));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));assert("analysis without verified snapshot discloses fallback facts",r.factQuality.verifiedSnapshotPresent===false&&r.factQuality.fallbackFactsUsed.length>0&&r.factQuality.productionReady===false,JSON.stringify(r.factQuality));
}
{
 const p=base({primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"same-snapshot",verifiedAt:"2026-09-19",sources:["issuer"],cards:{amex_platinum:{verificationStatus:"verified",complete:true,sources:["issuer"],verifiedAt:"2026-09-19"}}}});
 const r=E.analyze(p);assert("current and recommended use the same immutable facts snapshot",r.current.factsSnapshotId==="same-snapshot"&&r.recommended.factsSnapshotId==="same-snapshot"&&r.factsSnapshot.snapshotId==="same-snapshot"&&Object.isFrozen(r.profile.verifiedFacts),JSON.stringify(r.factsSnapshot));
}


{
 const p=E.normalizeProfile(base({primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"replace-volatile",verifiedAt:"2026-09-19",sources:["issuer"],cards:{amex_platinum:{verificationStatus:"verified",complete:true,annualFee:895,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:[],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},verified:true,sources:["issuer"],verifiedAt:"2026-09-19"}}}}));
 const facts=E.cardFacts(p,"amex_platinum");assert("complete verified card does not resurrect stale recurring benefits",Object.keys(facts.recurringCredits||{}).length===0&&!(facts.benefitTags||[]).includes("lounge"),JSON.stringify(facts));
}
{
 const p=E.normalizeProfile(base({primaryAirline:"united",primaryAirlineShare:.8,annualOneWayFlights:12,statusProgress:{united:{pqp:5000,pqf:20},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:0,pqf:0,unitedSegments:4}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"replace-program",verifiedAt:"2026-09-19",sources:["united"],airlines:{united:{verificationStatus:"verified",complete:true,thresholds:[{tier:"Premier Silver",amount:7000,pqpOnly:7000,pqpWithPQF:6000,pqf:15}],minimumUnitedSegments:6,sources:["united"],verifiedAt:"2026-09-19"}}}}));
 const facts=E.airlineFacts(p,"united");assert("complete verified airline replaces minimum segment rule",facts.minimumUnitedSegments===6&&facts.thresholds[0].amount===7000,JSON.stringify(facts));
}


{
 const complete=(annualFee,earn,benefitTags,status={})=>({verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],facts:{annualFee,earn,bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags,recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status,transferRules:{},verified:true}});
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","delta_reserve"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:93000}]},
  primaryAirline:"delta",primaryAirlineShare:.8,routeFit:{delta:.9},annualOneWayFlights:4,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},delta:{mqd:0}},
  primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0},
  verifiedFacts:{snapshotId:"cobrand-nojob",verifiedAt:"2026-09-19",sources:["issuer"],cards:{
   amex_platinum:complete(895,{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},["lounge"]),
   delta_reserve:complete(650,{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},[],{})
  },airlines:{delta:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["delta"],thresholds:[{tier:"Silver Medallion",amount:5000},{tier:"Gold Medallion",amount:10000},{tier:"Platinum Medallion",amount:15000},{tier:"Diamond Medallion",amount:28000}]}},hotels:{}}
 }));
 const s=E.selectForScenario(p,"base"),role=s.current.cardRoles.find(x=>x.cardId==="delta_reserve");
 assert("matching-airline label does not prevent a paid co-brand from being removed",s.recommended.actions.some(x=>x.cardId==="delta_reserve"&&x.action==="remove_or_downgrade_after_review"),JSON.stringify({roles:s.current.cardRoles,actions:s.recommended.actions}));
 assert("paid matching-airline no-job card can be removed",!s.recommended.portfolio.includes("delta_reserve"),JSON.stringify({portfolio:s.recommended.portfolio,actions:s.recommended.actions}));
}
{
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","hyatt_consumer"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:93000}]},
  primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.7,currentHotelStatus:"Globalist",statusProgress:{hotel:{qualifyingNights:60}},remainingYear:{cardSpend:{}},constraints:{maxNewCards:0},
  verifiedFacts:{snapshotId:"cobrand-benefit",verifiedAt:"2026-09-19",sources:["issuer"],cards:{
   amex_platinum:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["amex"],annualFee:895,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["lounge"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},verified:true},
   hyatt_consumer:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["chase"],annualFee:95,earn:{dining:2,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:2,hotel:4,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["free_night_reward_annual"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{automaticTier:"Discoverist"},hotelStatusByProgram:{},status:{},transferRules:{},verified:true}
  },airlines:{},hotels:{hyatt:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["hyatt"],thresholds:[{tier:"Discoverist",nights:10},{tier:"Explorist",nights:30},{tier:"Globalist",nights:60}]}}}
 }));
 const s=E.selectForScenario(p,"base"),role=s.current.cardRoles.find(x=>x.cardId==="hyatt_consumer");
 assert("unique recurring non-dollar co-brand benefit creates retention job",role?.role==="travel_benefit",JSON.stringify(s.current.cardRoles));
}


{
 const complete=(annualFee,earn,benefitTags,status={})=>({verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],facts:{annualFee,earn,bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags,recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status,transferRules:{},verified:true}});
 const p=E.normalizeProfile(base({
  currentCards:["amex_platinum","delta_platinum"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:93000}]},
  primaryAirline:"delta",primaryAirlineShare:.8,routeFit:{delta:.9},annualOneWayFlights:4,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},delta:{mqd:0}},
  primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0},
  verifiedFacts:{snapshotId:"delta-upgrade-eligibility",verifiedAt:"2026-09-19",sources:["issuer"],cards:{
   amex_platinum:complete(895,{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:5,hotel:1,general:1},["lounge"]),
   delta_platinum:complete(350,{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},["upgrade_eligibility"],{})
  },airlines:{delta:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["delta"],thresholds:[{tier:"Silver Medallion",amount:5000},{tier:"Gold Medallion",amount:10000},{tier:"Platinum Medallion",amount:15000},{tier:"Diamond Medallion",amount:28000}]}},hotels:{}}
 }));
 const s=E.selectForScenario(p,"base"),role=s.current.cardRoles.find(x=>x.cardId==="delta_platinum");
 assert("Delta upgrade-list eligibility is a retention capability without claiming upgrade priority",role?.role==="travel_benefit"&&E.recommendationCredit(p,p.currentCards).upgradePriority===0,JSON.stringify({role,credit:E.recommendationCredit(p,p.currentCards)}));
}


{
 const p=E.normalizeProfile(base({currentCards:["united_explorer"],currentRouting:{...emptyRouting(),general:[{card:"united_explorer",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"united",primaryAirlineShare:.8,annualOneWayFlights:4,primaryHotel:"",primaryHotelShare:0,cardSpendYTD:{united_explorer:9000},remainingYear:{cardSpend:{general:1000},united:{pqp:0,pqf:0,unitedSegments:0}},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"generic-natural",verifiedAt:"2026-09-19",sources:["issuer"],cards:{united_explorer:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:150,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["checked_bag"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[{amount:10000,benefit:"united_travelbank_100"}],verified:true}},airlines:{united:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["united"],thresholds:[{tier:"Premier Silver",amount:6000,pqpOnly:6000,pqpWithPQF:5000,pqf:15}],minimumUnitedSegments:4}},hotels:{}}}));
 const annual={...emptyRouting(),general:[{card:"united_explorer",amount:10000}]};const jobs=E.recurringJobs(p,["united_explorer"],annual,"base",{baseRouting:annual,optimizations:[]});
 assert("unpriced annual threshold may surface as recurring when natural spend reaches it",jobs.some(x=>x.purpose==="united_travelbank_100"&&x.recurring===true&&x.modeledValue===0),JSON.stringify(jobs));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum","united_explorer"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"united",primaryAirlineShare:.8,annualOneWayFlights:4,primaryHotel:"",primaryHotelShare:0,cardSpendYTD:{united_explorer:9000},remainingYear:{cardSpend:{general:1000},united:{pqp:0,pqf:0,unitedSegments:0}},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"generic-unpriced-shift",verifiedAt:"2026-09-19",sources:["issuer"],cards:{amex_platinum:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:895,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:2},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:[],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[],verified:true},united_explorer:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:150,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["checked_bag"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[{amount:10000,benefit:"united_travelbank_100"}],verified:true}},airlines:{united:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["united"],thresholds:[{tier:"Premier Silver",amount:6000,pqpOnly:6000,pqpWithPQF:5000,pqf:15}],minimumUnitedSegments:4}},hotels:{}}}));
 const annual={...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]};const jobs=E.recurringJobs(p,["amex_platinum","united_explorer"],annual,"base",{baseRouting:annual,optimizations:[]});
 assert("unpriced annual threshold does not redirect spend",!jobs.some(x=>x.purpose==="united_travelbank_100"),JSON.stringify(jobs));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum","united_explorer"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"united",primaryAirlineShare:.8,annualOneWayFlights:4,primaryHotel:"",primaryHotelShare:0,cardSpendYTD:{united_explorer:9000},remainingYear:{cardSpend:{general:1000},united:{pqp:0,pqf:0,unitedSegments:0}},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"generic-valued-shift",verifiedAt:"2026-09-19",sources:["issuer"],cards:{amex_platinum:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:895,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1.01},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:[],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[],verified:true},united_explorer:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:150,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["checked_bag"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[{amount:10000,benefit:"united_travelbank_100",cashValue:100}],verified:true}},airlines:{united:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["united"],thresholds:[{tier:"Premier Silver",amount:6000,pqpOnly:6000,pqpWithPQF:5000,pqf:15}],minimumUnitedSegments:4}},hotels:{}}}));
 const annual=E.routeAnnual(p,["amex_platinum","united_explorer"],"base",{primaryCurrency:"amex_mr",primaryCards:["amex_platinum"]}),jobs=E.recurringJobs(p,["amex_platinum","united_explorer"],annual,"base",{baseRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},optimizations:[]});
 assert("valued annual threshold may redirect spend only when value exceeds opportunity cost",(annual.general||[]).some(x=>x.card==="united_explorer"&&x.amount===10000)&&jobs.some(x=>x.purpose==="united_travelbank_100"&&x.modeledValue===100),JSON.stringify({annual,jobs}));
}


{
 const p=E.normalizeProfile(base({currentCards:["united_quest"],currentRouting:{...emptyRouting(),general:[{card:"united_quest",amount:20000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:20000},primaryAirline:"united",primaryAirlineShare:.8,annualOneWayFlights:4,primaryHotel:"",primaryHotelShare:0,cardSpendYTD:{united_quest:19000},remainingYear:{cardSpend:{general:1000},united:{pqp:0,pqf:0,unitedSegments:0}},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"value-points",verifiedAt:"2026-09-19",sources:["issuer"],cards:{united_quest:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:350,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["checked_bag"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[{amount:20000,benefit:"award_discount_10k",valuePoints:10000,currency:"united_miles"}],verified:true}},airlines:{united:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["united"],thresholds:[{tier:"Premier Silver",amount:6000,pqpOnly:6000,pqpWithPQF:5000,pqf:15}],minimumUnitedSegments:4}},hotels:{}}}));
 const annual={...emptyRouting(),general:[{card:"united_quest",amount:20000}]},jobs=E.recurringJobs(p,["united_quest"],annual,"base",{baseRouting:annual,optimizations:[]}),value=E.portfolioAnnualSpendRewardValue(p,["united_quest"],annual,"base");
 assert("annual award discount uses currency-equivalent value without pretending certificate points are earned",jobs.some(x=>x.purpose==="award_discount_10k"&&x.modeledValue===120)&&value.totalValue===120,JSON.stringify({jobs,value}));
}


{
 const p=E.normalizeProfile(base({currentCards:["aa_executive"],currentRouting:{...emptyRouting(),general:[{card:"aa_executive",amount:10000}]},primaryAirline:"american",primaryAirlineShare:.8,annualOneWayFlights:12,primaryHotel:"",primaryHotelShare:0,statusProgress:{american:{loyaltyPoints:45000},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{general:10000},loyaltyPoints:0},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"aa-milestone",verifiedAt:"2026-09-19",sources:["citi"],cards:{aa_executive:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["citi"],annualFee:695,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:4,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["lounge","loyalty_point_bonus_milestones"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{lpPerEligiblePurchaseDollar:1},transferRules:{},spendRewards:[],statusMilestoneRewards:[{metric:"loyaltyPoints",threshold:50000,bonus:10000},{metric:"loyaltyPoints",threshold:90000,bonus:10000}],verified:true}},airlines:{american:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["aa"],thresholds:[{tier:"AAdvantage Gold",amount:40000},{tier:"AAdvantage Platinum",amount:75000},{tier:"AAdvantage Platinum Pro",amount:125000},{tier:"AAdvantage Executive Platinum",amount:200000}]}},hotels:{}}}));
 const a=E.airlineProjection(p,"american",{...emptyRouting(),general:[{card:"aa_executive",amount:10000}]},["aa_executive"]);
 assert("American future Loyalty Point milestone bonus is added once after newly crossing threshold",a.metric===65000&&a.statusMilestoneBonus===10000&&a.statusMilestones.length===1,JSON.stringify(a));
}
{
 const p=E.normalizeProfile(base({currentCards:["aa_executive"],currentRouting:{...emptyRouting()},primaryAirline:"american",primaryAirlineShare:.8,annualOneWayFlights:12,primaryHotel:"",primaryHotelShare:0,statusProgress:{american:{loyaltyPoints:55000},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{},loyaltyPoints:0},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"aa-no-double",verifiedAt:"2026-09-19",sources:["citi"],cards:{aa_executive:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["citi"],annualFee:695,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:4,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["lounge"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{lpPerEligiblePurchaseDollar:1},transferRules:{},spendRewards:[],statusMilestoneRewards:[{metric:"loyaltyPoints",threshold:50000,bonus:10000}],verified:true}},airlines:{american:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["aa"],thresholds:[{tier:"AAdvantage Gold",amount:40000},{tier:"AAdvantage Platinum",amount:75000}]}},hotels:{}}}));
 const a=E.airlineProjection(p,"american",emptyRouting(),["aa_executive"]);
 assert("American milestone already below current reported progress is not double counted",a.metric===55000&&a.statusMilestoneBonus===0,JSON.stringify(a));
}

{
 const verifiedFacts={snapshotId:"aa-globe-flight-streak",verifiedAt:"2026-09-21",sources:["citi","aa"],cards:{
  aa_executive:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["citi"],facts:{annualFee:695,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:4,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["lounge","priority_airport","loyalty_point_bonus_milestones"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{lpPerEligiblePurchaseDollar:1},transferRules:{},spendRewards:[],statusMilestoneRewards:[{metric:"loyaltyPoints",threshold:50000,bonus:10000},{metric:"loyaltyPoints",threshold:90000,bonus:10000},{metric:"loyaltyPoints",threshold:165000,bonus:10000},{metric:"loyaltyPoints",threshold:240000,bonus:10000}],companionCertificate:{},verified:true}},
  aa_globe:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["citi","aa"],facts:{annualFee:350,earn:{dining:2,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:3,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["lounge_passes","checked_bag","boarding_benefits","companion_certificate_renewal","global_entry_tsa","travel_protections"],recurringCredits:{turo_credit:240,inflight_credit:100,splurge_credit:100},multiYearCredits:{trusted_traveler:{amount:120,years:4}},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{lpPerEligiblePurchaseDollar:1,flightStreakBlock:4,flightStreakBonus:5000,flightStreakAnnualCap:15000},transferRules:{},spendRewards:[],statusMilestoneRewards:[],companionCertificate:{usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"domestic",ticketingFee:99,renewalRequired:true},verified:true}}
 },airlines:{american:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["aa"],facts:{thresholds:[{tier:"AAdvantage Gold",amount:40000},{tier:"AAdvantage Platinum",amount:75000},{tier:"AAdvantage Platinum Pro",amount:125000},{tier:"AAdvantage Executive Platinum",amount:200000}]}}},hotels:{}};
 const p=E.normalizeProfile(base({
  spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:20000,hotel:0,general:130000},
  currentCards:["aa_executive","venture"],currentRouting:{...emptyRouting(),airfare:[{card:"aa_executive",amount:20000}],general:[{card:"venture",amount:130000}]},
  primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.95},annualOneWayFlights:24,currentAirlineStatus:"",
  statusProgress:{american:{loyaltyPoints:0},hotel:{qualifyingNights:0}},
  americanQualification:{cardSpend:{},loyaltyPoints:100000,qualifyingSegments:12},
  primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{},cardUniqueBenefitValue:{},benefitValueByType:{},explicitBenefitUse:{},constraints:{maxNewCards:1},verifiedFacts
 }));
 const without=E.airlineProjection(p,"american",emptyRouting(),["aa_executive"]);
 const withGlobe=E.airlineProjection(p,"american",emptyRouting(),["aa_executive","aa_globe"]);
 assert("Globe alias is recognized",E.matchCard("Citi / AAdvantage Globe Mastercard")==="aa_globe");
 assert("American portfolio without Globe remains Platinum at 120K LP",without.metric===120000&&without.tier==="AAdvantage Platinum",JSON.stringify(without));
 assert("Globe Flight Streak adds capped 15K LP and reaches Platinum Pro",withGlobe.metric===135000&&withGlobe.flightStreakBonus===15000&&withGlobe.tier==="AAdvantage Platinum Pro",JSON.stringify(withGlobe));
 assert("Globe is present in American candidate portfolios",E.candidatePortfolios(p).some(x=>x.includes("aa_globe")));
 const r=E.strategyRecord(p,["aa_executive","aa_globe","venture"],"base");
 assert("Executive Platinum is not manufactured when protected American qualification spend is zero",!r.strategy.airlineStatusTarget||r.strategy.airlineStatusTarget.tier!=="AAdvantage Executive Platinum",JSON.stringify(r.strategy.airlineStatusTarget));
}
{
 const p=E.normalizeProfile(base({primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.95},annualOneWayFlights:32,statusProgress:{american:{loyaltyPoints:0},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{},loyaltyPoints:0,qualifyingSegments:16},primaryHotel:"",primaryHotelShare:0,currentCards:[],currentRouting:emptyRouting(),constraints:{maxNewCards:1},verifiedFacts:{snapshotId:"globe-cap",verifiedAt:"2026-09-21",sources:["citi"],cards:{aa_globe:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["citi"],facts:{annualFee:350,earn:{dining:2,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:3,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["companion_certificate_renewal"],recurringCredits:{turo_credit:240,inflight_credit:100,splurge_credit:100},multiYearCredits:{trusted_traveler:{amount:120,years:4}},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{lpPerEligiblePurchaseDollar:1,flightStreakBlock:4,flightStreakBonus:5000,flightStreakAnnualCap:15000},transferRules:{},spendRewards:[],statusMilestoneRewards:[],companionCertificate:{usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"domestic",ticketingFee:99},verified:true}}},airlines:{american:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["aa"],facts:{thresholds:[{tier:"AAdvantage Gold",amount:40000},{tier:"AAdvantage Platinum",amount:75000},{tier:"AAdvantage Platinum Pro",amount:125000},{tier:"AAdvantage Executive Platinum",amount:200000}]}}},hotels:{}}}));
 const a=E.airlineProjection(p,"american",emptyRouting(),["aa_globe"]);
 assert("Globe Flight Streak annual cap holds beyond 12 qualifying segments",a.flightStreakBonus===15000,JSON.stringify(a));
}

{
 const verifiedFacts={snapshotId:"cfu-general-spend",verifiedAt:"2026-09-21",sources:["chase"],cards:{
  chase_preferred:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["chase"],facts:{annualFee:95,earn:{dining:3,grocery:1,online_grocery:3,gas_ev:3,online_retail:1,vacation_home:3,airfare:2,hotel:2,general:1},bookingEarn:{airfare:{chase_travel:5},hotel:{chase_travel:5}},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["travel_protections"],recurringCredits:{chase_travel_hotel_credit:100},multiYearCredits:{trusted_traveler:{amount:120,years:4}},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{hyatt:{defaultRatio:.75,grandfatherBefore:"2026-06-15",grandfatherRatio:1,grandfatherThrough:"2026-09-30"}},transferAccess:{canPool:true,directPartnerTransfer:true},spendRewards:[],statusMilestoneRewards:[],companionCertificate:{},verified:true}},
  chase_freedom_unlimited:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["chase"],facts:{annualFee:0,earn:{dining:3,grocery:1.5,online_grocery:1.5,gas_ev:1.5,online_retail:1.5,vacation_home:1.5,airfare:1.5,hotel:1.5,general:1.5},bookingEarn:{airfare:{chase_travel:5},hotel:{chase_travel:5}},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["travel_protections"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},transferAccess:{canPool:true,directPartnerTransfer:false},spendRewards:[],statusMilestoneRewards:[],companionCertificate:{},verified:true}}
 },airlines:{},hotels:{}};
 const p=E.normalizeProfile(base({
  spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:100000},
  currentCards:["chase_preferred"],currentRouting:{...emptyRouting(),general:[{card:"chase_preferred",amount:100000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{}},redemptionPartner:"hyatt",cardOpenDate:{chase_preferred:"2026-01-01"},
  currencyUtility:{chase_ur:1,hyatt_points:1,amex_mr:.2,capital_one_miles:.2},legacyNaturalBenefitValue:{},cardUniqueBenefitValue:{},benefitValueByType:{},
  explicitBenefitUse:{},constraints:{maxNewCards:1},verifiedFacts
 }));
 const travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel);
 const preferred=E.strategyRecord(p,["chase_preferred"],"base",travel,rewards);
 const combo=E.strategyRecord(p,["chase_preferred","chase_freedom_unlimited"],"base",travel,rewards);
 const prefGeneral=(preferred.annualRouting.general||[]).find(x=>x.card==="chase_preferred")?.amount||0;
 const cfuGeneral=(combo.annualRouting.general||[]).find(x=>x.card==="chase_freedom_unlimited")?.amount||0;
 assert("Freedom Unlimited alias is recognized",E.matchCard("Chase Freedom Unlimited")==="chase_freedom_unlimited");
 assert("Freedom Unlimited is present in Chase candidate portfolios",E.candidatePortfolios(p,rewards).some(x=>x.includes("chase_freedom_unlimited")));
 assert("Preferred-only routes $100K general spend at 1X",prefGeneral===100000,JSON.stringify(preferred.annualRouting.general));
 assert("Preferred plus Freedom Unlimited routes $100K general spend to CFU at 1.5X",cfuGeneral===100000,JSON.stringify(combo.annualRouting.general));
 assert("CFU increases Chase UR production from 100K to 150K",preferred.economics.pointsByCurrency.chase_ur===100000&&combo.economics.pointsByCurrency.chase_ur===150000,JSON.stringify({preferred:preferred.economics.pointsByCurrency,combo:combo.economics.pointsByCurrency}));
 const cfuOnly=E.normalizeProfile(base({
  spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:100000},
  currentCards:["chase_freedom_unlimited"],currentRouting:{...emptyRouting(),general:[{card:"chase_freedom_unlimited",amount:100000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:2,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},
  redemptionPartner:"hyatt",currencyUtility:{chase_ur:1,hyatt_points:1},constraints:{maxNewCards:0},verifiedFacts
 }));
 const cfuValue=E.currencyPointValue(cfuOnly,"chase_ur","base",["chase_freedom_unlimited"]);
 const pooledValue=E.currencyPointValue(p,"chase_ur","base",["chase_preferred","chase_freedom_unlimited"]);
 assert("Freedom Unlimited alone does not receive Hyatt-transfer valuation",Math.abs(cfuValue-cfuOnly.valuationSnapshot.values.chase_ur)<1e-12,JSON.stringify({cfuValue}));
 assert("temporary Preferred Hyatt grandfathering does not inflate recurring pooled-point value",Math.abs(pooledValue-(p.valuationSnapshot.values.hyatt_points*.75))<1e-12&&E.temporaryTransferRatio("chase_preferred","hyatt",p)?.ratio===1,JSON.stringify({pooledValue,temp:E.temporaryTransferRatio("chase_preferred","hyatt",p)}));
}

{
 const expected=["amex_green","chase_freedom_flex","venture_one","delta_blue","delta_gold","united_gateway","aa_mileup","aa_platinum_select","southwest_plus","southwest_premier","marriott_bold","marriott_bountiful","marriott_bevy"];
 assert("alpha.17 catalog includes all 13 newly audited acquisition candidates",expected.every(id=>!!E.RULES.cards[id]&&E.CARD_COVERAGE_V17.candidate.includes(id)));
 assert("Freedom Rise is existing-only",E.matchCard("Freedom Rise")==="chase_freedom_rise"&&E.EXISTING_ONLY_CARDS_V17.includes("chase_freedom_rise")&&!E.CARD_COVERAGE_V17.candidate.includes("chase_freedom_rise"));
 assert("new card aliases resolve",E.matchCard("Amex Green")==="amex_green"&&E.matchCard("Freedom Flex")==="chase_freedom_flex"&&E.matchCard("VentureOne")==="venture_one"&&E.matchCard("Delta Gold")==="delta_gold"&&E.matchCard("United Gateway")==="united_gateway"&&E.matchCard("AAdvantage MileUp")==="aa_mileup"&&E.matchCard("Southwest Premier")==="southwest_premier"&&E.matchCard("Marriott Bonvoy Bevy")==="marriott_bevy");
}
{
 const p=E.normalizeProfile(base({spend:{drugstore:4321,transit:8765,general:1000}})),q=E.normalizeProfile(base({spend:{general:1000}}));
 assert("optional transit and drugstore spend normalize without breaking old profiles",p.spend.transit===8765&&p.spend.drugstore===4321&&q.spend.transit===0&&q.spend.drugstore===0);
}
{
 const p=E.normalizeProfile(base({spend:{dining:30000,grocery:20000,transit:12000,vacation_home:10000,airfare:15000,hotel:25000,general:38000},currentCards:["amex_gold","amex_platinum"],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},currencyUtility:{amex_mr:1,chase_ur:.1,capital_one_miles:.1},constraints:{maxNewCards:1}}));
 const rewards={primaryCurrency:"amex_mr",reason:"test",primaryCards:E.CANDIDATE_FAMILIES_V17.flex.amex_mr},r=E.routeAnnual(p,["amex_gold","amex_platinum","amex_green"],"base",rewards);
 assert("Green captures supported broad travel and transit spend",(r.transit||[])[0]?.card==="amex_green"&&(r.hotel||[])[0]?.card==="amex_green"&&(r.vacation_home||[])[0]?.card==="amex_green");
}
{
 const p=E.normalizeProfile(base({primaryAirline:"southwest",primaryAirlineShare:.9,annualOneWayFlights:24,statusProgress:{southwest:{tqp:50000,qualifyingFlights:0},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:10000},southwest:{tqp:0,qualifyingFlights:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0}));
 const a=E.airlineProjection(p,"southwest",{...emptyRouting(),general:[{card:"southwest_premier",amount:10000}]},["southwest_premier"]);
 assert("Southwest Premier TQP spend mechanic works",a.metric===53000,JSON.stringify(a));
}
{
 for(const id of ["aa_mileup","aa_platinum_select"]){
  const p=E.normalizeProfile(base({primaryAirline:"american",primaryAirlineShare:.9,annualOneWayFlights:12,statusProgress:{american:{loyaltyPoints:50000},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{general:10000},loyaltyPoints:0,qualifyingSegments:0},primaryHotel:"",primaryHotelShare:0}));
  const a=E.airlineProjection(p,"american",{...emptyRouting(),general:[{card:id,amount:10000}]},[id]);
  assert(id+" Loyalty Point earning works",a.metric===60000,JSON.stringify(a));
 }
}


{
 const p=E.normalizeProfile(base({primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:4,currentCards:["amex_gold","amex_platinum","delta_reserve"],currentRouting:emptyRouting(),primaryHotel:"",primaryHotelShare:0,statusProgress:{delta:{mqd:7000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:100000},delta:{mqd:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:1}}));
 const sel=E.selectForScenario(p,"base"),d=sel.newCardClassifications.find(x=>x.cardId==="delta_platinum");
 assert("airline co-brand additions use the universal classification",!!d&&["recommended","consider","do_not_surface"].includes(d.classification),JSON.stringify(sel.newCardClassifications));
}
{
 const p=E.normalizeProfile(base({primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},primaryHotel:"",primaryHotelShare:0,currentCards:["amex_gold","amex_platinum","delta_reserve"],currentRouting:emptyRouting(),statusProgress:{delta:{mqd:7000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:100000},delta:{mqd:0},hotel:{qualifyingNights:0}},constraints:{}}));
 const rewards=E.rewardsStrategy(p,E.travelStrategy(p)),sets=E.candidatePortfolios(p,rewards);
 assert("candidate generation has no system six-card or two-new-card ceiling",sets.some(x=>x.length>=7&&x.filter(id=>!p.currentCards.includes(id)).length>=4),String(Math.max(...sets.map(x=>x.length))));
}
{
 const r=E.analyze(base({valuationSnapshot:{},constraints:{maxNewCards:0}}));
 assert("missing approved valuation snapshot fails recommendation precision closed",r.current.quality.precisionSuppressed===true&&r.current.quality.issues.some(x=>x.code==="valuation_snapshot_incomplete"&&x.severity==="blocking")&&r.recommended.id==="current",JSON.stringify({quality:r.current.quality,recommended:r.recommended.id}));
}
{
 const p=E.normalizeProfile(base({
  spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:250000},
  currentCards:["amex_gold","delta_reserve"],currentRouting:{...emptyRouting(),general:[{card:"amex_gold",amount:250000}]},
  primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:4,currentAirlineStatus:"",
  statusProgress:{delta:{mqd:7000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:250000},delta:{mqd:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0},
  verifiedFacts:{snapshotId:"missing-tier-benefits",verifiedAt:"2026-09-21",sources:["delta"],airlines:{delta:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["delta"],facts:{thresholds:[{tier:"Silver Medallion",amount:5000},{tier:"Gold Medallion",amount:10000},{tier:"Platinum Medallion",amount:15000},{tier:"Diamond Medallion",amount:28000}]}}}}
 }));
 const r=E.strategyRecord(p,["amex_gold","delta_reserve"],"base"),ladder=r.strategy.airlineStatusLadder;
 assert("missing decision-sensitive tier benefits fails higher-status selection closed",ladder.rows.find(x=>x.tier==="Diamond Medallion")?.reachable===true&&ladder.decisionSensitiveBenefitFactsMissing===true&&r.quality.issues.some(x=>x.code==="airline_tier_benefits_unresolved")&&ladder.selected?.tier==="Silver Medallion",JSON.stringify(ladder));
}


{
 const v=E.CURRENT_QP_VALUATION_SNAPSHOT;
 assert("approved September 2026 valuation snapshot is locked",v.snapshotId==="qp-valuations-2026-09-21-v1"&&v.reviewStatus==="approved"&&v.approved===true&&v.effectiveDate==="2026-09-21");
 assert("September 2026 currency values match reviewed benchmark",v.values.amex_mr===.020&&v.values.chase_ur===.0205&&v.values.capital_one_miles===.0185&&v.values.skymiles===.012&&v.values.united_miles===.012&&v.values.aadvantage===.0145&&v.values.southwest_points===.0125&&v.values.hyatt_points===.0165&&v.values.marriott_points===.0075&&v.values.hilton_points===.004,JSON.stringify(v.values));
 assert("domestic companion benchmark uses latest published round-trip average",v.companionBenchmarks.domesticRoundTripFare===522&&v.companionBenchmarks.variableChargeMethod==="use_verified_max_when_bounded",JSON.stringify(v.companionBenchmarks));
}
function companionFacts(cards){
 return{snapshotId:"companion-v19",verifiedAt:"2026-09-21",sources:["issuer"],cards:Object.fromEntries(cards.map(([id,cert])=>[id,{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["issuer"],facts:{...E.RULES.cards[id],companionCertificate:cert,verified:true}}]))};
}
{
 const vf=companionFacts([["delta_platinum",{usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"us_mexico_caribbean_central_america",domesticEligible:true,domesticMaxTaxesFees:80,renewalRequired:true}]]);
 const yes=E.normalizeProfile(base({verifiedFacts:vf,companionTravelIntent:"Yes",companionTravelFrequency:"1 round trip/year"})),high=E.normalizeProfile(base({verifiedFacts:vf,companionTravelIntent:"Yes",companionTravelFrequency:"7+"}));
 const a=E.companionCertificatePortfolioValue(yes,["delta_platinum"]),b=E.companionCertificatePortfolioValue(high,["delta_platinum"]);
 assert("Delta one-use companion certificate values at conservative $442 domestic benchmark",a.totalValue===442&&a.uses===1,JSON.stringify(a));
 assert("one-use companion certificate is not multiplied by higher expected frequency",b.totalValue===442&&b.uses===1,JSON.stringify(b));
}
{
 const vf=companionFacts([["delta_platinum",{usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"domestic",domesticEligible:true,domesticMaxTaxesFees:80,renewalRequired:true}]]);
 const no=E.normalizeProfile(base({verifiedFacts:vf,companionTravelIntent:"No",benefitValueByType:{companion_certificate_renewal:999}})),unsure=E.normalizeProfile(base({verifiedFacts:vf,companionTravelIntent:"Not sure",benefitValueByType:{companion_certificate_renewal:999}}));
 const n=E.portfolioRecurringBenefitValue(no,["delta_platinum"]),u=E.portfolioRecurringBenefitValue(unsure,["delta_platinum"]);
 assert("No future companion use forces quantitative certificate value to zero",n.totalValue===0&&n.companion.totalValue===0,JSON.stringify(n));
 assert("Not sure leaves companion certificate qualitative with zero quantitative value",u.totalValue===0&&u.companion.totalValue===0,JSON.stringify(u));
}
{
 const cert={usesPerYear:1,tripType:"round_trip",geography:"domestic",domesticEligible:true,domesticMaxTaxesFees:80,renewalRequired:true};
 const vf=companionFacts([["delta_platinum",{...cert,cabin:"main_cabin"}],["delta_reserve",{...cert,cabin:"first_premium_select_comfort_main"}]]);
 const one=E.normalizeProfile(base({verifiedFacts:vf,companionTravelIntent:"Yes",companionTravelFrequency:"1"})),two=E.normalizeProfile(base({verifiedFacts:vf,companionTravelIntent:"Yes",companionTravelFrequency:"2-3"}));
 const a=E.companionCertificatePortfolioValue(one,["delta_platinum","delta_reserve"]),b=E.companionCertificatePortfolioValue(two,["delta_platinum","delta_reserve"]);
 assert("two certificates do not double-count one expected companion trip",a.totalValue===442&&a.uses===1,JSON.stringify(a));
 assert("two distinct one-use certificates can cover two expected trips but each remains capped at one use",b.totalValue===884&&b.uses===2&&Object.values(b.byCard).every(x=>x.uses===1),JSON.stringify(b));
}
{
 const vf=companionFacts([["aa_globe",{usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"domestic",domesticEligible:true,ticketingFee:99,renewalRequired:true}]]);
 const p=E.normalizeProfile(base({verifiedFacts:vf,companionTravelIntent:"Yes",companionTravelFrequency:"1"})),x=E.companionCertificatePortfolioValue(p,["aa_globe"]);
 assert("variable unbounded companion taxes remain quantitatively unresolved",x.totalValue===0&&x.unresolved.some(y=>y.cardId==="aa_globe"&&y.reason==="mandatory_companion_charges_unresolved"),JSON.stringify(x));
}
{
 const p=E.normalizeProfile(base({companionTravelIntent:"Yes",companionTravelFrequency:"4-6"}));
 assert("future companion intake normalizes frequency without multiplying a one-use certificate",p.companionTravel.intent==="yes"&&p.companionTravel.frequency==="4_6"&&p.companionTravel.minimumExpectedRoundTrips===4,JSON.stringify(p.companionTravel));
}

function deltaTierFactsV20({complete=true,verifiedFixed=true}={}){
 const rows=[
  {tier:"Silver Medallion",earningRate:7,upgradeWindowHours:24,boardingGroup:"Zone 5",coverageComplete:complete,verified:true},
  {tier:"Gold Medallion",earningRate:8,upgradeWindowHours:72,boardingGroup:"Zone 4",coverageComplete:complete,verified:true},
  {tier:"Platinum Medallion",earningRate:9,upgradeWindowHours:120,boardingGroup:"Zone 4",choiceBenefitsCount:1,travelVoucherValue:350,travelVoucherRepeatable:true,fixedAnnualValue:350,fixedAnnualValueVerified:verifiedFixed,coverageComplete:complete,verified:true},
  {tier:"Diamond Medallion",earningRate:11,upgradeWindowHours:120,boardingGroup:"Zone 2",choiceBenefitsCount:3,travelVoucherValue:550,travelVoucherRepeatable:true,fixedAnnualValue:1650,fixedAnnualValueVerified:verifiedFixed,coverageComplete:complete,verified:true}
 ];
 return{snapshotId:"delta-tier-v20",verifiedAt:"2026-09-21",sources:["https://www.delta.com/us/en/skymiles/medallion-program/medallion-benefits","https://www.delta.com/content/www/en_US/skymiles/medallion-program/choice-benefits/choice-benefits.html"],airlines:{delta:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["https://www.delta.com/us/en/skymiles/medallion-program/medallion-benefits","https://www.delta.com/content/www/en_US/skymiles/medallion-program/choice-benefits/choice-benefits.html"],facts:{thresholds:[{tier:"Silver Medallion",amount:5000},{tier:"Gold Medallion",amount:10000},{tier:"Platinum Medallion",amount:15000},{tier:"Diamond Medallion",amount:28000}],tierBenefits:rows}}}};
}
{
 const p=E.normalizeProfile(base({verifiedFacts:deltaTierFactsV20({complete:false}),primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:4,currentCards:["amex_gold","delta_reserve"],currentRouting:emptyRouting(),primaryHotel:"",primaryHotelShare:0,statusProgress:{delta:{mqd:7000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:250000},delta:{mqd:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}}));
 const r=E.strategyRecord(p,["amex_gold","delta_reserve"],"base"),ladder=r.strategy.airlineStatusLadder;
 assert("Delta earning-rate rows alone are not complete tier-benefit coverage",ladder.benefitFactsComplete===false&&ladder.decisionSensitiveBenefitFactsMissing===true&&r.quality.issues.some(x=>x.code==="airline_tier_benefits_unresolved"),JSON.stringify(ladder));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:deltaTierFactsV20(),primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:4,currentCards:["amex_gold","delta_reserve"],currentRouting:emptyRouting(),primaryHotel:"",primaryHotelShare:0,statusProgress:{delta:{mqd:7000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:250000},delta:{mqd:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}}));
 const ladder=E.strategyRecord(p,["amex_gold","delta_reserve"],"base").strategy.airlineStatusLadder;
 assert("covered Delta tier inventory satisfies the engine completeness gate",ladder.benefitFactsComplete===true&&ladder.decisionSensitiveBenefitFactsMissing===false,JSON.stringify(ladder));
}
{
 const p=E.normalizeProfile(base({
  verifiedFacts:deltaTierFactsV20(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:120000,hotel:0,general:30000},
  currentCards:["delta_platinum","venture"],currentRouting:{...emptyRouting(),airfare:[{card:"delta_platinum",amount:120000}],general:[{card:"venture",amount:30000}]},
  currentAirlineStatus:"Gold Medallion",primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:12,
  statusProgress:{delta:{mqd:14500},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{airfare:110000},delta:{mqd:500},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,
  companionTravelIntent:"No",legacyNaturalBenefitValue:{},constraints:{maxNewCards:1}
 }));
 const travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel),cur=E.currentRecord(p,"base",travel,rewards),diamond=E.strategyRecord(p,["delta_reserve","venture"],"base",travel,rewards);
 assert("projected Platinum carries only the verified $350 fixed Choice Benefit floor",cur.outcomes.flightQuality.projectedStatus==="Platinum Medallion"&&cur.economics.statusBenefitValue===350,JSON.stringify(cur.economics));
 assert("projected Diamond carries $1,650 fixed repeatable-voucher floor and $1,300 incremental versus Platinum",diamond.outcomes.flightQuality.projectedStatus==="Diamond Medallion"&&diamond.economics.statusBenefitValue===1650&&diamond.economics.statusBenefitValue-cur.economics.statusBenefitValue===1300,JSON.stringify({current:cur.economics,diamond:diamond.economics}));
}
{
 const p=E.normalizeProfile(base({
  verifiedFacts:deltaTierFactsV20({verifiedFixed:false}),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:120000,hotel:0,general:30000},
  currentCards:["delta_platinum","venture"],currentRouting:{...emptyRouting(),airfare:[{card:"delta_platinum",amount:120000}],general:[{card:"venture",amount:30000}]},
  currentAirlineStatus:"Gold Medallion",primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:12,
  statusProgress:{delta:{mqd:14500},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{airfare:110000},delta:{mqd:500},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{}
 }));
 const r=E.currentRecord(p,"base");
 assert("unverified status lump sums cannot enter recurring economics",r.economics.statusBenefitValue===0,JSON.stringify(r.economics));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));
 assert("alpha.27 fixed-status integrity flags are present",r.integrity.verifiedFixedStatusComponentsOnly===true&&r.integrity.statusFixedBenefitIncludedInRecurringEconomics===true&&r.integrity.deltaTierBenefitCoverageRequired===true,JSON.stringify(r.integrity));
}


{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum"],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,routeFit:{},annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},statusProgress:{hotel:{qualifyingNights:0}}}));
 const x=E.portfolioRecurringBenefitValue(p,["amex_platinum"]),visible=E.visibleBenefits(["amex_platinum"],p).map(v=>v.benefit);
 assert("travel-first scope excludes Platinum lifestyle credits while retaining in-scope travel value",x.totalValue===1649&&x.excludedByScope.some(v=>v.benefit==="digital_entertainment_credit")&&x.excludedByScope.some(v=>v.benefit==="lululemon_credit"),JSON.stringify(x));
 assert("out-of-scope Platinum perks remain visible qualitatively",visible.includes("digital_entertainment_credit"),JSON.stringify(visible));
}
{
 const p=E.normalizeProfile(base({benefitValueByType:{digital_entertainment_credit:9999,hotel_credit:100},currentCards:["amex_platinum"],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,routeFit:{},annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},statusProgress:{hotel:{qualifyingNights:0}}}));
 const x=E.portfolioRecurringBenefitValue(p,["amex_platinum"]);
 assert("typed lifestyle values cannot bypass the travel-first economic scope",!Object.prototype.hasOwnProperty.call(x.byType,"digital_entertainment_credit")&&x.totalValue===1649,JSON.stringify(x));
}
{
 const p=E.normalizeProfile(base({cardUniqueBenefitValue:{amex_platinum:4000},currentCards:["amex_platinum"],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,remainingYear:{cardSpend:{}},statusProgress:{hotel:{qualifyingNights:0}}}));
 const x=E.portfolioRecurringBenefitValue(p,["amex_platinum"]);
 assert("unscoped legacy aggregate is retained as uncertainty but cannot enter recurring economics",x.totalValue===1649&&x.residualValue===0&&x.unresolvedResidualValue===2351&&x.residualByCard.amex_platinum===2351,JSON.stringify(x));
}
{
 const cert={usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"domestic",domesticEligible:true,domesticMaxTaxesFees:80,renewalRequired:true};
 const vf=companionFacts([["delta_platinum",cert]]);
 const p=E.normalizeProfile(base({verifiedFacts:vf,companionTravelIntent:"Yes",companionTravelFrequency:"1"}));
 const x=E.companionCertificatePortfolioValue(p,["amex_gold","amex_platinum","delta_platinum"]);
 assert("non-companion cards never appear as unresolved companion certificates",x.unresolved.length===0&&Object.keys(x.byCard).length===1&&x.byCard.delta_platinum.value===442,JSON.stringify(x));
}
{
 const cert={usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"domestic",domesticEligible:true,domesticMaxTaxesFees:80,renewalRequired:true};
 const vf=companionFacts([["delta_platinum",cert]]);
 const p=E.normalizeProfile(base({verifiedFacts:vf,benefitValueByType:{companion_certificate_renewal:999}}));
 const x=E.portfolioRecurringBenefitValue(p,["delta_platinum"]);
 assert("unanswered companion intake cannot inherit a legacy quantitative certificate value",x.companion.totalValue===0&&!Object.prototype.hasOwnProperty.call(x.byType,"companion_certificate_renewal"),JSON.stringify(x));
}
function deltaFullFactsV21(){
 const vf=deltaTierFactsV20(),one={dining:1,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1};
 const rec=(facts)=>({verificationStatus:"verified",complete:true,verifiedAt:"2026-09-21",sources:["issuer"],facts:{...facts,verified:true}});
 vf.cards={
  delta_reserve:rec({annualFee:650,currency:"skymiles",earn:{...one,airfare:3},benefitTags:["lounge","upgrade_priority","upgrade_eligibility","checked_bag","companion_certificate_renewal","global_entry_tsa","award_discount","boarding_benefits","inflight_savings"],recurringCredits:{rideshare_credit:120,resy_credit:240,delta_stays_credit:200},multiYearCredits:{trusted_traveler:{amount:120,years:4}},status:{headstart:2500,spendDivisor:10},companionCertificate:{usesPerYear:1,tripType:"round_trip",cabin:"first_premium_select_comfort_main",geography:"us_mexico_caribbean_central_america",domesticEligible:true,domesticMaxTaxesFees:80,renewalRequired:true}}),
  delta_platinum:rec({annualFee:350,currency:"skymiles",earn:{...one,airfare:3,hotel:3,dining:2,grocery:2,online_grocery:2},benefitTags:["upgrade_eligibility","checked_bag","companion_certificate_renewal","global_entry_tsa","award_discount","boarding_benefits","inflight_savings"],recurringCredits:{rideshare_credit:120,resy_credit:120,delta_stays_credit:150},multiYearCredits:{trusted_traveler:{amount:120,years:4}},status:{headstart:2500,spendDivisor:20},companionCertificate:{usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"us_mexico_caribbean_central_america",domesticEligible:true,domesticMaxTaxesFees:80,renewalRequired:true}})
 };
 return vf;
}
function deltaAcquisitionV21(freq){
 const p=E.normalizeProfile(base({
  verifiedFacts:deltaFullFactsV21(),spend:{dining:45000,grocery:25000,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:4500,hotel:0,general:125500},
  currentCards:["amex_gold","amex_platinum","delta_reserve"],currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:45000}],grocery:[{card:"amex_gold",amount:25000}],airfare:[{card:"amex_platinum",amount:4500}],general:[{card:"delta_reserve",amount:125500}]},
  primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:12,currentAirlineStatus:"",statusProgress:{delta:{mqd:7000},hotel:{qualifyingNights:0}},
  remainingYear:{cardSpend:{dining:45000,grocery:25000,airfare:4500,general:125500},delta:{mqd:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,
  companionTravelIntent:"Yes",companionTravelFrequency:freq,legacyNaturalBenefitValue:{},constraints:{maxNewCards:1}
 }));
 const t=E.travelStrategy(p),r=E.rewardsStrategy(p,t),without=E.strategyRecord(p,["amex_gold","amex_platinum","delta_reserve"],"base",t,r),withP=E.strategyRecord(p,["amex_gold","amex_platinum","delta_reserve","delta_platinum"],"base",t,r);
 const delta=roundForTest(withP.economics.netEconomicValue-without.economics.netEconomicValue);
 return{delta,className:E.classifyNewCardValue(delta),without,withP};
}
{
 const x=deltaAcquisitionV21("1");
 assert("Delta full-benefit expert case: one expected companion trip makes Platinum a $240 Consider",x.delta===240&&x.className==="consider"&&x.withP.economics.temporaryOpportunityCost===440&&x.without.economics.temporaryOpportunityCost===640,JSON.stringify({delta:x.delta,className:x.className,without:x.without.economics,withP:x.withP.economics}));
}
{
 const x=deltaAcquisitionV21("2-3");
 assert("Delta full-benefit expert case: second realistic companion trip makes Platinum a $682 Recommended",x.delta===682&&x.className==="recommended"&&x.withP.economics.portfolioRecurringBenefits.companion.totalValue===884&&x.without.economics.portfolioRecurringBenefits.companion.totalValue===442,JSON.stringify({delta:x.delta,className:x.className,without:x.without.economics,withP:x.withP.economics}));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));
 assert("alpha.27 scope and companion integrity flags are present",r.integrity.travelFirstBenefitScopeEnforced===true&&r.integrity.unscopedLegacyBenefitTotalsExcludedFromEconomics===true&&r.integrity.unansweredCompanionCannotUseLegacyValue===true,JSON.stringify(r.integrity));
}


{
 const p=E.normalizeProfile(base({
  verifiedFacts:deltaTierFactsV20(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:130000},
  currentCards:["amex_gold","delta_reserve"],currentRouting:{...emptyRouting(),general:[{card:"amex_gold",amount:130000}]},
  currentAirlineStatus:"Platinum Medallion",primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:4,
  statusProgress:{delta:{mqd:15000},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:130000},delta:{mqd:0},hotel:{qualifyingNights:0}},
  primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}
 }));
 const travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel),r=E.strategyRecord(p,["amex_gold","delta_reserve"],"base",travel,rewards),d=r.strategy.airlineStatusLadder.rows.find(x=>x.tier==="Diamond Medallion");
 assert("Delta expert ladder selects Diamond when $1,300 incremental fixed Choice Benefit value exceeds $1,040 opportunity cost",d?.reachable===true&&d?.opportunityCost===1040&&d?.selected===true&&r.strategy.airlineStatusTarget?.tier==="Diamond Medallion",JSON.stringify({diamond:d,target:r.strategy.airlineStatusTarget}));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));
 assert("alpha.27 repeatable Delta Choice Benefit integrity flag is present",r.integrity.deltaRepeatableChoiceBenefitFloor===true,JSON.stringify(r.integrity));
}


function unitedTierFactsV23({complete=true}={}){
 const rows=[
  {tier:"Premier Silver",upgradeWindowHours:0,seating:"economy_plus_at_checkin",premierAccess:true,coverageComplete:complete,verified:true},
  {tier:"Premier Gold",upgradeWindowHours:48,seating:"economy_plus_at_booking_one_companion",checkedBags:2,boardingGroup:"group_1",starAllianceStatus:"gold",coverageComplete:complete,verified:true},
  {tier:"Premier Platinum",upgradeWindowHours:72,seating:"economy_plus_at_booking_up_to_8_companions",checkedBags:3,boardingGroup:"group_1",plusPoints:40,coverageComplete:complete,verified:true},
  {tier:"Premier 1K",upgradeWindowHours:96,seating:"economy_plus_at_booking_up_to_8_companions",checkedBags:3,boardingGroup:"preboarding",plusPoints:320,additionalPlusPointsAt1K:280,coverageComplete:complete,verified:true}
 ];
 return{snapshotId:"united-tier-v23",verifiedAt:"2026-09-22",sources:["united"],airlines:{united:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["united"],facts:{minimumUnitedSegments:4,thresholds:[
  {tier:"Premier Silver",pqpWithPQF:5000,pqf:15,pqpOnly:6000,amount:6000},{tier:"Premier Gold",pqpWithPQF:10000,pqf:30,pqpOnly:12000,amount:12000},{tier:"Premier Platinum",pqpWithPQF:15000,pqf:45,pqpOnly:18000,amount:18000},{tier:"Premier 1K",pqpWithPQF:22000,pqf:60,pqpOnly:28000,amount:28000}
 ],tierBenefits:rows}}}};
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedTierFactsV23(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:12,currentAirlineStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{united:{pqp:9000,pqf:25,unitedSegments:2},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:1000,pqf:5,unitedSegments:2},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const a=E.airlineProjection(p,"united",emptyRouting(),[]);
 assert("United verified threshold schema reaches Gold through the 30-PQF plus 10,000-PQP path",a.tier==="Premier Gold"&&a.metric===10000&&a.pqf===30&&a.unitedSegments===4,JSON.stringify(a));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedTierFactsV23(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:12,currentAirlineStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{united:{pqp:9000,pqf:24,unitedSegments:2},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:1000,pqf:5,unitedSegments:2},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const a=E.airlineProjection(p,"united",emptyRouting(),[]);
 assert("United falls back to the PQP-only path when the PQF requirement is not met",a.tier==="Premier Silver"&&a.metric===10000&&a.pqf===29,JSON.stringify(a));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedTierFactsV23(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:12,currentAirlineStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{united:{pqp:12000,pqf:30,unitedSegments:2},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:0,pqf:0,unitedSegments:1},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const a=E.airlineProjection(p,"united",emptyRouting(),[]);
 assert("United four-operated-segment minimum blocks Premier status even when PQP and PQF thresholds are met",a.tier===""&&a.unitedSegments===3&&a.unitedSegmentsKnown===true,JSON.stringify(a));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedTierFactsV23(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:12,currentAirlineStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{united:{pqp:12000,pqf:30},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:0,pqf:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const a=E.airlineProjection(p,"united",emptyRouting(),[]);
 assert("unknown United-operated segment count does not invent Premier status",a.tier===""&&a.unitedSegmentsKnown===false,JSON.stringify(a));
}
{
 const common={verifiedFacts:unitedTierFactsV23(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:4,currentAirlineStatus:"",currentCards:["united_quest"],currentRouting:emptyRouting(),statusProgress:{united:{pqp:4000,pqf:15,unitedSegments:4},hotel:{qualifyingNights:0}},cardStatusProgressYTD:{united_quest:{pqp:0}},remainingYear:{cardSpend:{},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}};
 const yes=E.normalizeProfile(base({...common,cardTenure:{united_quest:{futureAnnualBonusEligible:true}}})),no=E.normalizeProfile(base({...common,cardTenure:{united_quest:{futureAnnualBonusEligible:false}}}));
 const ay=E.airlineProjection(yes,"united",emptyRouting(),["united_quest"]),an=E.airlineProjection(no,"united",emptyRouting(),["united_quest"]);
 assert("United Quest annual Card Bonus PQP is counted only when future annual-bonus eligibility is established",ay.metric===5000&&ay.tier==="Premier Silver"&&an.metric===4000&&an.tier==="",JSON.stringify({eligible:ay,ineligible:an}));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedTierFactsV23(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:4,currentAirlineStatus:"",currentCards:["united_explorer"],currentRouting:emptyRouting(),statusProgress:{united:{pqp:4900,pqf:15,unitedSegments:4},hotel:{qualifyingNights:0}},cardStatusProgressYTD:{united_explorer:{pqp:900}},remainingYear:{cardSpend:{general:10000},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const a=E.airlineProjection(p,"united",{...emptyRouting(),general:[{card:"united_explorer",amount:10000}]},["united_explorer"]);
 assert("United card PQP annual cap subtracts already-earned YTD card PQP",a.metric===5000&&a.tier==="Premier Silver",JSON.stringify(a));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedTierFactsV23(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:4,currentAirlineStatus:"",currentCards:["united_explorer"],currentRouting:emptyRouting(),statusProgress:{united:{pqp:4900,pqf:15,unitedSegments:4},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:20000},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const a=E.airlineProjection(p,"united",{...emptyRouting(),general:[{card:"united_explorer",amount:20000}]},["united_explorer"]),r=E.strategyRecord(p,["united_explorer"],"base");
 assert("missing existing-card United PQP progress fails card-spend qualification closed",a.metric===4900&&a.uncertainties.includes("united_card_pqp_progress_missing:united_explorer")&&r.quality.issues.some(x=>x.code==="united_card_pqp_progress_missing"),JSON.stringify({projection:a,quality:r.quality}));
}
{
 const shared={primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:4,currentAirlineStatus:"Premier Silver",currentCards:["amex_gold","united_quest"],currentRouting:{...emptyRouting(),general:[{card:"amex_gold",amount:83000}]},statusProgress:{united:{pqp:6000,pqf:15,unitedSegments:4},hotel:{qualifyingNights:0}},cardStatusProgressYTD:{united_quest:{pqp:0}},remainingYear:{cardSpend:{general:120000},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}};
 const bad=E.normalizeProfile(base({...shared,verifiedFacts:unitedTierFactsV23({complete:false})})),bt=E.travelStrategy(bad),br=E.rewardsStrategy(bad,bt),rb=E.strategyRecord(bad,["amex_gold","united_quest"],"base",bt,br),goldBad=rb.strategy.airlineStatusLadder.rows.find(x=>x.tier==="Premier Gold");
 assert("incomplete decision-sensitive United tier inventory fails a spend-driven Gold move closed",goldBad?.reachable===true&&goldBad?.opportunityCost>0&&goldBad?.selected===false&&goldBad?.stopReason==="tier_benefits_unresolved"&&rb.strategy.airlineStatusLadder.benefitFactsComplete===false&&rb.quality.issues.some(x=>x.code==="airline_tier_benefits_unresolved"),JSON.stringify({gold:goldBad,ladder:rb.strategy.airlineStatusLadder,quality:rb.quality}));
 const good=E.normalizeProfile(base({...shared,verifiedFacts:unitedTierFactsV23()})),gt=E.travelStrategy(good),gr=E.rewardsStrategy(good,gt),rg=E.strategyRecord(good,["amex_gold","united_quest"],"base",gt,gr),goldGood=rg.strategy.airlineStatusLadder.rows.find(x=>x.tier==="Premier Gold");
 assert("complete United tier inventory is decision-ready but does not invent cash value for qualitative status benefits",rg.strategy.airlineStatusLadder.benefitFactsComplete===true&&goldGood?.reachable===true&&goldGood?.opportunityCost>0&&goldGood?.selected===false&&goldGood?.stopReason==="incremental_quantified_value_below_opportunity_cost"&&!rg.quality.issues.some(x=>x.code==="airline_tier_benefits_unresolved"),JSON.stringify({gold:goldGood,ladder:rg.strategy.airlineStatusLadder,quality:rg.quality}));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));
 assert("alpha.27 United validation integrity flags are present",r.integrity.unitedDecisionSensitiveTierInventory===true&&r.integrity.unitedVerifiedThresholdSchema===true&&r.integrity.unitedStalePremierEarnRatesExcluded===true,JSON.stringify(r.integrity));
}


function unitedCardFactsV25(){
 const mk=(id,facts)=>[id,{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["chase"],facts:{...facts,bookingEarn:facts.bookingEarn||{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},hotelStatus:{},hotelStatusByProgram:{},transferRules:{},transferAccess:{},rotatingBonus:{},statusMilestoneRewards:[],companionCertificate:{},verified:true}}];
 return{snapshotId:"united-card-v25",verifiedAt:"2026-09-22",sources:["chase"],cards:Object.fromEntries([
  mk("united_gateway",{annualFee:0,earn:{dining:1,grocery:1,online_grocery:1,drugstore:1,gas_ev:2,transit:2,online_retail:1,vacation_home:1,airfare:2,hotel:1,general:1},benefitTags:["award_discount_threshold","checked_bag_threshold","inflight_savings"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,annualPointCertificates:[],status:{},spendRewards:[{amount:10000,benefit:"gateway_award_discount_10_percent"},{amount:10000,benefit:"gateway_two_checked_bags"}]}),
  mk("united_explorer",{annualFee:150,earn:{dining:2,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:1,online_retail:1,vacation_home:1,airfare:3,hotel:2,general:1},benefitTags:["priority_boarding","checked_bag"],recurringCredits:{united_hotels_credit:100,rideshare_credit:60,avis_budget_credit:50,instacart_credit:120,jsx_credit:100},multiYearCredits:{trusted_traveler:{amount:120,years:4}},annualBonusPoints:0,annualPointCertificates:[],status:{spendDivisor:20,annualCap:1000},spendRewards:[{amount:10000,benefit:"united_travelbank_100",cashValue:100},{amount:20000,benefit:"award_discount_10k",valuePoints:10000,currency:"united_miles"}]}),
  mk("united_quest",{annualFee:350,earn:{dining:2,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:1,online_retail:1,vacation_home:1,airfare:4,hotel:2,general:1},bookingEarn:{hotel:{renowned_prepaid:5}},benefitTags:["united_travel_benefits","award_discount_annual"],recurringCredits:{united_travel_credit:200,renowned_hotels_credit:150,rideshare_credit:100,avis_budget_credit:80,instacart_credit:180,jsx_credit:150},multiYearCredits:{trusted_traveler:{amount:120,years:4}},annualBonusPoints:0,annualPointCertificates:[{benefit:"award_discount_10k_annual",capPoints:10000,currency:"united_miles",renewalRequired:true}],status:{spendDivisor:20,annualCap:18000,annualBonus:1000,bonusRequiresPriorYearOpen:true},spendRewards:[{amount:20000,benefit:"award_discount_10k",valuePoints:10000,currency:"united_miles"},{amount:40000,benefit:"economy_plus_upgrades_2"}]}),
  mk("united_club",{annualFee:695,earn:{dining:2,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:1,online_retail:1,vacation_home:1,airfare:5,hotel:2,general:1},bookingEarn:{hotel:{renowned_prepaid:5}},benefitTags:["lounge","united_travel_benefits"],recurringCredits:{renowned_hotels_credit:200,rideshare_credit:150,avis_budget_credit:100,instacart_credit:240,jsx_credit:200},multiYearCredits:{trusted_traveler:{amount:120,years:4}},annualBonusPoints:0,annualPointCertificates:[],status:{spendDivisor:15,annualCap:28000,annualBonus:1500,bonusRequiresPriorYearOpen:true},spendRewards:[{amount:20000,benefit:"award_discount_10k_first",valuePoints:10000,currency:"united_miles"},{amount:40000,benefit:"award_discount_10k_second",valuePoints:10000,currency:"united_miles"},{amount:50000,benefit:"united_club_all_access"}]})
 ]),airlines:unitedTierFactsV23().airlines,hotels:{}};
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedCardFactsV25(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:8,currentAirlineStatus:"",currentCards:["amex_gold"],currentRouting:{...emptyRouting(),general:[{card:"amex_gold",amount:30000}]},spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:30000},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:4},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:30000},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:1}}));
 const travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel),r=E.strategyRecord(p,["amex_gold","united_explorer"],"base",travel,rewards),onExplorer=(r.annualRouting.general||[]).find(x=>x.card==="united_explorer")?.amount||0;
 assert("Explorer annual thresholds optimize recurring routing only when reward value exceeds lost rewards",onExplorer===20000&&r.economics.annualSpendRewardValue===220,JSON.stringify({routing:r.annualRouting.general,economics:r.economics,recurringJobs:r.recurringJobs}));
 assert("Explorer annual threshold rewards are recurring jobs, not temporary jobs",r.recurringJobs.filter(j=>j.cardId==="united_explorer").length===2&&!r.temporaryJobs.some(j=>j.cardId==="united_explorer"&&j.type==="spend_reward"),JSON.stringify({recurring:r.recurringJobs,temporary:r.temporaryJobs}));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedCardFactsV25(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:8,currentAirlineStatus:"",currentCards:["amex_gold"],currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:15000}]},spend:{dining:15000,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:4},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{dining:15000},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:1}}));
 const travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel),r=E.strategyRecord(p,["amex_gold","united_explorer"],"base",travel,rewards),spend=(r.annualRouting.dining||[]).find(x=>x.card==="united_explorer")?.amount||0;
 assert("annual-threshold optimizer does not sacrifice protected multiplier spend",spend===0&&r.economics.annualSpendRewardValue===0,JSON.stringify({routing:r.annualRouting.dining,economics:r.economics}));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedCardFactsV25(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:8,currentAirlineStatus:"",currentCards:[],currentRouting:emptyRouting(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:4},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:1}}));
 const travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel),cert=E.portfolioAnnualPointCertificateValue(p,["united_quest"],"base"),r=E.strategyRecord(p,["united_quest"],"base",travel,rewards);
 assert("Quest automatic anniversary 10,000-mile award discount contributes exactly $120 recurring value",cert.totalValue===120&&r.economics.annualPointCertificateValue===120,JSON.stringify({cert,economics:r.economics}));
 assert("Quest award-discount certificate is not misreported as earned miles",!r.economics.pointsByCurrency.united_miles&&r.economics.annualBonusTravelValue===0,JSON.stringify(r.economics));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedCardFactsV25(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:8,currentAirlineStatus:"",currentCards:[],currentRouting:emptyRouting(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:4},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:1}}));
 const x=E.portfolioRecurringBenefitValue(p,["united_quest"]);
 assert("Instacart remains visible but is excluded from travel-first recurring economics",x.excludedByScope.some(y=>y.cardId==="united_quest"&&y.benefit==="instacart_credit"&&y.value===180)&&x.totalValue===710,JSON.stringify(x));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedCardFactsV25(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:4,currentAirlineStatus:"",currentCards:["chase_reserve"],currentRouting:emptyRouting(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:4},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:1}}));
 const sel=E.selectForScenario(p,"base"),q=sel.newCardClassifications.find(x=>x.cardId==="united_quest");
 assert("United Quest acquisition uses the global best-without counterfactual",q?.classification==="do_not_surface"&&q.bestWithoutId.includes("amex_platinum"),JSON.stringify({q,recommended:sel.recommended.id}));
}
{
 const facts=unitedCardFactsV25();facts.cards.united_quest.facts.recurringCredits={instacart_credit:180};facts.cards.united_quest.facts.multiYearCredits={};facts.cards.united_quest.facts.annualPointCertificates=[];facts.cards.united_quest.facts.benefitTags=[];facts.cards.united_quest.facts.status={};facts.cards.united_quest.facts.spendRewards=[];
 const p=base({verifiedFacts:facts,primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,currentCards:["united_quest"],currentRouting:emptyRouting(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}});
 const r=E.analyze(p);
 assert("out-of-scope Instacart credit alone does not prevent removing a negative-value United card",!r.recommended.portfolio.includes("united_quest")&&r.recommended.actions.some(x=>x.cardId==="united_quest"&&x.action==="remove_or_downgrade_after_review"),JSON.stringify({recommended:r.recommended.id,actions:r.recommended.actions,economics:r.current.economics}));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));
 assert("alpha.27 annual-threshold and certificate integrity flags are present",r.integrity.annualThresholdsAreRecurringEconomics===true&&r.integrity.annualThresholdRoutingOptimizedByNetValue===true&&r.integrity.automaticPointCertificatesSeparatedFromPointsEarned===true&&r.integrity.instacartExcludedFromTravelEconomics===true,JSON.stringify(r.integrity));
}


{
 const facts=unitedCardFactsV25(),common={verifiedFacts:facts,primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,currentCards:[],currentRouting:emptyRouting(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}};
 const p=E.normalizeProfile(base(common)),travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel),rec=id=>E.strategyRecord(p,[id],"base",travel,rewards);
 const g=rec("united_gateway"),e=rec("united_explorer"),q=rec("united_quest"),c=rec("united_club");
 assert("United family fixed recurring economics match expert anchors before spend thresholds",g.economics.netEconomicValue===0&&e.economics.recurringBenefitValue===340&&e.economics.netEconomicValue===190&&q.economics.recurringBenefitValue===710&&q.economics.annualPointCertificateValue===120&&q.economics.netEconomicValue===480&&c.economics.recurringBenefitValue===680&&c.economics.netEconomicValue===-15,JSON.stringify({gateway:g.economics,explorer:e.economics,quest:q.economics,club:c.economics}));
}
{
 const facts=unitedCardFactsV25(),mk=hotelMethod=>E.normalizeProfile(base({verifiedFacts:facts,bookingMethod:{hotel:hotelMethod,airfare:"direct_airline"},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,currentCards:[],currentRouting:emptyRouting(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:1000,general:0},primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}}));
 for(const id of ["united_quest","united_club"]){
  const direct=mk("direct_hotel"),dt=E.travelStrategy(direct),dr=E.rewardsStrategy(direct,dt),a=E.strategyRecord(direct,[id],"base",dt,dr);
  const renowned=mk("renowned_prepaid"),rt=E.travelStrategy(renowned),rr=E.rewardsStrategy(renowned,rt),b=E.strategyRecord(renowned,[id],"base",rt,rr);
  assert(id+" ordinary hotel stays earn 2x while prepaid Renowned stays earn 5x",a.economics.pointsByCard[id]===2000&&b.economics.pointsByCard[id]===5000,JSON.stringify({direct:a.economics.pointsByCard,renowned:b.economics.pointsByCard}));
 }
}
{
 const x=unitedCardFactsV25().cards.united_explorer.facts;
 assert("United Explorer current Avis/Budget credit is $50",x.recurringCredits.avis_budget_credit===50,JSON.stringify(x.recurringCredits));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:unitedCardFactsV25(),primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.95},annualOneWayFlights:4,currentAirlineStatus:"",currentCards:["chase_reserve"],currentRouting:emptyRouting(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:4},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:1}}));
 const sel=E.selectForScenario(p,"base"),q=sel.newCardClassifications.find(x=>x.cardId==="united_quest");
 assert("correcting Explorer does not bypass the global counterfactual for Quest",q?.classification==="do_not_surface"&&q.bestWithoutId.includes("amex_platinum"),JSON.stringify(q));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));
 assert("alpha.27 United method-aware closeout integrity flags are present",r.integrity.unitedRenownedHotelMethodAware===true&&r.integrity.unitedFamilyEconomicsClosed===true,JSON.stringify(r.integrity));
}

function americanFactsV26(){
 const mk=(id,facts)=>[id,{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["citi"],facts:{...facts,bookingEarn:facts.bookingEarn||{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},hotelStatus:{},hotelStatusByProgram:{},transferRules:{},transferAccess:{},rotatingBonus:{},annualBonusPoints:0,annualPointCertificates:[],statusMilestoneRewards:facts.statusMilestoneRewards||[],spendRewards:facts.spendRewards||[],companionCertificate:facts.companionCertificate||{},verified:true}}];
 const tierBenefits=[
  {tier:"AAdvantage Gold",earningBonusPct:40,upgradeWindowHours:24,seating:"main_cabin_extra_within_24h",checkedBags:1,boardingGroup:"group_4",oneworldStatus:"Ruby",coverageComplete:true,verified:true},
  {tier:"AAdvantage Platinum",earningBonusPct:60,upgradeWindowHours:48,seating:"main_cabin_extra_at_booking",checkedBags:2,boardingGroup:"group_3",oneworldStatus:"Sapphire",priorityBaggage:true,coverageComplete:true,verified:true},
  {tier:"AAdvantage Platinum Pro",earningBonusPct:80,upgradeWindowHours:72,seating:"main_cabin_extra_at_booking",checkedBags:3,boardingGroup:"group_2",oneworldStatus:"Emerald",priorityBaggage:true,coverageComplete:true,verified:true},
  {tier:"AAdvantage Executive Platinum",earningBonusPct:120,upgradeWindowHours:100,seating:"main_cabin_extra_at_booking",checkedBags:3,boardingGroup:"group_1",oneworldStatus:"Emerald",priorityBaggage:true,coverageComplete:true,verified:true}
 ];
 return{snapshotId:"aa-v26",verifiedAt:"2026-09-22",sources:["citi","aa"],cards:Object.fromEntries([
  mk("aa_mileup",{annualFee:0,earn:{dining:1,grocery:2,online_grocery:2,drugstore:1,gas_ev:1,transit:1,online_retail:1,vacation_home:1,airfare:2,hotel:1,general:1},benefitTags:["inflight_savings"],recurringCredits:{},multiYearCredits:{},status:{lpPerEligiblePurchaseDollar:1}}),
  mk("aa_platinum_select",{annualFee:99,earn:{dining:2,grocery:1,online_grocery:1,drugstore:1,gas_ev:2,transit:1,online_retail:1,vacation_home:1,airfare:2,hotel:1,general:1},benefitTags:["checked_bag","boarding_benefits","inflight_savings","flight_discount_threshold"],recurringCredits:{},multiYearCredits:{},status:{lpPerEligiblePurchaseDollar:1},spendRewards:[{amount:20000,benefit:"aa_flight_discount_125",cashValue:125,renewalRequired:true}]}),
  mk("aa_globe",{annualFee:350,earn:{dining:2,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:2,online_retail:1,vacation_home:1,airfare:3,hotel:1,general:1},bookingEarn:{hotel:{aadvantage_hotels:6}},benefitTags:["lounge","lounge_passes","checked_bag","boarding_benefits","companion_certificate_renewal"],recurringCredits:{turo_credit:240,inflight_credit:100,splurge_credit:100},multiYearCredits:{trusted_traveler:{amount:120,years:4}},status:{lpPerEligiblePurchaseDollar:1,flightStreakBlock:4,flightStreakBonus:5000,flightStreakAnnualCap:15000},companionCertificate:{usesPerYear:1,tripType:"round_trip",cabin:"main_cabin",geography:"domestic",domesticEligible:true,ticketingFee:99,renewalRequired:true}}),
  mk("aa_executive",{annualFee:695,earn:{dining:1,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:1,online_retail:1,vacation_home:1,airfare:4,hotel:1,general:1},bookingEarn:{hotel:{aadvantage_hotels:12}},benefitTags:["lounge","priority_airport","omni_champion_status","loyalty_point_bonus_milestones"],recurringCredits:{aa_vacations_credit:500,lyft_credit:180,inflight_admirals_credit:100,avis_budget_credit:120},multiYearCredits:{trusted_traveler:{amount:120,years:4}},status:{lpPerEligiblePurchaseDollar:1},statusMilestoneRewards:[{metric:"loyaltyPoints",threshold:50000,bonus:10000},{metric:"loyaltyPoints",threshold:90000,bonus:10000},{metric:"loyaltyPoints",threshold:165000,bonus:10000},{metric:"loyaltyPoints",threshold:240000,bonus:10000}],spendRewards:[{amount:150000,benefit:"aa_5x_eligible_aa_remainder"}]})
 ]),airlines:{american:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["aa"],facts:{thresholds:[{tier:"AAdvantage Gold",amount:40000},{tier:"AAdvantage Platinum",amount:75000},{tier:"AAdvantage Platinum Pro",amount:125000},{tier:"AAdvantage Executive Platinum",amount:200000}],tierBenefits}}},hotels:{}};
}
{
 assert("American thresholds and March-February cycle remain current",E.RULES.airlines.american.qualificationCycle==="mar_feb"&&same(E.RULES.airlines.american.thresholds.map(x=>x.amount),[40000,75000,125000,200000]));
 assert("American booking channels are method-specific",E.RULES.cards.aa_globe.earn.hotel===1&&E.RULES.cards.aa_globe.bookingEarn.hotel.aadvantage_hotels===6&&E.RULES.cards.aa_executive.earn.hotel===1&&E.RULES.cards.aa_executive.bookingEarn.hotel.aadvantage_hotels===12);
 assert("Globe four-pass lounge benefit remains distinct from unlimited lounge membership",E.RULES.cards.aa_globe.benefitTags.includes("lounge_passes"));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:americanFactsV26(),primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.95},annualOneWayFlights:12,currentCards:["aa_mileup"],currentRouting:{...emptyRouting(),grocery:[{card:"aa_mileup",amount:10000}]},spend:{dining:0,grocery:10000,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},statusProgress:{american:{loyaltyPoints:0},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{grocery:10000},loyaltyPoints:0,qualifyingSegments:0},remainingYear:{cardSpend:{grocery:10000},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const a=E.airlineProjection(p,"american",{...emptyRouting(),grocery:[{card:"aa_mileup",amount:10000}]},["aa_mileup"]);
 assert("American card bonus miles do not multiply Loyalty Points from card spend",a.metric===10000,JSON.stringify(a));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:americanFactsV26(),primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.95},annualOneWayFlights:24,currentCards:["aa_globe"],currentRouting:emptyRouting(),statusProgress:{american:{loyaltyPoints:0},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{},loyaltyPoints:100000,qualifyingSegments:12},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const a=E.airlineProjection(p,"american",emptyRouting(),["aa_globe"]);
 assert("Globe Flight Streak adds capped 15K Loyalty Points",a.metric===115000&&a.flightStreakBonus===15000,JSON.stringify(a));
 const b=E.portfolioRecurringBenefitValue(p,["aa_globe"]);
 assert("Globe fixed travel credits plus trusted-traveler credit equal $470 recurring value",b.totalValue===470,JSON.stringify(b));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:americanFactsV26(),companionTravel:{intent:"yes",minimumExpectedRoundTrips:1},primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.95},annualOneWayFlights:12,currentCards:["aa_globe"],currentRouting:emptyRouting(),statusProgress:{american:{loyaltyPoints:0},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{},loyaltyPoints:0,qualifyingSegments:4},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const b=E.portfolioRecurringBenefitValue(p,["aa_globe"]);
 assert("Globe companion certificate stays unpriced when itinerary taxes and fees are unbounded",b.companion.totalValue===0&&b.companion.unresolved.some(x=>x.cardId==="aa_globe"&&x.reason==="mandatory_companion_charges_unresolved"),JSON.stringify(b.companion));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:americanFactsV26(),primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.95},annualOneWayFlights:12,currentCards:["aa_executive"],currentRouting:emptyRouting(),statusProgress:{american:{loyaltyPoints:0},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{},loyaltyPoints:0,qualifyingSegments:0},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const b=E.portfolioRecurringBenefitValue(p,["aa_executive"]);
 assert("Executive fixed travel credits plus trusted-traveler credit equal $930 recurring value",b.totalValue===930,JSON.stringify(b));
 const both=E.portfolioRecurringBenefitValue(p,["aa_globe","aa_executive"]);
 assert("Globe and Executive overlap de-duplicates trusted-traveler credit",both.totalValue===1370&&both.byType.trusted_traveler===30,JSON.stringify(both));
 const annual={...emptyRouting(),general:[{card:"aa_platinum_select",amount:20000}]};
 const pp=E.normalizeProfile(base({verifiedFacts:americanFactsV26()}));
 assert("Platinum Select $20K annual flight-discount threshold is recurring $125 economics",E.portfolioAnnualSpendRewardValue(pp,["aa_platinum_select"],annual,"base").totalValue===125);
}
{
 const p=E.normalizeProfile(base({verifiedFacts:americanFactsV26(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:40000,hotel:0,general:0},currentCards:["venture"],currentRouting:{...emptyRouting(),airfare:[{card:"venture",amount:40000}]},remainingYear:{cardSpend:{airfare:40000},hotel:{qualifyingNights:0}},primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.95},annualOneWayFlights:12,currentAirlineStatus:"",statusProgress:{american:{loyaltyPoints:0},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{},loyaltyPoints:0,qualifyingSegments:0},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:"",currencyUtility:{capital_one_miles:.95,aadvantage:1},legacyNaturalBenefitValue:{},constraints:{maxNewCards:1}}));
 const s=E.selectForScenario(p,"base"),m=Object.fromEntries(s.newCardClassifications.filter(x=>x.cardId.startsWith("aa_")).map(x=>[x.cardId,x]));
 assert("American acquisition bands use the global optimized counterfactual",Object.values(m).every(x=>x.classification==="do_not_surface")&&Object.values(m).some(x=>x.bestWithoutId.includes("amex_platinum")),JSON.stringify(m));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:americanFactsV26(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["aa_platinum_select"],currentRouting:emptyRouting(),remainingYear:{cardSpend:{},delta:{mqd:0},hotel:{qualifyingNights:0}},primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:10,currentAirlineStatus:"",statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:"",legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}}));
 const s=E.selectForScenario(p,"base");
 assert("Annual-fee American card can be removed when American travel is no longer relevant",s.recommended.id==="no_cards"&&s.recommended.cardRoles.some(x=>x.cardId==="aa_platinum_select"&&x.role==="remove_or_downgrade"),JSON.stringify({id:s.recommended.id,roles:s.recommended.cardRoles}));
}
{
 const vf=americanFactsV26();vf.airlines.american.facts.tierBenefits[2].coverageComplete=false;
 const p=E.normalizeProfile(base({verifiedFacts:vf,primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.95},annualOneWayFlights:12,currentCards:["aa_mileup"],currentRouting:{...emptyRouting(),general:[{card:"aa_mileup",amount:100000}]},statusProgress:{american:{loyaltyPoints:0},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{general:100000},loyaltyPoints:0,qualifyingSegments:0},remainingYear:{cardSpend:{general:100000},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,constraints:{maxNewCards:0}}));
 const ladder=E.airlineStatusLadder(p,["aa_mileup"],{...emptyRouting(),general:[{card:"aa_mileup",amount:100000}]},"base");
 assert("Incomplete American tier inventory fails status-benefit completeness closed",ladder.benefitFactsComplete===false,JSON.stringify(ladder));
}
{
 const r=E.analyze(base({verifiedFacts:americanFactsV26(),constraints:{maxNewCards:0}}));
 assert("alpha.27 American closeout integrity flags are present",r.integrity.americanDecisionSensitiveTierInventory===true&&r.integrity.americanBookingChannelsVerified===true&&r.integrity.americanFamilyEconomicsClosed===true,JSON.stringify(r.integrity));
}


function southwestFactsV27(){
 const mk=(id,facts)=>[id,{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["chase"],facts:{...facts,bookingEarn:{},caps:facts.caps||{},capGroups:facts.capGroups||{},groupCaps:facts.groupCaps||{},postCapEarn:facts.postCapEarn||{},recurringCredits:{},multiYearCredits:{},hotelStatus:{},hotelStatusByProgram:{},transferRules:{},transferAccess:{},rotatingBonus:{},annualPointCertificates:[],statusMilestoneRewards:[],spendRewards:[],companionCertificate:{},verified:true}}];
 const tierBenefits=[
  {tier:"A-List",earningBonusPct:25,checkedBags:1,boardingGroup:"Group 1",seating:"preferred_at_booking_extra_legroom_48h",sameDayStandby:true,priorityLanes:true,priorityPhone:true,coverageComplete:true,verified:true},
  {tier:"A-List Preferred",earningBonusPct:100,checkedBags:2,boardingGroup:"before_group_1",seating:"extra_legroom_at_booking",premiumDrinks:2,sameDayStandby:true,priorityLanes:true,priorityPhone:true,coverageComplete:true,verified:true}
 ];
 return{snapshotId:"sw-v27",verifiedAt:"2026-09-22",sources:["chase","southwest"],cards:Object.fromEntries([
  mk("southwest_plus",{annualFee:99,earn:{dining:1,grocery:2,online_grocery:2,drugstore:1,gas_ev:2,transit:1,online_retail:1,vacation_home:1,airfare:2,hotel:1,general:1},capGroups:{grocery:"southwest_plus_gas_grocery",online_grocery:"southwest_plus_gas_grocery",gas_ev:"southwest_plus_gas_grocery"},groupCaps:{southwest_plus_gas_grocery:5000},postCapEarn:{grocery:1,online_grocery:1,gas_ev:1},benefitTags:["checked_bag","boarding_benefits","seat_benefits","companion_pass_boost","flight_discount_annual"],annualBonusPoints:3000,status:{companionPassBoost:10000}}),
  mk("southwest_premier",{annualFee:149,earn:{dining:2,grocery:2,online_grocery:2,drugstore:1,gas_ev:1,transit:1,online_retail:1,vacation_home:1,airfare:3,hotel:1,general:1},capGroups:{dining:"southwest_premier_dining_grocery",grocery:"southwest_premier_dining_grocery",online_grocery:"southwest_premier_dining_grocery"},groupCaps:{southwest_premier_dining_grocery:8000},postCapEarn:{dining:1,grocery:1,online_grocery:1},benefitTags:["checked_bag","boarding_benefits","seat_benefits","companion_pass_boost","flight_discount_annual"],annualBonusPoints:6000,status:{spendBlock:5000,tqpPerBlock:1500,companionPassBoost:10000}}),
  mk("southwest_priority",{annualFee:229,earn:{dining:2,grocery:1,online_grocery:1,drugstore:1,gas_ev:2,transit:1,online_retail:1,vacation_home:1,airfare:4,hotel:1,general:1},benefitTags:["checked_bag","boarding_benefits","seat_benefits","companion_pass_boost"],annualBonusPoints:7500,status:{spendBlock:5000,tqpPerBlock:2500,companionPassBoost:10000}})
 ]),airlines:{southwest:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["southwest"],facts:{thresholds:[{tier:"A-List",amount:35000},{tier:"A-List Preferred",amount:70000}],flightThresholds:[{tier:"A-List",flights:20},{tier:"A-List Preferred",flights:40}],companionPass:{qualifyingPoints:135000,qualifyingFlights:100,cardBoost:10000,unlimited:true,taxesFeesMinOneWay:5.6},tierBenefits}}},hotels:{}};
}
{
 const p=E.normalizeProfile(base({verifiedFacts:southwestFactsV27(),primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.95}}));
 assert("Southwest current status thresholds are 35K/70K TQP and 20/40 flights",same(E.RULES.airlines.southwest.thresholds.map(x=>x.amount),[35000,70000])&&same(E.RULES.airlines.southwest.flightThresholds.map(x=>x.flights),[20,40]));
 assert("Southwest Companion Pass thresholds are 135K points or 100 flights",E.RULES.airlines.southwest.companionPass.qualifyingPoints===135000&&E.RULES.airlines.southwest.companionPass.qualifyingFlights===100&&E.RULES.airlines.southwest.companionPass.cardBoost===10000);
 const plus=E.strategyRecord(p,["southwest_plus"],"base"),premier=E.strategyRecord(p,["southwest_premier"],"base"),priority=E.strategyRecord(p,["southwest_priority"],"base");
 assert("Southwest anniversary points use approved valuation with normal whole-dollar economics rounding",plus.economics.annualBonusTravelValue===38&&premier.economics.annualBonusTravelValue===75&&priority.economics.annualBonusTravelValue===94,JSON.stringify({plus:plus.economics.annualBonusTravelValue,premier:premier.economics.annualBonusTravelValue,priority:priority.economics.annualBonusTravelValue}));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:southwestFactsV27(),primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.95},statusProgress:{southwest:{tqp:0,qualifyingFlights:0}},remainingYear:{cardSpend:{general:10000},southwest:{tqp:0,qualifyingFlights:0},hotel:{qualifyingNights:0}}}));
 assert("Southwest Premier remains 1500 TQP per $5000",E.airlineProjection(p,"southwest",{...emptyRouting(),general:[{card:"southwest_premier",amount:10000}]},["southwest_premier"]).metric===3000);
 assert("Southwest Priority earns 2500 TQP per $5000",E.airlineProjection(p,"southwest",{...emptyRouting(),general:[{card:"southwest_priority",amount:10000}]},["southwest_priority"]).metric===5000);
 assert("Southwest Plus does not invent card-spend TQP",E.airlineProjection(p,"southwest",{...emptyRouting(),general:[{card:"southwest_plus",amount:10000}]},["southwest_plus"]).metric===0);
}
{
 const p=E.normalizeProfile(base({verifiedFacts:southwestFactsV27(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:5000},primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.95},companionTravel:{intent:"yes",frequency:"2-3"},southwestCompanionQualification:{currentQualifyingPoints:120000,currentQualifyingFlights:10,remainingNonCardQualifyingPoints:0,remainingQualifyingFlights:0,cardSpend:{general:5000},cardBoostIncluded:true},currentCards:[],currentRouting:emptyRouting()}));
 const plus=E.southwestCompanionPassProjection(p,["southwest_plus"],{...emptyRouting(),general:[{card:"southwest_plus",amount:5000}]},"base");
 assert("Southwest one-per-member card boost is added once and card purchase points qualify",plus.cardBoost===10000&&plus.cardQualifyingPoints===5000&&plus.qualifyingPoints===135000&&plus.reached===true,JSON.stringify(plus));
 const stacked=E.southwestCompanionPassProjection(p,["southwest_plus","southwest_priority"],{...emptyRouting(),general:[{card:"southwest_plus",amount:2500},{card:"southwest_priority",amount:2500}]},"base");
 assert("Multiple Southwest cards never stack the annual 10K Companion Pass boost",stacked.cardBoost===10000,JSON.stringify(stacked));
 assert("Repeatable Companion Pass follows future-trip frequency but stays unpriced with unbounded taxes and fees",plus.benefit.demand===2&&plus.benefit.quantified===false&&plus.benefit.totalValue===0&&plus.benefit.reason==="mandatory_companion_charges_unbounded",JSON.stringify(plus.benefit));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:southwestFactsV27(),primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.95},companionTravel:{intent:"yes",frequency:"1"},southwestCompanionQualification:{currentQualifyingPoints:125000,currentQualifyingFlights:0,remainingNonCardQualifyingPoints:0,remainingQualifyingFlights:0,cardSpend:{},cardBoostIncluded:true},currentCards:["southwest_premier"],currentRouting:emptyRouting()}));
 const cp=E.southwestCompanionPassProjection(p,["southwest_premier"],emptyRouting(),"base");
 assert("Existing Southwest card does not double count a Companion Pass boost already in current progress",cp.cardBoost===0&&cp.qualifyingPoints===125000&&!cp.reached,JSON.stringify(cp));
}
{
 const vf=southwestFactsV27();vf.airlines.southwest.facts.tierBenefits[0].coverageComplete=false;
 const p=E.normalizeProfile(base({verifiedFacts:vf,primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.95},statusProgress:{southwest:{tqp:0,qualifyingFlights:0}},remainingYear:{cardSpend:{general:40000},southwest:{tqp:0,qualifyingFlights:0},hotel:{qualifyingNights:0}},currentCards:["southwest_priority"],currentRouting:{...emptyRouting(),general:[{card:"southwest_priority",amount:40000}]}}));
 const ladder=E.airlineStatusLadder(p,["southwest_priority"],{...emptyRouting(),general:[{card:"southwest_priority",amount:40000}]},"base");
 assert("Incomplete Southwest tier inventory fails status-benefit completeness closed",ladder.benefitFactsComplete===false,JSON.stringify(ladder));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:southwestFactsV27(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:40000,hotel:0,general:0},currentCards:["venture"],currentRouting:{...emptyRouting(),airfare:[{card:"venture",amount:40000}]},remainingYear:{cardSpend:{airfare:40000},southwest:{tqp:0,qualifyingFlights:0},hotel:{qualifyingNights:0}},primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.95},annualOneWayFlights:12,currentAirlineStatus:"",statusProgress:{southwest:{tqp:0,qualifyingFlights:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:"",currencyUtility:{capital_one_miles:.95,southwest_points:1},legacyNaturalBenefitValue:{},constraints:{maxNewCards:1}}));
 const s=E.selectForScenario(p,"base"),m=Object.fromEntries(s.newCardClassifications.filter(x=>x.cardId.startsWith("southwest_")).map(x=>[x.cardId,x]));
 assert("Southwest cards do not clear acquisition bands on unpriced per-use benefits alone",m.southwest_plus.classification==="do_not_surface"&&m.southwest_premier.classification==="do_not_surface"&&m.southwest_priority.classification==="do_not_surface",JSON.stringify(m));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:southwestFactsV27(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:11000},currentCards:["chase_preferred","southwest_plus"],currentRouting:{...emptyRouting(),general:[{card:"southwest_plus",amount:11000}]},remainingYear:{cardSpend:{general:11000},southwest:{tqp:0,qualifyingFlights:0},hotel:{qualifyingNights:0}},primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.95},annualOneWayFlights:12,currentAirlineStatus:"",statusProgress:{southwest:{tqp:0,qualifyingFlights:0},hotel:{qualifyingNights:0}},southwestCompanionQualification:{currentQualifyingPoints:124000,currentQualifyingFlights:0,remainingNonCardQualifyingPoints:0,remainingQualifyingFlights:0,cardSpend:{general:11000},cardBoostIncluded:true},companionTravel:{intent:"yes",frequency:"1"},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:"",legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}}));
 const s=E.selectForScenario(p,"base");
 assert("A naturally reachable Companion Pass is preserved qualitatively even while its cash value is unresolved",s.current.outcomes.flightQuality.companionPassReached===true&&s.recommended.portfolio.includes("southwest_plus"),JSON.stringify({current:s.current.outcomes.flightQuality,recommended:s.recommended.id,portfolio:s.recommended.portfolio}));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:southwestFactsV27(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["southwest_priority"],currentRouting:emptyRouting(),remainingYear:{cardSpend:{},delta:{mqd:0},hotel:{qualifyingNights:0}},primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:10,currentAirlineStatus:"",statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:0}},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:"",legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}}));
 const s=E.selectForScenario(p,"base");
 assert("Priority can be removed when Southwest travel is no longer relevant",s.recommended.id==="no_cards"&&s.recommended.cardRoles.some(x=>x.cardId==="southwest_priority"&&x.role==="remove_or_downgrade"),JSON.stringify({id:s.recommended.id,roles:s.recommended.cardRoles}));
}
{
 const r=E.analyze(base({verifiedFacts:southwestFactsV27(),constraints:{maxNewCards:0}}));
 assert("alpha.27 Southwest closeout integrity flags are present",r.integrity.southwestTierBenefitCoverageRequired===true&&r.integrity.southwestCompanionPassQualificationModeled===true&&r.integrity.southwestCompanionPassBoostDeduped===true&&r.integrity.southwestFamilyEconomicsClosed===true,JSON.stringify(r.integrity));
}


function marriottFactsV28({complete=true}={}){
 const mk=(id,facts)=>[id,{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["issuer"],facts:{...facts,bookingEarn:{},caps:facts.caps||{},capGroups:facts.capGroups||{},groupCaps:facts.groupCaps||{},postCapEarn:facts.postCapEarn||{},recurringCredits:facts.recurringCredits||{},multiYearCredits:facts.multiYearCredits||{},annualBonusPoints:0,annualPointCertificates:facts.annualPointCertificates||[],hotelStatusByProgram:{},status:{},transferRules:{},transferAccess:{},rotatingBonus:{},statusMilestoneRewards:[],spendRewards:facts.spendRewards||[],companionCertificate:{},verified:true}}];
 const tierBenefits=[{tier:"Silver Elite",earningBonusPct:10,lateCheckout:"priority",coverageComplete:complete,verified:true},{tier:"Gold Elite",earningBonusPct:25,lateCheckoutHour:14,enhancedRoomUpgrade:true,welcomeGift:"points",coverageComplete:complete,verified:true},{tier:"Platinum Elite",earningBonusPct:50,lateCheckoutHour:16,enhancedRoomUpgrade:"select_suites",welcomeGift:"choice",loungeAccess:true,annualChoiceBenefit:50,coverageComplete:complete,verified:true},{tier:"Titanium Elite",earningBonusPct:75,lateCheckoutHour:16,enhancedRoomUpgrade:"select_suites",welcomeGift:"choice",loungeAccess:true,annualChoiceBenefit:75,coverageComplete:complete,verified:true},{tier:"Ambassador Elite",earningBonusPct:75,lateCheckoutHour:16,enhancedRoomUpgrade:"select_suites",welcomeGift:"choice",loungeAccess:true,ambassadorService:true,your24:true,coverageComplete:complete,verified:true}];
 return{snapshotId:"marriott-v28",verifiedAt:"2026-09-22",sources:["marriott","chase","amex"],cards:Object.fromEntries([
  mk("marriott_bold",{annualFee:0,earn:{dining:1,grocery:2,online_grocery:2,drugstore:1,gas_ev:1,transit:2,online_retail:1,vacation_home:1,airfare:1,hotel:3,general:1},benefitTags:["hotel_status","elite_night_credits"],hotelStatus:{automaticTier:"Silver Elite",annualNights:5}}),
  mk("marriott_boundless",{annualFee:95,earn:{dining:3,grocery:3,online_grocery:3,drugstore:2,gas_ev:3,transit:2,online_retail:2,vacation_home:2,airfare:2,hotel:6,general:2},capGroups:{dining:"boundless_everyday",grocery:"boundless_everyday",online_grocery:"boundless_everyday",gas_ev:"boundless_everyday"},groupCaps:{boundless_everyday:6000},postCapEarn:{dining:2,grocery:2,online_grocery:2,gas_ev:2},benefitTags:["hotel_status","elite_night_credits","free_night_award_35k"],annualPointCertificates:[{benefit:"free_night_award_35k",capPoints:35000,currency:"marriott_points",renewalRequired:true}],hotelStatus:{automaticTier:"Silver Elite",annualNights:15,spendBlock:5000,nightsPerBlock:1,spendTier:{amount:35000,tier:"Gold Elite"}}}),
  mk("marriott_bountiful",{annualFee:250,earn:{dining:4,grocery:4,online_grocery:4,drugstore:2,gas_ev:2,transit:2,online_retail:2,vacation_home:2,airfare:2,hotel:6,general:2},capGroups:{dining:"marriott_bountiful_everyday",grocery:"marriott_bountiful_everyday",online_grocery:"marriott_bountiful_everyday"},groupCaps:{marriott_bountiful_everyday:15000},postCapEarn:{dining:2,grocery:2,online_grocery:2},benefitTags:["hotel_status","elite_night_credits","free_night_award_50k_threshold","paid_stay_bonus_1000"],hotelStatus:{automaticTier:"Gold Elite",annualNights:15},spendRewards:[{amount:15000,benefit:"free_night_award_50k",valuePoints:50000,currency:"marriott_points"}]}),
  mk("marriott_bevy",{annualFee:250,earn:{dining:4,grocery:4,online_grocery:4,drugstore:2,gas_ev:2,transit:2,online_retail:2,vacation_home:2,airfare:2,hotel:6,general:2},capGroups:{dining:"marriott_bevy_everyday",grocery:"marriott_bevy_everyday",online_grocery:"marriott_bevy_everyday"},groupCaps:{marriott_bevy_everyday:15000},postCapEarn:{dining:2,grocery:2,online_grocery:2},benefitTags:["hotel_status","elite_night_credits","free_night_award_50k_threshold","paid_stay_bonus_1000"],hotelStatus:{automaticTier:"Gold Elite",annualNights:15},spendRewards:[{amount:15000,benefit:"free_night_award_50k",valuePoints:50000,currency:"marriott_points"}]}),
  mk("marriott_brilliant",{annualFee:650,earn:{dining:3,grocery:2,online_grocery:2,drugstore:2,gas_ev:2,transit:2,online_retail:2,vacation_home:2,airfare:3,hotel:6,general:2},benefitTags:["hotel_status","dining_credit","free_night_award_85k","lounge","global_entry_tsa","ritz_st_regis_property_credit","elite_night_credits","brilliant_earned_choice_award"],recurringCredits:{dining_credit:300},multiYearCredits:{trusted_traveler:{amount:120,years:4}},annualPointCertificates:[{benefit:"free_night_award_85k",capPoints:85000,currency:"marriott_points",renewalRequired:true}],hotelStatus:{automaticTier:"Platinum Elite",annualNights:25},spendRewards:[{amount:60000,benefit:"brilliant_choice_free_night_award_85k",valuePoints:85000,currency:"marriott_points"}]})
 ]),airlines:{},hotels:{marriott:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["marriott"],facts:{thresholds:[{tier:"Silver Elite",nights:10},{tier:"Gold Elite",nights:25},{tier:"Platinum Elite",nights:50},{tier:"Titanium Elite",nights:75},{tier:"Ambassador Elite",nights:100,spend:23000}],tierBenefits}}}};
}
{
 const p=E.normalizeProfile(base({verifiedFacts:marriottFactsV28(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"marriott",primaryHotelShare:.9,currentHotelStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},constraints:{maxNewCards:0}})),x=E.RULES.cards;
 assert("Marriott current core card facts are closed",x.marriott_bold.annualFee===0&&x.marriott_bold.earn.hotel===3&&x.marriott_bold.earn.transit===2&&x.marriott_boundless.annualFee===95&&x.marriott_boundless.groupCaps.boundless_everyday===6000&&x.marriott_boundless.annualPointCertificates[0].capPoints===35000&&x.marriott_bountiful.spendRewards[0].valuePoints===50000&&x.marriott_bevy.spendRewards[0].valuePoints===50000&&x.marriott_brilliant.recurringCredits.dining_credit===300&&x.marriott_brilliant.annualPointCertificates[0].capPoints===85000&&x.marriott_brilliant.spendRewards[0].amount===60000&&!x.marriott_brilliant.benefitTags.includes("premium_hotel_benefits")&&!Object.prototype.hasOwnProperty.call(x.marriott_brilliant.recurringCredits,"ritz_st_regis_property_credit"));
 assert("Marriott tier inventory is complete and Ambassador is dual-threshold",E.hotelTierBenefitsComplete(p,"marriott")===true&&E.RULES.hotels.marriott.thresholds.at(-1).nights===100&&E.RULES.hotels.marriott.thresholds.at(-1).spend===23000);
 assert("Boundless and Brilliant renewal certificates use approved Marriott valuation",E.portfolioAnnualPointCertificateValue(p,["marriott_boundless"],"base").totalValue===263&&E.portfolioAnnualPointCertificateValue(p,["marriott_brilliant"],"base").totalValue===638);
 assert("Bountiful and Brilliant annual spend thresholds use capped certificate value",E.portfolioAnnualSpendRewardValue(p,["marriott_bountiful"],{...emptyRouting(),general:[{card:"marriott_bountiful",amount:15000}]},"base").totalValue===375&&E.portfolioAnnualSpendRewardValue(p,["marriott_brilliant"],{...emptyRouting(),general:[{card:"marriott_brilliant",amount:60000}]},"base").totalValue===638);
}
{
 const common={verifiedFacts:marriottFactsV28(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"marriott",primaryHotelShare:.9,currentHotelStatus:"",currentRouting:emptyRouting(),remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},constraints:{maxNewCards:0}},p=E.normalizeProfile(base({...common,currentCards:[],statusProgress:{hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}}}));
 assert("Marriott consumer annual Elite Night Credits de-duplicate to the highest consumer grant",E.hotelProjection(p,["marriott_bold","marriott_boundless","marriott_brilliant"],emptyRouting()).qualifyingNights===25);
 const q=E.normalizeProfile(base({...common,currentCards:["marriott_boundless"],cardSpendYTD:{marriott_boundless:0},statusProgress:{hotel:{qualifyingNights:15,qualifyingStays:0,qualifyingSpend:0}}}));
 assert("Adding Brilliant over existing Boundless adds only the 10-night ENC difference",E.hotelProjection(q,["marriott_boundless","marriott_brilliant"],emptyRouting()).qualifyingNights===25);
}
{
 const p=E.normalizeProfile(base({verifiedFacts:marriottFactsV28(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"marriott",primaryHotelShare:.9,currentHotelStatus:"",currentCards:["marriott_boundless"],currentRouting:emptyRouting(),cardSpendYTD:{marriott_boundless:4000},statusProgress:{hotel:{qualifyingNights:15,qualifyingStays:0,qualifyingSpend:0}},remainingYear:{cardSpend:{general:1000},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},constraints:{maxNewCards:0}}));
 assert("Boundless spend-earned ENC uses partial YTD $5K block progress",E.hotelProjection(p,["marriott_boundless"],{...emptyRouting(),general:[{card:"marriott_boundless",amount:1000}]}).qualifyingNights===16);
}
{
 const c={verifiedFacts:marriottFactsV28(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"marriott",primaryHotelShare:.9,currentHotelStatus:"",currentCards:[],currentRouting:emptyRouting(),remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},constraints:{maxNewCards:0}},a=E.hotelProjection(E.normalizeProfile(base({...c,statusProgress:{hotel:{qualifyingNights:100,qualifyingStays:0,qualifyingSpend:22000}}})),[],emptyRouting()),b=E.hotelProjection(E.normalizeProfile(base({...c,statusProgress:{hotel:{qualifyingNights:100,qualifyingStays:0,qualifyingSpend:23000}}})),[],emptyRouting());
 assert("Marriott Ambassador requires both 100 nights and $23K qualifying spend",a.projectedTier==="Titanium Elite"&&b.projectedTier==="Ambassador Elite",JSON.stringify({a,b}));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:marriottFactsV28({complete:false}),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"marriott",primaryHotelShare:.9,currentHotelStatus:"",currentCards:["marriott_boundless"],currentRouting:emptyRouting(),cardSpendYTD:{marriott_boundless:0},statusProgress:{hotel:{qualifyingNights:49,qualifyingStays:0,qualifyingSpend:0}},remainingYear:{cardSpend:{general:5000},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},constraints:{maxNewCards:0}})),r=E.strategyRecord(p,["marriott_boundless"],"base");
 assert("Incomplete Marriott tier inventory fails status intervention closed",!E.hotelTierBenefitsComplete(p,"marriott")&&r.strategy.hotelStatusTarget===null&&r.quality.issues.some(x=>x.code==="hotel_tier_benefits_unresolved"),JSON.stringify({target:r.strategy.hotelStatusTarget,quality:r.quality}));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:marriottFactsV28(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:40000,general:0},currentCards:["venture"],currentRouting:{...emptyRouting(),hotel:[{card:"venture",amount:40000}]},remainingYear:{cardSpend:{hotel:40000},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:40000}},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"marriott",primaryHotelShare:.9,currentHotelStatus:"",statusProgress:{hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},currencyUtility:{capital_one_miles:.95,marriott_points:1},legacyNaturalBenefitValue:{},constraints:{maxNewCards:1}})),m=Object.fromEntries(E.selectForScenario(p,"base").newCardClassifications.filter(x=>x.cardId.startsWith("marriott_")).map(x=>[x.cardId,x]));
 assert("Marriott acquisition bands now include flexible-rewards alternatives in the counterfactual",Object.values(m).every(x=>x.classification==="do_not_surface")&&Object.values(m).some(x=>x.bestWithoutId.includes("chase_reserve")),JSON.stringify(m));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:marriottFactsV28(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["marriott_bountiful"],currentRouting:emptyRouting(),remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.95},annualOneWayFlights:10,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},primaryHotel:"",primaryHotelShare:0,currentHotelStatus:"",legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}})),sel=E.selectForScenario(p,"base");
 assert("Annual-fee Marriott card is removable when Marriott relationship and recurring economics disappear",!sel.recommended.portfolio.includes("marriott_bountiful")&&sel.recommended.cardRoles.some(x=>x.cardId==="marriott_bountiful"&&x.role==="remove_or_downgrade"),JSON.stringify({id:sel.recommended.id,roles:sel.recommended.cardRoles}));
}
{const r=E.analyze(base({verifiedFacts:marriottFactsV28(),constraints:{maxNewCards:0}}));assert("alpha.28 Marriott closeout integrity flags are present",r.integrity.marriottTierBenefitCoverageRequired===true&&r.integrity.marriottConsumerEliteNightCreditsDeduped===true&&r.integrity.marriottAmbassadorDualThresholdModeled===true&&r.integrity.marriottFamilyEconomicsClosed===true,JSON.stringify(r.integrity));}

function hyattFactsV29({tierComplete=true,milestonesComplete=true}={}){
 const milestoneRewards=[{"nights":20,"basePoints":35000,"fixedBenefits":[],"choiceBenefits":["next_stay_award_2k","club_access_awards_2","find_credit_25","aa_preferred_seat_coupons_2"]},{"nights":30,"basePoints":50000,"fixedBenefits":["free_night_award_cat1_4"],"choiceBenefits":["next_stay_award_2k","club_access_awards_2","find_credit_25","aa_preferred_seat_coupons_2"]},{"nights":40,"basePoints":65000,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_5k","suite_upgrade_award_1","find_credit_150","aa_main_cabin_extra_coupons_2"]},{"nights":50,"basePoints":80000,"fixedBenefits":[],"choiceBenefits":["hyatt_points_5k","suite_upgrade_awards_2","find_credit_150","aa_main_cabin_extra_coupons_2"]},{"nights":60,"basePoints":100000,"fixedBenefits":["guest_of_honor_awards_2","free_night_award_cat1_7","suite_upgrade_awards_2","my_hyatt_concierge"],"choiceBenefits":[]},{"nights":70,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","find_credit_300","aadvantage_gold_status"]},{"nights":80,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","find_credit_300","aadvantage_gold_status"]},{"nights":90,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","find_credit_300","aadvantage_gold_status"]},{"nights":100,"fixedBenefits":["free_night_award_cat1_7"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":110,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":120,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":130,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":140,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":150,"fixedBenefits":["ultimate_free_night_award"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]}].map((x,i)=>({...x,coverageComplete:milestonesComplete||i>0,verified:true}));
 const tierBenefits=[{tier:"Discoverist",earningBonusPct:10,roomUpgrade:"preferred_room_within_type",lateCheckoutHour:14,coverageComplete:tierComplete,verified:true},{tier:"Explorist",earningBonusPct:20,roomUpgrade:"upgraded_room_excluding_suites_and_club",lateCheckoutHour:14,coverageComplete:tierComplete,verified:true},{tier:"Globalist",earningBonusPct:30,roomUpgrade:"best_available_including_standard_suites",lateCheckoutHour:16,clubOrBreakfast:true,coverageComplete:tierComplete,verified:true}];
 const facts={annualFee:95,earn:{dining:2,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:2,online_retail:1,vacation_home:1,airfare:2,hotel:4,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["hotel_status","elite_night_credits","free_night_award_cat1_4","free_night_award_cat1_4_threshold"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,annualPointCertificates:[],annualCategoryCertificates:[{benefit:"free_night_award_cat1_4",maxCategory:4,renewalRequired:true,quantified:false}],qualitativeSpendRewards:[{amount:15000,benefit:"free_night_award_cat1_4_threshold",maxCategory:4,quantified:false}],hotelStatus:{automaticTier:"Discoverist",annualNights:5,spendBlock:5000,nightsPerBlock:2},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[],statusMilestoneRewards:[],companionCertificate:{},transferAccess:{},rotatingBonus:{},verified:true};
 return{snapshotId:"hyatt-v29",verifiedAt:"2026-09-22",sources:["hyatt","chase"],cards:{hyatt_consumer:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["chase"],facts}},airlines:{},hotels:{hyatt:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["hyatt"],facts:{thresholds:[{tier:"Discoverist",nights:10,basePoints:25000},{tier:"Explorist",nights:30,basePoints:50000},{tier:"Globalist",nights:60,basePoints:100000}],tierBenefits,milestoneRewards}}}};
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hyattFactsV29(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{hotel:{qualifyingNights:0,basePoints:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,basePoints:0}},constraints:{maxNewCards:0}})),c=E.RULES.cards.hyatt_consumer;
 assert("Hyatt current consumer-card facts are modeled",c.annualFee===95&&c.earn.hotel===4&&c.earn.dining===2&&c.earn.airfare===2&&c.earn.transit===2&&c.hotelStatus.automaticTier==="Discoverist"&&c.hotelStatus.annualNights===5&&c.hotelStatus.spendBlock===5000&&c.hotelStatus.nightsPerBlock===2,JSON.stringify(c));
 assert("Hyatt category certificates remain qualitative and outside point-certificate economics",(c.annualPointCertificates||[]).length===0&&c.annualCategoryCertificates[0].maxCategory===4&&c.qualitativeSpendRewards[0].amount===15000&&E.portfolioAnnualPointCertificateValue(p,["hyatt_consumer"],"base").totalValue===0&&E.portfolioAnnualSpendRewardValue(p,["hyatt_consumer"],{...emptyRouting(),general:[{card:"hyatt_consumer",amount:15000}]},"base").totalValue===0);
 const vb=E.visibleBenefits(["hyatt_consumer"],p);assert("Hyatt annual and 15K category certificates remain visible at zero modeled value",vb.some(x=>x.benefit==="free_night_award_cat1_4"&&x.detail?.quantified===false)&&vb.some(x=>x.benefit==="free_night_award_cat1_4_threshold"&&x.detail?.quantified===false),JSON.stringify(vb));
 assert("Hyatt tier and milestone inventories are complete",E.hotelTierBenefitsComplete(p,"hyatt")&&E.hotelMilestoneRewardsComplete(p,"hyatt")&&E.hotelProgramFactsComplete(p,"hyatt"));
}
{
 const c={verifiedFacts:hyattFactsV29(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"",currentCards:[],currentRouting:emptyRouting(),remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,basePoints:0}},constraints:{maxNewCards:0}};
 const a=E.hotelProjection(E.normalizeProfile(base({...c,statusProgress:{hotel:{qualifyingNights:0,basePoints:50000}}})),[],emptyRouting()),b=E.hotelProjection(E.normalizeProfile(base({...c,statusProgress:{hotel:{qualifyingNights:0,basePoints:100000}}})),[],emptyRouting());
 assert("Hyatt status can be earned from explicit Base Points without invented nights",a.projectedTier==="Explorist"&&b.projectedTier==="Globalist"&&b.qualifyingNights===0,JSON.stringify({a,b}));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hyattFactsV29(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"",currentCards:["hyatt_consumer"],currentRouting:emptyRouting(),cardSpendYTD:{hyatt_consumer:4000},statusProgress:{hotel:{qualifyingNights:5,basePoints:0}},remainingYear:{cardSpend:{general:1000},hotel:{qualifyingNights:0,basePoints:0}},constraints:{maxNewCards:0}})),x=E.hotelProjection(p,["hyatt_consumer"],{...emptyRouting(),general:[{card:"hyatt_consumer",amount:1000}]});assert("Hyatt spend-earned nights respect partial YTD 5K block progress",x.qualifyingNights===7,JSON.stringify(x));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hyattFactsV29(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"",currentCards:["hyatt_consumer"],currentRouting:emptyRouting(),statusProgress:{hotel:{qualifyingNights:5,basePoints:0}},remainingYear:{cardSpend:{general:140000},hotel:{qualifyingNights:0,basePoints:0}},constraints:{maxNewCards:0}})),x=E.hotelProjection(p,["hyatt_consumer"],{...emptyRouting(),general:[{card:"hyatt_consumer",amount:140000}]});assert("Missing Hyatt YTD spend preserves conservative complete-future-block projection",x.projectedTier==="Globalist"&&x.qualifyingNights===61&&x.uncertainties.includes("hotel_card_spend_ytd_missing:hyatt_consumer"),JSON.stringify(x));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hyattFactsV29(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{hotel:{qualifyingNights:30,basePoints:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,basePoints:0}},constraints:{maxNewCards:0}})),x=E.hotelProjection(p,[],emptyRouting());assert("Hyatt 30-night milestone is visible without dollarizing its category certificate",x.milestoneRewardsReached.some(r=>r.nights===30&&r.fixedBenefits.includes("free_night_award_cat1_4"))&&x.nextMilestone?.nights===40,JSON.stringify(x));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hyattFactsV29({tierComplete:false}),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"",currentCards:["hyatt_consumer"],currentRouting:emptyRouting(),cardSpendYTD:{hyatt_consumer:0},statusProgress:{hotel:{qualifyingNights:28,basePoints:0}},remainingYear:{cardSpend:{general:5000},hotel:{qualifyingNights:0,basePoints:0}},constraints:{maxNewCards:0}})),r=E.strategyRecord(p,["hyatt_consumer"],"base");assert("Incomplete Hyatt tier benefits fail status intervention closed",!E.hotelProgramFactsComplete(p,"hyatt")&&r.strategy.hotelStatusTarget===null&&r.quality.issues.some(x=>x.code==="hotel_tier_benefits_unresolved"),JSON.stringify(r.quality));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hyattFactsV29({milestonesComplete:false}),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"",currentCards:["hyatt_consumer"],currentRouting:emptyRouting(),cardSpendYTD:{hyatt_consumer:0},statusProgress:{hotel:{qualifyingNights:28,basePoints:0}},remainingYear:{cardSpend:{general:5000},hotel:{qualifyingNights:0,basePoints:0}},constraints:{maxNewCards:0}})),r=E.strategyRecord(p,["hyatt_consumer"],"base");assert("Incomplete Hyatt milestones fail status intervention closed",!E.hotelMilestoneRewardsComplete(p,"hyatt")&&r.strategy.hotelStatusTarget===null&&r.quality.issues.some(x=>x.code==="hotel_milestone_rewards_unresolved"),JSON.stringify(r.quality));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hyattFactsV29(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:40000,general:0},currentCards:["venture"],currentRouting:{...emptyRouting(),hotel:[{card:"venture",amount:40000}]},remainingYear:{cardSpend:{hotel:40000},hotel:{qualifyingNights:0,qualifyingSpend:40000,basePoints:0}},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"",statusProgress:{hotel:{qualifyingNights:0,basePoints:0}},currencyUtility:{capital_one_miles:.95,hyatt_points:1},legacyNaturalBenefitValue:{},constraints:{maxNewCards:1}})),m=E.selectForScenario(p,"base").newCardClassifications.find(x=>x.cardId==="hyatt_consumer");assert("Hyatt acquisition band uses true recurring counterfactual and excludes qualitative certificate value",m?.classification==="do_not_surface"&&m.incrementalRecurringValue<200,JSON.stringify(m));globalThis.__hyattBand=m;
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hyattFactsV29(),spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["hyatt_consumer"],currentRouting:emptyRouting(),remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,basePoints:0}},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,currentHotelStatus:"",statusProgress:{hotel:{qualifyingNights:0,basePoints:0}},constraints:{maxNewCards:0}})),s=E.selectForScenario(p,"base");assert("Existing Hyatt category certificate is protected from automatic removal while unpriced",s.recommended.portfolio.includes("hyatt_consumer"),JSON.stringify(s.recommended.portfolio));
}
{const r=E.analyze(base({verifiedFacts:hyattFactsV29(),constraints:{maxNewCards:0}}));assert("alpha.29 Hyatt closeout integrity flags are present",r.integrity.hyattTierBenefitCoverageRequired&&r.integrity.hyattMilestoneInventoryRequired&&r.integrity.hyattBasePointsQualificationModeled&&r.integrity.hyattCategoryCertificatesRemainQualitative&&r.integrity.hyattPartialSpendBlockProgressModeled&&r.integrity.hyattFamilyEconomicsClosed,JSON.stringify(r.integrity));}

function hiltonFactsV30({tierComplete=true,milestonesComplete=true,reserveComplete=true}={}){
 const mk=(id,facts)=>[id,{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["issuer"],facts:{...facts,bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},multiYearCredits:{},annualBonusPoints:0,annualPointCertificates:[],annualCategoryCertificates:[],annualQualitativeCertificates:facts.annualQualitativeCertificates||[],hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[],statusMilestoneRewards:[],companionCertificate:{},transferAccess:{},rotatingBonus:{},verified:true}}];
 const tierBenefits=[{tier:"Silver",earningBonusPct:20,fifthNightFree:true,coverageComplete:tierComplete,verified:true},{tier:"Gold",earningBonusPct:80,roomUpgrade:"space_available_up_to_executive_floor",foodBeverageOrBreakfast:true,coverageComplete:tierComplete,verified:true},{tier:"Diamond",earningBonusPct:100,loungeAccess:true,guaranteedAvailabilityHours:48,coverageComplete:tierComplete,verified:true},{tier:"Diamond Reserve",earningBonusPct:120,lateCheckoutHour:16,confirmableUpgrade:true,premiumClubAccess:true,coverageComplete:tierComplete&&reserveComplete,verified:true}];
 const milestoneRewards=[];for(let nights=40;nights<=180;nights+=10){let row={nights,bonusPoints:10000};if(nights===60)row={...row,bonusPoints:40000,statusGift:"Gold"};if(nights===100)row={...row,statusGift:"Diamond"};if(nights===120)row={...row,choice:"confirmable_upgrade_or_30000_points",selectablePointFloor:30000};milestoneRewards.push({...row,coverageComplete:milestonesComplete,verified:true});}
 return{snapshotId:"hilton-v30",verifiedAt:"2026-09-22",sources:["amex","hilton"],cards:Object.fromEntries([
 mk("hilton_no_fee",{annualFee:0,earn:{dining:5,grocery:5,online_grocery:5,drugstore:3,gas_ev:5,transit:3,online_retail:3,vacation_home:3,airfare:3,hotel:7,general:3},benefitTags:["hotel_status"],recurringCredits:{},qualitativeSpendRewards:[],hotelStatus:{automaticTier:"Silver",spendTier:{amount:20000,tier:"Gold"}}}),
 mk("hilton_surpass",{annualFee:150,earn:{dining:6,grocery:6,online_grocery:6,drugstore:3,gas_ev:6,transit:3,online_retail:4,vacation_home:3,airfare:3,hotel:12,general:3},benefitTags:["hotel_status","hilton_credit","free_night_reward_15k","national_executive_status"],recurringCredits:{hilton_credit:200},qualitativeSpendRewards:[{amount:15000,benefit:"free_night_reward_15k",quantified:false}],hotelStatus:{automaticTier:"Gold",spendTier:{amount:40000,tier:"Diamond"}}}),
 mk("hilton_aspire",{annualFee:550,earn:{dining:7,grocery:3,online_grocery:3,drugstore:3,gas_ev:3,transit:3,online_retail:3,vacation_home:3,airfare:7,hotel:14,general:3},benefitTags:["hotel_status","hilton_resort_credit","flight_credit","clear","free_night_reward_annual","free_night_reward_30k","free_night_reward_60k","hilton_property_credit","national_executive_status"],recurringCredits:{hilton_resort_credit:400,flight_credit:200,clear:219},annualQualitativeCertificates:[{benefit:"free_night_reward_annual",renewalRequired:true,quantified:false}],qualitativeSpendRewards:[{amount:30000,benefit:"free_night_reward_30k",quantified:false},{amount:60000,benefit:"free_night_reward_60k",quantified:false}],hotelStatus:{automaticTier:"Diamond"}})
 ]),airlines:{},hotels:{hilton:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-22",sources:["hilton"],facts:{thresholds:[{tier:"Silver",nights:10,stays:4,spend:2500},{tier:"Gold",nights:25,stays:15,spend:6000},{tier:"Diamond",nights:50,stays:25,spend:11500}],diamondReserve:{tier:"Diamond Reserve",nights:80,stays:40,spend:18000},tierBenefits,milestoneRewards}}}};
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hiltonFactsV30(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}})),c=E.RULES.cards;
 assert("Hilton current card economics are modeled",c.hilton_no_fee.hotelStatus.spendTier.amount===20000&&c.hilton_surpass.recurringCredits.hilton_credit===200&&c.hilton_surpass.earn.online_retail===4&&c.hilton_aspire.recurringCredits.hilton_resort_credit===400&&c.hilton_aspire.recurringCredits.flight_credit===200&&c.hilton_aspire.recurringCredits.clear===219&&!c.hilton_aspire.benefitTags.includes("premium_hotel_benefits"));
 assert("Hilton free-night rewards stay visible and unpriced",E.portfolioAnnualPointCertificateValue(p,["hilton_aspire"],"base").totalValue===0&&E.visibleBenefits(["hilton_aspire"]).some(x=>x.benefit==="free_night_reward_annual"&&x.detail?.quantified===false));
 assert("Hilton tier and milestone inventories include Diamond Reserve",E.hotelTierBenefitsComplete(p,"hilton")&&E.hotelMilestoneRewardsComplete(p,"hilton")&&E.hotelProgramFactsComplete(p,"hilton"));
}
{
 const common={verifiedFacts:hiltonFactsV30(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"",currentCards:[],currentRouting:emptyRouting(),remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},constraints:{maxNewCards:0}};
 const n=E.hotelProjection(E.normalizeProfile(base({...common,statusProgress:{hotel:{qualifyingNights:80,qualifyingStays:0,qualifyingSpend:17000}}})),[],emptyRouting()),s=E.hotelProjection(E.normalizeProfile(base({...common,statusProgress:{hotel:{qualifyingNights:79,qualifyingStays:39,qualifyingSpend:18000}}})),[],emptyRouting()),rn=E.hotelProjection(E.normalizeProfile(base({...common,statusProgress:{hotel:{qualifyingNights:80,qualifyingStays:0,qualifyingSpend:18000}}})),[],emptyRouting()),rs=E.hotelProjection(E.normalizeProfile(base({...common,statusProgress:{hotel:{qualifyingNights:0,qualifyingStays:40,qualifyingSpend:18000}}})),[],emptyRouting());
 assert("Hilton Diamond Reserve requires (80 nights OR 40 stays) AND $18K spend",n.projectedTier==="Diamond"&&s.projectedTier==="Diamond"&&rn.projectedTier==="Diamond Reserve"&&rs.projectedTier==="Diamond Reserve");
 const aspire=E.hotelProjection(E.normalizeProfile(base({...common,currentCards:["hilton_aspire"],statusProgress:{hotel:{qualifyingNights:80,qualifyingStays:0,qualifyingSpend:18000}}})),["hilton_aspire"],emptyRouting());
 assert("organic Diamond Reserve outranks Aspire automatic Diamond",aspire.effectiveTier==="Diamond Reserve",JSON.stringify(aspire));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hiltonFactsV30(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Diamond",currentCards:[],currentRouting:emptyRouting(),statusProgress:{hotel:{qualifyingNights:70,qualifyingStays:35,qualifyingSpend:15000}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0,qualifyingStays:0,qualifyingSpend:0}},constraints:{maxNewCards:0}})),r=E.strategyRecord(p,[],"base"),gap=r.travelActions.hotel.remainingGap;
 assert("Diamond natural gap exposes Diamond Reserve dual requirement",gap?.tier==="Diamond Reserve"&&gap.nights===10&&gap.stays===5&&gap.spend===3000&&gap.qualification==="(nights_or_stays)_and_spend",JSON.stringify(gap));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hiltonFactsV30(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"",currentCards:[],currentRouting:emptyRouting(),statusProgress:{hotel:{qualifyingNights:60}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}})),x=E.hotelProjection(p,[],emptyRouting()),benefits=E.portfolioRecurringBenefitValue(p,["amex_platinum","hilton_aspire"]);
 assert("Hilton 60-night milestones total 60K points and $240",x.milestoneBonusPoints===60000&&x.milestoneBonusValue===240);
 assert("Duplicate CLEAR credits use the higher verified credit",benefits.byType.clear===219);
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hiltonFactsV30({reserveComplete:false}),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Diamond",currentCards:[],currentRouting:emptyRouting(),statusProgress:{hotel:{qualifyingNights:70}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:10}},constraints:{maxNewCards:0}})),r=E.strategyRecord(p,[],"base");
 assert("Missing Diamond Reserve benefit coverage fails Hilton facts closed",!E.hotelTierBenefitsComplete(p,"hilton")&&r.quality.issues.some(x=>x.code==="hotel_tier_benefits_unresolved"));
}
{
 const p=E.normalizeProfile(base({verifiedFacts:hiltonFactsV30({milestonesComplete:false}),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Silver",currentCards:["hilton_surpass"],currentRouting:emptyRouting(),cardSpendYTD:{hilton_surpass:0},statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:40000},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}})),r=E.strategyRecord(p,["hilton_surpass"],"base");
 assert("Incomplete Hilton milestone inventory fails status intervention closed",!E.hotelMilestoneRewardsComplete(p,"hilton")&&r.strategy.hotelStatusTarget===null&&r.quality.issues.some(x=>x.code==="hotel_milestone_rewards_unresolved"));
}
{const r=E.analyze(base({verifiedFacts:hiltonFactsV30(),constraints:{maxNewCards:0}}));assert("alpha.30 Hilton integrity flags are present",r.integrity.hiltonTierBenefitCoverageRequired&&r.integrity.hiltonDualAndQualificationModeled&&r.integrity.hiltonReserveTierOrderingModeled&&r.integrity.hiltonMilestoneBonusesModeled&&r.integrity.hiltonFreeNightRewardsQualitative&&r.integrity.clearCreditOverlapDeduped&&r.integrity.hiltonFamilyEconomicsClosed);}


{
 const c=E.RULES.cards;
 assert("alpha.31 flexible card facts reflect current issuer economics",c.amex_platinum.recurringCredits.clear===219&&c.chase_preferred.earn.gas_ev===3&&c.chase_preferred.earn.vacation_home===3&&c.chase_preferred.earn.transit===2&&c.chase_freedom_unlimited.earn.drugstore===3&&c.chase_freedom_flex.rotatingBonus.rate===5&&c.venture.multiYearCredits.trusted_traveler.amount===120&&c.venture_x.bookingEarn.vacation_home.capital_one_travel===5,JSON.stringify({platinum:c.amex_platinum.recurringCredits.clear,preferred:c.chase_preferred,cfu:c.chase_freedom_unlimited.earn.drugstore,venture:c.venture.multiYearCredits}));
 assert("Reserve $75K package quantifies only the fixed Southwest credit",c.chase_reserve.spendRewards.some(x=>x.amount===75000&&x.cashValue===500)&&c.chase_reserve.qualitativeSpendRewards.filter(x=>x.amount===75000&&x.quantified===false).length===4,JSON.stringify({spend:c.chase_reserve.spendRewards,qualitative:c.chase_reserve.qualitativeSpendRewards}));
}
{
 const p=E.normalizeProfile(base({spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:10000,airfare:0,hotel:0,general:0},bookingMethod:{vacation_home:"capital_one_travel"},currentCards:["venture_x"],currentRouting:{...emptyRouting(),vacation_home:[{card:"venture_x",amount:10000}]},remainingYear:{cardSpend:{}},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}})),r=E.strategyRecord(p,["venture_x"],"base");
 assert("Capital One Travel vacation rentals use Venture X 5X",r.economics.pointsByCurrency.capital_one_miles===50000,JSON.stringify(r.economics.pointsByCurrency));
}
{
 const p=E.normalizeProfile(base({spend:{dining:0,grocery:0,online_grocery:0,drugstore:0,gas_ev:0,transit:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:75000},currentCards:["chase_reserve"],currentRouting:{...emptyRouting(),general:[{card:"chase_reserve",amount:75000}]},remainingYear:{cardSpend:{}},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},constraints:{maxNewCards:0}})),x=E.portfolioAnnualSpendRewardValue(p,["chase_reserve"],p.currentRouting,"base"),visible=E.visibleBenefits(["chase_reserve"]);
 assert("Reserve $75K threshold contributes exactly $500 fixed recurring value",x.totalValue===500&&x.rewards.length===1&&x.rewards[0].benefit==="southwest_chase_travel_credit_500",JSON.stringify(x));
 assert("Reserve $75K status and Shops outcomes remain visible but unpriced",visible.some(x=>x.benefit==="hyatt_explorist_status_threshold"&&x.detail?.quantified===false)&&visible.some(x=>x.benefit==="ihg_diamond_status_threshold"&&x.detail?.quantified===false)&&visible.some(x=>x.benefit==="southwest_alist_status_threshold"&&x.detail?.quantified===false)&&visible.some(x=>x.benefit==="shops_at_chase_credit_250"&&x.detail?.quantified===false),JSON.stringify(visible));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum"],constraints:{maxNewCards:1}}));
 const h=E.newCardHurdleDelta(p,{portfolio:["amex_gold"],economics:{netEconomicValue:800}},{portfolio:["amex_platinum"],economics:{netEconomicValue:300}});
 assert("replacement-card hurdle excludes fee savings from the dropped current card",h.rawDelta===500&&h.excludedCurrentCardFeeSavings===895&&h.delta===-395,JSON.stringify(h));
}
{
 const p=E.normalizeProfile(base({spend:{dining:50000,grocery:25000,online_grocery:0,drugstore:5000,gas_ev:5000,transit:5000,online_retail:5000,vacation_home:0,airfare:5000,hotel:5000,general:45000},currentCards:["chase_freedom_unlimited"],currentRouting:{...emptyRouting(),dining:[{card:"chase_freedom_unlimited",amount:50000}],grocery:[{card:"chase_freedom_unlimited",amount:25000}],drugstore:[{card:"chase_freedom_unlimited",amount:5000}],gas_ev:[{card:"chase_freedom_unlimited",amount:5000}],transit:[{card:"chase_freedom_unlimited",amount:5000}],online_retail:[{card:"chase_freedom_unlimited",amount:5000}],airfare:[{card:"chase_freedom_unlimited",amount:5000}],hotel:[{card:"chase_freedom_unlimited",amount:5000}],general:[{card:"chase_freedom_unlimited",amount:45000}]},remainingYear:{cardSpend:{}},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},constraints:{maxNewCards:2}})),a=E.analyze(p),classes=new Set(a.newCardClassifications.map(x=>x.cardId));
 assert("global flexible comparison includes Amex Chase and Capital One acquisition candidates",classes.has("amex_gold")&&classes.has("chase_preferred")&&classes.has("venture"),JSON.stringify([...classes]));
 assert("existing no-fee flexible card remains open during an ecosystem switch",a.recommended.portfolio.includes("chase_freedom_unlimited")&&a.recommended.actions.some(x=>x.cardId==="chase_freedom_unlimited"&&x.action==="keep"),JSON.stringify(a.recommended.actions));
 const routed=[...new Set(Object.values(a.recommended.ongoingRouting).flat().map(x=>E.RULES.cards[x.card]?.kind==="flex"?E.RULES.cards[x.card].currency:"").filter(Boolean))];
 assert("only one flexible ecosystem receives controllable spend after global comparison",routed.length<=1&&(!routed.length||routed[0]===a.rewardsStrategy.primaryCurrency),JSON.stringify({portfolio:a.recommended.portfolio,routed,rewards:a.rewardsStrategy}));
}
{
 const p=E.normalizeProfile(base({spend:{dining:10000,grocery:10000,online_grocery:0,drugstore:5000,gas_ev:5000,transit:5000,online_retail:5000,vacation_home:5000,airfare:5000,hotel:5000,general:50000},currentCards:[],currentRouting:emptyRouting(),remainingYear:{cardSpend:{}},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},constraints:{maxNewCards:2}})),sets=E.candidatePortfolios(p);
 assert("candidate portfolios never add flexible cards from multiple ecosystems",sets.every(set=>[...new Set(set.filter(id=>!p.currentCards.includes(id)).map(id=>E.RULES.cards[id]?.kind==="flex"?E.RULES.cards[id].currency:"").filter(Boolean))].length<=1));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum","chase_preferred","venture"],constraints:{maxNewCards:0}})),b=E.portfolioRecurringBenefitValue(p,["amex_platinum","chase_preferred","venture"]);
 assert("trusted-traveler reimbursements de-duplicate across flexible issuers",b.byType.trusted_traveler===30,JSON.stringify(b.byType));
}
{
 const p=E.normalizeProfile(base({redemptionPartner:"hyatt",asOfDate:"2026-09-22",cardOpenDate:{chase_preferred:"2026-01-01"},currentCards:["chase_preferred"],constraints:{maxNewCards:0}})),ratio=E.currencyPointValue(p,"chase_ur","base",["chase_preferred"]),temp=E.temporaryTransferRatio("chase_preferred","hyatt",p);
 assert("Preferred temporary 1:1 Hyatt rate is disclosed while recurring economics use permanent 4:3",temp?.ratio===1&&temp?.through==="2026-09-30"&&Math.abs(ratio-p.valuationSnapshot.values.hyatt_points*.75)<1e-12,JSON.stringify({ratio,temp}));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));
 assert("alpha.31 flexible closeout integrity flags are present",r.integrity.flexibleRewardsCrossEcosystemCompared&&r.integrity.oneActiveFlexibleEcosystemPerPortfolio&&r.integrity.replacementFeeSavingsExcludedFromNewCardHurdle&&r.integrity.temporaryTransferValueExcludedFromRecurringEconomics&&r.integrity.vacationRentalBookingMethodAware&&r.integrity.flexibleRewardsFamilyEconomicsClosed,JSON.stringify(r.integrity));
}


{
 const p=E.normalizeProfile(base({currentCards:["chase_reserve"],constraints:{maxNewCards:0}})),visible=E.visibleBenefits(["chase_reserve"],p),economic=E.portfolioRecurringBenefitValue(p,["chase_reserve"]),temp=visible.filter(x=>x.detail?.temporary===true);
 const ids=new Set(temp.map(x=>x.benefit));
 assert("Reserve dated partner benefits remain visible as temporary only",["apple_tv_music_temporary","dashpass_membership_temporary","doordash_promos_temporary","stubhub_credit_temporary","lyft_credit_5x_temporary","peloton_credit_10x_temporary"].every(x=>ids.has(x))&&temp.every(x=>x.detail.recurringEconomicValue===0),JSON.stringify(temp));
 assert("temporary Reserve benefits never enter recurring benefit economics",!Object.keys(economic.byType).some(k=>/apple|dashpass|doordash|stubhub|lyft|peloton/.test(k)),JSON.stringify(economic.byType));
}
{
 const p=E.normalizeProfile(base({currentCards:["chase_preferred"],constraints:{maxNewCards:0}})),visible=E.visibleBenefits(["chase_preferred"],p),temp=visible.filter(x=>x.detail?.temporary===true),ids=new Set(temp.map(x=>x.benefit));
 assert("Preferred dated partner promotions stay visible without recurring value",["apple_tv_subscription_temporary","dashpass_membership_temporary","lyft_5x_temporary","peloton_5x_temporary"].every(x=>ids.has(x))&&temp.every(x=>x.detail.recurringEconomicValue===0),JSON.stringify(temp));
}
{
 const gold=new Set(E.visibleBenefits(["amex_gold"]).map(x=>x.benefit)),green=new Set(E.visibleBenefits(["amex_green"]).map(x=>x.benefit)),venture=new Set(E.visibleBenefits(["venture"]).map(x=>x.benefit)),one=new Set(E.visibleBenefits(["venture_one"]).map(x=>x.benefit)),vx=new Set(E.visibleBenefits(["venture_x"]).map(x=>x.benefit));
 assert("durable flexible-card travel capabilities remain visible qualitatively",gold.has("premium_hotel_booking")&&gold.has("hertz_five_star")&&gold.has("travel_protections")&&green.has("travel_protections")&&venture.has("hertz_five_star")&&venture.has("travel_protections")&&one.has("hertz_five_star")&&one.has("travel_protections")&&vx.has("hertz_status")&&vx.has("travel_protections"),JSON.stringify({gold:[...gold],green:[...green],venture:[...venture],one:[...one],vx:[...vx]}));
}
{
 const r=E.analyze(base({constraints:{maxNewCards:0}}));
 assert("temporary-benefit visibility is explicitly separated from recurring economics",r.integrity.temporaryCardBenefitsVisibilityOnly===true,JSON.stringify(r.integrity));
}

console.log("\n------------------------------");
console.log(`V5 alpha.27 harness: ${pass} passed, ${fail} failed`);
if(failures.length)console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;
