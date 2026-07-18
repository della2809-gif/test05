-- ========================================
-- 케이스 시스템 v2: 운영 DB 완전 적용
-- (trigger 함수 보장 + 테이블 생성 + 새 컬럼)
-- ========================================

-- updated_at 트리거 함수 (없을 경우 생성)
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- admin_cases 테이블 생성 (없을 경우)
CREATE TABLE IF NOT EXISTS public.admin_cases (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  case_key        TEXT        NOT NULL UNIQUE,
  name            TEXT        NOT NULL,
  description     TEXT,
  context_prompt  TEXT        NOT NULL DEFAULT '',
  context_fields  JSONB       NOT NULL DEFAULT '[]',
  linked_giplets  TEXT[]      NOT NULL DEFAULT '{}',
  guide_steps     JSONB       NOT NULL DEFAULT '[]',
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_cases에 새 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.admin_cases
  ADD COLUMN IF NOT EXISTS context_prompt  TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS context_fields  JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS linked_giplets  TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS guide_steps     JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sort_order      INTEGER     NOT NULL DEFAULT 0;

-- admin_giplets 테이블 생성 (없을 경우)
CREATE TABLE IF NOT EXISTS public.admin_giplets (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  giplet_key     TEXT        NOT NULL UNIQUE,
  name           TEXT        NOT NULL,
  description    TEXT,
  tag            TEXT,
  color_scheme   TEXT        NOT NULL DEFAULT 'gray',
  system_prompt  TEXT        NOT NULL DEFAULT '',
  db_sources     TEXT[]      NOT NULL DEFAULT '{}',
  capability     TEXT,
  initial_prompt TEXT        NOT NULL DEFAULT '',
  case_key       TEXT,
  is_system      BOOLEAN     NOT NULL DEFAULT false,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_giplets에 case_key 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.admin_giplets
  ADD COLUMN IF NOT EXISTS case_key TEXT;

-- FK 제약 추가 (없을 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'admin_giplets_case_key_fkey'
      AND table_name = 'admin_giplets'
  ) THEN
    ALTER TABLE public.admin_giplets
      ADD CONSTRAINT admin_giplets_case_key_fkey
      FOREIGN KEY (case_key) REFERENCES public.admin_cases(case_key) ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_admin_cases_case_key ON public.admin_cases(case_key);
CREATE INDEX IF NOT EXISTS idx_admin_giplets_giplet_key ON public.admin_giplets(giplet_key);
CREATE INDEX IF NOT EXISTS idx_admin_giplets_active ON public.admin_giplets(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_admin_giplets_case_key ON public.admin_giplets(case_key) WHERE case_key IS NOT NULL;

-- conversations 테이블에 케이스 컬럼 (없을 경우)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS case_type    TEXT,
  ADD COLUMN IF NOT EXISTS case_step    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS case_context JSONB;

CREATE INDEX IF NOT EXISTS idx_conversations_case_type ON public.conversations(case_type) WHERE case_type IS NOT NULL;

-- 트리거 (없을 경우)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_admin_cases_updated_at') THEN
    CREATE TRIGGER set_admin_cases_updated_at
      BEFORE UPDATE ON public.admin_cases
      FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_admin_giplets_updated_at') THEN
    CREATE TRIGGER set_admin_giplets_updated_at
      BEFORE UPDATE ON public.admin_giplets
      FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.admin_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_giplets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read active cases" ON public.admin_cases;
CREATE POLICY "Users can read active cases" ON public.admin_cases
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage cases" ON public.admin_cases;
CREATE POLICY "Admins can manage cases" ON public.admin_cases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can read active giplets" ON public.admin_giplets;
CREATE POLICY "Users can read active giplets" ON public.admin_giplets
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage giplets" ON public.admin_giplets;
CREATE POLICY "Admins can manage giplets" ON public.admin_giplets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ========================================
-- 시드 데이터
-- ========================================

-- 기존 11개 시스템 지플릿
INSERT INTO public.admin_giplets
  (giplet_key, name, description, tag, color_scheme, db_sources, capability, initial_prompt, is_system, sort_order)
VALUES
  ('quotation', '자동 견적', '건강체크리스트 사진 → 분석 → 맞춤 견적', '📸 사진 첨부', 'blue', ARRAY['products'], 'health_analysis', '건강체크리스트 사진을 찍어서 올려주세요.', true, 0),
  ('commission', '수당 계산', '현재 CVP → 직급 확인 + 시나리오 수당 계산', '💰 CVP 입력', 'emerald', ARRAY['calculations'], 'commission_calc', '수당 계산해줘. 현재 CVP는 ', true, 1),
  ('travel', '여행 달성', '여행 목표 → 필요 CVP → 달성 기간 시나리오', '✈️ CVP 입력', 'purple', ARRAY['calculations'], 'travel_calc', '여행 달성 계산해줘. 현재 CVP는 ', true, 2),
  ('contact', '회원 등록', '이름·가입일·연락처 입력 → 명단 자동 등록', '👤 명단 연동', 'amber', ARRAY[]::TEXT[], 'contact_register', '새 회원을 등록할게요. 이름이 어떻게 되시나요?', true, 3),
  ('story', '성공 스토리', '비슷한 상황의 건강회복·비즈니스 성공 사례 검색', '📖 사례 검색', 'rose', ARRAY['stories'], NULL, '비슷한 성공 사례를 찾아줘. ', true, 4),
  ('link', '링크 자료', '고객 성향에 맞는 유튜브·외부 링크 자료 제공', '🔗 링크 추천', 'cyan', ARRAY['links'], NULL, '이 고객에게 맞는 링크 자료를 추천해줘. ', true, 5),
  ('image', '이미지 자료', '마케팅 이미지·비포애프터 자료 검색', '🖼️ 이미지 검색', 'pink', ARRAY['images'], NULL, '이미지 자료를 찾아줘. ', true, 6),
  ('meeting', '미팅 시나리오', '1차·2차·3차 미팅 흐름 스크립트', '📋 미팅 가이드', 'indigo', ARRAY['templates'], NULL, '미팅 시나리오를 알려줘. ', true, 7),
  ('faq', 'FAQ', '자주 묻는 질문 DB에서 검색', '❓ 질문 검색', 'yellow', ARRAY['rag:faqs'], NULL, '자주 묻는 질문: ', true, 8),
  ('youtube', '유튜브 강의', '강의 스크립트 기반으로 제품·비즈니스 답변', '🎬 강의 검색', 'red', ARRAY['youtube'], NULL, '강의 내용에서 알려줘. ', true, 9),
  ('general', '자유 상담', '제품 질문, 고객 응대 멘트, 미팅 준비 등', '💬 자유 입력', 'gray', ARRAY['templates','calculations','products','stories','links','images','youtube'], NULL, '', true, 10)
ON CONFLICT (giplet_key) DO NOTHING;

-- meeting_prep 케이스
INSERT INTO public.admin_cases (case_key, name, description, context_prompt, context_fields, linked_giplets, is_active)
VALUES (
  'meeting_prep',
  '미팅 준비',
  '고객 정보 수집 → 미팅 시나리오 · 성공 사례 · 수당 계산 등 자유 활용',
  '당신은 USANA 비즈니스 미팅 준비를 도와주는 AI 코치입니다.
사용자가 곧 미팅할 고객의 정보를 하나씩 자연스럽게 물어보세요.
절대 한꺼번에 여러 질문을 하지 말고, 한 번에 하나씩 대화 흐름을 이어가세요.',
  '[
    {"key": "target_name", "label": "고객 이름"},
    {"key": "age_gender", "label": "나이대/성별"},
    {"key": "job", "label": "직업 또는 현재 상황"},
    {"key": "health_concern", "label": "건강 고민"},
    {"key": "business_interest", "label": "비즈니스 관심 여부"},
    {"key": "hotbutton", "label": "핫버튼 (무엇이 이 사람을 움직이는가)"}
  ]'::jsonb,
  ARRAY['meeting_prep', 'story', 'link', 'commission', 'travel', 'faq'],
  true
)
ON CONFLICT (case_key) DO UPDATE SET
  context_prompt = EXCLUDED.context_prompt,
  context_fields = EXCLUDED.context_fields,
  linked_giplets = EXCLUDED.linked_giplets;

-- new_product 케이스
INSERT INTO public.admin_cases (case_key, name, description, context_prompt, context_fields, linked_giplets, is_active)
VALUES (
  'new_product',
  '신규 제품 상담',
  '건강 상태 파악 → 제품 추천 → 성공 사례 → 견적 → 회원 등록까지 신규 상담 전체 흐름',
  '당신은 USANA 신규 제품 상담을 진행하는 AI 상담 코치입니다.
상담 대상자의 건강 상태와 목표를 파악하기 위해 하나씩 자연스럽게 물어보세요.
부드럽고 공감적인 톤을 유지하세요.',
  '[
    {"key": "name", "label": "이름 (또는 호칭)"},
    {"key": "age_gender", "label": "나이대 / 성별"},
    {"key": "job_lifestyle", "label": "직업 또는 생활 환경"},
    {"key": "health_concern", "label": "가장 불편하거나 개선하고 싶은 건강 고민"},
    {"key": "health_goal", "label": "건강 목표 (다이어트, 면역강화, 피로회복, 피부, 수면 등)"},
    {"key": "hotbutton", "label": "핫버튼 — 이 분에게 가장 중요한 것"},
    {"key": "business_interest", "label": "사업/비즈니스에도 관심이 있는지 여부"}
  ]'::jsonb,
  ARRAY['story', 'link', 'faq', 'youtube', 'contact', 'general'],
  true
)
ON CONFLICT (case_key) DO UPDATE SET
  context_prompt = EXCLUDED.context_prompt,
  context_fields = EXCLUDED.context_fields,
  linked_giplets = EXCLUDED.linked_giplets;

-- 케이스 진입점 지플릿
INSERT INTO public.admin_giplets (giplet_key, name, description, tag, color_scheme, db_sources, case_key, is_system, is_active, sort_order)
VALUES
  ('meeting_prep', '미팅 준비', '고객 정보 수집 후 미팅 시나리오·사례·수당 계산 등 자유 활용', '📋 미팅', 'indigo', ARRAY['templates', 'stories', 'calculations'], 'meeting_prep', false, true, 20),
  ('new_product', '신규 제품 상담', '건강 상태 파악 → 제품 추천 → 성공 사례 → 견적 → 회원 등록까지', '🩺 건강 상담', 'emerald', ARRAY['story', 'link', 'faq', 'youtube'], 'new_product', false, true, 21)
ON CONFLICT (giplet_key) DO UPDATE SET case_key = EXCLUDED.case_key;
