/**
 * USANA 가입 주차 계산 규칙:
 * - 토요일 15시 기준: 이전이면 이번주, 이후면 다음주 1주차
 * - USANA 주 시작: 토요일 15시
 *
 * 본 파일은 AO/마일스톤 계산의 단일 권위 있는 소스(Single Source of Truth)이다.
 * 다른 곳에서 같은 계산 로직을 중복 구현하지 말 것.
 */

/**
 * 가입일 기준 1주차 시작일(토요일 15시) 계산
 * @param afterCutoff - 토요일 가입 시 오후 3시 이후 여부 (날짜만 입력하는 경우 수동 지정)
 */
export function getUsanaWeekStart(joinDate: Date, afterCutoff: boolean = false): Date {
  const d = new Date(joinDate);
  const day = d.getDay();
  const hour = d.getHours();
  const minute = d.getMinutes();

  // 토요일이면 그대로, 아니면 직전 토요일로 이동 (주문일이 속한 USANA 주의 시작)
  const daysBefore = day === 6 ? 0 : day + 1;
  const thisSat = new Date(d);
  thisSat.setDate(d.getDate() - daysBefore);
  thisSat.setHours(15, 0, 0, 0);

  // 토요일 15시 이후면 다음 토요일이 1주차 시작
  const isSatAfterCutoff =
    (day === 6 && (hour > 15 || (hour === 15 && minute > 0))) ||
    (day === 6 && afterCutoff);

  if (isSatAfterCutoff) {
    thisSat.setDate(thisSat.getDate() + 7);
  }

  return thisSat;
}

/**
 * 첫 주문일 기준 AO(자동주문) 첫 주기 계산
 * - 5주차 일요일이 첫 AO
 */
export function calcAoCycleDate(firstOrderDate: Date, afterCutoff: boolean = false): Date {
  const weekStart = getUsanaWeekStart(firstOrderDate, afterCutoff);
  const week5Start = new Date(weekStart);
  week5Start.setDate(weekStart.getDate() + 28);
  const firstAo = new Date(week5Start);
  firstAo.setDate(week5Start.getDate() + 1);
  firstAo.setHours(0, 0, 0, 0);
  return firstAo;
}

/**
 * 첫 AO 일자 기준 4주 단위로 이후 AO 일정 count개 반환
 */
export function calcNextAoDates(firstAoDate: Date, count: number): Date[] {
  const result: Date[] = [];
  for (let i = 1; i <= count; i++) {
    const next = new Date(firstAoDate);
    next.setDate(firstAoDate.getDate() + 28 * i);
    next.setHours(0, 0, 0, 0);
    result.push(next);
  }
  return result;
}

/**
 * 마일스톤 일정 자동 생성 (가입일 기준 주차 경계 사용)
 * - AO와 동일하게 getUsanaWeekStart로 1주차 기준점(토요일 15시)을 먼저 찾은 뒤 주 단위로 계산
 * - coupon4w: weekStart + 28일 (4주 완료 후 쿠폰 1장)
 * - coupon8w: weekStart + 56일 (8주 완료 후 쿠폰 2장)
 * - week13: weekStart + 91일 (13주차 시작)
 * - week17: weekStart + 119일 (17주차 시작)
 */
export function calcMilestones(joinDate: Date, afterCutoff: boolean = false): {
  coupon4w: Date;
  coupon8w: Date;
  week13: Date;
  week17: Date;
} {
  const weekStart = getUsanaWeekStart(joinDate, afterCutoff);
  const addDays = (d: Date, days: number): Date => {
    const r = new Date(d);
    r.setDate(d.getDate() + days);
    r.setHours(0, 0, 0, 0);
    return r;
  };

  return {
    coupon4w: addDays(weekStart, 28),
    coupon8w: addDays(weekStart, 56),
    week13: addDays(weekStart, 91),
    week17: addDays(weekStart, 119),
  };
}

/**
 * 날짜를 YYYY-MM-DD 문자열로
 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 가입 완료 후 contacts 업데이트용 데이터 계산
 * - 마일스톤은 가입일 기준
 * - AO는 주문일 기준
 */
export function calcRegistrationData(
  joinDateStr: string,
  firstOrderDateStr?: string,
  joinSaturdayAfterCutoff: boolean = false,
  orderSaturdayAfterCutoff: boolean = false
) {
  if (!firstOrderDateStr) {
    return {
      join_date: joinDateStr,
      member_status: "주문대기" as const,
      ao_cycle_date: null,
    };
  }

  const joinDate = new Date(joinDateStr);
  const firstOrderDate = new Date(firstOrderDateStr);

  const aoDate = calcAoCycleDate(firstOrderDate, orderSaturdayAfterCutoff);
  const milestones = calcMilestones(joinDate, joinSaturdayAfterCutoff);

  return {
    join_date: joinDateStr,
    first_order_date: firstOrderDateStr,
    member_status: "섭취중" as const,
    ao_cycle_date: toDateStr(aoDate),
    saturday_after_cutoff: joinSaturdayAfterCutoff || orderSaturdayAfterCutoff,
    milestones: {
      coupon4w: toDateStr(milestones.coupon4w),
      coupon8w: toDateStr(milestones.coupon8w),
      week13: toDateStr(milestones.week13),
      week17: toDateStr(milestones.week17),
    },
  };
}
