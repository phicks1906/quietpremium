"use strict";
const {spawnSync}=require("child_process");
const {performance}=require("perf_hooks");
const E=require("./qp_sim_v5.js");
function emptyRouting(){return Object.fromEntries(["dining","grocery","online_grocery","drugstore","gas_ev","transit","online_retail","vacation_home","airfare","hotel","general"].map(x=>[x,[]]));}
function syntheticVerifiedFacts(){
 const ids=["amex_green","amex_gold","amex_platinum","chase_preferred","chase_reserve","chase_freedom_unlimited","chase_freedom_flex","venture_one","venture","venture_x","delta_blue","delta_gold","delta_platinum","delta_reserve","marriott_bold","marriott_bountiful","marriott_bevy","marriott_boundless","marriott_brilliant"],cards={};
 for(const id of ids)if(E.RULES.cards[id])cards[id]={verificationStatus:"verified",complete:true,verifiedAt:"2026-09-24T00:00:00Z",sources:["benchmark"],facts:JSON.parse(JSON.stringify(E.RULES.cards[id]))};
 return{snapshotId:"benchmark-verified-facts",verifiedAt:"2026-09-24T00:00:00Z",sources:["benchmark"],cards,airlines:{delta:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-24T00:00:00Z",sources:["benchmark"],facts:JSON.parse(JSON.stringify(E.RULES.airlines.delta))}},hotels:{marriott:{verificationStatus:"verified",complete:true,verifiedAt:"2026-09-24T00:00:00Z",sources:["benchmark"],facts:JSON.parse(JSON.stringify(E.RULES.hotels.marriott))}}};
}
function golden(){return {
 asOfDate:"2026-09-24",valuationSnapshot:E.CURRENT_QP_VALUATION_SNAPSHOT,
 spend:{dining:20000,grocery:15000,online_grocery:0,drugstore:0,gas_ev:5000,transit:0,online_retail:5000,vacation_home:0,airfare:12000,hotel:10000,general:83000},
 currentCards:["amex_platinum","amex_gold","delta_reserve"],
 currentRouting:{...emptyRouting(),dining:[{card:"amex_gold",amount:20000}],grocery:[{card:"amex_gold",amount:15000}],gas_ev:[{card:"delta_reserve",amount:5000}],online_retail:[{card:"amex_platinum",amount:5000}],airfare:[{card:"delta_reserve",amount:12000}],hotel:[{card:"amex_platinum",amount:10000}],general:[{card:"delta_reserve",amount:83000}]},
 remainingYear:{cardSpend:{dining:8000,grocery:6000,gas_ev:2000,online_retail:2000,airfare:5000,hotel:4000,general:36000},delta:{mqd:1500},hotel:{qualifyingNights:3}},
 primaryAirline:"delta",primaryAirlineShare:.75,routeFit:{delta:.9},annualOneWayFlights:16,currentAirlineStatus:"Gold Medallion",
 statusProgress:{delta:{mqd:5500},hotel:{qualifyingNights:8}},primaryHotel:"marriott",primaryHotelShare:.35,currentHotelStatus:"Gold Elite",premiumStayShare:.5,
 currencyUtility:{amex_mr:1,chase_ur:.75,capital_one_miles:.95,hyatt_points:1},cardUniqueBenefitValue:{amex_platinum:700,amex_gold:250,delta_reserve:550},legacyNaturalBenefitValue:{},
 bookingMethod:{airfare:"direct_airline",hotel:"direct_hotel"},constraints:{maxNewCards:2},aspirations:["travel more","better flights","better hotels"],verifiedFacts:syntheticVerifiedFacts()
};}
if(process.env.QP_BENCH_CHILD==="1"){
 const t0=performance.now(),p=E.normalizeProfile(JSON.parse(process.env.QP_PROFILE||"{}")),travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel),current=E.currentRecord(p,"base",travel,rewards),ids=E.candidateEligibilityIds(p,rewards),elig=E.candidateEligibility(p,rewards,ids),idx=Number(process.env.QP_SHARD_INDEX),count=Number(process.env.QP_SHARD_COUNT||32),sets=E.candidatePortfoliosShard(p,rewards,idx,count,elig);
 let viable=0;for(const set of sets){const rr=E.rewardsStrategyForPortfolio(p,set,travel,rewards),x=E.preparePortfolioSearch(p,set,current,"base",travel,rr);if(x?.c)viable++;}
 process.stdout.write(JSON.stringify({idx,candidates:sets.length,viable,ms:performance.now()-t0}));process.exit(0);
}
const shardCount=32,profile=JSON.stringify(golden()),rows=[],wall0=performance.now();
for(let i=0;i<shardCount;i++){const r=spawnSync(process.execPath,[__filename],{encoding:"utf8",env:{...process.env,QP_BENCH_CHILD:"1",QP_SHARD_INDEX:String(i),QP_SHARD_COUNT:String(shardCount),QP_PROFILE:profile},maxBuffer:4*1024*1024});if(r.status!==0){console.error(r.stderr||r.stdout||("shard "+i+" failed"));process.exit(1);}rows.push(JSON.parse(r.stdout));}
const ms=rows.map(x=>x.ms).sort((a,b)=>a-b),q=p=>ms[Math.min(ms.length-1,Math.max(0,Math.ceil(ms.length*p)-1))],summary={engineVersion:E.ENGINE_VERSION,shardCount,totalCandidates:rows.reduce((n,x)=>n+x.candidates,0),totalViable:rows.reduce((n,x)=>n+x.viable,0),p50ShardMs:Math.round(q(.5)),p90ShardMs:Math.round(q(.9)),p95ShardMs:Math.round(q(.95)),maxShardMs:Math.round(ms[ms.length-1]||0),meanShardMs:Math.round(ms.reduce((a,b)=>a+b,0)/(ms.length||1)),coldSequentialWallMs:Math.round(performance.now()-wall0),slowest:rows.slice().sort((a,b)=>b.ms-a.ms).slice(0,5).map(x=>({idx:x.idx,candidates:x.candidates,viable:x.viable,ms:Math.round(x.ms)}))};
console.log("QP_LOCAL_BENCHMARK "+JSON.stringify(summary));if(!summary.totalCandidates||summary.maxShardMs>1500)process.exitCode=1;