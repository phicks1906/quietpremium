const fs=require("fs");
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
const shards=Number((build.match(/OPTIMIZER_SHARDS=(\d+)/)||[])[1]);
const per=Number((build.match(/OPTIMIZER_SHARDS_PER_REQUEST=(\d+)/)||[])[1]);
const normalCounterfactualRequests=Math.ceil(shards/per);
ok("logical shard coverage remains 32 exact partitions",shards===32);
ok("normal counterfactual fanout is reduced to 16 worker calls",normalCounterfactualRequests===16);
ok("grouping changes transport only, not logical shard count",per===2&&build.includes("shardIndices")&&build.includes("shardCount:OPTIMIZER_SHARDS"));
console.log(JSON.stringify({pass,fail,failures,shards,per,normalCounterfactualRequests},null,2));if(fail)process.exitCode=1;
