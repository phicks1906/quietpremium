const fs=require("fs");
const src=fs.readFileSync("supabase/functions/qp-verify-facts/critical-parsers.ts","utf8").replace(/export function /g,"function ");
const P=(new Function(src+"\nreturn {parseDeltaCardStatus,parseDeltaThresholds,parseUnitedThresholds,parseChaseReserveRewards,parseMarriottThresholds,parseMarriottCardCriticalFacts,criticalStructureIssues};"))();
let pass=0,fail=0;const failures=[];function ok(name,cond,detail=""){if(cond)pass++;else{fail++;failures.push({name,detail})}}
const ds="MQD Thresholds for Status SILVER GOLD PLATINUM DIAMOND $5,000 MQDs $10,000 MQDs $15,000 MQDs $28,000 MQDs Earn Medallion Qualification Dollars";
const dt=P.parseDeltaThresholds(ds);
ok("Delta four-tier ordered thresholds",JSON.stringify(dt.map(x=>x.amount))==="[5000,10000,15000,28000]",JSON.stringify(dt));
const dr="MQD Headstart With MQD Headstart, you can receive $2,500 Medallion Qualification Dollars each Medallion Qualification Year. MQD Boost Get $1 Medallion Qualification Dollar for each $10 in purchases on your Delta SkyMiles Reserve American Express Card";
ok("Delta Reserve Headstart parses 2500",P.parseDeltaCardStatus(dr,"delta_reserve").headstart===2500,JSON.stringify(P.parseDeltaCardStatus(dr,"delta_reserve")));
ok("Delta Reserve MQD Boost divisor parses 10",P.parseDeltaCardStatus(dr,"delta_reserve").spendDivisor===10,JSON.stringify(P.parseDeltaCardStatus(dr,"delta_reserve")));
const cr="8x points on all purchases through Chase Travel, including The Edit. 4x points on flights booked direct. 4x points on hotels booked direct. 3x points on dining worldwide. 1x points on all other purchases.";
const cp=P.parseChaseReserveRewards(cr);
ok("Reserve base spend remains 1x",cp?.earn?.general===1&&cp?.earn?.grocery===1&&cp?.earn?.gas_ev===1,JSON.stringify(cp));
ok("Reserve direct flight/hotel earn is 4x",cp?.earn?.airfare===4&&cp?.earn?.hotel===4,JSON.stringify(cp));
ok("Reserve Chase Travel earn is 8x",cp?.bookingEarn?.airfare?.chase_travel===8&&cp?.bookingEarn?.hotel?.chase_travel===8,JSON.stringify(cp));
const mr="10 nights per year Silver Elite 25 nights per year Gold Elite 50 nights per year Platinum Elite 75 nights per year Titanium Elite 100 nights per yr + $23,000 USD Ambassador Elite";
const mp=P.parseMarriottThresholds(mr);
ok("Marriott full five-tier ladder",JSON.stringify(mp.map(x=>x.nights))==="[10,25,50,75,100]",JSON.stringify(mp));
ok("Marriott Ambassador spend survives",mp[4]?.spend===23000,JSON.stringify(mp));
ok("Delta duplicate thresholds fail structure",P.criticalStructureIssues("airlines","delta",{thresholds:[{tier:"Silver Medallion",amount:5000},{tier:"Gold Medallion",amount:5000},{tier:"Platinum Medallion",amount:5000},{tier:"Diamond Medallion",amount:5000}]}).includes("thresholds.strictlyIncreasing"));
const united2026="United Premier Silver How to earn: 15 PQF and 5,000 PQP, or 6,000 PQP. United Premier Gold How to earn: 30 PQF and 10,000 PQP, or 12,000 PQP. United Premier Platinum How to earn: 45 PQF and 15,000 PQP, or 18,000 PQP. United Premier 1K How to earn: 60 PQF and 22,000 PQP, or 28,000 PQP.";
const ut=P.parseUnitedThresholds(united2026);
ok("United 2026 four-tier PQF/PQP ladder parses exactly",JSON.stringify(ut.map(x=>[x.pqf,x.pqpWithPQF,x.pqpOnly]))==="[[15,5000,6000],[30,10000,12000],[45,15000,18000],[60,22000,28000]]",JSON.stringify(ut));
ok("United zero/misaligned thresholds fail current-structure guard",P.criticalStructureIssues("airlines","united",{thresholds:[{tier:"Premier Silver",pqf:5,pqpWithPQF:5000,pqpOnly:0,amount:0},{tier:"Premier Gold",pqf:0,pqpWithPQF:10000,pqpOnly:0,amount:0},{tier:"Premier Platinum",pqf:5,pqpWithPQF:15000,pqpOnly:0,amount:0},{tier:"Premier 1K",pqf:0,pqpWithPQF:22000,pqpOnly:0,amount:0}],minimumUnitedSegments:4}).includes("thresholds.current2026Structure"));
ok("United current verifier requires four United-operated flights",P.criticalStructureIssues("airlines","united",{thresholds:ut,minimumUnitedSegments:3}).includes("minimumUnitedSegments.currentRequirement"));

