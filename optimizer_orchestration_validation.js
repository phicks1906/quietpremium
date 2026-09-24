const fs=require("fs");
const worker=fs.readFileSync("supabase/functions/qp-optimize-shard/index.ts","utf8");
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
let pass=0,fail=0;const failures=[];
function ok(name,cond){if(cond)pass++;else{fail++;failures.push(name)}}
ok("counterfactual shards emit best-by-new-card-set summaries",worker.includes("bestByNewSet"));
ok("selection phase reconstructs one exact portfolio",worker.includes('phase==="select"')&&worker.includes("selected_portfolio_id_mismatch"));
ok("build-plan merges best-by-new-card-set on adaptive splits",build.includes("bestByNewSet[key]=betterSummary"));
ok("build-plan does not run a second gated shard sweep",!build.includes('runShardPhase(p,"gated"'));
ok("build-plan makes one exact selection reconstruction call",build.includes('phase:"select",portfolio:winningSummary.portfolio'));
ok("selection calls are not recursively split",build.includes('payload?.phase!=="select"'));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
