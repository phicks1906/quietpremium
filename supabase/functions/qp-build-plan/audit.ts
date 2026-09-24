const num=x=>Number.isFinite(Number(x))?Number(x):0;
const list=x=>Array.isArray(x)?x:[];

export function recurringThresholdMoveAllowance(rec){
  const allowed={},seen=new Set();
  for(const job of list(rec?.recurringJobs)){
    if(job?.type!=="annual_threshold"||job?.recurring!==true||!job?.cardId)continue;
    for(const move of list(job?.moves)){
      const category=String(move?.category||""),toCard=String(move?.toCard||"");
      const amount=num(move?.amount);
      if(!category||toCard!==String(job.cardId)||amount<=0)continue;
      const from=list(move?.from).map(x=>({card:String(x?.card||""),amount:num(x?.amount)})).filter(x=>x.card&&x.amount>0).sort((a,b)=>a.card.localeCompare(b.card)||a.amount-b.amount);
      const sig=JSON.stringify({cardId:String(job.cardId),category,toCard,amount,from});
      if(seen.has(sig))continue;
      seen.add(sig);
      const key=toCard+"|"+category;
      allowed[key]=num(allowed[key])+amount;
    }
  }
  return allowed;
}

export function auditPlan(result,E){
  const errors=[],warnings=[];
  if(!result?.factQuality?.productionReady)errors.push({code:"facts_not_production_ready"});
  if(!result?.factQuality?.valuation?.productionReady)errors.push({code:"valuation_not_production_ready"});

  const sid=result?.factsSnapshot?.snapshotId||"";
  if(!sid)errors.push({code:"missing_snapshot_id"});
  if(result?.current?.factsSnapshotId!==sid||result?.recommended?.factsSnapshotId!==sid)errors.push({
    code:"snapshot_mismatch",
    current:result?.current?.factsSnapshotId||"",
    recommended:result?.recommended?.factsSnapshotId||"",
    expected:sid
  });

  const valuationId=result?.valuationSnapshot?.snapshotId||"",approvedValuationId=E?.CURRENT_QP_VALUATION_SNAPSHOT?.snapshotId||"";
  if(!valuationId)errors.push({code:"missing_valuation_snapshot_id"});
  if(approvedValuationId&&valuationId!==approvedValuationId)errors.push({code:"valuation_snapshot_not_current_approved",actual:valuationId,expected:approvedValuationId});
  if(result?.profile?.valuationSnapshot?.snapshotId!==valuationId)errors.push({code:"valuation_snapshot_profile_mismatch",profile:result?.profile?.valuationSnapshot?.snapshotId||"",result:valuationId});

  const rec=result?.recommended||{},profile=result?.profile||{},primary=result?.rewardsStrategy?.primaryCurrency||"";
  const portfolio=new Set(rec.portfolio||[]),required=new Set(profile?.constraints?.requiredCards||[]);
  const roles=new Map((rec.cardRoles||[]).map(r=>[r.cardId,r.role]));
  const routed={},thresholdAllowance=recurringThresholdMoveAllowance(rec),thresholdUsed={};
  const thresholdMoveAllowed=(cardId,category,amount)=>{
    const key=String(cardId)+"|"+String(category),used=num(thresholdUsed[key]),allowed=num(thresholdAllowance[key]);
    if(used+amount>allowed+1e-6)return false;
    thresholdUsed[key]=used+amount;return true;
  };

  for(const [category,rows] of Object.entries(rec.ongoingRouting||{})){
    for(const row of list(rows)){
      const id=row?.card,amt=num(row?.amount);
      if(!id||amt<=0)continue;
      routed[id]=(routed[id]||0)+amt;
      const facts=E.cardFacts(profile,id);
      if(!facts){errors.push({code:"routing_unknown_card",cardId:id,category});continue}
      if(facts.kind==="flex"&&primary&&facts.currency!==primary)errors.push({code:"secondary_flexible_ecosystem_routine_spend",cardId:id,category,currency:facts.currency,primaryCurrency:primary,amount:amt});
      if(facts.kind==="airline"&&category!=="airfare"&&!thresholdMoveAllowed(id,category,amt))errors.push({code:"airline_cobrand_wrong_routine_category",cardId:id,category,amount:amt});
      if(facts.kind==="hotel"&&category!=="hotel"&&!thresholdMoveAllowed(id,category,amt))errors.push({code:"hotel_cobrand_wrong_routine_category",cardId:id,category,amount:amt});
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

  for(const job of rec.recurringJobs||[]){
    if(job?.recurring!==true)errors.push({code:"recurring_job_not_marked_recurring",cardId:job?.cardId||"",jobId:job?.id||""});
    if(!(num(job?.annualSpendRequired)>0))errors.push({code:"recurring_job_missing_annual_threshold",cardId:job?.cardId||"",jobId:job?.id||""});
    if(job?.stopCondition?.resetsAnnually!==true)errors.push({code:"recurring_job_missing_annual_reset",cardId:job?.cardId||"",jobId:job?.id||""});
    if(!Array.isArray(job?.nextStep))errors.push({code:"recurring_job_missing_post_threshold_routing",cardId:job?.cardId||"",jobId:job?.id||""});
  }

  for(const job of rec.temporaryJobs||[]){
    if(!job?.cardId)errors.push({code:"temporary_job_missing_card"});
    if(!(num(job?.spendRequired)>0))errors.push({code:"temporary_job_missing_spend_target",cardId:job?.cardId||""});
    if(!job?.stopCondition)errors.push({code:"temporary_job_missing_stop_condition",cardId:job?.cardId||""});
    if(!Array.isArray(job?.nextStep)||job.nextStep.length===0)errors.push({code:"temporary_job_missing_post_threshold_routing",cardId:job?.cardId||""});
  }

  const classes=list(result?.newCardClassifications),classBy=new Map(classes.map(x=>[x.cardId,x]));
  for(const row of classes){
    if(!["recommended","consider","do_not_surface"].includes(row?.classification))errors.push({code:"invalid_new_card_classification",cardId:row?.cardId||"",classification:row?.classification});
    const expected=E.classifyNewCardValue(num(row?.incrementalRecurringValue));
    if(row?.classification!==expected)errors.push({code:"new_card_classification_threshold_mismatch",cardId:row?.cardId||"",classification:row?.classification,expected,incrementalRecurringValue:num(row?.incrementalRecurringValue)});
  }

  for(const action of rec.actions||[]){
    const inPortfolio=portfolio.has(action.cardId);
    if(action.action==="add"&&!inPortfolio)errors.push({code:"add_action_card_not_in_portfolio",cardId:action.cardId});
    if(action.action==="keep"&&!inPortfolio)errors.push({code:"keep_action_card_not_in_portfolio",cardId:action.cardId});
    if((action.action==="remove_or_downgrade_after_review"||action.action==="manual_review_before_removal")&&inPortfolio)errors.push({code:"removal_action_card_still_in_portfolio",cardId:action.cardId});
    if(action.action==="add"&&!required.has(action.cardId)){
      const c=classBy.get(action.cardId);
      if(!c)errors.push({code:"new_card_missing_classification",cardId:action.cardId});
      else if(c.classification!=="recommended")errors.push({code:"core_new_card_did_not_clear_recommended_gate",cardId:action.cardId,classification:c.classification,incrementalRecurringValue:num(c.incrementalRecurringValue)});
    }
  }
  for(const row of result?.considerCards||[])if(portfolio.has(row.cardId)&&!required.has(row.cardId))errors.push({code:"consider_card_in_core_portfolio",cardId:row.cardId});

  const ladder=rec?.strategy?.airlineStatusLadder;
  if(ladder?.decisionSensitiveBenefitFactsMissing)errors.push({code:"status_ladder_decision_sensitive_benefits_unresolved",airline:ladder.airline||""});
  if(Array.isArray(ladder?.rows)&&ladder.rows.length){
    const selectedRows=ladder.rows.filter(x=>x?.selected===true);
    if(ladder.selected){
      if(selectedRows.length!==1||String(selectedRows[0]?.tier||"").toLowerCase()!==String(ladder.selected?.tier||"").toLowerCase())errors.push({code:"status_ladder_selected_row_mismatch",airline:ladder.airline||""});
      const selectedIndex=ladder.rows.findIndex(x=>x?.selected===true);
      if(selectedIndex>=0)for(const row of ladder.rows.slice(selectedIndex+1))if(!row?.stopReason)errors.push({code:"status_ladder_higher_tier_missing_stop_reason",airline:ladder.airline||"",tier:row?.tier||""});
    }else if(rec?.strategy?.airlineStatusTarget)errors.push({code:"status_target_without_selected_ladder_tier",airline:ladder.airline||""});
  }

  const intent=profile?.companionTravel?.intent||"",certValue=num(rec?.economics?.portfolioRecurringBenefits?.companion?.totalValue),swValue=num(rec?.strategy?.southwestCompanionPass?.benefit?.totalValue);
  if(intent!=="yes"&&(certValue>0||swValue>0))errors.push({code:"companion_value_without_yes_intent",intent,annualCertificateValue:certValue,southwestCompanionPassValue:swValue});

  const integrity=result?.integrity||{};
  for(const key of [
    "travelStrategyPrecedesCards","primaryFlexibleEcosystem","ongoingAndTemporaryRoutingSeparated","temporaryJobsHaveExplicitHandoffs",
    "welcomeOffersExcludedFromSelection","currentBenefitsAreBaselineNotIncrementalCredit","verifiedFactsSnapshotSupported","volatileFactsSeparatedFromDecisionRules","verifiedFactsImmutablePerAnalysis",
    "fullAirlineStatusLadder","universalNewCardBands","singleApprovedValuationSnapshot","currentApprovedValuationSnapshot","annualThresholdsAreRecurringEconomics",
    "flexibleRewardsCrossEcosystemCompared","oneActiveFlexibleEcosystemPerPortfolio","replacementFeeSavingsExcludedFromNewCardHurdle",
    "futureCompanionTravelIntake","oneUseCompanionCertificatesCapped","companionCertificateDemandDeduped"
  ])if(integrity[key]!==true)errors.push({code:"required_integrity_flag_missing",flag:key,value:integrity[key]});
  if(num(integrity.newCardRecommendedMin)!==num(E?.MODEL?.newCardRecommendedMin)||num(integrity.newCardConsiderMin)!==num(E?.MODEL?.newCardConsiderMin))errors.push({code:"new_card_threshold_integrity_mismatch",recommended:integrity.newCardRecommendedMin,consider:integrity.newCardConsiderMin});

  if((rec.portfolio||[]).length===0&&num(profile?.totalSpend)>0)warnings.push({code:"nonzero_spend_with_empty_portfolio"});
  return{pass:errors.length===0,errors,warnings,checkedAt:new Date().toISOString()};
}
