-- Phase 7 production hardening
-- Retire anonymous access to legacy V4 architecture/contact/feedback RPCs.
-- Current public RPCs qp_get_plan_v1 and qp_log_event_v2 remain intentionally exposed.

revoke all on function public.qp_save_architecture(jsonb,jsonb,jsonb) from public;
revoke all on function public.qp_save_architecture(jsonb,jsonb,jsonb) from anon;
revoke all on function public.qp_save_architecture(jsonb,jsonb,jsonb) from authenticated;
grant execute on function public.qp_save_architecture(jsonb,jsonb,jsonb) to service_role;

revoke all on function public.qp_get_architecture(text,text) from public;
revoke all on function public.qp_get_architecture(text,text) from anon;
revoke all on function public.qp_get_architecture(text,text) from authenticated;
grant execute on function public.qp_get_architecture(text,text) to service_role;

revoke all on function public.qp_log_event(text,text,text,jsonb) from public;
revoke all on function public.qp_log_event(text,text,text,jsonb) from anon;
revoke all on function public.qp_log_event(text,text,text,jsonb) from authenticated;
grant execute on function public.qp_log_event(text,text,text,jsonb) to service_role;

revoke all on function public.qp_save_contact(text,text,text,text) from public;
revoke all on function public.qp_save_contact(text,text,text,text) from anon;
revoke all on function public.qp_save_contact(text,text,text,text) from authenticated;
grant execute on function public.qp_save_contact(text,text,text,text) to service_role;

revoke all on function public.qp_submit_feedback(text,text,text,text) from public;
revoke all on function public.qp_submit_feedback(text,text,text,text) from anon;
revoke all on function public.qp_submit_feedback(text,text,text,text) from authenticated;
grant execute on function public.qp_submit_feedback(text,text,text,text) to service_role;
