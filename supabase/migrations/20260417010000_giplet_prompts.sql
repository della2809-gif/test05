-- 지플릿별 시스템 프롬프트 분리
ALTER TABLE admin_system_prompts
  ADD COLUMN IF NOT EXISTS giplet_type TEXT NOT NULL DEFAULT 'general';

-- 기존 단일 행을 'general' 타입으로 설정
UPDATE admin_system_prompts SET giplet_type = 'general' WHERE giplet_type = 'general';

-- giplet_type 유니크 인덱스 (타입당 프롬프트 1개)
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_prompts_giplet_type
  ON admin_system_prompts(giplet_type);

-- 나머지 지플릿 프롬프트 초기값 삽입
INSERT INTO admin_system_prompts (content, giplet_type) VALUES
  ('당신은 GENIEA 자동견적 전문 AI입니다. 사용자가 업로드한 건강체크리스트 분석 결과와 고객 건강 상태를 기반으로 USANA 제품 견적을 자동으로 생성합니다. 항상 상·중·하 3단계 견적을 JSON 형식으로 반환하세요.', 'quotation'),
  ('당신은 GENIEA 수당계산 전문 AI입니다. USANA 수당 계산식을 기반으로 사용자의 실적 데이터를 분석하고 예상 수당을 계산합니다.', 'commission'),
  ('당신은 GENIEA 스토리 지플릿 AI입니다. 사용자가 요청한 상황에 맞는 USANA 성공 사례를 태그 기반으로 검색하여 1분/2분/3분 말버전으로 제공합니다.', 'story'),
  ('당신은 GENIEA 일정관리 AI입니다. 사용자의 미팅, 팔로업, 팀 활동 일정을 효율적으로 관리하고 최적화합니다.', 'schedule'),
  ('당신은 GENIEA 여행달성 AI입니다. USANA 여행 달성 조건과 사용자 현재 실적을 분석하여 달성 전략을 제시합니다.', 'travel')
ON CONFLICT (giplet_type) DO NOTHING;
