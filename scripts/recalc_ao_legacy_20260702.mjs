#!/usr/bin/env node
/**
 * recalc_ao_legacy_20260702.mjs
 *
 * AO 계산식 재작성(commit e878f6c) 이전에 등록된 레거시 contacts 레코드는
 * 재계산되지 않아 저장된 ao_cycle_date / milestones 가 현행 공식과 어긋난다.
 * (증상: 리스트 화면은 옛 저장값, 세부/수정 화면은 재계산값 → 서로 달라 보임)
 *
 * 이 스크립트는 `ao_source='auto' AND first_order_date IS NOT NULL` 인 contacts 를
 * 현행 공식(src/lib/usana-dates.ts 와 동일 로직)으로 재계산하여
 * ao_cycle_date · milestones 컬럼을 UPDATE 한다.
 *
 * !! AO 기준(가입일/첫주문일)은 현행 공식을 그대로 유지한다 — 기준 변경이 아니라
 *    "레거시 저장값을 현행 공식으로 다시 맞추는" 일회성 정합화이다.
 *
 * 제외 대상:
 *   - ao_source = 'manual'  (운영자가 손으로 지정한 AO는 건드리지 않음)
 *   - first_order_date IS NULL (아직 첫 주문 전 → AO 미산출)
 *
 * 기본 동작: DRY-RUN (아무것도 쓰지 않고 전/후 값만 출력).
 * 실제 반영: --apply 플래그를 붙였을 때만 UPDATE.
 *
 * 스케줄 재생성(--regen-schedules): 기본 OFF.
 *   ao_check / milestone 자동 일정을 현행 날짜로 다시 생성한다. 기본 OFF 인 이유는
 *   기존 자동 일정을 삭제·재삽입하는 과정에서 이미 완료 처리(is_done)된 일정의
 *   이력이 사라지기 때문. 필요 시 운영자 판단으로 명시적으로만 켠다.
 *
 * 사용법:
 *   node scripts/recalc_ao_legacy_20260702.mjs                        # dry-run
 *   node scripts/recalc_ao_legacy_20260702.mjs --apply                # ao/milestones 반영
 *   node scripts/recalc_ao_legacy_20260702.mjs --apply --regen-schedules  # 일정까지 재생성
 *
 * 시간대: 클라이언트(브라우저, KST)와 동일한 계산 결과를 얻기 위해 TZ 를 강제한다.
 */

process.env.TZ = "Asia/Seoul";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const APPLY = process.argv.includes("--apply");
const REGEN_SCHEDULES = process.argv.includes("--regen-schedules");

// ---------------------------------------------------------------------------
// env 로드 (.env.local)
// ---------------------------------------------------------------------------
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}
const ENV = loadEnv();
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL / SERVICE_ROLE_KEY 누락 (.env.local 확인)");
  process.exit(1);
}
const SB_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// ---------------------------------------------------------------------------
// USANA 날짜 계산 (src/lib/usana-dates.ts 와 동일 로직 — 단일 권위 소스 복제)
// ---------------------------------------------------------------------------
function getUsanaWeekStart(joinDate, afterCutoff = false) {
  const d = new Date(joinDate);
  const day = d.getDay();
  const hour = d.getHours();
  const minute = d.getMinutes();

  const daysBefore = day === 6 ? 0 : day + 1;
  const thisSat = new Date(d);
  thisSat.setDate(d.getDate() - daysBefore);
  thisSat.setHours(15, 0, 0, 0);

  const isSatAfterCutoff =
    (day === 6 && (hour > 15 || (hour === 15 && minute > 0))) ||
    (day === 6 && afterCutoff);

  if (isSatAfterCutoff) {
    thisSat.setDate(thisSat.getDate() + 7);
  }
  return thisSat;
}

function calcAoCycleDate(firstOrderDate, afterCutoff = false) {
  const weekStart = getUsanaWeekStart(firstOrderDate, afterCutoff);
  const week5Start = new Date(weekStart);
  week5Start.setDate(weekStart.getDate() + 28);
  const firstAo = new Date(week5Start);
  firstAo.setDate(week5Start.getDate() + 1);
  firstAo.setHours(0, 0, 0, 0);
  return firstAo;
}

