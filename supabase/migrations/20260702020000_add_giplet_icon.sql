-- W1-A(4): 메인 카드 아이콘 반복 문제 근본 해결
-- 지플릿/케이스에 운영자가 지정하는 아이콘 컬럼 추가.
-- 값은 Lucide 아이콘 이름(예: 'Stethoscope'). NULL이면 기존 자동 매칭(getGipletIcon) 폴백 → 하위호환.
-- 이미지 업로드가 아니라 프리셋 벡터 아이콘 선택 방식(해상도 이슈 없음, CR-002 모노톤 통일과 일관).
ALTER TABLE public.admin_giplets ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.admin_cases   ADD COLUMN IF NOT EXISTS icon text;

COMMENT ON COLUMN public.admin_giplets.icon IS
  'W1-A: 운영자가 지정한 Lucide 아이콘 이름. NULL이면 empty-state의 자동 매칭(getGipletIcon) 사용.';
COMMENT ON COLUMN public.admin_cases.icon IS
  'W1-A: 운영자가 지정한 Lucide 아이콘 이름. NULL이면 자동 매칭 사용.';
