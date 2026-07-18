// 여행달성 지플릿 계산 엔진
// CAC 구조 기반: 감정 → 현실 → 결정 → 시뮬레이션

import { USD_TO_KRW, TAX_RATE, getRank, getNextRank, calcFromTotalCvp } from "./commission-calculator";

export interface TravelInput {
  currentCvp: number;        // 현재 주간 CVP (소실적 합계)
  salesBonusCvp?: number;    // 세일즈 보너스 CVP
  directSponsors?: number;   // 직접 후원 수
  activePartners?: number;   // 움직이는 파트너 수
  promotablePartners?: number; // 승급 가능 파트너 수
  newMemberPotential?: number; // 신규 가능성 (추정 인원)
  travelBudgetKrw?: number;  // 여행 목표 비용 (원)
  weeks?: number;            // 목표 기간 (주)
}

export type TravelType = "A" | "B" | "C" | "D";

// 여행 점수 발생 4가지 유형
export interface TravelTypeAnalysis {
  type: TravelType;
  label: string;
  description: string;
  strength: "강함" | "보통" | "약함";
}

export interface TravelScenario {
  name: "보수형" | "표준형" | "집중형";
  description: string;
  // 주간 CVP 변화
  weeklyNewCvp: number;      // 추가 예상 CVP
  projectedWeeklyCvp: number;
  projectedRank: string;
  // 수당 3단 표기
  projectedUsd: number;
  projectedKrw: number;
  projectedNetKrw: number;
  // 여행 달성까지
  weeksToTravel: number | null; // null = 현재 구조로 어려움
  feasibility: "높음" | "중간" | "낮음";
  // 행동 제안
  actions: string[];
  // 사람 수 변환
  cvpBreakdown: Array<{ label: string; cvp: number; people?: number }>;
}

export interface TravelResult {
  // 현재 상태
  currentCvp: number;
  currentRank: string;
  currentWeeklyUsd: number;
  currentNetKrw: number;
  nextRank: string | null;
  cvpToNextRank: number;
  // 여행 목표 역산
  travelBudgetKrw: number;     // 목표 여행 비용
  monthlyIncomeNeeded: number;  // 필요 월 수입 (원)
  weeklyCommissionNeeded: number; // 필요 주간 수당 ($)
  cvpNeeded: number;            // 필요 CVP
  cvpGap: number;               // 현재와의 차이
  weeksGoal: number;            // 목표 달성 기간 (주)
  // 여행 유형 분석
  primaryType: TravelTypeAnalysis;
  // 3가지 시나리오
  scenarios: TravelScenario[];
}

// 여행 비용 기본값 (한화)
const DEFAULT_TRAVEL_BUDGET = 3_000_000; // 300만원 (가족 국내 여행)

// 여행 유형 판별
function detectTravelType(input: TravelInput): TravelTypeAnalysis {
  const { directSponsors = 0, activePartners = 0, promotablePartners = 0, newMemberPotential = 0 } = input;

  if (newMemberPotential >= 2 && promotablePartners >= 1) {
    return { type: "D", label: "동시 폭발형", description: "신규 + 승급 동시 발생 — 여행 점수 폭발 구간", strength: "강함" };
  }
  if (promotablePartners >= 1) {
    return { type: "C", label: "파트너 승급 중심", description: "기존 파트너 디렉터 승급 — 중기~후기 핵심 흐름", strength: "강함" };
  }
  if (newMemberPotential >= 2 || directSponsors >= 3) {
    return { type: "B", label: "신규 매칭 중심", description: "직접 후원 신규 조건 달성 — 속도 가장 빠른 구간", strength: "보통" };
  }
  if (activePartners >= 1) {
    return { type: "A", label: "개인 성장 중심", description: "개인 CVP 성장 + 유지 구조 형성 — 가장 안정적", strength: "보통" };
  }
  return { type: "A", label: "개인 성장 중심", description: "개인 CVP 성장 + 유지 구조 형성 — 가장 안정적", strength: "약함" };
}

