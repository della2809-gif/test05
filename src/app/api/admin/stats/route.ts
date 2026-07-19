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
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [
    { count: totalUsers },
    { count: paidUsers },
    { count: totalConversations },
    { count: totalArchives },
    { count: totalContacts },
    { count: totalConsultations },
    { count: activeSchedules },
  ] = await Promise.all([
    adminClient.from("profiles").select("id", { count: "exact", head: true }),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("status", "paid"),
    adminClient.from("conversations").select("id", { count: "exact", head: true }),
    adminClient.from("archives").select("id", { count: "exact", head: true }),
    adminClient.from("contacts").select("id", { count: "exact", head: true }),
    adminClient.from("consultations").select("id", { count: "exact", head: true }),
    adminClient.from("schedules").select("id", { count: "exact", head: true }).eq("is_done", false),
  ]);

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    paidUsers: paidUsers ?? 0,
    totalConversations: totalConversations ?? 0,
    totalArchives: totalArchives ?? 0,
    totalContacts: totalContacts ?? 0,
    totalConsultations: totalConsultations ?? 0,
    activeSchedules: activeSchedules ?? 0,
  });
}
