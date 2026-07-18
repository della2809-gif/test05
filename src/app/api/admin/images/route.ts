import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createEmbedding } from "@/lib/rag";
import type { Profile } from "@/types/database";

const BUCKET = "admin-images";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401, supabase: null };

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<Profile, "role"> | null;

  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden", status: 403, supabase: null };
  }
  return { error: null, status: 200, supabase };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("admin_images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ images: data ?? [] });
}

export async function POST(request: Request) {
  const { error: authError, status: authStatus } = await requireAdmin();
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authStatus });
  }
  // Storage·DB 작업은 서비스 롤 클라이언트로 RLS 우회 (어드민 인증은 위에서 완료)
  const supabase = createServiceClient();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const script = (formData.get("script") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const category = (formData.get("category") as string | null)?.trim() || null;
  const tagsRaw = (formData.get("tags") as string | null)?.trim() || "";
  const isActive = formData.get("is_active") !== "false";

  if (!title) return NextResponse.json({ error: "제목은 필수입니다." }, { status: 400 });
  if (!file) return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "JPG, PNG, GIF, WEBP만 허용됩니다." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
  }

  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
  const timestamp = Date.now();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // Storage 업로드
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 });
  }

  // 공개 URL 가져오기
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const imageUrl = urlData.publicUrl;

  // DB 저장
  const { data: record, error: insertError } = await (supabase.from("admin_images") as any)
    .insert({
      title,
      description,
      script,
      image_url: imageUrl,
      file_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      category,
      tags: tags.length > 0 ? tags : [],
      is_active: isActive,
    })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: `DB 저장 실패: ${insertError.message}` }, { status: 500 });
  }

  // RAG 임베딩 생성 (비동기) — script 없으면 title+description으로 fallback
  if (record) {
    const recordId = (record as { id: string }).id;
    const ragText = script
      ? `[이미지] ${title}\n${script}\n이미지URL: ${imageUrl}`
      : `[이미지] ${title}${description ? `\n${description}` : ""}\n이미지URL: ${imageUrl}`;
    (async () => {
      try {
        const embedding = await createEmbedding(ragText);
        await (supabase as any).from("document_chunks").insert({
          source_type: "admin_images",
          source_id: recordId,
          source_name: title,
          chunk_text: ragText,
          embedding: JSON.stringify(embedding),
          metadata: { image_url: imageUrl },
        });
      } catch {}
    })();
  }

  return NextResponse.json({ image: record }, { status: 201 });
}
