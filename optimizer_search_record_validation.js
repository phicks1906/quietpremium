const fs=require("fs");
const engine=fs.readFileSync("qp_sim_v5.js","utf8");
const worker=fs.readFileSync("supabase/functions/qp-optimize-shard/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("alpha.39 exports exact search-record builder",engine.includes("preparePortfolioSearch:(p,portfolio,current"));
ok("search record computes the same recurring annual plan",engine.includes("function preparePortfolioSearchV39")&&engine.includes("recurringAnnualPlanV24(p,portfolio,scenario,rewards)"));
ok("search record preserves status plan and temporary opportunity cost",engine.includes("suppressNonIncrementalUpgradeTargets(p,statusPlanV13")&&engine.includes("tempCost=round(sum(jobs.map"));
ok("search record preserves comparator outcomes",engine.includes("travelCapacity:{annualTravelValue")&&engine.includes("companionPassReached:companionPass.reached===true")&&engine.includes("hotelExperience:{effectiveStatus"));
ok("search record computes roles only after viability",engine.indexOf("const c=viableAgainstCurrentV13(record,current);")<engine.indexOf("record.cardRoles=cardRolesV13"));
ok("counterfactual worker avoids full customer-facing strategy records",worker.includes("E.preparePortfolioSearch(p,set,current")&&worker.includes('if(phase==="counterfactual")'));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
