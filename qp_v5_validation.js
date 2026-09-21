/** Quiet Premium V5 validation harness — 5.0-alpha.16 */
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

assert("engine is alpha.16",E.ENGINE_VERSION==="5.0-alpha.16");

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
 assert("alpha.13 integrity flags are present",r.integrity.travelStrategyPrecedesCards===true&&r.integrity.primaryFlexibleEcosystem===true&&r.integrity.ongoingAndTemporaryRoutingSeparated===true&&r.integrity.temporaryJobsHaveExplicitHandoffs===true&&r.integrity.statusOpportunityRemainsDiscoverable===true&&r.integrity.existingCardRemovalEvaluated===true&&r.integrity.feeSavingsExposed===true&&r.integrity.aggregateBenefitValuesDoNotDoubleCountTypedBreakdowns===true&&r.integrity.unresolvedCrossCardBenefitOverlapIsConservative===true&&r.integrity.benefitProtectionIsCardSpecific===true&&r.integrity.nonIncrementalStatusSpendMovesRemoved===true&&r.integrity.reportedAndProjectedStatusSeparated===true&&r.integrity.statusTargetsComparedToProjectedCurrentSetup===true);
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
 assert("Amex wallet selects one primary flexible ecosystem",r.rewardsStrategy.primaryCurrency==="amex_mr",r.rewardsStrategy.primaryCurrency);
}

{
 const p=base({
  spend:{dining:18000,grocery:12000,online_grocery:0,gas_ev:4000,online_retail:5000,vacation_home:0,airfare:6000,hotel:12000,general:43000},
  currentCards:["hilton_surpass","amex_gold"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:18000}],grocery:[{card:"amex_gold",amount:12000}],gas_ev:[{card:"hilton_surpass",amount:4000}],online_retail:[{card:"hilton_surpass",amount:5000}],airfare:[{card:"hilton_surpass",amount:6000}],hotel:[{card:"hilton_surpass",amount:12000}],general:[{card:"hilton_surpass",amount:43000}]},
  primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:4,primaryHotel:"hilton",primaryHotelShare:.75,currentHotelStatus:"Gold",
  statusProgress:{hotel:{qualifyingNights:12,qualifyingStays:7,qualifyingSpend:3500}},
  remainingYear:{cardSpend:{dining:4000,grocery:3000,hotel:3000,general:10000},hotel:{qualifyingNights:4,qualifyingStays:2,qualifyingSpend:1500}},
  cardSpendYTD:{hilton_surpass:12000},cardUniqueBenefitValue:{hilton_surpass:250,amex_gold:250},legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}
 });
 const r=E.analyze(p),job=r.recommended.temporaryJobs.find(j=>j.type==="spend_reward"&&j.cardId==="hilton_surpass");
 assert("Surpass $15k reward becomes independent temporary job",!!job,JSON.stringify(r.recommended.temporaryJobs));
 assert("Surpass job requires only remaining $3k",job?.spendRequired===3000,String(job?.spendRequired));
 assert("temporary job has explicit post-threshold handoff",Array.isArray(job?.postThresholdRouting)&&job.postThresholdRouting.length>0,JSON.stringify(job?.postThresholdRouting));
 assert("nearer Surpass reward prevents automatic $40k Diamond chase",!r.recommended.strategy.hotelStatusTarget,JSON.stringify(r.recommended.strategy.hotelStatusTarget));
}

