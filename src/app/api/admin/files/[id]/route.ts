import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AdminFile, Profile } from "@/types/database";

const ADMIN_FILES_BUCKET = "admin-files";

// 본문 미리보기 상한. 청크(800자)를 이어붙인 결합본이 응답을 비대하게 만들지 않게 자른다.
const PREVIEW_MAX_CHARS = 20000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const profile = profileData as Pick<Profile, "role"> | null;

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: fileData, error: fileError } = await supabase
      .from("admin_files")
      .select("*")
      .eq("id", id)
      .single();

    if (fileError || !fileData) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }
    const file = fileData as AdminFile;

    // 추출 본문은 admin_files에 통째로 저장되지 않고 document_chunks에 조각으로만 있다.
    // 검수용 미리보기는 청크를 순서대로 이어붙여 만든다. 청크 오버랩(100자)은 미리보기 용도라 무시.
    // 신규 업로드는 metadata.chunk_index로 정렬하고, 인덱스가 없는 과거 데이터는 created_at 순서로 둔다.
    const { data: chunkData } = await (supabase as any)
      .from("document_chunks")
      .select("chunk_text, metadata")
      .eq("source_type", "admin_files")
      .eq("source_id", id)
      .order("created_at", { ascending: true }) as { data: { chunk_text: string; metadata: { chunk_index?: number } | null }[] | null };

    const chunks = (chunkData ?? []).sort(
      (a, b) => (a.metadata?.chunk_index ?? 0) - (b.metadata?.chunk_index ?? 0)
    );
    const fullText = chunks.map((c) => c.chunk_text).join("\n");
    const content = fullText.slice(0, PREVIEW_MAX_CHARS);

    const { data: signed } = await supabase.storage
      .from(ADMIN_FILES_BUCKET)
      .createSignedUrl(file.file_path, 60 * 10);

    return NextResponse.json({
      file,
      content,
      content_truncated: fullText.length > PREVIEW_MAX_CHARS,
      chunk_count: chunks.length,
      download_url: signed?.signedUrl ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "파일 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const profile = profileData as Pick<Profile, "role"> | null;

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      is_active?: boolean;
      keywords?: string | null;
      description?: string | null;
    };

    const updatePayload: Record<string, unknown> = {};
    if (typeof body.is_active === "boolean") updatePayload.is_active = body.is_active;
    if (body.keywords !== undefined) updatePayload.keywords = body.keywords?.trim() || null;
    if (body.description !== undefined) updatePayload.description = body.description?.trim() || null;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "수정할 값(is_active/keywords/description)이 필요합니다." },
        { status: 400 }
      );
    }

    const { data: recordData, error: updateError } = await (supabase as any)
      .from("admin_files")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `상태 변경 실패: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ file: recordData as AdminFile });
  } catch {
    return NextResponse.json(
      { error: "상태 변경 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const profile = profileData as Pick<Profile, "role"> | null;

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the record first to find the file_path
    const { data: recordData, error: fetchError } = await supabase
      .from("admin_files")
      .select("file_path")
      .eq("id", id)
      .single();
    const record = recordData as Pick<AdminFile, "file_path"> | null;

    if (fetchError || !record) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }

    // Delete from Storage
    const { error: storageError } = await supabase.storage
      .from(ADMIN_FILES_BUCKET)
      .remove([record.file_path]);

    if (storageError) {
      return NextResponse.json(
        { error: `스토리지 삭제 실패: ${storageError.message}` },
        { status: 500 }
      );
    }

    // Delete from DB + RAG chunks
    const [{ error: dbError }] = await Promise.all([
      supabase.from("admin_files").delete().eq("id", id),
      (supabase as any).from("document_chunks")
        .delete()
        .eq("source_type", "admin_files")
        .eq("source_id", id),
    ]);

    if (dbError) {
      return NextResponse.json(
        { error: `DB 삭제 실패: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "파일 삭제 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
