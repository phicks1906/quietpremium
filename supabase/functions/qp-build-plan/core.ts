export const FLEX_CARDS=Object.freeze({
  amex_mr:["amex_green","amex_gold","amex_platinum"],
  chase_ur:["chase_preferred","chase_freedom_unlimited","chase_freedom_flex","chase_reserve"],
  capital_one_miles:["venture_one","venture","venture_x"]
});
export const AIRLINE_CARDS=Object.freeze({
  delta:["delta_blue","delta_gold","delta_platinum","delta_reserve"],
  united:["united_gateway","united_explorer","united_quest","united_club"],
  american:["aa_mileup","aa_platinum_select","aa_globe","aa_executive"],
  southwest:["southwest_plus","southwest_premier","southwest_priority"]
});
export const HOTEL_CARDS=Object.freeze({
  hyatt:["hyatt_consumer"],
  marriott:["marriott_bold","marriott_boundless","marriott_bountiful","marriott_bevy","marriott_brilliant"],
  hilton:["hilton_no_fee","hilton_surpass","hilton_aspire"]
});
export const STRATEGY_REPRESENTATIVES=Object.freeze(["amex_gold","chase_preferred","venture"]);
export const EXISTING_ONLY_CARDS=Object.freeze(["chase_freedom_rise"]);

const uniq=(a:string[])=>[...new Set((a||[]).filter(Boolean))].sort();

export function normalizeEntityRequest(x:any){
  return {
    cards:uniq((x?.cards||[]).map((v:any)=>String(v||"").trim().toLowerCase())),
    airlines:uniq((x?.airlines||[]).map((v:any)=>String(v||"").trim().toLowerCase())),
    hotels:uniq((x?.hotels||[]).map((v:any)=>String(v||"").trim().toLowerCase()))
  };
}
export function sameEntityRequest(a:any,b:any){
  return JSON.stringify(normalizeEntityRequest(a))===JSON.stringify(normalizeEntityRequest(b));
}
export function stageOneEntities(profile:any,E:any){
  const p=E.normalizeProfile(profile||{});
  return normalizeEntityRequest({
    cards:[...(p.currentCards||[]),...(p.constraints?.requiredCards||[]),...STRATEGY_REPRESENTATIVES],
    airlines:p.airline?.primary?[p.airline.primary]:[],
    hotels:p.hotel?.primary?[p.hotel.primary]:[]
  });
}
export function finalEntities(profile:any,E:any){
  const p=E.normalizeProfile(profile||{}),travel=E.travelStrategy(p),rewards=E.rewardsStrategy(p,travel);
  const prohibited=new Set(p.constraints?.prohibitedCards||[]),current=new Set(p.currentCards||[]),required=new Set(p.constraints?.requiredCards||[]);
  const candidates=[
    ...(FLEX_CARDS as any)[rewards.primaryCurrency]||[],
    ...(AIRLINE_CARDS as any)[p.airline?.primary]||[],
    ...(HOTEL_CARDS as any)[p.hotel?.primary]||[]
  ].filter((id:string)=>!prohibited.has(id)||current.has(id)||required.has(id));
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
export function chunkEntityRequest(req:any,max=12){
  const r=normalizeEntityRequest(req),flat=[
    ...r.cards.map(id=>({kind:"cards",id})),
    ...r.airlines.map(id=>({kind:"airlines",id})),
    ...r.hotels.map(id=>({kind:"hotels",id}))
  ],out:any[]=[];
  for(let i=0;i<flat.length;i+=max){
    const x:any={cards:[],airlines:[],hotels:[]};
    for(const e of flat.slice(i,i+max))x[e.kind].push(e.id);
    out.push(x);
  }
  return out;
}
export function verificationGaps(snapshot:any,req:any){
  const r=normalizeEntityRequest(req),out:any[]=[];
  for(const kind of ["cards","airlines","hotels"]){
    for(const id of (r as any)[kind]){
      const row=snapshot?.[kind]?.[id];
      if(!row||row.verificationStatus!=="verified"||row.complete!==true)out.push({kind,id,status:row?.verificationStatus||"missing",unresolved:row?.unresolved||[]});
    }
  }
  return out;
}
export function mergeSnapshotParts(parts:any[],snapshotId:string,verifiedAt:string){
  const out:any={schema:"qp-verified-facts-v1",snapshotId,verifiedAt,sources:[],cards:{},airlines:{},hotels:{}},seen=new Set<string>();
  for(const p of parts||[]){
    for(const kind of ["cards","airlines","hotels"])Object.assign(out[kind],p?.[kind]||{});
    for(const s of p?.sources||[]){const k=JSON.stringify(s);if(!seen.has(k)){seen.add(k);out.sources.push(s)}}
  }
  return out;
}
