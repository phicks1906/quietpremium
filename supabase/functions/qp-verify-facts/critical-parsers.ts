const amount=(v)=>{const n=Number(String(v??"").replace(/[$,%\s,]/g,""));return Number.isFinite(n)?n:null};
const uniq=(a)=>[...new Set((a||[]).filter(v=>v!=null))];

export function parseDeltaCardStatus(text,id){
  const t=String(text||""),out={};
  if(!String(id||"").startsWith("delta_"))return out;
  const h=t.match(/MQD Headstart[\s\S]{0,500}?(?:receive|get)\s+\$?\s*([\d,]+)\s+(?:Medallion Qualification Dollars|MQDs?)/i)
       ||t.match(/(?:receive|get)\s+\$?\s*([\d,]+)\s+(?:Medallion Qualification Dollars|MQDs?)[\s\S]{0,180}?MQD Headstart/i);
  if(h)out.headstart=amount(h[1]);
  const d=t.match(/(?:Get|Earn)\s+\$?1\s+(?:Medallion(?:®)?\s+Qualification Dollar|MQD)[\s\S]{0,140}?(?:for each|for every|per)\s+\$?\s*(\d+)\s+(?:in\s+)?purchases/i)
       ||t.match(/MQD Boost[\s\S]{0,500}?\$?1\s+(?:Medallion(?:®)?\s+Qualification Dollar|MQD)[\s\S]{0,140}?\$?\s*(\d+)\s+(?:in\s+)?purchases/i);
  if(d)out.spendDivisor=Number(d[1]);
  return out;
}

export function parseDeltaThresholds(text){
  const t=String(text||"");
  const start=t.search(/MQD Thresholds for Status/i);
  let section=t;
  if(start>=0){
    const rel=t.slice(start);
    const next=rel.slice(1).search(/Earn Medallion Qualification Dollars(?:\s*\(MQDs\))?/i);
    section=next>=0?rel.slice(0,next+1):rel.slice(0,30000);
  }
  const ordered=section.match(/SILVER[\s\S]{0,1200}?GOLD[\s\S]{0,1200}?PLATINUM[\s\S]{0,1200}?DIAMOND[\s\S]{0,2400}?\$\s*([\d,]+)\s*MQDs?[\s\S]{0,500}?\$\s*([\d,]+)\s*MQDs?[\s\S]{0,500}?\$\s*([\d,]+)\s*MQDs?[\s\S]{0,500}?\$\s*([\d,]+)\s*MQDs?/i);
  const vals=ordered?[amount(ordered[1]),amount(ordered[2]),amount(ordered[3]),amount(ordered[4])]:uniq([...section.matchAll(/\$\s*([\d,]+)\s*MQDs?/gi)].map(m=>amount(m[1])).filter(v=>v>=1000&&v<=100000));
  const tiers=["Silver Medallion","Gold Medallion","Platinum Medallion","Diamond Medallion"];
  if(vals.length>=4&&vals.slice(0,4).every((v,i,a)=>i===0||v>a[i-1]))return tiers.map((tier,i)=>({tier,amount:vals[i]}));
  const local=[
    ["Silver Medallion",/Silver[^$0-9]{0,180}\$\s*([\d,]+)\s*MQDs?/i],
    ["Gold Medallion",/Gold[^$0-9]{0,180}\$\s*([\d,]+)\s*MQDs?/i],
    ["Platinum Medallion",/Platinum[^$0-9]{0,180}\$\s*([\d,]+)\s*MQDs?/i],
    ["Diamond Medallion",/Diamond[^$0-9]{0,180}\$\s*([\d,]+)\s*MQDs?/i]
  ].map(([tier,re])=>{const m=section.match(re);return m?{tier,amount:amount(m[1])}:null}).filter(Boolean);
  return local.length===4&&local.every((x,i,a)=>i===0||x.amount>a[i-1].amount)?local:[];
}

export function parseChaseReserveRewards(text){
  const t=String(text||"");
  const one=t.match(/(1)\s*[xX]\s+points?\s+on all other purchases/i);
  const dining=t.match(/(3)\s*[xX]\s+points?\s+on dining/i);
  const flight=t.match(/(4)\s*[xX]\s+points?\s+on flights? booked direct/i);
  const hotel=t.match(/(4)\s*[xX]\s+points?\s+on hotels? booked direct/i);
  const portal=t.match(/(8)\s*[xX]\s+points?\s+on all purchases through Chase Travel/i);
  if(!(one&&dining&&flight&&hotel&&portal))return null;
  const base=Number(one[1]);
  return{
    earn:{dining:Number(dining[1]),grocery:base,online_grocery:base,drugstore:base,gas_ev:base,transit:base,online_retail:base,vacation_home:base,airfare:Number(flight[1]),hotel:Number(hotel[1]),general:base},
    bookingEarn:{airfare:{chase_travel:Number(portal[1])},hotel:{chase_travel:Number(portal[1])},vacation_home:{chase_travel:Number(portal[1])}}
  };
}

