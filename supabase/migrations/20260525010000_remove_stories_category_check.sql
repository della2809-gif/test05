-- stories 테이블의 category CHECK 제약 제거
-- 기존 제약: category IN ('health', 'business', 'combined') 만 허용
-- 변경 이유: 관리자가 자유롭게 카테고리를 추가할 수 있어야 함

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_category_check;
