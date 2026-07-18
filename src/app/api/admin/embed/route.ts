import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmbedding, searchDocuments } from "@/lib/rag";

// 텍스트를 청크로 분할
function splitIntoChunks(
  text: string,
  chunkSize = 800,
  overlap = 100
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 관리자만
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = (await request.json()) as {
    sourceType: string;
    sourceId?: string;
    sourceName?: string;
    text: string;
  };
  const { sourceType, sourceId, sourceName, text } = body;

  if (!text || !sourceType) {
    return NextResponse.json(
      { error: "text와 sourceType 필요" },
      { status: 400 }
    );
  }

  // 기존 청크 삭제
  if (sourceId) {
    await (supabase as any)
      .from("document_chunks")
      .delete()
      .eq("source_id", sourceId)
      .eq("source_type", sourceType);
  }

  // 텍스트 청크 분할 & 임베딩 생성
  const chunks = splitIntoChunks(text);
  const inserted: string[] = [];

  for (const chunk of chunks) {
    try {
      const embedding = await createEmbedding(chunk);
      const { data } = await (supabase as any)
        .from("document_chunks")
        .insert({
          source_type: sourceType,
          source_id: sourceId ?? null,
          source_name: sourceName ?? "",
          chunk_text: chunk,
          embedding: JSON.stringify(embedding),
        })
        .select("id")
        .single();
      if (data) inserted.push((data as { id: string }).id);
    } catch (e) {
      console.error("Chunk embedding failed:", e);
    }
  }

  return NextResponse.json({ inserted: inserted.length, total: chunks.length });
}

export async function GET(request: Request) {
  // RAG 검색 엔드포인트
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  if (!query) return NextResponse.json({ results: [] });

  const results = await searchDocuments(query, supabase);
  return NextResponse.json({ results });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { sourceType, sourceId } = await request.json() as { sourceType: string; sourceId: string };
  if (!sourceType || !sourceId) {
    return NextResponse.json({ error: "sourceType, sourceId 필요" }, { status: 400 });
  }

  await (supabase as any)
    .from("document_chunks")
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  return NextResponse.json({ ok: true });
}
