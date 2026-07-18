import type { HealthChecklistAnalysis } from "@/app/api/analyze/health-checklist/route";

export interface JudgmentResult {
  needsReset: boolean;          // 리셋해독 프로그램 필요 여부
  resetWeeks: 1 | 2;            // 리셋 기간 (1주 or 2주)
  needsChallenge: boolean;       // 챌린지팩 추천 여부
  focusAreas: string[];          // 집중 케어 영역 (점수 높은 순)
  baseProducts: string[];        // 기본 ON 구성 제품명
  additionalProducts: string[];  // 추가 추천 제품명 (영역별 매핑)
  tier: "premium" | "standard" | "basic"; // 견적 등급
}

// 기본 ON 구성 (항상 포함)
export const BASE_PRODUCTS = [
  "헬스팩",
  "바이오메가",
  "프로후라바놀C300",
  "코큐텐",        // 코큐텐은 셀센셜즈로 대체 가능
  "헤파실 플러스",
  "알로엔즈 플러스",
  "화이버지 플러스",
  "프로바이오틱",
];

// 영역-제품 매핑
export const AREA_PRODUCT_MAP: Record<string, string[]> = {
  A: ["프로글루카뮨", "프로후라바놀C300", "프로바이오틱"],          // 면역
  B: ["바이오메가", "써큘레이트 플러스", "프로후라바놀C300"],       // 순환
  C: ["알로엔즈 플러스", "헤파실 플러스", "프로바이오틱"],          // 소화
  D: ["프로바이오틱", "화이버지 플러스", "에프오에스 액티브"],       // 장관
  E: ["바이오메가", "마그네칼D"],                                    // 뇌신경
  F: ["마그네칼D", "비타민D"],                                       // 호르몬
  G: ["프로글루카뮨", "프로후라바놀C300"],                           // 호흡
  H: ["바이오메가", "마그네칼D"],                                    // 비뇨
  I: ["프로코사 글루코사민", "마그네칼D", "바이오메가"],             // 골격
  J: ["프로후라바놀C300", "알로엔즈 플러스"],                        // 피부모발
};

// 리셋 필요 판단: B(순환) + D(장관) + F(호르몬) + J(피부모발) 합산 > 임계값
const RESET_THRESHOLD = 14; // 4개 영역 평균 3.5점 이상
const RESET_HEAVY_THRESHOLD = 20; // 평균 5점 이상 → 2주 리셋

export function judgeReset(scores: HealthChecklistAnalysis["scores"]): { needsReset: boolean; weeks: 1 | 2 } {
  const resetAreas = [
    scores.B ?? 0,
    scores.D ?? 0,
    scores.F ?? 0,
    scores.J ?? 0,
  ];
  const sum = resetAreas.reduce((a, b) => a + b, 0);
  if (sum >= RESET_HEAVY_THRESHOLD) return { needsReset: true, weeks: 2 };
  if (sum >= RESET_THRESHOLD) return { needsReset: true, weeks: 1 };
  return { needsReset: false, weeks: 1 };
}

// 챌린지 필요 판단: 체지방 > 25% OR BMI > 25 OR 식습관 불규칙 OR 운동 없음
export function judgeChallenge(analysis: HealthChecklistAnalysis): boolean {
  const { inbody, lifestyle } = analysis;
  if (inbody) {
    if ((inbody.bodyFatPercent ?? 0) > 25) return true;
    if ((inbody.bmi ?? 0) > 25) return true;
  }
  const diet = lifestyle.diet?.toLowerCase() ?? "";
  const exercise = lifestyle.exercise?.toLowerCase() ?? "";
  if (diet.includes("불규칙") || diet.includes("패스트푸드") || diet.includes("야식")) return true;
  if (exercise.includes("없음") || exercise.includes("안함") || exercise.includes("거의")) return true;
  return false;
}

// 집중 케어 영역: 점수 높은 순 상위 3개
export function getFocusAreas(scores: HealthChecklistAnalysis["scores"]): string[] {
  const areaNames: Record<string, string> = {
    A: "면역", B: "순환", C: "소화", D: "장관",
    E: "뇌신경", F: "호르몬", G: "호흡", H: "비뇨",
    I: "골격", J: "피부모발",
  };
  return Object.entries(scores)
    .filter(([, v]) => v !== null)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([k]) => areaNames[k] ?? k);
}

// 추가 제품 추천 (집중 영역별, 기본 ON 중복 제거)
export function getAdditionalProducts(scores: HealthChecklistAnalysis["scores"]): string[] {
  const focusKeys = Object.entries(scores)
    .filter(([, v]) => v !== null && (v as number) >= 3)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([k]) => k);

  const candidates = new Set<string>();
  for (const key of focusKeys) {
    for (const product of AREA_PRODUCT_MAP[key] ?? []) {
      if (!BASE_PRODUCTS.includes(product)) {
        candidates.add(product);
      }
    }
  }
  return Array.from(candidates).slice(0, 4);
}

// 견적 등급 판단
export function judgeTier(
  needsReset: boolean,
  needsChallenge: boolean,
  additionalCount: number
): "premium" | "standard" | "basic" {
  if (needsReset && needsChallenge) return "premium";
  if (needsReset || needsChallenge || additionalCount >= 3) return "standard";
  return "basic";
}

// 메인 분석 함수
export function analyzeHealth(analysis: HealthChecklistAnalysis): JudgmentResult {
  const { needsReset, weeks } = judgeReset(analysis.scores);
  const needsChallenge = judgeChallenge(analysis);
  const focusAreas = getFocusAreas(analysis.scores);
  const additionalProducts = getAdditionalProducts(analysis.scores);
  const tier = judgeTier(needsReset, needsChallenge, additionalProducts.length);

  return {
    needsReset,
    resetWeeks: weeks,
    needsChallenge,
    focusAreas,
    baseProducts: BASE_PRODUCTS,
    additionalProducts,
    tier,
  };
}
