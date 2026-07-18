-- match_documents RPC에 source_type, metadata 컬럼 추가
-- 이미지 등 source_type별 메타데이터(image_url 등)를 RAG 결과에 포함시키기 위함

DROP FUNCTION IF EXISTS match_documents(vector, FLOAT, INT);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
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
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
