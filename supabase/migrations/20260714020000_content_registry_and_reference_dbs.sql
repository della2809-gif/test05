-- GENIEA 공통 콘텐츠 레지스트리와 배포 준비 DB
-- 기존 테이블을 삭제/변경하지 않는 additive migration이다.

create table if not exists public.content_registry (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_key text not null,
  legacy_db text,
  legacy_id text,
  content_type text not null check (content_type in ('image','youtube','story','link','reference')),
  title text not null,
  summary text not null,
  category_l1_code text not null check (category_l1_code ~ '^[HPMBRC]$'),
  category_l2_code text not null check (category_l2_code ~ '^[HPMBRC][0-9]{2}$'),
  category_l3_code text check (category_l3_code is null or category_l3_code ~ '^[HPMBRC][0-9]{2}-[0-9]{2}$'),
  keywords text[] not null default '{}',
  aliases text[] not null default '{}',
  use_purposes text[] not null default '{}',
  resource_url text,
  thumbnail_url text,
  availability_status text not null default 'pending' check (availability_status in ('active','pending','disabled','broken')),
  verification_status text not null default 'review_needed' check (verification_status in ('unverified','review_needed','verified','rejected')),
  approval_status text not null default 'pending' check (approval_status in ('draft','pending','approved','blocked')),
  classification_source text not null default 'manual' check (classification_source in ('legacy','rule','ai','manual')),
  classification_confidence numeric(4,3) not null default 0 check (classification_confidence between 0 and 1),
  source_version text,
  source_hash text,
  sort_priority integer not null default 0 check (sort_priority >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_key)
);

create index if not exists content_registry_status_idx on public.content_registry (availability_status, verification_status, approval_status);
create index if not exists content_registry_category_idx on public.content_registry (category_l1_code, category_l2_code, category_l3_code);
create index if not exists content_registry_keywords_idx on public.content_registry using gin (keywords);
create index if not exists content_registry_aliases_idx on public.content_registry using gin (aliases);
create index if not exists content_registry_source_hash_idx on public.content_registry (source_hash) where source_hash is not null;

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_registry(id) on delete cascade,
  asset_type text not null check (asset_type in ('image','pdf','video','thumbnail','source')),
  page_index integer not null default 1 check (page_index >= 1),
  storage_bucket text,
  storage_path text,
  public_url text,
  file_name text not null,
  mime_type text,
  file_size bigint,
  width integer,
  height integer,
  sha256 text,
  availability_status text not null default 'pending' check (availability_status in ('active','pending','disabled','broken')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, asset_type, page_index)
);

create index if not exists content_assets_content_idx on public.content_assets (content_id, page_index);
create unique index if not exists content_assets_sha256_unique on public.content_assets (sha256) where sha256 is not null;

create table if not exists public.deployment_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  dataset_type text not null,
  source_version text not null,
  status text not null default 'prepared' check (status in ('prepared','loaded','tested','activated','rolled_back','archived')),
  source_count integer not null default 0,
  loaded_count integer not null default 0,
  failed_count integer not null default 0,
  manifest_hash text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_replacement_map (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.deployment_batches(id) on delete cascade,
  old_source_table text not null,
  old_source_key text not null,
  old_snapshot jsonb not null default '{}'::jsonb,
  new_content_id uuid references public.content_registry(id) on delete set null,
  match_reason text,
  decision text not null default 'pending' check (decision in ('pending','keep','deactivate','delete','review')),
  deactivated_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, old_source_table, old_source_key)
);

