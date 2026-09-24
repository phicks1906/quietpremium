-- Phase 7 production hardening
-- Restrict stored-plan creation to trusted server-side code.
revoke all on function public.qp_save_plan_v1(jsonb,jsonb,jsonb) from public;
revoke all on function public.qp_save_plan_v1(jsonb,jsonb,jsonb) from anon;
revoke all on function public.qp_save_plan_v1(jsonb,jsonb,jsonb) from authenticated;
grant execute on function public.qp_save_plan_v1(jsonb,jsonb,jsonb) to service_role;
