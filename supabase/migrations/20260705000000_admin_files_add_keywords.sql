-- 레퍼런스 파일 한글 검색 키워드 (쉼표 구분 텍스트, admin_products.aliases 패턴)
-- 영문 원서(예: Nutritional Supplements)는 본문 임베딩이 영어라 한글 질문과 유사도가 낮아
-- 검색에서 누락된다. 파일별 한글 별칭/키워드를 달아 렉시컬 검색 경로로 보완한다.
ALTER TABLE admin_files ADD COLUMN IF NOT EXISTS keywords TEXT;
