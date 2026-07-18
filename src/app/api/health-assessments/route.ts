import { createClient } from "@/lib/supabase/server";
import { createHealthReport } from "@/features/health-check/scoring";
import { HEALTH_DOMAINS } from "@/features/health-check/data";
import type { AssessmentPayload } from "@/features/health-check/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  // Database type generation follows migration application in the hosted Supabase project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("consumer_health_assessments") as any)
    .select("id, health_score, health_grade, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let payload: AssessmentPayload;
  try {
    payload = await request.json() as AssessmentPayload;
  } catch {
    return Response.json({ error: "입력 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (!payload.profile?.name?.trim() || !payload.lifestyle || !payload.answers) {
    return Response.json({ error: "필수 정보를 입력해 주세요." }, { status: 400 });
  }
  const lifestyleValues = Object.values(payload.lifestyle);
  if (lifestyleValues.length !== 10 || lifestyleValues.some((value) => !Number.isInteger(value) || value < 1 || value > 5)) {
    return Response.json({ error: "생활습관 10개 문항에 모두 응답해 주세요." }, { status: 400 });
  }
  const answerValues = Object.values(payload.answers);
  const questionCount = HEALTH_DOMAINS.reduce((sum, domain) => sum + domain.questions.length, 0);
  if (answerValues.length !== questionCount || answerValues.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) {
    return Response.json({ error: `${questionCount}개 문항에 모두 응답해 주세요.` }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const report = createHealthReport(payload, id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("consumer_health_assessments") as any).insert({
    id,
    user_id: user.id,
    status: "completed",
    profile_data: payload.profile,
    lifestyle_data: payload.lifestyle,
    answers_data: payload.answers,
    report_data: report,
    total_risk_score: report.totalRiskScore,
    health_score: report.healthScore,
    health_grade: report.healthGrade,
    completed_at: report.createdAt,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id }, { status: 201 });
}
