const fs=require("fs");
let pass=0,fail=0;const failures=[];
function ok(name,cond,detail=""){if(cond){pass++;return}fail++;failures.push({name,detail})}
const renderer=fs.readFileSync("assets/plan-v270-renderer.js","utf8");
const home=fs.readFileSync("index.html","utf8");
const preview=fs.readFileSync("analysis.html","utf8");
const plan=fs.readFileSync("plan.html","utf8");
const contact=fs.readFileSync("contact.html","utf8");
const css=fs.readFileSync("assets/plan-v250.css","utf8");

const approved=[
  "Fly Considerably Better",
  "Make the Airport Part of the Experience",
  "Let the Same Spending Pay for More of Your Travel",
  "Stay Considerably Better"
];
for(const x of approved)ok("results includes approved outcome: "+x,renderer.includes(x));
ok("results uses exactly four outcome cards",(renderer.match(/lifeCard\(/g)||[]).length===5,
  "expected one function declaration plus four rendered lifeCard calls");
ok("results removes old fifth-outcome framing",!renderer.includes("Be Looked After Better")&&!renderer.includes("Make the Journey Easier"));
ok("results leads with Your New Travel Life",renderer.includes("<h1>Your New Travel Life.</h1>"));
ok("results calls economics a check",renderer.includes("<h2>Economics Check</h2>")&&!renderer.includes("Your Estimated Annual Impact"));
ok("90-day plan is last in nav",renderer.indexOf("['plan90','◫','90-Day Plan']")>renderer.indexOf("['same','↺','What Stays the Same']"));
ok("90-day plan renders after what stays the same",renderer.lastIndexOf("renderTimeline(phases,plan)")>renderer.indexOf('id="same"'));
ok("four-outcome desktop grid",css.includes("repeat(4,minmax(0,1fr))"));
ok("results page title aligned",plan.includes("<title>Your New Travel Life — Quiet Premium</title>"));
ok("homepage journey starts with preview",home.includes("<h2>60-Second Preview</h2>"));
ok("homepage journey names product outcome",home.includes("<h2>Your New Travel Life</h2>"));
ok("homepage uses approved four-outcome story",[
  "Fly considerably better",
  "Make the airport part of the experience",
  "Let the same spending pay for more travel",
  "Stay considerably better"
].every(x=>home.includes(x)));
ok("homepage removes older five-outcome story",!home.includes("Be looked after better")&&!home.includes("Make the journey easier"));
ok("preview proof names new travel life",preview.includes("<b>New Travel Life</b>"));
ok("preview proof shows four travel outcomes",["Better flights","Better airport days","More travel","Better stays"].every(x=>preview.includes('<div class="mini-row">'+x+"</div>")));
ok("contact avoids purchase-style commitment language",!contact.includes("before committing")&&!contact.includes("Quiet Premium Full Analysis is right"));
console.log(JSON.stringify({pass,fail,failures},null,2));
if(fail)process.exitCode=1;
