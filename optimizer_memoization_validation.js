const fs=require("fs");
const engine=fs.readFileSync("qp_sim_v5.js","utf8");
let pass=0,fail=0;const failures=[];function ok(n,c){if(c)pass++;else{fail++;failures.push(n)}}
ok("alpha.38 engine memoization cache exists",engine.includes("portfolioValueCacheV38=new WeakMap"));
ok("recurring benefit values are profile-portfolio memoized",engine.includes('cachedPortfolioValueV38(p,"recurring",portfolio'));
ok("annual bonuses are profile-portfolio-scenario memoized",engine.includes('cachedPortfolioValueV38(p,"annual_bonus",portfolio,scenario'));
ok("annual point certificates are profile-portfolio-scenario memoized",engine.includes('cachedPortfolioValueV38(p,"annual_point_certificate",portfolio,scenario'));
ok("recommendation credit is profile-portfolio memoized",engine.includes('cachedPortfolioValueV38(p,"recommendation_credit",portfolio'));
ok("card retention values are profile-portfolio-card-scenario memoized",engine.includes('cachedPortfolioValueV38(p,"retention:"+id,portfolio,scenario'));
console.log(JSON.stringify({pass,fail,failures},null,2));if(fail)process.exitCode=1;
