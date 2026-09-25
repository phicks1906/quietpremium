const fs=require("fs");
let pass=0,fail=0;const failures=[];
function ok(name,cond,detail=""){if(cond){pass++;return}fail++;failures.push({name,detail})}
function read(p){return fs.readFileSync(p,"utf8")}

const home=read("index.html");
const preview=read("analysis.html");
const diagnostic=read("diagnostic.html");
const contact=read("contact.html");
const feedback=read("founding-feedback.html");
const plan=read("plan.html");
const loader=read("assets/plan-v241-loader.js");
const renderer=read("assets/plan-v270-renderer.js");
const privacy=read("privacy.html");
const terms=read("terms.html");
const sitemap=read("sitemap.xml");

for(const [name,c] of [["home",home],["preview",preview],["diagnostic",diagnostic],["contact",contact],["feedback",feedback]]){
  ok(name+" exposes Privacy",c.includes("privacy.html"));
  ok(name+" exposes Terms",c.includes("terms.html"));
}

ok("privacy canonical is current",privacy.includes('rel="canonical" href="https://quietpremium.com/privacy.html"'));
ok("terms canonical is current",terms.includes('rel="canonical" href="https://quietpremium.com/terms.html"'));
ok("sitemap indexes privacy",sitemap.includes("https://quietpremium.com/privacy.html"));
ok("sitemap indexes terms",sitemap.includes("https://quietpremium.com/terms.html"));

ok("privacy discloses local draft storage",privacy.includes("saves an unfinished draft locally in your browser"));
ok("privacy discloses completed-plan storage",privacy.includes("private Supabase database"));
ok("privacy states detailed answers are excluded from Google Analytics",privacy.includes("Detailed Full Analysis answers")&&privacy.includes("are not sent to Google Analytics"));
ok("privacy discloses Formspree",privacy.includes("Formspree"));
ok("privacy avoids unsupported fixed retention promise",privacy.includes("does not currently promise automatic deletion"));
ok("privacy warns private links are bearer-like secrets",privacy.includes("Anyone who has the complete private link may be able to retrieve the plan"));

ok("terms says decision support not financial advice",terms.includes("informational decision-support product")&&terms.includes("does not provide financial planning"));
ok("terms discloses third-party rule changes",terms.includes("Third-party rules change"));
ok("terms warns private link sharing can expose plan",terms.includes("Anyone who obtains the complete link may be able to view the plan"));
ok("terms preserves independent positioning",terms.includes("Quiet Premium is independent"));

ok("loader captures public Analysis ID only",loader.includes('window.QP_PLAN_ANALYSIS_ID=String(row.id||c.id||"")'));
ok("loader does not expose retrieval token to renderer",!loader.includes("analysisId:c.token")&&!loader.includes("analysisId:token"));
ok("renderer emits founding feedback CTA",renderer.includes('founding-feedback.html')&&renderer.includes("Founding client feedback"));
ok("feedback CTA uses Analysis ID query parameter",renderer.includes("?a='+encodeURIComponent(analysisId)"));
ok("feedback CTA does not include private token",!renderer.includes("founding-feedback.html?t=")&&!renderer.includes("founding-feedback.html'+(analysisId?'?a='+encodeURIComponent(analysisId)+'&t="));
ok("feedback page validates Analysis ID format",feedback.includes("/^QP-\\d{8}-[A-F0-9]{10}$/i"));
ok("feedback payload includes Analysis ID",feedback.includes("analysis_id: form.analysis_id.value || '(not linked)'"));
ok("feedback page never reads retrieval token",!feedback.includes("get('t')")&&!feedback.includes('get("t")'));

ok("plan refreshes loader cachebuster",plan.includes("assets/plan-v241-loader.js?v=250"));
ok("plan refreshes renderer cachebuster",plan.includes("assets/plan-v270-renderer.js?v=290"));
ok("plan refreshes result css cachebuster",plan.includes("assets/plan-v250.css?v=270"));

const diagnosticV5=read("assets/diagnostic-v5.js");
ok("V5 sends central assessment_complete",diagnosticV5.includes('sendCentralEvent("assessment_complete",saved.architecture_id,saved.retrieval_token)'));
ok("V5 sends central result_save",diagnosticV5.includes('sendCentralEvent("result_save",saved.architecture_id,saved.retrieval_token)'));
ok("V5 telemetry uses existing allowlisted RPC",diagnosticV5.includes('/rest/v1/rpc/qp_log_event_v2'));
ok("V5 telemetry sends no profile or answer payload",!diagnosticV5.includes('p_metadata:{profile')&&!diagnosticV5.includes('p_metadata:{spend')&&!diagnosticV5.includes('p_metadata:{cards'));

ok("result loader logs token-validated results_view",loader.includes('logPrivateEvent("results_view",c)'));
ok("result loader logs token-validated result_retrieved",loader.includes('logPrivateEvent("result_retrieved",c)'));
ok("result telemetry passes private credentials only to logger RPC",loader.includes('p_architecture_id:c.id')&&loader.includes('p_token:c.token'));

ok("feedback loads central tracker",feedback.includes('assets/v213-track.js?v=217'));
ok("feedback logs only after successful submission",feedback.indexOf("track('feedback_submit'")>feedback.indexOf("if(res.ok){"));
ok("feedback telemetry contains no feedback text or email",!feedback.includes("track('feedback_submit',{email")&&!feedback.includes("track('feedback_submit',{q1"));

ok("diagnostic telemetry cachebuster advanced",diagnostic.includes('assets/diagnostic-v5.js?v=290'));
ok("result loader telemetry cachebuster advanced",plan.includes('assets/plan-v241-loader.js?v=260'));

console.log(JSON.stringify({pass,fail,failures},null,2));
if(fail)process.exitCode=1;
