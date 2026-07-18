-- 테스트 브랜치 준비본. 사용자 승인 전 운영 DB에는 적용하지 않는다.
create table if not exists public.admin_product_intake_guides (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.admin_products(id) on delete restrict,
  program_type text not null default 'general' check (program_type in ('general','reset','diet','custom')),
  dose_mode text not null default 'standard' check (dose_mode in ('standard','enhanced')),
  dose_text text not null,
  time_labels text[] not null default '{}',
  meal_relation text,
  instructions text[] not null default '{}',
  required_notices text[] not null default '{}',
  cautions text[] not null default '{}',
  source_label text not null,
  source_url text,
  source_version text not null,
  availability_status text not null default 'pending' check (availability_status in ('active','pending','disabled')),
  verification_status text not null default 'review_needed' check (verification_status in ('unverified','review_needed','verified','rejected')),
  approval_status text not null default 'pending' check (approval_status in ('draft','pending','approved','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, program_type, dose_mode, source_version)
);
create index if not exists admin_product_intake_guides_lookup_idx on public.admin_product_intake_guides (product_id, program_type, dose_mode, availability_status, verification_status, approval_status);
alter table public.admin_product_intake_guides enable row level security;
drop policy if exists "authenticated read approved intake guides" on public.admin_product_intake_guides;
create policy "authenticated read approved intake guides" on public.admin_product_intake_guides for select to authenticated using (availability_status = 'active' and verification_status = 'verified' and approval_status = 'approved');
