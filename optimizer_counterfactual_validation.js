const fs=require("fs");
const worker=fs.readFileSync("supabase/functions/qp-optimize-shard/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
const start=worker.indexOf('if(phase==="counterfactual"){');
const end=worker.indexOf('if(phase==="gated"){',start);
const counterfactual=start>=0&&end>start?worker.slice(start,end):"";
ok("counterfactual scan avoids repeated choosePrepared sorts",counterfactual.length>0&&!counterfactual.includes("E.choosePrepared("));
ok("counterfactual scan preserves best-with and best-without",counterfactual.includes("bestWith[id]=betterSummary")&&counterfactual.includes("bestWithout[id]=betterSummary"));
ok("counterfactual scan preserves exact best-by-new-card-set",counterfactual.includes("bestByNewSet[key]=betterSummary"));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
