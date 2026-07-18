import { HEALTH_DOMAINS, PRIORITY_ORDER } from "./data";
import type {
  AssessmentPayload,
  DomainResult,
  HealthReport,
  LifestyleProfile,
  RiskLevel,
  RootCauseResult,
} from "./types";

export const MEDICAL_DISCLAIMER =
  "본 결과는 질병을 진단하거나 치료하기 위한 의료서비스가 아닙니다. 건강상태와 생활습관을 점검하고 건강관리 방향을 제안하기 위한 참고자료입니다.";

export const RISK_LEVELS = [
  { min: 0, max: 3, code: "good" as const, label: "양호", message: "현재 건강자산을 잘 유지하고 있습니다." },
  { min: 4, max: 6, code: "attention" as const, label: "보통", message: "일부 생활습관 개선이 필요합니다." },
  { min: 7, max: 10, code: "warning" as const, label: "경계", message: "원인 확인과 적극적인 관리가 필요합니다." },
  { min: 11, max: 15, code: "risk" as const, label: "위험", message: "전문상담과 체계적인 관리가 권장됩니다." },
];

export function getRiskLevel(score: number): RiskLevel {
  return RISK_LEVELS.find((level) => score >= level.min && score <= level.max)?.code ?? "risk";
}

export function getRiskLabel(level: RiskLevel) {
  return RISK_LEVELS.find((item) => item.code === level)?.label ?? "확인 필요";
}

export function calculateHealthScore(totalRiskScore: number) {
  return Math.max(0, Math.min(100, Math.round(100 - (totalRiskScore / 180) * 100)));
}

export function getHealthGrade(score: number) {
  if (score >= 85) return "건강자산 우수";
  if (score >= 70) return "대체로 양호";
  if (score >= 55) return "관리 필요";
  if (score >= 40) return "적극 관리 필요";
  return "집중 관리 권장";
}

export function calculateLifestyleScore(lifestyle: AssessmentPayload["lifestyle"]) {
  return Object.values(lifestyle).reduce((sum, score) => sum + score, 0);
}

export function getLifestyleGrade(score: number) {
  if (score >= 45) return "⭐ 매우 우수";
  if (score >= 35) return "👍 양호";
  if (score >= 25) return "⚠ 개선 필요";
  return "🚨 집중 관리 권장";
}

export function calculateLifestyleAdherence(lifestyle: AssessmentPayload["lifestyle"]) {
  const achieved = Object.values(lifestyle).filter((score) => score === 5).length;
  return Math.round((achieved / Object.keys(lifestyle).length) * 100);
}

export function calculateDomains(answers: Record<string, number>): DomainResult[] {
  const results = HEALTH_DOMAINS.map((domain) => {
    const rawScore = domain.questions.reduce((sum, question) => sum + (answers[question.code] ?? 0), 0);
    const level = getRiskLevel(rawScore);
    return {
      code: domain.code,
      name: domain.name,
      rawScore,
      maxScore: 15,
      normalizedRisk: Math.round((rawScore / 15) * 100),
      level,
      rank: 0,
      summary: RISK_LEVELS.find((item) => item.code === level)?.message ?? "",
    };
  });
  const priorityIndex = (code: string) => PRIORITY_ORDER.indexOf(code);
  const ranked = [...results].sort((a, b) => b.rawScore - a.rawScore || priorityIndex(a.code) - priorityIndex(b.code));
  return results.map((result) => ({
    ...result,
    rank: ranked.findIndex((item) => item.code === result.code) + 1,
  }));
}

const lifestyleLinks: Record<string, (keyof LifestyleProfile)[]> = {
  blood_sugar: ["regularMeals", "vegetables", "protein", "exercise", "monitoring"],
  energy: ["protein", "hydration", "exercise", "sleep", "sunlight"],
  gut: ["regularMeals", "vegetables", "fruit", "hydration"],
  inflammation: ["vegetables", "fruit", "exercise", "sleep"],
  immunity: ["protein", "sleep", "sunlight", "exercise"],
  hormone: ["regularMeals", "sleep", "exercise", "caffeine"],
  detox: ["hydration", "vegetables", "fruit", "caffeine"],
  brain_nerve: ["sleep", "exercise", "caffeine", "hydration"],
  circulation: ["exercise", "monitoring", "hydration", "sleep"],
  musculoskeletal: ["protein", "exercise", "sunlight", "sleep"],
  skin_aging: ["hydration", "vegetables", "fruit", "sleep", "sunlight"],
  recovery: ["sleep", "protein", "hydration", "exercise", "caffeine"],
};

