import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAIResponse } from "@/lib/openai";
import type { Archive } from "@/types/database";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the archive (verify ownership)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: archiveRaw, error: archiveError } = await supabase
    .from("archives")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (archiveError || !archiveRaw) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const archive = archiveRaw as unknown as Archive;

  // 사용자 프로필의 모드를 실제로 재정리에 반영 (기존엔 문구만 있고 값을 넘기지 않아 무효였음)
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("mode")
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: { mode: string | null } | null };
  const mode = (profileRow?.mode ?? "self") as "self" | "guide";

  try {
    const reorganizedContent = await generateAIResponse({
      messages: [
        {
          role: "user",
          content: `다음 아카이브 내용을 현재 모드에 맞게 재정리해주세요. 핵심 내용은 유지하되, 더 명확하고 구조적으로 정리해주세요:\n\n${archive.content}`,
        },
      ],
      userId: user.id,
      supabase,
      mode,
    });

    return NextResponse.json({ data: { reorganizedContent } });
  } catch (err) {
    console.error("AI 재정리 실패:", err);
    return NextResponse.json(
      { error: "AI 재정리 요청에 실패했습니다" },
      { status: 500 }
    );
  }
}
