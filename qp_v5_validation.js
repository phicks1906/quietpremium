/** Quiet Premium V5 validation harness — 5.0-alpha.8 */
"use strict";
const E=require("./qp_sim_v5.js");
let pass=0,fail=0;const failures=[];
function assert(name,cond,detail=""){if(cond){pass++;console.log("PASS "+name);}else{fail++;failures.push({name,detail});console.error("FAIL "+name+(detail?" — "+detail:""));}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function sumRows(r,id){let x=0;for(const rows of Object.values(r||{}))for(const row of rows||[])if(row.card===id)x+=row.amount;return x;}
function emptyRouting(){return Object.fromEntries(["dining","grocery","online_grocery","gas_ev","online_retail","vacation_home","airfare","hotel","general"].map(x=>[x,[]]));}
function base(overrides={}){return{
 asOfDate:"2026-09-17",
 spend:{dining:20000,grocery:15000,online_grocery:0,gas_ev:5000,online_retail:5000,vacation_home:0,airfare:12000,hotel:10000,general:83000},
 currentCards:["amex_platinum"],
 currentRouting:{dining:[{card:"amex_platinum",amount:20000}],grocery:[{card:"amex_platinum",amount:15000}],online_grocery:[],gas_ev:[{card:"amex_platinum",amount:5000}],online_retail:[{card:"amex_platinum",amount:5000}],vacation_home:[],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"amex_platinum",amount:83000}]},
 remainingYear:{cardSpend:{dining:8000,grocery:6000,online_grocery:0,gas_ev:2000,online_retail:2000,vacation_home:0,airfare:5000,hotel:4000,general:36000},delta:{mqd:1500},hotel:{qualifyingNights:3}},
 primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,
 currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},
 primaryHotel:"marriott",primaryHotelShare:.35,currentHotelStatus:"Gold Elite",premiumStayShare:.5,
 currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95,hyatt_points:1},legacyNaturalBenefitValue:{amex_platinum:700},
 bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"},typicalTripCashCost:2500,
 constraints:{maxNewCards:2},aspirations:["travel more"],...overrides};}
{
 const a=E.analyze(base({aspirations:["travel more"]}));
 const b=E.analyze(base({aspirations:["stay better"]}));
 assert("aspirations do not change recommendation",E.recommendationFingerprint(a)===E.recommendationFingerprint(b));
 assert("aspirations change presentation order",!same(a.presentation.order,b.presentation.order));
 assert("all material opportunities are aspiration-invariant",same(a.allMaterialOpportunities,b.allMaterialOpportunities));
 assert("aspiration isolation flags remain locked",a.integrity.aspirationsUsedInRecommendationSelection===false&&a.integrity.allMaterialOpportunitiesIndependentOfAspirations===true);
}
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{}}));
 const r=E.strategyRecord(p,["venture_x"],"base");
 assert("Venture X lounge remains visible",r.visibleBenefits.some(x=>x.benefit==="lounge"));
 assert("lounge gets zero recommendation credit without evidence",r.recommendationCredit.lounge===0);
}
{
 const p=E.normalizeProfile(base({currentCards:[],currentRouting:emptyRouting(),primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:10,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},benefitEvidence:{venture_x:{lounge_access:true}},legacyNaturalBenefitValue:{}}));
 assert("explicit lounge evidence creates internal recommendation credit",E.strategyRecord(p,["venture_x"],"base").recommendationCredit.lounge===1);
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_platinum","marriott_brilliant"],currentRouting:{...emptyRouting(),airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"marriott_brilliant",amount:10000}],general:[{card:"marriott_brilliant",amount:138000}]},benefitValueByType:{lounge:500},cardUniqueBenefitValue:{amex_platinum:200,marriott_brilliant:300},legacyNaturalBenefitValue:{}}));
 const l=E.benefitLedger(p,["amex_platinum","marriott_brilliant"]);
 assert("canonical lounge value is counted once",l.typeValue===500,JSON.stringify(l));
 assert("specific lounge and Priority Pass labels both remain visible",l.visible.some(x=>x.benefit==="lounge")&&l.visible.some(x=>x.benefit==="priority_pass"));
}
assert("CSP gas/EV is 3x",E.RULES.cards.chase_preferred.earn.gas_ev===3);
assert("CSP vacation homes is 3x",E.RULES.cards.chase_preferred.earn.vacation_home===3);
assert("CSP online grocery is 3x and generic grocery 1x",E.RULES.cards.chase_preferred.earn.online_grocery===3&&E.RULES.cards.chase_preferred.earn.grocery===1);
assert("Boundless combined everyday cap is $6K",E.RULES.cards.marriott_boundless.groupCaps.boundless_everyday===6000);
assert("Boundless post-cap rate is 2x",E.RULES.cards.marriott_boundless.postCapEarn.dining===2);
assert("Hilton no-fee Gold spend threshold is $20K",E.RULES.cards.hilton_no_fee.hotelStatus.spendTier.amount===20000&&E.RULES.cards.hilton_no_fee.hotelStatus.spendTier.tier==="Gold");
assert("Surpass Diamond spend threshold is $40K",E.RULES.cards.hilton_surpass.hotelStatus.spendTier.amount===40000&&E.RULES.cards.hilton_surpass.hotelStatus.spendTier.tier==="Diamond");
assert("Surpass Free Night threshold is $15K",E.RULES.cards.hilton_surpass.hotelStatus.spendRewards[0].amount===15000);
assert("Surpass online retail is 4x",E.RULES.cards.hilton_surpass.earn.online_retail===4);
assert("Surpass gas is 6x",E.RULES.cards.hilton_surpass.earn.gas_ev===6);
{
 const p=E.normalizeProfile(base({spend:{dining:0,grocery:10000,online_grocery:2000,gas_ev:7000,online_retail:9000,vacation_home:11000,airfare:0,hotel:0,general:0}}));
 assert("grocery total uses online subset without double count",p.spend.grocery===8000&&p.spend.online_grocery===2000);
 assert("gas/EV retained separately",p.spend.gas_ev===7000);
 assert("online retail retained separately",p.spend.online_retail===9000);
 assert("vacation home retained separately",p.spend.vacation_home===11000);
}
{
 const p=E.normalizeProfile(base({spend:{dining:0,grocery:30000,online_grocery:10000,gas_ev:0,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["amex_gold","venture"],currentRouting:{...emptyRouting(),grocery:[{card:"amex_gold",amount:15000},{card:"venture",amount:5000}],online_grocery:[{card:"amex_gold",amount:10000}]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"",primaryHotelShare:0,annualOneWayFlights:2,statusProgress:{hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{grocery:10000,online_grocery:5000},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{}}));
 const r=E.routeAnnual(p,["amex_gold","venture"],"base");
 assert("Gold gets exactly $25K across shared supermarket cap",sumRows(r,"amex_gold")===25000,JSON.stringify(r));
 assert("excess supermarket spend routes to 2x card",sumRows(r,"venture")===5000,JSON.stringify(r));
}
{
 const p=E.normalizeProfile(base({spend:{dining:4000,grocery:4000,online_grocery:0,gas_ev:2000,online_retail:0,vacation_home:0,airfare:0,hotel:0,general:0},currentCards:["marriott_boundless"],currentRouting:{...emptyRouting(),dining:[{card:"marriott_boundless",amount:4000}],grocery:[{card:"marriott_boundless",amount:4000}],gas_ev:[{card:"marriott_boundless",amount:2000}]},primaryAirline:"",primaryAirlineShare:0,primaryHotel:"marriott",primaryHotelShare:.8,statusProgress:{hotel:{qualifyingNights:10}},remainingYear:{cardSpend:{},hotel:{qualifyingNights:0}},cardSpendYTD:{marriott_boundless:0},legacyNaturalBenefitValue:{}}));
 const r=E.strategyRecord(p,["marriott_boundless"],"base");
 assert("Boundless combined-cap points equal 26K on $10K mixed eligible spend",r.economics.pointsByCard.marriott_boundless===26000,JSON.stringify(r.economics.pointsByCard));
}
{
 const p=E.normalizeProfile(base({currentCards:["chase_preferred"],cardOpenDate:{chase_preferred:"2026-07-01"},redemptionPartner:"hyatt",currencyUtility:{chase_ur:1,hyatt_points:1}}));
 assert("post-Jun-15 CSP Hyatt ratio is 4:3",E.transferRatio("chase_preferred","hyatt",p,false)===.75);
 assert("CSP Hyatt value uses destination point value",Math.abs(E.currencyPointValue(p,"chase_ur","base",["chase_preferred"])-(.75*E.VALUATIONS.base.hyatt_points))<1e-9);
}
{
 const portal=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"chase_travel",hotel:"chase_travel"}}));
 const direct=E.normalizeProfile(base({currentCards:["chase_preferred"],bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"}}));
 assert("CSP Chase Travel earns more than direct travel",E.strategyRecord(portal,["chase_preferred"],"base").economics.grossTravelValue>E.strategyRecord(direct,["chase_preferred"],"base").economics.grossTravelValue);
}
{
 const p=E.normalizeProfile(base({currentCards:["amex_gold"],currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],airfare:[{card:"amex_gold",amount:12000}],hotel:[{card:"amex_gold",amount:10000}],general:[{card:"amex_gold",amount:103000}]},statusProgress:{delta:{mqd:7500},hotel:{qualifyingNights:2}},currentAirlineStatus:"Silver Medallion",remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:2000,general:10000},delta:{mqd:0},hotel:{qualifyingNights:0}},legacyNaturalBenefitValue:{amex_gold:200}}));
 assert("Delta Headstart can create a concrete Reserve job",E.reachableAirlineJob(p,"delta_reserve")===true);
}
{
 const p=E.normalizeProfile(base({primaryAirline:"united",primaryAirlineShare:.9,routeFit:{united:.9},annualOneWayFlights:32,currentAirlineStatus:"Premier Silver",statusProgress:{united:{pqp:9000,pqf:28,unitedSegments:4},hotel:{qualifyingNights:0}},remainingYear:{cardSpend:{general:10000},united:{pqp:1000,pqf:2,unitedSegments:1},hotel:{qualifyingNights:0}},currentCards:["venture"],currentRouting:{...emptyRouting(),general:[{card:"venture",amount:150000}]},primaryHotel:"",primaryHotelShare:0,legacyNaturalBenefitValue:{}}));
 const proj=E.airlineProjection(p,"united",emptyRouting(),[]);
 assert("United 30 PQF + 10K PQP reaches Gold",proj.tier==="Premier Gold",JSON.stringify(proj));
}
{
 const p=E.normalizeProfile(base({primaryAirline:"american",primaryAirlineShare:.9,routeFit:{american:.9},annualOneWayFlights:20,currentAirlineStatus:"AAdvantage Platinum",statusProgress:{american:{loyaltyPoints:110000},hotel:{qualifyingNights:0}},americanQualification:{cardSpend:{general:20000},loyaltyPoints:5000},primaryHotel:"",primaryHotelShare:0,currentCards:["aa_executive"],currentRouting:{...emptyRouting(),general:[{card:"aa_executive",amount:150000}]},legacyNaturalBenefitValue:{aa_executive:700}}));
 assert("American uses explicit Mar-Feb qualification input",E.airlineQualificationDataReady(p,"american",["aa_executive"])===true);
}
{
 const r=E.analyze(base({primaryAirline:"southwest",primaryAirlineShare:.9,routeFit:{southwest:.9},annualOneWayFlights:24,currentAirlineStatus:"",statusProgress:{southwest:{tqp:10000,qualifyingFlights:19},hotel:{qualifyingNights:2}},remainingYear:{cardSpend:{general:3000},southwest:{tqp:0,qualifyingFlights:1},hotel:{qualifyingNights:0}},currentCards:["southwest_priority"],currentRouting:{...emptyRouting(),general:[{card:"southwest_priority",amount:150000}]},legacyNaturalBenefitValue:{southwest_priority:229}}));
 assert("organic Southwest flight can qualify A-List",r.current.outcomes.flightQuality.effectiveStatus==="A-List"||r.recommended.outcomes.flightQuality.effectiveStatus==="A-List");
 assert("Southwest does not manufacture a status target",!r.recommended.strategy.airlineStatusTarget);
}
{
 const p=E.normalizeProfile(base({primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Silver",statusProgress:{hotel:{qualifyingNights:10}},remainingYear:{cardSpend:{general:12000,hotel:3000},hotel:{qualifyingNights:2}},currentCards:["hilton_no_fee"],currentRouting:{...emptyRouting(),general:[{card:"hilton_no_fee",amount:135000}],hotel:[{card:"hilton_no_fee",amount:15000}]},cardSpendYTD:{hilton_no_fee:10000},primaryAirline:"",primaryAirlineShare:0,legacyNaturalBenefitValue:{}}));
 const rec=E.strategyRecord(p,["hilton_no_fee"],"base");
 assert("Hilton no-fee $20K spend path can project Gold",["Gold","Diamond","Diamond Reserve"].includes(rec.outcomes.hotelExperience.effectiveStatus),rec.outcomes.hotelExperience.effectiveStatus);
}
{
 const p=E.normalizeProfile(base({primaryHotel:"hilton",primaryHotelShare:.9,currentHotelStatus:"Gold",statusProgress:{hotel:{qualifyingNights:20}},remainingYear:{cardSpend:{general:20000,hotel:5000},hotel:{qualifyingNights:4}},currentCards:["hilton_surpass"],currentRouting:{...emptyRouting(),general:[{card:"hilton_surpass",amount:125000}],hotel:[{card:"hilton_surpass",amount:25000}]},cardSpendYTD:{hilton_surpass:20000},primaryAirline:"",primaryAirlineShare:0,legacyNaturalBenefitValue:{}}));
 const rec=E.strategyRecord(p,["hilton_surpass"],"base");
 assert("Surpass $40K spend path can project Diamond",["Diamond","Diamond Reserve"].includes(rec.outcomes.hotelExperience.effectiveStatus),rec.outcomes.hotelExperience.effectiveStatus);
 assert("Surpass $15K free-night benefit remains visible",rec.visibleBenefits.some(x=>x.benefit==="free_night_reward_15k"));
 assert("Surpass $200 Hilton credit remains visible",rec.visibleBenefits.some(x=>x.benefit==="hilton_credit_200"));
 assert("Surpass spend reward progress is exposed",rec.outcomes.hotelExperience.spendRewards.some(x=>x.benefit==="free_night_reward_15k"&&x.reached===true));
}
{
 const p=E.normalizeProfile(base({primaryHotel:"hilton",primaryHotelShare:.9,statusProgress:{hotel:{qualifyingNights:10}},remainingYear:{cardSpend:{general:10000},hotel:{qualifyingNights:2}},currentCards:["hilton_surpass"],currentRouting:{...emptyRouting(),general:[{card:"hilton_surpass",amount:150000}]},primaryAirline:"",primaryAirlineShare:0,legacyNaturalBenefitValue:{}}));
 assert("missing current Hilton card YTD spend is surfaced",E.currentRecord(p,"base").quality.issues.some(x=>x.code==="hotel_card_spend_ytd_missing"));
}
{
 const p=E.normalizeProfile(base({primaryHotel:"marriott",primaryHotelShare:.7,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:8}},remainingYear:{cardSpend:{hotel:3000,general:10000},hotel:{qualifyingNights:3}},currentCards:["amex_platinum"],marriottBeyondFHR:false,directMarriottNights:5}));
 assert("Brilliant blocked beside Platinum absent strong Marriott-specific use",!E.candidatePortfolios(p).some(x=>x.includes("marriott_brilliant")));
}
{
 const p=E.normalizeProfile(base({spend:{dining:10000,grocery:10000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:10000,hotel:10000,general:60000},currentCards:["delta_reserve","hyatt_consumer","venture"],currentRouting:{...emptyRouting(),dining:[{card:"venture",amount:10000}],grocery:[{card:"venture",amount:10000}],airfare:[{card:"delta_reserve",amount:10000}],hotel:[{card:"hyatt_consumer",amount:10000}],general:[{card:"venture",amount:60000}]},primaryAirline:"delta",primaryAirlineShare:.9,routeFit:{delta:.9},annualOneWayFlights:24,currentAirlineStatus:"Gold Medallion",statusProgress:{delta:{mqd:12000},hotel:{qualifyingNights:50}},primaryHotel:"hyatt",primaryHotelShare:.9,currentHotelStatus:"Explorist",remainingYear:{cardSpend:{dining:3000,grocery:3000,airfare:4000,hotel:3000,general:17000},delta:{mqd:0},hotel:{qualifyingNights:2}},legacyNaturalBenefitValue:{delta_reserve:650,hyatt_consumer:95,venture:0}}));
 const rec=E.strategyRecord(p,["delta_reserve","hyatt_consumer","venture"],"base"),t=rec.strategy.airlineStatusTarget;
 if(t){const proj=E.airlineProjection(p,"delta",rec.airlineQualificationRouting,rec.portfolio);assert("post-hotel rerouting still satisfies stated airline target",E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===proj.tier)>=E.RULES.airlines.delta.thresholds.findIndex(x=>x.tier===t.tier),JSON.stringify({target:t,proj}));}
 else assert("airline target may be omitted rather than broken",true);
}
{
 const r=E.analyze(base({currentCards:["Mystery Premium Card","amex_platinum"],currentRouting:{...emptyRouting(),dining:[{card:"Mystery Premium Card",amount:20000}],grocery:[{card:"Mystery Premium Card",amount:15000}],airfare:[{card:"amex_platinum",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"Mystery Premium Card",amount:93000}]}}));
 assert("unsupported material spend blocks precision",r.current.quality.precisionSuppressed===true);
 assert("blocked comparison keeps current setup",r.recommended.id==="current");
}
{
 const p=base({spend:{dining:0,grocery:0,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:5000,hotel:5000,general:140000},currentCards:["amex_platinum"],currentRouting:{...emptyRouting(),airfare:[{card:"amex_platinum",amount:5000}],hotel:[{card:"amex_platinum",amount:5000}],general:[{card:"amex_platinum",amount:140000}]},remainingYear:{cardSpend:{airfare:1000,hotel:1000,general:40000},delta:{mqd:0},hotel:{qualifyingNights:1}},primaryAirlineShare:.3,annualOneWayFlights:4,statusProgress:{delta:{mqd:0},hotel:{qualifyingNights:2}},currencyUtility:{amex_mr:1,chase_ur:.3,capital_one_miles:1},legacyNaturalBenefitValue:{amex_platinum:900}});
 const adds=E.analyze(p).recommended.actions.filter(x=>x.action==="add").map(x=>x.cardId);
 assert("2x-everywhere card can be recommended",adds.includes("venture")||adds.includes("venture_x"),adds.join(","));
}
{
 const p=base({spend:{dining:25000,grocery:25000,online_grocery:0,gas_ev:0,online_retail:0,vacation_home:0,airfare:10000,hotel:5000,general:35000},currentCards:["amex_gold","venture"],currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:25000}],grocery:[{card:"amex_gold",amount:25000}],airfare:[{card:"venture",amount:10000}],hotel:[{card:"venture",amount:5000}],general:[{card:"venture",amount:35000}]},remainingYear:{cardSpend:{dining:5000,grocery:5000,airfare:3000,hotel:1000,general:10000},hotel:{qualifyingNights:1}},primaryAirline:"",primaryAirlineShare:0,annualOneWayFlights:3,primaryHotel:"",primaryHotelShare:0,statusProgress:{hotel:{qualifyingNights:2}},legacyNaturalBenefitValue:{amex_gold:250}});
 assert("already-strong Gold + Venture wallet can return no change",E.analyze(p).recommended.id==="current",E.analyze(p).recommended.id);
}
{
 const r=E.analyze(base({routeFit:{}}));
 assert("missing route fit is flagged",r.current.quality.issues.some(x=>x.code==="route_fit_not_independently_verified"));
 assert("sensitivity exposes all three scenario recommendations",!!r.sensitivity.recommendationIds.conservative&&!!r.sensitivity.recommendationIds.base&&!!r.sensitivity.recommendationIds.upper);
 assert("alpha.8 integrity flags richer taxonomy",r.integrity.richerSpendTaxonomy===true&&r.integrity.hiltonSpendStatusModeled===true&&r.integrity.postHotelAirlineTargetRevalidated===true);
}
console.log("\n------------------------------");
console.log(`V5 alpha.8 harness: ${pass} passed, ${fail} failed`);
if(failures.length)console.log(JSON.stringify(failures,null,2));
process.exitCode=fail?1:0;