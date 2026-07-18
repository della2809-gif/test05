// USANA 수당 계산 엔진

export const USD_TO_KRW = 1150;
export const TAX_RATE = 0.033; // 3.3%

// 소실적(좌우 중 작은 실적)이 이 점수 이상일 때부터 기본 수당이 발생한다. (운영정책 3-10)
export const MIN_ACTIVE_CVP = 125;
// 실적유지(액티브 유지) 필요 점수 — 1BC 운영 시 100점, 2BC 이상 운영 시 200점.
// 클라이언트(대표) 2026-07-04 지정 기준. 수당 발생 게이트(MIN_ACTIVE_CVP)와는 별개의
// 유지 조건으로, 결과 카드에 안내용으로 표기한다. (라이브 정책 확정은 매니저 확인 필요)
export const MAINTENANCE_CVP = { single: 100, multi: 200 } as const;

// BC(가게) 수 기준 실적유지 필요 점수
export function maintenanceRequirement(bcCount: number): number {
  return bcCount >= 2 ? MAINTENANCE_CVP.multi : MAINTENANCE_CVP.single;
}
export const BASIC_RATE = 0.2;   // 기본 수당 = 소실적 × 20%
export const SALES_BONUS_RATE = 0.1; // 세일즈 보너스 = 직접 소개 점수 × 10%

export interface ShopLine {
  id: string;        // 라인 번호 (001, 002, 003 등)
  left: number;      // 좌측 CVP (누적 총점)
  right: number;     // 우측 CVP (누적 총점)
  isDirectReferral?: boolean; // 직접 소개 라인 여부 (세일즈 보너스 대상)
  /** 신규점수(이월 제외) — 3BC 공유/누적 계산에 사용. 미입력 시 누적 0으로 본다. (운영정책 3-10) */
  newLeft?: number;
  newRight?: number;
}

export interface CommissionInput {
  shops: ShopLine[];
  targetRank?: string; // 목표 직급 (선택)
  period?: "1w" | "4w" | "8w" | "13w"; // 계산 기간
}

export interface CommissionResult {
  totalMinCvp: number;       // 소실적 합계 (전체, 직급/참고용)
  eligibleMinCvp: number;    // 125점 이상이라 기본수당이 발생하는 소실적 합계
  pendingShopIds: string[];  // 소실적 125점 미만 = "점수 누적 중"인 라인
  basicCommissionUsd: number; // 기본 수당 ($) — eligibleMinCvp × 20%
  salesBonusUsd: number;      // 세일즈 보너스 ($)
  totalCommissionUsd: number; // 총 수당 ($)
  totalCommissionKrw: number; // 한화 환산
  netCommissionKrw: number;   // 세후 수령액
  currentRank: string;        // 현재 직급
  nextRank: string | null;    // 다음 직급
  cvpToNextRank: number;      // 다음 직급까지 필요 CVP
  /** 운영 중인 BC(가게) 수 — 실적유지 조건 표기용 */
  bcCount?: number;
  /** 실적유지 필요 점수 (1BC=100 / 2BC+=200) */
  maintenanceRequiredCvp?: number;
}

export interface Scenario {
  name: "안정형" | "승급형" | "집중형";
  description: string;
  additionalCvp: number;        // 추가 CVP
  projectedTotalCvp: number;
  projectedRank: string;
  projectedCommissionUsd: number;
  projectedNetKrw: number;
  feasibility: "높음" | "중간" | "낮음";
  actions: string[];            // 추천 행동
}

// 직급 테이블
export const RANK_TABLE = [
  { name: "쉐어러", minCvp: 50 },
  { name: "빌리버", minCvp: 100 },
  { name: "빌더", minCvp: 200 },
  { name: "어치버", minCvp: 400 },
  { name: "디렉터", minCvp: 600 },
  { name: "브론즈디렉터", minCvp: 800 },
  { name: "실버디렉터", minCvp: 1000 },
  { name: "골드디렉터", minCvp: 4000 }, // 1000×4주 연속 = 4000 CVP 기준으로 단순화
  { name: "루비", minCvp: 8000 },
  { name: "에메랄드", minCvp: 12000 },
  { name: "다이아", minCvp: 16000 },
];

export function getRank(totalCvp: number): string {
  let rank = "미달성";
  for (const r of RANK_TABLE) {
    if (totalCvp >= r.minCvp) rank = r.name;
    else break;
  }
  return rank;
}

