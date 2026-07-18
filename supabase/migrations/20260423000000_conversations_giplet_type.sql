-- conversations 테이블에 giplet_type 컬럼 추가
-- 대화 시작 시 선택한 지플릿을 대화 단위로 고정 저장
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS giplet_type TEXT NOT NULL DEFAULT 'general';
