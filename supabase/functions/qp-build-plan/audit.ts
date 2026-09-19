const num=(x:any)=>Number.isFinite(Number(x))?Number(x):0;

export function auditPlan(result:any,E:any){
  const errors:any[]=[];
  const warnings:any[]=[];
  if(!result?.factQuality?.productionReady)errors.push({code:"facts_not_production_ready"});
  const sid=result?.factsSnapshot?.snapshotId||"";
  if(!sid)errors.push({code:"missing_snapshot_id"});
  if(result?.current?.factsSnapshotId!==sid||result?.recommended?.factsSnapshotId!==sid)errors.push({
    code:"snapshot_mismatch",
    current:result?.current?.factsSnapshotId||"",
    recommended:result?.recommended?.factsSnapshotId||"",
    expected:sid
  });

  const rec=result?.recommended||{},profile=result?.profile||{},primary=result?.rewardsStrategy?.primaryCurrency||"";
  const portfolio=new Set(rec.portfolio||[]);
  const roles=new Map((rec.cardRoles||[]).map((r:any)=>[r.cardId,r.role]));
  const routed:any={};

  for(const [category,rows] of Object.entries(rec.ongoingRouting||{})){
    for(const row of rows as any[]){
      const id=row?.card,amt=num(row?.amount);
      if(!id||amt<=0)continue;
      routed[id]=(routed[id]||0)+amt;
      const facts=E.cardFacts(profile,id);
      if(!facts){errors.push({code:"routing_unknown_card",cardId:id,category});continue}
      if(facts.kind==="flex"&&primary&&facts.currency!==primary)errors.push({
        code:"secondary_flexible_ecosystem_routine_spend",cardId:id,category,currency:facts.currency,primaryCurrency:primary,amount:amt
      });
      if(facts.kind==="airline"&&category!=="airfare")errors.push({code:"airline_cobrand_wrong_routine_category",cardId:id,category,amount:amt});
      if(facts.kind==="hotel"&&category!=="hotel")errors.push({code:"hotel_cobrand_wrong_routine_category",cardId:id,category,amount:amt});
    }
  }

  if(primary==="chase_ur"&&String(profile?.redemptionPartner||"").toLowerCase()==="hyatt"){
    for(const id of portfolio){
      const facts=E.cardFacts(profile,id);
      if(facts?.kind==="flex"&&facts?.currency==="chase_ur"&&facts?.transferRules?.hyatt?.defaultRatio==null)errors.push({code:"hyatt_transfer_ratio_unverified",cardId:id});
    }
  }

  for(const id of portfolio){
    const facts=E.cardFacts(profile,id),role=roles.get(id)||"";
    if(!facts){errors.push({code:"portfolio_unknown_card",cardId:id});continue}
    if(num(facts.annualFee)>0&&(!role||role==="no_job"))errors.push({code:"paid_card_without_job",cardId:id,annualFee:num(facts.annualFee),role});
    if(role==="no_job"&&num(routed[id])>0)errors.push({code:"no_job_card_receives_routine_spend",cardId:id,amount:num(routed[id])});
  }

  for(const job of rec.temporaryJobs||[]){
    if(!job?.cardId)errors.push({code:"temporary_job_missing_card"});
    if(!(num(job?.spendRequired)>0))errors.push({code:"temporary_job_missing_spend_target",cardId:job?.cardId||""});
    if(!job?.stopCondition)errors.push({code:"temporary_job_missing_stop_condition",cardId:job?.cardId||""});
    if(!job?.nextStep||typeof job.nextStep!=="object"||Object.keys(job.nextStep).length===0)errors.push({code:"temporary_job_missing_post_threshold_routing",cardId:job?.cardId||""});
  }

  for(const action of rec.actions||[]){
    const inPortfolio=portfolio.has(action.cardId);
    if(action.action==="add"&&!inPortfolio)errors.push({code:"add_action_card_not_in_portfolio",cardId:action.cardId});
    if(action.action==="keep"&&!inPortfolio)errors.push({code:"keep_action_card_not_in_portfolio",cardId:action.cardId});
    if((action.action==="remove_or_downgrade_after_review"||action.action==="manual_review_before_removal")&&inPortfolio)errors.push({code:"removal_action_card_still_in_portfolio",cardId:action.cardId});
  }

  const integrity=result?.integrity||{};
  for(const key of ["travelStrategyPrecedesCards","primaryFlexibleEcosystem","ongoingAndTemporaryRoutingSeparated","temporaryJobsHaveExplicitHandoffs","welcomeOffersExcludedFromSelection","currentBenefitsAreBaselineNotIncrementalCredit","verifiedFactsSnapshotSupported","volatileFactsSeparatedFromDecisionRules","verifiedFactsImmutablePerAnalysis"]){
    if(integrity[key]!==true)errors.push({code:"required_integrity_flag_missing",flag:key,value:integrity[key]});
  }

  if((rec.portfolio||[]).length===0&&num(profile?.totalSpend)>0)warnings.push({code:"nonzero_spend_with_empty_portfolio"});
  return{pass:errors.length===0,errors,warnings,checkedAt:new Date().toISOString()};
}
