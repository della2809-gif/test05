import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmbedding } from "@/lib/rag";
import type { Profile } from "@/types/database";

const BUCKET = "admin-images";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error: authError, status: authStatus, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return NextResponse.json({ error: authError }, { status: authStatus });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const script = (formData.get("script") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const category = (formData.get("category") as string | null)?.trim() || null;
  const tagsRaw = (formData.get("tags") as string | null)?.trim() || "";
  const isActive = formData.get("is_active") !== "false";

  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  // 기존 레코드 조회
  const { data: existing } = await (supabase.from("admin_images") as any)
    .select("file_path, image_url")
    .eq("id", id)
    .single();

  let imageUrl = existing?.image_url ?? null;
  let filePath = existing?.file_path ?? null;
  let fileName: string | undefined;
  let fileSize: number | undefined;

  // 새 파일이 있으면 교체
  if (file) {
    const timestamp = Date.now();
    const newPath = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, buffer, { contentType: file.type });

    if (uploadError) {
      return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 });
    }

    // 기존 파일 삭제
    if (existing?.file_path) {
      await supabase.storage.from(BUCKET).remove([existing.file_path]);
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
    imageUrl = urlData.publicUrl;
    filePath = newPath;
    fileName = file.name;
    fileSize = file.size;
  }

  const updatePayload: Record<string, unknown> = {
    title,
    description,
    script,
    image_url: imageUrl,
    file_path: filePath,
    category,
    tags: tags.length > 0 ? tags : [],
    is_active: isActive,
  };
  if (fileName !== undefined) updatePayload.file_name = fileName;
  if (fileSize !== undefined) updatePayload.file_size = fileSize;

  const { data: record, error: updateError } = await (supabase.from("admin_images") as any)
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // RAG 임베딩 업데이트 — script 없으면 title+description으로 fallback
  if (title) {
    const ragText = script
      ? `[이미지] ${title}\n${script}\n이미지URL: ${imageUrl}`
      : `[이미지] ${title}${description ? `\n${description}` : ""}\n이미지URL: ${imageUrl}`;
    (async () => {
      try {
        await (supabase as any).from("document_chunks").delete()
          .eq("source_type", "admin_images").eq("source_id", id);
        const embedding = await createEmbedding(ragText);
        await (supabase as any).from("document_chunks").insert({
          source_type: "admin_images",
          source_id: id,
          source_name: title,
          chunk_text: ragText,
          embedding: JSON.stringify(embedding),
          metadata: { image_url: imageUrl },
        });
      } catch {}
    })();
  }

  return NextResponse.json({ image: record });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error: authError, status: authStatus, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return NextResponse.json({ error: authError }, { status: authStatus });
  }

  // 파일 경로 조회
  const { data: existing } = await (supabase.from("admin_images") as any)
    .select("file_path")
    .eq("id", id)
    .single();

  // Storage 파일 삭제
  if (existing?.file_path) {
    await supabase.storage.from(BUCKET).remove([existing.file_path]);
  }

  // DB 삭제
  const { error } = await supabase.from("admin_images").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // RAG 임베딩 삭제
  (supabase as any).from("document_chunks").delete()
    .eq("source_type", "admin_images").eq("source_id", id)
    .then(() => {}).catch(() => {});

  return NextResponse.json({ ok: true });
}