// CVP → 사람 수 변환
function cvpToBreakdown(cvpNeeded: number): Array<{ label: string; cvp: number; people?: number }> {
  const breakdown = [];
  if (cvpNeeded <= 0) return [];

  // 100CVP = 1명 (리셋/기본 패키지 기준)
  const perPerson100 = Math.ceil(cvpNeeded / 100);
  breakdown.push({ label: `100CVP × ${perPerson100}명`, cvp: 100, people: perPerson100 });

  // 200CVP = 1명 (챌린지 패키지)
  if (cvpNeeded >= 200) {
    const perPerson200 = Math.ceil(cvpNeeded / 200);
    breakdown.push({ label: `200CVP × ${perPerson200}명`, cvp: 200, people: perPerson200 });
  }

  // 500CVP = 1명 (집중 패키지)
  if (cvpNeeded >= 500) {
    const perPerson500 = Math.ceil(cvpNeeded / 500);
    breakdown.push({ label: `500CVP × ${perPerson500}명`, cvp: 500, people: perPerson500 });
  }

  return breakdown;
}

export function calcTravelAchievement(input: TravelInput): TravelResult {
  const {
    currentCvp,
    salesBonusCvp = 0,
    travelBudgetKrw = DEFAULT_TRAVEL_BUDGET,
    weeks = 8,
  } = input;

  // 현재 수당 계산
  const commissionResult = calcFromTotalCvp(currentCvp, salesBonusCvp);

  // 역산: 여행 비용 → 필요 주간 수당
  // 여행 비용 = 한 달 수당 × N (N: 1~3)
  // 월 수입 = 주간 수당 × 4
  const monthlyIncomeNeeded = travelBudgetKrw / 3; // 3개월 치 수당으로 여행
  const weeklyCommissionNeeded = monthlyIncomeNeeded / 4; // 월 → 주
  const weeklyCommissionUsd = weeklyCommissionNeeded / USD_TO_KRW;
  // CVP needed: commission = CVP × 0.2 → CVP = commission / 0.2
  const cvpNeeded = Math.ceil(weeklyCommissionUsd / 0.2);
  const cvpGap = Math.max(0, cvpNeeded - currentCvp);

  // 여행 유형 분석
  const primaryType = detectTravelType(input);

  // 보수형: 현재 구조 유지
  const conservativeCvp = currentCvp;
  const conservativeUsd = conservativeCvp * 0.2 + (salesBonusCvp * 0.1);
  const conservativeNetKrw = Math.round(conservativeUsd * USD_TO_KRW * (1 - TAX_RATE));
  const conservativeWeeks = cvpGap <= 0 ? 4 : null; // 이미 달성
  const conservative: TravelScenario = {
    name: "보수형",
    description: "현재 구조 유지 + 기존 재구매 중심",
    weeklyNewCvp: 0,
    projectedWeeklyCvp: conservativeCvp,
    projectedRank: commissionResult.currentRank,
    projectedUsd: conservativeUsd,
    projectedKrw: Math.round(conservativeUsd * USD_TO_KRW),
    projectedNetKrw: conservativeNetKrw,
    weeksToTravel: conservativeWeeks,
    feasibility: conservativeWeeks ? "높음" : "낮음",
    actions: [
      "기존 소비자 재구매 확인",
      "오토십 예정자 점검",
      "이번 주 연락할 1명 정하기",
    ],
    cvpBreakdown: [],
  };

  // 표준형: 신규 1~2명 + 파트너 1명 성장 (약 +200~300 CVP)
  const standardAdd = Math.min(Math.max(200, cvpGap * 0.4), 500);
  const standardCvp = currentCvp + standardAdd;
  const standardUsd = standardCvp * 0.2 + (salesBonusCvp * 0.1);
  const standardNetKrw = Math.round(standardUsd * USD_TO_KRW * (1 - TAX_RATE));
  const standardWeeksToTravel = standardCvp >= cvpNeeded
    ? Math.ceil(travelBudgetKrw / (standardNetKrw * 4))
    : null;
  const standard: TravelScenario = {
    name: "표준형",
    description: "신규 1~2명 + 기존 파트너 1명 성장",
    weeklyNewCvp: standardAdd,
    projectedWeeklyCvp: standardCvp,
    projectedRank: getRank(standardCvp),
    projectedUsd: standardUsd,
    projectedKrw: Math.round(standardUsd * USD_TO_KRW),
    projectedNetKrw: standardNetKrw,
    weeksToTravel: standardWeeksToTravel ?? (weeks <= 8 ? weeks + 4 : null),
    feasibility: "중간",
    actions: [
      "신규 미팅 1~2건 잡기",
      "기존 소비자 업셀 1건",
      "파트너 동반도전 제안",
      "리셋/챌린지 1명 연결",
    ],
    cvpBreakdown: cvpToBreakdown(standardAdd),
  };

  // 집중형: 여행 확정 목표 (다음 직급 + 신규 집중)
  const intensiveCvp = Math.max(cvpNeeded, currentCvp + (commissionResult.cvpToNextRank || 500));
  const intensiveAdd = intensiveCvp - currentCvp;
  const intensiveUsd = intensiveCvp * 0.2 + (salesBonusCvp * 0.1);
  const intensiveNetKrw = Math.round(intensiveUsd * USD_TO_KRW * (1 - TAX_RATE));
  const intensiveWeeks = Math.ceil(travelBudgetKrw / (intensiveNetKrw * 4));
  const intensive: TravelScenario = {
    name: "집중형",
    description: "여행 확정용 — 신규 집중 + 파트너 승급 + 동반 2~4명",
    weeklyNewCvp: intensiveAdd,
    projectedWeeklyCvp: intensiveCvp,
    projectedRank: getRank(intensiveCvp),
    projectedUsd: intensiveUsd,
    projectedKrw: Math.round(intensiveUsd * USD_TO_KRW),
    projectedNetKrw: intensiveNetKrw,
    weeksToTravel: intensiveWeeks,
    feasibility: cvpGap < 500 ? "높음" : cvpGap < 1500 ? "중간" : "낮음",
    actions: [
      `부족 CVP ${cvpGap}점 채우기`,
      "신규 집중 3~5명 미팅",
      "파트너 승급 동반 설계",
      "리셋/챌린지 패키지 집중",
      "4주 플랜 체크포인트 설정",
    ],
    cvpBreakdown: cvpToBreakdown(intensiveAdd),
  };

  // nextRank 정보
  const nextRankInfo = getNextRank(currentCvp);

  return {
    currentCvp,
    currentRank: commissionResult.currentRank,
    currentWeeklyUsd: commissionResult.totalCommissionUsd,
    currentNetKrw: commissionResult.netCommissionKrw,
    nextRank: nextRankInfo?.name ?? null,
    cvpToNextRank: nextRankInfo ? nextRankInfo.minCvp - currentCvp : 0,
    travelBudgetKrw,
    monthlyIncomeNeeded: Math.round(monthlyIncomeNeeded),
    weeklyCommissionNeeded: Math.round(weeklyCommissionNeeded),
    cvpNeeded,
    cvpGap,
    weeksGoal: weeks,
    primaryType,
    scenarios: [conservative, standard, intensive],
  };
}

// 여행 비용 프리셋
export const TRAVEL_PRESETS = [
  { label: "국내 가족 (주말)", krw: 1_000_000 },
  { label: "국내 가족 (1주)", krw: 2_000_000 },
  { label: "제주도 (1주)", krw: 3_000_000 },
  { label: "일본/동남아 (1주)", krw: 5_000_000 },
  { label: "유럽 (2주)", krw: 10_000_000 },
] as const;