export function getNextRank(totalCvp: number): { name: string; minCvp: number } | null {
  for (const r of RANK_TABLE) {
    if (totalCvp < r.minCvp) return r;
  }
  return null;
}

// 소실적 → 기본 수당. 125점 미만은 미발생(0). (운영정책 3-10)
export function basicCommissionFromMin(minCvp: number): number {
  return minCvp >= MIN_ACTIVE_CVP ? minCvp * BASIC_RATE : 0;
}

export function calcCommission(input: CommissionInput): CommissionResult {
  const { shops } = input;

  // 라인별 소실적(좌우 중 작은 값)
  const mins = shops.map((s) => ({ id: s.id, min: Math.min(s.left, s.right) }));
  const totalMinCvp = mins.reduce((sum, m) => sum + m.min, 0);
  // 125점 이상 라인만 기본 수당 발생
  const eligibleMinCvp = mins.reduce((sum, m) => sum + (m.min >= MIN_ACTIVE_CVP ? m.min : 0), 0);
  const pendingShopIds = mins.filter((m) => m.min < MIN_ACTIVE_CVP).map((m) => m.id);

  const basicCommissionUsd = eligibleMinCvp * BASIC_RATE;

  // 세일즈 보너스 (직접 소개 라인 합계 × 10%)
  const directReferralCvp = shops
    .filter((s) => s.isDirectReferral)
    .reduce((sum, s) => sum + s.left + s.right, 0);
  const salesBonusUsd = directReferralCvp * SALES_BONUS_RATE;

  const totalCommissionUsd = basicCommissionUsd + salesBonusUsd;
  const totalCommissionKrw = Math.round(totalCommissionUsd * USD_TO_KRW);
  const netCommissionKrw = Math.round(totalCommissionUsd * USD_TO_KRW * (1 - TAX_RATE));

  const currentRank = getRank(totalMinCvp);
  const next = getNextRank(totalMinCvp);
  const nextRank = next?.name ?? null;
  const cvpToNextRank = next ? next.minCvp - totalMinCvp : 0;

  return {
    bcCount: shops.length,
    maintenanceRequiredCvp: maintenanceRequirement(shops.length),
    totalMinCvp,
    eligibleMinCvp,
    pendingShopIds,
    basicCommissionUsd,
    salesBonusUsd,
    totalCommissionUsd,
    totalCommissionKrw,
    netCommissionKrw,
    currentRank,
    nextRank,
    cvpToNextRank,
  };
}

export interface ThreeBCBreakdown {
  comm001Usd: number;
  comm002Usd: number;
  comm003Usd: number;
  /** 공유 누적 반영 후 001 좌/우 */
  adjusted001Left: number;
  adjusted001Right: number;
  /** 신규점수가 입력되지 않아 누적을 0으로 가정한 경우 true (정확한 3BC를 위해 newLeft/newRight 필요) */
  missingNewPoints: boolean;
}

/**
 * 3BC 공유/누적 구조 수당 계산. (운영정책 3-10)
 * - 002 자체수당 = 002 좌우 소실적(125+) × 20%
 * - 003 자체수당 = 003 좌우 소실적(125+) × 20%
 * - 002 좌우 신규점수 합계 → 001 좌에 누적, 003 좌우 신규점수 합계 → 001 우에 누적 (이월점수 제외)
 * - 누적 반영된 001 좌우 소실적(125+)으로 001 수당 재계산
 * - 총 수당 = 002수당 + 003수당 + 001수당 (+ 세일즈 보너스)
 *
 * 신규점수(newLeft/newRight) 미입력 시 누적을 0으로 보고 missingNewPoints=true로 표시한다(값을 지어내지 않음).
 */
