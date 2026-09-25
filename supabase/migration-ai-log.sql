-- Blackbird AI request log (lib/aiLog.js): one row per AI request with
-- what it cost and how it went. No prompts, answers or game data.
-- Players can read their own rows; only ai_log_request() (security
-- definer, stamps the caller's own id) writes. The admin panel reads all
-- rows with the service role for usage and cost analytics.
-- Additive and safe to run more than once.
create table if not exists ai_request_log (
  id bigserial primary key,
  auth_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('chat', 'game', 'weekly', 'plan', 'identity')),
  model text,
  effort text,
  input_tokens int check (input_tokens is null or input_tokens >= 0),
  output_tokens int check (output_tokens is null or output_tokens >= 0),
  tool_calls int not null default 0 check (tool_calls >= 0),
  steps int not null default 0 check (steps >= 0),
  duration_ms int not null default 0 check (duration_ms >= 0),
  status text not null check (status in ('ok', 'error', 'limit', 'empty')),
  fallback text,
  via text,
  created_at timestamptz not null default now()
);
create index if not exists ai_request_log_time_idx on ai_request_log (created_at);
create index if not exists ai_request_log_user_idx on ai_request_log (auth_id, created_at);

alter table ai_request_log enable row level security;
drop policy if exists "ai_request_log_select_own" on ai_request_log;
create policy "ai_request_log_select_own" on ai_request_log
  for select to authenticated using (auth_id = auth.uid());

create or replace function ai_log_request(
  p_kind text, p_model text, p_effort text,
  p_input_tokens int, p_output_tokens int, p_tool_calls int, p_steps int,
  p_duration_ms int, p_status text, p_fallback text, p_via text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into ai_request_log (auth_id, kind, model, effort, input_tokens, output_tokens, tool_calls, steps, duration_ms, status, fallback, via)
  values (
    uid, p_kind, left(p_model, 80), left(p_effort, 16),
    greatest(p_input_tokens, 0), greatest(p_output_tokens, 0),
    greatest(coalesce(p_tool_calls, 0), 0), greatest(coalesce(p_steps, 0), 0),
    least(greatest(coalesce(p_duration_ms, 0), 0), 600000),
    p_status, left(p_fallback, 32), left(p_via, 16)
  );
end $$;

revoke all on function ai_log_request(text, text, text, int, int, int, int, int, text, text, text) from public, anon;
grant execute on function ai_log_request(text, text, text, int, int, int, int, int, text, text, text) to authenticated;
