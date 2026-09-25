-- Pin search_path on trigger functions (Supabase linter 0011,
-- "function_search_path_mutable"). Safe to run more than once.
-- Applied to production 2026-09-25.
alter function public.players_guard_identity() set search_path = public, auth;
alter function public.training_plans_immutable() set search_path = public;
alter function public.players_guard_profile() set search_path = public, auth;
