create table if not exists public.consumer_health_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'completed' check (status in ('draft', 'completed')),
  profile_data jsonb not null default '{}'::jsonb,
  lifestyle_data jsonb not null default '{}'::jsonb,
  answers_data jsonb not null default '{}'::jsonb,
  report_data jsonb not null default '{}'::jsonb,
  total_risk_score numeric,
  health_score numeric,
  health_grade text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consumer_health_assessments_user_created_idx
  on public.consumer_health_assessments (user_id, created_at desc);

alter table public.consumer_health_assessments enable row level security;

drop policy if exists "consumer health assessments select own" on public.consumer_health_assessments;
create policy "consumer health assessments select own"
  on public.consumer_health_assessments for select
  using (auth.uid() = user_id);

drop policy if exists "consumer health assessments insert own" on public.consumer_health_assessments;
create policy "consumer health assessments insert own"
  on public.consumer_health_assessments for insert
  with check (auth.uid() = user_id);

drop policy if exists "consumer health assessments update own" on public.consumer_health_assessments;
create policy "consumer health assessments update own"
  on public.consumer_health_assessments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "consumer health assessments delete own" on public.consumer_health_assessments;
create policy "consumer health assessments delete own"
  on public.consumer_health_assessments for delete
  using (auth.uid() = user_id);