export function calculateEvidencePriorities(
  domains: DomainResult[],
  answers: Record<string, number>,
  lifestyle: LifestyleProfile,
) {
  const priorityIndex = (code: string) => PRIORITY_ORDER.indexOf(code);
  const enriched = domains.map((domain) => {
    const definition = HEALTH_DOMAINS.find((item) => item.code === domain.code);
    const questionScores = definition?.questions.map((question) => answers[question.code] ?? 0) ?? [];
    const frequentSignalRatio = questionScores.filter((score) => score >= 2).length / Math.max(1, questionScores.length);
    const linkedHabits = lifestyleLinks[domain.code] ?? [];
    const lifestyleGapRatio = linkedHabits.filter((key) => lifestyle[key] !== 5).length / Math.max(1, linkedHabits.length);
    const priorityScore = Math.round(
      domain.normalizedRisk * 0.6 +
      frequentSignalRatio * 100 * 0.25 +
      lifestyleGapRatio * 100 * 0.15,
    );
    const priorityReasons = [
      `${questionScores.filter((score) => score >= 2).length}/${questionScores.length}개 신호가 자주 이상`,
      `${linkedHabits.filter((key) => lifestyle[key] !== 5).length}/${linkedHabits.length}개 연관 생활습관 개선 필요`,
    ];
    return { ...domain, priorityScore, priorityReasons };
  });
  const ranked = [...enriched].sort(
    (a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || priorityIndex(a.code) - priorityIndex(b.code),
  );
  return enriched.map((domain) => ({
    ...domain,
    rank: ranked.findIndex((item) => item.code === domain.code) + 1,
  }));
}

const causeRules = [
  { code: "insulin_load", name: "혈당·인슐린 부담", domains: ["blood_sugar", "hormone", "circulation"] },
  { code: "mitochondrial", name: "에너지 생산 저하 가능성", domains: ["energy", "recovery", "brain_nerve"] },
  { code: "gut_barrier", name: "장내환경·장벽 기능 부담", domains: ["gut", "immunity", "inflammation"] },
  { code: "chronic_inflammation", name: "만성 염증 부담", domains: ["inflammation", "gut", "immunity"] },
  { code: "oxidative_glycation", name: "산화·당화 스트레스", domains: ["skin_aging", "inflammation", "blood_sugar"] },
  { code: "nutrient_gap", name: "영양결핍 가능성", domains: ["musculoskeletal", "recovery", "energy"] },
  { code: "hormone_balance", name: "호르몬 균형 변화", domains: ["hormone", "recovery", "blood_sugar"] },
  { code: "detox_load", name: "간·해독 부담", domains: ["detox", "skin_aging", "energy"] },
  { code: "autonomic_stress", name: "자율신경·스트레스 부담", domains: ["brain_nerve", "recovery", "energy"] },
  { code: "vascular_load", name: "혈관·순환 부담", domains: ["circulation", "inflammation", "blood_sugar"] },
];

const causeNarratives: Record<string, { flowLabels: string[]; consumerExplanation: string }> = {
  mitochondrial: {
    flowLabels: [
      "생활습관 및 스트레스",
      "세포 에너지 생산능력 변화 가능성",
      "뇌·신경·자율신경 조절 신호",
    ],
    consumerExplanation:
      "생활습관과 스트레스의 영향이 누적되면서 몸의 세포가 에너지를 만들고 사용하는 효율이 떨어졌을 가능성이 있습니다. 이와 함께 뇌·신경계와 자율신경계가 몸의 리듬과 회복을 조절하는 데 부담을 느끼는 패턴이 함께 나타났습니다. 현재 몸의 컨디션을 이해하기 위한 기능의학적 관점의 설명입니다.",
  },
};

export function calculateRootCauses(domains: DomainResult[]): RootCauseResult[] {
  const scoreMap = new Map(domains.map((domain) => [domain.code, domain.normalizedRisk]));
  return causeRules.map((rule) => {
    const score = Math.round(rule.domains.reduce((sum, code) => sum + (scoreMap.get(code) ?? 0), 0) / rule.domains.length);
    const elevatedDomainCount = rule.domains.filter((code) => (scoreMap.get(code) ?? 0) >= 47).length;
    const confidence: RootCauseResult["confidence"] =
      elevatedDomainCount >= 2 && score >= 50 ? "높음" : elevatedDomainCount >= 1 ? "보통" : "낮음";
    const narrative = causeNarratives[rule.code];
    return {
      code: rule.code,
      name: rule.name,
      score,
      level: getRiskLevel(Math.round(score * 0.15)),
      evidenceDomains: rule.domains,
      explanation: `${rule.domains.map((code) => HEALTH_DOMAINS.find((domain) => domain.code === code)?.name).join("·")} 영역 중 ${elevatedDomainCount}개에서 반복 신호가 확인됐습니다. 연관성을 보여주는 참고 패턴이며 원인을 확정하지 않습니다.`,
      confidence,
      elevatedDomainCount,
      flowLabels: narrative?.flowLabels,
      consumerExplanation: narrative?.consumerExplanation,
    };
  }).sort((a, b) => {
    const confidenceRank = { 높음: 3, 보통: 2, 낮음: 1 };
    return confidenceRank[b.confidence ?? "낮음"] - confidenceRank[a.confidence ?? "낮음"] || b.score - a.score;
  });
}

const safetyTerms = [
  "흉통", "호흡곤란", "실신", "급격한 체중 감소", "출혈", "고열", "심한 복통",
  "임신", "최근 수술", "암 치료", "당뇨 약", "항응고제", "심혈관질환", "신장질환", "간질환",
];

export function hasSafetyWarning(payload: AssessmentPayload) {
  const text = [
    payload.profile.diagnoses,
    payload.profile.medications,
    payload.profile.surgeries,
    payload.profile.notes,
  ].filter(Boolean).join(" ");
  return safetyTerms.some((term) => text.includes(term));
}

export function createHealthReport(payload: AssessmentPayload, assessmentId = crypto.randomUUID()): HealthReport {
  const domains = calculateEvidencePriorities(calculateDomains(payload.answers), payload.answers, payload.lifestyle);
  const ranked = [...domains].sort((a, b) => a.rank - b.rank);
  const topAssets = [...domains].sort((a, b) => a.rawScore - b.rawScore || b.rank - a.rank).slice(0, 3);
  const totalRiskScore = domains.reduce((sum, domain) => sum + domain.rawScore, 0);
  const healthScore = calculateHealthScore(totalRiskScore);
  const lifestyleScore = calculateLifestyleScore(payload.lifestyle);
  const lifestyleAdherence = calculateLifestyleAdherence(payload.lifestyle);
  const topPriorities = ranked.slice(0, 3);
  const rootCauses = calculateRootCauses(domains);
  const firstPriority = topPriorities[0];
  const topCause = rootCauses[0];

  return {
    assessmentId,
    profile: payload.profile,
    lifestyle: payload.lifestyle,
    healthScore,
    healthGrade: getHealthGrade(healthScore),
    lifestyleScore,
    lifestyleGrade: getLifestyleGrade(lifestyleScore),
    lifestyleAdherence,
    totalRiskScore,
    topPriorities,
    topAssets,
    domains,
    rootCauses,
    overallAssessment: `${payload.profile.name || "회원"}님의 건강관리 지표는 ${healthScore}점으로 ‘${getHealthGrade(healthScore)}’ 단계입니다. ${topAssets.map((item) => item.name).join("·")} 영역은 비교적 안정적으로 유지되고 있으며, ${topPriorities.map((item) => item.name).join("·")} 순서로 생활습관을 점검하는 것이 좋습니다.`,
    causeAnalysis: topCause.consumerExplanation
      ? topCause.consumerExplanation
      : `문진표에서 ${topCause.name}과 ${firstPriority.name} 영역이 서로 연결되는 몸의 컨디션 패턴이 보입니다. 생활습관을 조절하면서 변화를 살펴보는 것이 좋습니다.`,
    roadmap: [
      { week: 1, title: `${topPriorities[0].name} 기반 만들기`, goal: "가장 높은 우선순위의 부담 요인을 줄입니다.", actions: ["기상·식사 시간을 기록하기", "가장 쉬운 행동 한 가지를 매일 반복하기"], expected: "일상 신호의 변화를 더 선명하게 파악할 수 있습니다." },
      { week: 2, title: `${topPriorities[1].name} 균형 잡기`, goal: "두 번째 우선영역을 생활 리듬과 연결합니다.", actions: ["식사 후 10분 가볍게 걷기", "수분 섭취와 컨디션 함께 기록하기"], expected: "오후 활력과 회복 패턴이 달라질 수 있습니다." },
      { week: 3, title: "운동·순환·근육", goal: "무리하지 않는 활동량을 확보합니다.", actions: ["주 3회 20분 걷기", "주 2회 가벼운 근력·균형 운동"], expected: "활동 후 피로와 신체 자신감에 긍정적 변화가 기대됩니다." },
      { week: 4, title: "습관 정착과 재평가", goal: "효과적이었던 습관만 남깁니다.", actions: ["주간 기록 돌아보기", "유지할 습관 2가지 선택하기"], expected: "나에게 맞는 건강관리 루틴을 구체화할 수 있습니다." },
    ],
    coachMessage: `지금의 결과는 몸이 보내는 신호를 이해하기 위한 출발점입니다. ${topAssets[0].name}이라는 강점을 유지하면서 ${firstPriority.name}부터 작은 변화를 시작해 보세요. 모든 것을 한 번에 바꾸기보다 4주 동안 한두 가지 행동을 꾸준히 반복하는 편이 더 현실적입니다.`,
    safetyWarning: hasSafetyWarning(payload),
    algorithmVersion: "GENIEA Evidence Priority v1.0",
    assessmentBasis: [
      "안전 우선: 의료 확인이 필요한 병력·증상 키워드를 일반 건강관리보다 먼저 안내합니다.",
      "증상 부담 60%: 12개 영역별 자가보고 빈도를 0~100으로 표준화합니다.",
      "반복 신호 25%: ‘자주’ 또는 ‘거의 항상’ 응답의 비율을 반영합니다.",
      "생활습관 15%: WHO·공중보건 권고와 연결되는 실천 공백을 반영합니다.",
      "연관 패턴 신뢰도: IFM Matrix 방식으로 연결된 영역 중 2개 이상이 함께 상승할 때만 ‘높음’으로 표시합니다.",
    ],
    createdAt: new Date().toISOString(),
  };
}
