const fs=require("fs");
const engine=fs.readFileSync("qp_sim_v5.js","utf8");
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
const worker=fs.readFileSync("supabase/functions/qp-optimize-shard/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("engine exposes profile-level co-brand eligibility",engine.includes("function candidateEligibilityV41")&&engine.includes("candidateEligibilityIds:(p,rewards)")&&engine.includes("candidateEligibility:(p,rewards,ids)"));
ok("candidate generator accepts precomputed eligibility",engine.includes("precomputedCoBrandEligibility=null")&&engine.includes("Object.prototype.hasOwnProperty.call(precomputed,id)"));
ok("build plan computes eligibility in two bounded chunks",build.includes("eligibilityChunks=")&&build.includes('phase:"eligibility",travel,rewards,cardIds'));
ok("build plan sends compact current baseline to shards",build.includes("currentSearchSummary(current)")&&build.includes("currentSearch,coBrandEligibility"));
ok("worker reuses supplied travel and rewards",worker.includes("suppliedTravel")&&worker.includes("suppliedRewards"));
ok("worker reuses supplied current search baseline",worker.includes("body.currentSearch&&typeof body.currentSearch"));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;

ok("eligibility calls are not recursively shard-split",build.includes('payload?.phase==="counterfactual"||payload?.phase==="gated"'));
