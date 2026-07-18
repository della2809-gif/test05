import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calcAoCycleDate,
  calcMilestones,
  calcNextAoDates,
  toDateStr,
} from "@/lib/usana-dates";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = (supabase.from("contacts") as any)
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (search) {
    const safeSearch = search.replace(/[%_\\]/g, "\\$&").replace(/[,()]/g, "");
    if (safeSearch) {
      query = query.or(`name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
    }
  }
  if (status) {
    query = query.eq("member_status", status);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count ?? 0, page, pageSize: PAGE_SIZE });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawBody = await request.json();

  // saturday_after_cutoff 플래그는 계산용이며 DB에 저장하지 않음
  const {
    join_saturday_after_cutoff: joinAfterCutoff = false,
    order_saturday_after_cutoff: orderAfterCutoff = false,
    ...body
  } = rawBody;

  // AO 주기 자동 계산 (first_order_date 있을 때, saturday 컷오프 반영)
  let aoExtras: Record<string, unknown> = {};
  let firstAoDate: Date | null = null;
  let milestones: ReturnType<typeof calcMilestones> | null = null;

  if (body.first_order_date) {
    const firstOrderDate = new Date(body.first_order_date);
    const joinDateStr = body.join_date;
    const joinDate = joinDateStr ? new Date(joinDateStr) : firstOrderDate;
    firstAoDate = calcAoCycleDate(firstOrderDate, orderAfterCutoff);
    milestones = calcMilestones(joinDate, joinAfterCutoff);
    aoExtras = {
      ao_cycle_date: toDateStr(firstAoDate),
      ao_source: "auto",
      ao_change_log: [],
      milestones: {
        coupon4w: toDateStr(milestones.coupon4w),
        coupon8w: toDateStr(milestones.coupon8w),
        week13: toDateStr(milestones.week13),
        week17: toDateStr(milestones.week17),
      },
    };
  }

  const { data, error } = await (supabase.from("contacts") as any)
    .insert({ ...body, user_id: user.id, ...aoExtras })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 접촉 주기 → 날짜 간격(일) 매핑
  const FREQ_TO_DAYS: Record<string, number> = {
    "매일": 1,
    "주2회": 3,
    "주3회": 2,
    "주1회": 7,
    "격주": 14,
    "월1회": 30,
  };

  // 자동 일정 생성: AO 6개(첫 AO + 이후 5개) + 마일스톤 4개 + 접촉 리마인드
  if (data && firstAoDate && milestones) {
    const nextAos = calcNextAoDates(firstAoDate, 5);
    const allAos = [firstAoDate, ...nextAos];

    const aoSchedules = allAos.map((d, idx) => ({
      user_id: user.id,
      contact_id: data.id,
      title: idx === 0 ? "첫 AO 주문 확인" : `AO 주문 확인 (${idx + 1}회차)`,
      schedule_type: "ao_check",
      scheduled_date: toDateStr(d),
      is_done: false,
      is_auto_generated: true,
      notes: `${body.name ?? ""}님 자동 생성 일정`,
    }));

    const milestoneSchedules = [
      { title: "4주차 (쿠폰 1장)", date: milestones.coupon4w },
      { title: "8주차 (쿠폰 2장)", date: milestones.coupon8w },
      { title: "13주 매칭 보너스 마감", date: milestones.week13 },
      { title: "17주 최종 마감 (보너스 유예)", date: milestones.week17 },
    ].map((m) => ({
      user_id: user.id,
      contact_id: data.id,
      title: m.title,
      schedule_type: "milestone",
      scheduled_date: toDateStr(m.date),
      is_done: false,
      is_auto_generated: true,
      notes: `${body.name ?? ""}님 자동 생성 일정`,
    }));

    // 접촉 리마인드 자동 생성 (care_mode가 자율/중단이 아닐 때)
    const followupSchedules: object[] = [];
    const careMode = body.care_mode as string | undefined;
    const contactFreq = body.contact_frequency as string | undefined;
    const intervalDays = contactFreq ? FREQ_TO_DAYS[contactFreq] : undefined;

    if (intervalDays && careMode && careMode !== "자율" && careMode !== "중단" && careMode !== "임시중단") {
      const totalDays = 28;
      const contactName = body.name ?? "";
      let day = intervalDays;
      while (day <= totalDays) {
        const d = new Date();
        d.setDate(d.getDate() + day);
        followupSchedules.push({
          user_id: user.id,
          contact_id: data.id,
          title: `${contactName}님 팔로업`,
          schedule_type: "followup",
          life_layer: "유사나",
          scheduled_date: toDateStr(d),
          is_done: false,
          is_auto_generated: true,
          notes: `접촉 주기(${contactFreq}) 자동 생성`,
        });
        day += intervalDays;
      }
    }

    await (supabase.from("schedules") as any).insert([...aoSchedules, ...milestoneSchedules, ...followupSchedules]);
  } else if (data) {
    // first_order_date 없어도 접촉 리마인드는 생성
    const followupSchedules: object[] = [];
    const careMode = body.care_mode as string | undefined;
    const contactFreq = body.contact_frequency as string | undefined;
    const intervalDays = contactFreq ? FREQ_TO_DAYS[contactFreq] : undefined;

    if (intervalDays && careMode && careMode !== "자율" && careMode !== "중단" && careMode !== "임시중단") {
      const totalDays = 28;
      const contactName = body.name ?? "";
      let day = intervalDays;
      while (day <= totalDays) {
        const d = new Date();
        d.setDate(d.getDate() + day);
        followupSchedules.push({
          user_id: user.id,
          contact_id: data.id,
          title: `${contactName}님 팔로업`,
          schedule_type: "followup",
          life_layer: "유사나",
          scheduled_date: toDateStr(d),
          is_done: false,
          is_auto_generated: true,
          notes: `접촉 주기(${contactFreq}) 자동 생성`,
        });
        day += intervalDays;
      }
    }

    if (followupSchedules.length > 0) {
      await (supabase.from("schedules") as any).insert(followupSchedules);
    }
  }

  return NextResponse.json({ data }, { status: 201 });
}
