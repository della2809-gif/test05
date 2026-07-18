-- ========================================
-- admin_giplets: 지플릿 레지스트리 (코드 → DB)
-- ========================================

CREATE TABLE IF NOT EXISTS public.admin_giplets (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  giplet_key     TEXT        NOT NULL UNIQUE,
  name           TEXT        NOT NULL,
  description    TEXT,
  tag            TEXT,
  color_scheme   TEXT        NOT NULL DEFAULT 'gray',
  system_prompt  TEXT        NOT NULL DEFAULT '',
  db_sources     TEXT[]      NOT NULL DEFAULT '{}',
  capability     TEXT,       -- 'health_analysis' | 'commission_calc' | 'travel_calc' | 'contact_register' | NULL
  initial_prompt TEXT        NOT NULL DEFAULT '',
  is_system      BOOLEAN     NOT NULL DEFAULT false,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_giplets_giplet_key ON public.admin_giplets(giplet_key);
CREATE INDEX IF NOT EXISTS idx_admin_giplets_active ON public.admin_giplets(is_active, sort_order);

CREATE OR REPLACE TRIGGER set_admin_giplets_updated_at
  BEFORE UPDATE ON public.admin_giplets
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- RLS
ALTER TABLE public.admin_giplets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read active giplets" ON public.admin_giplets
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage giplets" ON public.admin_giplets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ========================================
-- 시드: 기존 11개 시스템 지플릿
-- ========================================
INSERT INTO public.admin_giplets
  (giplet_key, name, description, tag, color_scheme, db_sources, capability, initial_prompt, is_system, sort_order)
VALUES
  ('quotation', '자동 견적',
   '건강체크리스트 사진 → A~J 분석 → 3단계 제품 견적 자동 출력',
   '📸 사진 첨부', 'blue', ARRAY['products'],
   'health_analysis',
   '건강체크리스트 사진을 찍어서 올려주세요. 분석 후 맞춤 견적을 드릴게요.',
   true, 0),

  ('commission', '수당 계산',
   '현재 CVP 입력 → 직급 확인 + 3가지 시나리오 수당 계산',
   '💰 CVP 입력', 'emerald', ARRAY['calculations'],
   'commission_calc',
   '수당 계산해줘. 현재 CVP는 ',
   true, 1),

  ('travel', '여행 달성',
   '여행 목표 비용 역산 → 필요 CVP → 달성 기간 3가지 시나리오',
   '✈️ CVP 입력', 'purple', ARRAY['calculations'],
   'travel_calc',
   '여행 달성 계산해줘. 현재 CVP는 ',
   true, 2),

  ('contact', '회원 등록',
   '이름·가입일·연락처 입력 → 명단 자동 등록 + AO 주기 설정',
   '👤 명단 연동', 'amber', ARRAY[]::TEXT[],
   'contact_register',
   '새 회원을 등록할게요. 이름이 어떻게 되시나요?',
   true, 3),

  ('story', '성공 스토리',
   '고객과 비슷한 상황의 건강회복·비즈니스 성공 사례 검색',
   '📖 사례 검색', 'rose', ARRAY['stories'],
   NULL,
   '비슷한 성공 사례를 찾아줘. ',
   true, 4),

  ('link', '링크 자료',
   '고객 성향·컨디션에 맞는 유튜브·외부 링크 자료 선별 제공',
   '🔗 링크 추천', 'cyan', ARRAY['links'],
   NULL,
   '이 고객에게 맞는 링크 자료를 추천해줘. ',
   true, 5),

  ('image', '이미지 자료',
   '이미 준비된 마케팅 이미지·비포애프터 자료 검색 및 제공',
   '🖼️ 이미지 검색', 'pink', ARRAY['images'],
   NULL,
   '이미지 자료를 찾아줘. ',
   true, 6),

  ('meeting', '미팅 시나리오',
   '1차·2차·3차 미팅 흐름 스크립트와 상황별 질문 가이드',
   '📋 미팅 가이드', 'indigo', ARRAY['templates'],
   NULL,
   '미팅 시나리오를 알려줘. ',
   true, 7),

  ('faq', 'FAQ',
   '자주 묻는 질문에 대한 답변을 DB에서 검색하여 제공',
   '❓ 질문 검색', 'yellow', ARRAY['rag:faqs'],
   NULL,
   '자주 묻는 질문: ',
   true, 8),

  ('youtube', '유튜브 강의',
   '강의 스크립트·요약을 기반으로 제품·비즈니스 관련 내용 답변',
   '🎬 강의 검색', 'red', ARRAY['youtube'],
   NULL,
   '강의 내용에서 알려줘. ',
   true, 9),

  ('general', '자유 상담',
   '제품 질문, 고객 응대 멘트, 미팅 준비 등 무엇이든 질문',
   '💬 자유 입력', 'gray',
   ARRAY['templates','calculations','products','stories','links','images','youtube'],
   NULL, '',
   true, 10)

ON CONFLICT (giplet_key) DO NOTHING;