{
 const p=base({
  spend:{dining:50000,grocery:30000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:10000,hotel:10000,general:50000},
  currentCards:["amex_gold","amex_platinum","delta_reserve"],
  currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:50000}],grocery:[{card:"amex_gold",amount:30000}],airfare:[{card:"amex_platinum",amount:10000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:50000}]},
  primaryAirline:"delta",primaryAirlineShare:.85,routeFit:{delta:.95},annualOneWayFlights:28,currentAirlineStatus:"Gold Medallion",
  statusProgress:{delta:{mqd:10500},hotel:{qualifyingNights:8}},
  remainingYear:{cardSpend:{dining:18000,grocery:12000,airfare:4000,hotel:3000,general:15000},delta:{mqd:1000},hotel:{qualifyingNights:2}},
  cardSpendYTD:{delta_reserve:0},cardUniqueBenefitValue:{amex_platinum:900,amex_gold:250,delta_reserve:650},
  explicitBenefitUse:{amex_platinum:{lounge_access:true,premium_hotel:true},delta_reserve:{upgrade_priority:true,lounge_access:true}},
  benefitValueByType:{lounge:300,premium_hotel_booking:400,upgrade_priority:300},legacyNaturalBenefitValue:{},constraints:{maxNewCards:0}
 });
 const rec=E.strategyRecord(E.normalizeProfile(p),["amex_gold","amex_platinum","delta_reserve"],"base"),job=rec.temporaryJobs.find(j=>j.type==="airline_status");
 assert("expensive reachable status path remains discoverable",!!job,JSON.stringify(rec.temporaryJobs));
 assert("status temporary job also has explicit handoff",Array.isArray(job?.postThresholdRouting)&&job.postThresholdRouting.length>0,JSON.stringify(job?.postThresholdRouting));
}

