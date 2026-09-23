(()=>{
"use strict";
function storageKey(){
  const meta=window.QP_PLAN_ACTIVE_RESULT?.meta||{};
  return "qp-plan-checks:"+(meta.factsSnapshotId||"preview");
}
function restoreChecks(){
  let saved={};try{saved=JSON.parse(sessionStorage.getItem(storageKey())||"{}")}catch{}
  document.querySelectorAll("[data-action-id]").forEach(x=>{x.checked=!!saved[x.dataset.actionId]});
}
function saveChecks(){
  const saved={};document.querySelectorAll("[data-action-id]").forEach(x=>{if(x.checked)saved[x.dataset.actionId]=true});
  try{sessionStorage.setItem(storageKey(),JSON.stringify(saved))}catch{}
}
function bind(){
  const menu=document.querySelector(".mobile-menu"),rail=document.querySelector(".rail");
  menu?.addEventListener("click",()=>document.body.classList.toggle("nav-open"));
  rail?.addEventListener("click",e=>{if(e.target.closest("a"))document.body.classList.remove("nav-open")});
  document.addEventListener("change",e=>{if(e.target.matches("[data-action-id]"))saveChecks()});
  restoreChecks();
  const links=[...document.querySelectorAll("[data-nav]")],sections=[...document.querySelectorAll("[data-section]")];
  if("IntersectionObserver" in window){
    const io=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        links.forEach(a=>a.classList.toggle("active",a.dataset.nav===entry.target.id));
      }
    },{rootMargin:"-20% 0px -70% 0px"});
    sections.forEach(s=>io.observe(s));
  }
}
document.addEventListener("qp-plan-rendered",bind);
})();