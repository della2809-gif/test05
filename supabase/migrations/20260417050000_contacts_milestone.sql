-- contacts 테이블에 마일스톤/쿠폰 컬럼 추가
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS milestones JSONB,
  ADD COLUMN IF NOT EXISTS first_order_date DATE;
