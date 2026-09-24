const fs=require("fs");
const worker=fs.readFileSync("supabase/functions/qp-optimize-shard/index.ts","utf8");
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
let pass=0,fail=0;const failures=[];
function ok(name,cond){if(cond)pass++;else{fail++;failures.push(name)}}
ok("counterfactual shards emit best-by-new-card-set summaries",worker.includes("bestByNewSet"));
ok("counterfactual search uses reduced exact ranking records",worker.includes("E.preparePortfolioSearch(p,set,current"));
ok("co-brand eligibility is computed before shard fanout",build.includes('phase:"eligibility",travel,rewards,cardIds')&&build.includes("coBrandEligibility=Object.assign")&&build.includes('runShardPhase(p,"counterfactual",{cardIds:ids,travel,rewards,currentSearch,coBrandEligibility}'));
ok("shards reuse parent travel rewards and current baseline",build.includes("travel,rewards,currentSearch")&&worker.includes("body.currentSearch"));
ok("candidate shards consume precomputed co-brand eligibility",worker.includes("body.coBrandEligibility||null"));
ok("logical shards can be grouped into fewer worker requests",build.includes("OPTIMIZER_SHARDS_PER_REQUEST")&&build.includes("shardIndices"));
ok("worker evaluates grouped logical shard indices",worker.includes("shardIndices.flatMap"));
ok("resource-bound shard groups split before logical shard depth increases",build.includes("if(indices.length>1)")&&build.includes("indices.slice(0,mid)"));
ok("selection phase reconstructs one exact portfolio",worker.includes('phase==="select"')&&worker.includes("selected_portfolio_id_mismatch"));
ok("build-plan merges best-by-new-card-set on adaptive splits",build.includes("bestByNewSet[key]=betterSummary"));
ok("build-plan does not run a second gated shard sweep",!build.includes('runShardPhase(p,"gated"'));
ok("build-plan makes one exact selection reconstruction call",build.includes('phase:"select",portfolio:winningSummary.portfolio'));
ok("selection calls are not recursively split",build.includes('(payload?.phase==="counterfactual"||payload?.phase==="gated")&&(res.status===546||transient)'));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