export function calc3BCCommission(shops: ShopLine[]): CommissionResult & { breakdown: ThreeBCBreakdown } {
  const find = (id: string) => shops.find((s) => s.id === id);
  const s001 = find("001");
  const s002 = find("002");
  const s003 = find("003");
  if (!s001 || !s002 || !s003) {
    throw new Error("calc3BCCommission: 001, 002, 003 세 센터가 모두 필요합니다.");
  }

  const comm002Usd = basicCommissionFromMin(Math.min(s002.left, s002.right));
  const comm003Usd = basicCommissionFromMin(Math.min(s003.left, s003.right));

  // 신규점수(이월 제외) 누적. 미입력이면 0 (누적 없음).
  const hasNew = [s002, s003].some((s) => s.newLeft !== undefined || s.newRight !== undefined);
  const new002 = (s002.newLeft ?? 0) + (s002.newRight ?? 0);
  const new003 = (s003.newLeft ?? 0) + (s003.newRight ?? 0);
  const adjusted001Left = s001.left + new002;
  const adjusted001Right = s001.right + new003;
  const comm001Usd = basicCommissionFromMin(Math.min(adjusted001Left, adjusted001Right));

  const basicCommissionUsd = comm001Usd + comm002Usd + comm003Usd;

  const directReferralCvp = shops
    .filter((s) => s.isDirectReferral)
    .reduce((sum, s) => sum + s.left + s.right, 0);
  const salesBonusUsd = directReferralCvp * SALES_BONUS_RATE;

  const totalCommissionUsd = basicCommissionUsd + salesBonusUsd;
  const totalCommissionKrw = Math.round(totalCommissionUsd * USD_TO_KRW);
  const netCommissionKrw = Math.round(totalCommissionUsd * USD_TO_KRW * (1 - TAX_RATE));

  // 참고용 소실적/직급 (누적 반영된 001 + 002 + 003)
  const min001 = Math.min(adjusted001Left, adjusted001Right);
  const min002 = Math.min(s002.left, s002.right);
  const min003 = Math.min(s003.left, s003.right);
  const totalMinCvp = min001 + min002 + min003;
  const eligibleMinCvp = [min001, min002, min003].reduce((sum, m) => sum + (m >= MIN_ACTIVE_CVP ? m : 0), 0);
  const pendingShopIds = [
    { id: "001", min: min001 },
    { id: "002", min: min002 },
    { id: "003", min: min003 },
  ].filter((m) => m.min < MIN_ACTIVE_CVP).map((m) => m.id);

  const currentRank = getRank(totalMinCvp);
  const next = getNextRank(totalMinCvp);

  return {
    bcCount: 3,
    maintenanceRequiredCvp: maintenanceRequirement(3),
    totalMinCvp,
    eligibleMinCvp,
    pendingShopIds,
    basicCommissionUsd,
    salesBonusUsd,
    totalCommissionUsd,
    totalCommissionKrw,
    netCommissionKrw,
    currentRank,
    nextRank: next?.name ?? null,
    cvpToNextRank: next ? next.minCvp - totalMinCvp : 0,
    breakdown: {
      comm001Usd,
      comm002Usd,
      comm003Usd,
      adjusted001Left,
      adjusted001Right,
      missingNewPoints: !hasNew,
    },
  };
}

// 3가지 시나리오 생성
export function generateScenarios(
  result: CommissionResult,
  input: CommissionInput
): Scenario[] {
  // 기본수당은 125점 이상 소실적(eligible) 기준으로 투영한다. 추가 CVP는 가용 점수로 가정.
  const base = result.eligibleMinCvp;

  // 안정형: 현 구조 유지 (추가 0)
  const conservative: Scenario = {
    name: "안정형",
    description: "확정된 재구매/오토십만으로 유지",
    additionalCvp: 0,
    projectedTotalCvp: result.totalMinCvp,
    projectedRank: result.currentRank,
    projectedCommissionUsd: result.totalCommissionUsd,
    projectedNetKrw: result.netCommissionKrw,
    feasibility: "높음",
    actions: ["기존 소비자 재구매 확인", "오토십 예정자 체크"],
  };

  // 승급형: 신규 1~2명 추가 (약 200 CVP 추가)
  const standardUsd = (base + 200) * BASIC_RATE + result.salesBonusUsd;
  const standard: Scenario = {
    name: "승급형",
    description: "기존 재구매 + 신규/업셀 1~2건",
    additionalCvp: 200,
    projectedTotalCvp: result.totalMinCvp + 200,
    projectedRank: getRank(result.totalMinCvp + 200),
    projectedCommissionUsd: standardUsd,
    projectedNetKrw: Math.round(standardUsd * USD_TO_KRW * (1 - TAX_RATE)),
    feasibility: "중간",
    actions: ["신규 미팅 1~2건", "기존 소비자 업셀 시도", "리셋 1명 연결"],
  };

  // 집중형: 4주 집중 (다음 직급 목표)
  const addToNext = result.cvpToNextRank > 0 ? result.cvpToNextRank : 500;
  const aggressiveUsd = (base + addToNext) * BASIC_RATE + result.salesBonusUsd;
  const aggressive: Scenario = {
    name: "집중형",
    description: result.nextRank
      ? `4주 집중으로 ${result.nextRank} 달성`
      : "4주 집중 운영",
    additionalCvp: addToNext,
    projectedTotalCvp: result.totalMinCvp + addToNext,
    projectedRank: getRank(result.totalMinCvp + addToNext),
    projectedCommissionUsd: aggressiveUsd,
    projectedNetKrw: Math.round(aggressiveUsd * USD_TO_KRW * (1 - TAX_RATE)),
    feasibility: result.cvpToNextRank < 300 ? "높음" : result.cvpToNextRank < 800 ? "중간" : "낮음",
    actions: [
      `부족 CVP ${addToNext}점 채우기`,
      "신규 소개 집중 3~5명",
      "파트너 동반도전 제안",
      "리셋/챌린지 패키지 집중",
    ],
  };

  // input is used for future extensibility (e.g., period-based adjustments)
  void input;

  return [conservative, standard, aggressive];
}

