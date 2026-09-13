const QP_SUPABASE_URL='https://jdtbyudbwmwldrkjaznk.supabase.co';
const QP_SUPABASE_KEY='sb_publishable_BETG0zmWAEmPByBsKyEUzA_yPCOkh5F';
const QP_FUNNEL_KEY='qp_funnel_session_v1';
(function loadQpPageFixes(){
  try{
    const p=location.pathname.replace(/\/+$/,'');
    if(p===''||p.endsWith('/index.html')){
      const l=document.createElement('link');l.rel='stylesheet';l.href='assets/v215-home-fixes.css?v=215';document.head.appendChild(l);
      const bundles=[
        ['Extra-legroom seats more often','Fewer cash upgrades','Stronger upgrade position'],
        ['Qualify earlier in the year','More months receiving status benefits','Better priority when travel goes wrong'],
        ['More meaningful recognition','Better upgrade opportunities','More premium-stay benefits'],
        ['Greater redemption capacity','More international travel options','Less cash required for premium travel']
      ];
      document.querySelectorAll('.experience-card').forEach((card,i)=>{
        const pEl=card.querySelector('p');if(pEl)pEl.remove();
        const ul=document.createElement('ul');ul.className='experience-list';
        (bundles[i]||[]).forEach(text=>{const li=document.createElement('li');li.textContent=text;ul.appendChild(li)});
        card.appendChild(ul);
      });
      const footerTag=document.querySelector('.footer-tag');
      if(footerTag)footerTag.textContent=footerTag.textContent.replace(/Build v[\d.]+/,'Build v2.1.2');
    }
  }catch(_){}
})();
function qpGetSession(){try{let id=sessionStorage.getItem(QP_FUNNEL_KEY);if(id&&/^[A-Za-z0-9_-]{12,80}$/.test(id))return id;if(globalThis.crypto?.randomUUID)id=crypto.randomUUID().replaceAll('-','');else{id=`s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,14)}`;}sessionStorage.setItem(QP_FUNNEL_KEY,id);return id;}catch(_){return `fallback_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,14)}`;}}
const qpFunnelSession=qpGetSession();
function qpCleanMeta(meta={}){const allow=new Set(['placement','section','source','page','build','step','spend_band','airline','priority']);const out={};Object.entries(meta||{}).forEach(([k,v])=>{if(allow.has(k)&&(typeof v==='string'||typeof v==='number'||typeof v==='boolean'))out[k]=v;});return out;}
async function qpCentralTrack(name,meta={}){try{await fetch(`${QP_SUPABASE_URL}/rest/v1/rpc/qp_log_event_v2`,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','apikey':QP_SUPABASE_KEY},body:JSON.stringify({p_event_type:name,p_session_id:qpFunnelSession,p_architecture_id:null,p_token:null,p_metadata:qpCleanMeta(meta)})});}catch(_){}}
function track(name,meta={}){let normalized={...meta};if(normalized.page==='homepage')normalized.build='2.1.2';const clean=qpCleanMeta(normalized);try{if(typeof gtag==='function')gtag('event',name,clean);}catch(_){}qpCentralTrack(name,clean);}
