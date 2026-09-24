const fs=require("fs");
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
const worker=fs.readFileSync("supabase/functions/qp-optimize-shard/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("build separates logical shard count from request grouping",build.includes("OPTIMIZER_SHARDS_PER_REQUEST=1"));
ok("runShardPhase creates complete ordered logical shard groups",build.includes("for(let i=0;i<OPTIMIZER_SHARDS;i+=OPTIMIZER_SHARDS_PER_REQUEST)"));
ok("worker unions exact candidate partitions for grouped indices",worker.includes("shardIndices.flatMap((idx:number)=>E.candidatePortfoliosShard"));
ok("group split is exact union merge",build.includes("mergeShardChildren(a,b,payload)"));
ok("single logical shard can still adaptively subdivide",build.includes("idx+oldCount")&&build.includes("shardCount:nextCount"));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
