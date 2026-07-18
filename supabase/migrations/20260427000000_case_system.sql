-- ========================================
-- 케이스 시스템 마이그레이션
-- ========================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- admin_cases: 케이스 정의 테이블
CREATE TABLE IF NOT EXISTS public.admin_cases (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  case_key    TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_case_steps: 케이스 단계 정의 테이블
CREATE TABLE IF NOT EXISTS public.admin_case_steps (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id       UUID        NOT NULL REFERENCES public.admin_cases(id) ON DELETE CASCADE,
  step_index    INTEGER     NOT NULL DEFAULT 0,
  name          TEXT        NOT NULL,
  system_prompt TEXT        NOT NULL DEFAULT '',
  db_sources    TEXT[]      NOT NULL DEFAULT '{}',
  output_key    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id, step_index)
);

-- conversations 테이블에 케이스 관련 컬럼 추가
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS case_type    TEXT,
  ADD COLUMN IF NOT EXISTS case_step    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS case_context JSONB;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_admin_cases_case_key ON public.admin_cases(case_key);
CREATE INDEX IF NOT EXISTS idx_admin_case_steps_case_id ON public.admin_case_steps(case_id, step_index);
CREATE INDEX IF NOT EXISTS idx_conversations_case_type ON public.conversations(case_type) WHERE case_type IS NOT NULL;

-- updated_at 트리거
CREATE OR REPLACE TRIGGER set_admin_cases_updated_at
  BEFORE UPDATE ON public.admin_cases
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE OR REPLACE TRIGGER set_admin_case_steps_updated_at
  BEFORE UPDATE ON public.admin_case_steps
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- RLS
ALTER TABLE public.admin_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_steps ENABLE ROW LEVEL SECURITY;

-- 일반 사용자: 활성 케이스 읽기만 가능
CREATE POLICY "Users can read active cases" ON public.admin_cases
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can read case steps" ON public.admin_case_steps
  FOR SELECT USING (true);

-- 관리자: 모든 작업 가능
CREATE POLICY "Admins can manage cases" ON public.admin_cases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage case steps" ON public.admin_case_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
