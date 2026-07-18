-- contacts에 AO 추적 컬럼 추가
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS ao_source TEXT CHECK (ao_source IN ('auto', 'manual')) DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS ao_change_log JSONB DEFAULT '[]'::jsonb;

-- schedules에 자동생성 여부 컬럼 추가
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false;
