import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAIResponse } from "@/lib/openai";

const DB_LABEL: Record<string, string> = {
  templates:    "미팅 시나리오",
  calculations: "계산값",
  products:     "제품 DB",
  stories:      "스토리 DB",
  links:        "링크 DB",
  images:       "이미지 DB",
  youtube:      "유튜브 강의",
  "rag:faqs":   "FAQ",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle() as unknown as { data: { role: string } | null };
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const {
    system_prompt,
    db_sources,
    messages,
    debug = false,
  }: {
    system_prompt: string;
    db_sources: string[];
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    debug?: boolean;
  } = body;

  // AI 응답 생성
  const aiContent = await generateAIResponse({
    messages,
    userId: user.id,
    supabase,
    mode: "guide",
    systemPromptOverride: system_prompt || "당신은 지니아 AI 어시스턴트입니다.",
    dbSourcesOverride: db_sources ?? [],
  });

  // debug 모드: DB 로드 카운트 수집
  let contextInfo: {
    db_sources_loaded: Array<{ key: string; label: string; count: number }>;
    system_prompt_chars: number;
    estimated_tokens: number;
  } | null = null;

  if (debug) {
    const dbSourcesLoaded: Array<{ key: string; label: string; count: number }> = [];
    const countLoaders: Promise<void>[] = [];

    const TABLE_MAP: Record<string, string> = {
      templates:    "admin_templates",
      calculations: "admin_calculations",
      products:     "admin_products",
      stories:      "stories",
      links:        "links",
      images:       "admin_images",
      youtube:      "youtube_transcripts",
      blocks:       "admin_blocks",
      packages:     "admin_packages",
    };

    for (const src of db_sources ?? []) {
      if (src.startsWith("rag:")) {
        dbSourcesLoaded.push({ key: src, label: DB_LABEL[src] ?? src, count: -1 });
        continue;
      }
      const table = TABLE_MAP[src];
      if (!table) continue;
      countLoaders.push(
        Promise.resolve(
          supabase.from(table).select("id", { count: "exact", head: true })
            .then(({ count }) => {
              dbSourcesLoaded.push({ key: src, label: DB_LABEL[src] ?? src, count: count ?? 0 });
            })
        )
      );
    }
    await Promise.all(countLoaders);

    const totalChars = (system_prompt?.length ?? 0)
      + messages.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length : 0), 0);
    const estimatedTokens = Math.round(totalChars / 3.5);

    contextInfo = {
      db_sources_loaded: dbSourcesLoaded,
      system_prompt_chars: system_prompt?.length ?? 0,
      estimated_tokens: estimatedTokens,
    };
  }

  return NextResponse.json({ content: aiContent, contextInfo });
}
