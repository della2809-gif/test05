-- 2026-05-29 회의 피드백: 케이스 노출 순서 및 업무 가이드

ALTER TABLE public.admin_cases
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guide_steps JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_admin_cases_active_sort
  ON public.admin_cases(is_active, sort_order);

UPDATE public.admin_cases
SET sort_order = CASE case_key
  WHEN 'meeting_prep' THEN 0
  WHEN 'new_product' THEN 1
  ELSE sort_order
END;

UPDATE public.admin_cases
SET guide_steps = '[
  {"title": "고객 기본 정보와 현재 상황 확인"},
  {"title": "건강 고민과 핫버튼 정리"},
  {"title": "미팅 목적에 맞는 시나리오 선택"},
  {"title": "성공 사례·링크·FAQ 자료 추천"},
  {"title": "필요 시 수당·여행 달성 시뮬레이션"}
]'::jsonb
WHERE case_key = 'meeting_prep'
  AND (guide_steps IS NULL OR guide_steps = '[]'::jsonb);

UPDATE public.admin_cases
SET guide_steps = '[
  {"title": "건강 상태와 생활 환경 확인"},
  {"title": "체크리스트 사진 또는 상담 기록 입력"},
  {"title": "자동 견적 또는 제품 추천 확인"},
  {"title": "고객에게 맞는 성공 사례·링크 자료 추천"},
  {"title": "섭취 제품 선택 후 회원 등록"},
  {"title": "AO·일정·후속 관리 안내"}
]'::jsonb
WHERE case_key = 'new_product'
  AND (guide_steps IS NULL OR guide_steps = '[]'::jsonb);
