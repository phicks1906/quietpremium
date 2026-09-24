const fs=require("fs");
let pass=0,fail=0;const failures=[];
function ok(name,cond,detail=""){if(cond){pass++;return}fail++;failures.push({name,detail})}
const home=fs.readFileSync("index.html","utf8");
const preview=fs.readFileSync("analysis.html","utf8");
ok("desktop nav enters 60-second preview",/<a class="navcta" href="analysis\.html"[^>]*>60-Second Preview<\/a>/.test(home));
ok("mobile nav enters 60-second preview",/<a class="mobile-cta" href="analysis\.html"[^>]*>60-Second Preview<\/a>/.test(home));
ok("hero primary enters preview",/<a class="btn primary" href="analysis\.html"[^>]*>See My 60-Second Preview<\/a>/.test(home));
ok("closing primary enters preview",/<section class="closing"[\s\S]*?<a class="btn primary" href="analysis\.html"[^>]*>See My 60-Second Preview<\/a>/.test(home));
ok("hero makes 60-second commitment explicit",home.includes("5 quick questions · About 60 seconds · No card numbers"));
ok("homepage primary funnel does not bypass preview",!/<a[^>]+class="(?:navcta|mobile-cta|btn primary)"[^>]+href="refine\.html"/.test(home));
ok("preview still hands off to full analysis",/id="fullAnalysis" href="refine\.html\?from=quick"/.test(preview));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;