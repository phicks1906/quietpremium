import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ENTITY_SOURCES, ALLOWED_CARD_IDS, ALLOWED_AIRLINE_IDS, ALLOWED_HOTEL_IDS } from "./sources.ts";
import { parseDeltaCardStatus, parseDeltaThresholds, parseUnitedThresholds, parseChaseReserveRewards, parseMarriottThresholds, parseMarriottCardRewards, parseMarriottCardCriticalFacts, criticalStructureIssues } from "./critical-parsers.ts";

const ORIGINS=new Set(["https://quietpremium.com","https://www.quietpremium.com"]);
const PUBLIC_BROWSER_KEY="sb_publishable_BETG0zmWAEmPByBsKyEUzA_yPCOkh5F";
const MAX_ENTITIES=12,MAX_BYTES=2000000,TIMEOUT=15000,SCHEMA="qp-verified-facts-v1";
const uniq=(a:any[])=>[...new Set((a||[]).filter(Boolean))];
const amount=(v:any)=>{const n=Number(String(v??"").replace(/[$,%\s,]/g,""));return Number.isFinite(n)?n:null};
const cleanText=(h:string)=>String(h||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g," ").trim();
const has=(o:any,p:string)=>{let x=o;for(const k of p.split(".")){if(!x||!Object.prototype.hasOwnProperty.call(x,k))return false;x=x[k]}if(x==null)return false;if(Array.isArray(x))return x.length>0;if(typeof x==="object")return Object.keys(x).length>0;return true};
function j(body:any,status=200,origin=""){const h:any={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};if(origin&&ORIGINS.has(origin)){h["Access-Control-Allow-Origin"]=origin;h["Vary"]="Origin"}return new Response(JSON.stringify(body),{status,headers:h})}
function preflight(origin:string){if(!ORIGINS.has(origin))return new Response(null,{status:403});return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400","Vary":"Origin"}})}
function keys(){const out:string[]=[PUBLIC_BROWSER_KEY];try{const x=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");for(const v of Object.values(x))if(typeof v==="string"&&v)out.push(v)}catch{}const a=Deno.env.get("SUPABASE_ANON_KEY");if(a)out.push(a);return new Set(out)}
function auth(req:Request){const k=req.headers.get("apikey")||"";return !!k&&keys().has(k)}
async function digest(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function scopedRaw(raw:string,url:string){
  const lower=raw.toLowerCase();
  const mainStart=lower.indexOf("<main");
  const mainEnd=lower.lastIndexOf("</main>");
  if(mainStart>=0&&mainEnd>mainStart)return raw.slice(mainStart,mainEnd+7);

  const bodyStart=lower.indexOf("<body");
  const bodyEnd=lower.lastIndexOf("</body>");
  let scoped=bodyStart>=0?raw.slice(bodyStart,bodyEnd>bodyStart?bodyEnd+7:raw.length):raw;

  if(/capitalone\.com\/credit-cards\//i.test(url)){
    const x=scoped.toLowerCase();
    const foot=x.indexOf('id="footnotes"'),footer=x.indexOf("<footer");
    const cuts=[
      x.indexOf("<shared-ratings-and-reviews"),
      x.indexOf('id="reviews-section"'),
      foot,
      footer
    ].filter(n=>n>0);
    const primary=cuts.length?scoped.slice(0,Math.min(...cuts)):scoped;
    const footnotes=foot>0?scoped.slice(foot,footer>foot?footer:scoped.length):"";
    scoped=primary+" "+footnotes;
  }
  return scoped;
}
async function getOnce(url:string){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT),retrievedAt=new Date().toISOString();
  try{
    const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{"Accept":"text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5","Accept-Language":"en-US,en;q=0.8","User-Agent":"Mozilla/5.0 (compatible; QuietPremiumVerifier/1.0; +https://quietpremium.com)"}});
    const raw=await r.text(),finalUrl=r.url||url,scoped=scopedRaw(raw,finalUrl).slice(0,MAX_BYTES);
    return{url,finalUrl,ok:r.ok,status:r.status,retrievedAt,bytesRead:raw.length,fingerprint:await digest(raw),text:cleanText(scoped)};
  }catch(e){return{url,finalUrl:url,ok:false,status:0,retrievedAt,bytesRead:0,fingerprint:"",text:"",error:String((e as Error)?.message||e)}}
  finally{clearTimeout(t)}
}
async function get(url:string){
  const firstTry=await getOnce(url);
  if(firstTry.ok||firstTry.status!==0)return firstTry;
  await new Promise(r=>setTimeout(r,120));
  const secondTry=await getOnce(url);
  return secondTry.ok?secondTry:{...secondTry,firstAttemptError:firstTry.error||""};
}
function first(text:string,res:RegExp[]){for(const r of res){const m=text.match(r);if(m)return m}return null}
function fee(t:string,id:string){
  if(id==="amex_gold"){
    const gold=first(t,[
      /annual fee for[^$]{0,180}Gold Card[^$]{0,180}\$\s*([\d,]+)/i,
      /Gold Card[^.]{0,260}\$\s*([\d,]+) annual fee/i,
      /American Express[^.]{0,120}Gold Card[\s\S]{0,4500}?Annual Fee\s*:?\s*\$\s*([\d,]+)/i
    ]);
    if(gold&&Number(amount(gold[1]))>0)return amount(gold[1]);
  }
  if(id==="amex_gold"||id==="amex_green"||id==="amex_platinum"){
    const names:any={
      amex_gold:"American Express(?:®)?\\s+Gold Card",
      amex_green:"American Express(?:®)?\\s+(?:Classic )?Green Card",
      amex_platinum:"(?:The )?Platinum Card(?:®)?(?: from American Express)?"
    };
    const n=names[id],specific=first(t,[
      new RegExp(n+"[\\s\\S]{0,2600}?Annual Fee\\s*:?\\s*\\$\\s*([\\d,]+)","i"),
      new RegExp("annual fee for (?:the )?"+n+"[^$]{0,220}\\$\\s*([\\d,]+)","i"),
      new RegExp(n+"[^.]{0,220}has a \\$\\s*([\\d,]+) annual fee","i")
    ]);
    if(specific)return amount(specific[1]);
  }const intro=first(t,[/\$\s*0[^.]{0,80}(?:intro|introductory) annual fee[^.]{0,120}then\s+\$\s*([\d,]+)/i,/(?:intro|introductory) annual fee[^.]{0,100}\$\s*0[^.]{0,120}then\s+\$\s*([\d,]+)/i]);if(intro)return amount(intro[1]);const m=first(t,[/Annual Fee\s*:?\s*\$\s*([\d,]+)/i,/\$\s*([\d,]+)\s+annual fee/i,/annual fee[^$]{0,80}\$\s*([\d,]+)/i,/then\s+\$\s*([\d,]+)[^.]{0,80}annual fee/i]);if(m)return amount(m[1]);if(/(?:^|[.!?]\s+)(?:there is |with )?no annual fee\b/i.test(t)||/annual fee\s*:?\s*\$\s*0\b/i.test(t))return 0;return null}
function rate(t:string,words:RegExp[]){for(const w of words){const q=w.source;const m=first(t,[new RegExp("(\\d+(?:\\.\\d+)?)\\s*[xX][^.]{0,100}"+q,"i"),new RegExp(q+"[^.]{0,100}(\\d+(?:\\.\\d+)?)\\s*[xX]","i"),new RegExp("(\\d+(?:\\.\\d+)?)\\s+(?:miles?|points?)\\s+per\\s+(?:dollar|\\$1)[^.]{0,100}"+q,"i"),new RegExp(q+"[^.]{0,100}(\\d+(?:\\.\\d+)?)\\s+(?:miles?|points?)\\s+per\\s+(?:dollar|\\$1)","i")]);if(m)return Number(m[1])}return null}
function earn(t:string){const g=rate(t,[/all other (?:eligible )?purchases/i,/all other purchases/i,/other eligible purchases/i,/other purchases/i,/every purchase/i,/all purchases/i]);if(!(g&&g>0))return null;const e:any={dining:g,grocery:g,online_grocery:g,drugstore:g,gas_ev:g,transit:g,online_retail:g,vacation_home:g,airfare:g,hotel:g,general:g};const set=(k:string,v:any)=>{if(v)e[k]=v};set("dining",rate(t,[/restaurants?/i,/dining/i]));const gr=rate(t,[/supermarkets?/i,/grocer(?:y|ies)/i]);if(gr){e.grocery=gr;e.online_grocery=gr}set("online_grocery",rate(t,[/online groceries/i,/online grocery/i]));set("drugstore",rate(t,[/drugstores?/i,/pharmacies/i]));set("gas_ev",rate(t,[/gas stations?/i,/EV charging/i]));const tr=rate(t,[/transit/i,/local transit/i,/commuting/i]);if(tr)e.transit=tr;set("online_retail",rate(t,[/online retail/i]));set("vacation_home",rate(t,[/vacation homes?/i,/Airbnb/i,/Vrbo/i]));const travel=rate(t,[/all other travel/i,/travel purchases/i,/eligible travel/i]);if(travel){e.airfare=travel;e.hotel=travel;e.vacation_home=travel;if(!tr)e.transit=travel}set("airfare",rate(t,[/flights? booked directly/i,/flights? booked through AmexTravel/i,/Delta purchases?/i,/United purchases?/i,/American Airlines purchases?/i,/Southwest purchases?/i]));set("hotel",rate(t,[/Hyatt hotels?/i,/Hilton portfolio/i,/Marriott Bonvoy hotels?/i,/hotel stays?/i]));return e}
function freedomFamilyEarn(t:string,id:string){if(!["chase_freedom_unlimited","chase_freedom_flex","chase_freedom_rise"].includes(id))return earn(t);const base=id==="chase_freedom_flex"?1:1.5;if(id==="chase_freedom_flex"){if(!/1%[^.]{0,140}(?:all other|every purchase)|(?:all other|every purchase)[^.]{0,140}1%/i.test(t))return null}else if(!/1\.5%[^.]{0,160}(?:cash back|all other|every purchase)|(?:all other|every purchase)[^.]{0,160}1\.5%/i.test(t))return null;const e:any={dining:base,grocery:base,online_grocery:base,drugstore:base,gas_ev:base,transit:base,online_retail:base,vacation_home:base,airfare:base,hotel:base,general:base};if(/3%[^.]{0,140}(?:dining|restaurants?)|(?:dining|restaurants?)[^.]{0,140}3%/i.test(t))e.dining=3;if(/3%[^.]{0,140}drugstores?|drugstores?[^.]{0,140}3%/i.test(t))e.drugstore=3;return e}
function cardEarn(t:string,id:string){
  if(id==="amex_green"){
    const dining=/3\s*[xX][^.]{0,160}(?:restaurants?|dining)|(?:restaurants?|dining)[^.]{0,160}3\s*[xX]/i.test(t);
    const transit=/3\s*[xX][^.]{0,160}transit|transit[^.]{0,160}3\s*[xX]/i.test(t);
    const travel=/3\s*[xX][^.]{0,160}travel|travel[^.]{0,160}3\s*[xX]/i.test(t);
    const base=/1\s*[xX][^.]{0,180}(?:other|all other) purchases|(?:other|all other) purchases[^.]{0,180}1\s*[xX]/i.test(t);
    if(!(dining&&transit&&travel&&base))return null;
    return{dining:3,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:3,online_retail:1,vacation_home:3,airfare:3,hotel:3,general:1};
  }
  if(id==="chase_reserve"){
    const parsed=parseChaseReserveRewards(t);
    return parsed?.earn||null;
  }
  if(id==="amex_platinum"){
    const five=/5\s*[xX][^.]{0,220}flights|flights[^.]{0,220}5\s*[xX]/i.test(t),
          hotels=/5\s*[xX][^.]{0,220}prepaid hotels|prepaid hotels[^.]{0,220}5\s*[xX]/i.test(t),
          cap=/500,?000[^.]{0,180}(?:calendar year|purchases)/i.test(t);
    if(!(five&&hotels&&cap))return null;
    return{dining:1,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:1,online_retail:1,vacation_home:1,airfare:1,hotel:1,general:1};
  }
  if(id==="chase_preferred"){
    const pick=(res:RegExp[])=>{const m=first(t,res);return m?Number(m[1]):null};
    const g=pick([/(\d+(?:\.\d+)?)\s*[xX]\s*points?\s+on all other purchases/i]);
    const d=pick([/(\d+(?:\.\d+)?)\s*[xX]\s*points?\s+on dining/i]);
    const og=pick([/(\d+(?:\.\d+)?)\s*[xX]\s*points?\s+on top streaming services and online grocery/i]);
    const ge=pick([/(\d+(?:\.\d+)?)\s*[xX]\s*points?\s+on gas stations, EV charging, and vacation homes/i]);
    const tr=pick([/(\d+(?:\.\d+)?)\s*[xX]\s*points?\s+on all other travel/i]);
    if([g,d,og,ge,tr].some(v=>!(v&&v>0)))return null;
    return{dining:d,grocery:g,online_grocery:og,drugstore:g,gas_ev:ge,transit:tr,online_retail:g,vacation_home:ge,airfare:tr,hotel:tr,general:g};
  }
  if(id==="hyatt_consumer"){
    const hotel=/4\s+(?:Bonus\s+)?Points?\s+per\s+\$?1[^.]{0,220}(?:Hyatt hotels?|Hyatt resorts?)|4\s*[xX][^.]{0,180}(?:Hyatt hotels?|Hyatt resorts?)/i.test(t);
    const dining=/2\s+(?:Bonus\s+)?Points?\s+per\s+\$?1[^.]{0,220}(?:restaurants?|dining)|2\s*[xX][^.]{0,180}(?:restaurants?|dining)/i.test(t);
    const airfare=/2\s+(?:Bonus\s+)?Points?\s+per\s+\$?1[^.]{0,260}(?:airline tickets?|airfare)[^.]{0,120}(?:directly|airline)|2\s*[xX][^.]{0,220}(?:airline tickets?|airfare)/i.test(t);
    const transit=/2\s+(?:Bonus\s+)?Points?\s+per\s+\$?1[^.]{0,260}(?:local transit|commuting)|2\s*[xX][^.]{0,220}(?:local transit|commuting)/i.test(t);
    const base=/1\s+(?:Bonus\s+)?Point\s+per\s+\$?1[^.]{0,220}(?:all other|other eligible) purchases?|1\s*[xX][^.]{0,180}(?:all other|other eligible) purchases?/i.test(t);
    if(!(hotel&&dining&&airfare&&transit&&base))return null;
    return{dining:2,grocery:1,online_grocery:1,drugstore:1,gas_ev:1,transit:2,online_retail:1,vacation_home:1,airfare:2,hotel:4,general:1};
  }
  if(["marriott_boundless","marriott_bountiful","marriott_bevy","marriott_brilliant"].includes(id)){
    return parseMarriottCardRewards(t,id);
  }
  const e=freedomFamilyEarn(t,id);if(!e)return e;
  if(id==="marriott_bold"&&/2X[^.]{0,180}rideshare|rideshare[^.]{0,180}2X/i.test(t))e.transit=2;
  if(id==="united_quest"||id==="united_club"){
    const travel=rate(t,[/all other travel/i,/travel \(excluding United purchases/i]);
    if(travel){e.hotel=travel;e.transit=travel;e.vacation_home=travel;}
  }
  return e;
}
function bookingEarn(t:string,id:string){const o:any={};if(id==="chase_reserve"){const parsed=parseChaseReserveRewards(t);if(parsed?.bookingEarn)Object.assign(o,parsed.bookingEarn)}else if(id==="amex_platinum"){const air=/5\s*[xX][^.]{0,240}flights[^.]{0,240}(?:directly|American Express Travel|Amex Travel)|flights[^.]{0,240}(?:directly|American Express Travel|Amex Travel)[^.]{0,240}5\s*[xX]/i.test(t),hotel=/5\s*[xX][^.]{0,220}prepaid hotels|prepaid hotels[^.]{0,220}5\s*[xX]/i.test(t);if(air)o.airfare={direct_airline:5,amex_travel:5};if(hotel)o.hotel={amex_prepaid:5}}else if(id.startsWith("amex_")){const air=rate(t,[/Flights[^.]{0,120}(?:AmexTravel|directly through airlines)/i,/AmexTravel[^.]{0,120}Flights/i]),hotel=rate(t,[/Prepaid Hotels/i]);if(air)o.airfare={direct_airline:air,amex_travel:air};if(hotel)o.hotel={amex_prepaid:hotel}}else if(id==="chase_freedom_unlimited"||id==="chase_freedom_flex"){if(/5%[^.]{0,160}Chase Travel|Chase Travel[^.]{0,160}5%/i.test(t)){o.airfare={chase_travel:5};o.hotel={chase_travel:5};o.vacation_home={chase_travel:5}}}else if(id.startsWith("chase_")){const v=rate(t,[/Chase Travel/i]);if(v){o.airfare={chase_travel:v};o.hotel={chase_travel:v};o.vacation_home={chase_travel:v}}}else if(id==="united_quest"||id==="united_club"){const renowned=rate(t,[/hotel stays[^.]{0,140}prepay directly through Renowned Hotels and Resorts/i,/hotel accommodation purchases[^.]{0,180}Renowned Hotels and Resorts/i]);if(renowned)o.hotel={renowned_prepaid:renowned}}else if(id==="aa_globe"||id==="aa_executive"){const hotel=rate(t,[/AAdvantage Hotels(?:™|®)? bookings?/i,/hotels booked through aadvantagehotels\.com/i]);if(hotel)o.hotel={aadvantage_hotels:hotel}}else if(id==="venture_one"||id==="venture"||id==="venture_x"){
    if(id==="venture_x"){
      const hotel=first(t,[/(10)\s*[xX]\s+miles?[^.]{0,120}hotels[^.]{0,100}rental cars[^.]{0,140}Capital One Travel/i,/hotels[^.]{0,120}rental cars[^.]{0,120}(10)\s*[xX]/i]);
      const airVac=first(t,[/(5)\s*[xX]\s+miles?[^.]{0,120}flights[^.]{0,120}vacation rentals?[^.]{0,140}Capital One Travel/i,/flights[^.]{0,120}vacation rentals?[^.]{0,120}(5)\s*[xX]/i]);
      if(hotel)o.hotel={capital_one_travel:Number(hotel[1])};
      if(airVac){o.airfare={capital_one_travel:Number(airVac[1])};o.vacation_home={capital_one_travel:Number(airVac[1])}}
    }else{
      const hv=first(t,[/(5)\s*[xX]\s+miles?[^.]{0,140}hotels[^.]{0,120}vacation rentals?[^.]{0,160}Capital One Travel/i,/(5)\s*[xX]\s+miles?[^.]{0,100}hotels,?\s+vacation rentals?[^.]{0,140}Capital One Travel/i,/(5)\s+miles? per dollar[^.]{0,120}hotels[^.]{0,100}vacation rentals?[^.]{0,160}Capital One Travel/i]);
      if(hv){o.hotel={capital_one_travel:5};o.vacation_home={capital_one_travel:5}}
      else{
        const hotel=rate(t,[/hotels[^.]{0,140}(?:booked )?through Capital One Travel/i]);
        const vacation=rate(t,[/vacation rentals?[^.]{0,140}(?:booked )?through Capital One Travel/i]);
        if(hotel)o.hotel={capital_one_travel:hotel};if(vacation)o.vacation_home={capital_one_travel:vacation}
      }
    }
  }return o}
function multiYearCredits(t:string,id:string){const o:any={};const critical=parseMarriottCardCriticalFacts(t,id);if(critical.trustedTraveler)o.trusted_traveler=critical.trustedTraveler;
  if(id==="amex_platinum"){
    const m=first(t,[/(?:Global Entry|TSA PreCheck)[\s\S]{0,900}?\$\s*(120)[\s\S]{0,1200}?every\s+(4)\s+years?/i,/\$\s*(120)[\s\S]{0,900}?(?:Global Entry|TSA PreCheck)[\s\S]{0,1200}?every\s+(4)\s+years?/i]);
    if(m)return{trusted_traveler:{amount:120,years:4}};
  }
  if(id==="venture"||id==="venture_x"){
    const m=first(t,[/(?:Global Entry|TSA PreCheck)[\s\S]{0,500}?\$\s*(120)[\s\S]{0,1400}?every four years/i,/\$\s*(120)[\s\S]{0,500}?(?:Global Entry|TSA PreCheck)[\s\S]{0,1400}?every four years/i]);
    if(m)return{trusted_traveler:{amount:120,years:4}};
  }let m=first(t,[/(?:Global Entry|TSA PreCheck|NEXUS)[^.]{0,280}(?:up to )?\$\s*([\d,]+)[^.]{0,260}every\s+(\d+)\s+years?/i,/\$\s*([\d,]+)[^.]{0,260}(?:Global Entry|TSA PreCheck|NEXUS)[^.]{0,260}every\s+(\d+)\s+years?/i,/statement credit[^.]{0,80}(?:up to )?\$\s*([\d,]+)[^.]{0,220}every\s+(\d+)\s+years?[^.]{0,120}(?:Global Entry|TSA PreCheck|NEXUS)/i]);if(!m){const block=first(t,[/(?:Global Entry|TSA PreCheck|NEXUS)[\s\S]{0,450}every four years/i,/every four years[\s\S]{0,450}(?:Global Entry|TSA PreCheck|NEXUS)/i]);if(block){const a=block[0].match(/\$\s*([\d,]+)/);if(a)o.trusted_traveler={amount:amount(a[1]),years:4};return o}}if(m)o.trusted_traveler={amount:amount(m[1]),years:amount(m[2])};return o}
function transferRules(t:string,id:string){if(!id.startsWith("chase_"))return{};if(id==="chase_reserve"&&/(?:1\s*:\s*1|1 to 1)[^.]{0,160}(?:hotel and airline|travel partners)|(?:1\s*:\s*1) Point Transfer/i.test(t))return{hyatt:{defaultRatio:1}};if(/World of Hyatt[^.]{0,220}(?:4\s*:\s*3|4 to 3)|(?:4\s*:\s*3|4 to 3)[^.]{0,220}World of Hyatt/i.test(t)){const r:any={hyatt:{defaultRatio:.75}};if(/prior to June 15, 2026/i.test(t)&&/through September 30, 2026/i.test(t)){r.hyatt.grandfatherBefore="2026-06-15";r.hyatt.grandfatherRatio=1;r.hyatt.grandfatherThrough="2026-09-30"}return r}if(/World of Hyatt[^.]{0,220}(?:1\s*:\s*1|1 to 1)|(?:1\s*:\s*1|1 to 1)[^.]{0,220}World of Hyatt/i.test(t))return{hyatt:{defaultRatio:1}};return{}}
function transferAccess(t:string,id:string){if(!id.startsWith("chase_"))return{};const o:any={};if(/Combine points with other Chase cards with Ultimate Rewards/i.test(t)||/move your points[^.]{0,220}another Chase card with Ultimate Rewards/i.test(t)||/move your points[^.]{0,220}another Chase card[^.]{0,180}(?:you|household)/i.test(t)||/combine points from one Chase card to another Chase card/i.test(t)||/combine points across (?:different )?cards/i.test(t)||/transfer points between your cards/i.test(t))o.canPool=true;const eligibility=/to transfer points to a travel partner[^.]{0,260}need to have[^.]{0,420}Sapphire Preferred[^.]{0,420}Sapphire Reserve[^.]{0,420}Ink Business Preferred/i.test(t)||/Sapphire Reserve[^.]{0,500}Sapphire Preferred[^.]{0,500}Ink Business Preferred[^.]{0,260}ability to transfer points to travel partners/i.test(t);if(["chase_freedom_unlimited","chase_freedom_flex","chase_freedom_rise"].includes(id)&&eligibility)o.directPartnerTransfer=false;else if((id==="chase_preferred"||id==="chase_reserve")&&(eligibility||/Transfer points to frequent travel programs/i.test(t)))o.directPartnerTransfer=true;if(["chase_freedom_unlimited","chase_freedom_flex","chase_freedom_rise"].includes(id)&&/Combine points with other Chase cards with Ultimate Rewards|move your points[^.]{0,220}another Chase card|combine points from one Chase card to another Chase card|combine points across (?:different )?cards|transfer points between your cards/i.test(t))o.canPool=true;return o}
function goldCaps(t:string,id:string){if(id!=="amex_gold")return{caps:{},capGroups:{},groupCaps:{},postCapEarn:{}};const d=first(t,[/restaurants[^.]{0,100}up to \$\s*([\d,]+)K? in purchases/i]),g=first(t,[/supermarkets[^.]{0,100}up to \$\s*([\d,]+)K? in purchases/i]);const dv=d?amount(d[1])*(/\$\s*[\d,]+K/i.test(d[0])?1000:1):null,gv=g?amount(g[1])*(/\$\s*[\d,]+K/i.test(g[0])?1000:1):null,caps:any={},capGroups:any={},groupCaps:any={},postCapEarn:any={};if(dv){caps.dining=dv;postCapEarn.dining=1}if(gv){capGroups.grocery="amex_gold_supermarket";capGroups.online_grocery="amex_gold_supermarket";groupCaps.amex_gold_supermarket=gv;postCapEarn.grocery=1;postCapEarn.online_grocery=1}return{caps,capGroups,groupCaps,postCapEarn}}
const TAGS:[string,RegExp][]=[["inflight_savings",/(?:20|25)%[^.]{0,140}(?:inflight|in-flight)|(?:inflight|in-flight)[^.]{0,140}(?:20|25)%/i],["award_discount",/TakeOff 15|15%[^.]{0,160}Award Travel|Award Travel[^.]{0,160}15%/i],["lounge",/Priority Pass|Centurion Lounge|United Club|Admirals Club|Sky Club|Capital One Lounge|airport lounge access/i],["premium_hotel_booking",/Fine Hotels \+ Resorts|Fine Hotels and Resorts|The Hotel Collection|The Edit by Chase Travel|Premier Collection/i],["priority_airport",/priority (?:check-in|security|airport)|Premier Access travel services/i],["upgrade_priority",/\bUpgrade Priority\b/i],["upgrade_eligibility",/Complimentary Upgrade List/i],["checked_bag",/free checked bag|first bag free|second bag free/i],["companion_certificate_renewal",/companion certificate/i],["free_night_reward_annual",/annual free night|free night award every year|free night reward.*every year/i],["global_entry_tsa",/Global Entry|TSA PreCheck|NEXUS/i],["clear",/CLEAR\+? Credit/i],["hotel_status",/complimentary .* status|automatic .* status/i],["elite_night_credits",/elite night credits|qualifying night credits/i],["anniversary_miles",/anniversary (?:miles|points)/i],["travel_credit",/travel credit/i],["premium_hotel_collection",/Renowned Hotels and Resorts/i],["award_discount_annual",/anniversary[^.]{0,100}award flight discount|annual 10,000-mile award flight discount/i],["seat_benefits",/Preferred seats?|Extra Legroom seat/i],["boarding_benefits",/boarding benefit|priority boarding|preferred boarding|Zone \d+ Priority Boarding/i],["companion_pass_boost",/Companion Pass[^.]{0,100}qualifying points boost/i],["omni_champion_status",/Omni Hotels[^.]{0,100}Champion Status/i],["loyalty_point_bonus_milestones",/10,000 Loyalty Point bonus[^.]{0,120}(?:50,000|90,000|165,000|240,000)/i],["rotating_5x_categories",/5%[^.]{0,200}(?:bonus categories|categories)[^.]{0,200}(?:quarter|three months)|(?:quarter|three months)[^.]{0,200}5%/i],["reserve_75k_benefits",/75,?000[^.]{0,260}(?:Southwest|Explorist|Diamond Elite|A-List)|(?:Southwest|Explorist|Diamond Elite|A-List)[^.]{0,260}75,?000/i]];
function tags(t:string){return uniq(TAGS.filter(x=>x[1].test(t)).map(x=>x[0]))}
function near(t:string,re:RegExp){const m=re.exec(t);if(!m)return null;const s=t.slice(Math.max(0,m.index-180),Math.min(t.length,m.index+m[0].length+180));const a=[...s.matchAll(/\$\s*([0-9][0-9,]*)/g)].map(x=>amount(x[1])).filter(x=>x!=null) as number[];return a.length?Math.max(...a):null}
function credits(t:string){const o:any={};for(const [k,re]of [["dining_credit",/dining credit/i],["resy_credit",/Resy .*credit/i],["uber_cash",/Uber Cash/i],["rideshare_credit",/rideshare .*credit/i],["hotel_credit",/hotel .*credit/i],["capital_one_travel_credit",/Capital One Travel credit/i],["travel_credit",/travel credit/i],["airline_fee_credit",/airline fee credit/i],["flight_credit",/flight credit/i],["clear",/CLEAR\+? Credit/i],["digital_entertainment_credit",/digital entertainment.*credit/i],["dunkin_credit",/Dunkin[’\']? Credit/i],["resort_credit",/resort credit/i]] as [string,RegExp][]) {const v=near(t,re);if(v&&v<=10000)o[k]=v}return o}
function namedAnnualCredit(t:string,res:RegExp[]){for(const re of res){const m=t.match(re);if(m){const v=amount(m[1]);if(v!=null&&v>=0&&v<=10000)return v}}return null}
function cardRecurringCredits(t:string,id:string){
  const flexSpecific=["amex_green","amex_gold","amex_platinum","chase_preferred","chase_freedom_unlimited","chase_freedom_flex","chase_freedom_rise","chase_reserve","venture_one","venture","venture_x"].includes(id);
  const o:any=flexSpecific||id.startsWith("marriott_")||id.startsWith("delta_")?{}:{...credits(t)};
  const put=(k:string,res:RegExp[])=>{const v=namedAnnualCredit(t,res);if(v!=null)o[k]=v};
  if(id==="amex_green"){
    put("clear",[/\$\s*([\d,]+)\s+CLEAR\+? Credit/i,/CLEAR\+?[^$]{0,140}\$\s*([\d,]+)/i]);
  }else if(id==="amex_gold"){
    put("dining_credit",[/\$\s*([\d,]+)\s+Dining Credit/i,/Dining Credit[^$]{0,120}\$\s*([\d,]+)/i]);
    put("uber_cash",[/\$\s*([\d,]+)\s+Uber Cash/i,/Uber Cash[^$]{0,120}\$\s*([\d,]+)/i]);
    put("resy_credit",[/\$\s*([\d,]+)\s+Resy Credit/i,/Resy Credit[^$]{0,120}\$\s*([\d,]+)/i]);
    put("dunkin_credit",[/\$\s*([\d,]+)\s+Dunkin[’']? Credit/i,/Dunkin[’']? Credit[^$]{0,120}\$\s*([\d,]+)/i]);
  }else if(id==="amex_platinum"){
    put("hotel_credit",[/\$\s*([\d,]+)\s+Hotel Credit/i,/Hotel Credit[^$]{0,120}\$\s*([\d,]+)/i]);
    put("resy_credit",[/\$\s*([\d,]+)\s+Resy (?:Dining )?Credit/i,/Resy (?:Dining )?Credit[^$]{0,120}\$\s*([\d,]+)/i]);
    put("digital_entertainment_credit",[/\$\s*([\d,]+)\s+Digital Entertainment Credit/i]);
    put("lululemon_credit",[/\$\s*([\d,]+)\s+lululemon Credit/i]);
    put("uber_one_credit",[/\$\s*([\d,]+)\s+Uber One(?: Membership)? Credit/i]);
    put("oura_credit",[/\$\s*([\d,]+)\s+(?:ŌURA|OURA|Oura)(?: Ring)? Credit/i]);
    put("uber_cash",[/\$\s*([\d,]+)\s+Uber Cash/i]);
    put("airline_fee_credit",[/\$\s*([\d,]+)\s+Airline Fee Credit/i]);
    put("equinox_credit",[/\$\s*([\d,]+)\s+Equinox Credit/i]);
    put("clear",[/\$\s*([\d,]+)\s+CLEAR\+? Credit/i,/CLEAR\+? Credit[^$]{0,120}\$\s*([\d,]+)/i]);
    const wm=namedAnnualCredit(t,[/\$\s*([\d,]+)\s+Walmart\+ Credit/i]);
    if(wm!=null)o.walmart_plus_credit=wm;
    else{const m=t.match(/\$\s*([\d.]+)[^$.]{0,100}Walmart\+[^.]{0,100}(?:each month|monthly)|Walmart\+[^$]{0,120}\$\s*([\d.]+)[^.]{0,100}(?:each month|monthly)/i);if(m){const monthly=amount(m[1]||m[2]);if(monthly!=null)o.walmart_plus_credit=Math.round(monthly*12*100)/100}}
  }else if(id==="chase_preferred"){
    delete o.hotel_credit;
    put("chase_travel_hotel_credit",[/\$\s*([\d,]+)\s+Chase Travel hotel credit/i,/Chase Travel hotel credit[^$]{0,140}\$\s*([\d,]+)/i,/\$\s*([\d,]+)[^.]{0,160}(?:statement credits?)[^.]{0,120}hotel stays?[^.]{0,120}Chase Travel/i]);
  }else if(id==="chase_reserve"){
    delete o.hotel_credit;
    put("travel_credit",[/\$\s*([\d,]+)\s+(?:annual )?travel credit/i,/travel credit[^$]{0,120}\$\s*([\d,]+)/i]);
    put("edit_credit",[/\$\s*([\d,]+)\s+(?:credit for stays with )?The Edit/i,/The Edit[^$]{0,140}\$\s*([\d,]+)[^.]{0,100}(?:annually|annual)/i]);
    put("dining_credit",[/\$\s*([\d,]+)\s+Annual Dining Credit/i,/dining credit[^$]{0,120}\$\s*([\d,]+)/i]);
  }else if(id==="venture_x"){
    put("capital_one_travel_credit",[/\$\s*([\d,]+)\s+annual Capital One Travel credit/i,/annual[^$]{0,80}\$\s*([\d,]+)\s+Capital One Travel credit/i,/receive a \$\s*([\d,]+)\s+Capital One Travel credit/i]);
  }else if(id==="aa_globe"){
    put("turo_credit",[/Up to \$\s*([\d,]+) back on Turo/i,/Turo[^.]{0,220}up to \$\s*([\d,]+)[^.]{0,80}(?:annually|annual)/i]);
    put("inflight_credit",[/Up to \$\s*([\d,]+)[^.]{0,120}(?:American Airlines )?Inflight Purchases/i,/inflight purchases[^.]{0,160}up to \$\s*([\d,]+)/i]);
    put("splurge_credit",[/Up to \$\s*([\d,]+) Annual Splurge Credit/i,/Splurge Credit[^.]{0,180}up to \$\s*([\d,]+)/i]);
  }else if(id==="aa_executive"){
    put("aa_vacations_credit",[/Up to \$\s*([\d,]+) back[^.]{0,160}American Airlines Vacation/i,/earn up to \$\s*([\d,]+) in statement credits[^.]{0,160}American Airlines Vacation/i]);
    put("lyft_credit",[/Up to \$\s*([\d,]+) in Lyft credits/i]);
    put("inflight_admirals_credit",[/up to \$\s*([\d,]+) in statement credits[^.]{0,180}(?:inflight|Admirals Club)/i]);
    put("avis_budget_credit",[/Up to \$\s*([\d,]+) back[^.]{0,160}(?:Avis|Budget)/i]);
  }else if(id==="marriott_brilliant"){
    put("dining_credit",[/\$\s*([\d,]+)\s+Brilliant Dining Credit/i,/up to \$\s*([\d,]+)[^.]{0,120}Dining statement credits each calendar year/i]);
  }else if(id==="hilton_surpass"){
    put("hilton_credit",[/\$\s*([\d,]+)\s+Hilton Credit/i,/up to \$\s*([\d,]+)[^.]{0,180}statement credits annually[^.]{0,100}Hilton/i]);
  }else if(id==="hilton_aspire"){
    delete o.resort_credit;delete o.hotel_credit;
    put("hilton_resort_credit",[/\$\s*([\d,]+)\s+Hilton Resort Credit/i,/up to \$\s*([\d,]+)[^.]{0,180}participating Hilton Resorts/i]);
    put("flight_credit",[/\$\s*([\d,]+)\s+Flight Credit/i,/total of up to \$\s*([\d,]+)[^.]{0,100}each year[^.]{0,120}flight/i]);
    put("clear",[/\$\s*([\d,]+)\s+CLEAR\+? Credit/i,/up to \$\s*([\d,]+)[^.]{0,120}CLEAR\+/i]);
  }else if(id.startsWith("united_")){delete o.travel_credit;delete o.hotel_credit;Object.assign(o,unitedRecurringCredits(t,id));
  }else if(id==="delta_gold"||id==="delta_platinum"||id==="delta_reserve"){
    put("rideshare_credit",[/\$\s*([\d,]+)\s+Rideshare Credit/i]);
    put("resy_credit",[/\$\s*([\d,]+)\s+Resy Credit/i]);
    put("delta_stays_credit",[/\$\s*([\d,]+)\s+Delta Stays Credit/i,/Delta Stays Credit[^$]{0,120}\$\s*([\d,]+)/i]);
  }
  return o;
}
function flexibleCaps(t:string,id:string){const base=goldCaps(t,id);if(id==="amex_gold")return base;if(id==="amex_platinum"){const caps:any={};const m=first(t,[/up to \$\s*([\d,]+)\s+on these purchases per calendar year/i,/flights?[^.]{0,160}up to \$\s*([\d,]+)[^.]{0,80}per calendar year/i]);if(m)caps.airfare=amount(m[1]);return{caps,capGroups:{},groupCaps:{},postCapEarn:{airfare:1}}}const capGroups:any={},groupCaps:any={},postCapEarn:any={};if(id==="southwest_plus"&&/\$\s*5,?000[^.]{0,220}(?:gas|grocery)|(?:gas|grocery)[^.]{0,220}\$\s*5,?000/i.test(t)){for(const c of ["grocery","online_grocery","gas_ev"])capGroups[c]="southwest_plus_gas_grocery";groupCaps.southwest_plus_gas_grocery=5000;postCapEarn.grocery=1;postCapEarn.online_grocery=1;postCapEarn.gas_ev=1}if(id==="southwest_premier"&&/\$\s*8,?000[^.]{0,220}(?:grocery|dining)|(?:grocery|dining)[^.]{0,220}\$\s*8,?000/i.test(t)){for(const c of ["dining","grocery","online_grocery"])capGroups[c]="southwest_premier_dining_grocery";groupCaps.southwest_premier_dining_grocery=8000;postCapEarn.dining=1;postCapEarn.grocery=1;postCapEarn.online_grocery=1}if(id==="marriott_boundless"&&/\$\s*6,?000[^.]{0,260}(?:grocery|gas|dining)|(?:grocery|gas|dining)[^.]{0,260}\$\s*6,?000/i.test(t)){for(const c of ["dining","grocery","online_grocery","gas_ev"])capGroups[c]="boundless_everyday";groupCaps.boundless_everyday=6000;postCapEarn.dining=2;postCapEarn.grocery=2;postCapEarn.online_grocery=2;postCapEarn.gas_ev=2}if((id==="marriott_bountiful"||id==="marriott_bevy")&&/\$\s*15,?000[^.]{0,240}(?:restaurants?|grocery|supermarkets?)|(?:restaurants?|grocery|supermarkets?)[^.]{0,240}\$\s*15,?000/i.test(t)){const key=id+"_everyday";for(const c of ["dining","grocery","online_grocery"])capGroups[c]=key;groupCaps[key]=15000;postCapEarn.dining=2;postCapEarn.grocery=2;postCapEarn.online_grocery=2}return{caps:{},capGroups,groupCaps,postCapEarn}}
function unitedRecurringCredits(t:string,id:string){
  const o:any={};const put=(k:string,res:RegExp[])=>{const v=namedAnnualCredit(t,res);if(v!=null)o[k]=v};
  if(id==="united_explorer"){
    put("united_hotels_credit",[/Up to \$\s*([\d,]+) in (?:United )?Hotels? credits/i,/up to \$\s*([\d,]+)[^.]{0,100}prepaid hotel stays purchased directly through United/i]);
    put("rideshare_credit",[/Up to \$\s*([\d,]+) in credits on rideshare/i]);
    put("avis_budget_credit",[/Up to \$\s*([\d,]+) in United travel credits[^.]{0,120}Avis or Budget/i]);
    put("instacart_credit",[/Up to \$\s*([\d,]+) in Instacart credits/i]);
    put("jsx_credit",[/Up to \$\s*([\d,]+) in credits on JSX/i,/up to \$\s*([\d,]+) back as a statement credit[^.]{0,160}JSX/i]);
  }else if(id==="united_quest"){
    put("united_travel_credit",[/\$\s*([\d,]+) United travel credit/i]);
    put("renowned_hotels_credit",[/Up to \$\s*([\d,]+) in credits annually[^.]{0,150}Renowned Hotels/i,/up to \$\s*([\d,]+) back[^.]{0,150}Renowned Hotels/i]);
    put("rideshare_credit",[/Up to \$\s*([\d,]+) in credits each calendar year[^.]{0,100}rideshare/i]);
    put("avis_budget_credit",[/Up to \$\s*([\d,]+) in United travel credits annually[^.]{0,120}Avis or Budget/i]);
    put("instacart_credit",[/Up to \$\s*([\d,]+) Instacart credits/i]);
    put("jsx_credit",[/Up to \$\s*([\d,]+) in credits annually[^.]{0,120}JSX/i]);
  }else if(id==="united_club"){
    put("renowned_hotels_credit",[/Up to \$\s*([\d,]+) in credits annually[^.]{0,150}Renowned Hotels/i,/up to \$\s*([\d,]+) back[^.]{0,150}Renowned Hotels/i]);
    put("rideshare_credit",[/Up to \$\s*([\d,]+) in credits on rideshare/i]);
    put("avis_budget_credit",[/Up to \$\s*([\d,]+) in United travel credits[^.]{0,120}Avis or Budget/i]);
    put("instacart_credit",[/Up to \$\s*([\d,]+) in Instacart Credits/i]);
    put("jsx_credit",[/Up to \$\s*([\d,]+) in credits on JSX/i,/up to \$\s*([\d,]+) back[^.]{0,160}JSX/i]);
  }
  return o;
}
function genericSpendRewards(t:string,id:string){
  const out:any[]=[];const critical=parseMarriottCardCriticalFacts(t,id);if(critical.spendReward)out.push(critical.spendReward);
  if(id==="united_explorer"){
    if(/\$100 United[^.]{0,80}travel credit[^.]{0,180}spend \$10,000/i.test(t)||/spend \$10,000[^.]{0,180}\$100[^.]{0,80}TravelBank/i.test(t))out.push({amount:10000,benefit:"united_travelbank_100",cashValue:100});
    if(/10,000-mile award flight discount[^.]{0,180}spending \$20,000/i.test(t))out.push({amount:20000,benefit:"award_discount_10k",valuePoints:10000,currency:"united_miles"});
  }else if(id==="united_quest"){
    if(/10,000-mile award flight discount[^.]{0,180}spending \$20,000/i.test(t))out.push({amount:20000,benefit:"award_discount_10k",valuePoints:10000,currency:"united_miles"});
    if(/2 global Economy Plus[^.]{0,100}seat upgrades[^.]{0,160}spending \$40,000/i.test(t))out.push({amount:40000,benefit:"economy_plus_upgrades_2"});
  }else if(id==="united_club"){
    if(/10,000-mile award flight discount[^.]{0,180}\$20,000 in purchases/i.test(t)){out.push({amount:20000,benefit:"award_discount_10k_first",valuePoints:10000,currency:"united_miles"});out.push({amount:40000,benefit:"award_discount_10k_second",valuePoints:10000,currency:"united_miles"});}
    if(/All Access[^.]{0,180}\$50,000|\$50,000[^.]{0,180}All Access/i.test(t))out.push({amount:50000,benefit:"united_club_all_access"});
  }
  if(id==="united_gateway"&&/(?:spend|after you spend)[^.]{0,80}\$10,?000|\$10,?000[^.]{0,180}(?:award|checked bags?)/i.test(t)){out.push({amount:10000,benefit:"gateway_award_discount_10_percent"});out.push({amount:10000,benefit:"gateway_two_checked_bags"})}
  if(id==="delta_gold"&&/(?:spend|after you spend)[^.]{0,80}\$10,?000[^.]{0,180}\$200[^.]{0,100}(?:Delta )?Flight Credit|\$200[^.]{0,100}(?:Delta )?Flight Credit[^.]{0,180}\$10,?000/i.test(t))out.push({amount:10000,benefit:"delta_flight_credit_200",cashValue:200});
  if(id==="aa_platinum_select"&&/(?:spend|after you spend)[^.]{0,80}\$20,?000[^.]{0,180}\$125[^.]{0,100}(?:American Airlines )?flight discount|\$125[^.]{0,100}flight discount[^.]{0,180}\$20,?000/i.test(t))out.push({amount:20000,benefit:"aa_flight_discount_125",cashValue:125,renewalRequired:true});
  if((id==="marriott_bountiful"||id==="marriott_bevy")&&/(?:Free Night Award)[^.]{0,240}\$15,?000|\$15,?000[^.]{0,240}Free Night Award/i.test(t))out.push({amount:15000,benefit:"free_night_award_50k",valuePoints:50000,currency:"marriott_points"});
  if(id==="aa_executive"&&/spend \$150,000[^.]{0,180}5 AAdvantage[^.]{0,100}miles/i.test(t))out.push({amount:150000,benefit:"aa_5x_eligible_aa_remainder"});
  if(id==="chase_reserve"){const threshold=/spend \$\s*75,?000[^.]{0,160}(?:calendar year|each calendar year)|\$\s*75,?000[^.]{0,160}(?:calendar year|each calendar year)/i.test(t),sw=/\$\s*500[^.]{0,180}Southwest Airlines[^.]{0,120}(?:Chase Travel|statement credits?)|Southwest Airlines[^.]{0,180}\$\s*500[^.]{0,120}(?:Chase Travel|statement credits?)/i.test(t);if(threshold&&sw)out.push({amount:75000,benefit:"southwest_chase_travel_credit_500",cashValue:500});}
  return out;
}
function rotatingBonus(t:string,id:string){if(id!=="chase_freedom_flex")return{};const o:any={};if(/5%[^.]{0,180}(?:bonus categories|different places|categories)[^.]{0,180}(?:quarter|three months)|(?:quarter|three months)[^.]{0,180}5%/i.test(t))o.rate=5;const cap=first(t,[/\$\s*1,?500[^.]{0,140}(?:quarter|three months)/i]);if(cap)o.quarterlyCap=1500;if(/activate|activation/i.test(t))o.activationRequired=true;if(o.rate)o.dynamicCategories=true;return o}
function statusMilestoneRewards(t:string,id:string){
  if(id!=="aa_executive")return[];
  const out:any[]=[];for(const threshold of [50000,90000,165000,240000]){
    const label=threshold.toLocaleString("en-US"),re=new RegExp("10,000 Loyalty Point bonus[^.]{0,160}"+label+"|"+label+"[^.]{0,160}10,000 Loyalty Point bonus","i");
    if(re.test(t))out.push({metric:"loyaltyPoints",threshold,bonus:10000});
  }return out;
}
function annualPointCertificates(t:string,id:string){
  const out:any[]=[];
  if(id==="united_quest"&&(/Starting with your first (?:Cardmember )?anniversary[^.]{0,300}(?:every anniversary thereafter|each anniversary)[^.]{0,360}10,000-mile (?:award flight )?discount/i.test(t)||/10,000-mile (?:award flight )?discount[^.]{0,360}(?:first (?:Cardmember )?anniversary|every anniversary thereafter)/i.test(t)))out.push({benefit:"award_discount_10k_annual",capPoints:10000,currency:"united_miles",renewalRequired:true});
  const critical=parseMarriottCardCriticalFacts(t,id);if(critical.annualPointCertificate)out.push(critical.annualPointCertificate);
  return out;
}
function annualCategoryCertificates(t:string,id:string){
  const out:any[]=[];
  if(id==="hyatt_consumer"){const annual=/(?:anniversary|each year|every year)[\s\S]{0,420}(?:Category|Categories)\s*1\s*[-–]\s*4[^.]{0,220}(?:Free Night|free night)|(?:Free Night|free night)[\s\S]{0,420}(?:Category|Categories)\s*1\s*[-–]\s*4[\s\S]{0,300}(?:anniversary|each year|every year)/i.test(t);if(annual)out.push({benefit:"free_night_award_cat1_4",maxCategory:4,renewalRequired:true,quantified:false});}
  return out;
}
function annualQualitativeCertificates(t:string,id:string){
  const out:any[]=[];
  if(id==="hilton_aspire"){
    const annual=/Annual Free Night Reward[\s\S]{0,320}(?:every year|Card renewal)|(?:every year|Card renewal)[\s\S]{0,320}Annual Free Night Reward/i.test(t);
    if(annual)out.push({benefit:"free_night_reward_annual",renewalRequired:true,quantified:false});
  }
  return out;
}
function qualitativeSpendRewards(t:string,id:string){
  const out:any[]=[];
  if(id==="hyatt_consumer"){const threshold=/(?:spend|purchases?)[\s\S]{0,220}\$\s*15,?000[\s\S]{0,420}(?:additional|extra|another)[\s\S]{0,180}(?:Free Night|free night)[\s\S]{0,260}(?:Category|Categories)\s*1\s*[-–]\s*4|(?:additional|extra|another)[\s\S]{0,180}(?:Free Night|free night)[\s\S]{0,260}(?:Category|Categories)\s*1\s*[-–]\s*4[\s\S]{0,420}\$\s*15,?000/i.test(t);if(threshold)out.push({amount:15000,benefit:"free_night_award_cat1_4_threshold",maxCategory:4,quantified:false});}
  if(id==="hilton_surpass"&&(/Free Night Reward[\s\S]{0,260}\$\s*15,?000|\$\s*15,?000[\s\S]{0,260}Free Night Reward/i.test(t)))out.push({amount:15000,benefit:"free_night_reward_15k",quantified:false});
  if(id==="hilton_aspire"){
    if(/Free Night Reward[\s\S]{0,260}\$\s*30,?000|\$\s*30,?000[\s\S]{0,260}Free Night Reward/i.test(t))out.push({amount:30000,benefit:"free_night_reward_30k",quantified:false});
    if(/(?:additional|another) Free Night Reward[\s\S]{0,420}(?:\$\s*60,?000|totaling\s+\$\s*60,?000)|(?:\$\s*60,?000|totaling\s+\$\s*60,?000)[\s\S]{0,420}(?:additional|another) Free Night Reward/i.test(t))out.push({amount:60000,benefit:"free_night_reward_60k",quantified:false});
  }
  if(id==="chase_reserve"&&/spend \$\s*75,?000[^.]{0,180}(?:calendar year|each calendar year)|\$\s*75,?000[^.]{0,180}(?:calendar year|each calendar year)/i.test(t)){
    if(/Explorist Status[^.]{0,120}(?:World of Hyatt)|World of Hyatt[^.]{0,120}Explorist Status/i.test(t))out.push({amount:75000,benefit:"hyatt_explorist_status_threshold",quantified:false});
    if(/Diamond Elite Status[^.]{0,120}IHG|IHG[^.]{0,120}Diamond Elite Status/i.test(t))out.push({amount:75000,benefit:"ihg_diamond_status_threshold",quantified:false});
    if(/A-List Status[^.]{0,160}Southwest|Southwest[^.]{0,160}A-List Status/i.test(t))out.push({amount:75000,benefit:"southwest_alist_status_threshold",quantified:false});
    if(/\$\s*250[^.]{0,160}The Shops at Chase|The Shops at Chase[^.]{0,160}\$\s*250/i.test(t))out.push({amount:75000,benefit:"shops_at_chase_credit_250",quantified:false});
  }
  return out;
}
function temporaryBenefits(t:string,id:string){
  const out:any[]=[];
  if(id==="chase_preferred"){
    if(/Apple TV[\s\S]{0,1600}(?:activation|activate|activated)[\s\S]{0,500}(?:12\/31\/2026|December 31, 2026)|(?:12\/31\/2026|December 31, 2026)[\s\S]{0,800}Apple TV/i.test(t))out.push({benefit:"apple_tv_subscription_temporary",activationDeadline:"2026-12-31",durationMonths:12,recurringEconomicValue:0});
    if(/DashPass[^.]{0,260}(?:12 months|one year)[^.]{0,260}(?:12\/31\/2027|December 31, 2027)|(?:12\/31\/2027|December 31, 2027)[^.]{0,260}DashPass/i.test(t))out.push({benefit:"dashpass_membership_temporary",activationDeadline:"2027-12-31",durationMonths:12,recurringEconomicValue:0});
    if(/5x[^.]{0,180}Lyft[^.]{0,180}(?:9\/30\/2027|September 30, 2027)|Lyft[^.]{0,180}5x[^.]{0,180}(?:9\/30\/2027|September 30, 2027)/i.test(t))out.push({benefit:"lyft_5x_temporary",expires:"2027-09-30",recurringEconomicValue:0});
    if(/5x[^.]{0,180}Peloton[^.]{0,180}(?:12\/31\/2027|December 31, 2027)|Peloton[^.]{0,180}5x[^.]{0,180}(?:12\/31\/2027|December 31, 2027)/i.test(t))out.push({benefit:"peloton_5x_temporary",expires:"2027-12-31",recurringEconomicValue:0});
  }else if(id==="chase_reserve"){
    if(/Apple TV[\s\S]{0,900}(?:6\/22\/2027|6\/22\/27)|(?:\$288|288)[\s\S]{0,500}Apple TV[\s\S]{0,500}(?:6\/22\/2027|6\/22\/27)/i.test(t))out.push({benefit:"apple_tv_music_temporary",advertisedAnnualValue:288,expires:"2027-06-22",recurringEconomicValue:0});
    if(/DashPass[\s\S]{0,900}(?:\$120|120)[\s\S]{0,900}(?:12\/31\/2027|December 31, 2027)|(?:12\/31\/2027|December 31, 2027)[\s\S]{0,900}DashPass/i.test(t))out.push({benefit:"dashpass_membership_temporary",advertisedAnnualValue:120,activationDeadline:"2027-12-31",durationMonths:12,recurringEconomicValue:0});
    if(/(?:\$300|300)[\s\S]{0,900}DoorDash[\s\S]{0,900}(?:12\/31\/2027|December 31, 2027)|DoorDash[\s\S]{0,900}(?:\$300|300)[\s\S]{0,900}(?:12\/31\/2027|December 31, 2027)/i.test(t))out.push({benefit:"doordash_promos_temporary",advertisedAnnualValue:300,expires:"2027-12-31",recurringEconomicValue:0});
    if(/(?:\$300|300)[^.]{0,180}StubHub[^.]{0,220}(?:12\/31\/2027|December 31, 2027)|StubHub[^.]{0,220}(?:\$300|300)[^.]{0,220}(?:12\/31\/2027|December 31, 2027)/i.test(t))out.push({benefit:"stubhub_credit_temporary",advertisedAnnualValue:300,expires:"2027-12-31",recurringEconomicValue:0});
    if(/(?:\$120|120)[^.]{0,180}Lyft[^.]{0,220}(?:9\/30\/2027|September 30, 2027)|Lyft[^.]{0,220}(?:\$120|120)[^.]{0,220}(?:9\/30\/2027|September 30, 2027)/i.test(t))out.push({benefit:"lyft_credit_5x_temporary",advertisedAnnualValue:120,expires:"2027-09-30",recurringEconomicValue:0});
    if(/(?:\$120|120)[^.]{0,180}Peloton[^.]{0,220}(?:12\/31\/2027|December 31, 2027)|Peloton[^.]{0,220}(?:\$120|120)[^.]{0,220}(?:12\/31\/2027|December 31, 2027)/i.test(t))out.push({benefit:"peloton_credit_10x_temporary",advertisedAnnualValue:120,expires:"2027-12-31",recurringEconomicValue:0});
  }
  return out;
}
function bonus(t:string,id:string){if(!id||id.startsWith("marriott_"))return 0;const m=first(t,[/(\d{1,3}(?:,\d{3})+)\s+anniversary\s+(?:miles|points)/i,/anniversary[^0-9]{0,80}(\d{1,3}(?:,\d{3})+)\s+(?:miles|points)/i,/(\d{1,3}(?:,\d{3})+)\s+points\s+every year[^.]{0,100}(?:Cardmember )?anniversary/i]);return m?amount(m[1]):0}
function hotelStatus(t:string,id:string){const o:any={};const critical=parseMarriottCardCriticalFacts(t,id);if(critical.automaticTier)o.automaticTier=critical.automaticTier;for(const [tier,re]of [["Diamond",/complimentary (?:Hilton Honors )?Diamond status/i],["Gold",/complimentary (?:Hilton Honors )?Gold status/i],["Silver",/complimentary (?:Hilton Honors )?Silver status/i],["Platinum Elite",/(?:automatic|complimentary) (?:Marriott Bonvoy )?Platinum Elite status/i],["Gold Elite",/(?:automatic|complimentary) (?:Marriott Bonvoy )?Gold Elite status/i],["Silver Elite",/(?:automatic|complimentary) (?:Marriott Bonvoy )?Silver Elite status/i],["Discoverist",/(?:complimentary|receive|automatic|immediate|enjoy immediate|will receive) (?:World of Hyatt )?Discoverist status/i]] as [string,RegExp][])if(!o.automaticTier&&re.test(t)){o.automaticTier=tier;break}const n=first(t,[/(?:receive|get)\s+(\d+)\s+(?:World of Hyatt )?(?:elite |tier[- ]?)?qualifying night credits?/i,/(\d+)\s+(?:World of Hyatt )?Tier[- ]Qualifying Night Credits?/i,/(\d+)\s+Elite Night Credits/i]);if(n)o.annualNights=Number(n[1]);const b=first(t,[/(?:one\s*\(\s*)?(\d+)\s*\)?\s+(?:additional )?Elite Night Credit[^.]{0,140}(?:for every|every time you spend)\s+\$\s*([\d,]+)/i,/(\d+)\s+(?:additional\s+)?(?:World of Hyatt )?(?:tier[- ]?)?qualifying night credits?[^.]{0,180}(?:for every|every time you spend)\s+\$\s*([\d,]+)/i]);if(b){o.nightsPerBlock=Number(b[1]);o.spendBlock=amount(b[2])}const st=first(t,[/spend\s+\$\s*([\d,]+)[^.]{0,180}(?:earn|upgrade to|receive)[^.]{0,80}(Silver|Gold|Diamond|Platinum)(?: Elite)? status/i]);if(st)o.spendTier={amount:amount(st[1]),tier:st[2]+(id.startsWith("marriott_")&&!/Elite/i.test(st[2])?" Elite":"")};return o}
function companionCertificate(t:string,id:string){
  const o:any={};
  if(id==="aa_globe"){
    const fee=first(t,[/costs?\s+\$\s*([\d,]+)\s+for the ticketing fee/i,/ticketing fee[^$]{0,80}\$\s*([\d,]+)/i]);if(fee)o.ticketingFee=amount(fee[1]);
    if(/single qualifying round-trip main cabin domestic flight/i.test(t)){o.usesPerYear=1;o.tripType="round_trip";o.cabin="main_cabin";o.geography="domestic";o.domesticEligible=true;}
    if(/starting in your second cardmembership year[^.]{0,180}(?:renewed|renew)/i.test(t))o.renewalRequired=true;
    return o;
  }
  if(id!=="delta_platinum"&&id!=="delta_reserve")return o;
  const certSignal=/Companion Certificate/i.test(t),renewal=/each year (?:after|following) (?:Card )?renewal|each year after Card renewal|following your Card renewal/i.test(t);
  if(certSignal&&renewal){o.usesPerYear=1;o.tripType="round_trip";o.renewalRequired=true;}
  if(certSignal&&/round-trip flight within the U\.S\.|round-trip domestic flights/i.test(t)){o.domesticEligible=true;o.geography="us_mexico_caribbean_central_america";}
  const domestic=first(t,[/no more than\s+\$\s*([\d,]+)\s+for round-trip domestic flights/i,/round-trip domestic flights[^$]{0,120}\$\s*([\d,]+)/i]);if(domestic)o.domesticMaxTaxesFees=amount(domestic[1]);
  const intl=first(t,[/no more than\s+\$\s*([\d,]+)\s+for round-trip international flights/i,/round-trip international flights[^$]{0,120}\$\s*([\d,]+)/i]);if(intl)o.internationalMaxTaxesFees=amount(intl[1]);
  if(certSignal&&o.usesPerYear===1)o.cabin=id==="delta_platinum"?"main_cabin":"first_premium_select_comfort_main";
  return o;
}
function status(t:string,id:string){const o:any={};if(id.startsWith("delta_")){Object.assign(o,parseDeltaCardStatus(t,id))}else if(id.startsWith("united_")){const d=first(t,[/1\s+PQP[^.]{0,100}(?:for every|per)\s+\$\s*(\d+)/i]);if(d)o.spendDivisor=Number(d[1]);const c=first(t,[/up to\s+([\d,]+)\s+PQP/i]);if(c)o.annualCap=amount(c[1]);const b=first(t,[/([\d,]+)\s+Card Bonus PQP/i]);if(b){o.annualBonus=amount(b[1]);o.bonusRequiresPriorYearOpen=true}}else if(id.startsWith("southwest_")){const q=first(t,[/([\d,]+)\s+TQPs?\s+for each\s+\$\s*([\d,]+)/i]);if(q){o.tqpPerBlock=amount(q[1]);o.spendBlock=amount(q[2])}const cp=first(t,[/([\d,]+)\s+Companion Pass[^.]{0,120}qualifying points?[^.]{0,100}(?:boost|every year|annually)/i,/Companion Pass[^.]{0,140}(?:boost|qualifying points?)[^.]{0,100}([\d,]+)/i]);if(cp)o.companionPassBoost=amount(cp[1])}else if(id.startsWith("aa_")){if(/1\s+Loyalty Point[^.]{0,180}(?:\$?1|every 1 eligible AAdvantage.*mile earned from purchases)/i.test(t))o.lpPerEligiblePurchaseDollar=1;if(id==="aa_globe"){const fs=first(t,[/([\d,]+)\s+Loyalty Point bonus after every\s+(\d+)\s+qualifying American Airlines flights?[^.]{0,220}up to\s+([\d,]+)\s+additional Loyalty Points/i]);if(fs){o.flightStreakBonus=amount(fs[1]);o.flightStreakBlock=amount(fs[2]);o.flightStreakAnnualCap=amount(fs[3]);}else{const b=first(t,[/Flight Streak[^.]{0,180}(?:bonus of |earn |Earn a )?([\d,]+)\s+additional Loyalty Points/i,/Earn a\s+([\d,]+)\s+Loyalty Point bonus/i]),blk=first(t,[/after every\s+(\d+)\s+qualifying American Airlines flights?/i]),cap=first(t,[/up to\s+([\d,]+)\s+additional Loyalty Points each status qualification year/i]);if(b)o.flightStreakBonus=amount(b[1]);if(blk)o.flightStreakBlock=amount(blk[1]);if(cap)o.flightStreakAnnualCap=amount(cap[1]);}}}return o}
function cardFacts(id:string,t:string){
  const recurring=cardRecurringCredits(t,id),annualCategory=annualCategoryCertificates(t,id),annualQualitative=annualQualitativeCertificates(t,id),qualitativeSpend=qualitativeSpendRewards(t,id);
  const derivedTags=uniq([
    ...tags(t),...Object.keys(recurring),...annualCategory.map((x:any)=>x.benefit),...annualQualitative.map((x:any)=>x.benefit),...qualitativeSpend.map((x:any)=>x.benefit),
    ...(id.startsWith("hilton_")&&/(?:complimentary|enjoy) (?:Hilton Honors™? )?(?:Silver|Gold|Diamond) status/i.test(t)?["hotel_status"]:[]),
    ...(id==="hilton_aspire"&&/\$\s*100\s+Property Credit/i.test(t)?["hilton_property_credit"]:[]),
    ...((id==="hilton_surpass"||id==="hilton_aspire")&&/National Car Rental[\s\S]{0,180}Emerald Club Executive/i.test(t)?["national_executive_status"]:[]),
    ...(id==="hyatt_consumer"&&/(?:receive|automatic|immediate|enjoy immediate|will receive)[^.]{0,120}(?:World of Hyatt )?Discoverist status/i.test(t)?["hotel_status"]:[]),
    ...(id==="united_explorer"&&/(?:two|2)[^.]{0,160}United Club[^.]{0,120}one-time passes|United Club[^.]{0,160}(?:two|2)[^.]{0,120}one-time passes/i.test(t)?["lounge_passes"]:[]),
    ...(id==="aa_globe"&&/Admirals Club[^.]{0,160}Globe[^.]{0,80}Passes/i.test(t)?["lounge_passes"]:[]),
    ...(id==="marriott_brilliant"&&/\$100 Property Credit|Ritz-Carlton[^.]{0,180}St\. Regis/i.test(t)?["ritz_st_regis_property_credit"]:[]),
    ...(id==="marriott_brilliant"&&/Brilliant Earned Choice Award/i.test(t)?["brilliant_earned_choice_award"]:[]),
    ...((id==="marriott_bountiful"||id==="marriott_bevy")&&/1,000[^.]{0,120}bonus points[^.]{0,120}(?:per|each) eligible stay/i.test(t)?["paid_stay_bonus_1000"]:[]),
    ...(/trip cancellation|trip interruption|auto rental collision|travel insurance|Trip Delay Insurance|Baggage Insurance/i.test(t)?["travel_protections"]:[]),
    ...(/Lifestyle Collection/i.test(t)?["lifestyle_collection"]:[]),
    ...(/Hertz(?:®|™)?\s*Five Star/i.test(t)?["hertz_five_star"]:[]),
    ...(/Hertz[^.]{0,120}(?:status upgrade|Gold\+.*upgrade)/i.test(t)?["hertz_status"]:[]),
    ...(/The Edit by Chase Travel/i.test(t)?["premium_hotel_booking"]:[])
  ]);
  const cap=flexibleCaps(t,id),rb=rotatingBonus(t,id);
  if(rb.rate&&!derivedTags.includes("rotating_5x_categories"))derivedTags.push("rotating_5x_categories");
  const critical=parseMarriottCardCriticalFacts(t,id);
  const pointCerts=annualPointCertificates(t,id);
  if(critical.annualPointCertificate&&!pointCerts.some((x:any)=>x?.benefit===critical.annualPointCertificate.benefit))pointCerts.push(critical.annualPointCertificate);
  const spend=genericSpendRewards(t,id);
  if(critical.spendReward&&!spend.some((x:any)=>x?.benefit===critical.spendReward.benefit))spend.push(critical.spendReward);
  const multi=multiYearCredits(t,id);
  if(critical.trustedTraveler)multi.trusted_traveler=critical.trustedTraveler;
  const hs=hotelStatus(t,id);
  if(critical.automaticTier)hs.automaticTier=critical.automaticTier;
  const f:any={
    bookingEarn:bookingEarn(t,id),caps:cap.caps,capGroups:cap.capGroups,groupCaps:cap.groupCaps,postCapEarn:cap.postCapEarn,
    benefitTags:derivedTags,recurringCredits:recurring,multiYearCredits:multi,annualBonusPoints:bonus(t,id),annualPointCertificates:pointCerts,
    annualCategoryCertificates:annualCategory,annualQualitativeCertificates:annualQualitative,qualitativeSpendRewards:qualitativeSpend,
    temporaryBenefits:temporaryBenefits(t,id),hotelStatus:hs,hotelStatusByProgram:{},status:status(t,id),transferRules:transferRules(t,id),
    transferAccess:transferAccess(t,id),rotatingBonus:rb,spendRewards:spend,statusMilestoneRewards:statusMilestoneRewards(t,id),
    companionCertificate:companionCertificate(t,id),verified:true
  };
  const unresolved:string[]=[];
  const af=critical.annualFee??fee(t,id);
  if(af==null)unresolved.push("annualFee");else f.annualFee=af;
  const er=parseMarriottCardRewards(t,id)||cardEarn(t,id);
  if(!er)unresolved.push("earn");else f.earn=er;
  if(id==="amex_platinum"&&/Marriott Bonvoy[^.]{0,100}Gold Elite/i.test(t))f.hotelStatusByProgram.marriott="Gold Elite";
  if(id==="amex_platinum"&&/Hilton Honors[^.]{0,100}Gold/i.test(t))f.hotelStatusByProgram.hilton="Gold";
  return{facts:f,unresolved};
}

const FLEX_FACT_LIMITS:any={
  amex_green:{tags:["clear","travel_protections"],recurring:["clear"]},
  amex_gold:{tags:["dining_credit","uber_cash","resy_credit","dunkin_credit","premium_hotel_booking","hertz_five_star","travel_protections"],recurring:["dining_credit","uber_cash","resy_credit","dunkin_credit"],booking:true,caps:true},
  amex_platinum:{tags:["lounge","premium_hotel_booking","hotel_credit","hotel_status","airline_fee_credit","clear","global_entry_tsa","resy_credit","digital_entertainment_credit"],recurring:["hotel_credit","uber_cash","uber_one_credit","digital_entertainment_credit","resy_credit","airline_fee_credit","clear","walmart_plus_credit","lululemon_credit","oura_credit","equinox_credit"],multi:["trusted_traveler"],booking:true,caps:true,hotelStatusByProgram:["marriott","hilton"]},
  chase_preferred:{tags:["chase_travel_hotel_credit","trusted_traveler_credit","global_entry_tsa","travel_protections"],recurring:["chase_travel_hotel_credit"],multi:["trusted_traveler"],booking:true,transferRules:true,transferAccess:true,temporary:["apple_tv_subscription_temporary","dashpass_membership_temporary","lyft_5x_temporary","peloton_5x_temporary"]},
  chase_freedom_unlimited:{tags:["travel_protections"],booking:true,transferAccess:true},
  chase_freedom_flex:{tags:["travel_protections","rotating_5x_categories"],booking:true,transferAccess:true,rotatingBonus:true},
  chase_reserve:{tags:["lounge","travel_credit","travel_protections","premium_hotel_booking","global_entry_tsa","reserve_75k_benefits"],recurring:["travel_credit","edit_credit","dining_credit"],multi:["trusted_traveler"],booking:true,transferRules:true,transferAccess:true,temporary:["apple_tv_music_temporary","dashpass_membership_temporary","doordash_promos_temporary","stubhub_credit_temporary","lyft_credit_5x_temporary","peloton_credit_10x_temporary"],qualitative:["hyatt_explorist_status_threshold","ihg_diamond_status_threshold","southwest_alist_status_threshold","shops_at_chase_credit_250"],spend:["southwest_chase_travel_credit_500"]},
  venture_one:{tags:["hertz_five_star","travel_protections"],booking:true},
  venture:{tags:["lifestyle_collection","global_entry_tsa","hertz_five_star","travel_protections"],multi:["trusted_traveler"],booking:true},
  venture_x:{tags:["lounge","capital_one_travel_credit","anniversary_miles","premium_hotel_collection","global_entry_tsa","hertz_status","travel_protections"],recurring:["capital_one_travel_credit"],multi:["trusted_traveler"],booking:true,annualBonus:true}
};
function pickKeys(o:any,keys:string[]=[]){const out:any={};for(const k of keys)if(o&&Object.prototype.hasOwnProperty.call(o,k))out[k]=o[k];return out}
function filterBenefits(rows:any[],allowed:string[]=[]){const set=new Set(allowed);return(Array.isArray(rows)?rows:[]).filter((x:any)=>set.has(String(x?.benefit||"")))}
function sanitizeFlexCardFacts(id:string,f:any){
  const lim=FLEX_FACT_LIMITS[id];if(!lim)return f;
  const out:any={verified:true};
  if(Object.prototype.hasOwnProperty.call(f,"annualFee"))out.annualFee=f.annualFee;
  if(f.earn)out.earn=f.earn;
  if(lim.booking&&f.bookingEarn)out.bookingEarn=f.bookingEarn;
  if(lim.caps){out.caps=f.caps||{};out.capGroups=f.capGroups||{};out.groupCaps=f.groupCaps||{};out.postCapEarn=f.postCapEarn||{}}
  out.benefitTags=(f.benefitTags||[]).filter((x:string)=>lim.tags.includes(x));
  if(lim.recurring)out.recurringCredits=pickKeys(f.recurringCredits,lim.recurring);
  if(lim.multi)out.multiYearCredits=pickKeys(f.multiYearCredits,lim.multi);
  if(lim.hotelStatusByProgram)out.hotelStatusByProgram=pickKeys(f.hotelStatusByProgram,lim.hotelStatusByProgram);
  if(lim.transferRules)out.transferRules=f.transferRules||{};
  if(lim.transferAccess)out.transferAccess=f.transferAccess||{};
  if(lim.rotatingBonus)out.rotatingBonus=f.rotatingBonus||{};
  if(lim.temporary)out.temporaryBenefits=filterBenefits(f.temporaryBenefits,lim.temporary);
  if(lim.qualitative)out.qualitativeSpendRewards=filterBenefits(f.qualitativeSpendRewards,lim.qualitative);
  if(lim.spend)out.spendRewards=filterBenefits(f.spendRewards,lim.spend);
  if(lim.annualBonus)out.annualBonusPoints=Number(f.annualBonusPoints)||0;
  return out;
}
function airlineTierBenefits(id:string,t:string){
  const rows:any[]=[],put=(tier:string,facts:any)=>{const clean=Object.fromEntries(Object.entries(facts).filter(([,v])=>v!==null&&v!==undefined&&v!==""));if(Object.keys(clean).length)rows.push({tier,...clean,verified:true})};
  if(id==="delta"){
    const earn=/Medallion Mileage Earn[\s\S]{0,900}?7\s+miles? per dollar[\s\S]{0,240}?8\s+miles? per dollar[\s\S]{0,240}?9\s+miles? per dollar[\s\S]{0,240}?11\s+miles? per dollar/i.test(t);
    const choice=/Selection Of:[\s\S]{0,500}?Choose\s+1[\s\S]{0,240}?Choose\s+3/i.test(t)||/select 1 benefit[^.]{0,260}select 3 benefits/i.test(t);
    const voucher=t.match(/Delta Travel Voucher[\s\S]{0,240}?\$\s*([\d,]+)[\s\S]{0,180}?\$\s*([\d,]+)/i);
    const voucherRepeatable=/Delta Travel Voucher[\s\S]{0,3200}?This Choice Benefit may be selected more than once/i.test(t);
    const flight=/Unlimited Complimentary Delta First Upgrades[\s\S]{0,900}?Begins\s+24\s+hours[\s\S]{0,260}?Begins\s+72\s+hours[\s\S]{0,260}?Begins\s+120\s+hours[\s\S]{0,260}?Begins\s+120\s+hours[^\n]{0,120}Priority/i.test(t)&&/Unlimited Complimentary Delta Comfort Upgrades[\s\S]{0,700}?Begins\s+24\s+hours[\s\S]{0,220}?Begins\s+72\s+hours[\s\S]{0,220}?Shortly after ticketing[\s\S]{0,180}?Shortly after ticketing/i.test(t);
    const fees=/Waived Same-Day Confirmed Fees[\s\S]{0,700}?\$75 Fee/i.test(t)&&/Waived Baggage Fees/i.test(t);
    const airport=/Priority Boarding[\s\S]{0,500}?Zone\s*5[\s\S]{0,160}?Zone\s*4[\s\S]{0,160}?Zone\s*4[\s\S]{0,160}?Zone\s*2/i.test(t)&&/Priority Security Line Access/i.test(t)&&/Expedited Baggage Service/i.test(t)&&/CLEAR\+ Annual Membership Discount[\s\S]{0,300}?\$40 off[\s\S]{0,120}?\$40 off[\s\S]{0,120}?\$40 off[\s\S]{0,120}?\$90 off/i.test(t);
    const service=/Dedicated Phone Line[\s\S]{0,500}?Priority[\s\S]{0,160}?High Priority[\s\S]{0,160}?Higher Priority[\s\S]{0,160}?VIP Line/i.test(t);
    const partner=/SkyTeam Status[\s\S]{0,700}?Elite[\s\S]{0,220}?Elite Plus[\s\S]{0,220}?Elite Plus[\s\S]{0,220}?Elite Plus/i.test(t)&&/Miles earned per \$1[\s\S]{0,700}?\b5\b[\s\S]{0,220}?\b6\b[\s\S]{0,220}?\b7\b[\s\S]{0,220}?\b8\b/i.test(t);
    const coverageComplete=earn&&choice&&flight&&fees&&airport&&service&&partner;
    const pv=voucher?amount(voucher[1]):0,dv=voucher?amount(voucher[2]):0;
    const defs:any[]=[
      ["Silver Medallion",{earningRate:7,upgradeWindowHours:24,comfortUpgradeTiming:"24_hours",sameDayConfirmedFee:75,waivedBaggageFees:true,boardingGroup:"Zone 5",prioritySecurity:false,expeditedBaggage:false,clearDiscount:40,customerServiceTier:"priority",skyTeamStatus:"Elite",skyTeamPriorityBaggage:false,skyTeamLoungeAccess:false,hertzEarnRate:5,hertzStatus:"Five Star"}],
      ["Gold Medallion",{earningRate:8,upgradeWindowHours:72,comfortUpgradeTiming:"72_hours",sameDayConfirmedFee:0,waivedBaggageFees:true,boardingGroup:"Zone 4",prioritySecurity:true,expeditedBaggage:true,clearDiscount:40,customerServiceTier:"high_priority",skyTeamStatus:"Elite Plus",skyTeamPriorityBaggage:true,skyTeamLoungeAccess:true,hertzEarnRate:6,hertzStatus:"Five Star"}],
      ["Platinum Medallion",{earningRate:9,upgradeWindowHours:120,comfortUpgradeTiming:"shortly_after_ticketing",sameDayConfirmedFee:0,waivedBaggageFees:true,boardingGroup:"Zone 4",prioritySecurity:true,expeditedBaggage:true,clearDiscount:40,customerServiceTier:"higher_priority",skyTeamStatus:"Elite Plus",skyTeamPriorityBaggage:true,skyTeamLoungeAccess:true,hertzEarnRate:7,hertzStatus:"Presidents Circle",choiceBenefitsCount:1,travelVoucherValue:pv,travelVoucherRepeatable:voucherRepeatable,fixedAnnualValue:voucherRepeatable?pv:0,fixedAnnualValueVerified:!!voucher&&voucherRepeatable,fixedAnnualValueBasis:"repeatable_delta_travel_voucher_choice_floor"}],
      ["Diamond Medallion",{earningRate:11,upgradeWindowHours:120,upgradePriorityWithinTier:true,comfortUpgradeTiming:"shortly_after_ticketing",sameDayConfirmedFee:0,waivedBaggageFees:true,boardingGroup:"Zone 2",prioritySecurity:true,expeditedBaggage:true,clearDiscount:90,customerServiceTier:"vip",skyTeamStatus:"Elite Plus",skyTeamPriorityBaggage:true,skyTeamLoungeAccess:true,hertzEarnRate:8,hertzStatus:"Presidents Circle",choiceBenefitsCount:3,travelVoucherValue:dv,travelVoucherRepeatable:voucherRepeatable,fixedAnnualValue:voucherRepeatable?dv*3:0,fixedAnnualValueVerified:!!voucher&&voucherRepeatable,fixedAnnualValueBasis:"repeatable_delta_travel_voucher_choice_floor"}]
    ];
    for(const[tier,facts]of defs)put(tier,{...facts,coverageComplete,coverageSections:{earn,choice,flight,fees,airport,service,partner}});
  }else if(id==="american"){
    const goldSummary=/Earn 40% more miles and Loyalty Points[^.]{0,220}first checked bag free[^.]{0,140}Group 4/i.test(t);
    const platinumSummary=/Earn 60% more miles and Loyalty Points[^.]{0,220}first 2 checked bags free[^.]{0,140}Group 3/i.test(t);
    const proSummary=/Earn 80% more miles and Loyalty Points[^.]{0,220}first 3 checked bags free[^.]{0,140}Group 2/i.test(t);
    const execSummary=/Earn 120% more miles and Loyalty Points[^.]{0,220}first 3 checked bags free[^.]{0,140}Group 1/i.test(t);
    const goldUpgrade=/24\s+hours before departure for AAdvantage Gold/i.test(t),platinumUpgrade=/48\s+hours before departure for AAdvantage Platinum/i.test(t),proUpgrade=/72\s+hours before departure for AAdvantage Platinum Pro/i.test(t),execUpgrade=/100\s+hours before departure for AAdvantage Executive Platinum/i.test(t);
    const bookingSeats=/AAdvantage Executive Platinum[\s\S]{0,180}AAdvantage Platinum Pro[\s\S]{0,180}AAdvantage Platinum[^.]{0,220}at the time of booking/i.test(t);
    const goldSeats=/AAdvantage Gold[^.]{0,180}within 24 hours of departure/i.test(t);
    const boarding=/Group 1[\s\S]{0,160}AAdvantage Executive Platinum[\s\S]{0,220}Group 2[\s\S]{0,160}AAdvantage Platinum Pro[\s\S]{0,120}oneworld[\s\S]{0,80}Emerald[\s\S]{0,220}Group 3[\s\S]{0,160}AAdvantage Platinum[\s\S]{0,120}oneworld[\s\S]{0,80}Sapphire[\s\S]{0,220}Group 4[\s\S]{0,160}AAdvantage Gold[\s\S]{0,120}oneworld[\s\S]{0,80}Ruby/i.test(t);
    const defs:any[]=[
      ["AAdvantage Gold",{earningBonusPct:40,upgradeWindowHours:24,seating:"main_cabin_extra_within_24h",checkedBags:1,boardingGroup:"group_4",oneworldStatus:"Ruby",coverageComplete:goldSummary&&goldUpgrade&&goldSeats&&boarding}],
      ["AAdvantage Platinum",{earningBonusPct:60,upgradeWindowHours:48,seating:"main_cabin_extra_at_booking",checkedBags:2,boardingGroup:"group_3",oneworldStatus:"Sapphire",priorityBaggage:true,coverageComplete:platinumSummary&&platinumUpgrade&&bookingSeats&&boarding}],
      ["AAdvantage Platinum Pro",{earningBonusPct:80,upgradeWindowHours:72,seating:"main_cabin_extra_at_booking",checkedBags:3,boardingGroup:"group_2",oneworldStatus:"Emerald",priorityBaggage:true,coverageComplete:proSummary&&proUpgrade&&bookingSeats&&boarding}],
      ["AAdvantage Executive Platinum",{earningBonusPct:120,upgradeWindowHours:100,seating:"main_cabin_extra_at_booking",checkedBags:3,boardingGroup:"group_1",oneworldStatus:"Emerald",priorityBaggage:true,coverageComplete:execSummary&&execUpgrade&&bookingSeats&&boarding}]
    ];
    for(const[tier,facts]of defs)put(tier,facts);
  }else if(id==="southwest"){
    const aEarn=/A-List status benefits[\s\S]{0,700}?25% earning bonus/i.test(t),aBag=/1 checked bag free/i.test(t),aBoard=/boarding in Group 1/i.test(t),aSeat=/Preferred or Standard seat at the time of booking[\s\S]{0,260}?Extra Legroom seat within 48 hours/i.test(t),aStandby=/A-List status benefits[\s\S]{0,1200}?Same-day Standby/i.test(t),aPriority=/A-List status benefits[\s\S]{0,1500}?Priority Lane and Express Lane[\s\S]{0,500}?Priority phone support/i.test(t);
    put("A-List",{earningBonusPct:25,checkedBags:1,boardingGroup:"Group 1",seating:"preferred_at_booking_extra_legroom_48h",sameDayStandby:true,priorityLanes:true,priorityPhone:true,coverageComplete:aEarn&&aBag&&aBoard&&aSeat&&aStandby&&aPriority});
    const pEarn=/A-List Preferred status benefits[\s\S]{0,700}?100% earning bonus/i.test(t),pBag=/Two free checked bags/i.test(t),pBoard=/dedicated boarding before Group 1/i.test(t),pSeat=/Extra Legroom[^.]{0,180}time of booking/i.test(t),pDrinks=/Up to two premium drinks/i.test(t),pStandby=/A-List Preferred status benefits[\s\S]{0,1400}?Same-day standby/i.test(t),pPriority=/A-List Preferred status benefits[\s\S]{0,1800}?Priority Lane and Express Lane[\s\S]{0,500}?Priority phone support/i.test(t);
    put("A-List Preferred",{earningBonusPct:100,checkedBags:2,boardingGroup:"before_group_1",seating:"extra_legroom_at_booking",premiumDrinks:2,sameDayStandby:true,priorityLanes:true,priorityPhone:true,coverageComplete:pEarn&&pBag&&pBoard&&pSeat&&pDrinks&&pStandby&&pPriority});
  }else if(id==="united"){
    // April 2026 changed Premier flight-mile earning. Do not use the retired
    // 7x/8x/9x/11x table as a status-value input.
    const silverSeating=/Premier Silver Members[\s\S]{0,1400}?Economy Plus[^.]{0,140}check-in/i.test(t)||/Economy Plus[^.]{0,160}check-in[^.]{0,220}(?:Premier Silver|Silver)/i.test(t);
    const silverUpgrade=/Premier Silver Members[\s\S]{0,1400}?(?:day of departure|24 hours before departure)/i.test(t)||/(?:Premier Silver|Silver elites?)[\s\S]{0,1800}?(?:complimentary Premier upgrades?)[^.]{0,220}(?:day of departure|24 hours before departure)/i.test(t)||/(?:Premier Silver|Silver)[^\n]{0,500}(?:day of departure|24 hours before departure)/i.test(t);
    const silverBag=/(?:Premier Silver|Silver)[\s\S]{0,900}(?:one|1) (?:complimentary|free) (?:70-pound )?checked bag|(?:one|1) (?:complimentary|free) (?:70-pound )?checked bag[\s\S]{0,500}(?:Premier Silver|Silver)/i.test(t);
    put("Premier Silver",{upgradeWindowHours:/24 hours before departure/i.test(t)?24:0,seating:"economy_plus_at_checkin",checkedBags:1,coverageComplete:silverSeating&&silverUpgrade&&silverBag});

    const goldSeating=/Premier Gold Members[\s\S]{0,1400}?Economy Plus[^.]{0,140}booking/i.test(t)||/(?:Premier Gold|Gold elites?)[\s\S]{0,700}?Economy Plus[^.]{0,180}booking/i.test(t)||/Economy Plus[^.]{0,160}booking[^.]{0,220}(?:Premier Gold|Gold)/i.test(t);
    const goldUpgrade=/Premier Gold Members[\s\S]{0,1400}?48 hours before departure/i.test(t)||/(?:Premier Gold|Gold)[^\n]{0,240}48 hours before departure/i.test(t);
    const goldBags=/Premier Gold Members[\s\S]{0,1400}?Two complimentary checked bags/i.test(t)||/(?:Premier Gold|Gold)[^\n]{0,300}(?:two|2) (?:complimentary|free) checked bags/i.test(t);
    put("Premier Gold",{upgradeWindowHours:48,seating:"economy_plus_at_booking_one_companion",checkedBags:2,boardingGroup:"group_1",starAllianceStatus:"gold",coverageComplete:goldSeating&&goldUpgrade&&goldBags});

    const platinum=/Premier Platinum/i.test(t);
    const platinumUpgrade=platinum&&/72 hours before departure/i.test(t);
    const platinumSeating=platinum&&/Economy Plus[\s\S]{0,260}(?:up to )?8 companions|(?:up to )?8 companions[\s\S]{0,260}Economy Plus/i.test(t);
    const platinumBags=platinum&&/(?:three|3)\s+(?:complimentary|free)(?:\s+\d+-pound)?\s+checked bags/i.test(t);
    const platinumPlus=platinum&&/40 PlusPoints/i.test(t);
    put("Premier Platinum",{upgradeWindowHours:72,seating:"economy_plus_at_booking_up_to_8_companions",checkedBags:3,boardingGroup:"group_1",plusPoints:40,coverageComplete:platinumUpgrade&&platinumSeating&&platinumBags&&platinumPlus});

    const oneK=/Premier 1K|Premier 1K®/i.test(t);
    const oneKUpgrade=oneK&&/96 hours before departure/i.test(t);
    const oneKBags=oneK&&/(?:three|3) (?:complimentary|free) checked bags/i.test(t);
    const oneKPlus=oneK&&/280 PlusPoints/i.test(t);
    const oneKPreboard=oneK&&/preboarding|pre-board/i.test(t);
    put("Premier 1K",{upgradeWindowHours:96,seating:"economy_plus_at_booking_up_to_8_companions",checkedBags:3,boardingGroup:"preboarding",plusPoints:320,additionalPlusPointsAt1K:280,coverageComplete:oneKUpgrade&&oneKBags&&oneKPlus&&oneKPreboard});
  }
  return rows;
}
function hotelTierBenefits(id:string,t:string){
  if(id==="hilton"){
    const rows:any[]=[],put=(tier:string,facts:any)=>rows.push({tier,...facts,verified:true});
    const silver=/Silver Member Benefits|Silver Tier Benefits/i.test(t)&&/20% Elite Tier Bonus Points|20% Points earning Bonus/i.test(t)&&/Fifth Night Free/i.test(t);
    const gold=/Gold Member Benefits|Gold Tier Benefits/i.test(t)&&/80% Elite Tier Bonus Points|80% Points earning Bonus/i.test(t)&&/Space-available room upgrades/i.test(t)&&/(?:Food and Beverage Credit|Food & Beverage Credit|Continental Breakfast)/i.test(t);
    const diamond=/Diamond Member Benefits|Diamond Tier Benefits/i.test(t)&&/100% Elite Tier Bonus Points|100% Points earning Bonus/i.test(t)&&/Premium Wi-?Fi/i.test(t)&&/48-hour room guarantee/i.test(t)&&/Executive lounge access/i.test(t);
    const reserve=/Diamond Reserve Member Benefits|Diamond Reserve Tier Benefits/i.test(t)&&/120% Elite Tier Bonus Points|120% Points earning Bonus/i.test(t)&&/(?:4pm|4 p\.m\.)[^.]{0,120}(?:late check-out|late checkout)/i.test(t)&&/Confirmable Upgrade Reward/i.test(t)&&/Premium Club access/i.test(t)&&/(?:Elevated|Exclusive) Customer Service/i.test(t);
    put("Silver",{earningBonusPct:20,fifthNightFree:true,bottledWater:true,spaDiscountPct:15,coverageComplete:silver});
    put("Gold",{earningBonusPct:80,roomUpgrade:"space_available_up_to_executive_floor",foodBeverageOrBreakfast:true,coverageComplete:gold});
    put("Diamond",{earningBonusPct:100,roomUpgrade:"space_available_up_to_one_bedroom_suite",loungeAccess:true,premiumWifi:true,guaranteedAvailabilityHours:48,statusExtension:true,coverageComplete:diamond});
    put("Diamond Reserve",{earningBonusPct:120,lateCheckoutHour:16,confirmableUpgrade:true,premiumClubAccess:true,elevatedCustomerService:true,coverageComplete:reserve});
    return rows;
  }
  if(id==="hyatt"){const rows:any[]=[],put=(tier:string,facts:any)=>rows.push({tier,...facts,verified:true});const d=/Discoverist/i.test(t)&&/(?:10\s*%|10 percent)[^.]{0,140}(?:bonus|more points)/i.test(t)&&/(?:preferred room|preferred rooms)/i.test(t)&&/(?:late checkout|2\s*p\.?m\.?)/i.test(t),e=/Explorist/i.test(t)&&/(?:20\s*%|20 percent)[^.]{0,140}(?:bonus|more points)/i.test(t)&&/(?:upgraded room|room upgrade)/i.test(t)&&/(?:excluding|exclude)[^.]{0,120}(?:suite|Club)/i.test(t)&&/(?:late checkout|2\s*p\.?m\.?)/i.test(t),g=/Globalist/i.test(t)&&/(?:30\s*%|30 percent)[^.]{0,140}(?:bonus|more points)/i.test(t)&&/(?:standard suite|best available room)/i.test(t)&&/(?:Club access|breakfast)/i.test(t)&&/(?:4\s*p\.?m\.?|late checkout)/i.test(t);put("Discoverist",{earningBonusPct:10,roomUpgrade:"preferred_room_within_type",lateCheckoutHour:14,premiumInternet:true,bottledWater:true,coverageComplete:d});put("Explorist",{earningBonusPct:20,roomUpgrade:"upgraded_room_excluding_suites_and_club",lateCheckoutHour:14,guaranteedAvailabilityHours:72,earlyAwardInventory:true,coverageComplete:e});put("Globalist",{earningBonusPct:30,roomUpgrade:"best_available_including_standard_suites",lateCheckoutHour:16,guaranteedAvailabilityHours:48,clubOrBreakfast:true,freeParkingOnFreeNights:true,resortFeesWaived:true,priorityRoomAccess:true,coverageComplete:g});return rows;}
  if(id!=="marriott")return[];const rows:any[]=[],put=(tier:string,facts:any)=>rows.push({tier,...facts,verified:true});const silver=/Silver Elite/i.test(t)&&/10\s*%[^.]{0,120}(?:Bonus Points|more points)/i.test(t)&&/Priority Late Checkout/i.test(t),gold=/Gold Elite/i.test(t)&&/25\s*%[^.]{0,120}(?:Bonus Points|more points)/i.test(t)&&/2\s*p\.?m\.?[^.]{0,100}Late Checkout|2\s*p\.?m\.? Late Checkout/i.test(t)&&/Enhanced Room Upgrade/i.test(t),platinum=/Platinum Elite/i.test(t)&&/50\s*%[^.]{0,120}(?:Bonus Points|more points)/i.test(t)&&/4\s*p\.?m\.? Late Checkout/i.test(t)&&/Select Suites/i.test(t)&&/Welcome Gift Choice/i.test(t)&&/Lounge Access/i.test(t)&&/Annual Choice Benefit[^\n]{0,180}50 Elite Night Credits/i.test(t),titanium=/Titanium Elite/i.test(t)&&/75\s*%[^.]{0,120}(?:Bonus Points|more points)/i.test(t)&&/48[- ]hour Guarantee/i.test(t)&&/Annual Choice Benefit[^\n]{0,180}75 Elite Night Credits/i.test(t)&&/United[^.]{0,220}Premier[^.]{0,80}Silver/i.test(t),ambassador=/Ambassador Elite/i.test(t)&&/100\+?\s+nights[^\n]{0,180}\$\s*23,?000/i.test(t)&&/Ambassador Service/i.test(t)&&/Your24/i.test(t)&&/75\s*%[^.]{0,120}(?:Bonus Points|more points)/i.test(t);put("Silver Elite",{earningBonusPct:10,lateCheckout:"priority",coverageComplete:silver});put("Gold Elite",{earningBonusPct:25,lateCheckoutHour:14,enhancedRoomUpgrade:true,welcomeGift:"points",coverageComplete:gold});put("Platinum Elite",{earningBonusPct:50,lateCheckoutHour:16,enhancedRoomUpgrade:"select_suites",welcomeGift:"choice",loungeAccess:true,annualChoiceBenefit:50,coverageComplete:platinum});put("Titanium Elite",{earningBonusPct:75,lateCheckoutHour:16,enhancedRoomUpgrade:"select_suites",welcomeGift:"choice",loungeAccess:true,annualChoiceBenefit:75,guarantee48Hour:true,unitedPremierSilver:true,coverageComplete:titanium});put("Ambassador Elite",{earningBonusPct:75,lateCheckoutHour:16,enhancedRoomUpgrade:"select_suites",welcomeGift:"choice",loungeAccess:true,ambassadorService:true,your24:true,unitedPremierSilver:true,coverageComplete:ambassador});return rows;
}
function hyattMilestoneRewards(t:string){
 const inventory=/20\s+(?:qualifying\s+)?nights/i.test(t)&&/35,?000\s+Base Points/i.test(t)&&/30\s+(?:qualifying\s+)?nights/i.test(t)&&/50,?000\s+Base Points/i.test(t)&&/40\s+(?:qualifying\s+)?nights/i.test(t)&&/65,?000\s+Base Points/i.test(t)&&/50\s+(?:qualifying\s+)?nights/i.test(t)&&/80,?000\s+Base Points/i.test(t)&&/60\s+(?:qualifying\s+)?nights/i.test(t)&&/100,?000\s+Base Points/i.test(t)&&/70[^0-9]{0,40}80[^0-9]{0,40}(?:&|and)?[^0-9]{0,40}90[^.]{0,120}(?:qualifying\s+)?nights/i.test(t)&&/100\s+(?:qualifying\s+)?nights/i.test(t)&&/110[^0-9]{0,40}120[^0-9]{0,40}130[^0-9]{0,40}(?:&|and)?[^0-9]{0,40}140[^.]{0,120}(?:qualifying\s+)?nights/i.test(t)&&/150\s+(?:qualifying\s+)?nights/i.test(t),benefits=/(?:2K Next Stay Award|2,?000 Bonus Points)/i.test(t)&&/Club (?:Access|lounge access) Award/i.test(t)&&/FIND/i.test(t)&&/Category\s*1\s*[-–]\s*4/i.test(t)&&/Guest of Honor/i.test(t)&&/(?:5K|5,?000 Bonus Points)/i.test(t)&&/Suite Upgrade Award/i.test(t)&&/Category\s*1\s*[-–]\s*7/i.test(t)&&/My Hyatt Concierge/i.test(t)&&/(?:10K|10,?000 Bonus Points)/i.test(t)&&/AAdvantage Gold/i.test(t)&&/AAdvantage Platinum/i.test(t)&&/Miraval/i.test(t)&&/(?:Ultimate Free Night Award|Category\s*1\s*[-–]\s*8)/i.test(t),coverageComplete=inventory&&benefits;
 const defs:any[]=[{"nights":20,"basePoints":35000,"fixedBenefits":[],"choiceBenefits":["next_stay_award_2k","club_access_awards_2","find_credit_25","aa_preferred_seat_coupons_2"]},{"nights":30,"basePoints":50000,"fixedBenefits":["free_night_award_cat1_4"],"choiceBenefits":["next_stay_award_2k","club_access_awards_2","find_credit_25","aa_preferred_seat_coupons_2"]},{"nights":40,"basePoints":65000,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_5k","suite_upgrade_award_1","find_credit_150","aa_main_cabin_extra_coupons_2"]},{"nights":50,"basePoints":80000,"fixedBenefits":[],"choiceBenefits":["hyatt_points_5k","suite_upgrade_awards_2","find_credit_150","aa_main_cabin_extra_coupons_2"]},{"nights":60,"basePoints":100000,"fixedBenefits":["guest_of_honor_awards_2","free_night_award_cat1_7","suite_upgrade_awards_2","my_hyatt_concierge"],"choiceBenefits":[]},{"nights":70,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","find_credit_300","aadvantage_gold_status"]},{"nights":80,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","find_credit_300","aadvantage_gold_status"]},{"nights":90,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","find_credit_300","aadvantage_gold_status"]},{"nights":100,"fixedBenefits":["free_night_award_cat1_7"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":110,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":120,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":130,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":140,"fixedBenefits":["guest_of_honor_award_1"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]},{"nights":150,"fixedBenefits":["ultimate_free_night_award"],"choiceBenefits":["hyatt_points_10k","suite_upgrade_award_1","miraval_extra_night","aadvantage_platinum_status"]}];return defs.map(x=>({...x,coverageComplete,verified:true}));
}
function hiltonMilestoneRewards(t:string){
  const base=/10,?000\s+(?:Milestone )?Bonus Points[\s\S]{0,260}(?:40 eligible nights|reaching 40 nights)|(?:40 eligible nights|reaching 40 nights)[\s\S]{0,260}10,?000\s+(?:Milestone )?Bonus Points/i.test(t);
  const through180=/up to\s+180\s+nights|capped at\s+180\s+nights/i.test(t);
  const extra60=/additional\s+30,?000\s+(?:Milestone )?Bonus Points[\s\S]{0,180}60|60(?:th)? eligible night[\s\S]{0,220}30,?000\s+(?:Milestone )?Bonus Points/i.test(t);
  const choice120=/120(?:th)? eligible night[\s\S]{0,320}(?:30,?000\s+(?:Milestone )?Bonus Points|Confirmable Upgrade Reward)|(?:Confirmable Upgrade Reward|30,?000\s+(?:Milestone )?Bonus Points)[\s\S]{0,320}120/i.test(t);
  const coverageComplete=base&&through180&&extra60&&choice120,rows:any[]=[];
  for(let nights=40;nights<=180;nights+=10){let row:any={nights,bonusPoints:10000};if(nights===60){row.bonusPoints=40000;row.statusGift="Gold"}if(nights===100)row.statusGift="Diamond";if(nights===120){row.choice="confirmable_upgrade_or_30000_points";row.selectablePointFloor=30000}rows.push({...row,coverageComplete,verified:true});}
  return rows;
}
function programFacts(kind:string,id:string,t:string){const f:any={};
if(kind==="airlines"&&id==="delta"){
  f.thresholds=parseDeltaThresholds(t);
}else if(kind==="airlines"&&id==="american"){
  f.thresholds=[];
  if(/40,000\s+Loyalty Points/i.test(t))f.thresholds.push({tier:"AAdvantage Gold",amount:40000});
  if(/75,000\s+Loyalty Points/i.test(t))f.thresholds.push({tier:"AAdvantage Platinum",amount:75000});
  if(/125,000\s+Loyalty Points/i.test(t))f.thresholds.push({tier:"AAdvantage Platinum Pro",amount:125000});
  if(/200,000\s+Loyalty Points/i.test(t))f.thresholds.push({tier:"AAdvantage Executive Platinum",amount:200000});
}else if(kind==="airlines"&&id==="southwest"){
  f.thresholds=[];f.flightThresholds=[];
  const a=first(t,[/A-List status[^\n]{0,500}?fly\s+(\d+)\s+qualifying one-way flights?[^\n]{0,180}?earn\s+([\d,]+)\s+tier qualifying points/i,/A Member who flies\s+(\d+)\s+qualifying one-way flights?[^.]{0,180}?([\d,]+)\s+tier qualifying points[^.]{0,80}?A-List status/i]);
  const ap=first(t,[/A-List Preferred status[^\n]{0,500}?fly\s+(\d+)\s+qualifying one-way flights?[^\n]{0,180}?earn\s+([\d,]+)\s+tier qualifying points/i,/A Member who flies\s+(\d+)\s+qualifying one-way flights?[^.]{0,180}?([\d,]+)\s+tier qualifying points[^.]{0,80}?A-List Preferred status/i]);
  if(a){f.thresholds.push({tier:"A-List",amount:amount(a[2])});f.flightThresholds.push({tier:"A-List",flights:amount(a[1])})}
  if(ap){f.thresholds.push({tier:"A-List Preferred",amount:amount(ap[2])});f.flightThresholds.push({tier:"A-List Preferred",flights:amount(ap[1])})}
  const cp=first(t,[/fly\s+(\d+)\s+qualifying one-way flights?[^.]{0,180}?earn\s+([\d,]+)\s+(?:Companion Pass )?qualifying points/i,/Companion Pass[^\n]{0,600}?(\d+)\s+flights[^\n]{0,180}?([\d,]+)\s+points/i]);
  const boost=first(t,[/one boost of\s+([\d,]+)\s+Companion Pass qualifying points each calendar year/i,/([\d,]+)\s+Companion Pass[^.]{0,100}qualifying points boost each year/i]);
  const minFee=first(t,[/taxes and fees from\s+\$\s*([\d.]+)\s+one-way/i]);
  if(cp)f.companionPass={qualifyingFlights:amount(cp[1]),qualifyingPoints:amount(cp[2]),cardBoost:boost?amount(boost[1]):null,unlimited:/unlimited times/i.test(t),taxesFeesMinOneWay:minFee?Number(minFee[1]):null};
}else if(kind==="airlines"&&id==="united"){
  f.thresholds=parseUnitedThresholds(t);
  const seg=first(t,[/minimum of\s+(\d+)\s+(?:paid )?(?:flight )?(?:segments?|flights?)/i,/at least\s+(\d+)\s+(?:paid )?(?:flight )?(?:segments?|flights?)/i,/minimum of\s+four\s+(?:paid )?(?:flight )?(?:segments?|flights?)/i,/at least\s+four\s+(?:paid )?(?:flight )?(?:segments?|flights?)/i,/(\d+)\s+(?:paid )?(?:flight )?segments?[^.]{0,100}(?:United|United Express)/i]);if(seg)f.minimumUnitedSegments=seg[1]?amount(seg[1]):4;
}else if(kind==="hotels"){
  f.thresholds=[];
  const defs:any=id==="marriott"?[["Silver Elite",/Silver Elite\s+(\d+)\s+nights per year/i],["Gold Elite",/Gold Elite\s+(\d+)\s+nights per year/i],["Platinum Elite",/Platinum Elite\s+(\d+)\s+nights per year/i],["Titanium Elite",/Titanium Elite\s+(\d+)\s+nights per year/i]]:id==="hyatt"?[["Discoverist",/Discoverist[^.]{0,240}(\d+)\s+(?:qualifying )?nights/i],["Explorist",/Explorist[^.]{0,240}(\d+)\s+(?:qualifying )?nights/i],["Globalist",/Globalist[^.]{0,240}(\d+)\s+(?:qualifying )?nights/i]]:[];
  for(const[tier,re]of defs){const m=t.match(re);if(m)f.thresholds.push({tier,nights:amount(m[1])})}
  if(id==="hyatt"){const bp:any={Discoverist:25000,Explorist:50000,Globalist:100000};for(const row of f.thresholds){const tier=String(row.tier||""),expected=bp[tier];if(expected&&new RegExp(tier+"[\\s\\S]{0,900}"+String(expected).replace(/000$/,",?000")+"\\s+Base Points","i").test(t))row.basePoints=expected;}f.tierBenefits=hotelTierBenefits(id,t);f.milestoneRewards=hyattMilestoneRewards(t);}
  if(id==="marriott"){f.thresholds=parseMarriottThresholds(t);f.tierBenefits=hotelTierBenefits(id,t)}
  if(id==="hilton"){for(const[tier,re]of [["Silver",/Silver:\s*(\d+)\s+nights,\s*(\d+)\s+stays,\s*or\s*\$\s*([\d,]+)/i],["Gold",/Gold:\s*(\d+)\s+nights,\s*(\d+)\s+stays,\s*or\s*\$\s*([\d,]+)/i],["Diamond",/Diamond:\s*(\d+)\s+nights,\s*(\d+)\s+stays,\s*or\s*\$\s*([\d,]+)/i]] as [string,RegExp][]) {const m=t.match(re);if(m)f.thresholds.push({tier,nights:amount(m[1]),stays:amount(m[2]),spend:amount(m[3])})}if(f.thresholds.length<3){for(const [tier,nights,stays,spend] of [["Silver",10,4,2500],["Gold",25,15,6000],["Diamond",50,25,11500]] as any[])if(new RegExp(tier+"[\\s\\S]{0,180}"+nights+"\\s+nights?[\\s\\S]{0,120}"+stays+"\\s+stays?[\\s\\S]{0,140}\\$\\s*"+String(spend).replace(/000$/,",?000"),"i").test(t))f.thresholds.push({tier,nights,stays,spend});}const dr=first(t,[/Diamond Reserve:\s*(\d+)\s+nights[^$]{0,120}\$\s*([\d,]+)[^.]{0,140}or\s*(\d+)\s+stays[^$]{0,120}\$\s*([\d,]+)/i,/(\d+)\s+nights\s+AND\s+\$\s*([\d,]+)[^.]{0,140}(\d+)\s+stays\s+AND\s+\$\s*([\d,]+)/i]);if(dr)f.diamondReserve={tier:"Diamond Reserve",nights:amount(dr[1]),stays:amount(dr[3]),spend:amount(dr[2])};f.tierBenefits=hotelTierBenefits(id,t);f.milestoneRewards=hiltonMilestoneRewards(t)}
}if(kind==="airlines")f.tierBenefits=airlineTierBenefits(id,t);return f}
function materialUnmapped(t:string,f:any,id:string,spec:any){const out:string[]=[];const req=spec?.required||[],needs=(prefix:string)=>req.some((x:string)=>x===prefix||x.startsWith(prefix+"."));const hotelStatusSignal=/(?:Hilton Honors|Marriott Bonvoy|World of Hyatt)[^.]{0,140}(?:Diamond|Gold|Silver|Platinum Elite|Discoverist)[^.]{0,80}status|complimentary (?:Hilton Honors|Marriott Bonvoy|World of Hyatt)/i;const rules:[string,RegExp,boolean][]=[["statement_credit",/statement credit/i,!needs("recurringCredits")&&!needs("multiYearCredits")||Object.keys(f.recurringCredits||{}).length>0||Object.keys(f.multiYearCredits||{}).length>0],["trusted_traveler",/(?:Global Entry|TSA PreCheck|NEXUS)[^.]{0,320}(?:every four years|every 4 years)/i,Object.keys(f.multiYearCredits||{}).length>0],["portal_earn",/\d+(?:\.\d+)?\s*[xX][^.]{0,120}(?:Chase Travel|Capital One Travel|AmexTravel)/i,!needs("bookingEarn")||Object.keys(f.bookingEarn||{}).length>0],["reward_caps",/up to \$\s*[\d,]+K? in purchases per calendar year/i,!needs("caps")&&!needs("groupCaps")||Object.keys(f.caps||{}).length>0||Object.keys(f.groupCaps||{}).length>0],["hyatt_transfer_rate",/World of Hyatt[^.]{0,220}(?:4\s*:\s*3|4 to 3|1\s*:\s*1|1 to 1)|(?:4\s*:\s*3|4 to 3|1\s*:\s*1|1 to 1)[^.]{0,220}World of Hyatt/i,!needs("transferRules")||Object.keys(f.transferRules||{}).length>0],["status_earning",/\b(?:MQD|PQP|TQP|Loyalty Point)\b/i,!needs("status")||Object.keys(f.status||{}).length>0],["lounge",/Priority Pass|Centurion Lounge|Admirals Club|Sky Club|Capital One Lounge|United Club(?:SM)? (?:membership|access)/i,(f.benefitTags||[]).includes("lounge")],["lounge_passes",/(?:United Club[^.]{0,80}one-time passes|Admirals Club[^.]{0,160}Globe[^.]{0,80}Passes)/i,(f.benefitTags||[]).includes("lounge_passes")],["inflight_savings",/(?:20|25)%[^.]{0,140}(?:inflight|in-flight)|(?:inflight|in-flight)[^.]{0,140}(?:20|25)%/i,(f.benefitTags||[]).includes("inflight_savings")],["award_discount",/TakeOff 15|15%[^.]{0,160}Award Travel|Award Travel[^.]{0,160}15%/i,(f.benefitTags||[]).includes("award_discount")],["checked_bag",/(?:First|Second) (?:Checked )?Bag Free|free checked bag/i,(f.benefitTags||[]).includes("checked_bag")],["boarding",/Priority Boarding|Zone \d+ Priority Boarding/i,(f.benefitTags||[]).some((x:string)=>x==="boarding_benefits"||x==="priority_boarding")],["upgrade_priority",/\bUpgrade Priority\b/i,(f.benefitTags||[]).includes("upgrade_priority")],["upgrade_eligibility",/Complimentary Upgrade List/i,(f.benefitTags||[]).includes("upgrade_eligibility")],["loyalty_milestones",/10,000 Loyalty Point bonus/i,(f.statusMilestoneRewards||[]).length>0],["companion_pass_boost",/Companion Pass[^.]{0,100}qualifying points boost/i,(f.benefitTags||[]).includes("companion_pass_boost")],["omni_status",/Omni Hotels[^.]{0,100}Champion Status/i,(f.benefitTags||[]).includes("omni_champion_status")],["free_night",/Free Night (?:Reward|Award)|annual free night/i,(f.benefitTags||[]).some((x:string)=>x.includes("free_night"))||(f.spendRewards||[]).some((x:any)=>String(x?.benefit||"").includes("free_night"))||!!f.hotelStatus?.spendRewards],["companion",/companion certificate/i,(f.benefitTags||[]).includes("companion_certificate_renewal")],["hotel_status",hotelStatusSignal,Object.keys(f.hotelStatus||{}).length>0||Object.keys(f.hotelStatusByProgram||{}).length>0]];for(const[n,re,mapped]of rules)if(re.test(t)&&!mapped)out.push(n);return out}
function complete(spec:any,f:any,t:string,kind:string,id:string){
  const missing=(spec.required||[]).filter((p:string)=>!has(f,p)),unmapped=kind==="cards"&&!FLEX_FACT_LIMITS[id]?materialUnmapped(t,f,id,spec):[];
  missing.push(...criticalStructureIssues(kind,id,f));
  if((kind==="airlines"||kind==="hotels")&&(spec.required||[]).includes("tierBenefits")&&Array.isArray(f.thresholds)){
    const benefits=Array.isArray(f.tierBenefits)?f.tierBenefits:[];
    const covered=new Set(benefits.filter((x:any)=>x&&(["delta","united","american","southwest","marriott","hyatt","hilton"].includes(id)?x.coverageComplete===true:Object.keys(x).some(k=>k!=="tier"&&k!=="verified"))).map((x:any)=>String(x.tier||"").toLowerCase()));
    const uncovered=f.thresholds.map((x:any)=>String(x.tier||"")).filter((tier:string)=>tier&&!covered.has(tier.toLowerCase()));
    for(const tier of uncovered)missing.push("tierBenefits."+tier);
  }
  if(kind==="hotels"&&id==="marriott"){const a=(f.thresholds||[]).find((x:any)=>String(x?.tier||"").toLowerCase()==="ambassador elite");if(!a||!(Number(a.nights)>0)||!(Number(a.spend)>0))missing.push("thresholds.Ambassador Elite");}
  if(kind==="hotels"&&id==="hilton"){const d=f.diamondReserve,reserve=(f.tierBenefits||[]).find((x:any)=>String(x?.tier||"").toLowerCase()==="diamond reserve");if(!d||Number(d.nights)!==80||Number(d.stays)!==40||Number(d.spend)!==18000)missing.push("diamondReserve.dualQualification");if(!reserve||reserve.coverageComplete!==true)missing.push("tierBenefits.Diamond Reserve");const rows=Array.isArray(f.milestoneRewards)?f.milestoneRewards:[];for(const night of [40,50,60,70,80,90,100,110,120,130,140,150,160,170,180]){const row=rows.find((x:any)=>Number(x?.nights)===night);if(!row||row.coverageComplete!==true||(night===120&&Number(row.selectablePointFloor)!==30000))missing.push("milestoneRewards."+night);}}
  if(kind==="hotels"&&id==="hyatt"){const expected:any={discoverist:25000,explorist:50000,globalist:100000};for(const [tier,bp] of Object.entries(expected)){const row=(f.thresholds||[]).find((x:any)=>String(x?.tier||"").toLowerCase()===tier);if(!row||Number(row.basePoints)!==Number(bp))missing.push("thresholds."+tier+".basePoints");}const need=[20,30,40,50,60,70,80,90,100,110,120,130,140,150],rows=Array.isArray(f.milestoneRewards)?f.milestoneRewards:[];for(const night of need){const row=rows.find((x:any)=>Number(x?.nights)===night);if(!row||row.coverageComplete!==true)missing.push("milestoneRewards."+night);}}
  if(kind==="cards"&&id==="amex_platinum"&&Number(f.recurringCredits?.clear)!==219)missing.push("recurringCredits.clear.currentAmount");
  if(kind==="cards"&&id==="amex_green"&&!(f.benefitTags||[]).includes("travel_protections"))missing.push("benefitTags.travel_protections");
  if(kind==="cards"&&id==="amex_gold"){for(const b of ["premium_hotel_booking","hertz_five_star","travel_protections"])if(!(f.benefitTags||[]).includes(b))missing.push("benefitTags."+b);}
  if(kind==="cards"&&id==="chase_preferred"){const h=f.transferRules?.hyatt;if(Number(f.earn?.gas_ev)!==3||Number(f.earn?.vacation_home)!==3||Number(f.earn?.transit)!==2)missing.push("earn.currentPreferredCategories");if(Number(f.recurringCredits?.chase_travel_hotel_credit)!==100)missing.push("recurringCredits.chase_travel_hotel_credit.currentAmount");if(Number(f.multiYearCredits?.trusted_traveler?.amount)!==120||Number(f.multiYearCredits?.trusted_traveler?.years)!==4)missing.push("multiYearCredits.trusted_traveler.currentTerms");if(Number(h?.defaultRatio)!==.75||h?.grandfatherBefore!=="2026-06-15"||Number(h?.grandfatherRatio)!==1||h?.grandfatherThrough!=="2026-09-30")missing.push("transferRules.hyatt.currentTerms");const temp=Array.isArray(f.temporaryBenefits)?f.temporaryBenefits:[];for(const b of ["apple_tv_subscription_temporary","dashpass_membership_temporary","lyft_5x_temporary","peloton_5x_temporary"])if(!temp.some((x:any)=>x?.benefit===b&&Number(x?.recurringEconomicValue)===0))missing.push("temporaryBenefits."+b);}
  if(kind==="cards"&&id==="chase_freedom_unlimited"&&Number(f.earn?.drugstore)!==3)missing.push("earn.drugstore.currentRate");
  if(kind==="cards"&&id==="chase_freedom_flex"){if(Number(f.earn?.drugstore)!==3)missing.push("earn.drugstore.currentRate");if(Number(f.rotatingBonus?.rate)!==5||Number(f.rotatingBonus?.quarterlyCap)!==1500||f.rotatingBonus?.activationRequired!==true)missing.push("rotatingBonus.currentTerms");}
  if(kind==="cards"&&id==="chase_reserve"){const q=Array.isArray(f.qualitativeSpendRewards)?f.qualitativeSpendRewards:[],r=Array.isArray(f.spendRewards)?f.spendRewards:[],cash=r.find((x:any)=>Number(x?.amount)===75000&&x?.benefit==="southwest_chase_travel_credit_500"),temp=Array.isArray(f.temporaryBenefits)?f.temporaryBenefits:[];for(const b of ["hyatt_explorist_status_threshold","ihg_diamond_status_threshold","southwest_alist_status_threshold","shops_at_chase_credit_250"])if(!q.some((x:any)=>Number(x?.amount)===75000&&x?.benefit===b&&x?.quantified===false))missing.push("qualitativeSpendRewards."+b);if(!cash||Number(cash.cashValue)!==500)missing.push("spendRewards.southwest_chase_travel_credit_500");for(const b of ["apple_tv_music_temporary","dashpass_membership_temporary","doordash_promos_temporary","stubhub_credit_temporary","lyft_credit_5x_temporary","peloton_credit_10x_temporary"])if(!temp.some((x:any)=>x?.benefit===b&&Number(x?.recurringEconomicValue)===0))missing.push("temporaryBenefits."+b);if(Object.prototype.hasOwnProperty.call(f.recurringCredits||{},"hotel_credit"))missing.push("recurringCredits.hotel_credit.notAllowed");}
  if(kind==="cards"&&["venture_one","venture","venture_x"].includes(id)&&Number(f.bookingEarn?.vacation_home?.capital_one_travel)!==5)missing.push("bookingEarn.vacation_home.capital_one_travel.currentRate");
  if(kind==="cards"&&["venture_one","venture"].includes(id)&&!(f.benefitTags||[]).includes("hertz_five_star"))missing.push("benefitTags.hertz_five_star");
  if(kind==="cards"&&["venture_one","venture","venture_x"].includes(id)&&!(f.benefitTags||[]).includes("travel_protections"))missing.push("benefitTags.travel_protections");
  if(kind==="cards"&&id==="venture"&&(Number(f.multiYearCredits?.trusted_traveler?.amount)!==120||Number(f.multiYearCredits?.trusted_traveler?.years)!==4))missing.push("multiYearCredits.trusted_traveler.currentTerms");
  if(kind==="cards"&&id==="venture_x"&&(Number(f.bookingEarn?.hotel?.capital_one_travel)!==10||Number(f.bookingEarn?.airfare?.capital_one_travel)!==5))missing.push("bookingEarn.currentVentureXRates");
  return{complete:missing.length===0&&unmapped.length===0,missing:uniq(missing),unmapped};
}
async function verify(kind:"cards"|"airlines"|"hotels",id:string){const spec=(ENTITY_SOURCES as any)[kind][id],rows=await Promise.all(spec.urls.map(get)),ok=rows.filter((x:any)=>x.ok&&x.text),text=ok.map((x:any)=>x.text).join(" "),rawExt=kind==="cards"?cardFacts(id,text):{facts:programFacts(kind,id,text),unresolved:[]},ext=kind==="cards"?{...rawExt,facts:sanitizeFlexCardFacts(id,rawExt.facts)}:rawExt,q=complete(spec,ext.facts,text,kind,id),status=ok.length===0?"unavailable":q.complete?"verified":"partial";return{verificationStatus:status,complete:q.complete,verifiedAt:new Date().toISOString(),sources:rows.map(({text,...m}:any)=>m),facts:ext.facts,unresolved:uniq([...(ext.unresolved||[]),...q.missing,...q.unmapped])}}
function ids(body:any,key:string,allowed:string[]){const a=uniq((Array.isArray(body?.[key])?body[key]:[]).map((x:any)=>String(x||"").trim().toLowerCase()));return{ids:a,invalid:a.filter((x:any)=>!allowed.includes(x))}}
Deno.serve(async(req:Request)=>{const origin=req.headers.get("origin")||"";if(req.method==="OPTIONS")return preflight(origin);if(req.method!=="POST")return j({error:"method_not_allowed"},405,origin);if(origin&&!ORIGINS.has(origin))return j({error:"origin_not_allowed"},403,origin);if(!auth(req))return j({error:"unauthorized"},401,origin);let body:any;try{body=await req.json()}catch{return j({error:"invalid_json"},400,origin)}const c=ids(body,"cards",ALLOWED_CARD_IDS),a=ids(body,"airlines",ALLOWED_AIRLINE_IDS),h=ids(body,"hotels",ALLOWED_HOTEL_IDS),invalid=[...c.invalid,...a.invalid,...h.invalid];if(invalid.length)return j({error:"unsupported_entity",invalid},400,origin);const total=c.ids.length+a.ids.length+h.ids.length;if(!total)return j({error:"no_entities_requested"},400,origin);if(total>MAX_ENTITIES)return j({error:"too_many_entities",max:MAX_ENTITIES,requested:total},400,origin);const cards:any={},airlines:any={},hotels:any={},jobs:any[]=[...c.ids.map((x:any)=>["cards",x]),...a.ids.map((x:any)=>["airlines",x]),...h.ids.map((x:any)=>["hotels",x])];for(let i=0;i<jobs.length;i+=4){const done=await Promise.all(jobs.slice(i,i+4).map((x:any)=>verify(x[0],x[1]).then(record=>({kind:x[0],id:x[1],record}))));for(const x of done)({cards,airlines,hotels} as any)[x.kind][x.id]=x.record}const records:any[]=[...Object.values(cards),...Object.values(airlines),...Object.values(hotels)],fingerprints=records.flatMap(x=>x.sources||[]).map(x=>x.fingerprint).filter(Boolean).sort().join("|"),verifiedAt=new Date().toISOString(),snapshotId="qpf_"+verifiedAt.replace(/\D/g,"").slice(0,14)+"_"+(await digest(fingerprints||verifiedAt)).slice(0,12),sources=records.flatMap(x=>x.sources||[]).map(x=>({url:x.finalUrl||x.url,status:x.status,retrievedAt:x.retrievedAt,fingerprint:x.fingerprint}));return j({schema:SCHEMA,snapshotId,verifiedAt,sources,cards,airlines,hotels},200,origin)});
