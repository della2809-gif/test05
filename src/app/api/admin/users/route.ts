import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are not configured.");
  }
  return createClient(url, serviceRoleKey);
}

export async function GET() {
  const adminClient = getAdminClient();
  // 요청자가 admin인지 확인
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // auth.users + profiles 조인
  const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const { data: profiles } = await adminClient.from("profiles").select("*");

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const users = (authUsers?.users ?? []).map((u) => {
    const p = profileMap.get(u.id) ?? {};
    return {
      id: u.id,
      email: u.email ?? null,
      name: (p as any).name ?? null,
      phone: (p as any).phone ?? null,
      team: (p as any).team ?? null,
      role: (p as any).role ?? "user",
      status: (p as any).status ?? "free",
      payment_date: (p as any).payment_date ?? null,
      free_trial_expires_at: (p as any).free_trial_expires_at ?? null,
      referrer_name: (p as any).referrer_name ?? null,
      referrer_phone: (p as any).referrer_phone ?? null,
      member_type: (p as any).member_type ?? null,
      direct_mentor_name: (p as any).direct_mentor_name ?? null,
      direct_mentor_phone: (p as any).direct_mentor_phone ?? null,
      leaders_mentor_name: (p as any).leaders_mentor_name ?? null,
      leaders_mentor_phone: (p as any).leaders_mentor_phone ?? null,
      created_at: u.created_at,
    };
  });

  return NextResponse.json({ data: users });
}

export async function PATCH(req: Request) {
  const adminClient = getAdminClient();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...rawUpdates } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const ALLOWED_FIELDS = new Set([
    "name", "phone", "team", "role", "status",
    "payment_date", "free_trial_expires_at",
    "referrer_name", "referrer_phone", "member_type",
    "direct_mentor_name", "direct_mentor_phone",
    "leaders_mentor_name", "leaders_mentor_phone",
  ]);
  const updates = Object.fromEntries(
    Object.entries(rawUpdates).filter(([key]) => ALLOWED_FIELDS.has(key))
  );

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const { data, error } = await adminClient.from("profiles").update(updates).eq("id", id).select();
  if (error) {
    console.error("[admin/users PATCH] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
