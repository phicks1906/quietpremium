const fs=require("fs");
const worker=fs.readFileSync("supabase/functions/qp-optimize-shard/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("counterfactual scan avoids repeated choosePrepared sorts",!worker.includes("E.choosePrepared(prepared.filter"));
ok("counterfactual scan preserves best-with and best-without",worker.includes("bestWith[id]=betterSummary")&&worker.includes("bestWithout[id]=betterSummary"));
ok("counterfactual scan preserves exact best-by-new-card-set",worker.includes("bestByNewSet[key]=betterSummary"));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
