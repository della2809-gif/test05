-- CR-034: 레퍼런스(admin_files) 전용 유사도 검색 함수 — 활성(is_active=true) 파일만 검색.
-- match_documents_by_source(source_type='admin_files')와 달리, document_chunks를 admin_files와
-- JOIN하여 is_active=false인 레퍼런스의 청크는 검색 결과에서 제외한다.
-- 반환 컬럼은 match_documents_by_source와 동일.
CREATE OR REPLACE FUNCTION match_reference_documents(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.35,
  match_count INT DEFAULT 6
)
RETURNS TABLE(
  id UUID,
  source_type TEXT,
  source_name TEXT,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    dc.id,
    dc.source_type,
    dc.source_name,
    dc.chunk_text,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.admin_files af ON af.id = dc.source_id
  WHERE dc.source_type = 'admin_files'
    AND af.is_active = true
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
