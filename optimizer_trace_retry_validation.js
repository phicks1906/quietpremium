const fs=require("fs");
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("optimizer fetch catches thrown trace rate limits",build.includes("RateLimitError")&&build.includes("retryAfterMs"));
ok("trace retry honors platform retry window",build.includes("Math.max(500,retryAfterMs||1000)"));
ok("trace retry is bounded",build.includes("attempt<3")&&build.includes("Math.min(60000"));
ok("HTTP adaptive splitting remains intact",build.includes("res.status===546"));
ok("exact single-pass search remains intact",/OPTIMIZER_SHARDS=\d+/.test(build)&&build.includes('runShardPhase(p,"counterfactual"')&&!build.includes('runShardPhase(p,"gated"'));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
