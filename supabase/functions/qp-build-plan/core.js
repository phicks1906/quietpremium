export const FLEX_CARDS=Object.freeze({
  amex_mr:["amex_gold","amex_platinum"],
  chase_ur:["chase_preferred","chase_reserve"],
  capital_one_miles:["venture","venture_x"]
});
export const AIRLINE_CARDS=Object.freeze({
  delta:["delta_platinum","delta_reserve"],
  united:["united_explorer","united_quest","united_club"],
  american:["aa_executive"],
  southwest:["southwest_priority"]
});
export const HOTEL_CARDS=Object.freeze({
  hyatt:["hyatt_consumer"],
  marriott:["marriott_boundless","marriott_brilliant"],
  hilton:["hilton_no_fee","hilton_surpass","hilton_aspire"]
});
export const STRATEGY_REPRESENTATIVES=Object.freeze(["amex_gold","chase_preferred","venture"]);

const uniq=a=>[...new Set((a||[]).filter(Boolean))].sort();

export function normalizeEntityRequest(x){
  return {
    cards:uniq((x?.cards||[]).map(v=>String(v||"").trim().toLowerCase())),
    airlines:uniq((x?.airlines||[]).map(v=>String(v||"").trim().toLowerCase())),
    hotels:uniq((x?.hotels||[]).map(v=>String(v||"").trim().toLowerCase()))
  };
}
export function sameEntityRequest(a,b){
  return JSON.stringify(normalizeEntityRequest(a))===JSON.stringify(normalizeEntityRequest(b));
}
export function stageOneEntities(profile,E){
  const p=E.normalizeProfile(profile||{});
  return normalizeEntityRequest({
    cards:[...(p.currentCards||[]),...(p.constraints?.requiredCards||[]),...STRATEGY_REPRESENTATIVES],
    airlines:p.airline?.primary?[p.airline.primary]:[],
    hotels:p.hotel?.primary?[p.hotel.primary]:[]
  });
}
export function finalEntities(profile,E){
  const p=E.normalizeProfile(profile||{}),travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel);
  const prohibited=new Set(p.constraints?.prohibitedCards||[]),current=new Set(p.currentCards||[]),required=new Set(p.constraints?.requiredCards||[]);
  const candidates=[
    ...((FLEX_CARDS[rewards.primaryCurrency])||[]),
    ...((AIRLINE_CARDS[p.airline?.primary])||[]),
    ...((HOTEL_CARDS[p.hotel?.primary])||[])
  ].filter(id=>!prohibited.has(id)||current.has(id)||required.has(id));
  return {
    request:normalizeEntityRequest({
      cards:[...(p.currentCards||[]),...(p.constraints?.requiredCards||[]),...candidates],
      airlines:p.airline?.primary?[p.airline.primary]:[],
      hotels:p.hotel?.primary?[p.hotel.primary]:[]
    }),
    travelStrategy:travel,
    rewardsStrategy:rewards
  };
}
export function chunkEntityRequest(req,max=12){
  const r=normalizeEntityRequest(req),flat=[
    ...r.cards.map(id=>({kind:"cards",id})),
    ...r.airlines.map(id=>({kind:"airlines",id})),
    ...r.hotels.map(id=>({kind:"hotels",id}))
  ],out=[];
  for(let i=0;i<flat.length;i+=max){
    const x={cards:[],airlines:[],hotels:[]};
    for(const e of flat.slice(i,i+max))x[e.kind].push(e.id);
    out.push(x);
  }
  return out;
}
export function verificationGaps(snapshot,req){
  const r=normalizeEntityRequest(req),out=[];
  for(const kind of ["cards","airlines","hotels"]){
    for(const id of r[kind]){
      const row=snapshot?.[kind]?.[id];
      if(!row||row.verificationStatus!=="verified"||row.complete!==true)out.push({kind,id,status:row?.verificationStatus||"missing",unresolved:row?.unresolved||[]});
    }
  }
  return out;
}
export function mergeSnapshotParts(parts,snapshotId,verifiedAt){
  const out={schema:"qp-verified-facts-v1",snapshotId,verifiedAt,sources:[],cards:{},airlines:{},hotels:{}},seen=new Set();
  for(const p of parts||[]){
    for(const kind of ["cards","airlines","hotels"])Object.assign(out[kind],p?.[kind]||{});
    for(const s of p?.sources||[]){const k=JSON.stringify(s);if(!seen.has(k)){seen.add(k);out.sources.push(s)}}
  }
  return out;
}
