const lower=s=>String(s||"").toLowerCase();

function mainHtml(raw){
  const l=lower(raw),start=l.indexOf("<main");
  if(start<0)return "";
  const end=l.indexOf("</main>",start);
  return end>start?raw.slice(start,end+7):raw.slice(start);
}
function decodeEmbedded(s){
  return String(s||"")
    .replace(/\\u003c/gi,"<").replace(/\\u003e/gi,">").replace(/\\u0026/gi,"&")
    .replace(/\\u0027/gi,"'").replace(/\\u0022/gi,'"')
    .replace(/\\n/g," ").replace(/\\r/g," ").replace(/\\t/g," ")
    .replace(/\\\\"/g,'"');
}
function greenComparison(raw){
  const l=lower(raw);let p=-1;
  for(let i=0;i<20;i++){
    p=l.indexOf("f2a",p+1);if(p<0)break;
    const candidate=raw.slice(p,Math.min(raw.length,p+30000));
    if(/annual fee/i.test(candidate)&&/3xOnTravel/i.test(candidate)&&/3xOnTransit/i.test(candidate)&&/3XAtRestaurants/i.test(candidate))return decodeEmbedded(candidate);
  }
  return "";
}
function capitalOneProduct(raw,id){
  const brand={venture_one:"ventureone",venture:"venture",venture_x:"venturex"}[id]||"";
  const l=lower(raw);
  let start=brand?l.indexOf('data-personalizationanalytics-brandcode="'+brand+'"'):-1;
  if(start<0){
    const names={venture_one:["ventureone rewards from capital one","ventureone rewards"],venture:["venture rewards from capital one","venture rewards"],venture_x:["venture x rewards from capital one","venture x rewards"]};
    for(const t of names[id]||[]){const p=l.indexOf(t);if(p>=0&&(start<0||p<start))start=p}
  }
  if(start<0)return "";
  start=Math.max(0,start-7000);
  const endMarker="not the right card for you?";
  const end=l.indexOf(endMarker,start);
  return raw.slice(start,end>start?end:Math.min(raw.length,start+120000));
}
export function sourceReadLimit(url,kind,id,defaultLimit=2000000){
  if(kind==="cards"&&id==="amex_green"&&/americanexpress\.com\/us\/credit-cards\/card\/green\/?/i.test(url))return 3500000;
  return defaultLimit;
}
export function scopeSourceHtml(raw,url,kind,id,finalUrl=""){
  const loc=String(url||"")+" "+String(finalUrl||"");
  if(kind!=="cards")return raw;
  if(id==="amex_green"&&/americanexpress\.com\/us\/credit-cards\/card\/green\/?/i.test(loc)){
    return greenComparison(raw)||raw;
  }
  if(/americanexpress\.com\/us\/credit-cards\/card\//i.test(loc)){
    return mainHtml(raw)||raw;
  }
  if(/(?:global\.americanexpress\.com\/card-benefits|americanexpress\.com\/en-us\/(?:travel\/benefits|credit-cards\/credit-intel))/i.test(loc)){
    return mainHtml(raw)||raw;
  }
  if(/(?:creditcards\.chase\.com|chase\.com\/sapphire-cards|chase\.com\/personal\/credit-cards)/i.test(loc)){
    return mainHtml(raw)||raw;
  }
  if(/capitalone\.com\/credit-cards\/(?:ventureone|venture|venture-x)\/?/i.test(loc)){
    return capitalOneProduct(raw,id)||raw;
  }
  return raw;
}