ok("Marriott partial ladder fails structure",P.criticalStructureIssues("hotels","marriott",{thresholds:[{tier:"Ambassador Elite",nights:100,spend:23000}]}).includes("thresholds.completeLadder"));
ok("Reserve broad 4x false parse fails structure",P.criticalStructureIssues("cards","chase_reserve",{earn:{general:4,dining:3,airfare:8,hotel:8},bookingEarn:{airfare:{chase_travel:8},hotel:{chase_travel:8}}}).includes("earn.reserveCurrentStructure"));

const boundless="Free Night Award Enjoy a Free Night Award every year after your account anniversary, valid for a one-night stay with a redemption level up to 35,000 points.";
const bf=P.parseMarriottCardCriticalFacts(boundless,"marriott_boundless");
ok("Boundless 35K renewal award survives wording order",bf.annualPointCertificate?.capPoints===35000,JSON.stringify(bf));
const bountiful="Automatic Gold Elite Status Enjoy automatic Marriott Bonvoy Gold Elite status each calendar year.";
const bof=P.parseMarriottCardCriticalFacts(bountiful,"marriott_bountiful");
ok("Bountiful automatic Gold Elite parses",bof.automaticTier==="Gold Elite",JSON.stringify(bof));
const brilliant="Marriott Bonvoy Brilliant Free Night Award Receive 1 Free Night Award every year after your Card renewal month. Award can be used for one night redemption level at or under 85,000 Marriott Bonvoy points. Brilliant Earned Choice Award Each calendar year after spending $60,000 on eligible purchases on your Marriott Bonvoy Brilliant Card, you will be eligible to select a Brilliant Earned Choice Award benefit. Free Night Award has a redemption value of up to 85K points. Fee Credit for Global Entry or TSA PreCheck Receive either a $120 statement credit for Global Entry or up to $85 for TSA PreCheck. Only one credit will be given in a 4 year period.";
const br=P.parseMarriottCardCriticalFacts(brilliant,"marriott_brilliant");
ok("Brilliant 85K renewal award parses",br.annualPointCertificate?.capPoints===85000,JSON.stringify(br));
ok("Brilliant trusted-traveler 120 every four years parses",br.trustedTraveler?.amount===120&&br.trustedTraveler?.years===4,JSON.stringify(br));
ok("Brilliant 60K choice threshold parses",br.spendReward?.amount===60000&&br.spendReward?.valuePoints===85000,JSON.stringify(br));

const verifierSrc=fs.readFileSync("supabase/functions/qp-verify-facts/index.ts","utf8");
ok("Delta cards bypass generic nearby-dollar credit inference",verifierSrc.includes('id.startsWith("marriott_")||id.startsWith("delta_")?{}:{...credits(t)}'));

const sourceDefs=fs.readFileSync("supabase/functions/qp-verify-facts/sources.ts","utf8");
ok("Amex Gold verifier uses stable first-party fee evidence",sourceDefs.includes("gold-card-annual-fee/index.shtml"));
ok("Amex Gold verifier uses stable first-party earn evidence",sourceDefs.includes("/gold/earn-rewards"));
ok("Amex Gold verifier uses stable first-party benefit evidence",sourceDefs.includes("/gold/explore-benefits"));

const verifierSources=fs.readFileSync("supabase/functions/qp-verify-facts/sources.ts","utf8");
ok("Venture uses compact first-party trusted-traveler terms source",verifierSources.includes("venture: { urls: ['https://www.capitalone.com/credit-cards/venture/','https://www.capitalone.com/help-center/credit-cards/tsa-precheck-global-entry-benefits/'"));
ok("Venture X shares first-party trusted-traveler terms source",verifierSources.includes("venture_x: { urls: ['https://www.capitalone.com/credit-cards/venture-x/','https://www.capitalone.com/help-center/credit-cards/tsa-precheck-global-entry-benefits/'"));


ok("Hyatt card source uses current Chase product URL",verifierSources.includes("world-of-hyatt-credit-card"));
ok("United verifier retains official sources and adds current secondary fallback",verifierSources.includes("unitedperksplus.united.com/chart.aspx")&&verifierSources.includes("nerdwallet.com/travel/learn/guide-to-united-airlines-premier-elite-status"));
ok("Hyatt verifier retains official sources and adds current fallback coverage",verifierSources.includes("world.hyatt.com/content/gp/en/tiers-and-benefits.html")&&verifierSources.includes("nerdwallet.com/travel/learn/complete-guide-to-hyatt-elite-status")&&verifierSources.includes("thepointsguy.com/loyalty-programs/hyatt-milestone-reward"));
ok("Hyatt card parser recognizes current Bonus Points wording",verifierSrc.includes('if(id==="hyatt_consumer")')&&verifierSrc.includes('(?:Bonus\\s+)?Points?'));
ok("United parser uses exact current How-to-earn qualification wording",src.includes('How to earn:?\\\\s*([\\\\d,]+)\\\\s+PQF'));
ok("United parser accepts minimum four flights wording",verifierSrc.includes('minimum of\\s+four'));
ok("United Explorer parser recognizes two Club passes",verifierSrc.includes('id==="united_explorer"')&&verifierSrc.includes('one-time passes'));
ok("United Silver coverage accepts current tier-summary wording",verifierSrc.includes("silverSummary=")&&verifierSrc.includes("Economy Plus at check-in"));
ok("United Platinum coverage accepts current tier-summary wording",verifierSrc.includes("platinumSummary=")&&verifierSrc.includes("40 PlusPoints"));


console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
