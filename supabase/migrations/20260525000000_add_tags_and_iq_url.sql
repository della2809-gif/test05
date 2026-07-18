-- C-02: 패키지 DB 태그 추가
ALTER TABLE public.admin_packages
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- D-01: 제품 DB 유사IQ 링크 추가
ALTER TABLE public.admin_products
  ADD COLUMN IF NOT EXISTS usana_iq_url TEXT;
