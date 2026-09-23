-- Quiet Premium Phase 4C — V5 plan storage / retrieval
-- Preserves legacy qp_save_architecture / qp_get_architecture.

create or replace function public.qp_save_plan_v1(
  p_input jsonb,
  p_result jsonb,
  p_source jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_id uuid;
  v_public_id text;
  v_token text;
  v_created_at timestamptz := clock_timestamp();
  v_engine text;
  v_rules date;
  v_input jsonb;
  v_result jsonb;
  v_funnel_session text;
  v_primary_airline text;
  v_primary_hotel text;
  v_current_net numeric;
  v_recommended_net numeric;
begin
  perform private.qp_enforce_rate_limit('save_plan_v1', 60);

  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Invalid result payload';
  end if;
  if coalesce(p_result->>'status','') <> 'ready' then
    raise exception 'Only ready plans may be saved';
  end if;
  if coalesce(p_result #>> '{resultExperience,meta,schema}','') <> 'qp-results-v1' then
    raise exception 'qp-results-v1 resultExperience is required';
  end if;
  if coalesce(p_result #>> '{resultExperience,quality,ready}','false') <> 'true' then
    raise exception 'Only production-ready resultExperience may be saved';
  end if;

  if p_input is null or jsonb_typeof(p_input) <> 'object' then p_input := '{}'::jsonb; end if;
  if p_source is null or jsonb_typeof(p_source) <> 'object' then p_source := '{}'::jsonb; end if;

  -- Store the server result, not a client-derived recommendation. Strip any
  -- identity/raw fields defensively even though qp-build-plan does not return them.
  v_result := p_result #- '{profile,raw}' #- '{profile,identity}';
  v_input := p_input
    - 'first_name' - 'full_name' - 'name' - 'email' - 'phone' - 'address'
    - 'firstName' - 'fullName';
  v_funnel_session := private.qp_clean_funnel_session(p_source->>'funnel_session');

  v_engine := nullif(v_result->>'engineVersion','');
  if v_engine is null then raise exception 'Engine version is required'; end if;

  begin
    v_rules := nullif(v_result->>'rulesAsOf','')::date;
  exception when others then
    v_rules := null;
  end;

  v_primary_airline := nullif(coalesce(
    v_result #>> '{travelStrategy,airline,primary}',
    v_result #>> '{resultExperience,strategy,airline,primary}'
  ),'');
  v_primary_hotel := nullif(coalesce(
    v_result #>> '{travelStrategy,hotel,primary}',
    v_result #>> '{resultExperience,strategy,hotel,primary}'
  ),'');

  begin
    v_current_net := nullif(v_result #>> '{current,economics,netEconomicValue}','')::numeric;
  exception when others then
    v_current_net := null;
  end;
  begin
    v_recommended_net := nullif(v_result #>> '{recommended,economics,netEconomicValue}','')::numeric;
  exception when others then
    v_recommended_net := null;
  end;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_public_id := 'QP-' || to_char(v_created_at at time zone 'UTC','YYYYMMDD') || '-' ||
                 upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,10));

  insert into private.qp_architectures(
    public_id, retrieval_secret_hash, created_at, engine_version, rules_as_of, data_quality,
    input_snapshot, result_snapshot, source_snapshot, funnel_session,
    primary_airline, primary_hotel,
    current_net, maximum_net, recommended_net, gap_score, spend_misrouted_pct
  ) values (
    v_public_id,
    extensions.digest(v_token, 'sha256'),
    v_created_at,
    v_engine,
    v_rules,
    'COMPLETE',
    v_input,
    v_result,
    p_source,
    v_funnel_session,
    v_primary_airline,
    v_primary_hotel,
    v_current_net,
    null,
    v_recommended_net,
    null,
    null
  ) returning id into v_id;

  return jsonb_build_object(
    'architecture_id', v_public_id,
    'retrieval_token', v_token,
    'created_at', v_created_at,
    'engine_version', v_engine,
    'schema', 'qp-plan-server-v1'
  );
end;
$function$;

create or replace function public.qp_get_plan_v1(
  p_architecture_id text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_arch private.qp_architectures%rowtype;
begin
  perform private.qp_enforce_rate_limit('get_plan_v1', 300);
  select * into v_arch from private.qp_find_architecture(p_architecture_id, p_token);
  if v_arch.id is null then return null; end if;

  if coalesce(v_arch.result_snapshot #>> '{resultExperience,meta,schema}','') <> 'qp-results-v1' then
    return null;
  end if;

  return jsonb_build_object(
    'schema', 'qp-plan-server-v1',
    'id', v_arch.public_id,
    'createdAt', v_arch.created_at,
    'engineVersion', v_arch.engine_version,
    'result', v_arch.result_snapshot
  );
end;
$function$;

revoke all on function public.qp_save_plan_v1(jsonb,jsonb,jsonb) from public;
revoke all on function public.qp_get_plan_v1(text,text) from public;
grant execute on function public.qp_save_plan_v1(jsonb,jsonb,jsonb) to anon, service_role;
grant execute on function public.qp_get_plan_v1(text,text) to anon, service_role;
