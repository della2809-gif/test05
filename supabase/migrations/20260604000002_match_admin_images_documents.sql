-- admin_images source_type 전용 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_admin_images_documents(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.25,
  match_count INT DEFAULT 10
)
RETURNS TABLE(
  source_id UUID,
  source_name TEXT,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    source_id,
    source_name,
    chunk_text,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.document_chunks
  WHERE source_type = 'admin_images'
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