{
 const p=base({
  currentCards:["amex_platinum","chase_reserve","venture_x"],
  currentRouting:{...emptyRouting(),dining:[{card:"chase_reserve",amount:20000}],grocery:[{card:"venture_x",amount:15000}],gas_ev:[{card:"venture_x",amount:5000}],online_retail:[{card:"venture_x",amount:5000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"venture_x",amount:83000}]},
  primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,currentAirlineStatus:"Gold Medallion",
  cardUniqueBenefitValue:{amex_platinum:900,chase_reserve:0,venture_x:0},legacyNaturalBenefitValue:{},
  explicitBenefitUse:{amex_platinum:{lounge_access:true,premium_hotel:true}},benefitValueByType:{lounge:300,premium_hotel_booking:400},constraints:{maxNewCards:1}
 });
 const r=E.analyze(p);
 const secondarySpend=Object.values(r.recommended.ongoingRouting).flat().filter(x=>["chase_reserve","venture_x"].includes(x.card)).reduce((a,x)=>a+x.amount,0);
 assert("secondary flexible ecosystems do not receive routine spend",secondarySpend===0,JSON.stringify(r.recommended.ongoingRouting));
 assert("secondary premium cards must have a real retention job if kept",["chase_reserve","venture_x"].filter(id=>r.recommended.portfolio.includes(id)).every(id=>r.recommended.cardRoles.find(x=>x.cardId===id)?.role==="travel_benefit"),JSON.stringify(r.recommended.cardRoles));
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
 assert("Delta 80 percent four flights can be relationship without status chase",high.travelStrategy.airline.relationshipEstablished===true&&high.travelStrategy.airline.statusUseful===false,JSON.stringify(high.travelStrategy.airline));
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
 function gateAt(dining){const p=E.normalizeProfile(base({spend:{dining,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:dining}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{},cardUniqueBenefitValue:{},benefitValueByType:{},explicitBenefitUse:{},benefitEvidence:{},constraints:{maxNewCards:1,requiredCards:["amex_platinum"]}}));const s=E.selectForScenario(p,"base"),rec=s.records.find(x=>x.portfolio.includes("amex_gold")&&x.portfolio.includes("amex_platinum")&&x.portfolio.length===2);return rec?.incrementalCardGate?.cards?.find(x=>x.cardId==="amex_gold");}
 const under=gateAt(17320),at=gateAt(17360),benefitCase=gateAt(20000);assert("same-ecosystem math-only addition below $750 fails",under&&under.incrementalRecurringValue<750&&under.pass===false,JSON.stringify(under));assert("same-ecosystem math-only addition at $750 clears hurdle",at&&at.incrementalRecurringValue>=750&&at.pass===true,JSON.stringify(at));assert("all recurring benefits count toward $750, not points alone",benefitCase&&benefitCase.pass===true&&(benefitCase.rewardGain-benefitCase.feeIncrease)<750&&benefitCase.benefitGain>0,JSON.stringify(benefitCase));
}
{
 const common={spend:{dining:17320,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:17320}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{dining:4000}},legacyNaturalBenefitValue:{},constraints:{maxNewCards:1,requiredCards:["amex_platinum"]}};
 const a=E.analyze(base(common)),b=E.analyze(base({...common,welcomeOffers:[{cardId:"amex_gold",eligible:true,minimumSpend:4000,bonusPoints:250000}]}));assert("huge welcome offer does not change sub-$750 recommendation",E.recommendationFingerprint(a)===E.recommendationFingerprint(b),JSON.stringify({a:a.recommended.id,b:b.recommended.id}));
}
{
 const p=base({spend:{dining:20000,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"amex_platinum",amount:20000}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{dining:4000}},welcomeOffers:[{cardId:"amex_gold",eligible:true,minimumSpend:4000,bonusPoints:90000}],legacyNaturalBenefitValue:{},constraints:{maxNewCards:1,requiredCards:["amex_platinum"]}});
 const r=E.analyze(p);assert("eligible welcome offer is exposed only after independent recommendation",r.recommended.portfolio.includes("amex_gold")&&r.recommended.welcomeOffers.some(x=>x.cardId==="amex_gold"),JSON.stringify({p:r.recommended.portfolio,o:r.recommended.welcomeOffers}));assert("welcome offer is not a temporary recommendation job",!r.recommended.temporaryJobs.some(x=>x.type==="welcome_offer"),JSON.stringify(r.recommended.temporaryJobs));
}
{
 const p=E.normalizeProfile(base({spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},currentCards:["amex_gold","amex_platinum"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:0,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},legacyNaturalBenefitValue:{}}));const rewards=E.rewardsStrategy(p,E.travelStrategy(p)),a=E.routeAnnual(p,["amex_gold","amex_platinum"],"base",rewards),b=E.routeAnnual(p,["amex_platinum","amex_gold"],"base",rewards);assert("reversing equal-value card array order does not change routing",same(a,b),JSON.stringify({a,b}));assert("equal-value routing preserves existing category card",a.general?.[0]?.card==="amex_platinum",JSON.stringify(a.general));
}
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},benefitValueByType:{lounge:300},constraints:{maxNewCards:0}})),one=E.benefitLedger(p,["amex_platinum"]),two=E.benefitLedger(p,["amex_platinum","chase_reserve"]);assert("overlapping typed benefit is counted once",one.typeValue===300&&two.typeValue===300,JSON.stringify({one:one.typeValue,two:two.typeValue}));assert("benefit credit does not require historical use",E.recommendationCredit(p,["amex_platinum"]).lounge===1);
}
{assert("$300 material cash threshold is removed",E.MODEL.materialCashImprovement===undefined&&E.MODEL.sameEcosystemIncrementalValueFloor===750,JSON.stringify(E.MODEL));}


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
 assert("existing Venture X gets anniversary miles in recurring economics",r.economics.annualBonusTravelValue===95,JSON.stringify(r.economics));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:0,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{}},cardUniqueBenefitValue:{amex_platinum:900},legacyNaturalBenefitValue:{},benefitValueByType:{}}));
 const x=E.portfolioRecurringBenefitValue(p,["amex_platinum"]);
 assert("legacy aggregate does not stack on top of larger known card benefits",x.totalValue===3114,JSON.stringify(x));
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
 assert("matching airline alone does not create co-brand job",role?.role==="no_job",JSON.stringify(s.current.cardRoles));
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
 const annual={...emptyRouting(),general:[{card:"united_explorer",amount:10000}]};const jobs=E.temporaryJobs(p,["united_explorer"],annual,{airlineTarget:null,hotelTarget:null},"base");
 assert("unpriced conditional reward may surface when natural spend reaches it",jobs.some(x=>x.purpose==="united_travelbank_100"&&x.opportunityCost===0),JSON.stringify(jobs));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum","united_explorer"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"united",primaryAirlineShare:.8,annualOneWayFlights:4,primaryHotel:"",primaryHotelShare:0,cardSpendYTD:{united_explorer:9000},remainingYear:{cardSpend:{general:1000},united:{pqp:0,pqf:0,unitedSegments:0}},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"generic-unpriced-shift",verifiedAt:"2026-09-19",sources:["issuer"],cards:{amex_platinum:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:895,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:2},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:[],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[],verified:true},united_explorer:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:150,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["checked_bag"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[{amount:10000,benefit:"united_travelbank_100"}],verified:true}},airlines:{united:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["united"],thresholds:[{tier:"Premier Silver",amount:6000,pqpOnly:6000,pqpWithPQF:5000,pqf:15}],minimumUnitedSegments:4}},hotels:{}}}));
 const annual={...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]};const jobs=E.temporaryJobs(p,["amex_platinum","united_explorer"],annual,{airlineTarget:null,hotelTarget:null},"base");
 assert("unpriced conditional reward does not redirect spend",!jobs.some(x=>x.purpose==="united_travelbank_100"),JSON.stringify(jobs));
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum","united_explorer"],currentRouting:{...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:10000},primaryAirline:"united",primaryAirlineShare:.8,annualOneWayFlights:4,primaryHotel:"",primaryHotelShare:0,cardSpendYTD:{united_explorer:9000},remainingYear:{cardSpend:{general:1000},united:{pqp:0,pqf:0,unitedSegments:0}},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"generic-valued-shift",verifiedAt:"2026-09-19",sources:["issuer"],cards:{amex_platinum:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:895,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1.01},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:[],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[],verified:true},united_explorer:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:150,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["checked_bag"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[{amount:10000,benefit:"united_travelbank_100",cashValue:100}],verified:true}},airlines:{united:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["united"],thresholds:[{tier:"Premier Silver",amount:6000,pqpOnly:6000,pqpWithPQF:5000,pqf:15}],minimumUnitedSegments:4}},hotels:{}}}));
 const annual={...emptyRouting(),general:[{card:"amex_platinum",amount:10000}]};const jobs=E.temporaryJobs(p,["amex_platinum","united_explorer"],annual,{airlineTarget:null,hotelTarget:null},"base");
 assert("valued conditional reward may redirect spend only when value exceeds opportunity cost",jobs.some(x=>x.purpose==="united_travelbank_100"&&x.modeledValue===100&&x.opportunityCost<100),JSON.stringify(jobs));
}


