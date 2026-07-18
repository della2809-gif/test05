import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

// 지플릿/케이스 카드용 커스텀 아이콘 업로드 전용 라우트.
// 기존 admin-images 버킷(public)을 재사용하되 admin_images 테이블에는 넣지 않는다 — Storage 객체만.
// 클라이언트가 이미 256×256 PNG로 리사이즈해서 보낸다.
const BUCKET = "admin-images";
const PREFIX = "giplet-icons";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg"];

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<Profile, "role"> | null;

  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }
  return { error: null, status: 200 };
}

export async function POST(request: Request) {
  const { error: authError, status: authStatus } = await requireAdmin();
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authStatus });
  }
  // Storage 작업은 서비스 롤 클라이언트로 RLS 우회 (어드민 인증은 위에서 완료)
  const supabase = createServiceClient();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "PNG 또는 JPG 이미지만 허용됩니다." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "파일 크기는 2MB 이하여야 합니다." }, { status: 400 });
  }

  const storagePath = `${PREFIX}/${crypto.randomUUID()}.png`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "image/png", upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({ url: urlData.publicUrl }, { status: 201 });
}
