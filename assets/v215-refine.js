(function(){
  'use strict';
  document.title='Full Analysis — Quiet Premium';
  const $=id=>document.getElementById(id);
  const titleMap={
    'How You Travel':'Travel details',
    'Where You Stay':'Hotel details',
    'Your Spend & Cards':'Cards & spending',
    'What You Already Get':'Benefits you actually use',
    'What You Want':'Your priorities'
  };
  const noteMap={
    '1':'We already filled what you gave us. Add the travel details needed to make the status and upgrade model precise.',
    '2':'Add hotel details only if they matter to your travel. Quiet Premium can also conclude that no hotel-status strategy is worth pursuing.',
    '3':'This is where the preliminary result becomes specific to your actual cards and spending. Estimates are fine.',
    '4':'Optional. Add only benefits you genuinely use or would otherwise pay for. Skip anything that does not matter to you.',
    '5':'Choose the outcomes you care about most so the recommendation fits your real travel priorities.'
  };

  function setIntro(){
    const assessment=$('assessment');if(!assessment)return;
    const shell=assessment.querySelector('.shell');
    const eyebrow=shell?.querySelector(':scope > .eyebrow');
    const h1=shell?.querySelector(':scope > h1');
    const intro=shell?.querySelector(':scope > .intro');
    const promises=shell?.querySelectorAll(':scope > .promise span');
    if(eyebrow)eyebrow.textContent='Refine — optional detail';
    if(h1)h1.innerHTML='Make your result<br><em>more precise.</em>';
    if(intro)intro.textContent='You already have a preliminary view. Add the details below so Quiet Premium can test your exact cards, spend routing, hotel behavior and benefits — without making you start over.';
    const promiseCopy=['Already started','Saved as you go','No card numbers','Skip optional details'];
    promises?.forEach((el,i)=>{if(promiseCopy[i])el.textContent=promiseCopy[i]});
    const navLabel=document.querySelector('.nav-label');if(navLabel)navLabel.textContent='Full Analysis';
  }

  function renameStepTitle(){
    const el=$('step-title');if(!el)return;
    const mapped=titleMap[el.textContent.trim()];if(mapped)el.textContent=mapped;
  }

  function rewriteNotes(){
    document.querySelectorAll('#architecture-form .step').forEach(step=>{
      const note=step.querySelector('.section-note');
      const text=noteMap[step.dataset.step];if(note&&text)note.textContent=text;
    });
  }

  function badgeOptionalFields(){
    document.querySelectorAll('#architecture-form .field:not([data-required]) > label').forEach(label=>{
      if(label.querySelector('.qp-optional-badge'))return;
      const badge=document.createElement('span');badge.className='qp-optional-badge';badge.textContent='optional';label.appendChild(badge);
    });
  }

  function collapsePointBalances(){
    const box=document.querySelector('.points-box');
    if(!box||box.closest('.qp-optional'))return;
    const details=document.createElement('details');details.className='qp-optional';
    const summary=document.createElement('summary');summary.textContent='Point balances (optional)';
    const body=document.createElement('div');body.className='qp-optional-body';
    box.parentNode.insertBefore(details,box);details.appendChild(summary);details.appendChild(body);body.appendChild(box);
  }

  function fieldFor(id){return $(id)?.closest('.field')||null}
  function addPrefillSummary(step,defs){
    if(!step||step.querySelector('.qp-prefill-summary'))return;
    const known=[];
    defs.forEach(([id,label])=>{
      const el=$(id);if(!el||!String(el.value||'').trim())return;
      const field=fieldFor(id);if(field){field.classList.add('qp-prefilled');known.push({field,label,value:el.value});}
    });
    if(!known.length)return;
    const summary=document.createElement('div');summary.className='qp-prefill-summary';
    const kicker=document.createElement('div');kicker.className='qp-prefill-kicker';kicker.textContent='Already provided';summary.appendChild(kicker);
    const items=document.createElement('div');items.className='qp-prefill-items';
    known.forEach(x=>{const s=document.createElement('span');s.textContent=`${x.label}: ${x.value}`;items.appendChild(s)});summary.appendChild(items);
    const edit=document.createElement('button');edit.type='button';edit.className='qp-prefill-edit';edit.textContent='Edit these answers';edit.addEventListener('click',()=>{step.classList.toggle('qp-show-prefill');edit.textContent=step.classList.contains('qp-show-prefill')?'Hide these answers':'Edit these answers'});summary.appendChild(edit);
    const note=step.querySelector('.section-note');if(note)note.after(summary);else step.prepend(summary);
  }

  function applyPrefill(){
    const s1=document.querySelector('.step[data-step="1"]');
    const s3=document.querySelector('.step[data-step="3"]');
    addPrefillSummary(s1,[['primary_airline_eco','Airline'],['flights_taken','Flights'],['home_airport','Home airport']]);
    addPrefillSummary(s3,[['total_spend','Annual spend']]);
  }

  function watchStepTitle(){
    const el=$('step-title');if(!el)return;
    renameStepTitle();
    new MutationObserver(renameStepTitle).observe(el,{childList:true,characterData:true,subtree:true});
  }

  function enhance(){
    setIntro();rewriteNotes();badgeOptionalFields();collapsePointBalances();watchStepTitle();applyPrefill();
    document.querySelectorAll('input,select,textarea').forEach(el=>{el.style.fontSize='16px'});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(enhance,80);setTimeout(applyPrefill,420)});
  else{setTimeout(enhance,80);setTimeout(applyPrefill,420)}
})();
