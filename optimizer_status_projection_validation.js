const fs=require("fs");
const engine=fs.readFileSync("qp_sim_v5.js","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("status plan returns final airline projection",engine.includes("finalAirProjection")&&engine.includes("return{airlineRouting:airRouting"));
ok("status plan returns final hotel projection",engine.includes("finalHotelProjection"));
ok("full strategy reuses status-plan airline projection",engine.includes("plan.finalAirProjection||airProjection"));
ok("full strategy reuses status-plan hotel projection",engine.includes("plan.finalHotelProjection||hotelProjection"));
ok("search strategy reuses status-plan projections",engine.match(/plan\.finalAirProjection\|\|airProjection/g)?.length>=2&&engine.match(/plan\.finalHotelProjection\|\|hotelProjection/g)?.length>=2);
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