export function parseMarriottThresholds(text){
  const t=String(text||"");
  const rows=[
    ["Silver Elite",[/([\d,]+)\s+nights? per year\s+Silver Elite/i,/Silver Elite[\s\S]{0,140}?([\d,]+)\s+nights? per year/i]],
    ["Gold Elite",[/([\d,]+)\s+nights? per year\s+Gold Elite/i,/Gold Elite[\s\S]{0,140}?([\d,]+)\s+nights? per year/i]],
    ["Platinum Elite",[/([\d,]+)\s+nights? per year\s+Platinum Elite/i,/Platinum Elite[\s\S]{0,140}?([\d,]+)\s+nights? per year/i]],
    ["Titanium Elite",[/([\d,]+)\s+nights? per year\s+Titanium Elite/i,/Titanium Elite[\s\S]{0,140}?([\d,]+)\s+nights? per year/i]]
  ];
  const out=[];
  for(const [tier,res] of rows){let m=null;for(const re of res){m=t.match(re);if(m)break}if(m)out.push({tier,nights:amount(m[1])});}
  const amb=t.match(/([\d,]+)\s+nights? per (?:yr|year)\s*\+\s*\$\s*([\d,]+)\s*USD\s+Ambassador Elite/i)
         ||t.match(/Ambassador Elite[\s\S]{0,240}?([\d,]+)\+?\s+nights?[\s\S]{0,180}?\$\s*([\d,]+)[\s\S]{0,80}(?:qualifying )?spend/i);
  if(amb)out.push({tier:"Ambassador Elite",nights:amount(amb[1]),spend:amount(amb[2])});
  return out;
}

export function criticalStructureIssues(kind,id,facts){
  const f=facts||{},issues=[];
  if(kind==="cards"&&(id==="delta_platinum"||id==="delta_reserve")){
    if(!(Number(f.status?.headstart)>=1000))issues.push("status.headstart.structure");
    if(!(Number(f.status?.spendDivisor)>=2))issues.push("status.spendDivisor.structure");
  }
  if(kind==="cards"&&id==="chase_reserve"){
    const e=f.earn||{},b=f.bookingEarn||{};
    if(!(Number(e.general)===1&&Number(e.dining)===3&&Number(e.airfare)===4&&Number(e.hotel)===4))issues.push("earn.reserveCurrentStructure");
    if(!(Number(b.airfare?.chase_travel)===8&&Number(b.hotel?.chase_travel)===8))issues.push("bookingEarn.reserveCurrentStructure");
  }
  if(kind==="airlines"&&id==="delta"){
    const expected=["silver medallion","gold medallion","platinum medallion","diamond medallion"],rows=Array.isArray(f.thresholds)?f.thresholds:[];
    if(rows.length!==4)issues.push("thresholds.completeLadder");
    const names=rows.map(x=>String(x?.tier||"").toLowerCase());
    if(!expected.every((x,i)=>names[i]===x))issues.push("thresholds.tierOrder");
    const vals=rows.map(x=>Number(x?.amount));
    if(vals.length!==4||!vals.every((v,i)=>v>0&&(i===0||v>vals[i-1])))issues.push("thresholds.strictlyIncreasing");
  }
  if(kind==="hotels"&&id==="marriott"){
    const expected=["silver elite","gold elite","platinum elite","titanium elite","ambassador elite"],rows=Array.isArray(f.thresholds)?f.thresholds:[];
    if(rows.length!==5)issues.push("thresholds.completeLadder");
    const names=rows.map(x=>String(x?.tier||"").toLowerCase());
    if(!expected.every((x,i)=>names[i]===x))issues.push("thresholds.tierOrder");
    const nights=rows.map(x=>Number(x?.nights));
    if(nights.length!==5||!nights.every((v,i)=>v>0&&(i===0||v>nights[i-1])))issues.push("thresholds.strictlyIncreasing");
    const amb=rows[4];if(!(Number(amb?.spend)>0))issues.push("thresholds.AmbassadorElite.spend");
  }
  return issues;
}