// ── 이미지/텍스트에서 BC별 좌·우 점수 구조화 추출 (B-2: 결과 결정화) ──────────
// vision LLM은 JSON 추출까지만 쓰고, 수당 계산은 전부 calcCommission(결정적 코드)이 담당한다.
// 값이 없거나 형식이 깨지면 null을 반환해 "되묻기" 경로로 보낸다 (숫자를 지어내지 않음).

/** vision json_object 응답(문자열)에서 BC별 {bc,left,right} 배열을 검증·정규화한다. 실패 시 null */
export function parseVisionShopsJson(raw: string): ShopLine[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const shopsRaw = (parsed as { shops?: unknown }).shops;
  if (!Array.isArray(shopsRaw)) return null;

  const shops: ShopLine[] = [];
  for (let i = 0; i < shopsRaw.length; i++) {
    const s = shopsRaw[i];
    if (!s || typeof s !== "object") continue;
    const left = Number((s as { left?: unknown }).left);
    const right = Number((s as { right?: unknown }).right);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left < 0 || right < 0) continue;
    const bcRaw = (s as { bc?: unknown }).bc;
    const bc = typeof bcRaw === "string" && bcRaw.trim()
      ? bcRaw.trim()
      : String(i + 1).padStart(3, "0");
    shops.push({ id: bc, left, right });
  }
  return shops.length > 0 ? shops : null;
}

/**
 * 텍스트에서 "001BC 좌 406 우 3063" / "좌406/우3063" 패턴을 전부 찾아 ShopLine으로 만든다.
 * (추출 실패로 되물었을 때 사용자가 텍스트로 답하는 경로. 좌/우 표기가 없으면 빈 배열)
 */
export function parseShopLinesFromText(text: string): ShopLine[] {
  const shops: ShopLine[] = [];
  const re = /(?:(\d{3})\s*(?:BC|bc|비씨)?\s*[::]?\s*)?좌(?:측)?\s*[::]?\s*([\d,]+)\s*[\/,·]?\s*우(?:측)?\s*[::]?\s*([\d,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const left = parseInt(m[2].replace(/,/g, ""), 10);
    const right = parseInt(m[3].replace(/,/g, ""), 10);
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    const id = m[1] ?? String(shops.length + 1).padStart(3, "0");
    shops.push({ id, left, right });
  }
  return shops;
}

// 간편 계산 (총 CVP만 입력 시) — 단일 소실적으로 보고 125점 미만은 기본수당 미발생 처리.
export function calcFromTotalCvp(totalCvp: number, salesBonusCvp = 0, bcCount = 1): CommissionResult {
  const eligible = totalCvp >= MIN_ACTIVE_CVP ? totalCvp : 0;
  const basicUsd = eligible * BASIC_RATE;
  const salesUsd = salesBonusCvp * SALES_BONUS_RATE;
  const totalUsd = basicUsd + salesUsd;

  return {
    bcCount,
    maintenanceRequiredCvp: maintenanceRequirement(bcCount),
    totalMinCvp: totalCvp,
    eligibleMinCvp: eligible,
    pendingShopIds: totalCvp < MIN_ACTIVE_CVP ? ["소실적"] : [],
    basicCommissionUsd: basicUsd,
    salesBonusUsd: salesUsd,
    totalCommissionUsd: totalUsd,
    totalCommissionKrw: Math.round(totalUsd * USD_TO_KRW),
    netCommissionKrw: Math.round(totalUsd * USD_TO_KRW * (1 - TAX_RATE)),
    currentRank: getRank(totalCvp),
    nextRank: getNextRank(totalCvp)?.name ?? null,
    cvpToNextRank: getNextRank(totalCvp)
      ? (getNextRank(totalCvp)!.minCvp - totalCvp)
      : 0,
  };
}
