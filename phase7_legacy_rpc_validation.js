const fs=require("fs"),path=require("path");
let pass=0,fail=0;const failures=[];
function ok(name,cond,detail=""){if(cond){pass++;return}fail++;failures.push({name,detail})}
const retired=["qp_save_architecture","qp_get_architecture","qp_log_event","qp_save_contact","qp_submit_feedback"];
const livePublic=["qp_get_plan_v1","qp_log_event_v2"];
const retiredSignatures=[
  "qp_save_architecture(jsonb,jsonb,jsonb)",
  "qp_get_architecture(text,text)",
  "qp_log_event(text,text,text,jsonb)",
  "qp_save_contact(text,text,text,text)",
  "qp_submit_feedback(text,text,text,text)"
];
ok("legacy grant retirement covers exactly five RPC signatures",retiredSignatures.length===5&&new Set(retiredSignatures).size===5);
const migration=fs.readFileSync("supabase/migrations/20260924232220_phase7_retire_legacy_public_rpc_grants.sql","utf8");
for(const sig of retiredSignatures){
  ok("migration revokes anon for "+sig,migration.includes("revoke all on function public."+sig+" from anon"));
  ok("migration preserves service role for "+sig,migration.includes("grant execute on function public."+sig+" to service_role"));
}
ok("migration leaves live public plan retrieval untouched",!migration.includes("qp_get_plan_v1"));
ok("migration leaves live funnel telemetry untouched",!migration.includes("qp_log_event_v2"));
const skip=new Set(["supabase/migrations",".git"]);
const hits={};for(const n of retired)hits[n]=[];
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name),rel=p.replaceAll("\\","/");
    if(ent.isDirectory()){if(skip.has(rel)||rel.startsWith("supabase/migrations/"))continue;walk(p);continue}
    if(!/\.(?:html|js|ts)$/.test(ent.name))continue;
    if(rel.includes("phase7_legacy_rpc_validation.js"))continue;
    const c=fs.readFileSync(p,"utf8");
    for(const n of retired){
      const re=n==="qp_log_event"?/["']qp_log_event["']/g:new RegExp(n,"g");
      if(re.test(c))hits[n].push(rel);
    }
  }
}
walk(".");
for(const n of retired)ok("retired RPC has no live client reference: "+n,hits[n].length===0,hits[n].join(", "));
const loader=fs.readFileSync("assets/plan-v241-loader.js","utf8");
const tracking=fs.readFileSync("assets/v213-track.js","utf8");
ok("current private-plan retrieval remains referenced",loader.includes("qp_get_plan_v1"));
ok("current funnel telemetry remains referenced",tracking.includes("qp_log_event_v2"));
console.log(JSON.stringify({pass,fail,failures,hits},null,2));if(fail)process.exitCode=1;
