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
  const orderedPattern=/SILVER[\s\S]{0,1200}?GOLD[\s\S]{0,1200}?PLATINUM[\s\S]{0,1200}?DIAMOND[\s\S]{0,2400}?\$\s*([\d,]+)\s*MQDs?[\s\S]{0,500}?\$\s*([\d,]+)\s*MQDs?[\s\S]{0,500}?\$\s*([\d,]+)\s*MQDs?[\s\S]{0,500}?\$\s*([\d,]+)\s*MQDs?/i;
  const ordered=t.match(orderedPattern)||section.match(orderedPattern);
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

export function parseUnitedThresholds(text){
  const t=String(text||""),defs=[
    ["Premier Silver","(?:United\\s+)?Premier\\s+Silver",15,5000,6000],
    ["Premier Gold","(?:United\\s+)?Premier\\s+Gold",30,10000,12000],
    ["Premier Platinum","(?:United\\s+)?Premier\\s+Platinum",45,15000,18000],
    ["Premier 1K","(?:United\\s+)?Premier\\s+1K(?:®)?",60,22000,28000]
  ],rows=[];
  for(const [tier,label,expectedPqf,expectedWith,expectedOnly] of defs){
    const re=new RegExp(label+"[\\s\\S]{0,700}?How to earn:?\\s*([\\d,]+)\\s+PQF\\s+(?:and|\\+)\\s+([\\d,]+)\\s+PQP\\s*,?\\s*or\\s+([\\d,]+)\\s+PQP","i"),
          m=t.match(re);
    if(!m)continue;
    const pqf=Number(String(m[1]).replace(/,/g,"")),pqpWithPQF=Number(String(m[2]).replace(/,/g,"")),pqpOnly=Number(String(m[3]).replace(/,/g,""));
    if(pqf===expectedPqf&&pqpWithPQF===expectedWith&&pqpOnly===expectedOnly)rows.push({tier,pqf,pqpWithPQF,pqpOnly,amount:pqpOnly});
  }
  return rows;
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
  if(kind==="cards"&&["marriott_boundless","marriott_bountiful","marriott_bevy","marriott_brilliant"].includes(id)){
    const e=f.earn||{};
    if(Number(e.general)>6||Number(e.grocery)>6||Number(e.dining)>6||Number(e.airfare)>6||Number(e.hotel)>6)issues.push("earn.compositeMarriottTotalNotAllowed");
    if(id==="marriott_boundless"&&!(Number(e.general)===2&&Number(e.dining)===3&&Number(e.grocery)===3&&Number(e.gas_ev)===3&&Number(e.hotel)===6))issues.push("earn.boundlessCurrentStructure");
    if((id==="marriott_bountiful"||id==="marriott_bevy")&&!(Number(e.general)===2&&Number(e.dining)===4&&Number(e.grocery)===4&&Number(e.hotel)===6))issues.push("earn.marriott642CurrentStructure");
    if(id==="marriott_brilliant"&&!(Number(e.general)===2&&Number(e.dining)===3&&Number(e.airfare)===3&&Number(e.hotel)===6))issues.push("earn.brilliantCurrentStructure");
  }
  if(kind==="airlines"&&id==="delta"){
    const expected=["silver medallion","gold medallion","platinum medallion","diamond medallion"],rows=Array.isArray(f.thresholds)?f.thresholds:[];
    if(rows.length!==4)issues.push("thresholds.completeLadder");
    const names=rows.map(x=>String(x?.tier||"").toLowerCase());
    if(!expected.every((x,i)=>names[i]===x))issues.push("thresholds.tierOrder");
    const vals=rows.map(x=>Number(x?.amount));
    if(vals.length!==4||!vals.every((v,i)=>v>0&&(i===0||v>vals[i-1])))issues.push("thresholds.strictlyIncreasing");
  }
  if(kind==="airlines"&&id==="united"){
    const expected=[
      {tier:"premier silver",pqf:15,pqpWithPQF:5000,pqpOnly:6000},
      {tier:"premier gold",pqf:30,pqpWithPQF:10000,pqpOnly:12000},
      {tier:"premier platinum",pqf:45,pqpWithPQF:15000,pqpOnly:18000},
      {tier:"premier 1k",pqf:60,pqpWithPQF:22000,pqpOnly:28000}
    ],rows=Array.isArray(f.thresholds)?f.thresholds:[];
    if(rows.length!==4)issues.push("thresholds.completeLadder");
    const valid=expected.every((x,i)=>{
      const r=rows[i]||{};
      return String(r.tier||"").toLowerCase()===x.tier&&Number(r.pqf)===x.pqf&&Number(r.pqpWithPQF)===x.pqpWithPQF&&Number(r.pqpOnly)===x.pqpOnly&&Number(r.amount)===x.pqpOnly;
    });
    if(!valid)issues.push("thresholds.current2026Structure");
    if(Number(f.minimumUnitedSegments)!==4)issues.push("minimumUnitedSegments.currentRequirement");
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


export function parseMarriottCardRewards(text,id){
  const t=String(text||"");
  const base=(n)=>({dining:n,grocery:n,online_grocery:n,drugstore:n,gas_ev:n,transit:n,online_retail:n,vacation_home:n,airfare:n,hotel:n,general:n});
  if(id==="marriott_boundless"){
    const marriott=/Earn\s+6X\s+points[^.]{0,220}(?:hotels participating in Marriott Bonvoy|Marriott)/i.test(t);
    const everyday=/Earn\s+3X\s+points[^.]{0,260}first\s+\$?6,?000[^.]{0,260}(?:grocery|gas)[^.]{0,220}dining/i.test(t)
      ||/3X\s+points[^.]{0,260}(?:grocery|gas|dining)[\s\S]{0,500}\$?6,?000/i.test(t);
    const other=/Earn\s+2X\s+points[^.]{0,180}all other purchases/i.test(t);
    if(!(marriott&&everyday&&other))return null;
    const e=base(2);e.dining=3;e.grocery=3;e.online_grocery=3;e.gas_ev=3;e.hotel=6;return e;
  }
  if(id==="marriott_bountiful"||id==="marriott_bevy"){
    const marriott=/Earn\s+6X\s+points[^.]{0,220}(?:hotels participating in Marriott Bonvoy|Marriott)/i.test(t)
      ||/6X\s+points[^.]{0,220}(?:hotels participating in Marriott Bonvoy|Marriott)/i.test(t);
    const fourBlock=t.match(/4X\s+points[\s\S]{0,900}?(?:\$?15,?000|15,?000)[\s\S]{0,300}/i)?.[0]
      ||t.match(/4X\s+points[\s\S]{0,700}/i)?.[0]||"";
    const four=/\b4X\b/i.test(fourBlock)&&/(?:restaurants?|dining)/i.test(fourBlock)&&/(?:grocery|supermarkets?)/i.test(fourBlock)&&/15,?000/i.test(fourBlock);
    const other=/2X\s+points[^.]{0,180}all other (?:eligible )?purchases/i.test(t);
    if(!(marriott&&four&&other))return null;
    const e=base(2);e.dining=4;e.grocery=4;e.online_grocery=4;e.hotel=6;return e;
  }
  if(id==="marriott_brilliant"){
    const marriott=/Earn\s+6\s+(?:points|X points)[^.]{0,220}hotels participating in Marriott Bonvoy/i.test(t)
      ||/6X\s+points[^.]{0,220}hotels participating in Marriott Bonvoy/i.test(t);
    const three=/Earn\s+3\s+(?:points|X points)[^.]{0,220}restaurants worldwide[^.]{0,220}flights booked directly with airlines/i.test(t)
      ||/3X\s+points[^.]{0,220}restaurants worldwide[^.]{0,220}flights booked directly with airlines/i.test(t);
    const other=/Earn\s+2\s+(?:points|X points)[^.]{0,180}all other eligible purchases/i.test(t)
      ||/2X\s+points[^.]{0,180}all other eligible purchases/i.test(t);
    if(!(marriott&&three&&other))return null;
    const e=base(2);e.dining=3;e.airfare=3;e.hotel=6;return e;
  }
  return null;
}

export function parseMarriottCardCriticalFacts(text,id){
  const t=String(text||""),out={};
  if(id==="marriott_boundless"){
    const fee=t.match(/(?:ANNUAL FEE|Annual Fee)[^$]{0,100}\$\s*(95)\b/i)||t.match(/\$\s*(95)\b[^.]{0,80}annual fee/i);
    if(fee)out.annualFee=95;
    if(/Free Night Award[\s\S]{0,420}(?:every year after your account anniversary|each account anniversary)[\s\S]{0,520}(?:35,?000|35K)\s+points?/i.test(t)
      ||/(?:35,?000|35K)\s+points?[\s\S]{0,520}Free Night Award[\s\S]{0,320}(?:every year|account anniversary)/i.test(t)){
      out.annualPointCertificate={benefit:"free_night_award_35k",capPoints:35000,currency:"marriott_points",renewalRequired:true};
    }
  }
  if(id==="marriott_bountiful"){
    if(/Automatic Gold Elite Status/i.test(t)||/automatically (?:receive|enjoy) (?:Marriott Bonvoy )?Gold Elite Status/i.test(t))out.automaticTier="Gold Elite";
  }
  if(id==="marriott_brilliant"){
    if(/Free Night Award[\s\S]{0,520}(?:every year after your Card renewal month|Card renewal month)[\s\S]{0,520}(?:85,?000|85K)[\s\S]{0,80}?points?/i.test(t)
      ||/(?:85,?000|85K)[\s\S]{0,80}?points?[\s\S]{0,520}Free Night Award[\s\S]{0,320}(?:every year|renewal)/i.test(t)){
      out.annualPointCertificate={benefit:"free_night_award_85k",capPoints:85000,currency:"marriott_points",renewalRequired:true};
    }
    if(/(?:\$\s*120)[\s\S]{0,700}(?:Global Entry|TSA PreCheck)[\s\S]{0,800}(?:every\s+4\s+years|every four years|4\s*year period)/i.test(t)
      ||/(?:Global Entry|TSA PreCheck)[\s\S]{0,800}\$\s*120[\s\S]{0,800}(?:every\s+4\s+years|every four years|4\s*year period)/i.test(t)){
      out.trustedTraveler={amount:120,years:4};
    }
    const choice=/Brilliant Earned Choice Award[\s\S]{0,1000}\$\s*60,?000|\$\s*60,?000[\s\S]{0,1000}Brilliant Earned Choice Award/i.test(t);
    const choice85=/(?:Brilliant Earned Choice Award[\s\S]{0,8000})?(?:85K|85,?000)[\s\S]{0,300}Free Night Award|Free Night Award[\s\S]{0,300}(?:85K|85,?000)/i.test(t);
    if(choice&&choice85)out.spendReward={amount:60000,benefit:"brilliant_choice_free_night_award_85k",valuePoints:85000,currency:"marriott_points"};
  }
  return out;
}
