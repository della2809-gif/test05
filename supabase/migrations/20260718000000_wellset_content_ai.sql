-- WELLSET Content AI: 콘텐츠 전략, 주제 풀, 발행 이력
-- 기존 content_registry를 변경하지 않는 additive migration이다.

create table if not exists public.content_strategy_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_name text,
  health_ratio integer not null default 40 check (health_ratio between 0 and 100),
  lifestyle_ratio integer not null default 20 check (lifestyle_ratio between 0 and 100),
  ai_tech_ratio integer not null default 15 check (ai_tech_ratio between 0 and 100),
  health_assets_ratio integer not null default 15 check (health_assets_ratio between 0 and 100),
  community_ratio integer not null default 10 check (community_ratio between 0 and 100),
  recommendation_mode text not null default 'balanced'
    check (recommendation_mode in ('balanced','acquisition','conversion','shareable','brand','seasonal')),
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_strategy_ratio_total check (
    health_ratio + lifestyle_ratio + ai_tech_ratio + health_assets_ratio + community_ratio = 100
  )
);

create unique index if not exists content_strategy_one_active_idx
  on public.content_strategy_settings (is_active)
  where is_active = true;

create table if not exists public.content_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  interest_category text not null
    check (interest_category in ('health','lifestyle','ai_tech','health_assets','community')),
  interest_subcategory text not null,
  health_asset_codes text[] not null default '{}',
  audience_problem text not null,
  search_intent text not null,
  funnel_stage text not null
    check (funnel_stage in ('awareness','consideration','conversion','relationship')),
  content_purpose text not null,
  cta_level smallint not null check (cta_level between 1 and 4),
  recommended_cta text not null,
  evergreen_score smallint not null default 50 check (evergreen_score between 0 and 100),
  seasonality_score smallint not null default 50 check (seasonality_score between 0 and 100),
  shareability_score smallint not null default 50 check (shareability_score between 0 and 100),
  conversion_score smallint not null default 50 check (conversion_score between 0 and 100),
  recommended_channels text[] not null default '{}',
  recommended_formats text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','review','approved','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_topics_category_idx
  on public.content_topics (interest_category, interest_subcategory);
create index if not exists content_topics_funnel_idx
  on public.content_topics (funnel_stage, cta_level);
create index if not exists content_topics_health_assets_idx
  on public.content_topics using gin (health_asset_codes);
create index if not exists content_topics_quality_idx
  on public.content_topics (evergreen_score desc, shareability_score desc, conversion_score desc);

create table if not exists public.content_publications (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.content_topics(id) on delete restrict,
  strategy_id uuid references public.content_strategy_settings(id) on delete set null,
  scheduled_for date,
  published_at timestamptz,
  channel text not null,
  content_format text not null,
  status text not null default 'planned'
    check (status in ('planned','drafting','review','published','cancelled')),
  recommendation_mode text not null default 'balanced'
    check (recommendation_mode in ('balanced','acquisition','conversion','shareable','brand','seasonal')),
  recommendation_score numeric(5,2),
  recommendation_reason text,
  performance jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_publications_schedule_idx
  on public.content_publications (scheduled_for, status);
create index if not exists content_publications_recent_topic_idx
  on public.content_publications (topic_id, published_at desc);

create or replace function public.wellset_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'content_strategy_settings',
    'content_topics',
    'content_publications'
  ] loop
    execute format('drop trigger if exists wellset_updated_at on public.%I', table_name);
    execute format(
      'create trigger wellset_updated_at before update on public.%I for each row execute function public.wellset_set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

alter table public.content_strategy_settings enable row level security;
alter table public.content_topics enable row level security;
alter table public.content_publications enable row level security;

drop policy if exists "content topics approved read" on public.content_topics;
create policy "content topics approved read"
  on public.content_topics for select to authenticated
  using (status = 'approved');

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'content_strategy_settings',
    'content_topics',
    'content_publications'
  ] loop
    execute format('drop policy if exists wellset_admin_all on public.%I', table_name);
    execute format(
      'create policy wellset_admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end;
$$;

insert into public.content_strategy_settings (
  id,
  name,
  campaign_name,
  health_ratio,
  lifestyle_ratio,
  ai_tech_ratio,
  health_assets_ratio,
  community_ratio,
  recommendation_mode,
  is_active
)
values (
  '00000000-0000-0000-0000-000000000001',
  '기본 콘텐츠 전략',
  'WELLSET 기본 운영',
  40,
  20,
  15,
  15,
  10,
  'balanced',
  true
)
on conflict (id) do nothing;

