const fs=require("fs");
let pass=0,fail=0;const failures=[];
function ok(name,cond,detail=""){if(cond){pass++;return}fail++;failures.push({name,detail})}
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
const client=fs.readFileSync("assets/diagnostic-v5.js","utf8");
const html=fs.readFileSync("diagnostic.html","utf8");

ok("build-plan persists server-side",build.includes('/rest/v1/rpc/qp_save_plan_v1'));
ok("build-plan uses service role for persistence",build.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'));
ok("build-plan sends service-role authorization",build.includes('"Authorization":"Bearer "+service'));
ok("build-plan validates stored-plan credentials",build.includes('body?.architecture_id')&&build.includes('body?.retrieval_token'));
ok("build-plan returns savedPlan",build.includes('return json({...output,savedPlan},200,origin)'));
ok("build-plan sanitizes funnel session",build.includes('/^[A-Za-z0-9_-]{12,80}$/'));
ok("build-plan persistence is rollout-gated",build.includes('const persistRequested=body?.persistPlan===true')&&build.includes('if(!persistRequested)return json(output,200,origin)'));
ok("client no longer calls save RPC",!client.includes('/rest/v1/rpc/qp_save_plan_v1'));
ok("client no longer defines savePlan",!client.includes('function savePlan('));
ok("client consumes server savedPlan",client.includes('const saved=result?.savedPlan'));
ok("client sends funnel session alongside profile",client.includes('const FUNNEL_SESSION_KEY="qp_funnel_session_v1"')&&client.includes('funnelSession:sessionStorage.getItem(FUNNEL_SESSION_KEY)'));
ok("current client explicitly requests server persistence",client.includes('persistPlan:true'));
ok("service role never appears in client",!client.includes("SUPABASE_SERVICE_ROLE_KEY"));
ok("diagnostic cachebuster advanced",html.includes('assets/diagnostic-v5.js?v=290'));
const migration=fs.readFileSync("supabase/migrations/20260924231251_phase7_restrict_plan_save_to_service_role.sql","utf8");
ok("migration revokes anonymous plan save",migration.includes("from anon"));
ok("migration preserves service-role plan save",migration.includes("to service_role"));
console.log(JSON.stringify({pass,fail,failures},null,2));
if(fail)process.exitCode=1;
