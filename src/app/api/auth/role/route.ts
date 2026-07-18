import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  let userId: string | null = null;

  if (token) {
    // access_token으로 직접 조회
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user } } = await admin.auth.getUser(token);
    userId = user?.id ?? null;

    if (userId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role, onboarding_completed")
        .eq("id", userId)
        .single() as unknown as { data: { role: string; onboarding_completed: boolean } | null };

      return NextResponse.json({
        role: profile?.role ?? "user",
        onboarding_completed: profile?.onboarding_completed ?? false,
      });
    }
  }

  // 쿠키 세션 fallback
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ role: null }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single() as unknown as { data: { role: string; onboarding_completed: boolean } | null };

  return NextResponse.json({
    role: profile?.role ?? "user",
    onboarding_completed: profile?.onboarding_completed ?? false,
  });
}