create table if not exists public.blood_story_cases (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.content_registry(id) on delete restrict,
  case_key text not null unique,
  title text not null,
  source_pdf text not null,
  source_sha256 text not null,
  start_page integer,
  end_page integer,
  page_count integer not null check (page_count > 0),
  safety_notice text not null default '개인 체험사례이며 치료 효과를 보장하지 않습니다.',
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplement_product_ratings (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.content_registry(id) on delete restrict,
  product_key text not null unique,
  brand_book text not null,
  product_name_book text not null,
  display_name_ko text not null,
  aliases text[] not null default '{}',
  country text not null,
  edition text,
  rating_score numeric(4,2),
  rating_display text,
  medal_value text,
  source_page text,
  source_split_pdf text,
  source_collection_pdf text,
  current_product_mapping text,
  source_scope text not null default 'book_historical_rating',
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplement_product_ratings_country_idx on public.supplement_product_ratings (country);
create index if not exists supplement_product_ratings_aliases_idx on public.supplement_product_ratings using gin (aliases);

create table if not exists public.supplement_rating_criteria (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.content_registry(id) on delete restrict,
  criterion_key text not null unique,
  name_en text not null,
  name_ko text not null,
  criterion_group text,
  description text not null,
  source_chapter text,
  source_page text,
  source_file text,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplement_medal_levels (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.content_registry(id) on delete restrict,
  medal_key text not null unique,
  medal_name text not null,
  display_name_ko text,
  category text,
  score_min numeric(6,2),
  score_max numeric(6,2),
  description text,
  not_meaning text,
  source_chapter text,
  source_page text,
  source_file text,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_prescription_guides (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.content_registry(id) on delete restrict,
  condition_key text not null unique,
  condition_name text not null,
  condition_aliases text[] not null default '{}',
  column_labels text[] not null default '{}',
  source_file text not null,
  title_review_status text not null default 'pending' check (title_review_status in ('pending','approved','needs_correction','rejected')),
  safety_notice text not null default '질환별 참고표이며 진단·치료·처방을 대신하지 않습니다. 복용약과 치료 계획은 의료진에게 확인하세요.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_prescription_items (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.nutrition_prescription_guides(id) on delete cascade,
  item_index integer not null check (item_index >= 1),
  nutrient_name text not null,
  product_name text,
  schedule_values text[] not null default '{}',
  discontinued boolean not null default false,
  replacement_note text,
  verification_status text not null default 'review_needed' check (verification_status in ('unverified','review_needed','verified','rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guide_id, item_index)
);

create or replace function public.geniea_set_updated_at()
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
    'content_registry','content_assets','deployment_batches','blood_story_cases',
    'supplement_product_ratings','supplement_rating_criteria','supplement_medal_levels',
    'nutrition_prescription_guides','nutrition_prescription_items'
  ] loop
    execute format('drop trigger if exists geniea_updated_at on public.%I', table_name);
    execute format('create trigger geniea_updated_at before update on public.%I for each row execute function public.geniea_set_updated_at()', table_name);
  end loop;
end;
$$;

alter table public.content_registry enable row level security;
alter table public.content_assets enable row level security;
alter table public.deployment_batches enable row level security;
alter table public.content_replacement_map enable row level security;
alter table public.blood_story_cases enable row level security;
alter table public.supplement_product_ratings enable row level security;
alter table public.supplement_rating_criteria enable row level security;
alter table public.supplement_medal_levels enable row level security;
alter table public.nutrition_prescription_guides enable row level security;
alter table public.nutrition_prescription_items enable row level security;

drop policy if exists "content registry approved read" on public.content_registry;
create policy "content registry approved read" on public.content_registry for select to authenticated
using (availability_status = 'active' and verification_status = 'verified' and approval_status = 'approved');

drop policy if exists "content assets approved read" on public.content_assets;
create policy "content assets approved read" on public.content_assets for select to authenticated
using (availability_status = 'active' and exists (
  select 1 from public.content_registry c where c.id = content_id
    and c.availability_status = 'active' and c.verification_status = 'verified' and c.approval_status = 'approved'
));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'content_registry','content_assets','deployment_batches','content_replacement_map','blood_story_cases',
    'supplement_product_ratings','supplement_rating_criteria','supplement_medal_levels',
    'nutrition_prescription_guides','nutrition_prescription_items'
  ] loop
    execute format('drop policy if exists geniea_admin_all on public.%I', table_name);
    execute format('create policy geniea_admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', table_name);
  end loop;
end;
$$;

drop policy if exists "blood story approved read" on public.blood_story_cases;
create policy "blood story approved read" on public.blood_story_cases for select to authenticated
using (review_status = 'approved' and exists (
  select 1 from public.content_registry c where c.id = content_id
    and c.availability_status = 'active' and c.verification_status = 'verified' and c.approval_status = 'approved'
));

drop policy if exists "supplement rating approved read" on public.supplement_product_ratings;
create policy "supplement rating approved read" on public.supplement_product_ratings for select to authenticated
using (exists (
  select 1 from public.content_registry c where c.id = content_id
    and c.availability_status = 'active' and c.verification_status = 'verified' and c.approval_status = 'approved'
));

drop policy if exists "supplement criteria authenticated read" on public.supplement_rating_criteria;
create policy "supplement criteria authenticated read" on public.supplement_rating_criteria for select to authenticated
using (exists (
  select 1 from public.content_registry c where c.id = content_id
    and c.availability_status = 'active' and c.verification_status = 'verified' and c.approval_status = 'approved'
));
drop policy if exists "supplement medals authenticated read" on public.supplement_medal_levels;
create policy "supplement medals authenticated read" on public.supplement_medal_levels for select to authenticated
using (exists (
  select 1 from public.content_registry c where c.id = content_id
    and c.availability_status = 'active' and c.verification_status = 'verified' and c.approval_status = 'approved'
));

drop policy if exists "prescription guide approved read" on public.nutrition_prescription_guides;
create policy "prescription guide approved read" on public.nutrition_prescription_guides for select to authenticated
using (title_review_status = 'approved' and exists (
  select 1 from public.content_registry c where c.id = content_id
    and c.availability_status = 'active' and c.verification_status = 'verified' and c.approval_status = 'approved'
));

drop policy if exists "prescription items approved read" on public.nutrition_prescription_items;
create policy "prescription items approved read" on public.nutrition_prescription_items for select to authenticated
using (verification_status = 'verified' and exists (
  select 1 from public.nutrition_prescription_guides g
  join public.content_registry c on c.id = g.content_id
  where g.id = guide_id and g.title_review_status = 'approved'
    and c.availability_status = 'active' and c.verification_status = 'verified' and c.approval_status = 'approved'
));
