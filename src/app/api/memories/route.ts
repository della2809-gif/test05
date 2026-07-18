import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const pinned = searchParams.get("pinned");

  let query = supabase
    .from("memories")
    .select("*")
    .eq("user_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  if (pinned === "true") {
    query = query.eq("is_pinned", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from("memories")
    .insert({
      user_id: user.id,
      title: body.title,
      content: body.content,
      conversation_id: body.conversation_id || null,
    } as any)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Link tags if provided
  const memory = data as { id: string } | null;
  if (body.tag_ids?.length && memory) {
    await supabase.from("memory_tag_links").insert(
      body.tag_ids.map((tagId: string) => ({
        memory_id: memory.id,
        tag_id: tagId,
      }))
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