{
 const p=E.normalizeProfile(base({currentCards:["united_quest"],currentRouting:{...emptyRouting(),general:[{card:"united_quest",amount:20000}]},spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:20000},primaryAirline:"united",primaryAirlineShare:.8,annualOneWayFlights:4,primaryHotel:"",primaryHotelShare:0,cardSpendYTD:{united_quest:19000},remainingYear:{cardSpend:{general:1000},united:{pqp:0,pqf:0,unitedSegments:0}},statusProgress:{united:{pqp:0,pqf:0,unitedSegments:0},hotel:{qualifyingNights:0}},constraints:{maxNewCards:0},verifiedFacts:{snapshotId:"value-points",verifiedAt:"2026-09-19",sources:["issuer"],cards:{united_quest:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["issuer"],annualFee:350,earn:{dining:1,grocery:1,online_grocery:1,gas_ev:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1},bookingEarn:{},caps:{},capGroups:{},groupCaps:{},postCapEarn:{},benefitTags:["checked_bag"],recurringCredits:{},multiYearCredits:{},annualBonusPoints:0,hotelStatus:{},hotelStatusByProgram:{},status:{},transferRules:{},spendRewards:[{amount:20000,benefit:"award_discount_10k",valuePoints:10000,currency:"united_miles"}],verified:true}},airlines:{united:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-19",sources:["united"],thresholds:[{tier:"Premier Silver",amount:6000,pqpOnly:6000,pqpWithPQF:5000,pqf:15}],minimumUnitedSegments:4}},hotels:{}}}));
 const annual={...emptyRouting(),general:[{card:"united_quest",amount:20000}]};const jobs=E.temporaryJobs(p,["united_quest"],annual,{airlineTarget:null,hotelTarget:null},"base");
 assert("conditional award discount uses currency-equivalent value without pretending points are earned",jobs.some(x=>x.purpose==="award_discount_10k"&&x.modeledValue>0),JSON.stringify(jobs));
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
 assert("Freedom Unlimited alone does not receive Hyatt-transfer valuation",Math.abs(cfuValue-E.VALUATIONS.base.chase_ur)<1e-12,JSON.stringify({cfuValue}));
 assert("Freedom Unlimited points can use Sapphire transfer capability when pooled",Math.abs(pooledValue-E.VALUATIONS.base.hyatt_points)<1e-12,JSON.stringify({pooledValue}));
}

console.log("\n------------------------------");
console.log(`V5 alpha.16 harness: ${pass} passed, ${fail} failed`);
if(failures.length)console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;
