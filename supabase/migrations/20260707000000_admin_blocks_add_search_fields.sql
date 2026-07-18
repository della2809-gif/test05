-- C-1 (2026-07-07 슬랙 수정요청): Script DB 검색 필드 확장
-- "청소기 비유", "자동차 정기점검" 같은 고유 표현이나 상황 서술형 질문은
-- title/category/content ilike만으로는 안 잡힌다. products/links처럼
-- 사용상황·키워드·태그 렉시컬 검색 경로를 추가한다.
-- (admin_files.keywords 쉼표 구분 TEXT 패턴 재사용 — 20260705000000_admin_files_add_keywords.sql)
ALTER TABLE public.admin_blocks ADD COLUMN IF NOT EXISTS usage_context TEXT;
ALTER TABLE public.admin_blocks ADD COLUMN IF NOT EXISTS keywords TEXT;
ALTER TABLE public.admin_blocks ADD COLUMN IF NOT EXISTS tags TEXT;
