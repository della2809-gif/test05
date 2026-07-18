-- pgvector 확장 (Supabase에서 기본 지원)
CREATE EXTENSION IF NOT EXISTS vector;

-- 문서 청크 테이블
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,  -- 'admin_file' | 'story' | 'youtube'
  source_id UUID,             -- 원본 레코드 ID
  source_name TEXT,           -- 파일명 또는 제목
  chunk_text TEXT NOT NULL,
  embedding vector(1536),     -- text-embedding-3-small 차원
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 유사도 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  source_name TEXT,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    source_name,
    chunk_text,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.document_chunks
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RLS
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_chunks_read_all" ON public.document_chunks
  FOR SELECT USING (true);
CREATE POLICY "document_chunks_admin_write" ON public.document_chunks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
