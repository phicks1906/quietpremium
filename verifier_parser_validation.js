const fs=require("fs");
const src=fs.readFileSync("supabase/functions/qp-verify-facts/parse-primitives.ts","utf8").replace(/export function /g,"function ");
const P=(new Function(src+"\nreturn {feeFromText,rateNear};"))();
let pass=0,fail=0;const failures=[];
function ok(name,cond,detail=""){if(cond)pass++;else{fail++;failures.push({name,detail})}}
ok("paid fee beats later no-fee cross-sell",P.feeFromText("Annual Fee $325. Other card has No Annual Fee.")===325);
ok("no-fee product remains zero",P.feeFromText("No Annual Fee. Earn 3X dining.")===0);
ok("Green embedded fee parses",P.feeFromText("Annual Fee value $150 sort 1")===150);
ok("intro fee returns ongoing fee",P.feeFromText("$0 introductory annual fee, then $95 annual fee")===95);
const chase="5x points on Chase Travel. 3x points on dining. 3x points on gas stations, EV charging, and vacation homes. 2x points on all other travel. 1x points on all other purchases.";
ok("nearest rate finds dining 3x",P.rateNear(chase,[/dining/i])===3,String(P.rateNear(chase,[/dining/i])));
ok("nearest rate finds vacation homes 3x",P.rateNear(chase,[/vacation homes?/i])===3,String(P.rateNear(chase,[/vacation homes?/i])));
ok("nearest rate finds travel 2x",P.rateNear(chase,[/all other travel/i])===2,String(P.rateNear(chase,[/all other travel/i])));
ok("nearest rate finds base 1x",P.rateNear(chase,[/all other purchases/i])===1,String(P.rateNear(chase,[/all other purchases/i])));
const vx="10X miles on hotels through Capital One Travel. 5X miles on flights and vacation rentals through Capital One Travel. 2X miles on every purchase.";
ok("Venture X hotel 10x",P.rateNear(vx,[/hotels[^.]{0,80}Capital One Travel/i])===10);
ok("Venture X flights 5x",P.rateNear(vx,[/flights[^.]{0,80}Capital One Travel/i])===5,String(P.rateNear(vx,[/flights[^.]{0,80}Capital One Travel/i])));
ok("Venture X base 2x",P.rateNear(vx,[/every purchase/i])===2,String(P.rateNear(vx,[/every purchase/i])));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
