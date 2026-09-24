const fs=require("fs");
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("optimizer begins with 32 exact shards",build.includes("OPTIMIZER_SHARDS=32"));
ok("optimizer requests are serialized",build.includes("OPTIMIZER_BATCH=1"));
ok("optimizer requests are paced",build.includes("OPTIMIZER_PACE_MS=500"));
ok("adaptive split children are serialized",!build.includes("Promise.all([optimizerRequest(left,0),optimizerRequest(right,0)])"));
ok("no second gated full-shard sweep",!build.includes('runShardPhase(p,"gated"'));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
