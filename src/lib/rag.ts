import type { SupabaseClient } from "@supabase/supabase-js";

async function createEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });
  if (!res.ok) throw new Error("Embedding API 실패");
  const data = await res.json();
  return data.data[0].embedding as number[];
}

export interface RagResult {
  source_name: string;
  chunk_text: string;
  image_url?: string;
}

export async function searchDocuments(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  options?: { threshold?: number; count?: number }
): Promise<RagResult[]> {
  const { threshold = 0.6, count = 5 } = options ?? {};

  if (!query || query.length <= 3) return [];

  try {
    const embedding = await createEmbedding(query.slice(0, 200));
    const { data } = await (supabase as any).rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: count,
    });
    const rows = (data ?? []) as Array<{
      source_name: string;
      chunk_text: string;
      metadata?: { image_url?: string } | null;
    }>;
    return rows.map((r) => ({
      source_name: r.source_name,
      chunk_text: r.chunk_text,
      image_url: r.metadata?.image_url ?? extractImageUrl(r.chunk_text),
    }));
  } catch {
    return [];
  }
}

// 특정 출처(source_type)만 정확히 유사도 검색.
// 1순위: 출처 필터 RPC(match_documents_by_source, 마이그레이션 적용 시) 사용.
// 폴백: 마이그레이션이 아직 없으면 전체 검색 후 해당 출처만 필터 (결과는 동일하게 해당 출처만).
export async function searchDocumentsBySource(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  sourceType: string,
  options?: { threshold?: number; count?: number }
): Promise<RagResult[]> {
  const { threshold = 0.35, count = 6 } = options ?? {};
  if (!query || query.length <= 3) return [];

  try {
    const embedding = await createEmbedding(query.slice(0, 200));

    // 1순위: 출처 필터 RPC
    const { data, error } = await (supabase as any).rpc("match_documents_by_source", {
      query_embedding: embedding,
      filter_source_type: sourceType,
      match_threshold: threshold,
      match_count: count,
    });
    if (!error && Array.isArray(data)) {
      return (data as Array<{ source_name: string; chunk_text: string; metadata?: { image_url?: string } | null }>).map((r) => ({
        source_name: r.source_name,
        chunk_text: r.chunk_text,
        image_url: r.metadata?.image_url ?? extractImageUrl(r.chunk_text),
      }));
    }

    // 폴백: 전체 검색 후 출처 필터
    const { data: all } = await (supabase as any).rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: count * 10,
    });
    const rows = ((all ?? []) as Array<{ source_type?: string; source_name: string; chunk_text: string; metadata?: { image_url?: string } | null }>)
      .filter((r) => r.source_type === sourceType)
      .slice(0, count);
    return rows.map((r) => ({
      source_name: r.source_name,
      chunk_text: r.chunk_text,
      image_url: r.metadata?.image_url ?? extractImageUrl(r.chunk_text),
    }));
  } catch {
    return [];
  }
}

// 레퍼런스(admin_files) 전용 검색 — 활성(is_active=true) 파일만 검색.
// 보안 원칙: fail-closed. 활성필터 RPC(match_reference_documents)가 실패하면
// is_active 필터가 없는 source_type fallback으로 내려가지 않고 빈 결과를 반환한다.
export async function searchReferenceDocuments(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  options?: { threshold?: number; count?: number }
): Promise<RagResult[]> {
  const { threshold = 0.30, count = 6 } = options ?? {};
  if (!query || query.length <= 3) return [];

  try {
    const embedding = await createEmbedding(query.slice(0, 200));

    const { data, error } = await (supabase as any).rpc("match_reference_documents", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: count,
    });
    if (error || !Array.isArray(data)) return [];

    return (data as Array<{ source_name: string; chunk_text: string; metadata?: { image_url?: string } | null }>).map((r) => ({
      source_name: r.source_name,
      chunk_text: r.chunk_text,
      image_url: r.metadata?.image_url ?? extractImageUrl(r.chunk_text),
    }));
  } catch {
    return [];
  }
}

// chunk_text에 "이미지URL: https://..." 패턴이 있으면 추출 (레거시 데이터 대응)
function extractImageUrl(text: string): string | undefined {
  const match = text.match(/이미지URL:\s*(https?:\/\/\S+)/);
  return match?.[1];
}

export { createEmbedding };
