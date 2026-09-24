const fs=require("fs");
const engine=fs.readFileSync("qp_sim_v5.js","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("pruned shard partitioning is restored",engine.includes("partitionIds=optionals.slice")&&engine.includes("partitionBit=new Map"));
ok("shard generation prunes forced bit branches",engine.includes("if(forcedBit===0)")&&engine.includes("if(forcedBit===1)"));
ok("full-universe ordinal traversal is removed",!engine.includes("const assigned=ordinal%shards"));
ok("precomputed co-brand eligibility remains supported",engine.includes("precomputedCoBrandEligibility=null")&&engine.includes("precomputed[id]===true"));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
