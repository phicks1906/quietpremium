(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.QPDiagnosticV5=api;
  if(typeof document!=="undefined")api.bind();
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";

const QP_SUPABASE_URL="https://jdtbyudbwmwldrkjaznk.supabase.co";
const QP_SUPABASE_KEY="sb_publishable_BETG0zmWAEmPByBsKyEUzA_yPCOkh5F";
const PLAN_FUNCTION="qp-build-plan";
const PLAN_STORAGE_KEY="qp-results-v1";
const FUNNEL_SESSION_KEY="qp_funnel_session_v1";
const BUILD="phase4c_v1";

const CARD_ALIASES=Object.freeze({
  amex_green:["american express green card","amex green","american express green"],
  amex_gold:["american express gold card","american express gold","amex gold"],
  amex_platinum:["the platinum card from american express","american express platinum","amex platinum","platinum card from american express"],
  chase_preferred:["chase sapphire preferred","sapphire preferred"],
  chase_freedom_unlimited:["chase freedom unlimited","freedom unlimited"],
  chase_freedom_flex:["chase freedom flex","freedom flex"],
  chase_freedom_rise:["chase freedom rise","freedom rise"],
  chase_reserve:["chase sapphire reserve","sapphire reserve"],
  venture_one:["capital one ventureone rewards","capital one ventureone","ventureone"],
  venture:["capital one venture rewards","capital one venture","venture rewards"],
  venture_x:["capital one venture x rewards","capital one venture x","venture x"],
  delta_blue:["delta skymiles blue american express card","delta skymiles blue","delta blue"],
  delta_gold:["delta skymiles gold american express card","delta skymiles gold","delta gold"],
  delta_platinum:["delta skymiles platinum american express card","delta skymiles platinum","delta platinum"],
  delta_reserve:["delta skymiles reserve american express card","delta skymiles reserve","delta reserve"],
  united_gateway:["united gateway card","united gateway"],
  united_explorer:["united explorer card","united explorer"],
  united_quest:["united quest card","united quest"],
  united_club:["united club card","united club infinite","united club"],
  aa_mileup:["american airlines aadvantage mileup card","aadvantage mileup","aa mileup"],
  aa_platinum_select:["citi / aadvantage platinum select world elite mastercard","citi aadvantage platinum select","aadvantage platinum select"],
  aa_executive:["citi / aadvantage executive world legend mastercard","citi aadvantage executive","aadvantage executive"],
  aa_globe:["citi / aadvantage globe mastercard","citi aadvantage globe","aadvantage globe"],
  southwest_plus:["southwest rapid rewards plus credit card","southwest plus"],
  southwest_premier:["southwest rapid rewards premier credit card","southwest premier"],
  southwest_priority:["southwest rapid rewards priority credit card","southwest priority"],
  hyatt_consumer:["world of hyatt credit card","hyatt credit card"],
  marriott_bold:["marriott bonvoy bold credit card","marriott bold"],
  marriott_boundless:["marriott bonvoy boundless credit card","marriott boundless"],
  marriott_bountiful:["marriott bonvoy bountiful credit card","marriott bountiful"],
  marriott_bevy:["marriott bonvoy bevy american express card","marriott bevy"],
  marriott_brilliant:["marriott bonvoy brilliant american express card","marriott brilliant"],
  hilton_no_fee:["hilton honors american express card","hilton honors amex","hilton no fee"],
  hilton_surpass:["hilton honors american express surpass card","hilton surpass"],
  hilton_aspire:["hilton honors american express aspire card","hilton aspire"]
});

const CARD_LABELS=Object.freeze({
  amex_green:"American Express Green Card",amex_gold:"American Express Gold Card",amex_platinum:"The Platinum Card from American Express",
  chase_preferred:"Chase Sapphire Preferred",chase_freedom_unlimited:"Chase Freedom Unlimited",chase_freedom_flex:"Chase Freedom Flex",chase_freedom_rise:"Chase Freedom Rise",chase_reserve:"Chase Sapphire Reserve",
  venture_one:"Capital One VentureOne Rewards",venture:"Capital One Venture Rewards",venture_x:"Capital One Venture X Rewards",
  delta_blue:"Delta SkyMiles Blue American Express Card",delta_gold:"Delta SkyMiles Gold American Express Card",delta_platinum:"Delta SkyMiles Platinum American Express Card",delta_reserve:"Delta SkyMiles Reserve American Express Card",
  united_gateway:"United Gateway Card",united_explorer:"United Explorer Card",united_quest:"United Quest Card",united_club:"United Club Card",
  aa_mileup:"American Airlines AAdvantage MileUp Card",aa_platinum_select:"Citi / AAdvantage Platinum Select World Elite Mastercard",aa_executive:"Citi / AAdvantage Executive World Legend Mastercard",aa_globe:"Citi / AAdvantage Globe Mastercard",
  southwest_plus:"Southwest Rapid Rewards Plus Credit Card",southwest_premier:"Southwest Rapid Rewards Premier Credit Card",southwest_priority:"Southwest Rapid Rewards Priority Credit Card",
  hyatt_consumer:"World of Hyatt Credit Card",marriott_bold:"Marriott Bonvoy Bold Credit Card",marriott_boundless:"Marriott Bonvoy Boundless Credit Card",marriott_bountiful:"Marriott Bonvoy Bountiful Credit Card",marriott_bevy:"Marriott Bonvoy Bevy American Express Card",marriott_brilliant:"Marriott Bonvoy Brilliant American Express Card",
  hilton_no_fee:"Hilton Honors American Express Card",hilton_surpass:"Hilton Honors American Express Surpass Card",hilton_aspire:"Hilton Honors American Express Aspire Card"
});

function norm(v){return String(v??"").toLowerCase().replace(/[™®]/g,"").replace(/[^a-z0-9]+/g," ").trim();}
function num(v){const n=Number(String(v??"").replace(/[$,%\s,]/g,""));return Number.isFinite(n)?n:0;}
function hasValue(v){return v!==undefined&&v!==null&&String(v).trim()!=="";}
function unique(a){return [...new Set((a||[]).filter(Boolean))];}
function resolveCard(v){
  const x=norm(v);if(!x)return "";
  for(const [id,aliases] of Object.entries(CARD_ALIASES)){
    if(aliases.some(a=>x===norm(a)))return id;
  }
  return String(v).trim();
}
function parseCardList(v){
  return unique(String(v||"").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).map(resolveCard));
}
function airportRows(){return Array.isArray(globalThis.QP_AIRPORTS)?globalThis.QP_AIRPORTS:[];}
function airportNorm(v){return String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function airportLabel(a){return a.c+" — "+a.n+" — "+a.y+", "+a.o;}
function airportMatches(v,limit=12){
  const q=airportNorm(v);if(q.length<2)return[];
  const rows=airportRows(),exactCode=String(v||"").trim().toUpperCase();
  const scored=[];
  for(const a of rows){
    const code=String(a.c||"").toUpperCase(),name=airportNorm(a.n),city=airportNorm(a.y),country=airportNorm(a.o);
    let score=0;
    if(code===exactCode)score=100;
    else if(code.startsWith(exactCode)&&exactCode.length>=2)score=90;
    else if(city===q)score=80;
    else if(name===q)score=75;
    else if(city.startsWith(q))score=65;
    else if(name.startsWith(q))score=55;
    else if((city+" "+name+" "+country).includes(q))score=35;
    if(score)scored.push({a,score});
  }
  return scored.sort((x,y)=>y.score-x.score||String(x.a.c).localeCompare(String(y.a.c))).slice(0,limit).map(x=>x.a);
}
function resolveAirport(v){
  const raw=String(v||"").trim();if(!raw)return{ok:false,reason:"empty",matches:[]};
  const prefix=raw.match(/^([A-Za-z0-9]{3})\s*(?:—|-|$)/),code=(prefix?prefix[1]:raw).toUpperCase();
  const rows=airportRows();
  if(/^[A-Z0-9]{3}$/.test(code)){
    const hit=rows.find(a=>String(a.c||"").toUpperCase()===code);
    if(hit)return{ok:true,code:String(hit.c).toUpperCase(),airport:hit,matches:[hit]};
  }
  const q=airportNorm(raw),exact=rows.filter(a=>airportNorm(a.n)===q||airportNorm(a.y)===q||airportNorm(a.c)===q);
  if(exact.length===1)return{ok:true,code:String(exact[0].c).toUpperCase(),airport:exact[0],matches:exact};
  if(exact.length>1)return{ok:false,reason:"ambiguous",matches:exact.slice(0,12)};
  return{ok:false,reason:"unrecognized",matches:airportMatches(raw,12)};
}
function destinationTokens(v){return unique(String(v||"").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean));}
function parseDestinations(v){
  return unique(destinationTokens(v).map(x=>resolveAirport(x)).filter(x=>x.ok).map(x=>x.code)).slice(0,5);
}
function parseGoals(v){
  if(Array.isArray(v))return unique(v.map(x=>String(x).trim().toLowerCase()).filter(Boolean));
  return unique(String(v||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean));
}
function parseCardAmountLines(v){
  const out={};
  String(v||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>{
    const m=line.match(/^(.+?)\s*[:|]\s*\$?([\d,]+(?:\.\d+)?)\s*$/);
    if(!m)return;
    const id=resolveCard(m[1]),amount=num(m[2]);
    if(id&&amount>=0)out[id]=amount;
  });
  return out;
}
function parseCardPqpLines(v){
  const out={};
  String(v||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>{
    const m=line.match(/^(.+?)\s*[:|]\s*([\d,]+(?:\.\d+)?)\s*$/);
    if(!m)return;
    const id=resolveCard(m[1]),pqp=num(m[2]);
    if(id&&pqp>=0)out[id]={pqp};
  });
  return out;
}
function primaryAirline(v){const x=norm(v);if(x==="delta"||x==="united"||x==="american"||x==="southwest")return x;return "";}
function primaryHotel(v){const x=norm(v);if(x.includes("hyatt"))return "hyatt";if(x.includes("marriott"))return "marriott";if(x.includes("hilton"))return "hilton";return "";}
function bookingControl(v){
  const x=norm(v);
  if(x.startsWith("full"))return "full";
  if(x.startsWith("usual"))return "usual";
  if(x.startsWith("limited"))return "limited";
  if(x.includes("employer")||x.includes("another party"))return "none";
  return "";
}
function airfareBooking(v){
  const x=norm(v);
  if(x==="direct airline")return "direct_airline";
  if(x==="amex travel")return "amex_travel";
  if(x==="chase travel")return "chase_travel";
  if(x==="capital one travel")return "capital_one_travel";
  if(x==="other portal agency"||x==="other portal")return "other_portal";
  return "";
}
function hotelBooking(v){
  const x=norm(v);
  if(x==="direct"||x==="direct with hotel")return "direct_hotel";
  if(x==="amex prepaid"||x==="amex travel prepaid")return "amex_prepaid";
  if(x==="chase travel")return "chase_travel";
  if(x==="capital one travel")return "capital_one_travel";
  if(x==="other portal agency"||x==="other portal")return "other_portal";
  return "";
}
function routeRow(card,amount){
  const id=resolveCard(card);return id&&amount>0?[{card:id,amount}]:[];
}
function buildProfileFromValues(v={}){
  const air=primaryAirline(v.primary_airline_eco),hotel=primaryHotel(v.primary_hotel_program);
  const spend={
    dining:num(v.dining_spend),
    grocery:num(v.grocery_spend),
    airfare:num(v.individual_airfare_spend),
    hotel:num(v.hotel_spend),
    general:num(v.general_spend)
  };
  const currentRouting={
    dining:routeRow(v.card_dining,spend.dining),
    grocery:routeRow(v.card_groceries,spend.grocery),
    online_grocery:[],drugstore:[],gas_ev:[],transit:[],online_retail:[],vacation_home:[],
    airfare:routeRow(v.card_airfare,spend.airfare),
    hotel:routeRow(v.card_hotels,spend.hotel),
    general:routeRow(v.card_general,spend.general)
  };
  const statusProgress={
    delta:{mqd:num(v.delta_mqd_ytd)},
    united:{pqp:num(v.united_pqp_ytd),pqf:num(v.united_pqf_ytd),unitedSegments:hasValue(v.united_segments_ytd)?num(v.united_segments_ytd):null},
    american:{loyaltyPoints:num(v.american_loyalty_points_ytd)},
    southwest:{tqp:num(v.southwest_tqp_ytd),qualifyingFlights:num(v.southwest_qualifying_flights_ytd)},
    hotel:{
      qualifyingNights:num(v.hotel_qualifying_nights_ytd),
      qualifyingStays:num(v.hotel_qualifying_stays_ytd),
      qualifyingSpend:num(v.hotel_qualifying_spend_ytd),
      basePoints:num(v.hotel_base_points_ytd)
    }
  };
  const remainingSpend={
    dining:num(v.remaining_dining_spend),grocery:num(v.remaining_grocery_spend),
    airfare:num(v.remaining_airfare_spend),hotel:num(v.remaining_hotel_spend),general:num(v.remaining_general_spend)
  };
  const remainingKnown=[
    "remaining_dining_spend","remaining_grocery_spend","remaining_airfare_spend","remaining_hotel_spend","remaining_general_spend",
    "delta_remaining_mqd","united_remaining_pqp","united_remaining_pqf","united_remaining_segments",
    "southwest_remaining_tqp","southwest_remaining_qualifying_flights",
    "hotel_remaining_nights","hotel_remaining_stays","hotel_remaining_spend","hotel_remaining_base_points"
  ].some(k=>hasValue(v[k]));
  const remainingYear=remainingKnown?{
    cardSpend:remainingSpend,
    delta:{mqd:num(v.delta_remaining_mqd)},
    united:{pqp:num(v.united_remaining_pqp),pqf:num(v.united_remaining_pqf),unitedSegments:hasValue(v.united_remaining_segments)?num(v.united_remaining_segments):null},
    southwest:{tqp:num(v.southwest_remaining_tqp),qualifyingFlights:num(v.southwest_remaining_qualifying_flights)},
    hotel:{qualifyingNights:num(v.hotel_remaining_nights),qualifyingStays:num(v.hotel_remaining_stays),qualifyingSpend:num(v.hotel_remaining_spend),basePoints:num(v.hotel_remaining_base_points)}
  }:undefined;
  const americanKnown=hasValue(v.american_remaining_loyalty_points)||hasValue(v.american_remaining_qualifying_segments)||Object.values(remainingSpend).some(x=>x>0);
  const southwestCompanionKnown=[
    "southwest_companion_points_ytd","southwest_companion_flights_ytd",
    "southwest_companion_remaining_noncard_points","southwest_companion_remaining_flights"
  ].some(k=>hasValue(v[k]));
  const profile={
    asOfDate:new Date().toISOString().slice(0,10),
    spend,
    currentCards:parseCardList(v.primary_cards),
    currentRouting,
    statusProgress,
    primaryAirline:air,
    primaryAirlineShare:air&&hasValue(v.airline_conc)?num(v.airline_conc)/100:undefined,
    currentAirlineStatus:v.primary_airline_status||"",
    primaryHotel:hotel,
    primaryHotelShare:hotel&&hasValue(v.hotel_conc)?num(v.hotel_conc)/100:undefined,
    currentHotelStatus:v.primary_hotel_status||"",
    annualOneWayFlights:num(v.flights_taken),
    bookingControl:bookingControl(v.booking_control),
    homeAirport:resolveAirport(v.home_airport).code||"",
    frequentDestinations:parseDestinations(v.frequent_destinations),
    bookingMethod:{airfare:airfareBooking(v.airfare_booking_method),hotel:hotelBooking(v.hotel_booking_method)},
    aspirations:parseGoals(v.desired_outcomes),
    companionTravelIntent:norm(v.companion_travel_intent).replace("not sure","not_sure"),
    companionTravelFrequency:String(v.companion_travel_frequency||"").trim(),
    pointBalances:{
      amex_mr:num(v.points_amex_mr),chase_ur:num(v.points_chase_ur),skymiles:num(v.points_skymiles),
      united_miles:num(v.points_united_miles),aadvantage:num(v.points_aadvantage),southwest_points:num(v.points_southwest_points),
      hyatt_points:num(v.points_hyatt_points),marriott_points:num(v.points_marriott_points),hilton_points:num(v.points_hilton_points)
    },
    cardSpendYTD:parseCardAmountLines(v.card_spend_ytd_lines),
    cardStatusProgressYTD:parseCardPqpLines(v.united_card_pqp_ytd_lines),
    preferences:{willingnessToConcentrate:String(v.willing_to_concentrate||"").trim().toLowerCase()}
  };
  if(remainingYear)profile.remainingYear=remainingYear;
  if(americanKnown)profile.americanQualification={
    cardSpend:remainingSpend,
    loyaltyPoints:num(v.american_remaining_loyalty_points),
    qualifyingSegments:num(v.american_remaining_qualifying_segments)
  };
  if(southwestCompanionKnown)profile.southwestCompanionQualification={
    currentQualifyingPoints:num(v.southwest_companion_points_ytd),
    currentQualifyingFlights:num(v.southwest_companion_flights_ytd),
    remainingNonCardQualifyingPoints:num(v.southwest_companion_remaining_noncard_points),
    remainingQualifyingFlights:num(v.southwest_companion_remaining_flights),
    cardSpend:remainingSpend,
    cardBoostIncluded:true
  };
  return profile;
}
function validationErrors(v={}){
  const errors=[];
  const home=resolveAirport(v.home_airport);
  if(!home.ok)errors.push(home.reason==="ambiguous"?"Choose a specific home airport rather than a city with multiple airports.":"Choose a valid home airport from the airport suggestions.");
  const destinationInputs=destinationTokens(v.frequent_destinations);
  if(destinationInputs.length>5)errors.push("Enter no more than five frequent destinations.");
  for(const token of destinationInputs){
    const d=resolveAirport(token);
    if(!d.ok){errors.push(d.reason==="ambiguous"?"Choose a specific airport for "+token+" rather than an ambiguous city.":"Quiet Premium could not identify the destination "+token+". Use an airport code or choose a specific airport.");break;}
  }
  const total=num(v.total_spend),sum=num(v.dining_spend)+num(v.grocery_spend)+num(v.general_spend)+num(v.individual_airfare_spend)+num(v.hotel_spend);
  const tol=Math.max(1000,total*.05);
  if(total>0&&Math.abs(total-sum)>tol)errors.push("Your spending categories need to be within 5% of your annual total so Quiet Premium does not invent where the missing dollars went.");
  const wallet=parseCardList(v.primary_cards);
  if(!wallet.length)errors.push("Add at least one current card.");
  for(const [field,spendField,label] of [
    ["card_dining","dining_spend","dining"],["card_groceries","grocery_spend","grocery"],
    ["card_airfare","individual_airfare_spend","airfare"],["card_hotels","hotel_spend","hotel"],["card_general","general_spend","general"]
  ]){
    if(num(v[spendField])<=0)continue;
    const id=resolveCard(v[field]);
    if(!id||!wallet.includes(id))errors.push("The card used for "+label+" spend must also appear in your current-card list.");
  }
  if(!airfareBooking(v.airfare_booking_method))errors.push("Choose where you book most airfare.");
  const hi=primaryHotel(v.primary_hotel_program);
  if(hi&&!hotelBooking(v.hotel_booking_method))errors.push("Choose where you book most hotel stays.");
  const air=primaryAirline(v.primary_airline_eco);
  if(air==="delta"&&!hasValue(v.delta_mqd_ytd))errors.push("Enter your actual current Delta MQDs, including 0 if none.");
  if(air==="united"&&(!hasValue(v.united_pqp_ytd)||!hasValue(v.united_pqf_ytd)||!hasValue(v.united_segments_ytd)))errors.push("Enter your actual current United PQPs, PQFs and United-operated segments, including 0 where appropriate.");
  if(air==="american"&&!hasValue(v.american_loyalty_points_ytd))errors.push("Enter your actual current AAdvantage Loyalty Points, including 0 if none.");
  if(air==="southwest"&&(!hasValue(v.southwest_tqp_ytd)||!hasValue(v.southwest_qualifying_flights_ytd)))errors.push("Enter your actual current Southwest tier-qualifying points and qualifying flights, including 0 where appropriate.");
  if(hi&&(!hasValue(v.hotel_qualifying_nights_ytd)||!hasValue(v.hotel_qualifying_stays_ytd)||!hasValue(v.hotel_qualifying_spend_ytd)))errors.push("Enter your actual current-year qualifying hotel nights, stays and spend, including 0 where appropriate.");
  const intent=norm(v.companion_travel_intent).replace("not sure","not_sure");
  if(!["yes","no","not_sure"].includes(intent))errors.push("Choose Yes, No, or Not sure for future companion travel.");
  if(intent==="yes"&&!["1","2_3","4_6","7_plus"].includes(String(v.companion_travel_frequency||"")))errors.push("Choose how often you realistically expect to use companion travel.");
  return errors;
}
function collectValues(form){
  const data={};new FormData(form).forEach((v,k)=>{data[k]=v});
  ["points_amex_mr","points_chase_ur","points_skymiles","points_united_miles","points_aadvantage","points_southwest_points","points_hyatt_points","points_marriott_points","points_hilton_points"].forEach(id=>{
    const el=document.getElementById(id);if(el)data[id]=el.value;
  });
  return data;
}
async function postJson(url,payload){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","apikey":QP_SUPABASE_KEY},body:JSON.stringify(payload),signal:controller.signal});
    let body=null;try{body=await res.json()}catch{}
    if(!res.ok){const e=new Error(body?.reason||body?.error||("Request failed ("+res.status+")"));e.status=res.status;e.body=body;throw e;}
    return body;
  }finally{clearTimeout(timer)}
}
async function buildPlan(profile){
  return postJson(QP_SUPABASE_URL+"/functions/v1/"+PLAN_FUNCTION,{
    profile,
    funnelSession:sessionStorage.getItem(FUNNEL_SESSION_KEY)||"",
    persistPlan:true
  });
}
function sendCentralEvent(name,architectureId="",token=""){
  try{
    fetch(QP_SUPABASE_URL+"/rest/v1/rpc/qp_log_event_v2",{
      method:"POST",
      keepalive:true,
      headers:{"Content-Type":"application/json","apikey":QP_SUPABASE_KEY},
      body:JSON.stringify({
        p_event_type:name,
        p_session_id:sessionStorage.getItem(FUNNEL_SESSION_KEY)||null,
        p_architecture_id:architectureId||null,
        p_token:token||null,
        p_metadata:{page:"diagnostic",build:BUILD}
      })
    }).catch(()=>{});
  }catch{}
}
function showError(message){
  const loading=document.getElementById("loading"),main=document.querySelector("main"),old=document.getElementById("qp-v5-error");
  if(loading)loading.classList.remove("active");if(main)main.style.display="";
  old?.remove();
  const box=document.createElement("div");box.id="qp-v5-error";box.className="error-box";box.style.margin="0 0 24px";
  box.textContent=message;
  const shell=document.querySelector("#assessment .shell");shell?.prepend(box);box.scrollIntoView({behavior:"smooth",block:"center"});
}
function bindAirportInputs(){
  const home=document.getElementById("home_airport");if(!home)return;
  let list=document.getElementById("qp-airport-list");
  if(!list){list=document.createElement("datalist");list.id="qp-airport-list";document.body.appendChild(list);}
  home.setAttribute("list","qp-airport-list");home.setAttribute("autocomplete","off");
  const refresh=()=>{const matches=airportMatches(home.value,15);list.innerHTML=matches.map(a=>'<option value="'+String(airportLabel(a)).replace(/"/g,"&quot;")+'"></option>').join("");};
  home.addEventListener("input",refresh);
  home.addEventListener("change",()=>{const r=resolveAirport(home.value);if(r.ok)home.value=r.code;});
  home.addEventListener("blur",()=>{const r=resolveAirport(home.value);if(r.ok)home.value=r.code;});
  const dest=document.getElementById("frequent_destinations");
  dest?.addEventListener("blur",()=>{const tokens=destinationTokens(dest.value),resolved=tokens.map(resolveAirport);if(tokens.length&&resolved.every(x=>x.ok))dest.value=unique(resolved.map(x=>x.code)).slice(0,5).join(", ");});
}
function syncConditionals(){
  const air=primaryAirline(document.getElementById("primary_airline_eco")?.value);
  document.querySelectorAll("[data-v5-air]").forEach(el=>el.classList.toggle("hidden",el.dataset.v5Air!==air));
  const intent=norm(document.getElementById("companion_travel_intent")?.value).replace("not sure","not_sure");
  document.getElementById("companion-frequency-wrap")?.classList.toggle("hidden",intent!=="yes");
}
async function submitV5(e){
  e.preventDefault();e.stopImmediatePropagation();
  const form=e.currentTarget,values=collectValues(form),errors=validationErrors(values);
  if(errors.length){showError(errors[0]);return}
  document.getElementById("qp-v5-error")?.remove();
  document.querySelector("main").style.display="none";
  document.getElementById("loading")?.classList.add("active");
  window.scrollTo(0,0);
  try{
    const profile=buildProfileFromValues(values);
    const result=await buildPlan(profile);
    if(result?.status!=="ready"||result?.resultExperience?.meta?.schema!=="qp-results-v1"||result?.resultExperience?.quality?.ready!==true)throw new Error("Quiet Premium could not produce a production-ready plan from these answers.");
    const saved=result?.savedPlan;
    if(!saved?.architecture_id||!saved?.retrieval_token)throw new Error("Quiet Premium created the plan but could not save a private retrieval link.");
    try{sessionStorage.setItem(PLAN_STORAGE_KEY,JSON.stringify(result.resultExperience))}catch{}
    try{localStorage.removeItem("qp_architecture_phase5_draft")}catch{}
    try{if(typeof gtag==="function")gtag("event","assessment_complete",{})}catch{}
    sendCentralEvent("assessment_complete",saved.architecture_id,saved.retrieval_token);
    sendCentralEvent("result_save",saved.architecture_id,saved.retrieval_token);
    const url=new URL("plan.html",location.href);
    url.hash="a="+encodeURIComponent(saved.architecture_id)+"&t="+encodeURIComponent(saved.retrieval_token);
    location.assign(url.toString());
  }catch(err){
    const body=err?.body||{},reason=body?.reason||err?.message||"The plan could not be completed.";
    showError(reason==="strategy_verification_incomplete"||reason==="final_verification_incomplete"||reason==="engine_fact_quality_not_ready"||reason==="pre_output_audit_failed"
      ?"Quiet Premium cannot produce a reliable recommendation from the currently verified information. No fallback recommendation was substituted."
      :"Quiet Premium could not complete this analysis. Your answers remain on this device so you can try again.");
  }
}
function bind(){
  const form=document.getElementById("architecture-form");if(!form)return;
  form.addEventListener("submit",submitV5,true);
  document.addEventListener("change",syncConditionals);
  document.addEventListener("input",syncConditionals);
  bindAirportInputs();
  syncConditionals();
}
return Object.freeze({CARD_LABELS,resolveCard,parseCardList,parseGoals,parseCardAmountLines,parseCardPqpLines,resolveAirport,airportMatches,parseDestinations,buildProfileFromValues,validationErrors,bind});
});
