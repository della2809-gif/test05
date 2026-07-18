-- CR-034: 레퍼런스 DB(admin_files) 활성/비활성 토글
-- 레퍼런스 원본 파일은 보관하되, 비활성(is_active=false) 시 RAG 검색에서 제외하기 위한 컬럼.
-- 신규 업로드는 기본 활성(true).
ALTER TABLE public.admin_files
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.admin_files.is_active IS
  'CR-034: 레퍼런스 RAG 검색 포함 여부. false면 원본은 보관되지만 match_reference_documents 검색에서 제외된다.';
