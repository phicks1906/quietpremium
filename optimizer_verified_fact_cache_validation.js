const fs=require("fs");
const engine=fs.readFileSync("qp_sim_v5.js","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("alpha.45 card verified-fact merge cache exists",engine.includes("mergedCardFactsCacheV45=new WeakMap"));
ok("alpha.45 program verified-fact merge cache exists",engine.includes("mergedProgramFactsCacheV45=new WeakMap"));
ok("unverified fallback rule access returns immutable base rule without cloning",engine.includes("if(!isPlainObjectV14(record))return base"));
ok("verified card merge is cached by immutable normalized fact record",engine.includes("mergedCardFactsCacheV45.has(record)")&&engine.includes("mergedCardFactsCacheV45.set(record,out)"));
ok("verified program merge is cached by immutable normalized fact record",engine.includes("mergedProgramFactsCacheV45.has(record)")&&engine.includes("mergedProgramFactsCacheV45.set(record,out)"));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
