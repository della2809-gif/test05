import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calcAoCycleDate,
  calcMilestones,
  calcNextAoDates,
  toDateStr,
} from "@/lib/usana-dates";

const FREQ_TO_DAYS: Record<string, number> = {
  "매일": 1,
  "주2회": 3,
  "주3회": 2,
  "주1회": 7,
  "격주": 14,
  "월1회": 30,
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await (supabase.from("contacts") as any).select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

type AoChangeLogEntry = {
  changed_at: string;
  old_ao: string | null;
  new_ao: string | null;
  note: string;
};

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawBody = await _req.json();

  // saturday 컷오프 플래그는 계산용이며 DB에 저장하지 않음
  const {
    join_saturday_after_cutoff: joinAfterCutoff = false,
    order_saturday_after_cutoff: orderAfterCutoff = false,
    ...body
  } = rawBody;

  // 변경 전 contacts 조회 (재계산 판단/이력 기록용)
  const { data: existing, error: fetchErr } = await (supabase.from("contacts") as any)
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 });

  const firstOrderChanged =
    Object.prototype.hasOwnProperty.call(body, "first_order_date") &&
    body.first_order_date !== existing.first_order_date;

  const joinDateChanged =
    !firstOrderChanged &&
    Object.prototype.hasOwnProperty.call(body, "join_date") &&
    body.join_date !== existing.join_date;

  const aoChangedManually =
    !firstOrderChanged &&
    Object.prototype.hasOwnProperty.call(body, "ao_cycle_date") &&
    body.ao_cycle_date !== existing.ao_cycle_date;

  const updatePayload: Record<string, unknown> = { ...body };

  // ── Case 1: first_order_date 변경 → AO + 마일스톤 전체 재계산 ──
  if (firstOrderChanged && body.first_order_date) {
    const firstOrderDate = new Date(body.first_order_date);
    const joinDateStr = body.join_date || existing.join_date;
    const joinDate = joinDateStr ? new Date(joinDateStr) : firstOrderDate;

    const firstAo = calcAoCycleDate(firstOrderDate, orderAfterCutoff);
    const milestones = calcMilestones(joinDate, joinAfterCutoff);

    updatePayload.ao_cycle_date = toDateStr(firstAo);
    updatePayload.ao_source = "auto";
    updatePayload.milestones = {
      coupon4w: toDateStr(milestones.coupon4w),
      coupon8w: toDateStr(milestones.coupon8w),
      week13: toDateStr(milestones.week13),
      week17: toDateStr(milestones.week17),
    };

  // ── Case 2: join_date만 변경 → 마일스톤만 재계산 (AO는 그대로) ──
  } else if (joinDateChanged && body.join_date) {
    const joinDate = new Date(body.join_date);
    const milestones = calcMilestones(joinDate, joinAfterCutoff);

    updatePayload.milestones = {
      coupon4w: toDateStr(milestones.coupon4w),
      coupon8w: toDateStr(milestones.coupon8w),
      week13: toDateStr(milestones.week13),
      week17: toDateStr(milestones.week17),
    };

  // ── Case 3: AO만 수동 변경 → 이력 기록 ──
  } else if (aoChangedManually && body.ao_cycle_date) {
    const prevLog: AoChangeLogEntry[] = Array.isArray(existing.ao_change_log)
      ? (existing.ao_change_log as AoChangeLogEntry[])
      : [];
    const entry: AoChangeLogEntry = {
      changed_at: new Date().toISOString(),
      old_ao: existing.ao_cycle_date ?? null,
      new_ao: body.ao_cycle_date ?? null,
      note: "수동 변경",
    };
    updatePayload.ao_source = "manual";
    updatePayload.ao_change_log = [...prevLog, entry];
  }

  const { data, error } = await (supabase.from("contacts") as any)
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── 일정 재생성 ──

  if (firstOrderChanged && body.first_order_date) {
    // 기존 자동 생성 일정 전체 삭제 후 전부 재생성
    await (supabase.from("schedules") as any)
      .delete()
      .eq("contact_id", id)
      .eq("is_auto_generated", true);

    const firstOrderDate = new Date(body.first_order_date);
    const joinDateStrForSchedule = body.join_date || existing.join_date;
    const joinDateForSchedule = joinDateStrForSchedule ? new Date(joinDateStrForSchedule) : firstOrderDate;
    const firstAo = calcAoCycleDate(firstOrderDate, orderAfterCutoff);
    const milestones = calcMilestones(joinDateForSchedule, joinAfterCutoff);
    const nextAos = calcNextAoDates(firstAo, 5);
    const allAos = [firstAo, ...nextAos];

    const aoSchedules = allAos.map((d, idx) => ({
      user_id: user.id,
      contact_id: id,
      title: idx === 0 ? "첫 AO 주문 확인" : `AO 주문 확인 (${idx + 1}회차)`,
      schedule_type: "ao_check",
      scheduled_date: toDateStr(d),
      is_done: false,
      is_auto_generated: true,
      notes: `${data.name ?? ""}님 자동 생성 일정`,
    }));

    const milestoneSchedules = [
      { title: "4주차 (쿠폰 1장)", date: milestones.coupon4w },
      { title: "8주차 (쿠폰 2장)", date: milestones.coupon8w },
      { title: "13주 매칭 보너스 마감", date: milestones.week13 },
      { title: "17주 최종 마감 (보너스 유예)", date: milestones.week17 },
    ].map((m) => ({
      user_id: user.id,
      contact_id: id,
      title: m.title,
      schedule_type: "milestone",
      scheduled_date: toDateStr(m.date),
      is_done: false,
      is_auto_generated: true,
      notes: `${data.name ?? ""}님 자동 생성 일정`,
    }));

    // 팔로업도 재생성
    const followupSchedules: object[] = [];
    const careMode = (body.care_mode || existing.care_mode) as string | undefined;
    const contactFreq = (body.contact_frequency || existing.contact_frequency) as string | undefined;
    const intervalDays = contactFreq ? FREQ_TO_DAYS[contactFreq] : undefined;

    if (intervalDays && careMode && careMode !== "자율" && careMode !== "중단" && careMode !== "임시중단") {
      const totalDays = 28;
      let day = intervalDays;
      while (day <= totalDays) {
        const d = new Date();
        d.setDate(d.getDate() + day);
        followupSchedules.push({
          user_id: user.id,
          contact_id: id,
          title: `${data.name ?? ""}님 팔로업`,
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

  } else if (joinDateChanged && body.join_date) {
    // join_date만 변경 → milestone 일정만 교체
    const joinDate = new Date(body.join_date);
    const milestones = calcMilestones(joinDate, joinAfterCutoff);

    await (supabase.from("schedules") as any)
      .delete()
      .eq("contact_id", id)
      .eq("is_auto_generated", true)
      .eq("schedule_type", "milestone");

    const milestoneSchedules = [
      { title: "4주차 (쿠폰 1장)", date: milestones.coupon4w },
      { title: "8주차 (쿠폰 2장)", date: milestones.coupon8w },
      { title: "13주 매칭 보너스 마감", date: milestones.week13 },
      { title: "17주 최종 마감 (보너스 유예)", date: milestones.week17 },
    ].map((m) => ({
      user_id: user.id,
      contact_id: id,
      title: m.title,
      schedule_type: "milestone",
      scheduled_date: toDateStr(m.date),
      is_done: false,
      is_auto_generated: true,
      notes: `${data.name ?? ""}님 자동 생성 일정`,
    }));

    await (supabase.from("schedules") as any).insert(milestoneSchedules);

  } else if (aoChangedManually && body.ao_cycle_date) {
    // AO만 수동 변경 → ao_check 일정만 교체
    await (supabase.from("schedules") as any)
      .delete()
      .eq("contact_id", id)
      .eq("is_auto_generated", true)
      .eq("schedule_type", "ao_check");

    const firstAo = new Date(body.ao_cycle_date);
    const nextAos = calcNextAoDates(firstAo, 5);
    const allAos = [firstAo, ...nextAos];

    const aoSchedules = allAos.map((d, idx) => ({
      user_id: user.id,
      contact_id: id,
      title: idx === 0 ? "첫 AO 주문 확인" : `AO 주문 확인 (${idx + 1}회차)`,
      schedule_type: "ao_check",
      scheduled_date: toDateStr(d),
      is_done: false,
      is_auto_generated: true,
      notes: `${data.name ?? ""}님 자동 생성 일정`,
    }));

    await (supabase.from("schedules") as any).insert(aoSchedules);
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // schedules.contact_id에는 FK cascade가 없어 회원만 지우면 일정이 고아로 남는다.
  // 회원 삭제 시 연결된 일정도 함께 정리한다 (확인창 안내와 일치).
  await (supabase.from("schedules") as any).delete().eq("contact_id", id);

  const { error } = await (supabase.from("contacts") as any).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