function calcNextAoDates(firstAoDate, count) {
  const result = [];
  for (let i = 1; i <= count; i++) {
    const next = new Date(firstAoDate);
    next.setDate(firstAoDate.getDate() + 28 * i);
    next.setHours(0, 0, 0, 0);
    result.push(next);
  }
  return result;
}

function calcMilestones(joinDate, afterCutoff = false) {
  const weekStart = getUsanaWeekStart(joinDate, afterCutoff);
  const addDays = (d, days) => {
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

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Supabase REST 헬퍼
// ---------------------------------------------------------------------------
async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`GET ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}
async function sbPatch(path, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}
async function sbDelete(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: { ...SB_HEADERS, Prefer: "return=representation" },
  });
  if (!res.ok) throw new Error(`DELETE ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}
async function sbInsert(table, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`INSERT ${table} ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// 비교 유틸
// ---------------------------------------------------------------------------
const MS_KEYS = ["coupon4w", "coupon8w", "week13", "week17"];

function milestonesEqual(a, b) {
  if (!a || !b) return false;
  return MS_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));
}

function fmtMilestones(ms) {
  if (!ms) return "(없음)";
  return MS_KEYS.map((k) => `${k}=${ms[k] ?? "-"}`).join(" ");
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== AO 레거시 재계산 (${APPLY ? "APPLY" : "DRY-RUN"}${REGEN_SCHEDULES ? " +regen-schedules" : ""}) ===`);
  console.log("대상 조건: ao_source='auto' AND first_order_date IS NOT NULL (manual 제외)");
  console.log("기준: 현행 공식 유지 (기준 변경 아님). TZ=Asia/Seoul\n");

  // 대상 조회
  const cols = "id,name,ao_source,join_date,first_order_date,ao_cycle_date,milestones,user_id";
  const rows = await sbGet(
    `contacts?select=${cols}&ao_source=eq.auto&first_order_date=not.is.null&order=name`
  );

  console.log(`조회된 대상: ${rows.length}건\n`);

  const changed = [];
  const unchanged = [];

  for (const c of rows) {
    // saturday_after_cutoff 는 DB에 저장되지 않으므로 복원 불가 → false 로 재계산.
    // 토요일 등록이 아닌 경우 결과에 영향 없음. 토요일 등록 회원만 수동 확인 필요.
    const firstOrderDate = new Date(c.first_order_date);
    const joinDate = c.join_date ? new Date(c.join_date) : firstOrderDate;

    const newAo = toDateStr(calcAoCycleDate(firstOrderDate, false));
    const newMs = (() => {
      const m = calcMilestones(joinDate, false);
      return {
        coupon4w: toDateStr(m.coupon4w),
        coupon8w: toDateStr(m.coupon8w),
        week13: toDateStr(m.week13),
        week17: toDateStr(m.week17),
      };
    })();

    const aoDiff = (c.ao_cycle_date ?? null) !== newAo;
    const msDiff = !milestonesEqual(c.milestones, newMs);

    const rec = { c, newAo, newMs, aoDiff, msDiff };
    if (aoDiff || msDiff) changed.push(rec);
    else unchanged.push(rec);
  }

  // ── 상세 출력 ──
  console.log(`── 변경 필요: ${changed.length}건 / 이미 일치: ${unchanged.length}건 ──\n`);

  for (const { c, newAo, newMs, aoDiff, msDiff } of changed) {
    console.log(`■ ${c.name || "(이름없음)"}  [id=${c.id}]`);
    console.log(`   가입일=${c.join_date ?? "-"}  첫주문일=${c.first_order_date}`);
    if (aoDiff) {
      console.log(`   AO 예정일 : ${c.ao_cycle_date ?? "(없음)"}  →  ${newAo}`);
    } else {
      console.log(`   AO 예정일 : ${c.ao_cycle_date ?? "(없음)"} (변경 없음)`);
    }
    if (msDiff) {
      console.log(`   마일스톤(전): ${fmtMilestones(c.milestones)}`);
      console.log(`   마일스톤(후): ${fmtMilestones(newMs)}`);
    } else {
      console.log(`   마일스톤 : 변경 없음`);
    }
    console.log("");
  }

  if (unchanged.length) {
    console.log("── 이미 현행 공식과 일치(변경 없음) ──");
    for (const { c } of unchanged) {
      console.log(`   · ${c.name || "(이름없음)"}  AO=${c.ao_cycle_date ?? "-"}`);
    }
    console.log("");
  }

  if (!APPLY) {
    console.log("DRY-RUN 종료. 실제 반영하려면 --apply 를 붙이세요.");
    console.log(REGEN_SCHEDULES
      ? "(--regen-schedules 는 --apply 와 함께여야 동작합니다.)\n"
      : "(자동 일정까지 재생성하려면 --apply --regen-schedules)\n");
    return;
  }

  if (changed.length === 0) {
    console.log("변경 대상 없음 — 반영할 것이 없습니다.\n");
    return;
  }

  // ── APPLY: ao_cycle_date + milestones UPDATE ──
  console.log("── APPLY 시작 (ao_cycle_date + milestones) ──");
  let ok = 0, fail = 0;
  for (const { c, newAo, newMs } of changed) {
    try {
      await sbPatch(`contacts?id=eq.${c.id}`, {
        ao_cycle_date: newAo,
        milestones: newMs,
      });
      console.log(`  ✓ ${c.name}: AO=${newAo} / ${fmtMilestones(newMs)}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ 실패 [${c.name}]: ${e.message}`);
      fail++;
    }
  }
  console.log(`\ncontacts 반영 완료: 성공 ${ok} / 실패 ${fail}\n`);

  // ── (옵션) 자동 일정 재생성 ──
  if (!REGEN_SCHEDULES) {
    console.log("자동 일정(ao_check/milestone) 재생성은 건너뜀 (기본 OFF).");
    console.log("완료(is_done) 일정 이력 보존을 위해 명시적 --regen-schedules 지정 시에만 수행합니다.\n");
    return;
  }

  console.log("── 자동 일정 재생성 (ao_check + milestone) ──");
  let sOk = 0, sFail = 0;
  for (const { c, newAo, newMs } of changed) {
    try {
      if (!c.user_id) {
        console.error(`  ✗ [${c.name}] user_id 없음 — 일정 재생성 불가 (스킵)`);
        sFail++;
        continue;
      }
      // 기존 자동 ao_check / milestone 일정 삭제
      await sbDelete(`schedules?contact_id=eq.${c.id}&is_auto_generated=eq.true&schedule_type=eq.ao_check`);
      await sbDelete(`schedules?contact_id=eq.${c.id}&is_auto_generated=eq.true&schedule_type=eq.milestone`);

      const firstAo = new Date(newAo);
      const allAos = [firstAo, ...calcNextAoDates(firstAo, 5)];
      const aoSchedules = allAos.map((d, idx) => ({
        user_id: c.user_id,
        contact_id: c.id,
        title: idx === 0 ? "첫 AO 주문 확인" : `AO 주문 확인 (${idx + 1}회차)`,
        schedule_type: "ao_check",
        scheduled_date: toDateStr(d),
        is_done: false,
        is_auto_generated: true,
        notes: `${c.name ?? ""}님 자동 생성 일정 (레거시 재계산)`,
      }));

      const milestoneSchedules = [
        { title: "4주차 (쿠폰 1장)", date: newMs.coupon4w },
        { title: "8주차 (쿠폰 2장)", date: newMs.coupon8w },
        { title: "13주 매칭 보너스 마감", date: newMs.week13 },
        { title: "17주 최종 마감 (보너스 유예)", date: newMs.week17 },
      ].map((m) => ({
        user_id: c.user_id,
        contact_id: c.id,
        title: m.title,
        schedule_type: "milestone",
        scheduled_date: m.date,
        is_done: false,
        is_auto_generated: true,
        notes: `${c.name ?? ""}님 자동 생성 일정 (레거시 재계산)`,
      }));

      await sbInsert("schedules", [...aoSchedules, ...milestoneSchedules]);
      console.log(`  ✓ ${c.name}: ao_check 6 + milestone 4 재생성`);
      sOk++;
    } catch (e) {
      console.error(`  ✗ 일정 실패 [${c.name}]: ${e.message}`);
      sFail++;
    }
  }
  console.log(`\n일정 재생성 완료: 성공 ${sOk} / 실패 ${sFail}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
