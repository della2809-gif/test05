import { createClient } from "@/lib/supabase/server";
import { HEALTH_DOMAINS } from "@/features/health-check/data";
import { createHealthReport } from "@/features/health-check/scoring";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "preview") {
    const energyPatternDomains = new Set(["energy", "recovery", "brain_nerve"]);
    const answers = Object.fromEntries(
      HEALTH_DOMAINS.flatMap((domain) =>
        domain.questions.map((question, questionIndex) => [
          question.code,
          energyPatternDomains.has(domain.code) ? [3, 3, 2, 3, 2][questionIndex] : [0, 1, 0, 1, 0][questionIndex],
        ]),
      ),
    );
    const report = createHealthReport({
      profile: {
        name: "지니아 회원",
        gender: "female",
        age: 45,
        heightCm: 163,
        weightKg: 60,
        healthGoal: "일상 활력과 건강한 생활습관 만들기",
      },
      lifestyle: {
        regularMeals: 5,
        vegetables: 5,
        fruit: 1,
        protein: 5,
        hydration: 1,
        caffeine: 1,
        exercise: 1,
        sleep: 5,
        sunlight: 1,
        monitoring: 5,
      },
      answers,
    }, "preview");
    return Response.json({ data: report });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  // Database type generation follows migration application in the hosted Supabase project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("consumer_health_assessments") as any)
    .select("report_data")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return Response.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ data: data.report_data });
}
