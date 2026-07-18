import { describe, expect, it } from "vitest";
import {
  calculateDomains,
  calculateEvidencePriorities,
  calculateHealthScore,
  calculateLifestyleAdherence,
  calculateLifestyleScore,
  calculateRootCauses,
  getLifestyleGrade,
  getRiskLevel,
  hasSafetyWarning,
} from "./scoring";
import type { AssessmentPayload } from "./types";

describe("health-check scoring", () => {
  it("상태 구간의 경계값을 정확히 분류한다", () => {
    expect(getRiskLevel(3)).toBe("good");
    expect(getRiskLevel(4)).toBe("attention");
    expect(getRiskLevel(7)).toBe("warning");
    expect(getRiskLevel(11)).toBe("risk");
    expect(getRiskLevel(15)).toBe("risk");
  });

  it("건강점수를 0~100 사이로 계산한다", () => {
    expect(calculateHealthScore(0)).toBe(100);
    expect(calculateHealthScore(90)).toBe(50);
    expect(calculateHealthScore(180)).toBe(0);
  });

  it("생활습관 점수와 등급을 계산한다", () => {
    const lifestyle = { regularMeals: 5, vegetables: 5, fruit: 5, protein: 5, hydration: 5, caffeine: 5, exercise: 5, sleep: 5, sunlight: 5, monitoring: 5 };
    expect(calculateLifestyleScore(lifestyle)).toBe(50);
    expect(getLifestyleGrade(50)).toBe("⭐ 매우 우수");
    expect(getLifestyleGrade(44)).toBe("👍 양호");
    expect(getLifestyleGrade(34)).toBe("⚠ 개선 필요");
    expect(getLifestyleGrade(24)).toBe("🚨 집중 관리 권장");
    expect(calculateLifestyleAdherence(lifestyle)).toBe(100);
  });

  it("증상 빈도와 연관 생활습관을 함께 반영해 우선도를 계산한다", () => {
    const answers = Object.fromEntries([
      ...["blood_sugar_1", "blood_sugar_2", "blood_sugar_3", "blood_sugar_4", "blood_sugar_5"].map((code) => [code, 3]),
      ...["energy_1", "energy_2", "energy_3", "energy_4", "energy_5"].map((code) => [code, 1]),
    ]);
    const lifestyle = {
      regularMeals: 1, vegetables: 1, fruit: 5, protein: 1, hydration: 5,
      caffeine: 5, exercise: 1, sleep: 5, sunlight: 5, monitoring: 1,
    };
    const priorities = calculateEvidencePriorities(calculateDomains(answers), answers, lifestyle);
    const bloodSugar = priorities.find((domain) => domain.code === "blood_sugar");
    const energy = priorities.find((domain) => domain.code === "energy");
    expect(bloodSugar?.priorityScore).toBeGreaterThan(energy?.priorityScore ?? 0);
    expect(bloodSugar?.priorityReasons).toHaveLength(2);
  });

  it("빈 응답은 0점으로 처리하고 12개 영역을 반환한다", () => {
    const domains = calculateDomains({});
    expect(domains).toHaveLength(12);
    expect(domains.every((domain) => domain.rawScore === 0)).toBe(true);
  });

  it("동점이면 지정된 우선순위를 적용한다", () => {
    const answers = {
      blood_sugar_1: 3,
      circulation_1: 3,
      recovery_1: 3,
    };
    const ranked = calculateDomains(answers).sort((a, b) => a.rank - b.rank);
    expect(ranked.slice(0, 3).map((domain) => domain.code)).toEqual([
      "blood_sugar",
      "circulation",
      "recovery",
    ]);
  });

  it("원인 후보를 0~100 점수로 계산한다", () => {
    const causes = calculateRootCauses(calculateDomains({ blood_sugar_1: 3, hormone_1: 3, circulation_1: 3 }));
    expect(causes).toHaveLength(10);
    expect(causes.every((cause) => cause.score >= 0 && cause.score <= 100)).toBe(true);
    expect(causes.every((cause) => ["낮음", "보통", "높음"].includes(cause.confidence ?? ""))).toBe(true);
  });

  it("세포 에너지 연관 패턴을 소비자 언어로 설명한다", () => {
    const answers = Object.fromEntries(
      ["energy", "recovery", "brain_nerve"].flatMap((domain) =>
        [1, 2, 3, 4, 5].map((number) => [`${domain}_${number}`, 3]),
      ),
    );
    const cause = calculateRootCauses(calculateDomains(answers))[0];
    expect(cause.code).toBe("mitochondrial");
    expect(cause.flowLabels).toEqual([
      "생활습관 및 스트레스",
      "세포 에너지 생산능력 변화 가능성",
      "뇌·신경·자율신경 조절 신호",
    ]);
    expect(cause.consumerExplanation).toContain("기능의학적 관점");
  });

  it("의료 우선 확인 문구를 감지한다", () => {
    const payload = {
      profile: { name: "테스트", gender: "female", age: 40, heightCm: 165, weightKg: 60, notes: "최근 흉통이 있었음" },
      lifestyle: { regularMeals: 1, vegetables: 1, fruit: 1, protein: 1, hydration: 1, caffeine: 1, exercise: 1, sleep: 1, sunlight: 1, monitoring: 1 },
      answers: {},
    } satisfies AssessmentPayload;
    expect(hasSafetyWarning(payload)).toBe(true);
  });
});
