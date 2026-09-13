const qpAnalysisFix=document.createElement('link');qpAnalysisFix.rel='stylesheet';qpAnalysisFix.href='assets/v215-analysis-fixes.css?v=215';document.head.appendChild(qpAnalysisFix);
const intro=document.getElementById('intro');
const quick=document.getElementById('quick');
const preview=document.getElementById('preview');
const form=document.getElementById('quick-form');
const startBtn=document.getElementById('start-analysis');
const priorities=[...document.querySelectorAll('.choice')];
const selected=new Set();
const spendMap={
  '75-100':{label:'$75,000–$100,000',mid:87500,current:'~90–115K',potential:'~175–220K'},
  '100-150':{label:'$100,000–$150,000',mid:125000,current:'~125–160K',potential:'~250–315K'},
  '150-200':{label:'$150,000–$200,000',mid:175000,current:'~175–225K',potential:'~350–440K'},
  '200-300':{label:'$200,000–$300,000',mid:250000,current:'~250–325K',potential:'~500–625K'},
  '300+':{label:'$300,000+',mid:300000,current:'~300K+',potential:'~600K+'}
};
const flightMap={'1-5':3,'6-12':9,'13-24':18,'25-40':32,'40+':45};
function show(which){[intro,quick,preview].forEach(x=>x.classList.add('hidden'));which.classList.remove('hidden');window.scrollTo({top:0,behavior:'instant'});}
startBtn.addEventListener('click',()=>{show(quick);track('quick_analysis_start',{page:'analysis',build:'2.1.2'});});
priorities.forEach(btn=>btn.addEventListener('click',()=>{const v=btn.dataset.value;if(selected.has(v)){selected.delete(v);btn.classList.remove('selected');btn.setAttribute('aria-pressed','false');return;}if(selected.size>=2){const first=[...selected][0];selected.delete(first);const old=priorities.find(x=>x.dataset.value===first);old?.classList.remove('selected');old?.setAttribute('aria-pressed','false');}selected.add(v);btn.classList.add('selected');btn.setAttribute('aria-pressed','true');}));
function cleanAirport(v){return String(v||'').trim().toUpperCase().slice(0,5)}
function validate(){let ok=true;form.querySelectorAll('.question').forEach(q=>q.classList.remove('invalid'));['spend_band','home_airport','primary_airline','flights'].forEach(id=>{const el=document.getElementById(id);if(!el.value.trim()){el.closest('.question').classList.add('invalid');ok=false;}});if(!selected.size){document.getElementById('priority-q').classList.add('invalid');ok=false;}return ok;}
function buildDraft(data){try{const desired=[...selected].map(v=>({seats:'upgrades',upgrades:'upgrades',hotels:'hotel recognition',international:'redemption'}[v]||v));const draft={step:0,data:{primary_airline_eco:data.primary_airline,flights_taken:flightMap[data.flights]||'',home_airport:data.home_airport,total_spend:spendMap[data.spend_band]?.mid||'',desired_outcomes:desired},at:Date.now()};localStorage.setItem('qp_architecture_phase5_draft',JSON.stringify(draft));sessionStorage.setItem('qp_quick_analysis_v1',JSON.stringify(data));}catch(_){}}
function personalizeImpacts(data){
  const seats=document.getElementById('impact-seats');
  const trips=document.getElementById('impact-trips');
  const hotels=document.getElementById('impact-hotels');
  const cash=document.getElementById('impact-cash');
  seats.textContent=data.priorities.includes('seats')||data.priorities.includes('upgrades')?'Your priorities make seating, upgrade position and useful status a central part of the full analysis.':'The full analysis tests whether your travel pattern can support better seating, upgrades or useful status.';
  trips.textContent=data.priorities.includes('international')?'Your full analysis will test how much more international and premium-trip capacity the same spend could create.':'Higher redemption capacity can turn the same spending into more premium trips instead of more points for their own sake.';
  hotels.textContent=data.priorities.includes('hotels')?'Hotel recognition is one of your priorities, so the full analysis will test whether your stay pattern can support meaningful status or premium-hotel value.':'The full analysis will test whether your real hotel behavior supports stronger recognition or better premium-stay value.';
  cash.textContent='The goal is to have more of the premium travel you already value funded by the value your spending produces, reducing the need to buy every upgrade or trip with cash.';
}
function renderImpactBullets(data){
  const bundles=[
    ['Extra-legroom seats more often','Stronger upgrade position','Useful status where your travel supports it'],
    [data.priorities.includes('international')?'More international travel options':'More premium-trip capacity','Greater redemption capacity','Less cash needed for premium travel'],
    ['Recognition that actually matters','More upgrade opportunities','More value from premium stays'],
    ['Fewer paid upgrades','More travel funded by earned value','Keep cash for what points cannot cover']
  ];
  document.querySelectorAll('.impact').forEach((card,i)=>{
    card.querySelector('p')?.remove();card.querySelector('.impact-list')?.remove();
    const ul=document.createElement('ul');ul.className='impact-list';
    (bundles[i]||[]).forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.appendChild(li)});card.appendChild(ul);
  });
}
form.addEventListener('submit',e=>{e.preventDefault();if(!validate()){track('assessment_validation_error',{page:'analysis',section:'quick_analysis',build:'2.1.2'});return;}const data={spend_band:document.getElementById('spend_band').value,home_airport:cleanAirport(document.getElementById('home_airport').value),primary_airline:document.getElementById('primary_airline').value,flights:document.getElementById('flights').value,priorities:[...selected]};buildDraft(data);const m=spendMap[data.spend_band];document.getElementById('preview-spend').textContent=`Based on approximately ${m.label} in annual personal-card spend. This is a directional preview, not your final recommendation.`;document.getElementById('current-points').textContent=m.current;document.getElementById('potential-points').textContent=m.potential;personalizeImpacts(data);renderImpactBullets(data);show(preview);track('quick_analysis_complete',{page:'analysis',build:'2.1.2',spend_band:data.spend_band,airline:data.primary_airline,priority:data.priorities[0]||''});track('preliminary_result_view',{page:'analysis',build:'2.1.2',spend_band:data.spend_band});});
const fullAnalysis=document.getElementById('full-analysis');
fullAnalysis.href='refine.html?from=quick';
fullAnalysis.addEventListener('click',()=>track('full_analysis_cta',{page:'analysis',placement:'preliminary_result',build:'2.1.2'}));
document.getElementById('edit-quick').addEventListener('click',()=>show(quick));
track('analysis_intro_view',{page:'analysis',build:'2.1.2'});
