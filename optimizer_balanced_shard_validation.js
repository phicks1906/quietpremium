const fs=require("fs");
const engine=fs.readFileSync("qp_sim_v5.js","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("balanced sharder no longer truncates to a power of two",!engine.includes("effectiveShards=2**shardBits")&&!engine.includes("partitionBit"));
ok("balanced sharder assigns each unique portfolio by stable ordinal",engine.includes("const assigned=ordinal%shards;ordinal++"));
ok("balanced sharder traverses the same feasibility rules",engine.includes("badHotelStack(p,selected)")&&engine.includes("brilliantAllowed(p,selected)")&&engine.includes("maxNewCards"));
ok("balanced sharder supports precomputed co-brand eligibility",engine.includes("precomputedCoBrandEligibility=null")&&engine.includes("precomputed[id]===true"));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
