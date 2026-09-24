const fs=require("fs");
const build=fs.readFileSync("supabase/functions/qp-build-plan/index.ts","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("final verification reuses stage-one facts",build.includes('verifyRequest(target,"final_"+pass,finalSnapshot||stage1Snapshot)'));
ok("only complete verified records are reusable",build.includes('rec?.verificationStatus==="verified"&&rec?.complete===true'));
ok("only missing entities are sent to verifier",build.includes("missingVerifiedEntities(request,baseSnapshot)")&&build.includes("chunkEntityRequest(missing,12)"));
ok("merged snapshots retain all verified records",build.includes("mergeSnapshotParts(parts,snapshotId,verifiedAt)"));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
