import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Archive, ArchiveCategory } from "@/types/database";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  let query = supabase
    .from("archives")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,content.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const title =
    body.title || `기록 ${new Date().toLocaleDateString("ko-KR")}`;
  const category: ArchiveCategory = body.category || "etc";

  const insertData = {
    user_id: user.id,
    title,
    category,
    content: body.content ?? "",
    conversation_id: body.conversation_id ?? null,
  };

  const { data, error } = await supabase
    .from("archives")
    // @ts-expect-error -- Database type resolves Insert to never; runtime is correct
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const archive = data as Archive | null;

  // Insert attachments if provided
  if (body.attachments && Array.isArray(body.attachments) && archive) {
    const attachmentInserts = body.attachments.map(
      (att: {
        file_name: string;
        file_path: string;
        file_type: string;
        file_size: number;
      }) => ({
        archive_id: archive.id,
        file_name: att.file_name,
        file_path: att.file_path,
        file_type: att.file_type,
        file_size: att.file_size,
      })
    );

    await supabase.from("archive_attachments").insert(attachmentInserts);
  }

  return NextResponse.json({ data: archive }, { status: 201 });
}
