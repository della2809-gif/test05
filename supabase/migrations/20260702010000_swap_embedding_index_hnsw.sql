-- W2 이미지 지플릿/RAG recall 개선: document_chunks.embedding 벡터 인덱스를 IVFFlat → HNSW 교체.
--
-- 배경:
--   기존 인덱스는 IVFFlat(lists=100, 기본 probes=1)로, 10k 전체 테이블을 100개 리스트로 나눠
--   질의당 1개 리스트(~100후보)만 스캔한다. admin_images는 전체 88행뿐이라 질의의 최근접
--   리스트에 포함되지 못하면 match_admin_images_documents가 0건을 반환하는 recall cliff가 발생.
--   (docs/operations/GENIEA_W1_조사결과_2026-07-02.md 의 W2 섹션 참조)
--
--   HNSW는 그래프 기반이라 source_type 필터가 걸린 소수 부분집합에서도 recall이 안정적이며,
--   probes 같은 세션 파라미터에 의존하지 않는다.
--
-- 순서: 신규 HNSW 인덱스 생성 → 기존 IVFFlat 드랍 (드랍 전까지 읽기는 IVFFlat이 계속 서비스).
-- 파라미터: vector_cosine_ops, m=16, ef_construction=64 (pgvector 기본값).
--   RPC(match_admin_images_documents / match_reference_documents / match_documents 등)는 모두
--   `embedding <=> query_embedding` (코사인 거리) ORDER BY 를 쓰므로 vector_cosine_ops HNSW가 그대로 서빙.

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

DROP INDEX IF EXISTS public.idx_document_chunks_embedding;

-- 롤백: 아래로 IVFFlat 복구 후 HNSW 드랍
--   CREATE INDEX idx_document_chunks_embedding ON public.document_chunks
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--   DROP INDEX IF EXISTS public.idx_document_chunks_embedding_hnsw;
