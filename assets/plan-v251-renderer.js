(()=>{
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const list=v=>Array.isArray(v)?v:[];
const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(v)||0);
const title=v=>String(v||"").replace(/[_-]+/g," ").replace(/\b\w/g,m=>m.toUpperCase()).trim()||"—";
const labelMap={amex_mr:"American Express Membership Rewards",chase_ur:"Chase Ultimate Rewards",capital_one_miles:"Capital One Miles",delta:"Delta Air Lines",united:"United Airlines",american:"American Airlines",southwest:"Southwest Airlines",marriott:"Marriott Bonvoy",hyatt:"World of Hyatt",hilton:"Hilton Honors"};
const label=v=>labelMap[v]||title(v);
const categoryLabels={dining:"Dining",grocery:"Groceries",online_grocery:"Online groceries",drugstore:"Drugstores",gas_ev:"Gas & EV charging",transit:"Transit",online_retail:"Online retail",vacation_home:"Vacation rentals",airfare:"Airfare",hotel:"Hotels",general:"Everything else"};
const benefitLabels={southwest_chase_travel_credit_500:"$500 Southwest Chase Travel credit",hyatt_explorist_status_threshold:"World of Hyatt Explorist status",ihg_diamond_status_threshold:"IHG One Rewards Diamond Elite status",southwest_alist_status_threshold:"Southwest Rapid Rewards A-List status",shops_at_chase_credit_250:"$250 Shops at Chase credit",free_night_reward_15k:"Annual free-night reward",free_night_award_35k:"35,000-point free-night award",free_night_award_85k:"85,000-point free-night award",companion_certificate_renewal:"Annual companion certificate",companion_pass_boost:"Companion Pass qualifying-points boost"};
const categoryLabel=v=>categoryLabels[v]||title(v);
const benefitLabel=x=>benefitLabels[x?.benefit||x?.type||x?.purpose]||title(x?.benefit||x?.type||x?.purpose||"Travel benefit");

function cardDescriptor(x){
  const bits=[];
  if(x.action)bits.push(title(x.action));
  if(x.role)bits.push(title(x.role));
  if(Number(x.routineAnnualSpend)>0)bits.push(money(x.routineAnnualSpend)+" routed annually");
  if(x.classification==="recommended")bits.push("Recommended");
  if(x.classification==="consider")bits.push("Consider");
  return bits.join(" · ")||"Part of the recommended structure";
}
function cardLine(x){
  return x?'<div class="item"><strong>'+esc(x.label||x.cardId)+'</strong><span>'+esc(cardDescriptor(x))+'</span></div>':'';
}
function empty(text){return '<div class="empty">'+esc(text)+'</div>'}
function outcomeCopy(kind,d){
  if(kind==="fly"){
    if(!d?.primaryAirline)return "Stay itinerary-first rather than forcing loyalty where it does not improve the trip.";
    const airline=label(d.primaryAirline),mode=d?.relationshipMode||"";
    if(mode==="primary_with_exceptions")return airline+" is strong enough to anchor the relationship; use another airline only when the itinerary is clearly better.";
    if(mode==="existing_relationship_route_unverified")return airline+" remains your current relationship, but Quiet Premium is not asking you to concentrate further until route fit is verified.";
    if(mode==="existing_relationship_route_weak")return airline+" remains part of your current travel pattern, but your route fit does not support deeper concentration.";
    return "Keep "+airline+" as a preference, while choosing the best practical itinerary trip by trip.";
  }
  if(kind==="airport"){
    const c=d?.capabilities||{},n=Object.values(c).filter(v=>Number(v)>0).length;
    return n?("Your recommended setup preserves "+n+" airport benefit "+(n===1?"that makes the journey easier.":"that make the journey easier.")):"No additional airport benefit is being added just for the sake of complexity.";
  }
  if(kind==="travel"){
    const v=Number(d?.annualTravelValue||d?.value||0);
    return v>0?("The same spending produces about "+money(v)+" of modeled annual travel capacity before any first-year offer."):"Your selected rewards ecosystem keeps routine spending working toward more usable travel.";
  }
  if(kind==="hotel"){
    if(!d?.primaryHotel)return "Stay flexible by trip and use premium-booking benefits only when they improve the property experience.";
    return label(d.primaryHotel)+(d?.status?.selectedTarget?(" can support "+d.status.selectedTarget+" without making status the goal."):" is the best-fit hotel relationship without forcing a status chase.");
  }
  return "";
}
function conciergeCopy(items){
  const hit=list(items).some(x=>/concierge|service assistance|premium service|travel assistance/i.test(JSON.stringify(x||{})));
  return hit
    ?"Your verified plan includes a concierge or service capability you can call on when something needs handling."
    :"No new concierge or service-assistance capability is being added to this recommendation.";
}
function actionDetail(a){
  const bits=[];
  if(a.annualAmount)bits.push(money(a.annualAmount)+" routed annually");
  if(a.explanation)bits.push(a.explanation);
  else if(a.annualSpendRequired)bits.push(money(a.annualSpendRequired)+" annual threshold");
  if(a.currentYearSpendRemaining!=null&&a.type==="recurring_threshold")bits.push(money(a.currentYearSpendRemaining)+" remaining this year");
  if(a.spendRequired)bits.push(money(a.spendRequired)+" required");
  if(a.stopCondition?.tier)bits.push("stop at "+title(a.stopCondition.tier));
  if(a.stopCondition?.amount)bits.push("stop at "+money(a.stopCondition.amount));
  if(a.reason)bits.push(title(a.reason));
  return bits.join(" · ");
}
function actionsHtml(phase){
  return list(phase.actions).map(a=>'<label class="action"><input type="checkbox" data-action-id="'+esc(a.id)+'"><span><b>'+esc(a.title)+'</b>'+(actionDetail(a)?'<small>'+esc(actionDetail(a))+'</small>':'')+'</span></label>').join("");
}
function statusHtml(s){
  const rows=list(s?.ladder);
  return rows.length?'<div class="ladder">'+rows.map(r=>'<div class="tier '+(r.selected?"selected":"")+'"><div><b>'+esc(r.tier||"—")+'</b></div><div class="badge">'+(r.selected?"Selected":r.reachable===true?"Reachable":"")+'</div><div>'+esc(r.stopReason?title(r.stopReason):"")+'</div></div>').join("")+'</div>':empty("No status ladder is required for this strategy.");
}
function spendRows(routing){
  const rows=[];
  for(const [category,items] of Object.entries(routing||{})){
    for(const item of list(items)){
      if(item?.card&&Number(item.amount)>0)rows.push({category,card:item.card,amount:item.amount,purpose:item.purpose||""});
    }
  }
  return rows;
}
function benefitCards(items){
  const seen=new Set(),out=[];
  for(const x of list(items)){
    const k=JSON.stringify([x?.cardId,x?.benefit,x?.type,x?.purpose]);
    if(seen.has(k))continue;
    seen.add(k);out.push(x);
  }
  return out.length?out.map(x=>'<div class="panel benefit"><strong>'+esc(benefitLabel(x))+'</strong><span>'+esc(x?.label||x?.cardId||x?.detail||"Recognized in the travel plan; not assigned an invented dollar value.")+'</span></div>').join(""):empty("No additional qualitative travel benefits need separate treatment.");
}
function lifeCard(img,icon,h,p){return '<article class="life-card"><img src="'+img+'" alt=""><div class="pad"><div class="icon">'+icon+'</div><h3>'+esc(h)+'</h3><p>'+esc(p)+'</p></div></article>'}
function strategyCard(k,v,n){return '<div class="strategy-card"><label>'+esc(k)+'</label><strong>'+esc(v)+'</strong><span>'+esc(n)+'</span></div>'}
function countCard(cls,n,h,p){return '<div class="count-card '+cls+'"><div class="n">'+n+'</div><strong>'+esc(h)+'</strong><span>'+esc(p)+'</span></div>'}
function signedMoney(v){const n=Number(v)||0;return (n>=0?"+":"−")+money(Math.abs(n))}
function feeChange(e){const save=Number(e.annualFeeSavings)||0,inc=Number(e.annualFeeIncrease)||0;if(save>0)return "−"+money(save);if(inc>0)return "+"+money(inc);return money(0)}
function cardList(h,items,none){return '<div class="panel list-card"><h3>'+esc(h)+'</h3>'+(list(items).length?list(items).map(cardLine).join(""):empty(none))+'</div>'}
function renderTimeline(phases,plan){
  return '<section class="section panel timeline-wrap" id="plan90" data-section="plan90"><div class="timeline-title"><div><div class="eyebrow" style="color:#9b6a25">Your 90-Day Plan</div><h2>'+esc(plan?.principle||"Make the changes. Then let them work.")+'</h2></div><p>A clear implementation path generated from the actual recommendation. No threshold or card action appears here unless the engine produced it.</p></div><div class="timeline">'+
  (phases.length?phases.map((p,i)=>'<div class="phase"><div class="phase-num">'+(i+1)+'</div><div class="phase-grid"><div class="phase-intro"><h3>'+esc(p.days)+'</h3><p><b>'+esc(p.title)+'</b><br>'+esc(p.objective||"")+'</p></div><div class="action-list">'+actionsHtml(p)+'</div><div class="success"><strong>By '+esc(p.days.replace("Days ","Day ").split("–").pop().trim())+'</strong><p>'+esc(p.successState||"")+'</p></div></div></div>').join(""):empty("No 90-day implementation plan is available."))+
  '</div><div class="day90"><div class="checkmark">✓</div><div><strong>Day 90 — '+esc(plan?.day90?.title||"Your system is running.")+'</strong><span>'+esc(plan?.day90?.summary||"")+'</span></div></div></section>';
}
function qualityHtml(q,meta){
  const a=list(q?.assumptions),u=list(q?.unresolvedFacts),issues=list(q?.engineIssues);
  return '<details open><summary>Analysis identity</summary><p>Facts snapshot: '+esc(meta?.factsSnapshotId||"—")+'<br>Valuation snapshot: '+esc(meta?.valuationSnapshotId||"—")+'<br>Rules as of: '+esc(meta?.rulesAsOf||"—")+'</p></details>'+
  '<details><summary>Assumptions</summary>'+(a.length?'<ul>'+a.map(x=>'<li>'+esc(typeof x==="string"?x:JSON.stringify(x))+'</li>').join("")+'</ul>':'<p>No additional assumptions were surfaced.</p>')+'</details>'+
  '<details><summary>Unresolved facts</summary>'+(u.length?'<ul>'+u.map(x=>'<li>'+esc(typeof x==="string"?x:JSON.stringify(x))+'</li>').join("")+'</ul>':'<p>No unresolved decision-critical fact is being carried into this ready result.</p>')+'</details>'+
  (issues.length?'<details><summary>Engine notes</summary><ul>'+issues.map(x=>'<li>'+esc(typeof x==="string"?x:JSON.stringify(x))+'</li>').join("")+'</ul></details>':'');
}
function render(data,{demo=false}={}){
  const root=$("#qp-plan-root");if(!root)return;
  const c=data||{},cards=c.cards||{},eco=c.economics||{},tl=c.newTravelLife||{},status=c.status||{},plan=c.implementationPlan||{};
  const counts={keep:list(cards.keep).length+list(cards.keepButStopRoutineSpend).length,add:list(cards.recommendedNew).length,consider:list(cards.consider).length,remove:list(cards.removeOrDowngrade).length+list(cards.manualReviewBeforeRemoval).length};
  const spend=spendRows(c.spendPlan?.ongoingRouting);
  const phases=list(plan.phases);
  const benefits=[...list(c.benefits?.highlightedTravelOutcomes),...list(c.benefits?.additionalQualitativeBenefits)];
  root.innerHTML=(demo?'<div class="demo-banner">PREVIEW MODE · sample qp-results-v1 contract · not a customer recommendation</div>':'')+
  '<div class="app">'+
  '<aside class="rail"><div class="brand">Quiet Premium<small>Personal Travel Strategy</small></div><nav class="nav">'+
  [['overview','⌂','Overview'],['travel-life','✦','Your Travel Life'],['airline','✈','Airline Strategy'],['hotel','▰','Hotel Strategy'],['cards','▣','Card Portfolio'],['spend','⌘','Spend Plan'],['plan90','◫','90-Day Plan'],['benefits','◇','Travel Benefits'],['consider','☆','Consider Cards'],['same','↺','What Stays the Same']].map(x=>'<a href="#'+x[0]+'" data-nav="'+x[0]+'"><i>'+x[1]+'</i>'+x[2]+'</a>').join("")+
  '</nav><div class="rail-quote">A more extraordinary tomorrow<br>with the spend you already have.</div></aside>'+
  '<main class="main"><header class="topbar"><button class="mobile-menu" aria-label="Open navigation">☰</button><div class="wordmark">Quiet Premium</div><div class="meta">Your Travel Strategy</div></header>'+
  '<section class="hero" id="overview" data-section="overview"><div class="hero-inner"><div class="eyebrow">Same spend. A brighter tomorrow.</div><h1>Your Travel Strategy.</h1><p>Your existing spending can do more. This strategy turns what you already spend into a materially better travel life — more extraordinary stays, better flights, easier journeys and more of the world, without spending more.</p></div><div class="hero-quote">“A better way<br>to travel.”</div></section>'+
  '<div class="content">'+
  '<section class="section" id="travel-life" data-section="travel-life"><div class="section-head"><div><h2>Your Strategy Delivers</h2><p>Five lived outcomes first. Cards, status and points are the mechanisms underneath.</p></div></div><div class="life-grid">'+
  lifeCard("/band-air.jpeg","✈","Fly Considerably Better",outcomeCopy("fly",tl.flyBetter))+
  lifeCard("/band-hotel.jpeg","▰","Stay Considerably Better",outcomeCopy("hotel",tl.stayBetter))+
  lifeCard("/hero3.jpeg","◇","Be Looked After Better",conciergeCopy(benefits))+
  lifeCard("/assets/qp-outcome-v210.jpg","☀","Travel More",outcomeCopy("travel",tl.travelCapacity))+
  lifeCard("/band-lounge.jpeg","⌁","Make the Journey Easier",outcomeCopy("airport",tl.airportExperience))+
  '</div></section>'+
  '<section class="section"><div class="strategy-impact"><div class="panel strategy"><h2>Your Recommended Strategy</h2><div class="sub">A focused plan built around your actual travel life.</div><div class="strategy-cards">'+
  strategyCard("Primary airline",c.strategy?.airline?.primary?label(c.strategy.airline.primary):"No forced concentration",status.airline?.stoppingPoint?"Stop at "+status.airline.stoppingPoint:"Use the best practical airline fit")+
  strategyCard("Primary hotel strategy",c.strategy?.hotel?.primary?label(c.strategy.hotel.primary):"Flexible by trip",status.hotel?.selectedTarget||"No status target required")+
  strategyCard("Primary transferable ecosystem",label(c.strategy?.primaryTransferableEcosystem),"One flexible-rewards ecosystem for ongoing controllable spend")+
  '</div></div><div class="panel impact"><h2>Your Estimated Annual Impact</h2><div class="big">'+signedMoney(eco.defensibleCurrentVsRecommendedDelta)+'</div><div class="caption">Defensible recurring improvement versus the current modeled state</div><div class="impact-row"><span>Current net economic value</span><b>'+money(eco.currentNetEconomicValue)+'</b></div><div class="impact-row"><span>Recommended net economic value</span><b>'+money(eco.recommendedNetEconomicValue)+'</b></div><div class="impact-row"><span>Annual fee change</span><b>'+feeChange(eco)+'</b></div></div></div>'+
  '<div class="card-counts">'+countCard("keep",counts.keep,"Keep","Continue holding these cards")+countCard("add",counts.add,"Recommended","New cards strong enough to recommend")+countCard("consider",counts.consider,"Consider","Optional close calls, never required")+countCard("remove",counts.remove,"Remove / Review","Reduce overlap or resolve before removal")+'</div></section>'+
  renderTimeline(phases,plan)+
  '<section class="section" id="airline" data-section="airline"><div class="section-head"><div><h2>Your Airline Strategy</h2><p>The correct relationship first; status only if it improves the travel outcome without destroying better spend opportunities.</p></div></div><div class="panel detail-card"><h3>'+esc(c.strategy?.airline?.primary?label(c.strategy.airline.primary):"No primary airline concentration")+'</h3><div class="kv"><span>Natural outcome</span><b>'+esc(status.airline?.naturalOutcome||"No status assumed")+'</b></div><div class="kv"><span>Selected stopping point</span><b>'+esc(status.airline?.stoppingPoint||"No status target")+'</b></div><div class="kv"><span>Intervention required</span><b>'+(status.airline?.interventionRequired?"Yes":"No")+'</b></div>'+statusHtml(status.airline)+'</div></section>'+
  '<section class="section" id="hotel" data-section="hotel"><div class="section-head"><div><h2>Your Hotel Strategy</h2><p>Concentrate only when the relationship and resulting treatment justify it.</p></div></div><div class="panel detail-card"><h3>'+esc(c.strategy?.hotel?.primary?label(c.strategy.hotel.primary):"Flexible hotel strategy")+'</h3><div class="kv"><span>Natural outcome</span><b>'+esc(status.hotel?.naturalOutcome||"No status assumed")+'</b></div><div class="kv"><span>Selected target</span><b>'+esc(status.hotel?.selectedTarget||"No hotel-status target")+'</b></div><div class="kv"><span>Intervention required</span><b>'+(status.hotel?.interventionRequired?"Yes":"No")+'</b></div></div></section>'+
  '<section class="section" id="cards" data-section="cards"><div class="section-head"><div><h2>Your Card Portfolio</h2><p>Every retained paid card needs a real job. Consider cards remain outside the core strategy.</p></div></div><div class="card-lists">'+
  cardList("Keep",cards.keep,"No card needs to be kept for routine use.")+
  cardList("Keep — stop routine spend",cards.keepButStopRoutineSpend,"No retained card needs this treatment.")+
  cardList("Recommended new cards",cards.recommendedNew,"No new card cleared the Recommended standard.")+
  cardList("Remove / downgrade / review",[...list(cards.removeOrDowngrade),...list(cards.manualReviewBeforeRemoval)],"No existing card needs removal or manual review.")+
  '</div></section>'+
  '<section class="section" id="spend" data-section="spend"><div class="section-head"><div><h2>Your Spending Plan</h2><p>Exact ongoing routing after strategy, status and card roles are settled.</p></div></div><div class="panel spend-table">'+
  '<div class="sp-row head"><span>Category</span><span>Destination</span><b>Annual amount</b></div>'+
  (spend.length?spend.map(r=>'<div class="sp-row"><span>'+esc(categoryLabel(r.category))+(r.purpose?' · '+esc(benefitLabels[r.purpose]||title(r.purpose)):'')+'</span><span>'+esc(label(r.card))+'</span><b>'+money(r.amount)+'</b></div>').join(""):empty("No ongoing routing change is required."))+
  '</div></section>'+
  '<section class="section" id="benefits" data-section="benefits"><div class="section-head"><div><h2>Travel Benefits</h2><p>Useful in-scope benefits that support the travel life; qualitative benefits stay qualitative when no defensible dollar method exists.</p></div></div><div class="benefit-grid">'+benefitCards(benefits)+'</div></section>'+
  '<section class="section" id="consider" data-section="consider"><div class="section-head"><div><h2>Cards to Consider</h2><p>Economically meaningful close calls. Your prescribed strategy does not depend on accepting any of them.</p></div></div><div class="panel list-card">'+(list(cards.consider).length?list(cards.consider).map(cardLine).join(""):empty("No card falls into the Consider range for this plan."))+'</div></section>'+
  '<section class="section" id="same" data-section="same"><div class="section-head"><div><h2>What Stays the Same</h2><p>Quiet Premium does not force change for its own sake.</p></div></div><div class="detail-grid"><div class="panel list-card"><h3>Retained cards</h3>'+
  ((list(cards.keep).length||list(cards.keepButStopRoutineSpend).length)?[...list(cards.keep),...list(cards.keepButStopRoutineSpend)].map(cardLine).join(""):empty("No retained-card conclusion is needed."))+
  '</div><div class="panel quality"><h3 style="font:400 20px var(--serif);margin:0 0 8px">Assumptions & limits</h3>'+qualityHtml(c.quality,c.meta)+'</div></div></section>'+
  '</div></main></div>';
  document.dispatchEvent(new CustomEvent("qp-plan-rendered",{detail:{data:c,demo}}));
}
function renderError(message){
  const root=$("#qp-plan-root");
  if(root)root.innerHTML='<div class="qp-error"><div class="qp-mark">Q</div><div><strong>Your plan is not ready yet.</strong><span>'+esc(message||"A complete qp-results-v1 result is required before Quiet Premium can show a recommendation.")+'</span></div></div>';
}
window.QPPlanRenderer={render,renderError};
})();