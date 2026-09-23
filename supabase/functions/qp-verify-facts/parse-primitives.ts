const moneyAmount=v=>{const n=Number(String(v??"").replace(/[$,%\s,]/g,""));return Number.isFinite(n)?n:null};
const globalFlags=re=>{let f="g";if(re.ignoreCase)f+="i";if(re.multiline)f+="m";if(re.dotAll)f+="s";return f};

export function feeFromText(t){
  const text=String(t||"");
  const intro=[
    /\$\s*0[^.]{0,80}(?:intro|introductory) annual fee[^.]{0,120}then\s+\$\s*([\d,]+)/i,
    /(?:intro|introductory) annual fee[^.]{0,100}\$\s*0[^.]{0,120}then\s+\$\s*([\d,]+)/i
  ];
  for(const re of intro){const m=text.match(re);if(m)return moneyAmount(m[1])}
  const candidates=[];
  const numeric=[
    /Annual Fee[^$]{0,80}\$\s*([\d,]+)/gi,
    /\$\s*([\d,]+)[^.\n]{0,45}annual fee/gi,
    /then\s+\$\s*([\d,]+)[^.\n]{0,80}annual fee/gi
  ];
  for(const re of numeric){
    for(const m of text.matchAll(re)){const v=moneyAmount(m[1]);if(v!=null)candidates.push({index:m.index??0,value:v})}
  }
  for(const m of text.matchAll(/No Annual Fee/gi))candidates.push({index:m.index??0,value:0});
  for(const m of text.matchAll(/\$\s*0[^.\n]{0,30}annual fee/gi))candidates.push({index:m.index??0,value:0});
  candidates.sort((a,b)=>a.index-b.index);
  return candidates.length?candidates[0].value:null;
}

export function rateNear(t,words){
  const text=String(t||"");
  for(const word of words||[]){
    const targetRe=new RegExp(word.source,globalFlags(word));
    for(const target of text.matchAll(targetRe)){
      const ti=target.index??0;
      let left=ti,right=ti+target[0].length;
      for(let i=ti-1;i>=Math.max(0,ti-180);i--){if(/[.;!?]/.test(text[i])){left=i+1;break}else left=i}
      for(let i=ti+target[0].length;i<Math.min(text.length,ti+target[0].length+180);i++){if(/[.;!?]/.test(text[i])){right=i;break}else right=i+1}
      const segment=text.slice(left,right),targetLocal=ti-left;
      const mult=/([0-9]+(?:\.[0-9]+)?)\s*[xX]\b|([0-9]+(?:\.[0-9]+)?)\s+(?:miles?|points?)\s+per\s+(?:dollar|\$1)/gi;
      const matches=[...segment.matchAll(mult)].map(m=>({index:m.index??0,value:Number(m[1]||m[2]),text:m[0]})).filter(x=>x.value>0);
      const preceding=matches.filter(x=>x.index<=targetLocal).sort((a,b)=>b.index-a.index);
      if(preceding.length&&targetLocal-(preceding[0].index+preceding[0].text.length)<=120)return preceding[0].value;
      const following=matches.filter(x=>x.index>targetLocal).sort((a,b)=>a.index-b.index);
      if(following.length&&following[0].index-(targetLocal+target[0].length)<=120)return following[0].value;
    }
  }
  return null;
}
