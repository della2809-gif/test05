-- admin_calculations에 category 컬럼 추가
ALTER TABLE public.admin_calculations ADD COLUMN IF NOT EXISTS category TEXT;

-- admin_packages에 category 컬럼 추가
ALTER TABLE public.admin_packages ADD COLUMN IF NOT EXISTS category TEXT;

-- admin_files에 category 컬럼 추가
ALTER TABLE public.admin_files ADD COLUMN IF NOT EXISTS category TEXT;
