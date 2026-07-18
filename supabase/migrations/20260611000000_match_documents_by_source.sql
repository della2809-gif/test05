-- 출처(source_type)로 필터링하는 문서 유사도 검색 함수.
-- 기존 match_documents는 모든 출처를 섞어 검색하므로, 특정 출처(예: 레퍼런스 파일 = admin_files)만
-- 정확히 검색하기 위해 별도 함수를 추가한다.
CREATE OR REPLACE FUNCTION match_documents_by_source(
  query_embedding vector(1536),
  filter_source_type TEXT,
  match_threshold FLOAT DEFAULT 0.5,
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
    id,
    source_type,
    source_name,
    chunk_text,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.document_chunks
  WHERE source_type = filter_source_type
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
