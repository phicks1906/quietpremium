const fs=require("fs");
const path=require("path");
let pass=0,fail=0;const failures=[];
function ok(name,cond,detail=""){if(cond){pass++;return}fail++;failures.push({name,detail})}
function read(p){return fs.readFileSync(p,"utf8")}
function noindex(p){return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(read(p))}
const live=["index.html","analysis.html","refine.html","diagnostic.html","plan.html","contact.html","founding-feedback.html"];
const redirects=["architecture.html","Contact","feedback.html","plan-book-v240.html","plan-v240-preview.html"];

for(const p of ["plan.html","refine.html","diagnostic.html","founding-feedback.html"])ok(p+" is noindex",noindex(p));
for(const p of redirects)ok(p+" redirect is noindex",noindex(p));

for(const p of ["plan-book-v240.html","plan-v240-preview.html"]){
  const c=read(p);
  ok(p+" redirects to current demo",c.includes("plan.html?demo=1"));
  ok(p+" contains no legacy recommendation copy",!c.includes("Alex & Jordan")&&!c.includes("Platinum Medallion")&&!c.includes("Marriott Bonvoy Brilliant"));
}
ok("legacy feedback route redirects",read("feedback.html").includes("founding-feedback.html"));
ok("legacy architecture route redirects",read("architecture.html").includes("refine.html"));

const retired=[
  "qp_sim.js",
  "assets/plan-v240.css","assets/plan-v240-loader.js","assets/plan-v240-interactions.js",
  "assets/plan-v240-frag1.html","assets/plan-v240-frag2.html","assets/plan-v240-frag3.html","assets/plan-v240-frag4.html"
];
for(const p of retired)ok("retired asset absent: "+p,!fs.existsSync(p));
const diagnostic=read("diagnostic.html");
ok("diagnostic does not ship legacy engine",!diagnostic.includes('src="qp_sim.js"'));
ok("diagnostic does not ship unused jsPDF CDN",!diagnostic.includes("jspdf.umd.min.js"));

function localRefs(file){
  const c=read(file),refs=[];
  for(const re of [/(?:href|src)=["']([^"'#]+)["']/g,/fetch\(["']([^"']+)["']/g]){
    let m;while((m=re.exec(c)))refs.push(m[1]);
  }
  return refs.filter(x=>!/^https?:/i.test(x)&&!/^mailto:/i.test(x)&&!/^tel:/i.test(x)&&x!=="/")
    .map(x=>x.split(/[?#]/)[0]).filter(Boolean);
}
for(const file of live.concat(redirects)){
  for(const ref of localRefs(file)){
    const resolved=ref.startsWith("/")?ref.slice(1):path.normalize(path.join(path.dirname(file),ref));
    ok(file+" local ref exists: "+ref,fs.existsSync(resolved),resolved);
  }
}
const sitemap=read("sitemap.xml");
ok("sitemap excludes private result routes",!sitemap.includes("plan.html")&&!sitemap.includes("refine.html")&&!sitemap.includes("diagnostic.html"));
console.log(JSON.stringify({pass,fail,failures},null,2));
if(fail)process.exitCode=1;
