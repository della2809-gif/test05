-- conversations 테이블에 mode 컬럼 추가
-- 대화 시작 시 선택한 모드를 대화 단위로 저장
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'self'
    CHECK (mode IN ('self', 'guide'));
